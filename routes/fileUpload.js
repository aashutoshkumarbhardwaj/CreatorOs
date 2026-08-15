const express = require("express");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const rateLimit = require("express-rate-limit");
const sharp = require("sharp");
const {
  uploadFile: hfUploadFile,
  deleteFiles: hfDeleteFiles,
} = require("@huggingface/hub");
const Upload = require("../model/upload");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

const HF_TOKEN = process.env.HF_TOKEN;
const HF_REPO = process.env.HF_DATASET_REPO;
const HF_REPO_DESIGNATION = { type: "dataset", name: HF_REPO };

function assertHfConfigured() {
  if (!HF_TOKEN || !HF_REPO) {
    const err = new Error(
      "Hugging Face storage is not configured (HF_TOKEN / HF_DATASET_REPO missing).",
    );
    err.status = 500;
    throw err;
  }
}

function hfPublicUrl(hfPath) {
  return `https://huggingface.co/datasets/${HF_REPO}/resolve/main/${hfPath}`;
}

// Only allow bare filenames we generated ourselves — blocks path traversal
// via the :filename route param on rename/delete.
function isSafeFilename(filename) {
  return (
    typeof filename === "string" &&
    filename.length > 0 &&
    !filename.includes("/") &&
    !filename.includes("\\") &&
    filename === path.basename(filename)
  );
}

function sanitizeName(name) {
  return path
    .basename(name)
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/^\.+/, "");
}

// Buffer in memory — we upload straight to Hugging Face, never touch local disk.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ALLOWED_MIME_TYPES = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
    ];
    const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
    const fileExtension = path.extname(file.originalname).toLowerCase();

    if (
      !ALLOWED_MIME_TYPES.includes(file.mimetype) ||
      !ALLOWED_EXTENSIONS.includes(fileExtension)
    ) {
      return cb(
        new Error("Only image files (JPEG, PNG, WebP, GIF) are allowed."),
        false,
      );
    }

    cb(null, true);
  },
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { error: "Upload limit reached, please try again later." },
});

async function compressBuffer(buffer, mimetype) {
  // GIFs are skipped — sharp's default pipeline doesn't preserve animation
  if (mimetype === "image/gif") {
    return {
      compressed: false,
      buffer,
      originalSize: buffer.length,
      newSize: buffer.length,
    };
  }

  try {
    const pipeline = sharp(buffer).resize({
      width: 1920,
      height: 1920,
      fit: "inside",
      withoutEnlargement: true,
    });

    if (mimetype === "image/jpeg") {
      pipeline.jpeg({ quality: 80 });
    } else if (mimetype === "image/png") {
      pipeline.png({ quality: 80, compressionLevel: 8 });
    } else if (mimetype === "image/webp") {
      pipeline.webp({ quality: 80 });
    }

    const compressedBuffer = await pipeline.toBuffer();

    if (compressedBuffer.length < buffer.length) {
      return {
        compressed: true,
        buffer: compressedBuffer,
        originalSize: buffer.length,
        newSize: compressedBuffer.length,
      };
    }

    return {
      compressed: false,
      buffer,
      originalSize: buffer.length,
      newSize: buffer.length,
    };
  } catch (err) {
    console.error("[compress] Failed to compress image:", err);
    return {
      compressed: false,
      buffer,
      originalSize: buffer.length,
      newSize: buffer.length,
    };
  }
}

// ── UPLOAD ──────────────────────────────────────────────────────────────
router.post(
  "/upload",
  uploadLimiter,
  upload.single("file"),
  asyncHandler(async (req, res) => {
    assertHfConfigured();

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const compressionResult = await compressBuffer(
      req.file.buffer,
      req.file.mimetype,
    );

    const sanitizedFilename = sanitizeName(req.file.originalname);
    const storedFilename =
      Date.now() +
      "-" +
      crypto.randomBytes(4).toString("hex") +
      "-" +
      sanitizedFilename;
    const hfPath = `${req.user.id}/${storedFilename}`;

    await hfUploadFile({
      repo: HF_REPO_DESIGNATION,
      accessToken: HF_TOKEN,
      file: {
        path: hfPath,
        content: new Blob([compressionResult.buffer], {
          type: req.file.mimetype,
        }),
      },
    });

    const uploadDoc = await Upload.create({
      userId: req.user.id,
      filename: req.file.originalname,
      hfPath,
      url: hfPublicUrl(hfPath),
      mimetype: req.file.mimetype,
      size: compressionResult.newSize,
    });

    return res.json({
      filename: uploadDoc.filename,
      size: uploadDoc.size,
      mimetype: uploadDoc.mimetype,
      path: uploadDoc.hfPath,
      url: uploadDoc.url,
      compressed: compressionResult.compressed,
      originalSize: compressionResult.originalSize,
    });
  }),
);

// ── STORAGE USAGE ──────────────────────────────────────────────────────
router.get(
  "/storage-usage",
  asyncHandler(async (req, res) => {
    const files = await Upload.find({ userId: req.user.id })
      .select("size")
      .lean();
    const totalSize = files.reduce((sum, f) => sum + (f.size || 0), 0);
    return res.json({ success: true, totalSize, fileCount: files.length });
  }),
);

// ── RENAME ──────────────────────────────────────────────────────────────
// Hugging Face has no native rename — we re-upload the file's existing
// content under a new path, delete the old path, and update the DB record.
router.patch(
  "/rename/:filename",
  asyncHandler(async (req, res) => {
    assertHfConfigured();

    const { filename } = req.params;
    const { newName } = req.body;

    if (!isSafeFilename(filename)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid filename" });
    }
    if (!newName || typeof newName !== "string" || !newName.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "New name is required" });
    }

    const uploadDoc = await Upload.findOne({
      userId: req.user.id,
      hfPath: `${req.user.id}/${filename}`,
    });
    if (!uploadDoc) {
      return res
        .status(404)
        .json({ success: false, message: "File not found" });
    }

    const sanitizedDisplayName = sanitizeName(newName);
    if (!sanitizedDisplayName) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid new name" });
    }

    const fetchRes = await fetch(uploadDoc.url);
    if (!fetchRes.ok) {
      return res
        .status(502)
        .json({ success: false, message: "Could not read existing file" });
    }
    const contentBuffer = Buffer.from(await fetchRes.arrayBuffer());

    const newStoredFilename =
      Date.now() +
      "-" +
      crypto.randomBytes(4).toString("hex") +
      "-" +
      sanitizedDisplayName;
    const newHfPath = `${req.user.id}/${newStoredFilename}`;

    await hfUploadFile({
      repo: HF_REPO_DESIGNATION,
      accessToken: HF_TOKEN,
      file: {
        path: newHfPath,
        content: new Blob([contentBuffer], { type: uploadDoc.mimetype }),
      },
    });

    await hfDeleteFiles({
      repo: HF_REPO_DESIGNATION,
      accessToken: HF_TOKEN,
      paths: [uploadDoc.hfPath],
    });

    uploadDoc.hfPath = newHfPath;
    uploadDoc.url = hfPublicUrl(newHfPath);
    uploadDoc.filename = sanitizedDisplayName;
    await uploadDoc.save();

    return res.json({ success: true, newName: newStoredFilename });
  }),
);

// ── DELETE ──────────────────────────────────────────────────────────────
router.delete(
  "/delete/:filename",
  asyncHandler(async (req, res) => {
    assertHfConfigured();

    const { filename } = req.params;

    if (!isSafeFilename(filename)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid filename" });
    }

    const uploadDoc = await Upload.findOne({
      userId: req.user.id,
      hfPath: `${req.user.id}/${filename}`,
    });
    if (!uploadDoc) {
      return res
        .status(404)
        .json({ success: false, message: "File not found" });
    }

    await hfDeleteFiles({
      repo: HF_REPO_DESIGNATION,
      accessToken: HF_TOKEN,
      paths: [uploadDoc.hfPath],
    });

    await Upload.deleteOne({ _id: uploadDoc._id });

    return res.json({ success: true });
  }),
);

module.exports = router;

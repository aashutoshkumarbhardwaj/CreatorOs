const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const multer = require("multer");
const rateLimit = require("express-rate-limit");
const sharp = require("sharp");
const VaultFile = require("../model/vaultFile");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

// Persistent storage root for Vault uploads. Configurable via env var so
// deployments can point this at a mounted volume; defaults to a local
// ./uploads/vault directory (NOT os.tmpdir() — that gets wiped and previously
// caused uploaded files to vanish immediately after upload, see issue #381).
const VAULT_ROOT = process.env.VAULT_STORAGE_PATH
  ? path.resolve(process.env.VAULT_STORAGE_PATH)
  : path.join(__dirname, "..", "uploads", "vault");

function userVaultDir(userId) {
  const dir = path.join(VAULT_ROOT, String(userId));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
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

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    try {
      cb(null, userVaultDir(req.user.id));
    } catch (err) {
      cb(err);
    }
  },
  filename: function (req, file, cb) {
    const sanitizedFilename = sanitizeName(file.originalname);
    cb(
      null,
      Date.now() + "-" + crypto.randomBytes(4).toString("hex") + "-" + sanitizedFilename,
    );
  },
});

const fileFilter = (req, file, cb) => {
  const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
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
};

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter,
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { error: "Upload limit reached, please try again later." },
});

async function compressImage(filePath, mimetype) {
  // GIFs are skipped — sharp's default pipeline doesn't preserve animation
  if (mimetype === "image/gif") {
    return { compressed: false };
  }

  const tempOutputPath = filePath + ".compressed";
  const originalStats = fs.statSync(filePath);

  try {
    const pipeline = sharp(filePath).resize({
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

    await pipeline.toFile(tempOutputPath);

    const compressedStats = fs.statSync(tempOutputPath);

    if (compressedStats.size < originalStats.size) {
      fs.renameSync(tempOutputPath, filePath);
      return { compressed: true, originalSize: originalStats.size, newSize: compressedStats.size };
    } else {
      fs.unlinkSync(tempOutputPath);
      return { compressed: false, originalSize: originalStats.size, newSize: originalStats.size };
    }
  } catch (err) {
    console.error("[compress] Failed to compress image:", err);
    if (fs.existsSync(tempOutputPath)) {
      fs.unlinkSync(tempOutputPath);
    }
    return { compressed: false, originalSize: originalStats.size, newSize: originalStats.size };
  }
}

// ── UPLOAD ──────────────────────────────────────────────────────────────
router.post(
  "/upload",
  uploadLimiter,
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const compressionResult = await compressImage(req.file.path, req.file.mimetype);
    const finalStats = fs.statSync(req.file.path);

    const vaultFile = await VaultFile.create({
      userId: req.user.id,
      originalName: req.file.originalname,
      storedFilename: req.file.filename,
      size: finalStats.size,
      mimetype: req.file.mimetype,
    });

    // File is persisted on disk and tracked in the Vault collection — no
    // cleanup/unlink here. This was the root cause of issue #381.
    return res.json({
      filename: vaultFile.originalName,
      size: vaultFile.size,
      mimetype: vaultFile.mimetype,
      path: vaultFile.storedFilename,
      compressed: compressionResult.compressed,
      originalSize: compressionResult.originalSize,
    });
  }),
);

// ── STORAGE USAGE ──────────────────────────────────────────────────────
router.get(
  "/storage-usage",
  asyncHandler(async (req, res) => {
    const files = await VaultFile.find({ userId: req.user.id }).select("size").lean();
    const totalSize = files.reduce((sum, f) => sum + (f.size || 0), 0);
    return res.json({ success: true, totalSize, fileCount: files.length });
  }),
);

// ── RENAME ──────────────────────────────────────────────────────────────
// Frontend treats the stored filename as the file's identifier and expects
// it to change after a rename, so we actually rename the file on disk (and
// its DB record), rather than just relabeling a display name.
router.patch(
  "/rename/:filename",
  asyncHandler(async (req, res) => {
    const { filename } = req.params;
    const { newName } = req.body;

    if (!isSafeFilename(filename)) {
      return res.status(400).json({ success: false, message: "Invalid filename" });
    }
    if (!newName || typeof newName !== "string" || !newName.trim()) {
      return res.status(400).json({ success: false, message: "New name is required" });
    }

    const vaultFile = await VaultFile.findOne({
      userId: req.user.id,
      storedFilename: filename,
    });
    if (!vaultFile) {
      return res.status(404).json({ success: false, message: "File not found" });
    }

    const sanitizedDisplayName = sanitizeName(newName);
    if (!sanitizedDisplayName) {
      return res.status(400).json({ success: false, message: "Invalid new name" });
    }

    const newStoredFilename =
      Date.now() + "-" + crypto.randomBytes(4).toString("hex") + "-" + sanitizedDisplayName;
    const dir = userVaultDir(req.user.id);
    const oldPath = path.join(dir, vaultFile.storedFilename);
    const newPath = path.join(dir, newStoredFilename);

    fs.renameSync(oldPath, newPath);

    vaultFile.storedFilename = newStoredFilename;
    vaultFile.originalName = sanitizedDisplayName;
    await vaultFile.save();

    return res.json({ success: true, newName: vaultFile.storedFilename });
  }),
);

// ── DELETE ──────────────────────────────────────────────────────────────
router.delete(
  "/delete/:filename",
  asyncHandler(async (req, res) => {
    const { filename } = req.params;

    if (!isSafeFilename(filename)) {
      return res.status(400).json({ success: false, message: "Invalid filename" });
    }

    const vaultFile = await VaultFile.findOne({
      userId: req.user.id,
      storedFilename: filename,
    });
    if (!vaultFile) {
      return res.status(404).json({ success: false, message: "File not found" });
    }

    const filePath = path.join(userVaultDir(req.user.id), vaultFile.storedFilename);
    fs.unlink(filePath, (err) => {
      if (err && err.code !== "ENOENT") {
        console.error(`[vault] Failed to delete file ${filePath}:`, err);
      }
    });

    await VaultFile.deleteOne({ _id: vaultFile._id });

    return res.json({ success: true });
  }),
);

module.exports = router;
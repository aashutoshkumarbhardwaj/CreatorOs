const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const runtimeDirectories = [
  "controller",
  "middleware",
  "model",
  "routes",
  "services",
  "utils",
  "workers",
];

const runtimeFiles = [
  "index.js",
  "connect.js",
  "worker.js",
  "services.config.js",
];

function getJavaScriptFiles(directory) {
  const files = [];

  if (!fs.existsSync(directory)) {
    return files;
  }

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...getJavaScriptFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      files.push(fullPath);
    }
  }

  return files;
}

function checkFiles(files) {
  let hasErrors = false;

  for (const file of files) {
    const result = spawnSync(process.execPath, ["--check", file], {
      stdio: "inherit",
    });

    if (result.status !== 0) {
      hasErrors = true;
    }
  }

  return !hasErrors;
}

function validateRuntimeFiles(projectRoot = process.cwd()) {
  const requiredFiles = runtimeFiles.map((file) =>
    path.join(projectRoot, file)
  );

  const missingRuntimeFiles = requiredFiles.filter(
    (file) => !fs.existsSync(file)
  );

  if (missingRuntimeFiles.length > 0) {
    console.error(
      `Missing required runtime files:\n${missingRuntimeFiles.join("\n")}`
    );
    return false;
  }

  const directories = runtimeDirectories.map((directory) =>
    path.join(projectRoot, directory)
  );

  const filesToCheck = [
    ...requiredFiles,
    ...directories.flatMap(getJavaScriptFiles),
  ];

  const passed = checkFiles(filesToCheck);

  if (!passed) {
    console.error("\nJavaScript syntax validation failed.");
    return false;
  }

  console.log(
    `JavaScript syntax validation passed (${filesToCheck.length} files).`
  );

  return true;
}

if (require.main === module) {
  const passed = validateRuntimeFiles();

  if (!passed) {
    process.exit(1);
  }
}

module.exports = {
  getJavaScriptFiles,
  checkFiles,
  validateRuntimeFiles,
};

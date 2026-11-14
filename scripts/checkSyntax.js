
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const CONFIG = {
  runtimeDirectories: [
    "controller",
    "middleware",
    "model",
    "routes",
    "services",
    "utils",
    "workers",
  ],

  requiredFiles: [
    "index.js",
    "connect.js",
    "worker.js",
    "services.config.js",
  ],

  excludedDirectories: [
    "node_modules",
    ".git",
    "coverage",
    "dist",
    "build",
  ],

  fileExtension: ".js",
  verbose: true,
};

function log(message) {
  console.log(`[VALIDATOR] ${message}`);
}

function logError(message) {
  console.error(`[ERROR] ${message}`);
}

function getJavaScriptFiles(directory, options = {}) {
  const {
    excludedDirectories = CONFIG.excludedDirectories,
    extension = CONFIG.fileExtension,
  } = options;

  const files = [];

  try {
    if (!fs.existsSync(directory)) {
      return files;
    }

    const entries = fs.readdirSync(directory, {
      withFileTypes: true,
    });

    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);

      if (entry.isSymbolicLink()) {
        continue;
      }

      if (entry.isDirectory()) {
        if (excludedDirectories.includes(entry.name)) {
          continue;
        }

        files.push(
          ...getJavaScriptFiles(fullPath, options)
        );
      } else if (
        entry.isFile() &&
        entry.name.endsWith(extension)
      ) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    logError(
      `Unable to scan ${directory}: ${error.message}`
    );
  }

  return files;
}

function checkFiles(files) {
  const results = {
    passed: [],
    failed: [],
  };

  for (const file of files) {
    if (CONFIG.verbose) {
      log(`Checking: ${file}`);
    }

    const result = spawnSync(
      process.execPath,
      ["--check", file],
      {
        encoding: "utf8",
        timeout: 15000,
        maxBuffer: 1024 * 1024,
      }
    );

    if (result.error) {
      results.failed.push({
        file,
        error: result.error.message,
      });

      logError(`${file}: ${result.error.message}`);
      continue;
    }

    if (result.status !== 0) {
      const errorMessage =
        result.stderr?.trim() ||
        result.stdout?.trim() ||
        `Process exited with code ${result.status}`;

      results.failed.push({
        file,
        error: errorMessage,
      });

      logError(`Syntax error in ${file}`);
      console.error(errorMessage);
    } else {
      results.passed.push(file);

      if (CONFIG.verbose) {
        log(`Passed: ${file}`);
      }
    }
  }

  return results;
}

function validateRuntimeFiles(projectRoot = process.cwd()) {
  log("Starting JavaScript runtime validation...");

  const root = path.resolve(projectRoot);

  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    logError(`Invalid project directory: ${root}`);
    return false;
  }

  // Check required runtime files.
  const requiredFiles = CONFIG.requiredFiles.map((file) =>
    path.join(root, file)
  );

  const missingFiles = requiredFiles.filter((file) => {
    return !fs.existsSync(file) || !fs.statSync(file).isFile();
  });

  if (missingFiles.length > 0) {
    logError("Missing required runtime files:");

    missingFiles.forEach((file) => {
      console.error(`  - ${path.relative(root, file)}`);
    });

    return false;
  }

  // Collect JavaScript files from runtime directories.
  const discoveredFiles = CONFIG.runtimeDirectories.flatMap(
    (directory) =>
      getJavaScriptFiles(path.join(root, directory))
  );

  // Combine and remove duplicate file paths.
  const filesToCheck = [
    ...new Set([
      ...requiredFiles,
      ...discoveredFiles,
    ]),
  ];

  if (filesToCheck.length === 0) {
    logError("No JavaScript files found.");
    return false;
  }

  log(`Found ${filesToCheck.length} JavaScript files.`);

  // Run syntax validation.
  const results = checkFiles(filesToCheck);

  const total = filesToCheck.length;
  const passed = results.passed.length;
  const failed = results.failed.length;

  console.log("\n========== VALIDATION REPORT ==========");
  console.log(`Total files : ${total}`);
  console.log(`Passed      : ${passed}`);
  console.log(`Failed      : ${failed}`);
  console.log("=======================================\n");

  if (failed > 0) {
    logError("JavaScript syntax validation failed.");

    results.failed.forEach(({ file }) => {
      console.error(`  - ${path.relative(root, file)}`);
    });

    return false;
  }

  log("All JavaScript files passed syntax validation.");

  return true;
}

// CLI execution.
if (require.main === module) {
  const projectRoot = process.argv[2] || process.cwd();

  const passed = validateRuntimeFiles(projectRoot);

  process.exitCode = passed ? 0 : 1;
}

module.exports = {
  getJavaScriptFiles,
  checkFiles,
  validateRuntimeFiles,
};

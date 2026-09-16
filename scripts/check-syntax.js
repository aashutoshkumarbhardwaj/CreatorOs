const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const RUNTIME_DIRS = [
  "controller",
  "model",
  "routes",
  "middleware",
  "utils",
  "config",
  "services",
  "workers",
  "scripts",
];

function collectJsFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectJsFiles(full));
    } else if (entry.name.endsWith(".js")) {
      results.push(full);
    }
  }
  return results;
}

const files = ["index.js"].filter(fs.existsSync);

for (const dir of RUNTIME_DIRS) {
  files.push(...collectJsFiles(dir));
}

if (files.length === 0) {
  console.error("No JavaScript files found to check.");
  process.exit(1);
}

let failed = false;

for (const file of files) {
  try {
    execSync(`node --check "${file}"`, { stdio: "pipe" });
  } catch (err) {
    console.error(`Syntax error in ${file}:`);
    console.error(err.stderr?.toString() || err.message);
    failed = true;
  }
}

if (failed) {
  console.error("\nSyntax check failed.");
  process.exit(1);
}

console.log(`Syntax check passed (${files.length} files).`);

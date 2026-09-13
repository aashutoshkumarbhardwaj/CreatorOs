/**
 * scripts/validateSyntax.js
 * 
 * Validates syntax of all runtime-loaded JavaScript files in CreatorOs.
 * Uses Node's built-in V8 compiler (vm.compileFunction and node --check)
 * to verify files without executing them and without requiring external dependencies.
 *
 * Catches:
 *   - SyntaxError (malformed expressions, missing parentheses/braces/commas)
 *   - Early errors (duplicate const/let declarations, invalid tokens)
 *   - Illegal return statements
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { spawnSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');

// Standard runtime JavaScript directories in CreatorOs
const RUNTIME_DIRECTORIES = [
  'controller',
  'model',
  'routes',
  'middleware',
  'services',
  'workers',
  'utils',
  'scripts',
  'docs',
  path.join('public', 'js'),
];

// Root-level JavaScript files loaded at runtime or part of core services
const ROOT_RUNTIME_FILES = [
  'index.js',
  'connect.js',
  'worker.js',
  'services.config.js',
  'seed-analytics.js',
  'index_debug.js',
];

// Directories that should never be scanned as CommonJS runtime files
const IGNORED_DIRECTORIES = new Set([
  'node_modules',
  '.git',
  '.github',
  'coverage',
  '.nyc_output',
  'src', // Frontend React/JSX code with ES module syntax (handled by Vite/bundlers)
  'test',
  'tests',
]);

/**
 * Recursively find all JavaScript files in a directory, ignoring excluded folders.
 * @param {string} dir
 * @returns {string[]} List of relative file paths
 */
function findJsFilesInDir(dir) {
  const fullDir = path.resolve(PROJECT_ROOT, dir);
  if (!fs.existsSync(fullDir)) {
    return [];
  }

  const results = [];
  const entries = fs.readdirSync(fullDir, { withFileTypes: true });

  for (const entry of entries) {
    if (IGNORED_DIRECTORIES.has(entry.name)) {
      continue;
    }

    const relPath = path.join(dir, entry.name).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      results.push(...findJsFilesInDir(relPath));
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      results.push(relPath);
    }
  }

  return results;
}

/**
 * Discover all runtime JavaScript files in the project.
 * @returns {string[]} Array of normalized relative file paths
 */
function findRuntimeFiles() {
  const fileSet = new Set();

  // Root files
  for (const file of ROOT_RUNTIME_FILES) {
    const fullPath = path.resolve(PROJECT_ROOT, file);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      fileSet.add(file.replace(/\\/g, '/'));
    }
  }

  // Directory files
  for (const dir of RUNTIME_DIRECTORIES) {
    const jsFiles = findJsFilesInDir(dir);
    for (const file of jsFiles) {
      fileSet.add(file.replace(/\\/g, '/'));
    }
  }

  return Array.from(fileSet).sort();
}

/**
 * Validate syntax of a single JavaScript file.
 * @param {string} relativePath Relative path from project root
 * @returns {{ valid: boolean, error?: string, rawError?: Error }}
 */
function validateFile(relativePath) {
  const fullPath = path.resolve(PROJECT_ROOT, relativePath);
  if (!fs.existsSync(fullPath)) {
    return { valid: false, error: `File not found: ${relativePath}` };
  }

  let code;
  try {
    code = fs.readFileSync(fullPath, 'utf8');
  } catch (err) {
    return { valid: false, error: `Unable to read file: ${err.message}` };
  }

  // Strip shebang if present (e.g. #!/usr/bin/env node)
  if (code.startsWith('#!')) {
    code = '//' + code.slice(2);
  }

  try {
    // Fast in-memory parse using Node's V8 compiler with CommonJS module wrapper
    vm.compileFunction(code, ['exports', 'require', 'module', '__filename', '__dirname'], {
      filename: relativePath,
    });
    return { valid: true };
  } catch (err) {
    // Attempt to get the canonical formatted node --check snippet with caret pointer
    let detailedError = '';
    try {
      const checkRes = spawnSync(process.execPath, ['--check', fullPath], {
        encoding: 'utf8',
      });
      if (checkRes.stderr || checkRes.stdout) {
        detailedError = (checkRes.stderr || checkRes.stdout).trim();
      }
    } catch {
      // Fallback to error stack if spawn fails
    }

    if (!detailedError) {
      detailedError = `${relativePath}: ${err.message}`;
    }

    return {
      valid: false,
      error: detailedError,
      rawError: err,
    };
  }
}

/**
 * Validate all runtime files or a given list of files.
 * @param {string[]} [files] Optional explicit list of relative paths to validate
 * @returns {{ total: number, passed: number, failed: number, errors: Array<{ file: string, error: string }>, durationMs: number }}
 */
function validateAll(files) {
  const start = Date.now();
  const targetFiles = files || findRuntimeFiles();
  const errors = [];

  for (const file of targetFiles) {
    const res = validateFile(file);
    if (!res.valid) {
      errors.push({ file, error: res.error });
    }
  }

  const durationMs = Date.now() - start;
  return {
    total: targetFiles.length,
    passed: targetFiles.length - errors.length,
    failed: errors.length,
    errors,
    durationMs,
  };
}

/**
 * CLI execution handler
 */
function runCli() {
  const args = process.argv.slice(2);
  let filesToValidate;

  if (args.length > 0 && !args[0].startsWith('-')) {
    filesToValidate = args.map((arg) => path.normalize(arg));
  }

  console.log('🔍 Validating JavaScript syntax in runtime files...\n');
  const results = validateAll(filesToValidate);

  if (results.errors.length > 0) {
    console.error('❌ JavaScript Syntax Validation Failed!\n');
    for (const item of results.errors) {
      console.error('------------------------------------------------------------');
      console.error(`File: ${item.file}`);
      console.error(item.error);
      console.error('------------------------------------------------------------\n');
    }
    console.error(
      `💥 Found ${results.failed} syntax error(s) across ${results.total} runtime files (${results.durationMs}ms).\n`
    );
    process.exit(1);
  } else {
    console.log(
      `✔ Successfully validated syntax for all ${results.total} runtime JavaScript files (${results.durationMs}ms).\n`
    );
    process.exit(0);
  }
}

if (require.main === module) {
  runCli();
}

module.exports = {
  findRuntimeFiles,
  validateFile,
  validateAll,
  RUNTIME_DIRECTORIES,
  ROOT_RUNTIME_FILES,
};

/**
 * tests/validateSyntax.test.js
 * 
 * Test suite for the build validation system (scripts/validateSyntax.js)
 * Ensures:
 * 1. Runtime JavaScript files across models, routes, controllers, middleware, etc., are discovered.
 * 2. All current runtime files pass syntax validation.
 * 3. Specific previously problematic files (model/bioProfile.js, middleware/csrf.js) are covered and valid.
 * 4. Introducing a syntax error causes validation to catch it and return valid: false.
 */

const fs = require('fs');
const path = require('path');
const {
  findRuntimeFiles,
  validateFile,
  validateAll,
  RUNTIME_DIRECTORIES,
  ROOT_RUNTIME_FILES,
} = require('../scripts/validateSyntax');

describe('Build Validation & Runtime Syntax Scanner', () => {
  const tempFilesToClean = [];

  afterAll(() => {
    // Clean up any temporary files created during testing
    for (const filePath of tempFilesToClean) {
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch {
          // ignore cleanup errors
        }
      }
    }
  });

  test('discovers files in all core runtime directories', () => {
    const files = findRuntimeFiles();
    expect(files.length).toBeGreaterThan(50);

    // Verify key directories are represented
    const hasController = files.some((f) => f.startsWith('controller') || f.includes('controller'));
    const hasModel = files.some((f) => f.startsWith('model') || f.includes('model'));
    const hasRoutes = files.some((f) => f.startsWith('routes') || f.includes('routes'));
    const hasMiddleware = files.some((f) => f.startsWith('middleware') || f.includes('middleware'));
    const hasServices = files.some((f) => f.startsWith('services') || f.includes('services'));
    const hasWorkers = files.some((f) => f.startsWith('workers') || f.includes('workers'));
    const hasUtils = files.some((f) => f.startsWith('utils') || f.includes('utils'));

    expect(hasController).toBe(true);
    expect(hasModel).toBe(true);
    expect(hasRoutes).toBe(true);
    expect(hasMiddleware).toBe(true);
    expect(hasServices).toBe(true);
    expect(hasWorkers).toBe(true);
    expect(hasUtils).toBe(true);
  });

  test('includes key runtime files that were previously missed by hardcoded lists', () => {
    const files = findRuntimeFiles();
    const normalizedFiles = files.map((f) => f.replace(/\\/g, '/'));

    expect(normalizedFiles).toContain('model/bioProfile.js');
    expect(normalizedFiles).toContain('middleware/csrf.js');
    expect(normalizedFiles).toContain('controller/bioController.js');
    expect(normalizedFiles).toContain('routes/bioRoutes.js');
  });

  test('validates that all existing codebase runtime files pass syntax check', () => {
    const results = validateAll();
    expect(results.failed).toBe(0);
    expect(results.errors).toHaveLength(0);
    expect(results.passed).toBe(results.total);
    expect(results.total).toBeGreaterThan(100);
  });

  test('correctly passes valid individual files', () => {
    const resBio = validateFile(path.join('model', 'bioProfile.js'));
    expect(resBio.valid).toBe(true);

    const resCsrf = validateFile(path.join('middleware', 'csrf.js'));
    expect(resCsrf.valid).toBe(true);

    const resIndex = validateFile('index.js');
    expect(resIndex.valid).toBe(true);
  });

  test('detects syntax error in a malformed JavaScript file (regression guard for issue #1107)', () => {
    const tempDir = path.resolve(__dirname, '..', 'model');
    const tempInvalidFile = path.join(tempDir, '_temp_invalid_syntax_test.js');
    const relInvalidFile = path.join('model', '_temp_invalid_syntax_test.js');

    // Simulate the exact syntax error from bioProfile.js (stray closing brace)
    const brokenCode = `
      const schema = {
        name: { type: String },
        },
        layout: { type: String }
      };
    `;

    fs.writeFileSync(tempInvalidFile, brokenCode, 'utf8');
    tempFilesToClean.push(tempInvalidFile);

    const result = validateFile(relInvalidFile);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/SyntaxError/i);

    // Verify validateAll also reports the failure
    const batchResult = validateAll([relInvalidFile]);
    expect(batchResult.failed).toBe(1);
    expect(batchResult.passed).toBe(0);
    expect(batchResult.errors[0].file).toBe(path.normalize(relInvalidFile));

    // Cleanup immediately
    fs.unlinkSync(tempInvalidFile);
    tempFilesToClean.splice(tempFilesToClean.indexOf(tempInvalidFile), 1);
  });

  test('detects duplicate identifier syntax errors', () => {
    const tempDir = path.resolve(__dirname, '..', 'middleware');
    const tempDupFile = path.join(tempDir, '_temp_duplicate_const_test.js');
    const relDupFile = path.join('middleware', '_temp_duplicate_const_test.js');

    // Duplicate const declaration in same scope
    const dupCode = `
      const MY_SET = new Set(['a']);
      const MY_SET = new Set(['b']);
      module.exports = MY_SET;
    `;

    fs.writeFileSync(tempDupFile, dupCode, 'utf8');
    tempFilesToClean.push(tempDupFile);

    const result = validateFile(relDupFile);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/Identifier 'MY_SET' has already been declared|SyntaxError/i);

    // Cleanup immediately
    fs.unlinkSync(tempDupFile);
    tempFilesToClean.splice(tempFilesToClean.indexOf(tempDupFile), 1);
  });
});

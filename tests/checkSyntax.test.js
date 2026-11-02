const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  getJavaScriptFiles,
  checkFiles,
  validateRuntimeFiles,
} = require("../scripts/checkSyntax");

describe("checkSyntax", () => {
  let fixtureRoot;

  beforeEach(() => {
    fixtureRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), "creatoros-syntax-")
    );
  });

  afterEach(() => {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  });

  test("finds JavaScript files recursively in runtime directories", () => {
    const nestedDirectory = path.join(
      fixtureRoot,
      "controller",
      "nested"
    );

    fs.mkdirSync(nestedDirectory, { recursive: true });

    fs.writeFileSync(
      path.join(fixtureRoot, "controller", "root.js"),
      "const root = true;"
    );

    fs.writeFileSync(
      path.join(nestedDirectory, "nested.js"),
      "const nested = true;"
    );

    const files = getJavaScriptFiles(
      path.join(fixtureRoot, "controller")
    );

    expect(files).toHaveLength(2);
    expect(files).toContain(
      path.join(fixtureRoot, "controller", "root.js")
    );
    expect(files).toContain(
      path.join(nestedDirectory, "nested.js")
    );
  });
  test("passes when all required and nested runtime files have valid syntax", () => {
    const nestedDirectory = path.join(
      fixtureRoot,
      "controller",
      "nested"
    );

    fs.mkdirSync(nestedDirectory, { recursive: true });

    fs.writeFileSync(
      path.join(fixtureRoot, "index.js"),
      "const index = true;"
    );

    fs.writeFileSync(
      path.join(fixtureRoot, "connect.js"),
      "const connect = true;"
    );

    fs.writeFileSync(
      path.join(fixtureRoot, "worker.js"),
      "const worker = true;"
    );

    fs.writeFileSync(
      path.join(fixtureRoot, "services.config.js"),
      "const config = true;"
    );

    fs.writeFileSync(
      path.join(nestedDirectory, "nested.js"),
      "const nested = true;"
    );

    expect(validateRuntimeFiles(fixtureRoot)).toBe(true);
  });

  test("fails when a nested runtime JavaScript file has invalid syntax", () => {
    const nestedDirectory = path.join(
      fixtureRoot,
      "controller",
      "nested"
    );

    fs.mkdirSync(nestedDirectory, { recursive: true });

    fs.writeFileSync(
      path.join(fixtureRoot, "index.js"),
      "const index = true;"
    );

    fs.writeFileSync(
      path.join(fixtureRoot, "connect.js"),
      "const connect = true;"
    );

    fs.writeFileSync(
      path.join(fixtureRoot, "worker.js"),
      "const worker = true;"
    );

    fs.writeFileSync(
      path.join(fixtureRoot, "services.config.js"),
      "const config = true;"
    );

    fs.writeFileSync(
      path.join(nestedDirectory, "invalid.js"),
      "const = ;"
    );

    expect(validateRuntimeFiles(fixtureRoot)).toBe(false);
  });

  test("fails when a required root runtime file has invalid syntax", () => {
    fs.writeFileSync(
      path.join(fixtureRoot, "index.js"),
      "const = ;"
    );

    fs.writeFileSync(
      path.join(fixtureRoot, "connect.js"),
      "const connect = true;"
    );

    fs.writeFileSync(
      path.join(fixtureRoot, "worker.js"),
      "const worker = true;"
    );

    fs.writeFileSync(
      path.join(fixtureRoot, "services.config.js"),
      "const config = true;"
    );

    expect(validateRuntimeFiles(fixtureRoot)).toBe(false);
  });
  test("fails when a required runtime file is missing", () => {
    fs.writeFileSync(
      path.join(fixtureRoot, "index.js"),
      "const index = true;"
    );

    fs.writeFileSync(
      path.join(fixtureRoot, "connect.js"),
      "const connect = true;"
    );

    fs.writeFileSync(
      path.join(fixtureRoot, "worker.js"),
      "const worker = true;"
    );

    fs.writeFileSync(
      path.join(fixtureRoot, "services.config.js"),
      "const config = true;"
    );

    fs.unlinkSync(path.join(fixtureRoot, "worker.js"));

    expect(validateRuntimeFiles(fixtureRoot)).toBe(false);
  });
});

const { validateRuntimeFiles } = require("./checkSyntax");

process.exitCode = validateRuntimeFiles() ? 0 : 1;

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "../ava-helper.js";

import { compileSourceWithParser } from "../../src-parser/parser/compile-with-parser.js";
import { DiagnosticError } from "../../src-parser/compiler/diagnostics/Diagnostic.js";
const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.resolve(TEST_DIR, "../../src/tests");

const SIMPLE_SOURCE = [
  "org $008000",
  "MainLabel:",
  "db $01, $02, $03"
].join("\n");

test("compileSourceWithParser compiles with native semantic slices disabled", t => {
  const output = compileSourceWithParser(SIMPLE_SOURCE, {
    nativeSemanticSlices: false
  });
  t.true(output.length > 0);
});

test("compileSourceWithParser compiles with native semantic slices enabled", t => {
  const output = compileSourceWithParser(SIMPLE_SOURCE, {
    nativeSemanticSlices: true
  });
  t.true(output.length > 0);
});

test("compileSourceWithParser emits structured diagnostic errors when requested", t => {
  const error = t.throws(() => compileSourceWithParser("db not_a_number", {
    diagnosticsMode: "structured",
    nativeSemanticSlices: true
  }));

  t.true(error instanceof DiagnosticError);
  if (error instanceof DiagnosticError) {
    t.is(error.diagnostic.severity, "error");
    t.truthy(error.diagnostic.message);
  }
});

test("compileSourceWithParser 32bitvalues fixture produces expected bytes", t => {
  const fixturePath = path.resolve(FIXTURES_DIR, "32bitvalues.asm");
  t.true(fs.existsSync(fixturePath), "32bitvalues.asm fixture exists");
  const source = fs.readFileSync(fixturePath, "utf8");
  const output = compileSourceWithParser(source, {
    sourcePath: fixturePath,
    includePaths: ["./", path.dirname(fixturePath)]
  });
  t.true(output.length >= 16);
  // db -1 => FF; dd $FFFFFFFF => FF FF FF FF
  t.is(output[0], 0xff);
  t.is(output[1], 0xff);
  t.is(output[2], 0xff);
  t.is(output[3], 0xff);
});

test("compileSourceWithParser forloop fixture matches expected output shape", t => {
  const fixturePath = path.resolve(FIXTURES_DIR, "forloop.asm");
  t.true(fs.existsSync(fixturePath), "forloop.asm fixture exists");
  const source = fs.readFileSync(fixturePath, "utf8");
  const output = compileSourceWithParser(source, {
    sourcePath: fixturePath,
    includePaths: ["./", path.dirname(fixturePath)]
  });
  t.true(output.length >= 32, "forloop produces at least 32 bytes");
  // First line comment: 00 01 02 03 04
  t.is(output[0], 0x00);
  t.is(output[1], 0x01);
  t.is(output[2], 0x02);
  t.is(output[3], 0x03);
  t.is(output[4], 0x04);
});

test("compileSourceWithParser v150features fixture compiles with hirom/exlorom/exhirom", t => {
  const fixturePath = path.resolve(FIXTURES_DIR, "v150features.asm");
  t.true(fs.existsSync(fixturePath), "v150features.asm fixture exists");
  const source = fs.readFileSync(fixturePath, "utf8");
  const fixturesDir = path.dirname(fixturePath);
  const output = compileSourceWithParser(source, {
    sourcePath: fixturePath,
    includePaths: ["./", fixturesDir, path.join(fixturesDir, "data")]
  });
  t.true(output.length > 0, "v150features produces bytes (no Invalid SNES position for write)");
});

import ava, { type TestFn } from "ava";

import { compileSourceWithParser } from "../../src/parser/compile-with-parser.js";
import { DiagnosticError } from "../../src/compiler/diagnostics/Diagnostic.js";

const test = ava as unknown as TestFn;

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

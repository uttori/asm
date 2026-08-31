import { test } from "../../../../tests/ava-helper.js";
import { Assembler } from "../../../../tests/test-assembler.js";

import { handleCheck, handleMapper, handleOptimize } from "../../src/directives/layout.js";

test("SNES mapper and policy handlers mutate plugin-owned session state", (t) => {
  const assembler = new Assembler();
  const state = assembler.targetState;

  handleMapper(state, ["norom"]);
  t.is(state.mapper, "norom");
  t.false(state.checksumEnabled);

  handleMapper(state, ["lorom"]);
  handleCheck(state, ["check", "bankcross", "half"]);
  handleOptimize(state, ["optimize", "dp", "always"]);
  t.is(state.mapper, "lorom");
  t.is(state.bankCrossMode, "half");
  t.true(state.optimizeDirectPage);
});

test("SNES plugin registers mapper and compatibility directives", (t) => {
  const assembler = new Assembler();
  for (const keyword of ["lorom", "hirom", "norom", "check", "optimize", "startpos", "warn"]) {
    t.true(assembler.directiveRegistry.has(keyword));
  }
});

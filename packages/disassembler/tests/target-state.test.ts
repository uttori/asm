import { test } from "../../../tests/ava-helper.js";
import { readAnalysisTargetState } from "../src/model/target-state.js";
test("target state validates architecture, widths and owned assumptions", (t) => {
  const input = { m: true, dataBank: 128 };
  const result = readAnalysisTargetState("snes.65816", input);
  input.m = false;
  t.is(result?.codec, "snes.65816");
  t.deepEqual(result?.state, { m: true, dataBank: 128 });
  t.true(Object.isFrozen(result?.state));
  t.deepEqual(readAnalysisTargetState("snes.spc700", { directPage: 256 }), {
    codec: "snes.spc700",
    version: 1,
    state: { directPage: 256 },
  });
  t.deepEqual(readAnalysisTargetState("65xx.2a03", { carry: true }), {
    codec: "65xx.2a03",
    version: 1,
    state: { carry: true },
  });
  for (const [architecture, state] of [
    ["snes.65816", { dataBank: 256 }],
    ["snes.spc700", { m: true }],
    ["65xx.2a03", { directPage: 0 }],
    ["future.cpu", { carry: true }],
  ] as const) {
    t.throws(() => readAnalysisTargetState(architecture, state));
  }
});

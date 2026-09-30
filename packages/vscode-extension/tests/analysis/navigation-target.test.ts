import test from "ava";

import {
  parseAnalysisNavigationTarget,
  type AnalysisNavigationTarget,
} from "../../src/analysis/navigation-target.js";

const target: AnalysisNavigationTarget = {
  projectDirectory: "/analysis",
  target: "snes.sfc",
  romContentSha256: "a".repeat(64),
  romContentSize: 1024,
  addressSpace: "snes.wram",
  address: 0x7e0000,
  outputOffsets: [],
  architectureHints: ["snes.65816"],
  recordIds: ["captured:1"],
};

test("navigation accepts raw and wrapped qualified targets without losing RAM identity", (t) => {
  t.is(parseAnalysisNavigationTarget(target), target);
  t.is(parseAnalysisNavigationTarget({ navigationTarget: target }), target);
});

test("navigation rejects malformed identities and unsafe coordinates without coercion", (t) => {
  for (const value of [
    undefined,
    null,
    "location",
    {},
    { ...target, romContentSha256: "bad" },
    { ...target, romContentSize: -1 },
    { ...target, address: Number.MAX_SAFE_INTEGER + 1 },
    { ...target, address: "0" },
    { ...target, addressSpace: "" },
    { ...target, outputOffsets: [-1] },
    { ...target, architectureHints: [1] },
    { ...target, recordIds: [null] },
    { navigationTarget: { ...target, projectDirectory: "" } },
  ]) {
    t.is(parseAnalysisNavigationTarget(value), undefined);
  }
});

import { canonicalJson } from "@uttori/asm-core/canonical-json";

import { test } from "../../../tests/ava-helper.js";
import {
  inspectRuntimeEvidence,
  mergeRuntimeEvidence,
  type AnalysisProjectShards,
  type RuntimeEvidenceBatch,
} from "../src/index.js";

const emptyShards = (): AnalysisProjectShards => ({
  analysis: [],
  annotations: [],
  labels: [],
  comments: [],
  regions: [],
  runtime: [],
  evidence: [],
  imports: [],
});

const batchFor = (source: "a" | "b", m: boolean, target: number): RuntimeEvidenceBatch => {
  const evidence = `runtime:trace:${source}`;
  return {
    evidence: [
      {
        id: evidence,
        source: "runtime",
        sourceId: `fixture:${source}`,
        confidence: "certain",
      },
    ],
    runtime: [
      {
        id: `runtime:state:${source}`,
        kind: "runtime-cpu-state",
        architecture: "snes.65816",
        addressSpace: "snes.cpu",
        address: 0x808000,
        state: { m, dataBank: source === "a" ? 0x7e : 0x7f },
        count: 2,
        evidence: [evidence],
      },
    ],
    annotations: [
      {
        id: `runtime:annotation:${source}`,
        addressSpace: "rom.file",
        start: 0,
        end: 1,
        classification: "opcode",
        architecture: "snes.65816",
        state: { m },
        evidence: [evidence],
      },
    ],
    analysis: [
      {
        id: "runtime:target-override:snes.cpu:808000",
        kind: "target-override",
        addressSpace: "snes.cpu",
        address: 0x808000,
        targets: [target],
        evidence: [evidence],
      },
    ],
  };
};

test("runtime evidence merge is idempotent and reports explanations", (t) => {
  const batch = batchFor("a", true, 0x809000);
  const first = mergeRuntimeEvidence(emptyShards(), batch);
  t.true(first.changed);
  t.is(first.added.runtime, 1);
  t.is(first.added.analysis, 1);
  t.is(first.explanations.length, 2);

  const before = canonicalJson(first.shards);
  const second = mergeRuntimeEvidence(first.shards, batch);
  t.false(second.changed);
  t.is(second.existing.runtime, 1);
  t.is(second.existing.analysis, 1);
  t.is(canonicalJson(second.shards), before);
});

test("runtime evidence preserves contradictory state and unions observed indirect targets", (t) => {
  const first = mergeRuntimeEvidence(emptyShards(), batchFor("a", true, 0x809000));
  const second = mergeRuntimeEvidence(first.shards, batchFor("b", false, 0x80a000));
  t.true(second.changed);
  t.is(second.updated.analysis, 1);
  const override = second.shards.analysis[0];
  t.is(override.kind, "target-override");
  if (override.kind !== "target-override") {
    return;
  }
  t.deepEqual(override.targets, [0x809000, 0x80a000]);
  t.deepEqual(override.evidence, ["runtime:trace:a", "runtime:trace:b"]);

  const inspection = inspectRuntimeEvidence(second.shards);
  t.deepEqual(
    inspection.conflicts.map((conflict) => conflict.field),
    ["dataBank", "m"],
  );
  t.deepEqual(
    inspection.conflicts
      .find((conflict) => conflict.field === "m")
      ?.values.map(({ value }) => value),
    [false, true],
  );
});

test("runtime evidence rejects a changed fact that reuses a stable id", (t) => {
  const batch = batchFor("a", true, 0x809000);
  const first = mergeRuntimeEvidence(emptyShards(), batch);
  t.throws(
    () =>
      mergeRuntimeEvidence(first.shards, {
        runtime: [{ ...batch.runtime![0], count: 3 }],
      }),
    { message: /changed content/ },
  );
});

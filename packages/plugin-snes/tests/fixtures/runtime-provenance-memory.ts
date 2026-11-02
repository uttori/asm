import {
  RomImage,
  type AnalysisProjectShards,
  type RuntimeEvidenceRecord,
} from "@uttori/asm-disassembler";

import { analyzeSnesRuntimeCode } from "../../src/disassembler/runtime-code.js";

/** Check the decoded fixture boundary before passing provenance to the analyzer. */
function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

/**
 * Mimic independent SQLite JSON rows: each observation owns freshly parsed provenance strings.
 * @yields {RuntimeEvidenceRecord} An independent row with identical provenance membership.
 */
function* observations(): IterableIterator<RuntimeEvidenceRecord> {
  const provenance = JSON.stringify(
    Array.from(
      { length: 120 },
      (_, index) => `runtime:instruction-trace:${index.toString(16).padStart(64, "0")}`,
    ),
  );
  for (let index = 0; index < 65536; index++) {
    const evidence: unknown = JSON.parse(provenance);
    if (!isStringArray(evidence)) {
      throw new Error("Invalid provenance fixture.");
    }
    yield {
      id: `capture:${index}`,
      kind: "runtime-instruction",
      architecture: "snes.65816",
      addressSpace: "snes.cpu",
      address: 0x7e0000 + index * 2,
      bytes: [0xd0, 0],
      state: { p: 0x30, e: 0 },
      count: 1,
      evidence,
    };
  }
}

const shards: AnalysisProjectShards = {
  analysis: [],
  annotations: [],
  labels: [],
  comments: [],
  regions: [],
  evidence: [],
  imports: [],
  runtime: [],
};
const records = analyzeSnesRuntimeCode(
  shards,
  new RomImage(new Uint8Array(0x8000)),
  "lorom",
  observations(),
);
const nodes = records.filter((record) => record.kind === "cfg-node");
console.log(
  JSON.stringify({
    nodes: nodes.length,
    evidenceLists: new Set(nodes.map((node) => node.evidence)).size,
    evidence: nodes[0].evidence.length,
  }),
);

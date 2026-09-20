import {
  RomImage,
  type AnalysisProjectShards,
  type RuntimeInstructionRecord,
} from "@uttori/asm-disassembler";

import { analyzeSnesRuntimeCode } from "../../src/disassembler/runtime-code.js";

/** Build a large graph in a normal Node process. Report only invariants to the AVA host. */
const summarizeLargeRuntimeGraph = () => {
  // Two decoding states across WRAM produce 131,072 nodes and 262,144 edges.
  // This exceeds V8's call-argument limit without requiring a multi-gigabyte capture fixture.
  const instructionCount = 131_072;
  const runtime: RuntimeInstructionRecord[] = Array.from(
    { length: instructionCount },
    (_, index) => ({
      id: `capture:${index}`,
      kind: "runtime-instruction",
      architecture: "snes.65816",
      addressSpace: "snes.cpu",
      address: 0x7e0000 + ((index * 2) % 0x20000),
      bytes: [0xd0, 0x00], // BNE has both a possible branch and a fallthrough edge.
      state: { p: 0x30, e: 0, d: 0, db: Math.floor(index / 0x10000) },
      count: 1,
      evidence: ["large-capture"],
    }),
  );
  const shards: AnalysisProjectShards = {
    analysis: [],
    annotations: [],
    labels: [],
    comments: [],
    regions: [],
    runtime,
    evidence: [],
    imports: [],
  };
  const records = analyzeSnesRuntimeCode(shards, new RomImage(new Uint8Array(0x8000)), "lorom");
  const nodes = records.filter((record) => record.kind === "cfg-node");
  const edges = records.filter((record) => record.kind === "cfg-edge");
  const kindsBySource = new Map<string, Set<string>>();
  for (const edge of edges) {
    const kinds = kindsBySource.get(edge.from) ?? new Set<string>();
    kinds.add(edge.edgeKind);
    kindsBySource.set(edge.from, kinds);
  }
  return {
    nodes: nodes.length,
    edges: edges.length,
    records: records.length,
    uniqueRecords: new Set(records.map((record) => record.id)).size,
    everyNodeHasBothOutcomes: nodes.every((node) => {
      const kinds = kindsBySource.get(node.id);
      return kinds?.has("branch") && kinds.has("fallthrough");
    }),
    evidencePreserved: edges.every((edge) => edge.evidence.includes("large-capture")),
    deterministicOrder: records.every(
      (record, index) => index === 0 || records[index - 1].id.localeCompare(record.id) < 0,
    ),
  };
};

console.log(JSON.stringify(summarizeLargeRuntimeGraph()));

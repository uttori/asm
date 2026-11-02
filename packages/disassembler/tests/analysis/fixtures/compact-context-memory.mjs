import assert from "node:assert/strict";

import { analyzeStaticControlFlow } from "../../../src/analysis/static-analysis.ts";

// A deep context repeated across a long routine must not inflate every node and edge identity.
const count = 30000;
const depth = 64;
const result = analyzeStaticControlFlow(
  {
    backingSize: count,
    decode(address) {
      const call = address < depth;
      return {
        kind: "instruction",
        instruction: {
          specificationId: "fixture",
          address,
          fileOffset: address,
          size: 1,
          opcode: 0xea,
          mnemonic: "fixture",
          mode: "implied",
          effects: [],
          targets: call ? [{ kind: "call", address: address + 1 }] : [],
          flow: { kind: call ? "call" : "fallthrough", fallthrough: !call && address < count - 1 },
        },
      };
    },
    transfer: (_instruction, state) => state,
    join: (left) => left,
    stateKey: String,
  },
  [{ id: "entry", address: 0, kind: "manual", state: 0, evidence: [] }],
  {
    maxCallDepth: depth,
    compactContextIds: true,
  },
);
assert.equal(result.status, "complete");
assert.equal(result.nodes.length, count);
const last = result.nodes.at(-1);
assert.equal(last.context.length, depth);
assert.equal(last.evidencePath.length, count);
assert.ok(result.nodes.every((node) => node.id.length <= 83));
assert.ok(result.edges.every((edge) => edge.id.length <= 110));
console.log(JSON.stringify({ instructions: result.nodes.length, depth: last.context.length }));

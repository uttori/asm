import assert from "node:assert/strict";

import { analyzeStaticControlFlow } from "../../../src/analysis/static-analysis.ts";

// A copied prefix at each instruction needs several GiB here. Shared ancestry must fit in the
// child's small heap while still exposing the complete last path, including through serialization.
const count = 30000;
const result = analyzeStaticControlFlow(
  {
    backingSize: count,
    decode(address) {
      return {
        kind: "instruction",
        instruction: {
          specificationId: "fixture.nop",
          address,
          fileOffset: address,
          size: 1,
          opcode: 0xea,
          mnemonic: "nop",
          mode: "implied",
          effects: [],
          targets: [],
          flow: { kind: "fallthrough", fallthrough: address < count - 1 },
        },
      };
    },
    transfer: (_instruction, state) => state,
    join: (left) => left,
    stateKey: String,
  },
  [{ id: "entry", address: 0, kind: "manual", state: 0, evidence: [] }],
);
assert.equal(result.status, "complete");
assert.equal(result.nodes.length, count);
const path = JSON.parse(JSON.stringify(result.nodes.at(-1))).evidencePath;
assert.equal(path.length, count);
assert.equal(path[0], result.nodes[0].id);
assert.equal(path.at(-1), result.nodes.at(-1).id);
console.log(JSON.stringify({ instructions: result.nodes.length, pathLength: path.length }));

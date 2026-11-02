import assert from "node:assert/strict";

import { analyzeSnes65816 } from "@uttori/asm-plugin-snes/disassembler";

import { validateAnalysisOwnership } from "../../../src/model/analysis-ownership.ts";
import { RomImage } from "../../../src/model/rom-image.ts";

// Exercise publication as well as traversal: mapping every lazy path into a stored record would
// reintroduce quadratic memory after the worklist completes.
const count = 12000;
const bytes = new Uint8Array(0x10000);
bytes.fill(0xea, 0, count);
bytes[count] = 0xdb;
bytes[0x7ffd] = 0x80;
const result = analyzeSnes65816(new RomImage(bytes), "lorom", { retainGraph: false });
assert.equal(result.status, "complete");
validateAnalysisOwnership(result.records);
const nodes = result.records.filter((record) => record.kind === "cfg-node");
assert.equal(nodes.length, count + 1);
assert.ok(nodes.every((node) => node.evidencePath.length === 1 && node.functionEntry));
const byId = new Map(nodes.map((node) => [node.id, node]));
let tail = nodes.at(-1);
let pathLength = 1;
while (tail.evidencePredecessor) {
  tail = byId.get(tail.evidencePredecessor);
  pathLength++;
}
assert.equal(pathLength, count + 1);
console.log(JSON.stringify({ instructions: nodes.length, pathLength }));

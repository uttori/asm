import { test } from "../../../../tests/ava-helper.js";
import {
  validateAnalysisOwnership,
  withCompactAnalysisOwnership,
} from "../../src/model/analysis-ownership.js";
import type {
  AnalysisControlFlowNodeRecord,
  AnalysisControlFlowEdgeRecord,
} from "../../src/model/project-types.js";

/** Minimal graph edge; ownership must ignore unresolved targets and call/return transitions. */
const edge = (
  from: string,
  to: string,
  edgeKind = "fallthrough",
): AnalysisControlFlowEdgeRecord => ({
  id: `${from}:${to}`,
  kind: "cfg-edge",
  addressSpace: "snes.cpu",
  from,
  to,
  fromAddress: 0,
  edgeKind,
  indirect: false,
  evidence: [],
});

/** Only ownership fields participate here; ordinary record bounds are checked by project validation. */
const node = (
  id: string,
  functionEntry?: string,
  evidencePredecessor?: string,
): AnalysisControlFlowNodeRecord => ({
  id,
  kind: "cfg-node",
  addressSpace: "snes.cpu",
  address: 0,
  size: 1,
  opcode: 0,
  specificationId: "test",
  mnemonic: "nop",
  mode: "implied",
  context: [],
  incomingState: {},
  outgoingState: {},
  effectiveAddresses: [],
  entryPoint: id,
  functionEntry,
  evidencePredecessor,
  evidencePath: [],
  evidence: [],
});

test("compact ownership preserves caller continuations and leaves shared cyclic blocks unowned", (t) => {
  const records = [
    node("caller"),
    node("callee"),
    node("continuation"),
    node("shared"),
    node("loop"),
    edge("caller", "callee", "call"),
    edge("caller", "continuation"),
    edge("callee", "continuation", "return"),
    edge("continuation", "shared"),
    edge("callee", "shared", "branch"),
    edge("shared", "loop"),
    edge("loop", "shared"),
    edge("caller", "blocked"),
  ];
  const compact = withCompactAnalysisOwnership(records, new Set(["caller", "callee", "missing"]));
  t.notThrows(() => validateAnalysisOwnership(compact));
  const nodes = compact.filter((record) => record.kind === "cfg-node");
  t.is(nodes.find((record) => record.id === "continuation")?.functionEntry, "caller");
  t.is(nodes.find((record) => record.id === "shared")?.functionEntry, undefined);
  t.is(nodes.find((record) => record.id === "loop")?.functionEntry, undefined);
  t.is(records[0].functionEntry, undefined);
});

test("compact ownership validates long paths once and rejects dangling, cyclic or mixed owners", (t) => {
  const records = [node("entry", "entry")];
  for (let index = 1; index <= 10000; index++) {
    records.push(node(`step:${index}`, "entry", records.at(-1)!.id));
  }
  t.notThrows(() => validateAnalysisOwnership(records));
  t.throws(() => validateAnalysisOwnership([node("dangling", "missing")]), {
    message: /invalid function entry/,
  });
  t.throws(
    () =>
      validateAnalysisOwnership([
        node("entry", "entry"),
        node("a", "entry", "b"),
        node("b", "entry", "a"),
      ]),
    { message: /cyclic/ },
  );
  t.throws(
    () =>
      validateAnalysisOwnership([
        node("entry", "entry"),
        node("other", "other"),
        node("a", "entry", "other"),
      ]),
    { message: /invalid evidence predecessor/ },
  );
  t.throws(() => validateAnalysisOwnership([node("a", undefined, "b")]), {
    message: /without function ownership/,
  });
});

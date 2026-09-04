import { test } from "../../../tests/ava-helper.js";
import {
  buildAnalysisCallGraph,
  type AnalysisControlFlowNodeRecord,
  type AnalysisProjectShards,
} from "../src/index.js";

const node = (
  id: string,
  address: number,
  fileOffset: number,
  evidencePath: readonly string[],
): AnalysisControlFlowNodeRecord => ({
  id,
  kind: "cfg-node",
  addressSpace: "fixture.cpu",
  address,
  fileOffset,
  size: 1,
  opcode: 0xea,
  specificationId: "fixture.nop",
  mnemonic: "NOP",
  mode: "implied",
  context: [],
  incomingState: {},
  outgoingState: {},
  effectiveAddresses: [],
  entryPoint: "fixture",
  evidencePath,
  evidence: [],
});

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

test("analysis call graph links functions, resolved calls, mirrors, and unresolved ownership", (t) => {
  const root = node("node:0", 0, 0x20, ["node:0"]);
  const callSite = node("node:1", 1, 0x21, ["node:0", "node:1"]);
  const callee = node("node:4", 4, 0x24, ["node:0", "node:1", "node:4"]);
  const unresolvedSite = node("node:5", 5, 0x25, ["node:0", "node:1", "node:4", "node:5"]);
  const graph = buildAnalysisCallGraph({
    ...emptyShards(),
    labels: [
      {
        id: "label:root",
        addressSpace: "fixture.cpu",
        address: 0,
        name: "Reset",
        evidence: [],
      },
    ],
    analysis: [
      root,
      callSite,
      callee,
      unresolvedSite,
      {
        id: "function:0",
        kind: "function",
        addressSpace: "fixture.cpu",
        address: 0,
        source: "entry",
        evidencePath: [],
        evidence: [],
      },
      {
        id: "function:4",
        kind: "function",
        addressSpace: "fixture.cpu",
        address: 4,
        source: "call",
        evidencePath: ["node:0", "node:1"],
        evidence: [],
      },
      {
        id: "edge:call:4",
        kind: "cfg-edge",
        addressSpace: "fixture.cpu",
        from: "node:1",
        fromAddress: 1,
        to: "node:4",
        toAddress: 4,
        edgeKind: "call",
        indirect: false,
        evidence: [],
      },
      {
        id: "edge:call:orphan-target",
        kind: "cfg-edge",
        addressSpace: "fixture.cpu",
        from: "node:5",
        fromAddress: 5,
        toAddress: 9,
        edgeKind: "call",
        indirect: true,
        evidence: [],
      },
      {
        id: "edge:unresolved:5",
        kind: "cfg-edge",
        addressSpace: "fixture.cpu",
        from: "node:5",
        fromAddress: 5,
        edgeKind: "unresolved",
        indirect: true,
        evidence: [],
      },
      {
        id: "unresolved:5:jump",
        kind: "unresolved",
        addressSpace: "fixture.cpu",
        address: 5,
        flowKind: "jump",
        indirect: true,
        reason: "Unknown table",
        evidence: [],
      },
      {
        id: "unresolved:10:jump",
        kind: "unresolved",
        addressSpace: "fixture.cpu",
        address: 10,
        flowKind: "jump",
        indirect: true,
        reason: "No CFG node",
        evidence: [],
      },
    ],
  });

  const rootFunction = graph.functions.find(({ id }) => id === "function:0")!;
  const calleeFunction = graph.functions.find(({ id }) => id === "function:4")!;
  t.deepEqual(rootFunction.labels, [{ id: "label:root", name: "Reset" }]);
  t.deepEqual(rootFunction.nodeIds, ["node:0", "node:1"]);
  t.deepEqual(rootFunction.outputOffsets, [0x20]);
  t.deepEqual(rootFunction.outgoingCallIds, ["edge:call:4"]);
  t.deepEqual(calleeFunction.incomingCallIds, ["edge:call:4"]);
  t.deepEqual(calleeFunction.outgoingCallIds, ["edge:call:orphan-target"]);
  t.deepEqual(calleeFunction.unresolvedIds, ["unresolved:5:jump"]);

  const call = graph.calls.find(({ id }) => id === "edge:call:4")!;
  t.deepEqual(call.callerFunctionIds, ["function:0"]);
  t.deepEqual(call.calleeFunctionIds, ["function:4"]);
  t.deepEqual(call.fromOutputOffsets, [0x21]);
  t.deepEqual(call.toOutputOffsets, [0x24]);

  const unresolved = graph.unresolved.find(({ id }) => id === "unresolved:5:jump")!;
  t.deepEqual(unresolved.nodeIds, ["node:5"]);
  t.deepEqual(unresolved.ownerFunctionIds, ["function:4"]);
  t.deepEqual(unresolved.outputOffsets, [0x25]);
  t.deepEqual(graph.orphanCallIds, ["edge:call:orphan-target"]);
  t.deepEqual(graph.orphanUnresolvedIds, ["unresolved:10:jump"]);
});

test("analysis call graph does not invent ownership when evidence paths are absent", (t) => {
  const graph = buildAnalysisCallGraph({
    ...emptyShards(),
    analysis: [
      node("node:8", 8, 8, []),
      {
        id: "edge:call:12",
        kind: "cfg-edge",
        addressSpace: "fixture.cpu",
        from: "node:8",
        fromAddress: 8,
        toAddress: 12,
        edgeKind: "call",
        indirect: false,
        evidence: [],
      },
    ],
  });
  t.deepEqual(graph.functions, []);
  t.deepEqual(graph.orphanCallIds, ["edge:call:12"]);
});

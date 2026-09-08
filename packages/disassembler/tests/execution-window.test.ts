import { test } from "../../../tests/ava-helper.js";
import {
  RUNTIME_INSTRUCTION_TRACE_FORMAT,
  RUNTIME_INSTRUCTION_TRACE_SCHEMA_VERSION,
  summarizeExecutionWindow,
  type AnalysisControlFlowNodeRecord,
  type AnalysisProjectShards,
  type RuntimeInstructionTraceArtifact,
} from "../src/index.js";

const node = (
  id: string,
  address: number,
  evidencePath: readonly string[],
): AnalysisControlFlowNodeRecord => ({
  id,
  kind: "cfg-node",
  addressSpace: "snes.cpu",
  address,
  fileOffset: address - 0x808000,
  size: 1,
  opcode: 0xea,
  specificationId: "wdc65816.nop",
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

const trace = (addresses: readonly number[]): RuntimeInstructionTraceArtifact => ({
  format: RUNTIME_INSTRUCTION_TRACE_FORMAT,
  schemaVersion: RUNTIME_INSTRUCTION_TRACE_SCHEMA_VERSION,
  architecture: "snes.65816",
  addressSpace: "snes.cpu",
  romContentSha256: "a".repeat(64),
  producer: { id: "ares", revision: "fixture" },
  chunks: [{ sequenceStart: 1, addresses, droppedEvents: 0, active: false }],
});

test("execution window identifies routines in first-observed order", (t) => {
  const root = node("node:root", 0x808000, ["node:root"]);
  const rootBody = node("node:root-body", 0x808001, ["node:root", "node:root-body"]);
  const logo = node("node:logo", 0x808010, ["node:root", "node:logo"]);
  const logoBody = node("node:logo-body", 0x808011, ["node:root", "node:logo", "node:logo-body"]);
  const shards: AnalysisProjectShards = {
    ...emptyShards(),
    labels: [
      {
        id: "label:logo",
        addressSpace: "snes.cpu",
        address: 0x808010,
        name: "ShowSquaresoftLogo",
        evidence: [],
      },
    ],
    analysis: [
      root,
      rootBody,
      logo,
      logoBody,
      {
        id: "function:root",
        kind: "function",
        addressSpace: "snes.cpu",
        address: 0x808000,
        source: "entry",
        evidencePath: [],
        evidence: [],
      },
      {
        id: "function:logo",
        kind: "function",
        addressSpace: "snes.cpu",
        address: 0x808010,
        source: "call",
        evidencePath: ["node:root"],
        evidence: [],
      },
    ],
  };
  const summary = summarizeExecutionWindow(
    trace([0x808000, 0x808001, 0x808010, 0x808011, 0x808000, 0x80ffff]),
    shards,
  );

  t.is(summary.observedEvents, 6);
  t.is(summary.uniqueInstructionAddresses, 5);
  t.is(summary.attributedEvents, 5);
  t.is(summary.unownedEvents, 1);
  t.deepEqual(summary.unownedAddresses, [0x80ffff]);
  t.deepEqual(
    summary.routines.map(
      ({ name, instructionEvents, uniqueInstructionAddresses, executionSpans }) => ({
        name,
        instructionEvents,
        uniqueInstructionAddresses,
        executionSpans,
      }),
    ),
    [
      {
        name: "function:root",
        instructionEvents: 3,
        uniqueInstructionAddresses: 2,
        executionSpans: 2,
      },
      {
        name: "ShowSquaresoftLogo",
        instructionEvents: 2,
        uniqueInstructionAddresses: 2,
        executionSpans: 1,
      },
    ],
  );
});

test("execution window leaves conflicting function ownership ambiguous", (t) => {
  const left = node("node:left", 0x808020, ["node:left"]);
  const right = node("node:right", 0x808020, ["node:right"]);
  const shards: AnalysisProjectShards = {
    ...emptyShards(),
    analysis: [
      left,
      right,
      {
        id: "function:left",
        kind: "function",
        addressSpace: "snes.cpu",
        address: 0x808020,
        source: "entry",
        evidencePath: [],
        evidence: [],
      },
      {
        id: "function:right",
        kind: "function",
        addressSpace: "snes.cpu",
        address: 0x808020,
        source: "call",
        evidencePath: [],
        evidence: [],
      },
    ],
  };
  const summary = summarizeExecutionWindow(trace([0x808020]), shards);
  t.is(summary.ambiguousEvents, 1);
  t.deepEqual(summary.ambiguousAddresses, [0x808020]);
  t.deepEqual(summary.routines, []);
});

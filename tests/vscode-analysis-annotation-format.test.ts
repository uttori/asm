import type { InstructionAnalysisAnnotation } from "@uttori/asm-disassembler";
import {
  formatInstructionAnnotationDetails,
  formatInstructionAnnotationSummary,
} from "../packages/vscode-extension/src/analysis-annotation-format.js";
import {
  createInstructionAnnotationIndex,
  instructionAnnotationsForDebugRange,
} from "../packages/vscode-extension/src/analysis-annotation-index.js";
import { test } from "./ava-helper.js";

const annotation: InstructionAnalysisAnnotation = {
  id: "cpu:$808000",
  addressSpace: "cpu",
  address: 0x80_8000,
  outputOffsets: [0],
  architectures: ["65c816"],
  nodeIds: ["node-1"],
  effectiveAddresses: [
    {
      operandIndex: 0,
      address: 0x7e_1234,
      symbol: "PlayerHP",
      volatile: false,
      explanation: "data-bank-relative absolute operand",
      nodeIds: ["node-1"],
      evidence: ["static"],
    },
  ],
  stateTransitions: [
    {
      field: "m",
      before: { kind: "known", value: 8 },
      after: { kind: "known", value: 16 },
      nodeIds: ["node-1"],
      evidence: ["abstract-state"],
    },
  ],
  stateObservations: [
    {
      source: "runtime",
      architecture: "65c816",
      state: { m: { kind: "known", value: 8 } },
      count: 3,
      recordIds: ["state-1"],
      evidence: ["trace-1"],
    },
  ],
  executionCount: 3,
  executionRecordIds: ["execution-1"],
  runtimeCoverage: [
    {
      coverage: "executed",
      count: 3,
      recordIds: ["coverage-1"],
      evidence: ["trace-1"],
    },
  ],
  memoryAccesses: [
    {
      accessedAddressSpace: "wram",
      accessedAddress: 0x7e_1234,
      access: "read",
      width: 1,
      value: 0xff,
      count: 2,
      recordIds: ["memory-1"],
      evidence: ["trace-1"],
    },
  ],
  evidence: ["static", "trace-1"],
};

test("instruction annotations render compact and complete target-neutral text", (t) => {
  const summary = formatInstructionAnnotationSummary(annotation);
  t.true(summary.includes("▶ 3×"));
  t.true(summary.includes("coverage executed"));
  t.true(summary.includes("EA0 PlayerHP@$7E1234"));
  t.true(summary.includes("R wram:$7E1234=$00FF 1B ×2"));
  t.true(summary.includes("Δm $0008→$0010"));

  const details = formatInstructionAnnotationDetails(annotation);
  t.true(details.includes("cpu:$808000"));
  t.true(details.includes("Output offsets: $0000"));
  t.true(details.includes("Runtime coverage:"));
  t.true(details.includes("Static state transitions:"));
  t.true(details.includes("Evidence: static, trace-1"));

  const clipped = formatInstructionAnnotationSummary(annotation, 30);
  t.is(clipped.length, 30);
  t.true(clipped.endsWith("…"));
});

test("source annotation indexes cover complete half-open logical and output spans", (t) => {
  const instructions: InstructionAnalysisAnnotation[] = [
    { ...annotation, id: "first", address: 0x100, outputOffsets: [0x10] },
    { ...annotation, id: "second", address: 0x101, outputOffsets: [0x11] },
    { ...annotation, id: "end-exclusive", address: 0x102, outputOffsets: [0x12] },
    {
      ...annotation,
      id: "wrong-architecture",
      address: 0x101,
      outputOffsets: [0x11],
      architectures: ["spc700"],
    },
    {
      ...annotation,
      id: "explicit-mirror",
      addressSpace: "apu",
      address: 0x200,
      outputOffsets: [0x10],
    },
  ];
  const matches = instructionAnnotationsForDebugRange(
    createInstructionAnnotationIndex(instructions),
    {
      architecture: "65c816",
      addressSpace: "cpu",
      start: 0x100,
      end: 0x102,
      outputStart: 0x10,
      outputEnd: 0x12,
    },
  );

  t.deepEqual(
    matches.map(({ id }) => id),
    ["explicit-mirror", "first", "second"],
  );
});

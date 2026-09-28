import type { InstructionAnalysisAnnotation } from "@uttori/asm-disassembler";

import { test } from "../../../../tests/ava-helper.js";
import {
  createInstructionAnnotationIndex,
  instructionAnnotationsForDebugRange,
} from "../../src/analysis/annotation-index.js";
import {
  informationHex,
  informationField,
  renderInformationSection,
  type LineInformation,
  formatInstructionAnnotationDetails,
  formatInstructionAnnotationSummary,
} from "../../src/editor-info/format.js";
import { informationOverlayGap, informationSourceColumns } from "../../src/editor-info/layout.js";

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

test("analysis overlay gaps keep long declarations from shifting short lines", (t) => {
  for (const tabSize of [2, 4, 8]) {
    for (const line of ["nop", "\tlda\t#$10"]) {
      const width = informationSourceColumns(line, tabSize);
      t.is(width + informationOverlayGap(line, tabSize), 80);
    }
    t.is(
      informationOverlayGap(`dataStruct Example, { bytes = [${"$FF, ".repeat(500)}] }`, tabSize),
      3,
    );
    t.is(informationSourceColumns("\tx\t", tabSize), tabSize * 2);
  }
  t.is(informationOverlayGap("nop", 4, 100), 97);
});

test("shared hexadecimal formatting preserves display widths, signs and wide addresses", (t) => {
  for (const [value, width, expected] of [
    [0, 4, "$0000"],
    [0xff, 2, "$FF"],
    [0x2b, 6, "$00002B"],
    [-0x2b, 4, "-$002B"],
    [0x123456789, 6, "$123456789"],
    [1, 0, "$1"],
  ] as const) {
    t.is(informationHex(value, width), expected);
  }
  const details = formatInstructionAnnotationDetails({
    ...annotation,
    outputOffsets: [0, 1, 0x123456789],
  });
  t.true(details.includes("Output offsets: $0000, $0001, $123456789"));
});

test("source state fields and evidence details share scalar semantics without exposing structured values inline", (t) => {
  const state = {
    zero: 0,
    flag: false,
    negative: { kind: "known", value: -1 },
    unknown: { kind: "unknown" },
    ratio: 1.5,
    structured: { b: 2, a: 1 },
  };
  const entry: InstructionAnalysisAnnotation = {
    ...annotation,
    stateObservations: [{ ...annotation.stateObservations[0], state }],
    stateTransitions: [
      { ...annotation.stateTransitions[0], before: undefined, after: { kind: "unknown" } },
    ],
  };
  const { before: _before, ...absentBefore } = entry.stateTransitions[0];
  const details = formatInstructionAnnotationDetails({
    ...entry,
    stateTransitions: [absentBefore],
  });
  const info: LineInformation = {
    identity: "fixture",
    label: "fixture",
    ranges: [],
    locations: [],
    instructions: [],
    annotations: [entry],
  };
  for (const [field, value] of Object.entries({
    zero: "$0000",
    flag: "false",
    negative: "-$0001",
    unknown: "?",
    ratio: "1.5",
  })) {
    t.is(informationField(`runtime_state.${field}`, info), value);
    t.true(details.includes(`${field}=${value}`));
  }
  t.is(informationField("runtime_state.structured", info), undefined);
  t.is(informationField("runtime_state.missing", info), undefined);
  t.true(details.includes('structured={"a":1,"b":2}'));
  t.true(details.includes("Δm ∅→?"));
});

test("inspector sections preserve evidence and isolate histories without mutating cached facts", (t) => {
  const entry: InstructionAnalysisAnnotation = {
    ...annotation,
    detailsLimited: true,
    comments: [
      {
        id: "note",
        addressSpace: "cpu",
        address: annotation.address,
        text: "Recovered entry",
        evidence: ["user-note"],
      },
    ],
    stateObservations: [
      annotation.stateObservations[0],
      { ...annotation.stateObservations[0], source: "project" },
    ],
  };
  const info: LineInformation = {
    identity: "fixture",
    label: "fixture",
    ranges: [],
    locations: [],
    instructions: [],
    annotations: [entry],
  };
  const before = structuredClone(info);
  const runtime = renderInformationSection(info, "Runtime state");
  t.true(runtime.includes("runtime state"));
  t.false(runtime.includes("project state"));
  t.false(runtime.includes("Runtime memory:"));
  t.true(runtime.includes("Some detail records are omitted"));
  const project = renderInformationSection(info, "Project state");
  t.true(project.includes("project state"));
  t.false(project.includes("runtime state"));
  const evidence = renderInformationSection(info, "Evidence and control flow");
  for (const value of [
    "Comment: Recovered entry",
    "Evidence: user-note",
    "Runtime coverage:",
    "CFG nodes: node-1",
    "Evidence: static, trace-1",
  ]) {
    t.true(evidence.includes(value));
  }
  t.false(evidence.includes("Known/observed state:"));
  t.true(renderInformationSection(info, "State transitions").includes("Δm $0008→$0010"));
  t.true(
    renderInformationSection(info, "Memory and effective addresses").includes(
      "EA0 PlayerHP@$7E1234",
    ),
  );
  t.false(renderInformationSection(info, "Summary").includes("Evidence:"));
  t.deepEqual(info, before);
});

import { test } from "../../../tests/ava-helper.js";
import {
  buildInstructionAnalysisAnnotations,
  type AnalysisControlFlowNodeRecord,
  type AnalysisProjectShards,
} from "../src/index.js";

const node = (
  id: string,
  context: readonly number[],
  effectiveAddresses: readonly Readonly<Record<string, unknown>>[],
): AnalysisControlFlowNodeRecord => ({
  id,
  kind: "cfg-node",
  addressSpace: "fixture.cpu",
  address: 0x808000,
  fileOffset: 0,
  size: 3,
  opcode: 0xad,
  specificationId: "fixture.lda",
  mnemonic: "LDA",
  mode: "absolute",
  context,
  incomingState: { m: { kind: "known", value: 1 }, unchanged: true },
  outgoingState: { m: { kind: "known", value: 0 }, unchanged: true },
  effectiveAddresses,
  entryPoint: "fixture",
  evidencePath: [id],
  evidence: [`evidence:${id}`],
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

test("instruction annotations merge static, project, and runtime evidence without mapper guesses", (t) => {
  const effectiveAddress = {
    operandIndex: 0,
    address: 0x2100,
    symbol: "INIDISP",
    volatile: true,
    explanation: "Volatile display-control register.",
  };
  const projection = buildInstructionAnalysisAnnotations(
    {
      addressSpaces: [
        { id: "fixture.rom", name: "ROM", kind: "file", addressBits: 24 },
        { id: "fixture.cpu", name: "CPU", kind: "cpu", addressBits: 24 },
        { id: "fixture.wram", name: "WRAM", kind: "memory", addressBits: 24 },
      ],
    },
    {
      ...emptyShards(),
      analysis: [
        node("node:first", [], [effectiveAddress, { operandIndex: "bad" }]),
        node("node:second", [0x818000], [effectiveAddress]),
        {
          id: "summary:fixture",
          kind: "summary",
          architecture: "fixture.cpu",
          status: "complete",
          coverage: {},
          processedWorkItems: 2,
          incompleteReasons: [],
          evidence: [],
        },
      ],
      annotations: [
        {
          id: "annotation:state",
          addressSpace: "fixture.rom",
          start: 0,
          end: 1,
          classification: "opcode",
          architecture: "fixture.cpu",
          state: { m: true, dataBank: 0x7e },
          evidence: ["evidence:project-state"],
        },
      ],
      runtime: [
        {
          id: "runtime:execution:a",
          kind: "runtime-execution",
          architecture: "fixture.cpu",
          addressSpace: "fixture.cpu",
          address: 0x808000,
          fileOffset: 0,
          count: 3,
          evidence: ["evidence:trace-a"],
        },
        {
          id: "runtime:execution:b",
          kind: "runtime-execution",
          architecture: "fixture.cpu",
          addressSpace: "fixture.cpu",
          address: 0x808000,
          fileOffset: 0,
          count: 2,
          evidence: ["evidence:trace-b"],
        },
        {
          id: "runtime:state:a",
          kind: "runtime-cpu-state",
          architecture: "fixture.cpu",
          addressSpace: "fixture.cpu",
          address: 0x808000,
          state: { m: true, x: false },
          count: 4,
          evidence: ["evidence:state-a"],
        },
        {
          id: "runtime:state:b",
          kind: "runtime-cpu-state",
          architecture: "fixture.cpu",
          addressSpace: "fixture.cpu",
          address: 0x808000,
          state: { x: false, m: true },
          count: 5,
          evidence: ["evidence:state-b"],
        },
        {
          id: "runtime:memory:a",
          kind: "runtime-memory-access",
          architecture: "fixture.cpu",
          instructionAddressSpace: "fixture.cpu",
          instructionAddress: 0x808000,
          accessedAddressSpace: "fixture.wram",
          accessedAddress: 0x7e0010,
          access: "read",
          width: 2,
          value: 0x1234,
          count: 6,
          evidence: ["evidence:memory-a"],
        },
        {
          id: "runtime:memory:b",
          kind: "runtime-memory-access",
          architecture: "fixture.cpu",
          instructionAddressSpace: "fixture.cpu",
          instructionAddress: 0x808000,
          accessedAddressSpace: "fixture.wram",
          accessedAddress: 0x7e0010,
          access: "read",
          width: 2,
          value: 0x1234,
          count: 1,
          evidence: ["evidence:memory-b"],
        },
        {
          id: "runtime:coverage:cpu",
          kind: "runtime-coverage",
          architecture: "fixture.cpu",
          addressSpace: "fixture.cpu",
          start: 0x808000,
          end: 0x808001,
          coverage: "executed",
          count: 7,
          evidence: ["evidence:coverage-cpu"],
        },
        {
          id: "runtime:coverage:file",
          kind: "runtime-coverage",
          architecture: "fixture.cpu",
          addressSpace: "fixture.rom",
          start: 0,
          end: 3,
          coverage: "read",
          count: 2,
          evidence: ["evidence:coverage-file"],
        },
      ],
    },
  );

  const instruction = projection.instructions.find(
    ({ addressSpace }) => addressSpace === "fixture.cpu",
  )!;
  t.deepEqual(instruction.outputOffsets, [0]);
  t.deepEqual(instruction.architectures, ["fixture.cpu"]);
  t.deepEqual(instruction.nodeIds, ["node:first", "node:second"]);
  t.is(instruction.executionCount, 5);
  t.deepEqual(instruction.executionRecordIds, ["runtime:execution:a", "runtime:execution:b"]);
  t.is(instruction.effectiveAddresses.length, 1);
  t.deepEqual(instruction.effectiveAddresses[0]?.nodeIds, ["node:first", "node:second"]);
  t.is(instruction.stateTransitions.length, 1);
  t.is(instruction.stateTransitions[0]?.field, "m");
  t.deepEqual(instruction.stateTransitions[0]?.before, { kind: "known", value: 1 });
  t.deepEqual(instruction.stateTransitions[0]?.after, { kind: "known", value: 0 });
  t.deepEqual(
    instruction.stateObservations.map(({ source, count, recordIds }) => ({
      source,
      count,
      recordIds,
    })),
    [
      { source: "project", count: undefined, recordIds: ["annotation:state"] },
      {
        source: "runtime",
        count: 9,
        recordIds: ["runtime:state:a", "runtime:state:b"],
      },
    ],
  );
  t.deepEqual(
    instruction.runtimeCoverage.map(({ coverage, count, recordIds }) => ({
      coverage,
      count,
      recordIds,
    })),
    [
      { coverage: "executed", count: 7, recordIds: ["runtime:coverage:cpu"] },
      { coverage: "read", count: 2, recordIds: ["runtime:coverage:file"] },
    ],
  );
  t.is(instruction.memoryAccesses[0]?.count, 7);
  t.deepEqual(instruction.memoryAccesses[0]?.recordIds, ["runtime:memory:a", "runtime:memory:b"]);
  t.deepEqual(projection.diagnostics, [
    {
      recordId: "node:first",
      message:
        "Ignored malformed effective-address metadata; required operandIndex, volatile, and explanation fields were not valid.",
    },
  ]);

  const fileInstruction = projection.instructions.find(
    ({ addressSpace }) => addressSpace === "fixture.rom",
  )!;
  t.deepEqual(fileInstruction.outputOffsets, [0]);
  t.is(fileInstruction.stateObservations[0]?.source, "project");
  t.is(fileInstruction.runtimeCoverage[0]?.coverage, "read");
});

test("instruction annotations retain runtime-only instruction identities", (t) => {
  const projection = buildInstructionAnalysisAnnotations(
    { addressSpaces: [{ id: "cpu", name: "CPU", kind: "cpu", addressBits: 16 }] },
    {
      ...emptyShards(),
      runtime: [
        {
          id: "runtime:only",
          kind: "runtime-execution",
          architecture: "fixture.cpu",
          addressSpace: "cpu",
          address: 0x1234,
          count: 12,
          evidence: [],
        },
      ],
    },
  );
  t.is(projection.instructions.length, 1);
  t.like(projection.instructions[0], {
    addressSpace: "cpu",
    address: 0x1234,
    executionCount: 12,
    outputOffsets: [],
    nodeIds: [],
  });
});

test("state alternatives are canonicalized once per observation, retaining counts and provenance", (t) => {
  const manifest = {
    addressSpaces: [{ id: "cpu", name: "CPU", kind: "cpu" as const, addressBits: 16 }],
  };
  let stateReads = 0;
  const runtime = Array.from({ length: 400 }, (_, index) => ({
    id: `state:${index}`,
    kind: "runtime-cpu-state" as const,
    architecture: "fixture.cpu",
    addressSpace: "cpu",
    address: 0x1234,
    state: {
      get a() {
        stateReads++;
        return (index * 71) % 200;
      },
      x: true,
    },
    count: 2,
    evidence: [`capture:${index % 2}`],
  }));
  const projection = buildInstructionAnalysisAnnotations(manifest, { ...emptyShards(), runtime });
  t.is(stateReads, runtime.length, "sorting reuses aggregation keys instead of re-reading states");
  const observations = projection.instructions[0].stateObservations;
  t.is(observations.length, 200, "distinct observed states are not discarded to save memory");
  for (const observation of observations) {
    t.is(observation.count, 4);
    t.is(observation.recordIds.length, 2);
    t.false("stateKey" in observation, "private sort keys do not alter the public projection");
  }
  t.deepEqual(
    buildInstructionAnalysisAnnotations(manifest, {
      ...emptyShards(),
      runtime: [...runtime].reverse(),
    }),
    projection,
    "input order does not change state ordering, evidence, or execution counts",
  );
});

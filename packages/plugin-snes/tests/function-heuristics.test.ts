import {
  RomImage,
  importRuntimeInstructionTrace,
  type AnalysisProjectShards,
  type RuntimeInstructionRecord,
} from "@uttori/asm-disassembler";

import { test } from "../../../tests/ava-helper.js";
import {
  analyzeSnesRuntimeCode,
  analyzeSnesFunctionRoles,
  validateSnesHeuristicConfiguration,
  analyzeSnes65816,
} from "../src/index.js";

const empty = (): AnalysisProjectShards => ({
  analysis: [],
  annotations: [],
  labels: [],
  comments: [],
  regions: [],
  runtime: [],
  evidence: [],
  imports: [],
});
const captured = (
  program: number[][],
  start = 0x7e2000,
  p = 0x30,
  db = 0,
): AnalysisProjectShards => {
  let address = start;
  const runtime: RuntimeInstructionRecord[] = program.map((bytes, index) => {
    const record: RuntimeInstructionRecord = {
      id: `r${index}`,
      kind: "runtime-instruction",
      architecture: "snes.65816",
      addressSpace: "snes.cpu",
      address,
      bytes,
      state: { p, e: 0, db, d: 0 },
      count: 1,
      evidence: ["capture"],
    };
    address += bytes.length;
    return record;
  });
  const shards = { ...empty(), runtime };
  return {
    ...shards,
    analysis: analyzeSnesRuntimeCode(shards, new RomImage(new Uint8Array(0x10000)), "lorom"),
  };
};
const roles = (shards: AnalysisProjectShards) =>
  analyzeSnesFunctionRoles(shards).roles.map((role) => role.role);

test("compact trace index produces the same captured CFG as full register snapshots", (t) => {
  const details = [
    { bytes: [0xa9, 1], state: { a: 1, x: 2, y: 3, s: 511, p: 0x30, e: 0, d: 0, db: 0x7e } },
    { bytes: [0xa9, 1], state: { a: 40, x: 400, y: 500, s: 509, p: 0x30, e: 0, d: 0, db: 0x7e } },
    { bytes: [0xa9, 1, 0], state: { a: 1, x: 2, y: 3, s: 511, p: 0x10, e: 0, d: 0x100, db: 0x7f } },
    { bytes: [0xa9, 2], state: { a: 1, x: 2, y: 3, s: 511, p: 0x30, e: 0, d: 0, db: 0x7e } },
  ];
  const trace = {
    format: "uttori-asm-instruction-trace" as const,
    schemaVersion: 1 as const,
    architecture: "snes.65816",
    addressSpace: "snes.cpu",
    romContentSha256: "a".repeat(64),
    producer: { id: "test", revision: "1" },
    chunks: [
      {
        sequenceStart: 1,
        addresses: details.map(() => 0x7e2000),
        details,
        droppedEvents: 0,
        active: false,
      },
    ],
  };
  const context = { projectRomContentSha256: trace.romContentSha256, sourceName: "trace.json" };
  const full = importRuntimeInstructionTrace(trace, context);
  const compact = importRuntimeInstructionTrace(trace, {
    ...context,
    indexMode: "65816-disassembly",
  });
  const rom = new RomImage(new Uint8Array(0x10000));
  t.deepEqual(
    analyzeSnesRuntimeCode({ ...empty(), ...compact.batch }, rom, "lorom"),
    analyzeSnesRuntimeCode({ ...empty(), ...full.batch }, rom, "lorom"),
  );
});

test("captured WRAM and SRAM instructions become nodes without invented ROM offsets", (t) => {
  for (const start of [0x7e2000, 0x7f9000, 0x700000]) {
    const shards = captured([[0xa9, 0x12], [0x8d, 0x18, 0x21], [0x60]], start);
    const nodes = shards.analysis.filter((record) => record.kind === "cfg-node");
    t.is(nodes.length, 3);
    t.true(nodes.every((node) => node.fileOffset === undefined));
    t.deepEqual(nodes.find((node) => node.address === start)?.bytes, [0xa9, 0x12]);
    t.true(roles(shards).includes("graphics.vram-write"));
  }
});

test("captured variants and insufficient width state remain explicit", (t) => {
  const shards = captured([[0xa9, 1]]);
  const sample = shards.runtime[0] as RuntimeInstructionRecord;
  const runtime = [
    sample,
    { ...sample, id: "different", bytes: [0xa9, 2] },
    { ...sample, id: "unknown", state: {} },
  ];
  const records = analyzeSnesRuntimeCode(
    { ...shards, runtime },
    new RomImage(new Uint8Array(0x10000)),
    "lorom",
  );
  t.is(records.filter((record) => record.kind === "cfg-node").length, 2);
  t.true(
    records.some(
      (record) => record.kind === "conflict" && record.conflictKind === "runtime-code-variants",
    ),
  );
  t.true(records.some((record) => record.kind === "unresolved"));
});

test("different capture states preserve compatible code while differing instruction widths remain conflicts", (t) => {
  const shards = captured([[0xa9, 1]]);
  const sample = shards.runtime[0] as RuntimeInstructionRecord;
  const runtime = [
    { ...sample, evidence: ["capture-a"] },
    {
      ...sample,
      id: "x16-different-bank",
      state: { ...sample.state, p: 0x20, db: 0x7e, d: 0x100 },
      evidence: ["capture-b"],
    },
  ];
  const rom = new RomImage(new Uint8Array(0x10000));
  const compatible = analyzeSnesRuntimeCode({ ...shards, runtime }, rom, "lorom");
  const nodes = compatible.filter((record) => record.kind === "cfg-node");
  t.is(nodes.length, 2, "both execution states remain available");
  t.deepEqual(nodes.flatMap((node) => node.evidence).sort(), ["capture-a", "capture-b"]);
  t.false(compatible.some((record) => record.kind === "conflict"));
  const incompatible = analyzeSnesRuntimeCode(
    {
      ...shards,
      runtime: [
        ...runtime,
        {
          ...sample,
          id: "a16",
          state: { ...sample.state, p: 0x10 },
          bytes: [0xa9, 1, 0xea],
          evidence: ["capture-c"],
        },
      ],
    },
    rom,
    "lorom",
  );
  t.is(incompatible.filter((record) => record.kind === "cfg-node").length, 3);
  t.true(incompatible.some((record) => record.kind === "conflict" && record.nodes.length === 3));
});

test("DMA destination requires paired setup, known width/direction, and a trigger", (t) => {
  // 16-bit LDA/STA configures DMAP7+BBAD7 together, then starts channel 7.
  const dma = (mode: number, target: number) =>
    captured(
      [[0xa9, mode, target], [0x8d, 0x70, 0x43], [0xa9, 0x80, 0], [0x8d, 0x0b, 0x42], [0x60]],
      0x7e2000,
      0x10,
    );
  t.true(roles(dma(1, 0x18)).includes("graphics.vram-dma"));
  t.true(roles(dma(0, 0x22)).includes("graphics.palette-dma"));
  t.true(roles(dma(0, 4)).includes("graphics.oam-dma"));
  t.false(roles(dma(0x81, 0x18)).includes("graphics.vram-dma"));
  t.false(
    roles(captured([[0xa9, 1, 0x18], [0x8d, 0x70, 0x43], [0x60]], 0x7e2000, 0x10)).includes(
      "graphics.vram-dma",
    ),
  );
});

test("APU upload requires source, payload, token, advancing loop, and an inner ack wait", (t) => {
  const shards = captured([
    [0xb7, 0x00], // LDA [$00],Y
    [0x8d, 0x41, 0x21], // STA APUIO1
    [0x98], // TYA
    [0x8d, 0x40, 0x21], // STA APUIO0
    [0xcd, 0x40, 0x21], // CMP APUIO0 (offset 9)
    [0xd0, 0xfb], // BNE ack
    [0xc8], // INY
    [0xd0, 0xef], // BNE loop start
    [0x60],
  ]);
  t.true(roles(shards).includes("audio.handshake-wait"));
  t.true(roles(shards).includes("audio.bulk-upload"));
  t.false(roles(shards).some((role) => role.startsWith("graphics")));
  t.false(
    roles(
      captured([
        [0xad, 0x40, 0x21],
        [0x80, 0xfb],
      ]),
    ).includes("audio.handshake-wait"),
  );
});

test("MMIO-like operands in calls or WRAM banks are not hardware evidence", (t) => {
  t.deepEqual(roles(captured([[0x20, 0x03, 0x42], [0x60]])), []);
  t.deepEqual(roles(captured([[0x8d, 0x18, 0x21], [0x60]], 0x7e2000, 0x30, 0x7e)), []);
  const rom = new Uint8Array(0x10000);
  rom.set([0x20, 0x03, 0x42, 0xdb]);
  rom[0x7ffd] = 0x80;
  const analysis = analyzeSnes65816(new RomImage(rom), "lorom", { maxWorkItems: 20 });
  t.deepEqual(roles({ ...empty(), analysis: analysis.records }), []);
});

test("observed indirect CPU and DMA bus accesses carry distinct role evidence", (t) => {
  const shards = captured([[0x91, 0x00], [0xea]]);
  const runtime = [
    ...shards.runtime,
    {
      id: "dma",
      kind: "runtime-memory-access" as const,
      architecture: "snes.65816",
      instructionAddressSpace: "snes.cpu",
      instructionAddress: 0x7e2000,
      accessedAddressSpace: "snes.cpu",
      accessedAddress: 0x2118,
      width: 1,
      access: "write" as const,
      value: 42,
      actor: "dma" as const,
      channel: 7,
      count: 1,
      evidence: ["bus"],
    },
  ];
  const result = analyzeSnesFunctionRoles({ ...shards, runtime });
  t.true(
    result.roles.some(
      (role) =>
        role.role === "graphics.vram-transfer" &&
        role.explanation.includes("DMA channel 7") &&
        role.evidence.includes("bus"),
    ),
  );
  t.false(result.roles.some((role) => role.role === "graphics.vram-write"));
});

test("configuration disables rules, sets thresholds, and supports validated register rules", (t) => {
  const shards = captured([[0x8d, 0x40, 0x21], [0xad, 0x12, 0x42], [0x60]]);
  t.deepEqual(analyzeSnesFunctionRoles(shards, { enabled: false }).roles, []);
  t.false(
    analyzeSnesFunctionRoles(shards, { minimumConfidence: "high" }).roles.some(
      (role) => role.rule === "apu-io",
    ),
  );
  t.false(
    analyzeSnesFunctionRoles(shards, { disabledRules: ["apu-io"] }).roles.some(
      (role) => role.rule === "apu-io",
    ),
  );
  const custom = analyzeSnesFunctionRoles(shards, {
    registerRules: [
      {
        id: "beam-state",
        role: "timing.beam-read",
        access: "read",
        addresses: [0x4212],
        confidence: "medium",
      },
    ],
  });
  t.true(custom.roles.some((role) => role.role === "timing.beam-read"));
  for (const invalid of [
    { unknown: true },
    { maxWindowInstructions: 1000 },
    { disabledRules: ["typo"] },
    {
      registerRules: [
        { id: "bad", role: "bad", access: "write", addresses: [0x7e2118], confidence: "high" },
      ],
    },
  ])
    t.throws(() => validateSnesHeuristicConfiguration(invalid));
});

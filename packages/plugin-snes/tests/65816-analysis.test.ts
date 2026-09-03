import { test } from "../../../tests/ava-helper.js";
import { RomImage, type StaticInstruction } from "../../disassembler/src/index.js";
import {
  analyzeSnes65816,
  applyCpu65816StateOverride,
  joinCpu65816States,
  resetCpu65816State,
  transferCpu65816State,
  unknownCpu65816State,
} from "../src/index.js";

const loRom = (program: readonly number[], reset = 0x8000): RomImage => {
  const bytes = new Uint8Array(0x10000);
  bytes.set(program, 0);
  bytes[0x7ffc] = reset & 0xff;
  bytes[0x7ffd] = reset >>> 8;
  return new RomImage(bytes);
};

test("65816 analysis follows reset, calls, state effects, and hardware addresses", (t) => {
  const rom = loRom([
    0x18, // CLC
    0xfb, // XCE: enter native mode
    0xc2,
    0x20, // REP #$20: 16-bit accumulator
    0xa9,
    0x34,
    0x12, // LDA #$1234
    0xe2,
    0x20, // SEP #$20: 8-bit accumulator
    0xad,
    0x00,
    0x21, // LDA $2100
    0x20,
    0x10,
    0x80, // JSR $8010
    0xdb, // STP
    0x60, // RTS
  ]);
  const result = analyzeSnes65816(rom, "lorom", { maxWorkItems: 100 });

  t.is(result.status, "complete");
  t.true(result.nodes.some((node) => node.address === 0x008004 && node.size === 3));
  t.true(result.edges.some((edge) => edge.kind === "call" && edge.toAddress === 0x008010));
  t.true(result.edges.some((edge) => edge.kind === "return" && edge.toAddress === 0x00800f));
  const hardware = result.nodes
    .find((node) => node.address === 0x008009)
    ?.effectiveAddresses.find((address) => address.symbol === "INIDISP");
  t.true(hardware?.volatile);
  t.is(hardware?.romOffset, undefined);
  t.true(result.functions.some((candidate) => candidate.address === 0x008000));
  t.true(result.functions.some((candidate) => candidate.address === 0x008010));
  t.true(result.annotations.some((annotation) => annotation.classification === "opcode"));
  t.true(result.records.some((record) => record.kind === "summary"));
  t.true(result.evidenceRecords.some((record) => record.id === "detector:vector:reset"));
});

test("65816 analysis stops at data and width conflicts without guessing", (t) => {
  const rom = loRom([0xa9, 0x34, 0x12, 0xdb], 0);
  const ambiguous = analyzeSnes65816(rom, "lorom", {
    entryPoints: [
      { id: "m8", address: 0x008000, state: { e: 0, m: 1, x: 1 } },
      { id: "m16", address: 0x008000, state: { e: 0, m: 0, x: 1 } },
    ],
  });
  t.true(ambiguous.conflicts.some((conflict) => conflict.kind === "state-ambiguity"));
  t.false(ambiguous.nodes.some((node) => node.address === 0x008000));

  const blocked = analyzeSnes65816(loRom([0xea, 0xdb], 0), "lorom", {
    entryPoints: [{ id: "data", address: 0x008000, state: { e: 1 } }],
    annotations: [
      {
        id: "manual:data",
        addressSpace: "rom.file",
        start: 0,
        end: 1,
        classification: "data8",
        architecture: "snes.65816",
        evidence: ["manual:data-evidence"],
      },
    ],
    evidence: [
      {
        id: "manual:data-evidence",
        source: "manual",
        sourceId: "test",
        confidence: "certain",
      },
    ],
  });
  t.true(blocked.conflicts.some((conflict) => conflict.kind === "blocked"));
  t.is(blocked.nodes.length, 0);
});

test("65816 analysis keeps indirect flow unresolved until a manual target override", (t) => {
  const rom = loRom([0x6c, 0x00, 0x90, 0xdb], 0); // JMP ($9000)
  const unresolved = analyzeSnes65816(rom, "lorom", {
    entryPoints: [{ id: "indirect", address: 0x008000, state: { e: 1 } }],
  });
  t.true(unresolved.unresolved.some((flow) => flow.address === 0x008000));

  const resolved = analyzeSnes65816(rom, "lorom", {
    entryPoints: [{ id: "indirect", address: 0x008000, state: { e: 1 } }],
    targetOverrides: [
      {
        id: "manual:jump-table",
        kind: "target-override",
        addressSpace: "snes.cpu",
        address: 0x008000,
        targets: [0x008003],
        evidence: ["manual:jump-table-evidence"],
      },
    ],
    evidence: [
      {
        id: "manual:jump-table-evidence",
        source: "manual",
        sourceId: "test",
        confidence: "certain",
      },
    ],
  });
  t.false(resolved.unresolved.some((flow) => flow.address === 0x008000));
  t.true(resolved.edges.some((edge) => edge.override === "manual:jump-table"));
});

test("manual state evidence outranks contradictory imported width metadata", (t) => {
  const rom = loRom([0xa9, 0x34, 0x12, 0xdb], 0);
  const result = analyzeSnes65816(rom, "lorom", {
    entryPoints: [{ id: "state-ranked", address: 0x008000, state: { e: 0 } }],
    annotations: [
      {
        id: "import:m16",
        addressSpace: "rom.file",
        start: 0,
        end: 1,
        classification: "opcode",
        architecture: "snes.65816",
        state: { m: false },
        evidence: ["import:state"],
      },
      {
        id: "manual:m8",
        addressSpace: "rom.file",
        start: 0,
        end: 1,
        classification: "opcode",
        architecture: "snes.65816",
        state: { m: true },
        evidence: ["manual:state"],
      },
    ],
    evidence: [
      {
        id: "import:state",
        source: "import",
        sourceId: "fixture-import",
        confidence: "certain",
      },
      {
        id: "manual:state",
        source: "manual",
        sourceId: "fixture-manual",
        confidence: "certain",
      },
    ],
  });
  t.is(result.nodes.find((node) => node.address === 0x008000)?.size, 2);
  t.true(result.nodes[0]?.evidence.includes("manual:state"));
});

test("same-rank contradictory runtime width observations stay ambiguous", (t) => {
  const result = analyzeSnes65816(loRom([0xa9, 0x34, 0x12, 0xdb], 0), "lorom", {
    entryPoints: [{ id: "runtime-ranked", address: 0x008000, state: { e: 0 } }],
    annotations: [
      {
        id: "runtime:m16",
        addressSpace: "rom.file",
        start: 0,
        end: 1,
        classification: "opcode",
        architecture: "snes.65816",
        state: { m: false },
        evidence: ["runtime:state-a"],
      },
      {
        id: "runtime:m8",
        addressSpace: "rom.file",
        start: 0,
        end: 1,
        classification: "opcode",
        architecture: "snes.65816",
        state: { m: true },
        evidence: ["runtime:state-b"],
      },
    ],
    evidence: [
      {
        id: "runtime:state-a",
        source: "runtime",
        sourceId: "fixture-a",
        confidence: "certain",
      },
      {
        id: "runtime:state-b",
        source: "runtime",
        sourceId: "fixture-b",
        confidence: "certain",
      },
    ],
  });
  t.false(result.nodes.some((node) => node.address === 0x008000));
  t.true(result.conflicts.some((conflict) => conflict.kind === "state-ambiguity"));
});

test("65816 abstract state distinguishes unknown and conflicting joins and tracks PHK/PLB", (t) => {
  const unknownState = unknownCpu65816State();
  const m8 = applyCpu65816StateOverride(unknownState, { e: 0, m: 1 });
  const m16 = applyCpu65816StateOverride(unknownState, { e: 0, m: 0 });
  const joined = joinCpu65816States(m8, m16);
  t.is(joined.m.kind, "conflicting");

  const instruction = (
    mnemonic: string,
    effects: StaticInstruction["effects"],
  ): StaticInstruction => ({
    specificationId: mnemonic,
    address: 0x808000,
    fileOffset: 0,
    size: 1,
    opcode: 0,
    mnemonic,
    mode: "implied",
    effects,
    flow: { kind: "fallthrough", fallthrough: true },
    targets: [],
  });
  const pushed = transferCpu65816State(
    instruction("PHK", [{ kind: "push", source: "pbr" }]),
    applyCpu65816StateOverride(resetCpu65816State(), { programBank: 0x80 }),
  );
  const pulled = transferCpu65816State(
    instruction("PLB", [{ kind: "pull", target: "dbr" }]),
    pushed,
  );
  t.deepEqual(pulled.dbr, { kind: "known", value: 0x80 });
  t.deepEqual(pulled.s, { kind: "known", value: 0x01ff });

  const unknownWidthPush = transferCpu65816State(
    instruction("PHA", [{ kind: "push", source: "a" }]),
    unknownState,
  );
  t.is(unknownWidthPush.s.kind, "unknown");
  t.is(unknownWidthPush.stack.kind, "unknown");
});

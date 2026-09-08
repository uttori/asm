import { Uint8ArrayDecoderSource } from "@uttori/asm-core";
import { test } from "../../../tests/ava-helper.js";
import { createEncoderTestHost } from "../../../tests/architecture/test-stubs.js";

import { Arch65816 } from "../src/architectures/65816.js";
import {
  Cpu65816Decoder,
  formatCpu65816Instruction,
  type Cpu65816DecodeState,
} from "../src/architectures/65816-decoder.js";
import { buildCpu65816Catalog, cpu65816Specifications } from "../src/architectures/65816-spec.js";
import { formatSnes65816SourceInstruction } from "../src/disassembler/source-export.js";
import { indexSnesRamMap, validateSnesRamMap } from "../src/disassembler/ram-map.js";

const decoder = new Cpu65816Decoder();
const logicalAddress = 0x808000;

const decode = (bytes: readonly number[], state: Cpu65816DecodeState = {}) =>
  decoder.decode({
    source: new Uint8ArrayDecoderSource(bytes),
    offset: 0,
    logicalAddress,
    state,
  });

test("65816 declarative table covers each opcode exactly once and generates tooling", (t) => {
  t.is(cpu65816Specifications.length, 256);
  t.deepEqual(
    cpu65816Specifications.map((entry) => entry.opcode[0]),
    Array.from({ length: 256 }, (_, opcode) => opcode),
  );
  t.is(new Set(cpu65816Specifications.map((entry) => entry.id)).size, 256);

  const catalog = buildCpu65816Catalog();
  t.true(catalog.length > 80);
  t.deepEqual(
    catalog.map((entry) => entry.mnemonic),
    [...catalog.map((entry) => entry.mnemonic)].sort(),
  );
  t.is(catalog.find((entry) => entry.mnemonic === "LDA")?.modes.length, 15);
  t.deepEqual(
    catalog.find((entry) => entry.mnemonic === "JML")?.modes.map((mode) => mode.opcode),
    [0x5c, 0xdc],
  );
});

test("65816 decoder reports fixed-width instructions, flow, references, and effects", (t) => {
  const branch = decode([0xd0, 0xfe], { e: 0, m: 1, x: 1, programBank: 0x80 });
  t.is(branch.kind, "instruction");
  if (branch.kind !== "instruction") return;
  t.is(branch.instruction.mnemonic, "BNE");
  t.is(branch.instruction.operands[0]?.targetAddress, logicalAddress);
  t.deepEqual(branch.instruction.flow, { kind: "conditionalBranch", fallthrough: true });
  t.deepEqual(branch.instruction.references, [
    { kind: "branch", operandIndex: 0, address: logicalAddress },
  ]);
  t.is(formatCpu65816Instruction(branch.instruction), "BNE $808000");

  const rep = decode([0xc2, 0x30], { e: 0, m: 1, x: 1 });
  t.is(rep.kind, "instruction");
  if (rep.kind === "instruction") {
    t.deepEqual(rep.instruction.effects, [{ kind: "clearBits", target: "p", mask: 0x30 }]);
    t.is(formatCpu65816Instruction(rep.instruction), "REP #$30");
  }

  const stop = decode([0xdb]);
  t.is(stop.kind, "instruction");
  if (stop.kind === "instruction")
    t.deepEqual(stop.instruction.flow, { kind: "stop", fallthrough: false });

  const bankLocalCall = decode([0x20, 0x34, 0x12]);
  t.is(bankLocalCall.kind, "instruction");
  if (bankLocalCall.kind === "instruction") {
    t.deepEqual(bankLocalCall.instruction.references, [
      { kind: "call", operandIndex: 0, address: 0x801234 },
    ]);
  }

  const longData = decode([0xbf, 0x56, 0x34, 0x12], { dataBank: 0x80 });
  t.is(longData.kind, "instruction");
  if (longData.kind === "instruction") {
    t.deepEqual(longData.instruction.references, [
      { kind: "data", operandIndex: 0, address: 0x123456 },
    ]);
  }

  const unknownDirectPage = decode([0xa5, 0x20], { e: 1 });
  t.is(unknownDirectPage.kind, "instruction");
  if (unknownDirectPage.kind === "instruction") {
    t.deepEqual(unknownDirectPage.instruction.references, [{ kind: "data", operandIndex: 0 }]);
  }
  const unknownDataBank = decode([0xad, 0x00, 0x21], { e: 1 });
  t.is(unknownDataBank.kind, "instruction");
  if (unknownDataBank.kind === "instruction") {
    t.deepEqual(unknownDataBank.instruction.references, [{ kind: "data", operandIndex: 0 }]);
  }
});

test("65816 decoder makes E/M/X width ambiguity explicit", (t) => {
  const accumulator = decode([0xa9, 0x34, 0x12], { e: 0, m: "unknown", x: 1 });
  t.is(accumulator.kind, "ambiguous");
  if (accumulator.kind === "ambiguous") {
    t.deepEqual(accumulator.requiredState, ["m"]);
    t.deepEqual(
      accumulator.alternatives.map((entry) => entry.size),
      [2, 3],
    );
    t.deepEqual(accumulator.alternatives.map(formatCpu65816Instruction), [
      "LDA #$34",
      "LDA #$1234",
    ]);
  }

  const index = decode([0xa2, 0x34, 0x12], { e: 0, m: 1, x: "unknown" });
  t.is(index.kind, "ambiguous");
  if (index.kind === "ambiguous") t.deepEqual(index.requiredState, ["x"]);

  const emulationForcesEightBit = decode([0xa9, 0x34], { e: 1, m: 0, x: 0 });
  t.is(emulationForcesEightBit.kind, "instruction");
  if (emulationForcesEightBit.kind === "instruction")
    t.is(emulationForcesEightBit.instruction.size, 2);

  const truncatedAmbiguous = decode([0xa9, 0x34], { e: "unknown", m: "unknown" });
  t.like(truncatedAmbiguous, {
    kind: "ambiguous",
    minimumSize: 2,
    maximumSize: 3,
    unavailableAlternatives: [{ code: "truncated", size: 3, availableBytes: 2 }],
  });
  if (truncatedAmbiguous.kind === "ambiguous") {
    t.deepEqual(
      truncatedAmbiguous.alternatives.map((entry) => entry.size),
      [2],
    );
  }
});

test("65816 width predicates cover native, emulation, and unknown states for every opcode", (t) => {
  for (const specification of cpu65816Specifications) {
    const bytes = [specification.opcode[0], 0x34, 0x12, 0x56];
    for (const e of [0, 1, "unknown"] as const) {
      for (const m of [0, 1, "unknown"] as const) {
        for (const x of [0, 1, "unknown"] as const) {
          const result = decode(bytes, { e, m, x });
          const selected =
            specification.widthFlag === "m" ? m : specification.widthFlag === "x" ? x : 1;
          const ambiguous =
            specification.widthFlag &&
            e !== 1 &&
            (selected === "unknown" || (e === "unknown" && selected === 0));
          if (ambiguous) t.is(result.kind, "ambiguous", specification.id);
          else {
            t.is(result.kind, "instruction", specification.id);
            if (result.kind === "instruction") {
              const expected = specification.widthFlag
                ? e === 1 || selected === 1
                  ? 2
                  : 3
                : specification.minimumSize;
              t.is(result.instruction.size, expected, specification.id);
            }
          }
        }
      }
    }
  }
});

test("65816 public-documentation golden vectors decode canonically", (t) => {
  const vectors = [
    { bytes: [0x00, 0x7f], state: { e: 1 as const }, source: "BRK #$7F", flow: "interrupt" },
    {
      bytes: [0x22, 0x56, 0x34, 0x12],
      state: { e: 0 as const },
      source: "JSL $123456",
      flow: "call",
    },
    { bytes: [0x6c, 0x34, 0x12], state: { e: 0 as const }, source: "JMP ($1234)", flow: "jump" },
    {
      bytes: [0xa9, 0x34, 0x12],
      state: { e: 0 as const, m: 0 as const },
      source: "LDA #$1234",
      flow: "fallthrough",
    },
    {
      bytes: [0xb7, 0x34],
      state: { e: 0 as const, m: 1 as const },
      source: "LDA [$34],y",
      flow: "fallthrough",
    },
    {
      bytes: [0x54, 0x12, 0x34],
      state: { e: 0 as const },
      source: "MVN $12,$34",
      flow: "fallthrough",
    },
    { bytes: [0xdb], state: { e: 0 as const }, source: "STP", flow: "stop" },
  ];
  for (const vector of vectors) {
    const result = decode(vector.bytes, vector.state);
    t.is(result.kind, "instruction", vector.source);
    if (result.kind !== "instruction") continue;
    t.is(formatCpu65816Instruction(result.instruction), vector.source);
    t.is(result.instruction.flow.kind, vector.flow);
  }
});

test("65816 decoder reports every known-width truncated instruction without reading past input", (t) => {
  for (const specification of cpu65816Specifications) {
    const size = specification.maximumSize;
    if (size === 1) continue;
    const state: Cpu65816DecodeState = { e: 0, m: 0, x: 0 };
    const result = decode([specification.opcode[0], ...Array(size - 2).fill(0)], state);
    t.like(result, { kind: "error", code: "truncated", requiredBytes: size }, specification.id);
  }
});

test("65816 decode-format-encode round trips all 256 opcodes in every width", (t) => {
  for (const specification of cpu65816Specifications) {
    const widths = specification.widthFlag ? ([1, 0] as const) : ([1] as const);
    for (const width of widths) {
      const size = specification.widthFlag ? (width === 1 ? 2 : 3) : specification.minimumSize;
      const bytes = [specification.opcode[0], 0x34, 0x12, 0x56].slice(0, size);
      const state: Cpu65816DecodeState = {
        e: 0,
        m: specification.widthFlag === "m" ? width : 1,
        x: specification.widthFlag === "x" ? width : 1,
        programBank: 0x80,
      };
      const result = decode(bytes, state);
      t.is(result.kind, "instruction", specification.id);
      if (result.kind !== "instruction") continue;
      for (const source of [
        formatCpu65816Instruction(result.instruction),
        formatSnes65816SourceInstruction(result.instruction),
      ]) {
        const host = createEncoderTestHost();
        host.currentTargetAddress = logicalAddress;
        host.activateStage("emitProgram");
        const encoder = new Arch65816(host.context, () => true);
        encoder.beginPass();
        encoder.m16 = specification.widthFlag === "m" && width === 0;
        encoder.x16 = specification.widthFlag === "x" && width === 0;
        t.true(encoder.encode(source.split(/\s+/)), `${specification.id}: ${source}`);
        t.deepEqual(host.emitted, bytes, `${specification.id}: ${source}`);
      }
    }
  }
});

test("source formatter names CPU-visible SNES hardware registers without changing width", (t) => {
  const absolute = decode([0x8d, 0x00, 0x21], { e: 0, m: 1, x: 1, dataBank: 0 });
  t.is(absolute.kind, "instruction");
  if (absolute.kind === "instruction")
    t.is(formatSnes65816SourceInstruction(absolute.instruction), "STA.w INIDISP");

  const indexed = decode([0x9d, 0x00, 0x43], { e: 0, m: 1, x: 1, dataBank: 0 });
  t.is(indexed.kind, "instruction");
  if (indexed.kind === "instruction")
    t.is(formatSnes65816SourceInstruction(indexed.instruction), "STA.w DMAP0,x");
  for (const [bytes, state, expected] of [
    [[0x20, 0x03, 0x42], { dataBank: 0 }, "JSR.w $4203"],
    [[0x8d, 0x00, 0x21], { dataBank: 0x7e }, "STA.w $2100"],
    [[0x8d, 0x00, 0x21], {}, "STA.w $2100"],
  ] as const) {
    const decoded = decode(bytes, state);
    t.is(decoded.kind, "instruction");
    if (decoded.kind === "instruction")
      t.is(formatSnes65816SourceInstruction(decoded.instruction), expected);
  }
});

test("source formatter maps known WRAM references without changing operand width", (t) => {
  const variables = indexSnesRamMap(
    validateSnesRamMap({
      format: "uttori-asm-snes-ram-map",
      schemaVersion: 1,
      variables: [
        {
          name: "RAM_RING_MENU_MODE",
          address: "$7E1847",
          description: "Selects the active ring-menu mode.",
        },
        {
          name: "RAM_GAME_HOURS",
          address: "$7E00F4",
          size: 2,
          description: "Total elapsed whole hours.",
        },
        {
          name: "RAM_CHARACTER_NAME",
          address: "$7ECC00",
          size: 12,
          description: "Character name storage.",
        },
      ],
    }),
  );

  const long = decode([0xaf, 0x47, 0x18, 0x7e]);
  t.is(long.kind, "instruction");
  if (long.kind === "instruction")
    t.is(formatSnes65816SourceInstruction(long.instruction, variables), "LDA.l RAM_RING_MENU_MODE");

  const absolute = decode([0xad, 0x47, 0x18], { dataBank: 0x7e });
  t.is(absolute.kind, "instruction");
  if (absolute.kind === "instruction")
    t.is(
      formatSnes65816SourceInstruction(absolute.instruction, variables),
      "LDA.w RAM_RING_MENU_MODE & $FFFF",
    );

  const direct = decode([0xa5, 0xf4], { directPage: 0 });
  t.is(direct.kind, "instruction");
  if (direct.kind === "instruction")
    t.is(
      formatSnes65816SourceInstruction(direct.instruction, variables),
      "LDA.b RAM_GAME_HOURS & $FF",
    );

  const rangeOffset = decode([0xaf, 0x01, 0xcc, 0x7e]);
  t.is(rangeOffset.kind, "instruction");
  if (rangeOffset.kind === "instruction")
    t.is(
      formatSnes65816SourceInstruction(rangeOffset.instruction, variables),
      "LDA.l (RAM_CHARACTER_NAME + $01)",
    );
});

test("source formatter rebases relative targets from a ROM mirror to the generated source bank", (t) => {
  const mirrored = decoder.decode({
    source: new Uint8ArrayDecoderSource([0xd0, 0xf9]),
    offset: 0,
    logicalAddress: 0x4ffe7a,
    state: { programBank: 0x4f },
  });
  t.is(mirrored.kind, "instruction");
  if (mirrored.kind !== "instruction") return;
  t.is(formatCpu65816Instruction(mirrored.instruction), "BNE $4FFE75");
  t.is(formatSnes65816SourceInstruction(mirrored.instruction, undefined, 0xcffe7a), "BNE $CFFE75");
});

test("65816 decoder reports an out-of-bounds starting offset", (t) => {
  const result = decoder.decode({
    source: new Uint8ArrayDecoderSource([0xea]),
    offset: 1,
    logicalAddress,
  });
  t.like(result, { kind: "error", code: "outOfBounds", availableBytes: 0 });
});

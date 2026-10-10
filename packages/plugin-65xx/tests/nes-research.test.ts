import { Assembler, Uint8ArrayDecoderSource } from "@uttori/asm-core";
import {
  isResearchMapping,
  matchesResearchMapping,
  type ProjectLabel,
} from "@uttori/asm-disassembler";

import { test } from "../../../tests/ava-helper.js";
import {
  create65xxAssemblerEnvironment,
  Cpu6502Decoder,
  formatCpu6502Instruction,
  NesCartridge,
  ricoh2a03Cpu,
} from "../src/index.js";
import { analyzeNes } from "../src/nes/analysis.js";
import { nesHardwareOperand, nesHardwareSource } from "../src/nes/hardware.js";
import { nesResearchInputs, nesResearchMapper } from "../src/nes/research.js";

/** Two switched banks share a bus PC but jump through an unknown RAM pointer. */
function fixture(): NesCartridge {
  const bytes = new Uint8Array(16 + 131072).fill(2);
  bytes.fill(0, 0, 16);
  bytes.set([0x4e, 0x45, 0x53, 0x1a, 8, 0, 0x40]);
  for (const bank of [2, 3]) {
    bytes.set([0x6c, 0, 3], 16 + bank * 8192);
    bytes[16 + bank * 8192 + 0x100] = 0x60;
    bytes[16 + bank * 8192 + 0x200] = 0x60;
  }
  for (const vector of [0x1fffa, 0x1fffc, 0x1fffe]) {
    bytes.set([0, 0xe1], 16 + vector);
  }
  return new NesCartridge(bytes);
}

test("bank-qualified indirect targets and classifications cannot cross the same CPU PC", (t) => {
  const rom = fixture();
  const seeds = [2, 3].map((r6) => ({
    id: `seed-${r6}`,
    kind: "manual" as const,
    address: 0x8000,
    state: {
      a: null,
      x: null,
      y: null,
      mapper: nesResearchMapper({ state: { prgMode: 0, r6, r7: 4 } }),
    },
    evidence: ["manual"],
  }));
  const overrides = [2, 3].map((r6) => ({
    id: `target-${r6}`,
    address: 0x8000,
    mapping: { fileOffset: r6 * 8192, state: { r6 } },
    targets: [r6 === 2 ? 0x8100 : 0x8200],
    evidence: ["manual"],
  }));
  const result = analyzeNes(rom, { seeds, targetOverrides: overrides });
  const offsets = new Set(result.nodes.map((node) => node.fileOffset));
  t.true(offsets.has(2 * 8192 + 0x100));
  t.true(offsets.has(3 * 8192 + 0x200));
  t.false(offsets.has(2 * 8192 + 0x200));
  t.false(offsets.has(3 * 8192 + 0x100));
  const blocked = analyzeNes(rom, {
    seeds,
    targetOverrides: overrides,
    annotations: [
      {
        id: "data",
        addressSpace: "nes.cpu",
        start: 0x8001,
        end: 0x8002,
        classification: "data8",
        architecture: "65xx.2a03",
        mapping: { state: { r6: 2 } },
        evidence: ["manual"],
      },
    ],
  });
  t.false(blocked.nodes.some((node) => node.fileOffset === 2 * 8192));
  t.true(blocked.nodes.some((node) => node.fileOffset === 3 * 8192));
  t.throws(
    () =>
      analyzeNes(rom, {
        seeds,
        targetOverrides: [
          ...overrides,
          { id: "ambiguous", address: 0x8000, targets: [0x8100], evidence: [] },
        ],
      }),
    { message: /Multiple target overrides match/ },
  );
});

test("research seed selectors reject bare PCs, unknown banks and misspelled mapper registers", (t) => {
  const rom = fixture();
  const label: ProjectLabel = {
    id: "bank2",
    name: "Bank2",
    addressSpace: "nes.cpu",
    address: 0x8000,
    evidence: [],
  };
  const view = { labels: [label], comments: [], annotations: [], analysis: [], regions: [] };
  t.throws(() => nesResearchInputs(rom, view), { message: /requires a mapping/ });
  t.throws(
    () =>
      nesResearchInputs(rom, { ...view, labels: [{ ...label, mapping: { fileOffset: 16384 } }] }),
    { message: /enough mapper state/ },
  );
  t.throws(() => nesResearchMapper({ state: { prgmode: 0 } }), { message: /mapper register/ });
  const selected = nesResearchInputs(rom, {
    ...view,
    labels: [{ ...label, mapping: { fileOffset: 16384, state: { prgMode: 0, r6: 2 } } }],
  });
  t.is(selected.seeds[0].state.mapper.banks[7], null);
  t.false(isResearchMapping({ state: {} }));
  t.false(isResearchMapping({ physicalOffset: 0 }));
  t.true(
    matchesResearchMapping(
      { fileOffset: 20, state: { r6: 2 } },
      { fileOffset: 22, state: { r6: 2 } },
      2,
    ),
  );
  t.false(matchesResearchMapping({ state: { r6: 2 } }, { state: { r6: null } }));
});

test("NES direction-sensitive hardware operands preserve every tested encoded address", async (t) => {
  const environment = await create65xxAssemblerEnvironment();
  const decoder = new Cpu6502Decoder(ricoh2a03Cpu);
  for (const [opcode, address, expected] of [
    [0x8d, 0x2000, "PPUCTRL"],
    [0xad, 0x2002, "PPUSTATUS"],
    [0xad, 0x4017, "JOY2"],
    [0x8d, 0x4017, "APU_FRAME"],
    [0x8d, 0x3ff8, "PPUCTRL + $1FF8"],
    [0x8d, 0x9fff, "MMC3_DATA + $1FFE"],
    [0xad, 0x8000, undefined],
    [0x4c, 0x8000, undefined],
    [0xbd, 0x2000, undefined],
    [0xee, 0x2000, undefined],
  ] as const) {
    const bytes = Uint8Array.from([opcode, address & 255, address >>> 8]);
    const result = decoder.decode({
      source: new Uint8ArrayDecoderSource(bytes),
      offset: 0,
      logicalAddress: 0x8000,
    });
    if (result.kind !== "instruction") {
      throw new Error("Fixture decode failed");
    }
    const symbol = nesHardwareOperand(result.instruction, 4);
    t.is(symbol, expected);
    const assembler = new Assembler({
      environment,
      target: "65xx.ca65-raw",
      architecture: "65xx.2a03",
      targetOptions: { origin: 0x8000 },
    });
    try {
      assembler.assembleSource(
        nesHardwareSource(4) + formatCpu6502Instruction(result.instruction, symbol),
        "hardware.asm",
      );
      t.deepEqual(assembler.getBinaryOutput(), bytes);
    } finally {
      assembler.dispose();
    }
  }
});

test("research operand names preserve forward symbols, indexed bases and encoded widths", async (t) => {
  const environment = await create65xxAssemblerEnvironment();
  const decoder = new Cpu6502Decoder(ricoh2a03Cpu);
  for (const bytes of [
    [0x85, 0xb8],
    [0x95, 0xb8],
    [0x96, 0xb8],
    [0x9d, 0xb8, 0],
    [0xb9, 0x40, 0x05],
    [0x3e, 0x40, 0x05],
    [0x6c, 0x40, 0x05],
    [0xa1, 0xb8],
    [0xb1, 0xb8],
  ]) {
    const result = decoder.decode({
      source: new Uint8ArrayDecoderSource(Uint8Array.from(bytes)),
      offset: 0,
      logicalAddress: 0x8000,
    });
    if (result.kind !== "instruction") {
      throw new Error("Fixture decode failed");
    }
    const text = formatCpu6502Instruction(result.instruction, "ResearchOperand");
    t.true(text.includes("ResearchOperand"));
    const value = bytes[1] | ((bytes[2] ?? 0) << 8);
    const assembler = new Assembler({
      environment,
      target: "65xx.ca65-raw",
      architecture: "65xx.2a03",
      targetOptions: { origin: 0x8000 },
    });
    try {
      // Forward equates exercise layout before resolution; a zero-page name must not widen to absolute.
      assembler.assembleSource(
        `${text}\n.export ResearchOperand\nResearchOperand = $${value.toString(16)}\n`,
        "research.asm",
      );
      t.deepEqual(assembler.getBinaryOutput(), Uint8Array.from(bytes));
    } finally {
      assembler.dispose();
    }
  }
});

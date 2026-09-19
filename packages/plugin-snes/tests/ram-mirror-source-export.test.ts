import { Uint8ArrayDecoderSource } from "@uttori/asm-core";

import { test } from "../../../tests/ava-helper.js";
import { Assembler } from "../../../tests/test-assembler.js";
import { Cpu65816Decoder } from "../src/architectures/65816-decoder.js";
import {
  indexSnesRamMap,
  renderSnesRamDefines,
  validateSnesRamMap,
} from "../src/disassembler/ram-map.js";
import { formatSnes65816SourceInstruction } from "../src/disassembler/source-export.js";

test("named long WRAM operands retain their encoded mirror bank on reassembly", (t) => {
  const variables = indexSnesRamMap(
    validateSnesRamMap({
      format: "uttori-asm-snes-ram-map",
      schemaVersion: 1,
      variables: [
        { name: "RAM_STATE", address: "$7E0100", size: 4, description: "Mirrored state." },
      ],
    }),
  );
  const decoder = new Cpu65816Decoder();
  for (const bank of [0x00, 0x01, 0x3f, 0x80, 0xbf, 0x7e]) {
    for (const opcode of [0x8f, 0xaf, 0xbf]) {
      for (const offset of [0, 1]) {
        const bytes = Uint8Array.of(opcode, offset, 0x01, bank);
        const result = decoder.decode({
          source: new Uint8ArrayDecoderSource(bytes),
          offset: 0,
          logicalAddress: 0x808000,
          state: { e: 0, m: 1, x: 1 },
        });
        t.is(result.kind, "instruction");
        if (result.kind !== "instruction") {continue;}
        const source = formatSnes65816SourceInstruction(result.instruction, variables);
        t.true(source.includes("RAM_STATE"), source);
        const assembler = new Assembler(undefined, { collectSourceMetadata: false });
        assembler.setCurrentFile("ram-mirror.asm");
        const lines = ["lorom", "org $808000", "RAM_STATE = $7E0100", source];
        for (const stage of ["collectDefinitions", "resolveLayout", "emitProgram"] as const) {
          assembler.activateStage(stage);
          for (const [lineNumber, line] of lines.entries()) {
            assembler.setCurrentLine(lineNumber);
            assembler.processCommand(line);
          }
          assembler.finishPass();
        }
        t.deepEqual(assembler.getBinaryOutput(), bytes, source);
      }
    }
  }
});

test("SRAM operands name explicit CPU addresses and reassemble without changing their encoding", (t) => {
  const entries = validateSnesRamMap({
    format: "uttori-asm-snes-ram-map",
    schemaVersion: 1,
    variables: [
      {
        name: "SRAM_RECORD",
        address: "$306000",
        memory: "sram",
        size: 700,
        description: "Save payload.",
      },
      {
        name: "SRAM_LAST_SELECTED_FILE",
        address: "$307FFF",
        memory: "sram",
        description: "Last selected file.",
      },
    ],
  });
  const variables = indexSnesRamMap(entries);
  const decoder = new Cpu65816Decoder();
  for (const bytes of [
    Uint8Array.of(0x8f, 0xff, 0x7f, 0x30),
    Uint8Array.of(0xaf, 0xff, 0x7f, 0x30),
    Uint8Array.of(0xbf, 0x03, 0x60, 0x30),
    Uint8Array.of(0xad, 0xff, 0x7f),
    Uint8Array.of(0x9d, 0x03, 0x60),
    // Cartridge-dependent mirrors remain literal unless explicitly declared.
    Uint8Array.of(0xaf, 0xff, 0x7f, 0xb0),
  ]) {
    const result = decoder.decode({
      source: new Uint8ArrayDecoderSource(bytes),
      offset: 0,
      logicalAddress: 0xc00000,
      state: { e: 0, m: 1, x: 1, dataBank: 0x30 },
    });
    t.is(result.kind, "instruction");
    if (result.kind !== "instruction") {continue;}
    const source = formatSnes65816SourceInstruction(result.instruction, variables);
    if (bytes[3] === 0xb0) {t.false(source.includes("SRAM_"), source);}
    else if (bytes[1] === 0xff) {t.true(source.includes("SRAM_LAST_SELECTED_FILE"), source);}
    else {t.true(source.includes("(SRAM_RECORD + $03)"), source);}
    const assembler = new Assembler(undefined, { collectSourceMetadata: false });
    assembler.setCurrentFile("sram.asm");
    const lines = ["hirom", "org $C00000", ...renderSnesRamDefines(entries).split("\n"), source];
    for (const stage of ["collectDefinitions", "resolveLayout", "emitProgram"] as const) {
      assembler.activateStage(stage);
      for (const [lineNumber, line] of lines.entries()) {
        assembler.setCurrentLine(lineNumber);
        assembler.processCommand(line);
      }
      assembler.finishPass();
    }
    t.deepEqual(assembler.getBinaryOutput(), bytes, source);
  }
});

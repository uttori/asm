import { Uint8ArrayDecoderSource } from "@uttori/asm-core";
import { test } from "../../../tests/ava-helper.js";
import { Assembler } from "../../../tests/test-assembler.js";
import { Cpu65816Decoder } from "../src/architectures/65816-decoder.js";
import { indexSnesRamMap, validateSnesRamMap } from "../src/disassembler/ram-map.js";
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
        if (result.kind !== "instruction") continue;
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

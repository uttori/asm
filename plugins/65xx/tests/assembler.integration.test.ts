import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { test } from "../../../tests/ava-helper.js";

import { Assembler } from "@uttori/asm-core";
import { create65xxAssemblerEnvironment, NES_65XX_TARGET_ID } from "../src/index.js";

const TEST_FILE_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(TEST_FILE_DIR, "../../..");
const ZELDA_DIR = path.resolve(PROJECT_ROOT, "fixtures/integration/zelda1-disassembly");
const ZELDA_SRC_DIR = path.join(ZELDA_DIR, "src");
const ZELDA_CFG_PATH = path.join(ZELDA_SRC_DIR, "Z.cfg");
const ZELDA_BINS_XML_PATH = path.join(ZELDA_SRC_DIR, "bins.xml");
const ZELDA_GOLDEN_PATH = path.join(ZELDA_DIR, "Legend of Zelda_ The (U) (PRG 0).nes");
const ZELDA_BANKS = ["Z_00.asm", "Z_01.asm", "Z_02.asm", "Z_03.asm", "Z_04.asm", "Z_05.asm", "Z_06.asm", "Z_07.asm"];

const environment = await create65xxAssemblerEnvironment();

const hashBuffer = (buffer: Buffer): string => createHash("sha256").update(buffer).digest("hex");

/**
 * Reports the first differing byte between a partial assemble and the golden NES.
 * @param {Buffer} output Assembler image.
 * @param {Buffer} golden Golden iNES image.
 * @returns {string} Human-readable mismatch.
 */
function describeMismatch(output: Buffer, golden: Buffer): string {
  const limit = Math.min(output.length, golden.length);
  const mismatches: string[] = [];
  let total = 0;
  for (let index = 0; index < limit; index++) {
    if (output[index] === golden[index]) continue;
    total++;
    if (mismatches.length >= 8) continue;
    const cpu = index >= 16 ? 0x8000 + ((index - 16) % 0x4000) : -1;
    const bank = index >= 16 ? Math.floor((index - 16) / 0x4000) : -1;
    const slice = (buffer: Buffer) =>
      [...buffer.subarray(index, Math.min(index + 8, buffer.length))]
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join(" ");
    mismatches.push(
      `file+${index} bank=${bank} cpu=$${cpu.toString(16)} got [${slice(output)}] want [${slice(golden)}]`,
    );
  }
  if (mismatches.length === 0 && output.length === golden.length) {
    return "partial output matches golden for its length";
  }
  return `${total} mismatches, first:\n${mismatches.join("\n")}`;
}

/**
 * Mirrors `build.ps1` ExtractBins: copy `[Offset+16, Length)` from the golden NES
 * into a temp tree so `.incbin "dat/….dat"` resolves.
 * @param {Buffer} rom Golden iNES image.
 * @param {string} xmlText `src/bins.xml`.
 * @param {string} binRoot Destination directory (ca65 `--bin-include-dir`).
 * @returns {void}
 */
function extractBins(rom: Buffer, xmlText: string, binRoot: string): void {
  const pattern =
    /<Binary\s+Offset=['"](\d+)['"]\s+Length=['"](\d+)['"]\s+FileName=['"]([^'"]+)['"]\s*\/>/g;
  for (const match of xmlText.matchAll(pattern)) {
    const offset = Number(match[1]) + 16;
    const length = Number(match[2]);
    const relative = match[3].replaceAll("\\", "/");
    const dest = path.join(binRoot, relative);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, rom.subarray(offset, offset + length));
  }
}

/**
 * Assembles Z_00..Z_07 against extracted bins, matching ld65 + iNES header join.
 * @param {Buffer} golden Golden NES image (header + PRG).
 * @returns {Buffer} Assembled iNES image.
 */
function assembleZelda(golden: Buffer): Buffer {
  const binDir = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-zelda-bins-"));
  try {
    extractBins(golden, fs.readFileSync(ZELDA_BINS_XML_PATH, "utf8"), binDir);
    const assembler = new Assembler({
      environment,
      target: NES_65XX_TARGET_ID,
      architecture: "65xx.6502",
      targetOptions: {
        linkerConfig: fs.readFileSync(ZELDA_CFG_PATH, "utf8"),
        header: [...golden.subarray(0, 16)],
        fillByte: 0xff,
      },
      collectSourceMetadata: false,
    });
    try {
      assembler.setIncludePaths([ZELDA_SRC_DIR, binDir]);
      const driverPath = path.join(ZELDA_SRC_DIR, "_uttori_driver.asm");
      assembler.setCurrentFile(driverPath);
      const source = ZELDA_BANKS.map((name) => `.include "${name}"`).join("\n");
      try {
        assembler.assembleSource(source, driverPath);
      } catch (error) {
        const partial = Buffer.from(assembler.getBinaryOutput());
        const mismatch = describeMismatch(partial, golden);
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`${message}\n${mismatch}`);
      }
      return Buffer.from(assembler.getBinaryOutput());
    } finally {
      assembler.dispose();
    }
  } finally {
    fs.rmSync(binDir, { recursive: true, force: true });
  }
}

test.serial("integration Zelda 1 ca65 disassembly matches golden iNES PRG 0", (t) => {
  t.timeout(30 * 60_000);
  if (!fs.existsSync(ZELDA_GOLDEN_PATH)) {
    t.skip();
    return;
  }
  const golden = fs.readFileSync(ZELDA_GOLDEN_PATH);
  t.is(golden.length, 16 + 8 * 0x4000, "iNES header + 128 KiB PRG");
  const output = assembleZelda(golden);
  t.is(output.length, golden.length);
  if (hashBuffer(output) !== hashBuffer(golden)) {
    t.fail(describeMismatch(output, golden));
  }
});

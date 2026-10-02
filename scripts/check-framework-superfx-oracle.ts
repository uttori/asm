import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { superFxBaseSpecifications } from "../packages/plugin-snes/src/architectures/superfx-spec.js";

const oraclePath = path.resolve("fixtures/external/snes-rom-framework/Extras/SuperFXASMDis.asm");
if (!fs.existsSync(oraclePath)) {
  console.log(`Optional SNES-ROM-Framework SuperFX oracle is not installed: ${oraclePath}`);
  process.exit(0);
}

const oracleSource = fs.readFileSync(oraclePath, "utf8");
const observed = new Map<number, string>();
const macroPattern = /macro\s+Op(\d+)\(\)([\S\s]*?)endmacro/g;
for (const match of oracleSource.matchAll(macroPattern)) {
  const opcode = Number(match[1]);
  const mnemonic = match[2]?.match(/print\s+"\s*([a-z][\da-z]*)/i)?.[1]?.toUpperCase();
  if (Number.isInteger(opcode) && mnemonic) {
    observed.set(opcode, mnemonic);
  }
}

const sourceMnemonicAgrees = (
  opcode: number,
  expected: string,
  actual: string | undefined,
): boolean =>
  actual === expected ||
  (opcode >= 0x20 && opcode <= 0x2f && expected === "WITH" && actual === "MOVE") ||
  (opcode === 0x3e && expected === "ALT2" && actual === "ADD") ||
  (opcode === 0x3f && expected === "ALT3" && actual === "ADC");

const sourceMismatches = superFxBaseSpecifications.flatMap((entry) => {
  const opcode = entry.opcode[0];
  const actual = observed.get(opcode);
  return sourceMnemonicAgrees(opcode, entry.mnemonic, actual)
    ? []
    : [
        `$${opcode.toString(16).toUpperCase().padStart(2, "0")}: table=${entry.mnemonic}, framework=${actual ?? "missing"}`,
      ];
});
if (sourceMismatches.length > 0) {
  throw new Error(
    `SNES-ROM-Framework SuperFX source oracle mismatches:\n${sourceMismatches.join("\n")}`,
  );
}

const cases: readonly { readonly mnemonic: string; readonly bytes: readonly number[] }[] = [
  { mnemonic: "NOP", bytes: [0x01] },
  { mnemonic: "BRA", bytes: [0x05, 0x00] },
  { mnemonic: "TO", bytes: [0x10] },
  { mnemonic: "WITH", bytes: [0x20] },
  { mnemonic: "STW", bytes: [0x30] },
  { mnemonic: "LDW", bytes: [0x40] },
  { mnemonic: "ADD", bytes: [0x50] },
  { mnemonic: "SUB", bytes: [0x60] },
  { mnemonic: "MERGE", bytes: [0x70] },
  { mnemonic: "MULT", bytes: [0x80] },
  { mnemonic: "SBK", bytes: [0x90] },
  { mnemonic: "LINK", bytes: [0x91] },
  { mnemonic: "JMP", bytes: [0x98] },
  { mnemonic: "IBT", bytes: [0xa0, 0x00] },
  { mnemonic: "FROM", bytes: [0xb0] },
  { mnemonic: "HIB", bytes: [0xc0] },
  { mnemonic: "OR", bytes: [0xc1] },
  { mnemonic: "INC", bytes: [0xd0] },
  { mnemonic: "GETC", bytes: [0xdf] },
  { mnemonic: "DEC", bytes: [0xe0] },
  { mnemonic: "GETB", bytes: [0xef] },
  { mnemonic: "IWT", bytes: [0xf0, 0x00, 0x00] },
  { mnemonic: "STB", bytes: [0x3d, 0x30] },
  { mnemonic: "LDB", bytes: [0x3d, 0x40] },
  { mnemonic: "RPIX", bytes: [0x3d, 0x4c] },
  { mnemonic: "CMODE", bytes: [0x3d, 0x4e] },
  { mnemonic: "ADC", bytes: [0x3d, 0x50] },
  { mnemonic: "SBC", bytes: [0x3d, 0x60] },
  { mnemonic: "BIC", bytes: [0x3d, 0x71] },
  { mnemonic: "UMULT", bytes: [0x3d, 0x80] },
  { mnemonic: "DIV2", bytes: [0x3d, 0x96] },
  { mnemonic: "LJMP", bytes: [0x3d, 0x98] },
  { mnemonic: "LMULT", bytes: [0x3d, 0x9f] },
  { mnemonic: "LMS", bytes: [0x3d, 0xa0, 0x00] },
  { mnemonic: "XOR", bytes: [0x3d, 0xc1] },
  { mnemonic: "GETBH", bytes: [0x3d, 0xef] },
  { mnemonic: "LM", bytes: [0x3d, 0xf0, 0x00, 0x00] },
  { mnemonic: "ADD", bytes: [0x3e, 0x50] },
  { mnemonic: "SUB", bytes: [0x3e, 0x60] },
  { mnemonic: "AND", bytes: [0x3e, 0x71] },
  { mnemonic: "MULT", bytes: [0x3e, 0x80] },
  { mnemonic: "SMS", bytes: [0x3e, 0xa0, 0x00] },
  { mnemonic: "OR", bytes: [0x3e, 0xc1] },
  { mnemonic: "RAMB", bytes: [0x3e, 0xdf] },
  { mnemonic: "GETBL", bytes: [0x3e, 0xef] },
  { mnemonic: "SM", bytes: [0x3e, 0xf0, 0x00, 0x00] },
  { mnemonic: "ADC", bytes: [0x3f, 0x50] },
  { mnemonic: "CMP", bytes: [0x3f, 0x60] },
  { mnemonic: "BIC", bytes: [0x3f, 0x71] },
  { mnemonic: "UMULT", bytes: [0x3f, 0x80] },
  { mnemonic: "XOR", bytes: [0x3f, 0xc1] },
  { mnemonic: "ROMB", bytes: [0x3f, 0xdf] },
  { mnemonic: "GETBS", bytes: [0x3f, 0xef] },
];

/** `encoding: "utf8"` types child streams as string; a failed spawn still returns null. */
function spawnStreamText(text: unknown): string | null {
  return typeof text === "string" ? text : null;
}

const executable = process.env.ASAR_PATH ?? "asar";
const versionResult = spawnSync(executable, ["--version"], { encoding: "utf8" });
const versionText =
  `${spawnStreamText(versionResult.stdout) ?? ""}\n${spawnStreamText(versionResult.stderr) ?? ""}`.trim();
const executableAvailable =
  versionResult.status === 0 && /(?:^|\s)asar\s+[12]\./i.test(versionText);
if (!executableAvailable) {
  const reason =
    versionResult.error && "code" in versionResult.error && versionResult.error.code === "ENOENT"
      ? "is unavailable"
      : `is not the SNES Asar executable${versionText ? ` (${versionText})` : ""}`;
  console.log(
    `SNES-ROM-Framework source agrees on all ${observed.size} SuperFX opcode mnemonics. Executable oracle skipped because '${executable}' ${reason}.`,
  );
  process.exit(0);
}

const payload = Uint8Array.from(cases.flatMap((entry) => entry.bytes));
const romBytes = new Uint8Array(0x8000);
romBytes.set(payload);
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-framework-superfx-"));
try {
  const patchedOracle = oracleSource
    .replace(/!romoffset\s*=\s*\$[\da-f]+/i, "!ROMOffset = $008000")
    .replace(/!bank\s*=\s*[\da-f]+/i, "!Bank = 00")
    .replace(/!dotwopassesflag\s*=\s*\d+/i, "!DoTwoPassesFlag = 0")
    .replace(/!maxbytes\s*=\s*\d+/i, `!MaxBytes = ${payload.length}`);
  const oracleCopy = path.join(temporary, "SuperFXASMDis.asm");
  const romPath = path.join(temporary, "oracle.sfc");
  fs.writeFileSync(oracleCopy, patchedOracle);
  fs.writeFileSync(romPath, romBytes);
  const result = spawnSync(executable, ["--no-title-check", oracleCopy, romPath], {
    encoding: "utf8",
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(
      `SNES-ROM-Framework SuperFX executable oracle failed (${result.status ?? "signal"}):\n${result.stderr || result.stdout}`,
    );
  }
  const executed = result.stdout
    .replaceAll("\r", "")
    .split("\n")
    .map((line) => /^\s+([A-Z][\dA-Z]*)(?:\s|$)/.exec(line)?.[1])
    .filter((mnemonic): mnemonic is string => mnemonic !== undefined);
  const expected = cases.map((entry) => entry.mnemonic);
  if (JSON.stringify(executed) !== JSON.stringify(expected)) {
    throw new Error(
      `SNES-ROM-Framework SuperFX executable mismatch.\nExpected: ${expected.join(" ")}\nActual:   ${executed.join(" ")}\n${result.stdout}`,
    );
  }
  console.log(
    `SNES-ROM-Framework oracle agrees on all ${observed.size} SuperFX opcode mnemonics and ${cases.length} executable base/ALT families through Asar.`,
  );
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}

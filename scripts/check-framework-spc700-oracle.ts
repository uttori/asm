import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { RomImage } from "@uttori/asm-disassembler";

import { spc700Specifications } from "../packages/plugin-snes/src/architectures/spc700-spec.js";
import { parseSpc700UploadStream } from "../packages/plugin-snes/src/disassembler/spc700-upload.js";

const oraclePath = path.resolve("fixtures/external/snes-rom-framework/Extras/SPC700ASMDis.asm");
if (!fs.existsSync(oraclePath)) {
  console.log(`Optional SNES-ROM-Framework SPC700 oracle is not installed: ${oraclePath}`);
  process.exit(0);
}

const oracleSource = fs.readFileSync(oraclePath, "utf8");
const dynamicBitMnemonicBase: Readonly<Record<number, string>> = {
  0x0a: "OR",
  0x2a: "OR",
  0x4a: "AND",
  0x6a: "AND",
  0x8a: "EOR",
  0xaa: "MOV",
  0xca: "MOV",
  0xea: "NOT",
};
const mnemonicAgrees = (opcode: number, mnemonic: string | undefined): boolean => {
  const expected = spc700Specifications[opcode]?.mnemonic;
  if (mnemonic === expected) {
    return true;
  }
  const base = dynamicBitMnemonicBase[opcode];
  if (base === undefined || mnemonic === undefined) {
    return false;
  }
  return (
    mnemonic === base ||
    (mnemonic.startsWith(base) &&
      mnemonic.length === base.length + 1 &&
      "01234567".includes(mnemonic.at(-1) ?? ""))
  );
};
const observed = new Map<number, string>();
const macroPattern = /macro\s+Op(\d+)\(\)([\S\s]*?)endmacro/g;
for (const match of oracleSource.matchAll(macroPattern)) {
  const opcode = Number(match[1]);
  const mnemonic = match[2]?.match(/print\s+"\s*([a-z][\da-z]*)(?:\.[blw])?/i)?.[1]?.toUpperCase();
  if (Number.isInteger(opcode) && mnemonic) {
    observed.set(opcode, mnemonic);
  }
}

const mismatches: string[] = [];
for (const specification of spc700Specifications) {
  const opcode = specification.opcode[0];
  const mnemonic = observed.get(opcode);
  if (!mnemonicAgrees(opcode, mnemonic)) {
    mismatches.push(
      `$${opcode.toString(16).toUpperCase().padStart(2, "0")}: table=${specification.mnemonic}, framework=${mnemonic ?? "missing"}`,
    );
  }
}
if (mismatches.length > 0) {
  throw new Error(`SNES-ROM-Framework SPC700 oracle mismatches:\n${mismatches.join("\n")}`);
}

const payload = Uint8Array.from(
  spc700Specifications.flatMap((specification) => [
    specification.opcode[0],
    ...Array.from({ length: specification.minimumSize - 1 }, () => 0),
  ]),
);
const upload = new Uint8Array(4 + payload.length + 4);
upload[0] = payload.length & 0xff;
upload[1] = payload.length >>> 8;
upload[2] = 0x00;
upload[3] = 0x02;
upload.set(payload, 4);
upload[upload.length - 4] = 0;
upload[upload.length - 3] = 0;
upload[upload.length - 2] = 0;
upload[upload.length - 1] = 2;

const romBytes = new Uint8Array(0x8000);
romBytes.set(upload);
const parsed = parseSpc700UploadStream(new RomImage(romBytes, { headerSize: 0 }), 0);
if (
  parsed.blocks.length !== 1 ||
  parsed.blocks[0]?.size !== payload.length ||
  parsed.blocks[0]?.destination !== 0x0200 ||
  parsed.executeAddress !== 0x0200 ||
  parsed.endOffset !== upload.length
) {
  throw new Error("Synthetic SPC700 upload stream did not round-trip through the native parser.");
}

const executable = process.env.ASAR_PATH ?? "asar";
const versionResult = spawnSync(executable, ["--version"], { encoding: "utf8" });
const versionText = `${versionResult.stdout ?? ""}\n${versionResult.stderr ?? ""}`.trim();
const executableAvailable =
  versionResult.status === 0 && /(?:^|\s)asar\s+[12]\./i.test(versionText);
if (!executableAvailable) {
  const reason =
    versionResult.error && "code" in versionResult.error && versionResult.error.code === "ENOENT"
      ? "is unavailable"
      : `is not the SNES Asar executable${versionText ? ` (${versionText})` : ""}`;
  console.log(
    `SNES-ROM-Framework source agrees on all ${observed.size} SPC700 opcode mnemonics and the native parser accepted the bounded synthetic NSPC stream. Executable oracle skipped because '${executable}' ${reason}.`,
  );
  process.exit(0);
}

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-framework-spc700-"));
try {
  const patchedOracle = oracleSource
    .replace(/!romoffset\s*=\s*\$[\da-f]+/i, "!ROMOffset = $008000")
    .replace(/!maxbytes\s*=\s*\d+/i, "!MaxBytes = 16384");
  const oracleCopy = path.join(temporary, "SPC700ASMDis.asm");
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
      `SNES-ROM-Framework SPC700 executable oracle failed (${result.status ?? "signal"}):\n${result.stderr || result.stdout}`,
    );
  }
  const executed = result.stdout
    .replaceAll("\r", "")
    .split("\n")
    .map((line) => /^\s+([A-Z][\dA-Z]*)(?:\.[blw])?(?:\s|$)/.exec(line)?.[1])
    .filter((mnemonic): mnemonic is string => mnemonic !== undefined);
  const expected = spc700Specifications.map((specification) => specification.mnemonic);
  if (executed.length !== expected.length) {
    throw new Error(
      `SNES-ROM-Framework SPC700 executable oracle emitted ${executed.length} instructions. Expected ${expected.length}.\n${result.stdout}`,
    );
  }
  const executionMismatches = executed.flatMap((mnemonic, opcode) =>
    mnemonicAgrees(opcode, mnemonic)
      ? []
      : [
          `$${opcode.toString(16).toUpperCase().padStart(2, "0")}: table=${expected[opcode]}, framework=${mnemonic}`,
        ],
  );
  if (executionMismatches.length > 0) {
    throw new Error(
      `SNES-ROM-Framework SPC700 executable mismatches:\n${executionMismatches.join("\n")}`,
    );
  }
  console.log(
    `SNES-ROM-Framework oracle agrees on all ${observed.size} SPC700 opcode mnemonics and decoded the bounded synthetic NSPC stream through Asar.`,
  );
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}

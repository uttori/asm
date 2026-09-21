import fs from "node:fs";
import path from "node:path";

import { cpu65816Specifications } from "../packages/plugin-snes/src/architectures/65816-spec.js";

const oraclePath = path.resolve("fixtures/external/snes-rom-framework/Extras/SNESASMDis.asm");
if (!fs.existsSync(oraclePath)) {
  console.log(`Optional SNES-ROM-Framework oracle is not installed: ${oraclePath}`);
  process.exit(0);
}

const source = fs.readFileSync(oraclePath, "utf8");
const observed = new Map<number, string>();
const macroPattern = /macro\s+Op(\d+)\(\)([\S\s]*?)endmacro/g;
for (const match of source.matchAll(macroPattern)) {
  const opcode = Number(match[1]);
  const mnemonic = match[2]?.match(/print\s+"\s*([a-z]{2,4})(?:\.[blw])?/i)?.[1]?.toUpperCase();
  if (Number.isInteger(opcode) && mnemonic) {
    observed.set(opcode, mnemonic);
  }
}

const mismatches: string[] = [];
for (const specification of cpu65816Specifications) {
  const opcode = specification.opcode[0];
  const mnemonic = observed.get(opcode);
  // The Framework prints WDC's `JMP [abs]`. This project canonically retains
  // its established `JML [abs]` alias for opcode $DC.
  const acceptedAlias = opcode === 0xdc && mnemonic === "JMP" && specification.mnemonic === "JML";
  if (mnemonic !== specification.mnemonic && !acceptedAlias) {
    mismatches.push(
      `$${opcode.toString(16).toUpperCase().padStart(2, "0")}: table=${specification.mnemonic}, framework=${mnemonic ?? "missing"}`,
    );
  }
}

if (mismatches.length > 0) {
  throw new Error(`SNES-ROM-Framework 65816 oracle mismatches:\n${mismatches.join("\n")}`);
}
console.log(`SNES-ROM-Framework oracle agrees on all ${observed.size} 65816 opcode mnemonics.`);

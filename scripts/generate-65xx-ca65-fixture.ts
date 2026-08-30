import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  cmos65c02Forms,
  cmos65sc02Forms,
  commodore4510Forms,
  csg65ce02Forms,
  hudsonHuC6280Forms,
  mega65Gs02Forms,
  mitsubishiM740Forms,
  mos6502DtvForms,
  wdc65c02Forms,
} from "../plugins/65xx/src/instructions/variants.js";
import type { InstructionForm } from "../plugins/65xx/src/instructions/schema.js";

const ca65 = process.argv[2];
const ld65 = process.argv[3];
const output = process.argv[4];
const scope = process.argv[5] ?? "phase4-5";
if (!ca65 || !ld65 || !output) {
  throw new Error(
    "Usage: generate-65xx-ca65-fixture.ts <ca65> <ld65> <output.json> [phase4-5|phase6]",
  );
}

const phase45Variants = [
  ["6502DTV", mos6502DtvForms],
  ["65SC02", cmos65sc02Forms],
  ["65C02", cmos65c02Forms],
  ["W65C02", wdc65c02Forms],
  ["65CE02", csg65ce02Forms],
  ["4510", commodore4510Forms],
  ["45GS02", mega65Gs02Forms],
] as const;
const phase6Variants = [
  ["HuC6280", hudsonHuC6280Forms],
  ["M740", mitsubishiM740Forms],
] as const;
const variants = scope === "phase6" ? phase6Variants : phase45Variants;
if (scope !== "phase4-5" && scope !== "phase6") {
  throw new Error(`Unknown fixture scope '${scope}'.`);
}

function sourceFor(form: InstructionForm, endLabel: string): string {
  const operand = (() => {
    switch (form.mode) {
      case "implied":
        return "";
      case "accumulator":
        return "A";
      case "quadAccumulator":
        return "Q";
      case "immediate":
        return form.codec === "unsigned16-le"
          ? "#$1234"
          : form.operandConstraint === "power-of-two"
            ? "#$10"
            : "#$12";
      case "zeroPage":
        return "$12";
      case "zeroPageIndexedX":
        return "$12,x";
      case "zeroPageIndexedY":
        return "$12,y";
      case "absolute":
        return "$1234";
      case "absoluteIndexedX":
        return "$1234,x";
      case "absoluteIndexedY":
        return "$1234,y";
      case "absoluteLongIndexedX":
        return "$123456,x";
      case "indirect":
        return "($1234)";
      case "zeroPageIndirect":
        return "($12)";
      case "zeroPageIndirectLong":
        return "[$12]";
      case "indexedIndirectX":
        return "($12,x)";
      case "indirectIndexedY":
        return "($12),y";
      case "absoluteIndexedIndirect":
        return "($1234,x)";
      case "zeroPageIndirectIndexedZ":
        return "($12),z";
      case "stackRelative":
        return "$12,s";
      case "stackRelativeIndirectIndexedY":
        return "($12,s),y";
      case "relative":
      case "relative16":
        return endLabel;
      case "zeroPageRelative":
        return `$12,${endLabel}`;
      case "accumulatorRelative":
        return `A,${endLabel}`;
      case "zeroPageImmediate":
        return "$12,#$34";
      case "specialPage":
        return "$FF12";
      case "blockTransfer":
        return "$1234,$5678,$0003";
      case "immediateZeroPage":
        return "#$12,$34";
      case "immediateZeroPageIndexedX":
        return "#$12,$34,x";
      case "immediateAbsolute":
        return "#$12,$3456";
      case "immediateAbsoluteIndexedX":
        return "#$12,$3456,x";
      case "basePageIndirectIndexedZ":
        return "[$12],z";
    }
  })();
  return `  ${form.mnemonic}${operand ? ` ${operand}` : ""}`;
}

function sizeOf(form: InstructionForm): number {
  return form.encoding.length + form.operands.reduce((sum, operand) => sum + operand.width, 0);
}

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-65xx-ca65-"));
const fixtureVariants = [];
try {
  for (const [cpu, forms] of variants) {
    const lines = [`.setcpu "${cpu}"`, '.segment "CODE"'];
    for (const [index, form] of forms.entries()) {
      const endLabel = `case_${index}_end`;
      lines.push(`case_${index}:`, sourceFor(form, endLabel), `${endLabel}:`);
    }
    const sourcePath = path.join(temporary, `${cpu}.s`);
    const objectPath = path.join(temporary, `${cpu}.o`);
    const binaryPath = path.join(temporary, `${cpu}.bin`);
    fs.writeFileSync(sourcePath, `${lines.join("\n")}\n`);
    execFileSync(ca65, ["-o", objectPath, sourcePath], { stdio: "pipe" });
    execFileSync(ld65, ["-t", "none", "-o", binaryPath, objectPath], { stdio: "pipe" });
    const binary = fs.readFileSync(binaryPath);
    const cases = [];
    let offset = 0;
    for (const [index, form] of forms.entries()) {
      const size = sizeOf(form);
      const bytes = [...binary.subarray(offset, offset + size)];
      if (bytes.length !== size) throw new Error(`${cpu} fixture ended during case ${index}.`);
      cases.push({
        mnemonic: form.mnemonic,
        mode: form.mode,
        source: `${sourceFor(form, `case_${index}_end`).trim()}\ncase_${index}_end:`,
        bytes,
      });
      offset += size;
    }
    if (offset !== binary.length) {
      throw new Error(`${cpu} expected ${offset} bytes but ca65 emitted ${binary.length}.`);
    }
    fixtureVariants.push({
      cpu,
      sha256: crypto.createHash("sha256").update(binary).digest("hex"),
      cases,
    });
  }
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}

fs.writeFileSync(
  output,
  `${JSON.stringify(
    {
      oracle: {
        release: "V2.19",
        commit: "e11fb5c39371046ebe25485f984f644c5a0d65d3",
        instructionTableSha256: "bcd36f022a3534355285346d6a4149563a21f17c72b614d91e381d19d68e5a9d",
      },
      variants: fixtureVariants,
    },
    null,
    2,
  )}\n`,
);

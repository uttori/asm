import type { ParsedInstructionOperands, OperandScalar } from "@uttori/asm-core";
import { parseInstructionOperands } from "@uttori/asm-core/plugin";

import {
  expansionPlan,
  operandParts,
  operandScalarSyntax,
  type ExpansionPlan,
} from "./operand-plans.js";

/** Source-only register recognition and numeric slots; no execution method parses these spellings. */
export interface SuperFxOperand {
  /** Hardware register index when the part names `r0`–`r15`, otherwise null. */
  readonly register: number | null;
  /** Register inside `(rN)` indirect form; null for non-indirect parts. */
  readonly indirectRegister: number | null;
  /** True when the part begins with `#` immediate syntax. */
  readonly immediate: boolean;
  /** True when the part is wrapped in parentheses as an indirect address. */
  readonly indirect: boolean;
  /** Exactly two hex digits denote an encoded displacement; other forms denote a target. */
  readonly rawOffset: boolean;
  /** Evaluated expression scalar for the stripped operand body. */
  readonly scalar: OperandScalar;
  /** Source text of the operand body after prefix stripping. */
  readonly display: string;
  /** Width and evaluation schedule compiled from the authored part text. */
  readonly expansion: ExpansionPlan;
}
/** Portable target grammar and ordered numeric observation plans. */
export interface SuperFxSyntax extends ParsedInstructionOperands {
  /** Parsed Super FX operand bundle carried through preparation and encoding. */
  readonly superfx: {
    /** Discriminator for portable Super FX operand payloads. */
    readonly kind: "superfx-v2";
    /** Uppercased mnemonic after alias normalization. */
    readonly mnemonic: string;
    /** Comma-separated operand parts in source order. */
    readonly parts: readonly SuperFxOperand[];
    /** Whole-operand expansion plan spanning the full text. */
    readonly whole: ExpansionPlan;
  };
}
/** Preserve leading-zero register aliases while rejecting values beyond the hardware register file. */
function register(text: string): number | null {
  const match = /^r(\d{1,2})$/i.exec(text);
  if (!match) {
    return null;
  }
  const value = Number(match[1]);
  return value <= 15 ? value : null;
}
/** Compile register, address-unit and branch-spelling distinctions once at the source boundary. */
export function parseSuperFxOperands(mnemonic: string, text: string): SuperFxSyntax {
  const common = parseInstructionOperands(mnemonic, text, {
    registers: Array.from({ length: 16 }, (_, i) => `r${i}`),
    indexRegisters: [],
    commaIndex: false,
  });
  const parts = operandParts(text).map((part) => {
    const immediate = part.text.startsWith("#");
    const indirect = part.text.startsWith("(") && part.text.endsWith(")");
    let body = part.text;
    if (immediate) {
      body = body.slice(1).trim();
    } else if (indirect) {
      body = body.slice(1, -1).trim();
    }
    return {
      register: register(part.text),
      indirectRegister: indirect ? register(body) : null,
      immediate,
      indirect,
      rawOffset: /^\$[\da-f]{2}$/i.test(part.text),
      scalar: operandScalarSyntax(body, part.start + part.text.indexOf(body)),
      display: body,
      expansion: expansionPlan(part.text, part.start),
    };
  });
  return {
    ...common,
    superfx: {
      kind: "superfx-v2",
      mnemonic: mnemonic.toUpperCase(),
      parts,
      whole: expansionPlan(text, 0),
    },
  };
}
/** Syntax tags are checked at the public typed boundary, including after portable copies. */
export function superFxSyntax(value: ParsedInstructionOperands): SuperFxSyntax {
  if (!hasPolicy(value)) {
    throw new Error("SuperFX encoder requires its registered operand grammar.");
  }
  return value;
}

/** Identify this parser's portable payload before entering the execution boundary. */
function hasPolicy(value: ParsedInstructionOperands): value is SuperFxSyntax {
  return (
    "superfx" in value &&
    typeof value.superfx === "object" &&
    value.superfx !== null &&
    "kind" in value.superfx &&
    value.superfx.kind === "superfx-v2"
  );
}

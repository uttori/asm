import type { ParsedInstructionOperands, OperandScalar, ParsedOperand } from "@uttori/asm-core";
import { parseInstructionOperands } from "@uttori/asm-core/plugin";

import {
  expansionPlan,
  operandParts,
  operandScalarSyntax,
  type ExpansionPlan,
} from "./operand-plans.js";

/** Lexical facts retained separately from stage-local values and processor flags. */
export interface Syntax65816 extends ParsedInstructionOperands {
  readonly cpu65816: {
    readonly kind: "cpu65816-v2";
    readonly mnemonic: string;
    readonly width?: number;
    readonly suffixError?: string;
    readonly whole: ExpansionPlan;
    readonly parts: readonly ExpansionPlan[];
    readonly scalar: OperandScalar;
    readonly wholeScalar: OperandScalar;
    readonly display: string;
    readonly original: string;
    readonly innerDisplay: string;
    readonly shape?: ParsedOperand;
    readonly hasOperand: boolean;
    /** Expressions follow M/X state; literal spellings retain their authored immediate width. */
    readonly stateImmediate: boolean;
    readonly numericSpelling: boolean;
    readonly explicitLong: boolean;
    /** Bank extraction retains the established word-sized immediate policy. */
    readonly bankWord: boolean;
    readonly indexedLabel: boolean;
    /** Generated labels may encode a program bank before their value resolves. */
    readonly hintedBank?: number;
    readonly hexDigits?: number;
    /** Decimal-prefix interpretation used by implied repeat pseudo instructions. */
    readonly impliedRepeat?: number;
  };
}
/** Parse all punctuation and compatibility policies before entering the instruction runtime. */
export function parse65816Operands(mnemonic: string, text: string): Syntax65816 {
  const grammar = {
    registers: ["a", "x", "y", "s"],
    indexRegisters: ["x", "y", "s"],
    commaIndex: true,
  };
  const common = parseInstructionOperands(mnemonic, text, grammar);
  const structural =
    common.operands[0]?.kind === "template" ? common.operands[0].structure : common;
  const whole = expansionPlan(text, 0),
    shape = structural.operands[0];
  let scalar = whole.scalar;
  if (shape?.kind === "immediate") {
    scalar = shape.value;
  }
  if (shape?.kind === "memory" && !("kind" in shape.address)) {
    scalar = shape.address;
  }
  let op = mnemonic.toUpperCase(),
    width: number | undefined,
    suffixError: string | undefined;
  if (op.includes(".")) {
    const at = op.indexOf("."),
      suffix = op.slice(at + 1);
    op = op.slice(0, at);
    width = ({ B: 1, W: 2, L: 3, D: 4 } as Record<string, number>)[suffix];
    if (width === undefined) {
      suffixError = `Error: Invalid opcode length in '${mnemonic.toUpperCase()}'.`;
    }
  }
  const body = text.trim().replace(/^#/, "").trim();
  const base = body.replace(/,\s*[sxy]$/i, "").trim();
  const hex = /^\$([\da-f]+)$/i.exec(base);
  const hinted = /^_([\da-f]{2})[\da-f]{4}/i.exec(text.trim());
  let wholeScalar = operandScalarSyntax(body, text.indexOf(body));
  if (body.startsWith("[") || (body.startsWith("(") && body.includes(".") && !whole.math)) {
    wholeScalar = { ...wholeScalar, expression: { type: "identifier", name: body } };
  }
  const repeat = Number.parseInt(body.replace(/^\$/, ""), 10);
  return {
    ...common,
    cpu65816: {
      kind: "cpu65816-v2",
      mnemonic: op,
      ...(width ? { width } : {}),
      ...(suffixError ? { suffixError } : {}),
      whole,
      parts: operandParts(text).map((p) => expansionPlan(p.text, p.start)),
      scalar,
      wholeScalar,
      display: text.slice(scalar.span.start, scalar.span.end),
      original: text.trim(),
      innerDisplay: base,
      ...(shape ? { shape } : {}),
      hasOperand: !!text.trim(),
      stateImmediate: /[&()*+/<>^|-]/.test(body) || /^[A-Z_a-z]\w*$/.test(body),
      numericSpelling: /^[\d!#$%]/.test(text.trim()),
      // The optional suffix is separated from a bounded six-digit literal by a comma.
      // oxlint-disable-next-line security/detect-unsafe-regex -- Bounded literal and mandatory separator.
      explicitLong: /^\$[\da-f]{5,6}(?:\s*,\s*[xy])?$/i.test(text.trim()),
      bankWord: text.includes("<:") || text.includes("bank(") || text.includes("bankbyte("),
      indexedLabel: /,\s*x$/i.test(text) && !/^[\d!#$%([]/.test(text.trim()),
      ...(hinted ? { hintedBank: Number.parseInt(hinted[1], 16) } : {}),
      ...(hex ? { hexDigits: hex[1].length } : {}),
      ...(Number.isNaN(repeat) ? {} : { impliedRepeat: repeat }),
    },
  };
}
/** Reject foreign grammar payloads, including detached worker copies. */
export function syntax65816(value: ParsedInstructionOperands): Syntax65816 {
  if (!hasPolicy(value)) {
    throw new Error("65816 encoder requires its registered operand grammar.");
  }
  return value;
}

/** Identify this parser's portable payload before entering the execution boundary. */
function hasPolicy(value: ParsedInstructionOperands): value is Syntax65816 {
  return (
    "cpu65816" in value &&
    typeof value.cpu65816 === "object" &&
    value.cpu65816 !== null &&
    "kind" in value.cpu65816 &&
    value.cpu65816.kind === "cpu65816-v2"
  );
}

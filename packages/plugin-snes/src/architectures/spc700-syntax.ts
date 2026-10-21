import type { ParsedInstructionOperands, ParsedOperand, OperandScalar } from "@uttori/asm-core";
import { parseInstructionOperands } from "@uttori/asm-core/plugin";

import {
  expansionPlan,
  operandParts,
  operandScalarSyntax,
  type ExpansionPlan,
} from "./operand-plans.js";
/** SPC punctuation and permissive literal readers are compiled once, before numeric execution. */
export interface SpcOperand {
  readonly shape?: ParsedOperand;
  readonly scalar: OperandScalar;
  readonly wholeScalar: OperandScalar;
  readonly plan: ExpansionPlan;
  readonly display: string;
  readonly wholeDisplay: string;
  readonly register: string;
  readonly hexDigits: number;
  readonly bareHex: boolean;
  /** Permissive whole-operand readers are syntax facts, preserving historical truncation. */
  readonly hexPrefix: number;
  readonly filteredHex: number;
  readonly decimalPrefix?: number;
  readonly containsDollar: boolean;
  readonly parenthesizedHex: boolean;
  readonly leadingHexDigits: number;
  /** Hexadecimal scalar inside address punctuation, distinct from the whole-operand prefix. */
  readonly baseHex: number;
  /** Combined bit-operand diagnostic tree, activated only after ordinary pairs fail. */
  readonly compound: OperandScalar;
  readonly bit?: number;
  readonly invert: boolean;
  readonly bitValue?: number;
}
/** Target grammar payload; mnemonic bits and operand bits retain their separate precedence. */
export interface SpcSyntax extends ParsedInstructionOperands {
  readonly spc700: {
    readonly kind: "spc700-v2";
    readonly mnemonic: string;
    readonly width?: number;
    readonly suffixError: boolean;
    readonly bitFamily?: string;
    readonly bit?: number;
    readonly parts: readonly SpcOperand[];
    readonly whole: ExpansionPlan;
  };
}
/** Numbered mnemonics and dotted selectors remain distinct so their precedence survives binding. */
export function parseSpcOperands(mnemonic: string, text: string): SpcSyntax {
  const grammar = {
    registers: ["a", "x", "y", "ya", "sp", "p", "psw", "c"],
    indexRegisters: ["x", "y"],
    commaIndex: false,
    plusIndex: true,
    bitSelectors: true,
  };
  const common = parseInstructionOperands(mnemonic, text, grammar);
  const structural =
    common.operands[0]?.kind === "template" ? common.operands[0].structure : common;
  const parts = operandParts(text).map((part, i): SpcOperand => {
    const shape = structural.operands[i];
    let body = part.text,
      scalar = operandScalarSyntax(body, part.start);
    if (shape?.kind === "immediate") {
      scalar = shape.value;
    }
    if (shape?.kind === "memory" && !("kind" in shape.address)) {
      scalar = shape.address;
    }
    const display = text.slice(scalar.span.start, scalar.span.end);
    let bitBody = part.text,
      invert = false;
    if (/^[!/]/.test(bitBody)) {
      invert = true;
      bitBody = bitBody.slice(1).trim();
    }
    const dotted = /^(.*)\.([0-7])$/.exec(bitBody);
    if (dotted) {
      bitBody = dotted[1].trim();
    }
    const bitHex = /^\$([\da-f]+)$/i.exec(bitBody);
    const hex = /^\$([\da-f]+)$/i.exec(display);
    const reg = /^(a|x|y|ya|sp|p|psw|c)$/i.exec(part.text);

    return {
      ...(shape ? { shape } : {}),
      scalar,
      wholeScalar: part.text.startsWith("!$")
        ? {
            ...operandScalarSyntax(part.text, part.start),
            expression: { type: "identifier", name: part.text },
          }
        : operandScalarSyntax(part.text.replace(/^#/, ""), part.start),
      plan: expansionPlan(part.text, part.start),
      display,
      wholeDisplay: part.text,
      register: reg?.[1].toLowerCase() ?? "",
      hexDigits: hex?.[1].length ?? 0,
      bareHex: !reg && /^[\d$a-f]+$/i.test(part.text),
      hexPrefix: Number.parseInt(part.text.replace(/\$/g, ""), 16) || 0,
      filteredHex: Number.parseInt(part.text.replace(/[^\da-f]/gi, ""), 16) || 0,
      ...(Number.isNaN(Number.parseInt(part.text, 10))
        ? {}
        : { decimalPrefix: Number.parseInt(part.text, 10) }),
      containsDollar: part.text.includes("$"),
      parenthesizedHex: /\(\s*\$/.test(part.text),
      leadingHexDigits: /^\$([\da-f]+)/i.exec(part.text)?.[1].length ?? 0,
      baseHex: Number.parseInt(display.replace(/\$/g, ""), 16) || 0,
      compound: operandScalarSyntax(text, 0),
      ...(dotted ? { bit: Number(dotted[2]) } : {}),
      invert,
      ...(bitHex ? { bitValue: Number.parseInt(bitHex[1], 16) } : {}),
    };
  });
  const op = mnemonic.toUpperCase(),
    dot = op.indexOf(".");
  const name = dot < 0 ? op : op.slice(0, dot);
  const width =
    dot < 0 ? undefined : ({ B: 1, W: 2, L: 3, D: 4 } as Record<string, number>)[op[dot + 1]];
  const numbered = /^(OR|AND|EOR|MOV|NOT)([0-7])$/.exec(name),
    branch = /^(BBS|BBC|SET|CLR)([0-7])?$/.exec(name);
  const bitFamily = numbered?.[1] ?? branch?.[1],
    bitText = numbered?.[2] ?? branch?.[2];
  return {
    ...common,
    spc700: {
      kind: "spc700-v2",
      mnemonic: name,
      ...(width ? { width } : {}),
      suffixError: dot >= 0 && width === undefined,
      ...(bitFamily ? { bitFamily } : {}),
      ...(bitText ? { bit: Number(bitText) } : {}),
      parts,
      whole: expansionPlan(text, 0),
    },
  };
}
/** Reject foreign grammar payloads without reinterpreting their source text. */
export function spcSyntax(value: ParsedInstructionOperands): SpcSyntax {
  if (!hasPolicy(value)) {
    throw new Error("SPC700 encoder requires its registered operand grammar.");
  }
  return value;
}

/** Identify this parser's portable payload before entering the execution boundary. */
function hasPolicy(value: ParsedInstructionOperands): value is SpcSyntax {
  return (
    "spc700" in value &&
    typeof value.spc700 === "object" &&
    value.spc700 !== null &&
    "kind" in value.spc700 &&
    value.spc700.kind === "spc700-v2"
  );
}

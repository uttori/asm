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
  /** Structural operand shape from the shared instruction parser. */
  readonly shape?: ParsedOperand;
  /** Primary expression scalar for this comma-separated part. */
  readonly scalar: OperandScalar;
  /** Scalar spanning the full authored operand text for branch and compound reads. */
  readonly wholeScalar: OperandScalar;
  /** Width and evaluation schedule compiled from the part text. */
  readonly plan: ExpansionPlan;
  /** Stripped display text for this part. */
  readonly display: string;
  /** Display text for the whole operand fragment including commas. */
  readonly wholeDisplay: string;
  /** Lowercased register name when the part names A/X/Y/SP/PSW/DP, else empty. */
  readonly register: string;
  /** Count of hex digits in a leading `$` literal, if any. */
  readonly hexDigits: number;
  /** True when the part is a bare hexadecimal atom without address punctuation. */
  readonly bareHex: boolean;
  /** Permissive whole-operand readers are syntax facts, preserving historical truncation. */
  readonly hexPrefix: number;
  /** Hex value after `$` with non-hex suffix characters stripped for ALU immediates. */
  readonly filteredHex: number;
  /** Decimal prefix extracted from a `$` literal for TCALL and bit families. */
  readonly decimalPrefix?: number;
  /** True when the part text contains a `$` hex introducer. */
  readonly containsDollar: boolean;
  /** True when a `$` hex literal is wrapped in parentheses as an address. */
  readonly parenthesizedHex: boolean;
  /** Hex digit count of the leading `$` atom before comma splitting. */
  readonly leadingHexDigits: number;
  /** Hexadecimal scalar inside address punctuation, distinct from the whole-operand prefix. */
  readonly baseHex: number;
  /** Combined bit-operand diagnostic tree, activated only after ordinary pairs fail. */
  readonly compound: OperandScalar;
  /** Direct bit index from `.n` selector syntax when present. */
  readonly bit?: number;
  /** True when `/addr.bit` inverted carry syntax was used. */
  readonly invert: boolean;
  /** Resolved bit address byte for SET/CLR/BBS/BBC direct forms. */
  readonly bitValue?: number;
}
/** Target grammar payload; mnemonic bits and operand bits retain their separate precedence. */
export interface SpcSyntax extends ParsedInstructionOperands {
  /** Parsed SPC700 operand bundle carried through preparation and encoding. */
  readonly spc700: {
    /** Discriminator for portable SPC700 operand payloads. */
    readonly kind: "spc700-v2";
    /** Uppercased mnemonic after alias and bit-family normalization. */
    readonly mnemonic: string;
    /** Forced address width from `.b`/`.w` suffix when valid. */
    readonly width?: number;
    /** True when an opcode suffix requested an unsupported width letter. */
    readonly suffixError: boolean;
    /** SET/CLR/BBS/BBC/OR/AND/EOR/MOV/NOT family tag when the mnemonic carries a bit index. */
    readonly bitFamily?: string;
    /** Bit index encoded in the mnemonic for numbered bit instructions. */
    readonly bit?: number;
    /** Comma-separated operand parts in source order. */
    readonly parts: readonly SpcOperand[];
    /** Whole-operand expansion plan spanning the full text. */
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
  const first = common.operands.at(0);
  const structural = first?.kind === "template" ? first.structure : common;
  const parts: SpcOperand[] = [];
  for (const [i, part] of operandParts(text).entries()) {
    const shape = structural.operands.at(i);
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

    parts.push({
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
    });
  }
  const op = mnemonic.toUpperCase(),
    dot = op.indexOf(".");
  const name = dot < 0 ? op : op.slice(0, dot);
  const width =
    dot < 0
      ? undefined
      : ({ B: 1, W: 2, L: 3, D: 4 } as Record<string, number | undefined>)[op[dot + 1]];
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

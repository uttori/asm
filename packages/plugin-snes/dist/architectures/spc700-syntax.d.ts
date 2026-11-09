import type { ParsedInstructionOperands, ParsedOperand, OperandScalar } from "@uttori/asm-core";
import { type ExpansionPlan } from "./operand-plans.js";
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
export declare function parseSpcOperands(mnemonic: string, text: string): SpcSyntax;
/** Reject foreign grammar payloads without reinterpreting their source text. */
export declare function spcSyntax(value: ParsedInstructionOperands): SpcSyntax;
//# sourceMappingURL=spc700-syntax.d.ts.map
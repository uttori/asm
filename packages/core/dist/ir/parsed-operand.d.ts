import type { SourceSpan } from "../source-location.js";
import { type ExpressionNode } from "./expression-node.js";
import { type SourceFragment } from "./source-fragment.js";
/** Width is lexical intent, separate from the value or addressing form selected in a pass. */
export type OperandWidthIntent = {
    /** Explicit byte width chosen by ca65-style prefixes or mnemonic suffixes. */
    readonly forcedBytes?: 1 | 2 | 3;
    /** Inferred storage width from literal digit count when no prefix applies. */
    readonly literalBytes?: number;
    /** Lexical atom class used only for diagnostics and width heuristics. */
    readonly spelling: "hex" | "binary" | "decimal" | "symbol" | "expression";
    /** True when the expression was parenthesized in source. */
    readonly grouped: boolean;
};
/** Source spelling is attribution only after parsing; resolution operates on expression and width. */
export type OperandScalar = {
    /** Parsed value or reference tree for later evaluation and binding. */
    readonly expression: ExpressionNode;
    /** Unbound reference structure for tooling when textual defines can change execution grammar. */
    readonly referenceExpression?: ExpressionNode;
    /** Width metadata derived from spelling, never from resolved numeric values. */
    readonly width: OperandWidthIntent;
    /** Source extent covering the scalar token or subexpression. */
    readonly span: SourceSpan;
};
/** Named processor register operand with canonical lowercase spelling. */
export type OperandRegister = {
    /** Discriminator fixed to register for narrowing parsed operand unions. */
    readonly kind: "register";
    /** Register mnemonic after case normalization. */
    readonly name: string;
    /** Source extent covering the register token. */
    readonly span: SourceSpan;
};
/** All processor operand forms are structural; invalid syntax is a diagnostic, never an execution escape hatch. */
export type ParsedOperand = OperandRegister | {
    readonly kind: "immediate";
    readonly value: OperandScalar;
    readonly span: SourceSpan;
} | {
    readonly kind: "memory";
    readonly address: OperandScalar | OperandRegister;
    readonly delimiter: "none" | "parentheses" | "brackets";
    readonly index?: {
        readonly register: string;
        readonly position: "inside" | "outside";
        readonly separator: "," | "+";
    };
    /** Stack-relative indirect forms retain the inner S separately from the outer Y index. */
    readonly innerIndex?: string;
    readonly postIncrement?: boolean;
    readonly bit?: {
        readonly selector: OperandScalar;
        readonly inverted: boolean;
    };
    readonly span: SourceSpan;
} | {
    readonly kind: "template";
    readonly fragment: SourceFragment;
    readonly span: SourceSpan;
    readonly structure: ParsedInstructionOperands;
} | {
    readonly kind: "invalid";
    readonly message: string;
    readonly span: SourceSpan;
};
/** No operands is an empty sequence. Compound forms preserve source order and component boundaries. */
export type ParsedInstructionOperands = {
    /** Operands in source order, including invalid placeholders for recovery. */
    readonly operands: readonly ParsedOperand[];
    /** Mnemonic suffix width when `.b`, `.w`, or `.l` was present. */
    readonly width?: 1 | 2 | 3;
    /** Numbered SPC bit mnemonics are distinct from a dotted address selector. */
    readonly mnemonicBit?: number;
};
/** Architecture-owned configuration selects registers and punctuation without evaluating source. */
export type OperandGrammarOptions = {
    /** Defaults to true. False preserves unresolved structure solely for deferred binding diagnostics. */
    readonly templates?: boolean;
    /** Register names accepted as bare operands or inside addressing parentheses. */
    readonly registers: readonly string[];
    /** Registers that may appear as index suffixes on memory operands. */
    readonly indexRegisters: readonly string[];
    /** When true, comma separates base from index; otherwise plus-index rules apply. */
    readonly commaIndex: boolean;
    /** Enables SPC-style `(reg)+` post-increment on memory forms. */
    readonly plusIndex?: boolean;
    /** Enables dotted bit selectors and inverted `/` prefixes on memory operands. */
    readonly bitSelectors?: boolean;
    /** Enables ca65 `z:`/`a:`/`f:` width prefixes on memory scalars. */
    readonly ca65Widths?: boolean;
};
/** Pure target-selected operand grammar shared by physical input and attributed generated fragments. */
export declare function parseInstructionOperands(mnemonic: string, text: string, grammar: OperandGrammarOptions): ParsedInstructionOperands;
/** A failed generated-operand binding retains a structured reason for target-stage diagnostics. */
export declare class OperandTemplateBindingError extends Error {
    /** Failure category distinguishing cycle, stall, and depth limit cases. */
    readonly reason: "unbound" | "recursive" | "depth";
    constructor(
    /** Failure category distinguishing cycle, stall, and depth limit cases. */
    reason: "unbound" | "recursive" | "depth", message: string);
}
/** Re-enter only the selected target grammar when define/macro binding can change operand structure. */
export declare function bindInstructionOperands(syntax: ParsedInstructionOperands, bind: (fragment: SourceFragment) => SourceFragment, parse: (text: string) => ParsedInstructionOperands): ParsedInstructionOperands;
//# sourceMappingURL=parsed-operand.d.ts.map
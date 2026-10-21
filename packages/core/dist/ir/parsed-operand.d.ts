import type { SourceSpan } from "../source-location.js";
import { type ExpressionNode } from "./expression-node.js";
import { type SourceFragment } from "./source-fragment.js";
/** Width is lexical intent, separate from the value or addressing form selected in a pass. */
export type OperandWidthIntent = {
    readonly forcedBytes?: 1 | 2 | 3;
    readonly literalBytes?: number;
    readonly spelling: "hex" | "binary" | "decimal" | "symbol" | "expression";
    readonly grouped: boolean;
};
/** Source spelling is attribution only after parsing; resolution operates on expression and width. */
export type OperandScalar = {
    readonly expression: ExpressionNode;
    /** Unbound reference structure for tooling when textual defines can change execution grammar. */
    readonly referenceExpression?: ExpressionNode;
    readonly width: OperandWidthIntent;
    readonly span: SourceSpan;
};
export type OperandRegister = {
    readonly kind: "register";
    readonly name: string;
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
    readonly operands: readonly ParsedOperand[];
    readonly width?: 1 | 2 | 3;
    /** Numbered SPC bit mnemonics are distinct from a dotted address selector. */
    readonly mnemonicBit?: number;
};
/** Architecture-owned configuration selects registers and punctuation without evaluating source. */
export type OperandGrammarOptions = {
    /** Defaults to true. False preserves unresolved structure solely for deferred binding diagnostics. */
    readonly templates?: boolean;
    readonly registers: readonly string[];
    readonly indexRegisters: readonly string[];
    readonly commaIndex: boolean;
    readonly plusIndex?: boolean;
    readonly bitSelectors?: boolean;
    readonly ca65Widths?: boolean;
};
/** Pure target-selected operand grammar shared by physical input and attributed generated fragments. */
export declare function parseInstructionOperands(mnemonic: string, text: string, grammar: OperandGrammarOptions): ParsedInstructionOperands;
/** A failed generated-operand binding retains a structured reason for target-stage diagnostics. */
export declare class OperandTemplateBindingError extends Error {
    readonly reason: "unbound" | "recursive" | "depth";
    constructor(reason: "unbound" | "recursive" | "depth", message: string);
}
/** Re-enter only the selected target grammar when define/macro binding can change operand structure. */
export declare function bindInstructionOperands(syntax: ParsedInstructionOperands, bind: (fragment: SourceFragment) => SourceFragment, parse: (text: string) => ParsedInstructionOperands): ParsedInstructionOperands;
//# sourceMappingURL=parsed-operand.d.ts.map
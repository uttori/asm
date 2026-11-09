import { type SourceSpan } from "../source-location.js";
import { type ExpressionNode } from "./expression-node.js";
import { type NormalizedCommand } from "./normalized-command.js";
/** Declaration payloads carry syntax and source locations, never the resolved symbol value. */
export type LabelStatement = {
    form: "relative";
    name: string;
    direction: 1 | -1;
    depth: number;
    span: SourceSpan;
    trailing?: NormalizedCommand;
} | {
    form: "global";
    name: string;
    span: SourceSpan;
    preserveHierarchy: boolean;
    missingName: boolean;
    trailing?: NormalizedCommand;
} | {
    form: "named";
    labels: readonly {
        name: string;
        span: SourceSpan;
    }[];
    trailing?: NormalizedCommand;
};
/** Symbol assignment from a parsed expression on one source line. */
export type AssignmentStatement = {
    /** Destination symbol name before namespace qualification. */
    target: string;
    /** Parsed right-hand expression evaluated during assembly. */
    expression: ExpressionNode;
    /** Original spelling for attribution and diagnostics; execution uses the expression node. */
    text: string;
    /** Source extent covering the assignment line. */
    span: SourceSpan;
};
/** Numeric or character data directive operands after width normalization. */
export type NumericDataStatement = {
    /** Storage width in bytes selected by the directive mnemonic. */
    width: 1 | 2 | 3 | 4;
    /** Only invalid empty statements retain their alias for the established diagnostic. */
    emptyDirective?: string;
    /** Per-operand source text paired with its parsed expression tree. */
    operands: readonly {
        text: string;
        expression: ExpressionNode;
    }[];
    /**
     * Dense constant rows use six scalars per item: operand text, literal spelling, numeric value
     * (null if absent), UTF-16 start/end, and zero-based line (null if absent). Operands is empty.
     * This is immutable parsed syntax, not evaluated state; materialize at an API boundary if needed.
     */
    literalData?: readonly (string | number | null)[];
};
/**
 * Reconstitute literal occurrences without reparsing or resolving any source text.
 * @yields Original operand spelling and parsed literal occurrence, without retaining a view cache.
 */
export declare function literalDataOperands(data: NonNullable<NumericDataStatement["literalData"]>): Generator<{
    text: string;
    expression: import("./expression-node.js").LiteralExpressionNode;
}, void, unknown>;
/** Middleware receives detached ordinary operands, preserving the public occurrence view. */
export declare function materializeNumericData(statement: NumericDataStatement): NumericDataStatement;
/** Parse declaration structure once; the syntax profile decides whether dot-prefixed names qualify. */
export declare function parseLabelStatement(command: NormalizedCommand, leadingDotLabels: boolean): LabelStatement | undefined;
/** Parse mixed numeric/string data without resolving defines or invoking character mappings. */
export declare function parseNumericDataStatement(command: NormalizedCommand): NumericDataStatement | undefined;
//# sourceMappingURL=statement-node.d.ts.map
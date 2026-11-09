import type { SourceSpan } from "../source-location.js";
import type { ExpressionNode } from "./expression-node.js";
import type { CommandProvenance, NormalizedCommand } from "./normalized-command.js";
import type { LabelStatement, NumericDataStatement } from "./statement-node.js";
/** JSON-safe plugin data. No live state, resolved values, capabilities or callbacks belong here. */
export type SyntaxValue = null | boolean | number | string | readonly SyntaxValue[] | {
    readonly [key: string]: SyntaxValue;
};
/** Exact lexical occurrence; spans use UTF-16 columns and zero-based physical lines. */
export type SyntaxToken = {
    /** Exact source spelling for the token. */
    readonly text: string;
    /** UTF-16 span on the physical source line. */
    readonly span: SourceSpan;
};
/** A pure parse result; errors become active only if execution reaches this occurrence. */
export type ContributionSyntax = {
    readonly kind: "plugin";
    readonly contributionId: string;
    readonly grammarVersion: string;
} & ({
    readonly payload: SyntaxValue;
    readonly error?: never;
} | {
    readonly error: string;
    readonly payload?: never;
});
/** Contracts for the later declaration/data/resource migrations; leaves retain source spelling. */
export type DeclarationSyntax = {
    /** Discriminator fixed to declaration for syntax tree narrowing. */
    readonly kind: "declaration";
    /** Which declaration grammar produced this syntax subtree. */
    readonly declaration: "assignment" | "define" | "function" | "macro" | "struct" | "union" | "dataStruct" | "namespace" | "characterTable";
    /** Primary identifier token for the declaration. */
    readonly name: SyntaxToken;
    /** Formal parameter tokens when the declaration accepts arguments. */
    readonly parameters: readonly SyntaxToken[];
    /** Nested syntax nodes forming the declaration body. */
    readonly body: readonly SourceSyntax[];
    /** Optional initializer expression for value-bearing declarations. */
    readonly value?: ExpressionNode;
};
/** One row in a data directive: expression, string literal, or struct initializer. */
export type DataItemSyntax = {
    readonly kind: "expression";
    readonly expression: ExpressionNode;
    readonly spelling: SyntaxToken;
} | {
    readonly kind: "string";
    readonly spelling: SyntaxToken;
    readonly value: string;
} | {
    readonly kind: "initializer";
    readonly fields: readonly {
        readonly name?: SyntaxToken;
        readonly value: DataItemSyntax;
    }[];
};
/** Segment in a macro or template body mixing literal text and symbolic references. */
export type TemplateSegmentSyntax = {
    readonly kind: "text";
    readonly token: SyntaxToken;
} | {
    readonly kind: "reference";
    readonly reference: "argument" | "define" | "variadic";
    readonly token: SyntaxToken;
    readonly index?: ExpressionNode;
};
/** Inline data borrows its parent's occurrence instead of duplicating provenance and parsed text. */
export type NumericDataFragment = {
    /** Discriminator marking inline numeric data embedded in another command. */
    readonly kind: "numericDataFragment";
    /** Normalized directive mnemonic hosting the inline data tokens. */
    readonly command: string;
    /** Index of the first data token in the containing command; avoids duplicating its token array. */
    readonly wordOffset: number;
    /** Parsed numeric data statement shared with standalone data directives. */
    readonly statement: NumericDataStatement;
};
/** Source syntax is immutable and stage-independent; binding owns values and side effects. */
export type SourceSyntax = {
    readonly kind: "label";
    readonly statement: LabelStatement;
} | {
    readonly kind: "sequence";
    readonly declaration: LabelStatement;
    readonly following: NormalizedCommand | NumericDataFragment;
} | {
    readonly kind: "numericData";
    readonly statement: NumericDataStatement;
} | DeclarationSyntax | {
    readonly kind: "data";
    readonly width: 1 | 2 | 3 | 4;
    readonly items: readonly DataItemSyntax[];
} | {
    readonly kind: "resource";
    readonly operation: "include" | "binary" | "asset";
    readonly path: SyntaxToken;
    readonly arguments: readonly DataItemSyntax[];
} | {
    readonly kind: "template";
    readonly segments: readonly TemplateSegmentSyntax[];
} | {
    readonly kind: "invocation";
    readonly name: SyntaxToken;
    readonly arguments: readonly SyntaxToken[];
} | ContributionSyntax;
/** A parser receives detached syntax only, never a session or evaluator. */
export type SyntaxParseInput = {
    /** Preparsed core declaration, when present; copied data with no session bindings. */
    readonly declaration?: import("./declaration-node.js").DeclarationNode;
    /** Directive or statement keyword being parsed. */
    readonly keyword: string;
    /** Raw command text after normalization. */
    readonly text: string;
    /** Tokenized words split from the command line. */
    readonly words: readonly string[];
    /** Provenance tying the parse back to a physical source occurrence. */
    readonly source: CommandProvenance;
};
/** Plugin-owned syntax grammar with versioned payloads and validation hooks. */
export interface SyntaxGrammar {
    /** Change whenever accepted syntax or payload schema changes; part of cache/worker identity. */
    readonly version: string;
    /** Parses one command occurrence into a JSON-safe syntax payload. */
    parse(input: SyntaxParseInput): SyntaxValue;
    /** Validate both fresh results and deserialized payloads before binding/execution. */
    validate(payload: SyntaxValue): boolean;
}
/**
 * Copy a bounded plain JSON tree without invoking accessors or preserving prototypes.
 * Reject cyclic/host objects early so worker snapshots cannot silently change their meaning.
 * Allow up to 1,000,000 values and 128 nesting levels (the root is level zero).
 */
export declare function copySyntaxValue(value: unknown): SyntaxValue;
/** Detach and freeze a bounded JSON tree; never freeze caller-owned parser or transport objects. */
export declare function immutableSyntaxValue(value: unknown): SyntaxValue;
/** Object.freeze alone cannot prove recursive immutability or prior structural validation. */
export declare function isImmutableSyntaxValue(value: unknown): value is SyntaxValue;
//# sourceMappingURL=source-syntax.d.ts.map
import { type SourceSpan } from "../source-location.js";
import type { SourceOrigin } from "../source-provenance.js";
import { type ParsedAssetCall } from "./asset-call.js";
import { type CommandOperation } from "./command-operation.js";
import { type DeclarationNode } from "./declaration-node.js";
import { type ExpressionNode, type RangeExpressionNode } from "./expression-node.js";
import type { SourceSyntax } from "./source-syntax.js";
/** High-level syntactic bucket assigned before semantic lowering runs. */
export type CommandKind = "unknown" | "directive" | "opcodeCandidate" | "functionDefinition" | "labelDefinition" | "staticAssignment" | "characterMapping" | "macroDefinitionOrInvoke" | "defineCommand" | "structCommand" | "commentOrEmpty";
/** Immutable source identity carried with every normalized command occurrence. */
export type CommandProvenance = {
    /** Generated token runs and all physical contributors; borrowed immutable by execution clones. */
    readonly fragment?: import("./source-fragment.js").SourceFragment;
    /** Invocation/include ownership attached to an execution occurrence, never a cached program. */
    readonly origin?: SourceOrigin;
    /** Path of the file containing this occurrence. */
    readonly file: string;
    /** Zero-based source line index for span derivation. */
    readonly line: number;
    /** Original physical line text before normalization. */
    readonly raw: string;
    /** Exact physical source extent before profile rewriting, comments, or continuations. */
    readonly physical?: {
        readonly text: string;
    };
    /** Normalized command text used for classification and parsing. */
    readonly normalized: string;
    /** Span covering {@link raw} within the source file. */
    readonly span: SourceSpan;
    /** Span covering {@link normalized} within the source file. */
    readonly normalizedSpan: SourceSpan;
    /** Per-token spans aligned with the tokenized words array. */
    readonly tokenSpans: readonly SourceSpan[];
};
/** Front-end command node combining classification, tokens, and parsed semantics. */
export type NormalizedCommand = {
    /** Syntactic bucket inferred from normalized text and tokens. */
    kind: CommandKind;
    /** Source identity and spans for diagnostics and metadata. */
    source: CommandProvenance;
    /** Trimmed normalized command string. */
    command: string;
    /** Tokenized words split from the normalized line. */
    words: readonly string[];
    /** First token, often a directive or mnemonic keyword. */
    keyword: string;
    /** Extracted label name when the line begins with label syntax. */
    labelName?: string;
    /** Static assignment target for simple `name = value` forms. */
    assignmentTarget?: string;
    /** Parsed semantic payloads keyed by construct type. */
    parsed: CommandSemantics;
    /** Pure source AST; semantic rewrites invalidate it and re-enter the parser boundary. */
    syntax?: SourceSyntax;
};
/**
 * Creates immutable provenance metadata for a normalized command.
 * @param raw The original source line.
 * @param normalized The normalized line after pre-dispatch cleanup.
 * @param words The tokenized command words.
 * @param file The current source file.
 * @param line The current source line number.
 * @param [collectSourceMetadata] Whether to derive precise source spans.
 * @returns The command provenance.
 */
export declare function createCommandProvenance(raw: string, normalized: string, words: string[], file: string, line: number, collectSourceMetadata?: boolean): CommandProvenance;
/** Conditional directive payload with a parsed test expression. */
export type ParsedCondition = {
    /** Boolean test expression for `if`, `elseif`, or `while`. */
    expression: ExpressionNode;
};
/** Static assignment payload for `name = expr` commands. */
export type ParsedAssignment = {
    /** Left-hand symbol receiving the value. */
    target: string;
    /** Right-hand expression evaluated at assembly time. */
    expression: ExpressionNode;
};
/** Parsed `for` loop header with an inclusive numeric range. */
export type ParsedForLoop = {
    /** Loop variable name introduced by the directive. */
    variable: string;
    /** Range expression node covering start and end. */
    range: RangeExpressionNode;
    /** Parsed start bound from the range. */
    start: ExpressionNode;
    /** Parsed end bound from the range. */
    end: ExpressionNode;
};
/** Optional byte slice suffix on an `incbin` operand. */
export type ParsedIncbinRange = {
    /** Range expression node after the path colon. */
    range: RangeExpressionNode;
    /** Parsed start bound from the range. */
    start: ExpressionNode;
    /** Parsed end bound from the range. */
    end: ExpressionNode;
};
/** Macro invocation name and actual arguments. */
export type ParsedMacroInvocation = {
    /** Macro symbol invoked, without the leading `%`. */
    name: string;
    /** Comma-split actual arguments when parentheses are present. */
    args: string[];
};
/** Include-family directive with a resolved path operand. */
export type ParsedIncludeTarget = {
    /** Which include directive introduced the path. */
    directive: "include" | "incsrc" | "incbin";
    /** Path token after quote stripping and range removal. */
    target: string;
};
/** Label prefix split from trailing statement text on the same line. */
export type ParsedLabelSplit = {
    /** Label name without the trailing colon. */
    label: string;
    /** Remaining statement text after the label, when non-empty. */
    trailing?: string;
};
/** Data emission directive with comma-split operands. */
export type ParsedDataDirective = {
    /** Lowercased directive keyword such as `db` or `dw`. */
    directive: string;
    /** Operand strings following the directive keyword. */
    operands: string[];
};
/** Generic directive keyword with parsed argument strings. */
export type ParsedDirectiveArgs = {
    /** Directive keyword in lower case. */
    name: string;
    /** Operand strings parsed from the trailing payload. */
    args: string[];
};
/** Instruction mnemonic with operand text split for encoding. */
export type ParsedOpcodeOperands = {
    /** Mnemonic token as authored. */
    mnemonic: string;
    /** Raw operand text following the mnemonic. */
    operandText: string;
    /** Comma-split operand strings derived from the payload. */
    operands: string[];
};
/** Optional semantic payloads attached to one normalized command. */
export type CommandSemantics = {
    /** Structured control-flow or declaration operation when recognized. */
    operation?: CommandOperation;
    /** Bare macro call operation without surrounding syntax sugar. */
    bareInvocation?: Extract<CommandOperation, {
        kind: "macroCall";
    }>;
    /** Declaration AST when the line introduces a definition. */
    declaration?: DeclarationNode;
    /** Parsed `includeasset` call site when present. */
    includeAsset?: ParsedAssetCall;
    /** Conditional test for branching directives. */
    condition?: ParsedCondition;
    /** Static assignment form when parsed. */
    assignment?: ParsedAssignment;
    /** `for` loop header when parsed. */
    forLoop?: ParsedForLoop;
    /** `incbin` slice suffix when parsed. */
    incbinRange?: ParsedIncbinRange;
    /** Macro `%name(args)` invocation when parsed. */
    macroInvocation?: ParsedMacroInvocation;
    /** Include path target when parsed. */
    includeTarget?: ParsedIncludeTarget;
    /** Same-line label split when parsed. */
    labelSplit?: ParsedLabelSplit;
    /** Data directive operands when parsed. */
    dataDirective?: ParsedDataDirective;
    /** Generic directive arguments when parsed. */
    directiveArgs?: ParsedDirectiveArgs;
    /** Instruction operand payload when parsed. */
    opcodeOperands?: ParsedOpcodeOperands;
};
/**
 * Builds the normalized command node used by the command pipeline.
 * @param raw The original source line.
 * @param normalized The normalized line after pre-dispatch cleanup.
 * @param words The tokenized command words.
 * @param file The current source file.
 * @param line The current source line number.
 * @param [collectSourceMetadata] Whether to derive precise source spans.
 * @returns The normalized command node.
 */
export declare function createNormalizedCommand(raw: string, normalized: string, words: string[], file: string, line: number, collectSourceMetadata?: boolean): NormalizedCommand;
/**
 * Creates an isolated execution copy so runtime preprocessing can mutate command
 * state without changing cached front-end program nodes.
 * @param command The command to clone.
 * @returns The detached execution command.
 */
export declare function cloneNormalizedCommand(command: NormalizedCommand): NormalizedCommand;
/**
 * Replaces a command node's tokenized words and derived fields.
 * @param command The command node to update.
 * @param words The updated token list.
 * @param [normalized] Optional normalized command text.
 * @returns The same command node for chaining.
 */
export declare function setCommandWords(command: NormalizedCommand, words: readonly string[], normalized?: string): NormalizedCommand;
/**
 * Reclassifies a normalized command without changing any other fields.
 * @param command The command node to update.
 * @param kind The new command kind.
 * @returns The same command node for chaining.
 */
export declare function setCommandKind(command: NormalizedCommand, kind: CommandKind): NormalizedCommand;
/**
 * Applies lightweight heuristics to classify a normalized command.
 * @param command The normalized command text.
 * @param words The tokenized command words.
 * @returns The inferred command kind.
 */
export declare function classifyCommand(command: string, words: readonly string[]): CommandKind;
//# sourceMappingURL=normalized-command.d.ts.map
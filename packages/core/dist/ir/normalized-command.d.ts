import { type SourceSpan } from "../source-location.js";
import type { SourceOrigin } from "../source-provenance.js";
import { type ParsedAssetCall } from "./asset-call.js";
import { type CommandOperation } from "./command-operation.js";
import { type DeclarationNode } from "./declaration-node.js";
import { type ExpressionNode, type RangeExpressionNode } from "./expression-node.js";
import type { SourceSyntax } from "./source-syntax.js";
export type CommandKind = "unknown" | "directive" | "opcodeCandidate" | "functionDefinition" | "labelDefinition" | "staticAssignment" | "characterMapping" | "macroDefinitionOrInvoke" | "defineCommand" | "structCommand" | "commentOrEmpty";
export type CommandProvenance = {
    /** Generated token runs and all physical contributors; borrowed immutable by execution clones. */
    readonly fragment?: import("./source-fragment.js").SourceFragment;
    /** Invocation/include ownership attached to an execution occurrence, never a cached program. */
    readonly origin?: SourceOrigin;
    readonly file: string;
    readonly line: number;
    readonly raw: string;
    /** Exact physical source extent before profile rewriting, comments, or continuations. */
    readonly physical?: {
        readonly text: string;
    };
    readonly normalized: string;
    readonly span: SourceSpan;
    readonly normalizedSpan: SourceSpan;
    readonly tokenSpans: readonly SourceSpan[];
};
export type NormalizedCommand = {
    kind: CommandKind;
    source: CommandProvenance;
    command: string;
    words: readonly string[];
    keyword: string;
    labelName?: string;
    assignmentTarget?: string;
    parsed: CommandSemantics;
    /** Pure source AST; semantic rewrites invalidate it and re-enter the parser boundary. */
    syntax?: SourceSyntax;
};
/**
 * Creates immutable provenance metadata for a normalized command.
 * @param {string} raw The original source line.
 * @param {string} normalized The normalized line after pre-dispatch cleanup.
 * @param {string[]} words The tokenized command words.
 * @param {string} file The current source file.
 * @param {number} line The current source line number.
 * @param {boolean} [collectSourceMetadata] Whether to derive precise source spans.
 * @returns {CommandProvenance} The command provenance.
 */
export declare function createCommandProvenance(raw: string, normalized: string, words: string[], file: string, line: number, collectSourceMetadata?: boolean): CommandProvenance;
export type ParsedCondition = {
    expression: ExpressionNode;
};
export type ParsedAssignment = {
    target: string;
    expression: ExpressionNode;
};
export type ParsedForLoop = {
    variable: string;
    range: RangeExpressionNode;
    start: ExpressionNode;
    end: ExpressionNode;
};
export type ParsedIncbinRange = {
    range: RangeExpressionNode;
    start: ExpressionNode;
    end: ExpressionNode;
};
export type ParsedMacroInvocation = {
    name: string;
    args: string[];
};
export type ParsedIncludeTarget = {
    directive: "include" | "incsrc" | "incbin";
    target: string;
};
export type ParsedLabelSplit = {
    label: string;
    trailing?: string;
};
export type ParsedDataDirective = {
    directive: string;
    operands: string[];
};
export type ParsedDirectiveArgs = {
    name: string;
    args: string[];
};
export type ParsedOpcodeOperands = {
    mnemonic: string;
    operandText: string;
    operands: string[];
};
export type CommandSemantics = {
    operation?: CommandOperation;
    bareInvocation?: Extract<CommandOperation, {
        kind: "macroCall";
    }>;
    declaration?: DeclarationNode;
    includeAsset?: ParsedAssetCall;
    condition?: ParsedCondition;
    assignment?: ParsedAssignment;
    forLoop?: ParsedForLoop;
    incbinRange?: ParsedIncbinRange;
    macroInvocation?: ParsedMacroInvocation;
    includeTarget?: ParsedIncludeTarget;
    labelSplit?: ParsedLabelSplit;
    dataDirective?: ParsedDataDirective;
    directiveArgs?: ParsedDirectiveArgs;
    opcodeOperands?: ParsedOpcodeOperands;
};
/**
 * Builds the normalized command node used by the command pipeline.
 * @param {string} raw The original source line.
 * @param {string} normalized The normalized line after pre-dispatch cleanup.
 * @param {string[]} words The tokenized command words.
 * @param {string} file The current source file.
 * @param {number} line The current source line number.
 * @param {boolean} [collectSourceMetadata] Whether to derive precise source spans.
 * @returns {NormalizedCommand} The normalized command node.
 */
export declare function createNormalizedCommand(raw: string, normalized: string, words: string[], file: string, line: number, collectSourceMetadata?: boolean): NormalizedCommand;
/**
 * Creates an isolated execution copy so runtime preprocessing can mutate command
 * state without changing cached front-end program nodes.
 * @param {NormalizedCommand} command The command to clone.
 * @returns {NormalizedCommand} The detached execution command.
 */
export declare function cloneNormalizedCommand(command: NormalizedCommand): NormalizedCommand;
/**
 * Replaces a command node's tokenized words and derived fields.
 * @param {NormalizedCommand} command The command node to update.
 * @param {string[]} words The updated token list.
 * @param {string} [normalized] Optional normalized command text.
 * @returns {NormalizedCommand} The same command node for chaining.
 */
export declare function setCommandWords(command: NormalizedCommand, words: readonly string[], normalized?: string): NormalizedCommand;
/**
 * Reclassifies a normalized command without changing any other fields.
 * @param {NormalizedCommand} command The command node to update.
 * @param {CommandKind} kind The new command kind.
 * @returns {NormalizedCommand} The same command node for chaining.
 */
export declare function setCommandKind(command: NormalizedCommand, kind: CommandKind): NormalizedCommand;
/**
 * Applies lightweight heuristics to classify a normalized command.
 * @param {string} command The normalized command text.
 * @param {string[]} words The tokenized command words.
 * @returns {CommandKind} The inferred command kind.
 */
export declare function classifyCommand(command: string, words: readonly string[]): CommandKind;
//# sourceMappingURL=normalized-command.d.ts.map
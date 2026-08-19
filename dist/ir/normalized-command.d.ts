import { type ExpressionNode, type RangeExpressionNode } from "./expression-node.js";
import { type SourceSpan } from "../source-location.js";
export type CommandKind = "unknown" | "directive" | "opcodeCandidate" | "functionDefinition" | "labelDefinition" | "staticAssignment" | "characterMapping" | "macroDefinitionOrInvoke" | "defineCommand" | "structCommand" | "commentOrEmpty";
export type CommandProvenance = {
    readonly file: string;
    readonly line: number;
    readonly raw: string;
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
};
/**
 * Creates immutable provenance metadata for a normalized command.
 * @param {string} raw The original source line.
 * @param {string} normalized The normalized line after pre-dispatch cleanup.
 * @param {string[]} words The tokenized command words.
 * @param {string} file The current source file.
 * @param {number} line The current source line number.
 * @returns {CommandProvenance} The command provenance.
 */
export declare function createCommandProvenance(raw: string, normalized: string, words: string[], file: string, line: number): CommandProvenance;
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
    directive: "include" | "incsrc";
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
 * @returns {NormalizedCommand} The normalized command node.
 */
export declare function createNormalizedCommand(raw: string, normalized: string, words: string[], file: string, line: number): NormalizedCommand;
/**
 * Creates a lightweight command node for deferred loop or macro collection.
 * @param {string} raw The unprocessed source line.
 * @param {string} file The current source file.
 * @param {number} line The current source line number.
 * @param {string} [normalized] Optional normalized form without inline comments.
 * @param {string[]} [words] Optional tokenized words for semantic payload derivation.
 * @returns {NormalizedCommand} The pending command node.
 */
export declare function createPendingCommand(raw: string, file: string, line: number, normalized?: string, words?: string[]): NormalizedCommand;
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
//# sourceMappingURL=normalized-command.d.ts.map
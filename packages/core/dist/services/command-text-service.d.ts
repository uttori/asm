/** A preprocessed command tagged with its original 0-based source line. */
export type SourcedCommand = {
    /** Normalized command text. */
    text: string;
    /** Zero-based line number in the source block. */
    line: number;
};
export type PreprocessBlockCommandsResult = {
    commands: string[];
    sourcedCommands: SourcedCommand[];
    commandBuffer: string;
};
/**
 * Removes inline comments from a command line while preserving semicolons
 * inside double-quoted text.
 * @param {string} line The raw command line.
 * @param {SyntaxProfile} [syntaxProfile] Active source syntax profile.
 * @returns {string} The comment-stripped command line.
 */
export declare const removeInlineComment: (line: string, syntaxProfile?: SyntaxProfile) => string;
/**
 * Normalizes a multi-line command block by trimming lines, removing comments,
 * and carrying line-continuation state across calls.
 * @param {string} block Raw block text.
 * @param {string} [commandBuffer] Existing continuation buffer.
 * @param {SyntaxProfile} [syntaxProfile] Active source syntax profile.
 * @returns {PreprocessBlockCommandsResult} Parsed commands and next buffer value.
 */
export declare const preprocessBlockCommands: (block: string, commandBuffer?: string, syntaxProfile?: SyntaxProfile) => PreprocessBlockCommandsResult;
/**
 * Splits inline `:` command chains into individual commands.
 * @param {string[]} commands Command lines to split.
 * @param {SyntaxProfile} [syntaxProfile] Active source syntax profile.
 * @returns {string[]} Flattened command list.
 */
export declare const splitInlineCommands: (commands: string[], syntaxProfile?: SyntaxProfile) => string[];
/**
 * Splits sourced command lines, copying the original line onto every fragment.
 * @param {SourcedCommand[]} commands Sourced command lines to split.
 * @param {SyntaxProfile} [syntaxProfile] Active source syntax profile.
 * @returns {SourcedCommand[]} Flattened sourced command list.
 */
export declare const splitSourcedInlineCommands: (commands: SourcedCommand[], syntaxProfile?: SyntaxProfile) => SourcedCommand[];
/**
 * Splits a command string into words while preserving quoted segments.
 * @param {string} command The normalized command string.
 * @returns {string[]} Tokenized command words.
 */
export declare const splitCommandIntoWords: (command: string) => string[];
/**
 * Splits comma-separated values while respecting quoted text and parenthesized
 * function arguments.
 * @param {string} input Comma-delimited expression text.
 * @returns {string[]} Split values.
 */
export declare const splitRespectingFunctions: (input: string) => string[];
/**
 * Extracts the variable name from a define statement.
 * @param {string} line The line to extract the variable name from.
 * @returns {string | undefined} The variable name or `undefined` if the line is not a define statement.
 */
export declare const getDefineVariable: (line: string) => string | undefined;
/**
 * Checks whether a character can start a label identifier segment.
 * @param {string} char The single character to test.
 * @returns {boolean} `true` when the character can start an identifier.
 */
export declare function isLabelIdentifierStart(char: string): boolean;
/**
 * Checks whether a character can appear after the first character of a label identifier segment.
 * @param {string} char The single character to test.
 * @returns {boolean} `true` when the character can continue an identifier.
 */
export declare function isLabelIdentifierPart(char: string): boolean;
/**
 * Checks whether a token is a plain label/struct reference rather than an
 * arithmetic expression. This intentionally accepts dotted names and one
 * optional numeric index segment, but rejects operators such as `-` or `+`.
 * Purely numeric tokens are also treated as lookup candidates to preserve
 * legacy label-resolution behavior for values like `1`.
 * @param {string} input The token to classify.
 * @returns {boolean} `true` when the token is a bare label-style reference.
 */
export declare function isBareLabelReference(input: string): boolean;
/**
 * Self-contained command text helpers exposed as a static-style module object.
 */
export declare const CommandTextService: {
    readonly getDefineVariable: typeof getDefineVariable;
    readonly isBareLabelReference: typeof isBareLabelReference;
    readonly isLabelIdentifierPart: typeof isLabelIdentifierPart;
    readonly isLabelIdentifierStart: typeof isLabelIdentifierStart;
    readonly preprocessBlockCommands: typeof preprocessBlockCommands;
    readonly removeInlineComment: typeof removeInlineComment;
    readonly splitCommandIntoWords: typeof splitCommandIntoWords;
    readonly splitInlineCommands: typeof splitInlineCommands;
    readonly splitSourcedInlineCommands: typeof splitSourcedInlineCommands;
    readonly splitRespectingFunctions: typeof splitRespectingFunctions;
};
import { type SyntaxProfile } from "../syntax-profile.js";
//# sourceMappingURL=command-text-service.d.ts.map
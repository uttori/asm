/** A preprocessed command tagged with its original 0-based source line. */
export type SourcedCommand = {
    /** Physical extent is attached by the program boundary after normalization. */
    physical?: string;
    /** Normalized command text. */
    text: string;
    /** Zero-based line number in the source block. */
    line: number;
};
/** Result of splitting a source block into executable commands. */
export type PreprocessBlockCommandsResult = {
    /** Normalized command strings ready for execution. */
    commands: string[];
    /** Commands paired with originating zero-based line numbers. */
    sourcedCommands: SourcedCommand[];
    /** Unfinished text retained for multiline structured commands. */
    commandBuffer: string;
};
/** Only structured records and explicit asset calls acquire implicit physical-line continuation. */
export declare function isStructuredCommandStart(text: string): boolean;
/** Keep a parenthesized include buffered until its outer call closes; quoted filenames never affect depth. */
export declare function isOpenStructuredCommand(text: string): boolean;
/**
 * Removes inline comments from a command line while preserving semicolons
 * inside double-quoted text.
 * @param line The raw command line.
 * @param [syntaxProfile] Active source syntax profile.
 * @returns The comment-stripped command line.
 */
export declare const removeInlineComment: (line: string, syntaxProfile?: SyntaxProfile) => string;
/**
 * Normalizes a multi-line command block by trimming lines, removing comments,
 * and carrying line-continuation state across calls.
 * @param block Raw block text.
 * @param [commandBuffer] Existing continuation buffer.
 * @param [syntaxProfile] Active source syntax profile.
 * @returns Parsed commands and next buffer value.
 */
export declare const preprocessBlockCommands: (block: string, commandBuffer?: string, syntaxProfile?: SyntaxProfile) => PreprocessBlockCommandsResult;
/**
 * Splits inline `:` command chains into individual commands.
 * @param commands Command lines to split.
 * @param [syntaxProfile] Active source syntax profile.
 * @returns Flattened command list.
 */
export declare const splitInlineCommands: (commands: string[], syntaxProfile?: SyntaxProfile) => string[];
/**
 * Splits sourced command lines, copying the original line onto every fragment.
 * @param commands Sourced command lines to split.
 * @param [syntaxProfile] Active source syntax profile.
 * @returns Flattened sourced command list.
 */
export declare const splitSourcedInlineCommands: (commands: SourcedCommand[], syntaxProfile?: SyntaxProfile) => SourcedCommand[];
/**
 * Splits a command string into words while preserving quoted segments.
 * @param command The normalized command string.
 * @returns Tokenized command words.
 */
export declare const splitCommandIntoWords: (command: string) => string[];
/**
 * Splits comma-separated values while respecting quoted text and parenthesized
 * function arguments.
 * @param input Comma-delimited expression text.
 * @returns Split values.
 */
export declare const splitRespectingFunctions: (input: string) => string[];
/**
 * Extracts the variable name from a define statement.
 * @param line The line to extract the variable name from.
 * @returns The variable name or `undefined` if the line is not a define statement.
 */
export declare const getDefineVariable: (line: string) => string | undefined;
/**
 * Checks whether a character can start a label identifier segment.
 * @param char The single character to test.
 * @returns `true` when the character can start an identifier.
 */
export declare function isLabelIdentifierStart(char: string): boolean;
/**
 * Checks whether a character can appear after the first character of a label identifier segment.
 * @param char The single character to test.
 * @returns `true` when the character can continue an identifier.
 */
export declare function isLabelIdentifierPart(char: string): boolean;
/**
 * Checks whether a token is a plain label/struct reference rather than an
 * arithmetic expression. This intentionally accepts dotted names and one
 * optional numeric index segment, but rejects operators such as `-` or `+`.
 * Purely numeric tokens are also treated as lookup candidates to preserve
 * legacy label-resolution behavior for values like `1`.
 * @param input The token to classify.
 * @returns `true` when the token is a bare label-style reference.
 */
export declare function isBareLabelReference(input: string): boolean;
import { type SyntaxProfile } from "../syntax-profile.js";
//# sourceMappingURL=command-text-service.d.ts.map
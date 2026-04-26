export type PreprocessBlockCommandsResult = {
    commands: string[];
    commandBuffer: string;
};
/**
 * Removes inline comments from a command line while preserving semicolons
 * inside double-quoted text.
 * @param {string} line The raw command line.
 * @returns {string} The comment-stripped command line.
 */
export declare const removeInlineComment: (line: string) => string;
/**
 * Normalizes a multi-line command block by trimming lines, removing comments,
 * and carrying line-continuation state across calls.
 * @param {string} block Raw block text.
 * @param {string} [commandBuffer] Existing continuation buffer.
 * @returns {PreprocessBlockCommandsResult} Parsed commands and next buffer value.
 */
export declare const preprocessBlockCommands: (block: string, commandBuffer?: string) => PreprocessBlockCommandsResult;
/**
 * Splits inline `:` command chains into individual commands.
 * @param {string[]} commands Command lines to split.
 * @returns {string[]} Flattened command list.
 */
export declare const splitInlineCommands: (commands: string[]) => string[];
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
 * @returns {string | undefined} The variable name or null if the line is not a define statement.
 */
export declare const getDefineVariable: (line: string) => string | null;
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
    readonly getDefineVariable: (line: string) => string | null;
    readonly isBareLabelReference: typeof isBareLabelReference;
    readonly isLabelIdentifierPart: typeof isLabelIdentifierPart;
    readonly isLabelIdentifierStart: typeof isLabelIdentifierStart;
    readonly preprocessBlockCommands: (block: string, commandBuffer?: string) => PreprocessBlockCommandsResult;
    readonly removeInlineComment: (line: string) => string;
    readonly splitCommandIntoWords: (command: string) => string[];
    readonly splitInlineCommands: (commands: string[]) => string[];
    readonly splitRespectingFunctions: (input: string) => string[];
};
//# sourceMappingURL=command-text-service.d.ts.map
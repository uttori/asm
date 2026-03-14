export type CommandKind = "unknown" | "directive" | "opcodeCandidate" | "labelDefinition" | "staticAssignment" | "characterMapping" | "macroDefinitionOrInvoke" | "defineCommand" | "structCommand" | "commentOrEmpty";
export type CommandProvenance = {
    file: string;
    line: number;
    raw: string;
    normalized: string;
};
export type NormalizedCommand = {
    kind: CommandKind;
    source: CommandProvenance;
    command: string;
    words: string[];
    keyword: string;
    labelName?: string;
    assignmentTarget?: string;
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
 * @returns {NormalizedCommand} The pending command node.
 */
export declare function createPendingCommand(raw: string, file: string, line: number): NormalizedCommand;
/**
 * Replaces a command node's tokenized words and derived fields.
 * @param {NormalizedCommand} command The command node to update.
 * @param {string[]} words The updated token list.
 * @param {string} [normalized] Optional normalized command text.
 * @returns {NormalizedCommand} The same command node for chaining.
 */
export declare function setCommandWords(command: NormalizedCommand, words: string[], normalized?: string): NormalizedCommand;
/**
 * Reclassifies a normalized command without changing any other fields.
 * @param {NormalizedCommand} command The command node to update.
 * @param {CommandKind} kind The new command kind.
 * @returns {NormalizedCommand} The same command node for chaining.
 */
export declare function setCommandKind(command: NormalizedCommand, kind: CommandKind): NormalizedCommand;
//# sourceMappingURL=normalized-command.d.ts.map
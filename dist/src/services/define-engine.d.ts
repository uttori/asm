import { type NormalizedCommand } from "../ir/normalized-command.js";
export type DefineHost = {
    defines: Map<string, string>;
    resolvedefines(input: string): string;
    evaluateMath(input: string): number;
    processNestedCommand(command: string): void;
};
export declare class DefineEngine {
    readonly host: DefineHost;
    constructor(host: DefineHost);
    /**
     * Handles a define command.
     * @param {NormalizedCommand} commandNode The command node to handle.
     * @returns {boolean} `true` if the command was handled, `false` otherwise.
     */
    handleCommand(commandNode: NormalizedCommand): boolean;
    /**
     * Handles a define command.
     * @param {string} command The command to handle.
     */
    handleDefineCommand(command: string): void;
    /**
     * Resolves nested defines in a string.
     * @param {string} content The content to process.
     * @returns {string} The processed content with nested defines resolved.
     */
    processNestedDefines(content: string): string;
    /**
     * Resolves one level of defines in a string.
     * @param {string} content The content to process.
     * @returns {string} The processed content with one level of defines resolved.
     */
    resolveOneLevelOfDefines(content: string): string;
    /**
     * Resolves regular defines in a string.
     * @param {string} content The content to process.
     * @returns {string} The processed content with regular defines resolved.
     */
    resolveRegularDefines(content: string): string;
    /**
     * Resolves defines in a string literal.
     * @param {string} content The content to process.
     * @returns {string} The processed content with defines in string literal resolved.
     */
    resolveDefinesInStringLiteral(content: string): string;
    /**
     * Processes a value with braced defines.
     * @param {string} value The value to process.
     * @returns {string} The processed value with braced defines resolved.
     */
    processValueWithBracedDefines(value: string): string;
    /**
     * Applies a define operation.
     * @param {string} identifier The identifier to apply the operation to.
     * @param {string} operator The operator to apply.
     * @param {string} initialValue The initial value to apply the operation to.
     */
    applyDefineOperation(identifier: string, operator: string, initialValue: string): void;
}
//# sourceMappingURL=define-engine.d.ts.map
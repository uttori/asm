import { type NormalizedCommand } from "../ir/normalized-command.js";
export interface StructDefinition {
    name: string;
    /** The logical start address for the struct. */
    base: number;
    /** Running offset as member commands are processed. */
    offset: number;
    /** Final size (after alignment, etc.) */
    size: number;
    /** Mapping from member name (without the leading dot) to its offset. */
    labels: Map<string, number>;
    /** Optional alignment (if specified in endstruct). */
    align?: number;
    /** If this struct extends a parent. */
    parent?: string;
    /** Cached maximum child extension size, or zero when there are no extensions. */
    extensionSize: number;
}
export type StructHost = {
    currentStruct: StructDefinition | null;
    structs: Map<string, StructDefinition>;
    operandResolver: {
        getnum(input: string): number;
    };
    enterStructDefinition(base: number): void;
    restoreStructDefinition(): void;
    recordSymbolDefinition(kind: "struct" | "structMember", name: string, options?: {
        value?: number | string;
        containerName?: string;
    }): void;
};
export declare class StructEngine {
    readonly host: StructHost;
    constructor(host: StructHost);
    /**
     * Handles a struct mode command.
     * @param {NormalizedCommand} command The command to handle.
     * @returns {boolean} `true` if the command was handled, `false` otherwise.
     */
    handleStructMode(command: NormalizedCommand): boolean;
    /**
     * Handles a struct command.
     * @param {string[]} words The words of the command.
     */
    handleStruct(words: readonly string[]): void;
    /**
     * Handles an endstruct command.
     * @param {string[]} words The words of the command.
     */
    handleEndStruct(words: readonly string[]): void;
    /**
     * Checks whether a reference starts with a known struct name.
     * @param {string} labelRef The reference to inspect.
     * @returns {boolean} Whether the reference belongs to a known struct.
     */
    hasStructReference(labelRef: string): boolean;
    /**
     * Resolves a struct label.
     * @param {string} labelRef The label to resolve.
     * @returns {number} The resolved address.
     */
    resolveStructLabel(labelRef: string): number;
}
//# sourceMappingURL=struct-engine.d.ts.map
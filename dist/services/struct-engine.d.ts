import type { StructDefinition } from "../assembler.js";
import { type NormalizedCommand } from "../ir/normalized-command.js";
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
    handleStruct(words: string[]): void;
    /**
     * Handles an endstruct command.
     * @param {string[]} words The words of the command.
     */
    handleEndStruct(words: string[]): void;
    /**
     * Resolves a struct label.
     * @param {string} labelRef The label to resolve.
     * @returns {number} The resolved address.
     */
    resolveStructLabel(labelRef: string): number;
}
//# sourceMappingURL=struct-engine.d.ts.map
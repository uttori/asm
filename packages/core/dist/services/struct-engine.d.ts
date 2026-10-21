import { type DeclarationNode } from "../ir/declaration-node.js";
import type { ExpressionNode } from "../ir/expression-node.js";
import { type NormalizedCommand } from "../ir/normalized-command.js";
import type { ReferencePath } from "../ir/reference-path.js";
import { DataStructEngine, type DataStructHost } from "./data-struct-engine.js";
/** Encoding information is separate from Asar's address-only member labels. */
export interface StructField {
    name: string;
    offset: number;
    width: number;
    count: number;
    /** Even db[1] is an array. Skip members are opaque byte arrays. */
    array: boolean;
}
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
    /** Absent on legacy API-created definitions. Never infer types from label distances. */
    fields?: Map<string, StructField>;
    /** Optional valid logical array indexes, independent of the biased base address. */
    indexRange?: {
        first: number;
        count: number;
    };
}
export type StructHost = DataStructHost & {
    readonly addressWidth: number;
    currentStruct: StructDefinition | null;
    structs: Map<string, StructDefinition>;
    operandResolver: {
        getnum(input: string | ExpressionNode): number;
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
    readonly data: DataStructEngine;
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
    /** Bind a declaration's base in the current stage, before changing struct scope. */
    executeStruct(node: Extract<DeclarationNode, {
        kind: "struct";
    }>): void;
    /**
     * Handles an endstruct command.
     * @param {string[]} words The words of the command.
     */
    handleEndStruct(words: readonly string[]): void;
    /** Resolve options in source order; finalize the layout before restoring its enclosing cursor. */
    executeEndStruct(node: Extract<DeclarationNode, {
        kind: "endStruct";
    }>): void;
    /**
     * Checks whether a reference starts with a known struct name.
     * @param {string} labelRef The reference to inspect.
     * @returns {boolean} Whether the reference belongs to a known struct.
     */
    hasStructReference(labelRef: string): boolean;
    /** Resolve a parsed path directly; index values are refreshed in the caller's active stage. */
    resolveStructPath(path: ReferencePath, evaluate: (node: ExpressionNode) => number): number | undefined;
    /**
     * Resolves a struct label.
     * @param {string} labelRef The label to resolve.
     * @returns {number} The resolved address.
     */
    resolveStructLabel(labelRef: string): number;
}
//# sourceMappingURL=struct-engine.d.ts.map
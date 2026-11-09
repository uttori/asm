import { type DeclarationNode } from "../ir/declaration-node.js";
import type { ExpressionNode } from "../ir/expression-node.js";
import { type NormalizedCommand } from "../ir/normalized-command.js";
import type { ReferencePath } from "../ir/reference-path.js";
import { DataStructEngine, type DataStructHost } from "./data-struct-engine.js";
/** Encoding information is separate from Asar's address-only member labels. */
export interface StructField {
    /** Member label without the leading dot. */
    name: string;
    /** Byte offset from the struct base address. */
    offset: number;
    /** Storage width of one element in bytes. */
    width: number;
    /** Element count; one for scalars and skip blobs. */
    count: number;
    /** Even db[1] is an array. Skip members are opaque byte arrays. */
    array: boolean;
}
/** Mutable struct layout state accumulated while parsing struct members. */
export interface StructDefinition {
    /** Struct symbol name in the current namespace. */
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
/** Session services shared by struct layout and data struct emission. */
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
/** Parses struct declarations and delegates indexed rows to the data struct engine. */
export declare class StructEngine {
    readonly host: StructHost;
    /** Engine emitting indexed data struct tables for defined layouts. */
    readonly data: DataStructEngine;
    constructor(host: StructHost);
    /**
     * Handles a struct mode command.
     * @param command The command to handle.
     * @returns `true` if the command was handled, `false` otherwise.
     */
    handleStructMode(command: NormalizedCommand): boolean;
    /**
     * Handles a struct command.
     * @param words The words of the command.
     */
    handleStruct(words: readonly string[]): void;
    /** Bind a declaration's base in the current stage, before changing struct scope. */
    executeStruct(node: Extract<DeclarationNode, {
        kind: "struct";
    }>): void;
    /**
     * Handles an endstruct command.
     * @param words The words of the command.
     */
    handleEndStruct(words: readonly string[]): void;
    /** Resolve options in source order; finalize the layout before restoring its enclosing cursor. */
    executeEndStruct(node: Extract<DeclarationNode, {
        kind: "endStruct";
    }>): void;
    /**
     * Checks whether a reference starts with a known struct name.
     * @param labelRef The reference to inspect.
     * @returns Whether the reference belongs to a known struct.
     */
    hasStructReference(labelRef: string): boolean;
    /** Resolve a parsed path directly; index values are refreshed in the caller's active stage. */
    resolveStructPath(path: ReferencePath, evaluate: (node: ExpressionNode) => number): number | undefined;
    /**
     * Resolves a struct label.
     * @param labelRef The label to resolve.
     * @returns The resolved address.
     */
    resolveStructLabel(labelRef: string): number;
}
//# sourceMappingURL=struct-engine.d.ts.map
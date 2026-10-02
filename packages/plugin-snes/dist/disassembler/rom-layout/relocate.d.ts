/** Explicitly reviewed free space in the original ROM. Unexecuted bytes are never inferred free. */
export interface SnesFreeSpace {
    readonly id: string;
    readonly start: number;
    readonly end: number;
    readonly originalSha256: string;
}
/** Stable original identity and branch-specific placement. Length is the currently reserved extent. */
export interface SnesMovableObject {
    readonly id: string;
    readonly originalStart: number;
    readonly originalEnd: number;
    readonly start: number;
    readonly length: number;
    readonly alignment: number;
    /** File bytes per allowed bank; an allocation cannot straddle it. */
    readonly bankSize: 0x8000 | 0x10000;
    readonly movable: boolean;
    /** A declaration reviewed independently of trace coverage, covering numeric/indirect uses too. */
    readonly referencesComplete: boolean;
    /** Required for executable objects: no implicit fallthrough across their source boundaries. */
    readonly closedControlFlow?: boolean;
    /** Code callers must agree on near or long return; relocation never changes the calling convention. */
    readonly returnInstruction?: "RTS" | "RTL";
    /** Declared E/M/X at every RTS/RTL exit. Omission requires preserving the entry widths. */
    readonly exitState?: {
        readonly e: boolean;
        readonly m: boolean;
        readonly x: boolean;
    };
    readonly kind: "data" | "asset" | "code";
}
/** Supported encoded references. Each field carries expected bytes so stale inputs cannot be patched. */
export interface SnesRelocationReference {
    readonly id: string;
    readonly target: string;
    readonly offset: number;
    readonly expected: readonly number[];
    /** One of `RELOCATION_ENCODINGS`. Unknown values are rejected when the relocation is planned. */
    readonly encoding: string;
    /** Original/current logical bank for bank16; complete logical instruction end for relative encodings. */
    readonly bank?: number;
    readonly instructionEnd?: number;
    readonly addend?: number;
    readonly unitSize?: number;
    /** Required for low16/bank8: exactly one of each, sharing target and addend, forms a long pointer. */
    readonly pair?: string;
}
/** Refuse partial split pointers: repairing an offset alone can silently keep the old bank. */
export declare function assertSnesSplitReferences(references: readonly SnesRelocationReference[]): void;
/** Byte changes are a validation oracle for reviewable source/layout edits, not a ROM patch authoring path. */
export interface SnesRelocationPlan {
    readonly object: SnesMovableObject;
    readonly destination: number;
    readonly encodedLength: number;
    readonly repairs: readonly {
        readonly id: string;
        readonly offset: number;
        readonly before: readonly number[];
        readonly after: readonly number[];
    }[];
}
/** Encode a declared pointer/length/count for both relocation and ordinary saved-source validation. */
export declare function encodeSnesRelocationReference(reference: SnesRelocationReference, address: number, encodedLength: number): readonly number[];
/**
 * Deterministic first-fit placement over explicit free space. This planner never changes source,
 * invents reference completeness, expands a ROM, or inserts trampolines to force an allocation.
 */
export declare function planSnesRelocation(options: {
    readonly original: Uint8Array;
    readonly current: Uint8Array;
    readonly objects: readonly SnesMovableObject[];
    readonly freeSpace: readonly SnesFreeSpace[];
    readonly references: readonly SnesRelocationReference[];
    readonly objectId: string;
    readonly encodedLength: number;
    /** Explicit reviewed placement, including a return to the original extent; omitted means first fit. */
    readonly destination?: number;
    /** Mapper-proven conversion; return a negative value for unmappable offsets. */
    readonly logicalAddress: (offset: number) => number;
}): SnesRelocationPlan;
//# sourceMappingURL=relocate.d.ts.map
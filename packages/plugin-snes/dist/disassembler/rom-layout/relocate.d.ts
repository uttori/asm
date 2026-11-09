/** Explicitly reviewed free space in the original ROM. Unexecuted bytes are never inferred free. */
export interface SnesFreeSpace {
    /** Stable reviewer id referenced by relocation plans. */
    readonly id: string;
    /** Inclusive headerless ROM start of reviewed slack. */
    readonly start: number;
    /** Exclusive end of the half-open free interval. */
    readonly end: number;
    /** SHA-256 of the original bytes in this interval before any move. */
    readonly originalSha256: string;
}
/** Stable original identity and branch-specific placement. Length is the currently reserved extent. */
export interface SnesMovableObject {
    /** Stable object id shared by references and placement contracts. */
    readonly id: string;
    /** Original half-open ROM interval before relocation. */
    readonly originalStart: number;
    /** Exclusive original end offset. */
    readonly originalEnd: number;
    /** Current headerless ROM start after planning. */
    readonly start: number;
    /** Reserved byte length at the current start. */
    readonly length: number;
    /** Allocation must begin on this byte boundary. */
    readonly alignment: number;
    /** File bytes per allowed bank; an allocation cannot straddle it. */
    readonly bankSize: 0x8000 | 0x10000;
    /** When false, start and length are fixed and only references may be repaired. */
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
    /** Distinguishes executable objects from inert data and packaged assets. */
    readonly kind: "data" | "asset" | "code";
}
/** Supported encoded references. Each field carries expected bytes so stale inputs cannot be patched. */
export interface SnesRelocationReference {
    /** Unique reference field id within one relocation review. */
    readonly id: string;
    /** Movable object id whose logical base encodes this field. */
    readonly target: string;
    /** Headerless ROM offset of the first encoded byte. */
    readonly offset: number;
    /** Exact bytes that must match before a repair is applied. */
    readonly expected: readonly number[];
    /** One of `RELOCATION_ENCODINGS`. Unknown values are rejected when the relocation is planned. */
    readonly encoding: string;
    /** Original/current logical bank for bank16; complete logical instruction end for relative encodings. */
    readonly bank?: number;
    /** Logical end offset of the hosting instruction for PC-relative encodings. */
    readonly instructionEnd?: number;
    /** Byte or record offset added after target resolution. */
    readonly addend?: number;
    /** Stride multiplier for count encodings. */
    readonly unitSize?: number;
    /** Required for low16/bank8: exactly one of each, sharing target and addend, forms a long pointer. */
    readonly pair?: string;
}
/** Refuse partial split pointers: repairing an offset alone can silently keep the old bank. */
export declare function assertSnesSplitReferences(references: readonly SnesRelocationReference[]): void;
/** Byte changes are a validation oracle for reviewable source/layout edits, not a ROM patch authoring path. */
export interface SnesRelocationPlan {
    /** Object being moved together with its relocation metadata. */
    readonly object: SnesMovableObject;
    /** New headerless ROM start after allocation. */
    readonly destination: number;
    /** Byte length of the object image at the destination. */
    readonly encodedLength: number;
    /** Patches to encoded reference fields that must track the move. */
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
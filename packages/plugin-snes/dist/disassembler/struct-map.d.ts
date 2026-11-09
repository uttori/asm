import { type SnesStructInstructionUse } from "./struct-instruction-uses.js";
/** Optional, user-owned layout and address bindings consumed by source export. */
export declare const SNES_STRUCT_MAP_SOURCE = "struct-map.json";
/** Generated native structs included by the exported assembler entry point. */
export declare const SNES_STRUCT_DEFINES_SOURCE = "structs.asm";
/** A byte field. Gaps remain opaque and are never inferred to be zero. */
export interface SnesStructField {
    /** Assembly field identifier within the layout. */
    readonly name: string;
    /** Byte offset within the layout, not a CPU address. Fields cannot overlap. */
    readonly offset: number;
    /** Positive byte width. Must fit the layout and agree with type when type is supplied. */
    readonly size: number;
    /** Explicit assembly encoding, such as dw or db[2]. Omission selects an encoding from size. */
    readonly type?: string;
    /** Optional documentation emitted beside the field in generated structs. */
    readonly description?: string;
}
/** Reusable layout whose native struct has a zero base. */
export interface SnesStructLayout {
    /** Stable layout id referenced by bindings and expressions. */
    readonly id: string;
    /** Record stride in bytes, from 1 through 65536. Opaque gaps count toward the stride. */
    readonly size: number;
    /** Ordered non-overlapping members covering the stride. */
    readonly fields: readonly SnesStructField[];
    /** Free-form layout notes preserved in metadata. */
    readonly notes: readonly string[];
}
/** A named array at a canonical CPU address. ROM arrays also own a file interval. */
export interface SnesStructBinding {
    /** Exported assembly symbol for the binding root. */
    readonly name: string;
    /** Layout describing each record in the binding array. */
    readonly structure: SnesStructLayout;
    /** Canonical CPU address of the first physical record. WRAM aliases are normalized. */
    readonly address: number;
    /** Positive number of consecutive records. Their byte ranges must not overlap another binding. */
    readonly count: number;
    /** Logical index of the first physical record (for example, one-based map IDs). */
    readonly firstIndex: number;
    /** Headerless ROM offset. Omit for RAM bindings, which generate names but no ROM data. */
    readonly fileOffset?: number;
    /** Binding-level notes separate from per-entry ROM comments. */
    readonly notes: readonly string[];
    /** Sparse ROM-row comments keyed by logical index, including firstIndex; omitted rows stay unnamed. */
    readonly entryComments?: Readonly<Record<number, string>>;
}
/** Validated source metadata, retaining exact input bytes for drift detection. */
export interface LoadedSnesStructMap {
    /** Reviewed scalar values usable in guarded operands; never inferred from matching literals. */
    readonly constants?: readonly SnesStructConstant[];
    /** Validated zero-based layouts referenced by bindings. */
    readonly structures: readonly SnesStructLayout[];
    /** Physical record bindings with optional ROM placement. */
    readonly bindings: readonly SnesStructBinding[];
    /** Optional, explicitly justified operands and capture references at guarded instruction sites. */
    readonly instructionUses?: readonly SnesStructInstructionUse[];
    /** Exact struct-map.json bytes used for drift detection. */
    readonly sourceBytes: Uint8Array;
}
/** An exact assembly value with its units or semantic contract documented at the declaration. */
export interface SnesStructConstant {
    /** Identifier usable in guarded struct expressions. */
    readonly name: string;
    /** Exact integer value with documented units or semantics. */
    readonly value: number;
    /** Human-readable contract for the constant. */
    readonly description: string;
}
/** One physical ROM field, including opaque gaps, ready for byte-preserving emission. */
export interface SnesStructRomField {
    /** Inclusive headerless ROM start of this emission slice. */
    readonly start: number;
    /** Exclusive end offset of the slice. */
    readonly end: number;
    /** Native assembly expression covering the slice bytes. */
    readonly expression: string;
    /** Owning physical record when this slice is part of a structured ROM row. */
    readonly record?: SnesStructRomRecord;
}
/** Physical record ownership lets export regroup fields without losing interior metadata. */
export interface SnesStructRomRecord {
    /** Inclusive ROM start of the physical record bytes. */
    readonly start: number;
    /** Exclusive ROM end of the physical record bytes. */
    readonly end: number;
    /** Binding owning the physical record bytes. */
    readonly binding: SnesStructBinding;
    /** Logical index of this record within the binding. */
    readonly index: number;
}
/**
 * Validate layouts and non-overlapping bindings before any generated files are changed.
 * Extra source/provenance properties are retained in the input file, not interpreted as code.
 * @param value Parsed JSON metadata.
 * @returns Normalized layouts and bindings.
 */
export declare const validateSnesStructMap: (value: unknown) => Omit<LoadedSnesStructMap, "sourceBytes">;
/**
 * Load optional layout metadata. Existing projects without a struct map export as before.
 * @param directory Source-export root.
 * @returns Validated metadata when present.
 */
export declare const loadSnesStructMap: (directory: string) => LoadedSnesStructMap | undefined;
/**
 * Render both reusable offsets and addressed native structs from the same field definitions.
 * @param map Validated layouts and bindings.
 * @returns Native assembler source. Structs reserve offsets without emitting bytes.
 */
export declare const renderSnesStructDefines: (map: LoadedSnesStructMap) => string;
/**
 * Index known data bytes by canonical CPU address, leaving unknown gaps unnamed.
 * @param map Optional validated metadata.
 * @param [indexed] Also name biased array bases used with a runtime CPU index.
 * @returns Native field expressions, including interior-byte offsets.
 */
export declare const indexSnesStructFields: (map: LoadedSnesStructMap | undefined, indexed?: boolean) => ReadonlyMap<number, string>;
/**
 * Validate CPU/file continuity and expand ROM arrays into physical fields for source emission.
 * @param map Optional validated metadata.
 * @param romSize Headerless ROM size.
 * @param cpuAddress Mapper conversion for a file offset.
 * @returns Physical field ranges, sorted by ROM offset.
 */
export declare const planSnesStructRomFields: (map: LoadedSnesStructMap | undefined, romSize: number, cpuAddress: (offset: number) => number) => readonly SnesStructRomField[];
/**
 * Encode every named field (including opaque gaps) from immutable ROM bytes. Field descriptions
 * stay on the authoritative declarations in structs.asm so every data row does not repeat them.
 * @param record Complete, mapped record ownership.
 * @param bytes Exactly the original record bytes.
 * @returns Named initializer assignments, including opaque gaps.
 */
export declare const renderSnesStructInitializerFields: (record: SnesStructRomRecord, bytes: Uint8Array) => readonly {
    assignment: string;
}[];
/**
 * Render one complete record as a compact native initializer without field documentation.
 * @param record Complete mapped record ownership.
 * @param bytes Exact record bytes from the ROM.
 * @returns Single-line brace initializer for callers that manage source layout.
 */
export declare const renderSnesStructInitializer: (record: SnesStructRomRecord, bytes: Uint8Array) => string;
/**
 * Emit a complete field or a metadata-split fragment without changing any original byte.
 * The assertion makes the binding's actual placement part of the assembler build contract.
 * @param field Physical field and its native address expression.
 * @param start Fragment file offset.
 * @param bytes Exact fragment bytes from the ROM.
 * @returns Address assertion plus native data directive.
 */
export declare const renderSnesStructData: (field: SnesStructRomField, start: number, bytes: Uint8Array) => readonly string[];
//# sourceMappingURL=struct-map.d.ts.map
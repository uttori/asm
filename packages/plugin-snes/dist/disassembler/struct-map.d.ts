/** Optional, user-owned layout and address bindings consumed by source export. */
export declare const SNES_STRUCT_MAP_SOURCE = "struct-map.json";
/** Generated native structs included by the exported assembler entry point. */
export declare const SNES_STRUCT_DEFINES_SOURCE = "structs.asm";
/** A byte field; gaps remain opaque and are never inferred to be zero. */
export interface SnesStructField {
    readonly name: string;
    readonly offset: number;
    readonly size: number;
    /** Explicit assembly encoding, e.g. dw or db[2]; size-only v1 inputs still work. */
    readonly type?: string;
    readonly description?: string;
}
/** Reusable layout whose native struct has a zero base. */
export interface SnesStructLayout {
    readonly id: string;
    readonly size: number;
    readonly fields: readonly SnesStructField[];
    readonly notes: readonly string[];
}
/** A named array at a canonical CPU address; ROM arrays also own a file interval. */
export interface SnesStructBinding {
    readonly name: string;
    readonly structure: SnesStructLayout;
    readonly address: number;
    readonly count: number;
    /** Logical index of the first physical record (for example, one-based map IDs). */
    readonly firstIndex: number;
    readonly fileOffset?: number;
    readonly notes: readonly string[];
}
/** Validated source metadata, retaining exact input bytes for drift detection. */
export interface LoadedSnesStructMap {
    readonly structures: readonly SnesStructLayout[];
    readonly bindings: readonly SnesStructBinding[];
    readonly sourceBytes: Uint8Array;
}
/** One physical ROM field, including opaque gaps, ready for byte-preserving emission. */
export interface SnesStructRomField {
    readonly start: number;
    readonly end: number;
    readonly expression: string;
    readonly record?: SnesStructRomRecord;
}
/** Physical record ownership lets export regroup fields without losing interior metadata. */
export interface SnesStructRomRecord {
    readonly start: number;
    readonly end: number;
    readonly binding: SnesStructBinding;
    readonly index: number;
}
/**
 * Validate layouts and non-overlapping bindings before any generated files are changed.
 * Extra source/provenance properties are retained in the input file, not interpreted as code.
 * @param {unknown} value Parsed JSON metadata.
 * @returns {Omit<LoadedSnesStructMap, "sourceBytes">} Normalized layouts and bindings.
 */
export declare const validateSnesStructMap: (value: unknown) => Omit<LoadedSnesStructMap, "sourceBytes">;
/**
 * Load optional layout metadata; existing projects without a struct map export as before.
 * @param {string} directory Source-export root.
 * @returns {LoadedSnesStructMap | undefined} Validated metadata when present.
 */
export declare const loadSnesStructMap: (directory: string) => LoadedSnesStructMap | undefined;
/**
 * Render both reusable offsets and addressed native structs from the same field definitions.
 * @param {LoadedSnesStructMap} map Validated layouts and bindings.
 * @returns {string} Native assembler source; structs reserve offsets without emitting bytes.
 */
export declare const renderSnesStructDefines: (map: LoadedSnesStructMap) => string;
/**
 * Index known data bytes by canonical CPU address, leaving unknown gaps unnamed.
 * @param {LoadedSnesStructMap | undefined} map Optional validated metadata.
 * @param {boolean} [indexed] Also name biased array bases used with a runtime CPU index.
 * @returns {ReadonlyMap<number, string>} Native field expressions, including interior-byte offsets.
 */
export declare const indexSnesStructFields: (map: LoadedSnesStructMap | undefined, indexed?: boolean) => ReadonlyMap<number, string>;
/**
 * Validate CPU/file continuity and expand ROM arrays into physical fields for source emission.
 * @param {LoadedSnesStructMap | undefined} map Optional validated metadata.
 * @param {number} romSize Headerless ROM size.
 * @param {(offset: number) => number} cpuAddress Mapper conversion for a file offset.
 * @returns {readonly SnesStructRomField[]} Physical field ranges, sorted by ROM offset.
 */
export declare const planSnesStructRomFields: (map: LoadedSnesStructMap | undefined, romSize: number, cpuAddress: (offset: number) => number) => readonly SnesStructRomField[];
/**
 * Encode every named field (including opaque gaps) from immutable ROM bytes.
 * @param {SnesStructRomRecord} record Complete, mapped record ownership.
 * @param {Uint8Array} bytes Exactly the original record bytes.
 * @returns {string} Named literal suitable for dataStruct or a dataStructs row.
 */
export declare const renderSnesStructInitializer: (record: SnesStructRomRecord, bytes: Uint8Array) => string;
/**
 * Emit a complete field or a metadata-split fragment without changing any original byte.
 * The assertion makes the binding's actual placement part of the assembler build contract.
 * @param {SnesStructRomField} field Physical field and its native address expression.
 * @param {number} start Fragment file offset.
 * @param {Uint8Array} bytes Exact fragment bytes from the ROM.
 * @returns {readonly string[]} Address assertion plus native data directive.
 */
export declare const renderSnesStructData: (field: SnesStructRomField, start: number, bytes: Uint8Array) => readonly string[];
//# sourceMappingURL=struct-map.d.ts.map
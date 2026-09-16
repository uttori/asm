/** Format identifier for a user-maintained SNES RAM map. */
export declare const SNES_RAM_MAP_FORMAT = "uttori-asm-snes-ram-map";
/** Current RAM-map schema version. */
export declare const SNES_RAM_MAP_SCHEMA_VERSION = 1;
/** User-owned RAM-map filename read during every source export. */
export declare const SNES_RAM_MAP_SOURCE = "ram-map.json";
/** Generated JSON Schema filename used by editors. */
export declare const SNES_RAM_MAP_SCHEMA_SOURCE = "ram-map.schema.json";
/** Generated assembly definitions included by `main.asm`. */
export declare const SNES_RAM_DEFINES_SOURCE = "ram-defines.asm";
/** One editable RAM variable as represented in `ram-map.json`. */
export interface SnesRamMapVariableInput {
    readonly name: string;
    /** CPU bus address as `$7EA171`, `0x7EA171`, or an integer; never a physical SRAM offset. */
    readonly address: string | number;
    /** Defaults to WRAM. SRAM is an explicit cartridge-window declaration with exact-address lookup. */
    readonly memory?: "wram" | "sram";
    /** Number of bytes occupied, used for documentation rather than allocation. */
    readonly size?: number;
    readonly category?: string;
    readonly description: string;
    readonly notes?: readonly string[];
}
/** Versioned, user-owned RAM-map document. */
export interface SnesRamMapFile {
    readonly $schema?: string;
    readonly format: typeof SNES_RAM_MAP_FORMAT;
    readonly schemaVersion: typeof SNES_RAM_MAP_SCHEMA_VERSION;
    readonly source?: string;
    readonly variables: readonly SnesRamMapVariableInput[];
}
/** Validated RAM variable used by source generation and operand lookup. */
export interface SnesRamMapVariable {
    readonly name: string;
    readonly address: number;
    /** Omitted means WRAM; SRAM addresses are not normalized across cartridge-dependent mirrors. */
    readonly memory?: "wram" | "sram";
    readonly size: number;
    readonly category?: string;
    readonly description: string;
    readonly notes: readonly string[];
}
/** Validated RAM-map document plus the exact source bytes used for provenance. */
export interface LoadedSnesRamMap {
    readonly file: SnesRamMapFile;
    readonly variables: readonly SnesRamMapVariable[];
    readonly sourceBytes: Uint8Array;
}
/**
 * Validates and normalizes a RAM-map object without reading the filesystem.
 * @param {unknown} value Parsed JSON value.
 * @returns {readonly SnesRamMapVariable[]} Deterministically sorted variables.
 */
export declare const validateSnesRamMap: (value: unknown) => readonly SnesRamMapVariable[];
/**
 * Returns the canonical empty RAM-map file created for new projects.
 * @returns {SnesRamMapFile} A versioned empty editable map.
 */
export declare const emptySnesRamMap: () => SnesRamMapFile;
/**
 * Loads the user-owned RAM map, creating an empty editable map when absent.
 * @param {string} directory Generated-source root.
 * @returns {LoadedSnesRamMap} Validated variables and exact input bytes.
 */
export declare const loadSnesRamMap: (directory: string) => LoadedSnesRamMap;
/**
 * Maps WRAM mirrors in banks `$00–$3F`/`$80–$BF` to canonical `$7E0000–$7E1FFF`.
 * @param {number} address 24-bit CPU address.
 * @returns {number | undefined} Canonical WRAM address, or undefined outside WRAM.
 */
export declare const canonicalSnesWramAddress: (address: number) => number | undefined;
/**
 * Builds a range-aware address lookup for RAM-variable substitution.
 * @param {readonly SnesRamMapVariable[]} variables Validated, non-overlapping RAM variables.
 * @returns {ReadonlyMap<number, SnesRamMapVariable>} Every known byte address mapped to its variable.
 */
export declare const indexSnesRamMap: (variables: readonly SnesRamMapVariable[]) => ReadonlyMap<number, SnesRamMapVariable>;
/**
 * Renders a documented generated definition file from a validated RAM map.
 * @param {readonly SnesRamMapVariable[]} variables Validated RAM variables.
 * @returns {string} Generated assembler definitions with hover-ready comments.
 */
export declare const renderSnesRamDefines: (variables: readonly SnesRamMapVariable[]) => string;
/**
 * Renders the local JSON Schema included beside every RAM map.
 * @returns {string} Canonical JSON Schema text.
 */
export declare const renderSnesRamMapSchema: () => string;
//# sourceMappingURL=ram-map.d.ts.map
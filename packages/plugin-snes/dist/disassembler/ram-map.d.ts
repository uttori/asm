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
    /** Assembly identifier emitted in generated RAM defines. */
    readonly name: string;
    /** CPU bus address as `$7EA171`, `0x7EA171`, or an integer. Never a physical SRAM offset. */
    readonly address: string | number;
    /** Defaults to WRAM. SRAM is an explicit cartridge-window declaration with exact-address lookup. */
    readonly memory?: "wram" | "sram";
    /** Number of bytes occupied, used for documentation rather than allocation. */
    readonly size?: number;
    /** Optional grouping label for generated documentation. */
    readonly category?: string;
    /** Required human-readable summary for export comments. */
    readonly description: string;
    /** Additional free-form notes preserved in metadata. */
    readonly notes?: readonly string[];
    /** Provenance citations, emitted only when includeSourceInformation is true. */
    readonly sources?: readonly string[];
}
/** Versioned, user-owned RAM-map document. */
export interface SnesRamMapFile {
    /** Optional JSON Schema URI for editor validation. */
    readonly $schema?: string;
    /** Discriminator matching SNES_RAM_MAP_FORMAT. */
    readonly format: typeof SNES_RAM_MAP_FORMAT;
    /** Document schema generation consumed by loaders. */
    readonly schemaVersion: typeof SNES_RAM_MAP_SCHEMA_VERSION;
    /** Optional provenance string stored in the map file itself. */
    readonly source?: string;
    /** Include provenance citations in generated definition comments. Defaults to false. */
    readonly includeSourceInformation?: boolean;
    /** User-authored variable declarations validated on load. */
    readonly variables: readonly SnesRamMapVariableInput[];
}
/** Validated RAM variable used by source generation and operand lookup. */
export interface SnesRamMapVariable {
    /** Normalized assembly identifier. */
    readonly name: string;
    /** Canonical 24-bit CPU bus address after parsing. */
    readonly address: number;
    /** Omitted means WRAM. SRAM addresses are not normalized across cartridge-dependent mirrors. */
    readonly memory?: "wram" | "sram";
    /** Documented byte width defaulting to one when omitted in JSON. */
    readonly size: number;
    /** Optional grouping label echoed in generated documentation. */
    readonly category?: string;
    /** Required summary copied into generated RAM define comments. */
    readonly description: string;
    /** Sanitized note lines, never empty strings. */
    readonly notes: readonly string[];
    /** Explicit citations kept separate from descriptive notes for optional source output. */
    readonly sources?: readonly string[];
}
/** Validated RAM-map document plus the exact source bytes used for provenance. */
export interface LoadedSnesRamMap {
    /** Parsed document after schema validation. */
    readonly file: SnesRamMapFile;
    /** Normalized variables ready for define generation. */
    readonly variables: readonly SnesRamMapVariable[];
    /** Exact ram-map.json bytes used for content-hash provenance. */
    readonly sourceBytes: Uint8Array;
}
/**
 * Validates and normalizes a RAM-map object without reading the filesystem.
 * @param value Parsed JSON value.
 * @returns Deterministically sorted variables.
 */
export declare const validateSnesRamMap: (value: unknown) => readonly SnesRamMapVariable[];
/**
 * Returns the canonical empty RAM-map file created for new projects.
 * @returns A versioned empty editable map.
 */
export declare const emptySnesRamMap: () => SnesRamMapFile;
/**
 * Loads the user-owned RAM map, creating an empty editable map when absent.
 * @param directory Generated-source root.
 * @returns Validated variables and exact input bytes.
 */
export declare const loadSnesRamMap: (directory: string) => LoadedSnesRamMap;
/**
 * Maps WRAM mirrors in banks `$00–$3F`/`$80–$BF` to canonical `$7E0000–$7E1FFF`.
 * @param address 24-bit CPU address.
 * @returns Canonical WRAM address, or undefined outside WRAM.
 */
export declare const canonicalSnesWramAddress: (address: number) => number | undefined;
/**
 * Builds a range-aware address lookup for RAM-variable substitution.
 * @param variables Validated, non-overlapping RAM variables.
 * @returns Every known byte address mapped to its variable.
 */
export declare const indexSnesRamMap: (variables: readonly SnesRamMapVariable[]) => ReadonlyMap<number, SnesRamMapVariable>;
/**
 * Renders a documented generated definition file from a validated RAM map.
 * @param variables Validated RAM variables.
 * @param options Source citations are omitted by default; descriptive notes remain visible.
 * @returns Generated assembler definitions with hover-ready comments.
 */
export declare const renderSnesRamDefines: (variables: readonly SnesRamMapVariable[], options?: Pick<SnesRamMapFile, "includeSourceInformation">) => string;
/**
 * Renders the local JSON Schema included beside every RAM map.
 * @returns Canonical JSON Schema text.
 */
export declare const renderSnesRamMapSchema: () => string;
//# sourceMappingURL=ram-map.d.ts.map
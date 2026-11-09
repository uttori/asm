/**
 * Minimal ld65 linker-config parser for the NES iNES target.
 *
 * MEMORY / SEGMENTS / SYMBOLS support is shared by the flat NES assembler
 * and the portable link-recipe adapter. Parsing itself never places sections.
 */
import { type AssemblyLinkRecipe } from "@uttori/asm-core";
/** One ld65 MEMORY area. */
export type Ld65MemoryRegion = {
    /** MEMORY area name referenced by segment `load`/`run`. */
    readonly name: string;
    /** First logical address of the area. */
    readonly start: number;
    /** Area size in bytes. */
    readonly size: number;
    /**
     * Byte offset of this region in the linked image (`file = %O`).
     * `-1` when `file = ""` (RAM / overlay run area).
     */
    readonly fileOffset: number;
    /** True when unused bytes of a file-backed area are padded to `size`. */
    readonly fill: boolean;
    /** Padding byte used when `fill` is true; defaults to 0. */
    readonly fillval: number;
};
/** One ld65 SEGMENTS entry. */
export type Ld65Segment = {
    /** Segment name selected by `.segment`. */
    readonly name: string;
    /** MEMORY area holding the segment's bytes in the image. */
    readonly load: string;
    /** MEMORY area where the segment executes; equals `load` when not specified. */
    readonly run: string;
    /** Fixed start address within the load area, or undefined to place after the previous segment. */
    readonly start: number | undefined;
    /** True when `__NAME_LOAD__`, `__NAME_RUN__`, and `__NAME_SIZE__` symbols are generated. */
    readonly define: boolean;
    /** ld65 segment type (`ro`, `rw`, `bss`, `zp`, ...); defaults to `ro`. */
    readonly type: string;
};
/** One ld65 SYMBOLS entry. */
export type Ld65Symbol = {
    /** Symbol name. */
    readonly name: string;
    /** Unevaluated `value` expression text. */
    readonly valueExpr: string;
};
/** Parsed ld65 configuration in declaration order. */
export type Ld65Config = {
    /** MEMORY areas keyed by name, in declaration order. */
    readonly memories: ReadonlyMap<string, Ld65MemoryRegion>;
    /** Segments keyed by name, in declaration order. */
    readonly segments: ReadonlyMap<string, Ld65Segment>;
    /** SYMBOLS entries in declaration order. */
    readonly symbols: readonly Ld65Symbol[];
    /** Total size of `file = %O` regions, in order of MEMORY declaration. */
    readonly imageSize: number;
};
/** Preserve declaration order and RAM/load/run distinctions without assigning object contributions. */
export declare function ld65LinkRecipe(config: Ld65Config, target?: string): AssemblyLinkRecipe;
/**
 * Returns the built-in 32 KiB `$8000` layout used when a target omits `linkerConfig`.
 * @returns A minimal ld65 config.
 */
export declare function defaultLd65ConfigText(): string;
/**
 * Parses an ld65 config string into memories, segments, and exported symbols.
 * @param source Linker configuration text.
 * @returns The parsed layout.
 */
export declare function parseLd65Config(source: string): Ld65Config;
/**
 * Linker-defined names produced by `define = yes` plus the SYMBOLS block.
 * @param config Parsed linker configuration.
 * @returns Symbol names that must stay session-global.
 */
export declare function linkerDefinedSymbolNames(config: Ld65Config): string[];
//# sourceMappingURL=linker-config.d.ts.map
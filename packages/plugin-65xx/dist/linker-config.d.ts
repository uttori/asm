/**
 * Minimal ld65 linker-config parser for the NES iNES target.
 *
 * Enough of MEMORY / SEGMENTS / SYMBOLS to assemble ca65 sources that emit a
 * flat image (Zelda 1's `Z.cfg`) without producing relocatable objects.
 */
export type Ld65MemoryRegion = {
    readonly name: string;
    readonly start: number;
    readonly size: number;
    /**
     * Byte offset of this region in the linked image (`file = %O`).
     * `-1` when `file = ""` (RAM / overlay run area).
     */
    readonly fileOffset: number;
    readonly fill: boolean;
    readonly fillval: number;
};
export type Ld65Segment = {
    readonly name: string;
    readonly load: string;
    readonly run: string;
    readonly start: number | undefined;
    readonly define: boolean;
    readonly type: string;
};
export type Ld65Symbol = {
    readonly name: string;
    readonly valueExpr: string;
};
export type Ld65Config = {
    readonly memories: ReadonlyMap<string, Ld65MemoryRegion>;
    readonly segments: ReadonlyMap<string, Ld65Segment>;
    readonly symbols: readonly Ld65Symbol[];
    /** Total size of `file = %O` regions, in order of MEMORY declaration. */
    readonly imageSize: number;
};
/**
 * Returns the built-in 32 KiB `$8000` layout used when a target omits `linkerConfig`.
 * @returns {string} A minimal ld65 config.
 */
export declare function defaultLd65ConfigText(): string;
/**
 * Parses an ld65 config string into memories, segments, and exported symbols.
 * @param {string} source Linker configuration text.
 * @returns {Ld65Config} The parsed layout.
 */
export declare function parseLd65Config(source: string): Ld65Config;
/**
 * Linker-defined names produced by `define = yes` plus the SYMBOLS block.
 * @param {Ld65Config} config Parsed linker configuration.
 * @returns {string[]} Symbol names that must stay session-global.
 */
export declare function linkerDefinedSymbolNames(config: Ld65Config): string[];
//# sourceMappingURL=linker-config.d.ts.map
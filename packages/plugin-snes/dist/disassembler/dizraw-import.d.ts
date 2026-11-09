import type { AnalysisProjectShards, ImportReport, ProjectMapping } from "@uttori/asm-disassembler";
/** Native shards and loss report produced from one `.dizraw` import. */
export interface DizRawImportResult {
    /** Mapper/speed taken from `Data.RomMapMode` / `RomSpeed`. */
    readonly mapping: ProjectMapping;
    /** Labels, comments, regions, classification intervals, and import evidence. */
    readonly shards: AnalysisProjectShards;
    /** Counts plus a loss list for DiztinGUIsh-only fields that are not portable. */
    readonly report: ImportReport;
    /** Number of per-byte metadata rows after expansion (should match ROM size). */
    readonly metadataBytes: number;
}
/** Safety and identity options for `importDizRaw`. */
export interface DizRawImportOptions {
    /** Display name recorded in the import report. Defaults to `import.dizraw`. */
    readonly sourceName?: string;
    /** When set, the expanded RomBytes row count must equal this headerless size. */
    readonly expectedRomSize?: number;
    /** Expansion cap for compressed/repeated RomBytes. Default 16 MiB. */
    readonly maximumMetadataBytes?: number;
}
/**
 * Imports uncompressed XML `.dizraw` (DiztinGUIsh project) into native shards.
 * Compressed `.diz` is rejected. Mapper, speed, labels, comments, regions,
 * per-byte classification, architecture, M/X, DBR, direct page, and in/out/end/read
 * points are imported. UI settings and context-mapping aliases are reported as loss.
 * @param xml Uncompressed `.dizraw` XML document.
 * @param [options] Source name, ROM-size check, and expansion cap.
 * @returns Mapping, shards, loss report, and metadata row count.
 */
export declare const importDizRaw: (xml: string, options?: DizRawImportOptions) => DizRawImportResult;
//# sourceMappingURL=dizraw-import.d.ts.map
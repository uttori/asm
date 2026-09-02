import { type DecodedInstruction } from "@uttori/asm-core";
import { type AnalysisProjectManifest, type AnalysisProjectShards, type RomImage, type SourceExportManifest } from "@uttori/asm-disassembler";
/** Options for `exportSnes65816Source`. `sourceProjectSha256` is required provenance. */
export interface SnesSourceExportOptions {
    /**
     * Overwrite an existing export directory. Without this, a populated directory
     * that is not a previous export, or a previous export whose files drifted, is rejected.
     */
    readonly force?: boolean;
    /** SHA-256 of the analysis project that produced this export (provenance). */
    readonly sourceProjectSha256: string;
}
/**
 * Formats one decoded instruction with explicit native operand-width qualification.
 * @param {DecodedInstruction} instruction Decoded 65816 instruction.
 * @returns {string} Native source with a `.b`, `.w`, or `.l` suffix where width is selectable.
 */
export declare const formatSnes65816SourceInstruction: (instruction: DecodedInstruction) => string;
/**
 * Writes a deterministic 65816 source tree that can be reassembled with this plugin.
 * Confident CFG nodes become width-qualified instructions; everything else is
 * `incbin` assets. Banks, SNES header, vectors, and an optional 512-byte copier
 * header are split at mapper-aware cuts. Checksums are preserved, not recomputed.
 * @param {{ readonly manifest: AnalysisProjectManifest; readonly shards: AnalysisProjectShards }} project Loaded analysis project.
 * @param {RomImage} rom Immutable ROM used for asset bytes and copier-header extraction.
 * @param {string} directory Destination directory (`main.asm`, `banks/`, `assets/`, manifest).
 * @param {SnesSourceExportOptions} options Provenance hash and optional `--force`.
 * @returns {SourceExportManifest} Written file list, spans, and rebuild configuration.
 */
export declare const exportSnes65816Source: (project: {
    readonly manifest: AnalysisProjectManifest;
    readonly shards: AnalysisProjectShards;
}, rom: RomImage, directory: string, options: SnesSourceExportOptions) => SourceExportManifest;
//# sourceMappingURL=source-export.d.ts.map
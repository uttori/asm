import { type DecodedInstruction } from "@uttori/asm-core";
import { type InstructionExportRecord, type AnalysisProjectManifest, type AnalysisProjectShards, type RomImage, type SourceExportManifest } from "@uttori/asm-disassembler";
import { type SnesRamMapVariable } from "./ram-map.js";
import { type SnesMapper } from "./rom-header.js";
/** Options for `exportSnes65816Source`. `sourceProjectSha256` is required provenance. */
export interface SnesSourceExportOptions {
    /**
     * Overwrite an existing export directory. Without this, a populated directory
     * that is not a previous export, or a previous export whose files drifted, is rejected.
     */
    readonly force?: boolean;
    /** Explicitly permit replacing previously emitted instructions with non-code spans. */
    readonly allowCodeRegression?: boolean;
    /** SHA-256 of the analysis project that produced this export (provenance). */
    readonly sourceProjectSha256: string;
    /** Complete variants grouped in ascending explicit file-offset order; consumed inside the caller's SQL read snapshot. */
    readonly instructionGroups?: Iterable<readonly InstructionExportRecord[]>;
}
/**
 * Formats one decoded instruction with explicit native operand-width qualification.
 * @param {DecodedInstruction} instruction Decoded 65816 instruction.
 * @param {ReadonlyMap<number, SnesRamMapVariable>} [ramVariables] Canonical WRAM and explicit SRAM CPU locations to name.
 * @param {number} [sourceAddress] Canonical address where generated source places the instruction.
 * @param {ReadonlyMap<number, string>} [sourceLabels] Explicit names at exact exported addresses.
 * @param {ReadonlyMap<number, string>} [structFields] Native struct expressions at known data addresses.
 * @param {ReadonlyMap<number, string>} [indexedStructFields] Struct expressions including explicitly biased array bases.
 * @returns {string} Native source with a `.b`, `.w`, or `.l` suffix where width is selectable.
 */
export declare const formatSnes65816SourceInstruction: (instruction: DecodedInstruction, ramVariables?: ReadonlyMap<number, SnesRamMapVariable>, sourceAddress?: number, sourceLabels?: ReadonlyMap<number, string>, structFields?: ReadonlyMap<number, string>, indexedStructFields?: ReadonlyMap<number, string>) => string;
/**
 * Validate annotation names against generated functions, hardware definitions, and RAM names.
 * @param {AnalysisProjectShards} shards Validated native project metadata.
 * @param {SnesMapper} mapper Selected ROM mapping.
 * @param {number} romSize Headerless ROM size.
 * @param {readonly string[]} ramNames Symbols in the editable RAM map.
 * @returns {ReadonlyMap<string, string>} Unique assembly names keyed by native label id.
 */
export declare const snesSourceLabelNames: (shards: AnalysisProjectShards, mapper: SnesMapper, romSize: number, ramNames?: readonly string[]) => ReadonlyMap<string, string>;
/**
 * Writes a deterministic 65816 source tree that can be reassembled with this plugin.
 * Confident CFG nodes become width-qualified instructions; unknown bytes remain
 * `incbin` assets. The internal/expanded SNES headers, vector words, and explicitly
 * bound ROM struct fields become native data source. An optional 512-byte copier
 * header remains an asset. Optional struct bindings also name RAM/ROM operands.
 * Checksums are preserved, not recomputed.
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
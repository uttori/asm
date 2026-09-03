import { type ImportReport, type ProjectComment, type ProjectLabel, type RomImage, type RuntimeEvidenceBatch } from "@uttori/asm-disassembler";
import { type MesenEvidenceContext } from "./mesen-runtime.js";
import type { SnesMapper } from "./rom-header.js";
/** Native label/comment/region records imported from one MesenCE label file. */
export interface MesenLabelImportResult {
    readonly batch: RuntimeEvidenceBatch;
    readonly report: ImportReport;
}
/** MesenCE label text plus a deterministic loss report for unsupported project records. */
export interface MesenLabelExportResult {
    readonly text: string;
    readonly report: ImportReport;
}
/**
 * Imports stock MesenCE `MemoryType:HEX[-HEX]:Label[:Comment]` label text.
 * @param {string} text Complete label file text.
 * @param {RomImage} rom Verified headerless ROM view.
 * @param {SnesMapper} mapper Verified project mapper.
 * @param {MesenEvidenceContext} context Project and source identity context.
 * @returns {MesenLabelImportResult} Native label/comment/region batch and report.
 */
export declare const importMesenLabels: (text: string, rom: RomImage, mapper: SnesMapper, context: MesenEvidenceContext) => MesenLabelImportResult;
/**
 * Exports representable native labels and comments in stock MesenCE label-file syntax.
 * @param {readonly ProjectLabel[]} labels Native labels.
 * @param {readonly ProjectComment[]} comments Native address comments.
 * @param {RomImage} rom Verified headerless ROM view.
 * @param {SnesMapper} mapper Verified project mapper.
 * @param {string} sourceName Output display name for the report.
 * @returns {MesenLabelExportResult} Deterministic text plus loss report.
 */
export declare const exportMesenLabels: (labels: readonly ProjectLabel[], comments: readonly ProjectComment[], rom: RomImage, mapper: SnesMapper, sourceName?: string) => MesenLabelExportResult;
//# sourceMappingURL=mesen-labels.d.ts.map
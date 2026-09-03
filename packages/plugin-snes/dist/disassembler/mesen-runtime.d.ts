import { type ImportReport, type RomImage, type RuntimeEvidenceBatch } from "@uttori/asm-disassembler";
import type { SnesMapper } from "./rom-header.js";
/** MesenCE revision whose CDL, label, and default trace formats this importer was checked against. */
export declare const MESEN_CE_EVIDENCE_REVISION = "af2342818ca81a93b346146802047760400fc7b1";
/** ROM and mapper identity already accepted by the native project. */
export interface MesenEvidenceContext {
    readonly sourceName: string;
    readonly projectRomContentSha256: string;
    readonly projectMapper: SnesMapper;
}
/** Required capture metadata because a raw MesenCE trace file has no ROM header or fingerprint. */
export interface MesenTraceCaptureMetadata {
    readonly schemaVersion: 1;
    readonly architecture: "snes.65816";
    readonly romContentSha256: string;
    readonly mapper: SnesMapper;
    readonly mesenRevision?: string;
}
/** Normalized records and report created by one MesenCE evidence import. */
export interface MesenEvidenceImportResult {
    readonly batch: RuntimeEvidenceBatch;
    readonly report: ImportReport;
}
/**
 * Imports a stock SNES MesenCE `CDLv2` file. Headerless legacy CDL is deliberately refused:
 * without its CRC, the source ROM cannot be verified before evidence is applied.
 * @param {Uint8Array} bytes Complete CDL file bytes.
 * @param {RomImage} rom Verified headerless ROM view.
 * @param {SnesMapper} mapper Verified project mapper.
 * @param {MesenEvidenceContext} context Project and source identity context.
 * @returns {MesenEvidenceImportResult} Normalized evidence batch and import report.
 */
export declare const importMesenSnesCdl: (bytes: Uint8Array, rom: RomImage, mapper: SnesMapper, context: MesenEvidenceContext) => MesenEvidenceImportResult;
/**
 * Imports MesenCE's default 65816 text trace with explicit capture identity metadata.
 * @param {string} text Trace file text.
 * @param {MesenTraceCaptureMetadata} metadata Required ROM/mapper capture identity.
 * @param {RomImage} rom Verified headerless ROM view.
 * @param {SnesMapper} mapper Verified project mapper.
 * @param {MesenEvidenceContext} context Project and source identity context.
 * @returns {MesenEvidenceImportResult} Normalized evidence batch and import report.
 */
export declare const importMesen65816Trace: (text: string, metadata: MesenTraceCaptureMetadata, rom: RomImage, mapper: SnesMapper, context: MesenEvidenceContext) => MesenEvidenceImportResult;
//# sourceMappingURL=mesen-runtime.d.ts.map
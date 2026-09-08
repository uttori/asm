import { type AnalysisRecord, type AnalysisProjectShards, type RomImage } from "@uttori/asm-disassembler";
import type { SnesMapper } from "./rom-header.js";
/**
 * Decode captured code from any CPU bus location, including WRAM and cartridge RAM.
 * @param {AnalysisProjectShards} shards Captured instructions and evidence.
 * @param {RomImage} rom Verified cartridge image.
 * @param {SnesMapper} mapper Address mapper for checking ROM provenance.
 * @returns {readonly AnalysisRecord[]} Captured CFG variants and explicit conflicts.
 */
export declare const analyzeSnesRuntimeCode: (shards: AnalysisProjectShards, rom: RomImage, mapper: SnesMapper) => readonly AnalysisRecord[];
//# sourceMappingURL=runtime-code.d.ts.map
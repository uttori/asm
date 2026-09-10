import { type AnalysisRecord, type AnalysisProjectShards, type RomImage, type RuntimeRecordProjection } from "@uttori/asm-disassembler";
import type { SnesMapper } from "./rom-header.js";
/**
 * Reduce full register history to distinct instruction decoding variants for regeneration.
 * CPU-state records are redundant here. Bytes, decoding state and evidence remain paired; original
 * records and all other registers stay in the untouched runtime shard, never in this derived view.
 * @returns {RuntimeRecordProjection} One-use reducer preserving all distinct decoding variants.
 */
export declare const createSnesRuntimeAnalysisProjection: () => RuntimeRecordProjection;
/**
 * Decode captured code from any CPU bus location, including WRAM and cartridge RAM.
 * @param {AnalysisProjectShards} shards Captured instructions and evidence.
 * @param {RomImage} rom Verified cartridge image.
 * @param {SnesMapper} mapper Address mapper for checking ROM provenance.
 * @returns {readonly AnalysisRecord[]} Captured CFG variants and explicit conflicts.
 */
export declare const analyzeSnesRuntimeCode: (shards: AnalysisProjectShards, rom: RomImage, mapper: SnesMapper) => readonly AnalysisRecord[];
//# sourceMappingURL=runtime-code.d.ts.map
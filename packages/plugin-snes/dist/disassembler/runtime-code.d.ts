import { type AnalysisRecord, type AnalysisProjectShards, type RomImage, type RuntimeEvidenceRecord } from "@uttori/asm-disassembler";
import type { SnesMapper } from "./rom-header.js";
/**
 * Decode captured code from any CPU bus location, including WRAM and cartridge RAM.
 * @param shards Captured instructions and evidence.
 * @param rom Verified cartridge image.
 * @param mapper Address mapper for checking ROM provenance.
 * @param [runtime] SQL instruction-variant cursor, consumed within its read snapshot.
 * @returns Captured CFG variants and explicit conflicts.
 */
export declare const analyzeSnesRuntimeCode: (shards: AnalysisProjectShards, rom: RomImage, mapper: SnesMapper, runtime?: Iterable<RuntimeEvidenceRecord>, onProgress?: (message: string) => void) => readonly AnalysisRecord[];
//# sourceMappingURL=runtime-code.d.ts.map
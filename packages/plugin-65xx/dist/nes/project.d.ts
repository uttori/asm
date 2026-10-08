import { RomImage, type ResearchSnapshot, type StaticAnalysisSeed } from "@uttori/asm-disassembler";
import { type NesAnalysisState } from "./analysis.js";
import { NesCartridge } from "./cartridge.js";
/** Explicit iNES ingestion preserves the full-file identity and the ares-compatible payload identity. */
export declare function loadNesRom(file: string): {
    cartridge: NesCartridge;
    rom: RomImage;
};
/** Creates only the private evidence store; source project publication is owned by the CLI. */
export declare function createNesAnalysisProject(projectDirectory: string, romFile: string): import("@uttori/asm-disassembler").AnalysisProjectManifest;
/** Reanalysis preserves manual decisions and publishes atomically against the exact prior evidence revision. */
export declare function analyzeNesProject(options: {
    readonly projectDirectory: string;
    readonly romFile: string;
    readonly research?: ResearchSnapshot;
    readonly assertResearchCurrent?: () => void;
    readonly signal?: AbortSignal;
    readonly maxWorkItems?: number;
    readonly maxCallDepth?: number;
    readonly onProgress?: (progress: {
        message: string;
    }) => void;
    readonly seeds?: readonly StaticAnalysisSeed<NesAnalysisState>[];
}): {
    status: "complete" | "incomplete";
    instructions: number;
    conflicts: number;
    unresolved: number;
    processedWorkItems: number;
    incompleteReasons: readonly import("@uttori/asm-disassembler").StaticAnalysisIncompleteReason[];
    addedCode: {
        start: number;
        end: number;
        addressSpace: string;
        address: number;
        recordIds: string[];
    }[];
    coverage: import("@uttori/asm-disassembler").StaticCoverageSummary;
};
//# sourceMappingURL=project.d.ts.map
import type { CaptureNesBusAccessV2 } from "@uttori/asm-capture";
import { type ResearchSnapshot, type RuntimeGraphicsAccessRecord } from "@uttori/asm-disassembler";
import type { NesPPUCaptureSummary } from "./ppu.js";
/**
 * Aggregate verified PPU port accesses without timing/register snapshots multiplying every fact.
 * Full ordered events, including fetch/A12/IRQ timelines, remain in the hashed ACT2 archive.
 */
export declare function createNesGraphicsProjection(): {
    push(this: void, event: CaptureNesBusAccessV2): void;
    finish(sha256: string): RuntimeGraphicsAccessRecord[];
};
/** Publish complete graphics provenance and facts atomically beneath the selected Git research overlay. */
export declare function publishNesGraphicsEvidence(options: {
    readonly directory: string;
    readonly file: string;
    readonly summary: NesPPUCaptureSummary;
    readonly records: readonly RuntimeGraphicsAccessRecord[];
    readonly research?: ResearchSnapshot;
    readonly assertResearchCurrent?: () => void;
    readonly signal?: AbortSignal;
}): {
    changed: boolean;
    added: {
        runtime: number;
        analysis: number;
        annotations: number;
        comments: number;
        evidence: number;
        imports: number;
        labels: number;
        regions: number;
    };
    updated: Readonly<Record<keyof import("@uttori/asm-disassembler").AnalysisProjectShards, number>>;
};
//# sourceMappingURL=ppu-evidence.d.ts.map
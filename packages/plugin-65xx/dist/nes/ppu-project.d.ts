import { type ResearchSnapshot } from "@uttori/asm-disassembler";
/**
 * Import a complete PPU archive into a separate, immutable graphics report.
 * Returns null for other formats/scopes. Graphics observations never seed CPU disassembly.
 * Input deletion belongs to the caller. Reports and SQLite facts remain usable after removal;
 * the archive hash identifies the verified input without requiring its ordered stream to survive.
 */
export declare function importNesPPUCapture(options: {
    readonly file: string;
    /** Optional authoritative SQLite store. Report-only callers retain the original behavior. */
    readonly evidenceDirectory?: string;
    readonly research?: ResearchSnapshot;
    readonly assertResearchCurrent?: () => void;
    readonly directory: string;
    readonly romFileSha256: string;
    readonly romContentSha256: string;
    readonly signal?: AbortSignal;
    /** Per-archive byte limit; defaults to the shared 32 GiB capture budget. */
    readonly maxBytes?: number;
}): Promise<{
    sourceSha256: string;
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
    } | {
        runtime: number;
        evidence: number;
    };
    droppedEvents: number;
    warnings: never[];
    report: string;
    observedEvents: number;
} | null>;
//# sourceMappingURL=ppu-project.d.ts.map
import { type NesPPUState, type CaptureFileHeader, type CaptureNesBusAccessV2 } from "@uttori/asm-capture";
/** NPP1 is a halted graphics view, not a save state or a rendered frame. */
export declare const NES_PPU_SNAPSHOT_BYTES = 13056;
export interface NesPPUSnapshot {
    /** CPU master ticks since power/reset; interpret with clock, independently of any capture endpoint. */
    readonly cycle: string;
    readonly pc: number;
    readonly pcPrgOffset: number | null;
    readonly dot: number;
    readonly scanline: number;
    readonly scanlines: number;
    readonly clock: {
        readonly numerator: string;
        readonly denominator: string;
    };
    readonly state: NesPPUState;
    readonly control: number;
    readonly mask: number;
    readonly status: number;
    readonly mapper: readonly number[];
    /** Eight pattern and four nametable windows, each 1 KiB. Offsets are physical storage offsets. */
    readonly mappings: readonly {
        readonly space: "chr-rom" | "chr-ram" | "ciram";
        readonly offset: number;
        readonly writable: boolean;
    }[];
    /** Owned mapped storage copies; callers may edit them to construct derived views. */
    readonly patterns: Uint8Array;
    readonly nametables: Uint8Array;
    readonly palette: Uint8Array;
    readonly oam: Uint8Array;
    readonly secondaryOam: Uint8Array;
    /** 64 RGB triplets from the active ares PPU model with current emphasis. */
    readonly colors: Uint8Array;
}
/** Validate and copy an NPP1 buffer so later caller mutations cannot alter the view. */
export declare function decodeNesPPUSnapshot(bytes: Uint8Array): NesPPUSnapshot;
/** Indexed graphics views preserve hardware palette codes; no display/scheduler work is performed. */
export declare function renderNesPPUViews(snapshot: NesPPUSnapshot): {
    readonly patterns: Uint8Array;
    readonly nametables: Uint8Array;
    readonly sprites: Uint8Array;
};
/** Bounded, complete-archive summary. It never treats bus observations as executable code. */
export interface NesPPUCaptureSummary {
    readonly header: CaptureFileHeader;
    readonly archiveSha256: string;
    readonly events: number;
    readonly actors: Readonly<Record<CaptureNesBusAccessV2["actor"], number>>;
    readonly registerAccesses: Readonly<Record<string, number>>;
    readonly writes: readonly {
        readonly target: string;
        readonly offset: number;
        readonly value: number;
        readonly count: number;
        readonly pc: number;
        readonly pcPrgOffset: number | null;
        readonly sequence: string;
        readonly cycle: string;
    }[];
    readonly blockedWrites: number;
    /** Complete counts plus the last 1,024 IRQ-pin transitions, bounded independently of capture length. */
    readonly timeline: {
        readonly fetches: number;
        readonly a12Edges: number;
        readonly mapperWrites: number;
        readonly irqEdges: number;
        readonly irqPins: readonly {
            readonly sequence: string;
            readonly deviceCycle: string;
            readonly asserted: boolean;
            readonly dot: number;
            readonly scanline: number;
        }[];
    };
}
/** Reject wrong cartridges, incomplete files and excessive distinct destinations before publishing a report. */
export declare function summarizeNesPPUCapture(file: string, options: {
    /** Provisional observations only; callers must not publish until this function validates the complete archive. */
    readonly onBusEvent?: (event: CaptureNesBusAccessV2) => void;
    readonly romFileSha256: string;
    readonly romContentSha256: string;
    /** Per-archive byte limit; defaults to the shared 32 GiB capture budget. */
    readonly maxBytes?: number;
    readonly signal?: AbortSignal;
}): Promise<NesPPUCaptureSummary>;
/** Self-contained offline view. Snapshot panels are storage visualizations, not a reconstructed frame. */
export declare function nesPPUHtml(snapshot: NesPPUSnapshot, identity?: Readonly<Record<string, unknown>>): string;
//# sourceMappingURL=ppu.d.ts.map
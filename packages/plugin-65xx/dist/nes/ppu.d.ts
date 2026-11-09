import { type NesPPUState, type CaptureFileHeader, type CaptureNesBusAccessV2 } from "@uttori/asm-capture";
/** NPP1 is a halted graphics view, not a save state or a rendered frame. */
export declare const NES_PPU_SNAPSHOT_BYTES = 13056;
/** Halted NPP1 graphics view: registers, mappings, and owned storage copies. */
export interface NesPPUSnapshot {
    /** CPU master ticks since power/reset; interpret with clock, independently of any capture endpoint. */
    readonly cycle: string;
    /** Program counter at the observation boundary. */
    readonly pc: number;
    /** Physical PRG-ROM offset of PC, excluding header and trainer; null when unmapped. */
    readonly pcPrgOffset: number | null;
    /** PPU dot (0–340) at the observation. */
    readonly dot: number;
    /** PPU scanline at the observation. */
    readonly scanline: number;
    /** Visible plus vblank scanline count for this PPU model. */
    readonly scanlines: number;
    /** PPU-to-CPU clock ratio as a reduced numerator/denominator pair. */
    readonly clock: {
        readonly numerator: string;
        readonly denominator: string;
    };
    /** Target-owned state snapshot at the boundary. */
    readonly state: NesPPUState;
    /** Effective PPUCTRL, with nametable bits taken from t rather than the last $2000 write. */
    readonly control: number;
    /** PPUMASK after the access. */
    readonly mask: number;
    /** PPUSTATUS in the halted view. */
    readonly status: number;
    /** Mapper number or register snapshot. */
    readonly mapper: readonly number[];
    /** Eight pattern and four nametable windows, each 1 KiB. Offsets are physical storage offsets. */
    readonly mappings: readonly {
        readonly space: "chr-rom" | "chr-ram" | "ciram";
        readonly offset: number;
        readonly writable: boolean;
    }[];
    /** Owned mapped storage copies; callers may edit them to construct derived views. */
    readonly patterns: Uint8Array;
    /** Copied CIRAM nametable bytes from the halted view. */
    readonly nametables: Uint8Array;
    /** Copied CGRAM palette bytes from the halted view. */
    readonly palette: Uint8Array;
    /** Copied primary OAM bytes from the halted view. */
    readonly oam: Uint8Array;
    /** Copied secondary OAM bytes from the halted view. */
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
    /** Parsed or declared header bytes. */
    readonly header: CaptureFileHeader;
    /** SHA-256 of the complete capture archive summarized here. */
    readonly archiveSha256: string;
    /** Number of decoded PPU-bus events in the archive. */
    readonly events: number;
    /** Per-actor counts of bus accesses in the archive. */
    readonly actors: Readonly<Record<CaptureNesBusAccessV2["actor"], number>>;
    /** Per-register access counts keyed by PPU I/O name. */
    readonly registerAccesses: Readonly<Record<string, number>>;
    /** Sample of reconstructed physical writes, newest last. */
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
    /** Writes that targeted CHR-ROM or otherwise could not land. */
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
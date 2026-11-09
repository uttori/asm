import type { RuntimeBusAccess } from "../model/runtime-bus-types.js";
/** Native channel snapshot, without inferring the CPU writes that configured it. */
export interface RuntimeTransferConfiguration {
    /** Mode bits 0–2. Fixed/decrement bits 3/4. Indirect bit 6. B-to-A direction bit 7. */
    readonly dmap: number;
    /** B-bus base port offset in [0, 255], before transfer-mode offsets. */
    readonly bbad: number;
    /** Bank-local 16-bit A-bus source address. */
    readonly a1t: number;
    /** A-bus source bank in [0, 255]. */
    readonly a1b: number;
    /** DMA byte count (zero means 65,536), or the shared HDMA indirect address. */
    readonly das: number;
    /** HDMA indirect bank in [0, 255]. */
    readonly dasb: number;
    /** Bank-local 16-bit HDMA table address. */
    readonly a2a: number;
    /** Raw HDMA line counter and repeat flag. */
    readonly ntlr: number;
    /** Bits 0–3: DMA enabled, HDMA enabled, HDMA completed, HDMA do-transfer. */
    readonly flags: number;
}
/** Marker for a DMA channel run or an HDMA payload burst, interleaved with actual bus accesses. */
export interface RuntimeTransferBoundary extends Pick<RuntimeBusAccess, "sequence" | "ordinal" | "cycle" | "pc" | "context" | "hcounter" | "vcounter"> {
    /** Discriminator placing this record among ordinary bus accesses. */
    readonly kind: "transfer";
    /** Begin event sequence, or zero on an end whose begin was outside this capture session. */
    readonly transferId: string;
    /** Whether this marker opens, completes, or interrupts a transfer window. */
    readonly boundary: "begin" | "complete" | "interrupted";
    /** DMA engine responsible for the observed transfer window. */
    readonly actor: "dma" | "hdma";
    /** Channel index in [0, 7] for the transfer window. */
    readonly channel: number;
    /** Attempted byte slots, including suppressed bus operations. Zero on begin markers. */
    readonly transferred: number;
    /** Register snapshot captured at the boundary without inferring CPU configuration writes. */
    readonly configuration: RuntimeTransferConfiguration;
}
/** Observed completeness of a transfer window relative to its begin/end markers. */
export type RuntimeTransferStatus = "complete" | "interrupted" | "leading-partial" | "trailing-partial" | "both-partial";
/** One observed window. A missing marker remains explicit rather than implying a full transfer. */
export interface RuntimeTransferWindow {
    /** DMA engine observed for the window. */
    readonly actor: "dma" | "hdma";
    /** Channel index observed for the window. */
    readonly channel: number;
    /** Completeness classification derived from begin/end marker presence. */
    readonly status: RuntimeTransferStatus;
    /** Opening boundary when one was observed in this capture. */
    readonly begin?: RuntimeTransferBoundary;
    /** Closing boundary when one was observed in this capture. */
    readonly end?: RuntimeTransferBoundary;
    /** Payload read accesses counted inside the window. */
    readonly reads: number;
    /** Payload write accesses counted inside the window. */
    readonly writes: number;
}
/** At most sixteen actor/channel totals. Attempted slots include only runs with both markers. */
export interface RuntimeTransferActivity {
    /** DMA engine these totals aggregate. */
    readonly actor: "dma" | "hdma";
    /** Channel index these totals aggregate. */
    readonly channel: number;
    /** Windows that closed with matching begin and complete markers. */
    complete: number;
    /** Windows interrupted before the expected slot count finished. */
    interrupted: number;
    /** Windows with payload but no observed begin marker. */
    leadingPartial: number;
    /** Windows with a begin marker but no closing marker in the capture. */
    trailingPartial: number;
    /** Windows with payload but neither begin nor end marker in the capture. */
    bothPartial: number;
    /** Sum of attempted byte slots across windows with both markers. */
    attemptedSlots: number;
    /** Total payload reads attributed to this actor/channel. */
    reads: number;
    /** Total payload writes attributed to this actor/channel. */
    writes: number;
}
/** All windows contribute to totals. Only the first 64 finished windows are materialized for display. */
export interface RuntimeTransferSummary {
    /** Per actor/channel aggregate counters across the whole capture. */
    readonly activity: readonly RuntimeTransferActivity[];
    /** First retained example windows in capture order. */
    readonly windows: readonly RuntimeTransferWindow[];
    /** Additional finished windows omitted from the example list after the cap. */
    readonly omittedWindows: number;
}
/**
 * Normalize boundary fields for deterministic hashing. Common event ordering is validated by the importer.
 * @param marker Untrusted marker from a transport-neutral source.
 * @returns Canonical marker. Inconsistent counts/configuration throw.
 */
export declare const validateRuntimeTransferBoundary: (marker: unknown) => RuntimeTransferBoundary;
/**
 * Correlate explicit boundaries with payload accesses using at most sixteen open windows.
 * @returns Streaming accumulator. Finish preserves partial windows at capture edges.
 */
export declare const createRuntimeTransferAccumulator: () => {
    /**
     * Attach only DMA/HDMA payload events. Table/pointer fetches remain separate bus evidence.
     * @param event Already validated ordered event.
     */
    push: (event: RuntimeBusAccess | RuntimeTransferBoundary) => void;
    /**
     * Close remaining windows without claiming completion or an attempted slot count.
     * @returns Bounded report with exact lifetime window counts.
     */
    finish: () => RuntimeTransferSummary;
};
//# sourceMappingURL=runtime-transfer.d.ts.map
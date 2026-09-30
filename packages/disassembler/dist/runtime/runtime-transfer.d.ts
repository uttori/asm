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
    readonly kind: "transfer";
    /** Begin event sequence, or zero on an end whose begin was outside this capture session. */
    readonly transferId: string;
    readonly boundary: "begin" | "complete" | "interrupted";
    readonly actor: "dma" | "hdma";
    readonly channel: number;
    /** Attempted byte slots, including suppressed bus operations. Zero on begin markers. */
    readonly transferred: number;
    readonly configuration: RuntimeTransferConfiguration;
}
export type RuntimeTransferStatus = "complete" | "interrupted" | "leading-partial" | "trailing-partial" | "both-partial";
/** One observed window. A missing marker remains explicit rather than implying a full transfer. */
export interface RuntimeTransferWindow {
    readonly actor: "dma" | "hdma";
    readonly channel: number;
    readonly status: RuntimeTransferStatus;
    readonly begin?: RuntimeTransferBoundary;
    readonly end?: RuntimeTransferBoundary;
    readonly reads: number;
    readonly writes: number;
}
/** At most sixteen actor/channel totals. Attempted slots include only runs with both markers. */
export interface RuntimeTransferActivity {
    readonly actor: "dma" | "hdma";
    readonly channel: number;
    complete: number;
    interrupted: number;
    leadingPartial: number;
    trailingPartial: number;
    bothPartial: number;
    attemptedSlots: number;
    reads: number;
    writes: number;
}
/** All windows contribute to totals. Only the first 64 finished windows are materialized for display. */
export interface RuntimeTransferSummary {
    readonly activity: readonly RuntimeTransferActivity[];
    readonly windows: readonly RuntimeTransferWindow[];
    readonly omittedWindows: number;
}
/** Normalize boundary fields for deterministic hashing. Common event ordering is validated by the importer.
 * @param {RuntimeTransferBoundary} marker Untrusted marker from a transport-neutral source.
 * @returns {RuntimeTransferBoundary} Canonical marker. Inconsistent counts/configuration throw.
 */
export declare const validateRuntimeTransferBoundary: (marker: RuntimeTransferBoundary) => RuntimeTransferBoundary;
/** Correlate explicit boundaries with payload accesses using at most sixteen open windows.
 * @returns {object} Streaming accumulator. Finish preserves partial windows at capture edges.
 */
export declare const createRuntimeTransferAccumulator: () => {
    /** Attach only DMA/HDMA payload events. Table/pointer fetches remain separate bus evidence.
     * @param {RuntimeBusAccess | RuntimeTransferBoundary} event Already validated ordered event.
     */
    push: (event: RuntimeBusAccess | RuntimeTransferBoundary) => void;
    /** Close remaining windows without claiming completion or an attempted slot count.
     * @returns {RuntimeTransferSummary} Bounded report with exact lifetime window counts.
     */
    finish: () => RuntimeTransferSummary;
};
//# sourceMappingURL=runtime-transfer.d.ts.map
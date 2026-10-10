import { type TraceCacheMetrics, type TraceIndexMetrics } from "../internal/trace-cache.js";
import type { ImportReport } from "../model/project-types.js";
import { type RuntimeBusAccess, type RuntimeBusContext } from "../model/runtime-bus-types.js";
import type { RuntimeEvidenceBatch } from "./runtime-evidence.js";
import { type RuntimeGraphicsSummary } from "./runtime-graphics.js";
import { type RuntimePPUSummary } from "./runtime-ppu.js";
import type { RuntimeTraceImporterStorage } from "./runtime-trace.js";
import { type RuntimeTransferSummary } from "./runtime-transfer.js";
export declare const RUNTIME_BUS_TRACE_FORMAT: "uttori-asm-bus-trace";
/** Aggregates byte-access variants; ordered timing and raster history are outside this projection. */
export declare const RUNTIME_BUS_INDEX_PROFILE: "bus-access-v1";
/** Identity of a complete lossless SNES bus stream, independent of its file or transport framing. */
export interface RuntimeBusTraceMetadata {
    readonly format: typeof RUNTIME_BUS_TRACE_FORMAT;
    readonly schemaVersion: 1;
    readonly scope: "snes.cpu-bus" | "snes.cpu-bus-transfers" | "snes.cpu-bus-ppu";
    readonly architecture: "snes.65816";
    readonly addressSpace: "snes.cpu";
    readonly romContentSha256: string;
    readonly producer: {
        readonly id: string;
        readonly revision: string;
    };
    readonly session: string;
    /** Master clocks per second as an exact positive rational. */
    readonly clock: {
        readonly id: "snes.master";
        readonly numerator: string;
        readonly denominator: string;
    };
}
/** Reader callbacks are provisional: a torn tail or changed identity must reject read() before publication. */
export interface RuntimeBusTraceSource {
    readonly metadata: RuntimeBusTraceMetadata;
    readonly read: (accept: (chunk: unknown) => void) => Promise<void>;
    /** Optional native output whose final path/inode read() validates before resolving.
     * Its identity is rechecked before publication to reject replacement of a completed capture.
     */
    readonly completedFile?: string;
}
/** ROM guard and distinct-fact limit. The default is two million variants, with an eight-million hard cap. */
export interface RuntimeBusTraceImportContext {
    readonly projectRomContentSha256: string;
    readonly sourceName: string;
    readonly maxIndexRecords?: number;
    /** Chunk-level provisional progress. Never evidence of a complete or published capture. */
    readonly onProgress?: (progress: RuntimeBusTraceProgress) => void;
    /** Optional caller-owned diagnostic counters. Omit for uninstrumented timings. */
    readonly cacheMetrics?: {
        readonly facts?: TraceCacheMetrics;
        readonly index?: TraceIndexMetrics;
    };
}
/** Bounded live discovery counters. Raw events and fact payloads never cross the UI channel. */
export interface RuntimeBusTraceProgress {
    readonly streamEvents: number;
    readonly busEvents: number;
    readonly distinctFacts: number;
    readonly transferMarkers: number;
    readonly firstCycle: string | null;
    readonly lastCycle: string | null;
    readonly ppu?: Omit<RuntimePPUSummary, "writes">;
    readonly activity: readonly RuntimeBusActivity[];
}
/** Bounded activity grouping (at most 33 rows), without inferred transfer boundaries or register setup. */
export interface RuntimeBusActivity {
    readonly actor: RuntimeBusAccess["actor"];
    readonly channel: number | null;
    readonly phase: RuntimeBusAccess["phase"];
    reads: number;
    writes: number;
    unowned: number;
    readonly firstSequence: string;
    lastSequence: string;
    readonly firstCycle: string;
    lastCycle: string;
}
/** Event totals stay exact. The capture clock is retained for interpreting elapsed master clocks. */
export interface RuntimeBusTraceSummary {
    readonly clock: RuntimeBusTraceMetadata["clock"];
    readonly transfers?: RuntimeTransferSummary;
    /** Recomputed from ordered accesses. Deliberately excluded from stable bus facts and provenance. */
    readonly graphics?: RuntimeGraphicsSummary;
    /** Native outcomes, independent of the candidate port reconstruction. */
    readonly ppu?: RuntimePPUSummary;
    readonly firstCycle: string | null;
    readonly lastCycle: string | null;
    readonly contexts: Readonly<Record<RuntimeBusContext, number>>;
    readonly activity: readonly RuntimeBusActivity[];
}
/** Provenance plus a bounded report. Runtime records can be emitted directly to the working store. */
export interface RuntimeBusTraceImportResult {
    readonly batch: RuntimeEvidenceBatch;
    readonly report: ImportReport;
    readonly sourceSha256: string;
    readonly observedEvents: number;
    readonly droppedEvents: 0;
    readonly summary: RuntimeBusTraceSummary;
}
/** Normalize only semantic metadata, excluding archive allocation and file framing.
 * @param {unknown} value Producer metadata, possibly with transport-specific fields.
 * @returns {RuntimeBusTraceMetadata} Fresh canonical identity. Invalid metadata throws.
 */
export declare const validateRuntimeBusTraceMetadata: (value: unknown) => RuntimeBusTraceMetadata;
/** Validate and aggregate a stream with bounded chunks and a caller-owned, optionally disk-backed index.
 * @param {unknown} metadata Producer identity and clock.
 * @param {RuntimeBusTraceImportContext} context Expected ROM and distinct-fact budget.
 * @param {RuntimeTraceImporterStorage} storage Optional SQLite counters and transactional record sink.
 * @returns {object} Single-use push/finish importer. Any failed push permanently prevents publication.
 */
export declare const createRuntimeBusTraceImporter: (metadata: unknown, context: RuntimeBusTraceImportContext, storage?: RuntimeTraceImporterStorage) => {
    push: (chunk: unknown) => void;
    finish: () => RuntimeBusTraceImportResult;
};
//# sourceMappingURL=runtime-bus-trace.d.ts.map
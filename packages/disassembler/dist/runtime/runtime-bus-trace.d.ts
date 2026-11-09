import { type TraceCacheMetrics, type TraceIndexMetrics } from "../internal/trace-cache.js";
import type { ImportReport } from "../model/project-types.js";
import { type RuntimeBusAccess, type RuntimeBusContext } from "../model/runtime-bus-types.js";
import type { RuntimeEvidenceBatch } from "./runtime-evidence.js";
import { type RuntimeGraphicsSummary } from "./runtime-graphics.js";
import { type RuntimePPUSummary } from "./runtime-ppu.js";
import type { RuntimeTraceImporterStorage } from "./runtime-trace.js";
import { type RuntimeTransferSummary } from "./runtime-transfer.js";
/** On-disk bus trace artifact discriminator. */
export declare const RUNTIME_BUS_TRACE_FORMAT: "uttori-asm-bus-trace";
/** Aggregates byte-access variants; ordered timing and raster history are outside this projection. */
export declare const RUNTIME_BUS_INDEX_PROFILE: "bus-access-v1";
/** Identity of a complete lossless SNES bus stream, independent of its file or transport framing. */
export interface RuntimeBusTraceMetadata {
    /** Bus trace artifact discriminator. */
    readonly format: typeof RUNTIME_BUS_TRACE_FORMAT;
    /** Schema version accepted for bus trace metadata. */
    readonly schemaVersion: 1;
    /** Capture scope selecting bus, transfer, or PPU-enriched streams. */
    readonly scope: "snes.cpu-bus" | "snes.cpu-bus-transfers" | "snes.cpu-bus-ppu";
    /** Recorded CPU architecture tag for every event. */
    readonly architecture: "snes.65816";
    /** Address space tag for CPU bus events in the capture. */
    readonly addressSpace: "snes.cpu";
    /** Headerless ROM content hash binding the capture to one cartridge image. */
    readonly romContentSha256: string;
    /** Recorder identity that produced the bus stream. */
    readonly producer: {
        readonly id: string;
        readonly revision: string;
    };
    /** Capture session id distinguishing concurrent recordings. */
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
    /** Validated bus trace envelope identity. */
    readonly metadata: RuntimeBusTraceMetadata;
    /** Stream bus events to the importer after validating metadata integrity. */
    readonly read: (accept: (chunk: unknown) => void) => Promise<void>;
    /**
     * Optional native output whose final path/inode read() validates before resolving.
     * Its identity is rechecked before publication to reject replacement of a completed capture.
     */
    readonly completedFile?: string;
}
/** ROM guard and distinct-fact limit. The default is two million variants, with an eight-million hard cap. */
export interface RuntimeBusTraceImportContext {
    /** Expected headerless ROM content hash for the destination project. */
    readonly projectRomContentSha256: string;
    /** User-visible source name stored on the import report. */
    readonly sourceName: string;
    /** Optional cap on distinct indexed bus facts during import. */
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
    /** Raw transport events consumed from the bus trace source. */
    readonly streamEvents: number;
    /** Validated CPU bus access events observed so far. */
    readonly busEvents: number;
    /** Distinct indexed facts retained by the importer. */
    readonly distinctFacts: number;
    /** DMA/HDMA transfer boundary markers observed so far. */
    readonly transferMarkers: number;
    /** First master-cycle counter seen in the capture, if any. */
    readonly firstCycle: string | null;
    /** Last master-cycle counter seen in the capture, if any. */
    readonly lastCycle: string | null;
    /** Aggregate PPU counters excluding the bounded example write list. */
    readonly ppu?: Omit<RuntimePPUSummary, "writes">;
    /** Bounded activity rows for live UI discovery. */
    readonly activity: readonly RuntimeBusActivity[];
}
/** Bounded activity grouping (at most 33 rows), without inferred transfer boundaries or register setup. */
export interface RuntimeBusActivity {
    /** Bus actor aggregated in this activity row. */
    readonly actor: RuntimeBusAccess["actor"];
    /** DMA channel when applicable; otherwise null. */
    readonly channel: number | null;
    /** Bus phase label grouping reads and writes in the row. */
    readonly phase: RuntimeBusAccess["phase"];
    /** Read accesses counted for the group. */
    reads: number;
    /** Write accesses counted for the group. */
    writes: number;
    /** Accesses lacking an owning instruction context in the row. */
    unowned: number;
    /** Sequence id of the first access in the group. */
    readonly firstSequence: string;
    /** Sequence id of the most recent access in the group. */
    lastSequence: string;
    /** Master-cycle counter at the first access in the group. */
    readonly firstCycle: string;
    /** Master-cycle counter at the most recent access in the group. */
    lastCycle: string;
}
/** Event totals stay exact. The capture clock is retained for interpreting elapsed master clocks. */
export interface RuntimeBusTraceSummary {
    /** Master clock rational copied from the capture metadata. */
    readonly clock: RuntimeBusTraceMetadata["clock"];
    /** DMA/HDMA transfer window summary when transfer markers were present. */
    readonly transfers?: RuntimeTransferSummary;
    /** Recomputed from ordered accesses. Deliberately excluded from stable bus facts and provenance. */
    readonly graphics?: RuntimeGraphicsSummary;
    /** Native outcomes, independent of the candidate port reconstruction. */
    readonly ppu?: RuntimePPUSummary;
    /** First master-cycle counter in the validated capture. */
    readonly firstCycle: string | null;
    /** Last master-cycle counter in the validated capture. */
    readonly lastCycle: string | null;
    /** Counts of bus events by attribution context. */
    readonly contexts: Readonly<Record<RuntimeBusContext, number>>;
    /** Aggregated activity rows for the completed import. */
    readonly activity: readonly RuntimeBusActivity[];
}
/** Provenance plus a bounded report. Runtime records can be emitted directly to the working store. */
export interface RuntimeBusTraceImportResult {
    /** Shard batch ready to merge into the analysis project. */
    readonly batch: RuntimeEvidenceBatch;
    /** Import report describing the validated bus capture. */
    readonly report: ImportReport;
    /** Canonical identity hash over validated bus trace input. */
    readonly sourceSha256: string;
    /** Count of bus events indexed during the import. */
    readonly observedEvents: number;
    /** Bus trace imports treat producer loss as zero for this format. */
    readonly droppedEvents: 0;
    /** Bounded summary recomputed from the validated ordered stream. */
    readonly summary: RuntimeBusTraceSummary;
}
/**
 * Normalize only semantic metadata, excluding archive allocation and file framing.
 * @param value Producer metadata, possibly with transport-specific fields.
 * @returns Fresh canonical identity. Invalid metadata throws.
 */
export declare const validateRuntimeBusTraceMetadata: (value: unknown) => RuntimeBusTraceMetadata;
/**
 * Validate and aggregate a stream with bounded chunks and a caller-owned, optionally disk-backed index.
 * @param metadata Producer identity and clock.
 * @param context Expected ROM and distinct-fact budget.
 * @param storage Optional SQLite counters and transactional record sink.
 * @returns Single-use push/finish importer. Any failed push permanently prevents publication.
 */
export declare const createRuntimeBusTraceImporter: (metadata: unknown, context: RuntimeBusTraceImportContext, storage?: RuntimeTraceImporterStorage) => {
    push: (chunk: unknown) => void;
    finish: () => RuntimeBusTraceImportResult;
};
//# sourceMappingURL=runtime-bus-trace.d.ts.map
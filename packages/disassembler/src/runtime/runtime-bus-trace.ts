import { createHash } from "node:crypto";

import {
  TraceCache,
  type TraceCacheMetrics,
  type TraceIndexMetrics,
} from "../internal/trace-cache.js";
import type {
  ImportReport,
  RuntimeBusAccessRecord,
  RuntimeEvidenceRecord,
} from "../model/project-types.js";
import {
  validateRuntimeBusFact,
  type RuntimeBusAccess,
  type RuntimeBusContext,
} from "../model/runtime-bus-types.js";
import type { RuntimePPUEffect } from "../model/runtime-ppu-effect.js";
import type { RuntimeEvidenceBatch } from "./runtime-evidence.js";
import {
  createRuntimeGraphicsAccumulator,
  type RuntimeGraphicsSummary,
} from "./runtime-graphics.js";
import { createRuntimePPUAccumulator, type RuntimePPUSummary } from "./runtime-ppu.js";
import type {
  RuntimeTraceFactIndex,
  RuntimeTraceImporterStorage,
  RuntimeTraceIndexedFact,
} from "./runtime-trace.js";
import {
  createRuntimeTransferAccumulator,
  validateRuntimeTransferBoundary,
  type RuntimeTransferBoundary,
  type RuntimeTransferSummary,
} from "./runtime-transfer.js";

function isRowRecord(value: object): value is Record<string, unknown> {
  return !Array.isArray(value);
}

export const RUNTIME_BUS_TRACE_FORMAT = "uttori-asm-bus-trace" as const;
/** Aggregates byte-access variants; ordered timing and raster history are outside this projection. */
export const RUNTIME_BUS_INDEX_PROFILE = "bus-access-v1" as const;

/** Identity of a complete lossless SNES bus stream, independent of its file or transport framing. */
export interface RuntimeBusTraceMetadata {
  readonly format: typeof RUNTIME_BUS_TRACE_FORMAT;
  readonly schemaVersion: 1;
  readonly scope: "snes.cpu-bus" | "snes.cpu-bus-transfers" | "snes.cpu-bus-ppu";
  readonly architecture: "snes.65816";
  readonly addressSpace: "snes.cpu";
  readonly romContentSha256: string;
  readonly producer: { readonly id: string; readonly revision: string };
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

/** Parse a canonical unsigned wire integer without rounding through JavaScript numbers.
 * @param {unknown} value Decimal string, with no sign or leading zeroes.
 * @returns {number | bigint} Exact u64. Common small values avoid BigInt allocation. Invalid input throws.
 */
const unsigned = (value: unknown): number | bigint => {
  if (typeof value !== "string" || !/^(0|[1-9]\d{0,19})$/.test(value)) {
    throw new Error("Bus trace requires canonical unsigned 64-bit decimal strings.");
  }
  // Most event counters fit in 15 digits, which is always exact and avoids a
  // BigInt allocation. Sixteen-digit strings straddle the safe-integer boundary.
  // converting those to Number before checking the range could already round.
  if (value.length <= 15) {
    return Number(value);
  }
  const number = BigInt(value);
  if (number > 0xffffffffffffffffn) {
    throw new Error("Bus trace integer exceeds u64.");
  }
  // Normalize every safe value to Number so sequence equality against the Number
  // event count remains valid beyond the 15-digit fast path. Larger values stay exact.
  if (number <= BigInt(Number.MAX_SAFE_INTEGER)) {
    return Number(number);
  }
  return number;
};

function isMetadataRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBusScope(value: unknown): value is RuntimeBusTraceMetadata["scope"] {
  return (
    value === "snes.cpu-bus" || value === "snes.cpu-bus-transfers" || value === "snes.cpu-bus-ppu"
  );
}

function positiveDecimal(value: unknown): string {
  if (typeof value !== "string" || unsigned(value) === 0) {
    if (typeof value !== "string") {
      throw new Error("Bus trace requires canonical unsigned 64-bit decimal strings.");
    }
    throw new Error("Bus trace clock frequency must be positive.");
  }
  return value;
}

/** Normalize only semantic metadata, excluding archive allocation and file framing.
 * @param {unknown} value Producer metadata, possibly with transport-specific fields.
 * @returns {RuntimeBusTraceMetadata} Fresh canonical identity. Invalid metadata throws.
 */
export const validateRuntimeBusTraceMetadata = (value: unknown): RuntimeBusTraceMetadata => {
  if (!isMetadataRecord(value)) {
    throw new Error("Invalid SNES bus trace metadata.");
  }
  const producer = isMetadataRecord(value.producer) ? value.producer : undefined;
  const clock = isMetadataRecord(value.clock) ? value.clock : undefined;
  const producerId = producer?.id;
  const producerRevision = producer?.revision;
  const scope = value.scope;
  const romContentSha256 = value.romContentSha256;
  const session = value.session;
  if (
    value.format !== RUNTIME_BUS_TRACE_FORMAT ||
    value.schemaVersion !== 1 ||
    !isBusScope(scope) ||
    value.architecture !== "snes.65816" ||
    value.addressSpace !== "snes.cpu" ||
    typeof romContentSha256 !== "string" ||
    !/^[\da-f]{64}$/.test(romContentSha256) ||
    typeof session !== "string" ||
    !/^[\da-f]{32}$/.test(session) ||
    typeof producerId !== "string" ||
    producerId === "" ||
    typeof producerRevision !== "string" ||
    producerRevision === "" ||
    !clock ||
    clock.id !== "snes.master"
  ) {
    throw new Error("Invalid SNES bus trace metadata.");
  }
  return {
    format: RUNTIME_BUS_TRACE_FORMAT,
    schemaVersion: 1,
    scope,
    architecture: "snes.65816",
    addressSpace: "snes.cpu",
    romContentSha256,
    producer: { id: producerId, revision: producerRevision },
    session,
    clock: {
      id: "snes.master",
      numerator: positiveDecimal(clock.numerator),
      denominator: positiveDecimal(clock.denominator),
    },
  };
};

function isBusTraceEvent(
  value: unknown,
): value is
  | RuntimeBusAccess
  | (Omit<RuntimeTransferBoundary, "kind"> & { readonly kind: unknown }) {
  return typeof value === "object" && value !== null;
}

/** Validate and aggregate a stream with bounded chunks and a caller-owned, optionally disk-backed index.
 * @param {unknown} metadata Producer identity and clock.
 * @param {RuntimeBusTraceImportContext} context Expected ROM and distinct-fact budget.
 * @param {RuntimeTraceImporterStorage} storage Optional SQLite counters and transactional record sink.
 * @returns {object} Single-use push/finish importer. Any failed push permanently prevents publication.
 */
export const createRuntimeBusTraceImporter = (
  metadata: unknown,
  context: RuntimeBusTraceImportContext,
  storage?: RuntimeTraceImporterStorage,
): { push: (chunk: unknown) => void; finish: () => RuntimeBusTraceImportResult } => {
  const meta = validateRuntimeBusTraceMetadata(metadata);
  if (meta.romContentSha256 !== context.projectRomContentSha256) {
    throw new Error("ROM/project mismatch: bus capture does not match the destination ROM.");
  }
  if (typeof context.sourceName !== "string" || !context.sourceName) {
    throw new Error("Bus capture source name must not be empty.");
  }
  const limit = context.maxIndexRecords ?? 2_000_000;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 8_000_000) {
    throw new Error("Bus trace fact budget must be in [1, 8000000].");
  }
  const memory = new Map<string, { fact: RuntimeTraceIndexedFact; count: number }>();
  const index: RuntimeTraceFactIndex = storage?.index ?? {
    add: (key, create) => {
      const current = memory.get(key);
      if (current) {
        current.count++;
        return false;
      }
      memory.set(key, { fact: create(), count: 1 });
      return true;
    },
    values: () => memory.values(),
    clear: () => memory.clear(),
  };
  // Hash each normalized event, never chunk boundaries. Reframing a capture must not duplicate its counts.
  const hash = createHash("sha256").update(`uttori-bus-index-v1\n${JSON.stringify(meta)}\n`);
  // Cache only a bounded working set. Keys use the complete canonical fact JSON,
  // so eviction changes cost, never identity or counts. Raster stays event-owned.
  const factKeys = new TraceCache<string>(context.cacheMetrics?.facts);
  const activity = new Map<string, RuntimeBusActivity>();
  const contexts: Record<RuntimeBusContext, number> = {
    unattributed: 0,
    instruction: 0,
    interrupt: 0,
    wait: 0,
    stop: 0,
  };
  const transfers = meta.scope !== "snes.cpu-bus" ? createRuntimeTransferAccumulator() : undefined;
  const graphics = createRuntimeGraphicsAccumulator();
  const ppu = meta.scope === "snes.cpu-bus-ppu" ? createRuntimePPUAccumulator() : undefined;
  let streamEvents = 0;
  let markerEvents = 0;
  let observed = 0;
  let facts = 0;
  let previousCycle: number | bigint = 0;
  let firstCycle: string | null = null;
  let lastOrdinal: number | bigint = 0;
  let lastPc = 0;
  let finished = false;
  let failed = false;

  /** Index one bounded chunk. Counters remain provisional until the source confirms a complete tail.
   * @param {unknown} chunk Object containing 1–4095 ordered accesses.
   * @returns {void} Throws and discards the index on any invalid event or exhausted fact budget.
   */
  const push = (chunk: unknown): void => {
    if (finished || failed) {
      throw new Error("Bus trace importer is no longer writable.");
    }
    try {
      const accesses =
        typeof chunk === "object" && chunk !== null && isRowRecord(chunk)
          ? chunk.accesses
          : undefined;
      if (!Array.isArray(accesses) || accesses.length < 1 || accesses.length > 4095) {
        throw new Error("Bus trace chunks require 1–4095 accesses.");
      }
      // At most 4,095 normalized lines amortize native hash.update() calls without
      // retaining the whole trace. Joining must add no chunk-boundary bytes.
      const hashLines: string[] = [];
      for (const item of accesses) {
        if (!isBusTraceEvent(item)) {
          throw new Error("Invalid bus trace event.");
        }
        const access = item;
        const sequence = unsigned(access.sequence);
        const ordinal = unsigned(access.ordinal);
        const cycle = unsigned(access.cycle);
        // Accepted sequence counts are safe Numbers from unsigned(). Comparing
        // directly avoids allocating a BigInt for each otherwise-small counter.
        if (streamEvents === Number.MAX_SAFE_INTEGER || sequence !== streamEvents + 1) {
          throw new Error(
            "Bus trace event sequence is not contiguous or exceeds the safe count range.",
          );
        }
        if (cycle < previousCycle) {
          throw new Error("Bus trace master clock moved backwards.");
        }
        const hasOwner = ordinal > 0;
        if (hasOwner !== (access.context === "instruction")) {
          throw new Error("Bus trace instruction context and ordinal disagree.");
        }
        // Ordinals may skip instructions without bus accesses, and zero denotes an unowned interval.
        if (
          ordinal > 0 &&
          (ordinal < lastOrdinal || (ordinal === lastOrdinal && access.pc !== lastPc))
        ) {
          throw new Error("Bus trace instruction ownership moved backwards or changed PC.");
        }
        if (
          !Number.isInteger(access.hcounter) ||
          access.hcounter < 0 ||
          access.hcounter >= 1368 ||
          !Number.isInteger(access.vcounter) ||
          access.vcounter < 0 ||
          access.vcounter >= 313
        ) {
          throw new Error("Bus trace raster position is out of range.");
        }
        previousCycle = cycle;
        firstCycle ??= access.cycle;
        if (ordinal > 0) {
          lastOrdinal = ordinal;
          lastPc = access.pc;
        }
        streamEvents++;
        if ("kind" in access) {
          if (!transfers || access.kind !== "transfer") {
            throw new Error("Transfer markers require the negotiated transfer scope.");
          }
          const marker = validateRuntimeTransferBoundary(access);
          transfers.push(marker);
          markerEvents++;
          hashLines.push(JSON.stringify(marker) + "\n");
          continue;
        }
        const port = access.address & 0xffff;
        const dataPort =
          access.direction === "write" &&
          !(access.address & 0x400000) &&
          [0x2104, 0x2118, 0x2119, 0x2122].includes(port);
        // This scope promises a native decision on every data-port write. A missing
        // annotation or a legacy stream carrying new fields is a corrupt source.
        if ((access.ppu !== undefined) !== Boolean(ppu && dataPort)) {
          throw new Error("Missing or out-of-scope native PPU effect.");
        }
        const effect: RuntimePPUEffect | undefined = access.ppu;
        if (
          access.ppu &&
          (!Number.isInteger(access.ppu.hcounter) ||
            access.ppu.hcounter < 0 ||
            access.ppu.hcounter >= 1368 ||
            !Number.isInteger(access.ppu.vcounter) ||
            access.ppu.vcounter < 0 ||
            access.ppu.vcounter >= 313)
        ) {
          throw new Error("Invalid PPU decision raster.");
        }
        const fact = {
          // Presence is not truthiness: null/false/zero annotations must reach
          // validation and fail, rather than masquerade as an omitted effect.
          ...(effect !== undefined ? { ppu: effect } : {}),
          addressSpace: meta.addressSpace,
          address: access.address,
          pc: access.pc,
          value: access.value,
          direction: access.direction,
          actor: access.actor,
          channel: access.channel,
          phase: access.phase,
          context: access.context,
        };
        // Validate once and reuse its canonical effect, dropping event-owned
        // raster fields without a second normalization/allocation pass.
        const normalizedEffect = validateRuntimeBusFact(fact);
        if (normalizedEffect) {
          fact.ppu = normalizedEffect;
        }
        // Fact reuse cannot skip these ordered state machines: identical byte
        // accesses can occur in different transfer, latch and rendering contexts.
        transfers?.push(access);
        if (ppu) {
          ppu.push(access);
        } else {
          graphics.push(access);
        }
        const factJson = JSON.stringify(fact);
        let key = factKeys.get(factJson);
        if (key === undefined) {
          key = createHash("sha256").update(factJson).digest("hex");
          factKeys.insert(factJson, key);
        }
        if (
          index.add(key, () => ({
            kind: "memory",
            record: {
              ...fact,
              id: key,
              kind: "runtime-bus-access",
              architecture: meta.architecture,
              count: 1,
              evidence: [],
            },
          }))
        ) {
          facts++;
          if (facts > limit) {
            throw new Error(`Bus trace exceeds the ${limit} distinct-fact budget.`);
          }
        }
        // Validated u64 decimal strings and integer raster coordinates have a
        // unique JSON spelling. Reuse fact JSON and hash once per bounded chunk,
        // retaining byte-for-byte compatibility with the v1 normalized stream.
        let line = `["${access.sequence}","${access.ordinal}","${access.cycle}",${factJson},${access.hcounter},${access.vcounter}`;
        if (access.ppu) {
          line += `,${access.ppu.hcounter},${access.ppu.vcounter}`;
        }
        hashLines.push(line + "]\n");
        observed++;
        contexts[access.context]++;
        const groupKey = `${access.actor}:${access.channel}:${access.phase}`;
        let group = activity.get(groupKey);
        if (!group) {
          group = {
            actor: access.actor,
            channel: access.channel,
            phase: access.phase,
            reads: 0,
            writes: 0,
            unowned: 0,
            firstSequence: access.sequence,
            lastSequence: access.sequence,
            firstCycle: access.cycle,
            lastCycle: access.cycle,
          };
          activity.set(groupKey, group);
        }
        if (access.direction === "read") {
          group.reads++;
        } else {
          group.writes++;
        }
        if (ordinal === 0) {
          group.unowned++;
        }
        group.lastSequence = access.sequence;
        group.lastCycle = access.cycle;
      }
      hash.update(hashLines.join(""));
      if (context.onProgress) {
        const summary = ppu?.finish();
        const counts = summary
          ? {
              portWrites: summary.portWrites,
              written: summary.written,
              blocked: summary.blocked,
              latched: summary.latched,
              byteWrites: summary.byteWrites,
              renderingRestricted: summary.renderingRestricted,
              omittedWrites: summary.omittedWrites,
            }
          : undefined;
        context.onProgress({
          streamEvents,
          busEvents: observed,
          distinctFacts: facts,
          transferMarkers: markerEvents,
          firstCycle,
          lastCycle: firstCycle === null ? null : String(previousCycle),
          ...(counts ? { ppu: counts } : {}),
          activity: [...activity.values()].map((group) => Object.assign({}, group)),
        });
      }
    } catch (error) {
      failed = true;
      index.clear();
      throw error;
    }
  };
  /** Assign stable source identities and emit records once, inside the caller's publication transaction.
   * @returns {RuntimeBusTraceImportResult} Aggregates and provenance. Releases the temporary index even if the sink fails.
   */
  const finish = (): RuntimeBusTraceImportResult => {
    if (finished || failed) {
      throw new Error("Bus trace importer cannot be finalized again or after failure.");
    }
    finished = true;
    try {
      const sourceSha256 = hash.digest("hex");
      storage?.onSource?.(sourceSha256, RUNTIME_BUS_INDEX_PROFILE);
      const evidenceId = `evidence:bus-trace:${sourceSha256}`;
      const runtime: RuntimeEvidenceRecord[] = [];
      for (const { fact, count } of index.values()) {
        if (fact.kind !== "memory" || fact.record.kind !== "runtime-bus-access") {
          throw new Error("Bus trace index contains an unexpected fact kind.");
        }
        const record: RuntimeBusAccessRecord = {
          ...fact.record,
          id: `runtime:bus-trace:${sourceSha256}:${fact.record.id}`,
          count,
          evidence: [evidenceId],
        };
        if (storage?.onRecord) {
          storage.onRecord(record);
        } else {
          runtime.push(record);
        }
      }
      const transferSummary = transfers?.finish();
      const graphicsSummary = graphics.finish();
      const ppuSummary = ppu?.finish();
      const transferCounts: Record<string, number> = {};
      if (ppuSummary) {
        for (const key of [
          "portWrites",
          "written",
          "blocked",
          "latched",
          "byteWrites",
          "renderingRestricted",
        ] as const) {
          transferCounts[`ppu.${key}`] = ppuSummary[key];
        }
      }
      if (transferSummary) {
        transferCounts.streamEvents = streamEvents;
        transferCounts.transferMarkers = markerEvents;
        // These bounded totals are retained with import provenance. Full boundary
        // configurations and ordered transfer history stay in the raw capture.
        for (const group of transferSummary.activity) {
          for (const field of [
            "complete",
            "interrupted",
            "leadingPartial",
            "trailingPartial",
            "bothPartial",
            "attemptedSlots",
            "reads",
            "writes",
          ] as const) {
            transferCounts[`${group.actor}${group.channel}.${field}`] = group[field];
          }
        }
      }
      const report: ImportReport = {
        id: `import:bus-trace:${sourceSha256}`,
        format: RUNTIME_BUS_TRACE_FORMAT,
        indexProfile: RUNTIME_BUS_INDEX_PROFILE,
        sourceName: context.sourceName,
        sourceSha256,
        sourceVersion: `v1@${meta.producer.id}:${meta.producer.revision}`,
        imported: {
          ...transferCounts,
          busEvents: observed,
          busRecords: facts,
          unownedEvents: observed - contexts.instruction,
        },
        unsupported: [],
        // Diagnostic text participates in immutable import identity. Preserve its historical
        // payload; views describe these limits as omitted projections, never required retention.
        warnings: [
          "Bus facts retain byte-access variants and exact counts. Ordered timing, raster and instruction-ordinal history require the capture archive.",
          transfers
            ? "Transfer totals use explicit native boundaries. Partial windows stay explicit. Full configuration and ordered history require the capture archive."
            : "Activity counts describe observed bus accesses. Transfer boundaries, register setup and source instructions are not inferred.",
        ],
      };
      return {
        report,
        sourceSha256,
        observedEvents: observed,
        droppedEvents: 0,
        summary: {
          ...(transferSummary ? { transfers: transferSummary } : {}),
          ...(ppuSummary ? { ppu: ppuSummary } : {}),
          ...(graphicsSummary.activity.length ? { graphics: graphicsSummary } : {}),
          clock: meta.clock,
          firstCycle,
          lastCycle: firstCycle === null ? null : String(previousCycle),
          contexts,
          activity: [...activity.entries()]
            .toSorted(([a], [b]) => a.localeCompare(b))
            .map(([, value]) => value),
        },
        batch: {
          ...(storage?.onRecord
            ? {}
            : { runtime: runtime.toSorted((a, b) => a.id.localeCompare(b.id)) }),
          evidence: [
            {
              id: evidenceId,
              source: "runtime",
              sourceId: `${meta.producer.id}:${meta.producer.revision}`,
              confidence: "certain",
              detail: `${observed} lossless bus accesses. ${observed - contexts.instruction} without an owning instruction.`,
              artifact: {
                format: RUNTIME_BUS_TRACE_FORMAT,
                formatVersion: "1",
                sha256: sourceSha256,
                romContentSha256: meta.romContentSha256,
              },
            },
          ],
          imports: [report],
        },
      };
    } finally {
      index.clear();
    }
  };
  return { push, finish };
};

import { createHash } from "node:crypto";
import { TraceCache, } from "../internal/trace-cache.js";
import { validateRuntimeBusFact, } from "../model/runtime-bus-types.js";
import { createRuntimeGraphicsAccumulator, } from "./runtime-graphics.js";
import { createRuntimePPUAccumulator } from "./runtime-ppu.js";
import { createRuntimeTransferAccumulator, validateRuntimeTransferBoundary, } from "./runtime-transfer.js";
export const RUNTIME_BUS_TRACE_FORMAT = "uttori-asm-bus-trace";
/** Aggregates byte-access variants. Ordered timing and raster history require the capture archive. */
export const RUNTIME_BUS_INDEX_PROFILE = "bus-access-v1";
/** Parse a canonical unsigned wire integer without rounding through JavaScript numbers.
 * @param {unknown} value Decimal string, with no sign or leading zeroes.
 * @returns {number | bigint} Exact u64. Common small values avoid BigInt allocation. Invalid input throws.
 */
const unsigned = (value) => {
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
/** Normalize only semantic metadata, excluding archive allocation and file framing.
 * @param {unknown} value Producer metadata, possibly with transport-specific fields.
 * @returns {RuntimeBusTraceMetadata} Fresh canonical identity. Invalid metadata throws.
 */
export const validateRuntimeBusTraceMetadata = (value) => {
    const meta = value;
    if (!meta ||
        meta.format !== RUNTIME_BUS_TRACE_FORMAT ||
        meta.schemaVersion !== 1 ||
        (meta.scope !== "snes.cpu-bus" &&
            meta.scope !== "snes.cpu-bus-transfers" &&
            meta.scope !== "snes.cpu-bus-ppu") ||
        meta.architecture !== "snes.65816" ||
        meta.addressSpace !== "snes.cpu" ||
        typeof meta.romContentSha256 !== "string" ||
        !/^[\da-f]{64}$/.test(meta.romContentSha256) ||
        typeof meta.session !== "string" ||
        !/^[\da-f]{32}$/.test(meta.session) ||
        typeof meta.producer?.id !== "string" ||
        !meta.producer.id ||
        typeof meta.producer?.revision !== "string" ||
        !meta.producer.revision ||
        meta.clock?.id !== "snes.master") {
        throw new Error("Invalid SNES bus trace metadata.");
    }
    if (unsigned(meta.clock.numerator) === 0 || unsigned(meta.clock.denominator) === 0) {
        throw new Error("Bus trace clock frequency must be positive.");
    }
    return {
        format: RUNTIME_BUS_TRACE_FORMAT,
        schemaVersion: 1,
        scope: meta.scope,
        architecture: "snes.65816",
        addressSpace: "snes.cpu",
        romContentSha256: meta.romContentSha256,
        producer: { id: meta.producer.id, revision: meta.producer.revision },
        session: meta.session,
        clock: {
            id: "snes.master",
            numerator: meta.clock.numerator,
            denominator: meta.clock.denominator,
        },
    };
};
/** Validate and aggregate a stream with bounded chunks and a caller-owned, optionally disk-backed index.
 * @param {unknown} metadata Producer identity and clock.
 * @param {RuntimeBusTraceImportContext} context Expected ROM and distinct-fact budget.
 * @param {RuntimeTraceImporterStorage} storage Optional SQLite counters and transactional record sink.
 * @returns {object} Single-use push/finish importer. Any failed push permanently prevents publication.
 */
export const createRuntimeBusTraceImporter = (metadata, context, storage) => {
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
    const memory = new Map();
    const index = storage?.index ?? {
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
    const factKeys = new TraceCache(context.cacheMetrics?.facts);
    const activity = new Map();
    const contexts = {
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
    let previousCycle = 0;
    let firstCycle = null;
    let lastOrdinal = 0;
    let lastPc = 0;
    let finished = false;
    let failed = false;
    /** Index one bounded chunk. Counters remain provisional until the source confirms a complete tail.
     * @param {unknown} chunk Object containing 1–4095 ordered accesses.
     * @returns {void} Throws and discards the index on any invalid event or exhausted fact budget.
     */
    const push = (chunk) => {
        if (finished || failed) {
            throw new Error("Bus trace importer is no longer writable.");
        }
        try {
            const accesses = chunk?.accesses;
            if (!Array.isArray(accesses) || accesses.length < 1 || accesses.length > 4095) {
                throw new Error("Bus trace chunks require 1–4095 accesses.");
            }
            // At most 4,095 normalized lines amortize native hash.update() calls without
            // retaining the whole trace. Joining must add no chunk-boundary bytes.
            const hashLines = [];
            for (const item of accesses) {
                if (!item || typeof item !== "object") {
                    throw new Error("Invalid bus trace event.");
                }
                const access = item;
                const sequence = unsigned(access.sequence);
                const ordinal = unsigned(access.ordinal);
                const cycle = unsigned(access.cycle);
                // Accepted sequence counts are safe Numbers from unsigned(). Comparing
                // directly avoids allocating a BigInt for each otherwise-small counter.
                if (streamEvents === Number.MAX_SAFE_INTEGER || sequence !== streamEvents + 1) {
                    throw new Error("Bus trace event sequence is not contiguous or exceeds the safe count range.");
                }
                if (cycle < previousCycle) {
                    throw new Error("Bus trace master clock moved backwards.");
                }
                const hasOwner = ordinal > 0;
                if (hasOwner !== (access.context === "instruction")) {
                    throw new Error("Bus trace instruction context and ordinal disagree.");
                }
                // Ordinals may skip instructions without bus accesses, and zero denotes an unowned interval.
                if (ordinal > 0 &&
                    (ordinal < lastOrdinal || (ordinal === lastOrdinal && access.pc !== lastPc))) {
                    throw new Error("Bus trace instruction ownership moved backwards or changed PC.");
                }
                if (!Number.isInteger(access.hcounter) ||
                    access.hcounter < 0 ||
                    access.hcounter >= 1368 ||
                    !Number.isInteger(access.vcounter) ||
                    access.vcounter < 0 ||
                    access.vcounter >= 313) {
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
                const dataPort = access.direction === "write" &&
                    !(access.address & 0x400000) &&
                    [0x2104, 0x2118, 0x2119, 0x2122].includes(port);
                // This scope promises a native decision on every data-port write. A missing
                // annotation or a legacy stream carrying new fields is a corrupt source.
                if ((access.ppu !== undefined) !== Boolean(ppu && dataPort)) {
                    throw new Error("Missing or out-of-scope native PPU effect.");
                }
                const effect = access.ppu;
                if (access.ppu &&
                    (!Number.isInteger(access.ppu.hcounter) ||
                        access.ppu.hcounter < 0 ||
                        access.ppu.hcounter >= 1368 ||
                        !Number.isInteger(access.ppu.vcounter) ||
                        access.ppu.vcounter < 0 ||
                        access.ppu.vcounter >= 313)) {
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
                }
                else {
                    graphics.push(access);
                }
                const factJson = JSON.stringify(fact);
                let key = factKeys.get(factJson);
                if (key === undefined) {
                    key = createHash("sha256").update(factJson).digest("hex");
                    factKeys.insert(factJson, key);
                }
                if (index.add(key, () => ({
                    kind: "memory",
                    record: {
                        ...fact,
                        id: key,
                        kind: "runtime-bus-access",
                        architecture: meta.architecture,
                        count: 1,
                        evidence: [],
                    },
                }))) {
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
                }
                else {
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
                    activity: [...activity.values()].map((group) => ({ ...group })),
                });
            }
        }
        catch (error) {
            failed = true;
            index.clear();
            throw error;
        }
    };
    /** Assign stable source identities and emit records once, inside the caller's publication transaction.
     * @returns {RuntimeBusTraceImportResult} Aggregates and provenance. Releases the temporary index even if the sink fails.
     */
    const finish = () => {
        if (finished || failed) {
            throw new Error("Bus trace importer cannot be finalized again or after failure.");
        }
        finished = true;
        try {
            const sourceSha256 = hash.digest("hex");
            storage?.onSource?.(sourceSha256, RUNTIME_BUS_INDEX_PROFILE);
            const evidenceId = `evidence:bus-trace:${sourceSha256}`;
            const runtime = [];
            for (const { fact, count } of index.values()) {
                if (fact.kind !== "memory" || fact.record.kind !== "runtime-bus-access") {
                    throw new Error("Bus trace index contains an unexpected fact kind.");
                }
                const record = {
                    ...fact.record,
                    id: `runtime:bus-trace:${sourceSha256}:${fact.record.id}`,
                    count,
                    evidence: [evidenceId],
                };
                if (storage?.onRecord) {
                    storage.onRecord(record);
                }
                else {
                    runtime.push(record);
                }
            }
            const transferSummary = transfers?.finish();
            const graphicsSummary = graphics.finish();
            const ppuSummary = ppu?.finish();
            const transferCounts = {};
            if (ppuSummary) {
                for (const key of [
                    "portWrites",
                    "written",
                    "blocked",
                    "latched",
                    "byteWrites",
                    "renderingRestricted",
                ]) {
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
                    ]) {
                        transferCounts[`${group.actor}${group.channel}.${field}`] = group[field];
                    }
                }
            }
            const report = {
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
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([, value]) => value),
                },
                batch: {
                    ...(storage?.onRecord
                        ? {}
                        : { runtime: runtime.sort((a, b) => a.id.localeCompare(b.id)) }),
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
        }
        finally {
            index.clear();
        }
    };
    return { push, finish };
};
//# sourceMappingURL=runtime-bus-trace.js.map
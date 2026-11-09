import { open, link, unlink, lstat } from "node:fs/promises";
import { compressCaptureChunk, captureU64, captureScope, captureChunkRecords, decodeCaptureChunk, captureCrc32c, validateCaptureCapabilities, validateCapturePosition, validateCaptureMetadata, nativePosition, exportCaptureJson, } from "@uttori/asm-capture";
import { CaptureContextRecorder } from "./capture-context.js";
/** Yields briefly so native capture pumps can make progress between chunks. */
const pause = () => new Promise((resolve) => setTimeout(resolve, 10));
/** Normalizes capture output format with json as the default. */
function captureOutputFormat(value) {
    const format = value ?? "json";
    if (format !== "json" && format !== "act2") {
        throw new Error("Unsupported capture output format.");
    }
    return format;
}
/** Wraps JSON metadata in a magic-prefixed, CRC-protected binary frame. */
const jsonFrame = (magic, value) => {
    const body = Buffer.from(JSON.stringify(value));
    if (body.length > 65536) {
        throw new Error("Capture metadata exceeds its bound.");
    }
    const header = Buffer.alloc(12);
    header.write(magic, "ascii");
    header.writeUInt32LE(body.length, 4);
    header.writeUInt32LE(captureCrc32c(body), 8);
    return Buffer.concat([header, body]);
};
/** Returns zeroed timing counters for one capture stage. */
const emptyStageTiming = () => ({
    calls: 0,
    totalMs: 0,
    maxMs: 0,
});
/** One bounded chunk at a time. Acceptance follows data sync AND checkpoint sync. */
export class LosslessCaptureFileRecorder {
    /** Resolves when the archive is finalized or the recorder is torn down. */
    completion;
    #file;
    #partial;
    #archive;
    #format;
    #scope;
    #transport;
    #context;
    #handle;
    #position;
    #stopRequested = false;
    #cancelled = false;
    #through = 0n;
    #chunk = 0n;
    #cycle = 0n;
    #timings;
    constructor(file, handle, transport, position, format, scope, measureStages, context) {
        this.#file = file;
        this.#context = context;
        this.#format = format;
        this.#scope = scope;
        this.#archive = format === "act2" ? file : `${file}.act2`;
        this.#partial = `${this.#archive}.partial`;
        this.#handle = handle;
        // A stop may arrive while a pull/ack is in flight. The transport may allow
        // only one outstanding request (RSP), so serialize the recorder's calls.
        let tail = Promise.resolve();
        this.#transport = (request) => {
            const operation = tail.then(() => transport(request));
            tail = operation.then(() => undefined, () => undefined);
            return operation;
        };
        this.#position = position;
        if (measureStages) {
            this.#timings = {
                started: performance.now(),
                bytes: 0,
                stages: {
                    read: emptyStageTiming(),
                    decode: emptyStageTiming(),
                    dataWrite: emptyStageTiming(),
                    dataSync: emptyStageTiming(),
                    checkpointWrite: emptyStageTiming(),
                    checkpointSync: emptyStageTiming(),
                    ack: emptyStageTiming(),
                    status: emptyStageTiming(),
                    idle: emptyStageTiming(),
                    finalize: emptyStageTiming(),
                },
            };
        }
        this.completion = this.#pump();
    }
    /**
     * Reserve a new output and start lossless recording. ACT2 output publishes only the archive.
     * Legacy JSON output additionally exports a compatible trace after draining the producer.
     * @param options Output format, identity and serialized producer transport.
     * @returns Active recorder. Stop() drains and syncs it.
     */
    static async create(options) {
        validateCaptureMetadata(options);
        const scope = captureScope(options.scope ?? "snes.65816.instructions");
        const format = captureOutputFormat(options.format);
        // Reject before reserving files or arming the producer: legacy instruction JSON
        // cannot represent bus-only records without discarding their evidence.
        if (scope !== "snes.65816.instructions" &&
            scope !== "nes.2a03.instructions" &&
            format !== "act2") {
            throw new Error("Bus capture requires ACT2 output. Instruction JSON cannot represent it.");
        }
        validateCaptureCapabilities(await options.transport({ operation: "capabilities", scope }), scope);
        const archive = format === "act2" ? options.file : `${options.file}.act2`;
        const context = options.context === false
            ? undefined
            : new CaptureContextRecorder(archive, options, options.transport);
        const transport = context?.transport ?? options.transport;
        if (format === "json") {
            // Legacy callers own a reserved JSON destination. ACT2 callers reserve only the partial
            // archive. The final no-clobber link also guards against another writer publishing first.
            const destination = await open(options.file, "wx");
            await destination.close();
        }
        else {
            const existing = await lstat(archive).catch((error) => {
                if (error.code !== "ENOENT") {
                    throw error;
                }
                return undefined;
            });
            if (existing) {
                throw new Error("Capture destination already exists.");
            }
        }
        let handle;
        let position;
        try {
            handle = await open(`${archive}.partial`, "wx");
            position = validateCapturePosition(await transport({
                operation: "start",
                bufferBytes: options.bufferBytes ?? 8 * 1024 * 1024,
                scope,
            }));
            // Retain a valid session identity first so a scope mismatch still aborts
            // an armed producer instead of abandoning a queue that can stall emulation.
            validateCapturePosition(position, undefined, scope);
            if (position.producedThrough !== "0" ||
                position.chunkThrough !== "0" ||
                position.state !== "armed") {
                throw new Error("Capture did not start at an empty armed boundary.");
            }
            const header = {
                format: "uttori-ares-capture",
                version: 2,
                session: position.session,
                scope,
                ownership: "durable-prefix",
                compression: "zstd",
                checksum: "crc32c",
                maxChunkBytes: 262144,
                allocatedBytes: position.allocatedBytes,
                clock: {
                    id: options.architecture === "65xx.2a03" ? "nes.master" : "snes.master",
                    numerator: position.clockNumerator,
                    denominator: position.clockDenominator,
                },
                architecture: options.architecture,
                addressSpace: options.addressSpace,
                romContentSha256: options.romContentSha256,
                ...(options.romFileSha256 ? { romFileSha256: options.romFileSha256 } : {}),
                producer: options.producer,
            };
            await handle.writeFile(jsonFrame("ACS2", header));
            await handle.sync();
            return new LosslessCaptureFileRecorder(options.file, handle, transport, position, format, scope, options.measureStages === true, context);
        }
        catch (error) {
            if (position) {
                await transport({ operation: "abort", session: position.session }).catch(() => undefined);
            }
            await handle?.close().catch(() => undefined);
            if (format === "json") {
                await unlink(options.file).catch(() => undefined);
            }
            throw error;
        }
    }
    /**
     * Current producer session, for a paused user milestone.
     * @returns Latest verified position; querying does not drain the archive.
     */
    get position() {
        return this.#position;
    }
    /**
     * Requests a graceful stop and waits for archive finalization.
     * @returns Summary after the completion promise settles.
     */
    async stop() {
        if (!this.#stopRequested) {
            this.#stopRequested = true;
            try {
                validateCapturePosition(await this.#transport({ operation: "stop", session: this.#position.session }), this.#position.session, this.#scope);
            }
            catch (error) {
                this.#cancelled = true;
                await this.completion.catch(() => undefined);
                throw error;
            }
        }
        return this.completion;
    }
    /**
     * Marks the recording cancelled and still waits for teardown to finish.
     * @returns Summary from the completion promise after abort paths run.
     */
    finishIncomplete() {
        this.#cancelled = true;
        return this.completion;
    }
    /**
     * Account one completed stage without retaining per-chunk samples.
     * @param stage Work completed since the previous boundary.
     * @param start Monotonic start in milliseconds, or zero with profiling disabled.
     * @returns Next boundary. Disabled profiling never reads the clock.
     */
    #mark(stage, start) {
        if (!this.#timings) {
            return 0;
        }
        const now = performance.now(), elapsed = now - start, entry = this.#timings.stages[stage];
        entry.calls++;
        entry.totalMs += elapsed;
        entry.maxMs = Math.max(entry.maxMs, elapsed);
        return now;
    }
    async #pump() {
        const session = this.#position.session;
        try {
            while (!this.#cancelled) {
                let boundary = this.#timings ? performance.now() : 0;
                const result = await this.#transport({
                    operation: "read",
                    session,
                    chunk: String(this.#chunk + 1n),
                });
                boundary = this.#mark("read", boundary);
                if (!("hex" in result) ||
                    typeof result.hex !== "string" ||
                    result.hex.length > 524288 ||
                    result.hex.length % 2 ||
                    !/^[\da-f]*$/.test(result.hex)) {
                    throw new Error("Invalid capture read response.");
                }
                if (result.hex) {
                    const bytes = Buffer.from(result.hex, "hex"), chunk = decodeCaptureChunk(bytes, session, this.#scope);
                    const records = captureChunkRecords(chunk);
                    if (BigInt(chunk.sequence) !== this.#chunk + 1n ||
                        BigInt(chunk.first) !== this.#through + 1n ||
                        BigInt(records[0].cycle) < this.#cycle) {
                        throw new Error("Capture chunk is not contiguous.");
                    }
                    boundary = this.#mark("decode", boundary);
                    // Compress only after validation; the unchanged event identity is acknowledged
                    // after the encoded chunk and its checkpoint have both reached durable storage.
                    const stored = compressCaptureChunk(bytes);
                    if (this.#timings) {
                        this.#timings.bytes += stored.length;
                    }
                    await this.#handle.writeFile(stored);
                    boundary = this.#mark("dataWrite", boundary);
                    await this.#handle.sync();
                    boundary = this.#mark("dataSync", boundary);
                    await this.#handle.writeFile(jsonFrame("ACK2", {
                        session,
                        chunkThrough: chunk.sequence,
                        eventThrough: chunk.through,
                    }));
                    boundary = this.#mark("checkpointWrite", boundary);
                    await this.#handle.sync();
                    boundary = this.#mark("checkpointSync", boundary);
                    // Producer retention is released only after the checkpoint is synced.
                    const p = validateCapturePosition(await this.#transport({
                        operation: "ack",
                        session,
                        chunk: chunk.sequence,
                        event: chunk.through,
                    }), session, this.#scope);
                    this.#mark("ack", boundary);
                    if (p.durableThrough !== chunk.through || p.chunkThrough !== chunk.sequence) {
                        throw new Error("Producer acknowledgement did not match the durable checkpoint.");
                    }
                    this.#position = p;
                    this.#chunk = BigInt(chunk.sequence);
                    this.#through = BigInt(chunk.through);
                    this.#cycle = BigInt(records.at(-1).cycle);
                }
                else {
                    boundary = this.#mark("decode", boundary);
                    this.#position = validateCapturePosition(await this.#transport({ operation: "status", session }), session, this.#scope);
                    boundary = this.#mark("status", boundary);
                    if (this.#position.state === "incomplete") {
                        throw new Error(`Native capture incomplete: ${this.#position.error}`);
                    }
                    if (this.#position.state === "complete") {
                        break;
                    }
                    await pause();
                    this.#mark("idle", boundary);
                }
            }
            if (this.#cancelled) {
                throw new Error("Capture session ended before finalization. The partial archive retains its committed prefix.");
            }
            const p = this.#position;
            if (!this.#stopRequested ||
                p.state !== "complete" ||
                p.producedThrough !== String(this.#through) ||
                p.producedChunks !== String(this.#chunk)) {
                throw new Error("Capture terminal accounting did not reconcile.");
            }
            const finalStart = this.#timings ? performance.now() : 0;
            await this.#handle.writeFile(jsonFrame("END2", p));
            await this.#handle.sync();
            await this.#handle.close();
            // A no-clobber link publishes the fully synced inode. Power-loss durability
            // of directory entries is deliberately not claimed by this prototype.
            const archive = this.#archive;
            await link(this.#partial, archive);
            await unlink(this.#partial);
            if (this.#format === "json") {
                await exportCaptureJson(archive, this.#file, true);
            }
            this.#mark("finalize", finalStart);
            const summary = {
                ...(this.#timings
                    ? {
                        timings: {
                            elapsedMs: performance.now() - this.#timings.started,
                            bytes: this.#timings.bytes,
                            stages: this.#timings.stages,
                        },
                    }
                    : {}),
                file: this.#file,
                archive,
                scope: this.#scope,
                observedEvents: Number(this.#through),
                droppedEvents: 0,
                chunks: Number(this.#chunk),
                complete: true,
                position: p,
                ...(this.#context ? { contextDirectory: this.#context.directory } : {}),
            };
            await this.#context?.finish(summary);
            return summary;
        }
        catch (error) {
            await this.#transport({ operation: "abort", session }).catch(() => undefined);
            await this.#handle.close().catch(() => undefined);
            throw error;
        }
    }
}
/**
 * Controls a local native ACT2 writer. No event bytes cross RSP/DAP and no live
 * decoding occurs here. The existing bounded archive reader validates on import.
 */
export class NativeCaptureFileRecorder {
    /** Resolves when the native writer finishes or the recorder is cancelled. */
    completion;
    #file;
    #scope;
    #transport;
    #context;
    #position;
    #stopRequested = false;
    #cancelled = false;
    /**
     * Latest validated durable position. Observing it never reads or drains event bytes.
     * @returns Read-only status snapshot from the control pump.
     */
    get position() {
        return this.#position;
    }
    constructor(file, scope, transport, position, context) {
        this.#file = file;
        this.#context = context;
        this.#scope = scope;
        this.#position = position;
        let tail = Promise.resolve();
        // Polling, stop and cancellation share the one-outstanding-request transport.
        this.#transport = (request) => {
            const operation = tail.then(() => transport(request));
            tail = operation.then(() => undefined, () => undefined);
            return operation;
        };
        this.completion = this.#pump();
    }
    /**
     * Arm while the debugger is stopped, then await the durable session header.
     * The supplied path belongs to the native host, which must share this filesystem.
     * @param options Destination, scope, verified identity and control transport.
     * @returns Armed recorder with a durable session header.
     */
    static async create(options) {
        validateCaptureMetadata(options);
        const scope = captureScope(options.scope ?? "snes.65816.instructions");
        const cap = validateCaptureCapabilities(await options.transport({ operation: "file-capabilities", scope }), scope);
        if (!cap.nativeFile) {
            throw new Error("Runtime does not support native file capture.");
        }
        const context = options.context === false
            ? undefined
            : new CaptureContextRecorder(options.file, options, options.transport);
        const transport = context?.transport ?? options.transport;
        let position;
        let session;
        try {
            const initial = await transport({
                operation: "file-start",
                ...(options.measureStages ? { measureStages: true } : {}),
                file: options.file,
                scope,
                bufferBytes: options.bufferBytes ?? 8 * 1024 * 1024,
                romContentSha256: options.romContentSha256,
                ...(options.romFileSha256 ? { romFileSha256: options.romFileSha256 } : {}),
                producer: options.producer,
            });
            // Keep a valid identity before checking additional file/scope fields so
            // rejected setup can still cancel a producer that has already armed.
            session = validateCapturePosition(initial).session;
            position = nativePosition(initial, session, scope);
            while (position.fileState === "preparing") {
                await pause();
                position = nativePosition(await transport({ operation: "file-status", session: position.session }), position.session, scope);
            }
            if (position.fileState !== "writing" || position.state !== "armed") {
                throw new Error(`Native file capture could not prepare its output: ${position.error || position.fileState}.`);
            }
            return new NativeCaptureFileRecorder(options.file, scope, transport, position, context);
        }
        catch (error) {
            if (session) {
                await transport({ operation: "file-abort", session }).catch(() => undefined);
            }
            throw error;
        }
    }
    /**
     * Fix the capture boundary, then wait for synced END2 and no-clobber publication.
     * @returns Published complete archive, or a writer failure.
     */
    async stop() {
        if (!this.#stopRequested) {
            this.#stopRequested = true;
            try {
                nativePosition(await this.#transport({ operation: "file-stop", session: this.#position.session }), this.#position.session, this.#scope);
            }
            catch (error) {
                this.#cancelled = true;
                await this.completion.catch(() => undefined);
                throw error;
            }
        }
        return this.completion;
    }
    /**
     * Leave a recoverable partial artifact. Never publish an interrupted session.
     * @returns Existing completion. Rejects on cancellation.
     */
    finishIncomplete() {
        this.#cancelled = true;
        return this.completion;
    }
    async #pump() {
        try {
            while (!this.#cancelled) {
                const p = nativePosition(await this.#transport({ operation: "file-status", session: this.#position.session }), this.#position.session, this.#scope);
                this.#position = p;
                if (p.fileState === "incomplete" || p.state === "incomplete") {
                    throw new Error(`Native capture incomplete: ${p.error}.`);
                }
                if (p.fileState === "complete") {
                    const events = captureU64(p.producedThrough), chunks = captureU64(p.producedChunks);
                    if (events > BigInt(Number.MAX_SAFE_INTEGER) ||
                        chunks > BigInt(Number.MAX_SAFE_INTEGER)) {
                        throw new Error("Native capture totals exceed the consumer's exact integer range.");
                    }
                    const summary = {
                        file: this.#file,
                        archive: this.#file,
                        scope: this.#scope,
                        observedEvents: Number(events),
                        droppedEvents: 0,
                        chunks: Number(chunks),
                        complete: true,
                        position: p,
                        ...(this.#context ? { contextDirectory: this.#context.directory } : {}),
                    };
                    await this.#context?.finish(summary);
                    return summary;
                }
                // Capture drains at native scheduler exits. Polling frequency affects
                // status latency only and never limits writer throughput.
                await new Promise((resolve) => setTimeout(resolve, 50));
            }
            throw new Error("Native capture cancelled. The partial archive remains incomplete.");
        }
        catch (error) {
            await this.#transport({ operation: "file-abort", session: this.#position.session }).catch(() => undefined);
            throw error;
        }
    }
}
//# sourceMappingURL=capture-file.js.map
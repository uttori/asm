import { open, lstat } from "node:fs/promises";
import { setImmediate as yieldToMessages } from "node:timers/promises";
import { CaptureFrameReader } from "./capture-file-reader.js";
import { captureCrc32c, captureU64, captureSession, captureScope, captureChunkRecords, decodeCaptureChunk, validateCapturePosition, } from "./capture-v2.js";
const isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
/** Preserve consumer failures instead of interpreting them as recoverable archive truncation. */
const consumerRejected = (failed) => failed;
export function validateCaptureMetadata(m) {
    if (!isRecord(m)) {
        throw new Error("Capture requires a supported CPU scope and exact ROM/producer identity.");
    }
    const producer = m.producer;
    if (!((m.architecture === "snes.65816" && m.addressSpace === "snes.cpu") ||
        (m.architecture === "65xx.2a03" && m.addressSpace === "nes.cpu")) ||
        typeof m.romContentSha256 !== "string" ||
        !/^[\da-f]{64}$/.test(m.romContentSha256) ||
        (m.romFileSha256 !== undefined &&
            (typeof m.romFileSha256 !== "string" || !/^[\da-f]{64}$/.test(m.romFileSha256))) ||
        !isRecord(producer) ||
        typeof producer.id !== "string" ||
        !producer.id ||
        typeof producer.revision !== "string" ||
        !producer.revision) {
        throw new Error("Capture requires a supported CPU scope and exact ROM/producer identity.");
    }
}
/**
 * Reject oversized input before reading. Recovery tools remain unlimited unless given a budget.
 * @param {number} size File size or proposed read end, in bytes.
 * @param {CaptureFileReadOptions} options Optional positive safe-integer byte limit.
 */
const checkCaptureSize = (size, options) => {
    const limit = options.maxBytes ?? Number.MAX_SAFE_INTEGER;
    if (!Number.isSafeInteger(limit) || limit < 1) {
        throw new Error("Capture maximum bytes must be a positive safe integer.");
    }
    if (size > limit) {
        throw new Error(`Capture is ${(size / 1024 ** 3).toFixed(2)} GiB and exceeds the import byte limit of ${(limit / 1024 ** 3).toFixed(2)} GiB (${limit} bytes). Increase limits.captureBytes in .uttori/project.json for a Git source project, or asm.trace.maxImportSizeMiB for other trace imports.`);
    }
};
/**
 * Validate the bounded header before choosing a consumer or accepting any scoped chunks.
 * @param {unknown} value Decoded, checksummed JSON header.
 * @returns {CaptureFileHeader} Supported archive identity and ownership contract.
 */
function headerAllocationAccepted(value) {
    return (typeof value === "number" &&
        Number.isSafeInteger(value) &&
        value >= 4718656 &&
        value <= 64 * 1024 * 1024);
}
function assertCaptureFileHeader(value) {
    if (!isRecord(value)) {
        throw new Error("Missing capture session header.");
    }
    validateCaptureMetadata(value);
    captureSession(value.session);
    captureScope(value.scope);
    if ((value.scope === "nes.2a03.instructions" || value.scope === "nes.cpu-bus-ppu") !==
        (value.architecture === "65xx.2a03")) {
        throw new Error("Capture scope and architecture disagree.");
    }
    const clock = value.clock;
    if (!isRecord(clock) ||
        clock.id !== (value.architecture === "65xx.2a03" ? "nes.master" : "snes.master") ||
        !captureU64(clock.numerator) ||
        !captureU64(clock.denominator)) {
        throw new Error("Invalid session clock domain.");
    }
    if (value.format !== "uttori-ares-capture" ||
        value.version !== 2 ||
        value.ownership !== "durable-prefix" ||
        (value.compression !== "none" && value.compression !== "zstd") ||
        value.checksum !== "crc32c" ||
        value.maxChunkBytes !== 262144 ||
        !headerAllocationAccepted(value.allocatedBytes)) {
        throw new Error("Unsupported capture session contract.");
    }
}
const validateCaptureFileHeader = (value) => {
    assertCaptureFileHeader(value);
    return value;
};
/**
 * Read exactly one bounded frame component. Short reads must never become zero-filled valid data.
 * @param {FileHandle} handle Caller-owned open archive handle.
 * @param {number} length Validated frame component length, in bytes.
 * @param {number} offset Absolute file byte offset.
 * @returns {Promise<Buffer>} Fully initialized bytes. Premature EOF rejects the read.
 */
const readCaptureBytes = async (handle, length, offset) => {
    const bytes = Buffer.allocUnsafe(length);
    let got = 0;
    while (got < length) {
        const result = await handle.read(bytes, got, length - got, offset + got);
        if (!result.bytesRead) {
            throw new Error("Torn capture frame.");
        }
        got += result.bytesRead;
    }
    return bytes;
};
/**
 * Read only the checksummed session header, without scanning the archive's event chunks.
 * @param {string} file ACT2 archive path.
 * @param {CaptureFileReadOptions} options Byte budget and cancellation.
 * @returns {Promise<CaptureFileHeader>} Validated identity. Completion is checked during consumption.
 */
export const readCaptureFileHeader = async (file, options = {}) => {
    options.signal?.throwIfAborted();
    const handle = await open(file, "r");
    try {
        checkCaptureSize((await handle.stat()).size, options);
        const prefix = await readCaptureBytes(handle, 12, 0);
        if (prefix.toString("ascii", 0, 4) !== "ACS2") {
            throw new Error("Missing capture session header.");
        }
        const length = prefix.readUInt32LE(4);
        if (length > 65536) {
            throw new Error("Capture metadata length exceeds bounds.");
        }
        const body = await readCaptureBytes(handle, length, 12);
        if (captureCrc32c(body) !== prefix.readUInt32LE(8)) {
            throw new Error("Capture metadata checksum mismatch.");
        }
        options.signal?.throwIfAborted();
        return validateCaptureFileHeader(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body)));
    }
    finally {
        await handle.close();
    }
};
/**
 * Scan bounded frames, delivering only chunks backed by validated checkpoints.
 * @param {string} file Archive or partial artifact.
 * @param {Function} accept Optional committed-chunk consumer.
 * @param {CaptureFileReadOptions} options Scan budget, cancellation and progress. Consumer failures propagate.
 * @returns {Promise<CaptureRecovery>} Validated prefix and terminal integrity.
 */
export const recoverCaptureFile = async (file, accept, options = {}) => {
    options.signal?.throwIfAborted();
    const handle = await open(file, "r");
    let before;
    try {
        before = await handle.stat();
        checkCaptureSize(before.size, options);
    }
    catch (error) {
        await handle.close();
        throw error;
    }
    let offset = 0;
    // Coalesce sequential component reads within the initial snapshot. A growing
    // file cannot extend this offline scan. Final metadata checks still detect changes.
    const reader = new CaptureFrameReader((buffer, start, length, position) => {
        options.signal?.throwIfAborted();
        return handle.read(buffer, start, length, position);
    });
    const read = async (length) => {
        options.signal?.throwIfAborted();
        checkCaptureSize(offset + length, options);
        const started = options.onTiming ? performance.now() : 0;
        const b = await reader.read(length, offset, before.size);
        options.onTiming?.("read", performance.now() - started);
        offset += length;
        return b;
    };
    const json = async (prefix) => {
        const length = prefix.readUInt32LE(4);
        if (length > 65536) {
            throw new Error("Capture metadata length exceeds bounds.");
        }
        const body = await read(length);
        if (captureCrc32c(body) !== prefix.readUInt32LE(8)) {
            throw new Error("Capture metadata checksum mismatch.");
        }
        return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
    };
    let header;
    try {
        const prefix = await read(12);
        if (prefix.toString("ascii", 0, 4) !== "ACS2") {
            throw new Error("Missing capture session header.");
        }
        header = validateCaptureFileHeader(await json(prefix));
    }
    catch (error) {
        await handle.close();
        throw error;
    }
    let chunkThrough = 0n, eventThrough = 0n, lastCycle = 0n;
    let pending;
    let consumerFailed = false;
    try {
        while (true) {
            const prefix = await read(12), magic = prefix.toString("ascii", 0, 4);
            if (magic === "ACT2") {
                if (pending) {
                    throw new Error("Uncommitted capture chunk before another chunk.");
                }
                const envelope = Buffer.concat([prefix, await read(52)]);
                if (envelope.readUInt16LE(6) !== 0 && header.compression === "none") {
                    throw new Error("Compressed chunk in an uncompressed capture session.");
                }
                const length = envelope.readUInt32LE(48);
                if (length > 262144 - 64) {
                    throw new Error("Capture chunk exceeds negotiated bound.");
                }
                const bytes = Buffer.concat([envelope, await read(length)]);
                const started = options.onTiming ? performance.now() : 0;
                pending = decodeCaptureChunk(bytes, header.session, header.scope);
                options.onTiming?.("decode", performance.now() - started);
                if (BigInt(pending.sequence) !== chunkThrough + 1n ||
                    BigInt(pending.first) !== eventThrough + 1n ||
                    BigInt(captureChunkRecords(pending)[0].cycle) < lastCycle) {
                    throw new Error("Noncontiguous capture history.");
                }
            }
            else if (magic === "ACK2") {
                const checkpoint = await json(prefix);
                if (!isRecord(checkpoint) ||
                    !pending ||
                    checkpoint.session !== header.session ||
                    checkpoint.chunkThrough !== pending.sequence ||
                    checkpoint.eventThrough !== pending.through) {
                    throw new Error("Checkpoint does not match the pending chunk.");
                }
                if (accept) {
                    try {
                        const started = options.onTiming ? performance.now() : 0;
                        await accept(pending);
                        options.onTiming?.("consume", performance.now() - started);
                    }
                    catch (error) {
                        // A consumer may reject an import budget, stale project or cancellation. These
                        // failures belong to the caller, not to archive recovery, and must keep their type.
                        consumerFailed = true;
                        throw error;
                    }
                }
                chunkThrough = BigInt(pending.sequence);
                eventThrough = BigInt(pending.through);
                lastCycle = BigInt(captureChunkRecords(pending).at(-1).cycle);
                pending = undefined;
                options.onProgress?.(offset, before.size);
                // Read-ahead removes the I/O waits between many checkpoints. Retain a
                // full turn for cancellation and async cleanup. Promise.resolve() would
                // only enqueue another microtask. Omitting this yield raised cancellation
                // latency and peak RSS in dense runs, despite faster small-chunk recovery.
                await yieldToMessages(undefined, { signal: options.signal });
            }
            else if (magic === "END2") {
                const terminal = validateCapturePosition(await json(prefix), header.session, header.scope);
                if (pending ||
                    terminal.state !== "complete" ||
                    captureU64(terminal.producedThrough) !== eventThrough ||
                    captureU64(terminal.producedChunks) !== chunkThrough) {
                    throw new Error("Terminal capture totals disagree with the committed prefix.");
                }
                const after = await handle.stat();
                if (after.size !== offset) {
                    throw new Error("Unexpected bytes after capture terminal.");
                }
                if (after.size !== before.size || after.mtimeMs !== before.mtimeMs) {
                    throw new Error("Capture archive changed while being read.");
                }
                options.onProgress?.(offset, before.size);
                options.signal?.throwIfAborted();
                return {
                    header,
                    complete: true,
                    chunkThrough: String(chunkThrough),
                    eventThrough: String(eventThrough),
                };
            }
            else {
                throw new Error("Unknown required capture frame.");
            }
        }
    }
    catch (error) {
        options.signal?.throwIfAborted();
        if (consumerRejected(consumerFailed)) {
            throw error;
        }
        return {
            header,
            complete: false,
            chunkThrough: String(chunkThrough),
            eventThrough: String(eventThrough),
            reason: error instanceof Error ? error.message : String(error),
        };
    }
    finally {
        await handle.close();
    }
};
/**
 * Stream a verified complete archive into the existing instruction importer format.
 * @param {string} archive Complete ACT2 artifact.
 * @param {string} destination New JSON artifact.
 * @param {boolean} reserved Whether the recorder already reserved an empty destination.
 * @returns {Promise<void>} Settlement after the export is synced and closed.
 */
export const exportCaptureJson = async (archive, destination, reserved = false) => {
    // Validate before creating a complete-looking legacy artifact. Recovery callers
    // inspect the committed prefix separately. Incomplete archives cannot be promoted.
    const verified = await recoverCaptureFile(archive);
    if (!verified.complete) {
        throw new Error(`Capture archive is incomplete: ${verified.reason}`);
    }
    if (verified.header.scope !== "snes.65816.instructions" &&
        verified.header.scope !== "nes.2a03.instructions") {
        throw new Error("Bus capture cannot be exported as an instruction trace. Retain the ACT2 archive.");
    }
    if (BigInt(verified.eventThrough) >= BigInt(Number.MAX_SAFE_INTEGER)) {
        throw new Error("Legacy JSON sequence numbers cannot represent this capture. Retain the exact ACT2 archive.");
    }
    const h = await open(destination, reserved ? "r+" : "wx");
    try {
        if (reserved && (await h.stat()).size !== 0) {
            throw new Error("Reserved trace destination changed during capture.");
        }
        const m = verified.header;
        await h.writeFile(JSON.stringify({
            format: "uttori-asm-instruction-trace",
            schemaVersion: 1,
            architecture: m.architecture,
            addressSpace: m.addressSpace,
            romContentSha256: m.romContentSha256,
            ...(m.romFileSha256 ? { romFileSha256: m.romFileSha256 } : {}),
            producer: m.producer,
        }).slice(0, -1) + ',"chunks":[');
        let first = true;
        const result = await recoverCaptureFile(archive, async (chunk) => {
            // A replaced archive must not change scope between the verification and export scans.
            if (chunk.scope !== "snes.65816.instructions" && chunk.scope !== "nes.2a03.instructions") {
                throw new Error("Capture scope changed during instruction export.");
            }
            await h.writeFile((first ? "" : ",") +
                JSON.stringify({
                    sequenceStart: Number(chunk.first),
                    addresses: chunk.instructions.map((i) => i.address),
                    details: chunk.instructions.map((i) => i.detail),
                    droppedEvents: 0,
                    active: false,
                }));
            first = false;
        });
        if (!result.complete || result.eventThrough !== verified.eventThrough) {
            throw new Error("Capture archive changed during export.");
        }
        await h.writeFile("]}\n");
        await h.sync();
    }
    finally {
        await h.close();
    }
};
/** Append-only native archive cursor. Reads only the producer's synced byte prefix,
 * retaining one bounded chunk and an open inode across no-clobber publication.
 * Every callback is provisional until END2 and the published path both validate.
 */
export class NativeCaptureFileCursor {
    header;
    #handle;
    #options;
    #identity;
    #offset;
    #chunk = 0n;
    #event = 0n;
    #cycle = 0n;
    #watermark = 0;
    #failed = false;
    #complete = false;
    constructor(handle, header, offset, identity, options) {
        this.#handle = handle;
        this.header = header;
        this.#offset = offset;
        this.#identity = identity;
        this.#options = options;
    }
    /** Open a prepared native partial file, or a completed archive for replay tests.
     * @param {string} file Native-owned append-only file path.
     * @param {CaptureFileReadOptions} options Byte budget and cancellation.
     * @returns {Promise<NativeCaptureFileCursor>} Cursor pinning the checksummed session header and inode.
     */
    static async open(file, options = {}) {
        options.signal?.throwIfAborted();
        const handle = await open(file, "r");
        try {
            const identity = await handle.stat();
            const prefix = await readCaptureBytes(handle, 12, 0);
            const length = prefix.readUInt32LE(4);
            if (prefix.toString("ascii", 0, 4) !== "ACS2" || length > 65536) {
                throw new Error("Invalid native capture header.");
            }
            checkCaptureSize(12 + length, options);
            const body = await readCaptureBytes(handle, length, 12);
            if (captureCrc32c(body) !== prefix.readUInt32LE(8)) {
                throw new Error("Capture metadata checksum mismatch.");
            }
            const header = validateCaptureFileHeader(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body)));
            return new NativeCaptureFileCursor(handle, header, 12 + length, identity, options);
        }
        catch (error) {
            await handle.close();
            throw error;
        }
    }
    /** Byte offset includes only the header and consumed, checkpointed chunks.
     * @returns {number} Consumed file bytes, for bounded backlog accounting.
     */
    get readBytes() {
        return this.#offset;
    }
    get observedEvents() {
        return String(this.#event);
    }
    get complete() {
        return this.#complete;
    }
    /** Read at most maxChunks (default 16) from a validated native status. Growth beyond
     * that durable watermark is ignored even if an unsynced ACK2 is already visible.
     * A failure permanently poisons the cursor. Callers must discard staged facts.
     * @param {NativeCaptureFilePosition} value Native producer's latest durable watermark.
     * @param {Function} accept Provisional synchronous chunk consumer. Exceptions poison this cursor.
     * @param {number} maxChunks Maximum chunks per slice, in [1, 256].
     * @param {string} publishedFile Final path whose inode must agree before completion.
     * @returns {Promise<void>} Settlement of one bounded read slice.
     */
    async readThrough(value, accept, maxChunks = 16, publishedFile) {
        if (this.#failed) {
            throw new Error("Native capture cursor failed previously.");
        }
        try {
            this.#options.signal?.throwIfAborted();
            const position = nativePosition(value, this.header.session, this.header.scope);
            const bytes = Number(captureU64(position.fileBytes));
            if (!Number.isSafeInteger(bytes) ||
                bytes < this.#watermark ||
                bytes < this.#offset ||
                !Number.isSafeInteger(maxChunks) ||
                maxChunks < 1 ||
                maxChunks > 256) {
                throw new Error("Native capture watermark or chunk budget is invalid.");
            }
            checkCaptureSize(bytes, this.#options);
            if (position.fileState === "incomplete") {
                throw new Error("Native capture was interrupted.");
            }
            if (this.#complete) {
                if (bytes !== this.#watermark || position.fileState !== "complete") {
                    throw new Error("Completed native capture changed.");
                }
                return;
            }
            this.#watermark = bytes;
            const before = await this.#handle.stat();
            if (before.size < bytes) {
                throw new Error("Native capture is shorter than its durable watermark.");
            }
            // Scope read-ahead to this slice's snapshot. Reusing an unread tail across
            // calls could hide a changed frame before the next status arrives.
            // Cap speculative buffering by both the slice's chunk budget and 1 MiB.
            // the read limit below remains the synced watermark, never visible file size.
            const reader = new CaptureFrameReader((buffer, start, length, offset) => {
                this.#options.signal?.throwIfAborted();
                return this.#handle.read(buffer, start, length, offset);
            }, Math.min(1048576, maxChunks * 262144));
            const read = async (length) => {
                this.#options.signal?.throwIfAborted();
                if (this.#offset + length > bytes) {
                    throw new Error("Native durable watermark splits a frame.");
                }
                const result = await reader.read(length, this.#offset, bytes);
                this.#offset += length;
                return result;
            };
            const json = async (prefix) => {
                const length = prefix.readUInt32LE(4);
                if (length > 65536) {
                    throw new Error("Capture metadata exceeds bounds.");
                }
                const body = await read(length);
                if (captureCrc32c(body) !== prefix.readUInt32LE(8)) {
                    throw new Error("Capture metadata checksum mismatch.");
                }
                return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
            };
            for (let count = 0; this.#offset < bytes && count < maxChunks; count++) {
                const prefix = await read(12);
                const magic = prefix.toString("ascii", 0, 4);
                if (magic === "END2") {
                    const terminal = validateCapturePosition(await json(prefix), this.header.session, this.header.scope);
                    if (terminal.state !== "complete" ||
                        position.fileState !== "complete" ||
                        captureU64(terminal.producedThrough) !== this.#event ||
                        captureU64(terminal.producedChunks) !== this.#chunk ||
                        position.producedThrough !== terminal.producedThrough ||
                        position.producedChunks !== terminal.producedChunks ||
                        this.#offset !== bytes) {
                        throw new Error("Native capture terminal disagrees with the consumed prefix.");
                    }
                    const after = await this.#handle.stat();
                    if (after.size !== bytes ||
                        before.size !== after.size ||
                        before.mtimeMs !== after.mtimeMs) {
                        throw new Error("Native capture changed during final validation.");
                    }
                    if (publishedFile) {
                        const published = await lstat(publishedFile);
                        if (!published.isFile() ||
                            published.dev !== this.#identity.dev ||
                            published.ino !== this.#identity.ino) {
                            throw new Error("Native capture publication replaced the opened file.");
                        }
                    }
                    this.#complete = true;
                    break;
                }
                if (magic !== "ACT2") {
                    throw new Error("Native capture expected an ACT2 chunk.");
                }
                const envelope = Buffer.concat([prefix, await read(52)]);
                if (envelope.readUInt16LE(6) !== 0 && this.header.compression === "none") {
                    throw new Error("Compressed chunk in an uncompressed capture session.");
                }
                const length = envelope.readUInt32LE(48);
                if (length > 262144 - 64) {
                    throw new Error("Capture chunk exceeds its bound.");
                }
                const chunk = decodeCaptureChunk(Buffer.concat([envelope, await read(length)]), this.header.session, this.header.scope);
                const records = captureChunkRecords(chunk);
                if (captureU64(chunk.sequence) !== this.#chunk + 1n ||
                    captureU64(chunk.first) !== this.#event + 1n ||
                    captureU64(records[0].cycle) < this.#cycle ||
                    captureU64(chunk.through) > captureU64(position.durableThrough)) {
                    throw new Error("Noncontiguous native capture history.");
                }
                const ackPrefix = await read(12);
                if (ackPrefix.toString("ascii", 0, 4) !== "ACK2") {
                    throw new Error("Native capture chunk has no checkpoint.");
                }
                const ack = await json(ackPrefix);
                if (!isRecord(ack) ||
                    ack.session !== this.header.session ||
                    ack.chunkThrough !== chunk.sequence ||
                    ack.eventThrough !== chunk.through) {
                    throw new Error("Native checkpoint disagrees with its chunk.");
                }
                accept(chunk);
                this.#chunk = captureU64(chunk.sequence);
                this.#event = captureU64(chunk.through);
                this.#cycle = captureU64(records.at(-1).cycle);
                // Yield at a validated checkpoint, even inside a multi-chunk slice, so
                // microtask-only reads cannot defer IPC/cancellation until the whole slice
                // finishes. The worker's outer scheduling yield cannot replace this one.
                await yieldToMessages(undefined, { signal: this.#options.signal });
            }
            if (this.#offset === bytes && !this.#complete && position.fileState === "complete") {
                throw new Error("Completed native capture has no terminal frame.");
            }
            this.#options.onProgress?.(this.#offset, bytes);
        }
        catch (error) {
            this.#failed = true;
            throw error;
        }
    }
    /** Close the pinned inode. Pending analysis remains caller-owned and provisional. */
    async close() {
        await this.#handle.close();
    }
}
export const nativePosition = (value, session, scope) => {
    const position = validateCapturePosition(value, session, scope);
    if (!isRecord(value)) {
        throw new Error("Invalid native file state.");
    }
    const fileState = value.fileState;
    if (fileState !== "preparing" &&
        fileState !== "writing" &&
        fileState !== "complete" &&
        fileState !== "incomplete") {
        throw new Error("Invalid native file state.");
    }
    const fileBytes = value.fileBytes;
    const fileBatches = value.fileBatches;
    captureU64(fileBytes);
    captureU64(fileBatches);
    if (typeof fileBytes !== "string" || typeof fileBatches !== "string") {
        throw new Error("Invalid native file counters.");
    }
    let fileProfile;
    if (value.fileProfile) {
        if (!isRecord(value.fileProfile)) {
            throw new Error("Invalid native file profile.");
        }
        const sealNs = value.fileProfile.sealNs;
        const copyNs = value.fileProfile.copyNs;
        const writeNs = value.fileProfile.writeNs;
        const syncNs = value.fileProfile.syncNs;
        captureU64(sealNs);
        captureU64(copyNs);
        captureU64(writeNs);
        captureU64(syncNs);
        if (typeof sealNs !== "string" ||
            typeof copyNs !== "string" ||
            typeof writeNs !== "string" ||
            typeof syncNs !== "string") {
            throw new Error("Invalid native file profile.");
        }
        fileProfile = { sealNs, copyNs, writeNs, syncNs };
    }
    if ((position.state === "complete") !== (fileState === "complete")) {
        throw new Error("Native file publication and producer completion disagree.");
    }
    return {
        ...position,
        fileState,
        fileBytes,
        fileBatches,
        ...(fileProfile ? { fileProfile } : {}),
    };
};
//# sourceMappingURL=capture-file.js.map
const maxU64 = (1n << 64n) - 1n;
/**
 * Validate the explicit stream dictionary. Callers choose the instruction default only on omission.
 * @param {unknown} value Scope supplied by the caller or archive header.
 * @returns {CaptureScopeV2} Supported stream identity. Unknown values throw.
 */
export const captureScope = (value) => {
    if (value !== "snes.65816.instructions" &&
        value !== "snes.cpu-bus" &&
        value !== "snes.cpu-bus-transfers" &&
        value !== "snes.cpu-bus-ppu")
        throw new Error("Unsupported capture scope.");
    return value;
};
export const captureU64 = (value) => {
    if (typeof value !== "string" || !/^(0|[1-9]\d{0,19})$/.test(value) || BigInt(value) > maxU64)
        throw new Error("Capture counter must be a canonical unsigned 64-bit decimal string.");
    return BigInt(value);
};
export const captureSession = (value) => {
    if (typeof value !== "string" || !/^[\da-f]{32}$/.test(value))
        throw new Error("Invalid capture session identity.");
    return value;
};
export const validateCaptureRequest = (value) => {
    if (!value || typeof value !== "object")
        throw new Error("Invalid capture request.");
    // File negotiation has its own packet family. Unsupported runtimes must fail
    // before arming instead of silently streaming a user-selected native capture.
    if (value.operation === "file-capabilities") {
        if (Object.keys(value).some((key) => !["operation", "scope"].includes(key)))
            throw new Error("Unsupported native file capability field.");
        if (value.scope !== undefined)
            captureScope(value.scope);
        return;
    }
    if (value.operation === "file-start") {
        if (Object.keys(value).some((key) => ![
            "operation",
            "scope",
            "bufferBytes",
            "file",
            "romContentSha256",
            "producer",
            "measureStages",
        ].includes(key)))
            throw new Error("Unsupported native file start field.");
        if (value.measureStages !== undefined && typeof value.measureStages !== "boolean")
            throw new Error("Native file profiling must be boolean.");
        validateCaptureRequest({
            operation: "start",
            bufferBytes: value.bufferBytes,
            scope: value.scope,
        });
        const bounded = (text, max) => typeof text === "string" &&
            text.length > 0 &&
            !text.includes("\0") &&
            new TextEncoder().encode(text).length <= max;
        if (!bounded(value.file, 4096) ||
            !/^(?:\/|[a-z]:[/\\]|\\\\)/i.test(value.file) ||
            !/^[\da-f]{64}$/.test(value.romContentSha256) ||
            !bounded(value.producer?.id, 256) ||
            !bounded(value.producer?.revision, 1024) ||
            Object.keys(value.producer).some((key) => !["id", "revision"].includes(key)))
            throw new Error("Native file capture requires an absolute bounded path and exact ROM/producer identity.");
        return;
    }
    let fields = ["operation", "session"];
    if (value.operation === "capabilities")
        fields = ["operation", "scope"];
    if (value.operation === "start")
        fields = ["operation", "bufferBytes", "scope"];
    if (value.operation === "read")
        fields = ["operation", "session", "chunk"];
    if (value.operation === "ack")
        fields = ["operation", "session", "chunk", "event"];
    if (Object.keys(value).some((key) => !fields.includes(key)))
        throw new Error("Unsupported capture negotiation field. Capture requires an explicit supported stream with durable ownership.");
    if (value.operation === "capabilities" || value.operation === "start") {
        if (value.scope !== undefined)
            captureScope(value.scope);
    }
    if (value.operation === "capabilities")
        return;
    if (value.operation === "start") {
        if (!Number.isSafeInteger(value.bufferBytes) ||
            value.bufferBytes < 4718656 ||
            value.bufferBytes > 64 * 1024 * 1024)
            throw new Error("Capture buffer must be between 4718656 bytes and 64 MiB.");
        return;
    }
    captureSession(value.session);
    if ([
        "status",
        "stop",
        "abort",
        "release",
        "file-status",
        "file-stop",
        "file-abort",
        "file-release",
    ].includes(value.operation))
        return;
    if (value.operation === "read" || value.operation === "ack") {
        if (!captureU64(value.chunk))
            throw new Error("Capture chunk sequence starts at one.");
        if (value.operation === "ack" && !captureU64(value.event))
            throw new Error("Capture event sequence starts at one.");
        return;
    }
    throw new Error("Unsupported capture operation.");
};
/**
 * Require the requested scope and its reservation size. Never downgrade to a different stream.
 * @param {unknown} value Native capability reply.
 * @param {CaptureScopeV2} scope Requested stream, defaulting to instructions for older callers.
 * @returns {CaptureCapabilitiesV2} Verified lossless ownership and allocation contract.
 */
export const validateCaptureCapabilities = (value, scope = "snes.65816.instructions") => {
    captureScope(scope);
    let reserve = 71;
    if (scope === "snes.cpu-bus")
        reserve = 64;
    if (scope === "snes.cpu-bus-transfers")
        reserve = 80;
    if (scope === "snes.cpu-bus-ppu")
        reserve = 88;
    const expected = {
        version: 2,
        scope,
        mode: "lossless",
        ownership: "durable-prefix",
        maxChunkBytes: 262144,
        requiredReserveBytes: reserve,
        overheadBytes: 4194304,
        resumeSession: false,
    };
    if (!value ||
        typeof value !== "object" ||
        Object.entries(expected).some(([key, item]) => value[key] !== item))
        throw new Error("Unsupported capture scope, reserve, or ownership contract.");
    if (value.nativeFile === true)
        return { ...expected, nativeFile: true };
    return expected;
};
/**
 * Scope is stable for a session. Only legacy instruction positions may omit it.
 * @param {unknown} value Native status or archive terminal frame.
 * @param {string} session Expected identity when an active session is already known.
 * @param {CaptureScopeV2} scope Expected stream. Bus positions must explicitly confirm it.
 * @returns {CapturePositionV2} Validated ownership boundaries and integrity state.
 */
export const validateCapturePosition = (value, session, scope) => {
    if (!value || typeof value !== "object")
        throw new Error("Invalid capture position.");
    const p = value;
    captureSession(p.session);
    if (session !== undefined && p.session !== session)
        throw new Error("Capture session changed.");
    if (p.scope !== undefined)
        captureScope(p.scope);
    if (scope !== undefined && (p.scope ?? "snes.65816.instructions") !== captureScope(scope))
        throw new Error("Capture scope changed or was not confirmed by the producer.");
    if (!["armed", "recording", "throttled", "stopping", "draining", "complete", "incomplete"].includes(p.state))
        throw new Error("Invalid capture state.");
    const bounds = [
        p.releasedThrough,
        p.durableThrough,
        p.acceptedThrough,
        p.deliveredThrough,
        p.producedThrough,
    ].map(captureU64);
    if (bounds.some((v, i) => i > 0 && v < bounds[i - 1]))
        throw new Error("Capture ownership boundaries are inconsistent.");
    if (captureU64(p.chunkThrough) > captureU64(p.producedChunks))
        throw new Error("Capture chunk boundary is inconsistent.");
    captureU64(p.throttleCount);
    if (!captureU64(p.clockNumerator) || !captureU64(p.clockDenominator))
        throw new Error("Invalid capture clock domain.");
    if (p.droppedInScope !== "0" || typeof p.error !== "string" || p.error.length > 256)
        throw new Error("Capture integrity failed.");
    if (![p.bufferedBytes, p.allocatedBytes].every((v) => Number.isSafeInteger(v) && v >= 0 && v <= 64 * 1024 * 1024) ||
        p.bufferedBytes > p.allocatedBytes)
        throw new Error("Capture allocation exceeds its bounds.");
    if (p.state === "complete" &&
        (p.error ||
            p.bufferedBytes ||
            new Set(bounds.map(String)).size !== 1 ||
            p.chunkThrough !== p.producedChunks))
        throw new Error("Capture terminal totals do not reconcile.");
    return p;
};
const crcTable = Uint32Array.from({ length: 256 }, (_, byte) => {
    let crc = byte;
    for (let bit = 0; bit < 8; bit++)
        crc = (crc >>> 1) ^ (crc & 1 ? 0x82f63b78 : 0);
    return crc >>> 0;
});
// Fixed 8 KiB slicing tables process eight bytes per dependency chain. No native
// addon is required in either the extension host or the offline worker.
const crcSlices = [crcTable];
for (let slice = 1; slice < 8; slice++)
    crcSlices.push(Uint32Array.from(crcSlices[slice - 1], (crc) => (crc >>> 8) ^ crcTable[crc & 255]));
/**
 * CRC-32C Castagnoli, including the canonical 123456789 test vector.
 * @param {Uint8Array} bytes Bytes to checksum.
 * @param {boolean} zeroChecksum Treat the ACT2 checksum field as zero.
 * @returns {number} Unsigned checksum.
 */
export const captureCrc32c = (bytes, zeroChecksum = false) => {
    let crc = 0xffffffff;
    let i = 0;
    for (; i + 8 <= bytes.length; i += 8) {
        // The checksum occupies aligned bytes 56–59. Treat only that word as zero.
        // never mutate the caller's shared buffer while validating an ACT2 chunk.
        let low = bytes[i] | (bytes[i + 1] << 8) | (bytes[i + 2] << 16) | (bytes[i + 3] << 24);
        if (zeroChecksum && i === 56)
            low = 0;
        const a = crc ^ low;
        crc =
            crcSlices[7][a & 255] ^
                crcSlices[6][(a >>> 8) & 255] ^
                crcSlices[5][(a >>> 16) & 255] ^
                crcSlices[4][a >>> 24] ^
                crcSlices[3][bytes[i + 4]] ^
                crcSlices[2][bytes[i + 5]] ^
                crcSlices[1][bytes[i + 6]] ^
                crcSlices[0][bytes[i + 7]];
    }
    for (; i < bytes.length; i++)
        crc = (crc >>> 8) ^ crcTable[(crc ^ (zeroChecksum && i >= 56 && i < 60 ? 0 : bytes[i])) & 0xff];
    return (crc ^ 0xffffffff) >>> 0;
};
/**
 * Common ordering fields without converting bus accesses into instruction records.
 * @param {CaptureChunkV2} chunk Validated nonempty chunk.
 * @returns {readonly (CaptureInstructionV2 | CaptureBusAccessV2 | CaptureTransferV2)[]} Original ordered record array.
 */
export const captureChunkRecords = (chunk) => {
    if (chunk.scope === "snes.65816.instructions")
        return chunk.instructions;
    if (chunk.scope === "snes.cpu-bus")
        return chunk.accesses;
    return chunk.events;
};
export function decodeCaptureChunk(bytes, session, scope = "snes.65816.instructions") {
    captureSession(session);
    captureScope(scope);
    if (bytes.length < 64 || bytes.length > 262144)
        throw new Error("Capture chunk length exceeds bounds.");
    const b = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (b.toString("ascii", 0, 4) !== "ACT2" ||
        b.readUInt16LE(4) !== 2 ||
        b.readUInt16LE(6) !== 0 ||
        b.readUInt32LE(44) !== 64 ||
        b.readUInt32LE(60) !== 0)
        throw new Error("Unsupported capture envelope.");
    if (b.toString("hex", 8, 24) !== session)
        throw new Error("Capture chunk belongs to another session.");
    if (b.readUInt32LE(48) !== bytes.length - 64 || b.readUInt32LE(52) !== bytes.length - 64)
        throw new Error("Capture payload lengths disagree.");
    if (captureCrc32c(bytes, true) !== b.readUInt32LE(56))
        throw new Error("Capture checksum mismatch.");
    const sequence = b.readBigUInt64LE(24), first = b.readBigUInt64LE(32), count = b.readUInt32LE(40);
    const through = first + BigInt(count) - 1n;
    const maxRecords = scope === "snes.65816.instructions" ? 3854 : 4095;
    if (!sequence || !first || !count || count > maxRecords || through > maxU64)
        throw new Error("Invalid capture sequence range.");
    const identity = {
        session,
        sequence: String(sequence),
        first: String(first),
        through: String(through),
    };
    if (scope === "snes.cpu-bus")
        return {
            ...identity,
            scope,
            accesses: decodeBusAccesses(b, first, count),
        };
    if (scope === "snes.cpu-bus-transfers" || scope === "snes.cpu-bus-ppu")
        return {
            ...identity,
            scope,
            events: decodeBusAccesses(b, first, count, true, scope === "snes.cpu-bus-ppu"),
        };
    const instructions = [];
    let offset = 64;
    for (let i = 0; i < count; i++) {
        if (offset + 68 > b.length)
            throw new Error("Truncated capture record.");
        const length = b.readUInt32LE(offset + 4), n = b[offset + 48];
        const event = first + BigInt(i), ordinal = b.readBigUInt64LE(offset + 32), address = b.readBigUInt64LE(offset + 40);
        if (b.readUInt16LE(offset) !== 1 ||
            b.readUInt16LE(offset + 2) !== 1 ||
            b.readUInt32LE(offset + 16) !== 0 ||
            b.readUInt32LE(offset + 20) !== 0)
            throw new Error("Unsupported required capture record.");
        if (n < 1 ||
            n > 4 ||
            length !== 67 + n ||
            offset + length > b.length ||
            b.readUInt16LE(offset + 49) !== 16)
            throw new Error("Invalid instruction record length.");
        if (b.readBigUInt64LE(offset + 8) !== event || ordinal !== event || address > 0xffffffn)
            throw new Error("Instruction identity disagrees with capture scope.");
        const r = offset + 51 + n;
        const state = {
            a: b.readUInt16LE(r),
            x: b.readUInt16LE(r + 2),
            y: b.readUInt16LE(r + 4),
            s: b.readUInt16LE(r + 6),
            d: b.readUInt16LE(r + 8),
            db: b[r + 10],
            pb: b[r + 11],
            pc: b.readUInt16LE(r + 12),
            p: b[r + 14],
            e: b[r + 15],
        };
        if (state.e > 1 || ((state.pb << 16) | state.pc) !== Number(address))
            throw new Error("Captured PC/state mismatch.");
        const cycle = b.readBigUInt64LE(offset + 24);
        if (i && cycle < BigInt(instructions[i - 1].cycle))
            throw new Error("Capture clock moved backwards.");
        instructions.push({
            sequence: String(event),
            ordinal: String(ordinal),
            cycle: String(cycle),
            address: Number(address),
            detail: { bytes: [...b.subarray(offset + 51, r)], state },
        });
        offset += length;
    }
    if (offset !== b.length)
        throw new Error("Capture record count does not consume the payload exactly.");
    return {
        ...identity,
        scope,
        instructions,
    };
}
/**
 * Decode 64-byte bus accesses and optional 80-byte boundaries after envelope, session and CRC validation.
 * @param {Buffer} b Complete validated envelope and payload.
 * @param {bigint} first First event sequence declared in the envelope.
 * @param {number} count Bounded, nonzero record count.
 * @param {boolean} transfers Whether the negotiated scope also permits boundary markers.
 * @param {boolean} ppu Require verified effects on every mapped graphics data-port write.
 * @returns {readonly (CaptureBusAccessV2 | CaptureTransferV2)[]} Decoded accesses and markers. Invalid fields reject the whole chunk.
 */
const decodeBusAccesses = (b, first, count, transfers = false, ppu = false) => {
    if (!transfers && b.length !== 64 + count * 64)
        throw new Error("Invalid bus record payload length.");
    const accesses = [];
    const actors = ["cpu", "dma", "hdma"];
    const phases = ["cpu", "dma", "hdma-table", "hdma-indirect", "hdma-transfer"];
    const contexts = ["unattributed", "instruction", "interrupt", "wait", "stop"];
    let lastCycle = 0n;
    let offset = 64;
    for (let i = 0; i < count; i++) {
        if (offset + 64 > b.length)
            throw new Error("Truncated bus/transfer record.");
        if (transfers && b.readUInt16LE(offset) === 3) {
            const marker = decodeTransfer(b, offset, first + BigInt(i));
            if (BigInt(marker.cycle) < lastCycle)
                throw new Error("Capture clock moved backwards.");
            lastCycle = BigInt(marker.cycle);
            accesses.push(marker);
            offset += 80;
            continue;
        }
        const extended = ppu && b.readUInt16LE(offset + 2) === 2;
        const length = extended ? 88 : 64;
        if (b.readUInt16LE(offset) !== 2 ||
            b.readUInt16LE(offset + 2) !== (extended ? 2 : 1) ||
            b.readUInt32LE(offset + 4) !== length ||
            offset + length > b.length ||
            b.readUInt32LE(offset + 16) !== 0 ||
            b.readUInt32LE(offset + 20) !== 0 ||
            b.readUInt16LE(offset + 62) !== 0)
            throw new Error("Unsupported required bus capture record.");
        const event = first + BigInt(i);
        const cycle = b.readBigUInt64LE(offset + 24);
        const ordinal = b.readBigUInt64LE(offset + 32);
        const address = b.readBigUInt64LE(offset + 40);
        const pc = b.readUInt32LE(offset + 48);
        const direction = b[offset + 53], actor = b[offset + 54], channel = b[offset + 55];
        const phase = b[offset + 56], context = b[offset + 57];
        const hcounter = b.readUInt16LE(offset + 58), vcounter = b.readUInt16LE(offset + 60);
        if (b.readBigUInt64LE(offset + 8) !== event || address > 0xffffffn || pc > 0xffffff)
            throw new Error("Bus identity disagrees with capture scope.");
        // Actor/phase/channel are redundant on the wire so corrupted attribution cannot
        // quietly turn a table read into payload, or attach a DMA channel to a CPU access.
        const expectedActor = phase === 0 ? 0 : 2;
        const phaseActor = phase === 1 ? 1 : expectedActor;
        if (direction > 1 ||
            phase >= phases.length ||
            actor !== phaseActor ||
            (actor === 0 ? channel !== 255 : channel > 7) ||
            ((phase === 2 || phase === 3) && direction !== 0) ||
            context >= contexts.length ||
            (ordinal !== 0n) !== (context === 1) ||
            hcounter >= 1368 ||
            vcounter >= 313)
            throw new Error("Invalid bus attribution or timing fields.");
        if (cycle < lastCycle)
            throw new Error("Capture clock moved backwards.");
        lastCycle = cycle;
        const port = Number(address) & 0xffff;
        const dataPort = direction === 1 &&
            !(Number(address) & 0x400000) &&
            [0x2104, 0x2118, 0x2119, 0x2122].includes(port);
        if (ppu && extended !== dataPort)
            throw new Error("Missing or misplaced PPU effect.");
        accesses.push({
            ...(extended ? { ppu: decodePPUEffect(b, offset, port) } : {}),
            sequence: String(event),
            ordinal: String(ordinal),
            cycle: String(cycle),
            address: Number(address),
            pc,
            value: b[offset + 52],
            direction: direction === 0 ? "read" : "write",
            actor: actors[actor],
            channel: actor === 0 ? null : channel,
            phase: phases[phase],
            context: contexts[context],
            hcounter,
            vcounter,
        });
        offset += length;
    }
    if (offset !== b.length)
        throw new Error("Capture record count does not consume the payload exactly.");
    return accesses;
};
/** Decode a native boundary after envelope validation. Cross-record lifecycle validation belongs to analysis.
 * @param {Buffer} b Complete envelope and payload.
 * @param {number} offset Start of the 80-byte marker.
 * @param {bigint} event Expected global event sequence.
 * @returns {CaptureTransferV2} Exact marker with raw channel configuration.
 */
const decodeTransfer = (b, offset, event) => {
    if (offset + 80 > b.length ||
        b.readUInt16LE(offset + 2) !== 1 ||
        b.readUInt32LE(offset + 4) !== 80 ||
        b.readUInt32LE(offset + 16) !== 0 ||
        b.readUInt32LE(offset + 20) !== 0 ||
        b.readUInt32LE(offset + 76) !== 0)
        throw new Error("Unsupported transfer capture record.");
    const sequence = b.readBigUInt64LE(offset + 8), ordinal = b.readBigUInt64LE(offset + 32), transferId = b.readBigUInt64LE(offset + 40), pc = b.readUInt32LE(offset + 48);
    const boundary = b[offset + 52], actor = b[offset + 53], channel = b[offset + 54], context = b[offset + 55];
    const hcounter = b.readUInt16LE(offset + 56), vcounter = b.readUInt16LE(offset + 58), transferred = b.readUInt32LE(offset + 72);
    const owned = ordinal !== 0n;
    if (sequence !== event ||
        pc > 0xffffff ||
        boundary > 2 ||
        (actor !== 1 && actor !== 2) ||
        channel > 7 ||
        context > 4 ||
        owned !== (context === 1) ||
        hcounter >= 1368 ||
        vcounter >= 313 ||
        b[offset + 71] > 15 ||
        (boundary === 0 && (transferId !== event || transferred !== 0)) ||
        (boundary !== 0 && (transferId >= event || transferred < 1 || transferred > 65536)) ||
        (actor === 2 && (boundary === 2 || transferred > 4)))
        throw new Error("Invalid transfer boundary identity, attribution or counters.");
    return {
        kind: "transfer",
        sequence: String(sequence),
        ordinal: String(ordinal),
        cycle: String(b.readBigUInt64LE(offset + 24)),
        transferId: String(transferId),
        pc,
        boundary: ["begin", "complete", "interrupted"][boundary],
        actor: actor === 1 ? "dma" : "hdma",
        channel,
        context: ["unattributed", "instruction", "interrupt", "wait", "stop"][context],
        hcounter,
        vcounter,
        transferred,
        configuration: {
            dmap: b[offset + 60],
            bbad: b[offset + 61],
            a1t: b.readUInt16LE(offset + 62),
            a1b: b[offset + 64],
            dasb: b[offset + 65],
            das: b.readUInt16LE(offset + 66),
            a2a: b.readUInt16LE(offset + 68),
            ntlr: b[offset + 70],
            flags: b[offset + 71],
        },
    };
};
/** Decode the fixed 24-byte effect extension. Malformed results reject the whole chunk.
 * @param {Buffer} b Fully bounded record bytes.
 * @param {number} offset Beginning of the 88-byte bus record.
 * @param {number} port Mapped graphics data port, already checked against direction and bank.
 * @returns {CapturePPUEffectV2} Native decision and ordered physical byte writes.
 */
const decodePPUEffect = (b, offset, port) => {
    const target = b[offset + 64], outcome = b[offset + 65], count = b[offset + 66], flags = b[offset + 67];
    const hcounter = b.readUInt16LE(offset + 68), vcounter = b.readUInt16LE(offset + 70);
    let expectedTarget = 1;
    if (port === 0x2122)
        expectedTarget = 2;
    if (port === 0x2104)
        expectedTarget = 3;
    if (target !== expectedTarget ||
        outcome > 2 ||
        count > 2 ||
        flags > 15 ||
        (flags & 3) === 3 ||
        (target !== 1 && flags & 8) ||
        hcounter >= 1368 ||
        vcounter >= 313 ||
        b.readUInt32LE(offset + 82) !== 0 ||
        b.readUInt16LE(offset + 86) !== 0)
        throw new Error("Invalid PPU effect identity, flags or raster.");
    if ((outcome === 0 &&
        (count === 0 || (target === 1 && count !== 1) || (target === 2 && count !== 2))) ||
        (outcome !== 0 && count !== 0) ||
        (outcome === 1 && (target !== 1 || !(flags & 2))) ||
        (outcome === 2 && (target === 1 || flags & 2)))
        throw new Error("Invalid PPU effect outcome or byte count.");
    const bytes = [];
    const vramBytes = flags & 8 ? 131072 : 65536;
    for (let i = 0; i < 2; i++) {
        const address = b.readUInt32LE(offset + 72 + i * 4), value = b[offset + 80 + i];
        if (i >= count) {
            if (address || value)
                throw new Error("Nonzero unused PPU effect slot.");
            continue;
        }
        let bound = vramBytes;
        if (target === 2)
            bound = 512;
        if (target === 3)
            bound = 544;
        if (address >= bound ||
            (target === 1 && ((address & 1) !== (port & 1) || value !== b[offset + 52])) ||
            (target === 2 &&
                (i === 0
                    ? (address & 1) !== 0
                    : address !== bytes[0].address + 1 || value !== (b[offset + 52] & 127))) ||
            (target === 3 && i === count - 1 && value !== b[offset + 52]))
            throw new Error("Invalid PPU physical byte address or value.");
        bytes.push({ address, value });
    }
    return {
        target: ["vram", "cgram", "oam"][target - 1],
        outcome: ["written", "blocked", "latched"][outcome],
        forcedBlank: Boolean(flags & 1),
        renderingRestricted: Boolean(flags & 2),
        implementation: flags & 4 ? "accurate" : "performance",
        vramBytes: target === 1 ? vramBytes : null,
        bytes,
        hcounter,
        vcounter,
    };
};
//# sourceMappingURL=capture-v2.js.map
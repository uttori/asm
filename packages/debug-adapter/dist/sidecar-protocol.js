import { randomBytes } from "node:crypto";
/** Stable identity of the emulator-neutral sidecar wire protocol. */
export const DEBUG_SIDECAR_PROTOCOL = "uttori-asm-debug-sidecar";
/** Supported wire revision. Peers reject messages with any other version. */
export const DEBUG_SIDECAR_PROTOCOL_VERSION = 1;
/** Commands available across the sidecar boundary. */
export const DEBUG_SIDECAR_COMMANDS = Object.freeze([
    "initialize",
    "connect",
    "disconnect",
    "pause",
    "continue",
    "step",
    "threads",
    "stackFrames",
    "registers",
    "readMemory",
    "setBreakpoints",
    "disassemble",
    "startTrace",
    "readTrace",
    "stopTrace",
    "capture",
    "ping",
    "shutdown",
]);
/** Events available across the sidecar boundary. */
export const DEBUG_SIDECAR_EVENTS = Object.freeze([
    "stopped",
    "continued",
    "terminated",
    "breakpoint",
    "output",
]);
/** Conservative defaults suitable for a local stdio or loopback connection. */
export const DEFAULT_DEBUG_SIDECAR_LIMITS = Object.freeze({
    maxFrameBytes: 1_048_576,
    maxBufferedBytes: 2_097_152,
    maxMemoryReadBytes: 1_048_576,
    maxDisassemblyInstructions: 4_096,
    maxBreakpoints: 4_096,
    maxTraceBatchEvents: 4_096,
    maxQueuedMessages: 1_024,
    maxQueuedBytes: 8_388_608,
});
const isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
const positiveInteger = (value) => typeof value === "number" && Number.isSafeInteger(value) && value > 0;
const nonNegativeInteger = (value) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const sessionPattern = /^[\w-]{32,128}$/;
/**
 * Creates a 256-bit base64url token intended for a single spawned sidecar session.
 * @returns {string} An unpredictable token safe for environment or inherited-pipe transfer.
 */
export const createDebugSidecarSessionToken = () => randomBytes(32).toString("base64url");
/**
 * Rejects weak, malformed, or accidentally logged/display-oriented session identifiers.
 * @param {unknown} value Candidate token.
 * @returns {asserts value is string} Assertion for a valid token.
 */
export function assertDebugSidecarSessionToken(value) {
    if (typeof value !== "string" || !sessionPattern.test(value)) {
        throw new Error("Sidecar session token must be 32-128 base64url characters.");
    }
}
const assertRequestBounds = (message, limits) => {
    const args = message.arguments ?? {};
    if (!isRecord(args)) {
        throw new Error("Sidecar request arguments must be an object.");
    }
    if (message.command === "readMemory") {
        const count = args.count;
        if (!nonNegativeInteger(count) || count > limits.maxMemoryReadBytes) {
            throw new Error(`Memory read count must be between 0 and ${limits.maxMemoryReadBytes}.`);
        }
    }
    if (message.command === "disassemble") {
        const count = args.count;
        if (!nonNegativeInteger(count) || count > limits.maxDisassemblyInstructions) {
            throw new Error(`Disassembly count must be between 0 and ${limits.maxDisassemblyInstructions}.`);
        }
    }
    if (message.command === "setBreakpoints") {
        const breakpoints = args.breakpoints;
        if (!Array.isArray(breakpoints) || breakpoints.length > limits.maxBreakpoints) {
            throw new Error(`Breakpoint count must be between 0 and ${limits.maxBreakpoints}.`);
        }
    }
    if (message.command === "readTrace") {
        const maxEvents = args.maxEvents;
        if (!positiveInteger(maxEvents) || maxEvents > limits.maxTraceBatchEvents) {
            throw new Error(`Trace batch size must be between 1 and ${limits.maxTraceBatchEvents}.`);
        }
    }
};
/**
 * Validates an untrusted decoded message before it reaches a backend implementation.
 * @param {unknown} value Candidate envelope.
 * @param {DebugSidecarProtocolLimits} limits Request and framing limits.
 * @returns {asserts value is DebugSidecarMessage} Assertion for a valid protocol envelope.
 */
export function assertDebugSidecarMessage(value, limits = DEFAULT_DEBUG_SIDECAR_LIMITS) {
    if (!isRecord(value)) {
        throw new Error("Sidecar message must be an object.");
    }
    if (value.protocol !== DEBUG_SIDECAR_PROTOCOL) {
        throw new Error(`Unsupported sidecar protocol '${String(value.protocol)}'.`);
    }
    if (value.version !== DEBUG_SIDECAR_PROTOCOL_VERSION) {
        throw new Error(`Unsupported sidecar protocol version '${String(value.version)}'.`);
    }
    assertDebugSidecarSessionToken(value.session);
    if (!positiveInteger(value.sequence)) {
        throw new Error("Sidecar message sequence must be a positive safe integer.");
    }
    if (value.type === "request") {
        if (!DEBUG_SIDECAR_COMMANDS.includes(value.command)) {
            throw new Error(`Unsupported sidecar command '${String(value.command)}'.`);
        }
        assertRequestBounds(value, limits);
        return;
    }
    if (value.type === "response") {
        if (!positiveInteger(value.requestSequence)) {
            throw new Error("Sidecar response requestSequence must be a positive safe integer.");
        }
        if (typeof value.success !== "boolean") {
            throw new Error("Sidecar response success must be boolean.");
        }
        if (!value.success && typeof value.error !== "string") {
            throw new Error("Failed sidecar response must include an error string.");
        }
        return;
    }
    if (value.type === "event") {
        if (!DEBUG_SIDECAR_EVENTS.includes(value.event)) {
            throw new Error(`Unsupported sidecar event '${String(value.event)}'.`);
        }
        if (!isRecord(value.body)) {
            throw new Error("Sidecar event body must be an object.");
        }
        return;
    }
    throw new Error(`Unsupported sidecar message type '${String(value.type)}'.`);
}
const validateLimits = (limits) => {
    for (const [name, value] of Object.entries(limits)) {
        if (!positiveInteger(value)) {
            throw new Error(`${name} must be a positive safe integer.`);
        }
    }
    if (limits.maxBufferedBytes < limits.maxFrameBytes + 4) {
        throw new Error("maxBufferedBytes must hold at least one complete framed message.");
    }
};
/**
 * Encodes one validated message as a four-byte big-endian length plus UTF-8 JSON.
 * @param {DebugSidecarMessage} message Authenticated protocol message.
 * @param {DebugSidecarProtocolLimits} limits Framing and request bounds.
 * @returns {Uint8Array} Portable binary frame suitable for stdio or a loopback socket.
 */
export const encodeDebugSidecarMessage = (message, limits = DEFAULT_DEBUG_SIDECAR_LIMITS) => {
    validateLimits(limits);
    assertDebugSidecarMessage(message, limits);
    const body = Buffer.from(JSON.stringify(message), "utf8");
    if (body.length > limits.maxFrameBytes) {
        throw new Error(`Sidecar frame exceeds ${limits.maxFrameBytes} bytes.`);
    }
    const frame = Buffer.allocUnsafe(body.length + 4);
    frame.writeUInt32BE(body.length, 0);
    body.copy(frame, 4);
    return frame;
};
/** Incremental decoder with frame bounds and per-connection anti-replay sequence checks. */
export class DebugSidecarMessageParser {
    #limits;
    #buffer = Buffer.alloc(0);
    #lastSequence = 0;
    /**
     * Creates one directional stream parser.
     * @param {DebugSidecarProtocolLimits} limits Framing and request limits.
     */
    constructor(limits = DEFAULT_DEBUG_SIDECAR_LIMITS) {
        validateLimits(limits);
        this.#limits = limits;
    }
    /**
     * Adds a transport chunk and returns every complete validated message in order.
     * @param {Uint8Array} chunk Next stdio or socket bytes.
     * @returns {DebugSidecarMessage[]} Complete messages decoded from the stream.
     */
    push(chunk) {
        if (this.#buffer.length + chunk.length > this.#limits.maxBufferedBytes) {
            throw new Error(`Sidecar receive buffer exceeds ${this.#limits.maxBufferedBytes} bytes.`);
        }
        this.#buffer = Buffer.concat([this.#buffer, chunk]);
        const messages = [];
        while (this.#buffer.length >= 4) {
            const length = this.#buffer.readUInt32BE(0);
            if (length === 0) {
                throw new Error("Sidecar frame body cannot be empty.");
            }
            if (length > this.#limits.maxFrameBytes) {
                throw new Error(`Sidecar frame declares ${length} bytes, above the configured limit.`);
            }
            if (this.#buffer.length < length + 4) {
                break;
            }
            const body = this.#buffer.subarray(4, length + 4);
            this.#buffer = this.#buffer.subarray(length + 4);
            let decoded;
            try {
                decoded = JSON.parse(body.toString("utf8"));
            }
            catch {
                throw new Error("Sidecar frame contains invalid JSON.");
            }
            assertDebugSidecarMessage(decoded, this.#limits);
            if (decoded.sequence <= this.#lastSequence) {
                throw new Error(`Sidecar sequence ${decoded.sequence} is not greater than ${this.#lastSequence}.`);
            }
            this.#lastSequence = decoded.sequence;
            messages.push(decoded);
        }
        return messages;
    }
}
/** Bounded FIFO for encoded messages. Overflow is explicit rather than silently dropping events. */
export class DebugSidecarMessageQueue {
    #limits;
    #frames = [];
    #bytes = 0;
    /**
     * Creates a bounded outgoing queue.
     * @param {DebugSidecarProtocolLimits} limits Framing and queue limits.
     */
    constructor(limits = DEFAULT_DEBUG_SIDECAR_LIMITS) {
        validateLimits(limits);
        this.#limits = limits;
    }
    /** @returns {number} Number of queued protocol messages. */
    get length() {
        return this.#frames.length;
    }
    /** @returns {number} Encoded bytes currently retained for transport backpressure. */
    get bytes() {
        return this.#bytes;
    }
    /**
     * Encodes and appends one message, failing the connection when bounds would be exceeded.
     * @param {DebugSidecarMessage} message Next ordered message.
     * @returns {void}
     */
    enqueue(message) {
        const frame = encodeDebugSidecarMessage(message, this.#limits);
        if (this.#frames.length >= this.#limits.maxQueuedMessages ||
            this.#bytes + frame.length > this.#limits.maxQueuedBytes) {
            throw new Error("Sidecar outgoing queue exceeded its backpressure limit.");
        }
        this.#frames.push(frame);
        this.#bytes += frame.length;
    }
    /**
     * Removes the oldest encoded frame.
     * @returns {Uint8Array | undefined} Oldest frame or undefined when empty.
     */
    dequeue() {
        const frame = this.#frames.shift();
        if (frame) {
            this.#bytes -= frame.length;
        }
        return frame;
    }
}
//# sourceMappingURL=sidecar-protocol.js.map
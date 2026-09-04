/** Stable identity of the emulator-neutral sidecar wire protocol. */
export declare const DEBUG_SIDECAR_PROTOCOL: "uttori-asm-debug-sidecar";
/** Initial sidecar wire revision. This project is unreleased, so the revision remains version 1. */
export declare const DEBUG_SIDECAR_PROTOCOL_VERSION: 1;
/** Commands available across the sidecar boundary. */
export declare const DEBUG_SIDECAR_COMMANDS: readonly ["initialize", "connect", "disconnect", "pause", "continue", "step", "threads", "stackFrames", "registers", "readMemory", "setBreakpoints", "disassemble", "startTrace", "readTrace", "stopTrace", "ping", "shutdown"];
/** Events available across the sidecar boundary. */
export declare const DEBUG_SIDECAR_EVENTS: readonly ["stopped", "continued", "terminated", "breakpoint", "output"];
/** Protocol limits enforced before emulator-specific code sees a request. */
export interface DebugSidecarProtocolLimits {
    readonly maxFrameBytes: number;
    readonly maxBufferedBytes: number;
    readonly maxMemoryReadBytes: number;
    readonly maxDisassemblyInstructions: number;
    readonly maxBreakpoints: number;
    readonly maxTraceBatchEvents: number;
    readonly maxQueuedMessages: number;
    readonly maxQueuedBytes: number;
}
/** Conservative defaults suitable for a local stdio or loopback connection. */
export declare const DEFAULT_DEBUG_SIDECAR_LIMITS: DebugSidecarProtocolLimits;
/** Common authenticated, ordered envelope fields. */
export interface DebugSidecarEnvelope {
    readonly protocol: typeof DEBUG_SIDECAR_PROTOCOL;
    readonly version: typeof DEBUG_SIDECAR_PROTOCOL_VERSION;
    readonly session: string;
    readonly sequence: number;
}
/** Request sent by the TypeScript backend client to a native sidecar. */
export interface DebugSidecarRequest extends DebugSidecarEnvelope {
    readonly type: "request";
    readonly command: (typeof DEBUG_SIDECAR_COMMANDS)[number];
    readonly arguments?: Readonly<Record<string, unknown>>;
}
/** Response paired with one client request sequence. */
export interface DebugSidecarResponse extends DebugSidecarEnvelope {
    readonly type: "response";
    readonly requestSequence: number;
    readonly success: boolean;
    readonly result?: unknown;
    readonly error?: string;
}
/** Asynchronous backend event emitted by a native sidecar. */
export interface DebugSidecarEvent extends DebugSidecarEnvelope {
    readonly type: "event";
    readonly event: (typeof DEBUG_SIDECAR_EVENTS)[number];
    readonly body: Readonly<Record<string, unknown>>;
}
/** Any framed sidecar message. */
export type DebugSidecarMessage = DebugSidecarRequest | DebugSidecarResponse | DebugSidecarEvent;
/**
 * Creates a 256-bit base64url token intended for a single spawned sidecar session.
 * @returns {string} An unpredictable token safe for environment or inherited-pipe transfer.
 */
export declare const createDebugSidecarSessionToken: () => string;
/**
 * Rejects weak, malformed, or accidentally logged/display-oriented session identifiers.
 * @param {unknown} value Candidate token.
 * @returns {asserts value is string} Assertion for a valid token.
 */
export declare function assertDebugSidecarSessionToken(value: unknown): asserts value is string;
/**
 * Validates an untrusted decoded message before it reaches a backend implementation.
 * @param {unknown} value Candidate envelope.
 * @param {DebugSidecarProtocolLimits} limits Request and framing limits.
 * @returns {asserts value is DebugSidecarMessage} Assertion for a valid protocol envelope.
 */
export declare function assertDebugSidecarMessage(value: unknown, limits?: DebugSidecarProtocolLimits): asserts value is DebugSidecarMessage;
/**
 * Encodes one validated message as a four-byte big-endian length plus UTF-8 JSON.
 * @param {DebugSidecarMessage} message Authenticated protocol message.
 * @param {DebugSidecarProtocolLimits} limits Framing and request bounds.
 * @returns {Uint8Array} Portable binary frame suitable for stdio or a loopback socket.
 */
export declare const encodeDebugSidecarMessage: (message: DebugSidecarMessage, limits?: DebugSidecarProtocolLimits) => Uint8Array;
/** Incremental decoder with frame bounds and per-connection anti-replay sequence checks. */
export declare class DebugSidecarMessageParser {
    #private;
    /**
     * Creates one directional stream parser.
     * @param {DebugSidecarProtocolLimits} limits Framing and request limits.
     */
    constructor(limits?: DebugSidecarProtocolLimits);
    /**
     * Adds a transport chunk and returns every complete validated message in order.
     * @param {Uint8Array} chunk Next stdio or socket bytes.
     * @returns {DebugSidecarMessage[]} Complete messages decoded from the stream.
     */
    push(chunk: Uint8Array): DebugSidecarMessage[];
}
/** Bounded FIFO for encoded messages; overflow is explicit rather than silently dropping events. */
export declare class DebugSidecarMessageQueue {
    #private;
    /**
     * Creates a bounded outgoing queue.
     * @param {DebugSidecarProtocolLimits} limits Framing and queue limits.
     */
    constructor(limits?: DebugSidecarProtocolLimits);
    /** @returns {number} Number of queued protocol messages. */
    get length(): number;
    /** @returns {number} Encoded bytes currently retained for transport backpressure. */
    get bytes(): number;
    /**
     * Encodes and appends one message, failing the connection when bounds would be exceeded.
     * @param {DebugSidecarMessage} message Next ordered message.
     * @returns {void}
     */
    enqueue(message: DebugSidecarMessage): void;
    /**
     * Removes the oldest encoded frame.
     * @returns {Uint8Array | undefined} Oldest frame or undefined when empty.
     */
    dequeue(): Uint8Array | undefined;
}
//# sourceMappingURL=sidecar-protocol.d.ts.map
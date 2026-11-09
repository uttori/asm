/** Stable identity of the emulator-neutral sidecar wire protocol. */
export declare const DEBUG_SIDECAR_PROTOCOL: "uttori-asm-debug-sidecar";
/** Supported wire revision. Peers reject messages with any other version. */
export declare const DEBUG_SIDECAR_PROTOCOL_VERSION: 1;
/** Commands available across the sidecar boundary. */
export declare const DEBUG_SIDECAR_COMMANDS: readonly ["initialize", "connect", "disconnect", "pause", "continue", "step", "threads", "stackFrames", "registers", "readMemory", "setBreakpoints", "disassemble", "startTrace", "readTrace", "stopTrace", "capture", "ping", "shutdown"];
/** Events available across the sidecar boundary. */
export declare const DEBUG_SIDECAR_EVENTS: readonly ["stopped", "continued", "terminated", "breakpoint", "output"];
/** Protocol limits enforced before emulator-specific code sees a request. */
export interface DebugSidecarProtocolLimits {
    /** JSON payload bytes per frame, excluding its four-byte length prefix. Default 1 MiB. */
    readonly maxFrameBytes: number;
    /** Bytes retained by the incremental parser. Default 2 MiB. */
    readonly maxBufferedBytes: number;
    /** Requested bytes per readMemory command. Default 1 MiB, subject to backend limits. */
    readonly maxMemoryReadBytes: number;
    /** Instructions per disassemble command. Default 4096. */
    readonly maxDisassemblyInstructions: number;
    /** Addresses in one complete breakpoint replacement set. Default 4096. */
    readonly maxBreakpoints: number;
    /** Events per destructive trace pull. Default 4096, subject to negotiated producer limits. */
    readonly maxTraceBatchEvents: number;
    /** Pending requests or outgoing queued messages per connection. Default 1024. */
    readonly maxQueuedMessages: number;
    /** Framed bytes awaiting transport writes. Default 8 MiB. */
    readonly maxQueuedBytes: number;
}
/** Conservative defaults suitable for a local stdio or loopback connection. */
export declare const DEFAULT_DEBUG_SIDECAR_LIMITS: DebugSidecarProtocolLimits;
/** Common authenticated, ordered envelope fields. */
export interface DebugSidecarEnvelope {
    /** Wire protocol identifier shared by every peer. */
    readonly protocol: typeof DEBUG_SIDECAR_PROTOCOL;
    /** Negotiated revision; mismatches fail fast before command dispatch. */
    readonly version: typeof DEBUG_SIDECAR_PROTOCOL_VERSION;
    /** One-session authentication token matching the transport setup. */
    readonly session: string;
    /** Monotonic message sequence used for ordering and response pairing. */
    readonly sequence: number;
}
/** Request sent by the TypeScript backend client to a native sidecar. */
export interface DebugSidecarRequest extends DebugSidecarEnvelope {
    /** Discriminator marking client-to-sidecar commands. */
    readonly type: "request";
    /** Neutral backend operation requested by the TypeScript client. */
    readonly command: (typeof DEBUG_SIDECAR_COMMANDS)[number];
    /** Command-specific payload validated against protocol limits. */
    readonly arguments?: Readonly<Record<string, unknown>>;
}
/** Response paired with one client request sequence. */
export interface DebugSidecarResponse extends DebugSidecarEnvelope {
    /** Discriminator marking command responses. */
    readonly type: "response";
    /** Sequence of the request this response completes. */
    readonly requestSequence: number;
    /** Whether the command succeeded; failures carry error text. */
    readonly success: boolean;
    /** Untrusted success payload for the typed adapter to validate. */
    readonly result?: unknown;
    /** Human-readable failure reason when success is false. */
    readonly error?: string;
}
/** Asynchronous backend event emitted by a native sidecar. */
export interface DebugSidecarEvent extends DebugSidecarEnvelope {
    /** Discriminator marking asynchronous backend events. */
    readonly type: "event";
    /** Asynchronous backend signal name. */
    readonly event: (typeof DEBUG_SIDECAR_EVENTS)[number];
    /** Event payload validated before forwarding to listeners. */
    readonly body: Readonly<Record<string, unknown>>;
}
/** Any framed sidecar message. */
export type DebugSidecarMessage = DebugSidecarRequest | DebugSidecarResponse | DebugSidecarEvent;
/**
 * Creates a 256-bit base64url token intended for a single spawned sidecar session.
 * @returns An unpredictable token safe for environment or inherited-pipe transfer.
 */
export declare const createDebugSidecarSessionToken: () => string;
/**
 * Rejects weak, malformed, or accidentally logged/display-oriented session identifiers.
 * @param value Candidate token.
 * @returns Assertion for a valid token.
 */
export declare function assertDebugSidecarSessionToken(value: unknown): asserts value is string;
/**
 * Validates an untrusted decoded message before it reaches a backend implementation.
 * @param value Candidate envelope.
 * @param limits Request and framing limits.
 * @returns Assertion for a valid protocol envelope.
 */
export declare function assertDebugSidecarMessage(value: unknown, limits?: DebugSidecarProtocolLimits): asserts value is DebugSidecarMessage;
/**
 * Encodes one validated message as a four-byte big-endian length plus UTF-8 JSON.
 * @param message Authenticated protocol message.
 * @param limits Framing and request bounds.
 * @returns Portable binary frame suitable for stdio or a loopback socket.
 */
export declare const encodeDebugSidecarMessage: (message: DebugSidecarMessage, limits?: DebugSidecarProtocolLimits) => Uint8Array;
/** Incremental decoder with frame bounds and per-connection anti-replay sequence checks. */
export declare class DebugSidecarMessageParser {
    #private;
    /**
     * Creates one directional stream parser.
     * @param limits Framing and request limits.
     */
    constructor(limits?: DebugSidecarProtocolLimits);
    /**
     * Adds a transport chunk and returns every complete validated message in order.
     * @param chunk Next stdio or socket bytes.
     * @returns Complete messages decoded from the stream.
     */
    push(chunk: Uint8Array): DebugSidecarMessage[];
}
/** Bounded FIFO for encoded messages. Overflow is explicit rather than silently dropping events. */
export declare class DebugSidecarMessageQueue {
    #private;
    /**
     * Creates a bounded outgoing queue.
     * @param limits Framing and queue limits.
     */
    constructor(limits?: DebugSidecarProtocolLimits);
    /**
     * Number of queued protocol messages.
     * @returns Count of frames waiting for transport write.
     */
    get length(): number;
    /**
     * Encoded bytes currently retained for transport backpressure.
     * @returns Sum of queued frame lengths.
     */
    get bytes(): number;
    /**
     * Encodes and appends one message, failing the connection when bounds would be exceeded.
     * @param message Next ordered message.
     */
    enqueue(message: DebugSidecarMessage): void;
    /**
     * Removes the oldest encoded frame.
     * @returns Oldest frame or undefined when empty.
     */
    dequeue(): Uint8Array | undefined;
}
//# sourceMappingURL=sidecar-protocol.d.ts.map
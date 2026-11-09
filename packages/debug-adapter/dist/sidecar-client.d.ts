import type { DebugSubscription } from "./contracts.js";
import { type DebugSidecarEvent, type DebugSidecarProtocolLimits, type DebugSidecarRequest } from "./sidecar-protocol.js";
/** Byte-stream transport implemented by stdio or a loopback socket host. */
export interface DebugSidecarTransport {
    /** Sends one framed protocol chunk. */
    write(data: Uint8Array): Promise<void>;
    /** Closes the byte stream and stops delivery. */
    close(): Promise<void>;
    /** Subscribes to inbound framed bytes. */
    onData(listener: (data: Uint8Array) => void): DebugSubscription;
    /** Subscribes to terminal transport failure or orderly close. */
    onClose(listener: (error?: Error) => void): DebugSubscription;
}
/** Construction options for one authenticated sidecar connection. */
export interface DebugSidecarClientOptions {
    /** Owned connection. close(), protocol failures, and request timeouts close this transport. */
    readonly transport: DebugSidecarTransport;
    /** Exactly 64 lowercase hexadecimal characters from createDebugSidecarSessionToken(). */
    readonly session: string;
    /** Positive safe integer milliseconds, default 5000. Starts when queued, including write wait. */
    readonly requestTimeoutMs?: number;
    /** Complete limits object, not a partial override. Defaults to DEFAULT_DEBUG_SIDECAR_LIMITS. */
    readonly limits?: DebugSidecarProtocolLimits;
}
/** Ordered request/response client shared by native emulator sidecar implementations. */
export declare class DebugSidecarClient {
    #private;
    /**
     * Starts listening to one already-created transport.
     * @param options Authenticated transport and safety bounds.
     */
    constructor(options: DebugSidecarClientOptions);
    /**
     * Whether the transport can still accept requests.
     * @returns True after terminal failure or explicit close.
     */
    get closed(): boolean;
    /**
     * Subscribes to validated, session-matched events.
     * @param listener Event consumer.
     * @returns Disposable subscription.
     */
    onEvent(listener: (event: DebugSidecarEvent) => void): DebugSubscription;
    /**
     * Subscribes to terminal client failure, including native process crashes and protocol errors.
     * @param listener Failure consumer.
     * @returns Disposable subscription.
     */
    onClose(listener: (error: Error) => void): DebugSubscription;
    /**
     * Sends one bounded command and resolves its paired response. A command error rejects only this
     * request. Timeout, malformed input, or transport failure closes the connection and rejects all
     * pending requests. Queue-limit rejection happens before sending and leaves the connection usable.
     * @param command Neutral sidecar command.
     * @param arguments_ Validated command arguments.
     * @returns Untrusted command result for the typed backend adapter to validate.
     */
    request(command: DebugSidecarRequest["command"], arguments_?: Readonly<Record<string, unknown>>): Promise<unknown>;
    /**
     * Closes the connection and rejects unresolved requests.
     * @returns Completion of the transport close.
     */
    close(): Promise<void>;
}
//# sourceMappingURL=sidecar-client.d.ts.map
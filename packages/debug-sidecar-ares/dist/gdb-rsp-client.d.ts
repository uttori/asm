import type { DebugSubscription } from "@uttori/asm-debug-adapter";
/** Byte transport used by the GDB Remote Serial Protocol client. */
export interface GdbRspTransport {
    /**
     * Writes raw framed bytes in call order.
     * @param data Bytes to send; may be a full packet, an ack, or the interrupt byte.
     * @returns Completion once the bytes are accepted by the transport.
     */
    write(data: Uint8Array): Promise<void>;
    /**
     * Closes the connection. Close listeners still fire.
     * @returns Completion once the transport is closed.
     */
    close(): Promise<void>;
    /**
     * Subscribes to received bytes. Chunk boundaries are arbitrary relative to RSP packets.
     * @param listener Byte consumer; the view may be reused after it returns.
     * @returns Disposable subscription.
     */
    onData(listener: (data: Uint8Array) => void): DebugSubscription;
    /**
     * Subscribes to transport closure.
     * @param listener Receives the failure, or undefined for an orderly close.
     * @returns Disposable subscription.
     */
    onClose(listener: (error?: Error) => void): DebugSubscription;
}
/** Parsed stop notification from an RSP `S` or `T` packet. */
export interface GdbRspStop {
    /** The signal number that caused the stop. */
    readonly signal: number;
    /** The payload of the stop notification. */
    readonly payload: string;
}
/** Bounds and deadlines for one RSP client. */
export interface GdbRspClientOptions {
    /** The transport to use for the RSP client. */
    readonly transport: GdbRspTransport;
    /** The timeout for RSP requests. */
    readonly requestTimeoutMs?: number;
    /** The maximum size of an RSP packet. */
    readonly maxPacketBytes?: number;
    /** The maximum size of the RSP receive buffer. */
    readonly maxBufferedBytes?: number;
}
/** Strict, single-flight RSP client for the private ares control channel. */
export declare class GdbRspClient {
    #private;
    /**
     * Validates bounds and subscribes to the transport. No bytes are sent until `start`.
     * @param options Transport and protocol safety bounds.
     */
    constructor(options: GdbRspClientOptions);
    /** Whether the client has permanently closed after a local close, transport loss, or protocol failure. */
    get closed(): boolean;
    /**
     * Sends the initial `+` acknowledgement. Must be called exactly once before any request.
     * @returns Completion after writing the required initial acknowledgement byte.
     */
    start(): Promise<void>;
    /**
     * Subscribes to asynchronous stop packets.
     * @param listener Stop-event consumer.
     * @returns Disposable subscription.
     */
    onStop(listener: (event: GdbRspStop) => void): DebugSubscription;
    /**
     * Subscribes to terminal RSP transport or protocol failure.
     * @param listener Close-error consumer.
     * @returns Disposable subscription.
     */
    onClose(listener: (error: Error) => void): DebugSubscription;
    /**
     * Sends one packet and waits for its non-stop response.
     * @param command RSP command payload.
     * @returns Response payload.
     */
    request(command: string): Promise<string>;
    /**
     * Sends a handshake packet such as `?` whose response is itself a stop packet.
     * @param command RSP command payload.
     * @returns Stop response payload.
     */
    requestStop(command: string): Promise<string>;
    /**
     * Sends `c`. The eventual stop arrives through `onStop`, not as a response.
     * @returns Completion after writing continue.
     */
    continue(): Promise<void>;
    /**
     * Sends `s`. The resulting stop arrives through `onStop`, not as a response.
     * @returns Completion after writing one-instruction step.
     */
    step(): Promise<void>;
    /**
     * Sends raw `0x03` to halt a running target. Rejected while a request is pending.
     * @returns Completion after writing the out-of-band interrupt byte.
     */
    interrupt(): Promise<void>;
    /**
     * Closes the transport and rejects any in-flight request.
     * @returns Completion after closing the transport.
     */
    close(): Promise<void>;
}
//# sourceMappingURL=gdb-rsp-client.d.ts.map
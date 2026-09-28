import type { DebugSubscription } from "@uttori/asm-debug-adapter";
/** Byte transport used by the GDB Remote Serial Protocol client. */
export interface GdbRspTransport {
    write(data: Uint8Array): Promise<void>;
    close(): Promise<void>;
    onData(listener: (data: Uint8Array) => void): DebugSubscription;
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
    /** @param {GdbRspClientOptions} options Transport and protocol safety bounds. */
    constructor(options: GdbRspClientOptions);
    /** @returns {boolean} Whether the client has permanently closed. */
    get closed(): boolean;
    /** @returns {Promise<void>} Completion after writing the required initial acknowledgement byte. */
    start(): Promise<void>;
    /**
     * Subscribes to asynchronous stop packets.
     * @param {(event: GdbRspStop) => void} listener Stop-event consumer.
     * @returns {DebugSubscription} Disposable subscription.
     */
    onStop(listener: (event: GdbRspStop) => void): DebugSubscription;
    /**
     * Subscribes to terminal RSP transport or protocol failure.
     * @param {(error: Error) => void} listener Close-error consumer.
     * @returns {DebugSubscription} Disposable subscription.
     */
    onClose(listener: (error: Error) => void): DebugSubscription;
    /**
     * Sends one packet and waits for its non-stop response.
     * @param {string} command RSP command payload.
     * @returns {Promise<string>} Response payload.
     */
    request(command: string): Promise<string>;
    /**
     * Sends a handshake packet such as `?` whose response is itself a stop packet.
     * @param {string} command RSP command payload.
     * @returns {Promise<string>} Stop response payload.
     */
    requestStop(command: string): Promise<string>;
    /** @returns {Promise<void>} Completion after writing continue. */
    continue(): Promise<void>;
    /** @returns {Promise<void>} Completion after writing one-instruction step. */
    step(): Promise<void>;
    /** @returns {Promise<void>} Completion after writing the out-of-band interrupt byte. */
    interrupt(): Promise<void>;
    /** @returns {Promise<void>} Completion after closing the transport. */
    close(): Promise<void>;
}
//# sourceMappingURL=gdb-rsp-client.d.ts.map
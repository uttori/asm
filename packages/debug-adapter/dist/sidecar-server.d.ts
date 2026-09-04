import { type DebugBackend } from "./contracts.js";
import { type DebugSidecarProtocolLimits } from "./sidecar-protocol.js";
/** Construction options for one authenticated sidecar server connection. */
export interface DebugSidecarServerOptions {
    readonly backend: string;
    readonly implementation: DebugBackend;
    readonly session: string;
    readonly write: (data: Uint8Array) => Promise<void>;
    readonly close?: (error?: Error) => Promise<void>;
    readonly limits?: DebugSidecarProtocolLimits;
}
/** Authenticated, ordered server that exposes any `DebugBackend` over the neutral wire protocol. */
export declare class DebugSidecarServer {
    #private;
    /**
     * Creates a server around an emulator-neutral backend implementation.
     * @param {DebugSidecarServerOptions} options Identity, backend, transport, and safety bounds.
     */
    constructor(options: DebugSidecarServerOptions);
    /** @returns {boolean} Whether the server has permanently closed. */
    get closed(): boolean;
    /**
     * Accepts the next transport chunk. Calls are serialized even when the stream producer overlaps them.
     * @param {Uint8Array} data Framed protocol bytes from the client.
     * @returns {Promise<void>} Completion after every request in this chunk has been dispatched.
     */
    receive(data: Uint8Array): Promise<void>;
    /**
     * Flushes queued output and closes the server transport exactly once.
     * @param {Error} error Optional terminal protocol or transport failure.
     * @returns {Promise<void>} Completion of transport cleanup.
     */
    close(error?: Error): Promise<void>;
}
//# sourceMappingURL=sidecar-server.d.ts.map
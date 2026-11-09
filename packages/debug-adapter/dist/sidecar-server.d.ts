import { type DebugBackend } from "./contracts.js";
import { type DebugSidecarProtocolLimits } from "./sidecar-protocol.js";
/** Construction options for one authenticated sidecar server connection. */
export interface DebugSidecarServerOptions {
    /** Backend identifier echoed in initialize responses. */
    readonly backend: string;
    /** DebugBackend implementation served over the wire. */
    readonly implementation: DebugBackend;
    /** Session token that must match every inbound frame. */
    readonly session: string;
    /** Sends framed outbound bytes to the connected client. */
    readonly write: (data: Uint8Array) => Promise<void>;
    /** Optional transport teardown hook invoked on terminal failure. */
    readonly close?: (error?: Error) => Promise<void>;
    /** Framing and request limits enforced before dispatch. */
    readonly limits?: DebugSidecarProtocolLimits;
}
/** Authenticated, ordered server that exposes any `DebugBackend` over the neutral wire protocol. */
export declare class DebugSidecarServer {
    #private;
    /**
     * Creates a server around an emulator-neutral backend implementation.
     * @param options Identity, backend, transport, and safety bounds.
     */
    constructor(options: DebugSidecarServerOptions);
    /**
     * Whether the server has permanently closed.
     * @returns True after shutdown or terminal protocol failure.
     */
    get closed(): boolean;
    /**
     * Accepts the next transport chunk. Calls are serialized even when the stream producer overlaps them.
     * @param data Framed protocol bytes from the client.
     * @returns Completion after every request in this chunk has been dispatched.
     */
    receive(data: Uint8Array): Promise<void>;
    /**
     * Flushes queued output and closes the server transport exactly once.
     * @param error Optional terminal protocol or transport failure.
     * @returns Completion of transport cleanup.
     */
    close(error?: Error): Promise<void>;
}
//# sourceMappingURL=sidecar-server.d.ts.map
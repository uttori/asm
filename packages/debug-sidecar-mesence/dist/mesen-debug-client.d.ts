import type { DebugSubscription } from "@uttori/asm-debug-adapter";
import { type MesenDebugClient } from "./mesen-backend.js";
/** Byte transport for the private native MesenCE control channel. */
export interface MesenDebugTransport {
    write(data: Uint8Array): Promise<void>;
    close(): Promise<void>;
    onData(listener: (data: Uint8Array) => void): DebugSubscription;
    onClose(listener: (error?: Error) => void): DebugSubscription;
}
/** Authentication, transport, and queue bounds for one native protocol client. */
export interface FramedMesenDebugClientOptions {
    readonly transport: MesenDebugTransport;
    readonly token: string;
    readonly requestTimeoutMs?: number;
    readonly maxRequestBytes?: number;
    readonly maxResponseBytes?: number;
    readonly maxQueuedRequests?: number;
    readonly maxQueuedBytes?: number;
}
/** Bounded, authenticated, sequential client for the patched MesenCE debugger. */
export declare class FramedMesenDebugClient implements MesenDebugClient {
    #private;
    /** @param {FramedMesenDebugClientOptions} options Transport, one-session token, and bounds. */
    constructor(options: FramedMesenDebugClientOptions);
    /** @returns {boolean} Whether this client has permanently closed. */
    get closed(): boolean;
    /** @inheritdoc */
    request(method: string, parameters?: Readonly<Record<string, unknown>>): Promise<unknown>;
    /** @inheritdoc */
    onClose(listener: (error?: Error) => void): DebugSubscription;
    /** @inheritdoc */
    close(): Promise<void>;
}
//# sourceMappingURL=mesen-debug-client.d.ts.map
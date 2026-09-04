import type { DebugSubscription } from "@uttori/asm-debug-adapter";
import type { MesenDebugTransport } from "./mesen-debug-client.js";
/** Options for the private numeric-loopback MesenCE debugger connection. */
export interface NodeTcpMesenTransportOptions {
    readonly host?: "127.0.0.1" | "::1";
    readonly port: number;
    readonly connectTimeoutMs?: number;
    readonly shutdownTimeoutMs?: number;
}
/** Node TCP transport restricted to the sidecar-owned native MesenCE endpoint. */
export declare class NodeTcpMesenTransport implements MesenDebugTransport {
    #private;
    private constructor();
    /**
     * Opens a bounded connection to a numeric loopback address.
     * @param {NodeTcpMesenTransportOptions} options Loopback endpoint and deadlines.
     * @returns {Promise<NodeTcpMesenTransport>} Connected transport.
     */
    static connect(options: NodeTcpMesenTransportOptions): Promise<NodeTcpMesenTransport>;
    /** @inheritdoc */
    write(data: Uint8Array): Promise<void>;
    /** @inheritdoc */
    onData(listener: (data: Uint8Array) => void): DebugSubscription;
    /** @inheritdoc */
    onClose(listener: (error?: Error) => void): DebugSubscription;
    /** @inheritdoc */
    close(): Promise<void>;
}
//# sourceMappingURL=node-tcp-mesen-transport.d.ts.map
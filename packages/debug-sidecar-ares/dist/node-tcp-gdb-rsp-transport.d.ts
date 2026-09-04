import type { DebugSubscription } from "@uttori/asm-debug-adapter";
import type { GdbRspTransport } from "./gdb-rsp-client.js";
/** Options for a private numeric-loopback RSP connection. */
export interface NodeTcpGdbRspTransportOptions {
    readonly host?: "127.0.0.1" | "::1";
    readonly port: number;
    readonly connectTimeoutMs?: number;
    readonly shutdownTimeoutMs?: number;
}
/** Node TCP transport restricted to the sidecar-owned loopback GDB endpoint. */
export declare class NodeTcpGdbRspTransport implements GdbRspTransport {
    #private;
    private constructor();
    /**
     * Opens a bounded connection to a numeric loopback address.
     * @param {NodeTcpGdbRspTransportOptions} options Loopback endpoint and deadlines.
     * @returns {Promise<NodeTcpGdbRspTransport>} Connected transport.
     */
    static connect(options: NodeTcpGdbRspTransportOptions): Promise<NodeTcpGdbRspTransport>;
    /** @inheritdoc */
    write(data: Uint8Array): Promise<void>;
    /** @inheritdoc */
    onData(listener: (data: Uint8Array) => void): DebugSubscription;
    /** @inheritdoc */
    onClose(listener: (error?: Error) => void): DebugSubscription;
    /** @inheritdoc */
    close(): Promise<void>;
}
//# sourceMappingURL=node-tcp-gdb-rsp-transport.d.ts.map
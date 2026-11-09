import type { DebugSubscription } from "@uttori/asm-debug-adapter";
import type { GdbRspTransport } from "./gdb-rsp-client.js";
/** Options for a private numeric-loopback RSP connection. */
export interface NodeTcpGdbRspTransportOptions {
    /** Connected only for numeric loopback; any other host is rejected. */
    readonly host?: string;
    /** Loopback TCP port owned by the sidecar GDB stub. */
    readonly port: number;
    /** Positive milliseconds to wait for the initial TCP connect. */
    readonly connectTimeoutMs?: number;
    /** Positive milliseconds to wait for graceful socket shutdown. */
    readonly shutdownTimeoutMs?: number;
}
/** Node TCP transport restricted to the sidecar-owned loopback GDB endpoint. */
export declare class NodeTcpGdbRspTransport implements GdbRspTransport {
    #private;
    private constructor();
    /**
     * Opens a bounded connection to a numeric loopback address.
     * @param options Loopback endpoint and deadlines.
     * @returns Connected transport.
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
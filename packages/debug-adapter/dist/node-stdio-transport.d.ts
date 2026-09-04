import type { DebugSubscription } from "./contracts.js";
import type { DebugSidecarTransport } from "./sidecar-client.js";
/** Environment variable inherited by a native sidecar instead of exposing its token in argv. */
export declare const DEBUG_SIDECAR_SESSION_ENV: "UTTORI_ASM_DEBUG_SESSION";
/** Process-launch settings for one local, inherited-stdio sidecar. */
export interface NodeStdioSidecarTransportOptions {
    readonly command: string;
    readonly args?: readonly string[];
    readonly cwd?: string;
    readonly env?: Readonly<Record<string, string | undefined>>;
    readonly session: string;
    readonly shutdownTimeoutMs?: number;
    readonly maxStderrBytes?: number;
    readonly onStderr?: (text: string) => void;
}
/** Restartable Node transport that isolates native emulator failures from the extension host. */
export declare class NodeStdioSidecarTransport implements DebugSidecarTransport {
    #private;
    /**
     * Spawns one sidecar without a shell and authenticates it through inherited environment state.
     * @param {NodeStdioSidecarTransportOptions} options Explicit executable and lifecycle bounds.
     */
    constructor(options: NodeStdioSidecarTransportOptions);
    /** @returns {number | undefined} Native child PID when process creation succeeded. */
    get pid(): number | undefined;
    /** @returns {string} Bounded, token-redacted tail of native stderr. */
    get stderr(): string;
    /**
     * Writes one complete or partial frame, resolving only after Node flushes it from its buffer.
     * @param {Uint8Array} data Framed protocol bytes.
     * @returns {Promise<void>} Completion of the native pipe write.
     */
    write(data: Uint8Array): Promise<void>;
    /**
     * Ends stdin and escalates from SIGTERM to SIGKILL only when the child misses bounded deadlines.
     * @returns {Promise<void>} Completion of child-process cleanup.
     */
    close(): Promise<void>;
    /** @inheritdoc */
    onData(listener: (data: Uint8Array) => void): DebugSubscription;
    /** @inheritdoc */
    onClose(listener: (error?: Error) => void): DebugSubscription;
}
//# sourceMappingURL=node-stdio-transport.d.ts.map
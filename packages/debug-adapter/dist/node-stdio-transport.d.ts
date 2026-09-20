import type { DebugSubscription } from "./contracts.js";
import type { DebugSidecarTransport } from "./sidecar-client.js";
/** Environment variable inherited by a native sidecar instead of exposing its token in argv. */
export declare const DEBUG_SIDECAR_SESSION_ENV: "UTTORI_ASM_DEBUG_SESSION";
/** Process-launch settings for one local, inherited-stdio sidecar. */
export interface NodeStdioSidecarTransportOptions {
    /** Executable path or name resolved by spawn. Arguments are never interpreted by a shell. */
    readonly command: string;
    readonly args?: readonly string[];
    readonly cwd?: string;
    /** Overrides inherited process.env. The session token below always takes precedence. */
    readonly env?: Readonly<Record<string, string | undefined>>;
    readonly session: string;
    /** Positive milliseconds per graceful-close and SIGTERM wait, default 1000. */
    readonly shutdownTimeoutMs?: number;
    /** Positive byte limit for the retained stderr tail, default 65536. */
    readonly maxStderrBytes?: number;
    /** Receives token-redacted chunks synchronously. The callback must not throw. */
    readonly onStderr?: (text: string) => void;
}
/** Owns one child process. Create a new instance to restart after close or process failure. */
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
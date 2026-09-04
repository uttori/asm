import { type DebugBackendConnectOptions } from "@uttori/asm-debug-adapter";
import { GdbRspClient, type GdbRspTransport } from "./gdb-rsp-client.js";
export declare const ARES_RUNTIME_MANIFEST_VERSION: 1;
/** One separately distributed runtime resource resolved relative to the portable runtime root. */
export interface AresRuntimeResource {
    readonly path: string;
    readonly sha256: string;
}
/** Versioned identity required before a native ares process may be launched. */
export interface AresRuntimeManifest {
    readonly schemaVersion: typeof ARES_RUNTIME_MANIFEST_VERSION;
    readonly emulator: "ares";
    readonly upstreamRevision: string;
    readonly headlessBaseRevision: string;
    readonly forkRevision: string;
    readonly headlessPatchSha256: string;
    readonly patchSha256: string;
    readonly executableSha256: string;
    readonly romSha256: string;
    readonly platform: NodeJS.Platform;
    readonly architecture: string;
    readonly buildConfiguration: string;
    readonly resources: readonly AresRuntimeResource[];
}
/** Spawn parameters kept independent from Node so lifecycle policy can be tested deterministically. */
export interface AresProcessLaunch {
    readonly command: string;
    readonly args: readonly string[];
    readonly cwd: string;
    readonly env: Readonly<Record<string, string | undefined>>;
    readonly onOutput: (stream: "stdout" | "stderr", data: Uint8Array) => void;
}
/** Terminal status of one sidecar-owned ares process. */
export interface AresProcessExit {
    readonly code: number | null;
    readonly signal: NodeJS.Signals | null;
    readonly error?: Error;
}
/** Minimal native process surface used by the portable host policy. */
export interface AresProcessHandle {
    readonly pid: number | undefined;
    readonly exited: boolean;
    waitForExit(): Promise<AresProcessExit>;
    kill(signal: "SIGTERM" | "SIGKILL"): void;
}
/** Platform operations injected for deterministic tests and future non-Node native hosts. */
export interface AresProcessRuntime {
    readonly platform: NodeJS.Platform;
    readonly architecture: string;
    sha256(file: string): Promise<string>;
    reserveLoopbackPort(): Promise<number>;
    launch(options: AresProcessLaunch): AresProcessHandle;
    connect(port: number, timeoutMs: number): Promise<GdbRspTransport>;
    delay(milliseconds: number): Promise<void>;
}
/** Configuration for one restartable, manifest-verified ares process. */
export interface AresProcessHostOptions {
    readonly executable: string;
    readonly rom: string;
    readonly runtimeDirectory: string;
    readonly manifest: AresRuntimeManifest;
    readonly system?: string;
    readonly fastBoot?: boolean;
    readonly env?: Readonly<Record<string, string | undefined>>;
    readonly startupTimeoutMs?: number;
    readonly requestTimeoutMs?: number;
    readonly shutdownTimeoutMs?: number;
    readonly connectRetryMs?: number;
    readonly maxOutputBytes?: number;
    readonly onOutput?: (stream: "stdout" | "stderr", text: string) => void;
    readonly runtime?: AresProcessRuntime;
}
/** Default Node platform operations; the RSP listener itself remains numeric-loopback-only. */
export declare const nodeAresProcessRuntime: Readonly<AresProcessRuntime>;
/**
 * Parses and freezes an untrusted versioned ares runtime manifest.
 * @param {unknown} value Parsed JSON-like value.
 * @returns {AresRuntimeManifest} Validated immutable runtime identity.
 */
export declare const parseAresRuntimeManifest: (value: unknown) => AresRuntimeManifest;
/** Owns one verified ares process and creates private RSP clients for a neutral backend. */
export declare class AresProcessHost {
    #private;
    /** @param {AresProcessHostOptions} options Paths, manifest, bounds, and platform runtime. */
    constructor(options: AresProcessHostOptions);
    /** @returns {AresRuntimeManifest} Normalized immutable launch identity. */
    get manifest(): AresRuntimeManifest;
    /** @returns {number | undefined} PID of the current emulator process. */
    get pid(): number | undefined;
    /** @returns {string} Bounded tail of emulator stdout and stderr, never protocol stdout. */
    get output(): string;
    /**
     * Starts a fresh verified emulator for reset connects or reconnects to the preserved process.
     * @param {DebugBackendConnectOptions} options Backend reset policy.
     * @returns {Promise<GdbRspClient>} Connected, not-yet-started private RSP client.
     */
    createClient(options: DebugBackendConnectOptions): Promise<GdbRspClient>;
    /** @returns {Promise<void>} Bounded graceful/forced cleanup of the owned emulator process. */
    terminate(): Promise<void>;
}
//# sourceMappingURL=ares-process-host.d.ts.map
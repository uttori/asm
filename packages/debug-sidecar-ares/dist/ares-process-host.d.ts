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
    /** Omitted by legacy manifests, which launch the headless frontend. */
    readonly frontend?: "headless" | "desktop";
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
    /** Absolute path to the executable whose hash is pinned by the manifest. */
    readonly executable: string;
    /** Absolute ROM file path. The manifest hashes the entire file, including any copier header. */
    readonly rom: string;
    /** Absolute working directory containing the declared runtime resources. */
    /** Platform operations override, primarily for process-host tests. */
    readonly runtimeDirectory: string;
    /** Validated identity for this executable, ROM, platform, and native protocol. */
    readonly manifest: AresRuntimeManifest;
    /** Emulator system name. Defaults to Super Famicom. */
    readonly system?: string;
    /** Skip the emulator boot sequence when supported. Defaults to true. */
    readonly fastBoot?: boolean;
    /** Child environment overrides. Inherited values are used unless overridden. */
    readonly env?: Readonly<Record<string, string | undefined>>;
    /** Positive integer startup deadline in milliseconds. Defaults to 10,000. */
    readonly startupTimeoutMs?: number;
    /** Positive integer native request deadline in milliseconds. Defaults to 3,000. */
    readonly requestTimeoutMs?: number;
    /** Positive integer wait after SIGTERM in milliseconds, before SIGKILL. Defaults to 2,000. */
    readonly shutdownTimeoutMs?: number;
    /** Positive integer delay between startup connection attempts in milliseconds. Defaults to 25. */
    readonly connectRetryMs?: number;
    /** Positive integer retained stdout/stderr tail size in bytes. Defaults to 65,536. */
    readonly maxOutputBytes?: number;
    /** Synchronous output observer. Must not throw. */
    readonly onOutput?: (stream: "stdout" | "stderr", text: string) => void;
    readonly runtime?: AresProcessRuntime;
}
/** Default Node platform operations. The RSP listener itself remains numeric-loopback-only. */
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
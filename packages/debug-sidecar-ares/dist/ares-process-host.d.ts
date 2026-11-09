import { type DebugBackendConnectOptions } from "@uttori/asm-debug-adapter";
import { GdbRspClient, type GdbRspTransport } from "./gdb-rsp-client.js";
/** Only ares runtime manifest schema version accepted by `parseAresRuntimeManifest`. */
export declare const ARES_RUNTIME_MANIFEST_VERSION: 1;
/** One separately distributed runtime resource resolved relative to the portable runtime root. */
export interface AresRuntimeResource {
    /** Normalized POSIX path relative to the runtime directory; never absolute and never contains `..`. */
    readonly path: string;
    /** Lowercase hex SHA-256 of the resource file contents. */
    readonly sha256: string;
}
/** Versioned identity required before a native ares process may be launched. */
export interface AresRuntimeManifest {
    /** Manifest schema version; must equal `ARES_RUNTIME_MANIFEST_VERSION`. */
    readonly schemaVersion: typeof ARES_RUNTIME_MANIFEST_VERSION;
    /** Emulator family discriminator; always `ares`. */
    readonly emulator: "ares";
    /** Omitted by legacy manifests, which launch the headless frontend. */
    readonly frontend?: "headless" | "desktop";
    /** Lowercase 40-digit upstream ares git revision the fork is based on. */
    readonly upstreamRevision: string;
    /** Lowercase 40-digit revision the headless frontend patch was applied to. */
    readonly headlessBaseRevision: string;
    /** Lowercase 40-digit revision of the built fork checkout. */
    readonly forkRevision: string;
    /** Lowercase hex SHA-256 of the headless frontend patch. */
    readonly headlessPatchSha256: string;
    /** Lowercase hex SHA-256 of the debugger protocol patch. */
    readonly patchSha256: string;
    /** Lowercase hex SHA-256 the executable must match before every launch. */
    readonly executableSha256: string;
    /** Lowercase hex SHA-256 of the entire ROM file, including any copier header. */
    readonly romSha256: string;
    /** Node platform the executable was built for; must equal the host platform. */
    readonly platform: NodeJS.Platform;
    /** Node architecture the executable was built for; must equal the host architecture. */
    readonly architecture: string;
    /** Non-empty build configuration label, such as a compiler profile. */
    readonly buildConfiguration: string;
    /** Additional files verified by hash before launch; paths are unique. */
    readonly resources: readonly AresRuntimeResource[];
}
/** Spawn parameters kept independent from Node so lifecycle policy can be tested deterministically. */
export interface AresProcessLaunch {
    /** Absolute executable path, spawned without a shell. */
    readonly command: string;
    /** Argument vector passed verbatim to the executable. */
    readonly args: readonly string[];
    /** Absolute working directory for the child. */
    readonly cwd: string;
    /** Overrides merged over the inherited environment; `undefined` removes an inherited value. */
    readonly env: Readonly<Record<string, string | undefined>>;
    /** Receives raw child stdout/stderr chunks as they arrive. */
    readonly onOutput: (stream: "stdout" | "stderr", data: Uint8Array) => void;
}
/** Terminal status of one sidecar-owned ares process. */
export interface AresProcessExit {
    /** Exit code, or null when the process ended by signal or failed to spawn. */
    readonly code: number | null;
    /** Terminating signal, or null for a normal exit. */
    readonly signal: NodeJS.Signals | null;
    /** Spawn or process error observed before close, when any. */
    readonly error?: Error;
}
/** Minimal native process surface used by the portable host policy. */
export interface AresProcessHandle {
    /** OS process id, or undefined when spawning failed. */
    readonly pid: number | undefined;
    /** True once the process has closed; never returns to false. */
    readonly exited: boolean;
    /**
     * Waits for process close.
     * @returns The same settled exit status on every call.
     */
    waitForExit(): Promise<AresProcessExit>;
    /**
     * Sends a signal to a running process. No-op after exit.
     * @param signal Graceful `SIGTERM` or forced `SIGKILL`.
     */
    kill(signal: "SIGTERM" | "SIGKILL"): void;
}
/** Platform operations injected for deterministic tests and future non-Node native hosts. */
export interface AresProcessRuntime {
    /** Host platform compared against the manifest before launch. */
    readonly platform: NodeJS.Platform;
    /** Host architecture compared against the manifest before launch. */
    readonly architecture: string;
    /**
     * Hashes a file's full contents.
     * @param file Absolute file path.
     * @returns Hex SHA-256 digest.
     */
    sha256(file: string): Promise<string>;
    /**
     * Picks a currently free IPv4 loopback TCP port. The port is released before return, so it is advisory.
     * @returns Port number on 127.0.0.1.
     */
    reserveLoopbackPort(): Promise<number>;
    /**
     * Spawns the emulator process.
     * @param options Command, arguments, environment, and output sink.
     * @returns Handle owning the spawned process.
     */
    launch(options: AresProcessLaunch): AresProcessHandle;
    /**
     * Opens one RSP connection attempt to the loopback listener.
     * @param port Loopback port the emulator was told to listen on.
     * @param timeoutMs Positive connection deadline in milliseconds.
     * @returns Connected transport; rejects when the listener is not ready.
     */
    connect(port: number, timeoutMs: number): Promise<GdbRspTransport>;
    /**
     * Waits without keeping the event loop alive.
     * @param milliseconds Delay in milliseconds.
     */
    delay(milliseconds: number): Promise<void>;
}
/** Configuration for one restartable, manifest-verified ares process. */
export interface AresProcessHostOptions {
    /** Absolute path to the executable whose hash is pinned by the manifest. */
    readonly executable: string;
    /** Absolute ROM file path. The manifest hashes the entire file, including any copier header. */
    readonly rom: string;
    /** Absolute working directory containing the declared runtime resources. */
    readonly runtimeDirectory: string;
    /** Absolute persistent SRAM/state root, independent of runtime builds. Omitted preserves existing frontend defaults. */
    readonly saveDirectory?: string;
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
    /** Platform operations. Defaults to `nodeAresProcessRuntime`. */
    readonly runtime?: AresProcessRuntime;
}
/** Default Node platform operations. The RSP listener itself remains numeric-loopback-only. */
export declare const nodeAresProcessRuntime: Readonly<AresProcessRuntime>;
/**
 * Parses and freezes an untrusted versioned ares runtime manifest.
 * @param value Parsed JSON-like value.
 * @returns Validated immutable runtime identity.
 */
export declare const parseAresRuntimeManifest: (value: unknown) => AresRuntimeManifest;
/** Owns one verified ares process and creates private RSP clients for a neutral backend. */
export declare class AresProcessHost {
    #private;
    /**
     * Validates paths, manifest, and bounds without launching or hashing anything.
     * @param options Paths, manifest, bounds, and platform runtime.
     */
    constructor(options: AresProcessHostOptions);
    /**
     * Manifest parsed at construction.
     * @returns Normalized immutable launch identity.
     */
    get manifest(): AresRuntimeManifest;
    /**
     * Process id of the owned emulator.
     * @returns PID of the current emulator process, or undefined when none is running.
     */
    get pid(): number | undefined;
    /**
     * Stream-tagged output captured since the latest launch, truncated to `maxOutputBytes`.
     * @returns Bounded tail of emulator stdout and stderr, never protocol stdout.
     */
    get output(): string;
    /**
     * Starts a fresh verified emulator for reset connects or reconnects to the preserved process.
     * @param options Backend reset policy.
     * @returns Connected, not-yet-started private RSP client.
     */
    createClient(options: DebugBackendConnectOptions): Promise<GdbRspClient>;
    /**
     * Sends SIGTERM, then SIGKILL after `shutdownTimeoutMs`. Serialized with `createClient`.
     * @returns Bounded graceful/forced cleanup of the owned emulator process.
     */
    terminate(): Promise<void>;
}
//# sourceMappingURL=ares-process-host.d.ts.map
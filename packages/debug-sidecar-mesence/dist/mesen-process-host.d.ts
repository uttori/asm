import { type DebugBackendConnectOptions } from "@uttori/asm-debug-adapter";
import { FramedMesenDebugClient, type MesenDebugTransport } from "./mesen-debug-client.js";
export declare const MESEN_RUNTIME_MANIFEST_VERSION: 1;
export declare const MESEN_NATIVE_TOKEN_ENV: "MESEN_DEBUG_SERVER_TOKEN";
/** One separately distributed runtime resource resolved beside the Mesen executable. */
export interface MesenRuntimeResource {
    readonly path: string;
    readonly sha256: string;
}
/** Versioned source, patch, binary, and ROM identity required before launch. */
export interface MesenRuntimeManifest {
    readonly schemaVersion: typeof MESEN_RUNTIME_MANIFEST_VERSION;
    readonly emulator: "MesenCE";
    readonly upstreamRevision: string;
    readonly patchSha256: string;
    readonly executableSha256: string;
    readonly romSha256: string;
    readonly platform: NodeJS.Platform;
    readonly architecture: string;
    readonly buildConfiguration: string;
    readonly resources: readonly MesenRuntimeResource[];
}
/** Spawn parameters kept independent from Node for deterministic lifecycle tests. */
export interface MesenProcessLaunch {
    readonly command: string;
    readonly args: readonly string[];
    readonly cwd: string;
    readonly env: Readonly<Record<string, string | undefined>>;
    readonly onOutput: (stream: "stdout" | "stderr", data: Uint8Array) => void;
}
/** Terminal state for one sidecar-owned MesenCE process. */
export interface MesenProcessExit {
    readonly code: number | null;
    readonly signal: NodeJS.Signals | null;
    readonly error?: Error;
}
/** Minimal native process surface used by the portable host policy. */
export interface MesenProcessHandle {
    readonly pid: number | undefined;
    readonly exited: boolean;
    waitForExit(): Promise<MesenProcessExit>;
    kill(signal: "SIGTERM" | "SIGKILL"): void;
}
/** Platform operations injected for deterministic tests and non-Node hosts. */
export interface MesenProcessRuntime {
    readonly platform: NodeJS.Platform;
    readonly architecture: string;
    sha256(file: string): Promise<string>;
    randomToken(): string;
    reserveLoopbackPort(): Promise<number>;
    launch(options: MesenProcessLaunch): MesenProcessHandle;
    connect(port: number, timeoutMs: number): Promise<MesenDebugTransport>;
    delay(milliseconds: number): Promise<void>;
}
/** Configuration for one restartable manifest-verified MesenCE process. */
export interface MesenProcessHostOptions {
    readonly executable: string;
    readonly rom: string;
    readonly runtimeDirectory: string;
    readonly manifest: MesenRuntimeManifest;
    readonly env?: Readonly<Record<string, string | undefined>>;
    readonly startupTimeoutMs?: number;
    readonly requestTimeoutMs?: number;
    readonly shutdownTimeoutMs?: number;
    readonly connectRetryMs?: number;
    readonly nativeLifetimeSeconds?: number;
    readonly maxOutputBytes?: number;
    readonly onOutput?: (stream: "stdout" | "stderr", text: string) => void;
    readonly runtime?: MesenProcessRuntime;
}
/** Default Node platform operations for the sidecar-owned MesenCE process. */
export declare const nodeMesenProcessRuntime: Readonly<MesenProcessRuntime>;
/**
 * Parses and freezes an untrusted versioned MesenCE runtime manifest.
 * @param {unknown} value Parsed JSON-like value.
 * @returns {MesenRuntimeManifest} Validated immutable runtime identity.
 */
export declare const parseMesenRuntimeManifest: (value: unknown) => MesenRuntimeManifest;
/** Owns one verified portable MesenCE process and creates private framed clients. */
export declare class MesenProcessHost {
    #private;
    /** @param {MesenProcessHostOptions} options Paths, identity, bounds, and platform runtime. */
    constructor(options: MesenProcessHostOptions);
    /** @returns {MesenRuntimeManifest} Normalized immutable launch identity. */
    get manifest(): MesenRuntimeManifest;
    /** @returns {number | undefined} PID of the current emulator process. */
    get pid(): number | undefined;
    /** @returns {string} Bounded tail of emulator output, never neutral-protocol stdout. */
    get output(): string;
    /**
     * Starts a verified process for reset connects or reconnects to the preserved process.
     * @param {DebugBackendConnectOptions} options Backend reset policy.
     * @returns {Promise<FramedMesenDebugClient>} Connected private native-protocol client.
     */
    createClient(options: DebugBackendConnectOptions): Promise<FramedMesenDebugClient>;
    /** @returns {Promise<void>} Bounded graceful/forced cleanup of the owned process. */
    terminate(): Promise<void>;
}
//# sourceMappingURL=mesen-process-host.d.ts.map
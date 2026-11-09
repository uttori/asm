import type { AssemblerPlugin } from "@uttori/asm-core/plugin";
import { type LoadProjectEnvironmentOptions, type LoadedProjectEnvironment } from "@uttori/asm-plugin-loader-node";
import { type AssemblyBuildOperation, type AssemblyBuildResult } from "./build-contracts.js";
export * from "./build-contracts.js";
/** Hosts own plugin composition and exact executable identities. No environment survives one operation. */
export interface AssemblyBuildHost {
    /**
     * Load a frozen project environment from disk configuration.
     * @param options Loader inputs including cwd, config file, and bundled plugins.
     * @returns Activated environment disposed by the caller after use.
     */
    readonly loadEnvironment: (options: LoadProjectEnvironmentOptions) => Promise<LoadedProjectEnvironment>;
    /**
     * Hash the toolchain identity for linked-build receipts.
     * @param plugins Resolved plugin module paths for the build.
     * @returns SHA-256 fingerprint object.
     */
    readonly fingerprint: (plugins: readonly string[]) => {
        readonly sha256: string;
    };
}
/** Compose built-ins at an executable boundary; configured plugins still use the ordinary API/version checks. */
export declare function createAssemblyBuildHost(plugins?: Iterable<readonly [string, AssemblerPlugin]>): AssemblyBuildHost;
/** Cancellation and live editor checks stay local instead of crossing IPC as callbacks. */
export interface AssemblyBuildControls {
    /** Cooperative cancellation forwarded to assembly and link steps. */
    readonly signal?: AbortSignal;
    /** Optional human-readable progress hook for long builds. */
    readonly onProgress?: (message: string) => void;
    /** Called after validation and before any artifact is selected. Reject if saved inputs/editor versions changed. */
    readonly beforePublish?: (paths: readonly string[]) => void | Promise<void>;
}
/**
 * Execute explicit object/library/link/composed operations for CLI and editor workers. Link reads only
 * serialized inputs; build-linked additionally assembles ordered modules. Nothing publishes on a failed check.
 */
export declare function executeAssemblyBuildOperation(value: AssemblyBuildOperation, controls?: AssemblyBuildControls, host?: AssemblyBuildHost): Promise<AssemblyBuildResult>;
//# sourceMappingURL=build.d.ts.map
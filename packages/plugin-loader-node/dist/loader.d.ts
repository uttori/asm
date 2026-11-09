import type { LoadedProjectEnvironment, LoadProjectEnvironmentOptions } from "./types.js";
/** Syntactic test for absolute paths, ./, ../, and file: specifiers. Performs no existence check. */
declare const isPathSpecifier: (specifier: string) => boolean;
/**
 * Owns one active plugin environment. Loads execute trusted JavaScript in the host process.
 * Serialize load/dispose calls and finish sessions before replacing their environment.
 */
export declare class NodePluginLoader {
    #private;
    /**
     * Read, resolve, import, and activate plugins, then select a target and architecture.
     * An unchanged normalized configuration reuses the current handle. Changed configuration
     * disposes the old environment before activation. Activation failure leaves no replacement.
     * Module contents, logger identity, and bundled plugin object identity are not cache keys.
     * Node's module cache is retained. Failures reject with PluginError or cleanup AggregateError.
     * @param options Project location, trusted plugins, and host precedence settings.
     * @returns A borrowed handle owned by this loader until disposal or replacement.
     */
    loadProjectEnvironment(options: LoadProjectEnvironmentOptions): Promise<LoadedProjectEnvironment>;
    /** Dispose the current environment, if any. This loader may be used again afterward. */
    dispose(): Promise<void>;
}
/**
 * Convenience loader shared by absolute cwd. Calls for that cwd share ownership, not references:
 * disposing any current handle disposes its environment for all callers. Reconfiguration replaces it.
 * Use separate NodePluginLoader instances for independent lifetimes. Serialize calls for each cwd.
 * @param options Project location, trusted plugins, and host precedence settings.
 * @returns A handle to the environment shared by this absolute cwd.
 */
export declare const loadProjectEnvironment: (options: LoadProjectEnvironmentOptions) => Promise<LoadedProjectEnvironment>;
/** Syntactic test for absolute paths, ./, ../, and file: specifiers. Performs no existence check. */
export declare const isPluginPathSpecifier: typeof isPathSpecifier;
export {};
//# sourceMappingURL=loader.d.ts.map
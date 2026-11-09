import type { AssemblerPlugin, AssemblerPluginManifest, PluginDisposable, PluginLogger } from "./contracts.js";
import { AssemblerEnvironment } from "./environment.js";
/** In-memory plugin activation. Module text is diagnostic context, never imported by the manager. */
export interface PluginActivationRequest {
    /** Plugin instance whose activate hook will run. */
    readonly plugin: AssemblerPlugin;
    /** Options validated by the plugin before activation. */
    readonly options?: unknown;
    /** Optional module specifier recorded in activation diagnostics. */
    readonly pluginModule?: string;
}
/** Already-imported module namespace. Its default export must satisfy AssemblerPlugin. */
export interface PluginModuleActivationRequest {
    /** Imported module namespace object containing the default export. */
    readonly module: unknown;
    /** Options validated by the plugin before activation. */
    readonly options?: unknown;
    /** Module specifier used for diagnostics and manifest context. */
    readonly pluginModule: string;
}
/** Host services shared across all activations in this manager. */
export interface PluginManagerOptions {
    /** Omission installs a silent logger. The host retains ownership of the sink. */
    readonly logger?: PluginLogger;
}
/**
 * Owns plugin activation resources and produces one frozen environment.
 * Await operations sequentially. Dispose assembler sessions before disposing their manager.
 */
export declare class PluginManager implements PluginDisposable {
    #private;
    constructor(options?: PluginManagerOptions);
    /**
     * Inspect successfully activated plugins.
     * @returns A new array of frozen manifests in activation order.
     */
    get activatedPlugins(): readonly AssemblerPluginManifest[];
    /**
     * Validate module default exports, then activate them with the same rules as activatePlugins.
     * @param requests Imported namespaces and the options supplied for each plugin.
     */
    activateModules(requests: readonly PluginModuleActivationRequest[]): Promise<void>;
    /**
     * Activate dependencies first, preserving input order among ready plugins.
     * Each plugin commits independently: earlier successes remain active if a later one fails.
     * Throws PluginError for invalid input, dependency conflicts, or activation failure.
     * Activation is unavailable after freeze or disposal. Dispose the manager after a failed batch.
     * @param requests Plugins/options to activate, reordered only as dependencies require.
     */
    activatePlugins(requests: readonly PluginActivationRequest[]): Promise<void>;
    /**
     * Validate target references and aliases, then seal registration. Repeated calls return the
     * same environment. Throws PluginError for invalid graphs or a disposed manager.
     * @returns The validated, shared contribution graph. Resources remain owned by this manager.
     */
    freeze(): AssemblerEnvironment;
    /**
     * Release plugin resources in reverse activation order, attempting every disposable.
     * Idempotent and terminal. Rejects with AggregateError after cleanup failures.
     * Does not dispose assembler sessions or make their continued use safe.
     */
    dispose(): Promise<void>;
}
//# sourceMappingURL=manager.d.ts.map
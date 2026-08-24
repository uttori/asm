import type { AssemblerPlugin, AssemblerPluginManifest, PluginDisposable, PluginLogger } from "./contracts.js";
import { AssemblerEnvironment } from "./environment.js";
export interface PluginActivationRequest {
    readonly plugin: AssemblerPlugin<unknown>;
    readonly options?: unknown;
    readonly pluginModule?: string;
}
export interface PluginModuleActivationRequest {
    readonly module: unknown;
    readonly options?: unknown;
    readonly pluginModule: string;
}
export interface PluginManagerOptions {
    readonly logger?: PluginLogger;
}
export declare class PluginManager implements PluginDisposable {
    #private;
    constructor(options?: PluginManagerOptions);
    get activatedPlugins(): readonly AssemblerPluginManifest[];
    activateModules(requests: readonly PluginModuleActivationRequest[]): Promise<void>;
    activatePlugins(requests: readonly PluginActivationRequest[]): Promise<void>;
    freeze(): AssemblerEnvironment;
    dispose(): Promise<void>;
}
//# sourceMappingURL=manager.d.ts.map
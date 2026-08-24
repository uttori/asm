import type { LoadedProjectEnvironment, LoadProjectEnvironmentOptions } from "./types.js";
declare const isPathSpecifier: (specifier: string) => boolean;
export declare class NodePluginLoader {
    #private;
    loadProjectEnvironment(options: LoadProjectEnvironmentOptions): Promise<LoadedProjectEnvironment>;
    dispose(): Promise<void>;
}
export declare const loadProjectEnvironment: (options: LoadProjectEnvironmentOptions) => Promise<LoadedProjectEnvironment>;
export declare const isPluginPathSpecifier: typeof isPathSpecifier;
export {};
//# sourceMappingURL=loader.d.ts.map
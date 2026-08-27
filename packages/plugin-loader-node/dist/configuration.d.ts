import type { ProjectConfiguration } from "./types.js";
/** Workspace project configuration filename discovered when no path is set. */
export declare const PROJECT_CONFIG_FILENAME = "uttori-asm.config.json";
export declare const validateProjectConfiguration: (value: unknown) => ProjectConfiguration;
export interface LoadedConfigurationFile {
    readonly path?: string;
    readonly directory: string;
    readonly configuration: ProjectConfiguration;
}
export declare const discoverProjectConfigurationPath: (cwd: string, configuredPath?: string) => string | undefined;
export declare const readProjectConfiguration: (cwd: string, configuredPath?: string) => Promise<LoadedConfigurationFile>;
//# sourceMappingURL=configuration.d.ts.map
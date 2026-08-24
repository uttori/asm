import type { ProjectConfiguration } from "./types.js";
export declare const validateProjectConfiguration: (value: unknown) => ProjectConfiguration;
export interface LoadedConfigurationFile {
    readonly path?: string;
    readonly directory: string;
    readonly configuration: ProjectConfiguration;
}
export declare const readProjectConfiguration: (cwd: string, configuredPath?: string) => Promise<LoadedConfigurationFile>;
//# sourceMappingURL=configuration.d.ts.map
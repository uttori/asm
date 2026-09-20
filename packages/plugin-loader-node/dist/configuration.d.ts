import type { ProjectConfiguration } from "./types.js";
/** Workspace project configuration filename discovered when no path is set. */
export declare const PROJECT_CONFIG_FILENAME = "uttori-asm.config.json";
/**
 * Validate known JSON fields without reading files, resolving modules, or validating plugin options.
 * Throws PluginError with PLUGIN_CONFIGURATION_INVALID. The new top-level result retains nested
 * arrays/options from the input. Callers must not assume a deep copy or runtime immutability.
 * @param {unknown} value Parsed JSON to validate.
 * @returns {ProjectConfiguration} Known configuration fields, with nested input references retained.
 */
export declare const validateProjectConfiguration: (value: unknown) => ProjectConfiguration;
/** Validated configuration with the directory used to resolve its relative paths. */
export interface LoadedConfigurationFile {
    /** Absolute file path, absent when optional discovery finds no configuration. */
    readonly path?: string;
    /** Absolute configuration directory, or cwd when no file was found. */
    readonly directory: string;
    readonly configuration: ProjectConfiguration;
}
/**
 * Return an explicit nonempty path resolved against cwd, without checking its existence.
 * Otherwise check only cwd/uttori-asm.config.json, returning undefined when absent. No ancestor search.
 * @param {string} cwd Discovery directory and explicit-path base.
 * @param {string} [configuredPath] Optional explicit configuration filename.
 * @returns {string | undefined} An absolute path, or undefined when optional discovery finds nothing.
 */
export declare const discoverProjectConfigurationPath: (cwd: string, configuredPath?: string) => string | undefined;
/**
 * Read UTF-8 JSON and validate its fields. Relative configuredPath is resolved against cwd.
 * A missing discovered file yields empty configuration. A missing explicit file, malformed JSON,
 * or read failure rejects with PLUGIN_CONFIGURATION_INVALID. Does not execute plugins.
 * @param {string} cwd Discovery directory and explicit-path base.
 * @param {string} [configuredPath] Optional explicit configuration filename.
 * @returns {Promise<LoadedConfigurationFile>} Validated settings with their absolute path-resolution directory.
 */
export declare const readProjectConfiguration: (cwd: string, configuredPath?: string) => Promise<LoadedConfigurationFile>;
//# sourceMappingURL=configuration.d.ts.map
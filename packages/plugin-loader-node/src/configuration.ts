import { existsSync, promises as fs } from "node:fs";
import path from "node:path";

import { PluginError } from "@uttori/asm-core/plugin";

import type { PluginModuleRequest, ProjectConfiguration } from "./types.js";

/** Workspace project configuration filename discovered when no path is set. */
export const PROJECT_CONFIG_FILENAME = "uttori-asm.config.json";

const TOP_LEVEL_KEYS = new Set([
  "$schema",
  "plugins",
  "target",
  "architecture",
  "includePaths",
  "entryPoints",
  "buildOutput",
  "baseImage",
]);
const PLUGIN_KEYS = new Set(["module", "options"]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const configurationError = (message: string, cause?: unknown): PluginError =>
  new PluginError(message, {
    code: "PLUGIN_CONFIGURATION_INVALID",
    cause,
  });

const optionalText = (
  value: unknown,
  field: "target" | "architecture" | "$schema" | "buildOutput" | "baseImage",
): string | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string" || value.trim() === "") {
    throw configurationError(`Configuration field '${field}' must be a non-empty string.`);
  }
  return value;
};

const optionalStringArray = (
  value: unknown,
  field: "includePaths" | "entryPoints",
): string[] | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (
    !Array.isArray(value) ||
    value.some((item) => typeof item !== "string" || item.trim() === "")
  ) {
    throw configurationError(`Configuration field '${field}' must be an array of strings.`);
  }
  return value as string[];
};

const validatePluginEntry = (value: unknown, index: number): PluginModuleRequest => {
  const entry = `plugins[${index}]`;
  if (!isRecord(value)) {
    throw configurationError(`Configuration entry '${entry}' must be an object.`);
  }
  const unknown = Object.keys(value).filter((key) => !PLUGIN_KEYS.has(key));
  if (unknown.length > 0) {
    throw configurationError(
      `Configuration entry '${entry}' has unknown field(s): ${unknown.join(", ")}.`,
    );
  }
  if (typeof value.module !== "string" || value.module.trim() === "") {
    throw configurationError(`Configuration entry '${entry}.module' must be a non-empty string.`);
  }
  if (value.options !== undefined && !isRecord(value.options)) {
    throw configurationError(`Configuration entry '${entry}.options' must be an object.`);
  }
  return {
    module: value.module,
    ...(value.options === undefined ? {} : { options: value.options }),
  };
};

/**
 * Validate known JSON fields without reading files, resolving modules, or validating plugin options.
 * Throws PluginError with PLUGIN_CONFIGURATION_INVALID. The new top-level result retains nested
 * arrays/options from the input; callers must not assume a deep copy or runtime immutability.
 * @param {unknown} value Parsed JSON to validate.
 * @returns {ProjectConfiguration} Known configuration fields, with nested input references retained.
 */
export const validateProjectConfiguration = (value: unknown): ProjectConfiguration => {
  if (!isRecord(value)) {
    throw configurationError("Project configuration must be a JSON object.");
  }
  const unknown = Object.keys(value).filter((key) => !TOP_LEVEL_KEYS.has(key));
  if (unknown.length > 0) {
    throw configurationError(`Project configuration has unknown field(s): ${unknown.join(", ")}.`);
  }
  if (value.plugins !== undefined && !Array.isArray(value.plugins)) {
    throw configurationError("Configuration field 'plugins' must be an array.");
  }
  const schema = optionalText(value.$schema, "$schema");
  const target = optionalText(value.target, "target");
  const architecture = optionalText(value.architecture, "architecture");
  const includePaths = optionalStringArray(value.includePaths, "includePaths");
  const entryPoints = optionalStringArray(value.entryPoints, "entryPoints");
  const buildOutput = optionalText(value.buildOutput, "buildOutput");
  const baseImage = optionalText(value.baseImage, "baseImage");
  return {
    ...(schema === undefined ? {} : { $schema: schema }),
    ...(value.plugins === undefined
      ? {}
      : { plugins: value.plugins.map((entry, index) => validatePluginEntry(entry, index)) }),
    ...(target === undefined ? {} : { target }),
    ...(architecture === undefined ? {} : { architecture }),
    ...(includePaths === undefined ? {} : { includePaths }),
    ...(entryPoints === undefined ? {} : { entryPoints }),
    ...(buildOutput === undefined ? {} : { buildOutput }),
    ...(baseImage === undefined ? {} : { baseImage }),
  };
};

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
 * Otherwise check only cwd/uttori-asm.config.json, returning undefined when absent; no ancestor search.
 * @param {string} cwd Discovery directory and explicit-path base.
 * @param {string} [configuredPath] Optional explicit configuration filename.
 * @returns {string | undefined} An absolute path, or undefined when optional discovery finds nothing.
 */
export const discoverProjectConfigurationPath = (
  cwd: string,
  configuredPath?: string,
): string | undefined => {
  if (configuredPath) {
    return path.resolve(cwd, configuredPath);
  }
  const candidate = path.resolve(cwd, PROJECT_CONFIG_FILENAME);
  return existsSync(candidate) ? candidate : undefined;
};

/**
 * Read UTF-8 JSON and validate its fields. Relative configuredPath is resolved against cwd.
 * A missing discovered file yields empty configuration; a missing explicit file, malformed JSON,
 * or read failure rejects with PLUGIN_CONFIGURATION_INVALID. Does not execute plugins.
 * @param {string} cwd Discovery directory and explicit-path base.
 * @param {string} [configuredPath] Optional explicit configuration filename.
 * @returns {Promise<LoadedConfigurationFile>} Validated settings with their absolute path-resolution directory.
 */
export const readProjectConfiguration = async (
  cwd: string,
  configuredPath?: string,
): Promise<LoadedConfigurationFile> => {
  const explicit = configuredPath !== undefined;
  const candidates = explicit
    ? [path.resolve(cwd, configuredPath)]
    : [path.resolve(cwd, PROJECT_CONFIG_FILENAME)];
  let lastError: unknown;
  for (const configPath of candidates) {
    let source: string;
    try {
      source = await fs.readFile(configPath, "utf8");
    } catch (error) {
      const code =
        typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
      if (code === "ENOENT") {
        lastError = error;
        continue;
      }
      throw configurationError(`Unable to read project configuration '${configPath}'.`, error);
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(source);
    } catch (error) {
      throw configurationError(`Project configuration '${configPath}' is not valid JSON.`, error);
    }
    return {
      path: configPath,
      directory: path.dirname(configPath),
      configuration: validateProjectConfiguration(parsed),
    };
  }
  if (!explicit) {
    return { directory: path.resolve(cwd), configuration: {} };
  }
  throw configurationError(`Unable to read project configuration '${candidates[0]}'.`, lastError);
};

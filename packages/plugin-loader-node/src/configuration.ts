import { promises as fs } from "node:fs";
import path from "node:path";

import { PluginError } from "@uttori/asm-core/plugin";

import type { PluginModuleRequest, ProjectConfiguration } from "./types.js";

const TOP_LEVEL_KEYS = new Set(["$schema", "plugins", "target", "architecture", "includePaths"]);
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
  field: "target" | "architecture" | "$schema",
): string | undefined => {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.trim() === "") {
    throw configurationError(`Configuration field '${field}' must be a non-empty string.`);
  }
  return value;
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
  if (
    value.includePaths !== undefined &&
    (!Array.isArray(value.includePaths) ||
      value.includePaths.some((item) => typeof item !== "string" || item.trim() === ""))
  ) {
    throw configurationError("Configuration field 'includePaths' must be an array of strings.");
  }
  const schema = optionalText(value.$schema, "$schema");
  const target = optionalText(value.target, "target");
  const architecture = optionalText(value.architecture, "architecture");
  return {
    ...(schema === undefined ? {} : { $schema: schema }),
    ...(value.plugins === undefined
      ? {}
      : { plugins: value.plugins.map((entry, index) => validatePluginEntry(entry, index)) }),
    ...(target === undefined ? {} : { target }),
    ...(architecture === undefined ? {} : { architecture }),
    ...(value.includePaths === undefined ? {} : { includePaths: value.includePaths as string[] }),
  };
};

export interface LoadedConfigurationFile {
  readonly path?: string;
  readonly directory: string;
  readonly configuration: ProjectConfiguration;
}

export const readProjectConfiguration = async (
  cwd: string,
  configuredPath?: string,
): Promise<LoadedConfigurationFile> => {
  const explicit = configuredPath !== undefined;
  const configPath = path.resolve(cwd, configuredPath ?? "asm.config.json");
  let source: string;
  try {
    source = await fs.readFile(configPath, "utf8");
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
    if (!explicit && code === "ENOENT") {
      return { directory: path.resolve(cwd), configuration: {} };
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
};

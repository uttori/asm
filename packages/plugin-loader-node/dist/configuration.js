import { existsSync, promises as fs } from "node:fs";
import path from "node:path";
import { PluginError } from "@uttori/asm-core/plugin";
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
const isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
const configurationError = (message, cause) => new PluginError(message, {
    code: "PLUGIN_CONFIGURATION_INVALID",
    cause,
});
const optionalText = (value, field) => {
    if (value === undefined)
        return undefined;
    if (typeof value !== "string" || value.trim() === "") {
        throw configurationError(`Configuration field '${field}' must be a non-empty string.`);
    }
    return value;
};
const optionalStringArray = (value, field) => {
    if (value === undefined)
        return undefined;
    if (!Array.isArray(value) ||
        value.some((item) => typeof item !== "string" || item.trim() === "")) {
        throw configurationError(`Configuration field '${field}' must be an array of strings.`);
    }
    return value;
};
const validatePluginEntry = (value, index) => {
    const entry = `plugins[${index}]`;
    if (!isRecord(value)) {
        throw configurationError(`Configuration entry '${entry}' must be an object.`);
    }
    const unknown = Object.keys(value).filter((key) => !PLUGIN_KEYS.has(key));
    if (unknown.length > 0) {
        throw configurationError(`Configuration entry '${entry}' has unknown field(s): ${unknown.join(", ")}.`);
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
export const validateProjectConfiguration = (value) => {
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
export const discoverProjectConfigurationPath = (cwd, configuredPath) => {
    if (configuredPath) {
        return path.resolve(cwd, configuredPath);
    }
    const candidate = path.resolve(cwd, PROJECT_CONFIG_FILENAME);
    return existsSync(candidate) ? candidate : undefined;
};
export const readProjectConfiguration = async (cwd, configuredPath) => {
    const explicit = configuredPath !== undefined;
    const candidates = explicit
        ? [path.resolve(cwd, configuredPath)]
        : [path.resolve(cwd, PROJECT_CONFIG_FILENAME)];
    let lastError;
    for (const configPath of candidates) {
        let source;
        try {
            source = await fs.readFile(configPath, "utf8");
        }
        catch (error) {
            const code = typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
            if (code === "ENOENT") {
                lastError = error;
                continue;
            }
            throw configurationError(`Unable to read project configuration '${configPath}'.`, error);
        }
        let parsed;
        try {
            parsed = JSON.parse(source);
        }
        catch (error) {
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
//# sourceMappingURL=configuration.js.map
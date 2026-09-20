var __rewriteRelativeImportExtension = (this && this.__rewriteRelativeImportExtension) || function (path, preserveJsx) {
    if (typeof path === "string" && /^\.\.?\//.test(path)) {
        return path.replace(/\.(tsx)$|((?:\.d)?)((?:\.[^./]+?)?)\.([cm]?)ts$/i, function (m, tsx, d, ext, cm) {
            return tsx ? preserveJsx ? ".jsx" : ".js" : d && (!ext || !cm) ? m : (d + ext + "." + cm.toLowerCase() + "js");
        });
    }
    return path;
};
import { realpath } from "node:fs/promises";
import { registerHooks } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PluginError, PluginManager, } from "@uttori/asm-core/plugin";
import { PROJECT_CONFIG_FILENAME, readProjectConfiguration, } from "./configuration.js";
const isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
const toOptionsRecord = (value, entry) => {
    if (value === undefined) {
        return {};
    }
    if (!isRecord(value)) {
        throw new PluginError(`Configuration entry '${entry}.options' must be an object.`, {
            code: "PLUGIN_CONFIGURATION_INVALID",
        });
    }
    return { ...value };
};
const pluginIdFromNamespace = (namespace) => {
    if (!isRecord(namespace) ||
        !isRecord(namespace.default) ||
        !isRecord(namespace.default.manifest)) {
        return undefined;
    }
    return typeof namespace.default.manifest.id === "string"
        ? namespace.default.manifest.id
        : undefined;
};
const stableValue = (value) => {
    if (Array.isArray(value)) {
        return value.map(stableValue);
    }
    if (isRecord(value)) {
        return Object.fromEntries(Object.keys(value)
            .sort()
            .map((key) => [key, stableValue(value[key])]));
    }
    return value;
};
const isPathSpecifier = (specifier) => path.isAbsolute(specifier) ||
    specifier.startsWith("./") ||
    specifier.startsWith("../") ||
    specifier.startsWith("file:");
const normalizeFileUrl = async (url) => {
    try {
        return pathToFileURL(await realpath(fileURLToPath(url))).href;
    }
    catch {
        return url.href;
    }
};
const moduleLoadError = (request, message, resolvedModule, cause) => new PluginError(`Configuration entry '${request.configEntry}' (${request.module})${resolvedModule ? ` resolved to '${resolvedModule}'` : ""}: ${message}`, {
    code: "PLUGIN_MODULE_NOT_FOUND",
    pluginModule: resolvedModule ?? request.module,
    cause,
});
const resolveExternalModule = async (request) => {
    try {
        if (request.module.startsWith("file:")) {
            return normalizeFileUrl(new URL(request.module));
        }
        if (path.isAbsolute(request.module) ||
            request.module.startsWith("./") ||
            request.module.startsWith("../")) {
            return normalizeFileUrl(pathToFileURL(path.resolve(request.baseDirectory, request.module)));
        }
        const parent = pathToFileURL(path.join(request.baseDirectory, PROJECT_CONFIG_FILENAME));
        // Node ignores import.meta.resolve's parent argument without an experimental flag.
        // Redirect this synchronous resolution only, preserving Node's active import conditions
        // and the host's resolver chain without leaving a process-wide hook installed.
        const marker = "uttori:resolve-project-plugin";
        const hooks = registerHooks({
            resolve(specifier, context, nextResolve) {
                if (specifier === marker) {
                    return nextResolve(request.module, { ...context, parentURL: parent.href });
                }
                return nextResolve(specifier, context);
            },
        });
        let resolved;
        try {
            resolved = import.meta.resolve(marker);
        }
        finally {
            hooks.deregister();
        }
        return await normalizeFileUrl(new URL(resolved));
    }
    catch (error) {
        throw moduleLoadError(request, "module could not be resolved", undefined, error);
    }
};
const wrapActivationError = (error, modules) => {
    if (!(error instanceof PluginError)) {
        return new PluginError("Plugin activation failed.", {
            code: "PLUGIN_ACTIVATION_FAILED",
            cause: error,
        });
    }
    const entry = modules.find((item) => item.resolvedModule === error.pluginModule ||
        (error.pluginId !== undefined && item.pluginId === error.pluginId));
    if (!entry) {
        return error;
    }
    return new PluginError(`Configuration entry '${entry.configEntry}' resolved to '${entry.resolvedModule}': ${error.message}`, {
        code: error.code,
        pluginId: error.pluginId ?? entry.pluginId,
        pluginModule: error.pluginModule ?? entry.resolvedModule,
        contributionId: error.contributionId,
        targetId: error.targetId,
        cause: error.cause ?? error,
    });
};
/**
 * Owns one active plugin environment. Loads execute trusted JavaScript in the host process.
 * Serialize load/dispose calls and finish sessions before replacing their environment.
 */
export class NodePluginLoader {
    #current;
    /**
     * Read, resolve, import, and activate plugins, then select a target and architecture.
     * An unchanged normalized configuration reuses the current handle. Changed configuration
     * disposes the old environment before activation. Activation failure leaves no replacement.
     * Module contents, logger identity, and bundled plugin object identity are not cache keys.
     * Node's module cache is retained. Failures reject with PluginError or cleanup AggregateError.
     * @param {LoadProjectEnvironmentOptions} options Project location, trusted plugins, and host precedence settings.
     * @returns {Promise<LoadedProjectEnvironment>} A borrowed handle owned by this loader until disposal or replacement.
     */
    async loadProjectEnvironment(options) {
        const cwd = path.resolve(options.cwd);
        const loadedConfig = options.allowProjectConfiguration === false
            ? { directory: cwd, configuration: {} }
            : await readProjectConfiguration(cwd, options.configFile);
        const configPlugins = loadedConfig.configuration.plugins ?? [];
        const defaultPlugins = configPlugins.length === 0 ? (options.defaults?.plugins ?? []) : [];
        const requests = [
            ...configPlugins.map((request, index) => ({
                ...request,
                baseDirectory: loadedConfig.directory,
                source: "configuration",
                configEntry: `plugins[${index}]`,
            })),
            ...defaultPlugins.map((request, index) => ({
                ...request,
                baseDirectory: cwd,
                source: "host-default",
                configEntry: `hostDefaults.plugins[${index}]`,
            })),
            ...(options.pluginModules ?? []).map((request, index) => ({
                ...request,
                baseDirectory: cwd,
                source: "override",
                configEntry: `pluginModules[${index}]`,
            })),
        ];
        if (options.activateBundledPlugins && options.bundledPlugins) {
            const requested = new Set(requests.map((request) => request.module));
            for (const module of options.bundledPlugins.keys()) {
                if (requested.has(module)) {
                    continue;
                }
                requested.add(module);
                requests.push({
                    module,
                    baseDirectory: cwd,
                    source: "bundled",
                    configEntry: `bundledPlugins[${module}]`,
                });
            }
        }
        const modules = [];
        for (const request of requests) {
            modules.push(await this.#resolveAndImport(request, options));
        }
        const duplicates = new Map();
        for (const item of modules) {
            const previous = duplicates.get(item.resolvedModule);
            if (previous) {
                throw new PluginError(`Configuration entries '${previous.configEntry}' and '${item.configEntry}' resolve to the same module '${item.resolvedModule}'.`, {
                    code: "PLUGIN_CONFIGURATION_INVALID",
                    pluginId: item.pluginId || undefined,
                    pluginModule: item.resolvedModule,
                });
            }
            duplicates.set(item.resolvedModule, item);
        }
        this.#assertAllPluginOptionOverridesMatched(options, modules);
        const targetInput = options.overrides?.target ?? loadedConfig.configuration.target ?? options.defaults?.target;
        const architectureInput = options.overrides?.architecture ??
            loadedConfig.configuration.architecture ??
            options.defaults?.architecture;
        const configuredIncludePaths = options.overrides?.includePaths ??
            loadedConfig.configuration.includePaths ??
            options.defaults?.includePaths ?? ["./"];
        let includeBase = cwd;
        if (options.overrides?.includePaths === undefined &&
            loadedConfig.configuration.includePaths !== undefined) {
            includeBase = loadedConfig.directory;
        }
        const includePaths = [
            ...new Set(configuredIncludePaths.map((entry) => path.resolve(includeBase, entry))),
        ];
        const preliminarySnapshot = JSON.stringify(stableValue({
            configFile: loadedConfig.path,
            modules: modules.map((item) => ({
                module: item.module,
                resolvedModule: item.resolvedModule,
                pluginId: item.pluginId,
                options: item.normalizedOptions,
                source: item.source,
            })),
            targetInput,
            architectureInput,
            includePaths,
        }));
        if (this.#current?.snapshot === preliminarySnapshot && !this.#current.disposed) {
            return this.#current.loaded;
        }
        await this.#disposeCurrent();
        const manager = new PluginManager({ logger: options.logger });
        try {
            const activationRequests = modules.map((item) => ({
                module: item.namespace,
                options: item.normalizedOptions,
                pluginModule: item.resolvedModule,
            }));
            await manager.activateModules(activationRequests);
            const environment = manager.freeze();
            const targets = environment.getTargetSummaries();
            const targetCandidate = targetInput ?? (targets.length === 1 ? targets[0]?.id : undefined);
            if (!targetCandidate) {
                throw new PluginError(targets.length === 0
                    ? "No target is configured and the active plugins provide no targets."
                    : `No target is configured. Choose one of: ${targets.map((target) => target.id).join(", ")}.`, { code: "PLUGIN_TARGET_INVALID" });
            }
            const target = environment.resolveTargetId(targetCandidate);
            if (!target) {
                throw new PluginError(`Unknown configured target '${targetCandidate}'.`, {
                    code: "PLUGIN_TARGET_INVALID",
                    targetId: targetCandidate,
                });
            }
            const targetContribution = environment.getTarget(target);
            const architectureCandidate = architectureInput ?? targetContribution.defaultArchitecture;
            const architecture = environment.resolveArchitectureId(target, architectureCandidate);
            if (!architecture) {
                throw new PluginError(`Architecture '${architectureCandidate}' is not available for target '${target}'.`, {
                    code: "PLUGIN_TARGET_INVALID",
                    targetId: target,
                    contributionId: architectureCandidate,
                });
            }
            const targetOwner = environment.getContributionOwner(target);
            const configuredTargetOptions = modules.find((item) => item.pluginId === targetOwner)?.normalizedOptions ?? {};
            const targetOptions = Object.freeze({
                ...(targetContribution.createOptions ? configuredTargetOptions : {}),
            });
            const normalizedPlugins = Object.freeze(modules.map((item) => Object.freeze({
                module: item.module,
                resolvedModule: item.resolvedModule,
                pluginId: item.pluginId,
                options: item.normalizedOptions,
                source: item.source,
                configEntry: item.configEntry,
                bundled: item.bundled,
            })));
            const configuration = Object.freeze({
                ...(loadedConfig.path === undefined ? {} : { configFile: loadedConfig.path }),
                projectRoot: loadedConfig.directory,
                plugins: normalizedPlugins,
                target,
                architecture,
                targetOptions,
                includePaths: Object.freeze(includePaths),
            });
            const current = {};
            const loaded = Object.freeze({
                environment,
                target,
                architecture,
                targetOptions,
                includePaths: configuration.includePaths,
                configuration,
                diagnostics: Object.freeze([]),
                dispose: async () => {
                    if (this.#current === current) {
                        this.#current = undefined;
                    }
                    await this.#disposeEntry(current);
                },
            });
            Object.assign(current, {
                snapshot: preliminarySnapshot,
                manager,
                loaded,
                disposed: false,
            });
            this.#current = current;
            return loaded;
        }
        catch (error) {
            await manager.dispose();
            throw wrapActivationError(error, modules);
        }
    }
    /** Dispose the current environment, if any. This loader may be used again afterward. */
    async dispose() {
        await this.#disposeCurrent();
    }
    async #resolveAndImport(request, options) {
        const bundled = options.bundledPlugins?.get(request.module);
        let resolvedModule;
        let namespace;
        if (bundled) {
            resolvedModule = `bundled:${request.module}`;
            namespace = { default: bundled };
        }
        else {
            resolvedModule = await resolveExternalModule(request);
            try {
                namespace = await import(__rewriteRelativeImportExtension(resolvedModule));
            }
            catch (error) {
                throw moduleLoadError(request, "module could not be imported", resolvedModule, error);
            }
        }
        const pluginId = pluginIdFromNamespace(namespace) ?? "";
        const configuredOptions = toOptionsRecord(request.options, request.configEntry);
        const moduleOverride = options.overrides?.pluginOptions?.[request.module] ?? {};
        const idOverride = pluginId ? (options.overrides?.pluginOptions?.[pluginId] ?? {}) : {};
        return {
            ...request,
            resolvedModule,
            bundled: bundled !== undefined,
            namespace,
            pluginId,
            normalizedOptions: Object.freeze({ ...configuredOptions, ...moduleOverride, ...idOverride }),
        };
    }
    #assertAllPluginOptionOverridesMatched(options, modules) {
        for (const key of Object.keys(options.overrides?.pluginOptions ?? {})) {
            if (!modules.some((item) => item.module === key || item.pluginId === key)) {
                throw new PluginError(`Plugin option override '${key}' does not match a loaded plugin.`, {
                    code: "PLUGIN_CONFIGURATION_INVALID",
                    pluginId: key,
                });
            }
        }
    }
    async #disposeCurrent() {
        const current = this.#current;
        this.#current = undefined;
        if (current) {
            await this.#disposeEntry(current);
        }
    }
    async #disposeEntry(current) {
        if (current.disposed) {
            return;
        }
        current.disposed = true;
        await current.manager.dispose();
    }
}
const defaultLoaders = new Map();
const defaultEnvironments = new Map();
/**
 * Convenience loader shared by absolute cwd. Calls for that cwd share ownership, not references:
 * disposing any current handle disposes its environment for all callers. Reconfiguration replaces it.
 * Use separate NodePluginLoader instances for independent lifetimes. Serialize calls for each cwd.
 * @param {LoadProjectEnvironmentOptions} options Project location, trusted plugins, and host precedence settings.
 * @returns {Promise<LoadedProjectEnvironment>} A handle to the environment shared by this absolute cwd.
 */
export const loadProjectEnvironment = async (options) => {
    const key = path.resolve(options.cwd);
    let loader = defaultLoaders.get(key);
    if (!loader) {
        loader = new NodePluginLoader();
        defaultLoaders.set(key, loader);
    }
    const loaded = await loader.loadProjectEnvironment(options);
    defaultEnvironments.set(key, loaded);
    const dispose = loaded.dispose.bind(loaded);
    return Object.freeze({
        ...loaded,
        dispose: async () => {
            try {
                await dispose();
            }
            finally {
                // An older handle must not evict a replacement environment owned by this loader.
                if (defaultLoaders.get(key) === loader && defaultEnvironments.get(key) === loaded) {
                    defaultLoaders.delete(key);
                    defaultEnvironments.delete(key);
                }
            }
        },
    });
};
/** Syntactic test for absolute paths, ./, ../, and file: specifiers. Performs no existence check. */
export const isPluginPathSpecifier = isPathSpecifier;
//# sourceMappingURL=loader.js.map
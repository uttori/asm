import { realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  PluginError,
  PluginManager,
  type PluginModuleActivationRequest,
} from "@uttori/asm-core/plugin";

import {
  PROJECT_CONFIG_FILENAME,
  readProjectConfiguration,
  type LoadedConfigurationFile,
} from "./configuration.js";
import type {
  LoadedProjectEnvironment,
  LoadProjectEnvironmentOptions,
  NormalizedPluginModuleRequest,
  PluginModuleRequest,
} from "./types.js";

interface RequestedModule extends PluginModuleRequest {
  readonly baseDirectory: string;
  readonly source: NormalizedPluginModuleRequest["source"];
  readonly configEntry: string;
}

interface ResolvedModule extends RequestedModule {
  readonly resolvedModule: string;
  readonly bundled: boolean;
  readonly namespace: unknown;
  readonly pluginId: string;
  readonly normalizedOptions: Readonly<Record<string, unknown>>;
}

interface CurrentEnvironment {
  readonly snapshot: string;
  readonly manager: PluginManager;
  readonly loaded: LoadedProjectEnvironment;
  disposed: boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toOptionsRecord = (value: unknown, entry: string): Record<string, unknown> => {
  if (value === undefined) return {};
  if (!isRecord(value)) {
    throw new PluginError(`Configuration entry '${entry}.options' must be an object.`, {
      code: "PLUGIN_CONFIGURATION_INVALID",
    });
  }
  return { ...value };
};

const pluginIdFromNamespace = (namespace: unknown): string | undefined => {
  if (
    !isRecord(namespace) ||
    !isRecord(namespace.default) ||
    !isRecord(namespace.default.manifest)
  ) {
    return undefined;
  }
  return typeof namespace.default.manifest.id === "string"
    ? namespace.default.manifest.id
    : undefined;
};

const stableValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableValue(value[key])]),
    );
  }
  return value;
};

const isPathSpecifier = (specifier: string): boolean =>
  path.isAbsolute(specifier) ||
  specifier.startsWith("./") ||
  specifier.startsWith("../") ||
  specifier.startsWith("file:");

const normalizeFileUrl = async (url: URL): Promise<string> => {
  try {
    return pathToFileURL(await realpath(fileURLToPath(url))).href;
  } catch {
    return url.href;
  }
};

const moduleLoadError = (
  request: RequestedModule,
  message: string,
  resolvedModule?: string,
  cause?: unknown,
): PluginError =>
  new PluginError(
    `Configuration entry '${request.configEntry}' (${request.module})${
      resolvedModule ? ` resolved to '${resolvedModule}'` : ""
    }: ${message}`,
    {
      code: "PLUGIN_MODULE_NOT_FOUND",
      pluginModule: resolvedModule ?? request.module,
      cause,
    },
  );

const resolveExternalModule = async (request: RequestedModule): Promise<string> => {
  try {
    if (request.module.startsWith("file:")) {
      return normalizeFileUrl(new URL(request.module));
    }
    if (
      path.isAbsolute(request.module) ||
      request.module.startsWith("./") ||
      request.module.startsWith("../")
    ) {
      return normalizeFileUrl(pathToFileURL(path.resolve(request.baseDirectory, request.module)));
    }
    const parent = pathToFileURL(path.join(request.baseDirectory, PROJECT_CONFIG_FILENAME));
    return await normalizeFileUrl(new URL(import.meta.resolve(request.module, parent.href)));
  } catch (error) {
    throw moduleLoadError(request, "module could not be resolved", undefined, error);
  }
};

const wrapActivationError = (error: unknown, modules: readonly ResolvedModule[]): PluginError => {
  if (!(error instanceof PluginError)) {
    return new PluginError("Plugin activation failed.", {
      code: "PLUGIN_ACTIVATION_FAILED",
      cause: error,
    });
  }
  const entry = modules.find(
    (item) =>
      item.resolvedModule === error.pluginModule ||
      (error.pluginId !== undefined && item.pluginId === error.pluginId),
  );
  if (!entry) return error;
  return new PluginError(
    `Configuration entry '${entry.configEntry}' resolved to '${entry.resolvedModule}': ${error.message}`,
    {
      code: error.code,
      pluginId: error.pluginId ?? entry.pluginId,
      pluginModule: error.pluginModule ?? entry.resolvedModule,
      contributionId: error.contributionId,
      targetId: error.targetId,
      cause: error.cause ?? error,
    },
  );
};

export class NodePluginLoader {
  #current?: CurrentEnvironment;

  async loadProjectEnvironment(
    options: LoadProjectEnvironmentOptions,
  ): Promise<LoadedProjectEnvironment> {
    const cwd = path.resolve(options.cwd);
    const loadedConfig: LoadedConfigurationFile =
      options.allowProjectConfiguration === false
        ? { directory: cwd, configuration: {} }
        : await readProjectConfiguration(cwd, options.configFile);
    const configPlugins = loadedConfig.configuration.plugins ?? [];
    const defaultPlugins = configPlugins.length === 0 ? (options.defaults?.plugins ?? []) : [];
    const requests: RequestedModule[] = [
      ...configPlugins.map((request, index) => ({
        ...request,
        baseDirectory: loadedConfig.directory,
        source: "configuration" as const,
        configEntry: `plugins[${index}]`,
      })),
      ...defaultPlugins.map((request, index) => ({
        ...request,
        baseDirectory: cwd,
        source: "host-default" as const,
        configEntry: `hostDefaults.plugins[${index}]`,
      })),
      ...(options.pluginModules ?? []).map((request, index) => ({
        ...request,
        baseDirectory: cwd,
        source: "override" as const,
        configEntry: `pluginModules[${index}]`,
      })),
    ];

    if (options.activateBundledPlugins && options.bundledPlugins) {
      const requested = new Set(requests.map((request) => request.module));
      for (const module of options.bundledPlugins.keys()) {
        if (requested.has(module)) continue;
        requested.add(module);
        requests.push({
          module,
          baseDirectory: cwd,
          source: "bundled",
          configEntry: `bundledPlugins[${module}]`,
        });
      }
    }

    const modules: ResolvedModule[] = [];
    for (const request of requests) {
      modules.push(await this.#resolveAndImport(request, options));
    }
    const duplicates = new Map<string, ResolvedModule>();
    for (const item of modules) {
      const previous = duplicates.get(item.resolvedModule);
      if (previous) {
        throw new PluginError(
          `Configuration entries '${previous.configEntry}' and '${item.configEntry}' resolve to the same module '${item.resolvedModule}'.`,
          {
            code: "PLUGIN_CONFIGURATION_INVALID",
            pluginId: item.pluginId || undefined,
            pluginModule: item.resolvedModule,
          },
        );
      }
      duplicates.set(item.resolvedModule, item);
    }
    this.#assertAllPluginOptionOverridesMatched(options, modules);

    const targetInput =
      options.overrides?.target ?? loadedConfig.configuration.target ?? options.defaults?.target;
    const architectureInput =
      options.overrides?.architecture ??
      loadedConfig.configuration.architecture ??
      options.defaults?.architecture;
    const configuredIncludePaths = options.overrides?.includePaths ??
      loadedConfig.configuration.includePaths ??
      options.defaults?.includePaths ?? ["./"];
    let includeBase = cwd;
    if (
      options.overrides?.includePaths === undefined &&
      loadedConfig.configuration.includePaths !== undefined
    ) {
      includeBase = loadedConfig.directory;
    }
    const includePaths = [
      ...new Set(configuredIncludePaths.map((entry) => path.resolve(includeBase, entry))),
    ];

    const preliminarySnapshot = JSON.stringify(
      stableValue({
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
      }),
    );
    if (this.#current?.snapshot === preliminarySnapshot && !this.#current.disposed) {
      return this.#current.loaded;
    }
    await this.#disposeCurrent();

    const manager = new PluginManager({ logger: options.logger });
    try {
      const activationRequests: PluginModuleActivationRequest[] = modules.map((item) => ({
        module: item.namespace,
        options: item.normalizedOptions,
        pluginModule: item.resolvedModule,
      }));
      await manager.activateModules(activationRequests);
      const environment = manager.freeze();
      const targets = environment.getTargetSummaries();
      const targetCandidate = targetInput ?? (targets.length === 1 ? targets[0]?.id : undefined);
      if (!targetCandidate) {
        throw new PluginError(
          targets.length === 0
            ? "No target is configured and the active plugins provide no targets."
            : `No target is configured; choose one of: ${targets.map((target) => target.id).join(", ")}.`,
          { code: "PLUGIN_TARGET_INVALID" },
        );
      }
      const target = environment.resolveTargetId(targetCandidate);
      if (!target) {
        throw new PluginError(`Unknown configured target '${targetCandidate}'.`, {
          code: "PLUGIN_TARGET_INVALID",
          targetId: targetCandidate,
        });
      }
      const targetContribution = environment.getTarget(target)!;
      const architectureCandidate = architectureInput ?? targetContribution.defaultArchitecture;
      const architecture = environment.resolveArchitectureId(target, architectureCandidate);
      if (!architecture) {
        throw new PluginError(
          `Architecture '${architectureCandidate}' is not available for target '${target}'.`,
          {
            code: "PLUGIN_TARGET_INVALID",
            targetId: target,
            contributionId: architectureCandidate,
          },
        );
      }
      const targetOwner = environment.getContributionOwner(target);
      const configuredTargetOptions =
        modules.find((item) => item.pluginId === targetOwner)?.normalizedOptions ?? {};
      const targetOptions = Object.freeze({
        ...(targetContribution.createOptions ? configuredTargetOptions : {}),
      });
      const normalizedPlugins: readonly NormalizedPluginModuleRequest[] = Object.freeze(
        modules.map((item) =>
          Object.freeze({
            module: item.module,
            resolvedModule: item.resolvedModule,
            pluginId: item.pluginId,
            options: item.normalizedOptions,
            source: item.source,
            configEntry: item.configEntry,
            bundled: item.bundled,
          }),
        ),
      );
      const configuration = Object.freeze({
        ...(loadedConfig.path === undefined ? {} : { configFile: loadedConfig.path }),
        projectRoot: loadedConfig.directory,
        plugins: normalizedPlugins,
        target,
        architecture,
        targetOptions,
        includePaths: Object.freeze(includePaths),
      });
      const current = {} as CurrentEnvironment;
      const loaded: LoadedProjectEnvironment = Object.freeze({
        environment,
        target,
        architecture,
        targetOptions,
        includePaths: configuration.includePaths,
        configuration,
        diagnostics: Object.freeze([]),
        dispose: async () => {
          if (this.#current === current) this.#current = undefined;
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
    } catch (error) {
      await manager.dispose();
      throw wrapActivationError(error, modules);
    }
  }

  async dispose(): Promise<void> {
    await this.#disposeCurrent();
  }

  async #resolveAndImport(
    request: RequestedModule,
    options: LoadProjectEnvironmentOptions,
  ): Promise<ResolvedModule> {
    const bundled = options.bundledPlugins?.get(request.module);
    let resolvedModule: string;
    let namespace: unknown;
    if (bundled) {
      resolvedModule = `bundled:${request.module}`;
      namespace = { default: bundled };
    } else {
      resolvedModule = await resolveExternalModule(request);
      try {
        namespace = await import(resolvedModule);
      } catch (error) {
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

  #assertAllPluginOptionOverridesMatched(
    options: LoadProjectEnvironmentOptions,
    modules: readonly ResolvedModule[],
  ): void {
    for (const key of Object.keys(options.overrides?.pluginOptions ?? {})) {
      if (!modules.some((item) => item.module === key || item.pluginId === key)) {
        throw new PluginError(`Plugin option override '${key}' does not match a loaded plugin.`, {
          code: "PLUGIN_CONFIGURATION_INVALID",
          pluginId: key,
        });
      }
    }
  }

  async #disposeCurrent(): Promise<void> {
    const current = this.#current;
    this.#current = undefined;
    if (current) await this.#disposeEntry(current);
  }

  async #disposeEntry(current: CurrentEnvironment): Promise<void> {
    if (current.disposed) return;
    current.disposed = true;
    await current.manager.dispose();
  }
}

const defaultLoaders = new Map<string, NodePluginLoader>();

export const loadProjectEnvironment = async (
  options: LoadProjectEnvironmentOptions,
): Promise<LoadedProjectEnvironment> => {
  const key = path.resolve(options.cwd);
  let loader = defaultLoaders.get(key);
  if (!loader) {
    loader = new NodePluginLoader();
    defaultLoaders.set(key, loader);
  }
  const loaded = await loader.loadProjectEnvironment(options);
  const dispose = loaded.dispose.bind(loaded);
  return Object.freeze({
    ...loaded,
    dispose: async () => {
      await dispose();
      if (defaultLoaders.get(key) === loader) defaultLoaders.delete(key);
    },
  });
};

export const isPluginPathSpecifier = isPathSpecifier;

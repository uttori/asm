import { existsSync } from "node:fs";
import path from "node:path";

import { Assembler, WorkspaceIndex, type AssemblerOptions } from "@uttori/asm-core";
import {
  NodePluginLoader,
  discoverProjectConfigurationPath,
  type LoadedProjectEnvironment,
  type PluginModuleRequest,
  type ProjectConfigurationDefaults,
} from "@uttori/asm-plugin-loader-node";
import type { AssemblerPlugin, PluginLogger } from "@uttori/asm-core/plugin";

export type PluginModuleSetting = string | PluginModuleRequest;

export interface ProjectEnvironmentSettings {
  readonly cwd: string;
  readonly workspaceTrusted: boolean;
  readonly configFile?: string;
  readonly plugins?: readonly PluginModuleSetting[];
  readonly target?: string;
  readonly architecture?: string;
  readonly entryPoints?: readonly string[];
  readonly includePaths?: readonly string[];
}

export interface ProjectEnvironmentState {
  readonly loaded: LoadedProjectEnvironment;
  readonly index: WorkspaceIndex;
  readonly trustNotice?: string;
}

export interface ProjectEnvironmentControllerOptions {
  readonly bundledPlugins: ReadonlyMap<string, AssemblerPlugin>;
  readonly defaults: ProjectConfigurationDefaults;
  readonly logger?: PluginLogger;
  /** Forwarded to the loader so bundled plugins stay active even when a project config lists a subset. */
  readonly activateBundledPlugins?: boolean;
}

const configuredPluginModules = (
  plugins: readonly PluginModuleSetting[] | undefined,
): readonly PluginModuleRequest[] =>
  (plugins ?? []).map((entry, index) => {
    if (typeof entry === "string") {
      if (!entry.trim()) throw new Error(`Plugin setting at index ${index} must not be empty.`);
      return { module: entry };
    }
    if (!entry || typeof entry !== "object" || typeof entry.module !== "string") {
      throw new Error(`Plugin setting at index ${index} must be a module string or object.`);
    }
    return {
      module: entry.module,
      ...(entry.options === undefined ? {} : { options: entry.options }),
    };
  });

/**
 * Owns the active language-server plugin environment and replaces it transactionally.
 * Candidate plugins are activated in a fresh loader; the old environment remains live
 * until the replacement index has been constructed and populated successfully.
 */
export class ProjectEnvironmentController {
  #state?: ProjectEnvironmentState;

  constructor(private readonly options: ProjectEnvironmentControllerOptions) {}

  get current(): ProjectEnvironmentState {
    if (!this.#state) throw new Error("The project environment has not been initialized.");
    return this.#state;
  }

  async replace(
    settings: ProjectEnvironmentSettings,
    overlays: ReadonlyMap<string, string> = new Map(),
  ): Promise<ProjectEnvironmentState> {
    const cwd = path.resolve(settings.cwd);
    const pluginModules = configuredPluginModules(settings.plugins);
    const configuredPath = discoverProjectConfigurationPath(cwd, settings.configFile);
    const hasWorkspaceConfiguration =
      Boolean(settings.configFile) || Boolean(configuredPath && existsSync(configuredPath));
    const workspacePluginsRequested = hasWorkspaceConfiguration || pluginModules.length > 0;
    const useHostDefaults =
      !settings.workspaceTrusted || (!hasWorkspaceConfiguration && pluginModules.length === 0);
    const loader = new NodePluginLoader();
    let next: ProjectEnvironmentState;

    try {
      const loaded = await loader.loadProjectEnvironment({
        cwd,
        allowProjectConfiguration: settings.workspaceTrusted,
        ...(settings.workspaceTrusted && (settings.configFile || configuredPath)
          ? { configFile: settings.configFile ?? configuredPath }
          : {}),
        pluginModules: settings.workspaceTrusted ? pluginModules : [],
        bundledPlugins: this.options.bundledPlugins,
        ...(this.options.activateBundledPlugins ? { activateBundledPlugins: true } : {}),
        ...(useHostDefaults ? { defaults: this.options.defaults } : {}),
        overrides: {
          ...(settings.target ? { target: settings.target } : {}),
          ...(settings.architecture ? { architecture: settings.architecture } : {}),
          ...(settings.includePaths ? { includePaths: settings.includePaths } : {}),
        },
        logger: this.options.logger,
      });
      const index = new WorkspaceIndex({
        environment: loaded.environment,
        target: loaded.target,
        architecture: loaded.architecture,
        targetOptions: loaded.targetOptions,
        entryPoints: [...(settings.entryPoints ?? [])],
        includePaths: [...loaded.includePaths],
        logger: this.options.logger,
        cacheDir: path.join(cwd, ".uttori-asm", "cache"),
      });
      for (const [file, content] of overlays) index.updateDocument(file, content);
      if (overlays.size > 0 || (settings.entryPoints?.length ?? 0) > 0) index.reindex();

      next = Object.freeze({
        loaded,
        index,
        ...(!settings.workspaceTrusted && workspacePluginsRequested
          ? {
              trustNotice:
                "Workspace plugin configuration is disabled until this workspace is trusted.",
            }
          : {}),
      });
    } catch (error) {
      await loader.dispose();
      throw error;
    }

    const previous = this.#state;
    this.#state = next;
    try {
      await previous?.loaded.dispose();
    } catch (error) {
      this.options.logger?.warn("The replaced plugin environment failed to dispose cleanly.", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return next;
  }

  createAssembler(
    options: Omit<
      AssemblerOptions,
      "environment" | "target" | "architecture" | "targetOptions"
    > = {},
  ): Assembler {
    const { loaded } = this.current;
    return new Assembler({
      environment: loaded.environment,
      target: loaded.target,
      architecture: loaded.architecture,
      targetOptions: loaded.targetOptions,
      ...options,
    });
  }

  async dispose(): Promise<void> {
    const current = this.#state;
    this.#state = undefined;
    await current?.loaded.dispose();
  }
}

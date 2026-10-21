import { existsSync } from "node:fs";
import path from "node:path";

import { Assembler, type AssemblerOptions } from "@uttori/asm-core";
import type { AssemblerPlugin, PluginLogger } from "@uttori/asm-core/plugin";
import {
  WorkspaceIndex,
  type WorkspaceAnalysisSnapshot,
  type WorkspaceIndexOptions,
} from "@uttori/asm-core/tooling";
import {
  NodePluginLoader,
  discoverProjectConfigurationPath,
  type LoadedProjectEnvironment,
  type PluginModuleRequest,
  type ProjectConfigurationDefaults,
} from "@uttori/asm-plugin-loader-node";

/** Editor plugin entry: a module specifier alone, or a specifier with activation options. */
export type PluginModuleSetting = string | PluginModuleRequest;

/** Editor settings are JSON. Accept a module string or an object with a string module. */
function isPluginModuleRequest(value: unknown): value is PluginModuleRequest {
  return (
    typeof value === "object" &&
    value !== null &&
    "module" in value &&
    typeof value.module === "string"
  );
}

/** Host-resolved settings used to load plugins and construct a matching workspace index. */
export interface ProjectEnvironmentSettings {
  /** Base directory for config discovery, relative plugin/include paths, and the index cache. */
  readonly cwd: string;
  /** Allows project config and external plugin loading; false limits activation to host defaults. */
  readonly workspaceTrusted: boolean;
  /** Explicit config path, absolute or relative to cwd; omitted to discover the project config. */
  readonly configFile?: string;
  /** Additional plugin requests; ignored for activation while the workspace is untrusted. */
  readonly plugins?: readonly PluginModuleSetting[];
  /** Target ID or alias overriding the project config and host default. */
  readonly target?: string;
  /** Architecture override; omitted to use configured/host defaults, then the target's default. */
  readonly architecture?: string;
  /** Analysis roots, resolved by the host; omitted or empty to derive roots from open documents. */
  readonly entryPoints?: readonly string[];
  /** Replaces configured include paths when supplied; relative entries resolve against cwd. */
  readonly includePaths?: readonly string[];
}

/** Published environment/index pair, valid until the controller replaces or disposes it. */
export interface ProjectEnvironmentState {
  /** Activated plugins and resolved target configuration; disposal belongs to the controller. */
  readonly loaded: LoadedProjectEnvironment;
  /** Mutable analysis index using exactly the environment exposed by loaded. */
  readonly index: WorkspaceIndex;
  /** User-facing warning when workspace trust prevented requested plugin configuration. */
  readonly trustNotice?: string;
}

/** Host-owned plugin catalog and defaults retained across environment replacements. */
export interface ProjectEnvironmentControllerOptions {
  /** Executable hosts isolate CPU-heavy indexing; library tests may retain synchronous construction. */
  readonly indexer?: (
    settings: ProjectEnvironmentSettings,
    overlays: ReadonlyMap<string, string>,
  ) => Promise<WorkspaceAnalysisSnapshot>;
  /** Pre-imported plugins keyed by module specifier, available without external module loading. */
  readonly bundledPlugins: ReadonlyMap<string, AssemblerPlugin>;
  /** Fallback configuration for untrusted workspaces or projects with no config/plugin requests. */
  readonly defaults: ProjectConfigurationDefaults;
  /** Receives plugin/index messages and warnings if a replaced environment cannot be disposed. */
  readonly logger?: PluginLogger;
  /** Activates all bundled plugins even when a config lists a subset; omitted defaults to false. */
  readonly activateBundledPlugins?: boolean;
}

/**
 * Normalizes editor shorthand before the loader performs full plugin validation.
 * @param {readonly PluginModuleSetting[] | undefined} plugins Editor entries; omitted means none.
 * @returns {readonly PluginModuleRequest[]} Module requests preserving supplied activation options.
 * @throws {Error} A shorthand string is blank or an object has no string module specifier.
 */
const configuredPluginModules = (
  plugins: readonly unknown[] | undefined,
): readonly PluginModuleRequest[] =>
  (plugins ?? []).map((entry, index) => {
    if (typeof entry === "string") {
      if (!entry.trim()) {
        throw new Error(`Plugin setting at index ${index} must not be empty.`);
      }
      return { module: entry };
    }
    if (!isPluginModuleRequest(entry)) {
      throw new Error(`Plugin setting at index ${index} must be a module string or object.`);
    }
    return Object.assign(
      { module: entry.module },
      entry.options === undefined ? {} : { options: entry.options },
    );
  });

/**
 * Owns the active language-server plugin environment and replaces it transactionally.
 * Candidate plugins are activated in a fresh loader. The old environment remains live
 * until the replacement index has been constructed and populated successfully.
 */
export class ProjectEnvironmentController {
  /** Last successfully published pair; absent before the first replacement and after disposal. */
  #state?: ProjectEnvironmentState;

  /**
   * Retains host configuration without loading plugins; call replace before accessing current.
   * @param {ProjectEnvironmentControllerOptions} options Host configuration, retained by reference.
   */
  constructor(private readonly options: ProjectEnvironmentControllerOptions) {}

  /**
   * Exposes the live pair without transferring ownership of its plugin lifecycle.
   * @returns {ProjectEnvironmentState} The most recently committed environment and index.
   * @throws {Error} No environment has been published, or the controller has been disposed.
   */
  get current(): ProjectEnvironmentState {
    if (!this.#state) {
      throw new Error("The project environment has not been initialized.");
    }
    return this.#state;
  }

  /**
   * Loads and indexes a candidate before publishing it, then disposes the previous environment.
   * Callers must serialize replacements and disposal. A failed candidate leaves current intact;
   * failure to dispose the old environment after publication is logged without undoing the swap.
   * @param {ProjectEnvironmentSettings} settings Configuration for the candidate environment.
   * @param {ReadonlyMap<string, string>} overlays Absolute source paths to unsaved text, copied into the new index.
   * @returns {Promise<ProjectEnvironmentState>} The published pair after previous-plugin cleanup.
   * @throws {Error} Configuration, plugin loading, or initial indexing fails.
   */
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
    // Untrusted projects must not activate workspace plugins; trusted explicit requests own
    // their defaults so a host target cannot silently replace missing project configuration.
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
      const indexOptions: WorkspaceIndexOptions = {
        environment: loaded.environment,
        target: loaded.target,
        architecture: loaded.architecture,
        targetOptions: loaded.targetOptions,
        entryPoints: [...(settings.entryPoints ?? [])],
        includePaths: [...loaded.includePaths],
        logger: this.options.logger,
        cacheDir: path.join(cwd, ".uttori-asm", "cache"),
      };
      let index = new WorkspaceIndex(indexOptions);
      // Seed unsaved buffers before analysis so the replacement reflects the editor snapshot.
      for (const [file, content] of overlays) {
        index.updateDocument(file, content);
      }
      if (overlays.size > 0 || (settings.entryPoints?.length ?? 0) > 0) {
        if (this.options.indexer) {
          const snapshot = await this.options.indexer(settings, overlays);
          index = WorkspaceIndex.fromSnapshot(indexOptions, snapshot, overlays);
        } else {
          index.reindex();
        }
      }

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

    // Publish first: cleanup failure must not discard an already usable candidate.
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

  /** Publish one completed analysis generation while retaining ownership of the active environment. */
  publishAnalysis(
    snapshot: WorkspaceAnalysisSnapshot,
    overlays: ReadonlyMap<string, string>,
  ): WorkspaceIndex {
    const { loaded, index: previous } = this.current;
    const index = WorkspaceIndex.fromSnapshot(
      {
        environment: loaded.environment,
        target: loaded.target,
        architecture: loaded.architecture,
        targetOptions: loaded.targetOptions,
        entryPoints: previous.entryPoints,
        includePaths: [...loaded.includePaths],
      },
      snapshot,
      overlays,
    );
    this.#state = Object.freeze({ ...this.current, index });
    return index;
  }

  /**
   * Creates a build session using the same plugin environment and target as current analysis.
   * @param {Omit<AssemblerOptions, "environment" | "target" | "architecture" | "targetOptions">} options Per-build options; environment selection is owned by the controller.
   * @returns {Assembler} A new session that the caller must dispose before replacing the environment.
   * @throws {Error} There is no current environment or assembler initialization fails.
   */
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

  /**
   * Clears current before awaiting plugin cleanup; repeated calls with no current state do nothing.
   * Callers must finish active builds and serialize this with replace.
   * @returns {Promise<void>} Resolves after the active environment is disposed.
   * @throws {Error} Plugin cleanup fails; current remains cleared.
   */
  async dispose(): Promise<void> {
    const current = this.#state;
    this.#state = undefined;
    await current?.loaded.dispose();
  }
}

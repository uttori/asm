import type {
  AssemblerEnvironment,
  AssemblerPlugin,
  PluginDiagnosticContext,
  PluginLogger,
} from "@uttori/asm-core/plugin";

/** One trusted plugin default export to import and activate. */
export interface PluginModuleRequest {
  /** Package specifier, absolute/relative file path, or file URL; relative base depends on request source. */
  readonly module: string;
  /** JSON-compatible object, validated by the plugin after host overrides are merged. */
  readonly options?: unknown;
}

/** JSON file shape; paths remain as written until a host or loader resolves them. */
export interface ProjectConfiguration {
  /** Editor schema hint; the loader does not fetch or execute it. */
  readonly $schema?: string;
  readonly plugins?: readonly PluginModuleRequest[];
  readonly target?: string;
  readonly architecture?: string;
  readonly includePaths?: readonly string[];
  /** Host metadata: the loader validates this field but does not assemble these files. */
  readonly entryPoints?: readonly string[];
  /** Host metadata: output path, not written by the loader. */
  readonly buildOutput?: string;
  /** Host metadata: image path, not read by the loader. */
  readonly baseImage?: string;
}

/** Lowest-precedence host settings; paths resolve from cwd. */
export interface ProjectConfigurationDefaults {
  /** Used when the configuration's plugin list is missing or empty. */
  readonly plugins?: readonly PluginModuleRequest[];
  readonly target?: string;
  readonly architecture?: string;
  readonly includePaths?: readonly string[];
}

/** Highest-precedence host settings; include paths replace the full list and resolve from cwd. */
export interface ProjectConfigurationOverrides {
  readonly target?: string;
  readonly architecture?: string;
  readonly includePaths?: readonly string[];
  /** Shallow merge: configured options, then module-specifier override, then plugin-ID override. Unmatched keys reject loading. */
  readonly pluginOptions?: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
}

/** Imported plugin identity and configured options before the plugin's validateOptions result. */
export interface NormalizedPluginModuleRequest {
  readonly module: string;
  /** Canonical file URL or synthetic bundled: identity; used for duplicate detection. */
  readonly resolvedModule: string;
  readonly pluginId: string;
  /** Shallow-frozen merged options; nested data may still be shared with caller input. */
  readonly options: Readonly<Record<string, unknown>>;
  readonly source: "configuration" | "host-default" | "override" | "bundled";
  /** Human-readable attribution, such as plugins[0] or pluginModules[0]. */
  readonly configEntry: string;
  readonly bundled: boolean;
}

/** Frozen selection snapshot; IDs are canonical and include paths are absolute and deduplicated. */
export interface NormalizedProjectConfiguration {
  readonly configFile?: string;
  /** Configuration directory, or absolute cwd when no file is used. */
  readonly projectRoot: string;
  readonly plugins: readonly NormalizedPluginModuleRequest[];
  readonly target: string;
  readonly architecture: string;
  /** Merged options of the target's owning plugin, or empty if the target has no createOptions hook. */
  readonly targetOptions: Readonly<Record<string, unknown>>;
  readonly includePaths: readonly string[];
}

/** Borrowed environment and settings; the loader retains ownership of plugin activation resources. */
export interface LoadedProjectEnvironment {
  readonly environment: AssemblerEnvironment;
  readonly target: string;
  readonly architecture: string;
  /** Pass to Assembler for target-specific validation/defaults; not the output of createOptions. */
  readonly targetOptions: Readonly<Record<string, unknown>>;
  readonly includePaths: readonly string[];
  readonly configuration: NormalizedProjectConfiguration;
  /** Currently empty on success; invalid configuration and activation reject loading instead. */
  readonly diagnostics: readonly PluginDiagnosticContext[];
  /** Idempotent release of this environment's plugins. Dispose its sessions first; failures aggregate. */
  dispose(): Promise<void>;
}

/** Node host input. Supply JSON-compatible option data and establish trust before loading modules. */
export interface LoadProjectEnvironmentOptions {
  /** Explicit path relative to cwd; a missing file is an error. */
  readonly configFile?: string;
  /** Discovery directory and base for host-supplied modules, defaults, and include overrides. */
  readonly cwd: string;
  /** Whether to read an explicit or discovered workspace configuration file. Defaults to true. */
  readonly allowProjectConfiguration?: boolean;
  /** Explicit host/CLI modules, appended after configuration plugins. */
  readonly pluginModules?: readonly PluginModuleRequest[];
  /** Exact specifier-to-plugin map, checked before Node resolution. Entries activate only when requested. */
  readonly bundledPlugins?: ReadonlyMap<string, AssemblerPlugin>;
  /**
   * When true, activate every entry in {@link bundledPlugins} that is not already
   * requested by configuration, host defaults, or {@link pluginModules}.
   */
  readonly activateBundledPlugins?: boolean;
  readonly overrides?: ProjectConfigurationOverrides;
  readonly defaults?: ProjectConfigurationDefaults;
  readonly logger?: PluginLogger;
}

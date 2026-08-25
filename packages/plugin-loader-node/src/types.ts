import type {
  AssemblerEnvironment,
  AssemblerPlugin,
  PluginDiagnosticContext,
  PluginLogger,
} from "@uttori/asm-core/plugin";

export interface PluginModuleRequest {
  readonly module: string;
  readonly options?: unknown;
}

export interface ProjectConfiguration {
  readonly $schema?: string;
  readonly plugins?: readonly PluginModuleRequest[];
  readonly target?: string;
  readonly architecture?: string;
  readonly includePaths?: readonly string[];
}

export interface ProjectConfigurationDefaults {
  readonly plugins?: readonly PluginModuleRequest[];
  readonly target?: string;
  readonly architecture?: string;
  readonly includePaths?: readonly string[];
}

export interface ProjectConfigurationOverrides {
  readonly target?: string;
  readonly architecture?: string;
  readonly includePaths?: readonly string[];
  /** Merge plugin options by configured module specifier or activated plugin ID. */
  readonly pluginOptions?: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
}

export interface NormalizedPluginModuleRequest {
  readonly module: string;
  readonly resolvedModule: string;
  readonly pluginId: string;
  readonly options: Readonly<Record<string, unknown>>;
  readonly source: "configuration" | "host-default" | "override";
  readonly configEntry: string;
  readonly bundled: boolean;
}

export interface NormalizedProjectConfiguration {
  readonly configFile?: string;
  readonly projectRoot: string;
  readonly plugins: readonly NormalizedPluginModuleRequest[];
  readonly target: string;
  readonly architecture: string;
  readonly targetOptions: Readonly<Record<string, unknown>>;
  readonly includePaths: readonly string[];
}

export interface LoadedProjectEnvironment {
  readonly environment: AssemblerEnvironment;
  readonly target: string;
  readonly architecture: string;
  readonly targetOptions: Readonly<Record<string, unknown>>;
  readonly includePaths: readonly string[];
  readonly configuration: NormalizedProjectConfiguration;
  readonly diagnostics: readonly PluginDiagnosticContext[];
  dispose(): Promise<void>;
}

export interface LoadProjectEnvironmentOptions {
  readonly configFile?: string;
  readonly cwd: string;
  /** Whether to read an explicit or discovered workspace configuration file. Defaults to true. */
  readonly allowProjectConfiguration?: boolean;
  /** Explicit host/CLI modules, appended after configuration plugins. */
  readonly pluginModules?: readonly PluginModuleRequest[];
  readonly bundledPlugins?: ReadonlyMap<string, AssemblerPlugin>;
  readonly overrides?: ProjectConfigurationOverrides;
  readonly defaults?: ProjectConfigurationDefaults;
  readonly logger?: PluginLogger;
}

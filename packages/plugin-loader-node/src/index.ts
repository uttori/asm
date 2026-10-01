/** Node host entry point. The JSON schema is exposed through its own package subpath. */
export {
  PROJECT_CONFIG_FILENAME,
  discoverProjectConfigurationPath,
  readProjectConfiguration,
  validateProjectConfiguration,
  type LoadedConfigurationFile,
} from "./configuration.js";
export { NodePluginLoader, loadProjectEnvironment, isPluginPathSpecifier } from "./loader.js";
export { fingerprintNodeToolchain, type ToolchainFingerprint } from "./toolchain.js";
export type {
  PluginModuleRequest,
  ProjectConfiguration,
  ProjectConfigurationDefaults,
  ProjectConfigurationOverrides,
  NormalizedPluginModuleRequest,
  NormalizedProjectConfiguration,
  LoadedProjectEnvironment,
  LoadProjectEnvironmentOptions,
} from "./types.js";

export type PluginDiagnosticCode =
  | "PLUGIN_MODULE_NOT_FOUND"
  | "PLUGIN_INVALID_EXPORT"
  | "PLUGIN_INVALID_MANIFEST"
  | "PLUGIN_API_INCOMPATIBLE"
  | "PLUGIN_DEPENDENCY_MISSING"
  | "PLUGIN_DEPENDENCY_INCOMPATIBLE"
  | "PLUGIN_DEPENDENCY_CYCLE"
  | "PLUGIN_ACTIVATION_FAILED"
  | "PLUGIN_CONTRIBUTION_DUPLICATE"
  | "PLUGIN_ALIAS_DUPLICATE"
  | "PLUGIN_TARGET_INVALID"
  | "PLUGIN_CONFIGURATION_INVALID"
  | "PLUGIN_HOOK_FAILED";

export interface PluginDiagnosticContext {
  code: PluginDiagnosticCode;
  pluginId?: string;
  pluginModule?: string;
  contributionId?: string;
  targetId?: string;
  cause?: unknown;
}

export class PluginError extends Error implements PluginDiagnosticContext {
  readonly code: PluginDiagnosticCode;
  readonly pluginId?: string;
  readonly pluginModule?: string;
  readonly contributionId?: string;
  readonly targetId?: string;
  override readonly cause?: unknown;

  constructor(message: string, context: PluginDiagnosticContext) {
    super(message, { cause: context.cause });
    this.name = "PluginError";
    this.code = context.code;
    this.pluginId = context.pluginId;
    this.pluginModule = context.pluginModule;
    this.contributionId = context.contributionId;
    this.targetId = context.targetId;
    this.cause = context.cause;
  }
}

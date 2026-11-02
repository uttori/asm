/** Stable categories for host handling. Message text is intended for people, not matching. */
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

/** Available attribution for a failure. Fields are absent when the failing entity is not yet known. */
export interface PluginDiagnosticContext {
  /** Stable failure category for programmatic handling. */
  code: PluginDiagnosticCode;
  /** Manifest ID of the plugin responsible for the failure. */
  pluginId?: string;
  /** Configured specifier or resolved module URL supplied by the loading host. */
  pluginModule?: string;
  /** Contribution ID (or directive ID) involved in the failure. */
  contributionId?: string;
  /** Canonical or requested target ID involved in the failure. */
  targetId?: string;
  /** Original thrown value, retained for diagnostic chains. */
  cause?: unknown;
}

/** Structured plugin/configuration failure. Cleanup of multiple resources may instead throw AggregateError. */
export class PluginError extends Error implements PluginDiagnosticContext {
  /** Stable failure category for programmatic handling. */
  readonly code: PluginDiagnosticCode;
  /** Manifest ID of the plugin responsible, when known. */
  readonly pluginId?: string;
  /** Module specifier or URL the plugin was loaded from, when known. */
  readonly pluginModule?: string;
  /** Contribution ID involved in the failure, when known. */
  readonly contributionId?: string;
  /** Target ID involved in the failure, when known. */
  readonly targetId?: string;
  /** Original thrown value, also passed to the native Error cause. */
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

/** Stable categories for host handling; message text is intended for people, not matching. */
export type PluginDiagnosticCode = "PLUGIN_MODULE_NOT_FOUND" | "PLUGIN_INVALID_EXPORT" | "PLUGIN_INVALID_MANIFEST" | "PLUGIN_API_INCOMPATIBLE" | "PLUGIN_DEPENDENCY_MISSING" | "PLUGIN_DEPENDENCY_INCOMPATIBLE" | "PLUGIN_DEPENDENCY_CYCLE" | "PLUGIN_ACTIVATION_FAILED" | "PLUGIN_CONTRIBUTION_DUPLICATE" | "PLUGIN_ALIAS_DUPLICATE" | "PLUGIN_TARGET_INVALID" | "PLUGIN_CONFIGURATION_INVALID" | "PLUGIN_HOOK_FAILED";
/** Available attribution for a failure; fields are absent when the failing entity is not yet known. */
export interface PluginDiagnosticContext {
    code: PluginDiagnosticCode;
    pluginId?: string;
    /** Configured specifier or resolved module URL supplied by the loading host. */
    pluginModule?: string;
    contributionId?: string;
    targetId?: string;
    /** Original thrown value, retained for diagnostic chains. */
    cause?: unknown;
}
/** Structured plugin/configuration failure. Cleanup of multiple resources may instead throw AggregateError. */
export declare class PluginError extends Error implements PluginDiagnosticContext {
    readonly code: PluginDiagnosticCode;
    readonly pluginId?: string;
    readonly pluginModule?: string;
    readonly contributionId?: string;
    readonly targetId?: string;
    readonly cause?: unknown;
    constructor(message: string, context: PluginDiagnosticContext);
}
//# sourceMappingURL=diagnostics.d.ts.map
export type PluginDiagnosticCode = "PLUGIN_MODULE_NOT_FOUND" | "PLUGIN_INVALID_EXPORT" | "PLUGIN_INVALID_MANIFEST" | "PLUGIN_API_INCOMPATIBLE" | "PLUGIN_DEPENDENCY_MISSING" | "PLUGIN_DEPENDENCY_INCOMPATIBLE" | "PLUGIN_DEPENDENCY_CYCLE" | "PLUGIN_ACTIVATION_FAILED" | "PLUGIN_CONTRIBUTION_DUPLICATE" | "PLUGIN_ALIAS_DUPLICATE" | "PLUGIN_TARGET_INVALID" | "PLUGIN_CONFIGURATION_INVALID" | "PLUGIN_HOOK_FAILED";
export interface PluginDiagnosticContext {
    code: PluginDiagnosticCode;
    pluginId?: string;
    pluginModule?: string;
    contributionId?: string;
    targetId?: string;
    cause?: unknown;
}
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
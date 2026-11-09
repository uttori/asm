/** Structured plugin/configuration failure. Cleanup of multiple resources may instead throw AggregateError. */
export class PluginError extends Error {
    /** Stable failure category for programmatic handling. */
    code;
    /** Manifest ID of the plugin responsible, when known. */
    pluginId;
    /** Module specifier or URL the plugin was loaded from, when known. */
    pluginModule;
    /** Contribution ID involved in the failure, when known. */
    contributionId;
    /** Target ID involved in the failure, when known. */
    targetId;
    /** Original thrown value, also passed to the native Error cause. */
    cause;
    constructor(message, context) {
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
//# sourceMappingURL=diagnostics.js.map
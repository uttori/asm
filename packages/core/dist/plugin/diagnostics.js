export class PluginError extends Error {
    code;
    pluginId;
    pluginModule;
    contributionId;
    targetId;
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
/** Contract revision required by PluginManager; independent of npm package versions. */
export const PLUGIN_API_VERSION = 1;
/**
 * Preserve the plugin's option type without runtime validation.
 * @param {AssemblerPlugin<Options>} plugin Definition to expose as the module's default export.
 * @returns {AssemblerPlugin<Options>} The same plugin object, retaining its option type.
 */
export function definePlugin(plugin) {
    return plugin;
}
//# sourceMappingURL=contracts.js.map
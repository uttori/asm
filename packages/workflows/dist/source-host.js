import path from "node:path";
import plugin65xx from "@uttori/asm-plugin-65xx";
import { loadProjectEnvironment, fingerprintNodeToolchain } from "@uttori/asm-plugin-loader-node";
import snesPlugin from "@uttori/asm-plugin-snes";
/** Compose bundled plugins at the executable boundary. Registrations override built-ins by module ID. */
export function createSourceWorkflowHost(plugins = [], targets) {
    const bundledPlugins = new Map([
        ["@uttori/asm-plugin-snes", snesPlugin],
        ["@uttori/asm-plugin-65xx", plugin65xx],
        ...plugins,
    ]);
    return {
        targets,
        fingerprint: sourceToolchain,
        loadEnvironment: (configFile) => loadProjectEnvironment({ cwd: path.dirname(configFile), configFile, bundledPlugins }),
    };
}
export const defaultSourceHost = createSourceWorkflowHost();
export function sourceToolchain(plugins) {
    if (typeof UTTORI_SOURCE_BUNDLED !== "undefined" && UTTORI_SOURCE_BUNDLED) {
        return fingerprintNodeToolchain(plugins, [import.meta.url]);
    }
    return fingerprintNodeToolchain([import.meta.url, ...plugins]);
}
//# sourceMappingURL=source-host.js.map
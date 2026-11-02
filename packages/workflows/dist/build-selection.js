import fs from "node:fs";
import path from "node:path";
import { artifactHash } from "@uttori/asm-core/linker";
import { discoverProjectConfigurationPath, validateProjectConfiguration, } from "@uttori/asm-plugin-loader-node";
/** Read host metadata without activating plugins. Editor overrides resolve from the workspace; config paths resolve beside that config. */
export async function resolveAssemblyBuildSelection(directory, configFile, override) {
    if (override) {
        return { manifest: path.resolve(directory, override) };
    }
    const file = discoverProjectConfigurationPath(directory, configFile);
    if (!file) {
        return {};
    }
    if (fs.statSync(file).size > 16 * 1024 * 1024) {
        throw new Error("Build selection configuration exceeds 16 MiB.");
    }
    const bytes = await fs.promises.readFile(file);
    if (bytes.length > 16 * 1024 * 1024) {
        throw new Error("Build selection configuration exceeds 16 MiB.");
    }
    const config = validateProjectConfiguration(JSON.parse(bytes.toString("utf8")));
    const manifest = config.linkProject;
    return {
        configurationFile: file,
        configurationSha256: artifactHash(bytes),
        ...(manifest ? { manifest: path.resolve(path.dirname(file), manifest) } : {}),
    };
}
//# sourceMappingURL=build-selection.js.map
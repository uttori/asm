import fs from "node:fs";
import path from "node:path";
import { assertLinkRecipe } from "@uttori/asm-core/linker";
import { discoverProjectConfigurationPath } from "./configuration.js";
/** Recognize the exact data-only selector before activating plugins or interpreting portable recipe fields. */
export function isModuleRecipeSelection(value) {
    return (isRecord(value) &&
        value.from === "modules" &&
        isText(value.target) &&
        Object.keys(value).every((key) => key === "from" || key === "target"));
}
const isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
const isText = (value) => typeof value === "string" && value.trim().length > 0 && !value.includes("\0");
const isPaths = (value) => Array.isArray(value) && value.length <= 65536 && value.every(isText);
/** Validate the host graph before loading plugins. The linker independently validates every recipe field. */
function assertBuildManifest(value) {
    if (!isRecord(value) || value.format !== "uttori-build" || value.version !== 1) {
        throw new Error("Build manifest requires format uttori-build and version 1.");
    }
    const allowed = new Set([
        "$schema",
        "format",
        "version",
        "config",
        "modules",
        "objects",
        "libraries",
        "recipe",
        "outputDirectory",
        "outputName",
        "original",
    ]);
    for (const key of Object.keys(value)) {
        if (!allowed.has(key)) {
            throw new Error(`Unknown build manifest field '${key}'.`);
        }
    }
    for (const key of ["$schema", "config", "outputDirectory", "outputName", "original"]) {
        if (value[key] !== undefined && !isText(value[key])) {
            throw new Error(`Build ${key} must be a nonempty path or name.`);
        }
    }
    for (const key of ["objects", "libraries"]) {
        if (value[key] !== undefined && !isPaths(value[key])) {
            throw new Error(`Build ${key} must be an array of paths.`);
        }
    }
    if (typeof value.outputName === "string" &&
        (!/^[\w.-]+$/.test(value.outputName) || [".", "..", "build.json"].includes(value.outputName))) {
        throw new Error("Build outputName must be a plain filename other than build.json.");
    }
    if (value.modules !== undefined) {
        if (!Array.isArray(value.modules) || value.modules.length > 65536) {
            throw new Error("Build modules must be an array.");
        }
        const ids = new Set();
        for (const entry of value.modules) {
            if (!isRecord(entry) ||
                !isText(entry.id) ||
                !isText(entry.source) ||
                Object.keys(entry).some((key) => !["id", "source", "sourceAdapter"].includes(key)) ||
                (entry.sourceAdapter !== undefined &&
                    entry.sourceAdapter !== "asar" &&
                    entry.sourceAdapter !== "ca65")) {
                throw new Error("Each build module requires id, source and an optional supported sourceAdapter.");
            }
            if (ids.has(entry.id)) {
                throw new Error(`Duplicate build module '${entry.id}'.`);
            }
            ids.add(entry.id);
        }
    }
    if (!isText(value.recipe) && !isRecord(value.recipe)) {
        throw new Error("Build recipe must be a portable recipe object or JSON path.");
    }
    if (typeof value.recipe !== "string") {
        if (isModuleRecipeSelection(value.recipe)) {
            if (!Array.isArray(value.modules) || !value.modules.length) {
                throw new Error("A module-derived recipe requires source modules.");
            }
        }
        else {
            assertLinkRecipe(value.recipe);
        }
    }
}
/** Return an owned host graph; external recipe files are validated after their snapshot is read. */
export function readAssemblyBuildManifest(value) {
    assertBuildManifest(value);
    return structuredClone(value);
}
/** Data-only projection shared by module-aware indexing hosts; no plugin activation or assembly occurs. */
export function readAssemblyBuildConfiguration(manifestFile) {
    const file = path.resolve(manifestFile);
    const directory = path.dirname(file);
    const manifest = readAssemblyBuildManifest(readBuildJson(file));
    const recipeFile = typeof manifest.recipe === "string" ? path.resolve(directory, manifest.recipe) : undefined;
    const recipe = recipeFile ? readBuildJson(recipeFile) : manifest.recipe;
    if (!isModuleRecipeSelection(recipe)) {
        assertLinkRecipe(recipe);
    }
    const configFile = discoverProjectConfigurationPath(directory, manifest.config);
    const moduleRoots = {};
    for (const module of manifest.modules ?? []) {
        const source = path.resolve(directory, module.source);
        // Repeated source with distinct module IDs has the same syntax/configuration; one root
        // analysis is sufficient, while the build driver still assembles every contribution.
        moduleRoots[source] ??= {
            id: module.id,
            ...(module.sourceAdapter ? { sourceAdapter: module.sourceAdapter } : {}),
        };
    }
    return {
        directory,
        configFile,
        target: recipe.target,
        moduleRoots,
        inputs: [file, ...(recipeFile ? [recipeFile] : []), ...(configFile ? [configFile] : [])],
    };
}
/** Bound data-only metadata before parsing, including a file that grows between stat and read. */
function readBuildJson(input) {
    if (fs.statSync(input).size > 16 * 1024 * 1024) {
        throw new Error(`Build JSON exceeds 16 MiB: ${input}`);
    }
    const bytes = fs.readFileSync(input);
    if (bytes.length > 16 * 1024 * 1024) {
        throw new Error(`Build JSON exceeds 16 MiB: ${input}`);
    }
    return JSON.parse(bytes.toString("utf8"));
}
//# sourceMappingURL=build-configuration.js.map
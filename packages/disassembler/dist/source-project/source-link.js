import path from "node:path";
import { AddressToLineMapping, parseExpressionNode, } from "@uttori/asm-core";
import { canonicalJson } from "@uttori/asm-core/canonical-json";
import { artifactHash, assertLinkRecipe, encodeObject, linkObjects, } from "@uttori/asm-core/linker";
import { assertSourcePath } from "./git.js";
/** Narrow parsed JSON to a plain object record. */
const isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
/** Read the generated single-unit manifest through the caller's snapshot provider. Custom multi-unit builds use the ordinary build service. */
export function readSourceLinkBuild(configuration, configFile, entrySource, read) {
    if (configuration.linkProject === undefined) {
        return undefined;
    }
    if (typeof configuration.linkProject !== "string" || !configuration.linkProject.trim()) {
        throw new Error("Source linkProject must be a manifest path.");
    }
    const dependencies = [];
    const json = (file) => {
        const bytes = read(file);
        if (bytes.length > 16 * 1024 * 1024) {
            throw new Error(`Source link JSON exceeds 16 MiB: ${file}`);
        }
        dependencies.push({ path: file, sha256: artifactHash(bytes) });
        return JSON.parse(Buffer.from(bytes).toString("utf8"));
    };
    if (canonicalJson(json(configFile)) !== canonicalJson(configuration)) {
        throw new Error("Source compiler configuration changed during link selection.");
    }
    const manifestFile = path.resolve(path.dirname(configFile), configuration.linkProject);
    const manifest = json(manifestFile);
    if (!isRecord(manifest) ||
        manifest.format !== "uttori-build" ||
        manifest.version !== 1 ||
        !Array.isArray(manifest.modules) ||
        manifest.modules.length !== 1 ||
        manifest.objects !== undefined ||
        manifest.libraries !== undefined) {
        throw new Error("Git source builds require a generated single-module linked manifest.");
    }
    // A source project owns publication and pristine checks. Reject graph fields this route cannot honor
    // rather than silently skipping serialized inputs, a different compiler configuration, or an equality policy.
    const allowed = new Set([
        "$schema",
        "format",
        "version",
        "config",
        "modules",
        "recipe",
        "outputDirectory",
        "outputName",
    ]);
    if (Object.keys(manifest).some((key) => !allowed.has(key)) ||
        typeof manifest.config !== "string" ||
        path.resolve(path.dirname(manifestFile), manifest.config) !== path.resolve(configFile)) {
        throw new Error("Source link manifest must use the selected compiler configuration and generated source graph.");
    }
    const module = manifest.modules[0];
    if (!isRecord(module) ||
        typeof module.id !== "string" ||
        !module.id.trim() ||
        typeof module.source !== "string" ||
        path.resolve(path.dirname(manifestFile), module.source) !== path.resolve(entrySource) ||
        (module.sourceAdapter !== undefined &&
            module.sourceAdapter !== "asar" &&
            module.sourceAdapter !== "ca65")) {
        throw new Error("Source link manifest must select the configured entry point and a stable module ID.");
    }
    if (Object.keys(module).some((key) => !["id", "source", "sourceAdapter"].includes(key))) {
        throw new Error("Unsupported source module selection.");
    }
    let recipe = manifest.recipe;
    if (typeof recipe === "string") {
        const recipeFile = path.resolve(path.dirname(manifestFile), recipe);
        recipe = json(recipeFile);
    }
    assertLinkRecipe(recipe);
    return {
        module: {
            id: module.id,
            ...(module.sourceAdapter ? { sourceAdapter: module.sourceAdapter } : {}),
        },
        recipe,
        dependencies,
    };
}
/** Preserve a reviewed source entry-point rename in both the immutable export and its portable manifest. */
export function sourceLinkEntry(configuration) {
    if (!isRecord(configuration) ||
        !Array.isArray(configuration.entryPoints) ||
        configuration.entryPoints.length !== 1 ||
        typeof configuration.entryPoints[0] !== "string") {
        throw new Error("Linked source generation requires one portable entry point.");
    }
    assertSourcePath(configuration.entryPoints[0]);
    return configuration.entryPoints[0];
}
/** Add the migration selector without reformatting unrelated configuration or changing future unchanged generations. */
function selectLinkedConfiguration(bytes, parsed) {
    if (parsed.linkProject === "build.json") {
        return bytes;
    }
    const text = Buffer.from(bytes).toString("utf8");
    if (parsed.linkProject !== undefined) {
        return Buffer.from(JSON.stringify({ ...parsed, linkProject: "build.json" }, null, 2) + "\n");
    }
    const close = text.lastIndexOf("}");
    const body = text.slice(0, close).trimEnd();
    const multiline = body.includes("\n");
    const indent = /\n([\t ]+)"/.exec(text)?.[1] ?? "  ";
    const comma = Object.keys(parsed).length ? "," : "";
    const line = multiline
        ? `\n${indent}"linkProject": "build.json"\n`
        : '"linkProject":"build.json"';
    return Buffer.from(body + comma + line + text.slice(close));
}
/** Generated configuration and portable recipe enter the same reviewed Git payload as the bank sources. */
export function sourceLinkFiles(configuration, moduleId, recipe, sourceRoot = "source") {
    const parsed = JSON.parse(Buffer.from(configuration).toString("utf8"));
    if (!isRecord(parsed)) {
        throw new Error("Source configuration must be an object.");
    }
    const entrySource = sourceLinkEntry(parsed);
    assertSourcePath(sourceRoot);
    assertLinkRecipe(recipe);
    if (!moduleId.trim()) {
        throw new Error("Source migration requires a stable module ID.");
    }
    return [
        {
            path: "uttori-asm.config.json",
            bytes: selectLinkedConfiguration(configuration, parsed),
        },
        { path: "link-recipe.json", bytes: Buffer.from(canonicalJson(recipe)) },
        {
            path: "build.json",
            bytes: Buffer.from(canonicalJson({
                format: "uttori-build",
                version: 1,
                config: "uttori-asm.config.json",
                modules: [{ id: moduleId, source: entrySource }],
                recipe: "link-recipe.json",
                outputDirectory: path.posix.relative(sourceRoot, ".uttori-local/linked"),
            })),
        },
    ];
}
/** Serialize before linking so pristine verification exercises the same object boundary as standalone builds. */
export function linkSourceAssembly(assembler, build, signal, references = []) {
    const policy = assembler.environment.getTarget(assembler.targetId)?.createLinkTarget?.();
    if (!policy) {
        throw new Error("Source target does not provide a link policy.");
    }
    const module = assembler.getAssemblyModule();
    const known = new Set(module.symbols.map((symbol) => symbol.name));
    const source = { file: assembler.currentFile, line: 1, architecture: assembler.arch };
    // Host extent contracts can name structured members that are not ordinary labels. Retain them as
    // local expression aliases so the same linker resolves them after placement, without numeric fallback.
    const aliases = [...new Set(references)]
        .filter((name) => !known.has(name))
        .map((name) => ({
        name,
        visibility: "local",
        source,
        value: assembler.compileLinkExpression(parseExpressionNode(name)),
    }));
    return linkObjects({
        objects: [encodeObject({ ...module, symbols: [...module.symbols, ...aliases] })],
        recipe: build.recipe,
        target: policy,
        signal,
    });
}
/** Rehydrate final linker provenance for existing layout/asset checks; outputBias is the container prefix size in bytes. */
export function sourceMappingFromLink(result, root, outputBias = 0) {
    if (!Number.isSafeInteger(outputBias) || outputBias < 0 || outputBias > result.output.length) {
        throw new Error("Invalid source container prefix size.");
    }
    const mapping = new AddressToLineMapping();
    const map = result.debugMap;
    // Source IDs already name the linker's sorted dependency table. Reusing them keeps assets and
    // structured fields attached to the same snapshots without another source read or address guess.
    for (const source of map.sources) {
        mapping.fileList[source.id] = {
            name: path.resolve(root, source.path),
            size: source.size,
            sha256: source.sha256,
            crc: source.crc32,
        };
    }
    // Object rest already owns these records; update that copy instead of allocating a second one.
    mapping.ranges = map.ranges.map(({ sourceId, ...range }) => Object.assign(range, {
        fileIdx: sourceId,
        ...(range.outputStart === undefined
            ? {}
            : {
                outputStart: range.outputStart - outputBias,
                outputEnd: range.outputEnd - outputBias,
            }),
    }));
    mapping.instructions = (map.instructions ?? []).map(({ sourceId, ...instruction }) => Object.assign(instruction, {
        fileIdx: sourceId,
        ...(instruction.outputOffset === undefined
            ? {}
            : { outputOffset: instruction.outputOffset - outputBias }),
    }));
    mapping.assets = (map.assets ?? []).map(({ sourceId, assetSourceId, ...asset }) => Object.assign(asset, {
        fileIdx: sourceId,
        assetFileIdx: assetSourceId,
        ...(asset.outputOffset === undefined
            ? {}
            : { outputOffset: asset.outputOffset - outputBias }),
    }));
    mapping.structFields = (map.fields ?? []).map(({ sourceId, ...field }) => Object.assign(field, {
        fileIdx: sourceId,
        outputOffset: field.outputOffset - outputBias,
    }));
    return mapping;
}
//# sourceMappingURL=source-link.js.map
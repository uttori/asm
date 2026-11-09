import { assertLinkRecipe } from "@uttori/asm-core/linker";
export { readAssemblyBuildManifest, } from "@uttori/asm-plugin-loader-node/build-configuration";
/** Authenticate the small worker receipt before an editor can launch the returned ROM. */
function assertBuildResult(value) {
    if (!isRecord(value) || !isText(value.outputFile)) {
        throw new Error("Invalid assembly build receipt.");
    }
    if (value.kind === "object" || value.kind === "library") {
        if (value.linkRecipe !== undefined) {
            assertLinkRecipe(value.linkRecipe);
        }
        if (typeof value.bytes === "number" &&
            Number.isSafeInteger(value.bytes) &&
            value.bytes >= 0 &&
            isHash(value.sha256)) {
            return;
        }
    }
    else if (value.kind === "linked") {
        const strings = ["debugMapFile", "symbolsFile", "allocationFile", "target", "architecture"];
        if (strings.every((key) => isText(value[key])) &&
            (value.recipeFile === undefined || isText(value.recipeFile)) &&
            [value.inputSha256, value.outputSha256, value.debugMapFingerprint].every(isHash) &&
            typeof value.outputSize === "number" &&
            Number.isSafeInteger(value.outputSize) &&
            value.outputSize > 0 &&
            typeof value.outputChanged === "boolean" &&
            typeof value.debugMapChanged === "boolean" &&
            Array.isArray(value.inputs) &&
            value.inputs.length <= 65536 &&
            value.inputs.every((input) => isRecord(input) && isText(input.path) && isHash(input.sha256))) {
            return;
        }
    }
    throw new Error("Invalid assembly build receipt.");
}
/** Return a validated receipt without retaining mutable data owned by an IPC caller. */
export function readAssemblyBuildResult(value) {
    assertBuildResult(value);
    return structuredClone(value);
}
/** True for a plain object that can hold JSON object fields. */
const isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
/** True for a nonempty string that contains no NUL. */
const isText = (value) => typeof value === "string" && value.trim().length > 0 && !value.includes("\0");
/** True for a 64-character lowercase hex SHA-256 digest. */
const isHash = (value) => typeof value === "string" && /^[\da-f]{64}$/.test(value);
/** True for an array of nonempty path strings, capped at 65,536 entries. */
const isPaths = (value) => Array.isArray(value) && value.length <= 65536 && value.every(isText);
/** Fail closed at the process boundary; misspelled fields must never silently discard build policy. */
function assertBuildOperation(value) {
    if (!isRecord(value) || !isText(value.directory)) {
        throw new Error("Assembly operation requires a working directory.");
    }
    let allowed;
    if (value.action === "assemble-object") {
        allowed = ["source", "output", "module", "config", "sourceAdapter"];
        if (![value.source, value.output, value.module].every(isText)) {
            throw new Error("Object assembly requires source, output and a stable module ID.");
        }
        if (value.config !== undefined && !isText(value.config)) {
            throw new Error("Object configuration must be a path.");
        }
        if (value.sourceAdapter !== undefined &&
            value.sourceAdapter !== "asar" &&
            value.sourceAdapter !== "ca65") {
            throw new Error("Unsupported object sourceAdapter.");
        }
    }
    else if (value.action === "library") {
        allowed = ["objects", "output"];
        if (!isPaths(value.objects) || value.objects.length === 0 || !isText(value.output)) {
            throw new Error("Library creation requires output and one or more object paths.");
        }
    }
    else if (value.action === "link" || value.action === "build-linked") {
        allowed = ["manifest", "selection"];
        if (!isText(value.manifest)) {
            throw new Error("Link/build requires a build manifest path.");
        }
        if (value.selection !== undefined &&
            (!isRecord(value.selection) ||
                !isText(value.selection.file) ||
                !isHash(value.selection.sha256) ||
                Object.keys(value.selection).some((key) => key !== "file" && key !== "sha256"))) {
            throw new Error("Invalid build selection snapshot.");
        }
    }
    else {
        throw new Error("Unknown assembly build action.");
    }
    for (const key of Object.keys(value)) {
        if (!["action", "directory", ...allowed].includes(key)) {
            throw new Error(`Assembly ${value.action} does not accept ${key}.`);
        }
    }
}
/** Copy the validated request so subsequent caller edits cannot change an asynchronous build. */
export function readAssemblyBuildOperation(value) {
    assertBuildOperation(value);
    return structuredClone(value);
}
//# sourceMappingURL=build-contracts.js.map
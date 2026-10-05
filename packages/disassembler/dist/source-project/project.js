import fs from "node:fs";
import path from "node:path";
import { canonicalJson } from "@uttori/asm-core/canonical-json";
import { openAnalysisProjectStore } from "../project/project-store.js";
import { readResearchInputs } from "../research-inputs/inputs.js";
import { sourceFilePublicationEpoch } from "./file-transaction.js";
import { sourceContentHash } from "./generation.js";
import { assertSourcePath, sourceRepository } from "./git.js";
/** Check runtime shape without widening typed readonly arrays to any[]. */
function isUnknownArray(value) {
    return Array.isArray(value);
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isSafeInteger(value) {
    return typeof value === "number" && Number.isSafeInteger(value);
}
function assertSourceProjectConfiguration(value) {
    if (!isRecord(value)) {
        throw new Error("Invalid Git source project configuration.");
    }
    const id = value.id;
    const target = value.target;
    const romSha256 = value.romSha256;
    const sourceRoots = value.sourceRoots;
    const researchRoots = value.researchRoots;
    if (value.format !== "uttori-source-project" ||
        value.version !== 1 ||
        typeof id !== "string" ||
        !/^[\w.-]+$/.test(id) ||
        typeof target !== "string" ||
        target === "" ||
        typeof romSha256 !== "string" ||
        !/^[\da-f]{64}$/.test(romSha256) ||
        !isUnknownArray(sourceRoots) ||
        sourceRoots.length === 0 ||
        !isUnknownArray(researchRoots) ||
        researchRoots.length === 0) {
        throw new Error("Invalid Git source project configuration.");
    }
    for (const name of [
        ...sourceRoots,
        ...researchRoots,
        value.buildConfig,
        value.layout,
        value.captures,
    ]) {
        if (typeof name !== "string") {
            throw new Error("Source project paths must be strings.");
        }
        assertSourcePath(name);
    }
    if (value.limits !== undefined) {
        if (!isRecord(value.limits)) {
            throw new Error("Source work limits must be an object.");
        }
        for (const [name, limit] of Object.entries(value.limits)) {
            if ((name !== "captureBytes" && name !== "analysisWorkItems" && name !== "analysisCallDepth") ||
                !(isSafeInteger(limit) && limit >= (name === "analysisCallDepth" ? 0 : 1))) {
                throw new Error(`Invalid source work limit: ${name}. Use an integer within the supported range.`);
            }
        }
    }
}
/** Validate portable paths and identity before running any project-specific tool. */
export function parseSourceProject(value) {
    assertSourceProjectConfiguration(value);
    return value;
}
/** Discover only the selected repository's project; nested repositories cannot inherit a parent's identity. */
export async function openSourceProject(directory) {
    const repository = await sourceRepository(directory);
    sourceFilePublicationEpoch(repository);
    const configuration = parseSourceProject(JSON.parse(fs.readFileSync(path.join(repository.root, ".uttori/project.json"), "utf8")));
    const research = readResearchInputs(repository.root, configuration.researchRoots, {
        project: configuration.id,
        romSha256: configuration.romSha256,
    });
    return {
        repository,
        configuration,
        research,
        configurationSha256: sourceContentHash(canonicalJson(configuration)),
    };
}
/** Resolve private input locations without accepting them as tracked source configuration. */
export function sourceProjectLocalInputs(project) {
    return readSourceProjectLocalInputs(project.repository.root);
}
function assertSourceProjectLocalInputs(value) {
    if (!isRecord(value) ||
        value.format !== "uttori-source-local" ||
        value.version !== 1 ||
        typeof value.rom !== "string" ||
        value.rom === "" ||
        typeof value.evidence !== "string" ||
        value.evidence === "") {
        throw new Error("Configure the local ROM and evidence paths before running this source project.");
    }
}
/** Read only the local bindings; research queries do not need to spawn Git or load the ROM. */
export function readSourceProjectLocalInputs(root) {
    const local = JSON.parse(fs.readFileSync(path.join(root, ".uttori-local/project.json"), "utf8"));
    assertSourceProjectLocalInputs(local);
    return {
        ...local,
        rom: path.resolve(root, local.rom),
        evidence: path.resolve(root, local.evidence),
    };
}
/** Refresh the rebuildable metadata index before research queries, imports, or pure generation. */
export function synchronizeSourceResearch(project) {
    const local = sourceProjectLocalInputs(project);
    const store = openAnalysisProjectStore(local.evidence);
    try {
        const changed = store.transaction(() => store.synchronizeResearchInputs(project.research));
        if (changed) {
            store.writePointer(local.evidence);
        }
        return changed;
    }
    finally {
        store.close();
    }
}
//# sourceMappingURL=project.js.map
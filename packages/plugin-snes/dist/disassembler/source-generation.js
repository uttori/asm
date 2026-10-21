import fs from "node:fs";
import path from "node:path";
import { canonicalJson } from "@uttori/asm-core/canonical-json";
import { RomImage, openAnalysisProjectStore, validateProjectRom } from "@uttori/asm-disassembler";
import { assertSourcePath, sourceGit, retainSourceGeneration, sourceContentHash, verifySourceGeneration, createSourceInputSnapshot, createSourceScratch, } from "@uttori/asm-disassembler/source-project";
import { lostCodeRanges } from "./code-preservation.js";
import { buildSnesSource } from "./source-build.js";
import { exportSnes65816Source } from "./source-export.js";
import { readGenerationBlobs } from "./source-generation-blobs.js";
import { validateSnesStructMap } from "./struct-map.js";
/** Exact render options include recipe contents and the pristine-asset selection, not host paths. */
export function snesGenerationOptionsHash(options) {
    return sourceContentHash(canonicalJson({
        sourceRoot: options.sourceRoot,
        recipes: options.recipes
            .map((file) => ({ path: file.path, sha256: sourceContentHash(file.bytes) }))
            .toSorted((a, b) => Buffer.compare(Buffer.from(a.path), Buffer.from(b.path))),
        pristineAssets: [...options.pristineAssets].toSorted((a, b) => Buffer.compare(Buffer.from(a.path), Buffer.from(b.path))),
        codeWithdrawals: options.codeWithdrawals ?? [],
    }));
}
/**
 * Accepts a JSON object. Arrays and null are not coverage contracts.
 * @param {unknown} value Parsed JSON.
 * @returns {boolean} True when `value` is a non-array object.
 */
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
/**
 * Accepts one half-open ROM interval from a coverage contract.
 * @param {unknown} value Candidate range.
 * @returns {boolean} True when start and end are numbers.
 */
function isCodeRange(value) {
    return isRecord(value) && typeof value.start === "number" && typeof value.end === "number";
}
/**
 * Accepts the accepted generation's code coverage contract.
 * @param {unknown} value Parsed `source-code.json`.
 * @returns {boolean} True for format `uttori-source-code` version 1 with numeric ranges.
 */
function isSourceCodeContract(value) {
    return (isRecord(value) &&
        value.format === "uttori-source-code" &&
        value.version === 1 &&
        typeof value.romSha256 === "string" &&
        Array.isArray(value.ranges) &&
        value.ranges.every(isCodeRange));
}
/**
 * Render one pinned analysis snapshot in an owned temporary directory, verify the original ROM,
 * then retain only its immutable Git payload. No evidence/capture directory is copied and the
 * source checkout/index remain untouched. Failed candidates never acquire a retained Git ref.
 */
export async function prepareSnesGeneration(options) {
    assertSourcePath(options.sourceRoot);
    options.signal?.throwIfAborted();
    if (snesGenerationOptionsHash(options) !== options.inputs.optionsSha256) {
        throw new Error("Generation recipe identity changed.");
    }
    // Validate captured bytes before staging them in disposable scratch. A worker forwards only the
    // message, so failures must identify the editable recipe rather than a folder removed on failure.
    const structRecipe = options.recipes.find((recipe) => recipe.path === "struct-map.json");
    if (structRecipe) {
        try {
            validateSnesStructMap(JSON.parse(Buffer.from(structRecipe.bytes).toString("utf8")));
        }
        catch (error) {
            const file = path.join(options.repository.root, options.sourceRoot, structRecipe.path);
            const detail = error instanceof Error ? error.message : String(error);
            throw new Error(`Invalid SNES struct map ${file}: ${detail} Correct this input before regenerating.`, { cause: error });
        }
    }
    options.onProgress?.("Verifying the accepted generation's immutable payload.");
    const prior = await verifySourceGeneration(options.repository, options.parent);
    if (prior.descriptor.inputs.project !== options.inputs.project ||
        prior.descriptor.inputs.romSha256 !== options.inputs.romSha256) {
        throw new Error("Prepare regeneration from the accepted project/ROM lineage.");
    }
    const scratch = createSourceScratch(options.repository, "prepare");
    const temporary = scratch.directory;
    const source = path.join(temporary, options.sourceRoot);
    const generated = new Map();
    const write = (file) => {
        assertSourcePath(file.path);
        if (generated.has(file.path)) {
            throw new Error(`Duplicate generation output: ${file.path}`);
        }
        const target = path.join(temporary, file.path);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, file.bytes);
        generated.set(file.path, file);
    };
    let openedStore;
    try {
        const store = openAnalysisProjectStore(options.evidenceDirectory);
        openedStore = store;
        const recipeNames = new Set();
        for (const recipe of options.recipes) {
            if (![
                "ram-map.json",
                "struct-map.json",
                "asset-includes.json",
                "uttori-asm.config.json",
            ].includes(recipe.path) ||
                recipeNames.has(recipe.path)) {
                throw new Error(`Unknown or repeated source recipe: ${recipe.path}`);
            }
            recipeNames.add(recipe.path);
            const target = path.join(source, recipe.path);
            fs.mkdirSync(path.dirname(target), { recursive: true });
            fs.writeFileSync(target, recipe.bytes);
        }
        if (!recipeNames.has("ram-map.json") || !recipeNames.has("uttori-asm.config.json")) {
            throw new Error("Generation requires explicit RAM map and build configuration.");
        }
        // SQL keeps the complete runtime history out of JS. The iterator is consumed while this
        // snapshot is open so another evidence import cannot mix instruction variants into the render.
        options.onProgress?.("Preparing indexed evidence and exporting source.");
        const { manifest, rom } = store.sourceExportSnapshot((instructionGroups) => {
            const project = store.sourceExportView();
            if (sourceContentHash(canonicalJson(project.manifest)) !== options.inputs.evidenceSha256 ||
                store.researchInputsIdentity() !== options.inputs.researchSha256) {
                throw new Error("Evidence or indexed research changed before pure rendering. Prepare a fresh input snapshot.");
            }
            const loadedRom = RomImage.load(options.romFile, {
                headerSize: project.manifest.rom.headerSize,
            });
            validateProjectRom(project.manifest, loadedRom);
            if (loadedRom.identity.contentSha256 !== options.inputs.romSha256) {
                throw new Error("Generation ROM content identity changed.");
            }
            const exportedManifest = exportSnes65816Source(project, loadedRom, source, {
                sourceProjectSha256: sourceContentHash(canonicalJson(project.manifest)),
                instructionGroups,
                emitFile: (file) => {
                    options.signal?.throwIfAborted();
                    // Reports are disposable diagnostics, not editable source or merge inputs.
                    if (file.path === "annotation-report.json") {
                        return;
                    }
                    write({ path: `${options.sourceRoot}/${file.path}`, bytes: file.bytes });
                },
            });
            return { manifest: exportedManifest, rom: loadedRom };
        }, options.signal);
        const priorFiles = new Map(prior.files.map((file) => [file.path, file]));
        const priorCode = priorFiles.get(`${options.sourceRoot}/source-code.json`);
        if (!priorCode) {
            throw new Error("Adopt a verified source baseline with a code coverage contract before regeneration.");
        }
        let withdrawnCode;
        {
            const code = JSON.parse((await sourceGit(options.repository.root, ["cat-file", "blob", priorCode.blob])).stdout.toString("utf8"));
            if (!isSourceCodeContract(code) || code.romSha256 !== rom.identity.contentSha256) {
                throw new Error("Accepted generation has an invalid code coverage contract.");
            }
            withdrawnCode = lostCodeRanges(code.ranges, manifest.spans.filter((span) => span.role === "code"));
            const approvals = options.codeWithdrawals ?? [];
            for (const approval of approvals) {
                if (!Number.isSafeInteger(approval.start) ||
                    !Number.isSafeInteger(approval.end) ||
                    approval.start < 0 ||
                    approval.end > rom.length ||
                    approval.end <= approval.start ||
                    typeof approval.reason !== "string" ||
                    !approval.reason.trim()) {
                    throw new Error("Code withdrawal needs a bounded ROM interval and a research reason.");
                }
            }
            const unresolved = lostCodeRanges(withdrawnCode, approvals);
            if (unresolved.length) {
                throw new Error(`Generation withdraws previously emitted code at $${unresolved[0].start.toString(16)}. Resolve the evidence or record reviewed intervals and reasons in codeWithdrawals.`);
            }
        }
        options.onProgress?.("Reading and checking pristine assets from immutable Git blobs.");
        const assets = options.pristineAssets.map((asset) => {
            const name = asset.path;
            assertSourcePath(name);
            if (!name.startsWith(`${options.sourceRoot}/assets/`)) {
                throw new Error(`Pristine asset is outside this source projection: ${name}`);
            }
            if (asset.originalBlob !== undefined) {
                if (asset.romRange || !/^(?:[\da-f]{40}|[\da-f]{64})$/.test(asset.originalBlob)) {
                    throw new Error(`Invalid original asset blob declaration for ${name}.`);
                }
                // Admission pins reviewed bytes, not a path that an editor can mutate during preparation.
                // The full original-ROM build below must succeed before any candidate is retained.
                return { asset, blob: asset.originalBlob };
            }
            else if (asset.romRange) {
                const { start, end } = asset.romRange;
                if (!Number.isSafeInteger(start) ||
                    !Number.isSafeInteger(end) ||
                    start < 0 ||
                    end <= start ||
                    end > rom.length) {
                    throw new Error(`Invalid original ROM extraction for ${name}.`);
                }
                return { asset, bytes: rom.read(start, end - start) };
            }
            else {
                const priorFile = priorFiles.get(name);
                if (!priorFile || priorFile.sha256 !== asset.sha256) {
                    throw new Error(`Asset needs original-ROM extraction and verification before adoption: ${name}`);
                }
                return { asset, blob: priorFile.blob };
            }
        });
        const blobs = await readGenerationBlobs(options.repository, assets.flatMap((entry) => (entry.blob ? [entry.blob] : [])), options.signal);
        for (const entry of assets) {
            const { asset } = entry;
            const bytes = entry.bytes ?? blobs.get(entry.blob);
            // Every admission route verifies immutable inputs. Working source edits are
            // merged separately; no mutable PNG, stream or resource path is reread here.
            if (sourceContentHash(bytes) !== asset.sha256) {
                throw new Error(`Pristine asset content does not match its declared identity: ${asset.path}`);
            }
            write({ path: asset.path, bytes });
        }
        // Configuration is a build input on both histories. Research maps remain owned by the source
        // branch and are retained there through the explicit checkpoint required before applying.
        const configuration = options.recipes.find((file) => file.path === "uttori-asm.config.json");
        write({ path: `${options.sourceRoot}/${configuration.path}`, bytes: configuration.bytes });
        options.onProgress?.("Assembling generated source and verifying original-ROM equality.");
        const loaded = await options.loadEnvironment(path.join(source, configuration.path));
        let build;
        try {
            build = buildSnesSource({
                root: temporary,
                entrySource: `${options.sourceRoot}/main.asm`,
                environment: loaded.environment,
                includePaths: loaded.includePaths,
                targetOptions: { ...loaded.targetOptions, checksumEnabled: false, checksumMode: "asar" },
                expectedSize: rom.length,
                originalContent: rom.read(0, rom.length),
                rawBlocks: {
                    directory: `${options.sourceRoot}/assets/raw`,
                    original: rom.read(0, rom.length),
                    blockSize: 0x1000,
                },
                outputDirectory: path.join(temporary, "build"),
                toolchainSha256: options.inputs.toolchainSha256,
                configurationSha256: sourceContentHash(configuration.bytes),
                signal: options.signal,
            });
        }
        finally {
            await loaded.dispose();
        }
        options.onProgress?.("Retaining the verified immutable generation in Git.");
        const generation = await retainSourceGeneration(options.repository, {
            files: [...generated.values(), createSourceInputSnapshot(options.inputFiles)],
            inputs: options.inputs,
            parent: options.parent,
            signal: options.signal,
        });
        return {
            generation,
            verification: build.verification,
            files: generated.size,
            codeBytes: manifest.spans
                .filter((span) => span.role === "code")
                .reduce((sum, span) => sum + span.end - span.start, 0),
            withdrawnCode,
        };
    }
    finally {
        try {
            openedStore?.close();
        }
        finally {
            scratch.dispose();
        }
    }
}
//# sourceMappingURL=source-generation.js.map
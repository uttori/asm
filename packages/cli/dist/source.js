import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { canonicalJson } from "@uttori/asm-core/canonical-json";
import { RomImage, openSourceProject, sourceProjectLocalInputs, synchronizeSourceResearch, openAnalysisProjectStore, sourceContentHash, pinSourceCandidate, acceptedSourceGeneration, verifySourceGeneration, sourceGit, sourceStatus, sourceMergeStatus, previewSourceGeneration, applySourceGeneration, finishSourceGeneration, abortSourceGeneration, discardSourceGeneration, pruneSourceScratch, pruneSourcePins, assertSourcePath, assertSourceObjectId, readResearchInputs, openRuntimeCaptureSource, importRuntimeTraceSourceIntoProject, importRuntimeBusTraceSourceIntoProject, readSourceCaptureCatalog, reconcileSourceCaptureCatalog, writeSourceCaptureCatalog, fingerprintSourceCapture, pendingCaptureImportNotes, completeCaptureImportNotes, writeCaptureImportNotes, } from "@uttori/asm-disassembler";
import { loadProjectEnvironment, fingerprintNodeToolchain } from "@uttori/asm-plugin-loader-node";
import snesPlugin, { buildSnesSource, prepareSnesGeneration, snesGenerationOptionsHash, analyzeSnesProject, SNES_MAPPERS, prepareSnesSourceExpansion, prepareSnesSourceRelocation, createSnesAddressContext, snesRomAddressSpace, } from "@uttori/asm-plugin-snes";
import { initializeSnesSourceProject } from "./source-init.js";
import { prepareSourceResearch } from "./source-research.js";
/** Built-in SNES support remains available in a packaged CLI/VSIX without development node_modules. */
const loadSourceEnvironment = (configFile) => loadProjectEnvironment({
    cwd: path.dirname(configFile),
    configFile,
    bundledPlugins: new Map([["@uttori/asm-plugin-snes", snesPlugin]]),
});
function sourceToolchain(plugins) {
    if (typeof UTTORI_SOURCE_BUNDLED !== "undefined" && UTTORI_SOURCE_BUNDLED) {
        return fingerprintNodeToolchain(plugins, [import.meta.url]);
    }
    return fingerprintNodeToolchain([import.meta.url, ...plugins]);
}
/** Read compact contracts with explicit size limits before parsing untrusted workspace JSON. */
function readJson(file) {
    if (fs.statSync(file).size > 8 * 1024 * 1024) {
        throw new Error(`Project contract is too large: ${file}`);
    }
    return JSON.parse(fs.readFileSync(file, "utf8"));
}
/** Non-authoritative cache: a torn write must not replace the last complete preview. */
function savePreview(project, preview) {
    const directory = project.repository.stateDirectory;
    fs.mkdirSync(directory, { recursive: true });
    const temporary = path.join(directory, `preview-${randomUUID()}.tmp`);
    try {
        fs.writeFileSync(temporary, canonicalJson(preview));
        fs.renameSync(temporary, path.join(directory, "preview.json"));
    }
    finally {
        fs.rmSync(temporary, { force: true });
    }
}
/** A retained Git object supplies its descriptor and tree; callers cannot fabricate its payload. */
async function candidateGeneration(project, commit) {
    assertSourceObjectId(commit);
    const { descriptor } = await verifySourceGeneration(project.repository, commit);
    const tree = (await sourceGit(project.repository.root, ["rev-parse", `${commit}^{tree}`])).stdout
        .toString("utf8")
        .trim();
    const ref = await pinSourceCandidate(project.repository, commit);
    return { commit, tree, ref, descriptor };
}
function sourceActionName(action) {
    return action;
}
function assertSourceLayout(value, romSha256) {
    if (typeof value !== "object" ||
        value === null ||
        !("format" in value) ||
        value.format !== "uttori-snes-layout" ||
        !("version" in value) ||
        value.version !== 1 ||
        !("romSha256" in value) ||
        value.romSha256 !== romSha256 ||
        !("size" in value) ||
        typeof value.size !== "number" ||
        !Number.isSafeInteger(value.size) ||
        value.size <= 0 ||
        !("states" in value) ||
        !isUnknownArray(value.states) ||
        !("extents" in value) ||
        !isUnknownArray(value.extents)) {
        throw new Error("Invalid SNES source layout contract.");
    }
}
function isUnknownArray(value) {
    return Array.isArray(value);
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isSnesMapper(value) {
    return SNES_MAPPERS.some((mapper) => mapper === value);
}
function isExpandableMapper(value) {
    return value === "lorom" || value === "hirom";
}
function isStringArray(value) {
    return Array.isArray(value) && value.every((item) => typeof item === "string");
}
function assertSourceMergePreview(value) {
    if (!isRecord(value) ||
        typeof value.head !== "string" ||
        typeof value.sourceTree !== "string" ||
        typeof value.candidate !== "string" ||
        typeof value.base !== "string" ||
        typeof value.resultTree !== "string" ||
        !isStringArray(value.conflicts) ||
        typeof value.messages !== "string" ||
        (value.ref !== undefined && typeof value.ref !== "string")) {
        throw new Error("Saved generation preview is incomplete. Prepare the generation again.");
    }
}
const DIRECT_SOURCE_ACTIONS = [
    "status",
    "prepare",
    "preview",
    "apply",
    "finish",
    "abort",
    "discard",
    "clean",
    "build",
    "index",
    "analyze",
    "catalog",
    "relocate",
    "expand",
    "import",
];
function isDirectSourceAction(value) {
    return DIRECT_SOURCE_ACTIONS.some((action) => action === value);
}
function requestedMapper(value) {
    if (value === undefined) {
        return undefined;
    }
    if (!isSnesMapper(value)) {
        throw new Error("Unsupported SNES mapper.");
    }
    return value;
}
function readAnalysisChange(file) {
    const value = readJson(file);
    if (!isResearchAnalysisChange(value)) {
        throw new Error("Choose an annotation or indirect-target research action.");
    }
    return value;
}
function isResearchAnalysisChange(value) {
    if (!isRecord(value) || typeof value.expectedDocumentSha256 !== "string") {
        return false;
    }
    if (value.kind !== "put" && value.kind !== "remove") {
        return false;
    }
    if (value.collection !== "annotations" && value.collection !== "analysis") {
        return false;
    }
    if (value.kind === "remove") {
        return typeof value.id === "string";
    }
    return (typeof value.path === "string" &&
        typeof value.reason === "string" &&
        isRecord(value.value) &&
        typeof value.value.id === "string");
}
function isPristineAsset(value) {
    return (typeof value === "object" &&
        value !== null &&
        "path" in value &&
        typeof value.path === "string" &&
        "sha256" in value &&
        typeof value.sha256 === "string");
}
function assertGenerationRecipe(value) {
    if (typeof value !== "object" ||
        value === null ||
        !("format" in value) ||
        value.format !== "uttori-snes-generation-inputs" ||
        !("version" in value) ||
        value.version !== 1 ||
        !("sourceRoot" in value) ||
        typeof value.sourceRoot !== "string" ||
        !("recipes" in value) ||
        !isUnknownArray(value.recipes) ||
        !("pristineAssets" in value) ||
        !isUnknownArray(value.pristineAssets)) {
        throw new Error("Invalid SNES generation input contract.");
    }
    for (const file of value.recipes) {
        if (typeof file !== "string") {
            throw new Error("Generation recipe paths must be strings.");
        }
    }
    for (const asset of value.pristineAssets) {
        if (!isPristineAsset(asset)) {
            throw new Error("Invalid SNES generation input contract.");
        }
    }
}
/** Validate target recipe selection without scanning the editable source for original asset values. */
function generationRecipe(project) {
    const recipe = readJson(path.join(project.repository.root, ".uttori/generation-inputs.json"));
    assertGenerationRecipe(recipe);
    if (!project.configuration.sourceRoots.includes(recipe.sourceRoot)) {
        throw new Error("Invalid SNES generation input contract.");
    }
    for (const file of recipe.recipes) {
        assertSourcePath(file);
    }
    for (const asset of recipe.pristineAssets) {
        assertSourcePath(asset.path);
        if (!/^[\da-f]{64}$/.test(asset.sha256)) {
            throw new Error("Pristine assets require original content hashes.");
        }
        if (asset.romRange &&
            (!Number.isSafeInteger(asset.romRange.start) ||
                !Number.isSafeInteger(asset.romRange.end) ||
                asset.romRange.start < 0 ||
                asset.romRange.end <= asset.romRange.start)) {
            throw new Error("Pristine ROM assets require a bounded, half-open original file range.");
        }
        if (asset.originalBlob !== undefined &&
            (asset.romRange ||
                typeof asset.originalBlob !== "string" ||
                !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(asset.originalBlob))) {
            throw new Error("Pristine assets require one immutable original blob or ROM extraction.");
        }
    }
    if (new Set(recipe.pristineAssets.map((asset) => asset.path)).size !== recipe.pristineAssets.length) {
        throw new Error("Repeated pristine asset declaration.");
    }
    return recipe;
}
/** Resolve one complete generation snapshot. The target rechecks the evidence identity inside its read transaction. */
async function generationInputs(project) {
    const local = sourceProjectLocalInputs(project);
    const captureSnapshot = readSourceCaptureCatalog(project.repository.root, project.configuration.captures, project.configuration.romSha256);
    if (!captureSnapshot.fileSha256) {
        throw new Error("Run source catalog to record retained evidence identities before preparing a generation.");
    }
    const recipe = generationRecipe(project);
    const parent = await acceptedSourceGeneration(project.repository, (await sourceMergeStatus(project.repository)).head);
    const prior = await verifySourceGeneration(project.repository, parent);
    const priorFiles = new Map(prior.files.map((file) => [file.path, file.sha256]));
    for (const asset of recipe.pristineAssets) {
        if (!asset.romRange && !asset.originalBlob && priorFiles.get(asset.path) !== asset.sha256) {
            throw new Error(`Pristine asset identity changed: ${asset.path}`);
        }
    }
    const recipes = recipe.recipes.map((name) => ({
        path: name,
        bytes: fs.readFileSync(path.join(project.repository.root, recipe.sourceRoot, name)),
    }));
    const inputFiles = [
        ...recipes.map((file) => ({ ...file, path: `${recipe.sourceRoot}/${file.path}` })),
        ...project.research.files.map((file) => {
            const bytes = fs.readFileSync(path.join(project.repository.root, file.path));
            if (sourceContentHash(bytes) !== file.sha256) {
                throw new Error(`Research input changed while capturing generation: ${file.path}`);
            }
            return { path: file.path, bytes };
        }),
        { path: ".uttori/project.json", bytes: Buffer.from(canonicalJson(project.configuration)) },
        { path: ".uttori/generation-inputs.json", bytes: Buffer.from(canonicalJson(recipe)) },
        {
            path: project.configuration.captures,
            bytes: Buffer.from(canonicalJson(captureSnapshot.catalog)),
        },
    ];
    const configFile = path.join(project.repository.root, project.configuration.buildConfig);
    const loaded = await loadSourceEnvironment(configFile);
    let toolchain;
    try {
        toolchain = sourceToolchain(loaded.configuration.plugins
            .filter((plugin) => !plugin.bundled)
            .map((plugin) => plugin.resolvedModule));
    }
    finally {
        await loaded.dispose();
    }
    inputFiles.push({
        path: ".uttori/toolchain-snapshot.json",
        bytes: Buffer.from(canonicalJson(toolchain)),
    });
    const store = openAnalysisProjectStore(local.evidence);
    let evidenceSha256;
    try {
        const reconciled = reconcileSourceCaptureCatalog(captureSnapshot.catalog, store.loadTable("imports"));
        if (canonicalJson(reconciled) !== canonicalJson(captureSnapshot.catalog)) {
            throw new Error("The capture catalog is missing retained evidence identities. Refresh it with source catalog.");
        }
        const manifest = Buffer.from(canonicalJson(store.manifest()));
        evidenceSha256 = sourceContentHash(manifest);
        inputFiles.push({ path: ".uttori/evidence-snapshot.json", bytes: manifest });
    }
    finally {
        store.close();
    }
    const render = {
        sourceRoot: recipe.sourceRoot,
        recipes,
        pristineAssets: recipe.pristineAssets,
        codeWithdrawals: recipe.codeWithdrawals ?? [],
    };
    return {
        ...render,
        inputFiles,
        repository: project.repository,
        parent,
        evidenceDirectory: local.evidence,
        romFile: local.rom,
        inputs: {
            project: project.configuration.id,
            romSha256: project.configuration.romSha256,
            evidenceSha256,
            researchSha256: project.research.hash,
            captureCatalogSha256: sourceContentHash(canonicalJson(captureSnapshot.catalog)),
            toolchainSha256: toolchain.sha256,
            optionsSha256: snesGenerationOptionsHash(render),
        },
        loadEnvironment: loadSourceEnvironment,
    };
}
/** Build editable source with a fresh content identity; original-ROM equality belongs to pure generation only. */
async function withSourceBuild(project, signal, run) {
    const root = project.repository.root;
    const layout = readJson(path.join(root, project.configuration.layout));
    assertSourceLayout(layout, project.configuration.romSha256);
    const configFile = path.join(root, project.configuration.buildConfig);
    const configurationBytes = fs.readFileSync(configFile);
    const configuration = JSON.parse(configurationBytes.toString("utf8"));
    const entryPoints = isRecord(configuration) && isStringArray(configuration.entryPoints)
        ? configuration.entryPoints
        : undefined;
    if (!entryPoints ||
        entryPoints.length !== 1 ||
        !isRecord(configuration) ||
        configuration.baseImage) {
        throw new Error("Source projects require one complete ROM entry point and no base-image patch mode.");
    }
    const entrySource = path
        .relative(root, path.resolve(path.dirname(configFile), entryPoints[0]))
        .split(path.sep)
        .join("/");
    assertSourcePath(entrySource);
    const raw = readJson(path.join(path.dirname(configFile), "source-raw.json"));
    if (!isRecord(raw) ||
        raw.format !== "uttori-source-raw" ||
        raw.version !== 1 ||
        raw.blockSize !== 0x1000 ||
        raw.romSha256 !== project.configuration.romSha256) {
        throw new Error("Regenerate the project's stable raw-block contract before building.");
    }
    const original = RomImage.load(sourceProjectLocalInputs(project).rom);
    if (original.identity.contentSha256 !== project.configuration.romSha256) {
        throw new Error("The local original ROM does not match this source project.");
    }
    let placementMapper;
    if (layout.objects !== undefined ||
        layout.references !== undefined ||
        layout.expansion !== undefined) {
        if ((layout.objects !== undefined || layout.references !== undefined) &&
            (!Array.isArray(layout.objects) || !Array.isArray(layout.references))) {
            throw new Error("Source placements require both object and reference arrays.");
        }
        const store = openAnalysisProjectStore(sourceProjectLocalInputs(project).evidence);
        try {
            const manifest = store.manifest();
            if (manifest.rom.contentSha256 !== project.configuration.romSha256 ||
                !isSnesMapper(manifest.mapping.mapper)) {
                throw new Error("Source evidence has an incompatible ROM or mapper identity.");
            }
            placementMapper = manifest.mapping.mapper;
            if (layout.expansion && layout.expansion.mapper !== placementMapper) {
                throw new Error("Expansion mapper must match the original evidence identity.");
            }
        }
        finally {
            store.close();
        }
    }
    const placementContext = placementMapper === undefined ? undefined : createSnesAddressContext(placementMapper);
    const placements = placementContext === undefined
        ? undefined
        : {
            objects: layout.objects ?? [],
            references: layout.references ?? [],
            logicalAddress: (offset) => snesRomAddressSpace.fromOutputOffset(offset, placementContext),
        };
    const loaded = await loadSourceEnvironment(configFile);
    try {
        const toolchain = sourceToolchain(loaded.configuration.plugins
            .filter((plugin) => !plugin.bundled)
            .map((plugin) => plugin.resolvedModule));
        const result = run({
            root,
            entrySource,
            environment: loaded.environment,
            includePaths: loaded.includePaths,
            targetOptions: loaded.targetOptions,
            expectedSize: layout.size,
            expansion: layout.expansion,
            rawBlocks: {
                directory: path.join(path.dirname(project.configuration.buildConfig), "assets/raw"),
                original: original.read(0, original.length),
                blockSize: raw.blockSize,
            },
            states: layout.states,
            extents: layout.extents,
            placements,
            outputDirectory: path.join(root, ".uttori-local/builds"),
            toolchainSha256: toolchain.sha256,
            configurationSha256: sourceContentHash(canonicalJson({
                configuration: sourceContentHash(configurationBytes),
                project: project.configurationSha256,
                layout,
                placementMapper,
            })),
            signal,
        }, layout);
        if (sourceContentHash(fs.readFileSync(configFile)) !== sourceContentHash(configurationBytes) ||
            canonicalJson(readJson(path.join(root, project.configuration.layout))) !==
                canonicalJson(layout)) {
            throw new Error("Build configuration or layout changed during source inspection. Retry with the current files.");
        }
        return result;
    }
    finally {
        await loaded.dispose();
    }
}
/** Ordinary saved-file build and relocation inspection use identical environment and layout inputs. */
const buildProject = (project, signal) => withSourceBuild(project, signal, buildSnesSource);
/** Execute one explicit operation. Long-running callers use a worker so the editor stays responsive. */
export async function executeSourceOperation(operation) {
    operation.signal?.throwIfAborted();
    if (operation.action === "init") {
        if (!operation.rom) {
            throw new Error("Initialization requires an original ROM path.");
        }
        if (operation.mapper !== undefined && !SNES_MAPPERS.includes(operation.mapper)) {
            throw new Error("Unsupported SNES mapper.");
        }
        return initializeSnesSourceProject({
            directory: operation.directory,
            rom: operation.rom,
            dizRawFile: operation.dizRawFile,
            mapper: operation.mapper,
            signal: operation.signal,
            onProgress: operation.onProgress,
            toolchainSha256: sourceToolchain([]).sha256,
            loadEnvironment: loadSourceEnvironment,
        });
    }
    operation.onProgress?.("Reading selected source project.");
    const project = await openSourceProject(operation.directory);
    if (project.configuration.target !== "snes.sfc") {
        throw new Error("This source workflow currently supports the SNES target.");
    }
    const repository = project.repository;
    if (operation.action === "clean") {
        return { scratch: pruneSourceScratch(repository), pins: await pruneSourcePins(repository) };
    }
    if (operation.action === "research") {
        return prepareSourceResearch(project, operation.research, operation.overlays);
    }
    if (operation.action === "status") {
        const status = await sourceMergeStatus(repository);
        let candidateAccepted = false;
        if (operation.candidate) {
            assertSourceObjectId(operation.candidate);
            candidateAccepted =
                (await acceptedSourceGeneration(repository, status.head)) === operation.candidate;
        }
        let analysisReady = false;
        let analysisReason;
        let catalogReady;
        let catalogReason;
        // Status reads the selected research/evidence identities; it must not analyze or regenerate
        // merely because the tree refreshed. Missing local evidence still permits source/Git inspection.
        try {
            const store = openAnalysisProjectStore(sourceProjectLocalInputs(project).evidence);
            try {
                const snapshot = readSourceCaptureCatalog(repository.root, project.configuration.captures, project.configuration.romSha256);
                const reconciled = reconcileSourceCaptureCatalog(snapshot.catalog, store.loadTable("imports"));
                catalogReady =
                    Boolean(snapshot.fileSha256) &&
                        canonicalJson(reconciled) === canonicalJson(snapshot.catalog);
                if (!catalogReady) {
                    catalogReason =
                        "Refresh Capture Catalog to record the retained evidence identities before preparing.";
                }
                if (!store.researchInputsAreCurrent(project.research.hash)) {
                    analysisReason =
                        "Selected research changed. Analyze Evidence before preparing a generation.";
                }
                else {
                    store.assertCurrentAnalysis();
                    analysisReady = true;
                }
            }
            finally {
                store.close();
            }
        }
        catch (error) {
            analysisReason = error instanceof Error ? error.message : String(error);
        }
        const working = await sourceStatus(repository);
        return {
            ...status,
            dirty: working.length > 0,
            unstaged: (await sourceGit(repository.root, ["diff", "--name-only"])).stdout.length > 0 ||
                working
                    .toString()
                    .split("\0")
                    .some((entry) => entry.startsWith("?? ")),
            candidateAccepted,
            analysisReady,
            analysisReason,
            catalogReady,
            catalogReason,
        };
    }
    if (operation.action === "abort") {
        return abortSourceGeneration(repository);
    }
    if (operation.action === "discard") {
        if (!operation.candidate) {
            throw new Error("Discard requires the generation commit to release.");
        }
        await discardSourceGeneration(repository, operation.candidate);
        return { discarded: operation.candidate };
    }
    if (operation.action === "preview") {
        if (!operation.candidate) {
            throw new Error("Preview requires a retained generation commit.");
        }
        const preview = await previewSourceGeneration(repository, operation.candidate, operation.overlays);
        savePreview(project, preview);
        return preview;
    }
    if (operation.action === "index") {
        return { changed: synchronizeSourceResearch(project), researchSha256: project.research.hash };
    }
    if (operation.action === "build") {
        operation.onProgress?.("Assembling and checking source, layout, and asset consumption.");
        return buildProject(project, operation.signal);
    }
    if (operation.action === "expand") {
        if (!Number.isSafeInteger(operation.expansionSize)) {
            throw new Error("Expansion requires an explicit capacity in bytes.");
        }
        return withSourceBuild(project, operation.signal, (build, layout) => {
            const store = openAnalysisProjectStore(sourceProjectLocalInputs(project).evidence);
            let mapper;
            try {
                const manifest = store.manifest();
                if (manifest.rom.contentSha256 !== project.configuration.romSha256 ||
                    !isExpandableMapper(manifest.mapping.mapper)) {
                    throw new Error("Expansion requires matching ordinary LoROM or HiROM evidence.");
                }
                mapper = manifest.mapping.mapper;
            }
            finally {
                store.close();
            }
            const context = createSnesAddressContext(mapper);
            const result = prepareSnesSourceExpansion({
                build,
                size: operation.expansionSize,
                freeSpace: layout.freeSpace ?? [],
                expansion: layout.expansion ?? {
                    mapper,
                    maximumSize: 0x400000,
                    fillByte: 0xff,
                    checksum: "recalculate",
                },
                logicalAddress: (offset) => snesRomAddressSpace.fromOutputOffset(offset, context),
            });
            const edits = [...result.edits];
            const addJsonEdit = (name, change) => {
                const before = fs.readFileSync(path.join(repository.root, name), "utf8");
                const parsed = JSON.parse(before);
                const after = JSON.stringify(change(parsed), null, 2) + "\n";
                if (before !== after) {
                    edits.push({ path: name, beforeSha256: sourceContentHash(before), before, after });
                }
            };
            addJsonEdit(project.configuration.layout, (current) => {
                if (canonicalJson(current) !== canonicalJson(layout)) {
                    throw new Error("Layout changed during expansion inspection.");
                }
                return {
                    ...layout,
                    size: result.size,
                    expansion: result.expansion,
                    freeSpace: result.freeSpace,
                };
            });
            addJsonEdit(project.configuration.buildConfig, (configuration) => {
                const plugins = isRecord(configuration) && Array.isArray(configuration.plugins)
                    ? configuration.plugins.filter((plugin) => isRecord(plugin) &&
                        plugin.module === "@uttori/asm-plugin-snes" &&
                        (plugin.options === undefined || isRecord(plugin.options)))
                    : undefined;
                if (plugins?.length !== 1) {
                    throw new Error("Expansion needs one explicit SNES plugin configuration for checksum finalization.");
                }
                plugins[0].options = { ...plugins[0].options, checksumEnabled: true };
                return configuration;
            });
            return { ...result, edits };
        });
    }
    if (operation.action === "relocate") {
        if (!operation.objectId) {
            throw new Error("Relocation requires a declared object ID.");
        }
        operation.onProgress?.("Planning placement and validating ordinary source edits.");
        return withSourceBuild(project, operation.signal, (build, layout) => {
            if (!Array.isArray(layout.objects) ||
                !Array.isArray(layout.freeSpace) ||
                !Array.isArray(layout.references)) {
                throw new Error("Declare movable objects, proven free-space source blocks and complete references in the layout file first.");
            }
            const layoutPath = path.join(repository.root, project.configuration.layout);
            const before = fs.readFileSync(layoutPath, "utf8");
            if (canonicalJson(JSON.parse(before)) !== canonicalJson(layout)) {
                throw new Error("Layout changed before relocation inspection.");
            }
            const objects = layout.objects;
            const result = prepareSnesSourceRelocation({
                build,
                objects,
                freeSpace: layout.freeSpace,
                references: layout.references,
                objectId: operation.objectId,
                logicalAddress: build.placements.logicalAddress,
            });
            const after = JSON.stringify({
                ...layout,
                objects: objects.map((object) => object.id === result.object.id ? result.object : object),
                references: result.references,
                extents: result.extents,
                states: result.states,
            }, null, 2) + "\n";
            const edits = [...result.edits];
            if (before !== after) {
                edits.push({
                    path: project.configuration.layout,
                    beforeSha256: sourceContentHash(before),
                    before,
                    after,
                });
            }
            return { ...result, edits };
        });
    }
    if (operation.action === "catalog") {
        const snapshot = readSourceCaptureCatalog(repository.root, project.configuration.captures, project.configuration.romSha256);
        const store = openAnalysisProjectStore(sourceProjectLocalInputs(project).evidence);
        try {
            const catalog = reconcileSourceCaptureCatalog(snapshot.catalog, store.loadTable("imports"));
            writeSourceCaptureCatalog(repository.root, project.configuration.captures, catalog, snapshot.fileSha256);
            return {
                captures: catalog.captures.length,
                retainedEvidenceRequired: catalog.captures.filter((capture) => !capture.archives.length)
                    .length,
            };
        }
        finally {
            store.close();
        }
    }
    synchronizeSourceResearch(project);
    const researchOptions = {
        research: project.research,
        assertResearchCurrent: () => {
            const current = readResearchInputs(repository.root, project.configuration.researchRoots, {
                project: project.configuration.id,
                romSha256: project.configuration.romSha256,
            });
            if (current.hash !== project.research.hash) {
                throw new Error("Research changed during the operation. Retry with the current branch inputs.");
            }
        },
    };
    if (operation.action === "analyze") {
        const local = sourceProjectLocalInputs(project);
        const pendingNotes = pendingCaptureImportNotes(local.evidence);
        const result = analyzeSnesProject({
            projectDirectory: local.evidence,
            romFile: local.rom,
            signal: operation.signal,
            maxWorkItems: project.configuration.limits?.analysisWorkItems,
            maxCallDepth: project.configuration.limits?.analysisCallDepth,
            onProgress: (progress) => operation.onProgress?.(progress.message),
            ...researchOptions,
        });
        completeCaptureImportNotes(local.evidence, pendingNotes, result.status, result.addedCode);
        return result;
    }
    if (operation.action === "import") {
        if (!operation.capture) {
            throw new Error("Import requires a capture archive path.");
        }
        const capture = path.resolve(operation.capture);
        const local = sourceProjectLocalInputs(project);
        const catalogSnapshot = readSourceCaptureCatalog(repository.root, project.configuration.captures, project.configuration.romSha256);
        operation.onProgress?.("Fingerprinting the private capture archive.");
        const archive = await fingerprintSourceCapture(capture, operation.signal, project.configuration.limits?.captureBytes);
        const selected = await openRuntimeCaptureSource(capture, {
            signal: operation.signal,
            maxBytes: project.configuration.limits?.captureBytes,
        });
        const context = {
            projectRomContentSha256: project.configuration.romSha256,
            sourceName: path.basename(capture),
        };
        const options = { signal: operation.signal, onStage: operation.onProgress, ...researchOptions };
        let result;
        if (selected.kind === "instructions") {
            result = await importRuntimeTraceSourceIntoProject(selected.source, local.evidence, { ...context, indexMode: "full" }, options);
        }
        else {
            result = await importRuntimeBusTraceSourceIntoProject(selected.source, local.evidence, context, options);
        }
        // Evidence is already committed. A failed Git-file update must report that durable outcome;
        // retrying the import is idempotent and can complete the missing portable archive binding.
        try {
            operation.onProgress?.("Recording verified archive identity in the Git capture catalog.");
            if (canonicalJson(await fingerprintSourceCapture(capture, operation.signal, project.configuration.limits?.captureBytes)) !== canonicalJson(archive)) {
                throw new Error("Capture archive or companion changed during import.");
            }
            const store = openAnalysisProjectStore(local.evidence);
            try {
                const reports = store.loadTable("imports");
                const report = reports.find((entry) => entry.sourceSha256 === result.sourceSha256);
                if (report) {
                    writeCaptureImportNotes(local.evidence, report);
                }
                const catalog = reconcileSourceCaptureCatalog(catalogSnapshot.catalog, reports, {
                    sourceSha256: result.sourceSha256,
                    archive,
                });
                writeSourceCaptureCatalog(repository.root, project.configuration.captures, catalog, catalogSnapshot.fileSha256);
            }
            finally {
                store.close();
            }
        }
        catch (error) {
            throw new Error(`Evidence import committed; portable catalog update failed. Retry this import to finish recording its archive: ${String(error)}`, { cause: error });
        }
        return result;
    }
    if (operation.action === "prepare") {
        operation.onProgress?.("Capturing inputs and verifying a pure generation against the original ROM.");
        return prepareSnesGeneration({
            ...(await generationInputs(project)),
            signal: operation.signal,
        });
    }
    if (operation.action === "apply") {
        if (!operation.candidate) {
            throw new Error("Apply requires the previewed generation commit.");
        }
        assertSourceObjectId(operation.candidate);
        const status = await sourceMergeStatus(repository);
        // Finish releases the preview and candidate pins. A repeated Apply must return the current
        // state without repinning or revalidating historical inputs against subsequent edits.
        if ((await acceptedSourceGeneration(repository, status.head)) === operation.candidate) {
            operation.onProgress?.("This generation is already integrated. No merge was applied.");
            return status;
        }
        let preview;
        try {
            preview = readJson(path.join(repository.stateDirectory, "preview.json"));
        }
        catch (error) {
            // A private preview is disposable, but applying an unreviewed merge is never a fallback.
            if (isRecord(error) && error.code === "ENOENT") {
                throw new Error("Preview this generation with current edits before applying it.", {
                    cause: error,
                });
            }
            throw error;
        }
        assertSourceMergePreview(preview);
        const candidate = await candidateGeneration(project, operation.candidate);
        const current = await generationInputs(project);
        if (canonicalJson(current.inputs) !== canonicalJson(candidate.descriptor.inputs)) {
            throw new Error("Generation inputs changed since preparation. Prepare and preview again.");
        }
        return applySourceGeneration(repository, candidate, preview);
    }
    if (sourceActionName(operation.action) !== "finish") {
        throw new Error(`Unknown source action: ${sourceActionName(operation.action)}`);
    }
    return finishSourceGeneration(repository, {
        message: operation.message ?? "Integrate regenerated source",
        validate: async () => (await buildProject(project, operation.signal)).verification,
    });
}
export const sourceUsage = `uttori-asm source <status|prepare|build|index|analyze|catalog|finish|abort|clean> <project>
uttori-asm source init <new-folder> <original-rom> [--mapper <mapper>] [--dizraw <research.dizraw>]
uttori-asm source <preview|apply|discard> <project> <generation-commit>
uttori-asm source expand <project> <capacity-bytes>
uttori-asm source relocate <project> <object-id>
uttori-asm source import <project> <capture.act2-or-json>
uttori-asm source research <project> [<symbol-id> <aliases|suppress|restore|entry|no-entry> [aliases...]]
uttori-asm source research <project> --analysis [<change.json>]

Prepare and preview preserve source, staging and Git history. Commit your edits before apply.
Resolve conflicts with Git, stage the result, then finish to validate and commit the merge.`;
/** Strict positional CLI adapter; structured service calls carry editor cancellation and buffers. */
export async function runSourceCli(argv) {
    if (argv.length === 0 || argv.includes("--help")) {
        console.log(sourceUsage);
        return 0;
    }
    const [action, directory, candidate] = argv;
    if (action === "research" && directory) {
        try {
            let research;
            if (candidate === "--analysis" && argv.length <= 4) {
                research = {
                    kind: "analysis",
                    change: argv[3] ? readAnalysisChange(path.resolve(argv[3])) : undefined,
                };
            }
            else if (argv.length > 2) {
                const change = argv[3];
                if (!candidate || !change || (!["aliases"].includes(change) && argv.length !== 4)) {
                    throw new Error("Choose a symbol, action and optional aliases.");
                }
                if (change === "aliases") {
                    research = { symbolId: candidate, change: { kind: "aliases", aliases: argv.slice(4) } };
                }
                else if (change === "suppress" || change === "restore") {
                    research = {
                        symbolId: candidate,
                        change: { kind: "suppression", suppressed: change === "suppress" },
                    };
                }
                else if (change === "entry" || change === "no-entry") {
                    research = {
                        symbolId: candidate,
                        change: { kind: "entry-point", enabled: change === "entry" },
                    };
                }
                else {
                    throw new Error(`Unknown research action: ${change}`);
                }
            }
            console.log(JSON.stringify(await executeSourceOperation({ action, directory, research }), null, 2));
            return 0;
        }
        catch (error) {
            console.error(`Research proposal failed: ${error instanceof Error ? error.message : String(error)}`);
            return 1;
        }
    }
    if (action === "init" && directory && candidate) {
        try {
            const flags = new Map();
            for (let index = 3; index < argv.length; index += 2) {
                const flag = argv[index];
                const value = argv[index + 1];
                if (!["--mapper", "--dizraw"].includes(flag) || !value || flags.has(flag)) {
                    throw new Error("Initialization accepts one --mapper and one --dizraw value.");
                }
                flags.set(flag, value);
            }
            const result = await executeSourceOperation({
                action,
                directory,
                rom: candidate,
                mapper: requestedMapper(flags.get("--mapper")),
                dizRawFile: flags.get("--dizraw"),
            });
            console.log(JSON.stringify(result, null, 2));
            return 0;
        }
        catch (error) {
            console.error(`Source initialization failed: ${error instanceof Error ? error.message : String(error)}`);
            return 1;
        }
    }
    if (!action ||
        !directory ||
        !isDirectSourceAction(action) ||
        argv.length !==
            (["preview", "apply", "discard", "import", "relocate", "expand"].includes(action) ? 3 : 2)) {
        console.error(sourceUsage);
        return 1;
    }
    try {
        const result = await executeSourceOperation({
            action,
            directory,
            candidate,
            capture: action === "import" ? candidate : undefined,
            objectId: action === "relocate" ? candidate : undefined,
            expansionSize: action === "expand" ? Number(candidate) : undefined,
        });
        console.log(JSON.stringify(result, null, 2));
        return 0;
    }
    catch (error) {
        console.error(`Source operation failed: ${error instanceof Error ? error.message : String(error)}`);
        return 1;
    }
}
//# sourceMappingURL=source.js.map
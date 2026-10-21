import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { canonicalJson } from "@uttori/asm-core/canonical-json";
import { openAnalysisProjectStore, RESEARCH_COLLECTIONS, RomImage, } from "@uttori/asm-disassembler";
import { openSourceProject, sourceGit, sourceRepository, sourceContentHash, retainSourceGeneration, createSourceInputSnapshot, SOURCE_GENERATION_FILE, synchronizeSourceResearch, sourceStatus, } from "@uttori/asm-disassembler/source-project";
import { createSnesAnalysisProject, analyzeSnesProject, exportSnes65816Source, buildSnesSource, snesGenerationOptionsHash, SNES_MAPPERS, } from "@uttori/asm-plugin-snes/disassembler";
function importedResearchRecords(store, collection) {
    switch (collection) {
        case "labels":
            return store.loadTable("labels");
        case "comments":
            return store.loadTable("comments");
        case "regions":
            return store.loadTable("regions");
        case "annotations":
            return store.loadTable("annotations");
        case "analysis":
            return store.analysisByKinds(["target-override", "target-set"]);
        default: {
            const leftover = collection;
            throw new Error(`Unsupported research collection: ${String(leftover)}`);
        }
    }
}
export async function initializeSnesSourceProject(options) {
    const destination = path.resolve(options.directory);
    if (fs.existsSync(destination)) {
        throw new Error("Choose a new project folder. Source initialization never replaces an existing directory.");
    }
    const id = options.id ?? path.basename(destination).replaceAll(/[^\w.-]+/g, "-");
    if (!/^[\w.-]+$/.test(id)) {
        throw new Error("Project identity uses letters, digits, dots, underscores and hyphens.");
    }
    const romFile = path.resolve(options.rom);
    options.signal?.throwIfAborted();
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    const staging = path.join(path.dirname(destination), `.source-init-${randomUUID()}`);
    fs.mkdirSync(staging);
    const write = (name, bytes) => {
        const file = path.join(staging, name);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, bytes);
    };
    const json = (name, value) => write(name, canonicalJson(value));
    try {
        await sourceGit(staging, ["init", "-b", "main"]);
        // Git's configured author and signing/hooks are honored. Do not fabricate a user identity.
        await sourceGit(staging, ["var", "GIT_AUTHOR_IDENT"]);
        write(".gitignore", "/.uttori-local/\n/node_modules/\n");
        fs.mkdirSync(path.join(staging, ".uttori-local"));
        fs.copyFileSync(romFile, path.join(staging, ".uttori-local/original.sfc"), fs.constants.COPYFILE_EXCL);
        const localRom = path.join(staging, ".uttori-local/original.sfc");
        const evidenceDirectory = path.join(staging, ".uttori-local/evidence");
        const created = createSnesAnalysisProject({
            projectDirectory: evidenceDirectory,
            romFile: localRom,
            mapper: options.mapper === undefined ? undefined : checkedMapper(options.mapper),
            dizRawFile: options.dizRawFile,
            signal: options.signal,
            onProgress: (event) => options.onProgress?.(event.message),
        });
        const rom = RomImage.load(localRom, { headerSize: created.manifest.rom.headerSize });
        json(".uttori/project.json", {
            format: "uttori-source-project",
            version: 1,
            id,
            target: "snes.sfc",
            romSha256: rom.identity.contentSha256,
            sourceRoots: ["source"],
            researchRoots: [".uttori/research"],
            buildConfig: "source/uttori-asm.config.json",
            layout: ".uttori/layout.json",
            captures: ".uttori/captures.json",
            limits: options.limits,
        });
        json(".uttori-local/project.json", {
            format: "uttori-source-local",
            version: 1,
            rom: ".uttori-local/original.sfc",
            evidence: ".uttori-local/evidence",
        });
        // Persist imported choices before indexing, so clone/rebuild never depends on the private XML.
        const decisions = [];
        if (options.dizRawFile) {
            const imported = openAnalysisProjectStore(evidenceDirectory);
            try {
                const provenance = imported.loadTable("evidence");
                const adopted = new Map(provenance.map((record) => [record.id, `adopted-diz:${record.id}`]));
                // Choosing this import adopts research, not runtime observations. Keep the original import
                // in SQLite and give the portable declarations their own explicit adoption provenance.
                for (const record of provenance) {
                    const evidenceId = adopted.get(record.id);
                    decisions.push({
                        collection: "evidence",
                        id: evidenceId,
                        value: {
                            id: evidenceId,
                            source: "manual",
                            sourceId: record.sourceId,
                            confidence: record.confidence,
                            detail: `Adopted DiztinGUIsh research from ${record.id}. ${record.detail ?? ""}`.trim(),
                        },
                    });
                }
                for (const collection of RESEARCH_COLLECTIONS) {
                    if (collection === "evidence") {
                        continue;
                    }
                    const records = importedResearchRecords(imported, collection);
                    for (const record of records) {
                        decisions.push({
                            collection,
                            id: record.id,
                            value: {
                                ...record,
                                evidence: record.evidence.map((evidenceId) => {
                                    const replacement = adopted.get(evidenceId);
                                    if (!replacement) {
                                        throw new Error(`Missing Diz research provenance: ${evidenceId}`);
                                    }
                                    return replacement;
                                }),
                            },
                        });
                    }
                }
            }
            finally {
                imported.close();
            }
        }
        json(".uttori/research/decisions.json", {
            format: "uttori-research",
            version: 1,
            project: id,
            romSha256: rom.identity.contentSha256,
            decisions,
        });
        json(".uttori/captures.json", {
            format: "uttori-capture-catalog",
            version: 1,
            romSha256: rom.identity.contentSha256,
            captures: [],
        });
        json(".uttori/layout.json", {
            format: "uttori-snes-layout",
            version: 1,
            romSha256: rom.identity.contentSha256,
            size: rom.length,
            states: [],
            extents: [],
        });
        json("source/ram-map.json", {
            format: "uttori-asm-snes-ram-map",
            schemaVersion: 1,
            variables: [],
        });
        json("source/uttori-asm.config.json", {
            plugins: [{ module: "@uttori/asm-plugin-snes", options: { checksumEnabled: false } }],
            target: "snes.sfc",
            architecture: "snes.65816",
            entryPoints: ["main.asm"],
            includePaths: ["./"],
        });
        const project = await openSourceProject(staging);
        synchronizeSourceResearch(project);
        const analysis = analyzeSnesProject({
            projectDirectory: evidenceDirectory,
            romFile: localRom,
            research: project.research,
            maxWorkItems: options.limits?.analysisWorkItems,
            maxCallDepth: options.limits?.analysisCallDepth,
            signal: options.signal,
            onProgress: (event) => options.onProgress?.(event.message),
        });
        const files = [];
        const store = openAnalysisProjectStore(evidenceDirectory);
        let evidenceSha256;
        let evidenceManifest;
        try {
            store.prepareAnnotationQueries();
            evidenceSha256 = store.transaction(() => {
                const view = store.sourceExportView();
                evidenceManifest = Buffer.from(canonicalJson(view.manifest));
                const identity = sourceContentHash(evidenceManifest);
                exportSnes65816Source(view, rom, path.join(staging, "source"), {
                    sourceProjectSha256: identity,
                    instructionGroups: store.instructionExportGroups(),
                    emitFile: (file) => {
                        options.signal?.throwIfAborted();
                        if (file.path === "annotation-report.json") {
                            return;
                        }
                        const name = `source/${file.path}`;
                        write(name, file.bytes);
                        files.push({ ...file, path: name });
                    },
                });
                return identity;
            }, false);
        }
        finally {
            store.close();
        }
        const configFile = path.join(staging, "source/uttori-asm.config.json");
        files.push({ path: "source/uttori-asm.config.json", bytes: fs.readFileSync(configFile) });
        const recipes = ["ram-map.json", "uttori-asm.config.json"].map((name) => ({
            path: name,
            bytes: fs.readFileSync(path.join(staging, "source", name)),
        }));
        json(".uttori/generation-inputs.json", {
            format: "uttori-snes-generation-inputs",
            version: 1,
            sourceRoot: "source",
            recipes: recipes.map((recipe) => recipe.path),
            pristineAssets: [],
            codeWithdrawals: [],
        });
        const snapshot = createSourceInputSnapshot([
            ...[
                ".uttori/project.json",
                ".uttori/generation-inputs.json",
                ".uttori/captures.json",
                ...project.research.files.map((file) => file.path),
                ...recipes.map((file) => `source/${file.path}`),
            ].map((name) => ({
                path: name,
                bytes: fs.readFileSync(path.join(staging, name)),
            })),
            { path: ".uttori/evidence-snapshot.json", bytes: evidenceManifest },
        ]);
        write(snapshot.path, snapshot.bytes);
        files.push(snapshot);
        const loaded = await options.loadEnvironment(configFile);
        let verification;
        try {
            options.onProgress?.("Verifying the complete original ROM before creating source history.");
            verification = buildSnesSource({
                root: staging,
                entrySource: "source/main.asm",
                environment: loaded.environment,
                includePaths: loaded.includePaths,
                targetOptions: loaded.targetOptions,
                expectedSize: rom.length,
                originalContent: rom.bytes(),
                outputDirectory: path.join(staging, ".uttori-local/builds"),
                configurationSha256: sourceContentHash(fs.readFileSync(configFile)),
                toolchainSha256: options.toolchainSha256,
                signal: options.signal,
            }).verification;
        }
        finally {
            await loaded.dispose();
        }
        const repository = await sourceRepository(staging);
        const generation = await retainSourceGeneration(repository, {
            files,
            inputs: {
                project: id,
                romSha256: rom.identity.contentSha256,
                evidenceSha256,
                researchSha256: project.research.hash,
                captureCatalogSha256: sourceContentHash(canonicalJson({
                    format: "uttori-capture-catalog",
                    version: 1,
                    romSha256: rom.identity.contentSha256,
                    captures: [],
                })),
                toolchainSha256: options.toolchainSha256,
                optionsSha256: snesGenerationOptionsHash({
                    sourceRoot: "source",
                    recipes,
                    pristineAssets: [],
                    codeWithdrawals: [],
                }),
            },
        });
        // Attach the verified pure root to the initialized branch without creating another branch;
        // later source commits must retain this generation in their ancestry.
        await sourceGit(staging, ["update-ref", "HEAD", generation.commit]);
        await sourceGit(staging, ["read-tree", generation.commit]);
        json(SOURCE_GENERATION_FILE, generation.descriptor);
        write("README.md", `# ${id}\n\nEdit and commit source and research with Git. Private ROM, evidence and builds live in .uttori-local.\n\nPrepare and preview regeneration while editing. Commit a checkpoint before applying; resolve native Git conflicts, then validate and finish the merge.\n`);
        json(".vscode/tasks.json", {
            version: "2.0.0",
            tasks: [
                {
                    label: "Build and Check",
                    type: "uttori-source",
                    action: "build",
                    project: "${workspaceFolder}",
                    group: { kind: "build", isDefault: true },
                },
            ],
        });
        await sourceGit(staging, ["add", "--all"]);
        await sourceGit(staging, ["commit", "-m", "Initialize editable source and Git research"]);
        // Hooks may intentionally edit or restage files; they cannot confer the earlier ROM proof on different inputs.
        if ((await sourceStatus(repository)).length ||
            files.some((file) => sourceContentHash(fs.readFileSync(path.join(staging, file.path))) !==
                sourceContentHash(file.bytes))) {
            throw new Error("Initialization hooks changed verified source. Review the hook before creating this project.");
        }
        const current = await openSourceProject(staging);
        if (current.research.hash !== project.research.hash ||
            current.configurationSha256 !== project.configurationSha256) {
            throw new Error("Initialization inputs changed before publication.");
        }
        await sourceGit(staging, ["update-ref", "-d", generation.ref, generation.commit]);
        options.signal?.throwIfAborted();
        // Recheck immediately before publication; an independently created destination is never merged.
        if (fs.existsSync(destination)) {
            throw new Error("Project destination appeared during initialization.");
        }
        fs.renameSync(staging, destination);
        return {
            directory: destination,
            generation: generation.commit,
            verification,
            analysis: {
                status: analysis.status,
                instructions: analysis.instructions,
                incompleteReasons: analysis.incompleteReasons,
            },
        };
    }
    finally {
        fs.rmSync(staging, { recursive: true, force: true });
    }
}
/** Mapper validation belongs to this target before it creates any evidence. */
function checkedMapper(value) {
    const mapper = SNES_MAPPERS.find((candidate) => candidate === value);
    if (!mapper) {
        throw new Error("Unsupported SNES mapper.");
    }
    return mapper;
}
//# sourceMappingURL=source-initialize.js.map
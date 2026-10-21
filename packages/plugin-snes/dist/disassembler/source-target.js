import fs from "node:fs";
import path from "node:path";
import { canonicalJson } from "@uttori/asm-core/canonical-json";
import { RomImage, openAnalysisProjectStore } from "@uttori/asm-disassembler";
import { sourceFilePublicationEpoch, sourceProjectLocalInputs, sourceContentHash, assertSourcePath, } from "@uttori/asm-disassembler/source-project";
import { buildSnesSource, inspectSnesSource, prepareSnesGeneration, snesGenerationOptionsHash, analyzeSnesProject, SNES_MAPPERS, prepareSnesSourceExpansion, prepareSnesSourceRelocation, createSnesAddressContext, } from "@uttori/asm-plugin-snes/disassembler";
import { snesRomAddressSpace } from "@uttori/asm-plugin-snes/target";
import { initializeSnesSourceProject } from "./source-initialize.js";
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
function isSnesMapper(value) {
    return SNES_MAPPERS.some((mapper) => mapper === value);
}
function isExpandableMapper(value) {
    return value === "lorom" || value === "hirom";
}
const isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
const isUnknownArray = (value) => Array.isArray(value);
const isStringArray = (value) => Array.isArray(value) && value.every((item) => typeof item === "string");
/** Read compact contracts with explicit size limits before parsing untrusted workspace JSON. */
function readJson(file) {
    if (fs.statSync(file).size > 8 * 1024 * 1024) {
        throw new Error(`Project contract is too large: ${file}`);
    }
    return JSON.parse(fs.readFileSync(file, "utf8"));
}
/** Build editable source with a fresh content identity; original-ROM equality belongs to pure generation only. */
async function withSourceBuild(project, host, signal, run) {
    const publicationEpoch = sourceFilePublicationEpoch(project.repository);
    const root = project.repository.root;
    const environmentInputs = new Map();
    const readEnvironment = (file) => {
        const bytes = Uint8Array.from(fs.readFileSync(file));
        environmentInputs.set(file, bytes);
        return bytes;
    };
    const projectBytes = readEnvironment(path.join(root, ".uttori/project.json"));
    if (sourceContentHash(canonicalJson(JSON.parse(Buffer.from(projectBytes).toString("utf8")))) !==
        project.configurationSha256) {
        throw new Error("Source project configuration changed before inspection.");
    }
    const layout = JSON.parse(Buffer.from(readEnvironment(path.join(root, project.configuration.layout))).toString("utf8"));
    assertSourceLayout(layout, project.configuration.romSha256);
    const configFile = path.join(root, project.configuration.buildConfig);
    const configurationBytes = readEnvironment(configFile);
    const configuration = JSON.parse(Buffer.from(configurationBytes).toString("utf8"));
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
    const raw = JSON.parse(Buffer.from(readEnvironment(path.join(path.dirname(configFile), "source-raw.json"))).toString("utf8"));
    if (!isRecord(raw) ||
        raw.format !== "uttori-source-raw" ||
        raw.version !== 1 ||
        raw.blockSize !== 0x1000 ||
        raw.romSha256 !== project.configuration.romSha256) {
        throw new Error("Regenerate the project's stable raw-block contract before building.");
    }
    const originalFile = sourceProjectLocalInputs(project).rom;
    const original = RomImage.load(originalFile);
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
    const loaded = await host.loadEnvironment(configFile);
    try {
        const toolchain = host.fingerprint(loaded.configuration.plugins
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
        }, layout, environmentInputs, typeof UTTORI_SOURCE_BUNDLED !== "undefined" &&
            UTTORI_SOURCE_BUNDLED &&
            loaded.configuration.plugins.every((plugin) => plugin.bundled));
        // Consumers use these exact configuration bytes at publication, rather than a later disk read.
        for (const [file, bytes] of environmentInputs) {
            if (sourceContentHash(fs.readFileSync(file)) !== sourceContentHash(bytes)) {
                throw new Error("Source build environment changed during inspection.");
            }
        }
        if (sourceFilePublicationEpoch(project.repository) !== publicationEpoch ||
            sourceContentHash(fs.readFileSync(configFile)) !== sourceContentHash(configurationBytes) ||
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
/** Inspect current or overlaid source with normal project checks, without publishing build artifacts. */
async function inspectBuiltinProject(project, host, overlays, signal) {
    return withSourceBuild(project, host, signal, (options, _layout, environmentInputs, bundledToolchain) => {
        const inspected = inspectSnesSource({ ...options, overlays });
        const snapshots = new Map(inspected.snapshots);
        for (const [file, bytes] of environmentInputs) {
            const before = snapshots.get(file);
            if (before && sourceContentHash(before) !== sourceContentHash(bytes)) {
                throw new Error("Source build consumed different configuration bytes.");
            }
            snapshots.set(file, bytes);
        }
        return {
            ...inspected,
            snapshots,
            root: project.repository.root,
            configurationSha256: options.configurationSha256,
            toolchainSha256: options.toolchainSha256,
            bundledToolchain,
        };
    });
}
function expandSnesProject(project, host, operation) {
    const repository = project.repository;
    if (!Number.isSafeInteger(operation.expansionSize)) {
        throw new Error("Expansion requires an explicit capacity in bytes.");
    }
    return withSourceBuild(project, host, operation.signal, (build, layout) => {
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
function relocateSnesProject(project, host, operation) {
    const repository = project.repository;
    if (!operation.objectId) {
        throw new Error("Relocation requires a declared object ID.");
    }
    operation.onProgress?.("Planning placement and validating ordinary source edits.");
    return withSourceBuild(project, host, operation.signal, (build, layout) => {
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
/** SNES cartridge and editable-layout policy, installed by executable hosts. */
export const snesSourceTarget = {
    id: "snes.sfc",
    recipeFormat: "uttori-snes-generation-inputs",
    matchesRom: (prefix) => !Buffer.from(prefix).equals(Buffer.from([0x4e, 0x45, 0x53, 0x1a])),
    initialize: initializeSnesSourceProject,
    build: (project, host, signal) => withSourceBuild(project, host, signal, buildSnesSource),
    inspect: inspectBuiltinProject,
    generationOptionsHash: snesGenerationOptionsHash,
    prepare: prepareSnesGeneration,
    analyze: analyzeSnesProject,
    expand: expandSnesProject,
    relocate: relocateSnesProject,
};
//# sourceMappingURL=source-target.js.map
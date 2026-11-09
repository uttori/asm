import * as fs from "node:fs";
import path from "node:path";
import { ANALYSIS_PROJECT_FORMAT, ANALYSIS_PROJECT_SCHEMA_VERSION, RomImage, openAnalysisProjectStore, analysisProjectRevision, assertAnalysisProjectRevision, commitAnalysisProjectViewUpdate, validateAnalysisProject, validateProjectRom, publishAnalysisProject, } from "@uttori/asm-disassembler";
import { snesRomAddressSpace } from "../target/address-space.js";
import { analyzeSnes65816 } from "./65816-analysis.js";
import { createSnesAddressContext, SNES_CPU_ADDRESS_SPACE, SNES_FILE_ADDRESS_SPACE, SNES_SRAM_ADDRESS_SPACE_DESCRIPTOR, SNES_WRAM_ADDRESS_SPACE_DESCRIPTOR, } from "./address-identities.js";
import { lostCodeRanges } from "./code-preservation.js";
import { importDizRaw } from "./dizraw-import.js";
import { detectSnesRom, isSnesMapper, } from "./rom-header.js";
import { analyzeSnesRuntimeCode } from "./runtime-code.js";
import { SPC700_ARAM_ADDRESS_SPACE_DESCRIPTOR } from "./spc700-address-space.js";
import { SUPERFX_ROM_ADDRESS_SPACE_DESCRIPTOR } from "./superfx-address-space.js";
/** Stable target id written to native SNES analysis projects. */
const TARGET_ID = "snes.sfc";
const ARCHITECTURE_ID = "snes.65816";
/** Stable digit grouping for progress messages, independent of the worker locale. */
const count = (value) => value.toLocaleString("en-US");
const MAX_PERSISTED_RUNTIME_ENTRY_POINTS = 1_000_000;
/** Thrown when a project operation observes an aborted signal. */
export class SnesProjectInitializationCancelledError extends Error {
    constructor() {
        super("SNES project initialization was cancelled.");
        this.name = "SnesProjectInitializationCancelledError";
    }
}
/** Return an empty shard bundle used before the first analysis pass. */
const emptyShards = () => ({
    analysis: [],
    annotations: [],
    labels: [],
    comments: [],
    regions: [],
    runtime: [],
    evidence: [],
    imports: [],
});
/**
 * Emit a structured progress event when a callback is configured.
 * @param options Operation options carrying the progress hook.
 * @param stage Current initialization stage.
 * @param message Human-readable status line.
 */
const report = (options, stage, message) => options.onProgress?.({ stage, message });
/** Throw the cancellation error when the supplied signal is already aborted. */
const throwIfCancelled = (signal) => {
    if (signal?.aborted) {
        throw new SnesProjectInitializationCancelledError();
    }
};
/** Reject compressed or misnamed Diz sidecar paths before reading bytes. */
const assertDizRawFile = (file) => {
    if (path.extname(file).toLowerCase() !== ".dizraw") {
        throw new Error("Only uncompressed .dizraw imports are supported. Compressed .diz input is not supported.");
    }
};
/** Read and import one `.dizraw` file against the expected ROM size. */
const importDizRawFile = (file, rom) => {
    assertDizRawFile(file);
    return importDizRaw(fs.readFileSync(file, "utf8"), {
        sourceName: path.basename(file),
        expectedRomSize: rom.length,
    });
};
/** Require a missing or empty directory before staging project files. */
const ensureWritableDestination = (directory) => {
    if (!fs.existsSync(directory)) {
        return;
    }
    const stat = fs.statSync(directory);
    if (!stat.isDirectory()) {
        throw new Error(`Destination '${directory}' is not a directory.`);
    }
    if (fs.readdirSync(directory).length > 0) {
        throw new Error(`Destination '${directory}' must be empty.`);
    }
};
/** Create a unique sibling temp directory under the destination parent. */
const temporarySibling = (destination, suffix) => {
    const resolved = path.resolve(destination);
    const parent = path.dirname(resolved);
    fs.mkdirSync(parent, { recursive: true });
    return fs.mkdtempSync(path.join(parent, `.${path.basename(resolved)}.${suffix}-`));
};
/** Best-effort recursive delete used when abandoning staging trees. */
const removeDirectory = (directory) => {
    fs.rmSync(directory, { recursive: true, force: true });
};
/**
 * Atomically replaces a missing or empty destination with a completely prepared staging tree.
 * Existing non-empty destinations are never merged or overwritten.
 * @param staging Fully prepared sibling directory.
 * @param destination Missing or empty destination directory.
 */
const commitStagedDirectory = (staging, destination) => {
    const resolved = path.resolve(destination);
    ensureWritableDestination(resolved);
    if (!fs.existsSync(resolved)) {
        fs.renameSync(staging, resolved);
        return;
    }
    const backup = `${resolved}.empty-${path.basename(staging)}`;
    fs.renameSync(resolved, backup);
    try {
        fs.renameSync(staging, resolved);
        fs.rmdirSync(backup);
    }
    catch (error) {
        if (!fs.existsSync(resolved) && fs.existsSync(backup)) {
            fs.renameSync(backup, resolved);
        }
        throw error;
    }
};
/**
 * Loads a ROM and optional DizRaw project without writing anything.
 * The result contains ranked mapper candidates and whether the host must ask the user to choose.
 * @param options ROM, optional DizRaw file, and operation controls.
 * @returns Ranked detection and import metadata.
 */
export const probeSnesProject = (options) => {
    throwIfCancelled(options.signal);
    report(options, "probe", "Reading ROM and detecting the SNES cartridge mapping.");
    const rom = RomImage.load(path.resolve(options.romFile), options.headerSize === undefined ? {} : { headerSize: options.headerSize });
    const detection = detectSnesRom(rom, {
        ...(options.mapper === undefined ? {} : { mapper: options.mapper }),
        ...(options.headerSize === undefined ? {} : { headerSize: options.headerSize }),
    });
    throwIfCancelled(options.signal);
    const imported = options.dizRawFile
        ? importDizRawFile(path.resolve(options.dizRawFile), rom)
        : undefined;
    const detectedMapper = detection.mapper;
    const importedMapper = imported?.mapping.mapper;
    const conflict = options.mapper === undefined &&
        detectedMapper !== undefined &&
        importedMapper !== undefined &&
        detectedMapper !== importedMapper;
    const ambiguous = options.mapper === undefined && detectedMapper === undefined;
    let mapperSelectionReason;
    if (conflict) {
        mapperSelectionReason = `.dizraw mapper '${importedMapper}' conflicts with detected mapper '${detectedMapper}'.`;
    }
    else if (ambiguous) {
        mapperSelectionReason = detection.message ?? "SNES mapper detection is ambiguous.";
    }
    return {
        target: TARGET_ID,
        architecture: ARCHITECTURE_ID,
        rom: rom.identity,
        detection,
        ...(imported
            ? {
                dizRaw: {
                    mapping: imported.mapping,
                    report: imported.report,
                    metadataBytes: imported.metadataBytes,
                },
            }
            : {}),
        mapperSelectionRequired: conflict || ambiguous,
        ...(mapperSelectionReason ? { mapperSelectionReason } : {}),
    };
};
/**
 * Creates a native analysis project through a staged sibling directory.
 * @param options ROM, mapping, import, and destination options.
 * @returns Committed project and import summary.
 */
export const createSnesAnalysisProject = (options) => {
    const projectDirectory = path.resolve(options.projectDirectory);
    ensureWritableDestination(projectDirectory);
    const probe = probeSnesProject(options);
    if (probe.mapperSelectionRequired || probe.detection.mapper === undefined) {
        throw new Error(`${probe.mapperSelectionReason ?? "SNES mapper detection is ambiguous."} Select an explicit mapper before creating the project.`);
    }
    throwIfCancelled(options.signal);
    report(options, "create", "Creating the native analysis project.");
    const rom = RomImage.load(path.resolve(options.romFile), {
        headerSize: probe.rom.headerSize,
    });
    const imported = options.dizRawFile
        ? importDizRawFile(path.resolve(options.dizRawFile), rom)
        : undefined;
    const mapper = options.mapper ?? probe.detection.mapper;
    const importWarnings = imported && options.mapper && options.mapper !== imported.mapping.mapper
        ? [
            ...imported.report.warnings,
            `Explicit mapper '${options.mapper}' overrides imported mapper '${imported.mapping.mapper}'.`,
        ]
        : imported?.report.warnings;
    const importReport = imported
        ? { ...imported.report, ...(importWarnings ? { warnings: importWarnings } : {}) }
        : undefined;
    let mappingSource = "detected";
    if (options.mapper) {
        mappingSource = "override";
    }
    else if (imported) {
        mappingSource = "import";
    }
    const mapping = {
        mapper,
        ...((imported?.mapping.speed ?? probe.detection.speed)
            ? { speed: imported?.mapping.speed ?? probe.detection.speed }
            : {}),
        ...(probe.detection.headerOffset === undefined
            ? {}
            : { headerOffset: probe.detection.headerOffset }),
        source: mappingSource,
        candidates: probe.detection.candidates,
    };
    const project = {
        manifest: {
            format: ANALYSIS_PROJECT_FORMAT,
            schemaVersion: ANALYSIS_PROJECT_SCHEMA_VERSION,
            target: TARGET_ID,
            rom: rom.identity,
            mapping,
            addressSpaces: [
                { id: SNES_FILE_ADDRESS_SPACE, name: "ROM file offset", addressBits: 24, kind: "file" },
                { id: SNES_CPU_ADDRESS_SPACE, name: "SNES CPU bus", addressBits: 24, kind: "cpu" },
                SNES_WRAM_ADDRESS_SPACE_DESCRIPTOR,
                SNES_SRAM_ADDRESS_SPACE_DESCRIPTOR,
                SPC700_ARAM_ADDRESS_SPACE_DESCRIPTOR,
                SUPERFX_ROM_ADDRESS_SPACE_DESCRIPTOR,
            ],
        },
        shards: imported
            ? { ...imported.shards, imports: importReport ? [importReport] : [] }
            : emptyShards(),
    };
    const staging = temporarySibling(projectDirectory, "analysis");
    try {
        const manifest = publishAnalysisProject(staging, project).manifest;
        validateAnalysisProject(staging, rom);
        throwIfCancelled(options.signal);
        commitStagedDirectory(staging, projectDirectory);
        return {
            projectDirectory,
            probe,
            manifest,
            ...(importReport ? { importReport } : {}),
        };
    }
    catch (error) {
        removeDirectory(staging);
        throw error;
    }
};
/** Collect half-open ROM intervals covered by published CFG nodes. */
const codeRanges = (records) => records.flatMap((record) => record.kind === "cfg-node" && record.fileOffset !== undefined
    ? [{ start: record.fileOffset, end: record.fileOffset + record.size }]
    : []);
/**
 * Runs bounded conservative 65816 analysis and atomically updates the native project.
 * Completion describes explored work, not proof that all code was found. An incomplete pass that
 * would discard previously decoded code throws before replacing saved analysis. This synchronous
 * operation checks cancellation at phase boundaries and cannot observe queued abort callbacks mid-pass.
 * @param options Project, ROM, entry points, and work limits.
 * @returns Structured analysis counts and completion state.
 */
export const analyzeSnesProject = (options) => {
    throwIfCancelled(options.signal);
    const started = Date.now();
    const elapsed = () => `${((Date.now() - started) / 1000).toFixed(1)}s elapsed`;
    const progress = (stage, message) => report(options, stage, `${message} (${elapsed()})`);
    progress("analyze", "Phase 1/6: preparing SQL instruction indexes.");
    const projectDirectory = path.resolve(options.projectDirectory);
    const store = openAnalysisProjectStore(projectDirectory);
    let previousCode = [];
    const loaded = (() => {
        try {
            if (store.researchInputsIdentity() !== options.research?.hash) {
                throw new Error("Analysis requires the selected Git research snapshot.");
            }
            const revision = analysisProjectRevision(store.manifest());
            store.prepareAnnotationQueries();
            progress("analyze", "Phase 2/6: grouping captured instruction variants in SQLite.");
            const groupingStarted = Date.now();
            store.runtimeInstructionVariants(ARCHITECTURE_ID, SNES_CPU_ADDRESS_SPACE, ["p", "P", "e", "E", "db", "DB", "d", "D"], { p: { max: 255, mask: 0x30 }, P: { max: 255, mask: 0x30 } }, (processedObservations, totalObservations) => {
                const percent = totalObservations === 0 ? 100 : (processedObservations / totalObservations) * 100;
                let remaining = "estimating remaining time";
                if (processedObservations > 0) {
                    const seconds = (Date.now() - groupingStarted) / 1000;
                    remaining = `~${((seconds * (totalObservations - processedObservations)) / processedObservations).toFixed(1)}s remaining`;
                }
                if (processedObservations === totalObservations) {
                    remaining = "grouping input complete";
                }
                throwIfCancelled(options.signal);
                options.onProgress?.({
                    stage: "analyze",
                    message: `Phase 2/6: grouped ${count(processedObservations)}/${count(totalObservations)} captured instruction observations (${percent.toFixed(1)}%, ${remaining}; ${elapsed()}).`,
                    processedObservations,
                    totalObservations,
                });
            });
            progress("analyze", "Phase 3/6: loading metadata, execution seeds and known code.");
            return store.transaction(() => {
                assertAnalysisProjectRevision(store, revision);
                const manifest = store.manifest();
                const view = {
                    labels: store.loadTable("labels"),
                    comments: store.loadTable("comments"),
                    annotations: store.loadTable("annotations"),
                    regions: store.loadTable("regions"),
                    evidence: store.loadTable("evidence"),
                    imports: [],
                    analysis: store.analysisByKinds(["target-override", "target-set"]),
                    // Static seeds consume execution PCs only. MMIO observations remain queryable evidence;
                    // materializing them here can exhaust the heap without contributing to code analysis.
                    runtime: store.runtimeExecutionSeeds(ARCHITECTURE_ID, SNES_CPU_ADDRESS_SPACE),
                };
                // Reanalysis consumes decoder variants and seed totals. All original facts stay
                // authoritative in SQLite and are excluded from the metadata-only commit below.
                store.validateView(view);
                previousCode = store.codeRanges();
                const retiredIds = view.evidence
                    .filter((record) => record.sourceId === "snes.function-roles.v1")
                    .map((record) => record.id);
                return {
                    manifest,
                    view,
                    revision,
                    retainedRuntimeEvidence: store.runtimeEvidenceReferences(retiredIds),
                };
            }, false);
        }
        finally {
            store.close();
        }
    })();
    progress("analyze", `Loaded ${count(loaded.view.annotations.length)} annotations, ${count(loaded.view.labels.length)} labels, ${count(loaded.view.runtime.length)} execution seeds and ${count(previousCode.length)} known code ranges.`);
    const rom = RomImage.load(path.resolve(options.romFile), {
        headerSize: loaded.manifest.rom.headerSize,
    });
    validateProjectRom(loaded.manifest, rom);
    const mapper = loaded.manifest.mapping.mapper;
    if (!isSnesMapper(mapper)) {
        throw new Error(`Unsupported SNES mapper '${mapper}'.`);
    }
    const addressContext = createSnesAddressContext(mapper);
    const editableRecords = loaded.view.analysis.filter((record) => record.kind === "target-override" || record.kind === "target-set");
    const targetOverrides = editableRecords.filter((record) => record.kind === "target-override");
    const targetSets = editableRecords.filter((record) => record.kind === "target-set");
    const configured = new Map();
    for (const entry of options.entryPoints ?? []) {
        if (snesRomAddressSpace.toOutputOffset(entry.address, addressContext) < 0) {
            continue;
        }
        const previous = configured.get(entry.address);
        configured.set(entry.address, previous
            ? {
                ...previous,
                evidence: [
                    ...new Set([...(previous.evidence ?? []), ...(entry.evidence ?? [])]),
                ].toSorted(),
            }
            : entry);
    }
    const runtimeCandidates = new Map();
    for (const record of loaded.view.runtime) {
        if (record.kind !== "runtime-execution" ||
            record.architecture !== ARCHITECTURE_ID ||
            record.addressSpace !== SNES_CPU_ADDRESS_SPACE) {
            continue;
        }
        const candidate = runtimeCandidates.get(record.address) ?? {
            address: record.address,
            count: 0,
            evidence: new Set(),
        };
        candidate.count += record.count;
        for (const id of record.evidence) {
            candidate.evidence.add(id);
        }
        runtimeCandidates.set(record.address, candidate);
    }
    const rankedRuntime = [...runtimeCandidates.values()].toSorted((left, right) => right.count - left.count || left.address - right.address);
    let addedRuntimeSeeds = 0;
    for (const candidate of rankedRuntime) {
        // RAM PCs are decoded from captured bytes below, not queued as ROM seeds.
        if (snesRomAddressSpace.toOutputOffset(candidate.address, addressContext) < 0) {
            continue;
        }
        const previous = configured.get(candidate.address);
        if (previous) {
            configured.set(candidate.address, {
                ...previous,
                evidence: [...new Set([...(previous.evidence ?? []), ...candidate.evidence])].toSorted(),
            });
            continue;
        }
        if (addedRuntimeSeeds >= MAX_PERSISTED_RUNTIME_ENTRY_POINTS) {
            continue;
        }
        configured.set(candidate.address, {
            id: `runtime-${candidate.address.toString(16).padStart(6, "0")}`,
            address: candidate.address,
            kind: "observation",
            evidence: [...candidate.evidence].toSorted(),
        });
        addedRuntimeSeeds++;
    }
    const runtimeSeeds = rankedRuntime.filter(({ address }) => configured.has(address)).length;
    progress("analyze", `Phase 4/6: exploring static control flow from ${count(configured.size)} entry points.`);
    // Retain the publication records, not the worklist CFG and its decoded abstract-state graph.
    // The latter is much larger and has no consumers during captured decoding or SQLite publication.
    const result = (() => {
        const analysis = analyzeSnes65816(rom, mapper, {
            retainGraph: false,
            compactContextIds: true,
            onProgress: ({ processedWorkItems, queuedWorkItems, instructions }) => {
                throwIfCancelled(options.signal);
                progress("analyze", `Phase 4/6: ${count(processedWorkItems)} work items processed, ${count(queuedWorkItems)} queued, ${count(instructions)} instructions decoded.`);
            },
            annotations: loaded.view.annotations,
            labels: loaded.view.labels,
            evidence: loaded.view.evidence,
            entryPoints: [...configured.values()],
            targetOverrides,
            targetSets,
            ...(options.maxWorkItems === undefined ? {} : { maxWorkItems: options.maxWorkItems }),
            ...(options.maxCallDepth === undefined ? {} : { maxCallDepth: options.maxCallDepth }),
        });
        throwIfCancelled(options.signal);
        const staticConflicts = analysis.records.reduce((total, record) => total + Number(record.kind === "conflict"), 0);
        progress("analyze", `Static pass ${analysis.status}: ${count(analysis.processedWorkItems)} work items, ${count(analysis.coverage.instructionCount)} instructions, ${count(staticConflicts)} conflicts. Phase 5/6: decoding captured instruction variants.`);
        const romBytes = rom.bytes();
        // recordsFor creates detached publication records owned by this analysis. Attach bytes to those
        // records directly so the static CFG can be collected without another copy of every code node.
        for (const record of analysis.records) {
            if (record.kind === "cfg-node" && record.fileOffset !== undefined) {
                Object.assign(record, {
                    bytes: Array.from(romBytes.subarray(record.fileOffset, record.fileOffset + record.size)),
                });
            }
        }
        return {
            status: analysis.status,
            processedWorkItems: analysis.processedWorkItems,
            incompleteReasons: analysis.incompleteReasons,
            annotations: analysis.annotations,
            evidenceRecords: analysis.evidenceRecords,
            records: analysis.records,
        };
    })();
    const capturedStore = openAnalysisProjectStore(projectDirectory);
    const capturedRecords = (() => {
        try {
            const variants = capturedStore.runtimeInstructionVariants(ARCHITECTURE_ID, SNES_CPU_ADDRESS_SPACE, ["p", "P", "e", "E", "db", "DB", "d", "D"], { p: { max: 255, mask: 0x30 }, P: { max: 255, mask: 0x30 } }, undefined, (representatives) => {
                throwIfCancelled(options.signal);
                progress("analyze", `Phase 5/6: staged ${count(representatives)} instruction representatives in storage order.`);
            });
            return capturedStore.transaction(() => {
                assertAnalysisProjectRevision(capturedStore, loaded.revision);
                return analyzeSnesRuntimeCode(loaded.view, rom, mapper, variants, (message) => {
                    throwIfCancelled(options.signal);
                    progress("analyze", `Phase 5/6: ${message}`);
                });
            }, false);
        }
        finally {
            capturedStore.close();
        }
    })();
    const analysisRecords = [...editableRecords, ...result.records, ...capturedRecords];
    if (result.status === "incomplete") {
        const lost = lostCodeRanges(previousCode, codeRanges(analysisRecords));
        if (lost.length > 0) {
            const bytes = lost.reduce((total, range) => total + range.end - range.start, 0);
            throw new Error(`Incomplete analysis would discard ${bytes} known code byte(s), starting at ROM offset ` +
                `$${lost[0].start.toString(16).toUpperCase().padStart(6, "0")}. ` +
                `The previous analysis was preserved. ${result.incompleteReasons.map(({ message }) => message).join(" ")} ` +
                "Increase the analysis limits or narrow the entry points before regenerating source.");
        }
    }
    const annotations = [
        ...loaded.view.annotations.filter((annotation) => !annotation.id.startsWith("static:65816:")),
        ...result.annotations,
    ];
    // Only reserved detector-owned comments are removed. Manual wording is never an ownership signal.
    const comments = loaded.view.comments.filter((comment) => !comment.id.startsWith("heuristic:snes:"));
    const retainedEvidence = new Set(loaded.retainedRuntimeEvidence);
    for (const records of [
        loaded.view.labels,
        comments,
        annotations,
        loaded.view.regions,
        analysisRecords,
    ]) {
        for (const record of records) {
            for (const id of record.evidence) {
                retainedEvidence.add(id);
            }
        }
    }
    const evidence = [
        ...loaded.view.evidence.filter((record) => record.sourceId !== "snes.65816.static-v1" &&
            // User records may have adopted old detector provenance. Keep those references valid.
            (record.sourceId !== "snes.function-roles.v1" || retainedEvidence.has(record.id)) &&
            !record.id.startsWith("detector:vector:")),
        ...result.evidenceRecords,
    ];
    // Compare byte unions rather than instruction counts: mirrored contexts and changed boundaries
    // must not inflate the import report's gains. Navigation retains a real instruction identity.
    const addedRanges = lostCodeRanges(codeRanges(analysisRecords), previousCode);
    const codeNodes = analysisRecords
        .filter((record) => record.kind === "cfg-node" && record.fileOffset !== undefined)
        .toSorted((left, right) => left.fileOffset - right.fileOffset);
    let codeIndex = 0;
    const addedCode = addedRanges.map((range) => {
        while (codeIndex < codeNodes.length &&
            codeNodes[codeIndex].fileOffset + codeNodes[codeIndex].size <= range.start) {
            codeIndex++;
        }
        const node = codeNodes[codeIndex];
        return {
            start: range.start,
            end: range.end,
            addressSpace: node.addressSpace,
            address: node.address,
            recordIds: [node.id],
        };
    });
    progress("commit", `Phase 6/6: publishing ${count(analysisRecords.length)} analysis records, ${count(annotations.length)} annotations, ${count(comments.length)} comments and ${count(evidence.length)} evidence records.`);
    throwIfCancelled(options.signal);
    const updates = {
        analysis: analysisRecords,
        comments,
        annotations,
        evidence,
    };
    const written = (() => {
        if (!options.research) {
            return commitAnalysisProjectViewUpdate(projectDirectory, loaded, updates).manifest;
        }
        const publication = openAnalysisProjectStore(projectDirectory);
        try {
            const manifest = publication.transaction(() => {
                options.assertResearchCurrent?.();
                throwIfCancelled(options.signal);
                assertAnalysisProjectRevision(publication, loaded.revision);
                publication.replaceResearchAnalysis(options.research, updates, (collection) => progress("commit", `Phase 6/6: prepared ${collection}; validating the atomic analysis publication.`), loaded.view);
                // Research publication validates the complete projected graph using this revision-pinned
                // view. Retained runtime provenance is checked in SQLite in the same writer transaction.
                progress("commit", "Phase 6/6: validated selected research and complete derived graph.");
                return publication.manifest();
            });
            publication.writePointer(projectDirectory);
            return manifest;
        }
        finally {
            publication.close();
        }
    })();
    return {
        projectDirectory,
        manifest: written,
        status: result.status,
        instructions: analysisRecords.filter((record) => record.kind === "cfg-node").length,
        capturedInstructions: capturedRecords.filter((record) => record.kind === "cfg-node").length,
        addedCode,
        runtimePcsWithoutCode: (() => {
            const covered = new Set(analysisRecords
                .filter((record) => record.kind === "cfg-node")
                .map((record) => record.address));
            return rankedRuntime.filter((record) => !covered.has(record.address)).length;
        })(),
        functions: analysisRecords.filter((record) => record.kind === "function").length,
        conflicts: analysisRecords.filter((record) => record.kind === "conflict").length,
        unresolved: analysisRecords.filter((record) => record.kind === "unresolved").length,
        processedWorkItems: result.processedWorkItems,
        runtimeSeeds,
        omittedRuntimeSeeds: rankedRuntime.filter(({ address }) => snesRomAddressSpace.toOutputOffset(address, addressContext) >= 0).length - runtimeSeeds,
        incompleteReasons: result.incompleteReasons,
    };
};
//# sourceMappingURL=project-initializer.js.map
import * as fs from "node:fs";
import path from "node:path";

import {
  ANALYSIS_PROJECT_FORMAT,
  ANALYSIS_PROJECT_SCHEMA_VERSION,
  RomImage,
  openAnalysisProjectStore,
  analysisProjectRevision,
  assertAnalysisProjectRevision,
  commitAnalysisProjectViewUpdate,
  validateAnalysisProject,
  validateProjectRom,
  publishAnalysisProject,
  type AnalysisProject,
  type AnalysisProjectManifest,
  type AnalysisProjectShards,
  type AnalysisTargetOverrideRecord,
  type AnalysisTargetSetRecord,
  type ImportReport,
  type ProjectMapping,
  type RomIdentity,
  type StaticAnalysisIncompleteReason,
  type ResearchSnapshot,
  type CaptureAddedCode,
  type AnalysisControlFlowNodeRecord,
} from "@uttori/asm-disassembler";

import { snesRomAddressSpace } from "../target/address-space.js";
import { analyzeSnes65816, type Snes65816EntryPoint } from "./65816-analysis.js";
import {
  createSnesAddressContext,
  SNES_CPU_ADDRESS_SPACE,
  SNES_FILE_ADDRESS_SPACE,
  SNES_SRAM_ADDRESS_SPACE_DESCRIPTOR,
  SNES_WRAM_ADDRESS_SPACE_DESCRIPTOR,
} from "./address-identities.js";
import { lostCodeRanges } from "./code-preservation.js";
import { importDizRaw } from "./dizraw-import.js";
import {
  detectSnesRom,
  isSnesMapper,
  type SnesMapper,
  type SnesRomDetection,
} from "./rom-header.js";
import { analyzeSnesRuntimeCode } from "./runtime-code.js";
import { SPC700_ARAM_ADDRESS_SPACE_DESCRIPTOR } from "./spc700-address-space.js";
import { SUPERFX_ROM_ADDRESS_SPACE_DESCRIPTOR } from "./superfx-address-space.js";

/** Stable target id written to native SNES analysis projects. */
const TARGET_ID = "snes.sfc";
const ARCHITECTURE_ID = "snes.65816";
/** Stable digit grouping for progress messages, independent of the worker locale. */
const count = (value: number): string => value.toLocaleString("en-US");
const MAX_PERSISTED_RUNTIME_ENTRY_POINTS = 1_000_000;

/** Stages emitted by project initialization progress callbacks. */
export type SnesProjectInitializationStage = "probe" | "create" | "analyze" | "commit";

/** One structured progress event. */
export interface SnesProjectInitializationProgress {
  readonly stage: SnesProjectInitializationStage;
  readonly message: string;
  /** Instruction observations grouped so far; these derived counts are not published yet. */
  readonly processedObservations?: number;
  /** Exact grouping input count from the same SQLite read snapshot. */
  readonly totalObservations?: number;
}

/** Shared cancellation and progress controls for long-running operations. */
export interface SnesProjectOperationOptions {
  /** Checked at operation boundaries. Synchronous analysis and filesystem writes are not preempted. */
  readonly signal?: AbortSignal;
  /** Called synchronously. A throw stops the operation before publishing analysis. */
  readonly onProgress?: (progress: SnesProjectInitializationProgress) => void;
}

/** Thrown when a project operation observes an aborted signal. */
export class SnesProjectInitializationCancelledError extends Error {
  constructor() {
    super("SNES project initialization was cancelled.");
    this.name = "SnesProjectInitializationCancelledError";
  }
}

/** Optional DizRaw metadata returned by a read-only probe. */
export interface SnesDizRawProbe {
  readonly mapping: ProjectMapping;
  readonly report: ImportReport;
  readonly metadataBytes: number;
}

/** Content-based ROM and optional DizRaw inspection result. */
export interface SnesProjectProbeResult {
  readonly target: typeof TARGET_ID;
  readonly architecture: typeof ARCHITECTURE_ID;
  readonly rom: RomIdentity;
  readonly detection: SnesRomDetection;
  readonly dizRaw?: SnesDizRawProbe;
  /** True when an explicit mapper is required before project creation. */
  readonly mapperSelectionRequired: boolean;
  /** Human-readable reason for requesting a mapper. */
  readonly mapperSelectionReason?: string;
}

/** Read-only inspection inputs. Relative paths resolve from process.cwd(). */
export interface ProbeSnesProjectOptions extends SnesProjectOperationOptions {
  readonly romFile: string;
  readonly dizRawFile?: string;
  /** Explicit cartridge mapping. Omit for detection, which can require a user choice. */
  readonly mapper?: SnesMapper;
  /** Copier-header byte count. Omit for file-size-based detection. */
  readonly headerSize?: 0 | 512;
}

/** Creates a project only in a missing or empty directory, without copying the ROM. */
export interface CreateSnesAnalysisProjectOptions extends ProbeSnesProjectOptions {
  readonly projectDirectory: string;
}

/** Structured result of native analysis-project creation. */
export interface CreateSnesAnalysisProjectResult {
  readonly projectDirectory: string;
  readonly probe: SnesProjectProbeResult;
  readonly manifest: AnalysisProjectManifest;
  readonly importReport?: ImportReport;
}

/** Reanalysis preserves manual annotations and runtime evidence, and rejects concurrent project edits. */
export interface AnalyzeSnesProjectOptions extends SnesProjectOperationOptions {
  readonly projectDirectory: string;
  readonly romFile: string;
  /** Selected Git decisions must already be indexed and are reapplied atomically after analysis. */
  readonly research?: ResearchSnapshot;
  /** Recheck branch inputs under the publication lock; a throw leaves the previous analysis intact. */
  readonly assertResearchCurrent?: () => void;
  /** Additional CPU bus addresses with explicit state, alongside vector and saved runtime seeds. */
  readonly entryPoints?: readonly Snes65816EntryPoint[];
  /** Positive safe integer work limit. Omitted uses the analyzer default of 1_000_000. */
  readonly maxWorkItems?: number;
  /** Nonnegative call-context depth. Omitted uses the analyzer default of 16. Zero discards call history. */
  readonly maxCallDepth?: number;
}

/** Structured summary of one bounded static-analysis pass. */
export interface AnalyzeSnesProjectResult {
  readonly projectDirectory: string;
  readonly manifest: AnalysisProjectManifest;
  readonly status: "complete" | "incomplete";
  readonly instructions: number;
  readonly capturedInstructions: number;
  /** ROM bytes newly decoded by this pass compared with the previously published code coverage. */
  readonly addedCode: readonly CaptureAddedCode[];
  readonly runtimePcsWithoutCode: number;
  readonly functions: number;
  readonly conflicts: number;
  readonly unresolved: number;
  readonly processedWorkItems: number;
  /** Unique persisted runtime PCs supplied to the analyzer, including explicit overlaps. */
  readonly runtimeSeeds: number;
  /** Lower-ranked persisted runtime PCs omitted by the deterministic seed safety bound. */
  readonly omittedRuntimeSeeds: number;
  readonly incompleteReasons: readonly StaticAnalysisIncompleteReason[];
}

const emptyShards = (): AnalysisProjectShards => ({
  analysis: [],
  annotations: [],
  labels: [],
  comments: [],
  regions: [],
  runtime: [],
  evidence: [],
  imports: [],
});

const report = (
  options: SnesProjectOperationOptions,
  stage: SnesProjectInitializationStage,
  message: string,
): void => options.onProgress?.({ stage, message });

const throwIfCancelled = (signal?: AbortSignal): void => {
  if (signal?.aborted) {
    throw new SnesProjectInitializationCancelledError();
  }
};

const assertDizRawFile = (file: string): void => {
  if (path.extname(file).toLowerCase() !== ".dizraw") {
    throw new Error(
      "Only uncompressed .dizraw imports are supported. Compressed .diz input is not supported.",
    );
  }
};

const importDizRawFile = (file: string, rom: RomImage) => {
  assertDizRawFile(file);
  return importDizRaw(fs.readFileSync(file, "utf8"), {
    sourceName: path.basename(file),
    expectedRomSize: rom.length,
  });
};

const ensureWritableDestination = (directory: string): void => {
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

const temporarySibling = (destination: string, suffix: string): string => {
  const resolved = path.resolve(destination);
  const parent = path.dirname(resolved);
  fs.mkdirSync(parent, { recursive: true });
  return fs.mkdtempSync(path.join(parent, `.${path.basename(resolved)}.${suffix}-`));
};

const removeDirectory = (directory: string): void => {
  fs.rmSync(directory, { recursive: true, force: true });
};

/**
 * Atomically replaces a missing or empty destination with a completely prepared staging tree.
 * Existing non-empty destinations are never merged or overwritten.
 * @param {string} staging Fully prepared sibling directory.
 * @param {string} destination Missing or empty destination directory.
 * @returns {void}
 */
const commitStagedDirectory = (staging: string, destination: string): void => {
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
  } catch (error) {
    if (!fs.existsSync(resolved) && fs.existsSync(backup)) {
      fs.renameSync(backup, resolved);
    }
    throw error;
  }
};

/**
 * Loads a ROM and optional DizRaw project without writing anything.
 * The result contains ranked mapper candidates and whether the host must ask the user to choose.
 * @param {ProbeSnesProjectOptions} options ROM, optional DizRaw file, and operation controls.
 * @returns {SnesProjectProbeResult} Ranked detection and import metadata.
 */
export const probeSnesProject = (options: ProbeSnesProjectOptions): SnesProjectProbeResult => {
  throwIfCancelled(options.signal);
  report(options, "probe", "Reading ROM and detecting the SNES cartridge mapping.");
  const rom = RomImage.load(
    path.resolve(options.romFile),
    options.headerSize === undefined ? {} : { headerSize: options.headerSize },
  );
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
  const conflict =
    options.mapper === undefined &&
    detectedMapper !== undefined &&
    importedMapper !== undefined &&
    detectedMapper !== importedMapper;
  const ambiguous = options.mapper === undefined && detectedMapper === undefined;
  let mapperSelectionReason: string | undefined;
  if (conflict) {
    mapperSelectionReason = `.dizraw mapper '${importedMapper}' conflicts with detected mapper '${detectedMapper}'.`;
  } else if (ambiguous) {
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
 * @param {CreateSnesAnalysisProjectOptions} options ROM, mapping, import, and destination options.
 * @returns {CreateSnesAnalysisProjectResult} Committed project and import summary.
 */
export const createSnesAnalysisProject = (
  options: CreateSnesAnalysisProjectOptions,
): CreateSnesAnalysisProjectResult => {
  const projectDirectory = path.resolve(options.projectDirectory);
  ensureWritableDestination(projectDirectory);
  const probe = probeSnesProject(options);
  if (probe.mapperSelectionRequired || probe.detection.mapper === undefined) {
    throw new Error(
      `${probe.mapperSelectionReason ?? "SNES mapper detection is ambiguous."} Select an explicit mapper before creating the project.`,
    );
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
  const importWarnings =
    imported && options.mapper && options.mapper !== imported.mapping.mapper
      ? [
          ...imported.report.warnings,
          `Explicit mapper '${options.mapper}' overrides imported mapper '${imported.mapping.mapper}'.`,
        ]
      : imported?.report.warnings;
  const importReport = imported
    ? { ...imported.report, ...(importWarnings ? { warnings: importWarnings } : {}) }
    : undefined;
  let mappingSource: ProjectMapping["source"] = "detected";
  if (options.mapper) {
    mappingSource = "override";
  } else if (imported) {
    mappingSource = "import";
  }
  const mapping: ProjectMapping = {
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
  const project: AnalysisProject = {
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
  } catch (error) {
    removeDirectory(staging);
    throw error;
  }
};

const codeRanges = (records: AnalysisProjectShards["analysis"]) =>
  records.flatMap((record) =>
    record.kind === "cfg-node" && record.fileOffset !== undefined
      ? [{ start: record.fileOffset, end: record.fileOffset + record.size }]
      : [],
  );

/**
 * Runs bounded conservative 65816 analysis and atomically updates the native project.
 * Completion describes explored work, not proof that all code was found. An incomplete pass that
 * would discard previously decoded code throws before replacing saved analysis. This synchronous
 * operation checks cancellation at phase boundaries and cannot observe queued abort callbacks mid-pass.
 * @param {AnalyzeSnesProjectOptions} options Project, ROM, entry points, and work limits.
 * @returns {AnalyzeSnesProjectResult} Structured analysis counts and completion state.
 */
export const analyzeSnesProject = (
  options: AnalyzeSnesProjectOptions,
): AnalyzeSnesProjectResult => {
  throwIfCancelled(options.signal);
  const started = Date.now();
  const elapsed = (): string => `${((Date.now() - started) / 1000).toFixed(1)}s elapsed`;
  const progress = (stage: SnesProjectInitializationStage, message: string): void =>
    report(options, stage, `${message} (${elapsed()})`);
  progress("analyze", "Phase 1/6: preparing SQL instruction indexes.");
  const projectDirectory = path.resolve(options.projectDirectory);
  const store = openAnalysisProjectStore(projectDirectory);
  let previousCode: { start: number; end: number }[] = [];
  const loaded = (() => {
    try {
      if (store.researchInputsIdentity() !== options.research?.hash) {
        throw new Error("Analysis requires the selected Git research snapshot.");
      }
      const revision = analysisProjectRevision(store.manifest());
      store.prepareAnnotationQueries();
      progress("analyze", "Phase 2/6: grouping captured instruction variants in SQLite.");
      const groupingStarted = Date.now();
      store.runtimeInstructionVariants(
        ARCHITECTURE_ID,
        SNES_CPU_ADDRESS_SPACE,
        ["p", "P", "e", "E", "db", "DB", "d", "D"],
        { p: { max: 255, mask: 0x30 }, P: { max: 255, mask: 0x30 } },
        (processedObservations, totalObservations) => {
          const percent =
            totalObservations === 0 ? 100 : (processedObservations / totalObservations) * 100;
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
        },
      );
      progress("analyze", "Phase 3/6: loading metadata, execution seeds and known code.");
      return store.transaction(() => {
        assertAnalysisProjectRevision(store, revision);
        const manifest = store.manifest();
        const view: AnalysisProjectShards = {
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
    } finally {
      store.close();
    }
  })();
  progress(
    "analyze",
    `Loaded ${count(loaded.view.annotations.length)} annotations, ${count(loaded.view.labels.length)} labels, ${count(loaded.view.runtime.length)} execution seeds and ${count(previousCode.length)} known code ranges.`,
  );
  const rom = RomImage.load(path.resolve(options.romFile), {
    headerSize: loaded.manifest.rom.headerSize,
  });
  validateProjectRom(loaded.manifest, rom);
  const mapper = loaded.manifest.mapping.mapper;
  if (!isSnesMapper(mapper)) {
    throw new Error(`Unsupported SNES mapper '${mapper}'.`);
  }
  const addressContext = createSnesAddressContext(mapper);
  const editableRecords = loaded.view.analysis.filter(
    (record): record is AnalysisTargetOverrideRecord | AnalysisTargetSetRecord =>
      record.kind === "target-override" || record.kind === "target-set",
  );
  const targetOverrides = editableRecords.filter(
    (record): record is AnalysisTargetOverrideRecord => record.kind === "target-override",
  );
  const targetSets = editableRecords.filter(
    (record): record is AnalysisTargetSetRecord => record.kind === "target-set",
  );
  const configured = new Map<number, Snes65816EntryPoint>();
  for (const entry of options.entryPoints ?? []) {
    if (snesRomAddressSpace.toOutputOffset(entry.address, addressContext) < 0) {
      continue;
    }
    const previous = configured.get(entry.address);
    configured.set(
      entry.address,
      previous
        ? {
            ...previous,
            evidence: [
              ...new Set([...(previous.evidence ?? []), ...(entry.evidence ?? [])]),
            ].toSorted(),
          }
        : entry,
    );
  }
  const runtimeCandidates = new Map<
    number,
    { readonly address: number; count: number; evidence: Set<string> }
  >();
  for (const record of loaded.view.runtime) {
    if (
      record.kind !== "runtime-execution" ||
      record.architecture !== ARCHITECTURE_ID ||
      record.addressSpace !== SNES_CPU_ADDRESS_SPACE
    ) {
      continue;
    }
    const candidate = runtimeCandidates.get(record.address) ?? {
      address: record.address,
      count: 0,
      evidence: new Set<string>(),
    };
    candidate.count += record.count;
    for (const id of record.evidence) {
      candidate.evidence.add(id);
    }
    runtimeCandidates.set(record.address, candidate);
  }
  const rankedRuntime = [...runtimeCandidates.values()].toSorted(
    (left, right) => right.count - left.count || left.address - right.address,
  );
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
  progress(
    "analyze",
    `Phase 4/6: exploring static control flow from ${count(configured.size)} entry points.`,
  );
  // Retain the publication records, not the worklist CFG and its decoded abstract-state graph.
  // The latter is much larger and has no consumers during captured decoding or SQLite publication.
  const result = (() => {
    const analysis = analyzeSnes65816(rom, mapper, {
      retainGraph: false,
      compactContextIds: true,
      onProgress: ({ processedWorkItems, queuedWorkItems, instructions }) => {
        throwIfCancelled(options.signal);
        progress(
          "analyze",
          `Phase 4/6: ${count(processedWorkItems)} work items processed, ${count(queuedWorkItems)} queued, ${count(instructions)} instructions decoded.`,
        );
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
    const staticConflicts = analysis.records.reduce(
      (total, record) => total + Number(record.kind === "conflict"),
      0,
    );
    progress(
      "analyze",
      `Static pass ${analysis.status}: ${count(analysis.processedWorkItems)} work items, ${count(analysis.coverage.instructionCount)} instructions, ${count(staticConflicts)} conflicts. Phase 5/6: decoding captured instruction variants.`,
    );
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
      const variants = capturedStore.runtimeInstructionVariants(
        ARCHITECTURE_ID,
        SNES_CPU_ADDRESS_SPACE,
        ["p", "P", "e", "E", "db", "DB", "d", "D"],
        { p: { max: 255, mask: 0x30 }, P: { max: 255, mask: 0x30 } },
        undefined,
        (representatives) => {
          throwIfCancelled(options.signal);
          progress(
            "analyze",
            `Phase 5/6: staged ${count(representatives)} instruction representatives in storage order.`,
          );
        },
      );
      return capturedStore.transaction(() => {
        assertAnalysisProjectRevision(capturedStore, loaded.revision);
        return analyzeSnesRuntimeCode(loaded.view, rom, mapper, variants, (message) => {
          throwIfCancelled(options.signal);
          progress("analyze", `Phase 5/6: ${message}`);
        });
      }, false);
    } finally {
      capturedStore.close();
    }
  })();
  const analysisRecords = [...editableRecords, ...result.records, ...capturedRecords];
  if (result.status === "incomplete") {
    const lost = lostCodeRanges(previousCode, codeRanges(analysisRecords));
    if (lost.length > 0) {
      const bytes = lost.reduce((total, range) => total + range.end - range.start, 0);
      throw new Error(
        `Incomplete analysis would discard ${bytes} known code byte(s), starting at ROM offset ` +
          `$${lost[0].start.toString(16).toUpperCase().padStart(6, "0")}. ` +
          `The previous analysis was preserved. ${result.incompleteReasons.map(({ message }) => message).join(" ")} ` +
          "Increase the analysis limits or narrow the entry points before regenerating source.",
      );
    }
  }
  const annotations = [
    ...loaded.view.annotations.filter((annotation) => !annotation.id.startsWith("static:65816:")),
    ...result.annotations,
  ];
  // Only reserved detector-owned comments are removed. Manual wording is never an ownership signal.
  const comments = loaded.view.comments.filter(
    (comment) => !comment.id.startsWith("heuristic:snes:"),
  );
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
    ...loaded.view.evidence.filter(
      (record) =>
        record.sourceId !== "snes.65816.static-v1" &&
        // User records may have adopted old detector provenance. Keep those references valid.
        (record.sourceId !== "snes.function-roles.v1" || retainedEvidence.has(record.id)) &&
        !record.id.startsWith("detector:vector:"),
    ),
    ...result.evidenceRecords,
  ];
  // Compare byte unions rather than instruction counts: mirrored contexts and changed boundaries
  // must not inflate the import report's gains. Navigation retains a real instruction identity.
  const addedRanges = lostCodeRanges(codeRanges(analysisRecords), previousCode);
  const codeNodes = analysisRecords
    .filter(
      (record): record is AnalysisControlFlowNodeRecord =>
        record.kind === "cfg-node" && record.fileOffset !== undefined,
    )
    .toSorted((left, right) => left.fileOffset! - right.fileOffset!);
  let codeIndex = 0;
  const addedCode = addedRanges.map((range): CaptureAddedCode => {
    while (
      codeIndex < codeNodes.length &&
      codeNodes[codeIndex].fileOffset! + codeNodes[codeIndex].size <= range.start
    ) {
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
  progress(
    "commit",
    `Phase 6/6: publishing ${count(analysisRecords.length)} analysis records, ${count(annotations.length)} annotations, ${count(comments.length)} comments and ${count(evidence.length)} evidence records.`,
  );
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
        publication.replaceResearchAnalysis(
          options.research!,
          updates,
          (collection) =>
            progress(
              "commit",
              `Phase 6/6: prepared ${collection}; validating the atomic analysis publication.`,
            ),
          loaded.view,
        );
        // Research publication validates the complete projected graph using this revision-pinned
        // view. Retained runtime provenance is checked in SQLite in the same writer transaction.
        progress("commit", "Phase 6/6: validated selected research and complete derived graph.");
        return publication.manifest();
      });
      publication.writePointer(projectDirectory);
      return manifest;
    } finally {
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
      const covered = new Set(
        analysisRecords
          .filter((record) => record.kind === "cfg-node")
          .map((record) => record.address),
      );
      return rankedRuntime.filter((record) => !covered.has(record.address)).length;
    })(),
    functions: analysisRecords.filter((record) => record.kind === "function").length,
    conflicts: analysisRecords.filter((record) => record.kind === "conflict").length,
    unresolved: analysisRecords.filter((record) => record.kind === "unresolved").length,
    processedWorkItems: result.processedWorkItems,
    runtimeSeeds,
    omittedRuntimeSeeds:
      rankedRuntime.filter(
        ({ address }) => snesRomAddressSpace.toOutputOffset(address, addressContext) >= 0,
      ).length - runtimeSeeds,
    incompleteReasons: result.incompleteReasons,
  };
};

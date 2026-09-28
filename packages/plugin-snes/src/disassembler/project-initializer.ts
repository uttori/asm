import * as fs from "node:fs";
import path from "node:path";

import { Assembler, canonicalDebugMapJson, createDebugMap } from "@uttori/asm-core";
import type { AssemblerEnvironment } from "@uttori/asm-core/plugin";
import {
  ANALYSIS_PROJECT_FORMAT,
  ANALYSIS_PROJECT_SCHEMA_VERSION,
  RomImage,
  compareByteImages,
  openAnalysisProjectStore,
  analysisProjectRevision,
  assertAnalysisProjectRevision,
  commitAnalysisProjectViewUpdate,
  loadSourceExportManifest,
  sourceGenerationIdentity,
  assertSourceGeneration,
  validateAnalysisProject,
  validateProjectRom,
  validateSourceExportFiles,
  validateSourceExportInputs,
  publishAnalysisProject,
  type AnalysisProject,
  type AnalysisProjectManifest,
  type AnalysisProjectShards,
  type AnalysisTargetOverrideRecord,
  type AnalysisTargetSetRecord,
  type ByteComparison,
  type ImportReport,
  type ProjectMapping,
  type RomIdentity,
  type SourceExportManifest,
  type StaticAnalysisIncompleteReason,
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
  analyzeSnesFunctionRoles,
  validateSnesHeuristicConfiguration,
  type SnesHeuristicConfiguration,
} from "./function-heuristics.js";
import { snesHardwareDefines } from "./hardware-registers.js";
import {
  detectSnesRom,
  SNES_MAPPERS,
  type SnesMapper,
  type SnesRomDetection,
} from "./rom-header.js";
import { analyzeSnesRuntimeCode } from "./runtime-code.js";
import { exportSnes65816Source } from "./source-export.js";
import { SPC700_ARAM_ADDRESS_SPACE_DESCRIPTOR } from "./spc700-address-space.js";
import { SUPERFX_ROM_ADDRESS_SPACE_DESCRIPTOR } from "./superfx-address-space.js";

/** Stable target id written to native SNES analysis projects. */
const TARGET_ID = "snes.sfc";
const ARCHITECTURE_ID = "snes.65816";
const MAX_PERSISTED_RUNTIME_ENTRY_POINTS = 1_000_000;

/** Stages emitted by project initialization progress callbacks. */
export type SnesProjectInitializationStage =
  | "probe"
  | "create"
  | "analyze"
  | "export"
  | "verify"
  | "configure"
  | "commit";

/** One structured progress event. */
export interface SnesProjectInitializationProgress {
  readonly stage: SnesProjectInitializationStage;
  readonly message: string;
  /** Instruction observations grouped so far; these derived counts are not published yet. */
  readonly processedObservations?: number;
}

/** Shared cancellation and progress controls for long-running operations. */
export interface SnesProjectOperationOptions {
  /** Checked at operation boundaries. Synchronous analysis and filesystem writes are not preempted. */
  readonly signal?: AbortSignal;
  /** Called synchronously. A throw stops the operation and can leave an existing export partially written. */
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
  readonly heuristics?: SnesHeuristicConfiguration;
  readonly projectDirectory: string;
  readonly romFile: string;
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
  readonly runtimePcsWithoutCode: number;
  readonly heuristicRoles: number;
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

/** Regenerates files owned by the export manifest while retaining user-owned input maps. */
export interface ExportSnesProjectOptions extends SnesProjectOperationOptions {
  /** Preferred dataStruct/row width including indentation; integer >= 40, defaults to 100. */
  readonly structLineWidth?: number;
  /** Wrap generated assembly comments; defaults to true. */
  readonly wrapComments?: boolean;
  /** Preferred comment columns including indentation, integer >= 20; default 100. */
  readonly commentLineWidth?: number;
  readonly projectDirectory: string;
  readonly romFile: string;
  readonly sourceDirectory: string;
  /** Allow replacing modified generated files. Does not permit code regression or delete input maps. */
  readonly force?: boolean;
  /** Explicitly permit previously emitted instructions to become raw bytes. */
  readonly allowCodeRegression?: boolean;
  /** Reject concurrent changes before writing source derived from a particular saved edit. */
  readonly expectedRevision?: string;
}

/** Structured source-export result. */
export interface ExportSnesProjectResult {
  readonly sourceDirectory: string;
  readonly manifest: SourceExportManifest;
  readonly codeBytes: number;
}

/** Requires unchanged generated files, current map inputs, and the original ROM identity. */
export interface VerifySnesProjectRoundTripOptions extends SnesProjectOperationOptions {
  readonly sourceDirectory: string;
  readonly romFile: string;
  /** Emit a debug map for the headerless content output. Defaults to true. */
  readonly emitDebugMap?: boolean;
  /** Emit a symbols/types include for bounded modification projects after exact verification. */
  readonly emitInterface?: boolean;
  /** Verify retained historical source bytes even when metadata inputs are newer than its manifest. */
  readonly retainedGeneration?: boolean;
  /** Trusted host loader called with the absolute build-configuration path after integrity and
   * ROM checks. The host owns plugin disposal after verification settles. Defaults to bundled
   * SNES support only; configured asset formats/transforms require a host loader.
   */
  readonly loadEnvironment?: (configurationFile: string) => Promise<{
    readonly environment: AssemblerEnvironment;
    readonly includePaths?: readonly string[];
    readonly targetOptions?: Readonly<Record<string, unknown>>;
  }>;
}

/** Byte-identical verification result and the generated build artifacts. */
export interface VerifySnesProjectRoundTripResult {
  readonly sourceDirectory: string;
  readonly contentOutput: string;
  readonly finalOutput: string;
  readonly debugMap?: string;
  /** Generated include of verified ROM labels, hardware/RAM constants, and data structures. */
  readonly interfaceFile?: string;
  readonly comparison: ByteComparison;
}

/** A host-owned file written to the staged workspace before it is committed. */
export interface SnesWorkspaceFile {
  /** Safe path relative to the workspace root. */
  readonly path: string;
  readonly contents: string | Uint8Array;
}

export interface InitializeSnesDisassemblyWorkspaceOptions extends ProbeSnesProjectOptions {
  readonly outputDirectory: string;
  readonly entryPoints?: readonly Snes65816EntryPoint[];
  readonly maxWorkItems?: number;
  readonly maxCallDepth?: number;
  /** Files such as editor settings supplied by the host, written inside the transaction. */
  readonly workspaceFiles?: readonly SnesWorkspaceFile[];
}

/** Complete, committed disassembly workspace initialization result. */
export interface InitializeSnesDisassemblyWorkspaceResult {
  readonly outputDirectory: string;
  readonly probe: SnesProjectProbeResult;
  readonly project: CreateSnesAnalysisProjectResult;
  readonly analysis: AnalyzeSnesProjectResult;
  readonly source: ExportSnesProjectResult;
  readonly roundTrip: VerifySnesProjectRoundTripResult;
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

const safeWorkspacePath = (relative: string): string => {
  if (
    relative === "" ||
    path.isAbsolute(relative) ||
    relative.split(/[/\\]/).some((part) => part === "" || part === "..")
  ) {
    throw new Error(`Unsafe workspace file path '${relative}'.`);
  }
  return relative;
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
  const rom = RomImage.load(path.resolve(options.romFile), {
    ...(options.headerSize === undefined ? {} : { headerSize: options.headerSize }),
  });
  const detection = detectSnesRom(rom, {
    ...(options.mapper === undefined ? {} : { mapper: options.mapper }),
    ...(options.headerSize === undefined ? {} : { headerSize: options.headerSize }),
  });
  throwIfCancelled(options.signal);
  const imported = options.dizRawFile
    ? importDizRawFile(path.resolve(options.dizRawFile), rom)
    : undefined;
  const detectedMapper = detection.mapper;
  const importedMapper = imported?.mapping.mapper as SnesMapper | undefined;
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
  report(options, "analyze", "Preparing SQL instruction indexes.");
  const projectDirectory = path.resolve(options.projectDirectory);
  const store = openAnalysisProjectStore(projectDirectory);
  let previousCode: { start: number; end: number }[] = [];
  const loaded = (() => {
    try {
      const revision = analysisProjectRevision(store.manifest());
      store.prepareAnnotationQueries();
      report(options, "analyze", "Grouping captured instruction variants in SQLite.");
      store.runtimeInstructionVariants(
        ARCHITECTURE_ID,
        SNES_CPU_ADDRESS_SPACE,
        ["p", "P", "e", "E", "db", "DB", "d", "D"],
        { p: { max: 255, mask: 0x30 }, P: { max: 255, mask: 0x30 } },
        (processedObservations) => {
          throwIfCancelled(options.signal);
          options.onProgress?.({
            stage: "analyze",
            message: "Grouping captured instruction variants in SQLite.",
            processedObservations,
          });
        },
      );
      report(
        options,
        "analyze",
        "Loading metadata, execution seeds, MMIO observations and known code.",
      );
      return store.transaction(() => {
        assertAnalysisProjectRevision(store, revision);
        const manifest = store.manifest();
        const registers = [...new Set(snesHardwareDefines().map(([, address]) => address))];
        const addresses = [];
        for (let bank = 0; bank < 256; bank++) {
          if (bank <= 0x3f || (bank >= 0x80 && bank <= 0xbf)) {
            for (const low of registers) {
              addresses.push((bank << 16) | low);
            }
          }
        }
        const view: AnalysisProjectShards = {
          labels: store.loadTable("labels"),
          comments: store.loadTable("comments"),
          annotations: store.loadTable("annotations"),
          regions: store.loadTable("regions"),
          evidence: store.loadTable("evidence"),
          imports: [],
          analysis: store.analysisByKinds(["target-override", "target-set", "metadata-edit"]),
          runtime: [
            ...store.runtimeExecutionSeeds(ARCHITECTURE_ID, SNES_CPU_ADDRESS_SPACE),
            ...store.runtimeMemoryAtAddresses(ARCHITECTURE_ID, SNES_CPU_ADDRESS_SPACE, addresses),
          ],
        };
        // Reanalysis consumes decoder variants, seed totals and MMIO roles. All original facts stay
        // authoritative in SQLite and are excluded from the metadata-only commit below.
        store.validateView(view);
        previousCode = store.codeRanges();
        return { manifest, view, revision };
      }, false);
    } finally {
      store.close();
    }
  })();
  report(options, "analyze", "Building static analysis from the validated runtime view.");
  const rom = RomImage.load(path.resolve(options.romFile), {
    headerSize: loaded.manifest.rom.headerSize,
  });
  validateProjectRom(loaded.manifest, rom);
  if (!SNES_MAPPERS.includes(loaded.manifest.mapping.mapper as SnesMapper)) {
    throw new Error(`Unsupported SNES mapper '${loaded.manifest.mapping.mapper}'.`);
  }
  const heuristicFile = path.join(projectDirectory, "heuristics.json");
  const heuristicConfig = validateSnesHeuristicConfiguration(
    options.heuristics ??
      (fs.existsSync(heuristicFile) ? JSON.parse(fs.readFileSync(heuristicFile, "utf8")) : {}),
  );
  const addressContext = createSnesAddressContext(loaded.manifest.mapping.mapper as SnesMapper);
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
            ].sort(),
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
  const rankedRuntime = [...runtimeCandidates.values()].sort(
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
        evidence: [...new Set([...(previous.evidence ?? []), ...candidate.evidence])].sort(),
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
      evidence: [...candidate.evidence].sort(),
    });
    addedRuntimeSeeds++;
  }
  const runtimeSeeds = rankedRuntime.filter(({ address }) => configured.has(address)).length;
  const result = analyzeSnes65816(rom, loaded.manifest.mapping.mapper as SnesMapper, {
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
  report(options, "analyze", "Decoding captured instruction variants.");
  const capturedStore = openAnalysisProjectStore(projectDirectory);
  const capturedRecords = (() => {
    try {
      const variants = capturedStore.runtimeInstructionVariants(
        ARCHITECTURE_ID,
        SNES_CPU_ADDRESS_SPACE,
        ["p", "P", "e", "E", "db", "DB", "d", "D"],
        { p: { max: 255, mask: 0x30 }, P: { max: 255, mask: 0x30 } },
      );
      return capturedStore.transaction(() => {
        assertAnalysisProjectRevision(capturedStore, loaded.revision);
        return analyzeSnesRuntimeCode(
          loaded.view,
          rom,
          loaded.manifest.mapping.mapper as SnesMapper,
          variants,
        );
      }, false);
    } finally {
      capturedStore.close();
    }
  })();
  const romBytes = rom.bytes();
  const analysisRecords = [
    ...editableRecords,
    ...loaded.view.analysis.filter((record) => record.kind === "metadata-edit"),
    ...result.records.map((record) =>
      record.kind === "cfg-node" && record.fileOffset !== undefined
        ? {
            ...record,
            bytes: Array.from(
              romBytes.subarray(record.fileOffset, record.fileOffset + record.size),
            ),
          }
        : record,
    ),
    ...capturedRecords,
  ];
  if (result.status === "incomplete") {
    const codeRanges = (records: AnalysisProjectShards["analysis"]) =>
      records.flatMap((record) =>
        record.kind === "cfg-node" && record.fileOffset !== undefined
          ? [{ start: record.fileOffset, end: record.fileOffset + record.size }]
          : [],
      );
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
  report(options, "analyze", "Inferring function roles from static and captured code.");
  const heuristicResult = analyzeSnesFunctionRoles(
    { ...loaded.view, analysis: analysisRecords },
    heuristicConfig,
  );
  const annotations = [
    ...loaded.view.annotations.filter((annotation) => !annotation.id.startsWith("static:65816:")),
    ...result.annotations,
  ];
  const evidence = [
    ...loaded.view.evidence.filter(
      (record) =>
        record.sourceId !== "snes.65816.static-v1" &&
        record.sourceId !== "snes.function-roles.v1" &&
        !record.id.startsWith("detector:vector:"),
    ),
    ...result.evidenceRecords,
    ...heuristicResult.evidence,
  ];
  report(options, "commit", "Publishing analysis after checking for concurrent edits.");
  throwIfCancelled(options.signal);
  const written = commitAnalysisProjectViewUpdate(projectDirectory, loaded, {
    analysis: analysisRecords,
    comments: [
      ...loaded.view.comments.filter((comment) => !comment.id.startsWith("heuristic:snes:")),
      ...heuristicResult.comments,
    ],
    annotations,
    evidence,
  }).manifest;
  return {
    projectDirectory,
    manifest: written,
    status: result.status,
    instructions: analysisRecords.filter((record) => record.kind === "cfg-node").length,
    capturedInstructions: capturedRecords.filter((record) => record.kind === "cfg-node").length,
    runtimePcsWithoutCode: (() => {
      const covered = new Set(
        analysisRecords
          .filter((record) => record.kind === "cfg-node")
          .map((record) => record.address),
      );
      return rankedRuntime.filter((record) => !covered.has(record.address)).length;
    })(),
    heuristicRoles: heuristicResult.roles.length,
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

/**
 * Exports deterministic editable source from a verified native project.
 * Unjustified bytes remain raw assets. File hashes and code-preservation checks run before writes,
 * but regeneration is not a multi-file transaction. Preserve edits and retry after an I/O failure.
 * @param {ExportSnesProjectOptions} options Project, ROM, destination, and overwrite policy.
 * @returns {ExportSnesProjectResult} Source manifest and native-code coverage count.
 */
export const exportSnesProject = (options: ExportSnesProjectOptions): ExportSnesProjectResult => {
  throwIfCancelled(options.signal);
  report(options, "export", "Preparing SQL export indexes and metadata.");
  const projectDirectory = path.resolve(options.projectDirectory);
  const sourceDirectory = path.resolve(options.sourceDirectory);
  const store = openAnalysisProjectStore(projectDirectory);
  try {
    store.prepareAnnotationQueries();
    return store.transaction(() => {
      const loaded = store.sourceExportView();
      const revision = analysisProjectRevision(loaded.manifest);
      if (
        options.expectedRevision !== undefined &&
        options.expectedRevision !== revision.manifestSha256
      ) {
        throw new Error("Analysis changed before source refresh. Run regeneration again.");
      }
      const rom = RomImage.load(path.resolve(options.romFile), {
        headerSize: loaded.manifest.rom.headerSize,
      });
      validateProjectRom(loaded.manifest, rom);
      if (!SNES_MAPPERS.includes(loaded.manifest.mapping.mapper as SnesMapper)) {
        throw new Error(`Unsupported SNES mapper '${loaded.manifest.mapping.mapper}'.`);
      }
      report(options, "export", "Generating native source, binary assets and file manifests.");
      const manifest = exportSnes65816Source(loaded, rom, sourceDirectory, {
        structLineWidth: options.structLineWidth,
        wrapComments: options.wrapComments,
        commentLineWidth: options.commentLineWidth,
        force: options.force,
        allowCodeRegression: options.allowCodeRegression,
        sourceProjectSha256: revision.manifestSha256,
        instructionGroups: store.instructionExportGroups(),
      });
      throwIfCancelled(options.signal);
      return {
        sourceDirectory,
        manifest,
        codeBytes: manifest.spans
          .filter((span) => span.role === "code")
          .reduce((total, span) => total + span.end - span.start, 0),
      };
    }, false);
  } finally {
    store.close();
  }
};

/**
 * Assembles an exported tree and verifies the complete ROM byte-for-byte.
 * @param {VerifySnesProjectRoundTripOptions} options Source directory, ROM, and operation controls.
 * @returns {Promise<VerifySnesProjectRoundTripResult>} Exact comparison and build artifact paths.
 */
export const verifySnesProjectRoundTrip = async (
  options: VerifySnesProjectRoundTripOptions,
): Promise<VerifySnesProjectRoundTripResult> => {
  throwIfCancelled(options.signal);
  report(options, "verify", "Validating generated files, inputs and ROM identity.");
  const sourceDirectory = path.resolve(options.sourceDirectory);
  const generation = sourceGenerationIdentity(sourceDirectory);
  const manifest = loadSourceExportManifest(sourceDirectory);
  validateSourceExportFiles(sourceDirectory, manifest);
  if (!options.retainedGeneration) {
    validateSourceExportInputs(sourceDirectory, manifest);
  }
  const rom = RomImage.load(path.resolve(options.romFile), {
    headerSize: manifest.rom.headerSize,
  });
  if (
    rom.identity.sha256 !== manifest.rom.sha256 ||
    rom.identity.contentSha256 !== manifest.rom.contentSha256
  ) {
    throw new Error(
      `ROM identity mismatch: export expects ${manifest.rom.sha256}, received ${rom.identity.sha256}.`,
    );
  }
  report(options, "verify", "Preparing the assembler environment.");
  // Hosts resolve trusted project plugins relative to the manifest's configuration. Keep
  // Node module discovery outside this target package; new-workspace initialization can
  // still verify with the bundled SNES environment before it has a host configuration.
  let configured: Awaited<
    ReturnType<NonNullable<VerifySnesProjectRoundTripOptions["loadEnvironment"]>>
  >;
  if (options.loadEnvironment) {
    configured = await options.loadEnvironment(
      path.join(sourceDirectory, manifest.buildConfiguration),
    );
  } else {
    const { createSnesAssemblerEnvironment } = await import("../index.js");
    configured = { environment: await createSnesAssemblerEnvironment() };
  }
  throwIfCancelled(options.signal);
  const entrySource = path.join(sourceDirectory, manifest.entrySource);
  const assembler = new Assembler({
    environment: configured.environment,
    target: TARGET_ID,
    architecture: ARCHITECTURE_ID,
    // A round trip preserves the original checksum bytes even if normal builds repair them.
    targetOptions: { ...configured.targetOptions, checksumEnabled: false, checksumMode: "asar" },
    collectSourceMetadata: options.emitDebugMap ?? true,
  });
  try {
    assembler.setIncludePaths([...new Set([sourceDirectory, ...(configured.includePaths ?? [])])]);
    assembler.setCurrentFile(entrySource);
    report(options, "verify", "Parsing generated assembly and includes.");
    const source = fs.readFileSync(entrySource, "utf8");
    const program = assembler.buildProgramModel(source, entrySource, 0);
    report(options, "verify", "Assembling the ROM.");
    assembler.assembleProgram(program);
    throwIfCancelled(options.signal);
    assertSourceGeneration(sourceDirectory, generation);
    validateSourceExportFiles(sourceDirectory, manifest);
    report(options, "verify", "Writing build outputs and comparing ROM bytes.");
    const content = Buffer.from(assembler.getBinaryOutput());
    const contentOutput = path.join(sourceDirectory, manifest.contentOutput);
    const finalOutput = path.join(sourceDirectory, manifest.finalOutput);
    fs.mkdirSync(path.dirname(contentOutput), { recursive: true });
    fs.writeFileSync(contentOutput, content);
    const final =
      manifest.rom.headerSize === 0
        ? content
        : Buffer.concat([
            fs.readFileSync(
              path.join(
                sourceDirectory,
                manifest.spans.find((span) => span.role === "copier-header")!.file,
              ),
            ),
            content,
          ]);
    fs.mkdirSync(path.dirname(finalOutput), { recursive: true });
    fs.writeFileSync(finalOutput, final);
    const comparison = compareByteImages(rom.fileBytes(), final);
    if (!comparison.equal) {
      throw new Error(
        `Round-trip mismatch at file offset ${comparison.firstDifference ?? 0}: expected ${comparison.expectedSha256}, received ${comparison.actualSha256}.`,
      );
    }
    let debugMap: string | undefined;
    if (options.emitDebugMap ?? true) {
      report(options, "verify", "Generating the debug map.");
      debugMap = `${contentOutput}.debug.json`;
      fs.writeFileSync(
        debugMap,
        canonicalDebugMapJson(
          createDebugMap({
            target: TARGET_ID,
            output: content,
            mapping: assembler.addressToLineMapping,
            sourceRoot: sourceDirectory,
          }),
        ),
      );
    }
    let interfaceFile: string | undefined;
    if (options.emitInterface) {
      interfaceFile = path.join(path.dirname(contentOutput), "baseline-interface.asm");
      const definitions = ["defines.asm", "ram-defines.asm", "structs.asm"]
        .filter((file) => manifest.files.some((entry) => entry.path === file))
        .map((file) => fs.readFileSync(path.join(sourceDirectory, file), "utf8"));
      // Export actual resolved top-level ROM labels, never guessed addresses from comments.
      // Local/macro symbols remain private; layouts and field bindings come from structs.asm.
      const names = new Set(
        assembler.symbolDefinitions
          .filter(
            (entry) =>
              entry.kind === "label" &&
              path.dirname(entry.location.file) === path.join(sourceDirectory, "banks") &&
              /^[A-Z_a-z]\w*$/.test(entry.name),
          )
          .map((entry) => entry.name),
      );
      const labels = [...names].sort().map((name) => {
        const value = assembler.labelTable.get(name)?.value;
        if (!Number.isSafeInteger(value)) {
          throw new Error(`Unresolved interface label ${name}.`);
        }
        return `${name} = $${value!.toString(16)}`;
      });
      // Interface includes are read after assembly. Recheck their generation before
      // publishing them so an external source edit cannot pin mixed symbol definitions.
      assertSourceGeneration(sourceDirectory, generation);
      validateSourceExportFiles(sourceDirectory, manifest);
      if (!options.retainedGeneration) {
        validateSourceExportInputs(sourceDirectory, manifest);
      }
      fs.writeFileSync(
        interfaceFile,
        [
          "; Verified baseline interface. Regenerate through the modification workflow.",
          ...definitions,
          ...labels,
          "",
        ].join("\n"),
      );
    }
    return {
      sourceDirectory,
      contentOutput,
      finalOutput,
      ...(debugMap ? { debugMap } : {}),
      ...(interfaceFile ? { interfaceFile } : {}),
      comparison,
    };
  } finally {
    assembler.dispose();
  }
};

/**
 * Creates, analyzes, exports, verifies, configures, and atomically commits a complete workspace.
 * Nothing is written to the selected destination until every earlier stage has succeeded.
 * @param {InitializeSnesDisassemblyWorkspaceOptions} options Complete initialization inputs.
 * @returns {Promise<InitializeSnesDisassemblyWorkspaceResult>} Committed project stage results.
 */
export const initializeSnesDisassemblyWorkspace = async (
  options: InitializeSnesDisassemblyWorkspaceOptions,
): Promise<InitializeSnesDisassemblyWorkspaceResult> => {
  const outputDirectory = path.resolve(options.outputDirectory);
  ensureWritableDestination(outputDirectory);
  const staging = temporarySibling(outputDirectory, "workspace");
  const analysisTemporary = temporarySibling(outputDirectory, "workspace-analysis-destination");
  // createSnesAnalysisProject requires a missing or empty destination, and mkdtemp created this one.
  try {
    const shared = { signal: options.signal, onProgress: options.onProgress };
    const project = createSnesAnalysisProject({
      ...shared,
      romFile: options.romFile,
      dizRawFile: options.dizRawFile,
      mapper: options.mapper,
      headerSize: options.headerSize,
      projectDirectory: analysisTemporary,
    });
    const analysis = analyzeSnesProject({
      ...shared,
      projectDirectory: analysisTemporary,
      romFile: options.romFile,
      entryPoints: options.entryPoints,
      maxWorkItems: options.maxWorkItems,
      maxCallDepth: options.maxCallDepth,
    });
    const source = exportSnesProject({
      ...shared,
      projectDirectory: analysisTemporary,
      romFile: options.romFile,
      sourceDirectory: staging,
    });
    const roundTrip = await verifySnesProjectRoundTrip({
      ...shared,
      sourceDirectory: staging,
      romFile: options.romFile,
      emitDebugMap: true,
    });
    throwIfCancelled(options.signal);
    report(options, "configure", "Writing workspace configuration.");
    fs.renameSync(analysisTemporary, path.join(staging, "analysis"));
    for (const file of options.workspaceFiles ?? []) {
      const relative = safeWorkspacePath(file.path);
      const destination = path.join(staging, relative);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, file.contents);
    }
    throwIfCancelled(options.signal);
    report(options, "commit", "Committing the completed workspace.");
    commitStagedDirectory(staging, outputDirectory);
    const remap = (value: string): string =>
      path.join(outputDirectory, path.relative(staging, value));
    return {
      outputDirectory,
      probe: project.probe,
      project: {
        ...project,
        projectDirectory: path.join(outputDirectory, "analysis"),
      },
      analysis: {
        ...analysis,
        projectDirectory: path.join(outputDirectory, "analysis"),
      },
      source: { ...source, sourceDirectory: outputDirectory },
      roundTrip: {
        ...roundTrip,
        sourceDirectory: outputDirectory,
        contentOutput: remap(roundTrip.contentOutput),
        finalOutput: remap(roundTrip.finalOutput),
        ...(roundTrip.debugMap ? { debugMap: remap(roundTrip.debugMap) } : {}),
      },
    };
  } catch (error) {
    removeDirectory(staging);
    removeDirectory(analysisTemporary);
    throw error;
  }
};

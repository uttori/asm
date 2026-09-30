import * as fs from "node:fs";
import * as path from "node:path";

import {
  ANALYSIS_PROJECT_MANIFEST,
  RomImage,
  SOURCE_EXPORT_MANIFEST,
  sourceExportSha256,
  describeSourceExportFileIssue,
  inspectSourceExportFiles,
  loadSourceExportManifest,
  parseAnalysisProjectManifest,
  validateSourceExportInputs,
  type AnalysisProjectManifest,
  type SourceExportManifest,
} from "@uttori/asm-disassembler";
import { SNES_RAM_MAP_SOURCE, loadSnesRamMap } from "@uttori/asm-plugin-snes";
import {
  ProgressLocation,
  Uri,
  commands,
  window,
  workspace,
  type Disposable,
  type ExtensionContext,
  type LogOutputChannel,
} from "vscode";

import { DisassemblyMaintenanceClient, type MaintenanceRunOptions } from "./maintenance-client.js";
import {
  fileChanges,
  type DisassemblyEntrySeed,
  type DisassemblyMaintenanceTarget,
  type DisassemblyRegenerationSummary,
  type ProjectChoice,
  type ResolvedProjectSource,
  type ResolvedTarget,
} from "./maintenance-data.js";
export type {
  DisassemblyEntrySeed,
  DisassemblyMaintenanceTarget,
  DisassemblyRegenerationSummary,
} from "./maintenance-data.js";

import { findAnalysisProjectDirectories } from "../analysis/coverage-tree.js";
import { rememberedSnesRom, rememberSnesRom } from "../project/snes-rom-bindings.js";
import { renderBusTraceReport } from "../runtime/bus-trace-report.js";
import type { MaintenanceJobs, TraceImportSummary } from "./maintenance-jobs.js";
import { renderDisassemblyStorage } from "./storage-report.js";
import { DisassemblyTimings, renderMaintenanceTimings } from "./timings.js";

/** Re-run static analysis, rewrite generated source, and prove an exact ROM round trip. */
export const REGENERATE_DISASSEMBLY_COMMAND = "asm.disassembly.regenerate";
/** Explain whether generated source reflects the current analysis revision. */
export const DISASSEMBLY_STATUS_COMMAND = "asm.disassembly.status";
/** Import a saved instruction trace, use observed PCs as code seeds, and regenerate source. */
export const IMPORT_TRACE_AND_REGENERATE_COMMAND = "asm.trace.importRegenerate";
/** Import CPU/DMA/HDMA access evidence and display channel/phase activity. */
export const IMPORT_BUS_TRACE_COMMAND = "asm.trace.importBus";
/** Open the user-owned RAM map consumed by source regeneration. */
export const OPEN_RAM_MAP_COMMAND = "asm.ramMap.open";
/**
 * Format report sizes as binary MiB/KiB with fixed precision, or exact bytes for sizes below one
 * KiB.
 * @param {number} bytes File or ROM-content length in bytes.
 * @returns {string} Human-readable binary size with its unit.
 */
const formatBytes = (bytes: number): string => {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KiB`;
  }
  return `${bytes} bytes`;
};

/**
 * Include an explicit plus sign for nonnegative report deltas, including zero.
 * @param {number} value Before/after count delta.
 * @returns {string} Decimal delta with an explicit sign, including +0.
 */
const signed = (value: number): string => `${value >= 0 ? "+" : ""}${value}`;

/**
 * Format a report ratio to two decimal places, returning 0.00% when the denominator is zero.
 * @param {number} part Count or byte subtotal.
 * @param {number} total Matching denominator in the same units.
 * @returns {string} Percentage to two decimals, or 0.00% for an empty total.
 */
const percent = (part: number, total: number): string =>
  total === 0 ? "0.00%" : `${((part / total) * 100).toFixed(2)}%`;

/**
 * Renders a human-readable, testable before/after regeneration report.
 * @param {DisassemblyRegenerationSummary} summary Verified workflow measurements.
 * @returns {string} Markdown report with code and file deltas.
 */
export const renderDisassemblyRegenerationReport = (
  summary: DisassemblyRegenerationSummary,
): string => {
  const codeDelta = summary.after.codeBytes - summary.before.codeBytes;
  const instructionDelta = summary.after.instructions - summary.before.instructions;
  const sourceChanges = [
    ...summary.addedFiles.map((file) => `- Added: ${file}`),
    ...summary.changedFiles.map((file) => `- Changed: ${file}`),
    ...summary.removedFiles.map((file) => `- Removed: ${file}`),
  ];
  return `${[
    "# Disassembly update report",
    "",
    `Project: ${summary.projectDirectory}`,
    "",
    `Generated source: ${summary.sourceDirectory}`,
    "",
    "## Result",
    "",
    ...(summary.analysis
      ? [
          `- Runtime code seeds used: ${summary.analysis.runtimeSeeds} (${summary.entrySeeds} explicitly selected; ${summary.analysis.omittedRuntimeSeeds} omitted by the safety bound)`,
          `- Captured instruction variants: ${summary.analysis.capturedInstructions}. Observed PCs without decoded code: ${summary.analysis.runtimePcsWithoutCode}`,
        ]
      : ["- Refresh mode: saved analysis reused for all pending presentation edits"]),
    `- RAM variables mapped: ${summary.ramVariables}`,
    `- Static instruction nodes: ${summary.before.instructions} → ${summary.after.instructions} (${signed(instructionDelta)})`,
    `- Source emitted as code: ${formatBytes(summary.before.codeBytes)} → ${formatBytes(summary.after.codeBytes)} (${signed(codeDelta)} bytes)`,
    `- Code coverage: ${percent(summary.before.codeBytes, summary.before.contentBytes)} → ${percent(summary.after.codeBytes, summary.after.contentBytes)}`,
    ...(summary.analysis
      ? [
          `- Analysis status: ${summary.analysis.status}. ${summary.analysis.conflicts} conflict(s), ${summary.analysis.unresolved} unresolved flow(s)`,
        ]
      : []),
    `- Runtime execution facts retained: ${summary.after.runtimeRecords} address(es), ${summary.after.runtimeEvents} event(s)`,
    `- Exact round trip: yes (${summary.roundTripSha256})`,
    "",
    ...(summary.before.storage && summary.after.storage
      ? [renderDisassemblyStorage(summary.before.storage, summary.after.storage), ""]
      : []),
    renderMaintenanceTimings(summary.timings),
    "",
    "## Generated file changes",
    "",
    ...(sourceChanges.length ? sourceChanges : ["- No generated file bytes changed."]),
    "",
    "A positive code-byte delta means analysis converted ROM bytes from generated `incbin` assets into native instructions. A zero delta can still be correct when the observed PCs were already code or conservative decoding found conflicts.",
    "",
  ].join("\n")}\n`;
};

/**
 * Summarize the committed import without reading the capture again for routine ownership.
 * @param {TraceImportSummary} imported Counts and warnings from the completed import.
 * @param {string} traceFile Original capture path shown in the report.
 * @returns {string} Compact import section, also retained when regeneration fails.
 */
const renderTraceImportReport = (imported: TraceImportSummary, traceFile: string): string => {
  const merge = imported.changed
    ? `${imported.added.runtime} runtime address(es) and ${imported.added.evidence} evidence record(s) added`
    : "the identical trace evidence was already present";
  return [
    "## Trace import",
    "",
    ...(imported.warnings ?? []).map((warning) => `- ${warning}`),
    `- File: ${traceFile}`,
    `- Observed events: ${imported.observedEvents}`,
    `- Unique observed PCs: ${imported.executionRecords}`,
    `- Producer-dropped events: ${imported.droppedEvents}`,
    `- Merge: ${merge}`,
    "",
  ].join("\n");
};

/**
 * Open report text in a new untitled Markdown editor that remains open instead of occupying the
 * preview tab.
 * @param {string} content Complete Markdown report text.
 * @returns {Promise<void>} Completion after the non-preview editor opens.
 * @see https://code.visualstudio.com/api/references/vscode-api#workspace.openTextDocument
 * @see https://code.visualstudio.com/api/references/vscode-api#window.showTextDocument
 */
const showMarkdown = async (content: string): Promise<void> => {
  await window.showTextDocument(
    await workspace.openTextDocument({ language: "markdown", content }),
    { preview: false },
  );
};

/**
 * Check lexical containment in any file-backed workspace folder; equality is allowed and
 * sibling/path-prefix matches are rejected.
 * @param {string} directory Candidate local project or source directory.
 * @returns {boolean} Whether the resolved path is inside a file-backed workspace.
 */
const insideWorkspace = (directory: string): boolean => {
  const absolute = path.resolve(directory);
  return (workspace.workspaceFolders ?? []).some((folder) => {
    if (folder.uri.scheme !== "file") {
      return false;
    }
    const relative = path.relative(path.resolve(folder.uri.fsPath), absolute);
    return (
      relative === "" ||
      (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
    );
  });
};

/**
 * Read and validate the native manifest and return an absolute project directory; malformed or
 * unreadable manifests throw.
 * @param {string} directory Native project directory containing its manifest.
 * @returns {ProjectChoice} Validated manifest and absolute directory.
 */
const readProjectChoice = (directory: string): ProjectChoice => {
  const manifest = parseAnalysisProjectManifest(
    JSON.parse(fs.readFileSync(path.join(directory, ANALYSIS_PROJECT_MANIFEST), "utf8")),
  );
  return { directory: path.resolve(directory), manifest };
};

/**
 * Honor a valid explicit project or choose among discovered local workspace projects, optionally
 * filtering by ROM content hash.
 * Invalid explicit selections throw; no candidates or picker cancellation return undefined.
 * @param {string} [preferred] Explicit native project directory, if supplied.
 * @param {string} [romContentSha256] Optional required headerless ROM SHA-256.
 * @returns {Promise<ProjectChoice | undefined>} Matching selection, or undefined for no match/cancellation.
 * @see https://code.visualstudio.com/api/references/vscode-api#window.showQuickPick
 */
const chooseProject = async (
  preferred?: string,
  romContentSha256?: string,
): Promise<ProjectChoice | undefined> => {
  if (preferred) {
    if (!insideWorkspace(preferred)) {
      throw new Error("The analysis project must be inside the trusted workspace.");
    }
    const selected = readProjectChoice(preferred);
    if (romContentSha256 && selected.manifest.rom.contentSha256 !== romContentSha256) {
      throw new Error("The selected trace and analysis project describe different ROM content.");
    }
    return selected;
  }
  const choices = (await findAnalysisProjectDirectories())
    .filter(insideWorkspace)
    .flatMap((directory) => {
      try {
        const choice = readProjectChoice(directory);
        return !romContentSha256 || choice.manifest.rom.contentSha256 === romContentSha256
          ? [choice]
          : [];
      } catch {
        return [];
      }
    });
  if (choices.length === 0) {
    return undefined;
  }
  if (choices.length === 1) {
    return choices[0];
  }
  return (
    await window.showQuickPick(
      choices.map((choice) => ({
        label: path.basename(choice.directory),
        description: choice.directory,
        choice,
      })),
      { title: "Choose the analysis project to update" },
    )
  )?.choice;
};

/** Select a matching workspace project before an opt-in live bus recording starts.
 * @param {string} romContentSha256 Verified debug-session ROM identity.
 * @returns {Promise<string | undefined>} Matching project directory, or cancellation/no match.
 */
export const chooseLiveBusProject = async (
  romContentSha256: string,
): Promise<string | undefined> => {
  if (!workspace.isTrusted) {
    throw new Error("Live bus analysis requires a trusted workspace.");
  }
  return (await chooseProject(undefined, romContentSha256))?.directory;
};

/**
 * Load a generated-source manifest only when its ROM content hash matches the chosen project;
 * return undefined on mismatch or read/parse failure.
 * @param {string} directory Candidate generated-source directory.
 * @param {ProjectChoice} project Selected project whose content hash must match.
 * @returns {SourceExportManifest | undefined} Matching source manifest, or undefined on failure/mismatch.
 */
const sourceMatches = (
  directory: string,
  project: ProjectChoice,
): SourceExportManifest | undefined => {
  try {
    const manifest = loadSourceExportManifest(directory);
    return manifest.rom.contentSha256 === project.manifest.rom.contentSha256 ? manifest : undefined;
  } catch {
    return undefined;
  }
};

/**
 * Prefer an explicit matching source export, then the project parent, then up to 64 workspace
 * manifest candidates.
 * Invalid explicit selections throw; no matches or picker cancellation return undefined.
 * @param {ProjectChoice} project Validated analysis project selection.
 * @param {string} [preferred] Explicit generated-source directory, if supplied.
 * @returns {Promise<object | undefined>} Matching export and directory, or undefined for no match/cancellation.
 * @see https://code.visualstudio.com/api/references/vscode-api#window.showQuickPick
 */
const chooseSource = async (
  project: ProjectChoice,
  preferred?: string,
): Promise<{ directory: string; manifest: SourceExportManifest } | undefined> => {
  if (preferred) {
    if (!insideWorkspace(preferred)) {
      throw new Error("Generated source must be inside the trusted workspace.");
    }
    const manifest = sourceMatches(path.resolve(preferred), project);
    if (!manifest) {
      throw new Error("The selected source export does not match this analysis project.");
    }
    return { directory: path.resolve(preferred), manifest };
  }
  const nearby = path.dirname(project.directory);
  const nearManifest = sourceMatches(nearby, project);
  if (nearManifest) {
    return { directory: nearby, manifest: nearManifest };
  }
  const files = await workspace.findFiles(
    `**/${SOURCE_EXPORT_MANIFEST}`,
    "**/{node_modules,.git}/**",
    64,
  );
  const matches = files.flatMap((file) => {
    const directory = path.dirname(file.fsPath);
    const manifest = insideWorkspace(directory) ? sourceMatches(directory, project) : undefined;
    return manifest ? [{ directory, manifest }] : [];
  });
  if (matches.length === 0) {
    return undefined;
  }
  if (matches.length === 1) {
    return matches[0];
  }
  return (
    await window.showQuickPick(
      matches.map((match) => ({
        label: path.basename(match.directory),
        description: match.directory,
        match,
      })),
      { title: "Choose the generated disassembly to update" },
    )
  )?.match;
};

/**
 * Load a candidate with the recorded copier-header size and require both file and content
 * SHA-256 matches; return undefined on mismatch or load failure.
 * @param {string} file Candidate local ROM filename.
 * @param {AnalysisProjectManifest} manifest Expected ROM hashes and copier-header size.
 * @returns {RomImage | undefined} Exact ROM image, or undefined on mismatch/load failure.
 */
const exactRom = (file: string, manifest: AnalysisProjectManifest): RomImage | undefined => {
  try {
    const rom = RomImage.load(file, { headerSize: manifest.rom.headerSize });
    return rom.identity.sha256 === manifest.rom.sha256 &&
      rom.identity.contentSha256 === manifest.rom.contentSha256
      ? rom
      : undefined;
  } catch {
    return undefined;
  }
};

/**
 * Try the remembered ROM and generated outputs before prompting, verify exact project identity,
 * and remember the accepted path.
 * Return undefined on cancellation; a manually selected mismatched ROM throws.
 * @param {ExtensionContext} context Extension storage for machine-local ROM bindings.
 * @param {ProjectChoice} project Project with authoritative ROM identity.
 * @param {string} sourceDirectory Generated-source root containing output candidates.
 * @param {SourceExportManifest} source Export manifest naming candidate ROM outputs.
 * @returns {Promise<string | undefined>} Verified local ROM path, or undefined on cancellation.
 * @see https://code.visualstudio.com/api/references/vscode-api#window.showOpenDialog
 */
const chooseRom = async (
  context: ExtensionContext,
  project: ProjectChoice,
  sourceDirectory: string,
  source: SourceExportManifest,
): Promise<string | undefined> => {
  const candidates = [
    rememberedSnesRom(context, project.manifest.rom.contentSha256),
    path.join(sourceDirectory, source.finalOutput),
    ...(project.manifest.rom.headerSize === 0
      ? [path.join(sourceDirectory, source.contentOutput)]
      : []),
  ].filter((value): value is string => Boolean(value));
  for (const file of candidates) {
    if (fs.existsSync(file) && exactRom(file, project.manifest)) {
      await rememberSnesRom(context, project.manifest.rom, file);
      return file;
    }
  }
  const selected = await window.showOpenDialog({
    title: "Select the original ROM for analysis and exact verification",
    canSelectFiles: true,
    canSelectFolders: false,
    canSelectMany: false,
    filters: { "SNES ROM": ["sfc", "smc", "bin", "rom"], "All files": ["*"] },
  });
  const file = selected?.[0]?.fsPath;
  if (!file) {
    return undefined;
  }
  const rom = exactRom(file, project.manifest);
  if (!rom) {
    throw new Error(
      `ROM identity mismatch. The project expects ${project.manifest.rom.contentSha256}.`,
    );
  }
  await rememberSnesRom(context, rom.identity, file);
  return file;
};

/**
 * Resolve project and source-export hints, optionally constraining the ROM identity; report
 * unavailable/cancelled selections and return undefined.
 * @param {DisassemblyMaintenanceTarget} [target] Optional project/source command hints; defaults to discovery.
 * @param {string} [expectedRom] Optional required headerless ROM SHA-256.
 * @returns {Promise<ResolvedProjectSource | undefined>} Matching project/source pair, or undefined after an unavailable selection.
 */
const resolveProjectSource = async (
  target: DisassemblyMaintenanceTarget = {},
  expectedRom?: string,
): Promise<ResolvedProjectSource | undefined> => {
  const project = await chooseProject(target.projectDirectory, expectedRom);
  if (!project) {
    void window.showErrorMessage("Assembly: no matching native analysis project was found.");
    return undefined;
  }
  const source = await chooseSource(project, target.sourceDirectory);
  if (!source) {
    void window.showErrorMessage("Assembly: no matching generated disassembly was found.");
    return undefined;
  }
  return {
    projectDirectory: project.directory,
    sourceDirectory: source.directory,
    sourceManifest: source.manifest,
  };
};

/**
 * Resolve a matching project/source pair and an exact local ROM for analysis and verification;
 * return undefined when selection cannot complete.
 * @param {ExtensionContext} context Extension storage used for remembered ROM paths.
 * @param {DisassemblyMaintenanceTarget} [target] Optional command hints; defaults to discovery.
 * @param {string} [expectedRom] Optional required headerless ROM SHA-256.
 * @returns {Promise<ResolvedTarget | undefined>} Project/source/ROM selection, or undefined when selection cannot complete.
 */
export const resolveTarget = async (
  context: ExtensionContext,
  target: DisassemblyMaintenanceTarget = {},
  expectedRom?: string,
): Promise<ResolvedTarget | undefined> => {
  const resolved = await resolveProjectSource(target, expectedRom);
  if (!resolved) {
    return undefined;
  }
  const project = readProjectChoice(resolved.projectDirectory);
  const romFile = await chooseRom(
    context,
    project,
    resolved.sourceDirectory,
    resolved.sourceManifest,
  );
  return romFile ? { ...resolved, romFile } : undefined;
};

/** Explicit editor settings override the persisted policy. Unset settings leave CLI/project choices intact.
 * @param {string} directory Source workspace used to resolve settings.
 * @returns {object} Explicit policy overrides in bytes, days and counts.
 */
const traceStoragePolicy = (directory: string) => {
  const config = workspace.getConfiguration("asm", Uri.file(directory));
  const policy: Record<string, number> = {};
  for (const [setting, key, multiplier] of [
    ["analysis.cacheMaxMiB", "cacheMaxBytes", 1024 ** 2],
    ["analysis.storageMaxMiB", "databaseMaxBytes", 1024 ** 2],
  ] as const) {
    const inspected = config.inspect<number>(setting);
    const value =
      inspected?.workspaceFolderValue ?? inspected?.workspaceValue ?? inspected?.globalValue;
    if (value !== undefined) {
      policy[key] = value * multiplier;
    }
  }
  return policy;
};

/** Leave an unset profile to the importer so other processors retain their full state.
 * @param {string} directory Workspace owning the capture import settings.
 * @returns {import("@uttori/asm-disassembler").RuntimeTraceIndexMode | undefined} Explicit profile override.
 */
const configuredTraceIndex = (directory: string) => {
  const config = workspace.getConfiguration("asm", Uri.file(directory));
  const setting =
    config.inspect<import("@uttori/asm-disassembler").RuntimeTraceIndexMode>("trace.indexMode");
  return setting?.workspaceFolderValue ?? setting?.workspaceValue ?? setting?.globalValue;
};

/** Stable report labels for process operations. Elapsed time includes the entire child lifetime. */
const maintenanceStepNames: Record<keyof MaintenanceJobs, string> = {
  retentionReview: "Review retained storage",
  retentionPin: "Pin retained artifact",
  retentionPrune: "Clean up reviewed history",
  metadataMigrationReview: "Review metadata migration",
  metadataMigrationApply: "Create verified workspace with migrated metadata",
  editorPreview: "Validate visual editor draft",
  editorSave: "Save reviewed visual edit",
  baselineRetain: "Retain verified baseline for recovery and rebase",
  assetExtract: "Extract editable native asset",
  assetImport: "Validate and import owned asset",
  placementApply: "Apply explicit allocation and pointers",
  replacementRemove: "Remove ROM replacement ownership",
  rebaseReview: "Prepare three-way baseline rebase",
  rebaseRefresh: "Review manually reconciled candidate inputs",
  rebaseAccept: "Verify and accept reviewed rebase",
  sourceDetach: "Create manually owned source project",
  sourceReview: "Preserve and review external source edit",
  sourceRestore: "Restore reviewed generated source and verify baseline",
  sourceImport: "Import reviewed source edit and verify generation",
  modificationCreate: "Verify baseline and create owned modification project",
  modificationAdd: "Create bounded ROM replacement",
  modificationBuild: "Verify and build modified ROM",
  modificationDerive: "Create analysis workspace for modified ROM",
  publish: "Stage, verify and publish a recoverable source generation",
  refreshEligible: "Select refresh or reanalysis for pending edits",
  publicationStatus: "Read durable publication outcome",
  recover: "Recover interrupted source publication",
  prepare: "Read baseline counts and validate generated files",
  coverage: "Read updated SQL counts",
  analyze: "Analyze code and publish SQLite changes",
  export: "Generate source and binary assets",
  refresh: "Refresh source from saved analysis",
  revision: "Check final project revision",
  verify: "Assemble and verify every ROM byte",
  traceIdentity: "Read trace identity",
  busIdentity: "Read bus capture identity",
  import: "Parse trace and import into SQLite",
  importBus: "Parse bus capture and import into SQLite",
};

/**
 * Keep worker stage measurements under their parent phase, including failed or cancelled jobs.
 * @param {DisassemblyTimings} timings Collector for this user operation.
 * @param {DisassemblyMaintenanceClient} client Process runner whose complete lifetime is timed.
 * @param {K} operation Phase to execute.
 * @param {MaintenanceJobs[K]["input"]} input Paths and phase options.
 * @param {MaintenanceRunOptions} options Cancellation, heap limit and user-facing progress.
 * @returns {Promise<MaintenanceJobs[K]["output"]>} Original phase result.
 */
const runTimedJob = <K extends keyof MaintenanceJobs>(
  timings: DisassemblyTimings,
  client: DisassemblyMaintenanceClient,
  operation: K,
  input: MaintenanceJobs[K]["input"],
  options: MaintenanceRunOptions,
): Promise<MaintenanceJobs[K]["output"]> =>
  timings.measure(maintenanceStepNames[operation], (recordStage) =>
    client.run(operation, input, {
      ...options,
      onProgress: (progress) => {
        if (progress.timing) {
          recordStage(progress.timing);
        } else {
          options.onProgress?.(progress);
        }
      },
    }),
  );

/**
 * Run measured preparation, analysis, export, ROM verification, and coverage phases under
 * cancellable editor progress.
 * Returns a summary only after byte-identical output and a final project-revision check;
 * failures may follow completed write phases.
 * @param {DisassemblyMaintenanceClient} client Owner of isolated maintenance child processes.
 * @param {ResolvedTarget} resolved Verified project, source export, and exact ROM.
 * @param {readonly DisassemblyEntrySeed[] | undefined} seeds Optional runtime-observed code entry points.
 * @param {DisassemblyTimings} timings Collector shared with any preceding import phases.
 * @returns {Promise<DisassemblyRegenerationSummary>} Verified coverage/file-change summary after all phases succeed.
 */
const regenerate = async (
  client: DisassemblyMaintenanceClient,
  resolved: ResolvedTarget,
  seeds: readonly DisassemblyEntrySeed[] | undefined,
  timings: DisassemblyTimings,
): Promise<DisassemblyRegenerationSummary> => {
  const maxWorkItems = workspace
    .getConfiguration("asm", Uri.file(resolved.sourceDirectory))
    .get<number>("analysis.maxWorkItems", 1_000_000);
  if (!Number.isSafeInteger(maxWorkItems) || maxWorkItems < 1) {
    throw new Error("asm.analysis.maxWorkItems must be a positive safe integer.");
  }
  return withMaintenanceProgress(
    "Assembly: analyzing and regenerating disassembly",
    async (options) => {
      const { before, entryPoints } = await runTimedJob(
        timings,
        client,
        "prepare",
        { target: resolved, seeds },
        options,
      );
      const metadataOnly =
        !seeds?.length &&
        (await runTimedJob(timings, client, "refreshEligible", resolved, options));
      let analysis: DisassemblyRegenerationSummary["analysis"];
      if (!metadataOnly) {
        options.onProgress?.({
          message: `Analyzing from ${entryPoints.length} runtime code seed(s)…`,
        });
        analysis = await runTimedJob(
          timings,
          client,
          "analyze",
          { target: resolved, entryPoints, maxWorkItems },
          options,
        );
      } else {
        options.onProgress?.({
          message: "Refreshing all pending metadata edits using saved analysis…",
        });
      }
      const { exported, verified: roundTrip } = await runTimedJob(
        timings,
        client,
        "publish",
        resolved,
        options,
      );
      options.onProgress?.({ message: "Summarizing updated analysis…" });
      const after = await runTimedJob(
        timings,
        client,
        "coverage",
        { ...resolved, sourceManifest: exported.manifest },
        options,
      );
      const changes = await timings.measure(
        "Check final revision and compare generated file manifests",
        () => {
          // Keep a rejected publication check visible as a failed report step, even after verification.
          if (after.manifestSha256 !== exported.manifest.sourceProjectSha256) {
            throw new Error(
              "Analysis changed while source was being regenerated. Run regeneration again to use the latest edits.",
            );
          }
          return fileChanges(resolved.sourceManifest, exported.manifest);
        },
      );
      return {
        projectDirectory: resolved.projectDirectory,
        sourceDirectory: resolved.sourceDirectory,
        before,
        after,
        analysis,
        entrySeeds: entryPoints.length,
        ramVariables:
          exported.manifest.inputs?.find((input) => input.path === "ram-map.json")?.records ?? 0,
        ...changes,
        roundTripSha256: roundTrip.comparison.actualSha256,
        timings: timings.snapshot(),
      };
    },
    resolved.sourceDirectory,
  );
};

/**
 * Build a Markdown status report from worker coverage, generated-file hashes, user-input hashes,
 * and the source/project revision relationship.
 * @param {DisassemblyMaintenanceClient} client Worker client used for compact coverage queries.
 * @param {ResolvedProjectSource} resolved Matching project/source pair to inspect.
 * @returns {Promise<string>} Markdown explaining current or stale analysis/source/input state.
 */
const statusReport = async (
  client: DisassemblyMaintenanceClient,
  resolved: ResolvedProjectSource,
): Promise<string> => {
  const coverage = await withMaintenanceProgress(
    "Assembly: checking disassembly status",
    (options) => client.run("coverage", resolved, options),
    resolved.sourceDirectory,
  );
  const publication = await withMaintenanceProgress(
    "Assembly: reading publication outcome",
    (options) =>
      client.run("publicationStatus", { sourceDirectory: resolved.sourceDirectory }, options),
    resolved.sourceDirectory,
  );
  const generatedIssues = inspectSourceExportFiles(
    resolved.sourceDirectory,
    resolved.sourceManifest,
  );
  const generatedCurrent = generatedIssues.length === 0;
  const integrity = generatedCurrent
    ? "all generated files match their recorded hashes"
    : `${generatedIssues.length} of ${resolved.sourceManifest.files.length} generated files differ from ${SOURCE_EXPORT_MANIFEST}`;
  let inputIntegrity = "all user-owned inputs match the last export";
  let inputsCurrent = true;
  try {
    validateSourceExportInputs(resolved.sourceDirectory, resolved.sourceManifest);
  } catch (error) {
    inputsCurrent = false;
    inputIntegrity = `STALE: ${error instanceof Error ? error.message : String(error)}`;
  }
  const projectCurrent = resolved.sourceManifest.sourceProjectSha256 === coverage.manifestSha256;
  const current = projectCurrent && inputsCurrent && generatedCurrent;
  const staleReasons = [
    ...(projectCurrent ? [] : ["analysis/evidence changed"]),
    ...(inputsCurrent ? [] : ["RAM map or another source input changed"]),
    ...(generatedCurrent ? [] : ["a generated file drifted"]),
  ];
  let guidance: string;
  if (!generatedCurrent) {
    guidance =
      "Regeneration stops to protect these files. Restore generated files and generated-files.json from the same export, or save intended edits and explicitly re-export with the CLI's --force option.";
  } else if (current) {
    guidance = "The generated disassembly reflects the current analysis revision.";
  } else {
    guidance =
      "Run **Assembly: Analyze and Regenerate Disassembly** to turn the current RAM map, labels, classifications, and runtime code seeds into generated source.";
  }
  return `${[
    "# Disassembly status",
    "",
    `Project: ${resolved.projectDirectory}`,
    "",
    `Generated source: ${resolved.sourceDirectory}`,
    "",
    `- Analysis revision: ${coverage.manifestSha256}`,
    `- Source was exported from: ${resolved.sourceManifest.sourceProjectSha256}`,
    `- Source status: ${current ? "current" : `STALE — ${staleReasons.join(". ")}`}`,
    `- Generated-file integrity: ${integrity}`,
    `- Source-input integrity: ${inputIntegrity}`,
    `- Publication verification: ${publication?.phase === "published" && publication.revision === resolved.sourceManifest.sourceProjectSha256 && publication.after === sourceExportSha256(fs.readFileSync(path.join(resolved.sourceDirectory, SOURCE_EXPORT_MANIFEST))) ? `verified ${publication.romSha256} at ${publication.verifiedAt}` : "no matching durable verification receipt"}`,
    ...(publication
      ? [
          `- Last publication: ${publication.id} (${publication.phase})`,
          `- Retained previous generation: ${publication.previous}`,
        ]
      : []),
    `- RAM-map variables: ${resolved.sourceManifest.inputs?.find((input) => input.path === "ram-map.json")?.records ?? 0}`,
    `- Static instruction nodes: ${coverage.instructions}`,
    `- Source emitted as code: ${formatBytes(coverage.codeBytes)} / ${formatBytes(coverage.contentBytes)} (${percent(coverage.codeBytes, coverage.contentBytes)})`,
    `- Runtime execution facts: ${coverage.runtimeRecords} address(es), ${coverage.runtimeEvents} event(s)`,
    `- Imported instruction traces: ${coverage.traceImports}`,
    "",
    ...(generatedCurrent
      ? []
      : [
          "## Generated-file differences",
          "",
          ...generatedIssues.map((issue) => `- ${describeSourceExportFileIssue(issue)}`),
          "",
        ]),
    guidance,
    "",
    "A saved trace does not change source by itself. Use **Assembly: Import Runtime Trace and Update Disassembly**. Its report shows the exact instruction/code-byte delta.",
    "",
  ].join("\n")}\n`;
};

/**
 * Use a command argument with a filesystem path or prompt for an ACT2/JSON capture; return
 * undefined on picker cancellation.
 * @param {unknown} [argument] Optional command argument carrying fsPath.
 * @returns {Promise<string | undefined>} Capture filename, or undefined when the dialog is cancelled.
 * @see https://code.visualstudio.com/api/references/vscode-api#window.showOpenDialog
 */
const traceFileFrom = async (argument?: unknown): Promise<string | undefined> => {
  if (argument instanceof Uri && argument.scheme === "file") {
    return argument.fsPath;
  }
  if (
    argument &&
    typeof argument === "object" &&
    typeof (argument as { fsPath?: unknown }).fsPath === "string"
  ) {
    return (argument as { fsPath: string }).fsPath;
  }
  const selected = await window.showOpenDialog({
    title: "Select an Uttori ASM trace capture",
    canSelectFiles: true,
    canSelectFolders: false,
    canSelectMany: false,
    filters: { "Uttori ASM trace capture": ["act2", "json"] },
  });
  return selected?.[0]?.fsPath;
};

/**
 * Read the workspace import budget (default 2048 MiB) and convert it to bytes; throw unless both
 * the positive MiB value and byte limit are safe integers.
 * @param {string} sourceDirectory Workspace resource used to resolve import settings.
 * @returns {number} Validated maximum capture size in bytes.
 * @see https://code.visualstudio.com/api/references/vscode-api#workspace.getConfiguration
 */
const traceImportMaxBytes = (sourceDirectory: string): number => {
  const mib = workspace
    .getConfiguration("asm", Uri.file(sourceDirectory))
    .get<number>("trace.maxImportSizeMiB", 2048);
  const bytes = mib * 1024 * 1024;
  if (!Number.isSafeInteger(mib) || mib < 1 || !Number.isSafeInteger(bytes)) {
    throw new Error(
      "asm.trace.maxImportSizeMiB must be a positive integer representing a safe byte limit.",
    );
  }
  return bytes;
};

/**
 * Run a maintenance action with workspace heap settings, cancellation forwarding, and progress
 * messages; repeated byte percentages are suppressed while stage/record updates pass through.
 * Dispose the cancellation subscription on every exit and propagate the action result or error.
 * @param {string} title Progress notification title.
 * @param {Function} action Work receiving heap limits, cancellation, and progress forwarding.
 * @param {string} sourceDirectory Resource used to resolve workspace memory settings.
 * @returns {Promise<T>} The action’s result; failures and cancellation propagate.
 * @see https://code.visualstudio.com/api/references/vscode-api#window.withProgress
 * @see https://code.visualstudio.com/api/references/vscode-api#CancellationToken
 */
const withMaintenanceProgress = async <T>(
  title: string,
  action: (options: MaintenanceRunOptions) => Promise<T>,
  sourceDirectory: string,
): Promise<T> =>
  window.withProgress(
    { location: ProgressLocation.Notification, title, cancellable: true },
    async (progress, token) => {
      const cancellation = new AbortController();
      const subscription = token.onCancellationRequested(() => cancellation.abort());
      let lastPercent = -1;
      try {
        return await action({
          maxMemoryMiB: workspace
            .getConfiguration("asm", Uri.file(sourceDirectory))
            .get<number>("analysis.maxMemoryMiB", 4096),
          signal: cancellation.signal,
          onProgress: ({
            message,
            processedRecords,
            totalRecords,
            bytesRead: read = 0,
            totalBytes: total = 0,
            timing,
          }) => {
            if (timing) {
              return;
            }
            if (processedRecords !== undefined && totalRecords !== undefined) {
              progress.report({
                message: `Merging runtime facts: ${processedRecords.toLocaleString()} / ${totalRecords.toLocaleString()} records…`,
              });
              return;
            }
            if (message) {
              progress.report({ message });
              return;
            }
            const percent = total ? Math.floor((read / total) * 100) : 100;
            if (percent !== lastPercent) {
              progress.report({
                message: `${formatBytes(read)} / ${formatBytes(total)} (${percent}%)`,
              });
              lastPercent = percent;
            }
          },
        });
      } finally {
        subscription.dispose();
      }
    },
  );

/**
 * Registers trace import, status, and deterministic analysis/source regeneration commands.
 * @param {ExtensionContext} context Extension storage for content-addressed ROM bindings.
 * @param {() => void} refresh Refresh callback for analysis views.
 * @param {LogOutputChannel | undefined} outputChannel Optional diagnostic output.
 * @returns {readonly Disposable[]} Command registrations owned by the extension context.
 * @see https://code.visualstudio.com/api/references/vscode-api#commands.registerCommand
 * @see https://code.visualstudio.com/api/references/vscode-api#ExtensionContext.subscriptions
 */
export const registerDisassemblyMaintenance = (
  context: ExtensionContext,
  refresh: () => void,
  outputChannel?: LogOutputChannel,
): readonly Disposable[] => {
  const client = new DisassemblyMaintenanceClient(
    path.join(context.extensionUri.fsPath, "out", "disassembly-maintenance-process.cjs"),
    outputChannel,
  );
  const activeProjects = new Set<string>();
  const run = async (
    operation: () => Promise<void>,
    project = "selected-project",
  ): Promise<{ ok: boolean; error?: string }> => {
    if (activeProjects.has(project)) {
      void window
        .showInformationMessage(
          "A disassembly maintenance operation is already running.",
          "Show Output",
        )
        .then((choice) => {
          if (choice === "Show Output") {
            outputChannel?.show(true);
          }
        });
      return { ok: false, error: "A maintenance operation is already running." };
    }
    activeProjects.add(project);
    let failure: string | undefined;
    await operation()
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        failure = message;
        const details = error instanceof Error ? (error.stack ?? message) : message;
        outputChannel?.error(`Disassembly maintenance failed: ${details}`);
        void window
          .showErrorMessage(`Assembly disassembly update: ${message}`, "Show Output")
          .then((choice) => {
            if (choice === "Show Output") {
              outputChannel?.show(true);
            }
          });
      })
      .finally(() => {
        activeProjects.delete(project);
      });
    return { ok: failure === undefined, error: failure };
  };
  return [
    client,
    commands.registerCommand("asm.analysis.showOutput", () => outputChannel?.show(true)),
    commands.registerCommand(
      "asm.disassembly.recoverPublication",
      (target?: DisassemblyMaintenanceTarget) =>
        run(async () => {
          if (!workspace.isTrusted) {
            throw new Error("Publication recovery requires a trusted workspace.");
          }
          const selected = await chooseProject(target?.projectDirectory);
          if (!selected) {
            throw new Error("Choose a native analysis project to recover.");
          }
          const sourceDirectory = target?.sourceDirectory ?? path.dirname(selected.directory);
          const result = await withMaintenanceProgress(
            "Assembly: recovering source publication",
            (options) =>
              client.run(
                "recover",
                { projectDirectory: selected.directory, sourceDirectory },
                options,
              ),
            sourceDirectory,
          );
          refresh();
          void window.showInformationMessage(
            result
              ? `Publication ${result.id}: ${result.phase}. Retained source: ${result.previous}`
              : "No interrupted source publication was found.",
          );
        }),
    ),
    commands.registerCommand(
      REGENERATE_DISASSEMBLY_COMMAND,
      (target?: DisassemblyMaintenanceTarget) =>
        run(async () => {
          if (!workspace.isTrusted) {
            throw new Error("Analysis and source regeneration require a trusted workspace.");
          }
          const resolved = await resolveTarget(context, target);
          if (!resolved) {
            throw new Error("No disassembly project selected.");
          }
          const timings = new DisassemblyTimings();
          const summary = await regenerate(client, resolved, target?.entrySeeds, timings);
          refresh();
          outputChannel?.info(
            `Disassembly updated: ${summary.before.codeBytes} -> ${summary.after.codeBytes} code bytes. ${summary.changedFiles.length} file(s) changed.`,
          );
          await showMarkdown(renderDisassemblyRegenerationReport(summary));
          void window.showInformationMessage(
            `Assembly: disassembly is current. ${formatBytes(summary.after.codeBytes)} code (${signed(summary.after.codeBytes - summary.before.codeBytes)} bytes), exact round trip verified.`,
          );
        }, target?.projectDirectory ?? target?.sourceDirectory),
    ),
    commands.registerCommand(OPEN_RAM_MAP_COMMAND, (target?: DisassemblyMaintenanceTarget) =>
      run(async () => {
        if (!workspace.isTrusted) {
          throw new Error("Opening a RAM map requires a trusted workspace.");
        }
        const resolved = await resolveProjectSource(target);
        if (!resolved) {
          return;
        }
        loadSnesRamMap(resolved.sourceDirectory);
        await window.showTextDocument(
          Uri.file(path.join(resolved.sourceDirectory, SNES_RAM_MAP_SOURCE)),
          { preview: false },
        );
      }),
    ),
    commands.registerCommand(DISASSEMBLY_STATUS_COMMAND, (target?: DisassemblyMaintenanceTarget) =>
      run(async () => {
        const resolved = await resolveProjectSource(target);
        if (resolved) {
          await showMarkdown(await statusReport(client, resolved));
        }
      }),
    ),
    commands.registerCommand(IMPORT_BUS_TRACE_COMMAND, (argument?: unknown) =>
      run(async () => {
        if (!workspace.isTrusted) {
          throw new Error("Bus capture import requires a trusted workspace.");
        }
        const traceFile = await traceFileFrom(argument);
        if (!traceFile) {
          return;
        }
        // Read bounded identity before selecting the project whose configured byte budget applies.
        const metadata = await withMaintenanceProgress(
          "Assembly: preparing bus capture import",
          (options) => client.run("busIdentity", { traceFile }, options),
          traceFile,
        );
        const selected = await chooseProject(undefined, metadata.romContentSha256);
        if (!selected) {
          void window.showInformationMessage(
            "Assembly: no matching analysis project selected. Open or create a project for this capture's ROM first.",
          );
          return;
        }
        const result = await withMaintenanceProgress(
          "Assembly: importing bus activity",
          (options) =>
            client.run(
              "importBus",
              {
                projectDirectory: selected.directory,
                romContentSha256: metadata.romContentSha256,
                traceFile,
                maxBytes: traceImportMaxBytes(selected.directory),
                storagePolicy: traceStoragePolicy(selected.directory),
              },
              options,
            ),
          selected.directory,
        );
        refresh();
        for (const warning of result.warnings) {
          outputChannel?.warn(warning);
        }
        outputChannel?.info(
          `Bus capture imported: ${result.observedEvents} access(es), ${result.added.runtime} new fact(s).`,
        );
        await showMarkdown(renderBusTraceReport(result));
      }),
    ),
    commands.registerCommand(IMPORT_TRACE_AND_REGENERATE_COMMAND, (argument?: unknown) =>
      run(async () => {
        if (!workspace.isTrusted) {
          throw new Error("Trace import and source regeneration require a trusted workspace.");
        }
        const traceFile = await traceFileFrom(argument);
        if (!traceFile) {
          return;
        }
        const timings = new DisassemblyTimings();
        // Read only the identity to select the project whose size setting applies.
        const trace = await withMaintenanceProgress(
          "Assembly: preparing runtime trace import",
          (options) => runTimedJob(timings, client, "traceIdentity", { traceFile }, options),
          traceFile,
        );
        const resolved = await resolveTarget(context, {}, trace.romContentSha256);
        if (!resolved) {
          return;
        }
        const maxBytes = traceImportMaxBytes(resolved.sourceDirectory);
        const imported = await withMaintenanceProgress(
          "Assembly: importing runtime trace",
          (options) =>
            runTimedJob(
              timings,
              client,
              "import",
              {
                target: resolved,
                traceFile,
                maxBytes,
                architecture: trace.architecture,
                addressSpace: trace.addressSpace,
                indexMode: configuredTraceIndex(resolved.sourceDirectory),
                storagePolicy: traceStoragePolicy(resolved.sourceDirectory),
              },
              options,
            ),
          resolved.sourceDirectory,
        );
        for (const warning of imported.warnings ?? []) {
          outputChannel?.warn(warning);
        }
        const seeds = imported.seeds;
        let summary: DisassemblyRegenerationSummary;
        try {
          summary = await regenerate(client, resolved, seeds, timings);
        } catch (error) {
          refresh();
          if (error instanceof Error && error.name === "AbortError") {
            throw error;
          }
          outputChannel?.error(
            `Disassembly regeneration failed: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`,
          );
          const message = error instanceof Error ? error.message : String(error);
          await showMarkdown(
            `${[
              "# Execution capture report",
              "",
              renderTraceImportReport(imported, traceFile),
              "",
              "## Disassembly regeneration did not complete",
              "",
              message,
              "",
              "The trace evidence was imported. Analysis and export guards preserve previous results when an update would discard known code. Other failures may leave source unverified. The error above identifies the failed step.",
              "",
              renderMaintenanceTimings(timings.snapshot()),
              "",
            ].join("\n")}\n`,
          );
          throw error;
        }
        refresh();
        const report = renderDisassemblyRegenerationReport({
          ...summary,
          before: {
            ...summary.before,
            storage: imported.storage?.before ?? summary.before.storage,
          },
          timings: timings.snapshot(),
        }).replace(
          "## Result\n\n",
          () => `${renderTraceImportReport(imported, traceFile)}\n## Result\n\n`,
        );
        outputChannel?.info(
          `Trace imported: ${imported.observedEvents} event(s), ${seeds.length} code seed(s), ${summary.after.codeBytes - summary.before.codeBytes} code-byte delta.`,
        );
        await showMarkdown(report);
        void window.showInformationMessage(
          `Assembly: trace imported and disassembly rebuilt. ${seeds.length} unique code seed(s), ${signed(summary.after.codeBytes - summary.before.codeBytes)} emitted code bytes.`,
        );
      }),
    ),
  ];
};

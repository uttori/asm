import * as fs from "node:fs";
import * as path from "node:path";

import {
  ANALYSIS_PROJECT_MANIFEST,
  RomImage,
  SOURCE_EXPORT_MANIFEST,
  commitAnalysisProjectTransaction,
  importRuntimeInstructionTrace,
  loadAnalysisProjectSnapshot,
  loadSourceExportManifest,
  mergeRuntimeEvidence,
  migrateManifest,
  summarizeExecutionWindow,
  validateRuntimeInstructionTrace,
  validateSourceExportFiles,
  validateSourceExportInputs,
  type AnalysisProjectManifest,
  type AnalysisProjectShards,
  type RuntimeInstructionTraceArtifact,
  type ExecutionWindowSummary,
  type SourceExportManifest,
} from "@uttori/asm-disassembler";
import {
  SNES_CPU_ADDRESS_SPACE,
  SNES_RAM_MAP_SOURCE,
  analyzeSnesProject,
  exportSnesProject,
  loadSnesRamMap,
  verifySnesProjectRoundTrip,
  type AnalyzeSnesProjectResult,
  type Snes65816EntryPoint,
} from "@uttori/asm-plugin-snes";
import {
  ProgressLocation,
  Uri,
  commands,
  window,
  workspace,
  type CancellationToken,
  type Disposable,
  type ExtensionContext,
  type LogOutputChannel,
} from "vscode";

import { findAnalysisProjectDirectories } from "./coverage-tree.js";
import { rememberedSnesRom, rememberSnesRom } from "./snes-rom-bindings.js";

/** Re-run static analysis, rewrite generated source, and prove an exact ROM round trip. */
export const REGENERATE_DISASSEMBLY_COMMAND = "asm.disassembly.regenerate";
/** Explain whether generated source reflects the current analysis revision. */
export const DISASSEMBLY_STATUS_COMMAND = "asm.disassembly.status";
/** Import a saved instruction trace, use observed PCs as code seeds, and regenerate source. */
export const IMPORT_TRACE_AND_REGENERATE_COMMAND = "asm.trace.importRegenerate";
/** Open the user-owned RAM map consumed by source regeneration. */
export const OPEN_RAM_MAP_COMMAND = "asm.ramMap.open";

const MAX_TRACE_FILE_BYTES = 128 * 1024 * 1024;
const MAX_RUNTIME_ENTRY_SEEDS = 100_000;

export interface DisassemblyEntrySeed {
  readonly address: number;
  readonly evidence?: readonly string[];
}

export interface DisassemblyMaintenanceTarget {
  readonly projectDirectory?: string;
  readonly sourceDirectory?: string;
  readonly entrySeeds?: readonly DisassemblyEntrySeed[];
}

interface ProjectChoice {
  readonly directory: string;
  readonly manifest: AnalysisProjectManifest;
}

interface ResolvedProjectSource {
  readonly projectDirectory: string;
  readonly sourceDirectory: string;
  readonly sourceManifest: SourceExportManifest;
}

interface ResolvedTarget extends ResolvedProjectSource {
  readonly romFile: string;
}

interface CoverageSnapshot {
  readonly manifestSha256: string;
  readonly instructions: number;
  readonly functions: number;
  readonly runtimeRecords: number;
  readonly runtimeEvents: number;
  readonly traceImports: number;
  readonly behaviorComments: number;
  readonly codeBytes: number;
  readonly contentBytes: number;
}

export interface DisassemblyRegenerationSummary {
  readonly projectDirectory: string;
  readonly sourceDirectory: string;
  readonly before: CoverageSnapshot;
  readonly after: CoverageSnapshot;
  readonly analysis: AnalyzeSnesProjectResult;
  readonly entrySeeds: number;
  readonly ramVariables: number;
  readonly addedFiles: readonly string[];
  readonly changedFiles: readonly string[];
  readonly removedFiles: readonly string[];
  readonly roundTripSha256: string;
}

const formatBytes = (bytes: number): string => {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${bytes} bytes`;
};

const signed = (value: number): string => `${value >= 0 ? "+" : ""}${value}`;

const coverageFor = (
  shards: AnalysisProjectShards,
  manifestSha256: string,
  source: SourceExportManifest,
): CoverageSnapshot => ({
  manifestSha256,
  instructions: shards.analysis.filter((record) => record.kind === "cfg-node").length,
  functions: shards.analysis.filter((record) => record.kind === "function").length,
  runtimeRecords: shards.runtime.filter((record) => record.kind === "runtime-execution").length,
  runtimeEvents: shards.runtime
    .filter((record) => record.kind === "runtime-execution")
    .reduce((total, record) => total + record.count, 0),
  traceImports: shards.imports.filter((record) => record.format === "uttori-asm-instruction-trace")
    .length,
  behaviorComments: shards.comments.filter((record) => record.id.startsWith("behavior-comment:"))
    .length,
  codeBytes: source.spans
    .filter((span) => span.role === "code")
    .reduce((total, span) => total + span.end - span.start, 0),
  contentBytes: source.rom.contentSize,
});

const percent = (part: number, total: number): string =>
  total === 0 ? "0.00%" : `${((part / total) * 100).toFixed(2)}%`;

const hexAddress = (address: number): string =>
  `$${address.toString(16).toUpperCase().padStart(6, "0")}`;

const markdownCell = (value: string): string => value.replaceAll("|", "\\|").replaceAll("\n", " ");

const addressList = (addresses: readonly number[], limit = 200): string => {
  const visible = addresses.slice(0, limit).map(hexAddress).join(", ");
  const omitted = addresses.length - Math.min(addresses.length, limit);
  return `${visible || "None"}${omitted ? ` (${omitted} more omitted from this view)` : ""}`;
};

/**
 * Renders routines observed in one explicit execution window and preserves attribution gaps.
 * @param {ExecutionWindowSummary} summary Dynamic PC attribution against the current call graph.
 * @returns {string} Markdown section suitable for the trace-import report.
 */
export const renderExecutionWindowReport = (summary: ExecutionWindowSummary): string => {
  const routineRows = summary.routines.map(
    (routine) =>
      `| ${routine.firstSequence} | ${markdownCell(routine.name)} | ${hexAddress(routine.address)} | ${markdownCell(routine.source)} | ${routine.instructionEvents} | ${routine.uniqueInstructionAddresses} | ${routine.executionSpans} |`,
  );
  return `${[
    "## Executed routines (function candidates)",
    "",
    `- Capture state: ${summary.complete ? "stopped cleanly" : "incomplete"}`,
    `- Instruction events: ${summary.observedEvents}`,
    `- Unique instruction PCs: ${summary.uniqueInstructionAddresses}`,
    `- Identified routines: ${summary.routines.length}`,
    `- Uniquely attributed events: ${summary.attributedEvents}`,
    `- Events at PCs without a known routine owner: ${summary.unownedEvents}`,
    `- Events at PCs with conflicting routine owners: ${summary.ambiguousEvents}`,
    `- Producer-dropped events: ${summary.droppedEvents}`,
    "",
    "| First event | Routine | Entry | Boundary source | Dynamic instructions | Unique PCs | Execution spans |",
    "| ---: | --- | --- | --- | ---: | ---: | ---: |",
    ...(routineRows.length
      ? routineRows
      : ["| — | No statically evidenced routine could be attributed | — | — | 0 | 0 | 0 |"]),
    "",
    "Execution spans are contiguous runs attributed to a routine; they are useful navigation hints, not certified invocation counts. A PC trace cannot reconstruct a complete call stack across interrupts, tail calls, dropped events, or unknown code.",
    "",
    "### PCs without a known routine owner",
    "",
    addressList(summary.unownedAddresses),
    "",
    "### PCs with conflicting routine owners",
    "",
    addressList(summary.ambiguousAddresses),
    "",
    "Unknown and ambiguous PCs are reported rather than promoted to invented function boundaries. Add or correct labels, entry points, and indirect-flow targets, regenerate, then import the trace again to improve attribution.",
    "",
  ].join("\n")}\n`;
};

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
    `- Runtime code seeds used: ${summary.analysis.runtimeSeeds} (${summary.entrySeeds} explicitly selected in this operation; ${summary.analysis.omittedRuntimeSeeds} omitted by the safety bound)`,
    `- Captured instruction variants: ${summary.analysis.capturedInstructions}; observed PCs without decoded code: ${summary.analysis.runtimePcsWithoutCode}; heuristic findings: ${summary.analysis.heuristicRoles}`,
    `- RAM variables mapped: ${summary.ramVariables}`,
    `- Static instruction nodes: ${summary.before.instructions} → ${summary.after.instructions} (${signed(instructionDelta)})`,
    `- Source emitted as code: ${formatBytes(summary.before.codeBytes)} → ${formatBytes(summary.after.codeBytes)} (${signed(codeDelta)} bytes)`,
    `- Code coverage: ${percent(summary.before.codeBytes, summary.before.contentBytes)} → ${percent(summary.after.codeBytes, summary.after.contentBytes)}`,
    `- Function candidates: ${summary.before.functions} → ${summary.after.functions}`,
    `- Analysis status: ${summary.analysis.status}; ${summary.analysis.conflicts} conflict(s), ${summary.analysis.unresolved} unresolved flow(s)`,
    `- Runtime execution facts retained: ${summary.after.runtimeRecords} address(es), ${summary.after.runtimeEvents} event(s)`,
    `- Exact round trip: yes (${summary.roundTripSha256})`,
    "",
    "## Generated file changes",
    "",
    ...(sourceChanges.length ? sourceChanges : ["- No generated file bytes changed."]),
    "",
    "A positive code-byte delta means analysis converted ROM bytes from generated `incbin` assets into native instructions. A zero delta can still be correct when the observed PCs were already code or conservative decoding found conflicts.",
    "",
  ].join("\n")}\n`;
};

const showMarkdown = async (content: string): Promise<void> => {
  await window.showTextDocument(
    await workspace.openTextDocument({ language: "markdown", content }),
    { preview: false },
  );
};

const insideWorkspace = (directory: string): boolean => {
  const absolute = path.resolve(directory);
  return (workspace.workspaceFolders ?? []).some((folder) => {
    if (folder.uri.scheme !== "file") return false;
    const relative = path.relative(path.resolve(folder.uri.fsPath), absolute);
    return (
      relative === "" ||
      (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
    );
  });
};

const readProjectChoice = (directory: string): ProjectChoice => {
  const manifest = migrateManifest(
    JSON.parse(fs.readFileSync(path.join(directory, ANALYSIS_PROJECT_MANIFEST), "utf8")),
  );
  return { directory: path.resolve(directory), manifest };
};

const chooseProject = async (
  preferred?: string,
  romContentSha256?: string,
): Promise<ProjectChoice | undefined> => {
  if (preferred) {
    if (!insideWorkspace(preferred))
      throw new Error("The analysis project must be inside the trusted workspace.");
    const selected = readProjectChoice(preferred);
    if (romContentSha256 && selected.manifest.rom.contentSha256 !== romContentSha256)
      throw new Error("The selected trace and analysis project describe different ROM content.");
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
  if (choices.length === 0) return undefined;
  if (choices.length === 1) return choices[0];
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

const chooseSource = async (
  project: ProjectChoice,
  preferred?: string,
): Promise<{ directory: string; manifest: SourceExportManifest } | undefined> => {
  if (preferred) {
    if (!insideWorkspace(preferred))
      throw new Error("Generated source must be inside the trusted workspace.");
    const manifest = sourceMatches(path.resolve(preferred), project);
    if (!manifest)
      throw new Error("The selected source export does not match this analysis project.");
    return { directory: path.resolve(preferred), manifest };
  }
  const nearby = path.dirname(project.directory);
  const nearManifest = sourceMatches(nearby, project);
  if (nearManifest) return { directory: nearby, manifest: nearManifest };
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
  if (matches.length === 0) return undefined;
  if (matches.length === 1) return matches[0];
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
  if (!file) return undefined;
  const rom = exactRom(file, project.manifest);
  if (!rom)
    throw new Error(
      `ROM identity mismatch; the project expects ${project.manifest.rom.contentSha256}.`,
    );
  await rememberSnesRom(context, rom.identity, file);
  return file;
};

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

const resolveTarget = async (
  context: ExtensionContext,
  target: DisassemblyMaintenanceTarget = {},
  expectedRom?: string,
): Promise<ResolvedTarget | undefined> => {
  const resolved = await resolveProjectSource(target, expectedRom);
  if (!resolved) return undefined;
  const project = readProjectChoice(resolved.projectDirectory);
  const romFile = await chooseRom(
    context,
    project,
    resolved.sourceDirectory,
    resolved.sourceManifest,
  );
  return romFile ? { ...resolved, romFile } : undefined;
};

const abortController = (token: CancellationToken): AbortController => {
  const controller = new AbortController();
  token.onCancellationRequested(() => controller.abort());
  return controller;
};

const normalizedSeeds = (
  value: readonly DisassemblyEntrySeed[] | undefined,
  snapshot: ReturnType<typeof loadAnalysisProjectSnapshot>,
): readonly Snes65816EntryPoint[] => {
  if (!value?.length) return [];
  const evidence = new Set(snapshot.shards.evidence.map((record) => record.id));
  const unique = new Map<number, Set<string>>();
  for (const seed of value) {
    if (!Number.isSafeInteger(seed.address) || seed.address < 0 || seed.address > 0xffffff)
      throw new Error("Runtime code seeds must be 24-bit integer CPU addresses.");
    const accepted = (seed.evidence ?? []).filter((id) => evidence.has(id));
    const prior = unique.get(seed.address) ?? new Set<string>();
    for (const id of accepted) prior.add(id);
    unique.set(seed.address, prior);
  }
  if (unique.size > MAX_RUNTIME_ENTRY_SEEDS)
    throw new Error(
      `Trace contains ${unique.size} unique PCs; capture a narrower window (limit ${MAX_RUNTIME_ENTRY_SEEDS}).`,
    );
  return [...unique]
    .sort(([left], [right]) => left - right)
    .map(([address, ids]) => ({
      id: `runtime-${address.toString(16).padStart(6, "0")}`,
      address,
      kind: "observation" as const,
      ...(ids.size ? { evidence: [...ids].sort() } : {}),
    }));
};

const fileChanges = (
  before: SourceExportManifest,
  after: SourceExportManifest,
): Pick<DisassemblyRegenerationSummary, "addedFiles" | "changedFiles" | "removedFiles"> => {
  const prior = new Map(before.files.map((file) => [file.path, file.sha256]));
  const next = new Map(after.files.map((file) => [file.path, file.sha256]));
  return {
    addedFiles: [...next.keys()].filter((file) => !prior.has(file)).sort(),
    changedFiles: [...next]
      .flatMap(([file, sha]) => (prior.has(file) && prior.get(file) !== sha ? [file] : []))
      .sort(),
    removedFiles: [...prior.keys()].filter((file) => !next.has(file)).sort(),
  };
};

const regenerate = async (
  resolved: ResolvedTarget,
  seeds: readonly DisassemblyEntrySeed[] | undefined,
): Promise<DisassemblyRegenerationSummary> => {
  const beforeProject = loadAnalysisProjectSnapshot(resolved.projectDirectory);
  validateSourceExportFiles(resolved.sourceDirectory, resolved.sourceManifest);
  const entryPoints = normalizedSeeds(seeds, beforeProject);
  return window.withProgress(
    {
      location: ProgressLocation.Notification,
      title: "Assembly: analyzing and regenerating disassembly",
      cancellable: true,
    },
    async (progress, token) => {
      const cancellation = abortController(token);
      progress.report({ message: `Analyzing from ${entryPoints.length} runtime code seed(s)…` });
      const analysis = analyzeSnesProject({
        projectDirectory: resolved.projectDirectory,
        romFile: resolved.romFile,
        entryPoints,
        signal: cancellation.signal,
      });
      progress.report({ message: "Writing generated source…" });
      const exported = exportSnesProject({
        projectDirectory: resolved.projectDirectory,
        romFile: resolved.romFile,
        sourceDirectory: resolved.sourceDirectory,
        signal: cancellation.signal,
      });
      progress.report({ message: "Rebuilding and checking every ROM byte…" });
      const roundTrip = await verifySnesProjectRoundTrip({
        sourceDirectory: resolved.sourceDirectory,
        romFile: resolved.romFile,
        signal: cancellation.signal,
      });
      if (!roundTrip.comparison.equal)
        throw new Error(
          `Generated source differed at ROM offset ${roundTrip.comparison.firstDifference}.`,
        );
      const afterProject = loadAnalysisProjectSnapshot(resolved.projectDirectory);
      return {
        projectDirectory: resolved.projectDirectory,
        sourceDirectory: resolved.sourceDirectory,
        before: coverageFor(
          beforeProject.shards,
          beforeProject.revision.manifestSha256,
          resolved.sourceManifest,
        ),
        after: coverageFor(
          afterProject.shards,
          afterProject.revision.manifestSha256,
          exported.manifest,
        ),
        analysis,
        entrySeeds: entryPoints.length,
        ramVariables:
          exported.manifest.inputs?.find((input) => input.path === "ram-map.json")?.records ?? 0,
        ...fileChanges(resolved.sourceManifest, exported.manifest),
        roundTripSha256: roundTrip.comparison.actualSha256,
      };
    },
  );
};

const statusReport = (resolved: ResolvedProjectSource): string => {
  const project = loadAnalysisProjectSnapshot(resolved.projectDirectory);
  const coverage = coverageFor(
    project.shards,
    project.revision.manifestSha256,
    resolved.sourceManifest,
  );
  let integrity = "all generated files match their recorded hashes";
  let generatedCurrent = true;
  try {
    validateSourceExportFiles(resolved.sourceDirectory, resolved.sourceManifest);
  } catch (error) {
    generatedCurrent = false;
    integrity = `needs attention: ${error instanceof Error ? error.message : String(error)}`;
  }
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
  return `${[
    "# Disassembly status",
    "",
    `Project: ${resolved.projectDirectory}`,
    "",
    `Generated source: ${resolved.sourceDirectory}`,
    "",
    `- Analysis revision: ${coverage.manifestSha256}`,
    `- Source was exported from: ${resolved.sourceManifest.sourceProjectSha256}`,
    `- Source status: ${current ? "current" : `STALE — ${staleReasons.join("; ")}`}`,
    `- Generated-file integrity: ${integrity}`,
    `- Source-input integrity: ${inputIntegrity}`,
    `- RAM-map variables: ${resolved.sourceManifest.inputs?.find((input) => input.path === "ram-map.json")?.records ?? 0}`,
    `- Static instruction nodes: ${coverage.instructions}`,
    `- Source emitted as code: ${formatBytes(coverage.codeBytes)} / ${formatBytes(coverage.contentBytes)} (${percent(coverage.codeBytes, coverage.contentBytes)})`,
    `- Runtime execution facts: ${coverage.runtimeRecords} address(es), ${coverage.runtimeEvents} event(s)`,
    `- Imported instruction traces: ${coverage.traceImports}`,
    `- Behavior-association comments: ${coverage.behaviorComments}`,
    "",
    current
      ? "The generated disassembly reflects the current analysis revision."
      : "Run **Assembly: Analyze and Regenerate Disassembly** to turn the current RAM map, labels, classifications, and runtime code seeds into generated source.",
    "",
    "A saved trace does not change source by itself. Use **Assembly: Import Runtime Trace and Update Disassembly**; its report shows the exact instruction/code-byte delta.",
    "",
  ].join("\n")}\n`;
};

const traceFileFrom = async (argument?: unknown): Promise<string | undefined> => {
  if (argument instanceof Uri && argument.scheme === "file") return argument.fsPath;
  if (
    argument &&
    typeof argument === "object" &&
    typeof (argument as { fsPath?: unknown }).fsPath === "string"
  )
    return (argument as { fsPath: string }).fsPath;
  const selected = await window.showOpenDialog({
    title: "Select an Uttori ASM instruction trace",
    canSelectFiles: true,
    canSelectFolders: false,
    canSelectMany: false,
    filters: { "Uttori ASM instruction trace": ["json"] },
  });
  return selected?.[0]?.fsPath;
};

const readTrace = (file: string): RuntimeInstructionTraceArtifact => {
  const stat = fs.statSync(file);
  if (stat.size > MAX_TRACE_FILE_BYTES)
    throw new Error("Instruction trace exceeds the 128 MiB import limit.");
  return validateRuntimeInstructionTrace(JSON.parse(fs.readFileSync(file, "utf8")));
};

/**
 * Registers trace import, status, and deterministic analysis/source regeneration commands.
 * @param {ExtensionContext} context Extension storage for content-addressed ROM bindings.
 * @param {() => void} refresh Refresh callback for analysis views.
 * @param {LogOutputChannel | undefined} outputChannel Optional diagnostic output.
 * @returns {readonly Disposable[]} Command registrations owned by the extension context.
 */
export const registerDisassemblyMaintenance = (
  context: ExtensionContext,
  refresh: () => void,
  outputChannel?: LogOutputChannel,
): readonly Disposable[] => {
  const run = (operation: () => Promise<void>): Promise<void> =>
    operation().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      outputChannel?.error(`Disassembly maintenance failed: ${message}`);
      void window.showErrorMessage(`Assembly disassembly update: ${message}`);
    });
  return [
    commands.registerCommand(
      REGENERATE_DISASSEMBLY_COMMAND,
      (target?: DisassemblyMaintenanceTarget) =>
        run(async () => {
          if (!workspace.isTrusted)
            throw new Error("Analysis and source regeneration require a trusted workspace.");
          const resolved = await resolveTarget(context, target);
          if (!resolved) return;
          const summary = await regenerate(resolved, target?.entrySeeds);
          refresh();
          outputChannel?.info(
            `Disassembly updated: ${summary.before.codeBytes} -> ${summary.after.codeBytes} code bytes; ${summary.changedFiles.length} file(s) changed.`,
          );
          await showMarkdown(renderDisassemblyRegenerationReport(summary));
          void window.showInformationMessage(
            `Assembly: disassembly is current; ${formatBytes(summary.after.codeBytes)} code (${signed(summary.after.codeBytes - summary.before.codeBytes)} bytes), exact round trip verified.`,
          );
        }),
    ),
    commands.registerCommand(OPEN_RAM_MAP_COMMAND, (target?: DisassemblyMaintenanceTarget) =>
      run(async () => {
        if (!workspace.isTrusted)
          throw new Error("Opening a RAM map requires a trusted workspace.");
        const resolved = await resolveProjectSource(target);
        if (!resolved) return;
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
        if (resolved) await showMarkdown(statusReport(resolved));
      }),
    ),
    commands.registerCommand(IMPORT_TRACE_AND_REGENERATE_COMMAND, (argument?: unknown) =>
      run(async () => {
        if (!workspace.isTrusted)
          throw new Error("Trace import and source regeneration require a trusted workspace.");
        const traceFile = await traceFileFrom(argument);
        if (!traceFile) return;
        const trace = readTrace(traceFile);
        const resolved = await resolveTarget(context, {}, trace.romContentSha256);
        if (!resolved) return;
        validateSourceExportFiles(resolved.sourceDirectory, resolved.sourceManifest);
        const snapshot = loadAnalysisProjectSnapshot(resolved.projectDirectory);
        const imported = importRuntimeInstructionTrace(trace, {
          projectRomContentSha256: snapshot.manifest.rom.contentSha256,
          sourceName: path.basename(traceFile),
        });
        const merged = mergeRuntimeEvidence(snapshot.shards, imported.batch);
        if (merged.changed)
          commitAnalysisProjectTransaction(resolved.projectDirectory, snapshot.revision, {
            manifest: snapshot.manifest,
            shards: merged.shards,
          });
        const seeds: DisassemblyEntrySeed[] =
          trace.architecture === "snes.65816" && trace.addressSpace === SNES_CPU_ADDRESS_SPACE
            ? (imported.batch.runtime?.flatMap((record) =>
                record.kind === "runtime-execution"
                  ? [{ address: record.address, evidence: record.evidence }]
                  : [],
              ) ?? [])
            : [];
        let summary: DisassemblyRegenerationSummary;
        try {
          summary = await regenerate(resolved, seeds);
        } catch (error) {
          const execution = summarizeExecutionWindow(
            trace,
            loadAnalysisProjectSnapshot(resolved.projectDirectory).shards,
          );
          refresh();
          const message = error instanceof Error ? error.message : String(error);
          await showMarkdown(
            `${[
              "# Execution capture report",
              "",
              "## Disassembly regeneration did not complete",
              "",
              message,
              "",
              "The trace evidence was imported, but generated source may be incomplete or unverified. The routine attribution available from the current analysis is preserved below.",
              "",
              renderExecutionWindowReport(execution),
            ].join("\n")}\n`,
          );
          throw error;
        }
        const execution = summarizeExecutionWindow(
          trace,
          loadAnalysisProjectSnapshot(resolved.projectDirectory).shards,
        );
        refresh();
        const mergeDetail = merged.changed
          ? `${merged.added.runtime} runtime address(es) and ${merged.added.evidence} evidence record(s) added`
          : "the identical trace evidence was already present";
        const report = `${renderDisassemblyRegenerationReport(summary).replace(
          "## Result\n\n",
          `## Trace import\n\n- File: ${traceFile}\n- Observed events: ${imported.observedEvents}\n- Unique observed PCs: ${imported.report.imported.executionRecords ?? 0}\n- Producer-dropped events: ${imported.droppedEvents}\n- Merge: ${mergeDetail}\n\n## Result\n\n`,
        )}\n${renderExecutionWindowReport(execution)}`;
        outputChannel?.info(
          `Trace imported: ${imported.observedEvents} event(s), ${execution.routines.length} routine candidate(s), ${seeds.length} code seed(s), ${summary.after.codeBytes - summary.before.codeBytes} code-byte delta.`,
        );
        await showMarkdown(report);
        void window.showInformationMessage(
          `Assembly: trace imported and disassembly rebuilt; ${execution.routines.length} routine candidate(s), ${seeds.length} unique code seed(s), ${signed(summary.after.codeBytes - summary.before.codeBytes)} emitted code bytes.`,
        );
      }),
    ),
  ];
};

/**
 * Creates runtime-backed analysis seeds for selected behavior-capture addresses.
 * @param {AnalysisProjectShards} shards Current project records containing runtime evidence.
 * @param {readonly number[]} addresses Reviewed instruction addresses.
 * @returns {readonly DisassemblyEntrySeed[]} Stable, evidence-linked analysis seeds.
 */
export const behaviorEntrySeeds = (
  shards: AnalysisProjectShards,
  addresses: readonly number[],
): readonly DisassemblyEntrySeed[] => {
  const selected = new Set(addresses);
  const evidence = new Map<number, Set<string>>();
  for (const record of shards.runtime) {
    if (record.kind !== "runtime-execution" || !selected.has(record.address)) continue;
    const ids = evidence.get(record.address) ?? new Set<string>();
    for (const id of record.evidence) ids.add(id);
    evidence.set(record.address, ids);
  }
  return [...selected]
    .sort((left, right) => left - right)
    .map((address) => ({ address, evidence: [...(evidence.get(address) ?? [])].sort() }));
};

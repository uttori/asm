import * as fs from "node:fs";
import * as path from "node:path";

import {
  ANALYSIS_PROJECT_MANIFEST,
  RomImage,
  SOURCE_EXPORT_MANIFEST,
  readRuntimeTraceFileMetadata,
  loadSourceExportManifest,
  parseAnalysisProjectManifest,
  validateSourceExportFiles,
  validateSourceExportInputs,
  type AnalysisProjectManifest,
  type AnalysisProjectShards,
  type ExecutionWindowSummary,
  type SourceExportManifest,
} from "@uttori/asm-disassembler";
import {
  SNES_RAM_MAP_SOURCE,
  loadSnesRamMap,
  type SnesFunctionRole,
} from "@uttori/asm-plugin-snes";
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

import {
  DisassemblyMaintenanceClient,
  type MaintenanceRunOptions,
} from "./disassembly-maintenance-client.js";
import {
  fileChanges,
  type DisassemblyEntrySeed,
  type DisassemblyMaintenanceTarget,
  type DisassemblyRegenerationSummary,
  type ProjectChoice,
  type ResolvedProjectSource,
  type ResolvedTarget,
} from "./disassembly-maintenance-data.js";
export type {
  DisassemblyEntrySeed,
  DisassemblyMaintenanceTarget,
  DisassemblyRegenerationSummary,
} from "./disassembly-maintenance-data.js";

import { analysisWorker } from "./analysis-worker-client.js";
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
export const CONFIGURE_HEURISTICS_COMMAND = "asm.heuristics.configure";
export const PREVIEW_HEURISTICS_COMMAND = "asm.heuristics.preview";

const formatBytes = (bytes: number): string => {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${bytes} bytes`;
};

const signed = (value: number): string => `${value >= 0 ? "+" : ""}${value}`;

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
  const manifest = parseAnalysisProjectManifest(
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

const regenerate = async (
  client: DisassemblyMaintenanceClient,
  resolved: ResolvedTarget,
  seeds: readonly DisassemblyEntrySeed[] | undefined,
): Promise<DisassemblyRegenerationSummary> => {
  const maxWorkItems = workspace
    .getConfiguration("asm", Uri.file(resolved.sourceDirectory))
    .get<number>("analysis.maxWorkItems", 100_000);
  if (!Number.isSafeInteger(maxWorkItems) || maxWorkItems < 1)
    throw new Error("asm.analysis.maxWorkItems must be a positive safe integer.");
  return withMaintenanceProgress(
    "Assembly: analyzing and regenerating disassembly",
    async (options) => {
      const { before, entryPoints } = await client.run(
        "prepare",
        { target: resolved, seeds },
        options,
      );
      options.onProgress?.({
        message: `Analyzing from ${entryPoints.length} runtime code seed(s)…`,
      });
      const analysis = await client.run(
        "analyze",
        { target: resolved, entryPoints, maxWorkItems },
        options,
      );
      options.onProgress?.({ message: "Writing generated source…" });
      const exported = await client.run("export", resolved, options);
      options.onProgress?.({ message: "Rebuilding and checking every ROM byte…" });
      const roundTrip = await client.run("verify", resolved, options);
      if (!roundTrip.comparison.equal)
        throw new Error(
          `Generated source differed at ROM offset ${roundTrip.comparison.firstDifference}.`,
        );
      options.onProgress?.({ message: "Summarizing updated analysis…" });
      const after = await client.run(
        "coverage",
        { ...resolved, sourceManifest: exported.manifest },
        options,
      );
      if (after.manifestSha256 !== exported.manifest.sourceProjectSha256)
        throw new Error(
          "Analysis changed while source was being regenerated. Run regeneration again to use the latest edits.",
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
        ...fileChanges(resolved.sourceManifest, exported.manifest),
        roundTripSha256: roundTrip.comparison.actualSha256,
      };
    },
    resolved.sourceDirectory,
  );
};

const statusReport = async (
  client: DisassemblyMaintenanceClient,
  resolved: ResolvedProjectSource,
): Promise<string> => {
  const coverage = await withMaintenanceProgress(
    "Assembly: checking disassembly status",
    (options) => client.run("coverage", resolved, options),
    resolved.sourceDirectory,
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

const traceImportMaxBytes = (sourceDirectory: string): number => {
  const mib = workspace
    .getConfiguration("asm", Uri.file(sourceDirectory))
    .get<number>("trace.maxImportSizeMiB", 2048);
  const bytes = mib * 1024 * 1024;
  if (!Number.isSafeInteger(mib) || mib < 1 || !Number.isSafeInteger(bytes))
    throw new Error(
      "asm.trace.maxImportSizeMiB must be a positive integer representing a safe byte limit.",
    );
  return bytes;
};

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
          onProgress: ({ message, bytesRead: read = 0, totalBytes: total = 0 }) => {
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
 */
export const registerDisassemblyMaintenance = (
  context: ExtensionContext,
  refresh: () => void,
  outputChannel?: LogOutputChannel,
): readonly Disposable[] => {
  const client = new DisassemblyMaintenanceClient(
    path.join(context.extensionUri.fsPath, "out", "disassembly-maintenance-process.cjs"),
  );
  let busy = false;
  const run = async (operation: () => Promise<void>): Promise<void> => {
    if (busy) {
      void window.showInformationMessage("A disassembly maintenance operation is already running.");
      return;
    }
    busy = true;
    await operation()
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        const details = error instanceof Error ? (error.stack ?? message) : message;
        outputChannel?.error(`Disassembly maintenance failed: ${details}`);
        void window.showErrorMessage(`Assembly disassembly update: ${message}`);
      })
      .finally(() => {
        busy = false;
      });
  };
  return [
    client,
    commands.registerCommand(
      REGENERATE_DISASSEMBLY_COMMAND,
      (target?: DisassemblyMaintenanceTarget) =>
        run(async () => {
          if (!workspace.isTrusted)
            throw new Error("Analysis and source regeneration require a trusted workspace.");
          const resolved = await resolveTarget(context, target);
          if (!resolved) return;
          const summary = await regenerate(client, resolved, target?.entrySeeds);
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
    commands.registerCommand(
      CONFIGURE_HEURISTICS_COMMAND,
      (target?: DisassemblyMaintenanceTarget) =>
        run(async () => {
          if (!workspace.isTrusted)
            throw new Error("Editing heuristic rules requires a trusted workspace.");
          const selected = await chooseProject(target?.projectDirectory);
          if (!selected) throw new Error("No native analysis project was found in the workspace.");
          if (selected.manifest.target !== "snes.sfc")
            throw new Error("Function heuristics require a SNES analysis project.");
          const file = path.join(selected.directory, "heuristics.json");
          try {
            await fs.promises.writeFile(
              file,
              JSON.stringify(
                {
                  enabled: true,
                  minimumConfidence: "medium",
                  disabledRules: [],
                  registerRules: [],
                },
                null,
                2,
              ) + "\n",
              { flag: "wx" },
            );
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
          }
          await window.showTextDocument(Uri.file(file), { preview: false });
        }),
    ),
    commands.registerCommand(PREVIEW_HEURISTICS_COMMAND, (target?: DisassemblyMaintenanceTarget) =>
      run(async () => {
        const selected = await chooseProject(target?.projectDirectory);
        if (!selected) throw new Error("No native analysis project was found in the workspace.");
        const file = path.join(selected.directory, "heuristics.json");
        if (
          workspace.textDocuments.some(
            (document) => document.uri.fsPath === file && document.isDirty,
          )
        )
          throw new Error("Save heuristics.json before previewing its rules.");
        const result = await window.withProgress(
          {
            location: ProgressLocation.Notification,
            title: "Running SNES heuristics",
            cancellable: false,
          },
          () =>
            analysisWorker().request<{
              enabled: boolean;
              total: number;
              roles: readonly SnesFunctionRole[];
            }>(selected.directory, "heuristics"),
        );
        await showMarkdown(
          [
            "# Heuristic findings",
            "",
            `Project: ${markdownCell(selected.directory)}`,
            "",
            result.enabled
              ? `${result.total} findings from the current saved analysis and heuristic rules.`
              : "Heuristics are disabled in heuristics.json.",
            "",
            "This preview leaves project files unchanged. Run **Analyze and Regenerate Disassembly** to apply the saved rules and include their comments in generated source.",
            "",
            "| Address | Role | Confidence | Evidence |",
            "| --- | --- | --- | --- |",
            ...result.roles.map(
              (role) =>
                `| ${role.addressSpace} ${hexAddress(role.address)} | ${markdownCell(role.role)}${role.relationship === "delegated" ? " (via call)" : ""} | ${role.confidence} | ${markdownCell(role.explanation)} |`,
            ),
            ...(result.total > result.roles.length
              ? [
                  "",
                  `Showing the first ${result.roles.length} of ${result.total} findings. Raise minimumConfidence or disable rules to narrow the preview.`,
                ]
              : []),
            ...(!result.total && result.enabled
              ? [
                  "",
                  "No rules matched. Analyze the project or import a runtime trace to provide more instruction evidence.",
                ]
              : []),
          ].join("\n"),
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
        if (resolved) await showMarkdown(await statusReport(client, resolved));
      }),
    ),
    commands.registerCommand(IMPORT_TRACE_AND_REGENERATE_COMMAND, (argument?: unknown) =>
      run(async () => {
        if (!workspace.isTrusted)
          throw new Error("Trace import and source regeneration require a trusted workspace.");
        const traceFile = await traceFileFrom(argument);
        if (!traceFile) return;
        // Read only the identity to select the project whose size setting applies.
        const trace = await readRuntimeTraceFileMetadata(traceFile, {
          maxBytes: Number.MAX_SAFE_INTEGER,
        });
        const resolved = await resolveTarget(context, {}, trace.romContentSha256);
        if (!resolved) return;
        validateSourceExportFiles(resolved.sourceDirectory, resolved.sourceManifest);
        const maxBytes = traceImportMaxBytes(resolved.sourceDirectory);
        const imported = await withMaintenanceProgress(
          "Assembly: importing runtime trace",
          (options) =>
            client.run(
              "import",
              {
                target: resolved,
                traceFile,
                maxBytes,
                architecture: trace.architecture,
                addressSpace: trace.addressSpace,
                indexMode: workspace
                  .getConfiguration("asm", Uri.file(resolved.sourceDirectory))
                  .get("trace.indexMode", "full"),
              },
              options,
            ),
          resolved.sourceDirectory,
        );
        const seeds = imported.seeds;
        let summary: DisassemblyRegenerationSummary;
        try {
          summary = await regenerate(client, resolved, seeds);
        } catch (error) {
          refresh();
          if (error instanceof Error && error.name === "AbortError") throw error;
          outputChannel?.error(
            `Disassembly regeneration failed: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`,
          );
          const executionReport = await withMaintenanceProgress(
            "Assembly: summarizing execution capture",
            (options) =>
              client.run(
                "execution",
                { projectDirectory: resolved.projectDirectory, traceFile, maxBytes },
                options,
              ),
            resolved.sourceDirectory,
          )
            .then(renderExecutionWindowReport)
            .catch(
              (reportError: unknown) =>
                `Routine report unavailable: ${reportError instanceof Error ? reportError.message : String(reportError)}`,
            );
          const message = error instanceof Error ? error.message : String(error);
          await showMarkdown(
            `${[
              "# Execution capture report",
              "",
              "## Disassembly regeneration did not complete",
              "",
              message,
              "",
              "The trace evidence was imported. Analysis and export guards preserve previous results when an update would discard known code; other failures may leave source unverified. The error above identifies the failed step. Routine attribution from the saved analysis is preserved below.",
              "",
              executionReport,
            ].join("\n")}\n`,
          );
          throw error;
        }
        const execution = await withMaintenanceProgress(
          "Assembly: summarizing execution capture",
          (options) =>
            client.run(
              "execution",
              { projectDirectory: resolved.projectDirectory, traceFile, maxBytes },
              options,
            ),
          resolved.sourceDirectory,
        );
        refresh();
        const mergeDetail = imported.changed
          ? `${imported.added.runtime} runtime address(es) and ${imported.added.evidence} evidence record(s) added`
          : "the identical trace evidence was already present";
        const report = `${renderDisassemblyRegenerationReport(summary).replace(
          "## Result\n\n",
          `## Trace import\n\n- File: ${traceFile}\n- Observed events: ${imported.observedEvents}\n- Unique observed PCs: ${imported.executionRecords}\n- Producer-dropped events: ${imported.droppedEvents}\n- Merge: ${mergeDetail}\n\n## Result\n\n`,
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

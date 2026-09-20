import * as fs from "node:fs";
import path from "node:path";

import {
  SNES_MAPPERS,
  SnesProjectInitializationCancelledError,
  initializeSnesDisassemblyWorkspace,
  probeSnesProject,
  type InitializeSnesDisassemblyWorkspaceResult,
  type SnesMapper,
  type SnesProjectInitializationProgress,
  type SnesProjectProbeResult,
  type SnesWorkspaceFile,
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
  type QuickPickItem,
} from "vscode";

import { rememberSnesRom } from "./snes-rom-bindings.js";

/** ROM-only project creation command. */
export const CREATE_DISASSEMBLY_PROJECT_COMMAND = "asm.createDisassemblyProject";
/** ROM plus DizRaw import command. */
export const IMPORT_DIZ_PROJECT_COMMAND = "asm.importDizProject";

/**
 * Quick-pick presentation and the native mapper ID selected when cartridge detection requires
 * user input.
 */
interface MapperPick extends QuickPickItem {
  readonly mapper: SnesMapper;
}

/**
 * Serialize generated workspace configuration as two-space JSON with a trailing newline.
 * @param {unknown} value JSON-serializable generated configuration.
 * @returns {string} Indented JSON text ending in a newline.
 */
const jsonFile = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

/**
 * VS Code settings and replay launch configuration written into each newly initialized
 * disassembly workspace.
 * @see https://code.visualstudio.com/docs/debugtest/debugging-configuration
 */
const WORKSPACE_FILES: readonly SnesWorkspaceFile[] = [
  {
    path: ".vscode/settings.json",
    contents: jsonFile({
      "asm.configFile": "uttori-asm.config.json",
      "asm.target": "snes.sfc",
      "asm.architecture": "snes.65816",
      "asm.entryPoints": ["main.asm"],
      "asm.includePaths": ["./"],
      "asm.buildOutput": "build/rebuilt-content.sfc",
      "asm.analysisProject": "analysis",
    }),
  },
  {
    path: ".vscode/launch.json",
    contents: jsonFile({
      version: "0.2.0",
      configurations: [
        {
          type: "uttori-asm",
          request: "launch",
          name: "Debug Disassembly (Replay)",
          backend: "replay",
          program: "${workspaceFolder}/build/rebuilt-content.sfc",
          debugMap: "${workspaceFolder}/build/rebuilt-content.sfc.debug.json",
          sourceRoot: "${workspaceFolder}",
        },
      ],
    }),
  },
];

/**
 * Ordered initialization stages used to turn repeated stage notifications into forward-only
 * percentage increments.
 */
const PROGRESS_STAGES: readonly string[] = [
  "probe",
  "create",
  "analyze",
  "export",
  "verify",
  "configure",
  "commit",
];

/**
 * Format input/round-trip sizes using binary MiB or KiB, retaining exact byte counts for sizes
 * below one KiB.
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
 * Rank supported cartridge mappers by DizRaw metadata, ROM detection, then scored candidates;
 * include evidence for explicit user selection.
 * @param {SnesProjectProbeResult} probe ROM detection and optional DizRaw mapper evidence.
 * @returns {readonly MapperPick[]} Supported mapper choices ranked by available evidence.
 */
const mapperItems = (probe: SnesProjectProbeResult): readonly MapperPick[] => {
  const candidates = new Map(
    probe.detection.candidates.map((candidate) => [candidate.mapper, candidate]),
  );
  const imported = probe.dizRaw?.mapping.mapper;
  const detected = probe.detection.mapper;
  const rank = (mapper: SnesMapper): number => {
    if (mapper === imported) {
      return 0;
    }
    if (mapper === detected) {
      return 1;
    }
    return candidates.has(mapper) ? 2 : 3;
  };
  return SNES_MAPPERS.map((mapper): MapperPick => {
    const candidate = candidates.get(mapper);
    const descriptions = [
      mapper === imported ? "DizRaw metadata" : undefined,
      mapper === detected ? "ROM detection" : undefined,
      candidate ? `score ${candidate.score}` : undefined,
    ].filter((value): value is string => value !== undefined);
    return {
      mapper,
      label: mapper,
      description: descriptions.join(" · "),
      detail: candidate?.evidence
        .slice(0, 3)
        .map((evidence) => `${evidence.kind}: ${evidence.detail}`)
        .join(". "),
    };
  }).sort(
    (left, right) =>
      rank(left.mapper) - rank(right.mapper) || left.label.localeCompare(right.label),
  );
};

/**
 * Accept automatic mapper detection when unambiguous; otherwise show ranked candidates and
 * return undefined on cancellation.
 * @param {SnesProjectProbeResult} probe Probe result describing whether explicit selection is required.
 * @returns {Promise<SnesMapper | undefined>} Detected/selected mapper, or undefined on cancellation.
 * @see https://code.visualstudio.com/api/references/vscode-api#window.showQuickPick
 */
const chooseMapper = async (probe: SnesProjectProbeResult): Promise<SnesMapper | undefined> => {
  if (!probe.mapperSelectionRequired) {
    return probe.detection.mapper;
  }
  const selected = await window.showQuickPick(mapperItems(probe), {
    title: "Select the SNES cartridge mapper",
    placeHolder: probe.mapperSelectionReason ?? "ROM detection needs an explicit mapper.",
    matchOnDescription: true,
    matchOnDetail: true,
    ignoreFocusOut: true,
  });
  return selected?.mapper;
};

/**
 * Prompt for one input file using the supplied extension filters; return its filesystem path or
 * undefined on cancellation.
 * @param {string} title Input dialog title.
 * @param {Record<string, string[]>} filters Display names mapped to allowed filename extensions.
 * @returns {Promise<string | undefined>} Selected filesystem path, or undefined on cancellation.
 * @see https://code.visualstudio.com/api/references/vscode-api#window.showOpenDialog
 */
const chooseFile = async (
  title: string,
  filters: Record<string, string[]>,
): Promise<string | undefined> => {
  const selected = await window.showOpenDialog({
    title,
    canSelectFiles: true,
    canSelectFolders: false,
    canSelectMany: false,
    filters,
  });
  return selected?.[0]?.fsPath;
};

/**
 * Prompt beside the ROM for an empty destination; report unreadable/nonempty directories and
 * return undefined for those or cancellation.
 * @param {string} romFile ROM filename whose parent seeds the dialog location.
 * @returns {Promise<string | undefined>} Readable empty directory, or undefined after rejection/cancellation.
 * @see https://code.visualstudio.com/api/references/vscode-api#window.showOpenDialog
 */
const chooseOutputDirectory = async (romFile: string): Promise<string | undefined> => {
  const selected = await window.showOpenDialog({
    title: "Select an empty output directory",
    defaultUri: Uri.file(path.dirname(romFile)),
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    openLabel: "Create Disassembly Project Here",
  });
  const directory = selected?.[0]?.fsPath;
  if (!directory) {
    return undefined;
  }
  try {
    if (fs.readdirSync(directory).length > 0) {
      void window.showErrorMessage("Assembly: the selected output directory must be empty.");
      return undefined;
    }
  } catch (error) {
    void window.showErrorMessage(
      `Assembly: cannot read the selected output directory: ${error instanceof Error ? error.message : String(error)}`,
    );
    return undefined;
  }
  return directory;
};

/**
 * Forward future cancellation events from the progress notification to the initializer/probe
 * AbortSignal.
 * @param {CancellationToken} token Progress token whose future cancellation events are forwarded.
 * @returns {AbortController} Controller providing the probe/initializer cancellation signal.
 * @see https://code.visualstudio.com/api/references/vscode-api#CancellationToken
 */
const abortController = (token: CancellationToken): AbortController => {
  const controller = new AbortController();
  token.onCancellationRequested(() => controller.abort());
  return controller;
};

/**
 * Inspect ROM and optional DizRaw inputs under a cancellable progress notification; propagate
 * probe errors to the wizard.
 * @param {string} romFile Local ROM file to inspect.
 * @param {string} [dizRawFile] Optional DiztinGUIsh input file.
 * @returns {Promise<SnesProjectProbeResult>} Detected ROM identity and mapper/import evidence.
 * @see https://code.visualstudio.com/api/references/vscode-api#window.withProgress
 * @see https://code.visualstudio.com/api/references/vscode-api#Progress
 */
const runProbe = async (romFile: string, dizRawFile?: string): Promise<SnesProjectProbeResult> =>
  window.withProgress(
    {
      location: ProgressLocation.Notification,
      title: "Assembly: inspecting disassembly inputs",
      cancellable: true,
    },
    (progress, token) => {
      const cancellation = abortController(token);
      progress.report({ message: "Reading ROM and scoring cartridge headers…" });
      return Promise.resolve(
        probeSnesProject({ romFile, dizRawFile, signal: cancellation.signal }),
      );
    },
  );

/**
 * Translate initializer stage events into messages and positive percentage increments, ignoring
 * repeated or out-of-order stage advances.
 * @param {object} progress Notification progress sink accepting messages and percentage increments.
 * @returns {Function} Stateful callback that advances only when the stage index increases.
 * @see https://code.visualstudio.com/api/references/vscode-api#window.withProgress
 * @see https://code.visualstudio.com/api/references/vscode-api#Progress
 */
const progressReporter = (progress: {
  report(value: { message?: string; increment?: number }): void;
}): ((event: SnesProjectInitializationProgress) => void) => {
  let completed = 0;
  return (event) => {
    const next = Math.max(completed, PROGRESS_STAGES.indexOf(event.stage));
    const increment = next > completed ? ((next - completed) / PROGRESS_STAGES.length) * 100 : 0;
    completed = next;
    progress.report({ message: event.message, ...(increment > 0 ? { increment } : {}) });
  };
};

/**
 * Summarize imported metadata, analysis counts, and the verified byte-identical rebuild for the
 * completion dialog and log.
 * @param {InitializeSnesDisassemblyWorkspaceResult} result Completed workspace initialization and round-trip verification.
 * @returns {string} Multiline import, analysis, and byte-identity summary.
 */
const completionDetail = (result: InitializeSnesDisassemblyWorkspaceResult): string => {
  const report = result.project.importReport;
  const unsupported = report?.unsupported.reduce((total, item) => total + item.count, 0) ?? 0;
  const warnings = report?.warnings.length ?? 0;
  const importDetail = report
    ? `DizRaw: ${report.imported.metadataBytes ?? 0} metadata bytes, ${unsupported} unsupported item(s), ${warnings} warning(s).\n`
    : "";
  return `${importDetail}Analysis: ${result.analysis.instructions} instruction(s), ${result.analysis.functions} function candidate(s), ${result.analysis.conflicts} conflict(s).\nRound trip: byte-identical ${formatBytes(result.roundTrip.comparison.actualLength)} (${result.roundTrip.comparison.actualSha256}).`;
};

/**
 * Collect inputs in a trusted workspace, initialize and verify the destination after
 * confirmation, remember the ROM, and open the new folder.
 * Cancellation leaves the wizard quietly or reports initializer cancellation; other failures are
 * logged and shown in the editor.
 * @param {ExtensionContext} context Extension storage used to remember the selected ROM.
 * @param {LogOutputChannel | undefined} outputChannel Optional diagnostic log for creation results and failures.
 * @param {boolean} importDiz Whether to request and import DiztinGUIsh metadata.
 * @returns {Promise<void>} Completion after creating/opening the project or handling cancellation/failure.
 */
const runProjectWizard = async (
  context: ExtensionContext,
  outputChannel: LogOutputChannel | undefined,
  importDiz: boolean,
): Promise<void> => {
  if (!workspace.isTrusted) {
    void window.showErrorMessage(
      "Assembly: trust this workspace before importing ROM-derived project files.",
    );
    return;
  }
  try {
    const romFile = await chooseFile("Select an SNES ROM", {
      "SNES ROM": ["sfc", "smc", "bin", "rom"],
      "All files": ["*"],
    });
    if (!romFile) {
      return;
    }
    const dizRawFile = importDiz
      ? await chooseFile("Select a DiztinGUIsh project", {
          "DiztinGUIsh project": ["dizraw", "diz"],
        })
      : undefined;
    if (importDiz && !dizRawFile) {
      return;
    }

    const initialProbe = await runProbe(romFile, dizRawFile);
    const mapper = await chooseMapper(initialProbe);
    if (!mapper) {
      return;
    }
    const resolvedProbe =
      initialProbe.detection.mapper === mapper && !initialProbe.mapperSelectionRequired
        ? initialProbe
        : await window.withProgress(
            {
              location: ProgressLocation.Notification,
              title: "Assembly: applying mapper selection",
            },
            () => Promise.resolve(probeSnesProject({ romFile, dizRawFile, mapper })),
          );
    const outputDirectory = await chooseOutputDirectory(romFile);
    if (!outputDirectory) {
      return;
    }
    const detectedMapper = resolvedProbe.detection.mapper ?? "needs selection";
    const header =
      resolvedProbe.rom.headerSize === 0 ? "none" : `${resolvedProbe.rom.headerSize} bytes`;
    const create = await window.showInformationMessage(
      `Create a disassembly project in '${path.basename(outputDirectory)}'?`,
      {
        modal: true,
        detail: `SNES · ${detectedMapper} · ${formatBytes(resolvedProbe.rom.contentSize)} · copier header: ${header}\n${outputDirectory}`,
      },
      "Create Project",
    );
    if (create !== "Create Project") {
      return;
    }

    const result = await window.withProgress(
      {
        location: ProgressLocation.Notification,
        title: "Assembly: creating disassembly project",
        cancellable: true,
      },
      async (progress, token) => {
        const cancellation = abortController(token);
        return initializeSnesDisassemblyWorkspace({
          romFile,
          dizRawFile,
          mapper,
          outputDirectory,
          workspaceFiles: WORKSPACE_FILES,
          signal: cancellation.signal,
          onProgress: progressReporter(progress),
        });
      },
    );
    await rememberSnesRom(context, result.probe.rom, romFile);
    const detail = completionDetail(result);
    outputChannel?.info(`Disassembly project created at ${outputDirectory}`);
    outputChannel?.info(detail.replaceAll("\n", " "));
    await window.showInformationMessage("Assembly: disassembly project created successfully.", {
      modal: true,
      detail,
    });
    await commands.executeCommand("vscode.openFolder", Uri.file(outputDirectory), false);
  } catch (error) {
    if (error instanceof SnesProjectInitializationCancelledError) {
      void window.showInformationMessage("Assembly: project creation cancelled.");
      return;
    }
    const message = error instanceof Error ? error.message : String(error);
    outputChannel?.error(`Project creation failed: ${message}`);
    void window.showErrorMessage(`Assembly: project creation failed: ${message}`);
  }
};

/**
 * Registers both project-initialization commands.
 * @param {ExtensionContext} context Extension storage and lifecycle context.
 * @param {LogOutputChannel | undefined} outputChannel Optional diagnostic output channel.
 * @returns {readonly Disposable[]} Command registrations owned by the extension context.
 * @see https://code.visualstudio.com/api/references/vscode-api#commands.registerCommand
 * @see https://code.visualstudio.com/api/references/vscode-api#ExtensionContext.subscriptions
 */
export const registerProjectWizards = (
  context: ExtensionContext,
  outputChannel?: LogOutputChannel,
): readonly Disposable[] => [
  commands.registerCommand(CREATE_DISASSEMBLY_PROJECT_COMMAND, () =>
    runProjectWizard(context, outputChannel, false),
  ),
  commands.registerCommand(IMPORT_DIZ_PROJECT_COMMAND, () =>
    runProjectWizard(context, outputChannel, true),
  ),
];

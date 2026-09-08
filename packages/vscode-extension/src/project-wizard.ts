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

interface MapperPick extends QuickPickItem {
  readonly mapper: SnesMapper;
}

const jsonFile = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

const workspaceFiles = (): readonly SnesWorkspaceFile[] => [
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

const formatBytes = (bytes: number): string => {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${bytes} bytes`;
};

const probeSummary = (probe: SnesProjectProbeResult): string => {
  const mapper = probe.detection.mapper ?? "needs selection";
  const header = probe.rom.headerSize === 0 ? "none" : `${probe.rom.headerSize} bytes`;
  return `SNES · ${mapper} · ${formatBytes(probe.rom.contentSize)} · copier header: ${header}`;
};

const mapperItems = (probe: SnesProjectProbeResult): readonly MapperPick[] => {
  const candidates = new Map(
    probe.detection.candidates.map((candidate) => [candidate.mapper, candidate]),
  );
  const imported = probe.dizRaw?.mapping.mapper;
  const detected = probe.detection.mapper;
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
        .join("; "),
    };
  }).sort((left, right) => {
    const rank = (item: MapperPick): number => {
      if (item.mapper === imported) return 0;
      if (item.mapper === detected) return 1;
      return candidates.has(item.mapper) ? 2 : 3;
    };
    return rank(left) - rank(right) || left.label.localeCompare(right.label);
  });
};

const chooseMapper = async (probe: SnesProjectProbeResult): Promise<SnesMapper | undefined> => {
  if (!probe.mapperSelectionRequired) return probe.detection.mapper;
  const selected = await window.showQuickPick(mapperItems(probe), {
    title: "Select the SNES cartridge mapper",
    placeHolder: probe.mapperSelectionReason ?? "ROM detection needs an explicit mapper.",
    matchOnDescription: true,
    matchOnDetail: true,
    ignoreFocusOut: true,
  });
  return selected?.mapper;
};

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
  if (!directory) return undefined;
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

const abortController = (token: CancellationToken): AbortController => {
  const controller = new AbortController();
  token.onCancellationRequested(() => controller.abort());
  return controller;
};

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

const progressReporter = (progress: {
  report(value: { message?: string; increment?: number }): void;
}): ((event: SnesProjectInitializationProgress) => void) => {
  const ordered = ["probe", "create", "analyze", "export", "verify", "configure", "commit"];
  let completed = 0;
  return (event) => {
    const next = Math.max(completed, ordered.indexOf(event.stage));
    const increment = next > completed ? ((next - completed) / ordered.length) * 100 : 0;
    completed = next;
    progress.report({ message: event.message, ...(increment > 0 ? { increment } : {}) });
  };
};

const completionDetail = (result: InitializeSnesDisassemblyWorkspaceResult): string => {
  const report = result.project.importReport;
  const unsupported = report?.unsupported.reduce((total, item) => total + item.count, 0) ?? 0;
  const warnings = report?.warnings.length ?? 0;
  const importDetail = report
    ? `DizRaw: ${report.imported.metadataBytes ?? 0} metadata bytes, ${unsupported} unsupported item(s), ${warnings} warning(s).\n`
    : "";
  return `${importDetail}Analysis: ${result.analysis.instructions} instruction(s), ${result.analysis.functions} function candidate(s), ${result.analysis.conflicts} conflict(s).\nRound trip: byte-identical ${formatBytes(result.roundTrip.comparison.actualLength)} (${result.roundTrip.comparison.actualSha256}).`;
};

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
    if (!romFile) return;
    const dizRawFile = importDiz
      ? await chooseFile("Select a DiztinGUIsh project", {
          "DiztinGUIsh project": ["dizraw", "diz"],
        })
      : undefined;
    if (importDiz && !dizRawFile) return;

    const initialProbe = await runProbe(romFile, dizRawFile);
    const mapper = await chooseMapper(initialProbe);
    if (!mapper) return;
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
    if (!outputDirectory) return;
    const create = await window.showInformationMessage(
      `Create a disassembly project in '${path.basename(outputDirectory)}'?`,
      {
        modal: true,
        detail: `${probeSummary(resolvedProbe)}\n${outputDirectory}`,
      },
      "Create Project",
    );
    if (create !== "Create Project") return;

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
          workspaceFiles: workspaceFiles(),
          signal: cancellation.signal,
          onProgress: progressReporter(progress),
        });
      },
    );
    await rememberSnesRom(context, result.probe.rom, romFile);
    outputChannel?.info(`Disassembly project created at ${outputDirectory}`);
    outputChannel?.info(completionDetail(result).replaceAll("\n", " "));
    await window.showInformationMessage("Assembly: disassembly project created successfully.", {
      modal: true,
      detail: completionDetail(result),
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

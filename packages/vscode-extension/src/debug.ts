import * as fs from "node:fs";
import * as path from "node:path";

import { validateDebugMap, type DebugMap } from "@uttori/asm-core/debug-map";
import {
  DebugSidecarClient,
  DebugAdapterSession,
  NodeStdioSidecarTransport,
  ReplayDebugBackend,
  SidecarDebugBackend,
  createDebugMapReplayScript,
  createDebugSidecarSessionToken,
  type DebugBackend,
  type DebugAdapterSessionOptions,
  type DapProtocolMessage,
  type DapRequest,
  type ReplayScript,
  LosslessCaptureFileRecorder,
  NativeCaptureFileRecorder,
  type CaptureResultV2,
} from "@uttori/asm-debug-adapter";
import { ARES_RSP_BACKEND_ID, ARES_RSP_CAPABILITIES } from "@uttori/asm-debug-sidecar-ares/profile";
import { parseAresRuntimeManifest } from "@uttori/asm-debug-sidecar-ares/runtime-manifest";
import { MESEN_BACKEND_ID, MESEN_CAPABILITIES } from "@uttori/asm-debug-sidecar-mesence/profile";
import { parseMesenRuntimeManifest } from "@uttori/asm-debug-sidecar-mesence/runtime-manifest";
import {
  DebugAdapterInlineImplementation,
  EventEmitter,
  Uri,
  commands,
  debug,
  window,
  StatusBarAlignment,
  workspace,
  type DebugAdapter,
  type DebugAdapterDescriptor,
  type DebugAdapterDescriptorFactory,
  type DebugAdapterExecutable,
  type DebugConfiguration,
  type DebugConfigurationProvider,
  type DebugSession,
  type Disposable,
  type Event,
  type ExtensionContext,
  type WorkspaceFolder,
  type OutputChannel,
} from "vscode";

import { createDebugInstructionAnnotation } from "./debug-analysis-annotations.js";
import { resolveDebugSourceRoot } from "./debug-source-root.js";
import { chooseLiveBusProject } from "./disassembly-maintenance.js";
import { LiveBusAnalysis } from "./live-bus-analysis.js";
import { runtimeBindingFromLaunch } from "./runtime-binding.js";
import {
  RuntimeTraceFileRecorder,
  resolveEditorTraceDetail,
  type EditorTraceBatch,
  type EditorTraceMetadata,
} from "./runtime-trace-recorder.js";
import { acquireTraceLease } from "./trace-lease.js";

/** Debugger type contributed by the extension manifest. */
export const UTTORI_ASM_DEBUG_TYPE = "uttori-asm";
export const UTTORI_TRACE_START_COMMAND = "asm.trace.start";
export const UTTORI_TRACE_STOP_COMMAND = "asm.trace.stop";
export const UTTORI_TRACE_STOP_ANALYZE_COMMAND = "asm.trace.stopAnalyze";
const IMPORT_TRACE_AND_REGENERATE_COMMAND = "asm.trace.importRegenerate";
const IMPORT_BUS_TRACE_COMMAND = "asm.trace.importBus";

export interface BuiltDebugArtifacts {
  readonly outputPath: string;
  readonly debugMapPath: string;
  readonly outputSha256?: string;
  readonly debugMapFingerprint?: string;
}

export interface EmulatorRuntimeBinding {
  readonly backend: "ares" | "mesence";
  readonly runtimeManifest: string;
  readonly emulator: string;
  readonly runtimeDirectory: string;
  readonly aresSystem?: string;
  readonly fastBoot?: boolean;
}

const EMULATOR_RUNTIME_BINDINGS_KEY = "uttoriAsm.emulatorRuntimeBindings.v1";

type EmulatorRuntimeBindings = Record<string, EmulatorRuntimeBinding>;

const runtimeWorkspace = (resource?: Uri): WorkspaceFolder | undefined =>
  (resource ? workspace.getWorkspaceFolder(resource) : undefined) ??
  workspace.workspaceFolders?.[0];

const runtimeWorkspaceKey = (folder: WorkspaceFolder): string => folder.uri.toString();

export const configuredEmulatorRuntime = (
  context: ExtensionContext,
  resource?: Uri,
): EmulatorRuntimeBinding | undefined => {
  const folder = runtimeWorkspace(resource);
  if (!folder) {
    return undefined;
  }
  const saved = context.globalState.get<EmulatorRuntimeBindings>(EMULATOR_RUNTIME_BINDINGS_KEY, {})[
    runtimeWorkspaceKey(folder)
  ];
  return (
    saved ??
    runtimeBindingFromLaunch(
      workspace.getConfiguration("launch", folder.uri).get<unknown[]>("configurations", []),
      folder.uri.fsPath,
    )
  );
};

const chooseLocalPath = async (
  title: string,
  options: {
    readonly files: boolean;
    readonly folders: boolean;
    readonly filters?: Record<string, string[]>;
  },
): Promise<string | undefined> => {
  const selected = await window.showOpenDialog({
    title,
    canSelectMany: false,
    canSelectFiles: options.files,
    canSelectFolders: options.folders,
    ...(options.filters ? { filters: options.filters } : {}),
  });
  const uri = selected?.[0];
  if (!uri) {
    return undefined;
  }
  if (uri.scheme !== "file") {
    throw new Error(`${title} must be on the local filesystem.`);
  }
  return uri.fsPath;
};

/**
 * Selects and validates the external runtime used by the bundled debug sidecar.
 * @param {ExtensionContext} context Extension storage host.
 * @param {Uri | undefined} resource Resource used to select a workspace binding.
 * @returns {Promise<EmulatorRuntimeBinding | undefined>} Saved binding, or undefined on cancel.
 */
export const configureEmulatorRuntime = async (
  context: ExtensionContext,
  resource?: Uri,
): Promise<EmulatorRuntimeBinding | undefined> => {
  if (!workspace.isTrusted) {
    throw new Error("Configuring an emulator runtime requires a trusted workspace.");
  }
  const folder = runtimeWorkspace(resource);
  if (!folder) {
    throw new Error("Open a workspace folder before configuring an emulator runtime.");
  }
  const selectedBackend = await window.showQuickPick(
    [
      {
        label: "ares",
        description:
          "65816 debugging and runtime capture; select a desktop manifest for a game window.",
        backend: "ares" as const,
      },
      {
        label: "MesenCE",
        description: "65816, SPC700, and Super FX inspection; no instruction capture stream yet.",
        backend: "mesence" as const,
      },
    ],
    { placeHolder: "Select the live emulator backend" },
  );
  if (!selectedBackend) {
    return undefined;
  }
  const runtimeManifest = await chooseLocalPath("Select the emulator runtime manifest", {
    files: true,
    folders: false,
    filters: { "Runtime manifest": ["json"] },
  });
  if (!runtimeManifest) {
    return undefined;
  }
  const emulator = await chooseLocalPath("Select the emulator executable", {
    files: true,
    folders: true,
  });
  if (!emulator) {
    return undefined;
  }
  const runtimeDirectory = await chooseLocalPath("Select the emulator runtime directory", {
    files: false,
    folders: true,
  });
  if (!runtimeDirectory) {
    return undefined;
  }

  const manifest = JSON.parse(fs.readFileSync(runtimeManifest, "utf8")) as unknown;
  if (selectedBackend.backend === "ares") {
    parseAresRuntimeManifest(manifest);
  } else {
    parseMesenRuntimeManifest(manifest);
  }
  const binding: EmulatorRuntimeBinding = {
    backend: selectedBackend.backend,
    runtimeManifest,
    emulator,
    runtimeDirectory,
    ...(selectedBackend.backend === "ares" ? { aresSystem: "Super Famicom", fastBoot: true } : {}),
  };
  const bindings = context.globalState.get<EmulatorRuntimeBindings>(
    EMULATOR_RUNTIME_BINDINGS_KEY,
    {},
  );
  await context.globalState.update(EMULATOR_RUNTIME_BINDINGS_KEY, {
    ...bindings,
    [runtimeWorkspaceKey(folder)]: binding,
  });
  void window.showInformationMessage(
    `Assembly: ${selectedBackend.label} runtime configured for ${folder.name}.`,
  );
  return binding;
};

/**
 * Creates a live launch that names the exact successful build artifact pair.
 * @param {EmulatorRuntimeBinding} binding Machine-local live runtime.
 * @param {BuiltDebugArtifacts} artifacts Exact successful build artifacts.
 * @param {WorkspaceFolder | undefined} folder Workspace owning the build.
 * @returns {DebugConfiguration} Direct live launch configuration.
 */
export const liveDebugConfiguration = (
  binding: EmulatorRuntimeBinding,
  artifacts: BuiltDebugArtifacts,
  folder: WorkspaceFolder | undefined,
): DebugConfiguration => ({
  type: UTTORI_ASM_DEBUG_TYPE,
  request: "launch",
  name: `Debug Uttori ASM (${binding.backend === "mesence" ? "MesenCE" : "ares"})`,
  backend: binding.backend,
  program: artifacts.outputPath,
  debugMap: artifacts.debugMapPath,
  sourceRoot: folder?.uri.fsPath ?? path.dirname(artifacts.outputPath),
  runtimeManifest: binding.runtimeManifest,
  emulator: binding.emulator,
  runtimeDirectory: binding.runtimeDirectory,
  ...(binding.aresSystem ? { aresSystem: binding.aresSystem } : {}),
  ...(binding.fastBoot === undefined ? {} : { fastBoot: binding.fastBoot }),
});

interface UttoriDebugConfiguration extends DebugConfiguration {
  readonly program: string;
  readonly debugMap: string;
  readonly sourceRoot?: string;
  readonly replay?: string;
  readonly backend?: "replay" | "ares" | "mesence";
  readonly runtimeManifest?: string;
  readonly emulator?: string;
  readonly runtimeDirectory?: string;
  readonly sidecar?: string;
  readonly aresSystem?: string;
  readonly fastBoot?: boolean;
}

interface TraceCapability {
  readonly instructionDetails?: boolean;
  readonly architecture: string;
  readonly addressSpace: string;
  readonly maxBufferedEvents: number;
  readonly maxBatchEvents: number;
}

interface ActiveTraceRecording {
  readonly session: DebugSession;
  readonly recorder:
    | RuntimeTraceFileRecorder
    | LosslessCaptureFileRecorder
    | NativeCaptureFileRecorder;
  /** Independent worker; failure preserves the native archive for offline import. */
  readonly live?: LiveBusAnalysis;
}

let activeTraceRecording: ActiveTraceRecording | undefined;
let debuggingExtensionRoot = "";
const liveAnalyses = new Set<LiveBusAnalysis>();
/** ROM/producer identity retained for ordinary runtime trace recording. */
interface DebugTraceSessionContext {
  readonly map: DebugMap;
  readonly producer: EditorTraceMetadata["producer"];
}
const sessionContexts = new Map<string, DebugTraceSessionContext>();

const resolvedPath = (value: string, folder: WorkspaceFolder | undefined): string =>
  path.isAbsolute(value) ? value : path.resolve(folder?.uri.fsPath ?? process.cwd(), value);

const requiredLivePath = (
  value: string | undefined,
  name: string,
  folder: WorkspaceFolder | undefined,
): string => {
  if (!value) {
    throw new Error(`Live Uttori ASM debugging requires '${name}'.`);
  }
  return resolvedPath(value, folder);
};

const stringField = (value: unknown, name: string): string => {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Trace identity '${name}' must be a non-empty string.`);
  }
  return value;
};

const traceMetadata = (session: DebugSession, trace: TraceCapability): EditorTraceMetadata => {
  const loaded = sessionContexts.get(session.id);
  if (!loaded) {
    throw new Error("No loaded debug-session identity is available.");
  }
  const map = loaded.map;
  const romContentSha256 = stringField(map.output?.sha256, "debugMap.output.sha256").toLowerCase();
  if (!/^[\da-f]{64}$/.test(romContentSha256)) {
    throw new Error("Trace ROM content identity must be a lowercase SHA-256 value.");
  }
  return { ...trace, romContentSha256, producer: loaded.producer };
};

const traceProducer = (session: DebugSession, map: DebugMap): EditorTraceMetadata["producer"] => {
  const configuration = session.configuration as UttoriDebugConfiguration;
  const folder = session.workspaceFolder;
  const kind = configuration.backend ?? "replay";
  if (kind === "replay") {
    return {
      id: "debug-map-replay",
      revision: stringField(map.fingerprint?.value, "debugMap.fingerprint.value"),
    };
  }
  const manifestFile = requiredLivePath(configuration.runtimeManifest, "runtimeManifest", folder);
  const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8")) as Record<string, unknown>;
  const patch = stringField(manifest.patchSha256, "runtimeManifest.patchSha256");
  const revision =
    kind === "ares"
      ? stringField(manifest.forkRevision, "runtimeManifest.forkRevision")
      : stringField(manifest.upstreamRevision, "runtimeManifest.upstreamRevision");
  const executable = stringField(manifest.executableSha256, "runtimeManifest.executableSha256");
  return { id: kind, revision: `${revision}:${patch}:${executable}` };
};

const chooseTrace = async (session: DebugSession): Promise<TraceCapability | undefined> => {
  const result = (await session.customRequest("uttori/traceCapabilities")) as {
    traces?: TraceCapability[];
  };
  const traces = result.traces ?? [];
  if (traces.length === 0) {
    throw new Error("The active backend has no instruction trace stream.");
  }
  if (traces.length === 1) {
    return traces[0];
  }
  const selected = await window.showQuickPick(
    traces.map((trace) => ({
      label: `${trace.architecture} / ${trace.addressSpace}`,
      description: `${trace.maxBufferedEvents} buffered, ${trace.maxBatchEvents} per pull`,
      trace,
    })),
    { placeHolder: "Select the processor instruction stream to record" },
  );
  return selected?.trace;
};

const defaultTraceUri = (
  session: DebugSession,
  extension: "json" | "act2",
  bus: boolean,
): Uri | undefined => {
  const root = session.workspaceFolder?.uri.fsPath ?? workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!root) {
    return undefined;
  }
  const timestamp = new Date().toISOString().replaceAll(":", "-");
  const prefix = bus ? "bus-trace" : "instruction-trace";
  return Uri.file(path.join(root, `${prefix}-${timestamp}.${extension}`));
};

const startRuntimeTraceWithLease = async (): Promise<void> => {
  if (activeTraceRecording) {
    throw new Error("A trace recording is already active.");
  }
  const session = debug.activeDebugSession;
  if (!session || session.type !== UTTORI_ASM_DEBUG_TYPE) {
    throw new Error("Start an Uttori ASM debug session before recording a trace.");
  }
  const trace = await chooseTrace(session);
  if (!trace) {
    return;
  }
  const traceMode = workspace
    .getConfiguration("asm", session.workspaceFolder?.uri)
    .get<string>("debug.traceMode", "live");
  const ppu = traceMode === "lossless-bus-ppu";
  const transfers = ppu || traceMode === "lossless-bus-transfers";
  const bus = transfers || traceMode === "lossless-bus";
  const lossless = bus || traceMode === "lossless-instructions";
  const detail = lossless
    ? "full"
    : resolveEditorTraceDetail(
        workspace
          .getConfiguration("asm", session.workspaceFolder?.uri)
          .get("debug.traceDetail", "full"),
        trace.instructionDetails,
      );
  const destination = await window.showSaveDialog({
    defaultUri: defaultTraceUri(session, lossless ? "act2" : "json", bus),
    filters: { "Uttori ASM trace": [lossless ? "act2" : "json"] },
    saveLabel: "Start Recording",
  });
  if (!destination) {
    return;
  }
  if (destination.scheme !== "file") {
    throw new Error("Runtime traces must be written to a local file.");
  }
  const metadata = traceMetadata(session, trace);
  if (lossless) {
    let captureScope: import("@uttori/asm-debug-adapter").CaptureScopeV2 =
      "snes.65816.instructions";
    if (bus) {
      captureScope = "snes.cpu-bus";
    }
    if (transfers) {
      captureScope = "snes.cpu-bus-transfers";
    }
    if (ppu) {
      captureScope = "snes.cpu-bus-ppu";
    }
    const nativeFile =
      workspace
        .getConfiguration("asm", session.workspaceFolder?.uri)
        .get<string>("debug.captureSink", "stream") === "native-file";
    const recorderType = nativeFile ? NativeCaptureFileRecorder : LosslessCaptureFileRecorder;
    const settings = workspace.getConfiguration("asm", session.workspaceFolder?.uri);
    const liveEnabled = nativeFile && bus && settings.get<boolean>("debug.liveBusAnalysis", false);
    // A stopped capture may still be catching up. Bound the editor to one
    // analysis worker, even if a new recording is requested during that drain.
    if (liveEnabled && liveAnalyses.size > 0) {
      throw new Error(
        "Previous live bus analysis is still finishing. Wait, or run Assembly: Stop Live Bus Analysis before starting another live recording.",
      );
    }
    const liveProject = liveEnabled
      ? await chooseLiveBusProject(metadata.romContentSha256)
      : undefined;
    if (liveEnabled && !liveProject) {
      throw new Error("Live analysis requires a matching analysis project.");
    }
    const recorder = await recorderType.create({
      ...metadata,
      file: destination.fsPath,
      format: "act2",
      scope: captureScope,
      transport: async (request) =>
        (await session.customRequest("uttori/capture", request)) as CaptureResultV2,
    });
    let live: LiveBusAnalysis | undefined;
    if (liveProject && recorder instanceof NativeCaptureFileRecorder) {
      const analysisSettings = workspace.getConfiguration("asm", Uri.file(liveProject));
      const status = window.createStatusBarItem(StatusBarAlignment.Left, 10);
      status.command = "asm.trace.cancelLiveAnalysis";
      status.text = "$(sync~spin) Bus analysis: waiting for capture";
      status.show();
      try {
        live = new LiveBusAnalysis(
          path.join(debuggingExtensionRoot, "out", "live-bus-analysis-process.cjs"),
          {
            file: destination.fsPath,
            projectDirectory: liveProject,
            position: recorder.position,
            maxLagBytes: settings.get<number>("debug.liveBusMaxLagMiB", 256) * 1024 * 1024,
            maxBytes: analysisSettings.get<number>("trace.maxImportSizeMiB", 2048) * 1048576,
            maxIndexRecords: 2_000_000,
          },
          (progress) => {
            const lagMiB = Math.max(0, progress.durableBytes - progress.readBytes) / 1048576;
            status.text = `$(sync~spin) Bus: ${progress.busEvents.toLocaleString()} accesses · ${progress.distinctFacts.toLocaleString()} facts · ${lagMiB.toFixed(0)} MiB behind`;
            status.tooltip = `Provisional activity; published after capture completion. PPU writes: ${progress.ppu?.byteWrites.toLocaleString() ?? "outside scope"}.`;
          },
          analysisSettings.get<number>("analysis.maxMemoryMiB", 512),
        );
        const analysis = live;
        liveAnalyses.add(analysis);
        // Only small validated positions cross IPC; analysis never owns the recorder's pump.
        const polling = setInterval(() => analysis.update(recorder.position), 100);
        void recorder.completion.then(
          (summary) => {
            clearInterval(polling);
            analysis.update(
              summary.position as import("@uttori/asm-debug-adapter").NativeCaptureFilePosition,
            );
          },
          () => {
            clearInterval(polling);
            analysis.cancel();
          },
        );
        void analysis.completion
          .then(
            (result) => {
              void window.showInformationMessage(
                `Assembly: live bus analysis published ${result.added.runtime.toLocaleString()} new facts from ${result.observedEvents.toLocaleString()} accesses.`,
              );
              void commands.executeCommand("asm.sources.refresh");
            },
            (error: unknown) => {
              void window.showWarningMessage(
                `Assembly live analysis stopped: ${error instanceof Error ? error.message : String(error)} The ACT2 recording remains available for offline import.`,
              );
            },
          )
          .finally(() => {
            clearInterval(polling);
            status.dispose();
            liveAnalyses.delete(analysis);
          });
      } catch (error) {
        status.dispose();
        // A worker startup error must not leave an armed, unreachable recorder.
        await recorder.finishIncomplete().catch(() => undefined);
        throw error;
      }
    }
    activeTraceRecording = { session, recorder, live };
    void recorder.completion.catch((error: unknown) => {
      if (activeTraceRecording?.recorder === recorder) {
        activeTraceRecording = undefined;
      }
      void window.showErrorMessage(
        `Assembly lossless capture failed: ${error instanceof Error ? error.message : String(error)}. The partial ACT2 archive retains committed evidence; emulation remains stopped on producer failure.`,
      );
    });
    void window.showInformationMessage(
      bus
        ? "Assembly: recording lossless CPU/DMA/HDMA bus accesses to ACT2. Emulation slows when storage falls behind. Instruction bytes and registers are not recorded in this mode."
        : "Assembly: recording lossless 65816 instructions with fetched bytes and CPU state. Emulation slows when storage falls behind. Bus events are outside this capture scope.",
    );
    return;
  }
  await session.customRequest("uttori/startTrace", {
    detail,
    architecture: trace.architecture,
    addressSpace: trace.addressSpace,
  });
  let recorder: RuntimeTraceFileRecorder;
  try {
    recorder = await RuntimeTraceFileRecorder.create({
      file: destination.fsPath,
      ...metadata,
      maxBatchEvents: trace.maxBatchEvents,
      readTrace: async (maxEvents): Promise<EditorTraceBatch> =>
        (await session.customRequest("uttori/readTrace", { maxEvents })) as EditorTraceBatch,
      stopTrace: async () => {
        await session.customRequest("uttori/stopTrace");
      },
    });
  } catch (error) {
    try {
      await session.customRequest("uttori/stopTrace");
    } catch {
      // Preserve the original file-creation failure.
    }
    throw error;
  }
  activeTraceRecording = { session, recorder };
  void recorder.completion.catch((error: unknown) => {
    if (activeTraceRecording?.recorder !== recorder) {
      return;
    }
    activeTraceRecording = undefined;
    void window.showErrorMessage(
      `Assembly trace recording failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  });
  void window.showInformationMessage(
    `Assembly: recording ${trace.architecture} instructions (${detail === "full" ? "full execution details" : "PC-only"}).`,
  );
};

const startRuntimeTrace = async (): Promise<void> => {
  const release = acquireTraceLease();
  try {
    await startRuntimeTraceWithLease();
    if (activeTraceRecording) {
      void activeTraceRecording.recorder.completion.then(release, release);
      return;
    }
  } catch (error) {
    release();
    throw error;
  }
  release();
};

const stopRuntimeTrace = async (analyze = false): Promise<void> => {
  const active = activeTraceRecording;
  if (!active) {
    throw new Error("No Uttori ASM trace recording is active.");
  }
  activeTraceRecording = undefined;
  const summary = await active.recorder.stop();
  // Bus evidence has its own importer: observed accesses cannot supply instruction bytes or code seeds.
  if ("scope" in summary && summary.scope !== "snes.65816.instructions") {
    if (active.live) {
      try {
        await active.live.completion;
        return;
      } catch {
        // Worker failure does not invalidate a successfully finalized native archive.
      }
    }
    if (analyze) {
      await commands.executeCommand(IMPORT_BUS_TRACE_COMMAND, Uri.file(summary.file));
      return;
    }
    const action = await window.showInformationMessage(
      `Assembly: ${summary.observedEvents.toLocaleString()} CPU/DMA/HDMA capture event(s) retained; zero dropped. Wrote ${summary.file}.`,
      "Import Bus Activity",
    );
    if (action === "Import Bus Activity") {
      await commands.executeCommand(IMPORT_BUS_TRACE_COMMAND, Uri.file(summary.file));
    }
    return;
  }
  const total = summary.observedEvents + summary.droppedEvents;
  const scope =
    "archive" in summary ? "; lossless instruction archive saved (bus events excluded)" : "";
  const counts = `${summary.observedEvents.toLocaleString()} instruction event(s) retained; ${summary.droppedEvents.toLocaleString()} dropped${total > 0 ? ` (${((summary.droppedEvents / total) * 100).toFixed(1)}%)` : ""}${scope}`;
  const notify =
    summary.droppedEvents > 0 ? window.showWarningMessage : window.showInformationMessage;
  if (analyze) {
    void notify(`Assembly: ${counts}; updating the disassembly and identifying routines…`);
    await commands.executeCommand(IMPORT_TRACE_AND_REGENERATE_COMMAND, Uri.file(summary.file));
    return;
  }
  const action = await notify(
    `Assembly: ${counts}. Wrote ${summary.file}.`,
    "Import Trace and Update Disassembly",
  );
  if (action === "Import Trace and Update Disassembly") {
    await commands.executeCommand(IMPORT_TRACE_AND_REGENERATE_COMMAND, Uri.file(summary.file));
  }
};

const runTraceCommand = (command: () => Promise<void>): void => {
  void command().catch((error: unknown) =>
    window.showErrorMessage(
      `Assembly trace: ${error instanceof Error ? error.message : String(error)}`,
    ),
  );
};

const debugSessionTerminated = (session: DebugSession): void => {
  sessionContexts.delete(session.id);
  const active = activeTraceRecording;
  if (!active || active.session.id !== session.id) {
    return;
  }
  activeTraceRecording = undefined;
  void active.recorder
    .finishIncomplete()
    .then((summary) =>
      window.showWarningMessage(
        `Assembly: debug session ended; preserved an incomplete ${summary.observedEvents}-event trace at ${summary.file}.`,
      ),
    )
    .catch((error: unknown) =>
      window.showErrorMessage(
        `Assembly trace finalization failed: ${error instanceof Error ? error.message : String(error)}`,
      ),
    );
};

const createLiveBackend = (
  configuration: UttoriDebugConfiguration,
  folder: WorkspaceFolder | undefined,
  extensionRoot: string,
  program: string,
  log: (message: string) => void,
): DebugBackend => {
  if (!workspace.isTrusted) {
    throw new Error("Live Uttori ASM debugging requires a trusted workspace.");
  }
  const kind = configuration.backend;
  if (kind !== "ares" && kind !== "mesence") {
    throw new Error(`Unsupported live Uttori ASM backend '${String(kind)}'.`);
  }
  const manifest = requiredLivePath(configuration.runtimeManifest, "runtimeManifest", folder);
  const emulator = requiredLivePath(configuration.emulator, "emulator", folder);
  const runtimeDirectory = requiredLivePath(
    configuration.runtimeDirectory,
    "runtimeDirectory",
    folder,
  );
  const bundledSidecar = path.join(
    extensionRoot,
    "sidecars",
    kind === "ares" ? "ares.mjs" : "mesence.mjs",
  );
  const sidecar = configuration.sidecar
    ? resolvedPath(configuration.sidecar, folder)
    : bundledSidecar;
  const backend = kind === "ares" ? ARES_RSP_BACKEND_ID : MESEN_BACKEND_ID;
  const capabilities = kind === "ares" ? ARES_RSP_CAPABILITIES : MESEN_CAPABILITIES;
  return new SidecarDebugBackend({
    backend,
    capabilities,
    createClient: () => {
      const session = createDebugSidecarSessionToken();
      const emulatorFlag = kind === "ares" ? "--ares" : "--mesen";
      const args = [
        sidecar,
        "--manifest",
        manifest,
        emulatorFlag,
        emulator,
        "--rom",
        program,
        "--runtime-dir",
        runtimeDirectory,
      ];
      if (kind === "ares" && configuration.aresSystem) {
        args.push("--system", configuration.aresSystem);
      }
      if (kind === "ares" && configuration.fastBoot === false) {
        args.push("--no-fast-boot");
      }
      const transport = new NodeStdioSidecarTransport({
        command: process.execPath,
        args,
        cwd: runtimeDirectory,
        env: { ELECTRON_RUN_AS_NODE: "1" },
        session,
        shutdownTimeoutMs: 3_000,
        onStderr: (text) => log(text.trimEnd()),
      });
      return new DebugSidecarClient({ transport, session, requestTimeoutMs: 15_000 });
    },
  });
};

const loadConfiguration = (
  session: DebugSession,
  extensionRoot: string,
  log: (message: string) => void,
): {
  readonly backend: DebugBackend;
  readonly map: DebugMap;
  readonly output: Uint8Array;
  readonly sourceRoot: string;
} => {
  const configuration = session.configuration as UttoriDebugConfiguration;
  if (!configuration.program || !configuration.debugMap) {
    throw new Error("Uttori ASM debugging requires 'program' and 'debugMap'.");
  }
  const folder = session.workspaceFolder;
  const program = resolvedPath(configuration.program, folder);
  const mapFile = resolvedPath(configuration.debugMap, folder);
  const output = new Uint8Array(fs.readFileSync(program));
  const map = JSON.parse(fs.readFileSync(mapFile, "utf8")) as DebugMap;
  const issues = validateDebugMap(map, output);
  if (issues.length) {
    throw new Error(issues.join(" "));
  }
  const kind = configuration.backend ?? "replay";
  const backend = (() => {
    if (kind !== "replay") {
      return createLiveBackend(configuration, folder, extensionRoot, program, log);
    }
    const script: ReplayScript = configuration.replay
      ? (JSON.parse(
          fs.readFileSync(resolvedPath(configuration.replay, folder), "utf8"),
        ) as ReplayScript)
      : createDebugMapReplayScript(map, output);
    return new ReplayDebugBackend(script);
  })();
  const configuredSourceRoot = resolvedPath(configuration.sourceRoot ?? ".", folder);
  // Debug maps store portable paths that may be rooted beside the generated ROM rather
  // than at the opened workspace. Resolve that layout before DAP maps PCs back to files.
  const sourceRoot = resolveDebugSourceRoot({
    map,
    configuredRoot: configuredSourceRoot,
    debugMapFile: mapFile,
    programFile: program,
    ...(folder ? { workspaceRoot: folder.uri.fsPath } : {}),
  });
  if (sourceRoot !== configuredSourceRoot) {
    log(`Resolved debug-map source root ${configuredSourceRoot} → ${sourceRoot}.`);
  }
  return {
    backend,
    map,
    output,
    sourceRoot,
  };
};

class InlineDebugAdapter implements DebugAdapter {
  readonly #emitter = new EventEmitter<DapProtocolMessage>();
  readonly #session: DebugAdapterSession;
  readonly #backend: DebugBackend;
  readonly onDidSendMessage: Event<DapProtocolMessage> = this.#emitter.event;

  constructor(
    loaded: ReturnType<typeof loadConfiguration>,
    instructionAnnotation?: DebugAdapterSessionOptions["instructionAnnotation"],
    log: (message: string) => void = () => {},
  ) {
    this.#backend = loaded.backend;
    this.#session = new DebugAdapterSession({
      backend: loaded.backend,
      debugMap: loaded.map,
      output: loaded.output,
      sourceRoot: loaded.sourceRoot,
      ...(instructionAnnotation ? { instructionAnnotation } : {}),
      configurationHandshake: true,
      onMessage: (message) => {
        if (message.type === "response" && !message.success) {
          log(`${message.command} failed: ${message.message}`);
          if (message.command === "launch" || message.command === "attach") {
            void window.showErrorMessage(`Assembly debugger: ${message.message}`);
          }
        } else if (message.type === "event" && message.event === "stopped") {
          log(
            "Paused. Inspect CALL STACK and VARIABLES in Run and Debug; use Step Into (F11) or Continue (F5). Capture commands observe execution only while it runs.",
          );
        } else if (message.type === "event" && message.event === "continued") {
          log("Emulator running.");
        } else if (message.type === "event" && message.event === "terminated") {
          log("Debug session ended.");
        }
        this.#emitter.fire(message);
      },
    });
  }

  /** @param {DapRequest} message DAP request from VS Code. */
  handleMessage(message: DapRequest): void {
    void this.#session.dispatch(message);
  }

  /** Releases protocol and event resources. */
  dispose(): void {
    this.#session.dispose();
    // Some backends reject synchronously before returning a promise. Starting a promise
    // chain first contains both that throw and an asynchronous transport rejection.
    void Promise.resolve()
      .then(() => this.#backend.disconnect({ terminate: true }))
      .catch(() => undefined);
    this.#emitter.dispose();
  }
}

class UttoriDebugConfigurationProvider implements DebugConfigurationProvider {
  /**
   * Supplies a usable map-backed replay launch when `launch.json` is initially empty.
   * @param {WorkspaceFolder | undefined} folder Selected workspace folder.
   * @param {DebugConfiguration} configuration Partial configuration.
   * @returns {DebugConfiguration} Completed launch configuration.
   */
  resolveDebugConfiguration(
    folder: WorkspaceFolder | undefined,
    configuration: DebugConfiguration,
  ): DebugConfiguration {
    const root = folder?.uri.fsPath ?? "${workspaceFolder}";
    const configuredProgram =
      typeof configuration.program === "string" ? configuration.program : undefined;
    const configuredMap =
      typeof configuration.debugMap === "string" ? configuration.debugMap : undefined;
    const configuredSourceRoot =
      typeof configuration.sourceRoot === "string" ? configuration.sourceRoot : undefined;
    const program = configuredProgram ?? path.join(root, "build", "rebuilt-content.sfc");
    return {
      ...configuration,
      type: typeof configuration.type === "string" ? configuration.type : UTTORI_ASM_DEBUG_TYPE,
      request: typeof configuration.request === "string" ? configuration.request : "launch",
      name:
        typeof configuration.name === "string" ? configuration.name : "Debug Uttori ASM (Replay)",
      program,
      debugMap: configuredMap ?? `${program}.debug.json`,
      sourceRoot: configuredSourceRoot ?? root,
    };
  }
}

class UttoriDebugAdapterFactory implements DebugAdapterDescriptorFactory {
  readonly #extensionRoot: string;

  constructor(
    extensionRoot: string,
    readonly output: OutputChannel,
  ) {
    this.#extensionRoot = extensionRoot;
  }

  /**
   * Hosts the adapter inside the extension process.
   * @param {DebugSession} session VS Code debug session.
   * @param {DebugAdapterExecutable | undefined} _executable Ignored external adapter descriptor.
   * @returns {DebugAdapterDescriptor} Inline adapter descriptor.
   */
  createDebugAdapterDescriptor(
    session: DebugSession,
    _executable: DebugAdapterExecutable | undefined,
  ): DebugAdapterDescriptor {
    this.output.show(true);
    const log = (message: string): void => this.output.appendLine(`[${session.name}] ${message}`);
    log("Reading and validating ROM/debug map…");
    let loaded: ReturnType<typeof loadConfiguration>;
    try {
      if (session.configuration.backend === "ares") {
        const manifest = parseAresRuntimeManifest(
          JSON.parse(
            fs.readFileSync(
              requiredLivePath(
                (session.configuration as UttoriDebugConfiguration).runtimeManifest,
                "runtimeManifest",
                session.workspaceFolder,
              ),
              "utf8",
            ),
          ),
        );
        log(
          manifest.frontend === "desktop"
            ? "ares desktop: a game window will open with video, audio, and controller input. Launch pauses at entry; Continue (F5) starts the game. Configure controls in ares Settings → Input."
            : "ares headless: no game window, video, or controller input. Choose a desktop runtime manifest for interactive play.",
        );
      }
      loaded = loadConfiguration(session, this.#extensionRoot, log);
    } catch (error) {
      log(`Launch failed: ${String(error)}`);
      void window.showErrorMessage(
        `Assembly debugger: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
    sessionContexts.set(session.id, {
      map: loaded.map,
      producer: traceProducer(session, loaded.map),
    });
    let instructionAnnotation: DebugAdapterSessionOptions["instructionAnnotation"];
    // Analysis presentation is optional and must never prevent debugger startup.
    const updateAnnotations = async (): Promise<void> => {
      const annotation = await createDebugInstructionAnnotation(loaded.map);
      if (sessionContexts.has(session.id)) {
        instructionAnnotation = annotation;
      }
    };
    void updateAnnotations().catch((error) =>
      log(`Optional annotations unavailable: ${String(error)}`),
    );
    log("Artifacts valid. Connecting debugger; it will stop at entry…");
    return new DebugAdapterInlineImplementation(
      new InlineDebugAdapter(loaded, (address) => instructionAnnotation?.(address), log),
    );
  }
}

/**
 * Registers the Uttori ASM debug configuration and inline adapter factories.
 * @param {string} extensionRoot Absolute installed extension root containing bundled sidecars.
 * @returns {readonly Disposable[]} Extension subscriptions.
 */
export const registerDebugging = (extensionRoot: string): readonly Disposable[] => {
  debuggingExtensionRoot = extensionRoot;
  const output = window.createOutputChannel("Uttori Emulator");
  return [
    {
      dispose: () => {
        for (const analysis of liveAnalyses) {
          analysis.cancel();
        }
      },
    },
    output,
    debug.registerDebugConfigurationProvider(
      UTTORI_ASM_DEBUG_TYPE,
      new UttoriDebugConfigurationProvider(),
    ),
    debug.registerDebugAdapterDescriptorFactory(
      UTTORI_ASM_DEBUG_TYPE,
      new UttoriDebugAdapterFactory(extensionRoot, output),
    ),
    commands.registerCommand(UTTORI_TRACE_START_COMMAND, () => runTraceCommand(startRuntimeTrace)),
    commands.registerCommand("asm.trace.cancelLiveAnalysis", () => {
      for (const analysis of liveAnalyses) {
        analysis.cancel();
      }
    }),
    commands.registerCommand(UTTORI_TRACE_STOP_COMMAND, () =>
      runTraceCommand(() => stopRuntimeTrace(false)),
    ),
    commands.registerCommand(UTTORI_TRACE_STOP_ANALYZE_COMMAND, () =>
      runTraceCommand(() => stopRuntimeTrace(true)),
    ),
    debug.onDidTerminateDebugSession(debugSessionTerminated),
  ];
};

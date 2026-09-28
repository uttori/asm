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

import { chooseLiveBusProject } from "../disassembly/maintenance.js";
import { runtimeBindingFromLaunch } from "../runtime/binding.js";
import { LiveBusAnalysis } from "../runtime/live-bus-analysis.js";
import { acquireTraceLease } from "../runtime/trace-lease.js";
import {
  RuntimeTraceFileRecorder,
  resolveEditorTraceDetail,
  type EditorTraceBatch,
  type EditorTraceMetadata,
} from "../runtime/trace-recorder.js";
import { createDebugInstructionAnnotation } from "./analysis-annotations.js";
import { createSnesDebugAddressResolvers } from "./rom-addresses.js";
import { resolveDebugSourceRoot } from "./source-root.js";

/**
 * Debugger type contributed by the extension manifest.
 * @see https://code.visualstudio.com/api/references/contribution-points#contributes.debuggers
 */
export const UTTORI_ASM_DEBUG_TYPE = "uttori-asm";
/** Command ID that selects a processor stream and begins the configured runtime capture. */
export const UTTORI_TRACE_START_COMMAND = "asm.trace.start";
/** Command ID that finalizes the active capture and offers the appropriate import action. */
export const UTTORI_TRACE_STOP_COMMAND = "asm.trace.stop";
/** Command ID that finalizes capture and imports its instruction or bus evidence into analysis. */
export const UTTORI_TRACE_STOP_ANALYZE_COMMAND = "asm.trace.stopAnalyze";
/**
 * Maintenance command invoked after instruction capture to import execution evidence and
 * regenerate source.
 */
const IMPORT_TRACE_AND_REGENERATE_COMMAND = "asm.trace.importRegenerate";
/**
 * Maintenance command invoked after bus capture to import access evidence without treating it as
 * instruction seeds.
 */
const IMPORT_BUS_TRACE_COMMAND = "asm.trace.importBus";

/**
 * ROM and debug-map paths from the same successful build, with optional identities used to
 * detect changes before launch.
 */
export interface BuiltDebugArtifacts {
  readonly outputPath: string;
  readonly debugMapPath: string;
  readonly outputSha256?: string;
  readonly debugMapFingerprint?: string;
}

/**
 * Machine-local live-backend selection and filesystem paths, with optional ares launch settings.
 */
export interface EmulatorRuntimeBinding {
  readonly backend: "ares" | "mesence";
  readonly runtimeManifest: string;
  readonly emulator: string;
  readonly runtimeDirectory: string;
  readonly aresSystem?: string;
  readonly fastBoot?: boolean;
}

/**
 * Versioned global-state key for emulator selections indexed by workspace-folder URI; paths stay
 * outside project configuration.
 */
const EMULATOR_RUNTIME_BINDINGS_KEY = "uttoriAsm.emulatorRuntimeBindings.v1";

/** Saved emulator selections keyed by the full workspace-folder URI string. */
type EmulatorRuntimeBindings = Record<string, EmulatorRuntimeBinding>;

/**
 * Prefer the workspace containing the resource, otherwise use the first open folder; return
 * undefined for an empty workspace.
 * @param {Uri} [resource] Resource whose workspace should own the runtime selection.
 * @returns {WorkspaceFolder | undefined} Containing folder, first open folder, or undefined without a workspace.
 */
const runtimeWorkspace = (resource?: Uri): WorkspaceFolder | undefined =>
  (resource ? workspace.getWorkspaceFolder(resource) : undefined) ??
  workspace.workspaceFolders?.[0];

/**
 * Use the full folder URI as the storage key so bindings distinguish workspace locations and URI
 * schemes.
 * @param {WorkspaceFolder} folder Workspace folder owning the machine-local binding.
 * @returns {string} Complete URI string used as the storage key.
 */
const runtimeWorkspaceKey = (folder: WorkspaceFolder): string => folder.uri.toString();

/**
 * Return the workspace binding saved in extension storage, falling back to an unambiguous live
 * launch configuration.
 * Returns undefined without a workspace or usable selection; runtime files are validated later.
 * @param {ExtensionContext} context Extension storage containing saved machine-local bindings.
 * @param {Uri} [resource] Resource used to choose the owning workspace.
 * @returns {EmulatorRuntimeBinding | undefined} Saved or unambiguous launch binding, when available.
 * @see https://code.visualstudio.com/api/references/vscode-api#ExtensionContext.globalState
 * @see https://code.visualstudio.com/api/references/vscode-api#workspace.getConfiguration
 */
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

/**
 * Prompt for one file or directory; return undefined on cancellation and throw if the selected
 * URI is not file-backed.
 * @param {string} title Dialog title also used in validation errors.
 * @param {object} options Allowed file/folder selections and optional extension filters.
 * @returns {Promise<string | undefined>} Local filesystem path, or undefined on cancellation.
 * @see https://code.visualstudio.com/api/references/vscode-api#window.showOpenDialog
 */
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
 * @see https://code.visualstudio.com/api/references/vscode-api#ExtensionContext.globalState
 * @see https://code.visualstudio.com/api/references/vscode-api#workspace.getConfiguration
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
          "65816 debugging and runtime capture. Select a desktop manifest for a game window.",
        backend: "ares" as const,
      },
      {
        label: "MesenCE",
        description: "65816, SPC700, and Super FX inspection. No instruction capture stream yet.",
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
  ...(artifacts.outputSha256 ? { outputSha256: artifacts.outputSha256 } : {}),
  ...(artifacts.debugMapFingerprint ? { debugMapFingerprint: artifacts.debugMapFingerprint } : {}),
  sourceRoot: folder?.uri.fsPath ?? path.dirname(artifacts.outputPath),
  runtimeManifest: binding.runtimeManifest,
  emulator: binding.emulator,
  runtimeDirectory: binding.runtimeDirectory,
  ...(binding.aresSystem ? { aresSystem: binding.aresSystem } : {}),
  ...(binding.fastBoot === undefined ? {} : { fastBoot: binding.fastBoot }),
});

/**
 * Resolved launch settings consumed by the adapter; replay is the default backend and live
 * backends require external runtime paths.
 */
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

/**
 * Processor stream identity and event-count limits advertised by the backend; optional detail
 * support governs full versus PC-only capture.
 */
interface TraceCapability {
  readonly instructionDetails?: boolean;
  readonly architecture: string;
  readonly addressSpace: string;
  readonly maxBufferedEvents: number;
  readonly maxBatchEvents: number;
}

/**
 * Session-owned recorder plus optional independent bus importer; stopping the recorder may leave
 * the importer draining.
 */
interface ActiveTraceRecording {
  readonly session: DebugSession;
  readonly recorder:
    | RuntimeTraceFileRecorder
    | LosslessCaptureFileRecorder
    | NativeCaptureFileRecorder;
  /** Independent worker. Failure preserves the native archive for offline import. */
  readonly live?: LiveBusAnalysis;
}

/**
 * Single interactive capture across all debug sessions; cleared before stopping/finalizing or
 * after recorder failure.
 */
let activeTraceRecording: ActiveTraceRecording | undefined;
/**
 * Installed extension directory set during debugger registration and used to locate the bundled
 * live-analysis child process.
 */
let debuggingExtensionRoot = "";
/**
 * Unfinished bus importers, including those draining stopped captures; removed on completion and
 * cancelled on extension disposal.
 */
const liveAnalyses = new Set<LiveBusAnalysis>();
/** ROM/producer identity retained for ordinary runtime trace recording. */
interface DebugTraceSessionContext {
  readonly map: DebugMap;
  readonly producer: EditorTraceMetadata["producer"];
}
/**
 * Validated ROM/producer identities keyed by debug session ID; populated by adapter creation and
 * removed on session termination.
 */
const sessionContexts = new Map<string, DebugTraceSessionContext>();

/**
 * Resolve relative launch paths against the session workspace, falling back to the
 * extension-host working directory.
 * @param {string} value Absolute or workspace-relative launch setting.
 * @param {WorkspaceFolder | undefined} folder Session workspace, if one is associated.
 * @returns {string} Absolute path using the host working directory as fallback.
 */
const resolvedPath = (value: string, folder: WorkspaceFolder | undefined): string =>
  path.isAbsolute(value) ? value : path.resolve(folder?.uri.fsPath ?? process.cwd(), value);

/**
 * Require a nonempty live-runtime path setting and resolve it against the session workspace;
 * throw with the missing setting name.
 * @param {string | undefined} value Required launch setting, possibly absent.
 * @param {string} name Configuration field name used in errors.
 * @param {WorkspaceFolder | undefined} folder Session workspace used for relative resolution.
 * @returns {string} Absolute runtime path; missing values throw.
 */
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

/**
 * Require a nonempty trace-identity string and throw a field-specific error instead of coercing
 * malformed metadata.
 * @param {unknown} value Unvalidated identity field.
 * @param {string} name Field path included in validation errors.
 * @returns {string} Nonempty identity string without coercion.
 */
const stringField = (value: unknown, name: string): string => {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Trace identity '${name}' must be a non-empty string.`);
  }
  return value;
};

/**
 * Combine the selected stream with the session ROM hash and producer identity; throw if
 * validated session identity is unavailable or malformed.
 * @param {DebugSession} session Debug session with a retained validated identity.
 * @param {TraceCapability} trace Selected processor stream and negotiated limits.
 * @returns {EditorTraceMetadata} Immutable stream, ROM, and producer metadata for the recorder.
 */
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

/**
 * Identify replay by the map fingerprint and live runtimes by revision, patch hash, and
 * executable hash read from the manifest.
 * Missing identity fields and unreadable manifests fail capture setup.
 * @param {DebugSession} session Session configuration selecting replay or a live runtime.
 * @param {DebugMap} map Validated debug map supplying replay identity.
 * @returns {EditorTraceMetadata["producer"]} Producer ID and revision derived from persisted build identities.
 */
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

/**
 * Query backend trace capabilities, selecting the sole stream or prompting for a processor.
 * Throws when no stream exists; returns undefined if the picker is cancelled.
 * @param {DebugSession} session Active session queried for trace capabilities.
 * @returns {Promise<TraceCapability | undefined>} Selected stream, or undefined when selection is cancelled.
 * @see https://code.visualstudio.com/api/references/vscode-api#DebugSession.customRequest
 * @see https://code.visualstudio.com/api/references/vscode-api#window.showQuickPick
 */
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

/**
 * Suggest a timestamped instruction/bus capture filename under the session workspace, or the
 * first folder; return undefined without either.
 * @param {DebugSession} session Session supplying the preferred workspace folder.
 * @param {"json" | "act2"} extension Capture file format suffix.
 * @param {boolean} bus Whether to use the bus-trace filename prefix.
 * @returns {Uri | undefined} Suggested local destination, or undefined without a workspace.
 */
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

/**
 * Configure and start a recorder while the caller holds the global trace lease, publishing it as
 * the active capture.
 * Picker cancellation exits without recording; startup failures stop any armed recorder before
 * propagating.
 * @returns {Promise<void>} Completion after startup or picker cancellation; the recorder continues asynchronously.
 */
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
    .get<string>("debug.traceMode", "lossless-instructions");
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
      context: settings.get<boolean>("debug.captureContext", true),
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
            status.tooltip = `Provisional activity. Published after capture completion. PPU writes: ${progress.ppu?.byteWrites.toLocaleString() ?? "outside scope"}.`;
          },
          analysisSettings.get<number>("analysis.maxMemoryMiB", 512),
        );
        const analysis = live;
        liveAnalyses.add(analysis);
        // Only small validated positions cross IPC. Analysis never owns the recorder's pump.
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
        `Assembly lossless capture failed: ${error instanceof Error ? error.message : String(error)}. The partial ACT2 archive retains committed evidence. Emulation remains stopped on producer failure.`,
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

/**
 * Hold the global trace lease through interactive setup and recorder completion, releasing it on
 * cancellation or startup failure.
 * @returns {Promise<void>} Completion after setup; the lease remains held until an active recorder settles.
 */
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

/** Save a named visual milestone at an acknowledged pause; leave the game paused
 * so users can inspect or step from the same recorded boundary. */
const markRuntimeCapture = async (): Promise<void> => {
  const active = activeTraceRecording;
  if (!active || active.recorder instanceof RuntimeTraceFileRecorder) {
    throw new Error("Start a lossless capture before adding a milestone.");
  }
  const label = await window.showInputBox({
    prompt: "Capture milestone",
    placeHolder: "Accepted payment / refund / Sprite joins",
  });
  if (!label?.trim()) {
    return;
  }
  await active.session.customRequest("uttori/capture", {
    operation: "context",
    action: "mark",
    session: active.recorder.position.session,
    label,
  });
};

/** Restore a verified bundle into the active matching runtime. Replay supplies
 * recorded serial inputs until the saved endpoint; restore leaves controls live
 * for a new branch such as refusing payment or having insufficient money.
 * @param {boolean} replay Whether to supply recorded console inputs after restoring.
 */
const restoreRuntimeCapture = async (replay: boolean): Promise<void> => {
  if (activeTraceRecording) {
    throw new Error("Stop the active recording before restoring a capture.");
  }
  const session = debug.activeDebugSession;
  if (!session || session.type !== UTTORI_ASM_DEBUG_TYPE) {
    throw new Error("Start a matching ares debug session first.");
  }
  const selected = await window.showOpenDialog({
    canSelectFolders: true,
    canSelectFiles: false,
    canSelectMany: false,
    openLabel: replay ? "Replay Capture" : "Restore Capture State",
  });
  if (!selected?.[0]) {
    return;
  }
  const trace = await chooseTrace(session);
  if (!trace) {
    return;
  }
  const metadata = traceMetadata(session, trace);
  await session.customRequest("uttori/capture", {
    operation: "context",
    action: replay ? "replay" : "restore",
    directory: selected[0].fsPath,
    romContentSha256: metadata.romContentSha256,
    producer: metadata.producer,
  });
  void window.showInformationMessage(
    replay
      ? "Assembly: capture replay is armed. Continue to replay recorded inputs and pause at the saved endpoint."
      : "Assembly: pre-action state restored. Start a new capture before trying an alternative action.",
  );
};

/**
 * Detach and finalize the active recorder, then route completed evidence to its matching
 * importer or offer an import action.
 * By default import is optional; analyze requests it immediately. Successful live bus analysis
 * already satisfies the import.
 * @param {boolean} [analyze] Import immediately after finalization when true; defaults to false.
 * @returns {Promise<void>} Completion after finalization and any selected import workflow.
 */
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
      `Assembly: ${summary.observedEvents.toLocaleString()} CPU/DMA/HDMA capture event(s) retained. Zero dropped. Wrote ${summary.file}.`,
      "Import Bus Activity",
    );
    if (action === "Import Bus Activity") {
      await commands.executeCommand(IMPORT_BUS_TRACE_COMMAND, Uri.file(summary.file));
    }
    return;
  }
  const total = summary.observedEvents + summary.droppedEvents;
  const scope =
    "archive" in summary ? ". Lossless instruction archive saved (bus events excluded)" : "";
  const counts = `${summary.observedEvents.toLocaleString()} instruction event(s) retained. ${summary.droppedEvents.toLocaleString()} dropped${total > 0 ? ` (${((summary.droppedEvents / total) * 100).toFixed(1)}%)` : ""}${scope}`;
  const notify =
    summary.droppedEvents > 0 ? window.showWarningMessage : window.showInformationMessage;
  if (analyze) {
    void notify(`Assembly: ${counts}. Updating the disassembly and identifying routines…`);
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

/**
 * Start an asynchronous trace command and report rejection through an editor error notification
 * instead of leaving it unhandled.
 * @param {Function} command Trace operation whose failures should be shown in the editor.
 */
const runTraceCommand = (command: () => Promise<void>): void => {
  void command().catch((error: unknown) =>
    window.showErrorMessage(
      `Assembly trace: ${error instanceof Error ? error.message : String(error)}`,
    ),
  );
};

/**
 * Forget session identity and asynchronously finalize its active capture as incomplete,
 * preserving recorded evidence and reporting the outcome.
 * @param {DebugSession} session Ended session whose identity and active recording must be released.
 * @see https://code.visualstudio.com/api/references/vscode-api#debug.onDidTerminateDebugSession
 */
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
        `Assembly: debug session ended. Preserved an incomplete ${summary.observedEvents}-event trace at ${summary.file}.`,
      ),
    )
    .catch((error: unknown) =>
      window.showErrorMessage(
        `Assembly trace finalization failed: ${error instanceof Error ? error.message : String(error)}`,
      ),
    );
};

/**
 * Construct a lazy sidecar backend for a trusted workspace using validated required paths and an
 * optional sidecar override.
 * The backend creates its transport on connection; the debug adapter owns termination and
 * disposal.
 * @param {UttoriDebugConfiguration} configuration Live launch settings for ares or mesence.
 * @param {WorkspaceFolder | undefined} folder Workspace used to resolve relative runtime paths.
 * @param {string} extensionRoot Installed extension root containing bundled sidecars.
 * @param {string} program Absolute ROM filename to load.
 * @param {string} romSha256 Verified headerless build identity, also used for native capture matching.
 * @param {Function} log Destination for sidecar stderr messages.
 * @returns {DebugBackend} Lazy live backend owned by the inline adapter.
 * @see https://code.visualstudio.com/api/references/vscode-api#workspace.isTrusted
 */
const createLiveBackend = (
  configuration: UttoriDebugConfiguration,
  folder: WorkspaceFolder | undefined,
  extensionRoot: string,
  program: string,
  romSha256: string,
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
        "--rom-sha256",
        romSha256,
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

/**
 * Read and validate the ROM/debug-map pair, choose replay or live transport, and resolve the
 * most plausible source root.
 * Missing settings, invalid artifacts, and unsupported live configurations throw before adapter
 * creation.
 * @param {DebugSession} session VS Code session with resolved launch settings.
 * @param {string} extensionRoot Installed extension root containing bundled sidecars.
 * @param {Function} log Destination for source-root and backend diagnostics.
 * @returns {object} Validated ROM/map, selected backend, and resolved source root.
 */
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
  const issues = [...validateDebugMap(map, output)];
  // Reject even a mutually valid ROM/map pair when it is not the successful build selected for launch.
  if (configuration.outputSha256 && configuration.outputSha256 !== map.output.sha256) {
    issues.push("ROM differs from the selected build.");
  }
  if (
    configuration.debugMapFingerprint &&
    configuration.debugMapFingerprint !== map.fingerprint.value
  ) {
    issues.push("Debug map differs from the selected build.");
  }
  if (issues.length) {
    throw new Error(issues.join(" "));
  }
  const kind = configuration.backend ?? "replay";
  const backend = (() => {
    if (kind !== "replay") {
      return createLiveBackend(
        configuration,
        folder,
        extensionRoot,
        program,
        map.output.sha256,
        log,
      );
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

/**
 * Bridge VS Code protocol messages to the target-neutral DAP session inside the extension host;
 * disposal terminates its backend and event emitter.
 * @see https://code.visualstudio.com/api/references/vscode-api#DebugAdapter
 * @see https://code.visualstudio.com/api/references/vscode-api#DebugAdapterInlineImplementation
 */
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
      ...createSnesDebugAddressResolvers(loaded.map, loaded.output),
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
            "Paused. Inspect CALL STACK and VARIABLES in Run and Debug. Use Step Into (F11) or Continue (F5). Capture commands observe execution only while it runs.",
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

/**
 * Supply replay-launch defaults for missing fields while preserving explicitly configured launch
 * values.
 * @see https://code.visualstudio.com/api/references/vscode-api#DebugConfigurationProvider
 */
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

/**
 * Create one inline adapter per VS Code session, retain its capture identity, and load optional
 * analysis annotations without blocking startup.
 * @see https://code.visualstudio.com/api/references/vscode-api#DebugAdapterDescriptorFactory
 */
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
            ? "ares desktop: a game window will open with video, audio, and controller input. Launch pauses at entry. Continue (F5) starts the game. Configure controls in ares Settings → Input."
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
    log("Artifacts valid. Connecting debugger. It will stop at entry…");
    return new DebugAdapterInlineImplementation(
      new InlineDebugAdapter(loaded, (address) => instructionAnnotation?.(address), log),
    );
  }
}

/**
 * Registers the Uttori ASM debug configuration and inline adapter factories.
 * @param {string} extensionRoot Absolute installed extension root containing bundled sidecars.
 * @returns {readonly Disposable[]} Extension subscriptions.
 * @see https://code.visualstudio.com/api/references/vscode-api#debug.registerDebugConfigurationProvider
 * @see https://code.visualstudio.com/api/references/vscode-api#debug.registerDebugAdapterDescriptorFactory
 * @see https://code.visualstudio.com/api/extension-guides/debugger-extension
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
    commands.registerCommand("asm.trace.mark", () => runTraceCommand(markRuntimeCapture)),
    commands.registerCommand("asm.trace.replay", () =>
      runTraceCommand(() => restoreRuntimeCapture(true)),
    ),
    commands.registerCommand("asm.trace.restore", () =>
      runTraceCommand(() => restoreRuntimeCapture(false)),
    ),
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

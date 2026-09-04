import * as fs from "node:fs";
import * as path from "node:path";

import type { DebugMap } from "@uttori/asm-core/debug-map";
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
} from "@uttori/asm-debug-adapter";
import { ARES_RSP_BACKEND_ID, ARES_RSP_CAPABILITIES } from "@uttori/asm-debug-sidecar-ares/profile";
import { MESEN_BACKEND_ID, MESEN_CAPABILITIES } from "@uttori/asm-debug-sidecar-mesence/profile";
import {
  DebugAdapterInlineImplementation,
  EventEmitter,
  Uri,
  commands,
  debug,
  window,
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
  type WorkspaceFolder,
} from "vscode";
import { createDebugInstructionAnnotation } from "./debug-analysis-annotations.js";
import {
  RuntimeTraceFileRecorder,
  type EditorTraceBatch,
  type EditorTraceMetadata,
} from "./runtime-trace-recorder.js";

/** Debugger type contributed by the extension manifest. */
export const UTTORI_ASM_DEBUG_TYPE = "uttori-asm";
export const UTTORI_TRACE_START_COMMAND = "asm.trace.start";
export const UTTORI_TRACE_STOP_COMMAND = "asm.trace.stop";

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
  readonly architecture: string;
  readonly addressSpace: string;
  readonly maxBufferedEvents: number;
  readonly maxBatchEvents: number;
}

interface ActiveTraceRecording {
  readonly session: DebugSession;
  readonly recorder: RuntimeTraceFileRecorder;
}

let activeTraceRecording: ActiveTraceRecording | undefined;

const resolvedPath = (value: string, folder: WorkspaceFolder | undefined): string =>
  path.isAbsolute(value) ? value : path.resolve(folder?.uri.fsPath ?? process.cwd(), value);

const requiredLivePath = (
  value: string | undefined,
  name: string,
  folder: WorkspaceFolder | undefined,
): string => {
  if (!value) throw new Error(`Live Uttori ASM debugging requires '${name}'.`);
  return resolvedPath(value, folder);
};

const stringField = (value: unknown, name: string): string => {
  if (typeof value !== "string" || value.length === 0)
    throw new Error(`Trace identity '${name}' must be a non-empty string.`);
  return value;
};

const traceMetadata = (session: DebugSession, trace: TraceCapability): EditorTraceMetadata => {
  const configuration = session.configuration as UttoriDebugConfiguration;
  const folder = session.workspaceFolder;
  const mapFile = requiredLivePath(configuration.debugMap, "debugMap", folder);
  const map = JSON.parse(fs.readFileSync(mapFile, "utf8")) as DebugMap;
  const romContentSha256 = stringField(map.output?.sha256, "debugMap.output.sha256").toLowerCase();
  if (!/^[\da-f]{64}$/.test(romContentSha256))
    throw new Error("Trace ROM content identity must be a lowercase SHA-256 value.");
  const kind = configuration.backend ?? "replay";
  if (kind === "replay")
    return {
      ...trace,
      romContentSha256,
      producer: {
        id: "debug-map-replay",
        revision: stringField(map.fingerprint?.value, "debugMap.fingerprint.value"),
      },
    };
  const manifestFile = requiredLivePath(configuration.runtimeManifest, "runtimeManifest", folder);
  const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8")) as Record<string, unknown>;
  const patch = stringField(manifest.patchSha256, "runtimeManifest.patchSha256");
  const revision =
    kind === "ares"
      ? stringField(manifest.forkRevision, "runtimeManifest.forkRevision")
      : stringField(manifest.upstreamRevision, "runtimeManifest.upstreamRevision");
  return {
    ...trace,
    romContentSha256,
    producer: { id: kind, revision: `${revision}:${patch}` },
  };
};

const chooseTrace = async (session: DebugSession): Promise<TraceCapability | undefined> => {
  const result = (await session.customRequest("uttori/traceCapabilities")) as {
    traces?: TraceCapability[];
  };
  const traces = result.traces ?? [];
  if (traces.length === 0) throw new Error("The active backend has no instruction trace stream.");
  if (traces.length === 1) return traces[0];
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

const defaultTraceUri = (session: DebugSession): Uri | undefined => {
  const root = session.workspaceFolder?.uri.fsPath ?? workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!root) return undefined;
  const timestamp = new Date().toISOString().replaceAll(":", "-");
  return Uri.file(path.join(root, `instruction-trace-${timestamp}.json`));
};

const startRuntimeTrace = async (): Promise<void> => {
  if (activeTraceRecording) throw new Error("An instruction trace recording is already active.");
  const session = debug.activeDebugSession;
  if (!session || session.type !== UTTORI_ASM_DEBUG_TYPE)
    throw new Error("Start an Uttori ASM debug session before recording a trace.");
  const trace = await chooseTrace(session);
  if (!trace) return;
  const destination = await window.showSaveDialog({
    defaultUri: defaultTraceUri(session),
    filters: { "Uttori ASM instruction trace": ["json"] },
    saveLabel: "Start Recording",
  });
  if (!destination) return;
  if (destination.scheme !== "file")
    throw new Error("Live instruction traces must be written to a local file.");
  const metadata = traceMetadata(session, trace);
  await session.customRequest("uttori/startTrace", {
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
    if (activeTraceRecording?.recorder !== recorder) return;
    activeTraceRecording = undefined;
    void window.showErrorMessage(
      `Assembly trace recording failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  });
  void window.showInformationMessage(`Assembly: recording ${trace.architecture} instructions.`);
};

const stopRuntimeTrace = async (): Promise<void> => {
  const active = activeTraceRecording;
  if (!active) throw new Error("No Uttori ASM instruction trace recording is active.");
  activeTraceRecording = undefined;
  const summary = await active.recorder.stop();
  void window.showInformationMessage(
    `Assembly: wrote ${summary.observedEvents} instruction event(s) to ${summary.file}; ${summary.droppedEvents} producer event(s) dropped.`,
  );
};

const runTraceCommand = (command: () => Promise<void>): void => {
  void command().catch((error: unknown) =>
    window.showErrorMessage(
      `Assembly trace: ${error instanceof Error ? error.message : String(error)}`,
    ),
  );
};

const debugSessionTerminated = (session: DebugSession): void => {
  const active = activeTraceRecording;
  if (!active || active.session.id !== session.id) return;
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
): DebugBackend => {
  if (!workspace.isTrusted)
    throw new Error("Live Uttori ASM debugging requires a trusted workspace.");
  const kind = configuration.backend;
  if (kind !== "ares" && kind !== "mesence")
    throw new Error(`Unsupported live Uttori ASM backend '${String(kind)}'.`);
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
      if (kind === "ares" && configuration.aresSystem)
        args.push("--system", configuration.aresSystem);
      if (kind === "ares" && configuration.fastBoot === false) args.push("--no-fast-boot");
      const transport = new NodeStdioSidecarTransport({
        command: process.execPath,
        args,
        cwd: runtimeDirectory,
        env: { ELECTRON_RUN_AS_NODE: "1" },
        session,
        shutdownTimeoutMs: 3_000,
      });
      return new DebugSidecarClient({ transport, session, requestTimeoutMs: 15_000 });
    },
  });
};

const loadConfiguration = (
  session: DebugSession,
  extensionRoot: string,
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
  const kind = configuration.backend ?? "replay";
  const backend = (() => {
    if (kind !== "replay") return createLiveBackend(configuration, folder, extensionRoot, program);
    const script: ReplayScript = configuration.replay
      ? (JSON.parse(
          fs.readFileSync(resolvedPath(configuration.replay, folder), "utf8"),
        ) as ReplayScript)
      : createDebugMapReplayScript(map, output);
    return new ReplayDebugBackend(script);
  })();
  return {
    backend,
    map,
    output,
    sourceRoot: resolvedPath(configuration.sourceRoot ?? ".", folder),
  };
};

class InlineDebugAdapter implements DebugAdapter {
  readonly #emitter = new EventEmitter<DapProtocolMessage>();
  readonly #session: DebugAdapterSession;
  readonly onDidSendMessage: Event<DapProtocolMessage> = this.#emitter.event;

  constructor(
    loaded: ReturnType<typeof loadConfiguration>,
    instructionAnnotation?: DebugAdapterSessionOptions["instructionAnnotation"],
  ) {
    this.#session = new DebugAdapterSession({
      backend: loaded.backend,
      debugMap: loaded.map,
      output: loaded.output,
      sourceRoot: loaded.sourceRoot,
      ...(instructionAnnotation ? { instructionAnnotation } : {}),
      onMessage: (message) => this.#emitter.fire(message),
    });
  }

  /** @param {DapRequest} message DAP request from VS Code. */
  handleMessage(message: DapRequest): void {
    void this.#session.dispatch(message);
  }

  /** Releases protocol and event resources. */
  dispose(): void {
    this.#session.dispose();
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

  constructor(extensionRoot: string) {
    this.#extensionRoot = extensionRoot;
  }

  /**
   * Hosts the adapter inside the extension process.
   * @param {DebugSession} session VS Code debug session.
   * @param {DebugAdapterExecutable | undefined} _executable Ignored external adapter descriptor.
   * @returns {Promise<DebugAdapterDescriptor>} Inline adapter descriptor.
   */
  async createDebugAdapterDescriptor(
    session: DebugSession,
    _executable: DebugAdapterExecutable | undefined,
  ): Promise<DebugAdapterDescriptor> {
    const loaded = loadConfiguration(session, this.#extensionRoot);
    let instructionAnnotation: DebugAdapterSessionOptions["instructionAnnotation"];
    try {
      instructionAnnotation = await createDebugInstructionAnnotation(loaded.map);
    } catch {
      // Analysis presentation is optional and must never prevent debugger startup.
    }
    return new DebugAdapterInlineImplementation(
      new InlineDebugAdapter(loaded, instructionAnnotation),
    );
  }
}

/**
 * Registers the Uttori ASM debug configuration and inline adapter factories.
 * @param {string} extensionRoot Absolute installed extension root containing bundled sidecars.
 * @returns {readonly Disposable[]} Extension subscriptions.
 */
export const registerDebugging = (extensionRoot: string): readonly Disposable[] => [
  debug.registerDebugConfigurationProvider(
    UTTORI_ASM_DEBUG_TYPE,
    new UttoriDebugConfigurationProvider(),
  ),
  debug.registerDebugAdapterDescriptorFactory(
    UTTORI_ASM_DEBUG_TYPE,
    new UttoriDebugAdapterFactory(extensionRoot),
  ),
  commands.registerCommand(UTTORI_TRACE_START_COMMAND, () => runTraceCommand(startRuntimeTrace)),
  commands.registerCommand(UTTORI_TRACE_STOP_COMMAND, () => runTraceCommand(stopRuntimeTrace)),
  debug.onDidTerminateDebugSession(debugSessionTerminated),
];

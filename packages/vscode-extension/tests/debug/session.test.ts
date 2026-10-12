import * as fs from "node:fs";
import { registerHooks } from "node:module";
import os from "node:os";
import path from "node:path";

import { AddressToLineMapping, createDebugMap } from "@uttori/asm-core";
import { LosslessCaptureFileRecorder, type CaptureFileSummary } from "@uttori/asm-debug-adapter";
import sinon from "sinon";
import type {
  DebugAdapterDescriptorFactory,
  DebugConfigurationProvider,
  DebugSession,
  ExtensionContext,
  Uri as VsCodeUri,
  WorkspaceFolder,
} from "vscode";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUri(value: object): value is VsCodeUri {
  return (
    "scheme" in value &&
    value.scheme === "file" &&
    "fsPath" in value &&
    typeof value.fsPath === "string" &&
    "toString" in value &&
    typeof value.toString === "function"
  );
}

function isExtensionContext(value: object): value is ExtensionContext {
  return (
    "subscriptions" in value &&
    Array.isArray(value.subscriptions) &&
    "globalState" in value &&
    typeof value.globalState === "object" &&
    value.globalState !== null
  );
}

function isWorkspaceFolder(value: object): value is WorkspaceFolder {
  return (
    "name" in value &&
    typeof value.name === "string" &&
    "uri" in value &&
    typeof value.uri === "object" &&
    value.uri !== null &&
    isUri(value.uri)
  );
}

function isDebugSession(value: object): value is DebugSession {
  return (
    "id" in value &&
    typeof value.id === "string" &&
    "configuration" in value &&
    typeof value.configuration === "object" &&
    value.configuration !== null
  );
}

function isCaptureSummary(value: object): value is CaptureFileSummary {
  return (
    "file" in value &&
    typeof value.file === "string" &&
    "archive" in value &&
    typeof value.archive === "string" &&
    "observedEvents" in value &&
    typeof value.observedEvents === "number" &&
    "droppedEvents" in value &&
    value.droppedEvents === 0 &&
    "chunks" in value &&
    typeof value.chunks === "number" &&
    "complete" in value &&
    typeof value.complete === "boolean"
  );
}

function isInlineAdapter(value: unknown): value is { adapter: { dispose(): void } } {
  return isRecord(value) && isRecord(value.adapter) && typeof value.adapter.dispose === "function";
}

function isRecorder(value: object): value is LosslessCaptureFileRecorder {
  return "completion" in value && "stop" in value && typeof value.stop === "function";
}

import { test } from "../../../../tests/ava-helper.js";

const aresManifest = {
  schemaVersion: 1,
  emulator: "ares",
  upstreamRevision: "7b51c8ab719e403a150aa700e0933d9e93a06851",
  headlessBaseRevision: "fc44d4542557e69421b2609b74b5aa7cb57bac2d",
  forkRevision: "d87030d70a9c0bf51b5de99f56a5a94a00d16e4c",
  headlessPatchSha256: "8ce2373d63f7ec4b18e204b9e39c532fa65eca028072efa98ea508fbfb9a7b0f",
  patchSha256: "ebf137b334335fc42d8ee3c22739734bda3a3d67b06aa376de97cc74f0ee238d",
  executableSha256: "4a6e4ab960c282c16f1688f86aa49d9a992bd5a418cd74a6666412060c6389cd",
  romSha256: "4c15013131351e694e05f22e38bb1b3e4031dedac77ec75abecebe8520d82d5f",
  platform: "darwin",
  architecture: "arm64",
  buildConfiguration: "RelWithDebInfo; ares-headless; SNES-only",
  resources: [
    {
      path: "Database/Super Famicom.bml",
      sha256: "7167f5f8b86786639829ee67769d2959553261938bf896ce28db8f39a3cc08dc",
    },
  ],
};

const host = {
  trusted: true,
  folders: undefined as
    | { uri: { fsPath: string; toString(): string; scheme: string }; name: string }[]
    | undefined,
  launchConfigurations: [] as unknown[],
  dialogs: [] as ({ scheme: string; fsPath: string }[] | undefined)[],
  quickPick: undefined as { label: string; backend: "ares" } | undefined,
  messages: [] as string[],
  progress: [] as { title: string; cancellable: boolean }[],
  activeSession: undefined as unknown,
  destination: undefined as VsCodeUri | undefined,
  executed: [] as string[],
  commands: new Map<string, (...args: unknown[]) => unknown>(),
  registered: [] as string[],
  providers: [] as string[],
  factory: undefined as DebugAdapterDescriptorFactory | undefined,
  configurationProvider: undefined as DebugConfigurationProvider | undefined,
  commandResult: undefined as unknown,
  terminate: undefined as ((session: DebugSession) => void) | undefined,
  warningResult: undefined as Promise<unknown> | undefined,
};

Object.assign(globalThis, { __uttoriDebugTest: host });

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "vscode") {
      return { shortCircuit: true, url: "debug-test:vscode" };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === "debug-test:vscode") {
      return {
        shortCircuit: true,
        format: "module",
        source: `
          const host = globalThis.__uttoriDebugTest;
          const uri = (file) => ({ scheme: "file", fsPath: file, toString: () => "file://" + file });
          export const StatusBarAlignment = { Left: 1, Right: 2 };
          export const ProgressLocation = { Notification: 15 };
          export const ViewColumn = { Beside: -2 };
          // ESM validates the named imports of the coverage-tree dependency at module load.
          export class ThemeIcon { constructor(id) { this.id = id; } }
          export class TreeItem { constructor(label) { this.label = label; } }
          export const TreeItemCollapsibleState = { None: 0, Collapsed: 1, Expanded: 2 };
          export class EventEmitter {
            listeners = new Set();
            event = (listener) => {
              this.listeners.add(listener);
              return { dispose: () => this.listeners.delete(listener) };
            };
            fire(value) { for (const listener of this.listeners) listener(value); }
            dispose() { this.listeners.clear(); }
          }
          export class DebugAdapterInlineImplementation {
            constructor(adapter) { this.adapter = adapter; }
          }
          export const Uri = { file: uri, parse: (value) => uri(value.replace(/^file:\\/\\//, "")) };
          export const workspace = {
            get isTrusted() { return host.trusted; },
            get workspaceFolders() { return host.folders; },
            getWorkspaceFolder: (resource) =>
              host.folders?.find((folder) => resource.fsPath.startsWith(folder.uri.fsPath)) ?? host.folders?.[0],
            getConfiguration: (section) => ({
              get: (key, fallback) => {
                if (section === "launch" && key === "configurations") {
                  return host.launchConfigurations;
                }
                return fallback;
              },
            }),
          };
          export const window = {
            showSaveDialog: async () => host.destination,
            withProgress: async (options, action) => {
              host.progress.push(options);
              return action({ report() {} });
            },
            showQuickPick: async (items) => host.quickPick === undefined ? undefined : host.quickPick ?? items[0],
            showOpenDialog: async () => host.dialogs.shift(),
            showInformationMessage: async (message) => { host.messages.push(message); },
            showErrorMessage: async (message) => { host.messages.push(message); },
            showWarningMessage: async (message) => { host.messages.push(message); return host.warningResult; },
            createOutputChannel: (name) => ({
              name,
              appendLine() {},
              show() {},
              dispose() {},
            }),
            createStatusBarItem: () => ({ command: undefined, text: "", tooltip: "", show() {}, dispose() {} }),
          };
          export const commands = {
            registerCommand: (id, callback) => {
              host.commands.set(id, callback);
              host.registered.push(id);
              return { dispose() { host.commands.delete(id); } };
            },
            executeCommand: async (id) => { host.executed.push(id); return host.commandResult; },
          };
          export const debug = {
            get activeDebugSession() { return host.activeSession; },
            registerDebugConfigurationProvider: (type, provider) => {
              host.configurationProvider = provider;
              host.providers.push("config:" + type);
              return { dispose() {} };
            },
            registerDebugAdapterDescriptorFactory: (type, factory) => {
              host.factory = factory;
              host.providers.push("adapter:" + type);
              return { dispose() {} };
            },
            onDidTerminateDebugSession: (listener) => {
              host.terminate = listener;
              return { dispose() { host.terminate = undefined; } };
            },
            onDidStartDebugSession: () => ({ dispose() {} }),
          };
        `,
      };
    }
    return nextLoad(url, context);
  },
});

const {
  UTTORI_ASM_DEBUG_TYPE,
  configuredEmulatorRuntime,
  liveDebugConfiguration,
  configureEmulatorRuntime,
  registerDebugging,
} = await import("../../src/debug/session.js");
const { runtimeCapturePhase, onDidChangeRuntimeCapture } =
  await import("../../src/runtime/capture-state.js");

const reset = (): void => {
  host.trusted = true;
  host.folders = undefined;
  host.launchConfigurations = [];
  host.dialogs = [];
  host.quickPick = undefined;
  host.messages = [];
  host.progress = [];
  host.activeSession = undefined;
  host.destination = undefined;
  host.executed = [];
  host.commands.clear();
  host.registered = [];
  host.providers = [];
  host.factory = undefined;
  host.configurationProvider = undefined;
  host.commandResult = undefined;
  host.terminate = undefined;
  host.warningResult = undefined;
};

const workspaceFolder = (file: string): WorkspaceFolder => {
  const value = { uri: uri(file), name: "workspace", index: 0 };
  if (!isWorkspaceFolder(value)) {
    throw new Error("workspace folder stub");
  }
  return value;
};

const uri = (file: string): VsCodeUri => {
  const value = { scheme: "file", fsPath: file, toString: () => `file://${file}` };
  if (!isUri(value)) {
    throw new Error("uri stub");
  }
  return value;
};

const context = (bindings: Record<string, unknown> = {}): ExtensionContext => {
  const store: Record<string, unknown> = { "uttoriAsm.emulatorRuntimeBindings.v1": bindings };
  const value = {
    subscriptions: [],
    globalState: {
      get: (key: string, fallback?: unknown) => (key in store ? store[key] : fallback),
      update: async (key: string, next: unknown) => {
        store[key] = next;
      },
    },
  };
  if (!isExtensionContext(value)) {
    throw new Error("extension context stub");
  }
  return value;
};

test.serial(
  "configuredEmulatorRuntime uses workspace bindings then a unique launch fallback",
  (t) => {
    reset();
    t.is(configuredEmulatorRuntime(context()), undefined);
    const folder = { uri: uri("/project"), name: "project" };
    if (!isWorkspaceFolder(folder)) {
      throw new Error("workspace folder stub");
    }
    host.folders = [folder];
    const saved = {
      backend: "ares" as const,
      runtimeManifest: "/runtime/manifest.json",
      emulator: "/runtime/ares",
      runtimeDirectory: "/runtime",
    };
    t.deepEqual(
      configuredEmulatorRuntime(context({ [folder.uri.toString()]: saved }), folder.uri),
      saved,
    );
    host.launchConfigurations = [
      {
        type: "uttori-asm",
        request: "launch",
        backend: "ares",
        runtimeManifest: "${workspaceFolder}/runtime/manifest.json",
        emulator: "runtime/bin/ares",
        runtimeDirectory: "runtime",
        fastBoot: false,
      },
    ];
    t.deepEqual(configuredEmulatorRuntime(context(), folder.uri), {
      backend: "ares",
      runtimeManifest: "/project/runtime/manifest.json",
      emulator: "/project/runtime/bin/ares",
      runtimeDirectory: "/project/runtime",
      fastBoot: false,
    });
    const configuredLaunch = host.launchConfigurations[0];
    if (!configuredLaunch || typeof configuredLaunch !== "object") {
      throw new Error("Missing launch fixture");
    }
    host.launchConfigurations = [
      {
        ...configuredLaunch,
        saveDirectory: "${workspaceFolder}/.uttori-local/saves",
      },
    ];
    t.deepEqual(
      configuredEmulatorRuntime(context({ [folder.uri.toString()]: saved }), folder.uri),
      {
        ...saved,
        saveDirectory: "/project/.uttori-local/saves",
      },
    );
  },
);

test.serial("liveDebugConfiguration names backends and resolves sourceRoot", (t) => {
  reset();
  const artifacts = { outputPath: "/build/game.sfc", debugMapPath: "/build/game.sfc.debug.json" };
  const ares = liveDebugConfiguration(
    {
      backend: "ares",
      runtimeManifest: "/manifest.json",
      emulator: "/ares",
      runtimeDirectory: "/runtime",
      aresSystem: "Super Famicom",
      fastBoot: true,
      saveDirectory: "/workspace/.uttori-local/saves",
    },
    artifacts,
    workspaceFolder("/workspace"),
  );
  t.is(ares.type, UTTORI_ASM_DEBUG_TYPE);
  t.is(ares.name, "Debug Uttori ASM (ares)");
  t.is(ares.sourceRoot, "/workspace");
  t.is(ares.aresSystem, "Super Famicom");
  t.true(ares.fastBoot);
  t.is(ares.saveDirectory, "/workspace/.uttori-local/saves");
  const plain = liveDebugConfiguration(
    {
      backend: "ares",
      runtimeManifest: "/manifest.json",
      emulator: "/ares",
      runtimeDirectory: "/runtime",
    },
    artifacts,
    undefined,
  );
  t.is(plain.name, "Debug Uttori ASM (ares)");
  t.is(plain.sourceRoot, "/build");
  t.false("aresSystem" in plain);
  t.false("fastBoot" in plain);
});

test.serial("debug launch rejects a valid ROM/map pair from a different selected build", (t) => {
  reset();
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-debug-identity-"));
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  const program = path.join(directory, "modified.sfc");
  const debugMap = `${program}.debug.json`;
  const bytes = new Uint8Array([0xea]);
  fs.writeFileSync(program, bytes);
  const map = createDebugMap({
    target: "snes.sfc",
    output: bytes,
    mapping: new AddressToLineMapping(),
  });
  fs.writeFileSync(debugMap, JSON.stringify(map));
  const subscriptions = registerDebugging("/extension");
  t.teardown(() => {
    for (const subscription of subscriptions) {
      subscription.dispose();
    }
  });
  for (const [field, expected] of [
    ["outputSha256", /ROM differs from the selected build/],
    ["debugMapFingerprint", /Debug map differs from the selected build/],
  ] as const) {
    const session = {
      id: "modified",
      name: "Modified ROM",
      configuration: { backend: "replay", program, debugMap, [field]: "0".repeat(64) },
    };
    if (!isDebugSession(session)) {
      throw new Error("debug session stub");
    }
    t.throws(() => host.factory!.createDebugAdapterDescriptor(session, undefined), {
      message: expected,
    });
  }
});

test.serial(
  "configureEmulatorRuntime validates trust, folder, cancellation and ares manifests",
  async (t) => {
    reset();
    host.trusted = false;
    await t.throwsAsync(configureEmulatorRuntime(context()), {
      message: /trusted workspace/,
    });
    host.trusted = true;
    await t.throwsAsync(configureEmulatorRuntime(context()), {
      message: /Open a workspace folder/,
    });
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-debug-runtime-"));
    t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
    const game = { uri: uri(directory), name: "game" };
    if (!isWorkspaceFolder(game)) {
      throw new Error("workspace folder stub");
    }
    host.folders = [game];
    host.quickPick = undefined;
    t.is(await configureEmulatorRuntime(context()), undefined);
    host.quickPick = { label: "ares", backend: "ares" };
    host.dialogs = [undefined];
    t.is(await configureEmulatorRuntime(context()), undefined);
    host.dialogs = [[{ scheme: "file", fsPath: path.join(directory, "missing.json") }], undefined];
    t.is(await configureEmulatorRuntime(context()), undefined);
    const manifestFile = path.join(directory, "manifest.json");
    fs.writeFileSync(manifestFile, JSON.stringify(aresManifest));
    host.dialogs = [[{ scheme: "untitled", fsPath: manifestFile }]];
    await t.throwsAsync(configureEmulatorRuntime(context()), {
      message: /local filesystem/,
    });
    const saved = context();
    host.launchConfigurations = [
      {
        type: "uttori-asm",
        request: "launch",
        backend: "ares",
        runtimeManifest: "/old/manifest.json",
        emulator: "/old/ares",
        runtimeDirectory: "/old",
        saveDirectory: "${workspaceFolder}/.uttori-local/saves",
      },
    ];
    host.dialogs = [
      [{ scheme: "file", fsPath: manifestFile }],
      [{ scheme: "file", fsPath: path.join(directory, "ares") }],
      [{ scheme: "file", fsPath: path.join(directory, "runtime") }],
    ];
    const binding = await configureEmulatorRuntime(saved, uri(directory));
    t.deepEqual(binding, {
      backend: "ares",
      runtimeManifest: manifestFile,
      emulator: path.join(directory, "ares"),
      runtimeDirectory: path.join(directory, "runtime"),
      saveDirectory: path.join(directory, ".uttori-local/saves"),
      aresSystem: "Super Famicom",
      fastBoot: true,
    });
    t.true(host.messages.some((message) => message.includes("ares runtime configured")));
  },
);

test.serial(
  "stop shows finalization progress while the recorder drains and imports only after completion",
  async (t) => {
    reset();
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-stop-progress-"));
    t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
    const program = path.join(directory, "rom.sfc");
    const debugMap = `${program}.debug.json`;
    const bytes = new Uint8Array([0xea]);
    fs.writeFileSync(program, bytes);
    const mapping = new AddressToLineMapping();
    mapping.includeByte(path.join(directory, "main.asm"), 1, "snes.65816", "snes.cpu", 0x8000, 0);
    fs.writeFileSync(
      debugMap,
      JSON.stringify(createDebugMap({ target: "snes.sfc", output: bytes, mapping })),
    );
    let release!: (summary: CaptureFileSummary) => void;
    const completion = new Promise<CaptureFileSummary>((resolve) => {
      release = resolve;
    });
    let stopRequested = false;
    const recorder = {
      completion,
      stop: () => {
        stopRequested = true;
        return completion;
      },
    };
    if (!isRecorder(recorder)) {
      throw new Error("recorder stub");
    }
    const stub = sinon.stub(LosslessCaptureFileRecorder, "create").resolves(recorder);
    t.teardown(() => stub.restore());
    const subscriptions = registerDebugging("/extension");
    t.teardown(() => subscriptions.forEach((subscription) => subscription.dispose()));
    const session = {
      id: "progress",
      type: "uttori-asm",
      configuration: { backend: "replay", program, debugMap },
      customRequest: async () => ({
        traces: [
          {
            architecture: "snes.65816",
            addressSpace: "snes.cpu",
            maxBufferedEvents: 65536,
            maxBatchEvents: 4096,
          },
        ],
      }),
    };
    if (!isDebugSession(session)) {
      throw new Error("debug session stub");
    }
    const descriptor = host.factory!.createDebugAdapterDescriptor(session, undefined);
    if (!isInlineAdapter(descriptor)) {
      throw new Error("expected an inline debug adapter");
    }
    const adapter = descriptor;
    t.teardown(() => adapter.adapter.dispose());
    host.activeSession = session;
    const phases: string[] = [];
    const changes = onDidChangeRuntimeCapture((phase) => phases.push(phase));
    t.teardown(() => changes.dispose());
    const waitFor = async (condition: () => boolean): Promise<void> => {
      for (let attempt = 0; attempt < 200 && !condition(); attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
      t.true(condition());
    };
    // A cancelled save picker must release setup so the visible Start action can be used again.
    host.commands.get("asm.trace.start")?.();
    t.is(runtimeCapturePhase(), "starting");
    await waitFor(() => runtimeCapturePhase() === "idle");
    t.is(stub.callCount, 0);
    host.destination = uri(path.join(directory, "capture.act2"));
    host.commands.get("asm.trace.start")?.();
    await waitFor(() => host.messages.some((message) => message.includes("recording lossless")));
    t.is(runtimeCapturePhase(), "recording");
    host.commands.get("asm.trace.start")?.();
    await waitFor(() =>
      host.messages.some((message) => message.includes("setup is already active")),
    );
    t.is(runtimeCapturePhase(), "recording");
    t.is(stub.callCount, 1);
    host.commands.get("asm.trace.stopAnalyze")?.();
    await waitFor(() => stopRequested);
    t.is(runtimeCapturePhase(), "finalizing");
    t.like(host.progress[0], {
      title: "Assembly: stopping recording and finalizing capture…",
      cancellable: false,
    });
    t.false(host.executed.includes("asm.source.importCapture"));
    const summary = {
      file: host.destination.fsPath,
      archive: host.destination.fsPath,
      observedEvents: 1000000,
      droppedEvents: 0,
      complete: true,
      chunks: 1,
    };
    if (!isCaptureSummary(summary)) {
      throw new Error("capture summary stub");
    }
    release(summary);
    await waitFor(() => host.executed.includes("asm.source.importCapture"));
    t.is(runtimeCapturePhase(), "idle");
    t.deepEqual(phases, ["starting", "idle", "starting", "recording", "finalizing", "idle"]);
    t.true(
      host.messages.some((message) => message.includes("1,000,000 instruction event(s) retained")),
    );
    // Losing the debugger finalizes the recording as incomplete. A still-visible warning must
    // not keep the next recording's controls disabled after that file is safely published.
    let publish!: (summary: CaptureFileSummary) => void;
    const terminatedCompletion = new Promise<CaptureFileSummary>((resolve) => {
      publish = resolve;
    });
    const terminatedRecorder = {
      completion: terminatedCompletion,
      stop: () => terminatedCompletion,
      finishIncomplete: () => terminatedCompletion,
    };
    if (!isRecorder(terminatedRecorder)) {
      throw new Error("terminated recorder stub");
    }
    stub.onSecondCall().resolves(terminatedRecorder);
    host.destination = uri(path.join(directory, "terminated.act2"));
    host.commands.get("asm.trace.start")?.();
    await waitFor(() => runtimeCapturePhase() === "recording");
    host.warningResult = new Promise(() => {});
    host.terminate?.(session);
    t.is(runtimeCapturePhase(), "finalizing");
    publish({ ...summary, file: host.destination.fsPath, complete: false });
    await waitFor(() =>
      host.messages.some((message) => message.includes("Preserved an incomplete")),
    );
    t.is(runtimeCapturePhase(), "idle");
  },
);

test.serial("registerDebugging exposes commands and cancels live analysis", (t) => {
  reset();
  const disposables = registerDebugging("/extension");
  t.true(disposables.length > 0);
  t.true(host.providers.includes(`config:${UTTORI_ASM_DEBUG_TYPE}`));
  t.true(host.providers.includes(`adapter:${UTTORI_ASM_DEBUG_TYPE}`));
  t.true(host.registered.includes("asm.trace.cancelLiveAnalysis"));
  host.commands.get("asm.trace.cancelLiveAnalysis")?.();
  for (const disposable of disposables) {
    disposable.dispose();
  }
});

test.serial(
  "F5 source launches consume one verified build and abort on failure or missing trust",
  async (t) => {
    reset();
    const subscriptions = registerDebugging("/extension");
    t.teardown(() => subscriptions.forEach((item) => item.dispose()));
    const resolve = host.configurationProvider!.resolveDebugConfiguration!.bind(
      host.configurationProvider,
    );
    const folder = { uri: uri("/project"), name: "project", index: 0 };
    const configuration = {
      type: "uttori-asm",
      name: "Source",
      request: "launch",
      sourceProject: true,
      program: "/stale.sfc",
    };
    host.commandResult = {
      outputFile: "/current.sfc",
      debugMapFile: "/current.map",
      debugMapFingerprint: "map",
      verification: { outputSha256: "rom" },
    };
    const result = await resolve(folder, configuration);
    t.is(result?.program, "/current.sfc");
    t.is(result?.debugMap, "/current.map");
    t.is(result?.outputSha256, "rom");
    t.deepEqual(
      host.executed.filter((command) => command !== "setContext"),
      ["asm.source.buildProject"],
    );
    host.commandResult = undefined;
    t.is(await resolve(folder, configuration), undefined);
    host.trusted = false;
    await t.throwsAsync(async () => resolve(folder, configuration), { message: /trust/ });
    host.trusted = true;
    await t.throwsAsync(async () => resolve(undefined, configuration), { message: /workspace/ });
  },
);

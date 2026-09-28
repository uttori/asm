import * as fs from "node:fs";
import { registerHooks } from "node:module";
import os from "node:os";
import path from "node:path";

import { AddressToLineMapping, createDebugMap } from "@uttori/asm-core";
import type { DebugAdapterDescriptorFactory, ExtensionContext, Uri as VsCodeUri } from "vscode";

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
  commands: new Map<string, (...args: unknown[]) => unknown>(),
  registered: [] as string[],
  providers: [] as string[],
  factory: undefined as DebugAdapterDescriptorFactory | undefined,
};

(globalThis as { __uttoriDebugTest?: typeof host }).__uttoriDebugTest = host;

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
          // ESM validates the named imports of the coverage-tree dependency at module load.
          export class ThemeIcon { constructor(id) { this.id = id; } }
          export class TreeItem { constructor(label) { this.label = label; } }
          export const TreeItemCollapsibleState = { None: 0, Collapsed: 1, Expanded: 2 };
          export class EventEmitter {
            event = () => ({ dispose() {} });
            fire() {}
            dispose() {}
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
            showQuickPick: async (items) => host.quickPick === undefined ? undefined : host.quickPick ?? items[0],
            showOpenDialog: async () => host.dialogs.shift(),
            showInformationMessage: async (message) => { host.messages.push(message); },
            showErrorMessage: async (message) => { host.messages.push(message); },
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
            executeCommand: async () => {},
          };
          export const debug = {
            registerDebugConfigurationProvider: (type) => {
              host.providers.push("config:" + type);
              return { dispose() {} };
            },
            registerDebugAdapterDescriptorFactory: (type, factory) => {
              host.factory = factory;
              host.providers.push("adapter:" + type);
              return { dispose() {} };
            },
            onDidTerminateDebugSession: () => ({ dispose() {} }),
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

const reset = (): void => {
  host.trusted = true;
  host.folders = undefined;
  host.launchConfigurations = [];
  host.dialogs = [];
  host.quickPick = undefined;
  host.messages = [];
  host.commands.clear();
  host.registered = [];
  host.providers = [];
  host.factory = undefined;
};

const uri = (file: string): VsCodeUri =>
  ({ scheme: "file", fsPath: file, toString: () => `file://${file}` }) as VsCodeUri;

const context = (bindings: Record<string, unknown> = {}): ExtensionContext => {
  const store = { "uttoriAsm.emulatorRuntimeBindings.v1": bindings };
  return {
    subscriptions: [],
    globalState: {
      get: (key: string, fallback?: unknown) =>
        key in store ? store[key as keyof typeof store] : fallback,
      update: async (key: string, value: unknown) => {
        (store as Record<string, unknown>)[key] = value;
      },
    },
  } as never;
};

test.serial(
  "configuredEmulatorRuntime uses workspace bindings then a unique launch fallback",
  (t) => {
    reset();
    t.is(configuredEmulatorRuntime(context()), undefined);
    const folder = { uri: uri("/project"), name: "project" };
    host.folders = [folder as never];
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
    },
    artifacts,
    { uri: uri("/workspace"), name: "workspace" } as never,
  );
  t.is(ares.type, UTTORI_ASM_DEBUG_TYPE);
  t.is(ares.name, "Debug Uttori ASM (ares)");
  t.is(ares.sourceRoot, "/workspace");
  t.is(ares.aresSystem, "Super Famicom");
  t.true(ares.fastBoot);
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
    t.throws(() => host.factory!.createDebugAdapterDescriptor(session as never, undefined), {
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
    host.folders = [{ uri: uri(directory), name: "game" } as never];
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
      aresSystem: "Super Famicom",
      fastBoot: true,
    });
    t.true(host.messages.some((message) => message.includes("ares runtime configured")));
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

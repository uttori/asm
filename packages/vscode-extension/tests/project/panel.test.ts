import * as fs from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import vm from "node:vm";

import { test } from "../../../../tests/ava-helper.js";

const host = {
  execute: async () => {},
  calls: [] as string[],
  config: {} as Record<string, unknown>,
  name: "Example",
  trusted: true,
  folders: undefined as { uri: { fsPath: string } }[] | undefined,
  picked: undefined as { fsPath: string }[] | undefined,
  documents: [] as string[],
};

(globalThis as { __uttoriPanelTest?: typeof host }).__uttoriPanelTest = host;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "vscode") {
      return { shortCircuit: true, url: "panel-test:vscode" };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === "panel-test:vscode") {
      return {
        shortCircuit: true,
        format: "module",
        source: `
          import path from "node:path";
          const host = globalThis.__uttoriPanelTest;
          const uri = (file) => ({ fsPath: file, toString: () => "file://" + file });
          export const ConfigurationTarget = { Workspace: 2 };
          export const Uri = {
            file: uri,
            joinPath: (root, ...parts) => uri(path.join(root.fsPath, ...parts)),
          };
          export const workspace = {
            get name() { return host.name; },
            get isTrusted() { return host.trusted; },
            get workspaceFolders() { return host.folders; },
            getConfiguration: () => ({
              get: (key, fallback) => (key in host.config ? host.config[key] : fallback),
              update: async (key, value) => {
                host.config[key] = value;
              },
            }),
          };
          export const window = {
            showTextDocument: async (file) => {
              host.documents.push(file.fsPath);
            },
            showOpenDialog: async () => host.picked,
          };
          export const commands = {
            executeCommand: async (command) => {
              host.calls.push(command);
              await host.execute();
            },
          };
        `,
      };
    }
    return nextLoad(url, context);
  },
});

const { ProjectPanelProvider } = await import("../../src/project/panel.js");
const { DisassemblyPanelProvider } = await import("../../src/disassembly/panel.js");
const extensionRoot = path.resolve("packages/vscode-extension");
const uri = (file: string) => ({ fsPath: file, toString: () => `file://${file}` });

const harness = (options?: {
  disassembly?: boolean;
  getClient?: () => { sendRequest: (method: string) => Promise<unknown> } | undefined;
  initConfig?: () => Promise<void>;
}) => {
  host.execute = async () => {};
  host.calls = [];
  host.config = {};
  host.name = "Example";
  host.trusted = true;
  host.folders = undefined;
  host.picked = undefined;
  host.documents = [];
  const sent: Array<{
    type: string;
    command?: string;
    error?: string;
    trusted?: boolean;
    indexReady?: boolean;
    status?: { fileCount?: number; configFile?: string };
  }> = [];
  let visible = true;
  let onVisibility = () => {};
  let receive = (_message: { type?: string; value?: unknown }) => {};
  const provider = options?.disassembly
    ? new DisassemblyPanelProvider(uri(extensionRoot) as never)
    : new ProjectPanelProvider(
        uri(extensionRoot) as never,
        () => options?.getClient?.() as never,
        options?.initConfig ?? (async () => {}),
      );
  const webview = {
    html: "",
    options: {},
    cspSource: "https://webview.example",
    asWebviewUri: (value: { toString?: () => string }) => value,
    onDidReceiveMessage(callback: (message: { type?: string; value?: unknown }) => void) {
      receive = callback;
    },
    postMessage: async (message: (typeof sent)[number]) => {
      sent.push(message);
    },
  };
  provider.resolveWebviewView({
    get visible() {
      return visible;
    },
    webview,
    onDidChangeVisibility(callback: () => void) {
      onVisibility = callback;
    },
  } as never);
  return {
    provider,
    sent,
    webview,
    setExecute: (execute: () => Promise<void>) => {
      host.execute = execute;
    },
    setVisible: (value: boolean) => {
      visible = value;
      onVisibility();
    },
    receive: (message: { type?: string; value?: unknown }) => receive(message),
  };
};

test.serial(
  "Disassembly loads external CSP-scoped assets and routes disassembly, heuristics and capture actions",
  async (t) => {
    const h = harness({ disassembly: true });
    h.receive({ type: "ready" });
    const routes = {
      editAnnotation: "asm.disassembly.editAnnotation",
      regenerateDisassembly: "asm.disassembly.regenerate",
      configureHeuristics: "asm.heuristics.configure",
      previewHeuristics: "asm.heuristics.preview",
      startExecutionCapture: "asm.trace.start",
      stopExecutionCapture: "asm.trace.stopAnalyze",
      disassemblyStatus: "asm.disassembly.status",
      openRamMap: "asm.ramMap.open",
      importRuntimeTrace: "asm.trace.importRegenerate",
    };
    for (const [type, command] of Object.entries(routes)) {
      await h.provider.onMessage({ type });
      t.is(host.calls.at(-1), command);
      t.true(
        h.sent.some((message) => message.type === "actionComplete" && message.command === type),
      );
    }
    t.regex(h.webview.html, /script nonce="[^"]+" src="[^"]+disassembly.js"/);
    t.regex(h.webview.html, /href="[^"]+disassembly.css"/);
    t.false(h.webview.html.includes("{{"));
    t.true(h.sent.some((message) => message.type === "snapshot" && message.trusted));
    const js = fs.readFileSync("packages/vscode-extension/media/disassembly.js", "utf8");
    t.notThrows(() => new vm.Script(js));
    t.false(js.includes("innerHTML"), "action status is rendered as text");
    t.false(h.webview.html.includes('id="settingsSection"'));
    host.trusted = false;
    h.setVisible(false);
    h.setVisible(true);
    t.is(h.sent.at(-1)?.trusted, false);
    const idle = new DisassemblyPanelProvider(uri(extensionRoot) as never);
    t.notThrows(() => idle.refresh());
  },
);

test.serial(
  "Disassembly prevents duplicate pending actions and returns actionable errors to the panel",
  async (t) => {
    const h = harness({ disassembly: true });
    let finish: () => void = () => {};
    h.setExecute(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const pending = h.provider.onMessage({ type: "previewHeuristics" });
    await h.provider.onMessage({ type: "previewHeuristics" });
    t.is(host.calls.length, 1);
    finish();
    await pending;
    h.setExecute(async () => {
      throw new Error("Save the rules before running.");
    });
    await h.provider.onMessage({ type: "previewHeuristics" });
    t.is(h.sent.at(-1)?.error, "Save the rules before running.");
    t.is(host.calls.length, 2, "a completed or failed action can be retried");
    h.setExecute(async () => {
      // oxlint-disable-next-line typescript/only-throw-error
      throw "offline";
    });
    await h.provider.onMessage({ type: "previewHeuristics" });
    t.is(h.sent.at(-1)?.error, "offline");
    await h.provider.onMessage({} as { type?: string });
    await h.provider.onMessage({ type: "noop" });
    t.is(host.calls.length, 3);
  },
);

test.serial(
  "Project snapshots, settings and path edits round-trip through workspace state",
  async (t) => {
    let configured = 0;
    const h = harness({
      initConfig: async () => {
        configured += 1;
      },
      getClient: () => ({
        sendRequest: async (method: string) => {
          if (method === "asm/status") {
            return {
              fileCount: 4,
              symbolCount: 8,
              referenceCount: 2,
              errorCount: 1,
              lastReindexRootCount: 1,
              lastReindexCachedRoots: 0,
              lastReindexAnalyzedRoots: 1,
              configFile: "asm.json",
            };
          }
          return {
            activeTarget: "snes.sfc",
            activeArchitecture: "snes.65816",
            targets: [
              {
                id: "snes.sfc",
                defaultArchitecture: "snes.65816",
                defaultOutputExtension: "sfc",
              },
              { id: "snes.smc", defaultOutputExtension: ".smc" },
            ],
            architectures: [],
          };
        },
      }),
    });
    t.regex(h.webview.html, /script nonce="[^"]+" src="[^"]+panel.js"/);
    t.regex(h.webview.html, /href="[^"]+panel.css"/);
    t.false(h.webview.html.includes("{{"));
    t.false(h.webview.html.includes('data-cmd="regenerateDisassembly"'));
    const js = fs.readFileSync("packages/vscode-extension/media/panel.js", "utf8");
    t.notThrows(() => new vm.Script(js));
    t.false(js.includes("innerHTML"), "project names, paths and status are rendered as text");
    await h.provider.refresh();
    t.true(
      h.sent.some(
        (message) =>
          message.type === "snapshot" && message.indexReady && message.status?.fileCount === 4,
      ),
    );
    await h.provider.onMessage({ type: "openConfig" });
    t.deepEqual(host.documents, []);
    host.folders = [{ uri: { fsPath: "/project" } }];
    host.config.buildOutput = "game.smc";
    await h.provider.onMessage({ type: "setTarget", value: "snes.sfc" });
    t.is(host.config.target, "snes.sfc");
    t.is(host.config.architecture, "snes.65816");
    t.is(host.config.buildOutput, "game.sfc");
    await h.provider.onMessage({ type: "setTarget", value: "snes.smc" });
    t.is(host.config.buildOutput, "game.smc");
    await h.provider.onMessage({ type: "setTarget", value: "snes.smc" });
    host.config.buildOutput = "";
    await h.provider.onMessage({ type: "setTarget", value: "unknown" });
    t.is(host.config.target, "unknown");
    t.is(host.config.buildOutput, "");
    await h.provider.onMessage({ type: "setArchitecture", value: "snes.spc700" });
    await h.provider.onMessage({ type: "setBuildOutput", value: "out.sfc" });
    t.is(host.config.architecture, "snes.spc700");
    t.is(host.config.buildOutput, "out.sfc");
    host.picked = [{ fsPath: "/project/src/main.asm" }, { fsPath: "/other/lib" }];
    await h.provider.onMessage({ type: "addEntryPoint" });
    t.deepEqual(host.config.entryPoints, ["src/main.asm", "/other/lib"]);
    host.picked = [{ fsPath: "/project/src/main.asm" }];
    await h.provider.onMessage({ type: "addEntryPoint" });
    t.deepEqual(host.config.entryPoints, ["src/main.asm", "/other/lib"]);
    await h.provider.onMessage({ type: "removeEntryPoint", value: "src/main.asm" });
    t.deepEqual(host.config.entryPoints, ["/other/lib"]);
    host.picked = [{ fsPath: "/project/include" }];
    await h.provider.onMessage({ type: "addIncludePath" });
    t.deepEqual(host.config.includePaths, ["include"]);
    await h.provider.onMessage({ type: "removeIncludePath", value: "include" });
    t.deepEqual(host.config.includePaths, []);
    host.picked = undefined;
    await h.provider.onMessage({ type: "addIncludePath" });
    t.deepEqual(host.config.includePaths, []);
    host.folders = undefined;
    host.picked = [{ fsPath: "/abs/boot.asm" }];
    await h.provider.onMessage({ type: "addEntryPoint" });
    t.deepEqual(host.config.entryPoints, ["/other/lib", "/abs/boot.asm"]);
    await h.provider.onMessage({ type: "initConfig" });
    t.is(configured, 1);
    host.folders = [{ uri: { fsPath: "/project" } }];
    await h.provider.onMessage({ type: "openConfig" });
    t.deepEqual(host.documents, [path.resolve("/project", "asm.json")]);
    await h.provider.onMessage({ type: "ready" });
    h.setVisible(false);
    const beforeHidden = h.sent.filter((message) => message.type === "snapshot").length;
    h.setVisible(true);
    await h.provider.refresh();
    t.true(h.sent.filter((message) => message.type === "snapshot").length > beforeHidden);
    const offline = harness({
      getClient: () => ({
        sendRequest: async () => {
          throw new Error("language server offline");
        },
      }),
    });
    await offline.provider.refresh();
    t.true(
      offline.sent.some((message) => message.type === "snapshot" && message.indexReady === false),
    );
    const idle = new ProjectPanelProvider(
      uri(extensionRoot) as never,
      () => undefined,
      async () => {},
    );
    await idle.refresh();
    await idle.onMessage({ type: "removeEntryPoint", value: 1 });
  },
);

import * as fs from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import vm from "node:vm";

import type { Uri, WebviewView } from "vscode";
import type { LanguageClient } from "vscode-languageclient/node";

import { test } from "../../../../tests/ava-helper.js";

function isUri(value: object): value is Uri {
  return (
    "fsPath" in value &&
    typeof value.fsPath === "string" &&
    "toString" in value &&
    typeof value.toString === "function"
  );
}

function isWebviewView(value: object): value is WebviewView {
  return (
    "visible" in value &&
    typeof value.visible === "boolean" &&
    "webview" in value &&
    typeof value.webview === "object" &&
    value.webview !== null &&
    "onDidChangeVisibility" in value &&
    typeof value.onDidChangeVisibility === "function"
  );
}

function isLanguageClient(value: object): value is LanguageClient {
  return "sendRequest" in value && typeof value.sendRequest === "function";
}

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

Object.assign(globalThis, { __uttoriPanelTest: host });

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
          export class EventEmitter { event = () => {}; fire() {} dispose() {} }
          export class ThemeIcon { constructor(id) { this.id = id; } }
          export class TreeItem { constructor(label, collapsibleState) { this.label = label; this.collapsibleState = collapsibleState; } }
          export const TreeItemCollapsibleState = { None: 0 };
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

const { IndexDetailsProvider } = await import("../../src/project/index-tree.js");
const { ProjectPanelProvider } = await import("../../src/project/panel.js");
const extensionRoot = path.resolve("packages/vscode-extension");
const uri = (file: string) => ({ fsPath: file, toString: () => `file://${file}` });
const ignoreVisibility = (): void => {};
const ignorePanelMessage = (_message: { type?: string; value?: unknown }): void => {};

const harness = (options?: {
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
  let onVisibility = ignoreVisibility;
  let receive = ignorePanelMessage;
  const extensionUri = uri(extensionRoot);
  if (!isUri(extensionUri)) {
    throw new Error("extension uri stub");
  }
  const provider = new ProjectPanelProvider(
    extensionUri,
    () => {
      const client = options?.getClient?.();
      if (!client) {
        return undefined;
      }
      if (!isLanguageClient(client)) {
        throw new Error("language client stub");
      }
      return client;
    },
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
  const view = {
    get visible() {
      return visible;
    },
    webview,
    onDidChangeVisibility(callback: () => void) {
      onVisibility = callback;
    },
  };
  if (!isWebviewView(view)) {
    throw new Error("webview view stub");
  }
  provider.resolveWebviewView(view);
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
    const index = new IndexDetailsProvider(() => h.provider.snapshot());
    t.teardown(() => index.dispose());
    const rows = await index.getChildren();
    const errors = rows.find(({ label }) => label === "Errors")!;
    t.is(index.getTreeItem(errors).description, "1");
    t.is(index.getTreeItem(errors).command?.command, "workbench.actions.view.problems");
    t.false(rows.some(({ label }) => label === "Target" || label === "Config"));
    t.false(h.webview.html.includes("Index Details"));
    t.false(h.webview.html.includes("project-header"));
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
    const idleUri = uri(extensionRoot);
    if (!isUri(idleUri)) {
      throw new Error("extension uri stub");
    }
    const idle = new ProjectPanelProvider(
      idleUri,
      () => undefined,
      async () => {},
    );
    await idle.refresh();
    await idle.onMessage({ type: "removeEntryPoint", value: 1 });
  },
);

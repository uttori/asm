import * as fs from "node:fs";
import { registerHooks } from "node:module";
import os from "node:os";
import path from "node:path";

import type { ExtensionContext } from "vscode";

function isExtensionContext(value: object): value is ExtensionContext {
  return (
    "subscriptions" in value &&
    Array.isArray(value.subscriptions) &&
    "extensionPath" in value &&
    typeof value.extensionPath === "string" &&
    "extensionUri" in value &&
    typeof value.extensionUri === "object" &&
    value.extensionUri !== null &&
    "extensionMode" in value &&
    typeof value.extensionMode === "number" &&
    "asAbsolutePath" in value &&
    typeof value.asAbsolutePath === "function" &&
    "workspaceState" in value &&
    typeof value.workspaceState === "object" &&
    "globalState" in value &&
    typeof value.globalState === "object"
  );
}

import { test } from "../../../tests/ava-helper.js";

const host = {
  trusted: true,
  folders: undefined as
    | { uri: { scheme: string; fsPath: string; toString(): string } }[]
    | undefined,
  config: {} as Record<string, unknown>,
  commands: new Map<string, (...args: unknown[]) => unknown>(),
  executed: [] as unknown[][],
  errors: [] as string[],
  infos: [] as string[],
  output: [] as { channel: string; level: string; message: string }[],
  shownOutput: [] as string[],
  stopped: 0,
  failNextStart: false,
  foldersChanged: undefined as (() => void) | undefined,
  clients: [] as {
    start: () => Promise<void>;
    stop: () => Promise<void>;
    stops: number;
    server: Record<"run" | "debug", { options: { env: NodeJS.ProcessEnv } }>;
    options: { initializationOptions: { owningRoot?: string } };
  }[],
};

Object.assign(globalThis, { __uttoriExtensionTest: host });

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "vscode") {
      return { shortCircuit: true, url: "extension-test:vscode" };
    }
    if (specifier === "vscode-languageclient/node") {
      return { shortCircuit: true, url: "extension-test:language-client" };
    }
    if (specifier === "vscode-languageclient") {
      return { shortCircuit: true, url: "extension-test:language-client-common" };
    }
    if (
      specifier === "./analysis/worker-client.js" &&
      typeof context.parentURL === "string" &&
      /[/\\]extension\.(ts|js|mts|mjs)/.test(context.parentURL)
    ) {
      return { shortCircuit: true, url: "extension-test:analysis-worker-client" };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === "extension-test:vscode") {
      return {
        shortCircuit: true,
        format: "module",
        source: `
          const host = globalThis.__uttoriExtensionTest;
          const uri = (file) => ({
            scheme: "file",
            fsPath: file,
            toString: () => "file://" + file,
          });
          const disposable = () => ({ dispose() {} });
          export const ConfigurationTarget = { Global: 1, Workspace: 2, WorkspaceFolder: 3 };
          export const ExtensionMode = { Production: 1, Development: 2, Test: 3 };
          export const StatusBarAlignment = { Left: 1, Right: 2 };
          export const ProgressLocation = { Notification: 15 };
          export const TreeItemCollapsibleState = { None: 0, Collapsed: 1, Expanded: 2 };
          export const DecorationRangeBehavior = { ClosedClosed: 1 };
          export const TextEditorRevealType = { Default: 0 };
          export const ViewColumn = { Beside: 2 };
          export class EventEmitter {
            event = () => disposable();
            fire() {}
            dispose() {}
          }
          export class ThemeIcon { constructor(id) { this.id = id; } }
          export class ThemeColor { constructor(id) { this.id = id; } }
          export class TreeItem {
            constructor(label, collapsibleState) {
              this.label = label;
              this.collapsibleState = collapsibleState;
            }
          }
          export class Range {
            constructor(a, b, c, d) {
              this.start = typeof a === "object" ? a : { line: a, character: b };
              this.end = typeof c === "object" || c === undefined ? c : { line: c, character: d };
            }
          }
          export class Position { constructor(line, character) { this.line = line; this.character = character; } }
          export class Selection extends Range {}
          export class WorkspaceEdit { replace() {} }
          export class CustomExecution { constructor(callback) { this.callback = callback; } }
          export class Diagnostic { constructor(range, message, severity) { Object.assign(this, { range, message, severity }); } }
          export const DiagnosticSeverity = { Error: 0, Warning: 1 };
          export class TabInputCustom {}
          export class Task {}
          export const TaskGroup = { Build: 1 };
          export const TaskScope = { Global: 1, Workspace: 2 };
          export const tasks = { registerTaskProvider: () => disposable() };
          export const FileType = { File: 1, Directory: 2 };
          export class FileSystemError extends Error { static NoPermissions(message) { return new this(message); } }

          export class RelativePattern {
            constructor(base, pattern) { this.base = base; this.pattern = pattern; }
          }
          export class CodeAction {
            constructor(title, kind) { this.title = title; this.kind = kind; }
          }
          export const CodeActionKind = { RefactorRewrite: "refactor.rewrite" };
          export const env = { openExternal: async () => true };
          export const languages = {
            createDiagnosticCollection: () => ({ clear() {}, set() {}, dispose() {} }),
            registerCodeActionsProvider: () => disposable(),
            registerHoverProvider: () => disposable(),
          };
          export class Hover { constructor(contents, range) { this.contents = contents; this.range = range; } }
          export class MarkdownString {
            appendMarkdown() { return this; }
            appendText() { return this; }
            appendCodeblock() { return this; }
          }
          export class DebugAdapterInlineImplementation { constructor(adapter) { this.adapter = adapter; } }
          export class CancellationError extends Error {
            constructor(message) { super(message ?? "Canceled"); this.name = "Canceled"; }
          }
          export class Disposable { constructor(callOnDispose) { this.dispose = callOnDispose ?? (() => {}); } }
          export const Uri = {
            file: uri,
            parse: (value) => uri(String(value).replace(/^file:\\/\\//, "")),
            joinPath: (root, ...parts) => uri([root.fsPath, ...parts].join("/")),
          };
          const watcher = () => ({
            onDidCreate: () => disposable(),
            onDidChange: () => disposable(),
            onDidDelete: () => disposable(),
            dispose() {},
          });
          export const workspace = {
            get isTrusted() { return host.trusted; },
            get workspaceFolders() { return host.folders; },
            getWorkspaceFolder: () => host.folders?.[0],
            getConfiguration: () => ({
              get: (key, fallback) => (key in host.config ? host.config[key] : fallback),
              update: async (key, value) => { host.config[key] = value; },
              inspect: (key) => ({ globalValue: host.config[key] }),
            }),
            createFileSystemWatcher: () => watcher(),
            registerFileSystemProvider: () => disposable(),
            findFiles: async () => [],
            onDidChangeConfiguration: () => disposable(),
            onDidChangeWorkspaceFolders: (callback) => {host.foldersChanged=callback;return {dispose(){host.foldersChanged=undefined;}};},
            onDidChangeTextDocument: () => disposable(),
            onDidSaveTextDocument: () => disposable(),
            onDidCloseTextDocument: () => disposable(),
            textDocuments: [],
            onDidGrantWorkspaceTrust: () => disposable(),
            fs: {
              stat: async () => { throw Object.assign(new Error("missing"), { code: "FileNotFound" }); },
              writeFile: async () => {},
            },
          };
          export const window = {
            activeTextEditor: undefined,
            visibleTextEditors: [],
            createOutputChannel: (name) => ({
              name,
              info(message) { host.output.push({ channel: name, level: "info", message }); },
              error(message) { host.output.push({ channel: name, level: "error", message }); },
              warn() {},
              debug() {},
              trace() {},
              appendLine() {},
              append() {},
              show() { host.shownOutput.push(name); },
              hide() {},
              clear() {},
              dispose() {},
            }),
            createStatusBarItem: () => ({
              command: undefined,
              text: "",
              tooltip: "",
              show() {},
              hide() {},
              dispose() {},
            }),
            createTreeView: () => disposable(),
            registerTreeDataProvider: () => disposable(),
            registerCustomEditorProvider: () => disposable(),
            tabGroups: { all: [], onDidChangeTabs: () => disposable() },
            registerWebviewViewProvider: () => disposable(),
            createTextEditorDecorationType: () => disposable(),
            onDidChangeActiveTextEditor: () => disposable(),
            onDidChangeTextEditorSelection: () => disposable(),
            onDidChangeTextEditorVisibleRanges: () => disposable(),
            onDidChangeTextEditorOptions: () => disposable(),
            showErrorMessage: async (message) => { host.errors.push(message); },
            showInformationMessage: async (message) => { host.infos.push(message); },
            showWarningMessage: async (message) => { host.errors.push(message); },
            showQuickPick: async () => undefined,
            showOpenDialog: async () => undefined,
            showTextDocument: async () => {},
            setStatusBarMessage: () => disposable(),
          };
          export const commands = {
            registerCommand: (id, callback) => {
              host.commands.set(id, callback);
              return { dispose() { host.commands.delete(id); } };
            },
            executeCommand: async (...args) => { host.executed.push(args); },
          };
          export const debug = {
            activeDebugSession: undefined,
            onDidStartDebugSession: () => disposable(),
            onDidTerminateDebugSession: () => disposable(),
            registerDebugConfigurationProvider: () => disposable(),
            registerDebugAdapterDescriptorFactory: () => disposable(),
            startDebugging: async () => false,
            stopDebugging: async () => {},
          };
        `,
      };
    }
    if (url === "extension-test:language-client-common") {
      return {
        shortCircuit: true,
        format: "module",
        source: `
          export const SymbolKind = {
            File: 1, Module: 2, Namespace: 3, Package: 4, Class: 5, Method: 6,
            Property: 7, Field: 8, Constructor: 9, Enum: 10, Interface: 11,
            Function: 12, Variable: 13, Constant: 14, String: 15, Number: 16,
            Boolean: 17, Array: 18, Object: 19, Key: 20, Null: 21, EnumMember: 22,
            Struct: 23, Event: 24, Operator: 25, TypeParameter: 26,
          };
        `,
      };
    }
    if (url === "extension-test:language-client") {
      return {
        shortCircuit: true,
        format: "module",
        source: `
          const host = globalThis.__uttoriExtensionTest;
          export class LanguageClient {
            constructor(id,name,server,options) {
              this.options=options;this.server=server;this.stops=0;host.clients.push(this);
            }
            start() { if(host.failNextStart){host.failNextStart=false;return Promise.reject(new Error("Fixture startup failure"));} return Promise.resolve(); }
            stop() {
              host.stopped += 1;this.stops++;
              return Promise.resolve();
            }
            onNotification() { return { dispose() {} }; }
            onRequest() { return { dispose() {} }; }
            setTrace() {}
            sendRequest() { return Promise.resolve(); }
            sendNotification() { return Promise.resolve(); }
          }
          export const TransportKind = { stdio: 0 };
          export const Trace = { Off: 0, Messages: 1, Verbose: 2 };
          export const State = { Stopped: 1, Starting: 2, Running: 3 };
          export const ExecuteCommandRequest = { type: "workspace/executeCommand" };
        `,
      };
    }
    if (url === "extension-test:analysis-worker-client") {
      return {
        shortCircuit: true,
        format: "module",
        source: `
          export const initializeAnalysisWorker = () => ({
            invalidate() {},
            dispose() {},
          });
          export const analysisWorker = () => {
            throw new Error("Analysis worker has not been initialized.");
          };
        `,
      };
    }
    return nextLoad(url, context);
  },
});

const { activate, deactivate } = await import("../src/extension.js");

const uri = (file: string) => ({
  scheme: "file",
  fsPath: file,
  toString: () => `file://${file}`,
});

test.serial("startup discovery cannot replace an explicit project selection", async (t) => {
  const { SourceController } = await import("../src/source/controller.js");
  const { window } = await import("vscode");
  const { spriteSourceFixture } = await import("../../../tests/fixtures/sprite-source.js");
  const startup = await spriteSourceFixture(t.teardown);
  const explicit = await spriteSourceFixture(t.teardown);
  const extensionPath = path.resolve("packages/vscode-extension");
  const context = {
    subscriptions: [] as { dispose(): void }[],
    extensionPath,
    extensionUri: uri(extensionPath),
    extensionMode: 1,
    asAbsolutePath: (value: string) => path.join(extensionPath, value),
    workspaceState: { get: (_key: string, fallback?: unknown) => fallback, update: async () => {} },
    globalState: { get: (_key: string, fallback?: unknown) => fallback, update: async () => {} },
  };
  if (!isExtensionContext(context)) {
    throw new Error("extension context stub");
  }
  const selections: (string | undefined)[] = [];
  class ObservedController extends SourceController {
    override async select(root?: string): Promise<void> {
      selections.push(root);
      await super.select(root);
    }
  }
  const discovery = Promise.withResolvers<void>();
  const discoveryStarted = Promise.withResolvers<void>();
  const originalAccess = fs.promises.access;
  // Pause only automatic discovery; the explicit request must finish first without relying on timing.
  fs.promises.access = new Proxy(originalAccess, {
    async apply(target, thisArg, args: Parameters<typeof originalAccess>) {
      const result = await Reflect.apply(target, thisArg, args);
      if (args[0] === path.join(startup.directory, ".uttori/project.json")) {
        discoveryStarted.resolve();
        await discovery.promise;
      }
      return result;
    },
  });
  host.folders = [{ uri: uri(startup.directory) }];
  const controller = new ObservedController(
    context,
    window.createOutputChannel("Startup test", { log: true }),
  );
  t.teardown(() => {
    discovery.resolve();
    fs.promises.access = originalAccess;
    controller.dispose();
    host.folders = undefined;
    for (const subscription of context.subscriptions) {
      subscription.dispose();
    }
  });
  await discoveryStarted.promise;
  await controller.select(explicit.directory);
  discovery.resolve();
  // Drain the completed filesystem probe and restore continuation before inspecting selection ownership.
  await new Promise((resolve) => setImmediate(resolve));
  t.deepEqual(selections, [explicit.directory]);
  t.is(controller.root, explicit.directory);
});

test.serial(
  "activate registers commands, toggleWatch without a file errors, deactivate stops the client",
  async (t) => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-extension-"));
    t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
    host.trusted = true;
    host.folders = undefined;
    host.config = {};
    host.commands.clear();
    host.executed = [];
    host.errors = [];
    host.infos = [];
    host.output = [];
    host.shownOutput = [];
    host.stopped = 0;
    host.clients = [];
    const context = {
      subscriptions: [] as { dispose(): void }[],
      extensionPath: directory,
      extensionUri: uri(directory),
      extensionMode: 1,
      asAbsolutePath: (value: string) => path.join(directory, value),
      workspaceState: {
        get: (_key: string, fallback?: unknown) => fallback,
        update: async () => {},
      },
      globalState: {
        get: (_key: string, fallback?: unknown) => fallback,
        update: async () => {},
      },
    };
    if (!isExtensionContext(context)) {
      throw new Error("extension context stub");
    }
    activate(context);
    t.true(
      host.output.some(({ channel, level }) => channel === "Uttori Analysis" && level === "info"),
    );
    t.true(host.commands.has("asm.build"));
    t.true(host.commands.has("asm.toggleWatch"));
    t.true(host.commands.has("asm.openPanel"));
    t.true(host.commands.has("asm.outline.refresh"));
    await host.commands.get("asm.source.select")?.(directory);
    t.true(
      host.output.some(({ channel, level }) => channel === "Uttori Analysis" && level === "error"),
    );
    t.true(host.shownOutput.includes("Uttori Analysis"));
    await host.commands.get("asm.outline.refresh")?.();
    await host.commands.get("asm.openPanel")?.();
    t.true(host.executed.some((args) => args[0] === "uttori-asm.home.focus"));
    await host.commands.get("asm.toggleWatch")?.();
    t.true(
      host.errors.some((message) =>
        message.includes("open a source file (or set asm.entryPoints) before watching"),
      ),
    );
    await host.commands.get("asm.coverage.refresh")?.();
    await host.commands.get("asm.sources.refresh")?.();
    await host.commands.get("asm.analysis.toggleAnnotations")?.();
    t.is(host.config["editorInfo.inline.enabled"], false);
    await deactivate();
    t.is(host.stopped, 1);
    t.true(host.clients.length >= 1);
  },
);

test.serial(
  "workspace clients own independent roots and retry failed startup after removal/reopen",
  async (t) => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-extension-roots-"));
    const first = { uri: uri(path.join(directory, "snes")) },
      second = { uri: uri(path.join(directory, "nes")) };
    host.folders = [first, second];
    host.trusted = true;
    host.clients = [];
    host.stopped = 0;
    host.config = {};
    const context = {
      subscriptions: [] as { dispose(): void }[],
      extensionPath: directory,
      extensionUri: uri(directory),
      extensionMode: 1,
      asAbsolutePath: (value: string) => path.join(directory, value),
      workspaceState: {
        get: (_key: string, fallback?: unknown) => fallback,
        update: async () => {},
      },
      globalState: { get: (_key: string, fallback?: unknown) => fallback, update: async () => {} },
    };
    if (!isExtensionContext(context)) {
      throw new Error("extension context stub");
    }
    t.teardown(async () => {
      await deactivate();
      for (const item of context.subscriptions) {
        item.dispose();
      }
      host.folders = undefined;
      fs.rmSync(directory, { recursive: true, force: true });
    });
    activate(context);
    await new Promise<void>((resolve) => setImmediate(resolve));
    t.deepEqual(
      host.clients.map((client) => client.options.initializationOptions.owningRoot),
      [first.uri.toString(), second.uri.toString()],
    );
    const [firstClient, secondClient] = host.clients;
    for (const client of [firstClient, secondClient]) {
      t.is(client.server.run.options.env.ELECTRON_RUN_AS_NODE, "1");
      t.is(client.server.debug.options.env.ELECTRON_RUN_AS_NODE, "1");
    }
    const manifest: {
      contributes: { configuration: { properties: Record<string, { scope?: string }> } };
    } = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
    for (const setting of [
      "configFile",
      "plugins",
      "target",
      "entryPoints",
      "includePaths",
      "architecture",
      "buildOutput",
      "baseImage",
    ]) {
      t.is(manifest.contributes.configuration.properties[`asm.${setting}`].scope, "resource");
    }
    host.folders = [second];
    host.foldersChanged?.();
    t.is(firstClient.stops, 1);
    t.is(secondClient.stops, 0);
    host.failNextStart = true;
    host.folders = [first, second];
    host.foldersChanged?.();
    await new Promise<void>((resolve) => setImmediate(resolve));
    t.is(host.clients[2].stops, 1);
    t.is(secondClient.stops, 0);
    host.foldersChanged?.();
    await new Promise<void>((resolve) => setImmediate(resolve));
    t.is(host.clients.length, 4);
    t.is(host.clients[3].options.initializationOptions.owningRoot, first.uri.toString());
  },
);

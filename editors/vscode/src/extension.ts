import * as path from "node:path";
import {
  commands,
  StatusBarAlignment,
  Uri,
  window,
  workspace,
  type Disposable,
  type ExtensionContext,
  type StatusBarItem,
  type TextDocument,
} from "vscode";
import {
  ExecuteCommandRequest,
  LanguageClient,
  TransportKind,
  type LanguageClientOptions,
  type ServerOptions,
} from "vscode-languageclient/node";

/** The result of a build request returned by the language server. */
type BuildResult = {
  ok: boolean;
  outputPath?: string;
  bytes?: number;
  message?: string;
};

let client: LanguageClient | undefined;

/** Whether build-on-save watch mode is currently enabled. */
let watchEnabled = false;
/** The entry document URI rebuilt on save while watching. */
let watchEntryUri: string | undefined;
/** Disposable for the active save listener while watching. */
let saveListener: Disposable | undefined;
/** Debounce timer for watch rebuilds. */
let watchTimer: ReturnType<typeof setTimeout> | undefined;
/** Status bar toggle for watch mode. */
let statusItem: StatusBarItem;

/**
 * Activates the extension and starts the SNES assembly language server.
 * @param {ExtensionContext} context The extension context.
 */
export function activate(context: ExtensionContext): void {
  const serverModule = context.asAbsolutePath(path.join("server", "server.mjs"));

  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.stdio },
    debug: { module: serverModule, transport: TransportKind.stdio },
  };

  const config = workspace.getConfiguration("snesAsm");
  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: "file", language: "snes-asm" }],
    synchronize: {
      configurationSection: "snesAsm",
      fileEvents: workspace.createFileSystemWatcher("**/*.{asm,src,SRC,s,inc}"),
    },
    initializationOptions: {
      entryPoints: config.get<string[]>("entryPoints", []),
      includePaths: config.get<string[]>("includePaths", ["./"]),
      architecture: config.get<string>("architecture", "65816"),
    },
  };

  client = new LanguageClient(
    "snesAsmLanguageServer",
    "SNES Assembly Language Server",
    serverOptions,
    clientOptions,
  );

  statusItem = window.createStatusBarItem(StatusBarAlignment.Left, 0);
  statusItem.command = "snesAsm.toggleWatch";
  updateStatusItem();
  statusItem.show();

  context.subscriptions.push(
    statusItem,
    commands.registerCommand("snesAsm.build", () => runBuild(activeDocumentUri())),
    commands.registerCommand("snesAsm.toggleWatch", toggleWatch),
  );

  void client.start();
}

/**
 * Stops the language server when the extension is deactivated.
 * @returns {Thenable<void> | undefined} A promise that resolves once the client stops.
 */
export function deactivate(): Thenable<void> | undefined {
  saveListener?.dispose();
  if (watchTimer) {
    clearTimeout(watchTimer);
  }
  return client?.stop();
}

/**
 * Returns the URI string of the active editor document, if any.
 * @returns {string | undefined} The document URI string.
 */
function activeDocumentUri(): string | undefined {
  return window.activeTextEditor?.document.uri.toString();
}

/**
 * Toggles build-on-save watch mode for the resolved entry document.
 */
function toggleWatch(): void {
  watchEnabled = !watchEnabled;
  if (watchEnabled) {
    watchEntryUri = resolveWatchEntry();
    if (!watchEntryUri) {
      watchEnabled = false;
      void window.showErrorMessage("SNES Assembly: open a source file (or set snesAsm.entryPoints) before watching.");
      return;
    }
    saveListener = workspace.onDidSaveTextDocument(onDocumentSaved);
    void window.showInformationMessage(`SNES Assembly: watching ${path.basename(Uri.parse(watchEntryUri).fsPath)} — rebuilding on save.`);
  } else {
    saveListener?.dispose();
    saveListener = undefined;
    watchEntryUri = undefined;
    if (watchTimer) {
      clearTimeout(watchTimer);
      watchTimer = undefined;
    }
  }
  updateStatusItem();
}

/**
 * Resolves the entry document to rebuild while watching. Prefers the first
 * configured entry point, falling back to the active editor.
 * @returns {string | undefined} The entry document URI string.
 */
function resolveWatchEntry(): string | undefined {
  const entryPoints = workspace.getConfiguration("snesAsm").get<string[]>("entryPoints", []);
  const folder = workspace.workspaceFolders?.[0];
  if (entryPoints.length > 0 && folder) {
    const first = entryPoints[0];
    return path.isAbsolute(first) ? Uri.file(first).toString() : Uri.joinPath(folder.uri, first).toString();
  }
  return activeDocumentUri();
}

/**
 * Rebuilds the watched entry when a relevant document is saved (debounced).
 * @param {TextDocument} document The saved document.
 */
function onDocumentSaved(document: TextDocument): void {
  if (!watchEnabled || !watchEntryUri || !isAssemblyDocument(document)) {
    return;
  }
  if (watchTimer) {
    clearTimeout(watchTimer);
  }
  watchTimer = setTimeout(() => {
    watchTimer = undefined;
    void runBuild(watchEntryUri, true);
  }, 250);
}

/**
 * Determines whether a document is a SNES assembly source file.
 * @param {TextDocument} document The document to test.
 * @returns {boolean} True when the document is an assembly source.
 */
function isAssemblyDocument(document: TextDocument): boolean {
  return document.languageId === "snes-asm" || /\.(asm|src|s|inc)$/i.test(document.fileName);
}

/**
 * Asks the language server to assemble a document and reports the result.
 * @param {string | undefined} documentUri The entry document URI string.
 * @param {boolean} [transient] When true, report success transiently (watch mode).
 */
async function runBuild(documentUri: string | undefined, transient = false): Promise<void> {
  if (!client) {
    return;
  }
  if (!documentUri) {
    void window.showErrorMessage("SNES Assembly: open a source file to build.");
    return;
  }

  const config = workspace.getConfiguration("snesAsm");
  const output = config.get<string>("buildOutput", "") || undefined;
  const targetRom = config.get<string>("targetRom", "") || undefined;

  try {
    const result = await client.sendRequest(ExecuteCommandRequest.type, {
      command: "snesAsm.build",
      arguments: [documentUri, output, targetRom],
    }) as BuildResult | undefined;

    if (result?.ok) {
      const message = `SNES Assembly: built ${result.bytes ?? 0} bytes → ${result.outputPath ?? "output"}.`;
      if (transient) {
        window.setStatusBarMessage(message, 4000);
      } else {
        void window.showInformationMessage(message);
      }
    } else {
      void window.showErrorMessage(`SNES Assembly: build failed — ${result?.message ?? "unknown error"}.`);
    }
  } catch (error) {
    void window.showErrorMessage(`SNES Assembly: build failed — ${error instanceof Error ? error.message : String(error)}.`);
  }
}

/**
 * Updates the watch status bar item to reflect the current state.
 */
function updateStatusItem(): void {
  if (!statusItem) {
    return;
  }
  statusItem.text = watchEnabled ? "$(eye) SNES Watch: On" : "$(eye-closed) SNES Watch: Off";
  statusItem.tooltip = watchEnabled
    ? "SNES Assembly is rebuilding on save. Click to stop."
    : "Click to rebuild the SNES ROM on every save.";
}

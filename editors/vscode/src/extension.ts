/**
 * VS Code extension-host entry point and language-client integration.
 * @see https://code.visualstudio.com/api/get-started/extension-anatomy#extension-entry-file
 * @see https://code.visualstudio.com/api/language-extensions/language-server-extension-guide#language-client
 */
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

/**
 * The result of a build request returned by the language server.
 * @see https://code.visualstudio.com/api/extension-guides/command#using-commands
 * @see https://code.visualstudio.com/api/language-extensions/language-server-extension-guide#language-client
 */
type BuildResult = {
  ok: boolean;
  outputPath?: string;
  bytes?: number;
  message?: string;
};

/**
 * Language client connected to the bundled server process.
 * @see https://code.visualstudio.com/api/language-extensions/language-server-extension-guide#language-client
 */
let client: LanguageClient | undefined;

/** Whether build-on-save watch mode is currently enabled. */
let watchEnabled = false;
/**
 * The entry document URI rebuilt on save while watching.
 * @see https://code.visualstudio.com/api/references/vscode-api#Uri
 */
let watchEntryUri: string | undefined;
/**
 * Disposable for the active save listener while watching.
 * @see https://code.visualstudio.com/api/references/vscode-api#Disposable
 */
let saveListener: Disposable | undefined;
/** Debounce timer for watch rebuilds. */
let watchTimer: ReturnType<typeof setTimeout> | undefined;
/**
 * Status bar toggle for watch mode.
 * @see https://code.visualstudio.com/api/references/vscode-api#StatusBarItem
 * @see https://code.visualstudio.com/api/ux-guidelines/status-bar
 */
let statusItem: StatusBarItem;

/**
 * Returns the JSON-safe project settings sent across the LSP boundary.
 * @returns {Record<string, unknown>} The complete language-server initialization settings.
 */
function serverInitializationOptions(): Record<string, unknown> {
  const config = workspace.getConfiguration("asm");
  return {
    configFile: config.get<string>("configFile", ""),
    plugins: config.get<unknown[]>("plugins", []),
    target: config.get<string>("target", ""),
    entryPoints: config.get<string[]>("entryPoints", []),
    includePaths: config.get<string[]>("includePaths", []),
    architecture: config.get<string>("architecture", ""),
    buildOutput: config.get<string>("buildOutput", ""),
    baseImage: config.get<string>("baseImage", ""),
    workspaceTrusted: workspace.isTrusted,
  };
}

/**
 * Activates the extension and starts the Uttori Assembly language server.
 * @param {ExtensionContext} context The extension context.
 * @see https://code.visualstudio.com/api/references/vscode-api#ExtensionContext
 * @see https://code.visualstudio.com/api/references/vscode-api#workspace.createFileSystemWatcher
 * @see https://code.visualstudio.com/api/references/vscode-api#window.createStatusBarItem
 * @see https://code.visualstudio.com/api/references/vscode-api#commands.registerCommand
 * @see https://code.visualstudio.com/api/language-extensions/language-server-extension-guide#language-client
 */
export function activate(context: ExtensionContext): void {
  const serverModule = context.asAbsolutePath(path.join("server", "server.mjs"));

  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.stdio },
    debug: { module: serverModule, transport: TransportKind.stdio },
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: "file", language: "uttori-asm" }],
    synchronize: {
      configurationSection: "asm",
      fileEvents: [
        workspace.createFileSystemWatcher("**/*.{asm,src,SRC,s,inc}"),
        workspace.createFileSystemWatcher("**/asm.config.json"),
      ],
    },
    initializationOptions: serverInitializationOptions(),
  };

  client = new LanguageClient(
    "uttoriAsmLanguageServer",
    "Uttori Assembly Language Server",
    serverOptions,
    clientOptions,
  );

  statusItem = window.createStatusBarItem(StatusBarAlignment.Left, 0);
  statusItem.command = "asm.toggleWatch";
  updateStatusItem();
  statusItem.show();

  context.subscriptions.push(
    statusItem,
    commands.registerCommand("asm.build", () => runBuild(activeDocumentUri())),
    commands.registerCommand("asm.toggleWatch", toggleWatch),
    workspace.onDidGrantWorkspaceTrust(() => {
      void client?.sendNotification("workspace/didChangeConfiguration", {
        settings: {
          asm: serverInitializationOptions(),
        },
      });
    }),
  );

  void client.start();
}

/**
 * Stops the language server when the extension is deactivated.
 * @returns {Thenable<void> | undefined} A promise that resolves once the client stops.
 * @see https://code.visualstudio.com/api/get-started/extension-anatomy#extension-entry-file
 * @see https://code.visualstudio.com/api/references/vscode-api#Disposable.dispose
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
 * @see https://code.visualstudio.com/api/references/vscode-api#window.activeTextEditor
 * @see https://code.visualstudio.com/api/references/vscode-api#TextDocument.uri
 * @see https://code.visualstudio.com/api/references/vscode-api#Uri.toString
 */
function activeDocumentUri(): string | undefined {
  return window.activeTextEditor?.document.uri.toString();
}

/**
 * Toggles build-on-save watch mode for the resolved entry document.
 * @see https://code.visualstudio.com/api/references/vscode-api#workspace.onDidSaveTextDocument
 * @see https://code.visualstudio.com/api/references/vscode-api#window.showInformationMessage
 * @see https://code.visualstudio.com/api/references/vscode-api#window.showErrorMessage
 * @see https://code.visualstudio.com/api/references/vscode-api#Uri.parse
 */
function toggleWatch(): void {
  watchEnabled = !watchEnabled;
  if (watchEnabled) {
    watchEntryUri = resolveWatchEntry();
    if (!watchEntryUri) {
      watchEnabled = false;
      void window.showErrorMessage(
        "Assembly: open a source file (or set asm.entryPoints) before watching.",
      );
      return;
    }
    saveListener = workspace.onDidSaveTextDocument(onDocumentSaved);
    void window.showInformationMessage(
      `Assembly: watching ${path.basename(Uri.parse(watchEntryUri).fsPath)} — rebuilding on save.`,
    );
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
 * @see https://code.visualstudio.com/api/references/vscode-api#workspace.getConfiguration
 * @see https://code.visualstudio.com/api/references/vscode-api#workspace.getWorkspaceFolder
 * @see https://code.visualstudio.com/api/references/vscode-api#workspace.workspaceFolders
 * @see https://code.visualstudio.com/api/references/vscode-api#Uri.file
 * @see https://code.visualstudio.com/api/references/vscode-api#Uri.joinPath
 */
function resolveWatchEntry(): string | undefined {
  const activeUri = window.activeTextEditor?.document.uri;
  const entryPoints = workspace.getConfiguration("asm", activeUri).get<string[]>("entryPoints", []);
  const folder = activeUri
    ? workspace.getWorkspaceFolder(activeUri)
    : workspace.workspaceFolders?.[0];
  if (entryPoints.length > 0 && folder) {
    const first = entryPoints[0];
    return path.isAbsolute(first)
      ? Uri.file(first).toString()
      : Uri.joinPath(folder.uri, first).toString();
  }
  return activeDocumentUri();
}

/**
 * Rebuilds the watched entry when a relevant document is saved (debounced).
 * @param {TextDocument} document The saved document.
 * @see https://code.visualstudio.com/api/references/vscode-api#workspace.onDidSaveTextDocument
 * @see https://code.visualstudio.com/api/references/vscode-api#TextDocument
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
 * Determines whether a document is an assembly source file.
 * @param {TextDocument} document The document to test.
 * @returns {boolean} True when the document is an assembly source.
 * @see https://code.visualstudio.com/api/references/vscode-api#TextDocument
 */
function isAssemblyDocument(document: TextDocument): boolean {
  return document.languageId === "uttori-asm" || /\.(asm|src|s|inc)$/i.test(document.fileName);
}

/**
 * Asks the language server to assemble a document and reports the result.
 * @param {string | undefined} documentUri The entry document URI string.
 * @param {boolean} [transient] When true, report success transiently (watch mode).
 * @returns {Promise<void>} A promise that settles after the build result is reported.
 * @see https://code.visualstudio.com/api/language-extensions/language-server-extension-guide#language-client
 * @see https://code.visualstudio.com/api/references/vscode-api#workspace.getConfiguration
 * @see https://code.visualstudio.com/api/references/vscode-api#window.showInformationMessage
 * @see https://code.visualstudio.com/api/references/vscode-api#window.showErrorMessage
 * @see https://code.visualstudio.com/api/references/vscode-api#window.setStatusBarMessage
 * @see https://code.visualstudio.com/api/references/vscode-api#Uri.parse
 */
async function runBuild(documentUri: string | undefined, transient = false): Promise<void> {
  if (!client) {
    return;
  }
  if (!documentUri) {
    void window.showErrorMessage("Assembly: open a source file to build.");
    return;
  }

  const document = Uri.parse(documentUri);
  const config = workspace.getConfiguration("asm", document);
  const output = resolveConfiguredPath(config.get<string>("buildOutput", ""), document);
  const baseImage = resolveConfiguredPath(config.get<string>("baseImage", ""), document);

  try {
    const result = (await client.sendRequest(ExecuteCommandRequest.type, {
      command: "asm.build",
      arguments: [documentUri, output, baseImage],
    })) as BuildResult | undefined;

    if (result?.ok) {
      const message = `Assembly: built ${result.bytes ?? 0} bytes → ${result.outputPath ?? "output"}.`;
      if (transient) {
        window.setStatusBarMessage(message, 4000);
      } else {
        void window.showInformationMessage(message);
      }
    } else {
      void window.showErrorMessage(
        `Assembly: build failed — ${result?.message ?? "unknown error"}.`,
      );
    }
  } catch (error) {
    void window.showErrorMessage(
      `Assembly: build failed — ${error instanceof Error ? error.message : String(error)}.`,
    );
  }
}

/**
 * Resolves a path setting relative to the document's workspace folder. If the
 * document is outside a workspace, its containing directory is used.
 * @param {string} configuredPath The setting value.
 * @param {Uri} document The source document URI.
 * @returns {string | undefined} An absolute path, or undefined when unset.
 * @see https://code.visualstudio.com/api/references/vscode-api#Uri
 * @see https://code.visualstudio.com/api/references/vscode-api#workspace.getWorkspaceFolder
 */
function resolveConfiguredPath(configuredPath: string, document: Uri): string | undefined {
  if (!configuredPath) {
    return undefined;
  }
  if (path.isAbsolute(configuredPath)) {
    return path.normalize(configuredPath);
  }
  const folder = workspace.getWorkspaceFolder(document);
  return path.resolve(folder?.uri.fsPath ?? path.dirname(document.fsPath), configuredPath);
}

/**
 * Updates the watch status bar item to reflect the current state.
 * @see https://code.visualstudio.com/api/references/vscode-api#StatusBarItem
 * @see https://code.visualstudio.com/api/references/vscode-api#StatusBarAlignment
 */
function updateStatusItem(): void {
  if (!statusItem) {
    return;
  }
  statusItem.text = watchEnabled
    ? "$(eye) Assembly Watch: On"
    : "$(eye-closed) Assembly Watch: Off";
  statusItem.tooltip = watchEnabled
    ? "Assembly is rebuilding on save. Click to stop."
    : "Click to rebuild the binary on every save.";
}

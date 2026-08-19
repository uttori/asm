/**
 * SNES assembly language-server transport and LSP 3.18 request routing.
 * @see https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/#language-server-protocol
 */
import {
  createConnection,
  DidChangeConfigurationNotification,
  PositionEncodingKind,
  ProposedFeatures,
  SymbolInformation,
  TextDocumentSyncKind,
  TextDocuments,
  type InitializeParams,
  type InitializeResult,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import fs from "node:fs";
import path from "node:path";
import { Assembler, OverlayFileProvider, WorkspaceIndex } from "./core.js";
import {
  completionsFor,
  definitionFor,
  diagnosticsFor,
  documentSymbolsFor,
  hoverFor,
  prepareRenameFor,
  referencesFor,
  renameEditsFor,
  semanticTokensFor,
  semanticTokensLegend,
  signatureHelpFor,
  pathToUri,
  uriToPath,
} from "./providers.js";

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

/**
 * Settings consumed by the server, mirrored from LSP `initializationOptions`
 * and `workspace/configuration`.
 * @see https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/#initialize-request-leftwards_arrow_with_hook
 * @see https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/#configuration-request-arrow_right_hook
 */
type ServerSettings = {
  entryPoints: string[];
  includePaths: string[];
  architecture: string;
};

const defaultSettings: ServerSettings = {
  entryPoints: [],
  includePaths: ["./"],
  architecture: "65816",
};

let settings: ServerSettings = { ...defaultSettings };
let hasConfigurationCapability = false;
let hasDidChangeConfigurationDynamicRegistration = false;
let workspaceRoots: string[] = [];
const index = new WorkspaceIndex(settings);

/** Pending debounce timer for re-analysis. */
let reindexTimer: NodeJS.Timeout | undefined;

/**
 * Schedules a debounced workspace re-index and diagnostic refresh.
 * @see https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/#didchangewatchedfiles-notification-arrow_right
 */
function scheduleReindex(): void {
  if (reindexTimer) {
    clearTimeout(reindexTimer);
  }
  reindexTimer = setTimeout(() => {
    reindexTimer = undefined;
    index.reindex();
    publishAllDiagnostics();
  }, 150);
}

/**
 * Publishes diagnostics for every open document.
 * @see https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/#publishdiagnostics-notification-arrow_left
 */
function publishAllDiagnostics(): void {
  for (const document of documents.all()) {
    const file = uriToPath(document.uri);
    void connection.sendDiagnostics({
      uri: document.uri,
      diagnostics: diagnosticsFor(index, file),
    });
  }
}

/**
 * Negotiates the server's LSP 3.18 capabilities with the client.
 * @see https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/#initialize-request-leftwards_arrow_with_hook
 */
connection.onInitialize((params: InitializeParams): InitializeResult => {
  hasConfigurationCapability = Boolean(params.capabilities.workspace?.configuration);
  hasDidChangeConfigurationDynamicRegistration = Boolean(
    params.capabilities.workspace?.didChangeConfiguration?.dynamicRegistration,
  );
  applyInitializationOptions(params);

  return {
    capabilities: {
      positionEncoding: PositionEncodingKind.UTF16,
      textDocumentSync: {
        openClose: true,
        change: TextDocumentSyncKind.Incremental,
      },
      completionProvider: { triggerCharacters: [".", "!", "$"] },
      hoverProvider: true,
      definitionProvider: true,
      referencesProvider: true,
      documentSymbolProvider: true,
      workspaceSymbolProvider: true,
      renameProvider: { prepareProvider: true },
      signatureHelpProvider: { triggerCharacters: [" ", ","] },
      executeCommandProvider: { commands: ["snesAsm.build"] },
      semanticTokensProvider: {
        legend: semanticTokensLegend,
        full: true,
      },
    },
  };
});

/**
 * The extension-specific result of the `snesAsm.build` execute-command request.
 * @see https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/#execute-a-command-leftwards_arrow_with_hook
 */
type BuildResult = {
  ok: boolean;
  outputPath?: string;
  bytes?: number;
  message?: string;
};

/**
 * Assembles a source file to a ROM/binary using the bundled assembler core.
 * Open editor buffers are layered over disk so unsaved changes are built.
 * @param {string} file The absolute path of the entry source file.
 * @param {string} outputPath The absolute path to write the assembled binary to.
 * @param {string} [targetRomPath] Optional base ROM to patch into.
 * @returns {BuildResult} The build outcome.
 * @see https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/#execute-a-command-leftwards_arrow_with_hook
 */
function buildRom(file: string, outputPath: string, targetRomPath?: string): BuildResult {
  try {
    const overlay = new Map<string, string>();
    for (const document of documents.all()) {
      overlay.set(uriToPath(document.uri), document.getText());
    }
    const provider = new OverlayFileProvider(overlay);

    let targetRom: Uint8Array | undefined;
    if (targetRomPath) {
      targetRom = new Uint8Array(fs.readFileSync(targetRomPath));
    }

    const source = provider.readTextFile(file);
    const assembler = new Assembler(targetRom, {
      fileProvider: provider,
      collectSourceMetadata: false,
    });
    assembler.setIncludePaths([path.dirname(file), ...settings.includePaths]);
    assembler.setCurrentFile(file);
    assembler.arch = settings.architecture;

    const program = assembler.buildProgramModel(source, file, 0);
    assembler.assembleProgram(program);

    const output = assembler.getBinaryOutput();
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, Buffer.from(output));
    return { ok: true, outputPath, bytes: output.length };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Derives the default output path for a source file (its `.sfc` sibling).
 * @param {string} file The absolute source path.
 * @returns {string} The default output path.
 */
function defaultOutputPath(file: string): string {
  const parsed = path.parse(file);
  return path.join(parsed.dir, `${parsed.name}.sfc`);
}

/**
 * Handles the extension-specific `snesAsm.build` workspace command.
 * @see https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/#execute-a-command-leftwards_arrow_with_hook
 */
connection.onExecuteCommand((params) => {
  if (params.command !== "snesAsm.build") {
    return undefined;
  }
  const args = (params.arguments ?? []) as Array<string | undefined>;
  const uriOrPath = args[0];
  if (!uriOrPath) {
    return { ok: false, message: "No file provided to build." } satisfies BuildResult;
  }
  const file = uriOrPath.startsWith("file:") ? uriToPath(uriOrPath) : uriOrPath;
  let outputPath = defaultOutputPath(file);
  if (args[1]) {
    outputPath = args[1].startsWith("file:") ? uriToPath(args[1]) : args[1];
  }
  let targetRomPath: string | undefined;
  if (args[2]) {
    targetRomPath = args[2].startsWith("file:") ? uriToPath(args[2]) : args[2];
  }
  return buildRom(file, outputPath, targetRomPath);
});

/**
 * Completes dynamic registration after initialization.
 * @see https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/#initialized-notification-arrow_right
 * @see https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/#register-capability-arrow_right_hook
 */
connection.onInitialized(() => {
  if (hasDidChangeConfigurationDynamicRegistration) {
    connection.client.register(DidChangeConfigurationNotification.type, undefined).catch(() => {});
  }
  if (hasConfigurationCapability) {
    void refreshConfiguration();
  }
});

/**
 * Applies entry points and include paths handed in `initializationOptions`.
 * @param {InitializeParams} params The initialize parameters.
 * @see https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/#initialize-request-leftwards_arrow_with_hook
 */
function applyInitializationOptions(params: InitializeParams): void {
  const options = (params.initializationOptions ?? {}) as Partial<ServerSettings>;
  workspaceRoots = (params.workspaceFolders ?? []).map((folder) => uriToPath(folder.uri));
  if (workspaceRoots.length === 0 && params.rootUri) {
    workspaceRoots = [uriToPath(params.rootUri)];
  }
  settings = {
    entryPoints: resolveConfiguredPaths(options.entryPoints ?? [], workspaceRoots),
    includePaths: resolveConfiguredPaths(
      options.includePaths ?? defaultSettings.includePaths,
      workspaceRoots,
    ),
    architecture: options.architecture ?? defaultSettings.architecture,
  };
  index.configure(settings);
}

/**
 * Resolves a possibly-relative path against the first workspace folder.
 * @param {string[]} roots The workspace folder paths.
 * @param {string} entry The configured entry value.
 * @returns {string} The resolved path.
 */
function resolveAgainst(roots: string[], entry: string): string {
  if (roots.length === 0) {
    return path.resolve(entry);
  }
  return path.isAbsolute(entry) ? path.normalize(entry) : path.resolve(roots[0], entry);
}

/**
 * Resolves configuration path values against the first workspace folder.
 * @param {string[]} values The configured paths.
 * @param {string[]} roots The active workspace roots.
 * @returns {string[]} Absolute normalized paths.
 */
function resolveConfiguredPaths(values: string[], roots: string[]): string[] {
  return values.map((value) => resolveAgainst(roots, value));
}

/**
 * Pulls configuration from the client and re-indexes when it changes.
 * @see https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/#configuration-request-arrow_right_hook
 */
async function refreshConfiguration(): Promise<void> {
  try {
    const config: unknown = await connection.workspace.getConfiguration("snesAsm");
    applyConfiguration(config);
  } catch {
    // Configuration is optional; ignore failures and keep current settings.
  }
}

/**
 * Applies an LSP configuration payload without assuming pull-configuration
 * support. This is also used for the settings embedded in change notifications.
 * @param {unknown} config The client-provided `snesAsm` configuration object.
 * @see https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/#configuration-request-arrow_right_hook
 * @see https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/#didchangeconfiguration-notification-arrow_right
 */
function applyConfiguration(config: unknown): void {
  if (!config || typeof config !== "object") {
    return;
  }
  const next = config as Partial<ServerSettings>;
  settings = {
    entryPoints: next.entryPoints
      ? resolveConfiguredPaths(next.entryPoints, workspaceRoots)
      : settings.entryPoints,
    includePaths: next.includePaths
      ? resolveConfiguredPaths(next.includePaths, workspaceRoots)
      : settings.includePaths,
    architecture: next.architecture ?? settings.architecture,
  };
  index.configure(settings);
  publishAllDiagnostics();
}

/**
 * Refreshes settings after `workspace/didChangeConfiguration`.
 * @see https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/#didchangeconfiguration-notification-arrow_right
 */
connection.onDidChangeConfiguration((params) => {
  if (hasConfigurationCapability) {
    void refreshConfiguration();
    return;
  }
  const changedSettings = params.settings as { snesAsm?: unknown } | undefined;
  applyConfiguration(changedSettings?.snesAsm ?? changedSettings);
});

/**
 * Re-indexes disk-backed source changes reported by the editor file watcher.
 * @see https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/#didchangewatchedfiles-notification-arrow_right
 */
connection.onDidChangeWatchedFiles(() => {
  scheduleReindex();
});

/**
 * Adds an opened text document to the overlay used by analysis and builds.
 * @see https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/#didopentextdocument-notification-arrow_right
 */
documents.onDidOpen((event) => {
  index.openDocument(uriToPath(event.document.uri), event.document.getText());
  void connection.sendDiagnostics({
    uri: event.document.uri,
    diagnostics: diagnosticsFor(index, uriToPath(event.document.uri)),
  });
});

/**
 * Applies incremental text-document changes to the analysis overlay.
 * @see https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/#didchangetextdocument-notification-arrow_right
 */
documents.onDidChangeContent((event) => {
  index.updateDocument(uriToPath(event.document.uri), event.document.getText());
  scheduleReindex();
});

/**
 * Removes a closed document from the overlay and clears its diagnostics.
 * @see https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/#didclosetextdocument-notification-arrow_right
 */
documents.onDidClose((event) => {
  index.closeDocument(uriToPath(event.document.uri));
  void connection.sendDiagnostics({ uri: event.document.uri, diagnostics: [] });
});

/** @see https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/#completion-request-leftwards_arrow_with_hook */
connection.onCompletion(() => completionsFor(index, settings.architecture));

/** @see https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/#hover-request-leftwards_arrow_with_hook */
connection.onHover((params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) {
    return null;
  }
  return hoverFor(
    index,
    uriToPath(params.textDocument.uri),
    params.position,
    document.getText(),
    settings.architecture,
  );
});

/** @see https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/#go-to-definition-request-leftwards_arrow_with_hook */
connection.onDefinition((params) =>
  definitionFor(index, uriToPath(params.textDocument.uri), params.position),
);

/** @see https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/#find-references-request-leftwards_arrow_with_hook */
connection.onReferences((params) =>
  referencesFor(
    index,
    uriToPath(params.textDocument.uri),
    params.position,
    params.context.includeDeclaration,
  ),
);

/** @see https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/#document-symbols-request-leftwards_arrow_with_hook */
connection.onDocumentSymbol((params) =>
  documentSymbolsFor(index, uriToPath(params.textDocument.uri)),
);

/** @see https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/#workspace-symbols-request-leftwards_arrow_with_hook */
connection.onWorkspaceSymbol((params): SymbolInformation[] => {
  const query = params.query.toLowerCase();
  const results: SymbolInformation[] = [];
  for (const file of index.getAnalyzedFiles()) {
    for (const symbol of documentSymbolsFor(index, file)) {
      if (!query || symbol.name.toLowerCase().includes(query)) {
        results.push(
          SymbolInformation.create(
            symbol.name,
            symbol.kind,
            symbol.selectionRange,
            pathToUri(file),
            symbol.detail,
          ),
        );
      }
    }
  }
  return results;
});

/** @see https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/#signature-help-request-leftwards_arrow_with_hook */
connection.onSignatureHelp((params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) {
    return null;
  }
  const lineStart = { line: params.position.line, character: 0 };
  const lineText = document.getText({ start: lineStart, end: params.position });
  return signatureHelpFor(lineText, settings.architecture);
});

/** @see https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/#prepare-rename-request-leftwards_arrow_with_hook */
connection.onPrepareRename((params) =>
  prepareRenameFor(index, uriToPath(params.textDocument.uri), params.position),
);

/** @see https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/#rename-request-leftwards_arrow_with_hook */
connection.onRenameRequest((params) =>
  renameEditsFor(index, uriToPath(params.textDocument.uri), params.position, params.newName),
);

/** @see https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/#semantic-tokens-leftwards_arrow_with_hook */
connection.languages.semanticTokens.on((params) =>
  semanticTokensFor(index, uriToPath(params.textDocument.uri)),
);

/**
 * Connects the text-document manager to the negotiated synchronization stream.
 * @see https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/#text-document-synchronization
 */
documents.listen(connection);

/**
 * Starts processing LSP messages over the selected JSON-RPC transport.
 * @see https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/#base-protocol
 */
connection.listen();

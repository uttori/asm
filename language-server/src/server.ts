import {
  CodeAction,
  CodeActionKind,
  createConnection,
  DidChangeConfigurationNotification,
  ProposedFeatures,
  TextDocumentSyncKind,
  TextDocuments,
  type InitializeParams,
  type InitializeResult,
} from "vscode-languageserver/node.js";
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

/** Settings consumed by the server, mirrored from the client configuration. */
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
const index = new WorkspaceIndex(settings);

/** Pending debounce timer for re-analysis. */
let reindexTimer: NodeJS.Timeout | undefined;

/**
 * Schedules a debounced workspace re-index and diagnostic refresh.
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
 */
function publishAllDiagnostics(): void {
  for (const document of documents.all()) {
    const file = uriToPath(document.uri);
    connection.sendDiagnostics({ uri: document.uri, diagnostics: diagnosticsFor(index, file) });
  }
}

connection.onInitialize((params: InitializeParams): InitializeResult => {
  hasConfigurationCapability = Boolean(params.capabilities.workspace?.configuration);
  applyInitializationOptions(params);

  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: { triggerCharacters: [".", "!", "$"] },
      hoverProvider: true,
      definitionProvider: true,
      referencesProvider: true,
      documentSymbolProvider: true,
      workspaceSymbolProvider: true,
      renameProvider: { prepareProvider: true },
      signatureHelpProvider: { triggerCharacters: [" ", ","] },
      codeActionProvider: { codeActionKinds: [CodeActionKind.QuickFix] },
      executeCommandProvider: { commands: ["snesAsm.build"] },
      semanticTokensProvider: {
        legend: semanticTokensLegend,
        full: true,
      },
    },
  };
});

/** The result of an assemble/build request. */
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
    const assembler = new Assembler(targetRom, { fileProvider: provider });
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
  const outputPath = args[1] ? (args[1].startsWith("file:") ? uriToPath(args[1]) : args[1]) : defaultOutputPath(file);
  const targetRomPath = args[2] ? (args[2].startsWith("file:") ? uriToPath(args[2]) : args[2]) : undefined;
  return buildRom(file, outputPath, targetRomPath);
});

connection.onInitialized(() => {
  if (hasConfigurationCapability) {
    connection.client.register(DidChangeConfigurationNotification.type, undefined).catch(() => {});
    void refreshConfiguration();
  }
});

/**
 * Applies entry points and include paths handed in `initializationOptions`.
 * @param {InitializeParams} params The initialize parameters.
 */
function applyInitializationOptions(params: InitializeParams): void {
  const options = (params.initializationOptions ?? {}) as Partial<ServerSettings>;
  const roots = (params.workspaceFolders ?? [])
    .map((folder) => uriToPath(folder.uri));
  settings = {
    entryPoints: (options.entryPoints ?? []).map((entry) => resolveAgainst(roots, entry)),
    includePaths: options.includePaths ?? defaultSettings.includePaths,
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
    return entry;
  }
  return entry.startsWith("/") ? entry : `${roots[0]}/${entry}`;
}

/**
 * Pulls configuration from the client and re-indexes when it changes.
 */
async function refreshConfiguration(): Promise<void> {
  try {
    const config = await connection.workspace.getConfiguration("snesAsm");
    if (config && typeof config === "object") {
      const next = config as Partial<ServerSettings>;
      settings = {
        entryPoints: next.entryPoints ?? settings.entryPoints,
        includePaths: next.includePaths ?? settings.includePaths,
        architecture: next.architecture ?? settings.architecture,
      };
      index.configure(settings);
      publishAllDiagnostics();
    }
  } catch {
    // Configuration is optional; ignore failures and keep current settings.
  }
}

connection.onDidChangeConfiguration(() => {
  void refreshConfiguration();
});

documents.onDidOpen((event) => {
  index.openDocument(uriToPath(event.document.uri), event.document.getText());
  connection.sendDiagnostics({
    uri: event.document.uri,
    diagnostics: diagnosticsFor(index, uriToPath(event.document.uri)),
  });
});

documents.onDidChangeContent((event) => {
  index.updateDocument(uriToPath(event.document.uri), event.document.getText());
  scheduleReindex();
});

documents.onDidClose((event) => {
  index.closeDocument(uriToPath(event.document.uri));
  connection.sendDiagnostics({ uri: event.document.uri, diagnostics: [] });
});

connection.onCompletion(() => completionsFor(index, settings.architecture));

connection.onHover((params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) {
    return null;
  }
  return hoverFor(index, uriToPath(params.textDocument.uri), params.position, document.getText(), settings.architecture);
});

connection.onDefinition((params) => definitionFor(index, uriToPath(params.textDocument.uri), params.position));

connection.onReferences((params) => referencesFor(
  index,
  uriToPath(params.textDocument.uri),
  params.position,
  params.context.includeDeclaration,
));

connection.onDocumentSymbol((params) => documentSymbolsFor(index, uriToPath(params.textDocument.uri)));

connection.onWorkspaceSymbol((params) => {
  const query = params.query.toLowerCase();
  const results = [];
  for (const file of index.getAnalyzedFiles()) {
    for (const symbol of documentSymbolsFor(index, file)) {
      if (!query || symbol.name.toLowerCase().includes(query)) {
        results.push({
          name: symbol.name,
          kind: symbol.kind,
          location: { uri: pathToUri(file), range: symbol.selectionRange },
          containerName: symbol.detail,
        });
      }
    }
  }
  return results;
});

connection.onSignatureHelp((params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) {
    return null;
  }
  const lineStart = { line: params.position.line, character: 0 };
  const lineText = document.getText({ start: lineStart, end: params.position });
  return signatureHelpFor(lineText, settings.architecture);
});

connection.onPrepareRename((params) => prepareRenameFor(index, uriToPath(params.textDocument.uri), params.position));

connection.onRenameRequest((params) => renameEditsFor(
  index,
  uriToPath(params.textDocument.uri),
  params.position,
  params.newName,
));

connection.onCodeAction((params): CodeAction[] => {
  const file = uriToPath(params.textDocument.uri);
  const actions: CodeAction[] = [];
  for (const diagnostic of params.context.diagnostics) {
    if (diagnostic.code === "ASSEMBLY_ERROR" || typeof diagnostic.code === "string") {
      // Placeholder quick-fix scaffold: surface the diagnostic so future
      // refactors can attach concrete edits (e.g. fix include paths).
      actions.push(CodeAction.create(
        `Review: ${diagnostic.message}`,
        CodeActionKind.QuickFix,
      ));
    }
  }
  void file;
  return actions;
});

connection.languages.semanticTokens.on((params) => semanticTokensFor(index, uriToPath(params.textDocument.uri)));

documents.listen(connection);
connection.listen();

/** Generic assembly language-server transport and LSP 3.18 request routing. */
import fs from "node:fs";
import path from "node:path";

import snesPlugin, { SNES_TARGET_ID } from "@uttori/asm-plugin-snes";
import {
  createConnection,
  Diagnostic,
  DiagnosticSeverity,
  DidChangeConfigurationNotification,
  PositionEncodingKind,
  ProposedFeatures,
  Range,
  SymbolInformation,
  TextDocumentSyncKind,
  TextDocuments,
  type InitializeParams,
  type InitializeResult,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";

import { OverlayFileProvider, type WorkspaceIndex } from "./core.js";
import {
  ProjectEnvironmentController,
  type PluginModuleSetting,
  type ProjectEnvironmentSettings,
} from "./project-environment.js";
import {
  completionsFor,
  definitionFor,
  diagnosticsFor,
  documentSymbolsFor,
  hoverFor,
  pathToUri,
  prepareRenameFor,
  referencesFor,
  renameEditsFor,
  semanticTokensFor,
  semanticTokensLegend,
  signatureHelpFor,
  uriToPath,
} from "./providers.js";

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);
const environmentController = new ProjectEnvironmentController({
  bundledPlugins: new Map([["@uttori/asm-plugin-snes", snesPlugin]]),
  defaults: {
    plugins: [{ module: "@uttori/asm-plugin-snes" }],
    target: SNES_TARGET_ID,
    includePaths: ["./"],
  },
  logger: {
    debug: (message) => connection.console.log(message),
    info: (message) => connection.console.info(message),
    warn: (message) => connection.console.warn(message),
    error: (message) => connection.console.error(message),
  },
});

export interface ServerSettings {
  configFile?: string;
  plugins: readonly PluginModuleSetting[];
  target?: string;
  architecture?: string;
  entryPoints: readonly string[];
  includePaths: readonly string[];
  buildOutput?: string;
  baseImage?: string;
  workspaceTrusted: boolean;
}

const defaultSettings: ServerSettings = {
  plugins: [],
  entryPoints: [],
  includePaths: [],
  workspaceTrusted: false,
};

type BuildResult = {
  ok: boolean;
  outputPath?: string;
  bytes?: number;
  message?: string;
};

let settings: ServerSettings = defaultSettings;
let index: WorkspaceIndex;
let workspaceRoots: string[] = [];
let hasConfigurationCapability = false;
let hasDidChangeConfigurationDynamicRegistration = false;
let reindexTimer: NodeJS.Timeout | undefined;
let configurationDiagnostic: { uri: string; diagnostic: Diagnostic; message: string } | undefined;
let configurationQueue = Promise.resolve();

const workspaceRoot = (): string => workspaceRoots[0] ?? process.cwd();

function resolveAgainstWorkspace(value: string): string {
  return path.isAbsolute(value) ? path.normalize(value) : path.resolve(workspaceRoot(), value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function stringArray(value: unknown): readonly string[] | undefined {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string")
    ? value
    : undefined;
}

function pluginArray(value: unknown): readonly PluginModuleSetting[] | undefined {
  return Array.isArray(value) ? (value as readonly PluginModuleSetting[]) : undefined;
}

export function mergeServerSettings(previous: ServerSettings, value: unknown): ServerSettings {
  if (!value || typeof value !== "object") return previous;
  const next = value as Record<string, unknown>;
  const has = (key: string): boolean => Object.prototype.hasOwnProperty.call(next, key);
  return {
    configFile: has("configFile") ? stringValue(next.configFile) : previous.configFile,
    plugins: pluginArray(next.plugins) ?? previous.plugins,
    target: has("target") ? stringValue(next.target) : previous.target,
    architecture: has("architecture") ? stringValue(next.architecture) : previous.architecture,
    entryPoints: stringArray(next.entryPoints) ?? previous.entryPoints,
    includePaths: stringArray(next.includePaths) ?? previous.includePaths,
    buildOutput: has("buildOutput") ? stringValue(next.buildOutput) : previous.buildOutput,
    baseImage: has("baseImage") ? stringValue(next.baseImage) : previous.baseImage,
    workspaceTrusted:
      typeof next.workspaceTrusted === "boolean"
        ? next.workspaceTrusted
        : previous.workspaceTrusted,
  };
}

function projectSettings(next: ServerSettings): ProjectEnvironmentSettings {
  return {
    cwd: workspaceRoot(),
    workspaceTrusted: next.workspaceTrusted,
    ...(next.configFile ? { configFile: next.configFile } : {}),
    plugins: next.plugins,
    ...(next.target ? { target: next.target } : {}),
    ...(next.architecture ? { architecture: next.architecture } : {}),
    entryPoints: next.entryPoints.map(resolveAgainstWorkspace),
    ...(next.includePaths.length > 0 ? { includePaths: next.includePaths } : {}),
  };
}

function currentOverlays(): Map<string, string> {
  return new Map(documents.all().map((document) => [uriToPath(document.uri), document.getText()]));
}

function diagnosticUri(next: ServerSettings): string {
  return pathToUri(resolveAgainstWorkspace(next.configFile ?? "asm.config.json"));
}

function setConfigurationDiagnostic(
  next: ServerSettings,
  message?: string,
  severity: DiagnosticSeverity = DiagnosticSeverity.Error,
): void {
  const previousUri = configurationDiagnostic?.uri;
  configurationDiagnostic = message
    ? {
        uri: diagnosticUri(next),
        message,
        diagnostic: Diagnostic.create(
          Range.create(0, 0, 0, 1),
          message,
          severity,
          "PLUGIN_CONFIGURATION_INVALID",
          "uttori-asm",
        ),
      }
    : undefined;
  if (previousUri && previousUri !== configurationDiagnostic?.uri) {
    void connection.sendDiagnostics({ uri: previousUri, diagnostics: [] });
  }
}

async function replaceProjectEnvironment(next: ServerSettings): Promise<void> {
  try {
    const state = await environmentController.replace(projectSettings(next), currentOverlays());
    index = state.index;
    settings = next;
    setConfigurationDiagnostic(next, state.trustNotice, DiagnosticSeverity.Warning);
    publishAllDiagnostics();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    settings = next;
    connection.console.error(`Assembly project configuration failed: ${message}`);
    setConfigurationDiagnostic(next, message);
    publishAllDiagnostics();
    throw error;
  }
}

async function applyQueuedEnvironment(
  previous: Promise<void>,
  next: ServerSettings,
): Promise<void> {
  try {
    await previous;
    await replaceProjectEnvironment(next);
  } catch {
    // Configuration failures are already logged and published as diagnostics.
  }
}

function enqueueProjectEnvironment(next: ServerSettings): void {
  configurationQueue = applyQueuedEnvironment(configurationQueue, next);
}

function scheduleReindex(): void {
  if (reindexTimer) clearTimeout(reindexTimer);
  reindexTimer = setTimeout(() => {
    reindexTimer = undefined;
    index.reindex();
    publishAllDiagnostics();
  }, 150);
}

function publishAllDiagnostics(): void {
  if (!index) return;
  for (const document of documents.all()) {
    const file = uriToPath(document.uri);
    void connection.sendDiagnostics({
      uri: document.uri,
      diagnostics: diagnosticsFor(index, file),
    });
  }
  if (configurationDiagnostic) {
    void connection.sendDiagnostics({
      uri: configurationDiagnostic.uri,
      diagnostics: [configurationDiagnostic.diagnostic],
    });
  }
}

connection.onInitialize(async (params: InitializeParams): Promise<InitializeResult> => {
  hasConfigurationCapability = Boolean(params.capabilities.workspace?.configuration);
  hasDidChangeConfigurationDynamicRegistration = Boolean(
    params.capabilities.workspace?.didChangeConfiguration?.dynamicRegistration,
  );
  workspaceRoots = (params.workspaceFolders ?? []).map((folder) => uriToPath(folder.uri));
  if (workspaceRoots.length === 0 && params.rootUri) workspaceRoots = [uriToPath(params.rootUri)];
  const requested = mergeServerSettings(defaultSettings, params.initializationOptions);
  try {
    await replaceProjectEnvironment(requested);
  } catch {
    settings = requested;
    const fallback = await environmentController.replace(
      { ...projectSettings(defaultSettings), cwd: workspaceRoot(), workspaceTrusted: false },
      currentOverlays(),
    );
    index = fallback.index;
  }

  return {
    capabilities: {
      positionEncoding: PositionEncodingKind.UTF16,
      textDocumentSync: { openClose: true, change: TextDocumentSyncKind.Incremental },
      completionProvider: { triggerCharacters: [".", "!", "$"] },
      hoverProvider: true,
      definitionProvider: true,
      referencesProvider: true,
      documentSymbolProvider: true,
      workspaceSymbolProvider: true,
      renameProvider: { prepareProvider: true },
      signatureHelpProvider: { triggerCharacters: [" ", ","] },
      executeCommandProvider: { commands: ["asm.build"] },
      semanticTokensProvider: { legend: semanticTokensLegend, full: true },
    },
  };
});

connection.onInitialized(() => {
  if (hasDidChangeConfigurationDynamicRegistration) {
    connection.client.register(DidChangeConfigurationNotification.type, undefined).catch(() => {});
  }
  if (hasConfigurationCapability) void refreshConfiguration();
});

async function refreshConfiguration(): Promise<void> {
  try {
    const config: unknown = await connection.workspace.getConfiguration("asm");
    enqueueProjectEnvironment(mergeServerSettings(settings, config));
  } catch (error) {
    connection.console.warn(
      `Unable to read Assembly configuration: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

connection.onDidChangeConfiguration((params) => {
  if (hasConfigurationCapability) {
    void refreshConfiguration();
    return;
  }
  const changed = params.settings as { asm?: unknown } | undefined;
  enqueueProjectEnvironment(mergeServerSettings(settings, changed?.asm ?? changed));
});

function defaultOutputPath(file: string): string {
  const parsed = path.parse(file);
  const { loaded } = environmentController.current;
  const extension = loaded.environment.getTarget(loaded.target)!.defaultOutputExtension;
  return path.join(
    parsed.dir,
    `${parsed.name}${extension.startsWith(".") ? extension : `.${extension}`}`,
  );
}

function resolveOptionalBuildPath(
  configured: string | undefined,
  file: string,
): string | undefined {
  if (!configured) return undefined;
  return path.isAbsolute(configured)
    ? path.normalize(configured)
    : path.resolve(workspaceRoots[0] ?? path.dirname(file), configured);
}

function buildBinary(file: string, output?: string, baseImage?: string): BuildResult {
  try {
    const provider = new OverlayFileProvider(currentOverlays());
    const baseImagePath = resolveOptionalBuildPath(baseImage ?? settings.baseImage, file);
    const assembler = environmentController.createAssembler({
      ...(baseImagePath ? { baseImage: new Uint8Array(fs.readFileSync(baseImagePath)) } : {}),
      fileProvider: provider,
      collectSourceMetadata: false,
    });
    try {
      assembler.setIncludePaths([
        ...new Set([path.dirname(file), ...environmentController.current.loaded.includePaths]),
      ]);
      assembler.setCurrentFile(file);
      const source = provider.readTextFile(file);
      assembler.assembleProgram(assembler.buildProgramModel(source, file, 0));
      const bytes = assembler.getBinaryOutput();
      const outputPath =
        resolveOptionalBuildPath(output ?? settings.buildOutput, file) ?? defaultOutputPath(file);
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, Buffer.from(bytes));
      return { ok: true, outputPath, bytes: bytes.length };
    } finally {
      assembler.dispose();
    }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

connection.onExecuteCommand((params) => {
  if (params.command !== "asm.build") return undefined;
  const args = (params.arguments ?? []) as Array<string | undefined>;
  const uriOrPath = args[0];
  if (!uriOrPath) return { ok: false, message: "No file provided to build." } satisfies BuildResult;
  const file = uriOrPath.startsWith("file:") ? uriToPath(uriOrPath) : uriOrPath;
  const output = args[1]?.startsWith("file:") ? uriToPath(args[1]) : args[1];
  const baseImage = args[2]?.startsWith("file:") ? uriToPath(args[2]) : args[2];
  return buildBinary(file, output, baseImage);
});

connection.onRequest("asm/projectMetadata", async () => {
  await configurationQueue;
  const { loaded, index: activeIndex } = environmentController.current;
  return {
    activeTarget: loaded.target,
    activeArchitecture: loaded.architecture,
    targets: activeIndex.toolingCatalog.getTargets(),
    architectures: activeIndex.toolingCatalog.getArchitectures(),
    plugins: loaded.configuration.plugins.map((plugin) => ({
      id: plugin.pluginId,
      module: plugin.module,
      bundled: plugin.bundled,
    })),
  };
});

connection.onDidChangeWatchedFiles((params) => {
  let reload = false;
  for (const change of params.changes) {
    const file = uriToPath(change.uri);
    if (path.resolve(file) === resolveAgainstWorkspace(settings.configFile ?? "asm.config.json")) {
      reload = true;
    } else {
      index.invalidateFile(file);
    }
  }
  if (reload) enqueueProjectEnvironment(settings);
  else scheduleReindex();
});

documents.onDidOpen((event) => {
  index.openDocument(uriToPath(event.document.uri), event.document.getText());
  publishAllDiagnostics();
});

documents.onDidChangeContent((event) => {
  index.updateDocument(uriToPath(event.document.uri), event.document.getText());
  scheduleReindex();
});

documents.onDidClose((event) => {
  index.closeDocument(uriToPath(event.document.uri));
  void connection.sendDiagnostics({ uri: event.document.uri, diagnostics: [] });
});

connection.onCompletion(() => completionsFor(index));
connection.onHover((params) => {
  const document = documents.get(params.textDocument.uri);
  return document
    ? hoverFor(index, uriToPath(params.textDocument.uri), params.position, document.getText())
    : null;
});
connection.onDefinition((params) =>
  definitionFor(index, uriToPath(params.textDocument.uri), params.position),
);
connection.onReferences((params) =>
  referencesFor(
    index,
    uriToPath(params.textDocument.uri),
    params.position,
    params.context.includeDeclaration,
  ),
);
connection.onDocumentSymbol((params) =>
  documentSymbolsFor(index, uriToPath(params.textDocument.uri)),
);
connection.onWorkspaceSymbol((params): SymbolInformation[] => {
  const query = params.query.toLowerCase();
  return index.getAnalyzedFiles().flatMap((file) =>
    documentSymbolsFor(index, file)
      .filter((symbol) => !query || symbol.name.toLowerCase().includes(query))
      .map((symbol) =>
        SymbolInformation.create(
          symbol.name,
          symbol.kind,
          symbol.selectionRange,
          pathToUri(file),
          symbol.detail,
        ),
      ),
  );
});
connection.onSignatureHelp((params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return null;
  const lineText = document.getText({
    start: { line: params.position.line, character: 0 },
    end: params.position,
  });
  return signatureHelpFor(lineText, index);
});
connection.onPrepareRename((params) =>
  prepareRenameFor(index, uriToPath(params.textDocument.uri), params.position),
);
connection.onRenameRequest((params) =>
  renameEditsFor(index, uriToPath(params.textDocument.uri), params.position, params.newName),
);
connection.languages.semanticTokens.on((params) =>
  semanticTokensFor(index, uriToPath(params.textDocument.uri)),
);
connection.onShutdown(() => environmentController.dispose());

documents.listen(connection);
connection.listen();

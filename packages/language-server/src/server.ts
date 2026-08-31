/** Generic assembly language-server transport and LSP 3.18 request routing. */
import fs from "node:fs";
import path from "node:path";

import plugin65xx from "@uttori/asm-plugin-65xx";
import snesPlugin, { SNES_TARGET_ID } from "@uttori/asm-plugin-snes";
import {
  discoverProjectConfigurationPath,
  PROJECT_CONFIG_FILENAME,
  validateProjectConfiguration,
} from "@uttori/asm-plugin-loader-node";
import type { AssemblerPlugin } from "@uttori/asm-core/plugin";
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
import { emptyOutputMessage, formatElapsed, resolveBuildEntry } from "./build.js";
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
  projectOutlineFor,
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
  bundledPlugins: new Map<string, AssemblerPlugin>([
    ["@uttori/asm-plugin-snes", snesPlugin],
    ["@uttori/asm-plugin-65xx", plugin65xx],
  ]),
  activateBundledPlugins: true,
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
let clientInitialized = false;
let configurationDiagnostic: { uri: string; diagnostic: Diagnostic; message: string } | undefined;
let configurationQueue = Promise.resolve();

const workspaceRoot = (): string => workspaceRoots[0] ?? process.cwd();

function resolveAgainstWorkspace(value: string): string {
  return path.isAbsolute(value) ? path.normalize(value) : path.resolve(workspaceRoot(), value);
}

function isProjectConfigFile(file: string): boolean {
  const resolved = path.resolve(file);
  if (settings.configFile && resolved === resolveAgainstWorkspace(settings.configFile)) {
    return true;
  }
  return path.basename(file) === PROJECT_CONFIG_FILENAME;
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
  if (!value || typeof value !== "object") return applyConfigFileDefaults(previous);
  const next = value as Record<string, unknown>;
  const has = (key: string): boolean => Object.prototype.hasOwnProperty.call(next, key);
  return applyConfigFileDefaults({
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
  });
}

function applyConfigFileDefaults(next: ServerSettings): ServerSettings {
  const discovered = discoverProjectConfigurationPath(workspaceRoot(), next.configFile);
  if (!discovered || !fs.existsSync(discovered)) {
    return next;
  }
  const relativeConfig = path.relative(workspaceRoot(), discovered) || path.basename(discovered);
  let extras: ReturnType<typeof validateProjectConfiguration> = {};
  try {
    extras = validateProjectConfiguration(JSON.parse(fs.readFileSync(discovered, "utf8")));
  } catch {
    return { ...next, configFile: next.configFile ?? relativeConfig };
  }
  return {
    ...next,
    configFile: next.configFile ?? relativeConfig,
    target: next.target ?? extras.target,
    architecture: next.architecture ?? extras.architecture,
    entryPoints: next.entryPoints.length > 0 ? next.entryPoints : (extras.entryPoints ?? []),
    includePaths: next.includePaths.length > 0 ? next.includePaths : (extras.includePaths ?? []),
    buildOutput: next.buildOutput ?? extras.buildOutput,
    baseImage: next.baseImage ?? extras.baseImage,
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
  return pathToUri(resolveAgainstWorkspace(next.configFile ?? PROJECT_CONFIG_FILENAME));
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
    notifyIndexUpdated();
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
    connection.console.info("Full workspace reindex starting");
    index.reindex();
    const status = index.getStatus();
    connection.console.info(
      `Full workspace reindex finished in ${status.lastReindexDurationMs ?? 0}ms ` +
        `(roots=${status.lastReindexRootCount}, analyzed=${status.lastReindexAnalyzedRoots}, cached=${status.lastReindexCachedRoots}, ` +
        `files=${status.fileCount}, symbols=${status.symbolCount}, errors=${status.errorCount})`,
    );
    connection.console.info(
      `Index contains ${status.referenceCount} references across ${status.fileCount} files`,
    );
    publishAllDiagnostics();
    void connection.languages.semanticTokens.refresh();
    notifyIndexUpdated();
  }, 500);
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

function notifyIndexUpdated(): void {
  if (!index || !clientInitialized) return;
  void connection.sendNotification("asm/indexUpdated", index.getStatus());
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
      // Do not advertise `asm.build` here. The VS Code client registers that
      // command for the palette/UI; vscode-languageclient would also register
      // advertised executeCommandProvider IDs and throw "already exists".
      semanticTokensProvider: { legend: semanticTokensLegend, full: true },
    },
  };
});

connection.onInitialized(() => {
  clientInitialized = true;
  if (hasDidChangeConfigurationDynamicRegistration) {
    connection.client.register(DidChangeConfigurationNotification.type, undefined).catch(() => {});
  }
  if (hasConfigurationCapability) void refreshConfiguration();
  notifyIndexUpdated();
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

function buildBinary(
  requestedFile: string | undefined,
  output?: string,
  baseImage?: string,
): BuildResult {
  const startedAt = Date.now();
  const log = connection.console;
  try {
    const resolved = resolveBuildEntry(requestedFile, settings.entryPoints, workspaceRoot());
    const file = resolved.file;
    log.info("Build Binary starting");
    log.info(`  requested: ${requestedFile ?? "(none)"}`);
    log.info(`  assembling: ${file}`);
    log.info(`  reason: ${resolved.reason}`);
    log.info(`  workspace: ${workspaceRoot()}`);
    log.info(`  target: ${environmentController.current.loaded.target}`);
    log.info(
      `  architecture: ${environmentController.current.loaded.architecture || "(target default)"}`,
    );
    log.info(
      `  includePaths: ${environmentController.current.loaded.includePaths.join(", ") || "(none)"}`,
    );
    log.info(`  entryPoints: ${settings.entryPoints.join(", ") || "(none)"}`);
    log.info(`  configFile: ${settings.configFile || "(none)"}`);
    log.info(`  buildOutput setting: ${output ?? settings.buildOutput ?? "(default extension)"}`);
    log.info(`  baseImage setting: ${baseImage ?? settings.baseImage ?? "(none)"}`);

    if (!fs.existsSync(file)) {
      const message = `Entry file does not exist: ${file}`;
      log.error(message);
      return { ok: false, message };
    }

    const provider = new OverlayFileProvider(currentOverlays());
    const baseImagePath = resolveOptionalBuildPath(baseImage ?? settings.baseImage, file);
    if (baseImagePath) {
      log.info(`  base image path: ${baseImagePath}`);
      if (!fs.existsSync(baseImagePath)) {
        const message = `Base image does not exist: ${baseImagePath}`;
        log.error(message);
        return { ok: false, message };
      }
    }
    const assembler = environmentController.createAssembler({
      ...(baseImagePath ? { baseImage: new Uint8Array(fs.readFileSync(baseImagePath)) } : {}),
      fileProvider: provider,
      collectSourceMetadata: false,
    });
    try {
      const includePaths = [
        ...new Set([path.dirname(file), ...environmentController.current.loaded.includePaths]),
      ];
      log.info(`  assembler includePaths: ${includePaths.join(", ")}`);
      assembler.setIncludePaths(includePaths);
      assembler.setCurrentFile(file);
      const source = provider.readTextFile(file);
      log.info(
        `  source: ${source.length} chars from ${provider.overlay.has(file) ? "editor buffer" : "disk"}`,
      );
      const programStarted = Date.now();
      const program = assembler.buildProgramModel(source, file, 0);
      log.info(`  program model: ${program.nodes.length} nodes (${formatElapsed(programStarted)})`);
      const assembleStarted = Date.now();
      assembler.assembleProgram(program);
      log.info(`  assembleProgram finished (${formatElapsed(assembleStarted)})`);
      const bytes = assembler.getBinaryOutput();
      log.info(`  emitted ${bytes.length} bytes (output buffer ${assembler.outputBytes.length})`);
      if (bytes.length === 0) {
        const message = emptyOutputMessage(file, resolved.usedEntryPoint);
        log.error(message);
        return { ok: false, message };
      }
      const outputPath =
        resolveOptionalBuildPath(output ?? settings.buildOutput, file) ?? defaultOutputPath(file);
      log.info(`  writing ${bytes.length} bytes → ${outputPath}`);
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, Buffer.from(bytes));
      log.info(
        `Build Binary succeeded in ${formatElapsed(startedAt)}: ${bytes.length} bytes → ${outputPath}`,
      );
      return { ok: true, outputPath, bytes: bytes.length };
    } finally {
      assembler.dispose();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error(`Build Binary failed in ${formatElapsed(startedAt)}: ${message}`);
    if (error instanceof Error && error.stack) {
      log.error(error.stack);
    }
    return { ok: false, message };
  }
}

/**
 * Converts an executeCommand argument to a filesystem path.
 * @param {string | undefined} value URI or path from the client.
 * @returns {string | undefined} A filesystem path, or undefined when omitted.
 */
function argumentPath(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value.startsWith("file:") ? uriToPath(value) : value;
}

connection.onExecuteCommand(async (params) => {
  if (params.command !== "asm.build") return undefined;
  await configurationQueue;
  const args = (params.arguments ?? []) as Array<string | undefined>;
  return buildBinary(argumentPath(args[0]), argumentPath(args[1]), argumentPath(args[2]));
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

connection.onRequest("asm/projectOutline", async () => {
  await configurationQueue;
  return index ? projectOutlineFor(index) : [];
});

connection.onRequest("asm/status", async () => {
  await configurationQueue;
  if (!index) {
    return {
      fileCount: 0,
      symbolCount: 0,
      referenceCount: 0,
      errorCount: 0,
      entryPoints: settings.entryPoints,
      includePaths: settings.includePaths,
      lastReindexRootCount: 0,
      lastReindexCachedRoots: 0,
      lastReindexAnalyzedRoots: 0,
      configFile: settings.configFile,
      target: settings.target,
      architecture: settings.architecture,
      buildOutput: settings.buildOutput,
      baseImage: settings.baseImage,
    };
  }
  return {
    ...index.getStatus(),
    configFile: settings.configFile,
    target: settings.target,
    architecture: settings.architecture,
    buildOutput: settings.buildOutput,
    baseImage: settings.baseImage,
    entryPoints: settings.entryPoints,
    includePaths: settings.includePaths.length > 0 ? settings.includePaths : index.includePaths,
  };
});

connection.onDidChangeWatchedFiles((params) => {
  let reload = false;
  for (const change of params.changes) {
    const file = uriToPath(change.uri);
    if (isProjectConfigFile(file)) {
      reload = true;
    } else {
      index.invalidateFile(file);
    }
  }
  if (reload) enqueueProjectEnvironment(settings);
  else scheduleReindex();
});

documents.onDidOpen((event) => {
  const file = uriToPath(event.document.uri);
  index.openDocument(file, event.document.getText());
  publishAllDiagnostics();
  if (index.isFileDirtyOrUncovered(file)) {
    scheduleReindex();
  }
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

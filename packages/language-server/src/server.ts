/**
 * Assembly language-server entry point and LSP 3.18 request routing.
 * Importing this module creates the transport, registers handlers, and starts listening.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { CRC32 } from "@uttori/asm-core";
import { canonicalDebugMapJson, createDebugMap } from "@uttori/asm-core/debug-map";
import type { AssemblerPlugin } from "@uttori/asm-core/plugin";
import {
  findManagedSourceFile,
  sourceGenerationIdentity,
  assertSourceGeneration,
} from "@uttori/asm-disassembler";
import plugin65xx from "@uttori/asm-plugin-65xx";
import {
  discoverProjectConfigurationPath,
  PROJECT_CONFIG_FILENAME,
  validateProjectConfiguration,
} from "@uttori/asm-plugin-loader-node";
import snesPlugin, { SNES_TARGET_ID } from "@uttori/asm-plugin-snes";
import { TextDocument } from "vscode-languageserver-textdocument";
import {
  createConnection,
  type CancellationToken,
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

import {
  AssetPreviewService,
  type AssetPreviewRequest,
  type AssetPreviewResponse,
} from "./asset-preview-service.js";
import {
  commitBuildArtifactPair,
  emptyOutputMessage,
  formatElapsed,
  resolveBuildEntry,
} from "./build.js";
import { OverlayFileProvider, type WorkspaceIndex } from "./core.js";
import {
  ProjectEnvironmentController,
  type PluginModuleSetting,
  type ProjectEnvironmentSettings,
} from "./project-environment.js";
import {
  assetCompletionsFor,
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

/** Process-wide LSP transport, also used to forward logs and custom index notifications. */
const connection = createConnection(ProposedFeatures.all);
/** Open editor buffers; their current text overrides disk contents during analysis and builds. */
const documents = new TextDocuments(TextDocument);
/** Conversion media stays in a bounded worker-owned cache. */
const assetPreviews = new AssetPreviewService();
/** Owns the plugin lifecycle and keeps build and analysis environments in sync. */
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

/**
 * Normalized asm settings from the editor, optionally filled from the project config.
 * Editor paths may be workspace-relative; paths taken from config defaults are made absolute.
 */
export interface ServerSettings {
  /** Explicit config path; omitted to discover uttori-asm.config.json from the workspace root. */
  configFile?: string;
  /** Additional plugin requests validated during environment loading; empty means none. */
  plugins: readonly PluginModuleSetting[];
  /** Target ID or alias overriding the config/default target when supplied by the editor. */
  target?: string;
  /** Architecture override; otherwise resolved from the config or selected target. */
  architecture?: string;
  /** Ordered assembly roots; an empty editor list permits config defaults or open-document roots. */
  entryPoints: readonly string[];
  /** Include search roots; an empty editor list permits config/loader defaults. */
  includePaths: readonly string[];
  /** Binary destination override; absent to derive the name and extension from the entry/target. */
  buildOutput?: string;
  /** Optional existing binary whose bytes seed assembly output. */
  baseImage?: string;
  /** Whether the client permits loading workspace plugin configuration; defaults to false. */
  workspaceTrusted: boolean;
}

/** Initial editor settings before project discovery or a client configuration response. */
const defaultSettings: ServerSettings = {
  plugins: [],
  entryPoints: [],
  includePaths: [],
  workspaceTrusted: false,
};

/** Custom asm.build response: successful artifact metadata, or a failure message. */
type BuildResult = {
  /** True only after a nonempty binary and its matching debug map have been committed. */
  ok: boolean;
  /** Absolute committed binary path, present on success. */
  outputPath?: string;
  /** Emitted byte count, retained alongside outputSize for build-command clients. */
  bytes?: number;
  /** Committed binary size in bytes, used with outputSha256 to identify the artifact. */
  outputSize?: number;
  /** SHA-256 hex digest of the exact emitted binary. */
  outputSha256?: string;
  /** Absolute path to the committed .debug.json sidecar. */
  debugMapPath?: string;
  /** Canonical debug-map fingerprint used to detect mismatched debugger metadata. */
  debugMapFingerprint?: string;
  /** Resolved target ID recorded in the debug map. */
  target?: string;
  /** Resolved architecture used for assembly. */
  architecture?: string;
  /** Whether binary contents differed from disk before the commit, including an absent file. */
  outputChanged?: boolean;
  /** Whether sidecar contents differed from disk before the commit, including an absent file. */
  debugMapChanged?: boolean;
  /** Human-readable failure reason when ok is false; failures are also written to the LSP log. */
  message?: string;
};

/** Latest requested settings, including a rejected configuration while the prior index stays live. */
let settings: ServerSettings = defaultSettings;
/** Editor overrides kept separate so rereading config files can replace their previous defaults. */
let editorSettings: ServerSettings = defaultSettings;
/** Current analysis index, assigned during initialization and after successful environment swaps. */
let index: WorkspaceIndex;
/** Client workspace folders as paths; the first is the base for this server's project configuration. */
let workspaceRoots: string[] = [];
/** Whether settings can be pulled with workspace/configuration rather than pushed by the client. */
let hasConfigurationCapability = false;
/** Whether the client permits dynamic subscription to workspace setting changes. */
let hasDidChangeConfigurationDynamicRegistration = false;
/** Pending 500 ms edit-burst debounce; cleared when reindexing starts. */
let reindexTimer: NodeJS.Timeout | undefined;
/** Prevents custom notifications before the client's initialized notification. */
let clientInitialized = false;
/** Configuration warning/error published separately from source analysis diagnostics. */
let configurationDiagnostic:
  | {
      /** Config file URI receiving the diagnostic, even when the file is not open. */
      uri: string;
      /** LSP payload anchored at the start of the config file. */
      diagnostic: Diagnostic;
      /** Original configuration failure or trust-warning text. */
      message: string;
    }
  | undefined;
/** Serializes async plugin replacement; each queued task absorbs its reported failure. */
let configurationQueue = Promise.resolve();

/**
 * Selects the project base used by discovery and workspace-relative settings.
 * @returns {string} The first workspace folder, or the process cwd for folderless clients.
 */
const workspaceRoot = (): string => workspaceRoots[0] ?? process.cwd();

/**
 * Normalizes an absolute path or resolves a relative setting against the project base.
 * @param {string} value Filesystem path from configuration, not a file URI.
 * @returns {string} Absolute normalized path.
 */
function resolveAgainstWorkspace(value: string): string {
  return path.isAbsolute(value) ? path.normalize(value) : path.resolve(workspaceRoot(), value);
}

/**
 * Detects watched config changes that require a plugin environment reload rather than reindexing.
 * @param {string} file Changed filesystem path.
 * @returns {boolean} Whether it matches the explicit config or the conventional config basename.
 */
function isProjectConfigFile(file: string): boolean {
  const resolved = path.resolve(file);
  if (settings.configFile && resolved === resolveAgainstWorkspace(settings.configFile)) {
    return true;
  }
  return path.basename(file) === PROJECT_CONFIG_FILENAME;
}

/**
 * Accepts nonblank settings strings without altering their original whitespace.
 * @param {unknown} value Untrusted client configuration value.
 * @returns {string | undefined} The original string, or undefined for blank/non-string input.
 */
function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

/**
 * Checks a settings list without trimming, filtering, or copying its entries.
 * @param {unknown} value Untrusted client configuration value.
 * @returns {readonly string[] | undefined} The original array when every entry is a string, including an empty array.
 */
function stringArray(value: unknown): readonly string[] | undefined {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string")
    ? value
    : undefined;
}

/**
 * Applies a partial editor update without mutating previous settings. Omitted properties persist;
 * explicitly blank or invalid optional strings clear overrides so file defaults can apply again.
 * Invalid arrays/booleans retain prior values; plugin entries are validated by the loader later.
 * @param {ServerSettings} previous Previously normalized editor settings.
 * @param {unknown} value The asm section from initialization options or a configuration update.
 * @returns {ServerSettings} Merged settings, or previous itself when value is not an object.
 */
export function mergeServerSettings(previous: ServerSettings, value: unknown): ServerSettings {
  if (!value || typeof value !== "object") {
    return previous;
  }
  const next = value as Record<string, unknown>;
  /**
   * Distinguishes an explicit reset from an omitted editor override.
   * @param {string} key Optional setting being merged.
   * @returns {boolean} Whether the update owns the property, even when its value is undefined.
   */
  const has = (key: string): boolean => Object.prototype.hasOwnProperty.call(next, key);
  return {
    configFile: has("configFile") ? stringValue(next.configFile) : previous.configFile,
    plugins: Array.isArray(next.plugins)
      ? (next.plugins as readonly PluginModuleSetting[])
      : previous.plugins,
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

/**
 * Fills absent scalar settings and empty path lists from discovered JSON configuration.
 * Reads data only; plugin activation and trust enforcement happen in the environment controller.
 * Invalid JSON/config is left for the loader to diagnose while retaining its discovered path.
 * @param {ServerSettings} next Editor settings before project-file defaults are applied.
 * @returns {ServerSettings} Effective settings with file-derived paths resolved beside the config.
 */
function applyConfigFileDefaults(next: ServerSettings): ServerSettings {
  const discovered = discoverProjectConfigurationPath(workspaceRoot(), next.configFile);
  if (!discovered || !fs.existsSync(discovered)) {
    return next;
  }
  const relativeConfig = path.relative(workspaceRoot(), discovered) || path.basename(discovered);
  /**
   * Preserves config-relative path semantics when defaults are later passed as host overrides.
   * @param {string} value Path read from the project file.
   * @returns {string} Absolute path based on the config's parent directory.
   */
  const relativeToConfig = (value: string): string => path.resolve(path.dirname(discovered), value);
  let extras: ReturnType<typeof validateProjectConfiguration> = {};
  try {
    extras = validateProjectConfiguration(JSON.parse(fs.readFileSync(discovered, "utf8")));
  } catch {
    // Preserve discovery even for invalid contents so the loader can publish the actual error.
    return { ...next, configFile: next.configFile ?? relativeConfig };
  }
  return {
    ...next,
    configFile: next.configFile ?? relativeConfig,
    target: next.target ?? extras.target,
    architecture: next.architecture ?? extras.architecture,
    entryPoints:
      next.entryPoints.length > 0
        ? next.entryPoints
        : (extras.entryPoints ?? []).map(relativeToConfig),
    includePaths:
      next.includePaths.length > 0
        ? next.includePaths
        : (extras.includePaths ?? []).map(relativeToConfig),
    buildOutput:
      next.buildOutput ?? (extras.buildOutput ? relativeToConfig(extras.buildOutput) : undefined),
    baseImage:
      next.baseImage ?? (extras.baseImage ? relativeToConfig(extras.baseImage) : undefined),
  };
}

/**
 * Projects server settings into controller inputs, resolving analysis roots for the index.
 * @param {ServerSettings} next Effective settings after config defaults have been applied.
 * @returns {ProjectEnvironmentSettings} Loader/index settings; empty include lists defer to loader defaults.
 */
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

/**
 * Snapshots open buffers so builds and replacement indexes consume unsaved editor text.
 * @returns {Map<string, string>} A new map of absolute filesystem paths to current document text.
 */
function currentOverlays(): Map<string, string> {
  return new Map(documents.all().map((document) => [uriToPath(document.uri), document.getText()]));
}

/**
 * Replaces or clears the configuration diagnostic and clears any previously targeted file URI.
 * The new diagnostic is stored for publishAllDiagnostics rather than sent immediately.
 * @param {ServerSettings} next Settings identifying the config file to annotate.
 * @param {string} message Failure/trust text; omitted or empty to clear the stored diagnostic.
 * @param {DiagnosticSeverity} severity Error by default; trust notices use Warning.
 */
function setConfigurationDiagnostic(
  next: ServerSettings,
  message?: string,
  severity: DiagnosticSeverity = DiagnosticSeverity.Error,
): void {
  const previousUri = configurationDiagnostic?.uri;
  configurationDiagnostic = message
    ? {
        uri: pathToUri(resolveAgainstWorkspace(next.configFile ?? PROJECT_CONFIG_FILENAME)),
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

/**
 * Installs a configured environment, then publishes its diagnostics and index status.
 * Failures keep the old index but retain requested settings and publish a configuration error.
 * @param {ServerSettings} next Effective settings to load.
 * @returns {Promise<void>} Resolves after successful replacement and publication requests.
 * @throws {Error} The environment cannot be replaced; the failure has already been reported.
 */
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

/**
 * Waits for the prior configuration task before replacing plugins, absorbing reported failures
 * so one bad configuration does not leave all later tasks chained to a rejected promise.
 * @param {Promise<void>} previous Prior queue task, which normally fulfills even after load failure.
 * @param {ServerSettings} next Effective settings captured for this replacement.
 * @returns {Promise<void>} A fulfilled task once replacement or its failure handling finishes.
 */
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

/**
 * Appends a replacement without blocking the notification handler or coalescing queued settings.
 * @param {ServerSettings} next Effective settings to apply after earlier replacements finish.
 */
function enqueueProjectEnvironment(next: ServerSettings): void {
  configurationQueue = applyQueuedEnvironment(configurationQueue, next);
}

/**
 * Restarts the 500 ms debounce for a full workspace reindex using the index active when it fires.
 * Completion republishes diagnostics/status and asks the client to refresh semantic tokens.
 */
function scheduleReindex(): void {
  if (reindexTimer) {
    clearTimeout(reindexTimer);
  }
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

/**
 * Sends source diagnostics for every open document, then any stored configuration diagnostic.
 * Has no effect until an index exists; notification promises are intentionally not awaited.
 */
function publishAllDiagnostics(): void {
  if (!index) {
    return;
  }
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

/** Sends asm/indexUpdated status only after both the index and the client are initialized. */
function notifyIndexUpdated(): void {
  if (!index || !clientInitialized) {
    return;
  }
  void connection.sendNotification("asm/indexUpdated", index.getStatus());
}

connection.onInitialize(async (params: InitializeParams): Promise<InitializeResult> => {
  hasConfigurationCapability = Boolean(params.capabilities.workspace?.configuration);
  hasDidChangeConfigurationDynamicRegistration = Boolean(
    params.capabilities.workspace?.didChangeConfiguration?.dynamicRegistration,
  );
  workspaceRoots = (params.workspaceFolders ?? []).map((folder) => uriToPath(folder.uri));
  if (workspaceRoots.length === 0 && params.rootUri) {
    workspaceRoots = [uriToPath(params.rootUri)];
  }
  editorSettings = mergeServerSettings(defaultSettings, params.initializationOptions);
  const requested = applyConfigFileDefaults(editorSettings);
  try {
    await replaceProjectEnvironment(requested);
  } catch {
    settings = requested;
    // Initialization must still provide editing features when project plugins fail to load.
    // Keep the reported config error while bringing up the bundled, untrusted fallback.
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
      // command for the palette/UI. Vscode-languageclient would also register
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
  if (hasConfigurationCapability) {
    void refreshConfiguration();
  }
  notifyIndexUpdated();
});

/**
 * Pulls the client's asm section and queues an environment replacement using current file defaults.
 * @returns {Promise<void>} Resolves once the update is queued, or after a settings-read failure is logged.
 */
async function refreshConfiguration(): Promise<void> {
  try {
    const config: unknown = await connection.workspace.getConfiguration("asm");
    editorSettings = mergeServerSettings(editorSettings, config);
    enqueueProjectEnvironment(applyConfigFileDefaults(editorSettings));
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
  editorSettings = mergeServerSettings(editorSettings, changed?.asm ?? changed);
  enqueueProjectEnvironment(applyConfigFileDefaults(editorSettings));
});

/**
 * Derives a binary filename beside the selected entry using the active target's output extension.
 * @param {string} file Absolute assembly entry path.
 * @returns {string} Output path with the source extension replaced by the target extension.
 */
function defaultOutputPath(file: string): string {
  const parsed = path.parse(file);
  const { loaded } = environmentController.current;
  const extension = loaded.environment.getTarget(loaded.target)!.defaultOutputExtension;
  return path.join(
    parsed.dir,
    `${parsed.name}${extension.startsWith(".") ? extension : `.${extension}`}`,
  );
}

/**
 * Resolves an output/base-image override against the workspace, or the entry directory without one.
 * @param {string | undefined} configured Filesystem path after any client URI conversion.
 * @param {string} file Absolute selected entry path used for the folderless fallback.
 * @returns {string | undefined} Absolute path, or undefined when the override is absent/empty.
 */
function resolveOptionalBuildPath(
  configured: string | undefined,
  file: string,
): string | undefined {
  if (!configured) {
    return undefined;
  }
  return path.isAbsolute(configured)
    ? path.normalize(configured)
    : path.resolve(workspaceRoots[0] ?? path.dirname(file), configured);
}

/**
 * Synchronously assembles the selected project entry with current editor overlays and commits
 * its binary/debug-map pair. The caller must await configurationQueue before invoking it.
 * Logs progress, disposes the build session, and returns failures as data rather than throwing.
 * @param {string | undefined} requestedFile Active editor path; configured entry points take precedence.
 * @param {string} output Binary destination overriding settings; omitted to use settings/target defaults.
 * @param {string} baseImage Base binary overriding settings; omitted to use the configured base image.
 * @returns {BuildResult} Committed artifact metadata, or a logged failure with a user-facing message.
 */
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
      collectSourceMetadata: true,
    });
    try {
      const includePaths = [
        ...new Set([path.dirname(file), ...environmentController.current.loaded.includePaths]),
      ];
      log.info(`  assembler includePaths: ${includePaths.join(", ")}`);
      assembler.setIncludePaths(includePaths);
      assembler.setCurrentFile(file);
      const managedGeneration = findManagedSourceFile(file);
      const generationIdentity = managedGeneration
        ? sourceGenerationIdentity(managedGeneration.directory)
        : undefined;
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
      if (managedGeneration && generationIdentity) {
        assertSourceGeneration(managedGeneration.directory, generationIdentity);
      }
      const bytes = assembler.getBinaryOutput();
      log.info(`  emitted ${bytes.length} bytes (output buffer ${assembler.outputBytes.length})`);
      if (bytes.length === 0) {
        const message = emptyOutputMessage(file, resolved.usedEntryPoint);
        log.error(message);
        return { ok: false, message };
      }
      const outputPath =
        resolveOptionalBuildPath(output ?? settings.buildOutput, file) ?? defaultOutputPath(file);
      const { loaded } = environmentController.current;
      // AddressToLineMapping records disk identities by default. Editor builds may use unsaved
      // overlays, so replace those identities with the exact bytes the assembler consumed.
      if (loaded.configuration.configFile) {
        provider.readFiles.add(loaded.configuration.configFile);
      }
      // Definition-only includes and incbin inputs can change emitted bytes without owning ranges.
      // Include them in the fingerprinted snapshot so editor facts cannot outlive their dependencies.
      for (const dependency of provider.readFiles) {
        assembler.addressToLineMapping.getFileIndex(dependency);
      }
      if (baseImagePath) {
        assembler.addressToLineMapping.getFileIndex(baseImagePath);
      }
      assembler.addressToLineMapping.fileList = assembler.addressToLineMapping.fileList.map(
        (entry) => {
          const sourceBytes = provider.readFile(entry.name);
          return {
            name: entry.name,
            size: sourceBytes.length,
            crc: CRC32.compute(sourceBytes),
            sha256: createHash("sha256").update(sourceBytes).digest("hex"),
          };
        },
      );
      const debugMap = createDebugMap({
        target: loaded.target,
        output: bytes,
        mapping: assembler.addressToLineMapping,
        sourceRoot: workspaceRoot(),
      });
      if (managedGeneration && generationIdentity) {
        assertSourceGeneration(managedGeneration.directory, generationIdentity);
      }
      const committed = commitBuildArtifactPair(outputPath, bytes, canonicalDebugMapJson(debugMap));
      log.info(`  writing ${bytes.length} bytes → ${committed.outputPath}`);
      log.info(`  debug map → ${committed.debugMapPath}`);
      log.info(
        `Build Binary succeeded in ${formatElapsed(startedAt)}: ${bytes.length} bytes → ${committed.outputPath}`,
      );
      return {
        ok: true,
        outputPath: committed.outputPath,
        bytes: bytes.length,
        outputSize: bytes.length,
        outputSha256: debugMap.output.sha256,
        debugMapPath: committed.debugMapPath,
        debugMapFingerprint: debugMap.fingerprint.value,
        target: debugMap.target,
        architecture: loaded.architecture,
        outputChanged: committed.outputChanged,
        debugMapChanged: committed.debugMapChanged,
      };
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
  if (!value) {
    return undefined;
  }
  return value.startsWith("file:") ? uriToPath(value) : value;
}

connection.onExecuteCommand(async (params) => {
  if (params.command !== "asm.build") {
    return undefined;
  }
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

connection.onRequest<AssetPreviewResponse, void>(
  "asm/assetPreview",
  async (request: AssetPreviewRequest, token: CancellationToken): Promise<AssetPreviewResponse> => {
    await configurationQueue;
    const document = documents.get(request.uri);
    if (!document || document.version !== request.version || !request.uri.startsWith("file:")) {
      return { ok: false, message: "Asset preview source is no longer current." };
    }
    const cancellation = new AbortController();
    // Explicit preview commands may arrive without a cancellation token.
    const subscription = token?.onCancellationRequested(() => cancellation.abort());
    try {
      const result = await assetPreviews.preview(
        index,
        document.getText(),
        request,
        cancellation.signal,
      );
      if (document.version !== documents.get(request.uri)?.version || cancellation.signal.aborted) {
        return { ok: false, message: "Asset preview source changed during conversion." };
      }
      return result;
    } finally {
      subscription?.dispose();
    }
  },
);

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
  assetPreviews.clear();
  let reload = false;
  for (const change of params.changes) {
    const file = uriToPath(change.uri);
    if (isProjectConfigFile(file)) {
      reload = true;
    } else {
      index.invalidateFile(file);
    }
  }
  if (reload) {
    enqueueProjectEnvironment(applyConfigFileDefaults(editorSettings));
  } else {
    scheduleReindex();
  }
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

connection.onCompletion((params) => {
  const document = documents.get(params.textDocument.uri);
  return document
    ? (assetCompletionsFor(index, document.getText(), params.position) ?? completionsFor(index))
    : completionsFor(index);
});
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
  if (!document) {
    return null;
  }
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

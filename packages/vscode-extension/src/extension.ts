/**
 * VS Code extension-host entry point and language-client integration.
 * @see https://code.visualstudio.com/api/get-started/extension-anatomy#extension-entry-file
 * @see https://code.visualstudio.com/api/language-extensions/language-server-extension-guide#language-client
 */
import * as path from "node:path";

import {
  commands,
  ConfigurationTarget,
  ExtensionMode,
  Hover,
  StatusBarAlignment,
  Uri,
  debug as vscodeDebug,
  window,
  workspace,
  type Disposable,
  type ExtensionContext,
  type LogOutputChannel,
  type StatusBarItem,
  type TextDocument,
} from "vscode";
import {
  ExecuteCommandRequest,
  LanguageClient,
  Trace,
  TransportKind,
  type LanguageClientOptions,
  type ServerOptions,
} from "vscode-languageclient/node";

import {
  AnalysisAnnotationController,
  TOGGLE_ANALYSIS_ANNOTATIONS_COMMAND,
} from "./analysis/annotation-controller.js";
import { AnalysisCoverageProvider } from "./analysis/coverage-tree.js";
import { AnalysisGraphProvider } from "./analysis/graph-tree.js";
import { navigateToAnalysisLocation } from "./analysis/navigation.js";
import { AnalysisProjectEditor } from "./analysis/project-editor.js";
import { AnalysisSourcesProvider } from "./analysis/sources-tree.js";
import { initializeAnalysisWorker } from "./analysis/worker-client.js";
import { AssetPreviewController } from "./asset-preview-controller.js";
import {
  configureEmulatorRuntime,
  configuredEmulatorRuntime,
  liveDebugConfiguration,
  registerDebugging,
  type BuiltDebugArtifacts,
} from "./debug/session.js";
import { registerDisassemblyMaintenance } from "./disassembly/maintenance.js";
import { DisassemblyPanelProvider } from "./disassembly/panel.js";
import { ProjectOutlineProvider } from "./project/outline-tree.js";
import { ProjectPanelProvider } from "./project/panel.js";
import { registerProjectWizards } from "./project/wizard.js";

/**
 * The result of a build request returned by the language server.
 * @see https://code.visualstudio.com/api/extension-guides/command#using-commands
 * @see https://code.visualstudio.com/api/language-extensions/language-server-extension-guide#language-client
 */
type BuildResult = {
  ok: boolean;
  outputPath?: string;
  bytes?: number;
  outputSize?: number;
  outputSha256?: string;
  debugMapPath?: string;
  debugMapFingerprint?: string;
  target?: string;
  architecture?: string;
  outputChanged?: boolean;
  debugMapChanged?: boolean;
  message?: string;
};

/** Language IDs the client and commands treat as Uttori Assembly source. */
const ASSEMBLY_LANGUAGE_IDS = ["uttori-snes", "uttori-65xx"] as const;

/**
 * Language client connected to the bundled server process.
 * @see https://code.visualstudio.com/api/language-extensions/language-server-extension-guide#language-client
 */
let client: LanguageClient | undefined;
/** Build completion publishes artifacts to the same information controller used by editor hovers. */
let editorInformationController: AnalysisAnnotationController | undefined;
/**
 * Shared log/output channel for language-server traffic and Build Binary.
 * @see https://code.visualstudio.com/api/references/vscode-api#LogOutputChannel
 */
let outputChannel: LogOutputChannel | undefined;
/**
 * Active host context used by debounced Run and Watch rebuilds.
 * @see https://code.visualstudio.com/api/references/vscode-api#ExtensionContext
 */
let extensionContext: ExtensionContext | undefined;

/** Whether build-on-save watch mode is currently enabled. */
let watchEnabled = false;
/** Whether watch mode only builds or also performs a deterministic emulator reload. */
let watchMode: "build" | "emulator" = "build";
/**
 * Live session owned by Run and Watch, if it has started.
 * @see https://code.visualstudio.com/api/references/vscode-api#debug.startDebugging
 * @see https://code.visualstudio.com/api/references/vscode-api#debug.stopDebugging
 */
let watchedDebugSession: import("vscode").DebugSession | undefined;
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
/**
 * Pending 250 ms build-on-save debounce; replaced on each relevant save and cleared when watch
 * stops or the callback begins.
 */
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
  extensionContext = context;
  const worker = initializeAnalysisWorker(context.extensionPath, {
    maxMemoryMiB: (directory) =>
      workspace
        .getConfiguration("asm", Uri.file(directory))
        .get<number>("analysis.maxMemoryMiB", 4096),
  });
  context.subscriptions.push(worker);
  const serverModule = context.asAbsolutePath(path.join("server", "server.mjs"));
  const assetPreviewController = new AssetPreviewController(() => client);
  context.subscriptions.push(assetPreviewController);

  /**
   * Spawn Node on the ESM server bundle. The `module` ServerOptions form uses `cp.fork()`,
   * which cannot load an ESM graph with top-level await.
   */
  const serverOptions: ServerOptions = {
    run: {
      command: process.execPath,
      args: [serverModule],
      transport: TransportKind.stdio,
    },
    debug: {
      command: process.execPath,
      args: ["--nolazy", "--inspect=6009", serverModule],
      transport: TransportKind.stdio,
    },
  };

  outputChannel = window.createOutputChannel("Uttori Assembly Language Server", {
    log: true,
  });
  const clientOptions: LanguageClientOptions = {
    documentSelector: ASSEMBLY_LANGUAGE_IDS.map((language) => ({
      scheme: "file" as const,
      language,
    })),
    synchronize: {
      configurationSection: "asm",
      fileEvents: [
        workspace.createFileSystemWatcher("**/*.{asm,src,SRC,s,inc}"),
        workspace.createFileSystemWatcher("**/*.{png,wav,wave,json,bin,pal,palette}"),
        workspace.createFileSystemWatcher("**/uttori-asm.config.json"),
      ],
    },
    middleware: {
      provideHover: async (document, position, token, next) => {
        const instruction = await next(document, position, token);
        if (token.isCancellationRequested) {
          return undefined;
        }
        const information = await editorInformationController?.provideHover(
          document,
          position,
          token,
        );
        const assetPreview = await assetPreviewController.provideHover(document, position, token);
        if (!information && !assetPreview) {
          return instruction;
        }
        // Compose through the supported client middleware so independent provider ordering cannot
        // put analysis above the existing instruction help. The original Markdown is untouched.
        return new Hover(
          [
            ...(instruction?.contents ?? []),
            ...(information?.contents ?? []),
            ...(assetPreview?.contents ?? []),
          ],
          instruction?.range ?? information?.range ?? assetPreview?.range,
        );
      },
    },
    initializationOptions: serverInitializationOptions(),
    outputChannel,
    traceOutputChannel: outputChannel,
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

  const panelProvider = new ProjectPanelProvider(
    context.extensionUri,
    () => client,
    () => initConfig(),
  );
  const disassemblyPanelProvider = new DisassemblyPanelProvider(context.extensionUri);
  const outlineProvider = new ProjectOutlineProvider(() => client);
  const coverageProvider = new AnalysisCoverageProvider();
  const analysisGraphProvider = new AnalysisGraphProvider();
  const sourcesProvider = new AnalysisSourcesProvider();
  const analysisAnnotationController = new AnalysisAnnotationController();
  editorInformationController = analysisAnnotationController;
  // Compare only non-display configuration so changing a template cannot trigger database refreshes.
  const analysisConfigurationIdentity = (): string =>
    JSON.stringify(
      (workspace.workspaceFolders ?? []).map(({ uri }) => {
        const config = workspace.getConfiguration("asm", uri);
        const values = {
          ...config,
          editorInfo: undefined,
          analysis: {
            ...config.get<Record<string, unknown>>("analysis", {}),
            showAnnotations: undefined,
            annotationColumn: undefined,
          },
        };
        return values;
      }),
    );
  let previousAnalysisConfiguration = analysisConfigurationIdentity();
  let previousBuildConfiguration = JSON.stringify(serverInitializationOptions());
  let analysisRefreshTimer: ReturnType<typeof setTimeout> | undefined;
  context.subscriptions.push({ dispose: () => clearTimeout(analysisRefreshTimer) });
  const refreshAnalysisViews = (): void => {
    clearTimeout(analysisRefreshTimer);
    analysisRefreshTimer = setTimeout(() => {
      worker.invalidate();
      coverageProvider.refresh();
      analysisGraphProvider.refresh();
      sourcesProvider.refresh();
      analysisAnnotationController.invalidate();
    }, 150);
  };
  const analysisProjectEditor = new AnalysisProjectEditor(
    refreshAnalysisViews,
    context.extensionUri,
  );
  context.subscriptions.push(analysisProjectEditor);
  const analysisManifestWatcher = workspace.createFileSystemWatcher("**/analysis.json");
  const analysisShardWatcher = workspace.createFileSystemWatcher("**/analysis/**/*.json");

  const analysisOutputChannel = window.createOutputChannel("Uttori Analysis", { log: true });
  context.subscriptions.push(
    ...registerDebugging(context.extensionPath),
    ...registerProjectWizards(context, outputChannel),
    ...registerDisassemblyMaintenance(context, refreshAnalysisViews, analysisOutputChannel),
    analysisOutputChannel,
    outputChannel,
    statusItem,
    analysisAnnotationController,
    sourcesProvider,
    window.registerWebviewViewProvider(ProjectPanelProvider.viewId, panelProvider, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
    window.registerWebviewViewProvider(DisassemblyPanelProvider.viewId, disassemblyPanelProvider, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
    window.createTreeView(ProjectOutlineProvider.viewId, {
      treeDataProvider: outlineProvider,
      showCollapseAll: true,
    }),
    window.createTreeView(AnalysisCoverageProvider.viewId, {
      treeDataProvider: coverageProvider,
      showCollapseAll: true,
    }),
    window.createTreeView(AnalysisGraphProvider.viewId, {
      treeDataProvider: analysisGraphProvider,
      showCollapseAll: true,
    }),
    window.createTreeView(AnalysisSourcesProvider.viewId, {
      treeDataProvider: sourcesProvider,
      showCollapseAll: true,
    }),
    analysisManifestWatcher,
    analysisShardWatcher,
    analysisManifestWatcher.onDidCreate(refreshAnalysisViews),
    analysisManifestWatcher.onDidChange(refreshAnalysisViews),
    analysisManifestWatcher.onDidDelete(refreshAnalysisViews),
    analysisShardWatcher.onDidCreate(refreshAnalysisViews),
    analysisShardWatcher.onDidChange(refreshAnalysisViews),
    analysisShardWatcher.onDidDelete(refreshAnalysisViews),
    window.onDidChangeActiveTextEditor((editor) => analysisAnnotationController.refresh(editor)),
    window.onDidChangeTextEditorVisibleRanges(({ textEditor }) => {
      analysisAnnotationController.refresh(textEditor);
    }),
    window.onDidChangeTextEditorOptions(({ textEditor }) => {
      analysisAnnotationController.refresh(textEditor);
    }),
    workspace.onDidChangeTextDocument(({ document }) =>
      analysisAnnotationController.documentChanged(document),
    ),
    workspace.onDidSaveTextDocument(() => analysisAnnotationController.invalidate()),
    workspace.onDidCloseTextDocument((document) => {
      if (
        document.uri.scheme === "file" &&
        analysisAnnotationController.provider.tracks(document.uri.fsPath)
      ) {
        analysisAnnotationController.invalidate();
      }
    }),
    vscodeDebug.onDidStartDebugSession((session) => {
      if (session.configuration.uttoriRunAndWatch === true) {
        watchedDebugSession = session;
      }
      analysisAnnotationController.refresh();
    }),
    vscodeDebug.onDidTerminateDebugSession((session) => {
      if (watchedDebugSession?.id === session.id) {
        watchedDebugSession = undefined;
      }
      analysisAnnotationController.refresh();
    }),
    commands.registerCommand("asm.build", () => runBuild(resolveBuildEntryUri())),
    commands.registerCommand("asm.assetPreview.open", (request: unknown) =>
      assetPreviewController.open(request),
    ),
    commands.registerCommand(TOGGLE_ANALYSIS_ANNOTATIONS_COMMAND, () =>
      analysisAnnotationController.toggle(),
    ),
    commands.registerCommand("asm.toggleWatch", toggleWatch),
    commands.registerCommand("asm.runEmulator", () => buildAndLaunch(context, true)),
    commands.registerCommand("asm.debugEmulator", () => buildAndLaunch(context, false)),
    commands.registerCommand("asm.runAndWatch", () => runAndWatch(context)),
    commands.registerCommand("asm.configureEmulatorRuntime", () =>
      configureEmulatorRuntime(context, window.activeTextEditor?.document.uri),
    ),
    commands.registerCommand("asm.initConfig", () => initConfig()),
    commands.registerCommand("asm.openPanel", () =>
      commands.executeCommand(`${ProjectPanelProvider.viewId}.focus`),
    ),
    commands.registerCommand("asm.outline.refresh", () => outlineProvider.refresh()),
    commands.registerCommand("asm.coverage.refresh", refreshAnalysisViews),
    commands.registerCommand("asm.analysisGraph.refresh", refreshAnalysisViews),
    commands.registerCommand("asm.sources.refresh", refreshAnalysisViews),
    commands.registerCommand("asm.analysis.navigate", (element?: unknown) => {
      const target = analysisGraphProvider.navigationTarget(element);
      if (target) {
        void navigateToAnalysisLocation(target);
      }
    }),
    commands.registerCommand("asm.coverage.classifyRange", (element?: unknown) =>
      analysisProjectEditor.classifyRange(coverageProvider.editTarget(element)),
    ),
    commands.registerCommand("asm.coverage.setStateEntryPoint", (element?: unknown) =>
      analysisProjectEditor.setStateEntryPoint(coverageProvider.editTarget(element)),
    ),
    commands.registerCommand("asm.coverage.resolveTarget", (element?: unknown) =>
      analysisProjectEditor.resolveTarget(coverageProvider.editTarget(element)),
    ),
    commands.registerCommand("asm.coverage.renameLabel", (element?: unknown) =>
      analysisProjectEditor.renameLabel(coverageProvider.editTarget(element)),
    ),
    commands.registerCommand("asm.disassembly.editAnnotation", () =>
      analysisProjectEditor.editAnnotation(),
    ),
    commands.registerCommand("asm.coverage.explainEvidence", (element?: unknown) =>
      analysisProjectEditor.explainEvidence(coverageProvider.editTarget(element)),
    ),
    commands.registerCommand("asm.coverage.undo", () => analysisProjectEditor.undo()),
    commands.registerCommand("asm.coverage.redo", () => analysisProjectEditor.redo()),
    workspace.onDidGrantWorkspaceTrust(() => {
      void panelProvider.refresh();
      disassemblyPanelProvider.refresh();
      void client?.sendNotification("workspace/didChangeConfiguration", {
        settings: {
          asm: serverInitializationOptions(),
        },
      });
    }),
    workspace.onDidChangeConfiguration((event) => {
      if (
        event.affectsConfiguration("asm.editorInfo") ||
        event.affectsConfiguration("asm.analysis.showAnnotations") ||
        event.affectsConfiguration("asm.analysis.annotationColumn")
      ) {
        analysisAnnotationController.refresh();
      }
      const buildConfiguration = JSON.stringify(serverInitializationOptions());
      if (buildConfiguration !== previousBuildConfiguration) {
        previousBuildConfiguration = buildConfiguration;
        analysisAnnotationController.configurationChanged();
      }
      const configurationIdentity = analysisConfigurationIdentity();
      if (
        event.affectsConfiguration("asm") &&
        configurationIdentity !== previousAnalysisConfiguration
      ) {
        previousAnalysisConfiguration = configurationIdentity;
        void panelProvider.refresh();
        outlineProvider.refresh();
        refreshAnalysisViews();
      }
    }),
  );

  analysisAnnotationController.refresh();

  void client.start().then(() => {
    if (!client) {
      return;
    }
    if (
      context.extensionMode === ExtensionMode.Development ||
      process.env.UTTORI_ASM_LSP_TRACE === "verbose"
    ) {
      void client.setTrace(Trace.Verbose);
    }
    context.subscriptions.push(
      client.onNotification("asm/indexUpdated", () => {
        void panelProvider.refresh();
        outlineProvider.refresh();
      }),
    );
  });
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
  extensionContext = undefined;
  return client?.stop();
}

/**
 * Toggles build-on-save watch mode for the resolved entry document.
 * @see https://code.visualstudio.com/api/references/vscode-api#workspace.onDidSaveTextDocument
 * @see https://code.visualstudio.com/api/references/vscode-api#window.showInformationMessage
 * @see https://code.visualstudio.com/api/references/vscode-api#window.showErrorMessage
 * @see https://code.visualstudio.com/api/references/vscode-api#Uri.parse
 */
function toggleWatch(): void {
  if (watchEnabled) {
    stopWatch();
  } else {
    watchEnabled = true;
    watchMode = "build";
    watchEntryUri = resolveBuildEntryUri();
    if (!watchEntryUri) {
      stopWatch();
      void window.showErrorMessage(
        "Assembly: open a source file (or set asm.entryPoints) before watching.",
      );
      return;
    }
    saveListener = workspace.onDidSaveTextDocument(onDocumentSaved);
    void window.showInformationMessage(
      `Assembly: watching ${path.basename(Uri.parse(watchEntryUri).fsPath)} - rebuilding on save.`,
    );
  }
  updateStatusItem();
}

/**
 * Disable build-on-save, dispose the save listener, cancel any pending debounce, and reset the
 * status bar without stopping an already running emulator.
 */
function stopWatch(): void {
  watchEnabled = false;
  watchMode = "build";
  saveListener?.dispose();
  saveListener = undefined;
  watchEntryUri = undefined;
  if (watchTimer) {
    clearTimeout(watchTimer);
  }
  watchTimer = undefined;
  updateStatusItem();
}

/**
 * Return the ROM/debug-map pair only for a successful build that supplied both paths; otherwise
 * return undefined.
 * @param {BuildResult} result Language-server build response.
 * @returns {BuiltDebugArtifacts | undefined} Artifact pair only when the build succeeded and both paths are present.
 */
const completeArtifacts = (result: BuildResult): BuiltDebugArtifacts | undefined =>
  result.ok && result.outputPath && result.debugMapPath
    ? {
        outputPath: result.outputPath,
        debugMapPath: result.debugMapPath,
        outputSha256: result.outputSha256,
        debugMapFingerprint: result.debugMapFingerprint,
      }
    : undefined;

/**
 * Launch the successful build with the saved or newly selected runtime; watched launches first
 * stop the previous watched session.
 * Returns false when artifacts are missing, runtime selection is cancelled, or VS Code declines
 * startup. noDebug selects run-only mode.
 * @param {ExtensionContext} context Active extension storage/lifecycle context.
 * @param {BuildResult} result Successful build response containing exact artifact paths.
 * @param {boolean} noDebug Whether to run without debugger features.
 * @param {boolean} watched Whether to replace and tag the Run and Watch session.
 * @returns {Promise<boolean>} Whether VS Code started the session; false for incomplete/cancelled setup.
 * @see https://code.visualstudio.com/api/references/vscode-api#debug.startDebugging
 * @see https://code.visualstudio.com/api/references/vscode-api#debug.stopDebugging
 */
async function launchLiveBuild(
  context: ExtensionContext,
  result: BuildResult,
  noDebug: boolean,
  watched: boolean,
): Promise<boolean> {
  const artifacts = completeArtifacts(result);
  if (!artifacts) {
    void window.showErrorMessage(
      "Assembly: successful build did not return a debug artifact pair.",
    );
    return false;
  }
  const resource = Uri.file(artifacts.outputPath);
  const folder = workspace.getWorkspaceFolder(resource) ?? workspace.workspaceFolders?.[0];
  const binding =
    configuredEmulatorRuntime(context, resource) ??
    (await configureEmulatorRuntime(context, resource));
  if (!binding) {
    return false;
  }
  if (watched && watchedDebugSession) {
    await vscodeDebug.stopDebugging(watchedDebugSession);
  }
  const configuration = {
    ...liveDebugConfiguration(binding, artifacts, folder),
    ...(watched ? { uttoriRunAndWatch: true } : {}),
  };
  return vscodeDebug.startDebugging(folder, configuration, { noDebug });
}

/**
 * Build the resolved entry and launch its exact artifacts only after success; noDebug selects
 * running without debugger features.
 * @param {ExtensionContext} context Active extension storage/lifecycle context.
 * @param {boolean} noDebug Whether to run without debugger features.
 * @returns {Promise<void>} Completion after the build and any successful-build launch attempt.
 */
async function buildAndLaunch(context: ExtensionContext, noDebug: boolean): Promise<void> {
  const result = await runBuild(resolveBuildEntryUri());
  if (!result?.ok) {
    return;
  }
  await launchLiveBuild(context, result, noDebug, false);
}

/**
 * Enable emulator rebuild-on-save and attempt the first build/launch.
 * Build failure leaves watch active for recovery on save; cancelled or unsuccessful runtime
 * startup disables it.
 * @param {ExtensionContext} context Active extension storage/lifecycle context.
 * @returns {Promise<void>} Completion after watch setup and the initial build/launch attempt.
 * @see https://code.visualstudio.com/api/references/vscode-api#workspace.onDidSaveTextDocument
 */
async function runAndWatch(context: ExtensionContext): Promise<void> {
  if (watchEnabled) {
    stopWatch();
  }
  const entry = resolveBuildEntryUri();
  if (!entry) {
    void window.showErrorMessage(
      "Assembly: open a source file (or set asm.entryPoints) before running and watching.",
    );
    return;
  }
  watchEnabled = true;
  watchMode = "emulator";
  watchEntryUri = entry;
  saveListener = workspace.onDidSaveTextDocument(onDocumentSaved);
  updateStatusItem();
  const result = await runBuild(entry);
  if (!result?.ok) {
    void window.showWarningMessage(
      "Assembly: Run and Watch is active. Fix the build error and save to launch the emulator.",
    );
    return;
  }
  if (!(await launchLiveBuild(context, result, false, true))) {
    stopWatch();
  }
}

/**
 * Resolves the document to assemble. Prefers the first configured entry point
 * so Build Binary / watch rebuild the project root instead of the include
 * currently in the editor.
 * @returns {string | undefined} The entry document URI string.
 * @see https://code.visualstudio.com/api/references/vscode-api#workspace.getConfiguration
 * @see https://code.visualstudio.com/api/references/vscode-api#workspace.getWorkspaceFolder
 * @see https://code.visualstudio.com/api/references/vscode-api#workspace.workspaceFolders
 * @see https://code.visualstudio.com/api/references/vscode-api#Uri.file
 * @see https://code.visualstudio.com/api/references/vscode-api#Uri.joinPath
 */
function resolveBuildEntryUri(): string | undefined {
  const activeUri = window.activeTextEditor?.document.uri;
  const entryPoints = workspace.getConfiguration("asm", activeUri).get<string[]>("entryPoints", []);
  const folder = activeUri
    ? workspace.getWorkspaceFolder(activeUri)
    : workspace.workspaceFolders?.[0];
  if (entryPoints.length > 0 && folder) {
    const first = entryPoints[0];
    const resolved = path.isAbsolute(first)
      ? Uri.file(first).toString()
      : Uri.joinPath(folder.uri, first).toString();
    outputChannel?.info(
      `Build entry from asm.entryPoints: ${first} → ${Uri.parse(resolved).fsPath}`,
    );
    return resolved;
  }
  const active = window.activeTextEditor?.document.uri.toString();
  if (active) {
    outputChannel?.info(`Build entry from active editor: ${Uri.parse(active).fsPath}`);
  }
  return active;
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
    const entry = watchEntryUri;
    void runBuild(entry, true).then(async (result) => {
      if (!result?.ok || watchMode !== "emulator") {
        return;
      }
      if (result.outputChanged === false && result.debugMapChanged === false) {
        return;
      }
      const context = extensionContext;
      if (context) {
        await launchLiveBuild(context, result, false, true);
      }
    });
  }, 250);
}

/**
 * Determines whether a document is an assembly source file.
 * @param {TextDocument} document The document to test.
 * @returns {boolean} True when the document is an assembly source.
 * @see https://code.visualstudio.com/api/references/vscode-api#TextDocument
 */
function isAssemblyDocument(document: TextDocument): boolean {
  return (
    (ASSEMBLY_LANGUAGE_IDS as readonly string[]).includes(document.languageId) ||
    /\.(asm|src|s|inc)$/i.test(document.fileName)
  );
}

/**
 * Open the first workspace folder's configuration, creating it from settings and language-server
 * metadata only when absent. Existing configuration is preserved; no workspace reports an error.
 * @returns {Promise<void>} Completion after revealing the configuration or reporting that no workspace exists.
 * @see https://code.visualstudio.com/api/references/vscode-api#workspace.fs
 * @see https://code.visualstudio.com/api/references/vscode-api#workspace.getConfiguration
 */
async function initConfig(): Promise<void> {
  const folder = workspace.workspaceFolders?.[0];
  if (!folder) {
    void window.showErrorMessage("Assembly: open a workspace folder before initializing config.");
    return;
  }
  const configUri = Uri.joinPath(folder.uri, "uttori-asm.config.json");
  const config = workspace.getConfiguration("asm");
  let entryPoints = config.get<string[]>("entryPoints", []);
  const active = window.activeTextEditor?.document;
  if (entryPoints.length === 0 && active && isAssemblyDocument(active)) {
    const relative = path.relative(folder.uri.fsPath, active.fileName);
    entryPoints = [
      relative && !relative.startsWith("..") ? relative : path.basename(active.fileName),
    ];
  }
  const includePaths = config.get<string[]>("includePaths", []);

  // Query the language server for the currently active plugins and target so
  // the generated config is self-contained and immediately valid.
  type ProjectMetadata = {
    activeTarget?: string;
    plugins?: { module: string; bundled?: boolean }[];
  };
  let metadata: ProjectMetadata = {};
  try {
    if (client) {
      metadata = (await client.sendRequest<ProjectMetadata>("asm/projectMetadata")) ?? {};
    }
  } catch {
    // Server may not be ready. Proceed with defaults.
  }

  const configuredTarget = config.get<string>("target", "");
  const target = configuredTarget || metadata.activeTarget;

  // The plugins array must be present so the config is self-contained — without
  // it the loader skips host defaults and no plugin (including the bundled SNES
  // one) gets activated.
  const plugins = metadata.plugins?.map((p) => ({ module: p.module })) ?? [
    { module: "@uttori/asm-plugin-snes" },
  ];

  const body: Record<string, unknown> = {
    plugins,
    ...(target ? { target } : {}),
    entryPoints,
    includePaths: includePaths.length > 0 ? includePaths : ["./"],
  };
  const architecture = config.get<string>("architecture", "");
  const buildOutput = config.get<string>("buildOutput", "");
  const baseImage = config.get<string>("baseImage", "");
  if (architecture) {
    body.architecture = architecture;
  }
  if (buildOutput) {
    body.buildOutput = buildOutput;
  }
  if (baseImage) {
    body.baseImage = baseImage;
  }

  try {
    await workspace.fs.stat(configUri);
    const existing = await workspace.openTextDocument(configUri);
    await window.showTextDocument(existing);
    void window.showInformationMessage("Assembly: uttori-asm.config.json already exists.");
    return;
  } catch {
    // File does not exist yet.
  }

  await workspace.fs.writeFile(configUri, Buffer.from(`${JSON.stringify(body, null, 2)}\n`));
  await config.update("configFile", "uttori-asm.config.json", ConfigurationTarget.Workspace);
  const document = await workspace.openTextDocument(configUri);
  await window.showTextDocument(document);
}

/**
 * Asks the language server to assemble a document and reports the result.
 * @param {string | undefined} documentUri The entry document URI string.
 * @param {boolean} [transient] When true, report success transiently (watch mode).
 * @returns {Promise<BuildResult | undefined>} The result used to gate emulator launch/reload.
 * @see https://code.visualstudio.com/api/language-extensions/language-server-extension-guide#language-client
 * @see https://code.visualstudio.com/api/references/vscode-api#workspace.getConfiguration
 * @see https://code.visualstudio.com/api/references/vscode-api#window.showInformationMessage
 * @see https://code.visualstudio.com/api/references/vscode-api#window.showErrorMessage
 * @see https://code.visualstudio.com/api/references/vscode-api#window.setStatusBarMessage
 * @see https://code.visualstudio.com/api/references/vscode-api#Uri.parse
 */
async function runBuild(
  documentUri: string | undefined,
  transient = false,
): Promise<BuildResult | undefined> {
  outputChannel?.show(true);
  outputChannel?.info(transient ? "Watch rebuild requested" : "Build Binary requested");
  if (!client) {
    const message = "Language server is not running.";
    outputChannel?.error(message);
    void window.showErrorMessage(`Assembly: ${message}`);
    return undefined;
  }
  if (!documentUri) {
    const message = "Open a source file or set asm.entryPoints before building.";
    outputChannel?.error(message);
    void window.showErrorMessage(`Assembly: ${message}`);
    return undefined;
  }

  const document = Uri.parse(documentUri);
  const config = workspace.getConfiguration("asm", document);
  const output = resolveConfiguredPath(config.get<string>("buildOutput", ""), document);
  const baseImage = resolveConfiguredPath(config.get<string>("baseImage", ""), document);
  outputChannel?.info(`  file: ${document.fsPath}`);
  outputChannel?.info(`  output: ${output ?? "(target default extension)"}`);
  outputChannel?.info(`  baseImage: ${baseImage ?? "(none)"}`);
  outputChannel?.info("  sending asm.build to language server");

  try {
    const result = (await client.sendRequest(ExecuteCommandRequest.type, {
      command: "asm.build",
      arguments: [documentUri, output, baseImage],
    })) as BuildResult | undefined;

    if (result?.ok) {
      if (result.debugMapPath) {
        editorInformationController?.buildCompleted(
          result.debugMapPath,
          workspace.getWorkspaceFolder(document)?.uri.fsPath ?? path.dirname(document.fsPath),
        );
      }
      const changed =
        result.outputChanged === false && result.debugMapChanged === false ? " (unchanged)" : "";
      const message = `Assembly: built ${result.bytes ?? 0} bytes + debug map → ${result.outputPath ?? "output"}${changed}.`;
      outputChannel?.info(message);
      if (transient) {
        window.setStatusBarMessage(message, 4000);
      } else {
        void window.showInformationMessage(message);
      }
    } else {
      const detail = result?.message ?? "unknown error";
      outputChannel?.error(`Build failed: ${detail}`);
      void window.showErrorMessage(`Assembly: build failed - ${detail}.`);
    }
    return result;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    outputChannel?.error(`Build request failed: ${detail}`);
    void window.showErrorMessage(`Assembly: build failed - ${detail}.`);
    return undefined;
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
  if (!watchEnabled) {
    statusItem.text = "$(eye-closed) Assembly Watch: Off";
    statusItem.tooltip = "Click to rebuild the binary on every save.";
  } else if (watchMode === "emulator") {
    statusItem.text = "$(debug-rerun) Assembly Run & Watch";
    statusItem.tooltip =
      "Assembly is rebuilding and fully reloading the emulator on successful changes. Click to stop watching.";
  } else {
    statusItem.text = "$(eye) Assembly Watch: On";
    statusItem.tooltip = "Assembly is rebuilding on save. Click to stop.";
  }
}

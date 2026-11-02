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
  RelativePattern,
  type WorkspaceFolder,
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
import { AnalysisEvidenceInspector } from "./analysis/evidence-inspector.js";
import { parseAnalysisNavigationTarget } from "./analysis/navigation-target.js";
import { navigateToAnalysisLocation } from "./analysis/navigation.js";
import { initializeAnalysisProjectDiscovery } from "./analysis/project-discovery.js";
import { AnalysisSourcesProvider } from "./analysis/sources-tree.js";
import { initializeAnalysisWorker } from "./analysis/worker-client.js";
import { AssetPreviewController } from "./asset-preview-controller.js";
import { BinaryDrafts } from "./assets/binary-drafts.js";
import { registerPaletteEditor } from "./assets/palette-editor.js";
import { registerPngEditor } from "./assets/png-editor.js";
import {
  configureEmulatorRuntime,
  configuredEmulatorRuntime,
  liveDebugConfiguration,
  registerDebugging,
  type BuiltDebugArtifacts,
} from "./debug/session.js";
import { LinkedBuildController } from "./linked-build.js";
import type { HomeSnapshot } from "./project/home-model.js";
import { ProjectOutlineProvider } from "./project/outline-tree.js";
import { HomeProvider } from "./project/panel.js";
import { SourceController } from "./source/controller.js";

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

/** Narrow LSP command payloads to plain objects before validation. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** LSP command results are untyped. Missing and malformed replies take the failed-build path. */
function isBuildResult(value: unknown): value is BuildResult {
  if (!isRecord(value) || typeof value.ok !== "boolean") {
    return false;
  }
  const strings = [
    "outputPath",
    "outputSha256",
    "debugMapPath",
    "debugMapFingerprint",
    "target",
    "architecture",
    "message",
  ] as const;
  const numbers = ["bytes", "outputSize"] as const;
  const booleans = ["outputChanged", "debugMapChanged"] as const;
  return (
    strings.every((key) => value[key] === undefined || typeof value[key] === "string") &&
    numbers.every((key) => value[key] === undefined || typeof value[key] === "number") &&
    booleans.every((key) => value[key] === undefined || typeof value[key] === "boolean")
  );
}

/** Language IDs the client and commands treat as Uttori Assembly source. */
const ASSEMBLY_LANGUAGE_IDS = ["uttori-snes", "uttori-65xx"] as const;

/**
 * Language client connected to the bundled server process.
 * @see https://code.visualstudio.com/api/language-extensions/language-server-extension-guide#language-client
 */
const languageClients = new Map<string, LanguageClient>();
/** Select by document ownership; background requests must never inherit another root's active target. */
function languageClientFor(
  uri = window.activeTextEditor?.document.uri,
): LanguageClient | undefined {
  const folder = uri ? workspace.getWorkspaceFolder(uri) : workspace.workspaceFolders?.[0];
  return languageClients.get(folder?.uri.toString() ?? "");
}
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

/** One source target supplies Build, Run, Debug and Watch artifact pairs. */
let sourceController: SourceController | undefined;
/** Opt-in relocatable builds use the same artifact contract as absolute builds. */
let linkedBuildController: LinkedBuildController | undefined;
/** Watch epochs discard obsolete results after source saves or target changes. */
let watchEpoch = 0;
let watchBuildRunning = false;
let watchEnabled = false;

/** stopWatch clears this flag while a build started under watch is still awaiting. */
function watchIsEnabled(): boolean {
  return watchEnabled;
}

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
 * Status bar identity for the selected project and legal Next action; click focuses Home.
 */
let projectStatusItem: StatusBarItem;

/**
 * Returns the JSON-safe project settings sent across the LSP boundary.
 * @returns The complete language-server initialization settings.
 */
function serverInitializationOptions(resource?: Uri): Record<string, unknown> {
  const config = workspace.getConfiguration("asm", resource ?? null);
  return {
    configFile: config.get<string>("configFile", ""),
    linkProject: config.get<string>("linkProject", ""),
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

/** Compare only non-display configuration so changing a template cannot trigger database refreshes. */
const analysisConfigurationIdentity = (): string =>
  JSON.stringify(
    (workspace.workspaceFolders ?? []).map(({ uri }) => {
      const config = workspace.getConfiguration("asm", uri);
      return Object.assign({}, config, {
        editorInfo: undefined,
        analysis: Object.assign({}, config.get<Record<string, unknown>>("analysis", {}), {
          showAnnotations: undefined,
          annotationColumn: undefined,
        }),
      });
    }),
  );

/**
 * Activates the extension and starts the Uttori Assembly language server.
 * @param context The extension context.
 * @see https://code.visualstudio.com/api/references/vscode-api#ExtensionContext
 * @see https://code.visualstudio.com/api/references/vscode-api#workspace.createFileSystemWatcher
 * @see https://code.visualstudio.com/api/references/vscode-api#window.createStatusBarItem
 * @see https://code.visualstudio.com/api/references/vscode-api#commands.registerCommand
 * @see https://code.visualstudio.com/api/language-extensions/language-server-extension-guide#language-client
 */
export function activate(context: ExtensionContext): void {
  extensionContext = context;
  registerPaletteEditor(context);
  const binaryDrafts = new BinaryDrafts();
  context.subscriptions.push(binaryDrafts);
  registerPngEditor(context, binaryDrafts);
  const analysisOutputChannel = window.createOutputChannel("Uttori Analysis", { log: true });
  context.subscriptions.push(analysisOutputChannel);
  // Register diagnostics before workers and source commands so their startup failures share the
  // same channel. Its first entry explains the purpose before a project is selected.
  analysisOutputChannel.info("Git source operations and analysis diagnostics are ready.");
  const worker = initializeAnalysisWorker(context.extensionPath, {
    log: (level, message) => analysisOutputChannel[level](message),
    sourceRoot: () => sourceController?.root,
    maxMemoryMiB: (directory) =>
      workspace
        .getConfiguration("asm", Uri.file(directory))
        .get<number>("analysis.maxMemoryMiB", 4096),
  });
  context.subscriptions.push(worker);
  const serverModule = context.asAbsolutePath(path.join("server", "server.mjs"));
  const assetPreviewController = new AssetPreviewController(languageClientFor);
  context.subscriptions.push(assetPreviewController);

  /**
   * Spawn Node on the ESM server bundle. The `module` ServerOptions form uses `cp.fork()`,
   * which cannot load an ESM graph with top-level await.
   * Executable transports do not set Electron's Node mode for us; explicitly select it so the
   * Extension Host executable runs the server instead of starting another editor process.
   */
  const serverOptions: ServerOptions = {
    run: {
      command: process.execPath,
      args: [serverModule],
      transport: TransportKind.stdio,
      options: { env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" } },
    },
    debug: {
      command: process.execPath,
      args: ["--nolazy", "--inspect=0", serverModule],
      transport: TransportKind.stdio,
      options: { env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" } },
    },
  };

  outputChannel = window.createOutputChannel("Uttori Assembly Language Server", {
    log: true,
  });
  sourceController = new SourceController(context, analysisOutputChannel, binaryDrafts);
  linkedBuildController = new LinkedBuildController(context, analysisOutputChannel, binaryDrafts);
  context.subscriptions.push(
    sourceController,
    linkedBuildController,
    initializeAnalysisProjectDiscovery(() => sourceController?.root),
  );
  const clientOptions: LanguageClientOptions = {
    documentSelector: ASSEMBLY_LANGUAGE_IDS.map((language) => ({
      scheme: "file" as const,
      language,
    })),
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

  statusItem = window.createStatusBarItem(StatusBarAlignment.Left, 0);
  statusItem.command = "asm.toggleWatch";
  updateStatusItem();
  statusItem.show();
  projectStatusItem = window.createStatusBarItem(StatusBarAlignment.Left, 1);
  projectStatusItem.command = "asm.openPanel";
  projectStatusItem.show();

  const panelProvider = new HomeProvider(
    context.extensionUri,
    () => languageClientFor(),
    () => initConfig(),
    {
      getSource: () => sourceController,
      getWatch: () => watchEnabled,
      onSnapshot: updateProjectStatus,
    },
  );
  const refreshProjectViews = (): void => {
    void panelProvider.refresh();
  };
  const outlineProvider = new ProjectOutlineProvider(() => languageClientFor());
  const coverageProvider = new AnalysisCoverageProvider((root, inputSha256) => {
    const controller = sourceController;
    if (!controller || controller.root !== root) {
      return undefined;
    }
    if (
      controller.buffers().length ||
      controller.binaryBuffers().length ||
      controller.opaqueBinaryBuffers().length
    ) {
      return true;
    }
    if (controller.session.build?.inputSha256 !== inputSha256) {
      return undefined;
    }
    return controller.session.buildStale;
  });
  const sourcesProvider = new AnalysisSourcesProvider();
  const analysisAnnotationController = new AnalysisAnnotationController(
    undefined,
    context.asAbsolutePath("out/editor-information-worker.cjs"),
  );
  editorInformationController = analysisAnnotationController;
  context.subscriptions.push(
    sourceController.onDidBuild(({ root, build }) => {
      analysisAnnotationController.buildCompleted(build.debugMapFile, root);
      coverageProvider.refresh();
      void panelProvider.refresh();
    }),
    sourceController.onDidChangeTreeData(() => {
      coverageProvider.refresh();
      void panelProvider.refresh();
    }),
    sourceController.onDidChangeSavedInput(scheduleWatchBuild),
    linkedBuildController.onDidChangeInput(() => {
      if (!sourceController?.root) {
        scheduleWatchBuild();
      }
    }),
    sourceController.onDidSelectProject(() => {
      stopWatch();
      analysisAnnotationController.configurationChanged();
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
      sourcesProvider.refresh();
      analysisAnnotationController.invalidate();
    }, 150);
  };
  context.subscriptions.push(
    sourceController.onDidChangeResearch(refreshAnalysisViews),
    sourceController.onDidSelectProject(refreshAnalysisViews),
  );
  const evidenceInspector = new AnalysisEvidenceInspector();
  const analysisManifestWatcher = workspace.createFileSystemWatcher("**/analysis.json");
  const analysisShardWatcher = workspace.createFileSystemWatcher("**/analysis/**/*.json");
  const coverageInputWatcher = workspace.createFileSystemWatcher("**/*");
  const buildSummaryWatcher = workspace.createFileSystemWatcher(
    "**/.uttori-local/builds/{summary,current}.json",
  );

  context.subscriptions.push(
    ...registerDebugging(context.extensionPath),
    outputChannel,
    statusItem,
    projectStatusItem,
    analysisAnnotationController,
    sourcesProvider,
    coverageProvider,
    window.registerWebviewViewProvider(HomeProvider.viewId, panelProvider, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
    window.createTreeView(ProjectOutlineProvider.viewId, {
      treeDataProvider: outlineProvider,
      showCollapseAll: true,
    }),
    window.createTreeView(AnalysisSourcesProvider.viewId, {
      treeDataProvider: sourcesProvider,
      showCollapseAll: true,
    }),
    analysisManifestWatcher,
    analysisShardWatcher,
    buildSummaryWatcher,
    coverageInputWatcher,
    coverageInputWatcher.onDidCreate((uri) => coverageProvider.inputChanged(uri)),
    coverageInputWatcher.onDidChange((uri) => coverageProvider.inputChanged(uri)),
    coverageInputWatcher.onDidDelete((uri) => coverageProvider.inputChanged(uri)),
    buildSummaryWatcher.onDidCreate(() => coverageProvider.refresh()),
    buildSummaryWatcher.onDidChange(() => coverageProvider.refresh()),
    buildSummaryWatcher.onDidDelete(() => coverageProvider.refresh()),
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
    commands.registerCommand("asm.openConfig", () => panelProvider.openConfiguration()),
    commands.registerCommand("asm.openPanel", () =>
      commands.executeCommand(`${HomeProvider.viewId}.focus`),
    ),
    commands.registerCommand("asm.home.next", () => panelProvider.runNext()),
    commands.registerCommand("asm.home.refresh", () => panelProvider.refresh()),
    commands.registerCommand("asm.outline.refresh", () => outlineProvider.refresh()),
    commands.registerCommand("asm.coverage.refresh", () => coverageProvider.refresh()),
    commands.registerCommand("asm.sources.refresh", refreshAnalysisViews),
    commands.registerCommand("asm.analysis.navigate", (element?: unknown) => {
      const target = parseAnalysisNavigationTarget(element);
      if (target) {
        void navigateToAnalysisLocation(target);
      }
    }),
    commands.registerCommand("asm.coverage.classifyRange", () =>
      sourceController?.editEvidence("classification"),
    ),
    commands.registerCommand("asm.coverage.setStateEntryPoint", () =>
      sourceController?.editEvidence("state"),
    ),
    commands.registerCommand("asm.coverage.resolveTarget", () =>
      sourceController?.editEvidence("targets"),
    ),
    commands.registerCommand("asm.coverage.renameLabel", () =>
      sourceController?.editEvidence("symbols"),
    ),
    commands.registerCommand("asm.coverage.explainEvidence", () =>
      evidenceInspector.explainEvidence(),
    ),
    workspace.onDidGrantWorkspaceTrust(() => {
      refreshProjectViews();
      for (const [key, languageClient] of languageClients) {
        void languageClient.sendNotification("workspace/didChangeConfiguration", {
          settings: { asm: serverInitializationOptions(key ? Uri.parse(key) : undefined) },
        });
      }
    }),
    workspace.onDidChangeConfiguration((event) => {
      for (const [key, languageClient] of languageClients) {
        const resource = key ? Uri.parse(key) : undefined;
        if (event.affectsConfiguration("asm", resource)) {
          void languageClient.sendNotification("workspace/didChangeConfiguration", {
            settings: { asm: serverInitializationOptions(resource) },
          });
        }
      }
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
        refreshProjectViews();
        outlineProvider.refresh();
        refreshAnalysisViews();
      }
    }),
  );

  analysisAnnotationController.refresh();

  const clientResources = new Map<string, Disposable[]>();
  const startClient = (folder?: WorkspaceFolder): void => {
    const key = folder?.uri.toString() ?? "";
    if (languageClients.has(key)) {
      return;
    }
    const owned: Disposable[] = [];
    const owns = (uri: Uri): boolean =>
      (workspace.getWorkspaceFolder(uri)?.uri.toString() ?? "") === key;
    const watch = (pattern: string) => {
      const watcher = workspace.createFileSystemWatcher(
        folder ? new RelativePattern(folder, pattern) : pattern,
      );
      owned.push(watcher);
      return watcher;
    };
    const client = new LanguageClient(
      "uttoriAsmLanguageServer" + key,
      "Uttori Assembly Language Server",
      serverOptions,
      {
        ...clientOptions,
        // Nested folders can match a parent's selector. The deepest workspace owner alone receives
        // synchronization and answers requests, so identical names never cross project environments.
        middleware: {
          ...clientOptions.middleware,
          didOpen: async (document, next) => {
            if (owns(document.uri)) {
              return next(document);
            }
          },
          didChange: async (event, next) => {
            if (owns(event.document.uri)) {
              return next(event);
            }
          },
          didClose: async (document, next) => {
            if (owns(document.uri)) {
              return next(document);
            }
          },
          didSave: async (document, next) => {
            if (owns(document.uri)) {
              return next(document);
            }
          },
          provideHover: (document, position, token, next) =>
            owns(document.uri)
              ? clientOptions.middleware!.provideHover!(document, position, token, next)
              : undefined,
          provideCompletionItem: (document, position, providerContext, token, next) =>
            owns(document.uri) ? next(document, position, providerContext, token) : undefined,
          provideDefinition: (document, position, token, next) =>
            owns(document.uri) ? next(document, position, token) : undefined,
          provideReferences: (document, position, providerContext, token, next) =>
            owns(document.uri) ? next(document, position, providerContext, token) : undefined,
          provideDocumentSymbols: (document, token, next) =>
            owns(document.uri) ? next(document, token) : undefined,
          provideRenameEdits: (document, position, name, token, next) =>
            owns(document.uri) ? next(document, position, name, token) : undefined,
          prepareRename: (document, position, token, next) =>
            owns(document.uri) ? next(document, position, token) : undefined,
          provideSignatureHelp: (document, position, providerContext, token, next) =>
            owns(document.uri) ? next(document, position, providerContext, token) : undefined,
          provideDocumentSemanticTokens: (document, token, next) =>
            owns(document.uri) ? next(document, token) : undefined,
          provideDocumentSemanticTokensEdits: (document, previous, token, next) =>
            owns(document.uri) ? next(document, previous, token) : undefined,
        },
        workspaceFolder: folder,
        documentSelector: ASSEMBLY_LANGUAGE_IDS.map((language) => ({
          scheme: "file",
          language,
          ...(folder ? { pattern: { baseUri: folder.uri.toString(), pattern: "**/*" } } : {}),
        })),
        synchronize: {
          fileEvents: [
            watch("**/*.{asm,src,SRC,s,inc}"),
            watch("**/*.{png,wav,wave,json,bin,pal,palette}"),
            watch("**/uttori-asm.config.json"),
          ],
        },
        initializationOptions: {
          ...serverInitializationOptions(folder?.uri),
          ...(folder ? { owningRoot: folder.uri.toString() } : {}),
        },
      },
    );
    languageClients.set(key, client);
    clientResources.set(key, owned);
    outputChannel?.info(`Starting language server for ${key || "standalone files"}.`);
    void client
      .start()
      .then(() => {
        if (languageClients.get(key) !== client) {
          return;
        }
        outputChannel?.info(`Language server ready for ${key || "standalone files"}.`);
        if (
          context.extensionMode === ExtensionMode.Development ||
          process.env.UTTORI_ASM_LSP_TRACE === "verbose"
        ) {
          void client.setTrace(Trace.Verbose);
        }
        refreshProjectViews();
        owned.push(
          client.onRequest("asm/researchBuffers", ({ root }: { root: string }) => {
            // Include unsaved/new JSON documents in the same F2 transaction while leaving their language
            // features with the JSON extension. The server filters these against the project's research roots.
            const buffers = workspace.textDocuments
              .filter((document) => {
                const relative = path.relative(root, document.uri.fsPath);
                return (
                  document.uri.scheme === "file" &&
                  document.uri.fsPath.endsWith(".json") &&
                  relative !== ".." &&
                  !relative.startsWith(`..${path.sep}`) &&
                  !path.isAbsolute(relative)
                );
              })
              .map((document) => ({
                uri: document.uri.toString(),
                version: document.version,
                text: document.getText(),
              }));
            if (
              buffers.length > 512 ||
              buffers.reduce((total, buffer) => total + Buffer.byteLength(buffer.text), 0) >
                32 * 1024 * 1024
            ) {
              throw new Error(
                "Open research buffers exceed the rename budget. Save or close unrelated JSON documents.",
              );
            }
            return buffers;
          }),
          client.onNotification("asm/indexUpdated", () => {
            if (client !== languageClientFor()) {
              return;
            }
            refreshProjectViews();
            outlineProvider.refresh();
          }),
        );
        return;
      })
      .catch((error: unknown) => {
        // Failed startup must release this root so a later folder/configuration event can retry it.
        if (languageClients.get(key) === client) {
          languageClients.delete(key);
          clientResources.delete(key);
          for (const resource of owned) {
            resource.dispose();
          }
        }
        void client.stop().catch((stopError: unknown) => outputChannel?.error(String(stopError)));
        outputChannel?.error(`Language server ${folder?.name ?? "files"}: ${String(error)}`);
      });
  };
  const reconcileClients = (): void => {
    const folders: readonly (WorkspaceFolder | undefined)[] = workspace.workspaceFolders?.length
      ? workspace.workspaceFolders
      : [undefined];
    const retained = new Set(folders.map((folder) => folder?.uri.toString() ?? ""));
    for (const [key, languageClient] of languageClients) {
      if (retained.has(key)) {
        continue;
      }
      languageClients.delete(key);
      for (const resource of clientResources.get(key) ?? []) {
        resource.dispose();
      }
      clientResources.delete(key);
      void languageClient.stop().catch((error: unknown) => outputChannel?.error(String(error)));
    }
    for (const folder of folders) {
      startClient(folder);
    }
  };
  context.subscriptions.push(
    workspace.onDidChangeWorkspaceFolders(reconcileClients),
    window.onDidChangeActiveTextEditor(() => {
      // Opening a document can make a newly added root visible before its folder notification.
      // Reconcile idempotently before routing view requests, including retries after startup failure.
      reconcileClients();
      refreshProjectViews();
      outlineProvider.refresh();
    }),
    {
      dispose: () => {
        for (const resources of clientResources.values()) {
          for (const resource of resources) {
            resource.dispose();
          }
        }
        clientResources.clear();
      },
    },
  );
  reconcileClients();
}

/**
 * Stops the language server when the extension is deactivated.
 * @returns A promise that resolves once the client stops.
 * @see https://code.visualstudio.com/api/get-started/extension-anatomy#extension-entry-file
 * @see https://code.visualstudio.com/api/references/vscode-api#Disposable.dispose
 */
export async function deactivate(): Promise<void> {
  saveListener?.dispose();
  if (watchTimer) {
    clearTimeout(watchTimer);
  }
  extensionContext = undefined;
  const clients = [...languageClients.values()];
  languageClients.clear();
  await Promise.all(clients.map((languageClient) => languageClient.stop()));
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
  ++watchEpoch;
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
 * @param result Language-server build response.
 * @returns Artifact pair only when the build succeeded and both paths are present.
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
 * @param context Active extension storage/lifecycle context.
 * @param result Successful build response containing exact artifact paths.
 * @param noDebug Whether to run without debugger features.
 * @param watched Whether to replace and tag the Run and Watch session.
 * @returns Whether VS Code started the session; false for incomplete/cancelled setup.
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
 * @param context Active extension storage/lifecycle context.
 * @param noDebug Whether to run without debugger features.
 * @returns Completion after the build and any successful-build launch attempt.
 */
async function buildAndLaunch(context: ExtensionContext, noDebug: boolean): Promise<void> {
  const epoch = watchEpoch;
  const result = await runBuild(resolveBuildEntryUri());
  if (epoch !== watchEpoch || !result?.ok) {
    return;
  }
  await launchLiveBuild(context, result, noDebug, false);
}

/**
 * Enable emulator rebuild-on-save and attempt the first build/launch.
 * Build failure leaves watch active for recovery on save; cancelled or unsuccessful runtime
 * startup disables it.
 * @param context Active extension storage/lifecycle context.
 * @returns Completion after watch setup and the initial build/launch attempt.
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
  const epoch = watchEpoch;
  watchBuildRunning = true;
  let result: BuildResult | undefined;
  try {
    result = await runBuild(entry);
  } finally {
    watchBuildRunning = false;
  }
  if (!watchIsEnabled()) {
    return;
  }
  if (epoch !== watchEpoch) {
    scheduleWatchBuild();
    return;
  }
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
 * @returns The entry document URI string.
 * @see https://code.visualstudio.com/api/references/vscode-api#workspace.getConfiguration
 * @see https://code.visualstudio.com/api/references/vscode-api#workspace.getWorkspaceFolder
 * @see https://code.visualstudio.com/api/references/vscode-api#workspace.workspaceFolders
 * @see https://code.visualstudio.com/api/references/vscode-api#Uri.file
 * @see https://code.visualstudio.com/api/references/vscode-api#Uri.joinPath
 */
function resolveBuildEntryUri(): string | undefined {
  if (sourceController?.buildUri) {
    return sourceController.buildUri;
  }
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
 * @param document The saved document.
 * @see https://code.visualstudio.com/api/references/vscode-api#workspace.onDidSaveTextDocument
 * @see https://code.visualstudio.com/api/references/vscode-api#TextDocument
 */
function onDocumentSaved(document: TextDocument): void {
  // The source controller observes all saved inputs, including custom-editor
  // assets and external tools. A second text-only path would race those builds.
  if (sourceController?.root) {
    return;
  }
  const relevant =
    isAssemblyDocument(document) || linkedBuildController?.tracks(document.uri.fsPath);
  if (relevant) {
    scheduleWatchBuild();
  }
}

/** Serialize watch builds and suppress launches from an obsolete source snapshot or stopped target. */
function scheduleWatchBuild(): void {
  if (!watchEnabled || !watchEntryUri) {
    return;
  }
  ++watchEpoch;
  clearTimeout(watchTimer);
  watchTimer = setTimeout(() => {
    watchTimer = undefined;
    if (watchBuildRunning) {
      return;
    }
    watchBuildRunning = true;
    void (async () => {
      try {
        // Build awaits let editor events stop watching or replace the selected entry between iterations.
        for (;;) {
          if (!watchEnabled || !watchEntryUri) {
            return;
          }
          const epoch = watchEpoch;
          const result = await runBuild(watchEntryUri, true);
          if (!watchIsEnabled()) {
            return;
          }
          if (epoch !== watchEpoch) {
            continue;
          }
          if (
            result?.ok &&
            watchMode === "emulator" &&
            !(result.outputChanged === false && result.debugMapChanged === false) &&
            extensionContext
          ) {
            await launchLiveBuild(extensionContext, result, false, true);
          }
          return;
        }
      } finally {
        watchBuildRunning = false;
      }
    })();
  }, 250);
}

/**
 * Determines whether a document is an assembly source file.
 * @param document The document to test.
 * @returns True when the document is an assembly source.
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
 * @returns Completion after revealing the configuration or reporting that no workspace exists.
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
    const client = languageClientFor(folder.uri);
    if (client) {
      metadata = await client.sendRequest<ProjectMetadata>("asm/projectMetadata");
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
 * @param documentUri The entry document URI string.
 * @param [transient] When true, report success transiently (watch mode).
 * @returns The result used to gate emulator launch/reload.
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
  if (sourceController?.root) {
    try {
      const built = await sourceController.build();
      return {
        ok: true,
        outputPath: built.outputFile,
        debugMapPath: built.debugMapFile,
        outputSha256: built.verification.outputSha256,
        debugMapFingerprint: built.debugMapFingerprint,
        outputChanged: built.outputChanged,
        debugMapChanged: built.debugMapChanged,
        bytes: built.outputSize,
        outputSize: built.outputSize,
        target: "snes.sfc",
        architecture: "snes.65816",
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      outputChannel?.error(message);
      void window.showErrorMessage(`Source build: ${message}`);
      return { ok: false, message };
    }
  }
  try {
    const linked = await linkedBuildController?.buildConfigured(
      documentUri ? Uri.parse(documentUri) : undefined,
    );
    if (linked) {
      const root =
        workspace.getWorkspaceFolder(Uri.file(linked.outputFile))?.uri.fsPath ??
        path.dirname(linked.outputFile);
      editorInformationController?.buildCompleted(linked.debugMapFile, root);
      const message = `Assembly: linked ${linked.outputSize} bytes + debug map → ${linked.outputFile}.`;
      outputChannel?.info(message);
      if (transient) {
        window.setStatusBarMessage(message, 4000);
      } else {
        void window.showInformationMessage(message);
      }
      return {
        ok: true,
        outputPath: linked.outputFile,
        debugMapPath: linked.debugMapFile,
        outputSha256: linked.outputSha256,
        debugMapFingerprint: linked.debugMapFingerprint,
        outputChanged: linked.outputChanged,
        debugMapChanged: linked.debugMapChanged,
        bytes: linked.outputSize,
        outputSize: linked.outputSize,
        target: linked.target,
        architecture: linked.architecture,
      };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    outputChannel?.error(message);
    void window.showErrorMessage(`Assembly: ${message}`);
    return { ok: false, message };
  }
  const client = languageClientFor(documentUri ? Uri.parse(documentUri) : undefined);
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
    const response: unknown = await client.sendRequest(ExecuteCommandRequest.type, {
      command: "asm.build",
      arguments: [documentUri, output, baseImage],
    });
    const result = isBuildResult(response) ? response : undefined;

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
 * @param configuredPath The setting value.
 * @param document The source document URI.
 * @returns An absolute path, or undefined when unset.
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

/** Compact project identity and Next action; click focuses Home. */
function updateProjectStatus(snapshot: HomeSnapshot): void {
  if (!projectStatusItem) {
    return;
  }
  if (snapshot.mode === "source") {
    const remaining =
      snapshot.health.coverage && Number.isFinite(snapshot.health.coverage.remainingPercent)
        ? `${snapshot.health.coverage.remainingPercent.toFixed(0)}% remaining`
        : undefined;
    const nextTitle = snapshot.next?.title.replace(/^\d+\.\s*/u, "").split(" · ")[0];
    projectStatusItem.text = `$(home) ${[snapshot.name, remaining, nextTitle ? `Next: ${nextTitle}` : undefined].filter(Boolean).join(" · ")}`;
  } else if (snapshot.mode === "assembly") {
    projectStatusItem.text = `$(home) ${snapshot.name} · index ${snapshot.indexReady ? "ready" : "waiting"}`;
  } else {
    projectStatusItem.text = "$(home) Uttori";
  }
  projectStatusItem.tooltip = "Open Uttori Home";
  projectStatusItem.command = "asm.openPanel";
}

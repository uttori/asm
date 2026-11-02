import * as path from "node:path";

import {
  commands,
  ConfigurationTarget,
  debug,
  Uri,
  window,
  workspace,
  type WebviewView,
  type WebviewViewProvider,
} from "vscode";
import { State, type LanguageClient } from "vscode-languageclient/node";

import {
  checkBuildCoverageFreshness,
  readBuildCoverage,
} from "../analysis/build-coverage.js";
import { runtimeCapturePhase } from "../runtime/capture-state.js";
import type { SourceController } from "../source/controller.js";
import { sourceWorkflow } from "../source/workflow.js";
import { renderWebviewTemplate } from "../webview-template.js";
import {
  buildHomeSnapshot,
  type CatalogEntry,
  type HomeIncomingFile,
  type HomeSnapshot,
  type HomeSourceInput,
  type ProjectMetadata,
  type ProjectStatus,
} from "./home-model.js";

export type { CatalogEntry, HomeSnapshot, ProjectMetadata, ProjectStatus } from "./home-model.js";

/** Empty index/settings used until the language server is running. */
export function fallbackProjectStatus(): ProjectStatus {
  const config = workspace.getConfiguration("asm");
  return {
    fileCount: 0,
    symbolCount: 0,
    referenceCount: 0,
    errorCount: 0,
    lastReindexRootCount: 0,
    lastReindexCachedRoots: 0,
    lastReindexAnalyzedRoots: 0,
    configFile: config.get<string>("configFile", ""),
    target: config.get<string>("target", ""),
    architecture: config.get<string>("architecture", ""),
    buildOutput: config.get<string>("buildOutput", ""),
    baseImage: config.get<string>("baseImage", ""),
    entryPoints: config.get<string>("entryPoints", []),
    includePaths: config.get<string>("includePaths", []),
  };
}

/** Language-client stubs without a state still answer requests; Starting/Stopped clients do not. */
function isLanguageClientReady(client: LanguageClient | undefined): client is LanguageClient {
  return Boolean(client) && (client.state === undefined || client.state === State.Running);
}

/**
 * Sidebar Home webview: project identity, merged health, Next/Build, incoming diffs, recovery.
 * Source identity hydrates from `.uttori/project.json` and the Git session, never from LSP-only settings.
 */
export class HomeProvider implements WebviewViewProvider {
  /** View ID contributed in the extension manifest. */
  static readonly viewId = "uttori-asm.home";

  #view?: WebviewView;
  #metadata?: ProjectMetadata;
  #snapshotRequest = 0;
  #last?: HomeSnapshot;
  readonly #pending = new Set<string>();

  constructor(
    private readonly extensionUri: Uri,
    private readonly getClient: () => LanguageClient | undefined,
    private readonly initConfig: () => Promise<void>,
    private readonly options: {
      getSource?: () => SourceController | undefined;
      getWatch?: () => boolean;
      onSnapshot?: (snapshot: HomeSnapshot) => void;
    } = {},
  ) {}

  /** Most recently published Home snapshot; used by the status bar and Next command. */
  get lastSnapshot(): HomeSnapshot | undefined {
    return this.#last;
  }

  /**
   * Called when the view becomes visible.
   * @param webviewView The hosted webview.
   */
  resolveWebviewView(webviewView: WebviewView): void {
    this.#view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [Uri.joinPath(this.extensionUri, "media")],
    };
    webviewView.webview.html = renderWebviewTemplate(
      webviewView.webview,
      this.extensionUri,
      "home",
    );
    webviewView.webview.onDidReceiveMessage((message: unknown) => {
      void this.onMessage(message);
    });
    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        void this.refresh();
      }
    });
    void this.refresh();
  }

  /**
   * Pushes a fresh Home snapshot to the webview and context keys.
   */
  async refresh(): Promise<void> {
    const request = ++this.#snapshotRequest;
    const snapshot = await this.snapshot();
    if (request !== this.#snapshotRequest) {
      return;
    }
    this.#last = snapshot;
    this.#metadata = snapshot.metadata;
    this.options.onSnapshot?.(snapshot);
    await publishHomeContext(snapshot);
    if (!this.#view) {
      return;
    }
    void this.#view.webview.postMessage({
      type: "snapshot",
      ...snapshot,
    });
  }

  /**
   * Handles messages from the webview.
   * @param message The message object.
   */
  async onMessage(message: unknown): Promise<void> {
    if (!isHomeMessage(message) || this.#pending.has(message.type)) {
      return;
    }
    this.#pending.add(message.type);
    let error: string | undefined;
    try {
      await this.executeMessage(message);
    } catch (failure) {
      error = failure instanceof Error ? failure.message : String(failure);
    } finally {
      this.#pending.delete(message.type);
      void this.#view?.webview.postMessage({
        type: "actionComplete",
        command: message.type,
        error,
      });
    }
  }

  /**
   * Executes a message.
   * @param message The message object.
   */
  private async executeMessage(message: {
    type: string;
    value?: unknown;
    command?: string;
    args?: unknown[];
    left?: string;
    right?: string;
    title?: string;
  }): Promise<void> {
    switch (message.type) {
      case "ready":
        await this.refresh();
        return;
      case "command":
        if (typeof message.command === "string") {
          await commands.executeCommand(message.command, ...(message.args ?? []));
        }
        await this.refresh();
        return;
      case "diff":
        if (typeof message.left === "string" && typeof message.right === "string") {
          await commands.executeCommand(
            "asm.source.diff",
            Uri.parse(message.left),
            Uri.parse(message.right),
            typeof message.title === "string" ? message.title : "Incoming",
          );
        }
        return;
      case "overflow":
        await this.showOverflow();
        return;
      case "openConfig":
        await this.openConfiguration();
        return;
      case "addEntryPoint":
        await this.addPath("entryPoints", false);
        return;
      case "removeEntryPoint":
        await this.removePath("entryPoints", asString(message.value));
        return;
      case "addIncludePath":
        await this.addPath("includePaths", true);
        return;
      case "removeIncludePath":
        await this.removePath("includePaths", asString(message.value));
        return;
      case "setTarget":
        await this.setTarget(asString(message.value));
        return;
      case "setArchitecture":
        await this.updateSetting("architecture", asString(message.value));
        return;
      case "setBuildOutput":
        await this.updateSetting("buildOutput", asString(message.value));
        return;
      default:
        return;
    }
  }

  /** Opens the project identity file: `.uttori/project.json` or `uttori-asm.config.json`. */
  async openConfiguration(): Promise<void> {
    const snapshot = this.#last ?? (await this.snapshot());
    const source = this.options.getSource?.();
    if (snapshot.mode === "source" && source?.root) {
      await window.showTextDocument(Uri.file(path.join(source.root, ".uttori/project.json")));
      return;
    }
    const root = workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (root && snapshot.status.configFile) {
      await window.showTextDocument(Uri.file(path.resolve(root, snapshot.status.configFile)));
      return;
    }
    if (!snapshot.status.configFile) {
      await this.initConfig();
      await this.refresh();
    }
  }

  /** Run the legal Next command from the last snapshot. */
  async runNext(): Promise<void> {
    const next = (this.#last ?? (await this.snapshot())).next;
    if (!next) {
      return;
    }
    await commands.executeCommand(next.command);
    await this.refresh();
  }

  /**
   * Compose Home from the source session, coverage on disk, and optional running language server.
   */
  async snapshot(): Promise<HomeSnapshot> {
    const fallback = fallbackProjectStatus();
    let status = fallback;
    let metadata = this.#metadata;
    let indexReady = false;
    const client = this.getClient();
    if (isLanguageClientReady(client)) {
      try {
        const [lspStatus, lspMetadata] = await Promise.all([
          client.sendRequest<ProjectStatus>("asm/status"),
          client.sendRequest<ProjectMetadata>("asm/projectMetadata"),
        ]);
        status = { ...fallback, ...lspStatus };
        metadata = lspMetadata;
        indexReady = true;
      } catch {
        status = fallback;
        indexReady = false;
      }
    }
    const source = this.options.getSource?.();
    return buildHomeSnapshot({
      trusted: workspace.isTrusted,
      watch: this.options.getWatch?.() ?? false,
      workspaceName: workspace.name,
      status,
      metadata,
      indexReady,
      source: source ? await this.sourceInput(source) : undefined,
    });
  }

  private async sourceInput(source: SourceController): Promise<HomeSourceInput | undefined> {
    const root = source.root;
    if (!root) {
      return undefined;
    }
    const unsaved =
      source.buffers().length > 0 ||
      source.binaryBuffers().length > 0 ||
      source.opaqueBinaryBuffers().length > 0;
    const previewed =
      source.session.preview?.candidate === source.session.candidate &&
      Boolean(source.session.candidate);
    const workflow = sourceWorkflow({
      ...source.session.status,
      busy: source.session.busy,
      conflicts: source.session.status?.conflicts.length,
      candidate: Boolean(source.session.candidate),
      previewed,
      dirty: (source.session.status?.dirty ?? false) || unsaved,
      unsaved,
    });
    return {
      root,
      name: source.session.configuration?.id || path.basename(root),
      branch: source.session.branch,
      dirty: (source.session.status?.dirty ?? false) || unsaved,
      target: source.session.configuration?.target ?? "",
      candidate: source.session.candidate,
      previewed,
      busy: source.session.busy,
      phase: source.session.status?.phase,
      workflow,
      incoming: incomingFiles(source),
      capturePhase: runtimeCapturePhase(),
      debugging: debug.activeDebugSession?.type === "uttori-asm",
      buildDescription: source.session.build
        ? source.session.buildStale
          ? "source changed"
          : "verified"
        : undefined,
      coverage: await sourceCoverage(root, source.session.buildStale),
    };
  }

  private async showOverflow(): Promise<void> {
    const mode = this.#last?.mode ?? "none";
    const picked = await window.showQuickPick(
      [
        { label: "Select source project", command: "asm.source.select" },
        { label: "Create Git source project", command: "asm.source.init" },
        {
          label: mode === "source" ? "Open .uttori/project.json" : "Open project configuration",
          command: "openConfig",
        },
      ],
      { title: "Uttori Home" },
    );
    if (!picked) {
      return;
    }
    if (picked.command === "openConfig") {
      await this.openConfiguration();
      return;
    }
    await commands.executeCommand(picked.command);
  }

  /**
   * Adds a path to the project.
   * @param key The key of the path to add.
   * @param folders Whether to add folders.
   */
  async addPath(key: "entryPoints" | "includePaths", folders: boolean): Promise<void> {
    const picked = await window.showOpenDialog({
      canSelectFiles: !folders,
      canSelectFolders: folders,
      canSelectMany: true,
      openLabel: folders ? "Add include path" : "Add entry point",
    });
    if (!picked?.length) {
      return;
    }
    const current = workspace.getConfiguration("asm").get<string[]>(key, []);
    const next = [...current];
    for (const uri of picked) {
      const folder = workspace.workspaceFolders?.[0];
      const relative = folder ? path.relative(folder.uri.fsPath, uri.fsPath) : undefined;
      const value = relative && !relative.startsWith("..") ? relative : uri.fsPath;
      if (!next.includes(value)) {
        next.push(value);
      }
    }
    await this.updateSetting(key, next);
  }

  /**
   * Removes a path from the project.
   * @param key The key of the path to remove.
   * @param value The value of the path to remove.
   */
  async removePath(key: "entryPoints" | "includePaths", value: string): Promise<void> {
    const current = workspace.getConfiguration("asm").get<string[]>(key, []);
    await this.updateSetting(
      key,
      current.filter((entry) => entry !== value),
    );
  }

  /**
   * Writes the selected target and resets architecture (and output extension)
   * so the previous target's values cannot fail validation.
   * @param targetId Canonical target contribution ID.
   */
  async setTarget(targetId: string): Promise<void> {
    const config = workspace.getConfiguration("asm");
    const target = this.#metadata?.targets.find((entry: CatalogEntry) => entry.id === targetId);
    await config.update("target", targetId, ConfigurationTarget.Workspace);
    if (target?.defaultArchitecture) {
      await config.update(
        "architecture",
        target.defaultArchitecture,
        ConfigurationTarget.Workspace,
      );
    }
    if (target?.defaultOutputExtension) {
      const current = config.get<string>("buildOutput", "");
      if (current) {
        const suffix = target.defaultOutputExtension.startsWith(".")
          ? target.defaultOutputExtension
          : `.${target.defaultOutputExtension}`;
        const next = current.replace(/\.[^.]+$/, suffix);
        if (next !== current) {
          await config.update("buildOutput", next, ConfigurationTarget.Workspace);
        }
      }
    }
    await this.refresh();
  }

  /**
   * Updates a setting in the project.
   * @param key The key of the setting to update.
   * @param value The value of the setting to update.
   */
  async updateSetting(key: string, value: unknown): Promise<void> {
    await workspace.getConfiguration("asm").update(key, value, ConfigurationTarget.Workspace);
    await this.refresh();
  }
}

/** @deprecated Use HomeProvider; retained for tests that still import the previous name. */
export { HomeProvider as ProjectPanelProvider };

async function publishHomeContext(snapshot: HomeSnapshot): Promise<void> {
  await Promise.all([
    commands.executeCommand("setContext", "uttori.projectMode", snapshot.mode),
    commands.executeCommand("setContext", "uttori.sourcePhase", snapshot.sourcePhase),
    commands.executeCommand("setContext", "uttori.nextCommand", snapshot.next?.command ?? ""),
    commands.executeCommand("setContext", "uttori.canAbort", snapshot.canAbort),
    commands.executeCommand("setContext", "uttori.canDiscard", snapshot.canDiscard),
  ]);
}

function incomingFiles(source: SourceController): HomeIncomingFile[] {
  return source.session.incoming.flatMap((row) => {
    const args = row.command?.arguments;
    if (!Array.isArray(args) || args.length < 2) {
      return [];
    }
    const left = args[0];
    const right = args[1];
    const title = typeof args[2] === "string" ? args[2] : String(row.label);
    return [
      {
        path: String(row.label),
        status: typeof row.description === "string" ? row.description : "M",
        conflict: row.description === "predicted conflict",
        additions: row.additions,
        deletions: row.deletions,
        left: uriString(left),
        right: uriString(right),
        title,
      },
    ];
  });
}

function uriString(value: unknown): string {
  if (value instanceof Uri) {
    return value.toString();
  }
  if (typeof value === "string") {
    return value;
  }
  if (value && typeof value === "object" && "toString" in value) {
    return String(value.toString());
  }
  return "";
}

async function sourceCoverage(
  root: string,
  staleBuild: boolean,
): Promise<HomeSourceInput["coverage"]> {
  try {
    const snapshot = await readBuildCoverage(root);
    if (!snapshot) {
      return undefined;
    }
    const freshness = await checkBuildCoverageFreshness(root, snapshot.summary);
    return { summary: snapshot.summary, freshness, staleBuild };
  } catch {
    return undefined;
  }
}

/** Webview posts are untrusted. Ignore anything that is not an object with a string type. */
function isHomeMessage(value: unknown): value is {
  type: string;
  value?: unknown;
  command?: string;
  args?: unknown[];
  left?: string;
  right?: string;
  title?: string;
} {
  return (
    typeof value === "object" && value !== null && "type" in value && typeof value.type === "string"
  );
}

/**
 * Accept string-valued webview fields without coercion, using an empty string for malformed or
 * absent values.
 * @param value Untrusted panel field value.
 * @returns Original string or empty text for all other inputs.
 */
function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

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
import type { LanguageClient } from "vscode-languageclient/node";

import { readBuildCoverage } from "../analysis/build-coverage.js";
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
    entryPoints: config.get<string[]>("entryPoints", []),
    includePaths: config.get<string[]>("includePaths", []),
  };
}

/** vscode-languageclient `State.Running`. Imported as a number so unit tests can stub vscode without loading the client. */
const LANGUAGE_CLIENT_RUNNING = 3;

/** Language-client stubs without a state still answer requests; Starting/Stopped clients do not. */
function isLanguageClientReady(client: LanguageClient | undefined): client is LanguageClient {
  if (!client) {
    return false;
  }
  if (!("state" in client)) {
    return true;
  }
  return (client as { state?: number }).state === LANGUAGE_CLIENT_RUNNING;
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
  #refreshTimer?: ReturnType<typeof setTimeout>;
  #coverage?: { root: string; value: HomeSourceInput["coverage"] };
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
        this.scheduleRefresh();
      }
    });
    void this.refresh();
  }

  /** Coalesce session/watcher bursts so Home cannot retrigger source status. */
  scheduleRefresh(): void {
    if (this.#refreshTimer !== undefined) {
      return;
    }
    this.#refreshTimer = setTimeout(() => {
      this.#refreshTimer = undefined;
      void this.refresh();
    }, 200);
  }

  /** Drop cached conversion totals after a source build so the next paint rereads summary.json. */
  invalidateCoverage(): void {
    this.#coverage = undefined;
    this.scheduleRefresh();
  }

  /**
   * Paints the current session immediately, then loads coverage once per selected root.
   * Conversion freshness uses session `buildStale`; it must not hash watched source files.
   */
  async refresh(): Promise<void> {
    const request = ++this.#snapshotRequest;
    const source = this.options.getSource?.();
    if (source?.root && this.#coverage?.root !== source.root) {
      this.#coverage = undefined;
    }
    await this.publish(await this.snapshot({ lsp: false }));
    if (request !== this.#snapshotRequest) {
      return;
    }
    if (source?.root && !this.#coverage) {
      this.#coverage = {
        root: source.root,
        value: await readSummaryCoverage(source.root, source.session.buildStale),
      };
    }
    if (request !== this.#snapshotRequest) {
      return;
    }
    await this.publish(await this.snapshot({ lsp: true }));
  }

  /** Push one snapshot to context keys, status bar, and the webview. */
  private async publish(snapshot: HomeSnapshot): Promise<void> {
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
        if (this.#last) {
          void this.#view?.webview.postMessage({ type: "snapshot", ...this.#last });
        }
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
    const snapshot = await this.snapshot();
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
  async snapshot(options: { lsp?: boolean } = {}): Promise<HomeSnapshot> {
    const fallback = fallbackProjectStatus();
    let status = this.#last?.status ?? fallback;
    let metadata = this.#metadata;
    let indexReady = this.#last?.indexReady ?? false;
    const client = options.lsp === false ? undefined : this.getClient();
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
      source: source ? this.sourceInput(source) : undefined,
    });
  }

  private sourceInput(source: SourceController): HomeSourceInput | undefined {
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
      buildDescription: sourceBuildDescription(source),
      coverage: this.#coverage?.root === root ? this.#coverage.value : undefined,
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

/** `verified` after a matching source build; `source changed` when inputs diverged. */
function sourceBuildDescription(source: SourceController): string | undefined {
  if (!source.session.build) {
    return undefined;
  }
  return source.session.buildStale ? "source changed" : "verified";
}

/** Publish enablement keys so the palette cannot take illegal source transitions. */
async function publishHomeContext(snapshot: HomeSnapshot): Promise<void> {
  await Promise.all([
    commands.executeCommand("setContext", "uttori.projectMode", snapshot.mode),
    commands.executeCommand("setContext", "uttori.sourcePhase", snapshot.sourcePhase),
    commands.executeCommand("setContext", "uttori.nextCommand", snapshot.next?.command ?? ""),
    commands.executeCommand("setContext", "uttori.canAbort", snapshot.canAbort),
    commands.executeCommand("setContext", "uttori.canDiscard", snapshot.canDiscard),
  ]);
}

/** TreeItem labels may be objects; Incoming always uses the repository-relative path string. */
function rowLabel(row: { label?: string | { label: string } }): string {
  return typeof row.label === "string" ? row.label : (row.label?.label ?? "");
}

/** Map session incoming rows onto Home file cards that open `asm.source.diff`. */
function incomingFiles(source: SourceController): HomeIncomingFile[] {
  return source.session.incoming.flatMap((row) => {
    const args = row.command?.arguments;
    const filePath = rowLabel(row);
    // Incomplete native rows have no reviewable path and must not create unnamed diff buttons.
    if (!filePath || !Array.isArray(args) || args.length < 2) {
      return [];
    }
    const left: unknown = args[0];
    const right: unknown = args[1];
    const title = typeof args[2] === "string" ? args[2] : filePath;
    if (typeof left !== "string" && !(left instanceof Uri)) {
      return [];
    }
    if (typeof right !== "string" && !(right instanceof Uri)) {
      return [];
    }
    return [
      {
        path: filePath,
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

/** Serialize a native or `uttori-source` URI for the webview. */
function uriString(value: Uri | string): string {
  return typeof value === "string" ? value : value.toString();
}

/** Read the compact summary only. Do not hash watched source files from this path. */
async function readSummaryCoverage(
  root: string,
  staleBuild: boolean,
): Promise<HomeSourceInput["coverage"]> {
  try {
    const snapshot = await readBuildCoverage(root);
    if (!snapshot) {
      return undefined;
    }
    return {
      summary: snapshot.summary,
      freshness: {
        status: staleBuild ? "stale" : "current",
        reason: staleBuild
          ? "Source changed since the last successful build."
          : "Last successful build coverage.",
      },
      staleBuild,
    };
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

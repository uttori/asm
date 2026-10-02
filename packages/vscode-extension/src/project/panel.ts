import * as path from "node:path";

import {
  ConfigurationTarget,
  Uri,
  window,
  workspace,
  type WebviewView,
  type WebviewViewProvider,
} from "vscode";
import type { LanguageClient } from "vscode-languageclient/node";

/**
 * Explorer sidebar panel for Uttori Assembly project settings.
 * @see https://code.visualstudio.com/api/extension-guides/webview
 */
import { renderWebviewTemplate } from "../webview-template.js";

/**
 * Language-server status snapshot for the settings panel, including index counts, last-reindex
 * milliseconds, and effective project settings.
 */
type ProjectStatus = {
  fileCount: number;
  symbolCount: number;
  referenceCount: number;
  errorCount: number;
  lastReindexDurationMs?: number;
  lastReindexRootCount: number;
  lastReindexCachedRoots: number;
  lastReindexAnalyzedRoots: number;
  configFile?: string;
  target?: string;
  architecture?: string;
  buildOutput?: string;
  baseImage?: string;
  entryPoints: readonly string[];
  includePaths: readonly string[];
};

/**
 * Target or architecture catalog option supplied by the language server; target entries may
 * advertise architecture/output defaults.
 */
type CatalogEntry = {
  id: string;
  displayName?: string;
  aliases?: string[];
  defaultArchitecture?: string;
  defaultOutputExtension?: string;
};

/**
 * Available target/architecture catalogs and active IDs used to populate and validate panel
 * selections.
 */
type ProjectMetadata = {
  activeTarget: string;
  activeArchitecture: string;
  targets: CatalogEntry[];
  architectures: CatalogEntry[];
};

/**
 * Webview view that edits `asm.*` settings and displays analysis status.
 * @see https://code.visualstudio.com/api/references/vscode-api#WebviewViewProvider
 * @see https://code.visualstudio.com/api/references/vscode-api#WorkspaceConfiguration.update
 * @see https://code.visualstudio.com/api/extension-guides/webview#scripts-and-message-passing
 */
export class ProjectPanelProvider implements WebviewViewProvider {
  static readonly viewId = "uttori-asm.projectPanel";

  #view?: WebviewView;
  #metadata?: ProjectMetadata;
  #snapshotRequest = 0;
  readonly #pending = new Set<string>();

  constructor(
    private readonly extensionUri: Uri,
    private readonly getClient: () => LanguageClient | undefined,
    private readonly initConfig: () => Promise<void>,
  ) {}

  /**
   * Called when the view becomes visible.
   * @param {WebviewView} webviewView The hosted webview.
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
      "panel",
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
   * Pushes a fresh status snapshot to the webview.
   */
  async refresh(): Promise<void> {
    if (!this.#view) {
      return;
    }
    const request = ++this.#snapshotRequest;
    const snapshot = await this.snapshot();
    if (request !== this.#snapshotRequest) {
      return;
    }
    this.#metadata = snapshot.metadata;
    void this.#view.webview.postMessage({
      type: "snapshot",
      ...snapshot,
      trusted: workspace.isTrusted,
      projectName: workspace.name,
    });
  }

  /**
   * Handles messages from the webview.
   * @param {Object} message The message object.
   * @param {string} message.type The type of message.
   * @param {unknown} message.value The value of the message.
   */
  async onMessage(message: unknown): Promise<void> {
    if (!isPanelMessage(message) || this.#pending.has(message.type)) {
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
   * @param {Object} message The message object.
   * @param {string} message.type The type of message.
   * @param {unknown} message.value The value of the message.
   */
  private async executeMessage(message: { type: string; value?: unknown }): Promise<void> {
    switch (message.type) {
      case "ready":
      case "refresh":
        await this.refresh();
        return;
      case "initConfig":
        await this.initConfig();
        await this.refresh();
        return;
      case "openConfig": {
        const { status } = await this.snapshot();
        const root = workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (root && status.configFile) {
          await window.showTextDocument(Uri.file(path.resolve(root, status.configFile)));
        }
        return;
      }
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

  /**
   * Takes a snapshot of the project status and metadata.
   * @returns {Promise<{ status: ProjectStatus; metadata?: ProjectMetadata; indexReady: boolean }>} A promise that resolves with the snapshot.
   */
  async snapshot(): Promise<{
    status: ProjectStatus;
    metadata?: ProjectMetadata;
    indexReady: boolean;
  }> {
    const config = workspace.getConfiguration("asm");
    const fallback: ProjectStatus = {
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
    const client = this.getClient();
    if (!client) {
      return { status: fallback, indexReady: false };
    }
    try {
      const [status, metadata] = await Promise.all([
        client.sendRequest<ProjectStatus>("asm/status"),
        client.sendRequest<ProjectMetadata>("asm/projectMetadata"),
      ]);
      return { status: { ...fallback, ...status }, metadata, indexReady: true };
    } catch {
      return { status: fallback, indexReady: false };
    }
  }

  /**
   * Adds a path to the project.
   * @param {string} key The key of the path to add.
   * @param {boolean} folders Whether to add folders.
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
      // Keep absolute paths for selections outside the first workspace folder or at its root.
      const value = relative && !relative.startsWith("..") ? relative : uri.fsPath;
      if (!next.includes(value)) {
        next.push(value);
      }
    }
    await this.updateSetting(key, next);
  }

  /**
   * Removes a path from the project.
   * @param {string} key The key of the path to remove.
   * @param {string} value The value of the path to remove.
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
   * @param {string} targetId Canonical target contribution ID.
   */
  async setTarget(targetId: string): Promise<void> {
    const config = workspace.getConfiguration("asm");
    const target = this.#metadata?.targets.find((entry) => entry.id === targetId);
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
   * @param {string} key The key of the setting to update.
   * @param {unknown} value The value of the setting to update.
   */
  async updateSetting(key: string, value: unknown): Promise<void> {
    await workspace.getConfiguration("asm").update(key, value, ConfigurationTarget.Workspace);
    await this.refresh();
  }
}

/** Webview posts are untrusted. Ignore anything that is not an object with a string type. */
function isPanelMessage(value: unknown): value is { type: string; value?: unknown } {
  return (
    typeof value === "object" && value !== null && "type" in value && typeof value.type === "string"
  );
}

/**
 * Accept string-valued webview fields without coercion, using an empty string for malformed or
 * absent values.
 * @param {unknown} value Untrusted panel field value.
 * @returns {string} Original string or empty text for all other inputs.
 */
function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

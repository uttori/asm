/**
 * Explorer sidebar panel for Uttori Assembly project settings.
 * @see https://code.visualstudio.com/api/extension-guides/webview
 */
import * as path from "node:path";
import {
  ConfigurationTarget,
  window,
  workspace,
  type WebviewView,
  type WebviewViewProvider,
} from "vscode";
import type { LanguageClient } from "vscode-languageclient/node";

type ProjectStatus = {
  fileCount: number;
  symbolCount: number;
  referenceCount: number;
  errorCount: number;
  lastReindexDurationMs?: number;
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

type ProjectMetadata = {
  activeTarget: string;
  activeArchitecture: string;
  targets: Array<{ id: string; aliases?: string[] }>;
  architectures: Array<{ id: string; aliases?: string[] }>;
};

/**
 * Webview view that edits `asm.*` settings and displays analysis status.
 */
export class ProjectPanelProvider implements WebviewViewProvider {
  static readonly viewId = "uttori-asm.projectPanel";

  #view?: WebviewView;

  constructor(
    private readonly getClient: () => LanguageClient | undefined,
    private readonly initConfig: () => Promise<void>,
  ) {}

  /**
   * Called when the view becomes visible.
   * @param {WebviewView} webviewView The hosted webview.
   */
  resolveWebviewView(webviewView: WebviewView): void {
    this.#view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = this.renderHtml();
    webviewView.webview.onDidReceiveMessage((message: { type?: string; value?: unknown }) => {
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
    const snapshot = await this.snapshot();
    void this.#view.webview.postMessage({ type: "snapshot", ...snapshot });
  }

  async onMessage(message: { type?: string; value?: unknown }): Promise<void> {
    switch (message.type) {
      case "ready":
      case "refresh":
        await this.refresh();
        return;
      case "initConfig":
        await this.initConfig();
        await this.refresh();
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
        await this.updateSetting("target", asString(message.value));
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

  async snapshot(): Promise<{ status: ProjectStatus; metadata?: ProjectMetadata }> {
    const config = workspace.getConfiguration("asm");
    const fallback: ProjectStatus = {
      fileCount: 0,
      symbolCount: 0,
      referenceCount: 0,
      errorCount: 0,
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
      return { status: fallback };
    }
    try {
      const [status, metadata] = await Promise.all([
        client.sendRequest<ProjectStatus>("asm/status"),
        client.sendRequest<ProjectMetadata>("asm/projectMetadata"),
      ]);
      return { status: { ...fallback, ...status }, metadata };
    } catch {
      return { status: fallback };
    }
  }

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
      const relative = toWorkspaceRelative(uri.fsPath);
      if (!next.includes(relative)) {
        next.push(relative);
      }
    }
    await this.updateSetting(key, next);
  }

  async removePath(key: "entryPoints" | "includePaths", value: string): Promise<void> {
    const current = workspace.getConfiguration("asm").get<string[]>(key, []);
    await this.updateSetting(
      key,
      current.filter((entry) => entry !== value),
    );
  }

  async updateSetting(key: string, value: unknown): Promise<void> {
    await workspace.getConfiguration("asm").update(key, value, ConfigurationTarget.Workspace);
    await this.refresh();
  }

  renderHtml(): string {
    const nonce = getNonce();
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    :root { color-scheme: light dark; }
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      margin: 0;
      padding: 10px 12px 16px;
    }
    h2 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; opacity: 0.8; margin: 16px 0 8px; }
    .status, .list { display: grid; gap: 6px; }
    .row { display: flex; justify-content: space-between; gap: 8px; align-items: center; }
    .muted { opacity: 0.75; }
    button, select, input {
      font: inherit;
      color: var(--vscode-foreground);
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-widget-border, var(--vscode-input-border));
      border-radius: 2px;
      padding: 3px 8px;
    }
    button { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); cursor: pointer; }
    button.primary { background: var(--vscode-button-background); color: var(--vscode-button-foreground); width: 100%; }
    .item { display: flex; gap: 6px; align-items: center; }
    .item span { flex: 1; word-break: break-all; }
    .actions { display: flex; gap: 6px; margin-top: 8px; }
    select, input { width: 100%; }
  </style>
</head>
<body>
  <h2>Analysis</h2>
  <div class="status" id="status"></div>
  <h2>Entry points</h2>
  <div class="list" id="entryPoints"></div>
  <div class="actions"><button data-cmd="addEntryPoint">Add file</button></div>
  <h2>Include paths</h2>
  <div class="list" id="includePaths"></div>
  <div class="actions"><button data-cmd="addIncludePath">Add folder</button></div>
  <h2>Target</h2>
  <select id="target"></select>
  <h2>Architecture</h2>
  <select id="architecture"></select>
  <h2>Build output</h2>
  <input id="buildOutput" placeholder="game.sfc" />
  <div class="actions">
    <button class="primary" data-cmd="initConfig">Initialize uttori-asm.config.json</button>
  </div>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const $ = (id) => document.getElementById(id);
    const fillList = (id, items, removeType) => {
      const root = $(id);
      root.innerHTML = "";
      if (!items.length) {
        root.innerHTML = '<div class="muted">None</div>';
        return;
      }
      for (const item of items) {
        const row = document.createElement("div");
        row.className = "item";
        row.innerHTML = "<span></span>";
        row.querySelector("span").textContent = item;
        const button = document.createElement("button");
        button.textContent = "Remove";
        button.addEventListener("click", () => vscode.postMessage({ type: removeType, value: item }));
        row.appendChild(button);
        root.appendChild(row);
      }
    };
    const fillSelect = (id, options, value) => {
      const select = $(id);
      const ids = [...new Set(options.map((entry) => entry.id))];
      select.innerHTML = ids.map((idValue) => {
        const selected = idValue === value ? " selected" : "";
        return "<option value=\\"" + idValue + "\\"" + selected + ">" + idValue + "</option>";
      }).join("");
      if (value && !ids.includes(value)) {
        const option = document.createElement("option");
        option.value = value;
        option.selected = true;
        option.textContent = value;
        select.prepend(option);
      }
    };
    window.addEventListener("message", (event) => {
      const { status, metadata } = event.data || {};
      if (!status) return;
      const duration = status.lastReindexDurationMs == null ? "—" : status.lastReindexDurationMs + "ms";
      $("status").innerHTML = [
        ["Files", status.fileCount],
        ["Symbols", status.symbolCount],
        ["Errors", status.errorCount],
        ["Last reindex", duration],
        ["Cached / analysed roots", (status.lastReindexCachedRoots || 0) + " / " + (status.lastReindexAnalyzedRoots || 0)],
        ["Config", status.configFile || "—"]
      ].map(([label, value]) => '<div class="row"><span class="muted">' + label + '</span><span>' + value + '</span></div>').join("");
      fillList("entryPoints", status.entryPoints || [], "removeEntryPoint");
      fillList("includePaths", status.includePaths || [], "removeIncludePath");
      fillSelect("target", metadata?.targets || [], status.target || metadata?.activeTarget || "");
      fillSelect("architecture", metadata?.architectures || [], status.architecture || metadata?.activeArchitecture || "");
      $("buildOutput").value = status.buildOutput || "";
    });
    document.addEventListener("click", (event) => {
      const cmd = event.target && event.target.getAttribute && event.target.getAttribute("data-cmd");
      if (cmd) vscode.postMessage({ type: cmd });
    });
    $("target").addEventListener("change", (event) => vscode.postMessage({ type: "setTarget", value: event.target.value }));
    $("architecture").addEventListener("change", (event) => vscode.postMessage({ type: "setArchitecture", value: event.target.value }));
    $("buildOutput").addEventListener("change", (event) => vscode.postMessage({ type: "setBuildOutput", value: event.target.value }));
    vscode.postMessage({ type: "ready" });
  </script>
</body>
</html>`;
  }
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function toWorkspaceRelative(filePath: string): string {
  const folder = workspace.workspaceFolders?.[0];
  if (!folder) {
    return filePath;
  }
  const relative = path.relative(folder.uri.fsPath, filePath);
  return relative && !relative.startsWith("..") ? relative : filePath;
}

function getNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let nonce = "";
  for (let index = 0; index < 32; index += 1) {
    nonce += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return nonce;
}

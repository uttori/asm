/**
 * Explorer sidebar panel for Uttori Assembly project settings.
 * @see https://code.visualstudio.com/api/extension-guides/webview
 */
import * as path from "node:path";
import {
  ConfigurationTarget,
  Uri,
  window,
  workspace,
  type Webview,
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

type CatalogEntry = {
  id: string;
  displayName?: string;
  aliases?: string[];
  defaultArchitecture?: string;
  defaultOutputExtension?: string;
};

type ProjectMetadata = {
  activeTarget: string;
  activeArchitecture: string;
  targets: CatalogEntry[];
  architectures: CatalogEntry[];
};

/**
 * Webview view that edits `asm.*` settings and displays analysis status.
 */
export class ProjectPanelProvider implements WebviewViewProvider {
  static readonly viewId = "uttori-asm.projectPanel";

  #view?: WebviewView;
  #metadata?: ProjectMetadata;

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
    webviewView.webview.html = this.renderHtml(webviewView.webview);
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
    this.#metadata = snapshot.metadata;
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

  async snapshot(): Promise<{ status: ProjectStatus; metadata?: ProjectMetadata }> {
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
        const next = replaceOutputExtension(current, target.defaultOutputExtension);
        if (next !== current) {
          await config.update("buildOutput", next, ConfigurationTarget.Workspace);
        }
      }
    }
    await this.refresh();
  }

  async updateSetting(key: string, value: unknown): Promise<void> {
    await workspace.getConfiguration("asm").update(key, value, ConfigurationTarget.Workspace);
    await this.refresh();
  }

  /**
   * Renders the themed project panel HTML.
   * @param {Webview} webview The hosted webview used for CSP and asset URIs.
   * @returns {string} The complete HTML document.
   */
  renderHtml(webview: Webview): string {
    const nonce = getNonce();
    const cssUri = webview.asWebviewUri(Uri.joinPath(this.extensionUri, "media", "panel.css"));
    const styleSrc = webview.cspSource;
    const stylesheet = cssUri.toString();
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${styleSrc}; script-src 'nonce-${nonce}';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="stylesheet" href="${stylesheet}" />
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
  <div class="field"><select id="target"></select></div>
  <h2>Architecture</h2>
  <div class="field"><select id="architecture"></select></div>
  <h2>Build output</h2>
  <div class="field"><input id="buildOutput" placeholder="game.sfc" /></div>
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
        const label = document.createElement("span");
        label.textContent = item;
        const button = document.createElement("button");
        button.className = "icon";
        button.type = "button";
        button.textContent = "×";
        button.title = "Remove";
        button.setAttribute("aria-label", "Remove " + item);
        button.addEventListener("click", () => vscode.postMessage({ type: removeType, value: item }));
        row.append(label, button);
        root.appendChild(row);
      }
    };
    const fillSelect = (id, options, value) => {
      const select = $(id);
      const seen = new Set();
      select.innerHTML = "";
      for (const entry of options) {
        if (!entry || !entry.id || seen.has(entry.id)) continue;
        seen.add(entry.id);
        const option = document.createElement("option");
        option.value = entry.id;
        option.textContent = entry.displayName || entry.id;
        if (entry.id === value) option.selected = true;
        select.appendChild(option);
      }
      if (value && !seen.has(value)) {
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
      const roots = status.lastReindexRootCount || 0;
      const cached = status.lastReindexCachedRoots || 0;
      const analysed = status.lastReindexAnalyzedRoots || 0;
      $("status").innerHTML = [
        ["Files", status.fileCount],
        ["Symbols", status.symbolCount],
        ["Errors", status.errorCount],
        ["Last reindex", duration],
        ["Roots", roots + " (" + cached + " cached, " + analysed + " analysed)"],
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

function replaceOutputExtension(filePath: string, extension: string): string {
  const suffix = extension.startsWith(".") ? extension : `.${extension}`;
  return filePath.replace(/\.[^.]+$/, suffix);
}

function getNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let nonce = "";
  for (let index = 0; index < 32; index += 1) {
    nonce += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return nonce;
}

import { commands, Uri, workspace, type WebviewView, type WebviewViewProvider } from "vscode";

import { renderWebviewTemplate } from "../webview-template.js";

/**
 * Only these webview actions may dispatch extension commands.
 * @see https://code.visualstudio.com/api/references/vscode-api#commands.executeCommand
 */
const actions = new Map([
  ["editAnnotation", "asm.disassembly.editAnnotation"],
  ["configureHeuristics", "asm.heuristics.configure"],
  ["previewHeuristics", "asm.heuristics.preview"],
  ["disassemblyStatus", "asm.disassembly.status"],
  ["regenerateDisassembly", "asm.disassembly.regenerate"],
  ["openRamMap", "asm.ramMap.open"],
  ["importRuntimeTrace", "asm.trace.importRegenerate"],
  ["startExecutionCapture", "asm.trace.start"],
  ["stopExecutionCapture", "asm.trace.stopAnalyze"],
]);

/**
 * Sidebar tools for disassembly and capture, independent of the source index.
 * @see https://code.visualstudio.com/api/references/vscode-api#WebviewViewProvider
 * @see https://code.visualstudio.com/api/extension-guides/webview#scripts-and-message-passing
 */
export class DisassemblyPanelProvider implements WebviewViewProvider {
  static readonly viewId = "uttori-asm.disassemblyPanel";

  #view?: WebviewView;
  /** Prevents a second click from starting the same operation before it completes. */
  readonly #pending = new Set<string>();

  constructor(private readonly extensionUri: Uri) {}

  /**
   * Loads the packaged UI and refreshes trust state whenever the view is revealed.
   * @param {WebviewView} webviewView Sidebar view owned by VS Code.
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
      "disassembly",
    );
    webviewView.webview.onDidReceiveMessage((message: { type?: string }) => {
      void this.onMessage(message);
    });
    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        this.refresh();
      }
    });
    this.refresh();
  }

  /** Updates control availability without requesting language-server metadata. */
  refresh(): void {
    void this.#view?.webview.postMessage({
      type: "snapshot",
      trusted: workspace.isTrusted,
    });
  }

  /**
   * Dispatches known actions and always releases pending controls, including on failure.
   * @param {object} message Action identifier received from the webview.
   * @param {string} message.type Known action or the initial ready notification; others are ignored.
   */
  async onMessage(message: { type?: string }): Promise<void> {
    if (!message || typeof message.type !== "string") {
      return;
    }
    if (message.type === "ready") {
      this.refresh();
      return;
    }
    const command = actions.get(message.type);
    if (!command || this.#pending.has(message.type)) {
      return;
    }
    this.#pending.add(message.type);
    let error: string | undefined;
    try {
      await commands.executeCommand(command);
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
}

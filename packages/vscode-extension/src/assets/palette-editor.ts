import {
  commands,
  Range,
  Uri,
  window,
  workspace,
  WorkspaceEdit,
  type CustomTextEditorProvider,
  type ExtensionContext,
  type TextDocument,
  type WebviewPanel,
} from "vscode";

import { renderWebviewTemplate } from "../webview-template.js";
import { paletteView, paletteWordEdit } from "./palette-model.js";

/** A custom text editor shares VS Code's document, undo stack, save and hot-exit recovery. */
export class PaletteEditor implements CustomTextEditorProvider {
  constructor(readonly extensionUri: Uri) {}

  /** Apply one versioned token edit. Stale views cannot overwrite a concurrent text edit. */
  async edit(
    document: TextDocument,
    message: { version: number; id: string; index: number; word: string },
  ): Promise<void> {
    if (document.isClosed || document.version !== message.version) {
      throw new Error(
        "Palette changed in another editor. Review the refreshed colors and try again.",
      );
    }
    const edit = paletteWordEdit(document.getText(), message.id, message.index, message.word);
    const changes = new WorkspaceEdit();
    changes.replace(
      document.uri,
      new Range(document.positionAt(edit.offset), document.positionAt(edit.offset + edit.length)),
      edit.text,
    );
    if (!(await workspace.applyEdit(changes))) {
      throw new Error("VS Code could not apply the palette edit.");
    }
  }

  resolveCustomTextEditor(document: TextDocument, panel: WebviewPanel): void {
    panel.webview.options = {
      enableScripts: true,
      localResourceRoots: [Uri.joinPath(this.extensionUri, "media")],
    };
    const update = () => {
      try {
        void panel.webview.postMessage({
          type: "palette",
          version: document.version,
          palettes: paletteView(document.getText()),
        });
      } catch (error) {
        void panel.webview.postMessage({ type: "error", text: String(error) });
      }
    };
    const receive = panel.webview.onDidReceiveMessage((message: unknown) => {
      if (!message || typeof message !== "object") {
        return;
      }
      const value = message as Record<string, unknown>;
      if (value.type === "ready") {
        update();
      } else if (value.type === "text") {
        void commands.executeCommand("vscode.openWith", document.uri, "default");
      } else if (
        value.type === "edit" &&
        typeof value.version === "number" &&
        typeof value.id === "string" &&
        typeof value.index === "number" &&
        typeof value.word === "string"
      ) {
        void this.edit(
          document,
          value as { version: number; id: string; index: number; word: string },
        )
          .then(update)
          .catch((error: unknown) => {
            update();
            void panel.webview.postMessage({ type: "error", text: String(error) });
          });
      }
    });
    const changed = workspace.onDidChangeTextDocument((event) => {
      if (event.document.uri.toString() === document.uri.toString()) {
        update();
      }
    });
    panel.onDidDispose(() => {
      receive.dispose();
      changed.dispose();
    });
    panel.webview.html = renderWebviewTemplate(panel.webview, this.extensionUri, "palette");
  }
}

/** Optional Open With entry keeps ordinary JSON editing available for every catalog field. */
export function registerPaletteEditor(context: ExtensionContext): void {
  context.subscriptions.push(
    window.registerCustomEditorProvider("uttori.palette", new PaletteEditor(context.extensionUri), {
      supportsMultipleEditorsPerDocument: true,
    }),
  );
}

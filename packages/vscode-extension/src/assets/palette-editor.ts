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

/** Narrow webview messages to plain objects before reading fields. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Webview edits name the document version and one stored BGR555 slot. */
function isPaletteEdit(
  value: Record<string, unknown>,
): value is { type: "edit"; version: number; id: string; index: number; word: string } {
  return (
    value.type === "edit" &&
    typeof value.version === "number" &&
    typeof value.id === "string" &&
    typeof value.index === "number" &&
    typeof value.word === "string"
  );
}

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

  /** Bind the palette webview to document text changes and edit messages. */
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
      if (!isRecord(message)) {
        return;
      }
      if (message.type === "ready") {
        update();
      } else if (message.type === "text") {
        void commands.executeCommand("vscode.openWith", document.uri, "default");
      } else if (isPaletteEdit(message)) {
        void this.edit(document, message)
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

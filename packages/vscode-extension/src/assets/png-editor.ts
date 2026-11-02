import { PNG_EDITOR_BACKUP_BYTES } from "@uttori/asm-assets/limits";
import {
  EventEmitter,
  RelativePattern,
  Uri,
  window,
  workspace,
  type CancellationToken,
  type CustomDocumentBackupContext,
  type CustomDocumentEditEvent,
  type CustomDocumentOpenContext,
  type CustomEditorProvider,
  type ExtensionContext,
  type WebviewPanel,
} from "vscode";

import { renderWebviewTemplate } from "../webview-template.js";
import type { BinaryDrafts } from "./binary-drafts.js";
import { PngCodec } from "./png-codec.js";
import { PngDocument, type PixelStroke } from "./png-document.js";

/** Narrow webview messages to plain objects before reading fields. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A paint message is the stroke itself plus the webview discriminant. */
function isPixelStroke(value: unknown): value is PixelStroke & { type: "paint" } {
  return (
    isRecord(value) &&
    value.type === "paint" &&
    typeof value.version === "number" &&
    typeof value.index === "number" &&
    Array.isArray(value.pixels) &&
    value.pixels.every((pixel) => typeof pixel === "number")
  );
}

/** Cancellation can arrive during the awaited filesystem write. */
function cancellationRequested(token: CancellationToken): boolean {
  return token.isCancellationRequested;
}

/** Native binary-document lifecycle around a bounded indexed PNG canvas. */
export class PngEditor implements CustomEditorProvider<PngDocument> {
  readonly #edited = new EventEmitter<CustomDocumentEditEvent<PngDocument>>();
  /** Fired when a paint stroke creates a new custom-document undo element. */
  readonly onDidChangeCustomDocument = this.#edited.event;
  constructor(
    readonly extensionUri: Uri,
    readonly codec: PngCodec,
    readonly drafts: BinaryDrafts,
  ) {}

  /** Open or restore a PNG custom document and wire filesystem watchers. */
  async openCustomDocument(
    uri: Uri,
    context: CustomDocumentOpenContext,
    token: CancellationToken,
  ): Promise<PngDocument> {
    let backup: Uint8Array | undefined;
    if (context.backupId) {
      const location = Uri.parse(context.backupId);
      if ((await workspace.fs.stat(location)).size > PNG_EDITOR_BACKUP_BYTES) {
        throw new Error("PNG backup exceeds its size budget.");
      }
      backup = await workspace.fs.readFile(location);
    }
    const document = await PngDocument.open(uri, this.codec, this.drafts, backup);
    if (token.isCancellationRequested) {
      document.dispose();
      throw new Error("PNG open cancelled.");
    }
    const edit = document.onDidEdit((event) => this.#edited.fire(event));
    const watcher = workspace.createFileSystemWatcher(
      new RelativePattern(Uri.joinPath(uri, ".."), "*"),
    );
    const changed = (changedUri: Uri) => {
      if (changedUri.toString() === uri.toString()) {
        void document.externalChange();
      } else if (changedUri.fsPath === document.guidance?.file) {
        void document.externalGuidanceChange();
      }
    };
    const listeners = [
      watcher.onDidChange(changed),
      watcher.onDidCreate(changed),
      watcher.onDidDelete(changed),
    ];
    const disposed = document.onDidDispose(() => {
      edit.dispose();
      watcher.dispose();
      for (const listener of listeners) {
        listener.dispose();
      }
      disposed.dispose();
    });
    return document;
  }

  /** Bind the indexed canvas webview to document paint and refresh events. */
  resolveCustomEditor(document: PngDocument, panel: WebviewPanel): void {
    panel.webview.options = {
      enableScripts: true,
      localResourceRoots: [Uri.joinPath(this.extensionUri, "media")],
    };
    const update = () => {
      void panel.webview.postMessage({
        type: "image",
        version: document.version,
        width: document.image.width,
        height: document.image.height,
        palette: document.image.palette,
        indexes: Buffer.from(document.image.indexes).toString("base64"),
        diskIssue: document.diskIssue ?? document.guidanceIssue,
        regions: document.guidance?.regions,
      });
    };
    const changed = document.onDidChange(update);
    const received = panel.webview.onDidReceiveMessage((value: unknown) => {
      if (!isRecord(value)) {
        return;
      }
      if (value.type === "ready") {
        update();
      } else if (isPixelStroke(value)) {
        try {
          document.paint(value);
          update();
        } catch (error) {
          update();
          void panel.webview.postMessage({ type: "error", text: String(error) });
        }
      }
    });
    panel.onDidDispose(() => {
      changed.dispose();
      received.dispose();
    });
    panel.webview.html = renderWebviewTemplate(panel.webview, this.extensionUri, "indexed-png");
  }
  /** Persist in-memory indexes to the document URI unless cancelled. */
  async saveCustomDocument(document: PngDocument, token: CancellationToken): Promise<void> {
    if (token.isCancellationRequested) {
      throw new Error("PNG save cancelled.");
    }
    await document.save(document.uri, () => token.isCancellationRequested);
  }
  /** Write encoded PNG bytes to a new local destination. */
  async saveCustomDocumentAs(
    document: PngDocument,
    destination: Uri,
    token: CancellationToken,
  ): Promise<void> {
    if (token.isCancellationRequested || destination.scheme !== "file") {
      throw new Error("PNG Save As requires a local file and an active operation.");
    }
    await document.save(destination, () => token.isCancellationRequested);
  }
  /** Reload indexes from disk, discarding unsaved pixel edits. */
  async revertCustomDocument(document: PngDocument): Promise<void> {
    await document.revert();
  }
  /** Write VS Code backup JSON for an open PNG draft. */
  async backupCustomDocument(
    document: PngDocument,
    context: CustomDocumentBackupContext,
    token: CancellationToken,
  ) {
    if (token.isCancellationRequested) {
      throw new Error("PNG backup cancelled.");
    }
    await workspace.fs.writeFile(context.destination, document.backup());
    if (cancellationRequested(token)) {
      await workspace.fs.delete(context.destination);
      throw new Error("PNG backup cancelled.");
    }
    return {
      id: context.destination.toString(),
      delete: async () => {
        await workspace.fs.delete(context.destination);
      },
    };
  }
  /** Release custom-document change events when the provider is torn down. */
  dispose(): void {
    this.#edited.dispose();
  }
}

/** Optional indexed editing coexists with VS Code's image preview and external art tools. */
export function registerPngEditor(context: ExtensionContext, drafts: BinaryDrafts): void {
  const codec = new PngCodec(context.asAbsolutePath("out/png-worker.cjs"));
  const editor = new PngEditor(context.extensionUri, codec, drafts);
  context.subscriptions.push(
    codec,
    editor,
    window.registerCustomEditorProvider("uttori.indexedPng", editor, {
      supportsMultipleEditorsPerDocument: true,
    }),
  );
}

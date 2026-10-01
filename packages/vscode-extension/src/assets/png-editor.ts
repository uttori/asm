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

/** Native binary-document lifecycle around a bounded indexed PNG canvas. */
export class PngEditor implements CustomEditorProvider<PngDocument> {
  readonly #edited = new EventEmitter<CustomDocumentEditEvent<PngDocument>>();
  readonly onDidChangeCustomDocument = this.#edited.event;
  constructor(
    readonly extensionUri: Uri,
    readonly codec: PngCodec,
    readonly drafts: BinaryDrafts,
  ) {}

  async openCustomDocument(
    uri: Uri,
    context: CustomDocumentOpenContext,
    token: CancellationToken,
  ): Promise<PngDocument> {
    let backup: Uint8Array | undefined;
    if (context.backupId) {
      const location = Uri.parse(context.backupId);
      if ((await workspace.fs.stat(location)).size > 26 * 1024 * 1024) {
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
      if (!value || typeof value !== "object") {
        return;
      }
      const message = value as Record<string, unknown>;
      if (message.type === "ready") {
        update();
      } else if (message.type === "paint") {
        try {
          document.paint(message as unknown as PixelStroke);
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
  async saveCustomDocument(document: PngDocument, token: CancellationToken): Promise<void> {
    if (token.isCancellationRequested) {
      throw new Error("PNG save cancelled.");
    }
    await document.save(document.uri, () => token.isCancellationRequested);
  }
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
  async revertCustomDocument(document: PngDocument): Promise<void> {
    await document.revert();
  }
  async backupCustomDocument(
    document: PngDocument,
    context: CustomDocumentBackupContext,
    token: CancellationToken,
  ) {
    if (token.isCancellationRequested) {
      throw new Error("PNG backup cancelled.");
    }
    await workspace.fs.writeFile(context.destination, document.backup());
    if (token.isCancellationRequested) {
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

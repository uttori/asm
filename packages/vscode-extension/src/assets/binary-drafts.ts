import { EventEmitter, type Uri } from "vscode";

/** Unsaved binary documents supply the same explicit source snapshots as native text buffers. */
export interface BinaryDraft {
  readonly uri: Uri;
  readonly dirty: boolean;
  readonly version: number;
  /** Encode the exact current version; reject edits that arrive while encoding. */
  snapshot(): Promise<Uint8Array>;
}

/** Shared only within this extension host; no parallel asset history or persistent draft database. */
export class BinaryDrafts {
  readonly documents = new Set<BinaryDraft>();
  readonly #changed = new EventEmitter<Uri>();
  readonly onDidChange = this.#changed.event;
  changed(uri: Uri): void {
    this.#changed.fire(uri);
  }
  dispose(): void {
    this.#changed.dispose();
    this.documents.clear();
  }
}

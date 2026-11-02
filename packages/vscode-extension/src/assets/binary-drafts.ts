import { EventEmitter, type Uri } from "vscode";

/** Unsaved binary documents supply the same explicit source snapshots as native text buffers. */
export interface BinaryDraft {
  /** Document URI tracked for unsaved binary state. */
  readonly uri: Uri;
  /** Whether bytes differ from the last saved on-disk snapshot. */
  readonly dirty: boolean;
  /** Monotonic revision bumped on successful edits. */
  readonly version: number;
  /** Encode the exact current version; reject edits that arrive while encoding. */
  snapshot(): Promise<Uint8Array>;
}

/** Shared only within this extension host; no parallel asset history or persistent draft database. */
export class BinaryDrafts {
  /** Open binary drafts tracked for unsaved-state queries. */
  readonly documents = new Set<BinaryDraft>();
  readonly #changed = new EventEmitter<Uri>();
  /** Fired when a tracked draft's dirty state or bytes change. */
  readonly onDidChange = this.#changed.event;
  /** Notify listeners that one draft URI changed. */
  changed(uri: Uri): void {
    this.#changed.fire(uri);
  }
  /** Dispose change events and clear tracked documents. */
  dispose(): void {
    this.#changed.dispose();
    this.documents.clear();
  }
}

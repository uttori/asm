import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import type { IndexedImage } from "@uttori/asm-assets/image";
import { ASSET_LIMITS, PNG_EDITOR_BACKUP_BYTES } from "@uttori/asm-assets/limits";
import { EventEmitter, type CustomDocument, type CustomDocumentEditEvent, type Uri } from "vscode";

import type { BinaryDrafts } from "./binary-drafts.js";
import type { PngCodec } from "./png-codec.js";
import {
  assertPngGuidanceCurrent,
  readPngGuidance,
  validatePngRegionStroke,
  type PngGuidance,
} from "./png-guidance.js";

/** Hash on-disk PNG bytes to detect external replacements. */
const hash = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");

/** Narrow backup JSON to plain objects before reading fields. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A stroke holds native index replacements; indexes are row-major positions, never RGB matches. */
export interface PixelStroke {
  /** Document version the stroke must match to apply. */
  readonly version: number;
  /** Row-major pixel positions receiving the palette index. */
  readonly pixels: readonly number[];
  /** Palette index written at each listed position. */
  readonly index: number;
}

/** PNG bytes stay in memory until native Save; VS Code owns undo and backup lifecycle. */
export class PngDocument implements CustomDocument {
  readonly #changed = new EventEmitter<void>();
  /** Fired when pixel or disk state changes require UI refresh. */
  readonly onDidChange = this.#changed.event;
  readonly #edited = new EventEmitter<CustomDocumentEditEvent<PngDocument>>();
  /** Fired when a paint stroke creates a new undo element. */
  readonly onDidEdit = this.#edited.event;
  readonly #disposed = new EventEmitter<void>();
  /** Fired once when the custom document is closed. */
  readonly onDidDispose = this.#disposed.event;
  #savedIndexes: Uint8Array;
  #diskHash: string;
  #version = 1;
  #closed = false;
  #saving = false;
  #revision = 0;
  #externalPending = false;
  #backupGuidanceMismatch = false;
  /** Preserve the pre-exit identity through repeated backups of an unresolved restored draft. */
  #backupGuidanceIdentity?: string | null;
  /** External changes never replace an unsaved draft; the editor shows the conflict until Revert or Save As. */
  diskIssue?: string;
  /** Painting and Save pause when the sidecar's canonical tile ownership changes. */
  guidanceIssue?: string;

  private constructor(
    readonly uri: Uri,
    private bytes: Uint8Array,
    public image: IndexedImage,
    readonly codec: PngCodec,
    readonly drafts: BinaryDrafts,
    diskHash: string,
    savedIndexes: Uint8Array,
    public guidance?: PngGuidance,
  ) {
    this.#diskHash = diskHash;
    this.#savedIndexes = savedIndexes;
    drafts.documents.add(this);
  }

  /** Backup carries original bytes and draft indexes so hot exit can retain exact no-op/undo behavior. */
  static async open(
    uri: Uri,
    codec: PngCodec,
    drafts: BinaryDrafts,
    backup?: Uint8Array,
  ): Promise<PngDocument> {
    if (uri.scheme !== "file") {
      throw new Error("PNG editing currently requires a local file.");
    }
    let bytes: Uint8Array;
    let saved: Uint8Array | undefined;
    let indexes: Uint8Array | undefined;
    let diskHash: string | undefined;
    let backupGuidance: string | null | undefined;
    if (backup) {
      if (backup.length > PNG_EDITOR_BACKUP_BYTES) {
        throw new Error("PNG backup exceeds its size budget.");
      }
      const value: unknown = JSON.parse(Buffer.from(backup).toString("utf8"));
      if (
        !isRecord(value) ||
        value.version !== 1 ||
        value.uri !== uri.toString() ||
        typeof value.bytes !== "string" ||
        typeof value.indexes !== "string" ||
        typeof value.saved !== "string" ||
        typeof value.diskHash !== "string" ||
        !/^[\da-f]{64}$/.test(value.diskHash)
      ) {
        throw new Error("Invalid PNG editor backup.");
      }
      bytes = Buffer.from(value.bytes, "base64");
      indexes = Buffer.from(value.indexes, "base64");
      saved = Buffer.from(value.saved, "base64");
      diskHash = value.diskHash;
      if (
        value.guidanceSha256 !== undefined &&
        value.guidanceSha256 !== null &&
        (typeof value.guidanceSha256 !== "string" || !/^[\da-f]{64}$/.test(value.guidanceSha256))
      ) {
        throw new Error("Invalid PNG layout identity in backup.");
      }
      backupGuidance = value.guidanceSha256;
    } else {
      bytes = await PngDocument.read(uri);
    }
    const image = await codec.decode(bytes);
    if (indexes && saved) {
      for (const pixels of [indexes, saved]) {
        if (
          pixels.length !== image.indexes.length ||
          pixels.some((index) => index >= image.palette.length)
        ) {
          throw new Error("PNG backup contains invalid palette indexes.");
        }
      }
    }
    const document = new PngDocument(
      uri,
      bytes,
      image,
      codec,
      drafts,
      diskHash ?? hash(bytes),
      saved ?? image.indexes.slice(),
      await readPngGuidance(uri.fsPath, image),
    );
    if (indexes) {
      document.image = { ...image, indexes };
      // A restored draft still belongs to the layout that existed before hot exit.
      // Preserve its pixels for Save As, but require Revert before adopting changed ownership.
      if (backupGuidance !== undefined && backupGuidance !== (document.guidance?.sha256 ?? null)) {
        document.#backupGuidanceMismatch = true;
        document.#backupGuidanceIdentity = backupGuidance;
        document.guidanceIssue =
          "The frame-atlas layout changed since this draft was backed up. Save As preserves the draft; Revert adopts the current layout.";
      }
      drafts.changed(uri);
    }
    return document;
  }

  /** Stat before reading prevents unbounded allocation even for malformed containers or external replacements. */
  private static async read(uri: Uri): Promise<Uint8Array> {
    const stat = await fs.lstat(uri.fsPath);
    if (!stat.isFile() || stat.size > ASSET_LIMITS.pngBytes) {
      throw new Error("PNG editing requires a regular file of at most 32 MiB.");
    }
    return fs.readFile(uri.fsPath);
  }

  /** Monotonic revision bumped on each successful pixel mutation. */
  get version(): number {
    return this.#version;
  }
  /** Whether in-memory indexes differ from the last saved snapshot. */
  get dirty(): boolean {
    return !this.image.indexes.every((value, index) => value === this.#savedIndexes[index]);
  }

  private changed(): void {
    this.#version++;
    this.#changed.fire();
    this.drafts.changed(this.uri);
  }

  /** One stroke is one undo element. Validate the whole patch before mutating any pixel. */
  paint(stroke: PixelStroke): void {
    if (this.guidanceIssue) {
      throw new Error(this.guidanceIssue);
    }
    if (this.#closed || this.#saving || stroke.version !== this.version) {
      throw new Error("The image changed or is saving. Review the refreshed image and try again.");
    }
    if (
      !Array.isArray(stroke.pixels) ||
      !stroke.pixels.length ||
      stroke.pixels.length > 8192 ||
      !Number.isSafeInteger(stroke.index) ||
      stroke.index < 0 ||
      stroke.index >= this.image.palette.length ||
      stroke.pixels.some(
        (pixel) => !Number.isSafeInteger(pixel) || pixel < 0 || pixel >= this.image.indexes.length,
      )
    ) {
      throw new Error("Invalid indexed-pixel stroke.");
    }
    validatePngRegionStroke(this.guidance, this.image.width, stroke.pixels, stroke.index);
    const pixels: readonly number[] = stroke.pixels;
    const positions = [...new Set(pixels)].filter(
      (pixel) => this.image.indexes[pixel] !== stroke.index,
    );
    if (!positions.length) {
      return;
    }
    const previous = positions.map((pixel) => this.image.indexes[pixel]);
    const revision = this.#revision;
    const apply = (undo: boolean) => {
      // An external reload may replace dimensions and palette ownership. Old undo
      // elements must never replay their positions into that different container.
      if (this.#revision !== revision) {
        throw new Error(
          "This image was reloaded from disk. Its earlier pixel edits cannot be replayed.",
        );
      }
      if (this.#saving || this.#closed) {
        throw new Error("Wait for PNG Save to finish before undoing or redoing pixels.");
      }
      for (const [index, pixel] of positions.entries()) {
        this.image.indexes[pixel] = undo ? previous[index] : stroke.index;
      }
      this.changed();
    };
    apply(false);
    this.#edited.fire({
      document: this,
      label: "Paint indexed pixels",
      undo: () => apply(true),
      redo: () => apply(false),
    });
  }

  /** Encode current indexes to PNG bytes, optionally revalidating guidance first. */
  async snapshot(checkGuidance = true): Promise<Uint8Array> {
    const version = this.version;
    if (checkGuidance) {
      if (this.guidanceIssue) {
        throw new Error(this.guidanceIssue);
      }
      await assertPngGuidanceCurrent(this.guidance);
    }
    const encoded = await this.codec.encode(this.bytes, this.image.indexes);
    if (this.#closed || this.version !== version) {
      throw new Error("PNG changed during encoding. Preview or save it again.");
    }
    return encoded;
  }

  /** Preserve drafts when a sidecar changes; restoring its exact bytes makes them usable again. */
  async externalGuidanceChange(): Promise<void> {
    if (this.#backupGuidanceMismatch) {
      return;
    }
    try {
      await assertPngGuidanceCurrent(this.guidance);
      this.guidanceIssue = undefined;
    } catch (error) {
      this.guidanceIssue = String(error);
    }
    this.#changed.fire();
  }

  /** Publish via a sibling temporary file; an encoding/write failure leaves the destination intact. */
  async save(destination = this.uri, cancelled: () => boolean = () => false): Promise<void> {
    if (this.#saving) {
      throw new Error("PNG save already running.");
    }
    this.#saving = true;
    let temporary: string | undefined;
    try {
      if (cancelled()) {
        throw new Error("PNG save cancelled.");
      }
      const version = this.version;
      const same = destination.toString() === this.uri.toString();
      const encoded = await this.snapshot(same);
      const file = destination.fsPath;
      const original = same ? await PngDocument.read(this.uri) : undefined;
      if (original && hash(original) !== this.#diskHash) {
        throw new Error(
          "PNG changed on disk. Revert to review the external version, or use Save As to retain this draft.",
        );
      }
      temporary = path.join(path.dirname(file), `.${path.basename(file)}.${randomUUID()}.tmp`);
      const handle = await fs.open(temporary, "wx", 0o600);
      try {
        await handle.writeFile(encoded);
        await handle.sync();
      } finally {
        await handle.close();
      }
      if (same && hash(await PngDocument.read(this.uri)) !== this.#diskHash) {
        throw new Error("PNG changed on disk during Save. The draft remains open.");
      }
      if (cancelled()) {
        throw new Error("PNG save cancelled.");
      }
      if (this.version !== version || this.#closed) {
        throw new Error("PNG changed during Save. Save it again.");
      }
      if (same) {
        await assertPngGuidanceCurrent(this.guidance);
        await fs.chmod(temporary, (await fs.stat(file)).mode & 0o777);
      }
      await fs.rename(temporary, file);
      temporary = undefined;
      if (same) {
        this.#diskHash = hash(encoded);
        this.#savedIndexes = this.image.indexes.slice();
        this.diskIssue = undefined;
        this.#changed.fire();
      }
    } finally {
      this.#saving = false;
      if (temporary) {
        await fs.rm(temporary, { force: true });
      }
      if (this.#externalPending) {
        // A watcher event during our atomic write can also be an external writer.
        // Compare after publication rather than losing that notification.
        this.#externalPending = false;
        void this.externalChange();
      }
    }
  }

  /** Native Revert replaces the document; external updates only reload clean drafts. */
  async revert(): Promise<void> {
    const version = this.version;
    const bytes = await PngDocument.read(this.uri);
    const image = await this.codec.decode(bytes);
    const guidance = await readPngGuidance(this.uri.fsPath, image);
    if (this.version !== version || this.#closed || this.#saving) {
      throw new Error("PNG changed while reloading. Revert it again.");
    }
    this.bytes = bytes;
    this.image = image;
    this.guidance = guidance;
    this.guidanceIssue = undefined;
    this.#backupGuidanceMismatch = false;
    this.#backupGuidanceIdentity = undefined;
    this.#revision++;
    this.#savedIndexes = image.indexes.slice();
    this.#diskHash = hash(bytes);
    this.diskIssue = undefined;
    this.changed();
  }

  /** Ignore delayed notifications from our own Save; report external changes even for dirty drafts. */
  async externalChange(): Promise<void> {
    if (this.#closed) {
      return;
    }
    if (this.#saving) {
      this.#externalPending = true;
      return;
    }
    try {
      if (hash(await PngDocument.read(this.uri)) === this.#diskHash) {
        return;
      }
      if (!this.dirty) {
        await this.revert();
        return;
      }
      this.diskIssue =
        "This PNG changed on disk. Your unsaved pixels are retained; use Revert to load the external version or Save As to keep both.";
    } catch (error) {
      // Missing/invalid external files invalidate the build without discarding the last readable image.
      this.diskIssue = `Cannot reload the PNG from disk: ${String(error)}`;
    }
    this.#changed.fire();
    this.drafts.changed(this.uri);
  }

  /** Serialize draft bytes, indexes, and guidance identity for VS Code backup. */
  backup(): Uint8Array {
    let guidanceSha256 = this.guidance?.sha256 ?? null;
    if (this.#backupGuidanceMismatch) {
      guidanceSha256 = this.#backupGuidanceIdentity ?? null;
    }
    return Buffer.from(
      JSON.stringify({
        version: 1,
        uri: this.uri.toString(),
        bytes: Buffer.from(this.bytes).toString("base64"),
        indexes: Buffer.from(this.image.indexes).toString("base64"),
        saved: Buffer.from(this.#savedIndexes).toString("base64"),
        diskHash: this.#diskHash,
        guidanceSha256,
      }),
    );
  }
  /** Release emitters and unregister from draft tracking on close. */
  dispose(): void {
    if (this.#closed) {
      return;
    }
    this.#closed = true;
    this.#disposed.fire();
    this.#disposed.dispose();
    this.drafts.documents.delete(this);
    this.drafts.changed(this.uri);
    this.#changed.dispose();
    this.#edited.dispose();
  }
}

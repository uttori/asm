import {
  assertSourceObjectId,
  assertSourcePath,
  sourceGit,
} from "@uttori/asm-disassembler/source-project";
import {
  EventEmitter,
  FileSystemError,
  FileType,
  Uri,
  type FileChangeEvent,
  type FileStat,
  type FileSystemProvider,
} from "vscode";

/** Immutable Git blobs use a filesystem provider so native text and image diffs share one URI scheme. */
export class SourceGitFiles implements FileSystemProvider {
  /** Internal emitter backing onDidChangeFile notifications. */
  readonly changes = new EventEmitter<FileChangeEvent[]>();
  /** Emits when registered roots change; history blobs themselves are immutable. */
  readonly onDidChangeFile = this.changes.event;
  /** Source project roots that have been opened through this provider. */
  readonly roots = new Set<string>();

  /** Build a uttori-source URI for one revision of a repository-relative file. */
  uri(root: string, revision: string | null, file: string): Uri {
    this.roots.add(root);
    return Uri.from({
      scheme: "uttori-source",
      path: `/${file}`,
      query: new URLSearchParams({ root, revision: revision ?? "", file }).toString(),
    });
  }
  /** Read immutable blob bytes for a revision through native Git. */
  async readFile(uri: Uri): Promise<Uint8Array> {
    const values = new URLSearchParams(uri.query);
    const root = values.get("root")!,
      revision = values.get("revision")!,
      file = values.get("file")!;
    if (!this.roots.has(root)) {
      throw FileSystemError.NoPermissions("Select this source project before opening its history.");
    }
    assertSourcePath(file);
    if (!revision) {
      return new Uint8Array();
    }
    assertSourceObjectId(revision);
    return (
      await sourceGit(root, ["show", `${revision}:${file}`], { maxOutputBytes: 32 * 1024 * 1024 })
    ).stdout;
  }
  /** Report file size from the resolved blob length. */
  async stat(uri: Uri): Promise<FileStat> {
    return { type: FileType.File, ctime: 0, mtime: 0, size: (await this.readFile(uri)).length };
  }
  /** History URIs address single files; directories are not enumerated. */
  readDirectory(): [string, FileType][] {
    return [];
  }
  /** No file watching is required for immutable revision blobs. */
  watch(): { dispose(): void } {
    return { dispose() {} };
  }
  /** Mutations are rejected because Git history is read-only. */
  createDirectory(): never {
    throw FileSystemError.NoPermissions("Git history is immutable.");
  }
  /** Mutations are rejected because Git history is read-only. */
  writeFile(): never {
    throw FileSystemError.NoPermissions("Git history is immutable.");
  }
  /** Mutations are rejected because Git history is read-only. */
  delete(): never {
    throw FileSystemError.NoPermissions("Git history is immutable.");
  }
  /** Mutations are rejected because Git history is read-only. */
  rename(): never {
    throw FileSystemError.NoPermissions("Git history is immutable.");
  }
  /** Dispose change emitters when the provider is torn down. */
  dispose(): void {
    this.changes.dispose();
  }
}

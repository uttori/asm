import { assertSourceObjectId, assertSourcePath, sourceGit } from "@uttori/asm-disassembler";
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
  readonly changes = new EventEmitter<FileChangeEvent[]>();
  readonly onDidChangeFile = this.changes.event;
  readonly roots = new Set<string>();

  uri(root: string, revision: string | null, file: string): Uri {
    this.roots.add(root);
    return Uri.from({
      scheme: "uttori-source",
      path: `/${file}`,
      query: new URLSearchParams({ root, revision: revision ?? "", file }).toString(),
    });
  }
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
  async stat(uri: Uri): Promise<FileStat> {
    return { type: FileType.File, ctime: 0, mtime: 0, size: (await this.readFile(uri)).length };
  }
  readDirectory(): [string, FileType][] {
    return [];
  }
  watch(): { dispose(): void } {
    return { dispose() {} };
  }
  createDirectory(): never {
    throw FileSystemError.NoPermissions("Git history is immutable.");
  }
  writeFile(): never {
    throw FileSystemError.NoPermissions("Git history is immutable.");
  }
  delete(): never {
    throw FileSystemError.NoPermissions("Git history is immutable.");
  }
  rename(): never {
    throw FileSystemError.NoPermissions("Git history is immutable.");
  }
  dispose(): void {
    this.changes.dispose();
  }
}

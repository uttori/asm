import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { assertSourceObjectId, assertSourcePath, sourceGit, type SourceRepository } from "./git.js";
import { createSourceScratch } from "./scratch.js";

/** HEAD entries are immutable; working-file content is deliberately never cached between comparisons. */
interface TreeEntry {
  readonly mode: string;
  readonly object: string;
  readonly file: string;
}

/**
 * Hash current raw blob bytes with native crypto, independently of Git's stat cache.
 * Only an exact existing object match may avoid Git's slower content ingestion.
 */
function matchesRawBlob(
  root: string,
  entry: TreeEntry,
  buffer: Buffer,
  fileMode: boolean,
): boolean {
  const file = path.join(root, entry.file);
  try {
    const stat = fs.lstatSync(file);
    const hash = createHash("sha1");
    if (entry.mode === "120000") {
      if (!stat.isSymbolicLink()) {
        return false;
      }
      const target = fs.readlinkSync(file, { encoding: "buffer" });
      hash.update(`blob ${target.length}\0`);
      hash.update(target);
    } else {
      if (
        !stat.isFile() ||
        (fileMode && Boolean(stat.mode & 0o100) !== (entry.mode === "100755"))
      ) {
        return false;
      }
      const handle = fs.openSync(file, "r");
      try {
        const opened = fs.fstatSync(handle);
        hash.update(`blob ${opened.size}\0`);
        let count: number;
        while ((count = fs.readSync(handle, buffer, 0, buffer.length, null)) > 0) {
          hash.update(buffer.subarray(0, count));
        }
      } finally {
        fs.closeSync(handle);
      }
    }
    return hash.digest("hex") === entry.object;
  } catch (error) {
    // Missing files and changed directory/symlink topology belong to Git's ordinary add/delete path.
    if (
      error instanceof Error &&
      "code" in error &&
      ["ENOENT", "ENOTDIR", "EISDIR"].includes(String(error.code))
    ) {
      return false;
    }
    throw error;
  }
}

/**
 * One operation owns this scratch index and immutable HEAD inventory; dispose it in finally.
 * Current bytes are hashed on every snapshot, including same-size edits with restored timestamps.
 */
export class SourceSnapshotIndex {
  readonly #scratch;
  readonly #indexFile: string;
  #head?: string;
  #entries: TreeEntry[] = [];
  #utf8Inventory = true;

  constructor(readonly repository: SourceRepository) {
    fs.mkdirSync(repository.stateDirectory, { recursive: true });
    this.#scratch = createSourceScratch(repository, "preview");
    this.#indexFile = path.join(this.#scratch.directory, "index");
  }

  /** Build a complete current tree without consulting or updating the user's staging index. */
  async snapshot(
    overlays: readonly { readonly path: string; readonly bytes: Uint8Array }[] = [],
  ): Promise<string> {
    const root = this.repository.root;
    const indexFile = this.#indexFile;
    const head = (await sourceGit(root, ["rev-parse", "HEAD"])).stdout.toString("utf8").trim();
    // Reuse immutable tree entries, never cached stat data or assume-unchanged flags.
    // A fresh private index also drops previously untracked files that became ignored.
    fs.rmSync(indexFile, { force: true });
    await sourceGit(root, ["read-tree", head], { indexFile });
    if (head !== this.#head) {
      const listed = (await sourceGit(root, ["ls-files", "--stage", "-z"], { indexFile })).stdout;
      this.#utf8Inventory = Buffer.from(listed.toString("utf8"), "utf8").equals(listed);
      this.#entries = listed
        .toString("utf8")
        .split("\0")
        .filter(Boolean)
        .map((record) => {
          const match = /^(\d+) ([\da-f]+) 0\t([\S\s]+)$/.exec(record);
          if (!match) {
            throw new Error("Invalid private snapshot index entry.");
          }
          return { mode: match[1], object: match[2], file: match[3] };
        });
      this.#head = head;
    }
    const others = (
      await sourceGit(root, ["ls-files", "--others", "--exclude-standard", "-z"], { indexFile })
    ).stdout;
    const files = [
      ...this.#entries.map((entry) => entry.file),
      ...others.toString("utf8").split("\0").filter(Boolean),
    ];
    const input = files.length ? `${files.join("\0")}\0` : "";
    const attributes = await sourceGit(root, ["check-attr", "--all", "-z", "--stdin"], {
      input,
      indexFile,
    });
    // Git accepts several boolean spellings, including numeric values. Let Git
    // normalize them instead of letting an approximate parser change mode or sparse semantics.
    const [autocrlf, fileMode, symlinks, sparse] = await Promise.all(
      ["core.autocrlf", "core.filemode", "core.symlinks", "core.sparsecheckout"].map((key) =>
        sourceGit(
          root,
          key === "core.autocrlf" ? ["config", "--get", key] : ["config", "--bool", "--get", key],
          { acceptedCodes: [0, 1] },
        ),
      ),
    );
    const rawNewlines =
      autocrlf.code === 1 || /^(?:false|no|off|0)$/i.test(autocrlf.stdout.toString("utf8").trim());
    const honorFileMode = fileMode.stdout.toString("utf8").trim() !== "false";
    // Replacing a directory with a symlink requires Git's recursive topology
    // handling, rather than pathspecs for children beyond that new link.
    const directories = new Set(this.#entries.map((entry) => path.dirname(entry.file)));
    let ordinaryDirectories = true;
    for (const directory of directories) {
      let current = directory;
      while (current !== ".") {
        try {
          if (!fs.lstatSync(path.join(root, current)).isDirectory()) {
            ordinaryDirectories = false;
            break;
          }
        } catch {
          ordinaryDirectories = false;
          break;
        }
        current = path.dirname(current);
      }
    }
    const raw =
      ordinaryDirectories &&
      this.#utf8Inventory &&
      Buffer.from(others.toString("utf8"), "utf8").equals(others) &&
      attributes.stdout.length === 0 &&
      sparse.stdout.toString("utf8").trim() !== "true" &&
      rawNewlines &&
      symlinks.stdout.toString("utf8").trim() !== "false" &&
      this.#entries.every(
        (entry) =>
          ["100644", "100755", "120000"].includes(entry.mode) && entry.object.length === 40,
      );
    if (raw) {
      // Native crypto checks every byte instead of trusting timestamps. Git still owns
      // new/changed objects, deletes, executable modes, path quoting and tree construction.
      const buffer = Buffer.allocUnsafe(4 * 1024 * 1024);
      const modified = this.#entries.filter(
        (entry) => !matchesRawBlob(root, entry, buffer, honorFileMode),
      );
      const changed = modified.map((entry) => entry.file);
      changed.push(...others.toString("utf8").split("\0").filter(Boolean));
      if (changed.length) {
        await sourceGit(
          root,
          ["--literal-pathspecs", "add", "--all", "--pathspec-from-file=-", "--pathspec-file-nul"],
          {
            indexFile,
            input: `${changed.join("\0")}\0`,
          },
        );
      }
    } else {
      // Attributes, normalization, submodules and alternate object formats need Git's
      // full semantics. Never treat a raw byte hash as proof for a filtered blob.
      await sourceGit(root, ["add", "--all", "--", "."], { indexFile });
    }
    const paths = new Set<string>();
    let total = 0;
    for (const overlay of overlays) {
      assertSourcePath(overlay.path);
      const identity = overlay.path.normalize("NFC").toLowerCase();
      total += overlay.bytes.length;
      if (paths.has(identity) || total > 256 * 1024 * 1024 || paths.size >= 32768) {
        throw new Error("Preview buffers contain duplicate paths or exceed the snapshot budget.");
      }
      paths.add(identity);
      const blob = (
        await sourceGit(root, ["hash-object", "-w", "--no-filters", "--stdin"], {
          input: overlay.bytes,
        })
      ).stdout
        .toString("utf8")
        .trim();
      const entry = (
        await sourceGit(root, ["ls-files", "--stage", "-z", "--", overlay.path], { indexFile })
      ).stdout.toString("utf8");
      if (entry && !entry.startsWith("100644 ") && !entry.startsWith("100755 ")) {
        throw new Error(`Preview cannot replace a symlink or submodule buffer: ${overlay.path}`);
      }
      const mode = entry.startsWith("100755 ") ? "100755" : "100644";
      await sourceGit(root, ["update-index", "--add", "--cacheinfo", mode, blob, overlay.path], {
        indexFile,
      });
    }
    const tree = (await sourceGit(root, ["write-tree"], { indexFile })).stdout
      .toString("utf8")
      .trim();
    assertSourceObjectId(tree);
    return tree;
  }

  /** Release the private scratch index and any temporary Git state. */
  dispose(): void {
    this.#scratch.dispose();
  }
}

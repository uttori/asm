import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { acquireFileLease, durableReplace, type FileLease } from "../internal/durable-files.js";
import type { SourceRepository } from "./git.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Private, disposable work; none of these directories can contain authoritative source or evidence. */
type ScratchPurpose = "generation" | "preview" | "prepare";

/** Cleanup reports uncertain ownership instead of deleting unrecognized data. */
export interface SourceScratchCleanup {
  readonly removed: string[];
  readonly retained: { readonly path: string; readonly reason: string }[];
}

// oxlint-disable-next-line security/detect-unsafe-regex -- Every repetition has a fixed small bound.
const uuidPattern = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/;

/** Keep ownership until every payload is gone, so interruption never strands unidentifiable data.
 * The caller holds both the maintenance lease and this directory's active lease.
 */
function removeScratch(directory: string, lease: FileLease): void {
  for (const entry of fs.readdirSync(directory)) {
    if (entry !== "owner.json" && entry !== "active.lock") {
      fs.rmSync(path.join(directory, entry), { recursive: true });
    }
  }
  // The maintenance lease excludes new owners while the last two markers disappear.
  // A crash after removing owner.json leaves only an empty directory, removable without recursion.
  lease.release();
  fs.unlinkSync(path.join(directory, "owner.json"));
  fs.rmdirSync(directory);
}

/** Caller holds the maintenance lease so creation cannot race a missing owner record. */
function pruneScratch(directory: string): SourceScratchCleanup {
  const result: SourceScratchCleanup = { removed: [], retained: [] };
  if (!fs.existsSync(directory)) {
    return result;
  }
  if (!fs.lstatSync(directory).isDirectory()) {
    throw new Error("The source scratch root must be an owned directory, not a symlink.");
  }
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const root = path.join(directory, entry.name);
    try {
      if (!entry.isDirectory() || !uuidPattern.test(entry.name)) {
        throw new Error("Unrecognized scratch path");
      }
      if (fs.readdirSync(root).length === 0) {
        // Empty directories can remain between final marker removal and rmdir. Never recurse
        // without ownership: an unexpected concurrent insertion makes rmdir fail safely.
        fs.rmdirSync(root);
        result.removed.push(root);
        continue;
      }
      const marker = path.join(root, "owner.json");
      const stat = fs.lstatSync(marker);
      if (!stat.isFile() || stat.size > 4096) {
        throw new Error("Unrecognized scratch owner");
      }
      const owner: unknown = JSON.parse(fs.readFileSync(marker, "utf8"));
      if (
        !isRecord(owner) ||
        owner.format !== "uttori-source-scratch-v1" ||
        owner.id !== entry.name ||
        (owner.purpose !== "generation" &&
          owner.purpose !== "preview" &&
          owner.purpose !== "prepare")
      ) {
        throw new Error("Unrecognized scratch owner");
      }
      // Local dead-owner detection is shared with publication. Live processes,
      // reused PIDs and unknown hosts cannot have their scratch files reclaimed.
      const lease = acquireFileLease(path.join(root, "active.lock"));
      try {
        removeScratch(root, lease);
        result.removed.push(root);
      } finally {
        lease.release();
      }
    } catch (error) {
      result.retained.push({ path: root, reason: String(error) });
    }
  }
  return result;
}

/** Reclaim interrupted owned work in this worktree; never inspect or alter its source checkout. */
export function pruneSourceScratch(repository: SourceRepository): SourceScratchCleanup {
  const maintenance = acquireFileLease(path.join(repository.stateDirectory, "scratch.lock"));
  try {
    return pruneScratch(path.join(repository.stateDirectory, "scratch"));
  } finally {
    maintenance.release();
  }
}

/**
 * A leased directory survives SIGKILL only until the next source operation.
 * Creation/publication of the owner record is serialized with cleanup; dispose belongs in finally.
 */
export function createSourceScratch(
  repository: SourceRepository,
  purpose: ScratchPurpose,
): {
  readonly directory: string;
  readonly cleanup: SourceScratchCleanup;
  dispose(): void;
} {
  const maintenance = acquireFileLease(path.join(repository.stateDirectory, "scratch.lock"));
  const parent = path.join(repository.stateDirectory, "scratch");
  const id = randomUUID();
  const directory = path.join(parent, id);
  try {
    const cleanup = pruneScratch(parent);
    fs.mkdirSync(directory, { recursive: true });
    const lease = acquireFileLease(path.join(directory, "active.lock"));
    try {
      durableReplace(
        path.join(directory, "owner.json"),
        JSON.stringify({ format: "uttori-source-scratch-v1", id, purpose }),
      );
    } catch (error) {
      lease.release();
      fs.rmSync(directory, { recursive: true });
      throw error;
    }
    return {
      directory,
      cleanup,
      dispose() {
        const disposal = acquireFileLease(path.join(repository.stateDirectory, "scratch.lock"));
        try {
          if (fs.existsSync(directory)) {
            removeScratch(directory, lease);
          }
        } finally {
          try {
            lease.release();
          } finally {
            disposal.release();
          }
        }
      },
    };
  } finally {
    maintenance.release();
  }
}

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/** Publication marker is outside generated manifests and is never a generated-file override. */
export const SOURCE_PUBLICATION_STATE = ".uttori-publication.json";

/** Durable publication outcome. Retained sibling trees contain exact previous/candidate bytes. */
export interface SourcePublicationState {
  readonly id: string;
  readonly phase: "publishing" | "published" | "rolled-back" | "blocked";
  readonly previous: string;
  readonly candidate: string;
  /** Exact previous/candidate manifest byte digests, independent of SQLite revision identity. */
  readonly before: string;
  readonly after: string;
  /** Verified whole-ROM digest, including a copier header when present. */
  readonly romSha256: string;
  readonly revision: string;
  readonly verifiedAt: string;
  readonly files: readonly { path: string; before: string | null; after: string | null }[];
}

/** Read the journal without entering generated source. Used by recovery and status workers.
 * @param {string} directory Source-export directory.
 * @returns {SourcePublicationState | undefined} Latest journal, or undefined for legacy exports.
 */
export function readSourcePublication(directory: string): SourcePublicationState | undefined {
  const file = path.join(directory, SOURCE_PUBLICATION_STATE);
  return fs.existsSync(file)
    ? (JSON.parse(fs.readFileSync(file, "utf8")) as SourcePublicationState)
    : undefined;
}

/** Pin a readable generation before consuming files. Repeat after a build/read to detect a switch.
 * Legacy exports use the manifest hash; journaled exports also reject incomplete replacement.
 * @param {string} directory Source-export directory.
 * @returns {string} Manifest digest plus publication identity; throws while recovery is required.
 */
export function sourceGenerationIdentity(directory: string): string {
  const state = readSourcePublication(directory);
  if (state?.phase === "publishing" || state?.phase === "blocked") {
    throw new Error(
      `Source publication ${state.id} requires recovery. Run Assembly: Recover Disassembly Publication. Previous verified source: ${state.previous}`,
    );
  }
  const identity = createHash("sha256")
    .update(fs.readFileSync(path.join(directory, "generated-files.json")))
    .digest("hex");
  return `${identity}:${state?.id ?? "legacy"}:${state?.phase ?? "untracked"}`;
}

/** Reject a source switch, including a currently incomplete publication.
 * @param {string} directory Export root pinned before reading.
 * @param {string} expected Identity returned before the operation.
 */
export function assertSourceGeneration(directory: string, expected: string): void {
  if (sourceGenerationIdentity(directory) !== expected) {
    throw new Error(
      "Source generation changed during this operation. Retry against the current generation.",
    );
  }
}

import {
  sourceGit,
  sourceStatusPaths,
  type SourceMergePreview,
} from "@uttori/asm-disassembler/source-project";

/** Immutable revisions and paths for native text/image diffs; reading them never updates the checkout. */
export interface SourceGenerationReview {
  /** Git tree or commit used as the left side of each diff. */
  readonly before: string;
  /** Git tree or commit used as the right side of each diff. */
  readonly after: string;
  /** A preview compares the captured source with the proposed merge, including conflict markers. */
  readonly previewed: boolean;
  readonly files: readonly {
    readonly path: string;
    /** Git's A/M/D status; renames are represented as a deletion and an addition. */
    readonly status: string;
    /** Git reported this path as unmerged in the preview. */
    readonly conflict: boolean;
  }[];
  /** Existing staged/working edits and captured unsaved buffers that need preservation before Apply. */
  readonly localChanges: readonly string[];
}

/** Review the proposed merge when available, otherwise review changes between pure generations. */
export async function readSourceGenerationReview(
  root: string,
  candidate: string,
  preview?: SourceMergePreview,
): Promise<SourceGenerationReview> {
  const previewed = preview?.candidate === candidate;
  let before: string;
  let after = candidate;
  let localChanges: string[] = [];
  if (previewed) {
    // Comparing with the captured source avoids presenting already-authored changes as new output.
    before = preview.sourceTree;
    after = preview.resultTree;
    const [changes, status] = await Promise.all([
      sourceGit(root, ["diff", "--name-only", "-z", preview.head, preview.sourceTree]),
      sourceGit(root, ["status", "--porcelain=v1", "-z", "--untracked-files=all"]),
    ]);
    // The snapshot contains editor drafts; porcelain also catches staged edits reverted in the
    // working file. Either kind would prevent a native merge from using clean HEAD as its abort point.
    localChanges = [
      ...new Set([
        ...changes.stdout.toString("utf8").split("\0").filter(Boolean),
        ...sourceStatusPaths(status.stdout),
      ]),
    ];
  } else {
    before = (await sourceGit(root, ["rev-parse", `${candidate}^`])).stdout.toString().trim();
  }
  const diff = await sourceGit(root, [
    "diff",
    "--no-renames",
    "--name-status",
    "-z",
    before,
    after,
  ]);
  const parts = diff.stdout.toString("utf8").split("\0");
  const conflicts = new Set(previewed ? preview.conflicts : []);
  const files: SourceGenerationReview["files"][number][] = [];
  // --no-renames gives exactly one status/path pair, even for paths containing whitespace.
  for (let index = 0; index + 1 < parts.length; index += 2) {
    const file = parts[index + 1];
    files.push({ path: file, status: parts[index], conflict: conflicts.has(file) });
  }
  return { before, after, previewed, files, localChanges };
}

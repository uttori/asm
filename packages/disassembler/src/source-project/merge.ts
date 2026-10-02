import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { canonicalJson } from "@uttori/asm-core/canonical-json";

import { acquireFileLease, durableReplace } from "../internal/durable-files.js";
import {
  acceptedSourceGeneration,
  generationAt,
  sourceContentHash,
  sourceCandidateRef,
  SOURCE_GENERATION_FILE,
  verifySourceGeneration,
  type SourceGeneration,
} from "./generation.js";
import {
  assertNoSourceOperation,
  assertSourcePath,
  assertSourceCheckpoint,
  assertSourceObjectId,
  sourceGit,
  type SourceRepository,
} from "./git.js";
import { registerSourcePinOwner } from "./pins.js";
import { createSourceScratch } from "./scratch.js";

/** Preview describes saved working files, including unstaged edits, without changing Git's real index. */
export interface SourceMergePreview {
  readonly head: string;
  readonly sourceTree: string;
  readonly candidate: string;
  readonly base: string;
  readonly resultTree: string;
  readonly conflicts: readonly string[];
  /** Git's full diagnostic stream includes nontext conflicts that have no conflict markers. */
  readonly messages: string;
  /** One retained preview per worktree; replacing this ref releases the previous preview snapshot. */
  readonly ref?: string;
}

/** Verification belongs to an exact staged tree and matching binary/debug-map pair. */
export interface SourceBuildVerification {
  readonly outputSha256: string;
  readonly debugMapSha256: string;
  readonly toolchainSha256: string;
  readonly checks: readonly string[];
}

/** Worktree-local recovery hints. Native Git state remains authoritative after terminal operations. */
export interface SourceMergeJournal {
  readonly format: "uttori-source-merge";
  readonly id: string;
  readonly kind: "adopt" | "regenerate";
  readonly before: string;
  readonly candidate: string;
  readonly candidateRef: string;
  readonly branch: string;
  readonly validatedTree?: string;
  readonly verification?: SourceBuildVerification;
}

/** A journal never reports a terminal commit as verified unless its exact tree was checked. */
export interface SourceMergeStatus {
  readonly phase: "idle" | "merging" | "checkpoint" | "committed" | "verified" | "diverged";
  readonly head: string;
  readonly conflicts: readonly string[];
  readonly journal?: SourceMergeJournal;
}

const journalFile = (repository: SourceRepository): string =>
  path.join(repository.stateDirectory, "merge.json");

/** Read only known journal fields; malformed recovery state must not trigger an automatic reset. */
function readJournal(repository: SourceRepository): SourceMergeJournal | undefined {
  const file = journalFile(repository);
  if (!fs.existsSync(file)) {
    return undefined;
  }
  const value: unknown = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!isJournalRecord(value)) {
    throw new Error("Invalid regeneration recovery journal. Inspect it before continuing.");
  }
  const before = value.before;
  const candidate = value.candidate;
  const validatedTree = value.validatedTree;
  if (!isMergeJournal(value)) {
    throw new Error("Invalid regeneration recovery journal. Inspect it before continuing.");
  }
  assertSourceObjectId(gitObjectId(before));
  assertSourceObjectId(gitObjectId(candidate));
  if (validatedTree) {
    assertSourceObjectId(gitObjectId(validatedTree));
  }
  return value;
}

function isJournalRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMergeKind(value: unknown): value is SourceMergeJournal["kind"] {
  return value === "adopt" || value === "regenerate";
}

function isMergeJournal(value: unknown): value is SourceMergeJournal {
  if (!isJournalRecord(value)) {
    return false;
  }
  const branch = value.branch;
  const candidateRef = value.candidateRef;
  return (
    value.format === "uttori-source-merge" &&
    isMergeKind(value.kind) &&
    typeof branch === "string" &&
    branch.startsWith("refs/heads/") &&
    typeof candidateRef === "string" &&
    /^refs\/uttori\/candidates\/[\w-]+$/.test(candidateRef)
  );
}

function gitObjectId(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Expected a complete Git object ID.");
  }
  return value;
}

/** Compare source trees using a private index, preserving partial staging in the real index. */
export async function snapshotSourceTree(
  repository: SourceRepository,
  overlays: readonly { readonly path: string; readonly bytes: Uint8Array }[] = [],
): Promise<string> {
  fs.mkdirSync(repository.stateDirectory, { recursive: true });
  const scratch = createSourceScratch(repository, "preview");
  const indexFile = path.join(scratch.directory, "index");
  try {
    await sourceGit(repository.root, ["read-tree", "HEAD"], { indexFile });
    await sourceGit(repository.root, ["add", "--all", "--", "."], { indexFile });
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
      // Editor buffers become Git blobs through the private index; no save, stash, filter, or real
      // index update is needed. Apply later requires these exact bytes in a committed checkpoint.
      const blob = (
        await sourceGit(repository.root, ["hash-object", "-w", "--no-filters", "--stdin"], {
          input: overlay.bytes,
        })
      ).stdout
        .toString("utf8")
        .trim();
      const entry = (
        await sourceGit(repository.root, ["ls-files", "--stage", "-z", "--", overlay.path], {
          indexFile,
        })
      ).stdout.toString("utf8");
      if (entry && !entry.startsWith("100644 ") && !entry.startsWith("100755 ")) {
        throw new Error(`Preview cannot replace a symlink or submodule buffer: ${overlay.path}`);
      }
      const mode = entry.startsWith("100755 ") ? "100755" : "100644";
      await sourceGit(
        repository.root,
        ["update-index", "--add", "--cacheinfo", mode, blob, overlay.path],
        { indexFile },
      );
    }
    return (await sourceGit(repository.root, ["write-tree"], { indexFile })).stdout
      .toString("utf8")
      .trim();
  } finally {
    scratch.dispose();
  }
}

/** Render a merge preview against saved edits. No commit is added to the user's branch. */
export async function previewSourceGeneration(
  repository: SourceRepository,
  candidate: string,
  overlays: readonly { readonly path: string; readonly bytes: Uint8Array }[] = [],
): Promise<SourceMergePreview> {
  assertNoSourceOperation(repository);
  assertSourceObjectId(candidate);
  const head = (await sourceGit(repository.root, ["rev-parse", "HEAD"])).stdout
    .toString("utf8")
    .trim();
  const base = await acceptedSourceGeneration(repository, head);
  const sourceTree = await snapshotSourceTree(repository, overlays);
  if (candidate === base) {
    return {
      head,
      sourceTree,
      candidate,
      base,
      resultTree: sourceTree,
      conflicts: [],
      messages: "",
    };
  }
  const parents = (
    await sourceGit(repository.root, ["rev-list", "--parents", "-n", "1", candidate])
  ).stdout
    .toString("utf8")
    .trim()
    .split(" ");
  if (parents.length !== 2 || parents[1] !== base) {
    throw new Error("Generate the candidate from this source branch's accepted generation.");
  }
  const { descriptor: incoming } = await verifySourceGeneration(repository, candidate);
  const previous = await generationAt(repository, base);
  if (
    incoming.inputs.project !== previous.inputs.project ||
    incoming.inputs.romSha256 !== previous.inputs.romSha256
  ) {
    throw new Error("Incoming generation has a different project or ROM identity.");
  }
  const snapshot = (
    await sourceGit(repository.root, ["commit-tree", sourceTree, "-p", head], {
      input: "Source preview snapshot\n",
    })
  ).stdout
    .toString("utf8")
    .trim();
  const merged = await sourceGit(
    repository.root,
    ["merge-tree", "--write-tree", "--name-only", "-z", snapshot, candidate],
    { acceptedCodes: [0, 1] },
  );
  const fields = merged.stdout.toString("utf8").split("\0");
  const resultTree = fields.shift()!;
  assertSourceObjectId(resultTree);
  const end = fields.indexOf("");
  const conflicts = end < 0 ? fields.filter(Boolean) : fields.slice(0, end);
  // A tree ID in a JSON response is not a GC root. Pin the result and both inputs in an isolated
  // review commit; this ref never becomes a source or pure-generation parent.
  const review = (
    await sourceGit(repository.root, ["commit-tree", resultTree, "-p", snapshot, "-p", candidate], {
      input: "Retained source regeneration preview\n",
    })
  ).stdout
    .toString("utf8")
    .trim();
  const ref = `refs/uttori/previews/${sourceContentHash(repository.gitDirectory).slice(0, 24)}`;
  await registerSourcePinOwner(repository);
  await sourceGit(repository.root, ["update-ref", "--no-deref", ref, review]);
  return {
    head,
    sourceTree,
    candidate,
    base,
    resultTree,
    conflicts,
    messages: fields.slice(end + 1).join("\0"),
    ref,
  };
}

/** List actual unmerged index entries, including binary and delete conflicts. */
async function unmergedPaths(repository: SourceRepository): Promise<string[]> {
  const result = await sourceGit(repository.root, ["diff", "--name-only", "--diff-filter=U", "-z"]);
  return result.stdout.toString("utf8").split("\0").filter(Boolean);
}

/** Reconcile extension restarts and Git operations performed from another terminal. */
export async function sourceMergeStatus(repository: SourceRepository): Promise<SourceMergeStatus> {
  const head = (await sourceGit(repository.root, ["rev-parse", "HEAD"])).stdout
    .toString("utf8")
    .trim();
  const journal = readJournal(repository);
  const conflicts = await unmergedPaths(repository);
  if (!journal) {
    return { phase: "idle", head, conflicts };
  }
  const branch = (
    await sourceGit(repository.root, ["symbolic-ref", "-q", "HEAD"], { acceptedCodes: [0, 1] })
  ).stdout
    .toString("utf8")
    .trim();
  if (branch !== journal.branch) {
    return { phase: "diverged", head, conflicts, journal };
  }
  const mergeHead = path.join(repository.gitDirectory, "MERGE_HEAD");
  if (fs.existsSync(mergeHead)) {
    const pending = fs.readFileSync(mergeHead, "utf8").trim();
    const phase = pending === journal.candidate && head === journal.before ? "merging" : "diverged";
    return { phase, head, conflicts, journal };
  }
  if (head === journal.before) {
    return { phase: "checkpoint", head, conflicts, journal };
  }
  const ancestor = await sourceGit(
    repository.root,
    ["merge-base", "--is-ancestor", journal.candidate, head],
    { acceptedCodes: [0, 1] },
  );
  if (ancestor.code !== 0) {
    return { phase: "diverged", head, conflicts, journal };
  }
  const tree = (await sourceGit(repository.root, ["rev-parse", `${head}^{tree}`])).stdout
    .toString("utf8")
    .trim();
  const phase = tree === journal.validatedTree && journal.verification ? "verified" : "committed";
  return { phase, head, conflicts, journal };
}

/** Record the pre-operation checkpoint before invoking Git so a killed process can be reconciled. */
async function beginJournal(
  repository: SourceRepository,
  generation: SourceGeneration,
  kind: SourceMergeJournal["kind"],
): Promise<SourceMergeJournal> {
  assertSourceObjectId(generation.commit);
  if (!/^refs\/uttori\/candidates\/[\w-]+$/.test(generation.ref)) {
    throw new Error("Invalid generation candidate ref.");
  }
  const verified = await verifySourceGeneration(repository, generation.commit);
  if (canonicalJson(verified.descriptor) !== canonicalJson(generation.descriptor)) {
    throw new Error("Candidate descriptor changed since preparation.");
  }
  const status = await sourceMergeStatus(repository);
  if (["merging", "diverged"].includes(status.phase)) {
    throw new Error("Resolve the previous regeneration operation first.");
  }
  const before = await assertSourceCheckpoint(repository);
  const branch = (await sourceGit(repository.root, ["symbolic-ref", "-q", "HEAD"])).stdout
    .toString("utf8")
    .trim();
  const pinned = (await sourceGit(repository.root, ["rev-parse", generation.ref])).stdout
    .toString("utf8")
    .trim();
  if (pinned !== generation.commit) {
    throw new Error("The incoming generation ref changed.");
  }
  const journal: SourceMergeJournal = {
    format: "uttori-source-merge",
    id: randomUUID(),
    before,
    candidate: generation.commit,
    candidateRef: generation.ref,
    branch,
    kind,
  };
  durableReplace(journalFile(repository), canonicalJson(journal));
  return journal;
}

/**
 * Adopt a verified existing export exactly once. The caller explicitly requested initialization;
 * the pending merge still needs normal validation and a user-visible commit.
 */
export async function adoptSourceGeneration(
  repository: SourceRepository,
  generation: SourceGeneration,
): Promise<SourceMergeStatus> {
  const lease = acquireFileLease(path.join(repository.stateDirectory, "operation.lock"));
  try {
    if (fs.existsSync(path.join(repository.root, SOURCE_GENERATION_FILE))) {
      throw new Error("This source project already has a generation descriptor.");
    }
    const checkpoint = await assertSourceCheckpoint(repository);
    const baseline = await verifySourceGeneration(repository, generation.commit);
    const listing = (await sourceGit(repository.root, ["ls-tree", "-r", "-z", checkpoint])).stdout
      .toString("utf8")
      .split("\0")
      .filter(Boolean);
    const current = new Map(
      listing.map((line) => [
        line.slice(line.indexOf("\t") + 1),
        line.slice(0, line.indexOf("\t")),
      ]),
    );
    const changed = baseline.files.filter(
      (entry) => current.get(entry.path) !== `${entry.mode} blob ${entry.blob}`,
    );
    if (changed.length) {
      throw new Error(
        `Adoption requires a matching verified baseline; mismatched paths: ${changed.map((entry) => entry.path).join(", ")}`,
      );
    }
    await beginJournal(repository, generation, "adopt");
    await sourceGit(repository.root, [
      "merge",
      "--allow-unrelated-histories",
      "--strategy=ours",
      "--no-ff",
      "--no-commit",
      generation.commit,
    ]);
    durableReplace(
      path.join(repository.root, SOURCE_GENERATION_FILE),
      canonicalJson(generation.descriptor),
    );
    await sourceGit(repository.root, ["add", "--", SOURCE_GENERATION_FILE]);
    return await sourceMergeStatus(repository);
  } finally {
    lease.release();
  }
}

/** Apply only the previewed source contents after a clean explicit checkpoint. */
export async function applySourceGeneration(
  repository: SourceRepository,
  generation: SourceGeneration,
  preview: SourceMergePreview,
): Promise<SourceMergeStatus> {
  const lease = acquireFileLease(path.join(repository.stateDirectory, "operation.lock"));
  try {
    const head = await assertSourceCheckpoint(repository);
    const tree = (await sourceGit(repository.root, ["rev-parse", `${head}^{tree}`])).stdout
      .toString("utf8")
      .trim();
    if (
      generation.commit !== preview.candidate ||
      tree !== preview.sourceTree ||
      (await acceptedSourceGeneration(repository, head)) !== preview.base
    ) {
      throw new Error("Regeneration preview is stale. Preview the current checkpoint again.");
    }
    if (generation.commit === preview.base) {
      return await sourceMergeStatus(repository);
    }
    // Receipts may arrive through an untyped CLI or editor message. Revalidate native ancestry
    // instead of trusting that the caller obtained its preview from this process.
    await previewSourceGeneration(repository, generation.commit);
    await beginJournal(repository, generation, "regenerate");
    await sourceGit(repository.root, ["merge", "--no-ff", "--no-commit", generation.commit], {
      acceptedCodes: [0, 1],
    });
    return await sourceMergeStatus(repository);
  } finally {
    lease.release();
  }
}

/**
 * Validate the exact staged/worktree result, then create the ordinary merge commit when needed.
 * Existing terminal commits are verified in place. Git hooks are honored; a hook changing the tree
 * invalidates the receipt rather than receiving a false pass.
 */
export async function finishSourceGeneration(
  repository: SourceRepository,
  options: {
    readonly message: string;
    readonly validate: (tree: string) => Promise<SourceBuildVerification>;
  },
): Promise<SourceMergeStatus> {
  const lease = acquireFileLease(path.join(repository.stateDirectory, "operation.lock"));
  try {
    const status = await sourceMergeStatus(repository);
    if (!["merging", "committed"].includes(status.phase) || !status.journal) {
      throw new Error("There is no matching regeneration merge to finish.");
    }
    // A terminal commit is already source history. Verify it without creating another commit, and
    // require a clean checkout so the target cannot accidentally validate subsequent local edits.
    const alreadyCommitted = status.phase === "committed";
    if (alreadyCommitted) {
      await assertSourceCheckpoint(repository);
    }
    if (status.conflicts.length) {
      throw new Error("Resolve and stage every merge conflict before verification.");
    }
    const staged = (await sourceGit(repository.root, ["write-tree"])).stdout
      .toString("utf8")
      .trim();
    if (staged !== (await snapshotSourceTree(repository))) {
      throw new Error(
        "Stage the intended result before verification; working files differ from the staged tree.",
      );
    }
    const verification = await options.validate(staged);
    for (const value of [
      verification.outputSha256,
      verification.debugMapSha256,
      verification.toolchainSha256,
    ]) {
      if (!/^[\da-f]{64}$/.test(value)) {
        throw new Error("Build verification requires complete SHA-256 identities.");
      }
    }
    if (!verification.checks.length) {
      throw new Error("Build verification must record the checks performed.");
    }
    const after = await sourceMergeStatus(repository);
    const indexTree = (await sourceGit(repository.root, ["write-tree"])).stdout
      .toString("utf8")
      .trim();
    if (
      after.phase !== status.phase ||
      after.head !== status.head ||
      indexTree !== staged ||
      (await snapshotSourceTree(repository)) !== staged
    ) {
      throw new Error(
        "Source changed during validation. Validate the current staged result again.",
      );
    }
    durableReplace(
      journalFile(repository),
      canonicalJson({ ...status.journal, validatedTree: staged, verification }),
    );
    if (!alreadyCommitted) {
      await sourceGit(repository.root, ["commit", "-F", "-"], { input: options.message + "\n" });
    }
    const finished = await sourceMergeStatus(repository);
    if (finished.phase === "verified") {
      // The merge's ancestry now retains the exact generation. Extra candidate/preview pins add no recovery value.
      await releaseCandidatePin(repository, status.journal.candidateRef, status.journal.candidate);
      await clearSourcePreview(repository);
    }
    return finished;
  } finally {
    lease.release();
  }
}

/** Release only the expected candidate; an absent pin is already retired, but a changed ref is protected. */
async function releaseCandidatePin(
  repository: SourceRepository,
  ref: string,
  candidate: string,
): Promise<void> {
  const removed = await sourceGit(
    repository.root,
    ["update-ref", "--no-deref", "-d", ref, candidate],
    {
      acceptedCodes: [0, 1],
    },
  );
  if (removed.code === 0) {
    return;
  }
  // A prior finish or interrupted cleanup may have released the pin. Confirm absence after the
  // compare-and-delete failure; never retry without the expected value and delete a replaced ref.
  const remaining = await sourceGit(repository.root, ["rev-parse", "--verify", ref], {
    acceptedCodes: [0, 128],
  });
  if (remaining.code !== 128) {
    throw new Error(
      `Candidate pin could not be released: ${removed.stderr.toString("utf8").trim()}`,
    );
  }
}

/** Release this worktree's replaceable preview; never delete source history or working files. */
async function clearSourcePreview(repository: SourceRepository): Promise<void> {
  const ref = `refs/uttori/previews/${sourceContentHash(repository.gitDirectory).slice(0, 24)}`;
  await sourceGit(repository.root, ["update-ref", "--no-deref", "-d", ref]);
  fs.rmSync(path.join(repository.stateDirectory, "preview.json"), { force: true });
}

/** Explicitly discard an unneeded pure candidate. Git's usual object expiry controls eventual reclamation. */
export async function discardSourceGeneration(
  repository: SourceRepository,
  candidate: string,
): Promise<void> {
  assertSourceObjectId(candidate);
  const lease = acquireFileLease(path.join(repository.stateDirectory, "operation.lock"));
  try {
    const status = await sourceMergeStatus(repository);
    if (status.journal?.candidate === candidate && ["merging", "diverged"].includes(status.phase)) {
      throw new Error("Finish or abort the pending regeneration before discarding its candidate.");
    }
    await verifySourceGeneration(repository, candidate);
    // Preview snapshots retain both parents, so release the matching preview pin as well.
    const previewRef = `refs/uttori/previews/${sourceContentHash(repository.gitDirectory).slice(0, 24)}`;
    const preview = await sourceGit(repository.root, ["rev-parse", "--verify", previewRef], {
      acceptedCodes: [0, 128],
    });
    if (preview.code === 0) {
      const parents = (
        await sourceGit(repository.root, [
          "rev-list",
          "--parents",
          "-n",
          "1",
          preview.stdout.toString("utf8").trim(),
        ])
      ).stdout
        .toString("utf8")
        .trim()
        .split(" ");
      if (parents[2] === candidate) {
        await clearSourcePreview(repository);
      }
    }
    // A sibling worktree can have the same candidate pending. Its pin and preview remain owned there.
    await releaseCandidatePin(repository, sourceCandidateRef(repository, candidate), candidate);
  } finally {
    lease.release();
  }
}

/** Abort only our active merge. No stash, reset, or untracked-file cleanup is performed. */
export async function abortSourceGeneration(
  repository: SourceRepository,
): Promise<SourceMergeStatus> {
  const lease = acquireFileLease(path.join(repository.stateDirectory, "operation.lock"));
  try {
    const status = await sourceMergeStatus(repository);
    if (status.phase !== "merging") {
      throw new Error("There is no matching regeneration merge to abort.");
    }
    await sourceGit(repository.root, ["merge", "--abort"]);
    return await sourceMergeStatus(repository);
  } finally {
    lease.release();
  }
}

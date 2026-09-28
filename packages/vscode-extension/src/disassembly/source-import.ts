import fs from "node:fs";
import path from "node:path";

import {
  acquireFileLease,
  durableReplace,
  loadSourceExportManifest,
  openAnalysisProjectStore,
  sourceExportSha256,
  validateSourceExportFiles,
  type MetadataOperation,
} from "@uttori/asm-disassembler";
import {
  buildRetainedModification,
  buildModifiedRom,
  loadRomModificationProject,
  modificationOwnedPath,
  publishModificationManifest,
  type SourceEditReview,
  type ModificationOperationOptions,
} from "@uttori/asm-plugin-snes";

import type { ResolvedTarget } from "./maintenance-data.js";
import { metadataSnapshot, processMetadata, type MetadataWorkerInput } from "./metadata-data.js";
import { publishVerifiedSource } from "./source-publisher.js";

/** A persisted import can resume after metadata commit, input publication, or source restoration. */
interface ImportState {
  readonly metadataInput?: MetadataWorkerInput;
  readonly metadataSaved?: boolean;
  readonly ownedSaved?: boolean;
  readonly restored?: boolean;
  readonly complete?: boolean;
}

/** Import a reviewed edit through native metadata or a bounded owned input, then restore verified source.
 * @param {object} options Exact review digest prevents accepting a preview that changed while the user inspected it.
 * @returns {Promise<string>} Human-readable result including draft retention and any required rebase.
 */
export async function importReviewedSource(
  options: Omit<ModificationOperationOptions, "manifestFile"> & {
    reviewFile: string;
    reviewSha256: string;
    target: ResolvedTarget;
  },
): Promise<string> {
  const bytes = fs.readFileSync(options.reviewFile);
  if (sourceExportSha256(bytes) !== options.reviewSha256) {
    throw new Error("Source review changed. Review it again.");
  }
  const review = JSON.parse(bytes.toString("utf8")) as SourceEditReview;
  if (
    review.format !== "uttori-source-edit-review" ||
    review.unsupported ||
    (!review.metadata && !review.replacement)
  ) {
    throw new Error(review.unsupported ?? "Invalid source review.");
  }
  const root = path.dirname(review.manifestFile);
  const project = loadRomModificationProject(review.manifestFile);
  const sourceDirectory = path.resolve(root, project.baseline.sourceDirectory);
  if (
    sourceDirectory !== path.resolve(options.target.sourceDirectory) ||
    path.resolve(sourceDirectory, review.relative) !== review.sourceFile
  ) {
    throw new Error("Source review belongs to another export.");
  }
  const stateFile = path.join(path.dirname(options.reviewFile), "import-state.json");
  let state: ImportState = fs.existsSync(stateFile)
    ? (JSON.parse(fs.readFileSync(stateFile, "utf8")) as ImportState)
    : {};
  if (state.complete) {
    return `Source edit already imported. Exact draft: ${review.draftFile}`;
  }
  const save = (next: ImportState): void => {
    state = { ...state, ...next };
    durableReplace(stateFile, JSON.stringify(state, null, 2));
  };
  if (
    state.metadataSaved &&
    state.restored &&
    sourceExportSha256(fs.readFileSync(path.join(sourceDirectory, "generated-files.json"))) !==
      project.baseline.manifestSha256
  ) {
    validateSourceExportFiles(sourceDirectory);
    await publishVerifiedSource(
      options.target,
      options.signal ?? new AbortController().signal,
      options.onProgress ?? (() => {}),
    );
    save({ complete: true });
    return `Source import publication recovered. Draft retained at ${review.draftFile}; rebase the modification project before building.`;
  }
  let lease: ReturnType<typeof acquireFileLease> | undefined = acquireFileLease(
    path.join(sourceDirectory, ".uttori-publication.lock"),
  );
  try {
    const manifest = loadSourceExportManifest(sourceDirectory);
    if (
      sourceExportSha256(fs.readFileSync(path.join(sourceDirectory, "generated-files.json"))) !==
      project.baseline.manifestSha256
    ) {
      throw new Error("Source generation changed. Preserve this draft and prepare a new review.");
    }
    const entry = manifest.files.find((item) => item.path === review.relative);
    if (
      entry?.sha256 !== review.baselineSha256 ||
      sourceExportSha256(fs.readFileSync(review.baselineFile)) !== review.baselineSha256 ||
      sourceExportSha256(fs.readFileSync(review.draftFile)) !== review.sourceSha256
    ) {
      throw new Error("Retained source review bytes changed.");
    }
    const actual = sourceExportSha256(fs.readFileSync(review.sourceFile));
    if (actual !== review.sourceSha256 && actual !== review.baselineSha256) {
      throw new Error(
        "Source changed after review; the newer edit is preserved. Prepare a new review.",
      );
    }
    // Reconcile one file only. Unrelated external edits must never be silently restored or imported.
    for (const other of manifest.files) {
      if (
        other.path !== review.relative &&
        sourceExportSha256(fs.readFileSync(path.join(sourceDirectory, other.path))) !== other.sha256
      ) {
        throw new Error(
          `Another generated file changed: ${other.path}. Preserve and reconcile it separately.`,
        );
      }
    }
    options.signal?.throwIfAborted();
    if (review.metadata && !state.metadataSaved) {
      const store = openAnalysisProjectStore(options.target.projectDirectory);
      try {
        if (!state.metadataInput) {
          const snapshot = metadataSnapshot(store);
          if (snapshot.revision?.manifestSha256 !== review.sourceProjectSha256) {
            throw new Error(
              "Native metadata changed since this source generation. Preserve the draft and regenerate/review against the current owners.",
            );
          }
          const action = review.metadata;
          let operation: MetadataOperation;
          if (action.kind === "remove-label") {
            operation = {
              kind: "remove-label",
              id: action.id,
              preserveComments: true,
              preserveEntryPoint: true,
            };
          } else if (action.kind === "rename-label") {
            const record = snapshot.shards.labels.find((item) => item.id === action.id);
            if (!record) {
              throw new Error("Native label no longer exists.");
            }
            operation = {
              kind: "put",
              shard: "labels",
              record: { ...record, sourceName: action.name },
            };
          } else {
            const record = snapshot.shards.comments.find((item) => item.id === action.id);
            if (!record) {
              throw new Error("Native comment no longer exists.");
            }
            operation = {
              kind: "put",
              shard: "comments",
              record: { ...record, text: action.text },
            };
          }
          const input: MetadataWorkerInput = {
            action: "commit",
            sourceDirectory,
            source: { file: review.sourceFile, sha256: actual },
            revision: snapshot.revision,
            request: {
              id: review.id,
              evidenceId: `evidence:${review.id}`,
              sourceId: "source-import",
              description: `Import reviewed source edit from ${review.relative}`,
              operations: [operation],
            },
          };
          processMetadata(store, options.target.projectDirectory, { ...input, action: "preview" });
          save({ metadataInput: input });
        }
        // The metadata coordinator acquires the same publication lease. Release ours for that
        // revision-guarded commit, then reacquire and recheck source before any restoration.
        lease.release();
        lease = undefined;
        processMetadata(store, options.target.projectDirectory, state.metadataInput!);
        lease = acquireFileLease(path.join(sourceDirectory, ".uttori-publication.lock"));
        if (sourceExportSha256(fs.readFileSync(review.sourceFile)) !== actual) {
          throw new Error(
            "Source changed while metadata was saved. Draft retained; inspect the newer edit before restoring.",
          );
        }
        save({ metadataSaved: true });
      } finally {
        store.close();
      }
    }
    if (review.replacement && !state.ownedSaved) {
      const modLease = acquireFileLease(path.join(root, ".build.lock"));
      try {
        const current = loadRomModificationProject(review.manifestFile);
        if (!current.replacements.some((item) => item.id === review.replacement!.id)) {
          if (sourceExportSha256(fs.readFileSync(review.manifestFile)) !== review.manifestSha256) {
            throw new Error("Modification project changed after review.");
          }
          const input = modificationOwnedPath(root, review.replacement.input);
          const draft = fs.readFileSync(review.replacementFile!);
          if (sourceExportSha256(draft) !== review.replacementSha256) {
            throw new Error(
              "Imported replacement draft changed after review. Prepare a new review.",
            );
          }
          if (fs.existsSync(input) && !fs.readFileSync(input).equals(draft)) {
            throw new Error("Preserved imported input changed. Review it before retrying.");
          }
          durableReplace(input, draft);
          const candidate = {
            ...current,
            replacements: [...current.replacements, review.replacement],
          };
          const candidateFile = path.join(root, `.import-${review.id}.json`);
          durableReplace(candidateFile, JSON.stringify(candidate));
          // Prove size, branch and ownership constraints against the retained clean generation before restoring source.
          await buildRetainedModification({
            ...options,
            manifestFile: candidateFile,
            directory: path.join(path.dirname(options.reviewFile), `verification-${Date.now()}`),
          });
          publishModificationManifest(review.manifestFile, candidate);
        }
        save({ ownedSaved: true });
      } finally {
        modLease.release();
      }
    }
    if (sourceExportSha256(fs.readFileSync(review.sourceFile)) !== actual) {
      throw new Error(
        "Source changed during import. Ownership was preserved; review the newer source before restoring.",
      );
    }
    // The complete original edit was saved before any ownership transition; restoration never discards it.
    durableReplace(review.sourceFile, fs.readFileSync(review.baselineFile));
    validateSourceExportFiles(sourceDirectory, manifest);
    save({ restored: true });
  } finally {
    lease?.release();
  }
  if (review.metadata) {
    await publishVerifiedSource(
      options.target,
      options.signal ?? new AbortController().signal,
      options.onProgress ?? (() => {}),
    );
  } else {
    await buildModifiedRom({ ...options, manifestFile: review.manifestFile });
  }
  save({ complete: true });
  return `Imported ${review.relative}; exact draft retained at ${review.draftFile}.${review.metadata ? " Source regenerated and ROM verified. Rebase the modification project onto this new generation before its next build." : " Owned modification built successfully; baseline source restored."}`;
}

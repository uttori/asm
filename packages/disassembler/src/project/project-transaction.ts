import { createHash } from "node:crypto";
import * as fs from "node:fs";
import path from "node:path";

import { canonicalJson } from "@uttori/asm-core/canonical-json";

import {
  ANALYSIS_PROJECT_MANIFEST,
  type AnalysisProject,
  type AnalysisProjectManifest,
  type AnalysisProjectShards,
  type LoadedAnalysisProject,
  type LoadedAnalysisProjectView,
  type RuntimeRecordProjection,
} from "../model/project-types.js";
import {
  validateAnalysisProjectManifest,
  validateLoadedShards,
} from "../model/project-validation.js";
import { SqliteAnalysisStore, ANALYSIS_PROJECT_SQLITE_FILE } from "../storage/sqlite-store.js";
import {
  loadAnalysisProject,
  loadAnalysisProjectView,
  openAnalysisProjectStore,
} from "./project-store.js";

/** Identity marker for optimistic project revision tokens. */
export const ANALYSIS_PROJECT_REVISION_FORMAT = "uttori-asm-analysis-revision";
/** Revision token contract. The hash now covers the authoritative database manifest and counter. */
export const ANALYSIS_PROJECT_REVISION_VERSION = 1;

/**
 * Opaque optimistic token for a saved project, not a ROM hash or schema version.
 * Publications advance the counter even when the semantic records are unchanged.
 */
export interface AnalysisProjectRevision {
  /** Marks the object as an analysis project revision token. */
  readonly format: typeof ANALYSIS_PROJECT_REVISION_FORMAT;
  /** Token contract version. */
  readonly version: typeof ANALYSIS_PROJECT_REVISION_VERSION;
  /** SHA-256 of the canonical database manifest, including its publication counter. */
  readonly manifestSha256: string;
}

/** Complete records and the revision read in the same SQLite snapshot. */
export interface AnalysisProjectSnapshot extends LoadedAnalysisProject {
  /** Revision of exactly these records; pass it back to detect concurrent writers. */
  readonly revision: AnalysisProjectRevision;
}

/** Projected records and the revision of their complete backing store. */
export interface AnalysisProjectViewSnapshot extends LoadedAnalysisProjectView {
  /** Revision of the complete store the projection was read from. */
  readonly revision: AnalysisProjectRevision;
}

/** Validation result retaining the caller's project reference. No copy, lock, or revision reservation. */
export interface PreparedAnalysisProjectTransaction {
  /** The caller's validated replacement, not a copy. */
  readonly project: AnalysisProject;
}

/** Explicit SQLite maintenance result. Ordinary commits return zero removed bytes and no warnings. */
export interface AnalysisProjectMaintenanceResult {
  /** Reduction in main database file size. Excludes WAL and source capture files. */
  readonly removedBytes: number;
  /** Deferred maintenance notices; the commit has already succeeded. */
  readonly warnings: readonly string[];
}

/**
 * Manifest and revision published atomically with the changed records.
 * A later watcher-pointer refresh failure emits a process warning and does not undo the commit.
 */
export interface CommittedAnalysisProjectTransaction {
  /** Authoritative manifest written in the commit. */
  readonly manifest: AnalysisProjectManifest;
  /** Revision token derived from manifest, valid for the next optimistic write. */
  readonly revision: AnalysisProjectRevision;
  /** Post-commit maintenance outcome. */
  readonly maintenance: AnalysisProjectMaintenanceResult;
}

/**
 * The expected revision is stale and nothing was committed. Reload and reapply the user's intent.
 * Substituting a fresh token on the old replacement can overwrite another writer's work.
 */
export class AnalysisProjectStaleError extends Error {
  constructor(
    readonly expected: AnalysisProjectRevision,
    readonly actual: AnalysisProjectRevision,
  ) {
    super(
      `Analysis project changed since it was loaded (expected ${expected.manifestSha256}, found ${actual.manifestSha256}).`,
    );
    this.name = "AnalysisProjectStaleError";
  }
}

/**
 * Derive an optimistic identity from the database, never the potentially stale watcher file.
 * @param manifest Authoritative manifest read inside a SQLite transaction.
 * @returns Stable token including the publication counter.
 */
export const analysisProjectRevision = (
  manifest: AnalysisProjectManifest,
): AnalysisProjectRevision => ({
  format: ANALYSIS_PROJECT_REVISION_FORMAT,
  version: ANALYSIS_PROJECT_REVISION_VERSION,
  manifestSha256: createHash("sha256").update(canonicalJson(manifest)).digest("hex"),
});

/**
 * Check a caller's revision inside the transaction that will consume its snapshot.
 * @param store Connection holding a read or write transaction.
 * @param expected Revision observed by the editing client.
 */
export const assertAnalysisProjectRevision = (
  store: SqliteAnalysisStore,
  expected: AnalysisProjectRevision,
): void => {
  const actual = analysisProjectRevision(store.manifest());
  if (expected.manifestSha256 !== actual.manifestSha256) {
    throw new AnalysisProjectStaleError(expected, actual);
  }
};

/**
 * Read complete validated records and their revision in one snapshot.
 * @param directory Existing project root.
 * @returns Complete validated records and their optimistic token.
 */
export const loadAnalysisProjectSnapshot = (directory: string): AnalysisProjectSnapshot => {
  const project = loadAnalysisProject(directory);
  return { ...project, revision: analysisProjectRevision(project.manifest) };
};

/**
 * Read metadata and an optional streamed runtime projection from one database snapshot.
 * @param directory Existing project root.
 * @param [createProjection] Optional runtime reducer. The default omits runtime.
 * @returns Metadata or projection and its optimistic token.
 */
export const loadAnalysisProjectViewSnapshot = (
  directory: string,
  createProjection?: () => RuntimeRecordProjection,
): AnalysisProjectViewSnapshot => {
  const project = loadAnalysisProjectView(directory, createProjection);
  return { ...project, revision: analysisProjectRevision(project.manifest) };
};

/**
 * Validate a complete replacement without changing persistent state. Commit validates it again.
 * Holds the same project reference. Preparation neither binds a destination nor reserves a revision.
 * @param _directory Destination root, retained for the preparation API contract.
 * @param project Caller-owned complete replacement.
 * @returns Validated replacement. The caller retains ownership.
 */
export const prepareAnalysisProjectTransaction = (
  _directory: string,
  project: AnalysisProject,
): PreparedAnalysisProjectTransaction => {
  validateAnalysisProjectManifest(project.manifest);
  validateLoadedShards(project.shards, project.manifest);
  return { project };
};

/**
 * Build a commit result for a published manifest with no maintenance performed.
 * @param manifest Manifest written by the commit.
 * @returns Commit identity with zero removed bytes and no warnings.
 */
const committed = (manifest: AnalysisProjectManifest): CommittedAnalysisProjectTransaction => ({
  manifest,
  revision: analysisProjectRevision(manifest),
  maintenance: { removedBytes: 0, warnings: [] },
});

/**
 * Publish a validated replacement under SQLite's writer lock. Full writes replace runtime as well.
 * View writes provide only changed metadata tables and cannot erase the omitted runtime history.
 * @param directory Destination project root.
 * @param project Proposed complete semantic view for validation.
 * @param expected Required revision, or undefined only for creation.
 * @param [updates] Tables to replace. Omitted to replace the full project.
 * @returns Committed identity. Storage or validation errors leave it unchanged.
 */
const publish = (
  directory: string,
  project: AnalysisProject,
  expected: AnalysisProjectRevision | undefined,
  updates: Partial<AnalysisProjectShards> = project.shards,
): CommittedAnalysisProjectTransaction => {
  prepareAnalysisProjectTransaction(directory, project);
  fs.mkdirSync(directory, { recursive: true });
  const exists = fs.existsSync(path.join(directory, ANALYSIS_PROJECT_MANIFEST));
  const store = exists
    ? openAnalysisProjectStore(directory)
    : new SqliteAnalysisStore(path.join(directory, ANALYSIS_PROJECT_SQLITE_FILE));
  try {
    const manifest = store.transaction(() => {
      if (expected) {
        assertAnalysisProjectRevision(store, expected);
      } else if (store.revision() !== 0) {
        throw new Error("Analysis project already exists. Reload before publishing.");
      }
      // Scan retained runtime provenance only when evidence IDs were removed. Ordinary label edits
      // and imports must not traverse millions of unrelated runtime facts.
      const evidenceIds = new Set(project.shards.evidence.map(({ id }) => id));
      const removedEvidence =
        updates.runtime === undefined &&
        updates.evidence !== undefined &&
        store.loadTable("evidence").some(({ id }) => !evidenceIds.has(id));
      store.replaceTables(updates);
      if (removedEvidence) {
        store.validateRuntimeEvidence();
      }
      return store.publishManifest(project.manifest);
    });
    store.writePointer(directory);
    return committed(manifest);
  } finally {
    store.close();
  }
};

/**
 * Commit a complete prepared replacement against the revision observed by its caller.
 * @param directory Destination project root.
 * @param expected Observed revision. Undefined permits initial creation only.
 * @param prepared Caller-owned replacement, revalidated at commit.
 * @returns Committed manifest and revision.
 */
export const commitPreparedAnalysisProjectTransaction = (
  directory: string,
  expected: AnalysisProjectRevision | undefined,
  prepared: PreparedAnalysisProjectTransaction,
): CommittedAnalysisProjectTransaction => publish(directory, prepared.project, expected);

/**
 * Atomically replace all records after rejecting stale readers under the SQLite writer lock.
 * Validation, revision, or SQLite failures leave the previous publication intact. These synchronous
 * APIs have no AbortSignal. Check cancellation before calling, or throw inside a low-level transaction.
 * @param directory Existing project root.
 * @param expected Revision observed by the editing client.
 * @param project Complete replacement. Runtime is replaced too.
 * @returns Committed manifest and revision.
 */
export const commitAnalysisProjectTransaction = (
  directory: string,
  expected: AnalysisProjectRevision,
  project: AnalysisProject,
): CommittedAnalysisProjectTransaction => publish(directory, project, expected);

/**
 * Replace explicitly supplied metadata tables and preserve omitted tables and all runtime history.
 * Each supplied array is the entire replacement table, including an empty array to clear it.
 * @param directory Existing project root.
 * @param snapshot Original metadata view and revision.
 * @param updates Metadata table replacements. Any runtime property is rejected.
 * @returns Committed identity with complete runtime preserved.
 */
export const commitAnalysisProjectViewUpdate = (
  directory: string,
  snapshot: AnalysisProjectViewSnapshot,
  updates: Partial<Omit<AnalysisProjectShards, "runtime">>,
): CommittedAnalysisProjectTransaction => {
  if ("runtime" in updates) {
    throw new Error("Read-view updates cannot replace runtime history.");
  }
  const project = {
    manifest: snapshot.manifest,
    shards: { ...snapshot.view, ...updates, runtime: [] },
  };
  // Snapshot arrays are not frozen at runtime. Explicit replacement requests must not disappear
  // merely because a JavaScript caller edited the same array. SQLite compares unchanged rows.
  return publish(directory, project, snapshot.revision, updates);
};

/**
 * Create a project, or explicitly replace it against a caller-observed revision.
 * Omitting expected permits creation only; it never samples a newer revision on the caller's behalf.
 * Prefer metadata updates for ordinary edits so retained runtime history cannot be replaced accidentally.
 */
export const publishAnalysisProject = (
  directory: string,
  project: AnalysisProject,
  expected?: AnalysisProjectRevision,
): CommittedAnalysisProjectTransaction => publish(directory, project, expected);

/**
 * Explicitly checkpoint and VACUUM SQLite. Optional analysisOnly retention advances the revision
 * after consolidating SNES snapshots; ordinary compaction preserves logical identity. Temporary
 * space scales with live pages, and active readers can delay the final checkpoint.
 * @param directory Existing SQLite project root.
 * @param [options] Explicit retention selection and synchronous progress/cancellation hook.
 * @returns Published identity and reclaimed main-file bytes.
 */
export const compactAnalysisProject = (
  directory: string,
  options: {
    readonly analysisOnly?: boolean;
    readonly onProgress?: (message: string) => void;
  } = {},
): CommittedAnalysisProjectTransaction => {
  const store = openAnalysisProjectStore(directory);
  try {
    const before = fs.statSync(store.file).size;
    if (options.analysisOnly) {
      store.retainSnesAnalysisEvidence(options.onProgress);
      store.writePointer(directory);
    }
    store.compact();
    return {
      ...committed(store.manifest()),
      maintenance: {
        removedBytes: Math.max(0, before - fs.statSync(store.file).size),
        warnings: [],
      },
    };
  } finally {
    store.close();
  }
};

import { createHash } from "node:crypto";
import * as fs from "node:fs";
import path from "node:path";
import { canonicalJson } from "./canonical-json.js";
import { loadAnalysisProject, loadAnalysisProjectView, openAnalysisProjectStore, } from "./project-store.js";
import { ANALYSIS_PROJECT_MANIFEST, } from "./project-types.js";
import { validateAnalysisProjectManifest, validateLoadedShards } from "./project-validation.js";
import { SqliteAnalysisStore, ANALYSIS_PROJECT_SQLITE_FILE } from "./sqlite-store.js";
/** Identity marker for optimistic project revision tokens. */
export const ANALYSIS_PROJECT_REVISION_FORMAT = "uttori-asm-analysis-revision";
/** Revision token contract; the hash now covers the authoritative database manifest and counter. */
export const ANALYSIS_PROJECT_REVISION_VERSION = 1;
/**
 * The expected revision is stale and nothing was committed. Reload and reapply the user's intent;
 * substituting a fresh token on the old replacement can overwrite another writer's work.
 */
export class AnalysisProjectStaleError extends Error {
    expected;
    actual;
    constructor(expected, actual) {
        super(`Analysis project changed since it was loaded (expected ${expected.manifestSha256}, found ${actual.manifestSha256}).`);
        this.expected = expected;
        this.actual = actual;
        this.name = "AnalysisProjectStaleError";
    }
}
/**
 * Derive an optimistic identity from the database, never the potentially stale watcher file.
 * @param {AnalysisProjectManifest} manifest Authoritative manifest read inside a SQLite transaction.
 * @returns {AnalysisProjectRevision} Stable token including the publication counter.
 */
export const analysisProjectRevision = (manifest) => ({
    format: ANALYSIS_PROJECT_REVISION_FORMAT,
    version: ANALYSIS_PROJECT_REVISION_VERSION,
    manifestSha256: createHash("sha256").update(canonicalJson(manifest)).digest("hex"),
});
/**
 * Check a caller's revision inside the transaction that will consume its snapshot.
 * @param {SqliteAnalysisStore} store Connection holding a read or write transaction.
 * @param {AnalysisProjectRevision} expected Revision observed by the editing client.
 */
export const assertAnalysisProjectRevision = (store, expected) => {
    const actual = analysisProjectRevision(store.manifest());
    if (expected.manifestSha256 !== actual.manifestSha256) {
        throw new AnalysisProjectStaleError(expected, actual);
    }
};
/**
 * Read complete validated records and their revision in one snapshot.
 * @param {string} directory Existing project root.
 * @returns {AnalysisProjectSnapshot} Complete validated records and their optimistic token.
 */
export const loadAnalysisProjectSnapshot = (directory) => {
    const project = loadAnalysisProject(directory);
    return { ...project, revision: analysisProjectRevision(project.manifest) };
};
/**
 * Read metadata and an optional streamed runtime projection from one database snapshot.
 * @param {string} directory Existing project root.
 * @param {Function} [createProjection] Optional runtime reducer; the default omits runtime.
 * @returns {AnalysisProjectViewSnapshot} Metadata or projection and its optimistic token.
 */
export const loadAnalysisProjectViewSnapshot = (directory, createProjection) => {
    const project = loadAnalysisProjectView(directory, createProjection);
    return { ...project, revision: analysisProjectRevision(project.manifest) };
};
/**
 * Validate a complete replacement without changing persistent state. Commit validates it again.
 * Holds the same project reference; preparation neither binds a destination nor reserves a revision.
 * @param {string} _directory Destination root, retained for the preparation API contract.
 * @param {AnalysisProject} project Caller-owned complete replacement.
 * @returns {PreparedAnalysisProjectTransaction} Validated replacement; the caller retains ownership.
 */
export const prepareAnalysisProjectTransaction = (_directory, project) => {
    validateAnalysisProjectManifest({ ...project.manifest, shards: [] });
    validateLoadedShards(project.shards, project.manifest);
    return { project };
};
const committed = (manifest) => ({
    manifest,
    revision: analysisProjectRevision(manifest),
    maintenance: { removedBytes: 0, warnings: [] },
});
/**
 * Publish a validated replacement under SQLite's writer lock. Full writes replace runtime as well;
 * view writes provide only changed metadata tables and cannot erase the omitted runtime history.
 * @param {string} directory Destination project root.
 * @param {AnalysisProject} project Proposed complete semantic view for validation.
 * @param {AnalysisProjectRevision | undefined} expected Required revision, or undefined only for creation.
 * @param {Partial<AnalysisProjectShards>} [updates] Tables to replace; omitted to replace the full project.
 * @returns {CommittedAnalysisProjectTransaction} Committed identity; storage or validation errors leave it unchanged.
 */
const publish = (directory, project, expected, updates = project.shards) => {
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
            }
            else if (store.revision() !== 0) {
                throw new Error("Analysis project already exists; reload before publishing.");
            }
            // Scan retained runtime provenance only when evidence IDs were removed. Ordinary label edits
            // and imports must not traverse millions of unrelated runtime facts.
            const evidenceIds = new Set(project.shards.evidence.map(({ id }) => id));
            const removedEvidence = updates.runtime === undefined &&
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
    }
    finally {
        store.close();
    }
};
/**
 * Commit a complete prepared replacement against the revision observed by its caller.
 * @param {string} directory Destination project root.
 * @param {AnalysisProjectRevision | undefined} expected Observed revision; undefined permits initial creation only.
 * @param {PreparedAnalysisProjectTransaction} prepared Caller-owned replacement, revalidated at commit.
 * @returns {CommittedAnalysisProjectTransaction} Committed manifest and revision.
 */
export const commitPreparedAnalysisProjectTransaction = (directory, expected, prepared) => publish(directory, prepared.project, expected);
/**
 * Atomically replace all records after rejecting stale readers under the SQLite writer lock.
 * Validation, revision, or SQLite failures leave the previous publication intact. These synchronous
 * APIs have no AbortSignal; check cancellation before calling, or throw inside a low-level transaction.
 * @param {string} directory Existing project root.
 * @param {AnalysisProjectRevision} expected Revision observed by the editing client.
 * @param {AnalysisProject} project Complete replacement; runtime is replaced too.
 * @returns {CommittedAnalysisProjectTransaction} Committed manifest and revision.
 */
export const commitAnalysisProjectTransaction = (directory, expected, project) => publish(directory, project, expected);
/**
 * Replace explicitly supplied metadata tables and preserve omitted tables and all runtime history.
 * Each supplied array is the entire replacement table, including an empty array to clear it.
 * @param {string} directory Existing project root.
 * @param {AnalysisProjectViewSnapshot} snapshot Original metadata view and revision.
 * @param {object} updates Metadata table replacements; any runtime property is rejected.
 * @returns {CommittedAnalysisProjectTransaction} Committed identity with complete runtime preserved.
 */
export const commitAnalysisProjectViewUpdate = (directory, snapshot, updates) => {
    if ("runtime" in updates) {
        throw new Error("Read-view updates cannot replace runtime history.");
    }
    const project = {
        manifest: snapshot.manifest,
        shards: { ...snapshot.view, ...updates, runtime: [] },
    };
    // Snapshot arrays are not frozen at runtime. Explicit replacement requests must not disappear
    // merely because a JavaScript caller edited the same array; SQLite compares unchanged rows.
    return publish(directory, project, snapshot.revision, updates);
};
/**
 * Publish label/comment edits without loading or revalidating unrelated analysis and runtime.
 * Existing provenance is immutable here, so retained records cannot lose evidence references.
 * @param {string} directory Existing project root.
 * @param {AnalysisProjectRevision} expected Revision on which the edit was based.
 * @param {object} updates Complete labels, comments and evidence tables; evidence may only be appended.
 * @returns {CommittedAnalysisProjectTransaction} Atomically published identity; failures roll back.
 */
export const commitAnalysisProjectAnnotationUpdate = (directory, expected, updates) => {
    if (Object.keys(updates).some((key) => !["labels", "comments", "evidence"].includes(key))) {
        throw new Error("Annotation updates can only replace labels, comments and append evidence.");
    }
    const store = openAnalysisProjectStore(directory);
    try {
        const manifest = store.transaction(() => {
            assertAnalysisProjectRevision(store, expected);
            const current = store.manifest();
            validateAnalysisProjectManifest({ ...current, shards: [] });
            const evidence = new Map(updates.evidence.map((record) => [record.id, record]));
            // Compare authoritative rows, not a mutable caller snapshot. This avoids scanning every
            // retained CFG/runtime reference while still rejecting removed or rewritten provenance.
            for (const record of store.loadTable("evidence")) {
                if (canonicalJson(record) !== canonicalJson(evidence.get(record.id))) {
                    throw new Error(`Annotation updates must preserve existing evidence '${record.id}'.`);
                }
            }
            validateLoadedShards({ annotations: [], analysis: [], regions: [], imports: [], runtime: [], ...updates }, current);
            store.replaceTables(updates);
            return store.publishManifest(current);
        });
        store.writePointer(directory);
        return committed(manifest);
    }
    finally {
        store.close();
    }
};
/** Publish a reversible edit to a selected SQL view without replacing omitted records.
 * Include the original records and all evidence required by the edited selection. Both runtime
 * arrays must be empty. Changed/deleted records are compared by stable ID and original value;
 * the caller's manifest is not a manifest replacement.
 * @param {string} directory Existing project root.
 * @param {AnalysisProjectSnapshot} snapshot Selected original records and their revision.
 * @param {AnalysisProject} project Edited selected view.
 * @returns {CommittedAnalysisProjectTransaction} Atomically committed identity.
 */
export const commitAnalysisProjectSelectedEdit = (directory, snapshot, project) => {
    if (project.shards.runtime.length || snapshot.shards.runtime.length) {
        throw new Error("Selected metadata edits cannot include runtime records.");
    }
    const store = openAnalysisProjectStore(directory);
    try {
        const manifest = store.transaction(() => {
            assertAnalysisProjectRevision(store, snapshot.revision);
            store.validateView(project.shards);
            store.patchMetadata(snapshot.shards, project.shards);
            return store.publishManifest(store.manifest());
        });
        store.writePointer(directory);
        return committed(manifest);
    }
    finally {
        store.close();
    }
};
/**
 * Create or replace a complete project; editing clients should use an explicit snapshot revision.
 * Protects against a writer racing this call, but cannot detect a stale caller-owned replacement.
 * @param {string} directory Destination project root.
 * @param {AnalysisProject} project Complete replacement including runtime.
 * @returns {CommittedAnalysisProjectTransaction} Committed identity and publication result.
 */
export const publishAnalysisProject = (directory, project) => {
    let expected;
    if (fs.existsSync(path.join(directory, ANALYSIS_PROJECT_MANIFEST))) {
        const store = openAnalysisProjectStore(directory);
        try {
            expected = store.transaction(() => analysisProjectRevision(store.manifest()), false);
        }
        finally {
            store.close();
        }
    }
    return publish(directory, project, expected);
};
/**
 * Explicitly checkpoint and VACUUM the current SQLite file without changing its logical revision.
 * Requires temporary free space for a second database copy; active readers can delay checkpoints.
 * @param {string} directory Existing SQLite project root.
 * @returns {CommittedAnalysisProjectTransaction} Unchanged logical identity and reclaimed byte count.
 */
export const compactAnalysisProject = (directory) => {
    const store = openAnalysisProjectStore(directory);
    try {
        const before = fs.statSync(store.file).size;
        store.compact();
        return {
            ...committed(store.manifest()),
            maintenance: {
                removedBytes: Math.max(0, before - fs.statSync(store.file).size),
                warnings: [],
            },
        };
    }
    finally {
        store.close();
    }
};
//# sourceMappingURL=project-transaction.js.map
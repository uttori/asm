import * as fs from "node:fs";
import path from "node:path";
import { publishAnalysisProject } from "./project-transaction.js";
import { ANALYSIS_PROJECT_MANIFEST, } from "./project-types.js";
import { validateAnalysisProjectManifest, validateLoadedShards, createRuntimeRecordValidator, } from "./project-validation.js";
import { compareRuntimeRecordIds } from "./sqlite-records.js";
import { SqliteAnalysisStore, analysisProjectSqlitePath } from "./sqlite-store.js";
export { canonicalJson } from "./canonical-json.js";
export { validateAnalysisProjectManifest, } from "./project-validation.js";
/**
 * Validate the current semantic schema and SQLite pointer, returning the same object without copying.
 * @param {unknown} input Parsed watcher or database manifest.
 * @returns {AnalysisProjectManifest} Validated current manifest. Obsolete containers throw.
 */
export const parseAnalysisProjectManifest = (input) => {
    if (!input || typeof input !== "object") {
        throw new Error("Invalid analysis project manifest.");
    }
    const manifest = input;
    if (manifest.schemaVersion > 3) {
        throw new Error(`Analysis project schema ${manifest.schemaVersion} is newer than supported schema 3. Refusing to downgrade.`);
    }
    validateAnalysisProjectManifest(manifest);
    if (manifest.db !== "analysis.sqlite") {
        throw new Error("Legacy analysis storage is no longer supported. Use a SQLite project.");
    }
    return manifest;
};
/**
 * Open the existing database selected by a validated pointer, without creating missing files.
 * Requires a readable, valid analysis.json even when the database exists. Opening checks the
 * physical format, not every record. Snapshot loaders perform semantic validation.
 * @param {string} directory Project root containing analysis.json.
 * @returns {SqliteAnalysisStore} Owned connection. Close exactly once in a finally block.
 */
export const openAnalysisProjectStore = (directory) => {
    const manifest = parseAnalysisProjectManifest(JSON.parse(fs.readFileSync(path.join(directory, ANALYSIS_PROJECT_MANIFEST), "utf8")));
    return new SqliteAnalysisStore(analysisProjectSqlitePath(directory, manifest), false);
};
/**
 * Load one SQLite read snapshot. Ordinary views skip runtime entirely. Explicit reducers stream
 * and validate each stored fact without a duplicate-ID scratch index or intermediate row array.
 * @param {string} directory Existing project root.
 * @param {boolean} runtime Whether to retain complete runtime history.
 * @param {Function} [createProjection] Optional reducer created inside the read transaction.
 * @returns {LoadedAnalysisProject} Records and manifest from the same database revision.
 */
const loadProject = (directory, runtime, createProjection) => {
    const store = openAnalysisProjectStore(directory);
    try {
        return store.transaction(() => {
            const manifest = parseAnalysisProjectManifest(store.manifest());
            const shards = store.loadShards(false);
            validateLoadedShards(shards, manifest);
            if (!runtime && !createProjection) {
                return { manifest, shards };
            }
            const validate = createRuntimeRecordValidator(manifest, shards.evidence, false);
            const records = [];
            const projection = createProjection?.();
            try {
                for (const record of store.runtimeRecords()) {
                    validate(record);
                    if (projection) {
                        projection.push(record);
                    }
                    else {
                        records.push(record);
                    }
                }
                // Complete materializations retain stable-ID ordering. Streaming projections must
                // not sort a project-sized runtime table merely because the physical layout changed.
                if (!projection) {
                    records.sort(compareRuntimeRecordIds);
                }
                return {
                    manifest,
                    shards: { ...shards, runtime: projection ? projection.finish() : records },
                };
            }
            finally {
                validate.close();
            }
        }, false);
    }
    finally {
        store.close();
    }
};
/**
 * Load and validate the complete project, including all runtime facts.
 * Closes its connection before returning. Editing the result alone changes nothing on disk.
 * @param {string} directory Existing project root.
 * @returns {LoadedAnalysisProject} Complete validated project. Large runtime histories are materialized.
 */
export const loadAnalysisProject = (directory) => loadProject(directory, true);
/**
 * Load metadata only, or stream runtime through an explicit reducer in the same read snapshot.
 * @param {string} directory Existing project root.
 * @param {Function} [createProjection] Reducer for a validated runtime stream. Omitted to skip runtime.
 * @returns {LoadedAnalysisProjectView} Metadata and optional projection from one revision.
 */
export const loadAnalysisProjectView = (directory, createProjection) => {
    const { manifest, shards } = loadProject(directory, false, createProjection);
    return { manifest, view: shards };
};
/**
 * Atomically create or replace all records, including runtime. Use view updates to preserve history.
 * Samples the current revision at call time, so it cannot detect an edit derived from an older
 * caller snapshot. Editing clients must use the explicit revision-checked commit APIs instead.
 * @param {string} directory Project root to create or replace.
 * @param {AnalysisProject} project Complete replacement, including runtime history.
 * @returns {AnalysisProjectManifest} Committed manifest and next revision.
 */
export const writeAnalysisProject = (directory, project) => publishAnalysisProject(directory, project).manifest;
/**
 * Throw if the ROM's full-file hash, headerless-content hash, or copier-header size differs.
 * Does not open the manifest's source path or alter the supplied ROM.
 * @param {AnalysisProjectManifest} manifest Project manifest.
 * @param {RomImage} rom ROM that should be used with this project.
 * @returns {void}
 */
export const validateProjectRom = (manifest, rom) => {
    if (manifest.rom.sha256 !== rom.identity.sha256 ||
        manifest.rom.contentSha256 !== rom.identity.contentSha256 ||
        manifest.rom.headerSize !== rom.identity.headerSize) {
        throw new Error(`ROM identity mismatch: project expects ${manifest.rom.sha256}, received ${rom.identity.sha256}.`);
    }
};
/**
 * Loads and validates a project, optionally checking ROM identity in one step.
 * @param {string} directory Project directory containing `analysis.json`.
 * @param {RomImage} [rom] When provided, must match `manifest.rom`.
 * @returns {LoadedAnalysisProject} Validated project.
 */
export const validateAnalysisProject = (directory, rom) => {
    const project = loadAnalysisProject(directory);
    if (rom) {
        validateProjectRom(project.manifest, rom);
    }
    return project;
};
//# sourceMappingURL=project-store.js.map
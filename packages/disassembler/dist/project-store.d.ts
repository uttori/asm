import { type AnalysisProject, type AnalysisProjectManifest, type AnalysisProjectShards } from "./project-types.js";
import { type RuntimeRecordProjection } from "./project-validation.js";
import type { RomImage } from "./rom-image.js";
import { SqliteAnalysisStore } from "./sqlite-store.js";
export { canonicalJson } from "./canonical-json.js";
export { validateAnalysisProjectManifest, type RuntimeRecordProjection, } from "./project-validation.js";
/**
 * Validate the current semantic schema and SQLite pointer, returning the same object without copying.
 * @param {unknown} input Parsed watcher or database manifest.
 * @returns {AnalysisProjectManifest} Validated current manifest; obsolete containers throw.
 */
export declare const parseAnalysisProjectManifest: (input: unknown) => AnalysisProjectManifest;
/**
 * Open the existing database selected by a validated pointer, without creating missing files.
 * Requires a readable, valid analysis.json even when the database exists. Opening checks the
 * physical format, not every record; snapshot loaders perform semantic validation.
 * @param {string} directory Project root containing analysis.json.
 * @returns {SqliteAnalysisStore} Owned connection; close exactly once in a finally block.
 */
export declare const openAnalysisProjectStore: (directory: string) => SqliteAnalysisStore;
/** One consistent revision, detached from storage; readonly types do not freeze records at runtime. */
export interface LoadedAnalysisProject {
    readonly manifest: AnalysisProjectManifest;
    readonly shards: AnalysisProjectShards;
}
/** Metadata and optional runtime projection. Never pass this partial view to a full replacement. */
export interface LoadedAnalysisProjectView {
    readonly manifest: AnalysisProjectManifest;
    readonly view: AnalysisProjectShards;
}
/**
 * Load and validate the complete project, including all runtime facts.
 * Closes its connection before returning; editing the result alone changes nothing on disk.
 * @param {string} directory Existing project root.
 * @returns {LoadedAnalysisProject} Complete validated project; large runtime histories are materialized.
 */
export declare const loadAnalysisProject: (directory: string) => LoadedAnalysisProject;
/**
 * Load metadata only, or stream runtime through an explicit reducer in the same read snapshot.
 * @param {string} directory Existing project root.
 * @param {Function} [createProjection] Reducer for a validated runtime stream; omitted to skip runtime.
 * @returns {LoadedAnalysisProjectView} Metadata and optional projection from one revision.
 */
export declare const loadAnalysisProjectView: (directory: string, createProjection?: () => RuntimeRecordProjection) => LoadedAnalysisProjectView;
/**
 * Atomically create or replace all records, including runtime. Use view updates to preserve history.
 * Samples the current revision at call time, so it cannot detect an edit derived from an older
 * caller snapshot. Editing clients must use the explicit revision-checked commit APIs instead.
 * @param {string} directory Project root to create or replace.
 * @param {AnalysisProject} project Complete replacement, including runtime history.
 * @returns {AnalysisProjectManifest} Committed manifest and next revision.
 */
export declare const writeAnalysisProject: (directory: string, project: AnalysisProject) => AnalysisProjectManifest;
/**
 * Throw if the ROM's full-file hash, headerless-content hash, or copier-header size differs.
 * Does not open the manifest's source path or alter the supplied ROM.
 * @param {AnalysisProjectManifest} manifest Project manifest.
 * @param {RomImage} rom ROM that should be used with this project.
 * @returns {void}
 */
export declare const validateProjectRom: (manifest: AnalysisProjectManifest, rom: RomImage) => void;
/**
 * Loads and validates a project, optionally checking ROM identity in one step.
 * @param {string} directory Project directory containing `analysis.json`.
 * @param {RomImage} [rom] When provided, must match `manifest.rom`.
 * @returns {LoadedAnalysisProject} Validated project.
 */
export declare const validateAnalysisProject: (directory: string, rom?: RomImage) => LoadedAnalysisProject;
//# sourceMappingURL=project-store.d.ts.map
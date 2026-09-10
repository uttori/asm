import { type AnalysisProject, type AnalysisProjectManifest, type AnalysisProjectShards } from "./project-types.js";
import { type RuntimeRecordProjection } from "./project-validation.js";
import type { RomImage } from "./rom-image.js";
import { SqliteAnalysisStore } from "./sqlite-store.js";
export { canonicalJson } from "./canonical-json.js";
export { validateAnalysisProjectManifest, type RuntimeRecordProjection, } from "./project-validation.js";
/**
 * Parse the current SQLite pointer. Obsolete JSON/shard containers require no compatibility reader.
 * @param {unknown} input Parsed watcher or database manifest.
 * @returns {AnalysisProjectManifest} Validated current manifest; obsolete containers throw.
 */
export declare const parseAnalysisProjectManifest: (input: unknown) => AnalysisProjectManifest;
/**
 * Open the existing database selected by a validated pointer, without creating missing files.
 * @param {string} directory Project root containing analysis.json.
 * @returns {SqliteAnalysisStore} Owned connection; the caller must close it.
 */
export declare const openAnalysisProjectStore: (directory: string) => SqliteAnalysisStore;
/** Current manifest and complete validated in-memory records. */
export interface LoadedAnalysisProject {
    readonly manifest: AnalysisProjectManifest;
    readonly shards: AnalysisProjectShards;
}
/** Metadata and an optional runtime projection; publish with the view-update API. */
export interface LoadedAnalysisProjectView {
    readonly manifest: AnalysisProjectManifest;
    readonly view: AnalysisProjectShards;
}
/**
 * Load and validate the complete project, including all runtime facts.
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
 * @param {string} directory Project root to create or replace.
 * @param {AnalysisProject} project Complete replacement, including runtime history.
 * @returns {AnalysisProjectManifest} Committed manifest and next revision.
 */
export declare const writeAnalysisProject: (directory: string, project: AnalysisProject) => AnalysisProjectManifest;
/**
 * Checks that a loaded ROM matches the project's stored identity.
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
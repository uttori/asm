import { type AnalysisProjectManifest, type LoadedAnalysisProject, type LoadedAnalysisProjectView, type RuntimeRecordProjection } from "../model/project-types.js";
import type { RomImage } from "../model/rom-image.js";
import { SqliteAnalysisStore } from "../storage/sqlite-store.js";
/**
 * Validate the current semantic schema and SQLite pointer, returning the same object without copying.
 * @param {unknown} input Parsed watcher or database manifest.
 * @returns {AnalysisProjectManifest} Validated current manifest. Obsolete containers throw.
 */
export declare const parseAnalysisProjectManifest: (input: unknown) => AnalysisProjectManifest;
/**
 * Open an existing database without initializing storage. A missing watcher pointer is recovered
 * from its validated SQLite manifest; malformed or unreadable pointers still fail explicitly.
 * Opening checks the physical format, not every record. Snapshot loaders validate records.
 * @param {string} directory Project root containing analysis.sqlite and an optional watcher pointer.
 * @returns {SqliteAnalysisStore} Owned connection. Close exactly once in a finally block.
 */
export declare const openAnalysisProjectStore: (directory: string) => SqliteAnalysisStore;
/**
 * Load and validate the complete project, including all runtime facts.
 * Closes its connection before returning. Editing the result alone changes nothing on disk.
 * @param {string} directory Existing project root.
 * @returns {LoadedAnalysisProject} Complete validated project. Large runtime histories are materialized.
 */
export declare const loadAnalysisProject: (directory: string) => LoadedAnalysisProject;
/**
 * Load metadata only, or stream runtime through an explicit reducer in the same read snapshot.
 * @param {string} directory Existing project root.
 * @param {Function} [createProjection] Reducer for a validated runtime stream. Omitted to skip runtime.
 * @returns {LoadedAnalysisProjectView} Metadata and optional projection from one revision.
 */
export declare const loadAnalysisProjectView: (directory: string, createProjection?: () => RuntimeRecordProjection) => LoadedAnalysisProjectView;
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
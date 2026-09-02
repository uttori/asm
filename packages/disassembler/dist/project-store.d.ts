import { type AnalysisProject, type AnalysisProjectManifest, type AnalysisProjectShards } from "./project-types.js";
import type { RomImage } from "./rom-image.js";
/**
 * Deterministic JSON: sorted object keys, dropped `undefined`, trailing newline.
 * @param {unknown} value Manifest or shard payload.
 * @returns {string} Canonical JSON text used for SHA-256 and on-disk writes.
 */
export declare const canonicalJson: (value: unknown) => string;
/**
 * Applies explicit one-way manifest migrations. Newer schema versions are refused.
 * v0 promotes `romHash`/`romSize` into `RomIdentity`; v1 only bumps `schemaVersion`.
 * @param {unknown} input Parsed `analysis.json`.
 * @returns {AnalysisProjectManifest} Current-schema manifest.
 */
export declare const migrateManifest: (input: unknown) => AnalysisProjectManifest;
/** Project as loaded from disk: current-schema manifest plus validated shards. */
export interface LoadedAnalysisProject {
    readonly manifest: AnalysisProjectManifest;
    readonly shards: AnalysisProjectShards;
}
/**
 * Writes canonical `analysis.json` and `analysis/*.json` shards.
 * Records are sorted, ROM byte payloads are forbidden, and shard SHA-256s are recorded.
 * @param {string} directory Destination project directory.
 * @param {AnalysisProject} project Manifest fields plus in-memory shards.
 * @returns {AnalysisProjectManifest} Written manifest including shard descriptors.
 */
export declare const writeAnalysisProject: (directory: string, project: AnalysisProject) => AnalysisProjectManifest;
/**
 * Loads a project, migrating the manifest and verifying each shard SHA-256 and record count.
 * @param {string} directory Project directory containing `analysis.json`.
 * @returns {LoadedAnalysisProject} Validated manifest and shards.
 */
export declare const loadAnalysisProject: (directory: string) => LoadedAnalysisProject;
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
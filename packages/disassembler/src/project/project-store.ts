import * as fs from "node:fs";
import path from "node:path";

import {
  ANALYSIS_PROJECT_MANIFEST,
  type AnalysisProjectManifest,
  type AnalysisProjectShards,
  type LoadedAnalysisProject,
  type LoadedAnalysisProjectView,
  type RuntimeRecordProjection,
} from "../model/project-types.js";
import {
  validateAnalysisProjectManifest,
  validateLoadedShards,
  createRuntimeRecordValidator,
} from "../model/project-validation.js";
import type { RomImage } from "../model/rom-image.js";
import { compareRuntimeRecordIds } from "../storage/sqlite-records.js";
import { SqliteAnalysisStore, analysisProjectSqlitePath } from "../storage/sqlite-store.js";

function isUntrustedManifest(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Validate the current semantic schema and SQLite pointer, returning the same object without copying.
 * @param {unknown} input Parsed watcher or database manifest.
 * @returns {AnalysisProjectManifest} Validated current manifest. Obsolete containers throw.
 */
export const parseAnalysisProjectManifest = (input: unknown): AnalysisProjectManifest => {
  if (!isUntrustedManifest(input)) {
    throw new Error("Invalid analysis project manifest.");
  }
  const schemaVersion = input.schemaVersion;
  if (typeof schemaVersion === "number" && schemaVersion > 3) {
    throw new Error(
      `Analysis project schema ${schemaVersion} is newer than supported schema 3. Refusing to downgrade.`,
    );
  }
  validateAnalysisProjectManifest(input);
  if (input.db !== "analysis.sqlite") {
    throw new Error("Legacy analysis storage is no longer supported. Use a SQLite project.");
  }
  return input;
};

/**
 * Open the existing database selected by a validated pointer, without creating missing files.
 * Requires a readable, valid analysis.json even when the database exists. Opening checks the
 * physical format, not every record. Snapshot loaders perform semantic validation.
 * @param {string} directory Project root containing analysis.json.
 * @returns {SqliteAnalysisStore} Owned connection. Close exactly once in a finally block.
 */
export const openAnalysisProjectStore = (directory: string): SqliteAnalysisStore => {
  const manifest = parseAnalysisProjectManifest(
    JSON.parse(fs.readFileSync(path.join(directory, ANALYSIS_PROJECT_MANIFEST), "utf8")),
  );
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
const loadProject = (
  directory: string,
  runtime: boolean,
  createProjection?: () => RuntimeRecordProjection,
): LoadedAnalysisProject => {
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
      const records: AnalysisProjectShards["runtime"][number][] = [];
      const projection = createProjection?.();
      try {
        for (const record of store.runtimeRecords()) {
          validate(record);
          if (projection) {
            projection.push(record);
          } else {
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
      } finally {
        validate.close();
      }
    }, false);
  } finally {
    store.close();
  }
};

/**
 * Load and validate the complete project, including all runtime facts.
 * Closes its connection before returning. Editing the result alone changes nothing on disk.
 * @param {string} directory Existing project root.
 * @returns {LoadedAnalysisProject} Complete validated project. Large runtime histories are materialized.
 */
export const loadAnalysisProject = (directory: string): LoadedAnalysisProject =>
  loadProject(directory, true);

/**
 * Load metadata only, or stream runtime through an explicit reducer in the same read snapshot.
 * @param {string} directory Existing project root.
 * @param {Function} [createProjection] Reducer for a validated runtime stream. Omitted to skip runtime.
 * @returns {LoadedAnalysisProjectView} Metadata and optional projection from one revision.
 */
export const loadAnalysisProjectView = (
  directory: string,
  createProjection?: () => RuntimeRecordProjection,
): LoadedAnalysisProjectView => {
  const { manifest, shards } = loadProject(directory, false, createProjection);
  return { manifest, view: shards };
};

/**
 * Throw if the ROM's full-file hash, headerless-content hash, or copier-header size differs.
 * Does not open the manifest's source path or alter the supplied ROM.
 * @param {AnalysisProjectManifest} manifest Project manifest.
 * @param {RomImage} rom ROM that should be used with this project.
 * @returns {void}
 */
export const validateProjectRom = (manifest: AnalysisProjectManifest, rom: RomImage): void => {
  if (
    manifest.rom.sha256 !== rom.identity.sha256 ||
    manifest.rom.contentSha256 !== rom.identity.contentSha256 ||
    manifest.rom.headerSize !== rom.identity.headerSize
  ) {
    throw new Error(
      `ROM identity mismatch: project expects ${manifest.rom.sha256}, received ${rom.identity.sha256}.`,
    );
  }
};

/**
 * Loads and validates a project, optionally checking ROM identity in one step.
 * @param {string} directory Project directory containing `analysis.json`.
 * @param {RomImage} [rom] When provided, must match `manifest.rom`.
 * @returns {LoadedAnalysisProject} Validated project.
 */
export const validateAnalysisProject = (
  directory: string,
  rom?: RomImage,
): LoadedAnalysisProject => {
  const project = loadAnalysisProject(directory);
  if (rom) {
    validateProjectRom(project.manifest, rom);
  }
  return project;
};

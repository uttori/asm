import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import type {
  AnalysisProject,
  AnalysisProjectManifest,
  RuntimeEvidenceRecord,
} from "../../src/project-types.js";
import { analysisAddress, runtimeColumns } from "../../src/sqlite-records.js";

/**
 * Populate the historical SQL schema directly, independent of the current store's version gate.
 * @param {string} directory Temporary project root owned by the test.
 * @param {AnalysisProject} project Semantic fixture to encode in the old layout.
 * @returns {AnalysisProjectManifest} Authoritative unchanged identity expected after migration.
 */
export const writeLegacySqliteProject = (
  directory: string,
  project: AnalysisProject,
): AnalysisProjectManifest => {
  fs.mkdirSync(directory, { recursive: true });
  const database = new DatabaseSync(path.join(directory, "analysis.sqlite"));
  const manifest: AnalysisProjectManifest = {
    ...project.manifest,
    db: "analysis.sqlite",
    revision: 7,
    shards: [],
  };
  try {
    database.exec(fs.readFileSync(new URL("./sqlite-format-v0.sql", import.meta.url), "utf8"));
    database.exec("BEGIN");
    for (const [table, records] of Object.entries(project.shards)) {
      const columns = database
        .prepare(`PRAGMA table_info(${table})`)
        .all()
        .map((row) => String(row.name));
      const insert = database.prepare(
        `INSERT INTO ${table} VALUES (${columns.map(() => "?").join(",")})`,
      );
      for (const record of records) {
        let fields: Record<string, unknown> = { ...record, payload: JSON.stringify(record) };
        if (table === "analysis") {
          Object.assign(
            fields,
            analysisAddress(record as AnalysisProject["shards"]["analysis"][number]),
          );
        }
        if (table === "runtime") {
          fields = {
            ...fields,
            ...runtimeColumns(record as RuntimeEvidenceRecord),
            evidence: JSON.stringify((record as RuntimeEvidenceRecord).evidence),
          };
        }
        insert.run(
          ...columns.map((column) => {
            const key = column.replace(/_([a-z])/g, (_match, letter: string) =>
              letter.toUpperCase(),
            );
            return (fields[key] ?? null) as string | number | null;
          }),
        );
      }
    }
    const meta = database.prepare("INSERT INTO meta VALUES (?,?)");
    meta.run("revision", "7");
    meta.run("manifest", JSON.stringify(manifest));
    database.exec("COMMIT");
  } finally {
    database.close();
  }
  fs.writeFileSync(path.join(directory, "analysis.json"), JSON.stringify(manifest));
  return manifest;
};

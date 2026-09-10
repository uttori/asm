import {
  buildAnalysisSourceCatalog,
  openAnalysisProjectStore,
  type AnalysisProjectShards,
  type AnalysisProjectManifest,
  type AnalysisEvidenceSource,
} from "@uttori/asm-disassembler";

export interface AnalysisSourceCatalogProjection {
  readonly manifest: AnalysisProjectManifest;
  readonly sources: readonly AnalysisEvidenceSource[];
}

const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const strings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry: unknown) => typeof entry === "string");
const hash = (value: unknown): boolean => typeof value === "string" && /^[\da-f]{64}$/u.test(value);

/**
 * Read just the small identity tables so opening Sources never materializes multi-GB trace/CFG data.
 * Detailed comparisons use the worker's fully validated snapshot when a source is expanded.
 * @param {string} directory Native project directory.
 * @returns {AnalysisSourceCatalogProjection} Validated catalog and its database snapshot identity.
 */
export const readAnalysisSourceCatalog = (directory: string): AnalysisSourceCatalogProjection => {
  const store = openAnalysisProjectStore(directory);
  try {
    return store.transaction(() => {
      const manifest = store.manifest();
      const read = <K extends "imports" | "evidence">(kind: K): AnalysisProjectShards[K] => {
        const records = store.loadTable(kind);
        for (const record of records as unknown[]) {
          if (!object(record) || typeof record.id !== "string")
            throw new Error(`Invalid source ${kind} identity.`);
          if (
            kind === "imports" &&
            (typeof record.sourceName !== "string" ||
              !hash(record.sourceSha256) ||
              typeof record.format !== "string" ||
              !strings(record.warnings) ||
              !object(record.imported) ||
              Object.values(record.imported).some(
                (value) => !Number.isSafeInteger(value) || (value as number) < 0,
              ) ||
              !Array.isArray(record.unsupported) ||
              !record.unsupported.every(
                (loss: unknown) =>
                  object(loss) &&
                  typeof loss.field === "string" &&
                  typeof loss.reason === "string" &&
                  Number.isSafeInteger(loss.count) &&
                  (loss.count as number) >= 0,
              ))
          )
            throw new Error("Invalid source import metadata.");
          if (kind === "evidence") {
            if (
              typeof record.sourceId !== "string" ||
              typeof record.source !== "string" ||
              !["import", "runtime", "manual", "detector", "static"].includes(record.source)
            )
              throw new Error("Invalid source evidence metadata.");
            const artifact = record.artifact;
            if (
              artifact !== undefined &&
              (!object(artifact) ||
                typeof artifact.format !== "string" ||
                !hash(artifact.sha256) ||
                artifact.romContentSha256 !== manifest.rom.contentSha256)
            )
              throw new Error("Invalid source artifact identity.");
          }
        }
        return records;
      };
      const sources = buildAnalysisSourceCatalog({
        imports: read("imports"),
        evidence: read("evidence"),
      });
      return { manifest, sources };
    }, false);
  } finally {
    store.close();
  }
};

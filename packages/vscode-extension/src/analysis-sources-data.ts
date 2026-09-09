import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  buildAnalysisSourceCatalog,
  migrateManifest,
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
 * Read just the small identity shards so opening Sources never materializes multi-GB trace/CFG data.
 * Detailed comparisons use the worker's fully validated snapshot when a source is expanded.
 * @param {string} directory Native project directory.
 * @returns {AnalysisSourceCatalogProjection} Hash-checked catalog and exact project identity.
 */
export const readAnalysisSourceCatalog = (directory: string): AnalysisSourceCatalogProjection => {
  const file = path.join(directory, "analysis.json");
  const revision = fs.readFileSync(file, "utf8");
  const manifest = migrateManifest(JSON.parse(revision));
  const read = <K extends "imports" | "evidence">(kind: K): AnalysisProjectShards[K] => {
    const descriptor = manifest.shards.find((entry) => entry.kind === kind);
    if (!descriptor) return [];
    const target = path.resolve(directory, descriptor.path);
    if (!target.startsWith(`${path.resolve(directory)}${path.sep}`))
      throw new Error("Source metadata path is outside its project.");
    if (fs.statSync(target).size > 16 * 1024 * 1024)
      throw new Error("Source catalog metadata exceeds the 16 MiB limit.");
    const bytes = fs.readFileSync(target);
    if (createHash("sha256").update(bytes).digest("hex") !== descriptor.sha256)
      throw new Error(`Source ${kind} metadata does not match its SHA-256.`);
    const records: unknown = JSON.parse(bytes.toString("utf8"));
    if (!Array.isArray(records) || records.length !== descriptor.records)
      throw new Error(`Invalid source ${kind} metadata.`);
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
    return records as AnalysisProjectShards[K];
  };
  const sources = buildAnalysisSourceCatalog({
    imports: read("imports"),
    evidence: read("evidence"),
  });
  if (fs.readFileSync(file, "utf8") !== revision)
    throw new Error("The project changed while Sources was loading. Refresh to retry.");
  return { manifest, sources };
};

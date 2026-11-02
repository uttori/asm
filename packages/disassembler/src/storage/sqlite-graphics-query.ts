import type { DatabaseSync } from "node:sqlite";

import type { RuntimeGraphicsAccessRecord } from "../model/project-types.js";
import { runtimeFromRow } from "./sqlite-records.js";

/** Bounded graphics selection. Physical offsets use the instruction snapshot's named coordinate domain. */
export interface GraphicsEvidenceQuery {
  /** Architecture shared by the graphics access and the joined CPU instruction facts. */
  readonly architecture: string;
  /** Accessed address space of graphics facts, also used as the CPU instruction address space. */
  readonly addressSpace: string;
  /** Restricts to accesses issued at this CPU PC; undefined matches any PC. */
  readonly pc?: number;
  /** Restricts to this CPU-mapped physical offset; undefined matches any offset. */
  readonly physicalOffset?: number;
  /** Lowercase hex SHA-256 restricting rows to one capture; undefined matches all captures. */
  readonly captureSha256?: string;
  /** Maximum rows returned, 1 to 2000; defaults to 500. */
  readonly limit?: number;
}

/**
 * Same physical code observed in CPU evidence, not a temporal or causal event match.
 * Unowned operations and unknown mappings never join. Counts belong to each side separately.
 */
export interface GraphicsEvidenceRow {
  /** Retained graphics access fact. */
  readonly graphics: RuntimeGraphicsAccessRecord;
  /** Distinct CPU instruction facts at the same PC and physical fetch; 0 without a CPU mapping. */
  readonly instructionVariants: number;
  /** Summed observation count of those CPU instruction facts. */
  readonly instructionObservations: number;
}

/**
 * Join the retained SQLite facts by architecture, CPU PC and physical fetch identity.
 * CPU records are aggregated inside SQL; a query-local cache avoids repeating joins for each port value.
 */
export function queryGraphicsEvidence(
  db: DatabaseSync,
  query: GraphicsEvidenceQuery,
): readonly GraphicsEvidenceRow[] {
  const limit = query.limit ?? 500;
  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 2000 ||
    [query.pc, query.physicalOffset].some(
      (value) => value !== undefined && (!Number.isSafeInteger(value) || value < 0),
    ) ||
    (query.captureSha256 !== undefined && !/^[\da-f]{64}$/.test(query.captureSha256))
  ) {
    throw new Error("Invalid graphics evidence query.");
  }
  const cpu =
    db.prepare(`SELECT COUNT(DISTINCT f.fid) AS variants,COALESCE(SUM(o.count),0) AS observations
    FROM runtime_facts f JOIN runtime_observations o ON o.fact_id=f.fid
    WHERE f.kind='runtime-instruction' AND f.architecture=? AND f.address_space=? AND f.address=?
    AND json_extract(CASE WHEN json_valid(f.payload,8) THEN f.payload ELSE analysis_json(f.payload) END,?)=?`);
  const rows =
    db.prepare(`SELECT f.*,o.count,p.value AS id_prefix,i.value AS id,e.value AS evidence,
    CASE WHEN json_valid(f.payload,8) THEN json(f.payload) ELSE f.payload END AS payload
    FROM runtime_facts f JOIN runtime_observations o ON o.fact_id=f.fid
    JOIN runtime_prefixes p ON p.id=o.prefix_id JOIN runtime_identities i ON i.iid=o.identity_id
    JOIN runtime_evidence e ON e.id=o.evidence_id
    WHERE f.kind='runtime-graphics-access' AND f.architecture=? AND f.accessed_address_space=?
    AND (? IS NULL OR json_extract(CASE WHEN json_valid(f.payload,8) THEN f.payload ELSE analysis_json(f.payload) END,'$.pc')=?)
    AND (? IS NULL OR json_extract(CASE WHEN json_valid(f.payload,8) THEN f.payload ELSE analysis_json(f.payload) END,'$.cpuMapping.physicalOffset')=?)
    AND (? IS NULL OR p.value=?) ORDER BY o.oid LIMIT ?`);
  const joins = new Map<string, { variants: number; observations: number }>();
  const result: GraphicsEvidenceRow[] = [];
  for (const row of rows.iterate(
    query.architecture,
    query.addressSpace,
    query.pc ?? null,
    query.pc ?? null,
    query.physicalOffset ?? null,
    query.physicalOffset ?? null,
    query.captureSha256 ?? null,
    query.captureSha256 ? `runtime:graphics:${query.captureSha256}:` : null,
    limit,
  )) {
    const graphics = runtimeFromRow(row);
    if (graphics.kind !== "runtime-graphics-access") {
      throw new Error("Invalid graphics query row.");
    }
    let match = { variants: 0, observations: 0 };
    if (graphics.context === "instruction" && graphics.cpuMapping) {
      const key = JSON.stringify([graphics.pc, graphics.cpuMapping]);
      const cached = joins.get(key);
      if (cached) {
        match = cached;
      } else {
        // The field is a bound JSON path, never interpolated SQL. Raw capture ordinals are intentionally absent.
        const matched = cpu.get(
          query.architecture,
          query.addressSpace,
          graphics.pc,
          `$.state."${graphics.cpuMapping.offsetStateField}"`,
          graphics.cpuMapping.physicalOffset,
        )!;
        match = { variants: Number(matched.variants), observations: Number(matched.observations) };
        joins.set(key, match);
      }
    }
    result.push({
      graphics,
      instructionVariants: match.variants,
      instructionObservations: match.observations,
    });
  }
  return result;
}

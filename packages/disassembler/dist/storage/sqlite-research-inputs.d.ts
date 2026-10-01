import type { DatabaseSync } from "node:sqlite";
import type { ResearchCollection, ResearchSnapshot } from "../research-inputs/inputs.js";
/**
 * Restore imported observations before a research-aware import or branch change. Refuse writes
 * outside the projection lifecycle rather than silently treating a database edit as user intent.
 * The caller owns a write transaction and must reapply research before publishing it.
 */
export declare function clearResearchProjection(database: DatabaseSync, insert: (collection: ResearchCollection, record: unknown) => void): void;
/**
 * Materialize Git decisions over retained observations. The entire replacement is atomic in the
 * caller's transaction; validation failure restores both the previous index and its shadow rows.
 */
export declare function projectResearchInputs(database: DatabaseSync, snapshot: ResearchSnapshot, insert: (collection: ResearchCollection, record: unknown) => void): void;
//# sourceMappingURL=sqlite-research-inputs.d.ts.map
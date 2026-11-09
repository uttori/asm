import type { DatabaseSync } from "node:sqlite";
import type { RuntimeGraphicsAccessRecord } from "../model/project-types.js";
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
export declare function queryGraphicsEvidence(db: DatabaseSync, query: GraphicsEvidenceQuery): readonly GraphicsEvidenceRow[];
//# sourceMappingURL=sqlite-graphics-query.d.ts.map
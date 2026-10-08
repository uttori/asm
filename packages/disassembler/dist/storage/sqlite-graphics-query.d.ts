import type { DatabaseSync } from "node:sqlite";
import type { RuntimeGraphicsAccessRecord } from "../model/project-types.js";
/** Bounded graphics selection. Physical offsets use the instruction snapshot's named coordinate domain. */
export interface GraphicsEvidenceQuery {
    readonly architecture: string;
    readonly addressSpace: string;
    readonly pc?: number;
    readonly physicalOffset?: number;
    readonly captureSha256?: string;
    readonly limit?: number;
}
/** Same physical code observed in CPU evidence, not a temporal or causal event match.
 * Unowned operations and unknown mappings never join. Counts belong to each side separately.
 */
export interface GraphicsEvidenceRow {
    readonly graphics: RuntimeGraphicsAccessRecord;
    readonly instructionVariants: number;
    readonly instructionObservations: number;
}
/** Join the retained SQLite facts by architecture, CPU PC and physical fetch identity.
 * CPU records are aggregated inside SQL; a query-local cache avoids repeating joins for each port value.
 */
export declare function queryGraphicsEvidence(db: DatabaseSync, query: GraphicsEvidenceQuery): readonly GraphicsEvidenceRow[];
//# sourceMappingURL=sqlite-graphics-query.d.ts.map
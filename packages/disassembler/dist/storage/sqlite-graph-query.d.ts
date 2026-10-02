import type { DatabaseSync } from "node:sqlite";
import type { AnalysisCallGraph } from "../analysis/analysis-graph.js";
export declare function isCallGraph(value: unknown): value is AnalysisCallGraph;
/** Index only graph ownership and relevant edges, with bounded payload decoding on rebuild.
 * Context/state payloads never remain in memory. Ownership uses the last function entry in each
 * evidence path. Missing owners remain explicit.
 * @param {DatabaseSync} db Connection in a read transaction. Computation writes only temporary tables.
 * @returns {AnalysisCallGraph} Compact call graph backed by indexed node ownership.
 */
export declare const prepareGraph: (db: DatabaseSync) => AnalysisCallGraph;
/** Publish fully computed SQL ownership under the caller's short writer lock.
 * @param {DatabaseSync} db Connection retaining the temporary graph tables.
 */
export declare const publishGraph: (db: DatabaseSync) => void;
//# sourceMappingURL=sqlite-graph-query.d.ts.map
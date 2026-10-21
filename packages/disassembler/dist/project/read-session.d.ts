import type { AnalysisProjectManifest, AnalysisProjectShards, ShardKind, RuntimeEvidenceRecord } from "../model/project-types.js";
import { type AnalysisProjectRevision } from "./project-transaction.js";
/** Bounded queries from one revision. Methods and streams expire when the synchronous callback returns. */
export interface AnalysisReadSession {
    readonly manifest: AnalysisProjectManifest;
    readonly revision: AnalysisProjectRevision;
    /** Stable-ID keyset page. Limit defaults to 200 and must be in [1, 200]. */
    metadataPage<Kind extends Exclude<ShardKind, "runtime">>(kind: Kind, after?: string, limit?: number): {
        records: readonly AnalysisProjectShards[Kind][number][];
        next?: string;
    };
    /** Explicit full-history stream for export/analysis. Consume inside this callback; no hydration is implicit. */
    runtimeRecords(): IterableIterator<RuntimeEvidenceRecord>;
}
/**
 * Own a read connection and one consistent snapshot without exposing mutation capabilities.
 * Results may retain decoded records, but sessions/cursors cannot escape their callback lifetime.
 * Promise results are rejected. Open a new session to observe another connection's publication.
 */
export declare function withAnalysisReadSession<Result>(directory: string, action: (session: AnalysisReadSession) => Result): Result;
//# sourceMappingURL=read-session.d.ts.map
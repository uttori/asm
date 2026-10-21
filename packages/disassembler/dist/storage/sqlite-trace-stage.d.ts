import { DatabaseSync } from "node:sqlite";
import type { RuntimeTraceCheckpoint } from "../runtime/runtime-trace.js";
/**
 * Disposable, leased SQLite counters for one content-addressed import. The checkpoint and all
 * counters commit together before destination publication; an interrupted parse has no checkpoint.
 * The cache survives failed publication, and is removed only after a successful destination commit.
 */
export declare class SqliteTraceStage {
    #private;
    readonly file: string;
    /** Owned connection; parsing and its checkpoint share one transaction in this database. */
    readonly database: DatabaseSync;
    /** Absent until the complete index transaction seals; sealed counters are immutable. */
    checkpoint: RuntimeTraceCheckpoint | undefined;
    constructor(file: string);
    /** Called inside the counter transaction, after full source and fingerprint verification. */
    seal(checkpoint: RuntimeTraceCheckpoint): void;
    /** Close on every path. Successful publication discards this optional cache while still holding its lease. */
    close(discard?: boolean): void;
}
//# sourceMappingURL=sqlite-trace-stage.d.ts.map
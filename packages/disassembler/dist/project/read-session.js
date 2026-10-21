import { openAnalysisProjectStore } from "./project-store.js";
import { analysisProjectRevision } from "./project-transaction.js";
/**
 * Own a read connection and one consistent snapshot without exposing mutation capabilities.
 * Results may retain decoded records, but sessions/cursors cannot escape their callback lifetime.
 * Promise results are rejected. Open a new session to observe another connection's publication.
 */
export function withAnalysisReadSession(directory, action) {
    const store = openAnalysisProjectStore(directory);
    let active = true;
    const cursors = new Set();
    const assertActive = () => {
        if (!active) {
            throw new Error("Analysis read session has closed.");
        }
    };
    try {
        return store.transaction(() => {
            const manifest = store.manifest();
            const session = Object.freeze({
                manifest,
                revision: analysisProjectRevision(manifest),
                metadataPage: (kind, after, limit) => {
                    assertActive();
                    return store.metadataPage(kind, after, limit);
                },
                *runtimeRecords() {
                    assertActive();
                    // Check before advancing the underlying SQLite cursor, including after a yielded record.
                    const records = store.runtimeRecords();
                    cursors.add(records);
                    try {
                        while (true) {
                            assertActive();
                            const item = records.next();
                            if (item.done) {
                                return;
                            }
                            yield item.value;
                        }
                    }
                    finally {
                        cursors.delete(records);
                        records.return?.();
                    }
                },
            });
            return action(session);
        }, false);
    }
    finally {
        active = false;
        for (const cursor of cursors) {
            cursor.return?.();
        }
        store.close();
    }
}
//# sourceMappingURL=read-session.js.map
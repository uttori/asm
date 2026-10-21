import type {
  AnalysisProjectManifest,
  AnalysisProjectShards,
  ShardKind,
  RuntimeEvidenceRecord,
} from "../model/project-types.js";
import { openAnalysisProjectStore } from "./project-store.js";
import { analysisProjectRevision, type AnalysisProjectRevision } from "./project-transaction.js";

/** Bounded queries from one revision. Methods and streams expire when the synchronous callback returns. */
export interface AnalysisReadSession {
  readonly manifest: AnalysisProjectManifest;
  readonly revision: AnalysisProjectRevision;
  /** Stable-ID keyset page. Limit defaults to 200 and must be in [1, 200]. */
  metadataPage<Kind extends Exclude<ShardKind, "runtime">>(
    kind: Kind,
    after?: string,
    limit?: number,
  ): {
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
export function withAnalysisReadSession<Result>(
  directory: string,
  action: (session: AnalysisReadSession) => Result,
): Result {
  const store = openAnalysisProjectStore(directory);
  let active = true;
  const cursors = new Set<IterableIterator<RuntimeEvidenceRecord>>();
  const assertActive = (): void => {
    if (!active) {
      throw new Error("Analysis read session has closed.");
    }
  };
  try {
    return store.transaction(() => {
      const manifest = store.manifest();
      const session: AnalysisReadSession = Object.freeze({
        manifest,
        revision: analysisProjectRevision(manifest),
        metadataPage: <Kind extends Exclude<ShardKind, "runtime">>(
          kind: Kind,
          after?: string,
          limit?: number,
        ) => {
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
          } finally {
            cursors.delete(records);
            records.return?.();
          }
        },
      });
      return action(session);
    }, false);
  } finally {
    active = false;
    for (const cursor of cursors) {
      cursor.return?.();
    }
    store.close();
  }
}

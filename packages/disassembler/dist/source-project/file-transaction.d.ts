import type { SourceRepository } from "./git.js";
/** One ordinary source replacement. Paths are project-relative and before/after buffers are borrowed until staging finishes. */
export interface SourceFileReplacement {
    readonly path: string;
    readonly before: Uint8Array;
    readonly after: Uint8Array;
}
/** Durable states survive termination between individual file renames; external readers are not globally atomic. */
export interface SourceFileTransaction {
    readonly format: "uttori-source-file-transaction";
    readonly version: 1;
    readonly id: string;
    readonly state: "staged" | "publishing" | "completed" | "recovery";
    readonly direction: "after" | "before";
    readonly files: readonly {
        readonly path: string;
        readonly before: string;
        readonly after: string;
    }[];
}
/** Treat a corrupt private journal as a recovery issue, never unchecked trusted JSON. */
export declare function readSourceFileTransaction(repository: SourceRepository): SourceFileTransaction | undefined;
/** Ordinary source readers refuse mixed publication; the epoch also detects a publication completed during a read. */
export declare function sourceFilePublicationEpoch(repository: SourceRepository): string;
/**
 * Stage complete before/after files, then publish with the same lease used by native Git
 * integration. No-op calls create no files. Cancellation before staging visibility removes
 * only this invocation's private staging directory; later interruption leaves recovery data.
 */
export declare function applySourceFileTransaction(repository: SourceRepository, replacements: readonly SourceFileReplacement[], options?: {
    readonly signal?: AbortSignal;
    readonly onStage?: (stage: string) => void;
    /** Recheck dependencies and editor versions while holding the project operation lease. */
    readonly validate?: () => void;
}): SourceFileTransaction | undefined;
/** Explicit recovery completes or rolls back known bytes. It never overwrites an unknown external replacement. */
export declare function recoverSourceFileTransaction(repository: SourceRepository, direction: "before" | "after", options?: {
    readonly signal?: AbortSignal;
    readonly onStage?: (stage: string) => void;
    /** Revalidate a host's journal snapshot under the operation lock, after asynchronous editor checks. */
    readonly validate?: (journal: SourceFileTransaction) => void;
}): SourceFileTransaction | undefined;
//# sourceMappingURL=file-transaction.d.ts.map
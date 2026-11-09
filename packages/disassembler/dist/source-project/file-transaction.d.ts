import type { SourceRepository } from "./git.js";
/** One ordinary source replacement. Paths are project-relative and before/after buffers are borrowed until staging finishes. */
export interface SourceFileReplacement {
    /** Project-relative path guarded against symlink and traversal redirection. */
    readonly path: string;
    /** Observed bytes before publication, retained only until staging completes. */
    readonly before: Uint8Array;
    /** Replacement bytes to publish when the transaction commits forward. */
    readonly after: Uint8Array;
}
/** Null denotes absence, allowing guarded create/remove operations alongside existing replacements. */
export type SourceFileChange = SourceFileReplacement | {
    readonly path: string;
    readonly before: Uint8Array | null;
    readonly after: Uint8Array | null;
};
/** Durable states survive termination between individual file renames; external readers are not globally atomic. */
export interface SourceFileTransaction {
    /** Journal discriminator written before any staged bytes are published. */
    readonly format: "uttori-source-file-transaction";
    /** Schema version selecting create/remove semantics for null before/after hashes. */
    readonly version: 1 | 2;
    /** Stable publication identity used for staging directories and recovery. */
    readonly id: string;
    /** Current durable phase of the multi-file publication workflow. */
    readonly state: "staged" | "publishing" | "completed" | "recovery";
    /** Which staged hash side publish and recovery should apply next. */
    readonly direction: "after" | "before";
    /** Per-path content hashes staged for publication and recovery. */
    readonly files: readonly {
        /** Project-relative path published by this transaction. */
        readonly path: string;
        /** Content hash observed before publication, or null when the file did not exist. */
        readonly before: string | null;
        /** Content hash staged for the forward direction, or null when the file should be removed. */
        readonly after: string | null;
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
export declare function applySourceFileTransaction(repository: SourceRepository, replacements: readonly SourceFileChange[], options?: {
    readonly signal?: AbortSignal;
    readonly onStage?: (stage: string) => void;
    /** Recheck dependencies and editor versions while holding the project operation lease. */
    readonly validate?: () => void;
    /** Editor hosts stage recovery first, then publish through one native workspace edit with undo/redo. */
    readonly stageOnly?: boolean;
}): SourceFileTransaction | undefined;
/** Explicit recovery completes or rolls back known bytes. It never overwrites an unknown external replacement. */
export declare function recoverSourceFileTransaction(repository: SourceRepository, direction: "before" | "after", options?: {
    readonly signal?: AbortSignal;
    readonly onStage?: (stage: string) => void;
    /** Revalidate a host's journal snapshot under the operation lock, after asynchronous editor checks. */
    readonly validate?: (journal: SourceFileTransaction) => void;
}): SourceFileTransaction | undefined;
//# sourceMappingURL=file-transaction.d.ts.map
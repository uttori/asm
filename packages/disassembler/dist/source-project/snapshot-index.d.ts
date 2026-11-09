import { type SourceRepository } from "./git.js";
/**
 * One operation owns this scratch index and immutable HEAD inventory; dispose it in finally.
 * Current bytes are hashed on every snapshot, including same-size edits with restored timestamps.
 */
export declare class SourceSnapshotIndex {
    #private;
    readonly repository: SourceRepository;
    constructor(repository: SourceRepository);
    /** Build a complete current tree without consulting or updating the user's staging index. */
    snapshot(overlays?: readonly {
        readonly path: string;
        readonly bytes: Uint8Array;
    }[]): Promise<string>;
    /** Release the private scratch index and any temporary Git state. */
    dispose(): void;
}
//# sourceMappingURL=snapshot-index.d.ts.map
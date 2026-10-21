/** Target validation produces this identity before publication; paths name one immutable build pair. */
export interface SourceBuildReceipt {
    readonly inputSha256: string;
    readonly outputFile: string;
    readonly debugMapFile: string;
}
/**
 * Publish a binary/map pair under one lease, selecting it only after its receipt is durable.
 * Interrupted outputs retain a pending receipt for bounded cleanup. Pruning failures become
 * warnings on the committed result; cancellation before publication leaves the current build intact.
 */
export declare function publishSourceBuild<T extends SourceBuildReceipt>(options: {
    readonly directory: string;
    readonly receipt: T;
    readonly output: Uint8Array;
    readonly debugMap: string;
    readonly signal?: AbortSignal;
}): T & {
    readonly cacheWarnings?: readonly string[];
};
//# sourceMappingURL=build-publication.d.ts.map
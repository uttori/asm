import { type SourceBuildCoverage } from "./build-coverage.js";
/** Target validation produces this identity before publication; paths name one immutable build pair. */
export interface SourceBuildReceipt {
    /** Optional coverage totals, also projected into the advisory `summary.json`. */
    readonly coverage?: SourceBuildCoverage;
    /** Lowercase SHA-256 of the build inputs; names the content-addressed build directory. */
    readonly inputSha256: string;
    /** Binary path; must be a plain filename directly inside `<directory>/<inputSha256>/`. */
    readonly outputFile: string;
    /** Debug map path; must equal `${outputFile}.debug.json`. */
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
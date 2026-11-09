import type { AssetEmissionConversion } from "../addressToLine.js";
import type { Assembler } from "../assembler.js";
import type { ParsedAssetCall } from "../ir/asset-call.js";
/** One build owns its bytes and conversions across all three passes. */
export declare class AssetAssemblyService {
    #private;
    readonly session: Assembler;
    /** A single asset stage may not allocate or emit more than this many bytes. */
    static readonly MAX_STAGE_BYTES: number;
    /** Paths recorded as binary or resource dependencies during asset conversion. */
    readonly dependencies: Map<string, "binary" | "resource">;
    /** Descriptor of the most recent successful statement, consumed immediately by emission metadata. */
    lastEmission?: Readonly<{
        sourcePath: string;
        format: string;
        part: string;
        size: number;
        transforms: readonly string[];
        conversion: AssetEmissionConversion;
    }>;
    constructor(session: Assembler);
    /** Drop all snapshots before the next build; disk changes then become visible. */
    beginBuild(): void;
    /**
     * Return the exact bytes consumed by this build for dependency fingerprints.
     * @param path Provider identity.
     * @returns Owned snapshot copy, when the path was read.
     */
    snapshot(path: string): Uint8Array | undefined;
    /**
     * Resolve input and declared resource paths for tooling without encoding bytes.
     * @param call Typed source directive.
     */
    discoverDependencies(call: ParsedAssetCall): void;
    /**
     * Convert and select one complete byte stream before touching output state.
     * @param call Typed source directive.
     * @returns Snapshot-owned bytes shared across assembly passes.
     */
    materialize(call: ParsedAssetCall): Uint8Array;
}
//# sourceMappingURL=asset-assembly-service.d.ts.map
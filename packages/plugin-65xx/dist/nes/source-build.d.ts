import { type AssemblerEnvironment } from "@uttori/asm-core";
import { type SourceBuildVerification } from "@uttori/asm-disassembler";
/** Saved inputs for a fixed-layout cartridge; pristine generations additionally require exact original bytes. */
export interface BuildNesSourceOptions {
    readonly root: string;
    readonly entrySource: string;
    readonly environment: AssemblerEnvironment;
    readonly includePaths?: readonly string[];
    readonly targetOptions?: Readonly<Record<string, unknown>>;
    /** Original payload blocks let regeneration detect edited bytes that are no longer included. */
    readonly rawBlocks?: {
        readonly directory: string;
        readonly original: Uint8Array;
        readonly blockSize: number;
    };
    readonly expectedSize: number;
    /** Fixed-layout projects preserve all 16 original header bytes, including mapper and section sizes. */
    readonly expectedHeader?: Uint8Array;
    readonly originalContent?: Uint8Array;
    readonly outputDirectory: string;
    readonly toolchainSha256: string;
    readonly configurationSha256: string;
    readonly signal?: AbortSignal;
}
/** Matching binary/map publication and the saved dependencies that produced it. */
export interface NesSourceBuild {
    readonly outputFile: string;
    readonly debugMapFile: string;
    readonly inputSha256: string;
    readonly inputs: readonly {
        readonly path: string;
        readonly sha256: string;
    }[];
    readonly outputSize: number;
    readonly debugMapFingerprint: string;
    readonly verification: SourceBuildVerification;
    readonly contracts: {
        readonly cpuStates: number;
        readonly fixedExtents: number;
    };
}
/** Assemble a complete iNES image without publication; stale dependencies invalidate the result. */
export declare function inspectNesSource(options: BuildNesSourceOptions & {
    readonly overlays?: ReadonlyMap<string, Uint8Array | null>;
}): {
    output: Uint8Array<ArrayBuffer>;
    mapping: import("@uttori/asm-core").AddressToLineMapping;
    snapshots: Map<string, Uint8Array<ArrayBufferLike>>;
    symbols: Map<string, number>;
    diagnostics: never[];
};
/** Publish immutable matching artifacts, then advance the current-build pointer under one lease. */
export declare function buildNesSource(options: BuildNesSourceOptions): NesSourceBuild;
//# sourceMappingURL=source-build.d.ts.map
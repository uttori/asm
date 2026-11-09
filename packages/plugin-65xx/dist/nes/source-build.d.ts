import { type AssemblerEnvironment } from "@uttori/asm-core";
import { type SourceBuildCoverage, type SourceBuildVerification, type SourceLinkBuild } from "@uttori/asm-disassembler/source-project";
/** Saved inputs for a fixed-layout cartridge; pristine generations additionally require exact original bytes. */
export interface BuildNesSourceOptions {
    /** Explicit generated-module selection; omitted for existing absolute Asar projects. */
    readonly link?: SourceLinkBuild;
    /** Exact host configuration snapshots, included in saved-input freshness checks. */
    readonly controlInputs?: readonly {
        readonly path: string;
        readonly sha256: string;
    }[];
    /** Absolute project root containing the NES sources. */
    readonly root: string;
    /** Entry assembly file assembled for the cartridge. */
    readonly entrySource: string;
    /** Activated assembler environment for this build. */
    readonly environment: AssemblerEnvironment;
    /** Additional include directories replacing configured paths when set. */
    readonly includePaths?: readonly string[];
    /** NES target options forwarded to the assembler session. */
    readonly targetOptions?: Readonly<Record<string, unknown>>;
    /** Original payload blocks let regeneration detect edited bytes that are no longer included. */
    readonly rawBlocks?: {
        readonly directory: string;
        readonly original: Uint8Array;
        readonly blockSize: number;
    };
    /** Exact iNES image size the build must produce. */
    readonly expectedSize: number;
    /** Fixed-layout projects preserve all 16 original header bytes, including mapper and section sizes. */
    readonly expectedHeader?: Uint8Array;
    /** Original cartridge bytes used to detect unincluded edits. */
    readonly originalContent?: Uint8Array;
    /** Directory receiving the published image and debug map. */
    readonly outputDirectory: string;
    /** Fingerprint of the Node toolchain and plugin modules. */
    readonly toolchainSha256: string;
    /** Fingerprint of the project configuration used for this build. */
    readonly configurationSha256: string;
    /** Optional cooperative cancellation. */
    readonly signal?: AbortSignal;
}
/** Matching binary/map publication and the saved dependencies that produced it. */
export interface NesSourceBuild {
    /** Published binary path for this receipt. */
    readonly outputFile: string;
    /** Published debug-map path paired with the binary. */
    readonly debugMapFile: string;
    /** SHA-256 of the exact saved inputs that produced the binary. */
    readonly inputSha256: string;
    /** Optional source-coverage summary recorded with the receipt. */
    readonly coverage?: SourceBuildCoverage;
    /** Saved-input paths and hashes that must stay fresh. */
    readonly inputs: readonly {
        readonly path: string;
        readonly sha256: string;
    }[];
    /** Published binary size in bytes. */
    readonly outputSize: number;
    /** Canonical fingerprint of the published debug map. */
    readonly debugMapFingerprint: string;
    /** Byte-identity checks against the original ROM when required. */
    readonly verification: SourceBuildVerification;
    /** Counts of CPU-state and fixed-extent contracts recorded for the build. */
    readonly contracts: {
        readonly cpuStates: number;
        readonly fixedExtents: number;
    };
}
/** Assemble a complete iNES image without publication; stale dependencies invalidate the result. */
export declare function inspectNesSource(options: BuildNesSourceOptions & {
    readonly overlays?: ReadonlyMap<string, Uint8Array | null>;
}): {
    output: Uint8Array<ArrayBufferLike>;
    mapping: import("@uttori/asm-core").AddressToLineMapping;
    snapshots: ReadonlyMap<string, Uint8Array<ArrayBufferLike>>;
    symbols: Map<string, number>;
    diagnostics: never[];
};
/** Publish immutable matching artifacts, then advance the current-build pointer under one lease. */
export declare function buildNesSource(options: BuildNesSourceOptions): NesSourceBuild;
//# sourceMappingURL=source-build.d.ts.map
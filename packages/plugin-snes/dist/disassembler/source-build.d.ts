import { type AssemblerEnvironment, type AddressToLineMapping } from "@uttori/asm-core";
import { type SourceBuildVerification } from "@uttori/asm-disassembler/source-project";
import { type SnesPlacementContract, type SnesFixedExtent, type SnesInstructionStateContract, type SnesLayoutDiagnostic } from "./rom-layout/check.js";
import { type SnesRomExpansionPolicy } from "./rom-layout/expansion.js";
/** Build normal editable source. Original-ROM equality is requested only for pure generations. */
export interface BuildSnesSourceOptions {
    readonly root: string;
    readonly entrySource: string;
    readonly environment: AssemblerEnvironment;
    readonly includePaths?: readonly string[];
    readonly targetOptions?: Readonly<Record<string, unknown>>;
    readonly expectedSize: number;
    /** Explicit same-mapper growth; never used to change the identity of a pure generation. */
    readonly expansion?: SnesRomExpansionPolicy;
    readonly states?: readonly SnesInstructionStateContract[];
    readonly extents?: readonly SnesFixedExtent[];
    readonly placements?: SnesPlacementContract;
    /** Exact headerless ROM bytes, supplied only when verifying a pristine generation. */
    readonly originalContent?: Uint8Array;
    /** Original-ROM block directory and immutable bytes for checking edits no longer consumed after regeneration. */
    readonly rawBlocks?: {
        readonly directory: string;
        readonly original: Uint8Array;
        readonly blockSize: number;
    };
    readonly outputDirectory: string;
    readonly toolchainSha256: string;
    /** Hash of the complete saved configuration, including plugin and encoder options. */
    readonly configurationSha256: string;
    readonly signal?: AbortSignal;
}
/** Matching artifacts are published together only after all required checks pass. */
export interface SnesSourceBuild {
    readonly outputFile: string;
    readonly debugMapFile: string;
    readonly inputSha256: string;
    /** Exact consumed saved files, relative to the source root; timestamps and editor events are not input identities. */
    readonly inputs: readonly {
        readonly path: string;
        readonly sha256: string;
    }[];
    readonly outputSize: number;
    /** Debugger map identity differs from the SHA-256 of its serialized file. */
    readonly debugMapFingerprint: string;
    readonly verification: SourceBuildVerification;
    /** Counts make a successful build's semantic coverage explicit; empty declarations prove no CPU-state assumptions. */
    readonly contracts: {
        readonly cpuStates: number;
        readonly fixedExtents: number;
    };
    /** Successful publication may leave unknown or externally locked cache files for explicit inspection. */
    readonly cacheWarnings?: readonly string[];
}
/** Inspect a prospective source edit without writing files, ROMs or build receipts. */
export interface InspectSnesSourceOptions extends Omit<BuildSnesSourceOptions, "outputDirectory" | "toolchainSha256" | "configurationSha256"> {
    /** Repository-relative candidate files. Null hides a retired file; bytes also support not-yet-published resources. */
    readonly overlays?: ReadonlyMap<string, Uint8Array | null>;
    /** Structured names needed by placement services in addition to ordinary labels and extents. */
    readonly resolveSymbols?: readonly string[];
}
/** Unpublished assembly evidence. Layout diagnostics do not make this a successful build. */
export interface SnesSourceInspection {
    readonly output: Uint8Array;
    readonly mapping: AddressToLineMapping;
    readonly symbols: ReadonlyMap<string, number>;
    /** Absolute dependency paths and exact bytes consumed by every assembler pass. */
    readonly snapshots: ReadonlyMap<string, Uint8Array>;
    readonly diagnostics: readonly SnesLayoutDiagnostic[];
}
/** Assemble one immutable input snapshot; return diagnostics for placement previews without publishing output. */
export declare function inspectSnesSource(options: InspectSnesSourceOptions): SnesSourceInspection;
/**
 * Publish a matching ROM/map pair only after all source and target checks pass. Inspection used
 * by placement previews has no publication path and cannot replace the last successful build.
 */
export declare function buildSnesSource(options: BuildSnesSourceOptions): SnesSourceBuild;
//# sourceMappingURL=source-build.d.ts.map
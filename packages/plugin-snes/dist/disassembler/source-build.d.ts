import { type AssemblyModuleOptions, type AssemblerEnvironment, type AddressToLineMapping } from "@uttori/asm-core";
import { type SourceBuildCoverage, type SourceBuildVerification, type SourceLinkBuild, type SourceModuleInspection } from "@uttori/asm-disassembler/source-project";
import { type SnesPlacementContract, type SnesFixedExtent, type SnesInstructionStateContract, type SnesLayoutDiagnostic } from "./rom-layout/check.js";
import { type SnesRomExpansionPolicy } from "./rom-layout/expansion.js";
/** Build normal editable source. Original-ROM equality is requested only for pure generations. */
export interface BuildSnesSourceOptions {
    /** Explicit generated-module selection; absence retains the absolute Asar pipeline. */
    readonly link?: SourceLinkBuild;
    /** Complete original container, including a copier prefix, for linked pristine verification. */
    readonly originalContainer?: Uint8Array;
    /** Exact host configuration snapshots, included in saved-input freshness checks. */
    readonly controlInputs?: readonly {
        readonly path: string;
        readonly sha256: string;
    }[];
    /** Absolute path to the Git source repository root. */
    readonly root: string;
    /** Entry assembly file relative to root. */
    readonly entrySource: string;
    /** Assembler host environment passed to every pass. */
    readonly environment: AssemblerEnvironment;
    /** Additional include directories for the SNES target. */
    readonly includePaths?: readonly string[];
    /** Target-specific encoder options snapshot. */
    readonly targetOptions?: Readonly<Record<string, unknown>>;
    /** Declared headerless ROM capacity for layout checks. */
    readonly expectedSize: number;
    /** Explicit same-mapper growth; never used to change the identity of a pure generation. */
    readonly expansion?: SnesRomExpansionPolicy;
    /** Explicit CPU width assumptions consumed by control-flow proof. */
    readonly states?: readonly SnesInstructionStateContract[];
    /** Symbol-anchored fixed spans checked after assembly. */
    readonly extents?: readonly SnesFixedExtent[];
    /** Saved relocation placements validated on every build. */
    readonly placements?: SnesPlacementContract;
    /** Exact headerless ROM bytes, supplied only when verifying a pristine generation. */
    readonly originalContent?: Uint8Array;
    /** Original-ROM block directory and immutable bytes for checking edits no longer consumed after regeneration. */
    readonly rawBlocks?: {
        readonly directory: string;
        readonly original: Uint8Array;
        readonly blockSize: number;
    };
    /** Directory receiving build outputs and verification receipts. */
    readonly outputDirectory: string;
    /** Hash of the assembler toolchain used for this build. */
    readonly toolchainSha256: string;
    /** Hash of the complete saved configuration, including plugin and encoder options. */
    readonly configurationSha256: string;
    /** Optional cancellation hook for long builds. */
    readonly signal?: AbortSignal;
}
/** Matching artifacts are published together only after all required checks pass. */
export interface SnesSourceBuild {
    /** Path to the emitted ROM artifact. */
    readonly outputFile: string;
    /** Path to the published address-to-source debug map. */
    readonly debugMapFile: string;
    /** Aggregate hash of consumed source inputs. */
    readonly inputSha256: string;
    /** Optional source coverage metrics when linkage reporting is enabled. */
    readonly coverage?: SourceBuildCoverage;
    /** Exact consumed saved files, relative to the source root; timestamps and editor events are not input identities. */
    readonly inputs: readonly {
        readonly path: string;
        readonly sha256: string;
    }[];
    /** Headerless ROM byte length of the successful build. */
    readonly outputSize: number;
    /** Debugger map identity differs from the SHA-256 of its serialized file. */
    readonly debugMapFingerprint: string;
    /** Pristine-ROM and linkage checks recorded with the build receipt. */
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
    /** In-memory ROM image from the inspection pass. */
    readonly output: Uint8Array;
    /** Address-to-source map from the dry-run assembler pass. */
    readonly mapping: AddressToLineMapping;
    /** Resolved global symbols needed by layout services. */
    readonly symbols: ReadonlyMap<string, number>;
    /** Absolute dependency paths and exact bytes consumed by every assembler pass. */
    readonly snapshots: ReadonlyMap<string, Uint8Array>;
    /** Layout, placement and control-flow failures from the dry run. */
    readonly diagnostics: readonly SnesLayoutDiagnostic[];
}
/** Module production borrows the same snapshot/overlay provider as ordinary source inspection. */
export type InspectSnesModuleOptions = Pick<InspectSnesSourceOptions, "root" | "entrySource" | "environment" | "includePaths" | "targetOptions" | "overlays" | "signal" | "link"> & {
    readonly module: AssemblyModuleOptions;
    /** Shared source hosts provide their existing exact identities; bare embedding inspections may omit them. */
    readonly toolchainSha256?: string;
    readonly configurationSha256?: string;
};
/** Produce symbolic records without running layout checks that require a linked ROM or publishing artifacts. */
export declare function inspectSnesSourceModule(options: InspectSnesModuleOptions): SourceModuleInspection;
/** Assemble one immutable input snapshot; return diagnostics for placement previews without publishing output. */
export declare function inspectSnesSource(options: InspectSnesSourceOptions): SnesSourceInspection;
/**
 * Publish a matching ROM/map pair only after all source and target checks pass. Inspection used
 * by placement previews has no publication path and cannot replace the last successful build.
 */
export declare function buildSnesSource(options: BuildSnesSourceOptions): SnesSourceBuild;
//# sourceMappingURL=source-build.d.ts.map
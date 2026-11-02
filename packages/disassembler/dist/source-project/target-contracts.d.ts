import type { AssemblyModule, AssemblyModuleOptions, AssemblyLinkRecipe } from "@uttori/asm-core";
import type { StaticAnalysisIncompleteReason } from "../analysis/static-analysis.js";
import type { completeCaptureImportNotes } from "../project/capture-notes.js";
import type { ResearchSnapshot } from "../research-inputs/inputs.js";
import type { SourceBuildCoverage } from "./build-coverage.js";
import type { SourceGenerationOptions, PreparedSourceGeneration, SourceInspection } from "./generation-contracts.js";
import type { SourceBuildVerification } from "./merge.js";
import type { SourceProject } from "./project.js";
/** Host and target-independent fields shared by every published build receipt. */
export interface SourceBuildResult {
    readonly coverage?: SourceBuildCoverage;
    readonly outputFile: string;
    readonly debugMapFile: string;
    readonly inputSha256: string;
    readonly verification: SourceBuildVerification;
}
/** An inspection also authenticates configuration and toolchain inputs for publication. */
export interface SourceProjectInspection extends SourceInspection {
    readonly root: string;
    readonly configurationSha256: string;
    readonly toolchainSha256: string;
    /** True only when the worker bundle contains every selected plugin; external code disables advisory menu caching. */
    readonly bundledToolchain?: boolean;
}
/** Unlinked producer evidence. It has no publication receipt and cannot replace a successful ROM build. */
export interface SourceModuleInspection {
    readonly modules: readonly AssemblyModule[];
    readonly linkRecipe?: AssemblyLinkRecipe;
    readonly inputSha256: string;
    readonly inputs: readonly {
        readonly path: string;
        readonly sha256: string;
    }[];
}
/** Research identity must be rechecked under the target's publication lock. */
export interface SourceAnalysisOptions {
    readonly projectDirectory: string;
    readonly romFile: string;
    readonly research?: ResearchSnapshot;
    readonly assertResearchCurrent?: () => void;
    readonly signal?: AbortSignal;
    readonly maxWorkItems?: number;
    readonly maxCallDepth?: number;
    readonly onProgress?: (progress: {
        readonly message: string;
    }) => void;
}
/** Compact durable evidence result; original archives are not retained as a runtime dependency. */
export interface SourceCaptureResult {
    readonly sourceSha256: string;
    readonly changed: boolean;
    readonly added: {
        readonly runtime: number;
        readonly evidence: number;
    };
    readonly observedEvents: number;
    readonly droppedEvents: number;
    readonly warnings: readonly string[];
    readonly report?: string;
}
/** Target extensions receive the same cancellation and research checks as the primary import. */
export interface SourceTargetCaptureOptions {
    readonly project: SourceProject;
    readonly capture: string;
    readonly research: ResearchSnapshot;
    readonly assertResearchCurrent: () => void;
    readonly signal?: AbortSignal;
    readonly maxBytes: number;
}
/**
 * A target owns cartridge, CPU, layout and rendering policy. The shared dispatcher owns Git
 * ancestry, input snapshots, durable evidence/catalog ordering and publication. Missing optional
 * methods reject before indexing or other mutations; registering a target adds no dispatcher case.
 */
export interface SourceTargetDescriptor {
    /** Inspect module-authored source without publishing ROMs or claiming a link has succeeded. */
    inspectModules?(this: void, project: SourceProject, host: SourceWorkflowHost, module: AssemblyModuleOptions, overlays?: ReadonlyMap<string, Uint8Array | null>, signal?: AbortSignal): Promise<SourceModuleInspection>;
    readonly id: string;
    readonly recipeFormat: string;
    matchesRom(this: void, prefix: Uint8Array): boolean;
    initialize(this: void, options: InitializeSourceOptions): Promise<SourceInitializationResult>;
    build(this: void, project: SourceProject, host: SourceWorkflowHost, signal?: AbortSignal): Promise<SourceBuildResult>;
    inspect(this: void, project: SourceProject, host: SourceWorkflowHost, overlays?: ReadonlyMap<string, Uint8Array | null>, signal?: AbortSignal): Promise<SourceProjectInspection>;
    generationOptionsHash(this: void, options: Pick<SourceGenerationOptions, "sourceRoot" | "recipes" | "pristineAssets" | "codeWithdrawals" | "assembly">): string;
    prepare(this: void, options: SourceGenerationOptions): Promise<PreparedSourceGeneration>;
    analyze(this: void, options: SourceAnalysisOptions): {
        readonly status: "complete" | "incomplete";
        readonly addedCode: Parameters<typeof completeCaptureImportNotes>[3];
    };
    graphics?(this: void, project: SourceProject, operation: SourceTargetOperation): unknown;
    expand?(this: void, project: SourceProject, host: SourceWorkflowHost, operation: SourceTargetOperation): Promise<unknown>;
    relocate?(this: void, project: SourceProject, host: SourceWorkflowHost, operation: SourceTargetOperation): Promise<unknown>;
    importPrimary?(this: void, options: SourceTargetCaptureOptions): Promise<SourceCaptureResult | null>;
    /** Optional relative archive path inside a verified instruction companion directory. */
    readonly companionArchive?: string;
}
/** Target callbacks depend on these data contracts, never on CLI/editor or workflow implementation. */
export interface SourceTargetOperation {
    readonly directory: string;
    readonly signal?: AbortSignal;
    readonly onProgress?: (message: string) => void;
    readonly objectId?: string;
    readonly expansionSize?: number;
    readonly graphicsQuery?: {
        readonly captureSha256: string;
        readonly pc?: number;
        readonly physicalOffset?: number;
        readonly limit?: number;
    };
}
export interface SourceWorkflowHost {
    readonly targets?: readonly SourceTargetDescriptor[];
    readonly loadEnvironment: (configFile: string) => Promise<Awaited<ReturnType<SourceGenerationOptions["loadEnvironment"]>> & {
        readonly configuration: {
            readonly plugins: readonly {
                readonly bundled?: boolean;
                readonly resolvedModule: string;
            }[];
        };
    }>;
    readonly fingerprint: (plugins: readonly string[]) => {
        readonly sha256: string;
    };
}
/** Initialization owns staging and publishes only after original-ROM equality succeeds. */
export interface InitializeSourceOptions {
    readonly directory: string;
    readonly rom: string;
    readonly dizRawFile?: string;
    readonly mapper?: string;
    readonly id?: string;
    readonly limits?: SourceProject["configuration"]["limits"];
    readonly signal?: AbortSignal;
    readonly onProgress?: (message: string) => void;
    readonly toolchainSha256: string;
    readonly loadEnvironment: SourceGenerationOptions["loadEnvironment"];
}
/** Initial pure generation and byte-equality proof, published atomically with the new project. */
export interface SourceInitializationResult {
    readonly directory: string;
    readonly generation: string;
    readonly verification: SourceBuildVerification;
    readonly analysis: {
        readonly status: "complete" | "incomplete";
        readonly instructions: number;
        readonly incompleteReasons: readonly StaticAnalysisIncompleteReason[];
    };
}
//# sourceMappingURL=target-contracts.d.ts.map
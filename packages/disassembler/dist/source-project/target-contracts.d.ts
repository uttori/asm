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
    /** Optional build coverage totals published with the receipt. */
    readonly coverage?: SourceBuildCoverage;
    /** Published binary inside the content-addressed build directory. */
    readonly outputFile: string;
    /** Debug map published alongside `outputFile`. */
    readonly debugMapFile: string;
    /** SHA-256 of the build inputs; names the immutable build directory. */
    readonly inputSha256: string;
    /** Output, debug-map and toolchain hashes plus the checks performed on the pair. */
    readonly verification: SourceBuildVerification;
}
/** An inspection also authenticates configuration and toolchain inputs for publication. */
export interface SourceProjectInspection extends SourceInspection {
    /** Repository root the inspection was taken from. */
    readonly root: string;
    /** Content hash of the canonical project configuration observed during inspection. */
    readonly configurationSha256: string;
    /** Fingerprint of the resolved plugin toolchain. */
    readonly toolchainSha256: string;
    /** True only when the worker bundle contains every selected plugin; external code disables advisory menu caching. */
    readonly bundledToolchain?: boolean;
}
/** Unlinked producer evidence. It has no publication receipt and cannot replace a successful ROM build. */
export interface SourceModuleInspection {
    /** Assembled, unlinked modules in producer order. */
    readonly modules: readonly AssemblyModule[];
    /** Link recipe the target would use; absent when the target has none for this source. */
    readonly linkRecipe?: AssemblyLinkRecipe;
    /** SHA-256 identity over every listed input. */
    readonly inputSha256: string;
    /** Repository-relative source inputs and content hashes, including overlay contents. */
    readonly inputs: readonly {
        readonly path: string;
        readonly sha256: string;
    }[];
}
/** Research identity must be rechecked under the target's publication lock. */
export interface SourceAnalysisOptions {
    /** Local analysis evidence project directory. */
    readonly projectDirectory: string;
    /** Original ROM file whose identity must match the project. */
    readonly romFile: string;
    /** Git-tracked research applied on top of imported evidence. */
    readonly research?: ResearchSnapshot;
    /** Throws when tracked research changed after the snapshot was read. */
    readonly assertResearchCurrent?: () => void;
    /** Cancels analysis before results are published. */
    readonly signal?: AbortSignal;
    /** Positive static-analysis work-item budget; omitted uses the analyzer default. */
    readonly maxWorkItems?: number;
    /** Non-negative call depth budget; omitted uses the analyzer default. */
    readonly maxCallDepth?: number;
    /** Receives human-readable progress messages. */
    readonly onProgress?: (progress: {
        readonly message: string;
    }) => void;
}
/** Compact durable evidence result; original archives are not retained as a runtime dependency. */
export interface SourceCaptureResult {
    /** Canonical importer identity of the capture, distinct from the archive byte hash. */
    readonly sourceSha256: string;
    /** Whether runtime facts or provenance were published. */
    readonly changed: boolean;
    /** Runtime records and evidence entries new to the project. */
    readonly added: {
        readonly runtime: number;
        readonly evidence: number;
    };
    /** Events the importer observed in the capture. */
    readonly observedEvents: number;
    /** Events the producer reported as dropped. */
    readonly droppedEvents: number;
    /** Non-fatal import notices. */
    readonly warnings: readonly string[];
    /** Location of the saved verification report, when the target writes one. */
    readonly report?: string;
}
/** Target extensions receive the same cancellation and research checks as the primary import. */
export interface SourceTargetCaptureOptions {
    /** Opened source project receiving the evidence. */
    readonly project: SourceProject;
    /** Capture archive path; a temporary input that may be removed after import. */
    readonly capture: string;
    /** Tracked research snapshot that imported provenance sits beneath. */
    readonly research: ResearchSnapshot;
    /** Throws when tracked research changed after the snapshot was read. */
    readonly assertResearchCurrent: () => void;
    /** Cancels the import before evidence is committed. */
    readonly signal?: AbortSignal;
    /** Positive per-archive byte budget shared with fingerprinting. */
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
    /** Target identifier matched against `SourceProjectConfiguration.target`. */
    readonly id: string;
    /** Generation recipe `format` this target accepts; other formats are rejected. */
    readonly recipeFormat: string;
    /** Recognize this target's ROMs from a leading byte prefix without loading the whole file. */
    matchesRom(this: void, prefix: Uint8Array): boolean;
    /** Create a new source project, publishing it only after original-ROM equality succeeds. */
    initialize(this: void, options: InitializeSourceOptions): Promise<SourceInitializationResult>;
    /** Assemble, link and publish the project's current source as a verified build receipt. */
    build(this: void, project: SourceProject, host: SourceWorkflowHost, signal?: AbortSignal): Promise<SourceBuildResult>;
    /** Assemble saved source plus unsaved overlays without publishing; `null` overlays delete a file. */
    inspect(this: void, project: SourceProject, host: SourceWorkflowHost, overlays?: ReadonlyMap<string, Uint8Array | null>, signal?: AbortSignal): Promise<SourceProjectInspection>;
    /** Stable hash of the render-affecting generation options recorded in generation descriptors. */
    generationOptionsHash(this: void, options: Pick<SourceGenerationOptions, "sourceRoot" | "recipes" | "pristineAssets" | "codeWithdrawals" | "assembly">): string;
    /** Render a pure generation commit and prove original-ROM equality before it is retained. */
    prepare(this: void, options: SourceGenerationOptions): Promise<PreparedSourceGeneration>;
    /** Run static analysis over imported evidence and research, reporting code added as instructions. */
    analyze(this: void, options: SourceAnalysisOptions): {
        /** `incomplete` when a work or depth budget stopped analysis early. */
        readonly status: "complete" | "incomplete";
        /** Newly discovered code summarized for capture import notes. */
        readonly addedCode: Parameters<typeof completeCaptureImportNotes>[3];
    };
    /** Query captured graphics evidence selected by `operation.graphicsQuery`. */
    graphics?(this: void, project: SourceProject, operation: SourceTargetOperation): unknown;
    /** Apply reviewable source, layout and build edits that grow the ROM to `operation.expansionSize`. */
    expand?(this: void, project: SourceProject, host: SourceWorkflowHost, operation: SourceTargetOperation): Promise<unknown>;
    /** Move layout object `operation.objectId` into declared free space through ordinary source edits. */
    relocate?(this: void, project: SourceProject, host: SourceWorkflowHost, operation: SourceTargetOperation): Promise<unknown>;
    /** Import a target-specific capture; `null` defers the archive to the shared runtime importers. */
    importPrimary?(this: void, options: SourceTargetCaptureOptions): Promise<SourceCaptureResult | null>;
    /** Optional relative archive path inside a verified instruction companion directory. */
    readonly companionArchive?: string;
}
/** Target callbacks depend on these data contracts, never on CLI/editor or workflow implementation. */
export interface SourceTargetOperation {
    /** Project directory the target operation runs against. */
    readonly directory: string;
    /** Checked between target phases; aborting rejects with the signal reason. */
    readonly signal?: AbortSignal;
    /** Receives human-readable progress messages from the target implementation. */
    readonly onProgress?: (message: string) => void;
    /** Layout object id for relocate/expand operations when required by the target. */
    readonly objectId?: string;
    /** Requested additional bytes when expanding a layout object. */
    readonly expansionSize?: number;
    /** Optional bounded graphics lookup keyed to one imported capture identity. */
    readonly graphicsQuery?: {
        /** Capture content hash selecting the runtime evidence pool to query. */
        readonly captureSha256: string;
        /** Program counter filter when narrowing graphics facts to one site. */
        readonly pc?: number;
        /** Physical ROM offset filter when narrowing graphics facts to one site. */
        readonly physicalOffset?: number;
        /** Maximum number of graphics facts to return for the query. */
        readonly limit?: number;
    };
}
/** Host services injected into target callbacks without importing CLI or editor code. */
export interface SourceWorkflowHost {
    /** Optional target descriptors registered for this workflow host. */
    readonly targets?: readonly SourceTargetDescriptor[];
    /** Load assembler environment, resolved plugins, and configuration for a config file. */
    readonly loadEnvironment: (configFile: string) => Promise<Awaited<ReturnType<SourceGenerationOptions["loadEnvironment"]>> & {
        readonly configuration: {
            readonly plugins: readonly {
                readonly bundled?: boolean;
                readonly resolvedModule: string;
            }[];
        };
    }>;
    /** Fingerprint the resolved plugin toolchain for publication receipts. */
    readonly fingerprint: (plugins: readonly string[]) => {
        readonly sha256: string;
    };
}
/** Initialization owns staging and publishes only after original-ROM equality succeeds. */
export interface InitializeSourceOptions {
    /** New or existing project directory to initialize. */
    readonly directory: string;
    /** Original ROM file whose identity seeds the project. */
    readonly rom: string;
    /** Optional Diz RAW companion file for initial import. */
    readonly dizRawFile?: string;
    /** Mapper override when not inferred from the ROM header. */
    readonly mapper?: string;
    /** Optional stable project id override for publication. */
    readonly id?: string;
    /** Resource ceilings copied into the new project configuration. */
    readonly limits?: SourceProject["configuration"]["limits"];
    /** Checked during initialization; aborting rejects with the signal reason. */
    readonly signal?: AbortSignal;
    /** Receives human-readable initialization progress messages. */
    readonly onProgress?: (message: string) => void;
    /** Expected toolchain fingerprint recorded in the initialization receipt. */
    readonly toolchainSha256: string;
    /** Load assembler environment for the initial pure generation pass. */
    readonly loadEnvironment: SourceGenerationOptions["loadEnvironment"];
}
/** Initial pure generation and byte-equality proof, published atomically with the new project. */
export interface SourceInitializationResult {
    /** Project directory containing the published initialization artifacts. */
    readonly directory: string;
    /** Published generation commit or tree identity from initialization. */
    readonly generation: string;
    /** Exact rebuild verification tying output back to the original ROM. */
    readonly verification: SourceBuildVerification;
    /** Static analysis summary captured during initialization before publication. */
    readonly analysis: {
        /** Whether disassembly reached a complete or intentionally bounded result. */
        readonly status: "complete" | "incomplete";
        /** Count of decoded instructions published into the new analysis project. */
        readonly instructions: number;
        /** Analyzer stop reasons when status is incomplete. */
        readonly incompleteReasons: readonly StaticAnalysisIncompleteReason[];
    };
}
//# sourceMappingURL=target-contracts.d.ts.map
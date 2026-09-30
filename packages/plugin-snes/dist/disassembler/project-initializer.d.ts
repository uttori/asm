import type { AssemblerEnvironment } from "@uttori/asm-core/plugin";
import { type AnalysisProjectManifest, type ByteComparison, type ImportReport, type ProjectMapping, type RomIdentity, type SourceExportManifest, type StaticAnalysisIncompleteReason } from "@uttori/asm-disassembler";
import { type Snes65816EntryPoint } from "./65816-analysis.js";
import { type SnesMapper, type SnesRomDetection } from "./rom-header.js";
/** Stable target id written to native SNES analysis projects. */
declare const TARGET_ID = "snes.sfc";
declare const ARCHITECTURE_ID = "snes.65816";
/** Stages emitted by project initialization progress callbacks. */
export type SnesProjectInitializationStage = "probe" | "create" | "analyze" | "export" | "verify" | "configure" | "commit";
/** One structured progress event. */
export interface SnesProjectInitializationProgress {
    readonly stage: SnesProjectInitializationStage;
    readonly message: string;
    /** Instruction observations grouped so far; these derived counts are not published yet. */
    readonly processedObservations?: number;
}
/** Shared cancellation and progress controls for long-running operations. */
export interface SnesProjectOperationOptions {
    /** Checked at operation boundaries. Synchronous analysis and filesystem writes are not preempted. */
    readonly signal?: AbortSignal;
    /** Called synchronously. A throw stops the operation and can leave an existing export partially written. */
    readonly onProgress?: (progress: SnesProjectInitializationProgress) => void;
}
/** Thrown when a project operation observes an aborted signal. */
export declare class SnesProjectInitializationCancelledError extends Error {
    constructor();
}
/** Optional DizRaw metadata returned by a read-only probe. */
export interface SnesDizRawProbe {
    readonly mapping: ProjectMapping;
    readonly report: ImportReport;
    readonly metadataBytes: number;
}
/** Content-based ROM and optional DizRaw inspection result. */
export interface SnesProjectProbeResult {
    readonly target: typeof TARGET_ID;
    readonly architecture: typeof ARCHITECTURE_ID;
    readonly rom: RomIdentity;
    readonly detection: SnesRomDetection;
    readonly dizRaw?: SnesDizRawProbe;
    /** True when an explicit mapper is required before project creation. */
    readonly mapperSelectionRequired: boolean;
    /** Human-readable reason for requesting a mapper. */
    readonly mapperSelectionReason?: string;
}
/** Read-only inspection inputs. Relative paths resolve from process.cwd(). */
export interface ProbeSnesProjectOptions extends SnesProjectOperationOptions {
    readonly romFile: string;
    readonly dizRawFile?: string;
    /** Explicit cartridge mapping. Omit for detection, which can require a user choice. */
    readonly mapper?: SnesMapper;
    /** Copier-header byte count. Omit for file-size-based detection. */
    readonly headerSize?: 0 | 512;
}
/** Creates a project only in a missing or empty directory, without copying the ROM. */
export interface CreateSnesAnalysisProjectOptions extends ProbeSnesProjectOptions {
    readonly projectDirectory: string;
}
/** Structured result of native analysis-project creation. */
export interface CreateSnesAnalysisProjectResult {
    readonly projectDirectory: string;
    readonly probe: SnesProjectProbeResult;
    readonly manifest: AnalysisProjectManifest;
    readonly importReport?: ImportReport;
}
/** Reanalysis preserves manual annotations and runtime evidence, and rejects concurrent project edits. */
export interface AnalyzeSnesProjectOptions extends SnesProjectOperationOptions {
    readonly projectDirectory: string;
    readonly romFile: string;
    /** Additional CPU bus addresses with explicit state, alongside vector and saved runtime seeds. */
    readonly entryPoints?: readonly Snes65816EntryPoint[];
    /** Positive safe integer work limit. Omitted uses the analyzer default of 1_000_000. */
    readonly maxWorkItems?: number;
    /** Nonnegative call-context depth. Omitted uses the analyzer default of 16. Zero discards call history. */
    readonly maxCallDepth?: number;
}
/** Structured summary of one bounded static-analysis pass. */
export interface AnalyzeSnesProjectResult {
    readonly projectDirectory: string;
    readonly manifest: AnalysisProjectManifest;
    readonly status: "complete" | "incomplete";
    readonly instructions: number;
    readonly capturedInstructions: number;
    readonly runtimePcsWithoutCode: number;
    readonly functions: number;
    readonly conflicts: number;
    readonly unresolved: number;
    readonly processedWorkItems: number;
    /** Unique persisted runtime PCs supplied to the analyzer, including explicit overlaps. */
    readonly runtimeSeeds: number;
    /** Lower-ranked persisted runtime PCs omitted by the deterministic seed safety bound. */
    readonly omittedRuntimeSeeds: number;
    readonly incompleteReasons: readonly StaticAnalysisIncompleteReason[];
}
/** Regenerates files owned by the export manifest while retaining user-owned input maps. */
export interface ExportSnesProjectOptions extends SnesProjectOperationOptions {
    /** Preferred dataStruct/row width including indentation; integer >= 40, defaults to 100. */
    readonly structLineWidth?: number;
    /** Wrap generated assembly comments; defaults to true. */
    readonly wrapComments?: boolean;
    /** Preferred comment columns including indentation, integer >= 20; default 100. */
    readonly commentLineWidth?: number;
    readonly projectDirectory: string;
    readonly romFile: string;
    readonly sourceDirectory: string;
    /** Allow replacing modified generated files. Does not permit code regression or delete input maps. */
    readonly force?: boolean;
    /** Explicitly permit previously emitted instructions to become raw bytes. */
    readonly allowCodeRegression?: boolean;
    /** Reject concurrent changes before writing source derived from a particular saved edit. */
    readonly expectedRevision?: string;
}
/** Structured source-export result. */
export interface ExportSnesProjectResult {
    readonly sourceDirectory: string;
    readonly manifest: SourceExportManifest;
    readonly codeBytes: number;
}
/** Requires unchanged generated files, current map inputs, and the original ROM identity. */
export interface VerifySnesProjectRoundTripOptions extends SnesProjectOperationOptions {
    readonly sourceDirectory: string;
    readonly romFile: string;
    /** Emit a debug map for the headerless content output. Defaults to true. */
    readonly emitDebugMap?: boolean;
    /** Emit a symbols/types include for bounded modification projects after exact verification. */
    readonly emitInterface?: boolean;
    /** Verify retained historical source bytes even when metadata inputs are newer than its manifest. */
    readonly retainedGeneration?: boolean;
    /** Trusted host loader called with the absolute build-configuration path after integrity and
     * ROM checks. The host owns plugin disposal after verification settles. Defaults to bundled
     * SNES support only; configured asset formats/transforms require a host loader.
     */
    readonly loadEnvironment?: (configurationFile: string) => Promise<{
        readonly environment: AssemblerEnvironment;
        readonly includePaths?: readonly string[];
        readonly targetOptions?: Readonly<Record<string, unknown>>;
    }>;
}
/** Byte-identical verification result and the generated build artifacts. */
export interface VerifySnesProjectRoundTripResult {
    readonly sourceDirectory: string;
    readonly contentOutput: string;
    readonly finalOutput: string;
    readonly debugMap?: string;
    /** Generated include of verified ROM labels, hardware/RAM constants, and data structures. */
    readonly interfaceFile?: string;
    readonly comparison: ByteComparison;
}
/** A host-owned file written to the staged workspace before it is committed. */
export interface SnesWorkspaceFile {
    /** Safe path relative to the workspace root. */
    readonly path: string;
    readonly contents: string | Uint8Array;
}
export interface InitializeSnesDisassemblyWorkspaceOptions extends ProbeSnesProjectOptions {
    readonly outputDirectory: string;
    readonly entryPoints?: readonly Snes65816EntryPoint[];
    readonly maxWorkItems?: number;
    readonly maxCallDepth?: number;
    /** Files such as editor settings supplied by the host, written inside the transaction. */
    readonly workspaceFiles?: readonly SnesWorkspaceFile[];
}
/** Complete, committed disassembly workspace initialization result. */
export interface InitializeSnesDisassemblyWorkspaceResult {
    readonly outputDirectory: string;
    readonly probe: SnesProjectProbeResult;
    readonly project: CreateSnesAnalysisProjectResult;
    readonly analysis: AnalyzeSnesProjectResult;
    readonly source: ExportSnesProjectResult;
    readonly roundTrip: VerifySnesProjectRoundTripResult;
}
/**
 * Loads a ROM and optional DizRaw project without writing anything.
 * The result contains ranked mapper candidates and whether the host must ask the user to choose.
 * @param {ProbeSnesProjectOptions} options ROM, optional DizRaw file, and operation controls.
 * @returns {SnesProjectProbeResult} Ranked detection and import metadata.
 */
export declare const probeSnesProject: (options: ProbeSnesProjectOptions) => SnesProjectProbeResult;
/**
 * Creates a native analysis project through a staged sibling directory.
 * @param {CreateSnesAnalysisProjectOptions} options ROM, mapping, import, and destination options.
 * @returns {CreateSnesAnalysisProjectResult} Committed project and import summary.
 */
export declare const createSnesAnalysisProject: (options: CreateSnesAnalysisProjectOptions) => CreateSnesAnalysisProjectResult;
/**
 * Runs bounded conservative 65816 analysis and atomically updates the native project.
 * Completion describes explored work, not proof that all code was found. An incomplete pass that
 * would discard previously decoded code throws before replacing saved analysis. This synchronous
 * operation checks cancellation at phase boundaries and cannot observe queued abort callbacks mid-pass.
 * @param {AnalyzeSnesProjectOptions} options Project, ROM, entry points, and work limits.
 * @returns {AnalyzeSnesProjectResult} Structured analysis counts and completion state.
 */
export declare const analyzeSnesProject: (options: AnalyzeSnesProjectOptions) => AnalyzeSnesProjectResult;
/**
 * Exports deterministic editable source from a verified native project.
 * Unjustified bytes remain raw assets. File hashes and code-preservation checks run before writes,
 * but regeneration is not a multi-file transaction. Preserve edits and retry after an I/O failure.
 * @param {ExportSnesProjectOptions} options Project, ROM, destination, and overwrite policy.
 * @returns {ExportSnesProjectResult} Source manifest and native-code coverage count.
 */
export declare const exportSnesProject: (options: ExportSnesProjectOptions) => ExportSnesProjectResult;
/**
 * Assembles an exported tree and verifies the complete ROM byte-for-byte.
 * @param {VerifySnesProjectRoundTripOptions} options Source directory, ROM, and operation controls.
 * @returns {Promise<VerifySnesProjectRoundTripResult>} Exact comparison and build artifact paths.
 */
export declare const verifySnesProjectRoundTrip: (options: VerifySnesProjectRoundTripOptions) => Promise<VerifySnesProjectRoundTripResult>;
/**
 * Creates, analyzes, exports, verifies, configures, and atomically commits a complete workspace.
 * Nothing is written to the selected destination until every earlier stage has succeeded.
 * @param {InitializeSnesDisassemblyWorkspaceOptions} options Complete initialization inputs.
 * @returns {Promise<InitializeSnesDisassemblyWorkspaceResult>} Committed project stage results.
 */
export declare const initializeSnesDisassemblyWorkspace: (options: InitializeSnesDisassemblyWorkspaceOptions) => Promise<InitializeSnesDisassemblyWorkspaceResult>;
export {};
//# sourceMappingURL=project-initializer.d.ts.map
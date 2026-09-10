import { type AnalysisProjectManifest, type ByteComparison, type ImportReport, type ProjectMapping, type RomIdentity, type SourceExportManifest, type StaticAnalysisIncompleteReason } from "@uttori/asm-disassembler";
import { type Snes65816EntryPoint } from "./65816-analysis.js";
import { type SnesHeuristicConfiguration } from "./function-heuristics.js";
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
}
/** Shared cancellation and progress controls for long-running operations. */
export interface SnesProjectOperationOptions {
    readonly signal?: AbortSignal;
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
export interface ProbeSnesProjectOptions extends SnesProjectOperationOptions {
    readonly romFile: string;
    readonly dizRawFile?: string;
    readonly mapper?: SnesMapper;
    readonly headerSize?: 0 | 512;
}
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
export interface AnalyzeSnesProjectOptions extends SnesProjectOperationOptions {
    readonly heuristics?: SnesHeuristicConfiguration;
    readonly projectDirectory: string;
    readonly romFile: string;
    readonly entryPoints?: readonly Snes65816EntryPoint[];
    readonly maxWorkItems?: number;
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
    readonly heuristicRoles: number;
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
export interface ExportSnesProjectOptions extends SnesProjectOperationOptions {
    readonly projectDirectory: string;
    readonly romFile: string;
    readonly sourceDirectory: string;
    readonly force?: boolean;
    /** Explicitly permit previously emitted instructions to become raw bytes. */
    readonly allowCodeRegression?: boolean;
}
/** Structured source-export result. */
export interface ExportSnesProjectResult {
    readonly sourceDirectory: string;
    readonly manifest: SourceExportManifest;
    readonly codeBytes: number;
}
export interface VerifySnesProjectRoundTripOptions extends SnesProjectOperationOptions {
    readonly sourceDirectory: string;
    readonly romFile: string;
    /** Emit a debug map for the headerless content output. Defaults to true. */
    readonly emitDebugMap?: boolean;
}
/** Byte-identical verification result and the generated build artifacts. */
export interface VerifySnesProjectRoundTripResult {
    readonly sourceDirectory: string;
    readonly contentOutput: string;
    readonly finalOutput: string;
    readonly debugMap?: string;
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
 * @param {AnalyzeSnesProjectOptions} options Project, ROM, entry points, and work limits.
 * @returns {AnalyzeSnesProjectResult} Structured analysis counts and completion state.
 */
export declare const analyzeSnesProject: (options: AnalyzeSnesProjectOptions) => AnalyzeSnesProjectResult;
/**
 * Exports deterministic editable source from a verified native project.
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
/** Public source-export manifest filename for wizard hosts. */
export declare const SNES_SOURCE_EXPORT_MANIFEST = "generated-files.json";
export {};
//# sourceMappingURL=project-initializer.d.ts.map
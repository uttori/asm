import { type AnalysisProjectManifest, type ImportReport, type ProjectMapping, type RomIdentity, type StaticAnalysisIncompleteReason, type ResearchSnapshot, type CaptureAddedCode } from "@uttori/asm-disassembler";
import { type Snes65816EntryPoint } from "./65816-analysis.js";
import { type SnesMapper, type SnesRomDetection } from "./rom-header.js";
/** Stable target id written to native SNES analysis projects. */
declare const TARGET_ID = "snes.sfc";
declare const ARCHITECTURE_ID = "snes.65816";
/** Stages emitted by project initialization progress callbacks. */
export type SnesProjectInitializationStage = "probe" | "create" | "analyze" | "commit";
/** One structured progress event. */
export interface SnesProjectInitializationProgress {
    /** Current initialization phase for UI grouping. */
    readonly stage: SnesProjectInitializationStage;
    /** Human-readable status line for the active phase. */
    readonly message: string;
    /** Instruction observations grouped so far; these derived counts are not published yet. */
    readonly processedObservations?: number;
    /** Exact grouping input count from the same SQLite read snapshot. */
    readonly totalObservations?: number;
}
/** Shared cancellation and progress controls for long-running operations. */
export interface SnesProjectOperationOptions {
    /** Checked at operation boundaries. Synchronous analysis and filesystem writes are not preempted. */
    readonly signal?: AbortSignal;
    /** Called synchronously. A throw stops the operation before publishing analysis. */
    readonly onProgress?: (progress: SnesProjectInitializationProgress) => void;
}
/** Thrown when a project operation observes an aborted signal. */
export declare class SnesProjectInitializationCancelledError extends Error {
    constructor();
}
/** Optional DizRaw metadata returned by a read-only probe. */
export interface SnesDizRawProbe {
    /** Imported label/region mapping extracted from the DizRaw file. */
    readonly mapping: ProjectMapping;
    /** Loss and conflict report from the import pass. */
    readonly report: ImportReport;
    /** UTF-8 byte length of the parsed metadata payload. */
    readonly metadataBytes: number;
}
/** Content-based ROM and optional DizRaw inspection result. */
export interface SnesProjectProbeResult {
    /** Stable analysis target id written to new projects. */
    readonly target: typeof TARGET_ID;
    /** Primary CPU architecture id for the created project. */
    readonly architecture: typeof ARCHITECTURE_ID;
    /** Content identity of the probed ROM file. */
    readonly rom: RomIdentity;
    /** Mapper detection outcome from the headerless ROM. */
    readonly detection: SnesRomDetection;
    /** Optional DizRaw probe results when a sidecar file was supplied. */
    readonly dizRaw?: SnesDizRawProbe;
    /** True when an explicit mapper is required before project creation. */
    readonly mapperSelectionRequired: boolean;
    /** Human-readable reason for requesting a mapper. */
    readonly mapperSelectionReason?: string;
}
/** Read-only inspection inputs. Relative paths resolve from process.cwd(). */
export interface ProbeSnesProjectOptions extends SnesProjectOperationOptions {
    /** Path to the private ROM image on disk. */
    readonly romFile: string;
    /** Optional uncompressed `.dizraw` metadata file to preview. */
    readonly dizRawFile?: string;
    /** Explicit cartridge mapping. Omit for detection, which can require a user choice. */
    readonly mapper?: SnesMapper;
    /** Copier-header byte count. Omit for file-size-based detection. */
    readonly headerSize?: 0 | 512;
}
/** Creates a project only in a missing or empty directory, without copying the ROM. */
export interface CreateSnesAnalysisProjectOptions extends ProbeSnesProjectOptions {
    /** Empty or missing directory receiving the new analysis project. */
    readonly projectDirectory: string;
}
/** Structured result of native analysis-project creation. */
export interface CreateSnesAnalysisProjectResult {
    /** Directory where the analysis project was published. */
    readonly projectDirectory: string;
    /** ROM and mapper probe results captured during creation. */
    readonly probe: SnesProjectProbeResult;
    /** Published manifest after the initial project commit. */
    readonly manifest: AnalysisProjectManifest;
    /** DizRaw import report when a sidecar was ingested during creation. */
    readonly importReport?: ImportReport;
}
/** Reanalysis preserves manual annotations and runtime evidence, and rejects concurrent project edits. */
export interface AnalyzeSnesProjectOptions extends SnesProjectOperationOptions {
    /** Existing analysis project directory to reanalyze. */
    readonly projectDirectory: string;
    /** ROM file path supplying the current cartridge bytes. */
    readonly romFile: string;
    /** Selected Git decisions must already be indexed and are reapplied atomically after analysis. */
    readonly research?: ResearchSnapshot;
    /** Recheck branch inputs under the publication lock; a throw leaves the previous analysis intact. */
    readonly assertResearchCurrent?: () => void;
    /** Additional CPU bus addresses with explicit state, alongside vector and saved runtime seeds. */
    readonly entryPoints?: readonly Snes65816EntryPoint[];
    /** Positive safe integer work limit. Omitted uses the analyzer default of 1_000_000. */
    readonly maxWorkItems?: number;
    /** Nonnegative call-context depth. Omitted uses the analyzer default of 16. Zero discards call history. */
    readonly maxCallDepth?: number;
}
/** Structured summary of one bounded static-analysis pass. */
export interface AnalyzeSnesProjectResult {
    /** Analysis project directory that was reanalyzed. */
    readonly projectDirectory: string;
    /** Manifest after the analysis publication commit. */
    readonly manifest: AnalysisProjectManifest;
    /** Whether static analysis finished within configured limits. */
    readonly status: "complete" | "incomplete";
    /** Decoded static instruction count in the published store. */
    readonly instructions: number;
    /** Runtime instruction observations grouped for seeding. */
    readonly capturedInstructions: number;
    /** ROM bytes newly decoded by this pass compared with the previously published code coverage. */
    readonly addedCode: readonly CaptureAddedCode[];
    /** Distinct runtime PCs that still lack matching static code. */
    readonly runtimePcsWithoutCode: number;
    /** Control-flow function nodes identified in the CFG. */
    readonly functions: number;
    /** Conflicting decode or state records emitted by analysis. */
    readonly conflicts: number;
    /** Unresolved indirect or unknown-state sites remaining. */
    readonly unresolved: number;
    /** Worklist items consumed before completion or cap. */
    readonly processedWorkItems: number;
    /** Unique persisted runtime PCs supplied to the analyzer, including explicit overlaps. */
    readonly runtimeSeeds: number;
    /** Lower-ranked persisted runtime PCs omitted by the deterministic seed safety bound. */
    readonly omittedRuntimeSeeds: number;
    /** Structured reasons when status is incomplete. */
    readonly incompleteReasons: readonly StaticAnalysisIncompleteReason[];
}
/**
 * Loads a ROM and optional DizRaw project without writing anything.
 * The result contains ranked mapper candidates and whether the host must ask the user to choose.
 * @param options ROM, optional DizRaw file, and operation controls.
 * @returns Ranked detection and import metadata.
 */
export declare const probeSnesProject: (options: ProbeSnesProjectOptions) => SnesProjectProbeResult;
/**
 * Creates a native analysis project through a staged sibling directory.
 * @param options ROM, mapping, import, and destination options.
 * @returns Committed project and import summary.
 */
export declare const createSnesAnalysisProject: (options: CreateSnesAnalysisProjectOptions) => CreateSnesAnalysisProjectResult;
/**
 * Runs bounded conservative 65816 analysis and atomically updates the native project.
 * Completion describes explored work, not proof that all code was found. An incomplete pass that
 * would discard previously decoded code throws before replacing saved analysis. This synchronous
 * operation checks cancellation at phase boundaries and cannot observe queued abort callbacks mid-pass.
 * @param options Project, ROM, entry points, and work limits.
 * @returns Structured analysis counts and completion state.
 */
export declare const analyzeSnesProject: (options: AnalyzeSnesProjectOptions) => AnalyzeSnesProjectResult;
export {};
//# sourceMappingURL=project-initializer.d.ts.map
import { type AnalysisRecord, type AnalysisTargetOverrideRecord, type AnalysisTargetSetRecord, type EvidenceRecord, type IntervalAnnotation, type ProjectLabel, type RomImage, type StaticAnalysisLimits, type StaticAnalysisResult } from "@uttori/asm-disassembler";
import { type Cpu65816AbstractState, type Cpu65816StateOverride } from "./65816-state.js";
import { type SnesMapper } from "./rom-header.js";
/** Extra analysis seed beyond hardware vectors, labels, and `points: ["in"]` annotations. */
export interface Snes65816EntryPoint {
    /** Stable project id; used as `entry:<id>` in the worklist and evidence. */
    readonly id: string;
    /** 24-bit SNES CPU address. */
    readonly address: number;
    /** Runtime observations seed reachability without inventing a function boundary. */
    readonly kind?: "configured" | "observation";
    /** Optional known E/M/X/banks/D/S overlay applied after annotation state. */
    readonly state?: Cpu65816StateOverride;
    /** Evidence ids to attach; a synthetic `manual:entry:<id>` is created if omitted. */
    readonly evidence?: readonly string[];
}
/**
 * Project shards and worklist limits for `analyzeSnes65816`.
 * Data-classified intervals block decode; opcode/operand intervals are ignored
 * as input (the run rewrites `static:65816:*` annotations on the way out).
 */
export interface Snes65816AnalysisOptions extends StaticAnalysisLimits {
    /** Existing project intervals; `static:65816:*` ids are stripped then regenerated. */
    readonly annotations?: readonly IntervalAnnotation[];
    /** Named labels used as additional CFG seeds. */
    readonly labels?: readonly ProjectLabel[];
    /** Evidence records referenced by annotations, labels, and entry points. */
    readonly evidence?: readonly EvidenceRecord[];
    /** Configured entry points (overlays, engines, banked dispatch). */
    readonly entryPoints?: readonly Snes65816EntryPoint[];
    /** Named target collections; every address is seeded. */
    readonly targetSets?: readonly AnalysisTargetSetRecord[];
    /** Manual resolutions for indirect control-flow sites. */
    readonly targetOverrides?: readonly AnalysisTargetOverrideRecord[];
}
/** Worklist CFG plus project-shaped records, opcode/operand intervals, and run evidence. */
export interface Snes65816AnalysisResult extends StaticAnalysisResult<Cpu65816AbstractState> {
    /** CFG nodes/edges, functions, conflicts, unresolved flows, and a run summary. */
    readonly records: readonly AnalysisRecord[];
    /** Regenerated `static:65816:opcode:*` / `operand:*` file-offset intervals. */
    readonly annotations: readonly IntervalAnnotation[];
    /** Detector/static evidence created by this run (vectors and the run id). */
    readonly evidenceRecords: readonly EvidenceRecord[];
}
/**
 * Runs conservative 65816 CFG analysis over a headerless immutable ROM view.
 * Seeds from RESET/interrupt vectors, labels, `points: ["in"]` annotations,
 * configured entry points, and target sets. Data-classified intervals block
 * decode; hardware I/O is never treated as ROM.
 * @param {RomImage} rom Immutable ROM content and identity.
 * @param {SnesMapper} mapper Explicitly detected or user-selected SNES mapper.
 * @param {Snes65816AnalysisOptions} [options] Project annotations, seeds, overrides, and deterministic limits.
 * @returns {Snes65816AnalysisResult} Static CFG, abstract states, project records, annotations, and evidence.
 */
export declare const analyzeSnes65816: (rom: RomImage, mapper: SnesMapper, options?: Snes65816AnalysisOptions) => Snes65816AnalysisResult;
//# sourceMappingURL=65816-analysis.d.ts.map
import { type AnalysisRecord, type AnalysisTargetOverrideRecord, type AnalysisTargetSetRecord, type EvidenceRecord, type IntervalAnnotation, type ProjectLabel, type StaticAnalysisResult } from "@uttori/asm-disassembler";
import { SuperFxRomImage } from "./superfx-address-space.js";
import { type SuperFxAbstractState } from "./superfx-state.js";
/** Configured GSU entry point seeded into SuperFX control-flow analysis. */
export interface SuperFxEntryPoint {
    /** Stable id used in the seed id and synthesized manual evidence id. */
    readonly id: string;
    /** 24-bit GSU address; its bank becomes the entry program bank. */
    readonly address: number;
    /** Known prefix state overriding the prefix-free default at entry. */
    readonly state?: {
        /** Pending ALT1/ALT2 bits. */
        readonly alt?: 0 | 1 | 2 | 3;
        /** Register selected by a preceding `TO`/`WITH`. */
        readonly destinationRegister?: number;
        /** Register selected by a preceding `FROM`/`WITH`. */
        readonly sourceRegister?: number;
    };
    /** Evidence ids; when omitted, a manual record `manual:entry:<id>` is synthesized. */
    readonly evidence?: readonly string[];
}
/** Seeds, constraints and limits for one SuperFX analysis run. */
export interface SuperFxAnalysisOptions {
    /** Configured entry points, seeded with their optional prefix state. */
    readonly entryPoints?: readonly SuperFxEntryPoint[];
    /** Project labels; only those in the GSU ROM address space become seeds. */
    readonly labels?: readonly ProjectLabel[];
    /** Existing annotations; data classifications block decoding and `in` points become seeds. Prior `static:superfx:` records are ignored. */
    readonly annotations?: readonly IntervalAnnotation[];
    /** Existing evidence records, passed through and used to avoid duplicate entry evidence. */
    readonly evidence?: readonly EvidenceRecord[];
    /** Manual targets for indirect control transfers in the GSU ROM address space. */
    readonly targetOverrides?: readonly AnalysisTargetOverrideRecord[];
    /** Target-set addresses seeded as additional entry points. */
    readonly targetSets?: readonly AnalysisTargetSetRecord[];
    /** Work-item cap forwarded to the generic worklist; its default applies when omitted. */
    readonly maxWorkItems?: number;
    /** Call-depth cap forwarded to the generic worklist; its default applies when omitted. */
    readonly maxCallDepth?: number;
}
/** Static CFG result plus project records derived from it. */
export interface SuperFxAnalysisResult extends StaticAnalysisResult<SuperFxAbstractState> {
    /** Analysis records for nodes, edges, entries and diagnostics. */
    readonly records: readonly AnalysisRecord[];
    /** Opcode and operand annotations for every decoded instruction. */
    readonly annotations: readonly IntervalAnnotation[];
    /** Input evidence plus the run and synthesized entry evidence, sorted by id. */
    readonly evidenceRecords: readonly EvidenceRecord[];
}
/**
 * Runs conservative control-flow analysis over one contiguous SuperFX program image.
 * @param image Immutable GSU ROM image to analyze.
 * @param options Entry points, annotations, and overrides.
 * @returns CFG, evidence, conflicts, and project records.
 */
export declare const analyzeSuperFxRom: (image: SuperFxRomImage, options?: SuperFxAnalysisOptions) => SuperFxAnalysisResult;
//# sourceMappingURL=superfx-analysis.d.ts.map
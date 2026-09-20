import { type LoadedAnalysisProject } from "./project-store.js";
import type { AnalysisConflictRecord, AnalysisProject, AnalysisProjectManifest, AnalysisProjectShards, AnalysisRecord, AnalysisTargetOverrideRecord, EvidenceRecord, ImportReport, IntervalAnnotation, ProjectComment, ProjectLabel, ProjectRegion, RuntimeEvidenceRecord } from "./project-types.js";
/** Classifications accepted by a manual range edit. */
export declare const RANGE_CLASSIFICATIONS: readonly ["unreached", "opcode", "operand", "data8", "data16", "data24", "data32", "pointer16", "pointer24", "pointer32", "graphics", "music", "compressed", "asset", "empty", "text"];
/** Complete, deterministic input for one manual half-open classification edit. */
export interface RangeClassificationEditRequest {
    readonly annotationId: string;
    readonly evidenceId: string;
    readonly addressSpace: string;
    readonly start: number;
    readonly end: number;
    readonly classification: IntervalAnnotation["classification"];
    readonly architecture: string;
    readonly sourceId: string;
    readonly detail?: string;
}
/** Exact records added by a range edit, retained so undo cannot remove changed user data. */
export interface RangeClassificationInverse {
    readonly kind: "remove-range-classification";
    readonly annotation: IntervalAnnotation;
    readonly evidence: EvidenceRecord;
    readonly conflicts: readonly AnalysisConflictRecord[];
}
/** Result of a range classification before it is committed to disk. */
export interface AppliedRangeClassificationEdit {
    readonly project: AnalysisProject;
    readonly inverse: RangeClassificationInverse;
}
/** State fields stored on a manual analysis annotation. */
export type ManualAnnotationState = NonNullable<IntervalAnnotation["state"]>;
/** Additive state and entry-point metadata copied onto an existing classified interval. */
export interface StateEntryPointEditRequest {
    readonly annotationId: string;
    readonly evidenceId: string;
    readonly baseAnnotationId: string;
    readonly state?: ManualAnnotationState;
    readonly entryPoint?: boolean;
    readonly sourceId: string;
    readonly detail?: string;
}
/** Exact records produced by a state/entry-point edit. */
export interface StateEntryPointInverse {
    readonly kind: "remove-state-entry-point";
    readonly annotation: IntervalAnnotation;
    readonly evidence: EvidenceRecord;
    readonly conflicts: readonly AnalysisConflictRecord[];
}
/** Result of adding state or an entry point before it is committed. */
export interface AppliedStateEntryPointEdit {
    readonly project: AnalysisProject;
    readonly inverse: StateEntryPointInverse;
}
/** Manual resolution for one indirect control-flow site. */
export interface TargetResolutionEditRequest {
    readonly overrideId: string;
    readonly evidenceId: string;
    readonly addressSpace: string;
    readonly address: number;
    readonly targets: readonly number[];
    readonly sourceId: string;
    readonly detail?: string;
}
/** Exact before/after target-override state retained for safe undo. */
export interface TargetResolutionInverse {
    readonly kind: "restore-target-resolution";
    readonly before?: AnalysisTargetOverrideRecord;
    readonly after: AnalysisTargetOverrideRecord;
    readonly evidence: EvidenceRecord;
}
/** Result of resolving an indirect target before it is committed. */
export interface AppliedTargetResolutionEdit {
    readonly project: AnalysisProject;
    readonly inverse: TargetResolutionInverse;
}
/** Manual rename of one stable label record. */
export interface LabelRenameEditRequest {
    readonly labelId: string;
    readonly evidenceId: string;
    readonly name: string;
    readonly sourceId: string;
    readonly detail?: string;
}
/** Exact before/after label state retained for safe undo. */
export interface LabelRenameInverse {
    readonly kind: "restore-label-name";
    readonly before: ProjectLabel;
    readonly after: ProjectLabel;
    readonly evidence: EvidenceRecord;
}
/** Result of renaming a label before it is committed. */
export interface AppliedLabelRenameEdit {
    readonly project: AnalysisProject;
    readonly inverse: LabelRenameInverse;
}
/**
 * One address-based label/comment edit. Addresses are bytes in the named space, never source lines.
 * Omitted text fields remain unchanged. Empty comment strings clear only the selected fields.
 * New records and manual evidence need stable IDs unique within their respective collections.
 */
export interface DisassemblyAnnotationEditRequest {
    readonly addressSpace: string;
    readonly address: number;
    readonly labelId?: string;
    readonly name?: string;
    readonly comment?: string;
    readonly inlineComment?: string;
    readonly instructionCommentId?: string;
    readonly instructionComment?: string;
    readonly evidenceId: string;
    readonly sourceId: string;
}
/** Exact records touched by one annotation edit, including creations and comment removal. */
export interface DisassemblyAnnotationInverse {
    readonly kind: "restore-disassembly-annotation";
    readonly labelBefore?: ProjectLabel;
    readonly labelAfter?: ProjectLabel;
    readonly commentBefore?: ProjectComment;
    readonly commentAfter?: ProjectComment;
    readonly evidence: EvidenceRecord;
}
/**
 * Pure edit result. Nothing is persisted until a revision-checked commit. Unchanged records can be
 * shared with the input. Retain the inverse in caller-owned undo state and commit undo separately.
 */
export interface AppliedDisassemblyAnnotationEdit {
    readonly project: AnalysisProject;
    readonly inverse: DisassemblyAnnotationInverse;
}
/** Any persisted record addressable by shard and stable id. */
export type AnalysisProjectShardRecord = AnalysisRecord | IntervalAnnotation | ProjectLabel | ProjectComment | ProjectRegion | RuntimeEvidenceRecord | EvidenceRecord | ImportReport;
/** Provenance and conflict links for one persisted project record. */
export interface ProjectEvidenceExplanation {
    /** Exact SQL reverse-reference total when the displayed list is a bounded preview. */
    readonly referencedByTotal?: number;
    readonly shard: keyof AnalysisProjectShards;
    readonly record: AnalysisProjectShardRecord;
    readonly evidence: readonly EvidenceRecord[];
    readonly referencedBy: readonly string[];
    readonly conflicts: readonly AnalysisConflictRecord[];
}
type ProjectLike = {
    readonly manifest: AnalysisProjectManifest | Omit<AnalysisProjectManifest, "shards">;
    readonly shards: AnalysisProjectShards;
};
/**
 * Adds one manual interval without deleting or rewriting prior annotations. Contradictory overlaps
 * become explicit range conflicts carrying both evidence sets, so no imported/static fact is lost.
 * @param {LoadedAnalysisProject} project Validated project snapshot to edit.
 * @param {RangeClassificationEditRequest} request Stable manual annotation/evidence identity.
 * @returns {AppliedRangeClassificationEdit} Replacement project and exact inverse records.
 */
export declare const applyRangeClassificationEdit: (project: LoadedAnalysisProject, request: RangeClassificationEditRequest) => AppliedRangeClassificationEdit;
/**
 * Removes exactly the records produced by an earlier classification edit. Undo refuses to proceed
 * when one of those records changed or the new evidence gained another reference.
 * @param {ProjectLike} project Current project state containing the applied edit.
 * @param {RangeClassificationInverse} inverse Exact records returned by the original edit.
 * @returns {AnalysisProject} Replacement project with only the unchanged edit records removed.
 */
export declare const revertRangeClassificationEdit: (project: ProjectLike, inverse: RangeClassificationInverse) => AnalysisProject;
/**
 * Adds a manual state/entry-point overlay by copying an existing classified interval. The base
 * record remains untouched. Incompatible overlapping state becomes an explicit conflict.
 * @param {LoadedAnalysisProject} project Validated project snapshot to edit.
 * @param {StateEntryPointEditRequest} request State, entry-point, and stable evidence identity.
 * @returns {AppliedStateEntryPointEdit} Replacement project and exact inverse records.
 */
export declare const applyStateEntryPointEdit: (project: LoadedAnalysisProject, request: StateEntryPointEditRequest) => AppliedStateEntryPointEdit;
/**
 * Safely removes the exact state/entry-point overlay produced by an earlier edit.
 * @param {ProjectLike} project Current project state containing the applied edit.
 * @param {StateEntryPointInverse} inverse Exact records returned by the original edit.
 * @returns {AnalysisProject} Replacement project with only unchanged edit records removed.
 */
export declare const revertStateEntryPointEdit: (project: ProjectLike, inverse: StateEntryPointInverse) => AnalysisProject;
/**
 * Adds targets and manual provenance to the sole override at a control-flow site. Existing targets
 * and evidence are unioned, because an indirect instruction can legitimately reach several sites.
 * @param {LoadedAnalysisProject} project Validated project snapshot to edit.
 * @param {TargetResolutionEditRequest} request Control-flow site, targets, and evidence identity.
 * @returns {AppliedTargetResolutionEdit} Replacement project and exact inverse state.
 */
export declare const applyTargetResolutionEdit: (project: LoadedAnalysisProject, request: TargetResolutionEditRequest) => AppliedTargetResolutionEdit;
/**
 * Safely restores or removes the exact target override produced by an earlier edit.
 * @param {ProjectLike} project Current project state containing the applied edit.
 * @param {TargetResolutionInverse} inverse Exact before/after records from the original edit.
 * @returns {AnalysisProject} Replacement project with the previous override restored.
 */
export declare const revertTargetResolutionEdit: (project: ProjectLike, inverse: TargetResolutionInverse) => AnalysisProject;
/**
 * Renames one label while adding certain manual provenance and retaining every prior evidence id.
 * @param {LoadedAnalysisProject} project Validated project snapshot to edit.
 * @param {LabelRenameEditRequest} request Stable label, replacement name, and evidence identity.
 * @returns {AppliedLabelRenameEdit} Replacement project and exact inverse state.
 */
export declare const applyLabelRenameEdit: (project: LoadedAnalysisProject, request: LabelRenameEditRequest) => AppliedLabelRenameEdit;
/**
 * Safely restores the exact label value replaced by an earlier rename.
 * @param {ProjectLike} project Current project state containing the applied edit.
 * @param {LabelRenameInverse} inverse Exact before/after records from the original rename.
 * @returns {AnalysisProject} Replacement project with the previous label restored.
 */
export declare const revertLabelRenameEdit: (project: ProjectLike, inverse: LabelRenameInverse) => AnalysisProject;
/**
 * Save a friendly name and comments without changing code classifications or earlier evidence.
 * @param {LoadedAnalysisProject} project Validated snapshot to edit.
 * @param {DisassemblyAnnotationEditRequest} request Address, text, and stable record identities.
 * @returns {AppliedDisassemblyAnnotationEdit} Replacement project and exact inverse records.
 */
export declare const applyDisassemblyAnnotationEdit: (project: LoadedAnalysisProject, request: DisassemblyAnnotationEditRequest) => AppliedDisassemblyAnnotationEdit;
/**
 * Undo only if every touched record and its new provenance are still exactly as saved.
 * @param {ProjectLike} project Current native project.
 * @param {DisassemblyAnnotationInverse} inverse Records retained when saving.
 * @returns {AnalysisProject} Restored project with unrelated records preserved.
 */
export declare const revertDisassemblyAnnotationEdit: (project: ProjectLike, inverse: DisassemblyAnnotationInverse) => AnalysisProject;
/**
 * Resolves complete evidence records, reverse references, and related persisted conflicts for one
 * stable project record. This is target-neutral and performs no mapper/address inference.
 * @param {AnalysisProjectShards} shards Validated native project records.
 * @param {keyof AnalysisProjectShards} shard Shard containing the requested record.
 * @param {string} recordId Stable record id to explain.
 * @returns {ProjectEvidenceExplanation} Direct provenance, reverse links, and related conflicts.
 */
export declare const explainProjectEvidence: (shards: AnalysisProjectShards, shard: keyof AnalysisProjectShards, recordId: string) => ProjectEvidenceExplanation;
export {};
//# sourceMappingURL=project-edit.d.ts.map
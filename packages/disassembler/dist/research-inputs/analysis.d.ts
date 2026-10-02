import type { AddressSpaceDescriptor, AnalysisTargetOverrideRecord, AnalysisTargetSetRecord, IntervalAnnotation } from "../model/project-types.js";
import { type ResearchDocument, type ResearchSnapshot } from "./inputs.js";
/** These explicit inputs affect decoding; derived CFG and captured observations are never editable here. */
export type ResearchAnalysisRecord = IntervalAnnotation | AnalysisTargetOverrideRecord | AnalysisTargetSetRecord;
/** Existing declarations stay in their file. New declarations select an existing subject/bank document. */
export type ResearchAnalysisChange = {
    /** Exact document selected before interactive prompts; prevents overwriting a concurrent decision. */
    readonly expectedDocumentSha256: string;
} & ({
    readonly kind: "put";
    readonly path: string;
    readonly reason: string;
    readonly collection: "annotations";
    readonly value: IntervalAnnotation;
} | {
    readonly kind: "put";
    readonly path: string;
    readonly reason: string;
    readonly collection: "analysis";
    readonly value: AnalysisTargetOverrideRecord | AnalysisTargetSetRecord;
} | {
    /** Removing a decision restores any imported observation; it does not erase evidence. */
    readonly kind: "remove";
    readonly collection: "annotations" | "analysis";
    readonly id: string;
});
/** A proposal is inert until the editor or terminal applies its exact before-content check. */
export interface ResearchAnalysisEdit {
    readonly path: string;
    readonly expectedSha256: string;
    readonly document: ResearchDocument;
}
/**
 * Prepare one Git-backed analysis decision with manual provenance. Imported records remain in the
 * evidence store; removing this declaration reveals them again on the next projection refresh.
 */
export declare function changeResearchAnalysis(snapshot: ResearchSnapshot, change: ResearchAnalysisChange | null | undefined, spaces: readonly AddressSpaceDescriptor[]): ResearchAnalysisEdit;
//# sourceMappingURL=analysis.d.ts.map
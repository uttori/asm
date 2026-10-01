import type { AnalysisProjectShards } from "../model/project-types.js";
/** Only explicit human decisions belong in these files; captures and derived CFG do not. */
export declare const RESEARCH_COLLECTIONS: readonly ["labels", "comments", "annotations", "regions", "analysis", "evidence"];
export type ResearchCollection = (typeof RESEARCH_COLLECTIONS)[number];
export type ResearchRecord = AnalysisProjectShards[ResearchCollection][number];
/** Null suppresses an imported record. Removing the decision restores the imported observation. */
export interface ResearchDecision {
    readonly collection: ResearchCollection;
    readonly id: string;
    readonly value: ResearchRecord | null;
}
/** A reviewable subject/bank document. Identity is tied to original ROM content, never relocation. */
export interface ResearchDocument {
    readonly format: "uttori-research";
    readonly version: 1;
    readonly project: string;
    readonly romSha256: string;
    readonly decisions: readonly ResearchDecision[];
}
/** A validated, deterministic selection of Git inputs; the hash is independent of JSON whitespace. */
export interface ResearchSnapshot {
    readonly project: string;
    readonly romSha256: string;
    readonly hash: string;
    readonly files: readonly {
        readonly path: string;
        readonly sha256: string;
        readonly document: ResearchDocument;
    }[];
    readonly decisions: readonly ResearchDecision[];
}
/** Recheck identities at the storage boundary, including snapshots supplied by JavaScript callers. */
export declare function validateResearchSnapshot(snapshot: ResearchSnapshot): void;
/** Reject unsupported record kinds before the generic project validator accesses their fields. */
export declare function validateResearchDecision(decision: ResearchDecision): void;
/** Parse a versioned authoring document; unknown top-level fields are rejected to catch misspellings. */
export declare function parseResearchDocument(value: unknown): ResearchDocument;
/** Read bounded JSON inputs only from explicitly selected roots, preserving file locations for F2/navigation. */
export declare function readResearchInputs(root: string, roots: readonly string[], identity: {
    readonly project: string;
    readonly romSha256: string;
}, overlays?: ReadonlyMap<string, string>): ResearchSnapshot;
/** Save one document with optimistic content matching. Git commits remain explicit user actions. */
export declare function writeResearchDocument(root: string, relative: string, document: ResearchDocument, expectedSha256: string | null): void;
//# sourceMappingURL=inputs.d.ts.map
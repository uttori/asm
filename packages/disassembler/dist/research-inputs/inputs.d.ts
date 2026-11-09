import type { AnalysisProjectShards } from "../model/project-types.js";
/** Only explicit human decisions belong in these files; captures and derived CFG do not. */
export declare const RESEARCH_COLLECTIONS: readonly ["labels", "comments", "annotations", "regions", "analysis", "evidence"];
/** One editable research shard kind that may appear in authoring documents. */
export type ResearchCollection = (typeof RESEARCH_COLLECTIONS)[number];
/** Native record shape stored in the selected research collection. */
export type ResearchRecord = AnalysisProjectShards[ResearchCollection][number];
/** Null suppresses an imported record. Removing the decision restores the imported observation. */
export interface ResearchDecision {
    /** Shard that owns the decision's stable record id. */
    readonly collection: ResearchCollection;
    /** Stable record id the decision overrides or suppresses. */
    readonly id: string;
    /** Replacement record, or null to suppress an imported observation. */
    readonly value: ResearchRecord | null;
}
/** A reviewable subject/bank document. Identity is tied to original ROM content, never relocation. */
export interface ResearchDocument {
    /** Authoring document discriminator. */
    readonly format: "uttori-research";
    /** Schema version for research JSON on disk. */
    readonly version: 1;
    /** Project slug the decisions belong to. */
    readonly project: string;
    /** Original ROM content hash the decisions are bound to. */
    readonly romSha256: string;
    /** Explicit human decisions authored in this file. */
    readonly decisions: readonly ResearchDecision[];
}
/** Optional resource ceilings for selected Git research inputs; omitted ceilings are unrestricted. */
export interface ResearchInputLimits {
    /** Maximum UTF-8 bytes per JSON document, including unsaved editor text. Positive safe integer. */
    readonly researchDocumentBytes?: number;
    /** Maximum combined UTF-8 bytes of selected JSON documents. Positive safe integer. */
    readonly researchBytes?: number;
    /** Maximum selected JSON documents; directories and other files do not count. Positive safe integer. */
    readonly researchFiles?: number;
}
/** Shared with project configuration so CLI, editor queries and unsaved buffers enforce the same policy. */
export declare const RESEARCH_INPUT_LIMIT_NAMES: readonly ["researchDocumentBytes", "researchBytes", "researchFiles"];
/** A validated, deterministic selection of Git inputs; the hash is independent of JSON whitespace. */
export interface ResearchSnapshot {
    /** Project slug shared by every selected authoring document. */
    readonly project: string;
    /** Original ROM content hash shared by every selected authoring document. */
    readonly romSha256: string;
    /** Canonical identity hash over project, ROM, and sorted decisions. */
    readonly hash: string;
    /** Selected authoring files with parsed documents and content hashes. */
    readonly files: readonly {
        /** Repository-relative path of one selected JSON authoring file. */
        readonly path: string;
        /** Content hash of the exact bytes read for that file. */
        readonly sha256: string;
        /** Parsed document whose decisions participate in the snapshot. */
        readonly document: ResearchDocument;
    }[];
    /** Flattened, deduplicated decisions sorted for stable hashing. */
    readonly decisions: readonly ResearchDecision[];
}
/** Recheck identities at the storage boundary, including snapshots supplied by JavaScript callers. */
export declare function validateResearchSnapshot(snapshot: ResearchSnapshot | null | undefined): void;
/** Reject unsupported record kinds before the generic project validator accesses their fields. */
export declare function validateResearchDecision(decision: unknown): asserts decision is ResearchDecision;
/** Parse a versioned authoring document; unknown top-level fields are rejected to catch misspellings. */
export declare function parseResearchDocument(value: unknown): ResearchDocument;
/**
 * Read selected Git research, preserving file locations for F2/navigation. Resource ceilings are opt-in;
 * document grouping and formatting must not impose an implicit limit on a project's research growth.
 */
export declare function readResearchInputs(root: string, roots: readonly string[], identity: {
    readonly project: string;
    readonly romSha256: string;
}, overlays?: ReadonlyMap<string, string>, limits?: ResearchInputLimits): ResearchSnapshot;
/** Save one document with optimistic content matching. Git commits remain explicit user actions. */
export declare function writeResearchDocument(root: string, relative: string, document: ResearchDocument, expectedSha256: string | null): void;
//# sourceMappingURL=inputs.d.ts.map
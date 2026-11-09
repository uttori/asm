import type { ProjectLabel } from "../model/project-types.js";
import type { ResearchMapping } from "../model/research-mapping.js";
import { type ResearchDocument, type ResearchSnapshot } from "./inputs.js";
/** Original address is stable through source relocation; ordinary spelling changes never replace the ID. */
export interface ResearchSymbolIdentity {
    /** Bank/mapper constraint of the original declaration; must match the stored mapping when supplied. */
    readonly mapping?: ResearchMapping;
    /** Stable research record ID retained across renames. */
    readonly id: string;
    /** Address space of the original declaration. */
    readonly addressSpace: string;
    /** Original address in addressSpace; a mismatch with the stored record rejects the rename. */
    readonly address: number;
    /** Source name shown in the snapshot the rename was requested from; kept as an alias. */
    readonly currentName: string;
    /** Evidence IDs copied into a newly created declaration; ignored when one already exists. */
    readonly evidence: readonly string[];
}
/** An editor combines this content-checked declaration change with its normal multi-file rename edit. */
export interface ResearchSymbolEdit {
    /** Source-relative research document path that receives the declaration. */
    readonly path: string;
    /** SHA-256 of the existing document, or null when the edit creates the file. */
    readonly expectedSha256: string | null;
    /** Complete replacement document with decisions sorted by collection and ID. */
    readonly document: ResearchDocument;
    /** Resulting label declaration stored in document. */
    readonly symbol: ProjectLabel;
}
/** Presentation choices and analysis seeding are independent; suppression never removes evidence. */
export type ResearchSymbolChange = {
    readonly kind: "aliases";
    readonly aliases: readonly string[];
} | {
    readonly kind: "suppression";
    readonly suppressed: boolean;
} | {
    readonly kind: "entry-point";
    readonly enabled: boolean;
};
/** Prepare an existing declaration edit while retaining its identity, evidence links and file. */
export declare function changeResearchSymbol(snapshot: ResearchSnapshot, id: string, change: ResearchSymbolChange): ResearchSymbolEdit;
/**
 * Prepare persistent rename intent without writing SQLite or committing source. Existing declarations
 * retain their location, provenance, comments, and seed policy. Newly named generated entries do not
 * become new static-analysis entry points merely because someone pressed F2.
 */
export declare function renameResearchSymbol(snapshot: ResearchSnapshot, identity: ResearchSymbolIdentity, newName: string, newDocumentPath: string, reservedNames?: Iterable<string>): ResearchSymbolEdit;
//# sourceMappingURL=symbols.d.ts.map
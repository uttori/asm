import type { ProjectLabel } from "../model/project-types.js";
import { type ResearchDocument, type ResearchSnapshot } from "./inputs.js";
/** Original address is stable through source relocation; ordinary spelling changes never replace the ID. */
export interface ResearchSymbolIdentity {
    readonly id: string;
    readonly addressSpace: string;
    readonly address: number;
    readonly currentName: string;
    readonly evidence: readonly string[];
}
/** An editor combines this content-checked declaration change with its normal multi-file rename edit. */
export interface ResearchSymbolEdit {
    readonly path: string;
    readonly expectedSha256: string | null;
    readonly document: ResearchDocument;
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
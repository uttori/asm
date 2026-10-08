/** A bank-qualified location in the original image. Omitted fields are unconstrained.
 * fileOffset is headerless and anchors the record's address/start, not a live source location.
 * State keys are target-defined mapper registers; unknown runtime values never match a constraint.
 */
export interface ResearchMapping {
    readonly fileOffset?: number;
    readonly state?: Readonly<Record<string, number | boolean>>;
}
/** Reject empty selectors and misspelled envelope fields instead of silently broadening a decision. */
export declare function isResearchMapping(value: unknown): value is ResearchMapping;
/** Match all supplied constraints. delta advances an interval's physical anchor with its CPU address. */
export declare function matchesResearchMapping(mapping: ResearchMapping | undefined, location: {
    readonly fileOffset?: number;
    readonly state?: Readonly<Record<string, unknown>>;
}, delta?: number): boolean;
//# sourceMappingURL=research-mapping.d.ts.map
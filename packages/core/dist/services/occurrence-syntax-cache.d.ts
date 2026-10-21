/**
 * Session-owned syntax keyed by grammar, physical occurrence, family and exact input text.
 * Only short scope keys are assembled; original text is a separate Map key, never a concatenated
 * grammar/file/source copy. Clear with the owning syntax snapshot; values must not contain bindings.
 */
export declare class OccurrenceSyntaxCache<T> {
    private readonly atoms;
    private readonly scopes;
    /** Intern grammar/file/family identities without hashing their contents into a lossy digest. */
    private atom;
    private scope;
    get(grammar: string, file: string, line: number, family: string, text: string): T | undefined;
    set(grammar: string, file: string, line: number, family: string, text: string, value: T): void;
    /** Release original text keys as well as values after successful or failed assembly disposal. */
    clear(): void;
}
//# sourceMappingURL=occurrence-syntax-cache.d.ts.map
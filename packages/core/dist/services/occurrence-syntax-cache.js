/**
 * Session-owned syntax keyed by grammar, physical occurrence, family and exact input text.
 * Only short scope keys are assembled; original text is a separate Map key, never a concatenated
 * grammar/file/source copy. Clear with the owning syntax snapshot; values must not contain bindings.
 */
export class OccurrenceSyntaxCache {
    atoms = new Map();
    scopes = new Map();
    /** Intern grammar/file/family identities without hashing their contents into a lossy digest. */
    atom(value) {
        let id = this.atoms.get(value);
        if (id === undefined) {
            id = this.atoms.size;
            this.atoms.set(value, id);
        }
        return id;
    }
    scope(grammar, file, line, family) {
        return `${this.atom(grammar)}:${this.atom(file)}:${line}:${this.atom(family)}`;
    }
    /** Looks up parsed syntax cached for one physical occurrence and exact source text. */
    get(grammar, file, line, family, text) {
        return this.scopes.get(this.scope(grammar, file, line, family))?.get(text);
    }
    /** Stores parsed syntax under the occurrence scope and original text key. */
    set(grammar, file, line, family, text, value) {
        const key = this.scope(grammar, file, line, family);
        let entries = this.scopes.get(key);
        if (!entries) {
            entries = new Map();
            this.scopes.set(key, entries);
        }
        entries.set(text, value);
    }
    /** Release original text keys as well as values after successful or failed assembly disposal. */
    clear() {
        this.scopes.clear();
        this.atoms.clear();
    }
}
//# sourceMappingURL=occurrence-syntax-cache.js.map
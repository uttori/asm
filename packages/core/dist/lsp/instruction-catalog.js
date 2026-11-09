/** Mutable target-neutral catalog registry for host and plugin tooling. */
export class InstructionCatalogRegistry {
    /** Canonical architecture name to frozen instruction descriptor list. */
    catalogs = new Map();
    /** Lowercase alias to canonical architecture name. */
    aliases = new Map();
    /**
     * Register a new instruction catalog for a given architecture.
     * @param architecture The architecture to register the catalog for.
     * @param catalog The instruction catalog to register.
     * @param aliases The aliases to register for the architecture.
     */
    register(architecture, catalog, aliases = []) {
        const canonical = architecture.toLowerCase();
        this.catalogs.set(canonical, catalog);
        this.aliases.set(canonical, canonical);
        for (const alias of aliases) {
            this.aliases.set(alias.toLowerCase(), canonical);
        }
    }
    /**
     * Get the instruction catalog for a given architecture.
     * @param architecture The architecture to get the catalog for.
     * @returns The instruction catalog.
     */
    getInstructionCatalog(architecture) {
        const canonical = this.aliases.get(architecture.toLowerCase());
        return canonical ? (this.catalogs.get(canonical) ?? []) : [];
    }
}
//# sourceMappingURL=instruction-catalog.js.map
/** Mutable target-neutral catalog registry for host and plugin tooling. */
export class InstructionCatalogRegistry {
    catalogs = new Map();
    aliases = new Map();
    /**
     * Register a new instruction catalog for a given architecture.
     * @param {string} architecture The architecture to register the catalog for.
     * @param {readonly InstructionDescriptor[]} catalog The instruction catalog to register.
     * @param {readonly string[]} aliases The aliases to register for the architecture.
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
     * @param {string} architecture The architecture to get the catalog for.
     * @returns {readonly InstructionDescriptor[]} The instruction catalog.
     */
    getInstructionCatalog(architecture) {
        const canonical = this.aliases.get(architecture.toLowerCase());
        return canonical ? (this.catalogs.get(canonical) ?? []) : [];
    }
}
//# sourceMappingURL=instruction-catalog.js.map
/** Case-insensitive registry of architecture definitions and their aliases. */
export class ArchitectureRegistry {
    /** Definitions keyed by lowercase canonical name. */
    definitions = new Map();
    /** Lowercase alias or canonical name to canonical name; every canonical name maps to itself. */
    aliases = new Map();
    /**
     * Registers the value.
     * @param definition The definition.
     * @param [aliases] The aliases.
     */
    register(definition, aliases = []) {
        const canonical = definition.name.toLowerCase();
        this.definitions.set(canonical, { ...definition, name: canonical });
        this.aliases.set(canonical, canonical);
        for (const alias of aliases) {
            this.aliases.set(alias.toLowerCase(), canonical);
        }
    }
    /**
     * Resolves an architecture name or alias, ignoring case.
     * @param name Architecture name or alias.
     * @returns The lowercase canonical name, or undefined when unregistered.
     */
    getCanonicalName(name) {
        return this.aliases.get(name.toLowerCase());
    }
    /**
     * Looks up a definition by name or alias, ignoring case.
     * @param name Architecture name or alias.
     * @returns The registered definition, or undefined when unregistered.
     */
    getDefinition(name) {
        const canonical = this.getCanonicalName(name);
        if (!canonical) {
            return undefined;
        }
        return this.definitions.get(canonical);
    }
    /**
     * Returns editor metadata from the same registered encoder used for builds.
     * @param name Architecture name or alias.
     * @returns Registered instruction descriptors.
     */
    getInstructionCatalog(name) {
        const definition = this.getDefinition(name);
        return [...(definition?.instructions ?? definition?.encoder.getInstructionCatalog?.() ?? [])];
    }
}
//# sourceMappingURL=architecture-registry.js.map
export class ArchitectureRegistry {
    definitions = new Map();
    aliases = new Map();
    /**
     * Registers the value.
     * @param {ArchitectureDefinition} definition The definition.
     * @param {string[]} [aliases] The aliases.
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
     * Gets canonical name.
     * @param {string} name The name.
     * @returns {string | undefined} The result.
     */
    getCanonicalName(name) {
        return this.aliases.get(name.toLowerCase());
    }
    /**
     * Gets definition.
     * @param {string} name The name.
     * @returns {ArchitectureDefinition | undefined} The result.
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
     * @param {string} name Architecture name or alias.
     * @returns {InstructionDescriptor[]} Registered instruction descriptors.
     */
    getInstructionCatalog(name) {
        const definition = this.getDefinition(name);
        return [...(definition?.instructions ?? definition?.encoder.getInstructionCatalog?.() ?? [])];
    }
}
//# sourceMappingURL=architecture-registry.js.map
import type { InstructionDescriptor } from "../architecture-types.js";
export interface InstructionCatalogProvider {
    getInstructionCatalog(architecture: string): readonly InstructionDescriptor[];
}
/** Mutable target-neutral catalog registry for host and plugin tooling. */
export declare class InstructionCatalogRegistry implements InstructionCatalogProvider {
    readonly catalogs: Map<string, readonly InstructionDescriptor[]>;
    readonly aliases: Map<string, string>;
    /**
     * Register a new instruction catalog for a given architecture.
     * @param {string} architecture The architecture to register the catalog for.
     * @param {readonly InstructionDescriptor[]} catalog The instruction catalog to register.
     * @param {readonly string[]} aliases The aliases to register for the architecture.
     */
    register(architecture: string, catalog: readonly InstructionDescriptor[], aliases?: readonly string[]): void;
    /**
     * Get the instruction catalog for a given architecture.
     * @param {string} architecture The architecture to get the catalog for.
     * @returns {readonly InstructionDescriptor[]} The instruction catalog.
     */
    getInstructionCatalog(architecture: string): readonly InstructionDescriptor[];
}
//# sourceMappingURL=instruction-catalog.d.ts.map
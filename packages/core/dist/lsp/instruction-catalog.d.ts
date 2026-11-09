import type { InstructionDescriptor } from "../architecture-types.js";
/** Supplies architecture-specific instruction metadata to tooling. */
export interface InstructionCatalogProvider {
    /** Returns the instruction list registered for an architecture name or alias. */
    getInstructionCatalog(architecture: string): readonly InstructionDescriptor[];
}
/** Mutable target-neutral catalog registry for host and plugin tooling. */
export declare class InstructionCatalogRegistry implements InstructionCatalogProvider {
    /** Canonical architecture name to frozen instruction descriptor list. */
    readonly catalogs: Map<string, readonly InstructionDescriptor[]>;
    /** Lowercase alias to canonical architecture name. */
    readonly aliases: Map<string, string>;
    /**
     * Register a new instruction catalog for a given architecture.
     * @param architecture The architecture to register the catalog for.
     * @param catalog The instruction catalog to register.
     * @param aliases The aliases to register for the architecture.
     */
    register(architecture: string, catalog: readonly InstructionDescriptor[], aliases?: readonly string[]): void;
    /**
     * Get the instruction catalog for a given architecture.
     * @param architecture The architecture to get the catalog for.
     * @returns The instruction catalog.
     */
    getInstructionCatalog(architecture: string): readonly InstructionDescriptor[];
}
//# sourceMappingURL=instruction-catalog.d.ts.map
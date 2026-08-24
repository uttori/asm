import type { InstructionDescriptor } from "../architecture-types.js";
export interface InstructionCatalogProvider {
    getInstructionCatalog(architecture: string): readonly InstructionDescriptor[];
}
/** Mutable target-neutral catalog registry for host and plugin tooling. */
export declare class InstructionCatalogRegistry implements InstructionCatalogProvider {
    readonly catalogs: Map<string, readonly InstructionDescriptor[]>;
    readonly aliases: Map<string, string>;
    register(architecture: string, catalog: readonly InstructionDescriptor[], aliases?: readonly string[]): void;
    getInstructionCatalog(architecture: string): readonly InstructionDescriptor[];
}
export declare function getCatalogForArchitecture(architecture: string, provider?: InstructionCatalogProvider): InstructionDescriptor[];
//# sourceMappingURL=instruction-catalog.d.ts.map
import type { InstructionDescriptor } from "../architecture-types.js";

/** Supplies architecture-specific instruction metadata to tooling. */
export interface InstructionCatalogProvider {
  /** Returns the instruction list registered for an architecture name or alias. */
  getInstructionCatalog(architecture: string): readonly InstructionDescriptor[];
}

/** Mutable target-neutral catalog registry for host and plugin tooling. */
export class InstructionCatalogRegistry implements InstructionCatalogProvider {
  /** Canonical architecture name to frozen instruction descriptor list. */
  readonly catalogs = new Map<string, readonly InstructionDescriptor[]>();
  /** Lowercase alias to canonical architecture name. */
  readonly aliases = new Map<string, string>();

  /**
   * Register a new instruction catalog for a given architecture.
   * @param architecture The architecture to register the catalog for.
   * @param catalog The instruction catalog to register.
   * @param aliases The aliases to register for the architecture.
   */
  register(
    architecture: string,
    catalog: readonly InstructionDescriptor[],
    aliases: readonly string[] = [],
  ): void {
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
  getInstructionCatalog(architecture: string): readonly InstructionDescriptor[] {
    const canonical = this.aliases.get(architecture.toLowerCase());
    return canonical ? (this.catalogs.get(canonical) ?? []) : [];
  }
}

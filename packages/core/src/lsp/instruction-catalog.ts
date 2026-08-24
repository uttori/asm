import type { InstructionDescriptor } from "../architecture-types.js";

export interface InstructionCatalogProvider {
  getInstructionCatalog(architecture: string): readonly InstructionDescriptor[];
}

/** Mutable target-neutral catalog registry for host and plugin tooling. */
export class InstructionCatalogRegistry implements InstructionCatalogProvider {
  readonly catalogs = new Map<string, readonly InstructionDescriptor[]>();
  readonly aliases = new Map<string, string>();

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

  getInstructionCatalog(architecture: string): readonly InstructionDescriptor[] {
    const canonical = this.aliases.get(architecture.toLowerCase());
    return canonical ? (this.catalogs.get(canonical) ?? []) : [];
  }
}

const emptyCatalogs = new InstructionCatalogRegistry();

export function getCatalogForArchitecture(
  architecture: string,
  provider: InstructionCatalogProvider = emptyCatalogs,
): InstructionDescriptor[] {
  return [...provider.getInstructionCatalog(architecture)];
}

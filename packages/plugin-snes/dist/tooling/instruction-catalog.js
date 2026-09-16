import { buildCpu65816Catalog } from "../architectures/65816-spec.js";
import { buildSpc700Catalog } from "../architectures/spc700-spec.js";
import { buildSuperFxCatalog } from "../architectures/superfx-spec.js";
/** The 65816 editor catalog is generated from the authoritative opcode table. */
export const cpu65816Catalog = buildCpu65816Catalog();
/** The SPC700 editor catalog is generated from the authoritative opcode table. */
export const spc700Catalog = buildSpc700Catalog();
/** The SuperFX editor catalog is generated from the four-state opcode matrix. */
export const superFxCatalog = buildSuperFxCatalog();
//# sourceMappingURL=instruction-catalog.js.map
/** Browser entry point for assembly and mapping without Node-only analysis modules. */
export { default } from "./assembler.js";
export {
  SNES_TARGET_ID,
  type SnesTargetOptions,
  createSnesAssemblerEnvironment,
} from "./assembler.js";
export {
  type AddressSpaceContext,
  type SnesRomAddressSpace,
  snesRomAddressSpace,
} from "./target/address-space.js";
export { cpu65816Catalog, spc700Catalog, superFxCatalog } from "./tooling/instruction-catalog.js";

/** Supported assembly and embedding entry point; specialized host contracts have explicit subpaths. */
/** Public Node entry point: assembly plus ROM analysis and source export. */
export { default } from "./assembler.js";
export { SNES_TARGET_ID, type SnesTargetOptions, createSnesAssemblerEnvironment, } from "./assembler.js";
export { Arch65816 } from "./architectures/65816.js";
export { type Cpu65816FlagState, type Cpu65816DecodeState, Cpu65816Decoder, formatCpu65816Instruction, } from "./architectures/65816-decoder.js";
export { type Cpu65816WidthFlag, type Cpu65816ModeDefinition, type Cpu65816InstructionSpecification, cpu65816Modes, conditionalBranches, cpu65816Specifications, buildCpu65816Catalog, } from "./architectures/65816-spec.js";
export { ArchSPC700 } from "./architectures/spc700.js";
export { type Spc700DecodeState, Spc700Decoder, formatSpc700Instruction, } from "./architectures/spc700-decoder.js";
export { type Spc700ModeDefinition, type Spc700InstructionSpecification, spc700Modes, spc700ConditionalBranches, spc700Specifications, buildSpc700Catalog, } from "./architectures/spc700-spec.js";
export { ArchSuperFX } from "./architectures/superfx.js";
export { type SuperFxDecodeState, SuperFxDecoder, formatSuperFxInstruction, } from "./architectures/superfx-decoder.js";
export { type SuperFxAltState, isSuperFxAltState, type SuperFxOperandEncoding, type SuperFxInstructionSpecification, type SuperFxFusedInstructionSpecification, superFxOpcodeMatrix, superFxBaseSpecifications, superFxSpecifications, superFxFusedSpecifications, buildSuperFxCatalog, } from "./architectures/superfx-spec.js";
export { cpu65816Catalog, spc700Catalog, superFxCatalog } from "./tooling/instruction-catalog.js";
//# sourceMappingURL=index.d.ts.map
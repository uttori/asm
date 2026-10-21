/** frontend contracts. Node host operations own filesystem resources and must honor documented disposal/publication rules. */
export type { PushPcStackEntry } from "./services/directive-runtime-service.js";
export type { MacroDefinition } from "./services/macro-engine.js";
export type { StructDefinition, StructField } from "./services/struct-engine.js";
export { getStructMetadata, type StructMetadataProperty } from "./services/struct-metadata.js";
export type { LabelEntry } from "./services/symbol-scope-service.js";
export { type AssemblyFrontEndHost, AssemblyFrontEndService, } from "./services/assembly-front-end-service.js";
export { isOpenStructInitializer } from "./services/struct-initializer.js";
export { removeInlineComment, preprocessBlockCommands } from "./services/command-text-service.js";
export { type LoweredCommand, type LoweredOperation, type LoweredDeclaration, type LoweredSourceTemplate, type LoweredBareInvocation, type LoweredLoopNode, type LoweredConditionalBranch, type LoweredConditionalNode, type LoweredExecutableNode, type LoweredProgram, type CommandLoweringHost, CommandLoweringService, } from "./services/command-lowering-service.js";
export { ProgramModelBuilder } from "./services/program-model-builder.js";
export type { IncrementalProgramParseState, IncludeProgramNode, ProgramModel, } from "./services/program-model-builder.js";
//# sourceMappingURL=frontend.d.ts.map
/**
 * Portable assembly entry point. Hosts must supply an in-memory file provider;
 * filesystem-backed defaults are available from the regular Node entry point.
 */
export { Assembler, type AssemblerOptions } from "./assembler.js";
export * from "./relocatable.js";
export { addressedSourceLinkRecipe } from "./services/source-link-recipe.js";
export * from "./ir/link-expression.js";
export { RelocatableInstruction } from "./ir/relocatable-instruction.js";
export { MemoryAssemblyFileProvider, type AssemblyFileProvider, type AssemblyFileResolutionOptions, } from "./file-provider.js";
export { definePlugin, PluginManager, PluginError, PLUGIN_API_VERSION } from "./plugin/index.js";
export { NATIVE_SYNTAX_PROFILE, CA65_SYNTAX_PROFILE, ASAR_SYNTAX_PROFILE, } from "./syntax-profile.js";
export { parseExpressionNode, isReferenceExpressionNode } from "./ir/expression-node.js";
export { type AssetResourceSnapshotHost, assetSourceMediaType, resolveAssetResourceSnapshot, } from "./services/asset-resource-snapshot.js";
export { InstructionResolutionFrame } from "./ir/resolved-instruction.js";
export { runTypedEncoderEntry } from "./typed-encoder-entry.js";
export { parseInstructionOperands, bindInstructionOperands } from "./ir/parsed-operand.js";
export type { ParsedOperand, ParsedInstructionOperands, OperandGrammarOptions, OperandScalar, OperandWidthIntent, OperandRegister, } from "./ir/parsed-operand.js";
export type { SyntaxProfile, SyntaxRewriteContext } from "./syntax-profile.js";
export type { DirectiveDescriptor } from "./lsp/directive-catalog.js";
export type { InstructionDescriptor, ArchitectureEncoder, ArchitectureEncoderContext, OperandResolutionContext, } from "./architecture-types.js";
export type { ArchitectureDecodeContext, ArchitectureDecodeResult, ArchitectureDecoder, ArchitectureInstructionSpecification, DecodedInstruction, DecodedOperand, DecodedReference, InstructionFlow, } from "./decoder-types.js";
export type { AssemblerPlugin, AssemblerEnvironment, PluginActivationContext, PluginSessionCapabilities, SessionStateKey, AssemblyStageName, } from "./plugin/index.js";
export { LinkError, type LinkTargetPolicy } from "./linker/types.js";
//# sourceMappingURL=browser.d.ts.map
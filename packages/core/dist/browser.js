/**
 * Portable assembly entry point. Hosts must supply an in-memory file provider;
 * filesystem-backed defaults are available from the regular Node entry point.
 */
export { Assembler } from "./assembler.js";
export * from "./relocatable.js";
export { addressedSourceLinkRecipe } from "./services/source-link-recipe.js";
export * from "./ir/link-expression.js";
export { RelocatableInstruction } from "./ir/relocatable-instruction.js";
export { MemoryAssemblyFileProvider, } from "./file-provider.js";
export { definePlugin, PluginManager, PluginError, PLUGIN_API_VERSION } from "./plugin/index.js";
export { NATIVE_SYNTAX_PROFILE, CA65_SYNTAX_PROFILE, ASAR_SYNTAX_PROFILE, } from "./syntax-profile.js";
// Target grammars and stage frames use the same portable exports in browser bundles.
export { parseExpressionNode, isReferenceExpressionNode } from "./ir/expression-node.js";
export { assetSourceMediaType, resolveAssetResourceSnapshot, } from "./services/asset-resource-snapshot.js";
export { InstructionResolutionFrame } from "./ir/resolved-instruction.js";
export { runTypedEncoderEntry } from "./typed-encoder-entry.js";
export { parseInstructionOperands, bindInstructionOperands } from "./ir/parsed-operand.js";
export { LinkError } from "./linker/types.js";
//# sourceMappingURL=browser.js.map
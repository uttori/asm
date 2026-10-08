/**
 * Portable assembly entry point. Hosts must supply an in-memory file provider;
 * filesystem-backed defaults are available from the regular Node entry point.
 */
export { Assembler, type AssemblerOptions } from "./assembler.js";
export {
  MemoryAssemblyFileProvider,
  type AssemblyFileProvider,
  type AssemblyFileResolutionOptions,
} from "./file-provider.js";
export { definePlugin, PluginManager, PluginError, PLUGIN_API_VERSION } from "./plugin/index.js";
export {
  NATIVE_SYNTAX_PROFILE,
  CA65_SYNTAX_PROFILE,
  ASAR_SYNTAX_PROFILE,
} from "./syntax-profile.js";
export { parseOperandSyntax } from "./operand-syntax.js";
// Target encoders parse operand expressions at runtime, including in browser bundles.
export { parseExpressionNode } from "./ir/expression-node.js";
export * from "./services/asset-resource-snapshot.js";
export { createEncoderRuntime } from "./architecture-types.js";
export type { SyntaxProfile, SyntaxRewriteContext } from "./syntax-profile.js";
export type { DirectiveDescriptor } from "./lsp/directive-catalog.js";
export type { InstructionDescriptor } from "./architecture-types.js";
// Type-only exports keep plugin contracts available without loading Node hosts.
export type * from "./index.js";

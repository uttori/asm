export {
  PLUGIN_API_VERSION,
  type AssemblyStageName,
  type AssemblerPluginManifest,
  type PluginDisposable,
  type AssemblerPlugin,
  definePlugin,
  type PluginLogger,
  type SessionStateKey,
  type SessionCreationContext,
  type SessionStateContribution,
  type SessionStateStore,
  type ArchitectureContribution,
  type ArchitectureFactoryContext,
  type ArchitectureDecoderFactoryContext,
  type TargetFactoryContext,
  type AddressSpaceContribution,
  type TargetAddressSpace,
  type OutputFinalizationContext,
  type OutputReadContext,
  type OutputFormatContribution,
  type TargetOutputFormat,
  type DirectiveExecutionContext,
  type DirectiveFactoryContext,
  type DirectiveContribution,
  type DirectiveSetContribution,
  type AssetSource,
  type AssetFormatResult,
  type AssetSourceRepresentation,
  type AssetResourceDependency,
  type AssetFormatContribution,
  type AssetTransformOptionField,
  type AssetTransformContribution,
  type ExpressionFunctionSignature,
  type ExpressionFunctionContext,
  type ExpressionFunctionContribution,
  type ExpressionSetContribution,
  type SessionLifecycleContext,
  type StageLifecycleContext,
  type DirectiveMiddlewareContext,
  type ArchitectureSelectionContext,
  type EndifResolutionContext,
  type WriteValidationContext,
  type LifecycleOutputFinalizationContext,
  type SessionLifecycle,
  type LifecycleContribution,
  type TargetContribution,
  type PluginActivationContext,
  type ExpressionFunctionDescriptor,
  type ArchitectureSummary,
  type TargetSummary,
  type ToolingCatalog,
} from "./contracts.js";
export {
  type PluginDiagnosticCode,
  type PluginDiagnosticContext,
  PluginError,
} from "./diagnostics.js";
export {
  type OwnedContribution,
  type EnvironmentContributions,
  AssemblerEnvironment,
} from "./environment.js";
export {
  type PluginActivationRequest,
  type PluginModuleActivationRequest,
  type PluginManagerOptions,
  PluginManager,
} from "./manager.js";
export { type PluginStateSnapshot, PluginSessionStateStore } from "./session-state.js";

export type { PluginSessionCapabilities } from "./session-capabilities.js";

export type { DirectiveSyntaxContribution, BoundDirectiveSyntax } from "./contracts.js";
export type {
  SyntaxGrammar,
  SyntaxValue,
  SyntaxParseInput,
  SourceSyntax,
  ContributionSyntax,
  DeclarationSyntax,
  DataItemSyntax,
  TemplateSegmentSyntax,
  SyntaxToken,
} from "../ir/source-syntax.js";
export { copySyntaxValue } from "../ir/source-syntax.js";
export {
  syntaxCodec,
  syntaxArray,
  syntaxBoolean,
  syntaxExpression,
  syntaxLiteral,
  syntaxNumber,
  syntaxOptional,
  syntaxRecord,
  syntaxString,
  syntaxUnion,
  type SyntaxGuard,
} from "../ir/syntax-codec.js";
export { parseDirectiveExpression, unquoteDirectiveText } from "../ir/directive-arguments.js";
export { parseDataList, type DataOperand } from "../ir/data-node.js";

export * from "../ir/resolved-instruction.js";
export { parseInstructionOperands, bindInstructionOperands } from "../ir/parsed-operand.js";
export type {
  ParsedOperand,
  ParsedInstructionOperands,
  OperandGrammarOptions,
  OperandScalar,
  OperandWidthIntent,
  OperandRegister,
} from "../ir/parsed-operand.js";

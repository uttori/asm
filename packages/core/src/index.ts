/** Supported assembly and embedding entry point; specialized host contracts have explicit subpaths. */
/**
 * Host assembly/tooling entry point. Plugin author contracts live at ./plugin. ./debug-map
 * also has a dedicated entry point. Exported front-end, lowering, and IR services are advanced
 * embedding APIs and retain their session/stage invariants.
 */
export { Assembler, type AssemblerOptions, type ProgramAnalysisOptions } from "./assembler.js";
export * from "./relocatable.js";
export { addressedSourceLinkRecipe } from "./services/source-link-recipe.js";
export * from "./ir/link-expression.js";
export { RelocatableInstruction } from "./ir/relocatable-instruction.js";
export type { AssemblyStageName } from "./plugin/contracts.js";

export {
  type MathValue,
  type OperandResolutionContext,
  type EncoderEmissionContext,
  type EncoderSizingContext,
  type EncoderBranchContext,
  type EncoderDiagnosticContext,
  type ArchitectureEncoderContext,
  type ExpressionHost,
  type InstructionAddressingMode,
  type InstructionDescriptor,
  type ArchitectureEncoder,
} from "./architecture-types.js";
export {
  type DecoderByteSource,
  Uint8ArrayDecoderSource,
  type ArchitectureInstructionSpecification,
  type DecodedOperandKind,
  type DecodedOperand,
  type DecodedReferenceKind,
  type DecodedReference,
  type InstructionFlowKind,
  type InstructionFlow,
  type InstructionStateEffect,
  type DecodedInstruction,
  type ArchitectureDecodeContext,
  type ArchitectureDecodeErrorCode,
  type ArchitectureDecodeInstructionResult,
  type ArchitectureDecodeAmbiguousResult,
  type ArchitectureDecodeErrorResult,
  type ArchitectureDecodeResult,
  type ArchitectureDecoder,
} from "./decoder-types.js";
export { type ArchitectureDefinition, ArchitectureRegistry } from "./architecture-registry.js";
export {
  maximumAddressForWidth,
  normalizeAddressForWidth,
  formatAddressForWidth,
} from "./address-width.js";
export { CRC32 } from "./crc32.js";
export {
  type AddrToLineInfo,
  type AddressToLineFileEntry,
  type AddressToLineRange,
  type ResolvedInstructionOperand,
  type InstructionSourceInfo,
  type AssetEmissionInfo,
  type AssetEmissionConversion,
  type StructFieldEmissionInfo,
  type SerializableAddressRange,
  AddressToLineMapping,
} from "./addressToLine.js";
export {
  DEBUG_MAP_FORMAT,
  DEBUG_MAP_SCHEMA_VERSION,
  type DebugMapSource,
  type DebugMapRange,
  type DebugMapInstruction,
  type DebugMapAsset,
  type DebugMap,
  type CreateDebugMapOptions,
  createDebugMap,
  validateDebugMap,
  debugMapRangesForAddress,
  debugMapRangesForSource,
} from "./debug-map.js";
export {
  canonicalValue,
  canonicalJsonCompact,
  canonicalEquals,
  canonicalJson,
} from "./canonical-json.js";
export {
  type SyntaxRewriteContext,
  type SyntaxProfile,
  ASAR_SYNTAX_PROFILE,
  NATIVE_SYNTAX_PROFILE,
  CA65_SYNTAX_PROFILE,
} from "./syntax-profile.js";
export {
  type AssemblyDiagnosticSeverity,
  type AssemblySymbolKind,
  type AssemblySourceLocation,
  type AssemblyDiagnostic,
  type AssemblySymbolDefinition,
  type AssemblySymbolReferenceKind,
  type AssemblySymbolReference,
  type AssemblyIncludeEdge,
  type AssemblyAnalysisResult,
  AssemblyError,
  createAssemblySourceLocation,
  diagnosticFromError,
} from "./diagnostics.js";
export { CORE_DIRECTIVE_GROUPS, type CoreDirectiveGroup } from "./directive-groups.js";
export {
  type SourceSpan,
  type SourcePosition,
  type SourceRange,
  createSourceSpan,
  createLineSpan,
  createTextSpan,
  sourceLineStarts,
  shiftSourceSpan,
  deriveTokenSpans,
  sourceSpanToRange,
} from "./source-location.js";
export {
  type TypedSourcePatch,
  type TypedSourceEdit,
  planTypedSourceEdits,
} from "./source-field-edits.js";
export {
  type AssemblyFileResolutionOptions,
  type AssemblyFileStat,
  type AssemblyFileProvider,
  NodeAssemblyFileProvider,
  type NodeAssemblySnapshotOptions,
  NodeAssemblySnapshotProvider,
  type MemoryAssemblyFileProviderOptions,
  MemoryAssemblyFileProvider,
  stripWrappingQuotes,
} from "./file-provider.js";
export {
  type LoopNode,
  type ConditionalBranch,
  type ConditionalBranchNode,
  type ExecutableNode,
} from "./ir/assembly-tree.js";
export {
  type ExpressionNode,
  type IdentifierExpressionNode,
  type LiteralExpressionNode,
  type StringExpressionNode,
  type DefineReferenceExpressionNode,
  type ReferenceExpressionNode,
  type MemberExpressionNode,
  type IndexExpressionNode,
  type CallExpressionNode,
  type UnaryOperator,
  type UnaryExpressionNode,
  type BinaryOperator,
  type BinaryExpressionNode,
  type RangeExpressionNode,
  type RawExpressionNode,
  parseExpressionNode,
  renderExpressionNode,
  isReferenceExpressionNode,
  renderReferenceExpressionNode,
  parseLeadingReferenceExpression,
  type ExpressionSource,
} from "./ir/expression-node.js";
export {
  type CommandKind,
  type CommandProvenance,
  type NormalizedCommand,
  createCommandProvenance,
  type ParsedCondition,
  type ParsedAssignment,
  type ParsedForLoop,
  type ParsedIncbinRange,
  type ParsedMacroInvocation,
  type ParsedIncludeTarget,
  type ParsedLabelSplit,
  type ParsedDataDirective,
  type ParsedDirectiveArgs,
  type ParsedOpcodeOperands,
  type CommandSemantics,
  createNormalizedCommand,
  cloneNormalizedCommand,
  setCommandWords,
  setCommandKind,
} from "./ir/normalized-command.js";
export { type AssetValueNode, type ParsedAssetCall, parseAssetCall } from "./ir/asset-call.js";

export {
  type AssetResourceSnapshotHost,
  assetSourceMediaType,
  resolveAssetResourceSnapshot,
} from "./services/asset-resource-snapshot.js";

export * as pluginApi from "./plugin/index.js";
export {
  AssemblerEnvironment,
  definePlugin,
  PluginError,
  PluginManager,
  PLUGIN_API_VERSION,
} from "./plugin/index.js";

export {
  sourceOriginLocations,
  sourceOccurrenceRange,
  type SourceOccurrence,
  type SourceOrigin,
  type MacroArgumentOrigin,
} from "./source-provenance.js";

export * from "./ir/resolved-instruction.js";
export { runTypedEncoderEntry } from "./typed-encoder-entry.js";
export { parseInstructionOperands, bindInstructionOperands } from "./ir/parsed-operand.js";
export type {
  ParsedOperand,
  ParsedInstructionOperands,
  OperandGrammarOptions,
  OperandScalar,
  OperandWidthIntent,
  OperandRegister,
} from "./ir/parsed-operand.js";

export { LinkError, type LinkTargetPolicy } from "./linker/types.js";

/** Supported assembly and embedding entry point; specialized host contracts have explicit subpaths. */
/**
 * Host assembly/tooling entry point. Plugin author contracts live at ./plugin. ./debug-map
 * also has a dedicated entry point. Exported front-end, lowering, and IR services are advanced
 * embedding APIs and retain their session/stage invariants.
 */
export { Assembler } from "./assembler.js";
export { Uint8ArrayDecoderSource, } from "./decoder-types.js";
export { ArchitectureRegistry } from "./architecture-registry.js";
export { maximumAddressForWidth, normalizeAddressForWidth, formatAddressForWidth, } from "./address-width.js";
export { CRC32 } from "./crc32.js";
export { AddressToLineMapping, } from "./addressToLine.js";
export { DEBUG_MAP_FORMAT, DEBUG_MAP_SCHEMA_VERSION, createDebugMap, validateDebugMap, debugMapRangesForAddress, debugMapRangesForSource, } from "./debug-map.js";
export { canonicalValue, canonicalJsonCompact, canonicalEquals, canonicalJson, } from "./canonical-json.js";
export { ASAR_SYNTAX_PROFILE, NATIVE_SYNTAX_PROFILE, CA65_SYNTAX_PROFILE, } from "./syntax-profile.js";
export { AssemblyError, createAssemblySourceLocation, diagnosticFromError, } from "./diagnostics.js";
export { CORE_DIRECTIVE_GROUPS } from "./directive-groups.js";
export { createSourceSpan, createLineSpan, createTextSpan, sourceLineStarts, shiftSourceSpan, deriveTokenSpans, sourceSpanToRange, } from "./source-location.js";
export { planTypedSourceEdits, } from "./source-field-edits.js";
export { NodeAssemblyFileProvider, NodeAssemblySnapshotProvider, MemoryAssemblyFileProvider, stripWrappingQuotes, } from "./file-provider.js";
export { parseExpressionNode, renderExpressionNode, isReferenceExpressionNode, renderReferenceExpressionNode, parseLeadingReferenceExpression, } from "./ir/expression-node.js";
export { createCommandProvenance, createNormalizedCommand, cloneNormalizedCommand, setCommandWords, setCommandKind, } from "./ir/normalized-command.js";
export { parseAssetCall } from "./ir/asset-call.js";
export { assetSourceMediaType, resolveAssetResourceSnapshot, } from "./services/asset-resource-snapshot.js";
export * as pluginApi from "./plugin/index.js";
export { AssemblerEnvironment, definePlugin, PluginError, PluginManager, PLUGIN_API_VERSION, } from "./plugin/index.js";
export { sourceOriginLocations, sourceOccurrenceRange, } from "./source-provenance.js";
export * from "./ir/resolved-instruction.js";
export { runTypedEncoderEntry } from "./typed-encoder-entry.js";
export { parseInstructionOperands, bindInstructionOperands } from "./ir/parsed-operand.js";
//# sourceMappingURL=index.js.map
/**
 * Re-exports the snes-asm-js core analysis surface used by the language server.
 * Centralizing the cross-package import keeps every server module pointing at a
 * single relative path that the bundler and type-checker both resolve. These are
 * internal analysis types, not LSP wire types; `providers.ts` adapts them to the
 * protocol structures linked below.
 * @see https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/#language-server-protocol
 */
export { Assembler } from "../../src/assembler.js";
export {
  WorkspaceIndex,
  OverlayFileProvider,
  findInstruction,
  findDirectiveEntry,
  buildCompletionEntries,
  renderInstructionDocs,
  renderDirectiveDocs,
  getInstructionCatalog,
  findDirective,
  positionInRange,
  locationRange,
  referenceAt,
  symbolAt,
  resolveDefinition,
  findReferences,
} from "../../src/lsp/index.js";

export type {
  WorkspaceIndexOptions,
  FileAnalysis,
  CatalogEntry,
  DirectiveDescriptor,
} from "../../src/lsp/index.js";

/**
 * Internal diagnostics and symbols adapted to LSP `Diagnostic`,
 * `DocumentSymbol`, `SymbolInformation`, and `Location` values by providers.
 * @see https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/#diagnostic
 * @see https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/#document-symbols-request-leftwards_arrow_with_hook
 * @see https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/#location
 */
export type {
  AssemblyDiagnostic,
  AssemblyDiagnosticSeverity,
  AssemblyIncludeEdge,
  AssemblySymbolDefinition,
  AssemblySymbolKind,
  AssemblySymbolReference,
  AssemblySymbolReferenceKind,
} from "../../src/diagnostics.js";

/**
 * Internal source geometry adapted to LSP `Position` and `Range` values.
 * @see https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/#position
 * @see https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/#range
 */
export type {
  SourcePosition,
  SourceRange,
} from "../../src/source-location.js";

export type { InstructionDescriptor } from "../../src/architecture-types.js";

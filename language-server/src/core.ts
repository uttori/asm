/**
 * Re-exports the snes-asm-js core analysis surface used by the language server.
 * Centralizing the cross-package import keeps every server module pointing at a
 * single relative path that the bundler and type-checker both resolve.
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

export type {
  AssemblyDiagnostic,
  AssemblyDiagnosticSeverity,
  AssemblyIncludeEdge,
  AssemblySymbolDefinition,
  AssemblySymbolKind,
  AssemblySymbolReference,
  AssemblySymbolReferenceKind,
} from "../../src/diagnostics.js";

export type {
  SourcePosition,
  SourceRange,
} from "../../src/source-location.js";

export type { InstructionDescriptor } from "../../src/architecture-types.js";

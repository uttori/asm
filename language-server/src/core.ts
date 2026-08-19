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

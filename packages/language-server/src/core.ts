/**
 * Re-exports the target-neutral analysis surface used by the language server.
 * Implementations and their contracts live in asm-core; transport and LSP payload conversion
 * belong in this package. Keeping this bridge free of target setup allows plugin-provided tooling.
 */
export {
  Assembler,
  WorkspaceIndex,
  OverlayFileProvider,
  findInstruction,
  findDirectiveInCatalog,
  findDirectiveOperand,
  buildCompletionEntries,
  renderInstructionDocs,
  renderDirectiveDocs,
  renderExpressionFunctionDocs,
  getInstructionCatalog,
  positionInRange,
  locationRange,
  referenceAt,
  symbolAt,
  resolveDefinition,
  findReferences,
} from "@uttori/asm-core";

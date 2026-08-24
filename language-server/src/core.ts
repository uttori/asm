/** Re-exports the analysis surface and explicitly activates the SNES plugin. */
export {
  Assembler,
  WorkspaceIndex,
  OverlayFileProvider,
  findInstruction,
  findDirectiveEntry,
  findDirectiveInCatalog,
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
export { createSnesAssemblerHost } from "@uttori/asm-plugin-snes";

import { createSnesAssemblerHost } from "@uttori/asm-plugin-snes";

export const snesAssemblerHost = await createSnesAssemblerHost();

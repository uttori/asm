import {
  savedAssetSourceHost,
  type AssetSourceHost,
} from "@uttori/asm-workflows/asset-interchange";
import {
  createSourceWorkflowHost,
  executeSourceOperation as execute,
  inspectSourceProject as inspect,
  type SourceOperation,
} from "@uttori/asm-workflows/source";

import somPlugin from "./assembly.js";
/** Bundled hosts provide the private plugin without relying on a project-local installation. */
export const somSourceHost = createSourceWorkflowHost([
  ["@uttori/asm-game-secret-of-mana", somPlugin],
]);
/** Run a source operation against the bundled SoM plugin host. */
export const executeSourceOperation = (operation: SourceOperation) =>
  execute(operation, somSourceHost);
/** Asset host that inspects SoM Git source projects through the bundled plugin. */
export const somAssetSourceHost: AssetSourceHost = {
  ...savedAssetSourceHost,
  inspect: (directory, overlays, signal) => inspect(directory, overlays, signal, somSourceHost),
};

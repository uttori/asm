import { savedAssetSourceHost, } from "@uttori/asm-workflows/asset-interchange";
import { createSourceWorkflowHost, executeSourceOperation as execute, inspectSourceProject as inspect, } from "@uttori/asm-workflows/source";
import somPlugin from "./assembly.js";
/** Bundled hosts provide the private plugin without relying on a project-local installation. */
export const somSourceHost = createSourceWorkflowHost([
    ["@uttori/asm-game-secret-of-mana", somPlugin],
]);
/** Run a source operation against the bundled SoM plugin host. */
export const executeSourceOperation = (operation) => execute(operation, somSourceHost);
/** Asset host that inspects SoM Git source projects through the bundled plugin. */
export const somAssetSourceHost = {
    ...savedAssetSourceHost,
    inspect: (directory, overlays, signal) => inspect(directory, overlays, signal, somSourceHost),
};
//# sourceMappingURL=source-host.js.map
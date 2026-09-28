import type { AnalysisProjectManifest } from "@uttori/asm-disassembler";

import { findAnalysisProjectDirectories } from "../analysis/coverage-tree.js";
import { analysisWorker } from "../analysis/worker-client.js";
import type { OwnershipProject } from "./ownership-data.js";

/**
 * Match against authoritative manifests; an unavailable project must never be chosen by guessing.
 * @returns {Promise<OwnershipProject[]>} Discoverable projects whose authoritative manifests could be read.
 */
export const readOwnershipProjects = async (): Promise<OwnershipProject[]> => {
  const result: OwnershipProject[] = [];
  for (const directory of await findAnalysisProjectDirectories()) {
    try {
      result.push({
        directory,
        manifest: await analysisWorker().request<AnalysisProjectManifest>(directory, "manifest"),
      });
    } catch {
      /* Other available projects can still own the current export. */
    }
  }
  return result;
};

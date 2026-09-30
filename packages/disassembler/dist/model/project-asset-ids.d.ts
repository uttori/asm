import type { ProjectAssetCodecAnnotation } from "./project-types.js";
/**
 * Resolve a known v1 SNES declaration for analysis display without editing its stored provenance.
 * A different codec version or an unknown ID may have different byte semantics and stays unresolved.
 * @param {ProjectAssetCodecAnnotation} declaration Persisted project record.
 * @returns {string | undefined} Equivalent native format ID when semantics are known.
 */
export declare function resolveProjectNativeAssetId(declaration: ProjectAssetCodecAnnotation): string | undefined;
//# sourceMappingURL=project-asset-ids.d.ts.map
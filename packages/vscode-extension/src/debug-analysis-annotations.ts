/** Native analysis annotations supplied to the target-neutral inline DAP session. */
import type { DebugMap } from "@uttori/asm-core/debug-map";
import type { DebugAddress } from "@uttori/asm-debug-adapter";
import {
  buildInstructionAnalysisAnnotations,
  loadAnalysisProject,
  type InstructionAnalysisAnnotation,
} from "@uttori/asm-disassembler";
import { formatInstructionAnnotationSummary } from "./analysis-annotation-format.js";
import { findAnalysisProjectDirectories } from "./coverage-tree.js";

const locationKey = (addressSpace: string, address: number): string => `${addressSpace}:${address}`;

const append = <Key, Value>(map: Map<Key, Value[]>, key: Key, value: Value): void => {
  map.set(key, [...(map.get(key) ?? []), value]);
};

/**
 * Creates a constant-time DAP annotation lookup from exact ROM-matched native projects.
 * Invalid, foreign, and nonmatching projects contribute nothing to debugger presentation.
 * @param {DebugMap} map Loaded debug map for the session ROM.
 * @returns {Promise<((address: DebugAddress) => string | undefined) | undefined>} Optional address-to-annotation renderer.
 */
export const createDebugInstructionAnnotation = async (
  map: DebugMap,
): Promise<((address: DebugAddress) => string | undefined) | undefined> => {
  const byAddress = new Map<string, InstructionAnalysisAnnotation[]>();
  const byOutputOffset = new Map<number, InstructionAnalysisAnnotation[]>();
  for (const directory of await findAnalysisProjectDirectories()) {
    try {
      const project = loadAnalysisProject(directory);
      if (
        project.manifest.target !== map.target ||
        project.manifest.rom.contentSha256 !== map.output.sha256 ||
        project.manifest.rom.contentSize !== map.output.size
      ) {
        continue;
      }
      const projection = buildInstructionAnalysisAnnotations(project.manifest, project.shards);
      for (const annotation of projection.instructions) {
        append(byAddress, locationKey(annotation.addressSpace, annotation.address), annotation);
        for (const offset of annotation.outputOffsets) {
          append(byOutputOffset, offset, annotation);
        }
      }
    } catch {
      // Debug startup remains available when an unrelated analysis project is invalid.
    }
  }
  if (byAddress.size === 0 && byOutputOffset.size === 0) return undefined;
  return (address): string | undefined => {
    const candidates = [
      ...(byAddress.get(locationKey(address.addressSpace, address.address)) ?? []),
      ...(address.outputOffset === undefined
        ? []
        : (byOutputOffset.get(address.outputOffset) ?? [])),
    ];
    const summaries = [
      ...new Set(
        candidates
          .filter(
            (annotation) =>
              annotation.architectures.length === 0 ||
              annotation.architectures.includes(address.architecture),
          )
          .map((annotation) => formatInstructionAnnotationSummary(annotation))
          .filter(Boolean),
      ),
    ];
    return summaries.length > 0 ? summaries.join(" | ") : undefined;
  };
};

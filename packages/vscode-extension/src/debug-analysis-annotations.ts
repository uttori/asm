/** Native analysis annotations supplied to the target-neutral inline DAP session. */
import type { DebugMap } from "@uttori/asm-core/debug-map";
import type { DebugAddress } from "@uttori/asm-debug-adapter";
import { type AnalysisProjectManifest } from "@uttori/asm-disassembler";
import { findAnalysisProjectDirectories } from "./coverage-tree.js";
import { analysisWorker } from "./analysis-worker-client.js";

interface DebugAnnotation {
  readonly addressSpace: string;
  readonly address: number;
  readonly outputOffsets: readonly number[];
  readonly architectures: readonly string[];
  readonly text: string;
}

const locationKey = (addressSpace: string, address: number): string => `${addressSpace}:${address}`;

const append = <Key, Value>(map: Map<Key, Value[]>, key: Key, value: Value): void => {
  const entries = map.get(key);
  if (entries) entries.push(value);
  else map.set(key, [value]);
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
  const byAddress = new Map<string, DebugAnnotation[]>();
  const byOutputOffset = new Map<number, DebugAnnotation[]>();
  for (const directory of await findAnalysisProjectDirectories()) {
    try {
      const manifest = await analysisWorker().request<AnalysisProjectManifest>(
        directory,
        "manifest",
      );
      if (
        manifest.target !== map.target ||
        manifest.rom.contentSha256 !== map.output.sha256 ||
        manifest.rom.contentSize !== map.output.size
      ) {
        continue;
      }
      const annotations = await analysisWorker().request<DebugAnnotation[]>(
        directory,
        "debugAnnotations",
      );
      for (const annotation of annotations) {
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
          .map((annotation) => annotation.text)
          .filter(Boolean),
      ),
    ];
    return summaries.length > 0 ? summaries.join(" | ") : undefined;
  };
};

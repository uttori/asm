/** Native analysis annotations supplied to the target-neutral inline DAP session. */
import type { DebugMap } from "@uttori/asm-core/debug-map";
import type { DebugAddress } from "@uttori/asm-debug-adapter";
import { type AnalysisProjectManifest } from "@uttori/asm-disassembler";

import { findAnalysisProjectDirectories } from "../analysis/coverage-tree.js";
import { analysisWorker } from "../analysis/worker-client.js";
import { joinInformation } from "../editor-info/format.js";

/**
 * Compact DAP display text retaining architecture, address-space, and explicit output-offset
 * identities for exact matching.
 */
interface DebugAnnotation {
  readonly addressSpace: string;
  readonly address: number;
  readonly outputOffsets: readonly number[];
  readonly architectures: readonly string[];
  readonly text: string;
}

/**
 * Join address space and decimal address for lookup buckets; architecture and output-offset
 * checks are applied within each bucket.
 * @param {string} addressSpace Native address-space identifier.
 * @param {number} address Decimal address within that space.
 * @returns {string} Bucket key used before architecture/output-offset filtering.
 */
const locationKey = (addressSpace: string, address: number): string => `${addressSpace}:${address}`;

/**
 * Append to a location bucket while preserving all matching records; mutates the supplied map.
 * @param {Map<Key, Value[]>} map Mutable buckets retaining insertion order.
 * @param {Key} key Bucket identity.
 * @param {Value} value Entry appended without replacing existing values.
 */
const append = <Key, Value>(map: Map<Key, Value[]>, key: Key, value: Value): void => {
  const entries = map.get(key);
  if (entries) {
    entries.push(value);
  } else {
    map.set(key, [value]);
  }
};

/**
 * Creates a lazy DAP annotation lookup from exact ROM-matched native projects.
 * Requests for one disassembly page are batched. Startup never projects the entire runtime history.
 * Invalid, foreign, and nonmatching projects contribute nothing to debugger presentation.
 * @param {DebugMap} map Loaded debug map for the session ROM.
 * @returns {Promise<Function | undefined>} Optional asynchronous address-to-annotation renderer.
 */
export const createDebugInstructionAnnotation = async (
  map: DebugMap,
): Promise<((address: DebugAddress) => Promise<string | undefined>) | undefined> => {
  const directories: string[] = [];
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
      directories.push(directory);
    } catch {
      // Debug startup remains available when an unrelated analysis project is invalid.
    }
  }
  if (!directories.length) {
    return undefined;
  }
  const cached = new Map<string, Promise<string | undefined>>();
  const pending: { address: DebugAddress; resolve: (value: string | undefined) => void }[] = [];
  const flush = async (): Promise<void> => {
    const batch = pending.splice(0);
    // DAP pages can be requested concurrently. Bound each worker request independently.
    for (let offset = 0; offset < batch.length; offset += 512) {
      const page = batch.slice(offset, offset + 512);
      const byAddress = new Map<string, DebugAnnotation[]>();
      const byOutputOffset = new Map<number, DebugAnnotation[]>();
      const ranges = page.map(({ address }) => ({
        architecture: address.architecture,
        addressSpace: address.addressSpace,
        start: address.address,
        end: address.address + 1,
        sourceId: 0,
        line: 1,
        ...(address.outputOffset === undefined
          ? {}
          : { outputStart: address.outputOffset, outputEnd: address.outputOffset + 1 }),
      }));
      for (const directory of directories) {
        try {
          const annotations = await analysisWorker().request<DebugAnnotation[]>(
            directory,
            "debugAnnotations",
            { ranges },
          );
          for (const annotation of annotations) {
            append(byAddress, locationKey(annotation.addressSpace, annotation.address), annotation);
            for (const output of annotation.outputOffsets) {
              append(byOutputOffset, output, annotation);
            }
          }
        } catch {
          // A failed optional metadata query must leave debugger disassembly available.
        }
      }
      for (const { address, resolve } of page) {
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
                (entry) =>
                  !entry.architectures.length || entry.architectures.includes(address.architecture),
              )
              .map((entry) => entry.text)
              .filter(Boolean),
          ),
        ];
        // Bound the complete result: aliases and matching projects must not multiply the DAP budget.
        resolve(joinInformation(summaries, " | ", 220) || undefined);
      }
    }
  };
  return (address): Promise<string | undefined> => {
    const key = `${address.architecture}:${locationKey(address.addressSpace, address.address)}:${address.outputOffset ?? ""}`;
    const prior = cached.get(key);
    if (prior) {
      return prior;
    }
    if (cached.size >= 4096) {
      cached.clear();
    }
    const promise = new Promise<string | undefined>((resolve) => {
      const schedule = pending.length === 0;
      pending.push({ address, resolve });
      if (schedule) {
        queueMicrotask(() => {
          void flush();
        });
      }
    });
    cached.set(key, promise);
    return promise;
  };
};

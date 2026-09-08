import { validateDebugMap, type DebugMap, type DebugMapRange } from "@uttori/asm-core/debug-map";

import type { DebugAddress, DebugInstruction, DebugStackFrame, DebugThread } from "./contracts.js";
import type { ReplayMemoryRegion, ReplayScript, ReplaySnapshot } from "./replay-backend.js";

const addressFor = (range: DebugMapRange): DebugAddress => ({
  architecture: range.architecture,
  addressSpace: range.addressSpace,
  address: range.start,
  ...(range.outputStart === undefined ? {} : { outputOffset: range.outputStart }),
});

const instructionFor = (range: DebugMapRange, output: Uint8Array): DebugInstruction => {
  const bytes =
    range.outputStart === undefined || range.outputEnd === undefined
      ? []
      : [...output.subarray(range.outputStart, range.outputEnd)];
  return {
    address: addressFor(range),
    bytes,
    text: `.db ${bytes.map((byte) => `$${byte.toString(16).padStart(2, "0")}`).join(", ")}`,
  };
};

/**
 * Creates a deterministic mock timeline directly from a valid debug map.
 * @param {DebugMap} map Fingerprinted debug map.
 * @param {Uint8Array} output Exact mapped binary.
 * @returns {ReplayScript} One snapshot per mapped source range.
 */
export const createDebugMapReplayScript = (map: DebugMap, output: Uint8Array): ReplayScript => {
  const issues = validateDebugMap(map, output);
  if (issues.length > 0) throw new Error(issues.join(" "));
  if (map.ranges.length === 0) throw new Error("Debug map contains no executable source ranges.");

  const architectures = [...new Set(map.ranges.map((range) => range.architecture))].sort();
  const threads: DebugThread[] = architectures.map((architecture, index) => ({
    id: index + 1,
    name: architecture,
    architecture,
  }));
  const firstRange = new Map(
    architectures.map((architecture) => [
      architecture,
      map.ranges.find((range) => range.architecture === architecture)!,
    ]),
  );
  const currentRange = new Map(firstRange);
  const ordered = [...map.ranges].sort(
    (left, right) =>
      (left.outputStart ?? Number.MAX_SAFE_INTEGER) -
        (right.outputStart ?? Number.MAX_SAFE_INTEGER) ||
      left.architecture.localeCompare(right.architecture) ||
      left.start - right.start,
  );
  const instructions = ordered.map((range) => instructionFor(range, output));
  const snapshots: ReplaySnapshot[] = ordered.map((range) => {
    currentRange.set(range.architecture, range);
    const frames: DebugStackFrame[] = threads.map((thread) => {
      const active = currentRange.get(thread.architecture)!;
      return {
        id: thread.id * 100,
        threadId: thread.id,
        name: thread.name,
        pc: addressFor(active),
        currentOnly: true,
      };
    });
    const registers = Object.fromEntries(
      frames.map((frame) => [
        frame.id,
        [
          {
            name: "PC",
            value: frame.pc.address.toString(16),
            bits: Math.max(8, Math.ceil(Math.log2(frame.pc.address + 1) / 8) * 8),
          },
        ],
      ]),
    );
    const memory: ReplayMemoryRegion[] = ordered.flatMap((candidate) =>
      candidate.outputStart === undefined || candidate.outputEnd === undefined
        ? []
        : [
            {
              addressSpace: candidate.addressSpace,
              start: candidate.start,
              bytes: [...output.subarray(candidate.outputStart, candidate.outputEnd)],
            },
          ],
    );
    return { threads, frames, registers, memory, instructions };
  });
  return { snapshots };
};

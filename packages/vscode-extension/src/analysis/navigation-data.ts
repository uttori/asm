import {
  buildInstructionAnalysisAnnotations,
  type AnalysisProjectSnapshot,
  type AnalysisControlFlowNodeRecord,
  type RuntimeInstructionRecord,
} from "@uttori/asm-disassembler";

import { formatInstructionAnnotationSummary } from "../editor-info/format.js";
import type { AnalysisGraphNavigationTarget } from "./graph-tree.js";

/**
 * Bounded disassembly text plus an indicator that saved instruction bytes at the target lack a
 * ROM file-offset mapping.
 */
export interface AnalysisNavigationProjection {
  readonly lines: readonly string[];
  readonly capturedRam: boolean;
}

/**
 * Build a small disassembly window in the analysis process, preserving exact architecture/space.
 * @param {Pick<AnalysisProjectSnapshot, "manifest" | "shards">} project Validated native snapshot.
 * @param {AnalysisGraphNavigationTarget} target Exact navigation identity.
 * @param {ReadonlyMap} [executionCounts] Exact SQL totals for bounded runtime previews.
 * @returns {AnalysisNavigationProjection} At most 32 CFG rows plus 32 saved instruction variants.
 */
export const projectAnalysisNavigation = (
  project: Pick<AnalysisProjectSnapshot, "manifest" | "shards">,
  target: AnalysisGraphNavigationTarget,
  executionCounts?: ReadonlyMap<string, number>,
): AnalysisNavigationProjection => {
  if (
    project.manifest.target !== target.target ||
    project.manifest.rom.contentSha256 !== target.romContentSha256 ||
    project.manifest.rom.contentSize !== target.romContentSize
  ) {
    throw new Error("Navigation target no longer matches the current native analysis project.");
  }
  const matchesArchitecture = (specification: string): boolean =>
    !target.architectureHints.length ||
    target.architectureHints.some(
      (architecture) =>
        specification === architecture || specification.startsWith(`${architecture}.`),
    );
  const nodes = project.shards.analysis
    .filter(
      (record): record is AnalysisControlFlowNodeRecord =>
        record.kind === "cfg-node" &&
        record.addressSpace === target.addressSpace &&
        matchesArchitecture(record.specificationId),
    )
    .sort((a, b) => a.address - b.address || a.id.localeCompare(b.id));
  let index = nodes.findIndex(({ address }) => address >= target.address);
  if (index < 0) {
    index = Math.max(0, nodes.length - 1);
  }
  const visible = nodes.slice(Math.max(0, index - 4), Math.max(0, index - 4) + 32);
  const addresses = new Set([...visible.map(({ address }) => address), target.address]);
  const offsets = new Set(
    visible.flatMap((node) => (node.fileOffset === undefined ? [] : [node.fileOffset])),
  );
  const fileSpaces = new Set(
    project.manifest.addressSpaces.filter(({ kind }) => kind === "file").map(({ id }) => id),
  );
  const addressList = [...addresses];
  const offsetList = [...offsets];
  const locations = (space: string): readonly number[] => {
    if (space === target.addressSpace) {
      return addressList;
    }
    return fileSpaces.has(space) ? offsetList : [];
  };
  const runtime = project.shards.runtime.filter((record) => {
    if (!matchesArchitecture(record.architecture)) {
      return false;
    }
    if (record.kind === "runtime-memory-access") {
      return (
        record.instructionAddressSpace === target.addressSpace &&
        addresses.has(record.instructionAddress)
      );
    }
    if (record.kind === "runtime-control-target") {
      return record.fromAddressSpace === target.addressSpace && addresses.has(record.fromAddress);
    }
    if (record.kind === "runtime-coverage") {
      return locations(record.addressSpace).some(
        (address) => record.start <= address && address < record.end,
      );
    }
    return record.addressSpace === target.addressSpace && addresses.has(record.address);
  });
  // Only the visible instruction window needs annotation projection. Never ship full shards to VS Code.
  const projection = buildInstructionAnalysisAnnotations(project.manifest, {
    ...project.shards,
    analysis: visible,
    runtime,
    annotations: project.shards.annotations.filter((record) =>
      locations(record.addressSpace).some(
        (address) => record.start <= address && address < record.end,
      ),
    ),
  });
  const summaries = new Map(
    projection.instructions
      .filter((record) => record.addressSpace === target.addressSpace)
      .map((record) => [
        record.address,
        formatInstructionAnnotationSummary({
          ...record,
          executionCount:
            executionCounts?.get(`${record.addressSpace}:${record.address}`) ??
            record.executionCount,
        }),
      ]),
  );
  const lines = visible.map((node) => {
    const bytes = (
      node.bytes
        ? node.bytes.map((byte) => byte.toString(16).toUpperCase().padStart(2, "0"))
        : [
            node.opcode.toString(16).toUpperCase().padStart(2, "0"),
            ...Array.from({ length: Math.max(0, node.size - 1) }, () => "??"),
          ]
    ).join(" ");
    const summary = summaries.get(node.address);
    const context = node.context.length
      ? ` context=${node.context.map((value) => `0x${value.toString(16)}`).join("/")}`
      : "";
    return `${node.addressSpace}|0x${node.address.toString(16)}  ${bytes.padEnd(16)}  ${node.mnemonic} <${node.mode}> ; ${node.id}${context}${summary ? ` ; ${summary}` : ""}`;
  });
  const captured = runtime
    .filter(
      (record): record is RuntimeInstructionRecord =>
        record.kind === "runtime-instruction" && record.address === target.address,
    )
    .slice(0, 32);
  if (captured.length) {
    lines.push(
      "; Saved execution-time instruction variants at the selected address:",
      ...captured.map(
        (record) =>
          `${record.addressSpace}|0x${record.address.toString(16)}  ${record.bytes.map((byte) => byte.toString(16).toUpperCase().padStart(2, "0")).join(" ")} ; ${record.architecture} · recorded ${record.count} time(s)`,
      ),
    );
  }
  return {
    lines,
    capturedRam:
      visible.some(
        (node) => node.address === target.address && node.fileOffset === undefined && !!node.bytes,
      ) ||
      (captured.length > 0 &&
        !visible.some((node) => node.address === target.address && node.fileOffset !== undefined)),
  };
};

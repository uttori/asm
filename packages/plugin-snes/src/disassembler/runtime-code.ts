import { createHash } from "node:crypto";

import { Uint8ArrayDecoderSource, type DecodedInstruction } from "@uttori/asm-core";
import { canonicalJson } from "@uttori/asm-core/canonical-json";
import {
  EvidencePool,
  type AnalysisRecord,
  type AnalysisControlFlowNodeRecord,
  type AnalysisControlFlowEdgeRecord,
  type AnalysisProjectShards,
  type RomImage,
  type RuntimeInstructionRecord,
  type RuntimeEvidenceRecord,
} from "@uttori/asm-disassembler";

import { Cpu65816Decoder, type Cpu65816DecodeState } from "../architectures/65816-decoder.js";
import { snesRomAddressSpace } from "../target/address-space.js";
import { createSnesAddressContext } from "./address-identities.js";
import { identifySnesHardwareRegister } from "./hardware-registers.js";
import type { SnesMapper } from "./rom-header.js";

/**
 * Extract only state used by the decoder. Aliases, unknowns and emulation widths match analysis.
 * @param sample Execution-time instruction and paired registers.
 * @returns Width and bank state actually consumed by decoding.
 */
const runtimeDecodeState = (sample: RuntimeInstructionRecord): Cpu65816DecodeState => {
  const value = (key: string, max: number): number | undefined => {
    const entry = sample.state[key] ?? sample.state[key.toUpperCase()];
    return typeof entry === "number" && Number.isInteger(entry) && entry >= 0 && entry <= max
      ? entry
      : undefined;
  };
  const p = value("p", 255);
  const emulation = value("e", 1);
  const e = emulation === 0 || emulation === 1 ? emulation : undefined;
  let widths: Pick<Cpu65816DecodeState, "m" | "x"> = {};
  if (p !== undefined) {
    const memoryWidth = (p >> 5) & 1;
    const indexWidth = (p >> 4) & 1;
    if ((memoryWidth === 0 || memoryWidth === 1) && (indexWidth === 0 || indexWidth === 1)) {
      widths = { m: memoryWidth, x: indexWidth };
    }
  }
  if (e === 1) {
    widths = { m: 1, x: 1 };
  }
  return {
    ...(e === undefined ? {} : { e }),
    ...widths,
    programBank: sample.address >>> 16,
    ...(value("db", 255) === undefined ? {} : { dataBank: value("db", 255) }),
    ...(value("d", 65535) === undefined ? {} : { directPage: value("d", 65535) }),
  };
};

// Preserve bank/width conventions shared by the static CFG consumers.
/**
 * Serialize a register width or flag for analysis records.
 * @param entry Captured scalar, boolean, or unknown marker.
 */
const known = (entry: number | boolean | "unknown" | undefined): Record<string, unknown> =>
  entry === undefined || entry === "unknown"
    ? { kind: "unknown" }
    : { kind: "known", value: Number(entry) };

/**
 * Decode captured code from any CPU bus location, including WRAM and cartridge RAM.
 * @param shards Captured instructions and evidence.
 * @param rom Verified cartridge image.
 * @param mapper Address mapper for checking ROM provenance.
 * @param [runtime] SQL instruction-variant cursor, consumed within its read snapshot.
 * @returns Captured CFG variants and explicit conflicts.
 */
export const analyzeSnesRuntimeCode = (
  shards: AnalysisProjectShards,
  rom: RomImage,
  mapper: SnesMapper,
  runtime: Iterable<RuntimeEvidenceRecord> = shards.runtime,
  onProgress?: (message: string) => void,
): readonly AnalysisRecord[] => {
  const evidencePool = new EvidencePool();
  const decoder = new Cpu65816Decoder();
  const context = createSnesAddressContext(mapper);
  const romBytes = rom.bytes();
  const nodes = new Map<string, AnalysisControlFlowNodeRecord>();
  const instructions = new Map<string, DecodedInstruction>();
  const records: AnalysisRecord[] = [];
  let observations = 0;
  for (const sample of runtime) {
    if (++observations % 10000 === 0) {
      onProgress?.(`Decoded ${observations} instruction observations into ${nodes.size} variants.`);
    }
    if (
      sample.kind !== "runtime-instruction" ||
      sample.architecture !== "snes.65816" ||
      sample.addressSpace !== "snes.cpu"
    ) {
      continue;
    }
    const state = runtimeDecodeState(sample);
    const variant = createHash("sha256")
      .update(canonicalJson({ address: sample.address, bytes: sample.bytes, state }))
      .digest("hex")
      .slice(0, 24);
    const id = `runtime:code:${variant}`;
    const duplicate = nodes.get(id);
    if (duplicate) {
      nodes.set(id, {
        ...duplicate,
        evidence: evidencePool.sorted([...duplicate.evidence, ...sample.evidence]),
      });
      continue;
    }
    const decoded = decoder.decode({
      source: new Uint8ArrayDecoderSource(Uint8Array.from(sample.bytes)),
      offset: 0,
      logicalAddress: sample.address,
      state,
    });
    if (decoded.kind !== "instruction" || decoded.instruction.size !== sample.bytes.length) {
      if (!records.some((record) => record.id === `${id}:unresolved`)) {
        records.push({
          id: `${id}:unresolved`,
          kind: "unresolved",
          addressSpace: "snes.cpu",
          address: sample.address,
          flowKind: "decode",
          indirect: false,
          reason: "Captured bytes/state do not establish one complete 65816 instruction.",
          evidence: evidencePool.intern(sample.evidence),
        });
      }
      continue;
    }
    const instruction = decoded.instruction;
    const fileOffset = snesRomAddressSpace.toOutputOffset(sample.address, context);
    const matchesRom =
      fileOffset >= 0 &&
      fileOffset + sample.bytes.length <= rom.length &&
      sample.bytes.every((byte, index) => romBytes[fileOffset + index] === byte);
    const incomingState = {
      e: known(state.e),
      m: known(state.m),
      x: known(state.x),
      dbr: known(state.dataBank),
      d: known(state.directPage),
      pbr: known(state.programBank),
    };
    const prior = nodes.get(id);
    nodes.set(id, {
      id,
      kind: "cfg-node",
      addressSpace: "snes.cpu",
      address: sample.address,
      ...(matchesRom ? { fileOffset } : {}),
      bytes: sample.bytes,
      size: instruction.size,
      opcode: instruction.opcode,
      specificationId: instruction.specificationId,
      mnemonic: instruction.mnemonic,
      mode: instruction.mode,
      context: [],
      incomingState,
      outgoingState: {},
      entryPoint: `captured:${sample.evidence[0]}`,
      evidencePath: [id],
      evidence: evidencePool.sorted([...(prior?.evidence ?? []), ...sample.evidence]),
      effectiveAddresses: instruction.references
        .filter((ref) => ref.kind === "data" || ref.kind === "pointer")
        .map((ref) => {
          const indexed =
            instruction.mode.includes("Indexed") ||
            instruction.mode.includes("Indirect") ||
            instruction.mode.startsWith("stackRelative");
          const hardware =
            ref.address === undefined ? undefined : identifySnesHardwareRegister(ref.address);
          let resolved: { address?: number; baseAddress?: number } = {};
          if (ref.address !== undefined) {
            resolved = indexed ? { baseAddress: ref.address } : { address: ref.address };
          }
          return Object.assign(
            {},
            { operandIndex: ref.operandIndex ?? 0 },
            resolved,
            Object.assign(
              {},
              { volatile: !!hardware },
              hardware ? { symbol: hardware.symbol } : {},
              {
                explanation: indexed
                  ? "Captured instruction has an unresolved indexed/indirect operand. Consult observed bus accesses."
                  : "Decoded from execution-time bytes and processor state.",
              },
            ),
          );
        }),
    });
    instructions.set(id, instruction);
  }
  onProgress?.(
    `Decoded ${observations.toLocaleString("en-US")} instruction observations into ${nodes.size.toLocaleString("en-US")} variants; connecting their control flow.`,
  );
  const byAddress = new Map<number, AnalysisControlFlowNodeRecord[]>();
  for (const node of nodes.values()) {
    const entries = byAddress.get(node.address) ?? [];
    entries.push(node);
    byAddress.set(node.address, entries);
  }
  const edges: AnalysisControlFlowEdgeRecord[] = [];
  const entries = new Set<string>();
  let connected = 0;
  for (const node of nodes.values()) {
    if (++connected % 10000 === 0) {
      onProgress?.(
        `Connected ${connected.toLocaleString("en-US")}/${nodes.size.toLocaleString("en-US")} variants (${((100 * connected) / nodes.size).toFixed(1)}%).`,
      );
    }
    const instruction = instructions.get(node.id)!;
    const targets: { address?: number; kind: string; indirect?: boolean }[] = instruction.references
      .filter((ref) => ["call", "branch", "jump"].includes(ref.kind))
      .map((ref) => ({ address: ref.address, kind: ref.kind, indirect: ref.indirect }));
    if (instruction.flow.fallthrough) {
      targets.push({
        address: (node.address & 0xff0000) | ((node.address + node.size) & 65535),
        kind: "fallthrough",
        indirect: false,
      });
    }
    for (const [index, target] of targets.entries()) {
      const candidates = target.address === undefined ? [] : (byAddress.get(target.address) ?? []);
      const destination = candidates.length === 1 ? candidates[0] : undefined;
      if (target.kind === "call" && destination) {
        entries.add(destination.id);
      }
      edges.push({
        id: `${node.id}:edge:${index}`,
        kind: "cfg-edge",
        addressSpace: "snes.cpu",
        from: node.id,
        fromAddress: node.address,
        ...(destination ? { to: destination.id } : {}),
        ...(target.address === undefined ? {} : { toAddress: target.address }),
        edgeKind: target.kind,
        indirect: target.indirect ?? false,
        explanation:
          "Possible edge decoded from captured bytes. Does not assert that this branch was taken.",
        evidence: node.evidence,
      });
    }
  }
  // Only proven call targets establish function candidates. Interior observations remain blocks.
  const outgoing = new Map<string, AnalysisControlFlowEdgeRecord[]>();
  for (const edge of edges) {
    const list = outgoing.get(edge.from) ?? [];
    list.push(edge);
    outgoing.set(edge.from, list);
  }
  // Propagate unique/ambiguous ownership through each node at most twice. Copying complete trail
  // arrays for every queued path is quadratic on long routines and can exhaust a full-project heap.
  const ownership = new Map<string, string | null>();
  const predecessors = new Map<string, string>();
  const queue = [...entries];
  for (const entry of entries) {
    ownership.set(entry, entry);
  }
  let propagated = 0;
  for (const id of queue) {
    if (++propagated % 10000 === 0) {
      onProgress?.(
        `Propagated function ownership through ${propagated.toLocaleString("en-US")} blocks, ${(queue.length - propagated).toLocaleString("en-US")} queued.`,
      );
    }
    const owner = ownership.get(id)!;
    for (const edge of outgoing.get(id) ?? []) {
      if (!edge.to || edge.edgeKind === "call" || entries.has(edge.to)) {
        continue;
      }
      if (!ownership.has(edge.to)) {
        ownership.set(edge.to, owner);
        if (owner) {
          predecessors.set(edge.to, id);
        }
        queue.push(edge.to);
      } else if (ownership.get(edge.to) !== null && ownership.get(edge.to) !== owner) {
        ownership.set(edge.to, null);
        predecessors.delete(edge.to);
        queue.push(edge.to);
      }
    }
  }
  for (const entry of entries) {
    const node = nodes.get(entry)!;
    records.push({
      id: `${entry}:function`,
      kind: "function",
      addressSpace: "snes.cpu",
      address: node.address,
      source: "runtime-call-target",
      evidencePath: [entry],
      evidence: node.evidence,
    });
  }
  for (const node of nodes.values()) {
    const owner = ownership.get(node.id);
    records.push({
      ...node,
      ...(owner ? { functionEntry: owner, evidencePredecessor: predecessors.get(node.id) } : {}),
    });
  }
  // Large captures exceed V8's function-argument limit even when the arrays fit in memory.
  // Append individually to retain every edge without spreading the graph onto the call stack.
  for (const edge of edges) {
    records.push(edge);
  }
  for (const [address, variants] of byAddress) {
    // CPU state can legitimately differ between executions of the same instruction. Preserve
    // every state/evidence variant, but only incompatible instruction encodings are code conflicts.
    // For example, changing X width does not change an accumulator-immediate LDA instruction.
    const encodings = new Set(
      variants.map((node) => `${node.specificationId}:${node.size}:${node.bytes?.join(",")}`),
    );
    if (encodings.size > 1) {
      records.push({
        id: `runtime:code:variants:${address.toString(16)}`,
        kind: "conflict",
        addressSpace: "snes.cpu",
        address,
        conflictKind: "runtime-code-variants",
        message:
          "Captured executions disagree on instruction bytes or decoding. All variants and their trace evidence are retained.",
        nodes: variants.map((node) => node.id),
        evidence: [...new Set(variants.flatMap((node) => node.evidence))].toSorted(),
      });
    }
  }
  onProgress?.(
    `Prepared ${records.length.toLocaleString("en-US")} captured code records from ${nodes.size.toLocaleString("en-US")} instruction variants and ${edges.length.toLocaleString("en-US")} control-flow edges.`,
  );
  return records.toSorted((a, b) => a.id.localeCompare(b.id));
};

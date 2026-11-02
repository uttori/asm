import { Uint8ArrayDecoderSource, type DecodedInstruction } from "@uttori/asm-core";
import {
  readAnalysisTargetState,
  analyzeStaticControlFlow,
  type AnalysisRecord,
  type AnalysisTargetOverrideRecord,
  type AnalysisTargetSetRecord,
  type EvidenceRecord,
  type IntervalAnnotation,
  type ProjectLabel,
  type StaticAnalysisLimits,
  type StaticAnalysisResult,
  type StaticAnalysisSeed,
  type StaticControlTarget,
  type StaticEffectiveAddress,
  type StaticInstruction,
  type StaticTargetOverride,
} from "@uttori/asm-disassembler";

import { Spc700Decoder } from "../architectures/spc700-decoder.js";
import {
  coverageRecord,
  effectiveAddressRecords,
  incompleteReasonRecords,
  spc700StateRecord,
} from "./analysis-record-values.js";
import { SPC700_ARAM_ADDRESS_SPACE, type Spc700AramImage } from "./spc700-address-space.js";
import { identifySpc700HardwareRegister } from "./spc700-hardware-registers.js";
import {
  applySpc700StateOverride,
  joinSpc700States,
  spc700DecodeState,
  spc700StateKey,
  transferSpc700State,
  unknownSpc700State,
  type Spc700AbstractState,
  type Spc700StateOverride,
} from "./spc700-state.js";

const DATA_CLASSIFICATIONS = new Set<IntervalAnnotation["classification"]>([
  "data8",
  "data16",
  "data24",
  "data32",
  "pointer16",
  "pointer24",
  "pointer32",
  "graphics",
  "music",
  "empty",
  "text",
  "operand",
]);

const EVIDENCE_RANK: Readonly<Record<EvidenceRecord["source"], number>> = {
  detector: 0,
  static: 1,
  import: 2,
  runtime: 3,
  manual: 4,
};

/** Explicit seed for standalone SPC700 analysis. No reset-vector assumption is made. */
export interface Spc700EntryPoint {
  /** Stable seed id referenced by analysis records. */
  readonly id: string;
  /** 16-bit ARAM address where decoding begins. */
  readonly address: number;
  /** Optional PSW/direct-page overlay applied at entry. */
  readonly state?: Spc700StateOverride;
  /** Evidence ids justifying this seed; synthesized when omitted. */
  readonly evidence?: readonly string[];
}

/** Project shards, entry points, and deterministic worklist limits for SPC700 analysis. */
export interface Spc700AnalysisOptions extends StaticAnalysisLimits {
  /** Existing interval annotations that block decoding or supply seeds. */
  readonly annotations?: readonly IntervalAnnotation[];
  /** Project labels converted to ARAM entry seeds when in range. */
  readonly labels?: readonly ProjectLabel[];
  /** Prior evidence records reused and deduplicated for this run. */
  readonly evidence?: readonly EvidenceRecord[];
  /** Explicit ARAM entry points beyond labels and annotations. */
  readonly entryPoints?: readonly Spc700EntryPoint[];
  /** Target-set addresses seeded as additional entry points. */
  readonly targetSets?: readonly AnalysisTargetSetRecord[];
  /** Manual overrides for indirect control transfers. */
  readonly targetOverrides?: readonly AnalysisTargetOverrideRecord[];
}

/** SPC700 CFG plus project-shaped analysis, annotation, and evidence records. */
export interface Spc700AnalysisResult extends StaticAnalysisResult<Spc700AbstractState> {
  /** CFG nodes, edges, diagnostics and summary records for publication. */
  readonly records: readonly AnalysisRecord[];
  /** Opcode/operand intervals regenerated from the CFG decode. */
  readonly annotations: readonly IntervalAnnotation[];
  /** Input evidence plus run and entry evidence sorted by id. */
  readonly evidenceRecords: readonly EvidenceRecord[];
}

/**
 * Test whether an ARAM annotation covers an instruction address.
 * @param annotation Project interval in the SPC700 address space.
 * @param address 16-bit ARAM program counter.
 */
const intervalContains = (annotation: IntervalAnnotation, address: number): boolean =>
  annotation.addressSpace === SPC700_ARAM_ADDRESS_SPACE &&
  annotation.start <= address &&
  address < annotation.end;

/**
 * Extract a direct-page override stored on an annotation payload.
 * @param annotation Interval carrying optional SPC700 state metadata.
 */
const stateOverrideFor = (annotation: IntervalAnnotation): Spc700StateOverride | undefined => {
  const payload = readAnalysisTargetState(annotation.architecture, annotation.state);
  const directPage = payload?.codec === "snes.spc700" ? payload.state.directPage : undefined;
  return directPage === 0 || directPage === 0x100 ? { directPage } : undefined;
};

/**
 * Read a little-endian 16-bit value from ARAM when both bytes exist.
 * @param image ARAM view used for vector and indirect resolution.
 * @param address Low byte address of the word.
 */
const readWord = (image: Spc700AramImage, address: number): number | undefined => {
  const low = image.readByte(address);
  const high = image.readByte(address + 1);
  return low === undefined || high === undefined ? undefined : low | (high << 8);
};

/**
 * Map decoder reference kinds onto static control-flow edge kinds.
 * @param kind Operand reference classification from the decoder.
 */
const controlTargetKind = (
  kind: DecodedInstruction["references"][number]["kind"],
): "branch" | "call" | "jump" => {
  if (kind === "branch") {
    return "branch";
  }
  if (kind === "call") {
    return "call";
  }
  return "jump";
};

/**
 * Derive static control targets, including TCALL vectors and BRK dispatch.
 * @param instruction Decoded SPC700 instruction at the current PC.
 * @param image ARAM image used to resolve indirect vectors.
 */
const controlsFor = (
  instruction: DecodedInstruction,
  image: Spc700AramImage,
): readonly StaticControlTarget[] => {
  if (instruction.mnemonic === "TCALL") {
    const vector = instruction.references.find(
      (reference) => reference.kind === "pointer",
    )?.address;
    const target = vector === undefined ? undefined : readWord(image, vector);
    return [
      {
        kind: "call",
        ...(target === undefined ? {} : { address: target }),
        indirect: true,
        explanation:
          target === undefined
            ? "The TCALL vector is outside the represented ARAM image."
            : `Resolved through the TCALL vector at $${vector!.toString(16).padStart(4, "0")}.`,
      },
    ];
  }
  if (instruction.flow.kind === "interrupt") {
    const target = readWord(image, 0xffde);
    return [
      {
        kind: "interrupt",
        ...(target === undefined ? {} : { address: target }),
        indirect: true,
        explanation:
          target === undefined
            ? "The BRK vector at $FFDE is outside the represented ARAM image."
            : "Resolved through the BRK vector at $FFDE.",
      },
    ];
  }
  return instruction.references
    .filter(
      (reference) =>
        reference.kind === "branch" || reference.kind === "call" || reference.kind === "jump",
    )
    .map((reference): StaticControlTarget =>
      Object.assign(
        {},
        { kind: controlTargetKind(reference.kind) },
        reference.address === undefined ? {} : { address: reference.address },
        Object.assign(
          {},
          reference.indirect ? { indirect: true } : {},
          reference.address === undefined
            ? { explanation: "The decoded indirect target is not known statically." }
            : {},
        ),
      ),
    );
};

/** True when the addressing mode may leave the effective address unknown without index state. */
const isIndexedOrIndirect = (mode: string): boolean =>
  mode.includes("Indexed") || mode.includes("Indirect");

/**
 * Build effective-address records for data and pointer operands.
 * @param instruction Decoded instruction whose references are summarized.
 */
const effectiveAddressesFor = (
  instruction: DecodedInstruction,
): readonly StaticEffectiveAddress[] =>
  instruction.references
    .filter((reference) => reference.kind === "data" || reference.kind === "pointer")
    .map((reference): StaticEffectiveAddress => {
      const operandIndex = reference.operandIndex ?? 0;
      if (reference.address === undefined) {
        return {
          operandIndex,
          volatile: false,
          explanation: instruction.mode.toLowerCase().includes("direct")
            ? "Effective address is unresolved because PSW.P is unknown or conflicting."
            : "The indirect effective address is unresolved.",
        };
      }
      const indexed = isIndexedOrIndirect(instruction.mode);
      const hardware = indexed ? undefined : identifySpc700HardwareRegister(reference.address);
      if (hardware) {
        return {
          operandIndex,
          address: reference.address,
          symbol: hardware.symbol,
          volatile: true,
          explanation: `${hardware.symbol} is volatile SPC700 memory-mapped I/O.`,
        };
      }
      return Object.assign(
        {},
        { operandIndex },
        indexed ? { baseAddress: reference.address } : { address: reference.address },
        {
          volatile: false,
          explanation: indexed
            ? "The encoded address is only a base. Indexing or indirection prevents a static effective address."
            : "Address resolves within the 16-bit SPC700 memory space.",
        },
      );
    });

/** Project only known direct-page state onto interval annotations. */
const annotationState = (state: Spc700AbstractState): NonNullable<IntervalAnnotation["state"]> =>
  state.directPage.kind === "known" ? { directPage: state.directPage.value } : {};

/**
 * Convert a static CFG result into publication-ready analysis records.
 * @param result Completed SPC700 control-flow analysis.
 * @param runEvidence Evidence id identifying this analysis run.
 */
const recordsFor = (
  result: StaticAnalysisResult<Spc700AbstractState>,
  runEvidence: string,
): readonly AnalysisRecord[] => [
  ...result.nodes.map((node): AnalysisRecord => ({
    id: `static:spc700:${node.id}`,
    kind: "cfg-node",
    addressSpace: SPC700_ARAM_ADDRESS_SPACE,
    address: node.address,
    fileOffset: node.fileOffset,
    size: node.size,
    opcode: node.opcode,
    specificationId: node.specificationId,
    mnemonic: node.mnemonic,
    mode: node.mode,
    context: node.context,
    incomingState: spc700StateRecord(node.incomingState),
    outgoingState: spc700StateRecord(node.outgoingState),
    effectiveAddresses: effectiveAddressRecords(node.effectiveAddresses),
    entryPoint: node.entryPoint,
    evidencePath: node.evidencePath.map((id) => `static:spc700:${id}`),
    evidence: [...new Set([...node.evidence, runEvidence])].toSorted(),
  })),
  ...result.edges.map((edge): AnalysisRecord => ({
    id: `static:spc700:${edge.id}`,
    kind: "cfg-edge",
    addressSpace: SPC700_ARAM_ADDRESS_SPACE,
    from: `static:spc700:${edge.from}`,
    fromAddress: edge.fromAddress,
    ...(edge.to ? { to: `static:spc700:${edge.to}` } : {}),
    ...(edge.toAddress === undefined ? {} : { toAddress: edge.toAddress }),
    edgeKind: edge.kind,
    indirect: edge.indirect,
    ...(edge.override ? { override: edge.override } : {}),
    ...(edge.explanation ? { explanation: edge.explanation } : {}),
    evidence: [...new Set([...edge.evidence, runEvidence])].toSorted(),
  })),
  ...result.functions.map((fn): AnalysisRecord => ({
    id: `static:spc700:${fn.id}`,
    kind: "function",
    addressSpace: SPC700_ARAM_ADDRESS_SPACE,
    address: fn.address,
    source: fn.source,
    evidencePath: fn.evidencePath.map((id) => `static:spc700:${id}`),
    evidence: [...new Set([...fn.evidence, runEvidence])].toSorted(),
  })),
  ...result.conflicts.map((conflict): AnalysisRecord => ({
    id: `static:spc700:${conflict.id}`,
    kind: "conflict",
    addressSpace: SPC700_ARAM_ADDRESS_SPACE,
    address: conflict.address,
    conflictKind: conflict.kind,
    message: conflict.message,
    nodes: conflict.nodes.map((id) => `static:spc700:${id}`),
    evidence: [...new Set([...conflict.evidence, runEvidence])].toSorted(),
  })),
  ...result.unresolved.map((flow): AnalysisRecord => ({
    id: `static:spc700:${flow.id}`,
    kind: "unresolved",
    addressSpace: SPC700_ARAM_ADDRESS_SPACE,
    address: flow.address,
    flowKind: flow.kind,
    indirect: flow.indirect,
    reason: flow.reason,
    evidence: [...new Set([...flow.evidence, runEvidence])].toSorted(),
  })),
  {
    id: "static:spc700:summary",
    kind: "summary",
    architecture: "snes.spc700",
    status: result.status,
    coverage: coverageRecord(result.coverage),
    processedWorkItems: result.processedWorkItems,
    incompleteReasons: incompleteReasonRecords(result.incompleteReasons),
    evidence: [runEvidence],
  },
];

/**
 * Regenerate opcode/operand interval annotations from decoded CFG nodes.
 * @param result Completed SPC700 control-flow analysis.
 * @param runEvidence Evidence id identifying this analysis run.
 */
const annotationsFor = (
  result: StaticAnalysisResult<Spc700AbstractState>,
  runEvidence: string,
): readonly IntervalAnnotation[] => {
  const output = new Map<string, IntervalAnnotation>();
  const stateByAddress = new Map<number, Spc700AbstractState>();
  for (const node of result.nodes) {
    const previous = stateByAddress.get(node.address);
    stateByAddress.set(
      node.address,
      previous ? joinSpc700States(previous, node.incomingState) : node.incomingState,
    );
  }
  for (const node of result.nodes) {
    const address = node.address.toString(16).padStart(4, "0");
    const evidence = [...new Set([...node.evidence, runEvidence])].toSorted();
    const state = annotationState(stateByAddress.get(node.address) ?? node.incomingState);
    output.set(`static:spc700:opcode:${address}`, {
      id: `static:spc700:opcode:${address}`,
      addressSpace: SPC700_ARAM_ADDRESS_SPACE,
      start: node.address,
      end: node.address + 1,
      classification: "opcode",
      architecture: "snes.spc700",
      ...(Object.keys(state).length === 0 ? {} : { state }),
      evidence,
    });
    if (node.size > 1) {
      output.set(`static:spc700:operand:${address}`, {
        id: `static:spc700:operand:${address}`,
        addressSpace: SPC700_ARAM_ADDRESS_SPACE,
        start: node.address + 1,
        end: node.address + node.size,
        classification: "operand",
        architecture: "snes.spc700",
        evidence,
      });
    }
  }
  return [...output.values()].toSorted(
    (left, right) => left.start - right.start || left.id.localeCompare(right.id),
  );
};

/**
 * Runs conservative SPC700 CFG analysis over one contiguous ARAM image.
 * Entry points are explicit or project-derived. The analyzer does not assume
 * that a standalone payload represents reset-time memory.
 * @param image Immutable contiguous ARAM bytes and load address.
 * @param [options] Project inputs, entry points, overrides, and limits.
 * @returns Static CFG and project-shaped records.
 */
export const analyzeSpc700Aram = (
  image: Spc700AramImage,
  options: Spc700AnalysisOptions = {},
): Spc700AnalysisResult => {
  const decoder = new Spc700Decoder();
  const source = new Uint8ArrayDecoderSource(image.bytes());
  const evidenceById = new Map((options.evidence ?? []).map((record) => [record.id, record]));
  const annotations = (options.annotations ?? []).filter(
    (annotation) => !annotation.id.startsWith("static:spc700:"),
  );
  const runEvidence = `static:spc700:${image.contentSha256}:${image.loadAddress.toString(16)}`;
  const evidenceRecords = new Map<string, EvidenceRecord>();
  evidenceRecords.set(runEvidence, {
    id: runEvidence,
    source: "static",
    sourceId: "snes.spc700.static-v1",
    confidence: "high",
    detail: `Conservative SPC700 analysis at $${image.loadAddress.toString(16).padStart(4, "0")} of ${image.contentSha256}`,
  });
  const explicitStateOverrides = new Map<number, Spc700StateOverride>();
  const conflictingExplicitStateOverrides = new Set<number>();
  for (const entry of options.entryPoints ?? []) {
    if (!entry.state || conflictingExplicitStateOverrides.has(entry.address)) {
      continue;
    }
    const existing = explicitStateOverrides.get(entry.address);
    if (!existing) {
      explicitStateOverrides.set(entry.address, entry.state);
    } else if (JSON.stringify(existing) !== JSON.stringify(entry.state)) {
      explicitStateOverrides.delete(entry.address);
      conflictingExplicitStateOverrides.add(entry.address);
    }
  }

  const stateAtAddress = (
    base: Spc700AbstractState,
    address: number,
  ): { readonly state: Spc700AbstractState; readonly evidence: readonly string[] } => {
    const matching = annotations
      .filter((annotation) => intervalContains(annotation, address) && stateOverrideFor(annotation))
      .map((annotation) => ({
        annotation,
        // Imported evidence is input-sized even though the CPU address space is only 64 KiB.
        rank: annotation.evidence.reduce(
          (rank, id) => Math.max(rank, EVIDENCE_RANK[evidenceById.get(id)?.source ?? "detector"]),
          0,
        ),
      }))
      .toSorted(
        (left, right) =>
          left.rank - right.rank || left.annotation.id.localeCompare(right.annotation.id),
      );
    let state = base;
    const consumed: string[] = [];
    for (const { annotation } of matching) {
      state = applySpc700StateOverride(state, stateOverrideFor(annotation)!);
      // Keep every evidence identity without spreading it onto the native call stack.
      for (const id of annotation.evidence) {
        consumed.push(id);
      }
    }
    return { state, evidence: [...new Set(consumed)].toSorted() };
  };

  const seeds: StaticAnalysisSeed<Spc700AbstractState>[] = [];
  for (const label of options.labels ?? []) {
    if (label.addressSpace !== SPC700_ARAM_ADDRESS_SPACE) {
      continue;
    }
    const seeded = stateAtAddress(unknownSpc700State(), label.address);
    seeds.push({
      id: `label:${label.id}`,
      address: label.address,
      kind: "imported-label",
      state: seeded.state,
      evidence: [...new Set([...label.evidence, ...seeded.evidence])].toSorted(),
      detail: label.name,
    });
  }
  for (const annotation of annotations) {
    if (
      !annotation.points?.includes("in") ||
      annotation.addressSpace !== SPC700_ARAM_ADDRESS_SPACE
    ) {
      continue;
    }
    const seeded = stateAtAddress(unknownSpc700State(), annotation.start);
    seeds.push({
      id: `point:${annotation.id}`,
      address: annotation.start,
      kind: "manual",
      state: seeded.state,
      evidence: [...new Set([...annotation.evidence, ...seeded.evidence])].toSorted(),
    });
  }
  for (const entry of options.entryPoints ?? []) {
    const evidenceId = entry.evidence?.[0] ?? `manual:entry:${entry.id}`;
    if (!evidenceById.has(evidenceId)) {
      evidenceRecords.set(evidenceId, {
        id: evidenceId,
        source: "manual",
        sourceId: entry.id,
        confidence: "certain",
        detail: `Configured SPC700 entry point $${entry.address.toString(16).padStart(4, "0")}.`,
      });
    }
    const seeded = stateAtAddress(unknownSpc700State(), entry.address);
    seeds.push({
      id: `entry:${entry.id}`,
      address: entry.address,
      kind: "configured",
      state: applySpc700StateOverride(seeded.state, entry.state ?? {}),
      evidence: [...new Set([...(entry.evidence ?? [evidenceId]), ...seeded.evidence])].toSorted(),
    });
  }
  for (const targetSet of options.targetSets ?? []) {
    if (targetSet.addressSpace !== SPC700_ARAM_ADDRESS_SPACE) {
      continue;
    }
    for (const address of targetSet.targets) {
      const seeded = stateAtAddress(unknownSpc700State(), address);
      seeds.push({
        id: `target-set:${targetSet.id}:${address.toString(16)}`,
        address,
        kind: "target-set",
        state: seeded.state,
        evidence: [...new Set([...targetSet.evidence, ...seeded.evidence])].toSorted(),
      });
    }
  }

  const targetOverrides: StaticTargetOverride[] = (options.targetOverrides ?? [])
    .filter((override) => override.addressSpace === SPC700_ARAM_ADDRESS_SPACE)
    .map((override) => ({
      id: override.id,
      address: override.address,
      targets: [...override.targets].toSorted((left, right) => left - right),
      evidence: override.evidence,
    }));

  const result = analyzeStaticControlFlow<Spc700AbstractState>(
    {
      backingSize: image.length,
      enterAddress: (state, address) => {
        const annotated = stateAtAddress(state, address).state;
        const explicit = explicitStateOverrides.get(address);
        return explicit ? applySpc700StateOverride(annotated, explicit) : annotated;
      },
      join: joinSpc700States,
      stateKey: spc700StateKey,
      transfer: transferSpc700State,
      decode: (address, state) => {
        const identity = image.identifyAddress(address);
        if (!identity) {
          return { kind: "error", reason: "Address is outside the ARAM image." };
        }
        const blocked = annotations.find(
          (annotation) =>
            intervalContains(annotation, address) &&
            DATA_CLASSIFICATIONS.has(annotation.classification),
        );
        if (blocked) {
          return {
            kind: "blocked",
            reason: `Analysis reached '${blocked.classification}' region '${blocked.id}'.`,
            evidence: blocked.evidence,
          };
        }
        const decoded = decoder.decode({
          source,
          offset: identity.imageOffset,
          logicalAddress: address,
          state: spc700DecodeState(state),
        });
        if (decoded.kind === "ambiguous") {
          return {
            kind: "ambiguous",
            reason: decoded.reason,
            requiredState: decoded.requiredState,
          };
        }
        if (decoded.kind === "error") {
          return { kind: "error", reason: decoded.message };
        }
        const instruction = decoded.instruction;
        const crossing = annotations.find(
          (annotation) =>
            DATA_CLASSIFICATIONS.has(annotation.classification) &&
            Array.from({ length: instruction.size }, (_, index) => address + index).some((value) =>
              intervalContains(annotation, value),
            ),
        );
        if (crossing) {
          return {
            kind: "blocked",
            reason: `Instruction crosses '${crossing.classification}' region '${crossing.id}'.`,
            evidence: crossing.evidence,
          };
        }
        const normalized: StaticInstruction = {
          specificationId: instruction.specificationId,
          address,
          fileOffset: identity.imageOffset,
          size: instruction.size,
          opcode: instruction.opcode,
          mnemonic: instruction.mnemonic,
          mode: instruction.mode,
          effects: instruction.effects,
          evidence: stateAtAddress(state, address).evidence,
          flow: instruction.flow,
          targets: controlsFor(instruction, image),
          effectiveAddresses: effectiveAddressesFor(instruction),
        };
        return { kind: "instruction", instruction: normalized };
      },
    },
    seeds,
    {
      ...(options.maxWorkItems === undefined ? {} : { maxWorkItems: options.maxWorkItems }),
      ...(options.maxCallDepth === undefined ? {} : { maxCallDepth: options.maxCallDepth }),
      targetOverrides,
    },
  );

  return {
    ...result,
    records: recordsFor(result, runEvidence),
    annotations: annotationsFor(result, runEvidence),
    evidenceRecords: [...evidenceRecords.values()].toSorted((left, right) =>
      left.id.localeCompare(right.id),
    ),
  };
};

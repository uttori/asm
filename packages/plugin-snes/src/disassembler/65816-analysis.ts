import { Uint8ArrayDecoderSource, type DecodedInstruction } from "@uttori/asm-core";
import {
  analyzeStaticControlFlow,
  type AnalysisRecord,
  type AnalysisTargetOverrideRecord,
  type AnalysisTargetSetRecord,
  type EvidenceRecord,
  type IntervalAnnotation,
  type ProjectLabel,
  type RomImage,
  type StaticAnalysisLimits,
  type StaticAnalysisResult,
  type StaticAnalysisSeed,
  type StaticControlTarget,
  type StaticEffectiveAddress,
  type StaticInstruction,
  type StaticTargetOverride,
} from "@uttori/asm-disassembler";

import { Cpu65816Decoder } from "../architectures/65816-decoder.js";
import {
  applyCpu65816StateOverride,
  cpu65816DecodeState,
  cpu65816StateKey,
  emulationVectorCpu65816State,
  enterCpu65816Address,
  joinCpu65816States,
  nativeVectorCpu65816State,
  resetCpu65816State,
  transferCpu65816State,
  unknownCpu65816State,
  type Cpu65816AbstractState,
  type Cpu65816StateOverride,
} from "./65816-state.js";
import {
  createSnesAddressContext,
  identifySnesCpuAddress,
  identifySnesFileOffset,
  SNES_CPU_ADDRESS_SPACE,
  SNES_FILE_ADDRESS_SPACE,
} from "./address-identities.js";
import { identifySnesHardwareRegister } from "./hardware-registers.js";
import type { SnesMapper } from "./rom-header.js";

interface VectorDefinition {
  readonly name: string;
  readonly pointer: number;
  readonly state: "emulation" | "native" | "reset";
}

const VECTOR_DEFINITIONS: readonly VectorDefinition[] = [
  { name: "native-cop", pointer: 0x00ffe4, state: "native" },
  { name: "native-brk", pointer: 0x00ffe6, state: "native" },
  { name: "native-abort", pointer: 0x00ffe8, state: "native" },
  { name: "native-nmi", pointer: 0x00ffea, state: "native" },
  { name: "native-irq", pointer: 0x00ffee, state: "native" },
  { name: "emulation-cop", pointer: 0x00fff4, state: "emulation" },
  { name: "emulation-abort", pointer: 0x00fff8, state: "emulation" },
  { name: "emulation-nmi", pointer: 0x00fffa, state: "emulation" },
  { name: "reset", pointer: 0x00fffc, state: "reset" },
  { name: "emulation-irq-brk", pointer: 0x00fffe, state: "emulation" },
];

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
  "compressed",
  "asset",
  "empty",
  "text",
]);

const EVIDENCE_RANK: Readonly<Record<EvidenceRecord["source"], number>> = {
  detector: 0,
  static: 1,
  import: 2,
  runtime: 3,
  manual: 4,
};

/** Extra analysis seed beyond hardware vectors, labels, and `points: ["in"]` annotations. */
export interface Snes65816EntryPoint {
  /** Stable project id; used as `entry:<id>` in the worklist and evidence. */
  readonly id: string;
  /** 24-bit SNES CPU address. */
  readonly address: number;
  /** Optional known E/M/X/banks/D/S overlay applied after annotation state. */
  readonly state?: Cpu65816StateOverride;
  /** Evidence ids to attach; a synthetic `manual:entry:<id>` is created if omitted. */
  readonly evidence?: readonly string[];
}

/**
 * Project shards and worklist limits for `analyzeSnes65816`.
 * Data-classified intervals block decode; opcode/operand intervals are ignored
 * as input (the run rewrites `static:65816:*` annotations on the way out).
 */
export interface Snes65816AnalysisOptions extends StaticAnalysisLimits {
  /** Existing project intervals; `static:65816:*` ids are stripped then regenerated. */
  readonly annotations?: readonly IntervalAnnotation[];
  /** Named labels used as additional CFG seeds. */
  readonly labels?: readonly ProjectLabel[];
  /** Evidence records referenced by annotations, labels, and entry points. */
  readonly evidence?: readonly EvidenceRecord[];
  /** Configured entry points (overlays, engines, banked dispatch). */
  readonly entryPoints?: readonly Snes65816EntryPoint[];
  /** Named target collections; every address is seeded. */
  readonly targetSets?: readonly AnalysisTargetSetRecord[];
  /** Manual resolutions for indirect control-flow sites. */
  readonly targetOverrides?: readonly AnalysisTargetOverrideRecord[];
}

/** Worklist CFG plus project-shaped records, opcode/operand intervals, and run evidence. */
export interface Snes65816AnalysisResult extends StaticAnalysisResult<Cpu65816AbstractState> {
  /** CFG nodes/edges, functions, conflicts, unresolved flows, and a run summary. */
  readonly records: readonly AnalysisRecord[];
  /** Regenerated `static:65816:opcode:*` / `operand:*` file-offset intervals. */
  readonly annotations: readonly IntervalAnnotation[];
  /** Detector/static evidence created by this run (vectors and the run id). */
  readonly evidenceRecords: readonly EvidenceRecord[];
}

const vectorState = (kind: VectorDefinition["state"]): Cpu65816AbstractState => {
  if (kind === "reset") return resetCpu65816State();
  return kind === "native" ? nativeVectorCpu65816State() : emulationVectorCpu65816State();
};

const readVector = (rom: RomImage, mapper: SnesMapper, pointer: number): number | undefined => {
  const identity = identifySnesCpuAddress(pointer, createSnesAddressContext(mapper), rom.length);
  if (!identity) return undefined;
  const low = rom.readByte(identity.fileOffset);
  const high = rom.readByte(identity.fileOffset + 1);
  if (low === undefined || high === undefined) return undefined;
  const target = low | (high << 8);
  return target === 0 || target === 0xffff ? undefined : target;
};

const intervalContains = (annotation: IntervalAnnotation, offset: number): boolean =>
  annotation.addressSpace === SNES_FILE_ADDRESS_SPACE &&
  annotation.start <= offset &&
  offset < annotation.end;

const stateOverrideFor = (annotation: IntervalAnnotation): Cpu65816StateOverride | undefined => {
  if (!annotation.state) return undefined;
  return {
    ...(annotation.state.e === undefined ? {} : { e: annotation.state.e }),
    ...(annotation.state.m === undefined ? {} : { m: annotation.state.m }),
    ...(annotation.state.x === undefined ? {} : { x: annotation.state.x }),
    ...(annotation.state.carry === undefined ? {} : { carry: annotation.state.carry }),
    ...(annotation.state.programBank === undefined
      ? {}
      : { programBank: annotation.state.programBank }),
    ...(annotation.state.dataBank === undefined ? {} : { dataBank: annotation.state.dataBank }),
    ...(annotation.state.directPage === undefined
      ? {}
      : { directPage: annotation.state.directPage }),
    ...(annotation.state.stackPointer === undefined
      ? {}
      : { stackPointer: annotation.state.stackPointer }),
  };
};

const controlTargetKind = (
  kind: DecodedInstruction["references"][number]["kind"],
): "branch" | "call" | "jump" => {
  if (kind === "branch") return "branch";
  if (kind === "call") return "call";
  return "jump";
};

const controlsFor = (
  instruction: DecodedInstruction,
  interruptTargets: readonly number[],
): readonly StaticControlTarget[] => {
  const controls = instruction.references
    .filter(
      (reference) =>
        reference.kind === "branch" || reference.kind === "call" || reference.kind === "jump",
    )
    .map((reference): StaticControlTarget => ({
      kind: controlTargetKind(reference.kind),
      ...(reference.address === undefined ? {} : { address: reference.address }),
      ...(reference.indirect ? { indirect: true } : {}),
      ...(reference.address === undefined
        ? { explanation: "The decoded indirect target is not known statically." }
        : {}),
    }));
  if (instruction.flow.kind !== "interrupt") return controls;
  return interruptTargets.map((address) => ({
    kind: "interrupt",
    address,
    explanation: "Resolved from the applicable SNES interrupt vector.",
  }));
};

const isIndexedOrIndirect = (mode: string): boolean =>
  mode.includes("Indexed") || mode.includes("Indirect") || mode.startsWith("stackRelative");

const unresolvedAddressExplanation = (mode: string): string => {
  if (mode.startsWith("direct")) {
    return "Effective address is unresolved because direct page D is unknown.";
  }
  if (mode.startsWith("absolute")) {
    return "Effective address is unresolved because DBR or an indirect target is unknown.";
  }
  return "Effective address is unresolved.";
};

const mappedAddressExplanation = (
  indexed: boolean,
  identity: ReturnType<typeof identifySnesCpuAddress>,
): string => {
  if (indexed) {
    return "The encoded address is only a base; an index register or indirection prevents a static effective address.";
  }
  if (identity) {
    return `CPU address maps to ROM file offset $${identity.fileOffset.toString(16).padStart(6, "0")}.`;
  }
  return "CPU address does not map to the loaded ROM.";
};

const effectiveAddressesFor = (
  instruction: DecodedInstruction,
  mapper: SnesMapper,
  romSize: number,
): readonly StaticEffectiveAddress[] =>
  instruction.references
    .filter((reference) => reference.kind === "data" || reference.kind === "pointer")
    .map((reference): StaticEffectiveAddress => {
      const operandIndex = reference.operandIndex ?? 0;
      if (reference.address === undefined) {
        return {
          operandIndex,
          volatile: false,
          explanation: unresolvedAddressExplanation(instruction.mode),
        };
      }
      const indexed = isIndexedOrIndirect(instruction.mode);
      const hardware = identifySnesHardwareRegister(reference.address);
      if (hardware) {
        return {
          operandIndex,
          ...(indexed ? { baseAddress: reference.address } : { address: reference.address }),
          symbol: hardware.symbol,
          volatile: true,
          explanation: indexed
            ? `${hardware.symbol} is the base of an indexed/indirect volatile hardware access; the final address is unresolved.`
            : `${hardware.symbol} is volatile SNES hardware memory and is never treated as ROM.`,
        };
      }
      const identity = indexed
        ? undefined
        : identifySnesCpuAddress(reference.address, createSnesAddressContext(mapper), romSize);
      return {
        operandIndex,
        ...(indexed ? { baseAddress: reference.address } : { address: reference.address }),
        volatile: false,
        ...(identity ? { romOffset: identity.fileOffset } : {}),
        explanation: mappedAddressExplanation(indexed, identity),
      };
    });

const knownBoolean = (value: Cpu65816AbstractState["m"]): boolean | undefined =>
  value.kind === "known" && (value.value === 0 || value.value === 1)
    ? value.value === 1
    : undefined;

const knownNumber = (value: Cpu65816AbstractState["d"]): number | undefined =>
  value.kind === "known" ? value.value : undefined;

const annotationState = (
  state: Cpu65816AbstractState,
): NonNullable<IntervalAnnotation["state"]> => ({
  ...(knownBoolean(state.e) === undefined ? {} : { e: knownBoolean(state.e)! }),
  ...(knownBoolean(state.m) === undefined ? {} : { m: knownBoolean(state.m)! }),
  ...(knownBoolean(state.x) === undefined ? {} : { x: knownBoolean(state.x)! }),
  ...(knownBoolean(state.carry) === undefined ? {} : { carry: knownBoolean(state.carry)! }),
  ...(knownNumber(state.pbr) === undefined ? {} : { programBank: knownNumber(state.pbr)! }),
  ...(knownNumber(state.dbr) === undefined ? {} : { dataBank: knownNumber(state.dbr)! }),
  ...(knownNumber(state.d) === undefined ? {} : { directPage: knownNumber(state.d)! }),
  ...(knownNumber(state.s) === undefined ? {} : { stackPointer: knownNumber(state.s)! }),
});

const recordsFor = (
  result: StaticAnalysisResult<Cpu65816AbstractState>,
  runEvidence: string,
): readonly AnalysisRecord[] => [
  ...result.nodes.map((node): AnalysisRecord => ({
    id: `static:${node.id}`,
    kind: "cfg-node",
    addressSpace: SNES_CPU_ADDRESS_SPACE,
    address: node.address,
    fileOffset: node.fileOffset,
    size: node.size,
    opcode: node.opcode,
    specificationId: node.specificationId,
    mnemonic: node.mnemonic,
    mode: node.mode,
    context: node.context,
    incomingState: node.incomingState as unknown as Readonly<Record<string, unknown>>,
    outgoingState: node.outgoingState as unknown as Readonly<Record<string, unknown>>,
    effectiveAddresses: node.effectiveAddresses as unknown as readonly Readonly<
      Record<string, unknown>
    >[],
    entryPoint: node.entryPoint,
    evidencePath: node.evidencePath.map((id) => `static:${id}`),
    evidence: [...new Set([...node.evidence, runEvidence])].sort(),
  })),
  ...result.edges.map((edge): AnalysisRecord => ({
    id: `static:${edge.id}`,
    kind: "cfg-edge",
    addressSpace: SNES_CPU_ADDRESS_SPACE,
    from: `static:${edge.from}`,
    fromAddress: edge.fromAddress,
    ...(edge.to ? { to: `static:${edge.to}` } : {}),
    ...(edge.toAddress === undefined ? {} : { toAddress: edge.toAddress }),
    edgeKind: edge.kind,
    indirect: edge.indirect,
    ...(edge.override ? { override: edge.override } : {}),
    ...(edge.explanation ? { explanation: edge.explanation } : {}),
    evidence: [...new Set([...edge.evidence, runEvidence])].sort(),
  })),
  ...result.functions.map((fn): AnalysisRecord => ({
    id: `static:${fn.id}`,
    kind: "function",
    addressSpace: SNES_CPU_ADDRESS_SPACE,
    address: fn.address,
    source: fn.source,
    evidencePath: fn.evidencePath.map((id) => `static:${id}`),
    evidence: [...new Set([...fn.evidence, runEvidence])].sort(),
  })),
  ...result.conflicts.map((conflict): AnalysisRecord => ({
    id: `static:${conflict.id}`,
    kind: "conflict",
    addressSpace: SNES_CPU_ADDRESS_SPACE,
    address: conflict.address,
    conflictKind: conflict.kind,
    message: conflict.message,
    nodes: conflict.nodes.map((id) => `static:${id}`),
    evidence: [...new Set([...conflict.evidence, runEvidence])].sort(),
  })),
  ...result.unresolved.map((flow): AnalysisRecord => ({
    id: `static:${flow.id}`,
    kind: "unresolved",
    addressSpace: SNES_CPU_ADDRESS_SPACE,
    address: flow.address,
    flowKind: flow.kind,
    indirect: flow.indirect,
    reason: flow.reason,
    evidence: [...new Set([...flow.evidence, runEvidence])].sort(),
  })),
  {
    id: "static:65816:summary",
    kind: "summary",
    architecture: "snes.65816",
    status: result.status,
    coverage: result.coverage as unknown as Readonly<Record<string, number>>,
    processedWorkItems: result.processedWorkItems,
    incompleteReasons: result.incompleteReasons as unknown as readonly Readonly<
      Record<string, unknown>
    >[],
    evidence: [runEvidence],
  },
];

const annotationsFor = (
  result: StaticAnalysisResult<Cpu65816AbstractState>,
  runEvidence: string,
): readonly IntervalAnnotation[] => {
  const output = new Map<string, IntervalAnnotation>();
  const stateByOffset = new Map<number, Cpu65816AbstractState>();
  for (const node of result.nodes) {
    const previous = stateByOffset.get(node.fileOffset);
    stateByOffset.set(
      node.fileOffset,
      previous ? joinCpu65816States(previous, node.incomingState) : node.incomingState,
    );
  }
  for (const node of result.nodes) {
    const evidence = [...new Set([...node.evidence, runEvidence])].sort();
    const state = annotationState(stateByOffset.get(node.fileOffset) ?? node.incomingState);
    const opcodeId = `static:65816:opcode:${node.fileOffset.toString(16).padStart(6, "0")}`;
    const priorOpcode = output.get(opcodeId);
    output.set(opcodeId, {
      id: opcodeId,
      addressSpace: SNES_FILE_ADDRESS_SPACE,
      start: node.fileOffset,
      end: node.fileOffset + 1,
      classification: "opcode",
      architecture: "snes.65816",
      ...(Object.keys(state).length === 0 ? {} : { state }),
      evidence: [...new Set([...(priorOpcode?.evidence ?? []), ...evidence])].sort(),
    });
    if (node.size > 1) {
      const operandId = `static:65816:operand:${node.fileOffset.toString(16).padStart(6, "0")}`;
      const priorOperand = output.get(operandId);
      output.set(operandId, {
        id: operandId,
        addressSpace: SNES_FILE_ADDRESS_SPACE,
        start: node.fileOffset + 1,
        end: node.fileOffset + node.size,
        classification: "operand",
        architecture: "snes.65816",
        evidence: [...new Set([...(priorOperand?.evidence ?? []), ...evidence])].sort(),
      });
    }
  }
  return [...output.values()].sort(
    (left, right) => left.start - right.start || left.id.localeCompare(right.id),
  );
};

/**
 * Runs conservative 65816 CFG analysis over a headerless immutable ROM view.
 * Seeds from RESET/interrupt vectors, labels, `points: ["in"]` annotations,
 * configured entry points, and target sets. Data-classified intervals block
 * decode; hardware I/O is never treated as ROM.
 * @param {RomImage} rom Immutable ROM content and identity.
 * @param {SnesMapper} mapper Explicitly detected or user-selected SNES mapper.
 * @param {Snes65816AnalysisOptions} [options] Project annotations, seeds, overrides, and deterministic limits.
 * @returns {Snes65816AnalysisResult} Static CFG, abstract states, project records, annotations, and evidence.
 */
export const analyzeSnes65816 = (
  rom: RomImage,
  mapper: SnesMapper,
  options: Snes65816AnalysisOptions = {},
): Snes65816AnalysisResult => {
  const context = createSnesAddressContext(mapper);
  const decoder = new Cpu65816Decoder();
  const source = new Uint8ArrayDecoderSource(rom.bytes());
  const evidenceById = new Map((options.evidence ?? []).map((record) => [record.id, record]));
  const annotations = (options.annotations ?? []).filter(
    (annotation) => !annotation.id.startsWith("static:65816:"),
  );
  const runEvidence = `static:65816:${rom.identity.contentSha256}`;
  const explicitStateOverrides = new Map<number, Cpu65816StateOverride>();
  const conflictingExplicitStateOverrides = new Set<number>();
  for (const entry of options.entryPoints ?? []) {
    if (!entry.state || conflictingExplicitStateOverrides.has(entry.address)) continue;
    const existing = explicitStateOverrides.get(entry.address);
    if (!existing) explicitStateOverrides.set(entry.address, entry.state);
    else if (JSON.stringify(existing) !== JSON.stringify(entry.state)) {
      explicitStateOverrides.delete(entry.address);
      conflictingExplicitStateOverrides.add(entry.address);
    }
  }
  const evidenceRecords = new Map<string, EvidenceRecord>();
  evidenceRecords.set(runEvidence, {
    id: runEvidence,
    source: "static",
    sourceId: "snes.65816.static-v1",
    confidence: "high",
    detail: `Conservative 65816 analysis of ${rom.identity.contentSha256}`,
  });

  const seeds: StaticAnalysisSeed<Cpu65816AbstractState>[] = [];
  for (const vector of VECTOR_DEFINITIONS) {
    const target = readVector(rom, mapper, vector.pointer);
    if (target === undefined) continue;
    const evidenceId = `detector:vector:${vector.name}`;
    evidenceRecords.set(evidenceId, {
      id: evidenceId,
      source: "detector",
      sourceId: `snes-vector-$${vector.pointer.toString(16).padStart(6, "0")}`,
      confidence: "certain",
      detail: `${vector.name} vector points to $${target.toString(16).padStart(6, "0")}.`,
    });
    seeds.push({
      id: `vector:${vector.name}`,
      address: target,
      kind: "vector",
      state: vectorState(vector.state),
      evidence: [evidenceId],
      detail: vector.name,
    });
  }

  const stateAtAddress = (
    base: Cpu65816AbstractState,
    address: number,
  ): {
    readonly state: Cpu65816AbstractState;
    readonly evidence: readonly string[];
  } => {
    const identity = identifySnesCpuAddress(address, context, rom.length);
    if (!identity) return { state: base, evidence: [] };
    const matching = annotations
      .filter((annotation) => intervalContains(annotation, identity.fileOffset) && annotation.state)
      .map((annotation) => ({
        annotation,
        rank: Math.max(
          0,
          ...annotation.evidence.map(
            (id) => EVIDENCE_RANK[evidenceById.get(id)?.source ?? "detector"],
          ),
        ),
      }))
      .sort(
        (left, right) =>
          left.rank - right.rank || left.annotation.id.localeCompare(right.annotation.id),
      );
    let state = base;
    const consumed: string[] = [];
    const ranks = [...new Set(matching.map((entry) => entry.rank))].sort((a, b) => a - b);
    for (const rank of ranks) {
      const ranked = matching.filter((entry) => entry.rank === rank);
      const candidates = ranked
        .map(({ annotation }) => {
          const override = stateOverrideFor(annotation);
          return override ? applyCpu65816StateOverride(state, override) : undefined;
        })
        .filter((candidate): candidate is Cpu65816AbstractState => candidate !== undefined);
      if (candidates.length > 0) {
        state = candidates.reduce((left, right) => joinCpu65816States(left, right));
      }
      consumed.push(...ranked.flatMap(({ annotation }) => annotation.evidence));
    }
    return { state, evidence: [...new Set(consumed)].sort() };
  };

  const projectAddress = (addressSpace: string, address: number): number | undefined => {
    if (addressSpace === SNES_CPU_ADDRESS_SPACE) return address;
    if (addressSpace === SNES_FILE_ADDRESS_SPACE) {
      return identifySnesFileOffset(address, context, rom.length)?.address;
    }
    return undefined;
  };

  for (const label of options.labels ?? []) {
    const address = projectAddress(label.addressSpace, label.address);
    if (address === undefined) continue;
    const seeded = stateAtAddress(unknownCpu65816State(), address);
    seeds.push({
      id: `label:${label.id}`,
      address,
      kind: "imported-label",
      state: seeded.state,
      evidence: [...new Set([...label.evidence, ...seeded.evidence])].sort(),
      detail: label.name,
    });
  }

  for (const annotation of annotations) {
    if (!annotation.points?.includes("in")) continue;
    const address = projectAddress(annotation.addressSpace, annotation.start);
    if (address === undefined) continue;
    const seeded = stateAtAddress(unknownCpu65816State(), address);
    seeds.push({
      id: `point:${annotation.id}`,
      address,
      kind: "manual",
      state: seeded.state,
      evidence: [...new Set([...annotation.evidence, ...seeded.evidence])].sort(),
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
        detail: `Configured entry point $${entry.address.toString(16).padStart(6, "0")}.`,
      });
    }
    const seeded = stateAtAddress(unknownCpu65816State(), entry.address);
    seeds.push({
      id: `entry:${entry.id}`,
      address: entry.address,
      kind: "configured",
      state: applyCpu65816StateOverride(seeded.state, entry.state ?? {}),
      evidence: [...new Set([...(entry.evidence ?? [evidenceId]), ...seeded.evidence])].sort(),
    });
  }

  for (const targetSet of options.targetSets ?? []) {
    for (const address of targetSet.targets) {
      const seeded = stateAtAddress(unknownCpu65816State(), address);
      seeds.push({
        id: `target-set:${targetSet.id}:${address.toString(16)}`,
        address,
        kind: "target-set",
        state: seeded.state,
        evidence: [...new Set([...targetSet.evidence, ...seeded.evidence])].sort(),
      });
    }
  }

  const targetOverrides: StaticTargetOverride[] = (options.targetOverrides ?? []).map(
    (override) => ({
      id: override.id,
      address: override.address,
      targets: [...override.targets].sort((left, right) => left - right),
      evidence: override.evidence,
    }),
  );

  const interruptTargetsFor = (
    instruction: DecodedInstruction,
    state: Cpu65816AbstractState,
  ): readonly number[] => {
    if (instruction.flow.kind !== "interrupt") return [];
    const mnemonic = instruction.mnemonic;
    const possiblePointers: number[] = [];
    if (state.e.kind !== "known" || state.e.value === 0) {
      possiblePointers.push(mnemonic === "COP" ? 0x00ffe4 : 0x00ffe6);
    }
    if (state.e.kind !== "known" || state.e.value === 1) {
      possiblePointers.push(mnemonic === "COP" ? 0x00fff4 : 0x00fffe);
    }
    return possiblePointers
      .map((pointer) => readVector(rom, mapper, pointer))
      .filter((target): target is number => target !== undefined);
  };

  const result = analyzeStaticControlFlow<Cpu65816AbstractState>(
    {
      backingSize: rom.length,
      enterAddress: (state, address) => {
        const annotated = stateAtAddress(enterCpu65816Address(state, address), address).state;
        const explicit = explicitStateOverrides.get(address);
        return explicit ? applyCpu65816StateOverride(annotated, explicit) : annotated;
      },
      join: joinCpu65816States,
      stateKey: cpu65816StateKey,
      transfer: transferCpu65816State,
      decode: (address, state) => {
        const identity = identifySnesCpuAddress(address, context, rom.length);
        if (!identity) return { kind: "error", reason: "Address does not map into the ROM." };
        const blocked = annotations.find(
          (annotation) =>
            intervalContains(annotation, identity.fileOffset) &&
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
          offset: identity.fileOffset,
          logicalAddress: address,
          state: cpu65816DecodeState(state),
        });
        if (decoded.kind === "ambiguous") {
          return {
            kind: "ambiguous",
            reason: decoded.reason,
            requiredState: decoded.requiredState,
          };
        }
        if (decoded.kind === "error") return { kind: "error", reason: decoded.message };
        const instruction = decoded.instruction;
        const crossing = annotations.find(
          (annotation) =>
            DATA_CLASSIFICATIONS.has(annotation.classification) &&
            Array.from(
              { length: instruction.size },
              (_, index) => identity.fileOffset + index,
            ).some((offset) => intervalContains(annotation, offset)),
        );
        if (crossing) {
          return {
            kind: "blocked",
            reason: `Instruction crosses '${crossing.classification}' region '${crossing.id}'.`,
            evidence: crossing.evidence,
          };
        }
        const overrideEvidence = stateAtAddress(state, address).evidence;
        const normalized: StaticInstruction = {
          specificationId: instruction.specificationId,
          address,
          fileOffset: identity.fileOffset,
          size: instruction.size,
          opcode: instruction.opcode,
          mnemonic: instruction.mnemonic,
          mode: instruction.mode,
          effects: instruction.effects,
          evidence: overrideEvidence,
          flow: instruction.flow,
          targets: controlsFor(instruction, interruptTargetsFor(instruction, state)),
          effectiveAddresses: effectiveAddressesFor(instruction, mapper, rom.length),
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
    evidenceRecords: [...evidenceRecords.values()].sort((left, right) =>
      left.id.localeCompare(right.id),
    ),
  };
};

import fs from "node:fs";

import {
  RomImage,
  publishAnalysisProject,
  openAnalysisProjectStore,
  loadAnalysisProjectViewSnapshot,
  commitAnalysisProjectViewUpdate,
  assertAnalysisProjectRevision,
  validateProjectRom,
  type AnalysisProject,
  type AnalysisRecord,
  type IntervalAnnotation,
  type ResearchSnapshot,
  lostCodeRanges,
  type StaticAnalysisSeed,
} from "@uttori/asm-disassembler";

import { analyzeNes, type NesAnalysisState } from "./analysis.js";
import { NesCartridge } from "./cartridge.js";
import { validateNesMapper } from "./mapper.js";
import { nesResearchInputs } from "./research.js";

/** Explicit iNES ingestion preserves the full-file identity and the ares-compatible payload identity. */
export function loadNesRom(file: string): { cartridge: NesCartridge; rom: RomImage } {
  const bytes = fs.readFileSync(file);
  const cartridge = new NesCartridge(bytes);
  validateNesMapper(cartridge);
  return {
    cartridge,
    rom: new RomImage(bytes, { sourcePath: file, container: { format: "ines", headerSize: 16 } }),
  };
}

/** Creates only the private evidence store; source project publication is owned by the CLI. */
export function createNesAnalysisProject(projectDirectory: string, romFile: string) {
  const { cartridge, rom } = loadNesRom(romFile);
  const project: AnalysisProject = {
    manifest: {
      format: "uttori-asm-analysis",
      schemaVersion: 3,
      target: "65xx.nes",
      rom: rom.identity,
      mapping: { mapper: `ines:${cartridge.mapper}`, source: "detected", candidates: [] },
      addressSpaces: [
        { id: "nes.file", name: "Cartridge payload offset", addressBits: 32, kind: "file" },
        { id: "nes.cpu", name: "NES CPU bus", addressBits: 16, kind: "cpu" },
        { id: "nes.ram", name: "CPU RAM", addressBits: 11, kind: "memory" },
        { id: "nes.prg-ram", name: "Cartridge RAM", addressBits: 32, kind: "memory" },
      ],
    },
    shards: {
      analysis: [],
      annotations: [],
      labels: [],
      comments: [],
      regions: [],
      runtime: [],
      evidence: [],
      imports: [],
    },
  };
  return publishAnalysisProject(projectDirectory, project).manifest;
}

/** Reanalysis preserves manual decisions and publishes atomically against the exact prior evidence revision. */
export function analyzeNesProject(options: {
  readonly projectDirectory: string;
  readonly romFile: string;
  readonly research?: ResearchSnapshot;
  readonly assertResearchCurrent?: () => void;
  readonly signal?: AbortSignal;
  readonly maxWorkItems?: number;
  readonly maxCallDepth?: number;
  readonly onProgress?: (progress: { message: string }) => void;
  readonly seeds?: readonly StaticAnalysisSeed<NesAnalysisState>[];
}) {
  options.signal?.throwIfAborted();
  const { cartridge, rom } = loadNesRom(options.romFile);
  const loaded = loadAnalysisProjectViewSnapshot(options.projectDirectory);
  validateProjectRom(loaded.manifest, rom);
  const seeds: StaticAnalysisSeed<NesAnalysisState>[] = [...(options.seeds ?? [])];
  const runtime = openAnalysisProjectStore(options.projectDirectory);
  try {
    const fields = [
      "mapper",
      "select",
      "prgMode",
      "chrMode",
      "ramEnabled",
      "ramWritable",
      "mirroring",
      "irqLatch",
      "irqEnabled",
      "prg0",
      "prg1",
      "prg2",
      ...Array.from({ length: 8 }, (_, i) => `r${i}`),
    ];
    for (const record of runtime.runtimeInstructionVariants("65xx.2a03", "nes.cpu", fields)) {
      options.signal?.throwIfAborted();
      if (record.kind !== "runtime-instruction") {
        continue;
      }
      const captured = record.state;
      const physical = captured.prg0;
      // RAM/self-modified code stays runtime evidence. Never reinterpret it as original ROM source.
      if (
        typeof physical !== "number" ||
        physical === 0xffffffff ||
        captured.mapper !== cartridge.mapper
      ) {
        continue;
      }
      if (
        record.bytes.some(
          (byte, i) =>
            captured[`prg${i}`] !== physical + i || cartridge.readPrg(physical + i) !== byte,
        )
      ) {
        continue;
      }
      const numeric = (key: string): number | null =>
        typeof captured[key] === "number" ? captured[key] : null;
      const flag = (key: string): boolean | null =>
        numeric(key) === null ? null : numeric(key) === 1;
      seeds.push({
        id: record.id,
        kind: "observation",
        address: record.address,
        state: {
          a: null,
          x: null,
          y: null,
          mapper: {
            select: numeric("select"),
            prgMode: numeric("prgMode"),
            chrMode: numeric("chrMode"),
            banks: Array.from({ length: 8 }, (_, i) => numeric(`r${i}`)),
            ramEnabled: flag("ramEnabled"),
            ramWritable: flag("ramWritable"),
            mirroring: numeric("mirroring"),
            irqLatch: numeric("irqLatch"),
            irqEnabled: flag("irqEnabled"),
          },
        },
        evidence: record.evidence,
      });
    }
  } finally {
    runtime.close();
  }
  const research = nesResearchInputs(cartridge, loaded.view);
  seeds.push(...research.seeds);
  const result = analyzeNes(cartridge, {
    ...options,
    seeds,
    annotations: research.annotations,
    targetOverrides: research.targetOverrides,
    onProgress: ({ processedWorkItems }) => {
      options.signal?.throwIfAborted();
      options.onProgress?.({ message: `NES analysis: ${processedWorkItems} work items.` });
    },
  });
  const evidence = {
    id: "nes:analysis",
    source: "static" as const,
    sourceId: "nes.static-v1",
    confidence: "high" as const,
    detail:
      "Conservative NMOS analysis with ares initial MMC3 mapping; unresolved mappings stop discovery.",
  };
  const payload = rom.bytes();
  const records: AnalysisRecord[] = result.nodes.map((node) => ({
    ...node,
    id: `nes:${node.id}`,
    kind: "cfg-node",
    addressSpace: "nes.cpu",
    bytes: [...payload.subarray(node.fileOffset, node.fileOffset + node.size)],
    incomingState: { ...node.incomingState },
    outgoingState: { ...node.outgoingState },
    effectiveAddresses: node.effectiveAddresses.map((address) => ({ ...address })),
    evidence: [...new Set([evidence.id, ...node.evidence])],
    evidencePath: node.evidencePath.map((id) => `nes:${id}`),
  }));
  records.push(
    ...result.edges
      .filter((edge) => result.nodes.some((node) => node.id === edge.from))
      .map((edge): AnalysisRecord => ({
        id: `nes:${edge.id}`,
        kind: "cfg-edge",
        addressSpace: "nes.cpu",
        from: `nes:${edge.from}`,
        fromAddress: edge.fromAddress,
        ...(edge.to && result.nodes.some((node) => node.id === edge.to)
          ? { to: `nes:${edge.to}` }
          : {}),
        toAddress: edge.toAddress,
        edgeKind: edge.kind,
        indirect: edge.indirect,
        evidence: [...new Set([evidence.id, ...edge.evidence])],
      })),
  );
  records.push(
    ...result.functions.map((fn): AnalysisRecord => ({
      ...fn,
      id: `nes:${fn.id}`,
      kind: "function",
      addressSpace: "nes.cpu",
      evidence: [evidence.id],
      evidencePath: fn.evidencePath.map((id) => `nes:${id}`),
    })),
  );
  records.push(
    ...result.unresolved.map((flow): AnalysisRecord => ({
      id: `nes:${flow.id}`,
      kind: "unresolved",
      addressSpace: "nes.cpu",
      address: flow.address,
      flowKind: flow.kind,
      indirect: flow.indirect,
      reason: flow.reason,
      evidence: [evidence.id],
    })),
  );
  records.push(
    ...result.conflicts.map((conflict): AnalysisRecord => ({
      id: `nes:${conflict.id}`,
      kind: "conflict",
      addressSpace: "nes.cpu",
      address: conflict.address,
      conflictKind: conflict.kind,
      message: conflict.message,
      nodes: conflict.nodes.map((id) => `nes:${id}`),
      evidence: [evidence.id],
    })),
    {
      id: "nes:summary",
      kind: "summary",
      architecture: "65xx.2a03",
      status: result.status,
      coverage: { ...result.coverage },
      processedWorkItems: result.processedWorkItems,
      incompleteReasons: result.incompleteReasons.map((reason) => ({ ...reason })),
      evidence: [evidence.id],
    },
  );
  const annotations = new Map<string, IntervalAnnotation>();
  for (const node of result.nodes) {
    const id = `nes:opcode:${node.fileOffset}`;
    annotations.set(id, {
      id,
      addressSpace: "nes.file",
      start: node.fileOffset,
      end: node.fileOffset + 1,
      classification: "opcode",
      architecture: "65xx.2a03",
      evidence: [evidence.id],
    });
    if (node.size > 1) {
      annotations.set(`${id}:operand`, {
        id: `${id}:operand`,
        addressSpace: "nes.file",
        start: node.fileOffset + 1,
        end: node.fileOffset + node.size,
        classification: "operand",
        architecture: "65xx.2a03",
        evidence: [evidence.id],
      });
    }
  }
  const updates = {
    analysis: [
      ...loaded.view.analysis.filter((record) => !record.id.startsWith("nes:")),
      ...records,
    ],
    annotations: [
      ...loaded.view.annotations.filter((record) => !record.id.startsWith("nes:")),
      ...annotations.values(),
    ],
    comments: loaded.view.comments,
    evidence: [...loaded.view.evidence.filter((record) => record.id !== evidence.id), evidence],
  };
  options.signal?.throwIfAborted();
  if (options.research) {
    const store = openAnalysisProjectStore(options.projectDirectory);
    try {
      store.transaction(() => {
        options.assertResearchCurrent?.();
        assertAnalysisProjectRevision(store, loaded.revision);
        const projected = store.replaceResearchAnalysis(options.research!, updates);
        store.validateView({ ...loaded.view, ...updates, ...projected, runtime: [] });
      });
      store.writePointer(options.projectDirectory);
    } finally {
      store.close();
    }
  } else {
    commitAnalysisProjectViewUpdate(options.projectDirectory, loaded, updates);
  }
  const previous = loaded.view.analysis
    .filter((record) => record.kind === "cfg-node")
    .filter((record) => record.fileOffset !== undefined)
    .map((record) => ({ start: record.fileOffset!, end: record.fileOffset! + record.size }));
  const addedCode = lostCodeRanges(
    result.nodes.map((node) => ({ start: node.fileOffset, end: node.fileOffset + node.size })),
    previous,
  ).map((range) => {
    const node = result.nodes.find(
      (candidate) =>
        candidate.fileOffset <= range.start && candidate.fileOffset + candidate.size > range.start,
    )!;
    return {
      ...range,
      addressSpace: "nes.cpu",
      address: node.address,
      recordIds: [`nes:${node.id}`],
    };
  });
  return {
    status: result.status,
    instructions: result.nodes.length,
    conflicts: result.conflicts.length,
    unresolved: result.unresolved.length,
    processedWorkItems: result.processedWorkItems,
    incompleteReasons: result.incompleteReasons,
    addedCode,
    coverage: result.coverage,
  };
}

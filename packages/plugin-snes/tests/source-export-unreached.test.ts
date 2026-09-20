import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  RomImage,
  openAnalysisProjectStore,
  writeAnalysisProject,
  type AnalysisProject,
  type IntervalAnnotation,
  type RuntimeInstructionRecord,
} from "@uttori/asm-disassembler";

import { test } from "../../../tests/ava-helper.js";
import { verifySnesProjectRoundTrip } from "../src/disassembler/project-initializer.js";
import { analyzeSnesRuntimeCode } from "../src/disassembler/runtime-code.js";
import { exportSnes65816Source } from "../src/disassembler/source-export.js";

/** Complete instruction observations. LoROM bank aliases intentionally share physical bytes. */
const capture = (
  id: string,
  address: number,
  bytes: readonly number[],
  p = 0x10,
): RuntimeInstructionRecord => ({
  id,
  kind: "runtime-instruction",
  architecture: "snes.65816",
  addressSpace: "snes.cpu",
  address,
  bytes,
  state: { e: 0, p, d: 0, db: 0 },
  count: 1,
  evidence: ["trace"],
});

/** Imported negative coverage spans the observed reset entry and its unobserved return byte. */
const annotation = (
  classification: IntervalAnnotation["classification"],
  start = 0,
  end = 6,
): IntervalAnnotation => ({
  id: `import:${classification}`,
  addressSpace: "rom.file",
  start,
  end,
  classification,
  architecture: "snes.65816",
  evidence: ["legacy"],
});

/** ROM-backed runtime analysis with an independently retained, older coverage annotation. */
const fixture = (
  bytes: readonly number[] = [0x18, 0x22, 0x10, 0x00, 0xc1, 0x60],
  runtime: readonly RuntimeInstructionRecord[] = [
    capture("clear-carry", 0x008000, [0x18]),
    capture("boot-call", 0x808001, [0x22, 0x10, 0x00, 0xc1]),
  ],
): { rom: RomImage; project: AnalysisProject } => {
  const content = new Uint8Array(0x8000).fill(0xea);
  content.set(bytes);
  const rom = new RomImage(content, { headerSize: 0 });
  const project: AnalysisProject = {
    manifest: {
      format: "uttori-asm-analysis",
      schemaVersion: 3,
      target: "snes.sfc",
      rom: rom.identity,
      mapping: { mapper: "lorom", source: "override", candidates: [] },
      addressSpaces: [
        { id: "snes.cpu", name: "CPU", kind: "cpu", addressBits: 24 },
        { id: "rom.file", name: "ROM", kind: "file", addressBits: 24 },
      ],
    },
    shards: {
      analysis: [],
      annotations: [annotation("unreached")],
      runtime,
      evidence: [
        { id: "trace", source: "runtime", sourceId: "fixture", confidence: "certain" },
        { id: "legacy", source: "import", sourceId: "dizraw", confidence: "high" },
      ],
      labels: [],
      comments: [],
      regions: [],
      imports: [],
    },
  };
  return {
    rom,
    project: {
      ...project,
      shards: {
        ...project.shards,
        analysis: analyzeSnesRuntimeCode(project.shards, rom, "lorom"),
      },
    },
  };
};

const options = { sourceProjectSha256: "a".repeat(64) };

test("captured ROM instructions supersede unreached in memory and SQL without promoting static guesses", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-unreached-"));
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  const { rom, project } = fixture();
  // Simulate static propagation carrying the same trace provenance. Only the executed prefix
  // may override unreached. The statically decoded RTS at offset 5 must stay raw.
  const staticAnalysis = analyzeSnesRuntimeCode(project.shards, rom, "lorom", [
    capture("static-return", 0x808005, [0x60]),
  ])
    .filter((record) => record.kind === "cfg-node")
    .map((record) => ({
      ...record,
      id: "static:cfg:808005",
      entryPoint: "entry:static",
      evidencePath: ["static:cfg:808005"],
    }));
  const input = {
    ...project,
    shards: { ...project.shards, analysis: [...project.shards.analysis, ...staticAnalysis] },
  };
  const original = structuredClone(input);
  const sourceDirectory = path.join(directory, "source");
  const exported = exportSnes65816Source(input, rom, sourceDirectory, options);
  t.deepEqual(
    exported.spans.filter((span) => span.role === "code").map(({ start, end }) => [start, end]),
    [
      [0, 1],
      [1, 5],
    ],
  );
  t.is(exported.spans.find((span) => span.start === 5)?.role, "raw");
  const source = fs.readFileSync(path.join(sourceDirectory, "banks/bank-000.asm"), "utf8");
  t.regex(source, /\bCLC\b/);
  t.regex(source, /JSL\.l \$C10010/);
  t.deepEqual(input, original, "export preserves imported classifications and capture provenance");

  const romFile = path.join(directory, "rom.sfc");
  fs.writeFileSync(romFile, rom.bytes());
  t.true(
    (await verifySnesProjectRoundTrip({ sourceDirectory, romFile, emitDebugMap: false })).comparison
      .equal,
  );

  const analysisDirectory = path.join(directory, "analysis");
  writeAnalysisProject(analysisDirectory, input);
  const store = openAnalysisProjectStore(analysisDirectory);
  try {
    store.prepareAnnotationQueries();
    const streamed = store.transaction(
      () =>
        exportSnes65816Source(store.sourceExportView(), rom, sourceDirectory, {
          ...options,
          instructionGroups: store.instructionExportGroups(),
        }),
      false,
    );
    t.deepEqual(
      streamed,
      exported,
      "SQL projection retains the runtime proof without loading trace history",
    );
  } finally {
    store.close();
  }
});

test("stale unreached interval boundaries cannot split an accepted instruction", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-unreached-boundaries-"));
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  const { rom, project } = fixture();
  const input = {
    ...project,
    shards: {
      ...project.shards,
      annotations: [
        annotation("unreached", 0, 2),
        { ...annotation("unreached", 2, 6), id: "import:unreached-operands" },
      ],
    },
  };
  const exported = exportSnes65816Source(input, rom, directory, options);
  t.deepEqual(
    exported.spans.filter((span) => span.role === "code").map(({ start, end }) => [start, end]),
    [
      [0, 1],
      [1, 5],
    ],
  );
  t.is(exported.spans.find((span) => span.start === 5)?.role, "raw");
});

test("observed code cannot override positive data classifications even inside an operand", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-data-veto-"));
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  const { rom, project } = fixture();
  const classifications: IntervalAnnotation["classification"][] = [
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
  ];
  for (const classification of classifications) {
    const input = {
      ...project,
      shards: {
        ...project.shards,
        annotations: [...project.shards.annotations, annotation(classification, 2, 3)],
      },
    };
    const result = exportSnes65816Source(input, rom, path.join(directory, classification), options);
    t.deepEqual(
      result.spans.filter((span) => span.role === "code").map(({ start, end }) => [start, end]),
      [[0, 1]],
      classification,
    );
  }
});

test("unreached override still requires runtime provenance and ROM-matched captured bytes", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-unreached-proof-"));
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  const { rom, project } = fixture([0xea], [capture("mismatch", 0x808000, [0x18])]);
  const mismatch = exportSnes65816Source(project, rom, path.join(directory, "mismatch"), options);
  t.false(mismatch.spans.some((span) => span.role === "code"));
  const matched = fixture();
  const noProof = {
    ...matched.project,
    shards: {
      ...matched.project.shards,
      evidence: matched.project.shards.evidence.map((record) => ({
        ...record,
        source: "import" as const,
      })),
    },
  };
  const unproven = exportSnes65816Source(
    noProof,
    matched.rom,
    path.join(directory, "no-proof"),
    options,
  );
  t.false(unproven.spans.some((span) => span.role === "code"));
});

test("unreached override cannot bypass incompatible captured widths or overlapping instructions", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-unreached-conflict-"));
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  const conflicting = fixture(
    [0xa9, 0x18, 0x60],
    [
      capture("short", 0x808000, [0xa9, 0x18], 0x20),
      capture("long", 0x808000, [0xa9, 0x18, 0x60], 0),
    ],
  );
  const conflictResult = exportSnes65816Source(
    conflicting.project,
    conflicting.rom,
    path.join(directory, "widths"),
    options,
  );
  t.false(conflictResult.spans.some((span) => span.role === "code"));
  const overlap = fixture(
    [0xa9, 0x18],
    [capture("load", 0x808000, [0xa9, 0x18], 0x20), capture("overlap", 0x008001, [0x18])],
  );
  const overlapResult = exportSnes65816Source(
    overlap.project,
    overlap.rom,
    path.join(directory, "overlap"),
    options,
  );
  t.false(overlapResult.spans.some((span) => span.role === "code"));
});

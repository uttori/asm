import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  RomImage,
  openAnalysisProjectStore,
  publishAnalysisProject,
  sourceExportSha256,
  validateSourceExportFiles,
  validateSourceExportInputs,
  type AnalysisProject,
  type AnalysisFunctionRecord,
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

test("edited build configuration regenerates without force and verifies the exact ROM", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-config-input-"));
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  const { rom, project } = fixture();
  const sourceDirectory = path.join(directory, "source");
  const first = exportSnes65816Source(project, rom, sourceDirectory, options);
  const file = path.join(sourceDirectory, first.buildConfiguration);
  const config = JSON.parse(fs.readFileSync(file, "utf8"));
  config.includePaths.push("./extra-includes");
  const edited = `${JSON.stringify(config)}\n`;
  fs.writeFileSync(file, edited);
  t.throws(() => validateSourceExportInputs(sourceDirectory), { message: /config.json.*changed/ });
  const regenerated = exportSnes65816Source(project, rom, sourceDirectory, options);
  t.deepEqual(regenerated.files, first.files);
  t.is(fs.readFileSync(file, "utf8"), edited);
  t.notThrows(() => validateSourceExportFiles(sourceDirectory));
  const romFile = path.join(directory, "original.sfc");
  fs.writeFileSync(romFile, rom.bytes());
  t.true(
    (await verifySnesProjectRoundTrip({ sourceDirectory, romFile, emitDebugMap: false })).comparison
      .equal,
  );
});

test("project asset includes survive export and split native raw spans at exact bounds", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-asset-includes-"));
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  const { rom, project } = fixture();
  const annotated: AnalysisProject = {
    ...project,
    shards: {
      ...project.shards,
      comments: [
        {
          id: "asset-description",
          addressSpace: "rom.file",
          address: 0x20,
          text: "Named frame tiles.\nPreserve their palette association.",
          evidence: ["legacy"],
        },
      ],
      labels: [
        {
          id: "asset-label",
          addressSpace: "rom.file",
          address: 0x20,
          name: "FrameTiles",
          sourceName: "FrameTiles",
          analysisEntryPoint: false,
          evidence: ["legacy"],
        },
      ],
    },
  };
  const sourceDirectory = path.join(directory, "source");
  fs.mkdirSync(sourceDirectory);
  const directive = 'includeAsset("../assets/palette.json", "raw")';
  const map = { version: 1, entries: [{ start: 0x20, end: 0x24, directive }] };
  fs.writeFileSync(path.join(sourceDirectory, "asset-includes.json"), JSON.stringify(map));
  const customConfiguration = '{"plugins":[{"module":"custom-asset-plugin"}]}\n';
  fs.writeFileSync(path.join(sourceDirectory, "uttori-asm.config.json"), customConfiguration);

  const first = exportSnes65816Source(annotated, rom, sourceDirectory, options);
  t.false(first.files.some((file) => file.path === first.buildConfiguration));
  t.like(
    first.inputs?.find((input) => input.path === first.buildConfiguration),
    {
      kind: "configuration",
      sha256: sourceExportSha256(customConfiguration),
    },
  );
  const bank = fs.readFileSync(path.join(sourceDirectory, "banks/bank-000.asm"), "utf8");
  t.true(bank.includes(directive));
  t.regex(
    bank,
    /FrameTiles:[\S\s]*?; Named frame tiles\.\n  ; Preserve their palette association\.\n  includeAsset/,
  );
  t.true(
    first.spans.some(
      (span) => span.start === 0x20 && span.end === 0x24 && span.file === "banks/bank-000.asm",
    ),
  );
  t.is(
    fs.readFileSync(path.join(sourceDirectory, "uttori-asm.config.json"), "utf8"),
    customConfiguration,
  );
  const reanalyzed = {
    ...annotated,
    shards: {
      ...annotated.shards,
      analysis: analyzeSnesRuntimeCode(annotated.shards, rom, "lorom"),
    },
  };
  const editedConfiguration = `${customConfiguration}\n`;
  fs.writeFileSync(path.join(sourceDirectory, first.buildConfiguration), editedConfiguration);
  t.notThrows(() => validateSourceExportFiles(sourceDirectory));
  t.throws(() => validateSourceExportInputs(sourceDirectory), { message: /config.json.*changed/ });
  const second = exportSnes65816Source(reanalyzed, rom, sourceDirectory, options);
  t.deepEqual(second.files, first.files);
  t.is(
    fs.readFileSync(path.join(sourceDirectory, first.buildConfiguration), "utf8"),
    editedConfiguration,
  );
  t.notThrows(() => validateSourceExportFiles(sourceDirectory));
  t.notThrows(() => validateSourceExportInputs(sourceDirectory));
  t.is(fs.readFileSync(path.join(sourceDirectory, "banks/bank-000.asm"), "utf8"), bank);
});

/** Automatic function marker seeded by an imported entry point, not a reviewed source label. */
const inferredEntry = (address: number): AnalysisFunctionRecord => ({
  id: `static:function:${address.toString(16)}`,
  kind: "function",
  addressSpace: "snes.cpu",
  address,
  source: "entry-point",
  evidencePath: ["legacy-entry"],
  evidence: ["legacy"],
});

test("emitted fallback and imported labels resolve direct transfers without changing encoded aliases", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-flow-labels-"));
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  const sites: Array<[number, number[]]> = [
    [0, [0xf0, 0x0e]], // Relative branch into a separately retained block.
    [2, [0x20, 0x20, 0x80]],
    [5, [0x4c, 0x21, 0x80]],
    [8, [0x22, 0x22, 0x80, 0x00]], // Slow-bank JSL alias must stay encoded as bank 00.
    [12, [0x5c, 0x23, 0x80, 0x00]],
    [16, [0x82, 0x0d, 0x00]],
    [19, [0x6c, 0x24, 0x80]], // An indirect pointer is not the code target.
    [22, [0x62, 0x08, 0x00]], // PER pushes an address; it is not a control transfer.
    [32, [0x60]],
    [33, [0x60]],
    [34, [0x6b]],
    [35, [0x6b]],
    [36, [0x60]],
  ];
  const bytes = new Uint8Array(40).fill(0xea);
  for (const [offset, instruction] of sites) {
    bytes.set(instruction, offset);
  }
  const { rom, project } = fixture(
    [...bytes],
    sites.map(([offset, instruction]) => capture(`flow-${offset}`, 0x808000 + offset, instruction)),
  );
  const input: AnalysisProject = {
    ...project,
    shards: {
      ...project.shards,
      annotations: [],
      labels: [
        {
          id: "imported",
          addressSpace: "snes.cpu",
          address: 0x008021,
          name: "ImportedEntry",
          evidence: ["legacy"],
        },
      ],
      analysis: [
        ...project.shards.analysis,
        ...[16, 32, 34, 35, 36].map((n) => inferredEntry(0x808000 + n)),
      ],
    },
  };
  const sourceDirectory = path.join(directory, "source");
  const exported = exportSnes65816Source(input, rom, sourceDirectory, options);
  const source = fs.readFileSync(path.join(sourceDirectory, "banks/bank-000.asm"), "utf8");
  t.regex(source, /BEQ Fn_808010/);
  t.regex(source, /BRL Fn_808020/);
  t.regex(source, /JSR\.w \(Fn_808020 & \$FFFF\)/);
  t.regex(source, /JMP\.w \(L_ImportedEntry & \$F{4}\)/);
  t.regex(source, /JSL\.l \(\(Fn_808022 & \$FFFF\) \| \$000000\)/);
  t.regex(source, /JML\.l \(\(Fn_808023 & \$FFFF\) \| \$000000\)/);
  t.notRegex(source, /JMP[^\n]*Fn_808024|PER[^\n]*Fn_808020/);
  const romFile = path.join(directory, "rom.sfc");
  fs.writeFileSync(romFile, rom.bytes());
  t.true(
    (await verifySnesProjectRoundTrip({ sourceDirectory, romFile, emitDebugMap: false })).comparison
      .equal,
  );
  const analysisDirectory = path.join(directory, "analysis");
  publishAnalysisProject(analysisDirectory, input);
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
    t.deepEqual(streamed, exported);
  } finally {
    store.close();
  }
});

test("a branch to a suppressed operand-interior marker stays numeric", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-suppressed-target-"));
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  const { rom, project } = fixture(
    [0xd0, 0x01, 0xa9, 0x18, 0x60],
    [
      capture("branch", 0x808000, [0xd0, 0x01], 0x20),
      capture("load", 0x808002, [0xa9, 0x18], 0x20),
    ],
  );
  const input = {
    ...project,
    shards: { ...project.shards, analysis: [...project.shards.analysis, inferredEntry(0x808003)] },
  };
  exportSnes65816Source(input, rom, directory, options);
  const source = fs.readFileSync(path.join(directory, "banks/bank-000.asm"), "utf8");
  t.regex(source, /BNE \$808003/);
  t.notRegex(source, /Fn_808003/);
});

test("captured instruction extents supersede inferred operand entry markers in memory and SQL", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-legacy-entry-"));
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  const { rom, project } = fixture(
    [0x20, 0xc0, 0x1b],
    [capture("observed-jsr", 0x808000, [0x20, 0xc0, 0x1b])],
  );
  const input: AnalysisProject = {
    ...project,
    shards: {
      ...project.shards,
      annotations: [
        ...project.shards.annotations,
        { ...annotation("operand", 1, 2), points: ["in"] },
      ],
      analysis: [
        ...project.shards.analysis,
        inferredEntry(0x808000),
        inferredEntry(0x808001),
        inferredEntry(0x808003),
      ],
    },
  };
  const original = structuredClone(input);
  const sourceDirectory = path.join(directory, "source");
  const exported = exportSnes65816Source(input, rom, sourceDirectory, options);
  t.deepEqual(
    exported.spans.filter((span) => span.role === "code").map(({ start, end }) => [start, end]),
    [[0, 3]],
  );
  const source = fs.readFileSync(path.join(sourceDirectory, "banks/bank-000.asm"), "utf8");
  t.regex(source, /JSR\.w \$1BC0/);
  t.notRegex(source, /Fn_808001:/);
  t.regex(source, /Fn_808000:/);
  t.regex(source, /Fn_808003:/);
  t.deepEqual(input, original, "the legacy entry and function provenance remain saved");
  const romFile = path.join(directory, "rom.sfc");
  fs.writeFileSync(romFile, rom.bytes());
  t.true(
    (await verifySnesProjectRoundTrip({ sourceDirectory, romFile, emitDebugMap: false })).comparison
      .equal,
  );
  const analysisDirectory = path.join(directory, "analysis");
  publishAnalysisProject(analysisDirectory, input);
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
    t.deepEqual(streamed, exported, "SQL streaming applies the same runtime precedence");
  } finally {
    store.close();
  }
});

test("inferred entry precedence requires a surviving runtime proof and retains explicit annotations", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-entry-proof-"));
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  const { rom, project } = fixture(
    [0xa9, 0x18, 0x60],
    [capture("observed-load", 0x808000, [0xa9, 0x18], 0x20)],
  );
  const marker = inferredEntry(0x808001);
  const base = {
    ...project.shards,
    annotations: [],
    analysis: [...project.shards.analysis, marker],
  };
  const explicitLabel = {
    id: "reviewed-operand",
    addressSpace: "snes.cpu",
    address: 0x808001,
    name: "OperandByte",
    sourceName: "OperandByte",
    evidence: ["legacy"],
  };
  const overlap = fixture(
    [0xa9, 0x18, 0x60],
    [
      capture("observed-load", 0x808000, [0xa9, 0x18], 0x20),
      capture("overlapping-entry", 0x008001, [0x18]),
    ],
  );
  for (const [name, shards] of Object.entries({
    static: {
      ...base,
      analysis: base.analysis.map((record) =>
        record.kind === "cfg-node" ? { ...record, id: "static:cfg:808000" } : record,
      ),
    },
    missingProvenance: {
      ...base,
      evidence: base.evidence.map((record) => ({ ...record, source: "import" as const })),
    },
    explicitLabel: { ...base, labels: [explicitLabel] },
    explicitComment: {
      ...base,
      comments: [
        {
          id: "operand-note",
          addressSpace: "snes.cpu",
          address: 0x808001,
          text: "Reviewed operand note",
          evidence: ["legacy"],
        },
      ],
    },
    overlap: { ...base, analysis: [...overlap.project.shards.analysis, marker] },
  })) {
    const output = path.join(directory, name);
    const exported = exportSnes65816Source({ ...project, shards }, rom, output, options);
    t.false(
      exported.spans.some((span) => span.role === "code"),
      name,
    );
    const source = fs.readFileSync(path.join(output, "banks/bank-000.asm"), "utf8");
    if (name === "explicitLabel") {
      t.regex(source, /OperandByte:/);
    } else {
      t.regex(source, /Fn_808001:/, name);
    }
  }
});

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
  publishAnalysisProject(analysisDirectory, input);
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

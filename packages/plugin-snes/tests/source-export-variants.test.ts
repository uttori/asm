import * as fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  RomImage,
  publishAnalysisProject,
  openAnalysisProjectStore,
  type AnalysisProject,
  type AnalysisControlFlowNodeRecord,
  type RuntimeInstructionRecord,
} from "@uttori/asm-disassembler";

import { test } from "../../../tests/ava-helper.js";
import { verifySnesProjectRoundTrip } from "../src/disassembler/project-initializer.js";
import { analyzeSnesRuntimeCode } from "../src/disassembler/runtime-code.js";
import { exportSnes65816Source } from "../src/disassembler/source-export.js";

/** A capture supplies only the state needed to reproduce data-address-dependent symbol names. */
const capture = (
  id: string,
  bytes: readonly number[],
  state: RuntimeInstructionRecord["state"],
  address = 0x808000,
): RuntimeInstructionRecord => ({
  id,
  kind: "runtime-instruction",
  architecture: "snes.65816",
  addressSpace: "snes.cpu",
  address,
  bytes,
  state: { e: 0, p: 0x20, d: 0, db: 0xc0, ...state },
  count: 1,
  evidence: [id],
});

/** Minimal ROM-backed project. Every code node comes from the supplied captures. */
const projectFor = (
  rom: RomImage,
  runtime: readonly RuntimeInstructionRecord[],
): AnalysisProject => {
  const project: AnalysisProject = {
    manifest: {
      format: "uttori-asm-analysis",
      schemaVersion: 3,
      target: "snes.sfc",
      rom: rom.identity,
      mapping: { mapper: "lorom", source: "override", candidates: [] },
      addressSpaces: [{ id: "snes.cpu", name: "CPU", kind: "cpu", addressBits: 24 }],
    },
    shards: {
      analysis: [],
      annotations: [],
      labels: [],
      comments: [],
      regions: [],
      runtime,
      evidence: runtime.map(({ id }) => ({
        id,
        source: "runtime",
        sourceId: "fixture",
        confidence: "certain",
      })),
      imports: [],
    },
  };
  return {
    ...project,
    shards: { ...project.shards, analysis: analyzeSnesRuntimeCode(project.shards, rom, "lorom") },
  };
};

const ramMap = {
  format: "uttori-asm-snes-ram-map",
  schemaVersion: 1,
  variables: [{ name: "RAM_STATE", address: "$7E0100", size: 1, description: "Shared state." }],
};
const structMap = {
  format: "uttori-asm-snes-struct-map",
  schemaVersion: 1,
  structures: [{ id: "StateRecord", size: 1, fields: [{ name: "value", offset: 0, size: 1 }] }],
  bindings: [{ name: "State", structure: "StateRecord", address: 0x7e0100, count: 1 }],
};

for (const scenario of [
  {
    name: "struct",
    bytes: [0xb9, 0x00, 0x01],
    state: { db: 0x7e },
    file: "struct-map.json",
    map: structMap,
    numeric: "LDA.w $0100,y",
    symbolic: "State.value",
  },
  {
    name: "RAM",
    bytes: [0xb9, 0x00, 0x01],
    state: { db: 0x7e },
    file: "ram-map.json",
    map: ramMap,
    numeric: "LDA.w $0100,y",
    symbolic: "RAM_STATE",
  },
  {
    name: "hardware",
    bytes: [0xad, 0x00, 0x21],
    state: { db: 0 },
    file: "ram-map.json",
    map: ramMap,
    numeric: "LDA.w $2100",
    symbolic: "INIDISP",
  },
  {
    name: "direct page",
    bytes: [0xa5, 0x00],
    state: { d: 0x100 },
    file: "ram-map.json",
    map: ramMap,
    numeric: "LDA.b $00",
    symbolic: "RAM_STATE",
  },
]) {
  test(`unknown static state cannot erase captured ${scenario.name} names after reanalysis`, async (t) => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-export-reanalysis-"));
    t.teardown(() => fs.rmSync(workspace, { recursive: true, force: true }));
    const directory = path.join(workspace, "source");
    fs.mkdirSync(directory);
    fs.writeFileSync(path.join(directory, scenario.file), JSON.stringify(scenario.map));
    const bytes = new Uint8Array(0x8000).fill(0xea);
    bytes.set(scenario.bytes);
    const rom = new RomImage(bytes, { headerSize: 0 });
    const romFile = path.join(workspace, "rom.sfc");
    fs.writeFileSync(romFile, bytes);
    const baseline = projectFor(rom, [capture("observed", scenario.bytes, scenario.state)]);
    const observed = baseline.shards.analysis.find(
      (record): record is AnalysisControlFlowNodeRecord => record.kind === "cfg-node",
    )!;
    // Static seeds inherit provenance but cannot reconstruct the calling bank or direct page.
    const unknown: AnalysisControlFlowNodeRecord = {
      ...observed,
      id: "static:cfg:808000",
      incomingState: {
        ...observed.incomingState,
        dbr: { kind: "unknown" },
        d: { kind: "unknown" },
      },
    };
    const project: AnalysisProject = {
      ...baseline,
      shards: {
        ...baseline.shards,
        analysis: [unknown, observed],
        labels: [
          {
            id: "reviewed-entry",
            addressSpace: "snes.cpu",
            address: 0x808000,
            name: "ReviewedEntry",
            sourceName: "ReviewedEntry",
            evidence: ["observed"],
          },
        ],
      },
    };
    const options = { sourceProjectSha256: "b".repeat(64) };
    const exported = exportSnes65816Source(project, rom, directory, options);
    const bank = path.join(directory, "banks/bank-000.asm");
    t.true(fs.readFileSync(bank, "utf8").includes(scenario.symbolic));
    t.true(
      fs.readFileSync(bank, "utf8").includes("ReviewedEntry:"),
      "native labels survive removal of generated function records",
    );
    t.is(
      exported.spans.find((span) => span.start === 0)?.nodeIds?.length,
      2,
      "unresolved static provenance remains in the export",
    );
    t.true(
      (
        await verifySnesProjectRoundTrip({
          sourceDirectory: directory,
          romFile,
          emitDebugMap: false,
        })
      ).comparison.equal,
    );

    const reordered = { ...project, shards: { ...project.shards, analysis: [observed, unknown] } };
    t.deepEqual(exportSnes65816Source(reordered, rom, directory, options), exported);
    const analysisDirectory = path.join(workspace, "analysis");
    publishAnalysisProject(analysisDirectory, project);
    const store = openAnalysisProjectStore(analysisDirectory);
    try {
      store.prepareAnnotationQueries();
      const streamed = store.transaction(
        () =>
          exportSnes65816Source(store.sourceExportView(), rom, directory, {
            ...options,
            instructionGroups: store.instructionExportGroups(),
          }),
        false,
      );
      t.deepEqual(
        streamed,
        exported,
        "persisted native labels and runtime symbols survive a fresh SQL export",
      );
    } finally {
      store.close();
    }

    // A known contradictory static address is still evidence against the captured name.
    const conflictingProject = projectFor(rom, [capture("conflicting", scenario.bytes, {})]);
    const conflicting = conflictingProject.shards.analysis.find(
      (record): record is AnalysisControlFlowNodeRecord => record.kind === "cfg-node",
    )!;
    exportSnes65816Source(
      {
        ...project,
        shards: {
          ...project.shards,
          analysis: [observed, { ...conflicting, id: "static:cfg:conflicting" }],
        },
      },
      rom,
      directory,
      options,
    );
    t.true(fs.readFileSync(bank, "utf8").includes(scenario.numeric));

    // An unresolved runtime observation is different from an unresolved static guess.
    exportSnes65816Source(
      {
        ...project,
        shards: {
          ...project.shards,
          analysis: [observed, { ...unknown, id: "runtime:code:unknown" }],
        },
      },
      rom,
      directory,
      options,
    );
    t.true(fs.readFileSync(bank, "utf8").includes(scenario.numeric));

    // Inherited runtime evidence alone cannot promote a static node into an observation.
    exportSnes65816Source(
      {
        ...project,
        shards: { ...project.shards, analysis: [{ ...observed, id: "static:cfg:known" }, unknown] },
      },
      rom,
      directory,
      options,
    );
    t.true(fs.readFileSync(bank, "utf8").includes(scenario.numeric));
  });

  test(`export retains code and new gains when ${scenario.name} symbols vary across captures`, async (t) => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-export-variants-"));
    t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
    const sourceDirectory = path.join(directory, "source");
    fs.mkdirSync(sourceDirectory);
    fs.writeFileSync(path.join(sourceDirectory, scenario.file), JSON.stringify(scenario.map));
    const bytes = new Uint8Array(0x8000).fill(0xea);
    bytes.set(scenario.bytes);
    const rom = new RomImage(bytes, { headerSize: 0 });
    const romFile = path.join(directory, "rom.sfc");
    fs.writeFileSync(romFile, bytes);
    const options = { sourceProjectSha256: "a".repeat(64) };
    const baseline = capture("old", scenario.bytes, scenario.state);
    exportSnes65816Source(projectFor(rom, [baseline]), rom, sourceDirectory, options);
    const bank = path.join(sourceDirectory, "banks/bank-000.asm");
    t.true(fs.readFileSync(bank, "utf8").includes(scenario.symbolic));

    const project = projectFor(rom, [
      baseline,
      capture("new-state", scenario.bytes, {}),
      capture("new-code", [0xea], {}, 0x808010),
    ]);
    const exported = exportSnes65816Source(project, rom, sourceDirectory, options);
    const preserved = exported.spans.find((span) => span.start === 0);
    t.is(preserved?.role, "code");
    t.is(preserved?.end, scenario.bytes.length);
    t.is(preserved?.nodeIds?.length, 2, "both captured states retain their provenance");
    t.is(exported.spans.find((span) => span.start === 0x10)?.role, "code");
    t.true(fs.readFileSync(bank, "utf8").includes(scenario.numeric));
    t.true(
      (await verifySnesProjectRoundTrip({ sourceDirectory, romFile, emitDebugMap: false }))
        .comparison.equal,
    );

    const reordered = {
      ...project,
      shards: { ...project.shards, analysis: [...project.shards.analysis].reverse() },
    };
    t.deepEqual(exportSnes65816Source(reordered, rom, sourceDirectory, options), exported);
    const analysisDirectory = path.join(directory, "analysis");
    const evidence = [...new Set(project.shards.runtime.flatMap((record) => record.evidence))].map(
      (id) => ({
        id,
        source: "runtime" as const,
        sourceId: "fixture",
        confidence: "certain" as const,
      }),
    );
    publishAnalysisProject(analysisDirectory, {
      ...project,
      shards: { ...project.shards, evidence },
    });
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
        "SQL streaming preserves every byte, variant, span and generated file hash",
      );
    } finally {
      store.close();
    }
  });
}

test("export still rejects incompatible instruction widths after a new capture", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-export-widths-"));
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  const bytes = new Uint8Array(0x8000).fill(0xea);
  bytes.set([0xa9, 0x01, 0x02]);
  const rom = new RomImage(bytes, { headerSize: 0 });
  const baseline = capture("eight-bit", [0xa9, 0x01], { p: 0x20 });
  const options = { sourceProjectSha256: "a".repeat(64) };
  exportSnes65816Source(projectFor(rom, [baseline]), rom, directory, options);
  const candidate = projectFor(rom, [
    baseline,
    capture("sixteen-bit", [0xa9, 0x01, 0x02], { p: 0 }),
  ]);
  t.throws(() => exportSnes65816Source(candidate, rom, directory, options), {
    message: /replace 2 previously emitted code byte/,
  });
});

test("explicit instruction widths round trip and ignore unrelated captured M/X changes", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-export-explicit-widths-"));
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  const sourceDirectory = path.join(directory, "source");
  const bytes = new Uint8Array(0x8000).fill(0xea);
  const instructions = [
    { bytes: [0xc2, 0x30], p: 0x30 }, // REP changes ambient width before an explicitly short immediate.
    { bytes: [0xa9, 0x12], p: 0x20 },
    { bytes: [0xa2, 0x34, 0x12], p: 0x20 },
    { bytes: [0xe2, 0x30], p: 0 }, // SEP must not shorten the following explicit word operands.
    { bytes: [0xa0, 0x78, 0x56], p: 0 },
    { bytes: [0xa9, 0xbc, 0x9a], p: 0 },
    { bytes: [0xea], p: 0x30 },
    { bytes: [0x60], p: 0x30 },
  ];
  let offset = 0;
  const runtime = instructions.map((instruction, index) => {
    bytes.set(instruction.bytes, offset);
    const record = capture(
      `instruction-${index}`,
      instruction.bytes,
      { p: instruction.p },
      0x808000 + offset,
    );
    offset += instruction.bytes.length;
    return record;
  });
  const rom = new RomImage(bytes, { headerSize: 0 });
  const romFile = path.join(directory, "rom.sfc");
  fs.writeFileSync(romFile, bytes);
  const options = { sourceProjectSha256: "a".repeat(64) };
  const first = exportSnes65816Source(projectFor(rom, runtime), rom, sourceDirectory, options);
  const bank = path.join(sourceDirectory, "banks/bank-000.asm");
  const text = fs.readFileSync(bank, "utf8");
  t.notRegex(text, /^\.[ai](?:8|16)\b/m);
  for (const source of ["LDA.b #$12", "LDX.w #$1234", "LDY.w #$5678", "LDA.w #$9ABC"]) {
    t.true(text.includes(source), source);
  }
  t.true(
    (await verifySnesProjectRoundTrip({ sourceDirectory, romFile, emitDebugMap: false })).comparison
      .equal,
  );
  const changed = runtime.map((record) =>
    record.bytes.length === 1 ? { ...record, state: { ...record.state, p: 0 } } : record,
  );
  const second = exportSnes65816Source(projectFor(rom, changed), rom, sourceDirectory, options);
  t.is(
    fs.readFileSync(bank, "utf8"),
    text,
    "non-width-sensitive instructions do not rewrite source when captured flags change",
  );
  t.deepEqual(second.files, first.files);
  t.true(
    (await verifySnesProjectRoundTrip({ sourceDirectory, romFile, emitDebugMap: false })).comparison
      .equal,
  );
});

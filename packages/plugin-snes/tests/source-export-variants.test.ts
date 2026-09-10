import * as fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  RomImage,
  type AnalysisProject,
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

/** Minimal ROM-backed project; every code node comes from the supplied captures. */
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
      evidence: [],
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

import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import {
  RomImage,
  writeAnalysisProject,
  openAnalysisProjectStore,
  type AnalysisProjectShards,
  type RuntimeEvidenceRecord,
  type RuntimeStateValue,
} from "@uttori/asm-disassembler";

import { test } from "../../../tests/ava-helper.js";
import { analyzeSnesRuntimeCode } from "../src/disassembler/runtime-code.js";

test("runtime projections retain identical CFG variants, aliases, conflicts and trace provenance", (t) => {
  const runtime: RuntimeEvidenceRecord[] = [];
  const states: Readonly<Record<string, RuntimeStateValue>>[] = [
    { p: 0x20, e: 0, db: 0x7e, d: 0 },
    { p: 0x21, e: 0, db: 0x7e, d: 0 },
    { P: 0x20, E: 0, DB: 0x7e, D: 0 },
    { p: 0, e: 1, db: 0x7e, d: 0 },
    { p: 0x30, e: 1, db: 0x7e, d: 0 },
    { p: 0x30, P: 0, e: 0, db: 0x7f, d: 16 },
    { p: 0x00, e: 0, db: 0x7e, d: 0 },
    { p: "unknown", e: "unknown" },
  ];
  for (const [index, state] of states.entries()) {
    runtime.push({
      id: `code:${index}`,
      kind: "runtime-instruction",
      architecture: "snes.65816",
      addressSpace: "snes.cpu",
      address: 0x7e1000,
      count: index + 1,
      bytes: index === 6 ? [0xa9, 1, 2] : [0xa9, 1],
      state: { ...state, a: index, x: index * 2, y: index * 3, s: 0x1ff },
      evidence: [`trace:${index}`],
    });
  }
  runtime.push({
    id: "registers",
    kind: "runtime-cpu-state",
    architecture: "snes.65816",
    addressSpace: "snes.cpu",
    address: 0x7e1000,
    count: 1,
    state: { a: 9 },
    evidence: ["trace:0"],
  });
  const shards: AnalysisProjectShards = {
    runtime,
    analysis: [],
    annotations: [],
    labels: [],
    comments: [],
    regions: [],
    imports: [],
    evidence: [],
  };
  const original = structuredClone(runtime);
  const rom = new RomImage(new Uint8Array(0x8000));
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-sql-variants-"));
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  const evidence = states.map((_, index) => ({
    id: `trace:${index}`,
    source: "runtime" as const,
    sourceId: "fixture",
    confidence: "certain" as const,
  }));
  writeAnalysisProject(directory, {
    manifest: {
      format: "uttori-asm-analysis",
      schemaVersion: 3,
      target: "snes.sfc",
      rom: rom.identity,
      mapping: { mapper: "lorom", source: "override", candidates: [] },
      addressSpaces: [{ id: "snes.cpu", name: "CPU", kind: "cpu", addressBits: 24 }],
    },
    shards: { ...shards, evidence },
  });
  const store = openAnalysisProjectStore(directory);
  t.teardown(() => store.close());
  const fields = ["p", "P", "e", "E", "db", "DB", "d", "D"];
  const masks = { p: { max: 255, mask: 0x30 }, P: { max: 255, mask: 0x30 } };
  const projected = [...store.runtimeInstructionVariants("snes.65816", "snes.cpu", fields, masks)];
  t.true(projected.length < runtime.length);
  t.false(projected.some((record) => record.kind === "runtime-cpu-state"));
  t.deepEqual(
    [...store.runtimeInstructionVariants("snes.65816", "snes.cpu", fields, masks)],
    projected,
  );
  t.deepEqual(
    analyzeSnesRuntimeCode({ ...shards, runtime: projected }, rom, "lorom"),
    analyzeSnesRuntimeCode(shards, rom, "lorom"),
  );
  t.deepEqual(runtime, original);
});

test("large captured graphs preserve every node and conditional edge", async (t) => {
  // AVA workers have a larger native stack than the editor's maintenance child process.
  // Use a normal Node child so the regression exercises the same call-argument limit.
  const { stdout } = await promisify(execFile)(
    process.execPath,
    [
      "--conditions=uttori-source",
      "--import=tsx",
      fileURLToPath(new URL("./fixtures/large-runtime-code.ts", import.meta.url)),
    ],
    { timeout: 60_000 },
  );
  t.deepEqual(JSON.parse(stdout), {
    nodes: 131_072,
    edges: 262_144,
    records: 393_216,
    uniqueRecords: 393_216,
    everyNodeHasBothOutcomes: true,
    evidencePreserved: true,
    deterministicOrder: true,
  });
});

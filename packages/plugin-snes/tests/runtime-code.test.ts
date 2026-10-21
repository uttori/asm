import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { RomImage, publishAnalysisProject, openAnalysisProjectStore, type AnalysisProjectShards, type RuntimeEvidenceRecord, type RuntimeStateValue } from "@uttori/asm-disassembler";

import { test } from "../../../tests/ava-helper.js";
import { analyzeSnesRuntimeCode } from "../src/disassembler/runtime-code.js";

test("long captured routines retain lazy ownership paths without copying every prefix", (t) => {
  const bytes = new Uint8Array(0x8000).fill(0xea);
  bytes.set([0x20, 0x10, 0x80, 0xdb]);
  bytes[0x1010] = 0x60;
  const runtime: Extract<RuntimeEvidenceRecord, { kind: "runtime-instruction" }>[] = [
    {
      id: "call",
      kind: "runtime-instruction",
      architecture: "snes.65816",
      addressSpace: "snes.cpu",
      address: 0x808000,
      count: 1,
      bytes: [0x20, 0x10, 0x80],
      state: { p: 0x30, e: 0 },
      evidence: ["capture"],
    },
  ];
  for (let offset = 0x10; offset <= 0x1010; offset++) {
    runtime.push({
      ...runtime[0],
      id: `step:${offset}`,
      address: 0x808000 + offset,
      bytes: [bytes[offset]],
    });
  }
  const records = analyzeSnesRuntimeCode(
    {
      analysis: [],
      annotations: [],
      labels: [],
      comments: [],
      regions: [],
      imports: [],
      evidence: [],
      runtime,
    },
    new RomImage(bytes),
    "lorom",
  );
  const nodes = records.filter((record) => record.kind === "cfg-node");
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const first = nodes.find((node) => node.address === 0x808010)!;
  let current = nodes.find((node) => node.address === 0x809010)!;
  t.is(current.functionEntry, first.id);
  t.true(nodes.every((node) => node.evidencePath.length === 1));
  let length = 0;
  while (current.evidencePredecessor) {
    current = byId.get(current.evidencePredecessor)!;
    t.is(current.functionEntry, first.id);
    if (++length > 0x1000) {
      t.fail("Ownership path contains a cycle.");
      break;
    }
  }
  t.is(current.id, first.id);
  t.is(length, 0x1000);
});

test("shared captured tails lose unique ownership through loops", (t) => {
  const steps = [
    [0x808000, [0x20, 0x10, 0x80]],
    [0x808003, [0x20, 0x20, 0x80]],
    [0x808010, [0x4c, 0x30, 0x80]],
    [0x808020, [0x4c, 0x30, 0x80]],
    [0x808030, [0xea]],
    [0x808031, [0x80, 0xfd]],
  ] as const;
  const runtime: RuntimeEvidenceRecord[] = steps.map(([address, bytes]) => ({
    id: `step:${address}`,
    kind: "runtime-instruction",
    architecture: "snes.65816",
    addressSpace: "snes.cpu",
    address,
    bytes,
    count: 1,
    state: { p: 0x30, e: 0 },
    evidence: ["capture"],
  }));
  const records = analyzeSnesRuntimeCode(
    {
      analysis: [],
      annotations: [],
      labels: [],
      comments: [],
      regions: [],
      imports: [],
      evidence: [],
      runtime,
    },
    new RomImage(new Uint8Array(0x8000)),
    "lorom",
  );
  const nodes = records.filter((record) => record.kind === "cfg-node");
  for (const address of [0x808030, 0x808031]) {
    const node = nodes.find((item) => item.address === address)!;
    t.is(node.functionEntry, undefined);
    t.is(node.evidencePredecessor, undefined);
  }
  for (const address of [0x808010, 0x808020]) {
    const node = nodes.find((item) => item.address === address)!;
    t.is(node.functionEntry, node.id);
  }
});

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
  publishAnalysisProject(directory, {
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

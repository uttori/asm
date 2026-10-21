import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { Session } from "node:inspector/promises";
import path from "node:path";

import { Assembler } from "../packages/core/src/assembler.js";
import {
  assemblePreparedFixture,
  assertAssembledMatchesManifest,
  cleanupPreparedFixture,
  prepareExternalFixture,
} from "./external-fixtures.js";

/** Profile assembly of a prepared real fixture separately from ROM extraction and filesystem setup. */
const fixture = process.argv[2];
assert.ok(fixture === "chou" || fixture === "smrpg", "Pass chou or smrpg and an output directory");
const output = path.resolve(process.argv[3] ?? "/tmp/assembler-production-profile");
fs.mkdirSync(output, { recursive: true });
const hash = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");
/** Boundary RSS includes loader/runtime reservations; only heapUsed after GC estimates live JS data. */
function memory() {
  return { ...process.memoryUsage(), processPeakRssBytes: process.resourceUsage().maxRSS * 1024 };
}
/** Collect outside throughput/CPU measurements to compare reachable objects across assembly stages. */
function collect() {
  assert.ok(global.gc, "Run with --expose-gc");
  global.gc();
  global.gc();
  return memory();
}

/** Count session containers without serializing source, ROM data, or retaining their object roots. */
function owners(value: unknown, depth = 0): unknown {
  if (typeof value === "string") {
    return { kind: "string", characters: value.length };
  }
  if (Array.isArray(value)) {
    return { kind: "array", length: value.length };
  }
  // Typed buffers expose one enumerable property per byte. Count their storage without building
  // an observation object for every ROM byte, which would itself distort live-heap measurements.
  if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) {
    return { kind: "buffer", bytes: value.byteLength };
  }
  if (value instanceof Map) {
    let stringKeyCharacters = 0;
    let arrayElements = 0;
    for (const [key, entry] of value) {
      if (typeof key === "string") {
        stringKeyCharacters += key.length;
      }
      if (Array.isArray(entry)) {
        arrayElements += entry.length;
      }
    }
    return { kind: "Map", size: value.size, stringKeyCharacters, arrayElements };
  }
  if (value instanceof Set) {
    return { kind: "Set", size: value.size };
  }
  if (value === null || typeof value !== "object" || depth >= 2) {
    return { kind: typeof value };
  }
  const fields = Object.entries(value);
  return {
    kind: "object",
    ownFieldCount: fields.length,
    fields: Object.fromEntries(
      fields.slice(0, 128).map(([key, entry]) => [key, owners(entry, depth + 1)]),
    ),
  };
}

const preparationStarted = performance.now();
const prepared = prepareExternalFixture(fixture);
const preparationMs = performance.now() - preparationStarted;
try {
  const baseline = collect();
  const boundaries: {
    session: number;
    phase: string;
    beforeGc: ReturnType<typeof memory>;
    afterGc: ReturnType<typeof memory>;
    owners?: unknown;
  }[] = [];
  const identities = new WeakMap<Assembler, number>();
  let sessionCount = 0;
  // Weak keys assign stable observation IDs without retaining disposed assembler instances.
  const identity = (assembler: Assembler): number => {
    let id = identities.get(assembler);
    if (id === undefined) {
      id = ++sessionCount;
      identities.set(assembler, id);
    }
    return id;
  };
  // oxlint-disable-next-line typescript/unbound-method -- Invoked with apply and restored before profiling.
  const runStage = Assembler.prototype.runStage;
  // oxlint-disable-next-line typescript/unbound-method -- Invoked with call and restored before profiling.
  const dispose = Assembler.prototype.dispose;
  Assembler.prototype.runStage = function (...args) {
    const state = runStage.apply(this, args);
    const beforeGc = memory();
    boundaries.push({
      session: identity(this),
      phase: args[0],
      beforeGc,
      afterGc: collect(),
      owners: {
        session: owners(this),
        programCache: owners(this.passProgramCache),
        includes: owners(Reflect.get(this, "includeSource")),
        output: owners(Reflect.get(this, "outputWriter")),
      },
    });
    return state;
  };
  Assembler.prototype.dispose = function () {
    dispose.call(this);
    const beforeGc = memory();
    boundaries.push({
      session: identity(this),
      phase: "disposedWithReferences",
      beforeGc,
      afterGc: collect(),
    });
  };
  try {
    assertAssembledMatchesManifest(fixture, assemblePreparedFixture(prepared));
  } finally {
    Assembler.prototype.runStage = runStage;
    Assembler.prototype.dispose = dispose;
  }
  const released = collect();
  const session = new Session();
  session.connect();
  try {
    await session.post("Profiler.enable");
    await session.post("Profiler.setSamplingInterval", { interval: 500 });
    await session.post("Profiler.start");
    const started = performance.now();
    const bytes = assemblePreparedFixture(prepared);
    const profiledAssemblyMs = performance.now() - started;
    const { profile } = await session.post("Profiler.stop");
    assertAssembledMatchesManifest(fixture, bytes);
    fs.writeFileSync(path.join(output, `${fixture}.cpuprofile`), JSON.stringify(profile));
    fs.writeFileSync(
      path.join(output, `${fixture}.json`),
      JSON.stringify(
        {
          fixture,
          node: process.version,
          fixtureCommit: prepared.spec.commit,
          harnessSha256: hash(fs.readFileSync(import.meta.filename)),
          sourceHarnessSha256: hash(fs.readFileSync("scripts/profile-assembler-production.ts")),
          fixtureHelperSha256: hash(fs.readFileSync("scripts/external-fixtures.ts")),
          preparationMs,
          baseline,
          boundaries,
          released,
          profiledAssemblyMs,
          outputBytes: bytes.length,
          outputSha256: hash(bytes),
          endMemory: memory(),
          definition:
            "One observation with forced GC at stage/disposal boundaries, then one separate CPU profile of prepared assembly with no forced GC. CPU time includes profiling overhead and is not a throughput sample. SMRPG uses four assembler sessions per complete build.",
        },
        null,
        2,
      ) + "\n",
    );
    console.log(`${fixture}: output verified; memory observations and CPU profile saved`);
  } finally {
    session.disconnect();
  }
} finally {
  cleanupPreparedFixture(prepared);
}

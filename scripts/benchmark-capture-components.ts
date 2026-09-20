import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

import type { RuntimeBusAccess } from "../packages/disassembler/src/runtime-bus-types.js";
import { createRuntimeGraphicsAccumulator } from "../packages/disassembler/src/runtime-graphics.js";
import {
  normalizeRuntimePPUEffect,
  type RuntimePPUEffect,
} from "../packages/disassembler/src/runtime-ppu.js";

const output = process.argv[2];
if (!output) throw new Error("Usage: benchmark-capture-components.ts OUTPUT");
const events = 131072;
const results = [];
/** Describe actual component branches without cloning their implementations. */
interface GraphicsCase {
  readonly name: string;
  readonly target: "vram" | "cgram" | "oam";
  readonly known: boolean;
  readonly mapping?: number;
}
const graphicsCases: GraphicsCase[] = [
  ...[0, 1, 2, 3].map((mapping) => ({
    name: `vram-mapping-${mapping}`,
    target: "vram" as const,
    known: true,
    mapping,
  })),
  { name: "vram-unknown", target: "vram", known: false },
  { name: "cgram-known", target: "cgram", known: true },
  { name: "cgram-unknown", target: "cgram", known: false },
  { name: "oam-low-high-mirrors", target: "oam", known: true },
  { name: "oam-unknown", target: "oam", known: false },
];
/** Construct validated primitive coordinates before timing. Generation/allocation
 * of the input events must not be confused with accumulator allocations.
 * @param {number} i Zero-based monotonic event ordinal.
 * @param {number} address CPU-visible PPU register.
 * @param {number} value Byte observed on the bus.
 * @param {boolean} read Whether this is a read that advances shared PPU latches.
 * @returns {RuntimeBusAccess} Owned CPU event for the component kernel.
 */
function access(i: number, address: number, value: number, read = false): RuntimeBusAccess {
  return {
    sequence: String(i + 1),
    ordinal: String(i + 1),
    cycle: String(i * 8),
    address,
    value,
    direction: read ? "read" : "write",
    actor: "cpu",
    channel: null,
    phase: "cpu",
    context: "instruction",
    pc: 0x808000,
    hcounter: 0,
    vcounter: 0,
  };
}
for (const scenario of graphicsCases) {
  const setup: [number, number][] = [];
  if (scenario.known) {
    setup.push([0x2100, 0x80]);
    if (scenario.target === "vram")
      setup.push([0x2115, 0x80 | (scenario.mapping! << 2)], [0x2116, 0], [0x2117, 0]);
    if (scenario.target === "cgram") setup.push([0x2121, 0]);
    if (scenario.target === "oam") setup.push([0x2102, 0], [0x2103, 0]);
  }
  const input: RuntimeBusAccess[] = setup.map(([address, value], i) => access(i, address, value));
  let expectedWrites = 0;
  for (let i = input.length; i < events; i++) {
    const read = i % 8 === 7;
    let address = 0x2104;
    if (scenario.target === "vram") address = 0x2118 + (i % 2);
    if (scenario.target === "cgram") address = 0x2122;
    if (read) {
      address = 0x2138;
      if (scenario.target === "vram") address = 0x2139 + (i % 2);
      if (scenario.target === "cgram") address = 0x213b;
    } else expectedWrites++;
    input.push(access(i, address, i & 255, read));
  }
  const runs = [];
  for (let sample = 0; sample < 6; sample++) {
    global.gc?.();
    const accumulator = createRuntimeGraphicsAccumulator();
    const start = performance.now();
    for (const event of input) accumulator.push(event);
    const summary = accumulator.finish();
    const ms = performance.now() - start;
    assert.equal(
      summary.activity.reduce((count, row) => count + row.portWrites, 0),
      expectedWrites,
    );
    assert(summary.writes.length <= 64);
    if (scenario.known) assert(summary.activity.some((row) => row.addressed > 0));
    else assert(summary.activity.every((row) => row.unknown === row.portWrites));
    runs.push({ sample, ms, counts: summary.activity });
  }
  const times = runs
    .slice(1)
    .map((run) => run.ms)
    .sort((a, b) => a - b);
  results.push({
    name: scenario.name,
    component: "graphics-accumulator",
    events,
    medianMs: times[2],
    runs,
  });
}

// PPU normalization is called once by the importer and again by independent fact
// validation. Measure its allocation/validation branches directly, without changing
// that trust boundary or extrapolating the component timings into additive totals.
const effectCases: { name: string; effect: RuntimePPUEffect; event: RuntimeBusAccess }[] = [];
for (const target of ["vram", "cgram", "oam"] as const) {
  let port = 0x2118;
  if (target === "cgram") port = 0x2122;
  if (target === "oam") port = 0x2104;
  for (const outcome of ["written", "blocked", "latched"] as const) {
    if (outcome === "blocked" && target !== "vram") continue;
    if (outcome === "latched" && target === "vram") continue;
    const bytes: { address: number; value: number }[] = [];
    if (outcome === "written") {
      bytes.push({ address: 0, value: 0x80 });
      if (target === "cgram") bytes.push({ address: 1, value: 0 });
      if (target === "oam") bytes.push({ address: 1, value: 0x80 });
    }
    effectCases.push({
      name: `${target}-${outcome}`,
      event: access(0, port, 0x80),
      effect: {
        target,
        outcome,
        forcedBlank: outcome !== "blocked",
        renderingRestricted: outcome === "blocked",
        implementation: "accurate",
        vramBytes: target === "vram" ? 131072 : null,
        bytes,
      },
    });
  }
}
for (const scenario of effectCases) {
  const runs = [];
  for (let sample = 0; sample < 6; sample++) {
    global.gc?.();
    let byteCount = 0;
    const start = performance.now();
    for (let i = 0; i < events; i++)
      byteCount += normalizeRuntimePPUEffect(scenario.effect, scenario.event).bytes.length;
    const ms = performance.now() - start;
    assert.equal(byteCount, events * scenario.effect.bytes.length);
    runs.push({ sample, ms });
  }
  const times = runs
    .slice(1)
    .map((run) => run.ms)
    .sort((a, b) => a - b);
  results.push({
    name: scenario.name,
    component: "ppu-normalization",
    events,
    medianMs: times[2],
    runs,
  });
}
const sources: Record<string, string> = {};
for (const file of [
  "scripts/benchmark-capture-components.ts",
  "packages/disassembler/src/runtime-graphics.ts",
  "packages/disassembler/src/runtime-ppu.ts",
])
  sources[file] = createHash("sha256")
    .update(await readFile(file))
    .digest("hex");
await writeFile(
  output,
  JSON.stringify(
    {
      schemaVersion: 1,
      platform: `${process.platform}-${process.arch}`,
      runtime: process.version,
      note: "One in-process warmup and five measured samples. Component kernels only, inputs generated before timing. Graphics examples stay bounded. These are candidate destinations, not native PPU write verification. Component costs are not additive with end-to-end timings.",
      sources,
      results,
    },
    null,
    2,
  ) + "\n",
);
for (const result of results)
  console.log(`${result.component}/${result.name}: ${result.medianMs.toFixed(2)} ms`);

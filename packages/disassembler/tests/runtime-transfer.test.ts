import { test } from "../../../tests/ava-helper.js";
import { createRuntimeBusTraceImporter } from "../src/runtime-bus-trace.js";
import type { RuntimeBusAccess } from "../src/runtime-bus-types.js";
import type { RuntimeTransferBoundary } from "../src/runtime-transfer.js";

const context = { projectRomContentSha256: "a".repeat(64), sourceName: "transfer.act2" };
const metadata = {
  format: "uttori-asm-bus-trace",
  schemaVersion: 1,
  scope: "snes.cpu-bus-transfers",
  architecture: "snes.65816",
  addressSpace: "snes.cpu",
  romContentSha256: context.projectRomContentSha256,
  producer: { id: "ares", revision: "fixture" },
  session: "b".repeat(32),
  clock: { id: "snes.master", numerator: "236250000", denominator: "11" },
};
const marker = (
  sequence: number,
  patch: Partial<RuntimeTransferBoundary> = {},
): RuntimeTransferBoundary => ({
  kind: "transfer",
  sequence: String(sequence),
  cycle: String(sequence * 8),
  ordinal: "1",
  pc: 0x808000,
  context: "instruction",
  hcounter: 0,
  vcounter: 0,
  transferId: "1",
  boundary: "begin",
  actor: "dma",
  channel: 0,
  transferred: 0,
  configuration: {
    dmap: 8,
    bbad: 0x18,
    a1t: 0,
    a1b: 0x7e,
    das: 1,
    dasb: 0,
    a2a: 0,
    ntlr: 0,
    flags: 1,
  },
  ...patch,
});
const access = (sequence: number, patch: Partial<RuntimeBusAccess> = {}): RuntimeBusAccess => ({
  sequence: String(sequence),
  ordinal: "1",
  cycle: String(sequence * 8),
  address: 0x7e0000,
  pc: 0x808000,
  value: 1,
  actor: "dma",
  channel: 0,
  direction: "read",
  phase: "dma",
  context: "instruction",
  hcounter: 0,
  vcounter: 0,
  ...patch,
});

test("explicit nested DMA/HDMA windows retain interrupted and completed identities", (t) => {
  const importer = createRuntimeBusTraceImporter(metadata, context);
  const events = [
    marker(1),
    marker(2, { actor: "hdma", transferId: "2" }),
    access(3, { actor: "hdma", phase: "hdma-transfer" }),
    marker(4, { actor: "hdma", transferId: "2", boundary: "complete", transferred: 1 }),
    access(5),
    marker(6, { boundary: "interrupted", transferred: 1 }),
  ];
  for (const item of events) importer.push({ accesses: [item] });
  const result = importer.finish();
  t.is(result.observedEvents, 2);
  t.is(result.report.imported.transferMarkers, 4);
  t.is(result.report.imported["dma0.interrupted"], 1);
  t.is(result.report.imported["hdma0.complete"], 1);
  t.deepEqual(
    result.summary.transfers?.windows.map((window) => [window.actor, window.status, window.reads]),
    [
      ["hdma", "complete", 1],
      ["dma", "interrupted", 1],
    ],
  );
  const framed = createRuntimeBusTraceImporter(metadata, context);
  framed.push({ accesses: events });
  t.deepEqual(framed.finish(), result);
});

test("capture edges preserve missing starts, missing ends and wholly partial windows", (t) => {
  const importer = createRuntimeBusTraceImporter(metadata, context);
  importer.push({
    accesses: [
      access(1),
      marker(2, { transferId: "0", boundary: "complete", transferred: 7 }),
      marker(3, { transferId: "3" }),
      access(4),
      access(5, { channel: 1 }),
    ],
  });
  const result = importer.finish();
  t.deepEqual(
    result.summary.transfers?.windows.map((window) => window.status),
    ["leading-partial", "trailing-partial", "both-partial"],
  );
  t.is(result.report.imported["dma0.attemptedSlots"], 0);
  t.is(result.summary.transfers?.windows[0].begin, undefined);
});

test("invalid transfer lifecycle, counts and scope reject publication after any accepted prefix", (t) => {
  for (const end of [
    marker(2, { transferId: "9", boundary: "complete", transferred: 1 }),
    marker(2, { boundary: "complete", transferred: 2 }),
    marker(2, { transferId: "0", boundary: "complete", transferred: 1 }),
    marker(2, { boundary: "begin", transferId: "2" }),
  ]) {
    const importer = createRuntimeBusTraceImporter(metadata, context);
    importer.push({ accesses: [marker(1)] });
    t.throws(() => importer.push({ accesses: [end] }));
    t.throws(importer.finish);
  }
  const missing = createRuntimeBusTraceImporter(metadata, context);
  t.throws(
    () =>
      missing.push({ accesses: [marker(1), marker(2, { boundary: "complete", transferred: 1 })] }),
    { message: /missing bus accesses/ },
  );
  const old = createRuntimeBusTraceImporter({ ...metadata, scope: "snes.cpu-bus" }, context);
  t.throws(() => old.push({ accesses: [marker(1)] }), { message: /negotiated transfer scope/ });
  const excessive = createRuntimeBusTraceImporter(metadata, context);
  t.throws(
    () =>
      excessive.push({
        accesses: [
          marker(1),
          access(2),
          access(3),
          marker(4, { boundary: "complete", transferred: 1 }),
        ],
      }),
    { message: /more observed accesses/ },
  );
});

test("bounded transfer examples retain all counts and distinguish suppressed accesses from attempted slots", (t) => {
  const importer = createRuntimeBusTraceImporter(metadata, context);
  for (let i = 0; i < 100; i++) {
    // A suppressed B-bus write still leaves the actual A-bus read.
    const id = i * 3 + 1;
    importer.push({
      accesses: [
        marker(id, { transferId: String(id) }),
        access(id + 1),
        marker(id + 2, {
          transferId: String(id),
          boundary: "complete",
          transferred: 1,
        }),
      ],
    });
  }
  const result = importer.finish();
  t.is(result.observedEvents, 100);
  t.is(result.summary.transfers?.windows.length, 64);
  t.is(result.summary.transfers?.omittedWindows, 36);
  t.is(result.report.imported["dma0.complete"], 100);
  t.is(result.report.imported["dma0.attemptedSlots"], 100);
});

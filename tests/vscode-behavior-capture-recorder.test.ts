import { test } from "./ava-helper.js";
import { validateBehaviorCapture, type BehaviorCaptureStopReason } from "@uttori/asm-disassembler";
import {
  BehaviorCaptureRecorder,
  type BehaviorRecorderOptions,
} from "../packages/disassembler/src/behavior-capture-recorder.js";
import { acquireTraceLease } from "../packages/vscode-extension/src/trace-lease.js";

const batch = (addresses: number[], sequenceStart = 1, droppedEvents = 0, active = true) => ({
  architecture: "snes.65816",
  addressSpace: "snes.cpu",
  addresses,
  sequenceStart,
  droppedEvents,
  active,
});
const options = (overrides: Partial<BehaviorRecorderOptions> = {}): BehaviorRecorderOptions => ({
  architecture: "snes.65816",
  addressSpace: "snes.cpu",
  romContentSha256: "a".repeat(64),
  producer: { id: "ares", revision: "fixture" },
  role: "action",
  label: "Open Menu",
  stop: { kind: "manual" },
  limits: { maxEvents: 100, maxMilliseconds: 1000 },
  maxBatchEvents: 10,
  readTrace: async () => batch([], 1, 0, false),
  stopTrace: async () => {},
  ...overrides,
});

test("behavior recorder trims instruction details with PCs and retains memory loss metadata", async (t) => {
  const detail = {
    bytes: [0xea],
    state: { p: 0x30 },
    memoryAccesses: [
      {
        addressSpace: "snes.cpu",
        address: 0x7e2000,
        access: "write" as const,
        width: 1,
        value: 5,
        actor: "cpu" as const,
      },
    ],
  };
  const result = await new BehaviorCaptureRecorder(
    options({
      stop: { kind: "address", addresses: [2], description: "boundary" },
      readTrace: async () => ({
        ...batch([1, 2, 3]),
        details: [detail, detail, detail],
        unattributedMemoryAccesses: 9,
      }),
    }),
  ).completion;
  t.deepEqual(result.trace.chunks[0]?.details, [detail, detail]);
  t.is(result.trace.chunks.at(-1)?.unattributedMemoryAccesses, 9);
  t.is(result.excludedPolledEvents, 1);
});

test("behavior recorder includes address boundary, reports polled overshoot, and stops producer once", async (t) => {
  let stops = 0;
  const recorder = new BehaviorCaptureRecorder(
    options({
      stop: { kind: "address", addresses: [4], description: "Menu" },
      readTrace: async () => batch([1, 3, 4, 5, 6]),
      stopTrace: async () => {
        stops++;
      },
    }),
  );
  const result = await recorder.completion;
  t.is(result.stopReason, "address");
  t.is(result.excludedPolledEvents, 2);
  t.deepEqual(
    result.trace.chunks.flatMap(({ addresses }) => addresses),
    [1, 3, 4],
  );
  t.false(result.trace.chunks.at(-1)!.active);
  t.is(stops, 1);
  t.notThrows(() =>
    validateBehaviorCapture({
      format: "uttori-asm-behavior-capture",
      schemaVersion: 1,
      identity: {
        target: "snes",
        binarySha256: "a".repeat(64),
        debugMapFingerprint: "b".repeat(64),
      },
      windows: [result],
    }),
  );
});

test("instruction cap never retains an oversized window and elapsed cap works without events", async (t) => {
  const limited = await new BehaviorCaptureRecorder(
    options({
      limits: { maxEvents: 3, maxMilliseconds: 1000 },
      readTrace: async () => batch([1, 2, 3, 4]),
    }),
  ).completion;
  t.is(limited.stopReason, "instruction-limit");
  t.is(limited.trace.chunks[0]!.addresses.length, 3);
  t.is(limited.excludedPolledEvents, 1);
  let time = 0;
  const timed = await new BehaviorCaptureRecorder(
    options({
      now: () => time,
      readTrace: async () => {
        time = 1001;
        return batch([]);
      },
    }),
  ).completion;
  t.is(timed.stopReason, "elapsed");
  t.is(timed.trace.chunks.length, 1);
});

for (const reason of ["manual", "breakpoint", "session-ended"] as BehaviorCaptureStopReason[]) {
  test(`behavior recorder handles ${reason} while a pull is in flight`, async (t) => {
    let resolve!: (value: ReturnType<typeof batch>) => void;
    let stops = 0;
    const recorder = new BehaviorCaptureRecorder(
      options({
        readTrace: () =>
          new Promise((done) => {
            resolve = done;
          }),
        stopTrace: async () => {
          stops++;
        },
      }),
    );
    recorder.requestStop(reason);
    resolve(batch([1, 2]));
    const result = await recorder.completion;
    t.is(result.stopReason, reason);
    t.is(result.trace.chunks.at(-1)!.active, reason === "session-ended");
    t.is(stops, reason === "session-ended" ? 0 : 1);
  });
}

test("producer errors and malformed batches preserve valid partial captures with no fabricated event", async (t) => {
  for (const invalid of [batch([1], 4), batch([-1]), { ...batch([1]), architecture: "other" }]) {
    let calls = 0;
    let stops = 0;
    const result = await new BehaviorCaptureRecorder(
      options({
        readTrace: async () => (++calls === 1 ? batch([8]) : invalid),
        stopTrace: async () => {
          stops++;
        },
      }),
    ).completion;
    t.is(result.stopReason, "error");
    t.deepEqual(
      result.trace.chunks.flatMap(({ addresses }) => addresses),
      [8],
    );
    t.true(result.trace.chunks.at(-1)!.active);
    t.is(stops, 1);
  }
});

test("loss-only pulls stay bounded and preserve loss at the final delimiter", async (t) => {
  let calls = 0;
  const result = await new BehaviorCaptureRecorder(
    options({
      limits: { maxEvents: 1, maxMilliseconds: 1000 },
      readTrace: async () => {
        calls++;
        return calls < 4 ? batch([], calls + 1, calls) : batch([9], 4, 3);
      },
    }),
  ).completion;
  t.is(result.stopReason, "instruction-limit");
  t.is(result.trace.chunks.length, 2);
  t.is(result.trace.chunks[0]!.droppedEvents, 3);
  t.is(result.trace.chunks[0]!.sequenceStart, 4);
});

test("trace lease rejects overlapping setup and releases idempotently", (t) => {
  const release = acquireTraceLease();
  t.throws(() => acquireTraceLease(), { message: /already active/ });
  release();
  const second = acquireTraceLease();
  release();
  t.throws(() => acquireTraceLease());
  second();
  t.notThrows(() => acquireTraceLease()());
});

test("behavior recorder rejects unsafe event and time bounds before pulling", (t) => {
  t.throws(
    () => new BehaviorCaptureRecorder(options({ limits: { maxEvents: 0, maxMilliseconds: 1000 } })),
  );
  t.throws(
    () =>
      new BehaviorCaptureRecorder(options({ limits: { maxEvents: 10, maxMilliseconds: 60001 } })),
  );
});

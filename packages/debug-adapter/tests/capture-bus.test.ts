import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, writeFile, rm, readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import test from "ava";

import { captureFixtureHeader } from "../../../tests/helpers/capture-archive.js";
import {
  busCapabilities,
  busChunk,
  busJsonFrame,
  busPosition,
  busScope,
  busSession,
} from "../../../tests/helpers/capture-bus.js";
import {
  LosslessCaptureFileRecorder,
  recoverCaptureFile,
  readCaptureFileHeader,
  exportCaptureJson,
} from "../src/capture-file.js";
import {
  captureCrc32c,
  decodeCaptureChunk,
  validateCaptureCapabilities,
  validateCapturePosition,
  validateCaptureRequest,
  type CaptureTransportV2,
  type CaptureBusAccessV2,
} from "../src/capture-v2.js";

test("bus decoding retains every actor/phase, exact counters, unowned contexts and raster timing", (t) => {
  const exact = 9007199254740993n;
  const b = busChunk(
    [
      { ordinal: exact, cycle: exact },
      {
        ordinal: exact,
        cycle: exact,
        actor: 1,
        phase: 1,
        channel: 7,
        direction: 1,
        address: 0x2122n,
        value: 0x1f,
      },
      ...[2, 3, 4].map((phase) => ({
        ordinal: 0n,
        context: 2,
        cycle: exact + 8n,
        actor: 2,
        phase,
        channel: 0,
      })),
      ...[0, 3, 4].map((context) => ({ ordinal: 0n, context, cycle: exact + 16n })),
    ],
    exact,
    exact,
  );
  const chunk = decodeCaptureChunk(b, busSession, busScope);
  t.is(chunk.sequence, String(exact));
  t.is(chunk.through, String(exact + 7n));
  t.deepEqual(chunk.accesses[0], {
    sequence: String(exact),
    ordinal: String(exact),
    cycle: String(exact),
    address: 0x808000,
    pc: 0x808000,
    value: 0xea,
    direction: "read",
    actor: "cpu",
    channel: null,
    phase: "cpu",
    context: "instruction",
    hcounter: 1367,
    vcounter: 312,
  });
  t.like(chunk.accesses[1], {
    direction: "write",
    actor: "dma",
    channel: 7,
    address: 0x2122,
    value: 0x1f,
  });
  t.deepEqual(
    chunk.accesses.slice(2, 5).map((a) => a.phase),
    ["hdma-table", "hdma-indirect", "hdma-transfer"],
  );
  t.deepEqual(
    chunk.accesses.slice(5).map((a) => a.context),
    ["unattributed", "wait", "stop"],
  );
  t.throws(() => decodeCaptureChunk(b, busSession), { message: /Unsupported required/ });
  t.throws(() => decodeCaptureChunk(busChunk(), busSession), { message: /Truncated/ });
  t.is(
    decodeCaptureChunk(busChunk(Array.from({ length: 4095 }, () => ({}))), busSession, busScope)
      .accesses.length,
    4095,
  );
  t.throws(
    () =>
      decodeCaptureChunk(busChunk(Array.from({ length: 4096 }, () => ({}))), busSession, busScope),
    { message: /bounds/ },
  );
});

test("bus decoding rejects inconsistent dictionaries, record shapes, ordering and checksums", (t) => {
  for (const fields of [
    { actor: 3 },
    { phase: 5 },
    { channel: 0 },
    { direction: 2 },
    { context: 5 },
    { ordinal: 0n },
    { context: 2 },
    { address: 0x1000000n },
    { pc: 0x1000000 },
    { hcounter: 1368 },
    { vcounter: 313 },
    { actor: 1, phase: 1, channel: 8 },
    { actor: 1, phase: 4, channel: 0 },
    { actor: 2, phase: 2, channel: 0, direction: 1 },
    { actor: 2, phase: 3, channel: 0, direction: 1 },
  ]) {
    t.throws(
      () => decodeCaptureChunk(busChunk([fields]), busSession, busScope),
      undefined,
      JSON.stringify(fields, (_, v) => (typeof v === "bigint" ? String(v) : v)),
    );
  }
  for (const [offset, value] of [
    [64, 1],
    [66, 2],
    [68, 63],
    [72, 2],
    [80, 1],
    [84, 1],
    [126, 1],
  ]) {
    const b = busChunk();
    b[offset] = value;
    b.writeUInt32LE(captureCrc32c(b, true), 56);
    t.throws(() => decodeCaptureChunk(b, busSession, busScope));
  }
  t.throws(
    () => decodeCaptureChunk(busChunk([{ cycle: 9n }, { cycle: 8n }]), busSession, busScope),
    { message: /backwards/ },
  );
  t.throws(() =>
    decodeCaptureChunk(
      busChunk([{}, {}], 1n, (1n << 64n) - 2n).subarray(0, 150),
      busSession,
      busScope,
    ),
  );
  const corrupted = busChunk();
  corrupted[116] ^= 1;
  t.throws(() => decodeCaptureChunk(corrupted, busSession, busScope), { message: /checksum/ });
  const wrongLength = busChunk();
  wrongLength.writeUInt32LE(2, 40);
  wrongLength.writeUInt32LE(captureCrc32c(wrongLength, true), 56);
  t.throws(() => decodeCaptureChunk(wrongLength, busSession, busScope), {
    message: /payload length/,
  });
});

test("scope negotiation binds the reserve and requires explicit bus positions", (t) => {
  t.deepEqual(validateCaptureCapabilities(busCapabilities, busScope), busCapabilities);
  t.throws(() => validateCaptureCapabilities(busCapabilities));
  t.throws(() =>
    validateCaptureCapabilities({ ...busCapabilities, requiredReserveBytes: 71 }, busScope),
  );
  t.throws(() => validateCaptureRequest({ operation: "capabilities", scope: "bus" } as never));
  t.notThrows(() =>
    validateCaptureRequest({ operation: "start", scope: busScope, bufferBytes: 4718656 }),
  );
  t.notThrows(() => validateCapturePosition(busPosition(), busSession, busScope));
  t.throws(() =>
    validateCapturePosition({ ...busPosition(), scope: undefined }, busSession, busScope),
  );
  t.throws(() => validateCapturePosition(busPosition(), busSession, "snes.65816.instructions"));
});

/** Deterministic transport checks that the consumer persists each checkpoint before releasing native retention. */
const recordBus = async (file: string, chunks: readonly Buffer[], failAck = false) => {
  let accepted = 0;
  let stopped = false;
  let aborted = false;
  const checkpoints: string[] = [];
  const events = () => chunks.slice(0, accepted).reduce((n, b) => n + b.readUInt32LE(40), 0);
  const transport: CaptureTransportV2 = async (request) => {
    if (request.operation === "capabilities") {
      if (request.scope !== busScope) {
        throw new Error("Missing bus negotiation");
      }
      return busCapabilities;
    }
    if (request.operation === "start") {
      if (request.scope !== busScope) {
        throw new Error("Missing bus start scope");
      }
      return busPosition();
    }
    if (request.operation === "read") {
      return { hex: chunks[accepted]?.toString("hex") ?? "" };
    }
    if (request.operation === "ack") {
      const recovered = await recoverCaptureFile(`${file}.partial`);
      if (recovered.eventThrough !== request.event) {
        throw new Error("Ack preceded durable checkpoint");
      }
      checkpoints.push(recovered.eventThrough);
      if (failAck) {
        throw new Error("Lost bus ack");
      }
      accepted++;
    }
    if (request.operation === "stop") {
      stopped = true;
    }
    if (request.operation === "abort") {
      aborted = true;
    }
    if (aborted) {
      return {
        ...busPosition(String(events()), String(accepted), "incomplete"),
        error: "consumer-aborted",
      };
    }
    return busPosition(
      String(events()),
      String(accepted),
      stopped && accepted === chunks.length ? "complete" : "recording",
    );
  };
  const recorder = await LosslessCaptureFileRecorder.create({
    context: false,
    ...captureFixtureHeader,
    scope: busScope,
    file,
    format: "act2",
    transport,
  });
  return { recorder, checkpoints, aborted: () => aborted };
};

test("bus recording checkpoints and recovers separate bus records without instruction export", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ares-bus-archive-"));
  t.teardown(() => rm(root, { recursive: true, force: true }));
  const file = path.join(root, "bus.act2");
  const emptyFile = path.join(root, "empty.act2");
  const empty = await recordBus(emptyFile, []);
  t.like(await empty.recorder.stop(), { scope: busScope, observedEvents: 0, complete: true });
  t.like(await recoverCaptureFile(emptyFile), { complete: true, eventThrough: "0" });
  const recording = await recordBus(file, [
    busChunk([{}, { actor: 1, phase: 1, channel: 7 }]),
    busChunk([{ ordinal: 0n, context: 2, actor: 2, phase: 2, channel: 1 }], 2n, 3n),
  ]);
  const summary = await recording.recorder.stop();
  t.like(summary, {
    scope: busScope,
    observedEvents: 3,
    droppedEvents: 0,
    chunks: 2,
    complete: true,
  });
  t.deepEqual(recording.checkpoints, ["2", "3"]);
  t.is((await readCaptureFileHeader(file)).scope, busScope);
  const accesses: CaptureBusAccessV2[] = [];
  const result = await recoverCaptureFile(file, (chunk) => {
    if (chunk.scope !== busScope) {
      throw new Error("Wrong recovered scope");
    }
    accesses.push(...chunk.accesses);
  });
  t.true(result.complete);
  t.deepEqual(
    accesses.map((a) => a.actor),
    ["cpu", "dma", "hdma"],
  );
  await t.throwsAsync(exportCaptureJson(file, path.join(root, "bad.json")), {
    message: /Bus capture cannot/,
  });
  t.deepEqual((await readdir(root)).sort(), ["bus.act2", "empty.act2"]);
  const bytes = await readFile(file);
  const firstAck = bytes.indexOf(Buffer.from("ACK2"));
  const secondData = bytes.indexOf(Buffer.from("ACT2"), firstAck);
  for (const [end, through] of [
    [firstAck, "0"],
    [firstAck + 5, "0"],
    [secondData, "2"],
    [secondData + 80, "2"],
    [bytes.length - 1, "3"],
  ] as const) {
    const partial = path.join(root, `torn-${end}`);
    await writeFile(partial, bytes.subarray(0, end));
    t.like(await recoverCaptureFile(partial), { complete: false, eventThrough: through });
  }
});

test("bus writer failure leaves only the durable prefix and never publishes a complete artifact", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ares-bus-failed-"));
  t.teardown(() => rm(root, { recursive: true, force: true }));
  const file = path.join(root, "bus.act2");
  const f = await recordBus(file, [busChunk()], true);
  await t.throwsAsync(f.recorder.completion, { message: /Lost bus ack/ });
  t.true(f.aborted());
  t.like(await recoverCaptureFile(`${file}.partial`), { complete: false, eventThrough: "1" });
  t.deepEqual(await readdir(root), ["bus.act2.partial"]);
  const backwards = await recordBus(path.join(root, "backwards.act2"), [
    busChunk([{ cycle: 10n }]),
    busChunk([{ cycle: 9n }], 2n, 2n),
  ]);
  await t.throwsAsync(backwards.recorder.completion, { message: /not contiguous/ });
  t.true(backwards.aborted());
  t.like(await recoverCaptureFile(path.join(root, "backwards.act2.partial")), {
    complete: false,
    eventThrough: "1",
  });
});

test("bus setup rejects JSON and wrong-scope starts without leaving an active producer", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ares-bus-setup-"));
  t.teardown(() => rm(root, { recursive: true, force: true }));
  const operations: string[] = [];
  const transport: CaptureTransportV2 = async (request) => {
    operations.push(request.operation);
    if (request.operation === "capabilities") {
      return busCapabilities;
    }
    return { ...busPosition(), scope: "snes.65816.instructions" };
  };
  const options = {
    ...captureFixtureHeader,
    scope: busScope,
    file: path.join(root, "bus.act2"),
    transport,
  } as const;
  await t.throwsAsync(
    LosslessCaptureFileRecorder.create({
      context: false,
      ...options,
      format: "json",
    }),
    {
      message: /requires ACT2/,
    },
  );
  t.deepEqual(operations, []);
  t.deepEqual(await readdir(root), []);
  await t.throwsAsync(
    LosslessCaptureFileRecorder.create({
      context: false,
      ...options,
      format: "act2",
    }),
    {
      message: /scope changed/,
    },
  );
  t.deepEqual(operations, ["capabilities", "start", "abort"]);
});

test("recovery rejects cross-chunk clock regressions and terminal scope changes", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ares-bus-recovery-"));
  t.teardown(() => rm(root, { recursive: true, force: true }));
  const header = busJsonFrame("ACS2", { ...captureFixtureHeader, scope: busScope });
  const first = busChunk([{ cycle: 20n }]);
  const ack = busJsonFrame("ACK2", { session: busSession, chunkThrough: "1", eventThrough: "1" });
  const file = path.join(root, "bus.act2");
  await writeFile(file, Buffer.concat([header, first, ack, busChunk([{ cycle: 19n }], 2n, 2n)]));
  t.like(await recoverCaptureFile(file), {
    complete: false,
    eventThrough: "1",
    reason: "Noncontiguous capture history.",
  });
  await writeFile(
    file,
    Buffer.concat([
      header,
      first,
      ack,
      busJsonFrame("END2", {
        ...busPosition("1", "1", "complete"),
        scope: "snes.65816.instructions",
      }),
    ]),
  );
  const recovered = await recoverCaptureFile(file);
  t.false(recovered.complete);
  t.regex(recovered.reason!, /scope changed/);
});

test("native bus producer and TypeScript decoder agree on full chunks and partial-instruction stop", (t) => {
  const lines = execFileSync(
    "sh",
    ["packages/debug-sidecar-ares/native/capture-bus/check-wire.sh"],
    { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 },
  )
    .trim()
    .split("\n");
  validateCaptureCapabilities(JSON.parse(lines[0]), busScope);
  const start = validateCapturePosition(JSON.parse(lines[1]), undefined, busScope);
  const first = decodeCaptureChunk(Buffer.from(lines[2], "hex"), start.session, busScope);
  const last = decodeCaptureChunk(Buffer.from(lines[3], "hex"), start.session, busScope);
  t.is(first.accesses.length, 4095);
  t.is(last.first, "4096");
  t.is(last.accesses.length, 5);
  t.true(
    first.accesses.every(
      (a) => a.ordinal === "1" && a.context === "instruction" && a.pc === 0x808000,
    ),
  );
  t.deepEqual(
    first.accesses.slice(0, 5).map((a) => a.phase),
    ["cpu", "dma", "hdma-table", "hdma-indirect", "hdma-transfer"],
  );
  t.is(
    validateCapturePosition(JSON.parse(lines[4]), start.session, busScope).producedThrough,
    "4100",
  );
});

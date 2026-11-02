import { mkdtemp, readFile, writeFile, rm, stat, readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import test from "ava";

import { compressCaptureChunk,recoverCaptureFile,exportCaptureJson,
  captureCrc32c,
  captureU64,
  decodeCaptureChunk,
  validateCaptureRequest,
  validateCapturePosition,
  type CapturePositionV2,
  type CaptureTransportV2 } from "@uttori/asm-capture";
import { LosslessCaptureFileRecorder, NativeCaptureFileRecorder } from "../src/capture-file.js";

const session = "0123456789abcdef0123456789abcdef";
const metadata = {
  architecture: "snes.65816",
  addressSpace: "snes.cpu",
  romContentSha256: "a".repeat(64),
  producer: { id: "synthetic", revision: "test" },
};
const capabilities = {
  version: 2,
  scope: "snes.65816.instructions",
  mode: "lossless",
  ownership: "durable-prefix",
  maxChunkBytes: 262144,
  requiredReserveBytes: 71,
  overheadBytes: 4194304,
  resumeSession: false,
} as const;
const position = (
  events = "0",
  chunks = "0",
  state: CapturePositionV2["state"] = "recording",
): CapturePositionV2 => ({
  session,
  scope: "snes.65816.instructions",
  state,
  producedThrough: events,
  deliveredThrough: events,
  acceptedThrough: events,
  durableThrough: events,
  releasedThrough: events,
  chunkThrough: chunks,
  producedChunks: chunks,
  bufferedBytes: 0,
  allocatedBytes: 4718656,
  clockNumerator: "236250000",
  clockDenominator: "11",
  throttleCount: "1",
  droppedInScope: "0",
  error: "",
});
const chunk = (sequence = 1n, event = 1n, opcode = 0xea): Buffer => {
  const b = Buffer.alloc(132);
  b.write("ACT2");
  b.writeUInt16LE(2, 4);
  Buffer.from(session, "hex").copy(b, 8);
  b.writeBigUInt64LE(sequence, 24);
  b.writeBigUInt64LE(event, 32);
  b.writeUInt32LE(1, 40);
  b.writeUInt32LE(64, 44);
  b.writeUInt32LE(68, 48);
  b.writeUInt32LE(68, 52);
  b.writeUInt16LE(1, 64);
  b.writeUInt16LE(1, 66);
  b.writeUInt32LE(68, 68);
  b.writeBigUInt64LE(event, 72);
  b.writeBigUInt64LE(event * 6n, 88);
  b.writeBigUInt64LE(event, 96);
  b.writeBigUInt64LE(0x7e0100n, 104);
  b[112] = 1;
  b.writeUInt16LE(16, 113);
  b[115] = opcode;
  b[127] = 0x7e;
  b.writeUInt16LE(0x0100, 128);
  b[130] = 0x30;
  b[131] = 1;
  b.writeUInt32LE(captureCrc32c(b, true), 56);
  return b;
};

test("ACT2 decodes exact u64 sequences and variants, rejects malformed envelopes and records", (t) => {
  t.is(captureCrc32c(Buffer.from("123456789")), 0xe3069283);
  const n = 9007199254740993n;
  t.is(decodeCaptureChunk(chunk(n, n), session).first, String(n));
  t.is(decodeCaptureChunk(chunk(1n, 1n, 0xe8), session).instructions[0]?.detail.bytes[0], 0xe8);
  t.is(decodeCaptureChunk(chunk(2n, 2n, 0xca), session).instructions[0]?.detail.bytes[0], 0xca);
  for (const value of [0, "01", "-1", "18446744073709551616", "1e3", ""]) {
    t.throws(() => captureU64(value));
  }
  for (const [offset, value] of [
    [0, 0],
    [6, 1],
    [8, 0],
    [44, 0],
    [48, 0],
    [52, 0],
    [60, 1],
    [64, 9],
    [66, 9],
    [68, 99],
    [72, 2],
    [80, 1],
    [84, 1],
    [96, 9],
    [112, 5],
    [113, 17],
    [127, 0],
    [131, 2],
  ]) {
    const b = chunk();
    b[offset!] = value!;
    b.writeUInt32LE(captureCrc32c(b, true), 56);
    t.throws(() => decodeCaptureChunk(b, session), undefined, `offset ${offset}`);
  }
  const b = chunk();
  b[115] = 0;
  t.throws(() => decodeCaptureChunk(b, session), { message: /checksum/ });
  t.throws(() => decodeCaptureChunk(Buffer.alloc(262145), session));
  t.throws(() =>
    validateCapturePosition({ ...position(), deliveredThrough: "1", producedThrough: "0" }),
  );
  t.throws(() =>
    validateCapturePosition({ ...position("2", "1", "complete"), durableThrough: "1" }),
  );
  t.throws(() =>
    validateCaptureRequest({ operation: "start", bufferBytes: 4718656, scope: "bus" }),
  );
});

const fixture = async (
  file: string,
  failAck = false,
  format: "json" | "act2" = "json",
  measureStages = false,
) => {
  let accepted = 0,
    stopped = false,
    aborted = false;
  const checkpointCounts: string[] = [];
  const transport: CaptureTransportV2 = async (request) => {
    if (request.operation === "capabilities") {
      return capabilities;
    }
    if (request.operation === "start") {
      return position("0", "0", "armed");
    }
    if (request.operation === "read") {
      return {
        hex:
          accepted < 2
            ? chunk(BigInt(accepted + 1), BigInt(accepted + 1), accepted ? 0xca : 0xe8).toString(
                "hex",
              )
            : "",
      };
    }
    if (request.operation === "ack") {
      const archive = format === "act2" ? file : `${file}.act2`;
      const recovery = await recoverCaptureFile(`${archive}.partial`);
      checkpointCounts.push(recovery.eventThrough);
      if (failAck) {
        throw new Error("Simulated lost acknowledgement");
      }
      accepted++;
      return position(String(accepted), String(accepted));
    }
    if (request.operation === "stop") {
      stopped = true;
      return position(String(accepted), String(accepted), accepted === 2 ? "complete" : "draining");
    }
    if (request.operation === "abort") {
      aborted = true;
      return {
        ...position(String(accepted), String(accepted), "incomplete"),
        error: "consumer-aborted",
      };
    }
    return position(
      String(accepted),
      String(accepted),
      stopped && accepted === 2 ? "complete" : "recording",
    );
  };
  const recorder = await LosslessCaptureFileRecorder.create({
    context: false,
    ...metadata,
    file,
    transport,
    format,
    measureStages,
  });
  return { recorder, checkpointCounts, aborted: () => aborted };
};

test("direct ACT2 recording stops with only the durable archive and preserves existing destinations", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "ares-direct-writer-"));
  t.teardown(() => rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, "trace.act2");
  const recording = await fixture(file, false, "act2");
  const summary = await recording.recorder.stop();
  t.is(summary.file, file);
  t.is(summary.archive, file);
  t.deepEqual(recording.checkpointCounts, ["1", "2"]);
  t.deepEqual(await readdir(directory), ["trace.act2"]);
  t.true((await recoverCaptureFile(file)).complete);
  const before = await readFile(file);
  await t.throwsAsync(fixture(file, false, "act2"), { message: /already exists/ });
  t.deepEqual(await readFile(file), before);
});

test("durable writer checkpoints before ack, drains on stop, and exports both RAM variants", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "ares-writer-"));
  const file = path.join(directory, "trace.json");
  try {
    const f = await fixture(file);
    const summary = await f.recorder.stop();
    t.true(summary.complete);
    t.is(summary.observedEvents, 2);
    t.is(summary.droppedEvents, 0);
    t.deepEqual(
      f.checkpointCounts,
      ["1", "2"],
      "ack is sent only after validated checkpoints exist on disk",
    );
    const json = JSON.parse(await readFile(file, "utf8"));
    t.true(json.chunks.every((c: { active: boolean }) => !c.active));
    t.deepEqual(
      json.chunks.map((c: { details: { bytes: number[] }[] }) => c.details[0]!.bytes),
      [[0xe8], [0xca]],
    );
    const recovered = await recoverCaptureFile(summary.archive);
    t.true(recovered.complete);
    t.is(recovered.eventThrough, "2");
    await t.throwsAsync(stat(`${file}.act2.partial`));
    const bytes = await readFile(summary.archive);
    const ack1 = bytes.indexOf(Buffer.from("ACK2"));
    const data2 = bytes.indexOf(Buffer.from("ACT2"), ack1);
    for (const [length, count] of [
      [ack1, "0"],
      [ack1 + 5, "0"],
      [data2, "1"],
      [data2 + 70, "1"],
      [bytes.length - 5, "2"],
    ] as const) {
      const partial = path.join(directory, `torn-${length}`);
      await writeFile(partial, bytes.subarray(0, length));
      const r = await recoverCaptureFile(partial);
      t.false(r.complete);
      t.is(r.eventThrough, count);
      await t.throwsAsync(exportCaptureJson(partial, `${partial}.json`));
    }
    bytes[data2 + 115] ^= 1;
    const corrupt = path.join(directory, "corrupt.act2");
    await writeFile(corrupt, bytes);
    const r = await recoverCaptureFile(corrupt);
    t.false(r.complete);
    t.is(r.eventThrough, "1");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("ack failure leaves a recoverable durable prefix and stops production without a final artifact", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "ares-failure-"));
  const file = path.join(directory, "trace.json");
  try {
    const f = await fixture(file, true);
    await t.throwsAsync(f.recorder.completion, { message: /lost acknowledgement/ });
    t.true(f.aborted());
    const r = await recoverCaptureFile(`${file}.act2.partial`);
    t.false(r.complete);
    t.is(r.eventThrough, "1");
    await t.throwsAsync(stat(`${file}.act2`));
    t.is((await stat(file)).size, 0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("opt-in capture profiling accounts bounded stage totals without changing archive identity", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "ares-profile-"));
  t.teardown(() => rm(directory, { recursive: true, force: true }));
  const plain = await (
    await fixture(path.join(directory, "plain.act2"), false, "act2")
  ).recorder.stop();
  const timed = await (
    await fixture(path.join(directory, "timed.act2"), false, "act2", true)
  ).recorder.stop();
  t.is(plain.timings, undefined);
  t.is(
    timed.timings?.bytes,
    compressCaptureChunk(chunk()).length + compressCaptureChunk(chunk(2n, 2n)).length,
  );
  t.is(timed.timings?.stages.dataSync.calls, 2);
  t.is(timed.timings?.stages.checkpointSync.calls, 2);
  t.is(timed.timings?.stages.ack.calls, 2);
  t.true(
    timed.timings!.elapsedMs >=
      Object.values(timed.timings!.stages).reduce((sum, stage) => sum + stage.totalMs, 0),
  );
  t.deepEqual(await readFile(plain.archive), await readFile(timed.archive));
});

test("native recorder waits for publication and sends control only", async (t) => {
  const operations: string[] = [];
  let stopped = false,
    drained = false;
  const transport: CaptureTransportV2 = async (request) => {
    operations.push(request.operation);
    if (request.operation === "file-capabilities") {
      return { ...capabilities, nativeFile: true };
    }
    if (request.operation === "file-stop") {
      stopped = true;
    }
    const complete = stopped && drained;
    const state = stopped ? "draining" : "armed";
    if (stopped) {
      drained = true;
    }
    return {
      ...position("0", "0", complete ? "complete" : state),
      fileState: complete ? "complete" : "writing",
      fileBytes: "100",
      fileBatches: "0",
    };
  };
  const recorder = await NativeCaptureFileRecorder.create({
    context: false,
    ...metadata,
    file: "/native-only/trace.act2",
    transport,
  });
  const summary = await recorder.stop();
  t.true(summary.complete);
  t.is(summary.archive, "/native-only/trace.act2");
  t.true(operations.every((operation) => operation.startsWith("file-")));
  t.true(operations.includes("file-stop"));
});

test("native recorder fails closed on writer error and rejects silent sink fallback", async (t) => {
  await t.throwsAsync(
    NativeCaptureFileRecorder.create({
      context: false,
      ...metadata,
      file: "/capture.act2",
      transport: async () => capabilities,
    }),
    { message: /does not support native/ },
  );
  const operations: string[] = [];
  const transport: CaptureTransportV2 = async (request) => {
    operations.push(request.operation);
    if (request.operation === "file-capabilities") {
      return { ...capabilities, nativeFile: true };
    }
    const failed = request.operation !== "file-start";
    return {
      ...position("0", "0", failed ? "incomplete" : "armed"),
      fileState: failed ? "incomplete" : "writing",
      fileBytes: "100",
      fileBatches: "0",
    };
  };
  const recorder = await NativeCaptureFileRecorder.create({
    context: false,
    ...metadata,
    file: "/capture.act2",
    transport,
  });
  await t.throwsAsync(recorder.completion, { message: /Native capture incomplete/ });
  t.true(operations.includes("file-abort"));
});

/** One native-layout Ricoh record, including all mapper registers and each fetched byte's PRG offset. */
function nesChunk(): Buffer {
  const b = Buffer.alloc(155);
  chunk().copy(b, 0, 0, 115);
  b.writeUInt32LE(91, 48);
  b.writeUInt32LE(91, 52);
  b.writeUInt32LE(91, 68);
  b.writeUInt32LE(1, 80);
  b.writeUInt32LE(1, 84);
  b.writeBigUInt64LE(0x8000n, 104);
  b[112] = 3;
  b.writeUInt16LE(37, 113);
  b.set([0x4c, 0, 0x80], 115);
  b[118] = 9;
  b[121] = 0xfd;
  b[122] = 0x24;
  b.writeUInt16LE(0x8000, 123);
  b.writeUInt16LE(4, 125);
  b[127] = 6;
  b[136] = 5;
  for (let i = 0; i < 3; i++) {
    b.writeUInt32LE(0xa000 + i, 143 + i * 4);
  }
  b.writeUInt32LE(captureCrc32c(b, true), 56);
  return b;
}

test("ACT2 Ricoh scope preserves mapper and per-fetch provenance without accepting SNES records", (t) => {
  const b = nesChunk();
  const decoded = decodeCaptureChunk(b, session, "nes.2a03.instructions");
  t.deepEqual(decoded.instructions[0].detail.bytes, [0x4c, 0, 0x80]);
  t.like(decoded.instructions[0].detail.state, {
    pc: 0x8000,
    a: 9,
    mapper: 4,
    r6: 5,
    prg0: 0xa000,
    prg1: 0xa001,
    prg2: 0xa002,
  });
  t.throws(() => decodeCaptureChunk(b, session));
  t.throws(() => decodeCaptureChunk(chunk(), session, "nes.2a03.instructions"));
  b[123] = 1;
  b.writeUInt32LE(captureCrc32c(b, true), 56);
  t.throws(() => decodeCaptureChunk(b, session, "nes.2a03.instructions"), {
    message: /pc|address/i,
  });
});

test("capture positions reject omitted scope instead of assuming an instruction stream", (t) => {
  const missing = { ...position() };
  Reflect.deleteProperty(missing, "scope");
  t.throws(() => validateCapturePosition(missing), { message: /scope/ });
});

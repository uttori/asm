import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, writeFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import test from "ava";

import {
  LosslessCaptureFileRecorder,
  recoverCaptureFile,
  exportCaptureJson,
} from "../src/capture-file.js";
import {
  captureCrc32c,
  captureU64,
  decodeCaptureChunk,
  validateCaptureRequest,
  validateCapturePosition,
  type CapturePositionV2,
  type CaptureTransportV2,
} from "../src/capture-v2.js";

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
  for (const value of [0, "01", "-1", "18446744073709551616", "1e3", ""])
    t.throws(() => captureU64(value));
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
    validateCaptureRequest({ operation: "start", bufferBytes: 4718656, scope: "bus" } as never),
  );
});

test("native bounded queue and TypeScript decoder agree on ACT2 framing and CRC", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "ares-queue-"));
  try {
    const executable = path.join(directory, "test");
    const env = {
      ...process.env,
      ...(process.platform === "darwin"
        ? {
            CPLUS_INCLUDE_PATH:
              "/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/c++/v1",
          }
        : {}),
    };
    execFileSync(
      "c++",
      [
        "-std=c++17",
        "-Wall",
        "-Wextra",
        "-Werror",
        "packages/debug-sidecar-ares/native/capture-v2/queue-test.cpp",
        "-o",
        executable,
      ],
      { env },
    );
    const hex = execFileSync(executable, { encoding: "utf8" }).trim();
    const bytes = Buffer.from(hex, "hex"),
      id = bytes.toString("hex", 8, 24);
    const decoded = decodeCaptureChunk(bytes, id);
    t.is(decoded.instructions.length, 3854);
    t.is(decoded.through, "3854");
    t.true(decoded.instructions.every((i) => i.address === 0x8000 && i.detail.bytes[0] === 0xea));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

const fixture = async (file: string, failAck = false) => {
  let accepted = 0,
    stopped = false,
    aborted = false;
  const checkpointCounts: string[] = [];
  const transport: CaptureTransportV2 = async (request) => {
    if (request.operation === "capabilities") return capabilities;
    if (request.operation === "start") return position("0", "0", "armed");
    if (request.operation === "read")
      return {
        hex:
          accepted < 2
            ? chunk(BigInt(accepted + 1), BigInt(accepted + 1), accepted ? 0xca : 0xe8).toString(
                "hex",
              )
            : "",
      };
    if (request.operation === "ack") {
      const recovery = await recoverCaptureFile(`${file}.act2.partial`);
      checkpointCounts.push(recovery.eventThrough);
      if (failAck) throw new Error("Simulated lost acknowledgement");
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
  const recorder = await LosslessCaptureFileRecorder.create({ ...metadata, file, transport });
  return { recorder, checkpointCounts, aborted: () => aborted };
};

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
    t.true(json.chunks.every((c: { active: boolean }) => c.active === false));
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

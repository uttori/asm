import { mkdtemp, mkdir, readFile, rm, writeFile, readdir, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import test from "ava";

import { verifyCaptureContext } from "../src/capture-context.js";
import { LosslessCaptureFileRecorder, recoverCaptureFile } from "../src/capture-file.js";
import {
  validateCaptureRequest,
  type CaptureTransportV2,
  type CapturePositionV2,
} from "../src/capture-v2.js";

const metadata = {
  architecture: "snes.65816",
  addressSpace: "snes.cpu",
  romContentSha256: "a".repeat(64),
  producer: { id: "ares", revision: "build" },
};
const session = "1".repeat(32);
const position = (state: CapturePositionV2["state"]): CapturePositionV2 => ({
  session,
  state,
  producedThrough: "0",
  deliveredThrough: "0",
  acceptedThrough: "0",
  durableThrough: "0",
  releasedThrough: "0",
  chunkThrough: "0",
  producedChunks: "0",
  bufferedBytes: 0,
  allocatedBytes: 8388608,
  throttleCount: "0",
  clockNumerator: "236250000",
  clockDenominator: "11",
  droppedInScope: "0",
  error: "",
});

/** Simulate native artifact writes while retaining the actual recorder's ordering,
 * no-clobber publication, hashing, and recovery checks. */
const fixture = (mismatch = false, graphicsWindowFrames: number | null = null) => {
  const calls: string[] = [];
  let directory = "",
    stopped = false;
  const transport: CaptureTransportV2 = async (request) => {
    calls.push(request.operation === "context" ? request.action : request.operation);
    if (request.operation === "capabilities") {
      return {
        version: 2,
        scope: "snes.65816.instructions",
        mode: "lossless",
        ownership: "durable-prefix",
        maxChunkBytes: 262144,
        requiredReserveBytes: 71,
        overheadBytes: 4194304,
        resumeSession: false,
      };
    }
    if (request.operation === "context") {
      if (request.action === "prepare") {
        directory = request.directory;
        await mkdir(directory);
        for (const [name, bytes] of Object.entries({
          "start.bst": Buffer.alloc(1024),
          "wram-start.bin": Buffer.alloc(131072),
          "identity.txt": Buffer.from("identity"),
          "machine.json": Buffer.from("{}"),
          "start-clock.txt": Buffer.from("1000"),
        })) {
          await writeFile(path.join(directory, name), bytes);
        }
        return { contextState: "prepared" };
      }
      if (request.action === "stop") {
        for (const [name, bytes] of Object.entries({
          "wram-end.bin": Buffer.alloc(131072, 17),
          "graphics.act2": Buffer.from("synthetic graphics fixture"),
          "inputs.bin": Buffer.alloc(18),
          "milestones.jsonl": Buffer.from("{}\n"),
          "end-clock.txt": Buffer.from("1000"),
          "boundaries.json": Buffer.from(
            JSON.stringify({
              session,
              end: { eventThrough: mismatch ? "1" : "0" },
              graphicsWindowFrames,
            }),
          ),
        })) {
          await writeFile(path.join(directory, name), bytes);
        }
        return { contextState: "complete" };
      }
      return { contextState: request.action === "abort" ? "aborted" : "recording" };
    }
    if (request.operation === "start") {
      return position("armed");
    }
    if (request.operation === "stop") {
      stopped = true;
      return position("complete");
    }
    if (request.operation === "read") {
      return { hex: "" };
    }
    return position(stopped ? "complete" : "armed");
  };
  return { calls, transport };
};

test("default recording publishes complete context only after matching ACT2 boundaries", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "capture-context-"));
  t.teardown(() => rm(root, { recursive: true, force: true }));
  const file = path.join(root, "capture.act2"),
    producer = fixture();
  const recorder = await LosslessCaptureFileRecorder.create({
    ...metadata,
    file,
    format: "act2",
    transport: producer.transport,
  });
  const directory = `${file}.context`;
  t.false((await readdir(directory)).includes("manifest.json"));
  const result = await recorder.stop();
  t.is(result.contextDirectory, directory);
  t.true((await recoverCaptureFile(file)).complete);
  await t.notThrowsAsync(verifyCaptureContext(directory, metadata));
  t.true(producer.calls.indexOf("prepare") < producer.calls.indexOf("start"));
  t.deepEqual(
    producer.calls.filter((call) => call === "stop"),
    ["stop", "stop"],
  );
  const manifest = JSON.parse(await readFile(path.join(directory, "manifest.json"), "utf8"));
  t.is(manifest.version, 1);
  t.is(manifest.files["wram-start.bin"].bytes, 131072);
  t.deepEqual(manifest.graphics, {
    scope: "snes.cpu-bus-ppu",
    windowFrames: null,
    file: "graphics.act2",
  });
  await t.throwsAsync(
    verifyCaptureContext(directory, { ...metadata, producer: { id: "ares", revision: "wrong" } }),
    { message: /matching ROM/ },
  );
  await writeFile(path.join(directory, "inputs.bin"), Buffer.alloc(18, 3));
  await t.throwsAsync(verifyCaptureContext(directory, metadata), { message: /checksum/ });
});

test("a runtime that cuts graphics short cannot publish a full-capture context manifest", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "capture-context-"));
  t.teardown(() => rm(root, { recursive: true, force: true }));
  const file = path.join(root, "capture.act2");
  const recorder = await LosslessCaptureFileRecorder.create({
    ...metadata,
    file,
    format: "act2",
    transport: fixture(false, 2).transport,
  });
  await t.throwsAsync(recorder.stop(), { message: /full-capture graphics/ });
  t.true((await recoverCaptureFile(file)).complete);
  t.false((await readdir(`${file}.context`)).includes("manifest.json"));
});

test("boundary mismatch preserves the archive without publishing a context manifest", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "capture-context-"));
  t.teardown(() => rm(root, { recursive: true, force: true }));
  const file = path.join(root, "capture.act2");
  const recorder = await LosslessCaptureFileRecorder.create({
    ...metadata,
    file,
    format: "act2",
    transport: fixture(true).transport,
  });
  await t.throwsAsync(recorder.stop(), { message: /boundary does not match/ });
  t.true((await recoverCaptureFile(file)).complete);
  t.false((await readdir(`${file}.context`)).includes("manifest.json"));
});

test("existing companion directories and unsupported context fail before arming", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "capture-context-"));
  t.teardown(() => rm(root, { recursive: true, force: true }));
  const file = path.join(root, "capture.act2"),
    producer = fixture();
  await mkdir(`${file}.context`);
  await t.throwsAsync(
    LosslessCaptureFileRecorder.create({
      ...metadata,
      file,
      format: "act2",
      transport: producer.transport,
    }),
  );
  t.false(producer.calls.includes("start"));
  const other = path.join(root, "other.act2");
  await t.throwsAsync(
    LosslessCaptureFileRecorder.create({
      ...metadata,
      file: other,
      format: "act2",
      transport: async (request) =>
        request.operation === "context"
          ? { contextState: "unsupported" }
          : producer.transport(request),
    }),
    { message: /prepared status/ },
  );
  t.false(producer.calls.includes("start"));
});

test("context request validation rejects path traversal inputs, extra fields and invalid labels", (t) => {
  t.throws(() =>
    validateCaptureRequest({
      operation: "context",
      action: "prepare",
      directory: "relative",
      ...metadata,
    } as never),
  );
  for (const label of ["", "  ", "\0", "😀".repeat(65)]) {
    t.throws(() =>
      validateCaptureRequest({ operation: "context", action: "mark", session, label }),
    );
  }
  t.throws(() =>
    validateCaptureRequest({ operation: "context", action: "status", directory: "/tmp" } as never),
  );
  t.notThrows(() =>
    validateCaptureRequest({
      operation: "context",
      action: "mark",
      session,
      label: "Sprite joins",
    }),
  );
});

test("replay verification rejects symlinked state files", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "capture-context-"));
  t.teardown(() => rm(root, { recursive: true, force: true }));
  const file = path.join(root, "capture.act2");
  const recorder = await LosslessCaptureFileRecorder.create({
    ...metadata,
    file,
    format: "act2",
    transport: fixture().transport,
  });
  await recorder.stop();
  const state = path.join(`${file}.context`, "start.bst"),
    other = path.join(root, "state");
  await writeFile(other, await readFile(state));
  await rm(state);
  await symlink(other, state);
  await t.throwsAsync(verifyCaptureContext(`${file}.context`, metadata), {
    message: /size\/type mismatch/,
  });
});

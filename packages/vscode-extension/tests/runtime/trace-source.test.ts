import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import test from "ava";

import {
  writeCaptureFixture,
  captureFixtureHeader,
} from "../../../../tests/helpers/capture-archive.js";
import {
  busChunk,
  busJsonFrame,
  busPosition,
  busScope,
  busSession,
} from "../../../../tests/helpers/capture-bus.js";
import { exportCaptureJson } from "../../../debug-adapter/src/capture-file.js";
import { captureCrc32c } from "../../../debug-adapter/src/capture-v2.js";
import {
  createRuntimeInstructionTraceImporter,
  importRuntimeInstructionTraceFile,
} from "../../../disassembler/src/index.js";
import { createEditorRuntimeTraceSource } from "../../src/runtime/trace-source.js";

test("instruction import rejects a bus archive before yielding project evidence", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "uttori-act2-bus-source-"));
  t.teardown(() => rm(root, { recursive: true, force: true }));
  const file = path.join(root, "bus.act2");
  await writeFile(
    file,
    Buffer.concat([
      busJsonFrame("ACS2", { ...captureFixtureHeader, scope: busScope }),
      busChunk(),
      busJsonFrame("ACK2", { session: busSession, chunkThrough: "1", eventThrough: "1" }),
      busJsonFrame("END2", busPosition("1", "1", "complete")),
    ]),
  );
  await t.throwsAsync(createEditorRuntimeTraceSource(file), {
    message: /CPU\/DMA\/HDMA bus accesses/,
  });
});

test("direct ACT2 consumption matches exported JSON facts, canonical identities", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "uttori-act2-source-"));
  t.teardown(() => rm(root, { recursive: true, force: true }));
  for (const events of [0, 2050]) {
    const archive = path.join(root, `${events}.act2`);
    const json = path.join(root, `${events}.json`);
    await writeCaptureFixture(archive, events);
    await exportCaptureJson(archive, json);
    for (const indexMode of ["full", "65816-disassembly"] as const) {
      const context = {
        projectRomContentSha256: captureFixtureHeader.romContentSha256,
        sourceName: "capture",
        indexMode,
      };
      const source = await createEditorRuntimeTraceSource(archive);
      const importer = createRuntimeInstructionTraceImporter(source.metadata, context);
      await source.read(importer.push);
      t.deepEqual(importer.finish(), await importRuntimeInstructionTraceFile(json, context));
    }
    // Detect content rather than trusting suffixes, including historical .json.act2 filenames.
    const renamed = path.join(root, `${events}.unknown`);
    await writeFile(renamed, await readFile(archive));
    t.deepEqual(
      (await createEditorRuntimeTraceSource(renamed)).metadata,
      (await createEditorRuntimeTraceSource(json)).metadata,
    );
  }
});

test("ACT2 sources reject invalid tails, changed identity, byte limits and cancellation", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "uttori-act2-fail-"));
  t.teardown(() => rm(root, { recursive: true, force: true }));
  const archive = path.join(root, "trace.act2");
  await writeCaptureFixture(archive, 2050);
  const bytes = await readFile(archive);
  await t.throwsAsync(createEditorRuntimeTraceSource(archive, { maxBytes: 10 }), {
    message: /byte limit/,
  });
  for (const invalid of [
    bytes.subarray(0, bytes.length - 1),
    Buffer.concat([bytes, Buffer.from("garbage")]),
  ]) {
    await writeFile(archive, invalid);
    const source = await createEditorRuntimeTraceSource(archive);
    await t.throwsAsync(
      source.read(() => {}),
      { message: /incomplete/ },
    );
  }
  await writeFile(archive, bytes);
  const controller = new AbortController();
  const source = await createEditorRuntimeTraceSource(archive, {
    signal: controller.signal,
    onProgress: () => controller.abort(),
  });
  await t.throwsAsync(
    source.read(() => {}),
    { name: "AbortError" },
  );
  const consumerError = new Error("index budget failed");
  const fresh = await createEditorRuntimeTraceSource(archive);
  t.is(
    await t.throwsAsync(
      fresh.read(() => {
        throw consumerError;
      }),
    ),
    consumerError,
  );
  const changed = Buffer.from(bytes);
  const headerLength = changed.readUInt32LE(4);
  const body = Buffer.from(
    changed.toString("utf8", 12, 12 + headerLength).replace("benchmark", "benchmarK"),
  );
  body.copy(changed, 12);
  changed.writeUInt32LE(captureCrc32c(body), 8);
  await writeFile(archive, changed);
  await t.throwsAsync(
    fresh.read(() => {}),
    { message: /identity changed/ },
  );
});

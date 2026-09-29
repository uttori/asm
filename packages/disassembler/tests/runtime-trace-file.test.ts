import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { canonicalJson } from "@uttori/asm-core/canonical-json";

import { test } from "../../../tests/ava-helper.js";
import {
  importRuntimeInstructionTrace,
  importRuntimeInstructionTraceFile,
  validateRuntimeInstructionTrace,
  type RuntimeInstructionTraceArtifact,
} from "../src/index.js";

const artifact: RuntimeInstructionTraceArtifact = {
  format: "uttori-asm-instruction-trace",
  schemaVersion: 1,
  architecture: "snes.65816",
  addressSpace: "snes.cpu",
  romContentSha256: "a".repeat(64),
  producer: { id: "ares", revision: 'unicode 🎮 and escaped " } ] \\ metadata' },
  chunks: [
    {
      sequenceStart: 1,
      addresses: [0x808000],
      droppedEvents: 0,
      active: true,
      details: [
        {
          bytes: [0xea],
          state: { p: 0x30 },
          memoryAccesses: [
            { access: "write", addressSpace: "snes.cpu", address: 0x2118, width: 1, value: 2 },
          ],
        },
      ],
    },
    { sequenceStart: 3, addresses: [0x808000], droppedEvents: 1, active: false },
  ],
};
const context = { projectRomContentSha256: artifact.romContentSha256, sourceName: "trace.json" };

test("streamed import preserves canonical hashes, rich facts across JSON layouts", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "uttori-trace-stream-"));
  t.teardown(() => rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, "trace.json");
  const expected = importRuntimeInstructionTrace(artifact, context);
  t.is(
    expected.sourceSha256,
    createHash("sha256")
      .update(canonicalJson(validateRuntimeInstructionTrace(artifact)))
      .digest("hex"),
  );
  for (const text of [
    JSON.stringify(artifact),
    JSON.stringify(artifact, undefined, 2),
    canonicalJson(artifact),
    JSON.stringify({
      chunks: artifact.chunks,
      ...Object.fromEntries(Object.entries(artifact).filter(([key]) => key !== "chunks")),
    }),
  ]) {
    await writeFile(file, text);
    t.deepEqual(await importRuntimeInstructionTraceFile(file, context), expected);
  }
  await writeFile(file, canonicalJson({ ...artifact, chunks: [] }));
  const empty = await importRuntimeInstructionTraceFile(file, context);
  t.is(
    empty.sourceSha256,
    createHash("sha256")
      .update(canonicalJson({ ...artifact, chunks: [] }))
      .digest("hex"),
  );
});

test("streamed trace values cross read boundaries and honor size budgets and cancellation", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "uttori-trace-boundary-"));
  t.teardown(() => rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, "trace.json");
  const large = {
    ...artifact,
    producer: { id: "ares", revision: `${" ".repeat(65500)}🎮\\"end` },
  };
  const text = JSON.stringify(large);
  await writeFile(file, text);
  await t.throwsAsync(importRuntimeInstructionTraceFile(file, context, { maxBytes: 1024 }), {
    message: /asm.trace.maxImportSizeMiB/,
  });
  const progress: number[] = [];
  t.deepEqual(
    await importRuntimeInstructionTraceFile(file, context, {
      maxBytes: Buffer.byteLength(text),
      onProgress: (read) => progress.push(read),
    }),
    importRuntimeInstructionTrace(large, context),
  );
  t.true(progress.includes(Buffer.byteLength(text)));
  const cancellation = new AbortController();
  await t.throwsAsync(
    importRuntimeInstructionTraceFile(file, context, {
      signal: cancellation.signal,
      onProgress: () => cancellation.abort(),
    }),
    { name: "AbortError" },
  );
});

test("streamed import rejects truncated, malformed and inconsistent suffixes before returning evidence", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "uttori-trace-invalid-"));
  t.teardown(() => rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, "trace.json");
  const text = JSON.stringify(artifact);
  for (const invalid of [
    text.slice(0, -1),
    `${text} garbage`,
    text.replace('"chunks":[', '"chunks":[').replace(/]}$/, ",]}"),
    text.replace(/}$/, ",}"),
    text.replace(/}$/, ',"schemaVersion":1}'),
    text.replace('"sequenceStart":3', '"sequenceStart":1'),
    text.replace('"droppedEvents":1', '"droppedEvents":0'),
    text.replace('"active":false', '"active":null'),
  ]) {
    await writeFile(file, invalid);
    await t.throwsAsync(importRuntimeInstructionTraceFile(file, context));
  }
  await writeFile(file, text);
  await t.throwsAsync(
    importRuntimeInstructionTraceFile(file, {
      ...context,
      projectRomContentSha256: "b".repeat(64),
    }),
    { message: /ROM\/project mismatch/ },
  );
});

test("streaming compact index validates the original rich capture before returning any import", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "uttori-trace-index-"));
  t.teardown(() => rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, "trace.json");
  const trace = {
    ...artifact,
    chunks: [
      {
        sequenceStart: 1,
        addresses: [0x7e2000, 0x7e2000],
        details: [
          { bytes: [0xea], state: { p: 0x30, x: 1 } },
          { bytes: [0xea], state: { p: 0x30, x: 2 } },
        ],
        droppedEvents: 0,
        active: false,
      },
    ],
  };
  const indexedContext = {
    ...context,
    indexMode: "65816-disassembly" as const,
    maxIndexRecords: 3,
  };
  await writeFile(file, JSON.stringify(trace));
  t.deepEqual(
    await importRuntimeInstructionTraceFile(file, indexedContext),
    importRuntimeInstructionTrace(trace, indexedContext),
  );
  await writeFile(file, JSON.stringify(trace) + " garbage");
  await t.throwsAsync(importRuntimeInstructionTraceFile(file, indexedContext));
  const cancellation = new AbortController();
  await writeFile(file, JSON.stringify(trace));
  await t.throwsAsync(
    importRuntimeInstructionTraceFile(file, indexedContext, {
      signal: cancellation.signal,
      onProgress: () => cancellation.abort(),
    }),
    { name: "AbortError" },
  );
});

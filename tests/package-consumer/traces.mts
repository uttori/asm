import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { ReplayDebugBackend, type ReplaySnapshot } from "@uttori/asm-debug-adapter";
import {
  ANALYSIS_PROJECT_SCHEMA_VERSION,
  RomImage,
  importRuntimeTraceIntoProject,
  importRuntimeTraceSourceIntoProject,
  loadAnalysisProjectSnapshot,
  validateRuntimeInstructionTraceMetadata,
  writeAnalysisProject,
  type RuntimeInstructionTraceArtifact,
} from "@uttori/asm-disassembler";

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-trace-consumer-"));
try {
  const directory = path.join(scratch, "analysis");
  const rom = new RomImage(new Uint8Array(0x8000));
  writeAnalysisProject(directory, {
    manifest: {
      format: "uttori-asm-analysis",
      schemaVersion: ANALYSIS_PROJECT_SCHEMA_VERSION,
      target: "fixture",
      rom: rom.identity,
      mapping: { mapper: "fixture", source: "override", candidates: [] },
      addressSpaces: [{ id: "snes.cpu", name: "CPU", addressBits: 24, kind: "cpu" }],
    },
    shards: {
      analysis: [],
      annotations: [],
      labels: [],
      comments: [],
      regions: [],
      imports: [],
      evidence: [],
      runtime: [],
    },
  });
  const artifact: RuntimeInstructionTraceArtifact = {
    format: "uttori-asm-instruction-trace",
    schemaVersion: 1,
    architecture: "snes.65816",
    addressSpace: "snes.cpu",
    romContentSha256: rom.identity.contentSha256,
    producer: { id: "installed-consumer", revision: "1" },
    chunks: [
      { sequenceStart: 1, addresses: [0x8000, 0x8001, 0x8000], droppedEvents: 0, active: false },
    ],
  };
  const file = path.join(scratch, "trace.json");
  const input = JSON.stringify(artifact);
  fs.writeFileSync(file, input);
  const context = {
    projectRomContentSha256: rom.identity.contentSha256,
    sourceName: file,
    indexMode: "65816-disassembly" as const,
  };
  const before = loadAnalysisProjectSnapshot(directory);
  await assert.rejects(
    importRuntimeTraceIntoProject(file, directory, context, { maxBytes: 1 }),
    /limit/i,
  );
  await assert.rejects(
    importRuntimeTraceIntoProject(file, directory, {
      ...context,
      projectRomContentSha256: "f".repeat(64),
    }),
    /mismatch/i,
  );
  await assert.rejects(
    importRuntimeTraceIntoProject(file, directory, { ...context, maxIndexRecords: 1 }),
    /index|budget/i,
  );
  const cancelled = new Error("cancelled at first chunk");
  const controller = new AbortController();
  await assert.rejects(
    importRuntimeTraceSourceIntoProject(
      {
        metadata: validateRuntimeInstructionTraceMetadata(artifact),
        read: async (accept) => {
          controller.abort(cancelled);
          accept(artifact.chunks[0]);
        },
      },
      directory,
      context,
      { signal: controller.signal },
    ),
    (error) => error === cancelled,
  );
  await assert.rejects(
    importRuntimeTraceSourceIntoProject(
      {
        metadata: validateRuntimeInstructionTraceMetadata(artifact),
        read: async (accept) => {
          accept(artifact.chunks[0]);
          throw new Error("terminal integrity failure");
        },
      },
      directory,
      context,
    ),
    /terminal integrity/,
  );
  assert.deepEqual(loadAnalysisProjectSnapshot(directory), before);

  // Run the guide verbatim, then verify a repeated import preserves its saved facts and revision.
  const guide = spawnSync(process.execPath, ["import-trace.mjs", directory, file], {
    encoding: "utf8",
    timeout: 30_000,
  });
  assert.equal(guide.status, 0, `${guide.stderr}\n${guide.stdout}`);
  const saved = loadAnalysisProjectSnapshot(directory);
  const repeat = await importRuntimeTraceIntoProject(file, directory, context);
  assert.equal(repeat.changed, false);
  assert.deepEqual(loadAnalysisProjectSnapshot(directory), saved);
  assert.equal(fs.readFileSync(file, "utf8"), input);

  const snapshots: ReplaySnapshot[] = [0x8000, 0x8001, 0x8002].map((address) => ({
    threads: [{ id: 1, name: "CPU", architecture: "snes.65816" }],
    frames: [
      {
        id: 1,
        threadId: 1,
        name: "CPU",
        pc: { architecture: "snes.65816", addressSpace: "snes.cpu", address },
      },
    ],
    registers: { 1: [{ name: "A", value: "00", bits: 8, group: "CPU" }] },
    memory: [{ addressSpace: "snes.cpu", start: 0x8000, bytes: [0xea, 0xea, 0xdb] }],
  }));
  const backend = new ReplayDebugBackend({ snapshots });
  const events: string[] = [];
  const subscription = backend.onEvent((event) => events.push(event.type));
  try {
    await backend.connect();
    assert.equal(events[0], "stopped");
    await backend.startTrace({ architecture: "snes.65816", addressSpace: "snes.cpu" });
    await backend.step(1, "instruction");
    await backend.stopTrace();
    assert.deepEqual((await backend.readTrace(2)).addresses, [0x8000, 0x8001]);
    assert.deepEqual((await backend.readTrace(2)).addresses, []);
    await backend.disconnect({ terminate: false });
    await backend.connect({ reset: false });
    assert.equal(backend.position, 1);
    assert.throws(
      () =>
        backend.readMemory({ architecture: "snes.65816", addressSpace: "unknown", address: 0 }, 1),
      /not readable/,
    );
    await backend.disconnect();
  } finally {
    subscription.dispose();
  }
  console.log(
    "Installed trace/debug: guide, limits, cancellation, rollback, reimport, ownership, and replay lifecycle passed",
  );
} finally {
  fs.rmSync(scratch, { recursive: true, force: true });
}

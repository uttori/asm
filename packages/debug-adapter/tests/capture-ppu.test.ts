import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { test } from "../../../tests/ava-helper.js";
import { captureFixtureHeader } from "../../../tests/helpers/capture-archive.js";
import { busJsonFrame } from "../../../tests/helpers/capture-bus.js";
import {
  ANALYSIS_PROJECT_SCHEMA_VERSION,
  RomImage,
  publishAnalysisProject,
  loadAnalysisProject,
  importRuntimeBusTraceSourceIntoProject,
  createRuntimeBusTraceImporter,
} from "../../disassembler/src/index.js";
import { createEditorRuntimeBusSource } from "../../vscode-extension/src/runtime/bus-source.js";
import { renderBusTraceReport } from "../../vscode-extension/src/runtime/bus-trace-report.js";
import { recoverCaptureFile } from "../src/capture-file.js";
import {
  captureCrc32c,
  decodeCaptureChunk,
  validateCaptureCapabilities,
  validateCapturePosition,
} from "../src/capture-v2.js";

test("native PPU effects survive framing, SQL import, duplicate import", async (t) => {
  const lines = execFileSync(
    "sh",
    ["packages/debug-sidecar-ares/native/capture-ppu/check-wire.sh"],
    {
      encoding: "utf8",
      maxBuffer: 4 * 1024 * 1024,
    },
  )
    .trim()
    .split("\n");
  const scope = "snes.cpu-bus-ppu";
  validateCaptureCapabilities(JSON.parse(lines[0]), scope);
  t.throws(() => validateCaptureCapabilities(JSON.parse(lines[0]), "snes.cpu-bus"));
  const start = validateCapturePosition(JSON.parse(lines[1]), undefined, scope);
  const terminal = validateCapturePosition(JSON.parse(lines.at(-1)!), start.session, scope);
  const chunks = lines.slice(2, -1).map((line) => Buffer.from(line, "hex"));
  const decoded = chunks.map((chunk) => decodeCaptureChunk(chunk, start.session, scope));
  t.is(decoded.length, 3);
  t.is(decoded[0].events[0].sequence, "1");
  t.is(decoded.at(-1)?.events.at(-1)?.sequence, "8000");
  const events = decoded.flatMap((chunk) => chunk.events);
  const effect = events[6];
  t.false("kind" in effect);
  if (!("kind" in effect)) {
    t.deepEqual(effect.ppu?.bytes, [
      { address: 536, value: 0xab },
      { address: 536, value: 255 },
    ]);
  }
  for (const legacy of [
    "snes.65816.instructions",
    "snes.cpu-bus",
    "snes.cpu-bus-transfers",
  ] as const) {
    t.throws(() => decodeCaptureChunk(chunks[0], start.session, legacy));
  }
  // Mutate each independent extension invariant while preserving a valid CRC.
  for (const [offset, value] of [
    [64 + 64, 0],
    [64 + 65, 3],
    [64 + 66, 2],
    [64 + 67, 3],
    [64 + 69, 255],
    [64 + 71, 255],
    [64 + 72, 255],
    [64 + 76, 1],
    [64 + 80, 0],
    [64 + 81, 1],
    [64 + 82, 1],
    [64 + 2, 1],
    [64 + 53, 0],
    [64 + 42, 0x40],
  ]) {
    const bad = Buffer.from(chunks[0]);
    bad[offset] = value;
    bad.writeUInt32LE(captureCrc32c(bad, true), 56);
    t.throws(() => decodeCaptureChunk(bad, start.session, scope));
  }
  const root = await mkdtemp(path.join(os.tmpdir(), "uttori-ppu-wire-"));
  t.teardown(() => rm(root, { recursive: true, force: true }));
  const file = path.join(root, "native.act2");
  const rom = new RomImage(new Uint8Array(0x8000)).identity;
  const frames = [
    busJsonFrame("ACS2", {
      ...captureFixtureHeader,
      scope,
      session: start.session,
      romContentSha256: rom.contentSha256,
    }),
  ];
  for (let i = 0; i < chunks.length; i++) {
    frames.push(
      chunks[i],
      busJsonFrame("ACK2", {
        session: start.session,
        chunkThrough: decoded[i].sequence,
        eventThrough: decoded[i].through,
      }),
    );
  }
  frames.push(busJsonFrame("END2", terminal));
  await writeFile(file, Buffer.concat(frames));
  t.true((await recoverCaptureFile(file)).complete);
  const source = await createEditorRuntimeBusSource(file);
  const importer = createRuntimeBusTraceImporter(source.metadata, {
    projectRomContentSha256: rom.contentSha256,
    sourceName: "native.act2",
  });
  await source.read(importer.push);
  const result = importer.finish();
  t.is(result.observedEvents, 8000);
  t.is(result.summary.ppu?.portWrites, 7000);
  t.is(result.summary.ppu?.written, 4000);
  t.is(result.summary.ppu?.blocked, 1000);
  t.is(result.summary.ppu?.latched, 2000);
  t.is(result.summary.ppu?.byteWrites, 6000);
  t.is(result.summary.ppu?.writes.length, 64);
  t.is(result.summary.ppu?.omittedWrites, 6936);
  t.is(result.summary.graphics, undefined);
  const reject = createRuntimeBusTraceImporter(source.metadata, {
    projectRomContentSha256: rom.contentSha256,
    sourceName: "invalid.act2",
  });
  const first = events[0];
  if ("kind" in first) {
    throw new Error("Expected bus event");
  }
  t.throws(() => reject.push({ accesses: [{ ...first, ppu: undefined }] }));
  t.throws(() => reject.finish());
  const malformed = createRuntimeBusTraceImporter(source.metadata, {
    projectRomContentSha256: rom.contentSha256,
    sourceName: "invalid.act2",
  });
  t.throws(() =>
    malformed.push({
      accesses: [{ ...first, ppu: { ...first.ppu, bytes: [{ address: 131072, value: 255 }] } }],
    }),
  );
  const directory = path.join(root, "analysis");
  publishAnalysisProject(directory, {
    manifest: {
      format: "uttori-asm-analysis",
      schemaVersion: ANALYSIS_PROJECT_SCHEMA_VERSION,
      target: "fixture",
      rom,
      mapping: { mapper: "fixture", source: "override", candidates: [] },
      addressSpaces: [{ id: "snes.cpu", name: "CPU", addressBits: 24, kind: "cpu" }],
    },
    shards: {
      analysis: [],
      annotations: [],
      labels: [],
      comments: [],
      regions: [],
      runtime: [],
      evidence: [],
      imports: [],
    },
  });
  const context = { projectRomContentSha256: rom.contentSha256, sourceName: "native.act2" };
  const committed = await importRuntimeBusTraceSourceIntoProject(source, directory, context);
  t.is(committed.report.imported["ppu.byteWrites"], 6000);
  t.regex(renderBusTraceReport(committed), /Verified PPU writes/);
  t.regex(renderBusTraceReport(committed), /blocked/);
  const duplicate = await importRuntimeBusTraceSourceIntoProject(source, directory, context);
  t.false(duplicate.changed);
  const stored = loadAnalysisProject(directory);
  t.is(stored.shards.imports[0].imported["ppu.byteWrites"], 6000);
  const repeated = stored.shards.runtime.find(
    (r) =>
      r.kind === "runtime-bus-access" && r.ppu?.target === "oam" && r.ppu.outcome === "written",
  );
  t.truthy(repeated);
  if (repeated?.kind === "runtime-bus-access") {
    t.is(repeated.count, 1000);
    t.deepEqual(repeated.ppu?.bytes, [
      { address: 536, value: 0xab },
      { address: 536, value: 255 },
    ]);
    t.false("hcounter" in repeated.ppu!);
  }
});

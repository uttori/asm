import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createRuntimeBusCaptureSource } from "@uttori/asm-disassembler";

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
import { renderBusTraceReport } from "../../vscode-extension/src/runtime/bus-trace-report.js";
import { recoverCaptureFile } from "../src/capture-file.js";
import {
  captureCrc32c,
  decodeCaptureChunk,
  validateCaptureCapabilities,
  validateCapturePosition,
} from "../src/capture-v2.js";

test("native transfer framing survives chunk boundaries, archive recovery and neutral analysis", async (t) => {
  const lines = execFileSync(
    "sh",
    ["packages/debug-sidecar-ares/native/capture-transfer/check-wire.sh"],
    {
      encoding: "utf8",
      maxBuffer: 2 * 1024 * 1024,
    },
  )
    .trim()
    .split("\n");
  const scope = "snes.cpu-bus-transfers";
  validateCaptureCapabilities(JSON.parse(lines[0]), scope);
  t.throws(() => validateCaptureCapabilities(JSON.parse(lines[0]), "snes.cpu-bus"));
  const start = validateCapturePosition(JSON.parse(lines[1]), undefined, scope);
  const terminal = validateCapturePosition(JSON.parse(lines.at(-1)!), start.session, scope);
  const chunks = lines.slice(2, -1).map((line) => Buffer.from(line, "hex"));
  const decoded = chunks.map((chunk) => decodeCaptureChunk(chunk, start.session, scope));
  t.is(decoded.length, 2);
  t.is(decoded[0].events[0].sequence, "1");
  t.is(decoded[1].events.at(-1)?.sequence, "4102");
  t.throws(() => decodeCaptureChunk(chunks[0], start.session, "snes.cpu-bus"));
  for (const [offset, value] of [
    [64 + 52, 3],
    [64 + 54, 8],
    [64 + 71, 16],
    [64 + 76, 1],
  ]) {
    const bad = Buffer.from(chunks[0]);
    bad[offset] = value;
    bad.writeUInt32LE(captureCrc32c(bad, true), 56);
    t.throws(() => decodeCaptureChunk(bad, start.session, scope));
  }
  const root = await mkdtemp(path.join(os.tmpdir(), "uttori-transfer-wire-"));
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
  const source = await createRuntimeBusCaptureSource(file);
  const importer = createRuntimeBusTraceImporter(source.metadata, {
    projectRomContentSha256: rom.contentSha256,
    sourceName: "native.act2",
  });
  await source.read(importer.push);
  const result = importer.finish();
  t.is(result.observedEvents, 4100);
  t.is(result.report.imported.transferMarkers, 2);
  t.is(result.summary.transfers?.activity[0].complete, 1);
  t.is(result.summary.transfers?.activity[0].attemptedSlots, 2050);
  t.is(result.summary.transfers?.windows[0].reads, 2050);
  t.is(result.summary.transfers?.windows[0].begin?.configuration.das, 2050);
  t.is(result.summary.transfers?.windows[0].end?.configuration.das, 0);
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
  t.is(committed.report.imported["dma0.complete"], 1);
  t.regex(renderBusTraceReport(committed), /DMA\/0 \| complete/);
  const duplicate = await importRuntimeBusTraceSourceIntoProject(source, directory, context);
  t.false(duplicate.changed);
  t.is(loadAnalysisProject(directory).shards.imports[0].imported["dma0.attemptedSlots"], 2050);
});

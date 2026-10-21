import { readFile, mkdtemp, rm, writeFile, readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { type CaptureTransportV2, type CapturePositionV2 } from "@uttori/asm-capture";
import { decodeNesBusRecords } from "@uttori/asm-capture";
import { LosslessCaptureFileRecorder } from "@uttori/asm-debug-adapter";
import {
  RomImage,
  publishAnalysisProject,
  openAnalysisProjectStore,
  readResearchInputs,
} from "@uttori/asm-disassembler";
import {
  reconcileSourceCaptureCatalog,
  fingerprintSourceCapture,
} from "@uttori/asm-disassembler/source-project";
import test from "ava";

import { createNesGraphicsProjection } from "../src/nes/ppu-evidence.js";
import { importNesPPUCapture } from "../src/nes/ppu-project.js";
import {
  decodeNesPPUSnapshot,
  renderNesPPUViews,
  summarizeNesPPUCapture,
  nesPPUHtml,
} from "../src/nes/ppu.js";

const fixtures = new URL("../../debug-adapter/tests/fixtures/nes-ppu/", import.meta.url);
test("native NPP1 snapshot validates mapped windows and remains independent of caller storage", async (t) => {
  const bytes = await readFile(new URL("ppu-snapshot.bin", fixtures));
  const snapshot = decodeNesPPUSnapshot(bytes);
  t.is(snapshot.patterns.length, 8192);
  t.is(snapshot.nametables.length, 4096);
  t.is(snapshot.mappings[0].offset, 4096);
  t.is(snapshot.patterns[0], 4);
  bytes.fill(0);
  t.is(snapshot.patterns[0], 4);
  t.throws(() => decodeNesPPUSnapshot(bytes));
  const html = nesPPUHtml(snapshot, { rom: "</script><script>alert(1)</script>" });
  t.false(html.includes("<script>alert(1)"));
  t.true(html.includes("Nametables"));
});

test("PPU views use attribute quadrants, palette aliases and 8x16 sprite flips", async (t) => {
  const native = decodeNesPPUSnapshot(await readFile(new URL("ppu-snapshot.bin", fixtures)));
  const patterns = new Uint8Array(8192),
    nametables = new Uint8Array(4096),
    palette = Uint8Array.from({ length: 32 }, (_, i) => i),
    oam = new Uint8Array(256);
  patterns[16] = 0x80; // Tile 1: top-left pixel = 1.
  nametables[0] = 1;
  nametables[2] = 1;
  nametables[960] = 2 << 2; // Second quadrant selects palette 2.
  const snapshot = { ...native, patterns, nametables, palette, oam, control: 0, mask: 0 };
  const views = renderNesPPUViews(snapshot);
  t.is(views.nametables[0], 1);
  t.is(views.nametables[16], 9);
  t.is(views.nametables[17], 0);
  // An 8x16 sprite with tile bit 0 set uses pattern table 1, independent of PPUCTRL bit 3.
  patterns[256 * 16] = 0x80;
  oam[1] = 1;
  oam[2] = 0xc1;
  const tall = renderNesPPUViews({ ...snapshot, control: 0x20 });
  t.is(tall.sprites[15 * 128 + 7], 21);
  t.is(tall.sprites[0], 0);
  t.is(renderNesPPUViews({ ...snapshot, mask: 1 }).nametables[16], 0);
});

/** Transport returns actual native bytes while exercising archive durability and identity checks. */
async function archive(file: string): Promise<void> {
  const chunk = await readFile(new URL("ppu-bus.chunk", fixtures)),
    session = chunk.toString("hex", 8, 24);
  let accepted = false,
    stopped = false;
  const position = (): CapturePositionV2 => ({
    scope: "nes.cpu-bus-ppu",
    session,
    state: stopped && accepted ? "complete" : "recording",
    producedThrough: accepted ? "3" : "0",
    deliveredThrough: accepted ? "3" : "0",
    acceptedThrough: accepted ? "3" : "0",
    durableThrough: accepted ? "3" : "0",
    releasedThrough: accepted ? "3" : "0",
    chunkThrough: accepted ? "1" : "0",
    producedChunks: accepted ? "1" : "0",
    bufferedBytes: 0,
    allocatedBytes: 4718656,
    throttleCount: "0",
    clockNumerator: "236250000",
    clockDenominator: "11",
    droppedInScope: "0",
    error: "",
  });
  const transport: CaptureTransportV2 = async (request) => {
    if (request.operation === "capabilities") {
      return {
        version: 2,
        scope: "nes.cpu-bus-ppu",
        mode: "lossless",
        ownership: "durable-prefix",
        maxChunkBytes: 262144,
        requiredReserveBytes: 128,
        overheadBytes: 4194304,
        resumeSession: false,
      };
    }
    if (request.operation === "start") {
      return { ...position(), state: "armed" };
    }
    if (request.operation === "read") {
      return { hex: accepted ? "" : chunk.toString("hex") };
    }
    if (request.operation === "ack") {
      accepted = true;
    }
    if (request.operation === "stop") {
      stopped = true;
    }
    return position();
  };
  const recorder = await LosslessCaptureFileRecorder.create({
    file,
    format: "act2",
    scope: "nes.cpu-bus-ppu",
    architecture: "65xx.2a03",
    addressSpace: "nes.cpu",
    romContentSha256: "a".repeat(64),
    romFileSha256: "b".repeat(64),
    producer: { id: "synthetic", revision: "native-test" },
    context: false,
    transport,
  });
  await recorder.stop();
}

test("NES graphics import validates the whole archive, rejects wrong ROMs and is idempotent", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "nes-ppu-"));
  t.teardown(() => rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, "capture.act2");
  await archive(file);
  const options = {
    file,
    directory: path.join(directory, "reports"),
    romContentSha256: "a".repeat(64),
    romFileSha256: "b".repeat(64),
  };
  const summary = await summarizeNesPPUCapture(file, options);
  t.is(summary.events, 3);
  t.is(summary.blockedWrites, 2);
  t.is(summary.writes.length, 2);
  const first = await importNesPPUCapture(options);
  t.true(first!.changed);
  t.is(first!.added.runtime, 0);
  t.false((await importNesPPUCapture(options))!.changed);
  await t.throwsAsync(importNesPPUCapture({ ...options, romFileSha256: "c".repeat(64) }), {
    message: /identity/,
  });
  const bytes = await readFile(file);
  await writeFile(file, bytes.subarray(0, bytes.length - 4));
  await t.throwsAsync(importNesPPUCapture(options));
  t.is((await readdir(options.directory)).length, 1);
});

test("graphics SQLite import is idempotent and joins only owned physical CPU fetch identities", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "nes-graphics-sql-"));
  t.teardown(() => rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, "capture.act2");
  await archive(file);
  const evidenceDirectory = path.join(directory, "evidence");
  publishAnalysisProject(evidenceDirectory, {
    manifest: {
      format: "uttori-asm-analysis",
      schemaVersion: 3,
      target: "65xx.nes",
      rom: {
        ...new RomImage(new Uint8Array(32768)).identity,
        sha256: "b".repeat(64),
        contentSha256: "a".repeat(64),
      },
      mapping: { mapper: "ines:4", source: "detected", candidates: [] },
      addressSpaces: [{ id: "nes.cpu", name: "CPU", kind: "cpu", addressBits: 16 }],
    },
    shards: {
      analysis: [],
      annotations: [],
      labels: [],
      comments: [],
      regions: [],
      evidence: [],
      imports: [],
      runtime: [],
    },
  });
  await writeFile(
    path.join(directory, "research.json"),
    JSON.stringify({
      format: "uttori-research",
      version: 1,
      project: "graphics-test",
      romSha256: "a".repeat(64),
      decisions: [
        {
          collection: "evidence",
          id: "manual-note",
          value: { id: "manual-note", source: "manual", sourceId: "test", confidence: "high" },
        },
      ],
    }),
  );
  const research = readResearchInputs(directory, ["research.json"], {
    project: "graphics-test",
    romSha256: "a".repeat(64),
  });
  const initial = openAnalysisProjectStore(evidenceDirectory);
  initial.transaction(() => initial.synchronizeResearchInputs(research));
  initial.close();
  const options = {
    file,
    directory: path.join(directory, "reports"),
    evidenceDirectory,
    research,
    romFileSha256: "b".repeat(64),
    romContentSha256: "a".repeat(64),
  };
  const first = (await importNesPPUCapture(options))!;
  t.is(first.added.runtime, 3);
  const store = openAnalysisProjectStore(evidenceDirectory);
  const revision = store.revision();
  store.close();
  t.false((await importNesPPUCapture(options))!.changed);
  const reopened = openAnalysisProjectStore(evidenceDirectory);
  t.teardown(() => reopened.close());
  t.is(reopened.revision(), revision);
  t.true(reopened.loadTable("evidence").some((entry) => entry.id === "manual-note"));
  const query = { architecture: "65xx.2a03", addressSpace: "nes.cpu" };
  t.true(reopened.graphicsEvidence(query).every((row) => row.instructionVariants === 0));
  const chunk = await readFile(new URL("ppu-bus.chunk", fixtures));
  const original = decodeNesBusRecords(chunk, 1n, 3)[1];
  if ("timeline" in original) {
    throw new Error("Expected bus fixture");
  }
  const projection = createNesGraphicsProjection();
  projection.push({
    ...original,
    pc: 0x8000,
    pcPrgOffset: 0x4000,
    context: "instruction",
    actor: "oam-dma",
  });
  projection.push({ ...original, pc: 0x8000, pcPrgOffset: 0x4000, context: "interrupt" });
  const hash = "c".repeat(64);
  reopened.transaction(() => {
    reopened.mergeEvidenceBatch({
      evidence: [
        {
          id: `runtime:graphics:${hash}`,
          source: "runtime",
          sourceId: "fixture",
          confidence: "certain",
        },
      ],
      runtime: [
        ...projection.finish(hash),
        ...[0x4000, 0x6000].map((prg0) => ({
          id: `cpu-${prg0}`,
          kind: "runtime-instruction" as const,
          architecture: "65xx.2a03",
          addressSpace: "nes.cpu",
          address: 0x8000,
          bytes: [0x8d, 7, 0x20],
          state: { prg0 },
          count: 3,
          evidence: [`runtime:graphics:${hash}`],
        })),
      ],
    });
  });
  const rows = reopened.graphicsEvidence({
    ...query,
    captureSha256: hash,
    pc: 0x8000,
    physicalOffset: 0x4000,
  });
  t.is(rows.length, 2);
  t.is(rows.find((row) => row.graphics.context === "instruction")!.instructionVariants, 1);
  t.is(rows.find((row) => row.graphics.context === "instruction")!.instructionObservations, 3);
  t.is(rows.find((row) => row.graphics.context === "interrupt")!.instructionVariants, 0);
  const catalog = reconcileSourceCaptureCatalog(
    { format: "uttori-capture-catalog", version: 1, romSha256: "a".repeat(64), captures: [] },
    reopened.loadTable("imports"),
    {
      sourceSha256: first.sourceSha256,
      archive: await fingerprintSourceCapture(file),
    },
  );
  t.is(catalog.captures[0].profile, "nes-graphics-v1");
  t.is(catalog.captures[0].observedEvents, 3);
  t.is(catalog.captures[0].archives[0].name, "capture.act2");
  t.is(reopened.captureCatalog().length, 1);
});

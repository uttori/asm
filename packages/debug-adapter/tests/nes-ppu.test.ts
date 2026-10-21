import { readFile } from "node:fs/promises";

import test from "ava";

import {
  captureCrc32c,
  decodeCaptureChunk,
  validateCaptureCapabilities,
} from "@uttori/asm-capture";

const fixture = new URL("./fixtures/nes-ppu/ppu-bus.chunk", import.meta.url);
test("native NES PPU wire records retain palette aliases, restrictions and PRG provenance", async (t) => {
  const bytes = await readFile(fixture),
    session = bytes.toString("hex", 8, 24);
  const chunk = decodeCaptureChunk(bytes, session, "nes.cpu-bus-ppu");
  t.is(chunk.events.length, 3);
  const events = chunk.events.filter((event) => !("timeline" in event));
  t.deepEqual(events[0].effect, { target: "oam", outcome: "blocked", bytes: [] });
  t.deepEqual(events[1].effect, {
    target: "palette",
    outcome: "written",
    bytes: [
      { offset: 16, value: 63 },
      { offset: 0, value: 63 },
    ],
  });
  t.deepEqual(events[2].effect, { target: "chr-rom", outcome: "blocked", bytes: [] });
  t.is(events[1].address, 0x3fff);
  t.is(events[1].before.busAddress, 0x3f10);
  t.is(events[1].after.busAddress, events[1].after.v & 0x3fff);
  t.throws(() => decodeCaptureChunk(bytes, session, "snes.cpu-bus-ppu"));
  for (const [offset, value] of [
    [46, 4],
    [47, 1],
    [102, 6],
    [104, 3],
    [105, 1],
    [118, 4],
    [124, 1],
    [85, 2],
  ]) {
    const corrupt = Buffer.from(bytes);
    corrupt[64 + offset] = value;
    corrupt.writeUInt32LE(captureCrc32c(corrupt, true), 56);
    t.throws(() => decodeCaptureChunk(corrupt, session, "nes.cpu-bus-ppu"));
  }
  t.is(
    validateCaptureCapabilities(
      {
        version: 2,
        scope: "nes.cpu-bus-ppu",
        mode: "lossless",
        ownership: "durable-prefix",
        maxChunkBytes: 262144,
        requiredReserveBytes: 128,
        overheadBytes: 4194304,
        resumeSession: false,
      },
      "nes.cpu-bus-ppu",
    ).requiredReserveBytes,
    128,
  );
});

test("native PPU fetch and A12 records retain device clocks and reject corrupt IRQ state", async (t) => {
  const bytes = await readFile(new URL("./fixtures/nes-ppu/ppu-timeline.chunk", import.meta.url));
  const session = bytes.toString("hex", 8, 24);
  const chunk = decodeCaptureChunk(bytes, session, "nes.cpu-bus-ppu");
  const timeline = chunk.events.filter((event) => "timeline" in event);
  t.true(
    timeline.some(
      (event) => event.timeline === "fetch" && event.source === "ppu" && event.mapping !== null,
    ),
  );
  t.true(
    timeline.some((event) => event.timeline === "a12" && event.before.a12 !== event.after.a12),
  );
  t.true(timeline.some((event) => event.deviceCycle !== event.cycle));
  const index = chunk.events.findIndex((event) => "timeline" in event);
  for (const [offset, value] of [
    [56, 4],
    [57, 3],
    [59, 4],
    [69, 7],
    [98, 2],
    [127, 1],
  ]) {
    const corrupt = Buffer.from(bytes);
    corrupt[64 + index * 128 + offset] = value;
    corrupt.writeUInt32LE(captureCrc32c(corrupt, true), 56);
    t.throws(() => decodeCaptureChunk(corrupt, session, "nes.cpu-bus-ppu"));
  }
});

test("MMC3 board output and CPU IRQ pin propagation remain separate events", async (t) => {
  const bytes = await readFile(new URL("./fixtures/nes-ppu/ppu-irq.chunk", import.meta.url));
  const chunk = decodeCaptureChunk(bytes, bytes.toString("hex", 8, 24), "nes.cpu-bus-ppu");
  const timeline = chunk.events.filter((event) => "timeline" in event);
  const pins = timeline.filter((event) => event.timeline === "irq-pin");
  t.deepEqual(
    pins.map((event) => [event.source, event.cpuIrq]),
    [
      ["cartridge", true],
      ["cartridge", false],
    ],
  );
  const assertion = timeline.find(
    (event) => event.timeline === "a12" && !event.before.output && event.after.output,
  )!;
  t.truthy(assertion);
  t.false(assertion.cpuIrq);
  t.true(BigInt(assertion.sequence) < BigInt(pins[0].sequence));
  const clear = timeline.find(
    (event) => event.timeline === "mapper-write" && event.before.output && !event.after.output,
  )!;
  t.truthy(clear);
  t.true(clear.cpuIrq);
  t.true(BigInt(clear.sequence) < BigInt(pins[1].sequence));
});

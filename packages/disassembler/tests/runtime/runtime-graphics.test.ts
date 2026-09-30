import fs from "node:fs";

import { test } from "../../../../tests/ava-helper.js";
import {
  createRuntimeBusTraceImporter,
  createRuntimeGraphicsAccumulator,
  validateRuntimeBusTraceMetadata,
  type RuntimeBusAccess,
} from "../../src/index.js";

/** Small bus driver: implicit sequence/cycle values stay contiguous across register/data operations. */
const fixture = () => {
  const accumulator = createRuntimeGraphicsAccumulator();
  const accesses: RuntimeBusAccess[] = [];
  const port = (address: number, value = 0, patch: Partial<RuntimeBusAccess> = {}) => {
    const access: RuntimeBusAccess = {
      sequence: String(accesses.length + 1),
      cycle: String(accesses.length * 8),
      ordinal: "0",
      pc: 0x808000,
      address,
      value,
      direction: "write",
      actor: "cpu",
      channel: null,
      phase: "cpu",
      context: "unattributed",
      hcounter: 100,
      vcounter: 100,
      ...patch,
    };
    accesses.push(access);
    accumulator.push(access);
    return access.sequence;
  };
  return { port, accesses, finish: accumulator.finish };
};

test("VRAM ports apply all mappings, increment ports and increments before physical masking", (t) => {
  // Hand-evaluated word-address bit permutations for $83a5, shared with the native PPU oracle.
  const mapped = [0x83a5, 0x832d, 0x832e, 0x812f];
  for (let mapping = 0; mapping < 4; mapping++) {
    for (let high = 0; high < 2; high++) {
      const f = fixture();
      f.port(0x2115, (high << 7) | (mapping << 2));
      f.port(0x2116, 0xa5);
      f.port(0x2117, 0x83);
      f.port(0x2118, 0x12);
      f.port(0x2119, 0x34);
      const { writes } = f.finish();
      t.is(writes[0]!.bytes[0]!.address, mapped[mapping]! * 2);
      // Incrementing $83a5 changes its low group by one, therefore eight mapped words.
      const increment = mapping === 0 ? 1 : 8;
      t.is(writes[1]!.bytes[0]!.address, (mapped[mapping]! + (high ? 0 : increment)) * 2 + 1);
      t.is(writes[0]!.forcedBlank, null);
    }
  }
  for (let size = 0; size < 4; size++) {
    const f = fixture();
    f.port(0x2115, 0x80 | size);
    f.port(0x2116, 0xff);
    f.port(0x2117, 0xff);
    f.port(0x2119, 0x55);
    f.port(0x2118, 0xaa);
    t.deepEqual(
      f.finish().writes.map((w) => w.bytes[0]!.address),
      [0x1ffff, [0, 62, 254, 254][size]],
    );
  }
});

test("VRAM reads advance the selected port; partial register knowledge never invents an address", (t) => {
  const f = fixture();
  f.port(0x2118); // Neither address nor VMAIN observed.
  f.port(0x2116, 0xff);
  f.port(0x2117, 0x12);
  f.port(0x2119); // Unknown increment policy invalidates both address halves.
  f.port(0x2115, 0x80);
  f.port(0x2116, 0);
  f.port(0x2118);
  f.port(0x2117, 0x20);
  f.port(0x2139, 0, { direction: "read" });
  f.port(0x2118, 1);
  f.port(0x213a, 0, { direction: "read" });
  f.port(0x2118, 2);
  const writes = f.finish().writes;
  t.deepEqual(
    writes.slice(0, 3).map((w) => w.status),
    ["unknown", "unknown", "unknown"],
  );
  t.deepEqual(
    writes.slice(3).map((w) => w.bytes[0]!.address),
    [0x4000, 0x4002],
  );

  const partial = fixture();
  partial.port(0x2115, 0);
  partial.port(0x2116, 0xff);
  partial.port(0x2118);
  partial.port(0x2117, 0x12);
  partial.port(0x2118);
  t.true(partial.finish().writes.every((w) => w.status === "unknown"));
});

test("CGRAM pairs preserve latch provenance, mask high data, wrap, and share phase with reads", (t) => {
  const f = fixture();
  f.port(0x2122, 9);
  f.port(0x2121, 0xff);
  const low = f.port(0x2122, 0xab, { actor: "dma", channel: 2, phase: "dma" });
  const high = f.port(0x2122, 0xff, { actor: "hdma", channel: 1, phase: "hdma-transfer" });
  f.port(0x213b, 0, { direction: "read" }); // Low read doesn't overwrite the data latch.
  const reused = f.port(0x2122, 0x81);
  const writes = f.finish().writes;
  t.is(writes[0]!.status, "unknown");
  t.is(writes[1]!.status, "latched");
  t.deepEqual(writes[2]!.bytes, [
    { address: 510, value: 0xab, sourceSequence: low },
    { address: 511, value: 0x7f, sourceSequence: high },
  ]);
  t.deepEqual(writes[3]!.bytes, [
    { address: 0, value: 0xab, sourceSequence: low },
    { address: 1, value: 1, sourceSequence: reused },
  ]);
  t.is(writes[2]!.actor, "hdma");
  t.is(f.finish().activity.find((g) => g.actor === "hdma")!.knownValueTargets, 2);
});

test("CGRAM address reset preserves the write latch; an unobserved low value stays null", (t) => {
  const f = fixture();
  f.port(0x213b, 0, { direction: "read" });
  f.port(0x2121, 3);
  f.port(0x213b, 0, { direction: "read" });
  f.port(0x2122, 0x42);
  const low = f.port(0x2122, 0x12);
  f.port(0x2121, 8);
  f.port(0x213b, 0, { direction: "read" });
  f.port(0x2122, 0x34);
  const writes = f.finish().writes;
  t.deepEqual(writes[0]!.bytes[0], { address: 6, value: null, sourceSequence: null });
  t.deepEqual(writes[2]!.bytes[0], { address: 16, value: 0x12, sourceSequence: low });
  t.is(f.finish().activity[0]!.knownValueTargets, 3);
});

test("OAM pairs, high-table mirrors, pointer wrap and read increments match port semantics", (t) => {
  const f = fixture();
  f.port(0x2100, 0x80);
  f.port(0x2102, 0xff);
  f.port(0x2103, 0);
  const low = f.port(0x2104, 0xab);
  const high = f.port(0x2104, 0xcd);
  f.port(0x2104, 0xef);
  f.port(0x2102, 0xff);
  f.port(0x2103, 1); // Base $3fe maps to high-table $21e.
  const latch = f.port(0x2104, 0x56);
  f.port(0x2104, 0x78);
  f.port(0x2138, 0, { direction: "read" }); // Wrapped pointer $000 -> $001. Retains latch.
  const last = f.port(0x2104, 0x9a);
  const writes = f.finish().writes;
  t.deepEqual(writes[1]!.bytes, [
    { address: 510, value: 0xab, sourceSequence: low },
    { address: 511, value: 0xcd, sourceSequence: high },
  ]);
  t.deepEqual(
    writes.slice(2, 5).map((w) => w.bytes[0]!.address),
    [512, 542, 543],
  );
  t.deepEqual(writes[5]!.bytes, [
    { address: 0, value: 0x56, sourceSequence: latch },
    { address: 1, value: 0x9a, sourceSequence: last },
  ]);
});

test("OAM requires known forced blank and address setup, and never reuses uncertain latch data", (t) => {
  const f = fixture();
  f.port(0x2102, 0);
  f.port(0x2103, 0);
  f.port(0x2104, 1);
  f.port(0x2100, 0x80);
  f.port(0x2104, 2);
  f.port(0x2102, 0);
  f.port(0x2104, 3);
  f.port(0x2100, 0x80);
  f.port(0x2104, 4); // Same bit can still trigger an internal reset.
  f.port(0x2103, 0);
  f.port(0x2138, 0, { direction: "read" });
  f.port(0x2104, 5);
  f.port(0x2100, 0);
  f.port(0x2102, 0);
  f.port(0x2104, 6);
  t.deepEqual(
    f.finish().writes.map((w) => w.status),
    ["unknown", "unknown", "latched", "unknown", "addressed", "unknown"],
  );
  t.is(f.finish().writes[4]!.bytes[0]!.value, null);
  const partial = fixture();
  partial.port(0x2100, 0x80);
  partial.port(0x2102, 0);
  partial.port(0x2104, 1);
  t.is(partial.finish().writes[0]!.status, "unknown");
});

test("PPU bank mirrors and write-only register reads cannot corrupt tracked state", (t) => {
  const f = fixture();
  f.port(0xbf2115, 0x80);
  f.port(0x802116, 0);
  f.port(0x3f2117, 0);
  f.port(0x7e2117, 0xff);
  f.port(0x402115, 0);
  f.port(0xc02116, 0xff);
  f.port(0x2117, 0xff, { direction: "read" });
  f.port(0xbf2118, 0x12);
  f.port(0xff2118, 0x34);
  t.is(f.finish().writes.length, 1);
  t.is(f.finish().writes[0]!.bytes[0]!.address, 0);
});

test("graphics reports remain bounded while all actors and channels retain exact totals", (t) => {
  const f = fixture();
  f.port(0x2100, 0x80);
  f.port(0x2102, 0);
  f.port(0x2103, 1);
  f.port(0x2115, 0x80);
  f.port(0x2116, 0);
  f.port(0x2117, 0);
  f.port(0x2121, 0);
  for (let group = 0; group < 17; group++) {
    let patch: Partial<RuntimeBusAccess> = {};
    if (group > 0 && group < 9) {
      patch = { actor: "dma", channel: group - 1, phase: "dma" };
    } else if (group >= 9) {
      patch = { actor: "hdma", channel: group - 9, phase: "hdma-transfer" };
    }
    for (let i = 0; i < 100; i++) {
      for (const port of [0x2118, 0x2122, 0x2104]) {
        f.port(port, i, patch);
      }
    }
  }
  const summary = f.finish();
  t.is(summary.activity.length, 51);
  t.true(summary.activity.every((g) => g.portWrites === 100));
  t.is(summary.writes.length, 64);
  t.is(summary.omittedWrites, 5100 - 64);
});

test("bus import reconstructs across chunk boundaries without changing source identity or fact meaning", (t) => {
  const f = fixture();
  f.port(0x2121, 8);
  f.port(0x2122, 0x12);
  f.port(0x2122, 0xff);
  const metadata = validateRuntimeBusTraceMetadata({
    format: "uttori-asm-bus-trace",
    schemaVersion: 1,
    scope: "snes.cpu-bus",
    architecture: "snes.65816",
    addressSpace: "snes.cpu",
    romContentSha256: "a".repeat(64),
    session: "b".repeat(32),
    producer: { id: "test", revision: "1" },
    clock: { id: "snes.master", numerator: "1", denominator: "1" },
  });
  const context = {
    projectRomContentSha256: metadata.romContentSha256,
    sourceName: "graphics.act2",
  };
  const whole = createRuntimeBusTraceImporter(metadata, context);
  whole.push({ accesses: f.accesses });
  const result = whole.finish();
  const split = createRuntimeBusTraceImporter(metadata, context);
  for (const access of f.accesses) {
    split.push({ accesses: [access] });
  }
  t.deepEqual(split.finish(), result);
  t.deepEqual(result.summary.graphics, f.finish());
  t.is(result.batch.runtime?.length, 3);
  t.true(
    result.batch.runtime?.every(
      (r) => r.kind === "runtime-bus-access" && r.addressSpace === "snes.cpu",
    ),
  );
  t.deepEqual(result.report.imported, { busEvents: 3, busRecords: 3, unownedEvents: 3 });
});

test("port candidates reproduce native PPU readback for CPU and DMA uploads", (t) => {
  // Generated by C++ against both ares PPUs. The shell runner checks identical output.
  const oracle = JSON.parse(
    fs.readFileSync(
      new URL(
        "../../../debug-sidecar-ares/native/capture-graphics/ppu-port-oracle.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as {
    vramBytes: number;
    scenarios: {
      name: string;
      accesses: { address: number; value: number; direction: "read" | "write"; actor: 0 | 1 }[];
      memory: { target: string; address: number; value: number }[];
    }[];
  };
  t.is(oracle.scenarios.length, 18);
  for (const scenario of oracle.scenarios) {
    const f = fixture();
    for (const access of scenario.accesses) {
      const dma = access.actor === 1;
      f.port(access.address, access.value, {
        direction: access.direction,
        actor: dma ? "dma" : "cpu",
        channel: dma ? 0 : null,
        phase: dma ? "dma" : "cpu",
      });
    }
    const candidates = new Map<string, { target: string; address: number; value: number }>();
    for (const write of f.finish().writes) {
      for (const byte of write.bytes) {
        t.not(byte.value, null, scenario.name);
        let address = byte.address;
        if (write.target === "vram") {
          address &= oracle.vramBytes - 1;
        }
        candidates.set(`${write.target}:${address}`, {
          target: write.target,
          address,
          value: byte.value!,
        });
      }
    }
    const order = (
      a: { target: string; address: number },
      b: { target: string; address: number },
    ) => a.target.localeCompare(b.target) || a.address - b.address;
    t.deepEqual(
      [...candidates.values()].filter((byte) => byte.value !== 0).sort(order),
      scenario.memory.sort(order),
      scenario.name,
    );
  }
});

import { CRC32 } from "@uttori/asm-core";
import { RomImage, type AnalysisTargetOverrideRecord } from "@uttori/asm-disassembler";

import { test } from "../../../tests/ava-helper.js";
import {
  analyzeSnes65816,
  importMesen65816Trace,
  importMesenSnesCdl,
} from "../src/index.js";

const fixtureRom = (): RomImage => {
  const bytes = new Uint8Array(0x8000).fill(0xea);
  bytes.set([0xad, 0x00, 0x90, 0x6c, 0x00, 0x90], 0);
  bytes[0x10] = 0xdb;
  return new RomImage(bytes);
};

const contextFor = (rom: RomImage) => ({
  sourceName: "fixture",
  projectRomContentSha256: rom.identity.contentSha256,
  projectMapper: "lorom" as const,
});

const cdlFor = (rom: RomImage): Uint8Array => {
  const output = new Uint8Array(9 + rom.length);
  output.set(new TextEncoder().encode("CDLv2"));
  const crc = CRC32.compute(rom.bytes());
  output.set([crc & 0xff, (crc >>> 8) & 0xff, (crc >>> 16) & 0xff, crc >>> 24], 5);
  output.set([0x11, 0x11, 0x11, 0x11, 0x11, 0x11], 9);
  output[9 + 0x10] = 0x11;
  output[9 + 0x20] = 0x02;
  return output;
};

test("MesenCE CDLv2 import verifies the ROM and derives 65816 instructions", (t) => {
  const rom = fixtureRom();
  const result = importMesenSnesCdl(cdlFor(rom), rom, "lorom", contextFor(rom));
  t.is(result.report.imported.decodedInstructions, 3);
  t.is(result.batch.runtime?.filter((record) => record.kind === "runtime-execution").length, 3);
  t.true(
    result.batch.runtime?.some(
      (record) => record.kind === "runtime-coverage" && record.coverage === "read",
    ) ?? false,
  );
  const firstOpcode = result.batch.annotations?.find(
    (annotation) => annotation.classification === "opcode" && annotation.start === 0,
  );
  t.deepEqual(firstOpcode?.state, { e: false, m: false, x: true, programBank: 128 });
  t.deepEqual(firstOpcode?.points, ["in"]);

  const badCrc = cdlFor(rom);
  badCrc[5] ^= 0xff;
  t.throws(() => importMesenSnesCdl(badCrc, rom, "lorom", contextFor(rom)), {
    message: /CRC mismatch/,
  });
  t.throws(() => importMesenSnesCdl(rom.bytes(), rom, "lorom", contextFor(rom)), {
    message: /requires a CDLv2 header/,
  });
});

test("MesenCE trace import captures state, memory, exact widths, and indirect targets", (t) => {
  const rom = fixtureRom();
  const trace = [
    "808000  LDA $9000 [$7E1234] = $ABCD A:0000 X:0010 Y:0020 S:01FF D:1000 DB:7E P:00 ",
    "808003  JMP ($9000) [$808010] A:ABCD X:0010 Y:0020 S:01FF D:1000 DB:7E P:00 ",
    "808010  STP A:ABCD X:0010 Y:0020 S:01FF D:1000 DB:7E P:00 ",
    "",
  ].join("\n");
  const metadata = {
    schemaVersion: 1 as const,
    architecture: "snes.65816" as const,
    romContentSha256: rom.identity.contentSha256,
    mapper: "lorom" as const,
  };
  const result = importMesen65816Trace(trace, metadata, rom, "lorom", contextFor(rom));
  t.is(result.report.imported.traceLines, 3);
  const executions = result.batch.runtime?.filter((record) => record.kind === "runtime-execution");
  t.deepEqual(
    executions?.map((record) => [record.address, record.size]),
    [
      [0x808000, 3],
      [0x808003, 3],
      [0x808010, 1],
    ],
  );
  const memory = result.batch.runtime?.find((record) => record.kind === "runtime-memory-access");
  t.like(memory, {
    accessedAddress: 0x7e1234,
    access: "read",
    width: 2,
    value: 0xabcd,
  });
  const target = result.batch.runtime?.find((record) => record.kind === "runtime-control-target");
  t.like(target, { fromAddress: 0x808003, toAddress: 0x808010, indirect: true });
  t.deepEqual(result.batch.analysis?.[0], {
    id: "runtime:target-override:snes.cpu:808003",
    kind: "target-override",
    addressSpace: "snes.cpu",
    address: 0x808003,
    targets: [0x808010],
    evidence: [result.batch.evidence?.[0].id],
  });

  const analyzed = analyzeSnes65816(rom, "lorom", {
    annotations: result.batch.annotations,
    evidence: result.batch.evidence,
    targetOverrides: result.batch.analysis?.filter(
      (record): record is AnalysisTargetOverrideRecord => record.kind === "target-override",
    ),
  });
  t.false(analyzed.unresolved.some((flow) => flow.address === 0x808003));
  t.true(
    analyzed.edges.some(
      (edge) =>
        edge.fromAddress === 0x808003 &&
        edge.toAddress === 0x808010 &&
        edge.override === "runtime:target-override:snes.cpu:808003",
    ),
  );

  t.throws(
    () =>
      importMesen65816Trace(
        trace,
        { ...metadata, romContentSha256: "0".repeat(64) },
        rom,
        "lorom",
        contextFor(rom),
      ),
    { message: /Trace\/ROM mismatch/ },
  );
});

test("MesenCE evidence rejects project ROM and mapper mismatches before parsing", (t) => {
  const rom = fixtureRom();
  t.throws(
    () =>
      importMesenSnesCdl(cdlFor(rom), rom, "lorom", {
        ...contextFor(rom),
        projectRomContentSha256: "f".repeat(64),
      }),
    { message: /ROM\/project mismatch/ },
  );
  t.throws(
    () =>
      importMesenSnesCdl(cdlFor(rom), rom, "lorom", {
        ...contextFor(rom),
        projectMapper: "hirom",
      }),
    { message: /Mapper\/project mismatch/ },
  );
});

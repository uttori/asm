import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { Assembler } from "../packages/core/src/assembler.js";
import { runWithInternalInstrumentation } from "../packages/core/src/internal-instrumentation.js";
import {
  create65xxAssemblerEnvironment,
  RAW_65XX_TARGET_ID,
} from "../packages/plugin-65xx/src/index.js";
import {
  createSnesAssemblerEnvironment,
  SNES_TARGET_ID,
} from "../packages/plugin-snes/src/index.js";
import { initializeAnalysisFixture } from "../tests/helpers/source-render-fixture.js";

/** SHA-256 receipts cover every source/input used by the deterministic fixture. */
const hash = (data: string | Uint8Array): string => createHash("sha256").update(data).digest("hex");
const median = (values: number[]): number =>
  values.toSorted((a, b) => a - b)[Math.floor(values.length / 2)];
const root = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-ast-benchmark-"));
const snes = await createSnesAssemblerEnvironment();
const cpu = await create65xxAssemblerEnvironment();
try {
  const rom = new Uint8Array(0x8000).fill(0xea);
  rom.set([0xa9, 1, 0x8d, 0, 0x20, 0x60]);
  rom.fill(0x20, 0x7fc0, 0x7fd5);
  rom[0x7fd5] = 0x20;
  rom[0x7fd7] = 5;
  rom.set([0xcb, 0xed, 0x34, 0x12], 0x7fdc);
  rom.fill(0, 0x7fe0);
  rom.set([0, 0x80], 0x7ffc);
  fs.writeFileSync(path.join(root, "fixture.sfc"), rom);
  await initializeAnalysisFixture({
    romFile: path.join(root, "fixture.sfc"),
    outputDirectory: path.join(root, "generated"),
    mapper: "lorom",
  });
  const cases = [
    {
      name: "65xx",
      source:
        "org $8000\n" +
        Array.from(
          { length: 256 },
          (_, i) => `Label${i}:\nlda #${i & 255}\nsta $0200+${i},x\nlda Label${(i + 1) % 256}\n`,
        ).join(""),
      cpu: true,
    },
    {
      name: "generated-snes",
      source: fs.readFileSync(path.join(root, "generated/main.asm"), "utf8"),
      file: path.join(root, "generated/main.asm"),
      expected: hash(rom),
    },
    {
      name: "spc700",
      source: "lorom\norg $808000\narch spc700\n" + "mov a,#7\nmov $20,a\ninc a\n".repeat(512),
      expected: hash(
        Uint8Array.from(Array.from({ length: 512 }, () => [0xe8, 7, 0xc4, 0x20, 0xbc]).flat()),
      ),
    },
    {
      name: "superfx",
      source: "lorom\norg $808000\narch superfx\n" + "nop\nstop\n".repeat(1024),
      expected: hash(Uint8Array.from(Array.from({ length: 1024 }, () => [1, 0]).flat())),
    },
    {
      name: "macro-string-struct",
      source:
        'lorom\norg $808000\nstruct Pair $0000\n.a: skip 1\n.b: skip 1\nendstruct\nmacro emit(value)\ndb "AB", <value>\nendmacro\n' +
        Array.from({ length: 256 }, (_, i) => `%emit(${i & 255})\ndw Pair.b\n`).join(""),
    },
    {
      name: "large-generated",
      source:
        "lorom\norg $808000\n" +
        Array.from({ length: 4096 }, (_, i) => `Block${i}: db (${i & 255} + 1) & $ff\n`).join(""),
      expected: hash(Uint8Array.from({ length: 4096 }, (_, i) => (i + 1) & 255)),
    },
  ];
  const workloads = [];
  for (const fixture of cases) {
    const file = fixture.file ?? path.join(root, `${fixture.name}.asm`);
    const samples = [];
    let outputHash: string | undefined;
    let retainedSyntaxBytes = 0;
    const run = () => {
      const assembler = new Assembler({
        environment: fixture.cpu ? cpu : snes,
        target: fixture.cpu ? RAW_65XX_TARGET_ID : SNES_TARGET_ID,
        targetOptions: fixture.cpu ? { origin: 0x8000 } : { checksumEnabled: false },
        collectSourceMetadata: true,
      });
      assembler.includePaths = [path.dirname(file)];
      try {
        assembler.assembleSource(fixture.source, file);
        return assembler.getBinaryOutput();
      } finally {
        assembler.dispose();
      }
    };
    // Instrumented observations are outside every throughput sample and never become a timing gate.
    for (let i = 0; i < 8; i++) {
      const start = performance.now();
      const bytes = run();
      const wallMs = performance.now() - start;
      const sha256 = hash(bytes);
      outputHash ??= sha256;
      assert.equal(sha256, fixture.expected ?? outputHash);
      samples.push({ state: i === 0 ? "cold" : "warm", wallMs, bytes: bytes.length, sha256 });
    }
    const instrumented = runWithInternalInstrumentation(run);
    assert.equal(hash(instrumented.value), outputHash);
    const parser = new Assembler({
      environment: fixture.cpu ? cpu : snes,
      target: fixture.cpu ? RAW_65XX_TARGET_ID : SNES_TARGET_ID,
    });
    try {
      retainedSyntaxBytes = Buffer.byteLength(
        JSON.stringify(parser.buildProgramModel(fixture.source, fixture.name + ".asm")),
      );
    } finally {
      parser.dispose();
    }
    const warm = samples.slice(1).map((s) => s.wallMs);
    const middle = median(warm);
    workloads.push({
      name: fixture.name,
      inputSha256: hash(fixture.source),
      samples,
      warm: {
        medianMs: middle,
        madMs: median(warm.map((n) => Math.abs(n - middle))),
        p95Ms: Math.max(...warm),
      },
      retainedSyntaxBytes,
      metrics: instrumented.metrics,
    });
  }
  const sourceHashes: Record<string, string> = {};
  for (const directory of [
    "packages/core/src",
    "packages/plugin-65xx/src",
    "packages/plugin-snes/src",
    "packages/language-server/src",
  ]) {
    for (const entry of fs.readdirSync(directory, { recursive: true }).map(String).sort()) {
      const file = path.join(directory, entry);
      if (file.endsWith(".ts") && fs.statSync(file).isFile())
        sourceHashes[file] = hash(fs.readFileSync(file));
    }
  }
  const generatedInputs: Record<string, string> = {};
  for (const entry of fs
    .readdirSync(path.join(root, "generated"), { recursive: true })
    .map(String)
    .sort()) {
    const file = path.join(root, "generated", entry);
    if (fs.statSync(file).isFile()) generatedInputs[entry] = hash(fs.readFileSync(file));
  }
  const report = {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    cpu: os.cpus()[0].model,
    instrumentation: "one separate observation after eight uninstrumented samples",
    harnessSha256: hash(fs.readFileSync(import.meta.filename)),
    sourceHashes,
    generatedInputs,
    romSha256: hash(rom),
    peakRssBytes: process.resourceUsage().maxRSS * 1024,
    syntaxSizeDefinition:
      "JSON UTF-8 bytes of a detached main-file program including provenance; excludes include caches and live session state",
    workloads,
  };
  fs.writeFileSync(
    process.argv[2] ?? "/tmp/assembler-ast-benchmark.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(workloads.map((w) => ({ name: w.name, ...w.warm })));
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}

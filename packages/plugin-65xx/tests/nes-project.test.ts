import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  commitRuntimeEvidenceBatch,
  importRuntimeInstructionTrace,
  loadAnalysisProjectViewSnapshot,
  openAnalysisProjectStore,
  RUNTIME_INSTRUCTION_TRACE_FORMAT,
} from "@uttori/asm-disassembler";

import { test } from "../../../tests/ava-helper.js";
import { analyzeNesProject, createNesAnalysisProject, loadNesRom } from "../src/nes/project.js";
import { exportNesSource } from "../src/nes/source-export.js";

/** The vector begins inside a captured JSR operand; another captured routine is unreachable statically. */
function fixture(): Buffer {
  const bytes = Buffer.alloc(16 + 16384, 2);
  bytes.fill(0, 0, 16);
  bytes.set([0x4e, 0x45, 0x53, 0x1a, 1]);
  bytes.set([0x20, 0x60, 0x80, 0x60], 16);
  bytes[16 + 0x60] = 0x60;
  bytes.set([0x8d, 0, 0x20, 0x60], 16 + 0x100);
  for (const vector of [0x3ffa, 0x3ffc, 0x3ffe]) {
    bytes.writeUInt16LE(0x8001, 16 + vector);
  }
  return bytes;
}

test("imported NES fetches retain proven boundaries and discover code while invalid fetches remain evidence", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-nes-observed-"));
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  const romFile = path.join(directory, "original.nes");
  const projectDirectory = path.join(directory, "evidence");
  fs.writeFileSync(romFile, fixture());
  createNesAnalysisProject(projectDirectory, romFile);
  const { cartridge, rom } = loadNesRom(romFile);
  analyzeNesProject({ projectDirectory, romFile });
  const before = openAnalysisProjectStore(projectDirectory);
  try {
    const nodes = before.analysisByKinds(["cfg-node"]).filter((node) => node.kind === "cfg-node");
    t.false(
      exportNesSource(cartridge, nodes, rom.identity.contentSha256).ranges.some(
        (r) => r.start === 0,
      ),
    );
  } finally {
    before.close();
  }
  const observations = [
    { address: 0x8000, bytes: [0x20, 0x60, 0x80], state: { mapper: 0, prg0: 0, prg1: 1, prg2: 2 } },
    {
      address: 0x8100,
      bytes: [0x8d, 0, 0x20],
      state: { mapper: 0, prg0: 0x100, prg1: 0x101, prg2: 0x102 },
    },
    // Each rejection protects a different ownership invariant, even when some ROM bytes agree.
    { address: 0x8200, bytes: [0xea], state: { mapper: 0, prg0: 0x200 } },
    { address: 0x8000, bytes: [0x20, 0x60, 0x80], state: { mapper: 4, prg0: 0, prg1: 1, prg2: 2 } },
    {
      address: 0x8000,
      bytes: [0x20, 0x60, 0x80],
      state: { mapper: 0, prg0: 0, prg1: 0x60, prg2: 2 },
    },
    { address: 0x8000, bytes: [0x20], state: { mapper: 0, prg0: 0 } },
    { address: 0x8300, bytes: [0x60], state: { mapper: 0, prg0: 0x60 } },
    { address: 0x0000, bytes: [0x60], state: { mapper: 0, prg0: 0xffffffff } },
  ];
  const imported = importRuntimeInstructionTrace(
    {
      format: RUNTIME_INSTRUCTION_TRACE_FORMAT,
      schemaVersion: 1,
      architecture: "65xx.2a03",
      addressSpace: "nes.cpu",
      romContentSha256: rom.identity.contentSha256,
      producer: { id: "fixture", revision: "1" },
      chunks: [
        {
          sequenceStart: 1,
          addresses: observations.map((item) => item.address),
          details: observations,
          droppedEvents: 0,
          active: false,
        },
      ],
    },
    { projectRomContentSha256: rom.identity.contentSha256, sourceName: "boot" },
  );
  commitRuntimeEvidenceBatch(
    projectDirectory,
    loadAnalysisProjectViewSnapshot(projectDirectory).revision,
    imported.batch,
  );
  const analyzed = analyzeNesProject({ projectDirectory, romFile });
  t.true(analyzed.addedCode.some((range) => range.start === 0x100));
  const store = openAnalysisProjectStore(projectDirectory);
  try {
    const nodes = store.analysisByKinds(["cfg-node"]).filter((node) => node.kind === "cfg-node");
    t.is(nodes.filter((node) => node.id.startsWith("nes:runtime:")).length, 2);
    const exported = exportNesSource(cartridge, nodes, rom.identity.contentSha256, {
      labels: [
        {
          id: "routine",
          name: "ObservedRoutine",
          sourceName: "ObservedRoutine",
          addressSpace: "nes.cpu",
          address: 0x8060,
          evidence: [],
          analysisEntryPoint: false,
        },
      ],
    });
    t.true(exported.ranges.some((range) => range.start === 0 && range.end === 3));
    t.true(exported.ranges.some((range) => range.start === 0x100 && range.end === 0x103));
    const bank = Buffer.from(
      exported.files.find((file) => file.path === "banks/prg_00.asm")!.bytes,
    ).toString();
    t.regex(bank, /^  JSR\.w ObservedRoutine$/m);
    t.regex(bank, /^  STA\.w PPUCTRL$/m);
    t.notRegex(bank, /; PRG \$/);
    // Conflicting observed starts remain raw: execution alone cannot make overlapping source encodable.
    const captured = nodes.find(
      (node) => node.id.startsWith("nes:runtime:") && node.fileOffset === 0,
    )!;
    const conflicting = {
      ...captured,
      id: "nes:runtime:overlap",
      address: 0x8001,
      fileOffset: 1,
      size: 1,
      opcode: 0x60,
    };
    t.false(
      exportNesSource(cartridge, [...nodes, conflicting], rom.identity.contentSha256).ranges.some(
        (range) => range.start < 3,
      ),
    );
  } finally {
    store.close();
  }
});

test("NES source export names RAM operands without replacing immediate constants", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-nes-operands-"));
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  const bytes = fixture();
  bytes.set([0xa5, 0xb8, 0x3e, 0x40, 0x05, 0xa9, 0xb8, 0x60], 16);
  for (const vector of [0x3ffa, 0x3ffc, 0x3ffe]) {
    bytes.writeUInt16LE(0x8000, 16 + vector);
  }
  const romFile = path.join(directory, "original.nes");
  const projectDirectory = path.join(directory, "evidence");
  fs.writeFileSync(romFile, bytes);
  createNesAnalysisProject(projectDirectory, romFile);
  analyzeNesProject({ projectDirectory, romFile });
  const { cartridge, rom } = loadNesRom(romFile);
  const store = openAnalysisProjectStore(projectDirectory);
  try {
    const nodes = store.analysisByKinds(["cfg-node"]).filter((node) => node.kind === "cfg-node");
    const exported = exportNesSource(cartridge, nodes, rom.identity.contentSha256, {
      labels: [
        { id: "screen", address: 0xb8, name: "ScreenState" },
        { id: "buffer", address: 0x0540, name: "PackedDirections" },
      ].map((label) =>
        Object.assign(label, {
          addressSpace: "nes.cpu",
          sourceName: label.name,
          evidence: [],
          analysisEntryPoint: false,
        }),
      ),
    });
    const bank = Buffer.from(
      exported.files.find((file) => file.path === "banks/prg_00.asm")!.bytes,
    ).toString();
    t.regex(bank, /^  LDA\.b ScreenState$/m);
    t.regex(bank, /^  ROL\.w PackedDirections,X$/m);
    // A numerically equal immediate is a constant, not an address reference.
    t.regex(bank, /^  LDA #\$B8$/m);
  } finally {
    store.close();
  }
});

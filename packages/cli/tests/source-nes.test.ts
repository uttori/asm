import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  openAnalysisProjectStore,
  readSourceCaptureCatalog,
  sourceGit,
  type SourceGeneration,
  type SourceMergePreview,
} from "@uttori/asm-disassembler";
import { loadNesRom, type NesSourceBuild } from "@uttori/asm-plugin-65xx/disassembler";

import { test } from "../../../tests/ava-helper.js";
import { writeNesCaptureFixture } from "../../../tests/helpers/nes-capture.js";
import { executeSourceOperation } from "../src/source.js";

/** Mapper 0 with a trainer and trailing bytes exercises container offsets independently of private ROMs. */
function fixture(): Buffer {
  const rom = Buffer.alloc(16 + 512 + 16384 + 8192 + 3);
  rom.set([0x4e, 0x45, 0x53, 0x1a, 1, 1, 4]);
  rom.fill(0xaa, 16, 528);
  rom.set([0xa9, 1, 0x8d, 0, 0x20, 0x60], 528);
  for (const vector of [0x3ffa, 0x3ffc, 0x3ffe]) rom.writeUInt16LE(0x8000, 528 + vector);
  rom.set([3, 2, 1], rom.length - 3);
  return rom;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

test("NES companion budget failures retry without duplicating CPU evidence and survive removal of inputs", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-nes-disposable-"));
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  const original = fixture();
  // This routine is unreachable from the vectors: regeneration must use the imported fetch.
  original.set([0x8d, 0, 0x20, 0x60], 528 + 0x100);
  const romFile = path.join(directory, "original.NES");
  fs.writeFileSync(romFile, original);
  await executeSourceOperation({ action: "init", directory, rom: romFile });
  const { rom } = loadNesRom(romFile);
  const captureDirectory = path.join(directory, ".uttori-local/captures");
  fs.mkdirSync(captureDirectory);
  const capture = path.join(captureDirectory, "temporary.act2");
  writeNesCaptureFixture(capture, rom.identity);
  const projectFile = path.join(directory, ".uttori/project.json");
  const project = fs.readFileSync(projectFile, "utf8");
  const configuration: unknown = JSON.parse(project);
  if (!isRecord(configuration)) {
    throw new Error("Missing source project configuration.");
  }
  const captureBytes = fs.statSync(capture).size;
  t.true(fs.statSync(`${capture}.context/graphics.act2`).size > captureBytes);
  fs.writeFileSync(
    projectFile,
    JSON.stringify({ ...configuration, limits: { captureBytes } }, null, 2) + "\n",
  );
  await t.throwsAsync(executeSourceOperation({ action: "import", directory, capture }), {
    message:
      /CPU evidence import committed; graphics companion import failed.*import byte limit.*limits\.captureBytes/,
  });
  const partialStore = openAnalysisProjectStore(path.join(directory, ".uttori-local/evidence"));
  let cpuReport;
  try {
    const reports = partialStore.loadTable("imports");
    t.is(reports.length, 1);
    cpuReport = reports[0];
    t.is(cpuReport!.imported.executionEvents, 1);
  } finally {
    partialStore.close();
  }
  // Omission restores the shared default, including the independently imported companion.
  fs.writeFileSync(projectFile, project);
  const imported = await executeSourceOperation({ action: "import", directory, capture });
  t.like(imported, { changed: true, droppedEvents: 0 });
  // Import consumes the inputs but leaves their deletion under the user's control.
  t.true(fs.existsSync(capture));
  t.true(fs.existsSync(`${capture}.context/graphics.act2`));
  const catalog = readSourceCaptureCatalog(
    directory,
    ".uttori/captures.json",
    rom.identity.contentSha256,
  );
  t.is(catalog.catalog.captures.length, 2);
  const graphics = catalog.catalog.captures.find((entry) => entry.profile === "nes-graphics-v1")!;
  const evidenceDirectory = path.join(directory, ".uttori-local/evidence");
  const store = openAnalysisProjectStore(evidenceDirectory);
  const query = {
    architecture: "65xx.2a03",
    addressSpace: "nes.cpu",
    captureSha256: graphics.sha256,
  };
  let expectedGraphics;
  try {
    const reports = store.loadTable("imports");
    t.is(reports.length, 2);
    t.deepEqual(
      reports.find((entry) => entry.id === cpuReport!.id),
      cpuReport,
    );
    expectedGraphics = store.graphicsEvidence(query);
    t.is(expectedGraphics.length, 3);
  } finally {
    store.close();
  }
  fs.unlinkSync(capture);
  fs.rmSync(`${capture}.context`, { recursive: true });
  const remainingRecordings = fs
    .readdirSync(path.join(directory, ".uttori-local"), { recursive: true })
    .filter((name) => /\.(?:act2|context)(?:\/|$)/.test(String(name)));
  t.deepEqual(remainingRecordings, []);

  const status = await executeSourceOperation({ action: "status", directory });
  t.like(status, { catalogReady: true, analysisReady: false });
  t.deepEqual(await executeSourceOperation({ action: "catalog", directory }), {
    captures: 2,
    retainedEvidenceRequired: 2,
  });
  const selectedGraphics = await executeSourceOperation({
    action: "graphics",
    directory,
    graphicsQuery: { captureSha256: graphics.sha256 },
  });
  t.like(selectedGraphics, { rows: expectedGraphics });
  t.is(
    readSourceCaptureCatalog(directory, ".uttori/captures.json", rom.identity.contentSha256)
      .fileSha256,
    catalog.fileSha256,
  );
  await executeSourceOperation({ action: "analyze", directory });
  const analyzedStatus = await executeSourceOperation({ action: "status", directory });
  t.like(analyzedStatus, { catalogReady: true, analysisReady: true });
  await sourceGit(directory, ["add", ".uttori/captures.json"]);
  await sourceGit(directory, ["commit", "-m", "Record compact imported evidence"]);
  const prepared = await executeSourceOperation({ action: "prepare", directory });
  if (
    !isRecord(prepared) ||
    !isRecord(prepared.generation) ||
    typeof prepared.generation.commit !== "string"
  ) {
    throw new Error("Missing prepared NES generation.");
  }
  const candidate = prepared.generation.commit;
  const preview = await executeSourceOperation({ action: "preview", directory, candidate });
  t.like(preview, { conflicts: [] });
  await executeSourceOperation({ action: "apply", directory, candidate });
  await executeSourceOperation({ action: "finish", directory });
  const build = await executeSourceOperation({ action: "build", directory });
  if (!isRecord(build) || typeof build.outputFile !== "string") {
    throw new Error("Missing rebuilt NES output.");
  }
  t.deepEqual(fs.readFileSync(build.outputFile), original);
  const bank = fs.readFileSync(path.join(directory, "source/banks/prg_00.asm"), "utf8");
  t.is((bank.match(/STA\.w PPUCTRL/g) ?? []).length, 2);
  const reopened = openAnalysisProjectStore(evidenceDirectory);
  try {
    t.is(reopened.graphicsEvidence(query).length, expectedGraphics.length);
    t.true(reopened.graphicsEvidence(query).some((row) => row.instructionVariants > 0));
  } finally {
    reopened.close();
  }
  t.false(fs.existsSync(capture));
  t.false(fs.existsSync(`${capture}.context`));
  t.is((await sourceGit(directory, ["branch", "--show-current"])).stdout.toString().trim(), "main");
});

test("NES source workflow initializes beside originals, rebuilds exactly, and retains edits through Git regeneration", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-nes-source-"));
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  const original = fixture();
  const rom = path.join(directory, "original.NES");
  fs.writeFileSync(rom, original);
  fs.writeFileSync(path.join(directory, "notes.txt"), "Existing research\n");
  await executeSourceOperation({ action: "init", directory, rom });
  t.is((await sourceGit(directory, ["branch", "--show-current"])).stdout.toString().trim(), "main");
  const build = (await executeSourceOperation({ action: "build", directory })) as NesSourceBuild;
  t.deepEqual(fs.readFileSync(build.outputFile), original);
  t.deepEqual(fs.readFileSync(rom), original);
  t.is(fs.readFileSync(path.join(directory, "notes.txt"), "utf8"), "Existing research\n");
  const bank = path.join(directory, "source/banks/prg_00.asm");
  const source = fs.readFileSync(bank, "utf8");
  t.regex(source, /LDA #\$01/);
  t.regex(source, /STA\.w PPUCTRL/);
  t.notRegex(source, /; PRG \$/);
  const main = fs.readFileSync(path.join(directory, "source/main.asm"), "utf8");
  t.regex(main, /^incsrc "defines\.asm"$/m);
  t.regex(main, /^incsrc "ram-defines\.asm"$/m);
  t.regex(main, /^incsrc "banks\/prg_00\.asm"$/m);
  fs.writeFileSync(bank, source.replace("LDA #$01", "LDA #$02"));
  await sourceGit(directory, ["add", "source/banks/prg_00.asm", "notes.txt"]);
  await sourceGit(directory, ["commit", "-m", "Edit NES program"]);
  const edited = (await executeSourceOperation({ action: "build", directory })) as NesSourceBuild;
  const expected = Buffer.from(original);
  expected[529] = 2;
  t.deepEqual(fs.readFileSync(edited.outputFile), expected);
  const prepared = (await executeSourceOperation({ action: "prepare", directory })) as {
    generation: SourceGeneration;
  };
  const preview = (await executeSourceOperation({
    action: "preview",
    directory,
    candidate: prepared.generation.commit,
  })) as SourceMergePreview;
  t.deepEqual(preview.conflicts, []);
  await executeSourceOperation({
    action: "apply",
    directory,
    candidate: prepared.generation.commit,
  });
  await executeSourceOperation({ action: "finish", directory });
  // Pure generation refs and merge commits must not create or switch source branches.
  t.is((await sourceGit(directory, ["branch", "--show-current"])).stdout.toString().trim(), "main");
  t.is(
    (await sourceGit(directory, ["for-each-ref", "--format=%(refname)", "refs/heads/"])).stdout
      .toString()
      .trim(),
    "refs/heads/main",
  );
  const rebuilt = (await executeSourceOperation({ action: "build", directory })) as NesSourceBuild;
  t.deepEqual(fs.readFileSync(rebuilt.outputFile), expected);
  t.regex(fs.readFileSync(bank, "utf8"), /STA\.w PPUCTRL/);
  const configFile = path.join(directory, "source/uttori-asm.config.json");
  const config = JSON.parse(fs.readFileSync(configFile, "utf8"));
  config.plugins[0].options.header[6] |= 2;
  fs.writeFileSync(configFile, JSON.stringify(config));
  await t.throwsAsync(executeSourceOperation({ action: "build", directory }), {
    message: /original iNES header/,
  });
  await t.throwsAsync(
    executeSourceOperation({ action: "expand", directory, expansionSize: 0x10000 }),
    { message: /fixed cartridge layout/ },
  );
});

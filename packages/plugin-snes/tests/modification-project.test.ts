import fs from "node:fs";
import path from "node:path";

import { validateDebugMap, type DebugMap } from "@uttori/asm-core";
import {
  RomImage,
  analysisProjectRevision,
  validateSourceExportFiles,
} from "@uttori/asm-disassembler";
import test from "ava";

import { ownershipFixture } from "../../../tests/helpers/ownership-fixture.js";
import {
  buildModifiedRom,
  createRomModificationProject,
  exportSnes65816Source,
  verifySnesProjectRoundTrip,
  addRomReplacement,
  deriveModifiedRomProject,
  type RomModificationProject,
} from "../src/index.js";

/** Give the synthetic struct field known little-endian bytes through generator inputs. */
const fixture = async (headerSize: 0 | 512 = 0) => {
  const f = ownershipFixture();
  const bytes = Buffer.from(f.rom.fileBytes());
  bytes.writeUInt16LE(10, 0x40);
  const fileBytes = Buffer.concat([Buffer.alloc(headerSize, 0xab), bytes]);
  const rom = new RomImage(fileBytes, { headerSize });
  fs.writeFileSync(f.romFile, fileBytes);
  const snapshot = { ...f.snapshot, manifest: { ...f.snapshot.manifest, rom: rom.identity } };
  exportSnes65816Source(snapshot, rom, f.sourceDirectory, {
    sourceProjectSha256: analysisProjectRevision(snapshot.manifest).manifestSha256,
  });
  const manifestFile = await createRomModificationProject({
    sourceDirectory: f.sourceDirectory,
    romFile: f.romFile,
    directory: path.join(f.directory, "modifications"),
  });
  const project = JSON.parse(fs.readFileSync(manifestFile, "utf8")) as RomModificationProject;
  const input = path.join(path.dirname(manifestFile), "inputs/price.asm");
  fs.writeFileSync(input, "dw 20\n");
  const changed: RomModificationProject = {
    ...project,
    replacements: [
      {
        id: "price",
        offset: 0x40,
        expected: "0a00",
        input: "inputs/price.asm",
        kind: "assembly",
        accumulator: 16,
        index: 16,
      },
    ],
  };
  const save = (value = changed) => fs.writeFileSync(manifestFile, JSON.stringify(value, null, 2));
  save();
  return { ...f, bytes, rom, snapshot, manifestFile, project: changed, input, save };
};

test("owned 16-bit price changes only its field; baseline regeneration preserves the input", async (t) => {
  const f = await fixture();
  t.teardown(f.cleanup);
  const result = await buildModifiedRom({ manifestFile: f.manifestFile });
  const output = fs.readFileSync(result.outputPath);
  t.is(output.readUInt16LE(0x40), 20);
  t.deepEqual(
    [...output.keys()].filter((i) => output[i] !== f.bytes[i]),
    [0x40],
  );
  const map = JSON.parse(fs.readFileSync(result.debugMapPath, "utf8")) as DebugMap;
  t.deepEqual(validateDebugMap(map, output), []);
  const range = map.ranges.find((r) => r.outputStart === 0x40)!;
  for (const source of map.sources) {
    t.true(fs.existsSync(source.path), `Debug source exists: ${source.path}`);
  }
  t.is(map.sources.find((s) => s.id === range.sourceId)?.path, f.input);
  t.is(range.line, 1);
  const repeat = await buildModifiedRom({ manifestFile: f.manifestFile });
  t.false(repeat.outputChanged);
  t.false(repeat.debugMapChanged);
  exportSnes65816Source(f.snapshot, f.rom, f.sourceDirectory, {
    sourceProjectSha256: analysisProjectRevision(f.snapshot.manifest).manifestSha256,
  });
  validateSourceExportFiles(f.sourceDirectory);
  const baseline = await verifySnesProjectRoundTrip({
    sourceDirectory: f.sourceDirectory,
    romFile: f.romFile,
  });
  t.true(baseline.comparison.equal);
  t.is(fs.readFileSync(f.input, "utf8"), "dw 20\n");
  t.deepEqual(fs.readFileSync(baseline.finalOutput), f.bytes);
});

test("copier headers remain separate and mapper/header pins cannot be changed independently", async (t) => {
  const f = await fixture(512);
  t.teardown(f.cleanup);
  const result = await buildModifiedRom({ manifestFile: f.manifestFile });
  t.is(fs.readFileSync(result.outputPath).length, 0x10000);
  t.deepEqual(fs.readFileSync(result.finalOutput).subarray(0, 512), Buffer.alloc(512, 0xab));
  t.is(fs.readFileSync(result.finalOutput).readUInt16LE(512 + 0x40), 20);
  f.save({ ...f.project, baseline: { ...f.project.baseline, mapper: "lorom" } });
  await t.throwsAsync(buildModifiedRom({ manifestFile: f.manifestFile }), {
    message: /mapping\/header rules/,
  });
  f.save({ ...f.project, replacements: [{ ...f.project.replacements[0], offset: 0xffff }] });
  await t.throwsAsync(buildModifiedRom({ manifestFile: f.manifestFile }), { message: /exceeds/ });
});

test("native labels and manual placements resolve without copying baseline runtime evidence", async (t) => {
  const f = await fixture();
  t.teardown(f.cleanup);
  const input = addRomReplacement({
    manifestFile: f.manifestFile,
    id: "references",
    offset: 0x100,
    size: 6,
    kind: "assembly",
  });
  fs.writeFileSync(input, "dl L_Item_Price_Candy\ndl Patch_price\n");
  const built = await buildModifiedRom({ manifestFile: f.manifestFile });
  t.deepEqual(
    [...fs.readFileSync(built.outputPath).subarray(0x100, 0x106)],
    [0x20, 0, 0xc0, 0x40, 0, 0xc0],
  );
  const derived = await deriveModifiedRomProject({
    manifestFile: f.manifestFile,
    outputDirectory: path.join(f.directory, "derived"),
  });
  t.is(derived.rom.contentSha256, built.outputSha256);
  t.not(derived.rom.contentSha256, f.rom.identity.contentSha256);
  validateSourceExportFiles(derived.outputDirectory);
  const verification = await verifySnesProjectRoundTrip({
    sourceDirectory: derived.outputDirectory,
    romFile: derived.romFile,
  });
  t.true(verification.comparison.equal);
});

test("owned dependencies, stale baseline and cancellation fail closed", async (t) => {
  const f = await fixture();
  t.teardown(f.cleanup);
  const root = path.dirname(f.manifestFile);
  fs.writeFileSync(path.join(f.directory, "foreign.asm"), "dw 20\n");
  fs.writeFileSync(f.input, 'incsrc "../../foreign.asm"\n');
  await t.throwsAsync(buildModifiedRom({ manifestFile: f.manifestFile }), {
    message: /outside owned inputs/,
  });
  fs.symlinkSync(path.join(f.directory, "foreign.asm"), path.join(root, "inputs/linked.asm"));
  fs.writeFileSync(f.input, 'incsrc "linked.asm"\n');
  await t.throwsAsync(buildModifiedRom({ manifestFile: f.manifestFile }), {
    message: /Symbolic link/,
  });
  fs.writeFileSync(f.input, "dw 20\n");
  const aborted = new AbortController();
  aborted.abort();
  await t.throwsAsync(buildModifiedRom({ manifestFile: f.manifestFile, signal: aborted.signal }));
  t.false(fs.existsSync(path.join(root, "build/current.json")));
  fs.appendFileSync(path.join(f.sourceDirectory, "generated-files.json"), "\n");
  await t.throwsAsync(buildModifiedRom({ manifestFile: f.manifestFile }), {
    message: /Baseline generation changed/,
  });
});

test("invalid ranges, unexpected base bytes and incomplete encodings never replace the current output", async (t) => {
  const f = await fixture();
  t.teardown(f.cleanup);
  const valid = await buildModifiedRom({ manifestFile: f.manifestFile });
  const current = path.join(path.dirname(f.manifestFile), "build/current.json");
  const pointer = fs.readFileSync(current, "utf8");
  for (const source of [
    "db 20\n",
    "db 20,0,0\n",
    "org $c00042\ndb $12\norg $c00040\ndw 20\n",
    "dw 20\norg $c00040\ndw 20\n",
    "dw MissingSymbol\n",
  ]) {
    fs.writeFileSync(f.input, source);
    await t.throwsAsync(buildModifiedRom({ manifestFile: f.manifestFile }));
    t.is(fs.readFileSync(current, "utf8"), pointer);
  }
  fs.writeFileSync(f.input, "dw 20\n");
  f.save({ ...f.project, replacements: [{ ...f.project.replacements[0], expected: "0b00" }] });
  await t.throwsAsync(buildModifiedRom({ manifestFile: f.manifestFile }), {
    message: /Expected original/,
  });
  f.save({
    ...f.project,
    replacements: [...f.project.replacements, { ...f.project.replacements[0], id: "overlap" }],
  });
  await t.throwsAsync(buildModifiedRom({ manifestFile: f.manifestFile }), { message: /overlaps/ });
  t.true(fs.existsSync(valid.outputPath));
});

test("binary data and manual code placement share pinned symbols and reject interface/base drift", async (t) => {
  const f = await fixture();
  t.teardown(f.cleanup);
  const root = path.dirname(f.manifestFile);
  fs.writeFileSync(path.join(root, "inputs/code.asm"), "lda.w #FixtureLimit\nrtl\n");
  fs.writeFileSync(path.join(root, "inputs/data.bin"), Buffer.from([20, 0]));
  f.save({
    ...f.project,
    replacements: [
      { ...f.project.replacements[0], input: "inputs/data.bin", kind: "binary" },
      {
        id: "code",
        offset: 0x100,
        expected: "12121212",
        input: "inputs/code.asm",
        kind: "assembly",
        accumulator: 16,
        index: 16,
      },
    ],
  });
  const built = await buildModifiedRom({ manifestFile: f.manifestFile });
  t.deepEqual([...fs.readFileSync(built.outputPath).subarray(0x100, 0x104)], [0xa9, 10, 0, 0x6b]);
  fs.appendFileSync(path.join(root, "baseline-interface.asm"), "; drift\n");
  await t.throwsAsync(buildModifiedRom({ manifestFile: f.manifestFile }), {
    message: /interface changed/,
  });
});

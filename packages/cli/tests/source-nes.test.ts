import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  sourceGit,
  type SourceGeneration,
  type SourceMergePreview,
} from "@uttori/asm-disassembler";
import type { NesSourceBuild } from "@uttori/asm-plugin-65xx/disassembler";

import { test } from "../../../tests/ava-helper.js";
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

test("NES source workflow initializes beside originals, rebuilds exactly, and retains edits through Git regeneration", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-nes-source-"));
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  const original = fixture();
  const rom = path.join(directory, "original.NES");
  fs.writeFileSync(rom, original);
  fs.writeFileSync(path.join(directory, "notes.txt"), "Existing research\n");
  await executeSourceOperation({ action: "init", directory, rom });
  const build = (await executeSourceOperation({ action: "build", directory })) as NesSourceBuild;
  t.deepEqual(fs.readFileSync(build.outputFile), original);
  t.deepEqual(fs.readFileSync(rom), original);
  t.is(fs.readFileSync(path.join(directory, "notes.txt"), "utf8"), "Existing research\n");
  const bank = path.join(directory, "source/banks/prg_00.asm");
  const source = fs.readFileSync(bank, "utf8");
  t.regex(source, /lda #\$01/);
  fs.writeFileSync(bank, source.replace("lda #$01", "lda #$02"));
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
  const rebuilt = (await executeSourceOperation({ action: "build", directory })) as NesSourceBuild;
  t.deepEqual(fs.readFileSync(rebuilt.outputFile), expected);
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

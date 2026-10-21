import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { loadSomRoomNative } from "@uttori/asm-assets/secret-of-mana/som-room-native";
import { RomImage } from "@uttori/asm-disassembler";
import {
  sourceGit,
  sourceRepository,
  retainSourceGeneration,
  adoptSourceGeneration,
  finishSourceGeneration,
} from "@uttori/asm-disassembler/source-project";

import { somRoomNativeFixture } from "./som-room-native.js";
import { buildSpriteSource } from "./sprite-source.js";

/** Normal Git source fixture with two room consumers, raw native resources and independently encoded fixed geometry. */
export async function roomSourceFixture(teardown: (cleanup: () => void) => void) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-room-source-"));
  teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.symlinkSync(path.resolve("node_modules"), path.join(directory, "node_modules"), "dir");
  for (const folder of [".uttori/research", ".uttori-local", "source"]) {
    fs.mkdirSync(path.join(directory, folder), { recursive: true });
  }
  const { rom: original, room } = somRoomNativeFixture();
  room.sections = {
    objects: { address: 0xc88000, bytes: 8 },
    assembly: { address: 0xc89000, bytes: 5 },
    triggers: { address: 0xc8a000, bytes: 0 },
  };
  original.set([0, 15, 1, 0, 0], 0x89000);
  const other = {
    ...room,
    id: 2,
    sections: {
      objects: { address: 0xc88008, bytes: 8 },
      assembly: { address: 0xc89005, bytes: 5 },
      triggers: { address: 0xc8a000, bytes: 0 },
    },
  };
  original.set([0, 15, 1, 0, 0], 0x89005);
  for (const [table, offsets] of [
    [0x87000, [0x8000, 0x8008, 0x8010]],
    [0x85000, [0x9000, 0x9005, 0x900a]],
    [0x84000, [0xa000, 0xa000, 0xa000]],
  ] as const) {
    offsets.forEach((value, index) => {
      original[table + (index + 1) * 2] = value & 255;
      original[table + (index + 1) * 2 + 1] = value >>> 8;
    });
  }
  const rom = new RomImage(original, { headerSize: 0 });
  const write = (name: string, value: unknown): void =>
    fs.writeFileSync(path.join(directory, name), JSON.stringify(value, null, 2) + "\n");
  fs.writeFileSync(path.join(directory, ".gitignore"), "/.uttori-local/\n/node_modules/\n");
  fs.writeFileSync(path.join(directory, ".uttori-local/original.sfc"), original);
  fs.writeFileSync(path.join(directory, "source/native.bin"), original);
  write("source/room.json", room);
  write("source/other.json", other);
  write("source/preview.json", {
    ...loadSomRoomNative(room, (address, size) =>
      original.slice(
        (address - 0xc00000) % original.length,
        ((address - 0xc00000) % original.length) + size,
      ),
    ).preview,
    retainedNote: "opaque authored note",
  });
  write(".uttori/project.json", {
    format: "uttori-source-project",
    version: 1,
    id: "room-fixture",
    target: "snes.sfc",
    romSha256: rom.identity.contentSha256,
    sourceRoots: ["source"],
    researchRoots: [".uttori/research"],
    buildConfig: "source/uttori-asm.config.json",
    layout: ".uttori/layout.json",
    captures: ".uttori/captures.json",
  });
  write(".uttori-local/project.json", {
    format: "uttori-source-local",
    version: 1,
    rom: ".uttori-local/original.sfc",
    evidence: ".uttori-local/evidence",
  });
  write(".uttori/research/names.json", {
    format: "uttori-research",
    version: 1,
    project: "room-fixture",
    romSha256: rom.identity.contentSha256,
    decisions: [],
  });
  write(".uttori/layout.json", {
    format: "uttori-snes-layout",
    version: 1,
    romSha256: rom.identity.contentSha256,
    size: original.length,
    states: [],
    extents: [],
  });
  write("source/source-raw.json", {
    format: "uttori-source-raw",
    version: 1,
    romSha256: rom.identity.contentSha256,
    blockSize: 0x1000,
  });
  write("source/uttori-asm.config.json", {
    target: "snes.sfc",
    architecture: "snes.65816",
    entryPoints: ["main.asm"],
    includePaths: ["./"],
    plugins: [
      { module: "@uttori/asm-plugin-snes", options: { checksumEnabled: false } },
      { module: "@uttori/asm-game-secret-of-mana" },
    ],
  });
  fs.writeFileSync(
    path.join(directory, "source/main.asm"),
    `hirom
org $C00000
incbin "native.bin":0..$88000
includeAsset("room.json", "som.room", section: "objects", preview: "preview.json")
includeAsset("other.json", "som.room", section: "objects", preview: "preview.json")
incbin "native.bin":$88010..$89000
includeAsset("room.json", "som.room", section: "assembly", preview: "preview.json")
includeAsset("other.json", "som.room", section: "assembly", preview: "preview.json")
incbin "native.bin":$8900A..$8A000
includeAsset("room.json", "som.room", section: "triggers", preview: "preview.json")
includeAsset("other.json", "som.room", section: "triggers", preview: "preview.json")
incbin "native.bin":$8A000..$200000
`,
  );
  await sourceGit(directory, ["init", "-b", "main"]);
  await sourceGit(directory, ["config", "user.name", "Fixture"]);
  await sourceGit(directory, ["config", "user.email", "fixture@localhost"]);
  await sourceGit(directory, ["add", "--all"]);
  await sourceGit(directory, ["commit", "-m", "Synthetic room source"]);
  const repository = await sourceRepository(directory),
    files = fs.readdirSync(path.join(directory, "source")).map((name) => ({
      path: `source/${name}`,
      bytes: fs.readFileSync(path.join(directory, "source", name)),
    }));
  const generationInputs = {
    project: "room-fixture",
    romSha256: rom.identity.contentSha256,
    evidenceSha256: "a".repeat(64),
    researchSha256: "b".repeat(64),
    toolchainSha256: "c".repeat(64),
    optionsSha256: "d".repeat(64),
  };
  const generation = await retainSourceGeneration(repository, { files, inputs: generationInputs });
  await adoptSourceGeneration(repository, generation);
  await finishSourceGeneration(repository, {
    message: "Adopt room source",
    validate: () => buildSpriteSource(directory),
  });
  return {
    directory,
    repository,
    original,
    files,
    generationInputs,
    selection: { room: "source/room.json", rooms: ["source/room.json", "source/other.json"] },
  };
}

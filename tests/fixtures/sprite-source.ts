import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createIndexedPng } from "@uttori/asm-assets/image";
import {
  spritePaletteColors,
  type SpritePaletteCatalog,
} from "@uttori/asm-assets/secret-of-mana/som-sprite-palettes";
import type { FrameLayout } from "@uttori/asm-assets/secret-of-mana/som-types";
import { RomImage } from "@uttori/asm-disassembler";
import {
  sourceGit,
  sourceRepository,
  retainSourceGeneration,
  adoptSourceGeneration,
  finishSourceGeneration,
  type SourceBuildVerification,
} from "@uttori/asm-disassembler/source-project";
import { executeSourceOperation } from "@uttori/asm-workflows/source";

import { deriveFramePlacements } from "../../packages/assets/src/secret-of-mana/som-frame-composition.js";
import {
  layoutStableFrameAtlas,
  renderStableFrameAtlas,
} from "../../packages/assets/src/secret-of-mana/som-frame-edit.js";
import type { RoundtripSelection } from "./sprite-roundtrip-host.js";

/** A complete selection of the synthetic source's single palette consumer. */
export const spriteSourceSelection = {
  atlasId: "sprite.png",
  image: "source/sprite.png",
  layout: "source/sprite.layout.json",
  catalog: "source/palettes.json",
  atlases: [{ id: "sprite.png", image: "source/sprite.png", layout: "source/sprite.layout.json" }],
} satisfies Omit<RoundtripSelection, "directory">;

/** Original synthetic assets, with a flipped block, duplicate colors and preserved palette high bits. */
export function spriteFixture(blank = false) {
  const catalog: SpritePaletteCatalog = {
    version: 1,
    palettes: {
      C00100: {
        romAddress: "C00100",
        firstIndex: 1,
        words: ["8001", "0001", ...Array(13).fill("0000")],
        users: [{ atlas: "sprite.png", role: "primary", segments: ["tiles"] }],
      },
    },
  };
  const tiles = new Map([
    [
      "tiles",
      Array.from({ length: 4 }, (_, i) => ({
        width: 8,
        height: 8,
        indexes: Uint8Array.from({ length: 64 }, (_value, pixel) => (blank ? 0 : (pixel + i) % 3)),
      })),
    ],
  ]);
  const initial: FrameLayout = {
    version: 1,
    width: 32,
    height: 16,
    paletteRefs: ["C00100"],
    guideIndex: 16,
    segments: {
      tiles: {
        palette: 0,
        romAddress: "C00200",
        tiles: Array.from({ length: 4 }, (_, i) => ({ x: i * 8, y: 0 })),
      },
    },
    frames: [
      {
        id: "body",
        bounds: [0, 0, 16, 16],
        origin: [0, 0],
        nativeFrame: { address: 0xc00010, end: 0xc00015, bytes: [1, 3, 0xc1, 0x80, 0x80] },
        blocks: [
          {
            id: "block",
            size: 16,
            x: 0,
            y: 0,
            flipX: true,
            flipY: false,
            priority: true,
            tiles: [0xc00200, 0xc00220, 0xc00240, 0xc00260],
          },
        ],
      },
    ],
  };
  initial.frames![0].placements = deriveFramePlacements(initial, initial.frames![0]);
  const layout = layoutStableFrameAtlas(initial);
  const rendered = renderStableFrameAtlas(tiles, layout);
  const png = createIndexedPng({
    ...rendered,
    palette: [...spritePaletteColors(catalog, "C00100"), [255, 0, 255, 255]],
  });
  return { catalog, layout, png, tiles };
}

/** A full small Git source project exercises the normal host, assembler and native generation services. */
export async function spriteSourceFixture(
  teardown: (cleanup: () => void) => void,
  compression?: "rle" | "lz-rle",
  blankBoss = false,
) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-sprite-source-"));
  teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  return createSpriteSourceFixture(directory, compression, blankBoss);
}

/** Populate a new, empty directory. The caller owns its lifetime and cleanup. */
export async function createSpriteSourceFixture(
  directory: string,
  compression?: "rle" | "lz-rle",
  blankBoss = false,
) {
  const dependencies = fileURLToPath(new URL("../../node_modules", import.meta.url));
  fs.symlinkSync(dependencies, path.join(directory, "node_modules"), "dir");
  for (const name of [".uttori/research", ".uttori-local", "source"]) {
    fs.mkdirSync(path.join(directory, name), { recursive: true });
  }
  const { catalog, layout, png, tiles } = spriteFixture(blankBoss);
  const original = Buffer.alloc(0x8000, 0xea);
  original.set([1, 3, 0xc1, 0x80, 0x80], 0x10);
  original.fill(0, 0x100, 0x11e);
  original.set([1, 0x80, 1, 0], 0x100);
  // Independent SNES planar encoder: do not reuse the production asset encoder for the oracle.
  tiles.get("tiles")!.forEach((tile, index) => {
    original.fill(0, 0x200 + index * 32, 0x220 + index * 32);
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        for (let plane = 0; plane < 4; plane++) {
          const offset = 0x200 + index * 32 + (plane >> 1) * 16 + y * 2 + (plane & 1);
          original[offset] |= ((tile.indexes[y * 8 + x] >> plane) & 1) << (7 - x);
        }
      }
    }
  });
  let native: Uint8Array | undefined;
  if (compression) {
    // Deliberately inefficient literal-only streams prove that no-op import preserves original token choices.
    const planar = original.slice(0x200, 0x280),
      mask = new Uint8Array(144);
    for (let group = 0; group < 16; group++) {
      mask[group * 9] = 0xff;
      mask.set(planar.subarray(group * 8, group * 8 + 8), group * 9 + 1);
    }
    native = blankBoss ? new Uint8Array(16) : mask;
    if (compression === "lz-rle") {
      const plain = native,
        tokens: number[] = [];
      for (let start = 0; start < plain.length; start += 128) {
        const run = plain.subarray(start, start + 128);
        tokens.push(run.length - 1, ...run);
      }
      native = Uint8Array.of(0, 0x73, plain.length >>> 8, plain.length & 255, ...tokens);
    }
    original.set(native, 0x200);
    // Boss parts use expanded logical references rather than pretending a compressed stream has 32-byte tile addresses.
    const frame = layout.frames![0];
    delete frame.nativeFrame;
    frame.blocks![0].tiles = Array.from({ length: 4 }, (_, index) => ["tiles", index] as const);
    frame.placements = deriveFramePlacements(layout, frame);
  }
  const rom = new RomImage(original, { headerSize: 0 });
  const write = (name: string, value: unknown): void =>
    fs.writeFileSync(path.join(directory, name), JSON.stringify(value, null, 2) + "\n");
  fs.writeFileSync(path.join(directory, ".gitignore"), "/.uttori-local/\n/node_modules/\n");
  fs.writeFileSync(path.join(directory, ".uttori-local/original.sfc"), original);
  fs.writeFileSync(path.join(directory, "source/original.bin"), original);
  fs.writeFileSync(path.join(directory, "source/sprite.png"), png);
  if (native) {
    fs.writeFileSync(path.join(directory, "source/native.bin"), native);
  }
  write("source/sprite.layout.json", layout);
  write("source/palettes.json", catalog);
  write(".uttori/project.json", {
    format: "uttori-source-project",
    version: 1,
    id: "fixture",
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
    project: "fixture",
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
  let graphicsInclude =
    'includeAsset("sprite.png", "som.sprite.frames", layout: "sprite.layout.json", palettes: "palettes.json", segment: "tiles")';
  if (native) {
    graphicsInclude = `includeAsset("sprite.png", "som.boss.graphics", layout: "sprite.layout.json", palettes: "palettes.json", segment: "tiles", storage: "${compression}", byteLength: ${native.length}, native: "native.bin")`;
  }
  const graphicsEnd = 0x200 + (native?.length ?? 128);
  const source = `hirom
org $C00000
incbin "original.bin":0..$10
struct Body $C00010
  .header: db
  .tokens: db[2]
  .coordinates: db[2]
endstruct
dataStruct Body, {
  header = $01, tokens = [$03, $C1],
  coordinates = [$80, $80] ; keep flag bits and this comment
}
incbin "original.bin":$15..$100
includeAsset("palettes.json", "som.palette.bgr555", palette: "C00100")
incbin "original.bin":$11E..$200
${graphicsInclude}
incbin "original.bin":$${graphicsEnd.toString(16)}..$8000
`;
  fs.writeFileSync(path.join(directory, "source/main.asm"), source);
  await sourceGit(directory, ["init", "-b", "main"]);
  await sourceGit(directory, ["config", "user.name", "Fixture"]);
  await sourceGit(directory, ["config", "user.email", "fixture@localhost"]);
  await sourceGit(directory, ["add", "--all"]);
  await sourceGit(directory, ["commit", "-m", "Synthetic sprite source"]);
  const repository = await sourceRepository(directory);
  const files = fs.readdirSync(path.join(directory, "source")).map((name) => ({
    path: `source/${name}`,
    bytes: fs.readFileSync(path.join(directory, "source", name)),
  }));
  const generationInputs = {
    project: "fixture",
    romSha256: rom.identity.contentSha256,
    evidenceSha256: "a".repeat(64),
    researchSha256: "b".repeat(64),
    toolchainSha256: "c".repeat(64),
    optionsSha256: "d".repeat(64),
  };
  const baseline = await retainSourceGeneration(repository, { files, inputs: generationInputs });
  await adoptSourceGeneration(repository, baseline);
  await finishSourceGeneration(repository, {
    message: "Adopt synthetic generation",
    validate: () => buildSpriteSource(directory),
  });
  const selection: RoundtripSelection = { directory, ...spriteSourceSelection };
  return { directory, selection, original, source, repository, files, generationInputs };
}

/** Run the ordinary build and validate its receipt before accepting a Git source generation. */
export async function buildSpriteSource(directory: string): Promise<SourceBuildVerification> {
  const result: unknown = await executeSourceOperation({ action: "build", directory });
  assert.ok(result !== null && typeof result === "object" && "verification" in result);
  const receipt = result.verification;
  assert.ok(receipt !== null && typeof receipt === "object");
  assert.ok("outputSha256" in receipt && typeof receipt.outputSha256 === "string");
  assert.ok("debugMapSha256" in receipt && typeof receipt.debugMapSha256 === "string");
  assert.ok("toolchainSha256" in receipt && typeof receipt.toolchainSha256 === "string");
  assert.ok("checks" in receipt && Array.isArray(receipt.checks));
  const checks: unknown[] = receipt.checks;
  assert.ok(checks.every((check) => typeof check === "string"));
  return {
    outputSha256: receipt.outputSha256,
    debugMapSha256: receipt.debugMapSha256,
    toolchainSha256: receipt.toolchainSha256,
    checks,
  };
}

/** Mutable editor output for edit/rejection fixtures; the production bundle stays read-only. */
export function mutableSpriteResult(
  bundle: import("@uttori/asm-assets/sprite-editing").SpriteEditorBundle,
) {
  return {
    format: "uttori-sprite-result" as const,
    version: 1 as const,
    session: bundle.session,
    width: bundle.width,
    height: bundle.height,
    transparentIndex: bundle.transparentIndex,
    frames: [...bundle.frames],
    palette: bundle.palette.map((color) => [...color]),
    images: bundle.images.map((image, layerOrder) => ({
      ...image,
      indexes: [...image.indexes],
      opacity: 255,
      zIndex: 0,
      layerOrder,
    })),
  };
}

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { decodeAsepriteDocument, encodeAsepriteDocument } from "@uttori/asm-assets/aseprite";
import { indexedPngAtlasCodec } from "@uttori/asm-assets/atlas-png";
import { createIndexedPng } from "@uttori/asm-assets/image";
import {
  spritePaletteColors,
  type SpritePaletteCatalog,
} from "@uttori/asm-assets/secret-of-mana/som-sprite-palettes";
import { RomImage } from "@uttori/asm-disassembler";
import {
  sourceGit,
  sourceRepository,
  retainSourceGeneration,
  adoptSourceGeneration,
  finishSourceGeneration,
  type SourceBuildVerification,
} from "@uttori/asm-disassembler/source-project";
import { somSpriteSourceAdapter } from "@uttori/asm-game-secret-of-mana/workflows";
import { AssetInterchangeService } from "@uttori/asm-workflows/asset-interchange";
import { readAssetImportReview } from "@uttori/asm-workflows/asset-interchange/public-records";
import { inspectSourceProject, executeSourceOperation } from "@uttori/asm-workflows/source";

// This runs outside the repository with ordinary installed exports and the shipped executable.
const directory = fs.mkdtempSync(path.join(process.cwd(), "installed asset source "));
const executable = path.resolve(
  path.dirname(fileURLToPath(import.meta.resolve("@uttori/asm-cli"))),
  "../out/cli.mjs",
);
const hash = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");
const writeJson = (file: string, value: unknown): void =>
  fs.writeFileSync(path.join(directory, file), JSON.stringify(value, null, 2) + "\n");
/** Launch literal argv against installed packages, without source conditions or a loader. */
const invoke = (args: string[]): unknown => {
  const result = spawnSync(process.execPath, [executable, "asset", ...args], {
    cwd: directory,
    encoding: "utf8",
    timeout: 30000,
    maxBuffer: 1024 * 1024,
  });
  assert.equal(result.status, 0, String(result.error ?? "") + "\n" + result.stderr);
  return JSON.parse(result.stdout);
};

try {
  for (const name of [".uttori/research", ".uttori-local", "source"]) {
    fs.mkdirSync(path.join(directory, name), { recursive: true });
  }
  const original = new Uint8Array(0x8000).fill(0xea);
  original.fill(0, 0x100, 0x11e);
  original.set([1, 0x80], 0x100);
  original.fill(0, 0x200, 0x280);
  const romSha256 = new RomImage(original, { headerSize: 0 }).identity.contentSha256;
  const catalog: SpritePaletteCatalog = {
    version: 1,
    palettes: {
      C00100: {
        romAddress: "C00100",
        firstIndex: 1,
        words: ["8001", ...Array<string>(14).fill("0000")],
        users: [{ atlas: "sprite.png", role: "primary" as const, segments: ["tiles"] }],
      },
    },
  };
  const layout = {
    version: 1,
    frames: [],
    tileSources: "native-strip",
    width: 32,
    height: 8,
    paletteRefs: ["C00100"],
    guideIndex: 16,
    segments: {
      tiles: {
        tileAtlas: { bounds: [0, 0, 32, 8], columns: 4, step: 8, sourceOnly: [0, 1, 2, 3] },
        palette: 0,
        romAddress: "C00200",
        tiles: Array.from({ length: 4 }, (_, index) => ({ x: index * 8, y: 0 })),
      },
    },
  };
  fs.writeFileSync(path.join(directory, ".gitignore"), "/.uttori-local/\n");
  fs.writeFileSync(path.join(directory, ".uttori-local/original.sfc"), original);
  fs.writeFileSync(path.join(directory, "source/original.bin"), original);
  fs.writeFileSync(
    path.join(directory, "source/sprite.png"),
    createIndexedPng({
      width: 32,
      height: 8,
      indexes: new Uint8Array(256),
      palette: [...spritePaletteColors(catalog, "C00100"), [255, 0, 255, 255]],
    }),
  );
  writeJson("source/sprite.layout.json", layout);
  writeJson("source/palettes.json", catalog);
  writeJson(".uttori/project.json", {
    format: "uttori-source-project",
    version: 1,
    id: "installed",
    target: "snes.sfc",
    romSha256,
    sourceRoots: ["source"],
    researchRoots: [".uttori/research"],
    buildConfig: "source/uttori-asm.config.json",
    layout: ".uttori/layout.json",
    captures: ".uttori/captures.json",
  });
  writeJson(".uttori-local/project.json", {
    format: "uttori-source-local",
    version: 1,
    rom: ".uttori-local/original.sfc",
    evidence: ".uttori-local/evidence",
  });
  writeJson(".uttori/research/names.json", {
    format: "uttori-research",
    version: 1,
    project: "installed",
    romSha256,
    decisions: [],
  });
  writeJson(".uttori/layout.json", {
    format: "uttori-snes-layout",
    version: 1,
    romSha256,
    size: original.length,
    states: [],
    extents: [],
  });
  writeJson("source/source-raw.json", {
    format: "uttori-source-raw",
    version: 1,
    romSha256,
    blockSize: 0x1000,
  });
  writeJson("source/uttori-asm.config.json", {
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
    'hirom\norg $C00000\nincbin "original.bin":0..$100\nincludeAsset("palettes.json", "som.palette.bgr555", palette: "C00100")\nincbin "original.bin":$11E..$200\nincludeAsset("sprite.png", "som.sprite.frames", layout: "sprite.layout.json", palettes: "palettes.json", segment: "tiles")\nincbin "original.bin":$280..$8000\n',
  );
  for (const args of [
    ["init", "-b", "main"],
    ["config", "user.name", "Fixture"],
    ["config", "user.email", "fixture@localhost"],
    ["add", "--all"],
    ["commit", "-m", "Installed source fixture"],
  ]) {
    await sourceGit(directory, args);
  }
  const repository = await sourceRepository(directory);
  const files = fs.readdirSync(path.join(directory, "source")).map((name) => ({
    path: "source/" + name,
    bytes: fs.readFileSync(path.join(directory, "source", name)),
  }));
  const generation = await retainSourceGeneration(repository, {
    files,
    inputs: {
      project: "installed",
      romSha256,
      evidenceSha256: "a".repeat(64),
      researchSha256: "b".repeat(64),
      toolchainSha256: "c".repeat(64),
      optionsSha256: "d".repeat(64),
    },
  });
  await adoptSourceGeneration(repository, generation);
  await finishSourceGeneration(repository, {
    message: "Adopt installed fixture",
    validate: async () => {
      const result = await executeSourceOperation({ action: "build", directory });
      if (!result || typeof result !== "object" || !("verification" in result)) {
        throw new Error("Missing normal build receipt.");
      }
      const receipt = result.verification;
      if (
        !receipt ||
        typeof receipt !== "object" ||
        !("outputSha256" in receipt) ||
        typeof receipt.outputSha256 !== "string" ||
        !("debugMapSha256" in receipt) ||
        typeof receipt.debugMapSha256 !== "string" ||
        !("toolchainSha256" in receipt) ||
        typeof receipt.toolchainSha256 !== "string" ||
        !("checks" in receipt) ||
        !Array.isArray(receipt.checks)
      ) {
        throw new Error("Invalid normal build receipt.");
      }
      const checks = receipt.checks.map((check: unknown) => {
        if (typeof check !== "string") {
          throw new Error("Invalid build check.");
        }
        return check;
      });
      const verified: SourceBuildVerification = {
        outputSha256: receipt.outputSha256,
        debugMapSha256: receipt.debugMapSha256,
        toolchainSha256: receipt.toolchainSha256,
        checks,
      };
      return verified;
    },
  });
  const selection = {
    atlasId: "sprite.png",
    image: "source/sprite.png",
    layout: "source/sprite.layout.json",
    catalog: "source/palettes.json",
    atlases: [
      { id: "sprite.png", image: "source/sprite.png", layout: "source/sprite.layout.json" },
    ],
  };
  writeJson(".uttori-local/selection.json", selection);
  const expected = Uint8Array.from(original);
  for (const presentation of ["tilemap", "raster", "indexed-png"]) {
    const document = path.join(directory, ".uttori-local/" + presentation + ".file"),
      manifest = document + ".json";
    invoke([
      "export",
      directory,
      "--adapter",
      "som.sprite.native",
      "--selection",
      ".uttori-local/selection.json",
      "--document",
      document,
      "--manifest",
      manifest,
      "--presentation",
      presentation,
    ]);
    assert.deepEqual(
      readAssetImportReview(
        invoke(["review", directory, "--document", document, "--manifest", manifest]),
      ).files,
      [],
    );
    if (presentation === "indexed-png") {
      const codec = indexedPngAtlasCodec(0),
        value = await codec.decode(fs.readFileSync(document));
      value.indexes[0] ^= 1;
      fs.writeFileSync(document, await codec.encode(value));
    } else {
      const value = await decodeAsepriteDocument(fs.readFileSync(document));
      if (presentation === "tilemap") {
        value.tilesets[0].indexes[64] ^= 1;
      } else {
        const cel = value.frames[0].cels[0];
        if (cel.kind !== "raster") {
          throw new Error("Missing raster inventory.");
        }
        cel.indexes[0] ^= 1;
      }
      fs.writeFileSync(document, await encodeAsepriteDocument(value));
    }
    const reviewed = readAssetImportReview(
      invoke(["review", directory, "--document", document, "--manifest", manifest]),
    );
    expected[0x200] ^= 0x80;
    assert.equal(reviewed.outputSha256, hash(expected));
    invoke([
      "apply",
      directory,
      "--document",
      document,
      "--manifest",
      manifest,
      "--review",
      reviewed.id,
    ]);
    assert.deepEqual((await inspectSourceProject(directory)).output, expected);
  }
  // Public service resolution is checked separately from the bundled executable's implementation identity.
  const service = new AssetInterchangeService(directory, somSpriteSourceAdapter);
  const document = path.join(directory, ".uttori-local/public-api.aseprite");
  const manifest = await service.export(selection, { document, manifest: document + ".json" });
  assert.deepEqual((await service.review(manifest, document)).files, []);
  console.log(
    "Installed asset service and shipped tilemap/raster/PNG commands preserve the independent complete-ROM oracle.",
  );
} finally {
  fs.rmSync(directory, { recursive: true, force: true });
}

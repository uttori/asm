import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { sourceExportSha256 } from "@uttori/asm-disassembler";
import { sourceGit } from "@uttori/asm-disassembler/source-project";

import { test } from "../../../../tests/ava-helper.js";
import { SourceProcessClient } from "../../src/source/process-client.js";
import {
  readGenerationCommit,
  readMergePreview,
  readBuildOutput,
} from "../../src/source/result-readers.js";

for (const assembly of [undefined, "linked"] as const) {
  test.serial(
    `bundled regeneration preserves comments, structured operands and original ROM (${assembly ?? "absolute"})`,
    async (t) => {
      const parent = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-bundled-regeneration-"));
      t.teardown(() => fs.rmSync(parent, { recursive: true, force: true }));
      const identity = {
        GIT_AUTHOR_NAME: "Fixture",
        GIT_AUTHOR_EMAIL: "fixture@localhost",
        GIT_COMMITTER_NAME: "Fixture",
        GIT_COMMITTER_EMAIL: "fixture@localhost",
      };
      const previous = new Map(Object.keys(identity).map((key) => [key, process.env[key]]));
      Object.assign(process.env, identity);
      t.teardown(() => {
        for (const [key, value] of previous) {
          if (value === undefined) {
            delete process.env[key];
          } else {
            process.env[key] = value;
          }
        }
      });

      // Test the shipped executable without rebuilding it here: a stale bundle must fail even
      // when the renderer's TypeScript unit tests pass. The override checks an installed copy too.
      const worker =
        process.env.UTTORI_TEST_SOURCE_WORKER ??
        fileURLToPath(new URL("../../out/source-process.mjs", import.meta.url));
      const client = new SourceProcessClient(worker);
      t.teardown(() => client.dispose());
      const controls = { maxMemoryMiB: 512 };
      // A reset entry establishes native A16/X8 before the two documented operands.
      const rom = Buffer.alloc(0x8000, 0xea);
      rom.set([0x18, 0xfb, 0xc2, 0x20, 0xe2, 0x10, 0xa0, 2, 0xb7, 0xd1, 0x69, 4, 0, 0xdb]);
      rom.fill(0x20, 0x7fc0, 0x7fd5);
      rom[0x7fd5] = 0x20;
      rom[0x7fd7] = 5;
      rom.set([0xcb, 0xed, 0x34, 0x12], 0x7fdc);
      rom.fill(0, 0x7fe0);
      rom.writeUInt16LE(0x8000, 0x7ffc);
      const original = path.join(parent, "original.sfc");
      fs.writeFileSync(original, rom);
      const directory = path.join(parent, "project");
      await client.run({ action: "init", directory, rom: original, mapper: "lorom" }, controls);

      const explanation =
        "Preserve the high byte because the next phase consumes the complete word. "
          .repeat(8)
          .trim();
      const reason =
        "Exact scoped field or bounded constant; index ownership follows this consumer. "
          .repeat(8)
          .trim();
      const description = "Byte offset of the destination word within each four-byte command.";
      fs.writeFileSync(
        path.join(directory, "source/struct-map.json"),
        JSON.stringify({
          format: "uttori-asm-snes-struct-map",
          schemaVersion: 1,
          structures: [
            {
              id: "PaletteWord",
              size: 2,
              fields: [{ name: "color", offset: 0, size: 2, type: "dw" }],
            },
            {
              id: "Command",
              size: 4,
              fields: [{ name: "target", offset: 2, size: 2, description }],
            },
          ],
          bindings: [
            {
              name: "RequiredPalette",
              structure: "PaletteWord",
              address: 0x808020,
              fileOffset: 0x20,
              count: 2,
            },
          ],
          instructionUses: [
            {
              address: 0x808006,
              expectedBytes: [0xa0, 2],
              operand: "Command.target",
              reason,
              comment: explanation,
            },
            { address: 0x80800a, expectedBytes: [0x69, 4, 0], operand: "sizeof(Command)", reason },
          ],
        }),
      );
      const recipeFile = path.join(directory, ".uttori/generation-inputs.json");
      const recipe: unknown = JSON.parse(fs.readFileSync(recipeFile, "utf8"));
      if (
        typeof recipe !== "object" ||
        recipe === null ||
        !("recipes" in recipe) ||
        !Array.isArray(recipe.recipes)
      ) {
        throw new Error("Initialization did not publish a generation recipe list.");
      }
      recipe.recipes.push("struct-map.json");
      recipe.recipes.push("asset-includes.json");
      const includeFile = path.join(directory, "source/asset-includes.json");
      const requirements = [{ structure: "PaletteWord", format: "raw" }];
      fs.writeFileSync(includeFile, JSON.stringify({ version: 1, entries: [], requirements }));
      fs.writeFileSync(recipeFile, JSON.stringify(recipe));
      await sourceGit(directory, ["add", "--all"]);
      await sourceGit(directory, ["commit", "-m", "Document command operand contracts"]);

      // Exercise the shipped process, not the imported validator: an old worker
      // would silently keep the palette as dataStructs and incorrectly succeed.
      await t.throwsAsync(
        client.run({ action: "prepare", directory, ...(assembly ? { assembly } : {}) }, controls),
        {
          message: /Missing required raw includeAsset for RequiredPalette/,
        },
      );
      const assetPath = "source/assets/palette.bin",
        palette = rom.subarray(0x20, 0x24);
      fs.mkdirSync(path.dirname(path.join(directory, assetPath)), { recursive: true });
      fs.writeFileSync(path.join(directory, assetPath), palette);
      const originalBlob = (await sourceGit(directory, ["hash-object", "-w", assetPath])).stdout
        .toString()
        .trim();
      const completedRecipe: unknown = JSON.parse(fs.readFileSync(recipeFile, "utf8"));
      if (
        typeof completedRecipe !== "object" ||
        completedRecipe === null ||
        !("pristineAssets" in completedRecipe) ||
        !Array.isArray(completedRecipe.pristineAssets)
      ) {
        throw new Error("Missing pristine asset declarations.");
      }
      completedRecipe.pristineAssets.push({
        path: assetPath,
        sha256: sourceExportSha256(palette),
        originalBlob,
      });
      fs.writeFileSync(recipeFile, JSON.stringify(completedRecipe));
      const paletteDirective = 'includeAsset("../assets/palette.bin", "raw")';
      fs.writeFileSync(
        includeFile,
        JSON.stringify({
          version: 1,
          requirements,
          entries: [{ start: 0x20, end: 0x24, directive: paletteDirective }],
        }),
      );
      await sourceGit(directory, ["add", "--all"]);
      await sourceGit(directory, ["commit", "-m", "Admit required palette source"]);

      const prepared = await client.run(
        { action: "prepare", directory, ...(assembly ? { assembly } : {}) },
        { ...controls, readResult: readGenerationCommit },
      );
      const preview = await client.run(
        { action: "preview", directory, candidate: prepared.generation.commit },
        { ...controls, readResult: readMergePreview },
      );
      t.deepEqual(preview.conflicts, []);
      const bank = (
        await sourceGit(directory, ["show", `${preview.resultTree}:source/banks/bank-000.asm`])
      ).stdout.toString();
      t.true(bank.includes(paletteDirective));
      t.false(bank.includes("dataStructs RequiredPalette"));
      const unwrapped = bank.replaceAll(/^\s*;\s?/gm, "").replaceAll(/\s+/g, " ");
      t.true(unwrapped.includes(explanation), "The explanation survives beyond 240 characters.");
      t.false(bank.includes("Exact scoped field"));
      t.false(bank.includes("Details:"));
      t.false(bank.includes("struct-map.json"));
      t.false(bank.includes("LDY uses"));
      t.false(bank.includes("ADC uses"));
      t.false(bank.includes(description));
      t.true(bank.includes("LDY.b #Command.target"));
      t.true(bank.includes("ADC.w #sizeof(Command)"));
      const fields = (
        await sourceGit(directory, ["show", `${preview.resultTree}:source/structs.asm`])
      ).stdout.toString();
      t.true(fields.includes(description), "Shared context remains on the field declaration.");
      t.is(prepared.verification.outputSha256, prepared.generation.descriptor.inputs.romSha256);
    },
  );
}

test.serial(
  "shipped worker migrates an NES disassembly, retains raw edits and rejects an invalid linked layout",
  async (t) => {
    const parent = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-nes-migration-"));
    t.teardown(() => fs.rmSync(parent, { recursive: true, force: true }));
    const worker =
      process.env.UTTORI_TEST_SOURCE_WORKER ??
      fileURLToPath(new URL("../../out/source-process.mjs", import.meta.url));
    const client = new SourceProcessClient(worker);
    t.teardown(() => client.dispose());
    const controls = { maxMemoryMiB: 512 };
    const identity = {
      GIT_AUTHOR_NAME: "Fixture",
      GIT_AUTHOR_EMAIL: "fixture@localhost",
      GIT_COMMITTER_NAME: "Fixture",
      GIT_COMMITTER_EMAIL: "fixture@localhost",
    };
    const previous = new Map(Object.keys(identity).map((key) => [key, process.env[key]]));
    Object.assign(process.env, identity);
    t.teardown(() => {
      for (const [key, value] of previous) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    });

    const bytes = Buffer.alloc(16 + 32768 + 8192, 2);
    bytes.fill(0, 0, 16);
    bytes.set([0x4e, 0x45, 0x53, 0x1a, 2, 1]);
    bytes[16] = 0x60;
    for (const vector of [0x7ffa, 0x7ffc, 0x7ffe]) {
      bytes.writeUInt16LE(0x8000, 16 + vector);
    }
    const original = path.join(parent, "original.nes");
    fs.writeFileSync(original, bytes);
    const directory = path.join(parent, "project");
    await client.run({ action: "init", directory, rom: original }, controls);
    const rawFile = path.join(directory, "source/assets/raw/000000.bin");
    const raw = fs.readFileSync(rawFile);
    raw[0x100] = 3;
    fs.writeFileSync(rawFile, raw);
    await sourceGit(directory, ["add", "--all"]);
    await sourceGit(directory, ["commit", "-m", "Retain edited cartridge byte"]);
    const prepared = await client.run(
      { action: "prepare", directory, assembly: "linked" },
      { ...controls, readResult: readGenerationCommit },
    );
    t.is(prepared.verification.outputSha256, sourceExportSha256(bytes));
    const candidate = prepared.generation.commit;
    const preview = await client.run(
      { action: "preview", directory, candidate },
      { ...controls, readResult: readMergePreview },
    );
    t.deepEqual(preview.conflicts, []);
    await client.run({ action: "apply", directory, candidate }, controls);
    await client.run({ action: "finish", directory }, controls);
    const built = await client.run(
      { action: "build", directory },
      { ...controls, readResult: readBuildOutput },
    );
    const expected = Buffer.from(bytes);
    expected[16 + 0x100] = 3;
    t.deepEqual(fs.readFileSync(built.outputFile), expected);
    t.regex(
      fs.readFileSync(path.join(directory, "source/banks/prg_00.asm"), "utf8"),
      /section "PRG_00"/,
    );
    const recipeFile = path.join(directory, "source/link-recipe.json");
    const recipe = JSON.parse(fs.readFileSync(recipeFile, "utf8"));
    recipe.regions[1].size = 1;
    fs.writeFileSync(recipeFile, JSON.stringify(recipe));
    const pointerFile = path.join(directory, ".uttori-local/builds/current.json");
    const pointer = fs.readFileSync(pointerFile);
    await t.throwsAsync(client.run({ action: "build", directory }, controls), {
      message: /needs 8192 bytes|does not fit|exceed|capacity/i,
    });
    t.deepEqual(fs.readFileSync(pointerFile), pointer);
  },
);

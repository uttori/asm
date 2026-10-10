import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { sourceGit, type SourceMergePreview } from "@uttori/asm-disassembler";
import type { PreparedSnesGeneration } from "@uttori/asm-plugin-snes";

import { test } from "../../../../tests/ava-helper.js";
import { SourceProcessClient } from "../../src/source/process-client.js";

test.serial(
  "bundled regeneration preserves complete explicit comments and omits research reasons",
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

    const explanation = "Preserve the high byte because the next phase consumes the complete word. "
      .repeat(8)
      .trim();
    const reason = "Exact scoped field or bounded constant; index ownership follows this consumer. "
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
            id: "Command",
            size: 4,
            fields: [{ name: "target", offset: 2, size: 2, description }],
          },
        ],
        bindings: [],
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
    fs.writeFileSync(recipeFile, JSON.stringify(recipe));
    await sourceGit(directory, ["add", "--all"]);
    await sourceGit(directory, ["commit", "-m", "Document command operand contracts"]);

    const prepared = await client.run<PreparedSnesGeneration>(
      { action: "prepare", directory },
      controls,
    );
    const preview = await client.run<SourceMergePreview>(
      { action: "preview", directory, candidate: prepared.generation.commit },
      controls,
    );
    t.deepEqual(preview.conflicts, []);
    const bank = (
      await sourceGit(directory, ["show", `${preview.resultTree}:source/banks/bank-000.asm`])
    ).stdout.toString();
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

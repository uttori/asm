/**
 * Exercise the production source service in the independent full-project clone. Each explicit mode
 * leaves ordinary Git commits and an ignored verification report. Failures preserve the checkout
 * for inspection; only temporary unsafe-control edits are restored in a finally block.
 * Run with: node --conditions=uttori-source --import=tsx packages/cli/tests/fixtures/som-git-source-edits.mjs <mode>
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { bindFrameAtlasPalette } from "@uttori/asm-assets/secret-of-mana/som-frame-atlas";
import { renameResearchSymbol, writeResearchDocument } from "@uttori/asm-disassembler";
import {
  openSourceProject,
  sourceGit,
  sourceContentHash,
  sourceStatus,
  acceptedSourceGeneration,
} from "@uttori/asm-disassembler/source-project";
import { executeSourceOperation } from "@uttori/asm-workflows/source";

const application = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const root = path.join(application, "experiments/secret-of-mana-git-workflow-full");
const mode = process.argv[2];
const original = fs.readFileSync(path.join(root, "Secret of Mana (USA).sfc"));
assert.equal(
  sourceContentHash(original),
  "4c15013131351e694e05f22e38bb1b3e4031dedac77ec75abecebe8520d82d5f",
);
assert.ok(
  fs.existsSync(path.join(root, ".verification/seed.json")),
  "Use only the seeded verification clone.",
);
const bank = "disassembly/banks/bank-008.asm";
const expectedChanges = [
  [0x8e13e, 0x3f, 0x1f],
  [0x8e259, 0x6b, 0x6c],
  [0x82b8a, 0x08, 0x09],
  [0x63559, 0xf0, 0xf1],
];
const report = { mode, started: new Date().toISOString(), operations: [], node: process.version };
const json = (file) => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
const writeJson = (file, value) =>
  fs.writeFileSync(path.join(root, file), JSON.stringify(value, null, 2) + "\n");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

/** Every operation records its own timing and exact public result for replay and independent review. */
async function operation(action, values = {}) {
  const started = performance.now();
  const result = await executeSourceOperation({
    directory: root,
    action,
    ...values,
    onProgress: (message) => console.log(`${action}: ${message}`),
  });
  report.operations.push({
    action,
    elapsedMs: performance.now() - started,
    memory: process.memoryUsage(),
    result,
  });
  return result;
}

/** Compare all ROM bytes, rather than accepting a few expected offsets while missing other damage. */
function compare(build, modified) {
  const bytes = fs.readFileSync(build.outputFile);
  const expected = Buffer.from(original);
  if (modified) {
    for (const [offset, before, after] of expectedChanges) {
      assert.equal(expected[offset], before);
      expected[offset] = after;
    }
  }
  assert.equal(bytes.length, expected.length);
  const unexpected = [];
  for (let offset = 0; offset < bytes.length; offset++) {
    if (bytes[offset] !== expected[offset] && unexpected.length < 20) {
      unexpected.push({
        offset: offset.toString(16),
        expected: expected[offset],
        actual: bytes[offset],
      });
    }
  }
  assert.deepEqual(unexpected, [], "ROM differs outside the independent edit oracle.");
  report.outputSha256 = sourceContentHash(bytes);
  report.expectedChanges = modified ? expectedChanges : [];
}

/** Native merges are inspected, never automatically resolved by choosing a whole side. */
async function regenerate(modified) {
  const prepared = await operation("prepare");
  assert.equal(prepared.verification.outputSha256, sourceContentHash(original));
  const candidate = prepared.generation.commit;
  const preview = await operation("preview", { candidate });
  assert.deepEqual(preview.conflicts, [], "Inspect native conflicts before continuing this run.");
  const applied = await operation("apply", { candidate });
  if (applied.phase === "merging") {
    await operation("finish", { message: `Verify regeneration: ${mode}` });
  }
  compare(await operation("build"), modified);
  if (modified) {
    const symbols = json("disassembly/source-symbols.json");
    const renamed = symbols.symbols.find((symbol) => symbol.id === "symbol:snes.cpu:c0389c");
    assert.equal(renamed.name, "LocalRandomByte");
    assert.ok(
      read(bank).includes("; Git editing verification: preserve this ordinary source comment."),
    );
    assert.equal(read(bank).match(/\bFn_C0389C\b/g), null);
  }
  assert.equal((await sourceStatus((await openSourceProject(root)).repository)).length, 0);
}

/** Guard fixture replacements so exporter changes require reviewing the intended edit again. */
function replaceOnce(text, before, after) {
  assert.equal(text.split(before).length, 2, `Expected one exact source anchor: ${before}`);
  return text.replace(before, after);
}

try {
  const project = await openSourceProject(root);
  report.before = (await sourceGit(root, ["rev-parse", "HEAD"])).stdout.toString().trim();
  if (mode === "baseline") {
    // SQLite shared-memory files are private inputs, not a user's source checkpoint.
    let ignores = read(".gitignore");
    if (!ignores.split("\n").includes("disassembly/analysis/analysis.sqlite-shm")) {
      ignores += "\ndisassembly/analysis/analysis.sqlite-shm\n";
      fs.writeFileSync(path.join(root, ".gitignore"), ignores);
    }
    const config = json(".uttori/project.json");
    config.limits = { ...config.limits, captureBytes: 8 * 1024 ** 3 };
    writeJson(".uttori/project.json", config);
    await sourceGit(root, [
      "add",
      "--",
      ".gitignore",
      ".uttori/project.json",
      "disassembly/analysis/analysis.json",
    ]);
    await sourceGit(root, [
      "commit",
      "-m",
      "Declare full-capture budget and checkpoint analyzed evidence",
    ]);
    await regenerate(false);
  } else if (mode === "bind-palettes") {
    const baseline = await acceptedSourceGeneration(project.repository, report.before);
    const catalog = JSON.parse(
      (
        await sourceGit(root, ["show", `${baseline}:disassembly/assets/palettes/rom-palettes.json`])
      ).stdout.toString(),
    );
    const files = (
      await sourceGit(root, [
        "ls-files",
        "-z",
        "--",
        "disassembly/assets/images/*.layout.json",
        "disassembly/assets/images/**/*.layout.json",
      ])
    ).stdout
      .toString()
      .split("\0")
      .filter(Boolean);
    report.bindings = [];
    for (const file of files) {
      const source = {
        bytes: fs.readFileSync(path.join(root, file.replace(/\.layout\.json$/, ".png"))),
        mediaType: "image/png",
      };
      const layout = json(file);
      assert.equal(
        layout.indexPalette,
        undefined,
        "Inspect existing palette bindings before replacing them.",
      );
      writeJson(file, bindFrameAtlasPalette(source, layout, catalog));
      report.bindings.push(file);
    }
    assert.ok(report.bindings.length);
  } else if (mode === "resolve-cycle-1") {
    const candidate = json(".verification/edit-matrix-cycle-1.json").operations.find(
      (item) => item.action === "prepare",
    ).result.generation.commit;
    const status = await operation("status");
    assert.equal(status.phase, "merging");
    assert.deepEqual(status.conflicts, [bank]);
    // This is the reviewed fixture resolution, deliberately narrower than a general merge driver.
    const before = `<<<<<<< HEAD\n  AND.b #$1F\n=======\n  AND.b #$3F\n>>>>>>> ${candidate}\n`;
    fs.writeFileSync(path.join(root, bank), replaceOnce(read(bank), before, "  AND.b #$1F\n"));
    await sourceGit(root, ["add", "--", bank]);
    await operation("finish", {
      message: "Resolve regenerated RNG reference while retaining the instruction edit",
    });
    compare(await operation("build"), true);
  } else if (mode === "verify-edits") {
    compare(await operation("build"), true);
  } else if (mode === "edits") {
    assert.equal(
      (await sourceStatus(project.repository)).length,
      0,
      "Checkpoint before installing verification edits.",
    );
    let source = read(bank);
    source = replaceOnce(
      source,
      "  JSL.l Fn_C0389C\n  AND.b #$3F\n  CMP.b RAM_SHARED_WORK_03A4",
      "  JSL.l Fn_C0389C\n  AND.b #$1F\n  CMP.b RAM_SHARED_WORK_03A4",
    );
    source = replaceOnce(
      source,
      "dataStructs ChestTrapHandlers\n  [0] = {\n    offset = $E26B",
      "dataStructs ChestTrapHandlers\n  [0] = {\n    offset = $E26C",
    );
    const tableStart = source.indexOf("dataStructs ChestTrapHandlers");
    const tableEnd = source.indexOf("endDataStructs", tableStart) + "endDataStructs".length;
    source = source.slice(0, tableEnd) + "\nChestTrapHandlers_End:" + source.slice(tableEnd);
    source = replaceOnce(
      source,
      "Chest_SelectReward:",
      "; Git editing verification: preserve this ordinary source comment.\nChest_SelectReward:",
    );
    fs.writeFileSync(path.join(root, bank), source);
    const palettePath = "disassembly/assets/palettes/rom-palettes.json";
    const palette = json(palettePath);
    assert.equal(palette.palettes.C82B8A.words[0], "2108");
    palette.palettes.C82B8A.words[0] = "2109";
    writeJson(palettePath, palette);
    const rawPath = path.join(root, "disassembly/assets/raw/063000.bin");
    const raw = fs.readFileSync(rawPath);
    assert.equal(raw[0x559], 0xf0);
    raw[0x559] = 0xf1;
    fs.writeFileSync(rawPath, raw);
    const identity = json("disassembly/source-symbols.json").symbols.find(
      (symbol) => symbol.name === "Fn_C0389C",
    );
    assert.ok(identity);
    const rename = renameResearchSymbol(
      project.research,
      { ...identity, currentName: identity.name },
      "LocalRandomByte",
      ".uttori/research/symbols.json",
    );
    writeResearchDocument(root, rename.path, rename.document, rename.expectedSha256);
    const assembly = (
      await sourceGit(root, ["ls-files", "-z", "--", "disassembly/*.asm", "disassembly/**/*.asm"])
    ).stdout
      .toString()
      .split("\0")
      .filter(Boolean);
    let references = 0;
    for (const file of assembly) {
      const text = read(file);
      const updated = text.replace(/\bFn_C0389C\b/g, () => {
        references++;
        return "LocalRandomByte";
      });
      if (text !== updated) {
        fs.writeFileSync(path.join(root, file), updated);
      }
    }
    assert.ok(references > 1);
    report.renamedReferences = references;
    const layout = json(".uttori/layout.json");
    layout.states.push({ offset: 0x8e13d, e: false, m: true });
    layout.extents.push({
      id: "table:chest-trap-handlers",
      startSymbol: "ChestTrapHandlers",
      endSymbol: "ChestTrapHandlers_End",
      size: 18,
    });
    writeJson(".uttori/layout.json", layout);
    compare(await operation("build"), true);
    await sourceGit(root, [
      "add",
      "--",
      ...assembly,
      palettePath,
      "disassembly/assets/raw/063000.bin",
      rename.path,
      ".uttori/layout.json",
    ]);
    await sourceGit(root, [
      "commit",
      "-m",
      "Exercise instruction, table, palette, raw, rename and comment edits",
    ]);
    await regenerate(true);
  } else if (mode?.startsWith("cycle-")) {
    await regenerate(true);
  } else if (mode === "unsafe") {
    const baseline = read(bank);
    const controls = [
      [
        "instruction-growth",
        replaceOnce(
          baseline,
          "  AND.b #$1F\n  CMP.b RAM_SHARED_WORK_03A4",
          "  AND.w #$001F\n  CMP.b RAM_SHARED_WORK_03A4",
        ),
      ],
      [
        "table-growth",
        replaceOnce(
          baseline,
          "endDataStructs\nChestTrapHandlers_End:",
          "endDataStructs\n  dw $E26B\nChestTrapHandlers_End:",
        ),
      ],
    ];
    report.controls = [];
    try {
      for (const [name, source] of controls) {
        fs.writeFileSync(path.join(root, bank), source);
        let failure;
        try {
          await operation("build");
        } catch (error) {
          failure = String(error);
        }
        assert.ok(failure, `${name} must fail validation.`);
        // Typed data can reject a shifted PC during assembly, before the later layout checks.
        assert.match(failure, /instruction-width|fixed-extent|overlap|assert|requires pc\(\) ==/i);
        report.controls.push({ name, failure });
      }
    } finally {
      fs.writeFileSync(path.join(root, bank), baseline);
    }
    compare(await operation("build"), true);
  } else {
    throw new Error(
      "Choose baseline, edits, bind-palettes, verify-edits, cycle-<number>, or unsafe.",
    );
  }
  report.after = (await sourceGit(root, ["rev-parse", "HEAD"])).stdout.toString().trim();
  report.success = true;
} catch (error) {
  report.error = String(error);
  throw error;
} finally {
  assert.match(mode ?? "", /^[\da-z-]+$/);
  writeJson(`.verification/edit-matrix-${mode}.json`, report);
  console.log(
    JSON.stringify({
      mode,
      success: report.success ?? false,
      error: report.error,
      outputSha256: report.outputSha256,
    }),
  );
}

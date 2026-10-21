/** Full-project relocation rehearsal; only the independently seeded clone may be modified. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath, pathToFileURL } from "node:url";

import { WorkspaceIndex } from "@uttori/asm-core/tooling";
import { sourceContentHash, sourceGit } from "@uttori/asm-disassembler/source-project";
import { executeSourceOperation } from "@uttori/asm-workflows/source";
import { TextDocumentEdit } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { snesWorkspaceIndexOptions } from "../../../../tests/test-assembler.js";
import { pathToUri, uriToPath } from "../../../language-server/src/providers.ts";
import { researchRenameEditsFor } from "../../../language-server/src/research-rename.ts";

const application = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const root = path.join(application, "experiments/secret-of-mana-git-workflow-full");
const mode = process.argv[2];
const bank = "disassembly/banks/bank-008.asm";
const layoutFile = ".uttori/layout.json";
const original = fs.readFileSync(path.join(root, "Secret of Mana (USA).sfc"));
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const json = (file) => JSON.parse(read(file));
const write = (file, value) => fs.writeFileSync(path.join(root, file), value);
const writeJson = (file, value) => write(file, JSON.stringify(value, null, 2) + "\n");
assert.equal(json(".verification/seed.json").root, root);
assert.equal(
  sourceContentHash(original),
  "4c15013131351e694e05f22e38bb1b3e4031dedac77ec75abecebe8520d82d5f",
);
const report = { mode, started: new Date().toISOString(), operations: [] };

/** Preserve exact public results and timings even if a later validation fails. */
async function operation(action, values = {}) {
  const start = performance.now();
  const result = await executeSourceOperation({
    action,
    directory: root,
    ...values,
    onProgress: (message) => console.log(`${action}: ${message}`),
  });
  report.operations.push({ action, elapsedMs: performance.now() - start, result });
  return result;
}

/** Require one reviewed anchor; exporter changes must not silently broaden fixture edits. */
function replaceOnce(source, before, after) {
  assert.equal(source.split(before).length, 2, `Expected one anchor: ${before}`);
  return source.replace(before, after);
}

/** A complete independent ROM oracle includes retired bytes, pointer repair, and earlier edits. */
async function verify() {
  const built = await operation("build");
  const expected = Buffer.from(original);
  expected[0x8e13e] = 0x1f;
  expected[0x82b8a] = 0x09;
  expected[0x63559] = 0xf1;
  const object = json(layoutFile).objects[0];
  const table = Buffer.from(original.subarray(0x8e259, 0x8e26b));
  table[0] = 0x6c;
  expected.set(table, object.start);
  assert.equal(object.length, 20);
  expected.writeUInt16LE(0xe26c, object.start + 18);
  expected.writeUInt16LE(object.start & 0xffff, 0x8e24e);
  const actual = fs.readFileSync(built.outputFile);
  assert.deepEqual(actual, expected);
  report.outputSha256 = sourceContentHash(actual);
  report.object = object;
  return built;
}

try {
  report.before = (await sourceGit(root, ["rev-parse", "HEAD"])).stdout.toString().trim();
  if (mode === "enroll") {
    assert.equal(json(".verification/capture-reimport.json").success, true);
    const layout = json(layoutFile);
    assert.equal(layout.objects, undefined);
    const { resolveMetatileStream, decodeMetatiles } = await import(
      pathToFileURL(path.join(root, "tools/som-tilesets.mjs")).href
    );
    const streams = [0x1e, 0x1f].map((id) => {
      const stream = resolveMetatileStream(original, id);
      const decoded = decodeMetatiles(stream.bytes);
      return {
        id,
        address: stream.address,
        end: stream.end,
        words: decoded.words.length,
        consumedBits: decoded.consumedBits,
      };
    });
    assert.equal(streams[1].end, 0xc8fed6);
    assert.ok(original.subarray(0x8fed6, 0x90000).every((byte) => byte === 255));
    // Source references are audited independently of trace absence. This is a test-pool declaration,
    // with runtime validation still required before adopting any allocation in the original project.
    const nearUses = [];
    for (let offset = 0x80000; offset < 0x90000 - 1; offset++) {
      if (original.readUInt16LE(offset) === 0xe259) {
        nearUses.push(offset);
      }
    }
    assert.deepEqual(nearUses, [0x8e24e]);
    assert.equal(original[0x8e24d], 0xfc);
    const database = new DatabaseSync(path.join(root, "disassembly/analysis/analysis.sqlite"), {
      readOnly: true,
    });
    let evidence;
    try {
      evidence = {
        execution: database
          .prepare(
            "SELECT count(*) AS count FROM runtime_observations WHERE query_file_offset >= ? AND query_file_offset < ?",
          )
          .get(0x8fed6, 0x90000).count,
        descriptors: database
          .prepare(
            "SELECT count(*) AS count FROM runtime_descriptors WHERE (address & 4194303) BETWEEN ? AND ? OR (to_address & 4194303) BETWEEN ? AND ? OR (accessed_address & 4194303) BETWEEN ? AND ?",
          )
          .get(0x8fed6, 0x8ffff, 0x8fed6, 0x8ffff, 0x8fed6, 0x8ffff).count,
        labels: database
          .prepare("SELECT count(*) AS count FROM labels WHERE address BETWEEN ? AND ?")
          .get(0xc8fed6, 0xc8ffff).count,
        annotations: database
          .prepare(
            "SELECT count(*) AS count FROM annotations WHERE address_space = 'snes.cpu' AND start < ? AND \"end\" > ?",
          )
          .get(0xc90000, 0xc8fed6).count,
      };
    } finally {
      database.close();
    }
    assert.deepEqual(evidence, { execution: 0, descriptors: 0, labels: 0, annotations: 0 });
    write(
      bank,
      replaceOnce(
        read(bank),
        '  incbin "../assets/raw/08f000.bin":$07AE..$1000',
        '  incbin "../assets/raw/08f000.bin":$07AE..$0FC0\n\n; Reviewed padding after the final bank-C8 metatile stream.\nGitEditing_C8FreeSpace:\n  incbin "../assets/raw/08f000.bin":$0FC0..$1000\nGitEditing_C8FreeSpace_End:',
      ),
    );
    layout.objects = [
      {
        id: "table:chest-trap-handlers",
        originalStart: 0x8e259,
        originalEnd: 0x8e26b,
        start: 0x8e259,
        length: 18,
        alignment: 1,
        bankSize: 0x10000,
        movable: true,
        referencesComplete: true,
        kind: "data",
        file: bank,
        startSymbol: "ChestTrapHandlers",
        endSymbol: "ChestTrapHandlers_End",
        structure: { file: "disassembly/structs.asm", recordSize: 2 },
      },
    ];
    layout.freeSpace = [
      {
        id: "bank-c8-padding",
        start: 0x8ffc0,
        end: 0x90000,
        originalSha256: sourceContentHash(original.subarray(0x8ffc0, 0x90000)),
        file: bank,
        startSymbol: "GitEditing_C8FreeSpace",
        endSymbol: "GitEditing_C8FreeSpace_End",
      },
    ];
    layout.references = [
      {
        id: "chest-indexed-jsr",
        target: "table:chest-trap-handlers",
        offset: 0x8e24e,
        expected: [0x59, 0xe2],
        encoding: "bank16",
        bank: 0xc8,
        expression: "$E259",
      },
    ];
    writeJson(layoutFile, layout);
    report.proof = {
      streams,
      padding: [0x8fed6, 0x90000],
      testPool: [0x8ffc0, 0x90000],
      evidence,
      nearUses,
    };
    const baseline = await operation("build");
    assert.equal(
      baseline.verification.outputSha256,
      "3fb61a0e79eb5a34155be890299e93f0136b0f083f84ec8ef1d533430704255c",
    );
    await sourceGit(root, ["add", "--", bank, layoutFile]);
    await sourceGit(root, [
      "commit",
      "-m",
      "Declare reviewed C8 test space and chest-table references",
    ]);
  } else if (mode === "grow") {
    assert.equal(json(layoutFile).objects[0].length, 18);
    const source = read(bank),
      start = source.indexOf("dataStructs ChestTrapHandlers");
    const end = source.indexOf("endDataStructs", start);
    assert.ok(start > 0 && end > start);
    write(bank, source.slice(0, end) + "  [9] = {\n    offset = $E26C\n  }\n" + source.slice(end));
    const result = await operation("relocate", { objectId: "table:chest-trap-handlers" });
    assert.equal(result.plan.destination, 0x8ffc0);
    // The fixture applies exactly the service's reviewed text edits with compare-and-swap checks.
    for (const edit of result.edits) {
      assert.equal(sourceContentHash(read(edit.path)), edit.beforeSha256);
    }
    for (const edit of result.edits) {
      write(edit.path, edit.after);
    }
    await verify();
    await sourceGit(root, ["add", "--", ...result.edits.map((edit) => edit.path)]);
    await sourceGit(root, [
      "commit",
      "-m",
      "Grow and relocate chest handlers with native source edits",
    ]);
  } else if (mode === "resolve-cycle-5") {
    const candidate = json(".verification/relocation-cycle-5.json").operations.find(
      (item) => item.action === "prepare",
    ).result.generation.commit;
    const status = await operation("status");
    assert.equal(status.phase, "merging");
    assert.deepEqual(status.conflicts, [bank, "disassembly/structs.asm"]);
    // These exact reviewed hunks retain the new name and current placement. They are fixture
    // resolutions of actual Git stages, not a general merge driver that prefers an entire side.
    write(
      bank,
      replaceOnce(
        read(bank),
        `<<<<<<< HEAD\n; @uttori-placement table:chest-trap-handlers begin\norg $C8FFC0\n=======\n>>>>>>> ${candidate}\n`,
        "; @uttori-placement table:chest-trap-handlers begin\norg $C8FFC0\n",
      ),
    );
    write(
      "disassembly/structs.asm",
      replaceOnce(
        read("disassembly/structs.asm"),
        `<<<<<<< HEAD\nstruct ChestEffectHandlers $C8FFC0\n=======\nstruct ChestEffectHandlers $C8E259\n>>>>>>> ${candidate}\n`,
        "struct ChestEffectHandlers $C8FFC0\n",
      ),
    );
    await sourceGit(root, ["add", "--", bank, "disassembly/structs.asm"]);
    await operation("finish", {
      message: "Resolve renamed chest table while retaining its verified placement",
    });
    await verify();
  } else if (mode === "rename-table") {
    const index = new WorkspaceIndex(snesWorkspaceIndexOptions());
    const priorBuild = json(".verification/relocation-grow.json").operations.find(
      (entry) => entry.action === "build",
    ).result;
    // Only the accepted build's source graph belongs to this test. Historical generated interfaces
    // are still awaiting cleanup and must not become duplicate live declarations in the index.
    const files = JSON.parse(fs.readFileSync(priorBuild.debugMapFile, "utf8"))
      .sources.map((source) => source.path)
      .filter((file) => file.endsWith(".asm"));
    for (const file of files) {
      index.openDocument(path.join(root, file), read(file));
    }
    const declarationFile = path.join(root, "disassembly/structs.asm");
    const text = fs.readFileSync(declarationFile, "utf8");
    const line = text
      .split("\n")
      .findIndex((textLine) => textLine.startsWith("struct ChestTrapHandlers "));
    assert.ok(line >= 0);
    const edits = await researchRenameEditsFor(
      index,
      declarationFile,
      { line, character: 10 },
      "ChestEffectHandlers",
      [],
    );
    const changed = [];
    for (const edit of edits.documentChanges) {
      assert.ok(TextDocumentEdit.is(edit));
      const file = uriToPath(edit.textDocument.uri);
      assert.ok(file.startsWith(root + path.sep));
      const before = fs.readFileSync(file, "utf8");
      const document = TextDocument.create(pathToUri(file), "plaintext", 1, before);
      fs.writeFileSync(file, TextDocument.applyEdits(document, edit.edits));
      changed.push(path.relative(root, file));
    }
    assert.ok(changed.includes("disassembly/struct-map.json"));
    assert.ok(changed.includes(layoutFile));
    await verify();
    await sourceGit(root, ["add", "--", ...changed]);
    await sourceGit(root, [
      "commit",
      "-m",
      "Rename moved chest table through the native F2 service",
    ]);
    report.changedFiles = changed;
  } else if (mode === "runtime-baseline") {
    const paletteFile = "disassembly/assets/palettes/rom-palettes.json";
    const rawFile = "disassembly/assets/raw/063000.bin";
    const saved = new Map(
      [bank, paletteFile, rawFile].map((file) => [file, fs.readFileSync(path.join(root, file))]),
    );
    try {
      let source = replaceOnce(
        read(bank),
        "  AND.b #$1F\n  CMP.b RAM_SHARED_WORK_03A4",
        "  AND.b #$3F\n  CMP.b RAM_SHARED_WORK_03A4",
      );
      const tableName = json(layoutFile).objects[0].startSymbol;
      source = replaceOnce(
        source,
        `dataStructs ${tableName}\n  [0] = {\n    offset = $E26C`,
        `dataStructs ${tableName}\n  [0] = {\n    offset = $E26B`,
      );
      write(bank, source);
      const palette = json(paletteFile);
      assert.equal(palette.palettes.C82B8A.words[0], "2109");
      palette.palettes.C82B8A.words[0] = "2108";
      writeJson(paletteFile, palette);
      const raw = Buffer.from(saved.get(rawFile));
      assert.equal(raw[0x559], 0xf1);
      raw[0x559] = 0xf0;
      write(rawFile, raw);
      const built = await operation("build");
      const expected = Buffer.from(original);
      expected.writeUInt16LE(0xffc0, 0x8e24e);
      expected.set(original.subarray(0x8e259, 0x8e26b), 0x8ffc0);
      expected.writeUInt16LE(0xe26c, 0x8ffd2);
      assert.deepEqual(fs.readFileSync(built.outputFile), expected);
      report.outputSha256 = sourceContentHash(expected);
    } finally {
      for (const [file, bytes] of saved) {
        write(file, bytes);
      }
    }
  } else if (mode?.startsWith("cycle-")) {
    const prepared = await operation("prepare");
    assert.equal(prepared.verification.outputSha256, sourceContentHash(original));
    const candidate = prepared.generation.commit;
    const preview = await operation("preview", { candidate });
    assert.deepEqual(
      preview.conflicts,
      [],
      "Inspect native relocation conflicts before continuing.",
    );
    const applied = await operation("apply", { candidate });
    if (applied.phase === "merging") {
      await operation("finish", { message: `Verify relocated table regeneration ${mode}` });
    }
    await verify();
  } else if (mode === "verify") {
    await verify();
  } else {
    throw new Error("Choose enroll, grow, verify or cycle-N.");
  }
  report.success = true;
} catch (error) {
  report.error = String(error);
  throw error;
} finally {
  report.peakRssKiB = process.resourceUsage().maxRSS;
  report.gitObjects = (await sourceGit(root, ["count-objects", "-v"])).stdout.toString();
  writeJson(`.verification/relocation-${mode}.json`, report);
}

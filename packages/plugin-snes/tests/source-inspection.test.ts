import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  acquireFileLease,
  sourceContentHash,
  sourceLinkFiles,
  readSourceLinkBuild,
} from "@uttori/asm-disassembler/source-project";

import { test } from "../../../tests/ava-helper.js";
import { createSnesAssemblerEnvironment } from "../src/assembler.js";
import type { SnesPlacementContract } from "../src/disassembler/rom-layout/check.js";
import {
  buildSnesSource,
  inspectSnesSource,
  inspectSnesSourceModule,
} from "../src/disassembler/source-build.js";

for (const boundary of [
  "pending.json",
  "program.sfc",
  "program.sfc.debug.json",
  "build.json",
  "current.json",
  "disk-full",
] as const) {
  test(`build publication recovers after ${boundary} failure without mixing ROM/map receipts`, async (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "source-build-crash-"));
    t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
    const file = path.join(root, "main.asm");
    const options = {
      root,
      entrySource: "main.asm",
      environment: await createSnesAssemblerEnvironment(),
      expectedSize: 1,
      targetOptions: { checksumEnabled: false },
      outputDirectory: path.join(root, "build"),
      toolchainSha256: "a".repeat(64),
      configurationSha256: "b".repeat(64),
    };
    fs.writeFileSync(file, "hirom\norg $C00000\ndb 0\n");
    const baseline = buildSnesSource(options);
    fs.writeFileSync(file, "hirom\norg $C00000\ndb 1\n");
    const result = spawnSync(
      process.execPath,
      [
        "--conditions=uttori-source",
        "--import=tsx",
        path.resolve("packages/plugin-snes/tests/fixtures/source-build-fault.mjs"),
        root,
        boundary === "disk-full" ? "current.json" : boundary,
        boundary === "disk-full" ? "disk-full" : "kill",
      ],
      { encoding: "utf8", timeout: 15000 },
    );
    if (boundary === "disk-full") {
      t.not(result.status, 0);
      t.regex(result.stderr, /ENOSPC/);
    } else {
      t.is(result.signal, "SIGKILL", result.stderr);
    }
    const current = JSON.parse(fs.readFileSync(path.join(root, "build/current.json"), "utf8"));
    if (boundary === "current.json") {
      t.not(current.inputSha256, baseline.inputSha256);
      t.deepEqual([...fs.readFileSync(current.outputFile)], [1]);
    } else {
      t.is(current.inputSha256, baseline.inputSha256);
      t.deepEqual([...fs.readFileSync(current.outputFile)], [0]);
    }
    t.is(sourceContentHash(fs.readFileSync(current.outputFile)), current.verification.outputSha256);
    t.is(
      sourceContentHash(fs.readFileSync(current.debugMapFile)),
      current.verification.debugMapSha256,
    );
    // Publishing a later input reclaims the dead process's lease and incomplete outputs.
    fs.writeFileSync(file, "hirom\norg $C00000\ndb 2\n");
    const recovered = buildSnesSource(options);
    t.deepEqual([...fs.readFileSync(recovered.outputFile)], [2]);
    const directories = fs
      .readdirSync(path.join(root, "build"))
      .filter((name) => /^[\da-f]{64}$/.test(name));
    t.is(directories.length, 1);
    for (const directory of directories) {
      t.true(fs.existsSync(path.join(root, "build", directory, "build.json")));
    }
  });
}

test("successful source builds bound owned cache history without deleting unknown files or publishing under another lease", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "source-cache-"));
  t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
  const source = path.join(root, "main.asm");
  const options = {
    root,
    entrySource: "main.asm",
    environment: await createSnesAssemblerEnvironment(),
    expectedSize: 1,
    targetOptions: { checksumEnabled: false },
    outputDirectory: path.join(root, "build"),
    toolchainSha256: "a".repeat(64),
    configurationSha256: "b".repeat(64),
  };
  let latest;
  for (let value = 0; value < 8; value++) {
    fs.writeFileSync(source, `hirom\norg $C00000\ndb ${value}\n`);
    latest = buildSnesSource(options);
  }
  const generations = () =>
    fs.readdirSync(options.outputDirectory).filter((file) => /^[\da-f]{64}$/.test(file));
  t.is(generations().length, 1);
  t.true(generations().includes(latest!.inputSha256));
  const unknown = path.join(options.outputDirectory, "f".repeat(64));
  fs.mkdirSync(unknown);
  fs.writeFileSync(path.join(unknown, "notes.txt"), "Keep this authored file");
  const abandoned = path.join(options.outputDirectory, "e".repeat(64));
  fs.mkdirSync(abandoned);
  fs.writeFileSync(
    path.join(abandoned, "pending.json"),
    JSON.stringify({
      inputSha256: "e".repeat(64),
      outputFile: path.join(abandoned, "program.sfc"),
      debugMapFile: path.join(abandoned, "program.sfc.debug.json"),
    }),
  );
  fs.writeFileSync(path.join(abandoned, "program.sfc"), "partial");
  const leased = acquireFileLease(path.join(options.outputDirectory, "publication.lock"));
  try {
    t.throws(() => buildSnesSource(options), { message: /An operation owns/ });
    t.is(
      JSON.parse(fs.readFileSync(path.join(options.outputDirectory, "current.json"), "utf8"))
        .inputSha256,
      latest!.inputSha256,
    );
  } finally {
    leased.release();
  }
  const result = buildSnesSource(options);
  t.is(result.cacheWarnings?.length, 1);
  t.false(fs.existsSync(abandoned));
  t.is(fs.readFileSync(path.join(unknown, "notes.txt"), "utf8"), "Keep this authored file");
  t.is(generations().length, 2);
});

test("placement inspection measures prospective emission without publishing or altering saved source", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "source-inspection-"));
  t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
  const source = "hirom\norg $C00000\nTable:\ndw $1234, $5678\nTableEnd:\n";
  fs.writeFileSync(path.join(root, "main.asm"), source);
  const environment = await createSnesAssemblerEnvironment();
  const options = {
    root,
    entrySource: "main.asm",
    environment,
    targetOptions: { checksumEnabled: false },
    expectedSize: 4,
    extents: [{ id: "table", startSymbol: "Table", endSymbol: "TableEnd", size: 4 }],
    toolchainSha256: "a".repeat(64),
    configurationSha256: "b".repeat(64),
    outputDirectory: path.join(root, "build"),
  };
  const baseline = buildSnesSource(options);
  const receipt = fs.readFileSync(path.join(path.dirname(baseline.outputFile), "build.json"));
  const overlay = Buffer.from(source.replace("dw $1234, $5678", "dw $1234, $5678, $9ABC"));
  const inspected = inspectSnesSource({ ...options, overlays: new Map([["main.asm", overlay]]) });
  t.deepEqual([...inspected.output], [0x34, 0x12, 0x78, 0x56, 0xbc, 0x9a]);
  t.is(inspected.symbols.get("TableEnd")! - inspected.symbols.get("Table")!, 6);
  t.deepEqual(
    inspected.diagnostics.map((item) => item.code),
    ["output-size", "fixed-extent"],
  );
  t.deepEqual([...inspected.snapshots.get(path.join(root, "main.asm"))!], [...overlay]);
  t.is(fs.readFileSync(path.join(root, "main.asm"), "utf8"), source);
  t.deepEqual(fs.readFileSync(path.join(path.dirname(baseline.outputFile), "build.json")), receipt);
  t.deepEqual(
    fs.readdirSync(options.outputDirectory).toSorted(),
    ["current.json", "summary.json", baseline.inputSha256].toSorted(),
  );
  t.deepEqual(
    JSON.parse(fs.readFileSync(path.join(options.outputDirectory, "current.json"), "utf8")),
    baseline,
  );
  // Even a JavaScript caller passing extra inspection fields cannot publish a false saved-file receipt.
  const supplied = { ...options, overlays: new Map([["main.asm", overlay]]) };
  t.is(buildSnesSource(supplied).inputSha256, baseline.inputSha256);
  t.throws(() => inspectSnesSource({ ...options, overlays: new Map([["unused.asm", overlay]]) }), {
    message: /not consumed/,
  });
});

test("ordinary builds enforce saved placement and pointer contracts before replacing a receipt", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "source-placement-build-"));
  t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
  const file = path.join(root, "main.asm");
  const source = "hirom\norg $C00000\ndl Table\nTable:\ndw $1234\nTableEnd:\n";
  fs.writeFileSync(file, source);
  const placements: SnesPlacementContract = {
    objects: [
      {
        id: "table",
        originalStart: 3,
        originalEnd: 5,
        start: 3,
        length: 2,
        alignment: 1,
        bankSize: 0x10000,
        movable: true,
        referencesComplete: true,
        kind: "data",
        startSymbol: "Table",
        endSymbol: "TableEnd",
      },
    ],
    references: [
      { id: "pointer", target: "table", offset: 0, encoding: "long24", expected: [3, 0, 0xc0] },
    ],
    logicalAddress: (offset) => 0xc00000 + offset,
  };
  const options = {
    root,
    entrySource: "main.asm",
    environment: await createSnesAssemblerEnvironment(),
    targetOptions: { checksumEnabled: false },
    expectedSize: 5,
    placements,
    toolchainSha256: "a".repeat(64),
    configurationSha256: "b".repeat(64),
    outputDirectory: path.join(root, "build"),
  };
  const baseline = buildSnesSource(options);
  const receiptPath = path.join(path.dirname(baseline.outputFile), "build.json");
  const receipt = fs.readFileSync(receiptPath);
  fs.writeFileSync(file, source.replace("dl Table", "dl $C00004"));
  t.throws(() => buildSnesSource(options), { message: /Encoded field no longer targets/ });
  fs.writeFileSync(file, source);
  t.throws(
    () =>
      buildSnesSource({
        ...options,
        placements: {
          ...placements,
          objects: [{ ...placements.objects[0], start: 2 }],
        },
      }),
    { message: /no longer matches its declared placement/ },
  );
  t.deepEqual(fs.readFileSync(receiptPath), receipt);
  t.deepEqual(
    fs.readdirSync(options.outputDirectory).toSorted(),
    ["current.json", "summary.json", baseline.inputSha256].toSorted(),
  );
  t.deepEqual(
    JSON.parse(fs.readFileSync(path.join(options.outputDirectory, "current.json"), "utf8")),
    baseline,
  );
});

test("module inspection hashes consumed overlays and host identities without publishing a ROM", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "module-inspection-"));
  t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
  const source = 'section "Data",data\nimport External\ndl External\nincbin "asset.bin"\n';
  fs.writeFileSync(path.join(root, "main.asm"), source);
  fs.writeFileSync(path.join(root, "asset.bin"), Uint8Array.of(1, 2));
  const options = {
    root,
    entrySource: "main.asm",
    environment: await createSnesAssemblerEnvironment(),
    module: { id: "preview" },
  };
  const baseline = inspectSnesSourceModule(options);
  const overlays = new Map([["asset.bin", Uint8Array.of(3, 4)]]);
  const preview = inspectSnesSourceModule({ ...options, overlays });
  t.deepEqual([...preview.modules[0].sections[0].bytes], [0, 0, 0, 3, 4]);
  t.is(preview.modules[0].fixups.length, 1);
  t.not(preview.inputSha256, baseline.inputSha256);
  t.is(inspectSnesSourceModule({ ...options, overlays }).inputSha256, preview.inputSha256);
  t.not(
    inspectSnesSourceModule({ ...options, overlays, toolchainSha256: "a".repeat(64) }).inputSha256,
    preview.inputSha256,
  );
  t.not(
    inspectSnesSourceModule({ ...options, overlays, configurationSha256: "b".repeat(64) })
      .inputSha256,
    preview.inputSha256,
  );
  t.deepEqual(
    preview.inputs.map((input) => input.path),
    ["asset.bin", "main.asm"],
  );
  t.deepEqual([...fs.readFileSync(path.join(root, "asset.bin"))], [1, 2]);
  t.deepEqual(fs.readdirSync(root).toSorted(), ["asset.bin", "main.asm"]);
  t.throws(
    () =>
      inspectSnesSourceModule({
        ...options,
        overlays: new Map([["unused.asm", Uint8Array.of(1)]]),
      }),
    { message: /not consumed/ },
  );
});

test("linked source inspection resolves structured extent aliases after placement and snapshots recipe inputs", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "linked-source-inspection-"));
  t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
  const sourceFile = path.join(root, "main.asm");
  fs.writeFileSync(
    sourceFile,
    'section "Data",data\nstruct Record\n.value: dw\nendstruct\ndataStruct Record, { value = $1234 }\nEnd:\n',
  );
  const options = {
    root,
    entrySource: "main.asm",
    environment: await createSnesAssemblerEnvironment(),
    targetOptions: { checksumEnabled: false },
    expectedSize: 2,
    resolveSymbols: ["Record.value"],
    link: {
      module: { id: "placed" },
      recipe: {
        target: "snes.sfc",
        targetOptions: { mapper: "hirom" },
        checksumPolicy: "preserve" as const,
        regions: [{ name: "ROM", start: 0xc00100, size: 2, outputOffset: 0x100 }],
        placements: [{ section: "Data", load: "ROM", run: "ROM" }],
      },
    },
  };
  for (const generated of sourceLinkFiles(
    Buffer.from(JSON.stringify({ entryPoints: ["main.asm"] })),
    "placed",
    options.link.recipe,
  )) {
    fs.writeFileSync(path.join(root, generated.path), generated.bytes);
  }
  const configFile = path.join(root, "uttori-asm.config.json");
  const configuration = { entryPoints: ["main.asm"], linkProject: "build.json" };
  const link = readSourceLinkBuild(configuration, configFile, path.join(root, "main.asm"), (file) =>
    fs.readFileSync(file),
  );
  if (!link) {
    throw new Error("Expected source link selection.");
  }
  const inspected = inspectSnesSource({ ...options, link, expectedSize: 0x102 });
  t.deepEqual(inspected.diagnostics, []);
  t.is(inspected.symbols.get("Record.value"), 0xc00100);
  t.is(inspected.mapping.structFields[0].outputOffset, 0x100);
  t.deepEqual(Array.from(inspected.output.subarray(0x100)), [0x34, 0x12]);
  const recipeFile = path.join(root, "link-recipe.json");
  t.true(inspected.snapshots.has(recipeFile));
  fs.appendFileSync(recipeFile, " ");
  t.throws(() => inspectSnesSource({ ...options, link, expectedSize: 0x102 }), {
    message: /Source link input changed/,
  });
});

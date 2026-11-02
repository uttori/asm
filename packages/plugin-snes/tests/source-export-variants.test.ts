import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { Assembler, NodeAssemblySnapshotProvider } from "@uttori/asm-core";
import { encodeObject, linkObjects } from "@uttori/asm-core/linker";
import {
  RomImage,
  publishAnalysisProject,
  openAnalysisProjectStore,
  type AnalysisProject,
  type AnalysisControlFlowNodeRecord,
  type RuntimeInstructionRecord,
} from "@uttori/asm-disassembler";

import { test } from "../../../tests/ava-helper.js";
import {
  renderSourceFixture,
  verifyRenderedFixture,
} from "../../../tests/helpers/source-render-fixture.js";
import { createSnesAssemblerEnvironment } from "../src/assembler.js";
import { analyzeSnesRuntimeCode } from "../src/disassembler/runtime-code.js";
import { buildSnesSource } from "../src/disassembler/source-build.js";
import { createSnesLinkTarget } from "../src/target/link-target.js";

/** A capture supplies only the state needed to reproduce data-address-dependent symbol names. */
const capture = (
  id: string,
  bytes: readonly number[],
  state: RuntimeInstructionRecord["state"],
  address = 0x808000,
): RuntimeInstructionRecord => ({
  id,
  kind: "runtime-instruction",
  architecture: "snes.65816",
  addressSpace: "snes.cpu",
  address,
  bytes,
  state: { e: 0, p: 0x20, d: 0, db: 0xc0, ...state },
  count: 1,
  evidence: [id],
});

/** Minimal ROM-backed project. Every code node comes from the supplied captures. */
const projectFor = (
  rom: RomImage,
  runtime: readonly RuntimeInstructionRecord[],
): AnalysisProject => {
  const project: AnalysisProject = {
    manifest: {
      format: "uttori-asm-analysis",
      schemaVersion: 3,
      target: "snes.sfc",
      rom: rom.identity,
      mapping: { mapper: "lorom", source: "override", candidates: [] },
      addressSpaces: [{ id: "snes.cpu", name: "CPU", kind: "cpu", addressBits: 24 }],
    },
    shards: {
      analysis: [],
      annotations: [],
      labels: [],
      comments: [],
      regions: [],
      runtime,
      evidence: runtime.map(({ id }) => ({
        id,
        source: "runtime",
        sourceId: "fixture",
        confidence: "certain",
      })),
      imports: [],
    },
  };
  return {
    ...project,
    shards: { ...project.shards, analysis: analyzeSnesRuntimeCode(project.shards, rom, "lorom") },
  };
};

const ramMap = {
  format: "uttori-asm-snes-ram-map",
  schemaVersion: 1,
  variables: [{ name: "RAM_STATE", address: "$7E0100", size: 1, description: "Shared state." }],
};
const structMap = {
  format: "uttori-asm-snes-struct-map",
  schemaVersion: 1,
  structures: [{ id: "StateRecord", size: 1, fields: [{ name: "value", offset: 0, size: 1 }] }],
  bindings: [{ name: "State", structure: "StateRecord", address: 0x7e0100, count: 1 }],
};

test("relocatable export produces module source, a bank recipe and byte-identical literal payloads", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-module-render-"));
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  const original = new Uint8Array(0x10000).fill(0xea);
  const rom = new RomImage(original, { headerSize: 0 });
  const project = projectFor(rom, [capture("observed", [0xea], {})]);
  const manifest = renderSourceFixture(project, rom, directory, {
    sourceProjectSha256: "1".repeat(64),
    module: { id: "exported-rom" },
  });
  t.is(manifest.relocatable?.moduleId, "exported-rom");
  t.deepEqual(
    manifest.relocatable?.linkRecipe.placements.map((placement) => placement.section),
    ["rom_bank_000", "rom_bank_001"],
  );
  t.notRegex(fs.readFileSync(path.join(directory, "banks/bank-000.asm"), "utf8"), /^org /m);
  const assembler = new Assembler({
    environment: await createSnesAssemblerEnvironment(),
    target: "snes.sfc",
    module: { id: "exported-rom" },
    fileProvider: new NodeAssemblySnapshotProvider(),
    targetOptions: { checksumEnabled: false },
  });
  try {
    assembler.setIncludePaths([directory]);
    const entry = path.join(directory, "main.asm");
    assembler.assembleSource(fs.readFileSync(entry, "utf8"), entry);
    const module = assembler.getAssemblyModule();
    t.is(module.fixups.length, 0);
    const bytes = Uint8Array.from(module.sections.flatMap((section) => [...section.bytes]));
    t.deepEqual(bytes, original);
    t.true(module.assets.length > 0);
    t.true(module.dependencies.every((dependency) => /^[\da-f]{64}$/.test(dependency.sha256)));
    t.deepEqual(
      JSON.parse(fs.readFileSync(path.join(directory, "link-recipe.json"), "utf8")),
      manifest.relocatable?.linkRecipe,
    );
  } finally {
    assembler.dispose();
  }
});

for (const headerSize of [0, 512] as const) {
  test(`serialized exported modules link in a fresh process to an identical complete ROM (${headerSize}-byte container header)`, async (t) => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-object-rom-"));
    t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
    const sourceDirectory = path.join(directory, "source");
    const original = new Uint8Array(0x10000 + headerSize).fill(0xea);
    for (let i = 0; i < headerSize; i++) {
      original[i] = i & 255;
    }
    original.set([0x20, 0x10, 0x80], headerSize);
    original[headerSize + 0x10] = 0x60;
    const rom = new RomImage(original, { headerSize });
    const project = projectFor(rom, [
      capture("call", [0x20, 0x10, 0x80], {}),
      capture("return", [0x60], {}, 0x808010),
    ]);
    const manifest = renderSourceFixture(project, rom, sourceDirectory, {
      sourceProjectSha256: "1".repeat(64),
      module: { id: "pristine" },
    });
    const recipe = manifest.relocatable!.linkRecipe;
    const assembler = new Assembler({
      environment: await createSnesAssemblerEnvironment(),
      target: "snes.sfc",
      module: { id: "pristine" },
      targetOptions: { checksumEnabled: false },
    });
    try {
      assembler.setIncludePaths([sourceDirectory]);
      const entry = path.join(sourceDirectory, "main.asm");
      assembler.assembleSource(fs.readFileSync(entry, "utf8"), entry);
      const module = assembler.getAssemblyModule();
      t.true(module.fixups.length > 0, "exported symbolic call must be resolved by the linker");
      const object = encodeObject(module);
      const linked = linkObjects({ objects: [object], recipe, target: createSnesLinkTarget() });
      t.deepEqual(linked.output, original);
      fs.writeFileSync(path.join(directory, "main.uobj"), object);
      fs.writeFileSync(
        path.join(directory, "link-input.json"),
        JSON.stringify({ objects: ["main.uobj"], libraries: [], recipe }),
      );
    } finally {
      assembler.dispose();
    }
    const buildOptions = {
      root: sourceDirectory,
      entrySource: "main.asm",
      environment: await createSnesAssemblerEnvironment(),
      targetOptions: { checksumEnabled: false },
      link: { module: { id: "pristine" }, recipe },
      expectedSize: rom.length,
      originalContent: rom.read(0, rom.length)!,
      originalContainer: original,
      outputDirectory: path.join(directory, "source-build"),
      toolchainSha256: "a".repeat(64),
      configurationSha256: "b".repeat(64),
    };
    const build = buildSnesSource(buildOptions);
    t.deepEqual(fs.readFileSync(build.outputFile), Buffer.from(original));
    const debug = JSON.parse(fs.readFileSync(build.debugMapFile, "utf8"));
    t.is(debug.instructions[0].outputOffset, headerSize);
    if (headerSize) {
      const changed = structuredClone(recipe);
      const prefix = changed.regions.find((region) => region.initialBytes);
      if (!prefix?.initialBytes) {
        throw new Error("Missing copied container header.");
      }
      const initialBytes = Array.from(prefix.initialBytes);
      initialBytes[0] ^= 1;
      const modified = {
        ...changed,
        regions: changed.regions.map((region) =>
          region === prefix ? Object.assign({}, region, { initialBytes }) : region,
        ),
      };
      const pointer = fs.readFileSync(path.join(buildOptions.outputDirectory, "current.json"));
      t.throws(
        () =>
          buildSnesSource({
            ...buildOptions,
            link: { module: { id: "pristine" }, recipe: modified },
          }),
        { message: /complete original container/ },
      );
      t.deepEqual(
        fs.readFileSync(path.join(buildOptions.outputDirectory, "current.json")),
        pointer,
      );
    }
    // Source and raw asset inputs are absent in the new process; only serialized objects remain.
    fs.rmSync(sourceDirectory, { recursive: true, force: true });
    const args = [
      "--conditions=uttori-source",
      "--import=tsx",
      path.resolve("packages/plugin-snes/tests/fixtures/link-objects.mjs"),
      directory,
    ];
    const first = spawnSync(process.execPath, args, { encoding: "utf8", timeout: 30000 });
    t.is(first.status, 0, first.stderr);
    const receipt = JSON.parse(first.stdout);
    t.deepEqual(fs.readFileSync(receipt.outputFile), Buffer.from(original));
    const second = spawnSync(process.execPath, args, { encoding: "utf8", timeout: 30000 });
    t.is(second.status, 0, second.stderr);
    t.is(
      second.stdout,
      first.stdout,
      "repeated clean links select the same immutable artifact identity",
    );
    const map = JSON.parse(fs.readFileSync(receipt.debugMapFile, "utf8"));
    t.true(map.instructions.length > 0);
  });
}

test("immutable rendering reads recipes without publishing ownership or touching edited source", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-pure-render-"));
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.writeFileSync(path.join(directory, "ram-map.json"), JSON.stringify(ramMap));
  fs.writeFileSync(path.join(directory, "main.asm"), "; Uncommitted user work\n");
  fs.writeFileSync(path.join(directory, "generated-files.json"), "old manifest must not be read");
  const names = fs.readdirSync(directory).toSorted();
  const original = new Uint8Array(0x8000).fill(0xea);
  const rom = new RomImage(original, { headerSize: 0 });
  const project = projectFor(rom, [capture("observed", [0xea], {})]);
  const rendered = new Map<string, Uint8Array>();
  renderSourceFixture(
    { manifest: { ...project.manifest }, shards: project.shards },
    rom,
    directory,
    {
      sourceProjectSha256: "1".repeat(64),
      emitFile: (file) => rendered.set(file.path, file.bytes),
    },
  );
  t.deepEqual(fs.readdirSync(directory).toSorted(), names);
  t.is(fs.readFileSync(path.join(directory, "main.asm"), "utf8"), "; Uncommitted user work\n");
  t.false(rendered.has("source-ownership.json"));
  t.false(rendered.has("generated-files.json"));
  t.true(rendered.has("banks/bank-000.asm"));
  t.true(
    Buffer.from(rendered.get("main.asm")!).toString().includes("Edit and commit source normally"),
  );
});

test("newly observed calls use the persistent preferred name at the original symbol identity", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-regeneration-rename-"));
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.writeFileSync(path.join(directory, "ram-map.json"), JSON.stringify(ramMap));
  const bytes = new Uint8Array(0x8000).fill(0xea);
  bytes.set([0x20, 0x10, 0x80], 0);
  bytes.set([0x20, 0x10, 0x80], 8);
  const rom = new RomImage(bytes, { headerSize: 0 });
  const project = projectFor(rom, [
    capture("call-one", [0x20, 0x10, 0x80], {}),
    capture("call-two", [0x20, 0x10, 0x80], {}, 0x808008),
    capture("entry", [0xea], {}, 0x808010),
  ]);
  const rendered = new Map<string, Uint8Array>();
  renderSourceFixture(
    {
      manifest: { ...project.manifest },
      shards: {
        ...project.shards,
        labels: [
          {
            id: "symbol:snes.cpu:808010",
            addressSpace: "snes.cpu",
            address: 0x808010,
            name: "RandomByte",
            sourceName: "RandomByte",
            aliases: ["Fn_808010"],
            analysisEntryPoint: false,
            evidence: ["entry"],
          },
        ],
      },
    },
    rom,
    directory,
    {
      sourceProjectSha256: "2".repeat(64),
      emitFile: (file) => rendered.set(file.path, file.bytes),
    },
  );
  const bank = Buffer.from(rendered.get("banks/bank-000.asm")!).toString();
  // A near call keeps the label's bus bank out of its encoded 16-bit operand.
  t.is((bank.match(/JSR\.w \(RandomByte & \$F{4}\)/g) ?? []).length, 2);
  t.true(bank.includes("RandomByte:"));
  t.false(bank.includes("Fn_808010"));
});

for (const scenario of [
  {
    name: "struct",
    bytes: [0xb9, 0x00, 0x01],
    state: { db: 0x7e },
    file: "struct-map.json",
    map: structMap,
    numeric: "LDA.w $0100,y",
    symbolic: "State.value",
  },
  {
    name: "RAM",
    bytes: [0xb9, 0x00, 0x01],
    state: { db: 0x7e },
    file: "ram-map.json",
    map: ramMap,
    numeric: "LDA.w $0100,y",
    symbolic: "RAM_STATE",
  },
  {
    name: "hardware",
    bytes: [0xad, 0x00, 0x21],
    state: { db: 0 },
    file: "ram-map.json",
    map: ramMap,
    numeric: "LDA.w $2100",
    symbolic: "INIDISP",
  },
  {
    name: "direct page",
    bytes: [0xa5, 0x00],
    state: { d: 0x100 },
    file: "ram-map.json",
    map: ramMap,
    numeric: "LDA.b $00",
    symbolic: "RAM_STATE",
  },
]) {
  test(`unknown static state cannot erase consistent ${scenario.name} names after reanalysis`, async (t) => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-export-reanalysis-"));
    t.teardown(() => fs.rmSync(workspace, { recursive: true, force: true }));
    const directory = path.join(workspace, "source");
    fs.mkdirSync(directory);
    fs.writeFileSync(path.join(directory, scenario.file), JSON.stringify(scenario.map));
    const bytes = new Uint8Array(0x8000).fill(0xea);
    bytes.set(scenario.bytes);
    const rom = new RomImage(bytes, { headerSize: 0 });
    const romFile = path.join(workspace, "rom.sfc");
    fs.writeFileSync(romFile, bytes);
    const baseline = projectFor(rom, [capture("observed", scenario.bytes, scenario.state)]);
    const observed = baseline.shards.analysis.find(
      (record): record is AnalysisControlFlowNodeRecord => record.kind === "cfg-node",
    )!;
    // Static seeds inherit provenance but cannot reconstruct the calling bank or direct page.
    const unknown: AnalysisControlFlowNodeRecord = {
      ...observed,
      id: "static:cfg:808000",
      incomingState: {
        ...observed.incomingState,
        dbr: { kind: "unknown" },
        d: { kind: "unknown" },
      },
    };
    const project: AnalysisProject = {
      ...baseline,
      shards: {
        ...baseline.shards,
        analysis: [unknown, observed],
        labels: [
          {
            id: "reviewed-entry",
            addressSpace: "snes.cpu",
            address: 0x808000,
            name: "ReviewedEntry",
            sourceName: "ReviewedEntry",
            evidence: ["observed"],
          },
        ],
      },
    };
    const options = { sourceProjectSha256: "b".repeat(64) };
    const exported = renderSourceFixture(project, rom, directory, options);
    const bank = path.join(directory, "banks/bank-000.asm");
    t.true(fs.readFileSync(bank, "utf8").includes(scenario.symbolic));
    t.true(
      fs.readFileSync(bank, "utf8").includes("ReviewedEntry:"),
      "native labels survive removal of generated function records",
    );
    t.is(
      exported.spans.find((span) => span.start === 0)?.nodeIds?.length,
      2,
      "unresolved static provenance remains in the export",
    );
    t.true(
      (
        await verifyRenderedFixture({
          sourceDirectory: directory,
          romFile,
          emitDebugMap: false,
        })
      ).comparison.equal,
    );

    const reordered = { ...project, shards: { ...project.shards, analysis: [observed, unknown] } };
    t.deepEqual(renderSourceFixture(reordered, rom, directory, options), exported);
    const analysisDirectory = path.join(workspace, "analysis");
    publishAnalysisProject(analysisDirectory, project);
    const store = openAnalysisProjectStore(analysisDirectory);
    try {
      store.prepareAnnotationQueries();
      const streamed = store.transaction(
        () =>
          renderSourceFixture(store.sourceExportView(), rom, directory, {
            ...options,
            instructionGroups: store.instructionExportGroups(),
          }),
        false,
      );
      t.deepEqual(
        streamed,
        exported,
        "persisted native labels and runtime symbols survive a fresh SQL export",
      );
    } finally {
      store.close();
    }

    // A known contradictory static address is still evidence against the captured name.
    const conflictingProject = projectFor(rom, [capture("conflicting", scenario.bytes, {})]);
    const conflicting = conflictingProject.shards.analysis.find(
      (record): record is AnalysisControlFlowNodeRecord => record.kind === "cfg-node",
    )!;
    renderSourceFixture(
      {
        ...project,
        shards: {
          ...project.shards,
          analysis: [observed, { ...conflicting, id: "static:cfg:conflicting" }],
        },
      },
      rom,
      directory,
      options,
    );
    t.true(fs.readFileSync(bank, "utf8").includes(scenario.numeric));

    // An unresolved runtime observation is different from an unresolved static guess.
    renderSourceFixture(
      {
        ...project,
        shards: {
          ...project.shards,
          analysis: [observed, { ...unknown, id: "runtime:code:unknown" }],
        },
      },
      rom,
      directory,
      options,
    );
    t.true(fs.readFileSync(bank, "utf8").includes(scenario.numeric));

    // An uncaptured branch can have a justified static mapping beside a seed with no DBR/DP.
    // Naming that encoding must preserve both static identities without claiming an observation.
    const knownStatic = { ...observed, id: "static:cfg:known" };
    const staticOnly: AnalysisProject = {
      ...project,
      shards: { ...project.shards, runtime: [], analysis: [knownStatic, unknown] },
    };
    const inferred = renderSourceFixture(staticOnly, rom, directory, options);
    t.true(fs.readFileSync(bank, "utf8").includes(scenario.symbolic));
    t.deepEqual(
      inferred.spans.find((span) => span.start === 0)?.nodeIds?.toSorted(),
      [knownStatic.id, unknown.id].toSorted(),
    );
    t.deepEqual(
      renderSourceFixture(
        { ...staticOnly, shards: { ...staticOnly.shards, analysis: [unknown, knownStatic] } },
        rom,
        directory,
        options,
      ),
      inferred,
    );
    t.true(
      (await verifyRenderedFixture({ sourceDirectory: directory, romFile, emitDebugMap: false }))
        .comparison.equal,
    );

    const staticDirectory = path.join(workspace, "static-analysis");
    publishAnalysisProject(staticDirectory, staticOnly);
    const staticStore = openAnalysisProjectStore(staticDirectory);
    try {
      staticStore.prepareAnnotationQueries();
      const streamed = staticStore.transaction(
        () =>
          renderSourceFixture(staticStore.sourceExportView(), rom, directory, {
            ...options,
            instructionGroups: staticStore.instructionExportGroups(),
          }),
        false,
      );
      t.deepEqual(
        streamed,
        inferred,
        "SQL export preserves inferred names without a captured CFG node",
      );
      t.true(fs.readFileSync(bank, "utf8").includes(scenario.symbolic));
    } finally {
      staticStore.close();
    }

    // Unknown state contributes no conflicting address, but a second known mapping still does.
    renderSourceFixture(
      {
        ...staticOnly,
        shards: {
          ...staticOnly.shards,
          analysis: [
            knownStatic,
            { ...conflicting, id: "static:cfg:conflicting", evidence: observed.evidence },
            unknown,
          ],
        },
      },
      rom,
      directory,
      options,
    );
    t.true(fs.readFileSync(bank, "utf8").includes(scenario.numeric));
    renderSourceFixture(
      { ...staticOnly, shards: { ...staticOnly.shards, analysis: [unknown] } },
      rom,
      directory,
      options,
    );
    t.true(
      fs.readFileSync(bank, "utf8").includes(scenario.numeric),
      "unknown-only state cannot invent a name",
    );
  });

  test(`export retains code and new gains when ${scenario.name} symbols vary across captures`, async (t) => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-export-variants-"));
    t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
    const sourceDirectory = path.join(directory, "source");
    fs.mkdirSync(sourceDirectory);
    fs.writeFileSync(path.join(sourceDirectory, scenario.file), JSON.stringify(scenario.map));
    const bytes = new Uint8Array(0x8000).fill(0xea);
    bytes.set(scenario.bytes);
    const rom = new RomImage(bytes, { headerSize: 0 });
    const romFile = path.join(directory, "rom.sfc");
    fs.writeFileSync(romFile, bytes);
    const options = { sourceProjectSha256: "a".repeat(64) };
    const baseline = capture("old", scenario.bytes, scenario.state);
    renderSourceFixture(projectFor(rom, [baseline]), rom, sourceDirectory, options);
    const bank = path.join(sourceDirectory, "banks/bank-000.asm");
    t.true(fs.readFileSync(bank, "utf8").includes(scenario.symbolic));

    const project = projectFor(rom, [
      baseline,
      capture("new-state", scenario.bytes, {}),
      capture("new-code", [0xea], {}, 0x808010),
    ]);
    const exported = renderSourceFixture(project, rom, sourceDirectory, options);
    const preserved = exported.spans.find((span) => span.start === 0);
    t.is(preserved?.role, "code");
    t.is(preserved?.end, scenario.bytes.length);
    t.is(preserved?.nodeIds?.length, 2, "both captured states retain their provenance");
    t.is(exported.spans.find((span) => span.start === 0x10)?.role, "code");
    t.true(fs.readFileSync(bank, "utf8").includes(scenario.numeric));
    t.true(
      (await verifyRenderedFixture({ sourceDirectory, romFile, emitDebugMap: false })).comparison
        .equal,
    );

    const reordered = {
      ...project,
      shards: { ...project.shards, analysis: [...project.shards.analysis].toReversed() },
    };
    t.deepEqual(renderSourceFixture(reordered, rom, sourceDirectory, options), exported);
    const analysisDirectory = path.join(directory, "analysis");
    const evidence = [...new Set(project.shards.runtime.flatMap((record) => record.evidence))].map(
      (id) => ({
        id,
        source: "runtime" as const,
        sourceId: "fixture",
        confidence: "certain" as const,
      }),
    );
    publishAnalysisProject(analysisDirectory, {
      ...project,
      shards: { ...project.shards, evidence },
    });
    const store = openAnalysisProjectStore(analysisDirectory);
    try {
      store.prepareAnnotationQueries();
      const streamed = store.transaction(
        () =>
          renderSourceFixture(store.sourceExportView(), rom, sourceDirectory, {
            ...options,
            instructionGroups: store.instructionExportGroups(),
          }),
        false,
      );
      t.deepEqual(
        streamed,
        exported,
        "SQL streaming preserves every byte, variant, span and generated file hash",
      );
    } finally {
      store.close();
    }
  });
}

test("pure rendering excludes incompatible instruction widths after a new capture", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-export-widths-"));
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  const bytes = new Uint8Array(0x8000).fill(0xea);
  bytes.set([0xa9, 0x01, 0x02]);
  const rom = new RomImage(bytes, { headerSize: 0 });
  const baseline = capture("eight-bit", [0xa9, 0x01], { p: 0x20 });
  const options = { sourceProjectSha256: "a".repeat(64) };
  renderSourceFixture(projectFor(rom, [baseline]), rom, directory, options);
  const candidate = projectFor(rom, [
    baseline,
    capture("sixteen-bit", [0xa9, 0x01, 0x02], { p: 0 }),
  ]);
  const rendered = renderSourceFixture(candidate, rom, directory, options);
  t.false(rendered.spans.some((span) => span.start === 0 && span.role === "code"));
});

test("explicit instruction widths round trip and ignore unrelated captured M/X changes", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-export-explicit-widths-"));
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  const sourceDirectory = path.join(directory, "source");
  const bytes = new Uint8Array(0x8000).fill(0xea);
  const instructions = [
    { bytes: [0xc2, 0x30], p: 0x30 }, // REP changes ambient width before an explicitly short immediate.
    { bytes: [0xa9, 0x12], p: 0x20 },
    { bytes: [0xa2, 0x34, 0x12], p: 0x20 },
    { bytes: [0xe2, 0x30], p: 0 }, // SEP must not shorten the following explicit word operands.
    { bytes: [0xa0, 0x78, 0x56], p: 0 },
    { bytes: [0xa9, 0xbc, 0x9a], p: 0 },
    { bytes: [0xea], p: 0x30 },
    { bytes: [0x60], p: 0x30 },
  ];
  let offset = 0;
  const runtime = instructions.map((instruction, index) => {
    bytes.set(instruction.bytes, offset);
    const record = capture(
      `instruction-${index}`,
      instruction.bytes,
      { p: instruction.p },
      0x808000 + offset,
    );
    offset += instruction.bytes.length;
    return record;
  });
  const rom = new RomImage(bytes, { headerSize: 0 });
  const romFile = path.join(directory, "rom.sfc");
  fs.writeFileSync(romFile, bytes);
  const options = { sourceProjectSha256: "a".repeat(64) };
  const first = renderSourceFixture(projectFor(rom, runtime), rom, sourceDirectory, options);
  const bank = path.join(sourceDirectory, "banks/bank-000.asm");
  const text = fs.readFileSync(bank, "utf8");
  t.notRegex(text, /^\.[ai](?:8|16)\b/m);
  for (const source of ["LDA.b #$12", "LDX.w #$1234", "LDY.w #$5678", "LDA.w #$9ABC"]) {
    t.true(text.includes(source), source);
  }
  t.true(
    (await verifyRenderedFixture({ sourceDirectory, romFile, emitDebugMap: false })).comparison
      .equal,
  );
  const changed = runtime.map((record) =>
    record.bytes.length === 1
      ? Object.assign({}, record, { state: Object.assign({}, record.state, { p: 0 }) })
      : record,
  );
  const second = renderSourceFixture(projectFor(rom, changed), rom, sourceDirectory, options);
  t.is(
    fs.readFileSync(bank, "utf8"),
    text,
    "non-width-sensitive instructions do not rewrite source when captured flags change",
  );
  t.deepEqual(second.files, first.files);
  t.true(
    (await verifyRenderedFixture({ sourceDirectory, romFile, emitDebugMap: false })).comparison
      .equal,
  );
});

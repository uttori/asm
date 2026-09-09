import { test } from "../../../tests/ava-helper.js";
import {
  AnalysisSourceIndex,
  buildAnalysisSourceCatalog,
  RomImage,
  ANALYSIS_PROJECT_FORMAT,
  ANALYSIS_PROJECT_SCHEMA_VERSION,
  type AnalysisProject,
  type AnalysisControlFlowNodeRecord,
  type RuntimeExecutionRecord,
  type RuntimeInstructionRecord,
  type RuntimeMemoryAccessRecord,
} from "../src/index.js";

const fixture = (): AnalysisProject => ({
  manifest: {
    format: ANALYSIS_PROJECT_FORMAT,
    schemaVersion: ANALYSIS_PROJECT_SCHEMA_VERSION,
    target: "fixture",
    rom: new RomImage(new Uint8Array(1024), { headerSize: 0 }).identity,
    mapping: { mapper: "fixture", source: "override", candidates: [] },
    addressSpaces: [
      { id: "cpu", name: "CPU", kind: "cpu", addressBits: 24 },
      { id: "ram", name: "RAM", kind: "ram", addressBits: 16 },
      { id: "rom.file", name: "ROM", kind: "file", addressBits: 24 },
    ],
  },
  shards: {
    analysis: [],
    annotations: [],
    labels: [],
    comments: [],
    regions: [],
    runtime: [],
    evidence: ["a", "b", "c"].map((id) => ({
      id,
      source: "runtime",
      sourceId: "same-emulator",
      confidence: "certain",
      artifact: {
        format: "trace",
        sha256: id.repeat(64),
        romContentSha256: new RomImage(new Uint8Array(1024), { headerSize: 0 }).identity
          .contentSha256,
      },
    })),
    imports: ["a", "b", "c"].map((id) => ({
      id: `import:${id}`,
      format: "trace",
      sourceName: id === "a" ? "chest.json" : "idle.json",
      sourceSha256: id.repeat(64),
      imported: { instructions: 1 },
      warnings: id === "a" ? ["12 instruction events dropped"] : [],
      unsupported: [],
    })),
  },
});
const execution = (
  source: string,
  address: number,
  size?: number,
  addressSpace = "cpu",
  architecture = "fixture",
): RuntimeExecutionRecord => ({
  id: `${source}:${addressSpace}:${architecture}:${address}`,
  kind: "runtime-execution",
  architecture,
  addressSpace,
  address,
  count: 100,
  evidence: [source],
  ...(size ? { size } : {}),
});
const instruction = (
  source: string,
  address: number,
  bytes: number[],
  state = {},
): RuntimeInstructionRecord => ({
  id: `detail:${source}:${address}:${JSON.stringify(state)}`,
  kind: "runtime-instruction",
  architecture: "fixture",
  addressSpace: "cpu",
  address,
  bytes,
  state,
  count: 20,
  evidence: [source],
});
const node = (
  id: string,
  address: number,
  size: number,
  evidencePath: string[] = [id],
): AnalysisControlFlowNodeRecord => ({
  id,
  kind: "cfg-node",
  addressSpace: "cpu",
  address,
  fileOffset: address,
  size,
  opcode: 0xea,
  specificationId: "fixture.nop",
  mnemonic: "NOP",
  mode: "implied",
  context: [],
  incomingState: {},
  outgoingState: {},
  effectiveAddresses: [],
  entryPoint: "fixture",
  evidencePath,
  evidence: ["a"],
});
const sourceId = (index: AnalysisSourceIndex, evidence: string): string =>
  index.sources.find((source) => source.evidenceIds.includes(evidence))!.id;

test("source identity uses artifact hashes, supports legacy imports, and preserves empty imports", (t) => {
  const { shards } = fixture();
  const imports = [
    ...shards.imports,
    {
      id: "legacy",
      format: "diz",
      sourceName: "game.diz",
      sourceSha256: "d".repeat(64),
      imported: {},
      warnings: [],
      unsupported: [],
    },
    {
      id: "empty",
      format: "trace",
      sourceName: "empty.json",
      sourceSha256: "e".repeat(64),
      imported: {},
      warnings: [],
      unsupported: [],
    },
  ];
  const evidence = [
    ...shards.evidence,
    {
      id: "legacy",
      source: "import" as const,
      sourceId: "d".repeat(64),
      confidence: "certain" as const,
    },
    { id: "manual", source: "manual" as const, sourceId: "editor", confidence: "certain" as const },
  ];
  const catalog = buildAnalysisSourceCatalog({ imports, evidence });
  t.is(catalog.length, 6);
  t.is(
    catalog.filter((source) => source.name === "idle.json").length,
    2,
    "same filename and producer do not merge different captures",
  );
  t.deepEqual(catalog.find((source) => source.name === "game.diz")?.evidenceIds, ["legacy"]);
  t.deepEqual(catalog.find((source) => source.name === "empty.json")?.evidenceIds, []);
  t.deepEqual(
    buildAnalysisSourceCatalog({ imports: imports.toReversed(), evidence: evidence.toReversed() }),
    catalog,
  );
});

test("capture comparison subtracts direct PCs, deduplicates variants, and ignores propagated static provenance", (t) => {
  const project = fixture();
  const index = new AnalysisSourceIndex(project.manifest, {
    ...project.shards,
    runtime: [
      execution("a", 0),
      execution("a", 2, 2),
      execution("b", 0),
      execution("c", 2),
      instruction("a", 2, [0xa9, 1]),
      instruction("a", 2, [0xa9, 2], { a: 2 }),
    ],
    analysis: [node("static-only", 50, 1)],
  });
  const a = sourceId(index, "a"),
    b = sourceId(index, "b");
  t.is(index.compare(a).uniqueInstructionCount, 0, "later capture can subsume chest code");
  const comparison = index.compare(a, [b]);
  t.is(comparison.instructionCount, 2);
  t.is(comparison.uniqueInstructionCount, 1);
  t.is(comparison.knownCodeBytes, 2);
  t.true(comparison.notes.some((note) => note.includes("12 instruction events dropped")));
  const page = index.page(a, "uniqueInstructions", 0, [b]);
  t.is(page[0].address, 2);
  t.regex(page[0].detail, /multiple variants/);
  t.is(index.compare(a, []).uniqueInstructionCount, 2);
  t.throws(() => index.compare(a, [a]), { message: /Invalid/ });
  t.throws(() => index.compare("missing"), { message: /no longer exists/ });
});

test("byte extents use selected-source bytes or agreed analysis sizes and preserve address identities", (t) => {
  const project = fixture();
  const index = new AnalysisSourceIndex(project.manifest, {
    ...project.shards,
    runtime: [
      execution("a", 0),
      instruction("b", 0, [0xa9, 0xff]),
      execution("a", 2, 2),
      execution("a", 3, 2),
      execution("a", 9),
      execution("a", 10),
      execution("a", 2, 1, "ram"),
      execution("a", 2, 1, "cpu", "second"),
      execution("a", 1023, 2, "rom.file"),
    ],
    analysis: [node("agreed", 0, 2), node("ambiguous1", 9, 2), node("ambiguous2", 9, 3)],
  });
  const a = sourceId(index, "a");
  const result = index.compare(a, []);
  t.is(
    result.knownCodeBytes,
    7,
    "0–5 CPU plus distinct RAM and architecture byte; out-of-file range excluded",
  );
  t.is(result.unknownSizeInstructions, 3);
  t.is(result.codeRangeCount, 3);
  const first = index.page(a, "uniqueInstructions", 0, []).find((entry) => entry.address === 0)!;
  t.regex(first.description, /2 byte\(s\) \(analysis\)/);
  t.regex(first.detail, /No execution-time bytes were saved/);
  t.false(
    first.detail.includes("A9 FF"),
    "another capture cannot supply the selected source's bytes",
  );
});

test("aggregate execution coverage suppresses only matching architecture and space", (t) => {
  const project = fixture();
  const index = new AnalysisSourceIndex(project.manifest, {
    ...project.shards,
    runtime: [
      execution("a", 2, 1),
      execution("a", 3, 1),
      execution("a", 2, 1, "ram"),
      {
        id: "coverage",
        kind: "runtime-coverage",
        architecture: "fixture",
        addressSpace: "cpu",
        start: 2,
        end: 3,
        coverage: "executed",
        count: 1,
        evidence: ["b"],
      },
      {
        id: "read",
        kind: "runtime-coverage",
        architecture: "fixture",
        addressSpace: "cpu",
        start: 3,
        end: 4,
        coverage: "read",
        count: 1,
        evidence: ["b"],
      },
    ],
  });
  const a = sourceId(index, "a");
  t.is(index.compare(a).sharedInstructionCount, 1);
  t.deepEqual(
    index.page(a, "uniqueInstructions").map((entry) => [entry.addressSpace, entry.address]),
    [
      ["cpu", 3],
      ["ram", 2],
    ],
  );
});

test("unique instructions can belong to shared functions; missing and ambiguous owners remain explicit", (t) => {
  const project = fixture();
  const fn = (id: string, address: number) => ({
    id,
    kind: "function" as const,
    addressSpace: "cpu",
    address,
    source: "entry" as const,
    evidencePath: [],
    evidence: ["a"],
  });
  const index = new AnalysisSourceIndex(project.manifest, {
    ...project.shards,
    runtime: [
      execution("a", 0, 1),
      execution("b", 0, 1),
      execution("a", 1, 1),
      execution("a", 2, 1),
      execution("a", 3, 1),
    ],
    analysis: [
      node("root", 0, 1),
      node("other", 8, 1),
      node("branch", 1, 1, ["root", "branch"]),
      node("amb1", 2, 1, ["root", "amb1"]),
      node("amb2", 2, 1, ["other", "amb2"]),
      fn("fn", 0),
      fn("otherfn", 8),
    ],
    labels: [
      {
        id: "label",
        name: "ChestBranch",
        sourceName: "ChestBranch",
        addressSpace: "cpu",
        address: 0,
        evidence: ["a"],
      },
    ],
  });
  const a = sourceId(index, "a");
  t.is(index.compare(a).functionCount, 1);
  t.is(index.compare(a).unownedInstructions, 1);
  t.is(index.compare(a).ambiguousInstructions, 1);
  t.is(index.page(a, "functions")[0].label, "ChestBranch");
  t.regex(index.page(a, "functions")[0].description, /1 unique/);
  t.is(index.page(a, "contributions")[0].label, "ChestBranch");
});

test("memory comparison ignores changing values but keeps actor, access, channel and target distinct", (t) => {
  const project = fixture();
  const memory = (
    id: string,
    source: string,
    changes: Partial<RuntimeMemoryAccessRecord> = {},
  ): RuntimeMemoryAccessRecord => ({
    id,
    kind: "runtime-memory-access",
    architecture: "fixture",
    instructionAddressSpace: "cpu",
    instructionAddress: 4,
    accessedAddressSpace: "ram",
    accessedAddress: 10,
    access: "write",
    width: 1,
    actor: "cpu",
    count: 1,
    value: 1,
    evidence: [source],
    ...changes,
  });
  const index = new AnalysisSourceIndex(project.manifest, {
    ...project.shards,
    runtime: [
      memory("a1", "a"),
      memory("a2", "a", { value: 2 }),
      memory("b1", "b", { value: 8 }),
      memory("a3", "a", { accessedAddress: 11 }),
      memory("a4", "a", { actor: "dma", channel: 0 }),
      memory("a5", "a", { actor: "dma", channel: 1 }),
    ],
  });
  t.is(index.compare(sourceId(index, "a")).uniqueMemoryCount, 3);
  t.is(index.page(sourceId(index, "a"), "memory").length, 3);
});

test("source pages remain bounded and exclude static-only attribution from execution", (t) => {
  const project = fixture();
  const index = new AnalysisSourceIndex(project.manifest, {
    ...project.shards,
    runtime: Array.from({ length: 450 }, (_, address) => execution("a", address, 1)),
    annotations: [
      {
        id: "static",
        addressSpace: "cpu",
        start: 600,
        end: 900,
        architecture: "fixture",
        classification: "opcode",
        evidence: ["b"],
      },
    ],
    comments: [
      { id: "comment", addressSpace: "cpu", address: 0, text: "Open chest", evidence: ["a"] },
    ],
  });
  const a = sourceId(index, "a");
  t.is(index.page(a, "uniqueInstructions").length, 200);
  t.is(index.page(a, "uniqueInstructions", 400).length, 50);
  t.is(index.page(a, "uniqueInstructions", 200)[0].address, 200);
  t.is(index.compare(sourceId(index, "b")).instructionCount, 0);
  t.is(index.compare(sourceId(index, "b")).contributionCount, 1);
  t.throws(() => index.page(a, "uniqueInstructions", -1), { message: /offset/ });
});

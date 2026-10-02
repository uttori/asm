import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { constants, type StatementSync } from "node:sqlite";

import { test } from "../../../../tests/ava-helper.js";
import {
  RomImage,
  publishAnalysisProject,
  openAnalysisProjectStore,
  buildInstructionAnalysisAnnotations,
  buildRomCoverageMap,
  type AnalysisProject,
  type AnalysisControlFlowNodeRecord,
  type RuntimeEvidenceRecord,
} from "../../src/index.js";
import { validateAnalysisOwnership } from "../../src/model/analysis-ownership.js";
import {
  readSqliteAnnotationView,
  readInstructionExecutionSummary,
} from "../../src/storage/sqlite-annotation-query.js";
import { DatabaseSync } from "../helpers/sqlite-connection.js";

const node = (id: string, address: number, fileOffset: number): AnalysisControlFlowNodeRecord => ({
  id,
  kind: "cfg-node",
  addressSpace: "cpu",
  address,
  fileOffset,
  size: 1,
  opcode: 0xea,
  specificationId: "fixture.nop",
  mnemonic: "NOP",
  mode: "implied",
  context: [],
  incomingState: { m: 0 },
  outgoingState: { m: 1 },
  effectiveAddresses: [],
  entryPoint: "entry",
  evidencePath: [],
  evidence: [],
});
const project = (): AnalysisProject => ({
  manifest: {
    format: "uttori-asm-analysis",
    schemaVersion: 3,
    target: "fixture",
    rom: new RomImage(new Uint8Array(0x8000)).identity,
    mapping: { mapper: "fixture", source: "override", candidates: [] },
    addressSpaces: [
      { id: "cpu", name: "CPU", kind: "cpu", addressBits: 24 },
      { id: "file", name: "File", kind: "file", addressBits: 24 },
    ],
  },
  shards: {
    analysis: [node("node", 0x100, 0), node("alias", 0x200, 0), node("unrelated", 0x900, 900)],
    annotations: [
      {
        id: "opcode",
        addressSpace: "file",
        start: 0,
        end: 1,
        classification: "opcode",
        architecture: "fixture.cpu",
        state: { m: true },
        evidence: [],
      },
    ],
    labels: [],
    comments: [
      { id: "comment", addressSpace: "cpu", address: 0x100, text: "Visible", evidence: [] },
    ],
    regions: [],
    imports: [],
    evidence: [],
    runtime: [
      {
        id: "execution",
        kind: "runtime-execution",
        architecture: "fixture.cpu",
        addressSpace: "cpu",
        address: 0x100,
        fileOffset: 0,
        count: 12,
        evidence: [],
      },
      {
        id: "state",
        kind: "runtime-cpu-state",
        architecture: "fixture.cpu",
        addressSpace: "cpu",
        address: 0x100,
        state: { p: 0x30 },
        count: 12,
        evidence: [],
      },
      {
        id: "memory",
        kind: "runtime-memory-access",
        architecture: "fixture.cpu",
        instructionAddressSpace: "cpu",
        instructionAddress: 0x100,
        accessedAddressSpace: "cpu",
        accessedAddress: 0x900,
        access: "read",
        width: 1,
        count: 3,
        evidence: [],
      },
      {
        id: "coverage",
        kind: "runtime-coverage",
        architecture: "fixture.cpu",
        addressSpace: "file",
        start: 0,
        end: 1,
        coverage: "executed",
        count: 12,
        evidence: [],
      },
    ],
  },
});
const ranges = [{ addressSpace: "cpu", start: 0x100, end: 0x101, outputStart: 0, outputEnd: 1 }];
const fixture = (t: { teardown(callback: () => void): void }, input = project()) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-sql-annotations-"));
  publishAnalysisProject(directory, input);
  const store = openAnalysisProjectStore(directory);
  t.teardown(() => {
    store.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });
  return { store, directory, input };
};

test("SQLite viewport joins match the complete projection for explicit logical/output identities", (t) => {
  const { store, input } = fixture(t);
  const before = store.manifest();
  store.prepareAnnotationQueries();
  const view = store.transaction(() => store.instructionAnnotationView(ranges), false);
  const actual = buildInstructionAnalysisAnnotations(input.manifest, view.shards).instructions;
  const expected = buildInstructionAnalysisAnnotations(
    input.manifest,
    input.shards,
  ).instructions.filter((record) => record.address !== 0x900);
  t.deepEqual(actual, expected);
  t.false(view.limited);
  t.is(view.executionCounts.get("cpu:256"), 12);
  t.deepEqual(store.manifest(), before, "query indexing does not publish a semantic edit");
  t.true(store.annotationNodesAt("cpu", 0x100, 0).every((record) => record.kind === "cfg-node"));
});

test("viewport ownership tolerates omitted ancestors while publication and visible relationships stay strict", (t) => {
  const entry = { ...node("entry", 0x900, 900), functionEntry: "entry" };
  const predecessor = {
    ...node("predecessor", 0x800, 800),
    functionEntry: "entry",
    evidencePredecessor: "entry",
  };
  const visible = {
    ...node("visible", 0x100, 0),
    functionEntry: "entry",
    evidencePredecessor: "predecessor",
  };
  const input = project();
  const { store } = fixture(t, {
    ...input,
    shards: { ...input.shards, analysis: [entry, predecessor, visible] },
  });
  store.prepareAnnotationQueries();
  const view = store.transaction(() => store.instructionAnnotationView(ranges), false);
  t.deepEqual(
    view.shards.analysis,
    [visible],
    "view does not fetch the function's omitted ancestry",
  );
  t.throws(() => validateAnalysisOwnership([visible]), { message: /invalid function entry/ });
  t.throws(() => validateAnalysisOwnership([entry, visible]), {
    message: /invalid evidence predecessor/,
  });
  t.notThrows(() => validateAnalysisOwnership([entry, visible], "partial"));
  t.throws(
    () =>
      validateAnalysisOwnership([visible, { ...predecessor, functionEntry: "other" }], "partial"),
    { message: /invalid evidence predecessor/ },
  );
  t.throws(
    () =>
      validateAnalysisOwnership(
        [visible, { ...predecessor, evidencePredecessor: "visible" }],
        "partial",
      ),
    { message: /cyclic evidence predecessor/ },
  );
  t.throws(
    () => validateAnalysisOwnership([{ ...visible, evidencePredecessor: undefined }], "partial"),
    { message: /does not lead to its function entry/ },
  );
});

test("hot-PC previews remain bounded while SQL execution totals include omitted records", (t) => {
  const input = project();
  const runtime: RuntimeEvidenceRecord[] = [];
  for (let index = 0; index < 1000; index++) {
    runtime.push({
      id: `state:${index}`,
      kind: "runtime-cpu-state",
      architecture: "fixture.cpu",
      addressSpace: "cpu",
      address: 0x100,
      state: { a: index },
      count: 1,
      evidence: [],
    });
    runtime.push({
      id: `execution:${index}`,
      kind: "runtime-execution",
      architecture: "fixture.cpu",
      addressSpace: "cpu",
      address: 0x100,
      count: 2,
      evidence: [],
    });
  }
  // Paired states sort before standalone states, but both must share the same 64-row allowance.
  for (let index = 0; index < 70; index++) {
    const id = `runtime:instruction-trace:${"d".repeat(64)}`;
    const suffix = index.toString(16).padStart(64, "0");
    const common = {
      architecture: "fixture.cpu",
      addressSpace: "cpu",
      address: 0x100,
      state: { a: index },
      count: 1,
      evidence: [],
    };
    runtime.push(
      { ...common, id: `${id}:code:${suffix}`, kind: "runtime-instruction", bytes: [0xea] },
      { ...common, id: `${id}:state:${suffix}`, kind: "runtime-cpu-state" },
    );
  }
  const { store } = fixture(t, { ...input, shards: { ...input.shards, runtime } });
  store.prepareAnnotationQueries();
  const view = store.transaction(() => store.instructionAnnotationView(ranges), false);
  t.true(view.limited);
  t.is(view.executionCounts.get("cpu:256"), 2000);
  t.is(view.shards.runtime.filter((record) => record.kind === "runtime-cpu-state").length, 64);
  t.is(view.shards.runtime.filter((record) => record.kind === "runtime-execution").length, 64);
  t.is(store.counts().runtime, runtime.length);
});

test("viewport queries read paired and standalone states without expanding the runtime compatibility view", (t) => {
  const input = project();
  const runtime = [...input.shards.runtime];
  const capture = "a".repeat(64);
  for (const [address, suffix] of [
    [0x100, "b"],
    [0x900, "c"],
  ] as const) {
    const identity = suffix.repeat(64);
    runtime.push(
      {
        id: `runtime:instruction-trace:${capture}:code:${identity}`,
        kind: "runtime-instruction",
        architecture: "fixture.cpu",
        addressSpace: "cpu",
        address,
        bytes: [0xea],
        state: { p: 0x20 },
        count: 7,
        evidence: [],
      },
      {
        id: `runtime:instruction-trace:${capture}:state:${identity}`,
        kind: "runtime-cpu-state",
        architecture: "fixture.cpu",
        addressSpace: "cpu",
        address,
        state: { p: 0x20 },
        count: 7,
        evidence: [],
      },
    );
  }
  const { store } = fixture(t, { ...input, shards: { ...input.shards, runtime } });
  store.prepareAnnotationQueries();
  const sql = new DatabaseSync(store.file, { readOnly: true });
  try {
    const prepared: StatementSync[] = [];
    const prepare = sql.prepare.bind(sql);
    sql.prepare = (query) => {
      const statement = prepare(query);
      prepared.push(statement);
      return statement;
    };
    // The old joins scanned paired history and materialized an execution self-join per source line.
    // Rejecting compatibility-view reads exercises the real projection's physical query path.
    sql.setAuthorizer((action, table, _column, _database, view) =>
      action === constants.SQLITE_READ && (table === "runtime" || view === "runtime")
        ? constants.SQLITE_DENY
        : constants.SQLITE_OK,
    );
    const view = readSqliteAnnotationView(sql, store.manifest(), ranges);
    const states = view.shards.runtime.filter((record) => record.kind === "runtime-cpu-state");
    t.is(states.length, 2);
    t.true(
      states.some((record) => record.id.endsWith(`:state:${"b".repeat(64)}`) && record.count === 7),
    );
    t.true(states.some((record) => record.id === "state" && record.count === 12));
    t.false(view.shards.runtime.some((record) => record.id.includes(":state:" + "c".repeat(64))));
    t.is(view.executionCounts.get("cpu:256"), 12);
    t.false(view.limited);
    const outputQuery = prepared.find((statement) => {
      const query = statement.sourceSQL;
      return (
        query.includes("payload") &&
        query.includes("analysis") &&
        (query.includes("query_file_offset>=") || query.includes("q.file_offset>="))
      );
    });
    t.truthy(outputQuery);
    const plan = prepare(`EXPLAIN QUERY PLAN ${outputQuery!.expandedSQL}`).all();
    t.true(
      plan.some((row) =>
        String(row.detail).includes("query_instruction_output (query_file_offset>"),
      ),
      "output lookups must use a bounded offset search, not a scan by instruction kind",
    );
    t.deepEqual(
      buildInstructionAnalysisAnnotations(input.manifest, view.shards).instructions,
      buildInstructionAnalysisAnnotations(input.manifest, {
        ...input.shards,
        runtime,
      }).instructions.filter((record) => record.address !== 0x900),
    );
  } finally {
    sql.close();
  }
});

test("viewport reads ignore unrelated runtime payloads instead of scanning the history", (t) => {
  const { store } = fixture(t);
  store.transaction(() =>
    store.insertRuntime({
      id: "outside",
      kind: "runtime-cpu-state",
      architecture: "fixture.cpu",
      addressSpace: "cpu",
      address: 0x900,
      state: {},
      count: 1,
      evidence: [],
    }),
  );
  store.prepareAnnotationQueries();
  const sql = new DatabaseSync(store.file);
  try {
    sql.exec(
      "UPDATE runtime SET payload='invalid outside viewport' WHERE address=2304 AND kind='runtime-cpu-state'",
    );
  } finally {
    sql.close();
  }
  store.prepareAnnotationQueries();
  t.notThrows(() => store.transaction(() => store.instructionAnnotationView(ranges), false));
});

test("repeated output executions cannot hide a neighboring runtime-only instruction", (t) => {
  const input = project();
  const runtime: RuntimeEvidenceRecord[] = Array.from({ length: 2100 }, (_, index) => ({
    id: `hot:${index}`,
    kind: "runtime-execution",
    architecture: "fixture.cpu",
    addressSpace: "cpu",
    address: 0x100,
    fileOffset: 0,
    count: 1,
    evidence: [],
  }));
  runtime.push({
    id: "neighbor",
    kind: "runtime-execution",
    architecture: "fixture.cpu",
    addressSpace: "cpu",
    address: 0x101,
    fileOffset: 1,
    count: 7,
    evidence: [],
  });
  const { store } = fixture(t, { ...input, shards: { ...input.shards, analysis: [], runtime } });
  store.prepareAnnotationQueries();
  const view = store.instructionAnnotationView([
    { addressSpace: "unmapped", start: 0, end: 2, outputStart: 0, outputEnd: 2 },
  ]);
  t.is(view.executionCounts.get("cpu:257"), 7);
  t.true(view.shards.runtime.some((record) => record.id === "neighbor"));
});

test("derived offsets follow SQL updates, deletes, rollback, and compaction", (t) => {
  const { store } = fixture(t);
  store.prepareAnnotationQueries();
  const sql = new DatabaseSync(store.file);
  const updated = node("node", 0x101, 4);
  try {
    sql
      .prepare("UPDATE analysis SET address=?,payload=? WHERE id='node'")
      .run(updated.address, JSON.stringify(updated));
    t.throws(() => store.transaction(() => store.instructionAnnotationView(ranges), false), {
      message: /indexes changed/,
    });
    store.prepareAnnotationQueries();
    t.deepEqual(store.annotationNodesAt("missing", 0, 4), [updated]);
    sql.exec("BEGIN; DELETE FROM analysis WHERE id='node'; ROLLBACK;");
    t.deepEqual(store.annotationNodesAt("missing", 0, 4), [updated]);
    sql.exec("DELETE FROM analysis WHERE id='node'");
    t.deepEqual(store.annotationNodesAt("missing", 0, 4), []);
  } finally {
    sql.close();
  }
  store.compact();
  store.prepareAnnotationQueries();
  t.true(store.annotationNodesAt("missing", 0, 0).some((record) => record.id === "alias"));
});

test("viewport bounds reject unbounded or malformed coordinates", (t) => {
  const { store } = fixture(t);
  store.prepareAnnotationQueries();
  for (const range of [
    { addressSpace: "cpu", start: -1, end: 1 },
    { addressSpace: "cpu", start: 1, end: 1 },
    { addressSpace: "cpu", start: 1, end: 2, outputStart: 0 },
    { addressSpace: "cpu", start: 1, end: 2, outputStart: 0, outputEnd: NaN },
  ]) {
    t.throws(() => store.instructionAnnotationView([range]), { message: /Invalid instruction/ });
  }
  t.throws(() => store.instructionAnnotationView(Array(2001).fill(ranges[0])), {
    message: /At most 2000/,
  });
});

test("SQLite REPLACE without recursive delete triggers cannot strand pending offsets", (t) => {
  const { store } = fixture(t);
  store.prepareAnnotationQueries();
  const sql = new DatabaseSync(store.file);
  try {
    sql.exec("UPDATE analysis SET payload=payload WHERE id='node'");
    const replacement = {
      id: "node",
      kind: "function",
      addressSpace: "cpu",
      address: 256,
      source: "call",
      evidence: [],
      evidencePath: [],
    };
    sql
      .prepare(
        "INSERT OR REPLACE INTO analysis(id,kind,address_space,address,payload) VALUES('node','function','cpu',256,?)",
      )
      .run(JSON.stringify(replacement));
    store.prepareAnnotationQueries();
    t.notThrows(() => store.instructionAnnotationView(ranges));
    // Explicit rowid reuse can leave an already-ready offset behind. Output joins must check kind.
    sql
      .prepare(
        "INSERT OR REPLACE INTO analysis(rowid,id,kind,address_space,address,payload) SELECT rowid,'alias','function','cpu',512,? FROM analysis WHERE id='alias'",
      )
      .run(JSON.stringify({ ...replacement, id: "alias", address: 512 }));
    t.deepEqual(store.annotationNodesAt("missing", 0, 0), []);
  } finally {
    sql.close();
  }
});

test("partial index construction rolls back", (t) => {
  const { store } = fixture(t);
  const sql = new DatabaseSync(store.file);
  try {
    sql
      .prepare("UPDATE analysis SET payload=? WHERE id='node'")
      .run(JSON.stringify({ ...node("node", 0x100, 0), fileOffset: -1 }));
  } finally {
    sql.close();
  }
  t.throws(() => store.prepareAnnotationQueries(), {
    message: /Invalid persisted instruction output offset/,
  });
  const inspect = new DatabaseSync(store.file);
  try {
    t.is(
      inspect
        .prepare("SELECT count(*) AS n FROM sqlite_schema WHERE name='query_instruction_nodes'")
        .get()?.n,
      0,
    );
  } finally {
    inspect.close();
  }
});

test("SQL coverage pages and totals match the standalone sweep and survive unrelated edits", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-sql-coverage-"));
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  const base = project();
  const shards = {
    ...base.shards,
    regions: [
      { id: "region", name: "Test region", addressSpace: "file", start: 0, end: 4, evidence: [] },
    ],
    analysis: [
      ...base.shards.analysis,
      {
        id: "conflict",
        kind: "conflict" as const,
        addressSpace: "cpu",
        address: 0x100,
        conflictKind: "test",
        message: "Test",
        nodes: ["node", "alias"],
        evidence: [],
      },
    ],
    runtime: [
      ...base.shards.runtime,
      {
        id: "file-coverage",
        kind: "runtime-coverage" as const,
        architecture: "fixture.cpu",
        addressSpace: "file",
        start: 0,
        end: 3,
        coverage: "read" as const,
        count: 1,
        evidence: [],
      },
      {
        id: "outside",
        kind: "runtime-execution" as const,
        architecture: "fixture.cpu",
        addressSpace: "cpu",
        address: 0x111,
        fileOffset: 0x7fff,
        size: 3,
        count: 1,
        evidence: [],
      },
    ],
  };
  publishAnalysisProject(directory, { ...base, shards });
  const store = openAnalysisProjectStore(directory);
  t.teardown(() => store.close());
  const expected = buildRomCoverageMap(base.manifest, shards);
  const actual = store.coverageSummary();
  t.deepEqual(actual.summary, expected.summary);
  t.deepEqual(store.coveragePage("segments"), expected.segments);
  t.is(actual.detailCount, expected.diagnostics.length + expected.unprojected.length);
  store.transaction(() =>
    store.replaceTables({
      comments: [{ id: "new", addressSpace: "cpu", address: 0x100, text: "New", evidence: [] }],
    }),
  );
  t.deepEqual(store.coverageSummary(), actual);
  store.transaction(() => store.replaceTables({ annotations: [] }));
  t.deepEqual(
    store.coverageSummary().summary,
    buildRomCoverageMap(base.manifest, { ...shards, annotations: [] }).summary,
  );
});

test("SQL call ownership preserves aliases, missing edges, and last-entry evidence paths", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-sql-graph-"));
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  const base = project();
  const shards = {
    ...base.shards,
    analysis: [
      ...base.shards.analysis,
      { ...node("body", 0x101, 1), evidencePath: ["node", "alias", "missing", "body"] },
      {
        id: "f1",
        kind: "function" as const,
        addressSpace: "cpu",
        address: 0x100,
        source: "test",
        evidencePath: [],
        evidence: [],
      },
      {
        id: "f2",
        kind: "function" as const,
        addressSpace: "cpu",
        address: 0x200,
        source: "test",
        evidencePath: [],
        evidence: [],
      },
      {
        id: "call",
        kind: "cfg-edge" as const,
        addressSpace: "cpu",
        fromAddress: 0x101,
        toAddress: 0x100,
        from: "body",
        to: "node",
        edgeKind: "call",
        indirect: false,
        evidence: [],
      },
      {
        id: "edge-u",
        kind: "cfg-edge" as const,
        addressSpace: "cpu",
        fromAddress: 0x101,
        from: "body",
        edgeKind: "unresolved",
        indirect: true,
        evidence: [],
      },
      {
        id: "u",
        kind: "unresolved" as const,
        addressSpace: "cpu",
        address: 0x101,
        flowKind: "jump",
        indirect: true,
        reason: "Unknown",
        evidence: [],
      },
    ],
  };
  publishAnalysisProject(directory, { ...base, shards });
  const store = openAnalysisProjectStore(directory);
  t.teardown(() => store.close());
  const graph = store.callGraph();
  t.deepEqual(
    graph.functions.map(({ id, nodeIds }) => ({ id, nodeIds })),
    [
      { id: "f1", nodeIds: ["node"] },
      { id: "f2", nodeIds: ["alias", "body"] },
    ],
  );
  t.deepEqual(
    graph.calls.map(({ callerFunctionIds, calleeFunctionIds }) => ({
      callerFunctionIds,
      calleeFunctionIds,
    })),
    [{ callerFunctionIds: ["f2"], calleeFunctionIds: ["f1"] }],
  );
  t.deepEqual(graph.unresolved[0].ownerFunctionIds, ["f2"]);
  t.deepEqual(store.callGraph(), graph, "cached projection retains exact relationships");
  const labels = [{ id: "name", name: "New", addressSpace: "cpu", address: 0x100, evidence: [] }];
  store.transaction(() => store.replaceTables({ labels }));
  const renamed = store.callGraph();
  t.deepEqual(renamed.calls, graph.calls);
  t.deepEqual(renamed.unresolved, graph.unresolved);
  t.deepEqual(renamed.functions.find(({ id }) => id === "f1")?.labels, [
    { id: "name", name: "New" },
  ]);
});

const restoreCalls = (value: unknown): { calls: number } => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Invalid query cache.");
  }
  if (typeof value.calls !== "number") {
    throw new Error("Invalid query cache.");
  }
  return { calls: value.calls };
};

test("SQL result caching publishes after unrelated writes and invalidates only declared inputs", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-sql-cache-"));
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  publishAnalysisProject(directory, project());
  const store = openAnalysisProjectStore(directory),
    writer = openAnalysisProjectStore(directory);
  t.teardown(() => {
    store.close();
    writer.close();
  });
  let calls = 0;
  const compute = () => {
    store.manifest();
    calls++;
    writer.transaction(() =>
      writer.replaceTables({
        comments: [
          { id: "concurrent", addressSpace: "cpu", address: 0x100, text: "Edit", evidence: [] },
        ],
      }),
    );
    return { calls };
  };
  t.deepEqual(
    store.cachedProjection("fixture", "1", ["analysis"], compute, undefined, restoreCalls),
    {
      calls: 1,
    },
  );
  t.deepEqual(
    store.cachedProjection("fixture", "1", ["analysis"], compute, undefined, restoreCalls),
    {
      calls: 1,
    },
  );
  writer.transaction(() => writer.replaceTables({ analysis: [] }));
  t.deepEqual(
    store.cachedProjection("fixture", "1", ["analysis"], compute, undefined, restoreCalls),
    {
      calls: 2,
    },
  );
});

test("compact execution summaries do not read detail payloads and preserve mirrored counts", (t) => {
  const input = project();
  input.shards.runtime.push({
    id: "mirrored-execution",
    kind: "runtime-execution",
    architecture: "fixture.cpu",
    addressSpace: "cpu",
    address: 0x200,
    fileOffset: 0,
    count: 7,
    evidence: [],
  });
  const { store } = fixture(t, input);
  store.prepareAnnotationQueries();
  const sql = new DatabaseSync(store.file, { readOnly: true });
  t.teardown(() => sql.close());
  sql.setAuthorizer((action, table, column) => {
    if (
      action === constants.SQLITE_READ &&
      (column === "payload" ||
        ["analysis", "evidence", "annotations", "comments"].includes(table ?? ""))
    ) {
      return constants.SQLITE_DENY;
    }
    return constants.SQLITE_OK;
  });
  const [summary] = readInstructionExecutionSummary(sql, input.manifest, ranges);
  t.deepEqual(
    summary.locations.map(({ addressSpace, address, executionCount }) => ({
      addressSpace,
      address,
      executionCount,
    })),
    [
      { addressSpace: "file", address: 0, executionCount: 0 },
      { addressSpace: "cpu", address: 0x100, executionCount: 12 },
      { addressSpace: "cpu", address: 0x200, executionCount: 7 },
    ],
  );
  t.false(summary.limited);
  t.throws(() =>
    readInstructionExecutionSummary(sql, input.manifest, [
      { addressSpace: "cpu", start: 2, end: 1 },
    ]),
  );
});

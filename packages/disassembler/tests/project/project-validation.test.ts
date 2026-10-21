import { test } from "../../../../tests/ava-helper.js";
import {
  RomImage,
  ANALYSIS_PROJECT_FORMAT,
  ANALYSIS_PROJECT_SCHEMA_VERSION,
  type AnalysisProjectShards,
  type AnalysisProjectManifest,
  type RuntimeEvidenceRecord,
  type IntervalAnnotation,
} from "../../src/index.js";
import {
  validateAnalysisProjectManifest,
  validateLoadedShards,
  validateRuntimeRecords,
  createRuntimeRecordValidator,
} from "../../src/model/project-validation.js";

const project: AnalysisProjectManifest = {
  format: ANALYSIS_PROJECT_FORMAT,
  schemaVersion: ANALYSIS_PROJECT_SCHEMA_VERSION,
  target: "fixture",
  rom: new RomImage(new Uint8Array(256), { headerSize: 0 }).identity,
  mapping: { mapper: "fixture", source: "override", candidates: [] },
  addressSpaces: [{ id: "rom", name: "ROM", addressBits: 8, kind: "file" }],
};
const shards = (): AnalysisProjectShards => ({
  analysis: [],
  annotations: [],
  labels: [],
  comments: [],
  regions: [],
  runtime: [],
  evidence: [],
  imports: [],
});
const annotation: IntervalAnnotation = {
  id: "range",
  addressSpace: "rom",
  architecture: "snes.65816",
  start: 8,
  end: 16,
  classification: "asset",
  evidence: [],
};

// The validator is a trust boundary. Object.assign deliberately supplies malformed decoded data
// without weakening production types or bypassing the production validation function.
test("manifest rejects malformed identities, address spaces and storage revisions", (t) => {
  for (const value of [
    null,
    [],
    1,
    { ...project, rom: { ...project.rom, contentSha256: "bad" } },
    { ...project, addressSpaces: {} },
    { ...project, addressSpaces: [null] },
    { ...project, addressSpaces: [{ id: "", name: "" }] },
    { ...project, addressSpaces: [...project.addressSpaces, ...project.addressSpaces] },
    ...[0, 54, 1.5, "8"].map((addressBits) =>
      Object.assign({}, project, {
        addressSpaces: [Object.assign({}, project.addressSpaces[0], { addressBits })],
      }),
    ),
    { ...project, db: { path: "other" } },
    ...[-1, 1.5, "0"].map((revision) => Object.assign({}, project, { revision })),
  ]) {
    t.throws(() => validateAnalysisProjectManifest(value));
  }
  t.notThrows(() =>
    validateAnalysisProjectManifest({ ...project, db: "analysis.sqlite", revision: 0 }),
  );
});

test("runtime validation rejects bad counts, scope, memory actors and machine values", (t) => {
  const execution: RuntimeEvidenceRecord = {
    id: "exec",
    kind: "runtime-execution",
    architecture: "snes.65816",
    addressSpace: "rom",
    address: 0,
    count: 1,
    evidence: [],
  };
  const cases: readonly (readonly [Record<string, unknown>, RegExp])[] = [
    [{ id: "" }, /without an id/],
    [{ evidence: ["missing"] }, /missing evidence/],
    ...[0, -1, 0.5, NaN].map((count) => [{ count }, /observation count/] as const),
    ...[0, -1, 0.5].map((size) => [{ size }, /instruction size/] as const),
    ...[-1, 256, 0.5].map((opcode) => [{ opcode }, /opcode/] as const),
    ...[-1, 256, 0.5].map((fileOffset) => [{ fileOffset }, /file offset/] as const),
    [{ addressSpace: "missing" }, /unknown address space/],
    ...[-1, 256, 0.5].map((address) => [{ address }, /exceeds address/] as const),
    [{ kind: "runtime-coverage", start: 1, end: 1 }, /half-open/],
    [{ kind: "runtime-cpu-state", state: { "": 1 } }, /invalid field/],
    ...[Infinity, {}, null].map(
      (value) => [{ kind: "runtime-cpu-state", state: { a: value } }, /invalid field/] as const,
    ),
    [{ kind: "runtime-bus-access", architecture: "65xx.2a03" }, /65816/],
    [{ kind: "runtime-graphics-access" }, /graphics fact/],
    [{ extra: [{ fileBytes: [1] }] }, /ROM byte payload/],
  ];
  for (const [change, message] of cases) {
    t.throws(() => validateRuntimeRecords([Object.assign({ ...execution }, change)], project, []), {
      message,
    });
  }
  const memory: RuntimeEvidenceRecord = {
    id: "read",
    kind: "runtime-memory-access",
    architecture: "snes.65816",
    instructionAddressSpace: "rom",
    instructionAddress: 0,
    accessedAddressSpace: "rom",
    accessedAddress: 1,
    access: "read",
    width: 1,
    count: 1,
    evidence: [],
  };
  for (const [change, message] of [
    [{ actor: "invalid" }, /actor/],
    [{ actor: "cpu", channel: 0 }, /channel/],
    [{ actor: "dma", channel: 8 }, /channel/],
    [{ channel: 0 }, /channel/],
    [{ width: 0 }, /width/],
    [{ value: -1 }, /value/],
    [{ instructionAddressSpace: "missing" }, /unknown address/],
    [{ accessedAddress: 256 }, /exceeds address/],
  ] as const) {
    t.throws(() => validateRuntimeRecords([Object.assign({ ...memory }, change)], project, []), {
      message,
    });
  }
  t.notThrows(() =>
    validateRuntimeRecords([{ ...memory, actor: "hdma", channel: 7, value: 255 }], project, []),
  );
  t.notThrows(() =>
    validateRuntimeRecords(
      [
        Object.assign(
          { ...execution },
          { kind: "runtime-cpu-state", state: { text: "known", e: true, a: 0 } },
        ),
      ],
      project,
      [],
    ),
  );
  t.throws(() => validateRuntimeRecords([execution, execution], project, []), {
    message: /duplicate/,
  });
  const validate = createRuntimeRecordValidator(project, [], false);
  t.notThrows(() => {
    validate(execution);
    validate(execution);
  });
  validate.close();
});

/** Validate one codec attachment against the same ROM and range bounds. */
const validate = (value: typeof annotation.asset) =>
  validateLoadedShards({ ...shards(), annotations: [{ ...annotation, asset: value }] }, project);

test("codec contracts reject unstable identities and unsafe options while retaining nested JSON", (t) => {
  const asset = {
    codecId: "Codec.v1",
    codecVersion: "1",
    provider: { pluginId: "Plugin.v1", pluginVersion: "1" },
    options: { nested: [null, true, 1, "value", { item: 2 }] },
  };

  t.notThrows(() => validate(asset));
  for (const codecId of ["", "-a", "a-", "a b", "a?b"]) {
    t.throws(() => validate({ ...asset, codecId }), { message: /codec id/ });
  }
  t.throws(() => validate({ ...asset, codecVersion: " " }), { message: /codec version/ });
  for (const pluginId of ["", "bad plugin"]) {
    t.throws(() => validate({ ...asset, provider: { ...asset.provider, pluginId } }), {
      message: /plugin id/,
    });
  }
  t.throws(() => validate({ ...asset, provider: { ...asset.provider, pluginVersion: " " } }), {
    message: /plugin version/,
  });
  for (const options of [{ bad: undefined }, { bad: new Date() }, [Infinity], { bad: () => {} }]) {
    const invalid = { ...asset };
    Object.assign(invalid, { options });
    t.throws(() => validate(invalid), { message: /JSON-safe/ });
  }
  const compression = { codecId: "codec", codecVersion: "1" };
  t.notThrows(() => validate({ ...asset, compression }));
  for (const [changes, message] of [
    [{ bankStart: 0 }, /supplied together/],
    [{ bankEnd: 16 }, /supplied together/],
    [{ bankStart: -1, bankEnd: 16 }, /bank bounds/],
    [{ bankStart: 10, bankEnd: 16 }, /bank bounds/],
    [{ bankStart: 0, bankEnd: 15 }, /bank bounds/],
    [{ bankStart: 0, bankEnd: 0 }, /bank bounds/],
    [{ fillByte: -1 }, /fillByte/],
    [{ fillByte: 256 }, /fillByte/],
    [{ fillByte: 0.5 }, /fillByte/],
    [{ maximumSize: 0 }, /maximumSize/],
    [{ maximumSize: 9 }, /maximumSize/],
  ] as const) {
    t.throws(() => validate({ ...asset, compression: { ...compression, ...changes } }), {
      message,
    });
  }
});

test("metadata validation rejects invalid provenance, inline declarations and bank selectors", (t) => {
  const label = { id: "label", addressSpace: "rom", address: 8, name: "Start", evidence: [] };
  for (const [changes, message] of [
    [{ id: "" }, /without an id/],
    [{ address: -1 }, /invalid address/],
    [{ suppressed: "yes" }, /suppression/],
    [{ sourceName: "bad name" }, /source name/],
    [{ inlineComment: "line\nline" }, /single-line/],
    [{ analysisEntryPoint: 1 }, /analysisEntryPoint/],
    [{ addressSpace: "missing" }, /unknown address/],
    [{ mapping: {} }, /research mapping/],
    [{ mapping: { fileOffset: 256 } }, /research mapping/],
  ] as const) {
    t.throws(
      () =>
        validateLoadedShards(
          { ...shards(), labels: [Object.assign({ ...label }, changes)] },
          project,
        ),
      { message },
    );
  }
  t.throws(() => validateLoadedShards({ ...shards(), labels: [label, label] }, project), {
    message: /duplicate/,
  });
  for (const changes of [
    { placement: "unknown" },
    { placement: "inline-instruction", text: "one\ntwo" },
  ]) {
    const comment = { id: "comment", addressSpace: "rom", address: 0, text: "a", evidence: [] };
    Object.assign(comment, changes);
    t.throws(
      () =>
        validateLoadedShards(
          {
            ...shards(),
            comments: [comment],
          },
          project,
        ),
      { message: /placement|single-line/ },
    );
  }
  const artifact = {
    format: "trace",
    sha256: "a".repeat(64),
    romContentSha256: project.rom.contentSha256,
  };
  for (const [changes, message] of [
    [{ format: "" }, /identity/],
    [{ sha256: "bad" }, /identity/],
    [{ romContentSha256: "b".repeat(64) }, /different ROM/],
    [{ mapper: "other" }, /different mapper/],
  ] as const) {
    t.throws(
      () =>
        validateLoadedShards(
          {
            ...shards(),
            evidence: [
              {
                id: "capture",
                source: "manual",
                sourceId: "test",
                confidence: "certain",
                artifact: { ...artifact, ...changes },
              },
            ],
          },
          project,
        ),
      { message },
    );
  }
  for (const changes of [
    { start: -1 },
    { end: 8 },
    { start: 256, end: 257 },
    { mapping: { fileOffset: 250 } },
  ]) {
    t.throws(
      () =>
        validateLoadedShards(
          { ...shards(), annotations: [Object.assign({ ...annotation }, changes)] },
          project,
        ),
      { message: /range|exceeds|mapping/ },
    );
  }
});

test("region ownership rejects missing parents, cycles and escaped child ranges", (t) => {
  const parent = {
    id: "parent",
    addressSpace: "rom",
    start: 8,
    end: 16,
    name: "Parent",
    evidence: [],
  };
  const child = { ...parent, id: "child", parentRegion: "parent", start: 9, end: 10 };
  for (const [regions, message] of [
    [[child], /missing parent/],
    [[{ ...parent, parentRegion: "child" }, child], /cyclic/],
    [[{ ...parent, parentRegion: "parent" }], /cyclic/],
    [[parent, { ...child, end: 17 }], /not contained/],
    [[child, { ...parent, parentRegion: "missing" }], /parent relationship|missing parent/],
  ] as const) {
    t.throws(() => validateLoadedShards({ ...shards(), regions }, project), { message });
  }
  t.notThrows(() => validateLoadedShards({ ...shards(), regions: [parent, child] }, project));
});

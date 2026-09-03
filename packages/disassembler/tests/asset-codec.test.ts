import { test } from "../../../tests/ava-helper.js";
import {
  AssetCodecRegistry,
  planAssets,
  verifyAssetPlan,
  type AssetByteSource,
  type AssetCodec,
  type AssetRequest,
} from "../src/index.js";

class Bytes implements AssetByteSource {
  readonly #bytes: Uint8Array;

  constructor(bytes: readonly number[]) {
    this.#bytes = Uint8Array.from(bytes);
  }

  get length(): number {
    return this.#bytes.length;
  }

  read(offset: number, length: number): Uint8Array | undefined {
    if (offset < 0 || length < 0 || offset + length > this.length) return undefined;
    return this.#bytes.slice(offset, offset + length);
  }
}

const request = (overrides: Partial<AssetRequest> = {}): AssetRequest => ({
  id: "root",
  codecId: "fixture.raw",
  sourceOffset: 0,
  addressSpace: "rom.file",
  address: 0x100,
  length: 4,
  ...overrides,
});

const rawCodec = (id = "fixture.raw", overrides: Partial<AssetCodec> = {}): AssetCodec => ({
  id,
  version: "1.0.0",
  sizeBounds: { minimum: 1, maximum: 64 },
  inspect: ({ request: asset }) => ({ size: asset.length ?? 1 }),
  decode: ({ source, request: asset, inspection }) => ({
    value: [...source.read(asset.sourceOffset, inspection.size)!],
    files: [
      { path: "preview/z.bin", mediaType: "application/octet-stream", bytes: new Uint8Array([2]) },
      { path: "preview/a.bin", mediaType: "application/octet-stream", bytes: new Uint8Array([1]) },
    ],
  }),
  encode: ({ decoded }) => Uint8Array.from(decoded.value as readonly number[]),
  ...overrides,
});

test("asset registry resolves dependencies by stable id, not registration order", (t) => {
  const registry = new AssetCodecRegistry();
  const container = rawCodec("fixture.container", {
    dependencies: ["fixture.raw"],
    inspect: ({ request: asset, dependencies }) => {
      t.true(dependencies.has("fixture.raw"));
      return {
        size: asset.length ?? 6,
        references: [
          { id: "z", kind: "pointer", addressSpace: "rom.file", address: 9 },
          { id: "a", kind: "pointer", addressSpace: "rom.file", address: 1 },
        ],
        children: [{ id: "payload", codecId: "fixture.raw", relativeOffset: 2, length: 2 }],
      };
    },
  });
  registry.register(container).register(rawCodec());

  t.deepEqual(
    registry.list().map((codec) => codec.id),
    ["fixture.container", "fixture.raw"],
  );
  const source = new Bytes([0, 1, 2, 3, 4, 5]);
  const plan = planAssets(registry, source, [request({ codecId: "fixture.container", length: 6 })]);
  t.deepEqual(
    plan.assets.map((asset) => asset.id),
    ["root", "root/payload"],
  );
  t.deepEqual(plan.conflicts, []);
  t.deepEqual(
    plan.assets[0].inspection.references?.map((reference) => reference.id),
    ["a", "z"],
  );

  const verified = verifyAssetPlan(registry, source, plan);
  t.is(verified.assets.length, 2);
  t.is(verified.assets[0].sourceSha256, verified.assets[0].encodedSha256);
  t.deepEqual(
    verified.assets[0].files.map((file) => file.path),
    ["preview/a.bin", "preview/z.bin"],
  );
});

test("asset registry reports missing, duplicate, and cyclic dependencies", (t) => {
  const missing = new AssetCodecRegistry().register(
    rawCodec("fixture.parent", { dependencies: ["fixture.missing"] }),
  );
  t.throws(() => missing.resolve("fixture.parent"), { message: /Unknown asset codec/ });

  const cyclic = new AssetCodecRegistry()
    .register(rawCodec("fixture.a", { dependencies: ["fixture.b"] }))
    .register(rawCodec("fixture.b", { dependencies: ["fixture.a"] }));
  t.throws(() => cyclic.resolve("fixture.a"), { message: /dependency cycle/ });
  t.throws(() => cyclic.register(rawCodec("fixture.a")), { message: /Duplicate asset codec/ });
  t.throws(
    () =>
      new AssetCodecRegistry().register(
        rawCodec("fixture.repeat", { dependencies: ["fixture.a", "fixture.a"] }),
      ),
    { message: /repeats dependency/ },
  );
});

test("asset planner enforces codec bounds, exact size, alignment, and containment", (t) => {
  const source = new Bytes([0, 1, 2, 3, 4, 5, 6, 7]);
  const registry = new AssetCodecRegistry().register(
    rawCodec("fixture.aligned", {
      sizeBounds: { minimum: 2, maximum: 4, alignment: 2 },
    }),
  );
  t.throws(
    () =>
      planAssets(registry, source, [
        request({ codecId: "fixture.aligned", sourceOffset: 1, length: 2 }),
      ]),
    { message: /not aligned/ },
  );
  t.throws(
    () => planAssets(registry, source, [request({ codecId: "fixture.aligned", length: 5 })]),
    { message: /outside codec bounds/ },
  );
  t.throws(
    () =>
      planAssets(registry, source, [
        request({ codecId: "fixture.aligned", sourceOffset: 6, length: 4 }),
      ]),
    { message: /beyond its byte source/ },
  );

  registry.register(
    rawCodec("fixture.container", {
      inspect: () => ({
        size: 4,
        children: [{ id: "outside", codecId: "fixture.aligned", relativeOffset: 3, length: 2 }],
      }),
    }),
  );
  t.throws(() => planAssets(registry, source, [request({ codecId: "fixture.container" })]), {
    message: /not contained|outside asset/,
  });
});

test("asset planner retains root and sibling overlaps as explicit conflicts", (t) => {
  const source = new Bytes([0, 1, 2, 3, 4, 5, 6, 7]);
  const registry = new AssetCodecRegistry().register(rawCodec());
  const roots = planAssets(registry, source, [
    request({ id: "left", length: 4 }),
    request({ id: "right", sourceOffset: 2, address: 0x102, length: 4 }),
  ]);
  t.like(roots.conflicts[0], {
    kind: "overlap",
    assets: ["left", "right"],
    sourceOffset: 2,
    endOffset: 4,
  });
  t.throws(() => verifyAssetPlan(registry, source, roots), { message: /overlap conflict/ });

  registry.register(
    rawCodec("fixture.container", {
      inspect: () => ({
        size: 6,
        children: [
          { id: "left", codecId: "fixture.raw", relativeOffset: 1, length: 3 },
          { id: "right", codecId: "fixture.raw", relativeOffset: 2, length: 3 },
        ],
      }),
    }),
  );
  const siblings = planAssets(registry, source, [
    request({ codecId: "fixture.container", length: 6 }),
  ]);
  t.true(
    siblings.conflicts.some(
      (conflict) => conflict.assets[0] === "root/left" && conflict.assets[1] === "root/right",
    ),
  );
  t.false(siblings.conflicts.some((conflict) => conflict.assets.includes("root")));
});

test("asset planner rejects nondeterministic inspection and excessive nesting", (t) => {
  const source = new Bytes([0, 1, 2, 3]);
  let inspections = 0;
  const nondeterministic = new AssetCodecRegistry().register(
    rawCodec("fixture.nondeterministic", {
      inspect: () => ({ size: ++inspections % 2 === 0 ? 2 : 1 }),
    }),
  );
  t.throws(
    () =>
      planAssets(nondeterministic, source, [
        request({ codecId: "fixture.nondeterministic", length: undefined }),
      ]),
    { message: /inspection is not deterministic/ },
  );

  const recursive = new AssetCodecRegistry().register(
    rawCodec("fixture.recursive", {
      inspect: () => ({
        size: 4,
        children: [{ id: "again", codecId: "fixture.recursive", relativeOffset: 0 }],
      }),
    }),
  );
  t.throws(
    () =>
      planAssets(recursive, source, [request({ codecId: "fixture.recursive" })], {
        maxDepth: 2,
      }),
    { message: /exceeds nested codec depth/ },
  );
});

test("asset verification rejects nondeterministic decode and encode", (t) => {
  const source = new Bytes([0, 1, 2, 3]);
  let decodes = 0;
  const decodeRegistry = new AssetCodecRegistry().register(
    rawCodec("fixture.decode", {
      decode: () => ({ value: ++decodes }),
      encode: ({ source, request: asset, inspection }) =>
        source.read(asset.sourceOffset, inspection.size)!,
    }),
  );
  const decodePlan = planAssets(decodeRegistry, source, [request({ codecId: "fixture.decode" })]);
  t.throws(() => verifyAssetPlan(decodeRegistry, source, decodePlan), {
    message: /decode is not deterministic/,
  });

  let encodes = 0;
  const encodeRegistry = new AssetCodecRegistry().register(
    rawCodec("fixture.encode", {
      encode: () => new Uint8Array([encodes++, 1, 2, 3]),
    }),
  );
  const encodePlan = planAssets(encodeRegistry, source, [request({ codecId: "fixture.encode" })]);
  t.throws(() => verifyAssetPlan(encodeRegistry, source, encodePlan), {
    message: /encode is not deterministic/,
  });
});

test("asset verification rejects unsafe files and byte or size drift", (t) => {
  const source = new Bytes([0, 1, 2, 3]);
  const unsafe = new AssetCodecRegistry().register(
    rawCodec("fixture.unsafe", {
      decode: () => ({
        value: [0, 1, 2, 3],
        files: [
          { path: "../escape.bin", mediaType: "application/octet-stream", bytes: new Uint8Array() },
        ],
      }),
    }),
  );
  const unsafePlan = planAssets(unsafe, source, [request({ codecId: "fixture.unsafe" })]);
  t.throws(() => verifyAssetPlan(unsafe, source, unsafePlan), { message: /Unsafe extracted/ });

  const changed = new AssetCodecRegistry().register(
    rawCodec("fixture.changed", { encode: () => new Uint8Array([9, 9, 9, 9]) }),
  );
  const changedPlan = planAssets(changed, source, [request({ codecId: "fixture.changed" })]);
  t.throws(() => verifyAssetPlan(changed, source, changedPlan), { message: /byte-identical/ });

  const resized = new AssetCodecRegistry().register(
    rawCodec("fixture.resized", { encode: () => new Uint8Array([0]) }),
  );
  const resizedPlan = planAssets(resized, source, [request({ codecId: "fixture.resized" })]);
  t.throws(() => verifyAssetPlan(resized, source, resizedPlan), { message: /expected exactly/ });
});

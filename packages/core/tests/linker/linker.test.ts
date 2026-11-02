import { test } from "../../../../tests/ava-helper.js";
import { debugMapRangesForAddress, validateDebugMap } from "../../src/debug-map.js";
import {
  artifactHash,
  decodeLibrary,
  decodeObject,
  encodeLibrary,
  encodeObject,
  linkObjects,
  LinkError,
} from "../../src/linker.js";
import { decodeEnvelope, encodeEnvelope } from "../../src/linker/envelope.js";
import type { AssemblyFixup, AssemblyLinkRecipe, AssemblyModule } from "../../src/relocatable.js";

const source = { file: "unit.asm", line: 1, architecture: "tiny.cpu" };
const symbol = (name: string) => ({ kind: "symbol", name }) as const;
const constant = (value: number) => ({ kind: "constant", value }) as const;
const location = (module: string, offset = 0, section = "Code") =>
  ({ kind: "section", module, section, offset }) as const;

/** Small producer records keep codec/layout failures independent of assembly front-end behavior. */
function unit(
  id: string,
  bytes: readonly number[],
  overrides: Partial<AssemblyModule> = {},
): AssemblyModule {
  return {
    id,
    target: "tiny.raw",
    targetOptions: {},
    sections: [
      {
        name: "Code",
        kind: "code",
        alignment: 1,
        addressSpace: "cpu",
        size: bytes.length,
        bytes: Uint8Array.from(bytes),
      },
    ],
    symbols: [],
    fixups: [],
    ranges: [{ section: "Code", offset: 0, size: bytes.length, kind: "instruction", source }],
    instructions: [],
    fields: [],
    assets: [],
    dependencies: [{ path: source.file, sha256: artifactHash("source"), size: 6 }],
    ...overrides,
  };
}
const recipe: AssemblyLinkRecipe = {
  target: "tiny.raw",
  regions: [
    { name: "ROM", start: 0x8000, size: 32, outputOffset: 0, fillByte: 0xff, addressSpace: "cpu" },
  ],
  placements: [{ section: "Code", load: "ROM", run: "ROM" }],
};
const exported = (name: string, id: string) => ({
  name,
  visibility: "export" as const,
  value: location(id),
  source,
});
const imported = (name: string) => ({ name, visibility: "import" as const, source });

function fixup(
  offset: number,
  expression: AssemblyFixup["expression"],
  encoding: AssemblyFixup["encoding"],
): AssemblyFixup {
  return { section: "Code", offset, expression, encoding, source };
}

test("native objects round trip Maps, bytes and metadata deterministically with owned storage", (t) => {
  const module = unit("owned", [1, 2, 3], {
    targetOptions: { parsed: new Map([["ROM", { start: 0x8000 }]]), optional: undefined },
  });
  const bytes = encodeObject(module);
  t.deepEqual(encodeObject(module), bytes);
  const decoded = decodeObject(bytes);
  t.true(decoded.targetOptions.parsed instanceof Map);
  decoded.sections[0].bytes[0] = 99;
  t.is(decodeObject(bytes).sections[0].bytes[0], 1);
  t.deepEqual(encodeObject(decodeObject(bytes)), bytes);
  t.throws(() => encodeObject(unit("effect", [], { targetOptions: { callback: () => 1 } })), {
    message: /portable data/,
  });
});

test("object readers reject corruption, truncation, versions, malformed extents and overlapping fields", (t) => {
  const bytes = encodeObject(unit("safe", [1]));
  const corrupt = bytes.slice();
  corrupt[corrupt.length - 1] ^= 1;
  t.throws(() => decodeObject(corrupt), { message: /SHA-256/ });
  t.throws(() => decodeObject(bytes.subarray(0, bytes.length - 1)), { message: /length mismatch/ });
  const future = bytes.slice();
  future[8] = 2;
  t.throws(() => decodeObject(future), { message: /version/ });
  t.throws(
    () =>
      encodeObject(
        unit("overlap", [0, 0, 0], {
          fixups: [fixup(0, constant(0), { width: 2 }), fixup(1, constant(0), { width: 2 })],
        }),
      ),
    { message: /Overlapping/ },
  );
  t.throws(
    () => encodeObject(unit("outside", [0], { fixups: [fixup(0, constant(0), { width: 2 })] })),
    { message: /outside/ },
  );
});

test("linker repairs scalar endian, low/high/bank and cross-module PC-relative operands after placement", (t) => {
  const main = unit("main", [0x22, 0, 0, 0, 0x80, 0, 0, 0], {
    symbols: [imported("Target")],
    fixups: [
      fixup(1, symbol("Target"), { width: 3 }),
      fixup(5, symbol("Target"), {
        width: 1,
        kind: "relative",
        signed: true,
        addressWidth: 16,
        wrapWidth: 16,
        pc: { section: "Code", offset: 6 },
      }),
      fixup(6, symbol("Target"), { width: 2, endianness: "big" }),
    ],
  });
  const target = unit("target", [0x60], { symbols: [exported("Target", "target")] });
  const linked = linkObjects({ objects: [encodeObject(main), encodeObject(target)], recipe });
  t.deepEqual([...linked.output.subarray(0, 9)], [0x22, 8, 0x80, 0, 0x80, 2, 0x80, 8, 0x60]);
  t.deepEqual(validateDebugMap(linked.debugMap, linked.output), []);
  t.truthy(debugMapRangesForAddress(linked.debugMap, "cpu", 0x8008).length);
  t.is(
    linkObjects({ objects: [encodeObject(main), encodeObject(target)], recipe }).inputSha256,
    linked.inputSha256,
  );
  const moved = linkObjects({
    objects: [encodeObject(main), encodeObject(target)],
    recipe: { ...recipe, placements: [{ ...recipe.placements[0], start: 0x8010 }] },
  });
  t.deepEqual([...moved.output.subarray(16, 25)], [0x22, 0x18, 0x80, 0, 0x80, 2, 0x80, 0x18, 0x60]);
});

test("layout aligns contributions, separates ROM load and RAM run addresses, and reserves BSS without payload", (t) => {
  const initialized = unit("ram", [3, 4], {
    sections: [
      {
        name: "Data",
        kind: "data",
        addressSpace: "cpu",
        alignment: 16,
        size: 2,
        bytes: Uint8Array.of(3, 4),
      },
      {
        name: "Bss",
        kind: "bss",
        addressSpace: "cpu",
        alignment: 16,
        size: 4,
        bytes: new Uint8Array(),
      },
    ],
    ranges: [],
    symbols: [
      { name: "Variable", visibility: "export", value: location("ram", 0, "Data"), source },
    ],
  });
  const linked = linkObjects({
    objects: [encodeObject(initialized)],
    recipe: {
      target: "tiny.raw",
      regions: [
        { name: "ROM", start: 0x8000, size: 16, outputOffset: 0 },
        { name: "RAM", start: 0x201, size: 64 },
      ],
      placements: [
        { section: "Data", load: "ROM", run: "RAM" },
        { section: "Bss", load: "RAM", run: "RAM" },
      ],
      symbols: [
        { name: "Load", section: "Data", property: "load" },
        { name: "Size", section: "Bss", property: "size" },
      ],
    },
  });
  t.deepEqual(
    linked.allocations.map((item) => [item.loadAddress, item.runAddress, item.outputOffset]),
    [
      [0x8000, 0x210, 0],
      [0x220, 0x220, undefined],
    ],
  );
  t.is(linked.symbols.find((item) => item.name === "Variable")?.value, 0x210);
  t.is(linked.symbols.find((item) => item.name === "Load")?.value, 0x8000);
  t.is(linked.output.length, 16);
  t.deepEqual([...linked.output.subarray(0, 2)], [3, 4]);
});

test("indexed libraries reach a cross-archive fixed point and leave unused members unallocated", (t) => {
  const main = unit("main", [0, 0], {
    symbols: [imported("A")],
    fixups: [fixup(0, symbol("A"), { width: 2 })],
  });
  const a = unit("a", [1], { symbols: [exported("A", "a"), imported("B")] });
  const b = unit("b", [2], { symbols: [exported("B", "b"), imported("A")] });
  const unused = unit("unused", [9], { symbols: [exported("Never", "unused")] });
  const archiveA = encodeLibrary([
    { name: "a.o", object: encodeObject(a) },
    { name: "unused.o", object: encodeObject(unused) },
  ]);
  const archiveB = encodeLibrary([{ name: "b.o", object: encodeObject(b) }]);
  t.deepEqual(decodeLibrary(archiveA).index.get("A"), [0]);
  const linked = linkObjects({
    objects: [encodeObject(main)],
    libraries: [archiveB, archiveA],
    recipe,
  });
  t.deepEqual(
    linked.selectedMembers.map((member) => member.name),
    ["a.o", "b.o"],
  );
  t.deepEqual([...linked.output.subarray(0, 4)], [2, 0x80, 1, 2]);
  t.false(linked.allocations.some((allocation) => allocation.module === "unused"));
  t.deepEqual(
    encodeLibrary([
      { name: "a.o", object: encodeObject(a) },
      { name: "unused.o", object: encodeObject(unused) },
    ]),
    archiveA,
  );
});

test("symbol cycles, duplicates, missing imports and failed assertions produce explicit link failures", (t) => {
  const cycle = unit("cycle", [], {
    symbols: [
      {
        name: "A",
        visibility: "local",
        value: { kind: "symbol", module: "cycle", name: "B" },
        source,
      },
      {
        name: "B",
        visibility: "local",
        value: { kind: "symbol", module: "cycle", name: "A" },
        source,
      },
    ],
  });
  t.throws(() => linkObjects({ objects: [encodeObject(cycle)], recipe }), { message: /Cyclic/ });
  t.throws(
    () =>
      linkObjects({
        objects: [encodeObject(unit("missing", [], { symbols: [imported("Missing")] }))],
        recipe,
      }),
    { message: /No object or library/ },
  );
  t.throws(
    () =>
      linkObjects({
        objects: [
          encodeObject(unit("one", [], { symbols: [exported("Same", "one")] })),
          encodeObject(unit("two", [], { symbols: [exported("Same", "two")] })),
        ],
        recipe,
      }),
    { message: /Duplicate global/ },
  );
  t.throws(
    () =>
      linkObjects({
        objects: [encodeObject(unit("assert", []))],
        recipe: {
          ...recipe,
          assertions: [{ expression: constant(0), message: "Capacity contract failed" }],
        },
      }),
    { message: /Capacity contract/ },
  );
});

test("field validation rejects overflow, cross-bank branches, missing CPU assumptions and bad packed inputs", (t) => {
  t.throws(() => runField(fixup(0, constant(256), { width: 1 })), { message: /range\/alignment/ });
  t.throws(
    () =>
      runField(
        fixup(0, constant(0x18000), {
          width: 1,
          kind: "relative",
          wrapWidth: 16,
          pc: { section: "Code", offset: 1 },
        }),
      ),
    { message: /another processor bank/ },
  );
  t.throws(() => runField(fixup(0, constant(0x8000), { width: 2, kind: "dataBank" })), {
    message: /dataBank assumption/,
  });
  t.throws(
    () =>
      runField(
        fixup(0, constant(0x101), {
          width: 1,
          checks: [{ expression: constant(0x101), alignment: 2 }],
        }),
      ),
    { message: /range\/alignment/ },
  );
  t.deepEqual(
    [
      ...runField(fixup(0, constant(0x123456), { width: 2, kind: "dataBank" }), {
        assumptions: [{ section: "Code", dataBank: 0x12 }],
      }).output.subarray(0, 2),
    ],
    [0x56, 0x34],
  );
});

test("allocation failures carry completed placement evidence and cancellation stops before linking", (t) => {
  const first = unit("one", [1]);
  const second = unit(
    "two",
    Array.from({ length: 32 }, () => 2),
  );
  const error = t.throws(
    () => linkObjects({ objects: [encodeObject(first), encodeObject(second)], recipe }),
    { instanceOf: LinkError },
  );
  t.is(error?.allocations.length, 1);
  const controller = new AbortController();
  controller.abort();
  t.throws(() => linkObjects({ objects: [], recipe, signal: controller.signal }), {
    name: "AbortError",
  });
});

test("integer evaluation supports 32-bit fields and cross-module differences without unsafe truncation", (t) => {
  const data = unit("integers", [0, 0, 0, 0, 0, 0], {
    symbols: [
      {
        name: "Difference",
        visibility: "local",
        value: { kind: "binary", operator: "-", left: symbol("End"), right: symbol("Begin") },
        source,
      },
    ],
    fixups: [
      fixup(0, constant(0xffffffff), { width: 4, minimum: 0 }),
      fixup(4, { kind: "symbol", module: "integers", name: "Difference" }, { width: 2 }),
    ],
  });
  const linked = linkObjects({
    objects: [encodeObject(data)],
    recipe: {
      ...recipe,
      symbols: [
        { name: "End", expression: constant(0x100000002) },
        { name: "Begin", expression: constant(0x100000000) },
      ],
    },
  });
  t.deepEqual([...linked.output.subarray(0, 6)], [255, 255, 255, 255, 2, 0]);
  const overflow = unit("overflow", [0], {
    fixups: [
      fixup(
        0,
        {
          kind: "binary",
          operator: "+",
          left: constant(Number.MAX_SAFE_INTEGER),
          right: constant(1),
        },
        { width: 1 },
      ),
    ],
  });
  t.throws(() => linkObjects({ objects: [encodeObject(overflow)], recipe }), {
    message: /unit.asm:1:.*safe integer/,
  });
});

test("library index priority is deterministic and selected duplicate providers fail", (t) => {
  const main = encodeObject(unit("main", [], { symbols: [imported("Choice")] }));
  const first = encodeLibrary([
    {
      name: "first",
      object: encodeObject(unit("first", [1], { symbols: [exported("Choice", "first")] })),
    },
  ]);
  const second = encodeLibrary([
    {
      name: "second",
      object: encodeObject(unit("second", [2], { symbols: [exported("Choice", "second")] })),
    },
  ]);
  t.is(linkObjects({ objects: [main], libraries: [first, second], recipe }).output[0], 1);
  t.is(linkObjects({ objects: [main], libraries: [second, first], recipe }).output[0], 2);
  const required = encodeObject(
    unit("required", [], { symbols: [imported("Choice"), imported("Extra")] }),
  );
  const colliding = encodeLibrary([
    {
      name: "extra",
      object: encodeObject(
        unit("extra", [3], { symbols: [exported("Choice", "extra"), exported("Extra", "extra")] }),
      ),
    },
  ]);
  t.throws(() => linkObjects({ objects: [required], libraries: [first, colliding], recipe }), {
    message: /Duplicate global/,
  });
});

test("bank-capacity, CPU-state and target contracts fail before producing artifacts", (t) => {
  const data = unit("banked", [1, 2, 3, 4]);
  const aligned = linkObjects({
    objects: [encodeObject(data)],
    recipe: {
      target: "tiny.raw",
      regions: [{ name: "ROM", start: 14, size: 8, outputOffset: 0 }],
      placements: [{ section: "Code", load: "ROM", run: "ROM", bankSize: 16 }],
    },
  });
  t.is(aligned.allocations[0].runAddress, 16);
  t.is(aligned.allocations[0].outputOffset, 2);
  const state = unit("state", [0xea], {
    instructions: [
      { section: "Code", offset: 0, size: 1, source, form: "implied", state: { m16: false } },
    ],
  });
  t.throws(
    () =>
      linkObjects({
        objects: [encodeObject(state)],
        recipe: { ...recipe, assumptions: [{ section: "Code", state: { m16: true } }] },
      }),
    { message: /m16=true/ },
  );
  t.throws(
    () => linkObjects({ objects: [encodeObject(data)], recipe: { ...recipe, target: "other" } }),
    { message: /targets 'tiny.raw'/ },
  );
  t.throws(
    () =>
      encodeObject(
        unit("private", [], {
          symbols: [{ name: "Leak", visibility: "local", value: location("other"), source }],
        }),
      ),
    { message: /private namespace/ },
  );
});

/** Link one checked field against a small deterministic address space. */
const runField = (field: AssemblyFixup, additions: Partial<AssemblyLinkRecipe> = {}) =>
  linkObjects({
    objects: [encodeObject(unit("fields", [0, 0, 0, 0], { fixups: [field] }))],
    recipe: { ...recipe, ...additions },
  });

test("archive readers authenticate their member export index rather than trusting caller-supplied names", (t) => {
  const archive = encodeLibrary([
    {
      name: "member",
      object: encodeObject(unit("member", [1], { symbols: [exported("Real", "member")] })),
    },
  ]);
  const decoded = decodeEnvelope(archive, "UASMLIB\0");
  const metadata = decoded.metadata;
  if (!metadata || typeof metadata !== "object" || !("index" in metadata)) {
    t.fail("Missing library index");
    return;
  }
  metadata.index = [["Fake", [0]]];
  t.throws(() => decodeLibrary(encodeEnvelope("UASMLIB\0", metadata, decoded.payload)), {
    message: /index or payload mismatch/,
  });
});

test("relative branches wrap the instruction-end PC within the originating processor bank", (t) => {
  const branch = unit("edge", [0x80, 0], {
    fixups: [
      fixup(1, symbol("Target"), {
        width: 1,
        kind: "relative",
        signed: true,
        addressWidth: 24,
        wrapWidth: 16,
        pc: { section: "Code", offset: 2 },
      }),
    ],
  });
  const endOfBank: AssemblyLinkRecipe = {
    target: "tiny.raw",
    regions: [{ name: "ROM", start: 0xc0fffe, size: 2, outputOffset: 0 }],
    placements: [{ section: "Code", load: "ROM", run: "ROM" }],
    symbols: [{ name: "Target", expression: constant(0xc00000) }],
  };
  t.deepEqual(
    [...linkObjects({ objects: [encodeObject(branch)], recipe: endOfBank }).output],
    [0x80, 0],
  );
  t.throws(
    () =>
      linkObjects({
        objects: [encodeObject(branch)],
        recipe: { ...endOfBank, symbols: [{ name: "Target", expression: constant(0xc10000) }] },
      }),
    { message: /another processor bank/ },
  );
  const spcWrap = {
    ...endOfBank,
    regions: [{ name: "ROM", start: 0xfffe, size: 2, outputOffset: 0 }],
    symbols: [{ name: "Target", expression: constant(2) }],
  };
  t.deepEqual(
    [...linkObjects({ objects: [encodeObject(branch)], recipe: spcWrap }).output],
    [0x80, 2],
  );
});

test("Buffer-backed object/archive readers and link identities retain owned snapshots", (t) => {
  const encoded = encodeObject(unit("buffer", [1, 2, 3]));
  const input = Buffer.from(encoded);
  const decoded = decodeObject(input);
  input[input.length - 1] = 99;
  t.deepEqual([...decoded.sections[0].bytes], [1, 2, 3]);
  const archive = Buffer.from(encodeLibrary([{ name: "member", object: encoded }]));
  const library = decodeLibrary(archive);
  archive.fill(0);
  t.deepEqual([...library.members[0].module.sections[0].bytes], [1, 2, 3]);
  const linkedInput = Buffer.from(encoded);
  const policy = { target: "tiny.raw", revision: "ownership-v1" };
  const baseline = linkObjects({ objects: [encoded], recipe, target: policy });
  const linked = linkObjects({
    objects: [linkedInput],
    recipe,
    target: {
      ...policy,
      validate() {
        linkedInput.fill(0);
      },
    },
  });
  t.is(linked.inputSha256, baseline.inputSha256);
  t.deepEqual(linked.output, baseline.output);
});

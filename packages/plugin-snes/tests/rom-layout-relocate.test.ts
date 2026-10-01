import { sourceContentHash } from "@uttori/asm-disassembler";

import { test } from "../../../tests/ava-helper.js";
import {
  assertSnesSplitReferences,
  encodeSnesRelocationReference,
  planSnesRelocation,
  type SnesMovableObject,
  type SnesRelocationReference,
} from "../src/disassembler/rom-layout/relocate.js";

/** Explicitly declared empty fixture storage; no capture or zero-byte heuristic establishes free space. */
function fixture() {
  const original = new Uint8Array(0x20000);
  original.set([0x00, 0x01, 0xc0, 4, 2]);
  const object: SnesMovableObject = {
    id: "table",
    originalStart: 0x100,
    originalEnd: 0x104,
    start: 0x100,
    length: 4,
    alignment: 2,
    bankSize: 0x10000,
    movable: true,
    referencesComplete: true,
    kind: "data",
  };
  const references: SnesRelocationReference[] = [
    { id: "pointer", target: "table", offset: 0, expected: [0, 1, 0xc0], encoding: "long24" },
    { id: "length", target: "table", offset: 3, expected: [4], encoding: "length8" },
    { id: "count", target: "table", offset: 4, expected: [2], encoding: "count8", unitSize: 2 },
  ];
  return {
    original,
    current: original.slice(),
    objects: [object],
    objectId: object.id,
    encodedLength: 6,
    references,
    freeSpace: [
      {
        id: "reserved",
        start: 0x200,
        end: 0x220,
        originalSha256: sourceContentHash(original.subarray(0x200, 0x220)),
      },
    ],
    logicalAddress: (offset: number) => 0xc00000 + offset,
  };
}

test("table growth allocates deterministically and repairs typed pointer, length, and count fields", (t) => {
  const input = fixture();
  const plan = planSnesRelocation(input);
  t.is(plan.destination, 0x200);
  t.deepEqual(
    plan.repairs.map((repair) => repair.after),
    [[0, 2, 0xc0], [6], [3]],
  );
  t.deepEqual(input.current, input.original);
  const moved = { ...input.objects[0]!, start: plan.destination, length: plan.encodedLength };
  const current = input.current.slice();
  for (const repair of plan.repairs) {
    current.set(repair.after, repair.offset);
  }
  const again = planSnesRelocation({
    ...input,
    current,
    objects: [moved],
    references: input.references.map((reference, index) => ({
      ...reference,
      expected: plan.repairs[index]!.after,
    })),
  });
  t.is(again.destination, plan.destination);
  t.deepEqual(
    again.repairs.map((repair) => repair.after),
    plan.repairs.map((repair) => repair.after),
  );
});

test("split long pointers move across banks only as a complete matching pair", (t) => {
  const input = fixture();
  const references: SnesRelocationReference[] = [
    {
      id: "offset",
      target: "table",
      offset: 0,
      expected: [0, 1],
      encoding: "low16",
      pair: "source",
    },
    { id: "bank", target: "table", offset: 2, expected: [0xc0], encoding: "bank8", pair: "source" },
  ];
  const plan = planSnesRelocation({
    ...input,
    references,
    freeSpace: [
      {
        id: "far",
        start: 0x10020,
        end: 0x10040,
        originalSha256: sourceContentHash(input.original.subarray(0x10020, 0x10040)),
      },
    ],
  });
  t.is(plan.destination, 0x10020);
  t.deepEqual(
    plan.repairs.map((repair) => repair.after),
    [[0x20, 0], [0xc1]],
  );
  for (const invalid of [
    references.slice(0, 1),
    [references[0], { ...references[1], addend: 1 }],
    [references[0], { ...references[1], target: "other" }],
    [references[0], { ...references[1], encoding: "low16" as const }],
  ]) {
    t.throws(() => assertSnesSplitReferences(invalid), { message: /Split pointer/ });
  }
  t.throws(() => encodeSnesRelocationReference({ ...references[0], addend: 1 }, 0xffffff, 2), {
    message: /address space/,
  });
});

test("allocations honor branch-specific occupied extents and reject ambiguous or changed inputs", (t) => {
  const input = fixture();
  const reserved = {
    ...input.objects[0]!,
    id: "other",
    originalStart: 0x300,
    originalEnd: 0x308,
    start: 0x200,
    length: 8,
  };
  t.is(planSnesRelocation({ ...input, objects: [...input.objects, reserved] }).destination, 0x208);
  t.throws(
    () =>
      planSnesRelocation({
        ...input,
        objects: [{ ...input.objects[0]!, referencesComplete: false }],
      }),
    { message: /complete reference/ },
  );
  t.throws(
    () => planSnesRelocation({ ...input, objects: [{ ...input.objects[0]!, kind: "code" }] }),
    { message: /closed code boundaries/ },
  );
  const current = input.current.slice();
  current[0x200] = 1;
  t.throws(() => planSnesRelocation({ ...input, current }), { message: /contains source edits/ });
  current[0x200] = 0;
  current[0] = 1;
  t.throws(() => planSnesRelocation({ ...input, current }), { message: /Reference changed/ });
});

test("bank and relative encodings stop instead of truncating or inserting trampolines", (t) => {
  const input = fixture();
  const freeSpace = [
    {
      id: "far",
      start: 0x10000,
      end: 0x10010,
      originalSha256: sourceContentHash(input.original.subarray(0x10000, 0x10010)),
    },
  ];
  t.throws(
    () =>
      planSnesRelocation({
        ...input,
        freeSpace,
        references: [
          {
            id: "near",
            target: "table",
            offset: 0,
            expected: [0, 1],
            encoding: "bank16",
            bank: 0xc0,
          },
        ],
      }),
    { message: /leave its declared bank/ },
  );
  t.throws(
    () =>
      planSnesRelocation({
        ...input,
        references: [
          {
            id: "branch",
            target: "table",
            offset: 0,
            expected: [0],
            encoding: "relative8",
            instructionEnd: 0xc00002,
          },
        ],
      }),
    { message: /cannot encode/ },
  );
  t.throws(() => planSnesRelocation({ ...input, encodedLength: 0x10002 }), {
    message: /No declared free extent/,
  });
});

test("placement searches past unreachable space and reserves every reference field", (t) => {
  const input = fixture();
  const freeSpace = [0x200, 0x10000].map((start) => ({
    id: `space-${start}`,
    start,
    end: start + 0x20,
    originalSha256: sourceContentHash(input.original.subarray(start, start + 0x20)),
  }));
  const near: SnesRelocationReference = {
    id: "near",
    target: "table",
    offset: 0,
    expected: [0, 1],
    encoding: "bank16",
    bank: 0xc1,
  };
  t.is(planSnesRelocation({ ...input, freeSpace, references: [near] }).destination, 0x10000);
  const field: SnesRelocationReference = {
    id: "field-in-free-space",
    target: "table",
    offset: 0x200,
    expected: [0, 0, 0],
    encoding: "long24",
  };
  const plan = planSnesRelocation({ ...input, references: [...input.references, field] });
  t.is(plan.destination, 0x204);
  t.deepEqual(plan.repairs.at(-1)!.after, [4, 2, 0xc0]);
  t.throws(
    () =>
      planSnesRelocation({ ...input, references: [{ ...near, encoding: "mystery" as "bank16" }] }),
    { message: /Invalid relocation reference/ },
  );
});

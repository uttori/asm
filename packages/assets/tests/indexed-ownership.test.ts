import { test } from "../../../tests/ava-helper.js";
import {
  reconcileIndexedViews,
  validateIndexedOwnership,
  type IndexedOwnership,
} from "../src/indexed-ownership.js";

/** Non-SNES geometry, duplicate owners, palette variants, an unused blank owner and opaque slot zero. */
function fixture(): IndexedOwnership {
  const indexes = Uint8Array.from({ length: 15 }, (_, i) => i % 3);
  return {
    owners: [
      { id: "tile-zero", width: 3, height: 5, indexes, allowedIndexes: [0, 1, 2] },
      { id: "duplicate", width: 3, height: 5, indexes: indexes.slice(), allowedIndexes: [0, 1, 2] },
      {
        id: "blank-unused",
        width: 3,
        height: 5,
        indexes: new Uint8Array(15).fill(2),
        allowedIndexes: [0, 1, 2],
      },
    ],
    views: [
      {
        id: "one",
        owner: "tile-zero",
        width: 3,
        height: 5,
        indexes: indexes.slice(),
        indexMap: [0, 1, 2],
      },
      {
        id: "variant",
        owner: "tile-zero",
        width: 3,
        height: 5,
        indexes: Uint8Array.from(indexes, (i) => i + 3),
        indexMap: [null, null, null, 0, 1, 2],
      },
      {
        id: "duplicate-view",
        owner: "duplicate",
        width: 3,
        height: 5,
        indexes: indexes.slice(),
        indexMap: [0, 1, 2],
      },
    ],
  };
}

test("unchanged views do not veto a palette-variant edit and duplicate-looking owners remain independent", (t) => {
  const baseline = fixture();
  const candidates = baseline.views.map((view) => ({ ...view, indexes: view.indexes.slice() }));
  candidates[1].indexes[0] = 4;
  const result = reconcileIndexedViews(baseline, candidates);
  t.is(result.length, 1);
  t.is(result[0].owner, "tile-zero");
  t.is(result[0].indexes[0], 1);
  t.is(baseline.owners[0].indexes[0], 0);
  t.deepEqual(reconcileIndexedViews(baseline, baseline.views), []);
});

test("equal changes coalesce, disjoint changes combine and contradictory changes identify both views", (t) => {
  const baseline = fixture();
  const candidates = baseline.views.map((view) => ({ ...view, indexes: view.indexes.slice() }));
  candidates[0].indexes[0] = 1;
  candidates[1].indexes[0] = 4;
  candidates[1].indexes[1] = 5;
  const result = reconcileIndexedViews(baseline, candidates);
  t.deepEqual([...result[0].indexes.subarray(0, 2)], [1, 2]);
  candidates[1].indexes[0] = 5;
  t.throws(() => reconcileIndexedViews(baseline, candidates), {
    message: /tile-zero pixel 0: conflicting views one and variant/,
  });
});

test("reflections normalize in pixel units and storage order is independent of authority", (t) => {
  const baseline = fixture();
  const reflected = {
    ...baseline.views[0],
    id: "reflected",
    flipX: true,
    flipY: true,
    indexes: baseline.views[0].indexes.slice().toReversed(),
  };
  const snapshot = { ...baseline, views: [...baseline.views, reflected] };
  const candidates = snapshot.views
    .map((view) => ({ ...view, indexes: view.indexes.slice() }))
    .toReversed();
  candidates[0].indexes[14] = 1;
  t.is(reconcileIndexedViews(snapshot, candidates)[0].indexes[0], 1);
});

test("missing, duplicate, inconsistent and unrepresentable identity records reject", (t) => {
  const baseline = fixture();
  t.throws(() => reconcileIndexedViews(baseline, baseline.views.slice(1)), {
    message: /inventory/,
  });
  t.throws(
    () =>
      reconcileIndexedViews(baseline, [baseline.views[0], baseline.views[0], baseline.views[2]]),
    { message: /duplicate view/ },
  );
  const candidates = baseline.views.map((view) => ({ ...view, indexes: view.indexes.slice() }));
  candidates[1].indexes[0] = 1;
  t.throws(() => reconcileIndexedViews(baseline, candidates), { message: /unmapped/ });
  t.throws(
    () =>
      validateIndexedOwnership({ ...baseline, owners: [...baseline.owners, baseline.owners[0]] }),
    { message: /Duplicate owner/ },
  );
  const alias = { ...baseline.views[0], indexMap: [0, 1, 2, 0] };
  const snapshot = { ...baseline, views: [alias] };
  const after = { ...alias, indexes: alias.indexes.slice() };
  after.indexes[0] = 3;
  t.throws(() => reconcileIndexedViews(snapshot, [after]), { message: /aliases the unchanged/ });
  const invalid = { ...baseline.views[0], indexes: new Uint8Array(15) };
  t.throws(() => validateIndexedOwnership({ ...baseline, views: [invalid] }), {
    message: /inconsistent private baseline/,
  });
});

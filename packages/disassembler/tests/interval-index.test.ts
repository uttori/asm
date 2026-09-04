import { test } from "../../../tests/ava-helper.js";
import { HalfOpenIntervalIndex } from "../src/index.js";

test("half-open interval index preserves input order across point and range lookup", (t) => {
  const values = [
    { id: "outer", start: 0, end: 20 },
    { id: "late-input", start: 8, end: 12 },
    { id: "early-start", start: 4, end: 10 },
    { id: "after", start: 20, end: 21 },
  ];
  const index = new HalfOpenIntervalIndex(values);

  t.deepEqual(
    index.at(9).map(({ id }) => id),
    ["outer", "late-input", "early-start"],
  );
  t.deepEqual(
    index.overlapping(10, 20).map(({ id }) => id),
    ["outer", "late-input"],
  );
  t.deepEqual(
    index.at(20).map(({ id }) => id),
    ["after"],
  );
  t.deepEqual(index.overlapping(21, 22), []);
});

test("half-open interval index rejects unsafe entries and queries", (t) => {
  t.throws(() => new HalfOpenIntervalIndex([{ start: 2, end: 2 }]), { message: /entries/ });
  const index = new HalfOpenIntervalIndex([{ start: 0, end: 1 }]);
  t.throws(() => index.at(-1), { message: /points/ });
  t.throws(() => index.overlapping(1, 1), { message: /queries/ });
});

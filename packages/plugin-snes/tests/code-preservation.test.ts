import { test } from "../../../tests/ava-helper.js";
import { lostCodeRanges } from "../src/disassembler/code-preservation.js";

test("code preservation reports lost intervals despite duplicate contexts and gains elsewhere", (t) => {
  t.deepEqual(
    lostCodeRanges(
      [
        { start: 5, end: 15 },
        { start: 0, end: 10 },
        { start: 0, end: 10 },
      ],
      [
        { start: 9, end: 11 },
        { start: 0, end: 3 },
        { start: 5, end: 9 },
        { start: 20, end: 100 },
      ],
    ),
    [
      { start: 3, end: 5 },
      { start: 11, end: 15 },
    ],
  );
});

test("code preservation accepts changed instruction boundaries and additions", (t) => {
  t.deepEqual(
    lostCodeRanges(
      [
        { start: 0, end: 3 },
        { start: 3, end: 5 },
      ],
      [
        { start: 0, end: 2 },
        { start: 2, end: 6 },
      ],
    ),
    [],
  );
  t.deepEqual(lostCodeRanges([], [{ start: 0, end: 5 }]), []);
  t.deepEqual(lostCodeRanges([{ start: 0, end: 5 }], []), [{ start: 0, end: 5 }]);
});

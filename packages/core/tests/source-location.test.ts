import { test } from "../../../tests/ava-helper.js";
import {
  createSourceSpan,
  createLineSpan,
  shiftSourceSpan,
  deriveTokenSpans,
  sourceSpanToRange,
} from "../src/source-location.js";

test("source spans shift offsets and optional columns without changing the original", (t) => {
  const span = createSourceSpan(2, 5, 3);
  t.deepEqual(shiftSourceSpan(span, -1), {
    start: 1,
    end: 4,
    line: 3,
    columnStart: 1,
    columnEnd: 4,
  });
  t.deepEqual(shiftSourceSpan({ start: 2, end: 5 }, 4, 8), {
    start: 6,
    end: 9,
    line: 8,
    columnStart: undefined,
    columnEnd: undefined,
  });
  t.deepEqual(span, createSourceSpan(2, 5, 3));
  t.deepEqual(createLineSpan("abc", 2), createSourceSpan(0, 3, 2));
});

test("token spans track repeats, empty tokens, and normalized tokens absent from source", (t) => {
  t.deepEqual(deriveTokenSpans("", []), []);
  t.deepEqual(deriveTokenSpans("  db db", ["db", "", "db", "missing"], 2), [
    createSourceSpan(2, 4, 2),
    createSourceSpan(4, 4, 2),
    createSourceSpan(5, 7, 2),
    createSourceSpan(7, 14, 2),
  ]);
});

test("editor ranges prefer explicit columns and use offsets and fallback lines when absent", (t) => {
  t.deepEqual(sourceSpanToRange({ start: 5, end: 8 }), {
    start: { line: 0, character: 5 },
    end: { line: 0, character: 8 },
  });
  t.deepEqual(sourceSpanToRange({ start: 5, end: 8 }, 4), {
    start: { line: 4, character: 5 },
    end: { line: 4, character: 8 },
  });
  t.deepEqual(sourceSpanToRange({ start: 5, end: 8, line: 2, columnStart: 1, columnEnd: 4 }, 9), {
    start: { line: 2, character: 1 },
    end: { line: 2, character: 4 },
  });
});

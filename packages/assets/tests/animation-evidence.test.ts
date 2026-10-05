import { test } from "../../../tests/ava-helper.js";
import {
  quantizeAnimationEvidence,
  type KnownAnimationSequence,
} from "../src/animation-evidence.js";

function sequence(): KnownAnimationSequence {
  return {
    id: "observed",
    provenance: { id: "capture-one", kind: "observation", source: "capture:one" },
    ticksPerSecond: { numerator: 60n, denominator: 1n },
    pivot: { x: -8, y: 3 },
    intervals: Array.from({ length: 60 }, (_, index) => ({
      pose: String(index),
      start: BigInt(index),
      end: BigInt(index + 1),
    })),
  };
}

test("cumulative rounding preserves a full rational second and provenance without drift", (t) => {
  const before = sequence(),
    runs = quantizeAnimationEvidence([before]);
  t.is(runs.length, 1);
  t.is(
    runs[0].frames.reduce((sum, frame) => sum + frame.durationMs, 0),
    1000,
  );
  t.deepEqual(
    runs[0].frames.slice(0, 3).map((frame) => frame.durationMs),
    [17, 16, 17],
  );
  t.deepEqual(runs[0].pivot, before.pivot);
  t.deepEqual(runs[0].provenance, before.provenance);
});

test("gaps split ranges and unknown terminal holds never become frames", (t) => {
  const before = sequence();
  const runs = quantizeAnimationEvidence([
    { ...before, intervals: [before.intervals[0], before.intervals[3]] },
  ]);
  t.is(runs.length, 2);
  t.deepEqual(
    runs.map((run) => run.frames.length),
    [1, 1],
  );
  t.deepEqual(quantizeAnimationEvidence([{ ...before, intervals: [] }]), []);
});

test("zero, overlapping, oversized and unbounded clock evidence rejects", (t) => {
  const before = sequence();
  for (const intervals of [
    [{ pose: "a", start: 0n, end: 0n }],
    [{ pose: "a", start: 0n, end: 100000n }],
    [
      { pose: "a", start: 2n, end: 3n },
      { pose: "b", start: 1n, end: 2n },
    ],
  ]) {
    t.throws(() => quantizeAnimationEvidence([{ ...before, intervals }]));
  }
  t.throws(
    () =>
      quantizeAnimationEvidence([
        { ...before, ticksPerSecond: { numerator: 100000n, denominator: 1n } },
      ]),
    { message: /quantized hold is zero/ },
  );
  t.throws(() => quantizeAnimationEvidence([before, before]), { message: /identity/ });
});

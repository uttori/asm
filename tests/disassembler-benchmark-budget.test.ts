import { test } from "./ava-helper.js";
import {
  assertDisassemblerBudgetEnvironment,
  deriveDisassemblerBenchmarkBudgets,
  evaluateDisassemblerBenchmarkBudgets,
  type DisassemblerBenchmarkBudgetReport,
} from "../scripts/disassembler-benchmark-budget.js";
import type { OperationBenchmarkAggregate } from "../scripts/benchmark-report.js";

const statistic = (value: number) => ({
  min: value,
  median: value,
  p95: value,
  max: value,
  medianAbsoluteDeviation: 0,
});

const aggregate = (wallMs: number, rssBytes: number): OperationBenchmarkAggregate => ({
  wallMs: statistic(wallMs),
  baselineRssBytes: statistic(rssBytes - 1),
  baselineHeapUsedBytes: statistic(1),
  endRssBytes: statistic(rssBytes),
  endHeapUsedBytes: statistic(2),
  boundaryMaxRssBytes: statistic(rssBytes),
  boundaryMaxHeapUsedBytes: statistic(2),
  rssDeltaBytes: statistic(1),
  heapUsedDeltaBytes: statistic(1),
});

const report = (wallMs = 100, rssBytes = 100 * 1_048_576): DisassemblerBenchmarkBudgetReport => ({
  suite: "uttori-asm-disassembler",
  environment: { node: "v26.8.1", platform: "darwin", arch: "arm64", cpuModel: "Fixture CPU" },
  benchmarks: [
    {
      fixture: { id: "fixture" },
      operations: [{ id: "analysis", aggregate: aggregate(wallMs, rssBytes) }],
    },
  ],
});

test("disassembler budgets are mechanically derived and host scoped", (t) => {
  const budgets = deriveDisassemblerBenchmarkBudgets(report(), {
    path: "baseline.json",
    sha256: "a".repeat(64),
  });

  t.is(budgets.fixtures[0].operations[0].maxMedianWallMs, 150);
  t.is(budgets.fixtures[0].operations[0].maxBoundaryRssBytes, 176 * 1_048_576);
  t.deepEqual(evaluateDisassemblerBenchmarkBudgets(report(149), budgets), []);
  t.throws(
    () =>
      assertDisassemblerBudgetEnvironment(
        { ...report(), environment: { ...report().environment, arch: "x64" } },
        budgets,
      ),
    { message: /environment mismatch for arch/ },
  );
});

test("disassembler budget evaluation reports time, memory, and missing limits", (t) => {
  const budgets = deriveDisassemblerBenchmarkBudgets(report(), {
    path: "baseline.json",
    sha256: "b".repeat(64),
  });
  const failed = report(151, 177 * 1_048_576);
  const missing = {
    ...failed,
    benchmarks: [
      ...failed.benchmarks,
      { fixture: { id: "other" }, operations: [{ id: "load", aggregate: aggregate(1, 1) }] },
    ],
  };

  t.deepEqual(
    evaluateDisassemblerBenchmarkBudgets(missing, budgets).map(({ metric }) => metric),
    ["median-wall-ms", "boundary-rss-bytes", "missing-budget"],
  );
});

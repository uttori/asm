import { test } from "../../../tests/ava-helper.js";
import { DisassemblyTimings, renderMaintenanceTimings } from "../src/disassembly-timings.js";

test("timings count worker stages once, preserve snapshots and retain failed processing", async (t) => {
  let now = 0;
  const timings = new DisassemblyTimings(() => now);
  const result = await timings.measure("Import", (record) => {
    record({ step: "Parse | validate\ntrace", durationMs: 1200, status: "completed" });
    now = 2000;
    return "imported";
  });
  t.is(result, "imported");
  const imported = timings.snapshot();
  const failure = new Error("Analysis rejected");
  t.is(
    await t.throwsAsync(
      timings.measure("Analysis", async (record) => {
        await Promise.resolve();
        record({ step: "Preserve code", durationMs: 500, status: "failed" });
        now = 3000;
        throw failure;
      }),
    ),
    failure,
  );
  const summary = timings.snapshot();
  t.is(imported.steps.length, 1);
  t.is(imported.totalMs, 2000);
  t.is(summary.totalMs, 3000, "child durations must not inflate the measured workflow total");
  t.deepEqual(
    summary.steps.map((step) => step.status),
    ["completed", "failed"],
  );
  const report = renderMaintenanceTimings(summary);
  t.true(report.includes("**3.000 s**"));
  t.true(report.includes("| Import | 2.000 s | 66.7% | completed |"));
  t.true(report.includes("| Analysis | 1.000 s | 33.3% | failed |"));
  t.true(report.includes("| Import | Parse \\| validate trace | 1.200 s | completed |"));
  t.true(report.includes("Slowest step: **Import**"));
});

test("timings retain cancellation and handle a zero-duration operation", async (t) => {
  const timings = new DisassemblyTimings(() => 42);
  const cancellation = Object.assign(new Error("Cancelled"), { name: "AbortError" });
  t.is(
    await t.throwsAsync(
      timings.measure("Verify", () => {
        throw cancellation;
      }),
    ),
    cancellation,
  );
  const summary = timings.snapshot();
  t.is(summary.steps[0].status, "cancelled");
  const report = renderMaintenanceTimings(summary);
  t.true(report.includes("| Verify | 0.0 ms | 0.0% | cancelled |"));
  t.false(report.includes("NaN"));
  t.false(report.includes("Infinity"));
});

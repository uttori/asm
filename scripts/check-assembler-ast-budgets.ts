import assert from "node:assert/strict";
import fs from "node:fs";

/** Budget reports are repository data, but malformed/missing measurements must fail closed. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function object(value: unknown): Record<string, unknown> {
  assert.ok(isRecord(value), "Expected a report object");
  return value;
}
function number(value: unknown): number {
  assert.ok(typeof value === "number" && Number.isFinite(value), "Expected a finite measurement");
  return value;
}
function string(value: unknown): string {
  assert.equal(typeof value, "string", "Expected a report identity");
  if (typeof value !== "string") {
    throw new Error("Invalid report identity");
  }
  return value;
}
function array(value: unknown): readonly unknown[] {
  assert.ok(Array.isArray(value), "Expected report samples");
  return value;
}

// This checker never writes budgets. Source/harness identity and byte parity precede timing gates.
const budget = object(
  JSON.parse(fs.readFileSync("docs/benchmarks/assembler-ast-b1/budgets.json", "utf8")),
);
const mode = process.argv[2];
let input = mode;
if (mode.startsWith("--")) {
  input = process.argv[3];
}
const report = object(JSON.parse(fs.readFileSync(input, "utf8")));
assert.equal(report.node ?? object(report.environment).node, budget.node, "Node version changed");
if (mode === "--production") {
  const baseline = object(
    JSON.parse(fs.readFileSync("docs/benchmarks/assembler-ast-b1/production.json", "utf8")),
  );
  assert.deepEqual(
    array(report.benchmarks)
      .map((entry) => string(object(entry).id))
      .toSorted(),
    Object.keys(object(budget.production)).toSorted(),
    "Missing production workloads",
  );
  for (const entry of array(report.benchmarks)) {
    const workload = object(entry);
    const id = string(workload.id);
    const gate = object(object(budget.production)[id]);
    const prior = object(array(baseline.benchmarks).find((value) => object(value).id === id));
    assert.equal(workload.sourceSha256, gate.inputSha256, id + " input drift");
    assert.deepEqual(object(workload.cold).actual, object(prior.cold).actual, id + " output drift");
    assert.ok(
      number(object(object(workload.aggregate).wallMs).median) <= number(gate.warmMedianMs),
      id + " warm gate",
    );
  }
} else if (mode === "--editor") {
  const baseline = object(
    JSON.parse(fs.readFileSync("docs/benchmarks/assembler-ast-b1/editor.json", "utf8")),
  );
  assert.equal(report.sourceSha256, baseline.sourceSha256, "editor input drift");
  assert.deepEqual(report.workload, baseline.workload, "editor configuration drift");
  assert.equal(
    array(report.samples).length,
    array(baseline.samples).length,
    "Missing editor samples",
  );
  for (const [key, limit] of Object.entries(object(budget.editor))) {
    for (const sample of array(report.samples)) {
      assert.ok(number(object(sample)[key]) <= number(limit), key + " editor gate");
    }
  }
} else if (mode === "--installed-plugin") {
  const baseline = object(
    JSON.parse(fs.readFileSync("docs/benchmarks/assembler-ast-b1/installed-plugin.json", "utf8")),
  );
  assert.equal(report.sourceSha256, baseline.sourceSha256, "installed plugin input drift");
  assert.equal(report.directives, baseline.directives);
  assert.equal(report.stages, baseline.stages);
  const gate = object(budget.installedPlugin);
  const times = array(report.wallMs).map(number);
  assert.equal(times.length, array(baseline.wallMs).length, "Missing installed plugin samples");
  const warm = times.slice(1).toSorted((a, b) => a - b);
  assert.ok(
    warm[Math.floor(warm.length / 2)] <= number(gate.warmMedianMs),
    "installed plugin warm gate",
  );
  assert.ok(times[0] <= number(gate.coldMs), "installed plugin cold gate");
  assert.ok(number(report.peakRssBytes) <= number(gate.peakRssBytes), "installed plugin RSS gate");
  assert.ok(
    number(report.retainedSyntaxBytes) <= number(gate.retainedSyntaxBytes),
    "installed plugin syntax gate",
  );
} else {
  assert.ok(!mode.startsWith("--"), "Unknown budget report kind");
  assert.equal(report.harnessSha256, budget.harnessSha256, "benchmark harness changed");
  assert.equal(report.node, budget.node, "Node version changed");
  assert.ok(number(report.peakRssBytes) <= number(budget.peakRssBytes), "process RSS exceeds gate");
  assert.deepEqual(
    array(report.workloads)
      .map((entry) => string(object(entry).name))
      .toSorted(),
    Object.keys(object(budget.workloads)).toSorted(),
    "Missing AST workloads",
  );
  for (const entry of array(report.workloads)) {
    const workload = object(entry);
    const name = string(workload.name);
    const gate = object(object(budget.workloads)[name]);
    const cold = object(array(workload.samples)[0]);
    assert.equal(workload.inputSha256, gate.inputSha256, name + " input drift");
    assert.equal(cold.sha256, gate.outputSha256, name + " output drift");
    const warmMs = number(object(workload.warm).medianMs);
    assert.ok(
      warmMs <= number(gate.warmMedianMs),
      `${name}: ${warmMs} > warm gate ${number(gate.warmMedianMs)}`,
    );
    assert.ok(number(cold.wallMs) <= number(gate.coldMs), `${name}: cold gate`);
    assert.ok(
      number(workload.retainedSyntaxBytes) <= number(gate.retainedSyntaxBytes),
      `${name}: syntax size gate`,
    );
  }
}
console.log("All fixed B1 budgets passed for " + input);

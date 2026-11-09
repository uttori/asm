import { test } from "../../../../tests/ava-helper.js";
import { summarizeSourceAnalysis } from "../../src/source/analysis-summary.js";

test("published capture coverage is distinct from bounded static call history", (t) => {
  const summary = summarizeSourceAnalysis({
    status: "incomplete",
    runtimePcsWithoutCode: 0,
    omittedRuntimeSeeds: 0,
    incompleteReasons: [
      { kind: "call-context-limit", address: 0x8000, limit: 2 },
      { kind: "call-context-limit", address: 0x8038, limit: 2 },
    ],
    conflicts: 13,
    unresolved: 4,
  });
  t.true(summary.warning);
  t.regex(summary.message, /published with static-analysis limits/);
  t.regex(summary.message, /All captured PCs have matching code/);
  t.regex(summary.details[0], /2 frames at 2 call sites/);
  t.regex(summary.details[0], /Exploration continued/);
  t.regex(summary.details[0], /return relationships may be incomplete/);
  t.regex(summary.details[1], /13 decode\/state conflicts/);
  t.regex(summary.details[2], /4 unresolved/);
});

test("work exhaustion and uncovered runtime PCs remain visible even with other depth diagnostics", (t) => {
  const summary = summarizeSourceAnalysis({
    status: "incomplete",
    runtimePcsWithoutCode: 3,
    omittedRuntimeSeeds: 5,
    incompleteReasons: [
      { kind: "call-context-limit", address: 0x8000, limit: 0 },
      { kind: "work-limit", address: 0x8038, limit: 100 },
    ],
  });
  t.true(summary.warning);
  t.regex(summary.message, /3 captured PCs still lack matching code/);
  t.regex(summary.message, /5 runtime seeds were omitted/);
  t.false(summary.message.includes("All captured PCs"));
  t.regex(summary.details[1], /stopped at 100 work items with pending work/);
});

test("optional target fields cannot imply capture coverage or erase an incomplete status", (t) => {
  const complete = summarizeSourceAnalysis({ status: "complete" });
  t.false(complete.warning);
  t.is(complete.message, "Analysis published.");
  const unknown = summarizeSourceAnalysis({
    status: "incomplete",
    runtimePcsWithoutCode: -1,
    incompleteReasons: [{ kind: "vendor-bound", address: 2, limit: 3 }],
  });
  t.true(unknown.warning);
  t.false(unknown.message.includes("All captured PCs"));
  t.regex(unknown.details[0], /vendor-bound/);
  t.regex(summarizeSourceAnalysis({ status: "incomplete" }).details[0], /full analysis report/);
  t.throws(() => summarizeSourceAnalysis({ status: "failed" }), {
    message: "Invalid source analysis response.",
  });
});

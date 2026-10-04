import { test } from "../../../../tests/ava-helper.js";
import { sourceWorkflow, type SourceWorkflowState } from "../../src/source/workflow.js";

test("regeneration offers only the next valid transition across evidence, checkpoint, merge and recovery", (t) => {
  const cases: [SourceWorkflowState, string | undefined][] = [
    [{ catalogReady: false, analysisReady: true }, "asm.source.catalog"],
    [{ analysisReady: false }, "asm.source.analyze"],
    [{ analysisReady: true }, "asm.source.prepare"],
    [{ candidate: true }, "asm.source.preview"],
    [{ candidate: true, previewed: true, dirty: true }, "workbench.view.scm"],
    [{ candidate: true, previewed: true, dirty: false }, "asm.source.apply"],
    [{ phase: "merging", conflicts: 1, unstaged: false }, "workbench.view.scm"],
    [{ phase: "merging", conflicts: 0, unstaged: true }, "workbench.view.scm"],
    [{ phase: "merging", conflicts: 0, unstaged: false, unsaved: true }, "workbench.view.scm"],
    [{ phase: "merging", conflicts: 0, unstaged: false }, "asm.source.finish"],
    [{ phase: "committed" }, "asm.source.finish"],
    [{ phase: "checkpoint", candidate: true }, "asm.source.preview"],
    [{ phase: "checkpoint", candidate: true, previewed: true, dirty: false }, "asm.source.apply"],
    [{ phase: "diverged" }, "workbench.view.scm"],
    [{ busy: "build", candidate: true }, undefined],
  ];
  for (const [state, command] of cases) {
    const steps = sourceWorkflow(state);
    t.is(steps.filter((step) => step.current).length, 1);
    t.is(steps.find((step) => step.current)?.command, command);
    if (
      !state.previewed ||
      state.dirty ||
      state.phase === "merging" ||
      state.phase === "committed"
    ) {
      t.false(steps.some((step) => step.command === "asm.source.apply"));
    }
    // Restart restores a candidate without a preview; it must never skip review or propose Prepare.
    if (state.candidate) {
      t.false(steps.some((step) => step.command === "asm.source.prepare"));
    }
    t.false(steps.some((step) => step.command === "asm.source.build"));
    if (state.phase === "merging" && command !== "asm.source.finish") {
      t.false(steps.some((step) => step.command === "asm.source.finish"));
    }
  }
});

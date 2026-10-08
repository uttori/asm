import type { SourceMergeStatus } from "@uttori/asm-disassembler";

/** Cached service/editor state used to render the next action without performing work in the tree. */
export interface SourceWorkflowState {
  readonly phase?: SourceMergeStatus["phase"];
  readonly dirty?: boolean;
  readonly analysisReady?: boolean;
  readonly analysisReason?: string;
  readonly catalogReady?: boolean;
  readonly catalogReason?: string;
  readonly unstaged?: boolean;
  /** Drafts must be saved before validating Git's staged merge. */
  readonly unsaved?: boolean;
  readonly candidate?: boolean;
  readonly previewed?: boolean;
  readonly conflicts?: number;
  readonly busy?: string;
}

/** A step without a command explains a prerequisite; it cannot accidentally launch out-of-order work. */
export interface SourceWorkflowStep {
  readonly label: string;
  readonly description: string;
  readonly command?: string;
  /** Exactly one step is the recommended next action, including a busy/recovery explanation. */
  readonly current?: boolean;
}

/** Native Git remains authoritative. Building edited source is independent of this regeneration sequence. */
export function sourceWorkflow(state: SourceWorkflowState): SourceWorkflowStep[] {
  if (state.busy) {
    return [
      {
        label: `Working · ${state.busy}`,
        description: "Wait for this operation to finish.",
        current: true,
      },
    ];
  }
  if (state.phase === "diverged") {
    return [
      {
        label: "Inspect Regeneration Recovery in Source Control",
        description:
          "Git changed outside the active merge. Inspect the branch and merge state before continuing.",
        command: "workbench.view.scm",
        current: true,
      },
    ];
  }
  if (state.phase === "merging") {
    const conflicts = state.conflicts ?? 0;
    const ready = conflicts === 0 && state.unstaged === false && !state.unsaved;
    return [
      {
        label: "5. Resolve and Stage Merge Changes",
        description: `${conflicts} unresolved conflicts. Save editors and stage the intended result in Source Control.`,
        command: "workbench.view.scm",
        current: !ready,
      },
      {
        label: "6. Validate and Finish Regeneration",
        description: "Builds the staged merge, validates it, and creates the merge commit.",
        command: ready ? "asm.source.finish" : undefined,
        current: ready,
      },
      {
        label: "Abort Regeneration",
        description: "Return to the saved checkpoint.",
        command: "asm.source.abort",
      },
    ];
  }
  if (state.phase === "committed") {
    return [
      {
        label: "6. Validate Committed Regeneration",
        description: "Validate the already committed merge before using it.",
        command: "asm.source.finish",
        current: true,
      },
    ];
  }
  const steps: SourceWorkflowStep[] = [];
  // Abort or a stopped pre-merge operation leaves a checkpoint journal without MERGE_HEAD.
  // It resumes through the ordinary preview/apply sequence; it is not a diverged Git branch.
  if (!state.candidate) {
    // Retained imports can precede adoption of the Git catalog. Reconcile identities explicitly;
    // refreshing status must never silently edit a tracked file or imply new source was generated.
    if (state.catalogReady === false) {
      return [
        {
          label: "Refresh Capture Catalog",
          description:
            state.catalogReason ?? "Record retained capture identities, then analyze and prepare.",
          command: "asm.source.catalog",
          current: true,
        },
      ];
    }
    steps.push({
      label: "1. Analyze Evidence",
      description: "Required after importing captures or changing analysis research.",
      command: "asm.source.analyze",
      current: state.analysisReady !== true,
    });
    if (state.analysisReady === false) {
      steps.push({
        label: "2. Prepare Regeneration · analysis required",
        description:
          state.analysisReason ??
          "Run Analyze Evidence first. Building does not update generated source.",
      });
    } else {
      steps.push({
        label: "2. Prepare Regeneration",
        description: "Generate a candidate from analyzed evidence; keeps current source edits.",
        command: "asm.source.prepare",
        current: state.analysisReady === true,
      });
    }
    return steps;
  }
  steps.push({
    label: "3. Preview with Current Edits",
    description: "Show file diffs for the proposed merge before applying or committing it.",
    command: "asm.source.preview",
    current: !state.previewed,
  });
  if (!state.previewed) {
    steps.push({
      label: "4. Apply · preview required",
      description:
        "Review the generated file diffs first. A clean checkout can apply using its existing commit.",
    });
  } else if (state.dirty) {
    steps.push({
      label: "4. Save and Commit Checkpoint",
      description:
        "Review Generation Preview first. Preserve existing local edits by saving and committing or moving them before Apply.",
      command: "workbench.view.scm",
      current: true,
    });
  } else {
    steps.push({
      label: "4. Apply Previewed Generation",
      description:
        "Apply the reviewed generation using the existing commit. Review and stage the result before Finish validates and commits it.",
      command: "asm.source.apply",
      current: true,
    });
  }
  steps.push({
    label: "Discard Candidate",
    description: "Release this candidate without changing source.",
    command: "asm.source.discard",
  });
  return steps;
}

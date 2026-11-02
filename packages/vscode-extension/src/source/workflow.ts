import type { SourceMergeStatus } from "@uttori/asm-disassembler/source-project";

/** Retire obsolete editor selections without hiding an active or unvalidated Git merge. */
export function shouldClearSourceCandidate(status: {
  readonly phase: SourceMergeStatus["phase"];
  readonly candidateAccepted: boolean;
  /** True when the candidate's parent differs from the checkout's accepted generation. */
  readonly candidateStale: boolean;
}): boolean {
  if (!["idle", "verified", "checkpoint"].includes(status.phase)) {
    return false;
  }
  return status.candidateStale || (status.candidateAccepted && status.phase !== "checkpoint");
}

/** Cached service/editor state used to render the next action without performing work in the tree. */
export interface SourceWorkflowState {
  /** Current native Git merge phase when known. */
  readonly phase?: SourceMergeStatus["phase"];
  /** Working tree differs from the last validated checkout state. */
  readonly dirty?: boolean;
  /** Analysis artifacts are ready for regeneration preview. */
  readonly analysisReady?: boolean;
  /** Human-readable blocker when analysis is not ready. */
  readonly analysisReason?: string;
  /** Catalog metadata is ready for regeneration preview. */
  readonly catalogReady?: boolean;
  /** Human-readable blocker when the catalog is not ready. */
  readonly catalogReason?: string;
  /** Unstaged edits remain outside the staged merge candidate. */
  readonly unstaged?: boolean;
  /** Drafts must be saved before validating Git's staged merge. */
  readonly unsaved?: boolean;
  /** A regeneration candidate exists in the worktree. */
  readonly candidate?: boolean;
  /** The latest candidate was previewed successfully. */
  readonly previewed?: boolean;
  /** Count of merge conflicts blocking integration. */
  readonly conflicts?: number;
  /** Active long-running operation label, when busy. */
  readonly busy?: string;
}

/** A step without a command explains a prerequisite; it cannot accidentally launch out-of-order work. */
export interface SourceWorkflowStep {
  /** Primary step title shown in the workflow tree. */
  readonly label: string;
  /** Supporting detail explaining prerequisites or outcomes. */
  readonly description: string;
  /** VS Code command id launched when the step is activated. */
  readonly command?: string;
  /** Exactly one step is the recommended next action, including a busy/recovery explanation. */
  readonly current?: boolean;
}

/** Published Home / status-bar / command-enablement projection of the legal workflow. */
export type SourceHealthKind =
  | "idle"
  | "needs-catalog"
  | "needs-analysis"
  | "needs-prepare"
  | "needs-preview"
  | "ready-to-apply"
  | "merging"
  | "finish"
  | "diverged"
  | "busy";

/** A recovery command that remains legal for the current source phase. */
export type SourceEscape = {
  command: "asm.source.abort" | "asm.source.discard" | "asm.source.clean" | "workbench.view.scm";
  label: string;
};

/** Compact health for Home, the status bar, and palette enablement. */
export type SourceHealth = {
  kind: SourceHealthKind;
  label: string;
  reason: string;
  next?: { command: string; title: string };
  escapes: SourceEscape[];
};

const HEALTH_BY_COMMAND: Record<string, SourceHealthKind> = {
  "asm.source.catalog": "needs-catalog",
  "asm.source.analyze": "needs-analysis",
  "asm.source.prepare": "needs-prepare",
  "asm.source.preview": "needs-preview",
  "asm.source.apply": "ready-to-apply",
  "asm.source.finish": "finish",
  "workbench.view.scm": "merging",
};

function workflowEscapes(workflow: readonly SourceWorkflowStep[]): SourceEscape[] {
  const commands = new Set(
    workflow.map((step) => step.command).filter((command): command is string => Boolean(command)),
  );
  const escapes: SourceEscape[] = [];
  if (commands.has("asm.source.abort")) {
    escapes.push({ command: "asm.source.abort", label: "Abort merge" });
  }
  if (commands.has("asm.source.discard")) {
    escapes.push({ command: "asm.source.discard", label: "Discard candidate" });
  }
  if (commands.has("asm.source.clean")) {
    escapes.push({ command: "asm.source.clean", label: "Clean leftover files" });
  }
  if (commands.has("workbench.view.scm")) {
    escapes.push({ command: "workbench.view.scm", label: "Open Source Control" });
  }
  return escapes;
}

/**
 * Projects legal workflow steps into a single health record.
 * Busy work hides Next so a second mutation cannot start while one is running.
 */
export function sourceHealth(
  workflow: readonly SourceWorkflowStep[],
  options: { busy?: string; phase?: SourceMergeStatus["phase"] } = {},
): SourceHealth {
  const next = workflow.find((step) => step.current);
  const escapes = workflowEscapes(workflow);
  if (options.busy) {
    return {
      kind: "busy",
      label: "Working",
      reason: options.busy,
      escapes: escapes.filter((escape) => escape.command === "asm.source.abort"),
    };
  }
  if (options.phase === "diverged") {
    return {
      kind: "diverged",
      label: next?.label ?? "Diverged",
      reason: next?.description ?? "HEAD moved during merge. Abort or finish in Source Control.",
      next: next?.command ? { command: next.command, title: next.label } : undefined,
      escapes,
    };
  }
  if (options.phase === "merging") {
    if (next?.command === "asm.source.finish") {
      return {
        kind: "finish",
        label: next.label,
        reason: next.description,
        next: { command: next.command, title: next.label },
        escapes,
      };
    }
    return {
      kind: "merging",
      label: next?.label ?? "Merge in progress",
      reason: next?.description ?? "Resolve conflicts, then finish.",
      next: next?.command ? { command: next.command, title: next.label } : undefined,
      escapes,
    };
  }
  if (!next) {
    return { kind: "idle", label: "Idle", reason: "Select a Git source project.", escapes };
  }
  return {
    kind: HEALTH_BY_COMMAND[next.command ?? ""] ?? "idle",
    label: next.label,
    reason: next.description,
    next: next.command ? { command: next.command, title: next.label } : undefined,
    escapes,
  };
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

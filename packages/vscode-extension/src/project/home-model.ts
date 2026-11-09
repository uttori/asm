import type {
  SourceBuildSummary,
  SourceMergeStatus,
} from "@uttori/asm-disassembler/source-project";

import type { BuildCoverageFreshness } from "../analysis/build-coverage.js";
import {
  sourceHealth,
  type SourceHealth,
  type SourceHealthKind,
  type SourceNextCommand,
  type SourceWorkflowStep,
} from "../source/workflow.js";

/** Activity-bar Home is source, ordinary assembly, or an empty workspace. */
export type ProjectMode = "source" | "assembly" | "none";

/** Webview and status-bar action bound to an existing command. */
export type HomeAction = {
  /** Existing VS Code command id. */
  command: string;
  /** Button or menu label. */
  title: string;
  /** Optional command arguments. */
  args?: unknown[];
};

/**
 * Target or architecture catalog option supplied by the language server; target entries may
 * advertise architecture/output defaults.
 */
export type CatalogEntry = {
  /** Canonical contribution ID written to settings. */
  id: string;
  /** Human-readable label; callers fall back to the ID when absent. */
  displayName?: string;
  /** Alternate IDs accepted for the same entry. */
  aliases?: string[];
  /** Architecture ID applied when this target is selected. */
  defaultArchitecture?: string;
  /** Output file extension, with or without a leading dot, applied to the build output on target change. */
  defaultOutputExtension?: string;
};

/**
 * Language-server status snapshot, including index counts, last-reindex milliseconds, and
 * effective project settings. Source projects ignore target/architecture here and read
 * `.uttori/project.json` instead.
 */
export type ProjectStatus = {
  /** Number of indexed source files. */
  fileCount: number;
  /** Number of indexed symbol definitions. */
  symbolCount: number;
  /** Number of indexed symbol references. */
  referenceCount: number;
  /** Number of error diagnostics across indexed files. */
  errorCount: number;
  /** Duration of the most recent reindex in milliseconds; absent before the first reindex. */
  lastReindexDurationMs?: number;
  /** How many roots were considered during the last reindex. */
  lastReindexRootCount: number;
  /** How many roots were served from disk or in-memory cache during the last reindex. */
  lastReindexCachedRoots: number;
  /** How many roots were freshly analyzed during the last reindex. */
  lastReindexAnalyzedRoots: number;
  /** Workspace-relative project configuration file; empty or absent when none is configured. */
  configFile?: string;
  /** Effective target contribution ID; empty when unset. */
  target?: string;
  /** Effective architecture ID; empty when unset. */
  architecture?: string;
  /** Configured build output path; empty when unset. */
  buildOutput?: string;
  /** Configured base ROM image path; empty when unset. */
  baseImage?: string;
  /** Configured entry-point files, relative to the workspace when inside it. */
  entryPoints: readonly string[];
  /** Configured include directories, relative to the workspace when inside it. */
  includePaths: readonly string[];
};

/**
 * Available target/architecture catalogs and active IDs used to populate and validate panel
 * selections.
 */
export type ProjectMetadata = {
  /** Target ID currently in effect. */
  activeTarget: string;
  /** Architecture ID currently in effect. */
  activeArchitecture: string;
  /** Selectable target contributions. */
  targets: CatalogEntry[];
  /** Selectable architecture contributions. */
  architectures: CatalogEntry[];
};

/** One generation-review file shown in Home Incoming; clicking opens the native diff editor. */
export type HomeIncomingFile = {
  /** Repository-relative path. */
  path: string;
  /** Git A/M/D status, or `predicted conflict`. */
  status: string;
  /** True when Preview reported an unmerged path. */
  conflict: boolean;
  /** Inserted lines from Git numstat, omitted for binary paths. */
  additions?: number;
  /** Deleted lines from Git numstat, omitted for binary paths. */
  deletions?: number;
  /** Left-side `uttori-source` URI. */
  left: string;
  /** Right-side `uttori-source` URI. */
  right: string;
  /** Native diff editor title. */
  title: string;
};

/** Compact original-ROM conversion progress for source Home. */
export type HomeCoverage = {
  /** Unique original ROM bytes still consumed through raw blocks. */
  remaining: number;
  /** Bytes represented by instructions, typed data, or converted assets. */
  converted: number;
  /** Original ROM size used as the denominator. */
  total: number;
  /** Remaining bytes as a percentage of the original ROM. */
  remainingPercent: number;
  /** Converted bytes as a percentage of the original ROM. */
  convertedPercent: number;
  /** Saved-input verification status. */
  freshness: "current" | "stale" | "checking" | "unknown";
  /** Human-readable freshness explanation. */
  reason: string;
};

/** Host-test projection that replaced tree-label scraping. */
export type SourceHomeProjection = {
  /** Legal Next command when one exists. */
  next?: SourceNextCommand;
  /** Workflow commands currently offered plus Build. */
  commands: string[];
  /** `verified` or `source changed` after a source build. */
  build?: string;
  /** Prepared generation commit, when a candidate exists. */
  candidate?: string;
  /** Incoming review completeness and preview state for host smokes. */
  incoming: SourceHomeIncoming;
};

/** Incoming review completeness and preview state for host smokes. */
export type SourceHomeIncoming = {
  /** True after a successful Preview of the current candidate. */
  previewed: boolean;
  /** Total changed files in the generation. */
  total: number;
  /** Number of paths actually exposed to review, equal to total. */
  shown: number;
  /** Retained for host compatibility; the complete list is always expanded. */
  collapsed: boolean;
};

/** Last source-build freshness shown on Home. */
export type HomeBuildStatus = {
  /** `verified` or `source changed`. */
  description: string;
};

/** Language-server index totals shown in Home Health. */
export type HomeIndexHealth = {
  /** Indexed assembly files. */
  files: number;
  /** Indexed symbol definitions. */
  symbols: number;
  /** Indexed symbol references. */
  references: number;
  /** Current assembly and configuration errors. */
  errors: number;
  /** Last reindex duration, when known. */
  lastIndexed?: string;
};

/** Merged index and conversion health. */
export type HomeHealth = {
  /** Language-server index totals; zeros until the server is running. */
  index: HomeIndexHealth;
  /** Original-ROM conversion progress for source projects. */
  coverage?: HomeCoverage;
  /** Configured assembly output path. */
  outputPath?: string;
};

/** Recovery banner shown for merge, diverge, busy, or checkpoint blocks. */
export type HomeRecovery = {
  /** Health kind that selected this banner. */
  kind: string;
  /** Left stripe: info, blocked, or merging. */
  stripe: "info" | "blocked" | "merging";
  /** Banner title. */
  label: string;
  /** Plain-language recovery instructions. */
  reason: string;
  /** Primary escape or Next action. */
  primary?: HomeAction;
  /** Remaining legal escapes. */
  secondary: HomeAction[];
};

/** Compact regeneration stepper shown under Next. */
export type HomeStep = {
  /** Stable step id. */
  id: string;
  /** Analyze / Prepare / Preview / Apply / Finish. */
  label: string;
  /** Visual state relative to the current health kind. */
  state: "done" | "current" | "todo";
};

/** Complete generation review; every changed path is available before and after Preview. */
export type HomeIncoming = {
  /** True after a successful Preview of the current candidate. */
  previewed: boolean;
  /** Total changed files in the generation. */
  total: number;
  /** Number of reviewable files, equal to total. */
  shown: number;
  /** All reviewable files in Git order. The webview bounds their scroll area, not their count. */
  files: HomeIncomingFile[];
};

/** Capture row for a source project. Import is always present; record actions follow the session. */
export type HomeCapture = {
  /** Recorder phase. */
  phase: string;
  /** Human-readable phase label. */
  label: string;
  /** Start/stop/import actions for the current phase. */
  actions: HomeAction[];
};

/** Collapsed assembly settings copied from `asm.*` configuration. */
export type HomeAssemblySettings = {
  /** Selectable target contributions. */
  targets: CatalogEntry[];
  /** Selectable architecture contributions. */
  architectures: CatalogEntry[];
  /** Effective target id. */
  target: string;
  /** Effective architecture id. */
  architecture: string;
  /** Configured build output path. */
  output: string;
  /** Configured entry-point files. */
  entryPoints: readonly string[];
  /** Configured include directories. */
  includePaths: readonly string[];
};

/** Empty-workspace welcome actions. */
export type HomeWelcome = {
  /** Welcome heading. */
  title: string;
  /** Short explanation. */
  detail: string;
  /** Create / Select / Init actions. */
  actions: HomeAction[];
};

/** One snapshot drives Home, the status bar, and source command enablement. */
export type HomeSnapshot = {
  /** Detected project mode; source wins over leftover `asm.*` settings. */
  mode: ProjectMode;
  /** Workspace trust; settings and mutations stay disabled until trusted. */
  trusted: boolean;
  /** Project id, folder name, or workspace name. */
  name: string;
  /** Current Git branch for a source project. */
  branch?: string;
  /** Working tree or unsaved buffers differ from HEAD. */
  dirty?: boolean;
  /** Target contribution id. */
  target?: string;
  /** Architecture contribution id. */
  architecture?: string;
  /** Display name for the target, falling back to SNES/NES. */
  targetLabel?: string;
  /** Display name for the architecture. */
  architectureLabel?: string;
  /** True after a successful `asm/status` round-trip. */
  indexReady: boolean;
  /** Language-server or workspace-settings fallback status. */
  status: ProjectStatus;
  /** Catalog metadata when the language server is running. */
  metadata?: ProjectMetadata;
  /** Merged index and conversion health. */
  health: HomeHealth;
  /** Recovery banner when the workflow is blocked or merging. */
  recovery?: HomeRecovery;
  /** Legal Next command for source projects. */
  next?: HomeAction;
  /** Compact Analyze → Finish stepper. */
  steps?: HomeStep[];
  /** Incoming generation files after Prepare. */
  incoming?: HomeIncoming;
  /** Capture controls. Import is present for every source project. */
  capture?: HomeCapture;
  /** Demoted power-user actions. */
  more: HomeAction[];
  /** Assembly settings form, omitted in source mode. */
  assembly?: HomeAssemblySettings;
  /** Empty-workspace welcome. */
  welcome?: HomeWelcome;
  /** Watch toggle state for assembly Home. */
  watch: boolean;
  /** `uttori.sourcePhase` context key. */
  sourcePhase: string;
  /** Prepared generation commit. */
  candidate?: string;
  /** `uttori.canAbort` context key. */
  canAbort: boolean;
  /** `uttori.canDiscard` context key. */
  canDiscard: boolean;
  /** Last source-build freshness. */
  build?: HomeBuildStatus;
  /** Legal workflow commands plus Build, for host smokes. */
  commands: string[];
};

/** Saved conversion totals used by Home before a background freshness check finishes. */
export type HomeSourceCoverage = {
  /** Compact build summary from `.uttori-local/builds/summary.json`. */
  summary: SourceBuildSummary;
  /** Saved-input verification status. */
  freshness: BuildCoverageFreshness;
  /** True when the selected source build is already known stale. */
  staleBuild?: boolean;
};

/** Disk and session facts Home can render before the language server is running. */
export type HomeSourceInput = {
  /** Absolute source project root. */
  root: string;
  /** Project id or folder name. */
  name: string;
  /** Current Git branch. */
  branch: string;
  /** Working tree or unsaved buffers differ from HEAD. */
  dirty: boolean;
  /** `.uttori/project.json` target id. */
  target: string;
  /** Prepared generation commit. */
  candidate?: string;
  /** True when Preview matches the current candidate. */
  previewed: boolean;
  /** Running foreground operation label. */
  busy?: string;
  /** Native Git merge phase. */
  phase?: SourceMergeStatus["phase"];
  /** Legal workflow steps for this session. */
  workflow: readonly SourceWorkflowStep[];
  /** Incoming review files, possibly thousands. */
  incoming: readonly HomeIncomingFile[];
  /** Recorder phase. */
  capturePhase: string;
  /** True during an ares/Uttori debug session. */
  debugging?: boolean;
  /** `verified` or `source changed`. */
  buildDescription?: string;
  /** Optional conversion totals. */
  coverage?: HomeSourceCoverage;
};

/** Inputs that never wait on LSP; index/catalog are progressive enhancement. */
export type HomeSnapshotInput = {
  /** Workspace trust. */
  trusted: boolean;
  /** Assembly watch toggle. */
  watch: boolean;
  /** VS Code workspace name. */
  workspaceName?: string;
  /** Language-server or fallback status. */
  status: ProjectStatus;
  /** Catalog metadata when available. */
  metadata?: ProjectMetadata;
  /** True after a successful `asm/status` round-trip. */
  indexReady: boolean;
  /** Selected Git source session, when one exists. */
  source?: HomeSourceInput;
};

const STEPPER: { id: string; label: string; kinds: readonly SourceHealthKind[] }[] = [
  { id: "analyze", label: "Analyze", kinds: ["needs-catalog", "needs-analysis"] },
  { id: "prepare", label: "Prepare", kinds: ["needs-prepare"] },
  { id: "preview", label: "Preview", kinds: ["needs-preview"] },
  { id: "apply", label: "Apply", kinds: ["ready-to-apply"] },
  { id: "finish", label: "Finish", kinds: ["merging", "finish", "diverged"] },
];

const STEP_ORDER: readonly SourceHealthKind[] = [
  "needs-catalog",
  "needs-analysis",
  "needs-prepare",
  "needs-preview",
  "ready-to-apply",
  "merging",
  "finish",
  "diverged",
];

const SOURCE_MORE: HomeAction[] = [
  { command: "asm.source.research", title: "Open declarations" },
  { command: "asm.source.editResearch", title: "Edit symbol research" },
  { command: "asm.source.editAnalysis", title: "Edit analysis research" },
  { command: "asm.source.relocate", title: "Relocate object" },
  { command: "asm.source.expand", title: "Expand ROM capacity" },
  { command: "asm.asset.export", title: "Export asset" },
  { command: "asm.asset.review", title: "Review saved asset" },
  { command: "asm.asset.apply", title: "Apply reviewed asset" },
  { command: "asm.source.catalog", title: "Refresh capture catalog" },
  { command: "asm.source.migrate", title: "Migrate to linked sources" },
  { command: "asm.source.clean", title: "Clean leftover files" },
  { command: "asm.source.select", title: "Select source project" },
];

/** Human-readable target/architecture label from catalog metadata, with SNES/NES fallbacks. */
function catalogLabel(
  id: string,
  entries: readonly CatalogEntry[] | undefined,
  fallback: string,
): string {
  if (!id) {
    return fallback;
  }
  const entry = entries?.find((item) => item.id === id);
  if (entry?.displayName) {
    return entry.displayName;
  }
  if (id.startsWith("snes.")) {
    return id.includes("65816") ? "65C816" : "SNES";
  }
  if (id.startsWith("65xx.")) {
    return "NES";
  }
  return id;
}

/** Project saved conversion totals into Home Health, marking session-stale builds explicitly. */
function coverageFrom(input: HomeSourceInput["coverage"]): HomeCoverage | undefined {
  const coverage = input?.summary.coverage;
  if (!coverage) {
    return undefined;
  }
  const total = coverage.totalBytes;
  const remaining = coverage.remainingBytes;
  const converted = coverage.convertedBytes;
  const freshness = input.staleBuild
    ? { status: "stale" as const, reason: "Source changed since the last successful build." }
    : input.freshness;
  return {
    remaining,
    converted,
    total,
    remainingPercent: total === 0 ? 0 : (remaining / total) * 100,
    convertedPercent: total === 0 ? 0 : (converted / total) * 100,
    freshness: freshness.status,
    reason: freshness.reason,
  };
}

/** Compact Analyze → Finish stepper derived from the current health kind. */
function stepper(kind: SourceHealthKind): HomeSnapshot["steps"] {
  if (kind === "idle" || kind === "busy") {
    return STEPPER.map((step) => ({ id: step.id, label: step.label, state: "todo" }));
  }
  const currentIndex = STEPPER.findIndex((step) => step.kinds.includes(kind));
  const kindIndex = STEP_ORDER.indexOf(kind);
  return STEPPER.map((step, index) => {
    if (index === currentIndex) {
      return { id: step.id, label: step.label, state: "current" };
    }
    const stepKindIndex = Math.min(...step.kinds.map((item) => STEP_ORDER.indexOf(item)));
    return {
      id: step.id,
      label: step.label,
      state: kindIndex > stepKindIndex ? "done" : "todo",
    };
  });
}

/** Recovery banner for merge, diverge, busy, or checkpoint blocks; omitted for ordinary Next. */
function recoveryCard(health: SourceHealth): HomeSnapshot["recovery"] {
  const blocked =
    health.kind === "merging" ||
    health.kind === "diverged" ||
    health.next?.command === "workbench.view.scm";
  if (
    health.kind !== "busy" &&
    health.kind !== "merging" &&
    health.kind !== "finish" &&
    health.kind !== "diverged" &&
    health.next?.command !== "workbench.view.scm"
  ) {
    return undefined;
  }
  const secondary = health.escapes.map((escape) => ({
    command: escape.command,
    title: escape.label,
  }));
  let primary: HomeAction | undefined;
  if (health.next) {
    primary = { command: health.next.command, title: health.next.title };
  } else if (secondary.length > 0) {
    primary = secondary[0];
  }
  let stripe: HomeRecovery["stripe"] = "merging";
  if (health.kind === "busy") {
    stripe = "info";
  } else if (blocked) {
    stripe = "blocked";
  }
  if (!primary) {
    return {
      kind: health.kind,
      stripe,
      label: health.label,
      reason: health.reason,
      secondary,
    };
  }
  return {
    kind: health.kind,
    stripe,
    label: health.label,
    reason: health.reason,
    primary,
    secondary: secondary.filter((action) => action.command !== primary.command),
  };
}

/** Import stays available without a debugger. Record controls require an ares session or an active capture. */
function captureCard(source: HomeSourceInput): HomeSnapshot["capture"] {
  const phase = source.capturePhase;
  const actions: HomeAction[] = [];
  if (phase === "idle" && source.debugging) {
    actions.push({ command: "asm.trace.start", title: "Start capture" });
  } else if (phase === "recording") {
    actions.push(
      { command: "asm.trace.stop", title: "Stop capture" },
      { command: "asm.trace.stopAnalyze", title: "Stop and import" },
    );
  }
  actions.push({ command: "asm.source.importCapture", title: "Import captures" });
  const labels: Record<string, string> = {
    idle: source.debugging ? "Ready to record" : "Saved captures",
    starting: "Starting capture",
    recording: "Recording",
    finalizing: "Finalizing capture",
  };
  return { phase, label: labels[phase] ?? phase, actions };
}

/** Source identity wins over leftover assembly settings in the same workspace. */
function detectMode(input: HomeSnapshotInput): ProjectMode {
  if (input.source?.root) {
    return "source";
  }
  const { status } = input;
  if (status.target || status.architecture || status.configFile || status.buildOutput) {
    return "assembly";
  }
  return "none";
}

/**
 * Compose Home from disk/session facts plus optional LSP index and catalog.
 * Source identity never depends on `asm.target`.
 */
export function buildHomeSnapshot(input: HomeSnapshotInput): HomeSnapshot {
  const mode = detectMode(input);
  const { status, metadata, indexReady } = input;
  const source = input.source;
  const workflow = source?.workflow ?? [];
  const health = sourceHealth(workflow, { busy: source?.busy, phase: source?.phase });
  const commands = [
    ...new Set(
      workflow.map((step) => step.command).filter((command): command is string => Boolean(command)),
    ),
  ];
  if (source?.root) {
    commands.push("asm.source.build");
  }
  const target = source?.target || status.target || metadata?.activeTarget || "";
  const architecture = status.architecture || metadata?.activeArchitecture || "";
  const name = source?.name || input.workspaceName || (mode === "none" ? "No project" : "Assembly");
  const incomingFiles = source?.incoming ?? [];
  const snapshot: HomeSnapshot = {
    mode,
    trusted: input.trusted,
    name,
    branch: source?.branch,
    dirty: source?.dirty,
    target,
    architecture,
    targetLabel: catalogLabel(target, metadata?.targets, ""),
    architectureLabel: catalogLabel(architecture, metadata?.architectures, ""),
    indexReady,
    status,
    metadata,
    health: {
      index: {
        files: status.fileCount,
        symbols: status.symbolCount,
        references: status.referenceCount,
        errors: status.errorCount,
        lastIndexed:
          status.lastReindexDurationMs == null ? undefined : `${status.lastReindexDurationMs} ms`,
      },
      coverage: mode === "source" ? coverageFrom(source?.coverage) : undefined,
      outputPath: mode === "assembly" ? status.buildOutput || undefined : undefined,
    },
    recovery: mode === "source" ? recoveryCard(health) : undefined,
    next:
      mode === "source" && health.next
        ? { command: health.next.command, title: health.next.title }
        : undefined,
    steps: mode === "source" && source?.root ? stepper(health.kind) : undefined,
    incoming:
      mode === "source" && source?.candidate
        ? {
            previewed: source.previewed,
            total: incomingFiles.length,
            shown: incomingFiles.length,
            files: [...incomingFiles],
          }
        : undefined,
    capture: source ? captureCard(source) : undefined,
    more: mode === "source" ? SOURCE_MORE : [],
    assembly:
      mode === "assembly"
        ? {
            targets: metadata?.targets ?? [],
            architectures: metadata?.architectures ?? [],
            target: status.target ?? "",
            architecture: status.architecture ?? "",
            output: status.buildOutput ?? "",
            entryPoints: status.entryPoints,
            includePaths: status.includePaths,
          }
        : undefined,
    welcome:
      mode === "none"
        ? {
            title: "Get started",
            detail: "Create a Git source project or initialize an assembly config.",
            actions: [
              { command: "asm.source.init", title: "Create Git source project" },
              { command: "asm.source.select", title: "Select source project" },
              { command: "asm.initConfig", title: "Initialize assembly config" },
            ],
          }
        : undefined,
    watch: input.watch,
    sourcePhase: mode === "source" ? health.kind : "",
    candidate: source?.candidate,
    canAbort: health.escapes.some((escape) => escape.command === "asm.source.abort"),
    canDiscard: health.escapes.some((escape) => escape.command === "asm.source.discard"),
    build: source?.buildDescription ? { description: source.buildDescription } : undefined,
    commands,
  };
  return snapshot;
}

/** Host-test shape that replaced Source Project tree-label scraping. */
export function sourceHomeProjection(snapshot: HomeSnapshot): SourceHomeProjection {
  return {
    next: snapshot.next,
    commands: snapshot.commands,
    build: snapshot.build?.description,
    candidate: snapshot.candidate,
    incoming: {
      previewed: snapshot.incoming?.previewed ?? false,
      total: snapshot.incoming?.total ?? 0,
      shown: snapshot.incoming?.shown ?? 0,
      collapsed: false,
    },
  };
}

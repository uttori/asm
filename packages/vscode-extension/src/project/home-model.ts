import type {
  SourceBuildSummary,
  SourceMergeStatus,
} from "@uttori/asm-disassembler/source-project";

import type { BuildCoverageFreshness } from "../analysis/build-coverage.js";
import {
  sourceHealth,
  type SourceHealth,
  type SourceHealthKind,
  type SourceWorkflowStep,
} from "../source/workflow.js";

/** Activity-bar Home is source, ordinary assembly, or an empty workspace. */
export type ProjectMode = "source" | "assembly" | "none";

/** Webview and status-bar action bound to an existing command. */
export type HomeAction = {
  command: string;
  title: string;
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
  path: string;
  status: string;
  conflict: boolean;
  additions?: number;
  deletions?: number;
  left: string;
  right: string;
  title: string;
};

/** Compact original-ROM conversion progress for source Home. */
export type HomeCoverage = {
  remaining: number;
  converted: number;
  total: number;
  remainingPercent: number;
  convertedPercent: number;
  freshness: "current" | "stale" | "checking" | "unknown";
  reason: string;
};

/** Host-test projection that replaced tree-label scraping. */
export type SourceHomeProjection = {
  next?: { command: string; title: string };
  commands: string[];
  build?: string;
  candidate?: string;
  incoming: { previewed: boolean; total: number; collapsed: boolean };
};

/** One snapshot drives Home, the status bar, and source command enablement. */
export type HomeSnapshot = {
  mode: ProjectMode;
  trusted: boolean;
  name: string;
  branch?: string;
  dirty?: boolean;
  target?: string;
  architecture?: string;
  targetLabel?: string;
  architectureLabel?: string;
  indexReady: boolean;
  status: ProjectStatus;
  metadata?: ProjectMetadata;
  health: {
    index: {
      files: number;
      symbols: number;
      references: number;
      errors: number;
      lastIndexed?: string;
    };
    coverage?: HomeCoverage;
    outputPath?: string;
  };
  recovery?: {
    kind: string;
    stripe: "info" | "blocked" | "merging";
    label: string;
    reason: string;
    primary?: HomeAction;
    secondary: HomeAction[];
  };
  next?: HomeAction;
  steps?: { id: string; label: string; state: "done" | "current" | "todo" }[];
  incoming?: {
    previewed: boolean;
    total: number;
    shown: number;
    files: HomeIncomingFile[];
  };
  capture?: { phase: string; label: string; actions: HomeAction[] };
  more: HomeAction[];
  assembly?: {
    targets: CatalogEntry[];
    architectures: CatalogEntry[];
    target: string;
    architecture: string;
    output: string;
    entryPoints: readonly string[];
    includePaths: readonly string[];
  };
  welcome?: { title: string; detail: string; actions: HomeAction[] };
  watch: boolean;
  sourcePhase: string;
  candidate?: string;
  canAbort: boolean;
  canDiscard: boolean;
  build?: { description: string };
  commands: string[];
};

/** Disk and session facts Home can render before the language server is running. */
export type HomeSourceInput = {
  root: string;
  name: string;
  branch: string;
  dirty: boolean;
  target: string;
  candidate?: string;
  previewed: boolean;
  busy?: string;
  phase?: SourceMergeStatus["phase"];
  workflow: readonly SourceWorkflowStep[];
  incoming: readonly HomeIncomingFile[];
  capturePhase: string;
  debugging?: boolean;
  buildDescription?: string;
  coverage?: {
    summary: SourceBuildSummary;
    freshness: BuildCoverageFreshness;
    staleBuild?: boolean;
  };
};

/** Inputs that never wait on LSP; index/catalog are progressive enhancement. */
export type HomeSnapshotInput = {
  trusted: boolean;
  watch: boolean;
  workspaceName?: string;
  status: ProjectStatus;
  metadata?: ProjectMetadata;
  indexReady: boolean;
  source?: HomeSourceInput;
};

const INCOMING_PAGE = 8;

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

function catalogLabel(id: string, entries: readonly CatalogEntry[] | undefined, fallback: string): string {
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
  const primary = health.next
    ? { command: health.next.command, title: health.next.title }
    : secondary[0];
  return {
    kind: health.kind,
    stripe: health.kind === "busy" ? "info" : blocked ? "blocked" : "merging",
    label: health.label,
    reason: health.reason,
    primary,
    secondary: secondary.filter((action) => action.command !== primary?.command),
  };
}

function captureCard(source: HomeSourceInput): HomeSnapshot["capture"] {
  const phase = source.capturePhase;
  if (phase === "idle" && !source.debugging) {
    return undefined;
  }
  const actions: HomeAction[] = [];
  if (phase === "idle") {
    actions.push({ command: "asm.trace.start", title: "Start capture" });
  } else if (phase === "recording") {
    actions.push(
      { command: "asm.trace.stop", title: "Stop capture" },
      { command: "asm.trace.stopAnalyze", title: "Stop and import" },
    );
  }
  actions.push({ command: "asm.source.importCapture", title: "Import captures" });
  const labels: Record<string, string> = {
    idle: "Ready to record",
    starting: "Starting capture",
    recording: "Recording",
    finalizing: "Finalizing capture",
  };
  return { phase, label: labels[phase] ?? phase, actions };
}

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
    ...new Set(workflow.map((step) => step.command).filter((command): command is string => Boolean(command))),
  ];
  if (source?.root) {
    commands.push("asm.source.build");
  }
  const target = source?.target || status.target || metadata?.activeTarget || "";
  const architecture = status.architecture || metadata?.activeArchitecture || "";
  const name =
    source?.name ||
    input.workspaceName ||
    (mode === "none" ? "No project" : "Assembly");
  const incomingFiles = source?.incoming ?? [];
  const shown = source?.previewed ? incomingFiles.slice(0, INCOMING_PAGE) : [];
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
    next: mode === "source" ? (health.next ? { command: health.next.command, title: health.next.title } : undefined) : undefined,
    steps: mode === "source" && source?.root ? stepper(health.kind) : undefined,
    incoming:
      mode === "source" && source?.candidate
        ? {
            previewed: source.previewed,
            total: incomingFiles.length,
            shown: shown.length,
            files: [...shown],
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
      collapsed: !(snapshot.incoming?.previewed ?? false),
    },
  };
}

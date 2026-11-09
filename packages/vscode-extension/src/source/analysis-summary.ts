/** User-facing outcome of a published analysis; bounded static exploration can still cover every captured PC. */
export interface SourceAnalysisSummary {
  /** Publication and coverage outcome shown in the completion notification. */
  readonly message: string;
  /** True when static exploration or captured-code coverage has a reported limitation. */
  readonly warning: boolean;
  /** Compact diagnostics for Output; the complete worker result belongs in the saved report. */
  readonly details: readonly string[];
}

/** Accept target-specific report fields only when they are plain records. */
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Counts are optional for third-party targets; absent or invalid counts cannot prove capture coverage. */
function count(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

/**
 * Separate publication success, static bounds and captured-code coverage without hiding diagnostics.
 * Unknown target fields stay in the full report and never imply complete capture coverage.
 */
export function summarizeSourceAnalysis(value: unknown): SourceAnalysisSummary {
  if (!record(value) || (value.status !== "complete" && value.status !== "incomplete")) {
    throw new Error("Invalid source analysis response.");
  }
  const details: string[] = [];
  let message = "Analysis published.";
  let warning = value.status === "incomplete";
  if (warning) {
    message = "Analysis published with static-analysis limits.";
  }
  const missing = count(value.runtimePcsWithoutCode);
  if (missing === 0) {
    message += " All captured PCs have matching code.";
  } else if (missing !== undefined) {
    warning = true;
    message += ` ${missing.toLocaleString("en-US")} captured PCs still lack matching code.`;
  }
  const omitted = count(value.omittedRuntimeSeeds);
  if (omitted !== undefined && omitted > 0) {
    warning = true;
    message += ` ${omitted.toLocaleString("en-US")} runtime seeds were omitted.`;
  }

  // A depth bound trims older call history and continues traversal. A work bound leaves
  // pending work unexplored; grouping them as one generic failure misstates both outcomes.
  const groups = new Map<string, { kind: string; limit: number; sites: Set<number> }>();
  for (const reason of Array.isArray(value.incompleteReasons) ? value.incompleteReasons : []) {
    if (!record(reason) || typeof reason.kind !== "string") {
      continue;
    }
    const limit = count(reason.limit);
    const address = count(reason.address);
    if (limit === undefined || address === undefined) {
      continue;
    }
    const key = `${reason.kind}:${limit}`;
    const group = groups.get(key) ?? { kind: reason.kind, limit, sites: new Set<number>() };
    group.sites.add(address);
    groups.set(key, group);
  }
  for (const { kind, limit, sites } of groups.values()) {
    if (kind === "call-context-limit") {
      details.push(
        `Static call history was limited to ${limit} frames at ${sites.size.toLocaleString("en-US")} call sites. Exploration continued with older frames discarded; deeper caller/return relationships may be incomplete. Configured by limits.analysisCallDepth.`,
      );
    } else if (kind === "work-limit") {
      details.push(
        `Static exploration stopped at ${limit.toLocaleString("en-US")} work items with pending work. Review limits.analysisWorkItems before increasing the budget.`,
      );
    } else {
      details.push(`Static-analysis limitation ${kind}: ${sites.size} sites, limit ${limit}.`);
    }
  }
  if (value.status === "incomplete" && details.length === 0) {
    details.push(
      "Static exploration is incomplete. Review the full analysis report for target-specific limitations.",
    );
  }
  const conflicts = count(value.conflicts);
  const unresolved = count(value.unresolved);
  if (conflicts !== undefined) {
    details.push(
      `${conflicts.toLocaleString("en-US")} decode/state conflicts retained for review.`,
    );
  }
  if (unresolved !== undefined) {
    details.push(
      `${unresolved.toLocaleString("en-US")} unresolved control-flow sites retained for review.`,
    );
  }
  return { message, warning, details };
}

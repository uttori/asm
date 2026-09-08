import { createHash } from "node:crypto";
import { buildAnalysisCallGraph } from "./analysis-graph.js";
import { canonicalJson } from "./project-store.js";
import type { AnalysisProject, AnalysisProjectShards } from "./project-types.js";
import { mergeRuntimeEvidence, type RuntimeEvidenceMergeResult } from "./runtime-evidence.js";
import {
  validateRuntimeInstructionTrace,
  type RuntimeInstructionTraceArtifact,
} from "./runtime-trace.js";

export const BEHAVIOR_CAPTURE_FORMAT = "uttori-asm-behavior-capture" as const;
export const MAX_CAPTURE_EVENTS = 1_000_000;
export const MAX_CAPTURE_TOTAL_EVENTS = 2_000_000;
export const MAX_CAPTURE_WINDOWS = 9;
export const MAX_CAPTURE_MILLISECONDS = 60_000;
export const MAX_CAPTURE_FILE_BYTES = 128 * 1024 * 1024;

/** Build identities are immutable for the lifetime of the recording debug session. */
export interface BehaviorCaptureIdentity {
  readonly target: string;
  readonly binarySha256: string;
  readonly debugMapFingerprint: string;
  readonly project?: { readonly romContentSha256: string; readonly manifestSha256: string };
}

/** Address stops include the matching event; source/label choices resolve to these addresses. */
export type BehaviorCaptureStop =
  | { readonly kind: "manual" | "breakpoint" | "elapsed" | "instruction-limit" }
  | {
      readonly kind: "address";
      readonly addresses: readonly number[];
      readonly description: string;
    };

export type BehaviorCaptureStopReason =
  | BehaviorCaptureStop["kind"]
  | "session-ended"
  | "producer-stopped"
  | "error";

/** An instruction-observation window, not an emulator save state or a causal slice. */
export interface BehaviorCaptureWindow {
  readonly role: "baseline" | "action";
  readonly label: string;
  readonly startedAt: string;
  readonly elapsedMilliseconds: number;
  readonly limits: { readonly maxEvents: number; readonly maxMilliseconds: number };
  readonly stop: BehaviorCaptureStop;
  readonly stopReason: BehaviorCaptureStopReason;
  readonly excludedPolledEvents: number;
  readonly trace: RuntimeInstructionTraceArtifact;
}

/** Self-contained, bounded inputs; rankings are always recomputed, never trusted from disk. */
export interface BehaviorCaptureArtifact {
  readonly format: typeof BEHAVIOR_CAPTURE_FORMAT;
  readonly schemaVersion: 1;
  readonly identity: BehaviorCaptureIdentity;
  readonly windows: readonly BehaviorCaptureWindow[];
}

export interface BehaviorCandidate {
  readonly address: number;
  readonly actionCount: number;
  readonly baselineCount: number;
  readonly baselineWindows: number;
  readonly actionRate: number;
  readonly maximumBaselineRate: number;
  readonly enrichment: number | null;
  readonly classification: "action-only" | "enriched" | "shared";
  readonly score: number;
  readonly newIncomingTransitions: readonly number[];
  readonly explanation: string;
}

/** Sequential PC observations, deliberately not certified call/control-flow targets. */
export interface BehaviorTransition {
  readonly from: number;
  readonly to: number;
  readonly count: number;
  readonly baselineCount: number;
}

export interface BehaviorFunctionGroup {
  readonly id: string;
  readonly name: string;
  readonly addresses: readonly number[];
  readonly score: number;
  readonly actionSpecificEntries: readonly BehaviorTransition[];
}

export interface BehaviorCaptureReview {
  readonly captureSha256: string;
  readonly label: string;
  readonly candidates: readonly BehaviorCandidate[];
  readonly transitions: readonly BehaviorTransition[];
  readonly functions: readonly BehaviorFunctionGroup[];
  readonly warnings: readonly string[];
  readonly observedEvents: number;
  readonly droppedEvents: number;
}

const digest = (value: unknown): string =>
  createHash("sha256").update(canonicalJson(value)).digest("hex");
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Capture field must be an object.");
  return value as Record<string, unknown>;
};
const text = (value: unknown): string => {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.length > 512 ||
    value
      .split("")
      .some((char) => char.charCodeAt(0) < 32 || char === "\u2028" || char === "\u2029")
  )
    throw new Error("Capture text must be a nonempty single line of at most 512 characters.");
  return value;
};
const hash = (value: unknown): string => {
  if (typeof value !== "string" || !/^[\da-f]{64}$/.test(value))
    throw new Error("Capture identity must be a lowercase SHA-256.");
  return value;
};
const integer = (value: unknown, min: number, max: number): number => {
  if (!Number.isSafeInteger(value) || (value as number) < min || (value as number) > max)
    throw new Error(`Capture integer must be between ${min} and ${max}.`);
  return value as number;
};

/**
 * Parses a capture with event limits before interpreting its trace chunks.
 * @param {unknown} value Untrusted capture.
 * @returns {BehaviorCaptureArtifact} Normalized capture.
 */
export const validateBehaviorCapture = (value: unknown): BehaviorCaptureArtifact => {
  const root = object(value);
  if (root.format !== BEHAVIOR_CAPTURE_FORMAT || root.schemaVersion !== 1)
    throw new Error("Unsupported behavior capture format/version.");
  const rawIdentity = object(root.identity);
  const rawProject = rawIdentity.project === undefined ? undefined : object(rawIdentity.project);
  const identity: BehaviorCaptureIdentity = {
    target: text(rawIdentity.target),
    binarySha256: hash(rawIdentity.binarySha256),
    debugMapFingerprint: hash(rawIdentity.debugMapFingerprint),
    ...(rawProject
      ? {
          project: {
            romContentSha256: hash(rawProject.romContentSha256),
            manifestSha256: hash(rawProject.manifestSha256),
          },
        }
      : {}),
  };
  if (identity.project && identity.project.romContentSha256 !== identity.binarySha256)
    throw new Error("Capture ROM/project mismatch.");
  if (
    !Array.isArray(root.windows) ||
    root.windows.length < 1 ||
    root.windows.length > MAX_CAPTURE_WINDOWS
  )
    throw new Error("Capture requires 1–9 windows (at most eight baselines and one action).");
  let totalCaptureEvents = 0;
  const windows = root.windows.map((raw): BehaviorCaptureWindow => {
    const window = object(raw);
    if (window.role !== "baseline" && window.role !== "action")
      throw new Error("Invalid capture window role.");
    const limits = object(window.limits);
    const maxEvents = integer(limits.maxEvents, 1, MAX_CAPTURE_EVENTS);
    const maxMilliseconds = integer(limits.maxMilliseconds, 1, MAX_CAPTURE_MILLISECONDS);
    const stop = object(window.stop);
    const kinds = ["manual", "breakpoint", "elapsed", "instruction-limit", "address"];
    if (!kinds.includes(String(stop.kind))) throw new Error("Invalid capture stop condition.");
    const parsedStop: BehaviorCaptureStop =
      stop.kind === "address"
        ? {
            kind: "address",
            description: text(stop.description),
            addresses: (() => {
              if (
                !Array.isArray(stop.addresses) ||
                !stop.addresses.length ||
                stop.addresses.length > 1024
              )
                throw new Error("Address stop requires 1–1024 addresses.");
              return [
                ...new Set(stop.addresses.map((address) => integer(address, 0, 0xff_ffff))),
              ].sort((a, b) => a - b);
            })(),
          }
        : { kind: stop.kind as "manual" | "breakpoint" | "elapsed" | "instruction-limit" };
    if (
      ![...kinds, "session-ended", "producer-stopped", "error"].includes(String(window.stopReason))
    )
      throw new Error("Invalid capture stop reason.");
    const traceRaw = object(window.trace);
    if (!Array.isArray(traceRaw.chunks) || traceRaw.chunks.length > maxEvents + 1)
      throw new Error("Capture has too many trace chunks.");
    let total = 0;
    for (const rawChunk of traceRaw.chunks) {
      const chunk = object(rawChunk);
      if (!Array.isArray(chunk.addresses)) throw new Error("Invalid capture addresses.");
      total += chunk.addresses.length;
      totalCaptureEvents += chunk.addresses.length;
      if (totalCaptureEvents > MAX_CAPTURE_TOTAL_EVENTS)
        throw new Error("Capture exceeds the combined two-million-event limit.");
      if (total > maxEvents) throw new Error("Capture exceeds its instruction limit.");
      for (const address of chunk.addresses) integer(address, 0, 0xff_ffff);
    }
    const trace = validateRuntimeInstructionTrace(traceRaw);
    if (trace.romContentSha256 !== identity.binarySha256)
      throw new Error("Capture trace/build mismatch.");
    const startedAt = text(window.startedAt);
    if (!Number.isFinite(Date.parse(startedAt)))
      throw new Error("Invalid capture start timestamp.");
    return {
      role: window.role,
      label: text(window.label),
      startedAt,
      elapsedMilliseconds: integer(window.elapsedMilliseconds, 0, Number.MAX_SAFE_INTEGER),
      limits: { maxEvents, maxMilliseconds },
      stop: parsedStop,
      stopReason: window.stopReason as BehaviorCaptureStopReason,
      excludedPolledEvents: integer(window.excludedPolledEvents, 0, Number.MAX_SAFE_INTEGER),
      trace,
    };
  });
  const actions = windows.filter(({ role }) => role === "action");
  if (actions.length > 1 || windows.filter(({ role }) => role === "baseline").length > 8)
    throw new Error("Capture supports at most eight baselines and one action.");
  const streamIdentity = (window: BehaviorCaptureWindow): string =>
    canonicalJson({
      architecture: window.trace.architecture,
      addressSpace: window.trace.addressSpace,
      producer: window.trace.producer,
    });
  if (windows.some((window) => streamIdentity(window) !== streamIdentity(windows[0])))
    throw new Error("Capture windows describe different processors or emulator revisions.");
  if (new Set(windows.map(digest)).size !== windows.length)
    throw new Error("Duplicate capture windows are not independent baselines.");
  return { format: BEHAVIOR_CAPTURE_FORMAT, schemaVersion: 1, identity, windows };
};

const profile = (window: BehaviorCaptureWindow) => {
  const counts = new Map<number, number>();
  const transitions = new Map<string, { from: number; to: number; count: number }>();
  let previous: number | undefined;
  let nextSequence = 1;
  let total = 0;
  for (const chunk of window.trace.chunks) {
    if (chunk.sequenceStart !== nextSequence) previous = undefined;
    for (const address of chunk.addresses) {
      counts.set(address, (counts.get(address) ?? 0) + 1);
      if (previous !== undefined) {
        const key = `${previous}:${address}`;
        const entry = transitions.get(key) ?? { from: previous, to: address, count: 0 };
        entry.count++;
        transitions.set(key, entry);
      }
      previous = address;
      total++;
    }
    nextSequence = chunk.sequenceStart + chunk.addresses.length;
  }
  return { counts, transitions, total };
};

/**
 * Deterministic differential execution profiles; scores are heuristics, not probabilities.
 * @param {unknown} value Untrusted capture.
 * @param {AnalysisProjectShards} [shards] Optional static ownership facts.
 * @returns {BehaviorCaptureReview} Ranked observations and limitations.
 */
export const reviewBehaviorCapture = (
  value: unknown,
  shards?: AnalysisProjectShards,
): BehaviorCaptureReview => {
  const capture = validateBehaviorCapture(value);
  const action = capture.windows.find(({ role }) => role === "action");
  const baselines = capture.windows.filter(({ role }) => role === "baseline");
  if (!action || baselines.length === 0)
    throw new Error("Review requires one action and at least one idle baseline.");
  const active = profile(action);
  const idle = baselines.map(profile);
  if (!active.total || idle.some(({ total }) => !total))
    throw new Error("Action and all baseline windows must contain instruction events.");
  const transitions: BehaviorTransition[] = [...active.transitions.entries()]
    .map(([key, edge]) => ({
      ...edge,
      baselineCount: idle.reduce((sum, base) => sum + (base.transitions.get(key)?.count ?? 0), 0),
    }))
    .sort((a, b) => a.from - b.from || a.to - b.to);
  const incoming = new Map<number, number[]>();
  for (const edge of transitions)
    if (!edge.baselineCount) {
      const addresses = incoming.get(edge.to) ?? [];
      addresses.push(edge.from);
      incoming.set(edge.to, addresses);
    }
  const candidates: BehaviorCandidate[] = [...active.counts]
    .map(([address, actionCount]): BehaviorCandidate => {
      const baselineCount = idle.reduce((sum, base) => sum + (base.counts.get(address) ?? 0), 0);
      const baselineWindows = idle.filter((base) => base.counts.has(address)).length;
      const maximumBaselineRate = Math.max(
        ...idle.map((base) => (base.counts.get(address) ?? 0) / base.total),
      );
      const actionRate = actionCount / active.total;
      const enrichment = maximumBaselineRate ? actionRate / maximumBaselineRate : null;
      let classification: BehaviorCandidate["classification"] = "shared";
      if (baselineCount === 0) classification = "action-only";
      else if (enrichment! >= 2 && actionCount >= 3) classification = "enriched";
      const score = baselineCount === 0 ? 1 : Math.max(0, 1 - maximumBaselineRate / actionRate);
      return {
        address,
        actionCount,
        baselineCount,
        baselineWindows,
        actionRate,
        maximumBaselineRate,
        enrichment,
        classification,
        score,
        newIncomingTransitions: incoming.get(address) ?? [],
        explanation: `${classification}: ${actionCount} action / ${baselineCount} idle observations in ${baselineWindows}/${baselines.length} baseline windows; ${enrichment === null ? "absent from observed idle" : `${enrichment.toFixed(2)}× maximum idle instruction share`}.`,
      };
    })
    .sort((a, b) => b.score - a.score || b.actionCount - a.actionCount || a.address - b.address);
  const groups: BehaviorFunctionGroup[] = [];
  if (shards) {
    const entries = new Map<number, BehaviorTransition[]>();
    for (const edge of transitions)
      if (!edge.baselineCount) {
        const observed = entries.get(edge.to) ?? [];
        observed.push(edge);
        entries.set(edge.to, observed);
      }
    const nodes = new Map(
      shards.analysis.flatMap((record) =>
        record.kind === "cfg-node" && record.addressSpace === action.trace.addressSpace
          ? [[record.id, record.address] as const]
          : [],
      ),
    );
    const byAddress = new Map(candidates.map((candidate) => [candidate.address, candidate]));
    for (const fn of buildAnalysisCallGraph(shards).functions) {
      if (fn.addressSpace !== action.trace.addressSpace) continue;
      const addresses = [
        ...new Set([
          fn.address,
          ...fn.nodeIds.flatMap((id) => (nodes.has(id) ? [nodes.get(id)!] : [])),
        ]),
      ]
        .filter((address) => byAddress.has(address))
        .sort((a, b) => a - b);
      if (!addresses.length) continue;
      groups.push({
        id: fn.id,
        name: fn.labels.map(({ name }) => name).join(" / ") || fn.id,
        addresses,
        score: addresses.reduce(
          (maximum, address) => Math.max(maximum, byAddress.get(address)!.score),
          0,
        ),
        actionSpecificEntries: entries.get(fn.address) ?? [],
      });
    }
  }
  const droppedEvents = capture.windows.reduce(
    (sum, window) => sum + (window.trace.chunks.at(-1)?.droppedEvents ?? 0),
    0,
  );
  const warnings = [
    "Feature association is not causality. Shared input/render/audio/interrupt code remains visible. PC transitions are not certified calls or indirect targets.",
  ];
  if (droppedEvents)
    warnings.push(
      `${droppedEvents} producer events lost: absence and frequency scores may be biased; transitions across gaps were excluded.`,
    );
  if (
    capture.windows.some(
      (window) =>
        window.trace.chunks.at(-1)?.active !== false ||
        ["error", "session-ended"].includes(window.stopReason),
    )
  )
    warnings.push(
      "At least one window is incomplete; recapture before drawing strong conclusions.",
    );
  if (baselines.length === 1)
    warnings.push(
      "Only one idle window: capture multiple independent idle windows to reduce false positives.",
    );
  if (action.trace.producer.id === "debug-map-replay")
    warnings.push("Synthetic replay is a workflow test, not evidence of real game behavior.");
  return {
    captureSha256: digest(capture),
    label: action.label,
    candidates,
    transitions,
    functions: groups.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)),
    warnings,
    observedEvents: capture.windows.reduce(
      (sum, window) =>
        sum + window.trace.chunks.reduce((count, chunk) => count + chunk.addresses.length, 0),
      0,
    ),
    droppedEvents,
  };
};

/**
 * Adds reviewed comments and execution; existing facts/targets are never replaced.
 * @param {AnalysisProject} project Current validated project.
 * @param {unknown} value Untrusted capture.
 * @param {readonly number[]} selectedAddresses Explicitly reviewed action instructions.
 * @returns {RuntimeEvidenceMergeResult} Merge ready for an optimistic transaction.
 */
export const applyBehaviorCapture = (
  project: AnalysisProject,
  value: unknown,
  selectedAddresses: readonly number[],
): RuntimeEvidenceMergeResult => {
  const capture = validateBehaviorCapture(value);
  if (
    !capture.identity.project ||
    capture.identity.project.romContentSha256 !== project.manifest.rom.contentSha256 ||
    capture.identity.binarySha256 !== project.manifest.rom.contentSha256 ||
    capture.identity.target !== project.manifest.target
  )
    throw new Error(
      "Capture ROM/project mismatch: annotation requires its original native project identity.",
    );
  const review = reviewBehaviorCapture(capture, project.shards);
  const action = capture.windows.find(({ role }) => role === "action")!;
  const space = project.manifest.addressSpaces.find(({ id }) => id === action.trace.addressSpace);
  if (!space || review.candidates.some(({ address }) => address >= 2 ** space.addressBits))
    throw new Error("Capture address space does not match the project.");
  const byAddress = new Map(review.candidates.map((candidate) => [candidate.address, candidate]));
  const selected = [...new Set(selectedAddresses)].sort((a, b) => a - b);
  if (!selected.length || selected.some((address) => !byAddress.has(address)))
    throw new Error("Select at least one observed action instruction to annotate.");
  const evidenceId = `runtime:behavior:${review.captureSha256}`;
  const windows = capture.windows.map((window) => ({
    window,
    sha256: digest(window),
    profile: profile(window),
  }));
  return mergeRuntimeEvidence(project.shards, {
    runtime: windows.flatMap(({ window, sha256, profile: observed }) =>
      [...observed.counts].map(([address, count]) => ({
        id: `runtime:behavior-window:${sha256}:${address}`,
        kind: "runtime-execution" as const,
        architecture: window.trace.architecture,
        addressSpace: window.trace.addressSpace,
        address,
        count,
        evidence: [`runtime:behavior-window:${sha256}`],
      })),
    ),
    evidence: [
      ...windows.map(({ window, sha256, profile: observed }) => ({
        id: `runtime:behavior-window:${sha256}`,
        source: "runtime" as const,
        sourceId: `${window.trace.producer.id}:${window.trace.producer.revision}`,
        confidence: "high" as const,
        detail: `${window.role}: ${observed.total} observed; ${window.trace.chunks.at(-1)?.droppedEvents ?? 0} dropped; stop=${window.stopReason}.`,
        artifact: {
          format: "uttori-asm-behavior-window",
          formatVersion: "1",
          sha256,
          romContentSha256: capture.identity.binarySha256,
        },
      })),
      {
        id: evidenceId,
        source: "runtime",
        sourceId: "differential-execution-profile-v1",
        confidence: "low",
        detail: `Reviewed association with '${review.label}', not causal proof. ${review.warnings.join(" ")}`,
        artifact: {
          format: BEHAVIOR_CAPTURE_FORMAT,
          formatVersion: "1",
          sha256: review.captureSha256,
          romContentSha256: capture.identity.binarySha256,
        },
      },
    ],
    comments: selected.map((address) => {
      const candidate = byAddress.get(address)!;
      return {
        id: `${evidenceId}:comment:${address}`,
        addressSpace: action.trace.addressSpace,
        address,
        text: `[Behavior: ${review.label}] Candidate association; score=${candidate.score.toFixed(3)}. ${candidate.explanation} Capture=${review.captureSha256}.`,
        evidence: [evidenceId],
      };
    }),
  });
};

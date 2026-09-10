import { createHash, randomUUID } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

import type { DebugMap } from "@uttori/asm-core/debug-map";
import {
  BEHAVIOR_CAPTURE_FORMAT,
  BehaviorCaptureRecorder,
  MAX_CAPTURE_FILE_BYTES,
  MAX_CAPTURE_EVENTS,
  MAX_CAPTURE_TOTAL_EVENTS,
  MAX_CAPTURE_MILLISECONDS,
  canonicalJson,
  parseAnalysisProjectManifest,
  validateBehaviorCapture,
  reviewBehaviorCapture,
  applyBehaviorCapture,
  loadAnalysisProjectSnapshot,
  commitAnalysisProjectTransaction,
  compactAnalysisProject,
  type BehaviorCaptureArtifact,
  type BehaviorCaptureIdentity,
  type BehaviorCaptureStop,
  type BehaviorCaptureReview,
  type AnalysisProjectManifest,
} from "@uttori/asm-disassembler";
import {
  Uri,
  commands,
  debug,
  window,
  workspace,
  type DebugSession,
  type Disposable,
} from "vscode";

import { runBehaviorCaptureDemo } from "./behavior-capture-demo.js";
import { BEHAVIOR_CAPTURE_GUIDE } from "./behavior-capture-guide.js";
import { findAnalysisProjectDirectories } from "./coverage-tree.js";
import { REGENERATE_DISASSEMBLY_COMMAND, behaviorEntrySeeds } from "./disassembly-maintenance.js";
import type { EditorTraceBatch, EditorTraceMetadata } from "./runtime-trace-recorder.js";
import { acquireTraceLease } from "./trace-lease.js";

export interface BehaviorSessionContext {
  readonly map: DebugMap;
  readonly sourceRoot: string;
  readonly producer: EditorTraceMetadata["producer"];
}

interface TraceCapability {
  readonly instructionDetails?: boolean;
  readonly architecture: string;
  readonly addressSpace: string;
  readonly maxBatchEvents: number;
}
interface CaptureHost {
  readonly context: (session: DebugSession) => BehaviorSessionContext | undefined;
  readonly refresh: () => void;
}
interface ActiveCapture {
  readonly session: DebugSession;
  readonly recorder: BehaviorCaptureRecorder;
  readonly breakpointStop: boolean;
}

const isLocalWorkspaceProject = (directory: string): boolean => {
  const real = fs.realpathSync(directory);
  return (workspace.workspaceFolders ?? []).some((folder) => {
    if (folder.uri.scheme !== "file") return false;
    const relative = path.relative(fs.realpathSync(folder.uri.fsPath), real);
    return (
      relative === "" ||
      (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))
    );
  });
};

const readCapture = (file: string): BehaviorCaptureArtifact => {
  if (fs.statSync(file).size > MAX_CAPTURE_FILE_BYTES)
    throw new Error("Capture file exceeds the 128 MiB safety limit.");
  return validateBehaviorCapture(JSON.parse(fs.readFileSync(file, "utf8")));
};
const hexadecimal = (address: number): string =>
  `$${address.toString(16).toUpperCase().padStart(6, "0")}`;
const plain = (value: string): string =>
  value
    .split("")
    .map((char) => ("\\`*{}[]<>&|!#\r\n".includes(char) ? "_" : char))
    .join("");

const selectProject = async (
  binarySha256: string,
  target: string,
): Promise<
  { directory: string; manifest: AnalysisProjectManifest; manifestSha256: string } | undefined
> => {
  // Capture setup needs identity only. Never parse every project's large shards on the UI thread.
  const matches = (
    await Promise.all(
      (await findAnalysisProjectDirectories())
        .filter(isLocalWorkspaceProject)
        .map(async (directory) => {
          try {
            const bytes = await fs.promises.readFile(path.join(directory, "analysis.json"));
            const manifest = parseAnalysisProjectManifest(JSON.parse(bytes.toString("utf8")));
            return manifest.rom.contentSha256 === binarySha256 && manifest.target === target
              ? [
                  {
                    directory,
                    manifest,
                    manifestSha256: createHash("sha256").update(bytes).digest("hex"),
                  },
                ]
              : [];
          } catch {
            return [];
          }
        }),
    )
  ).flat();
  if (matches.length < 2) return matches[0];
  return (
    await window.showQuickPick(
      matches.map((project) => ({
        label: path.basename(project.directory),
        description: project.directory,
        project,
      })),
      { title: "Choose the matching analysis project" },
    )
  )?.project;
};

const numberInput = async (
  title: string,
  value: number,
  max: number,
): Promise<number | undefined> => {
  const input = await window.showInputBox({
    title,
    value: String(value),
    validateInput: (raw) =>
      /^\d+$/.test(raw) && Number(raw) >= 1 && Number(raw) <= max
        ? undefined
        : `Enter an integer from 1 to ${max}.`,
  });
  return input === undefined ? undefined : Number(input);
};

const chooseStop = async (
  context: BehaviorSessionContext,
  trace: TraceCapability,
  projectDirectory?: string,
): Promise<BehaviorCaptureStop | undefined> => {
  const kind = await window.showQuickPick(
    [
      { label: "Manual stop", stopKind: "manual" },
      { label: "Elapsed time", stopKind: "elapsed" },
      { label: "Instruction count", stopKind: "instruction-limit" },
      { label: "Existing breakpoint", stopKind: "breakpoint" },
      { label: "Instruction address", stopKind: "address" },
      { label: "Analysis label", stopKind: "label" },
      { label: "Source line", stopKind: "source" },
    ],
    {
      title: "Capture stopping point",
      placeHolder:
        "Address/source/label limits trim observations; only breakpoints halt CPU execution. All captures have time and event caps.",
    },
  );
  if (!kind) return undefined;
  if (["manual", "elapsed", "instruction-limit", "breakpoint"].includes(kind.stopKind))
    return { kind: kind.stopKind as "manual" | "elapsed" | "instruction-limit" | "breakpoint" };
  if (kind.stopKind === "label") {
    const project = projectDirectory ? loadAnalysisProjectSnapshot(projectDirectory) : undefined;
    const labels =
      project?.shards.labels.filter(({ addressSpace }) => addressSpace === trace.addressSpace) ??
      [];
    if (!labels.length)
      throw new Error(
        "No labels in this trace address space. Use an instruction address or source line.",
      );
    const selected = await window.showQuickPick(
      labels.map((label) => ({
        label: label.name,
        description: hexadecimal(label.address),
        address: label.address,
      })),
      { title: "Stop at label" },
    );
    return selected
      ? { kind: "address", addresses: [selected.address], description: `Label ${selected.label}` }
      : undefined;
  }
  if (kind.stopKind === "source") {
    const source = await window.showQuickPick(
      context.map.sources.map((entry) => ({ label: entry.path, entry })),
      { title: "Stop at mapped source line" },
    );
    if (!source) return undefined;
    const line = await numberInput("Source line (one-based)", 1, 10_000_000);
    if (line === undefined) return undefined;
    const addresses = context.map.ranges
      .filter(
        (range) =>
          range.sourceId === source.entry.id &&
          range.line === line &&
          range.architecture === trace.architecture &&
          range.addressSpace === trace.addressSpace,
      )
      .map(({ start }) => start);
    if (!addresses.length)
      throw new Error("No instructions map to that line in this processor/address space.");
    return {
      kind: "address",
      addresses: [...new Set(addresses)],
      description: `${source.entry.path}:${line}`,
    };
  }
  const input = await window.showInputBox({
    title: "Stop at instruction address (hexadecimal)",
    placeHolder: "$C08000",
    validateInput: (raw) =>
      /^(?:\$|0x)?[\da-f]{1,6}$/i.test(raw)
        ? undefined
        : "Enter a 24-bit hexadecimal instruction address.",
  });
  return input === undefined
    ? undefined
    : {
        kind: "address",
        addresses: [Number.parseInt(input.replace(/^(\$|0x)/i, ""), 16)],
        description: input,
      };
};

/**
 * Review is plain Markdown, with no executable links derived from capture text.
 * @param {BehaviorCaptureReview} review Recomputed comparison.
 * @param {BehaviorCaptureArtifact} capture Original windows.
 * @param {DebugMap} [map] Exact session map when available.
 * @returns {string} Plain Markdown report.
 */
export const renderBehaviorReview = (
  review: BehaviorCaptureReview,
  capture: BehaviorCaptureArtifact,
  map?: DebugMap,
): string => {
  const lines = [
    "# Behavior capture review",
    "",
    `Behavior: ${plain(review.label)}`,
    "",
    `Capture SHA-256: ${review.captureSha256}`,
    "",
    `${review.observedEvents} observed events; ${review.droppedEvents} dropped events.`,
    "",
    ...review.warnings.map((warning) => `- ${warning}`),
    "",
    "## Windows",
    "",
  ];
  for (const [index, entry] of capture.windows.entries())
    lines.push(
      `- ${index}: ${entry.role}, ${plain(entry.label)}, ${entry.startedAt}, ${entry.elapsedMilliseconds} ms, stop=${entry.stopReason}, ${entry.excludedPolledEvents} polled events excluded after boundary.`,
    );
  lines.push(
    "",
    "Score = max(0, 1 − maximum idle instruction share / action instruction share). Action-only = 1. Enriched means ≥2× share and ≥3 action observations; this is not statistical significance. No baseline code is deleted.",
    "",
    "## Function candidates (persisted static ownership; may overlap)",
    "",
  );
  for (const group of review.functions)
    lines.push(
      `- ${plain(group.name)}: score ${group.score.toFixed(3)}, ${group.addresses.length} observed instructions, ${group.actionSpecificEntries.length} action-only entry transitions. Addresses: ${group.addresses.slice(0, 30).map(hexadecimal).join(", ")}${group.addresses.length > 30 ? " …" : ""}`,
    );
  if (!review.functions.length)
    lines.push(
      "No persisted function ownership. Addresses below remain ungrouped; no function boundaries are guessed.",
    );
  const action = capture.windows.find(({ role }) => role === "action")!;
  const sourceNames = new Map(map?.sources.map((source) => [source.id, plain(source.path)]) ?? []);
  const mappedSources = new Map<number, string[]>();
  const observedAddresses = review.candidates.map(({ address }) => address).sort((a, b) => a - b);
  for (const range of map?.ranges ?? []) {
    if (
      range.architecture !== action.trace.architecture ||
      range.addressSpace !== action.trace.addressSpace
    )
      continue;
    let low = 0;
    let high = observedAddresses.length;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (observedAddresses[middle] < range.start) low = middle + 1;
      else high = middle;
    }
    for (
      let index = low;
      index < observedAddresses.length && observedAddresses[index] < range.end;
      index++
    ) {
      const address = observedAddresses[index];
      const list = mappedSources.get(address) ?? [];
      list.push(`${sourceNames.get(range.sourceId) ?? "unknown"}:${range.line}`);
      mappedSources.set(address, list);
    }
  }
  for (const classification of ["action-only", "enriched", "shared"] as const) {
    const candidates = review.candidates.filter(
      (candidate) => candidate.classification === classification,
    );
    lines.push(
      "",
      `## ${classification} (${candidates.length})`,
      "",
      "| Address | Score | Action / idle | New incoming PCs | Mapped source |",
      "| --- | --- | --- | --- | --- |",
    );
    for (const candidate of candidates.slice(0, 2000)) {
      const sources = mappedSources.get(candidate.address) ?? [];
      lines.push(
        `| ${hexadecimal(candidate.address)} | ${candidate.score.toFixed(3)} | ${candidate.actionCount} / ${candidate.baselineCount} (${candidate.enrichment?.toFixed(2) ?? "absent"}×) | ${candidate.newIncomingTransitions.slice(0, 6).map(hexadecimal).join(", ")} | ${sources.join(", ")} |`,
      );
    }
    if (candidates.length > 2000)
      lines.push(
        "",
        "Preview capped at 2,000 rows in this group; the saved artifact preserves all events.",
      );
  }
  lines.push(
    "",
    "## Ordered action trace (first 256 observations)",
    "",
    "Sequence gaps are explicit. These PCs do not establish a call stack or causal dependency.",
    "",
  );
  let remaining = 256;
  for (const chunk of action.trace.chunks) {
    if (remaining <= 0) break;
    const addresses = chunk.addresses.slice(0, remaining);
    if (addresses.length)
      lines.push(
        `    seq ${chunk.sequenceStart}; cumulative loss ${chunk.droppedEvents}: ${addresses.map(hexadecimal).join(" → ")}`,
      );
    remaining -= addresses.length;
  }
  return `${lines.join("\n")}\n`;
};

/**
 * Registers capture commands against the loaded debugger build identity.
 * @param {CaptureHost} host Loaded-session lookup and view refresh callback.
 * @returns {readonly Disposable[]} Command and lifecycle registrations.
 */
export const registerBehaviorCaptures = (host: CaptureHost): readonly Disposable[] => {
  let active: ActiveCapture | undefined;
  const stoppedThreads = new Map<string, number>();
  const start = async (role: "baseline" | "action"): Promise<void> => {
    if (!workspace.isTrusted)
      throw new Error("Behavior capture requires a trusted local workspace.");
    const release = acquireTraceLease();
    let session: DebugSession | undefined;
    let started = false;
    try {
      session = debug.activeDebugSession;
      const context = session && host.context(session);
      if (!session || !context || session.type !== "uttori-asm")
        throw new Error("Start an Uttori ASM debug session before capturing behavior.");
      const traces = (
        (await session.customRequest("uttori/traceCapabilities")) as { traces: TraceCapability[] }
      ).traces;
      if (!traces.length)
        throw new Error(
          "This backend has no instruction trace stream. Use the trace-enabled ares runtime; replay is for workflow tests only. MesenCE trace capture is not yet supported.",
        );
      const trace =
        traces.length === 1
          ? traces[0]
          : (
              await window.showQuickPick(
                traces.map((entry) => ({
                  label: `${entry.architecture} / ${entry.addressSpace}`,
                  entry,
                })),
              )
            )?.entry;
      if (!trace) return;
      const project = await selectProject(context.map.output.sha256, context.map.target);
      const identity: BehaviorCaptureIdentity = {
        target: context.map.target,
        binarySha256: context.map.output.sha256,
        debugMapFingerprint: context.map.fingerprint.value,
        ...(project
          ? {
              project: {
                romContentSha256: project.manifest.rom.contentSha256,
                manifestSha256: project.manifestSha256,
              },
            }
          : {}),
      };
      const baselines: BehaviorCaptureArtifact["windows"][number][] = [];
      if (role === "action") {
        const files = await window.showOpenDialog({
          title: "Select one to eight idle baseline captures",
          canSelectMany: true,
          filters: { "Behavior captures": ["json"] },
        });
        if (!files?.length) return;
        for (const file of files) {
          if (file.scheme !== "file") throw new Error("Capture files must be local.");
          const baseline = readCapture(file.fsPath);
          if (canonicalJson(baseline.identity) !== canonicalJson(identity))
            throw new Error(
              "Baseline build/debug-map/project identity differs from the active session. Recapture idle after rebuilding or changing projects.",
            );
          if (baseline.windows.some((entry) => entry.role !== "baseline"))
            throw new Error("Select idle captures, not previously combined behavior captures.");
          baselines.push(...baseline.windows);
        }
        if (baselines.length > 8) throw new Error("Choose at most eight idle windows.");
        validateBehaviorCapture({
          format: BEHAVIOR_CAPTURE_FORMAT,
          schemaVersion: 1,
          identity,
          windows: baselines,
        });
        if (
          baselines.some(
            (entry) =>
              entry.trace.architecture !== trace.architecture ||
              entry.trace.addressSpace !== trace.addressSpace ||
              canonicalJson(entry.trace.producer) !== canonicalJson(context.producer),
          )
        )
          throw new Error("Baseline processor/emulator revision differs from the active session.");
      }
      const label = await window.showInputBox({
        title: role === "baseline" ? "Idle baseline label" : "Behavior label",
        value: role === "baseline" ? "Standing idle" : "Open Menu",
        validateInput: (raw) =>
          raw.trim() &&
          raw.length <= 512 &&
          !raw
            .split("")
            .some((char) => char.charCodeAt(0) < 32 || char === "\u2028" || char === "\u2029")
            ? undefined
            : "Enter a single-line label (1–512 characters).",
      });
      if (label === undefined) return;
      const stop =
        role === "baseline"
          ? { kind: "elapsed" as const }
          : await chooseStop(context, trace, project?.directory);
      if (!stop) return;
      const maxMilliseconds = await numberInput(
        "Capture time limit in milliseconds (also caps manual/breakpoint capture)",
        5000,
        MAX_CAPTURE_MILLISECONDS,
      );
      if (maxMilliseconds === undefined) return;
      const eventBudget = Math.min(
        MAX_CAPTURE_EVENTS,
        MAX_CAPTURE_TOTAL_EVENTS -
          baselines.reduce(
            (sum, entry) =>
              sum +
              entry.trace.chunks.reduce((events, chunk) => events + chunk.addresses.length, 0),
            0,
          ),
      );
      if (eventBudget < 1)
        throw new Error(
          "Selected baselines leave no room within the combined two-million-event limit.",
        );
      const maxEvents = await numberInput(
        "Maximum observed instructions",
        Math.min(250_000, eventBudget),
        eventBudget,
      );
      if (maxEvents === undefined) return;
      const destination = await window.showSaveDialog({
        title: "Save capture",
        defaultUri: Uri.file(
          path.join(
            session.workspaceFolder?.uri.fsPath ?? context.sourceRoot,
            `${role}-${randomUUID()}.capture.json`,
          ),
        ),
        filters: { "Behavior capture": ["json"] },
        saveLabel: "Start Capture",
      });
      if (!destination) return;
      if (destination.scheme !== "file") throw new Error("Capture destination must be local.");
      let resumeThread: number | undefined;
      if (stoppedThreads.has(session.id)) {
        const choice = await window.showQuickPick(["Start and Continue", "Start Paused"], {
          title: "The CPU is paused",
          placeHolder:
            "Capture records running instructions. Start Paused requires stepping or continuing before the time limit expires.",
        });
        if (!choice) return;
        if (choice === "Start and Continue") resumeThread = stoppedThreads.get(session.id);
      }
      // Reserve a NEW file before starting the producer; never truncate an existing artifact.
      const descriptor = fs.openSync(destination.fsPath, "wx");
      const recordingSession = session;
      try {
        await recordingSession.customRequest("uttori/startTrace", {
          architecture: trace.architecture,
          addressSpace: trace.addressSpace,
          detail:
            trace.instructionDetails &&
            workspace.getConfiguration("asm").get<string>("debug.traceDetail", "full") === "full"
              ? "full"
              : "pc",
        });
        started = true;
        const recorder = new BehaviorCaptureRecorder({
          role,
          label: label.trim(),
          stop,
          limits: { maxEvents, maxMilliseconds },
          architecture: trace.architecture,
          addressSpace: trace.addressSpace,
          romContentSha256: identity.binarySha256,
          producer: context.producer,
          maxBatchEvents: trace.maxBatchEvents,
          readTrace: async (maxEvents) =>
            (await recordingSession.customRequest("uttori/readTrace", {
              maxEvents,
            })) as EditorTraceBatch,
          stopTrace: async () => {
            await recordingSession.customRequest("uttori/stopTrace");
          },
        });
        active = {
          session: recordingSession,
          recorder,
          breakpointStop: stop.kind === "breakpoint",
        };
        if (resumeThread !== undefined) {
          try {
            await recordingSession.customRequest("continue", { threadId: resumeThread });
          } catch (error) {
            recorder.requestStop("error");
            await recorder.completion;
            throw error;
          }
        }
        void window.showInformationMessage(
          `Assembly: ${role} capture started. Resume the emulator if paused; ${role === "action" ? "perform the behavior" : "remain idle"}. Use Assembly: Stop Behavior Capture to end early.`,
        );
        const captured = await recorder.completion;
        started = false;
        const artifact = validateBehaviorCapture({
          format: BEHAVIOR_CAPTURE_FORMAT,
          schemaVersion: 1,
          identity,
          windows: [...baselines, captured],
        });
        fs.writeFileSync(descriptor, canonicalJson(artifact));
        fs.fsyncSync(descriptor);
        const events = captured.trace.chunks.reduce(
          (sum, chunk) => sum + chunk.addresses.length,
          0,
        );
        const message = `Assembly: saved ${events} ${role} events; stop=${captured.stopReason}, dropped=${captured.trace.chunks.at(-1)?.droppedEvents ?? 0}. ${destination.fsPath}`;
        if (events === 0)
          void window.showWarningMessage(
            `${message} No instructions were observed. A paused CPU is not an idle baseline; use Start and Continue or step while capturing.`,
          );
        else if (["error", "session-ended"].includes(captured.stopReason))
          void window.showWarningMessage(message);
        else void window.showInformationMessage(message);
      } finally {
        fs.closeSync(descriptor);
      }
    } finally {
      if (started && session)
        await Promise.resolve(session.customRequest("uttori/stopTrace")).catch(() => undefined);
      active = undefined;
      release();
    }
  };

  const reviewAndApply = async (): Promise<void> => {
    const files = await window.showOpenDialog({
      title: "Review behavior capture",
      canSelectMany: false,
      filters: { "Behavior capture": ["json"] },
    });
    const file = files?.[0];
    if (!file) return;
    if (file.scheme !== "file") throw new Error("Capture files must be local.");
    const capture = readCapture(file.fsPath);
    const selectedProject = await selectProject(
      capture.identity.binarySha256,
      capture.identity.target,
    );
    const project = selectedProject
      ? { ...selectedProject, snapshot: loadAnalysisProjectSnapshot(selectedProject.directory) }
      : undefined;
    const review = reviewBehaviorCapture(capture, project?.snapshot.shards);
    const context = debug.activeDebugSession && host.context(debug.activeDebugSession);
    const map =
      context?.map.fingerprint.value === capture.identity.debugMapFingerprint
        ? context.map
        : undefined;
    const content = renderBehaviorReview(review, capture, map);
    await window.showTextDocument(
      await workspace.openTextDocument({ language: "markdown", content }),
      { preview: false },
    );
    if (!project || !capture.identity.project) {
      void window.showInformationMessage(
        "Review available. Applying comments requires the matching native analysis project; source-only captures remain read-only.",
      );
      return;
    }
    if (!workspace.isTrusted)
      throw new Error("Applying capture comments requires a trusted workspace.");
    if (capture.identity.project.manifestSha256 !== project.snapshot.revision.manifestSha256)
      void window.showWarningMessage(
        "Analysis changed since capture. Review uses the current project; existing facts are preserved and concurrent edits will abort apply.",
      );
    const choices = review.candidates.map((candidate) => ({
      label: hexadecimal(candidate.address),
      description: candidate.explanation,
      detail: `score=${candidate.score.toFixed(3)}; ${candidate.newIncomingTransitions.length} new incoming transition(s)`,
      address: candidate.address,
      picked: candidate.classification !== "shared",
    }));
    const selected = await window.showQuickPick(choices, {
      title: "Select reviewed instructions to annotate",
      canPickMany: true,
      placeHolder:
        "Shared code is retained and may be selected explicitly. Cancel leaves the project unchanged.",
    });
    if (!selected?.length) return;
    if (
      (await window.showWarningMessage(
        `Add ${selected.length} candidate-association comments for “${review.label}” and import execution evidence? Existing comments, labels, source, and control targets will not be replaced.`,
        { modal: true },
        "Apply Capture",
      )) !== "Apply Capture"
    )
      return;
    const merged = applyBehaviorCapture(
      project.snapshot,
      capture,
      selected.map(({ address }) => address),
    );
    if (merged.changed)
      commitAnalysisProjectTransaction(project.directory, project.snapshot.revision, {
        manifest: project.snapshot.manifest,
        shards: merged.shards,
      });
    else compactAnalysisProject(project.directory);
    host.refresh();
    const selectedAddresses = selected.map(({ address }) => address);
    const action = await window.showInformationMessage(
      merged.changed
        ? `Assembly: applied capture: ${merged.added.runtime} runtime fact(s), ${merged.added.comments} comment(s), ${merged.added.evidence} evidence record(s) added; ${merged.updated.runtime + merged.updated.comments} record(s) updated; ${merged.conflicts.length} runtime conflict(s) retained. Generated source is now stale until it is analyzed and regenerated.`
        : "Assembly: this capture selection was already applied; no evidence changed. You can still analyze and regenerate source.",
      "Analyze and Regenerate",
    );
    if (action === "Analyze and Regenerate")
      await commands.executeCommand(REGENERATE_DISASSEMBLY_COMMAND, {
        projectDirectory: project.directory,
        entrySeeds: behaviorEntrySeeds(merged.shards, selectedAddresses),
      });
  };
  const run = (operation: () => Promise<void>) => async (): Promise<void> => {
    try {
      await operation();
    } catch (error) {
      await window.showErrorMessage(
        `Assembly behavior capture: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };
  return [
    commands.registerCommand(
      "asm.capture.guide",
      run(async () => {
        await window.showTextDocument(
          await workspace.openTextDocument({
            language: "markdown",
            content: BEHAVIOR_CAPTURE_GUIDE,
          }),
          { preview: false },
        );
      }),
    ),
    commands.registerCommand(
      "asm.capture.demo",
      run(async () => {
        const demo = await runBehaviorCaptureDemo();
        const content = [
          "# Idle capture demo — synthetic, no project files changed",
          "",
          "This exercises the real recorder, review, and comment merger using a tiny replay CPU. It does not execute Secret of Mana.",
          "",
          "Expected: $808020 and $808030 action-only (1.000); $808000 shared; idle-only $808010 absent from candidates.",
          "",
          `Comments added: ${demo.changed}. Second identical apply changed anything: ${demo.repeatedChanged}.`,
          "",
          "## In-memory comment preview",
          "",
          ...demo.comments.map(
            (comment) => `- ${hexadecimal(comment.address)}: ${plain(comment.text)}`,
          ),
          "",
          renderBehaviorReview(demo.review, demo.capture),
        ].join("\n");
        await window.showTextDocument(
          await workspace.openTextDocument({ language: "markdown", content }),
          { preview: false },
        );
      }),
    ),
    commands.registerCommand(
      "asm.capture.idle",
      run(() => start("baseline")),
    ),
    commands.registerCommand(
      "asm.capture.behavior",
      run(() => start("action")),
    ),
    commands.registerCommand("asm.capture.review", run(reviewAndApply)),
    commands.registerCommand("asm.capture.stop", () => {
      if (active) active.recorder.requestStop();
      else void window.showInformationMessage("No behavior capture is active.");
    }),
    debug.onDidTerminateDebugSession((session) => {
      stoppedThreads.delete(session.id);
      if (active?.session.id === session.id) active.recorder.requestStop("session-ended");
    }),
    debug.registerDebugAdapterTrackerFactory("uttori-asm", {
      createDebugAdapterTracker: (session) => ({
        onDidSendMessage: (raw: unknown) => {
          if (!raw || typeof raw !== "object") return;
          const message = raw as {
            type?: string;
            event?: string;
            body?: { reason?: string; threadId?: number };
          };
          if (message.type === "event") {
            if (message.event === "stopped" && Number.isSafeInteger(message.body?.threadId))
              stoppedThreads.set(session.id, message.body!.threadId!);
            else if (message.event === "continued" || message.event === "terminated")
              stoppedThreads.delete(session.id);
          }
          if (
            active?.session.id === session.id &&
            active.breakpointStop &&
            message.type === "event" &&
            message.event === "stopped" &&
            message.body?.reason === "breakpoint"
          )
            active.recorder.requestStop("breakpoint");
        },
      }),
    }),
    { dispose: () => active?.recorder.requestStop("session-ended") },
  ];
};

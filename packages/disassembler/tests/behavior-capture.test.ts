import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { test } from "../../../tests/ava-helper.js";
import {
  BEHAVIOR_CAPTURE_FORMAT,
  MAX_CAPTURE_EVENTS,
  RomImage,
  validateBehaviorCapture,
  reviewBehaviorCapture,
  applyBehaviorCapture,
  buildInstructionAnalysisAnnotations,
  writeAnalysisProject,
  loadAnalysisProjectSnapshot,
  commitAnalysisProjectTransaction,
  AnalysisProjectStaleError,
  type AnalysisProject,
  type BehaviorCaptureArtifact,
  type BehaviorCaptureWindow,
} from "../src/index.js";

const rom = new RomImage(new Uint8Array(0x8000));
const project = (): AnalysisProject => ({
  manifest: {
    format: "uttori-asm-analysis",
    schemaVersion: 3,
    target: "snes",
    rom: rom.identity,
    mapping: { mapper: "test", source: "override", candidates: [] },
    addressSpaces: [{ id: "snes.cpu", name: "CPU", addressBits: 24, kind: "cpu" }],
  },
  shards: {
    analysis: [],
    annotations: [],
    labels: [],
    comments: [
      { id: "manual", addressSpace: "snes.cpu", address: 4, text: "Keep my comment", evidence: [] },
    ],
    regions: [],
    runtime: [],
    evidence: [],
    imports: [],
  },
});
const windowFor = (
  role: "baseline" | "action",
  addresses: readonly number[],
  seconds = 0,
): BehaviorCaptureWindow => ({
  role,
  label: role === "baseline" ? "Room idle" : "Open Menu",
  startedAt: new Date(1000 * seconds).toISOString(),
  elapsedMilliseconds: 1000,
  limits: { maxEvents: 1000, maxMilliseconds: 5000 },
  stop: { kind: "manual" },
  stopReason: "manual",
  excludedPolledEvents: 0,
  trace: {
    format: "uttori-asm-instruction-trace",
    schemaVersion: 1,
    architecture: "snes.65816",
    addressSpace: "snes.cpu",
    romContentSha256: rom.identity.contentSha256,
    producer: { id: "ares", revision: "fixture" },
    chunks: [{ sequenceStart: 1, addresses, droppedEvents: 0, active: false }],
  },
});
const capture = (): BehaviorCaptureArtifact => ({
  format: BEHAVIOR_CAPTURE_FORMAT,
  schemaVersion: 1,
  identity: {
    target: "snes",
    binarySha256: rom.identity.contentSha256,
    debugMapFingerprint: "b".repeat(64),
    project: { romContentSha256: rom.identity.contentSha256, manifestSha256: "c".repeat(64) },
  },
  windows: [
    windowFor("baseline", [1, 2, 1, 2, 3]),
    windowFor("baseline", [1, 2, 1, 2, 3], 1),
    windowFor("action", [1, 3, 3, 3, 4], 2),
  ],
});

test("behavior profiles rank menu-only and enriched code while retaining shared utilities", (t) => {
  const input = capture();
  const review = reviewBehaviorCapture(input);
  const byAddress = new Map(review.candidates.map((entry) => [entry.address, entry]));
  t.is(byAddress.get(4)?.classification, "action-only");
  t.is(byAddress.get(3)?.classification, "enriched");
  t.is(byAddress.get(1)?.classification, "shared");
  t.is(byAddress.get(3)?.enrichment, 2.9999999999999996);
  t.deepEqual(byAddress.get(3)?.newIncomingTransitions, [1, 3]);
  t.deepEqual(
    review.transitions.find((edge) => edge.from === 1 && edge.to === 3),
    { from: 1, to: 3, count: 1, baselineCount: 0 },
  );
  t.is(review.observedEvents, 15);
  t.deepEqual(review, reviewBehaviorCapture(JSON.parse(JSON.stringify(input))));
  t.false(review.candidates.some(({ address }) => address === 2));
  t.deepEqual(input.windows[0]!.trace.chunks[0]!.addresses, [1, 2, 1, 2, 3]);
});

test("maximum per-window idle share prevents long quiet baselines diluting a noisy baseline", (t) => {
  const input = {
    ...capture(),
    windows: [
      windowFor("baseline", [3, 3, 3, 1]),
      windowFor("baseline", Array(100).fill(1), 1),
      windowFor("action", [3, 3, 3, 1], 2),
    ],
  };
  const candidate = reviewBehaviorCapture(input).candidates.find(({ address }) => address === 3)!;
  t.is(candidate.classification, "shared");
  t.is(candidate.score, 0);
});

test("lost trace events never create transitions across chunk gaps", (t) => {
  const base = capture();
  const action = base.windows[2]!;
  const input = {
    ...base,
    windows: [
      ...base.windows.slice(0, 2),
      {
        ...action,
        trace: {
          ...action.trace,
          chunks: [
            { sequenceStart: 1, addresses: [1, 3], droppedEvents: 0, active: true },
            { sequenceStart: 5, addresses: [4, 5], droppedEvents: 2, active: false },
          ],
        },
      },
    ],
  };
  const review = reviewBehaviorCapture(input);
  t.false(review.transitions.some(({ from, to }) => from === 3 && to === 4));
  t.true(review.transitions.some(({ from, to }) => from === 4 && to === 5));
  t.is(review.droppedEvents, 2);
  t.true(review.warnings.some((warning) => warning.includes("biased")));
});

test("contiguous chunks preserve transitions and incomplete/replay windows warn", (t) => {
  const input = {
    ...capture(),
    windows: capture().windows.map((window) => ({
      ...window,
      trace: { ...window.trace, producer: { id: "debug-map-replay", revision: "test" } },
    })),
  };
  const action = input.windows[2]!;
  input.windows[2] = {
    ...action,
    stopReason: "session-ended",
    trace: {
      ...action.trace,
      chunks: [
        { sequenceStart: 1, addresses: [1, 3], droppedEvents: 0, active: true },
        { sequenceStart: 3, addresses: [4], droppedEvents: 0, active: true },
      ],
    },
  };
  const review = reviewBehaviorCapture(input);
  t.true(review.transitions.some(({ from, to }) => from === 3 && to === 4));
  t.true(review.warnings.some((warning) => warning.includes("incomplete")));
  t.true(review.warnings.some((warning) => warning.includes("Synthetic")));
});

test("capture parser rejects incompatible identities, duplicate windows, bounds and malformed traces", (t) => {
  const original = capture();
  const invalid: unknown[] = [
    null,
    {},
    { ...original, schemaVersion: 2 },
    { ...original, identity: { ...original.identity, binarySha256: "z" } },
    { ...original, windows: [] },
    { ...original, windows: [original.windows[0], original.windows[0]] },
    { ...original, windows: Array(10).fill(original.windows[0]) },
  ];
  const badWindows: unknown[] = [
    { ...original.windows[2], role: "other" },
    { ...original.windows[2], label: "Menu\n.byte $00" },
    { ...original.windows[2], limits: { maxEvents: MAX_CAPTURE_EVENTS + 1, maxMilliseconds: 1 } },
    { ...original.windows[2], stop: { kind: "address", addresses: [], description: "empty" } },
    {
      ...original.windows[2],
      trace: { ...original.windows[2]!.trace, producer: { id: "mesen", revision: "other" } },
    },
    { ...original.windows[2], trace: { ...original.windows[2]!.trace, addressSpace: "snes.apu" } },
    {
      ...original.windows[2],
      trace: { ...original.windows[2]!.trace, romContentSha256: "d".repeat(64) },
    },
    {
      ...original.windows[2],
      trace: {
        ...original.windows[2]!.trace,
        chunks: [{ sequenceStart: 2, addresses: [4], droppedEvents: 0, active: false }],
      },
    },
    {
      ...original.windows[2],
      trace: {
        ...original.windows[2]!.trace,
        chunks: [{ sequenceStart: 1, addresses: [0x1000000], droppedEvents: 0, active: false }],
      },
    },
  ];
  for (const value of [
    ...invalid,
    ...badWindows.map((window) => ({ ...original, windows: [original.windows[0], window] })),
  ])
    t.throws(() => validateBehaviorCapture(value));
  t.throws(() => reviewBehaviorCapture({ ...original, windows: [original.windows[0]] }), {
    message: /one action/,
  });
  t.throws(
    () =>
      reviewBehaviorCapture({
        ...original,
        windows: [windowFor("baseline", []), original.windows[2]],
      }),
    { message: /must contain/ },
  );
});

test("review uses persisted function ownership without making unknown functions or indirect targets", (t) => {
  const current = project();
  const shards = {
    ...current.shards,
    analysis: [
      {
        id: "fn",
        kind: "function" as const,
        addressSpace: "snes.cpu",
        address: 4,
        source: "fixture",
        evidencePath: ["node"],
        evidence: [],
      },
      {
        id: "node",
        kind: "cfg-node" as const,
        addressSpace: "snes.cpu",
        address: 4,
        fileOffset: 4,
        size: 1,
        opcode: 0xea,
        specificationId: "nop",
        mnemonic: "NOP",
        mode: "implied",
        context: [],
        incomingState: {},
        outgoingState: {},
        effectiveAddresses: [],
        entryPoint: "fn",
        evidencePath: ["node"],
        evidence: [],
      },
    ],
  };
  const review = reviewBehaviorCapture(capture(), shards);
  t.is(review.functions.length, 1);
  t.deepEqual(review.functions[0]!.addresses, [4]);
  t.deepEqual(review.functions[0]!.actionSpecificEntries, [
    { from: 3, to: 4, count: 1, baselineCount: 0 },
  ]);
  const result = applyBehaviorCapture({ ...current, shards }, capture(), [4]);
  t.deepEqual(result.shards.analysis, shards.analysis);
  t.false(result.shards.runtime.some(({ kind }) => kind === "runtime-control-target"));
});

test("reviewed comments are additive, idempotent, provenance-linked and visible in disassembly projection", (t) => {
  const current = project();
  const applied = applyBehaviorCapture(current, capture(), [4]);
  t.true(applied.changed);
  t.is(applied.added.comments, 1);
  t.true(applied.added.runtime > 0);
  t.is(applied.shards.comments.find(({ id }) => id === "manual")?.text, "Keep my comment");
  const comment = applied.shards.comments.find(({ id }) => id !== "manual")!;
  t.regex(comment.text, /Open Menu.*score=1.000/);
  t.true(applied.shards.evidence.some(({ id }) => comment.evidence.includes(id)));
  const repeated = applyBehaviorCapture({ ...current, shards: applied.shards }, capture(), [4]);
  t.false(repeated.changed);
  t.deepEqual(repeated.shards, applied.shards);
  const second = {
    ...capture(),
    windows: capture().windows.map((window) =>
      window.role === "action" ? { ...window, label: "Close Menu" } : window,
    ),
  };
  const another = applyBehaviorCapture({ ...current, shards: applied.shards }, second, [4]);
  t.is(another.added.comments, 1);
  t.is(another.added.runtime, 3, "reused baseline windows are not imported twice");
  const annotation = buildInstructionAnalysisAnnotations(
    current.manifest,
    applied.shards,
  ).instructions.find(({ address }) => address === 4)!;
  t.true(annotation.comments!.some(({ text }) => text.includes("Open Menu")));
  t.throws(() => applyBehaviorCapture(current, capture(), [99]), { message: /observed action/ });
  t.throws(
    () =>
      applyBehaviorCapture(
        { ...current, manifest: { ...current.manifest, target: "other" } },
        capture(),
        [4],
      ),
    { message: /mismatch/ },
  );
});

test("capture application publishes transactionally and rejects a stale review", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-behavior-"));
  try {
    writeAnalysisProject(directory, project());
    const snapshot = loadAnalysisProjectSnapshot(directory);
    const result = applyBehaviorCapture(snapshot, capture(), [4]);
    commitAnalysisProjectTransaction(directory, snapshot.revision, {
      manifest: snapshot.manifest,
      shards: result.shards,
    });
    t.throws(
      () =>
        commitAnalysisProjectTransaction(directory, snapshot.revision, {
          manifest: snapshot.manifest,
          shards: result.shards,
        }),
      { instanceOf: AnalysisProjectStaleError },
    );
    t.is(loadAnalysisProjectSnapshot(directory).shards.comments.length, 2);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

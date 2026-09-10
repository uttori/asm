import { createHash } from "node:crypto";

import { ReplayDebugBackend } from "@uttori/asm-debug-adapter";
import {
  BEHAVIOR_CAPTURE_FORMAT,
  BehaviorCaptureRecorder,
  RomImage,
  applyBehaviorCapture,
  canonicalJson,
  reviewBehaviorCapture,
  validateBehaviorCapture,
  type AnalysisProject,
  type BehaviorCaptureWindow,
} from "@uttori/asm-disassembler";

const architecture = "snes.65816";
const addressSpace = "snes.cpu";
const shared = 0x808000;
const idle = 0x808010;
const menu = 0x808020;
const draw = 0x808030;

/**
 * Runs a bounded synthetic trace through the real recorder, review, and comment merger. No file I/O.
 * @returns {Promise<object>} Synthetic capture, candidate review, comment preview, and idempotence results.
 */
export const runBehaviorCaptureDemo = async () => {
  const rom = new RomImage(new Uint8Array(0x8000));
  const project: AnalysisProject = {
    manifest: {
      format: "uttori-asm-analysis",
      schemaVersion: 3,
      target: "snes",
      rom: rom.identity,
      mapping: { mapper: "synthetic-demo", source: "override", candidates: [] },
      addressSpaces: [{ id: addressSpace, name: "Demo CPU", addressBits: 24, kind: "cpu" }],
    },
    shards: {
      analysis: [],
      annotations: [],
      labels: [],
      regions: [],
      runtime: [],
      evidence: [],
      imports: [],
      comments: [
        {
          id: "manual",
          addressSpace,
          address: menu,
          text: "Handwritten comment: keep me.",
          evidence: [],
        },
      ],
    },
  };
  const record = async (
    role: "baseline" | "action",
    addresses: number[],
  ): Promise<BehaviorCaptureWindow> => {
    const backend = new ReplayDebugBackend({
      snapshots: addresses.map((address) => ({
        threads: [{ id: 1, name: "Synthetic CPU", architecture }],
        frames: [
          { id: 1, threadId: 1, name: "Demo frame", pc: { architecture, addressSpace, address } },
        ],
        registers: {},
        memory: [],
      })),
    });
    try {
      await backend.connect({ reset: true });
      await backend.startTrace({ architecture, addressSpace });
      for (let index = 1; index < addresses.length; index++) await backend.step(1, "instruction");
      const recorder = new BehaviorCaptureRecorder({
        role,
        label: role === "baseline" ? "Standing idle (synthetic)" : "Open Menu (synthetic)",
        architecture,
        addressSpace,
        romContentSha256: rom.identity.contentSha256,
        producer: { id: "debug-map-replay", revision: "idle-demo-v1" },
        stop: { kind: "instruction-limit" },
        limits: { maxEvents: addresses.length, maxMilliseconds: 5000 },
        maxBatchEvents: 3,
        readTrace: (maximum) => backend.readTrace(maximum),
        stopTrace: () => backend.stopTrace(),
      });
      return await recorder.completion;
    } finally {
      await backend.disconnect({ terminate: true });
    }
  };
  const baseline = await record("baseline", [shared, idle, shared, idle]);
  const action = await record("action", [shared, menu, draw, menu, shared]);
  const hash = (value: unknown): string =>
    createHash("sha256").update(canonicalJson(value)).digest("hex");
  const capture = validateBehaviorCapture({
    format: BEHAVIOR_CAPTURE_FORMAT,
    schemaVersion: 1,
    identity: {
      target: "snes",
      binarySha256: rom.identity.contentSha256,
      debugMapFingerprint: hash({ synthetic: "idle-demo-v1" }),
      project: {
        romContentSha256: rom.identity.contentSha256,
        manifestSha256: hash(project.manifest),
      },
    },
    windows: [baseline, action],
  });
  const review = reviewBehaviorCapture(capture, project.shards);
  const selected = review.candidates
    .filter(({ classification }) => classification === "action-only")
    .map(({ address }) => address);
  const applied = applyBehaviorCapture(project, capture, selected);
  const repeated = applyBehaviorCapture({ ...project, shards: applied.shards }, capture, selected);
  return {
    capture,
    review,
    comments: applied.shards.comments,
    changed: applied.changed,
    repeatedChanged: repeated.changed,
  };
};

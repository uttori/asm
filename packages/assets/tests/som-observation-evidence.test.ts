import { test } from "../../../tests/ava-helper.js";
import { quantizeAnimationEvidence } from "../src/animation-evidence.js";
import {
  readSomObservationDeclaration,
  resolveSomObservationEvidence,
} from "../src/secret-of-mana/som-observation-evidence.js";
import type { FrameRecord } from "../src/secret-of-mana/som-types.js";

/** Self-contained physical-upload evidence; pose labels alone provide no sequence or terminal hold. */
function fixture() {
  const declaration = {
    format: "som.sprite.observations",
    version: 1,
    id: "proof-selection",
    capture: "capture",
    romSha256: "a".repeat(64),
    proofSha256: "b".repeat(64),
    pivot: { x: 10, y: 20 },
    paletteBanks: [{ bank: 5, bytes: "00".repeat(32) }],
    ranges: [{ id: "intro", start: "0", end: String(357368 * 4) }],
  };
  const matched = Array.from({ length: 5 }, (_, i) => ({
    frame: i < 2 ? "z-pose" : "a-pose",
    frameAddress: i < 2 ? 0xc00000 : 0xc00100,
    visibleStart: String(i * 357368),
    visibleEnd: String(i * 357368 + 100000),
    oamTransferId: String(i),
    followingOamTransferId: String(i + 1),
    obsel: 99,
    obselEvidence: "Recorded physical register write.",
    displayControl: 15,
    flipX: false,
    flipY: false,
    paletteBanks: [{ bank: 5, covered: true, bytes: "00".repeat(32) }],
  }));
  const proof = {
    format: "som-castle-boss-display-proof",
    version: 1,
    romSha256: declaration.romSha256,
    captures: [
      {
        slug: "capture",
        primarySha256: "c".repeat(64),
        graphicsSha256: "d".repeat(64),
        contextSha256: "e".repeat(64),
        clock: { id: "snes.master", numerator: "236250000", denominator: "11" },
        matched,
      },
    ],
  };
  const poses: FrameRecord[] = ["z-pose", "a-pose"].map((id, index) => ({
    id,
    bounds: [0, 0, 32, 32],
    origin: [10 + index * 64, 20 + index * 32],
    nativeFrame: { address: 0xc00000 + index * 256, end: 0xc00001 + index * 256, bytes: [0] },
  }));
  // Castle-boss declarations use their own retained record; packing origins differ without changing native pivot identity.
  poses[1].bossFrame = poses[1].nativeFrame;
  delete poses[1].nativeFrame;
  return { declaration, proof, poses, matched };
}

test("SoM observations preserve ordered holds, common pivot, provenance and omit unknown terminal time", (t) => {
  const { declaration, proof, poses } = fixture(),
    resolved = resolveSomObservationEvidence(
      proof,
      readSomObservationDeclaration(declaration),
      poses,
    ),
    runs = quantizeAnimationEvidence(resolved.sequences);
  t.deepEqual(runs[0].frames, [
    { pose: "z-pose", durationMs: 33 },
    { pose: "a-pose", durationMs: 34 },
  ]);
  t.deepEqual(runs[0].pivot, { x: 10, y: 20 });
  t.is(runs[0].provenance.kind, "observation");
  t.true(runs[0].provenance.source.includes(declaration.proofSha256));
  t.deepEqual(resolved.gaps, []);
  t.is(resolved.sequences[0].intervals.at(-1)!.end, 1429472n);
});

test("unknown upload joins, palette coverage, display state and pose bindings split observations into gaps", (t) => {
  for (const alter of [
    (row: ReturnType<typeof fixture>["matched"][number]) => {
      row.followingOamTransferId = "missing";
    },
    (row: ReturnType<typeof fixture>["matched"][number]) => {
      row.paletteBanks[0].covered = false;
    },
    (row: ReturnType<typeof fixture>["matched"][number]) => {
      row.flipX = true;
    },
    (row: ReturnType<typeof fixture>["matched"][number]) => {
      row.frame = "unknown-pose";
    },
  ]) {
    const { declaration, proof, poses, matched } = fixture();
    alter(matched[1]);
    const resolved = resolveSomObservationEvidence(
        proof,
        readSomObservationDeclaration(declaration),
        poses,
      ),
      runs = quantizeAnimationEvidence(resolved.sequences);
    t.is(resolved.gaps.length, 1);
    t.is(runs.length, 2);
    t.is(runs[0].frames[0].durationMs, 17);
  }
});

test("foreign evidence, bad ranges, unsupported clocks and unordered samples fail explicitly", (t) => {
  const { declaration, proof, poses } = fixture();
  t.throws(() => readSomObservationDeclaration({ ...declaration, version: 9 }), {
    message: /Unsupported/,
  });
  t.throws(
    () =>
      readSomObservationDeclaration({
        ...declaration,
        ranges: [{ id: "x", start: "10", end: "9" }],
      }),
    { message: /range/ },
  );
  const selected = readSomObservationDeclaration(declaration);
  t.throws(
    () => resolveSomObservationEvidence({ ...proof, romSha256: "f".repeat(64) }, selected, poses),
    { message: /foreign/ },
  );
  proof.captures[0].clock.denominator = "1";
  t.throws(() => resolveSomObservationEvidence(proof, selected, poses), { message: /clock/ });
  proof.captures[0].clock.denominator = "11";
  proof.captures[0].matched.reverse();
  t.throws(() => resolveSomObservationEvidence(proof, selected, poses), { message: /unordered/ });
});

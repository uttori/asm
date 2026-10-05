import type { KnownAnimationSequence, KnownPoseInterval } from "../animation-evidence.js";
import { ASSET_LIMITS } from "../limits.js";
import { integer } from "../validation.js";
import type { FrameRecord } from "./som-types.js";

/** Source-owned selection of known capture intervals; hashes identify evidence, never native pixel ownership. */
export interface SomObservationDeclaration {
  readonly format: "som.sprite.observations";
  readonly version: 1;
  readonly id: string;
  readonly romSha256: string;
  readonly proofSha256: string;
  readonly capture: string;
  readonly pivot: { readonly x: number; readonly y: number };
  readonly paletteBanks: readonly { readonly bank: number; readonly bytes: string }[];
  readonly ranges: readonly { readonly id: string; readonly start: bigint; readonly end: bigint }[];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function object(value: unknown): Record<string, unknown> {
  if (!isObject(value)) {
    throw new Error("Invalid SoM observation record.");
  }
  return value;
}
function identity(value: unknown): string {
  if (typeof value !== "string" || !value.length || value.length > 1024) {
    throw new Error("Invalid SoM observation identity.");
  }
  return value;
}
function hash(value: unknown): string {
  if (typeof value !== "string" || !/^[\da-f]{64}$/.test(value)) {
    throw new Error("Invalid SoM observation evidence hash.");
  }
  return value;
}
/** Narrow untrusted JSON scalars before applying the shared integer/range validator. */
function readInteger(value: unknown, label: string, minimum: number, maximum: number): number {
  if (typeof value !== "number") {
    throw new Error(`Invalid ${label}.`);
  }
  return integer(value, label, minimum, maximum);
}
/** Canonical decimal ticks preserve exact master-clock arithmetic without accepting float or unbounded bigint input. */
function ticks(value: unknown): bigint {
  if (typeof value !== "string" || !/^(?:0|[1-9]\d{0,15})$/.test(value)) {
    throw new Error("Invalid observed master-clock ticks.");
  }
  const result = BigInt(value);
  if (result > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("Observed master clock exceeds its supported range.");
  }
  return result;
}

/** Read the versioned portable declaration; unsupported versions require a new explicit source declaration. */
export function readSomObservationDeclaration(value: unknown): SomObservationDeclaration {
  const input = object(value),
    pivot = object(input.pivot);
  if (
    input.format !== "som.sprite.observations" ||
    input.version !== 1 ||
    !Array.isArray(input.ranges) ||
    input.ranges.length > ASSET_LIMITS.frames ||
    !Array.isArray(input.paletteBanks) ||
    input.paletteBanks.length > 8
  ) {
    throw new Error("Unsupported SoM observation declaration.");
  }
  const paletteBanks = input.paletteBanks.map((entry) => {
    const bank = object(entry);
    if (typeof bank.bytes !== "string" || !/^[\da-f]{64}$/i.test(bank.bytes)) {
      throw new Error("Invalid observed palette bytes.");
    }
    return {
      bank: readInteger(bank.bank, "Observed palette bank", 0, 7),
      bytes: bank.bytes.toLowerCase(),
    };
  });
  if (new Set(paletteBanks.map((entry) => entry.bank)).size !== paletteBanks.length) {
    throw new Error("Duplicate observed palette bank.");
  }
  const ids = new Set<string>();
  let previous = 0n;
  const ranges = input.ranges.map((entry) => {
    const range = object(entry),
      id = identity(range.id),
      start = ticks(range.start),
      end = ticks(range.end);
    if (ids.has(id) || end <= start || start < previous) {
      throw new Error("Invalid or overlapping observed sequence range.");
    }
    ids.add(id);
    previous = end;
    return { id, start, end };
  });
  return {
    format: "som.sprite.observations",
    version: 1,
    id: identity(input.id),
    romSha256: hash(input.romSha256),
    proofSha256: hash(input.proofSha256),
    capture: identity(input.capture),
    pivot: {
      x: readInteger(pivot.x, "Observed pivot x", -(1 << 20), 1 << 20),
      y: readInteger(pivot.y, "Observed pivot y", -(1 << 20), 1 << 20),
    },
    paletteBanks,
    ranges,
  };
}

/**
 * Adapt retained native display proof into known half-open pose holds. Only consecutive,
 * joined physical uploads establish continuity; unsupported display states remain gaps.
 * The final observation bounds the preceding hold and never creates a guessed terminal frame.
 */
export function resolveSomObservationEvidence(
  proofValue: unknown,
  declaration: SomObservationDeclaration,
  poses: readonly FrameRecord[],
): {
  readonly sequences: readonly KnownAnimationSequence[];
  readonly gaps: readonly { readonly start: bigint; readonly reason: string }[];
} {
  const proof = object(proofValue);
  if (
    proof.format !== "som-castle-boss-display-proof" ||
    proof.version !== 1 ||
    proof.romSha256 !== declaration.romSha256 ||
    !Array.isArray(proof.captures) ||
    proof.captures.length > 1024
  ) {
    throw new Error("Unsupported or foreign SoM display evidence.");
  }
  const captures = proof.captures
    .map(object)
    .filter((capture) => capture.slug === declaration.capture);
  if (captures.length !== 1) {
    throw new Error("Missing or duplicate observation capture.");
  }
  const capture = captures[0],
    clock = object(capture.clock);
  if (clock.id !== "snes.master" || clock.numerator !== "236250000" || clock.denominator !== "11") {
    throw new Error("Unsupported observation master-clock contract.");
  }
  for (const field of ["primarySha256", "graphicsSha256", "contextSha256"]) {
    hash(capture[field]);
  }
  if (!Array.isArray(capture.matched) || capture.matched.length > 65536) {
    throw new Error("Invalid observation inventory.");
  }
  const poseMap = new Map<string, FrameRecord>();
  integer(poses.length, "Observed source poses", 0, ASSET_LIMITS.frames);
  for (const pose of poses) {
    const id = String(pose.id);
    if (poseMap.has(id)) {
      throw new Error("Duplicate observed source pose.");
    }
    poseMap.set(id, pose);
  }
  let previous = -1n;
  const samples = capture.matched.map((value) => {
    const sample = object(value),
      start = ticks(sample.visibleStart),
      end = ticks(sample.visibleEnd),
      pose = identity(sample.frame);
    if (
      start <= previous ||
      end <= start ||
      typeof sample.flipX !== "boolean" ||
      typeof sample.flipY !== "boolean" ||
      !Array.isArray(sample.paletteBanks) ||
      sample.paletteBanks.length > 8
    ) {
      throw new Error("Invalid or unordered observation sample.");
    }
    previous = start;
    readInteger(sample.frameAddress, "Observed native pose address", 0, 0xffffff);
    readInteger(sample.obsel, "Observed physical OBSEL", 0, 255);
    readInteger(sample.displayControl, "Observed display control", 0, 255);
    return {
      sample,
      start,
      end,
      pose,
      upload: identity(sample.oamTransferId),
      following: identity(sample.followingOamTransferId),
    };
  });
  const gaps: { start: bigint; reason: string }[] = [],
    sequences: KnownAnimationSequence[] = [];
  const supported = (entry: (typeof samples)[number]): boolean => {
    const { sample } = entry,
      pose = poseMap.get(entry.pose);
    // Ordinary actors and castle bosses retain different native record encodings, with the same pose-address identity.
    const address = pose?.bossFrame?.address ?? pose?.nativeFrame?.address;
    if (!pose || address !== sample.frameAddress || !pose.origin) {
      return false;
    }
    // This provider's retained observations use unreflected, fully visible OBJ state. Other states need a separate proven pose mapping.
    if (
      sample.flipX ||
      sample.flipY ||
      sample.obsel !== 0x63 ||
      sample.displayControl !== 15 ||
      sample.obselEvidence !== "Recorded physical register write."
    ) {
      return false;
    }
    if (!Array.isArray(sample.paletteBanks)) {
      return false;
    }
    const banks = sample.paletteBanks.map(object);
    if (
      banks.length !== declaration.paletteBanks.length ||
      new Set(banks.map((bank) => bank.bank)).size !== banks.length
    ) {
      return false;
    }
    return declaration.paletteBanks.every((expected) =>
      banks.some(
        (bank) =>
          bank.bank === expected.bank &&
          bank.covered === true &&
          typeof bank.bytes === "string" &&
          bank.bytes.toLowerCase() === expected.bytes,
      ),
    );
  };
  const boundaries = new Map(samples.map((entry, index) => [entry.start, index]));
  integer(declaration.ranges.length, "Observed ranges", 0, ASSET_LIMITS.frames);
  let rangeEnd = -1n;
  for (const range of declaration.ranges) {
    const first = boundaries.get(range.start),
      terminal = boundaries.get(range.end);
    if (
      first === undefined ||
      terminal === undefined ||
      terminal <= first ||
      range.start < rangeEnd
    ) {
      throw new Error("Observed range needs exact known sample boundaries.");
    }
    rangeEnd = range.end;
    const intervals: KnownPoseInterval[] = [];
    for (let index = first; index < terminal; index++) {
      const entry = samples[index],
        next = samples[index + 1];
      const step = next.start - entry.start;
      if (
        (step !== 357364n && step !== 357368n) ||
        entry.following !== next.upload ||
        !supported(entry)
      ) {
        gaps.push({
          start: entry.start,
          reason: "Unknown continuity, pose binding or physical display state.",
        });
        continue;
      }
      const last = intervals.at(-1);
      if (last?.pose === entry.pose && last.end === entry.start) {
        intervals[intervals.length - 1] = { pose: entry.pose, start: last.start, end: next.start };
      } else {
        intervals.push({ pose: entry.pose, start: entry.start, end: next.start });
      }
    }
    sequences.push({
      id: range.id,
      pivot: { ...declaration.pivot },
      intervals,
      ticksPerSecond: { numerator: 236250000n, denominator: 11n },
      provenance: {
        id: declaration.id,
        kind: "observation",
        source: `${declaration.capture}:${declaration.proofSha256}`,
      },
    });
  }
  return { sequences, gaps };
}

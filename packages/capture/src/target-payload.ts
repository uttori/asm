/** ACT2 instruction profiles are fixed wire contracts. Unknown identities must never be guessed. */
export interface SnesInstructionState {
  readonly a: number;
  readonly x: number;
  readonly y: number;
  readonly s: number;
  readonly d: number;
  readonly db: number;
  readonly pb: number;
  readonly pc: number;
  readonly p: number;
  readonly e: number;
}
/** Mapper registers and physical fetch offsets accompany the 2A03 CPU state. */
export interface NesInstructionState {
  readonly a: number;
  readonly x: number;
  readonly y: number;
  readonly s: number;
  readonly p: number;
  readonly pc: number;
  readonly mapper: number;
  readonly select: number;
  readonly prgMode: number;
  readonly chrMode: number;
  readonly ramEnabled: number;
  readonly ramWritable: number;
  readonly mirroring: number;
  readonly irqLatch: number;
  readonly irqEnabled: number;
  readonly r0: number;
  readonly r1: number;
  readonly r2: number;
  readonly r3: number;
  readonly r4: number;
  readonly r5: number;
  readonly r6: number;
  readonly r7: number;
  readonly prg0: number;
  readonly prg1?: number;
  readonly prg2?: number;
}
export type CaptureTargetPayload =
  | {
      readonly codec: "snes.65816";
      readonly version: 1;
      readonly state: Readonly<SnesInstructionState>;
    }
  | {
      readonly codec: "nes.2a03";
      readonly version: 1;
      readonly state: Readonly<NesInstructionState>;
    };

const snesLimits = {
  a: 65535,
  x: 65535,
  y: 65535,
  s: 65535,
  d: 65535,
  db: 255,
  pb: 255,
  pc: 65535,
  p: 255,
  e: 1,
};
const nesLimits = {
  a: 255,
  x: 255,
  y: 255,
  s: 255,
  p: 255,
  pc: 65535,
  mapper: 4,
  select: 7,
  prgMode: 1,
  chrMode: 1,
  ramEnabled: 1,
  ramWritable: 1,
  mirroring: 3,
  irqLatch: 255,
  irqEnabled: 1,
  r0: 255,
  r1: 255,
  r2: 255,
  r3: 255,
  r4: 255,
  r5: 255,
  r6: 255,
  r7: 255,
  prg0: 0xffffffff,
};

/** Validate and copy at the transport boundary; callers never retain an untrusted mutable input. */
export function readCaptureTargetPayload(
  codec: string,
  version: number,
  state: Readonly<Record<string, unknown>>,
): CaptureTargetPayload {
  if (version !== 1 || (codec !== "snes.65816" && codec !== "nes.2a03")) {
    throw new Error("Unsupported capture target codec/version.");
  }
  const limits = codec === "snes.65816" ? snesLimits : nesLimits;
  for (const [key, max] of Object.entries(limits)) {
    const value = state[key];
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > max) {
      throw new Error(`Invalid ${codec} register ${key}.`);
    }
  }
  for (const key of Object.keys(state)) {
    if (Object.hasOwn(limits, key)) {
      continue;
    }
    const value = state[key];
    if (
      codec !== "nes.2a03" ||
      !["prg1", "prg2"].includes(key) ||
      typeof value !== "number" ||
      !Number.isInteger(value) ||
      value < 0 ||
      value > 0xffffffff
    ) {
      throw new Error(`Unknown or invalid ${codec} field ${key}.`);
    }
  }
  if (codec === "nes.2a03" && state.mapper !== 0 && state.mapper !== 4) {
    throw new Error("Unsupported captured NES mapper.");
  }
  if (codec === "snes.65816") {
    if (!isSnesState(state)) {
      throw new Error("Invalid SNES state.");
    }
    return Object.freeze({ codec, version: 1, state: Object.freeze({ ...state }) });
  }
  if (!isNesState(state)) {
    throw new Error("Invalid NES state.");
  }
  return Object.freeze({ codec, version: 1, state: Object.freeze({ ...state }) });
}

// Register ranges and extra fields are checked above; these predicates establish the named fields.
function isSnesState(
  state: Readonly<Record<string, unknown>>,
): state is Readonly<Record<string, unknown>> & SnesInstructionState {
  return Object.keys(snesLimits).every((key) => typeof state[key] === "number");
}
function isNesState(
  state: Readonly<Record<string, unknown>>,
): state is Readonly<Record<string, unknown>> & NesInstructionState {
  return Object.keys(nesLimits).every((key) => typeof state[key] === "number");
}

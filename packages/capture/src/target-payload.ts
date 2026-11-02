/** ACT2 instruction profiles are fixed wire contracts. Unknown identities must never be guessed. */
export interface SnesInstructionState {
  /** Accumulator at the instruction boundary. */
  readonly a: number;
  /** Index X at the instruction boundary. */
  readonly x: number;
  /** Index Y at the instruction boundary. */
  readonly y: number;
  /** Stack pointer at the instruction boundary. */
  readonly s: number;
  /** Direct-page base at the instruction boundary. */
  readonly d: number;
  /** Data bank at the instruction boundary. */
  readonly db: number;
  /** Program bank at the instruction boundary. */
  readonly pb: number;
  /** Program counter at the instruction boundary. */
  readonly pc: number;
  /** Processor status byte at the instruction boundary. */
  readonly p: number;
  /** Emulation mode flag; only 0 or 1 is accepted on the wire. */
  readonly e: number;
}
/** Mapper registers and physical fetch offsets accompany the 2A03 CPU state. */
export interface NesInstructionState {
  /** Accumulator at the instruction boundary. */
  readonly a: number;
  /** Index X at the instruction boundary. */
  readonly x: number;
  /** Index Y at the instruction boundary. */
  readonly y: number;
  /** Stack pointer at the instruction boundary. */
  readonly s: number;
  /** Processor status byte at the instruction boundary. */
  readonly p: number;
  /** Program counter at the instruction boundary. */
  readonly pc: number;
  /** iNES mapper number captured with the instruction. */
  readonly mapper: number;
  /** MMC3 register-select latch when mapper 4 is active. */
  readonly select: number;
  /** MMC3 PRG banking mode when mapper 4 is active. */
  readonly prgMode: number;
  /** MMC3 CHR banking mode when mapper 4 is active. */
  readonly chrMode: number;
  /** MMC3 WRAM enable flag when mapper 4 is active. */
  readonly ramEnabled: number;
  /** MMC3 WRAM write-protect flag when mapper 4 is active. */
  readonly ramWritable: number;
  /** Nametable mirroring selector when mapper 4 is active. */
  readonly mirroring: number;
  /** MMC3 IRQ reload latch when mapper 4 is active. */
  readonly irqLatch: number;
  /** MMC3 IRQ enable flag when mapper 4 is active. */
  readonly irqEnabled: number;
  /** MMC3 bank register r0..r7 when mapper 4 is active. */
  readonly r0: number;
  /** MMC3 bank register r0..r7 when mapper 4 is active. */
  readonly r1: number;
  /** MMC3 bank register r0..r7 when mapper 4 is active. */
  readonly r2: number;
  /** MMC3 bank register r0..r7 when mapper 4 is active. */
  readonly r3: number;
  /** MMC3 bank register r0..r7 when mapper 4 is active. */
  readonly r4: number;
  /** MMC3 bank register r0..r7 when mapper 4 is active. */
  readonly r5: number;
  /** MMC3 bank register r0..r7 when mapper 4 is active. */
  readonly r6: number;
  /** MMC3 bank register r0..r7 when mapper 4 is active. */
  readonly r7: number;
  /** Physical PRG-ROM offset of the instruction fetch window base. */
  readonly prg0: number;
  /** Optional upper PRG window anchor when the mapper exposes it. */
  readonly prg1?: number;
  /** Optional fixed PRG window anchor when the mapper exposes it. */
  readonly prg2?: number;
}
/** Frozen instruction-state envelope keyed by target codec. */
export type CaptureTargetPayload =
  | {
      /** SNES 65816 ACT2 profile identifier. */
      readonly codec: "snes.65816";
      /** Wire version; only 1 is accepted. */
      readonly version: 1;
      /** Validated register snapshot for the SNES profile. */
      readonly state: Readonly<SnesInstructionState>;
    }
  | {
      /** NES 2A03 ACT2 profile identifier. */
      readonly codec: "nes.2a03";
      /** Wire version; only 1 is accepted. */
      readonly version: 1;
      /** Validated CPU and mapper snapshot for the NES profile. */
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
/**
 * Confirm every SNES wire field is present after range validation.
 * @param state Candidate register map.
 * @returns Whether the map satisfies the SNES profile shape.
 */
function isSnesState(
  state: Readonly<Record<string, unknown>>,
): state is Readonly<Record<string, unknown>> & SnesInstructionState {
  return Object.keys(snesLimits).every((key) => typeof state[key] === "number");
}
/**
 * Confirm every NES wire field is present after range validation.
 * @param state Candidate register map.
 * @returns Whether the map satisfies the NES profile shape.
 */
function isNesState(
  state: Readonly<Record<string, unknown>>,
): state is Readonly<Record<string, unknown>> & NesInstructionState {
  return Object.keys(nesLimits).every((key) => typeof state[key] === "number");
}

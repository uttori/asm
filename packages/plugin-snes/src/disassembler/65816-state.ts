import type { StaticInstruction } from "@uttori/asm-disassembler";

import type { Cpu65816DecodeState } from "../architectures/65816-decoder.js";

/**
 * Three-way lattice used for every tracked 65816 register and flag.
 * `known` is an exact value, `unknown` has no evidence, and `conflicting`
 * records distinct known values that met at a CFG join.
 */
export type Cpu65816AbstractValue =
  | { readonly kind: "known"; readonly value: number }
  | { readonly kind: "unknown" }
  | { readonly kind: "conflicting"; readonly values: readonly number[] };

/**
 * `PHP` snapshot of E/M/X/C restored by a later `PLP`.
 * Emulation (`e`) is included so `XCE` after `PLP` stays conservative.
 */
export interface Cpu65816StatusStackEntry {
  /** Discriminator for PHP/PLP status snapshots on the abstract stack. */
  readonly kind: "status";
  /** Emulation flag at the matching `PHP`. */
  readonly e: Cpu65816AbstractValue;
  /** Accumulator-width flag at the matching `PHP` (1 = 8-bit). */
  readonly m: Cpu65816AbstractValue;
  /** Index-width flag at the matching `PHP` (1 = 8-bit). */
  readonly x: Cpu65816AbstractValue;
  /** Carry flag at the matching `PHP`. Needed for `XCE`. */
  readonly carry: Cpu65816AbstractValue;
}

/** Register or immediate bytes pushed by `PHA`/`PHX`/`PHY`/`PHB`/`PHD`/`PEA`/`PEI`/`PER`. */
export interface Cpu65816ValueStackEntry {
  /** Discriminator for register or immediate bytes pushed onto the stack. */
  readonly kind: "value";
  /** Effect source id (`a`, `x`, `y`, `dbr`, `d`, `pbr`, or an immediate). */
  readonly source: string;
  /** Encoded width at the push. Pull must use the same width. */
  readonly bytes: 1 | 2;
  /** Abstract payload. `unknown` when the source register is not tracked. */
  readonly value: Cpu65816AbstractValue;
}

/**
 * One abstract stack slot. `unknown` is a hole of known width when the
 * pushed value itself cannot be tracked (for example `PHA` with unknown M).
 */
export type Cpu65816StackEntry =
  | Cpu65816StatusStackEntry
  | Cpu65816ValueStackEntry
  | { readonly kind: "unknown"; readonly bytes: 1 | 2 };

/**
 * Conservative stack prefix used by PHP/PLP and bank/page restores.
 * Only the top 16 entries are kept. Anything deeper is dropped.
 */
export type Cpu65816AbstractStack =
  | { readonly kind: "known"; readonly entries: readonly Cpu65816StackEntry[] }
  | { readonly kind: "unknown" }
  | { readonly kind: "conflicting" };

/**
 * Abstract 65816 CPU state consumed by decode and the static-analysis worklist.
 * Flag polarity matches hardware: M/X `1` is 8-bit, `0` is 16-bit. E=`1`
 * forces M=X=`1` after every transfer and join.
 */
export interface Cpu65816AbstractState {
  /** Emulation flag. */
  readonly e: Cpu65816AbstractValue;
  /** Accumulator/memory width (M). */
  readonly m: Cpu65816AbstractValue;
  /** Index width (X). */
  readonly x: Cpu65816AbstractValue;
  /** Carry. Tracked because `XCE` swaps it with E. */
  readonly carry: Cpu65816AbstractValue;
  /** Program bank (K / PBR). */
  readonly pbr: Cpu65816AbstractValue;
  /** Data bank (DBR). */
  readonly dbr: Cpu65816AbstractValue;
  /** Direct page (D). */
  readonly d: Cpu65816AbstractValue;
  /** Stack pointer (S). */
  readonly s: Cpu65816AbstractValue;
  /** Abstract stack prefix used to restore P/DBR/D after PHP/PHB/PHD. */
  readonly stack: Cpu65816AbstractStack;
}

/**
 * Partial known-state overlay from a project annotation, label, or entry point.
 * Booleans are accepted as `true` for 1 and `false` for 0. Unspecified fields are left alone.
 */
export interface Cpu65816StateOverride {
  /** Emulation flag. */
  readonly e?: 0 | 1 | boolean;
  /** Accumulator/memory width (M). 1 = 8-bit. */
  readonly m?: 0 | 1 | boolean;
  /** Index width (X). 1 = 8-bit. */
  readonly x?: 0 | 1 | boolean;
  /** Carry. Used with `XCE`. */
  readonly carry?: 0 | 1 | boolean;
  /** Program bank (PBR), masked to 8 bits. */
  readonly programBank?: number;
  /** Data bank (DBR), masked to 8 bits. */
  readonly dataBank?: number;
  /** Direct page (D), masked to 16 bits. */
  readonly directPage?: number;
  /** Stack pointer (S), masked to 16 bits. */
  readonly stackPointer?: number;
}

/** Lattice bottom representing no evidence for a flag or register. */
const unknown = (): Cpu65816AbstractValue => ({ kind: "unknown" });
/** Lift a concrete hardware value into the analysis lattice. */
const known = (value: number): Cpu65816AbstractValue => ({ kind: "known", value });

/**
 * Join two abstract scalar values at a CFG merge.
 * @param left State from one predecessor edge.
 * @param right State from another predecessor edge.
 */
const joinValue = (
  left: Cpu65816AbstractValue,
  right: Cpu65816AbstractValue,
): Cpu65816AbstractValue => {
  if (left.kind === "unknown" || right.kind === "unknown") {
    return unknown();
  }
  if (left.kind === "known" && right.kind === "known") {
    return left.value === right.value
      ? left
      : { kind: "conflicting", values: [left.value, right.value].toSorted((a, b) => a - b) };
  }
  const values = new Set<number>([
    ...(left.kind === "known" ? [left.value] : left.values),
    ...(right.kind === "known" ? [right.value] : right.values),
  ]);
  return { kind: "conflicting", values: [...values].toSorted((a, b) => a - b) };
};

/**
 * Compare abstract stack entries for equality at a join point.
 * @param left Entry from one predecessor.
 * @param right Entry from another predecessor at the same depth.
 */
const sameEntry = (left: Cpu65816StackEntry, right: Cpu65816StackEntry): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

/**
 * Join abstract stack prefixes when both sides are known and equal depth.
 * @param left Stack snapshot from one predecessor.
 * @param right Stack snapshot from another predecessor.
 */
const joinStack = (
  left: Cpu65816AbstractStack,
  right: Cpu65816AbstractStack,
): Cpu65816AbstractStack => {
  if (left.kind === "unknown" || right.kind === "unknown") {
    return { kind: "unknown" };
  }
  if (left.kind === "conflicting" || right.kind === "conflicting") {
    return { kind: "conflicting" };
  }
  if (left.entries.length !== right.entries.length) {
    return { kind: "conflicting" };
  }
  return left.entries.every((entry, index) => sameEntry(entry, right.entries[index]))
    ? left
    : { kind: "conflicting" };
};

/** Force 8-bit M/X whenever emulation mode is known to be active. */
const normalize = (state: Cpu65816AbstractState): Cpu65816AbstractState =>
  state.e.kind === "known" && state.e.value === 1 ? { ...state, m: known(1), x: known(1) } : state;

/**
 * Fully unknown state. Used when a seed has no hardware or annotation evidence.
 * @returns Every register and the stack are `unknown`.
 */
export const unknownCpu65816State = (): Cpu65816AbstractState => ({
  e: unknown(),
  m: unknown(),
  x: unknown(),
  carry: unknown(),
  pbr: unknown(),
  dbr: unknown(),
  d: unknown(),
  s: unknown(),
  stack: { kind: "unknown" },
});

/**
 * Hardware RESET: emulation, 8-bit A/XY, PBR=DBR=0, D=0, S=$01FF, empty stack.
 * Carry is unknown. Matches the 65816 coming out of `/RESET`.
 * @returns State for the `$00FFFC` RESET vector target.
 */
export const resetCpu65816State = (): Cpu65816AbstractState => ({
  e: known(1),
  m: known(1),
  x: known(1),
  carry: unknown(),
  pbr: known(0),
  dbr: known(0),
  d: known(0),
  s: known(0x01ff),
  stack: { kind: "known", entries: [] },
});

/**
 * Native-mode interrupt entry: E=0 and PBR=0. M/X/C/DBR/D/S/stack stay unknown.
 * @returns State for native COP/BRK/ABORT/NMI/IRQ.
 */
export const nativeVectorCpu65816State = (): Cpu65816AbstractState => ({
  ...unknownCpu65816State(),
  e: known(0),
  pbr: known(0),
});

/**
 * Emulation-mode interrupt entry: E=M=X=1 and PBR=0. C/DBR/D/S/stack stay unknown.
 * @returns State for emulation COP/ABORT/NMI/IRQ/BRK.
 */
export const emulationVectorCpu65816State = (): Cpu65816AbstractState => ({
  ...unknownCpu65816State(),
  e: known(1),
  m: known(1),
  x: known(1),
  pbr: known(0),
});

/**
 * Lattice join at a CFG merge. `unknown` absorbs. Two distinct known values
 * become `conflicting`. E=1 still forces M=X=1 after the join.
 * @param left Incoming state from one predecessor.
 * @param right Incoming state from another predecessor.
 * @returns The least upper bound of both states.
 */
export const joinCpu65816States = (
  left: Cpu65816AbstractState,
  right: Cpu65816AbstractState,
): Cpu65816AbstractState =>
  normalize({
    e: joinValue(left.e, right.e),
    m: joinValue(left.m, right.m),
    x: joinValue(left.x, right.x),
    carry: joinValue(left.carry, right.carry),
    pbr: joinValue(left.pbr, right.pbr),
    dbr: joinValue(left.dbr, right.dbr),
    d: joinValue(left.d, right.d),
    s: joinValue(left.s, right.s),
    stack: joinStack(left.stack, right.stack),
  });

/**
 * Convert a project boolean override into a known lattice value.
 * @param value Optional 0/1 or boolean from metadata.
 */
const flagOverride = (value: 0 | 1 | boolean | undefined): Cpu65816AbstractValue | undefined =>
  value === undefined ? undefined : known(value === true || value === 1 ? 1 : 0);

/**
 * Overlays known fields from a project annotation or configured entry point.
 * Banks are masked to 8 bits. D and S are masked to 16 bits.
 * @param state State to update.
 * @param override Partial known values to apply.
 * @returns Normalized state with the overlay applied.
 */
export const applyCpu65816StateOverride = (
  state: Cpu65816AbstractState,
  override: Cpu65816StateOverride,
): Cpu65816AbstractState =>
  normalize({
    ...state,
    ...(flagOverride(override.e) ? { e: flagOverride(override.e)! } : {}),
    ...(flagOverride(override.m) ? { m: flagOverride(override.m)! } : {}),
    ...(flagOverride(override.x) ? { x: flagOverride(override.x)! } : {}),
    ...(flagOverride(override.carry) ? { carry: flagOverride(override.carry)! } : {}),
    ...(override.programBank === undefined ? {} : { pbr: known(override.programBank & 0xff) }),
    ...(override.dataBank === undefined ? {} : { dbr: known(override.dataBank & 0xff) }),
    ...(override.directPage === undefined ? {} : { d: known(override.directPage & 0xffff) }),
    ...(override.stackPointer === undefined ? {} : { s: known(override.stackPointer & 0xffff) }),
  });

/**
 * Sets PBR from bits 23–16 of a 24-bit CPU address before decode at that PC.
 * @param state Incoming state.
 * @param address 24-bit SNES CPU address being entered.
 * @returns `state` with PBR replaced.
 */
export const enterCpu65816Address = (
  state: Cpu65816AbstractState,
  address: number,
): Cpu65816AbstractState => ({ ...state, pbr: known((address >>> 16) & 0xff) });

/**
 * Project a lattice flag onto decoder-compatible 0/1 or unknown.
 * @param value Abstract E/M/X/carry value at the instruction.
 */
const decoderFlag = (value: Cpu65816AbstractValue): 0 | 1 | "unknown" =>
  value.kind === "known" && (value.value === 0 || value.value === 1) ? value.value : "unknown";

/**
 * Projects the analysis lattice onto decoder flags. Known E/M/X become 0/1.
 * Anything else is `"unknown"`. Known PBR/DBR/D are copied when present.
 * @param state Analysis state at the instruction.
 * @returns Decoder input. Omitted banks/page stay unset.
 */
export const cpu65816DecodeState = (state: Cpu65816AbstractState): Cpu65816DecodeState => ({
  e: decoderFlag(state.e),
  m: decoderFlag(state.m),
  x: decoderFlag(state.x),
  ...(state.pbr.kind === "known" ? { programBank: state.pbr.value } : {}),
  ...(state.dbr.kind === "known" ? { dataBank: state.dbr.value } : {}),
  ...(state.d.kind === "known" ? { directPage: state.d.value } : {}),
});

/**
 * Apply a push/pull delta to S when its value is known, honoring emulation stack rules.
 * @param state Incoming CPU state including S and E.
 * @param delta Signed byte change from a push or pull.
 */
const adjustStackPointer = (state: Cpu65816AbstractState, delta: number): Cpu65816AbstractValue => {
  if (state.s.kind !== "known") {
    return state.s.kind === "conflicting" ? state.s : unknown();
  }
  let value = (state.s.value + delta) & 0xffff;
  if (state.e.kind === "known" && state.e.value === 1) {
    value = 0x0100 | (value & 0xff);
  }
  return known(value);
};

/**
 * Push one abstract stack entry and decrement S by its encoded width.
 * @param state CPU state before the push.
 * @param entry Status, value, or unknown hole being pushed.
 */
const push = (state: Cpu65816AbstractState, entry: Cpu65816StackEntry): Cpu65816AbstractState => {
  const bytes = entry.kind === "status" ? 1 : entry.bytes;
  const stack =
    state.stack.kind === "known"
      ? { kind: "known" as const, entries: [entry, ...state.stack.entries].slice(0, 16) }
      : state.stack;
  return { ...state, s: adjustStackPointer(state, -bytes), stack };
};

/**
 * Pop the top stack entry when the prefix is known, adjusting S upward.
 * @param state CPU state before the pull.
 * @param bytes Width of the value being pulled.
 */
const pull = (
  state: Cpu65816AbstractState,
  bytes: 1 | 2,
): readonly [Cpu65816AbstractState, Cpu65816StackEntry | undefined] => {
  if (state.stack.kind !== "known") {
    return [{ ...state, s: adjustStackPointer(state, bytes) }, undefined];
  }
  const entry = state.stack.entries[0];
  return [
    {
      ...state,
      s: adjustStackPointer(state, bytes),
      stack: { kind: "known", entries: state.stack.entries.slice(1) },
    },
    entry,
  ];
};

/**
 * Determine how many bytes a push instruction writes given current M/X flags.
 * @param mnemonic Push opcode being modeled.
 * @param state CPU state supplying width flags.
 */
const pushedBytes = (mnemonic: string, state: Cpu65816AbstractState): 1 | 2 | undefined => {
  if (mnemonic === "PHA") {
    const flag = decoderFlag(state.m);
    if (flag === "unknown") {
      return undefined;
    }
    return flag === 0 ? 2 : 1;
  }
  if (mnemonic === "PHX" || mnemonic === "PHY") {
    const flag = decoderFlag(state.x);
    if (flag === "unknown") {
      return undefined;
    }
    return flag === 0 ? 2 : 1;
  }
  return mnemonic === "PHD" || mnemonic === "PEA" || mnemonic === "PEI" || mnemonic === "PER"
    ? 2
    : 1;
};

/**
 * Determine pull width for PLA/PLX/PLY and two-byte stack restores.
 * @param target Register or pseudo-register name being pulled.
 * @param state CPU state supplying width flags.
 */
const pulledBytes = (target: string, state: Cpu65816AbstractState): 1 | 2 | undefined => {
  if (target === "a") {
    const flag = decoderFlag(state.m);
    if (flag === "unknown") {
      return undefined;
    }
    return flag === 0 ? 2 : 1;
  }
  if (target === "x" || target === "y") {
    const flag = decoderFlag(state.x);
    if (flag === "unknown") {
      return undefined;
    }
    return flag === 0 ? 2 : 1;
  }
  return target === "d" || target === "pc" ? 2 : 1;
};

/** Discard tracked stack contents after an unmodeled stack manipulation. */
const loseStackPrecision = (state: Cpu65816AbstractState): Cpu65816AbstractState => ({
  ...state,
  s: unknown(),
  stack: { kind: "unknown" },
});

/**
 * Read an abstract register value referenced by a stack push source id.
 * @param source Effect source (`pbr`, `dbr`, `d`, …).
 * @param state CPU state at the push site.
 */
const sourceValue = (source: string, state: Cpu65816AbstractState): Cpu65816AbstractValue => {
  if (source === "pbr") {
    return state.pbr;
  }
  if (source === "dbr") {
    return state.dbr;
  }
  if (source === "d") {
    return state.d;
  }
  return unknown();
};

const CARRY_UNKNOWN_MNEMONICS = new Set([
  "ADC",
  "ASL",
  "CMP",
  "CPX",
  "CPY",
  "LSR",
  "ROL",
  "ROR",
  "SBC",
]);

/**
 * Applies one instruction's decoded effects conservatively.
 * Tracks SEP/REP, PHP/PLP, PHB/PLB, PHD/PLD, XCE, and TCD/TCS. Loses stack
 * precision on `BRK`/`COP`/`JSR`/`JSL` and when M/X width is unknown at a push/pull.
 * @param instruction Normalized instruction from the worklist.
 * @param input State immediately before the instruction.
 * @returns Outgoing state after effects and E=1 forcing.
 */
export const transferCpu65816State = (
  instruction: StaticInstruction,
  input: Cpu65816AbstractState,
): Cpu65816AbstractState => {
  const state = { ...input };
  for (const effect of instruction.effects) {
    if ((effect.kind === "clearBits" || effect.kind === "setBits") && effect.target === "p") {
      const value = effect.kind === "setBits" ? 1 : 0;
      Object.assign(
        state,
        effect.mask & 0x01 ? { carry: known(value) } : {},
        effect.mask & 0x10 ? { x: known(value) } : {},
        effect.mask & 0x20 ? { m: known(value) } : {},
      );
    } else if (effect.kind === "push") {
      if (effect.source === "p") {
        Object.assign(
          state,
          push(state, {
            kind: "status",
            e: state.e,
            m: state.m,
            x: state.x,
            carry: state.carry,
          }),
        );
      } else {
        const bytes = pushedBytes(instruction.mnemonic, state);
        if (bytes === undefined) {
          Object.assign(state, loseStackPrecision(state));
          continue;
        }
        Object.assign(
          state,
          push(state, {
            kind: "value",
            source: effect.source,
            bytes,
            value: sourceValue(effect.source, state),
          }),
        );
      }
    } else if (effect.kind === "pull") {
      const bytes = pulledBytes(effect.target, state);
      if (bytes === undefined) {
        Object.assign(state, loseStackPrecision(state));
        continue;
      }
      const [pulledState, entry] = pull(state, bytes);
      Object.assign(state, pulledState);
      if (effect.target === "p") {
        Object.assign(
          state,
          entry?.kind === "status"
            ? {
                e: entry.e,
                m: entry.m,
                x: entry.x,
                carry: entry.carry,
              }
            : { m: unknown(), x: unknown(), carry: unknown() },
        );
      } else if (effect.target === "dbr") {
        Object.assign(state, {
          dbr:
            entry?.kind === "value" && entry.value.kind === "known"
              ? known(entry.value.value & 0xff)
              : unknown(),
        });
      } else if (effect.target === "d") {
        Object.assign(state, {
          d: entry?.kind === "value" ? entry.value : unknown(),
        });
      }
    } else if (effect.kind === "exchange" && effect.left === "c" && effect.right === "e") {
      Object.assign(state, { carry: state.e, e: state.carry });
    } else if (effect.kind === "copy" && effect.to === "d") {
      Object.assign(state, { d: unknown() });
    } else if (effect.kind === "copy" && effect.to === "s") {
      Object.assign(state, { s: unknown(), stack: { kind: "unknown" } });
    }
  }

  if (CARRY_UNKNOWN_MNEMONICS.has(instruction.mnemonic)) {
    Object.assign(state, { carry: unknown() });
  }
  if (["BRK", "COP", "JSL", "JSR"].includes(instruction.mnemonic)) {
    Object.assign(state, loseStackPrecision(state));
  }
  if (instruction.mnemonic === "RTI") {
    Object.assign(state, { pbr: unknown(), stack: { kind: "unknown" } });
  }
  return normalize(state);
};

/**
 * Stable worklist identity for a state. JSON order matches object insertion.
 * @param state State to key.
 * @returns Canonical JSON used as a CFG node context key.
 */
export const cpu65816StateKey = (state: Cpu65816AbstractState): string => JSON.stringify(state);

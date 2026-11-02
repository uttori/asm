import type { StaticInstruction } from "@uttori/asm-disassembler";

import type { Spc700DecodeState } from "../architectures/spc700-decoder.js";

/** Abstract value for the PSW.P-selected direct-page base. */
export type Spc700DirectPageValue =
  | { readonly kind: "known"; readonly value: 0 | 0x100 }
  | { readonly kind: "unknown" }
  | { readonly kind: "conflicting"; readonly values: readonly (0 | 0x100)[] };

/** One explicitly pushed byte tracked above an unknown pre-analysis stack tail. */
export type Spc700StackEntry =
  | { readonly kind: "status"; readonly directPage: Spc700DirectPageValue }
  | { readonly kind: "unknown" };

/** Conservative known stack prefix. Deeper pre-analysis bytes remain unknown. */
export interface Spc700AbstractStack {
  /** Most recently pushed byte first; capped at 16 entries. */
  readonly entries: readonly Spc700StackEntry[];
}

/** SPC700 state needed for direct-page address resolution. */
export interface Spc700AbstractState {
  /** Direct-page base selected by PSW.P. */
  readonly directPage: Spc700DirectPageValue;
  /** Tracked stack prefix used to restore PSW.P across `PUSH PSW`/`POP PSW`. */
  readonly stack: Spc700AbstractStack;
}

/** Explicit state overlay accepted on an SPC700 analysis entry point. */
export interface Spc700StateOverride {
  /** Known direct-page base; omitted leaves the incoming value. */
  readonly directPage?: 0 | 0x100;
}

/**
 * Creates the absorbing unknown direct-page value.
 * @returns Unknown direct page.
 */
const unknown = (): Spc700DirectPageValue => ({ kind: "unknown" });
/**
 * Wraps a concrete direct-page base.
 * @param value `$0000` or `$0100`.
 * @returns Known direct page.
 */
const known = (value: 0 | 0x100): Spc700DirectPageValue => ({ kind: "known", value });

/**
 * Fully unknown reset-independent SPC700 state.
 * @returns Unknown direct page with no tracked stack prefix.
 */
export const unknownSpc700State = (): Spc700AbstractState => ({
  directPage: unknown(),
  stack: { entries: [] },
});

/**
 * Applies a manual direct-page overlay without changing the tracked stack prefix.
 * @param state Incoming state.
 * @param override Known values to overlay.
 * @returns Updated state.
 */
export const applySpc700StateOverride = (
  state: Spc700AbstractState,
  override: Spc700StateOverride,
): Spc700AbstractState =>
  override.directPage === undefined ? state : { ...state, directPage: known(override.directPage) };

/**
 * Joins direct-page values: unknown wins; otherwise the union of candidate bases is
 * known when it has one member and conflicting, sorted ascending, when it has two.
 * @param left First incoming value.
 * @param right Second incoming value.
 * @returns Joined value.
 */
const joinDirectPage = (
  left: Spc700DirectPageValue,
  right: Spc700DirectPageValue,
): Spc700DirectPageValue => {
  if (left.kind === "unknown" || right.kind === "unknown") {
    return unknown();
  }
  const values = new Set<0 | 0x100>([
    ...(left.kind === "known" ? [left.value] : left.values),
    ...(right.kind === "known" ? [right.value] : right.values),
  ]);
  if (values.size === 1) {
    return known([...values][0]);
  }
  return { kind: "conflicting", values: [...values].toSorted((a, b) => a - b) };
};

/**
 * Structural equality for stack entries.
 * @param left First entry.
 * @param right Second entry.
 * @returns Whether both entries serialize identically.
 */
const sameStackEntry = (left: Spc700StackEntry, right: Spc700StackEntry): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

/**
 * Keeps only the longest common top-of-stack prefix; deeper bytes become unknown.
 * @param left First incoming stack.
 * @param right Second incoming stack.
 * @returns Joined stack.
 */
const joinStack = (left: Spc700AbstractStack, right: Spc700AbstractStack): Spc700AbstractStack => {
  const entries: Spc700StackEntry[] = [];
  const length = Math.min(left.entries.length, right.entries.length);
  for (let index = 0; index < length; index++) {
    if (!sameStackEntry(left.entries[index], right.entries[index])) {
      break;
    }
    entries.push(left.entries[index]);
  }
  return { entries };
};

/**
 * Conservative lattice join at an SPC700 CFG merge.
 * @param left First incoming state.
 * @param right Second incoming state.
 * @returns Joined state.
 */
export const joinSpc700States = (
  left: Spc700AbstractState,
  right: Spc700AbstractState,
): Spc700AbstractState => ({
  directPage: joinDirectPage(left.directPage, right.directPage),
  stack: joinStack(left.stack, right.stack),
});

/**
 * Stable serialization used by the generic worklist's fixed-point check.
 * @param state State to identify.
 * @returns Deterministic state key.
 */
export const spc700StateKey = (state: Spc700AbstractState): string => JSON.stringify(state);

/**
 * Projects abstract PSW.P knowledge into the decoder's direct-page base.
 * @param state Abstract analysis state.
 * @returns Decoder input.
 */
export const spc700DecodeState = (state: Spc700AbstractState): Spc700DecodeState => ({
  directPage: state.directPage.kind === "known" ? state.directPage.value : "unknown",
});

/**
 * Pushes one tracked byte, discarding entries beyond the 16-entry prefix bound.
 * @param state Incoming state.
 * @param entry Pushed byte.
 * @returns State with the new top entry.
 */
const push = (state: Spc700AbstractState, entry: Spc700StackEntry): Spc700AbstractState => ({
  ...state,
  stack: { entries: [entry, ...state.stack.entries].slice(0, 16) },
});

/**
 * Pops the top tracked byte.
 * @param state Incoming state.
 * @returns Remaining state and the popped entry, `undefined` when the prefix was empty.
 */
const pop = (
  state: Spc700AbstractState,
): readonly [Spc700AbstractState, Spc700StackEntry | undefined] => [
  { ...state, stack: { entries: state.stack.entries.slice(1) } },
  state.stack.entries[0],
];

/**
 * Applies declarative PSW and explicit PUSH/POP effects to SPC700 state.
 * @param instruction Decoded instruction and declarative effects.
 * @param incoming Incoming state.
 * @returns Outgoing state.
 */
export const transferSpc700State = (
  instruction: StaticInstruction,
  incoming: Spc700AbstractState,
): Spc700AbstractState => {
  const state = { ...incoming };
  for (const effect of instruction.effects) {
    if (effect.kind === "clearBits" && effect.target === "p" && (effect.mask & 0x20) !== 0) {
      Object.assign(state, { directPage: known(0) });
    } else if (effect.kind === "setBits" && effect.target === "p" && (effect.mask & 0x20) !== 0) {
      Object.assign(state, { directPage: known(0x100) });
    } else if (effect.kind === "push") {
      Object.assign(
        state,
        push(
          state,
          instruction.mode === "registerP"
            ? { kind: "status", directPage: state.directPage }
            : { kind: "unknown" },
        ),
      );
    } else if (effect.kind === "pull" && effect.target === "operand-register") {
      const [popped, entry] = pop(state);
      Object.assign(state, popped);
      if (instruction.mode === "registerP") {
        Object.assign(state, {
          directPage: entry?.kind === "status" ? entry.directPage : unknown(),
        });
      }
    } else if (effect.kind === "pull" && effect.target === "p") {
      Object.assign(state, { directPage: unknown(), stack: { entries: [] } });
    }
  }
  return state;
};

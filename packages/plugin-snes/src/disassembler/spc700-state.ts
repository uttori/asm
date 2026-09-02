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

/** Conservative known stack prefix; deeper pre-analysis bytes remain unknown. */
export interface Spc700AbstractStack {
  readonly entries: readonly Spc700StackEntry[];
}

/** SPC700 state needed for direct-page address resolution. */
export interface Spc700AbstractState {
  readonly directPage: Spc700DirectPageValue;
  readonly stack: Spc700AbstractStack;
}

/** Explicit state overlay accepted on an SPC700 analysis entry point. */
export interface Spc700StateOverride {
  readonly directPage?: 0 | 0x100;
}

const unknown = (): Spc700DirectPageValue => ({ kind: "unknown" });
const known = (value: 0 | 0x100): Spc700DirectPageValue => ({ kind: "known", value });

/**
 * Fully unknown reset-independent SPC700 state.
 * @returns {Spc700AbstractState} Unknown direct page with no tracked stack prefix.
 */
export const unknownSpc700State = (): Spc700AbstractState => ({
  directPage: unknown(),
  stack: { entries: [] },
});

/**
 * Applies a manual direct-page overlay without changing the tracked stack prefix.
 * @param {Spc700AbstractState} state Incoming state.
 * @param {Spc700StateOverride} override Known values to overlay.
 * @returns {Spc700AbstractState} Updated state.
 */
export const applySpc700StateOverride = (
  state: Spc700AbstractState,
  override: Spc700StateOverride,
): Spc700AbstractState =>
  override.directPage === undefined ? state : { ...state, directPage: known(override.directPage) };

const joinDirectPage = (
  left: Spc700DirectPageValue,
  right: Spc700DirectPageValue,
): Spc700DirectPageValue => {
  if (left.kind === "unknown" || right.kind === "unknown") return unknown();
  const values = new Set<0 | 0x100>([
    ...(left.kind === "known" ? [left.value] : left.values),
    ...(right.kind === "known" ? [right.value] : right.values),
  ]);
  if (values.size === 1) return known([...values][0]);
  return { kind: "conflicting", values: [...values].sort((a, b) => a - b) };
};

const sameStackEntry = (left: Spc700StackEntry, right: Spc700StackEntry): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

const joinStack = (left: Spc700AbstractStack, right: Spc700AbstractStack): Spc700AbstractStack => {
  const entries: Spc700StackEntry[] = [];
  const length = Math.min(left.entries.length, right.entries.length);
  for (let index = 0; index < length; index++) {
    if (!sameStackEntry(left.entries[index], right.entries[index])) break;
    entries.push(left.entries[index]);
  }
  return { entries };
};

/**
 * Conservative lattice join at an SPC700 CFG merge.
 * @param {Spc700AbstractState} left First incoming state.
 * @param {Spc700AbstractState} right Second incoming state.
 * @returns {Spc700AbstractState} Joined state.
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
 * @param {Spc700AbstractState} state State to identify.
 * @returns {string} Deterministic state key.
 */
export const spc700StateKey = (state: Spc700AbstractState): string => JSON.stringify(state);

/**
 * Projects abstract PSW.P knowledge into the decoder's direct-page base.
 * @param {Spc700AbstractState} state Abstract analysis state.
 * @returns {Spc700DecodeState} Decoder input.
 */
export const spc700DecodeState = (state: Spc700AbstractState): Spc700DecodeState => ({
  directPage: state.directPage.kind === "known" ? state.directPage.value : "unknown",
});

const push = (state: Spc700AbstractState, entry: Spc700StackEntry): Spc700AbstractState => ({
  ...state,
  stack: { entries: [entry, ...state.stack.entries].slice(0, 16) },
});

const pop = (
  state: Spc700AbstractState,
): readonly [Spc700AbstractState, Spc700StackEntry | undefined] => [
  { ...state, stack: { entries: state.stack.entries.slice(1) } },
  state.stack.entries[0],
];

/**
 * Applies declarative PSW and explicit PUSH/POP effects to SPC700 state.
 * @param {StaticInstruction} instruction Decoded instruction and declarative effects.
 * @param {Spc700AbstractState} incoming Incoming state.
 * @returns {Spc700AbstractState} Outgoing state.
 */
export const transferSpc700State = (
  instruction: StaticInstruction,
  incoming: Spc700AbstractState,
): Spc700AbstractState => {
  let state = incoming;
  for (const effect of instruction.effects) {
    if (effect.kind === "clearBits" && effect.target === "p" && (effect.mask & 0x20) !== 0) {
      state = { ...state, directPage: known(0) };
    } else if (effect.kind === "setBits" && effect.target === "p" && (effect.mask & 0x20) !== 0) {
      state = { ...state, directPage: known(0x100) };
    } else if (effect.kind === "push") {
      state = push(
        state,
        instruction.mode === "registerP"
          ? { kind: "status", directPage: state.directPage }
          : { kind: "unknown" },
      );
    } else if (effect.kind === "pull" && effect.target === "operand-register") {
      const [popped, entry] = pop(state);
      state =
        instruction.mode === "registerP"
          ? {
              ...popped,
              directPage: entry?.kind === "status" ? entry.directPage : unknown(),
            }
          : popped;
    } else if (effect.kind === "pull" && effect.target === "p") {
      state = { ...state, directPage: unknown(), stack: { entries: [] } };
    }
  }
  return state;
};

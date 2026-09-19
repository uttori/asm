import type { DecodedInstruction } from "@uttori/asm-core";

import type { SuperFxDecodeState } from "../architectures/superfx-decoder.js";
import type { SuperFxAltState } from "../architectures/superfx-spec.js";

export type SuperFxKnown<T extends number> =
  | { readonly kind: "known"; readonly value: T }
  | { readonly kind: "unknown" }
  | { readonly kind: "conflict" };

export interface SuperFxAbstractState {
  readonly alt: SuperFxKnown<SuperFxAltState>;
  readonly destinationRegister: SuperFxKnown<number>;
  readonly sourceRegister: SuperFxKnown<number>;
  readonly programBank: SuperFxKnown<number>;
}

const known = <T extends number>(value: T): SuperFxKnown<T> => ({ kind: "known", value });
const unknown = <T extends number>(): SuperFxKnown<T> => ({ kind: "unknown" });

export const initialSuperFxState = (programBank?: number): SuperFxAbstractState => ({
  alt: known(0),
  destinationRegister: known(0),
  sourceRegister: known(0),
  programBank: programBank === undefined ? unknown() : known(programBank & 0xff),
});

const joinValue = <T extends number>(
  left: SuperFxKnown<T>,
  right: SuperFxKnown<T>,
): SuperFxKnown<T> => {
  if (left.kind === "unknown" || right.kind === "unknown") {
    return { kind: "unknown" };
  }
  if (left.kind === "conflict" || right.kind === "conflict") {
    return { kind: "conflict" };
  }
  return left.value === right.value ? left : { kind: "conflict" };
};

export const joinSuperFxStates = (
  left: SuperFxAbstractState,
  right: SuperFxAbstractState,
): SuperFxAbstractState => ({
  alt: joinValue(left.alt, right.alt),
  destinationRegister: joinValue(left.destinationRegister, right.destinationRegister),
  sourceRegister: joinValue(left.sourceRegister, right.sourceRegister),
  programBank: joinValue(left.programBank, right.programBank),
});

const decodeValue = <T extends number>(value: SuperFxKnown<T>): T | "unknown" =>
  value.kind === "known" ? value.value : "unknown";

export const superFxDecodeState = (state: SuperFxAbstractState): SuperFxDecodeState => ({
  alt: decodeValue(state.alt),
  destinationRegister: decodeValue(state.destinationRegister),
  sourceRegister: decodeValue(state.sourceRegister),
  programBank: decodeValue(state.programBank),
});

export const enterSuperFxAddress = (
  state: SuperFxAbstractState,
  address: number,
): SuperFxAbstractState => ({ ...state, programBank: known((address >>> 16) & 0xff) });

const detailNumber = (
  instruction: Pick<DecodedInstruction, "effects">,
  name: string,
): number | undefined => {
  const effect = instruction.effects.find(
    (entry) => entry.kind === "custom" && entry.name === name,
  );
  if (effect?.kind !== "custom") {
    return undefined;
  }
  const value = effect.details?.register ?? effect.details?.alt;
  return typeof value === "number" ? value : undefined;
};

export const transferSuperFxState = (
  instruction: Pick<DecodedInstruction, "effects">,
  state: SuperFxAbstractState,
): SuperFxAbstractState => {
  const alt = detailNumber(instruction, "set-superfx-alt");
  if (alt !== undefined) {
    return {
      ...state,
      alt:
        state.alt.kind === "known"
          ? known(((state.alt.value | alt) & 3) as SuperFxAltState)
          : state.alt,
    };
  }
  const destination = detailNumber(instruction, "select-superfx-destination");
  if (destination !== undefined) {
    return { ...state, destinationRegister: known(destination) };
  }
  const paired = detailNumber(instruction, "select-superfx-source-destination");
  if (paired !== undefined) {
    return {
      ...state,
      destinationRegister: known(paired),
      sourceRegister: known(paired),
    };
  }
  const source = detailNumber(instruction, "select-superfx-source");
  if (source !== undefined) {
    return { ...state, sourceRegister: known(source) };
  }
  return {
    ...state,
    alt: known(0),
    destinationRegister: known(0),
    sourceRegister: known(0),
  };
};

export const superFxStateKey = (state: SuperFxAbstractState): string =>
  JSON.stringify([state.alt, state.destinationRegister, state.sourceRegister, state.programBank]);

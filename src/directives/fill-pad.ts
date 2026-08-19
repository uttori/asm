import type { DirectiveRegistry } from "./registry.js";
import type { FillPadDirectiveContext } from "./types.js";

const getDirectiveWidth = (keyword: string, prefix: "fill" | "pad"): number => {
  if (keyword === `${prefix}byte`) return 1;
  if (keyword === `${prefix}word`) return 2;
  if (keyword === `${prefix}long`) return 3;
  if (keyword === "paddword" || keyword === "filldword") return 4;
  throw new Error(`Unrecognized ${prefix} directive.`);
};

export const handleFillPattern = (
  { session, operandResolver }: FillPadDirectiveContext,
  words: string[],
): void => {
  const keyword = words[0];
  const len = getDirectiveWidth(keyword, "fill");

  if (words.length !== 2) {
    throw new Error(`${keyword.toUpperCase()} directive requires exactly one parameter.`);
  }

  const value = operandResolver.getnum(session.resolvedefines(words[1]));
  for (let i = 0; i < 12; i += len) {
    let current = value;
    for (let j = 0; j < len; j++) {
      session.fillbyte[i + j] = current & 0xff;
      current >>>= 8;
    }
  }
};

export const handleFill = (
  { session, operandResolver }: FillPadDirectiveContext,
  words: string[],
): void => {
  if (words.length !== 2) {
    throw new Error("FILL directive requires exactly one parameter (number of bytes to fill).");
  }

  const count = operandResolver.getnum(session.resolvedefines(words[1]));
  for (let i = 0; i < count; i++) {
    session.write1(session.fillbyte[i % 12]);
  }
};

export const handlePadPattern = (
  { session, operandResolver }: FillPadDirectiveContext,
  words: string[],
): void => {
  const keyword = words[0];
  const len = getDirectiveWidth(keyword, "pad");

  if (words.length !== 2) {
    throw new Error(`${keyword.toUpperCase()} directive requires exactly one parameter.`);
  }

  const value = operandResolver.getnum(session.resolvedefines(words[1]));
  session.padUnit = len;
  for (let i = 0; i < len; i++) {
    session.padbyte[i] = (value >> (8 * i)) & 0xff;
  }
};

export const handlePad = (
  { session, operandResolver }: FillPadDirectiveContext,
  words: string[],
): void => {
  let gap: number;

  if (words.length === 1) {
    const currentBank = session.currentTargetAddress & 0xff0000;
    const bankOffset = session.currentTargetAddress & 0xffff;
    const nextBank =
      bankOffset === 0xffff ? currentBank + 0x10000 : currentBank + 0x10000 - bankOffset;
    gap = nextBank;
  } else if (words.length === 2) {
    const targetSNES = operandResolver.getnum(words[1]);
    const targetPC = session.romWriter.convertTargetAddressToRomOffset(targetSNES);
    if (targetPC < 0) {
      throw new Error(`Target SNES address ${targetSNES.toString(16)} does not map to ROM.`);
    }

    const currentPC = session.romWriter.convertTargetAddressToRomOffset(
      session.currentTargetAddress,
    );
    if (targetPC <= currentPC) {
      return;
    }

    gap = targetPC - currentPC;
  } else {
    throw new Error("PAD directive accepts zero or one parameter.");
  }

  for (let i = 0; i < gap; i++) {
    session.write1(session.padbyte[i % session.padUnit]);
  }
};

export const registerFillPadDirectives = (
  registry: DirectiveRegistry,
  context: FillPadDirectiveContext,
): void => {
  registry.register(["fillbyte", "fillword", "filllong", "filldword"], context, handleFillPattern);
  registry.register("fill", context, handleFill);
  registry.register(["padbyte", "padword", "padlong", "paddword"], context, handlePadPattern);
  registry.register("pad", context, handlePad);
};

import type { DirectiveRegistry } from "./registry.js";
import type { FillPadDirectiveContext } from "./types.js";

/** Repeating fill pattern length. LCM of byte/word/long/dword widths. */
const FILL_PATTERN_SIZE = 12;

const PATTERN_WIDTH: Record<string, number> = {
  fillbyte: 1,
  fillword: 2,
  filllong: 3,
  filldword: 4,
  padbyte: 1,
  padword: 2,
  padlong: 3,
  paddword: 4,
};

/**
 * Returns the little-endian unit width for a fill* or pad* pattern directive.
 * @param {string} keyword The directive keyword.
 * @param {"fill" | "pad"} kind Pattern family, used in the error message.
 * @returns {number} Width in bytes.
 * @throws {Error} If `keyword` is not a recognized pattern directive for `kind`.
 */
const patternWidth = (keyword: string, kind: "fill" | "pad"): number => {
  if (!keyword.startsWith(kind)) {
    throw new Error(`Unrecognized ${kind} directive.`);
  }
  const width = PATTERN_WIDTH[keyword];
  if (width === undefined) {
    throw new Error(`Unrecognized ${kind} directive.`);
  }
  return width;
};

/**
 * Writes `length` little-endian repeats of `value` into `dest`.
 * @param {number} value Source integer.
 * @param {number} width Bytes consumed from `value` per repeat.
 * @param {number[]} dest Destination buffer.
 * @param {number} length Number of bytes to store.
 */
const writeLittleEndianRepeats = (
  value: number,
  width: number,
  dest: number[],
  length: number,
): void => {
  const unit = value >>> 0;
  const bytes = [unit & 0xff, (unit >>> 8) & 0xff, (unit >>> 16) & 0xff, (unit >>> 24) & 0xff];
  for (let i = 0; i < length; i++) {
    dest[i] = bytes[i % width];
  }
};

/**
 * Resolves a fill* or pad* pattern operand.
 * @param {FillPadDirectiveContext} ctx The directive context.
 * @param {string[]} words Directive keyword and value.
 * @param {"fill" | "pad"} kind Pattern family.
 * @returns {{ width: number; value: number }} Unit width and resolved value.
 * @throws {Error} If the keyword is unknown or the arity is not exactly one operand.
 */
const resolvePatternValue = (
  { session, operandResolver }: FillPadDirectiveContext,
  words: readonly string[],
  kind: "fill" | "pad",
): { width: number; value: number } => {
  const keyword = words[0];
  const width = patternWidth(keyword, kind);
  if (words.length !== 2) {
    throw new Error(`${keyword.toUpperCase()} directive requires exactly one parameter.`);
  }
  return {
    width,
    value: operandResolver.getnum(session.resolvedefines(words[1])),
  };
};

/**
 * Sets the 12-byte fill pattern used by later `fill` directives.
 * @param {FillPadDirectiveContext} ctx The directive context.
 * @param {string[]} words `fillbyte` / `fillword` / `filllong` / `filldword` plus value.
 * @throws {Error} If the keyword is unknown or exactly one parameter is not supplied.
 */
export const handleFillPattern = (ctx: FillPadDirectiveContext, words: readonly string[]): void => {
  const { width, value } = resolvePatternValue(ctx, words, "fill");
  writeLittleEndianRepeats(value, width, ctx.session.fillbyte, FILL_PATTERN_SIZE);
};

/**
 * Emits `count` bytes of the current fill pattern.
 * @param {FillPadDirectiveContext} ctx The directive context.
 * @param {string[]} words `fill` plus the byte count.
 * @throws {Error} If exactly one parameter is not supplied.
 */
export const handleFill = (
  { session, operandResolver }: FillPadDirectiveContext,
  words: readonly string[],
): void => {
  if (words.length !== 2) {
    throw new Error("FILL directive requires exactly one parameter (number of bytes to fill).");
  }

  const count = operandResolver.getnum(session.resolvedefines(words[1]));
  for (let i = 0; i < count; i++) {
    session.write1(session.fillbyte[i % FILL_PATTERN_SIZE]);
  }
};

/**
 * Sets the pad unit and little-endian pad bytes used by later `pad` directives.
 * @param {FillPadDirectiveContext} ctx The directive context.
 * @param {string[]} words `padbyte` / `padword` / `padlong` / `paddword` plus value.
 * @throws {Error} If the keyword is unknown or exactly one parameter is not supplied.
 */
export const handlePadPattern = (ctx: FillPadDirectiveContext, words: readonly string[]): void => {
  const { session } = ctx;
  const { width, value } = resolvePatternValue(ctx, words, "pad");
  session.padUnit = width;
  writeLittleEndianRepeats(value, width, session.padbyte, width);
};

/**
 * Pads with the current pad pattern.
 * With no address, writes until the next 64K bank boundary. With an address, writes
 * until that SNES address (mapped through ROM offsets). A target at or before the
 * current PC is a no-op.
 * @param {FillPadDirectiveContext} ctx The directive context.
 * @param {string[]} words `pad` and an optional SNES address.
 * @throws {Error} If more than one parameter is supplied, or the target does not map to ROM.
 */
export const handlePad = (
  { session, operandResolver }: FillPadDirectiveContext,
  words: readonly string[],
): void => {
  let gap: number;
  if (words.length === 1) {
    gap = 0x10000 - (session.currentTargetAddress & 0xffff);
  } else if (words.length === 2) {
    const targetSNES = operandResolver.getnum(session.resolvedefines(words[1]));
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

/**
 * Registers fill/pad pattern and emit directives.
 * @param {DirectiveRegistry} registry The directive registry.
 * @param {FillPadDirectiveContext} context The fill/pad directive context.
 */
export const registerFillPadDirectives = (
  registry: DirectiveRegistry,
  context: FillPadDirectiveContext,
): void => {
  registry.register(["fillbyte", "fillword", "filllong", "filldword"], context, handleFillPattern);
  registry.register("fill", context, handleFill);
  registry.register(["padbyte", "padword", "padlong", "paddword"], context, handlePadPattern);
  registry.register("pad", context, handlePad);
};

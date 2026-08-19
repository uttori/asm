import type { DirectiveRegistry } from "./registry.js";
import type { SpcDirectiveContext } from "./types.js";

/**
 * Starts an SPC block using only SPC-related session capabilities.
 * @param {SpcDirectiveContext} ctx The SPC-capable directive context.
 * @param {string[]} words The directive words.
 */
export const handleSpcblock = (
  { runtime }: SpcDirectiveContext,
  words: readonly string[],
): void => {
  runtime.handleSpcblock(words);
};

/**
 * Ends the active SPC block using only SPC-related session capabilities.
 * @param {SpcDirectiveContext} ctx The SPC-capable directive context.
 * @param {string[]} words The directive words.
 */
export const handleEndSpcblock = (
  { runtime }: SpcDirectiveContext,
  words: readonly string[],
): void => {
  runtime.handleEndSpcblock(words);
};

export const registerSpcDirectives = (
  registry: DirectiveRegistry,
  context: SpcDirectiveContext,
): void => {
  registry.register("spcblock", context, handleSpcblock);

  registry.register("endspcblock", context, handleEndSpcblock);
};

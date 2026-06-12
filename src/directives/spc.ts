import type { DirectiveRegistry } from "./registry.js";
import type { DirectiveSpcCapability } from "./types.js";

type SpcDirectiveContext = {
  session: DirectiveSpcCapability;
};

/**
 * Starts an SPC block using only SPC-related session capabilities.
 * @param {SpcDirectiveContext} ctx The SPC-capable directive context.
 * @param {string[]} words The directive words.
 */
const handleSpcblock = ({ session }: SpcDirectiveContext, words: string[]): void => {
  session.handleSpcblock(words);
};

/**
 * Ends the active SPC block using only SPC-related session capabilities.
 * @param {SpcDirectiveContext} ctx The SPC-capable directive context.
 * @param {string[]} words The directive words.
 */
const handleEndSpcblock = ({ session }: SpcDirectiveContext, words: string[]): void => {
  session.handleEndSpcblock(words);
};

export const registerSpcDirectives = (registry: DirectiveRegistry): void => {
  registry.register("spcblock", handleSpcblock);

  registry.register("endspcblock", handleEndSpcblock);
};

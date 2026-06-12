import type { DirectiveRegistry } from "./registry.js";
import type { DirectiveRomCapability } from "./types.js";

type DataDirectiveContext = {
  session: DirectiveRomCapability;
};

/**
 * Routes byte/word/long data directives through the runtime data handler.
 * @param {DataDirectiveContext} ctx The ROM-capable directive context.
 * @param {string[]} words The directive words.
 */
const handleDataDirective = ({ session }: DataDirectiveContext, words: string[]): void => {
  session.handleDataDirective(words[0], words.slice(1));
};

export const registerDataDirectives = (registry: DirectiveRegistry): void => {
  registry.register(["db", "dw", "dl", "dd", "dc.b", "dc.w", "dc.l"], handleDataDirective);
};

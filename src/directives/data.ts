import type { DirectiveRegistry } from "./registry.js";
import type { DataDirectiveContext } from "./types.js";

/**
 * Routes byte/word/long data directives through the runtime data handler.
 * @param {DataDirectiveContext} ctx The ROM-capable directive context.
 * @param {string[]} words The directive words.
 */
export const handleDataDirective = ({ runtime }: DataDirectiveContext, words: string[]): void => {
  runtime.handleDataDirective(words[0], words.slice(1));
};

export const registerDataDirectives = (
  registry: DirectiveRegistry,
  context: DataDirectiveContext,
): void => {
  registry.register(["db", "dw", "dl", "dd", "dc.b", "dc.w", "dc.l"], context, handleDataDirective);
};

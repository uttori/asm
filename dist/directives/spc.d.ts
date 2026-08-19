import type { DirectiveRegistry } from "./registry.js";
import type { SpcDirectiveContext } from "./types.js";
/**
 * Starts an SPC block using only SPC-related session capabilities.
 * @param {SpcDirectiveContext} ctx The SPC-capable directive context.
 * @param {string[]} words The directive words.
 */
export declare const handleSpcblock: ({ runtime }: SpcDirectiveContext, words: readonly string[]) => void;
/**
 * Ends the active SPC block using only SPC-related session capabilities.
 * @param {SpcDirectiveContext} ctx The SPC-capable directive context.
 * @param {string[]} words The directive words.
 */
export declare const handleEndSpcblock: ({ runtime }: SpcDirectiveContext, words: readonly string[]) => void;
export declare const registerSpcDirectives: (registry: DirectiveRegistry, context: SpcDirectiveContext) => void;
//# sourceMappingURL=spc.d.ts.map
import type { DirectiveRegistry } from "./registry.js";
import type { DataDirectiveContext } from "./types.js";
/**
 * Routes byte/word/long data directives through the runtime data handler.
 * @param {DataDirectiveContext} ctx The ROM-capable directive context.
 * @param {string[]} words The directive words.
 */
export declare const handleDataDirective: ({ runtime }: DataDirectiveContext, words: readonly string[]) => void;
export declare const registerDataDirectives: (registry: DirectiveRegistry, context: DataDirectiveContext) => void;
//# sourceMappingURL=data.d.ts.map
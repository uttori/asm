import type { DirectiveRegistry } from "./registry.js";
import type { IncludeDirectiveContext } from "./types.js";
/**
 * Handles an incbin command.
 * @param {IncludeDirectiveContext} ctx The directive context.
 * @param {string[]} words Directive keyword.
 */
export declare const handleIncbin: ({ session, includeSource, operandResolver, runtime }: IncludeDirectiveContext, words: string[]) => void;
export declare const registerIncludeSourceDirectives: (registry: DirectiveRegistry, context: IncludeDirectiveContext) => void;
//# sourceMappingURL=include-source.d.ts.map
import type { DirectiveRegistry } from "./registry.js";
import { DirectiveContext } from "./types.js";
/**
 * Handles an incbin command.
 * @param {DirectiveContext} ctx The directive context.
 * @param {AssemblySession} ctx.session The assembly session.
 * @param {string[]} words Directive keyword.
 */
export declare const handleIncbin: ({ session }: DirectiveContext, words: string[]) => void;
export declare const registerIncludeSourceDirectives: (registry: DirectiveRegistry) => void;
//# sourceMappingURL=include-source.d.ts.map
import type { DirectiveRegistry } from "./registry.js";
import { DirectiveContext } from "./types.js";
/**
 * Handles the ARCH command.
 * @param {DirectiveContext} ctx The directive context.
 * @param {AssemblySession} ctx.session The assembly session.
 * @param {string[]} words - The words from the ARCH command.
 * @throws {Error} If the ARCH command requires an architecture parameter.
 */
export declare const handleArch: ({ session }: DirectiveContext, words: string[]) => void;
export declare const handleStartpos: ({ session }: DirectiveContext, words: string[]) => void;
export declare const registerLayoutDirectives: (registry: DirectiveRegistry) => void;
//# sourceMappingURL=layout.d.ts.map
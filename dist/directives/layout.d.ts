import type { DirectiveRegistry, DirectiveRegistryContexts } from "./registry.js";
import type { AddressStackDirectiveContext, ArchitectureDirectiveContext, StartposDirectiveContext } from "./types.js";
/**
 * Pushes the current target address onto the push base stack.
 * @param {AddressStackDirectiveContext} ctx The directive context.
 */
export declare const handlePushBase: ({ session }: AddressStackDirectiveContext) => void;
/**
 * Pulls the current target address from the push base stack.
 * @param {AddressStackDirectiveContext} ctx The directive context.
 */
export declare const handlePullBase: ({ session }: AddressStackDirectiveContext) => void;
/**
 * Handles the ARCH command.
 * @param {ArchitectureDirectiveContext} ctx The directive context.
 * @param {string[]} words - The words from the ARCH command.
 * @throws {Error} If the ARCH command requires an architecture parameter.
 */
export declare const handleArch: ({ session }: ArchitectureDirectiveContext, words: readonly string[]) => void;
export declare const handleStartpos: ({ session, operandResolver }: StartposDirectiveContext, words: readonly string[]) => void;
export declare const registerGenericLayoutDirectives: (registry: DirectiveRegistry, context: DirectiveRegistryContexts["layout"]) => void;
export declare const registerSnesMapperDirectives: (registry: DirectiveRegistry, context: DirectiveRegistryContexts["layout"]) => void;
export declare const registerSpcLayoutDirectives: (registry: DirectiveRegistry, context: DirectiveRegistryContexts["layout"]) => void;
export declare const registerSnesPolicyDirectives: (registry: DirectiveRegistry, context: DirectiveRegistryContexts["layout"]) => void;
export declare const registerLayoutDirectives: (registry: DirectiveRegistry, context: DirectiveRegistryContexts["layout"], activeSetIds?: ReadonlySet<string>) => void;
//# sourceMappingURL=layout.d.ts.map
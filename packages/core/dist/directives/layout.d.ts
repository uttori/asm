import type { DirectiveRegistry, DirectiveRegistryContexts } from "./registry.js";
import type { AddressStackDirectiveContext, ArchitectureDirectiveContext } from "./types.js";
/**
 * Pushes the current target address onto the push base stack.
 * @param ctx The directive context.
 */
export declare const handlePushBase: ({ session }: AddressStackDirectiveContext) => void;
/**
 * Restores the target address saved by {@link handlePushBase}.
 * @param ctx The directive context.
 * @throws {Error} If the base stack is empty.
 */
export declare const handlePullBase: ({ session }: AddressStackDirectiveContext) => void;
/**
 * Selects the architecture named by `words[1]`.
 * Prefers {@link DirectiveArchitectureCapability.selectArchitecture} when present.
 * Otherwise writes `session.arch` after checking `availableArchitectures`.
 * @param ctx The architecture-capable session.
 * @param words Tokenized line, keyword first.
 * @throws {Error} If the architecture name is missing, unknown, or not allowed on the target.
 */
export declare const handleArch: ({ session }: ArchitectureDirectiveContext, words: readonly string[]) => void;
/** Registers org, base, and related layout directives shared across targets. */
export declare const registerGenericLayoutDirectives: (registry: DirectiveRegistry, context: DirectiveRegistryContexts["layout"]) => void;
/**
 * Registers the core layout directive group.
 * @param registry The directive registry.
 * @param context Layout-capable sessions and runtime.
 */
export declare const registerLayoutDirectives: (registry: DirectiveRegistry, context: DirectiveRegistryContexts["layout"]) => void;
//# sourceMappingURL=layout.d.ts.map
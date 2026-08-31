import type { DirectiveRegistry, DirectiveRegistryContexts } from "./registry.js";
import type { AddressStackDirectiveContext, ArchitectureDirectiveContext } from "./types.js";
/**
 * Pushes the current target address onto the push base stack.
 * @param {AddressStackDirectiveContext} ctx The directive context.
 * @returns {void}
 */
export declare const handlePushBase: ({ session }: AddressStackDirectiveContext) => void;
/**
 * Restores the target address saved by {@link handlePushBase}.
 * @param {AddressStackDirectiveContext} ctx The directive context.
 * @returns {void}
 * @throws {Error} If the base stack is empty.
 */
export declare const handlePullBase: ({ session }: AddressStackDirectiveContext) => void;
/**
 * Selects the architecture named by `words[1]`.
 * Prefers {@link DirectiveArchitectureCapability.selectArchitecture} when present;
 * otherwise writes `session.arch` after checking `availableArchitectures`.
 * @param {ArchitectureDirectiveContext} ctx The architecture-capable session.
 * @param {readonly string[]} words Tokenized line, keyword first.
 * @returns {void}
 * @throws {Error} If the architecture name is missing, unknown, or not allowed on the target.
 */
export declare const handleArch: ({ session }: ArchitectureDirectiveContext, words: readonly string[]) => void;
/**
 * Registers `base`, `org`, `pushbase`/`pullbase`, `pushpc`/`pullpc`, and `arch`.
 * @param {DirectiveRegistry} registry The directive registry.
 * @param {DirectiveRegistryContexts["layout"]} context Layout-capable sessions and runtime.
 * @returns {void}
 */
export declare const registerGenericLayoutDirectives: (registry: DirectiveRegistry, context: DirectiveRegistryContexts["layout"]) => void;
/**
 * Registers the core layout directive group.
 * @param {DirectiveRegistry} registry The directive registry.
 * @param {DirectiveRegistryContexts["layout"]} context Layout-capable sessions and runtime.
 * @returns {void}
 */
export declare const registerLayoutDirectives: (registry: DirectiveRegistry, context: DirectiveRegistryContexts["layout"]) => void;
//# sourceMappingURL=layout.d.ts.map
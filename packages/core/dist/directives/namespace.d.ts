import type { DirectiveRegistry } from "./registry.js";
import type { NamespaceDirectiveContext } from "./types.js";
/**
 * Pushes the current namespace.
 * @param ctx The directive context.
 */
export declare const handlePushNamespace: ({ session }: NamespaceDirectiveContext) => void;
/**
 * Restores the previous namespace.
 * @param ctx The directive context.
 */
export declare const handlePullNamespace: ({ session }: NamespaceDirectiveContext) => void;
/**
 * Handles `namespace` definitions.
 * Example:
 * @example
 * namespace "identifier"
 * namespace identifier
 * @param ctx The directive context.
 * @param words The words of the namespace command.
 */
export declare const handleNamespace: (ctx: NamespaceDirectiveContext, words: readonly string[]) => void;
/** Registers namespace open, close, and push directives on the shared registry. */
export declare const registerNamespaceDirectives: (registry: DirectiveRegistry, context: NamespaceDirectiveContext) => void;
//# sourceMappingURL=namespace.d.ts.map
import type { DirectiveRegistry } from "./registry.js";
import type { NamespaceDirectiveContext } from "./types.js";
/**
 * Pushes the current namespace.
 * @param {NamespaceDirectiveContext} ctx The directive context.
 */
export declare const handlePushNamespace: ({ session }: NamespaceDirectiveContext) => void;
/**
 * Restores the previous namespace.
 * @param {NamespaceDirectiveContext} ctx The directive context.
 */
export declare const handlePullNamespace: ({ session }: NamespaceDirectiveContext) => void;
/**
 * Handles `namespace` definitions.
 * Example:
 * @example
 * namespace "identifier"
 * namespace identifier
 * @param {NamespaceDirectiveContext} ctx The directive context.
 * @param {string[]} words The words of the namespace command.
 */
export declare const handleNamespace: ({ session }: NamespaceDirectiveContext, words: string[]) => void;
export declare const registerNamespaceDirectives: (registry: DirectiveRegistry, context: NamespaceDirectiveContext) => void;
//# sourceMappingURL=namespace.d.ts.map
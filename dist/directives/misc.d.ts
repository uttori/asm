import type { DirectiveRegistry } from "./registry.js";
import type { TableDirectiveContext } from "./types.js";
/**
 * Restores the previously saved character mapping table.
 * @param {TableDirectiveContext} ctx The directive context.
 * @param {DirectiveTableCapability} ctx.session The table-capable assembly session.
 * @throws {Error} If `pulltable` is called without `pushtable`.
 */
export declare const handlePullTable: ({ session }: TableDirectiveContext) => void;
/**
 * Saves the current character mapping table.
 * @param {TableDirectiveContext} ctx The directive context.
 * @param {DirectiveTableCapability} ctx.session The table-capable assembly session.
 */
export declare const handlePushTable: ({ session }: TableDirectiveContext) => void;
export declare const registerMiscDirectives: (registry: DirectiveRegistry, context: TableDirectiveContext) => void;
//# sourceMappingURL=misc.d.ts.map
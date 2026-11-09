import type { DirectiveRegistry } from "./registry.js";
import type { DataDirectiveContext } from "./types.js";
/** Check the currently registered handler, including replacements after lowering. */
export declare function isCoreDataDirective(registry: Pick<DirectiveRegistry, "lookup">, keyword: string): boolean;
/** Preserve core ownership through the session's lifecycle-hook wrapper only. */
export declare function inheritCoreDataHandler(original: NonNullable<ReturnType<DirectiveRegistry["lookup"]>>, wrapped: NonNullable<ReturnType<DirectiveRegistry["lookup"]>>): void;
/**
 * Routes byte/word/long data directives through the runtime data handler.
 * @param ctx The ROM-capable directive context.
 * @param words The directive words.
 */
export declare const handleDataDirective: ({ runtime }: DataDirectiveContext, words: readonly string[]) => void;
/** Registers numeric and character data directives that delegate to the data runtime. */
export declare const registerDataDirectives: (registry: DirectiveRegistry, context: DataDirectiveContext) => void;
//# sourceMappingURL=data.d.ts.map
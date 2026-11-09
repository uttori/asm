import type { NormalizedCommand } from "../ir/normalized-command.js";
import type { DirectiveRegistry } from "./registry.js";
import type { IncludeDirectiveContext } from "./types.js";
/**
 * Embeds a binary file at the current PC, optionally sliced and/or seeking via `->`.
 *
 * @example
 * incbin "data.bin"
 * incbin "data.bin":$10..$20
 * incbin "data.bin":1-4
 * incbin "data.bin" -> $808000
 * @param ctx The include-capable directive context.
 * @param words Directive tokens.
 * @param [_raw] Raw line, unused.
 * @param [command] Normalized command. Retained for public adapter compatibility.
 * @throws {Error} On missing file, bad range, missing `->` target, or unreadable contents.
 */
export declare const handleIncbin: (context: IncludeDirectiveContext, words: readonly string[], _raw?: string, _command?: NormalizedCommand) => void;
/**
 * Assembles another source file inline (`incsrc`).
 * @param ctx The include-capable directive context.
 * @param words Directive tokens.
 * @param [_raw] Raw line, unused.
 * @param [command] Normalized command with optional `includeTarget`.
 * @throws {Error} If the filename is missing.
 */
export declare const handleIncsrc: ({ includeSource, defineEngine }: IncludeDirectiveContext, words: readonly string[], _raw?: string, command?: NormalizedCommand) => void;
/**
 * Includes and assembles another source file (`include`).
 * @param ctx The include-capable directive context.
 * @param words Directive tokens.
 * @param [_raw] Raw line, unused.
 * @param [command] Normalized command with optional `includeTarget`.
 * @throws {Error} If the filename is missing.
 */
export declare const handleInclude: ({ includeSource, defineEngine }: IncludeDirectiveContext, words: readonly string[], _raw?: string, command?: NormalizedCommand) => void;
/**
 * Registers source and binary include directives.
 * @param registry The directive registry.
 * @param context The include-capable directive context.
 */
export declare const registerIncludeSourceDirectives: (registry: DirectiveRegistry, context: IncludeDirectiveContext) => void;
//# sourceMappingURL=include-source.d.ts.map
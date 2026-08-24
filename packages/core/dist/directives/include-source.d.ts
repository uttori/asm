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
 * @param {IncludeDirectiveContext} ctx The include-capable directive context.
 * @param {string[]} words Directive tokens.
 * @param {string} [_raw] Raw line, unused.
 * @param {NormalizedCommand} [command] Normalized command; `parsed.incbinRange` skips string re-parse when present.
 * @throws {Error} On missing file, bad range, missing `->` target, or unreadable contents.
 */
export declare const handleIncbin: ({ session, includeSource, operandResolver, runtime, defineEngine }: IncludeDirectiveContext, words: readonly string[], _raw?: string, command?: NormalizedCommand) => void;
/**
 * Assembles another source file inline (`incsrc`).
 * @param {IncludeDirectiveContext} ctx The include-capable directive context.
 * @param {string[]} words Directive tokens.
 * @param {string} [_raw] Raw line, unused.
 * @param {NormalizedCommand} [command] Normalized command with optional `includeTarget`.
 * @throws {Error} If the filename is missing.
 */
export declare const handleIncsrc: ({ includeSource, defineEngine }: IncludeDirectiveContext, words: readonly string[], _raw?: string, command?: NormalizedCommand) => void;
/**
 * Includes and assembles another source file (`include`).
 * @param {IncludeDirectiveContext} ctx The include-capable directive context.
 * @param {string[]} words Directive tokens.
 * @param {string} [_raw] Raw line, unused.
 * @param {NormalizedCommand} [command] Normalized command with optional `includeTarget`.
 * @throws {Error} If the filename is missing.
 */
export declare const handleInclude: ({ includeSource, defineEngine }: IncludeDirectiveContext, words: readonly string[], _raw?: string, command?: NormalizedCommand) => void;
/**
 * Registers source and binary include directives.
 * @param {DirectiveRegistry} registry The directive registry.
 * @param {IncludeDirectiveContext} context The include-capable directive context.
 */
export declare const registerIncludeSourceDirectives: (registry: DirectiveRegistry, context: IncludeDirectiveContext) => void;
//# sourceMappingURL=include-source.d.ts.map
import type { DirectiveRegistry } from "./registry.js";
import type { FillPadDirectiveContext } from "./types.js";
/**
 * Sets the 12-byte fill pattern used by later `fill` directives.
 * @param {FillPadDirectiveContext} ctx The directive context.
 * @param {string[]} words `fillbyte` / `fillword` / `filllong` / `filldword` plus value.
 * @throws {Error} If the keyword is unknown or exactly one parameter is not supplied.
 */
export declare const handleFillPattern: (ctx: FillPadDirectiveContext, words: readonly string[]) => void;
/**
 * Emits `count` bytes of the current fill pattern.
 * @param {FillPadDirectiveContext} ctx The directive context.
 * @param {string[]} words `fill` plus the byte count.
 * @throws {Error} If exactly one parameter is not supplied.
 */
export declare const handleFill: ({ session, operandResolver }: FillPadDirectiveContext, words: readonly string[]) => void;
/**
 * Sets the pad unit and little-endian pad bytes used by later `pad` directives.
 * @param {FillPadDirectiveContext} ctx The directive context.
 * @param {string[]} words `padbyte` / `padword` / `padlong` / `paddword` plus value.
 * @throws {Error} If the keyword is unknown or exactly one parameter is not supplied.
 */
export declare const handlePadPattern: (ctx: FillPadDirectiveContext, words: readonly string[]) => void;
/**
 * Pads with the current pad pattern.
 * With no address, writes until the next 64K bank boundary. With an address, writes
 * until that logical address (mapped through output offsets). A target at or before the
 * current PC is a no-op.
 * @param {FillPadDirectiveContext} ctx The directive context.
 * @param {string[]} words `pad` and an optional logical address.
 * @throws {Error} If more than one parameter is supplied, or the target does not map to output.
 */
export declare const handlePad: ({ session, operandResolver }: FillPadDirectiveContext, words: readonly string[]) => void;
/**
 * Registers fill/pad pattern and emit directives.
 * @param {DirectiveRegistry} registry The directive registry.
 * @param {FillPadDirectiveContext} context The fill/pad directive context.
 */
export declare const registerFillPadDirectives: (registry: DirectiveRegistry, context: FillPadDirectiveContext) => void;
//# sourceMappingURL=fill-pad.d.ts.map
import type { DirectiveRegistry } from "./registry.js";
import type { MemoryDirectiveContext } from "./types.js";
/**
 * Minimal FREECODE/FREESPACE support used by active tests.
 * Allocates a block at/after current ROM end, emits a placeholder RATS tag, then positions assembly after it.
 * @param {MemoryDirectiveContext} ctx The directive context.
 * @param {string[]} words Directive keyword.
 */
export declare const handleFreespace: ({ session }: MemoryDirectiveContext, words: string[]) => void;
/**
 * Sets default freespace fill byte.
 * @param {MemoryDirectiveContext} ctx The directive context.
 * @param {string[]} words FREESPACEBYTE arguments.
 */
export declare const handleFreespaceByte: ({ session, operandResolver }: MemoryDirectiveContext, words: string[]) => void;
/**
 * Minimal PROT support used by active tests.
 * Emits PROT table with 24-bit addresses and STOP marker.
 * @param {MemoryDirectiveContext} ctx The directive context.
 * @param {string[]} words Label list arguments.
 */
export declare const handleProt: ({ session }: MemoryDirectiveContext, words: string[]) => void;
export declare const registerMemoryDirectives: (registry: DirectiveRegistry, context: MemoryDirectiveContext) => void;
//# sourceMappingURL=memory.d.ts.map
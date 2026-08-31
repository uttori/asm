import type { Assembler } from "@uttori/asm-core";
import type { SnesSessionState } from "../session-state.js";
/**
 * Allocates an Asar-style freespace block (`freecode` / `freespace` / `freedata`).
 *
 * Layout is a 8-byte `STAR` header then payload:
 * `53 54 41 52` (`STAR`), 16-bit length-minus-one, 16-bit complement.
 * Length bytes are placeholders (`00 00 FF FF`) until `beforeOutputFinalize`
 * patches them from the high-water write offset.
 *
 * Placement starts at `max($80000, current image length)` so we never overlay
 * the first 512 KiB of an existing ROM. Output is expanded to 1 MiB if shorter.
 *
 * `norom` has no cartridge map, so allocation is refused.
 *
 * @param {Assembler} session Host assembler.
 * @param {SnesSessionState} state Mutable SNES session.
 * @param {readonly string[]} words Tokenized line (keyword used only in the SPC-block error).
 */
export declare function handleFreespace(session: Assembler, state: SnesSessionState, words: readonly string[]): void;
/**
 * Sets the fill byte used when expanding output (`freespacebyte <value>`).
 * Mirrored onto the session so later `expandOutput` calls match Asar.
 *
 * @param {Assembler} session Host assembler.
 * @param {SnesSessionState} state Mutable SNES session.
 * @param {readonly string[]} words Tokenized line.
 */
export declare function handleFreespaceByte(session: Assembler, state: SnesSessionState, words: readonly string[]): void;
/**
 * Emits an Asar `PROT` record: `PROT` + payload-length byte + 24-bit SNES
 * addresses for each label + `STOP\0`.
 *
 * Unresolved labels encode as `$000000` (Asar does the same on the first pass).
 * The length byte is `labelCount * 3` truncated to 8 bits - Asar's format has
 * no 16-bit count, so >85 labels wrap.
 *
 * @param {Assembler} session Host assembler.
 * @param {readonly string[]} words Tokenized line; labels after the keyword, comma-separated.
 */
export declare function handleProt(session: Assembler, words: readonly string[]): void;
//# sourceMappingURL=freespace.d.ts.map
/**
 * Centralized ASAR-compatibility profile used by the transitional assembler.
 * Keeping these rules in one place makes it easier to tighten or replace
 * compatibility behavior without scattering quirks across core execution.
 */
/**
 * Directives that are accepted as compatibility no-ops.
 * Unsupported directives are deliberately excluded so they continue through
 * normal unknown-directive diagnostics instead of being silently accepted.
 */
export declare const ASAR_COMPAT_NO_OP_DIRECTIVES: readonly ["fastrom", "dpbase", "warnings", "print", "warn", "autoclean", "autoclear", "includefrom", "asar", "reset", "{", "}"];
/**
 * Mapper state affected by ASAR-compatible mapper selection.
 */
export interface MapperCompatibilityState {
    mapper: string;
    checksumFixEnabled: boolean;
}
/**
 * Rejects mapper changes while assembling an SPC block.
 * @param {boolean} inSpcblock Whether an SPC block is active.
 */
export declare const assertMapperAvailable: (inSpcblock: boolean) => void;
/**
 * Applies mapper selection and its associated checksum policy.
 * @param {MapperCompatibilityState} state Mutable mapper state.
 * @param {string} mapper Canonical mapper name.
 */
export declare const applyMapperSelection: (state: MapperCompatibilityState, mapper: string) => void;
/**
 * Reports whether the selected mapper can allocate ROM freespace.
 * @param {string} mapper Canonical mapper name.
 * @returns {boolean} True when freespace allocation is supported.
 */
export declare const isFreespaceAvailable: (mapper: string) => boolean;
export type ChecksumMode = "asar" | "simple";
/**
 * Super FX `MOVE Rn, (xx)` / `MOVE (xx), Rn` short-form address encoding.
 * Hardware LMS/SMS store a word index (`addr >> 1`). Asar writes the raw byte
 * (`addr & 0xff`). `$00` is identical either way; `$40` is `$20` vs `$40`.
 */
export type SuperFxMoveShortAddressMode = "hardware" | "asar";
/**
 * Encodes the LMS/SMS operand byte for Super FX auto-MOVE short addressing.
 * @param {number} addrVal RAM byte address, already known to be even and `< $200`.
 * @param {SuperFxMoveShortAddressMode} [mode] Encoding policy. Defaults to hardware.
 * @returns {number} The byte stored after `A0+Rn`.
 */
export declare const encodeSuperFxMoveShortAddress: (addrVal: number, mode?: SuperFxMoveShortAddressMode) => number;
/**
 * Resolves the SNES header offset used by the compatibility checksum writer.
 * @param {string} mapper Canonical mapper name.
 * @returns {number} ROM offset of the header.
 */
export declare const getChecksumHeaderOffset: (mapper: string) => number;
/**
 * Calculates the 16-bit ROM checksum using the selected compatibility mode.
 * ASAR mode mirrors the trailing non-power-of-two region.
 * @param {number[] | Uint8Array} romdata ROM bytes.
 * @param {ChecksumMode} mode Checksum compatibility mode.
 * @returns {number} 16-bit checksum.
 */
export declare const calculateHeaderChecksum: (romdata: number[] | Uint8Array, mode: ChecksumMode) => number;
/**
 * In inline SPC compatibility mode, `org` is treated as a `spcblock` entry.
 * @param {boolean} spcInlineCompatMode Whether the SPC inline compatibility mode is enabled.
 * @returns {boolean} True if the `org` directive should be redirected to the `spcblock` directive.
 */
export declare const shouldRedirectOrgToSpcblock: (spcInlineCompatMode: boolean) => boolean;
/**
 * Reports whether an architecture spelling enables inline SPC compatibility.
 * @param {string} architecture Requested architecture spelling.
 * @returns {boolean} True for the ASAR inline-SPC alias.
 */
export declare const shouldEnableSpcInlineCompat: (architecture: string) => boolean;
/**
 * Asar `arch spc700-raw` assembles a standalone SPC payload with 1:1 file addressing.
 * Without this, `org $000000` stays on lorom/hirom and writes land in unmapped space.
 * @param {string} architecture Requested architecture spelling.
 * @returns {boolean} True for the raw SPC output alias.
 */
export declare const shouldUseNoromAddressing: (architecture: string) => boolean;
/**
 * Reports whether pass finalization should close an implicit SPC block.
 * @param {boolean} spcInlineCompatMode Whether inline SPC compatibility is enabled.
 * @param {boolean} inSpcblock Whether an SPC block is active.
 * @returns {boolean} True when an implicit block must be closed.
 */
export declare const shouldAutoCloseSpcblock: (spcInlineCompatMode: boolean, inSpcblock: boolean) => boolean;
/**
 * ASAR quirk: `endif` may close an innermost `while` instead of an `if` chain.
 * @param {string} currentLoopType The type of the current loop.
 * @param {number} currentLoopStartLine The start line of the current loop.
 * @param {number} currentIfStartLine The start line of the current if.
 * @returns {boolean} True if the `endif` directive should close the innermost `while` block.
 */
export declare const shouldEndifCloseInnermostWhile: (currentLoopType: "for" | "while" | undefined, currentLoopStartLine: number | undefined, currentIfStartLine: number | undefined) => boolean;
//# sourceMappingURL=asar-compatibility-profile.d.ts.map
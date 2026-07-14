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
export const ASAR_COMPAT_NO_OP_DIRECTIVES = [
  "fastrom",
  "dpbase",
  "warnings",
  "print",
  "autoclean",
  "autoclear",
  "table",
  "includefrom",
  "asar",
  "{",
  "}",
] as const;

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
export const assertMapperAvailable = (inSpcblock: boolean): void => {
  if (inSpcblock) {
    throw new Error("Mapper directives are unavailable inside spcblock.");
  }
};

/**
 * Applies mapper selection and its associated checksum policy.
 * @param {MapperCompatibilityState} state Mutable mapper state.
 * @param {string} mapper Canonical mapper name.
 */
export const applyMapperSelection = (state: MapperCompatibilityState, mapper: string): void => {
  state.mapper = mapper;
  if (mapper === "norom") {
    state.checksumFixEnabled = false;
  }
};

/**
 * Reports whether the selected mapper can allocate ROM freespace.
 * @param {string} mapper Canonical mapper name.
 * @returns {boolean} True when freespace allocation is supported.
 */
export const isFreespaceAvailable = (mapper: string): boolean => mapper !== "norom";

export type ChecksumMode = "asar" | "simple";

/**
 * Resolves the SNES header offset used by the compatibility checksum writer.
 * @param {string} mapper Canonical mapper name.
 * @returns {number} ROM offset of the header.
 */
export const getChecksumHeaderOffset = (mapper: string): number => {
  if (mapper === "lorom" || mapper === "sa1rom" || mapper === "bigsa1rom") {
    return 0x7FC0;
  }
  return 0xFFC0;
};

/**
 * Calculates the 16-bit ROM checksum using the selected compatibility mode.
 * ASAR mode mirrors the trailing non-power-of-two region.
 * @param {number[] | Uint8Array} romdata ROM bytes.
 * @param {ChecksumMode} mode Checksum compatibility mode.
 * @returns {number} 16-bit checksum.
 */
export const calculateHeaderChecksum = (
  romdata: number[] | Uint8Array,
  mode: ChecksumMode,
): number => {
  const romLength = romdata.length;
  if (romLength === 0) {
    return 0;
  }
  let checksum = 0;

  if (mode === "simple" || (romLength & (romLength - 1)) === 0) {
    for (let i = 0; i < romLength; i++) {
      checksum += romdata[i] & 0xFF;
    }
    return checksum & 0xFFFF;
  }

  let bitround = 1;
  while (bitround < romLength) {
    bitround <<= 1;
  }
  const firstPart = bitround >> 1;
  const secondPart = romLength - firstPart;
  const repeatCount = Math.floor(firstPart / secondPart);
  let secondPartSum = 0;

  for (let i = 0; i < firstPart; i++) {
    checksum += romdata[i] & 0xFF;
  }
  for (let i = firstPart; i < romLength; i++) {
    secondPartSum += romdata[i] & 0xFF;
  }

  return (checksum + secondPartSum * repeatCount) & 0xFFFF;
};

/**
 * In inline SPC compatibility mode, `org` is treated as a `spcblock` entry.
 * @param {boolean} spcInlineCompatMode Whether the SPC inline compatibility mode is enabled.
 * @returns {boolean} True if the `org` directive should be redirected to the `spcblock` directive.
 */
export const shouldRedirectOrgToSpcblock = (spcInlineCompatMode: boolean): boolean => spcInlineCompatMode;

/**
 * Reports whether an architecture spelling enables inline SPC compatibility.
 * @param {string} architecture Requested architecture spelling.
 * @returns {boolean} True for the ASAR inline-SPC alias.
 */
export const shouldEnableSpcInlineCompat = (architecture: string): boolean =>
  architecture === "spc700-inline";

/**
 * Reports whether pass finalization should close an implicit SPC block.
 * @param {boolean} spcInlineCompatMode Whether inline SPC compatibility is enabled.
 * @param {boolean} inSpcblock Whether an SPC block is active.
 * @returns {boolean} True when an implicit block must be closed.
 */
export const shouldAutoCloseSpcblock = (
  spcInlineCompatMode: boolean,
  inSpcblock: boolean,
): boolean => spcInlineCompatMode && inSpcblock;

/**
 * ASAR quirk: `endif` may close an innermost `while` instead of an `if` chain.
 * @param {string} currentLoopType The type of the current loop.
 * @param {number} currentLoopStartLine The start line of the current loop.
 * @param {number} currentIfStartLine The start line of the current if.
 * @returns {boolean} True if the `endif` directive should close the innermost `while` block.
 */
export const shouldEndifCloseInnermostWhile = (
  currentLoopType: "for" | "while" | undefined,
  currentLoopStartLine: number | undefined,
  currentIfStartLine: number | undefined,
): boolean => currentLoopType === "while"
  && (currentIfStartLine === undefined || (currentLoopStartLine ?? -1) >= currentIfStartLine);

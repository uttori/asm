/**
 * Centralized ASAR-compatibility profile used by the transitional assembler.
 * Keeping these rules in one place makes it easier to tighten or replace
 * compatibility behavior without scattering quirks across core execution.
 */
/**
 * Directives that are accepted as compatibility no-ops.
 */
export declare const ASAR_COMPAT_NO_OP_DIRECTIVES: readonly ["dpbase", "warnings", "print", "autoclean", "autoclear", "table", "includefrom", "asar", "{", "}"];
/**
 * In inline SPC compatibility mode, `org` is treated as a `spcblock` entry.
 */
export declare const shouldRedirectOrgToSpcblock: (spcInlineCompatMode: boolean) => boolean;
/**
 * ASAR quirk: `endif` may close an innermost `while` instead of an `if` chain.
 */
export declare const shouldEndifCloseInnermostWhile: (currentLoopType: "for" | "while" | undefined, currentLoopStartLine: number | undefined, currentIfStartLine: number | undefined) => boolean;
//# sourceMappingURL=asar-compatibility-profile.d.ts.map
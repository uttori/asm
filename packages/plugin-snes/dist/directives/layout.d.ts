import type { DirectiveSyntaxContribution, PluginSessionCapabilities } from "@uttori/asm-core/plugin";
import { type SnesSessionState } from "../session-state.js";
import { parseSnesDirective } from "./syntax-parser.js";
/**
 * Mapper directive keywords registered on the SNES target.
 * `fullsa1rom` is Asar's name for what this assembler stores as `bigsa1rom`.
 */
export declare const MAPPER_KEYWORDS: readonly ["lorom", "hirom", "exlorom", "exhirom", "sfxrom", "norom", "fullsa1rom", "sa1rom"];
/**
 * Applies a mapper directive. Most keywords are 1:1. `sa1rom` optionally takes
 * four comma-separated 1 MiB bank indices written into slots 0, 1, 4, 5
 * (Asar's SA-1 LoROM map - not consecutive 0–3).
 *
 * @param {SnesSessionState} state Mutable SNES session.
 * @param {readonly string[]} words Tokenized line, keyword first.
 */
export declare function handleMapper(state: SnesSessionState, words: readonly string[]): void;
/**
 * `check title` enables `readN` without a default.
 * `check bankcross <on|off|half|full>` sets PC wrap vs linear bank-cross policy.
 *
 * @param {SnesSessionState} state Mutable SNES session.
 * @param {readonly string[]} words Tokenized line.
 */
export declare function handleCheck(state: SnesSessionState, words: readonly string[]): void;
/**
 * `optimize dp none|ram|always`. Unknown subcommands are ignored (Asar no-op).
 * Only DP-width inference is implemented. Other `optimize` families are not.
 *
 * @param {SnesSessionState} state Mutable SNES session.
 * @param {readonly string[]} words Tokenized line.
 */
export declare function handleOptimize(state: SnesSessionState, words: readonly string[]): void;
/**
 * `startpos <addr>` records the SPC execute address used when `endspcblock`
 * has no `execute` argument. Illegal outside an open `spcblock`.
 *
 * @param {PluginSessionCapabilities} session Host assembler (for expression eval).
 * @param {SnesSessionState} state Mutable SNES session.
 * @param {readonly string[]} words Tokenized line.
 */
export declare function handleStartpos(session: PluginSessionCapabilities, state: SnesSessionState, words: readonly string[]): void;
/** CHECK grammar is independent of session state; errors are reported only when selected. */
export declare const checkDirectiveSyntax: DirectiveSyntaxContribution;
/** Apply mapped bank slots after checking that mapper changes are legal in this stage. */
export declare function applyMapperPayload(state: SnesSessionState, node: Extract<ReturnType<typeof parseSnesDirective>, {
    operation: "mapper";
}>): void;
/** State errors precede operand errors, matching SPC block validation during source execution. */
export declare function applyStartposPayload(session: PluginSessionCapabilities, state: SnesSessionState, node: Extract<ReturnType<typeof parseSnesDirective>, {
    operation: "startpos";
}>): void;
//# sourceMappingURL=layout.d.ts.map
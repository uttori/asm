import type { Assembler } from "@uttori/asm-core";

import { applyMapperSelection, assertMapperAvailable } from "../asar/compatibility.js";
import type { SnesSessionState } from "../session-state.js";

/**
 * Mapper directive keywords registered on the SNES target.
 * `fullsa1rom` is Asar's name for what this assembler stores as `bigsa1rom`.
 */
export const MAPPER_KEYWORDS = [
  "lorom",
  "hirom",
  "exlorom",
  "exhirom",
  "sfxrom",
  "norom",
  "fullsa1rom",
  "sa1rom",
] as const;

/**
 * Applies a mapper directive. Most keywords are 1:1; `sa1rom` optionally takes
 * four comma-separated 1 MiB bank indices written into slots 0, 1, 4, 5
 * (Asar's SA-1 LoROM map - not consecutive 0–3).
 *
 * @param {SnesSessionState} state Mutable SNES session.
 * @param {readonly string[]} words Tokenized line, keyword first.
 */
export function handleMapper(state: SnesSessionState, words: readonly string[]): void {
  assertMapperAvailable(state.inSpcBlock);
  const keyword = words[0].toLowerCase();
  if (keyword !== "sa1rom") {
    applyMapperSelection(state, keyword === "fullsa1rom" ? "bigsa1rom" : keyword);
    return;
  }

  if (words.length > 1) {
    const parts = words[1].split(",");
    if (parts.length !== 4) {
      throw new Error("Invalid SA1ROM mapper specification. Expected 4 comma-separated values.");
    }
    state.sa1Banks = [];
    // Slots 2, 3, 6, 7 stay empty (`undefined` → treated as unmapped).
    state.sa1Banks[0] = parseInt(parts[0], 10) << 20;
    state.sa1Banks[1] = parseInt(parts[1], 10) << 20;
    state.sa1Banks[4] = parseInt(parts[2], 10) << 20;
    state.sa1Banks[5] = parseInt(parts[3], 10) << 20;
  } else {
    state.sa1Banks = [];
    state.sa1Banks[0] = 0 << 20;
    state.sa1Banks[1] = 1 << 20;
    state.sa1Banks[4] = 2 << 20;
    state.sa1Banks[5] = 3 << 20;
  }
  applyMapperSelection(state, "sa1rom");
}

/**
 * `check title` enables `readN` without a default.
 * `check bankcross <on|off|half|full>` sets PC wrap vs linear bank-cross policy.
 *
 * @param {SnesSessionState} state Mutable SNES session.
 * @param {readonly string[]} words Tokenized line.
 */
export function handleCheck(state: SnesSessionState, words: readonly string[]): void {
  if (words.length >= 2 && words[1].toLowerCase() === "title") {
    state.readFunctionsEnabled = true;
    return;
  }
  if (words.length < 3 || words[1].toLowerCase() !== "bankcross") {
    throw new Error("Invalid CHECK command. Expected: check bankcross <on|off|half|full>");
  }
  const mode = words[2].toLowerCase();
  if (mode === "off") state.bankCrossMode = "off";
  else if (mode === "half") state.bankCrossMode = "half";
  else if (mode === "full" || mode === "on") state.bankCrossMode = "full";
  else throw new Error(`Invalid parameter for check bankcross: ${words[2]}`);
}

/**
 * `optimize dp none|ram|always`. Unknown subcommands are ignored (Asar no-op).
 * Only DP-width inference is implemented; other `optimize` families are not.
 *
 * @param {SnesSessionState} state Mutable SNES session.
 * @param {readonly string[]} words Tokenized line.
 */
export function handleOptimize(state: SnesSessionState, words: readonly string[]): void {
  if (words.length < 3 || words[1].toLowerCase() !== "dp") return;
  const mode = words[2].toLowerCase();
  if (mode === "none") state.optimizeDirectPage = false;
  else if (mode === "ram" || mode === "always") state.optimizeDirectPage = true;
}

/**
 * `startpos <addr>` records the SPC execute address used when `endspcblock`
 * has no `execute` argument. Illegal outside an open `spcblock`.
 *
 * @param {Assembler} session Host assembler (for expression eval).
 * @param {SnesSessionState} state Mutable SNES session.
 * @param {readonly string[]} words Tokenized line.
 */
export function handleStartpos(
  session: Assembler,
  state: SnesSessionState,
  words: readonly string[],
): void {
  if (!state.inSpcBlock || !state.spcBlock) {
    throw new Error("startpos used without an active spcblock.");
  }
  if (words.length !== 2) {
    throw new Error("startpos requires exactly one parameter.");
  }
  state.spcBlock.executeAddress =
    session.operandResolver.getnum(session.resolvedefines(words[1])) & 0xffff;
}

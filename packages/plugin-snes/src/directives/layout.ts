import type {
  DirectiveSyntaxContribution,
  PluginSessionCapabilities,
  SyntaxValue,
} from "@uttori/asm-core/plugin";

import { applyMapperSelection, assertMapperAvailable } from "../asar/compatibility.js";
import { snesSessionStateKey, type SnesSessionState } from "../session-state.js";
import { parseSnesDirective } from "./syntax-parser.js";

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
 * Applies a mapper directive. Most keywords are 1:1. `sa1rom` optionally takes
 * four comma-separated 1 MiB bank indices written into slots 0, 1, 4, 5
 * (Asar's SA-1 LoROM map - not consecutive 0–3).
 *
 * @param state Mutable SNES session.
 * @param words Tokenized line, keyword first.
 */
export function handleMapper(state: SnesSessionState, words: readonly string[]): void {
  const node = parseSnesDirective("snes.directive.mapper", { words });
  if (node.operation !== "mapper") {
    throw new Error("Unexpected SNES directive operation.");
  }
  applyMapperPayload(state, node);
}

/**
 * `check title` enables `readN` without a default.
 * `check bankcross <on|off|half|full>` sets PC wrap vs linear bank-cross policy.
 *
 * @param state Mutable SNES session.
 * @param words Tokenized line.
 */
export function handleCheck(state: SnesSessionState, words: readonly string[]): void {
  applyCheckPayload(state, parseCheck(words));
}

/**
 * `optimize dp none|ram|always`. Unknown subcommands are ignored (Asar no-op).
 * Only DP-width inference is implemented. Other `optimize` families are not.
 *
 * @param state Mutable SNES session.
 * @param words Tokenized line.
 */
export function handleOptimize(state: SnesSessionState, words: readonly string[]): void {
  const node = parseSnesDirective("snes.directive.optimize", { words });
  if (node.operation !== "optimize") {
    throw new Error("Unexpected SNES directive operation.");
  }
  if (node.enabled !== undefined) {
    state.optimizeDirectPage = node.enabled;
  }
}

/**
 * `startpos <addr>` records the SPC execute address used when `endspcblock`
 * has no `execute` argument. Illegal outside an open `spcblock`.
 *
 * @param session Host assembler (for expression eval).
 * @param state Mutable SNES session.
 * @param words Tokenized line.
 */
export function handleStartpos(
  session: PluginSessionCapabilities,
  state: SnesSessionState,
  words: readonly string[],
): void {
  const node = parseSnesDirective("snes.directive.startpos", { words });
  if (node.operation !== "startpos") {
    throw new Error("Unexpected SNES directive operation.");
  }
  applyStartposPayload(session, state, node);
}

/** CHECK grammar is independent of session state; errors are reported only when selected. */
export const checkDirectiveSyntax: DirectiveSyntaxContribution = {
  version: "1",
  parse: ({ words }) => parseCheck(words),
  validate: isCheckPayload,
  bind({ state }) {
    return {
      execute(payload) {
        if (!isCheckPayload(payload)) {
          throw new Error("Invalid CHECK syntax payload.");
        }
        const active = state.get(snesSessionStateKey);
        applyCheckPayload(active, payload);
      },
    };
  },
};

/** Validate the exact portable schema again after a worker/cache round trip. */
function isCheckPayload(
  payload: SyntaxValue,
): payload is { operation: "title" } | { operation: "bankcross"; mode: "off" | "half" | "full" } {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return false;
  }
  if (!("operation" in payload)) {
    return false;
  }
  if (payload.operation === "title") {
    return Object.keys(payload).length === 1;
  }
  return (
    payload.operation === "bankcross" &&
    "mode" in payload &&
    typeof payload.mode === "string" &&
    ["off", "half", "full"].includes(payload.mode) &&
    Object.keys(payload).length === 2
  );
}

/** Apply mapped bank slots after checking that mapper changes are legal in this stage. */
export function applyMapperPayload(
  state: SnesSessionState,
  node: Extract<ReturnType<typeof parseSnesDirective>, { operation: "mapper" }>,
): void {
  assertMapperAvailable(state.inSpcBlock);
  if (node.error) {
    throw new Error(node.error);
  }
  if (node.banks) {
    state.sa1Banks = [];
    // SA-1 mapper slots 2, 3, 6 and 7 remain unmapped.
    for (const [index, slot] of [0, 1, 4, 5].entries()) {
      state.sa1Banks[slot] = node.banks[index];
    }
  }
  applyMapperSelection(state, node.mapper);
}

/** State errors precede operand errors, matching SPC block validation during source execution. */
export function applyStartposPayload(
  session: PluginSessionCapabilities,
  state: SnesSessionState,
  node: Extract<ReturnType<typeof parseSnesDirective>, { operation: "startpos" }>,
): void {
  if (!state.inSpcBlock || !state.spcBlock) {
    throw new Error("startpos used without an active spcblock.");
  }
  if (node.error) {
    throw new Error(node.error);
  }
  if (!node.expression) {
    throw new Error("Missing startpos expression.");
  }
  state.spcBlock.executeAddress = session.operandResolver.getnum(node.expression) & 0xffff;
}

/** CHECK shares one grammar across direct callers, source parsing and detached worker payloads. */
function parseCheck(words: readonly string[]): CheckPayload {
  if (words.length >= 2 && words[1].toLowerCase() === "title") {
    return { operation: "title" };
  }
  if (words.length < 3 || words[1].toLowerCase() !== "bankcross") {
    throw new Error("Invalid CHECK command. Expected: check bankcross <on|off|half|full>");
  }
  const mode = words[2].toLowerCase();
  if (mode !== "off" && mode !== "half" && mode !== "full" && mode !== "on") {
    throw new Error(`Invalid parameter for check bankcross: ${words[2]}`);
  }
  return { operation: "bankcross", mode: mode === "on" ? "full" : mode };
}

/** Parsed `check title` or `check bankcross` payload before session mutation. */
type CheckPayload =
  | { operation: "title" }
  | { operation: "bankcross"; mode: "off" | "half" | "full" };

/** Apply the already validated title or bank-cross policy. */
function applyCheckPayload(state: SnesSessionState, payload: CheckPayload): void {
  if (payload.operation === "title") {
    state.readFunctionsEnabled = true;
  } else {
    state.bankCrossMode = payload.mode;
  }
}

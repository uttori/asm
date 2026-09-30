import type { RuntimeStateValue } from "../model/project-types.js";

/** Versioned working-index contract: joint bytes and the inputs consumed by native 65816 decoding. */
export const RUNTIME_ANALYSIS_PROFILE = "65816-analysis-v2";

/**
 * Normalize aliases and unknowns exactly as native runtime decoding does. P contributes only M/X.
 * Emulation mode forces both widths. Program bank comes from the qualified instruction address.
 * A/X/Y/S, flags unrelated to width, and redundant PB/PC remain optional archive detail.
 * @param {Readonly<Record<string, RuntimeStateValue>>} state Original joint register observation.
 * @returns {Record<string, RuntimeStateValue>} Fresh canonical decoder inputs. Omitted fields remain unknown.
 */
export const project65816AnalysisState = (
  state: Readonly<Record<string, RuntimeStateValue>>,
): Record<string, RuntimeStateValue> => {
  const value = (key: string, max: number): number | undefined => {
    const entry = state[key] ?? state[key.toUpperCase()];
    return typeof entry === "number" && Number.isInteger(entry) && entry >= 0 && entry <= max
      ? entry
      : undefined;
  };
  const result: Record<string, RuntimeStateValue> = {};
  const e = value("e", 1);
  const p = value("p", 255);
  if (e !== undefined) {
    result.e = e;
  }
  if (e === 1) {
    result.p = 0x30;
  } else if (p !== undefined) {
    result.p = p & 0x30;
  }
  const db = value("db", 255);
  const d = value("d", 65535);
  if (db !== undefined) {
    result.db = db;
  }
  if (d !== undefined) {
    result.d = d;
  }
  return result;
};

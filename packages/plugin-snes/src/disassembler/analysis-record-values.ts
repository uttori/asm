import type {
  StaticAnalysisIncompleteReason,
  StaticCoverageSummary,
  StaticEffectiveAddress,
} from "@uttori/asm-disassembler";

import type { Cpu65816AbstractState } from "./65816-state.js";
import type { Spc700AbstractState } from "./spc700-state.js";
import type { SuperFxAbstractState } from "./superfx-state.js";

/**
 * Confirms `key` is an own field so a mapped key object can be read without an assertion.
 * @param value Object whose keys are exactly the fields to copy.
 * @param key Candidate field name from `Object.keys`.
 * @returns True when `key` is an own property of `value`.
 */
function isOwnKey<T extends object>(value: T, key: string): key is Extract<keyof T, string> {
  return Object.hasOwn(value, key);
}

/**
 * Lists every field of `T`. The argument's keys and values must both be those field names,
 * so a missing or extra analyzer field fails typechecking instead of being dropped from a record.
 * @param keys Field-name identity.
 * @returns Field names in source order.
 */
function completeKeys<T extends object>(keys: {
  readonly [K in keyof T]: K;
}): readonly (keyof T)[] {
  const names: (keyof T)[] = [];
  for (const key of Object.keys(keys)) {
    if (isOwnKey(keys, key)) {
      names.push(keys[key]);
    }
  }
  return names;
}

/**
 * Copies named fields into a plain record. Nested values keep their runtime identity.
 * @param value Source object.
 * @param keys Fields to copy, in record order.
 * @returns A shallow field copy.
 */
function knownFieldRecord<T extends object>(
  value: T,
  keys: readonly (keyof T)[],
): Readonly<Record<string, unknown>> {
  const record: Record<string, unknown> = {};
  for (const key of keys) {
    if (typeof key === "string") {
      record[key] = value[key];
    }
  }
  return record;
}

const cpu65816StateFields = completeKeys<Cpu65816AbstractState>({
  e: "e",
  m: "m",
  x: "x",
  carry: "carry",
  pbr: "pbr",
  dbr: "dbr",
  d: "d",
  s: "s",
  stack: "stack",
});

const spc700StateFields = completeKeys<Spc700AbstractState>({
  directPage: "directPage",
  stack: "stack",
});

const superFxStateFields = completeKeys<SuperFxAbstractState>({
  alt: "alt",
  destinationRegister: "destinationRegister",
  sourceRegister: "sourceRegister",
  programBank: "programBank",
});

/**
 * Copies 65816 abstract state into an analysis-record field.
 * @param state Incoming or outgoing analyzer state.
 * @returns Plain record of the tracked fields.
 */
export function cpu65816StateRecord(
  state: Cpu65816AbstractState,
): Readonly<Record<string, unknown>> {
  return knownFieldRecord(state, cpu65816StateFields);
}

/**
 * Copies SPC700 abstract state into an analysis-record field.
 * @param state Incoming or outgoing analyzer state.
 * @returns Plain record of the tracked fields.
 */
export function spc700StateRecord(state: Spc700AbstractState): Readonly<Record<string, unknown>> {
  return knownFieldRecord(state, spc700StateFields);
}

/**
 * Copies SuperFX abstract state into an analysis-record field.
 * @param state Incoming or outgoing analyzer state.
 * @returns Plain record of the tracked fields.
 */
export function superFxStateRecord(state: SuperFxAbstractState): Readonly<Record<string, unknown>> {
  return knownFieldRecord(state, superFxStateFields);
}

/**
 * Copies coverage counters into the summary record.
 * @param coverage Worklist coverage.
 * @returns Plain numeric record.
 */
export function coverageRecord(coverage: StaticCoverageSummary): Readonly<Record<string, number>> {
  return {
    instructionCount: coverage.instructionCount,
    functionCount: coverage.functionCount,
    reachedBytes: coverage.reachedBytes,
    totalBytes: coverage.totalBytes,
    reachedPercent: coverage.reachedPercent,
  };
}

/**
 * Copies one effective address, omitting fields the analyzer left unset.
 * @param address Memory operand description.
 * @returns Plain record.
 */
function effectiveAddressRecord(
  address: StaticEffectiveAddress,
): Readonly<Record<string, unknown>> {
  return {
    operandIndex: address.operandIndex,
    ...(address.address === undefined ? {} : { address: address.address }),
    ...(address.baseAddress === undefined ? {} : { baseAddress: address.baseAddress }),
    ...(address.symbol === undefined ? {} : { symbol: address.symbol }),
    volatile: address.volatile,
    ...(address.romOffset === undefined ? {} : { romOffset: address.romOffset }),
    explanation: address.explanation,
  };
}

/**
 * Copies effective addresses into analysis-record fields.
 * @param addresses Memory operands for one instruction.
 * @returns Plain records in the same order.
 */
export function effectiveAddressRecords(
  addresses: readonly StaticEffectiveAddress[],
): readonly Readonly<Record<string, unknown>>[] {
  return addresses.map(effectiveAddressRecord);
}

/**
 * Copies an incomplete-reason object into the summary record.
 * @param reason Why the worklist stopped.
 * @returns Plain record.
 */
function incompleteReasonRecord(
  reason: StaticAnalysisIncompleteReason,
): Readonly<Record<string, unknown>> {
  return {
    kind: reason.kind,
    address: reason.address,
    limit: reason.limit,
    message: reason.message,
  };
}

/**
 * Copies incomplete reasons into the summary record.
 * @param reasons Worklist stop reasons.
 * @returns Plain records in the same order.
 */
export function incompleteReasonRecords(
  reasons: readonly StaticAnalysisIncompleteReason[],
): readonly Readonly<Record<string, unknown>>[] {
  return reasons.map(incompleteReasonRecord);
}

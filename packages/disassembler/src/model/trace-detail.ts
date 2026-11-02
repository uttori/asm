import { canonicalValue } from "@uttori/asm-core/canonical-json";

import type { RuntimeStateValue } from "./project-types.js";

/**
 * Accept only non-null, non-array objects.
 * @param value Candidate value.
 * @returns Whether value is a plain record.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Narrow to a readonly array of unvalidated elements without widening to Array<any>.
 * @param value Candidate value.
 * @returns Whether value is an array.
 */
function isUnknownArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}

/**
 * Accept any integral number, including unsafe magnitudes.
 * @param value Candidate value.
 * @returns Whether value is an integer.
 */
function isInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

/**
 * Accept integers exactly representable as doubles.
 * @param value Candidate value.
 * @returns Whether value is a safe integer.
 */
function isSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value);
}

/**
 * Accept register values: strings, booleans and finite numbers.
 * @param value Candidate value.
 * @returns Whether value is a runtime state value.
 */
function isStateValue(value: unknown): value is RuntimeStateValue {
  return (
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  );
}

/**
 * Validate one bus operation, including actor/channel consistency for DMA and HDMA.
 * @param entry Untrusted access record.
 * @returns Whether entry is a valid memory access.
 */
function isMemoryAccess(entry: unknown): entry is RuntimeTraceMemoryAccess {
  if (!isRecord(entry)) {
    return false;
  }
  const addressSpace = entry.addressSpace;
  const address = entry.address;
  const access = entry.access;
  const width = entry.width;
  const value = entry.value;
  const actor = entry.actor;
  const channel = entry.channel;
  return (
    typeof addressSpace === "string" &&
    addressSpace !== "" &&
    isSafeInteger(address) &&
    address >= 0 &&
    (access === "read" || access === "write" || access === "fetch") &&
    isSafeInteger(width) &&
    width >= 1 &&
    width <= 8 &&
    (value === undefined || (isSafeInteger(value) && value >= 0)) &&
    (actor === undefined || actor === "cpu" || actor === "dma" || actor === "hdma") &&
    (channel === undefined ||
      (isInteger(channel) && channel >= 0 && channel <= 7 && (actor === "dma" || actor === "hdma")))
  );
}

/** An actual bus operation, captured by the producer without extra debugger reads. */
export interface RuntimeTraceMemoryAccess {
  /** Non-empty bus address space name. */
  readonly addressSpace: string;
  /** Non-negative address within addressSpace. */
  readonly address: number;
  /** Bus operation kind; fetch is an opcode or operand read. */
  readonly access: "read" | "write" | "fetch";
  /** Operation width in bytes (1-8). */
  readonly width: number;
  /** Transferred value when the producer recorded it. */
  readonly value?: number;
  /** DMA observations are contemporaneous with a CPU instruction, not performed by it. */
  readonly actor?: "cpu" | "dma" | "hdma";
  /** DMA/HDMA channel (0-7); only valid with a dma or hdma actor. */
  readonly channel?: number;
}

/** Bytes fetched during execution and registers immediately before that instruction. */
export interface RuntimeInstructionDetail {
  /** Instruction bytes in fetch order (1-16 values, 0-255). */
  readonly bytes: readonly number[];
  /** Register values keyed by producer register name, in sorted key order. */
  readonly state: Readonly<Record<string, RuntimeStateValue>>;
  /** Bus operations attributed to the instruction, at most 256; undefined when not captured. */
  readonly memoryAccesses?: readonly RuntimeTraceMemoryAccess[];
  /** Operations omitted by a bounded per-instruction producer buffer. */
  readonly droppedMemoryAccesses?: number;
}

/**
 * Validate execution details for persistence.
 * @param value Untrusted detail array.
 * @param count Expected instruction count.
 * @returns Owned details with recursively canonical key order.
 */
export const validateRuntimeInstructionDetails = (
  value: unknown,
  count: number,
): readonly RuntimeInstructionDetail[] => {
  if (!isUnknownArray(value) || value.length !== count) {
    throw new Error("Trace details must align one-to-one with instruction addresses.");
  }
  let previousKeys: readonly string[] = [];
  let sortedKeys: readonly string[] = [];
  return value.map((entry) => {
    if (!isRecord(entry)) {
      throw new Error("Trace instruction bytes must contain 1–16 byte values.");
    }
    const rawBytes = entry.bytes;
    if (!isUnknownArray(rawBytes) || rawBytes.length < 1 || rawBytes.length > 16) {
      throw new Error("Trace instruction bytes must contain 1–16 byte values.");
    }
    const bytes: number[] = [];
    for (const byte of rawBytes) {
      if (!(isInteger(byte) && byte >= 0 && byte <= 255)) {
        throw new Error("Trace instruction bytes must contain 1–16 byte values.");
      }
      bytes.push(byte);
    }
    const rawState = entry.state;
    if (!isRecord(rawState)) {
      throw new Error("Trace instruction state contains an invalid register value.");
    }
    const state: Record<string, RuntimeStateValue> = {};
    const keys = Object.keys(rawState);
    // Captures repeat one register layout millions of times. Sort only when the shape changes;
    // values are always revalidated and copied, so mutable producers cannot reuse stale state.
    if (
      keys.length !== previousKeys.length ||
      keys.some((key, index) => key !== previousKeys[index])
    ) {
      previousKeys = keys;
      sortedKeys = keys.toSorted((left, right) => left.localeCompare(right));
    }
    for (const key of sortedKeys) {
      const stateValue = rawState[key];
      if (!key || !isStateValue(stateValue)) {
        throw new Error("Trace instruction state contains an invalid register value.");
      }
      if (key === "__proto__") {
        Object.defineProperty(state, key, {
          value: stateValue,
          enumerable: true,
          writable: true,
          configurable: true,
        });
      } else {
        state[key] = stateValue;
      }
    }
    const droppedMemoryAccesses = entry.droppedMemoryAccesses;
    let droppedCount: number | undefined;
    if (droppedMemoryAccesses !== undefined) {
      if (!(isSafeInteger(droppedMemoryAccesses) && droppedMemoryAccesses >= 0)) {
        throw new Error("Trace memory loss must be a non-negative safe integer.");
      }
      droppedCount = droppedMemoryAccesses;
    }
    const rawAccesses = entry.memoryAccesses;
    if (rawAccesses !== undefined && (!isUnknownArray(rawAccesses) || rawAccesses.length > 256)) {
      throw new Error("Trace instruction memory accesses exceed the 256-operation bound.");
    }
    const memoryAccesses =
      rawAccesses === undefined
        ? undefined
        : rawAccesses.map((access) => {
            if (!isMemoryAccess(access)) {
              throw new Error("Trace contains an invalid bus operation.");
            }
            // Optional producer fields also participate in historical hashes. Canonicalize those
            // records completely rather than dropping fields outside the required bus schema.
            const normalized = canonicalValue(access);
            if (!isMemoryAccess(normalized)) {
              throw new Error("Trace contains an invalid normalized bus operation.");
            }
            return normalized;
          });
    return {
      bytes,
      ...(droppedCount === undefined ? {} : { droppedMemoryAccesses: droppedCount }),
      ...(memoryAccesses === undefined ? {} : { memoryAccesses }),
      state,
    };
  });
};

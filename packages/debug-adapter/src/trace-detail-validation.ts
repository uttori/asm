import type { DebugTraceInstructionDetail } from "./contracts.js";

function isUnknownArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertInstructionBytes(bytes: unknown): void {
  if (!isUnknownArray(bytes) || bytes.length < 1 || bytes.length > 16) {
    throw new Error("Invalid trace instruction bytes.");
  }
  for (const byte of bytes) {
    if (typeof byte !== "number" || !Number.isInteger(byte) || byte < 0 || byte > 255) {
      throw new Error("Invalid trace instruction bytes.");
    }
  }
}

function assertInstructionState(state: unknown): void {
  if (!isRecord(state)) {
    throw new Error("Invalid trace instruction state.");
  }
  for (const [key, entry] of Object.entries(state)) {
    if (
      !key ||
      (typeof entry !== "number" && typeof entry !== "boolean" && typeof entry !== "string") ||
      (typeof entry === "number" && !Number.isFinite(entry))
    ) {
      throw new Error("Invalid trace instruction state.");
    }
  }
}

function assertBusAccess(access: unknown): void {
  if (!isRecord(access)) {
    throw new Error("Invalid trace bus operation.");
  }
  const actor = access.actor === undefined ? "cpu" : access.actor;
  if (
    typeof access.addressSpace !== "string" ||
    !access.addressSpace ||
    typeof access.address !== "number" ||
    !Number.isSafeInteger(access.address) ||
    access.address < 0 ||
    (access.access !== "read" && access.access !== "write" && access.access !== "fetch") ||
    typeof access.width !== "number" ||
    !Number.isInteger(access.width) ||
    access.width < 1 ||
    access.width > 8 ||
    (access.value !== undefined &&
      (typeof access.value !== "number" ||
        !Number.isSafeInteger(access.value) ||
        access.value < 0)) ||
    (access.actor !== undefined && actor !== "cpu" && actor !== "dma" && actor !== "hdma") ||
    (access.channel !== undefined &&
      (typeof access.channel !== "number" ||
        !Number.isInteger(access.channel) ||
        access.channel < 0 ||
        access.channel > 7 ||
        (actor !== "dma" && actor !== "hdma")))
  ) {
    throw new Error("Invalid trace bus operation.");
  }
}

function assertTraceDetails(
  value: readonly unknown[],
): asserts value is readonly DebugTraceInstructionDetail[] {
  for (const detail of value) {
    assertTraceDetail(detail);
  }
}

function assertTraceDetail(detail: unknown): asserts detail is DebugTraceInstructionDetail {
  if (!isRecord(detail)) {
    throw new Error("Invalid trace instruction bytes.");
  }
  assertInstructionBytes(detail.bytes);
  assertInstructionState(detail.state);
  const dropped = detail.droppedMemoryAccesses;
  if (
    dropped !== undefined &&
    (typeof dropped !== "number" || !Number.isSafeInteger(dropped) || dropped < 0)
  ) {
    throw new Error("Invalid trace memory loss.");
  }
  const memoryAccesses = detail.memoryAccesses;
  if (
    memoryAccesses !== undefined &&
    (!isUnknownArray(memoryAccesses) || memoryAccesses.length > 256)
  ) {
    throw new Error("Invalid trace memory access bound.");
  }
  if (isUnknownArray(memoryAccesses)) {
    for (const access of memoryAccesses) {
      assertBusAccess(access);
    }
  }
}

/**
 * Validate details before they reach a debugger client.
 * @param {unknown} value Untrusted detail array.
 * @param {number} count Expected instruction count.
 * @returns {readonly DebugTraceInstructionDetail[]} Validated details.
 */
export function validateDebugTraceDetails(
  value: unknown,
  count: number,
): readonly DebugTraceInstructionDetail[] {
  if (!isUnknownArray(value) || value.length !== count) {
    throw new Error("Trace details must align with instruction addresses.");
  }
  assertTraceDetails(value);
  return value;
}

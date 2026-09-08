import type { RuntimeStateValue } from "./project-types.js";

const isArray = (value: unknown): boolean => Array.isArray(value);

/** An actual bus operation, captured by the producer without extra debugger reads. */
export interface RuntimeTraceMemoryAccess {
  readonly addressSpace: string;
  readonly address: number;
  readonly access: "read" | "write" | "fetch";
  readonly width: number;
  readonly value?: number;
  /** DMA observations are contemporaneous with a CPU instruction, not performed by it. */
  readonly actor?: "cpu" | "dma" | "hdma";
  readonly channel?: number;
}

/** Bytes fetched during execution and registers immediately before that instruction. */
export interface RuntimeInstructionDetail {
  readonly bytes: readonly number[];
  readonly state: Readonly<Record<string, RuntimeStateValue>>;
  readonly memoryAccesses?: readonly RuntimeTraceMemoryAccess[];
  /** Operations omitted by a bounded per-instruction producer buffer. */
  readonly droppedMemoryAccesses?: number;
}

/**
 * Validate execution details for persistence.
 * @param {unknown} value Untrusted detail array.
 * @param {number} count Expected instruction count.
 * @returns {readonly RuntimeInstructionDetail[]} Normalized details.
 */
export const validateRuntimeInstructionDetails = (
  value: unknown,
  count: number,
): readonly RuntimeInstructionDetail[] => {
  if (!Array.isArray(value) || value.length !== count)
    throw new Error("Trace details must align one-to-one with instruction addresses.");
  return (value as RuntimeInstructionDetail[]).map((detail: RuntimeInstructionDetail) => {
    if (
      !detail ||
      !isArray(detail.bytes) ||
      detail.bytes.length < 1 ||
      detail.bytes.length > 16 ||
      detail.bytes.some((byte) => !Number.isInteger(byte) || byte < 0 || byte > 255)
    )
      throw new Error("Trace instruction bytes must contain 1–16 byte values.");
    if (
      !detail.state ||
      typeof detail.state !== "object" ||
      isArray(detail.state) ||
      Object.entries(detail.state).some(
        ([key, entry]) =>
          !key ||
          !["number", "string", "boolean"].includes(typeof entry) ||
          (typeof entry === "number" && !Number.isFinite(entry)),
      )
    )
      throw new Error("Trace instruction state contains an invalid register value.");
    if (
      detail.droppedMemoryAccesses !== undefined &&
      (!Number.isSafeInteger(detail.droppedMemoryAccesses) || detail.droppedMemoryAccesses < 0)
    )
      throw new Error("Trace memory loss must be a non-negative safe integer.");
    if (
      detail.memoryAccesses !== undefined &&
      (!isArray(detail.memoryAccesses) || detail.memoryAccesses.length > 256)
    )
      throw new Error("Trace instruction memory accesses exceed the 256-operation bound.");
    const memoryAccesses = detail.memoryAccesses?.map((access) => {
      if (
        !access ||
        typeof access.addressSpace !== "string" ||
        !access.addressSpace ||
        !Number.isSafeInteger(access.address) ||
        access.address < 0 ||
        !["read", "write", "fetch"].includes(access.access) ||
        !Number.isSafeInteger(access.width) ||
        access.width < 1 ||
        access.width > 8 ||
        (access.value !== undefined && (!Number.isSafeInteger(access.value) || access.value < 0)) ||
        (access.actor !== undefined && !["cpu", "dma", "hdma"].includes(access.actor)) ||
        (access.channel !== undefined &&
          (!Number.isInteger(access.channel) ||
            access.channel < 0 ||
            access.channel > 7 ||
            !["dma", "hdma"].includes(access.actor ?? "cpu")))
      )
        throw new Error("Trace contains an invalid bus operation.");
      return { ...access };
    });
    return {
      bytes: [...detail.bytes],
      state: { ...detail.state },
      ...(memoryAccesses === undefined ? {} : { memoryAccesses }),
      ...(detail.droppedMemoryAccesses === undefined
        ? {}
        : { droppedMemoryAccesses: detail.droppedMemoryAccesses }),
    };
  });
};

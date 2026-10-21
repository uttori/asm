/** Bounded admission shared by persistent read workers and one-operation mutation processes. */
export class WorkerRequestSlots {
  readonly #active = new Set<number>();
  #nextId = 0;
  #disposed = false;

  constructor(readonly limit: number) {
    if (!Number.isSafeInteger(limit) || limit < 1) {
      throw new Error("Worker request limit must be a positive safe integer.");
    }
  }

  get disposed(): boolean {
    return this.#disposed;
  }

  /** Reject before allocating a process, timer or queued payload. IDs never repeat within an owner. */
  acquire(): number {
    if (this.#disposed) {
      throw new Error("Worker has been disposed.");
    }
    if (this.#active.size >= this.limit) {
      throw new Error(`Worker request capacity (${this.limit}) exceeded.`);
    }
    if (this.#nextId === Number.MAX_SAFE_INTEGER) {
      throw new Error("Worker request ID space exhausted.");
    }
    const id = ++this.#nextId;
    this.#active.add(id);
    return id;
  }

  /** Idempotence allows error, exit and cancellation races to share one settlement path. */
  release(id: number): void {
    this.#active.delete(id);
  }

  /** Disposal is terminal; a new owner must create a new lifecycle. */
  dispose(): void {
    this.#disposed = true;
    this.#active.clear();
  }
}

export interface WorkerReply {
  readonly id: number;
  readonly value?: unknown;
  readonly error?: string;
  readonly stack?: string;
}

/** Validate IPC metadata before reading IDs or resolving a promise with a foreign response. */
export function readWorkerReply(value: unknown): WorkerReply {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    !("id" in value) ||
    typeof value.id !== "number" ||
    !Number.isSafeInteger(value.id) ||
    value.id < 1
  ) {
    throw new Error("Malformed worker response identity.");
  }
  const error = "error" in value ? value.error : undefined;
  const stack = "stack" in value ? value.stack : undefined;
  if (
    (error !== undefined && typeof error !== "string") ||
    (stack !== undefined && typeof stack !== "string") ||
    (error === undefined && !Object.hasOwn(value, "value"))
  ) {
    throw new Error("Malformed worker response payload.");
  }
  return { id: value.id, error, stack, value: "value" in value ? value.value : undefined };
}

/** Timer configuration is checked before admission; negative/overflow delays must not become 1 ms. */
export function workerTimeout(value: number | undefined, fallback: number): number {
  const timeout = value ?? fallback;
  if (!Number.isSafeInteger(timeout) || timeout < 1 || timeout > 0x7fffffff) {
    throw new Error("Worker timeout must be a positive 32-bit millisecond duration.");
  }
  return timeout;
}

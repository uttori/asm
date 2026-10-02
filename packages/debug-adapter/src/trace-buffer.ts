import type { DebugTraceBatch } from "./contracts.js";

/** Construction options for one architecture-qualified, fixed-capacity trace ring. */
export interface DebugTraceBufferOptions {
  readonly architecture: string;
  readonly addressSpace: string;
  readonly capacity: number;
}

const positiveInteger = (value: number, context: string): number => {
  if (!Number.isSafeInteger(value) || value <= 0)
    {throw new Error(`${context} must be a positive safe integer.`);}
  return value;
};

const identity = (value: string, context: string): string => {
  if (value.length === 0) {throw new Error(`${context} must be a non-empty string.`);}
  return value;
};

/**
 * Bounded oldest-first-loss ring used by deterministic backends and as the reference semantics
 * for native trace producers. Pulling removes events. Stopping never discards unread entries.
 */
export class DebugTraceBuffer {
  readonly architecture: string;
  readonly addressSpace: string;
  readonly capacity: number;

  readonly #addresses: Array<number | undefined>;
  #head = 0;
  #length = 0;
  #nextSequence = 1;
  #droppedEvents = 0;
  #active = false;

  /** @param {DebugTraceBufferOptions} options Trace identity and fixed producer capacity. */
  constructor(options: DebugTraceBufferOptions) {
    this.architecture = identity(options.architecture, "Trace architecture");
    this.addressSpace = identity(options.addressSpace, "Trace address space");
    this.capacity = positiveInteger(options.capacity, "Trace capacity");
    this.#addresses = Array.from<number | undefined>({ length: this.capacity });
  }

  /** @returns {boolean} Whether new instruction addresses are currently accepted. */
  get active(): boolean {
    return this.#active;
  }

  /** @returns {number} Current retained event count, which never exceeds `capacity`. */
  get bufferedEvents(): number {
    return this.#length;
  }

  /** Resets sequence/loss state and enables a new explicit recording. */
  start(): void {
    this.#head = 0;
    this.#length = 0;
    this.#nextSequence = 1;
    this.#droppedEvents = 0;
    this.#active = true;
  }

  /** Stops accepting new events while retaining unread entries. */
  stop(): void {
    this.#active = false;
  }

  /**
   * Records one instruction address when active.
   * @param {number} address Architecture-local logical instruction address.
   */
  append(address: number): void {
    if (!this.#active) {return;}
    if (!Number.isSafeInteger(address) || address < 0)
      {throw new Error("Trace address must be a non-negative safe integer.");}
    if (this.#length === this.capacity) {
      this.#head = (this.#head + 1) % this.capacity;
      this.#length--;
      this.#droppedEvents++;
    }
    this.#addresses[(this.#head + this.#length) % this.capacity] = address;
    this.#length++;
    this.#nextSequence++;
  }

  /**
   * Destructively reads the oldest retained addresses.
   * @param {number} maxEvents Positive consumer batch bound.
   * @returns {DebugTraceBatch} Ordered addresses plus explicit cumulative loss state.
   */
  read(maxEvents: number): DebugTraceBatch {
    positiveInteger(maxEvents, "Trace batch size");
    const count = Math.min(maxEvents, this.#length);
    const sequenceStart = this.#nextSequence - this.#length;
    const addresses = Array.from({ length: count }, (_, index) => {
      const address = this.#addresses[(this.#head + index) % this.capacity];
      if (address === undefined) {throw new Error("Trace ring contains an uninitialized entry.");}
      return address;
    });
    this.#head = (this.#head + count) % this.capacity;
    this.#length -= count;
    return {
      architecture: this.architecture,
      addressSpace: this.addressSpace,
      sequenceStart,
      addresses,
      droppedEvents: this.#droppedEvents,
      active: this.#active,
    };
  }
}

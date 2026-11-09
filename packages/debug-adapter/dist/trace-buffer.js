/** Validates a positive safe integer or throws with context. */
const positiveInteger = (value, context) => {
    if (!Number.isSafeInteger(value) || value <= 0) {
        throw new Error(`${context} must be a positive safe integer.`);
    }
    return value;
};
/** Validates a non-empty string identifier or throws with context. */
const identity = (value, context) => {
    if (value.length === 0) {
        throw new Error(`${context} must be a non-empty string.`);
    }
    return value;
};
/**
 * Bounded oldest-first-loss ring used by deterministic backends and as the reference semantics
 * for native trace producers. Pulling removes events. Stopping never discards unread entries.
 */
export class DebugTraceBuffer {
    /** Architecture recorded by every batch from this buffer. */
    architecture;
    /** Address space of every retained PC. */
    addressSpace;
    /** Fixed capacity before oldest-first loss. */
    capacity;
    #addresses;
    #head = 0;
    #length = 0;
    #nextSequence = 1;
    #droppedEvents = 0;
    #active = false;
    /**
     * Allocates an empty ring with the given identity and capacity.
     * @param options Trace identity and fixed producer capacity.
     */
    constructor(options) {
        this.architecture = identity(options.architecture, "Trace architecture");
        this.addressSpace = identity(options.addressSpace, "Trace address space");
        this.capacity = positiveInteger(options.capacity, "Trace capacity");
        this.#addresses = Array.from({ length: this.capacity });
    }
    /**
     * Whether new instruction addresses are currently accepted.
     * @returns True while recording is active.
     */
    get active() {
        return this.#active;
    }
    /**
     * Current retained event count, which never exceeds capacity.
     * @returns Number of addresses waiting to be pulled.
     */
    get bufferedEvents() {
        return this.#length;
    }
    /** Resets sequence/loss state and enables a new explicit recording. */
    start() {
        this.#head = 0;
        this.#length = 0;
        this.#nextSequence = 1;
        this.#droppedEvents = 0;
        this.#active = true;
    }
    /** Stops accepting new events while retaining unread entries. */
    stop() {
        this.#active = false;
    }
    /**
     * Records one instruction address when active.
     * @param address Architecture-local logical instruction address.
     */
    append(address) {
        if (!this.#active) {
            return;
        }
        if (!Number.isSafeInteger(address) || address < 0) {
            throw new Error("Trace address must be a non-negative safe integer.");
        }
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
     * @param maxEvents Positive consumer batch bound.
     * @returns Ordered addresses plus explicit cumulative loss state.
     */
    read(maxEvents) {
        positiveInteger(maxEvents, "Trace batch size");
        const count = Math.min(maxEvents, this.#length);
        const sequenceStart = this.#nextSequence - this.#length;
        const addresses = Array.from({ length: count }, (_, index) => {
            const address = this.#addresses[(this.#head + index) % this.capacity];
            if (address === undefined) {
                throw new Error("Trace ring contains an uninitialized entry.");
            }
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
//# sourceMappingURL=trace-buffer.js.map
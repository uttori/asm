import { DEFAULT_DEBUG_SIDECAR_LIMITS, DEBUG_SIDECAR_PROTOCOL, DEBUG_SIDECAR_PROTOCOL_VERSION, DebugSidecarMessageParser, assertDebugSidecarSessionToken, encodeDebugSidecarMessage, } from "./sidecar-protocol.js";
const asError = (error) => error instanceof Error ? error : new Error(String(error));
/** Ordered request/response client shared by native emulator sidecar implementations. */
export class DebugSidecarClient {
    #transport;
    #session;
    #requestTimeoutMs;
    #limits;
    #parser;
    #pending = new Map();
    #eventListeners = new Set();
    #closeListeners = new Set();
    #dataSubscription;
    #closeSubscription;
    #nextSequence = 1;
    #closed = false;
    #closeError;
    #queuedWriteBytes = 0;
    #writeTail = Promise.resolve();
    /**
     * Starts listening to one already-created transport.
     * @param {DebugSidecarClientOptions} options Authenticated transport and safety bounds.
     */
    constructor(options) {
        assertDebugSidecarSessionToken(options.session);
        this.#transport = options.transport;
        this.#session = options.session;
        this.#requestTimeoutMs = options.requestTimeoutMs ?? 5_000;
        if (!Number.isSafeInteger(this.#requestTimeoutMs) || this.#requestTimeoutMs <= 0) {
            throw new Error("Sidecar request timeout must be a positive safe integer.");
        }
        this.#limits = options.limits ?? DEFAULT_DEBUG_SIDECAR_LIMITS;
        this.#parser = new DebugSidecarMessageParser(this.#limits);
        this.#dataSubscription = this.#transport.onData((data) => this.#receive(data));
        this.#closeSubscription = this.#transport.onClose((error) => this.#fail(error ?? new Error("Sidecar transport closed.")));
    }
    /** @returns {boolean} Whether the transport can still accept requests. */
    get closed() {
        return this.#closed;
    }
    /**
     * Subscribes to validated, session-matched events.
     * @param {(event: DebugSidecarEvent) => void} listener Event consumer.
     * @returns {DebugSubscription} Disposable subscription.
     */
    onEvent(listener) {
        this.#eventListeners.add(listener);
        return { dispose: () => this.#eventListeners.delete(listener) };
    }
    /**
     * Subscribes to terminal client failure, including native process crashes and protocol errors.
     * @param {(error: Error) => void} listener Failure consumer.
     * @returns {DebugSubscription} Disposable subscription.
     */
    onClose(listener) {
        if (this.#closeError) {
            queueMicrotask(() => listener(this.#closeError));
            return { dispose: () => undefined };
        }
        this.#closeListeners.add(listener);
        return { dispose: () => this.#closeListeners.delete(listener) };
    }
    /**
     * Sends one bounded command and resolves its paired response. A command error rejects only this
     * request. Timeout, malformed input, or transport failure closes the connection and rejects all
     * pending requests. Queue-limit rejection happens before sending and leaves the connection usable.
     * @param {DebugSidecarRequest["command"]} command Neutral sidecar command.
     * @param {Readonly<Record<string, unknown>>} arguments_ Validated command arguments.
     * @returns {Promise<unknown>} Untrusted command result for the typed backend adapter to validate.
     */
    request(command, arguments_ = {}) {
        if (this.#closed) {
            return Promise.reject(new Error("Sidecar client is closed."));
        }
        if (this.#pending.size >= this.#limits.maxQueuedMessages) {
            return Promise.reject(new Error("Too many pending sidecar requests."));
        }
        if (!Number.isSafeInteger(this.#nextSequence) || this.#nextSequence <= 0) {
            return Promise.reject(new Error("Sidecar request sequence exhausted."));
        }
        const sequence = this.#nextSequence++;
        const message = {
            protocol: DEBUG_SIDECAR_PROTOCOL,
            version: DEBUG_SIDECAR_PROTOCOL_VERSION,
            session: this.#session,
            sequence,
            type: "request",
            command,
            arguments: arguments_,
        };
        let frame;
        try {
            frame = encodeDebugSidecarMessage(message, this.#limits);
        }
        catch (error) {
            return Promise.reject(asError(error));
        }
        if (this.#queuedWriteBytes + frame.length > this.#limits.maxQueuedBytes) {
            return Promise.reject(new Error("Queued sidecar request bytes exceed the backpressure limit."));
        }
        // Reserve bytes before queuing so concurrent callers cannot each pass the same backpressure check.
        this.#queuedWriteBytes += frame.length;
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => this.#fail(new Error(`Sidecar request '${command}' timed out.`)), this.#requestTimeoutMs);
            // Register the waiter before writing because an in-process transport can deliver the reply immediately.
            this.#pending.set(sequence, { resolve, reject, timer });
            const write = this.#writeTail
                .then(() => {
                if (this.#closed) {
                    throw new Error("Sidecar client is closed.");
                }
                return this.#transport.write(frame);
            })
                .finally(() => {
                this.#queuedWriteBytes -= frame.length;
            });
            this.#writeTail = write.catch(() => undefined);
            void write.catch((error) => this.#fail(asError(error)));
        });
    }
    /**
     * Closes the connection and rejects unresolved requests.
     * @returns {Promise<void>} Completion of the transport close.
     */
    async close() {
        if (this.#closed) {
            return;
        }
        this.#fail(new Error("Sidecar client closed."), false);
        await this.#transport.close();
    }
    #receive(data) {
        if (this.#closed) {
            return;
        }
        try {
            for (const message of this.#parser.push(data)) {
                if (message.session !== this.#session) {
                    throw new Error("Sidecar message session does not match this connection.");
                }
                if (message.type === "request") {
                    throw new Error("Sidecar server sent a request on a client-only channel.");
                }
                if (message.type === "event") {
                    for (const listener of this.#eventListeners) {
                        listener(message);
                    }
                    continue;
                }
                const pending = this.#pending.get(message.requestSequence);
                if (!pending) {
                    throw new Error(`Sidecar response references unknown request ${message.requestSequence}.`);
                }
                clearTimeout(pending.timer);
                this.#pending.delete(message.requestSequence);
                if (message.success) {
                    pending.resolve(message.result);
                }
                else {
                    pending.reject(new Error(message.error ?? "Sidecar request failed."));
                }
            }
        }
        catch (error) {
            this.#fail(asError(error));
        }
    }
    #fail(error, closeTransport = true) {
        if (this.#closed) {
            return;
        }
        this.#closed = true;
        this.#closeError = error;
        this.#dataSubscription.dispose();
        this.#closeSubscription.dispose();
        for (const pending of this.#pending.values()) {
            clearTimeout(pending.timer);
            pending.reject(error);
        }
        this.#pending.clear();
        for (const listener of this.#closeListeners) {
            listener(error);
        }
        this.#closeListeners.clear();
        this.#eventListeners.clear();
        if (closeTransport) {
            // Close listeners are synchronous; best-effort transport shutdown must absorb an already terminal failure.
            // oxlint-disable-next-line promise/no-promise-in-callback
            void this.#transport.close().catch(() => undefined);
        }
    }
}
//# sourceMappingURL=sidecar-client.js.map
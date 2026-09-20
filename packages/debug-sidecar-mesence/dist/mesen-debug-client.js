import { Buffer } from "node:buffer";
import { MESEN_NATIVE_PROTOCOL_VERSION } from "./mesen-backend.js";
const asError = (error) => error instanceof Error ? error : new Error(String(error));
const positiveInteger = (value, context) => {
    if (!Number.isSafeInteger(value) || value <= 0)
        throw new Error(`${context} must be a positive safe integer.`);
    return value;
};
/** Bounded, authenticated, sequential client for the patched MesenCE debugger. */
export class FramedMesenDebugClient {
    #transport;
    #token;
    #requestTimeoutMs;
    #maxRequestBytes;
    #maxResponseBytes;
    #maxQueuedRequests;
    #maxQueuedBytes;
    #closeListeners = new Set();
    #dataSubscription;
    #closeSubscription;
    #queue = [];
    #buffer = Buffer.alloc(0);
    #pending;
    #queuedBytes = 0;
    #nextId = 1;
    #closed = false;
    #closeError;
    /** @param {FramedMesenDebugClientOptions} options Transport, one-session token, and bounds. */
    constructor(options) {
        if (!/^[\dA-Fa-f]{64}$/.test(options.token))
            throw new Error("Mesen debug token must contain 256 bits of hexadecimal data.");
        this.#transport = options.transport;
        this.#token = options.token.toLowerCase();
        this.#requestTimeoutMs = positiveInteger(options.requestTimeoutMs ?? 5_000, "Mesen request timeout");
        this.#maxRequestBytes = positiveInteger(options.maxRequestBytes ?? 64 * 1_024, "Mesen maximum request bytes");
        this.#maxResponseBytes = positiveInteger(options.maxResponseBytes ?? 256 * 1_024, "Mesen maximum response bytes");
        this.#maxQueuedRequests = positiveInteger(options.maxQueuedRequests ?? 16, "Mesen maximum queued requests");
        this.#maxQueuedBytes = positiveInteger(options.maxQueuedBytes ?? 256 * 1_024, "Mesen maximum queued bytes");
        if (this.#maxQueuedBytes < this.#maxRequestBytes + 4)
            throw new Error("Mesen queued-byte bound must hold one maximum-sized request frame.");
        this.#dataSubscription = this.#transport.onData((data) => this.#receive(data));
        this.#closeSubscription = this.#transport.onClose((error) => this.#fail(error ?? new Error("Mesen debug transport closed."), false));
    }
    /** @returns {boolean} Whether this client has permanently closed. */
    get closed() {
        return this.#closed;
    }
    /** @inheritdoc */
    request(method, parameters = {}) {
        if (this.#closed)
            return Promise.reject(new Error("Mesen debug client is closed."));
        if (!/^[A-Za-z][\dA-Za-z]*$/.test(method))
            return Promise.reject(new Error("Mesen debug method has an invalid name."));
        if (this.#nextId > Number.MAX_SAFE_INTEGER)
            return Promise.reject(new Error("Mesen debug request identifier space is exhausted."));
        const id = this.#nextId++;
        let payload;
        try {
            payload = Buffer.from(JSON.stringify({
                version: MESEN_NATIVE_PROTOCOL_VERSION,
                token: this.#token,
                id,
                method,
                params: parameters,
            }), "utf8");
        }
        catch (error) {
            return Promise.reject(asError(error));
        }
        if (payload.length === 0 || payload.length > this.#maxRequestBytes)
            return Promise.reject(new Error(`Mesen debug request exceeds ${this.#maxRequestBytes} bytes.`));
        const packet = Buffer.allocUnsafe(payload.length + 4);
        packet.writeUInt32BE(payload.length, 0);
        packet.set(payload, 4);
        const queuedCount = this.#queue.length + (this.#pending ? 1 : 0);
        if (queuedCount >= this.#maxQueuedRequests)
            return Promise.reject(new Error(`Mesen debug request queue exceeds ${this.#maxQueuedRequests} requests.`));
        if (this.#queuedBytes + packet.length > this.#maxQueuedBytes)
            return Promise.reject(new Error(`Mesen debug request queue exceeds ${this.#maxQueuedBytes} bytes.`));
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => this.#fail(new Error(`Mesen debug request '${method}' timed out.`)), this.#requestTimeoutMs);
            timer.unref();
            const request = { id, method, packet, resolve, reject, timer };
            this.#queue.push(request);
            this.#queuedBytes += packet.length;
            this.#pump();
        });
    }
    /** @inheritdoc */
    onClose(listener) {
        if (this.#closed) {
            queueMicrotask(() => listener(this.#closeError));
            return { dispose: () => undefined };
        }
        this.#closeListeners.add(listener);
        return { dispose: () => this.#closeListeners.delete(listener) };
    }
    /** @inheritdoc */
    async close() {
        if (this.#closed)
            return;
        this.#fail(new Error("Mesen debug client closed."), false);
        await this.#transport.close();
    }
    #pump() {
        if (this.#closed || this.#pending)
            return;
        const request = this.#queue.shift();
        if (!request)
            return;
        this.#pending = request;
        void this.#transport
            .write(request.packet)
            .catch((error) => this.#fail(asError(error)));
    }
    #receive(data) {
        if (this.#closed)
            return;
        try {
            const maximumBuffered = this.#maxResponseBytes + 4;
            if (this.#buffer.length + data.length > maximumBuffered)
                throw new Error(`Mesen debug receive buffer exceeds ${maximumBuffered} bytes.`);
            this.#buffer = Buffer.concat([this.#buffer, data]);
            while (this.#buffer.length >= 4) {
                const length = this.#buffer.readUInt32BE(0);
                if (length === 0 || length > this.#maxResponseBytes)
                    throw new Error(`Mesen debug response length ${length} is outside protocol bounds.`);
                if (this.#buffer.length < length + 4)
                    return;
                const payload = this.#buffer.subarray(4, length + 4);
                this.#buffer = this.#buffer.subarray(length + 4);
                this.#deliver(payload);
            }
        }
        catch (error) {
            this.#fail(asError(error));
        }
    }
    #deliver(payload) {
        let parsed;
        try {
            parsed = JSON.parse(Buffer.from(payload).toString("utf8"));
        }
        catch {
            throw new Error("Mesen debug response is not valid UTF-8 JSON.");
        }
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
            throw new Error("Mesen response must be an object.");
        const response = parsed;
        if (response.version !== MESEN_NATIVE_PROTOCOL_VERSION)
            throw new Error("Mesen debug response uses an unsupported protocol version.");
        const pending = this.#pending;
        if (!pending)
            throw new Error("Mesen debug response arrived without a pending request.");
        if (response.id !== pending.id)
            throw new Error(`Mesen debug response id ${String(response.id)} is out of order.`);
        if (typeof response.ok !== "boolean")
            throw new Error("Mesen debug response lacks ok state.");
        if (!response.ok && (typeof response.error !== "string" || response.error.length === 0))
            throw new Error("Mesen debug error response lacks a message.");
        clearTimeout(pending.timer);
        this.#pending = undefined;
        this.#queuedBytes -= pending.packet.length;
        if (response.ok)
            pending.resolve(response.result);
        else
            pending.reject(new Error(`Mesen ${pending.method} failed: ${String(response.error)}`));
        this.#pump();
    }
    #fail(error, closeTransport = true) {
        if (this.#closed)
            return;
        this.#closed = true;
        this.#closeError = error;
        this.#dataSubscription.dispose();
        this.#closeSubscription.dispose();
        const queued = this.#pending ? [this.#pending, ...this.#queue] : [...this.#queue];
        this.#pending = undefined;
        this.#queue.length = 0;
        this.#queuedBytes = 0;
        for (const request of queued) {
            clearTimeout(request.timer);
            request.reject(error);
        }
        for (const listener of this.#closeListeners)
            listener(error);
        this.#closeListeners.clear();
        if (closeTransport)
            void this.#transport.close().catch(() => undefined);
    }
}
//# sourceMappingURL=mesen-debug-client.js.map
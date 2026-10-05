import { DEBUG_BACKEND_PROTOCOL_VERSION, } from "./contracts.js";
import { DEFAULT_DEBUG_SIDECAR_LIMITS, DEBUG_SIDECAR_PROTOCOL, DEBUG_SIDECAR_PROTOCOL_VERSION, DebugSidecarMessageParser, DebugSidecarMessageQueue, assertDebugSidecarSessionToken, } from "./sidecar-protocol.js";
const isStepKind = (value) => value === "instruction" || value === "over" || value === "in" || value === "out";
const isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
const record = (value, context) => {
    if (!isRecord(value)) {
        throw new Error(`${context} must be an object.`);
    }
    return value;
};
const integer = (value, context, minimum = 0) => {
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum) {
        throw new Error(`${context} must be a safe integer greater than or equal to ${minimum}.`);
    }
    return value;
};
const positiveInteger = (value, context) => integer(value, context, 1);
const string = (value, context) => {
    if (typeof value !== "string" || value.length === 0) {
        throw new Error(`${context} must be a non-empty string.`);
    }
    return value;
};
const optionalPositiveInteger = (value, context) => value === undefined ? undefined : positiveInteger(value, context);
const boolean = (value, context, defaultValue) => {
    if (value === undefined) {
        return defaultValue;
    }
    if (typeof value !== "boolean") {
        throw new Error(`${context} must be boolean.`);
    }
    return value;
};
const address = (value, context) => {
    const candidate = record(value, context);
    if (typeof candidate.architecture !== "string" || candidate.architecture.length === 0) {
        throw new Error(`${context}.architecture must be a non-empty string.`);
    }
    if (typeof candidate.addressSpace !== "string" || candidate.addressSpace.length === 0) {
        throw new Error(`${context}.addressSpace must be a non-empty string.`);
    }
    const outputOffset = candidate.outputOffset === undefined
        ? undefined
        : integer(candidate.outputOffset, `${context}.outputOffset`);
    return {
        architecture: candidate.architecture,
        addressSpace: candidate.addressSpace,
        address: integer(candidate.address, `${context}.address`),
        ...(outputOffset === undefined ? {} : { outputOffset }),
    };
};
const addresses = (value, context) => {
    if (!Array.isArray(value)) {
        throw new Error(`${context} must be an array.`);
    }
    return value.map((entry, index) => address(entry, `${context}[${index}]`));
};
function assertShutdownCommand(command) {
    if (command !== "shutdown") {
        throw new Error(`Unsupported command '${command}'.`);
    }
}
const asError = (error) => error instanceof Error ? error : new Error(String(error));
/** Authenticated, ordered server that exposes any `DebugBackend` over the neutral wire protocol. */
export class DebugSidecarServer {
    #backendName;
    #implementation;
    #session;
    #write;
    #closeTransport;
    #parser;
    #outgoing;
    #eventSubscription;
    #serverSequence = 1;
    #capturedEvents;
    #receiveTail = Promise.resolve();
    #writeTail = Promise.resolve();
    #closed = false;
    /**
     * Creates a server around an emulator-neutral backend implementation.
     * @param {DebugSidecarServerOptions} options Identity, backend, transport, and safety bounds.
     */
    constructor(options) {
        if (typeof options.backend !== "string" || options.backend.length === 0) {
            throw new Error("Sidecar backend name must be a non-empty string.");
        }
        assertDebugSidecarSessionToken(options.session);
        this.#backendName = options.backend;
        this.#implementation = options.implementation;
        this.#session = options.session;
        this.#write = options.write;
        this.#closeTransport = options.close ?? (() => Promise.resolve());
        const limits = options.limits ?? DEFAULT_DEBUG_SIDECAR_LIMITS;
        this.#parser = new DebugSidecarMessageParser(limits);
        this.#outgoing = new DebugSidecarMessageQueue(limits);
        this.#eventSubscription = this.#implementation.onEvent((event) => this.#backendEvent(event));
    }
    /** @returns {boolean} Whether the server has permanently closed. */
    get closed() {
        return this.#closed;
    }
    /**
     * Accepts the next transport chunk. Calls are serialized even when the stream producer overlaps them.
     * @param {Uint8Array} data Framed protocol bytes from the client.
     * @returns {Promise<void>} Completion after every request in this chunk has been dispatched.
     */
    receive(data) {
        if (this.#closed) {
            return Promise.reject(new Error("Sidecar server is closed."));
        }
        const receive = this.#receiveTail.then(() => this.#receive(data));
        this.#receiveTail = receive.catch(() => undefined);
        return receive.catch(async (error) => {
            await this.close(asError(error));
            throw error;
        });
    }
    /**
     * Flushes queued output and closes the server transport exactly once.
     * @param {Error} error Optional terminal protocol or transport failure.
     * @returns {Promise<void>} Completion of transport cleanup.
     */
    async close(error) {
        if (this.#closed) {
            return;
        }
        this.#closed = true;
        this.#eventSubscription.dispose();
        // Drain the asynchronous write queue before closing; a failed write must not prevent transport cleanup.
        // oxlint-disable-next-line promise/no-promise-in-callback
        await this.#writeTail.catch(() => undefined);
        await this.#closeTransport(error);
    }
    async #receive(data) {
        for (const message of this.#parser.push(data)) {
            if (message.session !== this.#session) {
                throw new Error("Sidecar request session does not match this connection.");
            }
            if (message.type !== "request") {
                throw new Error("Sidecar client sent a non-request message on a server-only channel.");
            }
            await this.#handle(message);
        }
    }
    async #handle(request) {
        const events = [];
        this.#capturedEvents = events;
        let result;
        let failure;
        try {
            result = await this.#dispatch(request);
        }
        catch (error) {
            failure = asError(error);
        }
        finally {
            this.#capturedEvents = undefined;
        }
        await this.#send(this.#envelope({
            type: "response",
            requestSequence: request.sequence,
            success: failure === undefined,
            ...(failure ? { error: failure.message } : { result }),
        }));
        for (const event of events) {
            await this.#send(this.#eventEnvelope(event));
        }
        if (request.command === "shutdown" && !failure) {
            await this.close();
        }
    }
    async #dispatch(request) {
        const args = record(request.arguments ?? {}, "Sidecar request arguments");
        if (request.command === "initialize") {
            if (args.backend !== this.#backendName) {
                throw new Error("Unexpected backend identity.");
            }
            if (args.backendProtocolVersion !== DEBUG_BACKEND_PROTOCOL_VERSION) {
                throw new Error("Unsupported backend protocol version.");
            }
            return {
                backend: this.#backendName,
                backendProtocolVersion: DEBUG_BACKEND_PROTOCOL_VERSION,
                capabilities: this.#implementation.capabilities,
            };
        }
        if (request.command === "connect") {
            await this.#implementation.connect({
                reset: boolean(args.reset, "Connect reset", true),
            });
            return { capabilities: this.#implementation.capabilities };
        }
        if (request.command === "disconnect") {
            await this.#implementation.disconnect({
                terminate: boolean(args.terminate, "Disconnect terminate", true),
            });
            return {};
        }
        if (request.command === "pause") {
            await this.#implementation.pause(optionalPositiveInteger(args.threadId, "Pause threadId"));
            return {};
        }
        if (request.command === "continue") {
            await this.#implementation.continue(optionalPositiveInteger(args.threadId, "Continue threadId"));
            return {};
        }
        if (request.command === "step") {
            const kind = args.kind;
            if (typeof kind !== "string" || !isStepKind(kind)) {
                throw new Error(`Unsupported step kind '${String(kind)}'.`);
            }
            await this.#implementation.step(positiveInteger(args.threadId, "Step threadId"), kind);
            return {};
        }
        if (request.command === "threads") {
            return this.#implementation.threads();
        }
        if (request.command === "stackFrames") {
            return this.#implementation.stackFrames(positiveInteger(args.threadId, "Stack frames threadId"));
        }
        if (request.command === "registers") {
            return this.#implementation.registers(positiveInteger(args.frameId, "Registers frameId"));
        }
        if (request.command === "readMemory") {
            const memory = await this.#implementation.readMemory(address(args.address, "Memory address"), integer(args.count, "Memory count"));
            return {
                address: memory.address,
                data: Buffer.from(memory.bytes).toString("base64"),
                unreadableBytes: memory.unreadableBytes,
            };
        }
        if (request.command === "setBreakpoints") {
            return this.#implementation.setBreakpoints(addresses(args.breakpoints, "Breakpoint addresses"));
        }
        if (request.command === "disassemble") {
            return this.#implementation.disassemble(address(args.address, "Disassembly address"), integer(args.count, "Disassembly count"));
        }
        if (request.command === "capture") {
            const capture = args;
            validateCaptureRequest(capture);
            if (!this.#implementation.capture) {
                throw new Error("This backend does not support capture v2.");
            }
            return this.#implementation.capture(capture);
        }
        if (request.command === "startTrace") {
            if (args.detail !== undefined && args.detail !== "pc" && args.detail !== "full") {
                throw new Error("Trace detail must be pc or full.");
            }
            await this.#implementation.startTrace({
                architecture: string(args.architecture, "Trace architecture"),
                addressSpace: string(args.addressSpace, "Trace address space"),
                ...(args.detail === undefined ? {} : { detail: args.detail }),
            });
            return {};
        }
        if (request.command === "readTrace") {
            return this.#implementation.readTrace(positiveInteger(args.maxEvents, "Trace batch size"));
        }
        if (request.command === "stopTrace") {
            await this.#implementation.stopTrace();
            return {};
        }
        if (request.command === "ping") {
            return { pong: true };
        }
        assertShutdownCommand(request.command);
        return {};
    }
    #backendEvent(event) {
        if (this.#closed) {
            return;
        }
        if (this.#capturedEvents) {
            this.#capturedEvents.push(event);
            return;
        }
        void this.#send(this.#eventEnvelope(event)).catch((error) => this.close(asError(error)));
    }
    #eventEnvelope(event) {
        if (event.type === "stopped") {
            return this.#envelope({
                type: "event",
                event: "stopped",
                body: { reason: event.reason, threadId: event.threadId },
            });
        }
        if (event.type === "continued") {
            return this.#envelope({
                type: "event",
                event: "continued",
                body: { threadId: event.threadId, allThreads: event.allThreads },
            });
        }
        if (event.type === "terminated") {
            return this.#envelope({
                type: "event",
                event: "terminated",
                body: { restart: event.restart },
            });
        }
        if (event.type === "breakpoint") {
            return this.#envelope({
                type: "event",
                event: "breakpoint",
                body: { breakpoint: event.breakpoint },
            });
        }
        return this.#envelope({
            type: "event",
            event: "output",
            body: { category: event.category, text: event.text },
        });
    }
    #envelope(message) {
        if (!Number.isSafeInteger(this.#serverSequence) || this.#serverSequence <= 0) {
            throw new Error("Sidecar server sequence exhausted.");
        }
        return {
            protocol: DEBUG_SIDECAR_PROTOCOL,
            version: DEBUG_SIDECAR_PROTOCOL_VERSION,
            session: this.#session,
            sequence: this.#serverSequence++,
            ...message,
        };
    }
    #send(message) {
        if (this.#closed) {
            return Promise.reject(new Error("Sidecar server is closed."));
        }
        this.#outgoing.enqueue(message);
        const write = this.#writeTail.then(async () => {
            let frame = this.#outgoing.dequeue();
            while (frame) {
                await this.#write(frame);
                frame = this.#outgoing.dequeue();
            }
            return;
        });
        this.#writeTail = write.catch(() => undefined);
        return write;
    }
}
import { validateCaptureRequest } from "./capture-v2.js";
//# sourceMappingURL=sidecar-server.js.map
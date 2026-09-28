import { AsyncLocalStorage } from "node:async_hooks";
import path from "node:path";
import { debugMapRangesForAddress, debugMapRangesForSource, validateDebugMap, } from "@uttori/asm-core/debug-map";
import { evaluateDebugExpression, formatDebugExpressionValue } from "./debug-expression.js";
const numeric = (value, fallback = 0) => typeof value === "number" && Number.isSafeInteger(value) ? value : fallback;
const records = (value) => Array.isArray(value)
    ? value.filter((entry) => entry !== null && typeof entry === "object")
    : [];
const VIRTUAL_DISASSEMBLY_HEADER = [
    "; Debugger disassembly (temporary, read-only view)",
    "; Shown because the current instruction has no matching source line in this project.",
    "; Instructions are decoded from the debug session. Edit project source files to change code.",
    "; Columns: address, instruction bytes, assembly instruction.",
    "",
];
/**
 * Formats a qualified address for DAP memory/instruction references.
 * @param {DebugAddress} address Qualified logical address.
 * @returns {string} Stable transport string.
 */
export const formatDebugAddress = (address) => `${address.architecture}|${address.addressSpace}|0x${address.address.toString(16)}${address.outputOffset === undefined ? "" : `|0x${address.outputOffset.toString(16)}`}`;
/**
 * Parses an address produced by `formatDebugAddress`.
 * @param {string} reference Qualified address string.
 * @returns {DebugAddress | undefined} Parsed address, or undefined for malformed input.
 */
export const parseDebugAddress = (reference) => {
    const [architecture, addressSpace, rawAddress, rawOutputOffset, extra] = reference.split("|");
    if (!architecture || !addressSpace || !rawAddress || extra !== undefined) {
        return undefined;
    }
    const address = Number(rawAddress);
    if (!Number.isSafeInteger(address) || address < 0) {
        return undefined;
    }
    const outputOffset = rawOutputOffset === undefined ? undefined : Number(rawOutputOffset);
    if (outputOffset !== undefined && (!Number.isSafeInteger(outputOffset) || outputOffset < 0)) {
        return undefined;
    }
    return {
        architecture,
        addressSpace,
        address,
        ...(outputOffset === undefined ? {} : { outputOffset }),
    };
};
const backendEvent = (event) => {
    switch (event.type) {
        case "stopped":
            return {
                type: "event",
                event: "stopped",
                body: { reason: event.reason, threadId: event.threadId, allThreadsStopped: true },
            };
        case "continued":
            return {
                type: "event",
                event: "continued",
                body: { threadId: event.threadId, allThreadsContinued: event.allThreads },
            };
        case "terminated":
            return { type: "event", event: "terminated", body: { restart: event.restart } };
        case "breakpoint":
            return {
                type: "event",
                event: "breakpoint",
                body: { reason: "changed", breakpoint: dapBreakpoint(event.breakpoint) },
            };
        case "output":
            return {
                type: "event",
                event: "output",
                body: { category: event.category, output: event.text },
            };
    }
    throw new Error("Unsupported backend event.");
};
const dapBreakpoint = (breakpoint) => ({
    id: breakpoint.id,
    verified: breakpoint.verified,
    instructionReference: formatDebugAddress(breakpoint.address),
    ...(breakpoint.message ? { message: breakpoint.message } : {}),
});
const bytesText = (instruction) => instruction.bytes.map((value) => value.toString(16).padStart(2, "0")).join(" ");
/**
 * Physical-map metadata must not create duplicate execute breakpoints at one bus address.
 * @param {DebugAddress} address Qualified bus address, with optional source metadata.
 * @returns {string} Native breakpoint identity without the physical output offset.
 */
const breakpointKey = ({ architecture, addressSpace, address }) => formatDebugAddress({ architecture, addressSpace, address });
/**
 * Maximum time to wait for the asynchronous stopped event that acknowledges an
 * internal pause. A bound prevents an unresponsive emulator from hanging a DAP
 * `setBreakpoints` request indefinitely.
 */
const BREAKPOINT_UPDATE_STOP_TIMEOUT_MS = 5_000;
const registerNumber = (register) => {
    if (!register) {
        return undefined;
    }
    const normalized = register.value.startsWith("0x") ? register.value.slice(2) : register.value;
    const value = Number.parseInt(normalized, 16);
    return Number.isSafeInteger(value) ? value : undefined;
};
const processorLabel = (architecture) => {
    if (architecture === "snes.65816") {
        return "65816";
    }
    if (architecture === "snes.spc700") {
        return "SPC700";
    }
    if (architecture === "snes.superfx") {
        return "Super FX";
    }
    return architecture;
};
/**
 * Emulator-neutral DAP session. It translates protocol requests into the
 * `DebugBackend` contract and never exposes backend implementation details.
 */
export class DebugAdapterSession {
    #backend;
    #map;
    #sourceRoot;
    #sourceBreakpointAddresses;
    #sourceOutputOffset;
    #instructionAnnotation;
    #onMessage;
    #mapIssues;
    #sourceBreakpoints = new Map();
    #instructionBreakpoints = new Map();
    /** Last confirmed native table, used to recover a partially rejected replacement. */
    #verifiedBreakpoints = [];
    /** A failed table recovery must be reconciled before any execution can resume. */
    #breakpointTableReliable = true;
    #variableContainers = new Map();
    #frames = new Map();
    #threads = new Map();
    #virtualSources = new Map();
    #virtualReferences = new Map();
    #subscription;
    #nextSequence = 1;
    #nextVariableReference = 1;
    #nextSourceReference = 1;
    /**
     * Keeps events emitted during overlapping DAP requests with the request that caused
     * them. A single shared pending-event array would mix events between concurrent calls.
     */
    #eventContext = new AsyncLocalStorage();
    #configurationHandshake;
    #configurationDone;
    #cancelConfiguration;
    /** Needed because ares accepts breakpoint-table changes only while stopped. */
    #executionState = "unknown";
    /** Monotonic event/transition revision prevents a failed request undoing a newer stop. */
    #executionRevision = 0;
    #executionEnded = false;
    /** Queued user pauses take precedence over an internal automatic resume. */
    #userPauseRequests = 0;
    /** In-flight internal pause whose stopped event must not look like a user-visible stop. */
    #maintenancePause;
    /** Thread whose internal resume event must likewise remain invisible to the IDE. */
    #maintenanceResumeThreadId;
    /** Execution commands share the table-update queue. Backend events never wait on it. */
    #executionUpdateQueue = Promise.resolve();
    /**
     * Creates a DAP session around one backend.
     * @param {DebugAdapterSessionOptions} options Backend, map, and host callbacks.
     */
    constructor(options) {
        this.#backend = options.backend;
        this.#map = options.debugMap;
        this.#sourceRoot = path.resolve(options.sourceRoot ?? process.cwd());
        this.#sourceBreakpointAddresses = options.sourceBreakpointAddresses;
        this.#sourceOutputOffset = options.sourceOutputOffset;
        this.#instructionAnnotation = options.instructionAnnotation;
        this.#onMessage = options.onMessage;
        this.#configurationHandshake = options.configurationHandshake ?? false;
        this.#mapIssues = options.debugMap ? validateDebugMap(options.debugMap, options.output) : [];
        this.#subscription = this.#backend.onEvent((event) => this.#emitBackendEvent(event));
    }
    /** Releases the backend event subscription. */
    dispose() {
        this.#executionEnded = true;
        this.#executionRevision++;
        this.#cancelConfiguration?.();
        this.#cancelMaintenancePause(new Error("Debugger session disposed."));
        this.#subscription.dispose();
    }
    /**
     * Handles one request and returns all deterministically ordered response/events.
     * @param {DapRequest} request Incoming request.
     * @returns {Promise<readonly DapProtocolMessage[]>} Response followed by queued events.
     */
    async dispatch(request) {
        const pending = [];
        const context = { active: true, pending };
        return this.#eventContext.run(context, async () => {
            let response;
            try {
                const body = await this.#route(request.command, request.arguments ?? {});
                response = {
                    seq: this.#nextSequence++,
                    type: "response",
                    request_seq: request.seq,
                    success: true,
                    command: request.command,
                    ...(body === undefined ? {} : { body }),
                };
            }
            catch (error) {
                if (request.command === "launch" || request.command === "attach") {
                    // A cancelled/failed launch must not make the client show a stopped session.
                    // Compact in place so the active event context keeps its array and large output bursts
                    // cannot overflow the argument stack while we are already handling a launch failure.
                    let retained = 0;
                    for (const event of pending) {
                        if (event.event === "output") {
                            pending[retained++] = event;
                        }
                    }
                    pending.length = retained;
                }
                response = {
                    seq: this.#nextSequence++,
                    type: "response",
                    request_seq: request.seq,
                    success: false,
                    command: request.command,
                    message: error instanceof Error ? error.message : String(error),
                };
            }
            finally {
                context.active = false;
            }
            if ((request.command === "launch" || request.command === "attach") &&
                response.success &&
                !this.#configurationHandshake) {
                pending.unshift({ type: "event", event: "initialized" });
            }
            const messages = [
                response,
                ...pending.map((event) => ({ ...event, seq: this.#nextSequence++ })),
            ];
            for (const message of messages) {
                this.#onMessage?.(message);
            }
            if (request.command === "configurationDone" && response.success) {
                this.#configurationDone?.();
            }
            return messages;
        });
    }
    /**
     * Runs the DAP configuration window after the live backend is connected.
     * VS Code sends its initial breakpoints between `initialized` and
     * `configurationDone`. Connecting first leaves the emulator stopped and able to
     * accept those breakpoint-table writes before execution begins.
     * @returns {Promise<void>} Resolves after the client finishes breakpoint configuration.
     */
    async #configure() {
        if (!this.#configurationHandshake) {
            return;
        }
        const configured = new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.#configurationDone = undefined;
                this.#cancelConfiguration = undefined;
                reject(new Error("Debugger configuration timed out after 30 seconds."));
            }, 30_000);
            this.#configurationDone = () => {
                clearTimeout(timer);
                this.#configurationDone = undefined;
                this.#cancelConfiguration = undefined;
                resolve();
            };
            this.#cancelConfiguration = () => {
                clearTimeout(timer);
                this.#configurationDone = undefined;
                this.#cancelConfiguration = undefined;
                reject(new Error("Debugger launch cancelled."));
            };
        });
        this.#onMessage?.({ type: "event", event: "initialized", seq: this.#nextSequence++ });
        await configured;
    }
    async #route(command, args) {
        switch (command) {
            case "initialize":
                return this.#capabilities();
            case "launch":
                if (this.#mapIssues.length > 0) {
                    throw new Error(this.#mapIssues.join(" "));
                }
                await this.#backend.connect({ reset: true });
                await this.#configure();
                return {};
            case "attach":
                if (this.#mapIssues.length > 0) {
                    throw new Error(this.#mapIssues.join(" "));
                }
                await this.#backend.connect({ reset: false });
                await this.#configure();
                return {};
            case "configurationDone":
                return {};
            case "threads":
                return this.#threadList();
            case "stackTrace":
                return this.#stackTrace(numeric(args.threadId));
            case "scopes":
                return this.#scopes(numeric(args.frameId));
            case "variables":
                return this.#variables(numeric(args.variablesReference));
            case "evaluate":
                return this.#evaluate(args);
            case "readMemory":
                return this.#readMemory(args);
            case "setBreakpoints":
                return this.#queueExecutionUpdate(() => this.#setSourceBreakpoints(args));
            case "setInstructionBreakpoints":
                return this.#queueExecutionUpdate(() => this.#setInstructionBreakpoints(args));
            case "breakpointLocations":
                return this.#breakpointLocations(args);
            case "pause":
                this.#userPauseRequests++;
                try {
                    return await this.#queueExecutionUpdate(async () => {
                        await this.#assertThreadCapability(numeric(args.threadId), "pause");
                        await this.#backend.pause(numeric(args.threadId));
                        return {};
                    });
                }
                finally {
                    this.#userPauseRequests--;
                }
            case "continue":
                return this.#queueExecutionUpdate(async () => {
                    await this.#assertThreadCapability(numeric(args.threadId), "pause");
                    await this.#resumeExecution(() => this.#backend.continue(numeric(args.threadId)));
                    return { allThreadsContinued: true };
                });
            case "next":
            case "stepIn":
            case "stepOut":
                return this.#queueExecutionUpdate(async () => {
                    let kind;
                    if (command === "next") {
                        kind = args.granularity === "instruction" ? "instruction" : "over";
                    }
                    else if (command === "stepIn") {
                        kind = "in";
                    }
                    else {
                        kind = "out";
                    }
                    await this.#assertStepCapability(numeric(args.threadId), kind);
                    await this.#resumeExecution(() => this.#backend.step(numeric(args.threadId), kind));
                    return {};
                });
            case "disassemble":
                return this.#disassemble(args);
            case "source":
                return this.#source(numeric(args.sourceReference));
            case "uttori/traceCapabilities":
                return this.#traceCapabilities();
            case "uttori/capture": {
                const request = args;
                validateCaptureRequest(request);
                if (!this.#backend.capture) {
                    throw new Error("This backend does not support capture v2.");
                }
                return this.#backend.capture(request);
            }
            case "uttori/startTrace":
                if (args.detail !== undefined && args.detail !== "pc" && args.detail !== "full") {
                    throw new Error("Unsupported trace detail mode.");
                }
                await this.#backend.startTrace({
                    ...(args.detail === undefined ? {} : { detail: args.detail }),
                    architecture: typeof args.architecture === "string" ? args.architecture : "",
                    addressSpace: typeof args.addressSpace === "string" ? args.addressSpace : "",
                });
                return {};
            case "uttori/readTrace":
                return this.#backend.readTrace(numeric(args.maxEvents));
            case "uttori/stopTrace":
                await this.#backend.stopTrace();
                return {};
            case "disconnect":
                this.#cancelConfiguration?.();
                // Cancellation must bypass the queue: a table update may be waiting for a stop
                // that will never arrive. Drain its cleanup before closing the transport.
                this.#executionEnded = true;
                this.#executionRevision++;
                this.#cancelMaintenancePause(new Error("Debugger disconnected while updating breakpoints."));
                await this.#executionUpdateQueue;
                await this.#backend.disconnect({ terminate: args.terminateDebuggee !== false });
                return {};
            default:
                throw new Error(`Unsupported DAP request '${command}'.`);
        }
    }
    #capabilities() {
        return {
            supportsConfigurationDoneRequest: true,
            supportsReadMemoryRequest: this.#backend.capabilities.memory,
            supportsDisassembleRequest: this.#backend.capabilities.disassemble,
            supportsInstructionBreakpoints: this.#backend.capabilities.breakpoints,
            supportsBreakpointLocationsRequest: Boolean(this.#map) && this.#backend.capabilities.breakpoints,
            supportsSteppingGranularity: this.#backend.capabilities.step,
            supportsTerminateDebuggee: true,
            supportsEvaluateForHovers: this.#backend.capabilities.registers,
            supportsValueFormattingOptions: true,
        };
    }
    #architectureCapabilities(architecture) {
        return this.#backend.capabilities.architectures.find((candidate) => candidate.architecture === architecture);
    }
    async #threadList() {
        const threads = await this.#backend.threads();
        this.#threads.clear();
        for (const thread of threads) {
            this.#threads.set(thread.id, thread);
        }
        return {
            threads: threads.map((thread) => {
                const capabilities = this.#architectureCapabilities(thread.architecture);
                const unavailable = capabilities
                    ? [
                        !capabilities.step ? "step" : undefined,
                        !capabilities.registers ? "registers" : undefined,
                        !capabilities.memory ? "memory" : undefined,
                        !capabilities.breakpoints ? "breakpoints" : undefined,
                        !capabilities.disassemble ? "disassembly" : undefined,
                    ].filter((entry) => Boolean(entry))
                    : ["all inspection"];
                const supportedSteps = capabilities?.stepKinds ?? ["instruction", "over", "in", "out"];
                if (capabilities?.step && !supportedSteps.includes("over")) {
                    unavailable.push("step over");
                }
                if (capabilities?.step && !supportedSteps.includes("out")) {
                    unavailable.push("step out");
                }
                return {
                    ...thread,
                    name: unavailable.length === 0
                        ? thread.name
                        : `${thread.name} (unavailable: ${unavailable.join(", ")})`,
                };
            }),
        };
    }
    async #assertThreadCapability(threadId, operation) {
        if (!this.#threads.has(threadId)) {
            await this.#threadList();
        }
        const thread = this.#threads.get(threadId);
        if (!thread) {
            throw new Error(`Unknown debugger thread ${threadId}.`);
        }
        const capabilities = this.#architectureCapabilities(thread.architecture);
        if (!capabilities?.[operation]) {
            throw new Error(`${processorLabel(thread.architecture)} does not support ${operation}.`);
        }
    }
    async #assertStepCapability(threadId, kind) {
        await this.#assertThreadCapability(threadId, "step");
        const thread = this.#threads.get(threadId);
        const capabilities = this.#architectureCapabilities(thread.architecture);
        const supported = capabilities.stepKinds ?? ["instruction", "over", "in", "out"];
        if (!supported.includes(kind)) {
            throw new Error(`${processorLabel(thread.architecture)} does not support step ${kind}.`);
        }
    }
    #traceCapabilities() {
        const traces = [];
        for (const architecture of this.#backend.capabilities.architectures) {
            const trace = architecture.trace;
            if (!trace) {
                continue;
            }
            for (const addressSpace of trace.addressSpaces) {
                traces.push({
                    architecture: architecture.architecture,
                    addressSpace,
                    maxBufferedEvents: trace.maxBufferedEvents,
                    maxBatchEvents: trace.maxBatchEvents,
                    ...(trace.instructionDetails === undefined
                        ? {}
                        : { instructionDetails: trace.instructionDetails }),
                });
            }
        }
        return { traces };
    }
    async #stackTrace(threadId) {
        const frames = await this.#backend.stackFrames(threadId);
        for (const frame of frames) {
            this.#frames.set(frame.id, frame);
        }
        return {
            stackFrames: frames.map((frame) => {
                const range = this.#rangeForAddress(frame.pc);
                if (range && this.#map) {
                    const source = this.#map.sources.find((candidate) => candidate.id === range.sourceId);
                    if (source) {
                        const sourcePath = path.isAbsolute(source.path)
                            ? source.path
                            : path.resolve(this.#sourceRoot, source.path);
                        return {
                            id: frame.id,
                            name: frame.currentOnly ? `${frame.name} (current frame only)` : frame.name,
                            line: range.line,
                            column: 1,
                            source: { name: path.basename(sourcePath), path: sourcePath },
                            instructionPointerReference: formatDebugAddress(frame.pc),
                        };
                    }
                }
                const sourceReference = this.#virtualSourceReference(frame.pc);
                return {
                    id: frame.id,
                    name: frame.currentOnly ? `${frame.name} (current frame only)` : frame.name,
                    line: VIRTUAL_DISASSEMBLY_HEADER.length + 1,
                    column: 1,
                    source: {
                        name: `${frame.pc.architecture} disassembly`,
                        // VS Code's debug-source URI helper requires a path even for reference-only sources.
                        // This is a virtual identity, never a filesystem path to read or write.
                        path: `/uttori-disassembly/${frame.pc.architecture}/${sourceReference}.asm`,
                        sourceReference,
                        presentationHint: "normal",
                    },
                    instructionPointerReference: formatDebugAddress(frame.pc),
                };
            }),
            totalFrames: frames.length,
        };
    }
    #addVariableContainer(container) {
        const reference = this.#nextVariableReference++;
        this.#variableContainers.set(reference, container);
        return reference;
    }
    async #scopes(frameId) {
        const frame = this.#frames.get(frameId);
        if (!frame) {
            throw new Error("Unknown stack frame. Refresh the call stack and try again.");
        }
        const capabilities = this.#architectureCapabilities(frame.pc.architecture);
        if (!capabilities) {
            return { scopes: [] };
        }
        const scopes = [];
        const registers = capabilities.registers ? await this.#backend.registers(frameId) : [];
        const groups = [...new Set(registers.map((register) => register.group ?? "Registers"))];
        for (const group of groups) {
            scopes.push({
                name: `${processorLabel(frame.pc.architecture)} ${group}`,
                variablesReference: this.#addVariableContainer({ kind: "registers", registers, group }),
                expensive: false,
                presentationHint: "registers",
            });
        }
        if (frame.pc.architecture === "snes.65816" &&
            registers.some((register) => register.name.toUpperCase() === "P")) {
            scopes.push({
                name: "65816 Flags",
                variablesReference: this.#addVariableContainer({ kind: "flags", registers }),
                expensive: false,
                presentationHint: "registers",
            });
        }
        const safeSpaces = capabilities.memorySpaces
            .filter((space) => space.sideEffectFree)
            .map((space) => space.addressSpace);
        if (safeSpaces.length > 0) {
            scopes.push({
                name: `${processorLabel(frame.pc.architecture)} Memory Spaces`,
                variablesReference: this.#addVariableContainer({
                    kind: "memory-spaces",
                    architecture: frame.pc.architecture,
                    spaces: safeSpaces,
                }),
                expensive: false,
            });
        }
        const stack = this.#stackAddress(frame.pc.architecture, safeSpaces, registers);
        if (stack) {
            scopes.push({
                name: `${processorLabel(frame.pc.architecture)} Stack Bytes`,
                variablesReference: this.#addVariableContainer({
                    kind: "stack",
                    address: stack,
                    count: 32,
                }),
                expensive: false,
            });
        }
        return { scopes };
    }
    #stackAddress(architecture, spaces, registers) {
        const stackRegister = registers.find((register) => ["S", "SP"].includes(register.name.toUpperCase()));
        const stackPointer = registerNumber(stackRegister);
        if (stackPointer === undefined) {
            return undefined;
        }
        if (architecture === "snes.65816") {
            const addressSpace = spaces.find((space) => space === "snes.wram") ?? spaces[0];
            return addressSpace
                ? { architecture, addressSpace, address: Math.min(0x1ffff, stackPointer + 1) }
                : undefined;
        }
        if (architecture === "snes.spc700") {
            const addressSpace = spaces.find((space) => space === "spc.aram") ?? spaces[0];
            return addressSpace
                ? { architecture, addressSpace, address: 0x100 | ((stackPointer + 1) & 0xff) }
                : undefined;
        }
        return undefined;
    }
    #flagVariables(registers) {
        const status = registerNumber(registers.find((register) => register.name.toUpperCase() === "P"));
        const emulation = registerNumber(registers.find((register) => register.name.toUpperCase() === "E"));
        if (status === undefined) {
            return [];
        }
        const flags = [
            ["N", 7],
            ["V", 6],
            ["M", 5],
            ["X", 4],
            ["D", 3],
            ["I", 2],
            ["Z", 1],
            ["C", 0],
        ];
        return [
            ...flags.map(([name, bit]) => {
                const set = (status & (1 << bit)) !== 0;
                return {
                    name,
                    value: set ? "set (1)" : "clear (0)",
                    type: "boolean",
                    variablesReference: 0,
                };
            }),
            ...(emulation === undefined
                ? []
                : [
                    {
                        name: "E",
                        value: emulation === 0 ? "clear (0)" : "set (1)",
                        type: "boolean",
                        variablesReference: 0,
                    },
                ]),
        ];
    }
    async #variables(variablesReference) {
        const container = this.#variableContainers.get(variablesReference);
        if (!container) {
            throw new Error("Unknown variables reference.");
        }
        if (container.kind === "registers") {
            return {
                variables: container.registers
                    .filter((register) => (register.group ?? "Registers") === container.group)
                    .map((register) => ({
                    name: register.name,
                    value: `0x${register.value}`,
                    type: `uint${register.bits}`,
                    variablesReference: 0,
                })),
            };
        }
        if (container.kind === "flags") {
            return { variables: this.#flagVariables(container.registers) };
        }
        if (container.kind === "memory-spaces") {
            return {
                variables: container.spaces.map((addressSpace) => ({
                    name: addressSpace,
                    value: "side-effect-free memory",
                    type: "memory",
                    memoryReference: formatDebugAddress({
                        architecture: container.architecture,
                        addressSpace,
                        address: 0,
                    }),
                    variablesReference: 0,
                })),
            };
        }
        const memory = await this.#backend.readMemory(container.address, container.count);
        const rows = [];
        for (let offset = 0; offset < memory.bytes.length; offset += 8) {
            const bytes = memory.bytes.subarray(offset, offset + 8);
            const address = { ...memory.address, address: memory.address.address + offset };
            rows.push({
                name: `0x${address.address.toString(16).padStart(4, "0")}`,
                value: [...bytes].map((value) => value.toString(16).padStart(2, "0")).join(" "),
                type: "bytes",
                memoryReference: formatDebugAddress(address),
                variablesReference: 0,
            });
        }
        if (memory.unreadableBytes > 0) {
            rows.push({
                name: "unreadable",
                value: `${memory.unreadableBytes} byte(s)`,
                variablesReference: 0,
            });
        }
        return { variables: rows };
    }
    async #evaluate(args) {
        if (!this.#backend.capabilities.registers) {
            throw new Error("Debugger expression evaluation requires register support.");
        }
        const expression = typeof args.expression === "string" ? args.expression : "";
        const frameId = numeric(args.frameId, -1);
        if (frameId < 1) {
            throw new Error("Debugger expression evaluation requires a stack frame.");
        }
        const result = evaluateDebugExpression(expression, await this.#backend.registers(frameId));
        return {
            result: formatDebugExpressionValue(result.value),
            type: result.bits === undefined ? "integer" : `uint${result.bits}`,
            variablesReference: 0,
        };
    }
    async #readMemory(args) {
        const reference = typeof args.memoryReference === "string" ? args.memoryReference : "";
        const address = parseDebugAddress(reference);
        if (!address) {
            throw new Error("Invalid memoryReference.");
        }
        const capabilities = this.#architectureCapabilities(address.architecture);
        const memorySpace = capabilities?.memorySpaces.find((candidate) => candidate.addressSpace === address.addressSpace);
        if (!memorySpace?.sideEffectFree) {
            throw new Error(`Memory space '${address.addressSpace}' is unavailable or not guaranteed side-effect-free.`);
        }
        const offset = numeric(args.offset);
        const count = numeric(args.count);
        const result = await this.#backend.readMemory({ ...address, address: address.address + offset }, count);
        return {
            address: formatDebugAddress(result.address),
            data: Buffer.from(result.bytes).toString("base64"),
            unreadableBytes: result.unreadableBytes,
        };
    }
    /**
     * Replaces the breakpoint set for one source and reports the executable line chosen
     * for each request. Directive/comment lines move forward to the next mapped instruction.
     * @param {Record<string, unknown>} args DAP `setBreakpoints` arguments.
     * @returns {Promise<Record<string, unknown>>} Verified or rejected breakpoint results.
     */
    async #setSourceBreakpoints(args) {
        if (!this.#map) {
            throw new Error("Source breakpoints require a debug map.");
        }
        const source = args.source;
        const sourcePath = typeof source?.path === "string" ? source.path : "";
        if (!sourcePath) {
            throw new Error("Source breakpoint request requires source.path.");
        }
        const addresses = [];
        const resolved = records(args.breakpoints).map((breakpoint) => {
            const requestedLine = numeric(breakpoint.line);
            const range = this.#sourceBreakpointRange(sourcePath, requestedLine);
            const address = range ? this.#addressForRange(range) : undefined;
            const aliases = address ? (this.#sourceBreakpointAddresses?.(address) ?? [address]) : [];
            if (address && this.#supportsBreakpoint(address)) {
                for (const alias of aliases) {
                    addresses.push(alias);
                }
            }
            return { requestedLine, line: range?.line ?? requestedLine, address, aliases };
        });
        const sources = new Map(this.#sourceBreakpoints);
        sources.set(sourcePath, addresses);
        const applied = await this.#applyBreakpoints(sources, this.#instructionBreakpoints);
        return {
            breakpoints: resolved.map(({ requestedLine, line, address, aliases }) => {
                const matches = aliases.map((alias) => applied.get(breakpointKey(alias)));
                const match = address ? applied.get(breakpointKey(address)) : undefined;
                if (match) {
                    // One gutter marker represents all ROM aliases. Partial native acceptance
                    // must not turn it into a misleading verified breakpoint.
                    const verified = matches.length > 0 && matches.every((entry) => entry?.verified);
                    const result = { ...dapBreakpoint(match), verified, line };
                    if (!verified) {
                        return {
                            ...result,
                            message: matches.find((entry) => !entry?.verified)?.message ??
                                "One or more source breakpoint addresses could not be installed.",
                        };
                    }
                    return result;
                }
                let message = `No executable range at or after line ${requestedLine}.`;
                if (address && !this.#supportsBreakpoint(address)) {
                    message = `Breakpoints are unavailable for ${processorLabel(address.architecture)}.`;
                }
                return { verified: false, message, line };
            }),
        };
    }
    /**
     * Returns only mapped, backend-supported lines so the IDE can render valid gutter
     * locations before the user creates a breakpoint.
     * @param {Record<string, unknown>} args DAP source range to query.
     * @returns {Record<string, unknown>} Executable source locations in the requested range.
     */
    #breakpointLocations(args) {
        if (!this.#map) {
            throw new Error("Breakpoint locations require a debug map.");
        }
        const source = args.source;
        const sourcePath = typeof source?.path === "string" ? source.path : "";
        if (!sourcePath) {
            throw new Error("Breakpoint location request requires source.path.");
        }
        const startLine = numeric(args.line);
        const endLine = Math.max(startLine, numeric(args.endLine, startLine));
        const lines = new Set(this.#sourceRanges(sourcePath)
            .filter((range) => range.line >= startLine &&
            range.line <= endLine &&
            this.#supportsBreakpoint(this.#addressForRange(range)))
            .map((range) => range.line));
        return {
            breakpoints: [...lines]
                .sort((left, right) => left - right)
                .map((line) => ({ line, column: 1 })),
        };
    }
    async #setInstructionBreakpoints(args) {
        const instructions = new Map();
        const requested = records(args.breakpoints);
        const parsed = requested.map((breakpoint) => {
            const reference = typeof breakpoint.instructionReference === "string" ? breakpoint.instructionReference : "";
            const address = parseDebugAddress(reference);
            if (address) {
                const offset = numeric(breakpoint.offset);
                const adjusted = { ...address, address: address.address + offset };
                if (this.#supportsBreakpoint(adjusted)) {
                    instructions.set(formatDebugAddress(adjusted), adjusted);
                }
                return adjusted;
            }
            return undefined;
        });
        const applied = await this.#applyBreakpoints(this.#sourceBreakpoints, instructions);
        return {
            breakpoints: parsed.map((address) => {
                const match = address ? applied.get(breakpointKey(address)) : undefined;
                if (match) {
                    return dapBreakpoint(match);
                }
                let message = "Invalid address.";
                if (address && !this.#supportsBreakpoint(address)) {
                    message = `Breakpoints are unavailable for ${processorLabel(address.architecture)}.`;
                }
                return { verified: false, message };
            }),
        };
    }
    #supportsBreakpoint(address) {
        return this.#architectureCapabilities(address.architecture)?.breakpoints === true;
    }
    /**
     * Applies the union of source and instruction breakpoints as one backend table.
     * Live emulators require a stopped CPU for this mutation, so a running session is
     * paused briefly. A failed replacement restores the confirmed table before resuming.
     * Failed recovery leaves a visible stop and blocks execution until a successful edit.
     * @param {Map<string, DebugAddress[]>} sources Proposed per-source requests.
     * @param {Map<string, DebugAddress>} instructions Proposed instruction requests.
     * @returns {Promise<Map<string, DebugBreakpoint>>} Applied breakpoints keyed by address.
     */
    async #applyBreakpoints(sources, instructions) {
        const source = [...sources.values()].flat();
        const instruction = [...instructions.values()];
        const unique = new Map([...source, ...instruction].map((address) => [breakpointKey(address), address]));
        const addresses = [...unique.values()].filter((address) => this.#supportsBreakpoint(address));
        // The pause is protocol maintenance, not a debugging stop the user asked to observe.
        const paused = await this.#pauseForBreakpointUpdate(addresses);
        this.#assertExecutionActive();
        let result = [];
        let failure;
        try {
            result = await this.#backend.setBreakpoints(addresses);
            this.#assertExecutionActive();
            // Commit desired requests only after native confirmation. A rejected source edit
            // must not reappear when a later request updates an unrelated source file.
            this.#sourceBreakpoints = sources;
            this.#instructionBreakpoints = instructions;
            this.#verifiedBreakpoints = result.filter(({ verified }) => verified);
            this.#breakpointTableReliable = true;
        }
        catch (error) {
            this.#assertExecutionActive();
            failure = error instanceof Error ? error : new Error(String(error));
            try {
                const restored = await this.#backend.setBreakpoints(this.#verifiedBreakpoints.map(({ address }) => address));
                this.#assertExecutionActive();
                if (restored.some(({ verified }) => !verified)) {
                    throw new Error("Breakpoint recovery was not verified.");
                }
                this.#verifiedBreakpoints = restored;
                this.#breakpointTableReliable = true;
            }
            catch (recoveryError) {
                this.#breakpointTableReliable = false;
                const detail = recoveryError instanceof Error ? recoveryError.message : String(recoveryError);
                failure = new Error(`Breakpoint update failed and the previous table could not be restored: ${detail}`, { cause: error });
                for (const breakpoint of this.#verifiedBreakpoints) {
                    this.#emitBackendEvent({
                        type: "breakpoint",
                        breakpoint: {
                            ...breakpoint,
                            verified: false,
                            message: "Native breakpoint table is uncertain. Edit breakpoints again before continuing.",
                        },
                    });
                }
            }
        }
        // A newer real stop/termination wins over this maintenance operation. Also honor
        // a user pause queued while the hidden stop or table write was in flight.
        if (paused?.resume && this.#executionRevision === paused.revision && !this.#executionEnded) {
            if (this.#breakpointTableReliable && this.#userPauseRequests === 0) {
                try {
                    await this.#resumeAfterBreakpointUpdate(paused.threadId);
                }
                catch (error) {
                    if (this.#executionState === "stopped" && !this.#executionEnded) {
                        this.#emitBackendEvent({ type: "stopped", reason: "pause", threadId: paused.threadId });
                    }
                    throw error;
                }
            }
            else {
                this.#emitBackendEvent({ type: "stopped", reason: "pause", threadId: paused.threadId });
            }
        }
        if (failure) {
            throw failure;
        }
        return new Map(result.map((breakpoint) => [breakpointKey(breakpoint.address), breakpoint]));
    }
    /**
     * Finds ranges for either a portable map path or its absolute workspace spelling.
     * @param {string} sourcePath Source path supplied by the DAP client.
     * @returns {readonly DebugMapRange[]} All mapped ranges belonging to the source.
     */
    #sourceRanges(sourcePath) {
        if (!this.#map) {
            return [];
        }
        const normalized = sourcePath.split(path.sep).join("/");
        const sourceIds = new Set(this.#map.sources
            .filter((source) => source.path === normalized || normalized.endsWith(`/${source.path}`))
            .map((source) => source.id));
        return this.#map.ranges.filter((range) => sourceIds.has(range.sourceId));
    }
    /**
     * Resolves an exact line first, then the nearest later executable line in the same source.
     * @param {string} sourcePath Source path supplied by the DAP client.
     * @param {number} requestedLine One-based requested source line.
     * @returns {DebugMapRange | undefined} Executable range chosen for the breakpoint.
     */
    #sourceBreakpointRange(sourcePath, requestedLine) {
        return (debugMapRangesForSource(this.#map, sourcePath, requestedLine).find((range) => this.#supportsBreakpoint(this.#addressForRange(range))) ??
            this.#sourceRanges(sourcePath)
                .filter((range) => range.line > requestedLine && this.#supportsBreakpoint(this.#addressForRange(range)))
                .sort((left, right) => left.line - right.line || left.start - right.start)[0]);
    }
    /**
     * Serializes execution and whole-table writes without blocking backend events.
     * Otherwise a user Continue could resume the CPU during a maintenance table write.
     * @param {() => Promise<T>} update Deferred execution or breakpoint mutation.
     * @returns {Promise<T>} Result after earlier mutations settle.
     */
    #queueExecutionUpdate(update) {
        const result = this.#executionUpdateQueue.then(() => {
            this.#assertExecutionActive();
            return update();
        });
        this.#executionUpdateQueue = result.then(() => undefined, () => undefined);
        return result;
    }
    #assertExecutionActive() {
        if (this.#executionEnded) {
            throw new Error("Debugger execution session has ended.");
        }
    }
    /**
     * Records execution intent before the backend can resolve ahead of its continued
     * event. A newer stop/termination owns the state even if the operation later rejects.
     * @param {() => Promise<void>} resume Backend Continue or supported step operation.
     * @returns {Promise<void>} Resolves on backend acceptance, not on event delivery.
     */
    async #resumeExecution(resume) {
        this.#assertExecutionActive();
        if (!this.#breakpointTableReliable) {
            throw new Error("Edit breakpoints to reconcile the native table before continuing.");
        }
        const previous = this.#executionState;
        const revision = ++this.#executionRevision;
        this.#executionState = "running";
        try {
            await resume();
        }
        catch (error) {
            if (this.#executionRevision === revision) {
                this.#executionState = previous;
            }
            throw error;
        }
    }
    /**
     * Stops a running emulator long enough to change its breakpoint table.
     *
     * The returned `resume` flag is false when a real breakpoint/exception wins the race
     * with our pause request. In that case the real stop remains visible and must not be
     * undone by an automatic continue.
     * @param {readonly DebugAddress[]} addresses Breakpoints about to replace the table.
     * @returns {Promise<{ readonly threadId: number; readonly resume: boolean; readonly revision: number } | undefined>}
     * Maintenance state, or undefined when the emulator was not running.
     */
    async #pauseForBreakpointUpdate(addresses) {
        if (this.#executionState !== "running") {
            return undefined;
        }
        if (this.#threads.size === 0) {
            await this.#threadList();
        }
        this.#assertExecutionActive();
        // Thread discovery can yield long enough for a real breakpoint to stop the CPU.
        if (this.#executionState !== "running") {
            return undefined;
        }
        const architectures = new Set(addresses.map(({ architecture }) => architecture));
        // Prefer the processor receiving a breakpoint. For an empty replacement (removal),
        // fall back to any processor whose debugger owns a breakpoint table.
        const thread = [...this.#threads.values()].find(({ architecture }) => architectures.has(architecture)) ??
            [...this.#threads.values()].find(({ architecture }) => Boolean(this.#architectureCapabilities(architecture)?.breakpoints));
        if (!thread) {
            throw new Error("No breakpoint-capable debugger thread is available.");
        }
        let resolvePause;
        let rejectPause;
        const stopped = new Promise((resolve, reject) => {
            resolvePause = resolve;
            rejectPause = reject;
        });
        const timer = setTimeout(() => rejectPause(new Error("Timed out while pausing to update emulator breakpoints.")), BREAKPOINT_UPDATE_STOP_TIMEOUT_MS);
        timer.unref();
        this.#maintenancePause = { resolve: resolvePause, reject: rejectPause, timer };
        try {
            // Observe both promises immediately so cancellation/timeout cannot become an
            // unhandled rejection while the backend pause request is still pending.
            const pause = Promise.resolve().then(() => this.#backend.pause(thread.id));
            const [, stop] = await Promise.all([pause, stopped]);
            return { threadId: thread.id, ...stop };
        }
        finally {
            if (this.#maintenancePause?.timer === timer) {
                this.#maintenancePause = undefined;
            }
            clearTimeout(timer);
        }
    }
    /**
     * Resumes after a confirmed maintenance pause and marks its continued event as internal.
     * @param {number} threadId Processor thread paused for the table replacement.
     * @returns {Promise<void>} Resolves when the backend accepts the continue request.
     */
    async #resumeAfterBreakpointUpdate(threadId) {
        this.#maintenanceResumeThreadId = threadId;
        try {
            await this.#resumeExecution(() => this.#backend.continue(threadId));
        }
        catch (error) {
            if (this.#maintenanceResumeThreadId === threadId) {
                this.#maintenanceResumeThreadId = undefined;
            }
            throw error;
        }
    }
    /**
     * Rejects an in-flight breakpoint update when the debug session ends underneath it.
     * @param {Error} error Termination error reported to the waiting DAP request.
     * @returns {void}
     */
    #cancelMaintenancePause(error) {
        const maintenance = this.#maintenancePause;
        if (!maintenance) {
            return;
        }
        this.#maintenancePause = undefined;
        clearTimeout(maintenance.timer);
        maintenance.reject(error);
    }
    async #disassemble(args) {
        const reference = typeof args.memoryReference === "string" ? args.memoryReference : "";
        const address = parseDebugAddress(reference);
        if (!address) {
            throw new Error("Invalid memoryReference.");
        }
        const instructions = await this.#backend.disassemble({ ...address, address: address.address + numeric(args.instructionOffset) }, numeric(args.instructionCount));
        const texts = await Promise.all(instructions.map((instruction) => this.#annotatedInstructionText(instruction)));
        return {
            instructions: instructions.map((instruction, index) => ({
                address: formatDebugAddress(instruction.address),
                instructionBytes: bytesText(instruction),
                instruction: texts[index],
                ...(instruction.symbol ? { symbol: instruction.symbol } : {}),
            })),
        };
    }
    async #source(sourceReference) {
        const address = this.#virtualSources.get(sourceReference);
        if (!address) {
            throw new Error("Unknown source reference.");
        }
        const instructions = await this.#backend.disassemble(address, 32);
        const texts = await Promise.all(instructions.map((instruction) => this.#annotatedInstructionText(instruction)));
        const content = [
            ...VIRTUAL_DISASSEMBLY_HEADER,
            ...instructions.map((instruction, index) => `${formatDebugAddress(instruction.address)}  ${bytesText(instruction).padEnd(12)}  ${texts[index]}`),
        ].join("\n");
        return { content: `${content}\n`, mimeType: "text/x-uttori-asm" };
    }
    #rangeForAddress(address) {
        return this.#map
            ? debugMapRangesForAddress(this.#map, address.addressSpace, address.address, {
                architecture: address.architecture,
                outputOffset: address.outputOffset ?? this.#sourceOutputOffset?.(address),
            })[0]
            : undefined;
    }
    async #annotatedInstructionText(instruction) {
        let annotation;
        try {
            annotation = await this.#instructionAnnotation?.(instruction.address);
        }
        catch {
            // Presentation metadata must never break debugger control or disassembly.
        }
        return annotation ? `${instruction.text} ; ${annotation}` : instruction.text;
    }
    #addressForRange(range) {
        return {
            architecture: range.architecture,
            addressSpace: range.addressSpace,
            address: range.start,
            ...(range.outputStart === undefined ? {} : { outputOffset: range.outputStart }),
        };
    }
    #virtualSourceReference(address) {
        const key = formatDebugAddress(address);
        const existing = this.#virtualReferences.get(key);
        if (existing !== undefined) {
            return existing;
        }
        const reference = this.#nextSourceReference++;
        this.#virtualReferences.set(key, reference);
        this.#virtualSources.set(reference, address);
        return reference;
    }
    #emitBackendEvent(event) {
        if (event.type === "stopped") {
            this.#executionRevision++;
            this.#executionState = "stopped";
            this.#frames.clear();
            this.#variableContainers.clear();
            this.#virtualSources.clear();
            this.#virtualReferences.clear();
            const maintenance = this.#maintenancePause;
            if (maintenance) {
                this.#maintenancePause = undefined;
                clearTimeout(maintenance.timer);
                // Only a `pause` stop acknowledges our request. If execution hit a breakpoint,
                // exception, or step first, preserve that event and leave the emulator stopped.
                const resume = event.reason === "pause";
                maintenance.resolve({ resume, revision: this.#executionRevision });
                // Hiding the transient stop prevents UI flicker and prevents VS Code from issuing
                // stack/register reads while the adapter is immediately replacing breakpoints.
                if (resume) {
                    return;
                }
            }
        }
        else if (event.type === "continued") {
            this.#executionRevision++;
            this.#executionState = "running";
            if (this.#maintenanceResumeThreadId === event.threadId) {
                this.#maintenanceResumeThreadId = undefined;
                // This is the counterpart to the hidden maintenance stop, not a user continue.
                return;
            }
        }
        else if (event.type === "terminated") {
            this.#executionRevision++;
            this.#executionEnded = true;
            this.#executionState = "unknown";
            this.#maintenanceResumeThreadId = undefined;
            // Creating an Error captures a stack. Only pay that cost when a pending pause needs rejection.
            if (this.#maintenancePause) {
                this.#cancelMaintenancePause(new Error("Debugger terminated while updating breakpoints."));
            }
        }
        const translated = backendEvent(event);
        const context = this.#eventContext.getStore();
        if (context?.active) {
            context.pending.push(translated);
            return;
        }
        this.#onMessage?.({ ...translated, seq: this.#nextSequence++ });
    }
}
/**
 * Encodes one DAP message with a UTF-8 byte-counted Content-Length header.
 * @param {DapRequest | DapProtocolMessage} message Protocol message.
 * @returns {Uint8Array} Framed transport bytes.
 */
export const encodeDapMessage = (message) => {
    const body = Buffer.from(JSON.stringify(message), "utf8");
    return Buffer.concat([Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, "ascii"), body]);
};
/** Incremental parser for stdio/socket DAP framing. */
export class DapMessageParser {
    #buffer = Buffer.alloc(0);
    /**
     * Adds a transport chunk and returns every complete request.
     * @param {Uint8Array} chunk Transport bytes.
     * @returns {readonly DapRequest[]} Complete parsed requests.
     */
    push(chunk) {
        this.#buffer = Buffer.concat([this.#buffer, chunk]);
        const messages = [];
        while (true) {
            const separator = this.#buffer.indexOf("\r\n\r\n");
            if (separator < 0) {
                break;
            }
            const header = this.#buffer.subarray(0, separator).toString("ascii");
            const match = header.toLowerCase().match(/(?:^|\r\n)content-length: (\d+)(?:\r\n|$)/);
            if (!match) {
                throw new Error("DAP frame is missing Content-Length.");
            }
            const length = Number(match[1]);
            const start = separator + 4;
            if (this.#buffer.length < start + length) {
                break;
            }
            const body = this.#buffer.subarray(start, start + length).toString("utf8");
            this.#buffer = this.#buffer.subarray(start + length);
            messages.push(JSON.parse(body));
        }
        return messages;
    }
}
import { validateCaptureRequest } from "./capture-v2.js";
//# sourceMappingURL=dap.js.map
import { Uint8ArrayDecoderSource } from "@uttori/asm-core";
import { DEBUG_BACKEND_PROTOCOL_VERSION, validateCaptureRequest, verifyCaptureContext, validateCapturePosition, validateCaptureCapabilities, } from "@uttori/asm-debug-adapter";
import { Cpu65816Decoder, formatCpu65816Instruction, } from "@uttori/asm-plugin-snes";
import { ARES_65816_ADDRESS_SPACE, ARES_65816_ARCHITECTURE, ARES_65816_CARTRIDGE_ROM_ADDRESS_SPACE, ARES_65816_FRAME_ID, ARES_65816_THREAD_ID, ARES_65816_WRAM_ADDRESS_SPACE, ARES_RSP_CAPABILITIES, ARES_TRACE_BATCH_EVENTS, } from "./profile.js";
import { parseAresTraceDetails } from "./trace-details.js";
export * from "./profile.js";
const ARES_NAMED_MEMORY_READ_CHUNK_BYTES = 0x1000;
const asError = (error) => error instanceof Error ? error : new Error(String(error));
const checkedInteger = (value, context, maximum = Number.MAX_SAFE_INTEGER) => {
    if (!Number.isSafeInteger(value) || value < 0 || value > maximum) {
        throw new Error(`${context} must be an integer between 0 and ${maximum}.`);
    }
    return value;
};
const checkedAddress = (value, context) => {
    if (value.architecture !== ARES_65816_ARCHITECTURE) {
        throw new Error(`${context} uses unsupported architecture '${value.architecture}'.`);
    }
    if (value.addressSpace !== ARES_65816_ADDRESS_SPACE) {
        throw new Error(`${context} uses unsupported address space '${value.addressSpace}'.`);
    }
    checkedInteger(value.address, `${context} address`, 0xff_ffff);
    return { ...value, address: value.address & 0xff_ffff };
};
const checkedMemoryAddress = (value, context) => {
    if (value.architecture !== ARES_65816_ARCHITECTURE) {
        throw new Error(`${context} uses unsupported architecture '${value.architecture}'.`);
    }
    if (value.addressSpace !== ARES_65816_WRAM_ADDRESS_SPACE &&
        value.addressSpace !== ARES_65816_CARTRIDGE_ROM_ADDRESS_SPACE) {
        throw new Error(`${context} uses unsupported memory address space '${value.addressSpace}'.`);
    }
    checkedInteger(value.address, `${context} address`, 0xff_ffff);
    return { ...value };
};
const isEvenHex = (value) => {
    if (value.length % 2 !== 0) {
        return false;
    }
    for (const character of value) {
        const code = character.codePointAt(0) ?? -1;
        if (!((code >= 0x30 && code <= 0x39) ||
            (code >= 0x41 && code <= 0x46) ||
            (code >= 0x61 && code <= 0x66))) {
            return false;
        }
    }
    return true;
};
const littleEndian = (hex) => {
    const bytes = hex.match(/../g);
    if (!bytes || bytes.join("") !== hex) {
        throw new Error("Malformed little-endian register data.");
    }
    return Number.parseInt(bytes.toReversed().join(""), 16);
};
const registerHex = (value, bits) => value
    .toString(16)
    .toUpperCase()
    .padStart(Math.ceil(bits / 4), "0");
const encode = (value) => Buffer.from(value, "utf8").toString("hex");
const parseRegisters = (payload) => {
    if (!/^[\dA-Fa-f]{32}$/.test(payload)) {
        throw new Error(`Expected 16 bytes of ares 65816 registers, received ${payload.length / 2}.`);
    }
    return {
        a: littleEndian(payload.slice(0, 4)),
        x: littleEndian(payload.slice(4, 8)),
        y: littleEndian(payload.slice(8, 12)),
        s: littleEndian(payload.slice(12, 16)),
        d: littleEndian(payload.slice(16, 20)),
        db: littleEndian(payload.slice(20, 22)),
        pb: littleEndian(payload.slice(22, 24)),
        pc: littleEndian(payload.slice(24, 28)),
        p: littleEndian(payload.slice(28, 30)),
        e: littleEndian(payload.slice(30, 32)),
    };
};
const logicalPc = (registers) => ((registers.pb << 16) | registers.pc) & 0xff_ffff;
const stopSignal = (payload) => {
    if (!/^[ST][\dA-Fa-f]{2}/.test(payload)) {
        throw new Error(`Expected an RSP stop packet, received '${payload}'.`);
    }
    return Number.parseInt(payload.slice(1, 3), 16);
};
const expectOkay = (payload, context) => {
    if (payload !== "OK") {
        throw new Error(`${context} failed with RSP response '${payload}'.`);
    }
};
const safeHexInteger = (value, context) => {
    if (!/^[\dA-Fa-f]+$/.test(value)) {
        throw new Error(`${context} is not hexadecimal.`);
    }
    const parsed = Number(BigInt(`0x${value}`));
    if (!Number.isSafeInteger(parsed)) {
        throw new Error(`${context} exceeds JavaScript safe integer range.`);
    }
    return parsed;
};
/** 65816 `DebugBackend` implemented over the maintained ares fork's private RSP channel. */
export class AresRspDebugBackend {
    protocolVersion = DEBUG_BACKEND_PROTOCOL_VERSION;
    #richTrace = false;
    #captureV2 = false;
    #nativeFileIdentity;
    #captureSession;
    #captureNative = false;
    #captureScope;
    #busCaptureSupported = false;
    #contextBoundaryHeld = false;
    #contextReplayPending = false;
    get capabilities() {
        if (!this.#richTrace) {
            return ARES_RSP_CAPABILITIES;
        }
        return {
            ...ARES_RSP_CAPABILITIES,
            // Negotiated capabilities must copy nested values so enabling rich trace cannot mutate the shared baseline.
            // oxlint-disable-next-line oxc/no-map-spread
            architectures: ARES_RSP_CAPABILITIES.architectures.map((architecture) => {
                if (architecture.architecture === "snes.65816") {
                    return {
                        ...architecture,
                        addressSpaces: [...architecture.addressSpaces, "snes.sram"],
                        memorySpaces: [
                            ...architecture.memorySpaces,
                            { addressSpace: "snes.sram", sideEffectFree: true },
                        ],
                        trace: { ...architecture.trace, instructionDetails: true },
                    };
                }
                if (architecture.architecture === "snes.spc700") {
                    return {
                        ...architecture,
                        memory: true,
                        addressSpaces: [...architecture.addressSpaces, "snes.spc700.aram"],
                        memorySpaces: [{ addressSpace: "snes.spc700.aram", sideEffectFree: true }],
                    };
                }
                return architecture;
            }),
        };
    }
    #createClient;
    #terminate;
    #stopTimeoutMs;
    #listeners = new Set();
    #expectedClose = new WeakSet();
    #breakpoints = new Map();
    #decoder = new Cpu65816Decoder();
    #client;
    #subscriptions = [];
    #connected = false;
    #stopped = false;
    #pendingStopReason;
    #instructionBoundaryStop = false;
    #nextBreakpointId = 1;
    #trace;
    /** @param {AresRspBackendOptions} options RSP client/process lifecycle hooks. */
    constructor(options) {
        this.#nativeFileIdentity = options.nativeFileIdentity;
        this.#createClient = options.createClient;
        this.#terminate = options.terminate ?? (() => Promise.resolve());
        this.#stopTimeoutMs = options.stopTimeoutMs ?? 5_000;
        checkedInteger(this.#stopTimeoutMs, "Ares stop timeout");
        if (this.#stopTimeoutMs === 0) {
            throw new Error("Ares stop timeout must be positive.");
        }
    }
    /** @inheritdoc */
    async connect(options = {}) {
        if (this.#connected) {
            throw new Error("ares RSP backend is already connected.");
        }
        const reset = options.reset ?? true;
        if (!reset && this.#client && !this.#client.closed) {
            await this.#handshakeStop(this.#client, this.#instructionBoundaryStop);
            this.#connected = true;
            this.#stopped = true;
            this.#emit({ type: "stopped", reason: "entry", threadId: ARES_65816_THREAD_ID });
            return;
        }
        if (this.#client) {
            const existing = this.#client;
            this.#expectedClose.add(existing);
            await existing.close().catch(() => undefined);
            this.#releaseClient(existing);
        }
        this.#richTrace = false;
        const client = await this.#createClient({ reset: options.reset ?? true });
        if (client.closed) {
            throw new Error("ares RSP client factory returned a closed client.");
        }
        this.#client = client;
        this.#subscriptions = [
            client.onStop((event) => this.#stoppedEvent(event)),
            client.onClose((error) => this.#clientClosed(client, error)),
        ];
        try {
            await client.start();
            const supported = await client.request("qSupported");
            this.#captureV2 = supported.split(";").includes("uttoriCaptureV2+");
            this.#busCaptureSupported = false;
            if (!supported.includes("qXfer:features:read+") ||
                !supported.includes("xmlRegisters+") ||
                !supported.includes("uttoriNamedMemory+") ||
                !supported.includes("uttoriInstructionTrace+")) {
                throw new Error("ares RSP server does not advertise the required debugger extensions.");
            }
            const target = await this.#readTargetDescription(client);
            for (const register of ["a", "x", "y", "s", "d", "db", "pb", "pc", "p", "e"]) {
                if (!target.includes(`name="${register}"`)) {
                    throw new Error(`ares RSP target description is missing register '${register}'.`);
                }
            }
            this.#richTrace =
                supported.includes("uttoriInstructionDetails+") &&
                    supported.includes("uttoriSramMemory+") &&
                    supported.includes("uttoriAramMemory+");
            this.#instructionBoundaryStop = supported.includes("uttoriInstructionBoundaryStop+");
            await this.#handshakeStop(client, this.#instructionBoundaryStop);
            this.#connected = true;
            this.#stopped = true;
            this.#emit({ type: "stopped", reason: "entry", threadId: ARES_65816_THREAD_ID });
        }
        catch (error) {
            this.#expectedClose.add(client);
            await client.close().catch(() => undefined);
            this.#releaseClient(client);
            throw error;
        }
    }
    /** @inheritdoc */
    async disconnect(options = {}) {
        const client = this.#requireConnected();
        const terminate = options.terminate ?? true;
        if (this.#captureSession) {
            await this.capture({
                operation: this.#captureNative ? "file-abort" : "abort",
                session: this.#captureSession,
            }).catch(() => undefined);
            this.#captureSession = undefined;
            this.#captureScope = undefined;
        }
        if (this.#trace?.active) {
            await this.stopTrace();
        }
        if (!terminate) {
            await this.setBreakpoints([]);
            this.#connected = false;
            this.#pendingStopReason = undefined;
            return;
        }
        this.#expectedClose.add(client);
        let detachError;
        try {
            expectOkay(await client.request("D"), "ares RSP detach");
        }
        catch (error) {
            // Ares may close its socket before its queued detach OK is transmitted.
            // That EOF fulfils this terminal request. Other errors remain visible.
            const failure = asError(error);
            if (!client.closed || failure.message !== "RSP transport closed.") {
                detachError = failure;
            }
        }
        await client.close().catch((error) => {
            detachError ??= asError(error);
        });
        this.#releaseClient(client);
        this.#breakpoints.clear();
        this.#stopped = false;
        this.#pendingStopReason = undefined;
        this.#trace = undefined;
        await this.#terminate();
        this.#emit({ type: "terminated", restart: false });
        if (detachError) {
            throw detachError;
        }
    }
    /** @inheritdoc */
    async pause(threadId) {
        this.#assertThread(threadId);
        if (this.#stopped) {
            return;
        }
        this.#pendingStopReason = "pause";
        await this.#requireConnected().interrupt();
    }
    /** @inheritdoc */
    async continue(threadId) {
        this.#assertThread(threadId);
        const client = this.#requireStopped();
        if (this.#contextBoundaryHeld) {
            throw new Error("Capture context is fixing its execution boundary.");
        }
        this.#stopped = false;
        this.#pendingStopReason = this.#breakpoints.size > 0 ? "breakpoint" : "exception";
        this.#emit({ type: "continued", threadId: ARES_65816_THREAD_ID, allThreads: true });
        await client.continue();
    }
    /** @inheritdoc */
    async step(threadId, kind) {
        this.#assertThread(threadId);
        if (kind !== "instruction" && kind !== "in") {
            throw new Error(`ares does not support ${kind} stepping.`);
        }
        const client = this.#requireStopped();
        if (this.#contextBoundaryHeld) {
            throw new Error("Capture context is fixing its execution boundary.");
        }
        this.#stopped = false;
        this.#pendingStopReason = "step";
        this.#emit({ type: "continued", threadId: ARES_65816_THREAD_ID, allThreads: true });
        // Sidecar requests are serialized. A single DMA instruction can fill the bus
        // queue, so waiting here would block the drain requests needed to finish it.
        // Return after sending. The ordinary asynchronous stop event completes the step.
        if (this.#captureSession && this.#captureScope !== "snes.65816.instructions") {
            await client.step();
            return;
        }
        await this.#waitForStop(client, "instruction step", () => client.step());
    }
    /** @inheritdoc */
    threads() {
        this.#requireConnected();
        return Promise.resolve([
            { id: ARES_65816_THREAD_ID, name: "Main CPU", architecture: ARES_65816_ARCHITECTURE },
        ]);
    }
    /** @inheritdoc */
    async stackFrames(threadId) {
        this.#assertThread(threadId);
        const registers = await this.#registerSnapshot();
        return [
            {
                id: ARES_65816_FRAME_ID,
                threadId: ARES_65816_THREAD_ID,
                name: "65816",
                pc: this.#address(logicalPc(registers)),
                currentOnly: true,
            },
        ];
    }
    /** @inheritdoc */
    async registers(frameId) {
        if (frameId !== ARES_65816_FRAME_ID) {
            throw new Error(`Unknown ares frame ${frameId}.`);
        }
        const registers = await this.#registerSnapshot();
        return [
            { name: "A", value: registerHex(registers.a, 16), bits: 16, group: "CPU" },
            { name: "X", value: registerHex(registers.x, 16), bits: 16, group: "CPU" },
            { name: "Y", value: registerHex(registers.y, 16), bits: 16, group: "CPU" },
            { name: "S", value: registerHex(registers.s, 16), bits: 16, group: "CPU" },
            { name: "D", value: registerHex(registers.d, 16), bits: 16, group: "CPU" },
            { name: "DB", value: registerHex(registers.db, 8), bits: 8, group: "CPU" },
            { name: "PB", value: registerHex(registers.pb, 8), bits: 8, group: "CPU" },
            { name: "PC", value: registerHex(logicalPc(registers), 24), bits: 24, group: "CPU" },
            { name: "P", value: registerHex(registers.p, 8), bits: 8, group: "CPU" },
            { name: "E", value: registerHex(registers.e, 8), bits: 8, group: "CPU" },
        ];
    }
    /** @inheritdoc */
    async readMemory(address, count) {
        const extra = this.#richTrace &&
            ((address.architecture === "snes.65816" && address.addressSpace === "snes.sram") ||
                (address.architecture === "snes.spc700" && address.addressSpace === "snes.spc700.aram"));
        const checked = extra ? { ...address } : checkedMemoryAddress(address, "Memory request");
        checkedInteger(checked.address, "Memory address", 0xffffff);
        checkedInteger(count, "Memory count", 1_048_576);
        if (count === 0) {
            return { address: checked, bytes: new Uint8Array(), unreadableBytes: 0 };
        }
        const bytes = new Uint8Array(count);
        let offset = 0;
        const client = this.#requireStopped();
        while (offset < count) {
            const requested = Math.min(ARES_NAMED_MEMORY_READ_CHUNK_BYTES, count - offset);
            const response = await client.request(`qUttoriMemoryRead:${checked.addressSpace}:${(checked.address + offset).toString(16)},${requested.toString(16)}`);
            if (response.startsWith("E")) {
                throw new Error(`ares RSP named memory read failed with response '${response}'.`);
            }
            if (!isEvenHex(response) || response.length > requested * 2) {
                throw new Error("ares RSP named memory response is malformed or exceeds the requested count.");
            }
            const available = Buffer.from(response, "hex");
            bytes.set(available, offset);
            offset += available.length;
            if (available.length < requested) {
                break;
            }
        }
        return { address: checked, bytes, unreadableBytes: count - offset };
    }
    /** @inheritdoc */
    async setBreakpoints(addresses) {
        const client = this.#requireStopped();
        const requested = addresses.map((entry, index) => checkedAddress(entry, `Breakpoint ${index}`));
        if (new Set(requested.map(({ address }) => address)).size !== requested.length) {
            throw new Error("Duplicate ares execute breakpoint addresses are not allowed.");
        }
        const wanted = new Set(requested.map(({ address }) => address));
        for (const address of this.#breakpoints.keys()) {
            if (wanted.has(address)) {
                continue;
            }
            expectOkay(await client.request(`z0,${address.toString(16)},1`), "Remove breakpoint");
            this.#breakpoints.delete(address);
        }
        const results = [];
        for (const value of requested) {
            const existing = this.#breakpoints.get(value.address);
            if (existing) {
                results.push(existing);
                continue;
            }
            const response = await client.request(`Z0,${value.address.toString(16)},1`);
            const breakpoint = {
                id: this.#nextBreakpointId++,
                address: value,
                verified: response === "OK",
                ...(response === "OK" ? {} : { message: `ares RSP response '${response}'.` }),
            };
            if (breakpoint.verified) {
                this.#breakpoints.set(value.address, breakpoint);
            }
            results.push(breakpoint);
        }
        return results;
    }
    /** @inheritdoc */
    async disassemble(address, count) {
        let current = checkedAddress(address, "Disassembly request").address;
        checkedInteger(count, "Disassembly count", 4_096);
        const registers = await this.#registerSnapshot();
        const state = {
            e: registers.e === 0 ? 0 : 1,
            m: (registers.p >>> 5) & 1 ? 1 : 0,
            x: (registers.p >>> 4) & 1 ? 1 : 0,
            programBank: current >>> 16,
            dataBank: registers.db,
            directPage: registers.d,
        };
        const instructions = [];
        for (let index = 0; index < count; index++) {
            const memory = await this.#readCpuBus(current, 4);
            if (!memory) {
                break;
            }
            const decoded = this.#decoder.decode({
                source: new Uint8ArrayDecoderSource(memory),
                offset: 0,
                logicalAddress: current,
                state: { ...state, programBank: current >>> 16 },
            });
            if (decoded.kind !== "instruction") {
                throw new Error(decoded.kind === "ambiguous" ? decoded.reason : `65816 decode failed: ${decoded.message}`);
            }
            instructions.push({
                address: this.#address(current),
                bytes: [...decoded.instruction.bytes],
                text: formatCpu65816Instruction(decoded.instruction),
            });
            current = (current + decoded.instruction.size) & 0xff_ffff;
        }
        return instructions;
    }
    /** @inheritdoc */
    async capture(request) {
        validateCaptureRequest(request);
        const client = this.#requireConnected();
        if (request.operation === "context") {
            const identity = this.#nativeFileIdentity;
            if (!identity) {
                throw new Error("Capture context requires a verified local ares runtime.");
            }
            if (request.action === "stop" || request.action === "mark") {
                if (!this.#stopped) {
                    await this.#waitForStop(client, "capture context", () => this.pause());
                }
            }
            this.#requireStopped();
            const fields = ["qUttoriContext", request.action];
            if ("directory" in request) {
                if (request.romContentSha256 !== identity.romSha256 ||
                    request.producer.id !== "ares" ||
                    (request.producer.revision !== identity.executableSha256 &&
                        request.producer.revision !== identity.producerRevision)) {
                    throw new Error("Capture context ROM/build does not match the verified runtime.");
                }
                if (request.action === "replay" || request.action === "restore") {
                    await verifyCaptureContext(request.directory, request);
                }
                fields.push(encode(request.directory), encode(request.romContentSha256), encode(request.producer.id), encode(request.producer.revision));
            }
            if ("session" in request) {
                fields.push(request.session);
            }
            if (request.action === "mark") {
                fields.push(encode(request.label));
            }
            if (request.action === "prepare" || request.action === "stop") {
                this.#contextBoundaryHeld = true;
            }
            try {
                const response = await client.request(fields.join(":"));
                const expected = {
                    prepare: ["prepared"],
                    start: ["recording"],
                    stop: ["draining", "complete"],
                    mark: ["recording"],
                    abort: ["aborted"],
                    restore: ["restored"],
                    replay: ["replaying"],
                    status: ["idle", "replaying", "replay-diverged"],
                };
                if (!expected[request.action].includes(response)) {
                    throw new Error(`Capture context ${request.action} is unsupported or failed (${response.slice(0, 32)}). Rebuild the context-capable runtime.`);
                }
                if (request.action === "start" || request.action === "abort") {
                    this.#contextBoundaryHeld = false;
                }
                if (request.action === "replay") {
                    this.#contextReplayPending = true;
                }
                if (request.action === "restore" || request.action === "abort") {
                    this.#contextReplayPending = false;
                }
                return { contextState: response };
            }
            catch (error) {
                this.#contextBoundaryHeld = false;
                throw error;
            }
        }
        if (!this.#captureV2) {
            throw new Error("The active ares runtime does not support lossless capture v2. Install the capture-v2 runtime and restart debugging.");
        }
        if (request.operation === "file-start" ||
            request.operation === "file-capabilities" ||
            request.operation === "file-status" ||
            request.operation === "file-stop" ||
            request.operation === "file-abort" ||
            request.operation === "file-release") {
            const negotiation = request.operation === "file-start" || request.operation === "file-capabilities";
            const scope = negotiation ? (request.scope ?? "snes.65816.instructions") : this.#captureScope;
            const scopes = {
                "snes.65816.instructions": "instructions",
                "snes.cpu-bus": "bus",
                "snes.cpu-bus-transfers": "bus-transfers",
                "snes.cpu-bus-ppu": "bus-ppu",
            };
            const fields = ["qUttoriCaptureFile", request.operation.slice(5)];
            if (request.operation === "file-start") {
                this.#requireStopped();
                const identity = this.#nativeFileIdentity;
                if (!identity) {
                    throw new Error("Native file capture requires a verified local runtime host.");
                }
                if (request.romContentSha256 !== identity.romSha256 ||
                    request.producer.id !== "ares" ||
                    (request.producer.revision !== identity.executableSha256 &&
                        request.producer.revision !== identity.producerRevision)) {
                    throw new Error("Native capture identity does not match the verified ROM and executable.");
                }
                await this.capture({ operation: "file-capabilities", scope });
                fields.push(request.bufferBytes, scopes[scope], encode(request.file), request.romContentSha256, encode(request.producer.id), encode(request.producer.revision));
                if (request.measureStages) {
                    fields.push("profile");
                }
            }
            else if (request.operation === "file-capabilities") {
                fields.push(scopes[scope]);
            }
            else {
                fields.push(request.session);
            }
            const response = await client.request(fields.join(":"));
            if (response.length > 8193 || response.length % 2 !== 1 || !/^J[\da-f]+$/.test(response)) {
                throw new Error(`Native file capture ${request.operation} is unsupported or rejected (${response.slice(0, 32)}). Use the capture-file runtime.`);
            }
            const value = JSON.parse(Buffer.from(response.slice(1), "hex").toString("utf8"));
            if (request.operation === "file-capabilities") {
                const capabilities = validateCaptureCapabilities(value, scope);
                if (!capabilities.nativeFile) {
                    throw new Error("Runtime did not confirm native file ownership.");
                }
                return capabilities;
            }
            const position = validateCapturePosition(value, request.operation === "file-start" ? undefined : request.session);
            if (request.operation === "file-start") {
                this.#captureSession = position.session;
                this.#captureScope = scope;
                this.#captureNative = true;
                try {
                    validateCapturePosition(position, undefined, scope);
                }
                catch (error) {
                    await this.capture({ operation: "file-abort", session: position.session }).catch(() => undefined);
                    throw error;
                }
            }
            else if (position.state === "complete" || request.operation === "file-release") {
                this.#captureSession = undefined;
                this.#captureScope = undefined;
            }
            validateCapturePosition(position, undefined, scope);
            if (request.operation === "file-stop" || request.operation === "file-abort") {
                this.#contextBoundaryHeld = false;
            }
            return position;
        }
        const negotiation = request.operation === "start" || request.operation === "capabilities";
        const requestedScope = negotiation ? (request.scope ?? "snes.65816.instructions") : undefined;
        const ppu = requestedScope === "snes.cpu-bus-ppu";
        const bus = ppu || requestedScope === "snes.cpu-bus" || requestedScope === "snes.cpu-bus-transfers";
        const transfers = requestedScope === "snes.cpu-bus-transfers";
        // uttoriCaptureV2+ predates the bus stream. Probe its distinct capability packet
        // before arming, including callers that bypass the file recorder's negotiation.
        if (request.operation === "start" && bus && (ppu || transfers || !this.#busCaptureSupported)) {
            await this.capture({ operation: "capabilities", scope: requestedScope });
        }
        let operation = request.operation;
        if (request.operation === "capabilities" && bus) {
            operation = transfers ? "transfer-capabilities" : "bus-capabilities";
        }
        if (request.operation === "capabilities" && ppu) {
            operation = "ppu-capabilities";
        }
        const fields = ["qUttoriCapture", operation];
        if (request.operation === "start") {
            fields.push(request.bufferBytes);
            if (ppu) {
                fields.push("bus-ppu");
            }
            else if (bus) {
                fields.push(transfers ? "bus-transfers" : "bus");
            }
        }
        else if (request.operation !== "capabilities") {
            fields.push(request.session);
            if (request.operation === "read" || request.operation === "ack") {
                fields.push(request.chunk);
            }
            if (request.operation === "ack") {
                fields.push(request.event);
            }
        }
        const response = await client.request(fields.join(":"));
        if (request.operation === "capabilities" &&
            bus &&
            (!response || /^e[\da-f]{2}$/i.test(response))) {
            let feature = transfers ? "transfer boundaries" : "bus capture";
            let runtime = transfers ? "capture-transfer" : "capture-bus";
            if (ppu) {
                feature = "verified PPU effects";
                runtime = "capture-ppu";
            }
            throw new Error(`The active ares runtime does not support CPU/DMA/HDMA ${feature}. Use the ${runtime} runtime and restart debugging.`);
        }
        if (/^e[\da-f]{2}$/i.test(response)) {
            throw new Error(`Capture ${request.operation} rejected (${response}).`);
        }
        if (request.operation === "read") {
            if (response.length > 524288 || response.length % 2 || !/^[\da-f]*$/.test(response)) {
                throw new Error("Malformed capture chunk response.");
            }
            return { hex: response };
        }
        if (response.length > 8193 || response.length % 2 !== 1 || !/^J[\da-f]+$/.test(response)) {
            throw new Error("Malformed capture control response.");
        }
        const value = JSON.parse(Buffer.from(response.slice(1), "hex").toString("utf8"));
        if (request.operation === "capabilities") {
            const capabilities = validateCaptureCapabilities(value, requestedScope);
            if (bus && !transfers && !ppu) {
                this.#busCaptureSupported = true;
            }
            return capabilities;
        }
        const position = validateCapturePosition(value, request.operation === "start" ? undefined : request.session);
        if (request.operation === "start") {
            this.#captureNative = false;
            this.#captureSession = position.session;
            this.#captureScope = position.scope ?? "snes.65816.instructions";
            try {
                validateCapturePosition(position, undefined, requestedScope);
            }
            catch (error) {
                // A valid but wrong-scope start may already own a native queue. Abort it
                // before reporting failure so a rejected setup cannot keep producing.
                await this.capture({ operation: "abort", session: position.session }).catch(() => undefined);
                throw error;
            }
        }
        else if (position.session === this.#captureSession) {
            validateCapturePosition(position, this.#captureSession, this.#captureScope);
        }
        if (position.state === "complete") {
            this.#captureSession = undefined;
            this.#captureScope = undefined;
        }
        if (request.operation === "stop" || request.operation === "abort") {
            this.#contextBoundaryHeld = false;
        }
        return position;
    }
    async startTrace(options) {
        if (options.architecture !== ARES_65816_ARCHITECTURE ||
            options.addressSpace !== ARES_65816_ADDRESS_SPACE) {
            throw new Error(`Instruction trace '${options.architecture}/${options.addressSpace}' is not supported.`);
        }
        const client = this.#requireStopped();
        if (options.detail === "full" && !this.#richTrace) {
            throw new Error("This runtime supports PC-only traces. Rebuild the maintained runtime for captured bytes/state and bus accesses.");
        }
        expectOkay(await client.request(options.detail === "full" ? "QUttoriTrace:2" : "QUttoriTrace:1"), "Start instruction trace");
        this.#trace = { ...options, active: true };
    }
    /** @inheritdoc */
    async readTrace(maxEvents) {
        checkedInteger(maxEvents, "Trace batch size", ARES_TRACE_BATCH_EVENTS);
        if (maxEvents === 0) {
            throw new Error(`Trace batch size must be between 1 and ${ARES_TRACE_BATCH_EVENTS}.`);
        }
        const trace = this.#trace;
        if (!trace) {
            throw new Error("No ares instruction trace has been started.");
        }
        if (trace.detail === "full") {
            const result = parseAresTraceDetails(await this.#requireConnected().request(`qUttoriTraceDetailRead:${maxEvents.toString(16)}`), maxEvents);
            trace.active = result.active;
            return result;
        }
        const response = await this.#requireConnected().request(`qUttoriTraceRead:${maxEvents.toString(16)}`);
        const match = /^([01]):([\dA-Fa-f]+):([\dA-Fa-f]+):([\dA-Fa-f]*)$/.exec(response);
        if (!match || match[4].length % 16 !== 0) {
            throw new Error("ares RSP instruction trace response is malformed.");
        }
        const addresses = Array.from({ length: match[4].length / 16 }, (_, index) => safeHexInteger(match[4].slice(index * 16, index * 16 + 16), "Trace address"));
        if (addresses.length > maxEvents || addresses.some((address) => address > 0xff_ffff)) {
            throw new Error("ares RSP instruction trace response exceeds the requested bounds.");
        }
        const active = match[1] === "1";
        trace.active = active;
        return {
            architecture: trace.architecture,
            addressSpace: trace.addressSpace,
            sequenceStart: safeHexInteger(match[2], "Trace sequence"),
            addresses,
            droppedEvents: safeHexInteger(match[3], "Trace dropped-event count"),
            active,
        };
    }
    /** @inheritdoc */
    async stopTrace() {
        const trace = this.#trace;
        if (!trace) {
            throw new Error("No ares instruction trace has been started.");
        }
        expectOkay(await this.#requireConnected().request("QUttoriTrace:0"), "Stop instruction trace");
        trace.active = false;
    }
    /** @inheritdoc */
    onEvent(listener) {
        this.#listeners.add(listener);
        return { dispose: () => this.#listeners.delete(listener) };
    }
    async #readCpuBus(address, count) {
        const response = await this.#requireStopped().request(`m${address.toString(16)},${count.toString(16)}`);
        if (response.startsWith("E")) {
            throw new Error(`ares RSP CPU-bus disassembly read failed with response '${response}'.`);
        }
        if (!isEvenHex(response) || response.length > count * 2) {
            throw new Error("ares RSP CPU-bus disassembly response is malformed or exceeds the requested count.");
        }
        const available = Buffer.from(response, "hex");
        if (available.length === 0) {
            return undefined;
        }
        const bytes = new Uint8Array(count);
        bytes.set(available);
        return bytes;
    }
    async #readTargetDescription(client) {
        let offset = 0;
        let target = "";
        for (let part = 0; part < 16; part++) {
            const response = await client.request(`qXfer:features:read:target.xml:${offset.toString(16)},1000`);
            if (!response.startsWith("l") && !response.startsWith("m")) {
                throw new Error("ares RSP target description returned an invalid continuation marker.");
            }
            const chunk = response.slice(1);
            target += chunk;
            if (target.length > 65_536) {
                throw new Error("ares RSP target description exceeds 64 KiB.");
            }
            if (response.startsWith("l")) {
                return target;
            }
            offset += Buffer.byteLength(chunk, "ascii");
        }
        throw new Error("ares RSP target description did not terminate within 16 packets.");
    }
    async #handshakeStop(client, waitForInstructionBoundary) {
        if (!waitForInstructionBoundary) {
            stopSignal(await client.requestStop("?"));
            return;
        }
        await this.#waitForStop(client, "first instruction boundary", async () => {
            stopSignal(await client.requestStop("?"));
        });
    }
    async #waitForStop(client, context, action) {
        let resolveStop;
        let rejectStop;
        const stopped = new Promise((resolve, reject) => {
            resolveStop = resolve;
            rejectStop = reject;
        });
        const timeout = setTimeout(() => rejectStop?.(new Error(`Timed out waiting for ares ${context} stop.`)), this.#stopTimeoutMs);
        timeout.unref();
        const stopSubscription = client.onStop(() => resolveStop?.());
        const closeSubscription = client.onClose((error) => rejectStop?.(error));
        try {
            await action();
            await stopped;
        }
        finally {
            clearTimeout(timeout);
            stopSubscription.dispose();
            closeSubscription.dispose();
        }
    }
    async #registerSnapshot() {
        return parseRegisters(await this.#requireStopped().request("g"));
    }
    #address(address) {
        return {
            architecture: ARES_65816_ARCHITECTURE,
            addressSpace: ARES_65816_ADDRESS_SPACE,
            address,
        };
    }
    #assertThread(threadId) {
        if (threadId !== undefined && threadId !== ARES_65816_THREAD_ID) {
            throw new Error(`Unknown ares thread ${threadId}.`);
        }
    }
    #requireConnected() {
        if (!this.#connected || !this.#client || this.#client.closed) {
            throw new Error("ares RSP backend is not connected.");
        }
        return this.#client;
    }
    #requireStopped() {
        const client = this.#requireConnected();
        if (!this.#stopped) {
            throw new Error("ares RSP backend must be stopped for this operation.");
        }
        return client;
    }
    #stoppedEvent(event) {
        if (!this.#connected) {
            return;
        }
        stopSignal(event.payload);
        this.#stopped = true;
        const reason = this.#pendingStopReason ?? "exception";
        this.#pendingStopReason = undefined;
        if (this.#contextReplayPending && this.#client) {
            // Inspect replay outcome before publishing the stop: normal DAP variable
            // requests must not race this single-outstanding-request RSP operation.
            void this.#client
                .request("qUttoriContext:status")
                .then((status) => {
                this.#contextReplayPending = status === "replaying";
                if (status === "idle" || status === "replay-diverged") {
                    this.#emit({
                        type: "output",
                        category: status === "idle" ? "console" : "stderr",
                        text: status === "idle"
                            ? "Capture replay reached the recorded endpoint; WRAM and input consumption match.\n"
                            : "Capture replay diverged from the retained input timing or final WRAM. Execution is paused.\n",
                    });
                }
                return;
            }, (error) => {
                this.#emit({
                    type: "output",
                    category: "stderr",
                    text: `Could not verify capture replay outcome: ${String(error)}\n`,
                });
            })
                .finally(() => this.#emit({ type: "stopped", reason, threadId: ARES_65816_THREAD_ID }));
            return;
        }
        this.#emit({ type: "stopped", reason, threadId: ARES_65816_THREAD_ID });
    }
    #clientClosed(client, error) {
        if (this.#expectedClose.has(client) || this.#client !== client) {
            return;
        }
        this.#releaseClient(client);
        this.#emit({ type: "output", category: "stderr", text: `${error.message}\n` });
        this.#emit({ type: "terminated", restart: true });
    }
    #releaseClient(client) {
        if (this.#client !== client) {
            return;
        }
        for (const subscription of this.#subscriptions) {
            subscription.dispose();
        }
        this.#subscriptions = [];
        this.#client = undefined;
        this.#connected = false;
        this.#instructionBoundaryStop = false;
        this.#contextBoundaryHeld = false;
        this.#contextReplayPending = false;
        this.#trace = undefined;
    }
    #emit(event) {
        for (const listener of this.#listeners) {
            listener(event);
        }
    }
}
//# sourceMappingURL=ares-rsp-backend.js.map
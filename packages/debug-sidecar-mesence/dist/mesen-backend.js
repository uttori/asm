import { Buffer } from "node:buffer";
import { Uint8ArrayDecoderSource } from "@uttori/asm-core";
import { DEBUG_BACKEND_PROTOCOL_VERSION, } from "@uttori/asm-debug-adapter";
import { Cpu65816Decoder, Spc700Decoder, SuperFxDecoder, formatCpu65816Instruction, formatSpc700Instruction, formatSuperFxInstruction, superFxDecodeState, transferSuperFxState, } from "@uttori/asm-plugin-snes";
import { MESEN_65816_ADDRESS_SPACE, MESEN_65816_ARCHITECTURE, MESEN_65816_ROM_ADDRESS_SPACE, MESEN_65816_WRAM_ADDRESS_SPACE, MESEN_CAPABILITIES, MESEN_NATIVE_MAX_MEMORY_READ, MESEN_NATIVE_PROTOCOL_VERSION, MESEN_SPC700_ADDRESS_SPACE, MESEN_SPC700_ARCHITECTURE, MESEN_SUPERFX_ARCHITECTURE, MESEN_SUPERFX_RAM_ADDRESS_SPACE, MESEN_SUPERFX_ROM_ADDRESS_SPACE, } from "./profile.js";
export * from "./profile.js";
const threads = Object.freeze({
    "65816": Object.freeze({
        id: 1,
        frameId: 1,
        name: "Main CPU",
        architecture: MESEN_65816_ARCHITECTURE,
        processor: "65816",
    }),
    spc700: Object.freeze({
        id: 2,
        frameId: 2,
        name: "Sound CPU",
        architecture: MESEN_SPC700_ARCHITECTURE,
        processor: "spc700",
    }),
    superfx: Object.freeze({
        id: 3,
        frameId: 3,
        name: "Super FX",
        architecture: MESEN_SUPERFX_ARCHITECTURE,
        processor: "superfx",
    }),
});
const memorySpaces = Object.freeze({
    [MESEN_65816_ADDRESS_SPACE]: Object.freeze({
        processor: "65816",
        native: "SnesMemory",
        maximumAddress: 0xff_ffff,
    }),
    [MESEN_65816_WRAM_ADDRESS_SPACE]: Object.freeze({
        processor: "65816",
        native: "SnesWorkRam",
        maximumAddress: 0x01_ffff,
    }),
    [MESEN_65816_ROM_ADDRESS_SPACE]: Object.freeze({
        processor: "65816",
        native: "SnesPrgRom",
        maximumAddress: 0xff_ffff,
    }),
    [MESEN_SPC700_ADDRESS_SPACE]: Object.freeze({
        processor: "spc700",
        native: "SpcRam",
        maximumAddress: 0xffff,
    }),
    [MESEN_SUPERFX_ROM_ADDRESS_SPACE]: Object.freeze({
        processor: "superfx",
        native: "GsuMemory",
        maximumAddress: 0xff_ffff,
    }),
    [MESEN_SUPERFX_RAM_ADDRESS_SPACE]: Object.freeze({
        processor: "superfx",
        native: "GsuWorkRam",
        maximumAddress: 0xff_ffff,
    }),
});
const asError = (error) => error instanceof Error ? error : new Error(String(error));
const record = (value, context) => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new Error(`${context} must be an object.`);
    }
    return value;
};
const integer = (value, context, maximum = Number.MAX_SAFE_INTEGER) => {
    if (!Number.isSafeInteger(value) || value < 0 || value > maximum) {
        throw new Error(`${context} must be an integer between 0 and ${maximum}.`);
    }
    return value;
};
const boolean = (value, context) => {
    if (typeof value !== "boolean") {
        throw new Error(`${context} must be a boolean.`);
    }
    return value;
};
const string = (value, context) => {
    if (typeof value !== "string") {
        throw new Error(`${context} must be a string.`);
    }
    return value;
};
const processor = (value, context) => {
    const name = string(value, context);
    if (name !== "65816" && name !== "spc700" && name !== "superfx") {
        throw new Error(`${context} is unsupported.`);
    }
    return name;
};
const maximumPc = (cpu) => (cpu === "spc700" ? 0xffff : 0xff_ffff);
const parseHello = (value) => {
    const input = record(value, "Mesen hello");
    if (integer(input.protocolVersion, "Mesen native protocol version") !==
        MESEN_NATIVE_PROTOCOL_VERSION) {
        throw new Error(`Mesen native protocol version ${String(input.protocolVersion)} is unsupported.`);
    }
    if (string(input.emulator, "Mesen emulator identity") !== "MesenCE") {
        throw new Error("Mesen emulator identity is unsupported.");
    }
    if (!Array.isArray(input.processors) ||
        input.processors.length === 0 ||
        input.processors.length > 3) {
        throw new Error("Mesen processor list must contain between one and three entries.");
    }
    const available = input.processors.map((entry, index) => processor(entry, `Mesen processor ${index}`));
    if (new Set(available).size !== available.length || !available.includes("65816")) {
        throw new Error("Mesen processor list must contain one unique 65816 entry.");
    }
    const maxMemoryRead = integer(input.maxMemoryRead, "Mesen maximum memory read", 1_048_576);
    if (maxMemoryRead < 1) {
        throw new Error("Mesen maximum memory read must be positive.");
    }
    return {
        stopped: boolean(input.stopped, "Mesen stopped state"),
        processors: available,
        maxMemoryRead,
    };
};
const parseStatus = (value, expected) => {
    const input = record(value, "Mesen status");
    const cpu = processor(input.cpu, "Mesen status processor");
    if (cpu !== expected) {
        throw new Error(`Mesen status processor '${cpu}' did not match requested '${expected}'.`);
    }
    return {
        stopped: boolean(input.stopped, "Mesen status stopped state"),
        cpu,
        programCounter: integer(input.programCounter, "Mesen status program counter", maximumPc(cpu)),
        registers: record(input.registers, "Mesen status registers"),
    };
};
const parseResume = (value, expected) => {
    const input = record(value, "Mesen resume response");
    const cpu = processor(input.cpu, "Mesen resume processor");
    if (cpu !== expected) {
        throw new Error(`Mesen resume processor '${cpu}' did not match requested '${expected}'.`);
    }
    return boolean(input.stopped, "Mesen resume stopped state");
};
const registerInteger = (registers, name, bits) => integer(registers[name], `Mesen register ${name}`, bits > 32 ? Number.MAX_SAFE_INTEGER : 2 ** bits - 1);
const registerHex = (value, bits) => value
    .toString(16)
    .toUpperCase()
    .padStart(Math.ceil(bits / 4), "0");
const debugRegister = (registers, name, bits, outputName = name) => ({
    name: outputName,
    value: registerHex(registerInteger(registers, name, bits), bits),
    bits,
    group: "CPU",
});
const debugFlag = (registers, nativeName, outputName = nativeName) => ({
    name: outputName,
    value: boolean(registers[nativeName], `Mesen register ${nativeName}`) ? "1" : "0",
    bits: 1,
    group: "Flags",
});
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
/** Clean-room translator from the bounded MesenCE debug-server contract to `DebugBackend`. */
export class MesenDebugBackend {
    protocolVersion = DEBUG_BACKEND_PROTOCOL_VERSION;
    capabilities = MESEN_CAPABILITIES;
    #createClient;
    #terminate;
    #pollIntervalMs;
    #listeners = new Set();
    #expectedClose = new WeakSet();
    #breakpoints = new Map();
    #cpuDecoder = new Cpu65816Decoder();
    #spcDecoder = new Spc700Decoder();
    #superFxDecoder = new SuperFxDecoder();
    #client;
    #closeSubscription;
    #availableProcessors = [];
    #maxMemoryRead = MESEN_NATIVE_MAX_MEMORY_READ;
    #connected = false;
    #stopped = false;
    #executionEpoch = 0;
    #nextBreakpointId = 1;
    /** @param {MesenDebugBackendOptions} options Native client and process lifecycle hooks. */
    constructor(options) {
        this.#createClient = options.createClient;
        this.#terminate = options.terminate ?? (() => Promise.resolve());
        this.#pollIntervalMs = options.pollIntervalMs ?? 16;
        integer(this.#pollIntervalMs, "Mesen status poll interval", 60_000);
        if (this.#pollIntervalMs < 1) {
            throw new Error("Mesen status poll interval must be positive.");
        }
    }
    /** @inheritdoc */
    async connect(options = {}) {
        if (this.#connected) {
            throw new Error("Mesen backend is already connected.");
        }
        if (this.#client) {
            await this.#releaseClient(this.#client);
        }
        const client = await this.#createClient({ reset: options.reset ?? true });
        if (client.closed) {
            throw new Error("Mesen client factory returned a closed client.");
        }
        this.#client = client;
        this.#closeSubscription = client.onClose((error) => this.#clientClosed(client, error));
        try {
            const hello = parseHello(await client.request("hello"));
            this.#availableProcessors = hello.processors;
            this.#maxMemoryRead = hello.maxMemoryRead;
            let stopped = hello.stopped;
            if (options.reset ?? true) {
                stopped = (await this.#statusRequest("reset", "65816")).stopped;
            }
            else if (!stopped) {
                stopped = (await this.#statusRequest("pause", "65816")).stopped;
            }
            if (!stopped) {
                throw new Error("Mesen did not reach a coherent stopped state during connect.");
            }
            this.#connected = true;
            this.#stopped = true;
            this.#emit({ type: "stopped", reason: "entry", threadId: threads["65816"].id });
        }
        catch (error) {
            this.#expectedClose.add(client);
            await this.#releaseClient(client);
            throw error;
        }
    }
    /** @inheritdoc */
    async disconnect(options = {}) {
        const client = this.#requireConnected();
        const terminate = options.terminate ?? true;
        this.#executionEpoch++;
        this.#expectedClose.add(client);
        let failure;
        if (terminate) {
            try {
                await client.request("shutdown");
            }
            catch (error) {
                failure = asError(error);
            }
        }
        await this.#releaseClient(client).catch((error) => {
            failure ??= asError(error);
        });
        this.#breakpoints.clear();
        this.#availableProcessors = [];
        this.#stopped = false;
        if (terminate) {
            await this.#terminate().catch((error) => {
                failure ??= asError(error);
            });
            this.#emit({ type: "terminated", restart: false });
        }
        if (failure) {
            throw failure;
        }
    }
    /** @inheritdoc */
    async pause(threadId) {
        const descriptor = this.#thread(threadId ?? threads["65816"].id);
        if (this.#stopped) {
            return;
        }
        this.#executionEpoch++;
        const status = await this.#statusRequest("pause", descriptor.processor);
        if (!status.stopped) {
            throw new Error("Mesen pause completed without a stopped state.");
        }
        this.#stopped = true;
        this.#emit({ type: "stopped", reason: "pause", threadId: descriptor.id });
    }
    /** @inheritdoc */
    async continue(threadId) {
        const descriptor = this.#thread(threadId ?? threads["65816"].id);
        this.#requireStopped();
        this.#stopped = false;
        const epoch = ++this.#executionEpoch;
        this.#emit({ type: "continued", threadId: descriptor.id, allThreads: true });
        parseResume(await this.#requireClient().request("resume", { cpu: descriptor.processor }), descriptor.processor);
        // Resume is asynchronous in MesenCE. Its acknowledgement can still observe
        // the pre-resume stop, so only a subsequent status poll may establish the
        // next coherent stopped state.
        void this.#pollForStop(descriptor, epoch);
    }
    /** @inheritdoc */
    async step(threadId, kind) {
        const descriptor = this.#thread(threadId);
        if (kind !== "instruction" && kind !== "in") {
            throw new Error(`Mesen does not support ${kind} stepping for ${descriptor.name}.`);
        }
        this.#requireStopped();
        this.#stopped = false;
        const epoch = ++this.#executionEpoch;
        this.#emit({ type: "continued", threadId: descriptor.id, allThreads: true });
        const status = await this.#statusRequest("step", descriptor.processor);
        if (!status.stopped) {
            throw new Error("Mesen instruction step completed without stopping.");
        }
        if (epoch !== this.#executionEpoch) {
            return;
        }
        this.#stopped = true;
        this.#emit({ type: "stopped", reason: "step", threadId: descriptor.id });
    }
    /** @inheritdoc */
    threads() {
        this.#requireConnected();
        return Promise.resolve(this.#availableProcessors.map((cpu) => {
            const descriptor = threads[cpu];
            return { id: descriptor.id, name: descriptor.name, architecture: descriptor.architecture };
        }));
    }
    /** @inheritdoc */
    async stackFrames(threadId) {
        const descriptor = this.#thread(threadId);
        const status = await this.#readStatus(descriptor.processor);
        return [
            {
                id: descriptor.frameId,
                threadId: descriptor.id,
                name: descriptor.name,
                pc: this.#executionAddress(descriptor.processor, status.programCounter),
                currentOnly: true,
            },
        ];
    }
    /** @inheritdoc */
    async registers(frameId) {
        const descriptor = this.#frame(frameId);
        const status = await this.#readStatus(descriptor.processor);
        const values = status.registers;
        if (descriptor.processor === "65816") {
            return [
                debugRegister(values, "A", 16),
                debugRegister(values, "X", 16),
                debugRegister(values, "Y", 16),
                debugRegister(values, "SP", 16, "S"),
                debugRegister(values, "D", 16),
                {
                    name: "PC",
                    value: registerHex(status.programCounter, 24),
                    bits: 24,
                    group: "CPU",
                },
                debugRegister(values, "K", 8, "PB"),
                debugRegister(values, "DBR", 8, "DB"),
                debugRegister(values, "PS", 8, "P"),
                {
                    name: "E",
                    value: boolean(values.emulationMode, "Mesen register emulationMode") ? "1" : "0",
                    bits: 1,
                    group: "CPU",
                },
                debugRegister(values, "cycleCount", 64, "Cycle"),
            ];
        }
        if (descriptor.processor === "spc700") {
            return [
                debugRegister(values, "A", 8),
                debugRegister(values, "X", 8),
                debugRegister(values, "Y", 8),
                debugRegister(values, "SP", 8),
                {
                    name: "PC",
                    value: registerHex(status.programCounter, 16),
                    bits: 16,
                    group: "CPU",
                },
                debugRegister(values, "PS", 8, "P"),
                debugRegister(values, "cycle", 64, "Cycle"),
            ];
        }
        const registerArray = values.R;
        if (!Array.isArray(registerArray) || registerArray.length !== 16) {
            throw new Error("Mesen Super FX register array must contain 16 entries.");
        }
        const sfr = record(values.SFR, "Mesen Super FX status register");
        const generalRegisters = registerArray.map((value, index) => ({
            name: `R${index}`,
            value: registerHex(integer(value, `Mesen register R${index}`, 0xffff), 16),
            bits: 16,
            group: "CPU",
        }));
        return [
            ...generalRegisters,
            {
                name: "PC",
                value: registerHex(status.programCounter, 24),
                bits: 24,
                group: "CPU",
            },
            debugRegister(values, "programBank", 8, "PB"),
            debugRegister(values, "romBank", 8, "ROMB"),
            debugRegister(values, "ramBank", 8, "RAMB"),
            debugRegister(values, "sourceRegister", 4, "SREG"),
            debugRegister(values, "destinationRegister", 4, "DREG"),
            debugRegister(values, "programReadBuffer", 8, "Pipeline"),
            debugFlag(sfr, "zero", "Z"),
            debugFlag(sfr, "carry", "C"),
            debugFlag(sfr, "sign", "S"),
            debugFlag(sfr, "overflow", "V"),
            debugFlag(sfr, "running", "RUN"),
            debugFlag(sfr, "alt1", "ALT1"),
            debugFlag(sfr, "alt2", "ALT2"),
            debugFlag(sfr, "irq", "IRQ"),
            debugRegister(values, "cycleCount", 64, "Cycle"),
        ];
    }
    /** @inheritdoc */
    async readMemory(address, count) {
        const descriptor = this.#checkedMemoryAddress(address, false);
        integer(count, "Mesen memory count", 1_048_576);
        if (count === 0) {
            return { address: { ...address }, bytes: new Uint8Array(), unreadableBytes: 0 };
        }
        const bytes = await this.#readNativeMemory(descriptor, address.address, count);
        return { address: { ...address }, bytes, unreadableBytes: count - bytes.length };
    }
    /** @inheritdoc */
    async setBreakpoints(addresses) {
        this.#requireStopped();
        if (addresses.length > 256) {
            throw new Error("Mesen accepts at most 256 execute breakpoints.");
        }
        const checked = addresses.map((address, index) => {
            if (address.architecture !== MESEN_65816_ARCHITECTURE ||
                address.addressSpace !== MESEN_65816_ADDRESS_SPACE) {
                throw new Error(`Mesen breakpoint ${index} is not a 65816 execution address.`);
            }
            integer(address.address, `Mesen breakpoint ${index} address`, 0xff_ffff);
            return { ...address };
        });
        if (new Set(checked.map(({ address }) => address)).size !== checked.length) {
            throw new Error("Duplicate Mesen execute breakpoint addresses are not allowed.");
        }
        const result = record(await this.#requireConnected().request("setBreakpoints", {
            cpu: "65816",
            addresses: checked.map(({ address }) => address),
        }), "Mesen breakpoint response");
        const count = integer(result.count, "Mesen breakpoint response count", 256);
        if (count !== checked.length) {
            throw new Error("Mesen did not install the complete breakpoint set.");
        }
        const next = new Map();
        const breakpoints = checked.map((address) => {
            const breakpoint = this.#breakpoints.get(address.address) ??
                Object.freeze({ id: this.#nextBreakpointId++, address, verified: true });
            next.set(address.address, breakpoint);
            return breakpoint;
        });
        this.#breakpoints.clear();
        for (const [address, breakpoint] of next) {
            this.#breakpoints.set(address, breakpoint);
        }
        return breakpoints;
    }
    /** @inheritdoc */
    async disassemble(address, count) {
        integer(count, "Mesen disassembly count", 4_096);
        const descriptor = this.#executionDescriptor(address);
        const status = await this.#readStatus(descriptor.processor);
        let current = address.address;
        let superFxState = descriptor.processor === "superfx" ? this.#superFxState(status) : undefined;
        const instructions = [];
        for (let index = 0; index < count; index++) {
            const memory = await this.#readNativeMemory(descriptor, current, 4);
            const source = new Uint8ArrayDecoderSource(memory);
            const decoded = (() => {
                if (descriptor.processor === "65816") {
                    return this.#cpuDecoder.decode({
                        source,
                        offset: 0,
                        logicalAddress: current,
                        state: this.#cpuDecodeState(status),
                    });
                }
                if (descriptor.processor === "spc700") {
                    return this.#spcDecoder.decode({
                        source,
                        offset: 0,
                        logicalAddress: current,
                        state: this.#spcDecodeState(status),
                    });
                }
                return this.#superFxDecoder.decode({
                    source,
                    offset: 0,
                    logicalAddress: current,
                    state: superFxDecodeState(superFxState),
                });
            })();
            if (decoded.kind !== "instruction") {
                throw new Error(decoded.kind === "ambiguous" ? decoded.reason : `Mesen decode failed: ${decoded.message}`);
            }
            const text = (() => {
                if (descriptor.processor === "65816") {
                    return formatCpu65816Instruction(decoded.instruction);
                }
                if (descriptor.processor === "spc700") {
                    return formatSpc700Instruction(decoded.instruction);
                }
                return formatSuperFxInstruction(decoded.instruction);
            })();
            instructions.push({
                address: this.#executionAddress(descriptor.processor, current),
                bytes: [...decoded.instruction.bytes],
                text,
            });
            if (superFxState) {
                superFxState = transferSuperFxState(decoded.instruction, superFxState);
            }
            current = (current + decoded.instruction.size) & maximumPc(descriptor.processor);
        }
        return instructions;
    }
    /** @inheritdoc */
    startTrace(_options) {
        return Promise.reject(new Error("Mesen instruction tracing is not implemented."));
    }
    /** @inheritdoc */
    readTrace(_maxEvents) {
        return Promise.reject(new Error("Mesen instruction tracing is not implemented."));
    }
    /** @inheritdoc */
    stopTrace() {
        return Promise.reject(new Error("Mesen instruction tracing is not implemented."));
    }
    /** @inheritdoc */
    onEvent(listener) {
        this.#listeners.add(listener);
        return { dispose: () => this.#listeners.delete(listener) };
    }
    async #pollForStop(descriptor, epoch) {
        try {
            while (this.#connected && !this.#stopped && epoch === this.#executionEpoch) {
                await delay(this.#pollIntervalMs);
                if (!this.#connected || this.#stopped || epoch !== this.#executionEpoch) {
                    return;
                }
                const status = await this.#readStatus(descriptor.processor, false);
                if (status.stopped) {
                    this.#acceptRunningStop(status, descriptor, epoch);
                    return;
                }
            }
        }
        catch (error) {
            if (epoch !== this.#executionEpoch || !this.#connected) {
                return;
            }
            const failure = asError(error);
            this.#emit({ type: "output", category: "stderr", text: `${failure.message}\n` });
            this.#emit({ type: "terminated", restart: true });
            const client = this.#client;
            if (client) {
                this.#expectedClose.add(client);
                await this.#releaseClient(client).catch(() => undefined);
            }
        }
    }
    #acceptRunningStop(status, descriptor, epoch) {
        if (epoch !== this.#executionEpoch || this.#stopped) {
            return;
        }
        this.#stopped = true;
        const reason = descriptor.processor === "65816" && this.#breakpoints.has(status.programCounter)
            ? "breakpoint"
            : "exception";
        this.#emit({ type: "stopped", reason, threadId: descriptor.id });
    }
    async #readStatus(cpu, requireStopped = true) {
        if (requireStopped) {
            this.#requireStopped();
        }
        return this.#statusRequest("status", cpu);
    }
    async #statusRequest(method, cpu) {
        return parseStatus(await this.#requireClient().request(method, { cpu }), cpu);
    }
    #cpuDecodeState(status) {
        const registers = status.registers;
        const flags = registerInteger(registers, "PS", 8);
        return {
            e: boolean(registers.emulationMode, "Mesen register emulationMode") ? 1 : 0,
            m: (flags >>> 5) & 1 ? 1 : 0,
            x: (flags >>> 4) & 1 ? 1 : 0,
            programBank: status.programCounter >>> 16,
            dataBank: registerInteger(registers, "DBR", 8),
            directPage: registerInteger(registers, "D", 16),
        };
    }
    #spcDecodeState(status) {
        const flags = registerInteger(status.registers, "PS", 8);
        return { directPage: flags & 0x20 ? 0x0100 : 0 };
    }
    #superFxState(status) {
        const registers = status.registers;
        const sfr = record(registers.SFR, "Mesen Super FX status register");
        const alt = ((boolean(sfr.alt1, "Mesen register alt1") ? 1 : 0) |
            (boolean(sfr.alt2, "Mesen register alt2") ? 2 : 0));
        return {
            alt: { kind: "known", value: alt },
            destinationRegister: {
                kind: "known",
                value: registerInteger(registers, "destinationRegister", 4),
            },
            sourceRegister: {
                kind: "known",
                value: registerInteger(registers, "sourceRegister", 4),
            },
            programBank: {
                kind: "known",
                value: registerInteger(registers, "programBank", 8),
            },
        };
    }
    #executionDescriptor(address) {
        const descriptor = memorySpaces[address.addressSpace];
        if (!descriptor || threads[descriptor.processor].architecture !== address.architecture) {
            throw new Error(`Mesen execution address '${address.architecture}/${address.addressSpace}' is unsupported.`);
        }
        let expectedSpace = MESEN_SUPERFX_ROM_ADDRESS_SPACE;
        if (descriptor.processor === "65816") {
            expectedSpace = MESEN_65816_ADDRESS_SPACE;
        }
        else if (descriptor.processor === "spc700") {
            expectedSpace = MESEN_SPC700_ADDRESS_SPACE;
        }
        if (address.addressSpace !== expectedSpace) {
            throw new Error(`Mesen address space '${address.addressSpace}' is not executable.`);
        }
        integer(address.address, "Mesen execution address", descriptor.maximumAddress);
        this.#requireProcessor(descriptor.processor);
        return descriptor;
    }
    #checkedMemoryAddress(address, allowExecutionBus) {
        const descriptor = memorySpaces[address.addressSpace];
        if (!descriptor || threads[descriptor.processor].architecture !== address.architecture) {
            throw new Error(`Mesen memory address '${address.architecture}/${address.addressSpace}' is unsupported.`);
        }
        if (!allowExecutionBus && address.addressSpace === MESEN_65816_ADDRESS_SPACE) {
            throw new Error("Mesen logical CPU-bus memory is reserved for disassembly.");
        }
        integer(address.address, "Mesen memory address", descriptor.maximumAddress);
        this.#requireProcessor(descriptor.processor);
        return descriptor;
    }
    async #readNativeMemory(descriptor, address, count) {
        this.#requireStopped();
        const bytes = new Uint8Array(count);
        let offset = 0;
        while (offset < count) {
            const requested = Math.min(this.#maxMemoryRead, count - offset);
            const response = record(await this.#requireConnected().request("readMemory", {
                space: descriptor.native,
                address: address + offset,
                length: requested,
            }), "Mesen memory response");
            if (string(response.space, "Mesen memory response space") !== descriptor.native) {
                throw new Error("Mesen memory response used the wrong address space.");
            }
            if (integer(response.address, "Mesen memory response address") !== address + offset) {
                throw new Error("Mesen memory response used the wrong address.");
            }
            const encoded = string(response.data, "Mesen memory response data");
            const chunk = Buffer.from(encoded, "base64");
            if (chunk.toString("base64") !== encoded || chunk.length !== requested) {
                throw new Error("Mesen memory response is not canonical base64 of the requested length.");
            }
            bytes.set(chunk, offset);
            offset += chunk.length;
        }
        return bytes;
    }
    #executionAddress(cpu, address) {
        const architecture = threads[cpu].architecture;
        let addressSpace = MESEN_SUPERFX_ROM_ADDRESS_SPACE;
        if (cpu === "65816") {
            addressSpace = MESEN_65816_ADDRESS_SPACE;
        }
        else if (cpu === "spc700") {
            addressSpace = MESEN_SPC700_ADDRESS_SPACE;
        }
        return { architecture, addressSpace, address };
    }
    #thread(id) {
        integer(id, "Mesen thread id");
        const descriptor = Object.values(threads).find((candidate) => candidate.id === id);
        if (!descriptor || !this.#availableProcessors.includes(descriptor.processor)) {
            throw new Error(`Unknown Mesen thread ${id}.`);
        }
        return descriptor;
    }
    #frame(id) {
        integer(id, "Mesen frame id");
        const descriptor = Object.values(threads).find((candidate) => candidate.frameId === id);
        if (!descriptor || !this.#availableProcessors.includes(descriptor.processor)) {
            throw new Error(`Unknown Mesen frame ${id}.`);
        }
        return descriptor;
    }
    #requireProcessor(cpu) {
        if (!this.#availableProcessors.includes(cpu)) {
            throw new Error(`Mesen processor '${cpu}' is not available for this cartridge.`);
        }
    }
    #requireClient() {
        if (!this.#client || this.#client.closed) {
            throw new Error("Mesen client is not available.");
        }
        return this.#client;
    }
    #requireConnected() {
        if (!this.#connected) {
            throw new Error("Mesen backend is not connected.");
        }
        return this.#requireClient();
    }
    #requireStopped() {
        const client = this.#requireConnected();
        if (!this.#stopped) {
            throw new Error("Mesen backend must be stopped for this operation.");
        }
        return client;
    }
    #clientClosed(client, error) {
        if (this.#expectedClose.has(client) || this.#client !== client) {
            return;
        }
        this.#executionEpoch++;
        this.#closeSubscription?.dispose();
        this.#closeSubscription = undefined;
        this.#client = undefined;
        this.#connected = false;
        this.#stopped = false;
        this.#emit({
            type: "output",
            category: "stderr",
            text: `${error?.message ?? "Mesen debug connection closed."}\n`,
        });
        this.#emit({ type: "terminated", restart: true });
    }
    async #releaseClient(client) {
        if (this.#client !== client) {
            return;
        }
        this.#executionEpoch++;
        this.#closeSubscription?.dispose();
        this.#closeSubscription = undefined;
        this.#client = undefined;
        this.#connected = false;
        await client.close();
    }
    #emit(event) {
        for (const listener of this.#listeners) {
            listener(event);
        }
    }
}
//# sourceMappingURL=mesen-backend.js.map
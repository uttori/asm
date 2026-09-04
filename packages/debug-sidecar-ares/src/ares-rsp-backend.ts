import {
  DEBUG_BACKEND_PROTOCOL_VERSION,
  type DebugAddress,
  type DebugBackend,
  type DebugBackendConnectOptions,
  type DebugBackendEvent,
  type DebugBreakpoint,
  type DebugInstruction,
  type DebugMemoryRead,
  type DebugRegister,
  type DebugStackFrame,
  type DebugStepKind,
  type DebugSubscription,
  type DebugThread,
  type DebugTraceBatch,
  type DebugTraceStartOptions,
} from "@uttori/asm-debug-adapter";
import { Uint8ArrayDecoderSource } from "@uttori/asm-core";
import {
  Cpu65816Decoder,
  formatCpu65816Instruction,
  type Cpu65816DecodeState,
} from "@uttori/asm-plugin-snes";

import type { GdbRspClient, GdbRspStop } from "./gdb-rsp-client.js";
import {
  ARES_65816_ADDRESS_SPACE,
  ARES_65816_ARCHITECTURE,
  ARES_65816_CARTRIDGE_ROM_ADDRESS_SPACE,
  ARES_65816_FRAME_ID,
  ARES_65816_THREAD_ID,
  ARES_65816_WRAM_ADDRESS_SPACE,
  ARES_RSP_CAPABILITIES,
  ARES_TRACE_BATCH_EVENTS,
} from "./profile.js";

export * from "./profile.js";

const ARES_NAMED_MEMORY_READ_CHUNK_BYTES = 0x1000;

/** RSP operations consumed by the ares backend, abstracted for deterministic tests. */
export interface AresGdbRspClient {
  readonly closed: boolean;
  start(): Promise<void>;
  request(command: string): Promise<string>;
  requestStop(command: string): Promise<string>;
  continue(): Promise<void>;
  step(): Promise<void>;
  interrupt(): Promise<void>;
  close(): Promise<void>;
  onStop(listener: (event: GdbRspStop) => void): DebugSubscription;
  onClose(listener: (error: Error) => void): DebugSubscription;
}

/** Process/session hooks supplied by the sidecar executable. */
export interface AresRspBackendOptions {
  readonly createClient: (
    options: DebugBackendConnectOptions,
  ) => AresGdbRspClient | GdbRspClient | Promise<AresGdbRspClient | GdbRspClient>;
  readonly terminate?: () => Promise<void>;
  readonly stopTimeoutMs?: number;
}

interface RegisterSnapshot {
  readonly a: number;
  readonly x: number;
  readonly y: number;
  readonly s: number;
  readonly d: number;
  readonly db: number;
  readonly pb: number;
  readonly pc: number;
  readonly p: number;
  readonly e: number;
}

const asError = (error: unknown): Error =>
  error instanceof Error ? error : new Error(String(error));

const checkedInteger = (
  value: number,
  context: string,
  maximum = Number.MAX_SAFE_INTEGER,
): number => {
  if (!Number.isSafeInteger(value) || value < 0 || value > maximum)
    throw new Error(`${context} must be an integer between 0 and ${maximum}.`);
  return value;
};

const checkedAddress = (value: DebugAddress, context: string): DebugAddress => {
  if (value.architecture !== ARES_65816_ARCHITECTURE)
    throw new Error(`${context} uses unsupported architecture '${value.architecture}'.`);
  if (value.addressSpace !== ARES_65816_ADDRESS_SPACE)
    throw new Error(`${context} uses unsupported address space '${value.addressSpace}'.`);
  checkedInteger(value.address, `${context} address`, 0xff_ffff);
  return { ...value, address: value.address & 0xff_ffff };
};

const checkedMemoryAddress = (value: DebugAddress, context: string): DebugAddress => {
  if (value.architecture !== ARES_65816_ARCHITECTURE)
    throw new Error(`${context} uses unsupported architecture '${value.architecture}'.`);
  if (
    value.addressSpace !== ARES_65816_WRAM_ADDRESS_SPACE &&
    value.addressSpace !== ARES_65816_CARTRIDGE_ROM_ADDRESS_SPACE
  )
    throw new Error(`${context} uses unsupported memory address space '${value.addressSpace}'.`);
  checkedInteger(value.address, `${context} address`, 0xff_ffff);
  return { ...value };
};

const isEvenHex = (value: string): boolean => {
  if (value.length % 2 !== 0) return false;
  for (const character of value) {
    const code = character.codePointAt(0) ?? -1;
    if (
      !(
        (code >= 0x30 && code <= 0x39) ||
        (code >= 0x41 && code <= 0x46) ||
        (code >= 0x61 && code <= 0x66)
      )
    )
      return false;
  }
  return true;
};

const littleEndian = (hex: string): number => {
  const bytes = hex.match(/../g);
  if (!bytes || bytes.join("") !== hex) throw new Error("Malformed little-endian register data.");
  return Number.parseInt([...bytes].reverse().join(""), 16);
};

const registerHex = (value: number, bits: number): string =>
  value
    .toString(16)
    .toUpperCase()
    .padStart(Math.ceil(bits / 4), "0");

const parseRegisters = (payload: string): RegisterSnapshot => {
  if (!/^[\dA-Fa-f]{32}$/.test(payload))
    throw new Error(`Expected 16 bytes of ares 65816 registers, received ${payload.length / 2}.`);
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

const logicalPc = (registers: RegisterSnapshot): number =>
  ((registers.pb << 16) | registers.pc) & 0xff_ffff;

const stopSignal = (payload: string): number => {
  if (!/^[ST][\dA-Fa-f]{2}/.test(payload))
    throw new Error(`Expected an RSP stop packet, received '${payload}'.`);
  return Number.parseInt(payload.slice(1, 3), 16);
};

const expectOkay = (payload: string, context: string): void => {
  if (payload !== "OK") throw new Error(`${context} failed with RSP response '${payload}'.`);
};

const safeHexInteger = (value: string, context: string): number => {
  if (!/^[\dA-Fa-f]+$/.test(value)) throw new Error(`${context} is not hexadecimal.`);
  const parsed = Number(BigInt(`0x${value}`));
  if (!Number.isSafeInteger(parsed))
    throw new Error(`${context} exceeds JavaScript safe integer range.`);
  return parsed;
};

/** 65816 `DebugBackend` implemented over the maintained ares fork's private RSP channel. */
export class AresRspDebugBackend implements DebugBackend {
  readonly protocolVersion = DEBUG_BACKEND_PROTOCOL_VERSION;
  readonly capabilities = ARES_RSP_CAPABILITIES;

  readonly #createClient: AresRspBackendOptions["createClient"];
  readonly #terminate: () => Promise<void>;
  readonly #stopTimeoutMs: number;
  readonly #listeners = new Set<(event: DebugBackendEvent) => void>();
  readonly #expectedClose = new WeakSet<AresGdbRspClient>();
  readonly #breakpoints = new Map<number, DebugBreakpoint>();
  readonly #decoder = new Cpu65816Decoder();
  #client: AresGdbRspClient | undefined;
  #subscriptions: DebugSubscription[] = [];
  #connected = false;
  #stopped = false;
  #pendingStopReason: "pause" | "step" | "breakpoint" | "exception" | undefined;
  #instructionBoundaryStop = false;
  #nextBreakpointId = 1;
  #trace:
    | { readonly architecture: string; readonly addressSpace: string; active: boolean }
    | undefined;

  /** @param {AresRspBackendOptions} options RSP client/process lifecycle hooks. */
  constructor(options: AresRspBackendOptions) {
    this.#createClient = options.createClient;
    this.#terminate = options.terminate ?? (() => Promise.resolve());
    this.#stopTimeoutMs = options.stopTimeoutMs ?? 5_000;
    checkedInteger(this.#stopTimeoutMs, "Ares stop timeout");
    if (this.#stopTimeoutMs === 0) throw new Error("Ares stop timeout must be positive.");
  }

  /** @inheritdoc */
  async connect(options: DebugBackendConnectOptions = {}): Promise<void> {
    if (this.#connected) throw new Error("ares RSP backend is already connected.");
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
    const client = await this.#createClient({ reset: options.reset ?? true });
    if (client.closed) throw new Error("ares RSP client factory returned a closed client.");
    this.#client = client;
    this.#subscriptions = [
      client.onStop((event) => this.#stoppedEvent(event)),
      client.onClose((error) => this.#clientClosed(client, error)),
    ];
    try {
      await client.start();
      const supported = await client.request("qSupported");
      if (
        !supported.includes("qXfer:features:read+") ||
        !supported.includes("xmlRegisters+") ||
        !supported.includes("uttoriNamedMemory+") ||
        !supported.includes("uttoriInstructionTrace+")
      )
        throw new Error("ares RSP server does not advertise the required debugger extensions.");
      const target = await this.#readTargetDescription(client);
      for (const register of ["a", "x", "y", "s", "d", "db", "pb", "pc", "p", "e"]) {
        if (!target.includes(`name="${register}"`))
          throw new Error(`ares RSP target description is missing register '${register}'.`);
      }
      this.#instructionBoundaryStop = supported.includes("uttoriInstructionBoundaryStop+");
      await this.#handshakeStop(client, this.#instructionBoundaryStop);
      this.#connected = true;
      this.#stopped = true;
      this.#emit({ type: "stopped", reason: "entry", threadId: ARES_65816_THREAD_ID });
    } catch (error) {
      this.#expectedClose.add(client);
      await client.close().catch(() => undefined);
      this.#releaseClient(client);
      throw error;
    }
  }

  /** @inheritdoc */
  async disconnect(options: { readonly terminate?: boolean } = {}): Promise<void> {
    const client = this.#requireConnected();
    const terminate = options.terminate ?? true;
    if (this.#trace?.active) await this.stopTrace();
    if (!terminate) {
      await this.setBreakpoints([]);
      this.#connected = false;
      this.#pendingStopReason = undefined;
      return;
    }
    this.#expectedClose.add(client);
    let detachError: Error | undefined;
    try {
      expectOkay(await client.request("D"), "ares RSP detach");
    } catch (error) {
      detachError = asError(error);
    }
    await client.close().catch((error: unknown) => {
      detachError ??= asError(error);
    });
    this.#releaseClient(client);
    this.#breakpoints.clear();
    this.#stopped = false;
    this.#pendingStopReason = undefined;
    this.#trace = undefined;
    await this.#terminate();
    this.#emit({ type: "terminated", restart: false });
    if (detachError) throw detachError;
  }

  /** @inheritdoc */
  async pause(threadId?: number): Promise<void> {
    this.#assertThread(threadId);
    if (this.#stopped) return;
    this.#pendingStopReason = "pause";
    await this.#requireConnected().interrupt();
  }

  /** @inheritdoc */
  async continue(threadId?: number): Promise<void> {
    this.#assertThread(threadId);
    const client = this.#requireStopped();
    this.#stopped = false;
    this.#pendingStopReason = this.#breakpoints.size > 0 ? "breakpoint" : "exception";
    this.#emit({ type: "continued", threadId: ARES_65816_THREAD_ID, allThreads: true });
    await client.continue();
  }

  /** @inheritdoc */
  async step(threadId: number, _kind: DebugStepKind): Promise<void> {
    this.#assertThread(threadId);
    const client = this.#requireStopped();
    this.#stopped = false;
    this.#pendingStopReason = "step";
    this.#emit({ type: "continued", threadId: ARES_65816_THREAD_ID, allThreads: true });
    await this.#waitForStop(client, "instruction step", () => client.step());
  }

  /** @inheritdoc */
  threads(): Promise<readonly DebugThread[]> {
    this.#requireConnected();
    return Promise.resolve([
      { id: ARES_65816_THREAD_ID, name: "Main CPU", architecture: ARES_65816_ARCHITECTURE },
    ]);
  }

  /** @inheritdoc */
  async stackFrames(threadId: number): Promise<readonly DebugStackFrame[]> {
    this.#assertThread(threadId);
    const registers = await this.#registerSnapshot();
    return [
      {
        id: ARES_65816_FRAME_ID,
        threadId: ARES_65816_THREAD_ID,
        name: "65816",
        pc: this.#address(logicalPc(registers)),
      },
    ];
  }

  /** @inheritdoc */
  async registers(frameId: number): Promise<readonly DebugRegister[]> {
    if (frameId !== ARES_65816_FRAME_ID) throw new Error(`Unknown ares frame ${frameId}.`);
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
  async readMemory(address: DebugAddress, count: number): Promise<DebugMemoryRead> {
    const checked = checkedMemoryAddress(address, "Memory request");
    checkedInteger(count, "Memory count", 1_048_576);
    if (count === 0) return { address: checked, bytes: new Uint8Array(), unreadableBytes: 0 };
    const bytes = new Uint8Array(count);
    let offset = 0;
    const client = this.#requireStopped();
    while (offset < count) {
      const requested = Math.min(ARES_NAMED_MEMORY_READ_CHUNK_BYTES, count - offset);
      const response = await client.request(
        `qUttoriMemoryRead:${checked.addressSpace}:${(checked.address + offset).toString(16)},${requested.toString(16)}`,
      );
      if (response.startsWith("E"))
        throw new Error(`ares RSP named memory read failed with response '${response}'.`);
      if (!isEvenHex(response) || response.length > requested * 2)
        throw new Error(
          "ares RSP named memory response is malformed or exceeds the requested count.",
        );
      const available = Buffer.from(response, "hex");
      bytes.set(available, offset);
      offset += available.length;
      if (available.length < requested) break;
    }
    return { address: checked, bytes, unreadableBytes: count - offset };
  }

  /** @inheritdoc */
  async setBreakpoints(addresses: readonly DebugAddress[]): Promise<readonly DebugBreakpoint[]> {
    const client = this.#requireStopped();
    const requested = addresses.map((entry, index) => checkedAddress(entry, `Breakpoint ${index}`));
    if (new Set(requested.map(({ address }) => address)).size !== requested.length)
      throw new Error("Duplicate ares execute breakpoint addresses are not allowed.");

    const wanted = new Set(requested.map(({ address }) => address));
    for (const address of this.#breakpoints.keys()) {
      if (wanted.has(address)) continue;
      expectOkay(await client.request(`z0,${address.toString(16)},1`), "Remove breakpoint");
      this.#breakpoints.delete(address);
    }

    const results: DebugBreakpoint[] = [];
    for (const value of requested) {
      const existing = this.#breakpoints.get(value.address);
      if (existing) {
        results.push(existing);
        continue;
      }
      const response = await client.request(`Z0,${value.address.toString(16)},1`);
      const breakpoint: DebugBreakpoint = {
        id: this.#nextBreakpointId++,
        address: value,
        verified: response === "OK",
        ...(response === "OK" ? {} : { message: `ares RSP response '${response}'.` }),
      };
      if (breakpoint.verified) this.#breakpoints.set(value.address, breakpoint);
      results.push(breakpoint);
    }
    return results;
  }

  /** @inheritdoc */
  async disassemble(address: DebugAddress, count: number): Promise<readonly DebugInstruction[]> {
    let current = checkedAddress(address, "Disassembly request").address;
    checkedInteger(count, "Disassembly count", 4_096);
    const registers = await this.#registerSnapshot();
    const state: Cpu65816DecodeState = {
      e: registers.e === 0 ? 0 : 1,
      m: (registers.p >>> 5) & 1 ? 1 : 0,
      x: (registers.p >>> 4) & 1 ? 1 : 0,
      programBank: current >>> 16,
      dataBank: registers.db,
      directPage: registers.d,
    };
    const instructions: DebugInstruction[] = [];
    for (let index = 0; index < count; index++) {
      const memory = await this.#readCpuBus(current, 4);
      if (!memory) break;
      const decoded = this.#decoder.decode({
        source: new Uint8ArrayDecoderSource(memory),
        offset: 0,
        logicalAddress: current,
        state: { ...state, programBank: current >>> 16 },
      });
      if (decoded.kind !== "instruction")
        throw new Error(
          decoded.kind === "ambiguous" ? decoded.reason : `65816 decode failed: ${decoded.message}`,
        );
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
  async startTrace(options: DebugTraceStartOptions): Promise<void> {
    if (
      options.architecture !== ARES_65816_ARCHITECTURE ||
      options.addressSpace !== ARES_65816_ADDRESS_SPACE
    )
      throw new Error(
        `Instruction trace '${options.architecture}/${options.addressSpace}' is not supported.`,
      );
    const client = this.#requireStopped();
    expectOkay(await client.request("QUttoriTrace:1"), "Start instruction trace");
    this.#trace = { ...options, active: true };
  }

  /** @inheritdoc */
  async readTrace(maxEvents: number): Promise<DebugTraceBatch> {
    checkedInteger(maxEvents, "Trace batch size", ARES_TRACE_BATCH_EVENTS);
    if (maxEvents === 0)
      throw new Error(`Trace batch size must be between 1 and ${ARES_TRACE_BATCH_EVENTS}.`);
    const trace = this.#trace;
    if (!trace) throw new Error("No ares instruction trace has been started.");
    const response = await this.#requireConnected().request(
      `qUttoriTraceRead:${maxEvents.toString(16)}`,
    );
    const match = /^([01]):([\dA-Fa-f]+):([\dA-Fa-f]+):([\dA-Fa-f]*)$/.exec(response);
    if (!match || match[4].length % 16 !== 0)
      throw new Error("ares RSP instruction trace response is malformed.");
    const addresses = Array.from({ length: match[4].length / 16 }, (_, index) =>
      safeHexInteger(match[4].slice(index * 16, index * 16 + 16), "Trace address"),
    );
    if (addresses.length > maxEvents || addresses.some((address) => address > 0xff_ffff))
      throw new Error("ares RSP instruction trace response exceeds the requested bounds.");
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
  async stopTrace(): Promise<void> {
    const trace = this.#trace;
    if (!trace) throw new Error("No ares instruction trace has been started.");
    expectOkay(await this.#requireConnected().request("QUttoriTrace:0"), "Stop instruction trace");
    trace.active = false;
  }

  /** @inheritdoc */
  onEvent(listener: (event: DebugBackendEvent) => void): DebugSubscription {
    this.#listeners.add(listener);
    return { dispose: () => this.#listeners.delete(listener) };
  }

  async #readCpuBus(address: number, count: number): Promise<Uint8Array | undefined> {
    const response = await this.#requireStopped().request(
      `m${address.toString(16)},${count.toString(16)}`,
    );
    if (response.startsWith("E"))
      throw new Error(`ares RSP CPU-bus disassembly read failed with response '${response}'.`);
    if (!isEvenHex(response) || response.length > count * 2)
      throw new Error(
        "ares RSP CPU-bus disassembly response is malformed or exceeds the requested count.",
      );
    const available = Buffer.from(response, "hex");
    if (available.length === 0) return undefined;
    const bytes = new Uint8Array(count);
    bytes.set(available);
    return bytes;
  }

  async #readTargetDescription(client: AresGdbRspClient): Promise<string> {
    let offset = 0;
    let target = "";
    for (let part = 0; part < 16; part++) {
      const response = await client.request(
        `qXfer:features:read:target.xml:${offset.toString(16)},1000`,
      );
      if (!response.startsWith("l") && !response.startsWith("m"))
        throw new Error("ares RSP target description returned an invalid continuation marker.");
      const chunk = response.slice(1);
      target += chunk;
      if (target.length > 65_536) throw new Error("ares RSP target description exceeds 64 KiB.");
      if (response.startsWith("l")) return target;
      offset += Buffer.byteLength(chunk, "ascii");
    }
    throw new Error("ares RSP target description did not terminate within 16 packets.");
  }

  async #handshakeStop(
    client: AresGdbRspClient,
    waitForInstructionBoundary: boolean,
  ): Promise<void> {
    if (!waitForInstructionBoundary) {
      stopSignal(await client.requestStop("?"));
      return;
    }
    await this.#waitForStop(client, "first instruction boundary", async () => {
      stopSignal(await client.requestStop("?"));
    });
  }

  async #waitForStop(
    client: AresGdbRspClient,
    context: string,
    action: () => Promise<void>,
  ): Promise<void> {
    let resolveStop: (() => void) | undefined;
    let rejectStop: ((error: Error) => void) | undefined;
    const stopped = new Promise<void>((resolve, reject) => {
      resolveStop = resolve;
      rejectStop = reject;
    });
    const timeout = setTimeout(
      () => rejectStop?.(new Error(`Timed out waiting for ares ${context} stop.`)),
      this.#stopTimeoutMs,
    );
    timeout.unref();
    const stopSubscription = client.onStop(() => resolveStop?.());
    const closeSubscription = client.onClose((error) => rejectStop?.(error));
    try {
      await action();
      await stopped;
    } finally {
      clearTimeout(timeout);
      stopSubscription.dispose();
      closeSubscription.dispose();
    }
  }

  async #registerSnapshot(): Promise<RegisterSnapshot> {
    return parseRegisters(await this.#requireStopped().request("g"));
  }

  #address(address: number): DebugAddress {
    return {
      architecture: ARES_65816_ARCHITECTURE,
      addressSpace: ARES_65816_ADDRESS_SPACE,
      address,
    };
  }

  #assertThread(threadId: number | undefined): void {
    if (threadId !== undefined && threadId !== ARES_65816_THREAD_ID)
      throw new Error(`Unknown ares thread ${threadId}.`);
  }

  #requireConnected(): AresGdbRspClient {
    if (!this.#connected || !this.#client || this.#client.closed)
      throw new Error("ares RSP backend is not connected.");
    return this.#client;
  }

  #requireStopped(): AresGdbRspClient {
    const client = this.#requireConnected();
    if (!this.#stopped) throw new Error("ares RSP backend must be stopped for this operation.");
    return client;
  }

  #stoppedEvent(event: GdbRspStop): void {
    if (!this.#connected) return;
    stopSignal(event.payload);
    this.#stopped = true;
    const reason = this.#pendingStopReason ?? "exception";
    this.#pendingStopReason = undefined;
    this.#emit({ type: "stopped", reason, threadId: ARES_65816_THREAD_ID });
  }

  #clientClosed(client: AresGdbRspClient, error: Error): void {
    if (this.#expectedClose.has(client) || this.#client !== client) return;
    this.#releaseClient(client);
    this.#emit({ type: "output", category: "stderr", text: `${error.message}\n` });
    this.#emit({ type: "terminated", restart: true });
  }

  #releaseClient(client: AresGdbRspClient): void {
    if (this.#client !== client) return;
    for (const subscription of this.#subscriptions) subscription.dispose();
    this.#subscriptions = [];
    this.#client = undefined;
    this.#connected = false;
    this.#instructionBoundaryStop = false;
    this.#trace = undefined;
  }

  #emit(event: DebugBackendEvent): void {
    for (const listener of this.#listeners) listener(event);
  }
}

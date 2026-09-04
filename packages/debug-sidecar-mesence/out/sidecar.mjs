#!/usr/bin/env node

// packages/debug-sidecar-mesence/src/sidecar.ts
import { readFile } from "node:fs/promises";
import path2 from "node:path";
import { fileURLToPath } from "node:url";

// packages/debug-adapter/src/contracts.ts
var DEBUG_BACKEND_PROTOCOL_VERSION = 1;

// packages/debug-adapter/src/sidecar-protocol.ts
var DEBUG_SIDECAR_PROTOCOL = "uttori-asm-debug-sidecar";
var DEBUG_SIDECAR_PROTOCOL_VERSION = 1;
var DEBUG_SIDECAR_COMMANDS = Object.freeze([
  "initialize",
  "connect",
  "disconnect",
  "pause",
  "continue",
  "step",
  "threads",
  "stackFrames",
  "registers",
  "readMemory",
  "setBreakpoints",
  "disassemble",
  "startTrace",
  "readTrace",
  "stopTrace",
  "ping",
  "shutdown"
]);
var DEBUG_SIDECAR_EVENTS = Object.freeze([
  "stopped",
  "continued",
  "terminated",
  "breakpoint",
  "output"
]);
var DEFAULT_DEBUG_SIDECAR_LIMITS = Object.freeze({
  maxFrameBytes: 1048576,
  maxBufferedBytes: 2097152,
  maxMemoryReadBytes: 1048576,
  maxDisassemblyInstructions: 4096,
  maxBreakpoints: 4096,
  maxTraceBatchEvents: 4096,
  maxQueuedMessages: 1024,
  maxQueuedBytes: 8388608
});
var isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
var positiveInteger = (value) => typeof value === "number" && Number.isSafeInteger(value) && value > 0;
var nonNegativeInteger = (value) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
var assertLimit = (name, value) => {
  if (!positiveInteger(value)) throw new Error(`${name} must be a positive safe integer.`);
};
var sessionPattern = /^[\w-]{32,128}$/;
function assertDebugSidecarSessionToken(value) {
  if (typeof value !== "string" || !sessionPattern.test(value))
    throw new Error("Sidecar session token must be 32-128 base64url characters.");
}
var assertRequestBounds = (message, limits) => {
  const args = message.arguments ?? {};
  if (!isRecord(args)) throw new Error("Sidecar request arguments must be an object.");
  if (message.command === "readMemory") {
    const count = args.count;
    if (!nonNegativeInteger(count) || count > limits.maxMemoryReadBytes)
      throw new Error(`Memory read count must be between 0 and ${limits.maxMemoryReadBytes}.`);
  }
  if (message.command === "disassemble") {
    const count = args.count;
    if (!nonNegativeInteger(count) || count > limits.maxDisassemblyInstructions)
      throw new Error(
        `Disassembly count must be between 0 and ${limits.maxDisassemblyInstructions}.`
      );
  }
  if (message.command === "setBreakpoints") {
    const breakpoints = args.breakpoints;
    if (!Array.isArray(breakpoints) || breakpoints.length > limits.maxBreakpoints)
      throw new Error(`Breakpoint count must be between 0 and ${limits.maxBreakpoints}.`);
  }
  if (message.command === "readTrace") {
    const maxEvents = args.maxEvents;
    if (!positiveInteger(maxEvents) || maxEvents > limits.maxTraceBatchEvents)
      throw new Error(`Trace batch size must be between 1 and ${limits.maxTraceBatchEvents}.`);
  }
};
function assertDebugSidecarMessage(value, limits = DEFAULT_DEBUG_SIDECAR_LIMITS) {
  if (!isRecord(value)) throw new Error("Sidecar message must be an object.");
  if (value.protocol !== DEBUG_SIDECAR_PROTOCOL)
    throw new Error(`Unsupported sidecar protocol '${String(value.protocol)}'.`);
  if (value.version !== DEBUG_SIDECAR_PROTOCOL_VERSION)
    throw new Error(`Unsupported sidecar protocol version '${String(value.version)}'.`);
  assertDebugSidecarSessionToken(value.session);
  if (!positiveInteger(value.sequence))
    throw new Error("Sidecar message sequence must be a positive safe integer.");
  if (value.type === "request") {
    if (!DEBUG_SIDECAR_COMMANDS.includes(value.command))
      throw new Error(`Unsupported sidecar command '${String(value.command)}'.`);
    assertRequestBounds(value, limits);
    return;
  }
  if (value.type === "response") {
    if (!positiveInteger(value.requestSequence))
      throw new Error("Sidecar response requestSequence must be a positive safe integer.");
    if (typeof value.success !== "boolean")
      throw new Error("Sidecar response success must be boolean.");
    if (!value.success && typeof value.error !== "string")
      throw new Error("Failed sidecar response must include an error string.");
    return;
  }
  if (value.type === "event") {
    if (!DEBUG_SIDECAR_EVENTS.includes(value.event))
      throw new Error(`Unsupported sidecar event '${String(value.event)}'.`);
    if (!isRecord(value.body)) throw new Error("Sidecar event body must be an object.");
    return;
  }
  throw new Error(`Unsupported sidecar message type '${String(value.type)}'.`);
}
var validateLimits = (limits) => {
  for (const [name, value] of Object.entries(limits))
    assertLimit(name, value);
  if (limits.maxBufferedBytes < limits.maxFrameBytes + 4)
    throw new Error("maxBufferedBytes must hold at least one complete framed message.");
};
var encodeDebugSidecarMessage = (message, limits = DEFAULT_DEBUG_SIDECAR_LIMITS) => {
  validateLimits(limits);
  assertDebugSidecarMessage(message, limits);
  const body = Buffer.from(JSON.stringify(message), "utf8");
  if (body.length > limits.maxFrameBytes)
    throw new Error(`Sidecar frame exceeds ${limits.maxFrameBytes} bytes.`);
  const frame = Buffer.allocUnsafe(body.length + 4);
  frame.writeUInt32BE(body.length, 0);
  body.copy(frame, 4);
  return frame;
};
var DebugSidecarMessageParser = class {
  #limits;
  #buffer = Buffer.alloc(0);
  #lastSequence = 0;
  /**
   * Creates one directional stream parser.
   * @param {DebugSidecarProtocolLimits} limits Framing and request limits.
   */
  constructor(limits = DEFAULT_DEBUG_SIDECAR_LIMITS) {
    validateLimits(limits);
    this.#limits = limits;
  }
  /**
   * Adds a transport chunk and returns every complete validated message in order.
   * @param {Uint8Array} chunk Next stdio or socket bytes.
   * @returns {DebugSidecarMessage[]} Complete messages decoded from the stream.
   */
  push(chunk) {
    if (this.#buffer.length + chunk.length > this.#limits.maxBufferedBytes)
      throw new Error(`Sidecar receive buffer exceeds ${this.#limits.maxBufferedBytes} bytes.`);
    this.#buffer = Buffer.concat([this.#buffer, chunk]);
    const messages = [];
    while (this.#buffer.length >= 4) {
      const length = this.#buffer.readUInt32BE(0);
      if (length === 0) throw new Error("Sidecar frame body cannot be empty.");
      if (length > this.#limits.maxFrameBytes)
        throw new Error(`Sidecar frame declares ${length} bytes, above the configured limit.`);
      if (this.#buffer.length < length + 4) break;
      const body = this.#buffer.subarray(4, length + 4);
      this.#buffer = this.#buffer.subarray(length + 4);
      let decoded;
      try {
        decoded = JSON.parse(body.toString("utf8"));
      } catch {
        throw new Error("Sidecar frame contains invalid JSON.");
      }
      assertDebugSidecarMessage(decoded, this.#limits);
      if (decoded.sequence <= this.#lastSequence)
        throw new Error(
          `Sidecar sequence ${decoded.sequence} is not greater than ${this.#lastSequence}.`
        );
      this.#lastSequence = decoded.sequence;
      messages.push(decoded);
    }
    return messages;
  }
};
var DebugSidecarMessageQueue = class {
  #limits;
  #frames = [];
  #bytes = 0;
  /**
   * Creates a bounded outgoing queue.
   * @param {DebugSidecarProtocolLimits} limits Framing and queue limits.
   */
  constructor(limits = DEFAULT_DEBUG_SIDECAR_LIMITS) {
    validateLimits(limits);
    this.#limits = limits;
  }
  /** @returns {number} Number of queued protocol messages. */
  get length() {
    return this.#frames.length;
  }
  /** @returns {number} Encoded bytes currently retained for transport backpressure. */
  get bytes() {
    return this.#bytes;
  }
  /**
   * Encodes and appends one message, failing the connection when bounds would be exceeded.
   * @param {DebugSidecarMessage} message Next ordered message.
   * @returns {void}
   */
  enqueue(message) {
    const frame = encodeDebugSidecarMessage(message, this.#limits);
    if (this.#frames.length >= this.#limits.maxQueuedMessages || this.#bytes + frame.length > this.#limits.maxQueuedBytes)
      throw new Error("Sidecar outgoing queue exceeded its backpressure limit.");
    this.#frames.push(frame);
    this.#bytes += frame.length;
  }
  /**
   * Removes the oldest encoded frame.
   * @returns {Uint8Array | undefined} Oldest frame or undefined when empty.
   */
  dequeue() {
    const frame = this.#frames.shift();
    if (frame) this.#bytes -= frame.length;
    return frame;
  }
};

// packages/debug-adapter/src/node-stdio-transport.ts
var DEBUG_SIDECAR_SESSION_ENV = "UTTORI_ASM_DEBUG_SESSION";

// packages/debug-adapter/src/sidecar-server.ts
var stepKinds = /* @__PURE__ */ new Set(["instruction", "over", "in", "out"]);
var record = (value, context) => {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error(`${context} must be an object.`);
  return value;
};
var integer = (value, context, minimum = 0) => {
  if (!Number.isSafeInteger(value) || value < minimum)
    throw new Error(`${context} must be a safe integer greater than or equal to ${minimum}.`);
  return value;
};
var positiveInteger2 = (value, context) => integer(value, context, 1);
var string = (value, context) => {
  if (typeof value !== "string" || value.length === 0)
    throw new Error(`${context} must be a non-empty string.`);
  return value;
};
var optionalPositiveInteger = (value, context) => value === void 0 ? void 0 : positiveInteger2(value, context);
var boolean = (value, context, defaultValue) => {
  if (value === void 0) return defaultValue;
  if (typeof value !== "boolean") throw new Error(`${context} must be boolean.`);
  return value;
};
var address = (value, context) => {
  const candidate = record(value, context);
  if (typeof candidate.architecture !== "string" || candidate.architecture.length === 0)
    throw new Error(`${context}.architecture must be a non-empty string.`);
  if (typeof candidate.addressSpace !== "string" || candidate.addressSpace.length === 0)
    throw new Error(`${context}.addressSpace must be a non-empty string.`);
  const outputOffset = candidate.outputOffset === void 0 ? void 0 : integer(candidate.outputOffset, `${context}.outputOffset`);
  return {
    architecture: candidate.architecture,
    addressSpace: candidate.addressSpace,
    address: integer(candidate.address, `${context}.address`),
    ...outputOffset === void 0 ? {} : { outputOffset }
  };
};
var addresses = (value, context) => {
  if (!Array.isArray(value)) throw new Error(`${context} must be an array.`);
  return value.map((entry, index) => address(entry, `${context}[${index}]`));
};
var asError = (error) => error instanceof Error ? error : new Error(String(error));
var DebugSidecarServer = class {
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
    if (typeof options.backend !== "string" || options.backend.length === 0)
      throw new Error("Sidecar backend name must be a non-empty string.");
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
    if (this.#closed) return Promise.reject(new Error("Sidecar server is closed."));
    const receive = this.#receiveTail.then(() => this.#receive(data));
    this.#receiveTail = receive.catch(() => void 0);
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
    if (this.#closed) return;
    this.#closed = true;
    this.#eventSubscription.dispose();
    await this.#writeTail.catch(() => void 0);
    await this.#closeTransport(error);
  }
  async #receive(data) {
    for (const message of this.#parser.push(data)) {
      if (message.session !== this.#session)
        throw new Error("Sidecar request session does not match this connection.");
      if (message.type !== "request")
        throw new Error("Sidecar client sent a non-request message on a server-only channel.");
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
    } catch (error) {
      failure = asError(error);
    } finally {
      this.#capturedEvents = void 0;
    }
    await this.#send(
      this.#envelope({
        type: "response",
        requestSequence: request.sequence,
        success: failure === void 0,
        ...failure ? { error: failure.message } : { result }
      })
    );
    for (const event of events) await this.#send(this.#eventEnvelope(event));
    if (request.command === "shutdown" && !failure) await this.close();
  }
  async #dispatch(request) {
    const args = record(request.arguments ?? {}, "Sidecar request arguments");
    if (request.command === "initialize") {
      if (args.backend !== this.#backendName) throw new Error("Unexpected backend identity.");
      if (args.backendProtocolVersion !== DEBUG_BACKEND_PROTOCOL_VERSION)
        throw new Error("Unsupported backend protocol version.");
      return {
        backend: this.#backendName,
        backendProtocolVersion: DEBUG_BACKEND_PROTOCOL_VERSION,
        capabilities: this.#implementation.capabilities
      };
    }
    if (request.command === "connect") {
      await this.#implementation.connect({
        reset: boolean(args.reset, "Connect reset", true)
      });
      return {};
    }
    if (request.command === "disconnect") {
      await this.#implementation.disconnect({
        terminate: boolean(args.terminate, "Disconnect terminate", true)
      });
      return {};
    }
    if (request.command === "pause") {
      await this.#implementation.pause(optionalPositiveInteger(args.threadId, "Pause threadId"));
      return {};
    }
    if (request.command === "continue") {
      await this.#implementation.continue(
        optionalPositiveInteger(args.threadId, "Continue threadId")
      );
      return {};
    }
    if (request.command === "step") {
      if (!stepKinds.has(args.kind))
        throw new Error(`Unsupported step kind '${String(args.kind)}'.`);
      await this.#implementation.step(
        positiveInteger2(args.threadId, "Step threadId"),
        args.kind
      );
      return {};
    }
    if (request.command === "threads") return this.#implementation.threads();
    if (request.command === "stackFrames")
      return this.#implementation.stackFrames(
        positiveInteger2(args.threadId, "Stack frames threadId")
      );
    if (request.command === "registers")
      return this.#implementation.registers(positiveInteger2(args.frameId, "Registers frameId"));
    if (request.command === "readMemory") {
      const memory = await this.#implementation.readMemory(
        address(args.address, "Memory address"),
        integer(args.count, "Memory count")
      );
      return {
        address: memory.address,
        data: Buffer.from(memory.bytes).toString("base64"),
        unreadableBytes: memory.unreadableBytes
      };
    }
    if (request.command === "setBreakpoints")
      return this.#implementation.setBreakpoints(
        addresses(args.breakpoints, "Breakpoint addresses")
      );
    if (request.command === "disassemble")
      return this.#implementation.disassemble(
        address(args.address, "Disassembly address"),
        integer(args.count, "Disassembly count")
      );
    if (request.command === "startTrace") {
      await this.#implementation.startTrace({
        architecture: string(args.architecture, "Trace architecture"),
        addressSpace: string(args.addressSpace, "Trace address space")
      });
      return {};
    }
    if (request.command === "readTrace")
      return this.#implementation.readTrace(positiveInteger2(args.maxEvents, "Trace batch size"));
    if (request.command === "stopTrace") {
      await this.#implementation.stopTrace();
      return {};
    }
    if (request.command === "ping") return { pong: true };
    if (request.command === "shutdown") return {};
    throw new Error(`Unsupported command '${String(request.command)}'.`);
  }
  #backendEvent(event) {
    if (this.#closed) return;
    if (this.#capturedEvents) {
      this.#capturedEvents.push(event);
      return;
    }
    void this.#send(this.#eventEnvelope(event)).catch(
      (error) => this.close(asError(error))
    );
  }
  #eventEnvelope(event) {
    if (event.type === "stopped")
      return this.#envelope({
        type: "event",
        event: "stopped",
        body: { reason: event.reason, threadId: event.threadId }
      });
    if (event.type === "continued")
      return this.#envelope({
        type: "event",
        event: "continued",
        body: { threadId: event.threadId, allThreads: event.allThreads }
      });
    if (event.type === "terminated")
      return this.#envelope({
        type: "event",
        event: "terminated",
        body: { restart: event.restart }
      });
    if (event.type === "breakpoint")
      return this.#envelope({
        type: "event",
        event: "breakpoint",
        body: { breakpoint: event.breakpoint }
      });
    return this.#envelope({
      type: "event",
      event: "output",
      body: { category: event.category, text: event.text }
    });
  }
  #envelope(message) {
    if (!Number.isSafeInteger(this.#serverSequence) || this.#serverSequence <= 0)
      throw new Error("Sidecar server sequence exhausted.");
    return {
      protocol: DEBUG_SIDECAR_PROTOCOL,
      version: DEBUG_SIDECAR_PROTOCOL_VERSION,
      session: this.#session,
      sequence: this.#serverSequence++,
      ...message
    };
  }
  #send(message) {
    if (this.#closed) return Promise.reject(new Error("Sidecar server is closed."));
    this.#outgoing.enqueue(message);
    const write2 = this.#writeTail.then(async () => {
      let frame = this.#outgoing.dequeue();
      while (frame) {
        await this.#write(frame);
        frame = this.#outgoing.dequeue();
      }
    });
    this.#writeTail = write2.catch(() => void 0);
    return write2;
  }
};

// packages/core/src/decoder-types.ts
var Uint8ArrayDecoderSource = class {
  #bytes;
  constructor(bytes) {
    this.#bytes = Uint8Array.from(bytes);
  }
  /**
   * The length of the byte source.
   * @returns {number} The length of the byte source.
   */
  get length() {
    return this.#bytes.length;
  }
  /**
   * Reads a byte from the byte source.
   * @param {number} offset The offset to read from.
   * @returns {number | undefined} The byte at the offset, or undefined if the offset is out of bounds.
   */
  readByte(offset) {
    if (!Number.isInteger(offset) || offset < 0 || offset >= this.#bytes.length) return void 0;
    return this.#bytes[offset];
  }
  /**
   * Reads bytes from the byte source.
   * @param {number} offset The offset to read from.
   * @param {number} length The length to read.
   * @returns {Uint8Array | undefined} The bytes at the offset and length, or undefined if the offset or length is out of bounds.
   */
  readBytes(offset, length) {
    if (!Number.isInteger(offset) || !Number.isInteger(length) || offset < 0 || length < 0) {
      return void 0;
    }
    const end = offset + length;
    if (!Number.isSafeInteger(end) || end > this.#bytes.length) return void 0;
    return this.#bytes.slice(offset, end);
  }
};

// packages/plugin-snes/src/architectures/65816-spec.ts
var mode = (id, syntax, minimumSize, maximumSize = minimumSize, widthFlag) => ({
  id,
  syntax,
  minimumSize,
  maximumSize,
  ...widthFlag ? { widthFlag } : {}
});
var cpu65816Modes = Object.freeze({
  imp: mode("implied", "", 1),
  acc: mode("accumulator", "", 1),
  sig: mode("signature", "#const", 2),
  immM: mode("immediate", "#const", 2, 3, "m"),
  immX: mode("immediate", "#const", 2, 3, "x"),
  imm16: mode("immediate16", "addr", 3),
  dp: mode("direct", "dp", 2),
  dpx: mode("directIndexedX", "dp,x", 2),
  dpy: mode("directIndexedY", "dp,y", 2),
  dpi: mode("directIndirect", "(dp)", 2),
  dil: mode("directIndirectLong", "[dp]", 2),
  dix: mode("directIndexedXIndirect", "(dp,x)", 2),
  diy: mode("directIndirectIndexedY", "(dp),y", 2),
  dily: mode("directIndirectLongIndexedY", "[dp],y", 2),
  sr: mode("stackRelative", "sr,s", 2),
  sriy: mode("stackRelativeIndirectIndexedY", "(sr,s),y", 2),
  abs: mode("absolute", "addr", 3),
  abx: mode("absoluteIndexedX", "addr,x", 3),
  aby: mode("absoluteIndexedY", "addr,y", 3),
  long: mode("absoluteLong", "long", 4),
  longx: mode("absoluteLongIndexedX", "long,x", 4),
  rel8: mode("relative", "label", 2),
  rel16: mode("relativeLong", "label", 3),
  ind: mode("absoluteIndirect", "(addr)", 3),
  indx: mode("absoluteIndexedXIndirect", "(addr,x)", 3),
  indlong: mode("absoluteIndirectLong", "[addr]", 3),
  block: mode("blockMove", "srcBank,destBank", 3)
});
var opcodeRows = [
  "BRK:sig ORA:dix COP:sig ORA:sr TSB:dp ORA:dp ASL:dp ORA:dil PHP:imp ORA:immM ASL:acc PHD:imp TSB:abs ORA:abs ASL:abs ORA:long",
  "BPL:rel8 ORA:diy ORA:dpi ORA:sriy TRB:dp ORA:dpx ASL:dpx ORA:dily CLC:imp ORA:aby INC:acc TCS:imp TRB:abs ORA:abx ASL:abx ORA:longx",
  "JSR:abs AND:dix JSL:long AND:sr BIT:dp AND:dp ROL:dp AND:dil PLP:imp AND:immM ROL:acc PLD:imp BIT:abs AND:abs ROL:abs AND:long",
  "BMI:rel8 AND:diy AND:dpi AND:sriy BIT:dpx AND:dpx ROL:dpx AND:dily SEC:imp AND:aby DEC:acc TSC:imp BIT:abx AND:abx ROL:abx AND:longx",
  "RTI:imp EOR:dix WDM:sig EOR:sr MVP:block EOR:dp LSR:dp EOR:dil PHA:imp EOR:immM LSR:acc PHK:imp JMP:abs EOR:abs LSR:abs EOR:long",
  "BVC:rel8 EOR:diy EOR:dpi EOR:sriy MVN:block EOR:dpx LSR:dpx EOR:dily CLI:imp EOR:aby PHY:imp TCD:imp JML:long EOR:abx LSR:abx EOR:longx",
  "RTS:imp ADC:dix PER:rel16 ADC:sr STZ:dp ADC:dp ROR:dp ADC:dil PLA:imp ADC:immM ROR:acc RTL:imp JMP:ind ADC:abs ROR:abs ADC:long",
  "BVS:rel8 ADC:diy ADC:dpi ADC:sriy STZ:dpx ADC:dpx ROR:dpx ADC:dily SEI:imp ADC:aby PLY:imp TDC:imp JMP:indx ADC:abx ROR:abx ADC:longx",
  "BRA:rel8 STA:dix BRL:rel16 STA:sr STY:dp STA:dp STX:dp STA:dil DEY:imp BIT:immM TXA:imp PHB:imp STY:abs STA:abs STX:abs STA:long",
  "BCC:rel8 STA:diy STA:dpi STA:sriy STY:dpx STA:dpx STX:dpy STA:dily TYA:imp STA:aby TXS:imp TXY:imp STZ:abs STA:abx STZ:abx STA:longx",
  "LDY:immX LDA:dix LDX:immX LDA:sr LDY:dp LDA:dp LDX:dp LDA:dil TAY:imp LDA:immM TAX:imp PLB:imp LDY:abs LDA:abs LDX:abs LDA:long",
  "BCS:rel8 LDA:diy LDA:dpi LDA:sriy LDY:dpx LDA:dpx LDX:dpy LDA:dily CLV:imp LDA:aby TSX:imp TYX:imp LDY:abx LDA:abx LDX:aby LDA:longx",
  "CPY:immX CMP:dix REP:sig CMP:sr CPY:dp CMP:dp DEC:dp CMP:dil INY:imp CMP:immM DEX:imp WAI:imp CPY:abs CMP:abs DEC:abs CMP:long",
  "BNE:rel8 CMP:diy CMP:dpi CMP:sriy PEI:dpi CMP:dpx DEC:dpx CMP:dily CLD:imp CMP:aby PHX:imp STP:imp JML:indlong CMP:abx DEC:abx CMP:longx",
  "CPX:immX SBC:dix SEP:sig SBC:sr CPX:dp SBC:dp INC:dp SBC:dil INX:imp SBC:immM NOP:imp XBA:imp CPX:abs SBC:abs INC:abs SBC:long",
  "BEQ:rel8 SBC:diy SBC:dpi SBC:sriy PEA:imm16 SBC:dpx INC:dpx SBC:dily SED:imp SBC:aby PLX:imp XCE:imp JSR:indx SBC:abx INC:abx SBC:longx"
];
var summaries = {
  ADC: "Add with carry to the accumulator.",
  AND: "Bitwise AND with the accumulator.",
  ASL: "Arithmetic shift left.",
  BCC: "Branch if carry clear.",
  BCS: "Branch if carry set.",
  BEQ: "Branch if equal (zero set).",
  BIT: "Test bits against the accumulator.",
  BMI: "Branch if minus (negative set).",
  BNE: "Branch if not equal (zero clear).",
  BPL: "Branch if plus (negative clear).",
  BRA: "Branch always.",
  BRK: "Software break / interrupt.",
  BRL: "Branch always long (16-bit relative).",
  BVC: "Branch if overflow clear.",
  BVS: "Branch if overflow set.",
  CLC: "Clear carry flag.",
  CLD: "Clear decimal flag.",
  CLI: "Clear interrupt-disable flag.",
  CLV: "Clear overflow flag.",
  CMP: "Compare with the accumulator.",
  COP: "Coprocessor enable interrupt.",
  CPX: "Compare with the X register.",
  CPY: "Compare with the Y register.",
  DEC: "Decrement memory or the accumulator.",
  DEX: "Decrement the X register.",
  DEY: "Decrement the Y register.",
  EOR: "Bitwise exclusive-OR with the accumulator.",
  INC: "Increment memory or the accumulator.",
  INX: "Increment the X register.",
  INY: "Increment the Y register.",
  JML: "Jump long (24-bit).",
  JMP: "Jump.",
  JSL: "Jump to subroutine long.",
  JSR: "Jump to subroutine.",
  LDA: "Load the accumulator.",
  LDX: "Load the X register.",
  LDY: "Load the Y register.",
  LSR: "Logical shift right.",
  MVN: "Block move next (ascending).",
  MVP: "Block move previous (descending).",
  NOP: "No operation.",
  ORA: "Bitwise OR with the accumulator.",
  PEA: "Push effective absolute address.",
  PEI: "Push effective indirect address.",
  PER: "Push effective PC-relative address.",
  PHA: "Push the accumulator.",
  PHB: "Push the data bank register.",
  PHD: "Push the direct page register.",
  PHK: "Push the program bank register.",
  PHP: "Push the processor status register.",
  PHX: "Push the X register.",
  PHY: "Push the Y register.",
  PLA: "Pull the accumulator.",
  PLB: "Pull the data bank register.",
  PLD: "Pull the direct page register.",
  PLP: "Pull the processor status register.",
  PLX: "Pull the X register.",
  PLY: "Pull the Y register.",
  REP: "Reset status bits.",
  ROL: "Rotate left through carry.",
  ROR: "Rotate right through carry.",
  RTI: "Return from interrupt.",
  RTL: "Return from subroutine long.",
  RTS: "Return from subroutine.",
  SBC: "Subtract with borrow from the accumulator.",
  SEC: "Set carry flag.",
  SED: "Set decimal flag.",
  SEI: "Set interrupt-disable flag.",
  SEP: "Set status bits.",
  STA: "Store the accumulator.",
  STP: "Stop the processor.",
  STX: "Store the X register.",
  STY: "Store the Y register.",
  STZ: "Store zero to memory.",
  TAX: "Transfer accumulator to X.",
  TAY: "Transfer accumulator to Y.",
  TCD: "Transfer accumulator to direct page register.",
  TCS: "Transfer accumulator to stack pointer.",
  TDC: "Transfer direct page register to accumulator.",
  TRB: "Test and reset bits.",
  TSB: "Test and set bits.",
  TSC: "Transfer stack pointer to accumulator.",
  TSX: "Transfer stack pointer to X.",
  TXA: "Transfer X to accumulator.",
  TXS: "Transfer X to stack pointer.",
  TXY: "Transfer X to Y.",
  TYA: "Transfer Y to accumulator.",
  TYX: "Transfer Y to X.",
  WAI: "Wait for interrupt.",
  WDM: "Reserved (William D. Mensch) opcode.",
  XBA: "Exchange the bytes of the accumulator.",
  XCE: "Exchange carry and emulation flags."
};
var conditionalBranches = /* @__PURE__ */ new Set([
  "BCC",
  "BCS",
  "BEQ",
  "BMI",
  "BNE",
  "BPL",
  "BVC",
  "BVS"
]);
var flowFor = (mnemonic, addressingMode) => {
  if (conditionalBranches.has(mnemonic)) return { kind: "conditionalBranch", fallthrough: true };
  if (mnemonic === "BRA" || mnemonic === "BRL") return { kind: "jump", fallthrough: false };
  if (mnemonic === "JMP" || mnemonic === "JML") {
    return {
      kind: "jump",
      fallthrough: false,
      ...addressingMode.includes("Indirect") ? { indirect: true } : {}
    };
  }
  if (mnemonic === "JSR" || mnemonic === "JSL") {
    return {
      kind: "call",
      fallthrough: true,
      ...addressingMode.includes("Indirect") ? { indirect: true } : {}
    };
  }
  if (mnemonic === "RTI" || mnemonic === "RTL" || mnemonic === "RTS") {
    return { kind: "return", fallthrough: false };
  }
  if (mnemonic === "BRK" || mnemonic === "COP") {
    return { kind: "interrupt", fallthrough: false };
  }
  if (mnemonic === "WAI") return { kind: "wait", fallthrough: false };
  if (mnemonic === "STP") return { kind: "stop", fallthrough: false };
  return { kind: "fallthrough", fallthrough: true };
};
var effects = {
  CLC: [{ kind: "clearBits", target: "p", mask: 1 }],
  SEC: [{ kind: "setBits", target: "p", mask: 1 }],
  CLI: [{ kind: "clearBits", target: "p", mask: 4 }],
  SEI: [{ kind: "setBits", target: "p", mask: 4 }],
  CLD: [{ kind: "clearBits", target: "p", mask: 8 }],
  SED: [{ kind: "setBits", target: "p", mask: 8 }],
  CLV: [{ kind: "clearBits", target: "p", mask: 64 }],
  PHA: [{ kind: "push", source: "a" }],
  PHB: [{ kind: "push", source: "dbr" }],
  PHD: [{ kind: "push", source: "d" }],
  PHK: [{ kind: "push", source: "pbr" }],
  PHP: [{ kind: "push", source: "p" }],
  PHX: [{ kind: "push", source: "x" }],
  PHY: [{ kind: "push", source: "y" }],
  PLA: [{ kind: "pull", target: "a" }],
  PLB: [{ kind: "pull", target: "dbr" }],
  PLD: [{ kind: "pull", target: "d" }],
  PLP: [{ kind: "pull", target: "p" }],
  PLX: [{ kind: "pull", target: "x" }],
  PLY: [{ kind: "pull", target: "y" }],
  TAX: [{ kind: "copy", from: "a", to: "x" }],
  TAY: [{ kind: "copy", from: "a", to: "y" }],
  TCD: [{ kind: "copy", from: "a", to: "d" }],
  TCS: [{ kind: "copy", from: "a", to: "s" }],
  TDC: [{ kind: "copy", from: "d", to: "a" }],
  TSC: [{ kind: "copy", from: "s", to: "a" }],
  TSX: [{ kind: "copy", from: "s", to: "x" }],
  TXA: [{ kind: "copy", from: "x", to: "a" }],
  TXS: [{ kind: "copy", from: "x", to: "s" }],
  TXY: [{ kind: "copy", from: "x", to: "y" }],
  TYA: [{ kind: "copy", from: "y", to: "a" }],
  TYX: [{ kind: "copy", from: "y", to: "x" }],
  XBA: [{ kind: "custom", name: "exchange-accumulator-bytes" }],
  XCE: [
    { kind: "exchange", left: "c", right: "e" },
    { kind: "custom", name: "normalize-emulation-widths" }
  ],
  RTI: [
    { kind: "pull", target: "p" },
    { kind: "pull", target: "pc" },
    { kind: "pull", target: "pbr" }
  ],
  RTS: [{ kind: "pull", target: "pc" }],
  RTL: [
    { kind: "pull", target: "pc" },
    { kind: "pull", target: "pbr" }
  ]
};
var entries = opcodeRows.flatMap((row) => row.split(" "));
if (entries.length !== 256) throw new Error(`65816 opcode table has ${entries.length} entries.`);
var cpu65816Specifications = Object.freeze(
  entries.map((entry, opcode) => {
    const [mnemonic, modeKeyText] = entry.split(":");
    const modeKey = modeKeyText;
    const definition = cpu65816Modes[modeKey];
    if (!mnemonic || !definition) throw new Error(`Invalid 65816 opcode entry '${entry}'.`);
    let operandStatusEffect;
    if (mnemonic === "REP") operandStatusEffect = "clearBits";
    else if (mnemonic === "SEP") operandStatusEffect = "setBits";
    return Object.freeze({
      id: `snes.65816.${opcode.toString(16).padStart(2, "0")}`,
      architecture: "snes.65816",
      opcode: [opcode],
      mnemonic,
      mode: definition.id,
      syntax: mnemonic === "PEI" ? "dp" : definition.syntax,
      minimumSize: definition.minimumSize,
      maximumSize: definition.maximumSize,
      summary: summaries[mnemonic] ?? `${mnemonic} instruction.`,
      flow: flowFor(mnemonic, definition.id),
      effects: effects[mnemonic] ?? [],
      ...definition.widthFlag ? { widthFlag: definition.widthFlag } : {},
      ...operandStatusEffect ? { operandStatusEffect } : {}
    });
  })
);

// packages/plugin-snes/src/architectures/spc700-spec.ts
var mode2 = (id, syntax, size) => ({
  id,
  syntax,
  size
});
var spc700Modes = Object.freeze({
  imp: mode2("implied", "", 1),
  tc: mode2("tableCall", "n", 1),
  dpBit: mode2("directBit", "dp", 2),
  dpBitRel: mode2("directBitRelative", "dp,label", 3),
  aDp: mode2("accumulatorDirect", "A,dp", 2),
  aAbs: mode2("accumulatorAbsolute", "A,addr", 3),
  aIndX: mode2("accumulatorIndirectX", "A,(X)", 1),
  aDpxi: mode2("accumulatorDirectIndexedXIndirect", "A,(dp+X)", 2),
  aImm: mode2("accumulatorImmediate", "A,#const", 2),
  dpDp: mode2("directDirect", "dp,dp", 3),
  cBit: mode2("carryMemoryBit", "C,addr.bit", 3),
  cBitInv: mode2("carryInvertedMemoryBit", "C,/addr.bit", 3),
  bitC: mode2("memoryBitCarry", "addr.bit,C", 3),
  bit: mode2("memoryBit", "addr.bit", 3),
  dp: mode2("direct", "dp", 2),
  dpx: mode2("directIndexedX", "dp+X", 2),
  abs: mode2("absolute", "addr", 3),
  rel: mode2("relative", "label", 2),
  absA: mode2("absoluteAccumulator", "addr,A", 3),
  aDpx: mode2("accumulatorDirectIndexedX", "A,dp+X", 2),
  aAbx: mode2("accumulatorAbsoluteIndexedX", "A,addr+X", 3),
  aAby: mode2("accumulatorAbsoluteIndexedY", "A,addr+Y", 3),
  aDpiy: mode2("accumulatorDirectIndirectIndexedY", "A,(dp)+Y", 2),
  dpImm: mode2("directImmediate", "dp,#const", 3),
  xy: mode2("indirectXY", "(X),(Y)", 1),
  dpWord: mode2("directWord", "dp", 2),
  regA: mode2("registerA", "A", 1),
  regX: mode2("registerX", "X", 1),
  regY: mode2("registerY", "Y", 1),
  regP: mode2("registerP", "P", 1),
  regYA: mode2("registerYA", "YA", 1),
  regYAX: mode2("registerYAX", "YA,X", 1),
  regXA: mode2("registerXA", "X,A", 1),
  regAX: mode2("registerAX", "A,X", 1),
  regXSP: mode2("registerXSP", "X,SP", 1),
  regSPX: mode2("registerSPX", "SP,X", 1),
  regAY: mode2("registerAY", "A,Y", 1),
  regYA2: mode2("registerYA2", "Y,A", 1),
  regPostXA: mode2("registerPostIncrementXA", "(X+),A", 1),
  regAPostX: mode2("registerAPostIncrementX", "A,(X+)", 1),
  regIndXA: mode2("registerIndirectXA", "(X),A", 1),
  regAIndX: mode2("registerAIndirectX", "A,(X)", 1),
  xAbs: mode2("registerXAbsolute", "X,addr", 3),
  xDp: mode2("registerXDirect", "X,dp", 2),
  xDpy: mode2("registerXDirectIndexedY", "X,dp+Y", 2),
  yAbs: mode2("registerYAbsolute", "Y,addr", 3),
  yDp: mode2("registerYDirect", "Y,dp", 2),
  yDpx: mode2("registerYDirectIndexedX", "Y,dp+X", 2),
  xImm: mode2("registerXImmediate", "X,#const", 2),
  yImm: mode2("registerYImmediate", "Y,#const", 2),
  jmpAbx: mode2("absoluteIndexedXIndirect", "(addr+X)", 3),
  dpRel: mode2("directRelative", "dp,label", 3),
  dpxRel: mode2("directIndexedXRelative", "dp+X,label", 3),
  yRel: mode2("registerYRelative", "Y,label", 2),
  yaDp: mode2("registerYADirect", "YA,dp", 2),
  dpYa: mode2("directRegisterYA", "dp,YA", 2),
  pcall: mode2("upperPageCall", "upage", 2),
  dpA: mode2("directRegisterA", "dp,A", 2),
  absRegA: mode2("absoluteRegisterA", "addr,A", 3),
  indXA: mode2("indirectXRegisterA", "(X),A", 1),
  dpxiA: mode2("directIndexedXIndirectRegisterA", "(dp+X),A", 2),
  dpxA: mode2("directIndexedXRegisterA", "dp+X,A", 2),
  abxA: mode2("absoluteIndexedXRegisterA", "addr+X,A", 3),
  abyA: mode2("absoluteIndexedYRegisterA", "addr+Y,A", 3),
  dpiyA: mode2("directIndirectIndexedYRegisterA", "(dp)+Y,A", 2),
  dpX: mode2("directRegisterX", "dp,X", 2),
  dpyX: mode2("directIndexedYRegisterX", "dp+Y,X", 2),
  absX: mode2("absoluteRegisterX", "addr,X", 3),
  dpY: mode2("directRegisterY", "dp,Y", 2),
  dpxY: mode2("directIndexedXRegisterY", "dp+X,Y", 2),
  absY: mode2("absoluteRegisterY", "addr,Y", 3)
});
var opcodeRows2 = [
  "NOP:imp TCALL:tc SET0:dpBit BBS0:dpBitRel OR:aDp OR:aAbs OR:aIndX OR:aDpxi OR:aImm OR:dpDp OR1:cBit ASL:dp ASL:abs PUSH:regP TSET:absA BRK:imp",
  "BPL:rel TCALL:tc CLR0:dpBit BBC0:dpBitRel OR:aDpx OR:aAbx OR:aAby OR:aDpiy OR:dpImm OR:xy DECW:dpWord ASL:dpx ASL:regA DEC:regX CMP:xAbs JMP:jmpAbx",
  "CLRP:imp TCALL:tc SET1:dpBit BBS1:dpBitRel AND:aDp AND:aAbs AND:aIndX AND:aDpxi AND:aImm AND:dpDp OR1:cBitInv ROL:dp ROL:abs PUSH:regA CBNE:dpRel BRA:rel",
  "BMI:rel TCALL:tc CLR1:dpBit BBC1:dpBitRel AND:aDpx AND:aAbx AND:aAby AND:aDpiy AND:dpImm AND:xy INCW:dpWord ROL:dpx ROL:regA INC:regX CMP:xDp CALL:abs",
  "SETP:imp TCALL:tc SET2:dpBit BBS2:dpBitRel EOR:aDp EOR:aAbs EOR:aIndX EOR:aDpxi EOR:aImm EOR:dpDp AND1:cBit LSR:dp LSR:abs PUSH:regX TCLR:absA PCALL:pcall",
  "BVC:rel TCALL:tc CLR2:dpBit BBC2:dpBitRel EOR:aDpx EOR:aAbx EOR:aAby EOR:aDpiy EOR:dpImm EOR:xy CMPW:yaDp LSR:dpx LSR:regA MOV:regXA CMP:yAbs JMP:abs",
  "CLRC:imp TCALL:tc SET3:dpBit BBS3:dpBitRel CMP:aDp CMP:aAbs CMP:aIndX CMP:aDpxi CMP:aImm CMP:dpDp AND1:cBitInv ROR:dp ROR:abs PUSH:regY DBNZ:dpRel RET:imp",
  "BVS:rel TCALL:tc CLR3:dpBit BBC3:dpBitRel CMP:aDpx CMP:aAbx CMP:aAby CMP:aDpiy CMP:dpImm CMP:xy ADDW:yaDp ROR:dpx ROR:regA MOV:regAX CMP:yDp RETI:imp",
  "SETC:imp TCALL:tc SET4:dpBit BBS4:dpBitRel ADC:aDp ADC:aAbs ADC:aIndX ADC:aDpxi ADC:aImm ADC:dpDp EOR1:cBit DEC:dp DEC:abs MOV:yImm POP:regP MOV:dpImm",
  "BCC:rel TCALL:tc CLR4:dpBit BBC4:dpBitRel ADC:aDpx ADC:aAbx ADC:aAby ADC:aDpiy ADC:dpImm ADC:xy SUBW:yaDp DEC:dpx DEC:regA MOV:regXSP DIV:regYAX XCN:regA",
  "EI:imp TCALL:tc SET5:dpBit BBS5:dpBitRel SBC:aDp SBC:aAbs SBC:aIndX SBC:aDpxi SBC:aImm SBC:dpDp MOV1:cBit INC:dp INC:abs CMP:yImm POP:regA MOV:regPostXA",
  "BCS:rel TCALL:tc CLR5:dpBit BBC5:dpBitRel SBC:aDpx SBC:aAbx SBC:aAby SBC:aDpiy SBC:dpImm SBC:xy MOVW:yaDp INC:dpx INC:regA MOV:regSPX DAS:regA MOV:regAPostX",
  "DI:imp TCALL:tc SET6:dpBit BBS6:dpBitRel MOV:dpA MOV:absRegA MOV:indXA MOV:dpxiA CMP:xImm MOV:absX MOV1:bitC MOV:dpY MOV:absY MOV:xImm POP:regX MUL:regYA",
  "BNE:rel TCALL:tc CLR6:dpBit BBC6:dpBitRel MOV:dpxA MOV:abxA MOV:abyA MOV:dpiyA MOV:dpX MOV:dpyX MOVW:dpYa MOV:dpxY DEC:regY MOV:regAY CBNE:dpxRel DAA:regA",
  "CLRV:imp TCALL:tc SET7:dpBit BBS7:dpBitRel MOV:aDp MOV:aAbs MOV:regAIndX MOV:aDpxi MOV:aImm MOV:xAbs NOT1:bit MOV:yDp MOV:yAbs NOTC:imp POP:regY SLEEP:imp",
  "BEQ:rel TCALL:tc CLR7:dpBit BBC7:dpBitRel MOV:aDpx MOV:aAbx MOV:aAby MOV:aDpiy MOV:xDp MOV:xDpy MOV:dpDp MOV:yDpx INC:regY MOV:regYA2 DBNZ:yRel STOP:imp"
];
var summaries2 = {
  ADC: "Add with carry.",
  ADDW: "Add a direct-page word to YA.",
  AND: "Bitwise AND.",
  AND1: "AND carry with a memory bit.",
  ASL: "Arithmetic shift left.",
  BBC0: "Branch if direct-page bit 0 is clear.",
  BBS0: "Branch if direct-page bit 0 is set.",
  BRA: "Branch always.",
  BRK: "Software interrupt.",
  CALL: "Call an absolute subroutine.",
  CBNE: "Compare accumulator and branch if not equal.",
  CLR0: "Clear direct-page bit 0.",
  CLRC: "Clear carry.",
  CLRP: "Select direct page zero.",
  CLRV: "Clear overflow and half-carry.",
  CMP: "Compare values.",
  CMPW: "Compare YA with a direct-page word.",
  DAA: "Decimal-adjust accumulator after addition.",
  DAS: "Decimal-adjust accumulator after subtraction.",
  DBNZ: "Decrement and branch if not zero.",
  DEC: "Decrement.",
  DECW: "Decrement a direct-page word.",
  DI: "Disable interrupts.",
  DIV: "Divide YA by X.",
  EI: "Enable interrupts.",
  EOR: "Bitwise exclusive OR.",
  EOR1: "Exclusive-OR carry with a memory bit.",
  INC: "Increment.",
  INCW: "Increment a direct-page word.",
  JMP: "Jump.",
  LSR: "Logical shift right.",
  MOV: "Move data between registers and memory.",
  MOV1: "Move a memory bit to or from carry.",
  MOVW: "Move a direct-page word to or from YA.",
  MUL: "Multiply Y by A into YA.",
  NOP: "No operation.",
  NOT1: "Invert a memory bit.",
  NOTC: "Invert carry.",
  OR: "Bitwise OR.",
  OR1: "OR carry with a memory bit.",
  PCALL: "Call within the upper page.",
  POP: "Pop a register from the stack.",
  PUSH: "Push a register onto the stack.",
  RET: "Return from subroutine.",
  RETI: "Return from interrupt.",
  ROL: "Rotate left through carry.",
  ROR: "Rotate right through carry.",
  SBC: "Subtract with borrow.",
  SET0: "Set direct-page bit 0.",
  SETC: "Set carry.",
  SETP: "Select direct page one.",
  SLEEP: "Wait for an interrupt.",
  STOP: "Stop the processor.",
  SUBW: "Subtract a direct-page word from YA.",
  TCALL: "Call through a fixed vector table entry.",
  TCLR: "Test and clear accumulator bits in memory.",
  TSET: "Test and set accumulator bits in memory.",
  XCN: "Exchange accumulator nibbles."
};
var spc700ConditionalBranches = /* @__PURE__ */ new Set([
  "BCC",
  "BCS",
  "BEQ",
  "BMI",
  "BNE",
  "BPL",
  "BVC",
  "BVS",
  "CBNE",
  "DBNZ"
]);
var flowFor2 = (mnemonic, addressingMode) => {
  if (spc700ConditionalBranches.has(mnemonic) || mnemonic.startsWith("BBS") || mnemonic.startsWith("BBC")) {
    return { kind: "conditionalBranch", fallthrough: true };
  }
  if (mnemonic === "BRA") return { kind: "jump", fallthrough: false };
  if (mnemonic === "JMP") {
    return {
      kind: "jump",
      fallthrough: false,
      ...addressingMode === "absoluteIndexedXIndirect" ? { indirect: true } : {}
    };
  }
  if (mnemonic === "CALL" || mnemonic === "PCALL" || mnemonic === "TCALL") {
    return {
      kind: "call",
      fallthrough: true,
      ...mnemonic === "TCALL" ? { indirect: true } : {}
    };
  }
  if (mnemonic === "RET" || mnemonic === "RETI") {
    return { kind: "return", fallthrough: false };
  }
  if (mnemonic === "BRK") return { kind: "interrupt", fallthrough: false };
  if (mnemonic === "SLEEP") return { kind: "wait", fallthrough: false };
  if (mnemonic === "STOP") return { kind: "stop", fallthrough: false };
  return { kind: "fallthrough", fallthrough: true };
};
var effects2 = {
  CLRC: [{ kind: "clearBits", target: "p", mask: 1 }],
  SETC: [{ kind: "setBits", target: "p", mask: 1 }],
  DI: [{ kind: "clearBits", target: "p", mask: 4 }],
  EI: [{ kind: "setBits", target: "p", mask: 4 }],
  CLRP: [{ kind: "clearBits", target: "p", mask: 32 }],
  SETP: [{ kind: "setBits", target: "p", mask: 32 }],
  CLRV: [{ kind: "clearBits", target: "p", mask: 72 }],
  NOTC: [{ kind: "custom", name: "invert-status-bit", details: { target: "p", mask: 1 } }],
  PUSH: [{ kind: "push", source: "operand-register" }],
  POP: [{ kind: "pull", target: "operand-register" }],
  RET: [{ kind: "pull", target: "pc" }],
  RETI: [
    { kind: "pull", target: "p" },
    { kind: "pull", target: "pc" }
  ]
};
var entries2 = opcodeRows2.flatMap((row) => row.split(" "));
if (entries2.length !== 256) throw new Error(`SPC700 opcode table has ${entries2.length} entries.`);
var spc700Specifications = Object.freeze(
  entries2.map((entry, opcode) => {
    const [mnemonic, modeKeyText] = entry.split(":");
    const definition = spc700Modes[modeKeyText];
    if (!mnemonic || !definition) throw new Error(`Invalid SPC700 opcode entry '${entry}'.`);
    const summaryKey = mnemonic.replace(/[0-7]$/, "0");
    return Object.freeze({
      id: `snes.spc700.${opcode.toString(16).padStart(2, "0")}`,
      architecture: "snes.spc700",
      opcode: [opcode],
      mnemonic,
      mode: definition.id,
      syntax: definition.syntax,
      minimumSize: definition.size,
      maximumSize: definition.size,
      summary: summaries2[mnemonic] ?? summaries2[summaryKey] ?? `${mnemonic} instruction.`,
      flow: flowFor2(mnemonic, definition.id),
      effects: effects2[mnemonic] ?? []
    });
  })
);

// packages/plugin-snes/src/architectures/superfx-spec.ts
var syntaxFor = (encoding) => {
  switch (encoding) {
    case "implied":
      return "";
    case "relative":
      return "label";
    case "register":
      return "Rn";
    case "registerIndirect":
      return "(Rn)";
    case "immediateNibble":
      return "#n";
    case "registerImmediate8":
    case "registerImmediate16":
      return "Rn,#imm";
    case "registerRamShort":
      return "Rn,(addr)";
    case "ramShortRegister":
      return "(addr),Rn";
    case "registerRamAbsolute":
      return "Rn,(addr)";
    case "ramAbsoluteRegister":
      return "(addr),Rn";
  }
  throw new Error("Unsupported SuperFX operand encoding.");
};
var implied = (mnemonic, writesDestination = false) => ({
  mnemonic,
  encoding: "implied",
  size: 1,
  ...writesDestination ? { writesDestination: true } : {}
});
var register = (mnemonic, value, writesDestination = false) => ({
  mnemonic,
  encoding: "register",
  size: 1,
  register: value,
  ...writesDestination ? { writesDestination: true } : {}
});
var registerIndirect = (mnemonic, value, writesDestination = false) => ({
  mnemonic,
  encoding: "registerIndirect",
  size: 1,
  register: value,
  ...writesDestination ? { writesDestination: true } : {}
});
var nibble = (mnemonic, value, writesDestination = false) => ({
  mnemonic,
  encoding: "immediateNibble",
  size: 1,
  register: value,
  ...writesDestination ? { writesDestination: true } : {}
});
var baseDefinition = (opcode) => {
  if (opcode === 0) return implied("STOP");
  if (opcode === 1) return implied("NOP");
  if (opcode === 2) return implied("CACHE");
  if (opcode === 3) return implied("LSR", true);
  if (opcode === 4) return implied("ROL", true);
  const branches = ["BRA", "BGE", "BLT", "BNE", "BEQ", "BPL", "BMI", "BCC", "BCS", "BVC", "BVS"];
  if (opcode >= 5 && opcode <= 15) {
    return { mnemonic: branches[opcode - 5], encoding: "relative", size: 2 };
  }
  if (opcode >= 16 && opcode <= 31) return register("TO", opcode & 15);
  if (opcode >= 32 && opcode <= 47) return register("WITH", opcode & 15);
  if (opcode >= 48 && opcode <= 59) return registerIndirect("STW", opcode & 15);
  if (opcode === 60) return implied("LOOP");
  if (opcode === 61) return implied("ALT1");
  if (opcode === 62) return implied("ALT2");
  if (opcode === 63) return implied("ALT3");
  if (opcode >= 64 && opcode <= 75) return registerIndirect("LDW", opcode & 15, true);
  if (opcode === 76) return implied("PLOT");
  if (opcode === 77) return implied("SWAP", true);
  if (opcode === 78) return implied("COLOR");
  if (opcode === 79) return implied("NOT", true);
  if (opcode >= 80 && opcode <= 95) return register("ADD", opcode & 15, true);
  if (opcode >= 96 && opcode <= 111) return register("SUB", opcode & 15, true);
  if (opcode === 112) return implied("MERGE", true);
  if (opcode >= 113 && opcode <= 127) return register("AND", opcode & 15, true);
  if (opcode >= 128 && opcode <= 143) return register("MULT", opcode & 15, true);
  if (opcode === 144) return implied("SBK");
  if (opcode >= 145 && opcode <= 148) return nibble("LINK", opcode & 15);
  if (opcode === 149) return implied("SEX", true);
  if (opcode === 150) return implied("ASR", true);
  if (opcode === 151) return implied("ROR", true);
  if (opcode >= 152 && opcode <= 157) return register("JMP", opcode & 15);
  if (opcode === 158) return implied("LOB", true);
  if (opcode === 159) return implied("FMULT", true);
  if (opcode >= 160 && opcode <= 175) {
    return {
      mnemonic: "IBT",
      encoding: "registerImmediate8",
      size: 2,
      register: opcode & 15
    };
  }
  if (opcode >= 176 && opcode <= 191) return register("FROM", opcode & 15);
  if (opcode === 192) return implied("HIB", true);
  if (opcode >= 193 && opcode <= 207) return register("OR", opcode & 15, true);
  if (opcode >= 208 && opcode <= 222) return register("INC", opcode & 15);
  if (opcode === 223) return implied("GETC");
  if (opcode >= 224 && opcode <= 238) return register("DEC", opcode & 15);
  if (opcode === 239) return implied("GETB", true);
  return {
    mnemonic: "IWT",
    encoding: "registerImmediate16",
    size: 3,
    register: opcode & 15
  };
};
var altDefinition = (alt, opcode) => {
  if (alt === 0) return baseDefinition(opcode);
  const low = opcode & 15;
  if (alt === 1) {
    if (opcode >= 48 && opcode <= 59) return registerIndirect("STB", low);
    if (opcode >= 64 && opcode <= 75) return registerIndirect("LDB", low, true);
    if (opcode === 76) return implied("RPIX", true);
    if (opcode === 78) return implied("CMODE");
    if (opcode >= 80 && opcode <= 95) return register("ADC", low, true);
    if (opcode >= 96 && opcode <= 111) return register("SBC", low, true);
    if (opcode >= 113 && opcode <= 127) return register("BIC", low, true);
    if (opcode >= 128 && opcode <= 143) return register("UMULT", low, true);
    if (opcode === 150) return implied("DIV2", true);
    if (opcode >= 152 && opcode <= 157) return register("LJMP", low);
    if (opcode === 159) return implied("LMULT", true);
    if (opcode >= 160 && opcode <= 175) {
      return {
        mnemonic: "LMS",
        encoding: "registerRamShort",
        size: 2,
        register: low
      };
    }
    if (opcode >= 193 && opcode <= 207) return register("XOR", low, true);
    if (opcode === 239) return implied("GETBH", true);
    if (opcode >= 240) {
      return {
        mnemonic: "LM",
        encoding: "registerRamAbsolute",
        size: 3,
        register: low
      };
    }
  }
  if (alt === 2) {
    if (opcode >= 80 && opcode <= 95) return nibble("ADD", low, true);
    if (opcode >= 96 && opcode <= 111) return nibble("SUB", low, true);
    if (opcode >= 113 && opcode <= 127) return nibble("AND", low, true);
    if (opcode >= 128 && opcode <= 143) return nibble("MULT", low, true);
    if (opcode >= 160 && opcode <= 175) {
      return {
        mnemonic: "SMS",
        encoding: "ramShortRegister",
        size: 2,
        register: low
      };
    }
    if (opcode >= 193 && opcode <= 207) return nibble("OR", low, true);
    if (opcode === 223) return implied("RAMB");
    if (opcode === 239) return implied("GETBL", true);
    if (opcode >= 240) {
      return {
        mnemonic: "SM",
        encoding: "ramAbsoluteRegister",
        size: 3,
        register: low
      };
    }
  }
  if (alt === 3) {
    if (opcode >= 80 && opcode <= 95) return nibble("ADC", low, true);
    if (opcode >= 96 && opcode <= 111) return register("CMP", low);
    if (opcode >= 113 && opcode <= 127) return nibble("BIC", low, true);
    if (opcode >= 128 && opcode <= 143) return nibble("UMULT", low, true);
    if (opcode >= 193 && opcode <= 207) return nibble("XOR", low, true);
    if (opcode === 223) return implied("ROMB");
    if (opcode === 239) return implied("GETBS", true);
  }
  return baseDefinition(opcode);
};
var flowFor3 = (definition, opcode) => {
  if (definition.mnemonic === "STOP") return { kind: "stop", fallthrough: false };
  if (definition.mnemonic === "BRA") return { kind: "jump", fallthrough: false };
  if (opcode >= 6 && opcode <= 15) return { kind: "conditionalBranch", fallthrough: true };
  if (definition.mnemonic === "LOOP")
    return { kind: "conditionalBranch", fallthrough: true, indirect: true };
  if (definition.mnemonic === "JMP" || definition.mnemonic === "LJMP")
    return { kind: "jump", fallthrough: false, indirect: true };
  return { kind: "fallthrough", fallthrough: true };
};
var effectsFor = (definition) => {
  if (definition.mnemonic === "ALT1" || definition.mnemonic === "ALT2" || definition.mnemonic === "ALT3") {
    return [
      {
        kind: "custom",
        name: "set-superfx-alt",
        details: { alt: Number(definition.mnemonic.at(-1)) }
      }
    ];
  }
  if (definition.mnemonic === "TO") {
    return [
      {
        kind: "custom",
        name: "select-superfx-destination",
        details: { register: definition.register }
      }
    ];
  }
  if (definition.mnemonic === "WITH") {
    return [
      {
        kind: "custom",
        name: "select-superfx-source-destination",
        details: { register: definition.register }
      }
    ];
  }
  if (definition.mnemonic === "FROM") {
    return [
      { kind: "custom", name: "select-superfx-source", details: { register: definition.register } }
    ];
  }
  return [];
};
var summaryFor = (mnemonic) => {
  const summaries3 = {
    STOP: "Stop the GSU.",
    NOP: "No operation.",
    CACHE: "Set the cache base register.",
    BRA: "Branch always.",
    BGE: "Branch if greater or equal.",
    BLT: "Branch if less than.",
    BNE: "Branch if not equal.",
    BEQ: "Branch if equal.",
    BPL: "Branch if plus.",
    BMI: "Branch if minus.",
    BCC: "Branch if carry clear.",
    BCS: "Branch if carry set.",
    BVC: "Branch if overflow clear.",
    BVS: "Branch if overflow set.",
    JMP: "Jump through a register.",
    LJMP: "Long jump through a register.",
    IWT: "Load a register with a word.",
    IBT: "Load a register with a signed byte.",
    LM: "Load a register from RAM.",
    LMS: "Load a register from short RAM.",
    SM: "Store a register to RAM.",
    SMS: "Store a register to short RAM."
  };
  return summaries3[mnemonic] ?? `${mnemonic} instruction.`;
};
var specification = (alt, opcode) => {
  const definition = altDefinition(alt, opcode);
  const base = baseDefinition(opcode);
  const alteredByAlt = alt !== 0 && (definition.mnemonic !== base.mnemonic || definition.encoding !== base.encoding);
  return Object.freeze({
    id: `snes.superfx.alt${alt}.${opcode.toString(16).padStart(2, "0")}`,
    architecture: "snes.superfx",
    opcode: [opcode],
    mnemonic: definition.mnemonic,
    mode: definition.encoding,
    syntax: syntaxFor(definition.encoding),
    operandEncoding: definition.encoding,
    minimumSize: definition.size,
    maximumSize: definition.size,
    alt,
    ...definition.register === void 0 ? {} : { register: definition.register },
    summary: summaryFor(definition.mnemonic),
    flow: flowFor3(definition, opcode),
    effects: effectsFor(definition),
    ...definition.writesDestination ? { writesDestination: true } : {},
    alteredByAlt
  });
};
var superFxOpcodeMatrix = Object.freeze(
  [0, 1, 2, 3].map(
    (alt) => Object.freeze(Array.from({ length: 256 }, (_, opcode) => specification(alt, opcode)))
  )
);
var superFxBaseSpecifications = superFxOpcodeMatrix[0];
var superFxSpecifications = Object.freeze([
  ...superFxBaseSpecifications,
  ...superFxOpcodeMatrix.slice(1).flatMap((row) => row.filter((entry) => entry.alteredByAlt))
]);
var fusedFlow = (destinationRegister) => destinationRegister === 15 ? { kind: "jump", fallthrough: false, indirect: true } : { kind: "fallthrough", fallthrough: true };
var fusedSyntax = (mode3) => {
  if (mode3 === "registerRegister") return "Rn,Rm";
  if (mode3 === "registerRegisterIndirect") return "Rn,(Rm)";
  return "(Rn),Rm";
};
var fused = (mnemonic, opcode, mode3, destinationRegister, sourceRegister, pointerRegister) => Object.freeze({
  id: `snes.superfx.fused.${opcode.map((value) => value.toString(16).padStart(2, "0")).join("-")}`,
  architecture: "snes.superfx",
  opcode,
  mnemonic,
  mode: mode3,
  syntax: fusedSyntax(mode3),
  minimumSize: opcode.length,
  maximumSize: opcode.length,
  destinationRegister,
  ...sourceRegister === void 0 ? {} : { sourceRegister },
  ...pointerRegister === void 0 ? {} : { pointerRegister },
  summary: `${mnemonic} fused selector form.`,
  flow: fusedFlow(destinationRegister),
  effects: []
});
var superFxFusedSpecifications = Object.freeze([
  ...Array.from(
    { length: 16 },
    (_, source) => Array.from(
      { length: 16 },
      (_2, destination) => fused("MOVE", [32 + source, 16 + destination], "registerRegister", destination, source)
    )
  ).flat(),
  ...Array.from(
    { length: 16 },
    (_, destination) => Array.from(
      { length: 16 },
      (_2, source) => fused(
        "MOVES",
        [32 + destination, 176 + source],
        "registerRegister",
        destination,
        source
      )
    )
  ).flat(),
  ...Array.from({ length: 15 }, (_, index) => index + 1).flatMap(
    (destination) => Array.from({ length: 12 }, (_, pointer) => [
      fused(
        "MOVEW",
        [16 + destination, 64 + pointer],
        "registerRegisterIndirect",
        destination,
        void 0,
        pointer
      ),
      fused(
        "MOVEB",
        [16 + destination, 61, 64 + pointer],
        "registerRegisterIndirect",
        destination,
        void 0,
        pointer
      )
    ]).flat()
  ),
  ...Array.from({ length: 15 }, (_, index) => index + 1).flatMap(
    (source) => Array.from({ length: 12 }, (_, pointer) => [
      fused(
        "MOVEW",
        [176 + source, 48 + pointer],
        "registerIndirectRegister",
        0,
        source,
        pointer
      ),
      fused(
        "MOVEB",
        [176 + source, 61, 48 + pointer],
        "registerIndirectRegister",
        0,
        source,
        pointer
      )
    ]).flat()
  )
]);

// packages/plugin-snes/src/architectures/65816-decoder.ts
var flagValue = (value) => {
  if (value === true || value === 1) return 1;
  if (value === false || value === 0) return 0;
  return "unknown";
};
var resolvedWidthFlag = (state, flag) => {
  const emulation = flagValue(state.e);
  if (emulation === 1) return 1;
  const width = flagValue(state[flag]);
  if (width === 1) return 1;
  if (width === 0 && emulation === 0) return 0;
  return "unknown";
};
var readLittleEndian = (bytes, offset, width) => {
  let value = 0;
  for (let index = 0; index < width; index++) value |= (bytes[offset + index] ?? 0) << index * 8;
  return value >>> 0;
};
var signed = (value, width) => {
  const signBit = 1 << width * 8 - 1;
  const modulus = 2 ** (width * 8);
  return value & signBit ? value - modulus : value;
};
var bankLocalTarget = (logicalAddress, size, displacement) => logicalAddress & 16711680 | logicalAddress + size + displacement & 65535;
var addressOperand = (value, width) => ({
  kind: "address",
  value,
  width
});
var operandsFor = (specification2, bytes, logicalAddress) => {
  const value8 = bytes[1] ?? 0;
  const value16 = readLittleEndian(bytes, 1, 2);
  const value24 = readLittleEndian(bytes, 1, 3);
  switch (specification2.mode) {
    case "implied":
      return [];
    case "accumulator":
      return [{ kind: "accumulator", register: "a" }];
    case "signature":
      return [{ kind: "signature", value: value8, width: 1 }];
    case "immediate":
      return [
        {
          kind: "immediate",
          value: bytes.length === 2 ? value8 : value16,
          width: bytes.length - 1
        }
      ];
    case "immediate16":
      return [{ kind: "immediate", value: value16, width: 2 }];
    case "direct":
    case "directIndexedX":
    case "directIndexedY":
    case "directIndirect":
    case "directIndirectLong":
    case "directIndexedXIndirect":
    case "directIndirectIndexedY":
    case "directIndirectLongIndexedY":
    case "stackRelative":
    case "stackRelativeIndirectIndexedY":
      return [addressOperand(value8, 1)];
    case "absolute":
    case "absoluteIndexedX":
    case "absoluteIndexedY":
    case "absoluteIndirect":
    case "absoluteIndexedXIndirect":
    case "absoluteIndirectLong":
      return [addressOperand(value16, 2)];
    case "absoluteLong":
    case "absoluteLongIndexedX":
      return [addressOperand(value24, 3)];
    case "relative": {
      const displacement = signed(value8, 1);
      return [
        {
          kind: "displacement",
          value: displacement,
          width: 1,
          signed: true,
          targetAddress: bankLocalTarget(logicalAddress, bytes.length, displacement)
        }
      ];
    }
    case "relativeLong": {
      const displacement = signed(value16, 2);
      return [
        {
          kind: "displacement",
          value: displacement,
          width: 2,
          signed: true,
          targetAddress: bankLocalTarget(logicalAddress, bytes.length, displacement)
        }
      ];
    }
    case "blockMove":
      return [
        { kind: "bank", value: value8, width: 1 },
        { kind: "bank", value: bytes[2] ?? 0, width: 1 }
      ];
    default:
      return [];
  }
};
var targetFor = (specification2, operands, state, logicalAddress) => {
  const operand = operands[0];
  if (!operand) return void 0;
  if (operand.targetAddress !== void 0) return operand.targetAddress;
  if (operand.value === void 0) return void 0;
  if (specification2.mode === "absoluteLong") return operand.value;
  if (specification2.mode === "absolute") {
    const bank = (state.programBank ?? logicalAddress >>> 16) & 255;
    return bank << 16 | operand.value;
  }
  return void 0;
};
var referencesFor = (specification2, operands, state, logicalAddress) => {
  const { mnemonic, mode: mode3 } = specification2;
  const isBranch = conditionalBranches.has(mnemonic) || mnemonic === "BRA" || mnemonic === "BRL";
  const isCall = mnemonic === "JSR" || mnemonic === "JSL";
  const isJump = mnemonic === "JMP" || mnemonic === "JML";
  if (isBranch || isCall || isJump) {
    const target = targetFor(specification2, operands, state, logicalAddress);
    let kind = "jump";
    if (isBranch) kind = "branch";
    else if (isCall) kind = "call";
    return [
      {
        kind,
        operandIndex: 0,
        ...target === void 0 ? {} : { address: target },
        ...mode3.includes("Indirect") ? { indirect: true } : {}
      }
    ];
  }
  if (mode3.includes("Indirect")) {
    const value = operands[0]?.value;
    return [
      {
        kind: "pointer",
        operandIndex: 0,
        ...value === void 0 ? {} : { address: value },
        indirect: true
      }
    ];
  }
  const memoryMode = mode3.startsWith("direct") || mode3.startsWith("absolute") || mode3.startsWith("stackRelative");
  if (!memoryMode || operands[0]?.value === void 0) return [];
  if (mode3.startsWith("direct")) {
    return [
      {
        kind: "data",
        operandIndex: 0,
        ...state.directPage === void 0 ? {} : { address: state.directPage + operands[0].value & 65535 }
      }
    ];
  }
  if (!mode3.startsWith("absoluteLong") && mode3.startsWith("absolute")) {
    return [
      {
        kind: "data",
        operandIndex: 0,
        ...state.dataBank === void 0 ? {} : { address: (state.dataBank & 255) << 16 | operands[0].value }
      }
    ];
  }
  return [{ kind: "data", operandIndex: 0, address: operands[0].value }];
};
var effectsFor2 = (specification2, operands) => {
  const mask = operands[0]?.value;
  if (specification2.operandStatusEffect && mask !== void 0) {
    return [{ kind: specification2.operandStatusEffect, target: "p", mask }];
  }
  return specification2.effects;
};
var buildInstruction = (specification2, bytes, context, state) => {
  const operands = operandsFor(specification2, bytes, context.logicalAddress);
  return {
    architecture: "snes.65816",
    specificationId: specification2.id,
    opcode: specification2.opcode[0],
    mnemonic: specification2.mnemonic,
    mode: specification2.mode,
    offset: context.offset,
    logicalAddress: context.logicalAddress & 16777215,
    bytes,
    size: bytes.length,
    operands,
    references: referencesFor(specification2, operands, state, context.logicalAddress),
    flow: specification2.flow,
    effects: effectsFor2(specification2, operands)
  };
};
var Cpu65816Decoder = class {
  /**
   * Decodes a 65816 instruction.
   * @param {ArchitectureDecodeContext<Cpu65816DecodeState>} context The decode context.
   * @returns {ArchitectureDecodeResult} The decode result.
   */
  decode(context) {
    const availableBytes = Number.isInteger(context.offset) && context.offset >= 0 ? Math.max(0, context.source.length - context.offset) : 0;
    const opcode = context.source.readByte(context.offset);
    if (opcode === void 0) {
      return {
        kind: "error",
        code: "outOfBounds",
        message: `Cannot read a 65816 opcode at offset ${context.offset}.`,
        offset: context.offset,
        requiredBytes: 1,
        availableBytes
      };
    }
    const specification2 = cpu65816Specifications[opcode];
    if (!specification2) {
      return {
        kind: "error",
        code: "invalidOpcode",
        message: `Unknown 65816 opcode $${opcode.toString(16).padStart(2, "0")}.`,
        offset: context.offset
      };
    }
    const state = context.state ?? {};
    let sizes = [specification2.minimumSize];
    if (specification2.widthFlag) {
      const width = resolvedWidthFlag(state, specification2.widthFlag);
      sizes = width === "unknown" ? [2, 3] : [width === 1 ? 2 : 3];
    }
    const minimumSize = Math.min(...sizes);
    const maximumSize = Math.max(...sizes);
    if (availableBytes < minimumSize) {
      return {
        kind: "error",
        code: "truncated",
        message: `Truncated ${specification2.mnemonic}: requires at least ${minimumSize} byte(s), ${availableBytes} available.`,
        offset: context.offset,
        requiredBytes: minimumSize,
        availableBytes
      };
    }
    if (sizes.length === 1 && availableBytes < maximumSize) {
      return {
        kind: "error",
        code: "truncated",
        message: `Truncated ${specification2.mnemonic}: requires ${maximumSize} byte(s), ${availableBytes} available.`,
        offset: context.offset,
        requiredBytes: maximumSize,
        availableBytes
      };
    }
    const availableSizes = sizes.filter((size) => size <= availableBytes);
    const alternatives = availableSizes.map((size) => {
      const bytes = context.source.readBytes(context.offset, size);
      if (!bytes) throw new Error("Decoder byte source violated its bounds contract.");
      return buildInstruction(specification2, bytes, context, state);
    });
    if (sizes.length === 2) {
      return {
        kind: "ambiguous",
        reason: `The 65816 ${specification2.widthFlag?.toUpperCase()} flag is unknown.`,
        requiredState: [specification2.widthFlag ?? "m"],
        alternatives,
        ...availableSizes.length === sizes.length ? {} : {
          unavailableAlternatives: sizes.filter((size) => size > availableBytes).map((size) => ({ code: "truncated", size, availableBytes }))
        },
        minimumSize: 2,
        maximumSize: 3
      };
    }
    return { kind: "instruction", instruction: alternatives[0] };
  }
};
var hex = (value, width) => `$${(value >>> 0).toString(16).toUpperCase().padStart(width * 2, "0").slice(-width * 2)}`;
function formatCpu65816Instruction(instruction) {
  if (instruction.architecture !== "snes.65816") {
    throw new Error(`Cannot format architecture '${instruction.architecture}' as 65816.`);
  }
  const operand = instruction.operands[0];
  const value = operand?.value ?? 0;
  let text = "";
  switch (instruction.mode) {
    case "implied":
      break;
    // The project encoder's native accumulator spelling omits the operand.
    case "accumulator":
      break;
    case "signature":
      text = `#${hex(value, 1)}`;
      break;
    case "immediate":
      text = `#${hex(value, operand?.width ?? 1)}`;
      break;
    case "immediate16":
      text = hex(value, 2);
      break;
    case "direct":
      text = hex(value, 1);
      break;
    case "directIndexedX":
      text = `${hex(value, 1)},x`;
      break;
    case "directIndexedY":
      text = `${hex(value, 1)},y`;
      break;
    case "directIndirect":
      text = instruction.mnemonic === "PEI" ? hex(value, 1) : `(${hex(value, 1)})`;
      break;
    case "directIndirectLong":
      text = `[${hex(value, 1)}]`;
      break;
    case "directIndexedXIndirect":
      text = `(${hex(value, 1)},x)`;
      break;
    case "directIndirectIndexedY":
      text = `(${hex(value, 1)}),y`;
      break;
    case "directIndirectLongIndexedY":
      text = `[${hex(value, 1)}],y`;
      break;
    case "stackRelative":
      text = `${hex(value, 1)},s`;
      break;
    case "stackRelativeIndirectIndexedY":
      text = `(${hex(value, 1)},s),y`;
      break;
    case "absolute":
      text = hex(value, 2);
      break;
    case "absoluteIndexedX":
      text = `${hex(value, 2)},x`;
      break;
    case "absoluteIndexedY":
      text = `${hex(value, 2)},y`;
      break;
    case "absoluteLong":
      text = hex(value, 3);
      break;
    case "absoluteLongIndexedX":
      text = `${hex(value, 3)},x`;
      break;
    case "absoluteIndirect":
      text = `(${hex(value, 2)})`;
      break;
    case "absoluteIndexedXIndirect":
      text = `(${hex(value, 2)},x)`;
      break;
    case "absoluteIndirectLong":
      text = `[${hex(value, 2)}]`;
      break;
    case "relative":
      text = hex(operand?.targetAddress ?? 0, 3);
      break;
    case "relativeLong":
      text = instruction.mnemonic === "PER" ? hex(value, 2) : hex(operand?.targetAddress ?? 0, 3);
      break;
    case "blockMove":
      text = `${hex(instruction.operands[0]?.value ?? 0, 1)},${hex(instruction.operands[1]?.value ?? 0, 1)}`;
      break;
    default:
      throw new Error(`Unsupported 65816 formatter mode '${instruction.mode}'.`);
  }
  return text ? `${instruction.mnemonic} ${text}` : instruction.mnemonic;
}

// packages/plugin-snes/src/architectures/spc700-decoder.ts
var readLittleEndian2 = (bytes, offset, width) => {
  let value = 0;
  for (let index = 0; index < width; index++) value |= (bytes[offset + index] ?? 0) << index * 8;
  return value >>> 0;
};
var signedByte = (value) => value & 128 ? value - 256 : value;
var register2 = (name) => ({ kind: "register", register: name });
var address2 = (value, width) => ({
  kind: "address",
  value,
  width
});
var immediate = (value) => ({ kind: "immediate", value, width: 1 });
var bit = (value) => ({ kind: "bit", value, width: 1 });
var relative = (value, logicalAddress, size) => ({
  kind: "displacement",
  value: signedByte(value),
  width: 1,
  signed: true,
  targetAddress: logicalAddress + size + signedByte(value) & 65535
});
var bitAddress = (bytes) => {
  const encoded = readLittleEndian2(bytes, 1, 2);
  return [address2(encoded & 8191, 2), bit(encoded >>> 13)];
};
var fixedRegisters = {
  registerA: ["A"],
  registerX: ["X"],
  registerY: ["Y"],
  registerP: ["P"],
  registerYA: ["YA"],
  registerYAX: ["YA", "X"],
  registerXA: ["X", "A"],
  registerAX: ["A", "X"],
  registerXSP: ["X", "SP"],
  registerSPX: ["SP", "X"],
  registerAY: ["A", "Y"],
  registerYA2: ["Y", "A"],
  registerPostIncrementXA: ["X", "A"],
  registerAPostIncrementX: ["A", "X"],
  registerIndirectXA: ["X", "A"],
  registerAIndirectX: ["A", "X"],
  indirectXY: ["X", "Y"]
};
var operandsFor2 = (specification2, bytes, logicalAddress) => {
  const byte = bytes[1] ?? 0;
  const word2 = readLittleEndian2(bytes, 1, 2);
  const fixed = fixedRegisters[specification2.mode];
  if (fixed) return fixed.map(register2);
  switch (specification2.mode) {
    case "implied":
      return [];
    case "tableCall":
      return [immediate(specification2.opcode[0] >>> 4)];
    case "directBit":
      return [address2(byte, 1), bit(Number(specification2.mnemonic.at(-1)))];
    case "directBitRelative":
      return [
        address2(byte, 1),
        bit(Number(specification2.mnemonic.at(-1))),
        relative(bytes[2] ?? 0, logicalAddress, bytes.length)
      ];
    case "accumulatorDirect":
    case "accumulatorDirectIndexedX":
    case "accumulatorDirectIndexedXIndirect":
    case "accumulatorDirectIndirectIndexedY":
      return [register2("A"), address2(byte, 1)];
    case "accumulatorAbsolute":
    case "accumulatorAbsoluteIndexedX":
    case "accumulatorAbsoluteIndexedY":
      return [register2("A"), address2(word2, 2)];
    case "accumulatorIndirectX":
      return [register2("A"), register2("X")];
    case "accumulatorImmediate":
      return [register2("A"), immediate(byte)];
    case "directDirect":
      return [address2(bytes[2] ?? 0, 1), address2(byte, 1)];
    case "carryMemoryBit":
    case "carryInvertedMemoryBit": {
      const [memory, bit2] = bitAddress(bytes);
      return [register2("C"), memory, bit2];
    }
    case "memoryBitCarry": {
      const [memory, bit2] = bitAddress(bytes);
      return [memory, bit2, register2("C")];
    }
    case "memoryBit":
      return bitAddress(bytes);
    case "direct":
    case "directIndexedX":
    case "directWord":
      return [address2(byte, 1)];
    case "absolute":
    case "absoluteIndexedXIndirect":
      return [address2(word2, 2)];
    case "relative":
      return [relative(byte, logicalAddress, bytes.length)];
    case "absoluteAccumulator":
      return [address2(word2, 2), register2("A")];
    case "directImmediate":
      return [address2(bytes[2] ?? 0, 1), immediate(byte)];
    case "registerXAbsolute":
      return [register2("X"), address2(word2, 2)];
    case "registerXDirect":
    case "registerXDirectIndexedY":
      return [register2("X"), address2(byte, 1)];
    case "registerYAbsolute":
      return [register2("Y"), address2(word2, 2)];
    case "registerYDirect":
    case "registerYDirectIndexedX":
      return [register2("Y"), address2(byte, 1)];
    case "registerXImmediate":
      return [register2("X"), immediate(byte)];
    case "registerYImmediate":
      return [register2("Y"), immediate(byte)];
    case "directRelative":
    case "directIndexedXRelative":
      return [address2(byte, 1), relative(bytes[2] ?? 0, logicalAddress, bytes.length)];
    case "registerYRelative":
      return [register2("Y"), relative(byte, logicalAddress, bytes.length)];
    case "registerYADirect":
      return [register2("YA"), address2(byte, 1)];
    case "directRegisterYA":
      return [address2(byte, 1), register2("YA")];
    case "upperPageCall":
      return [address2(65280 | byte, 2)];
    case "directRegisterA":
    case "directIndexedXRegisterA":
    case "directIndirectIndexedYRegisterA":
    case "directIndexedXIndirectRegisterA":
      return [address2(byte, 1), register2("A")];
    case "absoluteRegisterA":
    case "absoluteIndexedXRegisterA":
    case "absoluteIndexedYRegisterA":
      return [address2(word2, 2), register2("A")];
    case "indirectXRegisterA":
      return [register2("X"), register2("A")];
    case "directRegisterX":
    case "directIndexedYRegisterX":
      return [address2(byte, 1), register2("X")];
    case "absoluteRegisterX":
      return [address2(word2, 2), register2("X")];
    case "directRegisterY":
    case "directIndexedXRegisterY":
      return [address2(byte, 1), register2("Y")];
    case "absoluteRegisterY":
      return [address2(word2, 2), register2("Y")];
    default:
      throw new Error(`Unhandled SPC700 decode mode '${specification2.mode}'.`);
  }
};
var referencesFor2 = (specification2, operands, state) => {
  const references = [];
  const branchIndex = operands.findIndex((operand) => operand.targetAddress !== void 0);
  if (branchIndex >= 0) {
    references.push({
      kind: "branch",
      operandIndex: branchIndex,
      address: operands[branchIndex].targetAddress
    });
  } else if (specification2.mnemonic === "TCALL") {
    const vector = 65502 - (specification2.opcode[0] >>> 4) * 2;
    references.push({ kind: "call", operandIndex: 0, indirect: true });
    references.push({ kind: "pointer", operandIndex: 0, address: vector, indirect: true });
  } else if (specification2.mnemonic === "PCALL") {
    references.push({ kind: "call", operandIndex: 0, address: operands[0]?.value });
  } else if (specification2.mnemonic === "CALL" || specification2.mnemonic === "JMP") {
    if (specification2.flow.indirect) {
      references.push({ kind: "jump", operandIndex: 0, indirect: true });
      references.push({
        kind: "pointer",
        operandIndex: 0,
        address: operands[0]?.value,
        indirect: true
      });
    } else {
      references.push({
        kind: specification2.mnemonic === "CALL" ? "call" : "jump",
        operandIndex: 0,
        address: operands[0]?.value
      });
    }
  }
  for (let index = 0; index < operands.length; index++) {
    const operand = operands[index];
    if (operand.kind !== "address" || operand.value === void 0) continue;
    if (references.some((reference) => reference.operandIndex === index)) continue;
    const isDirect = operand.width === 1;
    let resolved = operand.value;
    if (isDirect) {
      resolved = state.directPage === void 0 || state.directPage === "unknown" ? void 0 : state.directPage + operand.value & 65535;
    }
    references.push({
      kind: specification2.mode.includes("Indirect") ? "pointer" : "data",
      operandIndex: index,
      ...resolved === void 0 ? {} : { address: resolved },
      ...specification2.mode.includes("Indirect") ? { indirect: true } : {}
    });
  }
  return references;
};
var buildInstruction2 = (specification2, bytes, context) => {
  const operands = operandsFor2(specification2, bytes, context.logicalAddress);
  return {
    architecture: "snes.spc700",
    specificationId: specification2.id,
    opcode: specification2.opcode[0],
    mnemonic: specification2.mnemonic,
    mode: specification2.mode,
    offset: context.offset,
    logicalAddress: context.logicalAddress & 65535,
    bytes,
    size: bytes.length,
    operands,
    references: referencesFor2(specification2, operands, context.state ?? {}),
    flow: specification2.flow,
    effects: specification2.effects
  };
};
var Spc700Decoder = class {
  decode(context) {
    const availableBytes = Number.isInteger(context.offset) && context.offset >= 0 ? Math.max(0, context.source.length - context.offset) : 0;
    const opcode = context.source.readByte(context.offset);
    if (opcode === void 0) {
      return {
        kind: "error",
        code: "outOfBounds",
        message: `Cannot read an SPC700 opcode at offset ${context.offset}.`,
        offset: context.offset,
        requiredBytes: 1,
        availableBytes
      };
    }
    const specification2 = spc700Specifications[opcode];
    if (!specification2) {
      return {
        kind: "error",
        code: "invalidOpcode",
        message: `Unknown SPC700 opcode $${opcode.toString(16).padStart(2, "0")}.`,
        offset: context.offset
      };
    }
    const size = specification2.minimumSize;
    if (availableBytes < size) {
      return {
        kind: "error",
        code: "truncated",
        message: `Truncated ${specification2.mnemonic}: requires ${size} byte(s), ${availableBytes} available.`,
        offset: context.offset,
        requiredBytes: size,
        availableBytes
      };
    }
    const bytes = context.source.readBytes(context.offset, size);
    if (!bytes) throw new Error("Decoder byte source violated its bounds contract.");
    return { kind: "instruction", instruction: buildInstruction2(specification2, bytes, context) };
  }
};
var hex2 = (value, width) => `$${(value >>> 0).toString(16).toUpperCase().padStart(width * 2, "0").slice(-width * 2)}`;
var formatOperands = (instruction) => {
  const values = instruction.operands.map((operand) => operand.value ?? 0);
  const target = instruction.operands.find(
    (operand) => operand.targetAddress !== void 0
  )?.targetAddress;
  const dp = () => hex2(values.find((_, index) => instruction.operands[index].kind === "address") ?? 0, 1);
  const abs = () => hex2(values.find((_, index) => instruction.operands[index].kind === "address") ?? 0, 2);
  const bit2 = () => values.find((_, index) => instruction.operands[index].kind === "bit") ?? 0;
  const relativeTarget = () => hex2(target ?? 0, 2);
  switch (instruction.mode) {
    case "implied":
      return "";
    case "tableCall":
      return String(values[0]);
    case "directBit":
      return dp();
    case "directBitRelative":
      return `${dp()},${relativeTarget()}`;
    case "accumulatorDirect":
      return `A,${dp()}`;
    case "accumulatorAbsolute":
      return `A,${abs()}`;
    case "accumulatorIndirectX":
    case "registerAIndirectX":
      return "A,(X)";
    case "accumulatorDirectIndexedXIndirect":
      return `A,(${dp()}+X)`;
    case "accumulatorImmediate":
      return `A,#${hex2(values[1], 1)}`;
    case "directDirect":
      return `${hex2(values[0], 1)},${hex2(values[1], 1)}`;
    case "carryMemoryBit":
      return `C,${abs()}.${bit2()}`;
    case "carryInvertedMemoryBit":
      return `C,/${abs()}.${bit2()}`;
    case "memoryBitCarry":
      return `${abs()}.${bit2()},C`;
    case "memoryBit":
      return `${abs()}.${bit2()}`;
    case "direct":
    case "directWord":
      return dp();
    case "directIndexedX":
      return `${dp()}+X`;
    case "absolute":
      return abs();
    case "relative":
      return relativeTarget();
    case "absoluteAccumulator":
      return `${abs()},A`;
    case "accumulatorDirectIndexedX":
      return `A,${dp()}+X`;
    case "accumulatorAbsoluteIndexedX":
      return `A,${abs()}+X`;
    case "accumulatorAbsoluteIndexedY":
      return `A,${abs()}+Y`;
    case "accumulatorDirectIndirectIndexedY":
      return `A,(${dp()})+Y`;
    case "directImmediate":
      return `${hex2(values[0], 1)},#${hex2(values[1], 1)}`;
    case "indirectXY":
      return "(X),(Y)";
    case "registerXAbsolute":
      return `X,${abs()}`;
    case "registerXDirect":
      return `X,${dp()}`;
    case "registerXDirectIndexedY":
      return `X,${dp()}+Y`;
    case "registerYAbsolute":
      return `Y,${abs()}`;
    case "registerYDirect":
      return `Y,${dp()}`;
    case "registerYDirectIndexedX":
      return `Y,${dp()}+X`;
    case "registerXImmediate":
      return `X,#${hex2(values[1], 1)}`;
    case "registerYImmediate":
      return `Y,#${hex2(values[1], 1)}`;
    case "absoluteIndexedXIndirect":
      return `(${abs()}+X)`;
    case "directRelative":
      return `${hex2(values[0], 1)},${relativeTarget()}`;
    case "directIndexedXRelative":
      return `${hex2(values[0], 1)}+X,${relativeTarget()}`;
    case "registerYRelative":
      return `Y,${relativeTarget()}`;
    case "registerYADirect":
      return `YA,${dp()}`;
    case "directRegisterYA":
      return `${dp()},YA`;
    case "upperPageCall":
      return hex2(values[0] & 255, 1);
    case "directRegisterA":
      return `${dp()},A`;
    case "absoluteRegisterA":
      return `${abs()},A`;
    case "indirectXRegisterA":
      return "(X),A";
    case "directIndexedXIndirectRegisterA":
      return `(${dp()}+X),A`;
    case "directIndexedXRegisterA":
      return `${dp()}+X,A`;
    case "absoluteIndexedXRegisterA":
      return `${abs()}+X,A`;
    case "absoluteIndexedYRegisterA":
      return `${abs()}+Y,A`;
    case "directIndirectIndexedYRegisterA":
      return `(${dp()})+Y,A`;
    case "directRegisterX":
      return `${dp()},X`;
    case "directIndexedYRegisterX":
      return `${dp()}+Y,X`;
    case "absoluteRegisterX":
      return `${abs()},X`;
    case "directRegisterY":
      return `${dp()},Y`;
    case "directIndexedXRegisterY":
      return `${dp()}+X,Y`;
    case "absoluteRegisterY":
      return `${abs()},Y`;
    default:
      return spc700Specifications[instruction.opcode]?.syntax ?? "";
  }
};
function formatSpc700Instruction(instruction) {
  if (instruction.architecture !== "snes.spc700") {
    throw new Error(`Cannot format architecture '${instruction.architecture}' as SPC700.`);
  }
  const operands = formatOperands(instruction);
  return operands === "" ? instruction.mnemonic : `${instruction.mnemonic} ${operands}`;
}

// packages/plugin-snes/src/architectures/superfx-decoder.ts
var signedByte2 = (value) => value & 128 ? value - 256 : value;
var word = (bytes, offset) => (bytes[offset] ?? 0) | (bytes[offset + 1] ?? 0) << 8;
var register3 = (value) => ({ kind: "register", register: `R${value}` });
var immediate2 = (value, width, signed2 = false) => ({
  kind: "immediate",
  value,
  width,
  ...signed2 ? { signed: true } : {}
});
var address3 = (value, width) => ({
  kind: "address",
  value,
  width
});
var operandsFor3 = (specification2, bytes, prefixLength, logicalAddress) => {
  const operandOffset = prefixLength + 1;
  const registerNumber = specification2.register ?? 0;
  switch (specification2.operandEncoding) {
    case "implied":
      return [];
    case "relative": {
      const raw = bytes[operandOffset] ?? 0;
      const displacement = signedByte2(raw);
      return [
        {
          kind: "displacement",
          value: displacement,
          width: 1,
          signed: true,
          targetAddress: logicalAddress & 16711680 | logicalAddress + bytes.length + displacement & 65535
        }
      ];
    }
    case "register":
    case "registerIndirect":
      return [register3(registerNumber)];
    case "immediateNibble":
      return [immediate2(registerNumber, 1)];
    case "registerImmediate8":
      return [register3(registerNumber), immediate2(bytes[operandOffset] ?? 0, 1, true)];
    case "registerImmediate16":
      return [register3(registerNumber), immediate2(word(bytes, operandOffset), 2)];
    case "registerRamShort":
      return [register3(registerNumber), address3((bytes[operandOffset] ?? 0) << 1, 2)];
    case "ramShortRegister":
      return [address3((bytes[operandOffset] ?? 0) << 1, 2), register3(registerNumber)];
    case "registerRamAbsolute":
      return [register3(registerNumber), address3(word(bytes, operandOffset), 2)];
    case "ramAbsoluteRegister":
      return [address3(word(bytes, operandOffset), 2), register3(registerNumber)];
  }
  throw new Error("Unsupported SuperFX operand encoding.");
};
var r15Target = (specification2, operands, state, logicalAddress) => {
  if (specification2.register === 15) {
    if (specification2.mnemonic === "IWT") {
      return (((state.programBank === "unknown" ? logicalAddress >>> 16 : state.programBank) ?? logicalAddress >>> 16) & 255) << 16 | (operands[1]?.value ?? 0);
    }
    if (specification2.mnemonic === "IBT") {
      const raw = operands[1]?.value ?? 0;
      const target = raw & 128 ? 65280 | raw : raw;
      const bank = state.programBank === "unknown" || state.programBank === void 0 ? logicalAddress >>> 16 : state.programBank;
      return (bank & 255) << 16 | target;
    }
    if (specification2.mnemonic === "LM" || specification2.mnemonic === "LMS") return "indirect";
  }
  if (specification2.writesDestination && state.destinationRegister === 15) return "indirect";
  return void 0;
};
var controlsFor = (specification2, operands, state, logicalAddress) => {
  const r15 = r15Target(specification2, operands, state, logicalAddress);
  if (typeof r15 === "number") {
    return {
      flow: { kind: "jump", fallthrough: false },
      references: [{ kind: "jump", operandIndex: 1, address: r15 }]
    };
  }
  if (r15 === "indirect") {
    return {
      flow: { kind: "jump", fallthrough: false, indirect: true },
      references: [{ kind: "jump", indirect: true }]
    };
  }
  if (specification2.mnemonic === "BRA" || specification2.mnemonic.startsWith("B") && specification2.operandEncoding === "relative") {
    return {
      flow: specification2.flow,
      references: [{ kind: "branch", operandIndex: 0, address: operands[0]?.targetAddress }]
    };
  }
  if (specification2.mnemonic === "LOOP") {
    return {
      flow: specification2.flow,
      references: [{ kind: "branch", indirect: true }]
    };
  }
  if (specification2.mnemonic === "JMP" || specification2.mnemonic === "LJMP") {
    return {
      flow: specification2.flow,
      references: [{ kind: "jump", operandIndex: 0, indirect: true }]
    };
  }
  let memoryIndex;
  if (specification2.operandEncoding === "registerRamShort" || specification2.operandEncoding === "registerRamAbsolute") {
    memoryIndex = 1;
  } else if (specification2.operandEncoding === "ramShortRegister" || specification2.operandEncoding === "ramAbsoluteRegister") {
    memoryIndex = 0;
  }
  if (memoryIndex !== void 0) {
    return {
      flow: specification2.flow,
      references: [
        { kind: "data", operandIndex: memoryIndex, address: operands[memoryIndex]?.value }
      ]
    };
  }
  if (specification2.operandEncoding === "registerIndirect") {
    return {
      flow: specification2.flow,
      references: [{ kind: "pointer", operandIndex: 0, indirect: true }]
    };
  }
  return { flow: specification2.flow, references: [] };
};
var buildInstruction3 = (specification2, bytes, context, state, prefixLength) => {
  const operands = operandsFor3(specification2, bytes, prefixLength, context.logicalAddress);
  const controls = controlsFor(specification2, operands, state, context.logicalAddress);
  return {
    architecture: "snes.superfx",
    specificationId: specification2.id,
    opcode: specification2.opcode[0],
    mnemonic: specification2.mnemonic,
    mode: specification2.mode,
    offset: context.offset,
    logicalAddress: context.logicalAddress & 16777215,
    bytes,
    size: bytes.length,
    operands,
    references: controls.references,
    flow: controls.flow,
    effects: specification2.effects
  };
};
var buildFusedInstruction = (specification2, bytes, context) => {
  let operands;
  if (specification2.mode === "registerRegister") {
    operands = [
      register3(specification2.destinationRegister),
      register3(specification2.sourceRegister ?? 0)
    ];
  } else if (specification2.mode === "registerRegisterIndirect") {
    operands = [
      register3(specification2.destinationRegister),
      register3(specification2.pointerRegister ?? 0)
    ];
  } else {
    operands = [
      register3(specification2.sourceRegister ?? 0),
      register3(specification2.pointerRegister ?? 0)
    ];
  }
  return {
    architecture: "snes.superfx",
    specificationId: specification2.id,
    opcode: specification2.opcode.at(-1) ?? specification2.opcode[0],
    mnemonic: specification2.mnemonic,
    mode: specification2.mode,
    offset: context.offset,
    logicalAddress: context.logicalAddress & 16777215,
    bytes,
    size: bytes.length,
    operands,
    references: specification2.flow.kind === "jump" ? [{ kind: "jump", indirect: true }] : [],
    flow: specification2.flow,
    effects: specification2.effects
  };
};
var matchFused = (context) => superFxFusedSpecifications.find(
  (entry) => entry.opcode.every((value, index) => context.source.readByte(context.offset + index) === value)
);
var availableAt = (context) => Number.isInteger(context.offset) && context.offset >= 0 ? Math.max(0, context.source.length - context.offset) : 0;
var truncated = (context, requiredBytes) => ({
  kind: "error",
  code: "truncated",
  message: `SuperFX instruction at offset ${context.offset} needs ${requiredBytes} byte(s).`,
  offset: context.offset,
  requiredBytes,
  availableBytes: availableAt(context)
});
var prefixAlt = (opcode) => opcode >= 61 && opcode <= 63 ? opcode - 60 : void 0;
var SuperFxDecoder = class {
  decode(context) {
    const opcode = context.source.readByte(context.offset);
    if (opcode === void 0) {
      return {
        kind: "error",
        code: "outOfBounds",
        message: `No SuperFX opcode exists at offset ${context.offset}.`,
        offset: context.offset,
        availableBytes: availableAt(context)
      };
    }
    const state = context.state ?? {};
    const requestedAlt = state.alt ?? 0;
    if (requestedAlt !== "unknown" && ![0, 1, 2, 3].includes(requestedAlt)) {
      return {
        kind: "error",
        code: "invalidState",
        message: `Invalid SuperFX ALT state '${requestedAlt}'.`,
        offset: context.offset,
        availableBytes: availableAt(context)
      };
    }
    if (requestedAlt === 0 && (state.destinationRegister === void 0 || state.destinationRegister === 0) && (state.sourceRegister === void 0 || state.sourceRegister === 0)) {
      const fused2 = matchFused(context);
      if (fused2) {
        const bytes2 = context.source.readBytes(context.offset, fused2.minimumSize);
        if (!bytes2) return truncated(context, fused2.minimumSize);
        return { kind: "instruction", instruction: buildFusedInstruction(fused2, bytes2, context) };
      }
    }
    const prefix = prefixAlt(opcode);
    if (prefix !== void 0) {
      const next = context.source.readByte(context.offset + 1);
      const canFuse = requestedAlt === 0 || requestedAlt === "unknown";
      if (next !== void 0 && canFuse && prefixAlt(next) === void 0) {
        const effective = superFxOpcodeMatrix[prefix][next];
        if (effective.alteredByAlt) {
          const required = effective.minimumSize + 1;
          const bytes3 = context.source.readBytes(context.offset, required);
          if (!bytes3) return truncated(context, required);
          return {
            kind: "instruction",
            instruction: buildInstruction3(effective, bytes3, context, { ...state, alt: prefix }, 1)
          };
        }
      }
      const specification3 = superFxOpcodeMatrix[0][opcode];
      const bytes2 = context.source.readBytes(context.offset, 1);
      return {
        kind: "instruction",
        instruction: buildInstruction3(specification3, bytes2, context, state, 0)
      };
    }
    if (requestedAlt === "unknown") {
      const candidates = [0, 1, 2, 3].map((alt2) => superFxOpcodeMatrix[alt2][opcode]);
      const unique = [
        ...new Map(candidates.map((entry) => [`${entry.mnemonic}:${entry.mode}`, entry])).values()
      ];
      if (unique.length > 1) {
        const alternatives = unique.flatMap((entry) => {
          const bytes2 = context.source.readBytes(context.offset, entry.minimumSize);
          return bytes2 ? [buildInstruction3(entry, bytes2, context, { ...state, alt: entry.alt }, 0)] : [];
        });
        return {
          kind: "ambiguous",
          reason: `SuperFX opcode $${opcode.toString(16).toUpperCase().padStart(2, "0")} depends on ALT state.`,
          requiredState: ["alt"],
          alternatives,
          minimumSize: Math.min(...unique.map((entry) => entry.minimumSize)),
          maximumSize: Math.max(...unique.map((entry) => entry.maximumSize)),
          ...alternatives.length === unique.length ? {} : {
            unavailableAlternatives: unique.filter(
              (entry) => context.source.readBytes(context.offset, entry.minimumSize) === void 0
            ).map((entry) => ({
              code: "truncated",
              size: entry.minimumSize,
              availableBytes: availableAt(context)
            }))
          }
        };
      }
    }
    const alt = requestedAlt === "unknown" ? 0 : requestedAlt;
    const specification2 = superFxOpcodeMatrix[alt][opcode];
    const bytes = context.source.readBytes(context.offset, specification2.minimumSize);
    if (!bytes) return truncated(context, specification2.minimumSize);
    return {
      kind: "instruction",
      instruction: buildInstruction3(specification2, bytes, context, state, 0)
    };
  }
};
var hex3 = (value, width) => `$${value.toString(16).toUpperCase().padStart(width * 2, "0")}`;
function formatSuperFxInstruction(instruction) {
  if (instruction.architecture !== "snes.superfx") {
    throw new Error(`Cannot format architecture '${instruction.architecture}' as SuperFX.`);
  }
  const values = instruction.operands.map((operand) => operand.value ?? 0);
  const registers = instruction.operands.map((operand) => operand.register ?? "R0");
  let operands = "";
  switch (instruction.mode) {
    case "relative":
      operands = hex3(instruction.operands[0]?.targetAddress ?? 0, 3);
      break;
    case "register":
      operands = registers[0];
      break;
    case "registerIndirect":
      operands = `(${registers[0]})`;
      break;
    case "immediateNibble":
      operands = `#${values[0]}`;
      break;
    case "registerImmediate8":
      operands = `${registers[0]},#${hex3(values[1], 1)}`;
      break;
    case "registerImmediate16":
      operands = `${registers[0]},#${hex3(values[1], 2)}`;
      break;
    case "registerRegister":
      operands = `${registers[0]},${registers[1]}`;
      break;
    case "registerRegisterIndirect":
      operands = `${registers[0]},(${registers[1]})`;
      break;
    case "registerIndirectRegister":
      operands = `(${registers[0]}),${registers[1]}`;
      break;
    case "registerRamShort":
    case "registerRamAbsolute":
      operands = `${registers[0]},(${hex3(values[1], 2)})`;
      break;
    case "ramShortRegister":
    case "ramAbsoluteRegister":
      operands = `(${hex3(values[0], 2)}),${registers[1]}`;
      break;
  }
  return operands ? `${instruction.mnemonic} ${operands}` : instruction.mnemonic;
}

// packages/plugin-snes/src/disassembler/superfx-state.ts
var known = (value) => ({ kind: "known", value });
var decodeValue = (value) => value.kind === "known" ? value.value : "unknown";
var superFxDecodeState = (state) => ({
  alt: decodeValue(state.alt),
  destinationRegister: decodeValue(state.destinationRegister),
  sourceRegister: decodeValue(state.sourceRegister),
  programBank: decodeValue(state.programBank)
});
var detailNumber = (instruction, name) => {
  const effect = instruction.effects.find(
    (entry) => entry.kind === "custom" && entry.name === name
  );
  if (effect?.kind !== "custom") return void 0;
  const value = effect.details?.register ?? effect.details?.alt;
  return typeof value === "number" ? value : void 0;
};
var transferSuperFxState = (instruction, state) => {
  const alt = detailNumber(instruction, "set-superfx-alt");
  if (alt !== void 0) {
    return {
      ...state,
      alt: state.alt.kind === "known" ? known((state.alt.value | alt) & 3) : state.alt
    };
  }
  const destination = detailNumber(instruction, "select-superfx-destination");
  if (destination !== void 0) return { ...state, destinationRegister: known(destination) };
  const paired = detailNumber(instruction, "select-superfx-source-destination");
  if (paired !== void 0) {
    return {
      ...state,
      destinationRegister: known(paired),
      sourceRegister: known(paired)
    };
  }
  const source = detailNumber(instruction, "select-superfx-source");
  if (source !== void 0) return { ...state, sourceRegister: known(source) };
  return {
    ...state,
    alt: known(0),
    destinationRegister: known(0),
    sourceRegister: known(0)
  };
};

// packages/debug-sidecar-mesence/src/mesen-backend.ts
import { Buffer as Buffer2 } from "node:buffer";

// packages/debug-sidecar-mesence/src/profile.ts
var MESEN_BACKEND_ID = "mesence-debug-server";
var MESEN_NATIVE_PROTOCOL_VERSION = 1;
var MESEN_65816_ARCHITECTURE = "snes.65816";
var MESEN_SPC700_ARCHITECTURE = "snes.spc700";
var MESEN_SUPERFX_ARCHITECTURE = "snes.superfx";
var MESEN_65816_ADDRESS_SPACE = "snes.cpu";
var MESEN_65816_WRAM_ADDRESS_SPACE = "snes.wram";
var MESEN_65816_ROM_ADDRESS_SPACE = "snes.cartridge-rom";
var MESEN_SPC700_ADDRESS_SPACE = "spc.aram";
var MESEN_SUPERFX_ROM_ADDRESS_SPACE = "superfx.rom";
var MESEN_SUPERFX_RAM_ADDRESS_SPACE = "superfx.ram";
var MESEN_NATIVE_MAX_MEMORY_READ = 4096;
var MESEN_CAPABILITIES = Object.freeze({
  pause: true,
  step: true,
  registers: true,
  memory: true,
  stackFrames: true,
  breakpoints: true,
  disassemble: true,
  reconnect: true,
  architectures: Object.freeze([
    Object.freeze({
      architecture: MESEN_65816_ARCHITECTURE,
      addressSpaces: Object.freeze([
        MESEN_65816_ADDRESS_SPACE,
        MESEN_65816_WRAM_ADDRESS_SPACE,
        MESEN_65816_ROM_ADDRESS_SPACE
      ]),
      memorySpaces: Object.freeze([
        Object.freeze({ addressSpace: MESEN_65816_WRAM_ADDRESS_SPACE, sideEffectFree: true }),
        Object.freeze({ addressSpace: MESEN_65816_ROM_ADDRESS_SPACE, sideEffectFree: true })
      ]),
      trace: null,
      pause: true,
      step: true,
      registers: true,
      memory: true,
      stackFrames: true,
      breakpoints: true,
      disassemble: true
    }),
    Object.freeze({
      architecture: MESEN_SPC700_ARCHITECTURE,
      addressSpaces: Object.freeze([MESEN_SPC700_ADDRESS_SPACE]),
      memorySpaces: Object.freeze([
        Object.freeze({ addressSpace: MESEN_SPC700_ADDRESS_SPACE, sideEffectFree: true })
      ]),
      trace: null,
      pause: true,
      step: true,
      registers: true,
      memory: true,
      stackFrames: true,
      breakpoints: false,
      disassemble: true
    }),
    Object.freeze({
      architecture: MESEN_SUPERFX_ARCHITECTURE,
      addressSpaces: Object.freeze([
        MESEN_SUPERFX_ROM_ADDRESS_SPACE,
        MESEN_SUPERFX_RAM_ADDRESS_SPACE
      ]),
      memorySpaces: Object.freeze([
        Object.freeze({ addressSpace: MESEN_SUPERFX_ROM_ADDRESS_SPACE, sideEffectFree: true }),
        Object.freeze({ addressSpace: MESEN_SUPERFX_RAM_ADDRESS_SPACE, sideEffectFree: true })
      ]),
      trace: null,
      pause: true,
      step: true,
      registers: true,
      memory: true,
      stackFrames: true,
      breakpoints: false,
      disassemble: true
    })
  ])
});

// packages/debug-sidecar-mesence/src/mesen-backend.ts
var threads = Object.freeze({
  "65816": Object.freeze({
    id: 1,
    frameId: 1,
    name: "Main CPU",
    architecture: MESEN_65816_ARCHITECTURE,
    processor: "65816"
  }),
  spc700: Object.freeze({
    id: 2,
    frameId: 2,
    name: "Sound CPU",
    architecture: MESEN_SPC700_ARCHITECTURE,
    processor: "spc700"
  }),
  superfx: Object.freeze({
    id: 3,
    frameId: 3,
    name: "Super FX",
    architecture: MESEN_SUPERFX_ARCHITECTURE,
    processor: "superfx"
  })
});
var memorySpaces = Object.freeze({
  [MESEN_65816_ADDRESS_SPACE]: Object.freeze({
    processor: "65816",
    native: "SnesMemory",
    maximumAddress: 16777215
  }),
  [MESEN_65816_WRAM_ADDRESS_SPACE]: Object.freeze({
    processor: "65816",
    native: "SnesWorkRam",
    maximumAddress: 131071
  }),
  [MESEN_65816_ROM_ADDRESS_SPACE]: Object.freeze({
    processor: "65816",
    native: "SnesPrgRom",
    maximumAddress: 16777215
  }),
  [MESEN_SPC700_ADDRESS_SPACE]: Object.freeze({
    processor: "spc700",
    native: "SpcRam",
    maximumAddress: 65535
  }),
  [MESEN_SUPERFX_ROM_ADDRESS_SPACE]: Object.freeze({
    processor: "superfx",
    native: "GsuMemory",
    maximumAddress: 16777215
  }),
  [MESEN_SUPERFX_RAM_ADDRESS_SPACE]: Object.freeze({
    processor: "superfx",
    native: "GsuWorkRam",
    maximumAddress: 16777215
  })
});
var asError2 = (error) => error instanceof Error ? error : new Error(String(error));
var record2 = (value, context) => {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error(`${context} must be an object.`);
  return value;
};
var integer2 = (value, context, maximum = Number.MAX_SAFE_INTEGER) => {
  if (!Number.isSafeInteger(value) || value < 0 || value > maximum)
    throw new Error(`${context} must be an integer between 0 and ${maximum}.`);
  return value;
};
var boolean2 = (value, context) => {
  if (typeof value !== "boolean") throw new Error(`${context} must be a boolean.`);
  return value;
};
var string2 = (value, context) => {
  if (typeof value !== "string") throw new Error(`${context} must be a string.`);
  return value;
};
var processor = (value, context) => {
  const name = string2(value, context);
  if (name !== "65816" && name !== "spc700" && name !== "superfx")
    throw new Error(`${context} is unsupported.`);
  return name;
};
var maximumPc = (cpu) => cpu === "spc700" ? 65535 : 16777215;
var parseHello = (value) => {
  const input = record2(value, "Mesen hello");
  if (integer2(input.protocolVersion, "Mesen native protocol version") !== MESEN_NATIVE_PROTOCOL_VERSION)
    throw new Error(
      `Mesen native protocol version ${String(input.protocolVersion)} is unsupported.`
    );
  if (string2(input.emulator, "Mesen emulator identity") !== "MesenCE")
    throw new Error("Mesen emulator identity is unsupported.");
  if (!Array.isArray(input.processors) || input.processors.length === 0 || input.processors.length > 3)
    throw new Error("Mesen processor list must contain between one and three entries.");
  const available = input.processors.map(
    (entry, index) => processor(entry, `Mesen processor ${index}`)
  );
  if (new Set(available).size !== available.length || !available.includes("65816"))
    throw new Error("Mesen processor list must contain one unique 65816 entry.");
  const maxMemoryRead = integer2(input.maxMemoryRead, "Mesen maximum memory read", 1048576);
  if (maxMemoryRead < 1) throw new Error("Mesen maximum memory read must be positive.");
  return {
    stopped: boolean2(input.stopped, "Mesen stopped state"),
    processors: available,
    maxMemoryRead
  };
};
var parseStatus = (value, expected) => {
  const input = record2(value, "Mesen status");
  const cpu = processor(input.cpu, "Mesen status processor");
  if (cpu !== expected)
    throw new Error(`Mesen status processor '${cpu}' did not match requested '${expected}'.`);
  return {
    stopped: boolean2(input.stopped, "Mesen status stopped state"),
    cpu,
    programCounter: integer2(input.programCounter, "Mesen status program counter", maximumPc(cpu)),
    registers: record2(input.registers, "Mesen status registers")
  };
};
var parseResume = (value, expected) => {
  const input = record2(value, "Mesen resume response");
  const cpu = processor(input.cpu, "Mesen resume processor");
  if (cpu !== expected)
    throw new Error(`Mesen resume processor '${cpu}' did not match requested '${expected}'.`);
  return boolean2(input.stopped, "Mesen resume stopped state");
};
var registerInteger = (registers, name, bits) => integer2(
  registers[name],
  `Mesen register ${name}`,
  bits > 32 ? Number.MAX_SAFE_INTEGER : 2 ** bits - 1
);
var registerHex = (value, bits) => value.toString(16).toUpperCase().padStart(Math.ceil(bits / 4), "0");
var debugRegister = (registers, name, bits, outputName = name) => ({
  name: outputName,
  value: registerHex(registerInteger(registers, name, bits), bits),
  bits,
  group: "CPU"
});
var debugFlag = (registers, nativeName, outputName = nativeName) => ({
  name: outputName,
  value: boolean2(registers[nativeName], `Mesen register ${nativeName}`) ? "1" : "0",
  bits: 1,
  group: "Flags"
});
var delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
var MesenDebugBackend = class {
  protocolVersion = DEBUG_BACKEND_PROTOCOL_VERSION;
  capabilities = MESEN_CAPABILITIES;
  #createClient;
  #terminate;
  #pollIntervalMs;
  #listeners = /* @__PURE__ */ new Set();
  #expectedClose = /* @__PURE__ */ new WeakSet();
  #breakpoints = /* @__PURE__ */ new Map();
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
    integer2(this.#pollIntervalMs, "Mesen status poll interval", 6e4);
    if (this.#pollIntervalMs < 1) throw new Error("Mesen status poll interval must be positive.");
  }
  /** @inheritdoc */
  async connect(options = {}) {
    if (this.#connected) throw new Error("Mesen backend is already connected.");
    if (this.#client) await this.#releaseClient(this.#client);
    const client = await this.#createClient({ reset: options.reset ?? true });
    if (client.closed) throw new Error("Mesen client factory returned a closed client.");
    this.#client = client;
    this.#closeSubscription = client.onClose((error) => this.#clientClosed(client, error));
    try {
      const hello = parseHello(await client.request("hello"));
      this.#availableProcessors = hello.processors;
      this.#maxMemoryRead = hello.maxMemoryRead;
      let stopped = hello.stopped;
      if (options.reset ?? true) stopped = (await this.#statusRequest("reset", "65816")).stopped;
      else if (!stopped) stopped = (await this.#statusRequest("pause", "65816")).stopped;
      if (!stopped) throw new Error("Mesen did not reach a coherent stopped state during connect.");
      this.#connected = true;
      this.#stopped = true;
      this.#emit({ type: "stopped", reason: "entry", threadId: threads["65816"].id });
    } catch (error) {
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
      } catch (error) {
        failure = asError2(error);
      }
    }
    await this.#releaseClient(client).catch((error) => {
      failure ??= asError2(error);
    });
    this.#breakpoints.clear();
    this.#availableProcessors = [];
    this.#stopped = false;
    if (terminate) {
      await this.#terminate().catch((error) => {
        failure ??= asError2(error);
      });
      this.#emit({ type: "terminated", restart: false });
    }
    if (failure) throw failure;
  }
  /** @inheritdoc */
  async pause(threadId) {
    const descriptor = this.#thread(threadId ?? threads["65816"].id);
    if (this.#stopped) return;
    this.#executionEpoch++;
    const status = await this.#statusRequest("pause", descriptor.processor);
    if (!status.stopped) throw new Error("Mesen pause completed without a stopped state.");
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
    parseResume(
      await this.#requireClient().request("resume", { cpu: descriptor.processor }),
      descriptor.processor
    );
    void this.#pollForStop(descriptor, epoch);
  }
  /** @inheritdoc */
  async step(threadId, _kind) {
    const descriptor = this.#thread(threadId);
    this.#requireStopped();
    this.#stopped = false;
    const epoch = ++this.#executionEpoch;
    this.#emit({ type: "continued", threadId: descriptor.id, allThreads: true });
    const status = await this.#statusRequest("step", descriptor.processor);
    if (!status.stopped) throw new Error("Mesen instruction step completed without stopping.");
    if (epoch !== this.#executionEpoch) return;
    this.#stopped = true;
    this.#emit({ type: "stopped", reason: "step", threadId: descriptor.id });
  }
  /** @inheritdoc */
  threads() {
    this.#requireConnected();
    return Promise.resolve(
      this.#availableProcessors.map((cpu) => {
        const descriptor = threads[cpu];
        return { id: descriptor.id, name: descriptor.name, architecture: descriptor.architecture };
      })
    );
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
        pc: this.#executionAddress(descriptor.processor, status.programCounter)
      }
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
          group: "CPU"
        },
        debugRegister(values, "K", 8, "PB"),
        debugRegister(values, "DBR", 8, "DB"),
        debugRegister(values, "PS", 8, "P"),
        {
          name: "E",
          value: boolean2(values.emulationMode, "Mesen register emulationMode") ? "1" : "0",
          bits: 1,
          group: "CPU"
        },
        debugRegister(values, "cycleCount", 64, "Cycle")
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
          group: "CPU"
        },
        debugRegister(values, "PS", 8, "P"),
        debugRegister(values, "cycle", 64, "Cycle")
      ];
    }
    const registerArray = values.R;
    if (!Array.isArray(registerArray) || registerArray.length !== 16)
      throw new Error("Mesen Super FX register array must contain 16 entries.");
    const sfr = record2(values.SFR, "Mesen Super FX status register");
    const generalRegisters = registerArray.map((value, index) => ({
      name: `R${index}`,
      value: registerHex(integer2(value, `Mesen register R${index}`, 65535), 16),
      bits: 16,
      group: "CPU"
    }));
    return [
      ...generalRegisters,
      {
        name: "PC",
        value: registerHex(status.programCounter, 24),
        bits: 24,
        group: "CPU"
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
      debugRegister(values, "cycleCount", 64, "Cycle")
    ];
  }
  /** @inheritdoc */
  async readMemory(address4, count) {
    const descriptor = this.#checkedMemoryAddress(address4, false);
    integer2(count, "Mesen memory count", 1048576);
    if (count === 0)
      return { address: { ...address4 }, bytes: new Uint8Array(), unreadableBytes: 0 };
    const bytes = await this.#readNativeMemory(descriptor, address4.address, count);
    return { address: { ...address4 }, bytes, unreadableBytes: count - bytes.length };
  }
  /** @inheritdoc */
  async setBreakpoints(addresses2) {
    this.#requireStopped();
    if (addresses2.length > 256) throw new Error("Mesen accepts at most 256 execute breakpoints.");
    const checked = addresses2.map((address4, index) => {
      if (address4.architecture !== MESEN_65816_ARCHITECTURE || address4.addressSpace !== MESEN_65816_ADDRESS_SPACE)
        throw new Error(`Mesen breakpoint ${index} is not a 65816 execution address.`);
      integer2(address4.address, `Mesen breakpoint ${index} address`, 16777215);
      return { ...address4 };
    });
    if (new Set(checked.map(({ address: address4 }) => address4)).size !== checked.length)
      throw new Error("Duplicate Mesen execute breakpoint addresses are not allowed.");
    const result = record2(
      await this.#requireConnected().request("setBreakpoints", {
        cpu: "65816",
        addresses: checked.map(({ address: address4 }) => address4)
      }),
      "Mesen breakpoint response"
    );
    const count = integer2(result.count, "Mesen breakpoint response count", 256);
    if (count !== checked.length)
      throw new Error("Mesen did not install the complete breakpoint set.");
    const next = /* @__PURE__ */ new Map();
    const breakpoints = checked.map((address4) => {
      const breakpoint = this.#breakpoints.get(address4.address) ?? Object.freeze({ id: this.#nextBreakpointId++, address: address4, verified: true });
      next.set(address4.address, breakpoint);
      return breakpoint;
    });
    this.#breakpoints.clear();
    for (const [address4, breakpoint] of next) this.#breakpoints.set(address4, breakpoint);
    return breakpoints;
  }
  /** @inheritdoc */
  async disassemble(address4, count) {
    integer2(count, "Mesen disassembly count", 4096);
    const descriptor = this.#executionDescriptor(address4);
    const status = await this.#readStatus(descriptor.processor);
    let current = address4.address;
    let superFxState = descriptor.processor === "superfx" ? this.#superFxState(status) : void 0;
    const instructions = [];
    for (let index = 0; index < count; index++) {
      const memory = await this.#readNativeMemory(descriptor, current, 4);
      const source = new Uint8ArrayDecoderSource(memory);
      const decoded = (() => {
        if (descriptor.processor === "65816")
          return this.#cpuDecoder.decode({
            source,
            offset: 0,
            logicalAddress: current,
            state: this.#cpuDecodeState(status)
          });
        if (descriptor.processor === "spc700")
          return this.#spcDecoder.decode({
            source,
            offset: 0,
            logicalAddress: current,
            state: this.#spcDecodeState(status)
          });
        return this.#superFxDecoder.decode({
          source,
          offset: 0,
          logicalAddress: current,
          state: superFxDecodeState(superFxState)
        });
      })();
      if (decoded.kind !== "instruction")
        throw new Error(
          decoded.kind === "ambiguous" ? decoded.reason : `Mesen decode failed: ${decoded.message}`
        );
      const text = (() => {
        if (descriptor.processor === "65816") return formatCpu65816Instruction(decoded.instruction);
        if (descriptor.processor === "spc700") return formatSpc700Instruction(decoded.instruction);
        return formatSuperFxInstruction(decoded.instruction);
      })();
      instructions.push({
        address: this.#executionAddress(descriptor.processor, current),
        bytes: [...decoded.instruction.bytes],
        text
      });
      if (superFxState) superFxState = transferSuperFxState(decoded.instruction, superFxState);
      current = current + decoded.instruction.size & maximumPc(descriptor.processor);
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
        if (!this.#connected || this.#stopped || epoch !== this.#executionEpoch) return;
        const status = await this.#readStatus(descriptor.processor, false);
        if (status.stopped) {
          this.#acceptRunningStop(status, descriptor, epoch);
          return;
        }
      }
    } catch (error) {
      if (epoch !== this.#executionEpoch || !this.#connected) return;
      const failure = asError2(error);
      this.#emit({ type: "output", category: "stderr", text: `${failure.message}
` });
      this.#emit({ type: "terminated", restart: true });
      const client = this.#client;
      if (client) {
        this.#expectedClose.add(client);
        await this.#releaseClient(client).catch(() => void 0);
      }
    }
  }
  #acceptRunningStop(status, descriptor, epoch) {
    if (epoch !== this.#executionEpoch || this.#stopped) return;
    this.#stopped = true;
    const reason = descriptor.processor === "65816" && this.#breakpoints.has(status.programCounter) ? "breakpoint" : "exception";
    this.#emit({ type: "stopped", reason, threadId: descriptor.id });
  }
  async #readStatus(cpu, requireStopped = true) {
    if (requireStopped) this.#requireStopped();
    return this.#statusRequest("status", cpu);
  }
  async #statusRequest(method, cpu) {
    return parseStatus(await this.#requireClient().request(method, { cpu }), cpu);
  }
  #cpuDecodeState(status) {
    const registers = status.registers;
    const flags = registerInteger(registers, "PS", 8);
    return {
      e: boolean2(registers.emulationMode, "Mesen register emulationMode") ? 1 : 0,
      m: flags >>> 5 & 1 ? 1 : 0,
      x: flags >>> 4 & 1 ? 1 : 0,
      programBank: status.programCounter >>> 16,
      dataBank: registerInteger(registers, "DBR", 8),
      directPage: registerInteger(registers, "D", 16)
    };
  }
  #spcDecodeState(status) {
    const flags = registerInteger(status.registers, "PS", 8);
    return { directPage: flags & 32 ? 256 : 0 };
  }
  #superFxState(status) {
    const registers = status.registers;
    const sfr = record2(registers.SFR, "Mesen Super FX status register");
    const alt = (boolean2(sfr.alt1, "Mesen register alt1") ? 1 : 0) | (boolean2(sfr.alt2, "Mesen register alt2") ? 2 : 0);
    return {
      alt: { kind: "known", value: alt },
      destinationRegister: {
        kind: "known",
        value: registerInteger(registers, "destinationRegister", 4)
      },
      sourceRegister: {
        kind: "known",
        value: registerInteger(registers, "sourceRegister", 4)
      },
      programBank: {
        kind: "known",
        value: registerInteger(registers, "programBank", 8)
      }
    };
  }
  #executionDescriptor(address4) {
    const descriptor = memorySpaces[address4.addressSpace];
    if (!descriptor || threads[descriptor.processor].architecture !== address4.architecture)
      throw new Error(
        `Mesen execution address '${address4.architecture}/${address4.addressSpace}' is unsupported.`
      );
    let expectedSpace = MESEN_SUPERFX_ROM_ADDRESS_SPACE;
    if (descriptor.processor === "65816") expectedSpace = MESEN_65816_ADDRESS_SPACE;
    else if (descriptor.processor === "spc700") expectedSpace = MESEN_SPC700_ADDRESS_SPACE;
    if (address4.addressSpace !== expectedSpace)
      throw new Error(`Mesen address space '${address4.addressSpace}' is not executable.`);
    integer2(address4.address, "Mesen execution address", descriptor.maximumAddress);
    this.#requireProcessor(descriptor.processor);
    return descriptor;
  }
  #checkedMemoryAddress(address4, allowExecutionBus) {
    const descriptor = memorySpaces[address4.addressSpace];
    if (!descriptor || threads[descriptor.processor].architecture !== address4.architecture)
      throw new Error(
        `Mesen memory address '${address4.architecture}/${address4.addressSpace}' is unsupported.`
      );
    if (!allowExecutionBus && address4.addressSpace === MESEN_65816_ADDRESS_SPACE)
      throw new Error("Mesen logical CPU-bus memory is reserved for disassembly.");
    integer2(address4.address, "Mesen memory address", descriptor.maximumAddress);
    this.#requireProcessor(descriptor.processor);
    return descriptor;
  }
  async #readNativeMemory(descriptor, address4, count) {
    this.#requireStopped();
    const bytes = new Uint8Array(count);
    let offset = 0;
    while (offset < count) {
      const requested = Math.min(this.#maxMemoryRead, count - offset);
      const response = record2(
        await this.#requireConnected().request("readMemory", {
          space: descriptor.native,
          address: address4 + offset,
          length: requested
        }),
        "Mesen memory response"
      );
      if (string2(response.space, "Mesen memory response space") !== descriptor.native)
        throw new Error("Mesen memory response used the wrong address space.");
      if (integer2(response.address, "Mesen memory response address") !== address4 + offset)
        throw new Error("Mesen memory response used the wrong address.");
      const encoded = string2(response.data, "Mesen memory response data");
      const chunk = Buffer2.from(encoded, "base64");
      if (chunk.toString("base64") !== encoded || chunk.length !== requested)
        throw new Error("Mesen memory response is not canonical base64 of the requested length.");
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    return bytes;
  }
  #executionAddress(cpu, address4) {
    const architecture = threads[cpu].architecture;
    let addressSpace = MESEN_SUPERFX_ROM_ADDRESS_SPACE;
    if (cpu === "65816") addressSpace = MESEN_65816_ADDRESS_SPACE;
    else if (cpu === "spc700") addressSpace = MESEN_SPC700_ADDRESS_SPACE;
    return { architecture, addressSpace, address: address4 };
  }
  #thread(id) {
    integer2(id, "Mesen thread id");
    const descriptor = Object.values(threads).find((candidate) => candidate.id === id);
    if (!descriptor || !this.#availableProcessors.includes(descriptor.processor))
      throw new Error(`Unknown Mesen thread ${id}.`);
    return descriptor;
  }
  #frame(id) {
    integer2(id, "Mesen frame id");
    const descriptor = Object.values(threads).find((candidate) => candidate.frameId === id);
    if (!descriptor || !this.#availableProcessors.includes(descriptor.processor))
      throw new Error(`Unknown Mesen frame ${id}.`);
    return descriptor;
  }
  #requireProcessor(cpu) {
    if (!this.#availableProcessors.includes(cpu))
      throw new Error(`Mesen processor '${cpu}' is not available for this cartridge.`);
  }
  #requireClient() {
    if (!this.#client || this.#client.closed) throw new Error("Mesen client is not available.");
    return this.#client;
  }
  #requireConnected() {
    if (!this.#connected) throw new Error("Mesen backend is not connected.");
    return this.#requireClient();
  }
  #requireStopped() {
    const client = this.#requireConnected();
    if (!this.#stopped) throw new Error("Mesen backend must be stopped for this operation.");
    return client;
  }
  #clientClosed(client, error) {
    if (this.#expectedClose.has(client) || this.#client !== client) return;
    this.#executionEpoch++;
    this.#closeSubscription?.dispose();
    this.#closeSubscription = void 0;
    this.#client = void 0;
    this.#connected = false;
    this.#stopped = false;
    this.#emit({
      type: "output",
      category: "stderr",
      text: `${error?.message ?? "Mesen debug connection closed."}
`
    });
    this.#emit({ type: "terminated", restart: true });
  }
  async #releaseClient(client) {
    if (this.#client !== client) return;
    this.#executionEpoch++;
    this.#closeSubscription?.dispose();
    this.#closeSubscription = void 0;
    this.#client = void 0;
    this.#connected = false;
    await client.close();
  }
  #emit(event) {
    for (const listener of this.#listeners) listener(event);
  }
};

// packages/debug-sidecar-mesence/src/mesen-process-host.ts
import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import net2 from "node:net";
import path from "node:path";

// packages/debug-sidecar-mesence/src/mesen-debug-client.ts
import { Buffer as Buffer3 } from "node:buffer";
var asError3 = (error) => error instanceof Error ? error : new Error(String(error));
var positiveInteger3 = (value, context) => {
  if (!Number.isSafeInteger(value) || value <= 0)
    throw new Error(`${context} must be a positive safe integer.`);
  return value;
};
var responseRecord = (value) => {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error("Mesen response must be an object.");
  return value;
};
var FramedMesenDebugClient = class {
  #transport;
  #token;
  #requestTimeoutMs;
  #maxRequestBytes;
  #maxResponseBytes;
  #maxQueuedRequests;
  #maxQueuedBytes;
  #closeListeners = /* @__PURE__ */ new Set();
  #dataSubscription;
  #closeSubscription;
  #queue = [];
  #buffer = Buffer3.alloc(0);
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
    this.#requestTimeoutMs = positiveInteger3(
      options.requestTimeoutMs ?? 5e3,
      "Mesen request timeout"
    );
    this.#maxRequestBytes = positiveInteger3(
      options.maxRequestBytes ?? 64 * 1024,
      "Mesen maximum request bytes"
    );
    this.#maxResponseBytes = positiveInteger3(
      options.maxResponseBytes ?? 256 * 1024,
      "Mesen maximum response bytes"
    );
    this.#maxQueuedRequests = positiveInteger3(
      options.maxQueuedRequests ?? 16,
      "Mesen maximum queued requests"
    );
    this.#maxQueuedBytes = positiveInteger3(
      options.maxQueuedBytes ?? 256 * 1024,
      "Mesen maximum queued bytes"
    );
    if (this.#maxQueuedBytes < this.#maxRequestBytes + 4)
      throw new Error("Mesen queued-byte bound must hold one maximum-sized request frame.");
    this.#dataSubscription = this.#transport.onData((data) => this.#receive(data));
    this.#closeSubscription = this.#transport.onClose(
      (error) => this.#fail(error ?? new Error("Mesen debug transport closed."), false)
    );
  }
  /** @returns {boolean} Whether this client has permanently closed. */
  get closed() {
    return this.#closed;
  }
  /** @inheritdoc */
  request(method, parameters = {}) {
    if (this.#closed) return Promise.reject(new Error("Mesen debug client is closed."));
    if (!/^[A-Za-z][\dA-Za-z]*$/.test(method))
      return Promise.reject(new Error("Mesen debug method has an invalid name."));
    if (this.#nextId > Number.MAX_SAFE_INTEGER)
      return Promise.reject(new Error("Mesen debug request identifier space is exhausted."));
    const id = this.#nextId++;
    let payload;
    try {
      payload = Buffer3.from(
        JSON.stringify({
          version: MESEN_NATIVE_PROTOCOL_VERSION,
          token: this.#token,
          id,
          method,
          params: parameters
        }),
        "utf8"
      );
    } catch (error) {
      return Promise.reject(asError3(error));
    }
    if (payload.length === 0 || payload.length > this.#maxRequestBytes)
      return Promise.reject(
        new Error(`Mesen debug request exceeds ${this.#maxRequestBytes} bytes.`)
      );
    const packet = Buffer3.allocUnsafe(payload.length + 4);
    packet.writeUInt32BE(payload.length, 0);
    packet.set(payload, 4);
    const queuedCount = this.#queue.length + (this.#pending ? 1 : 0);
    if (queuedCount >= this.#maxQueuedRequests)
      return Promise.reject(
        new Error(`Mesen debug request queue exceeds ${this.#maxQueuedRequests} requests.`)
      );
    if (this.#queuedBytes + packet.length > this.#maxQueuedBytes)
      return Promise.reject(
        new Error(`Mesen debug request queue exceeds ${this.#maxQueuedBytes} bytes.`)
      );
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => this.#fail(new Error(`Mesen debug request '${method}' timed out.`)),
        this.#requestTimeoutMs
      );
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
      return { dispose: () => void 0 };
    }
    this.#closeListeners.add(listener);
    return { dispose: () => this.#closeListeners.delete(listener) };
  }
  /** @inheritdoc */
  async close() {
    if (this.#closed) return;
    this.#fail(new Error("Mesen debug client closed."), false);
    await this.#transport.close();
  }
  #pump() {
    if (this.#closed || this.#pending) return;
    const request = this.#queue.shift();
    if (!request) return;
    this.#pending = request;
    void this.#transport.write(request.packet).catch((error) => this.#fail(asError3(error)));
  }
  #receive(data) {
    if (this.#closed) return;
    try {
      const maximumBuffered = this.#maxResponseBytes + 4;
      if (this.#buffer.length + data.length > maximumBuffered)
        throw new Error(`Mesen debug receive buffer exceeds ${maximumBuffered} bytes.`);
      this.#buffer = Buffer3.concat([this.#buffer, data]);
      while (this.#buffer.length >= 4) {
        const length = this.#buffer.readUInt32BE(0);
        if (length === 0 || length > this.#maxResponseBytes)
          throw new Error(`Mesen debug response length ${length} is outside protocol bounds.`);
        if (this.#buffer.length < length + 4) return;
        const payload = this.#buffer.subarray(4, length + 4);
        this.#buffer = this.#buffer.subarray(length + 4);
        this.#deliver(payload);
      }
    } catch (error) {
      this.#fail(asError3(error));
    }
  }
  #deliver(payload) {
    let parsed;
    try {
      parsed = JSON.parse(Buffer3.from(payload).toString("utf8"));
    } catch {
      throw new Error("Mesen debug response is not valid UTF-8 JSON.");
    }
    const response = responseRecord(parsed);
    if (response.version !== MESEN_NATIVE_PROTOCOL_VERSION)
      throw new Error("Mesen debug response uses an unsupported protocol version.");
    const pending = this.#pending;
    if (!pending) throw new Error("Mesen debug response arrived without a pending request.");
    if (response.id !== pending.id)
      throw new Error(`Mesen debug response id ${String(response.id)} is out of order.`);
    if (typeof response.ok !== "boolean") throw new Error("Mesen debug response lacks ok state.");
    if (!response.ok && (typeof response.error !== "string" || response.error.length === 0))
      throw new Error("Mesen debug error response lacks a message.");
    clearTimeout(pending.timer);
    this.#pending = void 0;
    this.#queuedBytes -= pending.packet.length;
    if (response.ok) pending.resolve(response.result);
    else pending.reject(new Error(`Mesen ${pending.method} failed: ${String(response.error)}`));
    this.#pump();
  }
  #fail(error, closeTransport = true) {
    if (this.#closed) return;
    this.#closed = true;
    this.#closeError = error;
    this.#dataSubscription.dispose();
    this.#closeSubscription.dispose();
    const queued = this.#pending ? [this.#pending, ...this.#queue] : [...this.#queue];
    this.#pending = void 0;
    this.#queue.length = 0;
    this.#queuedBytes = 0;
    for (const request of queued) {
      clearTimeout(request.timer);
      request.reject(error);
    }
    for (const listener of this.#closeListeners) listener(error);
    this.#closeListeners.clear();
    if (closeTransport) void this.#transport.close().catch(() => void 0);
  }
};

// packages/debug-sidecar-mesence/src/node-tcp-mesen-transport.ts
import net from "node:net";
var NodeTcpMesenTransport = class _NodeTcpMesenTransport {
  #socket;
  #shutdownTimeoutMs;
  #dataListeners = /* @__PURE__ */ new Set();
  #closeListeners = /* @__PURE__ */ new Set();
  #terminalError;
  #closed = false;
  #notified = false;
  constructor(socket, shutdownTimeoutMs) {
    this.#socket = socket;
    this.#shutdownTimeoutMs = shutdownTimeoutMs;
    this.#socket.setNoDelay(true);
    this.#socket.on("data", (data) => {
      const bytes = typeof data === "string" ? Buffer.from(data) : data;
      for (const listener of this.#dataListeners) listener(bytes);
    });
    this.#socket.on("error", (error) => {
      this.#terminalError = error;
    });
    this.#socket.on("close", () => this.#notifyClosed(this.#terminalError));
  }
  /**
   * Opens a bounded connection to a numeric loopback address.
   * @param {NodeTcpMesenTransportOptions} options Loopback endpoint and deadlines.
   * @returns {Promise<NodeTcpMesenTransport>} Connected transport.
   */
  static async connect(options) {
    const host = options.host ?? "127.0.0.1";
    if (host !== "127.0.0.1" && host !== "::1")
      throw new Error("Mesen transport host must be a numeric loopback address.");
    if (!Number.isSafeInteger(options.port) || options.port < 1 || options.port > 65535)
      throw new Error("Mesen transport port must be an integer between 1 and 65535.");
    const connectTimeoutMs = options.connectTimeoutMs ?? 3e3;
    const shutdownTimeoutMs = options.shutdownTimeoutMs ?? 1e3;
    for (const [name, value] of [
      ["Mesen connect timeout", connectTimeoutMs],
      ["Mesen shutdown timeout", shutdownTimeoutMs]
    ]) {
      if (!Number.isSafeInteger(value) || value <= 0)
        throw new Error(`${name} must be a positive safe integer.`);
    }
    const socket = new net.Socket();
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        socket.destroy();
        reject(new Error(`Mesen connection to ${host}:${options.port} timed out.`));
      }, connectTimeoutMs);
      const cleanup = () => {
        clearTimeout(timeout);
        socket.off("connect", connected);
        socket.off("error", failed);
      };
      const connected = () => {
        cleanup();
        resolve();
      };
      const failed = (error) => {
        cleanup();
        socket.destroy();
        reject(error);
      };
      socket.once("connect", connected);
      socket.once("error", failed);
      socket.connect(options.port, host);
    });
    return new _NodeTcpMesenTransport(socket, shutdownTimeoutMs);
  }
  /** @inheritdoc */
  write(data) {
    if (this.#closed) return Promise.reject(new Error("Mesen TCP transport is closed."));
    return new Promise((resolve, reject) => {
      this.#socket.write(data, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
  /** @inheritdoc */
  onData(listener) {
    this.#dataListeners.add(listener);
    return { dispose: () => this.#dataListeners.delete(listener) };
  }
  /** @inheritdoc */
  onClose(listener) {
    if (this.#notified) {
      queueMicrotask(() => listener(this.#terminalError));
      return { dispose: () => void 0 };
    }
    this.#closeListeners.add(listener);
    return { dispose: () => this.#closeListeners.delete(listener) };
  }
  /** @inheritdoc */
  async close() {
    if (this.#closed) return;
    this.#closed = true;
    if (this.#socket.destroyed) {
      this.#notifyClosed(this.#terminalError);
      return;
    }
    await new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.#socket.destroy();
        resolve();
      }, this.#shutdownTimeoutMs);
      this.#socket.once("close", () => {
        clearTimeout(timeout);
        resolve();
      });
      this.#socket.end();
    });
  }
  #notifyClosed(error) {
    if (this.#notified) return;
    this.#notified = true;
    this.#closed = true;
    for (const listener of this.#closeListeners) listener(error);
    this.#closeListeners.clear();
    this.#dataListeners.clear();
  }
};

// packages/debug-sidecar-mesence/src/mesen-process-host.ts
var MESEN_RUNTIME_MANIFEST_VERSION = 1;
var MESEN_NATIVE_TOKEN_ENV = "MESEN_DEBUG_SERVER_TOKEN";
var sha256Pattern = /^[\dA-Fa-f]{64}$/;
var revisionPattern = /^[\dA-Fa-f]{40}$/;
var positiveInteger4 = (value, name) => {
  if (!Number.isSafeInteger(value) || value <= 0)
    throw new Error(`${name} must be a positive safe integer.`);
};
var checkedSha256 = (value, name) => {
  if (!sha256Pattern.test(value)) throw new Error(`${name} must be a 64-digit SHA-256 value.`);
  return value.toLowerCase();
};
var checkedRevision = (value) => {
  if (!revisionPattern.test(value))
    throw new Error("Mesen upstream revision must be a 40-digit git revision.");
  return value.toLowerCase();
};
var checkedAbsolutePath = (value, name) => {
  if (!path.isAbsolute(value)) throw new Error(`${name} must be an absolute path.`);
  return path.normalize(value);
};
var checkedResourcePath = (value) => {
  if (value === "." || value.includes("\\") || path.posix.isAbsolute(value) || path.posix.normalize(value) !== value || value.split("/").includes(".."))
    throw new Error(`Mesen resource path '${value}' must be normalized and relative.`);
  return value;
};
var errorValue = (error) => error instanceof Error ? error : new Error(String(error));
var waitWithTimeout = async (promise, timeoutMs) => new Promise((resolve) => {
  const timer = setTimeout(() => resolve(void 0), timeoutMs);
  timer.unref();
  void promise.then((value) => {
    clearTimeout(timer);
    resolve(value);
  });
});
var NodeMesenProcessHandle = class {
  #child;
  #exit;
  #exited = false;
  constructor(options) {
    let spawnError;
    this.#child = spawn(options.command, [...options.args], {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    });
    this.#child.stdout?.on("data", (data) => options.onOutput("stdout", data));
    this.#child.stderr?.on("data", (data) => options.onOutput("stderr", data));
    this.#child.once("error", (error) => {
      spawnError = error;
    });
    this.#exit = new Promise((resolve) => {
      this.#child.once("close", (code, signal) => {
        this.#exited = true;
        resolve({ code, signal, ...spawnError ? { error: spawnError } : {} });
      });
    });
  }
  get pid() {
    return this.#child.pid;
  }
  get exited() {
    return this.#exited;
  }
  waitForExit() {
    return this.#exit;
  }
  kill(signal) {
    if (!this.#exited) this.#child.kill(signal);
  }
};
var nodeSha256 = async (file) => {
  const digest = createHash("sha256");
  for await (const chunk of createReadStream(file)) digest.update(chunk);
  return digest.digest("hex");
};
var reserveLoopbackPort = async () => {
  const server = net2.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen({ host: "127.0.0.1", port: 0, exclusive: true }, resolve);
  });
  const address4 = server.address();
  if (!address4 || typeof address4 === "string") {
    server.close();
    throw new Error("Unable to reserve an IPv4 loopback port for MesenCE.");
  }
  await new Promise(
    (resolve, reject) => server.close((error) => {
      if (error) reject(error);
      else resolve();
    })
  );
  return address4.port;
};
var nodeMesenProcessRuntime = Object.freeze({
  platform: process.platform,
  architecture: process.arch,
  sha256: nodeSha256,
  randomToken: () => randomBytes(32).toString("hex"),
  reserveLoopbackPort,
  launch: (options) => new NodeMesenProcessHandle(options),
  connect: (port, timeoutMs) => NodeTcpMesenTransport.connect({
    host: "127.0.0.1",
    port,
    connectTimeoutMs: timeoutMs
  }),
  delay: (milliseconds) => new Promise((resolve) => {
    const timer = setTimeout(resolve, milliseconds);
    timer.unref();
  })
});
var manifestRecord = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Mesen runtime manifest must be an object.");
  return value;
};
var manifestString = (value, name) => {
  if (typeof value !== "string" || value.length === 0)
    throw new Error(`${name} must be a non-empty string.`);
  return value;
};
var parseMesenRuntimeManifest = (value) => {
  const manifest = manifestRecord(value);
  if (manifest.schemaVersion !== MESEN_RUNTIME_MANIFEST_VERSION)
    throw new Error(
      `Unsupported Mesen runtime manifest version ${String(manifest.schemaVersion)}.`
    );
  if (manifest.emulator !== "MesenCE") throw new Error("Runtime manifest is not for MesenCE.");
  if (!Array.isArray(manifest.resources))
    throw new Error("Mesen runtime manifest resources must be an array.");
  const resources = Object.freeze(
    manifest.resources.map((value2, index) => {
      const resource = manifestRecord(value2);
      const resourcePath = checkedResourcePath(
        manifestString(resource.path, `Mesen resource ${index} path`)
      );
      return Object.freeze({
        path: resourcePath,
        sha256: checkedSha256(
          manifestString(resource.sha256, `Resource '${resourcePath}' SHA-256`),
          `Resource '${resourcePath}' SHA-256`
        )
      });
    })
  );
  if (new Set(resources.map(({ path: resourcePath }) => resourcePath)).size !== resources.length)
    throw new Error("Mesen runtime manifest contains duplicate resource paths.");
  return Object.freeze({
    schemaVersion: MESEN_RUNTIME_MANIFEST_VERSION,
    emulator: "MesenCE",
    upstreamRevision: checkedRevision(
      manifestString(manifest.upstreamRevision, "Mesen upstream revision")
    ),
    patchSha256: checkedSha256(
      manifestString(manifest.patchSha256, "Mesen patch SHA-256"),
      "Mesen patch SHA-256"
    ),
    executableSha256: checkedSha256(
      manifestString(manifest.executableSha256, "Mesen executable SHA-256"),
      "Mesen executable SHA-256"
    ),
    romSha256: checkedSha256(manifestString(manifest.romSha256, "ROM SHA-256"), "ROM SHA-256"),
    platform: manifestString(manifest.platform, "Mesen manifest platform"),
    architecture: manifestString(manifest.architecture, "Mesen manifest architecture"),
    buildConfiguration: manifestString(manifest.buildConfiguration, "Mesen build configuration"),
    resources
  });
};
var MesenProcessHost = class {
  #executable;
  #rom;
  #runtimeDirectory;
  #manifest;
  #env;
  #startupTimeoutMs;
  #requestTimeoutMs;
  #shutdownTimeoutMs;
  #connectRetryMs;
  #nativeLifetimeSeconds;
  #maxOutputBytes;
  #onOutput;
  #runtime;
  #process;
  #port;
  #token;
  #output = Buffer.alloc(0);
  #lifecycleTail = Promise.resolve();
  /** @param {MesenProcessHostOptions} options Paths, identity, bounds, and platform runtime. */
  constructor(options) {
    this.#executable = checkedAbsolutePath(options.executable, "Mesen executable");
    this.#rom = checkedAbsolutePath(options.rom, "Mesen ROM");
    this.#runtimeDirectory = checkedAbsolutePath(
      options.runtimeDirectory,
      "Mesen runtime directory"
    );
    if (path.dirname(this.#executable) !== this.#runtimeDirectory)
      throw new Error("Mesen executable must reside directly in its portable runtime directory.");
    this.#manifest = parseMesenRuntimeManifest(options.manifest);
    this.#env = options.env ?? {};
    this.#startupTimeoutMs = options.startupTimeoutMs ?? 1e4;
    this.#requestTimeoutMs = options.requestTimeoutMs ?? 5e3;
    this.#shutdownTimeoutMs = options.shutdownTimeoutMs ?? 2e3;
    this.#connectRetryMs = options.connectRetryMs ?? 25;
    this.#nativeLifetimeSeconds = options.nativeLifetimeSeconds ?? 86400;
    this.#maxOutputBytes = options.maxOutputBytes ?? 65536;
    this.#onOutput = options.onOutput;
    this.#runtime = options.runtime ?? nodeMesenProcessRuntime;
    for (const [name, value] of [
      ["Mesen startup timeout", this.#startupTimeoutMs],
      ["Mesen request timeout", this.#requestTimeoutMs],
      ["Mesen shutdown timeout", this.#shutdownTimeoutMs],
      ["Mesen connect retry delay", this.#connectRetryMs],
      ["Mesen native lifetime", this.#nativeLifetimeSeconds],
      ["Mesen output limit", this.#maxOutputBytes]
    ])
      positiveInteger4(value, name);
  }
  /** @returns {MesenRuntimeManifest} Normalized immutable launch identity. */
  get manifest() {
    return this.#manifest;
  }
  /** @returns {number | undefined} PID of the current emulator process. */
  get pid() {
    return this.#process?.pid;
  }
  /** @returns {string} Bounded tail of emulator output, never neutral-protocol stdout. */
  get output() {
    return this.#output.toString("utf8");
  }
  /**
   * Starts a verified process for reset connects or reconnects to the preserved process.
   * @param {DebugBackendConnectOptions} options Backend reset policy.
   * @returns {Promise<FramedMesenDebugClient>} Connected private native-protocol client.
   */
  createClient(options) {
    return this.#serializeLifecycle(async () => {
      let launched = false;
      if (options.reset ?? true) {
        await this.#terminateCurrent();
        await this.#launch();
        launched = true;
      } else if (!this.#process || this.#process.exited || this.#port === void 0 || this.#token === void 0) {
        throw new Error("Cannot reconnect to MesenCE because no preserved process is running.");
      }
      try {
        return await this.#connect();
      } catch (error) {
        if (launched) await this.#terminateCurrent();
        throw error;
      }
    });
  }
  /** @returns {Promise<void>} Bounded graceful/forced cleanup of the owned process. */
  terminate() {
    return this.#serializeLifecycle(() => this.#terminateCurrent());
  }
  async #launch() {
    await this.#verifyIdentity();
    const port = await this.#runtime.reserveLoopbackPort();
    const token = this.#runtime.randomToken().toLowerCase();
    if (!sha256Pattern.test(token))
      throw new Error("Mesen runtime generated an invalid 256-bit native token.");
    const args = [
      "--testrunner",
      `--debugserverport=${port}`,
      `--timeout=${this.#nativeLifetimeSeconds}`,
      "--novideo",
      "--noaudio",
      "--noinput",
      this.#rom
    ];
    this.#output = Buffer.alloc(0);
    const processHandle = this.#runtime.launch({
      command: this.#executable,
      args,
      cwd: this.#runtimeDirectory,
      env: {
        ...this.#env,
        [DEBUG_SIDECAR_SESSION_ENV]: void 0,
        [MESEN_NATIVE_TOKEN_ENV]: token
      },
      onOutput: (stream, data) => this.#captureOutput(stream, data)
    });
    this.#process = processHandle;
    this.#port = port;
    this.#token = token;
  }
  async #connect() {
    const processHandle = this.#process;
    const port = this.#port;
    const token = this.#token;
    if (!processHandle || port === void 0 || token === void 0)
      throw new Error("MesenCE process is not running.");
    const deadline = Date.now() + this.#startupTimeoutMs;
    let lastError = new Error("MesenCE debugger listener was not ready.");
    while (Date.now() < deadline) {
      if (processHandle.exited)
        throw await this.#exitError(processHandle, "before debugger connected");
      try {
        const remaining = Math.max(1, deadline - Date.now());
        const transport = await this.#runtime.connect(port, Math.min(remaining, 250));
        return new FramedMesenDebugClient({
          transport,
          token,
          requestTimeoutMs: this.#requestTimeoutMs
        });
      } catch (error) {
        lastError = errorValue(error);
      }
      await this.#runtime.delay(Math.min(this.#connectRetryMs, Math.max(1, deadline - Date.now())));
    }
    if (processHandle.exited)
      throw await this.#exitError(processHandle, "before debugger connected");
    throw new Error(
      `MesenCE debugger listener on 127.0.0.1:${port} was not ready within ${this.#startupTimeoutMs} ms: ${lastError.message}`
    );
  }
  async #verifyIdentity() {
    if (this.#runtime.platform !== this.#manifest.platform)
      throw new Error(
        `Mesen manifest platform '${this.#manifest.platform}' does not match '${this.#runtime.platform}'.`
      );
    if (this.#runtime.architecture !== this.#manifest.architecture)
      throw new Error(
        `Mesen manifest architecture '${this.#manifest.architecture}' does not match '${this.#runtime.architecture}'.`
      );
    const runtimeInfo = await stat(this.#runtimeDirectory).catch(() => void 0);
    if (!runtimeInfo?.isDirectory())
      throw new Error("Mesen portable runtime path must be an existing directory.");
    await this.#verifyHash(this.#executable, this.#manifest.executableSha256, "executable");
    await this.#verifyHash(this.#rom, this.#manifest.romSha256, "ROM");
    for (const resource of this.#manifest.resources) {
      await this.#verifyHash(
        path.join(this.#runtimeDirectory, ...resource.path.split("/")),
        resource.sha256,
        `resource '${resource.path}'`
      );
    }
  }
  async #verifyHash(file, expected, context) {
    let actual;
    try {
      actual = checkedSha256(await this.#runtime.sha256(file), `Observed ${context} SHA-256`);
    } catch (error) {
      throw new Error(
        `Unable to verify MesenCE ${context} at '${file}': ${errorValue(error).message}`
      );
    }
    if (actual !== expected)
      throw new Error(
        `MesenCE ${context} SHA-256 mismatch: expected ${expected}, received ${actual}.`
      );
  }
  async #terminateCurrent() {
    const processHandle = this.#process;
    this.#process = void 0;
    this.#port = void 0;
    this.#token = void 0;
    if (!processHandle || processHandle.exited) return;
    processHandle.kill("SIGTERM");
    if (await waitWithTimeout(processHandle.waitForExit(), this.#shutdownTimeoutMs)) return;
    processHandle.kill("SIGKILL");
    await processHandle.waitForExit();
  }
  async #exitError(processHandle, context) {
    const exit = await processHandle.waitForExit();
    const status = exit.signal ? `signal ${exit.signal}` : `code ${String(exit.code)}`;
    const detail = this.output.trim();
    let suffix = ".";
    if (exit.error) suffix = `: ${exit.error.message}`;
    else if (detail) suffix = `: ${detail}`;
    return new Error(`MesenCE exited with ${status} ${context}${suffix}`);
  }
  #captureOutput(stream, data) {
    const text = Buffer.from(data).toString("utf8");
    this.#onOutput?.(stream, text);
    const tagged = Buffer.from(`[MesenCE ${stream}] ${text}`, "utf8");
    const combined = Buffer.concat([this.#output, tagged]);
    this.#output = combined.subarray(Math.max(0, combined.length - this.#maxOutputBytes));
  }
  #serializeLifecycle(action) {
    const operation = this.#lifecycleTail.then(action);
    this.#lifecycleTail = operation.then(
      () => void 0,
      () => void 0
    );
    return operation;
  }
};

// packages/debug-sidecar-mesence/src/sidecar.ts
var usage = `Usage: uttori-asm-debug-sidecar-mesence [options]

Required:
  --manifest path       Versioned MesenCE runtime manifest JSON
  --mesen path          Separately installed patched MesenCE executable
  --rom path            SNES ROM whose SHA-256 matches the manifest
  --runtime-dir path    Portable runtime directory containing the executable

Optional:
  --help                Show this help
`;
var optionNames = /* @__PURE__ */ new Set(["--manifest", "--mesen", "--rom", "--runtime-dir"]);
var parseMesenSidecarArguments = (arguments_) => {
  const values = /* @__PURE__ */ new Map();
  for (let index = 0; index < arguments_.length; index++) {
    const argument = arguments_[index];
    if (argument === void 0) throw new Error("Mesen sidecar arguments cannot contain holes.");
    if (!optionNames.has(argument)) throw new Error(`Unknown Mesen sidecar option '${argument}'.`);
    if (values.has(argument)) throw new Error(`Duplicate Mesen sidecar option '${argument}'.`);
    const value = arguments_[++index];
    if (!value || value.startsWith("--"))
      throw new Error(`Mesen sidecar option '${argument}' requires a value.`);
    values.set(argument, value);
  }
  const required = (name) => {
    const value = values.get(name);
    if (!value) throw new Error(`Missing required Mesen sidecar option '${name}'.`);
    return path2.resolve(value);
  };
  return {
    manifest: required("--manifest"),
    executable: required("--mesen"),
    rom: required("--rom"),
    runtimeDirectory: required("--runtime-dir")
  };
};
var write = (stream, data) => new Promise((resolve, reject) => {
  stream.write(data, (error) => {
    if (error) reject(error);
    else resolve();
  });
});
var runMesenSidecar = async (arguments_, environment = process.env) => {
  const options = parseMesenSidecarArguments(arguments_);
  const session = environment[DEBUG_SIDECAR_SESSION_ENV];
  assertDebugSidecarSessionToken(session);
  const manifest = parseMesenRuntimeManifest(
    JSON.parse(await readFile(options.manifest, "utf8"))
  );
  const host = new MesenProcessHost({
    executable: options.executable,
    rom: options.rom,
    runtimeDirectory: options.runtimeDirectory,
    manifest
  });
  const backend = new MesenDebugBackend({
    createClient: (connect) => host.createClient(connect),
    terminate: () => host.terminate()
  });
  let ending = false;
  const close = async (error) => {
    if (ending) return;
    ending = true;
    if (error)
      await write(process.stderr, `${error.stack ?? error.message}
`).catch(() => void 0);
    process.stdin.pause();
    await host.terminate().catch(() => void 0);
    await new Promise((resolve) => process.stdout.end(resolve));
  };
  const server = new DebugSidecarServer({
    backend: MESEN_BACKEND_ID,
    implementation: backend,
    session,
    write: (data) => write(process.stdout, data),
    close
  });
  let receiveTail = Promise.resolve();
  process.stdin.on("data", (data) => {
    receiveTail = receiveTail.then(() => server.receive(data));
    void receiveTail.catch(() => void 0);
  });
  process.stdin.on("end", () => {
    void receiveTail.then(() => server.close()).catch(() => void 0);
  });
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.once(signal, () => {
      void server.close().catch(() => void 0);
    });
  }
};
var invokedDirectly = process.argv[1] !== void 0 && path2.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const arguments_ = process.argv.slice(2);
  if (arguments_.includes("--help")) {
    await write(process.stdout, usage);
  } else {
    await runMesenSidecar(arguments_).catch(async (error) => {
      const failure = error instanceof Error ? error : new Error(String(error));
      await write(process.stderr, `${failure.stack ?? failure.message}
`).catch(() => void 0);
      process.exitCode = 1;
    });
  }
}
export {
  parseMesenSidecarArguments,
  runMesenSidecar
};

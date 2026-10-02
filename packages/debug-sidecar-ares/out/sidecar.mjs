#!/usr/bin/env node
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};

// packages/debug-adapter/src/contracts.ts
var DEBUG_BACKEND_PROTOCOL_VERSION;
var init_contracts = __esm({
  "packages/debug-adapter/src/contracts.ts"() {
    "use strict";
    DEBUG_BACKEND_PROTOCOL_VERSION = 1;
  }
});

// packages/debug-adapter/src/conformance.ts
var DEBUG_BACKEND_CONFORMANCE_SCENARIOS;
var init_conformance = __esm({
  "packages/debug-adapter/src/conformance.ts"() {
    "use strict";
    DEBUG_BACKEND_CONFORMANCE_SCENARIOS = Object.freeze([
      "protocol-and-capabilities",
      "connect-and-inspect",
      "exact-instruction-step",
      "continue-to-breakpoint",
      "reconnect-without-reset",
      "request-bounds"
    ]);
  }
});

// packages/debug-adapter/src/debug-expression.ts
var MAX_MAGNITUDE, binaryPrecedence;
var init_debug_expression = __esm({
  "packages/debug-adapter/src/debug-expression.ts"() {
    "use strict";
    MAX_MAGNITUDE = (1n << 256n) - 1n;
    binaryPrecedence = Object.freeze({
      "||": 0,
      "&&": 1,
      "=": 2,
      "==": 2,
      "!=": 2,
      "<": 2,
      ">": 2,
      "<=": 2,
      ">=": 2,
      "<<": 3,
      ">>": 3,
      "&": 3,
      "|": 3,
      "^": 3,
      "+": 4,
      "-": 4,
      "*": 5,
      "/": 5,
      "%": 5,
      "**": 6
    });
  }
});

// packages/debug-adapter/src/capture-v2.ts
function isFieldRecord(value) {
  return typeof value === "object" && value !== null;
}
function validateCaptureRequest(value) {
  if (!isFieldRecord(value)) {
    throw new Error("Invalid capture request.");
  }
  if (value.operation === "context") {
    let fields2 = ["operation", "action"];
    const action = value.action;
    if (action === "prepare" || action === "replay" || action === "restore") {
      fields2.push("directory", "romContentSha256", "producer");
      validateCaptureRequest({
        operation: "file-start",
        file: value.directory,
        romContentSha256: value.romContentSha256,
        producer: value.producer,
        bufferBytes: 8388608
      });
    } else if (action === "start" || action === "stop" || action === "mark") {
      fields2.push("session");
      captureSession(value.session);
      if (action === "mark") {
        fields2.push("label");
        if (typeof value.label !== "string" || !value.label.trim() || value.label.includes("\0") || new TextEncoder().encode(value.label).length > 256) {
          throw new Error("Capture milestone labels must contain 1\u2013256 UTF-8 bytes.");
        }
      }
    } else if (action !== "abort" && action !== "status") {
      throw new Error("Unsupported capture context action.");
    }
    if (Object.keys(value).some((key) => !fields2.includes(key))) {
      throw new Error("Unsupported capture context field.");
    }
    return;
  }
  if (value.operation === "file-capabilities") {
    if (Object.keys(value).some((key) => !["operation", "scope"].includes(key))) {
      throw new Error("Unsupported native file capability field.");
    }
    if (value.scope !== void 0) {
      captureScope(value.scope);
    }
    return;
  }
  if (value.operation === "file-start") {
    if (Object.keys(value).some(
      (key) => ![
        "operation",
        "scope",
        "bufferBytes",
        "file",
        "romContentSha256",
        "producer",
        "measureStages"
      ].includes(key)
    )) {
      throw new Error("Unsupported native file start field.");
    }
    if (value.measureStages !== void 0 && typeof value.measureStages !== "boolean") {
      throw new Error("Native file profiling must be boolean.");
    }
    validateCaptureRequest({
      operation: "start",
      bufferBytes: value.bufferBytes,
      scope: value.scope
    });
    const producer = value.producer;
    if (!bounded(value.file, 4096) || typeof value.file !== "string" || !/^(?:\/|[a-z]:[/\\]|\\\\)/i.test(value.file) || typeof value.romContentSha256 !== "string" || !/^[\da-f]{64}$/.test(value.romContentSha256) || !isFieldRecord(producer) || !bounded(producer.id, 256) || !bounded(producer.revision, 1024) || Object.keys(producer).some((key) => !["id", "revision"].includes(key))) {
      throw new Error(
        "Native file capture requires an absolute bounded path and exact ROM/producer identity."
      );
    }
    return;
  }
  let fields = ["operation", "session"];
  if (value.operation === "capabilities") {
    fields = ["operation", "scope"];
  }
  if (value.operation === "start") {
    fields = ["operation", "bufferBytes", "scope"];
  }
  if (value.operation === "read") {
    fields = ["operation", "session", "chunk"];
  }
  if (value.operation === "ack") {
    fields = ["operation", "session", "chunk", "event"];
  }
  if (Object.keys(value).some((key) => !fields.includes(key))) {
    throw new Error(
      "Unsupported capture negotiation field. Capture requires an explicit supported stream with durable ownership."
    );
  }
  if (value.operation === "capabilities" || value.operation === "start") {
    if (value.scope !== void 0) {
      captureScope(value.scope);
    }
  }
  if (value.operation === "capabilities") {
    return;
  }
  if (value.operation === "start") {
    const bufferBytes = value.bufferBytes;
    if (typeof bufferBytes !== "number" || !Number.isSafeInteger(bufferBytes) || bufferBytes < 4718656 || bufferBytes > 64 * 1024 * 1024) {
      throw new Error("Capture buffer must be between 4718656 bytes and 64 MiB.");
    }
    return;
  }
  captureSession(value.session);
  if (value.operation === "status" || value.operation === "stop" || value.operation === "abort" || value.operation === "release" || value.operation === "file-status" || value.operation === "file-stop" || value.operation === "file-abort" || value.operation === "file-release") {
    return;
  }
  if (value.operation === "read" || value.operation === "ack") {
    if (!captureU64(value.chunk)) {
      throw new Error("Capture chunk sequence starts at one.");
    }
    if (value.operation === "ack" && !captureU64(value.event)) {
      throw new Error("Capture event sequence starts at one.");
    }
    return;
  }
  throw new Error("Unsupported capture operation.");
}
function assertCapturePosition(value, session, scope) {
  if (!isFieldRecord(value)) {
    throw new Error("Invalid capture position.");
  }
  captureSession(value.session);
  if (session !== void 0 && value.session !== session) {
    throw new Error("Capture session changed.");
  }
  if (value.scope !== void 0) {
    captureScope(value.scope);
  }
  const positionScope = value.scope === void 0 ? "snes.65816.instructions" : value.scope;
  if (scope !== void 0 && positionScope !== captureScope(scope)) {
    throw new Error("Capture scope changed or was not confirmed by the producer.");
  }
  const state = value.state;
  if (state !== "armed" && state !== "recording" && state !== "throttled" && state !== "stopping" && state !== "draining" && state !== "complete" && state !== "incomplete") {
    throw new Error("Invalid capture state.");
  }
  const bounds = [
    value.releasedThrough,
    value.durableThrough,
    value.acceptedThrough,
    value.deliveredThrough,
    value.producedThrough
  ].map(captureU64);
  if (bounds.some((bound, index) => index > 0 && bound < bounds[index - 1])) {
    throw new Error("Capture ownership boundaries are inconsistent.");
  }
  if (captureU64(value.chunkThrough) > captureU64(value.producedChunks)) {
    throw new Error("Capture chunk boundary is inconsistent.");
  }
  captureU64(value.throttleCount);
  if (!captureU64(value.clockNumerator) || !captureU64(value.clockDenominator)) {
    throw new Error("Invalid capture clock domain.");
  }
  if (value.droppedInScope !== "0" || typeof value.error !== "string" || value.error.length > 256) {
    throw new Error("Capture integrity failed.");
  }
  const bufferedBytes = value.bufferedBytes;
  const allocatedBytes = value.allocatedBytes;
  if (typeof bufferedBytes !== "number" || typeof allocatedBytes !== "number" || !Number.isSafeInteger(bufferedBytes) || !Number.isSafeInteger(allocatedBytes) || bufferedBytes < 0 || allocatedBytes < 0 || bufferedBytes > 64 * 1024 * 1024 || allocatedBytes > 64 * 1024 * 1024 || bufferedBytes > allocatedBytes) {
    throw new Error("Capture allocation exceeds its bounds.");
  }
  if (state === "complete" && (value.error || bufferedBytes || new Set(bounds.map(String)).size !== 1 || value.chunkThrough !== value.producedChunks)) {
    throw new Error("Capture terminal totals do not reconcile.");
  }
}
var maxU64, captureScope, captureU64, captureSession, bounded, validateCaptureCapabilities, validateCapturePosition;
var init_capture_v2 = __esm({
  "packages/debug-adapter/src/capture-v2.ts"() {
    "use strict";
    maxU64 = (1n << 64n) - 1n;
    captureScope = (value) => {
      if (value !== "snes.65816.instructions" && value !== "snes.cpu-bus" && value !== "snes.cpu-bus-transfers" && value !== "snes.cpu-bus-ppu") {
        throw new Error("Unsupported capture scope.");
      }
      return value;
    };
    captureU64 = (value) => {
      if (typeof value !== "string" || !/^(0|[1-9]\d{0,19})$/.test(value) || BigInt(value) > maxU64) {
        throw new Error("Capture counter must be a canonical unsigned 64-bit decimal string.");
      }
      return BigInt(value);
    };
    captureSession = (value) => {
      if (typeof value !== "string" || !/^[\da-f]{32}$/.test(value)) {
        throw new Error("Invalid capture session identity.");
      }
      return value;
    };
    bounded = (text, max) => typeof text === "string" && text.length > 0 && !text.includes("\0") && new TextEncoder().encode(text).length <= max;
    validateCaptureCapabilities = (value, scope = "snes.65816.instructions") => {
      captureScope(scope);
      let reserve = 71;
      if (scope === "snes.cpu-bus") {
        reserve = 64;
      }
      if (scope === "snes.cpu-bus-transfers") {
        reserve = 80;
      }
      if (scope === "snes.cpu-bus-ppu") {
        reserve = 88;
      }
      const expected = {
        version: 2,
        scope,
        mode: "lossless",
        ownership: "durable-prefix",
        maxChunkBytes: 262144,
        requiredReserveBytes: reserve,
        overheadBytes: 4194304,
        resumeSession: false
      };
      if (!isFieldRecord(value) || Object.entries(expected).some(([key, item]) => value[key] !== item)) {
        throw new Error("Unsupported capture scope, reserve, or ownership contract.");
      }
      if (value.nativeFile === true) {
        return { ...expected, nativeFile: true };
      }
      return expected;
    };
    validateCapturePosition = (value, session, scope) => {
      assertCapturePosition(value, session, scope);
      return value;
    };
  }
});

// packages/debug-adapter/src/dap.ts
var init_dap = __esm({
  "packages/debug-adapter/src/dap.ts"() {
    "use strict";
  }
});

// packages/debug-adapter/src/mock-script.ts
var init_mock_script = __esm({
  "packages/debug-adapter/src/mock-script.ts"() {
    "use strict";
  }
});

// packages/debug-adapter/src/sidecar-protocol.ts
function assertDebugSidecarSessionToken(value) {
  if (typeof value !== "string" || !sessionPattern.test(value)) {
    throw new Error("Sidecar session token must be 32-128 base64url characters.");
  }
}
function assertDebugSidecarMessage(value, limits = DEFAULT_DEBUG_SIDECAR_LIMITS) {
  if (!isRecord(value)) {
    throw new Error("Sidecar message must be an object.");
  }
  if (value.protocol !== DEBUG_SIDECAR_PROTOCOL) {
    throw new Error(`Unsupported sidecar protocol '${String(value.protocol)}'.`);
  }
  if (value.version !== DEBUG_SIDECAR_PROTOCOL_VERSION) {
    throw new Error(`Unsupported sidecar protocol version '${String(value.version)}'.`);
  }
  assertDebugSidecarSessionToken(value.session);
  if (!positiveInteger(value.sequence)) {
    throw new Error("Sidecar message sequence must be a positive safe integer.");
  }
  if (value.type === "request") {
    if (!listed(DEBUG_SIDECAR_COMMANDS, value.command)) {
      throw new Error(`Unsupported sidecar command '${String(value.command)}'.`);
    }
    assertRequestBounds(value.command, value.arguments, limits);
    return;
  }
  if (value.type === "response") {
    if (!positiveInteger(value.requestSequence)) {
      throw new Error("Sidecar response requestSequence must be a positive safe integer.");
    }
    if (typeof value.success !== "boolean") {
      throw new Error("Sidecar response success must be boolean.");
    }
    if (!value.success && typeof value.error !== "string") {
      throw new Error("Failed sidecar response must include an error string.");
    }
    return;
  }
  if (value.type === "event") {
    if (!listed(DEBUG_SIDECAR_EVENTS, value.event)) {
      throw new Error(`Unsupported sidecar event '${String(value.event)}'.`);
    }
    if (!isRecord(value.body)) {
      throw new Error("Sidecar event body must be an object.");
    }
    return;
  }
  throw new Error(`Unsupported sidecar message type '${String(value.type)}'.`);
}
var DEBUG_SIDECAR_PROTOCOL, DEBUG_SIDECAR_PROTOCOL_VERSION, DEBUG_SIDECAR_COMMANDS, DEBUG_SIDECAR_EVENTS, DEFAULT_DEBUG_SIDECAR_LIMITS, isRecord, listed, positiveInteger, nonNegativeInteger, sessionPattern, assertRequestBounds, LIMIT_NAMES, validateLimits, encodeDebugSidecarMessage, DebugSidecarMessageParser, DebugSidecarMessageQueue;
var init_sidecar_protocol = __esm({
  "packages/debug-adapter/src/sidecar-protocol.ts"() {
    "use strict";
    DEBUG_SIDECAR_PROTOCOL = "uttori-asm-debug-sidecar";
    DEBUG_SIDECAR_PROTOCOL_VERSION = 1;
    DEBUG_SIDECAR_COMMANDS = Object.freeze([
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
      "capture",
      "ping",
      "shutdown"
    ]);
    DEBUG_SIDECAR_EVENTS = Object.freeze([
      "stopped",
      "continued",
      "terminated",
      "breakpoint",
      "output"
    ]);
    DEFAULT_DEBUG_SIDECAR_LIMITS = Object.freeze({
      maxFrameBytes: 1048576,
      maxBufferedBytes: 2097152,
      maxMemoryReadBytes: 1048576,
      maxDisassemblyInstructions: 4096,
      maxBreakpoints: 4096,
      maxTraceBatchEvents: 4096,
      maxQueuedMessages: 1024,
      maxQueuedBytes: 8388608
    });
    isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
    listed = (values, value) => typeof value === "string" && values.some((item) => item === value);
    positiveInteger = (value) => typeof value === "number" && Number.isSafeInteger(value) && value > 0;
    nonNegativeInteger = (value) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
    sessionPattern = /^[\w-]{32,128}$/;
    assertRequestBounds = (command, args, limits) => {
      const record2 = args ?? {};
      if (!isRecord(record2)) {
        throw new Error("Sidecar request arguments must be an object.");
      }
      if (command === "readMemory") {
        const count = record2.count;
        if (!nonNegativeInteger(count) || count > limits.maxMemoryReadBytes) {
          throw new Error(`Memory read count must be between 0 and ${limits.maxMemoryReadBytes}.`);
        }
      }
      if (command === "disassemble") {
        const count = record2.count;
        if (!nonNegativeInteger(count) || count > limits.maxDisassemblyInstructions) {
          throw new Error(
            `Disassembly count must be between 0 and ${limits.maxDisassemblyInstructions}.`
          );
        }
      }
      if (command === "setBreakpoints") {
        const breakpoints = record2.breakpoints;
        if (!Array.isArray(breakpoints) || breakpoints.length > limits.maxBreakpoints) {
          throw new Error(`Breakpoint count must be between 0 and ${limits.maxBreakpoints}.`);
        }
      }
      if (command === "readTrace") {
        const maxEvents = record2.maxEvents;
        if (!positiveInteger(maxEvents) || maxEvents > limits.maxTraceBatchEvents) {
          throw new Error(`Trace batch size must be between 1 and ${limits.maxTraceBatchEvents}.`);
        }
      }
    };
    LIMIT_NAMES = [
      "maxFrameBytes",
      "maxBufferedBytes",
      "maxMemoryReadBytes",
      "maxDisassemblyInstructions",
      "maxBreakpoints",
      "maxTraceBatchEvents",
      "maxQueuedMessages",
      "maxQueuedBytes"
    ];
    validateLimits = (limits) => {
      for (const name of LIMIT_NAMES) {
        if (!positiveInteger(limits[name])) {
          throw new Error(`${name} must be a positive safe integer.`);
        }
      }
      if (limits.maxBufferedBytes < limits.maxFrameBytes + 4) {
        throw new Error("maxBufferedBytes must hold at least one complete framed message.");
      }
    };
    encodeDebugSidecarMessage = (message, limits = DEFAULT_DEBUG_SIDECAR_LIMITS) => {
      validateLimits(limits);
      assertDebugSidecarMessage(message, limits);
      const body = Buffer.from(JSON.stringify(message), "utf8");
      if (body.length > limits.maxFrameBytes) {
        throw new Error(`Sidecar frame exceeds ${limits.maxFrameBytes} bytes.`);
      }
      const frame = Buffer.allocUnsafe(body.length + 4);
      frame.writeUInt32BE(body.length, 0);
      body.copy(frame, 4);
      return frame;
    };
    DebugSidecarMessageParser = class {
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
        if (this.#buffer.length + chunk.length > this.#limits.maxBufferedBytes) {
          throw new Error(`Sidecar receive buffer exceeds ${this.#limits.maxBufferedBytes} bytes.`);
        }
        this.#buffer = Buffer.concat([this.#buffer, chunk]);
        const messages = [];
        while (this.#buffer.length >= 4) {
          const length = this.#buffer.readUInt32BE(0);
          if (length === 0) {
            throw new Error("Sidecar frame body cannot be empty.");
          }
          if (length > this.#limits.maxFrameBytes) {
            throw new Error(`Sidecar frame declares ${length} bytes, above the configured limit.`);
          }
          if (this.#buffer.length < length + 4) {
            break;
          }
          const body = this.#buffer.subarray(4, length + 4);
          this.#buffer = this.#buffer.subarray(length + 4);
          let decoded;
          try {
            decoded = JSON.parse(body.toString("utf8"));
          } catch {
            throw new Error("Sidecar frame contains invalid JSON.");
          }
          assertDebugSidecarMessage(decoded, this.#limits);
          if (decoded.sequence <= this.#lastSequence) {
            throw new Error(
              `Sidecar sequence ${decoded.sequence} is not greater than ${this.#lastSequence}.`
            );
          }
          this.#lastSequence = decoded.sequence;
          messages.push(decoded);
        }
        return messages;
      }
    };
    DebugSidecarMessageQueue = class {
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
        if (this.#frames.length >= this.#limits.maxQueuedMessages || this.#bytes + frame.length > this.#limits.maxQueuedBytes) {
          throw new Error("Sidecar outgoing queue exceeded its backpressure limit.");
        }
        this.#frames.push(frame);
        this.#bytes += frame.length;
      }
      /**
       * Removes the oldest encoded frame.
       * @returns {Uint8Array | undefined} Oldest frame or undefined when empty.
       */
      dequeue() {
        const frame = this.#frames.shift();
        if (frame) {
          this.#bytes -= frame.length;
        }
        return frame;
      }
    };
  }
});

// packages/debug-adapter/src/node-stdio-transport.ts
var DEBUG_SIDECAR_SESSION_ENV;
var init_node_stdio_transport = __esm({
  "packages/debug-adapter/src/node-stdio-transport.ts"() {
    "use strict";
    DEBUG_SIDECAR_SESSION_ENV = "UTTORI_ASM_DEBUG_SESSION";
  }
});

// packages/debug-adapter/src/trace-buffer.ts
var init_trace_buffer = __esm({
  "packages/debug-adapter/src/trace-buffer.ts"() {
    "use strict";
  }
});

// packages/debug-adapter/src/replay-backend.ts
var init_replay_backend = __esm({
  "packages/debug-adapter/src/replay-backend.ts"() {
    "use strict";
  }
});

// packages/debug-adapter/src/sidecar-backend.ts
var init_sidecar_backend = __esm({
  "packages/debug-adapter/src/sidecar-backend.ts"() {
    "use strict";
  }
});

// packages/debug-adapter/src/sidecar-client.ts
var init_sidecar_client = __esm({
  "packages/debug-adapter/src/sidecar-client.ts"() {
    "use strict";
  }
});

// packages/debug-adapter/src/sidecar-server.ts
function assertShutdownCommand(command) {
  if (command !== "shutdown") {
    throw new Error(`Unsupported command '${command}'.`);
  }
}
var isStepKind, isRecord2, record, integer, positiveInteger2, string, optionalPositiveInteger, boolean, address, addresses, asError, DebugSidecarServer;
var init_sidecar_server = __esm({
  "packages/debug-adapter/src/sidecar-server.ts"() {
    "use strict";
    init_contracts();
    init_sidecar_protocol();
    init_capture_v2();
    isStepKind = (value) => value === "instruction" || value === "over" || value === "in" || value === "out";
    isRecord2 = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
    record = (value, context) => {
      if (!isRecord2(value)) {
        throw new Error(`${context} must be an object.`);
      }
      return value;
    };
    integer = (value, context, minimum = 0) => {
      if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum) {
        throw new Error(`${context} must be a safe integer greater than or equal to ${minimum}.`);
      }
      return value;
    };
    positiveInteger2 = (value, context) => integer(value, context, 1);
    string = (value, context) => {
      if (typeof value !== "string" || value.length === 0) {
        throw new Error(`${context} must be a non-empty string.`);
      }
      return value;
    };
    optionalPositiveInteger = (value, context) => value === void 0 ? void 0 : positiveInteger2(value, context);
    boolean = (value, context, defaultValue) => {
      if (value === void 0) {
        return defaultValue;
      }
      if (typeof value !== "boolean") {
        throw new Error(`${context} must be boolean.`);
      }
      return value;
    };
    address = (value, context) => {
      const candidate = record(value, context);
      if (typeof candidate.architecture !== "string" || candidate.architecture.length === 0) {
        throw new Error(`${context}.architecture must be a non-empty string.`);
      }
      if (typeof candidate.addressSpace !== "string" || candidate.addressSpace.length === 0) {
        throw new Error(`${context}.addressSpace must be a non-empty string.`);
      }
      const outputOffset = candidate.outputOffset === void 0 ? void 0 : integer(candidate.outputOffset, `${context}.outputOffset`);
      return {
        architecture: candidate.architecture,
        addressSpace: candidate.addressSpace,
        address: integer(candidate.address, `${context}.address`),
        ...outputOffset === void 0 ? {} : { outputOffset }
      };
    };
    addresses = (value, context) => {
      if (!Array.isArray(value)) {
        throw new Error(`${context} must be an array.`);
      }
      return value.map((entry, index) => address(entry, `${context}[${index}]`));
    };
    asError = (error) => error instanceof Error ? error : new Error(String(error));
    DebugSidecarServer = class {
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
        if (this.#closed) {
          return;
        }
        this.#closed = true;
        this.#eventSubscription.dispose();
        await this.#writeTail.catch(() => void 0);
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
            capabilities: this.#implementation.capabilities
          };
        }
        if (request.command === "connect") {
          await this.#implementation.connect({
            reset: boolean(args.reset, "Connect reset", true)
          });
          return { capabilities: this.#implementation.capabilities };
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
          const kind = args.kind;
          if (typeof kind !== "string" || !isStepKind(kind)) {
            throw new Error(`Unsupported step kind '${String(kind)}'.`);
          }
          await this.#implementation.step(positiveInteger2(args.threadId, "Step threadId"), kind);
          return {};
        }
        if (request.command === "threads") {
          return this.#implementation.threads();
        }
        if (request.command === "stackFrames") {
          return this.#implementation.stackFrames(
            positiveInteger2(args.threadId, "Stack frames threadId")
          );
        }
        if (request.command === "registers") {
          return this.#implementation.registers(positiveInteger2(args.frameId, "Registers frameId"));
        }
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
        if (request.command === "setBreakpoints") {
          return this.#implementation.setBreakpoints(
            addresses(args.breakpoints, "Breakpoint addresses")
          );
        }
        if (request.command === "disassemble") {
          return this.#implementation.disassemble(
            address(args.address, "Disassembly address"),
            integer(args.count, "Disassembly count")
          );
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
          if (args.detail !== void 0 && args.detail !== "pc" && args.detail !== "full") {
            throw new Error("Trace detail must be pc or full.");
          }
          await this.#implementation.startTrace({
            architecture: string(args.architecture, "Trace architecture"),
            addressSpace: string(args.addressSpace, "Trace address space"),
            ...args.detail === void 0 ? {} : { detail: args.detail }
          });
          return {};
        }
        if (request.command === "readTrace") {
          return this.#implementation.readTrace(positiveInteger2(args.maxEvents, "Trace batch size"));
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
        void this.#send(this.#eventEnvelope(event)).catch(
          (error) => this.close(asError(error))
        );
      }
      #eventEnvelope(event) {
        if (event.type === "stopped") {
          return this.#envelope({
            type: "event",
            event: "stopped",
            body: { reason: event.reason, threadId: event.threadId }
          });
        }
        if (event.type === "continued") {
          return this.#envelope({
            type: "event",
            event: "continued",
            body: { threadId: event.threadId, allThreads: event.allThreads }
          });
        }
        if (event.type === "terminated") {
          return this.#envelope({
            type: "event",
            event: "terminated",
            body: { restart: event.restart }
          });
        }
        if (event.type === "breakpoint") {
          return this.#envelope({
            type: "event",
            event: "breakpoint",
            body: { breakpoint: event.breakpoint }
          });
        }
        return this.#envelope({
          type: "event",
          event: "output",
          body: { category: event.category, text: event.text }
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
          ...message
        };
      }
      #send(message) {
        if (this.#closed) {
          return Promise.reject(new Error("Sidecar server is closed."));
        }
        this.#outgoing.enqueue(message);
        const write2 = this.#writeTail.then(async () => {
          let frame = this.#outgoing.dequeue();
          while (frame) {
            await this.#write(frame);
            frame = this.#outgoing.dequeue();
          }
          return;
        });
        this.#writeTail = write2.catch(() => void 0);
        return write2;
      }
    };
  }
});

// packages/debug-adapter/src/capture-context.ts
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, open, readdir, readFile, link, unlink } from "node:fs/promises";
import path from "node:path";
var isRecord3, digestFile, verifyCaptureContext;
var init_capture_context = __esm({
  "packages/debug-adapter/src/capture-context.ts"() {
    "use strict";
    isRecord3 = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
    digestFile = async (file, signal) => {
      const hash = createHash("sha256");
      for await (const bytes of createReadStream(file, { signal })) {
        if (!Buffer.isBuffer(bytes)) {
          throw new Error(`Expected binary capture context data in ${path.basename(file)}.`);
        }
        hash.update(bytes);
      }
      return hash.digest("hex");
    };
    verifyCaptureContext = async (directory, identity, signal) => {
      signal?.throwIfAborted();
      const metadataFile = path.join(directory, "manifest.json");
      const metadataStat = await lstat(metadataFile);
      if (!metadataStat.isFile() || metadataStat.isSymbolicLink() || metadataStat.size > 1048576) {
        throw new Error("Invalid capture context manifest.");
      }
      const manifest = JSON.parse(await readFile(metadataFile, "utf8"));
      if (!isRecord3(manifest)) {
        throw new Error("Invalid capture context manifest.");
      }
      const producer = isRecord3(manifest.producer) ? manifest.producer : void 0;
      if (manifest.format !== "uttori-capture-context" || manifest.version !== 1 || manifest.romContentSha256 !== identity.romContentSha256 || !isRecord3(producer) || producer.id !== identity.producer.id || producer.revision !== identity.producer.revision || !isRecord3(manifest.files)) {
        throw new Error("Capture context requires the matching ROM and emulator build.");
      }
      const files = manifest.files;
      for (const name of [
        "start.bst",
        "wram-start.bin",
        "wram-end.bin",
        "inputs.bin",
        "identity.txt",
        "machine.json",
        "start-clock.txt",
        "end-clock.txt",
        "boundaries.json"
      ]) {
        if (!files[name]) {
          throw new Error(`Capture context is missing ${name}.`);
        }
      }
      for (const [name, artifact] of Object.entries(files)) {
        signal?.throwIfAborted();
        if (!/^(?:identity\.txt|machine\.json|start\.bst|wram-(?:start|end)\.bin|inputs\.bin|milestones\.jsonl|(?:start|end)-clock\.txt|boundaries\.json|graphics\.act2|screen-\d+\.png)$/.test(
          name
        ) || !isRecord3(artifact) || typeof artifact.bytes !== "number" || !Number.isSafeInteger(artifact.bytes) || artifact.bytes < 0 || typeof artifact.sha256 !== "string" || !/^[\da-f]{64}$/.test(artifact.sha256)) {
          throw new Error("Invalid capture context artifact descriptor.");
        }
        const file = path.join(directory, name), stat2 = await lstat(file);
        if (!stat2.isFile() || stat2.isSymbolicLink() || stat2.size !== artifact.bytes || name === "start.bst" && (stat2.size < 538 || stat2.size > 32 * 1048576) || name.startsWith("wram-") && stat2.size !== 131072 || name === "inputs.bin" && stat2.size % 18) {
          throw new Error(`Capture context artifact size/type mismatch: ${name}.`);
        }
        if (await digestFile(file, signal) !== artifact.sha256) {
          throw new Error(`Capture context checksum mismatch: ${name}.`);
        }
      }
    };
  }
});

// packages/debug-adapter/src/capture-file.ts
var init_capture_file = __esm({
  "packages/debug-adapter/src/capture-file.ts"() {
    "use strict";
  }
});

// packages/debug-adapter/src/index.ts
var init_src = __esm({
  "packages/debug-adapter/src/index.ts"() {
    "use strict";
    init_conformance();
    init_contracts();
    init_debug_expression();
    init_dap();
    init_mock_script();
    init_node_stdio_transport();
    init_replay_backend();
    init_sidecar_backend();
    init_sidecar_client();
    init_sidecar_protocol();
    init_sidecar_server();
    init_trace_buffer();
    init_capture_v2();
    init_capture_file();
    init_capture_context();
  }
});

// packages/debug-sidecar-ares/src/sidecar.ts
init_src();
import { readFile as readFile2 } from "node:fs/promises";
import path3 from "node:path";

// packages/debug-sidecar-ares/src/ares-process-host.ts
init_src();
import { spawn } from "node:child_process";
import { createHash as createHash2 } from "node:crypto";
import { createReadStream as createReadStream2 } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import net2 from "node:net";
import path2 from "node:path";

// packages/debug-sidecar-ares/src/gdb-rsp-client.ts
var asError2 = (error) => error instanceof Error ? error : new Error(String(error));
var checksum = (payload) => {
  let value = 0;
  for (let index = 0; index < payload.length; index++) {
    value = value + payload[index] & 255;
  }
  return value;
};
var escapedPayload = (payload) => {
  const result = [];
  for (const byte of Buffer.from(payload, "ascii")) {
    if (byte === 35 || byte === 36 || byte === 42 || byte === 125) {
      result.push(125, byte ^ 32);
    } else {
      result.push(byte);
    }
  }
  return Uint8Array.from(result);
};
var unescapePayload = (payload) => {
  if (!payload.includes(125)) {
    if (payload.includes(42)) {
      throw new Error("RSP run-length encoded payloads are not supported on the ares channel.");
    }
    return payload.toString("ascii");
  }
  const result = Buffer.allocUnsafe(payload.length);
  let length = 0;
  for (let index = 0; index < payload.length; index++) {
    const byte = payload[index];
    if (byte === 42) {
      throw new Error("RSP run-length encoded payloads are not supported on the ares channel.");
    }
    if (byte !== 125) {
      result[length++] = byte;
      continue;
    }
    ++index;
    const escaped = index < payload.length ? payload[index] : void 0;
    if (escaped === void 0) {
      throw new Error("RSP payload ends inside an escape sequence.");
    }
    result[length++] = escaped ^ 32;
  }
  return result.toString("ascii", 0, length);
};
var hexDigit = (byte) => {
  if (byte >= 48 && byte <= 57) {
    return byte - 48;
  }
  if (byte >= 65 && byte <= 70) {
    return byte - 65 + 10;
  }
  if (byte >= 97 && byte <= 102) {
    return byte - 97 + 10;
  }
  return -1;
};
var stop = (payload) => {
  if (!/^[ST][\dA-Fa-f]{2}/.test(payload)) {
    return void 0;
  }
  return { signal: Number.parseInt(payload.slice(1, 3), 16), payload };
};
var GdbRspClient = class {
  #transport;
  #requestTimeoutMs;
  #maxPacketBytes;
  #maxBufferedBytes;
  #stopListeners = /* @__PURE__ */ new Set();
  #closeListeners = /* @__PURE__ */ new Set();
  #dataSubscription;
  #closeSubscription;
  #buffer = Buffer.alloc(0);
  /** Unconsumed bytes occupy [start, end). Capacity grows geometrically within the receive bound. */
  #start = 0;
  #end = 0;
  /** First unchecked position for '#', or the delimiter while awaiting checksum bytes. */
  #scan = 1;
  #pending;
  #writeTail = Promise.resolve();
  #started = false;
  #closed = false;
  #closeError;
  /** @param {GdbRspClientOptions} options Transport and protocol safety bounds. */
  constructor(options) {
    this.#transport = options.transport;
    this.#requestTimeoutMs = options.requestTimeoutMs ?? 3e3;
    this.#maxPacketBytes = options.maxPacketBytes ?? 1048576;
    this.#maxBufferedBytes = options.maxBufferedBytes ?? this.#maxPacketBytes * 2;
    for (const [name, value] of [
      ["RSP request timeout", this.#requestTimeoutMs],
      ["RSP maximum packet bytes", this.#maxPacketBytes],
      ["RSP maximum buffered bytes", this.#maxBufferedBytes]
    ]) {
      if (!Number.isSafeInteger(value) || value <= 0) {
        throw new Error(`${name} must be a positive safe integer.`);
      }
    }
    if (this.#maxBufferedBytes < this.#maxPacketBytes + 4) {
      throw new Error("RSP receive buffer must hold one maximum-sized framed packet.");
    }
    this.#dataSubscription = this.#transport.onData((data) => this.#receive(data));
    this.#closeSubscription = this.#transport.onClose(
      (error) => this.#fail(error ?? new Error("RSP transport closed."), false)
    );
  }
  /** @returns {boolean} Whether the client has permanently closed. */
  get closed() {
    return this.#closed;
  }
  /** @returns {Promise<void>} Completion after writing the required initial acknowledgement byte. */
  async start() {
    if (this.#closed) {
      throw new Error("RSP client is closed.");
    }
    if (this.#started) {
      throw new Error("RSP client has already started.");
    }
    this.#started = true;
    await this.#write(Uint8Array.of(43));
  }
  /**
   * Subscribes to asynchronous stop packets.
   * @param {(event: GdbRspStop) => void} listener Stop-event consumer.
   * @returns {DebugSubscription} Disposable subscription.
   */
  onStop(listener) {
    this.#stopListeners.add(listener);
    return { dispose: () => this.#stopListeners.delete(listener) };
  }
  /**
   * Subscribes to terminal RSP transport or protocol failure.
   * @param {(error: Error) => void} listener Close-error consumer.
   * @returns {DebugSubscription} Disposable subscription.
   */
  onClose(listener) {
    if (this.#closeError) {
      queueMicrotask(() => listener(this.#closeError));
      return { dispose: () => void 0 };
    }
    this.#closeListeners.add(listener);
    return { dispose: () => this.#closeListeners.delete(listener) };
  }
  /**
   * Sends one packet and waits for its non-stop response.
   * @param {string} command RSP command payload.
   * @returns {Promise<string>} Response payload.
   */
  request(command) {
    return this.#request(command, false);
  }
  /**
   * Sends a handshake packet such as `?` whose response is itself a stop packet.
   * @param {string} command RSP command payload.
   * @returns {Promise<string>} Stop response payload.
   */
  requestStop(command) {
    return this.#request(command, true);
  }
  /** @returns {Promise<void>} Completion after writing continue. */
  continue() {
    return this.#sendExecutionCommand("c");
  }
  /** @returns {Promise<void>} Completion after writing one-instruction step. */
  step() {
    return this.#sendExecutionCommand("s");
  }
  /** @returns {Promise<void>} Completion after writing the out-of-band interrupt byte. */
  interrupt() {
    this.#assertReady();
    if (this.#pending) {
      return Promise.reject(new Error("An RSP request is already pending."));
    }
    return this.#write(Uint8Array.of(3));
  }
  /** @returns {Promise<void>} Completion after closing the transport. */
  async close() {
    if (this.#closed) {
      return;
    }
    this.#fail(new Error("RSP client closed."), false);
    await this.#transport.close();
  }
  #request(command, acceptStop) {
    try {
      this.#assertReady();
    } catch (error) {
      return Promise.reject(asError2(error));
    }
    if (this.#pending) {
      return Promise.reject(new Error("An RSP request is already pending."));
    }
    let packet;
    try {
      packet = this.#packet(command);
    } catch (error) {
      return Promise.reject(asError2(error));
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => this.#fail(new Error(`RSP request '${command}' timed out.`)),
        this.#requestTimeoutMs
      );
      this.#pending = { acceptStop, resolve, reject, timer };
      void this.#write(packet).catch((error) => this.#fail(asError2(error)));
    });
  }
  #sendExecutionCommand(command) {
    this.#assertReady();
    if (this.#pending) {
      return Promise.reject(new Error("An RSP request is already pending."));
    }
    return this.#write(this.#packet(command));
  }
  #packet(command) {
    const payload = escapedPayload(command);
    if (payload.length > this.#maxPacketBytes) {
      throw new Error(`RSP payload exceeds ${this.#maxPacketBytes} bytes.`);
    }
    const sum = checksum(payload).toString(16).padStart(2, "0");
    return Buffer.concat([Buffer.from("$", "ascii"), payload, Buffer.from(`#${sum}`, "ascii")]);
  }
  #receive(data) {
    if (this.#closed) {
      return;
    }
    try {
      this.#append(data);
      while (this.#start < this.#end) {
        if (this.#buffer[this.#start] !== 36) {
          const next = this.#buffer.subarray(this.#start, this.#end).indexOf(36);
          if (next < 0) {
            this.#start = this.#end;
            break;
          }
          this.#start += next;
          this.#scan = this.#start + 1;
        }
        const offset = this.#buffer.subarray(this.#scan, this.#end).indexOf(35);
        if (offset < 0) {
          this.#scan = this.#end;
          if (this.#end - this.#start - 1 > this.#maxPacketBytes) {
            throw new Error(`RSP packet exceeds ${this.#maxPacketBytes} bytes.`);
          }
          return;
        }
        const hash = this.#scan + offset;
        this.#scan = hash;
        if (hash - this.#start - 1 > this.#maxPacketBytes) {
          throw new Error(`RSP packet exceeds ${this.#maxPacketBytes} bytes.`);
        }
        if (this.#end < hash + 3) {
          return;
        }
        const payload = this.#buffer.subarray(this.#start + 1, hash);
        const high = hexDigit(this.#buffer[hash + 1]);
        const low = hexDigit(this.#buffer[hash + 2]);
        this.#start = hash + 3;
        this.#scan = this.#start + 1;
        if (high < 0 || low < 0 || (high << 4 | low) !== checksum(payload)) {
          void this.#write(Uint8Array.of(45)).catch(
            (error) => this.#fail(asError2(error))
          );
          continue;
        }
        void this.#write(Uint8Array.of(43)).catch((error) => this.#fail(asError2(error)));
        this.#deliver(unescapePayload(payload));
      }
      this.#start = this.#end = 0;
      this.#scan = 1;
    } catch (error) {
      this.#fail(asError2(error));
    }
  }
  /** Append one owned transport fragment without repeatedly copying its accumulated prefix.
   * @param {Uint8Array} data Incoming bytes. The transport may reuse them after this call returns.
   * @returns {void} Grows/compacts only when tail capacity is exhausted. Exceeding the bound throws.
   */
  #append(data) {
    const used = this.#end - this.#start;
    const required = used + data.length;
    if (required > this.#maxBufferedBytes) {
      throw new Error(`RSP receive buffer exceeds ${this.#maxBufferedBytes} bytes.`);
    }
    if (this.#end + data.length > this.#buffer.length) {
      if (required > this.#buffer.length) {
        const capacity = Math.min(
          this.#maxBufferedBytes,
          Math.max(required, 4096, this.#buffer.length * 2)
        );
        const next = Buffer.allocUnsafe(capacity);
        this.#buffer.copy(next, 0, this.#start, this.#end);
        this.#buffer = next;
      } else {
        this.#buffer.copy(this.#buffer, 0, this.#start, this.#end);
      }
      this.#scan -= this.#start;
      this.#start = 0;
      this.#end = used;
    }
    this.#buffer.set(data, this.#end);
    this.#end += data.length;
  }
  #deliver(payload) {
    const stopped = stop(payload);
    if (stopped && !this.#pending?.acceptStop) {
      for (const listener of this.#stopListeners) {
        listener(stopped);
      }
      return;
    }
    const pending = this.#pending;
    if (!pending) {
      throw new Error("RSP response arrived without a pending request.");
    }
    clearTimeout(pending.timer);
    this.#pending = void 0;
    pending.resolve(payload);
  }
  #assertReady() {
    if (this.#closed) {
      throw new Error("RSP client is closed.");
    }
    if (!this.#started) {
      throw new Error("RSP client has not started.");
    }
  }
  #write(data) {
    const write2 = this.#writeTail.then(() => {
      if (this.#closed) {
        throw new Error("RSP client is closed.");
      }
      return this.#transport.write(data);
    });
    this.#writeTail = write2.catch(() => void 0);
    return write2;
  }
  #fail(error, closeTransport = true) {
    if (this.#closed) {
      return;
    }
    this.#closed = true;
    this.#buffer = Buffer.alloc(0);
    this.#start = this.#end = 0;
    this.#scan = 1;
    this.#closeError = error;
    this.#dataSubscription.dispose();
    this.#closeSubscription.dispose();
    if (this.#pending) {
      clearTimeout(this.#pending.timer);
      this.#pending.reject(error);
      this.#pending = void 0;
    }
    this.#stopListeners.clear();
    for (const listener of this.#closeListeners) {
      listener(error);
    }
    this.#closeListeners.clear();
    if (closeTransport) {
      void this.#transport.close().catch(() => void 0);
    }
  }
};

// packages/debug-sidecar-ares/src/node-tcp-gdb-rsp-transport.ts
import net from "node:net";
var NodeTcpGdbRspTransport = class _NodeTcpGdbRspTransport {
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
      for (const listener of this.#dataListeners) {
        listener(bytes);
      }
    });
    this.#socket.on("error", (error) => {
      this.#terminalError = error;
    });
    this.#socket.on("close", () => this.#notifyClosed(this.#terminalError));
  }
  /**
   * Opens a bounded connection to a numeric loopback address.
   * @param {NodeTcpGdbRspTransportOptions} options Loopback endpoint and deadlines.
   * @returns {Promise<NodeTcpGdbRspTransport>} Connected transport.
   */
  static async connect(options) {
    const host = options.host ?? "127.0.0.1";
    if (host !== "127.0.0.1" && host !== "::1") {
      throw new Error("RSP transport host must be a numeric loopback address.");
    }
    if (!Number.isSafeInteger(options.port) || options.port < 1 || options.port > 65535) {
      throw new Error("RSP transport port must be an integer between 1 and 65535.");
    }
    const connectTimeoutMs = options.connectTimeoutMs ?? 3e3;
    const shutdownTimeoutMs = options.shutdownTimeoutMs ?? 1e3;
    for (const [name, value] of [
      ["RSP connect timeout", connectTimeoutMs],
      ["RSP shutdown timeout", shutdownTimeoutMs]
    ]) {
      if (!Number.isSafeInteger(value) || value <= 0) {
        throw new Error(`${name} must be a positive safe integer.`);
      }
    }
    const socket = new net.Socket();
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        socket.destroy();
        reject(new Error(`RSP connection to ${host}:${options.port} timed out.`));
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
    return new _NodeTcpGdbRspTransport(socket, shutdownTimeoutMs);
  }
  /** @inheritdoc */
  write(data) {
    if (this.#closed) {
      return Promise.reject(new Error("RSP TCP transport is closed."));
    }
    return new Promise((resolve, reject) => {
      this.#socket.write(data, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
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
    if (this.#closed) {
      return;
    }
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
    if (this.#notified) {
      return;
    }
    this.#notified = true;
    this.#closed = true;
    for (const listener of this.#closeListeners) {
      listener(error);
    }
    this.#closeListeners.clear();
    this.#dataListeners.clear();
  }
};

// packages/debug-sidecar-ares/src/ares-process-host.ts
var ARES_RUNTIME_MANIFEST_VERSION = 1;
var sha256Pattern = /^[\dA-Fa-f]{64}$/;
var revisionPattern = /^[\dA-Fa-f]{40}$/;
var checkedSha256 = (value, name) => {
  if (!sha256Pattern.test(value)) {
    throw new Error(`${name} must be a 64-digit SHA-256 value.`);
  }
  return value.toLowerCase();
};
var checkedRevision = (value, name) => {
  if (!revisionPattern.test(value)) {
    throw new Error(`${name} must be a 40-digit git revision.`);
  }
  return value.toLowerCase();
};
var checkedAbsolutePath = (value, name) => {
  if (!path2.isAbsolute(value)) {
    throw new Error(`${name} must be an absolute path.`);
  }
  return path2.normalize(value);
};
var checkedResourcePath = (value) => {
  if (value === "." || value.includes("\\") || path2.posix.isAbsolute(value) || path2.posix.normalize(value) !== value || value.split("/").includes("..")) {
    throw new Error(`Ares resource path '${value}' must be normalized and relative.`);
  }
  return value;
};
var errorValue = (error) => error instanceof Error ? error : new Error(String(error));
var waitWithTimeout = async (promise, timeoutMs) => new Promise((resolve) => {
  const timer = setTimeout(() => resolve(void 0), timeoutMs);
  timer.unref();
  void promise.then((value) => {
    clearTimeout(timer);
    resolve(value);
    return;
  });
});
var NodeAresProcessHandle = class {
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
    if (!this.#exited) {
      this.#child.kill(signal);
    }
  }
};
var nodeSha256 = async (file) => {
  const digest = createHash2("sha256");
  for await (const chunk of createReadStream2(file)) {
    if (!Buffer.isBuffer(chunk)) {
      throw new Error(`Expected binary bytes while hashing ${file}.`);
    }
    digest.update(chunk);
  }
  return digest.digest("hex");
};
var reserveLoopbackPort = async () => {
  const server = net2.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen({ host: "127.0.0.1", port: 0, exclusive: true }, resolve);
  });
  const address2 = server.address();
  if (!address2 || typeof address2 === "string") {
    server.close();
    throw new Error("Unable to reserve an IPv4 loopback port for ares.");
  }
  await new Promise(
    (resolve, reject) => server.close((error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    })
  );
  return address2.port;
};
var nodeAresProcessRuntime = Object.freeze({
  platform: process.platform,
  architecture: process.arch,
  sha256: nodeSha256,
  reserveLoopbackPort,
  launch: (options) => new NodeAresProcessHandle(options),
  connect: (port, timeoutMs) => NodeTcpGdbRspTransport.connect({
    host: "127.0.0.1",
    port,
    connectTimeoutMs: timeoutMs
  }),
  delay: (milliseconds) => new Promise((resolve) => {
    const timer = setTimeout(resolve, milliseconds);
    timer.unref();
  })
});
var isRecord4 = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
var manifestRecord = (value) => {
  if (!isRecord4(value)) {
    throw new Error("Ares runtime manifest must be an object.");
  }
  return value;
};
var NODE_PLATFORMS = [
  "aix",
  "android",
  "darwin",
  "freebsd",
  "haiku",
  "linux",
  "openbsd",
  "sunos",
  "win32",
  "cygwin",
  "netbsd"
];
var manifestPlatform = (value) => {
  const platform = NODE_PLATFORMS.find((candidate) => candidate === value);
  if (!platform) {
    throw new Error(`Ares manifest platform '${value}' is not a Node platform.`);
  }
  return platform;
};
var manifestString = (value, name) => {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${name} must be a non-empty string.`);
  }
  return value;
};
var parseAresRuntimeManifest = (value) => {
  const manifest = manifestRecord(value);
  if (manifest.schemaVersion !== ARES_RUNTIME_MANIFEST_VERSION) {
    throw new Error(`Unsupported ares runtime manifest version ${String(manifest.schemaVersion)}.`);
  }
  if (manifest.emulator !== "ares") {
    throw new Error("Runtime manifest is not for ares.");
  }
  if (manifest.frontend !== void 0 && manifest.frontend !== "headless" && manifest.frontend !== "desktop") {
    throw new Error("Ares runtime frontend must be 'headless' or 'desktop'.");
  }
  const buildConfiguration = manifestString(
    manifest.buildConfiguration,
    "Ares build configuration"
  );
  if (!Array.isArray(manifest.resources)) {
    throw new Error("Ares runtime manifest resources must be an array.");
  }
  const resources = Object.freeze(
    manifest.resources.map((entry, index) => {
      const resource = manifestRecord(entry);
      const resourcePath = checkedResourcePath(
        manifestString(resource.path, `Ares resource ${index} path`)
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
  if (new Set(resources.map((resource) => resource.path)).size !== resources.length) {
    throw new Error("Ares runtime manifest contains duplicate resource paths.");
  }
  return Object.freeze({
    schemaVersion: ARES_RUNTIME_MANIFEST_VERSION,
    emulator: "ares",
    ...manifest.frontend === void 0 ? {} : { frontend: manifest.frontend },
    upstreamRevision: checkedRevision(
      manifestString(manifest.upstreamRevision, "Ares upstream revision"),
      "Ares upstream revision"
    ),
    headlessBaseRevision: checkedRevision(
      manifestString(manifest.headlessBaseRevision, "Ares headless base revision"),
      "Ares headless base revision"
    ),
    forkRevision: checkedRevision(
      manifestString(manifest.forkRevision, "Ares fork revision"),
      "Ares fork revision"
    ),
    headlessPatchSha256: checkedSha256(
      manifestString(manifest.headlessPatchSha256, "Ares headless patch SHA-256"),
      "Ares headless patch SHA-256"
    ),
    patchSha256: checkedSha256(
      manifestString(manifest.patchSha256, "Ares patch SHA-256"),
      "Ares patch SHA-256"
    ),
    executableSha256: checkedSha256(
      manifestString(manifest.executableSha256, "Ares executable SHA-256"),
      "Ares executable SHA-256"
    ),
    romSha256: checkedSha256(manifestString(manifest.romSha256, "ROM SHA-256"), "ROM SHA-256"),
    platform: manifestPlatform(manifestString(manifest.platform, "Ares manifest platform")),
    architecture: manifestString(manifest.architecture, "Ares manifest architecture"),
    buildConfiguration,
    resources
  });
};
var AresProcessHost = class {
  #executable;
  #rom;
  #runtimeDirectory;
  #manifest;
  #system;
  #fastBoot;
  #env;
  #startupTimeoutMs;
  #requestTimeoutMs;
  #shutdownTimeoutMs;
  #connectRetryMs;
  #maxOutputBytes;
  #onOutput;
  #runtime;
  #process;
  #port;
  #output = Buffer.alloc(0);
  #lifecycleTail = Promise.resolve();
  /** @param {AresProcessHostOptions} options Paths, manifest, bounds, and platform runtime. */
  constructor(options) {
    this.#executable = checkedAbsolutePath(options.executable, "Ares executable");
    this.#rom = checkedAbsolutePath(options.rom, "Ares ROM");
    this.#runtimeDirectory = checkedAbsolutePath(
      options.runtimeDirectory,
      "Ares runtime directory"
    );
    this.#manifest = parseAresRuntimeManifest(options.manifest);
    const executableRelative = path2.relative(this.#runtimeDirectory, this.#executable);
    if (executableRelative === "" || executableRelative === ".." || executableRelative.startsWith(`..${path2.sep}`) || path2.isAbsolute(executableRelative)) {
      throw new Error("Ares executable must be contained within its portable runtime directory.");
    }
    this.#system = options.system ?? "Super Famicom";
    if (this.#system.length === 0) {
      throw new Error("Ares system name must be non-empty.");
    }
    this.#fastBoot = options.fastBoot ?? true;
    this.#env = options.env ?? {};
    this.#startupTimeoutMs = options.startupTimeoutMs ?? 1e4;
    this.#requestTimeoutMs = options.requestTimeoutMs ?? 3e3;
    this.#shutdownTimeoutMs = options.shutdownTimeoutMs ?? 2e3;
    this.#connectRetryMs = options.connectRetryMs ?? 25;
    this.#maxOutputBytes = options.maxOutputBytes ?? 65536;
    this.#onOutput = options.onOutput;
    this.#runtime = options.runtime ?? nodeAresProcessRuntime;
    for (const [name, value] of [
      ["Ares startup timeout", this.#startupTimeoutMs],
      ["Ares RSP request timeout", this.#requestTimeoutMs],
      ["Ares shutdown timeout", this.#shutdownTimeoutMs],
      ["Ares connect retry delay", this.#connectRetryMs],
      ["Ares output limit", this.#maxOutputBytes]
    ]) {
      if (!Number.isSafeInteger(value) || value <= 0) {
        throw new Error(`${name} must be a positive safe integer.`);
      }
    }
  }
  /** @returns {AresRuntimeManifest} Normalized immutable launch identity. */
  get manifest() {
    return this.#manifest;
  }
  /** @returns {number | undefined} PID of the current emulator process. */
  get pid() {
    return this.#process?.pid;
  }
  /** @returns {string} Bounded tail of emulator stdout and stderr, never protocol stdout. */
  get output() {
    return this.#output.toString("utf8");
  }
  /**
   * Starts a fresh verified emulator for reset connects or reconnects to the preserved process.
   * @param {DebugBackendConnectOptions} options Backend reset policy.
   * @returns {Promise<GdbRspClient>} Connected, not-yet-started private RSP client.
   */
  createClient(options) {
    return this.#serializeLifecycle(async () => {
      let launched = false;
      if (options.reset ?? true) {
        await this.#terminateCurrent();
        await this.#launch();
        launched = true;
      } else if (!this.#process || this.#process.exited || this.#port === void 0) {
        throw new Error("Cannot reconnect to ares because no preserved process is running.");
      }
      try {
        return await this.#connect();
      } catch (error) {
        if (launched) {
          await this.#terminateCurrent();
        }
        throw error;
      }
    });
  }
  /** @returns {Promise<void>} Bounded graceful/forced cleanup of the owned emulator process. */
  terminate() {
    return this.#serializeLifecycle(() => this.#terminateCurrent());
  }
  async #launch() {
    await this.#verifyIdentity();
    const desktop = this.#manifest.frontend === "desktop";
    if (!desktop) {
      await mkdir(path2.join(this.#runtimeDirectory, "saves"), { recursive: true });
    }
    const port = await this.#runtime.reserveLoopbackPort();
    const args = [
      "--system",
      this.#system,
      "--settings-file",
      path2.join(this.#runtimeDirectory, "settings.bml"),
      ...desktop ? [
        `Developer/DebugServerPort=${port}`,
        "Developer/DebugServerEnabled=true",
        "Developer/DebugServerUseIPv4=true",
        "Boot/AwaitGDBClient=true",
        "Boot/Debugger=false",
        `Boot/Fast=${this.#fastBoot}`,
        // Switching focus to VS Code must not silently freeze capture or execution.
        "Input/Defocus=Allow",
        // Speculative/replayed frames would contaminate an executed-instruction trace.
        "General/RunAhead=false",
        "General/Rewind=false"
      ].flatMap((setting) => ["--setting", setting]) : [
        "--setting",
        `Paths/Saves=${path2.join(this.#runtimeDirectory, "saves")}`,
        "--gdb-port",
        String(port),
        "--gdb-ipv4",
        "--wait-on-gdb",
        "--quiet",
        ...this.#fastBoot ? ["--fast-boot"] : []
      ],
      this.#rom
    ];
    this.#output = Buffer.alloc(0);
    const processHandle = this.#runtime.launch({
      command: this.#executable,
      args,
      cwd: this.#runtimeDirectory,
      env: { ...this.#env, [DEBUG_SIDECAR_SESSION_ENV]: void 0 },
      onOutput: (stream, data) => this.#captureOutput(stream, data)
    });
    this.#process = processHandle;
    this.#port = port;
  }
  async #connect() {
    const processHandle = this.#process;
    const port = this.#port;
    if (!processHandle || port === void 0) {
      throw new Error("Ares process is not running.");
    }
    const deadline = Date.now() + this.#startupTimeoutMs;
    let lastError = new Error("Ares RSP listener was not ready.");
    while (Date.now() < deadline) {
      if (processHandle.exited) {
        throw await this.#exitError(processHandle, "before RSP connected");
      }
      try {
        const remaining = Math.max(1, deadline - Date.now());
        const transport = await this.#runtime.connect(port, Math.min(remaining, 250));
        return new GdbRspClient({ transport, requestTimeoutMs: this.#requestTimeoutMs });
      } catch (error) {
        lastError = errorValue(error);
      }
      await this.#runtime.delay(Math.min(this.#connectRetryMs, Math.max(1, deadline - Date.now())));
    }
    if (processHandle.exited) {
      throw await this.#exitError(processHandle, "before RSP connected");
    }
    throw new Error(
      `Ares RSP listener on 127.0.0.1:${port} was not ready within ${this.#startupTimeoutMs} ms: ${lastError.message}`
    );
  }
  async #verifyIdentity() {
    if (this.#runtime.platform !== this.#manifest.platform) {
      throw new Error(
        `Ares manifest platform '${this.#manifest.platform}' does not match '${this.#runtime.platform}'.`
      );
    }
    if (this.#runtime.architecture !== this.#manifest.architecture) {
      throw new Error(
        `Ares manifest architecture '${this.#manifest.architecture}' does not match '${this.#runtime.architecture}'.`
      );
    }
    const runtimeInfo = await stat(this.#runtimeDirectory).catch(() => void 0);
    if (runtimeInfo && !runtimeInfo.isDirectory()) {
      throw new Error("Ares runtime path exists but is not a directory.");
    }
    await this.#verifyHash(this.#executable, this.#manifest.executableSha256, "executable");
    await this.#verifyHash(this.#rom, this.#manifest.romSha256, "ROM");
    for (const resource of this.#manifest.resources) {
      await this.#verifyHash(
        path2.join(this.#runtimeDirectory, resource.path),
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
        `Unable to verify ares ${context} at '${file}': ${errorValue(error).message}`,
        { cause: error }
      );
    }
    if (actual !== expected) {
      throw new Error(
        `Ares ${context} SHA-256 mismatch: expected ${expected}, received ${actual}.`
      );
    }
  }
  async #terminateCurrent() {
    const processHandle = this.#process;
    this.#process = void 0;
    this.#port = void 0;
    if (!processHandle || processHandle.exited) {
      return;
    }
    processHandle.kill("SIGTERM");
    if (await waitWithTimeout(processHandle.waitForExit(), this.#shutdownTimeoutMs)) {
      return;
    }
    processHandle.kill("SIGKILL");
    await processHandle.waitForExit();
  }
  async #exitError(processHandle, context) {
    const exit = await processHandle.waitForExit();
    const status = exit.signal ? `signal ${exit.signal}` : `code ${String(exit.code)}`;
    const detail = this.output.trim();
    let suffix = ".";
    if (exit.error) {
      suffix = `: ${exit.error.message}`;
    } else if (detail) {
      suffix = `: ${detail}`;
    }
    return new Error(`Ares exited with ${status} ${context}${suffix}`);
  }
  #captureOutput(stream, data) {
    const text = Buffer.from(data).toString("utf8");
    this.#onOutput?.(stream, text);
    const tagged = Buffer.from(`[ares ${stream}] ${text}`, "utf8");
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
    if (!Number.isInteger(offset) || offset < 0 || offset >= this.#bytes.length) {
      return void 0;
    }
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
    if (!Number.isSafeInteger(end) || end > this.#bytes.length) {
      return void 0;
    }
    return this.#bytes.slice(offset, end);
  }
};

// packages/debug-sidecar-ares/src/ares-rsp-backend.ts
init_src();

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
function isCpu65816ModeKey(value) {
  return Object.hasOwn(cpu65816Modes, value);
}
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
  if (conditionalBranches.has(mnemonic)) {
    return { kind: "conditionalBranch", fallthrough: true };
  }
  if (mnemonic === "BRA" || mnemonic === "BRL") {
    return { kind: "jump", fallthrough: false };
  }
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
  if (mnemonic === "WAI") {
    return { kind: "wait", fallthrough: false };
  }
  if (mnemonic === "STP") {
    return { kind: "stop", fallthrough: false };
  }
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
if (entries.length !== 256) {
  throw new Error(`65816 opcode table has ${entries.length} entries.`);
}
var cpu65816Specifications = Object.freeze(
  entries.map((entry, opcode) => {
    const [mnemonic, modeKeyText] = entry.split(":");
    if (!mnemonic || !isCpu65816ModeKey(modeKeyText)) {
      throw new Error(`Invalid 65816 opcode entry '${entry}'.`);
    }
    const definition = cpu65816Modes[modeKeyText];
    let operandStatusEffect;
    if (mnemonic === "REP") {
      operandStatusEffect = "clearBits";
    } else if (mnemonic === "SEP") {
      operandStatusEffect = "setBits";
    }
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

// packages/plugin-snes/src/architectures/65816-decoder.ts
var flagValue = (value) => {
  if (value === true || value === 1) {
    return 1;
  }
  if (value === false || value === 0) {
    return 0;
  }
  return "unknown";
};
var resolvedWidthFlag = (state, flag) => {
  const emulation = flagValue(state.e);
  if (emulation === 1) {
    return 1;
  }
  const width = flagValue(state[flag]);
  if (width === 1) {
    return 1;
  }
  if (width === 0 && emulation === 0) {
    return 0;
  }
  return "unknown";
};
var readLittleEndian = (bytes, offset, width) => {
  let value = 0;
  for (let index = 0; index < width; index++) {
    value |= (bytes[offset + index] ?? 0) << index * 8;
  }
  return value >>> 0;
};
function byteAt(bytes, index) {
  return index >= 0 && index < bytes.length ? bytes[index] : void 0;
}
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
var operandsFor = (specification, bytes, logicalAddress) => {
  const firstOperandByte = byteAt(bytes, 1);
  const value8 = firstOperandByte ?? 0;
  const value16 = readLittleEndian(bytes, 1, 2);
  const value24 = readLittleEndian(bytes, 1, 3);
  switch (specification.mode) {
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
        { kind: "bank", value: byteAt(bytes, 2) ?? 0, width: 1 }
      ];
    default:
      return [];
  }
};
var targetFor = (specification, operands, state, logicalAddress) => {
  const operand = operands.length > 0 ? operands[0] : void 0;
  if (!operand) {
    return void 0;
  }
  if (operand.targetAddress !== void 0) {
    return operand.targetAddress;
  }
  if (operand.value === void 0) {
    return void 0;
  }
  if (specification.mode === "absoluteLong") {
    return operand.value;
  }
  if (specification.mode === "absolute") {
    const bank = (state.programBank ?? logicalAddress >>> 16) & 255;
    return bank << 16 | operand.value;
  }
  return void 0;
};
var referencesFor = (specification, operands, state, logicalAddress) => {
  const { mnemonic, mode: mode2 } = specification;
  const isBranch = conditionalBranches.has(mnemonic) || mnemonic === "BRA" || mnemonic === "BRL";
  const isCall = mnemonic === "JSR" || mnemonic === "JSL";
  const isJump = mnemonic === "JMP" || mnemonic === "JML";
  if (isBranch || isCall || isJump) {
    const target = targetFor(specification, operands, state, logicalAddress);
    let kind = "jump";
    if (isBranch) {
      kind = "branch";
    } else if (isCall) {
      kind = "call";
    }
    return [
      {
        kind,
        operandIndex: 0,
        ...target === void 0 ? {} : { address: target },
        ...mode2.includes("Indirect") ? { indirect: true } : {}
      }
    ];
  }
  if (mode2.includes("Indirect")) {
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
  const memoryMode = mode2.startsWith("direct") || mode2.startsWith("absolute") || mode2.startsWith("stackRelative");
  if (!memoryMode || operands[0]?.value === void 0) {
    return [];
  }
  if (mode2.startsWith("direct")) {
    return [
      {
        kind: "data",
        operandIndex: 0,
        ...state.directPage === void 0 ? {} : { address: state.directPage + operands[0].value & 65535 }
      }
    ];
  }
  if (!mode2.startsWith("absoluteLong") && mode2.startsWith("absolute")) {
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
var effectsFor = (specification, operands) => {
  const mask = operands[0]?.value;
  if (specification.operandStatusEffect && mask !== void 0) {
    return [{ kind: specification.operandStatusEffect, target: "p", mask }];
  }
  return specification.effects;
};
var buildInstruction = (specification, bytes, context, state) => {
  const operands = operandsFor(specification, bytes, context.logicalAddress);
  return {
    architecture: "snes.65816",
    specificationId: specification.id,
    opcode: specification.opcode[0],
    mnemonic: specification.mnemonic,
    mode: specification.mode,
    offset: context.offset,
    logicalAddress: context.logicalAddress & 16777215,
    bytes,
    size: bytes.length,
    operands,
    references: referencesFor(specification, operands, state, context.logicalAddress),
    flow: specification.flow,
    effects: effectsFor(specification, operands)
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
    const specification = opcode >= 0 && opcode < cpu65816Specifications.length ? cpu65816Specifications[opcode] : void 0;
    if (!specification) {
      return {
        kind: "error",
        code: "invalidOpcode",
        message: `Unknown 65816 opcode $${opcode.toString(16).padStart(2, "0")}.`,
        offset: context.offset
      };
    }
    const state = context.state ?? {};
    let sizes = [specification.minimumSize];
    if (specification.widthFlag) {
      const width = resolvedWidthFlag(state, specification.widthFlag);
      sizes = width === "unknown" ? [2, 3] : [width === 1 ? 2 : 3];
    }
    const minimumSize = Math.min(...sizes);
    const maximumSize = Math.max(...sizes);
    if (availableBytes < minimumSize) {
      return {
        kind: "error",
        code: "truncated",
        message: `Truncated ${specification.mnemonic}: requires at least ${minimumSize} byte(s), ${availableBytes} available.`,
        offset: context.offset,
        requiredBytes: minimumSize,
        availableBytes
      };
    }
    if (sizes.length === 1 && availableBytes < maximumSize) {
      return {
        kind: "error",
        code: "truncated",
        message: `Truncated ${specification.mnemonic}: requires ${maximumSize} byte(s), ${availableBytes} available.`,
        offset: context.offset,
        requiredBytes: maximumSize,
        availableBytes
      };
    }
    const availableSizes = sizes.filter((size) => size <= availableBytes);
    const alternatives = availableSizes.map((size) => {
      const bytes = context.source.readBytes(context.offset, size);
      if (!bytes) {
        throw new Error("Decoder byte source violated its bounds contract.");
      }
      return buildInstruction(specification, bytes, context, state);
    });
    if (sizes.length === 2) {
      return {
        kind: "ambiguous",
        reason: `The 65816 ${specification.widthFlag?.toUpperCase()} flag is unknown.`,
        requiredState: [specification.widthFlag ?? "m"],
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
  const operand = instruction.operands.length > 0 ? instruction.operands[0] : void 0;
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

// packages/debug-sidecar-ares/src/profile.ts
var ARES_RSP_BACKEND_ID = "ares-rsp";
var ARES_65816_ARCHITECTURE = "snes.65816";
var ARES_65816_ADDRESS_SPACE = "snes.cpu";
var ARES_65816_WRAM_ADDRESS_SPACE = "snes.wram";
var ARES_65816_CARTRIDGE_ROM_ADDRESS_SPACE = "snes.cartridge-rom";
var ARES_65816_THREAD_ID = 1;
var ARES_65816_FRAME_ID = 1;
var ARES_TRACE_BUFFER_EVENTS = 65536;
var ARES_TRACE_BATCH_EVENTS = 240;
var ARES_STEP_KINDS = Object.freeze(["instruction", "in"]);
var NO_STEP_KINDS = Object.freeze([]);
var ARES_RSP_CAPABILITIES = Object.freeze({
  pause: true,
  step: true,
  stepKinds: ARES_STEP_KINDS,
  registers: true,
  memory: true,
  stackFrames: true,
  breakpoints: true,
  disassemble: true,
  reconnect: true,
  architectures: Object.freeze([
    Object.freeze({
      architecture: ARES_65816_ARCHITECTURE,
      addressSpaces: Object.freeze([
        ARES_65816_ADDRESS_SPACE,
        ARES_65816_WRAM_ADDRESS_SPACE,
        ARES_65816_CARTRIDGE_ROM_ADDRESS_SPACE
      ]),
      memorySpaces: Object.freeze([
        Object.freeze({
          addressSpace: ARES_65816_WRAM_ADDRESS_SPACE,
          sideEffectFree: true
        }),
        Object.freeze({
          addressSpace: ARES_65816_CARTRIDGE_ROM_ADDRESS_SPACE,
          sideEffectFree: true
        })
      ]),
      trace: Object.freeze({
        addressSpaces: Object.freeze([ARES_65816_ADDRESS_SPACE]),
        maxBufferedEvents: ARES_TRACE_BUFFER_EVENTS,
        maxBatchEvents: ARES_TRACE_BATCH_EVENTS
      }),
      pause: true,
      step: true,
      stepKinds: ARES_STEP_KINDS,
      registers: true,
      memory: true,
      stackFrames: true,
      breakpoints: true,
      disassemble: true
    }),
    Object.freeze({
      architecture: "snes.spc700",
      addressSpaces: Object.freeze(["spc.aram"]),
      memorySpaces: Object.freeze([]),
      trace: null,
      pause: false,
      step: false,
      stepKinds: NO_STEP_KINDS,
      registers: false,
      memory: false,
      stackFrames: false,
      breakpoints: false,
      disassemble: false
    }),
    Object.freeze({
      architecture: "snes.superfx",
      addressSpaces: Object.freeze(["superfx.ram", "superfx.rom"]),
      memorySpaces: Object.freeze([]),
      trace: null,
      pause: false,
      step: false,
      stepKinds: NO_STEP_KINDS,
      registers: false,
      memory: false,
      stackFrames: false,
      breakpoints: false,
      disassemble: false
    })
  ])
});

// packages/debug-sidecar-ares/src/trace-details.ts
var integer2 = (value, maximum = Number.MAX_SAFE_INTEGER) => {
  if (!/^[\da-f]+$/i.test(value)) {
    throw new Error("Malformed rich trace integer.");
  }
  const result = Number.parseInt(value, 16);
  if (!Number.isSafeInteger(result) || result > maximum) {
    throw new Error("Rich trace integer exceeds its bound.");
  }
  return result;
};
var parseAresTraceDetails = (response, maximum) => {
  const match = /^([01]):([\da-f]+):([\da-f]+):([\da-f]+):(.*)$/i.exec(response);
  if (!match || response.length > 16534) {
    throw new Error("Malformed rich instruction trace response.");
  }
  const rows = match[5] === "" ? [] : match[5].split(";");
  if (rows.length && rows.pop() !== "") {
    throw new Error("Rich trace row is unterminated.");
  }
  if (rows.length > maximum || rows.length > 240) {
    throw new Error("Rich trace exceeds the requested batch limit.");
  }
  const addresses2 = [];
  const details = rows.map((row) => {
    const fields = row.split(",");
    if (fields.length !== 5 || !/^[\da-f]{40}$/i.test(fields[1]) || !/^[\da-f]{2,8}$/i.test(fields[2]) || fields[2].length % 2 !== 0 || fields[4].length % 21 !== 0 || fields[4].length > 32 * 21) {
      throw new Error("Malformed rich trace instruction fields.");
    }
    addresses2.push(integer2(fields[0], 16777215));
    const names = ["a", "x", "y", "s", "d", "db", "pb", "pc", "p", "e"];
    const maxima = [65535, 65535, 65535, 65535, 65535, 255, 255, 65535, 255, 1];
    const state = Object.fromEntries(
      names.map((name, index) => [
        name,
        integer2(fields[1].slice(index * 4, index * 4 + 4), maxima[index])
      ])
    );
    if ((state.pb << 16 | state.pc) !== addresses2.at(-1)) {
      throw new Error("Trace PC disagrees with captured processor state.");
    }
    const memoryAccesses = Array.from({ length: fields[4].length / 21 }, (_, index) => {
      const raw = fields[4].slice(index * 21, index * 21 + 21);
      const actor = ["cpu", "dma", "hdma"][integer2(raw[19], 2)];
      const channel = integer2(raw[20], 15);
      if (actor === "cpu" && channel !== 15 || actor !== "cpu" && channel > 7) {
        throw new Error("Invalid trace DMA channel.");
      }
      return {
        addressSpace: "snes.cpu",
        address: integer2(raw.slice(0, 16), 16777215),
        value: integer2(raw.slice(16, 18), 255),
        access: ["read", "write", "fetch"][integer2(raw[18], 2)],
        width: 1,
        actor,
        ...actor === "cpu" ? {} : { channel }
      };
    });
    return {
      bytes: Array.from(Buffer.from(fields[2], "hex")),
      state,
      memoryAccesses,
      droppedMemoryAccesses: integer2(fields[3])
    };
  });
  const sequenceStart = integer2(match[2]);
  if (sequenceStart < 1) {
    throw new Error("Invalid trace sequence.");
  }
  return {
    architecture: "snes.65816",
    addressSpace: "snes.cpu",
    addresses: addresses2,
    details,
    sequenceStart,
    droppedEvents: integer2(match[3]),
    unattributedMemoryAccesses: integer2(match[4]),
    active: match[1] === "1"
  };
};

// packages/debug-sidecar-ares/src/ares-rsp-backend.ts
var ARES_NAMED_MEMORY_READ_CHUNK_BYTES = 4096;
var asError3 = (error) => error instanceof Error ? error : new Error(String(error));
var checkedInteger = (value, context, maximum = Number.MAX_SAFE_INTEGER) => {
  if (!Number.isSafeInteger(value) || value < 0 || value > maximum) {
    throw new Error(`${context} must be an integer between 0 and ${maximum}.`);
  }
  return value;
};
var checkedAddress = (value, context) => {
  if (value.architecture !== ARES_65816_ARCHITECTURE) {
    throw new Error(`${context} uses unsupported architecture '${value.architecture}'.`);
  }
  if (value.addressSpace !== ARES_65816_ADDRESS_SPACE) {
    throw new Error(`${context} uses unsupported address space '${value.addressSpace}'.`);
  }
  checkedInteger(value.address, `${context} address`, 16777215);
  return { ...value, address: value.address & 16777215 };
};
var checkedMemoryAddress = (value, context) => {
  if (value.architecture !== ARES_65816_ARCHITECTURE) {
    throw new Error(`${context} uses unsupported architecture '${value.architecture}'.`);
  }
  if (value.addressSpace !== ARES_65816_WRAM_ADDRESS_SPACE && value.addressSpace !== ARES_65816_CARTRIDGE_ROM_ADDRESS_SPACE) {
    throw new Error(`${context} uses unsupported memory address space '${value.addressSpace}'.`);
  }
  checkedInteger(value.address, `${context} address`, 16777215);
  return { ...value };
};
var isEvenHex = (value) => {
  if (value.length % 2 !== 0) {
    return false;
  }
  for (const character of value) {
    const code = character.codePointAt(0) ?? -1;
    if (!(code >= 48 && code <= 57 || code >= 65 && code <= 70 || code >= 97 && code <= 102)) {
      return false;
    }
  }
  return true;
};
var littleEndian = (hex2) => {
  const bytes = hex2.match(/../g);
  if (!bytes || bytes.join("") !== hex2) {
    throw new Error("Malformed little-endian register data.");
  }
  return Number.parseInt(bytes.toReversed().join(""), 16);
};
var registerHex = (value, bits) => value.toString(16).toUpperCase().padStart(Math.ceil(bits / 4), "0");
var encode = (value) => Buffer.from(value, "utf8").toString("hex");
var parseRegisters = (payload) => {
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
    e: littleEndian(payload.slice(30, 32))
  };
};
var logicalPc = (registers) => (registers.pb << 16 | registers.pc) & 16777215;
var stopSignal = (payload) => {
  if (!/^[ST][\dA-Fa-f]{2}/.test(payload)) {
    throw new Error(`Expected an RSP stop packet, received '${payload}'.`);
  }
  return Number.parseInt(payload.slice(1, 3), 16);
};
var expectOkay = (payload, context) => {
  if (payload !== "OK") {
    throw new Error(`${context} failed with RSP response '${payload}'.`);
  }
};
var safeHexInteger = (value, context) => {
  if (!/^[\dA-Fa-f]+$/.test(value)) {
    throw new Error(`${context} is not hexadecimal.`);
  }
  const parsed = Number(BigInt(`0x${value}`));
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`${context} exceeds JavaScript safe integer range.`);
  }
  return parsed;
};
var AresRspDebugBackend = class {
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
      architectures: ARES_RSP_CAPABILITIES.architectures.map((architecture) => {
        if (architecture.architecture === "snes.65816") {
          return {
            ...architecture,
            addressSpaces: [...architecture.addressSpaces, "snes.sram"],
            memorySpaces: [
              ...architecture.memorySpaces,
              { addressSpace: "snes.sram", sideEffectFree: true }
            ],
            trace: { ...architecture.trace, instructionDetails: true }
          };
        }
        if (architecture.architecture === "snes.spc700") {
          return {
            ...architecture,
            memory: true,
            addressSpaces: [...architecture.addressSpaces, "snes.spc700.aram"],
            memorySpaces: [{ addressSpace: "snes.spc700.aram", sideEffectFree: true }]
          };
        }
        return architecture;
      })
    };
  }
  #createClient;
  #terminate;
  #stopTimeoutMs;
  #listeners = /* @__PURE__ */ new Set();
  #expectedClose = /* @__PURE__ */ new WeakSet();
  #breakpoints = /* @__PURE__ */ new Map();
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
    this.#stopTimeoutMs = options.stopTimeoutMs ?? 5e3;
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
      await existing.close().catch(() => void 0);
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
      client.onClose((error) => this.#clientClosed(client, error))
    ];
    try {
      await client.start();
      const supported = await client.request("qSupported");
      this.#captureV2 = supported.split(";").includes("uttoriCaptureV2+");
      this.#busCaptureSupported = false;
      if (!supported.includes("qXfer:features:read+") || !supported.includes("xmlRegisters+") || !supported.includes("uttoriNamedMemory+") || !supported.includes("uttoriInstructionTrace+")) {
        throw new Error("ares RSP server does not advertise the required debugger extensions.");
      }
      const target = await this.#readTargetDescription(client);
      for (const register of ["a", "x", "y", "s", "d", "db", "pb", "pc", "p", "e"]) {
        if (!target.includes(`name="${register}"`)) {
          throw new Error(`ares RSP target description is missing register '${register}'.`);
        }
      }
      this.#richTrace = supported.includes("uttoriInstructionDetails+") && supported.includes("uttoriSramMemory+") && supported.includes("uttoriAramMemory+");
      this.#instructionBoundaryStop = supported.includes("uttoriInstructionBoundaryStop+");
      await this.#handshakeStop(client, this.#instructionBoundaryStop);
      this.#connected = true;
      this.#stopped = true;
      this.#emit({ type: "stopped", reason: "entry", threadId: ARES_65816_THREAD_ID });
    } catch (error) {
      this.#expectedClose.add(client);
      await client.close().catch(() => void 0);
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
        session: this.#captureSession
      }).catch(() => void 0);
      this.#captureSession = void 0;
      this.#captureScope = void 0;
    }
    if (this.#trace?.active) {
      await this.stopTrace();
    }
    if (!terminate) {
      await this.setBreakpoints([]);
      this.#connected = false;
      this.#pendingStopReason = void 0;
      return;
    }
    this.#expectedClose.add(client);
    let detachError;
    try {
      expectOkay(await client.request("D"), "ares RSP detach");
    } catch (error) {
      const failure = asError3(error);
      if (!client.closed || failure.message !== "RSP transport closed.") {
        detachError = failure;
      }
    }
    await client.close().catch((error) => {
      detachError ??= asError3(error);
    });
    this.#releaseClient(client);
    this.#breakpoints.clear();
    this.#stopped = false;
    this.#pendingStopReason = void 0;
    this.#trace = void 0;
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
      { id: ARES_65816_THREAD_ID, name: "Main CPU", architecture: ARES_65816_ARCHITECTURE }
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
        currentOnly: true
      }
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
      { name: "E", value: registerHex(registers.e, 8), bits: 8, group: "CPU" }
    ];
  }
  /** @inheritdoc */
  async readMemory(address2, count) {
    const extra = this.#richTrace && (address2.architecture === "snes.65816" && address2.addressSpace === "snes.sram" || address2.architecture === "snes.spc700" && address2.addressSpace === "snes.spc700.aram");
    const checked = extra ? { ...address2 } : checkedMemoryAddress(address2, "Memory request");
    checkedInteger(checked.address, "Memory address", 16777215);
    checkedInteger(count, "Memory count", 1048576);
    if (count === 0) {
      return { address: checked, bytes: new Uint8Array(), unreadableBytes: 0 };
    }
    const bytes = new Uint8Array(count);
    let offset = 0;
    const client = this.#requireStopped();
    while (offset < count) {
      const requested = Math.min(ARES_NAMED_MEMORY_READ_CHUNK_BYTES, count - offset);
      const response = await client.request(
        `qUttoriMemoryRead:${checked.addressSpace}:${(checked.address + offset).toString(16)},${requested.toString(16)}`
      );
      if (response.startsWith("E")) {
        throw new Error(`ares RSP named memory read failed with response '${response}'.`);
      }
      if (!isEvenHex(response) || response.length > requested * 2) {
        throw new Error(
          "ares RSP named memory response is malformed or exceeds the requested count."
        );
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
  async setBreakpoints(addresses2) {
    const client = this.#requireStopped();
    const requested = addresses2.map((entry, index) => checkedAddress(entry, `Breakpoint ${index}`));
    if (new Set(requested.map(({ address: address2 }) => address2)).size !== requested.length) {
      throw new Error("Duplicate ares execute breakpoint addresses are not allowed.");
    }
    const wanted = new Set(requested.map(({ address: address2 }) => address2));
    for (const address2 of this.#breakpoints.keys()) {
      if (wanted.has(address2)) {
        continue;
      }
      expectOkay(await client.request(`z0,${address2.toString(16)},1`), "Remove breakpoint");
      this.#breakpoints.delete(address2);
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
        ...response === "OK" ? {} : { message: `ares RSP response '${response}'.` }
      };
      if (breakpoint.verified) {
        this.#breakpoints.set(value.address, breakpoint);
      }
      results.push(breakpoint);
    }
    return results;
  }
  /** @inheritdoc */
  async disassemble(address2, count) {
    let current = checkedAddress(address2, "Disassembly request").address;
    checkedInteger(count, "Disassembly count", 4096);
    const registers = await this.#registerSnapshot();
    const state = {
      e: registers.e === 0 ? 0 : 1,
      m: registers.p >>> 5 & 1 ? 1 : 0,
      x: registers.p >>> 4 & 1 ? 1 : 0,
      programBank: current >>> 16,
      dataBank: registers.db,
      directPage: registers.d
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
        state: { ...state, programBank: current >>> 16 }
      });
      if (decoded.kind !== "instruction") {
        throw new Error(
          decoded.kind === "ambiguous" ? decoded.reason : `65816 decode failed: ${decoded.message}`
        );
      }
      instructions.push({
        address: this.#address(current),
        bytes: [...decoded.instruction.bytes],
        text: formatCpu65816Instruction(decoded.instruction)
      });
      current = current + decoded.instruction.size & 16777215;
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
      const fields2 = ["qUttoriContext", request.action];
      if ("directory" in request) {
        if (request.romContentSha256 !== identity.romSha256 || request.producer.id !== "ares" || request.producer.revision !== identity.executableSha256 && request.producer.revision !== identity.producerRevision) {
          throw new Error("Capture context ROM/build does not match the verified runtime.");
        }
        if (request.action === "replay" || request.action === "restore") {
          await verifyCaptureContext(request.directory, request);
        }
        fields2.push(
          encode(request.directory),
          encode(request.romContentSha256),
          encode(request.producer.id),
          encode(request.producer.revision)
        );
      }
      if ("session" in request) {
        fields2.push(request.session);
      }
      if (request.action === "mark") {
        fields2.push(encode(request.label));
      }
      if (request.action === "prepare" || request.action === "stop") {
        this.#contextBoundaryHeld = true;
      }
      try {
        const response2 = await client.request(fields2.join(":"));
        const expected = {
          prepare: ["prepared"],
          start: ["recording"],
          stop: ["draining", "complete"],
          mark: ["recording"],
          abort: ["aborted"],
          restore: ["restored"],
          replay: ["replaying"],
          status: ["idle", "replaying", "replay-diverged"]
        };
        if (!expected[request.action].includes(response2)) {
          throw new Error(
            `Capture context ${request.action} is unsupported or failed (${response2.slice(0, 32)}). Rebuild the context-capable runtime.`
          );
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
        return { contextState: response2 };
      } catch (error) {
        this.#contextBoundaryHeld = false;
        throw error;
      }
    }
    if (!this.#captureV2) {
      throw new Error(
        "The active ares runtime does not support lossless capture v2. Install the capture-v2 runtime and restart debugging."
      );
    }
    if (request.operation === "file-start" || request.operation === "file-capabilities" || request.operation === "file-status" || request.operation === "file-stop" || request.operation === "file-abort" || request.operation === "file-release") {
      const negotiation2 = request.operation === "file-start" || request.operation === "file-capabilities";
      const scope = negotiation2 ? request.scope ?? "snes.65816.instructions" : this.#captureScope;
      const scopes = {
        "snes.65816.instructions": "instructions",
        "snes.cpu-bus": "bus",
        "snes.cpu-bus-transfers": "bus-transfers",
        "snes.cpu-bus-ppu": "bus-ppu"
      };
      const fields2 = ["qUttoriCaptureFile", request.operation.slice(5)];
      if (request.operation === "file-start") {
        this.#requireStopped();
        const identity = this.#nativeFileIdentity;
        if (!identity) {
          throw new Error("Native file capture requires a verified local runtime host.");
        }
        if (request.romContentSha256 !== identity.romSha256 || request.producer.id !== "ares" || request.producer.revision !== identity.executableSha256 && request.producer.revision !== identity.producerRevision) {
          throw new Error(
            "Native capture identity does not match the verified ROM and executable."
          );
        }
        await this.capture({ operation: "file-capabilities", scope });
        fields2.push(
          request.bufferBytes,
          scopes[scope],
          encode(request.file),
          request.romContentSha256,
          encode(request.producer.id),
          encode(request.producer.revision)
        );
        if (request.measureStages) {
          fields2.push("profile");
        }
      } else if (request.operation === "file-capabilities") {
        fields2.push(scopes[scope]);
      } else {
        fields2.push(request.session);
      }
      const response2 = await client.request(fields2.join(":"));
      if (response2.length > 8193 || response2.length % 2 !== 1 || !/^J[\da-f]+$/.test(response2)) {
        throw new Error(
          `Native file capture ${request.operation} is unsupported or rejected (${response2.slice(0, 32)}). Use the capture-file runtime.`
        );
      }
      const value2 = JSON.parse(Buffer.from(response2.slice(1), "hex").toString("utf8"));
      if (request.operation === "file-capabilities") {
        const capabilities = validateCaptureCapabilities(value2, scope);
        if (!capabilities.nativeFile) {
          throw new Error("Runtime did not confirm native file ownership.");
        }
        return capabilities;
      }
      const position2 = validateCapturePosition(
        value2,
        request.operation === "file-start" ? void 0 : request.session
      );
      if (request.operation === "file-start") {
        this.#captureSession = position2.session;
        this.#captureScope = scope;
        this.#captureNative = true;
        try {
          validateCapturePosition(position2, void 0, scope);
        } catch (error) {
          await this.capture({ operation: "file-abort", session: position2.session }).catch(
            () => void 0
          );
          throw error;
        }
      } else if (position2.state === "complete" || request.operation === "file-release") {
        this.#captureSession = void 0;
        this.#captureScope = void 0;
      }
      validateCapturePosition(position2, void 0, scope);
      if (request.operation === "file-stop" || request.operation === "file-abort") {
        this.#contextBoundaryHeld = false;
      }
      return position2;
    }
    const negotiation = request.operation === "start" || request.operation === "capabilities";
    const requestedScope = negotiation ? request.scope ?? "snes.65816.instructions" : void 0;
    const ppu = requestedScope === "snes.cpu-bus-ppu";
    const bus = ppu || requestedScope === "snes.cpu-bus" || requestedScope === "snes.cpu-bus-transfers";
    const transfers = requestedScope === "snes.cpu-bus-transfers";
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
      } else if (bus) {
        fields.push(transfers ? "bus-transfers" : "bus");
      }
    } else if (request.operation !== "capabilities") {
      fields.push(request.session);
      if (request.operation === "read" || request.operation === "ack") {
        fields.push(request.chunk);
      }
      if (request.operation === "ack") {
        fields.push(request.event);
      }
    }
    const response = await client.request(fields.join(":"));
    if (request.operation === "capabilities" && bus && (!response || /^e[\da-f]{2}$/i.test(response))) {
      let feature = transfers ? "transfer boundaries" : "bus capture";
      let runtime = transfers ? "capture-transfer" : "capture-bus";
      if (ppu) {
        feature = "verified PPU effects";
        runtime = "capture-ppu";
      }
      throw new Error(
        `The active ares runtime does not support CPU/DMA/HDMA ${feature}. Use the ${runtime} runtime and restart debugging.`
      );
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
    const position = validateCapturePosition(
      value,
      request.operation === "start" ? void 0 : request.session
    );
    if (request.operation === "start") {
      this.#captureNative = false;
      this.#captureSession = position.session;
      this.#captureScope = position.scope ?? "snes.65816.instructions";
      try {
        validateCapturePosition(position, void 0, requestedScope);
      } catch (error) {
        await this.capture({ operation: "abort", session: position.session }).catch(
          () => void 0
        );
        throw error;
      }
    } else if (position.session === this.#captureSession) {
      validateCapturePosition(position, this.#captureSession, this.#captureScope);
    }
    if (position.state === "complete") {
      this.#captureSession = void 0;
      this.#captureScope = void 0;
    }
    if (request.operation === "stop" || request.operation === "abort") {
      this.#contextBoundaryHeld = false;
    }
    return position;
  }
  async startTrace(options) {
    if (options.architecture !== ARES_65816_ARCHITECTURE || options.addressSpace !== ARES_65816_ADDRESS_SPACE) {
      throw new Error(
        `Instruction trace '${options.architecture}/${options.addressSpace}' is not supported.`
      );
    }
    const client = this.#requireStopped();
    if (options.detail === "full" && !this.#richTrace) {
      throw new Error(
        "This runtime supports PC-only traces. Rebuild the maintained runtime for captured bytes/state and bus accesses."
      );
    }
    expectOkay(
      await client.request(options.detail === "full" ? "QUttoriTrace:2" : "QUttoriTrace:1"),
      "Start instruction trace"
    );
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
      const result = parseAresTraceDetails(
        await this.#requireConnected().request(`qUttoriTraceDetailRead:${maxEvents.toString(16)}`),
        maxEvents
      );
      trace.active = result.active;
      return result;
    }
    const response = await this.#requireConnected().request(
      `qUttoriTraceRead:${maxEvents.toString(16)}`
    );
    const match = /^([01]):([\dA-Fa-f]+):([\dA-Fa-f]+):([\dA-Fa-f]*)$/.exec(response);
    if (!match || match[4].length % 16 !== 0) {
      throw new Error("ares RSP instruction trace response is malformed.");
    }
    const addresses2 = Array.from(
      { length: match[4].length / 16 },
      (_, index) => safeHexInteger(match[4].slice(index * 16, index * 16 + 16), "Trace address")
    );
    if (addresses2.length > maxEvents || addresses2.some((address2) => address2 > 16777215)) {
      throw new Error("ares RSP instruction trace response exceeds the requested bounds.");
    }
    const active = match[1] === "1";
    trace.active = active;
    return {
      architecture: trace.architecture,
      addressSpace: trace.addressSpace,
      sequenceStart: safeHexInteger(match[2], "Trace sequence"),
      addresses: addresses2,
      droppedEvents: safeHexInteger(match[3], "Trace dropped-event count"),
      active
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
  async #readCpuBus(address2, count) {
    const response = await this.#requireStopped().request(
      `m${address2.toString(16)},${count.toString(16)}`
    );
    if (response.startsWith("E")) {
      throw new Error(`ares RSP CPU-bus disassembly read failed with response '${response}'.`);
    }
    if (!isEvenHex(response) || response.length > count * 2) {
      throw new Error(
        "ares RSP CPU-bus disassembly response is malformed or exceeds the requested count."
      );
    }
    const available = Buffer.from(response, "hex");
    if (available.length === 0) {
      return void 0;
    }
    const bytes = new Uint8Array(count);
    bytes.set(available);
    return bytes;
  }
  async #readTargetDescription(client) {
    let offset = 0;
    let target = "";
    for (let part = 0; part < 16; part++) {
      const response = await client.request(
        `qXfer:features:read:target.xml:${offset.toString(16)},1000`
      );
      if (!response.startsWith("l") && !response.startsWith("m")) {
        throw new Error("ares RSP target description returned an invalid continuation marker.");
      }
      const chunk = response.slice(1);
      target += chunk;
      if (target.length > 65536) {
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
    const timeout = setTimeout(
      () => rejectStop?.(new Error(`Timed out waiting for ares ${context} stop.`)),
      this.#stopTimeoutMs
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
  async #registerSnapshot() {
    return parseRegisters(await this.#requireStopped().request("g"));
  }
  #address(address2) {
    return {
      architecture: ARES_65816_ARCHITECTURE,
      addressSpace: ARES_65816_ADDRESS_SPACE,
      address: address2
    };
  }
  #assertThread(threadId) {
    if (threadId !== void 0 && threadId !== ARES_65816_THREAD_ID) {
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
    this.#pendingStopReason = void 0;
    if (this.#contextReplayPending && this.#client) {
      void this.#client.request("qUttoriContext:status").then(
        (status) => {
          this.#contextReplayPending = status === "replaying";
          if (status === "idle" || status === "replay-diverged") {
            this.#emit({
              type: "output",
              category: status === "idle" ? "console" : "stderr",
              text: status === "idle" ? "Capture replay reached the recorded endpoint; WRAM and input consumption match.\n" : "Capture replay diverged from the retained input timing or final WRAM. Execution is paused.\n"
            });
          }
          return;
        },
        (error) => {
          this.#emit({
            type: "output",
            category: "stderr",
            text: `Could not verify capture replay outcome: ${String(error)}
`
          });
        }
      ).finally(() => this.#emit({ type: "stopped", reason, threadId: ARES_65816_THREAD_ID }));
      return;
    }
    this.#emit({ type: "stopped", reason, threadId: ARES_65816_THREAD_ID });
  }
  #clientClosed(client, error) {
    if (this.#expectedClose.has(client) || this.#client !== client) {
      return;
    }
    this.#releaseClient(client);
    this.#emit({ type: "output", category: "stderr", text: `${error.message}
` });
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
    this.#client = void 0;
    this.#connected = false;
    this.#instructionBoundaryStop = false;
    this.#contextBoundaryHeld = false;
    this.#contextReplayPending = false;
    this.#trace = void 0;
  }
  #emit(event) {
    for (const listener of this.#listeners) {
      listener(event);
    }
  }
};

// packages/debug-sidecar-ares/src/sidecar.ts
var usage = `Usage: uttori-asm-debug-sidecar-ares [options]

Required:
  --manifest path       Versioned ares runtime manifest JSON
  --ares path           Separately installed ares executable (manifest selects frontend)
  --rom path            SNES ROM matching the selected build or manifest SHA-256
  --runtime-dir path    Portable root containing bin, resources, settings, and saves

Optional:
  --rom-sha256 hash     Expected ROM SHA-256 from a verified build (64 hex digits)
  --system name         Ares system name (default: Super Famicom)
  --no-fast-boot        Disable the ares fast-boot setting
  --help                Show this help
`;
var optionNames = /* @__PURE__ */ new Set(["--manifest", "--ares", "--rom", "--rom-sha256", "--runtime-dir", "--system"]);
var parseAresSidecarArguments = (arguments_) => {
  const values = /* @__PURE__ */ new Map();
  let fastBoot = true;
  for (let index = 0; index < arguments_.length; index++) {
    const argument = index >= 0 && index < arguments_.length && Object.hasOwn(arguments_, index) ? arguments_[index] : void 0;
    if (argument === void 0) {
      throw new Error("Ares sidecar arguments cannot contain holes.");
    }
    if (argument === "--no-fast-boot") {
      fastBoot = false;
      continue;
    }
    if (!optionNames.has(argument)) {
      throw new Error(`Unknown ares sidecar option '${argument}'.`);
    }
    if (values.has(argument)) {
      throw new Error(`Duplicate ares sidecar option '${argument}'.`);
    }
    const value = arguments_[++index];
    if (!value || value.startsWith("--")) {
      throw new Error(`Ares sidecar option '${argument}' requires a value.`);
    }
    values.set(argument, value);
  }
  const required = (name) => {
    const value = values.get(name);
    if (!value) {
      throw new Error(`Missing required ares sidecar option '${name}'.`);
    }
    return path3.resolve(value);
  };
  const system = values.get("--system");
  const romSha256 = values.get("--rom-sha256");
  if (romSha256 !== void 0 && !/^[\da-f]{64}$/i.test(romSha256)) {
    throw new Error("--rom-sha256 requires a 64-digit SHA-256 from the selected build.");
  }
  return {
    ...romSha256 ? { romSha256: romSha256.toLowerCase() } : {},
    manifest: required("--manifest"),
    executable: required("--ares"),
    rom: required("--rom"),
    runtimeDirectory: required("--runtime-dir"),
    ...system ? { system } : {},
    fastBoot
  };
};
var write = (stream, data) => new Promise((resolve, reject) => {
  stream.write(data, (error) => {
    if (error) {
      reject(error);
    } else {
      resolve();
    }
  });
});
var runAresSidecar = async (arguments_, environment = process.env) => {
  const options = parseAresSidecarArguments(arguments_);
  const session = environment[DEBUG_SIDECAR_SESSION_ENV];
  assertDebugSidecarSessionToken(session);
  const runtimeManifest = parseAresRuntimeManifest(
    JSON.parse(await readFile2(options.manifest, "utf8"))
  );
  const manifest = { ...runtimeManifest, romSha256: options.romSha256 ?? runtimeManifest.romSha256 };
  const host = new AresProcessHost({
    executable: options.executable,
    rom: options.rom,
    runtimeDirectory: options.runtimeDirectory,
    manifest,
    system: options.system,
    fastBoot: options.fastBoot
  });
  const backend = new AresRspDebugBackend({
    createClient: (connect) => host.createClient(connect),
    nativeFileIdentity: {
      romSha256: manifest.romSha256,
      executableSha256: manifest.executableSha256,
      producerRevision: `${manifest.forkRevision}:${manifest.patchSha256}:${manifest.executableSha256}`
    },
    terminate: () => host.terminate()
  });
  let ending = false;
  const close = async (error) => {
    if (ending) {
      return;
    }
    ending = true;
    if (error) {
      await write(process.stderr, `${error.stack ?? error.message}
`).catch(() => void 0);
    }
    process.stdin.pause();
    await host.terminate().catch(() => void 0);
    await new Promise((resolve) => process.stdout.end(resolve));
  };
  const server = new DebugSidecarServer({
    backend: ARES_RSP_BACKEND_ID,
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
if (import.meta.main) {
  const arguments_ = process.argv.slice(2);
  if (arguments_.includes("--help")) {
    await write(process.stdout, usage);
  } else {
    await runAresSidecar(arguments_).catch(async (error) => {
      const failure = error instanceof Error ? error : new Error(String(error));
      await write(process.stderr, `${failure.stack ?? failure.message}
`).catch(() => void 0);
      process.exitCode = 1;
    });
  }
}
export {
  parseAresSidecarArguments,
  runAresSidecar
};

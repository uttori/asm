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

// packages/core/src/canonical-json.ts
var init_canonical_json = __esm({
  "packages/core/src/canonical-json.ts"() {
    "use strict";
  }
});

// packages/core/src/debug-map.ts
var init_debug_map = __esm({
  "packages/core/src/debug-map.ts"() {
    "use strict";
  }
});

// packages/debug-adapter/src/capture-nes-ppu.ts
var init_capture_nes_ppu = __esm({
  "packages/debug-adapter/src/capture-nes-ppu.ts"() {
    "use strict";
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
      fields2.push("directory", "romContentSha256", "romFileSha256", "producer");
      validateCaptureRequest({
        operation: "file-start",
        file: value.directory,
        romFileSha256: value.romFileSha256,
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
        "romFileSha256",
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
    if (!bounded(value.file, 4096) || typeof value.file !== "string" || !/^(?:\/|[a-z]:[/\\]|\\\\)/i.test(value.file) || typeof value.romContentSha256 !== "string" || !/^[\da-f]{64}$/.test(value.romContentSha256) || value.romFileSha256 !== void 0 && (typeof value.romFileSha256 !== "string" || !/^[\da-f]{64}$/.test(value.romFileSha256)) || !isFieldRecord(producer) || !bounded(producer.id, 256) || !bounded(producer.revision, 1024) || Object.keys(producer).some((key) => !["id", "revision"].includes(key))) {
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
      if (value !== "nes.cpu-bus-ppu" && value !== "nes.2a03.instructions" && value !== "snes.65816.instructions" && value !== "snes.cpu-bus" && value !== "snes.cpu-bus-transfers" && value !== "snes.cpu-bus-ppu") {
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
      let reserve = scope === "nes.2a03.instructions" ? 91 : 71;
      if (scope === "nes.cpu-bus-ppu") {
        reserve = 128;
      }
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
          let decoded2;
          try {
            decoded2 = JSON.parse(body.toString("utf8"));
          } catch {
            throw new Error("Sidecar frame contains invalid JSON.");
          }
          assertDebugSidecarMessage(decoded2, this.#limits);
          if (decoded2.sequence <= this.#lastSequence) {
            throw new Error(
              `Sidecar sequence ${decoded2.sequence} is not greater than ${this.#lastSequence}.`
            );
          }
          this.#lastSequence = decoded2.sequence;
          messages.push(decoded2);
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
      const nes = manifest.architecture === "65xx.2a03";
      if (nes && (!identity.romFileSha256 || identity.romFileSha256 !== manifest.romFileSha256 || manifest.addressSpace !== "nes.cpu") || !nes && identity.romFileSha256 !== void 0) {
        throw new Error("Capture context requires the matching full iNES image.");
      }
      const files = manifest.files;
      if (nes && manifest.scope !== "nes.2a03.instructions" && manifest.scope !== "nes.cpu-bus-ppu") {
        throw new Error("Invalid NES capture context scope.");
      }
      if (nes && manifest.scope === "nes.2a03.instructions" && !files["graphics.act2"]) {
        throw new Error("NES instruction context is missing its graphics companion.");
      }
      for (const name of [
        "start.bst",
        ...nes ? ["ram-start.bin", "ram-end.bin", "start-extra.bin", "end-state.bin"] : ["wram-start.bin", "wram-end.bin"],
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
        if (!/^(?:identity\.txt|machine\.json|start-extra\.bin|end-state\.bin|ram-(?:start|end)\.bin|start\.bst|wram-(?:start|end)\.bin|inputs\.bin|milestones\.jsonl|(?:start|end)-clock\.txt|boundaries\.json|graphics\.act2|screen-\d+\.png)$/.test(
          name
        ) || !isRecord3(artifact) || typeof artifact.bytes !== "number" || !Number.isSafeInteger(artifact.bytes) || artifact.bytes < 0 || typeof artifact.sha256 !== "string" || !/^[\da-f]{64}$/.test(artifact.sha256)) {
          throw new Error("Invalid capture context artifact descriptor.");
        }
        const file = path.join(directory, name), stat2 = await lstat(file);
        if (!stat2.isFile() || stat2.isSymbolicLink() || stat2.size !== artifact.bytes || name === "start.bst" && (stat2.size < 538 || stat2.size > 32 * 1048576) || name.startsWith("wram-") && (nes || stat2.size !== 131072) || name.startsWith("ram-") && (!nes || stat2.size !== 2048) || name === "start-extra.bin" && (!nes || stat2.size !== 38) || name === "end-state.bin" && (!nes || stat2.size < 2048 || stat2.size > 32 * 1048576) || name === "inputs.bin" && stat2.size % 18) {
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
    init_capture_nes_ppu();
  }
});

// packages/debug-sidecar-ares/src/sidecar.ts
init_src();
import { createHash as createHash3 } from "node:crypto";
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

// packages/core/src/syntax-profile.ts
var ASAR_SYNTAX_PROFILE = Object.freeze({
  id: "asar",
  preserveLeadingWhitespace: false,
  splitColonStatements: true,
  splitRelativeLabelStatements: true,
  leadingDotLabels: true,
  directivePrefixes: Object.freeze(["@"]),
  cheapLocalPrefix: "",
  fileLocalSymbols: false
});
var NATIVE_SYNTAX_PROFILE = Object.freeze({
  id: "native",
  preserveLeadingWhitespace: true,
  splitColonStatements: false,
  splitRelativeLabelStatements: false,
  leadingDotLabels: true,
  directivePrefixes: Object.freeze([]),
  cheapLocalPrefix: "",
  fileLocalSymbols: false
});
var CA65_SYNTAX_PROFILE = Object.freeze({
  id: "ca65",
  preserveLeadingWhitespace: true,
  splitColonStatements: false,
  splitRelativeLabelStatements: false,
  leadingDotLabels: false,
  directivePrefixes: Object.freeze(["."]),
  cheapLocalPrefix: "@",
  fileLocalSymbols: true
});

// packages/core/src/plugin/contracts.ts
var PLUGIN_API_VERSION = 1;
function definePlugin(plugin2) {
  return plugin2;
}

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

// packages/core/src/index.ts
init_debug_map();
init_canonical_json();

// packages/debug-sidecar-ares/src/ares-rsp-backend.ts
init_src();

// packages/plugin-65xx/src/instructions/catalog.ts
var syntax = {
  implied: "",
  accumulator: "A",
  immediate: "#value",
  zeroPage: "zp",
  zeroPageIndexedX: "zp,x",
  zeroPageIndexedY: "zp,y",
  absolute: "addr",
  absoluteIndexedX: "addr,x",
  absoluteIndexedY: "addr,y",
  absoluteLongIndexedX: "long,x",
  indirect: "(addr)",
  zeroPageIndirect: "(zp)",
  zeroPageIndirectLong: "[zp]",
  indexedIndirectX: "(zp,x)",
  indirectIndexedY: "(zp),y",
  absoluteIndexedIndirect: "(addr,x)",
  zeroPageIndirectIndexedZ: "(zp),z",
  stackRelative: "offset,s",
  stackRelativeIndirectIndexedY: "(offset,s),y",
  relative: "target",
  relative16: "target",
  zeroPageRelative: "zp,target",
  accumulatorRelative: "A,target",
  zeroPageImmediate: "zp,#value",
  specialPage: "$FFnn",
  blockTransfer: "source,destination,length",
  immediateZeroPage: "#value,zp",
  immediateZeroPageIndexedX: "#value,zp,x",
  immediateAbsolute: "#value,addr",
  immediateAbsoluteIndexedX: "#value,addr,x",
  basePageIndirectIndexedZ: "[zp],z",
  quadAccumulator: "Q"
};
var summaries = {
  ADC: "Add memory to the accumulator with carry.",
  AND: "Bitwise AND memory with the accumulator.",
  ASL: "Shift left one bit.",
  BCC: "Branch when carry is clear.",
  BCS: "Branch when carry is set.",
  BEQ: "Branch when equal (zero set).",
  BIT: "Test accumulator bits without storing a result.",
  BMI: "Branch when negative.",
  BNE: "Branch when not equal (zero clear).",
  BPL: "Branch when positive.",
  BRK: "Trigger a software interrupt.",
  BVC: "Branch when overflow is clear.",
  BVS: "Branch when overflow is set.",
  CMP: "Compare memory with the accumulator.",
  CPX: "Compare memory with X.",
  CPY: "Compare memory with Y.",
  EOR: "Exclusive-OR memory with the accumulator.",
  JMP: "Jump to an address.",
  JSR: "Call a subroutine.",
  LDA: "Load the accumulator.",
  LDX: "Load X.",
  LDY: "Load Y.",
  NOP: "Perform no operation.",
  ORA: "Bitwise OR memory with the accumulator.",
  SBC: "Subtract memory and borrow from the accumulator.",
  STA: "Store the accumulator.",
  STX: "Store X.",
  STY: "Store Y."
};
function buildInstructionCatalog(forms) {
  const grouped = /* @__PURE__ */ new Map();
  for (const form of forms) {
    const entries2 = grouped.get(form.mnemonic) ?? [];
    entries2.push(form);
    grouped.set(form.mnemonic, entries2);
  }
  return [...grouped.entries()].toSorted(([left], [right]) => left.localeCompare(right)).map(([mnemonic, entries2]) => ({
    mnemonic,
    summary: summaries[mnemonic] ?? (entries2.some((entry) => !entry.documented) ? "Undocumented NMOS 6502 instruction." : `${mnemonic} instruction.`),
    modes: entries2.map((form) => ({
      mode: form.mode,
      syntax: syntax[form.mode],
      opcode: form.opcode,
      size: form.encoding.length + form.operands.reduce((size, operand) => size + operand.width, 0)
    }))
  }));
}

// packages/plugin-65xx/src/instructions/schema.ts
function matchesFeatures(expression, features) {
  if (expression.allOf?.some((feature) => !features.has(feature))) {
    return false;
  }
  if (expression.anyOf && !expression.anyOf.some((feature) => features.has(feature))) {
    return false;
  }
  if (expression.noneOf?.some((feature) => features.has(feature))) {
    return false;
  }
  return true;
}
function getOperandCodec(mode2) {
  switch (mode2) {
    case "implied":
    case "accumulator":
    case "quadAccumulator":
      return "none";
    case "absolute":
    case "absoluteIndexedX":
    case "absoluteIndexedY":
    case "indirect":
    case "absoluteIndexedIndirect":
      return "unsigned16-le";
    case "absoluteLongIndexedX":
      return "unsigned24-le";
    case "relative":
      return "relative8";
    case "relative16":
      return "relative16";
    case "zeroPageRelative":
      return "zero-page-relative8";
    case "accumulatorRelative":
      return "accumulator-relative8";
    case "zeroPageImmediate":
      return "zero-page-immediate8";
    case "specialPage":
      return "special-page";
    case "blockTransfer":
      return "three-unsigned16-le";
    case "immediateZeroPage":
    case "immediateZeroPageIndexedX":
      return "immediate-unsigned8";
    case "immediateAbsolute":
    case "immediateAbsoluteIndexedX":
      return "immediate-unsigned16";
    case "immediate":
    case "zeroPage":
    case "zeroPageIndexedX":
    case "zeroPageIndexedY":
    case "zeroPageIndirect":
    case "zeroPageIndirectLong":
    case "indexedIndirectX":
    case "indirectIndexedY":
    case "zeroPageIndirectIndexedZ":
    case "stackRelative":
    case "stackRelativeIndirectIndexedY":
    case "basePageIndirectIndexedZ":
      return "unsigned8";
  }
  const leftover = mode2;
  throw new Error(`Unsupported addressing mode: ${String(leftover)}`);
}
function getOperandFields(codec) {
  switch (codec) {
    case "none":
      return [];
    case "unsigned16-le":
      return [{ name: "address", width: 2 }];
    case "unsigned24-le":
      return [{ name: "address", width: 3 }];
    case "relative8":
      return [{ name: "target", width: 1, signed: true, relative: true }];
    case "relative16":
      return [{ name: "target", width: 2, signed: true, relative: true }];
    case "zero-page-relative8":
      return [
        { name: "address", width: 1 },
        { name: "target", width: 1, signed: true, relative: true }
      ];
    case "accumulator-relative8":
      return [{ name: "target", width: 1, signed: true, relative: true }];
    case "zero-page-immediate8":
      return [
        { name: "address", width: 1 },
        { name: "value", width: 1 }
      ];
    case "special-page":
      return [{ name: "address", width: 1 }];
    case "three-unsigned16-le":
      return [
        { name: "source", width: 2 },
        { name: "destination", width: 2 },
        { name: "length", width: 2 }
      ];
    case "immediate-unsigned8":
      return [
        { name: "value", width: 1 },
        { name: "address", width: 1 }
      ];
    case "immediate-unsigned16":
      return [
        { name: "value", width: 1 },
        { name: "address", width: 2 }
      ];
    case "unsigned8":
      return [{ name: "value", width: 1 }];
  }
  return [];
}

// packages/plugin-65xx/src/instructions/variant-tables.generated.ts
var ca65EaTable = [
  [
    0,
    0,
    5,
    13,
    15,
    21,
    29,
    31,
    0,
    25,
    18,
    0,
    7,
    17,
    23,
    1,
    0,
    0,
    0,
    3,
    19,
    9,
    0,
    9,
    0,
    0,
    0,
    0,
    0,
    0,
    18,
    0
  ],
  [
    8,
    8,
    4,
    12,
    0,
    20,
    28,
    0,
    20,
    28,
    0,
    128,
    0,
    16,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    128,
    0,
    0,
    0,
    0,
    0
  ],
  [
    0,
    0,
    36,
    44,
    15,
    52,
    60,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    137,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0
  ],
  [
    58,
    58,
    198,
    206,
    0,
    214,
    222,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0
  ],
  [
    26,
    26,
    230,
    238,
    0,
    246,
    254,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0
  ],
  [
    0,
    0,
    96,
    152,
    0,
    112,
    158,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0
  ],
  [
    0,
    0,
    0,
    0,
    16,
    0,
    0,
    0,
    0,
    0,
    0,
    32,
    0,
    0,
    0,
    0,
    48,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    144,
    0,
    0,
    0,
    0,
    0
  ],
  [
    0,
    0,
    0,
    0,
    2,
    0,
    0,
    0,
    0,
    0,
    0,
    2,
    0,
    0,
    0,
    0,
    220,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0
  ],
  [
    0,
    64,
    1,
    65,
    0,
    9,
    73,
    0,
    0,
    0,
    0,
    81,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    64,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0
  ],
  [
    0,
    0,
    0,
    16,
    0,
    32,
    48,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0
  ],
  [
    234,
    0,
    4,
    12,
    0,
    20,
    28,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    128,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0
  ],
  [
    8,
    8,
    4,
    12,
    0,
    20,
    28,
    0,
    20,
    28,
    0,
    128,
    0,
    16,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    8,
    0,
    0,
    128,
    0,
    0,
    0,
    0,
    0
  ],
  [
    0,
    0,
    0,
    76,
    0,
    0,
    0,
    0,
    0,
    0,
    178,
    108,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0
  ],
  [
    0,
    0,
    5,
    13,
    0,
    0,
    0,
    0,
    0,
    0,
    18,
    0,
    18,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    18,
    0
  ],
  [
    10,
    10,
    6,
    14,
    0,
    22,
    30,
    0,
    0,
    0,
    18,
    0,
    18,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    10
  ],
  [
    3,
    3,
    4,
    12,
    0,
    20,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    3
  ]
];
var ca65VariantTables = {
  "4510": [
    ["ADC", 8431212, 96, 0, "PutAll"],
    ["AND", 8431212, 32, 0, "PutAll"],
    ["ASL", 110, 2, 1, "PutAll"],
    ["ASR", 38, 67, 0, "Put4510"],
    ["ASW", 8, 203, 6, "PutAll"],
    ["BBR0", 0, 15, 0, "PutBitBranch"],
    ["BBR1", 0, 31, 0, "PutBitBranch"],
    ["BBR2", 0, 47, 0, "PutBitBranch"],
    ["BBR3", 0, 63, 0, "PutBitBranch"],
    ["BBR4", 0, 79, 0, "PutBitBranch"],
    ["BBR5", 0, 95, 0, "PutBitBranch"],
    ["BBR6", 0, 111, 0, "PutBitBranch"],
    ["BBR7", 0, 127, 0, "PutBitBranch"],
    ["BBS0", 0, 143, 0, "PutBitBranch"],
    ["BBS1", 0, 159, 0, "PutBitBranch"],
    ["BBS2", 0, 175, 0, "PutBitBranch"],
    ["BBS3", 0, 191, 0, "PutBitBranch"],
    ["BBS4", 0, 207, 0, "PutBitBranch"],
    ["BBS5", 0, 223, 0, "PutBitBranch"],
    ["BBS6", 0, 239, 0, "PutBitBranch"],
    ["BBS7", 0, 255, 0, "PutBitBranch"],
    ["BCC", 131072, 144, 0, "PutPCRel8"],
    ["BCS", 131072, 176, 0, "PutPCRel8"],
    ["BEQ", 131072, 240, 0, "PutPCRel8"],
    ["BIT", 10485868, 0, 2, "PutAll"],
    ["BMI", 131072, 48, 0, "PutPCRel8"],
    ["BNE", 131072, 208, 0, "PutPCRel8"],
    ["BPL", 131072, 16, 0, "PutPCRel8"],
    ["BRA", 131072, 128, 0, "PutPCRel8"],
    ["BRK", 8388613, 0, 6, "PutAll"],
    ["BSR", 262144, 99, 0, "PutPCRel4510"],
    ["BVC", 131072, 80, 0, "PutPCRel8"],
    ["BVS", 131072, 112, 0, "PutPCRel8"],
    ["CLC", 1, 24, 0, "PutAll"],
    ["CLD", 1, 216, 0, "PutAll"],
    ["CLE", 1, 2, 0, "PutAll"],
    ["CLI", 1, 88, 0, "PutAll"],
    ["CLV", 1, 184, 0, "PutAll"],
    ["CMP", 8431212, 192, 0, "PutAll"],
    ["CPX", 8388620, 224, 1, "PutAll"],
    ["CPY", 8388620, 192, 1, "PutAll"],
    ["CPZ", 8388620, 208, 1, "Put4510"],
    ["DEA", 1, 0, 3, "PutAll"],
    ["DEC", 111, 0, 3, "PutAll"],
    ["DEW", 4, 195, 9, "PutAll"],
    ["DEX", 1, 202, 0, "PutAll"],
    ["DEY", 1, 136, 0, "PutAll"],
    ["DEZ", 1, 59, 0, "PutAll"],
    ["EOM", 1, 234, 0, "PutAll"],
    ["EOR", 8431212, 64, 0, "PutAll"],
    ["INA", 1, 0, 4, "PutAll"],
    ["INC", 111, 0, 4, "PutAll"],
    ["INW", 4, 227, 9, "PutAll"],
    ["INX", 1, 232, 0, "PutAll"],
    ["INY", 1, 200, 0, "PutAll"],
    ["INZ", 1, 27, 0, "PutAll"],
    ["JMP", 67592, 76, 6, "PutAll"],
    ["JSR", 67592, 32, 7, "Put4510"],
    ["LBCC", 262144, 147, 0, "PutPCRel4510"],
    ["LBCS", 262144, 179, 0, "PutPCRel4510"],
    ["LBEQ", 262144, 243, 0, "PutPCRel4510"],
    ["LBMI", 262144, 51, 0, "PutPCRel4510"],
    ["LBNE", 262144, 211, 0, "PutPCRel4510"],
    ["LBPL", 262144, 19, 0, "PutPCRel4510"],
    ["LBRA", 262144, 131, 0, "PutPCRel4510"],
    ["LBVC", 262144, 83, 0, "PutPCRel4510"],
    ["LBVS", 262144, 115, 0, "PutPCRel4510"],
    ["LDA", 9479788, 160, 0, "Put4510"],
    ["LDX", 8389388, 162, 1, "PutAll"],
    ["LDY", 8388716, 160, 1, "PutAll"],
    ["LDZ", 8388680, 163, 1, "Put4510"],
    ["LSR", 111, 66, 1, "PutAll"],
    ["MAP", 1, 92, 0, "PutAll"],
    ["NEG", 1, 66, 0, "PutAll"],
    ["NOP", 1, 234, 0, "PutAll"],
    ["ORA", 8431212, 0, 0, "PutAll"],
    ["PHA", 1, 72, 0, "PutAll"],
    ["PHD", 134217736, 244, 1, "PutAll"],
    ["PHP", 1, 8, 0, "PutAll"],
    ["PHW", 134217736, 244, 1, "PutAll"],
    ["PHX", 1, 218, 0, "PutAll"],
    ["PHY", 1, 90, 0, "PutAll"],
    ["PHZ", 1, 219, 0, "PutAll"],
    ["PLA", 1, 104, 0, "PutAll"],
    ["PLP", 1, 40, 0, "PutAll"],
    ["PLX", 1, 250, 0, "PutAll"],
    ["PLY", 1, 122, 0, "PutAll"],
    ["PLZ", 1, 251, 0, "PutAll"],
    ["RMB0", 4, 7, 1, "PutAll"],
    ["RMB1", 4, 23, 1, "PutAll"],
    ["RMB2", 4, 39, 1, "PutAll"],
    ["RMB3", 4, 55, 1, "PutAll"],
    ["RMB4", 4, 71, 1, "PutAll"],
    ["RMB5", 4, 87, 1, "PutAll"],
    ["RMB6", 4, 103, 1, "PutAll"],
    ["RMB7", 4, 119, 1, "PutAll"],
    ["ROL", 111, 34, 1, "PutAll"],
    ["ROR", 111, 98, 1, "PutAll"],
    ["ROW", 8, 235, 6, "PutAll"],
    ["RTI", 1, 64, 0, "PutAll"],
    ["RTN", 8388608, 98, 1, "PutAll"],
    ["RTS", 1, 96, 0, "PutAll"],
    ["SBC", 8431212, 224, 0, "PutAll"],
    ["SEC", 1, 56, 0, "PutAll"],
    ["SED", 1, 248, 0, "PutAll"],
    ["SEE", 1, 3, 0, "PutAll"],
    ["SEI", 1, 120, 0, "PutAll"],
    ["SMB0", 4, 135, 1, "PutAll"],
    ["SMB1", 4, 151, 1, "PutAll"],
    ["SMB2", 4, 167, 1, "PutAll"],
    ["SMB3", 4, 183, 1, "PutAll"],
    ["SMB4", 4, 199, 1, "PutAll"],
    ["SMB5", 4, 215, 1, "PutAll"],
    ["SMB6", 4, 231, 1, "PutAll"],
    ["SMB7", 4, 247, 1, "PutAll"],
    ["STA", 1091180, 128, 0, "Put4510"],
    ["STX", 780, 130, 1, "Put4510"],
    ["STY", 108, 128, 1, "Put4510"],
    ["STZ", 108, 4, 5, "PutAll"],
    ["TAB", 1, 91, 0, "PutAll"],
    ["TAX", 1, 170, 0, "PutAll"],
    ["TAY", 1, 168, 0, "PutAll"],
    ["TAZ", 1, 75, 0, "PutAll"],
    ["TBA", 1, 123, 0, "PutAll"],
    ["TRB", 12, 16, 1, "PutAll"],
    ["TSB", 12, 0, 1, "PutAll"],
    ["TSX", 1, 186, 0, "PutAll"],
    ["TSY", 1, 11, 0, "PutAll"],
    ["TXA", 1, 138, 0, "PutAll"],
    ["TXS", 1, 154, 0, "PutAll"],
    ["TYA", 1, 152, 0, "PutAll"],
    ["TYS", 1, 43, 0, "PutAll"],
    ["TZA", 1, 107, 0, "PutAll"]
  ],
  "6502DTV": [
    ["ADC", 8430188, 96, 0, "PutAll"],
    ["ALR", 8388608, 75, 0, "PutAll"],
    ["ANC", 8388608, 11, 0, "PutAll"],
    ["AND", 8430188, 32, 0, "PutAll"],
    ["ANE", 8388608, 139, 0, "PutAll"],
    ["ARR", 8388608, 107, 0, "PutAll"],
    ["ASL", 110, 2, 1, "PutAll"],
    ["AXS", 8388608, 203, 0, "PutAll"],
    ["BCC", 131072, 144, 0, "PutPCRel8"],
    ["BCS", 131072, 176, 0, "PutPCRel8"],
    ["BEQ", 131072, 240, 0, "PutPCRel8"],
    ["BIT", 12, 0, 2, "PutAll"],
    ["BMI", 131072, 48, 0, "PutPCRel8"],
    ["BNE", 131072, 208, 0, "PutPCRel8"],
    ["BPL", 131072, 16, 0, "PutPCRel8"],
    ["BRA", 131072, 18, 0, "PutPCRel8"],
    ["BRK", 8388613, 0, 6, "PutAll"],
    ["BVC", 131072, 80, 0, "PutPCRel8"],
    ["BVS", 131072, 112, 0, "PutPCRel8"],
    ["CLC", 1, 24, 0, "PutAll"],
    ["CLD", 1, 216, 0, "PutAll"],
    ["CLI", 1, 88, 0, "PutAll"],
    ["CLV", 1, 184, 0, "PutAll"],
    ["CMP", 8430188, 192, 0, "PutAll"],
    ["CPX", 8388620, 224, 1, "PutAll"],
    ["CPY", 8388620, 192, 1, "PutAll"],
    ["DEC", 108, 0, 3, "PutAll"],
    ["DEX", 1, 202, 0, "PutAll"],
    ["DEY", 1, 136, 0, "PutAll"],
    ["EOR", 8430188, 64, 0, "PutAll"],
    ["INC", 108, 0, 4, "PutAll"],
    ["INX", 1, 232, 0, "PutAll"],
    ["INY", 1, 200, 0, "PutAll"],
    ["JMP", 2056, 76, 6, "PutJMP"],
    ["JSR", 8, 32, 7, "PutAll"],
    ["LAS", 512, 187, 0, "PutAll"],
    ["LAX", 8430348, 163, 11, "PutAll"],
    ["LDA", 8430188, 160, 0, "PutAll"],
    ["LDX", 8389388, 162, 1, "PutAll"],
    ["LDY", 8388716, 160, 1, "PutAll"],
    ["LSR", 111, 66, 1, "PutAll"],
    ["NOP", 8388717, 0, 10, "PutAll"],
    ["ORA", 8430188, 0, 0, "PutAll"],
    ["PHA", 1, 72, 0, "PutAll"],
    ["PHP", 1, 8, 0, "PutAll"],
    ["PLA", 1, 104, 0, "PutAll"],
    ["PLP", 1, 40, 0, "PutAll"],
    ["RLA", 41580, 35, 0, "PutAll"],
    ["ROL", 111, 34, 1, "PutAll"],
    ["ROR", 111, 98, 1, "PutAll"],
    ["RRA", 41580, 99, 0, "PutAll"],
    ["RTI", 1, 64, 0, "PutAll"],
    ["RTS", 1, 96, 0, "PutAll"],
    ["SAC", 8388608, 50, 1, "PutAll"],
    ["SBC", 8430188, 224, 0, "PutAll"],
    ["SEC", 1, 56, 0, "PutAll"],
    ["SED", 1, 248, 0, "PutAll"],
    ["SEI", 1, 120, 0, "PutAll"],
    ["SHA", 8704, 147, 1, "PutAll"],
    ["SHX", 512, 158, 1, "PutAll"],
    ["SHY", 64, 156, 1, "PutAll"],
    ["SIR", 8388608, 66, 1, "PutAll"],
    ["STA", 41580, 128, 0, "PutAll"],
    ["STX", 268, 130, 1, "PutAll"],
    ["STY", 44, 128, 1, "PutAll"],
    ["TAX", 1, 170, 0, "PutAll"],
    ["TAY", 1, 168, 0, "PutAll"],
    ["TSX", 1, 186, 0, "PutAll"],
    ["TXA", 1, 138, 0, "PutAll"],
    ["TXS", 1, 154, 0, "PutAll"],
    ["TYA", 1, 152, 0, "PutAll"]
  ],
  "65SC02": [
    ["ADC", 8431212, 96, 0, "PutAll"],
    ["AND", 8431212, 32, 0, "PutAll"],
    ["ASL", 110, 2, 1, "PutAll"],
    ["BCC", 131072, 144, 0, "PutPCRel8"],
    ["BCS", 131072, 176, 0, "PutPCRel8"],
    ["BEQ", 131072, 240, 0, "PutPCRel8"],
    ["BIT", 10485868, 0, 2, "PutAll"],
    ["BMI", 131072, 48, 0, "PutPCRel8"],
    ["BNE", 131072, 208, 0, "PutPCRel8"],
    ["BPL", 131072, 16, 0, "PutPCRel8"],
    ["BRA", 131072, 128, 0, "PutPCRel8"],
    ["BRK", 8388613, 0, 6, "PutAll"],
    ["BVC", 131072, 80, 0, "PutPCRel8"],
    ["BVS", 131072, 112, 0, "PutPCRel8"],
    ["CLC", 1, 24, 0, "PutAll"],
    ["CLD", 1, 216, 0, "PutAll"],
    ["CLI", 1, 88, 0, "PutAll"],
    ["CLV", 1, 184, 0, "PutAll"],
    ["CMP", 8431212, 192, 0, "PutAll"],
    ["CPX", 8388620, 224, 1, "PutAll"],
    ["CPY", 8388620, 192, 1, "PutAll"],
    ["DEA", 1, 0, 3, "PutAll"],
    ["DEC", 111, 0, 3, "PutAll"],
    ["DEX", 1, 202, 0, "PutAll"],
    ["DEY", 1, 136, 0, "PutAll"],
    ["EOR", 8431212, 64, 0, "PutAll"],
    ["INA", 1, 0, 4, "PutAll"],
    ["INC", 111, 0, 4, "PutAll"],
    ["INX", 1, 232, 0, "PutAll"],
    ["INY", 1, 200, 0, "PutAll"],
    ["JMP", 67592, 76, 6, "PutAll"],
    ["JSR", 8, 32, 7, "PutAll"],
    ["LDA", 8431212, 160, 0, "PutAll"],
    ["LDX", 8389388, 162, 1, "PutAll"],
    ["LDY", 8388716, 160, 1, "PutAll"],
    ["LSR", 111, 66, 1, "PutAll"],
    ["NOP", 1, 234, 0, "PutAll"],
    ["ORA", 8431212, 0, 0, "PutAll"],
    ["PHA", 1, 72, 0, "PutAll"],
    ["PHP", 1, 8, 0, "PutAll"],
    ["PHX", 1, 218, 0, "PutAll"],
    ["PHY", 1, 90, 0, "PutAll"],
    ["PLA", 1, 104, 0, "PutAll"],
    ["PLP", 1, 40, 0, "PutAll"],
    ["PLX", 1, 250, 0, "PutAll"],
    ["PLY", 1, 122, 0, "PutAll"],
    ["ROL", 111, 34, 1, "PutAll"],
    ["ROR", 111, 98, 1, "PutAll"],
    ["RTI", 1, 64, 0, "PutAll"],
    ["RTS", 1, 96, 0, "PutAll"],
    ["SBC", 8431212, 224, 0, "PutAll"],
    ["SEC", 1, 56, 0, "PutAll"],
    ["SED", 1, 248, 0, "PutAll"],
    ["SEI", 1, 120, 0, "PutAll"],
    ["STA", 42604, 128, 0, "PutAll"],
    ["STX", 268, 130, 1, "PutAll"],
    ["STY", 44, 128, 1, "PutAll"],
    ["STZ", 108, 4, 5, "PutAll"],
    ["TAX", 1, 170, 0, "PutAll"],
    ["TAY", 1, 168, 0, "PutAll"],
    ["TRB", 12, 16, 1, "PutAll"],
    ["TSB", 12, 0, 1, "PutAll"],
    ["TSX", 1, 186, 0, "PutAll"],
    ["TXA", 1, 138, 0, "PutAll"],
    ["TXS", 1, 154, 0, "PutAll"],
    ["TYA", 1, 152, 0, "PutAll"]
  ],
  "65C02": [
    ["ADC", 8431212, 96, 0, "PutAll"],
    ["AND", 8431212, 32, 0, "PutAll"],
    ["ASL", 110, 2, 1, "PutAll"],
    ["BBR0", 0, 15, 0, "PutBitBranch"],
    ["BBR1", 0, 31, 0, "PutBitBranch"],
    ["BBR2", 0, 47, 0, "PutBitBranch"],
    ["BBR3", 0, 63, 0, "PutBitBranch"],
    ["BBR4", 0, 79, 0, "PutBitBranch"],
    ["BBR5", 0, 95, 0, "PutBitBranch"],
    ["BBR6", 0, 111, 0, "PutBitBranch"],
    ["BBR7", 0, 127, 0, "PutBitBranch"],
    ["BBS0", 0, 143, 0, "PutBitBranch"],
    ["BBS1", 0, 159, 0, "PutBitBranch"],
    ["BBS2", 0, 175, 0, "PutBitBranch"],
    ["BBS3", 0, 191, 0, "PutBitBranch"],
    ["BBS4", 0, 207, 0, "PutBitBranch"],
    ["BBS5", 0, 223, 0, "PutBitBranch"],
    ["BBS6", 0, 239, 0, "PutBitBranch"],
    ["BBS7", 0, 255, 0, "PutBitBranch"],
    ["BCC", 131072, 144, 0, "PutPCRel8"],
    ["BCS", 131072, 176, 0, "PutPCRel8"],
    ["BEQ", 131072, 240, 0, "PutPCRel8"],
    ["BIT", 10485868, 0, 2, "PutAll"],
    ["BMI", 131072, 48, 0, "PutPCRel8"],
    ["BNE", 131072, 208, 0, "PutPCRel8"],
    ["BPL", 131072, 16, 0, "PutPCRel8"],
    ["BRA", 131072, 128, 0, "PutPCRel8"],
    ["BRK", 8388613, 0, 6, "PutAll"],
    ["BVC", 131072, 80, 0, "PutPCRel8"],
    ["BVS", 131072, 112, 0, "PutPCRel8"],
    ["CLC", 1, 24, 0, "PutAll"],
    ["CLD", 1, 216, 0, "PutAll"],
    ["CLI", 1, 88, 0, "PutAll"],
    ["CLV", 1, 184, 0, "PutAll"],
    ["CMP", 8431212, 192, 0, "PutAll"],
    ["CPX", 8388620, 224, 1, "PutAll"],
    ["CPY", 8388620, 192, 1, "PutAll"],
    ["DEA", 1, 0, 3, "PutAll"],
    ["DEC", 111, 0, 3, "PutAll"],
    ["DEX", 1, 202, 0, "PutAll"],
    ["DEY", 1, 136, 0, "PutAll"],
    ["EOR", 8431212, 64, 0, "PutAll"],
    ["INA", 1, 0, 4, "PutAll"],
    ["INC", 111, 0, 4, "PutAll"],
    ["INX", 1, 232, 0, "PutAll"],
    ["INY", 1, 200, 0, "PutAll"],
    ["JMP", 67592, 76, 6, "PutAll"],
    ["JSR", 8, 32, 7, "PutAll"],
    ["LDA", 8431212, 160, 0, "PutAll"],
    ["LDX", 8389388, 162, 1, "PutAll"],
    ["LDY", 8388716, 160, 1, "PutAll"],
    ["LSR", 111, 66, 1, "PutAll"],
    ["NOP", 1, 234, 0, "PutAll"],
    ["ORA", 8431212, 0, 0, "PutAll"],
    ["PHA", 1, 72, 0, "PutAll"],
    ["PHP", 1, 8, 0, "PutAll"],
    ["PHX", 1, 218, 0, "PutAll"],
    ["PHY", 1, 90, 0, "PutAll"],
    ["PLA", 1, 104, 0, "PutAll"],
    ["PLP", 1, 40, 0, "PutAll"],
    ["PLX", 1, 250, 0, "PutAll"],
    ["PLY", 1, 122, 0, "PutAll"],
    ["RMB0", 4, 7, 1, "PutAll"],
    ["RMB1", 4, 23, 1, "PutAll"],
    ["RMB2", 4, 39, 1, "PutAll"],
    ["RMB3", 4, 55, 1, "PutAll"],
    ["RMB4", 4, 71, 1, "PutAll"],
    ["RMB5", 4, 87, 1, "PutAll"],
    ["RMB6", 4, 103, 1, "PutAll"],
    ["RMB7", 4, 119, 1, "PutAll"],
    ["ROL", 111, 34, 1, "PutAll"],
    ["ROR", 111, 98, 1, "PutAll"],
    ["RTI", 1, 64, 0, "PutAll"],
    ["RTS", 1, 96, 0, "PutAll"],
    ["SBC", 8431212, 224, 0, "PutAll"],
    ["SEC", 1, 56, 0, "PutAll"],
    ["SED", 1, 248, 0, "PutAll"],
    ["SEI", 1, 120, 0, "PutAll"],
    ["SMB0", 4, 135, 1, "PutAll"],
    ["SMB1", 4, 151, 1, "PutAll"],
    ["SMB2", 4, 167, 1, "PutAll"],
    ["SMB3", 4, 183, 1, "PutAll"],
    ["SMB4", 4, 199, 1, "PutAll"],
    ["SMB5", 4, 215, 1, "PutAll"],
    ["SMB6", 4, 231, 1, "PutAll"],
    ["SMB7", 4, 247, 1, "PutAll"],
    ["STA", 42604, 128, 0, "PutAll"],
    ["STX", 268, 130, 1, "PutAll"],
    ["STY", 44, 128, 1, "PutAll"],
    ["STZ", 108, 4, 5, "PutAll"],
    ["TAX", 1, 170, 0, "PutAll"],
    ["TAY", 1, 168, 0, "PutAll"],
    ["TRB", 12, 16, 1, "PutAll"],
    ["TSB", 12, 0, 1, "PutAll"],
    ["TSX", 1, 186, 0, "PutAll"],
    ["TXA", 1, 138, 0, "PutAll"],
    ["TXS", 1, 154, 0, "PutAll"],
    ["TYA", 1, 152, 0, "PutAll"]
  ],
  W65C02: [
    ["ADC", 8431212, 96, 0, "PutAll"],
    ["AND", 8431212, 32, 0, "PutAll"],
    ["ASL", 110, 2, 1, "PutAll"],
    ["BBR0", 0, 15, 0, "PutBitBranch"],
    ["BBR1", 0, 31, 0, "PutBitBranch"],
    ["BBR2", 0, 47, 0, "PutBitBranch"],
    ["BBR3", 0, 63, 0, "PutBitBranch"],
    ["BBR4", 0, 79, 0, "PutBitBranch"],
    ["BBR5", 0, 95, 0, "PutBitBranch"],
    ["BBR6", 0, 111, 0, "PutBitBranch"],
    ["BBR7", 0, 127, 0, "PutBitBranch"],
    ["BBS0", 0, 143, 0, "PutBitBranch"],
    ["BBS1", 0, 159, 0, "PutBitBranch"],
    ["BBS2", 0, 175, 0, "PutBitBranch"],
    ["BBS3", 0, 191, 0, "PutBitBranch"],
    ["BBS4", 0, 207, 0, "PutBitBranch"],
    ["BBS5", 0, 223, 0, "PutBitBranch"],
    ["BBS6", 0, 239, 0, "PutBitBranch"],
    ["BBS7", 0, 255, 0, "PutBitBranch"],
    ["BCC", 131072, 144, 0, "PutPCRel8"],
    ["BCS", 131072, 176, 0, "PutPCRel8"],
    ["BEQ", 131072, 240, 0, "PutPCRel8"],
    ["BIT", 10485868, 0, 2, "PutAll"],
    ["BMI", 131072, 48, 0, "PutPCRel8"],
    ["BNE", 131072, 208, 0, "PutPCRel8"],
    ["BPL", 131072, 16, 0, "PutPCRel8"],
    ["BRA", 131072, 128, 0, "PutPCRel8"],
    ["BRK", 8388613, 0, 6, "PutAll"],
    ["BVC", 131072, 80, 0, "PutPCRel8"],
    ["BVS", 131072, 112, 0, "PutPCRel8"],
    ["CLC", 1, 24, 0, "PutAll"],
    ["CLD", 1, 216, 0, "PutAll"],
    ["CLI", 1, 88, 0, "PutAll"],
    ["CLV", 1, 184, 0, "PutAll"],
    ["CMP", 8431212, 192, 0, "PutAll"],
    ["CPX", 8388620, 224, 1, "PutAll"],
    ["CPY", 8388620, 192, 1, "PutAll"],
    ["DEA", 1, 0, 3, "PutAll"],
    ["DEC", 111, 0, 3, "PutAll"],
    ["DEX", 1, 202, 0, "PutAll"],
    ["DEY", 1, 136, 0, "PutAll"],
    ["EOR", 8431212, 64, 0, "PutAll"],
    ["INA", 1, 0, 4, "PutAll"],
    ["INC", 111, 0, 4, "PutAll"],
    ["INX", 1, 232, 0, "PutAll"],
    ["INY", 1, 200, 0, "PutAll"],
    ["JMP", 67592, 76, 6, "PutAll"],
    ["JSR", 8, 32, 7, "PutAll"],
    ["LDA", 8431212, 160, 0, "PutAll"],
    ["LDX", 8389388, 162, 1, "PutAll"],
    ["LDY", 8388716, 160, 1, "PutAll"],
    ["LSR", 111, 66, 1, "PutAll"],
    ["NOP", 1, 234, 0, "PutAll"],
    ["ORA", 8431212, 0, 0, "PutAll"],
    ["PHA", 1, 72, 0, "PutAll"],
    ["PHP", 1, 8, 0, "PutAll"],
    ["PHX", 1, 218, 0, "PutAll"],
    ["PHY", 1, 90, 0, "PutAll"],
    ["PLA", 1, 104, 0, "PutAll"],
    ["PLP", 1, 40, 0, "PutAll"],
    ["PLX", 1, 250, 0, "PutAll"],
    ["PLY", 1, 122, 0, "PutAll"],
    ["RMB0", 4, 7, 1, "PutAll"],
    ["RMB1", 4, 23, 1, "PutAll"],
    ["RMB2", 4, 39, 1, "PutAll"],
    ["RMB3", 4, 55, 1, "PutAll"],
    ["RMB4", 4, 71, 1, "PutAll"],
    ["RMB5", 4, 87, 1, "PutAll"],
    ["RMB6", 4, 103, 1, "PutAll"],
    ["RMB7", 4, 119, 1, "PutAll"],
    ["ROL", 111, 34, 1, "PutAll"],
    ["ROR", 111, 98, 1, "PutAll"],
    ["RTI", 1, 64, 0, "PutAll"],
    ["RTS", 1, 96, 0, "PutAll"],
    ["SBC", 8431212, 224, 0, "PutAll"],
    ["SEC", 1, 56, 0, "PutAll"],
    ["SED", 1, 248, 0, "PutAll"],
    ["SEI", 1, 120, 0, "PutAll"],
    ["SMB0", 4, 135, 1, "PutAll"],
    ["SMB1", 4, 151, 1, "PutAll"],
    ["SMB2", 4, 167, 1, "PutAll"],
    ["SMB3", 4, 183, 1, "PutAll"],
    ["SMB4", 4, 199, 1, "PutAll"],
    ["SMB5", 4, 215, 1, "PutAll"],
    ["SMB6", 4, 231, 1, "PutAll"],
    ["SMB7", 4, 247, 1, "PutAll"],
    ["STA", 42604, 128, 0, "PutAll"],
    ["STP", 1, 219, 0, "PutAll"],
    ["STX", 268, 130, 1, "PutAll"],
    ["STY", 44, 128, 1, "PutAll"],
    ["STZ", 108, 4, 5, "PutAll"],
    ["TAX", 1, 170, 0, "PutAll"],
    ["TAY", 1, 168, 0, "PutAll"],
    ["TRB", 12, 16, 1, "PutAll"],
    ["TSB", 12, 0, 1, "PutAll"],
    ["TSX", 1, 186, 0, "PutAll"],
    ["TXA", 1, 138, 0, "PutAll"],
    ["TXS", 1, 154, 0, "PutAll"],
    ["TYA", 1, 152, 0, "PutAll"],
    ["WAI", 1, 203, 0, "PutAll"]
  ],
  "65CE02": [
    ["ADC", 8431212, 96, 0, "PutAll"],
    ["AND", 8431212, 32, 0, "PutAll"],
    ["ASL", 110, 2, 1, "PutAll"],
    ["ASR", 38, 67, 0, "Put4510"],
    ["ASW", 8, 203, 6, "PutAll"],
    ["AUG", 1, 92, 0, "PutAll"],
    ["BBR0", 0, 15, 0, "PutBitBranch"],
    ["BBR1", 0, 31, 0, "PutBitBranch"],
    ["BBR2", 0, 47, 0, "PutBitBranch"],
    ["BBR3", 0, 63, 0, "PutBitBranch"],
    ["BBR4", 0, 79, 0, "PutBitBranch"],
    ["BBR5", 0, 95, 0, "PutBitBranch"],
    ["BBR6", 0, 111, 0, "PutBitBranch"],
    ["BBR7", 0, 127, 0, "PutBitBranch"],
    ["BBS0", 0, 143, 0, "PutBitBranch"],
    ["BBS1", 0, 159, 0, "PutBitBranch"],
    ["BBS2", 0, 175, 0, "PutBitBranch"],
    ["BBS3", 0, 191, 0, "PutBitBranch"],
    ["BBS4", 0, 207, 0, "PutBitBranch"],
    ["BBS5", 0, 223, 0, "PutBitBranch"],
    ["BBS6", 0, 239, 0, "PutBitBranch"],
    ["BBS7", 0, 255, 0, "PutBitBranch"],
    ["BCC", 131072, 144, 0, "PutPCRel8"],
    ["BCS", 131072, 176, 0, "PutPCRel8"],
    ["BEQ", 131072, 240, 0, "PutPCRel8"],
    ["BIT", 10485868, 0, 2, "PutAll"],
    ["BMI", 131072, 48, 0, "PutPCRel8"],
    ["BNE", 131072, 208, 0, "PutPCRel8"],
    ["BPL", 131072, 16, 0, "PutPCRel8"],
    ["BRA", 131072, 128, 0, "PutPCRel8"],
    ["BRK", 8388613, 0, 6, "PutAll"],
    ["BSR", 262144, 99, 0, "PutPCRel4510"],
    ["BVC", 131072, 80, 0, "PutPCRel8"],
    ["BVS", 131072, 112, 0, "PutPCRel8"],
    ["CLC", 1, 24, 0, "PutAll"],
    ["CLD", 1, 216, 0, "PutAll"],
    ["CLE", 1, 2, 0, "PutAll"],
    ["CLI", 1, 88, 0, "PutAll"],
    ["CLV", 1, 184, 0, "PutAll"],
    ["CMP", 8431212, 192, 0, "PutAll"],
    ["CPX", 8388620, 224, 1, "PutAll"],
    ["CPY", 8388620, 192, 1, "PutAll"],
    ["CPZ", 8388620, 208, 1, "Put4510"],
    ["DEA", 1, 0, 3, "PutAll"],
    ["DEC", 111, 0, 3, "PutAll"],
    ["DEW", 4, 195, 9, "PutAll"],
    ["DEX", 1, 202, 0, "PutAll"],
    ["DEY", 1, 136, 0, "PutAll"],
    ["DEZ", 1, 59, 0, "PutAll"],
    ["EOM", 1, 234, 0, "PutAll"],
    ["EOR", 8431212, 64, 0, "PutAll"],
    ["INA", 1, 0, 4, "PutAll"],
    ["INC", 111, 0, 4, "PutAll"],
    ["INW", 4, 227, 9, "PutAll"],
    ["INX", 1, 232, 0, "PutAll"],
    ["INY", 1, 200, 0, "PutAll"],
    ["INZ", 1, 27, 0, "PutAll"],
    ["JMP", 67592, 76, 6, "PutAll"],
    ["JSR", 67592, 32, 7, "Put4510"],
    ["LBCC", 262144, 147, 0, "PutPCRel4510"],
    ["LBCS", 262144, 179, 0, "PutPCRel4510"],
    ["LBEQ", 262144, 243, 0, "PutPCRel4510"],
    ["LBMI", 262144, 51, 0, "PutPCRel4510"],
    ["LBNE", 262144, 211, 0, "PutPCRel4510"],
    ["LBPL", 262144, 19, 0, "PutPCRel4510"],
    ["LBRA", 262144, 131, 0, "PutPCRel4510"],
    ["LBVC", 262144, 83, 0, "PutPCRel4510"],
    ["LBVS", 262144, 115, 0, "PutPCRel4510"],
    ["LDA", 9479788, 160, 0, "Put4510"],
    ["LDX", 8389388, 162, 1, "PutAll"],
    ["LDY", 8388716, 160, 1, "PutAll"],
    ["LDZ", 8388680, 163, 1, "Put4510"],
    ["LSR", 111, 66, 1, "PutAll"],
    ["NEG", 1, 66, 0, "PutAll"],
    ["NOP", 1, 234, 0, "PutAll"],
    ["ORA", 8431212, 0, 0, "PutAll"],
    ["PHA", 1, 72, 0, "PutAll"],
    ["PHD", 134217736, 244, 1, "PutAll"],
    ["PHP", 1, 8, 0, "PutAll"],
    ["PHW", 134217736, 244, 1, "PutAll"],
    ["PHX", 1, 218, 0, "PutAll"],
    ["PHY", 1, 90, 0, "PutAll"],
    ["PHZ", 1, 219, 0, "PutAll"],
    ["PLA", 1, 104, 0, "PutAll"],
    ["PLP", 1, 40, 0, "PutAll"],
    ["PLX", 1, 250, 0, "PutAll"],
    ["PLY", 1, 122, 0, "PutAll"],
    ["PLZ", 1, 251, 0, "PutAll"],
    ["RMB0", 4, 7, 1, "PutAll"],
    ["RMB1", 4, 23, 1, "PutAll"],
    ["RMB2", 4, 39, 1, "PutAll"],
    ["RMB3", 4, 55, 1, "PutAll"],
    ["RMB4", 4, 71, 1, "PutAll"],
    ["RMB5", 4, 87, 1, "PutAll"],
    ["RMB6", 4, 103, 1, "PutAll"],
    ["RMB7", 4, 119, 1, "PutAll"],
    ["ROL", 111, 34, 1, "PutAll"],
    ["ROR", 111, 98, 1, "PutAll"],
    ["ROW", 8, 235, 6, "PutAll"],
    ["RTI", 1, 64, 0, "PutAll"],
    ["RTN", 8388608, 98, 1, "PutAll"],
    ["RTS", 1, 96, 0, "PutAll"],
    ["SBC", 8431212, 224, 0, "PutAll"],
    ["SEC", 1, 56, 0, "PutAll"],
    ["SED", 1, 248, 0, "PutAll"],
    ["SEE", 1, 3, 0, "PutAll"],
    ["SEI", 1, 120, 0, "PutAll"],
    ["SMB0", 4, 135, 1, "PutAll"],
    ["SMB1", 4, 151, 1, "PutAll"],
    ["SMB2", 4, 167, 1, "PutAll"],
    ["SMB3", 4, 183, 1, "PutAll"],
    ["SMB4", 4, 199, 1, "PutAll"],
    ["SMB5", 4, 215, 1, "PutAll"],
    ["SMB6", 4, 231, 1, "PutAll"],
    ["SMB7", 4, 247, 1, "PutAll"],
    ["STA", 1091180, 128, 0, "Put4510"],
    ["STX", 780, 130, 1, "Put4510"],
    ["STY", 108, 128, 1, "Put4510"],
    ["STZ", 108, 4, 5, "PutAll"],
    ["TAB", 1, 91, 0, "PutAll"],
    ["TAX", 1, 170, 0, "PutAll"],
    ["TAY", 1, 168, 0, "PutAll"],
    ["TAZ", 1, 75, 0, "PutAll"],
    ["TBA", 1, 123, 0, "PutAll"],
    ["TRB", 12, 16, 1, "PutAll"],
    ["TSB", 12, 0, 1, "PutAll"],
    ["TSX", 1, 186, 0, "PutAll"],
    ["TSY", 1, 11, 0, "PutAll"],
    ["TXA", 1, 138, 0, "PutAll"],
    ["TXS", 1, 154, 0, "PutAll"],
    ["TYA", 1, 152, 0, "PutAll"],
    ["TYS", 1, 43, 0, "PutAll"],
    ["TZA", 1, 107, 0, "PutAll"]
  ],
  "45GS02": [
    ["ADC", 1082173036, 96, 0, "Put45GS02"],
    ["ADCQ", 5132, 96, 13, "Put45GS02_Q"],
    ["AND", 1082173036, 32, 0, "Put45GS02"],
    ["ANDQ", 5132, 32, 13, "Put45GS02_Q"],
    ["ASL", 110, 2, 1, "PutAll"],
    ["ASLQ", 2147483886, 0, 14, "Put45GS02_Q"],
    ["ASR", 38, 67, 0, "Put4510"],
    ["ASRQ", 2147483686, 64, 15, "Put45GS02_Q"],
    ["ASW", 8, 203, 6, "PutAll"],
    ["BBR0", 0, 15, 0, "PutBitBranch"],
    ["BBR1", 0, 31, 0, "PutBitBranch"],
    ["BBR2", 0, 47, 0, "PutBitBranch"],
    ["BBR3", 0, 63, 0, "PutBitBranch"],
    ["BBR4", 0, 79, 0, "PutBitBranch"],
    ["BBR5", 0, 95, 0, "PutBitBranch"],
    ["BBR6", 0, 111, 0, "PutBitBranch"],
    ["BBR7", 0, 127, 0, "PutBitBranch"],
    ["BBS0", 0, 143, 0, "PutBitBranch"],
    ["BBS1", 0, 159, 0, "PutBitBranch"],
    ["BBS2", 0, 175, 0, "PutBitBranch"],
    ["BBS3", 0, 191, 0, "PutBitBranch"],
    ["BBS4", 0, 207, 0, "PutBitBranch"],
    ["BBS5", 0, 223, 0, "PutBitBranch"],
    ["BBS6", 0, 239, 0, "PutBitBranch"],
    ["BBS7", 0, 255, 0, "PutBitBranch"],
    ["BCC", 131072, 144, 0, "PutPCRel8"],
    ["BCS", 131072, 176, 0, "PutPCRel8"],
    ["BEQ", 131072, 240, 0, "PutPCRel8"],
    ["BIT", 10485868, 0, 2, "PutAll"],
    ["BITQ", 12, 32, 15, "Put45GS02_Q"],
    ["BMI", 131072, 48, 0, "PutPCRel8"],
    ["BNE", 131072, 208, 0, "PutPCRel8"],
    ["BPL", 131072, 16, 0, "PutPCRel8"],
    ["BRA", 131072, 128, 0, "PutPCRel8"],
    ["BRK", 1, 0, 0, "PutAll"],
    ["BSR", 262144, 99, 0, "PutPCRel4510"],
    ["BVC", 131072, 80, 0, "PutPCRel8"],
    ["BVS", 131072, 112, 0, "PutPCRel8"],
    ["CLC", 1, 24, 0, "PutAll"],
    ["CLD", 1, 216, 0, "PutAll"],
    ["CLE", 1, 2, 0, "PutAll"],
    ["CLI", 1, 88, 0, "PutAll"],
    ["CLV", 1, 184, 0, "PutAll"],
    ["CMP", 1082173036, 192, 0, "Put45GS02"],
    ["CMPQ", 5132, 192, 13, "Put45GS02_Q"],
    ["CPX", 8388620, 224, 1, "PutAll"],
    ["CPY", 8388620, 192, 1, "PutAll"],
    ["CPZ", 8388620, 208, 1, "Put4510"],
    ["DEA", 1, 0, 3, "PutAll"],
    ["DEC", 111, 0, 3, "PutAll"],
    ["DEQ", 2147483886, 192, 14, "Put45GS02_Q"],
    ["DEW", 4, 195, 9, "PutAll"],
    ["DEX", 1, 202, 0, "PutAll"],
    ["DEY", 1, 136, 0, "PutAll"],
    ["DEZ", 1, 59, 0, "PutAll"],
    ["EOM", 1, 234, 0, "PutAll"],
    ["EOR", 1082173036, 64, 0, "Put45GS02"],
    ["EORQ", 5132, 64, 13, "Put45GS02_Q"],
    ["INA", 1, 0, 4, "PutAll"],
    ["INC", 111, 0, 4, "PutAll"],
    ["INQ", 2147483886, 224, 14, "Put45GS02_Q"],
    ["INW", 4, 227, 9, "PutAll"],
    ["INX", 1, 232, 0, "PutAll"],
    ["INY", 1, 200, 0, "PutAll"],
    ["INZ", 1, 27, 0, "PutAll"],
    ["JMP", 67592, 76, 6, "PutAll"],
    ["JSR", 67592, 32, 7, "Put4510"],
    ["LBCC", 262144, 147, 0, "PutPCRel4510"],
    ["LBCS", 262144, 179, 0, "PutPCRel4510"],
    ["LBEQ", 262144, 243, 0, "PutPCRel4510"],
    ["LBMI", 262144, 51, 0, "PutPCRel4510"],
    ["LBNE", 262144, 211, 0, "PutPCRel4510"],
    ["LBPL", 262144, 19, 0, "PutPCRel4510"],
    ["LBRA", 262144, 131, 0, "PutPCRel4510"],
    ["LBVC", 262144, 83, 0, "PutPCRel4510"],
    ["LBVS", 262144, 115, 0, "PutPCRel4510"],
    ["LDA", 1083221612, 160, 0, "Put45GS02"],
    ["LDQ", 1073746956, 160, 13, "Put45GS02_Q"],
    ["LDX", 8389388, 162, 1, "PutAll"],
    ["LDY", 8388716, 160, 1, "PutAll"],
    ["LDZ", 8388680, 163, 1, "Put4510"],
    ["LSR", 111, 66, 1, "PutAll"],
    ["LSRQ", 2147483886, 64, 14, "Put45GS02_Q"],
    ["MAP", 1, 92, 0, "PutAll"],
    ["NEG", 1, 66, 0, "PutAll"],
    ["NOP", 1, 234, 0, "PutAll"],
    ["ORA", 1082173036, 0, 0, "Put45GS02"],
    ["ORQ", 5132, 0, 13, "Put45GS02_Q"],
    ["PHA", 1, 72, 0, "PutAll"],
    ["PHD", 134217736, 244, 1, "PutAll"],
    ["PHP", 1, 8, 0, "PutAll"],
    ["PHW", 134217736, 244, 1, "PutAll"],
    ["PHX", 1, 218, 0, "PutAll"],
    ["PHY", 1, 90, 0, "PutAll"],
    ["PHZ", 1, 219, 0, "PutAll"],
    ["PLA", 1, 104, 0, "PutAll"],
    ["PLP", 1, 40, 0, "PutAll"],
    ["PLX", 1, 250, 0, "PutAll"],
    ["PLY", 1, 122, 0, "PutAll"],
    ["PLZ", 1, 251, 0, "PutAll"],
    ["RMB0", 4, 7, 1, "PutAll"],
    ["RMB1", 4, 23, 1, "PutAll"],
    ["RMB2", 4, 39, 1, "PutAll"],
    ["RMB3", 4, 55, 1, "PutAll"],
    ["RMB4", 4, 71, 1, "PutAll"],
    ["RMB5", 4, 87, 1, "PutAll"],
    ["RMB6", 4, 103, 1, "PutAll"],
    ["RMB7", 4, 119, 1, "PutAll"],
    ["ROL", 111, 34, 1, "PutAll"],
    ["ROLQ", 2147483886, 32, 14, "Put45GS02_Q"],
    ["ROR", 111, 98, 1, "PutAll"],
    ["RORQ", 2147483886, 96, 14, "Put45GS02_Q"],
    ["ROW", 8, 235, 6, "PutAll"],
    ["RTI", 1, 64, 0, "PutAll"],
    ["RTN", 8388608, 98, 1, "PutAll"],
    ["RTS", 1, 96, 0, "PutAll"],
    ["SBC", 1082173036, 224, 0, "Put45GS02"],
    ["SBCQ", 5132, 224, 13, "Put45GS02_Q"],
    ["SEC", 1, 56, 0, "PutAll"],
    ["SED", 1, 248, 0, "PutAll"],
    ["SEE", 1, 3, 0, "PutAll"],
    ["SEI", 1, 120, 0, "PutAll"],
    ["SMB0", 4, 135, 1, "PutAll"],
    ["SMB1", 4, 151, 1, "PutAll"],
    ["SMB2", 4, 167, 1, "PutAll"],
    ["SMB3", 4, 183, 1, "PutAll"],
    ["SMB4", 4, 199, 1, "PutAll"],
    ["SMB5", 4, 215, 1, "PutAll"],
    ["SMB6", 4, 231, 1, "PutAll"],
    ["SMB7", 4, 247, 1, "PutAll"],
    ["STA", 1074833004, 128, 0, "Put45GS02"],
    ["STQ", 5132, 128, 13, "Put45GS02_Q"],
    ["STX", 780, 130, 1, "Put4510"],
    ["STY", 108, 128, 1, "Put4510"],
    ["STZ", 108, 4, 5, "PutAll"],
    ["TAB", 1, 91, 0, "PutAll"],
    ["TAX", 1, 170, 0, "PutAll"],
    ["TAY", 1, 168, 0, "PutAll"],
    ["TAZ", 1, 75, 0, "PutAll"],
    ["TBA", 1, 123, 0, "PutAll"],
    ["TRB", 12, 16, 1, "PutAll"],
    ["TSB", 12, 0, 1, "PutAll"],
    ["TSX", 1, 186, 0, "PutAll"],
    ["TSY", 1, 11, 0, "PutAll"],
    ["TXA", 1, 138, 0, "PutAll"],
    ["TXS", 1, 154, 0, "PutAll"],
    ["TYA", 1, 152, 0, "PutAll"],
    ["TYS", 1, 43, 0, "PutAll"],
    ["TZA", 1, 107, 0, "PutAll"]
  ],
  HuC6280: [
    ["ADC", 8431212, 96, 0, "PutAll"],
    ["AND", 8431212, 32, 0, "PutAll"],
    ["ASL", 110, 2, 1, "PutAll"],
    ["BBR0", 0, 15, 0, "PutBitBranch"],
    ["BBR1", 0, 31, 0, "PutBitBranch"],
    ["BBR2", 0, 47, 0, "PutBitBranch"],
    ["BBR3", 0, 63, 0, "PutBitBranch"],
    ["BBR4", 0, 79, 0, "PutBitBranch"],
    ["BBR5", 0, 95, 0, "PutBitBranch"],
    ["BBR6", 0, 111, 0, "PutBitBranch"],
    ["BBR7", 0, 127, 0, "PutBitBranch"],
    ["BBS0", 0, 143, 0, "PutBitBranch"],
    ["BBS1", 0, 159, 0, "PutBitBranch"],
    ["BBS2", 0, 175, 0, "PutBitBranch"],
    ["BBS3", 0, 191, 0, "PutBitBranch"],
    ["BBS4", 0, 207, 0, "PutBitBranch"],
    ["BBS5", 0, 223, 0, "PutBitBranch"],
    ["BBS6", 0, 239, 0, "PutBitBranch"],
    ["BBS7", 0, 255, 0, "PutBitBranch"],
    ["BCC", 131072, 144, 0, "PutPCRel8"],
    ["BCS", 131072, 176, 0, "PutPCRel8"],
    ["BEQ", 131072, 240, 0, "PutPCRel8"],
    ["BIT", 10485868, 0, 2, "PutAll"],
    ["BMI", 131072, 48, 0, "PutPCRel8"],
    ["BNE", 131072, 208, 0, "PutPCRel8"],
    ["BPL", 131072, 16, 0, "PutPCRel8"],
    ["BRA", 131072, 128, 0, "PutPCRel8"],
    ["BRK", 8388613, 0, 6, "PutAll"],
    ["BSR", 131072, 68, 0, "PutPCRel8"],
    ["BVC", 131072, 80, 0, "PutPCRel8"],
    ["BVS", 131072, 112, 0, "PutPCRel8"],
    ["CLA", 1, 98, 0, "PutAll"],
    ["CLC", 1, 24, 0, "PutAll"],
    ["CLD", 1, 216, 0, "PutAll"],
    ["CLI", 1, 88, 0, "PutAll"],
    ["CLV", 1, 184, 0, "PutAll"],
    ["CLX", 1, 130, 0, "PutAll"],
    ["CLY", 1, 194, 0, "PutAll"],
    ["CMP", 8431212, 192, 0, "PutAll"],
    ["CPX", 8388620, 224, 1, "PutAll"],
    ["CPY", 8388620, 192, 1, "PutAll"],
    ["CSH", 1, 212, 0, "PutAll"],
    ["CSL", 1, 84, 0, "PutAll"],
    ["DEA", 1, 0, 3, "PutAll"],
    ["DEC", 111, 0, 3, "PutAll"],
    ["DEX", 1, 202, 0, "PutAll"],
    ["DEY", 1, 136, 0, "PutAll"],
    ["EOR", 8431212, 64, 0, "PutAll"],
    ["INA", 1, 0, 4, "PutAll"],
    ["INC", 111, 0, 4, "PutAll"],
    ["INX", 1, 232, 0, "PutAll"],
    ["INY", 1, 200, 0, "PutAll"],
    ["JMP", 67592, 76, 6, "PutAll"],
    ["JSR", 8, 32, 7, "PutAll"],
    ["LDA", 8431212, 160, 0, "PutAll"],
    ["LDX", 8389388, 162, 1, "PutAll"],
    ["LDY", 8388716, 160, 1, "PutAll"],
    ["LSR", 111, 66, 1, "PutAll"],
    ["NOP", 1, 234, 0, "PutAll"],
    ["ORA", 8431212, 0, 0, "PutAll"],
    ["PHA", 1, 72, 0, "PutAll"],
    ["PHP", 1, 8, 0, "PutAll"],
    ["PHX", 1, 218, 0, "PutAll"],
    ["PHY", 1, 90, 0, "PutAll"],
    ["PLA", 1, 104, 0, "PutAll"],
    ["PLP", 1, 40, 0, "PutAll"],
    ["PLX", 1, 250, 0, "PutAll"],
    ["PLY", 1, 122, 0, "PutAll"],
    ["RMB0", 4, 7, 1, "PutAll"],
    ["RMB1", 4, 23, 1, "PutAll"],
    ["RMB2", 4, 39, 1, "PutAll"],
    ["RMB3", 4, 55, 1, "PutAll"],
    ["RMB4", 4, 71, 1, "PutAll"],
    ["RMB5", 4, 87, 1, "PutAll"],
    ["RMB6", 4, 103, 1, "PutAll"],
    ["RMB7", 4, 119, 1, "PutAll"],
    ["ROL", 111, 34, 1, "PutAll"],
    ["ROR", 111, 98, 1, "PutAll"],
    ["RTI", 1, 64, 0, "PutAll"],
    ["RTS", 1, 96, 0, "PutAll"],
    ["SAX", 1, 34, 0, "PutAll"],
    ["SAY", 1, 66, 0, "PutAll"],
    ["SBC", 8431212, 224, 0, "PutAll"],
    ["SEC", 1, 56, 0, "PutAll"],
    ["SED", 1, 248, 0, "PutAll"],
    ["SEI", 1, 120, 0, "PutAll"],
    ["SET", 1, 244, 0, "PutAll"],
    ["SMB0", 4, 135, 1, "PutAll"],
    ["SMB1", 4, 151, 1, "PutAll"],
    ["SMB2", 4, 167, 1, "PutAll"],
    ["SMB3", 4, 183, 1, "PutAll"],
    ["SMB4", 4, 199, 1, "PutAll"],
    ["SMB5", 4, 215, 1, "PutAll"],
    ["SMB6", 4, 231, 1, "PutAll"],
    ["SMB7", 4, 247, 1, "PutAll"],
    ["ST0", 8388608, 3, 1, "PutAll"],
    ["ST1", 8388608, 19, 1, "PutAll"],
    ["ST2", 8388608, 35, 1, "PutAll"],
    ["STA", 42604, 128, 0, "PutAll"],
    ["STX", 268, 130, 1, "PutAll"],
    ["STY", 44, 128, 1, "PutAll"],
    ["STZ", 108, 4, 5, "PutAll"],
    ["SXY", 1, 2, 0, "PutAll"],
    ["TAI", 33554432, 243, 0, "PutBlockTransfer"],
    ["TAM", 8388608, 83, 1, "PutAll"],
    ["TAM0", 1, 1, 0, "PutTAMn"],
    ["TAM1", 1, 2, 0, "PutTAMn"],
    ["TAM2", 1, 4, 0, "PutTAMn"],
    ["TAM3", 1, 8, 0, "PutTAMn"],
    ["TAM4", 1, 16, 0, "PutTAMn"],
    ["TAM5", 1, 32, 0, "PutTAMn"],
    ["TAM6", 1, 64, 0, "PutTAMn"],
    ["TAM7", 1, 128, 0, "PutTAMn"],
    ["TAX", 1, 170, 0, "PutAll"],
    ["TAY", 1, 168, 0, "PutAll"],
    ["TDD", 33554432, 195, 0, "PutBlockTransfer"],
    ["TIA", 33554432, 227, 0, "PutBlockTransfer"],
    ["TII", 33554432, 115, 0, "PutBlockTransfer"],
    ["TIN", 33554432, 211, 0, "PutBlockTransfer"],
    ["TMA", 8388608, 67, 1, "PutTMA"],
    ["TMA0", 1, 1, 0, "PutTMAn"],
    ["TMA1", 1, 2, 0, "PutTMAn"],
    ["TMA2", 1, 4, 0, "PutTMAn"],
    ["TMA3", 1, 8, 0, "PutTMAn"],
    ["TMA4", 1, 16, 0, "PutTMAn"],
    ["TMA5", 1, 32, 0, "PutTMAn"],
    ["TMA6", 1, 64, 0, "PutTMAn"],
    ["TMA7", 1, 128, 0, "PutTMAn"],
    ["TRB", 12, 16, 1, "PutAll"],
    ["TSB", 12, 0, 1, "PutAll"],
    ["TST", 108, 131, 9, "PutTST"],
    ["TSX", 1, 186, 0, "PutAll"],
    ["TXA", 1, 138, 0, "PutAll"],
    ["TXS", 1, 154, 0, "PutAll"],
    ["TYA", 1, 152, 0, "PutAll"]
  ],
  M740: [
    ["ADC", 8430188, 96, 0, "PutAll"],
    ["AND", 8430188, 32, 0, "PutAll"],
    ["ASL", 110, 2, 1, "PutAll"],
    ["BBC0", 268435458, 19, 10, "PutBitBranch_m740"],
    ["BBC1", 268435458, 51, 10, "PutBitBranch_m740"],
    ["BBC2", 268435458, 83, 10, "PutBitBranch_m740"],
    ["BBC3", 268435458, 115, 10, "PutBitBranch_m740"],
    ["BBC4", 268435458, 147, 10, "PutBitBranch_m740"],
    ["BBC5", 268435458, 179, 10, "PutBitBranch_m740"],
    ["BBC6", 268435458, 211, 10, "PutBitBranch_m740"],
    ["BBC7", 268435458, 243, 10, "PutBitBranch_m740"],
    ["BBS0", 268435458, 3, 10, "PutBitBranch_m740"],
    ["BBS1", 268435458, 35, 10, "PutBitBranch_m740"],
    ["BBS2", 268435458, 67, 10, "PutBitBranch_m740"],
    ["BBS3", 268435458, 99, 10, "PutBitBranch_m740"],
    ["BBS4", 268435458, 131, 10, "PutBitBranch_m740"],
    ["BBS5", 268435458, 163, 10, "PutBitBranch_m740"],
    ["BBS6", 268435458, 195, 10, "PutBitBranch_m740"],
    ["BBS7", 268435458, 227, 10, "PutBitBranch_m740"],
    ["BCC", 131072, 144, 0, "PutPCRel8"],
    ["BCS", 131072, 176, 0, "PutPCRel8"],
    ["BEQ", 131072, 240, 0, "PutPCRel8"],
    ["BIT", 12, 0, 2, "PutAll"],
    ["BMI", 131072, 48, 0, "PutPCRel8"],
    ["BNE", 131072, 208, 0, "PutPCRel8"],
    ["BPL", 131072, 16, 0, "PutPCRel8"],
    ["BRA", 131072, 128, 0, "PutPCRel8"],
    ["BRK", 1, 0, 0, "PutAll"],
    ["BVC", 131072, 80, 0, "PutPCRel8"],
    ["BVS", 131072, 112, 0, "PutPCRel8"],
    ["CLB0", 6, 27, 10, "PutAll"],
    ["CLB1", 6, 59, 10, "PutAll"],
    ["CLB2", 6, 91, 10, "PutAll"],
    ["CLB3", 6, 123, 10, "PutAll"],
    ["CLB4", 6, 155, 10, "PutAll"],
    ["CLB5", 6, 187, 10, "PutAll"],
    ["CLB6", 6, 219, 10, "PutAll"],
    ["CLB7", 6, 251, 10, "PutAll"],
    ["CLC", 1, 24, 0, "PutAll"],
    ["CLD", 1, 216, 0, "PutAll"],
    ["CLI", 1, 88, 0, "PutAll"],
    ["CLT", 1, 18, 0, "PutAll"],
    ["CLV", 1, 184, 0, "PutAll"],
    ["CMP", 8430188, 192, 0, "PutAll"],
    ["COM", 4, 68, 1, "PutAll"],
    ["CPX", 8388620, 224, 1, "PutAll"],
    ["CPY", 8388620, 192, 1, "PutAll"],
    ["DEC", 111, 0, 3, "PutAll"],
    ["DEX", 1, 202, 0, "PutAll"],
    ["DEY", 1, 136, 0, "PutAll"],
    ["EOR", 8430188, 64, 0, "PutAll"],
    ["FST", 1, 226, 0, "PutAll"],
    ["INC", 111, 0, 4, "PutAll"],
    ["INX", 1, 232, 0, "PutAll"],
    ["INY", 1, 200, 0, "PutAll"],
    ["JMP", 3080, 0, 12, "PutAll"],
    ["JSR", 536871944, 0, 0, "PutJSR_m740"],
    ["LDA", 8430188, 160, 0, "PutAll"],
    ["LDM", 268435456, 60, 0, "PutLDM_m740"],
    ["LDX", 8389388, 162, 1, "PutAll"],
    ["LDY", 8388716, 160, 1, "PutAll"],
    ["LSR", 111, 66, 1, "PutAll"],
    ["NOP", 1, 234, 0, "PutAll"],
    ["ORA", 8430188, 0, 0, "PutAll"],
    ["PHA", 1, 72, 0, "PutAll"],
    ["PHP", 1, 8, 0, "PutAll"],
    ["PLA", 1, 104, 0, "PutAll"],
    ["PLP", 1, 40, 0, "PutAll"],
    ["RMB0", 6, 27, 10, "PutAll"],
    ["RMB1", 6, 59, 10, "PutAll"],
    ["RMB2", 6, 91, 10, "PutAll"],
    ["RMB3", 6, 123, 10, "PutAll"],
    ["RMB4", 6, 155, 10, "PutAll"],
    ["RMB5", 6, 187, 10, "PutAll"],
    ["RMB6", 6, 219, 10, "PutAll"],
    ["RMB7", 6, 251, 10, "PutAll"],
    ["ROL", 111, 34, 1, "PutAll"],
    ["ROR", 111, 98, 1, "PutAll"],
    ["RRF", 4, 130, 6, "PutAll"],
    ["RTI", 1, 64, 0, "PutAll"],
    ["RTS", 1, 96, 0, "PutAll"],
    ["SBC", 8430188, 224, 0, "PutAll"],
    ["SEB0", 6, 11, 10, "PutAll"],
    ["SEB1", 6, 43, 10, "PutAll"],
    ["SEB2", 6, 75, 10, "PutAll"],
    ["SEB3", 6, 107, 10, "PutAll"],
    ["SEB4", 6, 139, 10, "PutAll"],
    ["SEB5", 6, 171, 10, "PutAll"],
    ["SEB6", 6, 203, 10, "PutAll"],
    ["SEB7", 6, 235, 10, "PutAll"],
    ["SEC", 1, 56, 0, "PutAll"],
    ["SED", 1, 248, 0, "PutAll"],
    ["SEI", 1, 120, 0, "PutAll"],
    ["SET", 1, 50, 0, "PutAll"],
    ["SLW", 1, 194, 0, "PutAll"],
    ["STA", 41580, 128, 0, "PutAll"],
    ["STP", 1, 66, 0, "PutAll"],
    ["STX", 268, 130, 1, "PutAll"],
    ["STY", 44, 128, 1, "PutAll"],
    ["TAX", 1, 170, 0, "PutAll"],
    ["TAY", 1, 168, 0, "PutAll"],
    ["TST", 4, 100, 1, "PutAll"],
    ["TSX", 1, 186, 0, "PutAll"],
    ["TXA", 1, 138, 0, "PutAll"],
    ["TXS", 1, 154, 0, "PutAll"],
    ["TYA", 1, 152, 0, "PutAll"]
  ]
};

// packages/plugin-65xx/src/instructions/variants.ts
var commonModes = {
  0: { mode: "implied" },
  1: { mode: "accumulator" },
  2: { mode: "zeroPage" },
  3: { mode: "absolute" },
  5: { mode: "zeroPageIndexedX" },
  6: { mode: "absoluteIndexedX" },
  7: { mode: "absoluteLongIndexedX", codec: "unsigned24-le" },
  8: { mode: "zeroPageIndexedY" },
  9: { mode: "absoluteIndexedY" },
  11: { mode: "indirect" },
  12: { mode: "zeroPageIndirectLong" },
  13: { mode: "indirectIndexedY" },
  15: { mode: "indexedIndirectX" },
  16: { mode: "absoluteIndexedIndirect" },
  17: { mode: "relative" },
  18: { mode: "relative16" },
  20: { mode: "stackRelativeIndirectIndexedY" },
  21: { mode: "immediate" },
  22: { mode: "immediate" },
  23: { mode: "immediate" },
  27: { mode: "immediate", codec: "unsigned16-le" },
  30: { mode: "basePageIndirectIndexedZ" },
  31: { mode: "quadAccumulator" }
};
var featureByTable = {
  "6502DTV": "dtv",
  "65SC02": "cmos",
  "65C02": "rockwell",
  W65C02: "wdc",
  "65CE02": "ce02",
  "4510": "4510",
  "45GS02": "45gs02",
  HuC6280: "huc6280",
  M740: "m740"
};
function opcodeFor(row, modeIndex) {
  if (row[4] === "PutJSR_m740") {
    if (modeIndex === 10) {
      return 2;
    }
    if (modeIndex === 29) {
      return 34;
    }
    return 32;
  }
  if (row[4] === "PutBitBranch_m740") {
    return modeIndex === 28 ? row[2] + 4 : row[2];
  }
  if (row[4] === "PutLDM_m740") {
    return row[2];
  }
  const [, , base, eaTable] = row;
  const eaRow = eaTable >= 0 && eaTable < ca65EaTable.length ? ca65EaTable[eaTable] : void 0;
  const extension = eaRow !== void 0 && modeIndex >= 0 && modeIndex < eaRow.length ? eaRow[modeIndex] : void 0;
  if (extension === void 0) {
    throw new Error(`Missing ca65 EA table ${eaTable}/${modeIndex}.`);
  }
  let opcode = base | extension;
  if (row[4] === "Put4510" || row[4] === "Put45GS02") {
    opcode = (/* @__PURE__ */ new Map([
      [71, 68],
      [87, 84],
      [147, 130],
      [156, 139],
      [158, 155],
      [175, 171],
      [191, 187],
      [179, 226],
      [208, 194],
      [252, 35]
    ])).get(opcode) ?? opcode;
  }
  if (row[4] === "Put45GS02_Q") {
    if (opcode === 234) {
      opcode = 26;
    } else if (opcode === 202) {
      opcode = 58;
    }
  }
  return opcode;
}
function modeFor(table, row, modeIndex) {
  if (row[4] === "PutBlockTransfer" && modeIndex === 25) {
    return { mode: "blockTransfer", codec: "three-unsigned16-le" };
  }
  if (row[4] === "PutTST") {
    if (modeIndex === 2) {
      return { mode: "immediateZeroPage", codec: "immediate-unsigned8" };
    }
    if (modeIndex === 3) {
      return { mode: "immediateAbsolute", codec: "immediate-unsigned16" };
    }
    if (modeIndex === 5) {
      return { mode: "immediateZeroPageIndexedX", codec: "immediate-unsigned8" };
    }
    if (modeIndex === 6) {
      return { mode: "immediateAbsoluteIndexedX", codec: "immediate-unsigned16" };
    }
  }
  if (row[4] === "PutBitBranch_m740") {
    if (modeIndex === 1) {
      return { mode: "accumulatorRelative", codec: "accumulator-relative8" };
    }
    if (modeIndex === 28) {
      return { mode: "zeroPageRelative", codec: "zero-page-relative8" };
    }
  }
  if (row[4] === "PutLDM_m740" && modeIndex === 28) {
    return { mode: "zeroPageImmediate", codec: "zero-page-immediate8" };
  }
  if (row[4] === "PutJSR_m740" && modeIndex === 29) {
    return { mode: "specialPage", codec: "special-page" };
  }
  if (modeIndex === 10) {
    return table === "65CE02" || table === "4510" || table === "45GS02" ? { mode: "zeroPageIndirectIndexedZ" } : { mode: "zeroPageIndirect" };
  }
  return commonModes[modeIndex];
}
function createForm(table, row, modeIndex, modeDefinition) {
  let opcode = opcodeFor(row, modeIndex);
  const codec = modeDefinition.codec ?? getOperandCodec(modeDefinition.mode);
  const prefixes = [];
  if (row[4] === "PutTAMn") {
    prefixes.push(83);
    opcode = row[2];
  } else if (row[4] === "PutTMAn") {
    prefixes.push(67);
    opcode = row[2];
  } else if (row[4] === "Put45GS02_Q") {
    prefixes.push(66, 66);
    if (modeIndex === 12 || modeIndex === 30) {
      prefixes.push(234);
    }
  } else if (row[4] === "Put45GS02" && modeIndex === 30) {
    prefixes.push(234);
  }
  let relativeBaseOffset;
  if (row[4] === "PutPCRel4510") {
    relativeBaseOffset = 2;
  } else if (row[4] === "PutBitBranch_m740") {
    relativeBaseOffset = 3;
  }
  return Object.freeze({
    opcode,
    mnemonic: row[0],
    mode: modeDefinition.mode,
    encoding: [...prefixes, opcode],
    operands: getOperandFields(codec),
    codec,
    availableWhen: { allOf: [featureByTable[table]] },
    canonical: true,
    documented: true,
    stability: "documented",
    relativeBaseOffset,
    operandConstraint: row[4] === "PutTMA" ? "power-of-two" : void 0
  });
}
function decodeTable(table) {
  const forms = [];
  for (const row of ca65VariantTables[table]) {
    if (row[4] === "PutBitBranch") {
      forms.push(
        Object.freeze({
          opcode: row[2],
          mnemonic: row[0],
          mode: "zeroPageRelative",
          encoding: [row[2]],
          operands: getOperandFields("zero-page-relative8"),
          codec: "zero-page-relative8",
          availableWhen: { allOf: [featureByTable[table]] },
          canonical: true,
          documented: true,
          stability: "documented",
          relativeBaseOffset: 3
        })
      );
      continue;
    }
    if (row[4] === "PutPCRel8" || row[4] === "PutPCRel4510") {
      const modeIndex = row[4] === "PutPCRel8" ? 17 : 18;
      const modeDefinition = commonModes[modeIndex];
      if (modeDefinition) {
        forms.push(createForm(table, row, modeIndex, modeDefinition));
      }
      continue;
    }
    const seenModes = /* @__PURE__ */ new Set();
    for (let modeIndex = 0; modeIndex < 32; modeIndex++) {
      if ((row[1] & 2 ** modeIndex) === 0) {
        continue;
      }
      if (modeIndex === 0 && (row[1] & 2) !== 0) {
        continue;
      }
      const modeDefinition = modeFor(table, row, modeIndex);
      if (!modeDefinition) {
        throw new Error(`Unsupported ca65 mode bit ${modeIndex} for ${table} ${row[0]}.`);
      }
      const key = `${modeDefinition.mode}:${modeDefinition.codec ?? ""}`;
      if (seenModes.has(key)) {
        continue;
      }
      seenModes.add(key);
      forms.push(createForm(table, row, modeIndex, modeDefinition));
    }
  }
  return Object.freeze(forms);
}
var mos6502DtvForms = decodeTable("6502DTV");
var cmos65sc02Forms = decodeTable("65SC02");
var cmos65c02Forms = decodeTable("65C02");
var wdc65c02Forms = decodeTable("W65C02");
var csg65ce02Forms = decodeTable("65CE02");
var commodore4510Forms = decodeTable("4510");
var mega65Gs02Forms = decodeTable("45GS02");
var hudsonHuC6280Forms = decodeTable("HuC6280");
var mitsubishiM740Forms = decodeTable("M740");
var mos6502DtvCpu = Object.freeze({
  id: "65xx.6502dtv",
  displayName: "C64DTV 6502",
  aliases: ["6502dtv", "dtv"],
  features: /* @__PURE__ */ new Set(["nmos", "undocumented", "dtv"])
});
var cmos65sc02Cpu = Object.freeze({
  id: "65xx.65sc02",
  displayName: "65SC02",
  aliases: ["65sc02"],
  features: /* @__PURE__ */ new Set(["cmos"])
});
var cmos65c02Cpu = Object.freeze({
  id: "65xx.65c02",
  displayName: "65C02 with Rockwell extensions",
  aliases: ["65c02"],
  features: /* @__PURE__ */ new Set(["cmos", "rockwell"])
});
var wdc65c02Cpu = Object.freeze({
  id: "65xx.w65c02",
  displayName: "WDC W65C02",
  aliases: ["w65c02"],
  features: /* @__PURE__ */ new Set(["cmos", "rockwell", "wdc"])
});
var csg65ce02Cpu = Object.freeze({
  id: "65xx.65ce02",
  displayName: "CSG 65CE02",
  aliases: ["65ce02"],
  features: /* @__PURE__ */ new Set(["cmos", "rockwell", "ce02"])
});
var commodore4510Cpu = Object.freeze({
  id: "65xx.4510",
  displayName: "Commodore 4510",
  aliases: ["4510"],
  features: /* @__PURE__ */ new Set(["cmos", "rockwell", "ce02", "4510"])
});
var mega65Gs02Cpu = Object.freeze({
  id: "65xx.45gs02",
  displayName: "MEGA65 45GS02",
  aliases: ["45gs02"],
  features: /* @__PURE__ */ new Set(["cmos", "rockwell", "ce02", "4510", "45gs02"])
});
var hudsonHuC6280Cpu = Object.freeze({
  id: "65xx.huc6280",
  displayName: "Hudson HuC6280",
  aliases: ["huc6280", "6280"],
  features: /* @__PURE__ */ new Set(["cmos", "rockwell", "huc6280"])
});
var mitsubishiM740Cpu = Object.freeze({
  id: "65xx.m740",
  displayName: "Mitsubishi M740",
  aliases: ["m740", "740"],
  features: /* @__PURE__ */ new Set(["m740"])
});
var variantCpus = Object.freeze([
  mos6502DtvCpu,
  cmos65sc02Cpu,
  cmos65c02Cpu,
  wdc65c02Cpu,
  csg65ce02Cpu,
  commodore4510Cpu,
  mega65Gs02Cpu,
  hudsonHuC6280Cpu,
  mitsubishiM740Cpu
]);
var variantFormsByCpuId = Object.freeze({
  [mos6502DtvCpu.id]: mos6502DtvForms,
  [cmos65sc02Cpu.id]: cmos65sc02Forms,
  [cmos65c02Cpu.id]: cmos65c02Forms,
  [wdc65c02Cpu.id]: wdc65c02Forms,
  [csg65ce02Cpu.id]: csg65ce02Forms,
  [commodore4510Cpu.id]: commodore4510Forms,
  [mega65Gs02Cpu.id]: mega65Gs02Forms,
  [hudsonHuC6280Cpu.id]: hudsonHuC6280Forms,
  [mitsubishiM740Cpu.id]: mitsubishiM740Forms
});

// packages/plugin-65xx/src/instructions/opcodes.ts
var rows = [
  "BRK:imp ORA:inx JAM:imp SLO:inx NOP:zp ORA:zp ASL:zp SLO:zp PHP:imp ORA:imm ASL:acc ANC:imm NOP:abs ORA:abs ASL:abs SLO:abs",
  "BPL:rel ORA:iny JAM:imp SLO:iny NOP:zpx ORA:zpx ASL:zpx SLO:zpx CLC:imp ORA:aby NOP:imp SLO:aby NOP:abx ORA:abx ASL:abx SLO:abx",
  "JSR:abs AND:inx JAM:imp RLA:inx BIT:zp AND:zp ROL:zp RLA:zp PLP:imp AND:imm ROL:acc ANC:imm BIT:abs AND:abs ROL:abs RLA:abs",
  "BMI:rel AND:iny JAM:imp RLA:iny NOP:zpx AND:zpx ROL:zpx RLA:zpx SEC:imp AND:aby NOP:imp RLA:aby NOP:abx AND:abx ROL:abx RLA:abx",
  "RTI:imp EOR:inx JAM:imp SRE:inx NOP:zp EOR:zp LSR:zp SRE:zp PHA:imp EOR:imm LSR:acc ALR:imm JMP:abs EOR:abs LSR:abs SRE:abs",
  "BVC:rel EOR:iny JAM:imp SRE:iny NOP:zpx EOR:zpx LSR:zpx SRE:zpx CLI:imp EOR:aby NOP:imp SRE:aby NOP:abx EOR:abx LSR:abx SRE:abx",
  "RTS:imp ADC:inx JAM:imp RRA:inx NOP:zp ADC:zp ROR:zp RRA:zp PLA:imp ADC:imm ROR:acc ARR:imm JMP:ind ADC:abs ROR:abs RRA:abs",
  "BVS:rel ADC:iny JAM:imp RRA:iny NOP:zpx ADC:zpx ROR:zpx RRA:zpx SEI:imp ADC:aby NOP:imp RRA:aby NOP:abx ADC:abx ROR:abx RRA:abx",
  "NOP:imm STA:inx NOP:imm SAX:inx STY:zp STA:zp STX:zp SAX:zp DEY:imp NOP:imm TXA:imp ANE:imm STY:abs STA:abs STX:abs SAX:abs",
  "BCC:rel STA:iny JAM:imp SHA:iny STY:zpx STA:zpx STX:zpy SAX:zpy TYA:imp STA:aby TXS:imp TAS:aby SHY:abx STA:abx SHX:aby SHA:aby",
  "LDY:imm LDA:inx LDX:imm LAX:inx LDY:zp LDA:zp LDX:zp LAX:zp TAY:imp LDA:imm TAX:imp LAX:imm LDY:abs LDA:abs LDX:abs LAX:abs",
  "BCS:rel LDA:iny JAM:imp LAX:iny LDY:zpx LDA:zpx LDX:zpy LAX:zpy CLV:imp LDA:aby TSX:imp LAS:aby LDY:abx LDA:abx LDX:aby LAX:aby",
  "CPY:imm CMP:inx NOP:imm DCP:inx CPY:zp CMP:zp DEC:zp DCP:zp INY:imp CMP:imm DEX:imp AXS:imm CPY:abs CMP:abs DEC:abs DCP:abs",
  "BNE:rel CMP:iny JAM:imp DCP:iny NOP:zpx CMP:zpx DEC:zpx DCP:zpx CLD:imp CMP:aby NOP:imp DCP:aby NOP:abx CMP:abx DEC:abx DCP:abx",
  "CPX:imm SBC:inx NOP:imm ISC:inx CPX:zp SBC:zp INC:zp ISC:zp INX:imp SBC:imm NOP:imp SBC:imm CPX:abs SBC:abs INC:abs ISC:abs",
  "BEQ:rel SBC:iny JAM:imp ISC:iny NOP:zpx SBC:zpx INC:zpx ISC:zpx SED:imp SBC:aby NOP:imp ISC:aby NOP:abx SBC:abx INC:abx ISC:abx"
];
var modeNames = {
  imp: "implied",
  acc: "accumulator",
  imm: "immediate",
  zp: "zeroPage",
  zpx: "zeroPageIndexedX",
  zpy: "zeroPageIndexedY",
  abs: "absolute",
  abx: "absoluteIndexedX",
  aby: "absoluteIndexedY",
  ind: "indirect",
  inx: "indexedIndirectX",
  iny: "indirectIndexedY",
  rel: "relative"
};
var legalOpcodes = /* @__PURE__ */ new Set([
  0,
  1,
  5,
  6,
  8,
  9,
  10,
  13,
  14,
  16,
  17,
  21,
  22,
  24,
  25,
  29,
  30,
  32,
  33,
  36,
  37,
  38,
  40,
  41,
  42,
  44,
  45,
  46,
  48,
  49,
  53,
  54,
  56,
  57,
  61,
  62,
  64,
  65,
  69,
  70,
  72,
  73,
  74,
  76,
  77,
  78,
  80,
  81,
  85,
  86,
  88,
  89,
  93,
  94,
  96,
  97,
  101,
  102,
  104,
  105,
  106,
  108,
  109,
  110,
  112,
  113,
  117,
  118,
  120,
  121,
  125,
  126,
  129,
  132,
  133,
  134,
  136,
  138,
  140,
  141,
  142,
  144,
  145,
  148,
  149,
  150,
  152,
  153,
  154,
  157,
  160,
  161,
  162,
  164,
  165,
  166,
  168,
  169,
  170,
  172,
  173,
  174,
  176,
  177,
  180,
  181,
  182,
  184,
  185,
  186,
  188,
  189,
  190,
  192,
  193,
  196,
  197,
  198,
  200,
  201,
  202,
  204,
  205,
  206,
  208,
  209,
  213,
  214,
  216,
  217,
  221,
  222,
  224,
  225,
  228,
  229,
  230,
  232,
  233,
  234,
  236,
  237,
  238,
  240,
  241,
  245,
  246,
  248,
  249,
  253,
  254
]);
var aliases = {
  ALR: ["ASR"],
  ANC: ["AAC"],
  ANE: ["XAA"],
  AXS: ["SBX"],
  DCP: ["DCM"],
  ISC: ["ISB", "INS"],
  JAM: ["KIL", "HLT"],
  LAS: ["LAR"],
  SAX: ["AAX"],
  SHA: ["AHX"],
  SHX: ["SXA"],
  SHY: ["SYA"],
  SRE: ["LSE"],
  TAS: ["SHS"]
};
var unstable = /* @__PURE__ */ new Set([
  "ANE:immediate",
  "LAX:immediate",
  "SHA:indirectIndexedY",
  "SHA:absoluteIndexedY",
  "SHX:absoluteIndexedY",
  "SHY:absoluteIndexedX",
  "TAS:absoluteIndexedY"
]);
var decoded = rows.flatMap((row) => row.split(" "));
if (decoded.length !== 256) {
  throw new Error(`Expected 256 NMOS opcode entries, got ${decoded.length}.`);
}
var mutableForms = decoded.map((entry, opcode) => {
  const [mnemonic, shortMode] = entry.split(":");
  const mode2 = modeNames[shortMode];
  if (!mnemonic || !mode2) {
    throw new Error(`Invalid opcode table entry '${entry}' at $${opcode.toString(16)}.`);
  }
  const documented = legalOpcodes.has(opcode);
  const codec = getOperandCodec(mode2);
  const key = `${mnemonic}:${mode2}`;
  let stability = "stable-undocumented";
  if (documented) {
    stability = "documented";
  } else if (unstable.has(key)) {
    stability = "unstable-undocumented";
  }
  let note;
  if (unstable.has(key)) {
    note = "Opcode semantics are unstable or chip-dependent. Assembly emits the canonical ca65-compatible byte.";
  } else if (opcode === 108) {
    note = "NMOS hardware wraps the high-byte fetch within the same page when the indirect pointer ends in $FF.";
  }
  return {
    opcode,
    mnemonic,
    aliases: aliases[mnemonic],
    mode: mode2,
    encoding: [opcode],
    operands: getOperandFields(codec),
    codec,
    availableWhen: { allOf: documented ? ["nmos"] : ["nmos", "undocumented"] },
    canonical: false,
    documented,
    stability,
    note
  };
});
var groups = /* @__PURE__ */ new Map();
for (const form of mutableForms) {
  const key = `${form.mnemonic}:${form.mode}`;
  const group = groups.get(key) ?? [];
  group.push(form);
  groups.set(key, group);
}
for (const group of groups.values()) {
  const documented = group.find((form) => form.documented);
  const fallback = group.length > 0 ? group[0] : void 0;
  const preferred = documented ?? fallback;
  if (preferred) {
    preferred.canonical = true;
  }
}
var nmos6502DecodeTable = Object.freeze(
  mutableForms.map((form) => Object.freeze({ ...form }))
);
var brkSignatureForms = Object.freeze(
  ["immediate", "zeroPage", "absolute"].map((mode2) => ({
    opcode: 0,
    mnemonic: "BRK",
    mode: mode2,
    encoding: [0],
    operands: [{ name: "signature", width: 1 }],
    codec: "unsigned8",
    availableWhen: { allOf: ["nmos"] },
    canonical: true,
    documented: true,
    stability: "documented",
    note: "Current ca65-guide BRK signature extension. Pinned ca65 V2.19 rejects this form."
  }))
);
var nmos6502Forms = Object.freeze([
  ...nmos6502DecodeTable.filter((form) => form.documented && form.canonical),
  ...brkSignatureForms
]);
var nmos6502xForms = Object.freeze([
  ...nmos6502DecodeTable.filter((form) => form.canonical),
  ...brkSignatureForms
]);
var nmos6502Cpu = Object.freeze({
  id: "65xx.6502",
  displayName: "NMOS 6502",
  aliases: ["6502", "6510", "8502", "6507"],
  features: /* @__PURE__ */ new Set(["nmos"])
});
var nmos6502xCpu = Object.freeze({
  id: "65xx.6502x",
  displayName: "NMOS 6502 with undocumented opcodes",
  aliases: ["6502x"],
  features: /* @__PURE__ */ new Set(["nmos", "undocumented"])
});
var ricoh2a03Cpu = Object.freeze({
  id: "65xx.2a03",
  displayName: "Ricoh 2A03 / 2A07",
  aliases: ["2a03", "2a07"],
  features: /* @__PURE__ */ new Set(["nmos", "undocumented"])
});
function cpuVariantForms(cpuId) {
  return Object.hasOwn(variantFormsByCpuId, cpuId) ? variantFormsByCpuId[cpuId] : void 0;
}
function getOpcodeForm(opcode) {
  if (!Number.isInteger(opcode) || opcode < 0 || opcode > 255) {
    throw new RangeError(`Opcode ${opcode} is outside the byte range.`);
  }
  return nmos6502DecodeTable[opcode];
}
function getCpuDecodeTable(cpu) {
  const variantForms = cpuVariantForms(cpu.id);
  if (variantForms) {
    return variantForms;
  }
  return nmos6502DecodeTable.filter((form) => matchesFeatures(form.availableWhen, cpu.features));
}
function getCpuAssemblyForms(cpu) {
  const variantForms = cpuVariantForms(cpu.id);
  if (variantForms) {
    return variantForms;
  }
  return cpu.features.has("undocumented") ? nmos6502xForms : nmos6502Forms;
}

// packages/plugin-65xx/src/architecture.ts
var directToAbsolute = {
  zeroPage: "absolute",
  zeroPageIndexedX: "absoluteIndexedX",
  zeroPageIndexedY: "absoluteIndexedY",
  zeroPageIndirect: "indirect",
  indexedIndirectX: "absoluteIndexedIndirect"
};
var absoluteToDirect = {
  absolute: "zeroPage",
  absoluteIndexedX: "zeroPageIndexedX",
  absoluteIndexedY: "zeroPageIndexedY",
  indirect: "zeroPageIndirect",
  absoluteIndexedIndirect: "indexedIndirectX"
};
var addressingModes = {
  implied: true,
  accumulator: true,
  immediate: true,
  zeroPage: true,
  zeroPageIndexedX: true,
  zeroPageIndexedY: true,
  absolute: true,
  absoluteIndexedX: true,
  absoluteIndexedY: true,
  absoluteLongIndexedX: true,
  indirect: true,
  zeroPageIndirect: true,
  zeroPageIndirectLong: true,
  indexedIndirectX: true,
  indirectIndexedY: true,
  absoluteIndexedIndirect: true,
  zeroPageIndirectIndexedZ: true,
  stackRelative: true,
  stackRelativeIndirectIndexedY: true,
  relative: true,
  relative16: true,
  zeroPageRelative: true,
  accumulatorRelative: true,
  zeroPageImmediate: true,
  specialPage: true,
  blockTransfer: true,
  immediateZeroPage: true,
  immediateZeroPageIndexedX: true,
  immediateAbsolute: true,
  immediateAbsoluteIndexedX: true,
  basePageIndirectIndexedZ: true,
  quadAccumulator: true
};
function isAddressingMode(value) {
  for (const mode2 of Object.keys(addressingModes)) {
    if (value === mode2) {
      return true;
    }
  }
  return false;
}
function mappedAddressingMode(table, mode2) {
  if (mode2 === void 0 || !isAddressingMode(mode2)) {
    return void 0;
  }
  return table[mode2];
}
var aliasToMnemonic = /* @__PURE__ */ new Map();
for (const form of nmos6502DecodeTable) {
  for (const alias of form.aliases ?? []) {
    aliasToMnemonic.set(alias, form.mnemonic);
  }
}
function parseMnemonic(value) {
  const match = value.trim().toUpperCase().match(/^([A-Z][\dA-Z]{2,4})(?:\.([BW]))?$/);
  if (!match) {
    return { mnemonic: value.trim().toUpperCase() };
  }
  let forcedWidth;
  if (match[2] === "B") {
    forcedWidth = 1;
  } else if (match[2] === "W") {
    forcedWidth = 2;
  }
  return {
    mnemonic: match[1],
    forcedWidth
  };
}
function modeSize(form) {
  return form.encoding.length + form.operands.reduce((size, operand) => size + operand.width, 0);
}
function splitTopLevelOperands(value) {
  const operands = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < value.length; index++) {
    const character = value[index];
    if (character === "(" || character === "[") {
      depth++;
    } else if (character === ")" || character === "]") {
      depth--;
    } else if (character === "," && depth === 0) {
      operands.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }
  operands.push(value.slice(start).trim());
  return operands.filter(Boolean);
}
var Arch65xx = class {
  /**
   * @param {ArchitectureEncoderContext} context Encoder host (operands, emission, diagnostics).
   * @param {CpuDefinition} cpu CPU whose feature set filters {@link getCpuAssemblyForms}.
   */
  constructor(context, cpu) {
    this.context = context;
    this.cpu = cpu;
    this.forms = getCpuAssemblyForms(cpu).filter(
      (form) => matchesFeatures(form.availableWhen, cpu.features)
    );
    this.catalog = buildInstructionCatalog(this.forms);
    const grouped = /* @__PURE__ */ new Map();
    for (const form of this.forms) {
      const entries2 = grouped.get(form.mnemonic) ?? [];
      entries2.push(form);
      grouped.set(form.mnemonic, entries2);
    }
    for (const [mnemonic, entries2] of grouped) {
      this.formsByMnemonic.set(mnemonic, entries2);
    }
  }
  context;
  cpu;
  forms;
  catalog;
  formsByMnemonic = /* @__PURE__ */ new Map();
  getInstructionCatalog() {
    return this.catalog;
  }
  /**
   * Estimates size from tokenized words.
   * @param {readonly string[]} words Mnemonic plus rest-of-line operand.
   * @returns {number} Encoded size in bytes, or 0 if unknown.
   */
  estimateSize(words) {
    if (words.length === 0) {
      return 0;
    }
    const operand = words.slice(1).join(" ");
    return this.estimateResolved(words[0] ?? "", this.context.operands.lowerOperand(operand));
  }
  /**
   * Encodes tokenized words. Returns false when the mnemonic is unknown on this CPU.
   * @param {readonly string[]} words Mnemonic plus rest-of-line operand.
   * @returns {boolean} True if encoded.
   */
  encode(words) {
    if (words.length === 0) {
      return true;
    }
    const operand = words.slice(1).join(" ");
    return this.encodeResolved(words[0] ?? "", this.context.operands.lowerOperand(operand));
  }
  /**
   * Estimates the size of a resolved instruction.
   * @param {LoweredInstruction} instruction The instruction.
   * @returns {number} The estimated size in bytes.
   */
  estimateInstruction(instruction) {
    return this.estimateResolved(instruction.mnemonic, instruction.loweredOperand);
  }
  /**
   * Encodes a resolved instruction.
   * @param {LoweredInstruction} instruction The instruction.
   * @returns {boolean} True if encoded.
   */
  encodeInstruction(instruction) {
    return this.encodeResolved(instruction.mnemonic, instruction.loweredOperand);
  }
  /**
   * Estimates the size of a resolved instruction.
   * @param {string} rawMnemonic The raw mnemonic.
   * @param {LoweredOperand} operand The operand.
   * @returns {number} The estimated size in bytes.
   */
  estimateResolved(rawMnemonic, operand) {
    const resolved = this.resolveForm(rawMnemonic, operand);
    return resolved ? modeSize(resolved) : 0;
  }
  /**
   * Encodes a resolved instruction.
   * @param {string} rawMnemonic The raw mnemonic.
   * @param {LoweredOperand} operand The operand.
   * @returns {boolean} True if encoded.
   */
  encodeResolved(rawMnemonic, operand) {
    const resolved = this.resolveForm(rawMnemonic, operand);
    if (!resolved) {
      return false;
    }
    const form = resolved;
    const relativeBaseOffset = form.relativeBaseOffset ?? modeSize(form);
    let branchDelta = 0;
    if (form.codec === "relative8" || form.codec === "relative16") {
      const branchWidth = form.codec === "relative8" ? 1 : 2;
      branchDelta = this.readBranchDelta(operand, relativeBaseOffset, branchWidth);
    }
    const compoundOperands = form.codec === "zero-page-relative8" || form.codec === "accumulator-relative8" || form.codec === "zero-page-immediate8" || form.codec === "three-unsigned16-le" || form.codec === "immediate-unsigned8" || form.codec === "immediate-unsigned16" ? splitTopLevelOperands(operand.expanded) : [];
    const compoundValues = this.readCompoundValues(form, compoundOperands);
    let operandWidth = 0;
    if (form.codec === "unsigned8") {
      operandWidth = 1;
    } else if (form.codec === "unsigned16-le") {
      operandWidth = 2;
    } else if (form.codec === "unsigned24-le") {
      operandWidth = 3;
    }
    const operandKind = operandWidth === 1 ? "operand" : "address";
    let operandValue = 0;
    if (operandWidth !== 0) {
      operandValue = this.readExpressionValue(
        operand.baseExpression ?? operand.expanded,
        operandWidth,
        `${form.mnemonic} ${operandKind}`,
        operand.mode === "immediate"
      );
      if (form.operandConstraint === "power-of-two" && (operandValue === 0 || (operandValue & operandValue - 1) !== 0)) {
        throw this.context.diagnostics.error(`${form.mnemonic} operand must be a power of two.`);
      }
    }
    const specialPageValue = form.codec === "special-page" ? this.readExpressionValue(
      operand.baseExpression ?? operand.expanded,
      2,
      `${form.mnemonic} special-page address`,
      false
    ) : 0;
    if (form.codec === "special-page" && (specialPageValue & 65280) !== 65280) {
      throw this.context.diagnostics.error(
        `${form.mnemonic} special-page address must be in $FF00-$FFFF.`
      );
    }
    this.context.emission.writeBytes(form.encoding);
    switch (form.codec) {
      case "none":
        return true;
      case "unsigned8":
        this.context.emission.writeByte(operandValue);
        return true;
      case "unsigned16-le":
        this.context.emission.writeValue(operandValue, 2, "little");
        return true;
      case "unsigned24-le":
        this.context.emission.writeValue(operandValue, 3, "little");
        return true;
      case "relative8":
        this.context.emission.writeByte(branchDelta & 255);
        return true;
      case "relative16":
        this.context.emission.writeValue(branchDelta & 65535, 2, "little");
        return true;
      case "zero-page-relative8": {
        this.context.emission.writeByte(compoundValues[0] ?? 0);
        this.context.emission.writeByte((compoundValues[1] ?? 0) & 255);
        return true;
      }
      case "accumulator-relative8":
        this.context.emission.writeByte((compoundValues[0] ?? 0) & 255);
        return true;
      case "zero-page-immediate8":
        this.context.emission.writeByte(compoundValues[0] ?? 0);
        this.context.emission.writeByte(compoundValues[1] ?? 0);
        return true;
      case "special-page":
        this.context.emission.writeByte(specialPageValue & 255);
        return true;
      case "three-unsigned16-le":
        for (const value of compoundValues) {
          this.context.emission.writeValue(value, 2, "little");
        }
        return true;
      case "immediate-unsigned8":
        this.context.emission.writeByte(compoundValues[0] ?? 0);
        this.context.emission.writeByte(compoundValues[1] ?? 0);
        return true;
      case "immediate-unsigned16":
        this.context.emission.writeByte(compoundValues[0] ?? 0);
        this.context.emission.writeValue(compoundValues[1] ?? 0, 2, "little");
        return true;
    }
    return false;
  }
  /**
   * Reads compound values from operands.
   * @param {InstructionForm} form The instruction form.
   * @param {readonly string[]} operands The operands.
   * @returns {readonly number[]} The compound values.
   */
  readCompoundValues(form, operands) {
    const expect = (count, description) => {
      if (operands.length !== count) {
        throw this.context.diagnostics.error(`${form.mnemonic} expects ${description}.`);
      }
    };
    switch (form.codec) {
      case "zero-page-relative8":
        expect(2, "a zero-page address and branch target");
        return [
          this.readExpressionValue(operands[0] ?? "", 1, `${form.mnemonic} address`, false),
          this.readBranchExpression(
            operands[1] ?? "",
            form.relativeBaseOffset ?? modeSize(form),
            1
          )
        ];
      case "accumulator-relative8":
        expect(2, "A and a branch target");
        if (operands[0]?.trim().toUpperCase() !== "A") {
          throw this.context.diagnostics.error(`${form.mnemonic} accumulator branch must use A.`);
        }
        return [
          this.readBranchExpression(
            operands[1] ?? "",
            form.relativeBaseOffset ?? modeSize(form),
            1
          )
        ];
      case "zero-page-immediate8":
        expect(2, "a zero-page address and immediate value");
        if (!operands[1]?.trim().startsWith("#")) {
          throw this.context.diagnostics.error(
            `${form.mnemonic} second operand must be immediate.`
          );
        }
        return [
          this.readExpressionValue(operands[0] ?? "", 1, `${form.mnemonic} address`, false),
          this.readExpressionValue(
            operands[1]?.trim().slice(1) ?? "",
            1,
            `${form.mnemonic} immediate`,
            true
          )
        ];
      case "three-unsigned16-le":
        expect(3, "source, destination, and length operands");
        return operands.map(
          (expression, index) => this.readExpressionValue(
            expression,
            2,
            `${form.mnemonic} ${["source", "destination", "length"][index]}`,
            false
          )
        );
      case "immediate-unsigned8":
      case "immediate-unsigned16": {
        const indexed = form.mode.endsWith("IndexedX");
        expect(indexed ? 3 : 2, "an immediate value and address");
        if (!operands[0]?.trim().startsWith("#")) {
          throw this.context.diagnostics.error(`${form.mnemonic} first operand must be immediate.`);
        }
        if (indexed && operands[2]?.trim().toUpperCase() !== "X") {
          throw this.context.diagnostics.error(`${form.mnemonic} indexed test operand must use X.`);
        }
        return [
          this.readExpressionValue(
            operands[0]?.trim().slice(1) ?? "",
            1,
            `${form.mnemonic} immediate`,
            true
          ),
          this.readExpressionValue(
            operands[1] ?? "",
            form.codec === "immediate-unsigned8" ? 1 : 2,
            `${form.mnemonic} address`,
            false
          )
        ];
      }
      case "none":
      case "relative16":
      case "relative8":
      case "special-page":
      case "unsigned16-le":
      case "unsigned24-le":
      case "unsigned8":
      default:
        return [];
    }
  }
  /**
   * Resolves a form for a mnemonic and operand.
   * @param {string} rawMnemonic The raw mnemonic.
   * @param {LoweredOperand} operand The operand.
   * @returns {InstructionForm | undefined} The resolved form.
   */
  resolveForm(rawMnemonic, operand) {
    const parsed = parseMnemonic(rawMnemonic);
    let mnemonic = parsed.mnemonic;
    let forms = this.formsByMnemonic.get(mnemonic);
    const variantArchitectures = Object.entries(variantFormsByCpuId).filter(([, entries2]) => entries2.some((entry) => entry.mnemonic === parsed.mnemonic)).map(([cpuId]) => cpuId);
    if (!forms) {
      const canonical = aliasToMnemonic.get(mnemonic);
      const aliasedForms = canonical ? this.formsByMnemonic.get(canonical) : void 0;
      if (canonical && aliasedForms) {
        mnemonic = canonical;
        forms = aliasedForms;
      }
    }
    const { forcedWidth } = parsed;
    if (!forms) {
      if (variantArchitectures.length > 0) {
        throw this.context.diagnostics.error(
          `Instruction '${parsed.mnemonic}' is available on ${variantArchitectures.join(", ")}, not ${this.cpu.id}.`
        );
      }
      const knownOnlyOn6502x = nmos6502DecodeTable.some(
        (form2) => form2.mnemonic === mnemonic || form2.aliases?.includes(mnemonic)
      );
      if (knownOnlyOn6502x) {
        throw this.context.diagnostics.error(
          `Instruction '${mnemonic}' or this operand form requires architecture '65xx.6502x'.`
        );
      }
      return void 0;
    }
    const hasOperand = operand.raw.trim() !== "";
    if (mnemonic === "BRK" && forcedWidth === 2) {
      throw this.context.diagnostics.error("BRK accepts at most an 8-bit signature byte.");
    }
    let mode2 = operand.mode;
    if (operand.raw.trim().toUpperCase() === "A") {
      mode2 = "accumulator";
    }
    if (operand.raw.trim().toUpperCase() === "Q") {
      mode2 = "quadAccumulator";
    }
    if (this.cpu.id === "65xx.m740" && mnemonic === "JSR" && mode2 === "absolute" && /^(?:\$ff[\da-f]{2}|0xff[\da-f]{2})$/i.test(operand.expanded.trim())) {
      mode2 = "specialPage";
    }
    if (hasOperand && forms.some((entry) => entry.mode === "relative16")) {
      mode2 = "relative16";
    } else if (hasOperand && forms.some((entry) => entry.mode === "relative")) {
      mode2 = "relative";
    }
    if (!hasOperand && !forms.some((entry) => entry.mode === "implied")) {
      if (forms.some((entry) => entry.mode === "accumulator")) {
        mode2 = "accumulator";
      } else if (forms.some((entry) => entry.mode === "quadAccumulator")) {
        mode2 = "quadAccumulator";
      }
    }
    if (forcedWidth) {
      const byteMode = mappedAddressingMode(absoluteToDirect, mode2);
      const wordMode = mappedAddressingMode(directToAbsolute, mode2);
      const alreadyRequestedWidth = forcedWidth === 1 && mode2 !== void 0 && mode2.startsWith("zeroPage") || forcedWidth === 2 && (mode2 === "absolute" || mode2 === "indirect" || mode2 !== void 0 && mode2.startsWith("absoluteIndexed"));
      if (!byteMode && !wordMode && !alreadyRequestedWidth) {
        throw this.context.diagnostics.error(
          `Width suffix '.${forcedWidth === 1 ? "b" : "w"}' is not valid for ${mnemonic} ${mode2}.`
        );
      }
      const promoted = forcedWidth === 1 ? byteMode : wordMode;
      mode2 = promoted ?? mode2;
    }
    let form = forms.find((entry) => entry.mode === mode2);
    const widened = mappedAddressingMode(directToAbsolute, mode2);
    if (!form && widened) {
      form = forms.find((entry) => entry.mode === widened);
    }
    if (!form) {
      const accepted = forms.map((entry) => entry.mode).join(", ");
      throw this.context.diagnostics.error(
        `${mnemonic} does not support addressing mode '${mode2 ?? "unknown"}' on ${this.cpu.id}. Expected ${accepted}.`
      );
    }
    return form;
  }
  /**
   * Reads an expression value.
   * @param {string} expression The expression.
   * @param {1 | 2 | 3} width The width.
   * @param {string} description The description.
   * @param {boolean} immediate Whether the expression is immediate.
   * @returns {number} The value.
   */
  readExpressionValue(expression, width, description, immediate) {
    const value = this.context.operands.getnum(expression);
    const minimum = width === 1 && immediate ? -128 : 0;
    let maximum = 255;
    if (width === 2) {
      maximum = 65535;
    } else if (width === 3) {
      maximum = 16777215;
    }
    if (!Number.isInteger(value) || value < minimum || value > maximum) {
      throw this.context.diagnostics.error(
        `${description} ${value} is outside the ${width * 8}-bit range.`
      );
    }
    return value & maximum;
  }
  /**
   * Reads a branch delta.
   * @param {LoweredOperand} operand The operand.
   * @param {number} relativeBaseOffset The relative base offset.
   * @param {1 | 2} width The width.
   * @returns {number} The branch delta.
   */
  readBranchDelta(operand, relativeBaseOffset, width) {
    return this.readBranchExpression(
      operand.baseExpression ?? operand.expanded,
      relativeBaseOffset,
      width
    );
  }
  /**
   * Reads a branch expression.
   * @param {string} expression The expression.
   * @param {number} relativeBaseOffset The relative base offset.
   * @param {1 | 2} width The width.
   * @returns {number} The branch expression.
   */
  readBranchExpression(expression, relativeBaseOffset, width) {
    if (!this.context.branches.enforceResolvedLabels()) {
      return 0;
    }
    const reference = this.context.sizing.getCurrentAddress() + relativeBaseOffset & 65535;
    let target;
    if (/^\++$/.test(expression)) {
      target = this.context.branches.findNextLabel(expression, reference);
    } else if (/^-+$/.test(expression)) {
      target = this.context.branches.findPreviousLabel(expression, reference);
    } else {
      target = this.context.operands.getnum(expression);
    }
    if (!Number.isInteger(target) || target < 0 || target > 65535) {
      throw this.context.diagnostics.error(
        `Branch target ${target} is outside the 16-bit address space.`
      );
    }
    const delta = (target - reference + 32768 & 65535) - 32768;
    const minimum = width === 1 ? -128 : -32768;
    const maximum = width === 1 ? 127 : 32767;
    if (delta < minimum || delta > maximum) {
      throw this.context.diagnostics.error(
        `Branch target $${target.toString(16).toUpperCase()} is out of range from $${reference.toString(16).toUpperCase()} (${delta}).`
      );
    }
    return delta;
  }
};

// packages/plugin-65xx/src/ca65-profile.ts
var CA65_65XX_SESSION_STATE_ID = "65xx.ca65-session-state";
function isSessionStateKey(value) {
  return value.id.length > 0;
}
function createSessionStateKey(id) {
  const key = { id };
  if (!isSessionStateKey(key)) {
    throw new Error(`Invalid session state key '${id}'.`);
  }
  return key;
}
var ca65SessionStateKey = createSessionStateKey(
  CA65_65XX_SESSION_STATE_ID
);
function createCa65SessionState() {
  return {
    defaultArchitecture: "65xx.6502",
    currentArchitecture: "65xx.6502",
    cpuStack: [],
    scopeStack: [],
    segmentStack: [],
    currentFlatSegment: ""
  };
}
function cloneCa65SessionState(state) {
  return {
    ...state,
    cpuStack: [...state.cpuStack],
    scopeStack: [...state.scopeStack],
    segmentStack: [...state.segmentStack]
  };
}
function resetCa65StageState(state) {
  state.currentArchitecture = state.defaultArchitecture;
  state.cpuStack = [];
  state.scopeStack = [];
  state.segmentStack = [];
  state.currentFlatSegment = "";
}
var ca65CpuNames = Object.freeze({
  "6502": "65xx.6502",
  "6502x": "65xx.6502x",
  "2a03": "65xx.2a03",
  "2a07": "65xx.2a03",
  "6502dtv": "65xx.6502dtv",
  "65sc02": "65xx.65sc02",
  "65c02": "65xx.65c02",
  w65c02: "65xx.w65c02",
  "65ce02": "65xx.65ce02",
  "4510": "65xx.4510",
  "45gs02": "65xx.45gs02",
  huc6280: "65xx.huc6280",
  m740: "65xx.m740"
});
function resolve65xxCpuName(name) {
  return ca65CpuNames[name.trim().toLowerCase()];
}
var ca65CpuShorthands = Object.freeze({
  p02: "6502",
  p02x: "6502x",
  pdtv: "6502dtv",
  psc02: "65sc02",
  pc02: "65c02",
  pwc02: "w65c02",
  pce02: "65ce02",
  p4510: "4510",
  p45gs02: "45gs02",
  p6280: "huc6280",
  pm740: "m740"
});
var cpuPredicateSymbols = Object.freeze({
  ifp02: "__CA65_CPU_6502__",
  ifp02x: "__CA65_CPU_6502X__",
  ifpdtv: "__CA65_CPU_6502DTV__",
  ifpsc02: "__CA65_CPU_65SC02__",
  ifpc02: "__CA65_CPU_65C02__",
  ifpwc02: "__CA65_CPU_W65C02__",
  ifpce02: "__CA65_CPU_65CE02__",
  ifp4510: "__CA65_CPU_4510__",
  ifp45gs02: "__CA65_CPU_45GS02__",
  ifp6280: "__CA65_CPU_HUC6280__",
  ifpm740: "__CA65_CPU_M740__"
});
var ca65CpuPredicateByArchitecture = Object.freeze({
  "65xx.6502": "__CA65_CPU_6502__",
  "65xx.6502x": "__CA65_CPU_6502X__",
  "65xx.2a03": "__CA65_CPU_6502X__",
  "65xx.6502dtv": "__CA65_CPU_6502DTV__",
  "65xx.65sc02": "__CA65_CPU_65SC02__",
  "65xx.65c02": "__CA65_CPU_65C02__",
  "65xx.w65c02": "__CA65_CPU_W65C02__",
  "65xx.65ce02": "__CA65_CPU_65CE02__",
  "65xx.4510": "__CA65_CPU_4510__",
  "65xx.45gs02": "__CA65_CPU_45GS02__",
  "65xx.huc6280": "__CA65_CPU_HUC6280__",
  "65xx.m740": "__CA65_CPU_M740__"
});
function splitArguments(value) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < value.length; index++) {
    const character = value[index];
    if (character === "(") {
      depth++;
    } else if (character === ")") {
      depth--;
    } else if (character === "," && depth === 0) {
      parts.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }
  parts.push(value.slice(start).trim());
  return parts.filter(Boolean);
}
function rewriteScopedNames(value) {
  let result = "";
  let quote = "";
  for (let index = 0; index < value.length; index++) {
    const character = value[index];
    if ((character === '"' || character === "'") && value[index - 1] !== "\\") {
      quote = quote === character ? "" : quote || character;
    }
    if (!quote && character === ":" && value[index + 1] === ":") {
      result += "_";
      index++;
    } else {
      result += character;
    }
  }
  return result;
}
function rewriteCa65Command(command, context) {
  let rewritten = rewriteScopedNames(command);
  rewritten = rewritten.replace(/\.(defined|lobyte|hibyte|bankbyte|loword|hiword)\s*\(/gi, "$1(");
  rewritten = rewritten.replace(
    /(^|[^\w@])@([0-7]+)\b/g,
    (_match, prefix, digits) => `${prefix}${Number.parseInt(digits, 8)}`
  );
  rewritten = rewritten.replace(/<>/g, "!=");
  const match = rewritten.match(/^(\s*)\.([\dA-Za-z]+)\b(.*)$/);
  if (!match) {
    return rewritten;
  }
  const [, indent, rawKeyword, rawRest] = match;
  const keyword = rawKeyword.toLowerCase();
  const rest = rawRest.trim();
  const predicate = cpuPredicateSymbols[keyword];
  if (predicate) {
    return `${indent}if ${predicate}`;
  }
  if (["if", "elseif", "else", "endif"].includes(keyword)) {
    return `${indent}${keyword}${rest ? ` ${rest}` : ""}`;
  }
  if (keyword === "ifdef") {
    return `${indent}if defined(${rest})`;
  }
  if (keyword === "ifndef") {
    return `${indent}if defined(${rest}) == 0`;
  }
  if (keyword === "macro") {
    const header = rest.match(/^([A-Z_a-z]\w*)\s*(.*)$/);
    if (!header) {
      return rewritten;
    }
    const params = splitArguments(header[2]).join(",");
    return `${indent}macro ${header[1]}(${params})`;
  }
  if (keyword === "endmacro") {
    return `${indent}endmacro`;
  }
  if (keyword === "repeat") {
    const [count = "0", variable = `__ca65_repeat_${context.sourceLine}`] = splitArguments(rest);
    return `${indent}for ${variable} = 0..(${count})`;
  }
  if (keyword === "endrepeat") {
    return `${indent}endfor`;
  }
  if (keyword === "undefine") {
    return `${indent}undef ${rest}`;
  }
  return rewritten;
}
var CA65_65XX_SYNTAX_PROFILE = Object.freeze({
  ...CA65_SYNTAX_PROFILE,
  id: "ca65-65xx",
  rewriteCommand: rewriteCa65Command,
  bareMacroInvocations: true,
  macroParameterPrefix: "\\"
});

// packages/plugin-65xx/src/decoder.ts
var hex = (value, width = 2) => `$${value.toString(16).toUpperCase().padStart(width, "0")}`;
var sizeOf = (form) => form.encoding.length + form.operands.reduce((sum, field) => sum + field.width, 0);
function cpu6502Specifications(cpu) {
  return getCpuDecodeTable(cpu).map((form) => ({
    id: `${cpu.id}:${form.opcode.toString(16).padStart(2, "0")}`,
    architecture: cpu.id,
    opcode: form.encoding,
    mnemonic: form.mnemonic,
    mode: form.mode,
    minimumSize: sizeOf(form),
    maximumSize: sizeOf(form),
    summary: form.note
  }));
}
var Cpu6502Decoder = class {
  constructor(cpu = nmos6502Cpu) {
    this.cpu = cpu;
    if (!cpu.features.has("nmos") || cpu.features.has("dtv")) {
      throw new Error("The NMOS decoder requires an NMOS 6502 or Ricoh CPU profile.");
    }
    this.#forms = new Map(getCpuDecodeTable(cpu).map((form) => [form.opcode, form]));
  }
  cpu;
  #forms;
  decode(context) {
    const { source, offset, logicalAddress } = context;
    if (!Number.isInteger(logicalAddress) || logicalAddress < 0 || logicalAddress > 65535) {
      return {
        kind: "error",
        code: "invalidState",
        offset,
        message: "6502 PC must be an unsigned 16-bit address."
      };
    }
    const opcode = source.readByte(offset);
    if (opcode === void 0) {
      return {
        kind: "error",
        code: "outOfBounds",
        offset,
        message: "Opcode is outside the byte source."
      };
    }
    const form = this.#forms.get(opcode);
    if (!form) {
      return {
        kind: "error",
        code: "invalidOpcode",
        offset,
        message: `Unsupported ${this.cpu.id} opcode ${hex(opcode)}.`
      };
    }
    const size = sizeOf(form);
    const bytes = source.readBytes(offset, size);
    if (!bytes) {
      return {
        kind: "error",
        code: "truncated",
        offset,
        requiredBytes: size,
        availableBytes: Math.max(0, source.length - offset),
        message: "Truncated 6502 instruction."
      };
    }
    let value = bytes[1] ?? 0;
    if (size === 3) {
      value |= bytes[2] << 8;
    }
    const operands = [];
    const references = [];
    let flow = { kind: "fallthrough", fallthrough: true };
    if (form.mode === "relative") {
      const displacement = value >= 128 ? value - 256 : value;
      const targetAddress = logicalAddress + size + displacement & 65535;
      operands.push({
        kind: "displacement",
        value: displacement,
        width: 1,
        signed: true,
        targetAddress
      });
      references.push({ kind: "branch", address: targetAddress, operandIndex: 0 });
      flow = { kind: "conditionalBranch", fallthrough: true };
    } else if (size > 1) {
      const immediate = form.mode === "immediate";
      operands.push({ kind: immediate ? "immediate" : "address", value, width: size - 1 });
      if (!immediate) {
        const indirect = form.mode === "indirect" || form.mode === "indexedIndirectX" || form.mode === "indirectIndexedY";
        let kind = "data";
        if (form.mnemonic === "JSR") {
          kind = "call";
        }
        if (form.mnemonic === "JMP") {
          kind = "jump";
        }
        references.push({ kind, address: value, indirect, operandIndex: 0 });
      }
    } else if (form.mode === "accumulator") {
      operands.push({ kind: "accumulator", register: "a" });
    }
    if (form.mnemonic === "JSR") {
      flow = { kind: "call", fallthrough: true };
    }
    if (form.mnemonic === "JMP") {
      flow = { kind: "jump", fallthrough: false, indirect: form.mode === "indirect" };
    }
    if (form.mnemonic === "RTS" || form.mnemonic === "RTI") {
      flow = { kind: "return", fallthrough: false };
    }
    if (form.mnemonic === "BRK") {
      flow = { kind: "interrupt", fallthrough: false };
    }
    if (form.mnemonic === "JAM") {
      flow = { kind: "stop", fallthrough: false };
    }
    return {
      kind: "instruction",
      instruction: {
        architecture: this.cpu.id,
        specificationId: `${this.cpu.id}:${opcode.toString(16).padStart(2, "0")}`,
        opcode,
        mnemonic: form.mnemonic,
        mode: form.mode,
        offset,
        logicalAddress,
        bytes,
        size,
        operands,
        references,
        flow,
        effects: [{ kind: "custom", name: "nmos6502", details: { opcode } }]
      }
    };
  }
};
function formatCpu6502Instruction(instruction, addressExpression) {
  const form = getOpcodeForm(instruction.opcode);
  if (!form.canonical) {
    return `.byte ${[...instruction.bytes].map((byte) => hex(byte)).join(", ")} ; ${form.mnemonic}`;
  }
  const operand = instruction.operands[0];
  const value = operand?.value ?? 0;
  let text = "";
  let suffix = "";
  switch (form.mode) {
    case "implied":
      break;
    case "accumulator":
      text = "A";
      break;
    case "immediate":
      text = `#${hex(value)}`;
      break;
    case "relative":
      text = hex(operand.targetAddress, 4);
      break;
    case "zeroPage":
      text = hex(value);
      break;
    case "zeroPageIndexedX":
      text = `${hex(value)},X`;
      break;
    case "zeroPageIndexedY":
      text = `${hex(value)},Y`;
      break;
    case "absolute":
      text = addressExpression ?? hex(value, 4);
      suffix = ".w";
      break;
    case "absoluteIndexedX":
      text = `${hex(value, 4)},X`;
      suffix = ".w";
      break;
    case "absoluteIndexedY":
      text = `${hex(value, 4)},Y`;
      suffix = ".w";
      break;
    case "indirect":
      text = `(${hex(value, 4)})`;
      suffix = ".w";
      break;
    case "indexedIndirectX":
      text = `(${hex(value)},X)`;
      break;
    case "indirectIndexedY":
      text = `(${hex(value)}),Y`;
      break;
    // Other 65xx dialect modes cannot occur in an NMOS opcode table.
    case "absoluteIndexedIndirect":
    case "absoluteLongIndexedX":
    case "accumulatorRelative":
    case "basePageIndirectIndexedZ":
    case "blockTransfer":
    case "immediateAbsolute":
    case "immediateAbsoluteIndexedX":
    case "immediateZeroPage":
    case "immediateZeroPageIndexedX":
    case "quadAccumulator":
    case "relative16":
    case "specialPage":
    case "stackRelative":
    case "stackRelativeIndirectIndexedY":
    case "zeroPageImmediate":
    case "zeroPageIndirect":
    case "zeroPageIndirectIndexedZ":
    case "zeroPageIndirectLong":
    case "zeroPageRelative":
      throw new Error(`Unsupported NMOS mode ${form.mode}.`);
  }
  return `${form.mnemonic}${suffix}${text ? ` ${text}` : ""}`;
}

// packages/plugin-65xx/src/directives/ca65.ts
function unquote(token) {
  if (token.length >= 2) {
    const quote = token[0];
    if ((quote === '"' || quote === "'") && token.endsWith(quote)) {
      return token.slice(1, -1);
    }
  }
  return token;
}
function parameterList(words) {
  const joined = words.slice(1).join(" ");
  const parts = [];
  let current = "";
  let parenDepth = 0;
  let quote;
  for (const char of joined) {
    if (quote) {
      current += char;
      if (char === quote) {
        quote = void 0;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }
    if (char === "(") {
      parenDepth++;
    } else if (char === ")") {
      parenDepth--;
    }
    if (char === "," && parenDepth === 0) {
      const trimmed2 = current.trim();
      if (trimmed2) {
        parts.push(trimmed2);
      }
      current = "";
      continue;
    }
    current += char;
  }
  const trimmed = current.trim();
  if (trimmed) {
    parts.push(trimmed);
  }
  return parts;
}
function markGlobalSymbol(session, name) {
  if (!name) {
    return;
  }
  const localKey = session.symbolScope.qualifySymbolName(name);
  session.globalSymbols.add(name);
  if (localKey !== name) {
    const existing = session.labelTable.get(localKey);
    if (existing) {
      session.symbolScope.setLabel(name, existing.value, existing.isStatic);
    }
  }
}
function closeActiveSegment(session, state) {
  if (!state.currentSegment) {
    return;
  }
  const segment = state.linker.segments.get(state.currentSegment);
  if (!segment) {
    state.currentSegment = null;
    return;
  }
  const size = session.currentTargetBaseAddress - state.segmentLoadStart;
  state.memoryCursors[segment.load] = session.currentTargetBaseAddress;
  if (segment.define) {
    const loadName = `__${segment.name}_LOAD__`;
    const runName = `__${segment.name}_RUN__`;
    const sizeName = `__${segment.name}_SIZE__`;
    const runEndName = `__${segment.name}_RUN_END__`;
    session.globalSymbols.add(loadName);
    session.globalSymbols.add(runName);
    session.globalSymbols.add(sizeName);
    session.globalSymbols.add(runEndName);
    session.symbolScope.setLabel(loadName, state.segmentLoadStart, true);
    session.symbolScope.setLabel(runName, state.segmentRunStart, true);
    session.symbolScope.setLabel(sizeName, size, true);
    session.symbolScope.setLabel(runEndName, state.segmentRunStart + size, true);
  }
  state.currentSegment = null;
  state.currentLoadMemory = null;
}
function applyLinkerSymbols(session, state) {
  for (const symbol of state.linker.symbols) {
    session.globalSymbols.add(symbol.name);
    const value = session.operandResolver.getnum(symbol.valueExpr);
    session.symbolScope.setLabel(symbol.name, value, true);
  }
}
function openSegment(session, state, segment) {
  const loadMemory = state.linker.memories.get(segment.load);
  const runMemory = state.linker.memories.get(segment.run);
  if (!loadMemory || !runMemory) {
    throw new Error(`.segment "${segment.name}" references unknown MEMORY.`);
  }
  const loadCursor = Object.hasOwn(state.memoryCursors, segment.load) ? state.memoryCursors[segment.load] : void 0;
  const loadStart = segment.start ?? loadCursor ?? loadMemory.start;
  session.setWritePosition(loadStart);
  const runStart = segment.run === segment.load ? loadStart : runMemory.start;
  if (runStart !== loadStart) {
    session.currentTargetAddress = runStart;
    session.currentTargetStartAddress = runStart;
  }
  state.currentSegment = segment.name;
  state.currentLoadMemory = segment.load;
  state.segmentLoadStart = loadStart;
  state.segmentRunStart = runStart;
}
function handleSegment(session, state, words) {
  const name = unquote(words[1] ?? "").trim();
  if (!name) {
    throw new Error(".segment requires a segment name.");
  }
  const segment = state.linker.segments.get(name);
  if (!segment) {
    throw new Error(`.segment "${name}" is not defined in the linker configuration.`);
  }
  closeActiveSegment(session, state);
  openSegment(session, state, segment);
}
function markGlobalSymbols(session, words, keyword) {
  const names = parameterList(words).map((entry) => unquote(entry).trim()).filter(Boolean);
  if (names.length === 0) {
    throw new Error(`${keyword} requires at least one identifier.`);
  }
  for (const name of names) {
    markGlobalSymbol(session, name);
  }
}
function handleExport(session, words) {
  markGlobalSymbols(session, words, ".export");
}
function handleImport(session, words) {
  markGlobalSymbols(session, words, ".import");
}
function handleByte(session, words) {
  session.directiveRuntime.handleDataDirective("db", words.slice(1));
}
function handleAddr(session, words) {
  session.directiveRuntime.handleDataDirective("dw", words.slice(1));
}
function emitMappedBytes(session, words, write2, width) {
  const params = parameterList(words);
  if (params.length === 0) {
    throw new Error(`${words[0]} requires at least one parameter.`);
  }
  if (session.isDefinitionCollectionStage) {
    session.step(params.length * width);
    return;
  }
  for (const param of params) {
    write2(session.operandResolver.getnum(param));
  }
}
function handleLobytes(session, words) {
  emitMappedBytes(session, words, (value) => session.write1(value & 255), 1);
}
function handleHibytes(session, words) {
  emitMappedBytes(session, words, (value) => session.write1(value >> 8 & 255), 1);
}
function handleDbyt(session, words) {
  emitMappedBytes(
    session,
    words,
    (value) => {
      session.write1(value >> 8 & 255);
      session.write1(value & 255);
    },
    2
  );
}
function handleDword(session, words, width = 4) {
  session.directiveRuntime.handleDataDirective(width === 3 ? "dl" : "dd", words.slice(1));
}
function handleSetcpu(session, state, words) {
  const name = unquote(words.slice(1).join(" ").trim());
  if (!name) {
    throw new Error(".setcpu requires a CPU name argument.");
  }
  const architecture = resolve65xxCpuName(name);
  if (!architecture) {
    throw new Error(
      `.setcpu "${name}" is not a supported 65xx CPU. Supported names: ${Object.keys(ca65CpuNames).join(", ")}.`
    );
  }
  session.selectArchitecture(architecture, name.toLowerCase());
  state.currentArchitecture = architecture;
}
function handlePushcpu(session, state) {
  state.cpuStack.push(session.resolveActiveArchitecture().name);
}
function handlePopcpu(session, state) {
  const architecture = state.cpuStack.pop();
  if (!architecture) {
    throw new Error(".popcpu: CPU stack is empty.");
  }
  session.selectArchitecture(architecture, architecture);
  state.currentArchitecture = architecture;
}
function handleCpuShorthand(session, state, words) {
  const keyword = (words[0] ?? "").replace(/^\./, "").toLowerCase();
  const cpu = ca65CpuShorthands[keyword];
  if (!cpu) {
    throw new Error(`Unknown ca65 CPU shorthand '.${keyword}'.`);
  }
  handleSetcpu(session, state, ["setcpu", cpu]);
}
function handleRes(session, words) {
  const params = parameterList(words);
  if (params.length < 1 || params.length > 2) {
    throw new Error(".res expects count and an optional fill value.");
  }
  const count = session.operandResolver.getnum(params[0] ?? "");
  const fill = params[1] ? session.operandResolver.getnum(params[1]) : 0;
  if (!Number.isInteger(count) || count < 0) {
    throw new Error(".res count must be non-negative.");
  }
  if (session.isDefinitionCollectionStage) {
    session.step(count);
    return;
  }
  for (let index = 0; index < count; index++) {
    session.write1(fill & 255);
  }
}
function handleAlign(session, words) {
  const params = parameterList(words);
  if (params.length < 1 || params.length > 2) {
    throw new Error(".align expects a boundary and optional fill value.");
  }
  const boundary = session.operandResolver.getnum(params[0] ?? "");
  const fill = params[1] ? session.operandResolver.getnum(params[1]) : 0;
  if (!Number.isInteger(boundary) || boundary <= 0) {
    throw new Error(".align boundary must be a positive integer.");
  }
  const count = (boundary - session.currentTargetAddress % boundary) % boundary;
  if (session.isDefinitionCollectionStage) {
    session.step(count);
    return;
  }
  for (let index = 0; index < count; index++) {
    session.write1(fill & 255);
  }
}
function handleCa65Incbin(session, words) {
  const params = parameterList(words);
  if (params.length < 1 || params.length > 3) {
    throw new Error(".incbin expects a filename, optional offset, and optional size.");
  }
  const filename = unquote(params[0] ?? "");
  const data = session.includeSource.readFile(filename);
  if (!(data instanceof Uint8Array)) {
    throw new Error(`Failed to read binary include: ${filename}`);
  }
  const offset = params[1] ? session.operandResolver.getnum(params[1]) : 0;
  const size = params[2] ? session.operandResolver.getnum(params[2]) : data.length - offset;
  if (!Number.isInteger(offset) || !Number.isInteger(size) || offset < 0 || size < 0 || offset + size > data.length) {
    throw new Error(
      `.incbin range ${offset}+${size} is outside '${filename}' (${data.length} bytes).`
    );
  }
  if (session.isDefinitionCollectionStage) {
    session.step(size);
    return;
  }
  for (const byte of data.subarray(offset, offset + size)) {
    session.write1(byte);
  }
}
function handleCa65Assert(session, words) {
  const params = parameterList(words);
  if (params.length === 0) {
    throw new Error(".assert requires an expression.");
  }
  if (session.operandResolver.getnum(params[0] ?? "") !== 0) {
    return;
  }
  const message = params.find((part) => /^["']/.test(part));
  throw new Error(message ? unquote(message) : ".assert expression evaluated to false.");
}
function handleScope(session, state, words, procedure) {
  const name = words[1]?.trim() || `__anonymous_scope_${session.currentLine}`;
  if (procedure) {
    session.symbolScope.setLabel(session.symbolScope.qualifySymbolName(name));
  }
  state.scopeStack.push(session.currentNamespace);
  session.currentNamespace = session.currentNamespace ? `${session.currentNamespace}_${name}` : name;
}
function handleEndScope(session, state) {
  const previous = state.scopeStack.pop();
  if (previous === void 0) {
    throw new Error("ca65 scope stack is empty.");
  }
  session.currentNamespace = previous;
}
function handleFlatSegment(state, words) {
  const name = unquote(words[1] ?? "").trim();
  if (!name) {
    throw new Error(".segment requires a segment name.");
  }
  state.currentFlatSegment = name;
}
function handlePushseg(state) {
  state.segmentStack.push(state.currentFlatSegment);
}
function handlePopseg(state) {
  const segment = state.segmentStack.pop();
  if (segment === void 0) {
    throw new Error(".popseg: segment stack is empty.");
  }
  state.currentFlatSegment = segment;
}
function handleUnsupportedCa65(words) {
  const keyword = words[0] ?? "<unknown>";
  throw new Error(
    `.${keyword.replace(/^\./, "")} requires relocatable ca65 object/linker semantics, which the flat-image compatibility profile does not implement.`
  );
}

// packages/plugin-65xx/src/operands/classifier.ts
function classify65xxOperand(resolver, operand) {
  const raw = operand.trim();
  const sizePrefix = parseCa65AddressSizePrefix(raw);
  const { expanded, length: inferredLength } = resolver.expandOperand(sizePrefix.rest);
  let length = inferredLength;
  if (sizePrefix.force === 1) {
    length = 1;
  } else if (sizePrefix.force === 2) {
    length = Math.max(2, inferredLength);
  } else if (sizePrefix.force === 3) {
    length = Math.max(3, inferredLength);
  }
  const normalized = expanded.trim();
  const normalizedUpper = normalized.toUpperCase();
  const compound = splitTopLevelOperands2(normalized);
  let mode2 = "unknown";
  let baseExpression = normalized;
  let registerName;
  if (normalized === "") {
    mode2 = "implied";
  } else if (normalizedUpper === "A") {
    mode2 = "accumulator";
    registerName = "a";
  } else if (normalizedUpper === "Q") {
    mode2 = "quadAccumulator";
    registerName = "q";
  } else if (compound.length >= 2 && compound[0]?.startsWith("#")) {
    const indexedX = compound.length === 3 && compound[2]?.toUpperCase() === "X";
    const address2 = compound[1] ?? "";
    const addressLength = resolver.expandOperand(address2).length;
    mode2 = `${addressLength <= 1 ? "immediateZeroPage" : "immediateAbsolute"}${indexedX ? "IndexedX" : ""}`;
    baseExpression = normalized;
  } else if (normalized.startsWith("#")) {
    mode2 = "immediate";
    baseExpression = normalized.slice(1).trim();
  } else {
    const indexedIndirect = normalized.match(/^\(\s*(.+?)\s*,\s*x\s*\)$/i);
    const stackRelativeIndirect = normalized.match(/^\(\s*(.+?)\s*,\s*s\s*\)\s*,\s*y$/i);
    const indirectIndexed = normalized.match(/^\(\s*(.+?)\s*\)\s*,\s*y$/i);
    const indirectIndexedZ = normalized.match(/^\(\s*(.+?)\s*\)\s*,\s*z$/i);
    const indirect = normalized.match(/^\(\s*(.+?)\s*\)$/i);
    const basePageIndirectZ = normalized.match(/^\[\s*(.+?)\s*]\s*,\s*z$/i);
    const indirectLong = normalized.match(/^\[\s*(.+?)\s*]$/i);
    const indexed = normalized.match(/^(.+?)\s*,\s*([sx-z])$/i);
    const topLevelComma = findTopLevelComma(normalized);
    if (stackRelativeIndirect) {
      mode2 = "stackRelativeIndirectIndexedY";
      baseExpression = stackRelativeIndirect[1].trim();
    } else if (indexedIndirect) {
      mode2 = resolver.expandOperand(indexedIndirect[1].trim()).length <= 1 ? "indexedIndirectX" : "absoluteIndexedIndirect";
      baseExpression = indexedIndirect[1].trim();
    } else if (indirectIndexed && !indirectIndexed[1].includes(",")) {
      mode2 = "indirectIndexedY";
      baseExpression = indirectIndexed[1].trim();
    } else if (indirectIndexedZ && !indirectIndexedZ[1].includes(",")) {
      mode2 = "zeroPageIndirectIndexedZ";
      baseExpression = indirectIndexedZ[1].trim();
    } else if (basePageIndirectZ) {
      mode2 = "basePageIndirectIndexedZ";
      baseExpression = basePageIndirectZ[1].trim();
    } else if (indirectLong) {
      mode2 = "zeroPageIndirectLong";
      baseExpression = indirectLong[1].trim();
    } else if (indirect) {
      mode2 = resolver.expandOperand(indirect[1].trim()).length <= 1 ? "zeroPageIndirect" : "indirect";
      baseExpression = indirect[1].trim();
    } else if (indexed) {
      const register = indexed[2].toLowerCase();
      if (register === "s") {
        mode2 = "stackRelative";
      } else if (register === "z") {
        mode2 = "unknown";
      } else if (length > 2 && register === "x") {
        mode2 = "absoluteLongIndexedX";
      } else {
        mode2 = `${length <= 1 ? "zeroPage" : "absolute"}Indexed${register.toUpperCase()}`;
      }
      baseExpression = indexed[1].trim();
    } else if (topLevelComma >= 0) {
      if (compound.length === 3) {
        mode2 = "blockTransfer";
      } else if (compound[0]?.toUpperCase() === "A") {
        mode2 = "accumulatorRelative";
      } else if (compound[1]?.startsWith("#")) {
        mode2 = "zeroPageImmediate";
      } else {
        mode2 = "zeroPageRelative";
      }
      baseExpression = normalized;
    } else {
      mode2 = length <= 1 ? "zeroPage" : "absolute";
    }
  }
  return {
    // Unused
    immediate: false,
    // Unused
    indirect: false,
    mode: mode2,
    baseExpression,
    registerName,
    raw,
    expanded,
    length,
    // 24-bit values are not 6502-legal. Encoder can still emit long-x on 4510.
    metadata: length > 2 ? { addressOutOfRange: true } : void 0
  };
}
function splitTopLevelOperands2(value) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < value.length; index++) {
    const character = value[index];
    if (character === "(" || character === "[") {
      depth++;
    } else if (character === ")" || character === "]") {
      depth--;
    } else if (character === "," && depth === 0) {
      parts.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }
  parts.push(value.slice(start).trim());
  return parts.filter(Boolean);
}
function findTopLevelComma(value) {
  let depth = 0;
  for (let index = 0; index < value.length; index++) {
    const character = value[index];
    if (character === "(" || character === "[") {
      depth++;
    } else if (character === ")" || character === "]") {
      depth--;
    } else if (character === "," && depth === 0) {
      return index;
    }
  }
  return -1;
}
function parseCa65AddressSizePrefix(operand) {
  const match = operand.match(/^([afz]):(.*)$/i);
  if (!match) {
    return { rest: operand, force: void 0 };
  }
  const rest = match[2].trim();
  const key = match[1].toLowerCase();
  if (key === "z") {
    return { rest, force: 1 };
  }
  if (key === "a") {
    return { rest, force: 2 };
  }
  return { rest, force: 3 };
}

// packages/plugin-65xx/src/session-state.ts
var NES_65XX_SESSION_STATE_ID = "65xx.nes-session-state";
function isSessionStateKey2(value) {
  return value.id.length > 0;
}
function createSessionStateKey2(id) {
  const key = { id };
  if (!isSessionStateKey2(key)) {
    throw new Error(`Invalid session state key '${id}'.`);
  }
  return key;
}
var nes65xxSessionStateKey = createSessionStateKey2(NES_65XX_SESSION_STATE_ID);
function cloneNes65xxSessionState(value) {
  return {
    ...value,
    header: [...value.header],
    memoryCursors: { ...value.memoryCursors }
  };
}
function resetNes65xxStageState(state) {
  state.memoryCursors = {};
  for (const memory of state.linker.memories.values()) {
    state.memoryCursors[memory.name] = memory.start;
  }
  state.currentSegment = null;
  state.currentLoadMemory = null;
  state.segmentLoadStart = 0;
  state.segmentRunStart = 0;
}

// packages/plugin-65xx/src/linker-config.ts
var DEFAULT_LINKER_CONFIG = `MEMORY {
    ROM: start = $8000, size = $8000, file = %O, fill = yes, fillval = $FF ;
}
SEGMENTS {
    CODE: load = ROM, type = ro ;
}
`;
function defaultLd65ConfigText() {
  return DEFAULT_LINKER_CONFIG;
}
function parseLd65Config(source) {
  const text = source.replace(/\/\*[\S\s]*?\*\//g, " ");
  const memories = /* @__PURE__ */ new Map();
  const segments = /* @__PURE__ */ new Map();
  const symbols = [];
  let fileOffset = 0;
  for (const statement of readBlockStatements(text, "MEMORY")) {
    const parsed = parseNamedStatement(statement);
    const start = requireNumber(parsed.attrs, "start", parsed.name);
    const size = requireNumber(parsed.attrs, "size", parsed.name);
    const file = parsed.attrs.file ?? "%O";
    const isRam = file === '""' || file === "''" || file === "";
    const region = {
      name: parsed.name,
      start,
      size,
      fileOffset: isRam ? -1 : fileOffset,
      fill: parseYesNo(parsed.attrs.fill) ?? false,
      fillval: parseNumberToken(parsed.attrs.fillval ?? "0") ?? 0
    };
    memories.set(region.name, region);
    if (!isRam) {
      fileOffset += size;
    }
  }
  for (const statement of readBlockStatements(text, "SEGMENTS")) {
    const parsed = parseNamedStatement(statement);
    const load = parsed.attrs.load;
    if (!load) {
      throw new Error(`ld65 segment '${parsed.name}' is missing load = MEMORY.`);
    }
    if (!memories.has(load)) {
      throw new Error(`ld65 segment '${parsed.name}' loads unknown memory '${load}'.`);
    }
    const run = parsed.attrs.run ?? load;
    if (!memories.has(run)) {
      throw new Error(`ld65 segment '${parsed.name}' runs in unknown memory '${run}'.`);
    }
    segments.set(parsed.name, {
      name: parsed.name,
      load,
      run,
      start: parseNumberToken(parsed.attrs.start),
      define: parseYesNo(parsed.attrs.define) ?? false,
      type: parsed.attrs.type ?? "ro"
    });
  }
  for (const statement of readBlockStatements(text, "SYMBOLS")) {
    const parsed = parseNamedStatement(statement);
    const valueExpr = parsed.attrs.value;
    if (!valueExpr) {
      throw new Error(`ld65 symbol '${parsed.name}' is missing value = EXPR.`);
    }
    symbols.push({ name: parsed.name, valueExpr });
  }
  if (memories.size === 0) {
    throw new Error("ld65 config MEMORY block is empty.");
  }
  return {
    memories,
    segments,
    symbols,
    imageSize: fileOffset
  };
}
function linkerDefinedSymbolNames(config) {
  const names = [];
  for (const segment of config.segments.values()) {
    if (!segment.define) {
      continue;
    }
    names.push(
      `__${segment.name}_LOAD__`,
      `__${segment.name}_RUN__`,
      `__${segment.name}_SIZE__`,
      `__${segment.name}_RUN_END__`
    );
  }
  for (const symbol of config.symbols) {
    names.push(symbol.name);
  }
  return names;
}
var LD65_BLOCK_BODY = {
  MEMORY: /memory\s*{([\S\s]*?)}/i,
  SEGMENTS: /segments\s*{([\S\s]*?)}/i,
  SYMBOLS: /symbols\s*{([\S\s]*?)}/i
};
function readBlockStatements(source, block) {
  const match = source.match(LD65_BLOCK_BODY[block]);
  if (!match) {
    return [];
  }
  return match[1].split(";").map((entry) => entry.trim()).filter(Boolean);
}
function parseNamedStatement(statement) {
  const colon = statement.indexOf(":");
  if (colon <= 0) {
    throw new Error(`Invalid ld65 statement: ${statement}`);
  }
  const name = statement.slice(0, colon).trim();
  const attrs = {};
  for (const part of splitTopLevelCommas(statement.slice(colon + 1))) {
    const equals = part.indexOf("=");
    if (equals <= 0) {
      continue;
    }
    const key = part.slice(0, equals).trim().toLowerCase();
    const value = part.slice(equals + 1).trim();
    attrs[key] = value;
  }
  return { name, attrs };
}
function splitTopLevelCommas(input) {
  const parts = [];
  let current = "";
  let quote;
  for (const char of input) {
    if (quote) {
      current += char;
      if (char === quote) {
        quote = void 0;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }
    if (char === ",") {
      const trimmed2 = current.trim();
      if (trimmed2) {
        parts.push(trimmed2);
      }
      current = "";
      continue;
    }
    current += char;
  }
  const trimmed = current.trim();
  if (trimmed) {
    parts.push(trimmed);
  }
  return parts;
}
function parseNumberToken(token) {
  if (token === void 0 || token === "") {
    return void 0;
  }
  if (token.startsWith("$")) {
    const value = Number.parseInt(token.slice(1), 16);
    return Number.isFinite(value) ? value : void 0;
  }
  if (/^-?\d+$/.test(token)) {
    return Number.parseInt(token, 10);
  }
  return void 0;
}
function requireNumber(attrs, key, owner) {
  const value = parseNumberToken(attrs[key]);
  if (value === void 0) {
    throw new Error(`ld65 '${owner}' is missing numeric ${key}.`);
  }
  return value;
}
function parseYesNo(raw) {
  if (raw === void 0) {
    return void 0;
  }
  const normalized = raw.toLowerCase();
  if (normalized === "yes" || normalized === "true") {
    return true;
  }
  if (normalized === "no" || normalized === "false") {
    return false;
  }
  return void 0;
}

// packages/plugin-65xx/src/target/nes.ts
var NES_65XX_TARGET_ID = "65xx.nes";
var NES_65XX_ADDRESS_SPACE_ID = "65xx.ines-address-space";
var NES_65XX_OUTPUT_FORMAT_ID = "65xx.ines-output";
var NES_65XX_LIFECYCLE_ID = "65xx.nes-lifecycle";
var INES_MAGIC = [78, 69, 83, 26];
function isRecord5(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function createNes65xxTargetOptions(configured) {
  const value = isRecord5(configured) ? configured : {};
  const linkerConfig = typeof value.linkerConfig === "string" && value.linkerConfig.trim() ? value.linkerConfig : defaultLd65ConfigText();
  const linker = parseLd65Config(linkerConfig);
  const fillByte = typeof value.fillByte === "number" && Number.isInteger(value.fillByte) ? value.fillByte & 255 : 255;
  const header = normalizeHeader(value.header, linker.imageSize);
  return { header, linkerConfig, fillByte, linker };
}
function createInitialNesState(context) {
  const options = createNes65xxTargetOptions(context.targetOptions);
  const state = {
    header: options.header,
    fillByte: options.fillByte,
    linker: options.linker,
    memoryCursors: {},
    currentSegment: null,
    currentLoadMemory: null,
    segmentLoadStart: 0,
    segmentRunStart: 0
  };
  resetNes65xxStageState(state);
  return state;
}
function validate(address2) {
  if (!Number.isInteger(address2) || address2 < 0 || address2 > 65535) {
    throw new Error(`Address $${address2.toString(16).toUpperCase()} is outside 16-bit NES space.`);
  }
  return address2;
}
function createNesAddressSpace({ state }) {
  return {
    addressWidth: 16,
    defaultOrigin: 0,
    normalizeForWrite: validate,
    advance(address2, amount) {
      return validate(address2 + amount & 65535);
    },
    toOutputOffset(address2) {
      const nes = state.get(nes65xxSessionStateKey);
      if (!nes.currentLoadMemory) {
        return -1;
      }
      const memory = nes.linker.memories.get(nes.currentLoadMemory);
      if (!memory || memory.fileOffset < 0) {
        return -1;
      }
      if (address2 < memory.start || address2 >= memory.start + memory.size) {
        return -1;
      }
      return nes.header.length + memory.fileOffset + (address2 - memory.start);
    },
    fromOutputOffset(offset) {
      const nes = state.get(nes65xxSessionStateKey);
      const prgOffset = offset - nes.header.length;
      if (prgOffset < 0) {
        return -1;
      }
      for (const memory of nes.linker.memories.values()) {
        if (memory.fileOffset < 0) {
          continue;
        }
        if (prgOffset >= memory.fileOffset && prgOffset < memory.fileOffset + memory.size) {
          return memory.start + (prgOffset - memory.fileOffset);
        }
      }
      return -1;
    },
    validateWrite(address2) {
      validate(address2);
    }
  };
}
function createNesOutputFormat() {
  return {
    finalize: () => void 0,
    getOutput: ({ outputBytes }) => Uint8Array.from(outputBytes)
  };
}
function createNesLifecycle({ state }) {
  const prefill = (session) => {
    const nes = state.get(nes65xxSessionStateKey);
    resetNes65xxStageState(nes);
    session.outputFillByte = nes.fillByte;
    const total = nes.header.length + nes.linker.imageSize;
    const image = Array.from({ length: total }, () => nes.fillByte);
    for (let index = 0; index < nes.header.length; index++) {
      image[index] = nes.header[index] ?? 0;
    }
    session.outputBytes = image;
    session.bytes = 0;
    for (const name of linkerDefinedSymbolNames(nes.linker)) {
      session.globalSymbols.add(name);
    }
  };
  return {
    onSessionCreated: ({ session }) => {
      prefill(session);
    },
    onStageStart: ({ session }) => {
      prefill(session);
    },
    onStageEnd: ({ session }) => {
      const nes = state.get(nes65xxSessionStateKey);
      closeActiveSegment(session, nes);
      applyLinkerSymbols(session, nes);
    }
  };
}
function normalizeHeader(configured, imageSize) {
  if (configured instanceof Uint8Array || Array.isArray(configured)) {
    const bytes = [...configured].map((value) => Number(value) & 255);
    if (bytes.length === 0) {
      throw new Error("65xx NES target header must not be empty.");
    }
    return bytes;
  }
  if (configured !== void 0) {
    throw new Error("65xx NES target header must be a byte array.");
  }
  const prgBanks = Math.max(1, Math.ceil(imageSize / 16384));
  const header = Array.from({ length: 16 }, () => 0);
  header[0] = INES_MAGIC[0];
  header[1] = INES_MAGIC[1];
  header[2] = INES_MAGIC[2];
  header[3] = INES_MAGIC[3];
  header[4] = prgBanks & 255;
  return header;
}

// packages/plugin-65xx/src/index.ts
var RAW_65XX_TARGET_ID = "65xx.raw";
var FLAT_65XX_ADDRESS_SPACE_ID = "65xx.flat16";
var RAW_65XX_OUTPUT_FORMAT_ID = "65xx.raw-output";
var RAW_65XX_LIFECYCLE_ID = "65xx.raw-lifecycle";
var CA65_RAW_65XX_TARGET_ID = "65xx.ca65-raw";
var CA65_65XX_DIRECTIVE_SET_ID = "65xx.ca65-directives";
var CA65_65XX_EXPRESSION_SET_ID = "65xx.ca65-expressions";
var CA65_65XX_LIFECYCLE_ID = "65xx.ca65-lifecycle";
function createRaw65xxTargetOptions(configured) {
  if (configured === void 0) {
    return { origin: 0 };
  }
  if (typeof configured !== "object" || configured === null || Array.isArray(configured)) {
    throw new Error("65xx raw target options must be an object with an optional numeric 'origin'.");
  }
  const keys = Object.keys(configured);
  const unknown = keys.filter((key) => key !== "origin");
  if (unknown.length > 0) {
    throw new Error(`Unknown 65xx raw target option(s): ${unknown.join(", ")}.`);
  }
  const value = "origin" in configured ? configured.origin : 0;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 65535) {
    throw new Error("65xx raw target origin must be an integer from 0 through 65535.");
  }
  return { origin: value };
}
var descriptor = (keyword, summary, syntax2, group) => ({ keyword, summary, syntax: syntax2, group });
var ca65Tooling = [
  descriptor("setcpu", "Select a 65xx CPU.", '.setcpu "CPU"', "architecture"),
  descriptor("cpu", "Alias for .setcpu.", '.cpu "CPU"', "architecture"),
  descriptor("pushcpu", "Push the current CPU.", ".pushcpu", "architecture"),
  descriptor("popcpu", "Restore the pushed CPU.", ".popcpu", "architecture"),
  descriptor("segment", "Switch to an ld65 segment.", '.segment "NAME"', "layout"),
  descriptor("pushseg", "Push the current flat segment.", ".pushseg", "layout"),
  descriptor("popseg", "Restore the pushed flat segment.", ".popseg", "layout"),
  descriptor("export", "Export a symbol to other files.", ".export ident[, ident...]", "label"),
  descriptor(
    "import",
    "Import a symbol defined in another file.",
    ".import ident[, ident...]",
    "label"
  ),
  descriptor("byte", "Emit one or more bytes.", ".byte value[, value...]", "data"),
  descriptor("byt", "Alias for .byte.", ".byt value[, value...]", "data"),
  descriptor("addr", "Emit 16-bit little-endian addresses.", ".addr value[, value...]", "data"),
  descriptor("word", "Alias for .addr.", ".word value[, value...]", "data"),
  descriptor(
    "lobytes",
    "Emit the low byte of each expression.",
    ".lobytes expr[, expr...]",
    "data"
  ),
  descriptor(
    "hibytes",
    "Emit the high byte of each expression.",
    ".hibytes expr[, expr...]",
    "data"
  ),
  descriptor("dbyt", "Emit 16-bit big-endian words.", ".dbyt value[, value...]", "data"),
  descriptor("dword", "Emit 32-bit little-endian values.", ".dword value[, value...]", "data"),
  descriptor(
    "faraddr",
    "Emit 24-bit little-endian addresses.",
    ".faraddr value[, value...]",
    "data"
  ),
  descriptor("res", "Reserve bytes with an optional fill value.", ".res count[, fill]", "data"),
  descriptor("align", "Align the location counter.", ".align boundary[, fill]", "layout"),
  descriptor("incbin", "Include a binary range.", '.incbin "file"[, offset[, size]]', "include"),
  descriptor(
    "assert",
    "Require an expression to be true.",
    '.assert expr[, error[, "message"]]',
    "diagnostic"
  ),
  descriptor("scope", "Enter a lexical scope.", ".scope [name]", "label"),
  descriptor("endscope", "Leave a lexical scope.", ".endscope", "label"),
  descriptor("proc", "Define and enter a procedure scope.", ".proc name", "label"),
  descriptor("endproc", "Leave a procedure scope.", ".endproc", "label")
];
var ca65ExpressionFunctions = [
  ["lobyte", "Low byte of a value.", (value) => value & 255],
  ["hibyte", "High byte of a value.", (value) => value >>> 8 & 255],
  ["bankbyte", "Bank byte of a value.", (value) => value >>> 16 & 255],
  ["loword", "Low word of a value.", (value) => value & 65535],
  ["hiword", "High word of a value.", (value) => value >>> 16 & 65535]
];
var directive = (id, keywords, handler) => {
  const wanted = new Set(keywords);
  return {
    id,
    keywords,
    phase: "lowered",
    createHandler: handler,
    tooling: ca65Tooling.filter((entry) => wanted.has(entry.keyword))
  };
};
function validate2(address2) {
  if (!Number.isInteger(address2) || address2 < 0 || address2 > 65535) {
    throw new Error(`Address $${address2.toString(16).toUpperCase()} is outside flat16.`);
  }
  return address2;
}
function createFlat65xxAddressSpace({ options }) {
  const { origin } = createRaw65xxTargetOptions(options);
  return {
    addressWidth: 16,
    defaultOrigin: origin,
    normalizeForWrite: validate2,
    advance(address2, amount) {
      return validate2(address2 + amount);
    },
    toOutputOffset(address2) {
      return Number.isInteger(address2) && address2 >= origin && address2 <= 65535 ? address2 - origin : -1;
    },
    fromOutputOffset(offset) {
      const address2 = origin + offset;
      return Number.isInteger(offset) && offset >= 0 && address2 <= 65535 ? address2 : -1;
    },
    validateWrite(address2, width) {
      validate2(address2);
      validate2(address2 + width - 1);
      if (address2 < origin) {
        throw new Error(
          `Address $${address2.toString(16).toUpperCase()} precedes raw origin $${origin.toString(16).toUpperCase()}.`
        );
      }
    }
  };
}
function updatePredicates(session, architecture) {
  for (const symbol of new Set(Object.values(ca65CpuPredicateByArchitecture))) {
    session.globalSymbols.add(symbol);
    session.labelTable.set(symbol, {
      value: ca65CpuPredicateByArchitecture[architecture] === symbol ? 1 : 0,
      isStatic: true
    });
  }
}
function register65xxContributions(context) {
  for (const [cpu, forms] of [
    [nmos6502Cpu, nmos6502Forms],
    [nmos6502xCpu, nmos6502xForms],
    [ricoh2a03Cpu, nmos6502xForms],
    ...variantCpus.map(
      (variantCpu) => [variantCpu, variantFormsByCpuId[variantCpu.id] ?? []]
    )
  ]) {
    const catalog = buildInstructionCatalog(forms);
    context.registerArchitecture({
      id: cpu.id,
      aliases: cpu.aliases,
      displayName: cpu.displayName,
      unknownInstructionBehavior: "throw",
      // Same as 65816: `LDA $12,x` is one operand, not two.
      splitOperands: (text) => text.trim() ? [text.trim()] : [],
      classifyOperand: ({ operands }, operand) => classify65xxOperand(operands, operand),
      createEncoder: (encoderContext) => new Arch65xx(encoderContext, cpu),
      // Vendor/CMOS tables have different semantics; expose the decoder only for NMOS/Ricoh profiles.
      createDecoder: cpu.features.has("nmos") && !cpu.features.has("dtv") ? () => new Cpu6502Decoder(cpu) : void 0,
      instructionSpecifications: cpu.features.has("nmos") && !cpu.features.has("dtv") ? cpu6502Specifications(cpu) : void 0,
      instructions: catalog
    });
  }
  context.registerAddressSpace({
    id: FLAT_65XX_ADDRESS_SPACE_ID,
    create: createFlat65xxAddressSpace
  });
  context.registerOutputFormat({
    id: RAW_65XX_OUTPUT_FORMAT_ID,
    // Emit the buffer as a headerless image, without checksum or padding.
    create: () => ({
      finalize: () => void 0,
      getOutput: ({ outputBytes }) => Uint8Array.from(outputBytes)
    })
  });
  context.registerLifecycle({
    id: RAW_65XX_LIFECYCLE_ID,
    create: ({ options }) => {
      const { origin } = createRaw65xxTargetOptions(options);
      return {
        onStageStart: ({ session }) => {
          session.setWritePosition(origin);
          session.bytes = 0;
        }
      };
    }
  });
  context.registerTarget({
    id: RAW_65XX_TARGET_ID,
    aliases: ["65xx", "6502-raw"],
    displayName: "65xx flat 16-bit raw binary",
    defaultArchitecture: nmos6502Cpu.id,
    architectures: [
      nmos6502Cpu.id,
      nmos6502xCpu.id,
      ricoh2a03Cpu.id,
      ...variantCpus.map((cpu) => cpu.id)
    ],
    addressSpace: FLAT_65XX_ADDRESS_SPACE_ID,
    outputFormat: RAW_65XX_OUTPUT_FORMAT_ID,
    directiveSets: [],
    expressionSets: [],
    lifecycle: [RAW_65XX_LIFECYCLE_ID],
    syntaxProfile: NATIVE_SYNTAX_PROFILE,
    defaultOutputExtension: ".bin",
    createOptions: createRaw65xxTargetOptions
  });
  context.registerSessionState({
    id: CA65_65XX_SESSION_STATE_ID,
    create: createCa65SessionState,
    clone: cloneCa65SessionState,
    resetForStage: resetCa65StageState
  });
  context.registerExpressionSet({
    id: CA65_65XX_EXPRESSION_SET_ID,
    functions: ca65ExpressionFunctions.map(([name, summary, transform]) => ({
      name,
      signature: { parameters: ["value"], minimumArguments: 1, maximumArguments: 1 },
      summary,
      evaluate: (_expressionContext, args) => {
        const value = args[0];
        if (typeof value !== "number") {
          throw new Error(`${name}() expects a numeric argument.`);
        }
        return transform(value);
      }
    }))
  });
  context.registerLifecycle({
    id: CA65_65XX_LIFECYCLE_ID,
    create: () => {
      return {
        onSessionCreated: ({ session, state }) => {
          const profile = state.get(ca65SessionStateKey);
          profile.defaultArchitecture = session.resolveActiveArchitecture().name;
          profile.currentArchitecture = profile.defaultArchitecture;
          updatePredicates(session, profile.defaultArchitecture);
        },
        onStageStart: ({ session, state }) => {
          const profile = state.get(ca65SessionStateKey);
          session.selectArchitecture(profile.defaultArchitecture, profile.defaultArchitecture);
        },
        onArchitectureSelected: ({ session, state, architecture }) => {
          const profile = state.get(ca65SessionStateKey);
          profile.currentArchitecture = architecture;
          updatePredicates(session, architecture);
        }
      };
    }
  });
  context.registerTarget({
    id: CA65_RAW_65XX_TARGET_ID,
    aliases: ["ca65-raw"],
    displayName: "65xx ca65-compatible flat 16-bit raw binary",
    defaultArchitecture: nmos6502Cpu.id,
    architectures: [
      nmos6502Cpu.id,
      nmos6502xCpu.id,
      ricoh2a03Cpu.id,
      ...variantCpus.map((cpu) => cpu.id)
    ],
    addressSpace: FLAT_65XX_ADDRESS_SPACE_ID,
    outputFormat: RAW_65XX_OUTPUT_FORMAT_ID,
    directiveSets: [CA65_65XX_DIRECTIVE_SET_ID],
    expressionSets: [CA65_65XX_EXPRESSION_SET_ID],
    lifecycle: [RAW_65XX_LIFECYCLE_ID, CA65_65XX_LIFECYCLE_ID],
    syntaxProfile: CA65_65XX_SYNTAX_PROFILE,
    defaultOutputExtension: ".bin",
    createOptions: createRaw65xxTargetOptions
  });
  context.registerSessionState({
    id: NES_65XX_SESSION_STATE_ID,
    create: createInitialNesState,
    clone: cloneNes65xxSessionState,
    resetForStage: resetNes65xxStageState
  });
  context.registerAddressSpace({
    id: NES_65XX_ADDRESS_SPACE_ID,
    create: createNesAddressSpace
  });
  context.registerOutputFormat({
    id: NES_65XX_OUTPUT_FORMAT_ID,
    create: createNesOutputFormat
  });
  context.registerLifecycle({
    id: NES_65XX_LIFECYCLE_ID,
    create: createNesLifecycle
  });
  context.registerDirectiveSet({
    id: CA65_65XX_DIRECTIVE_SET_ID,
    directives: [
      directive(
        "65xx.directive.segment",
        ["segment"],
        ({ targetId, session, state }) => (_ctx, words) => {
          if (targetId === NES_65XX_TARGET_ID) {
            handleSegment(session, state.get(nes65xxSessionStateKey), words);
          } else {
            handleFlatSegment(state.get(ca65SessionStateKey), words);
          }
        }
      ),
      directive(
        "65xx.directive.setcpu",
        ["setcpu", "cpu"],
        ({ session, state }) => (_ctx, words) => handleSetcpu(session, state.get(ca65SessionStateKey), words)
      ),
      directive(
        "65xx.directive.pushcpu",
        ["pushcpu"],
        ({ session, state }) => () => handlePushcpu(session, state.get(ca65SessionStateKey))
      ),
      directive(
        "65xx.directive.popcpu",
        ["popcpu"],
        ({ session, state }) => () => handlePopcpu(session, state.get(ca65SessionStateKey))
      ),
      directive(
        "65xx.directive.cpu-shorthand",
        Object.keys(ca65CpuShorthands),
        ({ session, state }) => (_ctx, words) => handleCpuShorthand(session, state.get(ca65SessionStateKey), words)
      ),
      directive(
        "65xx.directive.export",
        ["export"],
        ({ session }) => (_ctx, words) => handleExport(session, words)
      ),
      directive(
        "65xx.directive.import",
        ["import"],
        ({ session }) => (_ctx, words) => handleImport(session, words)
      ),
      directive(
        "65xx.directive.byte",
        ["byte", "byt"],
        ({ session }) => (_ctx, words) => handleByte(session, words)
      ),
      directive(
        "65xx.directive.addr",
        ["addr", "word"],
        ({ session }) => (_ctx, words) => handleAddr(session, words)
      ),
      directive(
        "65xx.directive.lobytes",
        ["lobytes"],
        ({ session }) => (_ctx, words) => handleLobytes(session, words)
      ),
      directive(
        "65xx.directive.hibytes",
        ["hibytes"],
        ({ session }) => (_ctx, words) => handleHibytes(session, words)
      ),
      directive(
        "65xx.directive.dbyt",
        ["dbyt"],
        ({ session }) => (_ctx, words) => handleDbyt(session, words)
      ),
      directive(
        "65xx.directive.dword",
        ["dword"],
        ({ session }) => (_ctx, words) => handleDword(session, words)
      ),
      directive(
        "65xx.directive.faraddr",
        ["faraddr"],
        ({ session }) => (_ctx, words) => handleDword(session, words, 3)
      ),
      directive(
        "65xx.directive.res",
        ["res"],
        ({ session }) => (_ctx, words) => handleRes(session, words)
      ),
      directive(
        "65xx.directive.align",
        ["align"],
        ({ session }) => (_ctx, words) => handleAlign(session, words)
      ),
      directive(
        "65xx.directive.incbin",
        ["incbin"],
        ({ session }) => (_ctx, words) => handleCa65Incbin(session, words)
      ),
      directive(
        "65xx.directive.assert",
        ["assert"],
        ({ session }) => (_ctx, words) => handleCa65Assert(session, words)
      ),
      directive(
        "65xx.directive.scope",
        ["scope", "proc"],
        ({ session, state }) => (_ctx, words) => handleScope(
          session,
          state.get(ca65SessionStateKey),
          words,
          (words[0] ?? "").replace(/^\./, "").toLowerCase() === "proc"
        )
      ),
      directive(
        "65xx.directive.endscope",
        ["endscope", "endproc"],
        ({ session, state }) => () => handleEndScope(session, state.get(ca65SessionStateKey))
      ),
      directive(
        "65xx.directive.pushseg",
        ["pushseg"],
        ({ state }) => () => handlePushseg(state.get(ca65SessionStateKey))
      ),
      directive(
        "65xx.directive.popseg",
        ["popseg"],
        ({ state }) => () => handlePopseg(state.get(ca65SessionStateKey))
      ),
      directive(
        "65xx.directive.unsupported-object",
        [
          "autoimport",
          "constructor",
          "debuginfo",
          "destructor",
          "exportzp",
          "forceimport",
          "globalzp",
          "importzp",
          "interruptor",
          "reloc"
        ],
        () => (_ctx, words) => handleUnsupportedCa65(words)
      ),
      directive("65xx.directive.unsupported-macro", ["exitmacro", "local"], () => (_ctx, words) => {
        throw new Error(
          `.${(words[0] ?? "").replace(/^\./, "")} is not yet supported by the ca65 macro compatibility slice.`
        );
      })
    ],
    tooling: ca65Tooling
  });
  context.registerTarget({
    id: NES_65XX_TARGET_ID,
    aliases: ["nes", "ines", "6502-nes"],
    displayName: "NES iNES (ca65 / ld65 layout)",
    defaultArchitecture: nmos6502Cpu.id,
    architectures: [
      nmos6502Cpu.id,
      nmos6502xCpu.id,
      ricoh2a03Cpu.id,
      ...variantCpus.map((cpu) => cpu.id)
    ],
    addressSpace: NES_65XX_ADDRESS_SPACE_ID,
    outputFormat: NES_65XX_OUTPUT_FORMAT_ID,
    directiveSets: [CA65_65XX_DIRECTIVE_SET_ID],
    expressionSets: [CA65_65XX_EXPRESSION_SET_ID],
    lifecycle: [NES_65XX_LIFECYCLE_ID, CA65_65XX_LIFECYCLE_ID],
    syntaxProfile: CA65_65XX_SYNTAX_PROFILE,
    defaultOutputExtension: ".nes",
    createOptions: createNes65xxTargetOptions
  });
}
function validate65xxPluginOptions(configured) {
  if (configured && typeof configured === "object" && !Array.isArray(configured) && ("header" in configured || "linkerConfig" in configured || "fillByte" in configured)) {
    const unknown = Object.keys(configured).filter(
      (key) => !["header", "linkerConfig", "fillByte"].includes(key)
    );
    if (unknown.length) throw new Error(`Unknown NES target option(s): ${unknown.join(", ")}.`);
    createNes65xxTargetOptions(configured);
    return { ...configured };
  }
  return createRaw65xxTargetOptions(configured);
}
var plugin = definePlugin({
  manifest: {
    id: "uttori.asm-plugin-65xx",
    name: "Uttori ASM 65xx",
    version: "1.0.0",
    apiVersion: PLUGIN_API_VERSION,
    description: "65xx NMOS, CMOS, Commodore, MEGA65, Hudson, and Mitsubishi architectures with raw and NES iNES targets."
  },
  validateOptions: validate65xxPluginOptions,
  activate: register65xxContributions
});

// packages/plugin-snes/src/architectures/65816-spec.ts
var mode = (id, syntax2, minimumSize, maximumSize = minimumSize, widthFlag) => ({
  id,
  syntax: syntax2,
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
var summaries2 = {
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
      summary: summaries2[mnemonic] ?? `${mnemonic} instruction.`,
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
var hex2 = (value, width) => `$${(value >>> 0).toString(16).toUpperCase().padStart(width * 2, "0").slice(-width * 2)}`;
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
      text = `#${hex2(value, 1)}`;
      break;
    case "immediate":
      text = `#${hex2(value, operand?.width ?? 1)}`;
      break;
    case "immediate16":
      text = hex2(value, 2);
      break;
    case "direct":
      text = hex2(value, 1);
      break;
    case "directIndexedX":
      text = `${hex2(value, 1)},x`;
      break;
    case "directIndexedY":
      text = `${hex2(value, 1)},y`;
      break;
    case "directIndirect":
      text = instruction.mnemonic === "PEI" ? hex2(value, 1) : `(${hex2(value, 1)})`;
      break;
    case "directIndirectLong":
      text = `[${hex2(value, 1)}]`;
      break;
    case "directIndexedXIndirect":
      text = `(${hex2(value, 1)},x)`;
      break;
    case "directIndirectIndexedY":
      text = `(${hex2(value, 1)}),y`;
      break;
    case "directIndirectLongIndexedY":
      text = `[${hex2(value, 1)}],y`;
      break;
    case "stackRelative":
      text = `${hex2(value, 1)},s`;
      break;
    case "stackRelativeIndirectIndexedY":
      text = `(${hex2(value, 1)},s),y`;
      break;
    case "absolute":
      text = hex2(value, 2);
      break;
    case "absoluteIndexedX":
      text = `${hex2(value, 2)},x`;
      break;
    case "absoluteIndexedY":
      text = `${hex2(value, 2)},y`;
      break;
    case "absoluteLong":
      text = hex2(value, 3);
      break;
    case "absoluteLongIndexedX":
      text = `${hex2(value, 3)},x`;
      break;
    case "absoluteIndirect":
      text = `(${hex2(value, 2)})`;
      break;
    case "absoluteIndexedXIndirect":
      text = `(${hex2(value, 2)},x)`;
      break;
    case "absoluteIndirectLong":
      text = `[${hex2(value, 2)}]`;
      break;
    case "relative":
      text = hex2(operand?.targetAddress ?? 0, 3);
      break;
    case "relativeLong":
      text = instruction.mnemonic === "PER" ? hex2(value, 2) : hex2(operand?.targetAddress ?? 0, 3);
      break;
    case "blockMove":
      text = `${hex2(instruction.operands[0]?.value ?? 0, 1)},${hex2(instruction.operands[1]?.value ?? 0, 1)}`;
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
var ARES_NES_CAPABILITIES = Object.freeze({
  ...ARES_RSP_CAPABILITIES,
  architectures: [
    {
      architecture: "65xx.2a03",
      addressSpaces: [
        "nes.cpu",
        "nes.ram",
        "nes.prg-rom",
        "nes.chr-rom",
        "nes.prg-ram",
        "nes.ppu-snapshot",
        "nes.chr-ram"
      ],
      memorySpaces: [
        "nes.ram",
        "nes.prg-rom",
        "nes.chr-rom",
        "nes.prg-ram",
        "nes.ppu-snapshot",
        "nes.chr-ram",
        "nes.cpu"
      ].map((addressSpace) => ({ addressSpace, sideEffectFree: true })),
      trace: {
        addressSpaces: ["nes.cpu"],
        maxBufferedEvents: ARES_TRACE_BUFFER_EVENTS,
        maxBatchEvents: ARES_TRACE_BATCH_EVENTS,
        instructionDetails: true
      },
      pause: true,
      step: true,
      stepKinds: ARES_STEP_KINDS,
      registers: true,
      memory: true,
      stackFrames: true,
      breakpoints: true,
      disassemble: true
    }
  ]
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
  const rows2 = match[5] === "" ? [] : match[5].split(";");
  if (rows2.length && rows2.pop() !== "") {
    throw new Error("Rich trace row is unterminated.");
  }
  if (rows2.length > maximum || rows2.length > 240) {
    throw new Error("Rich trace exceeds the requested batch limit.");
  }
  const addresses2 = [];
  const details = rows2.map((row) => {
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
var littleEndian = (hex3) => {
  const bytes = hex3.match(/../g);
  if (!bytes || bytes.join("") !== hex3) {
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
  #nes = false;
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
    if (this.#nes) {
      return ARES_NES_CAPABILITIES;
    }
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
  #nesPrgFileOffset;
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
    this.#nesPrgFileOffset = options.nesPrgFileOffset ?? 16;
    if (![16, 528].includes(this.#nesPrgFileOffset)) {
      throw new Error("Invalid iNES PRG file offset.");
    }
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
      this.#nes = target.includes("dev.ares.ricoh2a03.core");
      const registerNames = this.#nes ? ["a", "x", "y", "s", "pc", "p"] : ["a", "x", "y", "s", "d", "db", "pb", "pc", "p", "e"];
      for (const register of registerNames) {
        if (!target.includes(`name="${register}"`)) {
          throw new Error(`ares RSP target description is missing register '${register}'.`);
        }
      }
      this.#richTrace = !this.#nes && supported.includes("uttoriInstructionDetails+") && supported.includes("uttoriSramMemory+") && supported.includes("uttoriAramMemory+");
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
      {
        id: ARES_65816_THREAD_ID,
        name: "Main CPU",
        architecture: this.#nes ? "65xx.2a03" : ARES_65816_ARCHITECTURE
      }
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
        name: this.#nes ? "Ricoh 2A03" : "65816",
        pc: await this.#currentAddress(logicalPc(registers)),
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
    if (this.#nes) {
      return ["a", "x", "y", "s", "p", "pc"].map((name) => {
        const bits = name === "pc" ? 16 : 8;
        return {
          name: name.toUpperCase(),
          value: registerHex(registers[name], bits),
          bits,
          group: "CPU"
        };
      });
    }
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
    let checked;
    if (this.#nes) {
      if (address2.architecture !== "65xx.2a03" || ![
        "nes.cpu",
        "nes.ram",
        "nes.prg-rom",
        "nes.chr-rom",
        "nes.prg-ram",
        "nes.ppu-snapshot",
        "nes.chr-ram"
      ].includes(address2.addressSpace)) {
        throw new Error("Unsupported NES memory address.");
      }
      checked = { ...address2 };
    } else {
      checked = extra ? { ...address2 } : checkedMemoryAddress(address2, "Memory request");
    }
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
    const requested = addresses2.map((entry, index) => {
      if (!this.#nes) {
        return checkedAddress(entry, `Breakpoint ${index}`);
      }
      if (entry.architecture !== "65xx.2a03" || !["nes.cpu", "65xx.ines-address-space"].includes(entry.addressSpace)) {
        throw new Error("Unsupported NES breakpoint address.");
      }
      checkedInteger(entry.address, "NES CPU address", 65535);
      if (entry.outputOffset !== void 0) {
        checkedInteger(entry.outputOffset, "NES output offset", 524816);
        if (entry.outputOffset < this.#nesPrgFileOffset) {
          throw new Error("A cartridge header is not executable.");
        }
        return {
          ...entry,
          address: 4294967296 + (entry.outputOffset - this.#nesPrgFileOffset) * 65536 + entry.address
        };
      }
      return entry;
    });
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
    for (const [index, value] of requested.entries()) {
      const existing = this.#breakpoints.get(value.address);
      if (existing) {
        results.push(existing);
        continue;
      }
      const response = await client.request(`Z0,${value.address.toString(16)},1`);
      const breakpoint = {
        id: this.#nextBreakpointId++,
        address: addresses2[index],
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
    if (this.#nes) {
      if (address2.architecture !== "65xx.2a03" || address2.addressSpace !== "nes.cpu") {
        throw new Error("Unsupported NES disassembly address.");
      }
      checkedInteger(address2.address, "NES PC", 65535);
      checkedInteger(count, "Disassembly count", 4096);
      const decoder = new Cpu6502Decoder(ricoh2a03Cpu);
      const instructions2 = [];
      let pc = address2.address;
      for (let index = 0; index < count; index++) {
        const memory = await this.#readCpuBus(pc, Math.min(3, 65536 - pc));
        if (!memory) {
          break;
        }
        const decoded2 = decoder.decode({
          source: new Uint8ArrayDecoderSource(memory),
          offset: 0,
          logicalAddress: pc
        });
        if (decoded2.kind !== "instruction") {
          break;
        }
        instructions2.push({
          address: this.#address(pc),
          bytes: [...decoded2.instruction.bytes],
          text: formatCpu6502Instruction(decoded2.instruction)
        });
        pc = pc + decoded2.instruction.size & 65535;
      }
      return instructions2;
    }
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
      const decoded2 = this.#decoder.decode({
        source: new Uint8ArrayDecoderSource(memory),
        offset: 0,
        logicalAddress: current,
        state: { ...state, programBank: current >>> 16 }
      });
      if (decoded2.kind !== "instruction") {
        throw new Error(
          decoded2.kind === "ambiguous" ? decoded2.reason : `65816 decode failed: ${decoded2.message}`
        );
      }
      instructions.push({
        address: this.#address(current),
        bytes: [...decoded2.instruction.bytes],
        text: formatCpu65816Instruction(decoded2.instruction)
      });
      current = current + decoded2.instruction.size & 16777215;
    }
    return instructions;
  }
  /** @inheritdoc */
  async capture(request) {
    validateCaptureRequest(request);
    const client = this.#requireConnected();
    if ("scope" in request && request.scope && this.#nes && request.scope !== "nes.2a03.instructions" && request.scope !== "nes.cpu-bus-ppu") {
      throw new Error("Famicom supports NES instruction and PPU bus capture scopes.");
    }
    if (!this.#nes && "scope" in request && (request.scope === "nes.2a03.instructions" || request.scope === "nes.cpu-bus-ppu")) {
      throw new Error("NES capture requires a Famicom runtime.");
    }
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
        if (request.romContentSha256 !== identity.romSha256 || this.#nes && (!request.romFileSha256 || request.romFileSha256 !== identity.romFileSha256) || request.producer.id !== "ares" || request.producer.revision !== identity.executableSha256 && request.producer.revision !== identity.producerRevision) {
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
        if (this.#nes) {
          fields2.push(encode(request.romFileSha256));
        }
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
      const scope = negotiation2 ? request.scope ?? this.#instructionScope() : this.#captureScope;
      const scopes = {
        "snes.65816.instructions": "instructions",
        "nes.2a03.instructions": "instructions",
        "nes.cpu-bus-ppu": "bus-ppu",
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
        if (request.romContentSha256 !== identity.romSha256 || this.#nes && (!request.romFileSha256 || request.romFileSha256 !== identity.romFileSha256) || request.producer.id !== "ares" || request.producer.revision !== identity.executableSha256 && request.producer.revision !== identity.producerRevision) {
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
        if (this.#nes) {
          if (!request.romFileSha256) {
            throw new Error("NES capture requires a verified full cartridge identity.");
          }
          fields2.push(request.romFileSha256);
        }
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
    const requestedScope = negotiation ? request.scope ?? this.#instructionScope() : void 0;
    const ppu = requestedScope === "snes.cpu-bus-ppu" || requestedScope === "nes.cpu-bus-ppu";
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
  #instructionScope() {
    return this.#nes ? "nes.2a03.instructions" : "snes.65816.instructions";
  }
  async #registerSnapshot() {
    const packet = await this.#requireStopped().request("g");
    if (!this.#nes) {
      return parseRegisters(packet);
    }
    if (!/^[\da-f]{14}$/i.test(packet)) {
      throw new Error("Expected seven bytes of Ricoh CPU registers.");
    }
    const b = Buffer.from(packet, "hex");
    return {
      a: b[0],
      x: b[1],
      y: b[2],
      s: b[3],
      p: b[4],
      pc: b.readUInt16LE(5),
      d: 0,
      db: 0,
      pb: 0,
      e: 1
    };
  }
  /** A stopped PC carries its physical PRG identity so identical bank windows resolve correctly. */
  async #currentAddress(pc) {
    if (!this.#nes) {
      return this.#address(pc);
    }
    const packet = await this.#requireStopped().request("qUttoriMemoryRead:nes.mapping:0,16");
    if (!/^[\da-f]{44}$/i.test(packet)) {
      throw new Error("Missing Famicom mapping snapshot.");
    }
    const offset = Buffer.from(packet, "hex").readUInt32LE(18);
    return {
      ...this.#address(pc),
      ...offset === 4294967295 ? {} : { outputOffset: offset + this.#nesPrgFileOffset }
    };
  }
  #address(address2) {
    return {
      architecture: this.#nes ? "65xx.2a03" : ARES_65816_ARCHITECTURE,
      addressSpace: this.#nes ? "nes.cpu" : ARES_65816_ADDRESS_SPACE,
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
            let text = "Capture replay diverged from the retained input timing or final machine state. Execution is paused.\n";
            if (status === "idle") {
              const checked = this.#nes ? "CPU/APU/PPU/mapper/controller state" : "WRAM";
              text = `Capture replay reached the recorded endpoint; ${checked} and input consumption match.
`;
            }
            this.#emit({
              type: "output",
              category: status === "idle" ? "console" : "stderr",
              text
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
var optionNames = /* @__PURE__ */ new Set([
  "--manifest",
  "--ares",
  "--rom",
  "--rom-sha256",
  "--runtime-dir",
  "--system"
]);
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
  const manifest = {
    ...runtimeManifest,
    romSha256: options.romSha256 ?? runtimeManifest.romSha256
  };
  const host = new AresProcessHost({
    executable: options.executable,
    rom: options.rom,
    runtimeDirectory: options.runtimeDirectory,
    manifest,
    system: options.system,
    fastBoot: options.fastBoot
  });
  let contentSha256 = manifest.romSha256;
  let nesPrgFileOffset;
  if (/^(Famicom|NES|FC)$/i.test(options.system ?? "")) {
    const romBytes = await readFile2(options.rom);
    if (!romBytes.subarray(0, 4).equals(Buffer.from([78, 69, 83, 26])))
      throw new Error("Famicom launch requires an iNES cartridge.");
    nesPrgFileOffset = 16 + (romBytes[6] & 4 ? 512 : 0);
    contentSha256 = createHash3("sha256").update(romBytes.subarray(16)).digest("hex");
  }
  const backend = new AresRspDebugBackend({
    nesPrgFileOffset,
    createClient: (connect) => host.createClient(connect),
    nativeFileIdentity: {
      romSha256: contentSha256,
      romFileSha256: manifest.romSha256,
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

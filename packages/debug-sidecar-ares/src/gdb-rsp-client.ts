import type { DebugSubscription } from "@uttori/asm-debug-adapter";

/** Byte transport used by the GDB Remote Serial Protocol client. */
export interface GdbRspTransport {
  write(data: Uint8Array): Promise<void>;
  close(): Promise<void>;
  onData(listener: (data: Uint8Array) => void): DebugSubscription;
  onClose(listener: (error?: Error) => void): DebugSubscription;
}

/** Parsed stop notification from an RSP `S` or `T` packet. */
export interface GdbRspStop {
  /** The signal number that caused the stop. */
  readonly signal: number;
  /** The payload of the stop notification. */
  readonly payload: string;
}

/** Bounds and deadlines for one RSP client. */
export interface GdbRspClientOptions {
  /** The transport to use for the RSP client. */
  readonly transport: GdbRspTransport;
  /** The timeout for RSP requests. */
  readonly requestTimeoutMs?: number;
  /** The maximum size of an RSP packet. */
  readonly maxPacketBytes?: number;
  /** The maximum size of the RSP receive buffer. */
  readonly maxBufferedBytes?: number;
}

interface PendingResponse {
  /** Whether the response should be accepted as a stop notification. */
  readonly acceptStop: boolean;
  /** The function to call when the response is resolved. */
  readonly resolve: (payload: string) => void;
  /** The function to call when the response is rejected. */
  readonly reject: (error: Error) => void;
  /** The timer for the request timeout. */
  readonly timer: ReturnType<typeof setTimeout>;
}

/**
 * Convert an unknown error to an Error.
 * @param {unknown} error The error to convert.
 * @returns {Error} The converted error.
 */
const asError = (error: unknown): Error =>
  error instanceof Error ? error : new Error(String(error));

/**
 * Calculate the checksum of an RSP payload.
 * @param {Uint8Array} payload The payload to calculate the checksum for.
 * @returns {number} The checksum of the payload.
 */
const checksum = (payload: Uint8Array): number => {
  let value = 0;
  // Indexed access avoids the byte iterator's overhead on large capture replies.
  // oxlint-disable-next-line typescript/prefer-for-of
  for (let index = 0; index < payload.length; index++) {
    value = (value + payload[index]) & 0xff;
  }
  return value;
};

/**
 * Encode RSP payload as a sequence of escaped bytes.
 * @param {string} payload The payload to escape.
 * @returns {Uint8Array} The escaped payload.
 * @throws {Error} If the payload contains a control character.
 */
const escapedPayload = (payload: string): Uint8Array => {
  const result: number[] = [];
  for (const byte of Buffer.from(payload, "ascii")) {
    if (byte === 0x23 || byte === 0x24 || byte === 0x2a || byte === 0x7d) {
      result.push(0x7d, byte ^ 0x20);
    } else {
      result.push(byte);
    }
  }
  return Uint8Array.from(result);
};

/**
 * Decode wire escapes without allocating a number array for large hex capture replies.
 * @param {Buffer} payload Checked wire payload. This view is valid only during receive processing.
 * @returns {string} Owned ASCII response. Unescaped RLE or a truncated escape throws.
 */
const unescapePayload = (payload: Buffer): string => {
  // Capture replies contain only hexadecimal ASCII. Decode that common case directly.
  // escaped control replies still need the byte walk to distinguish escaped literal '*'.
  if (!payload.includes(0x7d)) {
    if (payload.includes(0x2a))
      {throw new Error("RSP run-length encoded payloads are not supported on the ares channel.");}
    return payload.toString("ascii");
  }
  const result = Buffer.allocUnsafe(payload.length);
  let length = 0;
  for (let index = 0; index < payload.length; index++) {
    const byte = payload[index];
    if (byte === 0x2a)
      {throw new Error("RSP run-length encoded payloads are not supported on the ares channel.");}
    if (byte !== 0x7d) {
      result[length++] = byte;
      continue;
    }
    ++index;
    const escaped = index < payload.length ? payload[index] : undefined;
    if (escaped === undefined) {throw new Error("RSP payload ends inside an escape sequence.");}
    result[length++] = escaped ^ 0x20;
  }
  return result.toString("ascii", 0, length);
};

/**
 * Parse exactly one ASCII checksum digit. Unlike parseInt, invalid suffixes cannot be ignored.
 * @param {number} byte Raw wire byte, without ASCII high-bit masking.
 * @returns {number} Nibble value, or -1 for any non-hexadecimal byte.
 */
const hexDigit = (byte: number): number => {
  if (byte >= 0x30 && byte <= 0x39) {return byte - 0x30;}
  if (byte >= 0x41 && byte <= 0x46) {return byte - 0x41 + 10;}
  if (byte >= 0x61 && byte <= 0x66) {return byte - 0x61 + 10;}
  return -1;
};

const stop = (payload: string): GdbRspStop | undefined => {
  if (!/^[ST][\dA-Fa-f]{2}/.test(payload)) {return undefined;}
  return { signal: Number.parseInt(payload.slice(1, 3), 16), payload };
};

/** Strict, single-flight RSP client for the private ares control channel. */
export class GdbRspClient {
  readonly #transport: GdbRspTransport;
  readonly #requestTimeoutMs: number;
  readonly #maxPacketBytes: number;
  readonly #maxBufferedBytes: number;
  readonly #stopListeners = new Set<(event: GdbRspStop) => void>();
  readonly #closeListeners = new Set<(error: Error) => void>();
  readonly #dataSubscription: DebugSubscription;
  readonly #closeSubscription: DebugSubscription;
  #buffer = Buffer.alloc(0);
  /** Unconsumed bytes occupy [start, end). Capacity grows geometrically within the receive bound. */
  #start = 0;
  #end = 0;
  /** First unchecked position for '#', or the delimiter while awaiting checksum bytes. */
  #scan = 1;
  #pending: PendingResponse | undefined;
  #writeTail: Promise<void> = Promise.resolve();
  #started = false;
  #closed = false;
  #closeError: Error | undefined;

  /** @param {GdbRspClientOptions} options Transport and protocol safety bounds. */
  constructor(options: GdbRspClientOptions) {
    this.#transport = options.transport;
    this.#requestTimeoutMs = options.requestTimeoutMs ?? 3_000;
    this.#maxPacketBytes = options.maxPacketBytes ?? 1_048_576;
    this.#maxBufferedBytes = options.maxBufferedBytes ?? this.#maxPacketBytes * 2;
    for (const [name, value] of [
      ["RSP request timeout", this.#requestTimeoutMs],
      ["RSP maximum packet bytes", this.#maxPacketBytes],
      ["RSP maximum buffered bytes", this.#maxBufferedBytes],
    ] as const) {
      if (!Number.isSafeInteger(value) || value <= 0)
        {throw new Error(`${name} must be a positive safe integer.`);}
    }
    if (this.#maxBufferedBytes < this.#maxPacketBytes + 4)
      {throw new Error("RSP receive buffer must hold one maximum-sized framed packet.");}
    this.#dataSubscription = this.#transport.onData((data) => this.#receive(data));
    this.#closeSubscription = this.#transport.onClose((error) =>
      this.#fail(error ?? new Error("RSP transport closed."), false),
    );
  }

  /** @returns {boolean} Whether the client has permanently closed. */
  get closed(): boolean {
    return this.#closed;
  }

  /** @returns {Promise<void>} Completion after writing the required initial acknowledgement byte. */
  async start(): Promise<void> {
    if (this.#closed) {throw new Error("RSP client is closed.");}
    if (this.#started) {throw new Error("RSP client has already started.");}
    this.#started = true;
    await this.#write(Uint8Array.of(0x2b));
  }

  /**
   * Subscribes to asynchronous stop packets.
   * @param {(event: GdbRspStop) => void} listener Stop-event consumer.
   * @returns {DebugSubscription} Disposable subscription.
   */
  onStop(listener: (event: GdbRspStop) => void): DebugSubscription {
    this.#stopListeners.add(listener);
    return { dispose: () => this.#stopListeners.delete(listener) };
  }

  /**
   * Subscribes to terminal RSP transport or protocol failure.
   * @param {(error: Error) => void} listener Close-error consumer.
   * @returns {DebugSubscription} Disposable subscription.
   */
  onClose(listener: (error: Error) => void): DebugSubscription {
    if (this.#closeError) {
      queueMicrotask(() => listener(this.#closeError!));
      return { dispose: () => undefined };
    }
    this.#closeListeners.add(listener);
    return { dispose: () => this.#closeListeners.delete(listener) };
  }

  /**
   * Sends one packet and waits for its non-stop response.
   * @param {string} command RSP command payload.
   * @returns {Promise<string>} Response payload.
   */
  request(command: string): Promise<string> {
    return this.#request(command, false);
  }

  /**
   * Sends a handshake packet such as `?` whose response is itself a stop packet.
   * @param {string} command RSP command payload.
   * @returns {Promise<string>} Stop response payload.
   */
  requestStop(command: string): Promise<string> {
    return this.#request(command, true);
  }

  /** @returns {Promise<void>} Completion after writing continue. */
  continue(): Promise<void> {
    return this.#sendExecutionCommand("c");
  }

  /** @returns {Promise<void>} Completion after writing one-instruction step. */
  step(): Promise<void> {
    return this.#sendExecutionCommand("s");
  }

  /** @returns {Promise<void>} Completion after writing the out-of-band interrupt byte. */
  interrupt(): Promise<void> {
    this.#assertReady();
    if (this.#pending) {return Promise.reject(new Error("An RSP request is already pending."));}
    return this.#write(Uint8Array.of(0x03));
  }

  /** @returns {Promise<void>} Completion after closing the transport. */
  async close(): Promise<void> {
    if (this.#closed) {return;}
    this.#fail(new Error("RSP client closed."), false);
    await this.#transport.close();
  }

  #request(command: string, acceptStop: boolean): Promise<string> {
    try {
      this.#assertReady();
    } catch (error) {
      return Promise.reject(asError(error));
    }
    if (this.#pending) {return Promise.reject(new Error("An RSP request is already pending."));}
    let packet: Uint8Array;
    try {
      packet = this.#packet(command);
    } catch (error) {
      return Promise.reject(asError(error));
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => this.#fail(new Error(`RSP request '${command}' timed out.`)),
        this.#requestTimeoutMs,
      );
      this.#pending = { acceptStop, resolve, reject, timer };
      void this.#write(packet).catch((error: unknown) => this.#fail(asError(error)));
    });
  }

  #sendExecutionCommand(command: "c" | "s"): Promise<void> {
    this.#assertReady();
    if (this.#pending) {return Promise.reject(new Error("An RSP request is already pending."));}
    return this.#write(this.#packet(command));
  }

  #packet(command: string): Uint8Array {
    const payload = escapedPayload(command);
    if (payload.length > this.#maxPacketBytes)
      {throw new Error(`RSP payload exceeds ${this.#maxPacketBytes} bytes.`);}
    const sum = checksum(payload).toString(16).padStart(2, "0");
    return Buffer.concat([Buffer.from("$", "ascii"), payload, Buffer.from(`#${sum}`, "ascii")]);
  }

  #receive(data: Uint8Array): void {
    if (this.#closed) {return;}
    try {
      this.#append(data);
      while (this.#start < this.#end) {
        if (this.#buffer[this.#start] !== 0x24) {
          // ACK/NAK and out-of-packet noise do not form responses. Search only the
          // initialized region: retained capacity can contain old packet delimiters.
          const next = this.#buffer.subarray(this.#start, this.#end).indexOf(0x24);
          if (next < 0) {
            this.#start = this.#end;
            break;
          }
          this.#start += next;
          this.#scan = this.#start + 1;
        }
        const offset = this.#buffer.subarray(this.#scan, this.#end).indexOf(0x23);
        if (offset < 0) {
          this.#scan = this.#end;
          if (this.#end - this.#start - 1 > this.#maxPacketBytes)
            {throw new Error(`RSP packet exceeds ${this.#maxPacketBytes} bytes.`);}
          return;
        }
        const hash = this.#scan + offset;
        this.#scan = hash;
        if (hash - this.#start - 1 > this.#maxPacketBytes)
          {throw new Error(`RSP packet exceeds ${this.#maxPacketBytes} bytes.`);}
        if (this.#end < hash + 3) {return;}
        const payload = this.#buffer.subarray(this.#start + 1, hash);
        const high = hexDigit(this.#buffer[hash + 1]);
        const low = hexDigit(this.#buffer[hash + 2]);
        this.#start = hash + 3;
        this.#scan = this.#start + 1;
        if (high < 0 || low < 0 || ((high << 4) | low) !== checksum(payload)) {
          void this.#write(Uint8Array.of(0x2d)).catch((error: unknown) =>
            this.#fail(asError(error)),
          );
          continue;
        }
        void this.#write(Uint8Array.of(0x2b)).catch((error: unknown) => this.#fail(asError(error)));
        this.#deliver(unescapePayload(payload));
      }
      // Retain capacity for the next reply without retaining any consumed bytes as input.
      this.#start = this.#end = 0;
      this.#scan = 1;
    } catch (error) {
      this.#fail(asError(error));
    }
  }

  /** Append one owned transport fragment without repeatedly copying its accumulated prefix.
   * @param {Uint8Array} data Incoming bytes. The transport may reuse them after this call returns.
   * @returns {void} Grows/compacts only when tail capacity is exhausted. Exceeding the bound throws.
   */
  #append(data: Uint8Array): void {
    const used = this.#end - this.#start;
    const required = used + data.length;
    if (required > this.#maxBufferedBytes)
      {throw new Error(`RSP receive buffer exceeds ${this.#maxBufferedBytes} bytes.`);}
    if (this.#end + data.length > this.#buffer.length) {
      if (required > this.#buffer.length) {
        const capacity = Math.min(
          this.#maxBufferedBytes,
          Math.max(required, 4096, this.#buffer.length * 2),
        );
        const next = Buffer.allocUnsafe(capacity);
        this.#buffer.copy(next, 0, this.#start, this.#end);
        this.#buffer = next;
      } else {this.#buffer.copy(this.#buffer, 0, this.#start, this.#end);}
      this.#scan -= this.#start;
      this.#start = 0;
      this.#end = used;
    }
    this.#buffer.set(data, this.#end);
    this.#end += data.length;
  }

  #deliver(payload: string): void {
    const stopped = stop(payload);
    if (stopped && !this.#pending?.acceptStop) {
      for (const listener of this.#stopListeners) {listener(stopped);}
      return;
    }
    const pending = this.#pending;
    if (!pending) {throw new Error("RSP response arrived without a pending request.");}
    clearTimeout(pending.timer);
    this.#pending = undefined;
    pending.resolve(payload);
  }

  #assertReady(): void {
    if (this.#closed) {throw new Error("RSP client is closed.");}
    if (!this.#started) {throw new Error("RSP client has not started.");}
  }

  #write(data: Uint8Array): Promise<void> {
    const write = this.#writeTail.then(() => {
      if (this.#closed) {throw new Error("RSP client is closed.");}
      return this.#transport.write(data);
    });
    this.#writeTail = write.catch(() => undefined);
    return write;
  }

  #fail(error: Error, closeTransport = true): void {
    if (this.#closed) {return;}
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
      this.#pending = undefined;
    }
    this.#stopListeners.clear();
    for (const listener of this.#closeListeners) {listener(error);}
    this.#closeListeners.clear();
    if (closeTransport) {void this.#transport.close().catch(() => undefined);}
  }
}

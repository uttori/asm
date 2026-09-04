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
  readonly signal: number;
  readonly payload: string;
}

/** Bounds and deadlines for one RSP client. */
export interface GdbRspClientOptions {
  readonly transport: GdbRspTransport;
  readonly requestTimeoutMs?: number;
  readonly maxPacketBytes?: number;
  readonly maxBufferedBytes?: number;
}

interface PendingResponse {
  readonly acceptStop: boolean;
  readonly resolve: (payload: string) => void;
  readonly reject: (error: Error) => void;
  readonly timer: ReturnType<typeof setTimeout>;
}

const asError = (error: unknown): Error =>
  error instanceof Error ? error : new Error(String(error));

const checksum = (payload: Uint8Array): number => {
  let value = 0;
  for (const byte of payload) value = (value + byte) & 0xff;
  return value;
};

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

const unescapePayload = (payload: Uint8Array): string => {
  const result: number[] = [];
  for (let index = 0; index < payload.length; index++) {
    const byte = payload[index];
    if (byte === 0x2a)
      throw new Error("RSP run-length encoded payloads are not supported on the ares channel.");
    if (byte !== 0x7d) {
      result.push(byte);
      continue;
    }
    const escaped = payload[++index];
    if (escaped === undefined) throw new Error("RSP payload ends inside an escape sequence.");
    result.push(escaped ^ 0x20);
  }
  return Buffer.from(result).toString("ascii");
};

const stop = (payload: string): GdbRspStop | undefined => {
  if (!/^[ST][\dA-Fa-f]{2}/.test(payload)) return undefined;
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
        throw new Error(`${name} must be a positive safe integer.`);
    }
    if (this.#maxBufferedBytes < this.#maxPacketBytes + 4)
      throw new Error("RSP receive buffer must hold one maximum-sized framed packet.");
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
    if (this.#closed) throw new Error("RSP client is closed.");
    if (this.#started) throw new Error("RSP client has already started.");
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
    if (this.#pending) return Promise.reject(new Error("An RSP request is already pending."));
    return this.#write(Uint8Array.of(0x03));
  }

  /** @returns {Promise<void>} Completion after closing the transport. */
  async close(): Promise<void> {
    if (this.#closed) return;
    this.#fail(new Error("RSP client closed."), false);
    await this.#transport.close();
  }

  #request(command: string, acceptStop: boolean): Promise<string> {
    try {
      this.#assertReady();
    } catch (error) {
      return Promise.reject(asError(error));
    }
    if (this.#pending) return Promise.reject(new Error("An RSP request is already pending."));
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
    if (this.#pending) return Promise.reject(new Error("An RSP request is already pending."));
    return this.#write(this.#packet(command));
  }

  #packet(command: string): Uint8Array {
    const payload = escapedPayload(command);
    if (payload.length > this.#maxPacketBytes)
      throw new Error(`RSP payload exceeds ${this.#maxPacketBytes} bytes.`);
    const sum = checksum(payload).toString(16).padStart(2, "0");
    return Buffer.concat([Buffer.from("$", "ascii"), payload, Buffer.from(`#${sum}`, "ascii")]);
  }

  #receive(data: Uint8Array): void {
    if (this.#closed) return;
    try {
      if (this.#buffer.length + data.length > this.#maxBufferedBytes)
        throw new Error(`RSP receive buffer exceeds ${this.#maxBufferedBytes} bytes.`);
      this.#buffer = Buffer.concat([this.#buffer, data]);
      while (this.#buffer.length) {
        const first = this.#buffer[0];
        if (first === 0x2b || first === 0x2d) {
          this.#buffer = this.#buffer.subarray(1);
          continue;
        }
        if (first !== 0x24) {
          this.#buffer = this.#buffer.subarray(1);
          continue;
        }
        const hash = this.#buffer.indexOf(0x23, 1);
        if (hash < 0) {
          if (this.#buffer.length > this.#maxPacketBytes + 4)
            throw new Error(`RSP packet exceeds ${this.#maxPacketBytes} bytes.`);
          return;
        }
        if (hash - 1 > this.#maxPacketBytes)
          throw new Error(`RSP packet exceeds ${this.#maxPacketBytes} bytes.`);
        if (this.#buffer.length < hash + 3) return;
        const payload = this.#buffer.subarray(1, hash);
        const expected = Number.parseInt(
          this.#buffer.subarray(hash + 1, hash + 3).toString("ascii"),
          16,
        );
        this.#buffer = this.#buffer.subarray(hash + 3);
        if (!Number.isInteger(expected) || expected !== checksum(payload)) {
          void this.#write(Uint8Array.of(0x2d)).catch((error: unknown) =>
            this.#fail(asError(error)),
          );
          continue;
        }
        void this.#write(Uint8Array.of(0x2b)).catch((error: unknown) => this.#fail(asError(error)));
        this.#deliver(unescapePayload(payload));
      }
    } catch (error) {
      this.#fail(asError(error));
    }
  }

  #deliver(payload: string): void {
    const stopped = stop(payload);
    if (stopped && !this.#pending?.acceptStop) {
      for (const listener of this.#stopListeners) listener(stopped);
      return;
    }
    const pending = this.#pending;
    if (!pending) throw new Error("RSP response arrived without a pending request.");
    clearTimeout(pending.timer);
    this.#pending = undefined;
    pending.resolve(payload);
  }

  #assertReady(): void {
    if (this.#closed) throw new Error("RSP client is closed.");
    if (!this.#started) throw new Error("RSP client has not started.");
  }

  #write(data: Uint8Array): Promise<void> {
    const write = this.#writeTail.then(() => {
      if (this.#closed) throw new Error("RSP client is closed.");
      return this.#transport.write(data);
    });
    this.#writeTail = write.catch(() => undefined);
    return write;
  }

  #fail(error: Error, closeTransport = true): void {
    if (this.#closed) return;
    this.#closed = true;
    this.#closeError = error;
    this.#dataSubscription.dispose();
    this.#closeSubscription.dispose();
    if (this.#pending) {
      clearTimeout(this.#pending.timer);
      this.#pending.reject(error);
      this.#pending = undefined;
    }
    this.#stopListeners.clear();
    for (const listener of this.#closeListeners) listener(error);
    this.#closeListeners.clear();
    if (closeTransport) void this.#transport.close().catch(() => undefined);
  }
}

import net from "node:net";

import type { DebugSubscription } from "@uttori/asm-debug-adapter";

import type { GdbRspTransport } from "./gdb-rsp-client.js";

/** Options for a private numeric-loopback RSP connection. */
export interface NodeTcpGdbRspTransportOptions {
  /** Connected only for numeric loopback; any other host is rejected. */
  readonly host?: string;
  /** Loopback TCP port owned by the sidecar GDB stub. */
  readonly port: number;
  /** Positive milliseconds to wait for the initial TCP connect. */
  readonly connectTimeoutMs?: number;
  /** Positive milliseconds to wait for graceful socket shutdown. */
  readonly shutdownTimeoutMs?: number;
}

/** Node TCP transport restricted to the sidecar-owned loopback GDB endpoint. */
export class NodeTcpGdbRspTransport implements GdbRspTransport {
  readonly #socket: net.Socket;
  readonly #shutdownTimeoutMs: number;
  readonly #dataListeners = new Set<(data: Uint8Array) => void>();
  readonly #closeListeners = new Set<(error?: Error) => void>();
  #terminalError: Error | undefined;
  #closed = false;
  #notified = false;

  private constructor(socket: net.Socket, shutdownTimeoutMs: number) {
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
   * @param options Loopback endpoint and deadlines.
   * @returns Connected transport.
   */
  static async connect(options: NodeTcpGdbRspTransportOptions): Promise<NodeTcpGdbRspTransport> {
    const host = options.host ?? "127.0.0.1";
    if (host !== "127.0.0.1" && host !== "::1") {
      throw new Error("RSP transport host must be a numeric loopback address.");
    }
    if (!Number.isSafeInteger(options.port) || options.port < 1 || options.port > 65_535) {
      throw new Error("RSP transport port must be an integer between 1 and 65535.");
    }
    const connectTimeoutMs = options.connectTimeoutMs ?? 3_000;
    const shutdownTimeoutMs = options.shutdownTimeoutMs ?? 1_000;
    for (const [name, value] of [
      ["RSP connect timeout", connectTimeoutMs],
      ["RSP shutdown timeout", shutdownTimeoutMs],
    ] as const) {
      if (!Number.isSafeInteger(value) || value <= 0) {
        throw new Error(`${name} must be a positive safe integer.`);
      }
    }

    const socket = new net.Socket();
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        socket.destroy();
        reject(new Error(`RSP connection to ${host}:${options.port} timed out.`));
      }, connectTimeoutMs);
      const cleanup = (): void => {
        clearTimeout(timeout);
        socket.off("connect", connected);
        socket.off("error", failed);
      };
      const connected = (): void => {
        cleanup();
        resolve();
      };
      const failed = (error: Error): void => {
        cleanup();
        socket.destroy();
        reject(error);
      };
      socket.once("connect", connected);
      socket.once("error", failed);
      socket.connect(options.port, host);
    });
    return new NodeTcpGdbRspTransport(socket, shutdownTimeoutMs);
  }

  /** @inheritdoc */
  write(data: Uint8Array): Promise<void> {
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
  onData(listener: (data: Uint8Array) => void): DebugSubscription {
    this.#dataListeners.add(listener);
    return { dispose: () => this.#dataListeners.delete(listener) };
  }

  /** @inheritdoc */
  onClose(listener: (error?: Error) => void): DebugSubscription {
    if (this.#notified) {
      queueMicrotask(() => listener(this.#terminalError));
      return { dispose: () => undefined };
    }
    this.#closeListeners.add(listener);
    return { dispose: () => this.#closeListeners.delete(listener) };
  }

  /** @inheritdoc */
  async close(): Promise<void> {
    if (this.#closed) {
      return;
    }
    this.#closed = true;
    if (this.#socket.destroyed) {
      this.#notifyClosed(this.#terminalError);
      return;
    }
    await new Promise<void>((resolve) => {
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

  #notifyClosed(error?: Error): void {
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
}

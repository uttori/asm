import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

import type { DebugSubscription } from "./contracts.js";
import { assertDebugSidecarSessionToken } from "./sidecar-protocol.js";
import type { DebugSidecarTransport } from "./sidecar-client.js";

/** Environment variable inherited by a native sidecar instead of exposing its token in argv. */
export const DEBUG_SIDECAR_SESSION_ENV = "UTTORI_ASM_DEBUG_SESSION" as const;

/** Process-launch settings for one local, inherited-stdio sidecar. */
export interface NodeStdioSidecarTransportOptions {
  readonly command: string;
  readonly args?: readonly string[];
  readonly cwd?: string;
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly session: string;
  readonly shutdownTimeoutMs?: number;
  readonly maxStderrBytes?: number;
  readonly onStderr?: (text: string) => void;
}

const positiveInteger = (value: number, name: string): void => {
  if (!Number.isSafeInteger(value) || value <= 0)
    throw new Error(`${name} must be a positive safe integer.`);
};

/** Restartable Node transport that isolates native emulator failures from the extension host. */
export class NodeStdioSidecarTransport implements DebugSidecarTransport {
  readonly #child: ChildProcessWithoutNullStreams;
  readonly #session: string;
  readonly #shutdownTimeoutMs: number;
  readonly #maxStderrBytes: number;
  readonly #onStderr: ((text: string) => void) | undefined;
  readonly #dataListeners = new Set<(data: Uint8Array) => void>();
  readonly #closeListeners = new Set<(error?: Error) => void>();
  readonly #exit: Promise<void>;
  #resolveExit: () => void = () => undefined;
  #terminalError: Error | undefined;
  #notified = false;
  #stderr = Buffer.alloc(0);
  #exited = false;
  #closePromise: Promise<void> | undefined;

  /**
   * Spawns one sidecar without a shell and authenticates it through inherited environment state.
   * @param {NodeStdioSidecarTransportOptions} options Explicit executable and lifecycle bounds.
   */
  constructor(options: NodeStdioSidecarTransportOptions) {
    if (options.command.length === 0) throw new Error("Sidecar command cannot be empty.");
    assertDebugSidecarSessionToken(options.session);
    this.#session = options.session;
    this.#shutdownTimeoutMs = options.shutdownTimeoutMs ?? 1_000;
    this.#maxStderrBytes = options.maxStderrBytes ?? 65_536;
    positiveInteger(this.#shutdownTimeoutMs, "Sidecar shutdown timeout");
    positiveInteger(this.#maxStderrBytes, "Sidecar stderr limit");
    this.#onStderr = options.onStderr;
    this.#exit = new Promise((resolve) => {
      this.#resolveExit = resolve;
    });
    this.#child = spawn(options.command, [...(options.args ?? [])], {
      cwd: options.cwd,
      env: {
        ...process.env,
        ...options.env,
        [DEBUG_SIDECAR_SESSION_ENV]: options.session,
      },
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    this.#child.stdout.on("data", (data: Buffer) => {
      for (const listener of this.#dataListeners) listener(data);
    });
    this.#child.stderr.on("data", (data: Buffer) => this.#captureStderr(data));
    this.#child.on("error", (error) =>
      this.#notifyClosed(new Error(`Unable to run debug sidecar: ${error.message}`)),
    );
    this.#child.on("close", (code, signal) => this.#handleExit(code, signal));
  }

  /** @returns {number | undefined} Native child PID when process creation succeeded. */
  get pid(): number | undefined {
    return this.#child.pid;
  }

  /** @returns {string} Bounded, token-redacted tail of native stderr. */
  get stderr(): string {
    return this.#stderr.toString("utf8");
  }

  /**
   * Writes one complete or partial frame, resolving only after Node flushes it from its buffer.
   * @param {Uint8Array} data Framed protocol bytes.
   * @returns {Promise<void>} Completion of the native pipe write.
   */
  write(data: Uint8Array): Promise<void> {
    if (this.#notified || this.#exited)
      return Promise.reject(this.#terminalError ?? new Error("Sidecar process has exited."));
    return new Promise((resolve, reject) => {
      try {
        this.#child.stdin.write(Buffer.from(data), (error) => {
          if (error) reject(error);
          else resolve();
        });
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  /**
   * Ends stdin and escalates from SIGTERM to SIGKILL only when the child misses bounded deadlines.
   * @returns {Promise<void>} Completion of child-process cleanup.
   */
  close(): Promise<void> {
    this.#closePromise ??= this.#closeProcess();
    return this.#closePromise;
  }

  /** @inheritdoc */
  onData(listener: (data: Uint8Array) => void): DebugSubscription {
    this.#dataListeners.add(listener);
    return { dispose: () => this.#dataListeners.delete(listener) };
  }

  /** @inheritdoc */
  onClose(listener: (error?: Error) => void): DebugSubscription {
    if (this.#notified || this.#exited) {
      const error = this.#terminalError;
      queueMicrotask(() => listener(error));
      return { dispose: () => undefined };
    }
    this.#closeListeners.add(listener);
    return { dispose: () => this.#closeListeners.delete(listener) };
  }

  #captureStderr(data: Buffer): void {
    const text = data.toString("utf8").replaceAll(this.#session, "[redacted]");
    this.#onStderr?.(text);
    const combined = Buffer.concat([this.#stderr, Buffer.from(text, "utf8")]);
    this.#stderr = combined.subarray(Math.max(0, combined.length - this.#maxStderrBytes));
  }

  #handleExit(code: number | null, signal: NodeJS.Signals | null): void {
    this.#exited = true;
    this.#resolveExit();
    let error: Error | undefined;
    if (code !== 0 || signal) {
      const status = signal ? `signal ${signal}` : `code ${String(code)}`;
      const stderr = this.stderr.trim();
      error = new Error(
        `Debug sidecar exited with ${status}${stderr.length === 0 ? "." : `: ${stderr}`}`,
      );
    }
    this.#notifyClosed(error);
  }

  #notifyClosed(error?: Error): void {
    if (this.#notified) return;
    this.#notified = true;
    this.#terminalError = error;
    for (const listener of this.#closeListeners) listener(error);
    this.#closeListeners.clear();
    this.#dataListeners.clear();
  }

  async #closeProcess(): Promise<void> {
    if (!this.#exited && !this.#child.stdin.destroyed) this.#child.stdin.end();
    if (await this.#waitForExit(this.#shutdownTimeoutMs)) return;
    this.#child.kill("SIGTERM");
    if (await this.#waitForExit(this.#shutdownTimeoutMs)) return;
    this.#child.kill("SIGKILL");
    await this.#exit;
  }

  async #waitForExit(timeoutMs: number): Promise<boolean> {
    if (this.#exited) return true;
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(false), timeoutMs);
      timer.unref();
      void this.#exit.then(() => {
        clearTimeout(timer);
        resolve(true);
      });
    });
  }
}

import { spawn } from "node:child_process";
import { assertDebugSidecarSessionToken } from "./sidecar-protocol.js";
/** Environment variable inherited by a native sidecar instead of exposing its token in argv. */
export const DEBUG_SIDECAR_SESSION_ENV = "UTTORI_ASM_DEBUG_SESSION";
const positiveInteger = (value, name) => {
    if (!Number.isSafeInteger(value) || value <= 0) {
        throw new Error(`${name} must be a positive safe integer.`);
    }
};
/** Owns one child process. Create a new instance to restart after close or process failure. */
export class NodeStdioSidecarTransport {
    #child;
    #session;
    #shutdownTimeoutMs;
    #maxStderrBytes;
    #onStderr;
    #dataListeners = new Set();
    #closeListeners = new Set();
    #exit;
    #resolveExit = () => undefined;
    #terminalError;
    #notified = false;
    #stderr = Buffer.alloc(0);
    #exited = false;
    #closePromise;
    /**
     * Spawns one sidecar without a shell and authenticates it through inherited environment state.
     * @param {NodeStdioSidecarTransportOptions} options Explicit executable and lifecycle bounds.
     */
    constructor(options) {
        if (options.command.length === 0) {
            throw new Error("Sidecar command cannot be empty.");
        }
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
        this.#child.stdout.on("data", (data) => {
            for (const listener of this.#dataListeners) {
                listener(data);
            }
        });
        this.#child.stderr.on("data", (data) => this.#captureStderr(data));
        this.#child.on("error", (error) => this.#notifyClosed(new Error(`Unable to run debug sidecar: ${error.message}`)));
        this.#child.on("close", (code, signal) => this.#handleExit(code, signal));
    }
    /** @returns {number | undefined} Native child PID when process creation succeeded. */
    get pid() {
        return this.#child.pid;
    }
    /** @returns {string} Bounded, token-redacted tail of native stderr. */
    get stderr() {
        return this.#stderr.toString("utf8");
    }
    /**
     * Writes one complete or partial frame, resolving only after Node flushes it from its buffer.
     * @param {Uint8Array} data Framed protocol bytes.
     * @returns {Promise<void>} Completion of the native pipe write.
     */
    write(data) {
        if (this.#notified || this.#exited) {
            return Promise.reject(this.#terminalError ?? new Error("Sidecar process has exited."));
        }
        return new Promise((resolve, reject) => {
            try {
                this.#child.stdin.write(Buffer.from(data), (error) => {
                    if (error) {
                        reject(error);
                    }
                    else {
                        resolve();
                    }
                });
            }
            catch (error) {
                reject(error instanceof Error ? error : new Error(String(error)));
            }
        });
    }
    /**
     * Ends stdin and escalates from SIGTERM to SIGKILL only when the child misses bounded deadlines.
     * @returns {Promise<void>} Completion of child-process cleanup.
     */
    close() {
        this.#closePromise ??= this.#closeProcess();
        return this.#closePromise;
    }
    /** @inheritdoc */
    onData(listener) {
        this.#dataListeners.add(listener);
        return { dispose: () => this.#dataListeners.delete(listener) };
    }
    /** @inheritdoc */
    onClose(listener) {
        if (this.#notified || this.#exited) {
            const error = this.#terminalError;
            queueMicrotask(() => listener(error));
            return { dispose: () => undefined };
        }
        this.#closeListeners.add(listener);
        return { dispose: () => this.#closeListeners.delete(listener) };
    }
    #captureStderr(data) {
        const text = data.toString("utf8").replaceAll(this.#session, "[redacted]");
        this.#onStderr?.(text);
        const combined = Buffer.concat([this.#stderr, Buffer.from(text, "utf8")]);
        this.#stderr = combined.subarray(Math.max(0, combined.length - this.#maxStderrBytes));
    }
    #handleExit(code, signal) {
        this.#exited = true;
        this.#resolveExit();
        let error;
        if (code !== 0 || signal) {
            const status = signal ? `signal ${signal}` : `code ${String(code)}`;
            const stderr = this.stderr.trim();
            error = new Error(`Debug sidecar exited with ${status}${stderr.length === 0 ? "." : `: ${stderr}`}`);
        }
        this.#notifyClosed(error);
    }
    #notifyClosed(error) {
        if (this.#notified) {
            return;
        }
        this.#notified = true;
        this.#terminalError = error;
        for (const listener of this.#closeListeners) {
            listener(error);
        }
        this.#closeListeners.clear();
        this.#dataListeners.clear();
    }
    async #closeProcess() {
        if (!this.#exited && !this.#child.stdin.destroyed) {
            this.#child.stdin.end();
        }
        if (await this.#waitForExit(this.#shutdownTimeoutMs)) {
            return;
        }
        this.#child.kill("SIGTERM");
        if (await this.#waitForExit(this.#shutdownTimeoutMs)) {
            return;
        }
        this.#child.kill("SIGKILL");
        await this.#exit;
    }
    async #waitForExit(timeoutMs) {
        if (this.#exited) {
            return true;
        }
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
//# sourceMappingURL=node-stdio-transport.js.map
import net from "node:net";
/** Node TCP transport restricted to the sidecar-owned native MesenCE endpoint. */
export class NodeTcpMesenTransport {
    #socket;
    #shutdownTimeoutMs;
    #dataListeners = new Set();
    #closeListeners = new Set();
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
     * @param {NodeTcpMesenTransportOptions} options Loopback endpoint and deadlines.
     * @returns {Promise<NodeTcpMesenTransport>} Connected transport.
     */
    static async connect(options) {
        const host = options.host ?? "127.0.0.1";
        if (host !== "127.0.0.1" && host !== "::1") {
            throw new Error("Mesen transport host must be a numeric loopback address.");
        }
        if (!Number.isSafeInteger(options.port) || options.port < 1 || options.port > 65_535) {
            throw new Error("Mesen transport port must be an integer between 1 and 65535.");
        }
        const connectTimeoutMs = options.connectTimeoutMs ?? 3_000;
        const shutdownTimeoutMs = options.shutdownTimeoutMs ?? 1_000;
        for (const [name, value] of [
            ["Mesen connect timeout", connectTimeoutMs],
            ["Mesen shutdown timeout", shutdownTimeoutMs],
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
        return new NodeTcpMesenTransport(socket, shutdownTimeoutMs);
    }
    /** @inheritdoc */
    write(data) {
        if (this.#closed) {
            return Promise.reject(new Error("Mesen TCP transport is closed."));
        }
        return new Promise((resolve, reject) => {
            this.#socket.write(data, (error) => {
                if (error) {
                    reject(error);
                }
                else {
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
            return { dispose: () => undefined };
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
}
//# sourceMappingURL=node-tcp-mesen-transport.js.map
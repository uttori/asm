import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { DEBUG_SIDECAR_SESSION_ENV, } from "@uttori/asm-debug-adapter";
import { GdbRspClient } from "./gdb-rsp-client.js";
import { NodeTcpGdbRspTransport } from "./node-tcp-gdb-rsp-transport.js";
export const ARES_RUNTIME_MANIFEST_VERSION = 1;
const sha256Pattern = /^[\dA-Fa-f]{64}$/;
const revisionPattern = /^[\dA-Fa-f]{40}$/;
const checkedSha256 = (value, name) => {
    if (!sha256Pattern.test(value)) {
        throw new Error(`${name} must be a 64-digit SHA-256 value.`);
    }
    return value.toLowerCase();
};
const checkedRevision = (value, name) => {
    if (!revisionPattern.test(value)) {
        throw new Error(`${name} must be a 40-digit git revision.`);
    }
    return value.toLowerCase();
};
const checkedAbsolutePath = (value, name) => {
    if (!path.isAbsolute(value)) {
        throw new Error(`${name} must be an absolute path.`);
    }
    return path.normalize(value);
};
const checkedResourcePath = (value) => {
    if (value === "." ||
        value.includes("\\") ||
        path.posix.isAbsolute(value) ||
        path.posix.normalize(value) !== value ||
        value.split("/").includes("..")) {
        throw new Error(`Ares resource path '${value}' must be normalized and relative.`);
    }
    return value;
};
const errorValue = (error) => error instanceof Error ? error : new Error(String(error));
const waitWithTimeout = async (promise, timeoutMs) => new Promise((resolve) => {
    const timer = setTimeout(() => resolve(undefined), timeoutMs);
    timer.unref();
    void promise.then((value) => {
        clearTimeout(timer);
        resolve(value);
        return;
    });
});
class NodeAresProcessHandle {
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
            windowsHide: true,
        });
        this.#child.stdout?.on("data", (data) => options.onOutput("stdout", data));
        this.#child.stderr?.on("data", (data) => options.onOutput("stderr", data));
        this.#child.once("error", (error) => {
            spawnError = error;
        });
        this.#exit = new Promise((resolve) => {
            this.#child.once("close", (code, signal) => {
                this.#exited = true;
                resolve({ code, signal, ...(spawnError ? { error: spawnError } : {}) });
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
}
const nodeSha256 = async (file) => {
    const digest = createHash("sha256");
    for await (const chunk of createReadStream(file)) {
        if (!Buffer.isBuffer(chunk)) {
            throw new Error(`Expected binary bytes while hashing ${file}.`);
        }
        digest.update(chunk);
    }
    return digest.digest("hex");
};
const reserveLoopbackPort = async () => {
    const server = net.createServer();
    await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen({ host: "127.0.0.1", port: 0, exclusive: true }, resolve);
    });
    const address = server.address();
    if (!address || typeof address === "string") {
        server.close();
        throw new Error("Unable to reserve an IPv4 loopback port for ares.");
    }
    await new Promise((resolve, reject) => server.close((error) => {
        if (error) {
            reject(error);
        }
        else {
            resolve();
        }
    }));
    return address.port;
};
/** Default Node platform operations. The RSP listener itself remains numeric-loopback-only. */
export const nodeAresProcessRuntime = Object.freeze({
    platform: process.platform,
    architecture: process.arch,
    sha256: nodeSha256,
    reserveLoopbackPort,
    launch: (options) => new NodeAresProcessHandle(options),
    connect: (port, timeoutMs) => NodeTcpGdbRspTransport.connect({
        host: "127.0.0.1",
        port,
        connectTimeoutMs: timeoutMs,
    }),
    delay: (milliseconds) => new Promise((resolve) => {
        const timer = setTimeout(resolve, milliseconds);
        timer.unref();
    }),
});
const isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
const manifestRecord = (value) => {
    if (!isRecord(value)) {
        throw new Error("Ares runtime manifest must be an object.");
    }
    return value;
};
const NODE_PLATFORMS = [
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
    "netbsd",
];
const manifestPlatform = (value) => {
    const platform = NODE_PLATFORMS.find((candidate) => candidate === value);
    if (!platform) {
        throw new Error(`Ares manifest platform '${value}' is not a Node platform.`);
    }
    return platform;
};
const manifestString = (value, name) => {
    if (typeof value !== "string" || value.length === 0) {
        throw new Error(`${name} must be a non-empty string.`);
    }
    return value;
};
/**
 * Parses and freezes an untrusted versioned ares runtime manifest.
 * @param {unknown} value Parsed JSON-like value.
 * @returns {AresRuntimeManifest} Validated immutable runtime identity.
 */
export const parseAresRuntimeManifest = (value) => {
    const manifest = manifestRecord(value);
    if (manifest.schemaVersion !== ARES_RUNTIME_MANIFEST_VERSION) {
        throw new Error(`Unsupported ares runtime manifest version ${String(manifest.schemaVersion)}.`);
    }
    if (manifest.emulator !== "ares") {
        throw new Error("Runtime manifest is not for ares.");
    }
    if (manifest.frontend !== undefined &&
        manifest.frontend !== "headless" &&
        manifest.frontend !== "desktop") {
        throw new Error("Ares runtime frontend must be 'headless' or 'desktop'.");
    }
    const buildConfiguration = manifestString(manifest.buildConfiguration, "Ares build configuration");
    if (!Array.isArray(manifest.resources)) {
        throw new Error("Ares runtime manifest resources must be an array.");
    }
    const resources = Object.freeze(manifest.resources.map((entry, index) => {
        const resource = manifestRecord(entry);
        const resourcePath = checkedResourcePath(manifestString(resource.path, `Ares resource ${index} path`));
        return Object.freeze({
            path: resourcePath,
            sha256: checkedSha256(manifestString(resource.sha256, `Resource '${resourcePath}' SHA-256`), `Resource '${resourcePath}' SHA-256`),
        });
    }));
    if (new Set(resources.map((resource) => resource.path)).size !== resources.length) {
        throw new Error("Ares runtime manifest contains duplicate resource paths.");
    }
    return Object.freeze({
        schemaVersion: ARES_RUNTIME_MANIFEST_VERSION,
        emulator: "ares",
        ...(manifest.frontend === undefined ? {} : { frontend: manifest.frontend }),
        upstreamRevision: checkedRevision(manifestString(manifest.upstreamRevision, "Ares upstream revision"), "Ares upstream revision"),
        headlessBaseRevision: checkedRevision(manifestString(manifest.headlessBaseRevision, "Ares headless base revision"), "Ares headless base revision"),
        forkRevision: checkedRevision(manifestString(manifest.forkRevision, "Ares fork revision"), "Ares fork revision"),
        headlessPatchSha256: checkedSha256(manifestString(manifest.headlessPatchSha256, "Ares headless patch SHA-256"), "Ares headless patch SHA-256"),
        patchSha256: checkedSha256(manifestString(manifest.patchSha256, "Ares patch SHA-256"), "Ares patch SHA-256"),
        executableSha256: checkedSha256(manifestString(manifest.executableSha256, "Ares executable SHA-256"), "Ares executable SHA-256"),
        romSha256: checkedSha256(manifestString(manifest.romSha256, "ROM SHA-256"), "ROM SHA-256"),
        platform: manifestPlatform(manifestString(manifest.platform, "Ares manifest platform")),
        architecture: manifestString(manifest.architecture, "Ares manifest architecture"),
        buildConfiguration,
        resources,
    });
};
/** Owns one verified ares process and creates private RSP clients for a neutral backend. */
export class AresProcessHost {
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
        this.#runtimeDirectory = checkedAbsolutePath(options.runtimeDirectory, "Ares runtime directory");
        this.#manifest = parseAresRuntimeManifest(options.manifest);
        const executableRelative = path.relative(this.#runtimeDirectory, this.#executable);
        if (executableRelative === "" ||
            executableRelative === ".." ||
            executableRelative.startsWith(`..${path.sep}`) ||
            path.isAbsolute(executableRelative)) {
            throw new Error("Ares executable must be contained within its portable runtime directory.");
        }
        this.#system = options.system ?? "Super Famicom";
        if (this.#system.length === 0) {
            throw new Error("Ares system name must be non-empty.");
        }
        this.#fastBoot = options.fastBoot ?? true;
        this.#env = options.env ?? {};
        this.#startupTimeoutMs = options.startupTimeoutMs ?? 10_000;
        this.#requestTimeoutMs = options.requestTimeoutMs ?? 3_000;
        this.#shutdownTimeoutMs = options.shutdownTimeoutMs ?? 2_000;
        this.#connectRetryMs = options.connectRetryMs ?? 25;
        this.#maxOutputBytes = options.maxOutputBytes ?? 65_536;
        this.#onOutput = options.onOutput;
        this.#runtime = options.runtime ?? nodeAresProcessRuntime;
        for (const [name, value] of [
            ["Ares startup timeout", this.#startupTimeoutMs],
            ["Ares RSP request timeout", this.#requestTimeoutMs],
            ["Ares shutdown timeout", this.#shutdownTimeoutMs],
            ["Ares connect retry delay", this.#connectRetryMs],
            ["Ares output limit", this.#maxOutputBytes],
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
            }
            else if (!this.#process || this.#process.exited || this.#port === undefined) {
                throw new Error("Cannot reconnect to ares because no preserved process is running.");
            }
            try {
                return await this.#connect();
            }
            catch (error) {
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
        // Desktop settings own save locations, including an empty path for saves
        // beside the ROM. Overriding it hides existing SRAM/slots after a runtime switch.
        if (!desktop) {
            await mkdir(path.join(this.#runtimeDirectory, "saves"), { recursive: true });
        }
        const port = await this.#runtime.reserveLoopbackPort();
        const args = [
            "--system",
            this.#system,
            "--settings-file",
            path.join(this.#runtimeDirectory, "settings.bml"),
            ...(desktop
                ? [
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
                    "General/Rewind=false",
                ].flatMap((setting) => ["--setting", setting])
                : [
                    "--setting",
                    `Paths/Saves=${path.join(this.#runtimeDirectory, "saves")}`,
                    "--gdb-port",
                    String(port),
                    "--gdb-ipv4",
                    "--wait-on-gdb",
                    "--quiet",
                    ...(this.#fastBoot ? ["--fast-boot"] : []),
                ]),
            this.#rom,
        ];
        this.#output = Buffer.alloc(0);
        const processHandle = this.#runtime.launch({
            command: this.#executable,
            args,
            cwd: this.#runtimeDirectory,
            env: { ...this.#env, [DEBUG_SIDECAR_SESSION_ENV]: undefined },
            onOutput: (stream, data) => this.#captureOutput(stream, data),
        });
        this.#process = processHandle;
        this.#port = port;
    }
    async #connect() {
        const processHandle = this.#process;
        const port = this.#port;
        if (!processHandle || port === undefined) {
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
            }
            catch (error) {
                lastError = errorValue(error);
            }
            await this.#runtime.delay(Math.min(this.#connectRetryMs, Math.max(1, deadline - Date.now())));
        }
        if (processHandle.exited) {
            throw await this.#exitError(processHandle, "before RSP connected");
        }
        throw new Error(`Ares RSP listener on 127.0.0.1:${port} was not ready within ${this.#startupTimeoutMs} ms: ${lastError.message}`);
    }
    async #verifyIdentity() {
        if (this.#runtime.platform !== this.#manifest.platform) {
            throw new Error(`Ares manifest platform '${this.#manifest.platform}' does not match '${this.#runtime.platform}'.`);
        }
        if (this.#runtime.architecture !== this.#manifest.architecture) {
            throw new Error(`Ares manifest architecture '${this.#manifest.architecture}' does not match '${this.#runtime.architecture}'.`);
        }
        const runtimeInfo = await stat(this.#runtimeDirectory).catch(() => undefined);
        if (runtimeInfo && !runtimeInfo.isDirectory()) {
            throw new Error("Ares runtime path exists but is not a directory.");
        }
        await this.#verifyHash(this.#executable, this.#manifest.executableSha256, "executable");
        await this.#verifyHash(this.#rom, this.#manifest.romSha256, "ROM");
        for (const resource of this.#manifest.resources) {
            // path.join already normalizes manifest separators. Keep the path as one argument.
            await this.#verifyHash(path.join(this.#runtimeDirectory, resource.path), resource.sha256, `resource '${resource.path}'`);
        }
    }
    async #verifyHash(file, expected, context) {
        let actual;
        try {
            actual = checkedSha256(await this.#runtime.sha256(file), `Observed ${context} SHA-256`);
        }
        catch (error) {
            throw new Error(`Unable to verify ares ${context} at '${file}': ${errorValue(error).message}`, { cause: error });
        }
        if (actual !== expected) {
            throw new Error(`Ares ${context} SHA-256 mismatch: expected ${expected}, received ${actual}.`);
        }
    }
    async #terminateCurrent() {
        const processHandle = this.#process;
        this.#process = undefined;
        this.#port = undefined;
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
        }
        else if (detail) {
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
        this.#lifecycleTail = operation.then(() => undefined, () => undefined);
        return operation;
    }
}
//# sourceMappingURL=ares-process-host.js.map
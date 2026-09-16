import { readFile } from "node:fs/promises";
import path from "node:path";
import { DEBUG_SIDECAR_SESSION_ENV, DebugSidecarServer, assertDebugSidecarSessionToken, } from "@uttori/asm-debug-adapter";
import { MESEN_BACKEND_ID, MesenDebugBackend } from "./mesen-backend.js";
import { MesenProcessHost, parseMesenRuntimeManifest } from "./mesen-process-host.js";
const usage = `Usage: uttori-asm-debug-sidecar-mesence [options]

Required:
  --manifest path       Versioned MesenCE runtime manifest JSON
  --mesen path          Separately installed patched MesenCE executable
  --rom path            SNES ROM whose SHA-256 matches the manifest
  --runtime-dir path    Portable runtime directory containing the executable

Optional:
  --help                Show this help
`;
const optionNames = new Set(["--manifest", "--mesen", "--rom", "--runtime-dir"]);
/**
 * Strict shell-independent parser for the production MesenCE sidecar.
 * @param {readonly string[]} arguments_ Sidecar command-line arguments.
 * @returns {MesenSidecarArguments} Validated and path-resolved launch inputs.
 */
export const parseMesenSidecarArguments = (arguments_) => {
    const values = new Map();
    for (let index = 0; index < arguments_.length; index++) {
        const argument = arguments_[index];
        if (argument === undefined)
            throw new Error("Mesen sidecar arguments cannot contain holes.");
        if (!optionNames.has(argument))
            throw new Error(`Unknown Mesen sidecar option '${argument}'.`);
        if (values.has(argument))
            throw new Error(`Duplicate Mesen sidecar option '${argument}'.`);
        const value = arguments_[++index];
        if (!value || value.startsWith("--"))
            throw new Error(`Mesen sidecar option '${argument}' requires a value.`);
        values.set(argument, value);
    }
    const required = (name) => {
        const value = values.get(name);
        if (!value)
            throw new Error(`Missing required Mesen sidecar option '${name}'.`);
        return path.resolve(value);
    };
    return {
        manifest: required("--manifest"),
        executable: required("--mesen"),
        rom: required("--rom"),
        runtimeDirectory: required("--runtime-dir"),
    };
};
const write = (stream, data) => new Promise((resolve, reject) => {
    stream.write(data, (error) => {
        if (error)
            reject(error);
        else
            resolve();
    });
});
/**
 * Runs one authenticated neutral sidecar until shutdown, EOF, signal, or protocol failure.
 * @param {readonly string[]} arguments_ Sidecar command-line arguments.
 * @param {NodeJS.ProcessEnv} environment Environment containing the neutral session token.
 * @returns {Promise<void>} Completion after installing protocol and lifecycle handlers.
 */
export const runMesenSidecar = async (arguments_, environment = process.env) => {
    const options = parseMesenSidecarArguments(arguments_);
    const session = environment[DEBUG_SIDECAR_SESSION_ENV];
    assertDebugSidecarSessionToken(session);
    const manifest = parseMesenRuntimeManifest(JSON.parse(await readFile(options.manifest, "utf8")));
    const host = new MesenProcessHost({
        executable: options.executable,
        rom: options.rom,
        runtimeDirectory: options.runtimeDirectory,
        manifest,
    });
    const backend = new MesenDebugBackend({
        createClient: (connect) => host.createClient(connect),
        terminate: () => host.terminate(),
    });
    let ending = false;
    const close = async (error) => {
        if (ending)
            return;
        ending = true;
        if (error)
            await write(process.stderr, `${error.stack ?? error.message}\n`).catch(() => undefined);
        process.stdin.pause();
        await host.terminate().catch(() => undefined);
        await new Promise((resolve) => process.stdout.end(resolve));
    };
    const server = new DebugSidecarServer({
        backend: MESEN_BACKEND_ID,
        implementation: backend,
        session,
        write: (data) => write(process.stdout, data),
        close,
    });
    let receiveTail = Promise.resolve();
    process.stdin.on("data", (data) => {
        receiveTail = receiveTail.then(() => server.receive(data));
        void receiveTail.catch(() => undefined);
    });
    process.stdin.on("end", () => {
        void receiveTail.then(() => server.close()).catch(() => undefined);
    });
    for (const signal of ["SIGINT", "SIGTERM"]) {
        process.once(signal, () => {
            void server.close().catch(() => undefined);
        });
    }
};
// npm bin shims and macOS temporary-directory aliases need Node's resolved entry identity.
// Importing the library API must never start a protocol server as a side effect.
if (import.meta.main) {
    const arguments_ = process.argv.slice(2);
    if (arguments_.includes("--help")) {
        await write(process.stdout, usage);
    }
    else {
        await runMesenSidecar(arguments_).catch(async (error) => {
            const failure = error instanceof Error ? error : new Error(String(error));
            await write(process.stderr, `${failure.stack ?? failure.message}\n`).catch(() => undefined);
            process.exitCode = 1;
        });
    }
}
//# sourceMappingURL=sidecar.js.map
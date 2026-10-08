import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { DEBUG_SIDECAR_SESSION_ENV, DebugSidecarServer, assertDebugSidecarSessionToken, } from "@uttori/asm-debug-adapter";
import { AresProcessHost, parseAresRuntimeManifest } from "./ares-process-host.js";
import { ARES_RSP_BACKEND_ID, AresRspDebugBackend } from "./ares-rsp-backend.js";
const usage = `Usage: uttori-asm-debug-sidecar-ares [options]

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
const optionNames = new Set([
    "--manifest",
    "--ares",
    "--rom",
    "--rom-sha256",
    "--runtime-dir",
    "--system",
]);
/**
 * Strict shell-independent parser for the production sidecar executable.
 * @param {readonly string[]} arguments_ Sidecar command-line arguments.
 * @returns {AresSidecarArguments} Validated and path-resolved launch inputs.
 */
export const parseAresSidecarArguments = (arguments_) => {
    const values = new Map();
    let fastBoot = true;
    for (let index = 0; index < arguments_.length; index++) {
        const argument = index >= 0 && index < arguments_.length && Object.hasOwn(arguments_, index)
            ? arguments_[index]
            : undefined;
        if (argument === undefined) {
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
        return path.resolve(value);
    };
    const system = values.get("--system");
    const romSha256 = values.get("--rom-sha256");
    if (romSha256 !== undefined && !/^[\da-f]{64}$/i.test(romSha256)) {
        throw new Error("--rom-sha256 requires a 64-digit SHA-256 from the selected build.");
    }
    return {
        ...(romSha256 ? { romSha256: romSha256.toLowerCase() } : {}),
        manifest: required("--manifest"),
        executable: required("--ares"),
        rom: required("--rom"),
        runtimeDirectory: required("--runtime-dir"),
        ...(system ? { system } : {}),
        fastBoot,
    };
};
const write = (stream, data) => new Promise((resolve, reject) => {
    stream.write(data, (error) => {
        if (error) {
            reject(error);
        }
        else {
            resolve();
        }
    });
});
/**
 * Runs one authenticated stdio sidecar until shutdown, EOF, signal, or protocol failure.
 * @param {readonly string[]} arguments_ Sidecar command-line arguments.
 * @param {NodeJS.ProcessEnv} environment Environment containing the one-session token.
 * @returns {Promise<void>} Completion once stdio handlers and backend ownership are installed.
 */
export const runAresSidecar = async (arguments_, environment = process.env) => {
    const options = parseAresSidecarArguments(arguments_);
    const session = environment[DEBUG_SIDECAR_SESSION_ENV];
    assertDebugSidecarSessionToken(session);
    const runtimeManifest = parseAresRuntimeManifest(JSON.parse(await readFile(options.manifest, "utf8")));
    // A modification selects a new ROM identity for this session only. Executable and
    // resource pins still come from the installed runtime; its saved manifest is unchanged.
    const manifest = {
        ...runtimeManifest,
        romSha256: options.romSha256 ?? runtimeManifest.romSha256,
    };
    const host = new AresProcessHost({
        executable: options.executable,
        rom: options.rom,
        runtimeDirectory: options.runtimeDirectory,
        manifest,
        system: options.system,
        fastBoot: options.fastBoot,
    });
    // Only Famicom has an external iNES prefix. Keep ordinary sidecar startup lazy until connect.
    let contentSha256 = manifest.romSha256;
    let nesPrgFileOffset;
    if (/^(Famicom|NES|FC)$/i.test(options.system ?? "")) {
        const romBytes = await readFile(options.rom);
        if (!romBytes.subarray(0, 4).equals(Buffer.from([0x4e, 0x45, 0x53, 0x1a])))
            throw new Error("Famicom launch requires an iNES cartridge.");
        nesPrgFileOffset = 16 + (romBytes[6] & 4 ? 512 : 0);
        contentSha256 = createHash("sha256").update(romBytes.subarray(16)).digest("hex");
    }
    const backend = new AresRspDebugBackend({
        nesPrgFileOffset,
        createClient: (connect) => host.createClient(connect),
        nativeFileIdentity: {
            romSha256: contentSha256,
            romFileSha256: manifest.romSha256,
            executableSha256: manifest.executableSha256,
            producerRevision: `${manifest.forkRevision}:${manifest.patchSha256}:${manifest.executableSha256}`,
        },
        terminate: () => host.terminate(),
    });
    let ending = false;
    const close = async (error) => {
        if (ending) {
            return;
        }
        ending = true;
        if (error) {
            // Error reporting is best effort so a broken stderr cannot prevent native host shutdown.
            // oxlint-disable-next-line promise/no-promise-in-callback
            await write(process.stderr, `${error.stack ?? error.message}\n`).catch(() => undefined);
        }
        process.stdin.pause();
        // The protocol close callback owns asynchronous host teardown even after transport failure.
        // oxlint-disable-next-line promise/no-promise-in-callback
        await host.terminate().catch(() => undefined);
        await new Promise((resolve) => process.stdout.end(resolve));
    };
    const server = new DebugSidecarServer({
        backend: ARES_RSP_BACKEND_ID,
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
        await runAresSidecar(arguments_).catch(async (error) => {
            const failure = error instanceof Error ? error : new Error(String(error));
            await write(process.stderr, `${failure.stack ?? failure.message}\n`).catch(() => undefined);
            process.exitCode = 1;
        });
    }
}
//# sourceMappingURL=sidecar.js.map
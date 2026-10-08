import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, open, readdir, readFile, link, unlink } from "node:fs/promises";
import path from "node:path";
const isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
const digestFile = async (file, signal) => {
    const hash = createHash("sha256");
    for await (const bytes of createReadStream(file, { signal })) {
        if (!Buffer.isBuffer(bytes)) {
            throw new Error(`Expected binary capture context data in ${path.basename(file)}.`);
        }
        hash.update(bytes);
    }
    return hash.digest("hex");
};
/** Coordinates paused context boundaries with either ACT2 sink. The native
 * companion writes into a newly reserved directory; manifest.json is published
 * only after the ACT2 archive and every companion file are complete and synced. */
export class CaptureContextRecorder {
    directory;
    transport;
    #metadata;
    #native;
    constructor(archive, metadata, transport) {
        this.directory = `${archive}.context`;
        if (metadata.architecture === "65xx.2a03" && !metadata.romFileSha256) {
            throw new Error("NES context requires the full iNES image identity.");
        }
        // Recorder options also contain format, callbacks and host paths. Copy only
        // identity fields so they cannot overwrite the companion's format contract.
        this.#metadata = {
            architecture: metadata.architecture,
            addressSpace: metadata.addressSpace,
            romContentSha256: metadata.romContentSha256,
            ...(metadata.romFileSha256 ? { romFileSha256: metadata.romFileSha256 } : {}),
            producer: metadata.producer,
        };
        this.#native = transport;
        this.transport = async (request) => {
            if (request.operation === "start" || request.operation === "file-start") {
                await this.#request({
                    operation: "context",
                    action: "prepare",
                    directory: this.directory,
                    ...(metadata.romFileSha256 ? { romFileSha256: metadata.romFileSha256 } : {}),
                    romContentSha256: metadata.romContentSha256,
                    producer: metadata.producer,
                }, "prepared");
                let session;
                try {
                    const position = await transport(request);
                    if (!("session" in position)) {
                        throw new Error("Capture did not return a session.");
                    }
                    session = position.session;
                    await this.#request({ operation: "context", action: "start", session }, "recording");
                    return position;
                }
                catch (error) {
                    if (session) {
                        await transport({
                            operation: request.operation === "file-start" ? "file-abort" : "abort",
                            session,
                        }).catch(() => undefined);
                    }
                    await transport({ operation: "context", action: "abort" }).catch(() => undefined);
                    throw error;
                }
            }
            if (request.operation === "stop" || request.operation === "file-stop") {
                // Stop first pauses at an acknowledged CPU boundary. It stays held while
                // the independent graphics writer drains, so the retained machine endpoint
                // and primary terminal counters describe the same execution position.
                for (;;) {
                    const result = await transport({
                        operation: "context",
                        action: "stop",
                        session: request.session,
                    });
                    if (!("contextState" in result)) {
                        throw new Error("Missing capture context stop status.");
                    }
                    if (result.contextState === "complete") {
                        break;
                    }
                    if (result.contextState !== "draining") {
                        throw new Error(`Capture context stop failed: ${result.contextState}.`);
                    }
                    await new Promise((resolve) => setTimeout(resolve, 10));
                }
            }
            if (request.operation === "abort" || request.operation === "file-abort") {
                await transport({ operation: "context", action: "abort" }).catch(() => undefined);
            }
            return transport(request);
        };
    }
    /** Publish integrity hashes and trace-relative boundaries after primary publication.
     * Failures retain all files without claiming a complete context bundle.
     * @param {CaptureFileSummary} summary Completed primary archive whose session/counters must match.
     */
    async finish(summary) {
        const boundaries = JSON.parse(await readFile(path.join(this.directory, "boundaries.json"), "utf8"));
        if (!isRecord(boundaries)) {
            throw new Error("Capture context boundaries must be an object.");
        }
        const boundaryEnd = isRecord(boundaries.end) ? boundaries.end.eventThrough : undefined;
        if (boundaries.session !== summary.position.session ||
            boundaryEnd !== summary.position.producedThrough) {
            throw new Error("Capture context boundary does not match the completed ACT2 archive.");
        }
        const nes = this.#metadata.architecture === "65xx.2a03";
        const files = {};
        for (const name of (await readdir(this.directory)).toSorted()) {
            if (!/^(?:identity\.txt|machine\.json|start-extra\.bin|end-state\.bin|ram-(?:start|end)\.bin|start\.bst|wram-(?:start|end)\.bin|inputs\.bin|milestones\.jsonl|(?:start|end)-clock\.txt|boundaries\.json|graphics\.act2|screen-\d+\.png)$/.test(name)) {
                throw new Error(`Unexpected capture context artifact: ${name}.`);
            }
            const file = path.join(this.directory, name);
            const stat = await lstat(file);
            if (!stat.isFile() || stat.isSymbolicLink()) {
                throw new Error("Capture context artifacts must be regular files.");
            }
            if ((name.startsWith("wram-") && (nes || stat.size !== 131072)) ||
                (name.startsWith("ram-") && (!nes || stat.size !== 2048)) ||
                (name === "start-extra.bin" && (!nes || stat.size !== 38)) ||
                (name === "end-state.bin" && (!nes || stat.size < 2048 || stat.size > 32 * 1048576))) {
                throw new Error("Capture RAM snapshot does not match its machine profile.");
            }
            if (name === "inputs.bin" && stat.size % 18) {
                throw new Error("Controller evidence has an incomplete row.");
            }
            const sha256 = await digestFile(file);
            const handle = await open(file, "r+");
            try {
                await handle.sync();
            }
            finally {
                await handle.close();
            }
            files[name] = { bytes: stat.size, sha256 };
        }
        for (const name of [
            "start.bst",
            ...(nes
                ? ["ram-start.bin", "ram-end.bin", "start-extra.bin", "end-state.bin"]
                : ["wram-start.bin", "wram-end.bin"]),
            "inputs.bin",
            "milestones.jsonl",
            "identity.txt",
            "machine.json",
            "start-clock.txt",
            "end-clock.txt",
        ]) {
            if (!files[name]) {
                throw new Error(`Missing capture context artifact: ${name}.`);
            }
        }
        if ((summary.scope === "snes.65816.instructions" || summary.scope === "nes.2a03.instructions") &&
            !files["graphics.act2"]) {
            throw new Error("Instruction context is missing its graphics companion.");
        }
        // Require the producer's explicit full-window acknowledgement so a mismatched
        // runtime cannot publish an early graphics cutoff as complete scene evidence.
        if (files["graphics.act2"] && boundaries.graphicsWindowFrames !== null) {
            throw new Error("Capture context requires full-capture graphics from the native runtime.");
        }
        const graphicsScope = nes ? "nes.cpu-bus-ppu" : "snes.cpu-bus-ppu";
        const manifest = path.join(this.directory, "manifest.json");
        const handle = await open(`${manifest}.partial`, "wx");
        try {
            await handle.writeFile(`${JSON.stringify({
                format: "uttori-capture-context",
                version: 1,
                ...this.#metadata,
                archive: path.basename(summary.archive),
                scope: summary.scope,
                boundaries,
                ...(nes
                    ? {
                        ram: { addressSpace: "nes.ram", address: 0, bytes: 2048 },
                        endpoint: {
                            file: "end-state.bin",
                            encoding: "ares-famicom-canonical-v1",
                            includes: "CPU,APU,PPU,mapper,controllers,RNG",
                        },
                    }
                    : { wram: { address: 0x7e0000, bytes: 131072 } }),
                inputs: {
                    file: "inputs.bin",
                    rowBytes: 18,
                    encoding: nes
                        ? "le-u64-clock,u64-instruction-ordinal,u8-sample-slot,u8-button-value"
                        : "le-u64-clock,u64-instruction-ordinal,u8-port,u8-serial-bits",
                },
                visuals: {
                    timing: "last-presented-frame",
                    automaticIntervalFrames: 300,
                    automaticLimit: 24,
                },
                graphics: files["graphics.act2"]
                    ? {
                        scope: graphicsScope,
                        windowFrames: null,
                        file: "graphics.act2",
                    }
                    : {
                        scope: summary.scope,
                        windowFrames: null,
                        file: null,
                        primaryArchive: path.basename(summary.archive),
                    },
                files,
            }, null, 2)}\n`);
            await handle.sync();
        }
        finally {
            await handle.close();
        }
        await link(`${manifest}.partial`, manifest);
        await unlink(`${manifest}.partial`);
    }
    async #request(request, expected) {
        const result = await this.#native(request);
        if (!("contextState" in result) || result.contextState !== expected) {
            throw new Error(`Capture context requires ${expected} status.`);
        }
    }
}
/** Verify the entire companion before feeding a save state to native code. Every
 * path is a flat, regular artifact, and every byte is bound to this ROM/build.
 * @param {string} directory Companion directory selected by the user.
 * @param {Pick<CaptureFileMetadata, "romContentSha256" | "romFileSha256" | "producer">} identity ROM and producer identity of the verified running emulator.
 */
export const verifyCaptureContext = async (directory, identity, signal) => {
    signal?.throwIfAborted();
    const metadataFile = path.join(directory, "manifest.json");
    const metadataStat = await lstat(metadataFile);
    if (!metadataStat.isFile() || metadataStat.isSymbolicLink() || metadataStat.size > 1048576) {
        throw new Error("Invalid capture context manifest.");
    }
    const manifest = JSON.parse(await readFile(metadataFile, "utf8"));
    if (!isRecord(manifest)) {
        throw new Error("Invalid capture context manifest.");
    }
    const producer = isRecord(manifest.producer) ? manifest.producer : undefined;
    if (manifest.format !== "uttori-capture-context" ||
        manifest.version !== 1 ||
        manifest.romContentSha256 !== identity.romContentSha256 ||
        !isRecord(producer) ||
        producer.id !== identity.producer.id ||
        producer.revision !== identity.producer.revision ||
        !isRecord(manifest.files)) {
        throw new Error("Capture context requires the matching ROM and emulator build.");
    }
    const nes = manifest.architecture === "65xx.2a03";
    if ((nes &&
        (!identity.romFileSha256 ||
            identity.romFileSha256 !== manifest.romFileSha256 ||
            manifest.addressSpace !== "nes.cpu")) ||
        (!nes && identity.romFileSha256 !== undefined)) {
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
        ...(nes
            ? ["ram-start.bin", "ram-end.bin", "start-extra.bin", "end-state.bin"]
            : ["wram-start.bin", "wram-end.bin"]),
        "inputs.bin",
        "identity.txt",
        "machine.json",
        "start-clock.txt",
        "end-clock.txt",
        "boundaries.json",
    ]) {
        if (!files[name]) {
            throw new Error(`Capture context is missing ${name}.`);
        }
    }
    for (const [name, artifact] of Object.entries(files)) {
        signal?.throwIfAborted();
        if (!/^(?:identity\.txt|machine\.json|start-extra\.bin|end-state\.bin|ram-(?:start|end)\.bin|start\.bst|wram-(?:start|end)\.bin|inputs\.bin|milestones\.jsonl|(?:start|end)-clock\.txt|boundaries\.json|graphics\.act2|screen-\d+\.png)$/.test(name) ||
            !isRecord(artifact) ||
            typeof artifact.bytes !== "number" ||
            !Number.isSafeInteger(artifact.bytes) ||
            artifact.bytes < 0 ||
            typeof artifact.sha256 !== "string" ||
            !/^[\da-f]{64}$/.test(artifact.sha256)) {
            throw new Error("Invalid capture context artifact descriptor.");
        }
        const file = path.join(directory, name), stat = await lstat(file);
        if (!stat.isFile() ||
            stat.isSymbolicLink() ||
            stat.size !== artifact.bytes ||
            (name === "start.bst" && (stat.size < 538 || stat.size > 32 * 1048576)) ||
            (name.startsWith("wram-") && (nes || stat.size !== 131072)) ||
            (name.startsWith("ram-") && (!nes || stat.size !== 2048)) ||
            (name === "start-extra.bin" && (!nes || stat.size !== 38)) ||
            (name === "end-state.bin" && (!nes || stat.size < 2048 || stat.size > 32 * 1048576)) ||
            (name === "inputs.bin" && stat.size % 18)) {
            throw new Error(`Capture context artifact size/type mismatch: ${name}.`);
        }
        if ((await digestFile(file, signal)) !== artifact.sha256) {
            throw new Error(`Capture context checksum mismatch: ${name}.`);
        }
    }
};
//# sourceMappingURL=capture-context.js.map
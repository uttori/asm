import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, readFile } from "node:fs/promises";
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
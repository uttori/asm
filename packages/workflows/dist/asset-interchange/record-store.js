import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { ASSET_LIMITS, boundedSum, boundedProduct } from "@uttori/asm-assets/limits";
import { durableReplace, syncDirectory } from "@uttori/asm-disassembler/source-project";
import { assetPath } from "./paths.js";
export { assetPath } from "./paths.js";
/** Hash identities cover exact bytes, independently of Git commits and modification times. */
export function assetHash(bytes) {
    return createHash("sha256").update(bytes).digest("hex");
}
const storagePath = assetPath;
// oxlint-disable-next-line security/detect-unsafe-regex
const stagingPattern = /^\.staging-[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/;
/** Staging locators name private crash leftovers and are never valid completed-record identities. */
export function readAssetStagingId(value) {
    if (typeof value !== "string" || !stagingPattern.test(value)) {
        throw new Error("Invalid asset staging directory identity.");
    }
    return value;
}
/** Reads and retirement must not create missing state or traverse a redirected private parent. */
function recordDirectory(directory) {
    const absolute = storagePath(directory);
    for (let current = absolute;; current = path.dirname(current)) {
        const stat = fs.lstatSync(current);
        if (!stat.isDirectory() || stat.isSymbolicLink()) {
            throw new Error("Invalid asset record directory.");
        }
        if (path.dirname(current) === current) {
            break;
        }
    }
    return absolute;
}
/** Only publication-owned filenames are removable, including a writer killed before its temporary rename. */
function stagingFileLimit(name) {
    // durableReplace appends a UUID and .tmp; the destination still has to be a known private record file.
    // oxlint-disable-next-line security/detect-unsafe-regex
    const temporary = /^(.*)\.([\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12})\.tmp$/.exec(name), destination = temporary?.[1] ?? name;
    if (destination === "record.json") {
        return ASSET_LIMITS.baselineMetadataBytes;
    }
    if (destination === "record.sha256") {
        return 64;
    }
    if (/^[\da-f]{64}$/.test(destination)) {
        return ASSET_LIMITS.decodedBytes;
    }
    throw new Error("Unexpected file in asset staging directory; cleanup stopped.");
}
/** Refuse symlink components, including private staging parents. Missing directories are created durably. */
export function assetDirectory(directory) {
    const absolute = storagePath(directory), parent = path.dirname(absolute);
    if (parent !== absolute) {
        assetDirectory(parent);
    }
    if (!fs.existsSync(absolute)) {
        fs.mkdirSync(absolute);
        syncDirectory(parent);
    }
    const stat = fs.lstatSync(absolute);
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
        throw new Error(`Asset storage requires regular directory components: ${absolute}.`);
    }
    return absolute;
}
/** Bound reads before allocating, and detect replacement/growth while reading the opened file. */
export function readAssetFile(file, limit) {
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > limit) {
        throw new Error(`Asset input is not a bounded regular file: ${file}.`);
    }
    const fd = fs.openSync(file, "r");
    try {
        const opened = fs.fstatSync(fd);
        if (opened.dev !== stat.dev || opened.ino !== stat.ino || opened.size !== stat.size) {
            throw new Error(`Asset input changed while opening: ${file}.`);
        }
        const bytes = new Uint8Array(stat.size + 1);
        let count = 0;
        while (count < bytes.length) {
            const next = fs.readSync(fd, bytes, count, bytes.length - count, null);
            if (!next) {
                break;
            }
            count += next;
        }
        if (count !== stat.size || fs.fstatSync(fd).size !== stat.size) {
            throw new Error(`Asset input changed while reading: ${file}.`);
        }
        return bytes.subarray(0, count);
    }
    finally {
        fs.closeSync(fd);
    }
}
function safeKey(key) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
        throw new Error("Unsafe asset metadata key.");
    }
}
/** Encode a bounded acyclic value graph. Unsupported host objects never silently disappear into JSON. */
function pack(value, signal) {
    const nodes = [], identities = new WeakMap(), active = new WeakSet();
    const blobs = new Map();
    const binaryIdentities = new WeakMap(), decodedViews = new Set();
    let work = 0, decoded = 0, textBytes = 0;
    const atom = (input, depth) => {
        signal?.throwIfAborted();
        work = boundedSum(work, 1, ASSET_LIMITS.baselineMetadataNodes, "Asset metadata values");
        if (depth > 64) {
            throw new Error("Asset metadata nesting limit.");
        }
        if (input === null || typeof input === "boolean") {
            return input;
        }
        if (typeof input === "number" && Number.isFinite(input)) {
            return input;
        }
        if (typeof input === "string") {
            textBytes = boundedSum(textBytes, Buffer.byteLength(input), ASSET_LIMITS.baselineMetadataBytes, "Asset metadata strings");
            return input;
        }
        if (!input || typeof input !== "object") {
            throw new Error("Unsupported asset metadata value.");
        }
        if (input instanceof Uint8Array || input instanceof Uint32Array) {
            // Linked payload references reuse their hash and owned bytes without copying the same buffer again.
            const previous = binaryIdentities.get(input);
            if (previous) {
                return previous;
            }
            const type = input instanceof Uint32Array ? "u32" : "u8";
            boundedProduct(input.length, type === "u32" ? 4 : 1, ASSET_LIMITS.decodedBytes, "Asset blob bytes");
            let bytes;
            if (type === "u32") {
                bytes = new Uint8Array(input.length * 4);
                const view = new DataView(bytes.buffer);
                input.forEach((word, index) => view.setUint32(index * 4, word, true));
            }
            else {
                bytes = Uint8Array.from(input);
            }
            const digest = assetHash(bytes);
            const viewKey = `${type}:${digest}`;
            // One stored blob may decode as both bytes and words; count each allocated representation on write and read.
            if (!decodedViews.has(viewKey)) {
                decoded = boundedSum(decoded, bytes.length, ASSET_LIMITS.decodedBytes, "Asset baseline payload");
                decodedViews.add(viewKey);
            }
            if (!blobs.has(digest)) {
                blobs.set(digest, bytes);
            }
            const reference = { blob: digest, type, length: input.length };
            binaryIdentities.set(input, reference);
            return reference;
        }
        if (active.has(input)) {
            throw new Error("Cyclic asset metadata.");
        }
        const existing = identities.get(input);
        if (existing !== undefined) {
            return { node: existing };
        }
        const index = nodes.length;
        identities.set(input, index);
        active.add(input);
        nodes.push({ kind: "array", values: [] });
        if (Array.isArray(input)) {
            if (input.length > ASSET_LIMITS.baselineMetadataNodes) {
                throw new Error("Asset metadata array limit.");
            }
            nodes[index] = { kind: "array", values: Array.from(input, (item) => atom(item, depth + 1)) };
        }
        else {
            if (Object.getPrototypeOf(input) !== Object.prototype &&
                Object.getPrototypeOf(input) !== null) {
                throw new Error("Asset metadata requires plain objects.");
            }
            const values = [];
            for (const [key, item] of Object.entries(input)) {
                safeKey(key);
                // Optional object fields follow JSON omission; array holes/undefined are rejected above.
                if (item === undefined) {
                    continue;
                }
                textBytes = boundedSum(textBytes, Buffer.byteLength(key), ASSET_LIMITS.baselineMetadataBytes, "Asset metadata keys");
                values.push([key, atom(item, depth + 1)]);
            }
            nodes[index] = { kind: "object", values };
        }
        active.delete(input);
        return { node: index };
    };
    const root = atom(value, 0);
    const metadata = new TextEncoder().encode(JSON.stringify({ format: "uttori-asset-record", version: 1, root, nodes }));
    if (metadata.length > ASSET_LIMITS.baselineMetadataBytes) {
        throw new Error("Asset baseline metadata byte limit.");
    }
    return { metadata, blobs };
}
function record(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
}
/** Validate every graph reference and blob before returning unknown data to the domain-specific validator. */
function unpack(metadata, directory) {
    const envelope = JSON.parse(new TextDecoder("utf8", { fatal: true }).decode(metadata));
    if (!record(envelope) ||
        envelope.format !== "uttori-asset-record" ||
        envelope.version !== 1 ||
        !Array.isArray(envelope.nodes) ||
        envelope.nodes.length > ASSET_LIMITS.baselineMetadataNodes) {
        throw new Error("Unsupported or corrupt asset record; re-export is required.");
    }
    const nodes = envelope.nodes, states = new Uint8Array(nodes.length), values = new Map();
    const blobs = new Map();
    let work = 0, decoded = 0;
    const atom = (input, depth) => {
        work = boundedSum(work, 1, ASSET_LIMITS.baselineMetadataNodes, "Asset metadata values");
        if (depth > 64) {
            throw new Error("Asset metadata nesting limit.");
        }
        if (input === null || typeof input === "boolean" || typeof input === "string") {
            return input;
        }
        if (typeof input === "number" && Number.isFinite(input)) {
            return input;
        }
        if (!record(input)) {
            throw new Error("Invalid asset metadata reference.");
        }
        if (Object.keys(input).length === 1 &&
            Number.isSafeInteger(input.node) &&
            typeof input.node === "number") {
            const index = input.node;
            if (index < 0 || index >= nodes.length || states[index] === 1) {
                throw new Error("Invalid or cyclic asset metadata reference.");
            }
            if (states[index] === 2) {
                return values.get(index);
            }
            const entry = nodes[index];
            if (!record(entry) ||
                !Array.isArray(entry.values) ||
                entry.values.length > ASSET_LIMITS.baselineMetadataNodes) {
                throw new Error("Invalid asset metadata node.");
            }
            states[index] = 1;
            let result;
            if (entry.kind === "array") {
                result = entry.values.map((item) => atom(item, depth + 1));
            }
            else if (entry.kind === "object") {
                const object = {};
                for (const pair of entry.values) {
                    if (!Array.isArray(pair) ||
                        pair.length !== 2 ||
                        typeof pair[0] !== "string" ||
                        Object.hasOwn(object, pair[0])) {
                        throw new Error("Invalid asset metadata property.");
                    }
                    safeKey(pair[0]);
                    object[pair[0]] = atom(pair[1], depth + 1);
                }
                result = object;
            }
            else {
                throw new Error("Invalid asset metadata node kind.");
            }
            values.set(index, result);
            states[index] = 2;
            return result;
        }
        if (Object.keys(input).length !== 3 ||
            typeof input.blob !== "string" ||
            !/^[\da-f]{64}$/.test(input.blob) ||
            (input.type !== "u8" && input.type !== "u32") ||
            typeof input.length !== "number" ||
            !Number.isSafeInteger(input.length) ||
            input.length < 0 ||
            input.length > Math.floor(ASSET_LIMITS.decodedBytes / (input.type === "u32" ? 4 : 1))) {
            throw new Error("Invalid asset blob reference.");
        }
        const key = `${input.type}:${input.blob}`, previous = blobs.get(key);
        if (previous) {
            if (previous.length !== input.length) {
                throw new Error("Inconsistent asset blob length.");
            }
            return previous;
        }
        const size = input.length * (input.type === "u32" ? 4 : 1);
        decoded = boundedSum(decoded, size, ASSET_LIMITS.decodedBytes, "Asset baseline payload");
        const bytes = readAssetFile(path.join(directory, input.blob), size);
        if (bytes.length !== size || assetHash(bytes) !== input.blob) {
            throw new Error("Asset baseline blob hash mismatch.");
        }
        let result = bytes;
        if (input.type === "u32") {
            const words = new Uint32Array(input.length), view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
            words.forEach((_, index) => {
                words[index] = view.getUint32(index * 4, true);
            });
            result = words;
        }
        blobs.set(key, result);
        return result;
    };
    const result = atom(envelope.root, 0);
    if (states.some((state) => state !== 2)) {
        throw new Error("Unreferenced asset metadata node.");
    }
    return result;
}
/** Complete immutable records, scoped to this checkout. No implicit pruning or cross-checkout baseline authority. */
export class AssetRecordStore {
    directory;
    constructor(directory) {
        this.directory = directory;
    }
    /** Enumerate complete records only; interrupted staging directories never become usable export authority. */
    inventory(validate) {
        if (!fs.existsSync(this.directory)) {
            return [];
        }
        const root = storagePath(this.directory), stat = fs.lstatSync(root);
        if (!stat.isDirectory() || stat.isSymbolicLink()) {
            throw new Error("Invalid asset record store directory.");
        }
        const entries = fs.readdirSync(root);
        if (entries.length > 65536) {
            throw new Error("Asset record inventory exceeds its count budget.");
        }
        return entries.toSorted().flatMap((id) => {
            if (stagingPattern.test(id)) {
                return [];
            }
            const result = this.read(id, validate);
            return [{ id, ...result }];
        });
    }
    /** Preview one explicitly selected crash leftover under the caller's operation lease; incomplete metadata is not decoded. */
    stagingInventory(id) {
        const directory = recordDirectory(path.join(this.directory, readAssetStagingId(id)));
        const entries = fs.readdirSync(directory).toSorted();
        if (entries.length > ASSET_LIMITS.baselineMetadataNodes) {
            throw new Error("Asset staging file inventory exceeds its budget.");
        }
        let total = 0;
        const files = entries.map((name) => {
            const limit = stagingFileLimit(name), file = path.join(directory, name), stat = fs.lstatSync(file);
            // Count before reading so many individually bounded files cannot multiply the allocation/work budget.
            total = boundedSum(total, stat.size, ASSET_LIMITS.decodedBytes + ASSET_LIMITS.baselineMetadataBytes + 64, "Asset staging inventory bytes");
            const bytes = readAssetFile(file, limit);
            return { name, size: bytes.length, sha256: assetHash(bytes) };
        });
        return { id, hash: assetHash(JSON.stringify(files)), files };
    }
    /** Recheck the exact preview under the caller's lease; unlink only its regular files, never recurse into new content. */
    retireStaging(id, expectedHash) {
        const current = this.stagingInventory(id);
        if (current.hash !== expectedHash) {
            throw new Error("Asset staging directory changed after cleanup review.");
        }
        const directory = storagePath(path.join(this.directory, id));
        for (const file of current.files) {
            fs.unlinkSync(path.join(directory, file.name));
        }
        syncDirectory(directory);
        fs.rmdirSync(directory);
        syncDirectory(path.dirname(directory));
    }
    /**
     * Validate every file of an explicitly selected immutable record before coordinated retirement.
     * Unexpected files or symlinks stop cleanup; external saved documents and source history are never removed.
     */
    validateRetirement(id, expectedHash) {
        const current = this.read(id, (value) => value);
        if (current.hash !== expectedHash) {
            throw new Error("Asset record changed after cleanup review.");
        }
        const directory = storagePath(path.join(this.directory, id));
        const entries = fs.readdirSync(directory);
        if (entries.length > ASSET_LIMITS.baselineMetadataNodes) {
            throw new Error("Asset record file inventory exceeds its budget.");
        }
        for (const name of entries) {
            if (name === "record.json" || name === "record.sha256") {
                continue;
            }
            if (!/^[\da-f]{64}$/.test(name) ||
                assetHash(readAssetFile(path.join(directory, name), ASSET_LIMITS.decodedBytes)) !== name) {
                throw new Error("Unexpected or corrupt file in asset record; cleanup stopped.");
            }
        }
    }
    /** Recheck the preview immediately before retiring a complete record; callers coordinate the whole cleanup inventory. */
    retire(id, expectedHash) {
        this.validateRetirement(id, expectedHash);
        const directory = storagePath(path.join(this.directory, id));
        fs.rmSync(directory, { recursive: true });
        syncDirectory(path.dirname(directory));
    }
    /** Stage and flush all content before one directory rename makes the record discoverable. */
    publish(id, value, signal) {
        if (!/^[\da-f-]{36}$/.test(id) && !/^[\da-f]{64}$/.test(id)) {
            throw new Error("Invalid asset record identity.");
        }
        const packed = pack(value, signal), root = assetDirectory(this.directory), target = path.join(root, id);
        if (fs.existsSync(target)) {
            throw new Error(`Asset record already exists: ${id}.`);
        }
        const stage = path.join(root, `.staging-${randomUUID()}`);
        assetDirectory(stage);
        try {
            for (const [digest, bytes] of packed.blobs) {
                signal?.throwIfAborted();
                durableReplace(path.join(stage, digest), bytes, 0o600);
            }
            durableReplace(path.join(stage, "record.json"), packed.metadata, 0o600);
            durableReplace(path.join(stage, "record.sha256"), assetHash(packed.metadata), 0o600);
            signal?.throwIfAborted();
            fs.renameSync(stage, target);
            syncDirectory(root);
            return assetHash(packed.metadata);
        }
        finally {
            fs.rmSync(stage, { recursive: true, force: true });
        }
    }
    /** Private storage is still validated unknown data. The caller supplies the semantic schema validator. */
    read(id, validate) {
        if (!/^[\da-f-]{36}$/.test(id) && !/^[\da-f]{64}$/.test(id)) {
            throw new Error("Invalid asset record identity.");
        }
        const directory = recordDirectory(path.join(this.directory, id));
        const metadata = readAssetFile(path.join(directory, "record.json"), ASSET_LIMITS.baselineMetadataBytes);
        const expected = new TextDecoder().decode(readAssetFile(path.join(directory, "record.sha256"), 64));
        if (assetHash(metadata) !== expected) {
            throw new Error("Asset record metadata hash mismatch.");
        }
        return { value: validate(unpack(metadata, directory)), hash: assetHash(metadata) };
    }
}
//# sourceMappingURL=record-store.js.map
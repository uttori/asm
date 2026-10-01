import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { canonicalJson } from "@uttori/asm-core/canonical-json";
import { acquireFileLease, durableReplace } from "../internal/durable-files.js";
import { sourceContentHash } from "./generation.js";
import { assertSourcePath } from "./git.js";
const hashPattern = /^[\da-f]{64}$/;
/** Runtime array check without widening the validated readonly contract to any[]. */
const isArray = (value) => Array.isArray(value);
const validHash = (value) => typeof value === "string" && hashPattern.test(value);
const validCount = (value) => Number.isSafeInteger(value) && Number(value) >= 0;
/** Validate names as single portable components; catalog data never selects paths outside a supplied bundle. */
function validName(value) {
    return (typeof value === "string" &&
        value.length > 0 &&
        value.length <= 1024 &&
        !/[\0\n\r/\\]/.test(value) &&
        value !== "." &&
        value !== "..");
}
/** Authoring files and locks stay inside the selected checkout, including through existing ancestors. */
function catalogPath(root, name) {
    assertSourcePath(name);
    let current = path.resolve(root);
    for (const component of name.split("/")) {
        current = path.join(current, component);
        try {
            if (fs.lstatSync(current).isSymbolicLink()) {
                throw new Error("Capture catalogs cannot follow symlinks.");
            }
        }
        catch (error) {
            if (error.code !== "ENOENT") {
                throw error;
            }
        }
    }
    return current;
}
/** Validate before trusting a catalog from a branch, clone or external private-input bundle. */
export function parseSourceCaptureCatalog(value, romSha256) {
    const catalog = value;
    if (!catalog ||
        catalog.format !== "uttori-capture-catalog" ||
        catalog.version !== 1 ||
        !validHash(catalog.romSha256) ||
        catalog.romSha256 !== romSha256 ||
        !isArray(catalog.captures) ||
        catalog.captures.length > 10000) {
        throw new Error("Invalid source capture catalog or original-ROM identity.");
    }
    const identities = new Set();
    const archiveOwners = new Map();
    for (const capture of catalog.captures) {
        if (!capture ||
            !validHash(capture.sha256) ||
            identities.has(capture.sha256) ||
            !validName(capture.sourceName) ||
            typeof capture.profile !== "string" ||
            !capture.profile ||
            capture.profile.length > 128 ||
            !validCount(capture.observedEvents) ||
            !validCount(capture.droppedEvents) ||
            !isArray(capture.archives) ||
            capture.archives.length > 32) {
            throw new Error("Invalid or duplicate canonical capture identity.");
        }
        identities.add(capture.sha256);
        const archiveIds = new Set();
        for (const archive of capture.archives) {
            if (!archive ||
                !validName(archive.name) ||
                !validHash(archive.sha256) ||
                !validCount(archive.bytes) ||
                archive.bytes === 0 ||
                (archive.companionSha256 !== undefined && !validHash(archive.companionSha256)) ||
                archiveIds.has(archive.sha256)) {
                throw new Error("Invalid or duplicate capture archive binding.");
            }
            const owner = archiveOwners.get(archive.sha256);
            if (owner && owner !== capture.sha256) {
                throw new Error("One archive is bound to conflicting canonical capture identities.");
            }
            archiveOwners.set(archive.sha256, capture.sha256);
            archiveIds.add(archive.sha256);
        }
    }
    return catalog;
}
/** Catalog absence is explicit during first import or extraction; malformed existing data never resets. */
export function readSourceCaptureCatalog(root, name, romSha256) {
    const file = catalogPath(root, name);
    let bytes;
    try {
        const stat = fs.lstatSync(file);
        if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 8 * 1024 * 1024) {
            throw new Error("Capture catalog must be a regular file within its 8 MiB budget.");
        }
        bytes = fs.readFileSync(file);
    }
    catch (error) {
        if (error.code !== "ENOENT") {
            throw error;
        }
        return { catalog: { format: "uttori-capture-catalog", version: 1, romSha256, captures: [] } };
    }
    return {
        catalog: parseSourceCaptureCatalog(JSON.parse(bytes.toString("utf8")), romSha256),
        fileSha256: sourceContentHash(bytes),
    };
}
/** Extract durable import identities without changing or materializing normalized runtime evidence. */
export function reconcileSourceCaptureCatalog(catalog, reports, binding) {
    const captures = new Map(catalog.captures.map((capture) => [capture.sha256, capture]));
    for (const report of reports) {
        if (!["uttori-asm-instruction-trace", "uttori-asm-bus-trace"].includes(report.format)) {
            continue;
        }
        // Reports can retain a historical absolute source name. Only its portable basename is published.
        const sourceName = report.sourceName.split(/[/\\]/).at(-1);
        const capture = {
            sha256: report.sourceSha256,
            sourceName,
            profile: report.indexProfile ?? "full",
            observedEvents: report.imported.busEvents ?? report.imported.executionEvents ?? 0,
            droppedEvents: report.unsupported.find((entry) => entry.field === "instruction-addresses")?.count ?? 0,
            archives: captures.get(report.sourceSha256)?.archives ?? [],
        };
        const previous = captures.get(capture.sha256);
        if (previous && canonicalJson({ ...previous, sourceName }) !== canonicalJson(capture)) {
            throw new Error(`Retained capture provenance differs from the Git catalog: ${capture.sha256}`);
        }
        captures.set(capture.sha256, previous ?? capture);
    }
    if (binding) {
        const capture = captures.get(binding.sourceSha256);
        if (!capture) {
            throw new Error("Cannot catalog an archive before a successful evidence import.");
        }
        const prior = capture.archives.find((archive) => archive.sha256 === binding.archive.sha256);
        // A filename is only a discovery hint. Renaming an identical archive must remain idempotent,
        // while changed size or companion identity still requires explicit reconciliation.
        if (prior && canonicalJson(prior) !== canonicalJson({ ...binding.archive, name: prior.name })) {
            throw new Error("An existing archive binding changed; reconcile its companion identity explicitly.");
        }
        if (!prior) {
            captures.set(capture.sha256, {
                ...capture,
                archives: [...capture.archives, binding.archive].sort((a, b) => a.sha256.localeCompare(b.sha256)),
            });
        }
    }
    return parseSourceCaptureCatalog({
        ...catalog,
        captures: [...captures.values()].sort((a, b) => a.sha256.localeCompare(b.sha256)),
    }, catalog.romSha256);
}
/** Save only against the read snapshot; evidence imports and Git-file writes are separate durable operations. */
export function writeSourceCaptureCatalog(root, name, catalog, expectedSha256) {
    parseSourceCaptureCatalog(catalog, catalog.romSha256);
    const file = catalogPath(root, name);
    const lock = catalogPath(root, ".uttori-local/capture-catalog.lock");
    fs.mkdirSync(path.dirname(lock), { recursive: true });
    const lease = acquireFileLease(lock);
    try {
        const current = readSourceCaptureCatalog(root, name, catalog.romSha256);
        if (current.fileSha256 !== expectedSha256) {
            throw new Error("Capture catalog changed during import. Refresh its inventory before committing.");
        }
        const bytes = JSON.stringify(catalog, null, 2) + "\n";
        if (Buffer.byteLength(bytes) > 8 * 1024 * 1024) {
            throw new Error("Capture catalog exceeds its 8 MiB budget.");
        }
        if (sourceContentHash(bytes) !== current.fileSha256) {
            durableReplace(file, bytes);
        }
    }
    finally {
        lease.release();
    }
}
/** Stream archive identity with cancellation. Companion artifacts are separately verified by the importer. */
export async function fingerprintSourceCapture(file, signal, maxBytes = 2 * 1024 ** 3) {
    signal?.throwIfAborted();
    if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
        throw new Error("Capture byte budget must be a positive safe integer.");
    }
    const before = fs.lstatSync(file, { bigint: true });
    if (!before.isFile() || before.isSymbolicLink() || before.size <= 0n) {
        throw new Error("Capture archive must be a nonempty regular file.");
    }
    if (before.size > BigInt(maxBytes)) {
        throw new Error("Capture archive exceeds the project's byte budget.");
    }
    const hash = createHash("sha256");
    let bytes = 0;
    for await (const chunk of fs.createReadStream(file, { signal })) {
        const buffer = chunk;
        hash.update(buffer);
        bytes += buffer.length;
        if (bytes > maxBytes) {
            throw new Error("Capture archive grew beyond the project's byte budget.");
        }
    }
    const after = fs.lstatSync(file, { bigint: true });
    if (before.dev !== after.dev ||
        before.ino !== after.ino ||
        before.mtimeNs !== after.mtimeNs ||
        before.ctimeNs !== after.ctimeNs ||
        before.size !== after.size ||
        BigInt(bytes) !== before.size) {
        throw new Error("Capture archive changed while hashing.");
    }
    const manifestFile = `${file}.context/manifest.json`;
    let companionSha256;
    try {
        const stat = fs.lstatSync(manifestFile);
        if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 1048576) {
            throw new Error("Invalid capture companion manifest.");
        }
        companionSha256 = sourceContentHash(fs.readFileSync(manifestFile));
    }
    catch (error) {
        if (error.code !== "ENOENT") {
            throw error;
        }
    }
    return {
        name: path.basename(file),
        sha256: hash.digest("hex"),
        bytes,
        ...(companionSha256 ? { companionSha256 } : {}),
    };
}
//# sourceMappingURL=captures.js.map
import { canonicalJson } from "@uttori/asm-core/canonical-json";
import { sourceContentHash } from "./generation.js";
import { assertSourcePath } from "./git.js";
/** Immutable input copies travel with a pure generation; editable research files remain authoritative. */
export const SOURCE_INPUT_SNAPSHOT_FILE = ".uttori/generation-snapshot.json";
const MAX_INPUT_BYTES = 40 * 1024 * 1024;
/** Serialize exact compact inputs, including original whitespace, without copying evidence or private ROMs. */
export function createSourceInputSnapshot(files) {
    const paths = new Set();
    let size = 0;
    const entries = [...files]
        .toSorted((a, b) => Buffer.compare(Buffer.from(a.path), Buffer.from(b.path)))
        .map((file) => {
        assertSourcePath(file.path);
        const identity = file.path.normalize("NFC").toLowerCase();
        size += file.bytes.length;
        if (paths.has(identity) || paths.size >= 1024 || size > MAX_INPUT_BYTES || file.executable) {
            throw new Error("Generation input snapshot contains duplicate paths or exceeds its compact-file budget.");
        }
        paths.add(identity);
        return {
            path: file.path,
            sha256: sourceContentHash(file.bytes),
            base64: Buffer.from(file.bytes).toString("base64"),
        };
    });
    return {
        path: SOURCE_INPUT_SNAPSHOT_FILE,
        bytes: Buffer.from(canonicalJson({
            format: "uttori-generation-input-snapshot",
            version: 1,
            files: entries,
        })),
    };
}
function isSnapshotRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
/** Decode an immutable snapshot for inspection/reproduction. This function never writes into the source checkout. */
export function readSourceInputSnapshot(bytes) {
    if (bytes.length > MAX_INPUT_BYTES * 1.5) {
        throw new Error("Generation input snapshot exceeds its serialized budget.");
    }
    const value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (!isSnapshotRecord(value) ||
        value.format !== "uttori-generation-input-snapshot" ||
        value.version !== 1 ||
        !Array.isArray(value.files) ||
        value.files.length > 1024) {
        throw new Error("Invalid generation input snapshot.");
    }
    const files = value.files.map((entry) => {
        if (!isSnapshotRecord(entry) ||
            typeof entry.path !== "string" ||
            typeof entry.base64 !== "string") {
            throw new Error("Invalid generation input snapshot entry.");
        }
        const sha256 = entry.sha256;
        const contents = Buffer.from(entry.base64, "base64");
        // Node's decoder accepts malformed/truncated base64. Canonical re-encoding rejects that ambiguity.
        if (typeof sha256 !== "string" ||
            contents.toString("base64") !== entry.base64 ||
            sourceContentHash(contents) !== sha256) {
            throw new Error(`Generation input snapshot content changed: ${entry.path}`);
        }
        return { path: entry.path, bytes: contents };
    });
    createSourceInputSnapshot(files);
    return files;
}
//# sourceMappingURL=input-snapshot.js.map
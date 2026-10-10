import fs from "node:fs";
import path from "node:path";
import { canonicalJson } from "@uttori/asm-core/canonical-json";
import { acquireFileLease, durableReplace } from "../internal/durable-files.js";
import { sourceContentHash, assertSourcePath } from "../internal/source-inputs.js";
import { validateEditableMetadataRecord } from "../model/metadata-validation.js";
import { validateSourceLabelName } from "../model/project-labels.js";
import { isResearchMapping } from "../model/research-mapping.js";
/** Check runtime shape without widening typed readonly arrays to any[]. */
const isArray = (value) => Array.isArray(value);
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isUnknownArray(value) {
    return Array.isArray(value);
}
function isResearchCollection(value) {
    return RESEARCH_COLLECTIONS.some((collection) => collection === value);
}
function isSafeInteger(value) {
    return typeof value === "number" && Number.isSafeInteger(value);
}
function isConfidence(value) {
    return (value === "certain" ||
        value === "high" ||
        value === "medium" ||
        value === "low" ||
        value === "unknown");
}
/** Only explicit human decisions belong in these files; captures and derived CFG do not. */
export const RESEARCH_COLLECTIONS = [
    "labels",
    "comments",
    "annotations",
    "regions",
    "analysis",
    "evidence",
];
/** Shared with project configuration so CLI, editor queries and unsaved buffers enforce the same policy. */
export const RESEARCH_INPUT_LIMIT_NAMES = [
    "researchDocumentBytes",
    "researchBytes",
    "researchFiles",
];
/** Recheck identities at the storage boundary, including snapshots supplied by JavaScript callers. */
export function validateResearchSnapshot(snapshot) {
    if (!snapshot ||
        typeof snapshot.project !== "string" ||
        !/^[\w.-]+$/.test(snapshot.project) ||
        typeof snapshot.romSha256 !== "string" ||
        !/^[\da-f]{64}$/.test(snapshot.romSha256) ||
        !isArray(snapshot.decisions)) {
        throw new Error("Invalid research snapshot identity.");
    }
    const keys = new Set();
    for (const decision of snapshot.decisions) {
        validateResearchDecision(decision);
        const key = `${decision.collection}:${decision.id}`;
        if (keys.has(key)) {
            throw new Error(`Duplicate research decision: ${key}`);
        }
        keys.add(key);
    }
    const decisions = [...snapshot.decisions].toSorted(compareDecisions);
    if (snapshot.hash !==
        sourceContentHash(canonicalJson({ project: snapshot.project, romSha256: snapshot.romSha256, decisions }))) {
        throw new Error("Research snapshot content differs from its identity.");
    }
}
/** Byte ordering is stable across hosts and independent of the process's locale. */
const compareDecisions = (a, b) => Buffer.compare(Buffer.from(`${a.collection}:${a.id}`), Buffer.from(`${b.collection}:${b.id}`));
/** Reject unsupported record kinds before the generic project validator accesses their fields. */
export function validateResearchDecision(decision) {
    if (!isRecord(decision)) {
        throw new Error("Research decisions require a known collection and stable ID.");
    }
    const collection = decision.collection;
    const id = decision.id;
    if (!isResearchCollection(collection) || typeof id !== "string" || !/^\w[\w./:-]*$/.test(id)) {
        throw new Error("Research decisions require a known collection and stable ID.");
    }
    const record = decision.value;
    if (record === null) {
        return;
    }
    if (!isRecord(record) || record.id !== id) {
        throw new Error(`Research record identity mismatch: ${id}`);
    }
    if (collection === "evidence") {
        const sourceId = record.sourceId;
        const detail = record.detail;
        if (record.source !== "manual" ||
            typeof sourceId !== "string" ||
            sourceId === "" ||
            !isConfidence(record.confidence) ||
            (detail !== undefined && typeof detail !== "string")) {
            throw new Error("Research files may author only valid manual evidence.");
        }
        return;
    }
    const evidence = record.evidence;
    if (!isUnknownArray(evidence) || evidence.some((entry) => typeof entry !== "string")) {
        throw new Error(`Research record ${id} needs an evidence list.`);
    }
    if (record.mapping !== undefined && !isResearchMapping(record.mapping)) {
        throw new Error("Invalid research mapping selector.");
    }
    if (collection === "regions") {
        const name = record.name;
        const start = record.start;
        const end = record.end;
        if (typeof name !== "string" ||
            name === "" ||
            !(isSafeInteger(start) && isSafeInteger(end) && start >= 0 && end > start)) {
            throw new Error(`Invalid research region: ${id}`);
        }
    }
    else {
        validateEditableMetadataRecord(collection, record);
    }
    if (collection === "labels" && record.aliases !== undefined) {
        const aliases = record.aliases;
        if (!isUnknownArray(aliases)) {
            throw new Error("Symbol aliases must be an array.");
        }
        for (const alias of aliases) {
            if (typeof alias !== "string") {
                throw new Error("Use a global label name containing letters, digits, and underscores, starting with a letter or underscore.");
            }
            validateSourceLabelName(alias);
        }
        if (new Set(aliases).size !== aliases.length) {
            throw new Error("Symbol aliases must be unique.");
        }
    }
}
/** Parse a versioned authoring document; unknown top-level fields are rejected to catch misspellings. */
export function parseResearchDocument(value) {
    if (!isRecord(value)) {
        throw new Error("Invalid research document header.");
    }
    const project = value.project;
    const romSha256 = value.romSha256;
    const decisions = value.decisions;
    if (value.format !== "uttori-research" ||
        value.version !== 1 ||
        typeof project !== "string" ||
        !/^[\w.-]+$/.test(project) ||
        typeof romSha256 !== "string" ||
        !/^[\da-f]{64}$/.test(romSha256) ||
        !isUnknownArray(decisions) ||
        Object.keys(value).some((key) => !["format", "version", "project", "romSha256", "decisions"].includes(key))) {
        throw new Error("Invalid research document header.");
    }
    const parsed = [];
    const seen = new Set();
    for (const [index, decision] of decisions.entries()) {
        try {
            validateResearchDecision(decision);
        }
        catch (error) {
            const detail = error instanceof Error ? error.message : String(error);
            throw new Error(`decisions[${index}]: ${detail}`, { cause: error });
        }
        const key = `${decision.collection}:${decision.id}`;
        if (seen.has(key)) {
            throw new Error(`Duplicate research decision: ${key}`);
        }
        seen.add(key);
        parsed.push(decision);
    }
    return { format: "uttori-research", version: 1, project, romSha256, decisions: parsed };
}
/** Resolve existing authoring paths without following symlinks outside the selected repository. */
function researchPath(root, relative) {
    assertSourcePath(relative);
    let current = root;
    for (const part of relative.split("/")) {
        current = path.join(current, part);
        if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) {
            throw new Error(`Research inputs cannot follow symlinks: ${relative}`);
        }
    }
    return current;
}
/**
 * Read selected Git research, preserving file locations for F2/navigation. Resource ceilings are opt-in;
 * document grouping and formatting must not impose an implicit limit on a project's research growth.
 */
export function readResearchInputs(root, roots, identity, overlays = new Map(), limits = {}) {
    for (const name of RESEARCH_INPUT_LIMIT_NAMES) {
        const limit = limits[name];
        if (limit !== undefined && (!Number.isSafeInteger(limit) || limit < 1)) {
            throw new Error(`Invalid limits.${name}: use a positive safe integer in .uttori/project.json.`);
        }
    }
    const names = new Set();
    const files = [];
    let totalBytes = 0;
    /** Check each ceiling independently so diagnostics name the actual failed policy and its remedy. */
    const checkLimit = (name, actual, file, unit) => {
        const limit = limits[name];
        if (limit !== undefined && actual > limit) {
            throw new Error(`Research input ${file}: ${actual.toLocaleString("en-US")} ${unit} exceeds limits.${name} (${limit.toLocaleString("en-US")} ${unit}). Increase or remove limits.${name} in .uttori/project.json, or reduce the selected research inputs.`);
        }
    };
    const visit = (initial) => {
        // Iterative traversal handles deeply grouped research without a call-stack or directory-count cap.
        // Every path still passes the symlink and repository-containment checks before being inspected.
        const pending = [initial];
        while (pending.length) {
            const relative = pending.pop();
            const file = researchPath(root, relative);
            const overlay = overlays.get(relative);
            const stat = fs.existsSync(file) ? fs.lstatSync(file) : undefined;
            if (!stat && overlay === undefined) {
                throw new Error(`Research input does not exist: ${file}. Restore the selected path or correct researchRoots in .uttori/project.json.`);
            }
            if (stat?.isDirectory()) {
                for (const entry of fs.readdirSync(file).toSorted().toReversed()) {
                    pending.push(`${relative}/${entry}`);
                }
                continue;
            }
            if (stat && !stat.isFile()) {
                throw new Error(`Research input is not a regular file: ${file}. Select JSON files or directories in researchRoots.`);
            }
            if (!relative.endsWith(".json")) {
                continue;
            }
            const name = relative.normalize("NFC").toLowerCase();
            if (names.has(name)) {
                throw new Error(`Repeated or ambiguous research input: ${file}. Remove overlapping researchRoots or conflicting filenames.`);
            }
            names.add(name);
            const size = overlay === undefined ? stat.size : Buffer.byteLength(overlay);
            totalBytes += size;
            checkLimit("researchDocumentBytes", size, file, "bytes in this document");
            checkLimit("researchBytes", totalBytes, file, "bytes across selected documents");
            checkLimit("researchFiles", names.size, file, "selected JSON files");
            let bytes;
            let document;
            try {
                bytes = overlay === undefined ? fs.readFileSync(file) : Buffer.from(overlay);
                document = parseResearchDocument(JSON.parse(bytes.toString("utf8")));
            }
            catch (error) {
                const detail = error instanceof Error ? error.message : String(error);
                throw new Error(`Invalid research input ${file}: ${detail}`, { cause: error });
            }
            if (document.project !== identity.project || document.romSha256 !== identity.romSha256) {
                throw new Error(`Research input belongs to another project or ROM: ${file}. Expected project ${identity.project} and ROM ${identity.romSha256}; found project ${document.project} and ROM ${document.romSha256}.`);
            }
            files.push({ path: relative, sha256: sourceContentHash(bytes), document });
        }
    };
    for (const relative of roots) {
        visit(relative);
    }
    // New, unsaved research documents participate in a second F2 operation before their first save.
    for (const relative of overlays.keys()) {
        if (roots.some((name) => relative === name || relative.startsWith(`${name}/`)) &&
            !names.has(relative.normalize("NFC").toLowerCase())) {
            visit(relative);
        }
    }
    files.sort((a, b) => Buffer.compare(Buffer.from(a.path), Buffer.from(b.path)));
    const decisions = files.flatMap((file) => file.document.decisions);
    const ids = new Map();
    for (const file of files) {
        for (const decision of file.document.decisions) {
            const key = `${decision.collection}:${decision.id}`;
            const previous = ids.get(key);
            if (previous !== undefined) {
                throw new Error(`Research decision has more than one authoring location: ${key} in ${previous} and ${file.path}. Keep the decision in one document.`);
            }
            ids.set(key, file.path);
        }
    }
    decisions.sort(compareDecisions);
    const selected = { project: identity.project, romSha256: identity.romSha256 };
    const hash = sourceContentHash(canonicalJson({ ...selected, decisions }));
    return { ...selected, files, decisions, hash };
}
/** Save one document with optimistic content matching. Git commits remain explicit user actions. */
export function writeResearchDocument(root, relative, document, expectedSha256) {
    parseResearchDocument(document);
    if (!relative.endsWith(".json")) {
        throw new Error("Research documents use .json files.");
    }
    const file = researchPath(root, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const lease = acquireFileLease(`${file}.lock`);
    try {
        const current = fs.existsSync(file) ? sourceContentHash(fs.readFileSync(file)) : null;
        if (current !== expectedSha256) {
            throw new Error("Research input changed. Reload before saving this decision.");
        }
        durableReplace(file, canonicalJson(document));
    }
    finally {
        lease.release();
    }
}
//# sourceMappingURL=inputs.js.map
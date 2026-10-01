import fs from "node:fs";
import path from "node:path";
import { canonicalJson } from "@uttori/asm-core/canonical-json";
import { acquireFileLease, durableReplace } from "../internal/durable-files.js";
import { sourceContentHash, assertSourcePath } from "../internal/source-inputs.js";
import { validateEditableMetadataRecord } from "../model/metadata-validation.js";
import { validateSourceLabelName } from "../model/project-labels.js";
/** Check runtime shape without widening typed readonly arrays to any[]. */
const isArray = (value) => Array.isArray(value);
/** Only explicit human decisions belong in these files; captures and derived CFG do not. */
export const RESEARCH_COLLECTIONS = [
    "labels",
    "comments",
    "annotations",
    "regions",
    "analysis",
    "evidence",
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
    const decisions = [...snapshot.decisions].sort(compareDecisions);
    if (snapshot.hash !==
        sourceContentHash(canonicalJson({ project: snapshot.project, romSha256: snapshot.romSha256, decisions }))) {
        throw new Error("Research snapshot content differs from its identity.");
    }
}
/** Byte ordering is stable across hosts and independent of the process's locale. */
const compareDecisions = (a, b) => Buffer.compare(Buffer.from(`${a.collection}:${a.id}`), Buffer.from(`${b.collection}:${b.id}`));
/** Reject unsupported record kinds before the generic project validator accesses their fields. */
export function validateResearchDecision(decision) {
    if (!decision ||
        !RESEARCH_COLLECTIONS.includes(decision.collection) ||
        typeof decision.id !== "string" ||
        !/^\w[\w./:-]*$/.test(decision.id)) {
        throw new Error("Research decisions require a known collection and stable ID.");
    }
    const record = decision.value;
    if (record === null) {
        return;
    }
    if (!record || record.id !== decision.id) {
        throw new Error(`Research record identity mismatch: ${decision.id}`);
    }
    if (decision.collection === "evidence") {
        const evidence = record;
        if (evidence.source !== "manual" ||
            typeof evidence.sourceId !== "string" ||
            !evidence.sourceId ||
            !["certain", "high", "medium", "low", "unknown"].includes(evidence.confidence) ||
            (evidence.detail !== undefined && typeof evidence.detail !== "string")) {
            throw new Error("Research files may author only valid manual evidence.");
        }
        return;
    }
    if (!("evidence" in record) ||
        !isArray(record.evidence) ||
        record.evidence.some((id) => typeof id !== "string")) {
        throw new Error(`Research record ${decision.id} needs an evidence list.`);
    }
    if (decision.collection === "regions") {
        if (!("start" in record) ||
            !("end" in record) ||
            !("name" in record) ||
            typeof record.name !== "string" ||
            !record.name ||
            !Number.isSafeInteger(record.start) ||
            !Number.isSafeInteger(record.end) ||
            record.start < 0 ||
            record.end <= record.start) {
            throw new Error(`Invalid research region: ${decision.id}`);
        }
    }
    else {
        validateEditableMetadataRecord(decision.collection, record);
    }
    if (decision.collection === "labels") {
        const label = record;
        if (label.aliases !== undefined) {
            if (!isArray(label.aliases)) {
                throw new Error("Symbol aliases must be an array.");
            }
            for (const alias of label.aliases) {
                validateSourceLabelName(alias);
            }
            if (new Set(label.aliases).size !== label.aliases.length) {
                throw new Error("Symbol aliases must be unique.");
            }
        }
    }
}
/** Parse a versioned authoring document; unknown top-level fields are rejected to catch misspellings. */
export function parseResearchDocument(value) {
    const document = value;
    if (!document ||
        document.format !== "uttori-research" ||
        document.version !== 1 ||
        typeof document.project !== "string" ||
        !/^[\w.-]+$/.test(document.project) ||
        typeof document.romSha256 !== "string" ||
        !/^[\da-f]{64}$/.test(document.romSha256) ||
        !isArray(document.decisions) ||
        Object.keys(document).some((key) => !["format", "version", "project", "romSha256", "decisions"].includes(key))) {
        throw new Error("Invalid research document header.");
    }
    const seen = new Set();
    for (const decision of document.decisions) {
        validateResearchDecision(decision);
        const key = `${decision.collection}:${decision.id}`;
        if (seen.has(key)) {
            throw new Error(`Duplicate research decision: ${key}`);
        }
        seen.add(key);
    }
    return document;
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
/** Read bounded JSON inputs only from explicitly selected roots, preserving file locations for F2/navigation. */
export function readResearchInputs(root, roots, identity, overlays = new Map()) {
    const names = new Set();
    const files = [];
    let totalBytes = 0;
    let visited = 0;
    const visit = (relative) => {
        if (++visited > 4096 || relative.split("/").length > 32) {
            throw new Error("Research input traversal exceeds its bounded directory budget.");
        }
        const file = researchPath(root, relative);
        const overlay = overlays.get(relative);
        const stat = fs.existsSync(file) ? fs.lstatSync(file) : undefined;
        if (stat?.isDirectory()) {
            for (const entry of fs.readdirSync(file).sort()) {
                visit(`${relative}/${entry}`);
            }
            return;
        }
        if (!relative.endsWith(".json")) {
            return;
        }
        const name = relative.normalize("NFC").toLowerCase();
        if (names.has(name)) {
            throw new Error(`Repeated or ambiguous research input: ${relative}`);
        }
        names.add(name);
        const size = overlay === undefined ? stat?.size : Buffer.byteLength(overlay);
        totalBytes += size ?? 0;
        if ((stat && !stat.isFile()) ||
            size === undefined ||
            size > 1024 * 1024 ||
            totalBytes > 32 * 1024 * 1024 ||
            names.size > 512) {
            throw new Error("Research inputs exceed the bounded document budget. Split decisions by subject or bank.");
        }
        const bytes = overlay === undefined ? fs.readFileSync(file) : Buffer.from(overlay);
        const document = parseResearchDocument(JSON.parse(bytes.toString("utf8")));
        if (document.project !== identity.project || document.romSha256 !== identity.romSha256) {
            throw new Error(`Research input belongs to another project or ROM: ${relative}`);
        }
        files.push({ path: relative, sha256: sourceContentHash(bytes), document });
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
    const ids = new Set();
    for (const decision of decisions) {
        const key = `${decision.collection}:${decision.id}`;
        if (ids.has(key)) {
            throw new Error(`Research decision has more than one authoring location: ${key}`);
        }
        ids.add(key);
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
/** Generated import reports live beside private evidence; capture archives are disposable inputs. */
import fs from "node:fs";
import path from "node:path";
import { canonicalJson } from "@uttori/asm-core/canonical-json";
import { durableReplace } from "../internal/durable-files.js";
/** Hash-only filenames keep private archive paths out of reports and prevent path traversal. */
function notesPath(directory, sha256) {
    if (!/^[\da-f]{64}$/.test(sha256)) {
        throw new Error("Invalid capture notes identity.");
    }
    return path.join(directory, "capture-notes", `${sha256}.json`);
}
/**
 * Accept only non-null, non-array objects.
 * @param value Candidate value.
 * @returns Whether value is a plain record.
 */
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
/**
 * Accept arrays whose every element is a string.
 * @param value Candidate value.
 * @returns Whether value is a string array.
 */
function isStrings(value) {
    return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}
/** Validate ROM intervals before turning generated data into navigation commands. */
function isAddedCode(value) {
    return (isRecord(value) &&
        typeof value.start === "number" &&
        Number.isSafeInteger(value.start) &&
        value.start >= 0 &&
        typeof value.end === "number" &&
        Number.isSafeInteger(value.end) &&
        value.end > value.start &&
        typeof value.addressSpace === "string" &&
        typeof value.address === "number" &&
        Number.isSafeInteger(value.address) &&
        value.address >= 0 &&
        isStrings(value.recordIds));
}
/** Validate bounded local report data before exposing it to worker IPC or editor commands. */
export function isCaptureImportNotes(value) {
    if (!isRecord(value) ||
        value.format !== "uttori-capture-notes" ||
        value.version !== 1 ||
        typeof value.sourceSha256 !== "string" ||
        typeof value.sourceName !== "string" ||
        typeof value.importedAt !== "number" ||
        !Number.isFinite(value.importedAt) ||
        !isStrings(value.notes)) {
        return false;
    }
    const analysis = value.analysis;
    return (analysis === undefined ||
        (isRecord(analysis) &&
            (analysis.status === "complete" || analysis.status === "incomplete") &&
            isStrings(analysis.sources) &&
            Array.isArray(analysis.addedCode) &&
            analysis.addedCode.every(isAddedCode)));
}
/** Missing reports are ordinary legacy imports. Malformed existing reports fail rather than resetting history. */
export function readCaptureImportNotes(directory, sha256) {
    const file = notesPath(directory, sha256);
    if (!fs.existsSync(file)) {
        return undefined;
    }
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 16 * 1024 * 1024) {
        throw new Error("Capture notes exceed their 16 MiB regular-file budget.");
    }
    const notes = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!isCaptureImportNotes(notes) || notes.sourceSha256 !== sha256) {
        throw new Error("Invalid capture import notes.");
    }
    return notes;
}
/** Record the first successful import only; reimports retain the original analysis comparison. */
export function writeCaptureImportNotes(directory, report) {
    if (readCaptureImportNotes(directory, report.sourceSha256)) {
        return;
    }
    const notes = {
        format: "uttori-capture-notes",
        version: 1,
        sourceSha256: report.sourceSha256,
        sourceName: report.sourceName.split(/[/\\]/).at(-1),
        importedAt: Date.now(),
        notes: [
            ...Object.entries(report.imported).map(([field, count]) => `${count.toLocaleString("en-US")} ${field} imported`),
            ...report.warnings,
            ...report.unsupported.map((loss) => `${loss.field}: ${loss.reason} (${loss.count})`),
        ],
    };
    durableReplace(notesPath(directory, report.sourceSha256), canonicalJson(notes));
}
/** Snapshot pending identities before analysis so captures imported during a pass remain pending. */
export function pendingCaptureImportNotes(directory) {
    const folder = path.join(directory, "capture-notes");
    if (!fs.existsSync(folder)) {
        return [];
    }
    return fs
        .readdirSync(folder)
        .filter((name) => /^[\da-f]{64}\.json$/.test(name))
        .flatMap((name) => {
        const notes = readCaptureImportNotes(directory, name.slice(0, 64));
        return notes && !notes.analysis ? [notes] : [];
    });
}
/** Publish new-code links only after successful analysis; failures leave reports pending for retry. */
export function completeCaptureImportNotes(directory, pending, status, addedCode) {
    const sources = pending.map((notes) => notes.sourceName).toSorted();
    for (const notes of pending) {
        durableReplace(notesPath(directory, notes.sourceSha256), canonicalJson({
            ...notes,
            analysis: { status, sources, addedCode },
        }));
    }
}
//# sourceMappingURL=capture-notes.js.map
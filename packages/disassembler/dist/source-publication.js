import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { durableReplace, syncDirectory } from "./durable-files.js";
import { loadSourceExportManifest, sourceExportSha256, validateSourceExportFiles, } from "./source-export.js";
import { SOURCE_PUBLICATION_STATE, readSourcePublication, } from "./source-generation.js";
/** Hash missing files distinctly from empty files.
 * @param {string} file Regular file to read.
 * @returns {string | null} Exact digest or absence.
 */
export function optionalFileHash(file) {
    if (!fs.existsSync(file)) {
        return null;
    }
    if (!fs.lstatSync(file).isFile()) {
        throw new Error(`Expected a regular file: ${file}`);
    }
    return sourceExportSha256(fs.readFileSync(file));
}
/** Validate a journal path before any write, including existing parent symlinks.
 * @param {string} root Real source directory.
 * @param {string} relative Manifest-relative file.
 * @returns {string} Safe absolute child.
 */
function child(root, relative) {
    if (path.isAbsolute(relative) ||
        relative.split(/[/\\]/).some((part) => !part || part === ".." || part === ".")) {
        throw new Error(`Unsafe publication path: ${relative}`);
    }
    let cursor = root;
    for (const part of relative.split(/[/\\]/)) {
        cursor = path.join(cursor, part);
        if (fs.existsSync(cursor) && fs.lstatSync(cursor).isSymbolicLink()) {
            throw new Error(`Publication cannot follow a symlink: ${cursor}`);
        }
    }
    return cursor;
}
/** Persist complete recovery trees before the journal can promise their availability.
 * @param {string} directory Retained regular-file tree, never the live source/database directory.
 */
function flushGeneration(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            flushGeneration(file);
        }
        else if (entry.isFile()) {
            const descriptor = fs.openSync(file, "r");
            try {
                fs.fsyncSync(descriptor);
            }
            finally {
                fs.closeSync(descriptor);
            }
        }
        else {
            throw new Error(`Recovery generations require regular files: ${file}`);
        }
    }
    syncDirectory(directory);
}
/** Publish a verified sibling candidate while retaining the previous complete generation.
 * Caller holds the project/source lease and SQLite write transaction, and has rechecked inputs.
 * Every changed path is journaled before the first replacement; manifest is replaced last.
 * @param {string} root Visible export directory.
 * @param {string} previous Retained exact previous tree, verified against the original ROM.
 * @param {string} candidate Verified candidate tree at the same directory depth.
 * @param {string} romSha256 Actual verified full-ROM digest.
 * @param {(index: number) => void} [checkpoint] Fault-injection boundary after each replacement.
 * @returns {SourcePublicationState} Durable verified outcome.
 */
export function publishSourceGeneration(root, previous, candidate, romSha256, checkpoint) {
    const old = loadSourceExportManifest(previous);
    const next = loadSourceExportManifest(candidate);
    validateSourceExportFiles(previous, old);
    validateSourceExportFiles(candidate, next);
    const paths = new Set([...old.files, ...next.files].map((file) => file.path));
    for (const input of next.inputs ?? []) {
        if (!fs.existsSync(child(previous, input.path))) {
            paths.add(input.path);
        }
    }
    paths.add("generated-files.json");
    const files = [...paths].map((file) => ({
        path: file,
        before: optionalFileHash(child(previous, file)),
        after: optionalFileHash(child(candidate, file)),
    }));
    for (const file of files) {
        if (optionalFileHash(child(root, file.path)) !== file.before) {
            throw new Error(`Source changed during staging: ${file.path}. Staged and previous files are retained.`);
        }
    }
    const state = {
        id: randomUUID(),
        phase: "publishing",
        previous,
        candidate,
        before: sourceExportSha256(fs.readFileSync(child(previous, "generated-files.json"))),
        after: sourceExportSha256(fs.readFileSync(child(candidate, "generated-files.json"))),
        romSha256,
        revision: next.sourceProjectSha256,
        verifiedAt: new Date().toISOString(),
        files,
    };
    // Copy/export completion alone does not make the retained bytes durable across power loss.
    flushGeneration(previous);
    flushGeneration(candidate);
    syncDirectory(path.dirname(previous));
    syncDirectory(path.dirname(candidate));
    durableReplace(path.join(root, SOURCE_PUBLICATION_STATE), JSON.stringify(state));
    for (const [index, file] of files.entries()) {
        // A concurrent external edit is never overwritten, even after publication started.
        if (optionalFileHash(child(root, file.path)) !== file.before) {
            throw new Error(`Publication interrupted by a source edit: ${file.path}. Run publication recovery.`);
        }
        if (file.before !== file.after) {
            replaceFrom(root, candidate, file.path, file.after);
        }
        checkpoint?.(index);
    }
    const published = { ...state, phase: "published" };
    durableReplace(path.join(root, SOURCE_PUBLICATION_STATE), JSON.stringify(published));
    return published;
}
/** Copy retained bytes rather than consuming them, so a second crash remains recoverable.
 * @param {string} root Visible export root.
 * @param {string} retained Verified recovery tree.
 * @param {string} relative Journaled child path.
 * @param {string | null} expected Required retained digest or deletion.
 */
function replaceFrom(root, retained, relative, expected) {
    const target = child(root, relative);
    if (expected === null) {
        if (fs.existsSync(target)) {
            fs.unlinkSync(target);
            syncDirectory(path.dirname(target));
        }
        return;
    }
    const bytes = fs.readFileSync(child(retained, relative));
    if (sourceExportSha256(bytes) !== expected) {
        throw new Error(`Retained recovery bytes changed: ${relative}`);
    }
    durableReplace(target, bytes);
}
/** Reconcile interrupted replacement under the same publication lease used by writers.
 * Complete candidates are acknowledged; partial candidates roll back to verified previous files.
 * Unknown external bytes block recovery without overwriting either the edit or retained versions.
 * @param {string} root Visible export root.
 * @returns {SourcePublicationState | undefined} Reconciled journal or previous terminal outcome.
 */
export function recoverSourceGeneration(root) {
    const state = readSourcePublication(root);
    if (!state || !["publishing", "blocked"].includes(state.phase)) {
        return state;
    }
    for (const retained of [state.previous, state.candidate]) {
        if (path.dirname(retained) !== path.dirname(root) ||
            retained === root ||
            !fs.lstatSync(retained).isDirectory()) {
            throw new Error("Publication recovery requires the retained sibling generations.");
        }
    }
    const actual = state.files.map((file) => optionalFileHash(child(root, file.path)));
    const conflicts = state.files.filter((file, i) => actual[i] !== file.before && actual[i] !== file.after);
    if (conflicts.length) {
        durableReplace(path.join(root, SOURCE_PUBLICATION_STATE), JSON.stringify({ ...state, phase: "blocked" }));
        throw new Error(`Publication recovery preserved external edits: ${conflicts.map((file) => file.path).join(", ")}. Compare ${state.previous} and ${state.candidate} before retrying.`);
    }
    const complete = state.files.every((file, i) => actual[i] === file.after);
    const retained = complete ? state.candidate : state.previous;
    validateSourceExportFiles(retained);
    // Verify all retained versions before the first recovery write.
    for (const file of state.files) {
        const expected = complete ? file.after : file.before;
        if (optionalFileHash(child(retained, file.path)) !== expected) {
            throw new Error(`Recovery generation changed: ${file.path}`);
        }
    }
    if (!complete) {
        // Restore manifest last, and remain unreadable until every old path is back in place.
        for (const file of state.files) {
            const current = optionalFileHash(child(root, file.path));
            if (current !== file.before && current !== file.after) {
                throw new Error(`External edit interrupted recovery: ${file.path}`);
            }
            replaceFrom(root, state.previous, file.path, file.before);
        }
    }
    const result = {
        ...state,
        phase: complete ? "published" : "rolled-back",
    };
    durableReplace(path.join(root, SOURCE_PUBLICATION_STATE), JSON.stringify(result));
    return result;
}
//# sourceMappingURL=source-publication.js.map
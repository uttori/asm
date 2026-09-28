import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pngImporter, rewriteIndexedPng } from "@uttori/asm-assets/image";
import { acquireFileLease, durableReplace, sourceExportSha256, loadSourceExportManifest, validateSourceExportFiles, validateSourceExportInputs, } from "@uttori/asm-disassembler";
import { publishModificationManifest } from "./modification-operations.js";
import { buildModifiedRom, loadRomModificationProject, modificationOwnedPath, } from "./modification-project.js";
/** Exact input identities bind a review to all includes/resources, including unused files.
 * @param {string} root Modification directory whose inputs are owned by this project.
 * @param {string} prefix Relative input subtree; defaults to all inputs.
 * @returns {Record<string, string>} Deterministically ordered hashes for stale-review checks.
 */
export function modificationInputHashes(root, prefix = "inputs") {
    const hashes = {};
    for (const entry of fs
        .readdirSync(modificationOwnedPath(root, prefix), { withFileTypes: true })
        .sort((a, b) => a.name.localeCompare(b.name))) {
        const relative = `${prefix}/${entry.name}`;
        const file = modificationOwnedPath(root, relative);
        if (entry.isDirectory()) {
            Object.assign(hashes, modificationInputHashes(root, relative));
        }
        else if (entry.isFile()) {
            hashes[relative] = sourceExportSha256(fs.readFileSync(file));
        }
        else {
            throw new Error("Editor inputs must be regular files, without symbolic links.");
        }
    }
    return hashes;
}
/** Read one owned document; opaque plugin models remain available through the external editor.
 * @param {object} options Bound manifest and replacement ID.
 * @returns {object} Editable document with its original manifest and input hashes.
 */
export function readRomEditor(options) {
    const project = loadRomModificationProject(options.manifestFile);
    const root = path.dirname(path.resolve(options.manifestFile));
    const entry = project.replacements.find((item) => item.id === options.id);
    if (!entry) {
        throw new Error("Replacement no longer exists.");
    }
    const bytes = fs.readFileSync(modificationOwnedPath(root, entry.input));
    if (bytes.length > 4 * 1024 * 1024) {
        throw new Error("Visual editor inputs are limited to 4 MiB. Use the source editor for this input.");
    }
    let document;
    if (entry.kind === "assembly") {
        document = { kind: "assembly", text: bytes.toString("utf8") };
    }
    else if (entry.kind === "binary") {
        document = { kind: "bytes", values: [...bytes] };
    }
    else if (entry.asset?.mediaType === "image/png") {
        const decoded = pngImporter.import({ bytes, mediaType: "image/png" });
        if (decoded.kind !== "indexed-image") {
            throw new Error("Visual tile editing requires indexed PNG.");
        }
        const image = decoded.value;
        document = {
            kind: "indexed",
            width: image.width,
            height: image.height,
            palette: image.palette,
            values: [...image.indexes],
        };
    }
    else if (entry.asset?.mediaType === "application/json") {
        document = {
            kind: "model",
            value: JSON.parse(bytes.toString("utf8")),
        };
    }
    else {
        throw new Error("This asset requires an external editor.");
    }
    return {
        entry,
        document,
        manifestSha256: sourceExportSha256(fs.readFileSync(options.manifestFile)),
        inputSha256: sourceExportSha256(bytes),
    };
}
/** Validate before conversion: Uint8Array must never silently wrap invalid user values.
 * @param {readonly number[]} values User-provided numeric cells.
 * @param {number} maximum Inclusive palette-slot or byte maximum, default 255.
 * @returns {Uint8Array} Validated owned byte buffer.
 */
function byteValues(values, maximum = 255) {
    if (!Array.isArray(values) ||
        values.length > 1024 * 1024 ||
        values.some((value) => !Number.isInteger(value) || value < 0 || value > maximum)) {
        throw new Error(`Values must be integers from 0 to ${maximum}, at most one million entries.`);
    }
    return Uint8Array.from(values);
}
/** Preserve a candidate and build the whole ROM before enabling Save. Failed candidates remain recoverable.
 * @param {object} options Bound revision, complete edited document, and cancellable build services.
 * @returns {Promise<RomEditorReview>} Persisted byte comparison; failed drafts stay on disk.
 */
export async function previewRomEditor(options) {
    const root = path.dirname(path.resolve(options.manifestFile));
    const lease = acquireFileLease(path.join(root, ".build.lock"));
    try {
        const current = readRomEditor(options);
        if (current.manifestSha256 !== options.manifestSha256 ||
            current.inputSha256 !== options.inputSha256) {
            throw new Error("Editor is stale. Reload saved input before reviewing.");
        }
        const original = fs.readFileSync(modificationOwnedPath(root, current.entry.input));
        const document = options.document;
        if (document.kind !== current.document.kind) {
            throw new Error("Editor document type changed.");
        }
        let bytes;
        if (document.kind === "assembly") {
            bytes = Buffer.from(document.text, "utf8");
        }
        else if (document.kind === "bytes") {
            bytes = byteValues(document.values);
        }
        else if (document.kind === "indexed" && current.document.kind === "indexed") {
            if (document.width !== current.document.width ||
                document.height !== current.document.height ||
                JSON.stringify(document.palette) !== JSON.stringify(current.document.palette)) {
                throw new Error("Tile dimensions and palette slots are locked. Relocate or edit a palette owner separately.");
            }
            bytes = rewriteIndexedPng(original, {
                indexes: byteValues(document.values, document.palette.length - 1),
            });
        }
        else if (document.kind === "model") {
            bytes = Buffer.from(JSON.stringify(document.value, null, 2) + "\n");
        }
        else {
            throw new Error("Unsupported editor document.");
        }
        if (bytes.length > 4 * 1024 * 1024) {
            throw new Error("Edited input exceeds 4 MiB.");
        }
        const id = randomUUID();
        const draft = path.join(root, ".editor-drafts", id);
        const hashes = modificationInputHashes(root);
        for (const relative of Object.keys(hashes)) {
            durableReplace(path.join(draft, relative), fs.readFileSync(modificationOwnedPath(root, relative)));
        }
        const input = `${path.posix.dirname(current.entry.input)}/${current.entry.id}-${id}${path.extname(current.entry.input)}`;
        durableReplace(path.join(draft, input), bytes);
        durableReplace(path.join(draft, "baseline-interface.asm"), fs.readFileSync(path.join(root, "baseline-interface.asm")));
        const project = loadRomModificationProject(options.manifestFile);
        const candidate = {
            ...project,
            baseline: {
                ...project.baseline,
                sourceDirectory: path.resolve(root, project.baseline.sourceDirectory),
                romFile: path.resolve(root, project.baseline.romFile),
            },
            replacements: project.replacements.map((entry) => entry.id === options.id ? { ...entry, input } : entry),
        };
        const candidateFile = path.join(draft, "modification.json");
        durableReplace(candidateFile, JSON.stringify(candidate));
        // The candidate has its own lease and outputs; a failed assembly cannot replace current.json.
        const built = await buildModifiedRom({ ...options, manifestFile: candidateFile });
        if (sourceExportSha256(fs.readFileSync(options.manifestFile)) !== current.manifestSha256 ||
            JSON.stringify(modificationInputHashes(root)) !== JSON.stringify(hashes)) {
            throw new Error("Inputs changed during preview. Draft retained; review again.");
        }
        const review = {
            id,
            replacement: options.id,
            manifestSha256: current.manifestSha256,
            inputHashes: hashes,
            candidateHashes: modificationInputHashes(draft),
            candidateManifestSha256: sourceExportSha256(fs.readFileSync(candidateFile)),
            input,
            inputSha256: sourceExportSha256(bytes),
            changedBytes: built.changedBytes,
            before: current.entry.expected,
            after: fs
                .readFileSync(built.outputPath)
                .subarray(current.entry.offset, current.entry.offset + current.entry.expected.length / 2)
                .toString("hex"),
        };
        durableReplace(path.join(draft, "review.json"), JSON.stringify(review));
        return review;
    }
    finally {
        lease.release();
    }
}
/** Publish only the reviewed input version. A fresh ordinary build supplies debugger source paths.
 * @param {object} options Bound manifest and host-issued preview ID.
 * @returns {string} New owned input path, or the reconciled path after a repeated save.
 */
export function saveRomEditor(options) {
    if (!/^[\da-f-]{36}$/.test(options.reviewId)) {
        throw new Error("Invalid editor review ID.");
    }
    const root = path.dirname(path.resolve(options.manifestFile));
    const lease = acquireFileLease(path.join(root, ".build.lock"));
    let sourceLease;
    try {
        const draft = modificationOwnedPath(root, `.editor-drafts/${options.reviewId}`);
        const review = JSON.parse(fs.readFileSync(path.join(draft, "review.json"), "utf8"));
        const project = loadRomModificationProject(options.manifestFile);
        const inputFile = modificationOwnedPath(draft, review.input);
        const entry = project.replacements.find((item) => item.id === review.replacement);
        // Reconcile a lost success response without repeating the edit or losing the original draft.
        if (entry?.input === review.input &&
            sourceExportSha256(fs.readFileSync(modificationOwnedPath(root, review.input))) ===
                review.inputSha256) {
            durableReplace(path.join(draft, "saved.json"), JSON.stringify({ input: review.input, reconciled: true }));
            return modificationOwnedPath(root, review.input);
        }
        if (sourceExportSha256(fs.readFileSync(options.manifestFile)) !== review.manifestSha256 ||
            JSON.stringify(modificationInputHashes(root)) !== JSON.stringify(review.inputHashes) ||
            JSON.stringify(modificationInputHashes(draft)) !== JSON.stringify(review.candidateHashes) ||
            sourceExportSha256(fs.readFileSync(path.join(draft, "modification.json"))) !==
                review.candidateManifestSha256 ||
            sourceExportSha256(fs.readFileSync(inputFile)) !== review.inputSha256) {
            throw new Error("Reviewed inputs changed. Preview again before saving.");
        }
        const source = path.resolve(root, project.baseline.sourceDirectory);
        sourceLease = acquireFileLease(path.join(source, ".uttori-publication.lock"));
        if (sourceExportSha256(fs.readFileSync(path.join(source, "generated-files.json"))) !==
            project.baseline.manifestSha256) {
            throw new Error("Baseline changed after review.");
        }
        const manifest = loadSourceExportManifest(source);
        validateSourceExportFiles(source, manifest);
        validateSourceExportInputs(source, manifest);
        durableReplace(modificationOwnedPath(root, review.input), fs.readFileSync(inputFile));
        publishModificationManifest(options.manifestFile, {
            ...project,
            replacements: project.replacements.map((item) => item.id === review.replacement ? { ...item, input: review.input } : item),
        });
        durableReplace(path.join(draft, "saved.json"), JSON.stringify({ input: review.input }));
        return modificationOwnedPath(root, review.input);
    }
    finally {
        sourceLease?.release();
        lease.release();
    }
}
//# sourceMappingURL=modification-editor.js.map
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { assetSourcePath } from "@uttori/asm-assets/node";
import { durableReplace, acquireFileLease, loadSourceExportManifest, loadSourceOwnership, sourceExportSha256, validateSourceExportFiles, } from "@uttori/asm-disassembler";
import { loadRomModificationProject, modificationOwnedPath, } from "./modification-project.js";
import { verifySnesProjectRoundTrip } from "./project-initializer.js";
/** Preserve a source edit and classify one contiguous changed owner. No edited bytes are discarded.
 * @param {object} options Modification project with retained baseline and one edited generated assembly file.
 * @returns {string} Read-only review JSON. Multiple owners, additions without an anchor and layout changes stay as saved drafts.
 */
export function reviewSourceEdit(options) {
    const manifestFile = path.resolve(options.manifestFile);
    const root = path.dirname(manifestFile);
    const project = loadRomModificationProject(manifestFile);
    if (!project.baseline.snapshotDirectory) {
        throw new Error("Source import requires a retained baseline. Preserve your edit and create a project from a verified generation first.");
    }
    const sourceDirectory = path.resolve(root, project.baseline.sourceDirectory);
    const sourceFile = path.resolve(options.sourceFile);
    const relative = path.relative(sourceDirectory, sourceFile).split(path.sep).join("/");
    const current = fs.readFileSync(sourceFile);
    // Draft creation precedes interpretation so malformed or unsupported edits remain recoverable.
    const id = `source-${randomUUID()}`;
    const directory = path.join(root, ".source-drafts", id);
    fs.mkdirSync(directory, { recursive: true });
    const draftFile = path.join(directory, "edited.asm");
    durableReplace(draftFile, current);
    const source = path.join(modificationOwnedPath(root, project.baseline.snapshotDirectory), "source");
    const manifest = loadSourceExportManifest(source);
    if (sourceExportSha256(fs.readFileSync(path.join(sourceDirectory, "generated-files.json"))) !==
        project.baseline.manifestSha256) {
        throw new Error(`Baseline changed. Rebase before source import. Draft saved at ${draftFile}`);
    }
    if (sourceExportSha256(fs.readFileSync(path.join(source, "generated-files.json"))) !==
        project.baseline.manifestSha256) {
        throw new Error("Retained baseline manifest changed.");
    }
    validateSourceExportFiles(source, manifest);
    const entry = manifest.files.find((item) => item.path === relative && item.path.endsWith(".asm"));
    if (!entry) {
        throw new Error(`Choose a generated assembly file. Draft saved at ${draftFile}`);
    }
    const before = fs.readFileSync(assetSourcePath(source, relative));
    const baselineFile = path.join(directory, "base.asm");
    durableReplace(baselineFile, before);
    const map = loadSourceOwnership({ directory: source, relative, manifest });
    const oldLines = before.toString("utf8").split("\n");
    const newLines = current.toString("utf8").split("\n");
    let start = 0;
    while (start < oldLines.length &&
        start < newLines.length &&
        oldLines[start] === newLines[start]) {
        start++;
    }
    let oldEnd = oldLines.length;
    let newEnd = newLines.length;
    while (oldEnd > start && newEnd > start && oldLines[oldEnd - 1] === newLines[newEnd - 1]) {
        oldEnd--;
        newEnd--;
    }
    const original = oldLines.slice(start, oldEnd).join("\n").trim();
    const edited = newLines.slice(start, newEnd).join("\n").trim();
    const owners = map?.entries.filter((owner) => owner.file === relative && owner.startLine <= start + 1 && owner.endLine >= oldEnd) ?? [];
    let owner;
    let metadata;
    let replacement;
    let replacementFile;
    let unsupported = "The edit spans multiple owners or unsupported syntax. Use native metadata editing, copy the saved source into a bounded replacement, or create detached source.";
    const label = owners.find((item) => item.kind === "label" && original === `${item.symbol}:`);
    const comment = owners.find((item) => item.kind === "comment" && item.startLine === start + 1 && item.endLine === oldEnd);
    if (label && (!edited || /^[A-Z_a-z]\w*:$/.test(edited))) {
        owner = label;
        metadata = edited
            ? { kind: "rename-label", id: label.id, name: edited.slice(0, -1) }
            : { kind: "remove-label", id: label.id };
        unsupported = "";
    }
    else if (comment && edited.split("\n").every((line) => /^\s*;/.test(line))) {
        owner = comment;
        metadata = {
            kind: "comment",
            id: comment.id,
            text: edited
                .split("\n")
                .map((line) => line.replace(/^\s*;\s?/, ""))
                .join("\n"),
        };
        unsupported = "";
    }
    else {
        owner = owners
            .filter((item) => ["instruction", "data"].includes(item.kind) &&
            item.outputStart !== undefined &&
            item.outputEnd > item.outputStart)
            .sort((a, b) => a.endLine - a.startLine - (b.endLine - b.startLine))[0];
        if (owner) {
            const offset = owner.outputStart;
            const size = owner.outputEnd - offset;
            const snapshotRom = path.join(root, project.baseline.snapshotDirectory, "baseline.sfc");
            const rom = fs.readFileSync(snapshotRom);
            if (sourceExportSha256(rom) !== project.baseline.rom.sha256) {
                throw new Error("Retained original ROM changed.");
            }
            const contents = [
                ...oldLines.slice(owner.startLine - 1, start),
                ...newLines.slice(start, newEnd),
                ...oldLines.slice(oldEnd, owner.endLine),
            ].join("\n") + "\n";
            // Source-origin directives and includes may escape the intended owner; keep these as manual drafts.
            if (!/^\s*(?:org|base|incsrc|incbin|incasset|arch|lorom|hirom|exlorom|exhirom|fill|pad|skip)\b/im.test(contents) &&
                size <= 65536 &&
                !project.replacements.some((entry) => offset < entry.offset + entry.expected.length / 2 && entry.offset < offset + size)) {
                const width = (prefix) => {
                    const matches = [
                        ...oldLines
                            .slice(0, owner.startLine - 1)
                            .join("\n")
                            .matchAll(prefix === "a" ? /^\s*\.a(8|16)\s*$/gm : /^\s*\.i(8|16)\s*$/gm),
                    ];
                    return matches.at(-1)?.[1] === "8" ? 8 : 16;
                };
                const replacementId = `import_${randomUUID().replaceAll("-", "_")}`;
                replacement = {
                    id: replacementId,
                    offset,
                    expected: rom
                        .subarray(project.baseline.rom.headerSize + offset, project.baseline.rom.headerSize + offset + size)
                        .toString("hex"),
                    input: `inputs/${replacementId}.asm`,
                    kind: "assembly",
                    accumulator: width("a"),
                    index: width("i"),
                };
                replacementFile = path.join(directory, "replacement.asm");
                durableReplace(replacementFile, contents);
                unsupported = "";
            }
        }
    }
    if (start === oldLines.length && start === newLines.length) {
        unsupported = "No source changes to import.";
    }
    const review = {
        format: "uttori-source-edit-review",
        id,
        manifestFile,
        manifestSha256: sourceExportSha256(fs.readFileSync(manifestFile)),
        sourceFile,
        relative,
        sourceSha256: sourceExportSha256(current),
        baselineSha256: entry.sha256,
        sourceProjectSha256: manifest.sourceProjectSha256,
        baselineFile,
        draftFile,
        ...(owner ? { owner } : {}),
        ...(metadata ? { metadata } : {}),
        ...(replacement
            ? {
                replacement,
                replacementFile,
                replacementSha256: sourceExportSha256(fs.readFileSync(replacementFile)),
            }
            : {}),
        ...(unsupported ? { unsupported } : {}),
    };
    const reviewFile = path.join(directory, "review.json");
    durableReplace(reviewFile, JSON.stringify(review, null, 2) + "\n");
    return reviewFile;
}
/** Restore one reviewed generated file only after preserving and rechecking its exact draft.
 * @param {object} options Saved review digest and trusted verification services.
 * @returns {Promise<object>} Restoration status; verification failure is reported independently of the successful restore.
 */
export async function restoreReviewedSource(options) {
    const bytes = fs.readFileSync(options.reviewFile);
    if (sourceExportSha256(bytes) !== options.reviewSha256) {
        throw new Error("Source review changed.");
    }
    const review = JSON.parse(bytes.toString("utf8"));
    if (review.format !== "uttori-source-edit-review") {
        throw new Error("Choose a source edit review.");
    }
    const project = loadRomModificationProject(review.manifestFile);
    const root = path.dirname(review.manifestFile);
    const sourceDirectory = path.resolve(root, project.baseline.sourceDirectory);
    const lease = acquireFileLease(path.join(sourceDirectory, ".uttori-publication.lock"));
    try {
        const manifest = loadSourceExportManifest(sourceDirectory);
        if (sourceExportSha256(fs.readFileSync(path.join(sourceDirectory, "generated-files.json"))) !==
            project.baseline.manifestSha256 ||
            manifest.files.find((entry) => entry.path === review.relative)?.sha256 !==
                review.baselineSha256 ||
            assetSourcePath(sourceDirectory, review.relative) !== fs.realpathSync(review.sourceFile)) {
            throw new Error("Source generation changed after review.");
        }
        const baseline = fs.readFileSync(review.baselineFile);
        if (sourceExportSha256(baseline) !== review.baselineSha256 ||
            sourceExportSha256(fs.readFileSync(review.draftFile)) !== review.sourceSha256 ||
            sourceExportSha256(fs.readFileSync(review.sourceFile)) !== review.sourceSha256) {
            throw new Error("Source or retained review bytes changed. Preserve the newer edit and review again.");
        }
        options.signal?.throwIfAborted();
        durableReplace(review.sourceFile, baseline);
        try {
            await verifySnesProjectRoundTrip({
                sourceDirectory,
                romFile: path.resolve(root, project.baseline.romFile),
                loadEnvironment: options.loadEnvironment,
                signal: options.signal,
            });
            return {
                restored: true,
                verified: true,
                detail: `Restored ${review.relative}; complete baseline ROM verified. Exact edit retained at ${review.draftFile}`,
            };
        }
        catch (error) {
            return {
                restored: true,
                verified: false,
                detail: `Restored ${review.relative}; baseline verification pending: ${error instanceof Error ? error.message : String(error)}. Exact edit retained at ${review.draftFile}`,
            };
        }
    }
    finally {
        lease.release();
    }
}
//# sourceMappingURL=source-reconciliation.js.map
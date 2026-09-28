import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { acquireFileLease, analysisProjectRevision, durableReplace, openAnalysisProjectStore, RomImage, sourceExportSha256, syncDirectory, validateProjectRom, writeAnalysisProject, } from "@uttori/asm-disassembler";
import { snesRomAddressSpace } from "../target/address-space.js";
import { createSnesAddressContext } from "./address-identities.js";
import { loadRomModificationProject, modificationOwnedPath, } from "./modification-project.js";
import { analyzeSnesProject, createSnesAnalysisProject, exportSnesProject, verifySnesProjectRoundTrip, } from "./project-initializer.js";
import { validateSnesRamMap } from "./ram-map.js";
import { validateSnesStructMap } from "./struct-map.js";
/** Snapshot only reusable metadata, never materializing runtime records or the generated CFG.
 * @param {string} directory Native analysis project directory.
 * @returns {object} Reusable collections and their authoritative manifest from one read transaction.
 */
function readMetadata(directory) {
    const store = openAnalysisProjectStore(directory);
    try {
        return store.transaction(() => ({
            manifest: store.manifest(),
            labels: store.loadTable("labels"),
            comments: store.loadTable("comments"),
            annotations: store.loadTable("annotations"),
            targets: store.analysisByKinds(["target-override", "target-set"]),
            regions: store.loadTable("regions").length,
            evidence: store.loadTable("evidence"),
        }), false);
    }
    finally {
        store.close();
    }
}
/** Build a review without modifying either ROM or analysis project. Byte agreement is evidence, not semantic proof.
 * @param {object} options Baseline modification manifest, target ROM, and explicit relocation intervals.
 * @returns {MetadataMigrationReview} Durable, unapproved migration items with pinned source identities.
 */
export function reviewMetadataMigration(options) {
    const root = path.dirname(path.resolve(options.manifestFile));
    const modification = loadRomModificationProject(options.manifestFile);
    const source = path.resolve(root, modification.baseline.sourceDirectory);
    const sourceProject = path.join(source, "analysis");
    const snapshot = readMetadata(sourceProject);
    const original = RomImage.load(path.resolve(root, modification.baseline.romFile), {
        headerSize: snapshot.manifest.rom.headerSize,
    });
    validateProjectRom(snapshot.manifest, original);
    if (snapshot.manifest.mapping.mapper !== modification.baseline.mapper) {
        throw new Error("Source metadata mapper differs from the modification baseline.");
    }
    const target = RomImage.load(options.targetRomFile, {
        headerSize: snapshot.manifest.rom.headerSize,
    });
    const relocations = options.relocations ?? [];
    if (relocations.length > 10000) {
        throw new Error("Too many relocation ranges.");
    }
    for (const range of relocations) {
        if (![range.from, range.to, range.size].every(Number.isSafeInteger) ||
            range.from < 0 ||
            range.to < 0 ||
            range.size < 1 ||
            range.from + range.size > original.length ||
            range.to + range.size > target.length) {
            throw new Error("Relocation range exceeds a ROM.");
        }
    }
    for (const key of ["from", "to"]) {
        const sorted = [...relocations].sort((a, b) => a[key] - b[key]);
        if (sorted.some((range, i) => i > 0 && range[key] < sorted[i - 1][key] + sorted[i - 1].size)) {
            throw new Error("Relocation ranges overlap.");
        }
    }
    const context = createSnesAddressContext(modification.baseline.mapper);
    const translate = (offset, size) => {
        const overlaps = relocations.filter((r) => r.from < offset + size && r.from + r.size > offset);
        if (overlaps.length &&
            (overlaps.length !== 1 ||
                offset < overlaps[0].from ||
                offset + size > overlaps[0].from + overlaps[0].size)) {
            return undefined;
        }
        const range = overlaps[0];
        const next = range ? range.to + offset - range.from : offset;
        if (offset < 0 || next + size > target.length) {
            return undefined;
        }
        return {
            next,
            moved: Boolean(range && next !== offset),
            equal: Buffer.from(original.read(offset, size) ?? []).equals(Buffer.from(target.read(next, size) ?? [])),
        };
    };
    const items = [];
    const excluded = {
        generatedOrRuntimeAnnotations: 0,
        assetCodecAnnotations: 0,
        targetHints: snapshot.targets.length,
        regions: snapshot.regions,
        instructionUses: 0,
    };
    const evidence = new Map(snapshot.evidence.map((item) => [item.id, item]));
    for (const shard of ["labels", "comments", "annotations"]) {
        for (const record of snapshot[shard]) {
            if (shard === "annotations") {
                const annotation = record;
                if (["opcode", "operand"].includes(annotation.classification) ||
                    !annotation.evidence.some((id) => ["manual", "import"].includes(evidence.get(id)?.source ?? ""))) {
                    excluded.generatedOrRuntimeAnnotations++;
                    continue;
                }
                if (annotation.asset) {
                    excluded.assetCodecAnnotations++;
                    continue;
                }
            }
            const address = "start" in record ? record.start : record.address;
            const size = "end" in record ? record.end - address : 1;
            const offset = record.addressSpace === "rom.file"
                ? address
                : snesRomAddressSpace.toOutputOffset(address, context);
            const supportedSpace = ["rom.file", "snes.cpu"].includes(record.addressSpace);
            const mapping = supportedSpace && offset >= 0 ? translate(offset, size) : undefined;
            let status = "review";
            let reason = "Non-ROM metadata: verify that this memory location retains the same meaning.";
            let next = address;
            let after;
            if (supportedSpace && offset >= 0) {
                if (!mapping) {
                    status = "blocked";
                    reason = "Range crosses a relocation boundary or no longer fits the target ROM.";
                }
                else {
                    next =
                        record.addressSpace === "rom.file"
                            ? mapping.next
                            : snesRomAddressSpace.fromOutputOffset(mapping.next, context);
                    if (next < 0 ||
                        (record.addressSpace === "snes.cpu" &&
                            snesRomAddressSpace.toOutputOffset(next, context) !== mapping.next)) {
                        status = "blocked";
                        reason = "Destination has no canonical address in this mapper.";
                    }
                    else {
                        status = mapping.moved ? "relocated" : "unchanged";
                        reason = "Declared bytes match. Confirm the metadata still describes their meaning.";
                        // A label's one-byte anchor is weak evidence; compare neighboring bytes as well.
                        const guard = "end" in record
                            ? size
                            : Math.min(16, original.length - offset, target.length - mapping.next);
                        const sameContext = Buffer.from(original.read(offset, guard) ?? []).equals(Buffer.from(target.read(mapping.next, guard) ?? []));
                        if (!mapping.equal || !sameContext) {
                            status = "review";
                            reason =
                                "Bytes or anchor context changed; inspect this interpretation before selecting it.";
                        }
                    }
                }
            }
            else if (!supportedSpace &&
                !snapshot.manifest.addressSpaces.some((space) => space.id === record.addressSpace && space.kind === "memory")) {
                status = "blocked";
                reason = "This address space has no supported migration mapping.";
            }
            if (status !== "blocked") {
                const shared = { ...record, id: `migrated:${record.id}`, evidence: [] };
                if ("start" in record) {
                    // CPU state and flow seeds are observations/assumptions about old code, even when bytes match.
                    const { state: _state, points: _points, ...classification } = shared;
                    after = { ...classification, start: next, end: next + size };
                    reason += " CPU state and flow hints are omitted.";
                }
                else if (shard === "labels") {
                    after = { ...shared, address: next, analysisEntryPoint: false };
                    reason += " Migrated labels do not seed code analysis.";
                }
                else {
                    after = { ...shared, address: next };
                }
            }
            const label = "name" in record ? record.name : record.id;
            items.push({
                id: `${shard}:${record.id}`,
                label,
                kind: shard,
                status,
                reason,
                before: record,
                after,
            });
        }
    }
    const mapHashes = {};
    const structFile = path.join(source, "struct-map.json");
    if (fs.existsSync(structFile)) {
        const bytes = fs.readFileSync(structFile);
        mapHashes["struct-map.json"] = sourceExportSha256(bytes);
        const value = JSON.parse(bytes.toString());
        validateSnesStructMap(value);
        const bindings = (value.bindings ?? []);
        const structures = (value.structures ?? []);
        excluded.instructionUses = (value.instructionUses ?? []).length;
        const { bindings: _bindings, instructionUses: _uses, ...library } = value;
        items.push({
            id: "struct-library",
            label: "Structure layouts and constants",
            kind: "struct-library",
            status: "review",
            reason: "Review constants for changed semantics. Guarded instruction uses and their capture claims are excluded.",
            before: library,
            after: library,
        });
        for (const binding of bindings) {
            let after = { ...binding };
            let status = "review";
            let reason = "RAM binding: verify its layout and location. Requires structure library selection.";
            if (typeof binding.fileOffset === "number") {
                const layout = structures.find((item) => item.id === binding.structure);
                const mapped = translate(binding.fileOffset, layout.size * Number(binding.count ?? 1));
                status = "blocked";
                reason = "Binding crosses a relocation boundary or exceeds the target.";
                if (mapped) {
                    status = mapped.moved ? "relocated" : "unchanged";
                    if (!mapped.equal) {
                        status = "review";
                    }
                    reason =
                        "Review the complete typed array and select the structure library. Changed values may retain their layout.";
                    after = {
                        ...binding,
                        fileOffset: mapped.next,
                        address: snesRomAddressSpace.fromOutputOffset(mapped.next, context),
                    };
                }
            }
            items.push({
                id: `binding:${String(binding.name)}`,
                label: String(binding.name),
                kind: "struct-binding",
                status,
                reason,
                before: binding,
                after: status === "blocked" ? undefined : after,
            });
        }
    }
    const ramFile = path.join(source, "ram-map.json");
    if (fs.existsSync(ramFile)) {
        const bytes = fs.readFileSync(ramFile);
        mapHashes["ram-map.json"] = sourceExportSha256(bytes);
        const value = JSON.parse(bytes.toString());
        validateSnesRamMap(value);
        items.push({
            id: "ram-map",
            label: "RAM names and arrays",
            kind: "ram-map",
            status: "review",
            reason: "ROM byte equality cannot prove RAM semantics. Review these declarations explicitly.",
            before: value,
            after: value,
        });
    }
    const review = {
        id: randomUUID(),
        sourceProject,
        sourceRevision: analysisProjectRevision(snapshot.manifest).manifestSha256,
        sourceRomSha256: original.identity.sha256,
        targetRomFile: path.resolve(options.targetRomFile),
        targetRomSha256: target.identity.sha256,
        mapHashes,
        relocations,
        items,
        excluded,
    };
    durableReplace(path.join(root, ".metadata-migrations", review.id, "review.json"), JSON.stringify(review));
    return review;
}
/** Create a separate verified workspace from selected research. Original records, captures and outputs are never rewritten.
 * @param {object} options Review ID, selected item IDs, new destination, and cancellable verification services.
 * @returns {Promise<object>} Published independent workspace and migrated item count.
 */
export async function applyMetadataMigration(options) {
    if (!/^[\da-f-]{36}$/.test(options.reviewId)) {
        throw new Error("Invalid migration review ID.");
    }
    const root = path.dirname(path.resolve(options.manifestFile));
    const reviewFile = modificationOwnedPath(root, `.metadata-migrations/${options.reviewId}/review.json`);
    const review = JSON.parse(fs.readFileSync(reviewFile, "utf8"));
    const modification = loadRomModificationProject(options.manifestFile);
    const source = path.resolve(root, modification.baseline.sourceDirectory);
    const lease = acquireFileLease(path.join(root, ".build.lock"));
    let sourceLease;
    try {
        sourceLease = acquireFileLease(path.join(source, "analysis/.editing/writer.lock"));
        const check = () => {
            const snapshot = readMetadata(review.sourceProject);
            if (analysisProjectRevision(snapshot.manifest).manifestSha256 !== review.sourceRevision ||
                sourceExportSha256(fs.readFileSync(path.resolve(root, modification.baseline.romFile))) !==
                    review.sourceRomSha256 ||
                sourceExportSha256(fs.readFileSync(review.targetRomFile)) !== review.targetRomSha256) {
                throw new Error("Migration review is stale: source metadata or ROM changed.");
            }
            for (const [name, hash] of Object.entries(review.mapHashes)) {
                // oxlint-disable-next-line security/detect-possible-timing-attacks -- Public file digests are integrity checks, not secrets.
                if (sourceExportSha256(fs.readFileSync(path.join(source, name))) !== hash) {
                    throw new Error("Migration map input changed. Review again.");
                }
            }
            return snapshot;
        };
        const snapshot = check();
        const selected = new Set(options.selected);
        if (!selected.size ||
            selected.size !== options.selected.length ||
            [...selected].some((id) => !review.items.some((item) => item.id === id && item.status !== "blocked"))) {
            throw new Error("Select valid, non-blocked migration items.");
        }
        if (review.items.some((item) => selected.has(item.id) && item.kind === "struct-binding") &&
            !selected.has("struct-library")) {
            throw new Error("Migrating a binding requires its structure library.");
        }
        const destination = path.resolve(options.outputDirectory);
        if (fs.existsSync(destination)) {
            const receiptFile = path.join(destination, "metadata-migration.json");
            const prior = fs.existsSync(receiptFile)
                ? JSON.parse(fs.readFileSync(receiptFile, "utf8"))
                : undefined;
            // The workspace rename may commit before its completion receipt reaches the original project.
            if (!prior ||
                prior.id !== review.id ||
                prior.targetRomSha256 !== review.targetRomSha256 ||
                JSON.stringify([...prior.selected].sort()) !== JSON.stringify([...selected].sort())) {
                throw new Error("Migration destination must not exist; existing research is never replaced.");
            }
            const romFile = path.join(destination, "rom.sfc");
            if (sourceExportSha256(fs.readFileSync(romFile)) !== review.targetRomSha256) {
                throw new Error("Previously migrated ROM changed.");
            }
            await verifySnesProjectRoundTrip({
                sourceDirectory: destination,
                romFile,
                signal: options.signal,
                loadEnvironment: options.loadEnvironment,
            });
            durableReplace(path.join(path.dirname(reviewFile), "completed.json"), JSON.stringify({ outputDirectory: destination, reconciled: true }));
            return { outputDirectory: destination, romFile, migrated: selected.size };
        }
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        const staging = fs.mkdtempSync(path.join(path.dirname(destination), ".metadata-migration-"));
        const exportDirectory = path.join(staging, "source");
        fs.mkdirSync(exportDirectory);
        const romFile = path.join(staging, "rom.sfc");
        const targetBytes = fs.readFileSync(review.targetRomFile);
        if (sourceExportSha256(targetBytes) !== review.targetRomSha256) {
            throw new Error("Target ROM changed before staging.");
        }
        durableReplace(romFile, targetBytes);
        const projectDirectory = path.join(staging, "analysis");
        const created = createSnesAnalysisProject({
            projectDirectory,
            romFile,
            mapper: modification.baseline.mapper,
            headerSize: snapshot.manifest.rom.headerSize,
            signal: options.signal,
        });
        const shards = {
            labels: [],
            comments: [],
            annotations: [],
            analysis: [],
            runtime: [],
            evidence: [],
            regions: [],
            imports: [],
        };
        for (const item of review.items.filter((entry) => selected.has(entry.id))) {
            if (["labels", "comments", "annotations"].includes(item.kind)) {
                const evidenceId = `migration:${sourceExportSha256(item.id)}`;
                shards.evidence.push({
                    id: evidenceId,
                    source: "manual",
                    sourceId: "metadata-migration",
                    confidence: "unknown",
                    detail: `Reviewed migration from ROM ${review.sourceRomSha256}; source ${item.id}; ${item.reason}`,
                });
                const record = { ...item.after, evidence: [evidenceId] };
                shards[item.kind].push(record);
            }
        }
        writeAnalysisProject(projectDirectory, { manifest: created.manifest, shards });
        if (selected.has("struct-library")) {
            const library = review.items.find((item) => item.id === "struct-library").after;
            const value = {
                ...library,
                bindings: review.items
                    .filter((item) => item.kind === "struct-binding" && selected.has(item.id))
                    .map((item) => item.after),
            };
            validateSnesStructMap(value);
            durableReplace(path.join(exportDirectory, "struct-map.json"), JSON.stringify(value, null, 2));
        }
        if (selected.has("ram-map")) {
            durableReplace(path.join(exportDirectory, "ram-map.json"), JSON.stringify(review.items.find((item) => item.id === "ram-map").after, null, 2));
        }
        options.onProgress?.("Regenerating and verifying migrated research against the target ROM…");
        analyzeSnesProject({ projectDirectory, romFile, signal: options.signal });
        exportSnesProject({
            projectDirectory,
            romFile,
            sourceDirectory: exportDirectory,
            signal: options.signal,
        });
        await verifySnesProjectRoundTrip({
            sourceDirectory: exportDirectory,
            romFile,
            signal: options.signal,
            loadEnvironment: options.loadEnvironment,
        });
        check();
        options.signal?.throwIfAborted();
        durableReplace(path.join(exportDirectory, "metadata-migration.json"), JSON.stringify({
            ...review,
            selected: [...selected],
            migratedAt: new Date().toISOString(),
            runtimeEvidence: "No original runtime records or capture evidence migrated.",
        }, null, 2));
        // Publication is one directory rename. A failed candidate stays beside the destination for inspection.
        if (fs.existsSync(destination)) {
            throw new Error("Destination appeared during migration. Verified candidate retained.");
        }
        fs.renameSync(projectDirectory, path.join(exportDirectory, "analysis"));
        fs.renameSync(romFile, path.join(exportDirectory, "rom.sfc"));
        fs.renameSync(exportDirectory, destination);
        syncDirectory(path.dirname(destination));
        fs.rmdirSync(staging);
        durableReplace(path.join(path.dirname(reviewFile), "completed.json"), JSON.stringify({ outputDirectory: destination }));
        return {
            outputDirectory: destination,
            romFile: path.join(destination, "rom.sfc"),
            migrated: selected.size,
        };
    }
    finally {
        sourceLease?.release();
        lease.release();
    }
}
//# sourceMappingURL=metadata-migration.js.map
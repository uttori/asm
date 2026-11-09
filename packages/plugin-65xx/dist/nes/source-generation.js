import fs from "node:fs";
import path from "node:path";
import { canonicalJson } from "@uttori/asm-core/canonical-json";
import { openAnalysisProjectStore, validateProjectRom } from "@uttori/asm-disassembler";
import { lostCodeRanges, assertSourcePath, sourceLinkFiles, sourceLinkEntry, readSourceLinkBuild, sourceGit, retainSourceGeneration, sourceContentHash, verifySourceGeneration, createSourceInputSnapshot, createSourceScratch, } from "@uttori/asm-disassembler/source-project";
import { loadNesRom } from "./project.js";
import { buildNesSource } from "./source-build.js";
import { exportNesSource } from "./source-export.js";
/** Exact render options include recipe contents and the pristine-asset selection, not host paths. */
export function nesGenerationOptionsHash(options) {
    return sourceContentHash(canonicalJson({
        ...(options.assembly ? { assembly: options.assembly } : {}),
        sourceRoot: options.sourceRoot,
        recipes: options.recipes
            .map((file) => ({ path: file.path, sha256: sourceContentHash(file.bytes) }))
            .toSorted((a, b) => Buffer.compare(Buffer.from(a.path), Buffer.from(b.path))),
        pristineAssets: [...options.pristineAssets].toSorted((a, b) => Buffer.compare(Buffer.from(a.path), Buffer.from(b.path))),
        codeWithdrawals: options.codeWithdrawals ?? [],
    }));
}
/**
 * Accepts a JSON object. Arrays and null are not coverage contracts.
 * @param value Parsed JSON.
 * @returns True when `value` is a non-array object.
 */
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
/**
 * Accepts one half-open ROM interval from a coverage contract.
 * @param value Candidate range.
 * @returns True when start and end are numbers.
 */
function isCodeRange(value) {
    return isRecord(value) && typeof value.start === "number" && typeof value.end === "number";
}
/**
 * Accepts the accepted generation's code coverage contract.
 * @param value Parsed `source-code.json`.
 * @returns True for format `uttori-source-code` version 1 with numeric ranges.
 */
function isSourceCodeContract(value) {
    return (isRecord(value) &&
        value.format === "uttori-source-code" &&
        value.version === 1 &&
        typeof value.romSha256 === "string" &&
        Array.isArray(value.ranges) &&
        value.ranges.every(isCodeRange));
}
/**
 * Render one pinned analysis snapshot in an owned temporary directory, verify the original ROM,
 * then retain only its immutable Git payload. No evidence/capture directory is copied and the
 * source checkout/index remain untouched. Failed candidates never acquire a retained Git ref.
 */
export async function prepareNesGeneration(options) {
    assertSourcePath(options.sourceRoot);
    if (options.assembly !== options.inputs.assembly) {
        throw new Error("Generation assembly selection changed.");
    }
    options.signal?.throwIfAborted();
    if (nesGenerationOptionsHash(options) !== options.inputs.optionsSha256) {
        throw new Error("Generation recipe identity changed.");
    }
    const prior = await verifySourceGeneration(options.repository, options.parent);
    if (prior.descriptor.inputs.project !== options.inputs.project ||
        prior.descriptor.inputs.romSha256 !== options.inputs.romSha256) {
        throw new Error("Prepare regeneration from the accepted project/ROM lineage.");
    }
    const compilerRecipe = options.recipes.find((file) => file.path === "uttori-asm.config.json");
    const entrySource = options.assembly === "linked" && compilerRecipe
        ? sourceLinkEntry(JSON.parse(Buffer.from(compilerRecipe.bytes).toString("utf8")))
        : "main.asm";
    const scratch = createSourceScratch(options.repository, "prepare");
    const temporary = scratch.directory;
    const source = path.join(temporary, options.sourceRoot);
    const generated = new Map();
    const write = (file) => {
        assertSourcePath(file.path);
        if (generated.has(file.path)) {
            throw new Error(`Duplicate generation output: ${file.path}`);
        }
        const target = path.join(temporary, file.path);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, file.bytes);
        generated.set(file.path, file);
    };
    let openedStore;
    try {
        const store = openAnalysisProjectStore(options.evidenceDirectory);
        openedStore = store;
        if (options.recipes.length !== 1 || options.recipes[0].path !== "uttori-asm.config.json") {
            throw new Error("NES generation requires one explicit build configuration recipe.");
        }
        // SQL keeps the complete runtime history out of JS. The iterator is consumed while this
        // snapshot is open so another evidence import cannot mix instruction variants into the render.
        store.prepareAnnotationQueries();
        const { manifest, rom, cartridge, relocatable } = store.transaction(() => {
            const project = store.sourceExportView();
            if (sourceContentHash(canonicalJson(project.manifest)) !== options.inputs.evidenceSha256 ||
                store.researchInputsIdentity() !== options.inputs.researchSha256) {
                throw new Error("Evidence or indexed research changed before pure rendering. Prepare a fresh input snapshot.");
            }
            const { cartridge: loadedCartridge, rom: loadedRom } = loadNesRom(options.romFile);
            validateProjectRom(project.manifest, loadedRom);
            if (loadedRom.identity.contentSha256 !== options.inputs.romSha256) {
                throw new Error("Generation ROM content identity changed.");
            }
            const exported = exportNesSource(loadedCartridge, store.analysisByKinds(["cfg-node"]).filter((node) => node.kind === "cfg-node"), loadedRom.identity.contentSha256, {
                labels: project.shards.labels,
                comments: project.shards.comments,
                annotations: project.shards.annotations,
            }, options.assembly === "linked" ? { module: { id: options.inputs.project } } : {});
            for (const file of exported.files) {
                if (file.path !== "uttori-asm.config.json") {
                    const outputPath = file.path === "main.asm" ? entrySource : file.path;
                    write({ path: `${options.sourceRoot}/${outputPath}`, bytes: file.bytes });
                }
            }
            return {
                manifest: {
                    spans: exported.ranges.map((range) => ({ ...range, role: "code" })),
                    codeBytes: exported.codeBytes,
                },
                rom: loadedRom,
                cartridge: loadedCartridge,
                relocatable: exported.relocatable,
            };
        }, false);
        const priorFiles = new Map(prior.files.map((file) => [file.path, file]));
        const priorCode = priorFiles.get(`${options.sourceRoot}/source-code.json`);
        if (!priorCode) {
            throw new Error("Adopt a verified source baseline with a code coverage contract before regeneration.");
        }
        let withdrawnCode;
        {
            const code = JSON.parse((await sourceGit(options.repository.root, ["cat-file", "blob", priorCode.blob])).stdout.toString("utf8"));
            if (!isSourceCodeContract(code) || code.romSha256 !== rom.identity.contentSha256) {
                throw new Error("Accepted generation has an invalid code coverage contract.");
            }
            withdrawnCode = lostCodeRanges(code.ranges, manifest.spans.filter((span) => span.role === "code"));
            const approvals = options.codeWithdrawals ?? [];
            for (const approval of approvals) {
                if (!Number.isSafeInteger(approval.start) ||
                    !Number.isSafeInteger(approval.end) ||
                    approval.start < 0 ||
                    approval.end > rom.length ||
                    approval.end <= approval.start ||
                    typeof approval.reason !== "string" ||
                    !approval.reason.trim()) {
                    throw new Error("Code withdrawal needs a bounded ROM interval and a research reason.");
                }
            }
            const unresolved = lostCodeRanges(withdrawnCode, approvals);
            if (unresolved.length) {
                throw new Error(`Generation withdraws previously emitted code at $${unresolved[0].start.toString(16)}. Resolve the evidence or record reviewed intervals and reasons in codeWithdrawals.`);
            }
        }
        for (const asset of options.pristineAssets) {
            const name = asset.path;
            assertSourcePath(name);
            if (!name.startsWith(`${options.sourceRoot}/assets/`)) {
                throw new Error(`Pristine asset is outside this source projection: ${name}`);
            }
            let bytes;
            if (asset.originalBlob !== undefined) {
                if (asset.romRange || !/^(?:[\da-f]{40}|[\da-f]{64})$/.test(asset.originalBlob)) {
                    throw new Error(`Invalid original asset blob declaration for ${name}.`);
                }
                // Admission pins reviewed bytes, not a path that an editor can mutate during preparation.
                // The full original-ROM build below must succeed before any candidate is retained.
                bytes = (await sourceGit(options.repository.root, ["cat-file", "blob", asset.originalBlob], {
                    signal: options.signal,
                })).stdout;
            }
            else if (asset.romRange) {
                const { start, end } = asset.romRange;
                if (!Number.isSafeInteger(start) ||
                    !Number.isSafeInteger(end) ||
                    start < 0 ||
                    end <= start ||
                    end > rom.length) {
                    throw new Error(`Invalid original ROM extraction for ${name}.`);
                }
                bytes = rom.read(start, end - start);
            }
            else {
                const priorFile = priorFiles.get(name);
                if (!priorFile || priorFile.sha256 !== asset.sha256) {
                    throw new Error(`Asset needs original-ROM extraction and verification before adoption: ${name}`);
                }
                bytes = (await sourceGit(options.repository.root, ["cat-file", "blob", priorFile.blob], {
                    signal: options.signal,
                })).stdout;
            }
            // Every admission route verifies immutable inputs. Working source edits are
            // merged separately; no mutable PNG, stream or resource path is reread here.
            if (sourceContentHash(bytes) !== asset.sha256) {
                throw new Error(`Pristine asset content does not match its declared identity: ${name}`);
            }
            write({ path: name, bytes });
        }
        // Configuration is a build input on both histories. Research maps remain owned by the source
        // branch and are retained there through the explicit checkpoint required before applying.
        const configuration = options.recipes.find((file) => file.path === "uttori-asm.config.json");
        let configurationBytes = configuration.bytes;
        if (options.assembly === "linked") {
            if (!relocatable) {
                throw new Error("Exporter did not provide a relocatable recipe.");
            }
            for (const file of sourceLinkFiles(configuration.bytes, options.inputs.project, relocatable.linkRecipe, options.sourceRoot)) {
                const name = `${options.sourceRoot}/${file.path}`;
                const previous = generated.get(name);
                if (previous) {
                    if (!Buffer.from(previous.bytes).equals(file.bytes)) {
                        throw new Error("Generated link recipes disagree.");
                    }
                    continue;
                }
                write({ path: name, bytes: file.bytes });
            }
            configurationBytes = generated.get(`${options.sourceRoot}/${configuration.path}`).bytes;
        }
        else {
            write({ path: `${options.sourceRoot}/${configuration.path}`, bytes: configurationBytes });
        }
        const configFile = path.join(source, configuration.path);
        const linkConfiguration = JSON.parse(Buffer.from(configurationBytes).toString("utf8"));
        if (!isRecord(linkConfiguration)) {
            throw new Error("Source compiler configuration must be an object.");
        }
        const link = readSourceLinkBuild(linkConfiguration, configFile, path.join(source, entrySource), (file) => fs.readFileSync(file));
        const loaded = await options.loadEnvironment(path.join(source, configuration.path));
        let build;
        try {
            build = buildNesSource({
                root: temporary,
                ...(link ? { link } : {}),
                entrySource: `${options.sourceRoot}/${entrySource}`,
                environment: loaded.environment,
                includePaths: loaded.includePaths,
                targetOptions: loaded.targetOptions,
                expectedSize: cartridge.bytes().length,
                originalContent: cartridge.bytes(),
                outputDirectory: path.join(temporary, "build"),
                toolchainSha256: options.inputs.toolchainSha256,
                configurationSha256: sourceContentHash(configurationBytes),
                signal: options.signal,
            });
        }
        finally {
            await loaded.dispose();
        }
        if (link) {
            // Keep a portable proof in the immutable payload; temporary paths and debug-map hashes would
            // make identical generations differ merely because they used different scratch directories.
            write({
                path: `${options.sourceRoot}/link-verification.json`,
                bytes: Buffer.from(canonicalJson({
                    format: "uttori-source-link-verification",
                    version: 1,
                    target: "65xx.nes",
                    module: link.module.id,
                    recipeSha256: sourceContentHash(canonicalJson(link.recipe)),
                    originalContainerSha256: rom.identity.sha256,
                    outputSha256: build.verification.outputSha256,
                    outputSize: rom.identity.fileSize,
                    toolchainSha256: options.inputs.toolchainSha256,
                    checks: build.verification.checks,
                })),
            });
        }
        const generation = await retainSourceGeneration(options.repository, {
            files: [...generated.values(), createSourceInputSnapshot(options.inputFiles)],
            inputs: options.inputs,
            parent: options.parent,
            signal: options.signal,
        });
        return {
            generation,
            verification: build.verification,
            files: generated.size,
            codeBytes: manifest.spans
                .filter((span) => span.role === "code")
                .reduce((sum, span) => sum + span.end - span.start, 0),
            withdrawnCode,
        };
    }
    finally {
        try {
            openedStore?.close();
        }
        finally {
            scratch.dispose();
        }
    }
}
//# sourceMappingURL=source-generation.js.map
import fs from "node:fs";
import path from "node:path";
import { Assembler, NodeAssemblyFileProvider, createDebugMap, } from "@uttori/asm-core";
import { canonicalJson } from "@uttori/asm-core/canonical-json";
import { durableReplace, acquireFileLease, assertSourcePath, sourceContentHash, } from "@uttori/asm-disassembler";
import { checkSnesSourceLayout, checkSnesPlacements, } from "./rom-layout/check.js";
import { checkSnesCodeFlow } from "./rom-layout/code-flow.js";
import { checkSnesRomExpansion } from "./rom-layout/expansion.js";
import { checkRawBlockConsumption } from "./rom-layout/raw-consumption.js";
import { pruneSnesSourceBuilds } from "./source-build-cache.js";
/** Reuse the first bytes read across assembler passes; record the bytes consumed, not later disk contents. */
class SourceBuildFiles extends NodeAssemblyFileProvider {
    overlays;
    snapshots = new Map();
    #bytes = 0;
    constructor(overlays = new Map()) {
        super();
        this.overlays = overlays;
    }
    readFile(file) {
        const name = path.resolve(file);
        let bytes = this.snapshots.get(name);
        if (!bytes) {
            bytes = this.overlays.get(name) ?? super.readFile(name);
            this.#bytes += bytes.length;
            if (this.#bytes > 256 * 1024 * 1024) {
                throw new Error("Source build input snapshot exceeds 256 MiB.");
            }
            this.snapshots.set(name, bytes);
        }
        return bytes;
    }
    readTextFile(file, encoding = "utf8") {
        return Buffer.from(this.readFile(file)).toString(encoding);
    }
}
/** Assemble one immutable input snapshot; return diagnostics for placement previews without publishing output. */
export function inspectSnesSource(options) {
    options.signal?.throwIfAborted();
    const root = path.resolve(options.root);
    const entrySource = path.resolve(root, options.entrySource);
    const overlays = new Map();
    let overlayBytes = 0;
    for (const [name, bytes] of options.overlays ?? []) {
        assertSourcePath(name);
        overlayBytes += bytes.length;
        if (overlayBytes > 256 * 1024 * 1024) {
            throw new Error("Source overlays exceed 256 MiB.");
        }
        overlays.set(path.resolve(root, name), Uint8Array.from(bytes));
    }
    const files = new SourceBuildFiles(overlays);
    const assembler = new Assembler({
        environment: options.environment,
        target: "snes.sfc",
        architecture: "snes.65816",
        targetOptions: options.targetOptions,
        collectSourceMetadata: true,
        fileProvider: files,
    });
    try {
        assembler.setIncludePaths([
            ...new Set([path.dirname(entrySource), ...(options.includePaths ?? [])]),
        ]);
        assembler.setCurrentFile(entrySource);
        const source = files.readTextFile(entrySource);
        const program = assembler.buildProgramModel(source, entrySource, 0);
        assembler.assembleProgram(program);
        options.signal?.throwIfAborted();
        const output = Uint8Array.from(assembler.getBinaryOutput());
        const mapping = assembler.addressToLineMapping;
        const rawBlocks = [];
        const rawIssues = [];
        if (options.rawBlocks) {
            const { directory, original, blockSize } = options.rawBlocks;
            if (!Number.isSafeInteger(blockSize) || blockSize <= 0 || blockSize > 65536) {
                throw new Error("Invalid raw block size.");
            }
            for (let start = 0; start < original.length; start += blockSize) {
                const file = path.resolve(root, directory, `${start.toString(16).padStart(6, "0")}.bin`);
                if (fs.existsSync(file)) {
                    rawBlocks.push({
                        file,
                        original: original.subarray(start, start + blockSize),
                        current: files.readFile(file),
                    });
                }
            }
            rawIssues.push(...checkRawBlockConsumption(mapping, rawBlocks));
        }
        for (const [file, bytes] of files.snapshots) {
            mapping.registerDependencySnapshot(file, bytes);
        }
        const symbols = new Map([...assembler.labelTable].map(([name, symbol]) => [name, symbol.value]));
        const requestedSymbols = new Set([
            ...(options.resolveSymbols ?? []),
            ...(options.extents ?? []).flatMap((extent) => [extent.startSymbol, extent.endSymbol]),
            ...(options.placements?.objects ?? []).flatMap((object) => [
                object.startSymbol,
                object.endSymbol,
            ]),
        ]);
        for (const name of requestedSymbols) {
            if (!symbols.has(name)) {
                // dataStructs bases and members use the assembler's structured-reference resolver;
                // they need not be ordinary labels. Missing names remain source-linked extent failures.
                try {
                    symbols.set(name, assembler.resolveNormalizedReferenceLabelValue(name));
                }
                catch {
                    /* Report below. */
                }
            }
        }
        const codeFlow = options.placements
            ? checkSnesCodeFlow(output, mapping, options.placements, options.states)
            : { diagnostics: [], states: [] };
        // Propagated leaf-block states prove widths for newly inserted instructions. Explicit interior
        // assumptions remain assertions and cannot override a contradictory predecessor path.
        const provenStates = new Map((options.states ?? []).map((state) => [state.offset, state]));
        for (const state of codeFlow.states) {
            provenStates.set(state.offset, state);
        }
        const diagnostics = checkSnesSourceLayout({
            output,
            mapping,
            expectedSize: options.expectedSize,
            states: [...provenStates.values()],
            extents: options.extents,
            requiredCpuStateRanges: options.placements?.objects
                .filter((object) => object.kind === "code")
                .map((object) => ({ start: object.start, end: object.start + object.length })),
            symbols,
        });
        if (options.expansion && (!options.rawBlocks || options.originalContent)) {
            throw new Error("Expansion requires the immutable original raw-block contract and editable source.");
        }
        if (options.rawBlocks) {
            diagnostics.push(...checkSnesRomExpansion(output, options.rawBlocks.original, options.expectedSize, options.expansion, options.placements?.objects));
        }
        diagnostics.push(...codeFlow.diagnostics, ...rawIssues.map((message) => ({ code: "raw-consumption", message })));
        if (options.placements) {
            diagnostics.push(...checkSnesPlacements(output, symbols, options.placements));
        }
        for (const file of overlays.keys()) {
            if (!files.snapshots.has(file)) {
                throw new Error(`Source preview overlay is not consumed by this assembly: ${file}`);
            }
        }
        for (const [file, bytes] of files.snapshots) {
            const current = overlays.get(file) ?? fs.readFileSync(file);
            if (sourceContentHash(current) !== sourceContentHash(bytes)) {
                throw new Error(`Source dependency changed during assembly: ${file}`);
            }
        }
        if (options.originalContent &&
            sourceContentHash(options.originalContent) !== sourceContentHash(output)) {
            throw new Error("Pure generation does not reproduce the original ROM exactly.");
        }
        return { output, mapping, symbols, snapshots: files.snapshots, diagnostics };
    }
    finally {
        assembler.dispose();
    }
}
/**
 * Publish a matching ROM/map pair only after all source and target checks pass. Inspection used
 * by placement previews has no publication path and cannot replace the last successful build.
 */
export function buildSnesSource(options) {
    options.signal?.throwIfAborted();
    for (const hash of [options.toolchainSha256, options.configurationSha256]) {
        if (!/^[\da-f]{64}$/.test(hash)) {
            throw new Error("Source build needs exact toolchain and configuration identities.");
        }
    }
    const root = path.resolve(options.root);
    const entrySource = path.resolve(root, options.entrySource);
    // JavaScript callers can supply extra properties. Published builds always describe saved files;
    // prospective overlays belong only to the explicit unpublished inspection API.
    const { output, mapping, diagnostics } = inspectSnesSource({
        ...options,
        overlays: undefined,
        resolveSymbols: undefined,
    });
    if (diagnostics.length) {
        throw new Error(diagnostics
            .slice(0, 20)
            .map((diagnostic) => `${diagnostic.file ?? entrySource}:${diagnostic.line ?? 1}: ${diagnostic.code}: ${diagnostic.message}`)
            .join("\n"));
    }
    const sources = mapping.fileList
        .map((file) => ({
        path: path.relative(root, file.name).replaceAll(path.sep, "/"),
        sha256: file.sha256,
    }))
        .toSorted((a, b) => Buffer.compare(Buffer.from(a.path), Buffer.from(b.path)));
    const outputSha256 = sourceContentHash(output);
    const inputSha256 = sourceContentHash(canonicalJson({
        sources,
        configuration: options.configurationSha256,
        toolchain: options.toolchainSha256,
        layout: {
            expectedSize: options.expectedSize,
            expansion: options.expansion ?? null,
            states: options.states ?? [],
            extents: options.extents ?? [],
            placements: options.placements
                ? { objects: options.placements.objects, references: options.placements.references }
                : null,
        },
        originalContent: options.originalContent ? sourceContentHash(options.originalContent) : null,
        rawBlocks: options.rawBlocks
            ? {
                directory: options.rawBlocks.directory,
                blockSize: options.rawBlocks.blockSize,
                originalSha256: sourceContentHash(options.rawBlocks.original),
            }
            : null,
    }));
    const map = createDebugMap({ target: "snes.sfc", output, mapping, sourceRoot: root });
    const debugMap = canonicalJson(map);
    const verification = {
        outputSha256,
        debugMapSha256: sourceContentHash(debugMap),
        toolchainSha256: options.toolchainSha256,
        checks: [
            "assembly",
            "emitted-range-overlap",
            "declared-output-size",
            "program-bank-boundaries",
            "input-freshness",
            ...(options.states?.length ? ["declared-cpu-widths"] : []),
            ...(options.extents?.length ? ["declared-fixed-extents"] : []),
            ...(options.placements ? ["declared-placements-and-references"] : []),
            ...(options.expansion ? ["declared-expansion-header-checksum-and-ownership"] : []),
            ...(options.originalContent ? ["pure-ROM-equality"] : []),
            ...(options.rawBlocks ? ["edited-raw-byte-consumption"] : []),
        ],
    };
    // Immutable content-addressed outputs keep the last successful build usable if another fails.
    // Publish the receipt last so a process interrupted between files cannot expose a mixed pair.
    const directory = path.join(options.outputDirectory, inputSha256);
    const outputFile = path.join(directory, "program.sfc");
    const debugMapFile = path.join(directory, "program.sfc.debug.json");
    const result = {
        outputFile,
        debugMapFile,
        inputSha256,
        inputs: sources,
        outputSize: output.length,
        debugMapFingerprint: map.fingerprint.value,
        verification,
        contracts: {
            cpuStates: options.states?.length ?? 0,
            fixedExtents: options.extents?.length ?? 0,
        },
    };
    const lease = acquireFileLease(path.join(options.outputDirectory, "publication.lock"));
    try {
        if (fs.existsSync(directory) && !fs.lstatSync(directory).isDirectory()) {
            throw new Error("Build cache destination is not an owned directory.");
        }
        // The pending receipt identifies interrupted outputs. Pruning runs under this same lease,
        // so it cannot remove files another process is still publishing.
        durableReplace(path.join(directory, "pending.json"), canonicalJson(result));
        durableReplace(outputFile, output);
        durableReplace(debugMapFile, debugMap);
        durableReplace(path.join(directory, "build.json"), canonicalJson(result));
        fs.rmSync(path.join(directory, "pending.json"));
        // A single lightweight pointer selects the last successful pair. Editors never scan historical
        // debug maps, and a failed build leaves this pointer at the prior validated generation.
        durableReplace(path.join(options.outputDirectory, "current.json"), canonicalJson(result));
        const cacheWarnings = pruneSnesSourceBuilds(options.outputDirectory, inputSha256);
        return cacheWarnings.length ? { ...result, cacheWarnings } : result;
    }
    finally {
        lease.release();
    }
}
//# sourceMappingURL=source-build.js.map
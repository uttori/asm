import path from "node:path";
import { Assembler, parseExpressionNode, isReferenceExpressionNode, NodeAssemblySnapshotProvider, createDebugMap, } from "@uttori/asm-core";
import { canonicalJson } from "@uttori/asm-core/canonical-json";
import { publishSourceBuild, sourceBuildCoverage, assertSourcePath, sourceContentHash, linkSourceAssembly, sourceMappingFromLink, } from "@uttori/asm-disassembler/source-project";
import { checkSnesSourceLayout, checkSnesPlacements, } from "./rom-layout/check.js";
import { checkSnesCodeFlow } from "./rom-layout/code-flow.js";
import { checkSnesRomExpansion } from "./rom-layout/expansion.js";
import { checkRawBlockConsumption } from "./rom-layout/raw-consumption.js";
/** Produce symbolic records without running layout checks that require a linked ROM or publishing artifacts. */
export function inspectSnesSourceModule(options) {
    options.signal?.throwIfAborted();
    const root = path.resolve(options.root);
    const entry = path.resolve(root, options.entrySource);
    const overlays = new Map();
    for (const [name, bytes] of options.overlays ?? []) {
        assertSourcePath(name);
        overlays.set(path.resolve(root, name), bytes);
    }
    const files = new NodeAssemblySnapshotProvider({ overlays });
    const assembler = new Assembler({
        environment: options.environment,
        target: "snes.sfc",
        targetOptions: options.targetOptions,
        module: options.module,
        fileProvider: files,
    });
    try {
        assembler.setIncludePaths([...new Set([path.dirname(entry), ...(options.includePaths ?? [])])]);
        assembler.assembleSource(files.readTextFile(entry), entry);
        options.signal?.throwIfAborted();
        files.assertUnchanged();
        for (const [name, bytes] of overlays) {
            if (bytes !== null && !files.snapshots.has(name)) {
                throw new Error(`Module preview overlay is not consumed: ${name}`);
            }
        }
        const module = assembler.getAssemblyModule();
        const inputs = [...files.snapshots]
            .map(([name, bytes]) => ({
            path: path.relative(root, name).split(path.sep).join("/"),
            sha256: sourceContentHash(bytes),
        }))
            .toSorted((a, b) => a.path.localeCompare(b.path));
        const linkRecipe = options.link
            ? structuredClone(options.link.recipe)
            : assembler.getLinkRecipe();
        return {
            modules: [module],
            inputs,
            ...(linkRecipe ? { linkRecipe } : {}),
            inputSha256: sourceContentHash(canonicalJson({
                module: options.module,
                target: "snes.sfc",
                targetOptions: assembler.targetOptions,
                inputs,
                linkRecipe: linkRecipe ?? null,
                toolchain: options.toolchainSha256 ?? null,
                configuration: options.configurationSha256 ?? null,
            })),
        };
    }
    finally {
        assembler.dispose();
    }
}
/** Assemble one immutable input snapshot; return diagnostics for placement previews without publishing output. */
export function inspectSnesSource(options) {
    options.signal?.throwIfAborted();
    const root = path.resolve(options.root);
    const entrySource = path.resolve(root, options.entrySource);
    const overlays = new Map();
    for (const [name, bytes] of options.overlays ?? []) {
        assertSourcePath(name);
        overlays.set(path.resolve(root, name), bytes);
    }
    const files = new NodeAssemblySnapshotProvider({ overlays });
    // Bind the selected recipe/configuration bytes before assembly, then retain them in normal freshness checks.
    for (const input of [...(options.controlInputs ?? []), ...(options.link?.dependencies ?? [])]) {
        if (sourceContentHash(files.readFile(input.path)) !== input.sha256) {
            throw new Error(`Source link input changed: ${input.path}`);
        }
    }
    const assembler = new Assembler({
        module: options.link?.module,
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
        if (options.link) {
            // Module production records the entry text as an owned dependency through its source boundary.
            // A prebuilt program alone would retain included files but omit bytes emitted by the entry itself.
            assembler.assembleSource(source, entrySource);
        }
        else {
            const program = assembler.buildProgramModel(source, entrySource, 0);
            assembler.assembleProgram(program);
        }
        options.signal?.throwIfAborted();
        const requestedSymbols = new Set([
            ...(options.resolveSymbols ?? []),
            ...(options.extents ?? []).flatMap((extent) => [extent.startSymbol, extent.endSymbol]),
            ...(options.placements?.objects ?? []).flatMap((object) => [
                object.startSymbol,
                object.endSymbol,
            ]),
        ]);
        const linked = options.link
            ? linkSourceAssembly(assembler, options.link, options.signal, [...requestedSymbols])
            : undefined;
        const output = linked?.output ?? Uint8Array.from(assembler.getBinaryOutput());
        const mapping = linked ? sourceMappingFromLink(linked, root) : assembler.addressToLineMapping;
        const headerSize = options.link?.recipe.targetOptions?.headerSize === 512 ? 512 : 0;
        const content = output.subarray(headerSize);
        // Layout contracts use headerless original identities; published maps retain complete container offsets.
        const layoutMapping = linked && headerSize ? sourceMappingFromLink(linked, root, headerSize) : mapping;
        const rawBlocks = [];
        const rawIssues = [];
        if (options.rawBlocks) {
            const { directory, original, blockSize } = options.rawBlocks;
            if (!Number.isSafeInteger(blockSize) || blockSize <= 0 || blockSize > 65536) {
                throw new Error("Invalid raw block size.");
            }
            for (let start = 0; start < original.length; start += blockSize) {
                const file = path.resolve(root, directory, `${start.toString(16).padStart(6, "0")}.bin`);
                if (files.stat(file).exists) {
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
        const symbols = new Map(linked
            ? linked.symbols.map((symbol) => [symbol.name, symbol.value])
            : [...assembler.labelTable].map(([name, symbol]) => [name, symbol.value]));
        for (const name of requestedSymbols) {
            if (!symbols.has(name) && !linked) {
                // dataStructs bases and members use the assembler's structured-reference resolver;
                // they need not be ordinary labels. Missing names remain source-linked extent failures.
                try {
                    const reference = parseExpressionNode(name);
                    if (isReferenceExpressionNode(reference)) {
                        symbols.set(name, assembler.evaluateReferenceExpressionNode(reference));
                    }
                }
                catch {
                    /* Report below. */
                }
            }
        }
        const codeFlow = options.placements
            ? checkSnesCodeFlow(content, layoutMapping, options.placements, options.states)
            : { diagnostics: [], states: [] };
        // Propagated leaf-block states prove widths for newly inserted instructions. Explicit interior
        // assumptions remain assertions and cannot override a contradictory predecessor path.
        const provenStates = new Map((options.states ?? []).map((state) => [state.offset, state]));
        for (const state of codeFlow.states) {
            provenStates.set(state.offset, state);
        }
        const diagnostics = checkSnesSourceLayout({
            output: content,
            mapping: layoutMapping,
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
            diagnostics.push(...checkSnesRomExpansion(content, options.rawBlocks.original, options.expectedSize, options.expansion, options.placements?.objects));
        }
        diagnostics.push(...codeFlow.diagnostics, ...rawIssues.map((message) => ({ code: "raw-consumption", message })));
        if (options.placements) {
            diagnostics.push(...checkSnesPlacements(content, symbols, options.placements));
        }
        for (const [file, bytes] of overlays) {
            // A retired input must no longer be consumed. Reading it already fails in the provider;
            // absence therefore has the opposite success condition from a candidate creation/edit.
            if (bytes !== null && !files.snapshots.has(file)) {
                throw new Error(`Source preview overlay is not consumed by this assembly: ${file}`);
            }
        }
        files.assertUnchanged();
        if (options.originalContent &&
            sourceContentHash(options.originalContent) !== sourceContentHash(content)) {
            throw new Error("Pure generation does not reproduce the original ROM exactly.");
        }
        if (options.originalContainer && !Buffer.from(output).equals(options.originalContainer)) {
            throw new Error("Linked pure generation does not reproduce the complete original container.");
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
        ...(options.link
            ? { link: { module: options.link.module, recipe: options.link.recipe } }
            : {}),
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
            ...(options.link ? ["object-serialization", "link-placement-and-relocations"] : []),
            ...(options.originalContainer ? ["complete-container-equality"] : []),
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
        ...(options.rawBlocks
            ? { coverage: sourceBuildCoverage(mapping, options.root, options.rawBlocks) }
            : {}),
        inputs: sources,
        outputSize: output.length,
        debugMapFingerprint: map.fingerprint.value,
        verification,
        contracts: {
            cpuStates: options.states?.length ?? 0,
            fixedExtents: options.extents?.length ?? 0,
        },
    };
    return publishSourceBuild({
        directory: options.outputDirectory,
        receipt: result,
        output,
        debugMap: debugMap,
        signal: options.signal,
    });
}
//# sourceMappingURL=source-build.js.map
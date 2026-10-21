import path from "node:path";
import { Assembler, NodeAssemblySnapshotProvider, createDebugMap, } from "@uttori/asm-core";
import { canonicalJson } from "@uttori/asm-core/canonical-json";
import { checkRawBlockConsumption, publishSourceBuild, assertSourcePath, sourceContentHash, } from "@uttori/asm-disassembler/source-project";
import { NesCartridge } from "./cartridge.js";
import { validateNesMapper } from "./mapper.js";
/** Assemble a complete iNES image without publication; stale dependencies invalidate the result. */
export function inspectNesSource(options) {
    options.signal?.throwIfAborted();
    const root = path.resolve(options.root);
    const entry = path.resolve(root, options.entrySource);
    const overlays = new Map();
    for (const [file, bytes] of options.overlays ?? []) {
        assertSourcePath(file);
        overlays.set(path.resolve(root, file), bytes);
    }
    const files = new NodeAssemblySnapshotProvider({ overlays });
    const assembler = new Assembler({
        environment: options.environment,
        target: "65xx.nes",
        architecture: "65xx.2a03",
        targetOptions: options.targetOptions,
        collectSourceMetadata: true,
        fileProvider: files,
    });
    try {
        assembler.setIncludePaths([path.dirname(entry), ...(options.includePaths ?? [])]);
        assembler.setCurrentFile(entry);
        assembler.assembleSource(files.readTextFile(entry), entry);
        const output = Uint8Array.from(assembler.getBinaryOutput());
        const cartridge = new NesCartridge(output);
        validateNesMapper(cartridge);
        if (options.expectedHeader && !Buffer.from(cartridge.header()).equals(options.expectedHeader)) {
            throw new Error("NES fixed-layout builds must preserve the original iNES header.");
        }
        if (output.length !== options.expectedSize) {
            throw new Error(`NES layout expected ${options.expectedSize} bytes; received ${output.length}.`);
        }
        const mapping = assembler.addressToLineMapping;
        if (options.rawBlocks) {
            const { directory, original, blockSize } = options.rawBlocks;
            if (!Number.isSafeInteger(blockSize) || blockSize < 1 || blockSize > 65536) {
                throw new Error("Invalid raw block size.");
            }
            const blocks = [];
            for (let start = 0; start < original.length; start += blockSize) {
                const file = path.resolve(root, directory, `${start.toString(16).padStart(6, "0")}.bin`);
                if (files.stat(file).exists) {
                    blocks.push({
                        file,
                        original: original.subarray(start, start + blockSize),
                        current: files.readFile(file),
                    });
                }
            }
            const issues = checkRawBlockConsumption(mapping, blocks);
            if (issues.length) {
                throw new Error(issues.join("\n"));
            }
        }
        for (const [file, bytes] of files.snapshots) {
            mapping.registerDependencySnapshot(file, bytes);
        }
        files.assertUnchanged();
        if (options.originalContent &&
            sourceContentHash(output) !== sourceContentHash(options.originalContent)) {
            throw new Error("Pure NES generation does not reproduce the complete original cartridge.");
        }
        options.signal?.throwIfAborted();
        return {
            output,
            mapping,
            snapshots: files.snapshots,
            symbols: new Map([...assembler.labelTable].map(([name, symbol]) => [name, symbol.value])),
            diagnostics: [],
        };
    }
    finally {
        assembler.dispose();
    }
}
/** Publish immutable matching artifacts, then advance the current-build pointer under one lease. */
export function buildNesSource(options) {
    for (const hash of [options.toolchainSha256, options.configurationSha256]) {
        if (!/^[\da-f]{64}$/.test(hash)) {
            throw new Error("NES build requires exact configuration and toolchain hashes.");
        }
    }
    const { output, mapping, snapshots } = inspectNesSource({ ...options, overlays: undefined });
    const inputs = [...snapshots]
        .map(([file, bytes]) => ({
        path: path.relative(options.root, file).split(path.sep).join("/"),
        sha256: sourceContentHash(bytes),
    }))
        .toSorted((a, b) => a.path.localeCompare(b.path));
    const inputSha256 = sourceContentHash(canonicalJson({
        inputs,
        configuration: options.configurationSha256,
        toolchain: options.toolchainSha256,
        expectedSize: options.expectedSize,
        expectedHeader: options.expectedHeader ? [...options.expectedHeader] : null,
        raw: options.rawBlocks ? sourceContentHash(options.rawBlocks.original) : null,
        original: options.originalContent ? sourceContentHash(options.originalContent) : null,
    }));
    const map = createDebugMap({ target: "65xx.nes", output, mapping, sourceRoot: options.root });
    const mapBytes = canonicalJson(map);
    const directory = path.join(options.outputDirectory, inputSha256);
    const outputFile = path.join(directory, "program.nes");
    const debugMapFile = `${outputFile}.debug.json`;
    const result = {
        outputFile,
        debugMapFile,
        inputSha256,
        inputs,
        outputSize: output.length,
        debugMapFingerprint: map.fingerprint.value,
        contracts: { cpuStates: 0, fixedExtents: 0 },
        verification: {
            outputSha256: sourceContentHash(output),
            debugMapSha256: sourceContentHash(mapBytes),
            toolchainSha256: options.toolchainSha256,
            checks: [
                "assembly",
                "ines-sections",
                "declared-output-size",
                "input-freshness",
                ...(options.rawBlocks ? ["edited-raw-byte-consumption"] : []),
                ...(options.originalContent ? ["pure-ROM-equality"] : []),
            ],
        },
    };
    return publishSourceBuild({
        directory: options.outputDirectory,
        receipt: result,
        output,
        debugMap: mapBytes,
        signal: options.signal,
    });
}
//# sourceMappingURL=source-build.js.map
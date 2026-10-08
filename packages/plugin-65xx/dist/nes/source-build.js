import fs from "node:fs";
import path from "node:path";
import { Assembler, NodeAssemblyFileProvider, createDebugMap, } from "@uttori/asm-core";
import { canonicalJson } from "@uttori/asm-core/canonical-json";
import { checkRawBlockConsumption, acquireFileLease, durableReplace, sourceContentHash, } from "@uttori/asm-disassembler";
import { NesCartridge } from "./cartridge.js";
import { validateNesMapper } from "./mapper.js";
/** Each pass sees the same bytes. Overlays are inspection-only and never enter a published build. */
class NesBuildFiles extends NodeAssemblyFileProvider {
    overlays;
    snapshots = new Map();
    constructor(overlays) {
        super();
        this.overlays = overlays;
    }
    stat(file) {
        if (this.overlays.has(file)) {
            const bytes = this.overlays.get(file);
            return { exists: bytes != null, readable: bytes != null, size: bytes?.length };
        }
        return super.stat(file);
    }
    readFile(file) {
        let bytes = this.snapshots.get(file);
        if (!bytes) {
            const overlay = this.overlays.get(file);
            if (overlay === null)
                throw new Error(`Removed source is still consumed: ${file}`);
            bytes = Uint8Array.from(overlay ?? super.readFile(file));
            this.snapshots.set(file, bytes);
        }
        return bytes.slice();
    }
    readTextFile(file) {
        return Buffer.from(this.readFile(file)).toString("utf8");
    }
}
/** Assemble a complete iNES image without publication; stale dependencies invalidate the result. */
export function inspectNesSource(options) {
    options.signal?.throwIfAborted();
    const root = path.resolve(options.root);
    const entry = path.resolve(root, options.entrySource);
    const overlays = new Map([...(options.overlays ?? [])].map(([file, bytes]) => [path.resolve(root, file), bytes]));
    const files = new NesBuildFiles(overlays);
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
        if (output.length !== options.expectedSize)
            throw new Error(`NES layout expected ${options.expectedSize} bytes; received ${output.length}.`);
        const mapping = assembler.addressToLineMapping;
        if (options.rawBlocks) {
            const { directory, original, blockSize } = options.rawBlocks;
            if (!Number.isSafeInteger(blockSize) || blockSize < 1 || blockSize > 65536)
                throw new Error("Invalid raw block size.");
            const blocks = [];
            for (let start = 0; start < original.length; start += blockSize) {
                const file = path.resolve(root, directory, `${start.toString(16).padStart(6, "0")}.bin`);
                if (files.stat(file).exists)
                    blocks.push({
                        file,
                        original: original.subarray(start, start + blockSize),
                        current: files.readFile(file),
                    });
            }
            const issues = checkRawBlockConsumption(mapping, blocks);
            if (issues.length)
                throw new Error(issues.join("\n"));
        }
        for (const [file, bytes] of files.snapshots) {
            mapping.registerDependencySnapshot(file, bytes);
            if (sourceContentHash(overlays.get(file) ?? fs.readFileSync(file)) !== sourceContentHash(bytes))
                throw new Error(`Source changed during NES assembly: ${file}`);
        }
        if (options.originalContent &&
            sourceContentHash(output) !== sourceContentHash(options.originalContent))
            throw new Error("Pure NES generation does not reproduce the complete original cartridge.");
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
    for (const hash of [options.toolchainSha256, options.configurationSha256])
        if (!/^[\da-f]{64}$/.test(hash))
            throw new Error("NES build requires exact configuration and toolchain hashes.");
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
    const lease = acquireFileLease(path.join(options.outputDirectory, "publication.lock"));
    try {
        durableReplace(outputFile, output);
        durableReplace(debugMapFile, mapBytes);
        durableReplace(path.join(directory, "build.json"), canonicalJson(result));
        durableReplace(path.join(options.outputDirectory, "current.json"), canonicalJson(result));
        return result;
    }
    finally {
        lease.release();
    }
}
//# sourceMappingURL=source-build.js.map
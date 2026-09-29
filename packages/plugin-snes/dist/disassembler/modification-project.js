import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Assembler, NodeAssemblyFileProvider, createDebugMap, validateDebugMap, CRC32, } from "@uttori/asm-core";
import { canonicalJson } from "@uttori/asm-core/canonical-json";
import { acquireFileLease, durableReplace, loadSourceExportManifest, validateSourceExportFiles, validateSourceExportInputs, sourceExportSha256, sourceGenerationIdentity, assertSourceGeneration, RomImage, } from "@uttori/asm-disassembler";
import { createSnesAssemblerEnvironment } from "../assembler.js";
import { snesRomAddressSpace } from "../target/address-space.js";
import { createSnesAddressContext } from "./address-identities.js";
import { encodeOwnedAsset, ownedAssetMediaType, } from "./modification-assets.js";
import { retainModificationBaseline } from "./modification-baseline.js";
import { verifySnesProjectRoundTrip, initializeSnesDisassemblyWorkspace, } from "./project-initializer.js";
import { SNES_MAPPERS } from "./rom-header.js";
/** User-owned manifest, separate from the baseline generated-files.json contract. */
export const MODIFICATION_MANIFEST = "modification.json";
/**
 * Reject ambiguous paths and symlinks instead of allowing inputs to escape their ownership root.
 * @param {string} root Owning modification directory.
 * @param {string} relative Safe project-relative filename.
 * @returns {string} Absolute path with no symlink components below root.
 */
export const modificationOwnedPath = (root, relative) => {
    if (!/^[\w ./-]+$/.test(relative) ||
        path.isAbsolute(relative) ||
        relative.split("/").some((part) => !part || part === "." || part === "..")) {
        throw new Error(`Invalid owned input path: ${relative}`);
    }
    let cursor = root;
    for (const part of relative.split("/")) {
        cursor = path.join(cursor, part);
        if (fs.existsSync(cursor) && fs.lstatSync(cursor).isSymbolicLink()) {
            throw new Error(`Symbolic link is not an owned input: ${cursor}`);
        }
    }
    return cursor;
};
/**
 * Decode the explicit budget without allowing Buffer's permissive partial-hex parsing.
 * @param {RomReplacement} replacement Reviewed range contract.
 * @returns {Buffer} Original bytes, whose length is the exact budget.
 */
const expectedBytes = (replacement) => {
    if (typeof replacement.expected !== "string" ||
        replacement.expected.length % 2 !== 0 ||
        !/^[\dA-Fa-f]+$/.test(replacement.expected)) {
        throw new Error(`Replacement ${replacement.id} needs nonempty, even-length expected hex bytes.`);
    }
    return Buffer.from(replacement.expected, "hex");
};
/** Preserve the declared element type while checking an untrusted JSON array container.
 * @param {unknown} value JSON field that must be a list.
 * @returns {boolean} Runtime array membership without widening typed elements to any.
 */
const isArray = (value) => Array.isArray(value);
/**
 * Validate every range and placement before invoking the assembler or writing output.
 * @param {string} manifestFile Modification manifest on disk.
 * @returns {RomModificationProject} Validated contract; malformed input throws.
 */
export const loadRomModificationProject = (manifestFile) => {
    const project = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
    if (project.format !== "uttori-snes-modification" ||
        project.schemaVersion !== 1 ||
        project.checksumPolicy !== "preserve" ||
        !project.baseline ||
        !isArray(project.replacements)) {
        throw new Error("Unsupported modification manifest or checksum policy.");
    }
    const base = project.baseline;
    if (!SNES_MAPPERS.includes(base.mapper) ||
        ![0, 512].includes(base.rom?.headerSize) ||
        !Number.isSafeInteger(base.rom?.contentSize) ||
        base.rom.contentSize <= 0 ||
        base.rom.contentSize > 0x1000000 ||
        typeof base.sourceDirectory !== "string" ||
        typeof base.romFile !== "string" ||
        ![base.manifestSha256, base.interfaceSha256, base.rom.sha256, base.rom.contentSha256].every((hash) => typeof hash === "string" && /^[\da-f]{64}$/.test(hash))) {
        throw new Error("Invalid pinned baseline identity.");
    }
    const outputSize = project.expansion?.size ?? base.rom.contentSize;
    if (project.expansion &&
        (!Number.isSafeInteger(outputSize) ||
            outputSize < base.rom.contentSize ||
            outputSize > 0x1000000 ||
            !Number.isInteger(project.expansion.fill) ||
            project.expansion.fill < 0 ||
            project.expansion.fill > 255)) {
        throw new Error("Expansion needs a size between the original ROM and 16 MiB and a fill byte from 0 to 255.");
    }
    if (project.expansion) {
        const mapping = createSnesAddressContext(base.mapper);
        // Filled growth still occupies ROM space. Reject mirror/unmapped tails even if no owner emits there.
        for (let offset = base.rom.contentSize; offset < outputSize; offset = Math.min(offset + 0x8000, outputSize)) {
            const last = Math.min(offset + 0x8000, outputSize) - 1;
            for (const position of [offset, last]) {
                const address = snesRomAddressSpace.fromOutputOffset(position, mapping);
                if (address < 0 || snesRomAddressSpace.toOutputOffset(address, mapping) !== position) {
                    throw new Error("Expansion exceeds this mapper's canonical ROM capacity.");
                }
            }
        }
    }
    const seen = new Set();
    let end = 0;
    const context = createSnesAddressContext(base.mapper);
    for (const replacement of [...project.replacements].sort((a, b) => a.offset - b.offset)) {
        const bytes = expectedBytes(replacement);
        if (!/^[A-Z_a-z]\w*$/.test(replacement.id) || seen.has(replacement.id)) {
            throw new Error("Replacement IDs must be unique assembly identifiers.");
        }
        seen.add(replacement.id);
        if (!Number.isSafeInteger(replacement.offset) ||
            replacement.offset < end ||
            replacement.offset + bytes.length > outputSize) {
            throw new Error(`Replacement ${replacement.id} overlaps or exceeds the baseline ROM.`);
        }
        if (!replacement.input?.startsWith("inputs/")) {
            throw new Error("Replacement inputs must live under inputs/.");
        }
        modificationOwnedPath(path.dirname(manifestFile), replacement.input);
        if (!["assembly", "binary", "asset"].includes(replacement.kind) ||
            (replacement.kind === "assembly" &&
                (![8, 16].includes(replacement.accumulator ?? 0) ||
                    ![8, 16].includes(replacement.index ?? 0)))) {
            throw new Error(`Replacement ${replacement.id} needs a supported input kind and explicit assembly widths.`);
        }
        if (replacement.fill !== undefined &&
            (!Number.isInteger(replacement.fill) ||
                replacement.fill < 0 ||
                replacement.fill > 255 ||
                replacement.kind === "assembly")) {
            throw new Error("Only binary or asset replacements may declare a padding byte from 0 to 255.");
        }
        if (replacement.kind === "asset" && !replacement.asset) {
            throw new Error("Asset replacement requires a recipe.");
        }
        // One linear CPU span keeps branch/bank semantics explicit. Split a bank-crossing edit into ranges.
        const address = snesRomAddressSpace.fromOutputOffset(replacement.offset, context);
        const last = snesRomAddressSpace.fromOutputOffset(replacement.offset + bytes.length - 1, context);
        if (address < 0 ||
            last !== address + bytes.length - 1 ||
            address >>> 16 !== last >>> 16 ||
            snesRomAddressSpace.toOutputOffset(address, context) !== replacement.offset) {
            throw new Error(`Replacement ${replacement.id} crosses a mapper bank or is unmapped. Split the range.`);
        }
        end = replacement.offset + bytes.length;
    }
    return project;
};
/** A snapshotting provider limits dependencies to owned inputs and the pinned interface. */
class ModificationFiles extends NodeAssemblyFileProvider {
    root;
    driver;
    driverText;
    snapshots = new Map();
    constructor(root, driver, driverText) {
        super();
        this.root = root;
        this.driver = driver;
        this.driverText = driverText;
    }
    readFile(file) {
        if (file === this.driver) {
            return Buffer.from(this.driverText);
        }
        const relative = path.relative(this.root, file).split(path.sep).join("/");
        if (relative !== "baseline-interface.asm" && !relative.startsWith("inputs/")) {
            throw new Error(`Modification dependency is outside owned inputs: ${file}`);
        }
        modificationOwnedPath(this.root, relative);
        let bytes = this.snapshots.get(file);
        if (!bytes) {
            bytes = fs.readFileSync(file);
            this.snapshots.set(file, bytes);
        }
        return bytes;
    }
    readTextFile(file, encoding = "utf8") {
        return Buffer.from(this.readFile(file)).toString(encoding);
    }
    /** Detect edits made during assembly before making this result current. */
    assertUnchanged() {
        for (const [file, bytes] of this.snapshots) {
            if (!fs.readFileSync(file).equals(bytes)) {
                throw new Error(`Input changed during build: ${file}. Build again.`);
            }
        }
    }
}
/**
 * Merge mappings conservatively: a baseline line touched by a replacement loses its old mapping.
 * @param {DebugMap} baseline Verified original ROM map.
 * @param {readonly DebugMap[]} patches Source maps for bounded replacement emissions.
 * @param {RomModificationProject} project Declared replacement ownership.
 * @param {string} sourceDirectory Root for baseline source paths.
 * @param {Uint8Array} output Complete modified headerless image.
 * @returns {DebugMap} Map bound to modified bytes, without uploaded baseline mappings.
 */
const mergeModifiedMaps = (baseline, patches, project, sourceDirectory, output) => {
    const overlaps = (start, end) => start === undefined ||
        end === undefined ||
        project.replacements.some((entry) => start < entry.offset + expectedBytes(entry).length && end > entry.offset);
    const ranges = baseline.ranges.filter((entry) => !overlaps(entry.outputStart, entry.outputEnd));
    // ROM-bound uploaded code mappings cannot be carried across a modified image without reanalysis.
    const retainedLines = new Set(ranges.map((entry) => `${entry.sourceId}:${entry.line}`));
    const instructions = (baseline.instructions ?? []).filter((entry) => retainedLines.has(`${entry.sourceId}:${entry.line}`));
    const sources = baseline.sources.map((entry) => ({
        ...entry,
        path: path.resolve(sourceDirectory, entry.path),
    }));
    const assets = (baseline.assets ?? []).filter((entry) => !overlaps(entry.outputOffset, entry.outputOffset === undefined ? undefined : entry.outputOffset + entry.size));
    for (const patch of patches) {
        const shift = sources.length;
        sources.push(...patch.sources.map((entry) => ({ ...entry, id: entry.id + shift })));
        ranges.push(...patch.ranges.map((entry) => ({ ...entry, sourceId: entry.sourceId + shift })));
        instructions.push(...(patch.instructions ?? []).map((entry) => ({
            ...entry,
            sourceId: entry.sourceId + shift,
        })));
        assets.push(...(patch.assets ?? []).map((entry) => ({
            ...entry,
            sourceId: entry.sourceId + shift,
            assetSourceId: entry.assetSourceId + shift,
        })));
    }
    const payload = {
        format: baseline.format,
        schemaVersion: baseline.schemaVersion,
        target: baseline.target,
        output: { size: output.length, sha256: sourceExportSha256(output) },
        sources,
        ranges,
        instructions,
        assets,
    };
    return {
        ...payload,
        fingerprint: { algorithm: "sha256", value: sourceExportSha256(canonicalJson(payload)) },
    };
};
/**
 * Creates a new owned project only after exact baseline verification; existing directories are preserved.
 * @param {object} options Original ROM, source generation, new destination and trusted loader.
 * @returns {Promise<string>} Newly created manifest filename.
 */
export const createRomModificationProject = async (options) => {
    const root = path.resolve(options.directory);
    if (fs.existsSync(root)) {
        throw new Error(`Modification destination already exists: ${root}`);
    }
    const sourceDirectory = path.resolve(options.sourceDirectory);
    const release = acquireFileLease(path.join(sourceDirectory, ".uttori-publication.lock"));
    try {
        const generation = sourceGenerationIdentity(sourceDirectory);
        const verified = await verifySnesProjectRoundTrip({
            ...options,
            onProgress: ({ message }) => options.onProgress?.(message),
            emitInterface: true,
        });
        assertSourceGeneration(sourceDirectory, generation);
        const manifest = loadSourceExportManifest(sourceDirectory);
        const interfaceBytes = fs.readFileSync(verified.interfaceFile);
        const project = {
            format: "uttori-snes-modification",
            schemaVersion: 1,
            checksumPolicy: "preserve",
            baseline: {
                sourceDirectory: path.relative(root, sourceDirectory),
                romFile: path.relative(root, path.resolve(options.romFile)),
                rom: manifest.rom,
                mapper: manifest.mapper,
                manifestSha256: sourceExportSha256(fs.readFileSync(path.join(sourceDirectory, "generated-files.json"))),
                interfaceSha256: sourceExportSha256(interfaceBytes),
            },
            replacements: [],
        };
        fs.mkdirSync(root);
        fs.mkdirSync(path.join(root, "inputs"));
        durableReplace(path.join(root, "baseline-interface.asm"), interfaceBytes);
        const file = path.join(root, MODIFICATION_MANIFEST);
        const snapshotDirectory = retainModificationBaseline(root, sourceDirectory, options.romFile, interfaceBytes);
        durableReplace(file, JSON.stringify({ ...project, baseline: { ...project.baseline, snapshotDirectory } }, null, 2) + "\n");
        return file;
    }
    finally {
        release.release();
    }
};
/**
 * Scaffold an owned replacement from exact original bytes, optionally encoding a reviewed uint16 value.
 * @param {object} options Reviewed range and optional two-byte value.
 * @returns {string} New owned input filename; existing files are never overwritten.
 */
export const addRomReplacement = (options) => {
    const root = path.dirname(path.resolve(options.manifestFile));
    const lease = acquireFileLease(path.join(root, ".build.lock"));
    try {
        const project = loadRomModificationProject(options.manifestFile);
        if (!/^[A-Z_a-z]\w*$/.test(options.id) ||
            !Number.isSafeInteger(options.offset) ||
            options.offset < 0 ||
            !Number.isSafeInteger(options.size) ||
            options.size < 1 ||
            options.size > 65536 ||
            options.offset + options.size > (project.expansion?.size ?? project.baseline.rom.contentSize)) {
            throw new Error("Choose a valid identifier and a bounded ROM byte range (at most one bank).");
        }
        if (options.value !== undefined &&
            (options.size !== 2 ||
                options.kind !== "assembly" ||
                !Number.isSafeInteger(options.value) ||
                options.value < 0 ||
                options.value > 65535)) {
            throw new Error("A uint16 value must be an integer from 0 to 65535 in a two-byte assembly replacement.");
        }
        const rom = RomImage.load(path.resolve(root, project.baseline.romFile), {
            headerSize: project.baseline.rom.headerSize,
        });
        if (rom.identity.sha256 !== project.baseline.rom.sha256) {
            throw new Error("Baseline ROM identity mismatch.");
        }
        const expanded = Buffer.alloc(project.expansion?.size ?? rom.length, project.expansion?.fill ?? 0);
        expanded.set(rom.read(0, rom.length));
        const expected = expanded.subarray(options.offset, options.offset + options.size);
        const input = `inputs/${options.id}.${options.kind === "assembly" ? "asm" : "bin"}`;
        const replacement = {
            id: options.id,
            offset: options.offset,
            expected: expected.toString("hex"),
            input,
            kind: options.kind,
            ...(options.kind === "assembly" ? { accumulator: 16, index: 16 } : {}),
        };
        if (project.replacements.some((entry) => entry.id === options.id ||
            (entry.offset < options.offset + options.size &&
                options.offset < entry.offset + expectedBytes(entry).length))) {
            throw new Error("Replacement ID or byte range is already owned.");
        }
        const context = createSnesAddressContext(project.baseline.mapper);
        const first = snesRomAddressSpace.fromOutputOffset(options.offset, context);
        const last = snesRomAddressSpace.fromOutputOffset(options.offset + options.size - 1, context);
        if (first < 0 || last !== first + options.size - 1 || first >>> 16 !== last >>> 16) {
            throw new Error("Split replacements at mapper bank boundaries.");
        }
        const file = modificationOwnedPath(root, input);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        const lines = [
            "; User-owned replacement. Placement and expected bytes are in modification.json.",
        ];
        if (options.value !== undefined) {
            lines.push(`dw ${options.value}`);
        }
        else {
            for (let i = 0; i < expected.length; i += 16) {
                lines.push(`db ${[...expected.subarray(i, i + 16)].map((byte) => `$${byte.toString(16).padStart(2, "0")}`).join(", ")}`);
            }
        }
        // Exclusive creation preserves an orphan input from an interrupted previous attempt for review.
        fs.writeFileSync(file, options.kind === "binary" ? expected : lines.join("\n") + "\n", {
            flag: "wx",
        });
        durableReplace(options.manifestFile, JSON.stringify({ ...project, replacements: [...project.replacements, replacement] }, null, 2) + "\n");
        return file;
    }
    finally {
        lease.release();
    }
};
/**
 * Verify the pinned baseline, assemble exact ranges, then atomically publish a pointer to a complete generation.
 * @param {ModificationOperationOptions} options Manifest and cancellation/host services.
 * @returns {Promise<ModifiedRomBuild>} Complete immutable build artifacts. Failure preserves the last successful pointer.
 */
export const buildModifiedRom = async (options) => {
    const file = path.resolve(options.manifestFile);
    const root = path.dirname(file);
    const release = acquireFileLease(path.join(root, ".build.lock"));
    let releaseSource;
    try {
        const manifestBytes = fs.readFileSync(file);
        const project = loadRomModificationProject(file);
        const sourceDirectory = path.resolve(root, project.baseline.sourceDirectory);
        releaseSource = acquireFileLease(path.join(sourceDirectory, ".uttori-publication.lock"));
        const generation = sourceGenerationIdentity(sourceDirectory);
        const sourceManifest = path.join(sourceDirectory, "generated-files.json");
        if (sourceExportSha256(fs.readFileSync(sourceManifest)) !== project.baseline.manifestSha256) {
            throw new Error("Baseline generation changed. This modification requires an explicit reviewed rebase; its pin has not been changed.");
        }
        const exported = loadSourceExportManifest(sourceDirectory);
        if (exported.mapper !== project.baseline.mapper ||
            exported.rom.headerSize !== project.baseline.rom.headerSize ||
            exported.rom.contentSize !== project.baseline.rom.contentSize ||
            exported.rom.sha256 !== project.baseline.rom.sha256) {
            throw new Error("Modification mapping/header rules do not match the pinned source export.");
        }
        const interfaceFile = modificationOwnedPath(root, "baseline-interface.asm");
        if (sourceExportSha256(fs.readFileSync(interfaceFile)) !== project.baseline.interfaceSha256) {
            throw new Error("Pinned baseline interface changed.");
        }
        const romFile = path.resolve(root, project.baseline.romFile);
        const rom = RomImage.load(romFile, { headerSize: project.baseline.rom.headerSize });
        if (rom.identity.sha256 !== project.baseline.rom.sha256 ||
            rom.identity.contentSha256 !== project.baseline.rom.contentSha256) {
            throw new Error("Baseline ROM identity mismatch.");
        }
        options.signal?.throwIfAborted();
        options.onProgress?.("Verifying pinned baseline byte-for-byte…");
        const verified = await verifySnesProjectRoundTrip({
            sourceDirectory,
            romFile,
            signal: options.signal,
            loadEnvironment: options.loadEnvironment,
        });
        const assetEnvironment = project.replacements.some((entry) => entry.kind === "asset")
            ? ((await options.loadEnvironment?.(path.join(sourceDirectory, exported.buildConfiguration)))
                ?.environment ?? (await createSnesAssemblerEnvironment()))
            : undefined;
        const baseline = Buffer.alloc(project.expansion?.size ?? rom.length, project.expansion?.fill ?? 0);
        baseline.set(rom.read(0, rom.length));
        const output = Buffer.from(baseline);
        const baselineMap = JSON.parse(fs.readFileSync(verified.debugMap, "utf8"));
        const maps = [];
        const snapshots = new Map([[interfaceFile, project.baseline.interfaceSha256]]);
        const context = createSnesAddressContext(project.baseline.mapper);
        const placements = project.replacements
            .map((entry) => `Patch_${entry.id} = $${snesRomAddressSpace.fromOutputOffset(entry.offset, context).toString(16)}`)
            .join("\n");
        for (const replacement of project.replacements) {
            options.signal?.throwIfAborted();
            const expected = expectedBytes(replacement);
            if (!baseline
                .subarray(replacement.offset, replacement.offset + expected.length)
                .equals(expected)) {
                throw new Error(`Expected original bytes do not match for ${replacement.id}.`);
            }
            if (replacement.kind === "asset" ||
                (replacement.kind === "binary" && replacement.fill !== undefined)) {
                const input = modificationOwnedPath(root, replacement.input);
                const source = fs.readFileSync(input);
                snapshots.set(input, sourceExportSha256(source));
                let encoded = source;
                if (replacement.kind === "asset") {
                    encoded = Buffer.from(encodeOwnedAsset(source, replacement.asset, assetEnvironment, (name) => {
                        if (!name.startsWith("inputs/")) {
                            throw new Error("Asset resources must live under inputs/.");
                        }
                        const resource = modificationOwnedPath(root, name);
                        const bytes = fs.readFileSync(resource);
                        const hash = sourceExportSha256(bytes);
                        const prior = snapshots.get(resource);
                        if (prior && prior !== hash) {
                            throw new Error(`Shared asset resource changed: ${name}`);
                        }
                        snapshots.set(resource, hash);
                        const mediaType = ownedAssetMediaType(name);
                        return { bytes, mediaType };
                    }));
                }
                if (encoded.length > expected.length ||
                    (encoded.length !== expected.length && replacement.fill === undefined)) {
                    throw new Error(`Replacement ${replacement.id} encoded ${encoded.length} bytes for a ${expected.length}-byte allocation. Choose explicit fill or relocate it.`);
                }
                output.fill(replacement.fill ?? 0, replacement.offset, replacement.offset + expected.length);
                output.set(encoded, replacement.offset);
                // Encoded assets carry input provenance but no invented assembly breakpoint lines.
                maps.push({
                    ...baselineMap,
                    sources: [
                        {
                            id: 0,
                            path: input,
                            size: source.length,
                            crc32: CRC32.compute(source),
                            sha256: sourceExportSha256(source),
                            kind: "binary",
                        },
                    ],
                    ranges: [],
                    instructions: [],
                    assets: [],
                });
                continue;
            }
            const driver = path.join(root, `inputs/.driver-${replacement.id}.asm`);
            // Drivers are virtual and never overwrite an owned input. All emitted bytes must come from the owned include.
            const emit = replacement.kind === "binary" ? "incbin" : "incsrc";
            const text = `${project.baseline.mapper}\narch 65816\n.smart off\nincsrc "${path.join(root, "baseline-interface.asm")}"\n${placements}\norg Patch_${replacement.id}\n.a${replacement.accumulator ?? 8}\n.i${replacement.index ?? 8}\n${emit} "${modificationOwnedPath(root, replacement.input)}"\n`;
            const provider = new ModificationFiles(root, driver, text);
            const interfaceBytes = provider.readFile(path.join(root, "baseline-interface.asm"));
            if (sourceExportSha256(interfaceBytes) !== project.baseline.interfaceSha256) {
                throw new Error("Pinned baseline interface changed.");
            }
            const assembler = new Assembler({
                environment: await createSnesAssemblerEnvironment(),
                target: "snes.sfc",
                architecture: "snes.65816",
                baseImage: baseline,
                fileProvider: provider,
                collectSourceMetadata: true,
                targetOptions: { checksumEnabled: false, checksumMode: "asar" },
            });
            const written = new Uint8Array(expected.length);
            try {
                assembler.traceListener = (event) => {
                    if (event.type !== "write" || event.stage !== "emitProgram") {
                        return;
                    }
                    const index = event.outputOffset - replacement.offset;
                    // Check writes, not only differing bytes: even an identical out-of-range write violates ownership.
                    if (event.arch !== "snes.65816" ||
                        index < 0 ||
                        index >= written.length ||
                        written[index] ||
                        event.logicalAddress !==
                            snesRomAddressSpace.fromOutputOffset(event.outputOffset, context)) {
                        throw new Error(`Replacement ${replacement.id} writes outside its canonical range, changes architecture, or writes a byte twice.`);
                    }
                    written[index] = 1;
                    output[event.outputOffset] = event.value;
                };
                assembler.setCurrentFile(driver);
                assembler.assembleProgram(assembler.buildProgramModel(text, driver, 0));
                if (written.some((value) => value === 0)) {
                    throw new Error(`Replacement ${replacement.id} must emit exactly ${expected.length} bytes; gaps and implicit padding are not permitted.`);
                }
                // Finalization is outside write tracing. A directive that repairs checksums must not bypass range validation.
                for (let i = 0; i < expected.length; i++) {
                    if (assembler.outputBytes[replacement.offset + i] !== output[replacement.offset + i]) {
                        throw new Error(`Finalization changed replacement ${replacement.id} after encoding.`);
                    }
                }
                provider.assertUnchanged();
                for (const [input, bytes] of provider.snapshots) {
                    const hash = sourceExportSha256(bytes);
                    const previous = snapshots.get(input);
                    if (previous && previous !== hash) {
                        throw new Error(`Shared input changed between replacements: ${input}. Build again.`);
                    }
                    snapshots.set(input, hash);
                }
                // Binary inputs have provenance but no assembly source lines. Never expose a virtual driver line as a breakpoint.
                const mapping = assembler.addressToLineMapping;
                for (let index = 0; index < mapping.fileList.length; index++) {
                    if (mapping.fileList[index].name === driver) {
                        mapping.ranges = mapping.ranges.filter((range) => range.fileIdx !== index);
                        const input = modificationOwnedPath(root, replacement.input);
                        const bytes = provider.readFile(input);
                        mapping.fileList[index] = {
                            ...mapping.fileList[index],
                            name: input,
                            size: bytes.length,
                            crc: CRC32.compute(bytes),
                            sha256: sourceExportSha256(bytes),
                        };
                    }
                }
                maps.push(createDebugMap({
                    target: "snes.sfc",
                    output,
                    mapping,
                    sourceRoot: "/",
                    dependencyKinds: replacement.kind === "binary"
                        ? new Map([[modificationOwnedPath(root, replacement.input), "binary"]])
                        : undefined,
                }));
            }
            finally {
                assembler.dispose();
            }
        }
        const map = mergeModifiedMaps(baselineMap, maps, project, sourceDirectory, output);
        // createDebugMap("/") paths are relative to /; make those absolute before publishing to any workspace.
        const absoluteMapPayload = {
            ...map,
            sources: map.sources.map((entry) => ({ ...entry, path: path.resolve("/", entry.path) })),
        };
        const { fingerprint: _fingerprint, ...payload } = absoluteMapPayload;
        const finalMap = {
            ...payload,
            fingerprint: {
                algorithm: "sha256",
                value: sourceExportSha256(canonicalJson(payload)),
            },
        };
        const issues = validateDebugMap(finalMap, output);
        if (issues.length) {
            throw new Error(issues.join(" "));
        }
        assertSourceGeneration(sourceDirectory, generation);
        validateSourceExportFiles(sourceDirectory, exported);
        validateSourceExportInputs(sourceDirectory, exported);
        if (!fs.readFileSync(file).equals(manifestBytes)) {
            throw new Error("Modification manifest changed during build. Build again.");
        }
        // Hashes identify public project inputs, not authentication secrets.
        for (const [input, hash] of snapshots) {
            // oxlint-disable-next-line security/detect-possible-timing-attacks -- Public file integrity hashes are not credentials.
            if (sourceExportSha256(fs.readFileSync(input)) !== hash) {
                throw new Error(`Input changed during build: ${input}. Build again.`);
            }
        }
        if (sourceExportSha256(fs.readFileSync(romFile)) !== project.baseline.rom.sha256) {
            throw new Error("Baseline ROM changed during build.");
        }
        options.signal?.throwIfAborted();
        const build = path.join(root, "build", randomUUID());
        fs.mkdirSync(build, { recursive: true });
        const outputPath = path.join(build, "modified.sfc");
        const finalOutput = path.join(build, "modified-final.sfc");
        const debugMapPath = `${outputPath}.debug.json`;
        let prior = {};
        try {
            prior = JSON.parse(fs.readFileSync(path.join(root, "build/current.json"), "utf8"));
        }
        catch {
            /* No prior successful build. */
        }
        const result = {
            ok: true,
            outputPath,
            finalOutput,
            debugMapPath,
            outputSha256: finalMap.output.sha256,
            debugMapFingerprint: finalMap.fingerprint.value,
            outputSize: output.length,
            bytes: output.length,
            changedBytes: output.reduce((count, value, index) => count + Number(value !== baseline[index]), 0),
            outputChanged: prior.outputSha256 !== finalMap.output.sha256,
            debugMapChanged: prior.debugMapFingerprint !== finalMap.fingerprint.value,
            receiptFile: path.join(build, "verification.json"),
            target: "snes.sfc",
            architecture: "snes.65816",
        };
        durableReplace(outputPath, output);
        durableReplace(finalOutput, Buffer.concat([
            Buffer.from(rom.fileBytes()).subarray(0, project.baseline.rom.headerSize),
            output,
        ]));
        durableReplace(debugMapPath, canonicalJson(finalMap));
        durableReplace(result.receiptFile, JSON.stringify({
            ...result,
            baseline: project.baseline,
            manifestSha256: sourceExportSha256(manifestBytes),
            inputs: Object.fromEntries(snapshots),
            replacements: project.replacements,
            verifiedAt: new Date().toISOString(),
            runtimeEvidence: "Requires a project and captures matching the modified ROM hash.",
        }, null, 2) + "\n");
        // A crash before this last rename leaves only an unreferenced complete/partial generation.
        durableReplace(path.join(root, "build/current.json"), JSON.stringify(result, null, 2) + "\n");
        return result;
    }
    finally {
        releaseSource?.release();
        release.release();
    }
};
/**
 * Build, then analyze a new ROM-bound workspace. Baseline metadata/captures are deliberately not migrated.
 * @param {object} options Modification inputs and a missing or empty derived workspace.
 * @returns {Promise<object>} Derived workspace and immutable ROM identity.
 */
export const deriveModifiedRomProject = async (options) => {
    const build = await buildModifiedRom(options);
    const project = loadRomModificationProject(options.manifestFile);
    const result = await initializeSnesDisassemblyWorkspace({
        romFile: build.finalOutput,
        outputDirectory: options.outputDirectory,
        mapper: project.baseline.mapper,
        headerSize: project.baseline.rom.headerSize,
        signal: options.signal,
        onProgress: ({ message }) => options.onProgress?.(message),
    });
    return {
        outputDirectory: result.outputDirectory,
        romFile: build.finalOutput,
        rom: result.probe.rom,
    };
};
//# sourceMappingURL=modification-project.js.map
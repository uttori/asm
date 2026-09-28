import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { acquireFileLease, readSourcePublication, loadSourceExportManifest, validateSourceExportFiles, validateSourceExportInputs, durableReplace, RomImage, sourceExportSha256, } from "@uttori/asm-disassembler";
import { createSnesAssemblerEnvironment } from "../assembler.js";
import { snesRomAddressSpace } from "../target/address-space.js";
import { createSnesAddressContext } from "./address-identities.js";
import { encodeOwnedAsset, ownedAssetMediaType, extractOwnedAsset, } from "./modification-assets.js";
import { retainModificationBaseline } from "./modification-baseline.js";
import { loadRomModificationProject, modificationOwnedPath, } from "./modification-project.js";
import { verifySnesProjectRoundTrip } from "./project-initializer.js";
/** Validate a candidate through the same parser as Build, then publish one manifest pointer.
 * Retained prior manifests and inputs let interrupted or unwanted operations be recovered without data loss.
 * @param {string} file Current manifest, protected by the caller's modification lease.
 * @param {RomModificationProject} project Complete candidate contract; owned inputs must already exist.
 */
export function publishModificationManifest(file, project) {
    const root = path.dirname(file);
    const candidate = path.join(root, `.candidate-${randomUUID()}.json`);
    const bytes = JSON.stringify(project, null, 2) + "\n";
    durableReplace(candidate, bytes);
    try {
        loadRomModificationProject(candidate);
        const before = fs.readFileSync(file);
        const history = path.join(root, ".history", sourceExportSha256(before) + ".json");
        fs.mkdirSync(path.dirname(history), { recursive: true });
        if (!fs.existsSync(history)) {
            durableReplace(history, before);
        }
        durableReplace(file, bytes);
    }
    finally {
        fs.unlinkSync(candidate);
    }
}
/** Read the pinned ROM and explicit expansion fill as the expected bytes for new allocations.
 * @param {string} root Owning modification directory.
 * @param {RomModificationProject} project Pinned ROM and optional explicit expansion.
 * @returns {Buffer} Headerless baseline plus declared fill.
 */
function allocationBase(root, project) {
    const rom = RomImage.load(path.resolve(root, project.baseline.romFile), {
        headerSize: project.baseline.rom.headerSize,
    });
    if (rom.identity.sha256 !== project.baseline.rom.sha256) {
        throw new Error("Baseline ROM identity mismatch.");
    }
    const size = project.expansion?.size ?? rom.length;
    if (!Number.isSafeInteger(size) || size < rom.length || size > 0x1000000) {
        throw new Error("Invalid explicit ROM expansion size.");
    }
    const bytes = Buffer.alloc(size, project.expansion?.fill ?? 0);
    bytes.set(rom.read(0, rom.length));
    return bytes;
}
/** Relocate one owner and create its explicitly listed pointers in one manifest commit.
 * @param {object} options Manifest and exact reviewed plan. Stale plans, bank changes and overlaps fail without publishing.
 * @returns {string} Saved manifest path. Original inputs and old manifest remain available in history.
 */
export function applyRomPlacement(options) {
    const file = path.resolve(options.manifestFile);
    const root = path.dirname(file);
    const lease = acquireFileLease(path.join(root, ".build.lock"));
    try {
        const { plan } = options;
        if (sourceExportSha256(fs.readFileSync(file)) !== plan.manifestSha256) {
            throw new Error("Placement review is stale. Prepare it again.");
        }
        const current = loadRomModificationProject(file);
        const previous = current.replacements.find((entry) => entry.id === plan.replacement);
        if (!previous) {
            throw new Error("Select an existing replacement to allocate or relocate.");
        }
        const project = { ...current, expansion: plan.expansion ?? current.expansion };
        const base = allocationBase(root, project);
        const expected = (offset, size) => {
            if (!Number.isSafeInteger(offset) ||
                offset < 0 ||
                !Number.isSafeInteger(size) ||
                size < 1 ||
                size > 65536 ||
                offset + size > base.length) {
                throw new Error("Allocation must be within the declared output and at most one bank.");
            }
            return base.subarray(offset, offset + size).toString("hex");
        };
        const replacement = {
            ...previous,
            offset: plan.offset,
            expected: expected(plan.offset, plan.size),
            fill: plan.fill,
        };
        const context = createSnesAddressContext(project.baseline.mapper);
        const target = snesRomAddressSpace.fromOutputOffset(plan.offset, context);
        const pointers = [];
        for (const pointer of plan.pointers) {
            const addend = pointer.addend ?? 0;
            const address = target + addend;
            if (!Number.isSafeInteger(addend) ||
                addend < 0 ||
                addend >= plan.size ||
                target < 0 ||
                snesRomAddressSpace.toOutputOffset(address, context) !== plan.offset + addend ||
                ![2, 3].includes(pointer.width)) {
                throw new Error("Pointer width, target or addend is invalid.");
            }
            if (pointer.width === 2 && pointer.bank !== address >>> 16) {
                throw new Error(`Pointer ${pointer.id} needs the explicit matching CPU bank 0x${(address >>> 16).toString(16)}.`);
            }
            if (!/^[A-Z_a-z]\w*$/.test(pointer.id)) {
                throw new Error("Pointer IDs must be assembly identifiers.");
            }
            const input = `inputs/${pointer.id}-${randomUUID()}.asm`;
            const value = pointer.width === 2
                ? `(Patch_${previous.id} + ${addend}) & $ffff`
                : `Patch_${previous.id} + ${addend}`;
            durableReplace(modificationOwnedPath(root, input), `; Explicit ${pointer.width * 8}-bit pointer to owned allocation ${previous.id}.\n${pointer.width === 2 ? "dw" : "dl"} ${value}\n`);
            pointers.push({
                id: pointer.id,
                offset: pointer.offset,
                expected: expected(pointer.offset, pointer.width),
                input,
                kind: "assembly",
                accumulator: 16,
                index: 16,
            });
        }
        publishModificationManifest(file, {
            ...project,
            replacements: [
                ...project.replacements.map((entry) => (entry.id === previous.id ? replacement : entry)),
                ...pointers,
            ],
        });
        return file;
    }
    finally {
        lease.release();
    }
}
/** Extract a binary replacement into an editable native model or palette-preserving indexed PNG.
 * @param {object} options Existing binary owner and explicit native format/palette ROM offset.
 * @returns {Promise<string>} Newly owned input path. Existing input is retained, and encoding must reproduce it exactly before publication.
 */
export async function extractRomAsset(options) {
    const file = path.resolve(options.manifestFile);
    const root = path.dirname(file);
    const lease = acquireFileLease(path.join(root, ".build.lock"));
    try {
        const project = loadRomModificationProject(file);
        const entry = project.replacements.find((item) => item.id === options.id);
        if (!entry || entry.kind !== "binary") {
            throw new Error("Extract an existing binary replacement; its original range stays owned.");
        }
        const bytes = fs.readFileSync(modificationOwnedPath(root, entry.input));
        let palette;
        if (options.paletteOffset !== undefined) {
            const base = allocationBase(root, project);
            const size = options.paletteSize ?? 0;
            if (!Number.isSafeInteger(options.paletteOffset) ||
                options.paletteOffset < 0 ||
                !Number.isInteger(size) ||
                size < 1 ||
                options.paletteOffset + size > project.baseline.rom.contentSize) {
                throw new Error("Palette range must fit the original ROM.");
            }
            palette = base.subarray(options.paletteOffset, options.paletteOffset + size);
        }
        const sourceDirectory = path.resolve(root, project.baseline.sourceDirectory);
        const config = loadSourceExportManifest(sourceDirectory).buildConfiguration;
        const environment = (await options.loadEnvironment?.(path.join(sourceDirectory, config)))?.environment ??
            (await createSnesAssemblerEnvironment());
        const resource = (name) => {
            if (!name.startsWith("inputs/")) {
                throw new Error("Asset resources must live under inputs/.");
            }
            return {
                bytes: fs.readFileSync(modificationOwnedPath(root, name)),
                mediaType: ownedAssetMediaType(name),
            };
        };
        let decoded = bytes;
        // Extraction reverses only explicitly selected, version-pinned codecs; never guess a game's compression.
        for (const step of [...(options.transforms ?? [])].reverse()) {
            const transform = environment.getAssetTransform(step.id, "snes.sfc");
            if (!transform || transform.version !== step.version) {
                throw new Error(`Transform ${step.id}@${step.version} is unavailable or changed.`);
            }
            const opts = step.options ?? {};
            transform.validateOptions?.(opts);
            const resources = Object.fromEntries((transform.resourcePaths?.(opts) ?? []).map((name) => [name, resource(name)]));
            decoded = transform.decode(decoded.slice(), opts, 0x1000000, resources);
            if (!(decoded instanceof Uint8Array) || decoded.length > 0x1000000) {
                throw new Error("Decoded asset exceeds 16 MiB.");
            }
        }
        const extracted = extractOwnedAsset(decoded, options.format, palette);
        const recipe = {
            ...extracted.recipe,
            ...(options.transforms ? { transforms: options.transforms } : {}),
        };
        const encoded = encodeOwnedAsset(extracted.bytes, recipe, environment, resource);
        if (!bytes.equals(encoded)) {
            throw new Error("Extraction did not reencode to the exact original asset bytes.");
        }
        const input = `inputs/${entry.id}-${randomUUID()}.${extracted.extension}`;
        options.signal?.throwIfAborted();
        durableReplace(modificationOwnedPath(root, input), extracted.bytes);
        publishModificationManifest(file, {
            ...project,
            replacements: project.replacements.map((item) => item.id === entry.id ? { ...entry, kind: "asset", input, asset: recipe } : item),
        });
        return path.join(root, input);
    }
    finally {
        lease.release();
    }
}
/** Copy an externally edited asset into ownership after validating its recipe and allocation.
 * @param {object} options Selected owner, edited file and optional explicit plugin recipe; no codec is guessed.
 * @returns {Promise<string>} New owned input path. Failure leaves the prior manifest and input untouched.
 */
export async function importRomAsset(options) {
    const file = path.resolve(options.manifestFile);
    const root = path.dirname(file);
    const lease = acquireFileLease(path.join(root, ".build.lock"));
    try {
        const project = loadRomModificationProject(file);
        const entry = project.replacements.find((item) => item.id === options.id);
        const recipe = options.recipe ?? entry?.asset;
        if (!entry || !recipe) {
            throw new Error("Select an extracted asset or supply an explicit codec recipe.");
        }
        const source = fs.readFileSync(options.sourceFile);
        const sourceDirectory = path.resolve(root, project.baseline.sourceDirectory);
        const config = JSON.parse(fs.readFileSync(path.join(sourceDirectory, "generated-files.json"), "utf8"));
        const environment = (await options.loadEnvironment?.(path.join(sourceDirectory, config.buildConfiguration)))
            ?.environment ?? (await createSnesAssemblerEnvironment());
        const encoded = encodeOwnedAsset(source, recipe, environment, (name) => {
            if (!name.startsWith("inputs/")) {
                throw new Error("Asset resources must live under inputs/.");
            }
            return {
                bytes: fs.readFileSync(modificationOwnedPath(root, name)),
                mediaType: ownedAssetMediaType(name),
            };
        });
        const fill = options.fill ?? entry.fill;
        const budget = entry.expected.length / 2;
        if (encoded.length > budget || (encoded.length !== budget && fill === undefined)) {
            throw new Error(`Encoded asset uses ${encoded.length} of ${budget} allocated bytes. Declare fill or relocate before import.`);
        }
        const extension = path.extname(options.sourceFile).replace(/[^\w.]/g, "") || ".bin";
        const input = `inputs/${entry.id}-${randomUUID()}${extension}`;
        options.signal?.throwIfAborted();
        durableReplace(modificationOwnedPath(root, input), source);
        publishModificationManifest(file, {
            ...project,
            replacements: project.replacements.map((item) => item.id === entry.id ? { ...entry, input, kind: "asset", asset: recipe, fill } : item),
        });
        return path.join(root, input);
    }
    finally {
        lease.release();
    }
}
/** Remove ownership while retaining input bytes and a prior manifest for recovery.
 * @param {object} options Owning manifest and stable replacement ID.
 */
export function removeRomReplacement(options) {
    const file = path.resolve(options.manifestFile);
    const lease = acquireFileLease(path.join(path.dirname(file), ".build.lock"));
    try {
        const project = loadRomModificationProject(file);
        if (!project.replacements.some((entry) => entry.id === options.id)) {
            throw new Error("Replacement no longer exists.");
        }
        publishModificationManifest(file, {
            ...project,
            replacements: project.replacements.filter((entry) => entry.id !== options.id),
        });
    }
    finally {
        lease.release();
    }
}
/** Upgrade a phase-4 project without changing its baseline pin or any owned input.
 * @param {ModificationOperationOptions} options Existing project and trusted verification services.
 * @returns {Promise<string>} Retained snapshot path; external edits are never used as baseline bytes.
 */
export async function retainRomModificationBaseline(options) {
    const file = path.resolve(options.manifestFile);
    const root = path.dirname(file);
    const lease = acquireFileLease(path.join(root, ".build.lock"));
    let sourceLease;
    try {
        const project = loadRomModificationProject(file);
        if (project.baseline.snapshotDirectory) {
            return path.join(root, project.baseline.snapshotDirectory);
        }
        const sourceDirectory = path.resolve(root, project.baseline.sourceDirectory);
        sourceLease = acquireFileLease(path.join(sourceDirectory, ".uttori-publication.lock"));
        const journal = readSourcePublication(sourceDirectory);
        const choices = [sourceDirectory, journal?.candidate, journal?.previous].filter((value) => Boolean(value));
        let selected;
        for (const candidate of choices) {
            try {
                if (sourceExportSha256(fs.readFileSync(path.join(candidate, "generated-files.json"))) !==
                    project.baseline.manifestSha256) {
                    continue;
                }
                validateSourceExportFiles(candidate);
                validateSourceExportInputs(candidate);
                selected = candidate;
                break;
            }
            catch {
                /* A newer or edited generation is not a valid historical baseline. */
            }
        }
        if (!selected) {
            throw new Error("No intact retained generation matches this project's pin. Preserve external edits and recover its verified publication before upgrading; no hashes were changed.");
        }
        const interfaceBytes = fs.readFileSync(path.join(root, "baseline-interface.asm"));
        if (sourceExportSha256(interfaceBytes) !== project.baseline.interfaceSha256) {
            throw new Error("Pinned baseline interface changed.");
        }
        const romFile = path.resolve(root, project.baseline.romFile);
        const config = loadSourceExportManifest(selected).buildConfiguration;
        const load = options.loadEnvironment;
        await verifySnesProjectRoundTrip({
            sourceDirectory: selected,
            romFile,
            signal: options.signal,
            loadEnvironment: load ? () => load(path.join(sourceDirectory, config)) : undefined,
        });
        const snapshotDirectory = retainModificationBaseline(root, selected, romFile, interfaceBytes);
        publishModificationManifest(file, {
            ...project,
            baseline: { ...project.baseline, snapshotDirectory },
        });
        return path.join(root, snapshotDirectory);
    }
    finally {
        sourceLease?.release();
        lease.release();
    }
}
//# sourceMappingURL=modification-operations.js.map
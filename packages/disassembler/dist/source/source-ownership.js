/** Ownership of generated source is recorded at export time, independently of build/debug maps. */
import fs from "node:fs";
import path from "node:path";
import { loadSourceExportManifest, sourceExportSha256, } from "./source-export.js";
import { sourceGenerationIdentity, assertSourceGeneration } from "./source-generation.js";
/** Generated sidecar, included in the export's file-integrity manifest. */
export const SOURCE_OWNERSHIP_FILE = "source-ownership.json";
/** A single rename can touch many banks from one large manifest. Cache only unchanged publications. */
const manifestCache = new Map();
/**
 * Filesystem identity catches replacement as well as ordinary edits, including preserved mtimes.
 * @param {string} file Existing file whose publication is being inspected.
 * @returns {string} Identity and high-resolution modification timestamps.
 */
const signature = (file) => {
    const stat = fs.statSync(file, { bigint: true });
    return `${stat.dev}:${stat.ino}:${stat.size}:${stat.mtimeNs}:${stat.ctimeNs}`;
};
/**
 * Find the nearest owning manifest. An unlisted file inside an export remains user-owned.
 * @param {string} file Absolute or working-directory-relative source path.
 * @returns {ManagedSourceFile | undefined} Managed membership, or undefined for user-owned source. Invalid manifests throw.
 */
export const findManagedSourceFile = (file) => {
    const absolute = path.resolve(file);
    for (let directory = path.dirname(absolute);; directory = path.dirname(directory)) {
        if (fs.existsSync(path.join(directory, "generated-files.json"))) {
            const generation = sourceGenerationIdentity(directory);
            // Invalid manifests must be reported, not interpreted as permission to rewrite generated files.
            const identity = signature(path.join(directory, "generated-files.json"));
            let cached = manifestCache.get(directory);
            if (!cached || cached.signature !== identity) {
                const manifest = loadSourceExportManifest(directory);
                if (identity !== signature(path.join(directory, "generated-files.json"))) {
                    throw new Error("Source generation changed during ownership lookup. Retry inspection.");
                }
                cached = { signature: identity, manifest };
                if (manifestCache.size >= 16) {
                    manifestCache.clear();
                }
                manifestCache.set(directory, cached);
            }
            const { manifest } = cached;
            const relative = path.relative(directory, absolute).split(path.sep).join("/");
            if (manifest.files.some((entry) => entry.path === relative)) {
                assertSourceGeneration(directory, generation);
                return { directory, relative, manifest };
            }
        }
        if (directory === path.dirname(directory)) {
            return undefined;
        }
    }
};
/** Share large parsed maps between banks while retaining only two recent exports. */
const ownershipCache = new Map();
/**
 * Load only a manifest-owned, hash-verified sidecar. Older exports legitimately have no map.
 * @param {ManagedSourceFile} managed Membership and generation identity from the current manifest.
 * @returns {SourceOwnershipMap | undefined} Verified map, or undefined for older exports; malformed or changed data throws.
 */
export const loadSourceOwnership = (managed) => {
    const generation = sourceGenerationIdentity(managed.directory);
    const name = managed.manifest.ownershipFile;
    if (!name) {
        return undefined;
    }
    const recorded = managed.manifest.files.find((entry) => entry.path === name);
    const file = path.join(managed.directory, name);
    const identity = signature(file);
    const cached = ownershipCache.get(file);
    if (cached?.signature === identity &&
        cached.sha256 === recorded?.sha256 &&
        cached.map.sourceProjectSha256 === managed.manifest.sourceProjectSha256 &&
        cached.map.romSha256 === managed.manifest.rom.contentSha256) {
        assertSourceGeneration(managed.directory, generation);
        return cached.map;
    }
    const bytes = fs.readFileSync(file);
    if (!recorded || sourceExportSha256(bytes) !== recorded.sha256) {
        throw new Error("Source ownership metadata changed. Review generated-file integrity before editing.");
    }
    const value = JSON.parse(bytes.toString("utf8"));
    if (!value || typeof value !== "object") {
        throw new Error("Invalid source ownership metadata.");
    }
    const map = value;
    if (map.format !== "uttori-asm-source-ownership" ||
        map.sourceProjectSha256 !== managed.manifest.sourceProjectSha256 ||
        map.romSha256 !== managed.manifest.rom.contentSha256 ||
        !Array.isArray(map.entries)) {
        throw new Error("Source ownership metadata belongs to a different generation.");
    }
    const files = new Set(managed.manifest.files.map((entry) => entry.path));
    for (const raw of map.entries) {
        if (!raw || typeof raw !== "object") {
            throw new Error("Invalid source ownership entry.");
        }
        const entry = raw;
        if (!files.has(entry.file) ||
            typeof entry.id !== "string" ||
            !entry.id ||
            ![
                "label",
                "comment",
                "function",
                "region",
                "instruction",
                "data",
                "asset",
                "ram",
                "structure",
                "binding",
                "field",
                "constant",
                "hardware",
            ].includes(entry.kind) ||
            !Number.isSafeInteger(entry.startLine) ||
            entry.startLine < 1 ||
            !Number.isSafeInteger(entry.endLine) ||
            entry.endLine < entry.startLine ||
            [entry.name, entry.symbol, entry.addressSpace].some((text) => text !== undefined && typeof text !== "string") ||
            [entry.address, entry.emittedAddress, entry.outputStart, entry.outputEnd].some((address) => address !== undefined && (!Number.isSafeInteger(address) || address < 0)) ||
            (entry.outputStart === undefined) !== (entry.outputEnd === undefined) ||
            (entry.outputStart !== undefined && entry.outputEnd < entry.outputStart) ||
            (entry.evidence !== undefined &&
                (!Array.isArray(entry.evidence) ||
                    entry.evidence.some((id) => typeof id !== "string"))) ||
            (entry.inputPath !== undefined &&
                (typeof entry.inputPath !== "string" ||
                    !entry.inputPath ||
                    path.isAbsolute(entry.inputPath) ||
                    /^[A-Za-z]:/.test(entry.inputPath) ||
                    entry.inputPath.split(/[/\\]/).includes("..")))) {
            throw new Error("Invalid source ownership entry.");
        }
    }
    if (identity !== signature(file)) {
        throw new Error("Source ownership changed during lookup. Retry inspection.");
    }
    if (ownershipCache.size >= 2) {
        ownershipCache.clear();
    }
    ownershipCache.set(file, { signature: identity, sha256: recorded.sha256, map });
    assertSourceGeneration(managed.directory, generation);
    return map;
};
/** Indices are reclaimed with the owning map and avoid scanning every bank on each cursor move. */
const indices = new WeakMap();
/**
 * Resolve a token or line against a verified generation; retain ambiguity instead of guessing.
 * @param {SourceOwnershipMap} map Hash-verified export-time ownership metadata.
 * @param {string} file Export-relative source path using forward slashes.
 * @param {string} text Exact unchanged source text associated with this generation.
 * @param {number} line One-based source line.
 * @param {number} column Zero-based character offset on the line.
 * @returns {readonly SourceOwnershipEntry[]} Most specific owners, including all ambiguous matches.
 */
export const sourceOwnersAt = (map, file, text, line, column) => {
    let index = indices.get(map);
    if (!index) {
        index = { files: new Map(), symbols: new Map() };
        for (const entry of map.entries) {
            const entries = index.files.get(entry.file) ?? [];
            entries.push(entry);
            index.files.set(entry.file, entries);
            if (entry.symbol) {
                const symbols = index.symbols.get(entry.symbol) ?? [];
                symbols.push(entry);
                index.symbols.set(entry.symbol, symbols);
            }
        }
        indices.set(map, index);
    }
    const body = text.split(/\r?\n/)[line - 1] ?? "";
    const local = (index.files.get(file) ?? []).filter((entry) => entry.startLine <= line && line <= entry.endLine);
    // Preserve columns while masking quoted strings and comments, including semicolons in paths.
    let quote = "";
    let code = "";
    for (let index = 0; index < body.length; index++) {
        const character = body[index];
        if (quote) {
            code += " ";
            if (character === "\\" && index + 1 < body.length) {
                code += " ";
                index++;
            }
            else if (character === quote) {
                quote = "";
            }
        }
        else if (character === '"' || character === "'") {
            quote = character;
            code += " ";
        }
        else if (character === ";") {
            break;
        }
        else {
            code += character;
        }
    }
    // oxlint-disable-next-line security/detect-unsafe-regex -- Brackets and dots bound optional groups; there is no nested repetition.
    const token = [...code.matchAll(/[A-Z_a-z]\w*(?:\[[^\]]+])?(?:\.[A-Z_a-z]\w*)?/g)].find((match) => match.index <= column && column < match.index + match[0].length);
    if (token && !/[\d$]/.test(code[token.index - 1] ?? "")) {
        const name = token[0];
        const field = local.filter((entry) => entry.kind === "field" && entry.name === name && /^\s*\w+\s*=/.test(code));
        if (field.length) {
            return uniqueOwners(field);
        }
        const normalized = name.replace(/\[[^\]]+]/g, "");
        const exact = index.symbols.get(name) ?? [];
        const symbols = exact.length ? exact : (index.symbols.get(normalized) ?? []);
        if (symbols.length) {
            return uniqueOwners(symbols);
        }
    }
    if (!local.length) {
        return [];
    }
    // Nested fields and label comments are more precise than the enclosing data/instruction span.
    const smallest = local.reduce((minimum, entry) => Math.min(minimum, entry.endLine - entry.startLine), Infinity);
    return uniqueOwners(local.filter((entry) => entry.endLine - entry.startLine === smallest));
};
/**
 * Multiple presentations of a field or symbol refer to one owner, not multiple editable records.
 * @param {readonly SourceOwnershipEntry[]} entries Matching declarations and source uses.
 * @returns {SourceOwnershipEntry[]} One presentation per persistent owner and native address.
 */
const uniqueOwners = (entries) => [
    ...new Map(entries.map((entry) => [
        `${entry.kind}:${entry.id}:${entry.addressSpace ?? ""}:${entry.address ?? ""}`,
        entry,
    ])).values(),
];
//# sourceMappingURL=source-ownership.js.map
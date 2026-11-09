import fs from "node:fs";
import path from "node:path";
import { preprocessBlockCommands } from "@uttori/asm-core/frontend";
import { sourceContentHash, sourceRepository, readSourceFileTransaction, } from "@uttori/asm-disassembler/source-project";
import { recoverAssetInterchange } from "../asset-interchange/maintenance.js";
import { savedAssetSourceHost } from "../asset-interchange/service.js";
import { AssetSourceConversionService, } from "../asset-source-conversion.js";
import { locateAssetCall } from "../asset-source-edits.js";
import { rasterSourceConversionAdapter } from "./raster-adapter.js";
export { assetSourceAssemblyInventory, AssetSourceConversionService, } from "../asset-source-conversion.js";
export { rasterSourceConversionAdapter };
/** Installed defaults are ordinary adapters; embedders can inject additional codecs/adapters into the exported service. */
export function createAssetSourceConversionService(host = savedAssetSourceHost, adapters = []) {
    return new AssetSourceConversionService([...adapters, rasterSourceConversionAdapter], host);
}
/**
 * Narrow untrusted IPC JSON to a plain object.
 * @param value Decoded request fragment.
 * @returns Whether keyed fields can be read.
 */
function isRecord(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
}
/**
 * Accept only JSON arrays at the IPC boundary.
 * @param value Decoded request fragment.
 * @returns Whether the value is an array.
 */
function isUnknownArray(value) {
    return Array.isArray(value);
}
/**
 * Validate one asset draft descriptor from an IPC payload.
 * @param value Draft candidate from the request.
 * @returns Whether the draft satisfies the interchange contract.
 */
function isDraft(value) {
    return (isRecord(value) &&
        typeof value.path === "string" &&
        typeof value.version === "number" &&
        Number.isSafeInteger(value.version) &&
        typeof value.opaque === "boolean");
}
/** Reject malformed IPC or command requests before they can stage source files. */
function readOperation(value) {
    if (!isRecord(value)) {
        throw new Error("Invalid source conversion request.");
    }
    const input = value;
    if (typeof input.directory !== "string" || !input.directory || input.directory.includes("\0")) {
        throw new Error("Conversion needs a source project directory.");
    }
    let drafts;
    if (input.drafts !== undefined) {
        if (!isUnknownArray(input.drafts) ||
            input.drafts.length > 65536 ||
            !input.drafts.every(isDraft)) {
            throw new Error("Invalid source conversion drafts.");
        }
        drafts = input.drafts;
    }
    if (input.action === "asset-convert" || input.action === "asset-source-target") {
        if (typeof input.file !== "string" ||
            !input.file ||
            typeof input.line !== "number" ||
            !Number.isSafeInteger(input.line) ||
            input.line < 1) {
            throw new Error("Conversion needs an assembly file and one-based cursor line.");
        }
        const common = { directory: input.directory, file: input.file, line: input.line };
        if (input.action === "asset-source-target") {
            return { ...common, action: input.action };
        }
        if (typeof input.representation !== "string" ||
            !input.representation ||
            (input.destination !== undefined && typeof input.destination !== "string") ||
            (input.stageOnly !== undefined && typeof input.stageOnly !== "boolean")) {
            throw new Error("Invalid conversion representation or destination.");
        }
        return {
            ...common,
            action: input.action,
            representation: input.representation,
            destination: input.destination,
            stageOnly: input.stageOnly,
            drafts,
        };
    }
    if (input.action !== "asset-conversion-finish" ||
        typeof input.transaction !== "string" ||
        !/^[\da-f-]{36}$/i.test(input.transaction) ||
        typeof input.outputSha256 !== "string" ||
        !/^[\da-f]{64}$/.test(input.outputSha256)) {
        throw new Error("Invalid staged conversion identity.");
    }
    return {
        action: input.action,
        directory: input.directory,
        transaction: input.transaction,
        outputSha256: input.outputSha256,
        drafts,
    };
}
/** Both hosts use the same current-ROM oracle, relevant-draft safeguards and recoverable file journal. */
export async function executeAssetSourceOperation(value, options = {}) {
    const operation = readOperation(value);
    const host = {
        ...(options.host ?? savedAssetSourceHost),
        beforePublish: options.beforePublish,
        drafts: () => ("drafts" in operation ? (operation.drafts ?? []) : []),
    };
    if (operation.action === "asset-source-target") {
        // Literal source coordinates are a necessary condition for conversion. Reject
        // unrelated cursor lines before paying for an entire ROM inspection.
        const text = fs.readFileSync(path.resolve(operation.directory, operation.file), "utf8");
        const commands = preprocessBlockCommands(text).sourcedCommands;
        const lineCount = text.split("\n").length;
        const candidate = commands.some((command, index) => {
            let start = command.text.trimStart();
            const label = /^[\w$.?]+:/.exec(start);
            if (label) {
                start = start.slice(label[0].length).trimStart();
            }
            return (/^includeasset\s*\(/i.test(start) &&
                command.line <= operation.line - 1 &&
                (commands[index + 1]?.line ?? lineCount) > operation.line - 1);
        });
        if (!candidate) {
            return undefined;
        }
        const service = createAssetSourceConversionService(host, options.adapters);
        const resolved = await service.resolve(operation, options.signal);
        if (!service.adapters.some((adapter) => adapter.supports(resolved.selected))) {
            return undefined;
        }
        const inputs = [...resolved.build.snapshots].map(([file, bytes]) => ({
            path: path.relative(resolved.build.root, file).split(path.sep).join("/"),
            sha256: sourceContentHash(bytes),
        }));
        // External includes remain valid conversion inputs, but cannot be revalidated
        // through the editor's repository-relative cache transport.
        const cacheable = resolved.build.bundledToolchain === true &&
            inputs.length <= 65536 &&
            resolved.build.mapping.assets.length <= 65536 &&
            inputs.every((input) => !path.isAbsolute(input.path) && input.path !== ".." && !input.path.startsWith("../"));
        const menus = [];
        if (cacheable) {
            const texts = new Map();
            const representations = new Map();
            const invalid = new Set();
            for (const emission of resolved.build.mapping.assets) {
                if (!emission.conversion) {
                    continue;
                }
                const file = resolved.build.mapping.fileList[emission.fileIdx].name;
                const relative = path.relative(resolved.build.root, file).split(path.sep).join("/");
                try {
                    let source = texts.get(emission.fileIdx);
                    if (!source) {
                        const bytes = resolved.build.snapshots.get(file);
                        if (!bytes) {
                            throw new Error("Missing asset call source snapshot.");
                        }
                        const sourceText = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
                        const starts = [0];
                        for (let at = 0; at < sourceText.length; at++) {
                            if (sourceText[at] === "\n") {
                                starts.push(at + 1);
                            }
                        }
                        source = { text: sourceText, starts };
                        texts.set(emission.fileIdx, source);
                    }
                    const tail = source.text.slice(source.starts[emission.line - 1]);
                    const call = locateAssetCall(tail, 1);
                    let representation = "";
                    if (service.adapters.some((adapter) => adapter.supports(emission))) {
                        if (!representations.has(emission.assetFileIdx)) {
                            const asset = resolved.build.mapping.fileList[emission.assetFileIdx].name;
                            const bytes = resolved.build.snapshots.get(asset);
                            if (bytes) {
                                try {
                                    representations.set(emission.assetFileIdx, service.codecs.identify(bytes, { path: asset }).id);
                                }
                                catch {
                                    representations.set(emission.assetFileIdx, "");
                                }
                            }
                        }
                        representation = representations.get(emission.assetFileIdx) ?? "";
                    }
                    // Keep duplicate and unsupported emissions in the index: their overlapping
                    // intervals must suppress an otherwise ambiguous conversion menu.
                    menus.push({
                        file: relative,
                        line: emission.line,
                        endLine: emission.line + tail.slice(0, call.end).split("\n").length - 1,
                        representation,
                    });
                }
                catch {
                    // Resolution scans every convertible emission in the invocation file.
                    // An unattributable macro in that file cannot supply a safe menu index.
                    invalid.add(relative);
                }
            }
            for (let index = menus.length - 1; index >= 0; index--) {
                if (invalid.has(menus[index].file)) {
                    menus.splice(index, 1);
                }
            }
        }
        return {
            source: resolved.source,
            representation: resolved.current.id,
            representations: service.codecs.representations(),
            file: resolved.build.mapping.fileList[resolved.selected.fileIdx].name,
            line: resolved.selected.line,
            ...(cacheable ? { inputs, menus } : {}),
        };
    }
    if (operation.action === "asset-convert") {
        return createAssetSourceConversionService(host, options.adapters).convert(operation, {
            signal: options.signal,
            stageOnly: operation.stageOnly,
        });
    }
    const repository = await sourceRepository(operation.directory);
    const journal = readSourceFileTransaction(repository);
    if (!journal || journal.id !== operation.transaction || journal.state === "completed") {
        throw new Error("Staged conversion journal changed; use explicit source recovery.");
    }
    await recoverAssetInterchange(operation.directory, "after", {
        beforePublish: async (paths) => {
            const dirty = operation.drafts?.filter((draft) => paths.includes(path.resolve(repository.root, draft.path))) ?? [];
            if (dirty.length) {
                throw new Error("Save relevant conversion documents before completing publication.");
            }
            await options.beforePublish?.(paths);
        },
    }, options.signal);
    const build = await host.inspect(operation.directory, undefined, options.signal);
    if (build.diagnostics.length || sourceContentHash(build.output) !== operation.outputSha256) {
        throw new Error("Published conversion does not match the validated ROM; source files remain available for inspection.");
    }
    return {
        transaction: journal.id,
        outputSha256: operation.outputSha256,
        state: "completed",
    };
}
//# sourceMappingURL=operations.js.map
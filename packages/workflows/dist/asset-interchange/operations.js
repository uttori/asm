import path from "node:path";
import { ASSET_LIMITS } from "@uttori/asm-assets/limits";
import { cleanupAssetInterchange, recoverAssetInterchange } from "./maintenance.js";
import { asepriteRasterCodec, indexedPngStructureCodec } from "./raster-codecs.js";
import { assetPath, readAssetFile } from "./record-store.js";
import { AssetInterchangeService, asepriteStructureCodec, readAssetExportManifest, savedAssetSourceHost, } from "./service.js";
import { readAssetOperation } from "./operation-records.js";
/** Close over the typed adapter; callers only see the service's validated unknown-input boundary. */
export function registerAssetAdapter(adapter) {
    return {
        id: adapter.id,
        create: (directory, codec, host) => new AssetInterchangeService(directory, adapter, codec, host),
    };
}
/** Command and worker entry point shares file lifecycle and explicit maintenance semantics. */
export async function executeAssetOperation(value, options = {}) {
    const operation = readAssetOperation(value);
    options.signal?.throwIfAborted();
    if (operation.action === "asset-cleanup") {
        return cleanupAssetInterchange(operation.directory, readJson(operation.policy), operation.review);
    }
    if (operation.action === "asset-recover") {
        return recoverAssetInterchange(operation.directory, operation.direction, {
            beforePublish: async (paths) => {
                const relevant = new Set(paths.map(assetPath));
                const dirty = operation.drafts?.filter((draft) => relevant.has(assetPath(path.resolve(operation.directory, draft.path)))) ?? [];
                if (dirty.length) {
                    throw new Error(`Save relevant recovery drafts first: ${dirty.map((draft) => draft.path).join(", ")}. Drafts are preserved.`);
                }
                await options.beforePublish?.(paths);
            },
        }, options.signal);
    }
    return executeAssetFileOperation(operation, options);
}
/** Bounded JSON files provide selection/locators only; the service's trusted project baseline supplies authority. */
function readJson(file) {
    return JSON.parse(new TextDecoder().decode(readAssetFile(path.resolve(file), ASSET_LIMITS.metadataBytes)));
}
/** Dispatch installed adapters explicitly. New games can inject their own adapter into the same service. */
export async function executeAssetFileOperation(operation, options = {}) {
    options.signal?.throwIfAborted();
    const manifest = operation.action === "asset-export"
        ? undefined
        : readAssetExportManifest(readJson(operation.manifest)), adapterId = operation.action === "asset-export" ? operation.adapter : manifest.adapter.id;
    const host = {
        ...(options.host ?? savedAssetSourceHost),
        drafts: () => operation.drafts ?? [],
        beforePublish: options.beforePublish,
    };
    let codec = asepriteStructureCodec;
    if (operation.action === "asset-export") {
        if (operation.presentation === "raster") {
            codec = asepriteRasterCodec;
        }
        else if (operation.presentation === "indexed-png") {
            codec = indexedPngStructureCodec;
        }
    }
    else if (manifest.codec.id === asepriteRasterCodec.id) {
        codec = asepriteRasterCodec;
    }
    else if (manifest.codec.id === indexedPngStructureCodec.id) {
        codec = indexedPngStructureCodec;
    }
    const registrations = options.adapters ?? [];
    if (new Set(registrations.map((adapter) => adapter.id)).size !== registrations.length) {
        throw new Error("Duplicate installed asset adapter ID.");
    }
    const adapter = registrations.find((registered) => registered.id === adapterId);
    if (!adapter) {
        throw new Error(`Unsupported installed asset adapter ${adapterId}.`);
    }
    const service = adapter.create(operation.directory, codec, host);
    if (operation.action === "asset-export") {
        return service.export(readJson(operation.selection), { document: path.resolve(operation.document), manifest: path.resolve(operation.manifest) }, options.signal);
    }
    if (operation.action === "asset-review") {
        return service.review(manifest, path.resolve(operation.document), options.signal);
    }
    return service.apply(manifest, path.resolve(operation.document), operation.review, options.signal);
}
//# sourceMappingURL=operations.js.map
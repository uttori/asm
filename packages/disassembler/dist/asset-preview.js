import { createHash } from "node:crypto";
import { decodePlannedAsset, } from "./asset-codec.js";
const isAsciiAlphaNumeric = (character) => {
    const code = character.charCodeAt(0);
    return ((code >= 0x30 && code <= 0x39) ||
        (code >= 0x41 && code <= 0x5a) ||
        (code >= 0x61 && code <= 0x7a));
};
const isStableId = (id) => {
    if (id.length === 0 || !isAsciiAlphaNumeric(id[0]) || !isAsciiAlphaNumeric(id.at(-1))) {
        return false;
    }
    for (let index = 0; index < id.length; index++) {
        const character = id[index];
        if (!isAsciiAlphaNumeric(character) && !"._:/-".includes(character))
            return false;
    }
    return true;
};
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const sameBytes = (left, right) => left.length === right.length && left.every((value, index) => value === right[index]);
const normalizeFiles = (files, rendererId) => {
    const paths = new Set();
    return [...files]
        .map((file) => {
        if (file.path === "" ||
            file.path.includes("\\") ||
            file.path.startsWith("/") ||
            /^[a-z]:/i.test(file.path) ||
            file.path.split("/").some((part) => part === "" || part === "." || part === "..")) {
            throw new Error(`Asset preview renderer '${rendererId}' returned unsafe path '${file.path}'.`);
        }
        if (paths.has(file.path)) {
            throw new Error(`Asset preview renderer '${rendererId}' returned duplicate path '${file.path}'.`);
        }
        paths.add(file.path);
        if (file.mediaType === "") {
            throw new Error(`Asset preview renderer '${rendererId}' returned a file without media type.`);
        }
        if (!(file.bytes instanceof Uint8Array)) {
            throw new Error(`Asset preview renderer '${rendererId}' file bytes must be Uint8Array.`);
        }
        return Object.freeze({ ...file, bytes: Uint8Array.from(file.bytes) });
    })
        .sort((left, right) => left.path.localeCompare(right.path));
};
/** Order-independent registry for target- or plugin-owned preview renderers. */
export class AssetPreviewRegistry {
    #renderers = new Map();
    register(renderer) {
        if (!isStableId(renderer.id))
            throw new Error(`Preview renderer id '${renderer.id}' is not stable.`);
        if (renderer.version.trim() === "")
            throw new Error(`Preview renderer '${renderer.id}' has no version.`);
        if (this.#renderers.has(renderer.id))
            throw new Error(`Duplicate preview renderer id '${renderer.id}'.`);
        const codecIds = [...new Set(renderer.codecIds)].sort();
        if (codecIds.length === 0 || codecIds.some((id) => !isStableId(id))) {
            throw new Error(`Preview renderer '${renderer.id}' requires stable supported codec ids.`);
        }
        this.#renderers.set(renderer.id, Object.freeze({
            id: renderer.id,
            version: renderer.version,
            codecIds: Object.freeze(codecIds),
            render: renderer.render.bind(renderer),
        }));
        return this;
    }
    resolve(id) {
        const renderer = this.#renderers.get(id);
        if (!renderer)
            throw new Error(`Unknown asset preview renderer '${id}'.`);
        return renderer;
    }
    list() {
        return [...this.#renderers.values()].sort((left, right) => left.id.localeCompare(right.id));
    }
}
/**
 * Renders deterministic preview files only when a verification record matches
 * the current planned asset, codec version, extent, and source bytes.
 * @param {AssetPreviewRegistry} previewRegistry Composed preview registry.
 * @param {AssetCodecRegistry} codecRegistry Registry used for binary verification.
 * @param {AssetByteSource} source Current immutable source bytes.
 * @param {PlannedAsset} asset Verified planned asset.
 * @param {AssetVerificationRecord} verification Matching binary verification record.
 * @param {string} rendererId Stable preview renderer id.
 * @returns {readonly AssetExtractedFile[]} Deterministic presentation-only files.
 */
export const renderVerifiedAssetPreview = (previewRegistry, codecRegistry, source, asset, verification, rendererId) => {
    const renderer = previewRegistry.resolve(rendererId);
    const sourceBytes = source.read(asset.request.sourceOffset, asset.inspection.size);
    if (verification.id !== asset.id ||
        verification.codecId !== asset.request.codecId ||
        verification.codecVersion !== asset.codecVersion ||
        verification.sourceOffset !== asset.request.sourceOffset ||
        verification.size !== asset.inspection.size ||
        !sourceBytes ||
        verification.sourceSha256 !== sha256(sourceBytes) ||
        verification.encodedSha256 !== verification.sourceSha256) {
        throw new Error(`Asset '${asset.id}' preview requires a matching successful verification record.`);
    }
    if (!renderer.codecIds.includes(asset.request.codecId)) {
        throw new Error(`Preview renderer '${renderer.id}' does not support codec '${asset.request.codecId}'.`);
    }
    const decoded = decodePlannedAsset(codecRegistry, source, asset);
    const context = { asset, decoded, verification };
    const first = normalizeFiles(renderer.render(context), renderer.id);
    const second = normalizeFiles(renderer.render(context), renderer.id);
    if (first.length !== second.length ||
        first.some((file, index) => file.path !== second[index].path ||
            file.mediaType !== second[index].mediaType ||
            !sameBytes(file.bytes, second[index].bytes))) {
        throw new Error(`Asset preview renderer '${renderer.id}' is not deterministic.`);
    }
    return first;
};
//# sourceMappingURL=asset-preview.js.map
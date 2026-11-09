import { ASSET_LIMITS } from "@uttori/asm-assets/limits";
import { assertSourcePath } from "@uttori/asm-disassembler/source-project";
// Public metadata validation has no dependency on Node conversion/orchestration, so editor UI bundles can load it safely.
/** True for a plain object that can hold JSON object fields. */
function isObject(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
}
/** Require a plain JSON object, rejecting arrays and null. */
export function object(value) {
    if (!isObject(value)) {
        throw new Error("Invalid asset record object.");
    }
    return value;
}
/** Require a nonempty string of at most 4,096 characters. */
export function text(value) {
    if (typeof value !== "string" || !value.length || value.length > 4096) {
        throw new Error("Invalid asset record text.");
    }
    return value;
}
/** Require a 64-character lowercase hex SHA-256 digest. */
export function digest(value) {
    const result = text(value);
    if (!/^[\da-f]{64}$/.test(result)) {
        throw new Error("Invalid asset record hash.");
    }
    return result;
}
/** Require a lowercase UUID used as an export locator. */
export function locator(value) {
    const result = text(value);
    // Fixed groups bound matching work and enforce the complete lowercase export UUID.
    // oxlint-disable-next-line optimize-regex/optimize-regex
    if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/.test(result)) {
        throw new Error("Invalid asset export locator.");
    }
    return result;
}
/** Require a nonnegative safe integer no greater than `maximum`. */
export function number(value, maximum) {
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || value > maximum) {
        throw new Error("Invalid asset record integer.");
    }
    return value;
}
/** Require an array of text values, capped at `maximum` entries. */
export function strings(value, maximum = 65536) {
    if (!Array.isArray(value) || value.length > maximum) {
        throw new Error("Invalid asset string inventory.");
    }
    return value.map(text);
}
/** Require a Uint8Array within the decoded-asset byte limit. */
export function bytes(value) {
    if (!(value instanceof Uint8Array) || value.length > ASSET_LIMITS.decodedBytes) {
        throw new Error("Invalid asset record bytes.");
    }
    return value;
}
/** Require a complete interchange-capability flags object. */
export function capabilities(value) {
    const input = object(value);
    if (typeof input.pixelEdits !== "boolean" ||
        typeof input.paletteEdits !== "boolean" ||
        typeof input.tileReferences !== "boolean" ||
        typeof input.previewTimeline !== "boolean") {
        throw new Error("Invalid asset capabilities.");
    }
    return {
        pixelEdits: input.pixelEdits,
        paletteEdits: input.paletteEdits,
        tileReferences: input.tileReferences,
        previewTimeline: input.previewTimeline,
    };
}
/** Read `{ id, version }` from untrusted adapter/codec JSON. */
function contract(value) {
    const input = object(value);
    return { id: text(input.id), version: number(input.version, 65535) };
}
/** Manifest metadata selects a private record; it cannot grant paths, mappings or capabilities. */
export function readAssetExportManifest(value) {
    const input = object(value);
    if (input.format !== "uttori-asset-export" || input.version !== 2) {
        throw new Error("Unsupported asset manifest; re-export is required.");
    }
    return {
        format: input.format,
        version: input.version,
        id: locator(input.id),
        project: text(input.project),
        asset: text(input.asset),
        adapter: contract(input.adapter),
        codec: contract(input.codec),
        capabilities: capabilities(input.capabilities),
    };
}
/** Validate a bounded public review received over IPC; only the private persisted plan can authorize application. */
export function readAssetImportReview(value) {
    const input = object(value);
    if (input.format !== "uttori-asset-review" ||
        input.version !== 2 ||
        !Array.isArray(input.files) ||
        input.files.length > 65536 ||
        !Array.isArray(input.effects) ||
        input.effects.length > 65536) {
        throw new Error("Unsupported asset review summary.");
    }
    const files = input.files.map((entry) => {
        const file = object(entry), name = text(file.path);
        assertSourcePath(name);
        return { path: name, before: digest(file.before), after: digest(file.after) };
    }), effects = input.effects.map((entry) => {
        const effect = object(entry);
        return {
            resource: text(effect.resource),
            offset: number(effect.offset, Number.MAX_SAFE_INTEGER),
            size: number(effect.size, ASSET_LIMITS.decodedBytes),
            consumers: strings(effect.consumers, 65536),
        };
    });
    return immutableReview({
        format: input.format,
        version: input.version,
        id: digest(input.id),
        exportId: locator(input.exportId),
        documentSha256: digest(input.documentSha256),
        outputSha256: digest(input.outputSha256),
        files,
        effects,
    });
}
/** Freeze the complete review summary, including consumer lists, before returning it to a host. */
export function immutableReview(value) {
    return Object.freeze({
        ...value,
        files: Object.freeze(value.files.map((item) => Object.freeze({ ...item }))),
        effects: Object.freeze(value.effects.map((item) => Object.freeze({ ...item, consumers: Object.freeze([...item.consumers]) }))),
    });
}
//# sourceMappingURL=public-records.js.map
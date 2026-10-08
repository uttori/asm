import { ASSET_LIMITS } from "./limits.js";
/** Portable relative paths may reach adjacent source directories but cannot invoke platform/URL resolution. */
export function sourceResourcePath(value) {
    if (typeof value !== "string" ||
        !value ||
        value.length > 1024 ||
        /[\0:\\]/.test(value) ||
        value.startsWith("/")) {
        throw new Error("Source binding requires a portable relative resource path.");
    }
    return value;
}
/** Validate an envelope before any resource is resolved; game adapters validate mapping semantics. */
function isSourceBinding(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error("Invalid asset source binding.");
    }
    const binding = value;
    if (binding.format !== "uttori-asset-source" ||
        binding.version !== 1 ||
        typeof binding.id !== "string" ||
        !/^[\da-f-]{36}$/.test(binding.id) ||
        typeof binding.adapter !== "string" ||
        !binding.adapter ||
        !binding.source ||
        typeof binding.source.representation !== "string" ||
        !binding.resources ||
        typeof binding.resources !== "object" ||
        Array.isArray(binding.resources) ||
        !Array.isArray(binding.native) ||
        !binding.native.length ||
        binding.native.length > 1024) {
        throw new Error("Unsupported or incomplete asset source binding.");
    }
    sourceResourcePath(binding.source.path);
    for (const resource of Object.values(binding.resources)) {
        sourceResourcePath(resource);
    }
    const declarations = binding.native;
    for (const declaration of declarations) {
        if (!declaration || typeof declaration !== "object" || Array.isArray(declaration)) {
            throw new Error("Invalid native declaration in asset source binding.");
        }
        const native = Object.fromEntries(Object.entries(declaration));
        if (typeof native.format !== "string" ||
            !native.format ||
            !native.options ||
            typeof native.options !== "object" ||
            Array.isArray(native.options)) {
            throw new Error("Invalid native declaration in asset source binding.");
        }
    }
    return true;
}
/** Bounded portable source metadata is validated before callers can discover its resources. */
export function readAssetSourceBinding(bytes) {
    if (bytes.length > ASSET_LIMITS.metadataBytes) {
        throw new Error("Asset source binding exceeds its metadata budget.");
    }
    const value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (!isSourceBinding(value)) {
        throw new Error("Invalid asset source binding.");
    }
    return value;
}
/** Keys include the declaring binding identity, so sibling sidecars with equal relative filenames cannot collide. */
export function bindingResourceKey(binding, resource) {
    return `${binding}#${resource}`;
}
//# sourceMappingURL=source-binding.js.map
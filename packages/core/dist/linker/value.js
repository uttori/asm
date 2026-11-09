import { createHash } from "node:crypto";
/** Native artifacts use a fixed, locale-independent key order for reproducible cross-process identities. */
export function stableJson(value) {
    return JSON.stringify(portableValue(value));
}
/** Clone supported target metadata without silently dropping callbacks, nonfinite values, or rich objects. */
export function portableValue(value, depth = 0, budget = { nodes: 0 }) {
    if (depth > 128 || ++budget.nodes > 1000000) {
        throw new Error("Artifact metadata exceeds nesting limit 128.");
    }
    if (value === null || typeof value === "string" || typeof value === "boolean") {
        return value;
    }
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }
    if (Array.isArray(value)) {
        return value.map((item) => portableValue(item, depth + 1, budget));
    }
    if (value instanceof Map) {
        // Parsed target configuration contains Maps. Tagged entries preserve insertion order and avoid path reads.
        return {
            $uttoriMap: [...value].map(([key, item]) => [
                portableValue(key, depth + 1, budget),
                portableValue(item, depth + 1, budget),
            ]),
        };
    }
    if (typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
        const result = {};
        for (const key of Object.keys(value).toSorted()) {
            if (key === "$uttoriMap") {
                throw new Error("Reserved artifact metadata key '$uttoriMap'.");
            }
            const item = Reflect.get(value, key);
            if (item !== undefined) {
                Object.defineProperty(result, key, {
                    value: portableValue(item, depth + 1, budget),
                    enumerable: true,
                });
            }
        }
        return result;
    }
    throw new Error("Artifact metadata must contain portable data, not callbacks or runtime objects.");
}
/** Reverse the one explicit rich-value tag after bounded JSON parsing. */
export function restoreValue(value, depth = 0, budget = { nodes: 0 }) {
    if (depth > 128 || ++budget.nodes > 1000000) {
        throw new Error("Artifact metadata exceeds nesting limit 128.");
    }
    if (Array.isArray(value)) {
        return value.map((item) => restoreValue(item, depth + 1, budget));
    }
    if (isRecord(value)) {
        if (Object.hasOwn(value, "$uttoriMap")) {
            const entries = list(value.$uttoriMap, "Map entries");
            if (Object.keys(value).length !== 1) {
                throw new Error("Malformed artifact Map tag.");
            }
            return new Map(entries.map((entry) => {
                const pair = list(entry, "Map entry");
                if (pair.length !== 2) {
                    throw new Error("Malformed artifact Map entry.");
                }
                return [
                    restoreValue(pair[0], depth + 1, budget),
                    restoreValue(pair[1], depth + 1, budget),
                ];
            }));
        }
        return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, restoreValue(item, depth + 1, budget)]));
    }
    if (typeof value === "number" && !Number.isFinite(value)) {
        throw new Error("Nonfinite artifact value.");
    }
    return value;
}
/** SHA-256 covers exact serialized bytes, including metadata, payloads, and ordering. */
export function artifactHash(value) {
    return createHash("sha256").update(value).digest("hex");
}
/** Narrows JSON-like values to plain records for linker validation. */
export function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
/** Asserts a value is a record or throws with a caller-provided purpose label. */
export function record(value, purpose) {
    if (!isRecord(value)) {
        throw new Error(`${purpose} must be a record.`);
    }
    return value;
}
/** Asserts a bounded array or throws with a caller-provided purpose label. */
export function list(value, purpose) {
    if (!Array.isArray(value) || value.length > 1_000_000) {
        throw new Error(`${purpose} must be a bounded array.`);
    }
    return value;
}
/** Asserts a non-empty trimmed string within linker text limits. */
export function textValue(value, purpose) {
    if (typeof value !== "string" || !value.trim() || value.length > 65536) {
        throw new Error(`${purpose} must be nonempty text.`);
    }
    return value;
}
/** Asserts a safe integer within inclusive bounds for linker metadata fields. */
export function integer(value, purpose, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
    if (typeof value !== "number" ||
        !Number.isSafeInteger(value) ||
        value < minimum ||
        value > maximum) {
        throw new Error(`${purpose} is outside ${minimum}..${maximum}.`);
    }
    return value;
}
//# sourceMappingURL=value.js.map
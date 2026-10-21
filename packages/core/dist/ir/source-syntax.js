/**
 * Copy a bounded plain JSON tree without invoking accessors or preserving prototypes.
 * Reject cyclic/host objects early so worker snapshots cannot silently change their meaning.
 * Allow up to 1,000,000 values and 128 nesting levels (the root is level zero).
 */
export function copySyntaxValue(value) {
    const ancestors = new Set();
    let nodes = 0;
    const copy = (entry, depth) => {
        // A 64 KiB record initializer needs over 900,000 values once expressions and source
        // spans are included. Bound total allocation independently from recursive stack depth.
        if (++nodes > 1_000_000) {
            throw new Error("Plugin syntax payload exceeds structural limits (1,000,000 values).");
        }
        if (depth > 128) {
            throw new Error("Plugin syntax payload exceeds structural limits (128 nesting levels).");
        }
        if (entry === null || typeof entry === "string" || typeof entry === "boolean") {
            return entry;
        }
        if (typeof entry === "number" && Number.isFinite(entry)) {
            return entry;
        }
        if (typeof entry !== "object") {
            throw new Error("Plugin syntax payload must be plain JSON data.");
        }
        if (ancestors.has(entry)) {
            throw new Error("Plugin syntax payload must be acyclic.");
        }
        const prototype = Object.getPrototypeOf(entry);
        if (!Array.isArray(entry) && prototype !== Object.prototype && prototype !== null) {
            throw new Error("Plugin syntax payload must have a plain prototype.");
        }
        if (Object.getOwnPropertySymbols(entry).length) {
            throw new Error("Plugin syntax payload cannot contain symbol properties.");
        }
        ancestors.add(entry);
        try {
            const descriptors = Object.getOwnPropertyDescriptors(entry);
            for (const descriptor of Object.values(descriptors)) {
                if (!("value" in descriptor)) {
                    throw new Error("Plugin syntax payload cannot contain accessors.");
                }
            }
            if (Array.isArray(entry)) {
                const result = [];
                for (let index = 0; index < entry.length; index++) {
                    if (!Object.hasOwn(descriptors, index)) {
                        throw new Error("Plugin syntax arrays must be dense.");
                    }
                    result.push(copy(descriptors[index].value, depth + 1));
                }
                if (Object.keys(descriptors).length !== entry.length + 1) {
                    throw new Error("Plugin syntax arrays cannot have custom properties.");
                }
                return result;
            }
            return Object.fromEntries(Object.entries(descriptors).map(([key, descriptor]) => [
                key,
                copy(descriptor.value, depth + 1),
            ]));
        }
        finally {
            ancestors.delete(entry);
        }
    };
    return copy(value, 0);
}
//# sourceMappingURL=source-syntax.js.map
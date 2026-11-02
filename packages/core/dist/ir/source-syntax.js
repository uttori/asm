/**
 * Copy a bounded plain JSON tree without invoking accessors or preserving prototypes.
 * Reject cyclic/host objects early so worker snapshots cannot silently change their meaning.
 * Allow up to 1,000,000 values and 128 nesting levels (the root is level zero).
 */
export function copySyntaxValue(value) {
    return copySyntaxTree(value, false);
}
/** Only roots copied and recursively frozen here may bypass later defensive copies. */
const immutableRoots = new WeakSet();
/** Detach and freeze a bounded JSON tree; never freeze caller-owned parser or transport objects. */
export function immutableSyntaxValue(value) {
    const result = copySyntaxTree(value, true);
    if (result !== null && typeof result === "object") {
        immutableRoots.add(result);
    }
    return result;
}
/** Object.freeze alone cannot prove recursive immutability or prior structural validation. */
export function isImmutableSyntaxValue(value) {
    return value !== null && typeof value === "object" && immutableRoots.has(value);
}
/** Share validation and allocation limits between mutable plugin snapshots and immutable built-ins. */
function copySyntaxTree(value, immutable) {
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
            const keys = Object.getOwnPropertyNames(entry);
            if (Array.isArray(entry)) {
                const result = [];
                for (let index = 0; index < entry.length; index++) {
                    const descriptor = Object.getOwnPropertyDescriptor(entry, index);
                    if (!descriptor) {
                        throw new Error("Plugin syntax arrays must be dense.");
                    }
                    if (!("value" in descriptor)) {
                        throw new Error("Plugin syntax payload cannot contain accessors.");
                    }
                    result.push(copy(descriptor.value, depth + 1));
                }
                if (keys.length !== entry.length + 1) {
                    throw new Error("Plugin syntax arrays cannot have custom properties.");
                }
                return immutable ? Object.freeze(result) : result;
            }
            // Inspect one property at a time instead of allocating a descriptor table,
            // entries and pairs for every AST node. Data properties retain accessor isolation.
            const result = {};
            for (const key of keys) {
                const descriptor = Object.getOwnPropertyDescriptor(entry, key);
                if (!descriptor || !("value" in descriptor)) {
                    throw new Error("Plugin syntax payload cannot contain accessors.");
                }
                const copied = copy(descriptor.value, depth + 1);
                // Check after copying children, which can traverse plugin proxies. An
                // inherited setter or __proto__ must become an own data property; ordinary
                // AST fields can use the cheaper assignment path without descriptor allocation.
                if (Object.hasOwn(Object.prototype, key)) {
                    Object.defineProperty(result, key, {
                        value: copied,
                        enumerable: true,
                        writable: true,
                        configurable: true,
                    });
                }
                else {
                    result[key] = copied;
                }
            }
            return immutable ? Object.freeze(result) : result;
        }
        finally {
            ancestors.delete(entry);
        }
    };
    return copy(value, 0);
}
//# sourceMappingURL=source-syntax.js.map
export function clonePluginSyntax(value) {
    if (Array.isArray(value)) {
        // eslint-disable-next-line unicorn/no-new-array -- Preserve holes; Array.from would create owned undefined entries.
        const copy = new Array(value.length);
        for (let index = 0; index < value.length; index++) {
            if (index in value) {
                copy[index] = clonePluginSyntax(value[index]);
            }
        }
        return copy;
    }
    if (value !== null && typeof value === "object") {
        const copy = {};
        // This boundary runs for each directive/hook in every stage. Avoid intermediate entry
        // arrays and per-property callbacks while preserving owned, mutable plain-data snapshots.
        for (const key of Object.keys(value)) {
            const entry = Reflect.get(value, key);
            if (key === "__proto__") {
                // Syntax keys are data, including this spelling; assigning it would invoke a prototype setter.
                Object.defineProperty(copy, key, {
                    value: clonePluginSyntax(entry),
                    enumerable: true,
                    writable: true,
                    configurable: true,
                });
            }
            else {
                copy[key] = clonePluginSyntax(entry);
            }
        }
        return copy;
    }
    return value;
}
//# sourceMappingURL=syntax-snapshot.js.map
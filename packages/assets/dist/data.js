export * from "./data-scalar.js";
export * from "./data-structured.js";
export * from "./data-text.js";
/** Raw byte importer copies input so the result is independent of host buffers. */
export const rawImporter = Object.freeze({
    id: "uttori.import.raw",
    version: "1.0.0",
    mediaTypes: ["application/octet-stream"],
    import: (input) => ({
        kind: "raw",
        value: input.bytes.slice(),
    }),
});
/** Identity encoder for files or independently assembled code images. */
export const rawEncoder = Object.freeze({
    id: "uttori.data.raw",
    version: "1.0.0",
    inputKinds: ["raw"],
    primaryOutput: "data",
    encode: (document, options) => {
        if (Object.keys(options).length !== 0) {
            throw new Error("Raw encoding accepts no options.");
        }
        if (!(document.value instanceof Uint8Array)) {
            throw new Error("Raw document requires bytes.");
        }
        return {
            outputs: { data: { bytes: document.value.slice(), mediaType: "application/octet-stream" } },
            fidelity: { kind: "exact", verification: "byte equality" },
            normalizedOptions: {},
        };
    },
});
/** JSON authoring input for native models; validation belongs to the selected encoder. */
export const jsonImporter = Object.freeze({
    id: "uttori.import.json",
    version: "1.0.0",
    mediaTypes: ["application/json"],
    import: (input) => {
        const value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(input.bytes));
        if (value === null ||
            typeof value !== "object" ||
            Array.isArray(value) ||
            !("kind" in value) ||
            typeof value.kind !== "string") {
            throw new Error("Asset JSON requires an object with a kind string.");
        }
        return { kind: value.kind, value };
    },
});
//# sourceMappingURL=data.js.map
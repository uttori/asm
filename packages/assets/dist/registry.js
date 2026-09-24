import { isNamespacedId } from "./validation.js";
/** Host-independent registry; duplicate IDs and ambiguous media types fail at setup time. */
export class AssetRegistry {
    #importers = new Map();
    #encoders = new Map();
    #mediaTypes = new Map();
    registerImporter(importer) {
        if (!isNamespacedId(importer.id) ||
            !importer.version ||
            importer.mediaTypes.length === 0 ||
            this.#importers.has(importer.id)) {
            throw new Error(`Invalid or duplicate asset importer '${importer.id}'.`);
        }
        for (const mediaType of importer.mediaTypes) {
            if (this.#mediaTypes.has(mediaType)) {
                throw new Error(`Duplicate asset media type '${mediaType}'.`);
            }
        }
        this.#importers.set(importer.id, importer);
        importer.mediaTypes.forEach((type) => this.#mediaTypes.set(type, importer));
        return this;
    }
    registerEncoder(encoder) {
        if (!isNamespacedId(encoder.id) ||
            !encoder.version ||
            !encoder.primaryOutput ||
            encoder.inputKinds.length === 0 ||
            this.#encoders.has(encoder.id)) {
            throw new Error(`Invalid or duplicate asset encoder '${encoder.id}'.`);
        }
        this.#encoders.set(encoder.id, encoder);
        return this;
    }
    importerFor(mediaType) {
        const importer = this.#mediaTypes.get(mediaType);
        if (!importer) {
            throw new Error(`No asset importer for '${mediaType}'.`);
        }
        return importer;
    }
    encoderFor(id) {
        const encoder = this.#encoders.get(id);
        if (!encoder) {
            throw new Error(`No asset encoder '${id}'.`);
        }
        return encoder;
    }
}
/** Convert supplied bytes without a ROM, assembler, file read, or output write.
 * @param {AssetRegistry} registry Registered importers and encoders.
 * @param {AssetRequest} request Borrowed bytes, resources and options.
 * @returns {AssetResult} Named owned bytes and provider provenance.
 */
export function convertAsset(registry, request) {
    const importer = registry.importerFor(request.source.mediaType);
    const encoder = registry.encoderFor(request.format);
    // Snapshot caller bytes so a plugin cannot alter inputs held by another build stage.
    const source = { ...request.source, bytes: request.source.bytes.slice() };
    const resources = Object.fromEntries(Object.entries(request.resources ?? {}).map(([name, input]) => [
        name,
        { ...input, bytes: input.bytes.slice() },
    ]));
    const document = importer.import(source);
    if (!encoder.inputKinds.includes(document.kind)) {
        throw new Error(`Encoder '${encoder.id}' cannot consume '${document.kind}'.`);
    }
    const encoded = encoder.encode(document, request.options ?? {}, resources);
    if (encoded.fidelity.kind === "lossy-audio" &&
        (encoder.id !== "snes.brr" || document.kind !== "pcm-audio")) {
        throw new Error(`Encoder '${encoder.id}' cannot declare lossy fidelity for '${document.kind}'.`);
    }
    if (!Object.hasOwn(encoded.outputs, encoder.primaryOutput)) {
        throw new Error(`Encoder '${encoder.id}' omitted primary output '${encoder.primaryOutput}'.`);
    }
    const outputs = {};
    for (const [name, output] of Object.entries(encoded.outputs)) {
        if (!(output.bytes instanceof Uint8Array)) {
            throw new Error(`Output '${name}' is not bytes.`);
        }
        outputs[name] = { ...output, bytes: output.bytes.slice() };
    }
    return {
        outputs,
        primaryOutput: encoder.primaryOutput,
        fidelity: encoded.fidelity,
        importer: { id: importer.id, version: importer.version },
        encoder: { id: encoder.id, version: encoder.version },
        options: encoded.normalizedOptions,
        document,
    };
}
//# sourceMappingURL=registry.js.map
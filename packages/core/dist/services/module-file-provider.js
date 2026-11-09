/** Own every consumed module input across passes, including virtual documents and converter resources. */
export class ModuleFileProvider {
    provider;
    /** Immutable byte snapshots retained for the current build pass. */
    snapshots = new Map();
    bytes = 0;
    constructor(provider) {
        this.provider = provider;
    }
    /** A new assembly observes fresh inputs; later passes share the first successful read. */
    beginBuild() {
        this.snapshots.clear();
        this.bytes = 0;
    }
    /** Inline entry source is consumed outside the provider but belongs to the same dependency receipt. */
    recordSource(filename, bytes) {
        this.retain(filename, bytes);
    }
    /** Retained snapshots share one input-size ceiling, regardless of the read path. */
    retain(filename, bytes) {
        const previous = this.snapshots.get(filename);
        const remaining = 256 * 1024 * 1024 - this.bytes + (previous?.length ?? 0);
        if (bytes.length > remaining) {
            throw new Error("Module input snapshots exceed 256 MiB.");
        }
        this.bytes += bytes.length - (previous?.length ?? 0);
        this.snapshots.set(filename, bytes.slice());
    }
    /** Delegates path resolution to the wrapped provider without caching. */
    resolvePath(filename, options) {
        return this.provider.resolvePath(filename, options);
    }
    /** Delegates file metadata queries to the wrapped provider. */
    stat(filename) {
        return this.provider.stat(filename);
    }
    /** Copies at both boundaries prevent providers or converter callbacks from mutating retained inputs. */
    readFile(filename) {
        let bytes = this.snapshots.get(filename);
        if (!bytes) {
            bytes = Uint8Array.from(this.provider.readFile(filename));
            // Bound retained input storage independently of section extents and decoded asset limits.
            this.retain(filename, bytes);
        }
        return bytes.slice();
    }
    /** Decodes a retained snapshot using the same copy-on-read boundary as binary reads. */
    readTextFile(filename, encoding = "utf8") {
        const bytes = this.readFile(filename);
        if (typeof Buffer !== "undefined") {
            return Buffer.from(bytes).toString(encoding);
        }
        return new TextDecoder(encoding).decode(bytes);
    }
}
//# sourceMappingURL=module-file-provider.js.map
/** Avoid typed-view bookkeeping for tiny outputs; dense owned images store one byte per element. */
const DENSE_THRESHOLD = 64 * 1024;
/**
 * Mutable session output with geometric byte capacity and a separate visible extent. Internal writes
 * never allocate a view per byte. Public reads materialize a bounded view only when the extent changes.
 * Sparse raw patches retain array holes. Explicitly supplied arrays keep their growth behavior;
 * supplied typed arrays stay fixed.
 */
export class AssemblyOutputBuffer {
    value = [];
    storage;
    visible;
    used = 0;
    managed = true;
    /** Visible byte count; spare capacity in managed storage is excluded. */
    get length() {
        return this.storage ? this.used : this.value.length;
    }
    /** Reacquire a typed view after growing writes; spare capacity never enters checksums or output. */
    get bytes() {
        if (!this.storage) {
            return this.value;
        }
        if (!this.visible || this.visible.length !== this.used) {
            this.visible = this.storage.subarray(0, this.used);
        }
        return this.visible;
    }
    /** Preserve direct assignment ownership and fixed/growable behavior of the supplied container. */
    replace(value) {
        this.value = value;
        this.storage = undefined;
        this.visible = undefined;
        this.used = 0;
        this.managed = false;
    }
    /** Raw array edits may introduce holes whose undefined reads must survive representation changes. */
    canPromote() {
        if (!this.managed) {
            return false;
        }
        for (let index = 0; index < this.value.length; index++) {
            if (!(index in this.value)) {
                this.managed = false;
                return false;
            }
        }
        return true;
    }
    /** Copy only on geometric growth, releasing the boxed prefix when it becomes a dense byte image. */
    reserve(end) {
        const required = Math.max(end, this.length);
        let capacity = this.storage?.length ?? DENSE_THRESHOLD;
        if (!this.storage || capacity < required) {
            while (capacity < required) {
                capacity *= 2;
            }
            const storage = new Uint8Array(capacity);
            if (this.storage) {
                storage.set(this.storage.subarray(0, this.used));
            }
            else {
                storage.set(this.value);
                this.used = this.value.length;
            }
            this.storage = storage;
            this.value = storage;
            this.visible = undefined;
        }
        return this.storage;
    }
    /** Set one output offset without changing cursor, mappings, tracing or lifecycle policy. */
    write(offset, value) {
        if (this.storage && (!Number.isInteger(offset) || offset < 0 || offset >= 0xffffffff)) {
            // Non-index properties never extend a typed image's visible byte extent.
            this.storage[offset] = value & 0xff;
            return;
        }
        if (this.storage ||
            (offset >= DENSE_THRESHOLD - 1 &&
                Number.isInteger(offset) &&
                offset < 0xffffffff &&
                this.canPromote())) {
            // Capacity checks stay on the byte path; allocation and prefix copying occur only on growth.
            let storage = this.storage;
            if (!storage || offset >= storage.length) {
                storage = this.reserve(offset + 1);
            }
            storage[offset] = value & 0xff;
            if (offset >= this.used) {
                this.used = offset + 1;
            }
        }
        else {
            this.value[offset] = value & 0xff;
        }
    }
    /** Fill already-authorized output ranges; unusual indices retain the established indexed-write path. */
    fill(start, value, length) {
        const end = start + length;
        const denseRange = length > 0 &&
            Number.isSafeInteger(start) &&
            start >= 0 &&
            Number.isSafeInteger(length) &&
            end <= 0xffffffff;
        if (denseRange && this.managed && start > this.length) {
            // Raw patches can extend an image without writing the gap. Arrays preserve undefined reads
            // in that gap, while normal mapped writes fill it explicitly before entering this method.
            if (this.storage) {
                this.value = Array.from(this.storage.subarray(0, this.used));
                this.storage = undefined;
                this.visible = undefined;
                this.used = 0;
            }
            this.managed = false;
        }
        if (denseRange && (this.storage || (end >= DENSE_THRESHOLD && this.canPromote()))) {
            this.reserve(end).fill(value & 0xff, start, end);
            this.used = Math.max(this.used, end);
            return;
        }
        for (let index = 0; index < length; index++) {
            this.write(start + index, value);
        }
    }
    /** Seed existing bytes in bulk while preserving any output beyond the replaced prefix. */
    seed(values) {
        if (this.storage || (values.length >= DENSE_THRESHOLD && this.canPromote())) {
            this.reserve(values.length).set(values);
            this.used = Math.max(this.used, values.length);
        }
        else {
            for (let index = 0; index < values.length; index++) {
                this.value[index] = values[index];
            }
        }
    }
}
//# sourceMappingURL=assembly-output-buffer.js.map
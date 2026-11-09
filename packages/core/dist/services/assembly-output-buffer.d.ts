/**
 * Mutable session output with geometric byte capacity and a separate visible extent. Internal writes
 * never allocate a view per byte. Public reads materialize a bounded view only when the extent changes.
 * Sparse raw patches retain array holes. Explicitly supplied arrays keep their growth behavior;
 * supplied typed arrays stay fixed.
 */
export declare class AssemblyOutputBuffer {
    private value;
    private storage?;
    private visible?;
    private used;
    private managed;
    /** Visible byte count; spare capacity in managed storage is excluded. */
    get length(): number;
    /** Reacquire a typed view after growing writes; spare capacity never enters checksums or output. */
    get bytes(): number[] | Uint8Array;
    /** Preserve direct assignment ownership and fixed/growable behavior of the supplied container. */
    replace(value: number[] | Uint8Array): void;
    /** Raw array edits may introduce holes whose undefined reads must survive representation changes. */
    private canPromote;
    /** Copy only on geometric growth, releasing the boxed prefix when it becomes a dense byte image. */
    private reserve;
    /** Set one output offset without changing cursor, mappings, tracing or lifecycle policy. */
    write(offset: number, value: number): void;
    /** Fill already-authorized output ranges; unusual indices retain the established indexed-write path. */
    fill(start: number, value: number, length: number): void;
    /** Seed existing bytes in bulk while preserving any output beyond the replaced prefix. */
    seed(values: Uint8Array): void;
}
//# sourceMappingURL=assembly-output-buffer.d.ts.map
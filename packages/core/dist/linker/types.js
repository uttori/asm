/** Structured failures keep partial allocation evidence and original source occurrences available to hosts. */
export class LinkError extends Error {
    code;
    source;
    allocations;
    /** Stable error name for instanceof checks across bundle boundaries. */
    name = "LinkError";
    /**
     * Captures a link failure with optional source anchoring and partial placement state.
     * @param code Stable machine-readable failure code.
     * @param message Human-readable explanation prefixed with source location when present.
     * @param source Optional source occurrence tied to the failure.
     * @param allocations Partial allocations computed before the failure.
     */
    constructor(code, message, source, allocations = []) {
        const location = source ? `${source.file}:${source.line}: ` : "";
        super(`${location}${message}`);
        this.code = code;
        this.source = source;
        this.allocations = allocations;
    }
}
//# sourceMappingURL=types.js.map
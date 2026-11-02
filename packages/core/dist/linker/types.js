/** Structured failures keep partial allocation evidence and original source occurrences available to hosts. */
export class LinkError extends Error {
    code;
    source;
    allocations;
    name = "LinkError";
    constructor(code, message, source, allocations = []) {
        const location = source ? `${source.file}:${source.line}: ` : "";
        super(`${location}${message}`);
        this.code = code;
        this.source = source;
        this.allocations = allocations;
    }
}
//# sourceMappingURL=types.js.map
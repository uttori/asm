/** Typed source workflow failure that preserves a stable code across IPC and worker boundaries. */
export class SourceOperationError extends Error {
    code;
    constructor(code, message, options) {
        super(message, options);
        this.code = code;
        this.name = "SourceOperationError";
    }
}
//# sourceMappingURL=errors.js.map
export class SourceOperationError extends Error {
    code;
    constructor(code, message, options) {
        super(message, options);
        this.code = code;
        this.name = "SourceOperationError";
    }
}
//# sourceMappingURL=errors.js.map
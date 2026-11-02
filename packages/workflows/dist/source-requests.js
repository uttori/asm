/** Only structured request fields are accepted across terminal and worker boundaries. */
const fields = {
    init: ["rom", "dizRawFile", "mapper"],
    status: ["candidate"],
    prepare: ["assembly"],
    preview: ["candidate"],
    apply: ["candidate"],
    finish: ["message"],
    abort: [],
    discard: ["candidate"],
    clean: [],
    build: [],
    index: [],
    analyze: [],
    catalog: [],
    graphics: ["graphicsQuery"],
    relocate: ["objectId"],
    expand: ["expansionSize"],
    research: ["research"],
    import: ["capture", "captures", "recoverPartial"],
};
const isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
const isAction = (value) => typeof value === "string" && Object.hasOwn(fields, value);
const isText = (value) => typeof value === "string" && value.length > 0 && !value.includes("\0");
/** Validate transport shape here; research values receive their complete domain validation before any edit is proposed. */
function assertRequest(value) {
    if (!isRecord(value) || !isAction(value.action) || !isText(value.directory)) {
        throw new Error("Source operation requires a known action and project directory.");
    }
    const allowed = new Set([
        "action",
        "directory",
        "signal",
        "onProgress",
        "overlays",
        ...fields[value.action],
    ]);
    for (const [key, field] of Object.entries(value)) {
        if (field !== undefined && !allowed.has(key)) {
            throw new Error(`Source ${value.action} does not accept ${key}.`);
        }
    }
    for (const key of [
        "rom",
        "dizRawFile",
        "mapper",
        "candidate",
        "message",
        "capture",
        "objectId",
    ]) {
        if (value[key] !== undefined && !isText(value[key])) {
            throw new Error(`Invalid source ${key}.`);
        }
    }
    if (value.signal !== undefined && !(value.signal instanceof AbortSignal)) {
        throw new Error("Invalid source cancellation signal.");
    }
    if (value.onProgress !== undefined && typeof value.onProgress !== "function") {
        throw new Error("Invalid source progress callback.");
    }
    if (value.overlays !== undefined &&
        (!Array.isArray(value.overlays) ||
            value.overlays.length > 65536 ||
            !value.overlays.every((item) => isRecord(item) && isText(item.path) && item.bytes instanceof Uint8Array))) {
        throw new Error("Invalid source overlays.");
    }
    if (value.assembly !== undefined && value.assembly !== "linked") {
        throw new Error("Source preparation supports only explicit linked migration.");
    }
    if (value.action === "init" && !isText(value.rom)) {
        throw new Error("Initialization requires an original ROM path.");
    }
    if (["preview", "apply", "discard"].includes(value.action) && !isText(value.candidate)) {
        throw new Error("Source operation requires a generation commit.");
    }
    if (value.action === "relocate" && !isText(value.objectId)) {
        throw new Error("Relocation requires a declared object ID.");
    }
    if (value.action === "expand" &&
        (typeof value.expansionSize !== "number" ||
            !Number.isSafeInteger(value.expansionSize) ||
            value.expansionSize < 1)) {
        throw new Error("Expansion requires an explicit capacity in bytes.");
    }
    if (value.action === "import") {
        if (value.recoverPartial !== undefined && typeof value.recoverPartial !== "boolean") {
            throw new Error("Invalid partial capture recovery selection.");
        }
        const single = isText(value.capture);
        const batch = Array.isArray(value.captures) &&
            value.captures.length > 0 &&
            value.captures.length <= 65536 &&
            value.captures.every(isText);
        if (single === batch ||
            (value.capture !== undefined && !single) ||
            (value.captures !== undefined && !batch)) {
            throw new Error("Import requires one archive or one nonempty capture queue, exclusively.");
        }
    }
    if (value.graphicsQuery !== undefined) {
        const query = value.graphicsQuery;
        if (!isRecord(query) || !isText(query.captureSha256)) {
            throw new Error("Invalid source graphics selection.");
        }
        for (const key of ["pc", "physicalOffset", "limit"]) {
            if (query[key] !== undefined &&
                (typeof query[key] !== "number" || !Number.isSafeInteger(query[key]) || query[key] < 0)) {
                throw new Error(`Invalid graphics ${key}.`);
            }
        }
    }
    if (value.research !== undefined) {
        const request = value.research;
        if (!isRecord(request) ||
            (request.kind !== undefined && request.kind !== "symbols" && request.kind !== "analysis") ||
            (request.symbolId !== undefined && !isText(request.symbolId))) {
            throw new Error("Invalid research request.");
        }
        const change = request.change;
        if (change !== undefined) {
            if (!isRecord(change)) {
                throw new Error("Invalid research change.");
            }
            if (request.kind === "analysis") {
                if (!isText(change.expectedDocumentSha256) ||
                    !["annotations", "analysis"].includes(String(change.collection))) {
                    throw new Error("Invalid research analysis identity.");
                }
                if (change.kind === "remove") {
                    if (!isText(change.id)) {
                        throw new Error("Research removal requires a record ID.");
                    }
                }
                else if (change.kind !== "put" ||
                    !isText(change.path) ||
                    !isText(change.reason) ||
                    !isRecord(change.value)) {
                    throw new Error("Invalid research analysis edit.");
                }
            }
            else if (change.kind === "aliases") {
                if (!Array.isArray(change.aliases) || !change.aliases.every(isText)) {
                    throw new Error("Invalid research aliases.");
                }
            }
            else if (change.kind === "suppression") {
                if (typeof change.suppressed !== "boolean") {
                    throw new Error("Invalid research suppression.");
                }
            }
            else if (change.kind !== "entry-point" || typeof change.enabled !== "boolean") {
                throw new Error("Invalid research symbol edit.");
            }
        }
    }
}
/** Parse commands and IPC before opening a project; the returned union keeps action/arguments paired. */
export function readSourceOperation(value) {
    assertRequest(value);
    return value;
}
//# sourceMappingURL=source-requests.js.map
import { validateSourceLabelName } from "./project-labels.js";
import { isResearchMapping } from "./research-mapping.js";
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isStringList(value) {
    return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}
function isInteger(value) {
    return typeof value === "number" && Number.isInteger(value);
}
function isSafeInteger(value) {
    return typeof value === "number" && Number.isSafeInteger(value);
}
function isStateRecord(value) {
    return typeof value === "object" && value !== null;
}
/** Own enumerable fields, including array indexes and string code units. */
function stateEntries(state) {
    if (typeof state === "string") {
        const entries = [];
        for (let index = 0; index < state.length; index += 1) {
            entries.push([String(index), state[index]]);
        }
        return entries;
    }
    if (!isStateRecord(state)) {
        return [];
    }
    const entries = [];
    for (const field of Object.keys(state)) {
        entries.push([field, state[field]]);
    }
    return entries;
}
const CLASSIFICATIONS = [
    "unreached",
    "opcode",
    "operand",
    "data8",
    "data16",
    "data24",
    "data32",
    "pointer16",
    "pointer24",
    "pointer32",
    "graphics",
    "music",
    "compressed",
    "asset",
    "empty",
    "text",
];
/**
 * Require the editable record shape before accessing it. General project validation supplements
 * these checks with address-space bounds, codec constraints, and evidence-reference validation.
 * @param {MetadataShard} shard Collection selected by the caller.
 * @param {unknown} record Candidate native record.
 */
export const validateEditableMetadataRecord = (shard, record) => {
    if (!isRecord(record) ||
        typeof record.id !== "string" ||
        !/^\w[\w./:-]*$/.test(record.id) ||
        !isStringList(record.evidence)) {
        throw new Error("Metadata needs a stable record ID and evidence list.");
    }
    if (record.mapping !== undefined && !isResearchMapping(record.mapping)) {
        throw new Error("Invalid research mapping selector.");
    }
    if (record.kind === "target-set" && record.mapping && "fileOffset" in record.mapping) {
        throw new Error("Target sets use mapper state; a single physical anchor cannot select multiple targets.");
    }
    const address = record.address;
    if ("address" in record && !(isSafeInteger(address) && address >= 0)) {
        throw new Error("Metadata needs a nonnegative integer address.");
    }
    if (typeof record.addressSpace !== "string") {
        throw new Error("Metadata needs a named address space.");
    }
    if (shard === "labels") {
        const name = record.name;
        if (typeof name !== "string" || name === "" || !("address" in record) || "kind" in record) {
            throw new Error("Invalid label metadata.");
        }
        const sourceName = record.sourceName;
        if (sourceName !== undefined) {
            if (typeof sourceName !== "string") {
                throw new Error("Use a global label name containing letters, digits, and underscores, starting with a letter or underscore.");
            }
            validateSourceLabelName(sourceName);
        }
        if (record.suppressed !== undefined && typeof record.suppressed !== "boolean") {
            throw new Error("Invalid label suppression flag.");
        }
        for (const value of [record.comment, record.inlineComment]) {
            if (value !== undefined && (typeof value !== "string" || value.includes("\0"))) {
                throw new Error("Invalid label comment.");
            }
        }
    }
    else if (shard === "comments") {
        const text = record.text;
        if (typeof text !== "string" ||
            !text.trim() ||
            text.includes("\0") ||
            !("address" in record) ||
            "kind" in record) {
            throw new Error("A standalone comment needs nonempty text.");
        }
    }
    else if (shard === "annotations") {
        const classification = record.classification;
        const architecture = record.architecture;
        if (typeof classification !== "string" ||
            !CLASSIFICATIONS.some((candidate) => candidate === classification) ||
            typeof architecture !== "string" ||
            architecture === "") {
            throw new Error("Invalid classification metadata.");
        }
        const start = record.start;
        const end = record.end;
        if (!(isSafeInteger(start) && isSafeInteger(end) && start >= 0 && end > start)) {
            throw new Error("Classification bounds must describe a nonempty half-open interval.");
        }
        const state = record.state ?? {};
        for (const [field, value] of stateEntries(state)) {
            if (field === "e" || field === "m" || field === "x" || field === "carry") {
                if (typeof value !== "boolean") {
                    throw new Error(`State ${field} must be true or false; omit it to clear the hint.`);
                }
            }
            else {
                const maximum = field === "programBank" || field === "dataBank" ? 255 : 65535;
                if ((field !== "programBank" &&
                    field !== "dataBank" &&
                    field !== "directPage" &&
                    field !== "stackPointer") ||
                    !(isInteger(value) && value >= 0 && value <= maximum)) {
                    throw new Error(`Invalid state field '${field}'.`);
                }
            }
        }
        const points = record.points;
        if (Array.isArray(points) &&
            points.some((point) => (point !== "in" && point !== "out" && point !== "end" && point !== "read") ||
                typeof point !== "string")) {
            throw new Error("Invalid entry-point metadata.");
        }
    }
    else {
        const kind = record.kind;
        const targets = record.targets;
        if ((kind !== "target-override" && kind !== "target-set") ||
            !Array.isArray(targets) ||
            targets.some((value) => !Number.isSafeInteger(value) || value < 0)) {
            throw new Error("Only target overrides and target sets are editable analysis records.");
        }
        if (kind === "target-set" && (typeof record.name !== "string" || !record.name.trim())) {
            throw new Error("A target set needs a name.");
        }
        if (kind === "target-override" && !Number.isSafeInteger(record.address)) {
            throw new Error("A target override needs an instruction anchor.");
        }
    }
};
//# sourceMappingURL=metadata-validation.js.map
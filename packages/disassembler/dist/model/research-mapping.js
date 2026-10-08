function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
/** Reject empty selectors and misspelled envelope fields instead of silently broadening a decision. */
export function isResearchMapping(value) {
    if (!isRecord(value)) {
        return false;
    }
    const record = value;
    if (Object.keys(record).some((key) => key !== "fileOffset" && key !== "state")) {
        return false;
    }
    if (record.fileOffset !== undefined &&
        !(Number.isSafeInteger(record.fileOffset) && Number(record.fileOffset) >= 0)) {
        return false;
    }
    let fields = 0;
    if (record.state !== undefined) {
        if (typeof record.state !== "object" || record.state === null || Array.isArray(record.state)) {
            return false;
        }
        const entries = Object.entries(record.state);
        if (entries.length === 0 || entries.length > 64) {
            return false;
        }
        for (const [key, entry] of entries) {
            if (!/^[A-Za-z][\w.]{0,63}$/.test(key) ||
                (typeof entry !== "boolean" && !(Number.isSafeInteger(entry) && Number(entry) >= 0))) {
                return false;
            }
        }
        fields = entries.length;
    }
    return record.fileOffset !== undefined || fields > 0;
}
/** Match all supplied constraints. delta advances an interval's physical anchor with its CPU address. */
export function matchesResearchMapping(mapping, location, delta = 0) {
    if (!mapping) {
        return true;
    }
    if (mapping.fileOffset !== undefined && location.fileOffset !== mapping.fileOffset + delta) {
        return false;
    }
    return Object.entries(mapping.state ?? {}).every(([key, value]) => location.state?.[key] === value);
}
//# sourceMappingURL=research-mapping.js.map
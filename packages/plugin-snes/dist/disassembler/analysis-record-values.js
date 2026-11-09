/**
 * Confirms `key` is an own field so a mapped key object can be read without an assertion.
 * @param value Object whose keys are exactly the fields to copy.
 * @param key Candidate field name from `Object.keys`.
 * @returns True when `key` is an own property of `value`.
 */
function isOwnKey(value, key) {
    return Object.hasOwn(value, key);
}
/**
 * Lists every field of `T`. The argument's keys and values must both be those field names,
 * so a missing or extra analyzer field fails typechecking instead of being dropped from a record.
 * @param keys Field-name identity.
 * @returns Field names in source order.
 */
function completeKeys(keys) {
    const names = [];
    for (const key of Object.keys(keys)) {
        if (isOwnKey(keys, key)) {
            names.push(keys[key]);
        }
    }
    return names;
}
/**
 * Copies named fields into a plain record. Nested values keep their runtime identity.
 * @param value Source object.
 * @param keys Fields to copy, in record order.
 * @returns A shallow field copy.
 */
function knownFieldRecord(value, keys) {
    const record = {};
    for (const key of keys) {
        if (typeof key === "string") {
            record[key] = value[key];
        }
    }
    return record;
}
const cpu65816StateFields = completeKeys({
    e: "e",
    m: "m",
    x: "x",
    carry: "carry",
    pbr: "pbr",
    dbr: "dbr",
    d: "d",
    s: "s",
    stack: "stack",
});
const spc700StateFields = completeKeys({
    directPage: "directPage",
    stack: "stack",
});
const superFxStateFields = completeKeys({
    alt: "alt",
    destinationRegister: "destinationRegister",
    sourceRegister: "sourceRegister",
    programBank: "programBank",
});
/**
 * Copies 65816 abstract state into an analysis-record field.
 * @param state Incoming or outgoing analyzer state.
 * @returns Plain record of the tracked fields.
 */
export function cpu65816StateRecord(state) {
    return knownFieldRecord(state, cpu65816StateFields);
}
/**
 * Copies SPC700 abstract state into an analysis-record field.
 * @param state Incoming or outgoing analyzer state.
 * @returns Plain record of the tracked fields.
 */
export function spc700StateRecord(state) {
    return knownFieldRecord(state, spc700StateFields);
}
/**
 * Copies SuperFX abstract state into an analysis-record field.
 * @param state Incoming or outgoing analyzer state.
 * @returns Plain record of the tracked fields.
 */
export function superFxStateRecord(state) {
    return knownFieldRecord(state, superFxStateFields);
}
/**
 * Copies coverage counters into the summary record.
 * @param coverage Worklist coverage.
 * @returns Plain numeric record.
 */
export function coverageRecord(coverage) {
    return {
        instructionCount: coverage.instructionCount,
        functionCount: coverage.functionCount,
        reachedBytes: coverage.reachedBytes,
        totalBytes: coverage.totalBytes,
        reachedPercent: coverage.reachedPercent,
    };
}
/**
 * Copies one effective address, omitting fields the analyzer left unset.
 * @param address Memory operand description.
 * @returns Plain record.
 */
function effectiveAddressRecord(address) {
    return {
        operandIndex: address.operandIndex,
        ...(address.address === undefined ? {} : { address: address.address }),
        ...(address.baseAddress === undefined ? {} : { baseAddress: address.baseAddress }),
        ...(address.symbol === undefined ? {} : { symbol: address.symbol }),
        volatile: address.volatile,
        ...(address.romOffset === undefined ? {} : { romOffset: address.romOffset }),
        explanation: address.explanation,
    };
}
/**
 * Copies effective addresses into analysis-record fields.
 * @param addresses Memory operands for one instruction.
 * @returns Plain records in the same order.
 */
export function effectiveAddressRecords(addresses) {
    return addresses.map(effectiveAddressRecord);
}
/**
 * Copies an incomplete-reason object into the summary record.
 * @param reason Why the worklist stopped.
 * @returns Plain record.
 */
function incompleteReasonRecord(reason) {
    return {
        kind: reason.kind,
        address: reason.address,
        limit: reason.limit,
        message: reason.message,
    };
}
/**
 * Copies incomplete reasons into the summary record.
 * @param reasons Worklist stop reasons.
 * @returns Plain records in the same order.
 */
export function incompleteReasonRecords(reasons) {
    return reasons.map(incompleteReasonRecord);
}
//# sourceMappingURL=analysis-record-values.js.map
const snesLimits = {
    a: 65535,
    x: 65535,
    y: 65535,
    s: 65535,
    d: 65535,
    db: 255,
    pb: 255,
    pc: 65535,
    p: 255,
    e: 1,
};
const nesLimits = {
    a: 255,
    x: 255,
    y: 255,
    s: 255,
    p: 255,
    pc: 65535,
    mapper: 4,
    select: 7,
    prgMode: 1,
    chrMode: 1,
    ramEnabled: 1,
    ramWritable: 1,
    mirroring: 3,
    irqLatch: 255,
    irqEnabled: 1,
    r0: 255,
    r1: 255,
    r2: 255,
    r3: 255,
    r4: 255,
    r5: 255,
    r6: 255,
    r7: 255,
    prg0: 0xffffffff,
};
/** Validate and copy at the transport boundary; callers never retain an untrusted mutable input. */
export function readCaptureTargetPayload(codec, version, state) {
    if (version !== 1 || (codec !== "snes.65816" && codec !== "nes.2a03")) {
        throw new Error("Unsupported capture target codec/version.");
    }
    const limits = codec === "snes.65816" ? snesLimits : nesLimits;
    for (const [key, max] of Object.entries(limits)) {
        const value = state[key];
        if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > max) {
            throw new Error(`Invalid ${codec} register ${key}.`);
        }
    }
    for (const key of Object.keys(state)) {
        if (Object.hasOwn(limits, key)) {
            continue;
        }
        const value = state[key];
        if (codec !== "nes.2a03" ||
            !["prg1", "prg2"].includes(key) ||
            typeof value !== "number" ||
            !Number.isInteger(value) ||
            value < 0 ||
            value > 0xffffffff) {
            throw new Error(`Unknown or invalid ${codec} field ${key}.`);
        }
    }
    if (codec === "nes.2a03" && state.mapper !== 0 && state.mapper !== 4) {
        throw new Error("Unsupported captured NES mapper.");
    }
    if (codec === "snes.65816") {
        if (!isSnesState(state)) {
            throw new Error("Invalid SNES state.");
        }
        return Object.freeze({ codec, version: 1, state: Object.freeze({ ...state }) });
    }
    if (!isNesState(state)) {
        throw new Error("Invalid NES state.");
    }
    return Object.freeze({ codec, version: 1, state: Object.freeze({ ...state }) });
}
// Register ranges and extra fields are checked above; these predicates establish the named fields.
function isSnesState(state) {
    return Object.keys(snesLimits).every((key) => typeof state[key] === "number");
}
function isNesState(state) {
    return Object.keys(nesLimits).every((key) => typeof state[key] === "number");
}
//# sourceMappingURL=target-payload.js.map
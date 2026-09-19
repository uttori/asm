const known = (value) => ({ kind: "known", value });
const unknown = () => ({ kind: "unknown" });
export const initialSuperFxState = (programBank) => ({
    alt: known(0),
    destinationRegister: known(0),
    sourceRegister: known(0),
    programBank: programBank === undefined ? unknown() : known(programBank & 0xff),
});
const joinValue = (left, right) => {
    if (left.kind === "unknown" || right.kind === "unknown") {
        return { kind: "unknown" };
    }
    if (left.kind === "conflict" || right.kind === "conflict") {
        return { kind: "conflict" };
    }
    return left.value === right.value ? left : { kind: "conflict" };
};
export const joinSuperFxStates = (left, right) => ({
    alt: joinValue(left.alt, right.alt),
    destinationRegister: joinValue(left.destinationRegister, right.destinationRegister),
    sourceRegister: joinValue(left.sourceRegister, right.sourceRegister),
    programBank: joinValue(left.programBank, right.programBank),
});
const decodeValue = (value) => value.kind === "known" ? value.value : "unknown";
export const superFxDecodeState = (state) => ({
    alt: decodeValue(state.alt),
    destinationRegister: decodeValue(state.destinationRegister),
    sourceRegister: decodeValue(state.sourceRegister),
    programBank: decodeValue(state.programBank),
});
export const enterSuperFxAddress = (state, address) => ({ ...state, programBank: known((address >>> 16) & 0xff) });
const detailNumber = (instruction, name) => {
    const effect = instruction.effects.find((entry) => entry.kind === "custom" && entry.name === name);
    if (effect?.kind !== "custom") {
        return undefined;
    }
    const value = effect.details?.register ?? effect.details?.alt;
    return typeof value === "number" ? value : undefined;
};
export const transferSuperFxState = (instruction, state) => {
    const alt = detailNumber(instruction, "set-superfx-alt");
    if (alt !== undefined) {
        return {
            ...state,
            alt: state.alt.kind === "known"
                ? known(((state.alt.value | alt) & 3))
                : state.alt,
        };
    }
    const destination = detailNumber(instruction, "select-superfx-destination");
    if (destination !== undefined) {
        return { ...state, destinationRegister: known(destination) };
    }
    const paired = detailNumber(instruction, "select-superfx-source-destination");
    if (paired !== undefined) {
        return {
            ...state,
            destinationRegister: known(paired),
            sourceRegister: known(paired),
        };
    }
    const source = detailNumber(instruction, "select-superfx-source");
    if (source !== undefined) {
        return { ...state, sourceRegister: known(source) };
    }
    return {
        ...state,
        alt: known(0),
        destinationRegister: known(0),
        sourceRegister: known(0),
    };
};
export const superFxStateKey = (state) => JSON.stringify([state.alt, state.destinationRegister, state.sourceRegister, state.programBank]);
//# sourceMappingURL=superfx-state.js.map
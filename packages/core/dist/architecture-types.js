/**
 * Adapt capability groups to a flat encoder facade without copying session state.
 * @param {ArchitectureEncoderContext} context Capabilities borrowed from the owning session.
 * @returns {EncoderRuntime} A facade whose address and label-policy getters read live session values.
 */
export const createEncoderRuntime = (context) => ({
    operandResolver: context.operands,
    write1: (value) => context.emission.write1(value),
    write2: (value) => context.emission.write2(value),
    write3: (value) => context.emission.write3(value),
    writeByte: (value) => context.emission.writeByte(value),
    writeBytes: (values) => context.emission.writeBytes(values),
    writeValue: (value, width, endianness) => context.emission.writeValue(value, width, endianness),
    get currentTargetAddress() {
        return context.sizing.getCurrentAddress();
    },
    get enforceResolvedLabels() {
        return context.branches.enforceResolvedLabels();
    },
    symbolScope: {
        findNextLabel: (label, referenceAddress) => context.branches.findNextLabel(label, referenceAddress),
        findPreviousLabel: (label, referenceAddress) => context.branches.findPreviousLabel(label, referenceAddress),
    },
    diagnostics: context.diagnostics,
});
//# sourceMappingURL=architecture-types.js.map
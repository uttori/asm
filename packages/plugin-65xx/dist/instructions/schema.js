/**
 * Returns whether `features` satisfy `expression`.
 *
 * @param {FeatureExpression} expression Required / forbidden feature sets.
 * @param {ReadonlySet<CpuFeature>} features CPU feature set.
 * @returns {boolean} True when the form is available on this CPU.
 */
export function matchesFeatures(expression, features) {
    if (expression.allOf?.some((feature) => !features.has(feature))) {
        return false;
    }
    if (expression.anyOf && !expression.anyOf.some((feature) => features.has(feature))) {
        return false;
    }
    if (expression.noneOf?.some((feature) => features.has(feature))) {
        return false;
    }
    return true;
}
/**
 * Default codec for a mode. Immediate/zp/stack-relative collapse to `unsigned8`.
 * 24-bit `absoluteLongIndexedX` is the MEGA65/4510 long-x form.
 *
 * @param {AddressingMode} mode Addressing mode.
 * @returns {OperandCodecId} Operand codec id.
 */
export function getOperandCodec(mode) {
    switch (mode) {
        case "implied":
        case "accumulator":
        case "quadAccumulator":
            return "none";
        case "absolute":
        case "absoluteIndexedX":
        case "absoluteIndexedY":
        case "indirect":
        case "absoluteIndexedIndirect":
            return "unsigned16-le";
        case "absoluteLongIndexedX":
            return "unsigned24-le";
        case "relative":
            return "relative8";
        case "relative16":
            return "relative16";
        case "zeroPageRelative":
            return "zero-page-relative8";
        case "accumulatorRelative":
            return "accumulator-relative8";
        case "zeroPageImmediate":
            return "zero-page-immediate8";
        case "specialPage":
            return "special-page";
        case "blockTransfer":
            return "three-unsigned16-le";
        case "immediateZeroPage":
        case "immediateZeroPageIndexedX":
            return "immediate-unsigned8";
        case "immediateAbsolute":
        case "immediateAbsoluteIndexedX":
            return "immediate-unsigned16";
        default:
            return "unsigned8";
    }
}
/**
 * Operand field list for a codec. `zero-page-relative8` is BBR/BBS: zp then rel8.
 *
 * @param {OperandCodecId} codec Operand codec.
 * @returns {readonly OperandField[]} Field descriptors in emit order.
 */
export function getOperandFields(codec) {
    switch (codec) {
        case "none":
            return [];
        case "unsigned16-le":
            return [{ name: "address", width: 2 }];
        case "unsigned24-le":
            return [{ name: "address", width: 3 }];
        case "relative8":
            return [{ name: "target", width: 1, signed: true, relative: true }];
        case "relative16":
            return [{ name: "target", width: 2, signed: true, relative: true }];
        case "zero-page-relative8":
            return [
                { name: "address", width: 1 },
                { name: "target", width: 1, signed: true, relative: true },
            ];
        case "accumulator-relative8":
            return [{ name: "target", width: 1, signed: true, relative: true }];
        case "zero-page-immediate8":
            return [
                { name: "address", width: 1 },
                { name: "value", width: 1 },
            ];
        case "special-page":
            return [{ name: "address", width: 1 }];
        case "three-unsigned16-le":
            return [
                { name: "source", width: 2 },
                { name: "destination", width: 2 },
                { name: "length", width: 2 },
            ];
        case "immediate-unsigned8":
            return [
                { name: "value", width: 1 },
                { name: "address", width: 1 },
            ];
        case "immediate-unsigned16":
            return [
                { name: "value", width: 1 },
                { name: "address", width: 2 },
            ];
        case "unsigned8":
            return [{ name: "value", width: 1 }];
    }
    return [];
}
//# sourceMappingURL=schema.js.map
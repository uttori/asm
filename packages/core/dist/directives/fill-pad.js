import { parseDirectiveExpression } from "../ir/directive-arguments.js";
import { syntaxExpression, syntaxLiteral, syntaxNumber, syntaxOptional, syntaxRecord, } from "../ir/syntax-codec.js";
/** Repeating fill pattern length. LCM of byte/word/long/dword widths. */
const FILL_PATTERN_SIZE = 12;
const PATTERN_WIDTH = {
    fillbyte: 1,
    fillword: 2,
    filllong: 3,
    filldword: 4,
    padbyte: 1,
    padword: 2,
    padlong: 3,
    paddword: 4,
};
/**
 * Returns the little-endian unit width for a fill* or pad* pattern directive.
 * @param {string} keyword The directive keyword.
 * @param {"fill" | "pad"} kind Pattern family, used in the error message.
 * @returns {number} Width in bytes.
 * @throws {Error} If `keyword` is not a recognized pattern directive for `kind`.
 */
const patternWidth = (keyword, kind) => {
    if (!keyword.startsWith(kind)) {
        throw new Error(`Unrecognized ${kind} directive.`);
    }
    const width = PATTERN_WIDTH[keyword];
    if (width === undefined) {
        throw new Error(`Unrecognized ${kind} directive.`);
    }
    return width;
};
/**
 * Writes `length` little-endian repeats of `value` into `dest`.
 * @param {number} value Source integer.
 * @param {number} width Bytes consumed from `value` per repeat.
 * @param {number[]} dest Destination buffer.
 * @param {number} length Number of bytes to store.
 */
const writeLittleEndianRepeats = (value, width, dest, length) => {
    const unit = value >>> 0;
    const bytes = [unit & 0xff, (unit >>> 8) & 0xff, (unit >>> 16) & 0xff, (unit >>> 24) & 0xff];
    for (let i = 0; i < length; i++) {
        dest[i] = bytes[i % width];
    }
};
/** Shared pattern grammar; width is measured in bytes and the value remains unresolved. */
const parsePattern = (words, kind) => {
    const width = patternWidth(words[0], kind);
    if (words.length !== 2) {
        throw new Error(`${words[0].toUpperCase()} directive requires exactly one parameter.`);
    }
    return { width, expression: parseDirectiveExpression(words[1]) };
};
/** Install a pattern after evaluating its value in the current assembly stage. */
const executePattern = (context, kind, { width, expression }) => {
    const value = context.operandResolver.getnum(expression);
    if (kind === "fill") {
        writeLittleEndianRepeats(value, width, context.session.fillbyte, FILL_PATTERN_SIZE);
    }
    else {
        context.session.padUnit = width;
        writeLittleEndianRepeats(value, width, context.session.padbyte, width);
    }
};
/**
 * Sets the 12-byte fill pattern used by later `fill` directives.
 * @param {FillPadDirectiveContext} ctx The directive context.
 * @param {string[]} words `fillbyte` / `fillword` / `filllong` / `filldword` plus value.
 * @throws {Error} If the keyword is unknown or exactly one parameter is not supplied.
 */
export const handleFillPattern = (ctx, words) => {
    executePattern(ctx, "fill", parsePattern(words, "fill"));
};
/**
 * Emits `count` bytes of the current fill pattern.
 * @param {FillPadDirectiveContext} ctx The directive context.
 * @param {string[]} words `fill` plus the byte count.
 * @throws {Error} If exactly one parameter is not supplied.
 */
export const handleFill = (ctx, words) => {
    executeFill(ctx, parseFill({ words }));
};
/**
 * Sets the pad unit and little-endian pad bytes used by later `pad` directives.
 * @param {FillPadDirectiveContext} ctx The directive context.
 * @param {string[]} words `padbyte` / `padword` / `padlong` / `paddword` plus value.
 * @throws {Error} If the keyword is unknown or exactly one parameter is not supplied.
 */
export const handlePadPattern = (ctx, words) => {
    executePattern(ctx, "pad", parsePattern(words, "pad"));
};
/**
 * Pads with the current pad pattern.
 * With no address, writes until the next 64K bank boundary. With an address, writes
 * until that logical address (mapped through output offsets). A target at or before the
 * current PC is a no-op.
 * @param {FillPadDirectiveContext} ctx The directive context.
 * @param {string[]} words `pad` and an optional logical address.
 * @throws {Error} If more than one parameter is supplied, or the target does not map to output.
 */
export const handlePad = (ctx, words) => {
    executePad(ctx, parsePad({ words }));
};
/**
 * Registers fill/pad pattern and emit directives.
 * @param {DirectiveRegistry} registry The directive registry.
 * @param {FillPadDirectiveContext} context The fill/pad directive context.
 */
export const registerFillPadDirectives = (registry, context) => {
    const pattern = (kind, keywords) => {
        registry.registerImmutableTyped(keywords, ({ words }) => parsePattern(words, kind), syntaxRecord({ width: syntaxNumber, expression: syntaxExpression }), (payload) => executePattern(context, kind, payload));
    };
    pattern("fill", ["fillbyte", "fillword", "filllong", "filldword"]);
    pattern("pad", ["padbyte", "padword", "padlong", "paddword"]);
    registry.registerImmutableTyped("fill", parseFill, syntaxRecord({ expression: syntaxExpression }), (payload) => executeFill(context, payload));
    registry.registerImmutableTyped("pad", parsePad, syntaxRecord({ operation: syntaxLiteral("pad"), address: syntaxOptional(syntaxExpression) }), (payload) => executePad(context, payload));
};
/** Shared source/public-entry grammar for `fill`. */
const parseFill = ({ words }) => {
    if (words.length !== 2) {
        throw new Error("FILL directive requires exactly one parameter (number of bytes to fill).");
    }
    return { expression: parseDirectiveExpression(words[1]) };
};
/** Applies a parsed `fill` operation to the current stage. */
const executeFill = (context, { expression }) => {
    const count = context.operandResolver.getnum(expression);
    for (let index = 0; index < count; index++) {
        context.session.write1(context.session.fillbyte[index % FILL_PATTERN_SIZE]);
    }
};
/** Shared source/public-entry grammar for `pad`. */
const parsePad = ({ words }) => {
    if (words.length > 2) {
        throw new Error("PAD directive accepts zero or one parameter.");
    }
    return {
        operation: "pad",
        address: words.length === 2 ? parseDirectiveExpression(words[1]) : undefined,
    };
};
/** Applies a parsed `pad` operation to the current stage. */
const executePad = (context, { address }) => {
    const { session, operandResolver } = context;
    let gap = 0x10000 - (session.currentTargetAddress & 0xffff);
    if (address) {
        const targetAddress = operandResolver.getnum(address);
        const targetPC = session.outputWriter.toOutputOffset(targetAddress);
        if (targetPC < 0) {
            throw new Error(`Target address ${targetAddress.toString(16)} does not map to output.`);
        }
        const currentPC = session.outputWriter.toOutputOffset(session.currentTargetAddress);
        if (targetPC <= currentPC) {
            return;
        }
        gap = targetPC - currentPC;
    }
    for (let index = 0; index < gap; index++) {
        session.write1(session.padbyte[index % session.padUnit]);
    }
};
//# sourceMappingURL=fill-pad.js.map
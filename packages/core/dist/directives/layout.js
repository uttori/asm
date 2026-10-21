import { parseDirectiveExpression } from "../ir/directive-arguments.js";
import { syntaxBoolean, syntaxExpression, syntaxOptional, syntaxRecord, syntaxString, } from "../ir/syntax-codec.js";
/**
 * Pushes the current target address onto the push base stack.
 * @param {AddressStackDirectiveContext} ctx The directive context.
 * @returns {void}
 */
export const handlePushBase = ({ session }) => {
    session.pushBaseStack.push(session.currentTargetAddress);
};
/**
 * Restores the target address saved by {@link handlePushBase}.
 * @param {AddressStackDirectiveContext} ctx The directive context.
 * @returns {void}
 * @throws {Error} If the base stack is empty.
 */
export const handlePullBase = ({ session }) => {
    const baseAddress = session.pushBaseStack.pop();
    if (baseAddress === undefined) {
        throw new Error("No base value to pull.");
    }
    session.currentTargetAddress = baseAddress;
};
/**
 * Selects the architecture named by `words[1]`.
 * Prefers {@link DirectiveArchitectureCapability.selectArchitecture} when present.
 * Otherwise writes `session.arch` after checking `availableArchitectures`.
 * @param {ArchitectureDirectiveContext} ctx The architecture-capable session.
 * @param {readonly string[]} words Tokenized line, keyword first.
 * @returns {void}
 * @throws {Error} If the architecture name is missing, unknown, or not allowed on the target.
 */
export const handleArch = ({ session }, words) => {
    selectArchitecture({ session }, parseArchitectureName(words).name);
};
/** Apply a parsed CPU name without retaining parser tokens in the runtime contract. */
function selectArchitecture({ session }, archParam) {
    const canonical = session.architectureRegistry.getCanonicalName(archParam);
    if (!canonical) {
        if (session.selectArchitecture) {
            session.selectArchitecture(archParam, archParam);
            return;
        }
        throw new Error("Unsupported architecture: " + archParam);
    }
    if (!session.selectArchitecture &&
        session.availableArchitectures &&
        !session.availableArchitectures.has(canonical)) {
        throw new Error(`Architecture ${canonical} is unavailable for target ${session.targetDisplayName ?? "active target"}.`);
    }
    if (session.selectArchitecture) {
        session.selectArchitecture(canonical, archParam);
    }
    else {
        session.arch = canonical;
    }
}
/**
 * Registers `base`, `org`, `pushbase`/`pullbase`, `pushpc`/`pullpc`, and `arch`.
 * @param {DirectiveRegistry} registry The directive registry.
 * @param {DirectiveRegistryContexts["layout"]} context Layout-capable sessions and runtime.
 * @returns {void}
 */
const empty = () => ({});
export const registerGenericLayoutDirectives = (registry, context) => {
    registry.registerTyped("base", ({ words }) => {
        if (words.length !== 2) {
            throw new Error("BASE directive requires exactly one parameter.");
        }
        const text = words[1].trim();
        const off = text.toLowerCase() === "off";
        return { off, text, address: off ? undefined : parseDirectiveExpression(text) };
    }, syntaxRecord({
        off: syntaxBoolean,
        text: syntaxString,
        address: syntaxOptional(syntaxExpression),
    }), ({ off, text, address }) => {
        const { session, operandResolver } = context.base;
        if (off) {
            session.currentTargetAddress = session.currentTargetBaseAddress;
            session.currentTargetStartAddress = session.currentTargetBaseStartAddress;
            return;
        }
        if (!address) {
            throw new Error("Missing BASE expression.");
        }
        const value = operandResolver.getnum(address);
        const addressWidth = session.addressWidth;
        if (value < 0 || value > 2 ** addressWidth - 1) {
            throw new Error(`Invalid base address: ${text}. Must be within ${addressWidth} bits.`);
        }
        session.currentTargetAddress = value;
        session.currentTargetStartAddress = value;
    });
    registry.registerTyped("org", ({ words }) => {
        if (words.length !== 2) {
            throw new Error("ORG requires a single address parameter.");
        }
        return { address: parseDirectiveExpression(words[1].trim(), false), text: words[1] };
    }, syntaxRecord({ address: syntaxExpression, text: syntaxString }), ({ address, text }) => {
        context.org.runtime.executeOrg(address, text);
    });
    const emptySyntax = syntaxRecord({});
    registry.registerTyped("pushbase", empty, emptySyntax, () => handlePushBase(context.addressStack));
    registry.registerTyped("pullbase", empty, emptySyntax, () => handlePullBase(context.addressStack));
    registry.registerTyped("pushpc", empty, emptySyntax, () => context.runtime.runtime.handlePushPC());
    registry.registerTyped("pullpc", empty, emptySyntax, () => context.runtime.runtime.handlePullPC());
    registry.registerTyped("arch", ({ words }) => parseArchitectureName(words), syntaxRecord({ name: syntaxString }), ({ name }) => selectArchitecture(context.architecture, name));
};
/**
 * Registers the core layout directive group.
 * @param {DirectiveRegistry} registry The directive registry.
 * @param {DirectiveRegistryContexts["layout"]} context Layout-capable sessions and runtime.
 * @returns {void}
 */
export const registerLayoutDirectives = (registry, context) => {
    registerGenericLayoutDirectives(registry, context);
};
/** Public calls and source directives share CPU-name validation. */
const parseArchitectureName = (words) => {
    if (!words[1]) {
        throw new Error("ARCH command requires an architecture parameter.");
    }
    return { name: words[1].toLowerCase() };
};
//# sourceMappingURL=layout.js.map
import { syntaxLiteral, syntaxRecord, syntaxString, syntaxUnion } from "../ir/syntax-codec.js";
/**
 * Pushes the current namespace.
 * @param {NamespaceDirectiveContext} ctx The directive context.
 */
export const handlePushNamespace = ({ session }) => {
    session.namespaceStack.push(session.currentNamespace);
    if (session.namespaceNestingEnabled) {
        // Also save the nesting path
        session.namespaceStack.push(JSON.stringify(session.namespaceNestingPath));
    }
};
/**
 * Restores the previous namespace.
 * @param {NamespaceDirectiveContext} ctx The directive context.
 */
export const handlePullNamespace = ({ session }) => {
    if (session.namespaceStack.length === 0) {
        throw new Error("pullns without pushns");
    }
    if (session.namespaceNestingEnabled) {
        // Restore the nesting path first
        const pathJson = session.namespaceStack.pop();
        const parsedPath = JSON.parse(pathJson ?? "[]");
        session.namespaceNestingPath =
            Array.isArray(parsedPath) && parsedPath.every((entry) => typeof entry === "string")
                ? parsedPath
                : [];
    }
    session.currentNamespace = session.namespaceStack.pop() ?? "";
};
/**
 * Handles `namespace` definitions.
 * Example:
 * @example
 * namespace "identifier"
 * namespace identifier
 * @param {NamespaceDirectiveContext} ctx The directive context.
 * @param {string[]} words The words of the namespace command.
 */
export const handleNamespace = (ctx, words) => {
    executeNamespace(ctx, parseNamespace({ words }));
};
/**
 * Enters a namespace and records it as an outline container.
 * @param {NamespaceDirectiveContext["session"]} session The namespace session.
 * @param {string} name The namespace identifier being entered.
 */
function enterNamespace(session, name) {
    if (session.namespaceNestingEnabled) {
        session.namespaceNestingPath.push(name);
        session.currentNamespace = session.namespaceNestingPath.join("_");
    }
    else {
        session.currentNamespace = name;
    }
    const parent = session.namespaceNestingEnabled && session.namespaceNestingPath.length > 1
        ? session.namespaceNestingPath.slice(0, -1).join("_")
        : undefined;
    session.recordSymbolDefinition("namespace", session.currentNamespace, {
        containerName: parent || undefined,
    });
}
export const registerNamespaceDirectives = (registry, context) => {
    registry.registerTyped("namespace", parseNamespace, syntaxUnion(syntaxRecord({
        operation: syntaxUnion(syntaxLiteral("nest"), syntaxLiteral("unnest"), syntaxLiteral("clear"), syntaxLiteral("leave")),
    }), syntaxRecord({ operation: syntaxLiteral("enter"), name: syntaxString })), (payload) => executeNamespace(context, payload));
    registry.registerTyped("pushns", () => ({}), syntaxRecord({}), () => handlePushNamespace(context));
    registry.registerTyped("pullns", () => ({}), syntaxRecord({}), () => handlePullNamespace(context));
};
/** Shared source/public-entry grammar for `namespace`. */
const parseNamespace = ({ words }) => {
    const params = words.slice(1);
    if (params.length >= 2 && params[0].toLowerCase() === "nested") {
        const action = params[1].toLowerCase();
        if (action === "on" || action === "off") {
            return { operation: action === "on" ? "nest" : "unnest" };
        }
    }
    if (params.length === 0) {
        return { operation: "clear" };
    }
    if ((params.length === 1 && params[0].toLowerCase() === "off") ||
        params[1]?.toLowerCase() === "off") {
        return { operation: "leave" };
    }
    return { operation: "enter", name: params[0] };
};
/** Applies a parsed `namespace` operation to the current stage. */
const executeNamespace = (context, node) => {
    const { session } = context;
    switch (node.operation) {
        case "nest":
            session.namespaceNestingEnabled = true;
            break;
        case "unnest":
            session.namespaceNestingEnabled = false;
            session.namespaceNestingPath = [];
            session.currentNamespace = "";
            break;
        case "clear":
            if (session.namespaceNestingEnabled) {
                session.namespaceNestingPath = [];
            }
            session.currentNamespace = "";
            break;
        case "leave":
            if (session.namespaceNestingEnabled) {
                session.namespaceNestingPath.pop();
                session.currentNamespace = session.namespaceNestingPath.join("_");
            }
            else {
                session.currentNamespace = "";
            }
            break;
        case "enter":
            enterNamespace(session, node.name);
            break;
    }
};
//# sourceMappingURL=namespace.js.map
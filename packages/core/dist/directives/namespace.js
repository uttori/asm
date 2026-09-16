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
export const handleNamespace = ({ session }, words) => {
    const params = words.slice(1);
    // Handle namespace nesting directive
    if (params.length >= 2 && params[0].toLowerCase() === "nested") {
        const action = params[1].toLowerCase();
        if (action === "on") {
            session.namespaceNestingEnabled = true;
            return;
        }
        else if (action === "off") {
            session.namespaceNestingEnabled = false;
            session.namespaceNestingPath = [];
            session.currentNamespace = "";
            return;
        }
    }
    if (params.length === 0) {
        if (session.namespaceNestingEnabled) {
            session.namespaceNestingPath = [];
        }
        session.currentNamespace = "";
        return;
    }
    if (params.length === 1 && params[0].toLowerCase() === "off") {
        if (session.namespaceNestingEnabled) {
            // Pop the last namespace from the path
            session.namespaceNestingPath.pop();
            // Reconstruct the current namespace from the remaining path
            session.currentNamespace = session.namespaceNestingPath.join("_");
        }
        else {
            session.currentNamespace = "";
        }
        return;
    }
    else if (params.length === 1) {
        enterNamespace(session, params[0]);
        return;
    }
    const action = params[1].toLowerCase();
    if (action === "off") {
        if (session.namespaceNestingEnabled) {
            session.namespaceNestingPath.pop();
            session.currentNamespace = session.namespaceNestingPath.join("_");
        }
        else {
            session.currentNamespace = "";
        }
    }
    else {
        enterNamespace(session, params[0]);
    }
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
    registry.registerLowered("namespace", context, handleNamespace);
    registry.registerLowered("pushns", context, handlePushNamespace);
    registry.registerLowered("pullns", context, handlePullNamespace);
};
//# sourceMappingURL=namespace.js.map
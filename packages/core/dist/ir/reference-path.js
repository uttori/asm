/** Decompose syntax without rendering or reparsing; defines must bind before this boundary. */
export function referencePath(node) {
    const segments = [];
    let current = node;
    while (current.type === "member" || current.type === "index") {
        if (current.type === "member") {
            segments.push({ kind: "member", name: current.property.name });
        }
        else {
            segments.push({ kind: "index", expression: current.index });
        }
        current = current.object;
    }
    if (current.type !== "identifier") {
        return undefined;
    }
    return { root: current.name, segments: segments.toReversed() };
}
//# sourceMappingURL=reference-path.js.map
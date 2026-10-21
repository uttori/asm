import { sourceSpanToRange, shiftSourceSpan, } from "./source-location.js";
/** Relocate normalized offsets into a physical line only when the spelling has a unique match. */
export function sourceOccurrenceRange(location, sourceLine) {
    if (!location.span) {
        return undefined;
    }
    if (location.text === undefined) {
        return sourceSpanToRange(location.span, location.line);
    }
    if (sourceLine === undefined) {
        return undefined;
    }
    const offset = sourceLine.indexOf(location.text);
    // Repeated inline statements cannot be disambiguated from spelling alone. A line-level link
    // is more honest than pointing at the first unrelated occurrence after an editor change.
    if (offset < 0 || sourceLine.lastIndexOf(location.text) !== offset) {
        return undefined;
    }
    return sourceSpanToRange(shiftSourceSpan(location.span, offset, location.line), location.line);
}
/** Shared tooling projection; consumers need no macro parser to explain an expanded location. */
export function sourceOriginLocations(origin) {
    const locations = [];
    const visited = new Set();
    const visit = (frame) => {
        if (!frame || visited.has(frame)) {
            return;
        }
        visited.add(frame);
        if (frame.kind === "include") {
            locations.push({ message: `Included '${frame.file}' here`, location: frame.location });
        }
        else {
            locations.push({ message: `Macro '${frame.name}' invoked here`, location: frame.invocation });
            locations.push({ message: `Macro '${frame.name}' defined here`, location: frame.definition });
            locations.push({ message: "Expanded from this template", location: frame.template });
            for (const argument of frame.arguments) {
                locations.push({
                    message: `Argument ${argument.parameter ?? argument.index + 1}`,
                    location: argument.location,
                });
            }
            visit(frame.definitionContext);
        }
        visit(frame.parent);
    };
    visit(origin);
    return locations;
}
//# sourceMappingURL=source-provenance.js.map
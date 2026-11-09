import { sourceSpanToRange, } from "../source-location.js";
/**
 * Returns the source range for a located artifact, deriving it from the span
 * when an explicit range is not present.
 * @param location The artifact location.
 * @returns The resolved range, or undefined when no geometry exists.
 */
export function locationRange(location) {
    if (location.range) {
        return location.range;
    }
    if (location.span) {
        return sourceSpanToRange(location.span, location.span.line ?? location.line);
    }
    return undefined;
}
/**
 * Tests whether a position falls within a range (end-exclusive on the column).
 * @param position The zero-based position to test.
 * @param range The range to test against.
 * @returns True when the position is inside the range.
 */
export function positionInRange(position, range) {
    if (position.line < range.start.line || position.line > range.end.line) {
        return false;
    }
    if (position.line === range.start.line && position.character < range.start.character) {
        return false;
    }
    if (position.line === range.end.line && position.character > range.end.character) {
        return false;
    }
    return true;
}
/**
 * Finds the symbol reference whose range contains the given position. When
 * multiple match, the narrowest range wins so token-level spans beat line spans.
 * @param references The references to search.
 * @param position The position to resolve.
 * @returns The matching reference, if any.
 */
export function referenceAt(references, position) {
    return narrowestMatch(references, position);
}
/**
 * Finds the symbol definition whose range contains the given position.
 * @param symbols The symbols to search.
 * @param position The position to resolve.
 * @returns The matching symbol, if any.
 */
export function symbolAt(symbols, position) {
    return narrowestMatch(symbols, position);
}
/**
 * Resolves the definitions a reference points at, matching by name and a
 * compatible kind, falling back to a name-only match when no kind matches.
 * @param reference The reference to resolve.
 * @param allSymbols Every known symbol definition.
 * @returns The candidate definitions.
 */
export function resolveDefinition(reference, allSymbols) {
    const byName = allSymbols.filter((symbol) => symbol.name === reference.name);
    if (byName.length === 0) {
        return [];
    }
    const byKind = byName.filter((symbol) => kindMatches(reference.kind, symbol.kind));
    const candidates = byKind.length > 0 ? byKind : byName;
    if (reference.containerName) {
        const scoped = candidates.filter((symbol) => symbol.containerName === reference.containerName);
        if (scoped.length > 0) {
            return scoped;
        }
    }
    return candidates;
}
/**
 * Finds every reference that targets a given symbol name, optionally scoped to
 * a container.
 * @param name The symbol name.
 * @param allReferences Every known reference.
 * @param [containerName] Optional container scope.
 * @returns The matching references.
 */
export function findReferences(name, allReferences, containerName) {
    return allReferences.filter((reference) => reference.name === name &&
        (containerName === undefined || reference.containerName === containerName));
}
/**
 * Determines whether a reference kind can resolve to a symbol kind.
 * @param referenceKind The reference kind.
 * @param symbolKind The symbol kind.
 * @returns True when the reference can point at the symbol.
 */
function kindMatches(referenceKind, symbolKind) {
    switch (referenceKind) {
        case "label":
            return symbolKind === "label" || symbolKind === "structMember" || symbolKind === "struct";
        case "define":
            return symbolKind === "define";
        case "macro":
            return symbolKind === "macro";
        case "function":
            return symbolKind === "function" || symbolKind === "macro";
        case "include":
        case "instruction":
            return false;
        case "unknown":
        default:
            return true;
    }
}
/**
 * Returns the artifact with the narrowest containing range at a position.
 * @template T
 * @param located The located artifacts to search.
 * @param position The position to resolve.
 * @returns The narrowest matching artifact, if any.
 */
function narrowestMatch(located, position) {
    let best;
    let bestWidth = Number.POSITIVE_INFINITY;
    for (const item of located) {
        const range = locationRange(item.location);
        if (!range || !positionInRange(position, range)) {
            continue;
        }
        const width = rangeWidth(range);
        if (width < bestWidth) {
            best = item;
            bestWidth = width;
        }
    }
    return best;
}
/**
 * Computes a comparable width for a range so narrower matches can be preferred.
 * @param range The range to measure.
 * @returns A width metric (lines weighted heavily over columns).
 */
function rangeWidth(range) {
    const lineSpan = range.end.line - range.start.line;
    const columnSpan = range.end.character - range.start.character;
    return lineSpan * 1_000_000 + columnSpan;
}
//# sourceMappingURL=position-lookup.js.map
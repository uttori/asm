import type { AssemblySymbolDefinition, AssemblySymbolReference } from "../diagnostics.js";
import { type SourcePosition, type SourceRange, type SourceSpan } from "../source-location.js";
/**
 * The geometry-bearing subset of an assembler source location.
 */
export type LocatableLocation = {
    /** Optional precomputed source range. */
    range?: SourceRange;
    /** Optional source span used to derive a range. */
    span?: SourceSpan;
    /** Zero-based source line used as a fallback. */
    line: number;
};
/**
 * Returns the source range for a located artifact, deriving it from the span
 * when an explicit range is not present.
 * @param {LocatableLocation} location The artifact location.
 * @returns {SourceRange | undefined} The resolved range, or undefined when no geometry exists.
 */
export declare function locationRange(location: LocatableLocation): SourceRange | undefined;
/**
 * Tests whether a position falls within a range (end-exclusive on the column).
 * @param {SourcePosition} position The zero-based position to test.
 * @param {SourceRange} range The range to test against.
 * @returns {boolean} True when the position is inside the range.
 */
export declare function positionInRange(position: SourcePosition, range: SourceRange): boolean;
/**
 * Finds the symbol reference whose range contains the given position. When
 * multiple match, the narrowest range wins so token-level spans beat line spans.
 * @param {AssemblySymbolReference[]} references The references to search.
 * @param {SourcePosition} position The position to resolve.
 * @returns {AssemblySymbolReference | undefined} The matching reference, if any.
 */
export declare function referenceAt(references: AssemblySymbolReference[], position: SourcePosition): AssemblySymbolReference | undefined;
/**
 * Finds the symbol definition whose range contains the given position.
 * @param {AssemblySymbolDefinition[]} symbols The symbols to search.
 * @param {SourcePosition} position The position to resolve.
 * @returns {AssemblySymbolDefinition | undefined} The matching symbol, if any.
 */
export declare function symbolAt(symbols: AssemblySymbolDefinition[], position: SourcePosition): AssemblySymbolDefinition | undefined;
/**
 * Resolves the definitions a reference points at, matching by name and a
 * compatible kind, falling back to a name-only match when no kind matches.
 * @param {AssemblySymbolReference} reference The reference to resolve.
 * @param {AssemblySymbolDefinition[]} allSymbols Every known symbol definition.
 * @returns {AssemblySymbolDefinition[]} The candidate definitions.
 */
export declare function resolveDefinition(reference: AssemblySymbolReference, allSymbols: AssemblySymbolDefinition[]): AssemblySymbolDefinition[];
/**
 * Finds every reference that targets a given symbol name, optionally scoped to
 * a container.
 * @param {string} name The symbol name.
 * @param {AssemblySymbolReference[]} allReferences Every known reference.
 * @param {string} [containerName] Optional container scope.
 * @returns {AssemblySymbolReference[]} The matching references.
 */
export declare function findReferences(name: string, allReferences: AssemblySymbolReference[], containerName?: string): AssemblySymbolReference[];
//# sourceMappingURL=position-lookup.d.ts.map
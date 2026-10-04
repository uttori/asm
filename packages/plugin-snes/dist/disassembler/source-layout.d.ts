/**
 * Emit one field per line, with its reviewed description immediately above it.
 * Width applies to numeric array continuations; indivisible identifiers stay intact.
 * The prefix includes indentation and ends before the initializer's opening brace.
 * Callers validate width as an integer of at least 40 columns.
 * @param {string} prefix Declaration text before the opening brace.
 * @param {readonly {assignment: string; description?: string}[]} fields Ordered field initializers and optional prose.
 * @param {number} width Preferred columns for numeric array continuations.
 * @returns {string[]} Complete declaration lines, including braces.
 */
export declare const formatStructDeclaration: (prefix: string, fields: readonly {
    assignment: string;
    description?: string;
}[], width: number) => string[];
/**
 * Remove local research citations from display prose while retaining the explanation.
 * Curated metadata keeps the complete evidence. Only the conventional research/ paths
 * are recognized; ordinary links, file names and assembly text are not rewritten.
 * @param {string} text Unwrapped, single-line comment body.
 * @returns {string} Display prose with local research citations removed.
 */
export declare const omitResearchReferences: (text: string) => string;
/** Clean only actual assembly comments; quoted semicolons and source paths remain byte-exact.
 * @param {string} source Assembly before comment wrapping.
 * @returns {string} Assembly with evidence-only comment lines removed.
 */
export declare const omitAssemblyResearchReferences: (source: string) => string;
/**
 * Wrap assembly comments at whitespace without splitting words, URLs or assembly tokens.
 * Width includes indentation and `; `. Oversized inline comments move above their code;
 * existing line/paragraph boundaries and code indentation are retained. Fenced comment code
 * is verbatim, even beyond width; long prose words may also exceed width.
 * Callers validate width as an integer of at least 20 columns.
 * @param {string} source Assembly with original comment paragraph boundaries.
 * @param {number} width Preferred line width including indentation and comment marker.
 * @returns {string} Equivalent assembly with bounded comment lines.
 */
export declare const wrapAssemblyComments: (source: string, width: number) => string;
//# sourceMappingURL=source-layout.d.ts.map
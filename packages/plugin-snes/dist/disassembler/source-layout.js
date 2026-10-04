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
export const formatStructDeclaration = (prefix, fields, width) => {
    const indent = prefix.match(/^\s*/)?.[0] ?? "";
    const fieldIndent = `${indent}  `;
    const lines = [`${prefix}{`];
    for (const [index, field] of fields.entries()) {
        if (field.description) {
            lines.push(`${fieldIndent}; ${field.description}`);
        }
        const suffix = index === fields.length - 1 ? "" : ",";
        const parts = `${field.assignment}${suffix}`.split(/(?<=,) /);
        let line = fieldIndent;
        for (const part of parts) {
            // Only generated numeric arrays contain inner commas. Continuations remain inside
            // the field, so wrapping cannot associate a description with the following field.
            if (line !== fieldIndent && line.length + 1 + part.length > width) {
                lines.push(line);
                line = `${fieldIndent}  `;
            }
            line += `${line.trim() ? " " : ""}${part}`;
        }
        lines.push(line);
    }
    lines.push(`${indent}}`);
    return lines;
};
/** Find a real assembly comment, leaving semicolons inside quoted text untouched.
 * @param {string} line One assembly source line.
 * @returns {number} Semicolon index, or -1 when there is no comment.
 */
const commentOffset = (line) => {
    let quote = "";
    for (let index = 0; index < line.length; index++) {
        const character = line[index];
        if (quote) {
            if (character === "\\") {
                index++;
            }
            else if (character === quote) {
                quote = "";
            }
        }
        else if (character === '"' || character === "'") {
            quote = character;
        }
        else if (character === ";") {
            return index;
        }
    }
    return -1;
};
/**
 * Transform prose comments while retaining standalone Markdown code fences verbatim.
 * Fences cannot cross an assembly instruction or a non-comment line; malformed metadata
 * therefore cannot suppress formatting in the next code block.
 * @param {string} source Assembly with semicolon-prefixed comment lines.
 * @param {(line: string, offset: number) => string[]} transform Prose transform; offset is -1 without a real comment.
 * @returns {string} Source with fenced comment whitespace and contents unchanged.
 */
const mapAssemblyCommentProse = (source, transform) => {
    const output = [];
    let fence;
    for (const line of source.split("\n")) {
        const offset = commentOffset(line);
        if (offset < 0 || line.slice(0, offset).trim()) {
            // Only standalone comment runs own fences; inline comments still follow normal rules.
            fence = undefined;
            output.push(...transform(line, offset));
            continue;
        }
        const delimiter = line
            .slice(offset + 1)
            .trim()
            .match(/^(`{3,}|~{3,})(.*)$/);
        if (fence) {
            output.push(line);
            // Info strings and shorter/different markers are code, not closing delimiters.
            if (delimiter &&
                delimiter[1][0] === fence.marker &&
                delimiter[1].length >= fence.length &&
                !delimiter[2].trim()) {
                fence = undefined;
            }
            continue;
        }
        if (delimiter) {
            fence = { marker: delimiter[1][0], length: delimiter[1].length };
            output.push(line);
            continue;
        }
        output.push(...transform(line, offset));
    }
    return output.join("\n");
};
/**
 * Remove local research citations from display prose while retaining the explanation.
 * Curated metadata keeps the complete evidence. Only the conventional research/ paths
 * are recognized; ordinary links, file names and assembly text are not rewritten.
 * @param {string} text Unwrapped, single-line comment body.
 * @returns {string} Display prose with local research citations removed.
 */
export const omitResearchReferences = (text) => text
    .replaceAll(/\[[^\]]*]\((?:\.\.\/)*research\/[^)]+\)/g, "")
    .replaceAll(/\b(?:research:|source:|recomputed in|see also|see)\s*(?=(?:\.\.\/)*research\/)/gi, "")
    .replaceAll(/(?:\.\.\/)*research\/[\w#./:-]+/gi, "")
    .replaceAll(/(?:research|source):\s*(?=[.;]|$)/gi, "")
    .replaceAll(/\(\s*\)/g, "")
    .replaceAll(/\b[\w-]+:\s*(?=;)/g, "")
    .replaceAll(/\s+([,.;])/g, "$1")
    .replaceAll(/([.;])[,;]/g, "$1")
    .replaceAll(/([.;])\1+/g, "$1")
    .replaceAll(/\s+/g, " ")
    .replaceAll(/^[,.;]\s*|\s*[,;]$/g, "")
    .trim();
/** Clean only actual assembly comments; quoted semicolons and source paths remain byte-exact.
 * @param {string} source Assembly before comment wrapping.
 * @returns {string} Assembly with evidence-only comment lines removed.
 */
export const omitAssemblyResearchReferences = (source) => mapAssemblyCommentProse(source, (line, offset) => {
    if (offset < 0) {
        return [line];
    }
    const body = line.slice(offset + 1);
    if (!/(?:\.\.\/)*research\//i.test(body)) {
        return [line];
    }
    const comment = omitResearchReferences(body);
    if (comment) {
        return [`${line.slice(0, offset)}; ${comment}`];
    }
    const code = line.slice(0, offset).trimEnd();
    return code ? [code] : [];
});
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
export const wrapAssemblyComments = (source, width) => mapAssemblyCommentProse(source, (line, offset) => {
    if (offset < 0 || line.length <= width) {
        return [line];
    }
    const code = line.slice(0, offset).trimEnd();
    const indent = line.match(/^\s*/)?.[0] ?? "";
    const prefix = `${indent}; `;
    const words = line
        .slice(offset + 1)
        .trim()
        .split(/\s+/);
    const wrapped = [];
    let current = prefix;
    for (const word of words) {
        if (current !== prefix && current.length + 1 + word.length > width) {
            wrapped.push(current);
            current = prefix;
        }
        current += `${current === prefix ? "" : " "}${word}`;
    }
    wrapped.push(current);
    if (code) {
        wrapped.push(code);
    }
    return wrapped;
});
//# sourceMappingURL=source-layout.js.map
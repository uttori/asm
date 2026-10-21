import { parseAssetCall } from "@uttori/asm-core";
/** Mask comments while preserving UTF-16 offsets. Quoted semicolons and escaped quotes remain literal syntax. */
function maskComments(text) {
    let quote = "", comment = false, result = "";
    for (let index = 0; index < text.length; index++) {
        const character = text[index];
        if (character === "\n") {
            comment = false;
            result += character;
        }
        else if (comment) {
            result += " ";
        }
        else if (quote) {
            result += character;
            if (character === "\\" && index + 1 < text.length) {
                result += text[++index];
            }
            else if (character === quote) {
                quote = "";
            }
        }
        else if (character === '"' || character === "'") {
            quote = character;
            result += character;
        }
        else if (character === ";") {
            comment = true;
            result += " ";
        }
        else {
            result += character;
        }
    }
    return result;
}
/** Resolve a multiline call attributed to a one-based emitted source line; ambiguous same-line calls fail. */
export function locateAssetCall(text, line) {
    const lines = text.split(/(?<=\n)/);
    if (!Number.isSafeInteger(line) || line < 1 || line > lines.length) {
        throw new Error("Asset conversion has a stale source line.");
    }
    const start = lines.slice(0, line - 1).join("").length;
    let source = "";
    for (let count = 0; count < 4096 && line - 1 + count < lines.length; count++) {
        source += lines[line - 1 + count];
        const masked = maskComments(source);
        // The structural parser knows nested arrays/objects and quoted delimiters; truncation simply requests another line.
        let call;
        try {
            call = parseAssetCall(masked.trimEnd());
        }
        catch {
            continue;
        }
        if (!call) {
            throw new Error("Asset attribution does not identify a literal includeAsset call; macro expansion requires an explicit source edit.");
        }
        const offset = (span) => ({
            start: start + span.start,
            end: start + span.end,
        });
        return {
            ...offset(call.span),
            path: offset(call.path.span),
            options: Object.fromEntries(Object.entries(call.options).map(([name, node]) => [name, offset(node.span)])),
        };
    }
    throw new Error("Asset attribution has an incomplete or ambiguous includeAsset call.");
}
/** Replace the selected operand, never a shared define. Existing option values and comments keep their original positions. */
export function editAssetCall(text, location, options) {
    const edits = [];
    if (options.path !== undefined) {
        edits.push({ ...location.path, value: JSON.stringify(options.path) });
    }
    const additions = [];
    for (const [name, value] of Object.entries(options.values ?? {})) {
        const span = location.options[name];
        if (span) {
            edits.push({ ...span, value: JSON.stringify(value) });
        }
        else {
            additions.push(`${name}: ${JSON.stringify(value)}`);
        }
    }
    if (additions.length) {
        edits.push({
            start: location.end - 1,
            end: location.end - 1,
            value: `${maskComments(text.slice(location.start, location.end - 1))
                .trimEnd()
                .endsWith(",")
                ? ""
                : ","} ${additions.join(", ")}`,
        });
    }
    for (const edit of edits.toSorted((a, b) => b.start - a.start)) {
        text = text.slice(0, edit.start) + edit.value + text.slice(edit.end);
    }
    return text;
}
//# sourceMappingURL=asset-source-edits.js.map
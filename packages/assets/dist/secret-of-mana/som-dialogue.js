import { encodeSomDialogueCommand } from "./som-dialogue-command.js";
/** The USA decoder indexes 61 little-endian pairs, including the overlapping short/long codes. */
export const SOM_DIALOGUE_PAIR_COUNT = 61;
const MAX_GLYPHS = 4096;
const punctuation = new Map([
    [0xbf, "."],
    [0xc0, ","],
    [0xc1, "/"],
    [0xc2, "'"],
    [0xc5, ":"],
    [0xc6, "-"],
    [0xc7, "%"],
    [0xc8, "!"],
    [0xca, "?"],
]);
/** Validate a complete dictionary before decoding; unresolved font codes remain escaped. */
export function readSomDialogueDictionary(bytes) {
    if (bytes.length !== SOM_DIALOGUE_PAIR_COUNT * 2 ||
        bytes.some((byte) => byte < 0x80 || byte > 0xd2)) {
        throw new Error("SoM dialogue requires 61 pairs of ordinary font codes.");
    }
    return Array.from({ length: SOM_DIALOGUE_PAIR_COUNT }, (_, i) => [bytes[i * 2], bytes[i * 2 + 1]]);
}
/** Convert an ordinary font code to ASCII; ambiguous or unidentified glyphs keep their exact byte. */
function glyphText(byte) {
    if (byte === 0x7f) {
        return "\n";
    }
    if (byte === 0x80) {
        return " ";
    }
    if (byte >= 0x81 && byte <= 0x9a) {
        return String.fromCharCode(byte - 0x81 + 97);
    }
    if (byte >= 0x9b && byte <= 0xb4) {
        return String.fromCharCode(byte - 0x9b + 65);
    }
    if (byte >= 0xb5 && byte <= 0xbe) {
        return String.fromCharCode(byte - 0xb5 + 48);
    }
    return punctuation.get(byte) ?? `\\x${byte.toString(16).padStart(2, "0").toUpperCase()}`;
}
/** Expand text only. Controls below 60 and the decoder's underflowing 5F case are rejected. */
export function expandSomDialogue(bytes, dictionary) {
    const output = [];
    for (const byte of bytes) {
        let index;
        if (byte >= 0x60 && byte <= 0x7e) {
            index = byte - 0x60;
        }
        else if (byte >= 0xd3) {
            index = byte - 0xc3;
        }
        if (index !== undefined) {
            const pair = dictionary[index];
            if (!pair) {
                throw new Error(`Missing SoM dialogue pair ${index}.`);
            }
            output.push(...pair);
        }
        else {
            if (byte < 0x7f) {
                throw new Error(`Event/control byte ${byte.toString(16)} is outside a text span.`);
            }
            output.push(byte);
        }
    }
    return Uint8Array.from(output);
}
/** Decode a bounded literal/DTE span without merging event commands into the visible text. */
export function decodeSomDialogue(bytes, dictionary) {
    return [...expandSomDialogue(bytes, dictionary)].map(glyphText).join("");
}
/** ASCII escapes select one native glyph; they cannot introduce commands or compressed aliases. */
function parseGlyphs(text) {
    const inverse = new Map(Array.from({ length: 0x54 }, (_, i) => i + 0x7f)
        .filter((byte) => !glyphText(byte).startsWith("\\"))
        .map((byte) => [glyphText(byte), byte]));
    const bytes = [];
    for (let offset = 0; offset < text.length;) {
        if (text[offset] === "\\") {
            const match = /^\\x([\da-f]{2})/i.exec(text.slice(offset));
            if (!match) {
                throw new Error(`Invalid dialogue escape at character ${offset}.`);
            }
            const byte = Number.parseInt(match[1], 16);
            if (byte < 0x7f || byte > 0xd2) {
                throw new Error("Dialogue escapes must select an ordinary glyph or line break.");
            }
            bytes.push(byte);
            offset += 4;
        }
        else {
            const byte = inverse.get(text[offset]);
            if (byte === undefined) {
                throw new Error(`Unsupported dialogue character at ${offset}; use a verified glyph escape.`);
            }
            bytes.push(byte);
            offset++;
        }
    }
    if (bytes.length > MAX_GLYPHS) {
        throw new Error("Dialogue span exceeds the 4096-glyph authoring limit.");
    }
    return bytes;
}
/** Reject impossible geometry instead of treating allocation size as visible width. */
function validateLineGeometry(options) {
    const { lineColumns, initialColumn } = options;
    if (lineColumns === undefined) {
        if (initialColumn !== undefined) {
            throw new Error("Initial dialogue column requires a line capacity.");
        }
        return;
    }
    if (!Number.isSafeInteger(lineColumns) || lineColumns < 1 || lineColumns > 32) {
        throw new Error("Dialogue line capacity must be an integer from 1 to 32 glyphs.");
    }
    if (initialColumn !== undefined &&
        (!Number.isSafeInteger(initialColumn) || initialColumn < 0 || initialColumn >= lineColumns)) {
        throw new Error("Initial dialogue column must be within the supplied line capacity.");
    }
}
/**
 * Encode with a deterministic mix of literal and dual-tile bytes. An exact budget can deliberately
 * leave pairs literal; shortest-first greedy packing cannot solve every fixed-address edit.
 * Throws when no encoding fits, rather than padding text or moving pointers implicitly.
 */
export function encodeSomDialogue(text, dictionary, options = {}) {
    const glyphs = parseGlyphs(text);
    validateLineGeometry(options);
    if (options.literal !== undefined && typeof options.literal !== "boolean") {
        throw new Error("Dialogue literal policy must be boolean.");
    }
    if (options.literal === true) {
        // Indexed alphabet/codebook consumers read byte cells, not decoder output.
        // Compression could satisfy the total budget while moving every following cell.
        if (options.original?.some((byte) => byte < 0x7f || byte > 0xd2)) {
            throw new Error("Literal dialogue requires uncompressed native glyphs.");
        }
        if (options.byteLength !== undefined &&
            (!Number.isSafeInteger(options.byteLength) ||
                options.byteLength < 0 ||
                options.byteLength > MAX_GLYPHS)) {
            throw new Error("Dialogue byte budget must be an integer from 0 to 4096.");
        }
        if (options.byteLength !== undefined && glyphs.length !== options.byteLength) {
            throw new Error(`Literal dialogue cannot fit its exact ${options.byteLength}-byte glyph cells.`);
        }
        return Uint8Array.from(glyphs);
    }
    const pairs = new Map();
    for (let code = 0x60; code <= 0xff; code++) {
        // 7D is also a window-mode command at a stream entry. Its E0 alias is safe
        // in both entry and interior text contexts; untouched originals retain their alias.
        if (code === 0x7d) {
            continue;
        }
        let index;
        if (code <= 0x7e) {
            index = code - 0x60;
        }
        else if (code >= 0xd3) {
            index = code - 0xc3;
        }
        if (index === undefined) {
            continue;
        }
        const pair = dictionary[index];
        if (!pair) {
            throw new Error(`Missing SoM dialogue pair ${index}.`);
        }
        const key = pair[0] | (pair[1] << 8);
        if (!pairs.has(key)) {
            pairs.set(key, code);
        }
    }
    let target = options.byteLength;
    if (target !== undefined &&
        (!Number.isSafeInteger(target) || target < 0 || target > MAX_GLYPHS)) {
        throw new Error("Dialogue byte budget must be an integer from 0 to 4096.");
    }
    if (options.original && decodeSomDialogue(options.original, dictionary) === text) {
        if (target !== undefined && target !== options.original.length) {
            throw new Error("Original dialogue disagrees with byte budget.");
        }
        return options.original.slice();
    }
    const columns = new Uint8Array(glyphs.length);
    if (options.lineColumns !== undefined) {
        let column = options.initialColumn ?? 0;
        for (const [index, glyph] of glyphs.entries()) {
            columns[index] = column;
            if (glyph === 0x7f) {
                column = 0;
            }
            else {
                column = (column + 1) % options.lineColumns;
            }
        }
    }
    const pairAt = (i) => {
        if (i + 1 >= glyphs.length) {
            return undefined;
        }
        // Capacity exhaustion unwinds the native pair helper after its first glyph.
        // The compressed byte has already been consumed, so the second glyph is lost.
        if (options.lineColumns !== undefined && columns[i] === options.lineColumns - 1) {
            return undefined;
        }
        return pairs.get(glyphs[i] | (glyphs[i + 1] << 8));
    };
    if (target === undefined) {
        const minimum = new Uint16Array(glyphs.length + 1);
        for (let i = glyphs.length - 1; i >= 0; i--) {
            minimum[i] = minimum[i + 1] + 1;
            if (pairAt(i) !== undefined) {
                minimum[i] = Math.min(minimum[i], minimum[i + 2] + 1);
            }
        }
        target = minimum[0];
    }
    // A 4096-glyph/budget ceiling bounds this exact-fit table to about 16 MiB.
    // Each state records suffix reachability, so reconstruction never guesses an unavailable fit.
    const width = target + 1, possible = new Uint8Array((glyphs.length + 1) * width);
    possible[glyphs.length * width] = 1;
    for (let i = glyphs.length - 1; i >= 0; i--) {
        for (let count = 1; count <= target; count++) {
            if (possible[(i + 1) * width + count - 1] ||
                (pairAt(i) !== undefined && possible[(i + 2) * width + count - 1])) {
                possible[i * width + count] = 1;
            }
        }
    }
    if (!possible[target]) {
        throw new Error(`Dialogue cannot fit its exact ${target}-byte ROM span; relocation or a different edit is required.`);
    }
    const encoded = [];
    for (let i = 0, remaining = target; i < glyphs.length; remaining--) {
        const pair = pairAt(i);
        if (pair !== undefined && possible[(i + 2) * width + remaining - 1]) {
            encoded.push(pair);
            i += 2;
        }
        else {
            encoded.push(glyphs[i++]);
        }
    }
    return Uint8Array.from(encoded);
}
/** Preview native hard wrapping and report compressed pairs whose second glyph is discarded. */
export function previewSomDialogue(bytes, dictionary, options) {
    validateLineGeometry(options);
    const lines = [], dropped = [];
    let glyphs = [], initialColumn = options.initialColumn ?? 0, column = initialColumn;
    const finish = (ending) => {
        lines.push({ text: glyphs.map(glyphText).join(""), glyphs, initialColumn, ending });
        glyphs = [];
        initialColumn = 0;
        column = 0;
    };
    for (const [byteOffset, byte] of bytes.entries()) {
        if (byte === 0x7f) {
            finish("line-break");
            continue;
        }
        const expanded = expandSomDialogue(Uint8Array.of(byte), dictionary);
        for (const [index, glyph] of expanded.entries()) {
            glyphs.push(glyph);
            column++;
            if (column === options.lineColumns) {
                // The native helper returns from the line parser, rather than replaying a
                // partially consumed DTE token on the following line.
                if (index + 1 < expanded.length) {
                    dropped.push({ byteOffset, glyph: expanded[index + 1] });
                }
                finish("capacity");
                break;
            }
        }
    }
    if (glyphs.length || lines.length === 0) {
        finish("end");
    }
    return { lines, dropped, pixelWidth: options.lineColumns * 8, glyphHeight: 12 };
}
/** Reject malformed sidecars before any bytes are emitted. Hex is explicit; whitespace is never discarded. */
function hexBytes(value) {
    if (typeof value !== "string" ||
        value.length > MAX_GLYPHS * 2 ||
        value.length % 2 !== 0 ||
        /[^\da-f]/i.test(value)) {
        throw new Error("Invalid or oversized native dialogue hex.");
    }
    return Uint8Array.from(value.match(/../g) ?? [], (pair) => Number.parseInt(pair, 16));
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
/** Check JSON field types only; byte bounds, ordering and native command agreement are checked below. */
function hasDialogueLayoutShape(value) {
    return (isRecord(value) &&
        value.format === "som-dialogue-script" &&
        value.version === 1 &&
        typeof value.dictionaryHex === "string" &&
        Array.isArray(value.segments) &&
        value.segments.length > 0 &&
        value.segments.length <= MAX_GLYPHS &&
        value.segments.every((segment) => isRecord(segment) &&
            (segment.kind === "raw" || segment.kind === "text") &&
            typeof segment.nativeHex === "string" &&
            (segment.literal === undefined || typeof segment.literal === "boolean") &&
            (segment.lineColumns === undefined || typeof segment.lineColumns === "number") &&
            (segment.initialColumn === undefined || typeof segment.initialColumn === "number") &&
            (segment.commands === undefined ||
                (Array.isArray(segment.commands) &&
                    segment.commands.length <= MAX_GLYPHS &&
                    segment.commands.every((slot) => isRecord(slot) &&
                        typeof slot.offset === "number" &&
                        typeof slot.token === "string" &&
                        (slot.editable === undefined || typeof slot.editable === "boolean"))))));
}
/** Validate the versioned sidecar and every text span, including unused source chunks. */
export function readSomDialogueScriptLayout(value) {
    // Keep JSON values unknown until every nested field is checked; Array.isArray alone admits any[].
    if (!hasDialogueLayoutShape(value)) {
        throw new Error("Invalid SoM dialogue-script layout.");
    }
    const dictionary = readSomDialogueDictionary(hexBytes(value.dictionaryHex));
    let total = 0;
    for (const [index, segment] of value.segments.entries()) {
        if (index > 0 && segment.kind === value.segments[index - 1].kind) {
            throw new Error("Dialogue segments must alternate raw/text.");
        }
        const bytes = hexBytes(segment.nativeHex);
        if (!bytes.length || bytes.length > MAX_GLYPHS) {
            throw new Error("Invalid dialogue segment size.");
        }
        if (segment.literal !== undefined && segment.kind !== "text") {
            throw new Error("Literal dialogue policy requires a text segment and boolean value.");
        }
        if (segment.literal === true && bytes.some((byte) => byte < 0x7f || byte > 0xd2)) {
            throw new Error("Literal dialogue requires uncompressed native glyphs.");
        }
        // Compressed native spans can expand to twice their byte length. Reject layouts
        // whose exported glyph count exceeds the same limit used by the authoring packer.
        if (segment.kind === "text") {
            parseGlyphs(decodeSomDialogue(bytes, dictionary));
            validateLineGeometry(segment);
        }
        else if (segment.lineColumns !== undefined || segment.initialColumn !== undefined) {
            throw new Error("Raw dialogue commands cannot carry text geometry.");
        }
        if (segment.commands !== undefined) {
            if (segment.kind !== "raw" || segment.commands.length > bytes.length) {
                throw new Error("Named dialogue commands require a bounded raw segment.");
            }
            let end = 0;
            for (const slot of segment.commands) {
                if (!Number.isSafeInteger(slot.offset) || slot.offset < end) {
                    throw new Error("Invalid or overlapping dialogue command slot.");
                }
                const command = encodeSomDialogueCommand(slot.token);
                end = slot.offset + command.bytes.length;
                if (end > bytes.length ||
                    !command.bytes.every((byte, i) => byte === bytes[slot.offset + i])) {
                    throw new Error("Named dialogue command disagrees with its native bytes.");
                }
            }
        }
        total += bytes.length;
    }
    if (total > 65536) {
        throw new Error("Dialogue script exceeds one ROM bank.");
    }
    return value;
}
/** Split explicitly admitted commands from opaque bytes; their original raw owner stays intact. */
function rawParts(segment, index) {
    const native = hexBytes(segment.nativeHex), parts = [];
    let cursor = 0, opaque = 0;
    for (const slot of segment.commands ?? []) {
        if (slot.offset > cursor) {
            parts.push({
                marker: `{raw:${index}:${opaque++}}`,
                bytes: native.slice(cursor, slot.offset),
            });
        }
        const bytes = encodeSomDialogueCommand(slot.token).bytes;
        parts.push({ marker: slot.token, bytes, slot });
        cursor = slot.offset + bytes.length;
    }
    if (cursor < native.length) {
        let marker = `{raw:${index}}`;
        if (segment.commands?.length) {
            marker = `{raw:${index}:${opaque}}`;
        }
        parts.push({ marker, bytes: native.slice(cursor) });
    }
    return parts;
}
/** Export printable text with reviewed command tokens and opaque markers; only a final marker's LF is cosmetic. */
export function exportSomDialogueScript(layout) {
    readSomDialogueScriptLayout(layout);
    const dictionary = readSomDialogueDictionary(hexBytes(layout.dictionaryHex));
    let raw = 0;
    let text = layout.segments
        .map((segment) => segment.kind === "raw"
        ? rawParts(segment, raw++)
            .map((part) => part.marker)
            .join("")
        : decodeSomDialogue(hexBytes(segment.nativeHex), dictionary))
        .join("");
    if (layout.segments.at(-1)?.kind === "raw") {
        text += "\n";
    }
    return text;
}
/**
 * Pack a script without selecting ROM storage. Variable text sizes are opt-in for a separate
 * relocation planner; the asset converter always keeps fixed budgets. Commands retain their
 * admitted family, width and order. The returned map does not imply that an edited text's
 * interior references can be relocated safely.
 */
export function packSomDialogueScript(source, layout, sizing = "fixed") {
    if (!["fixed", "variable"].includes(sizing)) {
        throw new Error("Invalid dialogue field sizing policy.");
    }
    if (source.some((byte) => byte > 127)) {
        throw new Error("SoM dialogue source must be ASCII.");
    }
    readSomDialogueScriptLayout(layout);
    const dictionary = readSomDialogueDictionary(hexBytes(layout.dictionaryHex));
    let text = new TextDecoder().decode(source).replaceAll("\r\n", "\n");
    if (text.includes("\r")) {
        throw new Error("Bare carriage returns are not dialogue line breaks.");
    }
    if (layout.segments.at(-1)?.kind === "raw" && text.endsWith("\n")) {
        text = text.slice(0, -1);
    }
    const chunks = [], segments = [];
    let cursor = 0, raw = 0, nativePreserved = true, originalOffset = 0, outputOffset = 0;
    for (const segment of layout.segments) {
        const original = hexBytes(segment.nativeHex);
        const firstChunk = chunks.length;
        if (segment.kind === "raw") {
            const index = raw++, legacy = `{raw:${index}}`;
            // Existing sources remain valid after adding command names to their layouts.
            // A legacy whole-block marker deliberately requests the unchanged native bytes.
            if (text.startsWith(legacy, cursor)) {
                cursor += legacy.length;
                chunks.push(original);
            }
            else {
                for (const part of rawParts(segment, index)) {
                    if (!part.slot) {
                        if (!text.startsWith(part.marker, cursor)) {
                            throw new Error(`Missing or reordered command marker ${part.marker}.`);
                        }
                        cursor += part.marker.length;
                        chunks.push(part.bytes);
                        continue;
                    }
                    const match = /^\${[^{}]+}/.exec(text.slice(cursor));
                    if (!match) {
                        throw new Error(`Missing dialogue command ${part.slot.token}.`);
                    }
                    const command = encodeSomDialogueCommand(match[0]), expected = encodeSomDialogueCommand(part.slot.token);
                    if (command.family !== expected.family || command.bytes.length !== part.bytes.length) {
                        throw new Error("Dialogue command edit changed its admitted family or width.");
                    }
                    const preserved = command.bytes.every((byte, i) => byte === part.bytes[i]);
                    if (part.slot.editable === false && !preserved) {
                        throw new Error("Dialogue command slot is read-only.");
                    }
                    nativePreserved &&= preserved;
                    chunks.push(command.bytes);
                    cursor += match[0].length;
                }
            }
        }
        else {
            // A named token is a boundary, never a glyph substitution performed by this
            // offline packer. The next raw slot validates its exact family and parameters.
            const boundaries = [text.indexOf("{raw:", cursor), text.indexOf("${", cursor)].filter((index) => index >= 0);
            const end = boundaries.length ? Math.min(...boundaries) : text.length;
            let byteLength;
            // Literal spans describe indexed cells. A relocation plan may resize ordinary
            // decoder text, but cannot change this table's cell count or interior indexes.
            if (sizing === "fixed" || segment.literal === true) {
                byteLength = original.length;
            }
            const encoded = encodeSomDialogue(text.slice(cursor, end), dictionary, {
                original,
                byteLength,
                lineColumns: segment.lineColumns,
                initialColumn: segment.initialColumn,
                literal: segment.literal,
            });
            nativePreserved &&=
                encoded.length === original.length &&
                    encoded.every((byte, index) => byte === original[index]);
            chunks.push(encoded);
            cursor = end;
        }
        const emitted = chunks.slice(firstChunk);
        const length = emitted.reduce((sum, chunk) => sum + chunk.length, 0);
        let position = 0;
        const preserved = length === original.length &&
            emitted.every((chunk) => {
                const matches = chunk.every((byte, index) => byte === original[position + index]);
                position += chunk.length;
                return matches;
            });
        segments.push({
            kind: segment.kind,
            originalOffset,
            originalLength: original.length,
            offset: outputOffset,
            length,
            preserved,
        });
        originalOffset += original.length;
        outputOffset += length;
    }
    if (cursor !== text.length) {
        throw new Error("Unexpected text after the final command marker.");
    }
    const bytes = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
    if (bytes.length > 65536) {
        throw new Error("Packed dialogue script exceeds one ROM bank.");
    }
    let offset = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
    }
    return { bytes, segments, nativePreserved, fixedFieldOffsets: sizing === "fixed" };
}
/** Build a fixed-address include; variable sizing is available only through explicit relocation planning. */
export function convertSomDialogueScript(source, options, resources) {
    if (typeof options.layout !== "string" || !Object.hasOwn(resources, options.layout)) {
        throw new Error("Dialogue layout resource is required.");
    }
    const layout = readSomDialogueScriptLayout(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(resources[options.layout].bytes)));
    const result = packSomDialogueScript(source.bytes, layout);
    const output = {
        bytes: result.bytes,
        mediaType: "application/octet-stream",
        metadata: {
            nativePreserved: result.nativePreserved,
            fixedFieldOffsets: result.fixedFieldOffsets,
        },
    };
    return { primaryOutput: "script", outputs: { script: output } };
}
//# sourceMappingURL=som-dialogue.js.map
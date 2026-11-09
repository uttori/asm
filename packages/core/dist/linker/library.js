import { decodeEnvelope, encodeEnvelope } from "./envelope.js";
import { decodeObject } from "./object.js";
import { artifactHash, integer, list, record, stableJson, textValue } from "./value.js";
const MAGIC = "UASMLIB\0";
/** Bumps when archive metadata layout is incompatible with prior readers. */
export const LIBRARY_FORMAT_VERSION = 1;
/** Build an indexed archive of complete native objects. Member identities and exports are derived, not supplied. */
export function encodeLibrary(inputs) {
    const names = new Set();
    let length = 0;
    const members = inputs.map((input) => {
        textValue(input.name, "Library member name");
        if (names.has(input.name)) {
            throw new Error(`Duplicate library member '${input.name}'.`);
        }
        names.add(input.name);
        const module = decodeObject(input.object);
        const offset = length;
        length += input.object.length;
        return {
            name: input.name,
            module: module.id,
            sha256: artifactHash(input.object),
            offset,
            size: input.object.length,
            exports: exportsOf(module),
        };
    });
    if (length > 240 * 1024 * 1024) {
        throw new Error("Library payload exceeds 240 MiB.");
    }
    const payload = new Uint8Array(length);
    inputs.forEach((input, index) => payload.set(input.object, members[index].offset));
    return encodeEnvelope(MAGIC, { members, index: indexOf(members) }, payload);
}
/** Authenticate every member/index once, then reuse parsed modules during fixed-point extraction. */
export function decodeLibrary(bytes) {
    const { metadata, payload } = decodeEnvelope(bytes, MAGIC);
    const header = record(metadata, "Library metadata");
    const names = new Set();
    let consumed = 0;
    const members = list(header.members, "Library members").map((item) => {
        const member = record(item, "Library member");
        const name = textValue(member.name, "Library member name");
        if (names.has(name)) {
            throw new Error(`Duplicate library member '${name}'.`);
        }
        names.add(name);
        const offset = integer(member.offset, "Member offset", 0, payload.length);
        const size = integer(member.size, "Member size", 0, payload.length - offset);
        if (offset !== consumed) {
            throw new Error("Noncanonical library member extents.");
        }
        consumed += size;
        const object = payload.slice(offset, offset + size);
        const sha256 = artifactHash(object);
        if (sha256 !== member.sha256) {
            throw new Error(`Library member '${name}' hash mismatch.`);
        }
        const module = decodeObject(object);
        const exports = exportsOf(module);
        if (module.id !== member.module || stableJson(exports) !== stableJson(member.exports)) {
            throw new Error(`Library member '${name}' export index mismatch.`);
        }
        return { name, object, module, sha256, exports };
    });
    if (consumed !== payload.length || stableJson(header.index) !== stableJson(indexOf(members))) {
        throw new Error("Library index or payload mismatch.");
    }
    return { members, index: new Map(indexOf(members)) };
}
/** Code-unit sorting avoids platform-locale differences in persistent indexes. */
function exportsOf(module) {
    return module.symbols
        .filter((symbol) => symbol.visibility === "export")
        .map((symbol) => symbol.name)
        .toSorted();
}
/** Builds a sorted export-name index mapping to member positions. */
function indexOf(members) {
    const index = new Map();
    members.forEach((member, position) => {
        for (const name of member.exports) {
            const entries = index.get(name) ?? [];
            entries.push(position);
            index.set(name, entries);
        }
    });
    return [...index].toSorted(([a], [b]) => (a < b ? -1 : Number(a > b)));
}
//# sourceMappingURL=library.js.map
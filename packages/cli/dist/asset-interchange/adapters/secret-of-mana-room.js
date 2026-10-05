import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ASSET_LIMITS, boundedSum } from "@uttori/asm-assets/limits";
import { parseRoomAsset, encodeRoomSection, parseRoomPreview, } from "@uttori/asm-assets/secret-of-mana/som-room-assets";
import { composeSomRoom, somRoomPaletteWord, } from "@uttori/asm-assets/secret-of-mana/som-room-composition";
import { createSomRoomInterchange, } from "@uttori/asm-assets/secret-of-mana/som-room-interchange";
import { loadSomRoomNative, } from "@uttori/asm-assets/secret-of-mana/som-room-native";
import { encodePlanarTiles } from "@uttori/asm-assets/snes";
import { canonicalJson } from "@uttori/asm-core/canonical-json";
import { assertSourcePath } from "@uttori/asm-disassembler";
function isObject(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
}
function object(value) {
    if (!isObject(value)) {
        throw new Error("Invalid room declaration.");
    }
    return value;
}
function name(value) {
    if (typeof value !== "string" || value.length > 1024) {
        throw new Error("Invalid room source name.");
    }
    assertSourcePath(value);
    return value;
}
function equal(a, b) {
    return Buffer.from(a).equals(b);
}
function json(value) {
    return new TextEncoder().encode(JSON.stringify(value, null, 2) + "\n");
}
function relative(context, absolute) {
    return name(path.relative(context.build.root, absolute).split(path.sep).join("/"));
}
/** The researched USA profile has a 2 MiB HiROM mirror; the common source host has no mapper assumptions. */
function romOffset(address) {
    if (!Number.isInteger(address) || address < 0xc00000 || address > 0xffffff) {
        throw new Error("Unsupported room native CPU address.");
    }
    return (address - 0xc00000) % 0x200000;
}
function inspect(context, selection) {
    if (context.build.output.length !== 0x200000) {
        throw new Error("Room native loader requires a headerless 2 MiB USA source build.");
    }
    const files = new Map(), dependencies = new Set();
    const source = (file) => {
        let bytes = files.get(file);
        if (!bytes) {
            bytes = context.read(file);
            files.set(file, bytes);
        }
        dependencies.add(file);
        return bytes;
    };
    const read = (address, size) => {
        const output = new Uint8Array(size);
        for (let index = 0; index < size; index++) {
            output[index] = context.build.output[romOffset(address + index)];
        }
        // Pin every normal source input contributing to tables and streams, even when it is only read for composition.
        for (let index = 0; index < size;) {
            const offset = romOffset(address + index), count = Math.min(size - index, 0x200000 - offset);
            for (const emission of context.build.mapping.assets) {
                if (emission.outputOffset !== undefined &&
                    emission.outputOffset < offset + count &&
                    offset < emission.outputOffset + emission.size) {
                    source(relative(context, context.build.mapping.fileList[emission.assetFileIdx].name));
                    source(relative(context, context.build.mapping.fileList[emission.fileIdx].name));
                    for (const resource of Object.values(emission.conversion?.resources ?? {})) {
                        source(relative(context, resource));
                    }
                }
            }
            index += count;
        }
        return output;
    };
    const raw = (offset, size) => {
        if (offset + size > context.build.output.length) {
            return undefined;
        }
        const overlaps = context.build.mapping.assets.filter((entry) => entry.outputOffset !== undefined &&
            entry.outputOffset < offset + size &&
            offset < entry.outputOffset + entry.size);
        const owner = overlaps[0];
        // A matching byte sequence is insufficient: one untransformed include must own the entire requested input/output slice.
        if (overlaps.length !== 1 ||
            owner.format !== "raw" ||
            owner.transforms.length ||
            owner.conversion ||
            owner.outputOffset === undefined ||
            owner.outputOffset > offset ||
            owner.outputOffset + owner.size < offset + size ||
            owner.inputStart === undefined ||
            owner.inputEnd === undefined ||
            owner.inputEnd - owner.inputStart !== owner.size) {
            return undefined;
        }
        const file = relative(context, context.build.mapping.fileList[owner.assetFileIdx].name), start = owner.inputStart + offset - owner.outputOffset, bytes = source(file);
        if (start < 0 ||
            start + size > bytes.length ||
            !equal(bytes.subarray(start, start + size), context.build.output.subarray(offset, offset + size))) {
            return undefined;
        }
        source(relative(context, context.build.mapping.fileList[owner.fileIdx].name));
        return { file, start, size };
    };
    const declared = new Set(context.build.mapping.assets
        .filter((entry) => entry.format === "som.room")
        .map((entry) => relative(context, context.build.mapping.fileList[entry.assetFileIdx].name)));
    if (declared.size !== selection.rooms.length ||
        selection.rooms.some((file) => !declared.has(file))) {
        throw new Error("Room selection omits or invents declared native consumers.");
    }
    const states = new Map();
    let stateBytes = 0;
    const rooms = selection.rooms.map((file) => {
        const room = parseRoomAsset({ bytes: source(file), mediaType: "application/json" }), emissions = context.build.mapping.assets.filter((entry) => entry.format === "som.room" &&
            context.build.mapping.fileList[entry.assetFileIdx].name ===
                path.join(context.build.root, file));
        const parts = new Set();
        for (const entry of emissions) {
            const section = entry.conversion?.options.section;
            if (typeof section !== "string" ||
                parts.has(section) ||
                entry.outputOffset === undefined ||
                entry.transforms.length ||
                entry.conversion?.transforms.length ||
                !equal(encodeRoomSection(room, section), context.build.output.subarray(entry.outputOffset, entry.outputOffset + entry.size))) {
                throw new Error(`Room ${file} has ambiguous current native section attribution.`);
            }
            parts.add(section);
            const table = { objects: 0xc87000, assembly: 0xc85000, triggers: 0xc84000 }[section];
            if (table === undefined) {
                throw new Error("Unsupported native room section.");
            }
            const pointers = read(table + room.id * 2, 4), start = pointers[0] | (pointers[1] << 8), end = pointers[2] | (pointers[3] << 8);
            // Bind the selected source record to the current native directory, rather than trusting its descriptive section address.
            if (end < start ||
                entry.outputOffset !== romOffset(0xc80000 + start) ||
                entry.size !== end - start) {
                throw new Error(`Room ${file} does not match its current native directory extent.`);
            }
            source(relative(context, context.build.mapping.fileList[entry.fileIdx].name));
            for (const resource of Object.values(entry.conversion?.resources ?? {})) {
                source(relative(context, resource));
            }
        }
        for (const [section, table] of Object.entries({
            objects: 0xc87000,
            assembly: 0xc85000,
            triggers: 0xc84000,
        })) {
            if (parts.has(section)) {
                continue;
            }
            const pointers = read(table + room.id * 2, 4), start = pointers[0] | (pointers[1] << 8), end = pointers[2] | (pointers[3] << 8);
            // Generators may omit empty sections. Both the native directory and validated source must prove the zero-length bound.
            if (start !== end || encodeRoomSection(room, section).length) {
                throw new Error(`Room ${file} omits a nonempty native section.`);
            }
        }
        const key = canonicalJson([
            room.header.slice(0, 3),
            [...new Set(room.pieces.map((piece) => piece.layout))].sort((a, b) => a - b),
        ]);
        let state = states.get(key);
        if (!state) {
            // Identical consumers share the immutable transfer bundle; the aggregate budget counts each unique expansion once.
            context.signal?.throwIfAborted();
            state = loadSomRoomNative(room, read);
            const layoutCells = Object.values(state.preview.layouts).reduce((sum, layout) => sum + layout.tiles.length, 0);
            const tileBytes = state.inventory.reduce((sum, tile) => sum + tile.native.length + tile.indexes.length, 0);
            stateBytes = boundedSum(stateBytes, 262144 + layoutCells * 8 + tileBytes, ASSET_LIMITS.decodedBytes, "Room consumer loader state");
            states.set(key, state);
        }
        return { file, room, emissions, state };
    });
    const selected = rooms.find((entry) => entry.file === selection.room);
    const bindings = new Map(), nativeTiles = new Map(), consumers = new Map(), readonly = new Set();
    const identify = (tile) => JSON.stringify([romOffset(tile.address), tile.depth]);
    for (const entry of rooms) {
        for (const tile of entry.state.inventory) {
            const id = identify(tile), binding = raw(romOffset(tile.address), tile.native.length);
            nativeTiles.set(id, tile);
            if (binding) {
                bindings.set(id, binding);
            }
            else {
                readonly.add(id);
            }
            const users = consumers.get(id) ?? new Set();
            users.add(entry.file);
            consumers.set(id, users);
        }
    }
    // Different-depth or partial source overlaps have no independent inverse; retain their artwork without authorizing writes.
    const extents = [...nativeTiles]
        .map(([id, tile]) => ({ id, offset: romOffset(tile.address), size: tile.native.length }))
        .sort((a, b) => a.offset - b.offset);
    for (let index = 0; index < extents.length; index++) {
        for (let next = index + 1; next < extents.length && extents[next].offset < extents[index].offset + extents[index].size; next++) {
            readonly.add(extents[index].id);
            readonly.add(extents[next].id);
        }
    }
    const bind = (tile) => ({
        ...tile,
        owner: identify(tile),
        editable: !readonly.has(identify(tile)),
    });
    const inventory = selected.state.inventory.map(bind), physical = selected.state.physical.map((tile) => tile && bind(tile));
    const paletteBindings = new Map(), editablePaletteSlots = [];
    for (let bank = 1; bank < 8; bank++) {
        for (let slot = 1; slot < 16; slot++) {
            const index = bank * 16 + slot, offset = romOffset(selected.state.paletteAddress) + ((bank - 1) * 15 + slot - 1) * 2, binding = raw(offset, 2);
            if (binding) {
                paletteBindings.set(index, binding);
                editablePaletteSlots.push(index);
            }
        }
    }
    const composition = composeSomRoom(selected.room, selected.state.preview, selection.story);
    // Until a narrower table/code dependency closure is proved, every consumed normal-build input pins this native profile.
    for (const absolute of context.build.snapshots.keys()) {
        dependencies.add(relative(context, absolute));
    }
    return {
        selected,
        rooms,
        files,
        source,
        read,
        raw,
        dependencies,
        bindings,
        nativeTiles,
        consumers,
        inventory,
        physical,
        composition,
        paletteBindings,
        editablePaletteSlots,
    };
}
/** Room source editing uses only fixed native low planes and palette words; map cells/conditional records remain unchanged. */
export const somRoomSourceAdapter = {
    id: "som.room.native",
    version: 1,
    module: fileURLToPath(import.meta.url),
    capabilities: {
        pixelEdits: true,
        paletteEdits: true,
        tileReferences: true,
        previewTimeline: true,
    },
    readSelection(value) {
        const input = object(value);
        if (!Array.isArray(input.rooms) || !input.rooms.length || input.rooms.length > 511) {
            throw new Error("Missing complete room consumer closure.");
        }
        const rooms = input.rooms.map(name), room = name(input.room);
        if (new Set(rooms).size !== rooms.length || !rooms.includes(room)) {
            throw new Error("Invalid selected room consumer.");
        }
        let story;
        if (input.story !== undefined) {
            story = {};
            for (const [key, state] of Object.entries(object(input.story))) {
                if (!/^(?:0|[1-9]\d{0,2})$/.test(key) ||
                    Number(key) > 255 ||
                    typeof state !== "number" ||
                    !Number.isInteger(state) ||
                    state < 0 ||
                    state > 255) {
                    throw new Error("Invalid room story state.");
                }
                story[key] = state;
            }
        }
        return { room, rooms, story };
    },
    readBindings(value) {
        const input = object(value);
        if (!Array.isArray(input.owners) ||
            input.owners.length > 4096 ||
            input.owners.some((id) => typeof id !== "string" || id.length > 1024) ||
            typeof input.paletteAddress !== "number" ||
            !Number.isInteger(input.paletteAddress)) {
            throw new Error("Invalid private room native bindings.");
        }
        const owners = input.owners.map((id) => {
            if (typeof id !== "string") {
                throw new Error("Invalid private room owner.");
            }
            return id;
        });
        return { owners, paletteAddress: input.paletteAddress };
    },
    export(context, selection, exportId) {
        const current = inspect(context, selection), baseline = createSomRoomInterchange(current.composition, current.inventory, current.physical, current.editablePaletteSlots, exportId);
        return {
            asset: `room:${current.selected.room.id}`,
            baseline,
            bindings: {
                owners: baseline.ownership.owners.map((owner) => owner.id),
                paletteAddress: current.selected.state.paletteAddress,
            },
            dependencies: [...current.dependencies].sort(),
        };
    },
    plan(context, selection, bindings, changes) {
        const current = inspect(context, selection), baseline = createSomRoomInterchange(current.composition, current.inventory, current.physical, current.editablePaletteSlots, "00000000-0000-0000-0000-000000000000");
        if (canonicalJson(bindings) !==
            canonicalJson({
                owners: baseline.ownership.owners.map((owner) => owner.id),
                paletteAddress: current.selected.state.paletteAddress,
            })) {
            throw new Error("Private room bindings no longer match current source.");
        }
        const patches = new Map(), resources = new Map();
        const patch = (binding, after, consumers) => {
            if (after.length !== binding.size) {
                throw new Error("Room edit changes a fixed native extent.");
            }
            const before = current.source(binding.file), bytes = patches.get(binding.file) ?? new Map();
            for (let index = 0; index < after.length; index++) {
                const at = binding.start + index;
                if (bytes.has(at) && bytes.get(at) !== after[index]) {
                    throw new Error("Conflicting aliased room native byte edits.");
                }
                if (before[at] !== after[index]) {
                    bytes.set(at, after[index]);
                }
            }
            patches.set(binding.file, bytes);
            const users = resources.get(binding.file) ?? new Set();
            consumers.forEach((consumer) => users.add(consumer));
            resources.set(binding.file, users);
        };
        for (const change of changes.pixels) {
            const tile = current.nativeTiles.get(change.owner), binding = current.bindings.get(change.owner), owner = baseline.ownership.owners.find((entry) => entry.id === change.owner);
            if (!tile || !binding || !owner || owner.editable === false || change.indexes.length !== 64) {
                throw new Error("Unknown or read-only room tile authority.");
            }
            const rows = Array.from({ length: 8 }, (_, row) => [
                ...change.indexes.subarray(row * 8, row * 8 + 8),
            ]);
            patch(binding, encodePlanarTiles([rows], tile.depth), [
                ...current.consumers.get(change.owner),
            ]);
        }
        for (const change of changes.colors) {
            const binding = current.paletteBindings.get(change.index);
            if (!binding || change.color[3] !== 255) {
                throw new Error("Unknown room palette word authority.");
            }
            const before = current.source(binding.file), word = before[binding.start] | (before[binding.start + 1] << 8);
            const after = somRoomPaletteWord(word, change.color);
            const users = current.rooms
                .filter((entry) => entry.state.paletteAddress === current.selected.state.paletteAddress)
                .map((entry) => entry.file);
            patch(binding, Uint8Array.of(after & 255, after >>> 8), users);
        }
        const files = [...patches].flatMap(([file, values]) => {
            if (!values.size) {
                return [];
            }
            const before = current.source(file), after = before.slice();
            for (const [offset, value] of values) {
                after[offset] = value;
            }
            return [{ path: file, before, after }];
        });
        const effects = [];
        // Follow every current raw include of the edited input slice, rather than assuming one CPU load owns the bytes.
        for (const file of files) {
            for (const emission of context.build.mapping.assets) {
                if (context.build.mapping.fileList[emission.assetFileIdx].name !==
                    path.join(context.build.root, file.path)) {
                    continue;
                }
                if (emission.format !== "raw" ||
                    emission.outputOffset === undefined ||
                    emission.inputStart === undefined ||
                    emission.inputEnd === undefined ||
                    emission.inputEnd - emission.inputStart !== emission.size) {
                    throw new Error("Edited room input also has an unsupported native consumer.");
                }
                let start = -1;
                const flush = (end) => {
                    if (start < 0) {
                        return;
                    }
                    const offset = emission.outputOffset + start - emission.inputStart;
                    effects.push({
                        resource: `room-native:${file.path}`,
                        offset,
                        before: file.before.slice(start, end),
                        after: file.after.slice(start, end),
                        consumers: [...resources.get(file.path)].sort(),
                    });
                    start = -1;
                };
                for (let at = emission.inputStart; at < emission.inputEnd; at++) {
                    if (file.before[at] !== file.after[at]) {
                        if (start < 0) {
                            start = at;
                        }
                    }
                    else {
                        flush(at);
                    }
                }
                flush(emission.inputEnd);
            }
        }
        if (effects.length) {
            const expected = context.build.output.slice();
            for (const effect of effects) {
                expected.set(effect.after, effect.offset);
            }
            const read = (address, size) => Uint8Array.from({ length: size }, (_, index) => expected[romOffset(address + index)]);
            const previews = new Map();
            for (const entry of current.rooms) {
                const next = loadSomRoomNative(entry.room, read).preview;
                for (const emission of entry.emissions) {
                    const declaration = emission.conversion?.options.preview;
                    const absolute = typeof declaration === "string"
                        ? emission.conversion?.resources[declaration]
                        : undefined;
                    if (!absolute) {
                        continue;
                    }
                    const file = relative(context, absolute), before = current.source(file);
                    let preview = previews.get(file);
                    if (!preview) {
                        preview = parseRoomPreview(before);
                        const provenance = preview.provenance;
                        // Captures are retained evidence, while a declared initial-loader preview is derived from editable source.
                        if (!provenance ||
                            typeof provenance !== "object" ||
                            !("kind" in provenance) ||
                            provenance.kind !== "native-room-loader-initial-state") {
                            continue;
                        }
                        previews.set(file, preview);
                    }
                    const key = `${entry.room.header[0] & 63}:${entry.room.header[2]}:${entry.room.header[1] & 127}`;
                    preview.tilesets[key] = next.tilesets[key];
                    for (const [id, layout] of Object.entries(next.layouts)) {
                        preview.layouts[id] = { ...preview.layouts[id], ...layout };
                    }
                }
            }
            for (const [file, preview] of previews) {
                const before = current.source(file), original = parseRoomPreview(before);
                preview.provenance = {
                    ...object(preview.provenance),
                    romSha256: createHash("sha256").update(expected).digest("hex"),
                };
                // Preserve formatting and source times when a shared preview has no logical change.
                if (canonicalJson(original) !== canonicalJson(preview)) {
                    files.push({ path: file, before, after: json(preview) });
                }
            }
        }
        return { files, effects };
    },
};
//# sourceMappingURL=secret-of-mana-room.js.map
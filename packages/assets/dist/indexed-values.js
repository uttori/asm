import { integer } from "./validation.js";
/** Validate untrusted ordered slots and return owned tuples, preserving duplicate values. */
export function indexedPalette(value) {
    if (!Array.isArray(value) || value.length < 1 || value.length > 256) {
        throw new Error("Indexed palette requires 1..256 slots.");
    }
    return value.map((slot) => {
        if (!Array.isArray(slot) || slot.length !== 4) {
            throw new Error("Palette slots require four RGBA8 channels.");
        }
        const channels = slot;
        const result = [0, 0, 0, 0];
        for (let channel = 0; channel < 4; channel++) {
            const value = channels[channel];
            if (typeof value !== "number") {
                throw new TypeError("Palette channel must be a number.");
            }
            result[channel] = integer(value, "Palette channel", 0, 255);
        }
        return result;
    });
}
/** Palette colors change in place; slot identity and alpha remain fixed by the private policy. */
export function indexedPaletteChanges(before, after, editableSlots) {
    indexedPalette(before);
    indexedPalette(after);
    if (before.length !== after.length) {
        throw new Error("Palette inventory changed.");
    }
    const editable = new Set(editableSlots);
    if (editable.size !== editableSlots.length) {
        throw new Error("Duplicate editable palette slot.");
    }
    for (const slot of editable) {
        integer(slot, "Editable palette slot", 0, before.length - 1);
    }
    const changes = [];
    after.forEach((color, index) => {
        if (color[3] !== before[index][3]) {
            throw new Error("Palette alpha changes are unsupported.");
        }
        if (color.some((channel, i) => channel !== before[index][i])) {
            if (!editable.has(index)) {
                throw new Error(`Read-only palette slot changed: ${index}.`);
            }
            changes.push({ index, color: [...color] });
        }
    });
    return changes;
}
//# sourceMappingURL=indexed-values.js.map
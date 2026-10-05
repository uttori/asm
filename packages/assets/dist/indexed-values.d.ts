/** Ordered RGBA8 slot. Equal colors and transparent hidden RGB do not merge identities. */
export type IndexedColor = readonly [number, number, number, number];
/** Validate untrusted ordered slots and return owned tuples, preserving duplicate values. */
export declare function indexedPalette(value: unknown): IndexedColor[];
/** Palette colors change in place; slot identity and alpha remain fixed by the private policy. */
export declare function indexedPaletteChanges(before: readonly IndexedColor[], after: readonly IndexedColor[], editableSlots: readonly number[]): {
    index: number;
    color: IndexedColor;
}[];
//# sourceMappingURL=indexed-values.d.ts.map
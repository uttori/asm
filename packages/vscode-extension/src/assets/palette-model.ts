import {
  spritePaletteBytes,
  type SpritePaletteCatalog,
} from "@uttori/asm-assets/secret-of-mana/som-sprite-palettes";
// The package's UMD entry hides relative requires inside a factory; its ESM entry
// keeps every parser dependency visible when bundling the standalone VSIX.
import {
  findNodeAtLocation,
  parseTree,
  type Node,
  type ParseError,
} from "jsonc-parser/lib/esm/main.js";

/** Version 1 catalogues are objects with a non-array palette map. Other JSON is rejected. */
function isSpritePaletteCatalog(value: unknown): value is SpritePaletteCatalog {
  return (
    typeof value === "object" &&
    value !== null &&
    "version" in value &&
    value.version === 1 &&
    "palettes" in value &&
    typeof value.palettes === "object" &&
    value.palettes !== null &&
    !Array.isArray(value.palettes)
  );
}

/** A bounded view of the existing catalog; names and unknown fields remain in the text document. */
export interface PaletteView {
  /** Catalogue palette id from the JSON document. */
  readonly id: string;
  /** Display name shown in the palette editor webview. */
  readonly name: string;
  /** First global palette index owned by this catalogue entry. */
  readonly firstIndex: number;
  /** BGR555 words rendered as editable hex tokens. */
  readonly words: readonly string[];
}

/** Property names in a JSON object are strings; anything else is not a catalogue we can edit. */
function propertyName(node: Node): string {
  const key: unknown = node.children?.[0]?.value;
  if (typeof key !== "string") {
    throw new Error("Repair the palette JSON in the text editor before editing colors.");
  }
  return key;
}

/** Reject duplicate keys rather than editing a token that JSON.parse would silently shadow. */
function uniqueKeys(node: Node): void {
  if (node.type === "object") {
    const keys = new Set<string>();
    for (const property of node.children ?? []) {
      const key = propertyName(property);
      if (keys.has(key)) {
        throw new Error(`Duplicate palette JSON key: ${key}.`);
      }
      keys.add(key);
    }
  }
  for (const child of node.children ?? []) {
    uniqueKeys(child);
  }
}

/** Strict JSON and format validation run before every edit, including edits from another open view. */
function parse(text: string) {
  if (text.length > 1024 * 1024) {
    throw new Error("Palette catalog exceeds the 1 MiB editor limit.");
  }
  const errors: ParseError[] = [];
  const tree = parseTree(text, errors, { disallowComments: true, allowTrailingComma: false });
  if (!tree || errors.length) {
    throw new Error("Repair the palette JSON in the text editor before editing colors.");
  }
  uniqueKeys(tree);
  const catalog: unknown = JSON.parse(text);
  if (!isSpritePaletteCatalog(catalog)) {
    throw new Error("Expected a version 1 ROM palette catalog.");
  }
  if (Object.keys(catalog.palettes).length > 4096) {
    throw new Error("Palette catalog exceeds the 4096-record editor limit.");
  }
  for (const id of Object.keys(catalog.palettes)) {
    spritePaletteBytes(catalog, id);
  }
  return { tree, catalog };
}

/** Display raw BGR555 words without reordering duplicate palette slots or hiding bit 15. */
export function paletteView(text: string): PaletteView[] {
  const { catalog } = parse(text);
  return Object.entries(catalog.palettes).map(([id, record]) => ({
    id,
    name: "name" in record && typeof record.name === "string" ? record.name : "",
    firstIndex: record.firstIndex,
    words: record.words,
  }));
}

/** Replace only the chosen string token; whitespace, unknown metadata and other colors stay exact. */
export function paletteWordEdit(text: string, id: string, index: number, word: string) {
  const { tree, catalog } = parse(text);
  const record = Object.hasOwn(catalog.palettes, id) ? catalog.palettes[id] : undefined;
  if (
    !record ||
    !Number.isSafeInteger(index) ||
    index < record.firstIndex ||
    index >= record.firstIndex + record.words.length ||
    !/^[\dA-Fa-f]{4}$/.test(word)
  ) {
    throw new Error("Select a stored palette slot and a four-digit BGR555 word.");
  }
  const node = findNodeAtLocation(tree, ["palettes", id, "words", index - record.firstIndex]);
  if (!node || node.type !== "string") {
    throw new Error("Palette slot changed; reload the view.");
  }
  return { offset: node.offset, length: node.length, text: JSON.stringify(word.toUpperCase()) };
}

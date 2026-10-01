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

/** A bounded view of the existing catalog; names and unknown fields remain in the text document. */
export interface PaletteView {
  readonly id: string;
  readonly name: string;
  readonly firstIndex: number;
  readonly words: readonly string[];
}

/** Reject duplicate keys rather than editing a token that JSON.parse would silently shadow. */
function uniqueKeys(node: Node): void {
  if (node.type === "object") {
    const keys = new Set<string>();
    for (const property of node.children ?? []) {
      const key = property.children?.[0]?.value as string;
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
  const catalog = JSON.parse(text) as SpritePaletteCatalog;
  if (
    catalog?.version !== 1 ||
    !catalog.palettes ||
    typeof catalog.palettes !== "object" ||
    Array.isArray(catalog.palettes)
  ) {
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
  return Object.entries(catalog.palettes).map(([id, record]) => {
    const name = (record as unknown as Record<string, unknown>).name;
    return {
      id,
      name: typeof name === "string" ? name : "",
      firstIndex: record.firstIndex,
      words: record.words,
    };
  });
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

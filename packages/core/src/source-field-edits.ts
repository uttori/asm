import type { AddressToLineMapping, StructFieldEmissionInfo } from "./addressToLine.js";
import { removeInlineComment } from "./services/command-text-service.js";
import {
  isOpenStructInitializer,
  parseStructInitializerEntries,
  structInitializerStart,
} from "./services/struct-initializer.js";

/** Fixed-size scalar replacement at a headerless output offset, with exact optimistic before bytes. */
export interface TypedSourcePatch {
  readonly offset: number;
  readonly before: Uint8Array;
  readonly after: Uint8Array;
}

/** Owned source replacement; the host checks before bytes again before applying it. */
export interface TypedSourceEdit {
  readonly file: string;
  readonly before: Uint8Array;
  readonly after: Uint8Array;
}

/** Find one physical scalar through encoder attribution, never by a source label or matching byte text. */
function expressionLocation(
  mapping: AddressToLineMapping,
  snapshots: ReadonlyMap<string, Uint8Array>,
  field: StructFieldEmissionInfo,
) {
  const file = mapping.fileList[field.fileIdx]?.name;
  const bytes = snapshots.get(file);
  if (!bytes) {
    throw new Error("Typed field source snapshot is missing.");
  }
  const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
  const lines = text.split(/(?<=\n)/);
  const lineIndex = field.line - 1;
  if (lineIndex < 0 || lineIndex >= lines.length) {
    throw new Error("Invalid typed field source line.");
  }
  const start = lines.slice(0, lineIndex).join("").length;
  let masked = "";
  let count = 0;
  do {
    if (count >= 4096 || lineIndex + count >= lines.length) {
      throw new Error("Unbounded typed initializer.");
    }
    const line = lines[lineIndex + count++];
    // Retain UTF-16 positions while hiding comments from the assembler's existing grammar.
    const body = line.replace(/[\n\r]+$/, "");
    const leading = body.slice(0, body.length - body.trimStart().length);
    const code = leading + removeInlineComment(body.trimStart());
    masked += code.padEnd(body.length, " ") + line.slice(body.length);
  } while (isOpenStructInitializer(masked));
  const literal = structInitializerStart(masked);
  const entries = parseStructInitializerEntries(masked.slice(literal));
  const matches = entries.flatMap((entry) =>
    entry.expressions.flatMap((expression, index) => {
      let suffix = `.${entry.name}`;
      if (Array.isArray(entry.value)) {
        suffix += `[${index}]`;
      }
      if (!field.reference.endsWith(suffix)) {
        return [];
      }
      return [{ expression, at: start + literal + expression.start }];
    }),
  );
  if (
    matches.length !== 1 ||
    matches[0].expression.text.replace(/\s/g, "") !== field.expression.replace(/\s/g, "")
  ) {
    throw new Error("Typed field attribution does not identify one source expression.");
  }
  const match = matches[0];
  return { file, bytes, text, start: match.at, end: match.at + match.expression.text.length };
}

/**
 * Plan literal typed-field edits using a fresh assembly snapshot. Expressions and repeated
 * macro/table emission reject rather than losing meaning or changing multiple physical owners.
 * Supports unsigned scalar widths 1..4 bytes; preserves comments, whitespace and unknown fields.
 */
export function planTypedSourceEdits(options: {
  readonly mapping: AddressToLineMapping;
  readonly snapshots: ReadonlyMap<string, Uint8Array>;
  readonly output: Uint8Array;
  readonly patches: readonly TypedSourcePatch[];
}): TypedSourceEdit[] {
  const replacements = new Map<
    string,
    { bytes: Uint8Array; text: string; ranges: { start: number; end: number; value: string }[] }
  >();
  const physical = new Set<string>();
  for (const patch of options.patches) {
    const size = patch.before.length;
    if (
      !Number.isSafeInteger(patch.offset) ||
      patch.offset < 0 ||
      size < 1 ||
      size > 4 ||
      patch.after.length !== size ||
      patch.offset + size > options.output.length ||
      patch.before.some((v, i) => options.output[patch.offset + i] !== v)
    ) {
      throw new Error("Typed patch has stale bytes or an invalid fixed extent.");
    }
    if (patch.before.every((v, i) => patch.after[i] === v)) {
      continue;
    }
    const fields = options.mapping.structFields.filter(
      (v) => v.outputOffset === patch.offset && v.size === size,
    );
    if (fields.length !== 1) {
      throw new Error("Patch does not identify one typed scalar owner.");
    }
    const field = fields[0];
    const aliases = options.mapping.structFields.filter(
      (v) =>
        v.fileIdx === field.fileIdx && v.line === field.line && v.reference === field.reference,
    );
    if (aliases.length !== 1) {
      throw new Error("Typed scalar has repeated source emission.");
    }
    const source = expressionLocation(options.mapping, options.snapshots, field);
    const key = JSON.stringify([source.file, source.start]);
    if (physical.has(key)) {
      throw new Error("Duplicate typed source patch.");
    }
    physical.add(key);
    const expression = field.expression.trim();
    let value: number;
    if (/^\$[\dA-Fa-f]+$/.test(expression)) {
      value = Number.parseInt(expression.slice(1), 16);
    } else if (/^0x[\da-f]+$/i.test(expression)) {
      value = Number.parseInt(expression.slice(2), 16);
    } else if (/^\d+$/.test(expression)) {
      value = Number(expression);
    } else {
      throw new Error(
        "Typed source edits require a literal scalar; preserve expressions in the source editor.",
      );
    }
    const expected = patch.before.reduce((sum, byte, index) => sum + byte * 256 ** index, 0);
    if (value !== expected) {
      throw new Error("Typed source literal differs from the encoded owner.");
    }
    const after = patch.after.reduce((sum, byte, index) => sum + byte * 256 ** index, 0);
    const replacement = `$${after
      .toString(16)
      .toUpperCase()
      .padStart(size * 2, "0")}`;
    const entry = replacements.get(source.file) ?? {
      bytes: source.bytes,
      text: source.text,
      ranges: [],
    };
    entry.ranges.push({ start: source.start, end: source.end, value: replacement });
    replacements.set(source.file, entry);
  }
  return [...replacements].map(([file, entry]) => {
    const ranges = entry.ranges.toSorted((a, b) => b.start - a.start);
    let text = entry.text;
    let previous = text.length;
    for (const range of ranges) {
      if (range.end > previous) {
        throw new Error("Overlapping typed source replacements.");
      }
      text = text.slice(0, range.start) + range.value + text.slice(range.end);
      previous = range.start;
    }
    return { file, before: Uint8Array.from(entry.bytes), after: new TextEncoder().encode(text) };
  });
}

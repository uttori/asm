/** Target-neutral directive metadata used by tooling contributions. */
export type DirectiveDescriptor = {
  keyword: string;
  summary: string;
  syntax: string;
  group: string;
};

const descriptor = (
  keyword: string,
  summary: string,
  syntax: string,
  group: string,
): DirectiveDescriptor => ({ keyword, summary, syntax, group });

/** Metadata for directives implemented by the architecture-neutral core. */
export const directiveCatalog: DirectiveDescriptor[] = [
  ...[
    ["db", "Emit one or more bytes.", "db value[, value...]"],
    ["dw", "Emit one or more 16-bit words.", "dw value[, value...]"],
    ["dl", "Emit one or more 24-bit long values.", "dl value[, value...]"],
    ["dd", "Emit one or more 32-bit double words.", "dd value[, value...]"],
    ["dc.b", "Emit byte-sized data constants.", "dc.b value[, value...]"],
    ["dc.w", "Emit word-sized data constants.", "dc.w value[, value...]"],
    ["dc.l", "Emit long-sized data constants.", "dc.l value[, value...]"],
  ].map(([keyword, summary, syntax]) => descriptor(keyword, summary, syntax, "data")),
  ...[
    ["fillbyte", "Set the byte used by fill.", "fillbyte value"],
    ["fillword", "Set the word used by fill.", "fillword value"],
    ["filllong", "Set the long value used by fill.", "filllong value"],
    ["filldword", "Set the double word used by fill.", "filldword value"],
    ["fill", "Fill a number of bytes.", "fill count"],
    ["padbyte", "Set the byte used by pad.", "padbyte value"],
    ["padword", "Set the word used by pad.", "padword value"],
    ["padlong", "Set the long value used by pad.", "padlong value"],
    ["paddword", "Set the double word used by pad.", "paddword value"],
    ["pad", "Pad output up to an address.", "pad address"],
  ].map(([keyword, summary, syntax]) => descriptor(keyword, summary, syntax, "memory")),
  ...[
    ["incsrc", "Assemble another source file inline.", 'incsrc "file.asm"'],
    ["include", "Include and assemble another source file.", 'include "file.asm"'],
    ["includeonce", "Guard a file against repeated inclusion.", "includeonce"],
    ["incbin", "Embed bytes from a binary file.", 'incbin "file.bin"[,start,length]'],
  ].map(([keyword, summary, syntax]) => descriptor(keyword, summary, syntax, "include")),
  ...[
    ["base", "Set the logical base address.", "base address"],
    ["org", "Set the logical origin address.", "org address"],
    ["pushbase", "Push the current base address.", "pushbase"],
    ["pullbase", "Restore the most recently pushed base address.", "pullbase"],
    ["pushpc", "Push the current logical address.", "pushpc"],
    ["pullpc", "Restore the most recently pushed logical address.", "pullpc"],
    ["arch", "Select the active architecture.", "arch architecture"],
  ].map(([keyword, summary, syntax]) => descriptor(keyword, summary, syntax, "layout")),
  ...[
    ["namespace", "Set the active label namespace.", "namespace name"],
    ["pushns", "Push the current namespace.", "pushns"],
    ["pullns", "Restore the most recently pushed namespace.", "pullns"],
  ].map(([keyword, summary, syntax]) => descriptor(keyword, summary, syntax, "namespace")),
  ...[
    ["table", "Load a character mapping table.", 'table "file"[,ltr|rtl]'],
    ["cleartable", "Reset character mappings.", "cleartable"],
    ["pushtable", "Push the current mapping table.", "pushtable"],
    ["pulltable", "Restore the most recently pushed mapping table.", "pulltable"],
  ].map(([keyword, summary, syntax]) => descriptor(keyword, summary, syntax, "table")),
  descriptor("struct", "Begin a structure definition.", "struct name", "struct"),
  descriptor("endstruct", "End a structure definition.", "endstruct", "struct"),
  ...[
    ["if", "Begin a conditional block.", "if expression"],
    ["elseif", "Begin an alternate conditional branch.", "elseif expression"],
    ["else", "Begin a fallback conditional branch.", "else"],
    ["endif", "End a conditional block.", "endif"],
    ["while", "Begin a while loop.", "while expression"],
    ["endwhile", "End a while loop.", "endwhile"],
    ["for", "Begin a counted loop.", "for var = start..end"],
    ["endfor", "End a counted loop.", "endfor"],
  ].map(([keyword, summary, syntax]) => descriptor(keyword, summary, syntax, "control")),
  descriptor("macro", "Begin a macro definition.", "macro name(args)", "macro"),
  descriptor("endmacro", "End a macro definition.", "endmacro", "macro"),
  descriptor("assert", "Fail when a condition is false.", "assert condition", "diagnostic"),
  descriptor("error", "Fail with a user-defined error.", "error message", "diagnostic"),
  descriptor(
    "warnpc",
    "Fail when the logical address exceeds a bound.",
    "warnpc address",
    "diagnostic",
  ),
];

/** Pre-built keyword → descriptor index for O(1) lookup (keys are already lowercase). */
const directiveCatalogMap = new Map<string, DirectiveDescriptor>(
  directiveCatalog.map((entry) => [entry.keyword.toLowerCase(), entry]),
);

export function findDirective(keyword: string): DirectiveDescriptor | undefined {
  const normalized = keyword.toLowerCase().replace(/^@/, "");
  return directiveCatalogMap.get(normalized);
}

/** Target-neutral directive metadata used by tooling contributions. */
export type DirectiveDocs = {
  keyword: string;
  summary: string;
  syntax: string;
};

/** Nested keyword valid after a directive or another operand (`bankcross`, `full`). */
export type DirectiveOperandDescriptor = DirectiveDocs & {
  operands?: readonly DirectiveOperandDescriptor[];
};

export type DirectiveDescriptor = DirectiveDocs & {
  group: string;
  operands?: readonly DirectiveOperandDescriptor[];
};

const descriptor = (
  keyword: string,
  summary: string,
  syntax: string,
  group: string,
  operands?: readonly DirectiveOperandDescriptor[],
): DirectiveDescriptor => ({
  keyword,
  summary,
  syntax,
  group,
  ...(operands ? { operands } : {}),
});

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
    ["org", "Set the logical origin address.", "org address"],
    ["pushbase", "Push the current base address.", "pushbase"],
    ["pullbase", "Restore the most recently pushed base address.", "pullbase"],
    ["pushpc", "Push the current logical address.", "pushpc"],
    ["pullpc", "Restore the most recently pushed logical address.", "pullpc"],
  ].map(([keyword, summary, syntax]) => descriptor(keyword, summary, syntax, "layout")),
  descriptor("base", "Set or restore the logical base address.", "base address|off", "layout", [
    {
      keyword: "off",
      summary: "Restore the saved physical/base address relationship.",
      syntax: "base off",
    },
  ]),
  descriptor("arch", "Select the active architecture.", "arch architecture", "layout"),
  descriptor("pushns", "Push the current namespace.", "pushns", "namespace"),
  descriptor("pullns", "Restore the most recently pushed namespace.", "pullns", "namespace"),
  descriptor(
    "namespace",
    "Set, nest, or clear the active label namespace.",
    "namespace [name|off|nested on|nested off]",
    "namespace",
    [
      {
        keyword: "off",
        summary: "Leave the current namespace (pop when nested, else clear).",
        syntax: "namespace off",
      },
      {
        keyword: "nested",
        summary: "Enable or disable nested namespace paths.",
        syntax: "namespace nested on|off",
        operands: [
          {
            keyword: "on",
            summary: "Build namespace paths from successive namespace directives.",
            syntax: "namespace nested on",
          },
          {
            keyword: "off",
            summary: "Disable nested paths and clear the current namespace.",
            syntax: "namespace nested off",
          },
        ],
      },
    ],
  ),
  descriptor("cleartable", "Reset character mappings.", "cleartable", "table"),
  descriptor("pushtable", "Push the current mapping table.", "pushtable", "table"),
  descriptor("pulltable", "Restore the most recently pushed mapping table.", "pulltable", "table"),
  descriptor("table", "Load a character mapping table.", 'table "file"[,ltr|rtl]', "table", [
    {
      keyword: "ltr",
      summary: "Left-to-right table lines: character=hex.",
      syntax: 'table "file",ltr',
    },
    {
      keyword: "rtl",
      summary: "Right-to-left table lines: hex=character.",
      syntax: 'table "file",rtl',
    },
  ]),
  descriptor("struct", "Begin a structure definition.", "struct name [extends parent]", "struct", [
    {
      keyword: "extends",
      summary: "Inherit members from an existing struct.",
      syntax: "struct name extends parent",
    },
  ]),
  descriptor("endstruct", "End a structure definition.", "endstruct [align value]", "struct", [
    {
      keyword: "align",
      summary: "Round the struct size/stride up to an alignment.",
      syntax: "endstruct align value",
    },
  ]),
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

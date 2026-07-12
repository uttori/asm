/**
 * A static description of an assembler directive or control-flow keyword for
 * editor tooling (hover, completion, signature help).
 */
export type DirectiveDescriptor = {
  /** The directive keyword as written in source, e.g. "org", "incsrc". */
  keyword: string;
  /** A short human-readable summary suitable for hover documentation. */
  summary: string;
  /** Example syntax, e.g. "org $address". */
  syntax: string;
  /** A coarse grouping used to organize completion. */
  group: "data" | "layout" | "include" | "memory" | "namespace" | "table" | "spc" | "struct" | "control" | "define" | "macro" | "compat" | "label";
};

/**
 * The directive catalog. Keywords mirror the registrations in
 * `src/directives/*` plus control-flow, macro, and define forms that are
 * handled outside the directive registry.
 */
export const directiveCatalog: DirectiveDescriptor[] = [
  { keyword: "db", summary: "Emit one or more bytes.", syntax: "db value[, value...]", group: "data" },
  { keyword: "dw", summary: "Emit one or more 16-bit words.", syntax: "dw value[, value...]", group: "data" },
  { keyword: "dl", summary: "Emit one or more 24-bit long values.", syntax: "dl value[, value...]", group: "data" },
  { keyword: "dd", summary: "Emit one or more 32-bit double words.", syntax: "dd value[, value...]", group: "data" },
  { keyword: "dc.b", summary: "Emit bytes (asar-compatible data constant).", syntax: "dc.b value[, value...]", group: "data" },
  { keyword: "dc.w", summary: "Emit words (asar-compatible data constant).", syntax: "dc.w value[, value...]", group: "data" },
  { keyword: "dc.l", summary: "Emit long values (asar-compatible data constant).", syntax: "dc.l value[, value...]", group: "data" },

  { keyword: "fillbyte", summary: "Set the byte used by fill.", syntax: "fillbyte value", group: "memory" },
  { keyword: "fillword", summary: "Set the word used by fill.", syntax: "fillword value", group: "memory" },
  { keyword: "filllong", summary: "Set the long value used by fill.", syntax: "filllong value", group: "memory" },
  { keyword: "filldword", summary: "Set the double word used by fill.", syntax: "filldword value", group: "memory" },
  { keyword: "fill", summary: "Fill a number of bytes with the fill value.", syntax: "fill count", group: "memory" },
  { keyword: "padbyte", summary: "Set the byte used by pad.", syntax: "padbyte value", group: "memory" },
  { keyword: "padword", summary: "Set the word used by pad.", syntax: "padword value", group: "memory" },
  { keyword: "padlong", summary: "Set the long value used by pad.", syntax: "padlong value", group: "memory" },
  { keyword: "paddword", summary: "Set the double word used by pad.", syntax: "paddword value", group: "memory" },
  { keyword: "pad", summary: "Pad up to an address with the pad value.", syntax: "pad address", group: "memory" },

  { keyword: "incsrc", summary: "Assemble another source file inline.", syntax: "incsrc \"file.asm\"", group: "include" },
  { keyword: "include", summary: "Include and assemble another source file.", syntax: "include \"file.asm\"", group: "include" },
  { keyword: "includeonce", summary: "Guard the current file against being included more than once.", syntax: "includeonce", group: "include" },
  { keyword: "incbin", summary: "Embed the raw bytes of a binary file.", syntax: "incbin \"file.bin\"[,start,length]", group: "include" },

  { keyword: "base", summary: "Set the logical base address for emitted code.", syntax: "base $address", group: "layout" },
  { keyword: "org", summary: "Set the current output/origin address.", syntax: "org $address", group: "layout" },
  { keyword: "pushbase", summary: "Push the current base address.", syntax: "pushbase", group: "layout" },
  { keyword: "pullbase", summary: "Restore the most recently pushed base address.", syntax: "pullbase", group: "layout" },
  { keyword: "pushpc", summary: "Push the current program counter.", syntax: "pushpc", group: "layout" },
  { keyword: "pullpc", summary: "Restore the most recently pushed program counter.", syntax: "pullpc", group: "layout" },
  { keyword: "startpos", summary: "Set the SPC start position.", syntax: "startpos", group: "layout" },
  { keyword: "check", summary: "Assert an assembler condition (asar-compatible).", syntax: "check ...", group: "layout" },
  { keyword: "optimize", summary: "Control optimization behavior (asar-compatible).", syntax: "optimize ...", group: "layout" },
  { keyword: "arch", summary: "Select the active CPU architecture.", syntax: "arch 65816|spc700|superfx", group: "layout" },
  { keyword: "lorom", summary: "Use the LoROM memory mapper.", syntax: "lorom", group: "layout" },
  { keyword: "hirom", summary: "Use the HiROM memory mapper.", syntax: "hirom", group: "layout" },
  { keyword: "exlorom", summary: "Use the ExLoROM memory mapper.", syntax: "exlorom", group: "layout" },
  { keyword: "exhirom", summary: "Use the ExHiROM memory mapper.", syntax: "exhirom", group: "layout" },
  { keyword: "fastrom", summary: "Enable FastROM timing.", syntax: "fastrom", group: "layout" },
  { keyword: "sfxrom", summary: "Use the Super FX memory mapper.", syntax: "sfxrom", group: "layout" },
  { keyword: "norom", summary: "Disable the memory mapper.", syntax: "norom", group: "layout" },
  { keyword: "sa1rom", summary: "Use the SA-1 memory mapper.", syntax: "sa1rom", group: "layout" },
  { keyword: "fullsa1rom", summary: "Use the full SA-1 memory mapper.", syntax: "fullsa1rom", group: "layout" },

  { keyword: "namespace", summary: "Set the active label namespace.", syntax: "namespace name", group: "namespace" },
  { keyword: "pushns", summary: "Push the current namespace.", syntax: "pushns", group: "namespace" },
  { keyword: "pullns", summary: "Restore the most recently pushed namespace.", syntax: "pullns", group: "namespace" },

  { keyword: "freecode", summary: "Allocate a free code block.", syntax: "freecode", group: "memory" },
  { keyword: "freedata", summary: "Allocate a free data block.", syntax: "freedata", group: "memory" },
  { keyword: "freespace", summary: "Allocate a free space block.", syntax: "freespace", group: "memory" },
  { keyword: "freespacebyte", summary: "Set the fill byte used for freespace.", syntax: "freespacebyte value", group: "memory" },
  { keyword: "prot", summary: "Protect a region from cleanup.", syntax: "prot ...", group: "memory" },

  { keyword: "pushtable", summary: "Push the current character mapping table.", syntax: "pushtable", group: "table" },
  { keyword: "pulltable", summary: "Restore the most recently pushed character table.", syntax: "pulltable", group: "table" },

  { keyword: "spcblock", summary: "Begin an SPC700 code block.", syntax: "spcblock ...", group: "spc" },
  { keyword: "endspcblock", summary: "End an SPC700 code block.", syntax: "endspcblock", group: "spc" },

  { keyword: "struct", summary: "Begin a structure definition.", syntax: "struct name", group: "struct" },
  { keyword: "endstruct", summary: "End a structure definition.", syntax: "endstruct", group: "struct" },

  { keyword: "if", summary: "Begin a conditional block.", syntax: "if expression", group: "control" },
  { keyword: "elseif", summary: "Alternate conditional branch.", syntax: "elseif expression", group: "control" },
  { keyword: "else", summary: "Fallback conditional branch.", syntax: "else", group: "control" },
  { keyword: "endif", summary: "End a conditional block.", syntax: "endif", group: "control" },
  { keyword: "while", summary: "Begin a while loop.", syntax: "while expression", group: "control" },
  { keyword: "endwhile", summary: "End a while loop.", syntax: "endwhile", group: "control" },
  { keyword: "for", summary: "Begin a counted loop.", syntax: "for var = start..end", group: "control" },
  { keyword: "endfor", summary: "End a counted loop.", syntax: "endfor", group: "control" },

  { keyword: "macro", summary: "Begin a macro definition.", syntax: "macro name(args)", group: "macro" },
  { keyword: "endmacro", summary: "End a macro definition.", syntax: "endmacro", group: "macro" },

  { keyword: "dpbase", summary: "Set the direct page base (asar-compatible).", syntax: "dpbase $address", group: "compat" },
  { keyword: "warnings", summary: "Control warnings (asar-compatible).", syntax: "warnings ...", group: "compat" },
  { keyword: "print", summary: "Print a message at assemble time.", syntax: "print \"text\"", group: "compat" },
  { keyword: "autoclean", summary: "Auto-clean a previous freespace (asar-compatible).", syntax: "autoclean ...", group: "compat" },
  { keyword: "autoclear", summary: "Auto-clear a previous freespace (asar-compatible).", syntax: "autoclear ...", group: "compat" },
  { keyword: "table", summary: "Load a character mapping table (asar-compatible).", syntax: "table \"file\"", group: "compat" },
  { keyword: "includefrom", summary: "Assert the file was included (asar-compatible).", syntax: "includefrom \"file\"", group: "compat" },
  { keyword: "asar", summary: "Assert a minimum asar version (compat no-op).", syntax: "asar version", group: "compat" },
];

/** A case-insensitive lookup map from keyword to descriptor. */
const directiveByKeyword = new Map<string, DirectiveDescriptor>(
  directiveCatalog.map((descriptor) => [descriptor.keyword.toLowerCase(), descriptor]),
);

/**
 * Looks up a directive descriptor by keyword (case-insensitive).
 * @param {string} keyword The directive keyword.
 * @returns {DirectiveDescriptor | undefined} The descriptor, if known.
 */
export function findDirective(keyword: string): DirectiveDescriptor | undefined {
  return directiveByKeyword.get(keyword.toLowerCase());
}

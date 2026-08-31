/** Nested keyword valid after a directive (`bankcross` after `check`). */
export type DirectiveOperandDescriptor = {
  keyword: string;
  summary: string;
  syntax: string;
  operands?: readonly DirectiveOperandDescriptor[];
};

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
  /** Nested keywords valid after this directive (`bankcross`, `title`). */
  operands?: readonly DirectiveOperandDescriptor[];
  /** A coarse grouping used to organize completion. */
  group:
    | "data"
    | "layout"
    | "include"
    | "memory"
    | "namespace"
    | "table"
    | "spc"
    | "struct"
    | "control"
    | "define"
    | "macro"
    | "compat"
    | "label";
};

const op = (
  keyword: string,
  summary: string,
  syntax: string,
  operands?: readonly DirectiveOperandDescriptor[],
): DirectiveOperandDescriptor => ({
  keyword,
  summary,
  syntax,
  ...(operands ? { operands } : {}),
});

/**
 * The directive catalog. Keywords mirror the registrations in
 * `src/directives/*` plus control-flow, macro, and define forms that are
 * handled outside the directive registry.
 */
export const directiveCatalog: DirectiveDescriptor[] = [
  {
    keyword: "db",
    summary: "Emit one or more bytes.",
    syntax: "db value[, value...]",
    group: "data",
  },
  {
    keyword: "dw",
    summary: "Emit one or more 16-bit words.",
    syntax: "dw value[, value...]",
    group: "data",
  },
  {
    keyword: "dl",
    summary: "Emit one or more 24-bit long values.",
    syntax: "dl value[, value...]",
    group: "data",
  },
  {
    keyword: "dd",
    summary: "Emit one or more 32-bit double words.",
    syntax: "dd value[, value...]",
    group: "data",
  },
  {
    keyword: "dc.b",
    summary: "Emit bytes (asar-compatible data constant).",
    syntax: "dc.b value[, value...]",
    group: "data",
  },
  {
    keyword: "dc.w",
    summary: "Emit words (asar-compatible data constant).",
    syntax: "dc.w value[, value...]",
    group: "data",
  },
  {
    keyword: "dc.l",
    summary: "Emit long values (asar-compatible data constant).",
    syntax: "dc.l value[, value...]",
    group: "data",
  },

  {
    keyword: "fillbyte",
    summary: "Set the byte used by fill.",
    syntax: "fillbyte value",
    group: "memory",
  },
  {
    keyword: "fillword",
    summary: "Set the word used by fill.",
    syntax: "fillword value",
    group: "memory",
  },
  {
    keyword: "filllong",
    summary: "Set the long value used by fill.",
    syntax: "filllong value",
    group: "memory",
  },
  {
    keyword: "filldword",
    summary: "Set the double word used by fill.",
    syntax: "filldword value",
    group: "memory",
  },
  {
    keyword: "fill",
    summary: "Fill a number of bytes with the fill value.",
    syntax: "fill count",
    group: "memory",
  },
  {
    keyword: "padbyte",
    summary: "Set the byte used by pad.",
    syntax: "padbyte value",
    group: "memory",
  },
  {
    keyword: "padword",
    summary: "Set the word used by pad.",
    syntax: "padword value",
    group: "memory",
  },
  {
    keyword: "padlong",
    summary: "Set the long value used by pad.",
    syntax: "padlong value",
    group: "memory",
  },
  {
    keyword: "paddword",
    summary: "Set the double word used by pad.",
    syntax: "paddword value",
    group: "memory",
  },
  {
    keyword: "pad",
    summary: "Pad up to an address with the pad value.",
    syntax: "pad address",
    group: "memory",
  },

  {
    keyword: "incsrc",
    summary: "Assemble another source file inline.",
    syntax: 'incsrc "file.asm"',
    group: "include",
  },
  {
    keyword: "include",
    summary: "Include and assemble another source file.",
    syntax: 'include "file.asm"',
    group: "include",
  },
  {
    keyword: "includeonce",
    summary: "Guard the current file against being included more than once.",
    syntax: "includeonce",
    group: "include",
  },
  {
    keyword: "incbin",
    summary: "Embed the raw bytes of a binary file.",
    syntax: 'incbin "file.bin"[,start,length]',
    group: "include",
  },

  {
    keyword: "base",
    summary: "Set or restore the logical base address.",
    syntax: "base address|off",
    group: "layout",
    operands: [op("off", "Restore the saved physical/base address relationship.", "base off")],
  },
  {
    keyword: "org",
    summary: "Set the current output/origin address.",
    syntax: "org $address",
    group: "layout",
  },
  {
    keyword: "pushbase",
    summary: "Push the current base address.",
    syntax: "pushbase",
    group: "layout",
  },
  {
    keyword: "pullbase",
    summary: "Restore the most recently pushed base address.",
    syntax: "pullbase",
    group: "layout",
  },
  {
    keyword: "pushpc",
    summary: "Push the current program counter.",
    syntax: "pushpc",
    group: "layout",
  },
  {
    keyword: "pullpc",
    summary: "Restore the most recently pushed program counter.",
    syntax: "pullpc",
    group: "layout",
  },
  {
    keyword: "startpos",
    summary: "Set the SPC start position.",
    syntax: "startpos",
    group: "layout",
  },
  {
    keyword: "check",
    summary: "Configure bank-cross checks or enable unguarded ROM reads.",
    syntax: "check bankcross off|half|full|on | check title",
    group: "layout",
    operands: [
      {
        keyword: "bankcross",
        summary:
          "Set whether multi-byte writes may cross a bank boundary. Default is full (64 KiB).",
        syntax: "check bankcross off|half|full|on",
        operands: [
          {
            keyword: "off",
            summary: "Disable the bank-boundary check and enable mapper-specific PC wrapping.",
            syntax: "check bankcross off",
          },
          {
            keyword: "half",
            summary: "Reject writes that cross a 32 KiB half-bank boundary.",
            syntax: "check bankcross half",
          },
          {
            keyword: "full",
            summary: "Reject writes that cross a 64 KiB bank boundary (the default).",
            syntax: "check bankcross full",
          },
          {
            keyword: "on",
            summary: "Alias of full: reject writes that cross a 64 KiB bank boundary.",
            syntax: "check bankcross on",
          },
        ],
      },
      {
        keyword: "title",
        summary: "Enable read1...read4 without a default value. Does not inspect the ROM title.",
        syntax: "check title",
      },
    ],
  },
  {
    keyword: "optimize",
    summary: "Configure direct-page size optimization. Other Asar optimize families are no-ops.",
    syntax: "optimize dp none|ram|always",
    group: "layout",
    operands: [
      op("dp", "Direct-page width inference for same-bank labels.", "optimize dp none|ram|always", [
        op("none", "Disable direct-page optimization (the default).", "optimize dp none"),
        op("ram", "Allow inferred DP width for same-bank RAM labels.", "optimize dp ram"),
        op("always", "Allow inferred DP width whenever the address fits.", "optimize dp always"),
      ]),
      op(
        "address",
        "Asar address optimizer (accepted no-op in this assembler).",
        "optimize address default|ram|mirrors|none",
        [
          op(
            "default",
            "Asar default address optimization (no-op here).",
            "optimize address default",
          ),
          op(
            "ram",
            "Asar RAM-mirroring address optimization (no-op here).",
            "optimize address ram",
          ),
          op(
            "mirrors",
            "Asar mirror-aware address optimization (no-op here).",
            "optimize address mirrors",
          ),
          op("none", "Disable Asar address optimization (no-op here).", "optimize address none"),
        ],
      ),
    ],
  },
  {
    keyword: "arch",
    summary: "Select the active CPU architecture.",
    syntax: "arch 65816|spc700|spc700-raw|spc700-inline|superfx",
    group: "layout",
    operands: [
      op("65816", "Assemble 65C816 (main SNES CPU) instructions.", "arch 65816"),
      op("spc700", "Assemble SPC700 instructions (typically inside spcblock).", "arch spc700"),
      op(
        "spc700-raw",
        "Assemble a standalone SPC payload with 1:1 norom addressing.",
        "arch spc700-raw",
      ),
      op(
        "spc700-inline",
        "Asar-compatible implicit SPC blocks: later org starts a block.",
        "arch spc700-inline",
      ),
      op("superfx", "Assemble Super FX / GSU instructions.", "arch superfx"),
    ],
  },
  { keyword: "lorom", summary: "Use the LoROM memory mapper.", syntax: "lorom", group: "layout" },
  { keyword: "hirom", summary: "Use the HiROM memory mapper.", syntax: "hirom", group: "layout" },
  {
    keyword: "exlorom",
    summary: "Use the ExLoROM memory mapper.",
    syntax: "exlorom",
    group: "layout",
  },
  {
    keyword: "exhirom",
    summary: "Use the ExHiROM memory mapper.",
    syntax: "exhirom",
    group: "layout",
  },
  { keyword: "fastrom", summary: "Enable FastROM timing.", syntax: "fastrom", group: "layout" },
  {
    keyword: "sfxrom",
    summary: "Use the Super FX memory mapper.",
    syntax: "sfxrom",
    group: "layout",
  },
  { keyword: "norom", summary: "Disable the memory mapper.", syntax: "norom", group: "layout" },
  { keyword: "sa1rom", summary: "Use the SA-1 memory mapper.", syntax: "sa1rom", group: "layout" },
  {
    keyword: "fullsa1rom",
    summary: "Use the full SA-1 memory mapper.",
    syntax: "fullsa1rom",
    group: "layout",
  },

  {
    keyword: "namespace",
    summary: "Set, nest, or clear the active label namespace.",
    syntax: "namespace [name|off|nested on|nested off]",
    group: "namespace",
    operands: [
      op("off", "Leave the current namespace (pop when nested, else clear).", "namespace off"),
      op("nested", "Enable or disable nested namespace paths.", "namespace nested on|off", [
        op(
          "on",
          "Build namespace paths from successive namespace directives.",
          "namespace nested on",
        ),
        op("off", "Disable nested paths and clear the current namespace.", "namespace nested off"),
      ]),
    ],
  },
  {
    keyword: "pushns",
    summary: "Push the current namespace.",
    syntax: "pushns",
    group: "namespace",
  },
  {
    keyword: "pullns",
    summary: "Restore the most recently pushed namespace.",
    syntax: "pullns",
    group: "namespace",
  },

  {
    keyword: "freecode",
    summary: "Allocate a free code block.",
    syntax: "freecode",
    group: "memory",
  },
  {
    keyword: "freedata",
    summary: "Allocate a free data block.",
    syntax: "freedata",
    group: "memory",
  },
  {
    keyword: "freespace",
    summary: "Allocate a free space block.",
    syntax: "freespace",
    group: "memory",
  },
  {
    keyword: "freespacebyte",
    summary: "Set the fill byte used for freespace.",
    syntax: "freespacebyte value",
    group: "memory",
  },
  {
    keyword: "prot",
    summary: "Protect a region from cleanup.",
    syntax: "prot ...",
    group: "memory",
  },

  {
    keyword: "table",
    summary: "Load an asar character mapping table file (`char=hex` per line).",
    syntax: 'table "file"[,ltr|rtl]',
    group: "table",
    operands: [
      op("ltr", "Left-to-right table lines: character=hex.", 'table "file",ltr'),
      op("rtl", "Right-to-left table lines: hex=character.", 'table "file",rtl'),
    ],
  },
  {
    keyword: "cleartable",
    summary: "Reset character mappings to identity (Unicode/ASCII code points).",
    syntax: "cleartable",
    group: "table",
  },
  {
    keyword: "pushtable",
    summary: "Push the current character mapping table.",
    syntax: "pushtable",
    group: "table",
  },
  {
    keyword: "pulltable",
    summary: "Restore the most recently pushed character table.",
    syntax: "pulltable",
    group: "table",
  },

  {
    keyword: "spcblock",
    summary: "Begin an SPC700 code block.",
    syntax: "spcblock destination [nspc]",
    group: "spc",
    operands: [
      op(
        "nspc",
        "Nintendo-style transfer block with a 16-bit size placeholder.",
        "spcblock dest nspc",
      ),
    ],
  },
  {
    keyword: "endspcblock",
    summary: "End an SPC700 code block.",
    syntax: "endspcblock [execute address]",
    group: "spc",
    operands: [
      op(
        "execute",
        "Append a zero-size execute record at the given SPC address.",
        "endspcblock execute address",
      ),
    ],
  },

  {
    keyword: "struct",
    summary: "Begin a structure definition.",
    syntax: "struct name [extends parent]",
    group: "struct",
    operands: [
      op("extends", "Inherit members from an existing struct.", "struct name extends parent"),
    ],
  },
  {
    keyword: "endstruct",
    summary: "End a structure definition.",
    syntax: "endstruct [align value]",
    group: "struct",
    operands: [
      op("align", "Round the struct size/stride up to an alignment.", "endstruct align value"),
    ],
  },

  {
    keyword: "if",
    summary: "Begin a conditional block.",
    syntax: "if expression",
    group: "control",
  },
  {
    keyword: "elseif",
    summary: "Alternate conditional branch.",
    syntax: "elseif expression",
    group: "control",
  },
  { keyword: "else", summary: "Fallback conditional branch.", syntax: "else", group: "control" },
  { keyword: "endif", summary: "End a conditional block.", syntax: "endif", group: "control" },
  {
    keyword: "while",
    summary: "Begin a while loop.",
    syntax: "while expression",
    group: "control",
  },
  { keyword: "endwhile", summary: "End a while loop.", syntax: "endwhile", group: "control" },
  {
    keyword: "for",
    summary: "Begin a counted loop.",
    syntax: "for var = start..end",
    group: "control",
  },
  { keyword: "endfor", summary: "End a counted loop.", syntax: "endfor", group: "control" },

  {
    keyword: "macro",
    summary: "Begin a macro definition.",
    syntax: "macro name(args)",
    group: "macro",
  },
  { keyword: "endmacro", summary: "End a macro definition.", syntax: "endmacro", group: "macro" },

  {
    keyword: "dpbase",
    summary: "Set the direct page base (asar-compatible).",
    syntax: "dpbase $address",
    group: "compat",
  },
  {
    keyword: "warnings",
    summary: "Control warnings (asar-compatible no-op).",
    syntax: "warnings push|pull|enable|disable",
    group: "compat",
    operands: [
      op("push", "Save the current warning state (no-op here).", "warnings push"),
      op("pull", "Restore the last pushed warning state (no-op here).", "warnings pull"),
      op("enable", "Enable a warning id (no-op here).", "warnings enable id"),
      op("disable", "Disable a warning id (no-op here).", "warnings disable id"),
    ],
  },
  {
    keyword: "print",
    summary: "Print a message at assemble time.",
    syntax: 'print "text"',
    group: "compat",
  },
  {
    keyword: "assert",
    summary: "Fail the assemble if a condition is false.",
    syntax: 'assert condition[, "message"]',
    group: "compat",
  },
  {
    keyword: "error",
    summary: "Fail the assemble with a user-defined error.",
    syntax: 'error ["message"]',
    group: "compat",
  },
  {
    keyword: "warn",
    summary: "Emit a user-defined warning (asar-compatible).",
    syntax: 'warn ["message"]',
    group: "compat",
  },
  {
    keyword: "warnpc",
    summary: "Fail if the current PC is past an address (deprecated asar form).",
    syntax: "warnpc $address",
    group: "compat",
  },
  {
    keyword: "autoclean",
    summary: "Auto-clean a previous freespace (asar-compatible).",
    syntax: "autoclean ...",
    group: "compat",
  },
  {
    keyword: "autoclear",
    summary: "Auto-clear a previous freespace (asar-compatible).",
    syntax: "autoclear ...",
    group: "compat",
  },
  {
    keyword: "includefrom",
    summary: "Assert the file was included (asar-compatible).",
    syntax: 'includefrom "file"',
    group: "compat",
  },
  {
    keyword: "asar",
    summary: "Assert a minimum asar version (compat no-op).",
    syntax: "asar version",
    group: "compat",
  },

  // ca65 65816 width-state directives
  {
    keyword: ".a8",
    summary: "Set accumulator width hint to 8-bit (ca65 compatible).",
    syntax: ".a8",
    group: "compat",
  },
  {
    keyword: ".a16",
    summary: "Set accumulator width hint to 16-bit (ca65 compatible).",
    syntax: ".a16",
    group: "compat",
  },
  {
    keyword: ".i8",
    summary: "Set index register width hint to 8-bit (ca65 compatible).",
    syntax: ".i8",
    group: "compat",
  },
  {
    keyword: ".i16",
    summary: "Set index register width hint to 16-bit (ca65 compatible).",
    syntax: ".i16",
    group: "compat",
  },
  {
    keyword: ".accu",
    summary: "Set accumulator width hint (ca65 alias for .a8/.a16).",
    syntax: ".accu 8|16",
    group: "compat",
    operands: [
      op("8", "8-bit accumulator width hint.", ".accu 8"),
      op("16", "16-bit accumulator width hint.", ".accu 16"),
    ],
  },
  {
    keyword: ".index",
    summary: "Set index register width hint (ca65 alias for .i8/.i16).",
    syntax: ".index 8|16",
    group: "compat",
    operands: [
      op("8", "8-bit index width hint.", ".index 8"),
      op("16", "16-bit index width hint.", ".index 16"),
    ],
  },
  {
    keyword: ".smart",
    summary: "Enable/disable automatic M/X width tracking via SEP/REP (ca65 compatible).",
    syntax: ".smart [on|off]",
    group: "compat",
    operands: [
      op("on", "Track M/X width from SEP/REP.", ".smart on"),
      op("off", "Stop automatic M/X width tracking.", ".smart off"),
    ],
  },
  {
    keyword: ".setcpu",
    summary: "Select a CPU by name for the current SNES target (ca65 compatible).",
    syntax: '.setcpu "65816"',
    group: "compat",
  },
  {
    keyword: ".pushcpu",
    summary: "Push the current CPU onto the CPU stack (ca65 compatible).",
    syntax: ".pushcpu",
    group: "compat",
  },
  {
    keyword: ".popcpu",
    summary: "Restore the most recently pushed CPU (ca65 compatible).",
    syntax: ".popcpu",
    group: "compat",
  },
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

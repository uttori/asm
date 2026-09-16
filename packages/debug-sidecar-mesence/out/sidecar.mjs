#!/usr/bin/env node
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// packages/core/src/debug-map.ts
var init_debug_map = __esm({
  "packages/core/src/debug-map.ts"() {
    "use strict";
  }
});

// packages/core/src/address-width.ts
var init_address_width = __esm({
  "packages/core/src/address-width.ts"() {
    "use strict";
  }
});

// packages/core/src/crc32.ts
var CRC32;
var init_crc32 = __esm({
  "packages/core/src/crc32.ts"() {
    "use strict";
    CRC32 = class _CRC32 {
      /** Precomputed CRC32 table. */
      static table = _CRC32.makeCRCTable();
      /**
       * Builds the lookup table used for CRC32 computation.
       * @returns {Uint32Array} The result.
       */
      static makeCRCTable() {
        const table = new Uint32Array(256);
        for (let i = 0; i < 256; i++) {
          let c = i;
          for (let k = 0; k < 8; k++) {
            c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
          }
          table[i] = c;
        }
        return table;
      }
      /**
       * Computes the CRC32 checksum for the given data.
       * @param {number[] | Uint8Array} data A Uint8Array (or Node.js Buffer) of data.
       * @returns {number} The computed CRC32 checksum.
       */
      static compute(data) {
        let crc = 4294967295;
        for (let i = 0; i < data.length; i++) {
          crc = _CRC32.table[(crc ^ data[i]) & 255] ^ crc >>> 8;
        }
        return (crc ^ 4294967295) >>> 0;
      }
    };
  }
});

// packages/core/src/addressToLine.ts
var init_addressToLine = __esm({
  "packages/core/src/addressToLine.ts"() {
    "use strict";
  }
});

// packages/core/src/architecture-registry.ts
var init_architecture_registry = __esm({
  "packages/core/src/architecture-registry.ts"() {
    "use strict";
  }
});

// packages/core/src/source-location.ts
var init_source_location = __esm({
  "packages/core/src/source-location.ts"() {
    "use strict";
  }
});

// packages/core/src/diagnostics.ts
var init_diagnostics = __esm({
  "packages/core/src/diagnostics.ts"() {
    "use strict";
  }
});

// packages/core/src/directive-groups.ts
var CORE_DIRECTIVE_GROUPS;
var init_directive_groups = __esm({
  "packages/core/src/directive-groups.ts"() {
    "use strict";
    CORE_DIRECTIVE_GROUPS = Object.freeze([
      "data",
      "memory",
      "include",
      "layout",
      "namespace",
      "table",
      "struct",
      "control",
      "macro",
      "diagnostic"
    ]);
  }
});

// packages/core/src/ir/expression-node.ts
var init_expression_node = __esm({
  "packages/core/src/ir/expression-node.ts"() {
    "use strict";
  }
});

// packages/core/src/syntax-profile.ts
var ASAR_SYNTAX_PROFILE, NATIVE_SYNTAX_PROFILE, CA65_SYNTAX_PROFILE;
var init_syntax_profile = __esm({
  "packages/core/src/syntax-profile.ts"() {
    "use strict";
    ASAR_SYNTAX_PROFILE = Object.freeze({
      id: "asar",
      preserveLeadingWhitespace: false,
      splitColonStatements: true,
      splitRelativeLabelStatements: true,
      leadingDotLabels: true,
      directivePrefixes: Object.freeze(["@"]),
      cheapLocalPrefix: "",
      fileLocalSymbols: false
    });
    NATIVE_SYNTAX_PROFILE = Object.freeze({
      id: "native",
      preserveLeadingWhitespace: true,
      splitColonStatements: false,
      splitRelativeLabelStatements: false,
      leadingDotLabels: true,
      directivePrefixes: Object.freeze([]),
      cheapLocalPrefix: "",
      fileLocalSymbols: false
    });
    CA65_SYNTAX_PROFILE = Object.freeze({
      id: "ca65",
      preserveLeadingWhitespace: true,
      splitColonStatements: false,
      splitRelativeLabelStatements: false,
      leadingDotLabels: false,
      directivePrefixes: Object.freeze(["."]),
      cheapLocalPrefix: "@",
      fileLocalSymbols: true
    });
  }
});

// packages/core/src/file-provider.ts
var init_file_provider = __esm({
  "packages/core/src/file-provider.ts"() {
    "use strict";
  }
});

// packages/core/src/ir/normalized-command.ts
var EMPTY_COMMAND_SPAN, EMPTY_TOKEN_SPANS;
var init_normalized_command = __esm({
  "packages/core/src/ir/normalized-command.ts"() {
    "use strict";
    EMPTY_COMMAND_SPAN = Object.freeze({ start: 0, end: 0 });
    EMPTY_TOKEN_SPANS = Object.freeze([]);
  }
});

// packages/core/src/operand-syntax.ts
function parseOperandSyntax(operand) {
  const raw = operand;
  const trimmed = operand.trim();
  const normalizedUpper = trimmed.toUpperCase();
  const indexMatch = trimmed.match(/,\s*([a-z][\da-z]*)$/i);
  const indexRegister = indexMatch?.[1].toLowerCase();
  const numericBase = trimmed.replace(/^#\s*/, "").replace(/,\s*[a-z][\da-z]*$/i, "").trim();
  const explicitHex = numericBase.match(/^\$([\da-f]+)$/i);
  const explicitWidth = explicitHex ? Math.max(1, Math.ceil(explicitHex[1].length / 2)) : void 0;
  return {
    raw,
    trimmed,
    normalizedUpper,
    immediate: trimmed.startsWith("#"),
    indirect: trimmed.startsWith("(") || trimmed.startsWith("["),
    indexRegister,
    explicitWidth,
    numericSpelling: /^[\d#$%]/.test(trimmed)
  };
}
var init_operand_syntax = __esm({
  "packages/core/src/operand-syntax.ts"() {
    "use strict";
  }
});

// packages/core/src/plugin/contracts.ts
function definePlugin(plugin2) {
  return plugin2;
}
var PLUGIN_API_VERSION;
var init_contracts = __esm({
  "packages/core/src/plugin/contracts.ts"() {
    "use strict";
    PLUGIN_API_VERSION = 1;
  }
});

// packages/core/src/plugin/diagnostics.ts
var init_diagnostics2 = __esm({
  "packages/core/src/plugin/diagnostics.ts"() {
    "use strict";
  }
});

// packages/core/src/lsp/directive-catalog.ts
var descriptor, directiveCatalog, directiveCatalogMap;
var init_directive_catalog = __esm({
  "packages/core/src/lsp/directive-catalog.ts"() {
    "use strict";
    descriptor = (keyword, summary, syntax, group, operands) => ({
      keyword,
      summary,
      syntax,
      group,
      ...operands ? { operands } : {}
    });
    directiveCatalog = [
      ...[
        ["db", "Emit one or more bytes.", "db value[, value...]"],
        ["dw", "Emit one or more 16-bit words.", "dw value[, value...]"],
        ["dl", "Emit one or more 24-bit long values.", "dl value[, value...]"],
        ["dd", "Emit one or more 32-bit double words.", "dd value[, value...]"],
        ["dc.b", "Emit byte-sized data constants.", "dc.b value[, value...]"],
        ["dc.w", "Emit word-sized data constants.", "dc.w value[, value...]"],
        ["dc.l", "Emit long-sized data constants.", "dc.l value[, value...]"]
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
        ["pad", "Pad output up to an address.", "pad address"]
      ].map(([keyword, summary, syntax]) => descriptor(keyword, summary, syntax, "memory")),
      ...[
        ["incsrc", "Assemble another source file inline.", 'incsrc "file.asm"'],
        ["include", "Include and assemble another source file.", 'include "file.asm"'],
        ["includeonce", "Guard a file against repeated inclusion.", "includeonce"],
        ["incbin", "Embed bytes from a binary file.", 'incbin "file.bin"[,start,length]']
      ].map(([keyword, summary, syntax]) => descriptor(keyword, summary, syntax, "include")),
      ...[
        ["org", "Set the logical origin address.", "org address"],
        ["pushbase", "Push the current base address.", "pushbase"],
        ["pullbase", "Restore the most recently pushed base address.", "pullbase"],
        ["pushpc", "Push the current logical address.", "pushpc"],
        ["pullpc", "Restore the most recently pushed logical address.", "pullpc"]
      ].map(([keyword, summary, syntax]) => descriptor(keyword, summary, syntax, "layout")),
      descriptor("base", "Set or restore the logical base address.", "base address|off", "layout", [
        {
          keyword: "off",
          summary: "Restore the saved physical/base address relationship.",
          syntax: "base off"
        }
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
            syntax: "namespace off"
          },
          {
            keyword: "nested",
            summary: "Enable or disable nested namespace paths.",
            syntax: "namespace nested on|off",
            operands: [
              {
                keyword: "on",
                summary: "Build namespace paths from successive namespace directives.",
                syntax: "namespace nested on"
              },
              {
                keyword: "off",
                summary: "Disable nested paths and clear the current namespace.",
                syntax: "namespace nested off"
              }
            ]
          }
        ]
      ),
      descriptor("cleartable", "Reset character mappings.", "cleartable", "table"),
      descriptor("pushtable", "Push the current mapping table.", "pushtable", "table"),
      descriptor("pulltable", "Restore the most recently pushed mapping table.", "pulltable", "table"),
      descriptor("table", "Load a character mapping table.", 'table "file"[,ltr|rtl]', "table", [
        {
          keyword: "ltr",
          summary: "Left-to-right table lines: character=hex.",
          syntax: 'table "file",ltr'
        },
        {
          keyword: "rtl",
          summary: "Right-to-left table lines: hex=character.",
          syntax: 'table "file",rtl'
        }
      ]),
      descriptor(
        "struct",
        "Define a non-emitting layout with .field: skip N or typed db/dw/dl/dd fields.",
        "struct name [base | extends parent]",
        "struct",
        [
          {
            keyword: "extends",
            summary: "Inherit members from an existing struct.",
            syntax: "struct name extends parent"
          }
        ]
      ),
      descriptor(
        "endstruct",
        "End a structure definition.",
        "endstruct [align value] [count value] [firstindex value]",
        "struct",
        [
          {
            keyword: "align",
            summary: "Round the struct size/stride up to an alignment.",
            syntax: "endstruct align value"
          },
          {
            keyword: "count",
            summary: "Number of records valid for named initialization.",
            syntax: "endstruct count value [firstindex value]"
          },
          {
            keyword: "firstindex",
            summary: "First valid logical index (default zero); requires count.",
            syntax: "endstruct count value firstindex value"
          }
        ]
      ),
      descriptor(
        "datastruct",
        "Emit one complete named record at its struct address; checks fields, widths and pc().",
        "dataStruct Record[index], { field = value, bytes = [value, ...] }",
        "struct"
      ),
      descriptor(
        "datastructs",
        "Begin consecutive indexed named records; preserves logical IDs and validates placement.",
        "dataStructs Record\n  [index] = { field = value }\nendDataStructs",
        "struct"
      ),
      descriptor(
        "enddatastructs",
        "End a non-empty table of named records.",
        "endDataStructs",
        "struct"
      ),
      ...[
        ["if", "Begin a conditional block.", "if expression"],
        ["elseif", "Begin an alternate conditional branch.", "elseif expression"],
        ["else", "Begin a fallback conditional branch.", "else"],
        ["endif", "End a conditional block.", "endif"],
        ["while", "Begin a while loop.", "while expression"],
        ["endwhile", "End a while loop.", "endwhile"],
        ["for", "Begin a counted loop.", "for var = start..end"],
        ["endfor", "End a counted loop.", "endfor"]
      ].map(([keyword, summary, syntax]) => descriptor(keyword, summary, syntax, "control")),
      descriptor("macro", "Begin a macro definition.", "macro name(args)", "macro"),
      descriptor("endmacro", "End a macro definition.", "endmacro", "macro"),
      descriptor("assert", "Fail when a condition is false.", "assert condition", "diagnostic"),
      descriptor("error", "Fail with a user-defined error.", "error message", "diagnostic"),
      descriptor(
        "warnpc",
        "Fail when the logical address exceeds a bound.",
        "warnpc address",
        "diagnostic"
      )
    ];
    directiveCatalogMap = new Map(
      directiveCatalog.map((entry) => [entry.keyword.toLowerCase(), entry])
    );
  }
});

// packages/core/src/plugin/environment.ts
var init_environment = __esm({
  "packages/core/src/plugin/environment.ts"() {
    "use strict";
  }
});

// node_modules/semver/internal/constants.js
var require_constants = __commonJS({
  "node_modules/semver/internal/constants.js"(exports, module) {
    "use strict";
    var SEMVER_SPEC_VERSION = "2.0.0";
    var MAX_LENGTH = 256;
    var MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER || /* istanbul ignore next */
    9007199254740991;
    var MAX_SAFE_COMPONENT_LENGTH = 16;
    var MAX_SAFE_BUILD_LENGTH = MAX_LENGTH - 6;
    var RELEASE_TYPES = [
      "major",
      "premajor",
      "minor",
      "preminor",
      "patch",
      "prepatch",
      "prerelease"
    ];
    module.exports = {
      MAX_LENGTH,
      MAX_SAFE_COMPONENT_LENGTH,
      MAX_SAFE_BUILD_LENGTH,
      MAX_SAFE_INTEGER,
      RELEASE_TYPES,
      SEMVER_SPEC_VERSION,
      FLAG_INCLUDE_PRERELEASE: 1,
      FLAG_LOOSE: 2
    };
  }
});

// node_modules/semver/internal/debug.js
var require_debug = __commonJS({
  "node_modules/semver/internal/debug.js"(exports, module) {
    "use strict";
    var debug = typeof process === "object" && process.env && process.env.NODE_DEBUG && /\bsemver\b/i.test(process.env.NODE_DEBUG) ? (...args) => console.error("SEMVER", ...args) : () => {
    };
    module.exports = debug;
  }
});

// node_modules/semver/internal/re.js
var require_re = __commonJS({
  "node_modules/semver/internal/re.js"(exports, module) {
    "use strict";
    var {
      MAX_SAFE_COMPONENT_LENGTH,
      MAX_SAFE_BUILD_LENGTH,
      MAX_LENGTH
    } = require_constants();
    var debug = require_debug();
    exports = module.exports = {};
    var re = exports.re = [];
    var safeRe = exports.safeRe = [];
    var src = exports.src = [];
    var safeSrc = exports.safeSrc = [];
    var t = exports.t = {};
    var R = 0;
    var LETTERDASHNUMBER = "[a-zA-Z0-9-]";
    var safeRegexReplacements = [
      ["\\s", 1],
      ["\\d", MAX_LENGTH],
      [LETTERDASHNUMBER, MAX_SAFE_BUILD_LENGTH]
    ];
    var makeSafeRegex = (value) => {
      for (const [token, max] of safeRegexReplacements) {
        value = value.split(`${token}*`).join(`${token}{0,${max}}`).split(`${token}+`).join(`${token}{1,${max}}`);
      }
      return value;
    };
    var createToken = (name, value, isGlobal) => {
      const safe = makeSafeRegex(value);
      const index = R++;
      debug(name, index, value);
      t[name] = index;
      src[index] = value;
      safeSrc[index] = safe;
      re[index] = new RegExp(value, isGlobal ? "g" : void 0);
      safeRe[index] = new RegExp(safe, isGlobal ? "g" : void 0);
    };
    createToken("NUMERICIDENTIFIER", "0|[1-9]\\d*");
    createToken("NUMERICIDENTIFIERLOOSE", "\\d+");
    createToken("NONNUMERICIDENTIFIER", `\\d*[a-zA-Z-]${LETTERDASHNUMBER}*`);
    createToken("MAINVERSION", `(${src[t.NUMERICIDENTIFIER]})\\.(${src[t.NUMERICIDENTIFIER]})\\.(${src[t.NUMERICIDENTIFIER]})`);
    createToken("MAINVERSIONLOOSE", `(${src[t.NUMERICIDENTIFIERLOOSE]})\\.(${src[t.NUMERICIDENTIFIERLOOSE]})\\.(${src[t.NUMERICIDENTIFIERLOOSE]})`);
    createToken("PRERELEASEIDENTIFIER", `(?:${src[t.NONNUMERICIDENTIFIER]}|${src[t.NUMERICIDENTIFIER]})`);
    createToken("PRERELEASEIDENTIFIERLOOSE", `(?:${src[t.NONNUMERICIDENTIFIER]}|${src[t.NUMERICIDENTIFIERLOOSE]})`);
    createToken("PRERELEASE", `(?:-(${src[t.PRERELEASEIDENTIFIER]}(?:\\.${src[t.PRERELEASEIDENTIFIER]})*))`);
    createToken("PRERELEASELOOSE", `(?:-?(${src[t.PRERELEASEIDENTIFIERLOOSE]}(?:\\.${src[t.PRERELEASEIDENTIFIERLOOSE]})*))`);
    createToken("BUILDIDENTIFIER", `${LETTERDASHNUMBER}+`);
    createToken("BUILD", `(?:\\+(${src[t.BUILDIDENTIFIER]}(?:\\.${src[t.BUILDIDENTIFIER]})*))`);
    createToken("FULLPLAIN", `v?${src[t.MAINVERSION]}${src[t.PRERELEASE]}?${src[t.BUILD]}?`);
    createToken("FULL", `^${src[t.FULLPLAIN]}$`);
    createToken("LOOSEPLAIN", `[v=\\s]*${src[t.MAINVERSIONLOOSE]}${src[t.PRERELEASELOOSE]}?${src[t.BUILD]}?`);
    createToken("LOOSE", `^${src[t.LOOSEPLAIN]}$`);
    createToken("GTLT", "((?:<|>)?=?)");
    createToken("XRANGEIDENTIFIERLOOSE", `${src[t.NUMERICIDENTIFIERLOOSE]}|x|X|\\*`);
    createToken("XRANGEIDENTIFIER", `${src[t.NUMERICIDENTIFIER]}|x|X|\\*`);
    createToken("XRANGEPLAIN", `[v=\\s]*(${src[t.XRANGEIDENTIFIER]})(?:\\.(${src[t.XRANGEIDENTIFIER]})(?:\\.(${src[t.XRANGEIDENTIFIER]})(?:${src[t.PRERELEASE]})?${src[t.BUILD]}?)?)?`);
    createToken("XRANGEPLAINLOOSE", `[v=\\s]*(${src[t.XRANGEIDENTIFIERLOOSE]})(?:\\.(${src[t.XRANGEIDENTIFIERLOOSE]})(?:\\.(${src[t.XRANGEIDENTIFIERLOOSE]})(?:${src[t.PRERELEASELOOSE]})?${src[t.BUILD]}?)?)?`);
    createToken("XRANGE", `^${src[t.GTLT]}\\s*${src[t.XRANGEPLAIN]}$`);
    createToken("XRANGELOOSE", `^${src[t.GTLT]}\\s*${src[t.XRANGEPLAINLOOSE]}$`);
    createToken("COERCEPLAIN", `${"(^|[^\\d])(\\d{1,"}${MAX_SAFE_COMPONENT_LENGTH}})(?:\\.(\\d{1,${MAX_SAFE_COMPONENT_LENGTH}}))?(?:\\.(\\d{1,${MAX_SAFE_COMPONENT_LENGTH}}))?`);
    createToken("COERCE", `${src[t.COERCEPLAIN]}(?:$|[^\\d])`);
    createToken("COERCEFULL", src[t.COERCEPLAIN] + `(?:${src[t.PRERELEASE]})?(?:${src[t.BUILD]})?(?:$|[^\\d])`);
    createToken("COERCERTL", src[t.COERCE], true);
    createToken("COERCERTLFULL", src[t.COERCEFULL], true);
    createToken("LONETILDE", "(?:~>?)");
    createToken("TILDETRIM", `(\\s*)${src[t.LONETILDE]}\\s+`, true);
    exports.tildeTrimReplace = "$1~";
    createToken("TILDE", `^${src[t.LONETILDE]}${src[t.XRANGEPLAIN]}$`);
    createToken("TILDELOOSE", `^${src[t.LONETILDE]}${src[t.XRANGEPLAINLOOSE]}$`);
    createToken("LONECARET", "(?:\\^)");
    createToken("CARETTRIM", `(\\s*)${src[t.LONECARET]}\\s+`, true);
    exports.caretTrimReplace = "$1^";
    createToken("CARET", `^${src[t.LONECARET]}${src[t.XRANGEPLAIN]}$`);
    createToken("CARETLOOSE", `^${src[t.LONECARET]}${src[t.XRANGEPLAINLOOSE]}$`);
    createToken("COMPARATORLOOSE", `^${src[t.GTLT]}\\s*(${src[t.LOOSEPLAIN]})$|^$`);
    createToken("COMPARATOR", `^${src[t.GTLT]}\\s*(${src[t.FULLPLAIN]})$|^$`);
    createToken("COMPARATORTRIM", `(\\s*)${src[t.GTLT]}\\s*(${src[t.LOOSEPLAIN]}|${src[t.XRANGEPLAIN]})`, true);
    exports.comparatorTrimReplace = "$1$2$3";
    createToken("HYPHENRANGE", `^\\s*(${src[t.XRANGEPLAIN]})\\s+-\\s+(${src[t.XRANGEPLAIN]})\\s*$`);
    createToken("HYPHENRANGELOOSE", `^\\s*(${src[t.XRANGEPLAINLOOSE]})\\s+-\\s+(${src[t.XRANGEPLAINLOOSE]})\\s*$`);
    createToken("STAR", "(<|>)?=?\\s*\\*");
    createToken("GTE0", "^\\s*>=\\s*0\\.0\\.0\\s*$");
    createToken("GTE0PRE", "^\\s*>=\\s*0\\.0\\.0-0\\s*$");
  }
});

// node_modules/semver/internal/parse-options.js
var require_parse_options = __commonJS({
  "node_modules/semver/internal/parse-options.js"(exports, module) {
    "use strict";
    var looseOption = Object.freeze({ loose: true });
    var emptyOpts = Object.freeze({});
    var parseOptions = (options) => {
      if (!options) {
        return emptyOpts;
      }
      if (typeof options !== "object") {
        return looseOption;
      }
      return options;
    };
    module.exports = parseOptions;
  }
});

// node_modules/semver/internal/identifiers.js
var require_identifiers = __commonJS({
  "node_modules/semver/internal/identifiers.js"(exports, module) {
    "use strict";
    var numeric = /^[0-9]+$/;
    var compareIdentifiers = (a, b) => {
      if (typeof a === "number" && typeof b === "number") {
        return a === b ? 0 : a < b ? -1 : 1;
      }
      const anum = numeric.test(a);
      const bnum = numeric.test(b);
      if (anum && bnum) {
        a = +a;
        b = +b;
      }
      return a === b ? 0 : anum && !bnum ? -1 : bnum && !anum ? 1 : a < b ? -1 : 1;
    };
    var rcompareIdentifiers = (a, b) => compareIdentifiers(b, a);
    module.exports = {
      compareIdentifiers,
      rcompareIdentifiers
    };
  }
});

// node_modules/semver/classes/semver.js
var require_semver = __commonJS({
  "node_modules/semver/classes/semver.js"(exports, module) {
    "use strict";
    var debug = require_debug();
    var { MAX_LENGTH, MAX_SAFE_INTEGER } = require_constants();
    var { safeRe: re, t } = require_re();
    var parseOptions = require_parse_options();
    var { compareIdentifiers } = require_identifiers();
    var isPrereleaseIdentifier = (prerelease, identifier) => {
      const identifiers = identifier.split(".");
      if (identifiers.length > prerelease.length) {
        return false;
      }
      for (let i = 0; i < identifiers.length; i++) {
        if (compareIdentifiers(prerelease[i], identifiers[i]) !== 0) {
          return false;
        }
      }
      return true;
    };
    var SemVer = class _SemVer {
      constructor(version, options) {
        options = parseOptions(options);
        if (version instanceof _SemVer) {
          if (version.loose === !!options.loose && version.includePrerelease === !!options.includePrerelease) {
            return version;
          } else {
            version = version.version;
          }
        } else if (typeof version !== "string") {
          throw new TypeError(`Invalid version. Must be a string. Got type "${typeof version}".`);
        }
        if (version.length > MAX_LENGTH) {
          throw new TypeError(
            `version is longer than ${MAX_LENGTH} characters`
          );
        }
        debug("SemVer", version, options);
        this.options = options;
        this.loose = !!options.loose;
        this.includePrerelease = !!options.includePrerelease;
        const m = version.trim().match(options.loose ? re[t.LOOSE] : re[t.FULL]);
        if (!m) {
          throw new TypeError(`Invalid Version: ${version}`);
        }
        this.raw = version;
        this.major = +m[1];
        this.minor = +m[2];
        this.patch = +m[3];
        if (this.major > MAX_SAFE_INTEGER || this.major < 0) {
          throw new TypeError("Invalid major version");
        }
        if (this.minor > MAX_SAFE_INTEGER || this.minor < 0) {
          throw new TypeError("Invalid minor version");
        }
        if (this.patch > MAX_SAFE_INTEGER || this.patch < 0) {
          throw new TypeError("Invalid patch version");
        }
        if (!m[4]) {
          this.prerelease = [];
        } else {
          this.prerelease = m[4].split(".").map((id) => {
            if (/^[0-9]+$/.test(id)) {
              const num = +id;
              if (num >= 0 && num < MAX_SAFE_INTEGER) {
                return num;
              }
            }
            return id;
          });
        }
        this.build = m[5] ? m[5].split(".") : [];
        this.format();
      }
      format() {
        this.version = `${this.major}.${this.minor}.${this.patch}`;
        if (this.prerelease.length) {
          this.version += `-${this.prerelease.join(".")}`;
        }
        return this.version;
      }
      toString() {
        return this.version;
      }
      compare(other) {
        debug("SemVer.compare", this.version, this.options, other);
        if (!(other instanceof _SemVer)) {
          if (typeof other === "string" && other === this.version) {
            return 0;
          }
          other = new _SemVer(other, this.options);
        }
        if (other.version === this.version) {
          return 0;
        }
        return this.compareMain(other) || this.comparePre(other);
      }
      compareMain(other) {
        if (!(other instanceof _SemVer)) {
          other = new _SemVer(other, this.options);
        }
        if (this.major < other.major) {
          return -1;
        }
        if (this.major > other.major) {
          return 1;
        }
        if (this.minor < other.minor) {
          return -1;
        }
        if (this.minor > other.minor) {
          return 1;
        }
        if (this.patch < other.patch) {
          return -1;
        }
        if (this.patch > other.patch) {
          return 1;
        }
        return 0;
      }
      comparePre(other) {
        if (!(other instanceof _SemVer)) {
          other = new _SemVer(other, this.options);
        }
        if (this.prerelease.length && !other.prerelease.length) {
          return -1;
        } else if (!this.prerelease.length && other.prerelease.length) {
          return 1;
        } else if (!this.prerelease.length && !other.prerelease.length) {
          return 0;
        }
        let i = 0;
        do {
          const a = this.prerelease[i];
          const b = other.prerelease[i];
          debug("prerelease compare", i, a, b);
          if (a === void 0 && b === void 0) {
            return 0;
          } else if (b === void 0) {
            return 1;
          } else if (a === void 0) {
            return -1;
          } else if (a === b) {
            continue;
          } else {
            return compareIdentifiers(a, b);
          }
        } while (++i);
      }
      compareBuild(other) {
        if (!(other instanceof _SemVer)) {
          other = new _SemVer(other, this.options);
        }
        let i = 0;
        do {
          const a = this.build[i];
          const b = other.build[i];
          debug("build compare", i, a, b);
          if (a === void 0 && b === void 0) {
            return 0;
          } else if (b === void 0) {
            return 1;
          } else if (a === void 0) {
            return -1;
          } else if (a === b) {
            continue;
          } else {
            return compareIdentifiers(a, b);
          }
        } while (++i);
      }
      // preminor will bump the version up to the next minor release, and immediately
      // down to pre-release. premajor and prepatch work the same way.
      inc(release, identifier, identifierBase) {
        if (release.startsWith("pre")) {
          if (!identifier && identifierBase === false) {
            throw new Error("invalid increment argument: identifier is empty");
          }
          if (identifier) {
            const match = `-${identifier}`.match(this.options.loose ? re[t.PRERELEASELOOSE] : re[t.PRERELEASE]);
            if (!match || match[1] !== identifier) {
              throw new Error(`invalid identifier: ${identifier}`);
            }
          }
        }
        switch (release) {
          case "premajor":
            this.prerelease.length = 0;
            this.patch = 0;
            this.minor = 0;
            this.major++;
            this.inc("pre", identifier, identifierBase);
            break;
          case "preminor":
            this.prerelease.length = 0;
            this.patch = 0;
            this.minor++;
            this.inc("pre", identifier, identifierBase);
            break;
          case "prepatch":
            this.prerelease.length = 0;
            this.inc("patch", identifier, identifierBase);
            this.inc("pre", identifier, identifierBase);
            break;
          // If the input is a non-prerelease version, this acts the same as
          // prepatch.
          case "prerelease":
            if (this.prerelease.length === 0) {
              this.inc("patch", identifier, identifierBase);
            }
            this.inc("pre", identifier, identifierBase);
            break;
          case "release":
            if (this.prerelease.length === 0) {
              throw new Error(`version ${this.raw} is not a prerelease`);
            }
            this.prerelease.length = 0;
            break;
          case "major":
            if (this.minor !== 0 || this.patch !== 0 || this.prerelease.length === 0) {
              this.major++;
            }
            this.minor = 0;
            this.patch = 0;
            this.prerelease = [];
            break;
          case "minor":
            if (this.patch !== 0 || this.prerelease.length === 0) {
              this.minor++;
            }
            this.patch = 0;
            this.prerelease = [];
            break;
          case "patch":
            if (this.prerelease.length === 0) {
              this.patch++;
            }
            this.prerelease = [];
            break;
          // This probably shouldn't be used publicly.
          // 1.0.0 'pre' would become 1.0.0-0 which is the wrong direction.
          case "pre": {
            const base = Number(identifierBase) ? 1 : 0;
            if (this.prerelease.length === 0) {
              this.prerelease = [base];
            } else {
              let i = this.prerelease.length;
              while (--i >= 0) {
                if (typeof this.prerelease[i] === "number") {
                  this.prerelease[i]++;
                  i = -2;
                }
              }
              if (i === -1) {
                if (identifier === this.prerelease.join(".") && identifierBase === false) {
                  throw new Error("invalid increment argument: identifier already exists");
                }
                this.prerelease.push(base);
              }
            }
            if (identifier) {
              let prerelease = [identifier, base];
              if (identifierBase === false) {
                prerelease = [identifier];
              }
              if (isPrereleaseIdentifier(this.prerelease, identifier)) {
                const prereleaseBase = this.prerelease[identifier.split(".").length];
                if (isNaN(prereleaseBase)) {
                  this.prerelease = prerelease;
                }
              } else {
                this.prerelease = prerelease;
              }
            }
            break;
          }
          default:
            throw new Error(`invalid increment argument: ${release}`);
        }
        this.raw = this.format();
        if (this.build.length) {
          this.raw += `+${this.build.join(".")}`;
        }
        return this;
      }
    };
    module.exports = SemVer;
  }
});

// node_modules/semver/functions/parse.js
var require_parse = __commonJS({
  "node_modules/semver/functions/parse.js"(exports, module) {
    "use strict";
    var SemVer = require_semver();
    var parse = (version, options, throwErrors = false) => {
      if (version instanceof SemVer) {
        return version;
      }
      try {
        return new SemVer(version, options);
      } catch (er) {
        if (!throwErrors) {
          return null;
        }
        throw er;
      }
    };
    module.exports = parse;
  }
});

// node_modules/semver/functions/valid.js
var require_valid = __commonJS({
  "node_modules/semver/functions/valid.js"(exports, module) {
    "use strict";
    var parse = require_parse();
    var valid = (version, options) => {
      const v = parse(version, options);
      return v ? v.version : null;
    };
    module.exports = valid;
  }
});

// node_modules/semver/functions/clean.js
var require_clean = __commonJS({
  "node_modules/semver/functions/clean.js"(exports, module) {
    "use strict";
    var parse = require_parse();
    var clean = (version, options) => {
      const s = parse(version.trim().replace(/^[=v]+/, ""), options);
      return s ? s.version : null;
    };
    module.exports = clean;
  }
});

// node_modules/semver/functions/inc.js
var require_inc = __commonJS({
  "node_modules/semver/functions/inc.js"(exports, module) {
    "use strict";
    var SemVer = require_semver();
    var inc = (version, release, options, identifier, identifierBase) => {
      if (typeof options === "string") {
        identifierBase = identifier;
        identifier = options;
        options = void 0;
      }
      try {
        return new SemVer(
          version instanceof SemVer ? version.version : version,
          options
        ).inc(release, identifier, identifierBase).version;
      } catch (er) {
        return null;
      }
    };
    module.exports = inc;
  }
});

// node_modules/semver/functions/diff.js
var require_diff = __commonJS({
  "node_modules/semver/functions/diff.js"(exports, module) {
    "use strict";
    var parse = require_parse();
    var diff = (version1, version2) => {
      const v1 = parse(version1, null, true);
      const v2 = parse(version2, null, true);
      const comparison = v1.compare(v2);
      if (comparison === 0) {
        return null;
      }
      const v1Higher = comparison > 0;
      const highVersion = v1Higher ? v1 : v2;
      const lowVersion = v1Higher ? v2 : v1;
      const highHasPre = !!highVersion.prerelease.length;
      const lowHasPre = !!lowVersion.prerelease.length;
      if (lowHasPre && !highHasPre) {
        if (!lowVersion.patch && !lowVersion.minor) {
          return "major";
        }
        if (lowVersion.compareMain(highVersion) === 0) {
          if (lowVersion.minor && !lowVersion.patch) {
            return "minor";
          }
          return "patch";
        }
      }
      const prefix = highHasPre ? "pre" : "";
      if (v1.major !== v2.major) {
        return prefix + "major";
      }
      if (v1.minor !== v2.minor) {
        return prefix + "minor";
      }
      if (v1.patch !== v2.patch) {
        return prefix + "patch";
      }
      return "prerelease";
    };
    module.exports = diff;
  }
});

// node_modules/semver/functions/major.js
var require_major = __commonJS({
  "node_modules/semver/functions/major.js"(exports, module) {
    "use strict";
    var SemVer = require_semver();
    var major = (a, loose) => new SemVer(a, loose).major;
    module.exports = major;
  }
});

// node_modules/semver/functions/minor.js
var require_minor = __commonJS({
  "node_modules/semver/functions/minor.js"(exports, module) {
    "use strict";
    var SemVer = require_semver();
    var minor = (a, loose) => new SemVer(a, loose).minor;
    module.exports = minor;
  }
});

// node_modules/semver/functions/patch.js
var require_patch = __commonJS({
  "node_modules/semver/functions/patch.js"(exports, module) {
    "use strict";
    var SemVer = require_semver();
    var patch = (a, loose) => new SemVer(a, loose).patch;
    module.exports = patch;
  }
});

// node_modules/semver/functions/prerelease.js
var require_prerelease = __commonJS({
  "node_modules/semver/functions/prerelease.js"(exports, module) {
    "use strict";
    var parse = require_parse();
    var prerelease = (version, options) => {
      const parsed = parse(version, options);
      return parsed && parsed.prerelease.length ? parsed.prerelease : null;
    };
    module.exports = prerelease;
  }
});

// node_modules/semver/functions/compare.js
var require_compare = __commonJS({
  "node_modules/semver/functions/compare.js"(exports, module) {
    "use strict";
    var SemVer = require_semver();
    var compare = (a, b, loose) => new SemVer(a, loose).compare(new SemVer(b, loose));
    module.exports = compare;
  }
});

// node_modules/semver/functions/rcompare.js
var require_rcompare = __commonJS({
  "node_modules/semver/functions/rcompare.js"(exports, module) {
    "use strict";
    var compare = require_compare();
    var rcompare = (a, b, loose) => compare(b, a, loose);
    module.exports = rcompare;
  }
});

// node_modules/semver/functions/compare-loose.js
var require_compare_loose = __commonJS({
  "node_modules/semver/functions/compare-loose.js"(exports, module) {
    "use strict";
    var compare = require_compare();
    var compareLoose = (a, b) => compare(a, b, true);
    module.exports = compareLoose;
  }
});

// node_modules/semver/functions/compare-build.js
var require_compare_build = __commonJS({
  "node_modules/semver/functions/compare-build.js"(exports, module) {
    "use strict";
    var SemVer = require_semver();
    var compareBuild = (a, b, loose) => {
      const versionA = new SemVer(a, loose);
      const versionB = new SemVer(b, loose);
      return versionA.compare(versionB) || versionA.compareBuild(versionB);
    };
    module.exports = compareBuild;
  }
});

// node_modules/semver/functions/sort.js
var require_sort = __commonJS({
  "node_modules/semver/functions/sort.js"(exports, module) {
    "use strict";
    var compareBuild = require_compare_build();
    var sort = (list, loose) => list.sort((a, b) => compareBuild(a, b, loose));
    module.exports = sort;
  }
});

// node_modules/semver/functions/rsort.js
var require_rsort = __commonJS({
  "node_modules/semver/functions/rsort.js"(exports, module) {
    "use strict";
    var compareBuild = require_compare_build();
    var rsort = (list, loose) => list.sort((a, b) => compareBuild(b, a, loose));
    module.exports = rsort;
  }
});

// node_modules/semver/functions/gt.js
var require_gt = __commonJS({
  "node_modules/semver/functions/gt.js"(exports, module) {
    "use strict";
    var compare = require_compare();
    var gt = (a, b, loose) => compare(a, b, loose) > 0;
    module.exports = gt;
  }
});

// node_modules/semver/functions/lt.js
var require_lt = __commonJS({
  "node_modules/semver/functions/lt.js"(exports, module) {
    "use strict";
    var compare = require_compare();
    var lt = (a, b, loose) => compare(a, b, loose) < 0;
    module.exports = lt;
  }
});

// node_modules/semver/functions/eq.js
var require_eq = __commonJS({
  "node_modules/semver/functions/eq.js"(exports, module) {
    "use strict";
    var compare = require_compare();
    var eq = (a, b, loose) => compare(a, b, loose) === 0;
    module.exports = eq;
  }
});

// node_modules/semver/functions/neq.js
var require_neq = __commonJS({
  "node_modules/semver/functions/neq.js"(exports, module) {
    "use strict";
    var compare = require_compare();
    var neq = (a, b, loose) => compare(a, b, loose) !== 0;
    module.exports = neq;
  }
});

// node_modules/semver/functions/gte.js
var require_gte = __commonJS({
  "node_modules/semver/functions/gte.js"(exports, module) {
    "use strict";
    var compare = require_compare();
    var gte = (a, b, loose) => compare(a, b, loose) >= 0;
    module.exports = gte;
  }
});

// node_modules/semver/functions/lte.js
var require_lte = __commonJS({
  "node_modules/semver/functions/lte.js"(exports, module) {
    "use strict";
    var compare = require_compare();
    var lte = (a, b, loose) => compare(a, b, loose) <= 0;
    module.exports = lte;
  }
});

// node_modules/semver/functions/cmp.js
var require_cmp = __commonJS({
  "node_modules/semver/functions/cmp.js"(exports, module) {
    "use strict";
    var eq = require_eq();
    var neq = require_neq();
    var gt = require_gt();
    var gte = require_gte();
    var lt = require_lt();
    var lte = require_lte();
    var cmp = (a, op2, b, loose) => {
      switch (op2) {
        case "===":
          if (typeof a === "object") {
            a = a.version;
          }
          if (typeof b === "object") {
            b = b.version;
          }
          return a === b;
        case "!==":
          if (typeof a === "object") {
            a = a.version;
          }
          if (typeof b === "object") {
            b = b.version;
          }
          return a !== b;
        case "":
        case "=":
        case "==":
          return eq(a, b, loose);
        case "!=":
          return neq(a, b, loose);
        case ">":
          return gt(a, b, loose);
        case ">=":
          return gte(a, b, loose);
        case "<":
          return lt(a, b, loose);
        case "<=":
          return lte(a, b, loose);
        default:
          throw new TypeError(`Invalid operator: ${op2}`);
      }
    };
    module.exports = cmp;
  }
});

// node_modules/semver/functions/coerce.js
var require_coerce = __commonJS({
  "node_modules/semver/functions/coerce.js"(exports, module) {
    "use strict";
    var SemVer = require_semver();
    var parse = require_parse();
    var { safeRe: re, t } = require_re();
    var coerce = (version, options) => {
      if (version instanceof SemVer) {
        return version;
      }
      if (typeof version === "number") {
        version = String(version);
      }
      if (typeof version !== "string") {
        return null;
      }
      options = options || {};
      let match = null;
      if (!options.rtl) {
        match = version.match(options.includePrerelease ? re[t.COERCEFULL] : re[t.COERCE]);
      } else {
        const coerceRtlRegex = options.includePrerelease ? re[t.COERCERTLFULL] : re[t.COERCERTL];
        let next;
        while ((next = coerceRtlRegex.exec(version)) && (!match || match.index + match[0].length !== version.length)) {
          if (!match || next.index + next[0].length !== match.index + match[0].length) {
            match = next;
          }
          coerceRtlRegex.lastIndex = next.index + next[1].length + next[2].length;
        }
        coerceRtlRegex.lastIndex = -1;
      }
      if (match === null) {
        return null;
      }
      const major = match[2];
      const minor = match[3] || "0";
      const patch = match[4] || "0";
      const prerelease = options.includePrerelease && match[5] ? `-${match[5]}` : "";
      const build = options.includePrerelease && match[6] ? `+${match[6]}` : "";
      return parse(`${major}.${minor}.${patch}${prerelease}${build}`, options);
    };
    module.exports = coerce;
  }
});

// node_modules/semver/functions/truncate.js
var require_truncate = __commonJS({
  "node_modules/semver/functions/truncate.js"(exports, module) {
    "use strict";
    var parse = require_parse();
    var constants = require_constants();
    var SemVer = require_semver();
    var truncate = (version, truncation, options) => {
      if (!constants.RELEASE_TYPES.includes(truncation)) {
        return null;
      }
      const clonedVersion = cloneInputVersion(version, options);
      return clonedVersion && doTruncation(clonedVersion, truncation);
    };
    var cloneInputVersion = (version, options) => {
      const versionStringToParse = version instanceof SemVer ? version.version : version;
      return parse(versionStringToParse, options);
    };
    var doTruncation = (version, truncation) => {
      if (isPrerelease(truncation)) {
        return version.version;
      }
      version.prerelease = [];
      switch (truncation) {
        case "major":
          version.minor = 0;
          version.patch = 0;
          break;
        case "minor":
          version.patch = 0;
          break;
      }
      return version.format();
    };
    var isPrerelease = (type) => {
      return type.startsWith("pre");
    };
    module.exports = truncate;
  }
});

// node_modules/semver/internal/lrucache.js
var require_lrucache = __commonJS({
  "node_modules/semver/internal/lrucache.js"(exports, module) {
    "use strict";
    var LRUCache = class {
      constructor() {
        this.max = 1e3;
        this.map = /* @__PURE__ */ new Map();
      }
      get(key) {
        const value = this.map.get(key);
        if (value === void 0) {
          return void 0;
        } else {
          this.map.delete(key);
          this.map.set(key, value);
          return value;
        }
      }
      delete(key) {
        return this.map.delete(key);
      }
      set(key, value) {
        const deleted = this.delete(key);
        if (!deleted && value !== void 0) {
          if (this.map.size >= this.max) {
            const firstKey = this.map.keys().next().value;
            this.delete(firstKey);
          }
          this.map.set(key, value);
        }
        return this;
      }
    };
    module.exports = LRUCache;
  }
});

// node_modules/semver/classes/range.js
var require_range = __commonJS({
  "node_modules/semver/classes/range.js"(exports, module) {
    "use strict";
    var SPACE_CHARACTERS = /\s+/g;
    var Range = class _Range {
      constructor(range, options) {
        options = parseOptions(options);
        if (range instanceof _Range) {
          if (range.loose === !!options.loose && range.includePrerelease === !!options.includePrerelease) {
            return range;
          } else {
            return new _Range(range.raw, options);
          }
        }
        if (range instanceof Comparator) {
          this.raw = range.value;
          this.set = [[range]];
          this.formatted = void 0;
          return this;
        }
        this.options = options;
        this.loose = !!options.loose;
        this.includePrerelease = !!options.includePrerelease;
        this.raw = range.trim().replace(SPACE_CHARACTERS, " ");
        this.set = this.raw.split("||").map((r) => this.parseRange(r.trim())).filter((c) => c.length);
        if (!this.set.length) {
          throw new TypeError(`Invalid SemVer Range: ${this.raw}`);
        }
        if (this.set.length > 1) {
          const first = this.set[0];
          this.set = this.set.filter((c) => !isNullSet(c[0]));
          if (this.set.length === 0) {
            this.set = [first];
          } else if (this.set.length > 1) {
            for (const c of this.set) {
              if (c.length === 1 && isAny(c[0])) {
                this.set = [c];
                break;
              }
            }
          }
        }
        this.formatted = void 0;
      }
      get range() {
        if (this.formatted === void 0) {
          this.formatted = "";
          for (let i = 0; i < this.set.length; i++) {
            if (i > 0) {
              this.formatted += "||";
            }
            const comps = this.set[i];
            for (let k = 0; k < comps.length; k++) {
              if (k > 0) {
                this.formatted += " ";
              }
              this.formatted += comps[k].toString().trim();
            }
          }
        }
        return this.formatted;
      }
      format() {
        return this.range;
      }
      toString() {
        return this.range;
      }
      parseRange(range) {
        range = range.replace(BUILDSTRIPRE, "");
        const memoOpts = (this.options.includePrerelease && FLAG_INCLUDE_PRERELEASE) | (this.options.loose && FLAG_LOOSE);
        const memoKey = memoOpts + ":" + range;
        const cached = cache.get(memoKey);
        if (cached) {
          return cached;
        }
        const loose = this.options.loose;
        const hr = loose ? re[t.HYPHENRANGELOOSE] : re[t.HYPHENRANGE];
        range = range.replace(hr, hyphenReplace(this.options.includePrerelease));
        debug("hyphen replace", range);
        range = range.replace(re[t.COMPARATORTRIM], comparatorTrimReplace);
        debug("comparator trim", range);
        range = range.replace(re[t.TILDETRIM], tildeTrimReplace);
        debug("tilde trim", range);
        range = range.replace(re[t.CARETTRIM], caretTrimReplace);
        debug("caret trim", range);
        let rangeList = range.split(" ").map((comp) => parseComparator(comp, this.options)).join(" ").split(/\s+/).map((comp) => replaceGTE0(comp, this.options));
        if (loose) {
          rangeList = rangeList.filter((comp) => {
            debug("loose invalid filter", comp, this.options);
            return !!comp.match(re[t.COMPARATORLOOSE]);
          });
        }
        debug("range list", rangeList);
        const rangeMap = /* @__PURE__ */ new Map();
        const comparators = rangeList.map((comp) => new Comparator(comp, this.options));
        for (const comp of comparators) {
          if (isNullSet(comp)) {
            return [comp];
          }
          rangeMap.set(comp.value, comp);
        }
        if (rangeMap.size > 1 && rangeMap.has("")) {
          rangeMap.delete("");
        }
        const result = [...rangeMap.values()];
        cache.set(memoKey, result);
        return result;
      }
      intersects(range, options) {
        if (!(range instanceof _Range)) {
          throw new TypeError("a Range is required");
        }
        return this.set.some((thisComparators) => {
          return isSatisfiable(thisComparators, options) && range.set.some((rangeComparators) => {
            return isSatisfiable(rangeComparators, options) && thisComparators.every((thisComparator) => {
              return rangeComparators.every((rangeComparator) => {
                return thisComparator.intersects(rangeComparator, options);
              });
            });
          });
        });
      }
      // if ANY of the sets match ALL of its comparators, then pass
      test(version) {
        if (!version) {
          return false;
        }
        if (typeof version === "string") {
          try {
            version = new SemVer(version, this.options);
          } catch (er) {
            return false;
          }
        }
        for (let i = 0; i < this.set.length; i++) {
          if (testSet(this.set[i], version, this.options)) {
            return true;
          }
        }
        return false;
      }
    };
    module.exports = Range;
    var LRU = require_lrucache();
    var cache = new LRU();
    var parseOptions = require_parse_options();
    var Comparator = require_comparator();
    var debug = require_debug();
    var SemVer = require_semver();
    var {
      safeRe: re,
      src,
      t,
      comparatorTrimReplace,
      tildeTrimReplace,
      caretTrimReplace
    } = require_re();
    var { FLAG_INCLUDE_PRERELEASE, FLAG_LOOSE } = require_constants();
    var BUILDSTRIPRE = new RegExp(src[t.BUILD], "g");
    var isNullSet = (c) => c.value === "<0.0.0-0";
    var isAny = (c) => c.value === "";
    var isSatisfiable = (comparators, options) => {
      let result = true;
      const remainingComparators = comparators.slice();
      let testComparator = remainingComparators.pop();
      while (result && remainingComparators.length) {
        result = remainingComparators.every((otherComparator) => {
          return testComparator.intersects(otherComparator, options);
        });
        testComparator = remainingComparators.pop();
      }
      return result;
    };
    var parseComparator = (comp, options) => {
      comp = comp.replace(re[t.BUILD], "");
      debug("comp", comp, options);
      comp = replaceCarets(comp, options);
      debug("caret", comp);
      comp = replaceTildes(comp, options);
      debug("tildes", comp);
      comp = replaceXRanges(comp, options);
      debug("xrange", comp);
      comp = replaceStars(comp, options);
      debug("stars", comp);
      return comp;
    };
    var isX = (id) => !id || id.toLowerCase() === "x" || id === "*";
    var invalidXRangeOrder = (M, m, p) => isX(M) && !isX(m) || isX(m) && p && !isX(p);
    var replaceTildes = (comp, options) => {
      return comp.trim().split(/\s+/).map((c) => replaceTilde(c, options)).join(" ");
    };
    var replaceTilde = (comp, options) => {
      const r = options.loose ? re[t.TILDELOOSE] : re[t.TILDE];
      const z = options.includePrerelease ? "-0" : "";
      return comp.replace(r, (_, M, m, p, pr) => {
        debug("tilde", comp, _, M, m, p, pr);
        let ret;
        if (isX(M)) {
          ret = "";
        } else if (isX(m)) {
          ret = `>=${M}.0.0${z} <${+M + 1}.0.0-0`;
        } else if (isX(p)) {
          ret = `>=${M}.${m}.0${z} <${M}.${+m + 1}.0-0`;
        } else if (pr) {
          debug("replaceTilde pr", pr);
          ret = `>=${M}.${m}.${p}-${pr} <${M}.${+m + 1}.0-0`;
        } else {
          ret = `>=${M}.${m}.${p} <${M}.${+m + 1}.0-0`;
        }
        debug("tilde return", ret);
        return ret;
      });
    };
    var replaceCarets = (comp, options) => {
      return comp.trim().split(/\s+/).map((c) => replaceCaret(c, options)).join(" ");
    };
    var replaceCaret = (comp, options) => {
      debug("caret", comp, options);
      const r = options.loose ? re[t.CARETLOOSE] : re[t.CARET];
      const z = options.includePrerelease ? "-0" : "";
      return comp.replace(r, (_, M, m, p, pr) => {
        debug("caret", comp, _, M, m, p, pr);
        let ret;
        if (isX(M)) {
          ret = "";
        } else if (isX(m)) {
          ret = `>=${M}.0.0${z} <${+M + 1}.0.0-0`;
        } else if (isX(p)) {
          if (M === "0") {
            ret = `>=${M}.${m}.0${z} <${M}.${+m + 1}.0-0`;
          } else {
            ret = `>=${M}.${m}.0${z} <${+M + 1}.0.0-0`;
          }
        } else if (pr) {
          debug("replaceCaret pr", pr);
          if (M === "0") {
            if (m === "0") {
              ret = `>=${M}.${m}.${p}-${pr} <${M}.${m}.${+p + 1}-0`;
            } else {
              ret = `>=${M}.${m}.${p}-${pr} <${M}.${+m + 1}.0-0`;
            }
          } else {
            ret = `>=${M}.${m}.${p}-${pr} <${+M + 1}.0.0-0`;
          }
        } else {
          debug("no pr");
          if (M === "0") {
            if (m === "0") {
              ret = `>=${M}.${m}.${p} <${M}.${m}.${+p + 1}-0`;
            } else {
              ret = `>=${M}.${m}.${p} <${M}.${+m + 1}.0-0`;
            }
          } else {
            ret = `>=${M}.${m}.${p} <${+M + 1}.0.0-0`;
          }
        }
        debug("caret return", ret);
        return ret;
      });
    };
    var replaceXRanges = (comp, options) => {
      debug("replaceXRanges", comp, options);
      return comp.split(/\s+/).map((c) => replaceXRange(c, options)).join(" ");
    };
    var replaceXRange = (comp, options) => {
      comp = comp.trim();
      const r = options.loose ? re[t.XRANGELOOSE] : re[t.XRANGE];
      return comp.replace(r, (ret, gtlt, M, m, p, pr) => {
        debug("xRange", comp, ret, gtlt, M, m, p, pr);
        if (invalidXRangeOrder(M, m, p)) {
          return comp;
        }
        const xM = isX(M);
        const xm = xM || isX(m);
        const xp = xm || isX(p);
        const anyX = xp;
        if (gtlt === "=" && anyX) {
          gtlt = "";
        }
        pr = options.includePrerelease ? "-0" : "";
        if (xM) {
          if (gtlt === ">" || gtlt === "<") {
            ret = "<0.0.0-0";
          } else {
            ret = "*";
          }
        } else if (gtlt && anyX) {
          if (xm) {
            m = 0;
          }
          p = 0;
          if (gtlt === ">") {
            gtlt = ">=";
            if (xm) {
              M = +M + 1;
              m = 0;
              p = 0;
            } else {
              m = +m + 1;
              p = 0;
            }
          } else if (gtlt === "<=") {
            gtlt = "<";
            if (xm) {
              M = +M + 1;
            } else {
              m = +m + 1;
            }
          }
          if (gtlt === "<") {
            pr = "-0";
          }
          ret = `${gtlt + M}.${m}.${p}${pr}`;
        } else if (xm) {
          ret = `>=${M}.0.0${pr} <${+M + 1}.0.0-0`;
        } else if (xp) {
          ret = `>=${M}.${m}.0${pr} <${M}.${+m + 1}.0-0`;
        }
        debug("xRange return", ret);
        return ret;
      });
    };
    var replaceStars = (comp, options) => {
      debug("replaceStars", comp, options);
      return comp.trim().replace(re[t.STAR], "");
    };
    var replaceGTE0 = (comp, options) => {
      debug("replaceGTE0", comp, options);
      return comp.trim().replace(re[options.includePrerelease ? t.GTE0PRE : t.GTE0], "");
    };
    var hyphenReplace = (incPr) => ($0, from, fM, fm, fp, fpr, fb, to, tM, tm, tp, tpr) => {
      if (isX(fM)) {
        from = "";
      } else if (isX(fm)) {
        from = `>=${fM}.0.0${incPr ? "-0" : ""}`;
      } else if (isX(fp)) {
        from = `>=${fM}.${fm}.0${incPr ? "-0" : ""}`;
      } else if (fpr) {
        from = `>=${from}`;
      } else {
        from = `>=${from}${incPr ? "-0" : ""}`;
      }
      if (isX(tM)) {
        to = "";
      } else if (isX(tm)) {
        to = `<${+tM + 1}.0.0-0`;
      } else if (isX(tp)) {
        to = `<${tM}.${+tm + 1}.0-0`;
      } else if (tpr) {
        to = `<=${tM}.${tm}.${tp}-${tpr}`;
      } else if (incPr) {
        to = `<${tM}.${tm}.${+tp + 1}-0`;
      } else {
        to = `<=${to}`;
      }
      return `${from} ${to}`.trim();
    };
    var testSet = (set, version, options) => {
      for (let i = 0; i < set.length; i++) {
        if (!set[i].test(version)) {
          return false;
        }
      }
      if (version.prerelease.length && !options.includePrerelease) {
        for (let i = 0; i < set.length; i++) {
          debug(set[i].semver);
          if (set[i].semver === Comparator.ANY) {
            continue;
          }
          if (set[i].semver.prerelease.length > 0) {
            const allowed = set[i].semver;
            if (allowed.major === version.major && allowed.minor === version.minor && allowed.patch === version.patch) {
              return true;
            }
          }
        }
        return false;
      }
      return true;
    };
  }
});

// node_modules/semver/classes/comparator.js
var require_comparator = __commonJS({
  "node_modules/semver/classes/comparator.js"(exports, module) {
    "use strict";
    var ANY = /* @__PURE__ */ Symbol("SemVer ANY");
    var Comparator = class _Comparator {
      static get ANY() {
        return ANY;
      }
      constructor(comp, options) {
        options = parseOptions(options);
        if (comp instanceof _Comparator) {
          if (comp.loose === !!options.loose) {
            return comp;
          } else {
            comp = comp.value;
          }
        }
        comp = comp.trim().split(/\s+/).join(" ");
        debug("comparator", comp, options);
        this.options = options;
        this.loose = !!options.loose;
        this.parse(comp);
        if (this.semver === ANY) {
          this.value = "";
        } else {
          this.value = this.operator + this.semver.version;
        }
        debug("comp", this);
      }
      parse(comp) {
        const r = this.options.loose ? re[t.COMPARATORLOOSE] : re[t.COMPARATOR];
        const m = comp.match(r);
        if (!m) {
          throw new TypeError(`Invalid comparator: ${comp}`);
        }
        this.operator = m[1] !== void 0 ? m[1] : "";
        if (this.operator === "=") {
          this.operator = "";
        }
        if (!m[2]) {
          this.semver = ANY;
        } else {
          this.semver = new SemVer(m[2], this.options.loose);
        }
      }
      toString() {
        return this.value;
      }
      test(version) {
        debug("Comparator.test", version, this.options.loose);
        if (this.semver === ANY || version === ANY) {
          return true;
        }
        if (typeof version === "string") {
          try {
            version = new SemVer(version, this.options);
          } catch (er) {
            return false;
          }
        }
        return cmp(version, this.operator, this.semver, this.options);
      }
      intersects(comp, options) {
        if (!(comp instanceof _Comparator)) {
          throw new TypeError("a Comparator is required");
        }
        if (this.operator === "") {
          if (this.value === "") {
            return true;
          }
          return new Range(comp.value, options).test(this.value);
        } else if (comp.operator === "") {
          if (comp.value === "") {
            return true;
          }
          return new Range(this.value, options).test(comp.semver);
        }
        options = parseOptions(options);
        if (options.includePrerelease && (this.value === "<0.0.0-0" || comp.value === "<0.0.0-0")) {
          return false;
        }
        if (!options.includePrerelease && (this.value.startsWith("<0.0.0") || comp.value.startsWith("<0.0.0"))) {
          return false;
        }
        if (this.operator.startsWith(">") && comp.operator.startsWith(">")) {
          return true;
        }
        if (this.operator.startsWith("<") && comp.operator.startsWith("<")) {
          return true;
        }
        if (this.semver.version === comp.semver.version && this.operator.includes("=") && comp.operator.includes("=")) {
          return true;
        }
        if (cmp(this.semver, "<", comp.semver, options) && this.operator.startsWith(">") && comp.operator.startsWith("<")) {
          return true;
        }
        if (cmp(this.semver, ">", comp.semver, options) && this.operator.startsWith("<") && comp.operator.startsWith(">")) {
          return true;
        }
        return false;
      }
    };
    module.exports = Comparator;
    var parseOptions = require_parse_options();
    var { safeRe: re, t } = require_re();
    var cmp = require_cmp();
    var debug = require_debug();
    var SemVer = require_semver();
    var Range = require_range();
  }
});

// node_modules/semver/functions/satisfies.js
var require_satisfies = __commonJS({
  "node_modules/semver/functions/satisfies.js"(exports, module) {
    "use strict";
    var Range = require_range();
    var satisfies = (version, range, options) => {
      try {
        range = new Range(range, options);
      } catch (er) {
        return false;
      }
      return range.test(version);
    };
    module.exports = satisfies;
  }
});

// node_modules/semver/ranges/to-comparators.js
var require_to_comparators = __commonJS({
  "node_modules/semver/ranges/to-comparators.js"(exports, module) {
    "use strict";
    var Range = require_range();
    var toComparators = (range, options) => new Range(range, options).set.map((comp) => comp.map((c) => c.value).join(" ").trim().split(" "));
    module.exports = toComparators;
  }
});

// node_modules/semver/ranges/max-satisfying.js
var require_max_satisfying = __commonJS({
  "node_modules/semver/ranges/max-satisfying.js"(exports, module) {
    "use strict";
    var SemVer = require_semver();
    var Range = require_range();
    var maxSatisfying = (versions, range, options) => {
      let max = null;
      let maxSV = null;
      let rangeObj = null;
      try {
        rangeObj = new Range(range, options);
      } catch (er) {
        return null;
      }
      versions.forEach((v) => {
        if (rangeObj.test(v)) {
          if (!max || maxSV.compare(v) === -1) {
            max = v;
            maxSV = new SemVer(max, options);
          }
        }
      });
      return max;
    };
    module.exports = maxSatisfying;
  }
});

// node_modules/semver/ranges/min-satisfying.js
var require_min_satisfying = __commonJS({
  "node_modules/semver/ranges/min-satisfying.js"(exports, module) {
    "use strict";
    var SemVer = require_semver();
    var Range = require_range();
    var minSatisfying = (versions, range, options) => {
      let min = null;
      let minSV = null;
      let rangeObj = null;
      try {
        rangeObj = new Range(range, options);
      } catch (er) {
        return null;
      }
      versions.forEach((v) => {
        if (rangeObj.test(v)) {
          if (!min || minSV.compare(v) === 1) {
            min = v;
            minSV = new SemVer(min, options);
          }
        }
      });
      return min;
    };
    module.exports = minSatisfying;
  }
});

// node_modules/semver/ranges/min-version.js
var require_min_version = __commonJS({
  "node_modules/semver/ranges/min-version.js"(exports, module) {
    "use strict";
    var SemVer = require_semver();
    var Range = require_range();
    var gt = require_gt();
    var minVersion = (range, loose) => {
      range = new Range(range, loose);
      let minver = new SemVer("0.0.0");
      if (range.test(minver)) {
        return minver;
      }
      minver = new SemVer("0.0.0-0");
      if (range.test(minver)) {
        return minver;
      }
      minver = null;
      for (let i = 0; i < range.set.length; ++i) {
        const comparators = range.set[i];
        let setMin = null;
        comparators.forEach((comparator) => {
          const compver = new SemVer(comparator.semver.version);
          switch (comparator.operator) {
            case ">":
              if (compver.prerelease.length === 0) {
                compver.patch++;
              } else {
                compver.prerelease.push(0);
              }
              compver.raw = compver.format();
            /* fallthrough */
            case "":
            case ">=":
              if (!setMin || gt(compver, setMin)) {
                setMin = compver;
              }
              break;
            case "<":
            case "<=":
              break;
            /* istanbul ignore next */
            default:
              throw new Error(`Unexpected operation: ${comparator.operator}`);
          }
        });
        if (setMin && (!minver || gt(minver, setMin))) {
          minver = setMin;
        }
      }
      if (minver && range.test(minver)) {
        return minver;
      }
      return null;
    };
    module.exports = minVersion;
  }
});

// node_modules/semver/ranges/valid.js
var require_valid2 = __commonJS({
  "node_modules/semver/ranges/valid.js"(exports, module) {
    "use strict";
    var Range = require_range();
    var validRange = (range, options) => {
      try {
        return new Range(range, options).range || "*";
      } catch (er) {
        return null;
      }
    };
    module.exports = validRange;
  }
});

// node_modules/semver/ranges/outside.js
var require_outside = __commonJS({
  "node_modules/semver/ranges/outside.js"(exports, module) {
    "use strict";
    var SemVer = require_semver();
    var Comparator = require_comparator();
    var { ANY } = Comparator;
    var Range = require_range();
    var satisfies = require_satisfies();
    var gt = require_gt();
    var lt = require_lt();
    var lte = require_lte();
    var gte = require_gte();
    var outside = (version, range, hilo, options) => {
      version = new SemVer(version, options);
      range = new Range(range, options);
      let gtfn, ltefn, ltfn, comp, ecomp;
      switch (hilo) {
        case ">":
          gtfn = gt;
          ltefn = lte;
          ltfn = lt;
          comp = ">";
          ecomp = ">=";
          break;
        case "<":
          gtfn = lt;
          ltefn = gte;
          ltfn = gt;
          comp = "<";
          ecomp = "<=";
          break;
        default:
          throw new TypeError('Must provide a hilo val of "<" or ">"');
      }
      if (satisfies(version, range, options)) {
        return false;
      }
      for (let i = 0; i < range.set.length; ++i) {
        const comparators = range.set[i];
        let high = null;
        let low = null;
        comparators.forEach((comparator) => {
          if (comparator.semver === ANY) {
            comparator = new Comparator(">=0.0.0");
          }
          high = high || comparator;
          low = low || comparator;
          if (gtfn(comparator.semver, high.semver, options)) {
            high = comparator;
          } else if (ltfn(comparator.semver, low.semver, options)) {
            low = comparator;
          }
        });
        if (high.operator === comp || high.operator === ecomp) {
          return false;
        }
        if ((!low.operator || low.operator === comp) && ltefn(version, low.semver)) {
          return false;
        } else if (low.operator === ecomp && ltfn(version, low.semver)) {
          return false;
        }
      }
      return true;
    };
    module.exports = outside;
  }
});

// node_modules/semver/ranges/gtr.js
var require_gtr = __commonJS({
  "node_modules/semver/ranges/gtr.js"(exports, module) {
    "use strict";
    var outside = require_outside();
    var gtr = (version, range, options) => outside(version, range, ">", options);
    module.exports = gtr;
  }
});

// node_modules/semver/ranges/ltr.js
var require_ltr = __commonJS({
  "node_modules/semver/ranges/ltr.js"(exports, module) {
    "use strict";
    var outside = require_outside();
    var ltr = (version, range, options) => outside(version, range, "<", options);
    module.exports = ltr;
  }
});

// node_modules/semver/ranges/intersects.js
var require_intersects = __commonJS({
  "node_modules/semver/ranges/intersects.js"(exports, module) {
    "use strict";
    var Range = require_range();
    var intersects = (r1, r2, options) => {
      r1 = new Range(r1, options);
      r2 = new Range(r2, options);
      return r1.intersects(r2, options);
    };
    module.exports = intersects;
  }
});

// node_modules/semver/ranges/simplify.js
var require_simplify = __commonJS({
  "node_modules/semver/ranges/simplify.js"(exports, module) {
    "use strict";
    var satisfies = require_satisfies();
    var compare = require_compare();
    module.exports = (versions, range, options) => {
      const set = [];
      let first = null;
      let prev = null;
      const v = versions.sort((a, b) => compare(a, b, options));
      for (const version of v) {
        const included = satisfies(version, range, options);
        if (included) {
          prev = version;
          if (!first) {
            first = version;
          }
        } else {
          if (prev) {
            set.push([first, prev]);
          }
          prev = null;
          first = null;
        }
      }
      if (first) {
        set.push([first, null]);
      }
      const ranges = [];
      for (const [min, max] of set) {
        if (min === max) {
          ranges.push(min);
        } else if (!max && min === v[0]) {
          ranges.push("*");
        } else if (!max) {
          ranges.push(`>=${min}`);
        } else if (min === v[0]) {
          ranges.push(`<=${max}`);
        } else {
          ranges.push(`${min} - ${max}`);
        }
      }
      const simplified = ranges.join(" || ");
      const original = typeof range.raw === "string" ? range.raw : String(range);
      return simplified.length < original.length ? simplified : range;
    };
  }
});

// node_modules/semver/ranges/subset.js
var require_subset = __commonJS({
  "node_modules/semver/ranges/subset.js"(exports, module) {
    "use strict";
    var Range = require_range();
    var Comparator = require_comparator();
    var { ANY } = Comparator;
    var satisfies = require_satisfies();
    var compare = require_compare();
    var subset = (sub, dom, options = {}) => {
      if (sub === dom) {
        return true;
      }
      sub = new Range(sub, options);
      dom = new Range(dom, options);
      let sawNonNull = false;
      OUTER: for (const simpleSub of sub.set) {
        for (const simpleDom of dom.set) {
          const isSub = simpleSubset(simpleSub, simpleDom, options);
          sawNonNull = sawNonNull || isSub !== null;
          if (isSub) {
            continue OUTER;
          }
        }
        if (sawNonNull) {
          return false;
        }
      }
      return true;
    };
    var minimumVersionWithPreRelease = [new Comparator(">=0.0.0-0")];
    var minimumVersion = [new Comparator(">=0.0.0")];
    var simpleSubset = (sub, dom, options) => {
      if (sub === dom) {
        return true;
      }
      if (sub.length === 1 && sub[0].semver === ANY) {
        if (dom.length === 1 && dom[0].semver === ANY) {
          return true;
        } else if (options.includePrerelease) {
          sub = minimumVersionWithPreRelease;
        } else {
          sub = minimumVersion;
        }
      }
      if (dom.length === 1 && dom[0].semver === ANY) {
        if (options.includePrerelease) {
          return true;
        } else {
          dom = minimumVersion;
        }
      }
      const eqSet = /* @__PURE__ */ new Set();
      let gt, lt;
      for (const c of sub) {
        if (c.operator === ">" || c.operator === ">=") {
          gt = higherGT(gt, c, options);
        } else if (c.operator === "<" || c.operator === "<=") {
          lt = lowerLT(lt, c, options);
        } else {
          eqSet.add(c.semver);
        }
      }
      if (eqSet.size > 1) {
        return null;
      }
      let gtltComp;
      if (gt && lt) {
        gtltComp = compare(gt.semver, lt.semver, options);
        if (gtltComp > 0) {
          return null;
        } else if (gtltComp === 0 && (gt.operator !== ">=" || lt.operator !== "<=")) {
          return null;
        }
      }
      for (const eq of eqSet) {
        if (gt && !satisfies(eq, String(gt), options)) {
          return null;
        }
        if (lt && !satisfies(eq, String(lt), options)) {
          return null;
        }
        for (const c of dom) {
          if (!satisfies(eq, String(c), options)) {
            return false;
          }
        }
        return true;
      }
      let higher, lower;
      let hasDomLT, hasDomGT;
      let needDomLTPre = lt && !options.includePrerelease && lt.semver.prerelease.length ? lt.semver : false;
      let needDomGTPre = gt && !options.includePrerelease && gt.semver.prerelease.length ? gt.semver : false;
      if (needDomLTPre && needDomLTPre.prerelease.length === 1 && lt.operator === "<" && needDomLTPre.prerelease[0] === 0) {
        needDomLTPre = false;
      }
      for (const c of dom) {
        hasDomGT = hasDomGT || c.operator === ">" || c.operator === ">=";
        hasDomLT = hasDomLT || c.operator === "<" || c.operator === "<=";
        if (gt) {
          if (needDomGTPre) {
            if (c.semver.prerelease && c.semver.prerelease.length && c.semver.major === needDomGTPre.major && c.semver.minor === needDomGTPre.minor && c.semver.patch === needDomGTPre.patch) {
              needDomGTPre = false;
            }
          }
          if (c.operator === ">" || c.operator === ">=") {
            higher = higherGT(gt, c, options);
            if (higher === c && higher !== gt) {
              return false;
            }
          } else if (gt.operator === ">=" && !c.test(gt.semver)) {
            return false;
          }
        }
        if (lt) {
          if (needDomLTPre) {
            if (c.semver.prerelease && c.semver.prerelease.length && c.semver.major === needDomLTPre.major && c.semver.minor === needDomLTPre.minor && c.semver.patch === needDomLTPre.patch) {
              needDomLTPre = false;
            }
          }
          if (c.operator === "<" || c.operator === "<=") {
            lower = lowerLT(lt, c, options);
            if (lower === c && lower !== lt) {
              return false;
            }
          } else if (lt.operator === "<=" && !c.test(lt.semver)) {
            return false;
          }
        }
        if (!c.operator && (lt || gt) && gtltComp !== 0) {
          return false;
        }
      }
      if (gt && hasDomLT && !lt && gtltComp !== 0) {
        return false;
      }
      if (lt && hasDomGT && !gt && gtltComp !== 0) {
        return false;
      }
      if (needDomGTPre || needDomLTPre) {
        return false;
      }
      return true;
    };
    var higherGT = (a, b, options) => {
      if (!a) {
        return b;
      }
      const comp = compare(a.semver, b.semver, options);
      return comp > 0 ? a : comp < 0 ? b : b.operator === ">" && a.operator === ">=" ? b : a;
    };
    var lowerLT = (a, b, options) => {
      if (!a) {
        return b;
      }
      const comp = compare(a.semver, b.semver, options);
      return comp < 0 ? a : comp > 0 ? b : b.operator === "<" && a.operator === "<=" ? b : a;
    };
    module.exports = subset;
  }
});

// node_modules/semver/index.js
var require_semver2 = __commonJS({
  "node_modules/semver/index.js"(exports, module) {
    "use strict";
    var internalRe = require_re();
    var constants = require_constants();
    var SemVer = require_semver();
    var identifiers = require_identifiers();
    var parse = require_parse();
    var valid = require_valid();
    var clean = require_clean();
    var inc = require_inc();
    var diff = require_diff();
    var major = require_major();
    var minor = require_minor();
    var patch = require_patch();
    var prerelease = require_prerelease();
    var compare = require_compare();
    var rcompare = require_rcompare();
    var compareLoose = require_compare_loose();
    var compareBuild = require_compare_build();
    var sort = require_sort();
    var rsort = require_rsort();
    var gt = require_gt();
    var lt = require_lt();
    var eq = require_eq();
    var neq = require_neq();
    var gte = require_gte();
    var lte = require_lte();
    var cmp = require_cmp();
    var coerce = require_coerce();
    var truncate = require_truncate();
    var Comparator = require_comparator();
    var Range = require_range();
    var satisfies = require_satisfies();
    var toComparators = require_to_comparators();
    var maxSatisfying = require_max_satisfying();
    var minSatisfying = require_min_satisfying();
    var minVersion = require_min_version();
    var validRange = require_valid2();
    var outside = require_outside();
    var gtr = require_gtr();
    var ltr = require_ltr();
    var intersects = require_intersects();
    var simplifyRange = require_simplify();
    var subset = require_subset();
    module.exports = {
      parse,
      valid,
      clean,
      inc,
      diff,
      major,
      minor,
      patch,
      prerelease,
      compare,
      rcompare,
      compareLoose,
      compareBuild,
      sort,
      rsort,
      gt,
      lt,
      eq,
      neq,
      gte,
      lte,
      cmp,
      coerce,
      truncate,
      Comparator,
      Range,
      satisfies,
      toComparators,
      maxSatisfying,
      minSatisfying,
      minVersion,
      validRange,
      outside,
      gtr,
      ltr,
      intersects,
      simplifyRange,
      subset,
      SemVer,
      re: internalRe.re,
      src: internalRe.src,
      tokens: internalRe.t,
      SEMVER_SPEC_VERSION: constants.SEMVER_SPEC_VERSION,
      RELEASE_TYPES: constants.RELEASE_TYPES,
      compareIdentifiers: identifiers.compareIdentifiers,
      rcompareIdentifiers: identifiers.rcompareIdentifiers
    };
  }
});

// packages/core/src/plugin/manager.ts
var import_semver;
var init_manager = __esm({
  "packages/core/src/plugin/manager.ts"() {
    "use strict";
    import_semver = __toESM(require_semver2(), 1);
  }
});

// packages/core/src/plugin/session-state.ts
var init_session_state = __esm({
  "packages/core/src/plugin/session-state.ts"() {
    "use strict";
  }
});

// packages/core/src/plugin/index.ts
var init_plugin = __esm({
  "packages/core/src/plugin/index.ts"() {
    "use strict";
    init_contracts();
    init_diagnostics2();
    init_environment();
    init_manager();
    init_session_state();
  }
});

// packages/core/src/services/assembly-front-end-service.ts
var init_assembly_front_end_service = __esm({
  "packages/core/src/services/assembly-front-end-service.ts"() {
    "use strict";
  }
});

// packages/core/src/services/command-lowering-service.ts
var init_command_lowering_service = __esm({
  "packages/core/src/services/command-lowering-service.ts"() {
    "use strict";
  }
});

// packages/core/src/assembler.ts
var init_assembler = __esm({
  "packages/core/src/assembler.ts"() {
    "use strict";
  }
});

// packages/core/src/architecture-types.ts
var createEncoderRuntime;
var init_architecture_types = __esm({
  "packages/core/src/architecture-types.ts"() {
    "use strict";
    createEncoderRuntime = (context) => ({
      operandResolver: context.operands,
      write1: (value) => context.emission.write1(value),
      write2: (value) => context.emission.write2(value),
      write3: (value) => context.emission.write3(value),
      writeByte: (value) => context.emission.writeByte(value),
      writeBytes: (values) => context.emission.writeBytes(values),
      writeValue: (value, width, endianness) => context.emission.writeValue(value, width, endianness),
      get currentTargetAddress() {
        return context.sizing.getCurrentAddress();
      },
      get enforceResolvedLabels() {
        return context.branches.enforceResolvedLabels();
      },
      symbolScope: {
        findNextLabel: (label, referenceAddress) => context.branches.findNextLabel(label, referenceAddress),
        findPreviousLabel: (label, referenceAddress) => context.branches.findPreviousLabel(label, referenceAddress)
      },
      diagnostics: context.diagnostics
    });
  }
});

// packages/core/src/decoder-types.ts
var Uint8ArrayDecoderSource;
var init_decoder_types = __esm({
  "packages/core/src/decoder-types.ts"() {
    "use strict";
    Uint8ArrayDecoderSource = class {
      #bytes;
      constructor(bytes) {
        this.#bytes = Uint8Array.from(bytes);
      }
      /**
       * The length of the byte source.
       * @returns {number} The length of the byte source.
       */
      get length() {
        return this.#bytes.length;
      }
      /**
       * Reads a byte from the byte source.
       * @param {number} offset The offset to read from.
       * @returns {number | undefined} The byte at the offset, or undefined if the offset is out of bounds.
       */
      readByte(offset) {
        if (!Number.isInteger(offset) || offset < 0 || offset >= this.#bytes.length) return void 0;
        return this.#bytes[offset];
      }
      /**
       * Reads bytes from the byte source.
       * @param {number} offset The offset to read from.
       * @param {number} length The length to read.
       * @returns {Uint8Array | undefined} The bytes at the offset and length, or undefined if the offset or length is out of bounds.
       */
      readBytes(offset, length) {
        if (!Number.isInteger(offset) || !Number.isInteger(length) || offset < 0 || length < 0) {
          return void 0;
        }
        const end = offset + length;
        if (!Number.isSafeInteger(end) || end > this.#bytes.length) return void 0;
        return this.#bytes.slice(offset, end);
      }
    };
  }
});

// packages/core/src/ir/assembly-tree.ts
var init_assembly_tree = __esm({
  "packages/core/src/ir/assembly-tree.ts"() {
    "use strict";
  }
});

// packages/core/src/lsp/overlay-file-provider.ts
var init_overlay_file_provider = __esm({
  "packages/core/src/lsp/overlay-file-provider.ts"() {
    "use strict";
  }
});

// packages/core/src/lsp/root-analysis-cache.ts
var init_root_analysis_cache = __esm({
  "packages/core/src/lsp/root-analysis-cache.ts"() {
    "use strict";
  }
});

// packages/core/src/lsp/workspace-index.ts
var init_workspace_index = __esm({
  "packages/core/src/lsp/workspace-index.ts"() {
    "use strict";
  }
});

// packages/core/src/lsp/position-lookup.ts
var init_position_lookup = __esm({
  "packages/core/src/lsp/position-lookup.ts"() {
    "use strict";
  }
});

// packages/core/src/lsp/instruction-catalog.ts
var init_instruction_catalog = __esm({
  "packages/core/src/lsp/instruction-catalog.ts"() {
    "use strict";
  }
});

// packages/core/src/lsp/catalog.ts
var init_catalog = __esm({
  "packages/core/src/lsp/catalog.ts"() {
    "use strict";
  }
});

// packages/core/src/lsp/project-outline.ts
var init_project_outline = __esm({
  "packages/core/src/lsp/project-outline.ts"() {
    "use strict";
  }
});

// packages/core/src/lsp/index.ts
var init_lsp = __esm({
  "packages/core/src/lsp/index.ts"() {
    "use strict";
    init_overlay_file_provider();
    init_root_analysis_cache();
    init_workspace_index();
    init_position_lookup();
    init_instruction_catalog();
    init_directive_catalog();
    init_catalog();
    init_project_outline();
  }
});

// packages/core/src/index.ts
var init_src = __esm({
  "packages/core/src/index.ts"() {
    "use strict";
    init_assembler();
    init_architecture_types();
    init_decoder_types();
    init_architecture_registry();
    init_address_width();
    init_crc32();
    init_addressToLine();
    init_debug_map();
    init_operand_syntax();
    init_syntax_profile();
    init_diagnostics();
    init_directive_groups();
    init_source_location();
    init_file_provider();
    init_assembly_tree();
    init_expression_node();
    init_normalized_command();
    init_assembly_front_end_service();
    init_command_lowering_service();
    init_lsp();
    init_plugin();
    init_plugin();
  }
});

// packages/plugin-snes/src/architectures/65816-spec.ts
function buildCpu65816Catalog() {
  const grouped = /* @__PURE__ */ new Map();
  for (const specification2 of cpu65816Specifications) {
    const addressingMode = {
      mode: specification2.mode,
      syntax: specification2.syntax,
      opcode: specification2.opcode[0],
      ...specification2.minimumSize === specification2.maximumSize ? { size: specification2.minimumSize } : {}
    };
    const descriptor2 = grouped.get(specification2.mnemonic);
    if (descriptor2) descriptor2.modes.push(addressingMode);
    else {
      grouped.set(specification2.mnemonic, {
        mnemonic: specification2.mnemonic,
        summary: specification2.summary,
        modes: [addressingMode]
      });
    }
  }
  return [...grouped.values()].sort((left, right) => left.mnemonic.localeCompare(right.mnemonic));
}
var mode, cpu65816Modes, opcodeRows, summaries, conditionalBranches, flowFor, effects, entries, cpu65816Specifications;
var init_spec = __esm({
  "packages/plugin-snes/src/architectures/65816-spec.ts"() {
    "use strict";
    mode = (id, syntax, minimumSize, maximumSize = minimumSize, widthFlag) => ({
      id,
      syntax,
      minimumSize,
      maximumSize,
      ...widthFlag ? { widthFlag } : {}
    });
    cpu65816Modes = Object.freeze({
      imp: mode("implied", "", 1),
      acc: mode("accumulator", "", 1),
      sig: mode("signature", "#const", 2),
      immM: mode("immediate", "#const", 2, 3, "m"),
      immX: mode("immediate", "#const", 2, 3, "x"),
      imm16: mode("immediate16", "addr", 3),
      dp: mode("direct", "dp", 2),
      dpx: mode("directIndexedX", "dp,x", 2),
      dpy: mode("directIndexedY", "dp,y", 2),
      dpi: mode("directIndirect", "(dp)", 2),
      dil: mode("directIndirectLong", "[dp]", 2),
      dix: mode("directIndexedXIndirect", "(dp,x)", 2),
      diy: mode("directIndirectIndexedY", "(dp),y", 2),
      dily: mode("directIndirectLongIndexedY", "[dp],y", 2),
      sr: mode("stackRelative", "sr,s", 2),
      sriy: mode("stackRelativeIndirectIndexedY", "(sr,s),y", 2),
      abs: mode("absolute", "addr", 3),
      abx: mode("absoluteIndexedX", "addr,x", 3),
      aby: mode("absoluteIndexedY", "addr,y", 3),
      long: mode("absoluteLong", "long", 4),
      longx: mode("absoluteLongIndexedX", "long,x", 4),
      rel8: mode("relative", "label", 2),
      rel16: mode("relativeLong", "label", 3),
      ind: mode("absoluteIndirect", "(addr)", 3),
      indx: mode("absoluteIndexedXIndirect", "(addr,x)", 3),
      indlong: mode("absoluteIndirectLong", "[addr]", 3),
      block: mode("blockMove", "srcBank,destBank", 3)
    });
    opcodeRows = [
      "BRK:sig ORA:dix COP:sig ORA:sr TSB:dp ORA:dp ASL:dp ORA:dil PHP:imp ORA:immM ASL:acc PHD:imp TSB:abs ORA:abs ASL:abs ORA:long",
      "BPL:rel8 ORA:diy ORA:dpi ORA:sriy TRB:dp ORA:dpx ASL:dpx ORA:dily CLC:imp ORA:aby INC:acc TCS:imp TRB:abs ORA:abx ASL:abx ORA:longx",
      "JSR:abs AND:dix JSL:long AND:sr BIT:dp AND:dp ROL:dp AND:dil PLP:imp AND:immM ROL:acc PLD:imp BIT:abs AND:abs ROL:abs AND:long",
      "BMI:rel8 AND:diy AND:dpi AND:sriy BIT:dpx AND:dpx ROL:dpx AND:dily SEC:imp AND:aby DEC:acc TSC:imp BIT:abx AND:abx ROL:abx AND:longx",
      "RTI:imp EOR:dix WDM:sig EOR:sr MVP:block EOR:dp LSR:dp EOR:dil PHA:imp EOR:immM LSR:acc PHK:imp JMP:abs EOR:abs LSR:abs EOR:long",
      "BVC:rel8 EOR:diy EOR:dpi EOR:sriy MVN:block EOR:dpx LSR:dpx EOR:dily CLI:imp EOR:aby PHY:imp TCD:imp JML:long EOR:abx LSR:abx EOR:longx",
      "RTS:imp ADC:dix PER:rel16 ADC:sr STZ:dp ADC:dp ROR:dp ADC:dil PLA:imp ADC:immM ROR:acc RTL:imp JMP:ind ADC:abs ROR:abs ADC:long",
      "BVS:rel8 ADC:diy ADC:dpi ADC:sriy STZ:dpx ADC:dpx ROR:dpx ADC:dily SEI:imp ADC:aby PLY:imp TDC:imp JMP:indx ADC:abx ROR:abx ADC:longx",
      "BRA:rel8 STA:dix BRL:rel16 STA:sr STY:dp STA:dp STX:dp STA:dil DEY:imp BIT:immM TXA:imp PHB:imp STY:abs STA:abs STX:abs STA:long",
      "BCC:rel8 STA:diy STA:dpi STA:sriy STY:dpx STA:dpx STX:dpy STA:dily TYA:imp STA:aby TXS:imp TXY:imp STZ:abs STA:abx STZ:abx STA:longx",
      "LDY:immX LDA:dix LDX:immX LDA:sr LDY:dp LDA:dp LDX:dp LDA:dil TAY:imp LDA:immM TAX:imp PLB:imp LDY:abs LDA:abs LDX:abs LDA:long",
      "BCS:rel8 LDA:diy LDA:dpi LDA:sriy LDY:dpx LDA:dpx LDX:dpy LDA:dily CLV:imp LDA:aby TSX:imp TYX:imp LDY:abx LDA:abx LDX:aby LDA:longx",
      "CPY:immX CMP:dix REP:sig CMP:sr CPY:dp CMP:dp DEC:dp CMP:dil INY:imp CMP:immM DEX:imp WAI:imp CPY:abs CMP:abs DEC:abs CMP:long",
      "BNE:rel8 CMP:diy CMP:dpi CMP:sriy PEI:dpi CMP:dpx DEC:dpx CMP:dily CLD:imp CMP:aby PHX:imp STP:imp JML:indlong CMP:abx DEC:abx CMP:longx",
      "CPX:immX SBC:dix SEP:sig SBC:sr CPX:dp SBC:dp INC:dp SBC:dil INX:imp SBC:immM NOP:imp XBA:imp CPX:abs SBC:abs INC:abs SBC:long",
      "BEQ:rel8 SBC:diy SBC:dpi SBC:sriy PEA:imm16 SBC:dpx INC:dpx SBC:dily SED:imp SBC:aby PLX:imp XCE:imp JSR:indx SBC:abx INC:abx SBC:longx"
    ];
    summaries = {
      ADC: "Add with carry to the accumulator.",
      AND: "Bitwise AND with the accumulator.",
      ASL: "Arithmetic shift left.",
      BCC: "Branch if carry clear.",
      BCS: "Branch if carry set.",
      BEQ: "Branch if equal (zero set).",
      BIT: "Test bits against the accumulator.",
      BMI: "Branch if minus (negative set).",
      BNE: "Branch if not equal (zero clear).",
      BPL: "Branch if plus (negative clear).",
      BRA: "Branch always.",
      BRK: "Software break / interrupt.",
      BRL: "Branch always long (16-bit relative).",
      BVC: "Branch if overflow clear.",
      BVS: "Branch if overflow set.",
      CLC: "Clear carry flag.",
      CLD: "Clear decimal flag.",
      CLI: "Clear interrupt-disable flag.",
      CLV: "Clear overflow flag.",
      CMP: "Compare with the accumulator.",
      COP: "Coprocessor enable interrupt.",
      CPX: "Compare with the X register.",
      CPY: "Compare with the Y register.",
      DEC: "Decrement memory or the accumulator.",
      DEX: "Decrement the X register.",
      DEY: "Decrement the Y register.",
      EOR: "Bitwise exclusive-OR with the accumulator.",
      INC: "Increment memory or the accumulator.",
      INX: "Increment the X register.",
      INY: "Increment the Y register.",
      JML: "Jump long (24-bit).",
      JMP: "Jump.",
      JSL: "Jump to subroutine long.",
      JSR: "Jump to subroutine.",
      LDA: "Load the accumulator.",
      LDX: "Load the X register.",
      LDY: "Load the Y register.",
      LSR: "Logical shift right.",
      MVN: "Block move next (ascending).",
      MVP: "Block move previous (descending).",
      NOP: "No operation.",
      ORA: "Bitwise OR with the accumulator.",
      PEA: "Push effective absolute address.",
      PEI: "Push effective indirect address.",
      PER: "Push effective PC-relative address.",
      PHA: "Push the accumulator.",
      PHB: "Push the data bank register.",
      PHD: "Push the direct page register.",
      PHK: "Push the program bank register.",
      PHP: "Push the processor status register.",
      PHX: "Push the X register.",
      PHY: "Push the Y register.",
      PLA: "Pull the accumulator.",
      PLB: "Pull the data bank register.",
      PLD: "Pull the direct page register.",
      PLP: "Pull the processor status register.",
      PLX: "Pull the X register.",
      PLY: "Pull the Y register.",
      REP: "Reset status bits.",
      ROL: "Rotate left through carry.",
      ROR: "Rotate right through carry.",
      RTI: "Return from interrupt.",
      RTL: "Return from subroutine long.",
      RTS: "Return from subroutine.",
      SBC: "Subtract with borrow from the accumulator.",
      SEC: "Set carry flag.",
      SED: "Set decimal flag.",
      SEI: "Set interrupt-disable flag.",
      SEP: "Set status bits.",
      STA: "Store the accumulator.",
      STP: "Stop the processor.",
      STX: "Store the X register.",
      STY: "Store the Y register.",
      STZ: "Store zero to memory.",
      TAX: "Transfer accumulator to X.",
      TAY: "Transfer accumulator to Y.",
      TCD: "Transfer accumulator to direct page register.",
      TCS: "Transfer accumulator to stack pointer.",
      TDC: "Transfer direct page register to accumulator.",
      TRB: "Test and reset bits.",
      TSB: "Test and set bits.",
      TSC: "Transfer stack pointer to accumulator.",
      TSX: "Transfer stack pointer to X.",
      TXA: "Transfer X to accumulator.",
      TXS: "Transfer X to stack pointer.",
      TXY: "Transfer X to Y.",
      TYA: "Transfer Y to accumulator.",
      TYX: "Transfer Y to X.",
      WAI: "Wait for interrupt.",
      WDM: "Reserved (William D. Mensch) opcode.",
      XBA: "Exchange the bytes of the accumulator.",
      XCE: "Exchange carry and emulation flags."
    };
    conditionalBranches = /* @__PURE__ */ new Set([
      "BCC",
      "BCS",
      "BEQ",
      "BMI",
      "BNE",
      "BPL",
      "BVC",
      "BVS"
    ]);
    flowFor = (mnemonic, addressingMode) => {
      if (conditionalBranches.has(mnemonic)) return { kind: "conditionalBranch", fallthrough: true };
      if (mnemonic === "BRA" || mnemonic === "BRL") return { kind: "jump", fallthrough: false };
      if (mnemonic === "JMP" || mnemonic === "JML") {
        return {
          kind: "jump",
          fallthrough: false,
          ...addressingMode.includes("Indirect") ? { indirect: true } : {}
        };
      }
      if (mnemonic === "JSR" || mnemonic === "JSL") {
        return {
          kind: "call",
          fallthrough: true,
          ...addressingMode.includes("Indirect") ? { indirect: true } : {}
        };
      }
      if (mnemonic === "RTI" || mnemonic === "RTL" || mnemonic === "RTS") {
        return { kind: "return", fallthrough: false };
      }
      if (mnemonic === "BRK" || mnemonic === "COP") {
        return { kind: "interrupt", fallthrough: false };
      }
      if (mnemonic === "WAI") return { kind: "wait", fallthrough: false };
      if (mnemonic === "STP") return { kind: "stop", fallthrough: false };
      return { kind: "fallthrough", fallthrough: true };
    };
    effects = {
      CLC: [{ kind: "clearBits", target: "p", mask: 1 }],
      SEC: [{ kind: "setBits", target: "p", mask: 1 }],
      CLI: [{ kind: "clearBits", target: "p", mask: 4 }],
      SEI: [{ kind: "setBits", target: "p", mask: 4 }],
      CLD: [{ kind: "clearBits", target: "p", mask: 8 }],
      SED: [{ kind: "setBits", target: "p", mask: 8 }],
      CLV: [{ kind: "clearBits", target: "p", mask: 64 }],
      PHA: [{ kind: "push", source: "a" }],
      PHB: [{ kind: "push", source: "dbr" }],
      PHD: [{ kind: "push", source: "d" }],
      PHK: [{ kind: "push", source: "pbr" }],
      PHP: [{ kind: "push", source: "p" }],
      PHX: [{ kind: "push", source: "x" }],
      PHY: [{ kind: "push", source: "y" }],
      PLA: [{ kind: "pull", target: "a" }],
      PLB: [{ kind: "pull", target: "dbr" }],
      PLD: [{ kind: "pull", target: "d" }],
      PLP: [{ kind: "pull", target: "p" }],
      PLX: [{ kind: "pull", target: "x" }],
      PLY: [{ kind: "pull", target: "y" }],
      TAX: [{ kind: "copy", from: "a", to: "x" }],
      TAY: [{ kind: "copy", from: "a", to: "y" }],
      TCD: [{ kind: "copy", from: "a", to: "d" }],
      TCS: [{ kind: "copy", from: "a", to: "s" }],
      TDC: [{ kind: "copy", from: "d", to: "a" }],
      TSC: [{ kind: "copy", from: "s", to: "a" }],
      TSX: [{ kind: "copy", from: "s", to: "x" }],
      TXA: [{ kind: "copy", from: "x", to: "a" }],
      TXS: [{ kind: "copy", from: "x", to: "s" }],
      TXY: [{ kind: "copy", from: "x", to: "y" }],
      TYA: [{ kind: "copy", from: "y", to: "a" }],
      TYX: [{ kind: "copy", from: "y", to: "x" }],
      XBA: [{ kind: "custom", name: "exchange-accumulator-bytes" }],
      XCE: [
        { kind: "exchange", left: "c", right: "e" },
        { kind: "custom", name: "normalize-emulation-widths" }
      ],
      RTI: [
        { kind: "pull", target: "p" },
        { kind: "pull", target: "pc" },
        { kind: "pull", target: "pbr" }
      ],
      RTS: [{ kind: "pull", target: "pc" }],
      RTL: [
        { kind: "pull", target: "pc" },
        { kind: "pull", target: "pbr" }
      ]
    };
    entries = opcodeRows.flatMap((row) => row.split(" "));
    if (entries.length !== 256) throw new Error(`65816 opcode table has ${entries.length} entries.`);
    cpu65816Specifications = Object.freeze(
      entries.map((entry, opcode) => {
        const [mnemonic, modeKeyText] = entry.split(":");
        const modeKey = modeKeyText;
        const definition = cpu65816Modes[modeKey];
        if (!mnemonic || !definition) throw new Error(`Invalid 65816 opcode entry '${entry}'.`);
        let operandStatusEffect;
        if (mnemonic === "REP") operandStatusEffect = "clearBits";
        else if (mnemonic === "SEP") operandStatusEffect = "setBits";
        return Object.freeze({
          id: `snes.65816.${opcode.toString(16).padStart(2, "0")}`,
          architecture: "snes.65816",
          opcode: [opcode],
          mnemonic,
          mode: definition.id,
          syntax: mnemonic === "PEI" ? "dp" : definition.syntax,
          minimumSize: definition.minimumSize,
          maximumSize: definition.maximumSize,
          summary: summaries[mnemonic] ?? `${mnemonic} instruction.`,
          flow: flowFor(mnemonic, definition.id),
          effects: effects[mnemonic] ?? [],
          ...definition.widthFlag ? { widthFlag: definition.widthFlag } : {},
          ...operandStatusEffect ? { operandStatusEffect } : {}
        });
      })
    );
  }
});

// packages/plugin-snes/src/architectures/65816-decoder.ts
function formatCpu65816Instruction(instruction) {
  if (instruction.architecture !== "snes.65816") {
    throw new Error(`Cannot format architecture '${instruction.architecture}' as 65816.`);
  }
  const operand = instruction.operands[0];
  const value = operand?.value ?? 0;
  let text = "";
  switch (instruction.mode) {
    case "implied":
      break;
    // The project encoder's native accumulator spelling omits the operand.
    case "accumulator":
      break;
    case "signature":
      text = `#${hex(value, 1)}`;
      break;
    case "immediate":
      text = `#${hex(value, operand?.width ?? 1)}`;
      break;
    case "immediate16":
      text = hex(value, 2);
      break;
    case "direct":
      text = hex(value, 1);
      break;
    case "directIndexedX":
      text = `${hex(value, 1)},x`;
      break;
    case "directIndexedY":
      text = `${hex(value, 1)},y`;
      break;
    case "directIndirect":
      text = instruction.mnemonic === "PEI" ? hex(value, 1) : `(${hex(value, 1)})`;
      break;
    case "directIndirectLong":
      text = `[${hex(value, 1)}]`;
      break;
    case "directIndexedXIndirect":
      text = `(${hex(value, 1)},x)`;
      break;
    case "directIndirectIndexedY":
      text = `(${hex(value, 1)}),y`;
      break;
    case "directIndirectLongIndexedY":
      text = `[${hex(value, 1)}],y`;
      break;
    case "stackRelative":
      text = `${hex(value, 1)},s`;
      break;
    case "stackRelativeIndirectIndexedY":
      text = `(${hex(value, 1)},s),y`;
      break;
    case "absolute":
      text = hex(value, 2);
      break;
    case "absoluteIndexedX":
      text = `${hex(value, 2)},x`;
      break;
    case "absoluteIndexedY":
      text = `${hex(value, 2)},y`;
      break;
    case "absoluteLong":
      text = hex(value, 3);
      break;
    case "absoluteLongIndexedX":
      text = `${hex(value, 3)},x`;
      break;
    case "absoluteIndirect":
      text = `(${hex(value, 2)})`;
      break;
    case "absoluteIndexedXIndirect":
      text = `(${hex(value, 2)},x)`;
      break;
    case "absoluteIndirectLong":
      text = `[${hex(value, 2)}]`;
      break;
    case "relative":
      text = hex(operand?.targetAddress ?? 0, 3);
      break;
    case "relativeLong":
      text = instruction.mnemonic === "PER" ? hex(value, 2) : hex(operand?.targetAddress ?? 0, 3);
      break;
    case "blockMove":
      text = `${hex(instruction.operands[0]?.value ?? 0, 1)},${hex(instruction.operands[1]?.value ?? 0, 1)}`;
      break;
    default:
      throw new Error(`Unsupported 65816 formatter mode '${instruction.mode}'.`);
  }
  return text ? `${instruction.mnemonic} ${text}` : instruction.mnemonic;
}
var flagValue, resolvedWidthFlag, readLittleEndian, signed, bankLocalTarget, addressOperand, operandsFor, targetFor, referencesFor, effectsFor, buildInstruction, Cpu65816Decoder, hex;
var init_decoder = __esm({
  "packages/plugin-snes/src/architectures/65816-decoder.ts"() {
    "use strict";
    init_spec();
    flagValue = (value) => {
      if (value === true || value === 1) return 1;
      if (value === false || value === 0) return 0;
      return "unknown";
    };
    resolvedWidthFlag = (state, flag) => {
      const emulation = flagValue(state.e);
      if (emulation === 1) return 1;
      const width = flagValue(state[flag]);
      if (width === 1) return 1;
      if (width === 0 && emulation === 0) return 0;
      return "unknown";
    };
    readLittleEndian = (bytes, offset, width) => {
      let value = 0;
      for (let index = 0; index < width; index++) value |= (bytes[offset + index] ?? 0) << index * 8;
      return value >>> 0;
    };
    signed = (value, width) => {
      const signBit = 1 << width * 8 - 1;
      const modulus = 2 ** (width * 8);
      return value & signBit ? value - modulus : value;
    };
    bankLocalTarget = (logicalAddress, size, displacement) => logicalAddress & 16711680 | logicalAddress + size + displacement & 65535;
    addressOperand = (value, width) => ({
      kind: "address",
      value,
      width
    });
    operandsFor = (specification2, bytes, logicalAddress) => {
      const value8 = bytes[1] ?? 0;
      const value16 = readLittleEndian(bytes, 1, 2);
      const value24 = readLittleEndian(bytes, 1, 3);
      switch (specification2.mode) {
        case "implied":
          return [];
        case "accumulator":
          return [{ kind: "accumulator", register: "a" }];
        case "signature":
          return [{ kind: "signature", value: value8, width: 1 }];
        case "immediate":
          return [
            {
              kind: "immediate",
              value: bytes.length === 2 ? value8 : value16,
              width: bytes.length - 1
            }
          ];
        case "immediate16":
          return [{ kind: "immediate", value: value16, width: 2 }];
        case "direct":
        case "directIndexedX":
        case "directIndexedY":
        case "directIndirect":
        case "directIndirectLong":
        case "directIndexedXIndirect":
        case "directIndirectIndexedY":
        case "directIndirectLongIndexedY":
        case "stackRelative":
        case "stackRelativeIndirectIndexedY":
          return [addressOperand(value8, 1)];
        case "absolute":
        case "absoluteIndexedX":
        case "absoluteIndexedY":
        case "absoluteIndirect":
        case "absoluteIndexedXIndirect":
        case "absoluteIndirectLong":
          return [addressOperand(value16, 2)];
        case "absoluteLong":
        case "absoluteLongIndexedX":
          return [addressOperand(value24, 3)];
        case "relative": {
          const displacement = signed(value8, 1);
          return [
            {
              kind: "displacement",
              value: displacement,
              width: 1,
              signed: true,
              targetAddress: bankLocalTarget(logicalAddress, bytes.length, displacement)
            }
          ];
        }
        case "relativeLong": {
          const displacement = signed(value16, 2);
          return [
            {
              kind: "displacement",
              value: displacement,
              width: 2,
              signed: true,
              targetAddress: bankLocalTarget(logicalAddress, bytes.length, displacement)
            }
          ];
        }
        case "blockMove":
          return [
            { kind: "bank", value: value8, width: 1 },
            { kind: "bank", value: bytes[2] ?? 0, width: 1 }
          ];
        default:
          return [];
      }
    };
    targetFor = (specification2, operands, state, logicalAddress) => {
      const operand = operands[0];
      if (!operand) return void 0;
      if (operand.targetAddress !== void 0) return operand.targetAddress;
      if (operand.value === void 0) return void 0;
      if (specification2.mode === "absoluteLong") return operand.value;
      if (specification2.mode === "absolute") {
        const bank = (state.programBank ?? logicalAddress >>> 16) & 255;
        return bank << 16 | operand.value;
      }
      return void 0;
    };
    referencesFor = (specification2, operands, state, logicalAddress) => {
      const { mnemonic, mode: mode3 } = specification2;
      const isBranch = conditionalBranches.has(mnemonic) || mnemonic === "BRA" || mnemonic === "BRL";
      const isCall = mnemonic === "JSR" || mnemonic === "JSL";
      const isJump = mnemonic === "JMP" || mnemonic === "JML";
      if (isBranch || isCall || isJump) {
        const target = targetFor(specification2, operands, state, logicalAddress);
        let kind = "jump";
        if (isBranch) kind = "branch";
        else if (isCall) kind = "call";
        return [
          {
            kind,
            operandIndex: 0,
            ...target === void 0 ? {} : { address: target },
            ...mode3.includes("Indirect") ? { indirect: true } : {}
          }
        ];
      }
      if (mode3.includes("Indirect")) {
        const value = operands[0]?.value;
        return [
          {
            kind: "pointer",
            operandIndex: 0,
            ...value === void 0 ? {} : { address: value },
            indirect: true
          }
        ];
      }
      const memoryMode = mode3.startsWith("direct") || mode3.startsWith("absolute") || mode3.startsWith("stackRelative");
      if (!memoryMode || operands[0]?.value === void 0) return [];
      if (mode3.startsWith("direct")) {
        return [
          {
            kind: "data",
            operandIndex: 0,
            ...state.directPage === void 0 ? {} : { address: state.directPage + operands[0].value & 65535 }
          }
        ];
      }
      if (!mode3.startsWith("absoluteLong") && mode3.startsWith("absolute")) {
        return [
          {
            kind: "data",
            operandIndex: 0,
            ...state.dataBank === void 0 ? {} : { address: (state.dataBank & 255) << 16 | operands[0].value }
          }
        ];
      }
      return [{ kind: "data", operandIndex: 0, address: operands[0].value }];
    };
    effectsFor = (specification2, operands) => {
      const mask = operands[0]?.value;
      if (specification2.operandStatusEffect && mask !== void 0) {
        return [{ kind: specification2.operandStatusEffect, target: "p", mask }];
      }
      return specification2.effects;
    };
    buildInstruction = (specification2, bytes, context, state) => {
      const operands = operandsFor(specification2, bytes, context.logicalAddress);
      return {
        architecture: "snes.65816",
        specificationId: specification2.id,
        opcode: specification2.opcode[0],
        mnemonic: specification2.mnemonic,
        mode: specification2.mode,
        offset: context.offset,
        logicalAddress: context.logicalAddress & 16777215,
        bytes,
        size: bytes.length,
        operands,
        references: referencesFor(specification2, operands, state, context.logicalAddress),
        flow: specification2.flow,
        effects: effectsFor(specification2, operands)
      };
    };
    Cpu65816Decoder = class {
      /**
       * Decodes a 65816 instruction.
       * @param {ArchitectureDecodeContext<Cpu65816DecodeState>} context The decode context.
       * @returns {ArchitectureDecodeResult} The decode result.
       */
      decode(context) {
        const availableBytes = Number.isInteger(context.offset) && context.offset >= 0 ? Math.max(0, context.source.length - context.offset) : 0;
        const opcode = context.source.readByte(context.offset);
        if (opcode === void 0) {
          return {
            kind: "error",
            code: "outOfBounds",
            message: `Cannot read a 65816 opcode at offset ${context.offset}.`,
            offset: context.offset,
            requiredBytes: 1,
            availableBytes
          };
        }
        const specification2 = cpu65816Specifications[opcode];
        if (!specification2) {
          return {
            kind: "error",
            code: "invalidOpcode",
            message: `Unknown 65816 opcode $${opcode.toString(16).padStart(2, "0")}.`,
            offset: context.offset
          };
        }
        const state = context.state ?? {};
        let sizes = [specification2.minimumSize];
        if (specification2.widthFlag) {
          const width = resolvedWidthFlag(state, specification2.widthFlag);
          sizes = width === "unknown" ? [2, 3] : [width === 1 ? 2 : 3];
        }
        const minimumSize = Math.min(...sizes);
        const maximumSize = Math.max(...sizes);
        if (availableBytes < minimumSize) {
          return {
            kind: "error",
            code: "truncated",
            message: `Truncated ${specification2.mnemonic}: requires at least ${minimumSize} byte(s), ${availableBytes} available.`,
            offset: context.offset,
            requiredBytes: minimumSize,
            availableBytes
          };
        }
        if (sizes.length === 1 && availableBytes < maximumSize) {
          return {
            kind: "error",
            code: "truncated",
            message: `Truncated ${specification2.mnemonic}: requires ${maximumSize} byte(s), ${availableBytes} available.`,
            offset: context.offset,
            requiredBytes: maximumSize,
            availableBytes
          };
        }
        const availableSizes = sizes.filter((size) => size <= availableBytes);
        const alternatives = availableSizes.map((size) => {
          const bytes = context.source.readBytes(context.offset, size);
          if (!bytes) throw new Error("Decoder byte source violated its bounds contract.");
          return buildInstruction(specification2, bytes, context, state);
        });
        if (sizes.length === 2) {
          return {
            kind: "ambiguous",
            reason: `The 65816 ${specification2.widthFlag?.toUpperCase()} flag is unknown.`,
            requiredState: [specification2.widthFlag ?? "m"],
            alternatives,
            ...availableSizes.length === sizes.length ? {} : {
              unavailableAlternatives: sizes.filter((size) => size > availableBytes).map((size) => ({ code: "truncated", size, availableBytes }))
            },
            minimumSize: 2,
            maximumSize: 3
          };
        }
        return { kind: "instruction", instruction: alternatives[0] };
      }
    };
    hex = (value, width) => `$${(value >>> 0).toString(16).toUpperCase().padStart(width * 2, "0").slice(-width * 2)}`;
  }
});

// packages/plugin-snes/src/architectures/spc700-spec.ts
function buildSpc700Catalog() {
  const grouped = /* @__PURE__ */ new Map();
  for (const specification2 of spc700Specifications) {
    const addressingMode = {
      mode: specification2.mode,
      syntax: specification2.syntax,
      opcode: specification2.opcode[0],
      size: specification2.minimumSize
    };
    const descriptor2 = grouped.get(specification2.mnemonic);
    if (descriptor2) descriptor2.modes.push(addressingMode);
    else {
      grouped.set(specification2.mnemonic, {
        mnemonic: specification2.mnemonic,
        summary: specification2.summary,
        modes: [addressingMode]
      });
    }
  }
  return [...grouped.values()].sort((left, right) => left.mnemonic.localeCompare(right.mnemonic));
}
var mode2, spc700Modes, opcodeRows2, summaries2, spc700ConditionalBranches, flowFor2, effects2, entries2, spc700Specifications;
var init_spc700_spec = __esm({
  "packages/plugin-snes/src/architectures/spc700-spec.ts"() {
    "use strict";
    mode2 = (id, syntax, size) => ({
      id,
      syntax,
      size
    });
    spc700Modes = Object.freeze({
      imp: mode2("implied", "", 1),
      tc: mode2("tableCall", "n", 1),
      dpBit: mode2("directBit", "dp", 2),
      dpBitRel: mode2("directBitRelative", "dp,label", 3),
      aDp: mode2("accumulatorDirect", "A,dp", 2),
      aAbs: mode2("accumulatorAbsolute", "A,addr", 3),
      aIndX: mode2("accumulatorIndirectX", "A,(X)", 1),
      aDpxi: mode2("accumulatorDirectIndexedXIndirect", "A,(dp+X)", 2),
      aImm: mode2("accumulatorImmediate", "A,#const", 2),
      dpDp: mode2("directDirect", "dp,dp", 3),
      cBit: mode2("carryMemoryBit", "C,addr.bit", 3),
      cBitInv: mode2("carryInvertedMemoryBit", "C,/addr.bit", 3),
      bitC: mode2("memoryBitCarry", "addr.bit,C", 3),
      bit: mode2("memoryBit", "addr.bit", 3),
      dp: mode2("direct", "dp", 2),
      dpx: mode2("directIndexedX", "dp+X", 2),
      abs: mode2("absolute", "addr", 3),
      rel: mode2("relative", "label", 2),
      absA: mode2("absoluteAccumulator", "addr,A", 3),
      aDpx: mode2("accumulatorDirectIndexedX", "A,dp+X", 2),
      aAbx: mode2("accumulatorAbsoluteIndexedX", "A,addr+X", 3),
      aAby: mode2("accumulatorAbsoluteIndexedY", "A,addr+Y", 3),
      aDpiy: mode2("accumulatorDirectIndirectIndexedY", "A,(dp)+Y", 2),
      dpImm: mode2("directImmediate", "dp,#const", 3),
      xy: mode2("indirectXY", "(X),(Y)", 1),
      dpWord: mode2("directWord", "dp", 2),
      regA: mode2("registerA", "A", 1),
      regX: mode2("registerX", "X", 1),
      regY: mode2("registerY", "Y", 1),
      regP: mode2("registerP", "P", 1),
      regYA: mode2("registerYA", "YA", 1),
      regYAX: mode2("registerYAX", "YA,X", 1),
      regXA: mode2("registerXA", "X,A", 1),
      regAX: mode2("registerAX", "A,X", 1),
      regXSP: mode2("registerXSP", "X,SP", 1),
      regSPX: mode2("registerSPX", "SP,X", 1),
      regAY: mode2("registerAY", "A,Y", 1),
      regYA2: mode2("registerYA2", "Y,A", 1),
      regPostXA: mode2("registerPostIncrementXA", "(X+),A", 1),
      regAPostX: mode2("registerAPostIncrementX", "A,(X+)", 1),
      regIndXA: mode2("registerIndirectXA", "(X),A", 1),
      regAIndX: mode2("registerAIndirectX", "A,(X)", 1),
      xAbs: mode2("registerXAbsolute", "X,addr", 3),
      xDp: mode2("registerXDirect", "X,dp", 2),
      xDpy: mode2("registerXDirectIndexedY", "X,dp+Y", 2),
      yAbs: mode2("registerYAbsolute", "Y,addr", 3),
      yDp: mode2("registerYDirect", "Y,dp", 2),
      yDpx: mode2("registerYDirectIndexedX", "Y,dp+X", 2),
      xImm: mode2("registerXImmediate", "X,#const", 2),
      yImm: mode2("registerYImmediate", "Y,#const", 2),
      jmpAbx: mode2("absoluteIndexedXIndirect", "(addr+X)", 3),
      dpRel: mode2("directRelative", "dp,label", 3),
      dpxRel: mode2("directIndexedXRelative", "dp+X,label", 3),
      yRel: mode2("registerYRelative", "Y,label", 2),
      yaDp: mode2("registerYADirect", "YA,dp", 2),
      dpYa: mode2("directRegisterYA", "dp,YA", 2),
      pcall: mode2("upperPageCall", "upage", 2),
      dpA: mode2("directRegisterA", "dp,A", 2),
      absRegA: mode2("absoluteRegisterA", "addr,A", 3),
      indXA: mode2("indirectXRegisterA", "(X),A", 1),
      dpxiA: mode2("directIndexedXIndirectRegisterA", "(dp+X),A", 2),
      dpxA: mode2("directIndexedXRegisterA", "dp+X,A", 2),
      abxA: mode2("absoluteIndexedXRegisterA", "addr+X,A", 3),
      abyA: mode2("absoluteIndexedYRegisterA", "addr+Y,A", 3),
      dpiyA: mode2("directIndirectIndexedYRegisterA", "(dp)+Y,A", 2),
      dpX: mode2("directRegisterX", "dp,X", 2),
      dpyX: mode2("directIndexedYRegisterX", "dp+Y,X", 2),
      absX: mode2("absoluteRegisterX", "addr,X", 3),
      dpY: mode2("directRegisterY", "dp,Y", 2),
      dpxY: mode2("directIndexedXRegisterY", "dp+X,Y", 2),
      absY: mode2("absoluteRegisterY", "addr,Y", 3)
    });
    opcodeRows2 = [
      "NOP:imp TCALL:tc SET0:dpBit BBS0:dpBitRel OR:aDp OR:aAbs OR:aIndX OR:aDpxi OR:aImm OR:dpDp OR1:cBit ASL:dp ASL:abs PUSH:regP TSET:absA BRK:imp",
      "BPL:rel TCALL:tc CLR0:dpBit BBC0:dpBitRel OR:aDpx OR:aAbx OR:aAby OR:aDpiy OR:dpImm OR:xy DECW:dpWord ASL:dpx ASL:regA DEC:regX CMP:xAbs JMP:jmpAbx",
      "CLRP:imp TCALL:tc SET1:dpBit BBS1:dpBitRel AND:aDp AND:aAbs AND:aIndX AND:aDpxi AND:aImm AND:dpDp OR1:cBitInv ROL:dp ROL:abs PUSH:regA CBNE:dpRel BRA:rel",
      "BMI:rel TCALL:tc CLR1:dpBit BBC1:dpBitRel AND:aDpx AND:aAbx AND:aAby AND:aDpiy AND:dpImm AND:xy INCW:dpWord ROL:dpx ROL:regA INC:regX CMP:xDp CALL:abs",
      "SETP:imp TCALL:tc SET2:dpBit BBS2:dpBitRel EOR:aDp EOR:aAbs EOR:aIndX EOR:aDpxi EOR:aImm EOR:dpDp AND1:cBit LSR:dp LSR:abs PUSH:regX TCLR:absA PCALL:pcall",
      "BVC:rel TCALL:tc CLR2:dpBit BBC2:dpBitRel EOR:aDpx EOR:aAbx EOR:aAby EOR:aDpiy EOR:dpImm EOR:xy CMPW:yaDp LSR:dpx LSR:regA MOV:regXA CMP:yAbs JMP:abs",
      "CLRC:imp TCALL:tc SET3:dpBit BBS3:dpBitRel CMP:aDp CMP:aAbs CMP:aIndX CMP:aDpxi CMP:aImm CMP:dpDp AND1:cBitInv ROR:dp ROR:abs PUSH:regY DBNZ:dpRel RET:imp",
      "BVS:rel TCALL:tc CLR3:dpBit BBC3:dpBitRel CMP:aDpx CMP:aAbx CMP:aAby CMP:aDpiy CMP:dpImm CMP:xy ADDW:yaDp ROR:dpx ROR:regA MOV:regAX CMP:yDp RETI:imp",
      "SETC:imp TCALL:tc SET4:dpBit BBS4:dpBitRel ADC:aDp ADC:aAbs ADC:aIndX ADC:aDpxi ADC:aImm ADC:dpDp EOR1:cBit DEC:dp DEC:abs MOV:yImm POP:regP MOV:dpImm",
      "BCC:rel TCALL:tc CLR4:dpBit BBC4:dpBitRel ADC:aDpx ADC:aAbx ADC:aAby ADC:aDpiy ADC:dpImm ADC:xy SUBW:yaDp DEC:dpx DEC:regA MOV:regXSP DIV:regYAX XCN:regA",
      "EI:imp TCALL:tc SET5:dpBit BBS5:dpBitRel SBC:aDp SBC:aAbs SBC:aIndX SBC:aDpxi SBC:aImm SBC:dpDp MOV1:cBit INC:dp INC:abs CMP:yImm POP:regA MOV:regPostXA",
      "BCS:rel TCALL:tc CLR5:dpBit BBC5:dpBitRel SBC:aDpx SBC:aAbx SBC:aAby SBC:aDpiy SBC:dpImm SBC:xy MOVW:yaDp INC:dpx INC:regA MOV:regSPX DAS:regA MOV:regAPostX",
      "DI:imp TCALL:tc SET6:dpBit BBS6:dpBitRel MOV:dpA MOV:absRegA MOV:indXA MOV:dpxiA CMP:xImm MOV:absX MOV1:bitC MOV:dpY MOV:absY MOV:xImm POP:regX MUL:regYA",
      "BNE:rel TCALL:tc CLR6:dpBit BBC6:dpBitRel MOV:dpxA MOV:abxA MOV:abyA MOV:dpiyA MOV:dpX MOV:dpyX MOVW:dpYa MOV:dpxY DEC:regY MOV:regAY CBNE:dpxRel DAA:regA",
      "CLRV:imp TCALL:tc SET7:dpBit BBS7:dpBitRel MOV:aDp MOV:aAbs MOV:regAIndX MOV:aDpxi MOV:aImm MOV:xAbs NOT1:bit MOV:yDp MOV:yAbs NOTC:imp POP:regY SLEEP:imp",
      "BEQ:rel TCALL:tc CLR7:dpBit BBC7:dpBitRel MOV:aDpx MOV:aAbx MOV:aAby MOV:aDpiy MOV:xDp MOV:xDpy MOV:dpDp MOV:yDpx INC:regY MOV:regYA2 DBNZ:yRel STOP:imp"
    ];
    summaries2 = {
      ADC: "Add with carry.",
      ADDW: "Add a direct-page word to YA.",
      AND: "Bitwise AND.",
      AND1: "AND carry with a memory bit.",
      ASL: "Arithmetic shift left.",
      BBC0: "Branch if direct-page bit 0 is clear.",
      BBS0: "Branch if direct-page bit 0 is set.",
      BRA: "Branch always.",
      BRK: "Software interrupt.",
      CALL: "Call an absolute subroutine.",
      CBNE: "Compare accumulator and branch if not equal.",
      CLR0: "Clear direct-page bit 0.",
      CLRC: "Clear carry.",
      CLRP: "Select direct page zero.",
      CLRV: "Clear overflow and half-carry.",
      CMP: "Compare values.",
      CMPW: "Compare YA with a direct-page word.",
      DAA: "Decimal-adjust accumulator after addition.",
      DAS: "Decimal-adjust accumulator after subtraction.",
      DBNZ: "Decrement and branch if not zero.",
      DEC: "Decrement.",
      DECW: "Decrement a direct-page word.",
      DI: "Disable interrupts.",
      DIV: "Divide YA by X.",
      EI: "Enable interrupts.",
      EOR: "Bitwise exclusive OR.",
      EOR1: "Exclusive-OR carry with a memory bit.",
      INC: "Increment.",
      INCW: "Increment a direct-page word.",
      JMP: "Jump.",
      LSR: "Logical shift right.",
      MOV: "Move data between registers and memory.",
      MOV1: "Move a memory bit to or from carry.",
      MOVW: "Move a direct-page word to or from YA.",
      MUL: "Multiply Y by A into YA.",
      NOP: "No operation.",
      NOT1: "Invert a memory bit.",
      NOTC: "Invert carry.",
      OR: "Bitwise OR.",
      OR1: "OR carry with a memory bit.",
      PCALL: "Call within the upper page.",
      POP: "Pop a register from the stack.",
      PUSH: "Push a register onto the stack.",
      RET: "Return from subroutine.",
      RETI: "Return from interrupt.",
      ROL: "Rotate left through carry.",
      ROR: "Rotate right through carry.",
      SBC: "Subtract with borrow.",
      SET0: "Set direct-page bit 0.",
      SETC: "Set carry.",
      SETP: "Select direct page one.",
      SLEEP: "Wait for an interrupt.",
      STOP: "Stop the processor.",
      SUBW: "Subtract a direct-page word from YA.",
      TCALL: "Call through a fixed vector table entry.",
      TCLR: "Test and clear accumulator bits in memory.",
      TSET: "Test and set accumulator bits in memory.",
      XCN: "Exchange accumulator nibbles."
    };
    spc700ConditionalBranches = /* @__PURE__ */ new Set([
      "BCC",
      "BCS",
      "BEQ",
      "BMI",
      "BNE",
      "BPL",
      "BVC",
      "BVS",
      "CBNE",
      "DBNZ"
    ]);
    flowFor2 = (mnemonic, addressingMode) => {
      if (spc700ConditionalBranches.has(mnemonic) || mnemonic.startsWith("BBS") || mnemonic.startsWith("BBC")) {
        return { kind: "conditionalBranch", fallthrough: true };
      }
      if (mnemonic === "BRA") return { kind: "jump", fallthrough: false };
      if (mnemonic === "JMP") {
        return {
          kind: "jump",
          fallthrough: false,
          ...addressingMode === "absoluteIndexedXIndirect" ? { indirect: true } : {}
        };
      }
      if (mnemonic === "CALL" || mnemonic === "PCALL" || mnemonic === "TCALL") {
        return {
          kind: "call",
          fallthrough: true,
          ...mnemonic === "TCALL" ? { indirect: true } : {}
        };
      }
      if (mnemonic === "RET" || mnemonic === "RETI") {
        return { kind: "return", fallthrough: false };
      }
      if (mnemonic === "BRK") return { kind: "interrupt", fallthrough: false };
      if (mnemonic === "SLEEP") return { kind: "wait", fallthrough: false };
      if (mnemonic === "STOP") return { kind: "stop", fallthrough: false };
      return { kind: "fallthrough", fallthrough: true };
    };
    effects2 = {
      CLRC: [{ kind: "clearBits", target: "p", mask: 1 }],
      SETC: [{ kind: "setBits", target: "p", mask: 1 }],
      DI: [{ kind: "clearBits", target: "p", mask: 4 }],
      EI: [{ kind: "setBits", target: "p", mask: 4 }],
      CLRP: [{ kind: "clearBits", target: "p", mask: 32 }],
      SETP: [{ kind: "setBits", target: "p", mask: 32 }],
      CLRV: [{ kind: "clearBits", target: "p", mask: 72 }],
      NOTC: [{ kind: "custom", name: "invert-status-bit", details: { target: "p", mask: 1 } }],
      PUSH: [{ kind: "push", source: "operand-register" }],
      POP: [{ kind: "pull", target: "operand-register" }],
      RET: [{ kind: "pull", target: "pc" }],
      RETI: [
        { kind: "pull", target: "p" },
        { kind: "pull", target: "pc" }
      ]
    };
    entries2 = opcodeRows2.flatMap((row) => row.split(" "));
    if (entries2.length !== 256) throw new Error(`SPC700 opcode table has ${entries2.length} entries.`);
    spc700Specifications = Object.freeze(
      entries2.map((entry, opcode) => {
        const [mnemonic, modeKeyText] = entry.split(":");
        const definition = spc700Modes[modeKeyText];
        if (!mnemonic || !definition) throw new Error(`Invalid SPC700 opcode entry '${entry}'.`);
        const summaryKey = mnemonic.replace(/[0-7]$/, "0");
        return Object.freeze({
          id: `snes.spc700.${opcode.toString(16).padStart(2, "0")}`,
          architecture: "snes.spc700",
          opcode: [opcode],
          mnemonic,
          mode: definition.id,
          syntax: definition.syntax,
          minimumSize: definition.size,
          maximumSize: definition.size,
          summary: summaries2[mnemonic] ?? summaries2[summaryKey] ?? `${mnemonic} instruction.`,
          flow: flowFor2(mnemonic, definition.id),
          effects: effects2[mnemonic] ?? []
        });
      })
    );
  }
});

// packages/plugin-snes/src/architectures/superfx-spec.ts
function buildSuperFxCatalog() {
  const grouped = /* @__PURE__ */ new Map();
  for (const entry of superFxSpecifications) {
    const mode3 = {
      mode: entry.mode,
      syntax: entry.syntax,
      opcode: entry.opcode[0],
      size: entry.minimumSize + (entry.alt === 0 ? 0 : 1)
    };
    const existing = grouped.get(entry.mnemonic);
    if (existing) {
      if (!existing.modes.some((value) => JSON.stringify(value) === JSON.stringify(mode3)))
        existing.modes.push(mode3);
    } else {
      grouped.set(entry.mnemonic, {
        mnemonic: entry.mnemonic,
        summary: entry.summary ?? `${entry.mnemonic} instruction.`,
        modes: [mode3]
      });
    }
  }
  const conveniences = [
    {
      mnemonic: "LEA",
      summary: "Load a register with an effective address.",
      modes: [{ mode: "registerAbsolute", syntax: "Rn,addr", size: 3 }]
    },
    {
      mnemonic: "MOVE",
      summary: "Move register, immediate, or RAM data.",
      modes: [
        { mode: "registerRegister", syntax: "Rn,Rm", size: 2 },
        { mode: "registerImmediate", syntax: "Rn,#imm" },
        { mode: "registerRam", syntax: "Rn,(addr)" },
        { mode: "ramRegister", syntax: "(addr),Rn" }
      ]
    },
    {
      mnemonic: "MOVES",
      summary: "Move a register and update flags.",
      modes: [{ mode: "registerRegister", syntax: "Rn,Rm", size: 2 }]
    },
    {
      mnemonic: "MOVEB",
      summary: "Move a byte through a register pointer.",
      modes: [
        { mode: "registerIndirect", syntax: "Rn,(Rm)" },
        { mode: "indirectRegister", syntax: "(Rn),Rm" }
      ]
    },
    {
      mnemonic: "MOVEW",
      summary: "Move a word through a register pointer.",
      modes: [
        { mode: "registerIndirect", syntax: "Rn,(Rm)" },
        { mode: "indirectRegister", syntax: "(Rn),Rm" }
      ]
    }
  ];
  for (const entry of conveniences) grouped.set(entry.mnemonic, entry);
  return [...grouped.values()].sort((left, right) => left.mnemonic.localeCompare(right.mnemonic));
}
var syntaxFor, implied, register, registerIndirect, nibble, baseDefinition, altDefinition, flowFor3, effectsFor2, summaryFor, specification, superFxOpcodeMatrix, superFxBaseSpecifications, superFxSpecifications, fusedFlow, fusedSyntax, fused, superFxFusedSpecifications;
var init_superfx_spec = __esm({
  "packages/plugin-snes/src/architectures/superfx-spec.ts"() {
    "use strict";
    syntaxFor = (encoding) => {
      switch (encoding) {
        case "implied":
          return "";
        case "relative":
          return "label";
        case "register":
          return "Rn";
        case "registerIndirect":
          return "(Rn)";
        case "immediateNibble":
          return "#n";
        case "registerImmediate8":
        case "registerImmediate16":
          return "Rn,#imm";
        case "registerRamShort":
          return "Rn,(addr)";
        case "ramShortRegister":
          return "(addr),Rn";
        case "registerRamAbsolute":
          return "Rn,(addr)";
        case "ramAbsoluteRegister":
          return "(addr),Rn";
      }
      throw new Error("Unsupported SuperFX operand encoding.");
    };
    implied = (mnemonic, writesDestination = false) => ({
      mnemonic,
      encoding: "implied",
      size: 1,
      ...writesDestination ? { writesDestination: true } : {}
    });
    register = (mnemonic, value, writesDestination = false) => ({
      mnemonic,
      encoding: "register",
      size: 1,
      register: value,
      ...writesDestination ? { writesDestination: true } : {}
    });
    registerIndirect = (mnemonic, value, writesDestination = false) => ({
      mnemonic,
      encoding: "registerIndirect",
      size: 1,
      register: value,
      ...writesDestination ? { writesDestination: true } : {}
    });
    nibble = (mnemonic, value, writesDestination = false) => ({
      mnemonic,
      encoding: "immediateNibble",
      size: 1,
      register: value,
      ...writesDestination ? { writesDestination: true } : {}
    });
    baseDefinition = (opcode) => {
      if (opcode === 0) return implied("STOP");
      if (opcode === 1) return implied("NOP");
      if (opcode === 2) return implied("CACHE");
      if (opcode === 3) return implied("LSR", true);
      if (opcode === 4) return implied("ROL", true);
      const branches = ["BRA", "BGE", "BLT", "BNE", "BEQ", "BPL", "BMI", "BCC", "BCS", "BVC", "BVS"];
      if (opcode >= 5 && opcode <= 15) {
        return { mnemonic: branches[opcode - 5], encoding: "relative", size: 2 };
      }
      if (opcode >= 16 && opcode <= 31) return register("TO", opcode & 15);
      if (opcode >= 32 && opcode <= 47) return register("WITH", opcode & 15);
      if (opcode >= 48 && opcode <= 59) return registerIndirect("STW", opcode & 15);
      if (opcode === 60) return implied("LOOP");
      if (opcode === 61) return implied("ALT1");
      if (opcode === 62) return implied("ALT2");
      if (opcode === 63) return implied("ALT3");
      if (opcode >= 64 && opcode <= 75) return registerIndirect("LDW", opcode & 15, true);
      if (opcode === 76) return implied("PLOT");
      if (opcode === 77) return implied("SWAP", true);
      if (opcode === 78) return implied("COLOR");
      if (opcode === 79) return implied("NOT", true);
      if (opcode >= 80 && opcode <= 95) return register("ADD", opcode & 15, true);
      if (opcode >= 96 && opcode <= 111) return register("SUB", opcode & 15, true);
      if (opcode === 112) return implied("MERGE", true);
      if (opcode >= 113 && opcode <= 127) return register("AND", opcode & 15, true);
      if (opcode >= 128 && opcode <= 143) return register("MULT", opcode & 15, true);
      if (opcode === 144) return implied("SBK");
      if (opcode >= 145 && opcode <= 148) return nibble("LINK", opcode & 15);
      if (opcode === 149) return implied("SEX", true);
      if (opcode === 150) return implied("ASR", true);
      if (opcode === 151) return implied("ROR", true);
      if (opcode >= 152 && opcode <= 157) return register("JMP", opcode & 15);
      if (opcode === 158) return implied("LOB", true);
      if (opcode === 159) return implied("FMULT", true);
      if (opcode >= 160 && opcode <= 175) {
        return {
          mnemonic: "IBT",
          encoding: "registerImmediate8",
          size: 2,
          register: opcode & 15
        };
      }
      if (opcode >= 176 && opcode <= 191) return register("FROM", opcode & 15);
      if (opcode === 192) return implied("HIB", true);
      if (opcode >= 193 && opcode <= 207) return register("OR", opcode & 15, true);
      if (opcode >= 208 && opcode <= 222) return register("INC", opcode & 15);
      if (opcode === 223) return implied("GETC");
      if (opcode >= 224 && opcode <= 238) return register("DEC", opcode & 15);
      if (opcode === 239) return implied("GETB", true);
      return {
        mnemonic: "IWT",
        encoding: "registerImmediate16",
        size: 3,
        register: opcode & 15
      };
    };
    altDefinition = (alt, opcode) => {
      if (alt === 0) return baseDefinition(opcode);
      const low = opcode & 15;
      if (alt === 1) {
        if (opcode >= 48 && opcode <= 59) return registerIndirect("STB", low);
        if (opcode >= 64 && opcode <= 75) return registerIndirect("LDB", low, true);
        if (opcode === 76) return implied("RPIX", true);
        if (opcode === 78) return implied("CMODE");
        if (opcode >= 80 && opcode <= 95) return register("ADC", low, true);
        if (opcode >= 96 && opcode <= 111) return register("SBC", low, true);
        if (opcode >= 113 && opcode <= 127) return register("BIC", low, true);
        if (opcode >= 128 && opcode <= 143) return register("UMULT", low, true);
        if (opcode === 150) return implied("DIV2", true);
        if (opcode >= 152 && opcode <= 157) return register("LJMP", low);
        if (opcode === 159) return implied("LMULT", true);
        if (opcode >= 160 && opcode <= 175) {
          return {
            mnemonic: "LMS",
            encoding: "registerRamShort",
            size: 2,
            register: low
          };
        }
        if (opcode >= 193 && opcode <= 207) return register("XOR", low, true);
        if (opcode === 239) return implied("GETBH", true);
        if (opcode >= 240) {
          return {
            mnemonic: "LM",
            encoding: "registerRamAbsolute",
            size: 3,
            register: low
          };
        }
      }
      if (alt === 2) {
        if (opcode >= 80 && opcode <= 95) return nibble("ADD", low, true);
        if (opcode >= 96 && opcode <= 111) return nibble("SUB", low, true);
        if (opcode >= 113 && opcode <= 127) return nibble("AND", low, true);
        if (opcode >= 128 && opcode <= 143) return nibble("MULT", low, true);
        if (opcode >= 160 && opcode <= 175) {
          return {
            mnemonic: "SMS",
            encoding: "ramShortRegister",
            size: 2,
            register: low
          };
        }
        if (opcode >= 193 && opcode <= 207) return nibble("OR", low, true);
        if (opcode === 223) return implied("RAMB");
        if (opcode === 239) return implied("GETBL", true);
        if (opcode >= 240) {
          return {
            mnemonic: "SM",
            encoding: "ramAbsoluteRegister",
            size: 3,
            register: low
          };
        }
      }
      if (alt === 3) {
        if (opcode >= 80 && opcode <= 95) return nibble("ADC", low, true);
        if (opcode >= 96 && opcode <= 111) return register("CMP", low);
        if (opcode >= 113 && opcode <= 127) return nibble("BIC", low, true);
        if (opcode >= 128 && opcode <= 143) return nibble("UMULT", low, true);
        if (opcode >= 193 && opcode <= 207) return nibble("XOR", low, true);
        if (opcode === 223) return implied("ROMB");
        if (opcode === 239) return implied("GETBS", true);
      }
      return baseDefinition(opcode);
    };
    flowFor3 = (definition, opcode) => {
      if (definition.mnemonic === "STOP") return { kind: "stop", fallthrough: false };
      if (definition.mnemonic === "BRA") return { kind: "jump", fallthrough: false };
      if (opcode >= 6 && opcode <= 15) return { kind: "conditionalBranch", fallthrough: true };
      if (definition.mnemonic === "LOOP")
        return { kind: "conditionalBranch", fallthrough: true, indirect: true };
      if (definition.mnemonic === "JMP" || definition.mnemonic === "LJMP")
        return { kind: "jump", fallthrough: false, indirect: true };
      return { kind: "fallthrough", fallthrough: true };
    };
    effectsFor2 = (definition) => {
      if (definition.mnemonic === "ALT1" || definition.mnemonic === "ALT2" || definition.mnemonic === "ALT3") {
        return [
          {
            kind: "custom",
            name: "set-superfx-alt",
            details: { alt: Number(definition.mnemonic.at(-1)) }
          }
        ];
      }
      if (definition.mnemonic === "TO") {
        return [
          {
            kind: "custom",
            name: "select-superfx-destination",
            details: { register: definition.register }
          }
        ];
      }
      if (definition.mnemonic === "WITH") {
        return [
          {
            kind: "custom",
            name: "select-superfx-source-destination",
            details: { register: definition.register }
          }
        ];
      }
      if (definition.mnemonic === "FROM") {
        return [
          { kind: "custom", name: "select-superfx-source", details: { register: definition.register } }
        ];
      }
      return [];
    };
    summaryFor = (mnemonic) => {
      const summaries3 = {
        STOP: "Stop the GSU.",
        NOP: "No operation.",
        CACHE: "Set the cache base register.",
        BRA: "Branch always.",
        BGE: "Branch if greater or equal.",
        BLT: "Branch if less than.",
        BNE: "Branch if not equal.",
        BEQ: "Branch if equal.",
        BPL: "Branch if plus.",
        BMI: "Branch if minus.",
        BCC: "Branch if carry clear.",
        BCS: "Branch if carry set.",
        BVC: "Branch if overflow clear.",
        BVS: "Branch if overflow set.",
        JMP: "Jump through a register.",
        LJMP: "Long jump through a register.",
        IWT: "Load a register with a word.",
        IBT: "Load a register with a signed byte.",
        LM: "Load a register from RAM.",
        LMS: "Load a register from short RAM.",
        SM: "Store a register to RAM.",
        SMS: "Store a register to short RAM."
      };
      return summaries3[mnemonic] ?? `${mnemonic} instruction.`;
    };
    specification = (alt, opcode) => {
      const definition = altDefinition(alt, opcode);
      const base = baseDefinition(opcode);
      const alteredByAlt = alt !== 0 && (definition.mnemonic !== base.mnemonic || definition.encoding !== base.encoding);
      return Object.freeze({
        id: `snes.superfx.alt${alt}.${opcode.toString(16).padStart(2, "0")}`,
        architecture: "snes.superfx",
        opcode: [opcode],
        mnemonic: definition.mnemonic,
        mode: definition.encoding,
        syntax: syntaxFor(definition.encoding),
        operandEncoding: definition.encoding,
        minimumSize: definition.size,
        maximumSize: definition.size,
        alt,
        ...definition.register === void 0 ? {} : { register: definition.register },
        summary: summaryFor(definition.mnemonic),
        flow: flowFor3(definition, opcode),
        effects: effectsFor2(definition),
        ...definition.writesDestination ? { writesDestination: true } : {},
        alteredByAlt
      });
    };
    superFxOpcodeMatrix = Object.freeze(
      [0, 1, 2, 3].map(
        (alt) => Object.freeze(Array.from({ length: 256 }, (_, opcode) => specification(alt, opcode)))
      )
    );
    superFxBaseSpecifications = superFxOpcodeMatrix[0];
    superFxSpecifications = Object.freeze([
      ...superFxBaseSpecifications,
      ...superFxOpcodeMatrix.slice(1).flatMap((row) => row.filter((entry) => entry.alteredByAlt))
    ]);
    fusedFlow = (destinationRegister) => destinationRegister === 15 ? { kind: "jump", fallthrough: false, indirect: true } : { kind: "fallthrough", fallthrough: true };
    fusedSyntax = (mode3) => {
      if (mode3 === "registerRegister") return "Rn,Rm";
      if (mode3 === "registerRegisterIndirect") return "Rn,(Rm)";
      return "(Rn),Rm";
    };
    fused = (mnemonic, opcode, mode3, destinationRegister, sourceRegister, pointerRegister) => Object.freeze({
      id: `snes.superfx.fused.${opcode.map((value) => value.toString(16).padStart(2, "0")).join("-")}`,
      architecture: "snes.superfx",
      opcode,
      mnemonic,
      mode: mode3,
      syntax: fusedSyntax(mode3),
      minimumSize: opcode.length,
      maximumSize: opcode.length,
      destinationRegister,
      ...sourceRegister === void 0 ? {} : { sourceRegister },
      ...pointerRegister === void 0 ? {} : { pointerRegister },
      summary: `${mnemonic} fused selector form.`,
      flow: fusedFlow(destinationRegister),
      effects: []
    });
    superFxFusedSpecifications = Object.freeze([
      ...Array.from(
        { length: 16 },
        (_, source) => Array.from(
          { length: 16 },
          (_2, destination) => fused("MOVE", [32 + source, 16 + destination], "registerRegister", destination, source)
        )
      ).flat(),
      ...Array.from(
        { length: 16 },
        (_, destination) => Array.from(
          { length: 16 },
          (_2, source) => fused(
            "MOVES",
            [32 + destination, 176 + source],
            "registerRegister",
            destination,
            source
          )
        )
      ).flat(),
      ...Array.from({ length: 15 }, (_, index) => index + 1).flatMap(
        (destination) => Array.from({ length: 12 }, (_, pointer) => [
          fused(
            "MOVEW",
            [16 + destination, 64 + pointer],
            "registerRegisterIndirect",
            destination,
            void 0,
            pointer
          ),
          fused(
            "MOVEB",
            [16 + destination, 61, 64 + pointer],
            "registerRegisterIndirect",
            destination,
            void 0,
            pointer
          )
        ]).flat()
      ),
      ...Array.from({ length: 15 }, (_, index) => index + 1).flatMap(
        (source) => Array.from({ length: 12 }, (_, pointer) => [
          fused(
            "MOVEW",
            [176 + source, 48 + pointer],
            "registerIndirectRegister",
            0,
            source,
            pointer
          ),
          fused(
            "MOVEB",
            [176 + source, 61, 48 + pointer],
            "registerIndirectRegister",
            0,
            source,
            pointer
          )
        ]).flat()
      )
    ]);
  }
});

// packages/plugin-snes/src/tooling/instruction-catalog.ts
var cpu65816Catalog, spc700Catalog, superFxCatalog;
var init_instruction_catalog2 = __esm({
  "packages/plugin-snes/src/tooling/instruction-catalog.ts"() {
    "use strict";
    init_spec();
    init_spc700_spec();
    init_superfx_spec();
    cpu65816Catalog = buildCpu65816Catalog();
    spc700Catalog = buildSpc700Catalog();
    superFxCatalog = buildSuperFxCatalog();
  }
});

// packages/plugin-snes/src/architectures/operand-classifiers.ts
function isSame65816Bank(expanded, currentAddress) {
  const match = expanded.trim().match(/^\$([\da-f]{5,6})(?:\s*,\s*[xy])?$/i);
  if (!match) {
    return false;
  }
  const value = parseInt(match[1], 16);
  return (currentAddress >>> 16 & 255) === (value >>> 16 & 255);
}
function isIndexedXLabelOperand(rawOperand) {
  const raw = rawOperand.trim();
  if (!/,\s*x$/i.test(raw)) {
    return false;
  }
  const base = raw.replace(/,\s*x$/i, "").trim();
  return base !== "" && !/^[\d!#$%(]/.test(base) && !base.startsWith("[");
}
function apply65816WidthPolicy(resolver, raw, expanded, inferredLength) {
  if (raw.includes("<:") || raw.includes("bank(") || raw.includes("bankbyte(")) {
    return 2;
  }
  let length = inferredLength;
  const explicitLongHex = /^\$[\da-f]{5,6}(?:\s*,\s*[xy])?$/i.test(raw.trim());
  if (length === 3 && !explicitLongHex && isSame65816Bank(expanded, resolver.getCurrentAddress())) {
    length = 2;
  }
  if (!isIndexedXLabelOperand(raw)) {
    return length;
  }
  const match = expanded.trim().match(/^\$([\da-f]+)\s*,\s*x$/i);
  if (!match) {
    return length;
  }
  const value = parseInt(match[1], 16);
  const currentBank = resolver.getCurrentAddress() >>> 16 & 255;
  const targetBank = value >>> 16 & 255;
  return currentBank === targetBank ? 2 : 3;
}
function sourceUsesNumericSpelling(raw) {
  const base = raw.trim().replace(/\s*,\s*[sxy]$/i, "");
  if (!base) {
    return false;
  }
  if (base.startsWith("#") || base.startsWith("$")) {
    return true;
  }
  if (/^[\d!%]/.test(base)) {
    return true;
  }
  return false;
}
function isExplicitDirectPageSpelling(raw, expanded, indexedX) {
  let hexPattern = /^\$[\da-f]{1,2}$/i;
  if (indexedX) {
    hexPattern = /^\$[\da-f]{1,2}\s*,\s*x$/i;
  }
  if (hexPattern.test(raw.trim())) {
    return true;
  }
  if (!hexPattern.test(expanded.trim())) {
    return false;
  }
  return sourceUsesNumericSpelling(raw);
}
function classifyGenericOperand(input) {
  const { raw, expanded, length } = input;
  const syntax = parseOperandSyntax(raw);
  const lowered = expanded.toLowerCase();
  const normalizedExpanded = expanded.trim();
  const normalizedUpper = normalizedExpanded.toUpperCase();
  const explicitDirectPage = isExplicitDirectPageSpelling(raw, normalizedExpanded, false);
  const explicitDirectPageIndexedX = isExplicitDirectPageSpelling(raw, normalizedExpanded, true);
  let mode3 = "unknown";
  let baseExpression = expanded;
  let registerName;
  const rawUpper = raw.trim().toUpperCase();
  const registerOperandMatch = rawUpper.match(/^(A|X|Y|YA|SP|C|R\d{1,2})$/) ?? normalizedUpper.match(/^(A|X|Y|YA|SP|C|R\d{1,2})$/);
  const registerIndirectMatch = normalizedUpper.match(/^\((A|X|Y|YA|SP|C|R\d{1,2})\)$/);
  const registerIndirectAutoIncrementMatch = normalizedUpper.match(
    /^\((A|X|Y|YA|SP|C|R\d{1,2})\)\+$/
  );
  const directPageIndexedXIndirectMatch = normalizedExpanded.match(/^\(\s*(.+?)\s*\+\s*x\s*\)$/i);
  const directPageIndirectIndexedYMatch = normalizedExpanded.match(/^\(\s*(.+?)\s*\)\s*\+\s*y$/i);
  const bitAddressMatch = normalizedExpanded.match(/^(\$[\da-f]+)\.([0-7])$/i);
  if (registerOperandMatch) {
    mode3 = "register";
    registerName = registerOperandMatch[1].toLowerCase();
    baseExpression = normalizedExpanded;
  } else if (registerIndirectAutoIncrementMatch) {
    mode3 = "registerIndirectAutoIncrement";
    registerName = registerIndirectAutoIncrementMatch[1].toLowerCase();
    baseExpression = registerIndirectAutoIncrementMatch[1];
  } else if (registerIndirectMatch) {
    mode3 = "registerIndirect";
    registerName = registerIndirectMatch[1].toLowerCase();
    baseExpression = registerIndirectMatch[1];
  } else if (directPageIndexedXIndirectMatch) {
    mode3 = "directPageIndexedXIndirect";
    baseExpression = directPageIndexedXIndirectMatch[1].trim();
  } else if (directPageIndirectIndexedYMatch) {
    mode3 = "directPageIndirectIndexedY";
    baseExpression = directPageIndirectIndexedYMatch[1].trim();
  } else if (bitAddressMatch) {
    mode3 = bitAddressMatch[1].length <= 3 ? "directPageBit" : "absoluteBit";
    baseExpression = bitAddressMatch[1].toUpperCase();
  }
  if (mode3 === "unknown" && expanded.startsWith("#")) {
    mode3 = "immediate";
    baseExpression = expanded.slice(1).trim();
  } else if (mode3 === "unknown" && /^\$[\da-f]{6}\s*,\s*x$/i.test(expanded)) {
    if (length >= 3) {
      mode3 = "absoluteLongIndexedX";
    } else {
      mode3 = "absoluteIndexedX";
    }
    baseExpression = expanded.replace(/\s*,\s*x$/i, "").trim();
  } else if (mode3 === "unknown" && /^\$[\da-f]{4}\s*,\s*x$/i.test(expanded)) {
    if (length >= 3) {
      mode3 = "absoluteLongIndexedX";
    } else {
      mode3 = "absoluteIndexedX";
    }
    baseExpression = expanded.replace(/\s*,\s*x$/i, "").trim();
  } else if (mode3 === "unknown" && /^\$[\da-f]{4}\s*,\s*y$/i.test(expanded)) {
    mode3 = "absoluteIndexedY";
    baseExpression = expanded.replace(/\s*,\s*y$/i, "").trim();
  } else if (mode3 === "unknown" && /^\(\s*(.+?)\s*,\s*x\s*\)$/i.test(normalizedExpanded)) {
    mode3 = "indexedIndirectX";
    baseExpression = normalizedExpanded.replace(/^\(\s*/, "").replace(/\s*,\s*x\s*\)$/i, "").trim();
  } else if (mode3 === "unknown" && lowered.startsWith("(") && lowered.endsWith(")")) {
    mode3 = "directPageIndirect";
    baseExpression = expanded.slice(1, -1).trim();
  } else if (mode3 === "unknown" && /^\(\s*(.+?)\s*,\s*s\s*\)\s*,\s*y$/i.test(normalizedExpanded)) {
    mode3 = "stackRelativeIndexedIndirectY";
    baseExpression = normalizedExpanded.replace(/^\(\s*/, "").replace(/\s*,\s*s\s*\)\s*,\s*y$/i, "").trim();
  } else if (mode3 === "unknown" && /,\s*s$/i.test(lowered)) {
    mode3 = "stackRelative";
    baseExpression = expanded.replace(/\s*,\s*s$/i, "").trim();
  } else if (mode3 === "unknown" && /^\[\s*(.+?)\s*]\s*,\s*y$/i.test(normalizedExpanded)) {
    mode3 = "indirectLongIndexedY";
    baseExpression = normalizedExpanded.replace(/^\[\s*/, "").replace(/\s*]\s*,\s*y$/i, "").trim();
  } else if (mode3 === "unknown" && lowered.startsWith("[") && lowered.endsWith("]")) {
    mode3 = "indirectLong";
    baseExpression = expanded.slice(1, -1).trim();
  } else if (mode3 === "unknown" && /^\(\s*(.+?)\s*\)\s*,\s*y$/i.test(normalizedExpanded)) {
    mode3 = "indirectIndexedY";
    baseExpression = normalizedExpanded.replace(/^\(\s*/, "").replace(/\s*\)\s*,\s*y$/i, "").trim();
  } else if (mode3 === "unknown" && /,\s*y$/i.test(lowered)) {
    mode3 = "absoluteIndexedY";
    baseExpression = expanded.replace(/\s*,\s*y$/i, "").trim();
  } else if (mode3 === "unknown" && /,\s*x$/i.test(lowered)) {
    baseExpression = expanded.replace(/\s*,\s*x$/i, "").trim();
    if (length >= 3) {
      mode3 = "absoluteLongIndexedX";
    } else if (length === 2) {
      mode3 = "absoluteIndexedX";
    } else {
      mode3 = "directPageIndexedX";
    }
  } else if (mode3 === "unknown" && /^\$[\da-f]+$/i.test(expanded)) {
    if (length >= 3) {
      mode3 = "absoluteLong";
    } else if (length === 2) {
      mode3 = "absolute";
    }
    baseExpression = expanded;
  }
  return {
    mode: mode3,
    baseExpression,
    registerName,
    explicitDirectPage,
    explicitDirectPageIndexedX,
    raw,
    expanded,
    length,
    indexRegister: syntax.indexRegister,
    immediate: syntax.immediate,
    indirect: syntax.indirect
  };
}
function classify65816Operand(resolver, operand) {
  const raw = operand.trim();
  return classifyExpanded65816Operand(resolver, resolver.expandOperand(raw));
}
function classifyExpanded65816Operand(resolver, input) {
  const length = apply65816WidthPolicy(resolver, input.raw, input.expanded, input.length);
  return classifyGenericOperand({ ...input, length });
}
function classifySpc700Operand(resolver, operand) {
  const raw = operand.trim();
  const { expanded, length } = resolver.expandOperand(raw);
  return classifyGenericOperand({ raw, expanded, length });
}
function classifySuperFxOperand(resolver, operand) {
  const raw = operand.trim();
  const { expanded, length } = resolver.expandOperand(raw);
  return classifyGenericOperand({ raw, expanded, length });
}
var init_operand_classifiers = __esm({
  "packages/plugin-snes/src/architectures/operand-classifiers.ts"() {
    "use strict";
    init_src();
  }
});

// packages/plugin-snes/src/architectures/65816.ts
var lower65816Operand, keepsFixedWidthAddressingMode, isIndexedMemory, Arch65816;
var init__ = __esm({
  "packages/plugin-snes/src/architectures/65816.ts"() {
    "use strict";
    init_src();
    init_instruction_catalog2();
    init_operand_classifiers();
    lower65816Operand = (resolver, operand) => {
      const lowered = resolver.lowerOperand(operand);
      return lowered.mode !== "unknown" ? lowered : classifyExpanded65816Operand(resolver, lowered);
    };
    keepsFixedWidthAddressingMode = (mode3, explicitLength) => {
      if (mode3 === "indirectLong" || mode3 === "indirectLongIndexedY" || mode3 === "indirectIndexedY" || mode3 === "indexedIndirectX" || mode3 === "stackRelative" || mode3 === "stackRelativeIndexedIndirectY") {
        return true;
      }
      if (mode3 === "directPageIndirect" && explicitLength === 1) {
        return true;
      }
      return false;
    };
    isIndexedMemory = (operand, register4) => operand.indexRegister === register4 && !keepsFixedWidthAddressingMode(operand.mode, 1);
    Arch65816 = class {
      constructor(context, optimizeDirectPage = () => false) {
        this.optimizeDirectPage = optimizeDirectPage;
        this.assembler = createEncoderRuntime(context);
        this.m16 = false;
        this.x16 = false;
        this.smartMode = true;
      }
      optimizeDirectPage;
      assembler;
      /** Native 16-bit accumulator (REP #$20). Reset at the start of each assembly stage. */
      m16;
      /** Native 16-bit index registers (REP #$10). Reset at the start of each assembly stage. */
      x16;
      /**
       * When true, `SEP`/`REP` auto-update M/X hints (Asar-compatible default).
       * Set to false by `.smart off`; re-enabled by `.smart` or `.smart on`.
       */
      smartMode;
      /**
       * Resets M/X size flags at the start of each assembly stage.
       * `smartMode` is intentionally NOT reset so `.smart off` persists across stages.
       * @returns {void}
       */
      beginPass() {
        this.m16 = false;
        this.x16 = false;
      }
      /**
       * Sets the accumulator (M-flag) width hint.
       * Used by the ca65-compatible `.a8` and `.a16` directives.
       * @param {boolean} is16 True for 16-bit accumulator, false for 8-bit.
       * @returns {void}
       */
      setAccumulatorWidth(is16) {
        this.m16 = is16;
      }
      /**
       * Sets the index register (X-flag) width hint.
       * Used by the ca65-compatible `.i8` and `.i16` directives.
       * @param {boolean} is16 True for 16-bit index registers, false for 8-bit.
       * @returns {void}
       */
      setIndexWidth(is16) {
        this.x16 = is16;
      }
      /**
       * Enables or disables automatic M/X tracking via `SEP`/`REP` instructions.
       * Used by the ca65-compatible `.smart` directive.
       * @param {boolean} enabled True to enable smart mode (default), false to disable.
       * @returns {void}
       */
      setSmartMode(enabled) {
        this.smartMode = enabled;
      }
      /**
       * Applies SEP/REP to assembler-facing M/X flags. Unresolvable immediates
       * (forward labels) are ignored - flags stay at the last known value, matching
       * Asar's "best effort" size tracking across passes.
       * Skipped when `smartMode` is false (explicit `.a8`/`.a16`/`.i8`/`.i16` only).
       * @param {string} opcode The opcode.
       * @param {string} rawOperand The raw operand.
       * @returns {void}
       */
      applySepRep(opcode, rawOperand) {
        if (!this.smartMode || opcode !== "SEP" && opcode !== "REP") {
          return;
        }
        let value = 0;
        try {
          value = this.assembler.operandResolver.getnum(rawOperand);
        } catch {
          return;
        }
        if (opcode === "SEP") {
          if (value & 32) {
            this.m16 = false;
          }
          if (value & 16) {
            this.x16 = false;
          }
          return;
        }
        if (value & 32) {
          this.m16 = true;
        }
        if (value & 16) {
          this.x16 = true;
        }
      }
      /**
       * Immediate operand width in bytes from M/X flags, hex spelling, and .b/.w.
       * Plain hex/define immediates keep their expanded width so Chou `lda #$20`
       * and `lda #!flag` stay 8-bit. Math expressions such as `#(NMI&$FFFF)`
       * follow the M/X flags.
       * @param {string} opcode The opcode.
       * @param {number} operandLength Expanded operand width.
       * @param {boolean} explicitlen Whether a .b/.w/.l suffix forced the width.
       * @param {string} [rawOperand] The raw source operand.
       * @returns {number} 1 or 2.
       */
      immediateBytes(opcode, operandLength, explicitlen, rawOperand = "") {
        if (explicitlen) {
          if (operandLength <= 1) {
            return 1;
          }
          return 2;
        }
        let inner = rawOperand.trim();
        if (inner.startsWith("#")) {
          inner = inner.slice(1).trim();
        }
        const isMathExpression = /[&()*+/<>^|-]/.test(inner);
        const isBareIdentifier = /^[A-Z_a-z]\w*$/.test(inner);
        if (!isMathExpression && !isBareIdentifier) {
          if (operandLength <= 1) {
            return 1;
          }
          return 2;
        }
        let flagWidth = 1;
        if (opcode === "LDX" || opcode === "LDY" || opcode === "CPX" || opcode === "CPY") {
          if (this.x16) {
            flagWidth = 2;
          }
        } else if (this.m16) {
          flagWidth = 2;
        }
        if (operandLength > flagWidth) {
          return 2;
        }
        return flagWidth;
      }
      /**
       * Returns the static 65816 instruction catalog for editor tooling.
       * @returns {InstructionDescriptor[]} The instruction descriptors.
       */
      getInstructionCatalog() {
        return cpu65816Catalog;
      }
      /**
       * Size of a lowered instruction. Must match {@link encodeResolvedInstruction}
       * so layout `step()` stays in sync with emit (including SEP/REP side effects).
       * @param {LoweredInstruction} instruction The instruction.
       * @returns {number} Encoded size in bytes, or 0 if not a 65816 op.
       */
      estimateInstruction(instruction) {
        return this.estimateResolvedInstruction(
          instruction.mnemonic,
          instruction.operandText,
          instruction.loweredOperand.expanded,
          instruction.loweredOperand.length
        );
      }
      /**
       * Encodes a lowered instruction. Returns false only when the mnemonic is not ours.
       * @param {LoweredInstruction} instruction The instruction.
       * @returns {boolean} True if encoded.
       */
      encodeInstruction(instruction) {
        return this.encodeResolvedInstruction(
          instruction.mnemonic,
          instruction.operandText,
          instruction.loweredOperand.expanded,
          instruction.loweredOperand.length
        );
      }
      /**
       * Estimates size from tokenized words (mnemonic + rest-of-line operand).
       * @param {string[]} words The words.
       * @returns {number} Encoded size in bytes.
       */
      estimateSize(words) {
        if (words.length === 0) {
          return 0;
        }
        const mnemonic = words[0] ?? "";
        const rawOperand = words.length > 1 ? words.slice(1).join(" ") : "";
        const loweredOperand = lower65816Operand(this.assembler.operandResolver, rawOperand);
        return this.estimateResolvedInstruction(
          mnemonic,
          rawOperand,
          loweredOperand.expanded,
          loweredOperand.length
        );
      }
      /**
       * Size for a resolved mnemonic/operand. SEP/REP is applied here too so a
       * following immediate in the same estimate pass sees the new M/X width.
       *
       * Asar quirk: `NOP #$n` (and other implied ops with `#`) is a repeat count,
       * not an immediate - size is `n` bytes of the same opcode.
       * `ASL #$n` is the same for shift/inc/dec (repeat the accumulator form).
       *
       * @param {string} mnemonic The mnemonic.
       * @param {string} rawOperand The raw operand.
       * @param {string} operand Expanded operand.
       * @param {number} operandLength Inferred operand width.
       * @returns {number} Encoded size in bytes.
       */
      estimateResolvedInstruction(mnemonic, rawOperand, operand, operandLength) {
        let opcode = mnemonic.toUpperCase();
        const noOperandOpcodes = /* @__PURE__ */ new Set([
          "CLC",
          "CLD",
          "CLI",
          "CLV",
          "DEX",
          "DEY",
          "INX",
          "INY",
          "NOP",
          "PHA",
          "PHB",
          "PHD",
          "PHK",
          "PHP",
          "PHX",
          "PHY",
          "PLA",
          "PLB",
          "PLD",
          "PLP",
          "PLX",
          "PLY",
          "RTI",
          "RTL",
          "RTS",
          "SEC",
          "SED",
          "SEI",
          "STP",
          "TAX",
          "TAY",
          "TCD",
          "TCS",
          "TDC",
          "TSC",
          "TSX",
          "TXA",
          "TXS",
          "TXY",
          "TYA",
          "TYX",
          "WAI",
          "XBA",
          "XCE"
        ]);
        const accumulatorRepeatOpcodes = /* @__PURE__ */ new Set(["ASL", "LSR", "ROL", "ROR", "INC", "DEC"]);
        const branchOpcodes2 = /* @__PURE__ */ new Set([
          "BPL",
          "BMI",
          "BVC",
          "BVS",
          "BCC",
          "BCS",
          "BNE",
          "BEQ",
          "BRA",
          "BRL"
        ]);
        let explicitlen = false;
        const sizedOpcode = this.readMnemonicLength(opcode);
        opcode = sizedOpcode.name;
        if (sizedOpcode.explicitLength !== void 0) {
          explicitlen = true;
          operandLength = sizedOpcode.explicitLength;
        }
        this.applySepRep(opcode, rawOperand);
        if (noOperandOpcodes.has(opcode)) {
          if (rawOperand.startsWith("#")) {
            try {
              return Math.max(1, this.assembler.operandResolver.getnum(rawOperand));
            } catch {
              return 1;
            }
          }
          return 1;
        }
        if (accumulatorRepeatOpcodes.has(opcode) && rawOperand.startsWith("#")) {
          return this.assembler.operandResolver.getnum(rawOperand.substring(1));
        }
        const lowered = lower65816Operand(this.assembler.operandResolver, rawOperand);
        const registerName = (lowered.registerName ?? "").toUpperCase();
        if (accumulatorRepeatOpcodes.has(opcode) && (!rawOperand.trim() || registerName === "A" || /^a$/i.test(rawOperand.trim()))) {
          return 1;
        }
        if (branchOpcodes2.has(opcode)) {
          if (opcode === "BRL") {
            return 3;
          }
          return 2;
        }
        if (opcode === "MVP" || opcode === "MVN") {
          return 3;
        }
        if (opcode === "PER") {
          return 3;
        }
        if (opcode === "PEA") {
          return 3;
        }
        if (["BRK", "COP", "PEI", "REP", "SEP", "WDM"].includes(opcode)) {
          return 2;
        }
        if (lowered.mode === "indirectLong" || lowered.mode === "indirectLongIndexedY") {
          if (opcode === "JMP" || opcode === "JML" || opcode === "JSL" || opcode === "JSR") {
            return 3;
          }
          return 2;
        }
        if (opcode === "JSL" || opcode === "JML") {
          return 4;
        }
        if (opcode === "JMP" || opcode === "JSR") {
          return 3;
        }
        if (explicitlen) {
          return 1 + operandLength;
        }
        if (lowered.immediate || rawOperand.startsWith("#") || operand.startsWith("#")) {
          return 1 + this.immediateBytes(opcode, operandLength, false, rawOperand);
        }
        if (lowered.mode === "stackRelative" || lowered.mode === "stackRelativeIndexedIndirectY" || lowered.mode === "indexedIndirectX" || lowered.mode === "directPageIndirect" || lowered.mode === "indirectIndexedY" || lowered.mode === "directPageIndexedXIndirect") {
          return 2;
        }
        if (lowered.mode === "absoluteLong" || lowered.mode === "absoluteLongIndexedX") {
          return 4;
        }
        if (/^\$[\da-f]{6}(,x)?$/i.test(operand) || /^\$[\da-f]{6}(,x)?$/i.test(rawOperand)) {
          return 4;
        }
        return 1 + operandLength;
      }
      /**
       * Processes a 65816 assembly instruction.
       * @param {string[]} words The tokenized instruction.
       * @returns {boolean} True if the instruction was handled, false otherwise.
       */
      encode(words) {
        if (words.length === 0) {
          return false;
        }
        const mnemonic = words[0] ?? "";
        const rawOperand = words.length > 1 ? words.slice(1).join(" ") : "";
        const loweredOperand = lower65816Operand(this.assembler.operandResolver, rawOperand);
        return this.encodeResolvedInstruction(
          mnemonic,
          rawOperand,
          loweredOperand.expanded,
          loweredOperand.length
        );
      }
      /**
       * Encodes a resolved mnemonic/operand. Width suffixes (`.b/.w/.l`) and
       * classified modes choose among opcode tables in the `handle*` methods.
       * @param {string} mnemonic The mnemonic.
       * @param {string} rawOperand Source operand (for `#` / indexing tests).
       * @param {string} operand Expanded operand.
       * @param {number} operandLength Inferred width before `.b/.w/.l`.
       * @returns {boolean} True if this architecture handled the instruction.
       */
      encodeResolvedInstruction(mnemonic, rawOperand, operand, operandLength) {
        let opcode = mnemonic.toUpperCase();
        let len = 0;
        let explicitlen = false;
        const sizedOpcode = this.readMnemonicLength(opcode);
        opcode = sizedOpcode.name;
        if (sizedOpcode.explicitLength !== void 0) {
          explicitlen = true;
          len = sizedOpcode.explicitLength;
        } else {
          len = operandLength;
        }
        this.applySepRep(opcode, rawOperand);
        if (["ASL", "LSR", "ROL", "ROR", "INC", "DEC"].includes(opcode)) {
          let arithmeticOperand = operand;
          if (/^a$/i.test(rawOperand.trim())) {
            arithmeticOperand = rawOperand;
          }
          return this.handleArithmeticOperations(opcode, arithmeticOperand, len, explicitlen);
        }
        if (["SBC", "STA", "LDA", "ADC"].includes(opcode)) {
          return this.handleMemoryOperations(opcode, operand, len, explicitlen, rawOperand);
        }
        if (["AND", "EOR", "ORA", "CMP", "CPX", "CPY"].includes(opcode)) {
          return this.handleLogicAndCompareOperations(opcode, operand, len, explicitlen, rawOperand);
        }
        if (this.handleNoOperandOperations(opcode, operand)) {
          return true;
        }
        if (opcode === "LDX" || opcode === "LDY") {
          return this.handleLoadRegister(opcode, operand, len, explicitlen);
        }
        if (["JSL", "JSR", "JMP", "JML"].includes(opcode)) {
          return this.handleJump(opcode, operand, rawOperand);
        }
        if (["BIT", "TSB", "TRB"].includes(opcode)) {
          return this.handleBitTestOperations(opcode, operand, len, explicitlen);
        }
        if (opcode === "MVP" || opcode === "MVN") {
          return this.handleBlockMove(opcode, operand);
        }
        if (opcode === "PER") {
          return this.handlePER(operand);
        }
        if (["STX", "STY", "STZ"].includes(opcode)) {
          return this.handleStoreOperations(opcode, operand, len, explicitlen);
        }
        if (this.handleBranchInstructions(opcode, operand)) return true;
        let num = 0;
        if (operand) {
          num = this.assembler.operandResolver.getnum(operand);
        }
        return this.handleGenericOpcode(opcode, num, len);
      }
      /**
       * Encodes ADC / LDA / SBC / STA. Logic/compare ops are
       * {@link handleLogicAndCompareOperations}; STA has no immediate form.
       *
       * DP (`$xx` / `$xx,x`) is used only when `optimize dp ram|always` is on or
       * the source spelling is explicit 1–2 digit hex. Otherwise a DP-sized value
       * still emits absolute (Asar `optimize dp none` default).
       *
       * @param {string} opcode ADC, LDA, SBC, or STA.
       * @param {string} operand Expanded operand.
       * @param {number} len Inferred or forced operand width.
       * @param {boolean} explicitlen True when `.b/.w/.l` forced the width.
       * @param {string} rawOperand Source operand (immediates / indexing tests).
       * @returns {boolean} True if this family handled the opcode.
       */
      handleMemoryOperations(opcode, operand, len, explicitlen, rawOperand = operand) {
        if (!operand) {
          throw new Error(`Error: ${opcode} requires an operand.`);
        }
        const loweredOperand = lower65816Operand(this.assembler.operandResolver, rawOperand);
        const resolvedOperand = loweredOperand.expanded;
        const baseOperand = loweredOperand.baseExpression ?? resolvedOperand;
        const isExplicitDirectPage = loweredOperand.explicitDirectPage ?? false;
        const isExplicitDirectPageIndexedX = loweredOperand.explicitDirectPageIndexedX ?? false;
        if (loweredOperand.immediate) {
          const immediateOpcodes = {
            ADC: 105,
            LDA: 169,
            SBC: 233
            // STA does not support immediate mode
          };
          if (opcode in immediateOpcodes) {
            this.assembler.write1(immediateOpcodes[opcode]);
            const width = this.immediateBytes(opcode, len, explicitlen, rawOperand);
            const value = this.assembler.operandResolver.getnum(resolvedOperand);
            if (width === 1) {
              this.assembler.write1(value);
            } else {
              this.assembler.write2(value);
            }
            return true;
          }
          throw new Error(`Error: ${opcode} does not support immediate mode.`);
        }
        if (explicitlen && !keepsFixedWidthAddressingMode(loweredOperand.mode, len)) {
          if (isIndexedMemory(loweredOperand, "x")) {
            const forcedIndexed = {
              ADC: { 1: 117, 2: 125, 3: 127 },
              STA: { 1: 149, 2: 157, 3: 159 },
              LDA: { 1: 181, 2: 189, 3: 191 },
              SBC: { 1: 245, 2: 253, 3: 255 }
            };
            if (!(opcode in forcedIndexed)) {
              throw new Error(`Error: Opcode ${opcode} not supported in forced indexed mode.`);
            }
            this.assembler.write1(forcedIndexed[opcode][len]);
            if (len === 1) {
              this.assembler.write1(this.assembler.operandResolver.getnum(baseOperand));
            } else if (len === 2) {
              this.assembler.write2(this.assembler.operandResolver.getnum(baseOperand));
            } else if (len === 3) {
              this.assembler.write3(this.assembler.operandResolver.getnum(baseOperand));
            }
            return true;
          } else if (isIndexedMemory(loweredOperand, "y")) {
            const forcedIndexedY = {
              ADC: { 2: 121 },
              STA: { 2: 153 },
              LDA: { 2: 185 },
              SBC: { 2: 249 }
            };
            if (!(opcode in forcedIndexedY) || !(len in forcedIndexedY[opcode])) {
              throw new Error(`Error: Opcode ${opcode} not supported in forced indexed-Y mode.`);
            }
            this.assembler.write1(forcedIndexedY[opcode][len]);
            this.assembler.write2(this.assembler.operandResolver.getnum(baseOperand));
            return true;
          } else {
            const forcedNonIndexed = {
              ADC: { 1: 101, 2: 109, 3: 111 },
              STA: { 1: 133, 2: 141, 3: 143 },
              LDA: { 1: 165, 2: 173, 3: 175 },
              SBC: { 1: 229, 2: 237, 3: 239 }
            };
            if (!(opcode in forcedNonIndexed)) {
              throw new Error(`Error: Opcode ${opcode} not supported in forced non-indexed mode.`);
            }
            this.assembler.write1(forcedNonIndexed[opcode][len]);
            if (len === 1) {
              this.assembler.write1(this.assembler.operandResolver.getnum(operand));
            } else if (len === 2) {
              this.assembler.write2(this.assembler.operandResolver.getnum(operand));
            } else if (len === 3) {
              this.assembler.write3(this.assembler.operandResolver.getnum(operand));
            }
            return true;
          }
        }
        if (loweredOperand.mode === "absoluteIndexedX") {
          const absoluteIndexedXOpcodes = {
            ADC: 125,
            STA: 157,
            LDA: 189,
            SBC: 253
          };
          if (opcode in absoluteIndexedXOpcodes) {
            this.assembler.write1(absoluteIndexedXOpcodes[opcode]);
            this.assembler.write2(this.assembler.operandResolver.getnum(baseOperand));
            return true;
          }
        }
        if (loweredOperand.mode === "absoluteLongIndexedX") {
          const absoluteLongIndexedXOpcodes = {
            ADC: 127,
            STA: 159,
            LDA: 191,
            SBC: 255
          };
          if (opcode in absoluteLongIndexedXOpcodes) {
            this.assembler.write1(absoluteLongIndexedXOpcodes[opcode]);
            this.assembler.write3(this.assembler.operandResolver.getnum(baseOperand));
            return true;
          }
        }
        if (loweredOperand.mode === "indexedIndirectX") {
          const indexedIndirectOpcodes = {
            ADC: 97,
            STA: 129,
            LDA: 161,
            SBC: 225
          };
          if (opcode in indexedIndirectOpcodes) {
            this.assembler.write1(indexedIndirectOpcodes[opcode]);
            this.assembler.write1(this.assembler.operandResolver.getnum(baseOperand));
            return true;
          }
        }
        if (loweredOperand.mode === "directPageIndirect") {
          const indirectDPIndirect = {
            ADC: 114,
            STA: 146,
            LDA: 178,
            SBC: 242
          };
          if (opcode in indirectDPIndirect) {
            this.assembler.write1(indirectDPIndirect[opcode]);
            this.assembler.write1(this.assembler.operandResolver.getnum(baseOperand));
            return true;
          }
        }
        if ((this.optimizeDirectPage() || isExplicitDirectPageIndexedX) && loweredOperand.indexRegister === "x" && !loweredOperand.indirect) {
          const dpIndexedXOpcodes = {
            ADC: 117,
            STA: 149,
            LDA: 181,
            SBC: 245
          };
          if (opcode in dpIndexedXOpcodes) {
            this.assembler.write1(dpIndexedXOpcodes[opcode]);
            const dpAddress = this.assembler.operandResolver.getnum(baseOperand);
            this.assembler.write1(dpAddress);
            return true;
          }
        }
        if (loweredOperand.mode === "stackRelative") {
          const stackRelativeOpcodes = {
            ADC: 99,
            STA: 131,
            LDA: 163,
            SBC: 227
          };
          if (opcode in stackRelativeOpcodes) {
            this.assembler.write1(stackRelativeOpcodes[opcode]);
            this.assembler.write1(this.assembler.operandResolver.getnum(baseOperand));
            return true;
          }
        }
        if (loweredOperand.mode === "stackRelativeIndexedIndirectY") {
          const stackIndexedOpcodes = {
            ADC: 115,
            STA: 147,
            LDA: 179,
            SBC: 243
          };
          if (opcode in stackIndexedOpcodes) {
            this.assembler.write1(stackIndexedOpcodes[opcode]);
            this.assembler.write1(this.assembler.operandResolver.getnum(baseOperand));
            return true;
          }
        }
        if (loweredOperand.mode === "indirectLong") {
          const indirectLongOpcodes = {
            ADC: 103,
            STA: 135,
            LDA: 167,
            SBC: 231
          };
          if (opcode in indirectLongOpcodes) {
            this.assembler.write1(indirectLongOpcodes[opcode]);
            this.assembler.write1(this.assembler.operandResolver.getnum(baseOperand));
            return true;
          }
        }
        if (loweredOperand.mode === "indirectLongIndexedY") {
          const indirectLongIndexedOpcodes = {
            ADC: 119,
            STA: 151,
            LDA: 183,
            SBC: 247
          };
          if (opcode in indirectLongIndexedOpcodes) {
            this.assembler.write1(indirectLongIndexedOpcodes[opcode]);
            this.assembler.write1(this.assembler.operandResolver.getnum(baseOperand));
            return true;
          }
        }
        if (loweredOperand.mode === "indirectIndexedY") {
          const indirectIndexedOpcodes = {
            ADC: 113,
            STA: 145,
            LDA: 177,
            SBC: 241
          };
          if (opcode in indirectIndexedOpcodes) {
            this.assembler.write1(indirectIndexedOpcodes[opcode]);
            this.assembler.write1(this.assembler.operandResolver.getnum(baseOperand));
            return true;
          }
        }
        if (isIndexedMemory(loweredOperand, "x")) {
          const absoluteXOpcodes = {
            ADC: 125,
            STA: 157,
            LDA: 189,
            SBC: 253
          };
          if (opcode in absoluteXOpcodes) {
            this.assembler.write1(absoluteXOpcodes[opcode]);
            this.assembler.write2(this.assembler.operandResolver.getnum(baseOperand));
            return true;
          }
        }
        if (isIndexedMemory(loweredOperand, "y")) {
          const absoluteYOpcodes = {
            ADC: 121,
            STA: 153,
            LDA: 185,
            SBC: 249
          };
          if (opcode in absoluteYOpcodes) {
            this.assembler.write1(absoluteYOpcodes[opcode]);
            this.assembler.write2(this.assembler.operandResolver.getnum(baseOperand));
            return true;
          }
        }
        if (loweredOperand.mode === "absoluteLong") {
          const longOpcodes = {
            ADC: 111,
            STA: 143,
            LDA: 175,
            SBC: 239
          };
          if (opcode in longOpcodes) {
            this.assembler.write1(longOpcodes[opcode]);
            this.assembler.write3(this.assembler.operandResolver.getnum(resolvedOperand));
            return true;
          }
        }
        if (loweredOperand.mode === "absolute") {
          const absoluteOpcodes = {
            ADC: 109,
            STA: 141,
            LDA: 173,
            SBC: 237
          };
          if (opcode in absoluteOpcodes) {
            this.assembler.write1(absoluteOpcodes[opcode]);
            this.assembler.write2(this.assembler.operandResolver.getnum(resolvedOperand));
            return true;
          }
        }
        if (this.optimizeDirectPage() || isExplicitDirectPage) {
          const directPageOpcodes = {
            ADC: 101,
            STA: 133,
            LDA: 165,
            SBC: 229
          };
          if (opcode in directPageOpcodes) {
            this.assembler.write1(directPageOpcodes[opcode]);
            this.assembler.write1(this.assembler.operandResolver.getnum(operand));
            return true;
          }
        } else {
          const absoluteOpcodes = {
            ADC: 109,
            STA: 141,
            LDA: 173,
            SBC: 237
          };
          if (opcode in absoluteOpcodes) {
            this.assembler.write1(absoluteOpcodes[opcode]);
            this.assembler.write2(this.assembler.operandResolver.getnum(operand));
            return true;
          }
        }
        return false;
      }
      /**
       * Encodes AND / EOR / ORA / CMP / CPX / CPY.
       *
       * Unforced DP is **spelling-based**, not `optimize dp`: expanded `$xx` (exactly two
       * hex digits) is DP even when `optimize dp none`. That diverges from
       * {@link handleMemoryOperations} (ADC/LDA/SBC/STA), which require the optimize
       * flag or an explicit 1–2 digit hex spelling. `$007E` is four digits → absolute.
       *
       * Classifier `[$nn]` is `indirectLong` and remaps to `directIndirectLong` (1-byte
       * DP, ORA `$07`) when the table has that key. CPX/CPY omit it and throw.
       * Forced `.l,x` is abs,x + 2 (ORA `$1D` + 2 = `$1F`). Forced `,y` is abs only
       * (`len === 2`); this family has no dp,y / long,y. CPX/CPY have no `(dp,x)` /
       * long / stack forms.
       *
       * @param {string} opcode AND, EOR, ORA, CMP, CPX, or CPY.
       * @param {string} operand Expanded operand.
       * @param {number} len Inferred or forced operand width.
       * @param {boolean} explicitlen True when `.b/.w/.l` forced the width.
       * @param {string} [rawOperand] Source operand before expansion.
       * @returns {boolean} True if this family handled the opcode.
       */
      handleLogicAndCompareOperations(opcode, operand, len, explicitlen, rawOperand = operand) {
        const opcodes = {
          ORA: {
            immediate: 9,
            direct: 5,
            directX: 21,
            absolute: 13,
            absoluteX: 29,
            absoluteY: 25,
            indirectX: 1,
            indirectY: 17,
            indirect: 18,
            // Same bytes as absoluteLong / absoluteLongX (ORA al / al,x). Classifier
            // `[...]` is remapped to directIndirectLong first; these keys are the
            // leftover path for opcodes that lack [dp] (CPX/CPY → throw).
            indirectLong: 15,
            indirectLongY: 31,
            stackRelative: 3,
            stackRelativeIndirectY: 19,
            absoluteLong: 15,
            absoluteLongX: 31,
            directIndirectLong: 7,
            directIndirectLongY: 23
          },
          AND: {
            immediate: 41,
            direct: 37,
            directX: 53,
            absolute: 45,
            absoluteX: 61,
            absoluteY: 57,
            indirectX: 33,
            indirectY: 49,
            indirect: 50,
            indirectLong: 47,
            indirectLongY: 63,
            stackRelative: 35,
            stackRelativeIndirectY: 51,
            absoluteLong: 47,
            absoluteLongX: 63,
            directIndirectLong: 39,
            directIndirectLongY: 55
          },
          EOR: {
            immediate: 73,
            direct: 69,
            directX: 85,
            absolute: 77,
            absoluteX: 93,
            absoluteY: 89,
            indirectX: 65,
            indirectY: 81,
            indirect: 82,
            indirectLong: 79,
            indirectLongY: 95,
            stackRelative: 67,
            stackRelativeIndirectY: 83,
            absoluteLong: 79,
            absoluteLongX: 95,
            directIndirectLong: 71,
            directIndirectLongY: 87
          },
          CMP: {
            immediate: 201,
            direct: 197,
            directX: 213,
            absolute: 205,
            absoluteX: 221,
            absoluteY: 217,
            indirectX: 193,
            indirectY: 209,
            indirect: 210,
            indirectLong: 207,
            indirectLongY: 223,
            stackRelative: 195,
            stackRelativeIndirectY: 211,
            absoluteLong: 207,
            absoluteLongX: 223,
            directIndirectLong: 199,
            directIndirectLongY: 215
          },
          CPX: { immediate: 224, direct: 228, absolute: 236 },
          CPY: { immediate: 192, direct: 196, absolute: 204 }
        };
        const dpMap = {
          AND: 37,
          ORA: 5,
          EOR: 69,
          CMP: 197,
          CPX: 228,
          CPY: 196
        };
        const absMap = {
          AND: 45,
          ORA: 13,
          EOR: 77,
          CMP: 205,
          CPX: 236,
          CPY: 204
        };
        const absLongMap = {
          AND: 47,
          ORA: 15,
          EOR: 79,
          CMP: 207
        };
        const dpXMap = {
          AND: 53,
          ORA: 21,
          EOR: 85,
          CMP: 213
        };
        const absXMap = {
          AND: 61,
          ORA: 29,
          EOR: 93,
          CMP: 221
        };
        const absYMap = {
          AND: 57,
          ORA: 25,
          EOR: 89,
          CMP: 217
        };
        if (!(opcode in opcodes)) {
          return false;
        }
        const logicOpcode = opcode;
        const loweredOperand = lower65816Operand(this.assembler.operandResolver, rawOperand);
        const resolvedOperand = loweredOperand.expanded;
        const baseOperand = loweredOperand.baseExpression ?? resolvedOperand;
        let address4 = 0;
        let mode3;
        if (loweredOperand.immediate) {
          mode3 = "immediate";
          address4 = this.assembler.operandResolver.getnum(baseOperand);
          this.assembler.write1(opcodes[logicOpcode].immediate);
          const width = this.immediateBytes(opcode, len, explicitlen, rawOperand);
          if (width === 1) {
            this.assembler.write1(address4);
          } else {
            this.assembler.write2(address4);
          }
          return true;
        }
        if (explicitlen && !keepsFixedWidthAddressingMode(loweredOperand.mode, len)) {
          let forcedIndexedMode;
          if (isIndexedMemory(loweredOperand, "x")) {
            forcedIndexedMode = "x";
          } else if (loweredOperand.mode === "absoluteIndexedY") {
            forcedIndexedMode = "y";
          }
          const explicitOperand = forcedIndexedMode ? baseOperand : resolvedOperand;
          if (forcedIndexedMode === "x") {
            if (len === 1) {
              const forcedOpcode = dpXMap[logicOpcode];
              if (forcedOpcode === void 0) {
                throw new Error(`Opcode ${logicOpcode} not supported in forced indexed mode.`);
              }
              this.assembler.write1(forcedOpcode);
              this.assembler.write1(this.assembler.operandResolver.getnum(explicitOperand));
            } else if (len === 2) {
              const forcedOpcode = absXMap[logicOpcode];
              if (forcedOpcode === void 0) {
                throw new Error(`Opcode ${logicOpcode} not supported in forced indexed mode.`);
              }
              this.assembler.write1(forcedOpcode);
              this.assembler.write2(this.assembler.operandResolver.getnum(explicitOperand));
            } else if (len === 3) {
              const forcedOpcode = absXMap[logicOpcode];
              if (forcedOpcode === void 0) {
                throw new Error(`Opcode ${logicOpcode} not supported in forced indexed mode.`);
              }
              this.assembler.write1(forcedOpcode + 2);
              this.assembler.write3(this.assembler.operandResolver.getnum(explicitOperand));
            }
            return true;
          } else if (forcedIndexedMode === "y") {
            if (len !== 2) {
              throw new Error(`Opcode ${logicOpcode} not supported in forced indexed mode.`);
            }
            const forcedOpcode = absYMap[logicOpcode];
            if (forcedOpcode === void 0) {
              throw new Error(`Opcode ${logicOpcode} not supported in forced indexed mode.`);
            }
            this.assembler.write1(forcedOpcode);
            this.assembler.write2(this.assembler.operandResolver.getnum(explicitOperand));
            return true;
          } else {
            if (len === 1) {
              this.assembler.write1(dpMap[logicOpcode]);
              this.assembler.write1(this.assembler.operandResolver.getnum(explicitOperand));
            } else if (len === 2) {
              this.assembler.write1(absMap[logicOpcode]);
              this.assembler.write2(this.assembler.operandResolver.getnum(explicitOperand));
            } else if (len === 3) {
              const forcedOpcode = absLongMap[logicOpcode];
              if (forcedOpcode === void 0) {
                throw new Error(`Opcode ${logicOpcode} not supported in forced non-indexed mode.`);
              }
              this.assembler.write1(forcedOpcode);
              this.assembler.write3(this.assembler.operandResolver.getnum(explicitOperand));
            }
            return true;
          }
        }
        if (loweredOperand.mode === "absoluteIndexedX" && opcodes[logicOpcode].absoluteX) {
          mode3 = "absoluteX";
          address4 = this.assembler.operandResolver.getnum(baseOperand);
        } else if (loweredOperand.mode === "absoluteIndexedY" && opcodes[logicOpcode].absoluteY) {
          mode3 = "absoluteY";
          address4 = this.assembler.operandResolver.getnum(baseOperand);
        } else if (loweredOperand.mode === "absoluteLong") {
          mode3 = "absoluteLong";
          address4 = this.assembler.operandResolver.getnum(resolvedOperand);
        } else if (loweredOperand.mode === "absoluteLongIndexedX" && opcodes[logicOpcode].absoluteLongX) {
          mode3 = "absoluteLongX";
          address4 = this.assembler.operandResolver.getnum(baseOperand);
        } else if (loweredOperand.mode === "stackRelative" && opcodes[logicOpcode].stackRelative) {
          mode3 = "stackRelative";
          address4 = this.assembler.operandResolver.getnum(baseOperand);
        } else if (loweredOperand.mode === "stackRelativeIndexedIndirectY" && opcodes[logicOpcode].stackRelativeIndirectY) {
          mode3 = "stackRelativeIndirectY";
          address4 = this.assembler.operandResolver.getnum(baseOperand);
        } else if (/^\$[\dA-Fa-f]{2}$/.test(resolvedOperand)) {
          mode3 = "direct";
          address4 = this.assembler.operandResolver.getnum(resolvedOperand);
        } else if (loweredOperand.mode === "directPageIndexedX" && opcodes[logicOpcode].directX) {
          mode3 = "directX";
          address4 = this.assembler.operandResolver.getnum(baseOperand);
        } else if (loweredOperand.mode === "indexedIndirectX") {
          mode3 = "indirectX";
          address4 = this.assembler.operandResolver.getnum(baseOperand);
        } else if (loweredOperand.mode === "indirectIndexedY") {
          mode3 = "indirectY";
          address4 = this.assembler.operandResolver.getnum(baseOperand);
        } else if (loweredOperand.mode === "directPageIndirect") {
          mode3 = "indirect";
          address4 = this.assembler.operandResolver.getnum(baseOperand);
        } else if (loweredOperand.mode === "indirectLong" && opcodes[logicOpcode].directIndirectLong) {
          mode3 = "directIndirectLong";
          address4 = this.assembler.operandResolver.getnum(baseOperand);
        } else if (loweredOperand.mode === "indirectLongIndexedY" && opcodes[logicOpcode].directIndirectLongY) {
          mode3 = "directIndirectLongY";
          address4 = this.assembler.operandResolver.getnum(baseOperand);
        } else if (loweredOperand.mode === "indirectLong") {
          mode3 = "indirectLong";
          address4 = this.assembler.operandResolver.getnum(baseOperand);
        } else if (loweredOperand.mode === "indirectLongIndexedY") {
          mode3 = "indirectLongY";
          address4 = this.assembler.operandResolver.getnum(baseOperand);
        } else if (loweredOperand.mode === "absolute") {
          mode3 = "absolute";
          address4 = this.assembler.operandResolver.getnum(resolvedOperand);
        } else {
          throw new Error(`Error: Invalid operand format for ${opcode}: ${operand}`);
        }
        const opcodeByte = opcodes[logicOpcode][mode3];
        if (!opcodeByte) {
          throw new Error(`Error: Invalid operand format for ${opcode}: ${operand} => ${opcodeByte}`);
        }
        this.assembler.write1(opcodeByte);
        if ((opcode === "AND" || opcode === "ORA" || opcode === "EOR" || opcode === "CPY" || opcode === "CPX" || opcode === "CMP") && mode3 === "directIndirectLong") {
          this.assembler.write1(address4);
        } else if (["absolute", "absoluteX", "absoluteY", "directIndirectLong"].includes(mode3)) {
          this.assembler.write2(address4);
        } else if (["absoluteLong", "absoluteLongX", "indirectLong", "indirectLongY"].includes(mode3)) {
          this.assembler.write3(address4);
        } else {
          this.assembler.write1(address4);
        }
        return true;
      }
      /**
       * Implied ops. `OPCODE #$n` is Asar's repeat: write the opcode `n` times.
       * `expandOperand` may turn `#10` into `#$A`; strip `$` before parseInt.
       * Count `0` emits nothing (still "handled").
       * @param {string} opcode The opcode to handle.
       * @param {string} operand The operand to handle.
       * @returns {boolean} True if the opcode was handled, false otherwise.
       */
      handleNoOperandOperations(opcode, operand) {
        const stackOpcodes = {
          CLC: 24,
          CLD: 216,
          CLI: 88,
          CLV: 184,
          DEX: 202,
          DEY: 136,
          INX: 232,
          INY: 200,
          NOP: 234,
          PHA: 72,
          PHB: 139,
          PHD: 11,
          PHK: 75,
          PHP: 8,
          PHX: 218,
          PHY: 90,
          PLA: 104,
          PLB: 171,
          PLD: 43,
          PLP: 40,
          PLX: 250,
          PLY: 122,
          RTI: 64,
          RTL: 107,
          RTS: 96,
          SEC: 56,
          SED: 248,
          SEI: 120,
          STP: 219,
          TAX: 170,
          TAY: 168,
          TCD: 91,
          TCS: 27,
          TDC: 123,
          TSC: 59,
          TSX: 186,
          TXA: 138,
          TXS: 154,
          TXY: 155,
          TYA: 152,
          TYX: 187,
          WAI: 203,
          XBA: 235,
          XCE: 251
        };
        if (!(opcode in stackOpcodes)) {
          return false;
        }
        let count = 1;
        if (operand && operand.startsWith("#")) {
          let repStr = operand.substring(1);
          if (repStr.startsWith("$")) {
            repStr = repStr.substring(1);
          }
          count = Number.parseInt(repStr, 10);
          if (Number.isNaN(count)) {
            throw new Error(`Invalid repeat count in pseudo opcode: ${operand}`);
          }
        }
        if (count > 0) {
          for (let i = 0; i < count; i++) {
            this.assembler.write1(stackOpcodes[opcode]);
          }
        }
        return true;
      }
      /**
       * Encodes ASL / LSR / ROL / ROR / INC / DEC.
       * Bare or `A` is accumulator. `ASL #$n` (and friends) repeats the accumulator
       * opcode `n` times - Asar pseudo, not a DP address. `.l` is rejected.
       *
       * @param {string} opcode Shift, rotate, INC, or DEC.
       * @param {string} operand Operand or empty for implied accumulator.
       * @param {number} len Forced width when `explicitlen` is true.
       * @param {boolean} explicitlen True when `.b/.w` forced the width.
       * @returns {boolean} True if this family handled the opcode.
       */
      handleArithmeticOperations(opcode, operand, len, explicitlen) {
        const operandText = operand?.trim() || "A";
        const accumulatorOpcodes = {
          ASL: 10,
          LSR: 74,
          ROL: 42,
          ROR: 106,
          INC: 26,
          DEC: 58
        };
        if (operandText.startsWith("#")) {
          const repeatCount = this.assembler.operandResolver.getnum(operandText.substring(1));
          if (!Number.isInteger(repeatCount) || repeatCount < 1) {
            throw new Error(`Invalid repeat count in pseudo opcode: ${operandText}`);
          }
          if (opcode in accumulatorOpcodes) {
            for (let i = 0; i < repeatCount; i++) {
              this.assembler.write1(accumulatorOpcodes[opcode]);
            }
            return true;
          }
        }
        if (operandText === "A") {
          if (opcode in accumulatorOpcodes) {
            this.assembler.write1(accumulatorOpcodes[opcode]);
            return true;
          }
        }
        if (!operand) {
          throw new Error(`Error: ${opcode} requires an operand.`);
        }
        const loweredOperand = lower65816Operand(this.assembler.operandResolver, operandText);
        const rawOperand = operandText;
        const isIndexed = isIndexedMemory(loweredOperand, "x");
        const normalizedOperand = isIndexed ? rawOperand.slice(0, -2).trim() : rawOperand;
        if (explicitlen) {
          if (isIndexed) {
            const forcedIndexed = {
              ASL: { 1: 22, 2: 30 },
              LSR: { 1: 86, 2: 94 },
              ROL: { 1: 54, 2: 62 },
              ROR: { 1: 118, 2: 126 },
              INC: { 1: 246, 2: 254 },
              DEC: { 1: 214, 2: 222 }
            };
            if (!(opcode in forcedIndexed)) {
              throw new Error(`Opcode ${opcode} not supported in forced indexed mode.`);
            }
            this.assembler.write1(forcedIndexed[opcode][len]);
            if (len === 1) {
              this.assembler.write1(this.assembler.operandResolver.getnum(normalizedOperand));
            } else if (len === 2) {
              this.assembler.write2(this.assembler.operandResolver.getnum(normalizedOperand));
            } else {
              throw new Error("Forced length for arithmetic operations must be 1 or 2 bytes.");
            }
            return true;
          } else {
            const forcedNonIndexed = {
              ASL: { 1: 6, 2: 14 },
              LSR: { 1: 70, 2: 78 },
              ROL: { 1: 38, 2: 46 },
              ROR: { 1: 102, 2: 110 },
              INC: { 1: 230, 2: 238 },
              DEC: { 1: 198, 2: 206 }
            };
            if (!(opcode in forcedNonIndexed)) {
              throw new Error(`Opcode ${opcode} not supported in forced non-indexed mode.`);
            }
            this.assembler.write1(forcedNonIndexed[opcode][len]);
            if (len === 1) {
              this.assembler.write1(this.assembler.operandResolver.getnum(normalizedOperand));
            } else if (len === 2) {
              this.assembler.write2(this.assembler.operandResolver.getnum(normalizedOperand));
            } else {
              throw new Error("Forced length for arithmetic operations must be 1 or 2 bytes.");
            }
            return true;
          }
        }
        if (/^\$[\da-f]{2}$/i.test(normalizedOperand) && loweredOperand.mode === "directPageIndexedX") {
          const dpIndexedXOpcodes = {
            ASL: 22,
            ROL: 54,
            LSR: 86,
            ROR: 118,
            INC: 246,
            DEC: 214
          };
          if (opcode in dpIndexedXOpcodes) {
            this.assembler.write1(dpIndexedXOpcodes[opcode]);
            this.assembler.write1(this.assembler.operandResolver.getnum(normalizedOperand));
            return true;
          }
        }
        if (loweredOperand.mode === "absoluteIndexedX") {
          const absoluteXOpcodes = {
            ASL: 30,
            LSR: 94,
            ROL: 62,
            ROR: 126,
            INC: 254,
            DEC: 222
          };
          if (opcode in absoluteXOpcodes) {
            this.assembler.write1(absoluteXOpcodes[opcode]);
            this.assembler.write2(this.assembler.operandResolver.getnum(normalizedOperand));
            return true;
          }
        }
        if (loweredOperand.mode === "absolute") {
          const absoluteOpcodes = {
            ASL: 14,
            LSR: 78,
            ROL: 46,
            ROR: 110,
            INC: 238,
            DEC: 206
          };
          if (opcode in absoluteOpcodes) {
            this.assembler.write1(absoluteOpcodes[opcode]);
            this.assembler.write2(this.assembler.operandResolver.getnum(normalizedOperand));
            return true;
          }
        }
        const directPageOpcodes = {
          ASL: 6,
          LSR: 70,
          ROL: 38,
          ROR: 102,
          INC: 230,
          DEC: 198
        };
        if (opcode in directPageOpcodes) {
          this.assembler.write1(directPageOpcodes[opcode]);
          this.assembler.write1(this.assembler.operandResolver.getnum(rawOperand));
          return true;
        }
        return false;
      }
      /**
       * Encodes LDX / LDY. Immediate width follows {@link immediateBytes} (X flag).
       * Hardware: LDX indexes Y, LDY indexes X - there is no LDX abs,x.
       * `.l` is rejected. Without `.b/.w`, `$xxxx` spelling or value `> $FF` picks abs.
       *
       * @param {string} opcode LDX or LDY.
       * @param {string} operand Source operand.
       * @param {number} len Inferred or forced width.
       * @param {boolean} explicitlen True when `.b/.w` forced the width.
       * @returns {boolean} True if LDX/LDY was encoded.
       */
      handleLoadRegister(opcode, operand, len, explicitlen) {
        if (!operand) {
          throw new Error(`Error: ${opcode} requires an operand.`);
        }
        const loweredOperand = lower65816Operand(this.assembler.operandResolver, operand);
        let opcodeByte = 0;
        let address4 = 0;
        const isLDX = opcode === "LDX";
        const isLDY = opcode === "LDY";
        if (operand.startsWith("#")) {
          if (isLDX) {
            opcodeByte = 162;
          } else if (isLDY) {
            opcodeByte = 160;
          }
          address4 = this.assembler.operandResolver.getnum(operand.slice(1));
          this.assembler.write1(opcodeByte);
          const width = this.immediateBytes(opcode, len, explicitlen, operand);
          if (width === 1) {
            this.assembler.write1(address4);
          } else {
            this.assembler.write2(address4);
          }
          return true;
        }
        const isIndexed = isLDX && isIndexedMemory(loweredOperand, "y") || isLDY && isIndexedMemory(loweredOperand, "x");
        if (isIndexed) {
          operand = operand.slice(0, -2).trim();
        }
        const isDirectPageLiteral = /^\$[\da-f]{1,2}$/i.test(operand);
        const isAbsoluteLiteral = /^\$[\da-f]{4}$/i.test(operand);
        const inferredAbsoluteWidth = !isDirectPageLiteral && (loweredOperand.length === 2 || len === 2);
        if (explicitlen) {
          if (isLDX) {
            if (!isIndexed) {
              const forcedLDX = { 1: 166, 2: 174 };
              opcodeByte = forcedLDX[len] ?? 174;
            } else {
              const forcedLDXY = { 1: 182, 2: 190 };
              opcodeByte = forcedLDXY[len] ?? 190;
            }
          } else if (isLDY) {
            if (!isIndexed) {
              const forcedLDY = { 1: 164, 2: 172 };
              opcodeByte = forcedLDY[len] ?? 172;
            } else {
              const forcedLDYX = { 1: 180, 2: 188 };
              opcodeByte = forcedLDYX[len] ?? 188;
            }
          }
          address4 = this.assembler.operandResolver.getnum(operand);
          this.assembler.write1(opcodeByte);
          if (len === 1) {
            this.assembler.write1(address4);
          } else if (len === 2) {
            this.assembler.write2(address4);
          } else {
            throw new Error(`Forced length ${len} not supported for ${opcode}`);
          }
          return true;
        }
        if (isLDX) {
          if (!isIndexed) {
            address4 = this.assembler.operandResolver.getnum(operand);
            if (loweredOperand.mode === "absolute" && !isDirectPageLiteral || isAbsoluteLiteral || inferredAbsoluteWidth || address4 > 255) {
              opcodeByte = 174;
              this.assembler.write1(opcodeByte);
              this.assembler.write2(address4);
            } else {
              opcodeByte = 166;
              this.assembler.write1(opcodeByte);
              this.assembler.write1(address4);
            }
          } else {
            address4 = this.assembler.operandResolver.getnum(operand);
            if (loweredOperand.mode === "absoluteIndexedY" && !isDirectPageLiteral || isAbsoluteLiteral || inferredAbsoluteWidth || address4 > 255) {
              opcodeByte = 190;
              this.assembler.write1(opcodeByte);
              this.assembler.write2(address4);
            } else {
              opcodeByte = 182;
              this.assembler.write1(opcodeByte);
              this.assembler.write1(address4);
            }
          }
        } else if (isLDY) {
          if (!isIndexed) {
            address4 = this.assembler.operandResolver.getnum(operand);
            if (loweredOperand.mode === "absolute" && !isDirectPageLiteral || isAbsoluteLiteral || inferredAbsoluteWidth || address4 > 255) {
              opcodeByte = 172;
              this.assembler.write1(opcodeByte);
              this.assembler.write2(address4);
            } else {
              opcodeByte = 164;
              this.assembler.write1(opcodeByte);
              this.assembler.write1(address4);
            }
          } else {
            address4 = this.assembler.operandResolver.getnum(operand);
            if (loweredOperand.mode === "absoluteIndexedX" && !isDirectPageLiteral || isAbsoluteLiteral || inferredAbsoluteWidth || address4 > 255) {
              opcodeByte = 188;
              this.assembler.write1(opcodeByte);
              this.assembler.write2(address4);
            } else {
              opcodeByte = 180;
              this.assembler.write1(opcodeByte);
              this.assembler.write1(address4);
            }
          }
        }
        return true;
      }
      /**
       * Handles JMP / JSR / JML / JSL, including `(addr)`, `[addr]`, and `(addr,x)`.
       * `_bbxxxx` label names can supply a bank when the symbol value is 16-bit.
       * JMP/JSR promote to JML/JSL when the target is outside the current bank.
       * @param {string} opcode - The opcode to handle.
       * @param {string} operand - The resolved operand to handle.
       * @param {string} rawOperand - The original source operand before expansion.
       * @returns {boolean} True if the opcode and operand were handled successfully, false otherwise.
       */
      handleJump(opcode, operand, rawOperand = operand) {
        const loweredOperand = lower65816Operand(this.assembler.operandResolver, rawOperand);
        const baseOperand = loweredOperand.baseExpression ?? rawOperand;
        const symbolicOperand = rawOperand.trim();
        const jumpOpcodes = {
          JMP: 76,
          // JMP Absolute
          JSR: 32,
          // JSR Absolute
          JML: 92,
          // JMP Absolute Long
          JSL: 34
          // JSL Absolute Long
        };
        const jumpIndirectOpcodes = {
          JMP_INDIRECT: 108,
          // JMP (Absolute Indirect)
          JMP_INDIRECT_LONG: 220,
          // JMP [Absolute Indirect Long]
          JMP_INDEXED_INDIRECT: 124,
          // JMP (Absolute Indexed Indirect,X)
          JSR_INDEXED_INDIRECT: 252
          // JSR (Absolute Indexed Indirect,X)
        };
        let address4 = 0;
        let mode3;
        const hintedBank = (() => {
          const simpleBankedLabel = symbolicOperand.startsWith("_") && symbolicOperand.length >= 7 && /^[\da-f]{6}$/i.test(symbolicOperand.slice(1, 7));
          if (!simpleBankedLabel) {
            return null;
          }
          return Number.parseInt(symbolicOperand.slice(1, 3), 16);
        })();
        const selectDirectJumpMode = (currentOpcode, resolvedAddress) => {
          if (currentOpcode === "JML" || currentOpcode === "JSL") {
            return { mode: currentOpcode, address: resolvedAddress };
          }
          if (resolvedAddress > 65535) {
            const currentBank = this.assembler.currentTargetAddress >>> 16 & 255;
            const targetBank = resolvedAddress >>> 16 & 255;
            if ((currentOpcode === "JMP" || currentOpcode === "JSR") && targetBank === currentBank) {
              return { mode: currentOpcode, address: resolvedAddress & 65535 };
            }
            if ((currentOpcode === "JMP" || currentOpcode === "JSR") && hintedBank === currentBank) {
              return { mode: currentOpcode, address: resolvedAddress & 65535 };
            }
            let mode4 = currentOpcode;
            if (currentOpcode === "JMP") mode4 = "JML";
            else if (currentOpcode === "JSR") mode4 = "JSL";
            return { mode: mode4, address: resolvedAddress };
          }
          return { mode: currentOpcode, address: resolvedAddress };
        };
        if (/^\d+$/.test(operand)) {
          ({ mode: mode3, address: address4 } = selectDirectJumpMode(
            opcode,
            this.assembler.operandResolver.getnum(operand)
          ));
        } else if (/^\$[\dA-Fa-f]{1,6}$/.test(operand)) {
          ({ mode: mode3, address: address4 } = selectDirectJumpMode(
            opcode,
            this.assembler.operandResolver.getnum(operand)
          ));
        } else if (loweredOperand.mode === "indirectLong") {
          mode3 = "JMP_INDIRECT_LONG";
          address4 = this.assembler.operandResolver.getnum(baseOperand) & 65535;
        } else if (opcode === "JSR" && loweredOperand.mode === "indexedIndirectX") {
          address4 = this.assembler.operandResolver.getnum(baseOperand) & 65535;
          mode3 = "JSR_INDEXED_INDIRECT";
        } else if (loweredOperand.mode === "indexedIndirectX") {
          address4 = this.assembler.operandResolver.getnum(baseOperand) & 65535;
          mode3 = "JMP_INDEXED_INDIRECT";
        } else if (loweredOperand.mode === "directPageIndirect") {
          address4 = this.assembler.operandResolver.getnum(baseOperand) & 65535;
          mode3 = "JMP_INDIRECT";
        } else {
          try {
            ({ mode: mode3, address: address4 } = selectDirectJumpMode(
              opcode,
              this.assembler.operandResolver.getnum(baseOperand)
            ));
          } catch {
            throw new Error(`Error: Invalid operand format for ${opcode}: ${operand}`);
          }
        }
        if (mode3 in jumpOpcodes) {
          this.assembler.write1(jumpOpcodes[mode3]);
          if (mode3 === "JSL" || mode3 === "JML") {
            this.assembler.write3(address4);
          } else {
            this.assembler.write2(address4);
          }
        } else if (mode3 in jumpIndirectOpcodes) {
          this.assembler.write1(jumpIndirectOpcodes[mode3]);
          this.assembler.write2(address4);
        }
        return true;
      }
      /**
       * PER (Push Effective Relative): encodes a 16-bit displacement as the operand
       * value itself. Asar does not subtract PC here - authors write `label-*` or a
       * literal offset. Adding `currentTargetAddress` double-counted and was removed.
       * @param {string} operand The operand to handle.
       * @returns {boolean} true if the instruction was handled, false otherwise
       */
      handlePER(operand) {
        if (!operand) {
          throw new Error("Error: PER requires an operand.");
        }
        const offset = this.assembler.operandResolver.getnum(operand);
        const address4 = offset;
        this.assembler.write1(98);
        this.assembler.write2(address4);
        return true;
      }
      /**
       * Encodes STX / STY / STZ. STX indexes Y only (no abs,y); STY indexes X only
       * (no abs,x). Forced `.w` on those indexed forms still emits the DP opcode.
       *
       * @param {string} opcode STX, STY, or STZ.
       * @param {string} operand Source operand.
       * @param {number} len Forced width when `explicitlen` is true.
       * @param {boolean} explicitlen True when `.b/.w` forced the width.
       * @returns {boolean} True if this family handled the opcode.
       */
      handleStoreOperations(opcode, operand, len, explicitlen) {
        const loweredOperand = lower65816Operand(this.assembler.operandResolver, operand);
        const rawOperand = operand;
        const storeOpcodes = {
          STX: { direct: 134, absolute: 142, directY: 150 },
          // STX Direct Page, Absolute, Indexed Y
          STY: { direct: 132, absolute: 140, directX: 148 },
          // STY Direct Page, Absolute, Indexed X
          STZ: { direct: 100, directX: 116, absolute: 156, absoluteX: 158 }
          // STZ DP, DP Indexed X, Absolute, Absolute Indexed X
        };
        if (!(opcode in storeOpcodes)) {
          return false;
        }
        const storeOpcode = opcode;
        const storeModeMap = storeOpcodes[storeOpcode];
        const getForcedOpcode = (map, fallback) => {
          const forced = map[len];
          return forced ?? fallback;
        };
        let address4 = 0;
        const isIndexed = storeOpcode === "STX" && isIndexedMemory(loweredOperand, "y") || storeOpcode === "STY" && isIndexedMemory(loweredOperand, "x") || storeOpcode === "STZ" && isIndexedMemory(loweredOperand, "x");
        if (isIndexed) {
          operand = rawOperand.slice(0, -2).trim();
        }
        if (explicitlen) {
          if (isIndexed) {
            if (storeOpcode === "STZ") {
              const forcedSTZIndexed = { 1: 116, 2: 158 };
              this.assembler.write1(getForcedOpcode(forcedSTZIndexed, 158));
            } else if (storeOpcode === "STX") {
              const forcedSTXIndexed = { 1: 150 };
              this.assembler.write1(getForcedOpcode(forcedSTXIndexed, 150));
            } else if (storeOpcode === "STY") {
              const forcedSTYIndexed = { 1: 148 };
              this.assembler.write1(getForcedOpcode(forcedSTYIndexed, 148));
            }
          } else {
            if (storeOpcode === "STX") {
              const forcedSTX = { 1: 134, 2: 142 };
              this.assembler.write1(getForcedOpcode(forcedSTX, 142));
            } else if (storeOpcode === "STY") {
              const forcedSTY = { 1: 132, 2: 140 };
              this.assembler.write1(getForcedOpcode(forcedSTY, 140));
            } else if (storeOpcode === "STZ") {
              const forcedSTZ = { 1: 100, 2: 156 };
              this.assembler.write1(getForcedOpcode(forcedSTZ, 156));
            }
          }
          address4 = this.assembler.operandResolver.getnum(operand);
          if (len === 1) {
            this.assembler.write1(address4);
          } else if (len === 2) {
            this.assembler.write2(address4);
          } else {
            throw new Error(`Forced length ${len} not supported for ${opcode}`);
          }
          return true;
        }
        if (loweredOperand.mode === "directPageIndexedX" && storeModeMap.directX && /^\$[\da-f]{2}$/i.test(operand)) {
          address4 = this.assembler.operandResolver.getnum(operand);
        } else if (loweredOperand.indexRegister === "y" && !loweredOperand.indirect && storeModeMap.directY) {
          address4 = this.assembler.operandResolver.getnum(operand);
        } else if (loweredOperand.mode === "absoluteIndexedX" && storeModeMap.absoluteX) {
          address4 = this.assembler.operandResolver.getnum(operand);
        }
        if (!isIndexed && (loweredOperand.mode === "absolute" || /^\$[\dA-Fa-f]{3,4}$/.test(operand))) {
          address4 = this.assembler.operandResolver.getnum(operand);
          this.assembler.write1(storeOpcodes[storeOpcode].absolute);
          this.assembler.write2(address4);
          return true;
        } else if (!isIndexed && /^\$[\dA-Fa-f]{2}$/.test(operand)) {
          address4 = this.assembler.operandResolver.getnum(operand);
          this.assembler.write1(storeOpcodes[storeOpcode].direct);
          this.assembler.write1(address4);
          return true;
        } else if (isIndexed) {
          if (storeOpcode === "STX") {
            address4 = this.assembler.operandResolver.getnum(operand);
            if (/^\$[\da-f]{3,4}$/i.test(operand)) {
              this.assembler.write1(storeOpcodes[storeOpcode].absolute);
              this.assembler.write2(address4);
            } else {
              this.assembler.write1(storeOpcodes[storeOpcode].directY);
              this.assembler.write1(address4);
            }
            return true;
          } else if (storeOpcode === "STY") {
            address4 = this.assembler.operandResolver.getnum(operand);
            if (/^\$[\da-f]{3,4}$/i.test(operand)) {
              this.assembler.write1(storeOpcodes[storeOpcode].absolute);
              this.assembler.write2(address4);
            } else {
              this.assembler.write1(storeOpcodes[storeOpcode].directX);
              this.assembler.write1(address4);
            }
            return true;
          } else if (storeOpcode === "STZ") {
            address4 = this.assembler.operandResolver.getnum(operand);
            if (/^\$[\da-f]{3,4}$/i.test(operand) && storeOpcodes[storeOpcode].absoluteX) {
              this.assembler.write1(storeOpcodes[storeOpcode].absoluteX);
              this.assembler.write2(address4);
            } else {
              this.assembler.write1(storeOpcodes[storeOpcode].directX);
              this.assembler.write1(address4);
            }
            return true;
          }
        }
        throw new Error(`Error: Invalid operand format for ${opcode}: ${operand}`);
      }
      /**
       * MVN/MVP. WDC and the hover catalog spell `dest, src`; we still write bytes
       * in source order (first operand, then second) - Asar's wire format. Locals
       * are named src/dest after that write order, not WDC's dest-then-src names.
       *
       * Hardware: opcode $54 MVN (ascending), $44 MVP (descending), then two bank bytes.
       *
       * @param {string} opcode The opcode to handle.
       * @param {string} operand The operand to handle.
       * @returns {boolean} True if the opcode was handled, false otherwise.
       */
      handleBlockMove(opcode, operand) {
        const params = operand.split(",").map((p) => p.trim());
        if (params.length !== 2) {
          throw new Error(`Error: ${opcode} requires two parameters (source, destination).`);
        }
        const srcBank = this.assembler.operandResolver.getnum(params[0]);
        const destBank = this.assembler.operandResolver.getnum(params[1]);
        this.assembler.write1(opcode === "MVP" ? 68 : 84);
        this.assembler.write1(srcBank);
        this.assembler.write1(destBank);
        return true;
      }
      /**
       * Encodes BIT / TSB / TRB. TSB/TRB have no immediate or `,x`.
       * Unforced `BIT #$0000` is 16-bit because the source spelling is 6 chars
       * (`#$` + 4 hex digits), not because the value needs a word.
       *
       * @param {string} opcode BIT, TSB, or TRB.
       * @param {string} operand Source operand.
       * @param {number} len Forced width when `explicitlen` is true.
       * @param {boolean} explicitlen True when `.b/.w` forced the width.
       * @returns {boolean} True if this family handled the opcode.
       */
      handleBitTestOperations(opcode, operand, len, explicitlen) {
        opcode = opcode.toUpperCase();
        const loweredOperand = lower65816Operand(this.assembler.operandResolver, operand);
        const rawOperand = operand;
        const normalizedOperand = isIndexedMemory(loweredOperand, "x") ? rawOperand.slice(0, -2).trim() : rawOperand;
        const forcedMaps = {
          BIT: {
            immediate: 137,
            direct: { 1: 36, 2: 44 },
            directX: { 1: 52, 2: 60 }
          },
          TSB: {
            direct: { 1: 4, 2: 12 }
          },
          TRB: {
            direct: { 1: 20, 2: 28 }
          }
        };
        const opcodes = {
          BIT: { immediate: 137, direct: 36, directX: 52, absolute: 44, absoluteX: 60 },
          TSB: { direct: 4, absolute: 12 },
          TRB: { direct: 20, absolute: 28 }
        };
        if (!(opcode in opcodes)) {
          return false;
        }
        const bitOpcode = opcode;
        const getForcedBitOpcode = (map, fallback) => {
          const forced = map[len];
          return forced ?? fallback;
        };
        let address4 = 0;
        let outLength = 0;
        if (operand.startsWith("#")) {
          address4 = this.assembler.operandResolver.getnum(operand.slice(1));
          if (explicitlen) {
            const immediate3 = forcedMaps[bitOpcode].immediate;
            if (immediate3 === void 0) {
              throw new Error(`Opcode ${opcode} does not support immediate mode.`);
            }
            this.assembler.write1(immediate3);
            outLength = len === 1 ? 1 : 2;
          } else {
            const immediate3 = opcodes[bitOpcode].immediate;
            if (immediate3 === void 0) {
              throw new Error(`Opcode ${opcode} does not support immediate mode.`);
            }
            this.assembler.write1(immediate3);
            outLength = operand.length === 6 ? 2 : 1;
          }
        } else {
          const isIndexed = isIndexedMemory(loweredOperand, "x");
          address4 = this.assembler.operandResolver.getnum(normalizedOperand);
          if (explicitlen) {
            if (isIndexed) {
              if (!forcedMaps[bitOpcode].directX) {
                throw new Error(`Opcode ${opcode} does not support indexed addressing in forced mode.`);
              }
              this.assembler.write1(
                getForcedBitOpcode(
                  forcedMaps[bitOpcode].directX,
                  forcedMaps[bitOpcode].directX[2] ?? forcedMaps[bitOpcode].directX[1] ?? 0
                )
              );
              outLength = len === 1 ? 1 : 2;
            } else {
              this.assembler.write1(
                getForcedBitOpcode(
                  forcedMaps[bitOpcode].direct,
                  forcedMaps[bitOpcode].direct[2] ?? forcedMaps[bitOpcode].direct[1] ?? 0
                )
              );
              outLength = len === 1 ? 1 : 2;
            }
          } else {
            if (isIndexed && loweredOperand.mode === "directPageIndexedX" && /^\$[\da-f]{1,2}$/i.test(normalizedOperand) && opcodes[bitOpcode].directX) {
              this.assembler.write1(opcodes[bitOpcode].directX);
              outLength = 1;
            } else if (/^\$[\da-f]{1,2}$/i.test(normalizedOperand)) {
              this.assembler.write1(opcodes[bitOpcode].direct);
              outLength = 1;
            } else if (/^\$[\da-f]{4}$/i.test(normalizedOperand)) {
              if (isIndexed && opcodes[bitOpcode].absoluteX) {
                this.assembler.write1(opcodes[bitOpcode].absoluteX);
              } else {
                this.assembler.write1(opcodes[bitOpcode].absolute);
              }
              outLength = 2;
            } else {
              throw new Error(`Error: Invalid operand format for ${opcode}: ${operand}`);
            }
          }
        }
        if (outLength === 1) {
          this.assembler.write1(address4);
        } else if (outLength === 2) {
          this.assembler.write2(address4);
        }
        return true;
      }
      /**
       * Encodes BRK / COP / PEA / PEI / REP / SEP / WDM. Width is fixed: PEA is
       * always 16-bit; the rest are 8-bit. `.b/.w` on REP/SEP only validates range.
       * @param {string} opcode Candidate mnemonic.
       * @param {number} num Already-evaluated operand value.
       * @param {number} len Inferred width (REP/SEP range check).
       * @returns {boolean} True if this family handled the opcode.
       */
      handleGenericOpcode(opcode, num, len) {
        const opcodeMap = {
          BRK: 0,
          COP: 2,
          PEA: 244,
          PEI: 212,
          REP: 194,
          SEP: 226,
          WDM: 66
        };
        if (opcode in opcodeMap) {
          const genericOpcode = opcode;
          const opcodeByte = opcodeMap[genericOpcode];
          if ((opcode === "REP" || opcode === "SEP") && (len !== 1 || num < 0 || num > 255)) {
            throw new Error("Error: invalid_number");
          }
          this.assembler.write1(opcodeByte);
          if (opcode === "PEA") {
            this.assembler.write2(num);
          } else {
            this.assembler.write1(num);
          }
          return true;
        }
        return false;
      }
      /**
       * Relative branches. `$xx` (1–2 hex digits) is a raw displacement, not a
       * target - same Asar rule as Super FX. `+`/`-` unnamed labels resolve from
       * the instruction *after* the branch (PC+2 or PC+3 for BRL).
       * @param {string} opcode The opcode to handle.
       * @param {string} operand The operand to handle.
       * @returns {boolean} True if the opcode was handled, false otherwise.
       */
      handleBranchInstructions(opcode, operand) {
        const branchOpcodes2 = {
          BPL: 16,
          BMI: 48,
          BVC: 80,
          BVS: 112,
          BCC: 144,
          BCS: 176,
          BNE: 208,
          BEQ: 240,
          BRA: 128,
          BRL: 130
        };
        if (!(opcode in branchOpcodes2)) {
          return false;
        }
        let targetAddress;
        let relativeAddress;
        const instructionSize = opcode === "BRL" ? 3 : 2;
        const branchReferenceAddress = this.assembler.currentTargetAddress + instructionSize;
        const rawShortOffset = opcode !== "BRL" && /^\$[\da-f]{1,2}$/i.test(operand.trim());
        if (rawShortOffset) {
          relativeAddress = this.assembler.operandResolver.getnum(operand);
          if (relativeAddress > 127) {
            relativeAddress -= 256;
          }
          targetAddress = branchReferenceAddress + relativeAddress;
        } else if (/^\++$/.test(operand)) {
          targetAddress = this.assembler.symbolScope.findNextLabel(operand, branchReferenceAddress);
          relativeAddress = targetAddress - branchReferenceAddress;
        } else if (/^-+$/.test(operand)) {
          targetAddress = this.assembler.symbolScope.findPreviousLabel(operand, branchReferenceAddress);
          relativeAddress = targetAddress - branchReferenceAddress;
        } else {
          targetAddress = this.assembler.operandResolver.getnum(operand);
          relativeAddress = targetAddress - branchReferenceAddress;
        }
        if (!this.assembler.enforceResolvedLabels) {
          this.assembler.write1(branchOpcodes2[opcode]);
          if (opcode === "BRL") {
            this.assembler.write2(0);
          } else {
            this.assembler.write1(0);
          }
          return true;
        }
        if (Number.isNaN(relativeAddress)) {
          throw this.assembler.diagnostics.error("Error: relativeAddress is NaN.");
        }
        if (opcode === "BRL") {
          if (relativeAddress < -32768 || relativeAddress > 32767) {
            throw this.assembler.diagnostics.error(
              `Error: BRL target out of range (${relativeAddress}).`
            );
          }
          this.assembler.write1(branchOpcodes2[opcode]);
          this.assembler.write2(relativeAddress);
          return true;
        } else {
          if (relativeAddress < -128 || relativeAddress > 127) {
            throw this.assembler.diagnostics.error(
              `Error: Branch target out of range (${relativeAddress}) for ${opcode} ${operand} at $${this.assembler.currentTargetAddress.toString(16)}.`
            );
          }
          let signedByte2 = (relativeAddress & 255) >>> 0;
          if (relativeAddress < 0) {
            signedByte2 |= 256;
          }
          this.assembler.write1(branchOpcodes2[opcode]);
          this.assembler.write1(signedByte2);
          return true;
        }
      }
      /**
       * Fallback TSB/TRB encoder (tests call this directly). Live encode uses
       * {@link handleBitTestOperations}. `$` + 4 hex digits (`operand.length === 5`)
       * is treated as absolute even if the value fits in a byte.
       *
       * @param {string} opcode TSB or TRB.
       * @param {string} operand Absolute or direct-page address.
       * @returns {boolean} True if TSB/TRB was encoded.
       */
      handleMemoryBitInstructions(opcode, operand) {
        const loweredOperand = lower65816Operand(this.assembler.operandResolver, operand);
        const memoryBitOpcodes = {
          TSB: { direct: 4, absolute: 12 },
          TRB: { direct: 20, absolute: 28 }
        };
        if (opcode in memoryBitOpcodes) {
          const address4 = this.assembler.operandResolver.getnum(operand);
          const opcodeByte = loweredOperand.mode === "absolute" || operand.length === 5 ? memoryBitOpcodes[opcode].absolute : memoryBitOpcodes[opcode].direct;
          this.assembler.write1(opcodeByte);
          if (opcodeByte === memoryBitOpcodes[opcode].absolute) {
            this.assembler.write2(address4);
          } else {
            this.assembler.write1(address4);
          }
          return true;
        }
        return false;
      }
      /**
       * Strips an explicit `.b/.w/.l/.d` suffix from a mnemonic.
       * @param {string} opcode Uppercased mnemonic, possibly with a length suffix.
       * @returns {{ name: string; explicitLength: number | undefined }} Bare mnemonic and length when present.
       */
      readMnemonicLength(opcode) {
        const dot = opcode.indexOf(".");
        if (dot === -1) {
          return { name: opcode, explicitLength: void 0 };
        }
        const suffix = opcode[dot + 1];
        if (suffix === void 0) {
          throw new Error(`Error: Invalid opcode length in '${opcode}'.`);
        }
        return {
          name: opcode.slice(0, dot),
          explicitLength: this.getlenfromchar(suffix)
        };
      }
      /**
       * `.b` = 1, `.w` = 2, `.l` = 3. `.d` (32-bit) is accepted but deprecated -
       * 65816 has no 32-bit immediate; callers treat it as width 4 for PEA-like repeats.
       * @param {string} c The opcode suffix to resolve the length of.
       * @returns {number} The operand length.
       * @throws {Error} If the opcode length is invalid.
       */
      getlenfromchar(c) {
        if (!c) {
          throw new Error("Error: Invalid opcode length.");
        }
        switch (c.toLowerCase()) {
          case "b":
            return 1;
          case "w":
            return 2;
          case "l":
            return 3;
          case "d":
            return 4;
          default:
            throw new Error("Error: Invalid opcode length.");
        }
      }
    };
  }
});

// packages/plugin-snes/src/architectures/spc700-decoder.ts
function formatSpc700Instruction(instruction) {
  if (instruction.architecture !== "snes.spc700") {
    throw new Error(`Cannot format architecture '${instruction.architecture}' as SPC700.`);
  }
  const operands = formatOperands(instruction);
  return operands === "" ? instruction.mnemonic : `${instruction.mnemonic} ${operands}`;
}
var readLittleEndian2, signedByte, register2, address2, immediate, bit, relative, bitAddress, fixedRegisters, operandsFor2, referencesFor2, buildInstruction2, Spc700Decoder, hex2, formatOperands;
var init_spc700_decoder = __esm({
  "packages/plugin-snes/src/architectures/spc700-decoder.ts"() {
    "use strict";
    init_spc700_spec();
    readLittleEndian2 = (bytes, offset, width) => {
      let value = 0;
      for (let index = 0; index < width; index++) value |= (bytes[offset + index] ?? 0) << index * 8;
      return value >>> 0;
    };
    signedByte = (value) => value & 128 ? value - 256 : value;
    register2 = (name) => ({ kind: "register", register: name });
    address2 = (value, width) => ({
      kind: "address",
      value,
      width
    });
    immediate = (value) => ({ kind: "immediate", value, width: 1 });
    bit = (value) => ({ kind: "bit", value, width: 1 });
    relative = (value, logicalAddress, size) => ({
      kind: "displacement",
      value: signedByte(value),
      width: 1,
      signed: true,
      targetAddress: logicalAddress + size + signedByte(value) & 65535
    });
    bitAddress = (bytes) => {
      const encoded = readLittleEndian2(bytes, 1, 2);
      return [address2(encoded & 8191, 2), bit(encoded >>> 13)];
    };
    fixedRegisters = {
      registerA: ["A"],
      registerX: ["X"],
      registerY: ["Y"],
      registerP: ["P"],
      registerYA: ["YA"],
      registerYAX: ["YA", "X"],
      registerXA: ["X", "A"],
      registerAX: ["A", "X"],
      registerXSP: ["X", "SP"],
      registerSPX: ["SP", "X"],
      registerAY: ["A", "Y"],
      registerYA2: ["Y", "A"],
      registerPostIncrementXA: ["X", "A"],
      registerAPostIncrementX: ["A", "X"],
      registerIndirectXA: ["X", "A"],
      registerAIndirectX: ["A", "X"],
      indirectXY: ["X", "Y"]
    };
    operandsFor2 = (specification2, bytes, logicalAddress) => {
      const byte = bytes[1] ?? 0;
      const word2 = readLittleEndian2(bytes, 1, 2);
      const fixed = fixedRegisters[specification2.mode];
      if (fixed) return fixed.map(register2);
      switch (specification2.mode) {
        case "implied":
          return [];
        case "tableCall":
          return [immediate(specification2.opcode[0] >>> 4)];
        case "directBit":
          return [address2(byte, 1), bit(Number(specification2.mnemonic.at(-1)))];
        case "directBitRelative":
          return [
            address2(byte, 1),
            bit(Number(specification2.mnemonic.at(-1))),
            relative(bytes[2] ?? 0, logicalAddress, bytes.length)
          ];
        case "accumulatorDirect":
        case "accumulatorDirectIndexedX":
        case "accumulatorDirectIndexedXIndirect":
        case "accumulatorDirectIndirectIndexedY":
          return [register2("A"), address2(byte, 1)];
        case "accumulatorAbsolute":
        case "accumulatorAbsoluteIndexedX":
        case "accumulatorAbsoluteIndexedY":
          return [register2("A"), address2(word2, 2)];
        case "accumulatorIndirectX":
          return [register2("A"), register2("X")];
        case "accumulatorImmediate":
          return [register2("A"), immediate(byte)];
        case "directDirect":
          return [address2(bytes[2] ?? 0, 1), address2(byte, 1)];
        case "carryMemoryBit":
        case "carryInvertedMemoryBit": {
          const [memory, bit2] = bitAddress(bytes);
          return [register2("C"), memory, bit2];
        }
        case "memoryBitCarry": {
          const [memory, bit2] = bitAddress(bytes);
          return [memory, bit2, register2("C")];
        }
        case "memoryBit":
          return bitAddress(bytes);
        case "direct":
        case "directIndexedX":
        case "directWord":
          return [address2(byte, 1)];
        case "absolute":
        case "absoluteIndexedXIndirect":
          return [address2(word2, 2)];
        case "relative":
          return [relative(byte, logicalAddress, bytes.length)];
        case "absoluteAccumulator":
          return [address2(word2, 2), register2("A")];
        case "directImmediate":
          return [address2(bytes[2] ?? 0, 1), immediate(byte)];
        case "registerXAbsolute":
          return [register2("X"), address2(word2, 2)];
        case "registerXDirect":
        case "registerXDirectIndexedY":
          return [register2("X"), address2(byte, 1)];
        case "registerYAbsolute":
          return [register2("Y"), address2(word2, 2)];
        case "registerYDirect":
        case "registerYDirectIndexedX":
          return [register2("Y"), address2(byte, 1)];
        case "registerXImmediate":
          return [register2("X"), immediate(byte)];
        case "registerYImmediate":
          return [register2("Y"), immediate(byte)];
        case "directRelative":
        case "directIndexedXRelative":
          return [address2(byte, 1), relative(bytes[2] ?? 0, logicalAddress, bytes.length)];
        case "registerYRelative":
          return [register2("Y"), relative(byte, logicalAddress, bytes.length)];
        case "registerYADirect":
          return [register2("YA"), address2(byte, 1)];
        case "directRegisterYA":
          return [address2(byte, 1), register2("YA")];
        case "upperPageCall":
          return [address2(65280 | byte, 2)];
        case "directRegisterA":
        case "directIndexedXRegisterA":
        case "directIndirectIndexedYRegisterA":
        case "directIndexedXIndirectRegisterA":
          return [address2(byte, 1), register2("A")];
        case "absoluteRegisterA":
        case "absoluteIndexedXRegisterA":
        case "absoluteIndexedYRegisterA":
          return [address2(word2, 2), register2("A")];
        case "indirectXRegisterA":
          return [register2("X"), register2("A")];
        case "directRegisterX":
        case "directIndexedYRegisterX":
          return [address2(byte, 1), register2("X")];
        case "absoluteRegisterX":
          return [address2(word2, 2), register2("X")];
        case "directRegisterY":
        case "directIndexedXRegisterY":
          return [address2(byte, 1), register2("Y")];
        case "absoluteRegisterY":
          return [address2(word2, 2), register2("Y")];
        default:
          throw new Error(`Unhandled SPC700 decode mode '${specification2.mode}'.`);
      }
    };
    referencesFor2 = (specification2, operands, state) => {
      const references = [];
      const branchIndex = operands.findIndex((operand) => operand.targetAddress !== void 0);
      if (branchIndex >= 0) {
        references.push({
          kind: "branch",
          operandIndex: branchIndex,
          address: operands[branchIndex].targetAddress
        });
      } else if (specification2.mnemonic === "TCALL") {
        const vector = 65502 - (specification2.opcode[0] >>> 4) * 2;
        references.push({ kind: "call", operandIndex: 0, indirect: true });
        references.push({ kind: "pointer", operandIndex: 0, address: vector, indirect: true });
      } else if (specification2.mnemonic === "PCALL") {
        references.push({ kind: "call", operandIndex: 0, address: operands[0]?.value });
      } else if (specification2.mnemonic === "CALL" || specification2.mnemonic === "JMP") {
        if (specification2.flow.indirect) {
          references.push({ kind: "jump", operandIndex: 0, indirect: true });
          references.push({
            kind: "pointer",
            operandIndex: 0,
            address: operands[0]?.value,
            indirect: true
          });
        } else {
          references.push({
            kind: specification2.mnemonic === "CALL" ? "call" : "jump",
            operandIndex: 0,
            address: operands[0]?.value
          });
        }
      }
      for (let index = 0; index < operands.length; index++) {
        const operand = operands[index];
        if (operand.kind !== "address" || operand.value === void 0) continue;
        if (references.some((reference) => reference.operandIndex === index)) continue;
        const isDirect = operand.width === 1;
        let resolved = operand.value;
        if (isDirect) {
          resolved = state.directPage === void 0 || state.directPage === "unknown" ? void 0 : state.directPage + operand.value & 65535;
        }
        references.push({
          kind: specification2.mode.includes("Indirect") ? "pointer" : "data",
          operandIndex: index,
          ...resolved === void 0 ? {} : { address: resolved },
          ...specification2.mode.includes("Indirect") ? { indirect: true } : {}
        });
      }
      return references;
    };
    buildInstruction2 = (specification2, bytes, context) => {
      const operands = operandsFor2(specification2, bytes, context.logicalAddress);
      return {
        architecture: "snes.spc700",
        specificationId: specification2.id,
        opcode: specification2.opcode[0],
        mnemonic: specification2.mnemonic,
        mode: specification2.mode,
        offset: context.offset,
        logicalAddress: context.logicalAddress & 65535,
        bytes,
        size: bytes.length,
        operands,
        references: referencesFor2(specification2, operands, context.state ?? {}),
        flow: specification2.flow,
        effects: specification2.effects
      };
    };
    Spc700Decoder = class {
      decode(context) {
        const availableBytes = Number.isInteger(context.offset) && context.offset >= 0 ? Math.max(0, context.source.length - context.offset) : 0;
        const opcode = context.source.readByte(context.offset);
        if (opcode === void 0) {
          return {
            kind: "error",
            code: "outOfBounds",
            message: `Cannot read an SPC700 opcode at offset ${context.offset}.`,
            offset: context.offset,
            requiredBytes: 1,
            availableBytes
          };
        }
        const specification2 = spc700Specifications[opcode];
        if (!specification2) {
          return {
            kind: "error",
            code: "invalidOpcode",
            message: `Unknown SPC700 opcode $${opcode.toString(16).padStart(2, "0")}.`,
            offset: context.offset
          };
        }
        const size = specification2.minimumSize;
        if (availableBytes < size) {
          return {
            kind: "error",
            code: "truncated",
            message: `Truncated ${specification2.mnemonic}: requires ${size} byte(s), ${availableBytes} available.`,
            offset: context.offset,
            requiredBytes: size,
            availableBytes
          };
        }
        const bytes = context.source.readBytes(context.offset, size);
        if (!bytes) throw new Error("Decoder byte source violated its bounds contract.");
        return { kind: "instruction", instruction: buildInstruction2(specification2, bytes, context) };
      }
    };
    hex2 = (value, width) => `$${(value >>> 0).toString(16).toUpperCase().padStart(width * 2, "0").slice(-width * 2)}`;
    formatOperands = (instruction) => {
      const values = instruction.operands.map((operand) => operand.value ?? 0);
      const target = instruction.operands.find(
        (operand) => operand.targetAddress !== void 0
      )?.targetAddress;
      const dp = () => hex2(values.find((_, index) => instruction.operands[index].kind === "address") ?? 0, 1);
      const abs = () => hex2(values.find((_, index) => instruction.operands[index].kind === "address") ?? 0, 2);
      const bit2 = () => values.find((_, index) => instruction.operands[index].kind === "bit") ?? 0;
      const relativeTarget = () => hex2(target ?? 0, 2);
      switch (instruction.mode) {
        case "implied":
          return "";
        case "tableCall":
          return String(values[0]);
        case "directBit":
          return dp();
        case "directBitRelative":
          return `${dp()},${relativeTarget()}`;
        case "accumulatorDirect":
          return `A,${dp()}`;
        case "accumulatorAbsolute":
          return `A,${abs()}`;
        case "accumulatorIndirectX":
        case "registerAIndirectX":
          return "A,(X)";
        case "accumulatorDirectIndexedXIndirect":
          return `A,(${dp()}+X)`;
        case "accumulatorImmediate":
          return `A,#${hex2(values[1], 1)}`;
        case "directDirect":
          return `${hex2(values[0], 1)},${hex2(values[1], 1)}`;
        case "carryMemoryBit":
          return `C,${abs()}.${bit2()}`;
        case "carryInvertedMemoryBit":
          return `C,/${abs()}.${bit2()}`;
        case "memoryBitCarry":
          return `${abs()}.${bit2()},C`;
        case "memoryBit":
          return `${abs()}.${bit2()}`;
        case "direct":
        case "directWord":
          return dp();
        case "directIndexedX":
          return `${dp()}+X`;
        case "absolute":
          return abs();
        case "relative":
          return relativeTarget();
        case "absoluteAccumulator":
          return `${abs()},A`;
        case "accumulatorDirectIndexedX":
          return `A,${dp()}+X`;
        case "accumulatorAbsoluteIndexedX":
          return `A,${abs()}+X`;
        case "accumulatorAbsoluteIndexedY":
          return `A,${abs()}+Y`;
        case "accumulatorDirectIndirectIndexedY":
          return `A,(${dp()})+Y`;
        case "directImmediate":
          return `${hex2(values[0], 1)},#${hex2(values[1], 1)}`;
        case "indirectXY":
          return "(X),(Y)";
        case "registerXAbsolute":
          return `X,${abs()}`;
        case "registerXDirect":
          return `X,${dp()}`;
        case "registerXDirectIndexedY":
          return `X,${dp()}+Y`;
        case "registerYAbsolute":
          return `Y,${abs()}`;
        case "registerYDirect":
          return `Y,${dp()}`;
        case "registerYDirectIndexedX":
          return `Y,${dp()}+X`;
        case "registerXImmediate":
          return `X,#${hex2(values[1], 1)}`;
        case "registerYImmediate":
          return `Y,#${hex2(values[1], 1)}`;
        case "absoluteIndexedXIndirect":
          return `(${abs()}+X)`;
        case "directRelative":
          return `${hex2(values[0], 1)},${relativeTarget()}`;
        case "directIndexedXRelative":
          return `${hex2(values[0], 1)}+X,${relativeTarget()}`;
        case "registerYRelative":
          return `Y,${relativeTarget()}`;
        case "registerYADirect":
          return `YA,${dp()}`;
        case "directRegisterYA":
          return `${dp()},YA`;
        case "upperPageCall":
          return hex2(values[0] & 255, 1);
        case "directRegisterA":
          return `${dp()},A`;
        case "absoluteRegisterA":
          return `${abs()},A`;
        case "indirectXRegisterA":
          return "(X),A";
        case "directIndexedXIndirectRegisterA":
          return `(${dp()}+X),A`;
        case "directIndexedXRegisterA":
          return `${dp()}+X,A`;
        case "absoluteIndexedXRegisterA":
          return `${abs()}+X,A`;
        case "absoluteIndexedYRegisterA":
          return `${abs()}+Y,A`;
        case "directIndirectIndexedYRegisterA":
          return `(${dp()})+Y,A`;
        case "directRegisterX":
          return `${dp()},X`;
        case "directIndexedYRegisterX":
          return `${dp()}+Y,X`;
        case "absoluteRegisterX":
          return `${abs()},X`;
        case "directRegisterY":
          return `${dp()},Y`;
        case "directIndexedXRegisterY":
          return `${dp()}+X,Y`;
        case "absoluteRegisterY":
          return `${abs()},Y`;
        default:
          return spc700Specifications[instruction.opcode]?.syntax ?? "";
      }
    };
  }
});

// packages/plugin-snes/src/architectures/split-operands.ts
var splitSingleOperand, splitCommaOperands, splitTopLevelCommaOperands;
var init_split_operands = __esm({
  "packages/plugin-snes/src/architectures/split-operands.ts"() {
    "use strict";
    splitSingleOperand = (text) => text ? [text] : [];
    splitCommaOperands = (text) => text ? text.split(",").map((operand) => operand.trim()) : [];
    splitTopLevelCommaOperands = (text) => {
      const operands = [];
      let level = 0;
      let current = "";
      for (const character of text) {
        if (character === "(") level++;
        if (character === ")") level--;
        if (character === "," && level === 0) {
          operands.push(current.trim());
          current = "";
        } else {
          current += character;
        }
      }
      if (current.trim()) operands.push(current.trim());
      return operands;
    };
  }
});

// packages/plugin-snes/src/architectures/spc700.ts
function getAddressSize(operand) {
  const match = operand.match(/^\$([\dA-Fa-f]+)/);
  if (!match) {
    return 2;
  }
  const hexpart = match[1];
  if (hexpart.length <= 2) {
    return 1;
  }
  return 2;
}
function spcOpcodePlusAddressSize(operand) {
  if (getAddressSize(operand) === 1) {
    return 2;
  }
  return 3;
}
function isAccumulator(op2, lowered) {
  if (lowered?.mode === "register" && lowered.registerName?.toUpperCase() === "A") {
    return true;
  }
  return op2.toUpperCase() === "A";
}
function isRegisterX(op2, lowered) {
  if (lowered?.mode === "register" && lowered.registerName?.toUpperCase() === "X") {
    return true;
  }
  return op2.toUpperCase() === "X";
}
function isRegisterY(op2, lowered) {
  if (lowered?.mode === "register" && lowered.registerName?.toUpperCase() === "Y") {
    return true;
  }
  return op2.toUpperCase() === "Y";
}
function isParenX(op2, lowered) {
  if (lowered?.mode === "registerIndirect" && lowered.registerName?.toUpperCase() === "X") {
    return true;
  }
  return op2.trim().toUpperCase() === "(X)";
}
function isParenY(op2, lowered) {
  if (lowered?.mode === "registerIndirect" && lowered.registerName?.toUpperCase() === "Y") {
    return true;
  }
  return op2.trim().toUpperCase() === "(Y)";
}
function parseBitBranchOpcode(opcode) {
  const match = opcode.toUpperCase().match(/^(BBS|BBC)([0-7])?$/);
  if (!match) {
    return void 0;
  }
  if (match[2] === void 0) {
    return { family: match[1] };
  }
  return { family: match[1], mnemonicBit: Number(match[2]) };
}
function parseNumberedBitOpcode(opcode) {
  const match = opcode.toUpperCase().match(NUMBERED_BIT_OPCODE);
  if (!match) {
    return void 0;
  }
  return {
    family: match[1],
    mnemonicBit: Number(match[2])
  };
}
function parseSpcMemBitOperand(raw) {
  let rest = raw.trim();
  if (rest === "") {
    return void 0;
  }
  let invert = false;
  if (rest.startsWith("!") || rest.startsWith("/")) {
    invert = true;
    rest = rest.slice(1).trim();
  }
  const dotted = rest.match(/^(.*)\.([0-7])$/);
  if (dotted) {
    return {
      addressText: dotted[1].trim(),
      bit: Number(dotted[2]),
      invert
    };
  }
  return { addressText: rest, invert };
}
function parseSpcBitNumber(raw) {
  const trimmed = raw.trim().replace(/^#/, "");
  if (!/^[0-7]$/.test(trimmed)) {
    return void 0;
  }
  return Number(trimmed);
}
var lowerSpc700Operand, hasOwn, IMPLIED_SPC_OPCODES, SHIFT_INC_DEC_OPCODES, MOV_ONE_BYTE_PAIRS, memOpTables, branchOpcodes, bitSetClearOpcodes, wordOpsWithYaLeft, wordOpsWithYaRight, singleWordOps, NUMBERED_BIT_OPCODE, ArchSPC700;
var init_spc700 = __esm({
  "packages/plugin-snes/src/architectures/spc700.ts"() {
    "use strict";
    init_src();
    init_instruction_catalog2();
    init_operand_classifiers();
    init_split_operands();
    lowerSpc700Operand = (resolver, operand) => {
      const lowered = resolver.lowerOperand(operand);
      return lowered.mode !== "unknown" ? lowered : classifyGenericOperand(lowered);
    };
    hasOwn = (obj, key) => Object.hasOwn(obj, key);
    IMPLIED_SPC_OPCODES = {
      NOP: true,
      BRK: true,
      RET: true,
      RETI: true,
      CLRP: true,
      SETP: true,
      CLRC: true,
      SETC: true,
      EI: true,
      DI: true,
      CLRV: true,
      NOTC: true,
      SLEEP: true,
      STOP: true,
      XCN: true
    };
    SHIFT_INC_DEC_OPCODES = {
      ASL: true,
      LSR: true,
      ROL: true,
      ROR: true,
      INC: true,
      DEC: true
    };
    MOV_ONE_BYTE_PAIRS = /* @__PURE__ */ new Set([
      "X,A",
      "A,X",
      "X,SP",
      "SP,X",
      "A,Y",
      "Y,A",
      "(X+),A",
      "A,(X+)",
      "(X),A",
      "A,(X)"
    ]);
    memOpTables = {
      ADC: {
        a_indirectX: 134,
        a_indirectDpX: 135,
        a_imm: 136,
        a_absX: 149,
        a_dpX: 148,
        a_absY: 150,
        a_indirectDpY: 151,
        a_abs: 133,
        a_dp: 132,
        xy_indirect: 153,
        dp_imm: 152,
        dp_dp: 137
      },
      AND: {
        a_indirectX: 38,
        a_indirectDpX: 39,
        a_imm: 40,
        a_absX: 53,
        a_dpX: 52,
        a_absY: 54,
        a_indirectDpY: 55,
        a_abs: 37,
        a_dp: 36,
        xy_indirect: 57,
        dp_imm: 56,
        dp_dp: 41
      },
      EOR: {
        a_indirectX: 70,
        a_indirectDpX: 71,
        a_imm: 72,
        a_absX: 85,
        a_dpX: 84,
        a_absY: 86,
        a_indirectDpY: 87,
        a_abs: 69,
        a_dp: 68,
        xy_indirect: 89,
        dp_imm: 88,
        dp_dp: 73
      },
      OR: {
        a_indirectX: 6,
        a_indirectDpX: 7,
        a_imm: 8,
        a_absX: 21,
        a_dpX: 20,
        a_absY: 22,
        a_indirectDpY: 23,
        a_abs: 5,
        a_dp: 4,
        xy_indirect: 25,
        dp_imm: 24,
        dp_dp: 9
      },
      SBC: {
        a_indirectX: 166,
        a_indirectDpX: 167,
        a_imm: 168,
        a_absX: 181,
        a_dpX: 180,
        a_absY: 182,
        a_indirectDpY: 183,
        a_abs: 165,
        a_dp: 164,
        xy_indirect: 185,
        dp_imm: 184,
        dp_dp: 169
      },
      CMP: {
        // The test file merges both "CMP A" forms and "CMP X/Y" forms. We'll handle the "A," forms here:
        a_indirectX: 102,
        a_indirectDpX: 103,
        a_imm: 104,
        a_absX: 117,
        a_dpX: 116,
        a_absY: 118,
        a_indirectDpY: 119,
        a_abs: 101,
        a_dp: 100,
        xy_indirect: 121,
        dp_imm: 120,
        dp_dp: 105
      }
    };
    branchOpcodes = {
      BPL: 16,
      BMI: 48,
      BVC: 80,
      BVS: 112,
      BCC: 144,
      BCS: 176,
      BNE: 208,
      BEQ: 240,
      BRA: 47
    };
    bitSetClearOpcodes = {
      SET0: 2,
      SET1: 34,
      SET2: 66,
      SET3: 98,
      SET4: 130,
      SET5: 162,
      SET6: 194,
      SET7: 226,
      CLR0: 18,
      CLR1: 50,
      CLR2: 82,
      CLR3: 114,
      CLR4: 146,
      CLR5: 178,
      CLR6: 210,
      CLR7: 242
    };
    wordOpsWithYaLeft = {
      CMPW: 90,
      ADDW: 122,
      SUBW: 154,
      MOVW: 186
    };
    wordOpsWithYaRight = {
      MOVW: 218
    };
    singleWordOps = {
      DECW: 26,
      INCW: 58
    };
    NUMBERED_BIT_OPCODE = /^(NOT|OR|AND|EOR|MOV)([0-7])$/;
    ArchSPC700 = class {
      assembler;
      constructor(context) {
        this.assembler = createEncoderRuntime(context);
      }
      /**
       * Returns the static SPC700 instruction catalog for editor tooling.
       * @returns {InstructionDescriptor[]} The instruction descriptors.
       */
      getInstructionCatalog() {
        return spc700Catalog;
      }
      /**
       * Size of a lowered instruction. Must match encode so layout stays in sync.
       * @param {LoweredInstruction} instruction The instruction.
       * @returns {number} Encoded size in bytes.
       */
      estimateInstruction(instruction) {
        const loweredOperands = instruction.loweredOperands ?? [];
        return this.estimateResolvedInstruction(
          instruction.mnemonic,
          instruction.operandText,
          instruction.loweredOperand,
          loweredOperands
        );
      }
      /**
       * Encodes a lowered instruction.
       * @param {LoweredInstruction} instruction The instruction.
       * @returns {boolean} True if encoded.
       */
      encodeInstruction(instruction) {
        const loweredOperands = instruction.loweredOperands ?? [];
        return this.encodeResolvedInstruction(
          instruction.mnemonic,
          instruction.operands,
          instruction.loweredOperand,
          loweredOperands
        );
      }
      /**
       * Estimates size from tokenized words.
       * @param {string[]} words The words.
       * @returns {number} Encoded size in bytes.
       */
      estimateSize(words) {
        if (words.length === 0) {
          return 0;
        }
        const rawOperand = words.slice(1).join(" ").trim();
        const parsedOperands = rawOperand ? splitTopLevelCommaOperands(rawOperand) : [];
        const loweredOperand = lowerSpc700Operand(this.assembler.operandResolver, rawOperand);
        const loweredOperands = parsedOperands.map(
          (operand) => lowerSpc700Operand(this.assembler.operandResolver, operand)
        );
        return this.estimateResolvedInstruction(words[0], rawOperand, loweredOperand, loweredOperands);
      }
      /**
       * Size for a resolved mnemonic. `.b/.w` suffixes are stripped (SPC700 width
       * is spelling-based, not 65816 `.l`). Unknown ops return 1 so layout does
       * not stall; encode will still reject them.
       *
       * @param {string} mnemonic The mnemonic.
       * @param {string} operandText The operand text.
       * @param {LoweredOperand} [loweredOperand] Combined lowered operand.
       * @param {LoweredOperand[]} [loweredOperands] Per-operand lowered metadata.
       * @returns {number} Encoded size in bytes.
       */
      estimateResolvedInstruction(mnemonic, operandText, loweredOperand, loweredOperands = []) {
        let opcode = mnemonic.toUpperCase().trim();
        const dotIndex = opcode.indexOf(".");
        if (dotIndex !== -1) {
          opcode = opcode.substring(0, dotIndex);
        }
        let operands = [];
        if (loweredOperands.length > 0) {
          operands = loweredOperands.map((operand) => operand.expanded);
        } else if (operandText) {
          operands = splitTopLevelCommaOperands(operandText);
        }
        operands = operands.filter((value) => value !== "");
        const left = operands[0] ?? "";
        const right = operands[1] ?? "";
        const leftLowered = loweredOperands[0] ?? loweredOperand;
        const rightLowered = loweredOperands[1];
        if (operands.length === 0 && hasOwn(IMPLIED_SPC_OPCODES, opcode)) {
          return 1;
        }
        if (opcode === "TCALL" || opcode === "PUSH" || opcode === "POP") {
          return 1;
        }
        if ((opcode === "DAA" || opcode === "DAS") && left.toUpperCase() === "A") {
          return 1;
        }
        if (opcode === "MUL" || opcode === "DIV") {
          return 1;
        }
        if (hasOwn(branchOpcodes, opcode)) {
          return 2;
        }
        if (hasOwn(bitSetClearOpcodes, opcode)) {
          return 2;
        }
        if (parseBitBranchOpcode(opcode)) {
          return 3;
        }
        if (opcode === "CALL" || opcode === "JMP") {
          return 3;
        }
        if (opcode === "PCALL") {
          return 2;
        }
        if (opcode === "DBNZ") {
          if (isRegisterY(left, leftLowered)) {
            return 2;
          }
          return 3;
        }
        if (opcode === "CBNE") {
          return 3;
        }
        if (opcode === "TSET" || opcode === "TCLR") {
          return 3;
        }
        if (parseNumberedBitOpcode(opcode)) {
          return 3;
        }
        if (hasOwn(singleWordOps, opcode)) {
          return 2;
        }
        if (hasOwn(wordOpsWithYaLeft, opcode) || hasOwn(wordOpsWithYaRight, opcode)) {
          return 2;
        }
        if (hasOwn(SHIFT_INC_DEC_OPCODES, opcode)) {
          const dest = left.toUpperCase();
          if (dest === "A" || dest === "X" || dest === "Y") {
            return 1;
          }
          const plusX = dest.endsWith("+X");
          const base = plusX ? left.replace(/\+x$/i, "").trim() : left;
          return spcOpcodePlusAddressSize(base);
        }
        if (opcode === "MOV") {
          return this.estimateMovSize(left, right, leftLowered, rightLowered);
        }
        if (hasOwn(memOpTables, opcode)) {
          return this.estimateMemoryOpSize(left, right, leftLowered, rightLowered);
        }
        return 1;
      }
      /**
       * Encoded size for MOV. Must match {@link handleMovInstruction} / XY immediate forms.
       * @param {string} left Left operand.
       * @param {string} right Right operand.
       * @param {LoweredOperand} [leftLowered] Lowered left operand.
       * @param {LoweredOperand} [rightLowered] Lowered right operand.
       * @returns {number} Encoded size in bytes.
       */
      estimateMovSize(left, right, leftLowered, rightLowered) {
        const registerPair = `${left.trim()},${right.trim()}`.toUpperCase().replace(/\s+/g, "");
        if (MOV_ONE_BYTE_PAIRS.has(registerPair)) {
          return 1;
        }
        const rightImmediate = rightLowered?.immediate ?? right.trim().startsWith("#");
        if (isRegisterX(left, leftLowered) && rightImmediate) {
          return 2;
        }
        if (isRegisterY(left, leftLowered) && rightImmediate) {
          return 2;
        }
        if (isAccumulator(left, leftLowered) && rightImmediate) {
          return 2;
        }
        if (this.isDpOrAbs(left) && rightImmediate) {
          return 3;
        }
        if (this.isDpOrAbs(left) && this.isDpOrAbs(right)) {
          return 3;
        }
        if (/^\(\$[\da-f]+\)$/i.test(left) && /^\(\$[\da-f]+\)$/i.test(right)) {
          return 3;
        }
        if (/\(\s*\$/.test(left) || /\(\s*\$/.test(right)) {
          return 2;
        }
        const addressOperand2 = /\$/.test(left) ? left : right;
        if (/\$/.test(addressOperand2)) {
          const plusIndex = addressOperand2.search(/\+[xy]$/i);
          let base = addressOperand2;
          if (plusIndex >= 0) {
            base = addressOperand2.slice(0, plusIndex);
          }
          return spcOpcodePlusAddressSize(base);
        }
        return 2;
      }
      /**
       * Encoded size for ADC/AND/EOR/OR/SBC/CMP. Must match {@link handleMemoryInstruction}.
       * @param {string} left Left operand.
       * @param {string} right Right operand.
       * @param {LoweredOperand} [leftLowered] Lowered left operand.
       * @param {LoweredOperand} [rightLowered] Lowered right operand.
       * @returns {number} Encoded size in bytes.
       */
      estimateMemoryOpSize(left, right, leftLowered, rightLowered) {
        if (isRegisterX(left, leftLowered) || isRegisterY(left, leftLowered)) {
          if (rightLowered?.immediate ?? right.trim().startsWith("#")) {
            return 2;
          }
          return spcOpcodePlusAddressSize(right);
        }
        if (isParenX(left, leftLowered) && isParenY(right, rightLowered)) {
          return 1;
        }
        if (this.isDpOrAbs(left) && (rightLowered?.immediate ?? right.trim().startsWith("#"))) {
          return 3;
        }
        if (this.isDpOrAbs(left) && this.isDpOrAbs(right)) {
          return 3;
        }
        if (/^\(\$[\da-f]+\)$/i.test(left) && /^\(\$[\da-f]+\)$/i.test(right)) {
          return 3;
        }
        if (isAccumulator(left, leftLowered)) {
          const mode3 = this.classifySpc700Addressing(right, rightLowered).mode;
          if (mode3 === "indirectX") {
            return 1;
          }
          if (mode3 === "abs" || mode3 === "absX" || mode3 === "absY") {
            return 3;
          }
          return 2;
        }
        return 2;
      }
      /**
       * Processes an SPC700 assembly instruction.
       * @param {string[]} words The tokenized instruction.
       * @returns {boolean} True if the instruction was handled, false otherwise.
       */
      encode(words) {
        if (words.length === 0) {
          return false;
        }
        const opcode = words[0];
        const rawOperand = words.slice(1).join(" ").trim();
        const parsedOperands = rawOperand ? splitTopLevelCommaOperands(rawOperand) : [];
        const loweredOperand = lowerSpc700Operand(this.assembler.operandResolver, rawOperand);
        const loweredOperands = parsedOperands.map(
          (operand) => lowerSpc700Operand(this.assembler.operandResolver, operand)
        );
        return this.encodeResolvedInstruction(opcode, parsedOperands, loweredOperand, loweredOperands);
      }
      /**
       * Encodes a resolved mnemonic. `.b/.w/.l` is stripped (SPC700 width is
       * spelling-based). Dispatch is operand-count: 0/implied → 1 → 2 → numbered
       * bit ops with a third bit argument (`AND1 C,$addr,2`).
       *
       * @param {string} mnemonic Raw mnemonic, possibly with a length suffix.
       * @param {string[]} operands Split operands (already expanded when possible).
       * @param {LoweredOperand} [_loweredOperand] Combined rest-of-line operand (unused after lowering).
       * @param {LoweredOperand[]} [loweredOperands] Per-operand lowered metadata.
       * @returns {boolean} True if encoded.
       */
      encodeResolvedInstruction(mnemonic, operands, _loweredOperand, loweredOperands = []) {
        let opcode = mnemonic;
        const normalizedOperands = operands.map((operandText, index) => loweredOperands[index]?.expanded ?? operandText).filter((value) => value !== "");
        let forcedLen = null;
        let explicitlen = false;
        const dotIndex = opcode.indexOf(".");
        if (dotIndex !== -1) {
          forcedLen = this.getlenfromchar(opcode[dotIndex + 1]);
          explicitlen = true;
          opcode = opcode.substring(0, dotIndex);
        }
        opcode = opcode.toUpperCase().trim();
        if (this.handleSingleNoOperand(opcode)) {
          return true;
        }
        const firstLowered = loweredOperands[0];
        const secondLowered = loweredOperands[1];
        if (normalizedOperands.length === 1) {
          return this.handleOneOperand(
            opcode,
            normalizedOperands[0],
            forcedLen,
            explicitlen,
            firstLowered
          );
        }
        if (normalizedOperands.length === 2) {
          return this.handleTwoOperands(
            opcode,
            normalizedOperands[0],
            normalizedOperands[1],
            forcedLen,
            explicitlen,
            firstLowered,
            secondLowered
          );
        }
        if (normalizedOperands.length === 3 && parseNumberedBitOpcode(opcode)) {
          return this.handleBitManipulation(
            opcode,
            normalizedOperands[0],
            normalizedOperands[1],
            normalizedOperands[2]
          );
        }
        return false;
      }
      /**
       * Implied single-byte ops (NOP, BRK, RET, flag ops, SLEEP, STOP, XCN).
       * Returns false when the mnemonic is not in this set so other handlers can run.
       *
       * @param {string} opcode Uppercased mnemonic.
       * @returns {boolean} True if a 1-byte opcode was written.
       */
      handleSingleNoOperand(opcode) {
        const singleByte = {
          NOP: 0,
          BRK: 15,
          RET: 111,
          RETI: 127,
          CLRP: 32,
          SETP: 64,
          CLRC: 96,
          SETC: 128,
          EI: 160,
          DI: 192,
          CLRV: 224,
          NOTC: 237,
          SLEEP: 239,
          STOP: 255,
          XCN: 159
        };
        if (hasOwn(singleByte, opcode)) {
          this.assembler.write1(singleByte[opcode]);
          return true;
        }
        return false;
      }
      /**
       * One-operand dispatch: shift/inc/dec, SET/CLR bits, relative branches,
       * TCALL n (decimal 0–15, not `$n`), PUSH/POP, CALL/JMP/PCALL, then MUL/DIV/DAA.
       *
       * @param {string} opcode Uppercased mnemonic.
       * @param {string} operand Single operand text.
       * @param {number | null} forcedLen `.b`=1 / `.w`=2 when a suffix was present.
       * @param {boolean} explicitlen True when `forcedLen` came from a suffix.
       * @param {LoweredOperand} [loweredOperand] Lowered metadata for `operand`.
       * @returns {boolean} True if encoded.
       */
      handleOneOperand(opcode, operand, forcedLen, explicitlen, loweredOperand) {
        if (this.handleShiftIncDec(opcode, operand, forcedLen, explicitlen)) {
          return true;
        }
        if (hasOwn(bitSetClearOpcodes, opcode)) {
          if (this.handleBitSetClear(opcode, operand)) {
            return true;
          }
        }
        if (hasOwn(branchOpcodes, opcode)) {
          if (this.handleBranch(opcode, operand)) {
            return true;
          }
        }
        if (opcode === "TCALL") {
          const num = parseInt(operand.trim(), 10);
          if (isNaN(num) || num < 0 || num > 15) {
            return false;
          }
          this.assembler.write1((num & 15) << 4 | 1);
          return true;
        }
        if (this.handlePushPop(opcode, operand, loweredOperand)) {
          return true;
        }
        if (this.handleCallJump(opcode, operand, loweredOperand)) {
          return true;
        }
        if (this.handleSingleOperandSpecial(opcode, operand)) {
          return true;
        }
        return false;
      }
      /**
       * Two-operand dispatch: BBS/BBC, DBNZ/CBNE, CMP/MOV X|Y, ALU memory forms,
       * TSET/TCLR, MOV, mem.bit carry ops, then YA word ops.
       *
       * @param {string} opcode Uppercased mnemonic.
       * @param {string} left Left operand.
       * @param {string} right Right operand.
       * @param {number | null} forcedLen `.b`=1 / `.w`=2 when a suffix was present.
       * @param {boolean} explicitlen True when `forcedLen` came from a suffix.
       * @param {LoweredOperand} [leftLowered] Lowered left operand.
       * @param {LoweredOperand} [rightLowered] Lowered right operand.
       * @returns {boolean} True if encoded.
       */
      handleTwoOperands(opcode, left, right, forcedLen, explicitlen, leftLowered, rightLowered) {
        if (parseBitBranchOpcode(opcode)) {
          if (this.handleTwoOperandsBitBranch(opcode, left, right)) {
            return true;
          }
        }
        if (opcode === "DBNZ" || opcode === "CBNE") {
          if (this.handleDbnzCbne(opcode, left, right, leftLowered, rightLowered)) {
            return true;
          }
        }
        if (this.handleCmpXyOrMovXy(
          opcode,
          [left, right].join(","),
          forcedLen,
          explicitlen,
          leftLowered,
          rightLowered
        )) {
          return true;
        }
        if (this.handleMemoryInstruction(
          opcode,
          left,
          right,
          forcedLen,
          explicitlen,
          leftLowered,
          rightLowered
        )) {
          return true;
        }
        if (this.handleTsetTclr(opcode, left, right, rightLowered)) {
          return true;
        }
        if (opcode === "MOV") {
          return this.handleMovInstruction(left, right, forcedLen, explicitlen);
        }
        if (this.handleBitManipulation(opcode, left, right)) {
          return true;
        }
        if (this.handleSingleOperandSpecial(opcode, [left, right].join(","))) {
          return true;
        }
        if (this.handleWordOpsTwoOperands(opcode, left, right)) {
          return true;
        }
        return false;
      }
      /**
       * YA word ops: CMPW/ADDW/SUBW/MOVW YA,$dp and MOVW $dp,YA. DP only -
       * `$1234` is not a documented form here (Asar tests are 8-bit).
       *
       * @param {string} opcode Word mnemonic.
       * @param {string} left Left operand (`YA` or `$dp`).
       * @param {string} right Right operand (`$dp` or `YA`).
       * @returns {boolean} True if encoded.
       */
      handleWordOpsTwoOperands(opcode, left, right) {
        const upOp = opcode.toUpperCase();
        const leftUp = left.trim().toUpperCase();
        const rightUp = right.trim().toUpperCase();
        if (leftUp === "YA" && /^\$[\da-f]{1,2}$/i.test(right.trim()) && hasOwn(wordOpsWithYaLeft, upOp)) {
          const dpVal = parseInt(right.replace(/\$/g, ""), 16) & 255;
          this.assembler.write1(wordOpsWithYaLeft[upOp]);
          this.assembler.write1(dpVal);
          return true;
        }
        if (rightUp === "YA" && /^\$[\da-f]{1,2}$/i.test(left.trim()) && hasOwn(wordOpsWithYaRight, upOp)) {
          const dpVal = parseInt(left.replace(/\$/g, ""), 16) & 255;
          this.assembler.write1(wordOpsWithYaRight[upOp]);
          this.assembler.write1(dpVal);
          return true;
        }
        return false;
      }
      /**
       * Encodes ADC/AND/EOR/OR/SBC/CMP from {@link memOpTables}.
       * `A,<mode>` uses {@link classifySpc700Addressing}. `(X),(Y)` is 1 byte.
       * `dp,#imm` and `dp,dp` write the *right* operand first (hardware order),
       * opposite of source order.
       *
       * @param {string} opcode ALU mnemonic.
       * @param {string} left Left operand.
       * @param {string} right Right operand.
       * @param {number | null} forcedLen `.b`/`.w` override for A,dp vs A,abs.
       * @param {boolean} explicitlen True when a suffix forced the width.
       * @param {LoweredOperand} [leftLowered] Lowered left operand.
       * @param {LoweredOperand} [rightLowered] Lowered right operand.
       * @returns {boolean} True if encoded.
       */
      handleMemoryInstruction(opcode, left, right, forcedLen, explicitlen, leftLowered, rightLowered) {
        const opName = opcode.toUpperCase();
        if (!hasOwn(memOpTables, opName)) {
          return false;
        }
        const table = memOpTables[opName];
        if (isAccumulator(left, leftLowered)) {
          const modeInfo = this.classifySpc700Addressing(right, rightLowered);
          const addr = modeInfo.val;
          const mode3 = modeInfo.mode;
          if (explicitlen && forcedLen !== null) {
            if (mode3 === "dp" || mode3 === "abs") {
              this.assembler.write1(forcedLen === 1 ? table.a_dp : table.a_abs);
              if (forcedLen === 1) {
                this.assembler.write1(addr & 255);
              } else {
                this.assembler.write2(addr);
              }
              return true;
            }
            if (mode3 === "dpX" || mode3 === "absX") {
              this.assembler.write1(forcedLen === 1 ? table.a_dpX : table.a_absX);
              if (forcedLen === 1) {
                this.assembler.write1(addr & 255);
              } else {
                this.assembler.write2(addr);
              }
              return true;
            }
          }
          switch (mode3) {
            case "indirectX":
              this.assembler.write1(table.a_indirectX);
              return true;
            case "indirectDpX":
              this.assembler.write1(table.a_indirectDpX);
              this.assembler.write1(addr);
              return true;
            case "imm":
              this.assembler.write1(table.a_imm);
              this.assembler.write1(addr);
              return true;
            case "absX":
              this.assembler.write1(table.a_absX);
              this.assembler.write2(addr);
              return true;
            case "dpX":
              this.assembler.write1(table.a_dpX);
              this.assembler.write1(addr);
              return true;
            case "absY":
              this.assembler.write1(table.a_absY);
              this.assembler.write2(addr);
              return true;
            case "indirectDpY":
              this.assembler.write1(table.a_indirectDpY);
              this.assembler.write1(addr);
              return true;
            case "abs":
              this.assembler.write1(table.a_abs);
              this.assembler.write2(addr);
              return true;
            case "dp":
              this.assembler.write1(table.a_dp);
              this.assembler.write1(addr);
              return true;
          }
        }
        if (isParenX(left, leftLowered) && isParenY(right, rightLowered)) {
          this.assembler.write1(table.xy_indirect);
          return true;
        }
        if (this.isDpOrAbs(left) && (rightLowered?.immediate ?? right.startsWith("#"))) {
          this.assembler.write1(table.dp_imm);
          const immSource = rightLowered?.baseExpression ?? right;
          const immVal = this.assembler.operandResolver.getnum(immSource) & 255;
          this.assembler.write1(immVal);
          const leftVal = parseInt(left.replace(/\$/g, ""), 16) & 255;
          this.assembler.write1(leftVal);
          return true;
        }
        if (/^\(\$[\da-f]+\)$/i.test(left) && /^\(\$[\da-f]+\)$/i.test(right)) {
          this.assembler.write1(table.dp_dp);
          const rightVal = parseInt(right.replace(/[^\da-f]/gi, ""), 16) & 255;
          this.assembler.write1(rightVal);
          const leftVal = parseInt(left.replace(/[^\da-f]/gi, ""), 16) & 255;
          this.assembler.write1(leftVal);
          return true;
        }
        if (this.isDpOrAbs(left) && this.isDpOrAbs(right)) {
          this.assembler.write1(table.dp_dp);
          const rightVal = parseInt(right.replace(/\$/g, ""), 16) & 255;
          this.assembler.write1(rightVal);
          const leftVal = parseInt(left.replace(/\$/g, ""), 16) & 255;
          this.assembler.write1(leftVal);
          return true;
        }
        return false;
      }
      /**
       * Writes a dp (1 byte) or abs (2 byte) address.
       * Width follows the source spelling via `length`, not whether the value fits in 8 bits.
       * `$0030` is absolute even though 0x30 is a direct-page number.
       * @param {number} value Address to write.
       * @param {number} length 1 for direct page, 2 for absolute.
       * @returns {void}
       */
      writeDpOrAbs(value, length) {
        this.assembler.write1(value & 255);
        if (length <= 1) {
          return;
        }
        this.assembler.write1(value >> 8 & 255);
      }
      /**
       * Maps an `A,<addr>` operand onto {@link memOpTables} keys.
       * Labels keep original case so `spc_07C2+Y` still looks up. `(X)` is
       * indirectX (no extra byte); `($dp+X)` is indirectDpX.
       *
       * @param {string} operand Right-hand operand of an A-destination ALU op.
       * @param {LoweredOperand} [loweredOperand] Lowered metadata when available.
       * @returns {{ mode: string; val: number }} Addressing mode and numeric payload.
       */
      classifySpc700Addressing(operand, loweredOperand) {
        const resolveValue = (value) => {
          try {
            return this.assembler.operandResolver.getnum(value) & 65535;
          } catch {
            return parseInt(value.replace(/\$/g, ""), 16) & 65535;
          }
        };
        if (loweredOperand?.mode === "registerIndirect" && loweredOperand.registerName?.toUpperCase() === "X") {
          return { mode: "indirectX", val: 0 };
        }
        if (loweredOperand?.mode === "directPageIndexedXIndirect" && loweredOperand.baseExpression) {
          return { mode: "indirectDpX", val: resolveValue(loweredOperand.baseExpression) & 255 };
        }
        if (loweredOperand?.immediate) {
          return {
            mode: "imm",
            val: resolveValue(loweredOperand.baseExpression ?? loweredOperand.expanded) & 255
          };
        }
        if (loweredOperand?.mode === "directPageIndirectIndexedY" && loweredOperand.baseExpression) {
          return { mode: "indirectDpY", val: resolveValue(loweredOperand.baseExpression) & 255 };
        }
        const trimmedRaw = operand.trim();
        const trimmed = trimmedRaw.toUpperCase();
        if (trimmed === "(X)") {
          return { mode: "indirectX", val: 0 };
        }
        if (trimmed.startsWith("(") && trimmed.endsWith(")") && trimmed.includes("+X")) {
          const inside = trimmedRaw.slice(1, -1);
          const dpStr = inside.split("+")[0].trim();
          const val = parseInt(dpStr.replace(/\$/g, ""), 16);
          return { mode: "indirectDpX", val };
        }
        if (trimmed.startsWith("#")) {
          const val = parseInt(trimmed.replace(/[^\dA-F]/g, ""), 16) & 255;
          return { mode: "imm", val };
        }
        if (trimmed.endsWith("+X")) {
          const baseStr = trimmedRaw.replace(/\+x$/i, "").trim();
          const val = resolveValue(baseStr);
          const size = getAddressSize(baseStr);
          if (size === 1) {
            return { mode: "dpX", val };
          } else {
            return { mode: "absX", val };
          }
        }
        if (trimmed.endsWith("+Y")) {
          const baseStr = trimmedRaw.replace(/\+y$/i, "").trim();
          if (baseStr.startsWith("(") && baseStr.endsWith(")")) {
            const inner = baseStr.slice(1, -1).trim();
            const val2 = resolveValue(inner) & 65535;
            return { mode: "indirectDpY", val: val2 };
          }
          const val = resolveValue(baseStr);
          return { mode: "absY", val };
        }
        if (/^\$[\da-f]+$/i.test(trimmedRaw)) {
          const val = parseInt(trimmedRaw.replace(/\$/g, ""), 16) >>> 0;
          const size = getAddressSize(trimmedRaw);
          if (size === 1) {
            return { mode: "dp", val };
          } else {
            return { mode: "abs", val };
          }
        }
        const fallbackSource = loweredOperand?.baseExpression ?? operand;
        const fallbackValue = resolveValue(fallbackSource);
        const fallbackLength = getAddressSize(loweredOperand?.expanded ?? fallbackSource);
        return fallbackLength === 1 ? { mode: "dp", val: fallbackValue & 255 } : { mode: "abs", val: fallbackValue };
      }
      /**
       * True for a hex address spelling (`$12`, `$1234`, or bare hex). Registers
       * `A`/`X`/`Y`/`YA`/`SP` are excluded - otherwise `MOV label, A` becomes dp,dp
       * with source `$0A`.
       *
       * @param {string} operand Operand text.
       * @returns {boolean} True when the operand is a dp/abs hex address.
       */
      isDpOrAbs(operand) {
        const trimmed = operand.trim();
        if (/^(a|x|y|ya|sp)$/i.test(trimmed)) {
          return false;
        }
        const cleaned = trimmed.replace(/\$/g, "");
        if (!/^[\dA-Fa-f]+$/.test(cleaned)) {
          return false;
        }
        return true;
      }
      /**
       * ASL / LSR / ROL / ROR / INC / DEC. `A` is implied-acc; `DEC X`/`DEC Y` and
       * `INC X`/`INC Y` are 1-byte register forms. `$dp+X` vs `$abs+X` follows
       * {@link getAddressSize} (spelling), not the numeric value.
       *
       * @param {string} opcode Shift or inc/dec mnemonic.
       * @param {string} operand Operand (`A`, `X`, `Y`, `$dp`, `$dp+X`, `$abs`).
       * @param {number | null} forcedLen `.b`/`.w` override for dp vs abs.
       * @param {boolean} explicitlen True when a suffix forced the width.
       * @returns {boolean} True if encoded.
       */
      handleShiftIncDec(opcode, operand, forcedLen, explicitlen) {
        const table = {
          ASL: { a: 28, dpX: 27, dp: 11, abs: 12 },
          DEC: { a: 156, dpX: 155, dp: 139, abs: 140 },
          INC: { a: 188, dpX: 187, dp: 171, abs: 172 },
          LSR: { a: 92, dpX: 91, dp: 75, abs: 76 },
          ROL: { a: 60, dpX: 59, dp: 43, abs: 44 },
          ROR: { a: 124, dpX: 123, dp: 107, abs: 108 }
        };
        const upper = opcode.toUpperCase();
        if (!(upper in table)) {
          return false;
        }
        if (upper === "DEC") {
          if (operand.toUpperCase() === "X") {
            this.assembler.write1(29);
            return true;
          }
          if (operand.toUpperCase() === "Y") {
            this.assembler.write1(220);
            return true;
          }
        }
        if (upper === "INC") {
          if (operand.toUpperCase() === "X") {
            this.assembler.write1(61);
            return true;
          }
          if (operand.toUpperCase() === "Y") {
            this.assembler.write1(252);
            return true;
          }
        }
        if (isAccumulator(operand)) {
          this.assembler.write1(table[upper].a);
          return true;
        }
        const plusX = operand.toUpperCase().endsWith("+X");
        if (plusX) {
          const baseStr = operand.replace(/\+x$/i, "").trim();
          const val2 = parseInt(baseStr.replace(/\$/g, ""), 16) & 65535;
          if (explicitlen) {
            if (forcedLen === 1) {
              this.assembler.write1(table[upper].dpX);
              this.assembler.write1(val2 & 255);
            } else {
              this.assembler.write1(table[upper].abs);
              this.assembler.write2(val2);
            }
            return true;
          }
          if (val2 <= 255) {
            this.assembler.write1(table[upper].dpX);
            this.assembler.write1(val2 & 255);
          } else {
            this.assembler.write1(table[upper].abs);
            this.assembler.write2(val2);
          }
          return true;
        }
        const val = parseInt(operand.replace(/\$/g, ""), 16) & 65535;
        if (explicitlen) {
          if (forcedLen === 1) {
            this.assembler.write1(table[upper].dp);
            this.assembler.write1(val & 255);
          } else {
            this.assembler.write1(table[upper].abs);
            this.assembler.write2(val);
          }
          return true;
        }
        if (val <= 255) {
          this.assembler.write1(table[upper].dp);
          this.assembler.write1(val & 255);
        } else {
          this.assembler.write1(table[upper].abs);
          this.assembler.write2(val);
        }
        return true;
      }
      /**
       * SET0–SET7 / CLR0–CLR7 `$dp`. Bit is in the mnemonic; Asar also accepts
       * `SET1 $13.7` where `.n` overrides the mnemonic digit.
       *
       * @param {string} opcode SET/CLR mnemonic with bit digit.
       * @param {string} operand Direct-page address, optionally `$dp.n`.
       * @returns {boolean} True if encoded.
       */
      handleBitSetClear(opcode, operand) {
        const normalizedOpcode = opcode.toUpperCase();
        if (!hasOwn(bitSetClearOpcodes, normalizedOpcode)) {
          return false;
        }
        const trimmed = operand.trim();
        const dotted = trimmed.match(/^\$([\da-f]+)\.([0-7])$/i);
        let opcodeByte = bitSetClearOpcodes[normalizedOpcode];
        let dp;
        if (dotted) {
          dp = parseInt(dotted[1], 16) & 255;
          const bit2 = parseInt(dotted[2], 10);
          let lowNibble = 18;
          if (normalizedOpcode.startsWith("SET")) {
            lowNibble = 2;
          }
          opcodeByte = bit2 << 5 | lowNibble;
        } else {
          dp = parseInt(trimmed.replace(/\$/g, ""), 16) & 255;
        }
        this.assembler.write1(opcodeByte);
        this.assembler.write1(dp);
        return true;
      }
      /**
       * Relative branches (BPL...BRA). Opcode is written first, so the displacement
       * is `target - (pc + 1)` - equivalent to `target - (start + 2)` before the
       * write. `+`/`-` unnamed labels use that same post-opcode PC.
       *
       * @param {string} opcode Branch mnemonic.
       * @param {string} operand Label, `$xx`, or `+`/`-` unnamed label.
       * @returns {boolean} True if encoded.
       */
      handleBranch(opcode, operand) {
        if (!hasOwn(branchOpcodes, opcode)) {
          return false;
        }
        const opByte = branchOpcodes[opcode];
        this.assembler.write1(opByte);
        const branchReferenceAddress = this.assembler.currentTargetAddress + 1;
        let targetAddr;
        if (/^\++$/.test(operand)) {
          targetAddr = this.assembler.symbolScope.findNextLabel(operand, branchReferenceAddress);
        } else if (/^-+$/.test(operand)) {
          targetAddr = this.assembler.symbolScope.findPreviousLabel(operand, branchReferenceAddress);
        } else {
          targetAddr = this.assembler.operandResolver.getnum(operand);
        }
        const currentAddr = this.assembler.currentTargetAddress;
        const offset = targetAddr - (currentAddr + 1);
        if (!this.assembler.enforceResolvedLabels) {
          this.assembler.write1(255);
        } else {
          const unsignedOffset = offset < 0 ? 256 + offset : offset;
          this.assembler.write1(unsignedOffset & 255);
        }
        return true;
      }
      /**
       * BBS/BBC `$dp,label`. Bit from `$dp.n` if present, else the mnemonic digit
       * (`BBS3`). Wiki-native `BBS $12.3,L` has no digit in the mnemonic.
       *
       * @param {string} opcode BBS/BBC, optionally with a bit digit.
       * @param {string} left Direct-page operand (`$dp` or `$dp.n`).
       * @param {string} right Branch target.
       * @returns {boolean} True if encoded.
       */
      handleTwoOperandsBitBranch(opcode, left, right) {
        const parsed = parseBitBranchOpcode(opcode);
        if (!parsed) {
          return false;
        }
        const trimmed = left.trim();
        const dotted = trimmed.match(/^\$([\da-f]+)\.([0-7])$/i);
        let dpVal;
        let bit2 = parsed.mnemonicBit;
        if (dotted) {
          dpVal = Number.parseInt(dotted[1], 16) & 255;
          bit2 = Number(dotted[2]);
        } else {
          dpVal = Number.parseInt(trimmed.replace(/\$/g, ""), 16) & 255;
        }
        if (bit2 === void 0) {
          return false;
        }
        const opcodeByte = bit2 << 5 | (parsed.family === "BBS" ? 3 : 19);
        this.assembler.write1(opcodeByte);
        this.assembler.write1(dpVal);
        if (!this.assembler.enforceResolvedLabels) {
          this.assembler.write1(255);
        } else {
          let offset = 255;
          const target = this.assembler.operandResolver.getnum(right);
          const pc = this.assembler.currentTargetAddress;
          const relativeOffset = target - (pc + 1);
          offset = relativeOffset < 0 ? 256 + relativeOffset : relativeOffset;
          offset &= 255;
          this.assembler.write1(offset);
        }
        return true;
      }
      /**
       * DBNZ Y,label (2 bytes) vs DBNZ $dp,label (3 bytes). CBNE is always 3 bytes:
       * `$dp` or `$dp+X`.
       *
       * @param {string} opcode DBNZ or CBNE.
       * @param {string} left Register, `$dp`, or `$dp+X`.
       * @param {string} right Branch target.
       * @param {LoweredOperand} [leftLowered] Lowered left operand.
       * @param {LoweredOperand} [_rightLowered] Unused; kept for call-site symmetry.
       * @returns {boolean} True if encoded.
       */
      handleDbnzCbne(opcode, left, right, leftLowered, _rightLowered) {
        const isYForm = opcode.toUpperCase() === "DBNZ" && isRegisterY(left, leftLowered);
        let instructionSize = 3;
        if (isYForm) {
          instructionSize = 2;
        }
        const target = this.assembler.operandResolver.getnum(right);
        const offset = target - (this.assembler.currentTargetAddress + instructionSize);
        if (this.assembler.enforceResolvedLabels && (offset < -128 || offset > 127)) {
          throw this.assembler.diagnostics.error(`Branch target out of range (${offset})`);
        }
        const storedOffset = offset & 255;
        if (opcode.toUpperCase() === "DBNZ") {
          if (isYForm) {
            this.assembler.write1(254);
            this.assembler.write1(storedOffset);
            return true;
          }
          const val = parseInt(left.replace(/\$/g, ""), 16) & 255;
          this.assembler.write1(110);
          this.assembler.write1(val);
          this.assembler.write1(storedOffset);
          return true;
        }
        if (opcode.toUpperCase() === "CBNE") {
          const upper = left.toUpperCase();
          if (leftLowered?.mode === "directPageIndexedX" || upper.endsWith("+X")) {
            const base = upper.replace(/\+X$/, "").trim();
            const val2 = parseInt(base.replace(/\$/g, ""), 16) & 255;
            this.assembler.write1(222);
            this.assembler.write1(val2);
            this.assembler.write1(storedOffset);
            return true;
          }
          const val = parseInt(upper.replace(/\$/g, ""), 16) & 255;
          this.assembler.write1(46);
          this.assembler.write1(val);
          this.assembler.write1(storedOffset);
          return true;
        }
        return false;
      }
      /**
       * PUSH/POP A, X, Y, or P (PSW). No `(X)` form.
       *
       * @param {string} opcode PUSH or POP.
       * @param {string} operand Register name.
       * @param {LoweredOperand} [loweredOperand] Lowered register operand.
       * @returns {boolean} True if encoded.
       */
      handlePushPop(opcode, operand, loweredOperand) {
        const pushMap = {
          P: 13,
          A: 45,
          X: 77,
          Y: 109
        };
        const popMap = {
          P: 142,
          A: 174,
          X: 206,
          Y: 238
        };
        if (opcode.toUpperCase() === "PUSH") {
          const key = (loweredOperand?.registerName ?? operand).toUpperCase();
          if (hasOwn(pushMap, key)) {
            this.assembler.write1(pushMap[key]);
            return true;
          }
        }
        if (opcode.toUpperCase() === "POP") {
          const key = (loweredOperand?.registerName ?? operand).toUpperCase();
          if (hasOwn(popMap, key)) {
            this.assembler.write1(popMap[key]);
            return true;
          }
        }
        return false;
      }
      /**
       * CALL `$abs` (3F), PCALL `$dp` (4F page-zero), JMP `$abs` (5F) or
       * JMP `($abs+X)` (1F). JMP indirect uses a 16-bit pointer, not DP.
       *
       * @param {string} opcode CALL, PCALL, or JMP.
       * @param {string} operand Target or `($abs+X)`.
       * @param {LoweredOperand} [loweredOperand] Lowered operand metadata.
       * @returns {boolean} True if encoded.
       */
      handleCallJump(opcode, operand, loweredOperand) {
        const upper = opcode.toUpperCase();
        const resolveOperand = (value) => {
          try {
            return this.assembler.operandResolver.getnum(value) & 65535;
          } catch {
            return parseInt(value.replace(/\$/g, ""), 16) & 65535;
          }
        };
        if (upper === "CALL") {
          this.assembler.write1(63);
          const val = resolveOperand(operand);
          this.assembler.write2(val);
          return true;
        }
        if (upper === "PCALL") {
          this.assembler.write1(79);
          const val = resolveOperand(operand) & 255;
          this.assembler.write1(val);
          return true;
        }
        if (upper === "JMP") {
          const trimmed = operand.trim().toUpperCase();
          if (loweredOperand?.mode === "directPageIndexedXIndirect" || trimmed.startsWith("(") && trimmed.endsWith("+X)")) {
            this.assembler.write1(31);
            const inner = loweredOperand?.baseExpression ?? operand.trim().slice(1, operand.trim().length - 3).trim();
            const val = resolveOperand(inner);
            this.assembler.write2(val);
            return true;
          } else {
            this.assembler.write1(95);
            const val = resolveOperand(operand);
            this.assembler.write2(val);
            return true;
          }
        }
        return false;
      }
      /**
       * CMP/MOV with X or Y on the left (`CMP X,#$12`, `MOV Y,$1234`).
       * `operand` is `left,right` joined - a leftover from the one-operand path.
       *
       * @param {string} opcode CMP or MOV.
       * @param {string} operand Combined `left,right` text.
       * @param {number | null} forcedLen `.b`/`.w` override for dp vs abs.
       * @param {boolean} explicitlen True when a suffix forced the width.
       * @param {LoweredOperand} [leftLowered] Lowered left operand.
       * @param {LoweredOperand} [rightLowered] Lowered right operand.
       * @returns {boolean} True if encoded.
       */
      handleCmpXyOrMovXy(opcode, operand, forcedLen, explicitlen, leftLowered, rightLowered) {
        const upper = opcode.toUpperCase();
        if (upper === "CMP") {
          const upOp = operand.toUpperCase();
          const leftOperandIsX = leftLowered ? isRegisterX("", leftLowered) : upOp.startsWith("X,");
          const leftOperandIsY = leftLowered ? isRegisterY("", leftLowered) : upOp.startsWith("Y,");
          let tail = "";
          if (rightLowered) {
            tail = rightLowered.expanded.toUpperCase();
          } else if (leftOperandIsX || leftOperandIsY) {
            tail = upOp.slice(2).trim();
          }
          if (leftOperandIsX) {
            if (rightLowered?.immediate ?? tail.startsWith("#")) {
              this.assembler.write1(200);
              const imm = parseInt(tail.replace(/[^\da-f]/gi, ""), 16) & 255;
              this.assembler.write1(imm);
              return true;
            } else {
              const val = parseInt(tail.replace(/\$/g, ""), 16) & 65535;
              if (explicitlen) {
                if (forcedLen === 1) {
                  this.assembler.write1(62);
                  this.assembler.write1(val & 255);
                } else {
                  this.assembler.write1(30);
                  this.assembler.write2(val);
                }
              } else {
                if (getAddressSize(tail) === 1) {
                  this.assembler.write1(62);
                  this.assembler.write1(val & 255);
                } else {
                  this.assembler.write1(30);
                  this.assembler.write2(val);
                }
              }
              return true;
            }
          }
          if (leftOperandIsY) {
            if (rightLowered?.immediate ?? tail.startsWith("#")) {
              this.assembler.write1(173);
              const imm = parseInt(tail.replace(/[^\da-f]/gi, ""), 16) & 255;
              this.assembler.write1(imm);
              return true;
            } else {
              const val = parseInt(tail.replace(/\$/g, ""), 16) & 65535;
              if (explicitlen) {
                if (forcedLen === 1) {
                  this.assembler.write1(126);
                  this.assembler.write1(val & 255);
                } else {
                  this.assembler.write1(94);
                  this.assembler.write2(val);
                }
              } else {
                if (getAddressSize(tail) === 1) {
                  this.assembler.write1(126);
                  this.assembler.write1(val & 255);
                } else {
                  this.assembler.write1(94);
                  this.assembler.write2(val);
                }
              }
              return true;
            }
          }
        }
        if (upper === "MOV") {
          const upOp = operand.toUpperCase();
          const leftOperandIsX = leftLowered ? isRegisterX("", leftLowered) : upOp.startsWith("X,#");
          const leftOperandIsY = leftLowered ? isRegisterY("", leftLowered) : upOp.startsWith("Y,#");
          if (leftOperandIsX && (rightLowered?.immediate ?? upOp.startsWith("X,#"))) {
            this.assembler.write1(205);
            const imm = rightLowered?.baseExpression ? this.assembler.operandResolver.getnum(rightLowered.baseExpression) & 255 : parseInt(upOp.replace(/[^\da-f]/gi, ""), 16) & 255;
            this.assembler.write1(imm);
            return true;
          }
          if (leftOperandIsY && (rightLowered?.immediate ?? upOp.startsWith("Y,#"))) {
            this.assembler.write1(141);
            const imm = rightLowered?.baseExpression ? this.assembler.operandResolver.getnum(rightLowered.baseExpression) & 255 : parseInt(upOp.replace(/[^\da-f]/gi, ""), 16) & 255;
            this.assembler.write1(imm);
            return true;
          }
        }
        return false;
      }
      /**
       * TSET/TCLR `$abs,A` - always 16-bit absolute, even for `$12`. Right must be A.
       *
       * @param {string} opcode TSET or TCLR.
       * @param {string} left Absolute address.
       * @param {string} right Must classify as A.
       * @param {LoweredOperand} [rightLowered] Lowered right operand.
       * @returns {boolean} True if encoded.
       */
      handleTsetTclr(opcode, left, right, rightLowered) {
        const up = opcode.toUpperCase();
        if (up !== "TSET" && up !== "TCLR") {
          return false;
        }
        if (!isAccumulator(right, rightLowered)) {
          return false;
        }
        const val = parseInt(left.replace(/\$/g, ""), 16) & 65535;
        const baseOpcode = up === "TSET" ? 14 : 78;
        this.assembler.write1(baseOpcode);
        this.assembler.write1(val & 255);
        this.assembler.write1(val >> 8 & 255);
        return true;
      }
      /**
       * MOV register pairs, then A/X/Y ↔ memory. `.b`/`.w` on `MOV.w A,$0000`
       * forces abs even when the hex is 4 digits of zeros. Remaining indexed
       * forms go to {@link handleMovMemoryCombo} / {@link handleMovMemoryCombo2}.
       *
       * @param {string} left Left operand.
       * @param {string} right Right operand.
       * @param {number | null} forcedLen `.b`=1 / `.w`=2 when a suffix was present.
       * @param {boolean} explicitlen True when `forcedLen` came from a suffix.
       * @returns {boolean} True if encoded.
       */
      handleMovInstruction(left, right, forcedLen, explicitlen) {
        const tableMoves = [
          { pattern: /^x\s*,\s*a$/i, opcode: 93 },
          { pattern: /^a\s*,\s*x$/i, opcode: 125 },
          { pattern: /^x\s*,\s*sp$/i, opcode: 157 },
          { pattern: /^sp\s*,\s*x$/i, opcode: 189 },
          { pattern: /^a\s*,\s*y$/i, opcode: 221 },
          { pattern: /^y\s*,\s*a$/i, opcode: 253 },
          { pattern: /^\(x\+\)\s*,\s*a$/i, opcode: 175 },
          { pattern: /^a\s*,\s*\(x\+\)$/i, opcode: 191 },
          { pattern: /^\(x\)\s*,\s*a$/i, opcode: 198 },
          { pattern: /^a\s*,\s*\(x\)$/i, opcode: 230 }
        ];
        const combined = `${left.trim()},${right.trim()}`;
        for (const t of tableMoves) {
          if (t.pattern.test(combined)) {
            this.assembler.write1(t.opcode);
            return true;
          }
        }
        const memoryMoves = {
          "A,$": { byte: 228, word: 229 },
          "A,$+X": { byte: 244, word: 245 },
          "X,$": { byte: 248, word: 233 },
          "Y,$": { byte: 235, word: 236 },
          "$,A": { byte: 196, word: 197 },
          "$+X,A": { byte: 212, word: 213 },
          "$,X": { byte: 216, word: 201 },
          "$,Y": { byte: 203, word: 204 }
        };
        let key = null;
        if (/^\$[\da-f]+$/i.test(left)) {
          key = `$,${right.toUpperCase()}`;
        } else if (/^\$[\da-f]+\+x$/i.test(left)) {
          key = `$+X,${right.toUpperCase()}`;
        } else if (/^\$[\da-f]+$/i.test(right)) {
          key = `${left.toUpperCase()},$`;
        } else if (/^\$[\da-f]+\+x$/i.test(right)) {
          key = `${left.toUpperCase()},$+X`;
        }
        if (key && hasOwn(memoryMoves, key)) {
          const operandWithAddr = /\$([^+]+)/.exec(left) ? left : right;
          const match = /\$([^+]+)/.exec(operandWithAddr);
          if (!match) return false;
          const val = parseInt(match[1], 16);
          const mode3 = memoryMoves[key];
          const inferredLength = getAddressSize(`$${match[1]}`);
          const selectedLength = explicitlen ? forcedLen : inferredLength;
          const opcode = selectedLength === 1 ? mode3.byte : mode3.word;
          this.assembler.write1(opcode);
          if (opcode === mode3.word) {
            this.assembler.write2(val);
          } else {
            this.assembler.write1(val & 255);
          }
          return true;
        }
        const leftUp = left.trim().toUpperCase();
        const rightUp = right.trim().toUpperCase();
        const movAbsByDest = {
          A: { byte: 196, word: 197 },
          X: { byte: 216, word: 201 },
          Y: { byte: 203, word: 204 }
        };
        const movAbsBySrc = {
          A: { byte: 228, word: 229 },
          X: { byte: 248, word: 233 },
          Y: { byte: 235, word: 236 }
        };
        if (hasOwn(movAbsByDest, rightUp) && !hasOwn(movAbsByDest, leftUp) && !left.includes("(") && !left.includes("+")) {
          const val = this.assembler.operandResolver.getnum(left);
          const length = /^\$[\da-f]{1,2}$/i.test(left.trim()) ? 1 : 2;
          const mode3 = movAbsByDest[rightUp];
          this.assembler.write1(length === 1 ? mode3.byte : mode3.word);
          if (length === 1) {
            this.assembler.write1(val & 255);
          } else {
            this.assembler.write2(val & 65535);
          }
          return true;
        }
        if (hasOwn(movAbsBySrc, leftUp) && !right.trim().startsWith("#") && !hasOwn(movAbsBySrc, rightUp) && !right.includes("(") && !right.includes("+")) {
          const val = this.assembler.operandResolver.getnum(right);
          const length = /^\$[\da-f]{1,2}$/i.test(right.trim()) ? 1 : 2;
          const mode3 = movAbsBySrc[leftUp];
          this.assembler.write1(length === 1 ? mode3.byte : mode3.word);
          if (length === 1) {
            this.assembler.write1(val & 255);
          } else {
            this.assembler.write2(val & 65535);
          }
          return true;
        }
        if (/^a\s*,\s*#\$[\da-f]+$/i.test(combined)) {
          this.assembler.write1(232);
          const imm = parseInt(right.replace(/[^\da-f]/gi, ""), 16) & 255;
          this.assembler.write1(imm);
          return true;
        }
        if (this.isDpOrAbs(left) && right.startsWith("#")) {
          this.assembler.write1(143);
          const imm = parseInt(right.replace(/[^\da-f]/gi, ""), 16) & 255;
          this.assembler.write1(imm);
          const leftVal = parseInt(left.replace(/\$/g, ""), 16) & 255;
          this.assembler.write1(leftVal);
          return true;
        }
        if (/^\(\$[\da-f]+\)$/i.test(left) && /^\(\$[\da-f]+\)$/i.test(right)) {
          this.assembler.write1(250);
          const rightVal = parseInt(right.replace(/[^\da-f]/gi, ""), 16) & 255;
          this.assembler.write1(rightVal);
          const leftVal = parseInt(left.replace(/[^\da-f]/gi, ""), 16) & 255;
          this.assembler.write1(leftVal);
          return true;
        }
        if (this.isDpOrAbs(left) && this.isDpOrAbs(right)) {
          this.assembler.write1(250);
          const rightVal = parseInt(right.replace(/\$/g, ""), 16) & 255;
          this.assembler.write1(rightVal);
          const leftVal = parseInt(left.replace(/\$/g, ""), 16) & 255;
          this.assembler.write1(leftVal);
          return true;
        }
        return this.handleMovMemoryCombo(left, right) || this.handleMovMemoryCombo2(left, right);
      }
      /**
       * MOV `(dp+X)` / `(dp)+Y` ↔ A. Parentheses are optional in the regex so
       * `$12+X,A` can still match C7 - combo2 handles the abs+X variants.
       *
       * @param {string} left Left operand.
       * @param {string} right Right operand.
       * @returns {boolean} True if encoded.
       */
      handleMovMemoryCombo(left, right) {
        const combined = `${left.trim()},${right.trim()}`.toUpperCase();
        let m = combined.match(/^\(?\$([\dA-F]+)\+X?\),A$/);
        if (m) {
          const dpVal = parseInt(m[1], 16) & 255;
          this.assembler.write1(199);
          this.assembler.write1(dpVal);
          return true;
        }
        m = combined.match(/^\(?\$([\dA-F]+)\)\+Y?,A$/);
        if (m) {
          const dpVal = parseInt(m[1], 16) & 255;
          this.assembler.write1(215);
          this.assembler.write1(dpVal);
          return true;
        }
        m = combined.match(/^A ?,?\(?\$([\dA-F]+)\+X?\)$/);
        if (m) {
          const dpVal = parseInt(m[1], 16) & 255;
          this.assembler.write1(231);
          this.assembler.write1(dpVal);
          return true;
        }
        m = combined.match(/^A ?,?\(?\$([\dA-F]+)\)\+Y$/);
        if (m) {
          const dpVal = parseInt(m[1], 16) & 255;
          this.assembler.write1(247);
          this.assembler.write1(dpVal);
          return true;
        }
        return false;
      }
      /**
       * MOV `$addr+X|+Y` ↔ A/X/Y. Width from {@link getAddressSize} on the base
       * expression (`$12+X` vs `$1234+X`). Skips anything with parentheses
       * (those belong to {@link handleMovMemoryCombo}).
       *
       * @param {string} left Left operand.
       * @param {string} right Right operand.
       * @returns {boolean} True if encoded.
       */
      handleMovMemoryCombo2(left, right) {
        const combined = `${left.trim()},${right.trim()}`.toUpperCase();
        const resolveIndexedExpression = (operand) => {
          if (operand.includes("(") || operand.includes(")")) {
            return null;
          }
          const match = operand.trim().match(/^(.*)\+([xy])$/i);
          if (!match) {
            return null;
          }
          const baseExpression = match[1].trim();
          if (!baseExpression) {
            return null;
          }
          return {
            value: this.assembler.operandResolver.getnum(baseExpression),
            index: match[2].toUpperCase(),
            length: getAddressSize(baseExpression)
          };
        };
        const leftIndexed = resolveIndexedExpression(left);
        if (leftIndexed) {
          const leftIndexedOpcodes = {
            A: { X: { dp: 212, abs: 213 }, Y: { dp: 214, abs: 214 } },
            X: { Y: { dp: 217, abs: 217 } },
            Y: { X: { dp: 219, abs: 219 } }
          };
          const rightRegister = right.trim().toUpperCase();
          const modes = leftIndexedOpcodes[rightRegister]?.[leftIndexed.index];
          if (modes) {
            let opcode = modes.abs;
            if (leftIndexed.length === 1) {
              opcode = modes.dp;
            }
            this.assembler.write1(opcode);
            this.writeDpOrAbs(leftIndexed.value, leftIndexed.length);
            return true;
          }
        }
        const rightIndexed = resolveIndexedExpression(right);
        if (rightIndexed) {
          const rightIndexedOpcodes = {
            A: { X: { dp: 244, abs: 245 }, Y: { dp: 246, abs: 246 } },
            X: { Y: { dp: 249, abs: 249 } },
            Y: { X: { dp: 251, abs: 251 } }
          };
          const leftRegister = left.trim().toUpperCase();
          const modes = rightIndexedOpcodes[leftRegister]?.[rightIndexed.index];
          if (modes) {
            let opcode = modes.abs;
            if (rightIndexed.length === 1) {
              opcode = modes.dp;
            }
            this.assembler.write1(opcode);
            this.writeDpOrAbs(rightIndexed.value, rightIndexed.length);
            return true;
          }
        }
        const patterns = [
          // left side with +X or +Y, right side = A
          {
            regex: /^\$([\dA-F]+)\+X\s*,\s*A$/,
            opcodeDp: 212,
            opcodeAbs: 213
          },
          {
            regex: /^\$([\dA-F]+)\+Y\s*,\s*A$/,
            opcodeDp: 214,
            opcodeAbs: 214
            // test uses same? Actually the test lines for "+Y" are the same 0xd6 for 16-bit.
          },
          // left side with +Y, right side = X => e.g. "MOV $12+Y,X => 0xD9 12"
          {
            regex: /^\$([\dA-F]+)\+Y\s*,\s*X$/,
            opcodeDp: 217,
            opcodeAbs: 217
            // the test doesn't differentiate, so we unify
          },
          // left side with +X, right side = Y => "MOV $12+X,Y => 0xDB 12"
          {
            regex: /^\$([\dA-F]+)\+X\s*,\s*Y$/,
            opcodeDp: 219,
            opcodeAbs: 219
          }
        ];
        for (const p of patterns) {
          const m = combined.match(p.regex);
          if (m) {
            const val = parseInt(m[1], 16) & 65535;
            const length = getAddressSize("$" + m[1]);
            let op2 = p.opcodeAbs;
            if (length === 1) {
              op2 = p.opcodeDp;
            }
            this.assembler.write1(op2);
            this.writeDpOrAbs(val, length);
            return true;
          }
        }
        const patterns2 = [
          // A,$12+X => 0xF4 / 0xF5
          {
            regex: /^A\s*,\s*\$([\dA-F]+)\+X$/,
            opcodeDp: 244,
            opcodeAbs: 245
          },
          // A,$12+Y => 0xF6 (the test code says "MOV A,$1234+Y => 0xF6 34 12" or "MOV A,$12+Y => 0xF6 12"?
          {
            regex: /^A\s*,\s*\$([\dA-F]+)\+Y$/,
            opcodeDp: 246,
            opcodeAbs: 246
          },
          // X,$12+Y => 0xF9, Y,$12+X => 0xFB, etc. from the test
          {
            regex: /^X\s*,\s*\$([\dA-F]+)\+Y$/,
            opcodeDp: 249,
            opcodeAbs: 249
          },
          {
            regex: /^Y\s*,\s*\$([\dA-F]+)\+X$/,
            opcodeDp: 251,
            opcodeAbs: 251
          }
        ];
        for (const p of patterns2) {
          const m = combined.match(p.regex);
          if (m) {
            const val = parseInt(m[1], 16) & 65535;
            const length = getAddressSize("$" + m[1]);
            let op2 = p.opcodeAbs;
            if (length === 1) {
              op2 = p.opcodeDp;
            }
            this.assembler.write1(op2);
            this.writeDpOrAbs(val, length);
            return true;
          }
        }
        const patterns3 = [
          {
            regex: /^\$([\dA-F]+)\s*,\s*A$/,
            opcodeDp: 196,
            opcodeAbs: 197
          },
          {
            regex: /^\$([\dA-F]+)\s*,\s*X$/,
            opcodeDp: 216,
            opcodeAbs: 201
          },
          {
            regex: /^\$([\dA-F]+)\s*,\s*Y$/,
            opcodeDp: 203,
            opcodeAbs: 204
          },
          // The reverse: "A,$1234" => 0xe5 or 0xe4 for dp; "X,$1234" => 0xe9 or 0xf8 for dp, etc.
          {
            regex: /^A\s*,\s*\$([\dA-F]+)$/,
            opcodeDp: 228,
            opcodeAbs: 229
          },
          {
            regex: /^X\s*,\s*\$([\dA-F]+)$/,
            opcodeDp: 248,
            opcodeAbs: 233
          },
          {
            regex: /^Y\s*,\s*\$([\dA-F]+)$/,
            opcodeDp: 235,
            opcodeAbs: 236
          }
        ];
        for (const p of patterns3) {
          const m = combined.match(p.regex);
          if (m) {
            const val = parseInt(m[1], 16) & 65535;
            const length = getAddressSize("$" + m[1]);
            let op2 = p.opcodeAbs;
            if (length === 1) {
              op2 = p.opcodeDp;
            }
            this.assembler.write1(op2);
            this.writeDpOrAbs(val, length);
            return true;
          }
        }
        return false;
      }
      /**
       * Encodes mem.bit carry ops. Bit is taken from `$addr.n` if present, else the
       * mnemonic digit (`NOT2` → bit 2). High byte is `(addr >> 8) | (bit << 5)`.
       *
       *   NOT1 $1234 / NOT2 C,$0027 / NOT1 $12.3 / NOT1 $addr,3
       *   MOV1 C,$addr / MOV2 $addr,C
       *   OR1 C,$addr / OR1 C,!$addr / AND1 C,/addr
       * @param {string} opcode Mnemonic, including numbered TASM forms.
       * @param {string} left Left operand.
       * @param {string} right Right operand, or empty for one-operand NOT/MOV.
       * @param {string} [explicitBitText] Optional third operand bit (`AND1 C,$addr,2`).
       * @returns {boolean} true if the combo was handled, false otherwise
       */
      handleBitManipulation(opcode, left, right, explicitBitText = "") {
        const parsed = parseNumberedBitOpcode(opcode);
        if (!parsed) {
          return false;
        }
        const leftUp = left.trim().toUpperCase();
        const rightUp = right.trim().toUpperCase();
        let memRaw = "";
        let movToCarry = true;
        let bitFromOperand;
        if (explicitBitText !== "") {
          const parsedBit = parseSpcBitNumber(explicitBitText);
          if (parsedBit === void 0) {
            return false;
          }
          bitFromOperand = parsedBit;
        }
        if (parsed.family === "MOV") {
          if (leftUp === "C") {
            memRaw = right;
            movToCarry = true;
          } else if (rightUp === "C") {
            memRaw = left;
            movToCarry = false;
          } else if (right === "") {
            memRaw = left;
            movToCarry = true;
          } else {
            return false;
          }
        } else if (parsed.family === "NOT") {
          if (right === "") {
            memRaw = left;
          } else if (leftUp === "C") {
            memRaw = right;
          } else if (rightUp === "C") {
            memRaw = left;
          } else {
            const bitNumber = parseSpcBitNumber(right);
            if (bitNumber === void 0) {
              return false;
            }
            memRaw = left;
            bitFromOperand = bitNumber;
          }
        } else if (leftUp === "C") {
          memRaw = right;
        } else if (rightUp === "C") {
          memRaw = left;
        } else {
          return false;
        }
        const mem = parseSpcMemBitOperand(memRaw);
        if (!mem) {
          return false;
        }
        let bit2 = parsed.mnemonicBit;
        if (mem.bit !== void 0) {
          bit2 = mem.bit;
        }
        if (bitFromOperand !== void 0) {
          bit2 = bitFromOperand;
        }
        let opcodeByte = 234;
        if (parsed.family === "OR") {
          opcodeByte = 10;
          if (mem.invert) {
            opcodeByte = 42;
          }
        } else if (parsed.family === "AND") {
          opcodeByte = 74;
          if (mem.invert) {
            opcodeByte = 106;
          }
        } else if (parsed.family === "EOR") {
          opcodeByte = 138;
        } else if (parsed.family === "MOV") {
          opcodeByte = 170;
          if (!movToCarry) {
            opcodeByte = 202;
          }
        }
        const hex4 = mem.addressText.match(/^\$([\da-f]+)$/i);
        let addr;
        if (hex4) {
          addr = Number.parseInt(hex4[1], 16) & 65535;
        } else {
          addr = this.assembler.operandResolver.getnum(mem.addressText) & 65535;
        }
        this.assembler.write1(opcodeByte);
        this.assembler.write1(addr & 255);
        this.assembler.write1(addr >> 8 & 255 | (bit2 & 7) << 5);
        return true;
      }
      /**
       * DAA A, DAS A, MUL YA, DIV YA,X, then DECW/INCW `$dp`. DIV is passed as
       * `"YA,X"` from {@link handleTwoOperands} via join - still one "operand" here.
       *
       * @param {string} opcode Special mnemonic.
       * @param {string} operand Register combo or `$dp`.
       * @returns {boolean} True if encoded.
       */
      handleSingleOperandSpecial(opcode, operand) {
        const upOpcode = opcode.toUpperCase();
        const upOperand = operand.toUpperCase();
        if ((upOpcode === "DAA" || upOpcode === "DAS") && upOperand === "A") {
          if (upOpcode === "DAA") {
            this.assembler.write1(223);
          } else {
            this.assembler.write1(190);
          }
          return true;
        }
        if (upOpcode === "MUL" && upOperand === "YA") {
          this.assembler.write1(207);
          return true;
        }
        if (upOpcode === "DIV" && upOperand === "YA,X") {
          this.assembler.write1(158);
          return true;
        }
        if (parseNumberedBitOpcode(upOpcode)) {
          return this.handleBitManipulation(upOpcode, operand, "");
        }
        if (this.handleWordOps(upOpcode, operand)) {
          return true;
        }
        return false;
      }
      /**
       * DECW/INCW `$dp` only. YA word ops with two operands are
       * {@link handleWordOpsTwoOperands}.
       *
       * @param {string} opcode DECW or INCW.
       * @param {string} operand Direct-page address.
       * @returns {boolean} True if encoded.
       */
      handleWordOps(opcode, operand) {
        const up = opcode.toUpperCase();
        if (hasOwn(singleWordOps, up)) {
          const val = parseInt(operand.replace(/\$/g, ""), 16) & 255;
          this.assembler.write1(singleWordOps[up]);
          this.assembler.write1(val);
          return true;
        }
        return false;
      }
      /**
       * `.b`=1, `.w`=2, `.l`=3. `.d` is accepted (deprecated) but SPC700 never
       * emits 32-bit immediates - callers treat 4 as "not dp".
       *
       * @param {string} c Length suffix character.
       * @returns {number} Operand width in bytes.
       */
      getlenfromchar(c) {
        switch (c.toLowerCase()) {
          case "b":
            return 1;
          case "w":
            return 2;
          case "l":
            return 3;
          case "d":
            return 4;
          default:
            throw new Error("Error: Invalid opcode length.");
        }
      }
    };
  }
});

// packages/plugin-snes/src/architectures/superfx-decoder.ts
function formatSuperFxInstruction(instruction) {
  if (instruction.architecture !== "snes.superfx") {
    throw new Error(`Cannot format architecture '${instruction.architecture}' as SuperFX.`);
  }
  const values = instruction.operands.map((operand) => operand.value ?? 0);
  const registers2 = instruction.operands.map((operand) => operand.register ?? "R0");
  let operands = "";
  switch (instruction.mode) {
    case "relative":
      operands = hex3(instruction.operands[0]?.targetAddress ?? 0, 3);
      break;
    case "register":
      operands = registers2[0];
      break;
    case "registerIndirect":
      operands = `(${registers2[0]})`;
      break;
    case "immediateNibble":
      operands = `#${values[0]}`;
      break;
    case "registerImmediate8":
      operands = `${registers2[0]},#${hex3(values[1], 1)}`;
      break;
    case "registerImmediate16":
      operands = `${registers2[0]},#${hex3(values[1], 2)}`;
      break;
    case "registerRegister":
      operands = `${registers2[0]},${registers2[1]}`;
      break;
    case "registerRegisterIndirect":
      operands = `${registers2[0]},(${registers2[1]})`;
      break;
    case "registerIndirectRegister":
      operands = `(${registers2[0]}),${registers2[1]}`;
      break;
    case "registerRamShort":
    case "registerRamAbsolute":
      operands = `${registers2[0]},(${hex3(values[1], 2)})`;
      break;
    case "ramShortRegister":
    case "ramAbsoluteRegister":
      operands = `(${hex3(values[0], 2)}),${registers2[1]}`;
      break;
  }
  return operands ? `${instruction.mnemonic} ${operands}` : instruction.mnemonic;
}
var word, register3, immediate2, address3, operandsFor3, r15Target, controlsFor, buildInstruction3, buildFusedInstruction, matchFused, availableAt, truncated, prefixAlt, SuperFxDecoder, hex3;
var init_superfx_decoder = __esm({
  "packages/plugin-snes/src/architectures/superfx-decoder.ts"() {
    "use strict";
    init_superfx_spec();
    word = (bytes, offset) => (bytes[offset] ?? 0) | (bytes[offset + 1] ?? 0) << 8;
    register3 = (value) => ({ kind: "register", register: `R${value}` });
    immediate2 = (value, width, signed2 = false) => ({
      kind: "immediate",
      value,
      width,
      ...signed2 ? { signed: true } : {}
    });
    address3 = (value, width) => ({
      kind: "address",
      value,
      width
    });
    operandsFor3 = (specification2, bytes, prefixLength, logicalAddress) => {
      const operandOffset = prefixLength + 1;
      const registerNumber = specification2.register ?? 0;
      switch (specification2.operandEncoding) {
        case "implied":
          return [];
        case "relative": {
          const raw = bytes[operandOffset] ?? 0;
          const displacement = raw & 128 ? raw - 256 : raw;
          return [
            {
              kind: "displacement",
              value: displacement,
              width: 1,
              signed: true,
              targetAddress: logicalAddress & 16711680 | logicalAddress + bytes.length + displacement & 65535
            }
          ];
        }
        case "register":
        case "registerIndirect":
          return [register3(registerNumber)];
        case "immediateNibble":
          return [immediate2(registerNumber, 1)];
        case "registerImmediate8":
          return [register3(registerNumber), immediate2(bytes[operandOffset] ?? 0, 1, true)];
        case "registerImmediate16":
          return [register3(registerNumber), immediate2(word(bytes, operandOffset), 2)];
        case "registerRamShort":
          return [register3(registerNumber), address3((bytes[operandOffset] ?? 0) << 1, 2)];
        case "ramShortRegister":
          return [address3((bytes[operandOffset] ?? 0) << 1, 2), register3(registerNumber)];
        case "registerRamAbsolute":
          return [register3(registerNumber), address3(word(bytes, operandOffset), 2)];
        case "ramAbsoluteRegister":
          return [address3(word(bytes, operandOffset), 2), register3(registerNumber)];
      }
      throw new Error("Unsupported SuperFX operand encoding.");
    };
    r15Target = (specification2, operands, state, logicalAddress) => {
      if (specification2.register === 15) {
        if (specification2.mnemonic === "IWT") {
          return (((state.programBank === "unknown" ? logicalAddress >>> 16 : state.programBank) ?? logicalAddress >>> 16) & 255) << 16 | (operands[1]?.value ?? 0);
        }
        if (specification2.mnemonic === "IBT") {
          const raw = operands[1]?.value ?? 0;
          const target = raw & 128 ? 65280 | raw : raw;
          const bank = state.programBank === "unknown" || state.programBank === void 0 ? logicalAddress >>> 16 : state.programBank;
          return (bank & 255) << 16 | target;
        }
        if (specification2.mnemonic === "LM" || specification2.mnemonic === "LMS") return "indirect";
      }
      if (specification2.writesDestination && state.destinationRegister === 15) return "indirect";
      return void 0;
    };
    controlsFor = (specification2, operands, state, logicalAddress) => {
      const r15 = r15Target(specification2, operands, state, logicalAddress);
      if (typeof r15 === "number") {
        return {
          flow: { kind: "jump", fallthrough: false },
          references: [{ kind: "jump", operandIndex: 1, address: r15 }]
        };
      }
      if (r15 === "indirect") {
        return {
          flow: { kind: "jump", fallthrough: false, indirect: true },
          references: [{ kind: "jump", indirect: true }]
        };
      }
      if (specification2.mnemonic === "BRA" || specification2.mnemonic.startsWith("B") && specification2.operandEncoding === "relative") {
        return {
          flow: specification2.flow,
          references: [{ kind: "branch", operandIndex: 0, address: operands[0]?.targetAddress }]
        };
      }
      if (specification2.mnemonic === "LOOP") {
        return {
          flow: specification2.flow,
          references: [{ kind: "branch", indirect: true }]
        };
      }
      if (specification2.mnemonic === "JMP" || specification2.mnemonic === "LJMP") {
        return {
          flow: specification2.flow,
          references: [{ kind: "jump", operandIndex: 0, indirect: true }]
        };
      }
      let memoryIndex;
      if (specification2.operandEncoding === "registerRamShort" || specification2.operandEncoding === "registerRamAbsolute") {
        memoryIndex = 1;
      } else if (specification2.operandEncoding === "ramShortRegister" || specification2.operandEncoding === "ramAbsoluteRegister") {
        memoryIndex = 0;
      }
      if (memoryIndex !== void 0) {
        return {
          flow: specification2.flow,
          references: [
            { kind: "data", operandIndex: memoryIndex, address: operands[memoryIndex]?.value }
          ]
        };
      }
      if (specification2.operandEncoding === "registerIndirect") {
        return {
          flow: specification2.flow,
          references: [{ kind: "pointer", operandIndex: 0, indirect: true }]
        };
      }
      return { flow: specification2.flow, references: [] };
    };
    buildInstruction3 = (specification2, bytes, context, state, prefixLength) => {
      const operands = operandsFor3(specification2, bytes, prefixLength, context.logicalAddress);
      const controls = controlsFor(specification2, operands, state, context.logicalAddress);
      return {
        architecture: "snes.superfx",
        specificationId: specification2.id,
        opcode: specification2.opcode[0],
        mnemonic: specification2.mnemonic,
        mode: specification2.mode,
        offset: context.offset,
        logicalAddress: context.logicalAddress & 16777215,
        bytes,
        size: bytes.length,
        operands,
        references: controls.references,
        flow: controls.flow,
        effects: specification2.effects
      };
    };
    buildFusedInstruction = (specification2, bytes, context) => {
      let operands;
      if (specification2.mode === "registerRegister") {
        operands = [
          register3(specification2.destinationRegister),
          register3(specification2.sourceRegister ?? 0)
        ];
      } else if (specification2.mode === "registerRegisterIndirect") {
        operands = [
          register3(specification2.destinationRegister),
          register3(specification2.pointerRegister ?? 0)
        ];
      } else {
        operands = [
          register3(specification2.sourceRegister ?? 0),
          register3(specification2.pointerRegister ?? 0)
        ];
      }
      return {
        architecture: "snes.superfx",
        specificationId: specification2.id,
        opcode: specification2.opcode.at(-1) ?? specification2.opcode[0],
        mnemonic: specification2.mnemonic,
        mode: specification2.mode,
        offset: context.offset,
        logicalAddress: context.logicalAddress & 16777215,
        bytes,
        size: bytes.length,
        operands,
        references: specification2.flow.kind === "jump" ? [{ kind: "jump", indirect: true }] : [],
        flow: specification2.flow,
        effects: specification2.effects
      };
    };
    matchFused = (context) => superFxFusedSpecifications.find(
      (entry) => entry.opcode.every((value, index) => context.source.readByte(context.offset + index) === value)
    );
    availableAt = (context) => Number.isInteger(context.offset) && context.offset >= 0 ? Math.max(0, context.source.length - context.offset) : 0;
    truncated = (context, requiredBytes) => ({
      kind: "error",
      code: "truncated",
      message: `SuperFX instruction at offset ${context.offset} needs ${requiredBytes} byte(s).`,
      offset: context.offset,
      requiredBytes,
      availableBytes: availableAt(context)
    });
    prefixAlt = (opcode) => opcode >= 61 && opcode <= 63 ? opcode - 60 : void 0;
    SuperFxDecoder = class {
      decode(context) {
        const opcode = context.source.readByte(context.offset);
        if (opcode === void 0) {
          return {
            kind: "error",
            code: "outOfBounds",
            message: `No SuperFX opcode exists at offset ${context.offset}.`,
            offset: context.offset,
            availableBytes: availableAt(context)
          };
        }
        const state = context.state ?? {};
        const requestedAlt = state.alt ?? 0;
        if (requestedAlt !== "unknown" && ![0, 1, 2, 3].includes(requestedAlt)) {
          return {
            kind: "error",
            code: "invalidState",
            message: `Invalid SuperFX ALT state '${requestedAlt}'.`,
            offset: context.offset,
            availableBytes: availableAt(context)
          };
        }
        if (requestedAlt === 0 && (state.destinationRegister === void 0 || state.destinationRegister === 0) && (state.sourceRegister === void 0 || state.sourceRegister === 0)) {
          const fused2 = matchFused(context);
          if (fused2) {
            const bytes2 = context.source.readBytes(context.offset, fused2.minimumSize);
            if (!bytes2) return truncated(context, fused2.minimumSize);
            return { kind: "instruction", instruction: buildFusedInstruction(fused2, bytes2, context) };
          }
        }
        const prefix = prefixAlt(opcode);
        if (prefix !== void 0) {
          const next = context.source.readByte(context.offset + 1);
          const canFuse = requestedAlt === 0 || requestedAlt === "unknown";
          if (next !== void 0 && canFuse && prefixAlt(next) === void 0) {
            const effective = superFxOpcodeMatrix[prefix][next];
            if (effective.alteredByAlt) {
              const required = effective.minimumSize + 1;
              const bytes3 = context.source.readBytes(context.offset, required);
              if (!bytes3) return truncated(context, required);
              return {
                kind: "instruction",
                instruction: buildInstruction3(effective, bytes3, context, { ...state, alt: prefix }, 1)
              };
            }
          }
          const specification3 = superFxOpcodeMatrix[0][opcode];
          const bytes2 = context.source.readBytes(context.offset, 1);
          return {
            kind: "instruction",
            instruction: buildInstruction3(specification3, bytes2, context, state, 0)
          };
        }
        if (requestedAlt === "unknown") {
          const candidates = [0, 1, 2, 3].map((alt2) => superFxOpcodeMatrix[alt2][opcode]);
          const unique = [
            ...new Map(candidates.map((entry) => [`${entry.mnemonic}:${entry.mode}`, entry])).values()
          ];
          if (unique.length > 1) {
            const alternatives = unique.flatMap((entry) => {
              const bytes2 = context.source.readBytes(context.offset, entry.minimumSize);
              return bytes2 ? [buildInstruction3(entry, bytes2, context, { ...state, alt: entry.alt }, 0)] : [];
            });
            return {
              kind: "ambiguous",
              reason: `SuperFX opcode $${opcode.toString(16).toUpperCase().padStart(2, "0")} depends on ALT state.`,
              requiredState: ["alt"],
              alternatives,
              minimumSize: Math.min(...unique.map((entry) => entry.minimumSize)),
              maximumSize: Math.max(...unique.map((entry) => entry.maximumSize)),
              ...alternatives.length === unique.length ? {} : {
                unavailableAlternatives: unique.filter(
                  (entry) => context.source.readBytes(context.offset, entry.minimumSize) === void 0
                ).map((entry) => ({
                  code: "truncated",
                  size: entry.minimumSize,
                  availableBytes: availableAt(context)
                }))
              }
            };
          }
        }
        const alt = requestedAlt === "unknown" ? 0 : requestedAlt;
        const specification2 = superFxOpcodeMatrix[alt][opcode];
        const bytes = context.source.readBytes(context.offset, specification2.minimumSize);
        if (!bytes) return truncated(context, specification2.minimumSize);
        return {
          kind: "instruction",
          instruction: buildInstruction3(specification2, bytes, context, state, 0)
        };
      }
    };
    hex3 = (value, width) => `$${value.toString(16).toUpperCase().padStart(width * 2, "0")}`;
  }
});

// packages/plugin-snes/src/asar/compatibility.ts
var ASAR_COMPAT_NO_OP_DIRECTIVES, assertMapperAvailable, applyMapperSelection, isFreespaceAvailable, encodeSuperFxMoveShortAddress, getChecksumHeaderOffset, calculateHeaderChecksum, shouldRedirectOrgToSpcblock, shouldEnableSpcInlineCompat, shouldUseNoromAddressing, shouldAutoCloseSpcblock, shouldEndifCloseInnermostWhile;
var init_compatibility = __esm({
  "packages/plugin-snes/src/asar/compatibility.ts"() {
    "use strict";
    ASAR_COMPAT_NO_OP_DIRECTIVES = [
      "fastrom",
      "dpbase",
      "warnings",
      "print",
      "warn",
      "autoclean",
      "autoclear",
      "includefrom",
      "asar",
      "reset",
      "{",
      "}"
    ];
    assertMapperAvailable = (inSpcblock) => {
      if (inSpcblock) {
        throw new Error("Mapper directives are unavailable inside spcblock.");
      }
    };
    applyMapperSelection = (state, mapper) => {
      state.mapper = mapper;
      if (mapper === "norom") {
        state.checksumEnabled = false;
      }
    };
    isFreespaceAvailable = (mapper) => mapper !== "norom";
    encodeSuperFxMoveShortAddress = (addrVal, mode3 = "hardware") => {
      if (mode3 === "asar") {
        return addrVal & 255;
      }
      return addrVal >> 1 & 255;
    };
    getChecksumHeaderOffset = (mapper) => {
      if (mapper === "lorom" || mapper === "sa1rom" || mapper === "bigsa1rom") {
        return 32704;
      }
      return 65472;
    };
    calculateHeaderChecksum = (romdata, mode3) => {
      const romLength = romdata.length;
      if (romLength === 0) {
        return 0;
      }
      let checksum = 0;
      if (mode3 === "simple" || (romLength & romLength - 1) === 0) {
        for (let i = 0; i < romLength; i++) {
          checksum += romdata[i] & 255;
        }
        return checksum & 65535;
      }
      let bitround = 1;
      while (bitround < romLength) {
        bitround <<= 1;
      }
      const firstPart = bitround >> 1;
      const secondPart = romLength - firstPart;
      const repeatCount = Math.floor(firstPart / secondPart);
      let secondPartSum = 0;
      for (let i = 0; i < firstPart; i++) {
        checksum += romdata[i] & 255;
      }
      for (let i = firstPart; i < romLength; i++) {
        secondPartSum += romdata[i] & 255;
      }
      return checksum + secondPartSum * repeatCount & 65535;
    };
    shouldRedirectOrgToSpcblock = (spcInlineCompatMode) => spcInlineCompatMode;
    shouldEnableSpcInlineCompat = (architecture) => architecture === "spc700-inline";
    shouldUseNoromAddressing = (architecture) => architecture === "spc700-raw";
    shouldAutoCloseSpcblock = (spcInlineCompatMode, inSpcblock) => spcInlineCompatMode && inSpcblock;
    shouldEndifCloseInnermostWhile = (currentLoopType, currentLoopStartLine, currentIfStartLine) => currentLoopType === "while" && (currentIfStartLine === void 0 || (currentLoopStartLine ?? -1) >= currentIfStartLine);
  }
});

// packages/plugin-snes/src/architectures/superfx.ts
var lowerSuperFxOperand, hasOwn2, ALT1, ALT2, ALT3, IMPLIED_OPCODES, PREFIXED_OPCODES, SHORT_BRANCH_OPCODES, REGISTER_OPS, IMMEDIATE_OPS, INDIRECT_OPS, encodedOpSize, fitsSignedByte, isShortRamAddress, ArchSuperFX;
var init_superfx = __esm({
  "packages/plugin-snes/src/architectures/superfx.ts"() {
    "use strict";
    init_src();
    init_compatibility();
    init_instruction_catalog2();
    init_operand_classifiers();
    lowerSuperFxOperand = (resolver, operand) => {
      const lowered = resolver.lowerOperand(operand);
      return lowered.mode !== "unknown" ? lowered : classifyGenericOperand(lowered);
    };
    hasOwn2 = (obj, key) => Object.hasOwn(obj, key);
    ALT1 = 61;
    ALT2 = 62;
    ALT3 = 63;
    IMPLIED_OPCODES = {
      STOP: 0,
      NOP: 1,
      CACHE: 2,
      LSR: 3,
      ROL: 4,
      LOOP: 60,
      ALT1,
      ALT2,
      ALT3,
      PLOT: 76,
      SWAP: 77,
      COLOR: 78,
      NOT: 79,
      MERGE: 112,
      SBK: 144,
      SEX: 149,
      ASR: 150,
      ROR: 151,
      LOB: 158,
      FMULT: 159,
      HIB: 192,
      GETC: 223,
      GETB: 239
    };
    PREFIXED_OPCODES = {
      RPIX: { prefix: ALT1, opcode: 76 },
      CMODE: { prefix: ALT1, opcode: 78 },
      DIV2: { prefix: ALT1, opcode: 150 },
      LMULT: { prefix: ALT1, opcode: 159 },
      GETBH: { prefix: ALT1, opcode: 239 },
      RAMB: { prefix: ALT2, opcode: 223 },
      GETBL: { prefix: ALT2, opcode: 239 },
      ROMB: { prefix: ALT3, opcode: 223 },
      GETBS: { prefix: ALT3, opcode: 239 }
    };
    SHORT_BRANCH_OPCODES = {
      BRA: 5,
      BGE: 6,
      BLT: 7,
      BNE: 8,
      BEQ: 9,
      BPL: 10,
      BMI: 11,
      BCC: 12,
      BCS: 13,
      BVC: 14,
      BVS: 15
    };
    REGISTER_OPS = {
      TO: { base: 16 },
      WITH: { base: 32 },
      ADD: { base: 80 },
      SUB: { base: 96 },
      AND: { base: 112, min: 1, max: 15 },
      MULT: { base: 128 },
      JMP: { base: 144, min: 8, max: 13 },
      FROM: { base: 176 },
      OR: { base: 192, min: 1, max: 15 },
      INC: { base: 208, min: 0, max: 14 },
      DEC: { base: 224, min: 0, max: 14 },
      ADC: { prefix: ALT1, base: 80 },
      SBC: { prefix: ALT1, base: 96 },
      BIC: { prefix: ALT1, base: 112, min: 1, max: 15 },
      UMULT: { prefix: ALT1, base: 128 },
      LJMP: { prefix: ALT1, base: 144, min: 8, max: 13 },
      XOR: { prefix: ALT1, base: 192, min: 1, max: 15 },
      CMP: { prefix: ALT3, base: 96 }
    };
    IMMEDIATE_OPS = {
      LINK: { base: 144, min: 1, max: 4 },
      ADD: { prefix: ALT2, base: 80 },
      SUB: { prefix: ALT2, base: 96 },
      AND: { prefix: ALT2, base: 112, min: 1, max: 15 },
      MULT: { prefix: ALT2, base: 128 },
      OR: { prefix: ALT2, base: 192, min: 1, max: 15 },
      ADC: { prefix: ALT3, base: 80 },
      BIC: { prefix: ALT3, base: 112, min: 1, max: 15 },
      UMULT: { prefix: ALT3, base: 128 },
      XOR: { prefix: ALT3, base: 192, min: 1, max: 15 }
    };
    INDIRECT_OPS = {
      STW: { base: 48, min: 0, max: 11 },
      LDW: { base: 64, min: 0, max: 11 },
      STB: { prefix: ALT1, base: 48, min: 0, max: 11 },
      LDB: { prefix: ALT1, base: 64, min: 0, max: 11 }
    };
    encodedOpSize = (encoding) => {
      if (encoding.prefix === void 0) {
        return 1;
      }
      return 2;
    };
    fitsSignedByte = (value) => {
      const imm = value & 65535;
      return imm < 128 || imm >= 65408;
    };
    isShortRamAddress = (addrVal) => (addrVal & 1) === 0 && addrVal < 512;
    ArchSuperFX = class {
      /**
       * @param {ArchitectureEncoderContext} context Encoder host.
       * @param {() => boolean} asarMoveShortAddress Session flag for **auto-MOVE** short RAM only.
       *   Hardware stores a word index (`addr >> 1`); Asar stores `addr & 0xff`. Explicit
       *   `LMS`/`SMS` always encode `addr >> 1` and ignore this flag. Default is hardware.
       */
      constructor(context, asarMoveShortAddress = () => false) {
        this.asarMoveShortAddress = asarMoveShortAddress;
        this.assembler = createEncoderRuntime(context);
      }
      asarMoveShortAddress;
      assembler;
      /**
       * Returns the static Super FX instruction catalog for editor tooling.
       * @returns {InstructionDescriptor[]} The instruction descriptors.
       */
      getInstructionCatalog() {
        return superFxCatalog;
      }
      /**
       * Estimates instruction size from a lowered instruction.
       * @param {LoweredInstruction} instruction The instruction.
       * @returns {number} Encoded size in bytes.
       */
      estimateInstruction(instruction) {
        const loweredOperands = instruction.loweredOperands ?? [];
        return this.estimateResolvedInstruction(
          instruction.mnemonic,
          instruction.operands,
          instruction.loweredOperand,
          loweredOperands
        );
      }
      /**
       * Encodes a lowered instruction.
       * @param {LoweredInstruction} instruction The instruction.
       * @returns {boolean} True if the instruction was encoded.
       */
      encodeInstruction(instruction) {
        const loweredOperands = instruction.loweredOperands ?? [];
        return this.encodeResolvedInstruction(
          instruction.mnemonic,
          instruction.operands,
          instruction.loweredOperand,
          loweredOperands
        );
      }
      /**
       * Estimates size from tokenized words.
       * @param {string[]} words The words.
       * @returns {number} Encoded size in bytes.
       */
      estimateSize(words) {
        if (words.length === 0) {
          return 0;
        }
        const { opcode, operands, rawOperand } = this.parseInstructionWords(words);
        const loweredOperand = lowerSuperFxOperand(this.assembler.operandResolver, rawOperand);
        const loweredOperands = operands.map(
          (operand) => lowerSuperFxOperand(this.assembler.operandResolver, operand)
        );
        return this.estimateResolvedInstruction(opcode, operands, loweredOperand, loweredOperands);
      }
      /**
       * Estimates encoded size. Must match {@link encodeResolvedInstruction} byte counts
       * so layout `step()` stays in sync with emit.
       * @param {string} mnemonic The mnemonic.
       * @param {string[]} operands The operands.
       * @param {LoweredOperand} [loweredOperand] The combined lowered operand.
       * @param {LoweredOperand[]} [loweredOperands] Per-operand lowered metadata.
       * @returns {number} Encoded size in bytes.
       */
      estimateResolvedInstruction(mnemonic, operands, loweredOperand, loweredOperands = []) {
        const opcode = mnemonic.toUpperCase();
        if (hasOwn2(IMPLIED_OPCODES, opcode)) {
          return 1;
        }
        if (hasOwn2(PREFIXED_OPCODES, opcode)) {
          return 2;
        }
        const firstLowered = loweredOperands[0] ?? loweredOperand;
        const secondLowered = loweredOperands[1];
        const leftOp = firstLowered?.expanded ?? operands[0] ?? "";
        const rightOp = secondLowered?.expanded ?? operands[1] ?? "";
        if (operands.length <= 1 && hasOwn2(SHORT_BRANCH_OPCODES, opcode)) {
          return 2;
        }
        if (operands.length <= 1) {
          const regR = this.resolveRegister(leftOp, firstLowered, "r");
          if (regR !== null && hasOwn2(REGISTER_OPS, opcode)) {
            return encodedOpSize(REGISTER_OPS[opcode]);
          }
          const regHash = this.resolveRegister(leftOp, firstLowered, "hash");
          if (regHash !== null && hasOwn2(IMMEDIATE_OPS, opcode)) {
            return encodedOpSize(IMMEDIATE_OPS[opcode]);
          }
          const regParr = this.resolveRegister(leftOp, firstLowered, "parr");
          if (regParr !== null && hasOwn2(INDIRECT_OPS, opcode)) {
            return encodedOpSize(INDIRECT_OPS[opcode]);
          }
          return 1;
        }
        if (operands.length !== 2) {
          return 1;
        }
        const reg1r = this.resolveRegister(leftOp, firstLowered, "r");
        const reg1parr = this.resolveRegister(leftOp, firstLowered, "parr");
        const reg2r = this.resolveRegister(rightOp, secondLowered, "r");
        const reg2parr = this.resolveRegister(rightOp, secondLowered, "parr");
        if (reg1r !== null && reg2r !== null) {
          if (opcode === "MOVE" || opcode === "MOVES") {
            return 2;
          }
        }
        if (reg1r !== null && (secondLowered?.immediate ?? rightOp.startsWith("#"))) {
          if (opcode === "IBT") {
            return 2;
          }
          if (opcode === "IWT") {
            return 3;
          }
          if (opcode === "MOVE") {
            const immediateExpression = secondLowered?.baseExpression ?? rightOp.slice(1);
            const immVal = this.tryGetNumber(immediateExpression);
            if (immVal !== void 0 && fitsSignedByte(immVal)) {
              return 2;
            }
            return 3;
          }
        }
        if (reg1parr !== null && reg2r !== null) {
          if (opcode === "MOVEB") {
            return reg1parr === 0 ? 2 : 3;
          }
          if (opcode === "MOVEW") {
            return reg1parr === 0 ? 1 : 2;
          }
        }
        if (reg1r !== null && reg2parr !== null) {
          if (opcode === "MOVEB") {
            return reg1r === 0 ? 2 : 3;
          }
          if (opcode === "MOVEW") {
            return reg1r === 0 ? 1 : 2;
          }
        }
        if (reg1r !== null) {
          if (opcode === "LM") {
            return 4;
          }
          if (opcode === "LMS") {
            return 3;
          }
          if (opcode === "LEA") {
            return 3;
          }
          if (opcode === "MOVE") {
            const addressExpression = secondLowered?.baseExpression ?? rightOp;
            const addrVal = this.tryGetNumber(addressExpression);
            if (addrVal !== void 0 && isShortRamAddress(addrVal)) {
              return 3;
            }
            return 4;
          }
        }
        const leftIsRegisterIndirect = firstLowered?.mode === "registerIndirect";
        if (reg2r !== null && !leftIsRegisterIndirect && (firstLowered?.indirect ?? (leftOp.startsWith("(") && leftOp.endsWith(")")))) {
          if (opcode === "SM") {
            return 4;
          }
          if (opcode === "SMS") {
            return 3;
          }
          if (opcode === "MOVE") {
            const addressExpression = firstLowered?.baseExpression ?? leftOp;
            const addrVal = this.tryGetNumber(addressExpression);
            if (addrVal !== void 0 && isShortRamAddress(addrVal)) {
              return 3;
            }
            return 4;
          }
        }
        return 1;
      }
      /**
       * Processes a SuperFX assembly instruction.
       * @param {string[]} words The tokenized instruction.
       * @returns {boolean} True if the instruction was handled, false otherwise.
       */
      encode(words) {
        if (words.length === 0) {
          return false;
        }
        const { opcode, operands, rawOperand } = this.parseInstructionWords(words);
        const loweredOperand = lowerSuperFxOperand(this.assembler.operandResolver, rawOperand);
        const loweredOperands = operands.map(
          (operand) => lowerSuperFxOperand(this.assembler.operandResolver, operand)
        );
        return this.encodeResolvedInstruction(opcode, operands, loweredOperand, loweredOperands);
      }
      /**
       * Encodes a resolved Super FX mnemonic. Implied/prefixed ops reject extra
       * operands; unknown mnemonics return false (`unknownInstructionBehavior` is
       * `returnFalse` so 65816 can try next).
       *
       * @param {string} mnemonic The mnemonic.
       * @param {string[]} operands Split operands.
       * @param {LoweredOperand} [loweredOperand] Combined lowered operand.
       * @param {LoweredOperand[]} [loweredOperands] Per-operand lowered metadata.
       * @returns {boolean} True if the instruction was encoded.
       */
      encodeResolvedInstruction(mnemonic, operands, loweredOperand, loweredOperands = []) {
        const opcode = mnemonic.toUpperCase();
        const firstLowered = loweredOperands[0] ?? loweredOperand;
        const secondLowered = loweredOperands[1];
        const operand = firstLowered?.expanded ?? "";
        const operandLength = firstLowered?.length ?? this.getOperandLength(operand);
        if (hasOwn2(IMPLIED_OPCODES, opcode) || hasOwn2(PREFIXED_OPCODES, opcode)) {
          if (operands.length !== 0) {
            throw this.assembler.diagnostics.error(`${opcode} does not take operands`);
          }
          return this.handleSingleWordOpcode(opcode);
        }
        if (operands.length === 1) {
          return this.handleOneOperandOpcode(opcode, operand, operandLength, firstLowered);
        }
        if (operands.length === 2) {
          return this.handleTwoOperandOpcode(
            opcode,
            firstLowered?.expanded ?? operands[0],
            secondLowered?.expanded ?? operands[1],
            firstLowered,
            secondLowered
          );
        }
        return false;
      }
      /**
       * Handles implied SuperFX opcodes with no operands (STOP, NOP, ALT1, ...) and
       * two-byte prefixed ops (PLOT, SWAP, ...) from PREFIXED_OPCODES.
       * @param {string} opcode Uppercased mnemonic.
       * @returns {boolean} True if the instruction was handled, false otherwise.
       */
      handleSingleWordOpcode(opcode) {
        if (hasOwn2(IMPLIED_OPCODES, opcode)) {
          this.assembler.write1(IMPLIED_OPCODES[opcode]);
          return true;
        }
        if (hasOwn2(PREFIXED_OPCODES, opcode)) {
          const command = PREFIXED_OPCODES[opcode];
          this.assembler.write1(command.prefix);
          this.assembler.write1(command.opcode);
          return true;
        }
        return false;
      }
      /**
       * Single-operand Super FX: short branches (`$XX` is a raw offset; labels stay
       * PC-relative), then register / `#0`–`#15` / `(Rn)` ops.
       * @param {string} opcode Uppercased mnemonic.
       * @param {string} operand The operand.
       * @param {number} operandLength Logged only; encoded size is fixed per opcode family.
       * @param {LoweredOperand} [loweredOperand] Lowered operand metadata.
       * @returns {boolean} True if the instruction was handled, false otherwise.
       */
      handleOneOperandOpcode(opcode, operand, operandLength, loweredOperand) {
        if (hasOwn2(SHORT_BRANCH_OPCODES, opcode)) {
          const branchOpcode = SHORT_BRANCH_OPCODES[opcode];
          const sourceSpelling = (loweredOperand?.raw ?? operand).trim();
          const val = this.assembler.operandResolver.getnum(operand);
          if (this.isRawBranchOffset(sourceSpelling)) {
            this.assembler.write1(branchOpcode);
            this.assembler.write1(val & 255);
            return true;
          }
          const pc = this.assembler.currentTargetAddress & 16777215;
          const offset = val - (pc + 2);
          if (this.assembler.enforceResolvedLabels && (offset < -128 || offset > 127)) {
            throw this.assembler.diagnostics.error(`Branch target out of range (${offset})`);
          }
          this.assembler.write1(branchOpcode);
          this.assembler.write1(offset & 255);
          return true;
        }
        const regR = this.resolveRegister(operand, loweredOperand, "r");
        const regHash = this.resolveRegister(operand, loweredOperand, "hash");
        const regParr = this.resolveRegister(operand, loweredOperand, "parr");
        if (regR !== null && hasOwn2(REGISTER_OPS, opcode)) {
          this.writeRegisterOp(REGISTER_OPS[opcode], regR);
          return true;
        }
        if (regHash !== null && hasOwn2(IMMEDIATE_OPS, opcode)) {
          this.writeRegisterOp(IMMEDIATE_OPS[opcode], regHash);
          return true;
        }
        if (regParr !== null && hasOwn2(INDIRECT_OPS, opcode)) {
          this.writeRegisterOp(INDIRECT_OPS[opcode], regParr);
          return true;
        }
        return false;
      }
      /**
       * Two-operand Super FX: MOVE/MOVES register pairs, IBT/IWT/`MOVE Rn,#imm`
       * (signed-byte → IBT), MOVEB/MOVEW via `(Rn)`, then LM/LMS/LEA/SM/SMS and
       * auto-MOVE RAM. `(R0)` omits TO/FROM because B/D already default to R0.
       *
       * Explicit `LMS`/`SMS` always store `addr >> 1`. Auto-`MOVE` short form uses
       * {@link moveShortAddressByte} (honors Asar compat). LEA is IWT-shaped: no ALT1.
       *
       * @param {string} opcode Uppercased mnemonic.
       * @param {string} leftOp Left operand.
       * @param {string} rightOp Right operand.
       * @param {LoweredOperand} [leftLowered] Lowered left operand.
       * @param {LoweredOperand} [rightLowered] Lowered right operand.
       * @returns {boolean} True if encoded.
       */
      handleTwoOperandOpcode(opcode, leftOp, rightOp, leftLowered, rightLowered) {
        const reg1r = this.resolveRegister(leftOp, leftLowered, "r");
        const reg1parr = this.resolveRegister(leftOp, leftLowered, "parr");
        const reg2r = this.resolveRegister(rightOp, rightLowered, "r");
        const reg2parr = this.resolveRegister(rightOp, rightLowered, "parr");
        if (reg1r !== null && reg2r !== null) {
          switch (opcode) {
            case "MOVE":
              this.assembler.write1(32 + reg2r);
              this.assembler.write1(16 + reg1r);
              return true;
            case "MOVES":
              this.assembler.write1(32 + reg1r);
              this.assembler.write1(176 + reg2r);
              return true;
          }
        }
        if (reg1r !== null && (rightLowered?.immediate ?? rightOp.startsWith("#"))) {
          const immediateExpression = rightLowered?.baseExpression ?? rightOp.slice(1);
          const immVal = this.assembler.operandResolver.getnum(immediateExpression) & 65535;
          switch (opcode) {
            case "IBT":
              this.assembler.write1(160 + reg1r);
              this.assembler.write1(immVal & 255);
              return true;
            case "IWT":
              this.assembler.write1(240 + reg1r);
              this.assembler.write1(immVal & 255);
              this.assembler.write1(immVal >> 8 & 255);
              return true;
            case "MOVE":
              if (fitsSignedByte(immVal)) {
                this.assembler.write1(160 + reg1r);
                this.assembler.write1(immVal & 255);
              } else {
                this.assembler.write1(240 + reg1r);
                this.assembler.write1(immVal & 255);
                this.assembler.write1(immVal >> 8 & 255);
              }
              return true;
          }
        }
        if (reg1parr !== null && reg2r !== null) {
          switch (opcode) {
            case "MOVEB":
              this.rangeCheck(0, reg2r, 11);
              if (reg1parr === 0) {
                this.assembler.write1(ALT1);
                this.assembler.write1(48 + reg2r);
              } else {
                this.assembler.write1(176 + reg1parr);
                this.assembler.write1(ALT1);
                this.assembler.write1(48 + reg2r);
              }
              return true;
            case "MOVEW":
              this.rangeCheck(0, reg2r, 11);
              if (reg1parr === 0) {
                this.assembler.write1(48 + reg2r);
              } else {
                this.assembler.write1(176 + reg1parr);
                this.assembler.write1(48 + reg2r);
              }
              return true;
          }
        }
        if (reg1r !== null && reg2parr !== null) {
          switch (opcode) {
            case "MOVEB":
              this.rangeCheck(0, reg2parr, 11);
              if (reg1r === 0) {
                this.assembler.write1(ALT1);
                this.assembler.write1(64 + reg2parr);
              } else {
                this.assembler.write1(16 + reg1r);
                this.assembler.write1(ALT1);
                this.assembler.write1(64 + reg2parr);
              }
              return true;
            case "MOVEW":
              this.rangeCheck(0, reg2parr, 11);
              if (reg1r === 0) {
                this.assembler.write1(64 + reg2parr);
              } else {
                this.assembler.write1(16 + reg1r);
                this.assembler.write1(64 + reg2parr);
              }
              return true;
          }
        }
        if (reg1r !== null) {
          const addressExpression = rightLowered?.baseExpression ?? rightOp;
          const addrVal = this.assembler.operandResolver.getnum(addressExpression);
          switch (opcode) {
            case "LM":
              this.assembler.write1(ALT1);
              this.assembler.write1(240 + reg1r);
              this.assembler.write2(addrVal);
              return true;
            case "LMS":
              this.checkShortAddr(addrVal);
              this.assembler.write1(ALT1);
              this.assembler.write1(160 + reg1r);
              this.assembler.write1(addrVal >> 1);
              return true;
            case "MOVE":
              if (isShortRamAddress(addrVal)) {
                this.assembler.write1(ALT1);
                this.assembler.write1(160 + reg1r);
                this.assembler.write1(this.moveShortAddressByte(addrVal));
              } else {
                this.assembler.write1(ALT1);
                this.assembler.write1(240 + reg1r);
                this.assembler.write2(addrVal);
              }
              return true;
            case "LEA":
              this.assembler.write1(240 + reg1r);
              this.assembler.write1(addrVal & 255);
              this.assembler.write1(addrVal >> 8 & 255);
              return true;
          }
        }
        const leftIsRegisterIndirect = leftLowered?.mode === "registerIndirect";
        if (reg2r !== null && !leftIsRegisterIndirect && (leftLowered?.indirect ?? (leftOp.startsWith("(") && leftOp.endsWith(")")))) {
          const addressExpression = leftLowered?.baseExpression ?? leftOp;
          const addrVal = this.assembler.operandResolver.getnum(addressExpression);
          switch (opcode) {
            case "SM":
              this.assembler.write1(ALT2);
              this.assembler.write1(240 + reg2r);
              this.assembler.write2(addrVal);
              return true;
            case "SMS":
              this.checkShortAddr(addrVal);
              this.assembler.write1(ALT2);
              this.assembler.write1(160 + reg2r);
              this.assembler.write1(addrVal >> 1);
              return true;
            case "MOVE":
              if (isShortRamAddress(addrVal)) {
                this.assembler.write1(ALT2);
                this.assembler.write1(160 + reg2r);
                this.assembler.write1(this.moveShortAddressByte(addrVal));
              } else {
                this.assembler.write1(ALT2);
                this.assembler.write1(240 + reg2r);
                this.assembler.write2(addrVal);
              }
              return true;
          }
        }
        return false;
      }
      /**
       * Resolves a SuperFX register operand.
       * @param {string} str The operand text.
       * @param {LoweredOperand | undefined} lowered The lowered operand.
       * @param {"r" | "parr" | "hash"} type Direct (`rN`), indirect (`(rN)`), or `#n`.
       * @returns {number | null} Register number 0-15, or null if it doesn't match.
       */
      resolveRegister(str, lowered, type) {
        if (lowered) {
          if (type === "r" && lowered.mode === "register" && lowered.registerName?.toLowerCase().startsWith("r")) {
            const regnum = this.parseRegisterNumber(lowered.registerName.slice(1));
            return regnum === -1 ? null : regnum;
          }
          if (type === "parr" && lowered.mode === "registerIndirect" && lowered.registerName?.toLowerCase().startsWith("r")) {
            const regnum = this.parseRegisterNumber(lowered.registerName.slice(1));
            return regnum === -1 ? null : regnum;
          }
          if (type === "hash" && lowered.immediate) {
            const regnum = this.assembler.operandResolver.getnum(
              lowered.baseExpression ?? lowered.expanded.slice(1)
            );
            if (Number.isNaN(regnum) || regnum < 0 || regnum > 15) {
              return null;
            }
            return regnum;
          }
        }
        return this.getRegister(str, type);
      }
      /**
       * Attempts to parse a register from a string, e.g. "r0", "(r3)", "#3".
       * @param {string} str The operand string.
       * @param {"r" | "parr" | "hash"} type The type of register.
       * @returns {number | null} The register number or null if it doesn't match.
       */
      getRegister(str, type) {
        if (type === "parr") {
          if (!str.startsWith("(")) {
            return null;
          }
          str = str.slice(1);
          if (!/^r\d{1,2}\)/i.test(str)) {
            return null;
          }
          if (str[0].toLowerCase() !== "r") {
            return null;
          }
          str = str.slice(1);
          const regnum = this.parseRegisterNumber(str.replace(/\)$/, ""));
          if (regnum === -1) {
            return null;
          }
          return regnum;
        }
        if (type === "r") {
          if (!str.toLowerCase().startsWith("r")) {
            return null;
          }
          const regnum = this.parseRegisterNumber(str.slice(1));
          if (regnum === -1) {
            return null;
          }
          return regnum;
        }
        if (type === "hash") {
          if (!str.startsWith("#")) {
            return null;
          }
          const regnum = this.assembler.operandResolver.getnum(str.slice(1));
          if (Number.isNaN(regnum) || regnum < 0 || regnum > 15) {
            return null;
          }
          return regnum;
        }
        return null;
      }
      /**
       * Parses the register number. E.g. '5', '10', '15'. Returns -1 if invalid.
       * @param {string} str The string to parse.
       * @returns {number} The register number.
       */
      parseRegisterNumber(str) {
        const match = str.match(/^\d{1,2}$/);
        if (!match) {
          return -1;
        }
        const value = parseInt(str, 10);
        if (value < 0 || value > 15) {
          return -1;
        }
        return value;
      }
      /**
       * Raises an error if `mid < min` or `mid > max`.
       * @param {number} min The minimum value.
       * @param {number} mid The middle value.
       * @param {number} max Inclusive maximum.
       * @returns {void}
       * @throws {Error} If `mid` is outside `[min, max]`.
       */
      rangeCheck(min, mid, max) {
        if (mid < min || mid > max) {
          throw this.assembler.diagnostics.error(`Register out of valid range ${min}-${max}: ${mid}`);
        }
      }
      /**
       * LMS/SMS require an even RAM byte address in `[0x000..0x1FE]`. Throws otherwise.
       * Encode then stores `addr >> 1`; this check is the byte-address constraint.
       * @param {number} num RAM byte address (not the word index).
       * @returns {boolean} Always `true` when the address is valid.
       * @throws {Error} If the address is odd or outside the short-RAM window.
       */
      checkShortAddr(num) {
        if (num % 2 !== 0 || num < 0 || num > 510) {
          throw this.assembler.diagnostics.error(
            `Invalid short address ${num}. Must be even and in range 0..0x1FE`
          );
        }
        return true;
      }
      /**
       * True when the source spelling is an explicit 2-digit hex branch offset (`$XX`).
       * Expanded label values that happen to fit in a byte must not use this path.
       * @param {string} operand The raw or expanded operand.
       * @returns {boolean} True if the operand is a raw 8-bit offset spelling.
       */
      isRawBranchOffset(operand) {
        return /^\$[\dA-Fa-f]{2}$/.test(operand.trim());
      }
      /**
       * Fallback width when lowering did not supply `length`. `$XX` is 1; everything else is 2.
       * Super FX uses this for one-operand branches when `loweredOperand` is missing.
       * @param {string} operand Operand text.
       * @returns {number} 1 for an explicit `$XX` spelling, otherwise 2.
       */
      getOperandLength(operand) {
        if (this.isRawBranchOffset(operand)) {
          return 1;
        }
        return 2;
      }
      /**
       * Splits tokenized words into opcode plus comma-separated operands.
       * @param {string[]} words The tokenized instruction.
       * @returns {{ opcode: string; operands: string[]; rawOperand: string }} Parsed parts.
       */
      parseInstructionWords(words) {
        const opcode = words[0];
        const rawOperand = words.length > 1 ? words.slice(1).join(" ") : "";
        const operands = rawOperand ? rawOperand.split(",").map((operand) => operand.trim()) : [];
        return { opcode, operands, rawOperand };
      }
      /**
       * Writes optional ALT prefix then `base + register`. AND/OR/BIC/XOR reject R0
       * (those encodings are MERGE/HIB).
       *
       * @param {RegisterOpEncoding} encoding Table entry (prefix, base, optional min/max).
       * @param {number} register Register number 0–15.
       * @returns {void}
       */
      writeRegisterOp(encoding, register4) {
        if (encoding.min !== void 0 && encoding.max !== void 0) {
          this.rangeCheck(encoding.min, register4, encoding.max);
        }
        if (encoding.prefix !== void 0) {
          this.assembler.write1(encoding.prefix);
        }
        this.assembler.write1(encoding.base + register4);
      }
      /**
       * Encodes the short-RAM operand byte for **auto-MOVE** only (`MOVE Rn,(addr)` /
       * `MOVE (addr),Rn`). Explicit LMS/SMS call `addr >> 1` directly and skip this.
       * @param {number} addrVal Even RAM byte address below `$200`.
       * @returns {number} Hardware word index, or Asar's raw byte when compat is enabled.
       */
      moveShortAddressByte(addrVal) {
        let mode3 = "hardware";
        if (this.asarMoveShortAddress()) {
          mode3 = "asar";
        }
        return encodeSuperFxMoveShortAddress(addrVal, mode3);
      }
      /**
       * Resolves a numeric operand for sizing without failing layout on forward refs.
       * @param {string} expression The expression.
       * @returns {number | undefined} The value, or undefined if it cannot be resolved yet.
       */
      tryGetNumber(expression) {
        try {
          const value = this.assembler.operandResolver.getnum(expression);
          if (Number.isNaN(value)) {
            return void 0;
          }
          return value;
        } catch {
          return void 0;
        }
      }
    };
  }
});

// packages/plugin-snes/src/directives/ca65-compat.ts
function getActiveArch65816(session) {
  const { definition } = session.resolveActiveArchitecture();
  if (definition?.encoder instanceof Arch65816) {
    return definition.encoder;
  }
  return void 0;
}
function handleA8(session) {
  getActiveArch65816(session)?.setAccumulatorWidth(false);
}
function handleA16(session) {
  getActiveArch65816(session)?.setAccumulatorWidth(true);
}
function handleAccu(session, words) {
  const widthToken = words[1]?.trim();
  if (widthToken === "8") {
    handleA8(session);
  } else if (widthToken === "16") {
    handleA16(session);
  } else {
    throw new Error(`.accu requires an argument of 8 or 16, got: ${widthToken ?? "<none>"}`);
  }
}
function handleI8(session) {
  getActiveArch65816(session)?.setIndexWidth(false);
}
function handleI16(session) {
  getActiveArch65816(session)?.setIndexWidth(true);
}
function handleIndex(session, words) {
  const widthToken = words[1]?.trim();
  if (widthToken === "8") {
    handleI8(session);
  } else if (widthToken === "16") {
    handleI16(session);
  } else {
    throw new Error(`.index requires an argument of 8 or 16, got: ${widthToken ?? "<none>"}`);
  }
}
function handleSmart(session, words) {
  const arg = words[1]?.trim().toLowerCase();
  const enabled = arg !== "off";
  getActiveArch65816(session)?.setSmartMode(enabled);
}
function resolveSnesCpuName(name) {
  switch (name.toLowerCase()) {
    case "65816":
    case "65c816":
    case "65802":
      return "snes.65816";
    case "spc700":
      return "snes.spc700";
    case "superfx":
      return "snes.superfx";
    default:
      return void 0;
  }
}
function handleSetcpu(session, words) {
  if (!words[1]) {
    throw new Error(".setcpu requires a CPU name argument.");
  }
  const raw = words[1].trim().replace(/^["']|["']$/g, "");
  const archId = resolveSnesCpuName(raw);
  if (!archId) {
    throw new Error(
      `.setcpu "${raw}" is not available on the SNES target. Supported names: 65816, 65C816, 65802, spc700, superfx.`
    );
  }
  session.selectArchitecture(archId, raw.toLowerCase());
}
function handlePushcpu(session, state) {
  const { name } = session.resolveActiveArchitecture();
  state.cpuStack.push(name);
}
function handlePopcpu(session, state) {
  if (state.cpuStack.length === 0) {
    throw new Error(".popcpu: CPU stack is empty.");
  }
  const archId = state.cpuStack.pop();
  session.selectArchitecture(archId, archId);
}
var init_ca65_compat = __esm({
  "packages/plugin-snes/src/directives/ca65-compat.ts"() {
    "use strict";
    init__();
  }
});

// packages/plugin-snes/src/directives/freespace.ts
function handleFreespace(session, state, words) {
  if (state.inSpcBlock) {
    throw new Error(`${words[0]} is unavailable inside spcblock.`);
  }
  if (!isFreespaceAvailable(state.mapper)) {
    throw new Error("No freespace available in norom.");
  }
  const sourceLength = session.baseImage.length > 0 ? session.baseImage.length : session.outputBytes.length;
  const startOffset = Math.max(524288, sourceLength);
  if (session.outputBytes.length < 1048576) {
    session.expandOutput(1048576, state.outputFillByte);
  }
  const startAddress = session.outputWriter.fromOutputOffset(startOffset);
  if (startAddress < 0) {
    throw new Error("Unable to map freespace start to a logical address.");
  }
  session.currentTargetAddress = startAddress;
  session.currentTargetBaseAddress = startAddress;
  session.currentTargetStartAddress = startAddress;
  session.currentTargetBaseStartAddress = startAddress;
  state.activeFreespaceStartOffset = startOffset;
  for (const value of [83, 84, 65, 82, 0, 0, 255, 255]) {
    session.write1(value);
  }
  state.activeFreespaceContentStartOffset = startOffset + 8;
}
function handleFreespaceByte(session, state, words) {
  if (words.length !== 2) {
    throw new Error("FREESPACEBYTE requires exactly one parameter.");
  }
  state.outputFillByte = session.operandResolver.getnum(session.resolvedefines(words[1])) & 255;
  session.outputFillByte = state.outputFillByte;
}
function handleProt(session, words) {
  const labels = words.slice(1).join(" ").split(",").map((label) => label.trim()).filter(Boolean);
  if (labels.length === 0) {
    throw new Error("PROT command requires at least one label parameter.");
  }
  for (const value of [80, 82, 79, 84, labels.length * 3 & 255]) {
    session.write1(value);
  }
  for (const label of labels) {
    let address4 = 0;
    try {
      address4 = session.symbolScope.getLabelValue(label, false) & 16777215;
    } catch {
      address4 = 0;
    }
    session.write3(address4);
  }
  for (const value of [83, 84, 79, 80, 0]) {
    session.write1(value);
  }
}
var init_freespace = __esm({
  "packages/plugin-snes/src/directives/freespace.ts"() {
    "use strict";
    init_compatibility();
  }
});

// packages/plugin-snes/src/directives/layout.ts
function handleMapper(state, words) {
  assertMapperAvailable(state.inSpcBlock);
  const keyword = words[0].toLowerCase();
  if (keyword !== "sa1rom") {
    applyMapperSelection(state, keyword === "fullsa1rom" ? "bigsa1rom" : keyword);
    return;
  }
  if (words.length > 1) {
    const parts = words[1].split(",");
    if (parts.length !== 4) {
      throw new Error("Invalid SA1ROM mapper specification. Expected 4 comma-separated values.");
    }
    state.sa1Banks = [];
    state.sa1Banks[0] = parseInt(parts[0], 10) << 20;
    state.sa1Banks[1] = parseInt(parts[1], 10) << 20;
    state.sa1Banks[4] = parseInt(parts[2], 10) << 20;
    state.sa1Banks[5] = parseInt(parts[3], 10) << 20;
  } else {
    state.sa1Banks = [];
    state.sa1Banks[0] = 0 << 20;
    state.sa1Banks[1] = 1 << 20;
    state.sa1Banks[4] = 2 << 20;
    state.sa1Banks[5] = 3 << 20;
  }
  applyMapperSelection(state, "sa1rom");
}
function handleCheck(state, words) {
  if (words.length >= 2 && words[1].toLowerCase() === "title") {
    state.readFunctionsEnabled = true;
    return;
  }
  if (words.length < 3 || words[1].toLowerCase() !== "bankcross") {
    throw new Error("Invalid CHECK command. Expected: check bankcross <on|off|half|full>");
  }
  const mode3 = words[2].toLowerCase();
  if (mode3 === "off") state.bankCrossMode = "off";
  else if (mode3 === "half") state.bankCrossMode = "half";
  else if (mode3 === "full" || mode3 === "on") state.bankCrossMode = "full";
  else throw new Error(`Invalid parameter for check bankcross: ${words[2]}`);
}
function handleOptimize(state, words) {
  if (words.length < 3 || words[1].toLowerCase() !== "dp") return;
  const mode3 = words[2].toLowerCase();
  if (mode3 === "none") state.optimizeDirectPage = false;
  else if (mode3 === "ram" || mode3 === "always") state.optimizeDirectPage = true;
}
function handleStartpos(session, state, words) {
  if (!state.inSpcBlock || !state.spcBlock) {
    throw new Error("startpos used without an active spcblock.");
  }
  if (words.length !== 2) {
    throw new Error("startpos requires exactly one parameter.");
  }
  state.spcBlock.executeAddress = session.operandResolver.getnum(session.resolvedefines(words[1])) & 65535;
}
var MAPPER_KEYWORDS;
var init_layout = __esm({
  "packages/plugin-snes/src/directives/layout.ts"() {
    "use strict";
    init_compatibility();
    MAPPER_KEYWORDS = [
      "lorom",
      "hirom",
      "exlorom",
      "exhirom",
      "sfxrom",
      "norom",
      "fullsa1rom",
      "sa1rom"
    ];
  }
});

// packages/plugin-snes/src/services/spc-runtime.ts
var SnesSpcRuntimeService;
var init_spc_runtime = __esm({
  "packages/plugin-snes/src/services/spc-runtime.ts"() {
    "use strict";
    init_compatibility();
    SnesSpcRuntimeService = class {
      constructor(session, state) {
        this.session = session;
        this.state = state;
      }
      session;
      state;
      /**
       * Closes an implicit inline-SPC block (`arch spc700-inline`), then errors if
       * a block is still open. Called from `onStageEnd`.
       */
      finishPass() {
        if (shouldAutoCloseSpcblock(this.state.spcInlineCompatibility, this.state.inSpcBlock)) {
          this.handleEndSpcblock(["endspcblock", "execute", "0"]);
        }
        if (this.state.inSpcBlock) {
          throw new Error("Missing endspcblock before end of pass.");
        }
      }
      /**
       * Opens an NSPC block: writes size/dest placeholders, retargets PC to the
       * 16-bit SPC destination, and switches architecture.
       *
       * `custom` with a macro name is recognized as Asar syntax but not implemented.
       *
       * @param {readonly string[]} words Tokenized line: `spcblock dest [nspc|custom [macro]]`.
       */
      handleSpcblock(words) {
        if (words.length < 2) throw new Error("spcblock requires at least a destination address.");
        if (words.length > 4) throw new Error("spcblock has too many arguments.");
        if (this.state.inSpcBlock) throw new Error("Nested spcblock directives are not supported.");
        const destination = this.session.operandResolver.getnum(this.session.resolvedefines(words[1]));
        if ((destination & ~65535) !== 0) {
          throw new Error(`spcblock destination must be 16-bit, got: ${words[1]}`);
        }
        let type = "nspc";
        if (words.length === 3) {
          const kind = words[2].toLowerCase();
          if (kind === "nspc") type = "nspc";
          else if (kind === "custom") {
            throw new Error("Custom spcblock mode requires a macro and is not implemented.");
          } else throw new Error(`Unknown spcblock type: ${words[2]}`);
        } else if (words.length === 4) {
          if (words[2].toLowerCase() !== "custom") {
            throw new Error(`Unexpected spcblock argument for type: ${words[2]}`);
          }
          throw new Error("Custom spcblock mode is not implemented.");
        }
        const sizeAddress = this.session.currentTargetBaseAddress;
        this.session.write2(0);
        this.session.write2(destination);
        this.session.currentTargetAddress = destination;
        this.session.currentTargetStartAddress = destination;
        this.state.spcBlock = {
          destination,
          type,
          sizeAddress,
          executeAddress: null,
          namespaceBackup: this.session.currentNamespace
        };
        this.session.currentNamespace = `:SPCBLOCK:_${this.session.currentNamespace}`;
        this.state.spcPreviousArchitecture = this.session.arch;
        this.state.inSpcBlock = true;
        this.session.selectArchitecture(
          "spc700",
          this.state.spcInlineCompatibility ? "spc700-inline" : "spc700"
        );
      }
      /**
       * Closes the open block: patches the NSPC size word, optionally writes an
       * execute trailer, then restores namespace and the previous architecture.
       *
       * Size is `(pc - dest) & $FFFF` - 64 KiB wrap, matching Asar.
       * Size is only patched when `canFinalize` (emit pass); collect/layout leave
       * the placeholder so later passes can rewrite it.
       *
       * Trailer priority: `endspcblock execute <addr>` > `startpos` > none.
       *
       * @param {readonly string[]} words Tokenized line.
       */
      handleEndSpcblock(words) {
        const block = this.state.spcBlock;
        if (!this.state.inSpcBlock || !block) {
          throw new Error("endspcblock used without an active spcblock.");
        }
        if (block.type !== "nspc") {
          throw new Error("Custom spcblock mode is not implemented.");
        }
        if (this.session.canFinalize) {
          const sizeOffset = this.session.outputWriter.toOutputOffset(block.sizeAddress & 16777215);
          if (sizeOffset < 0) throw new Error("spcblock size address does not map to output.");
          const blockSize = this.session.currentTargetAddress - block.destination & 65535;
          this.session.writeOutputBytes(sizeOffset, blockSize & 255, 1);
          this.session.writeOutputBytes(sizeOffset + 1, blockSize >> 8 & 255, 1);
        }
        if (words.length === 3) {
          if (words[1].toLowerCase() !== "execute") {
            throw new Error(`Invalid endspcblock argument: ${words[1]}`);
          }
          this.session.write2(0);
          this.session.write2(
            this.session.operandResolver.getnum(this.session.resolvedefines(words[2])) & 65535
          );
        } else if (words.length !== 1) {
          throw new Error("Unknown endspcblock format.");
        } else if (block.executeAddress !== null) {
          this.session.write2(0);
          this.session.write2(block.executeAddress & 65535);
        }
        this.session.currentNamespace = block.namespaceBackup;
        const previousArchitecture = this.state.spcPreviousArchitecture;
        this.state.spcBlock = null;
        this.state.spcPreviousArchitecture = null;
        this.state.inSpcBlock = false;
        if (previousArchitecture) {
          this.session.selectArchitecture(previousArchitecture, previousArchitecture);
        }
      }
    };
  }
});

// packages/plugin-snes/src/directives/spc.ts
var createSpcRuntime;
var init_spc = __esm({
  "packages/plugin-snes/src/directives/spc.ts"() {
    "use strict";
    init_spc_runtime();
    createSpcRuntime = (session, state) => new SnesSpcRuntimeService(session, state);
  }
});

// packages/plugin-snes/src/session-state.ts
function cloneSnesSessionState(value) {
  return {
    ...value,
    sa1Banks: [...value.sa1Banks],
    spcBlock: value.spcBlock ? { ...value.spcBlock } : null,
    cpuStack: [...value.cpuStack]
  };
}
var SNES_SESSION_STATE_ID, snesSessionStateKey;
var init_session_state2 = __esm({
  "packages/plugin-snes/src/session-state.ts"() {
    "use strict";
    SNES_SESSION_STATE_ID = "snes.session-state";
    snesSessionStateKey = {
      id: SNES_SESSION_STATE_ID
    };
  }
});

// packages/plugin-snes/src/target/address-space.ts
var snesRomAddressSpace;
var init_address_space = __esm({
  "packages/plugin-snes/src/target/address-space.ts"() {
    "use strict";
    snesRomAddressSpace = {
      name: "snes-rom",
      addressWidth: 24,
      defaultOrigin: 32768,
      unmappedWriteBehavior: "allow",
      normalizeForWrite(address4) {
        return address4 | 0;
      },
      advance(address4, amount, context) {
        const prefix = address4 & 4278190080;
        const logicalAddress = address4 & 16777215;
        const newAddress = logicalAddress + amount;
        if ((logicalAddress & 16711680) !== (newAddress & 16711680)) {
          const wrapOnBankCross = context.bankCrossCheckMode !== "full" && context.bankCrossCheckMode !== "half";
          switch (context.mapper) {
            case "lorom":
              if (wrapOnBankCross) {
                return prefix | newAddress & 16711680 | (newAddress & 65535) + 32768;
              }
              return prefix | newAddress;
            case "hirom":
            case "exhirom":
            case "sfxrom":
            case "sa1rom":
              if (wrapOnBankCross && (logicalAddress & 4194304) === 0) {
                return prefix | newAddress & 16711680 | (newAddress & 65535) + 32768;
              }
              return prefix | newAddress;
            case "exlorom":
            case "bigsa1rom": {
              if (!wrapOnBankCross) {
                return prefix | newAddress;
              }
              const offset = this.toOutputOffset(logicalAddress, context);
              const mapped = offset < 0 ? -1 : this.fromOutputOffset(offset + amount, context);
              return mapped < 0 ? -1 : prefix | mapped;
            }
            case "norom":
              return prefix | newAddress;
            default:
              throw new Error(`Unknown mapper type: ${context.mapper}`);
          }
        }
        return prefix | newAddress;
      },
      /**
       * CPU bus → ROM file offset. Returns `-1` for WRAM, SRAM, or unmapped holes.
       * Formulas match Asar's `snestopc` (not a hardware bus trace).
       *
       * @param {number} address The address to convert.
       * @param {AddressSpaceContext} context The address space context.
       * @returns {number} The output offset.
       */
      toOutputOffset(address4, context) {
        if (address4 < 0 || address4 > 16777215) return -1;
        if (context.mapper === "lorom") {
          if ((address4 & 16646144) === 8257536 || (address4 & 4227072) === 0 || (address4 & 7372800) === 7340032) {
            return -1;
          }
          return (address4 & 8323072) >> 1 | address4 & 32767;
        }
        if (context.mapper === "hirom") {
          if ((address4 & 16646144) === 8257536 || (address4 & 4227072) === 0) {
            return -1;
          }
          return address4 & 4194303;
        }
        if (context.mapper === "exlorom") {
          if ((address4 & 15728640) === 7340032 || (address4 & 4227072) === 0) {
            return -1;
          }
          const mapped = (address4 & 8323072) >> 1 | address4 & 32767;
          return address4 & 8388608 ? mapped : mapped + 4194304;
        }
        if (context.mapper === "exhirom") {
          if ((address4 & 16646144) === 8257536 || (address4 & 4227072) === 0) {
            return -1;
          }
          return (address4 & 8388608) === 0 ? address4 & 4194303 | 4194304 : address4 & 4194303;
        }
        if (context.mapper === "sfxrom") {
          if ((address4 & 6291456) === 6291456 || (address4 & 4227072) === 0 || (address4 & 8388608) === 8388608) {
            return -1;
          }
          return address4 & 4194304 ? address4 & 4194303 : (address4 & 8323072) >> 1 | address4 & 32767;
        }
        if (context.mapper === "sa1rom") {
          if ((address4 & 4227072) === 32768) {
            return context.sa1banks[(address4 & 14680064) >> 21] | (address4 & 2031616) >> 1 | address4 & 32767;
          }
          if ((address4 & 12582912) === 12582912) {
            return context.sa1banks[(address4 & 1048576) >> 20 | (address4 & 2097152) >> 19] | address4 & 1048575;
          }
          return -1;
        }
        if (context.mapper === "bigsa1rom") {
          if ((address4 & 12582912) === 12582912) {
            return address4 & 4194303 | 4194304;
          }
          if ((address4 & 12582912) === 0 || (address4 & 12582912) === 8388608) {
            if ((address4 & 32768) === 0) return -1;
            return (address4 & 8388608) >> 2 | (address4 & 4128768) >> 1 | address4 & 32767;
          }
          return -1;
        }
        return context.mapper === "norom" ? address4 : -1;
      },
      /**
       * Inverse of {@link snesRomAddressSpace.toOutputOffset}: file offset → a
       * canonical CPU address (usually the FastROM mirror). `-1` if the offset
       * cannot exist for this mapper.
       * @param {number} offset The offset to convert.
       * @param {AddressSpaceContext} context The address space context.
       * @returns {number} The canonical CPU address.
       */
      fromOutputOffset(offset, context) {
        if (offset < 0) return -1;
        let address4 = offset;
        if (context.mapper === "lorom") {
          if (address4 >= 4194304) return -1;
          address4 = address4 << 1 & 8323072 | address4 & 32767 | 32768;
          return address4 | 8388608;
        }
        if (context.mapper === "hirom") {
          return address4 >= 4194304 ? -1 : address4 | 12582912;
        }
        if (context.mapper === "exlorom") {
          if (address4 >= 8388608) return -1;
          if (address4 & 4194304) {
            address4 -= 4194304;
            return address4 << 1 & 8323072 | address4 & 32767 | 32768;
          }
          address4 = address4 << 1 & 8323072 | address4 & 32767 | 32768;
          return address4 | 8388608;
        }
        if (context.mapper === "exhirom") {
          if (address4 >= 8388608) return -1;
          return address4 & 4194304 ? address4 : address4 | 12582912;
        }
        if (context.mapper === "sa1rom") {
          if (address4 >= 8388608) return -1;
          for (let index = 0; index < 8; index++) {
            if (context.sa1banks[index] === (address4 & 7340032)) {
              return 32768 | index << 21 | (address4 & 1015808) << 1 | address4 & 32767;
            }
          }
          return -1;
        }
        if (context.mapper === "bigsa1rom") {
          if (address4 >= 8388608) return -1;
          if ((address4 & 4194304) === 4194304) return address4 | 12582912;
          if ((address4 & 6291456) === 0) {
            return address4 << 1 & 4128768 | 32768 | address4 & 32767;
          }
          return 8388608 | address4 << 1 & 4128768 | 32768 | address4 & 32767;
        }
        if (context.mapper === "sfxrom") {
          return address4 >= 2097152 ? -1 : address4 << 1 & 8323072 | address4 & 32767 | 32768;
        }
        return context.mapper === "norom" ? address4 : -1;
      }
    };
  }
});

// packages/plugin-snes/src/tooling/directive-catalog.ts
var op, directiveCatalog2, directiveByKeyword;
var init_directive_catalog2 = __esm({
  "packages/plugin-snes/src/tooling/directive-catalog.ts"() {
    "use strict";
    op = (keyword, summary, syntax, operands) => ({
      keyword,
      summary,
      syntax,
      ...operands ? { operands } : {}
    });
    directiveCatalog2 = [
      {
        keyword: "db",
        summary: "Emit one or more bytes.",
        syntax: "db value[, value...]",
        group: "data"
      },
      {
        keyword: "dw",
        summary: "Emit one or more 16-bit words.",
        syntax: "dw value[, value...]",
        group: "data"
      },
      {
        keyword: "dl",
        summary: "Emit one or more 24-bit long values.",
        syntax: "dl value[, value...]",
        group: "data"
      },
      {
        keyword: "dd",
        summary: "Emit one or more 32-bit double words.",
        syntax: "dd value[, value...]",
        group: "data"
      },
      {
        keyword: "dc.b",
        summary: "Emit bytes (asar-compatible data constant).",
        syntax: "dc.b value[, value...]",
        group: "data"
      },
      {
        keyword: "dc.w",
        summary: "Emit words (asar-compatible data constant).",
        syntax: "dc.w value[, value...]",
        group: "data"
      },
      {
        keyword: "dc.l",
        summary: "Emit long values (asar-compatible data constant).",
        syntax: "dc.l value[, value...]",
        group: "data"
      },
      {
        keyword: "fillbyte",
        summary: "Set the byte used by fill.",
        syntax: "fillbyte value",
        group: "memory"
      },
      {
        keyword: "fillword",
        summary: "Set the word used by fill.",
        syntax: "fillword value",
        group: "memory"
      },
      {
        keyword: "filllong",
        summary: "Set the long value used by fill.",
        syntax: "filllong value",
        group: "memory"
      },
      {
        keyword: "filldword",
        summary: "Set the double word used by fill.",
        syntax: "filldword value",
        group: "memory"
      },
      {
        keyword: "fill",
        summary: "Fill a number of bytes with the fill value.",
        syntax: "fill count",
        group: "memory"
      },
      {
        keyword: "padbyte",
        summary: "Set the byte used by pad.",
        syntax: "padbyte value",
        group: "memory"
      },
      {
        keyword: "padword",
        summary: "Set the word used by pad.",
        syntax: "padword value",
        group: "memory"
      },
      {
        keyword: "padlong",
        summary: "Set the long value used by pad.",
        syntax: "padlong value",
        group: "memory"
      },
      {
        keyword: "paddword",
        summary: "Set the double word used by pad.",
        syntax: "paddword value",
        group: "memory"
      },
      {
        keyword: "pad",
        summary: "Pad up to an address with the pad value.",
        syntax: "pad address",
        group: "memory"
      },
      {
        keyword: "incsrc",
        summary: "Assemble another source file inline.",
        syntax: 'incsrc "file.asm"',
        group: "include"
      },
      {
        keyword: "include",
        summary: "Include and assemble another source file.",
        syntax: 'include "file.asm"',
        group: "include"
      },
      {
        keyword: "includeonce",
        summary: "Guard the current file against being included more than once.",
        syntax: "includeonce",
        group: "include"
      },
      {
        keyword: "incbin",
        summary: "Embed the raw bytes of a binary file.",
        syntax: 'incbin "file.bin"[,start,length]',
        group: "include"
      },
      {
        keyword: "base",
        summary: "Set or restore the logical base address.",
        syntax: "base address|off",
        group: "layout",
        operands: [op("off", "Restore the saved physical/base address relationship.", "base off")]
      },
      {
        keyword: "org",
        summary: "Set the current output/origin address.",
        syntax: "org $address",
        group: "layout"
      },
      {
        keyword: "pushbase",
        summary: "Push the current base address.",
        syntax: "pushbase",
        group: "layout"
      },
      {
        keyword: "pullbase",
        summary: "Restore the most recently pushed base address.",
        syntax: "pullbase",
        group: "layout"
      },
      {
        keyword: "pushpc",
        summary: "Push the current program counter.",
        syntax: "pushpc",
        group: "layout"
      },
      {
        keyword: "pullpc",
        summary: "Restore the most recently pushed program counter.",
        syntax: "pullpc",
        group: "layout"
      },
      {
        keyword: "startpos",
        summary: "Set the SPC start position.",
        syntax: "startpos",
        group: "layout"
      },
      {
        keyword: "check",
        summary: "Configure bank-cross checks or enable unguarded ROM reads.",
        syntax: "check bankcross off|half|full|on | check title",
        group: "layout",
        operands: [
          {
            keyword: "bankcross",
            summary: "Set whether multi-byte writes may cross a bank boundary. Default is full (64 KiB).",
            syntax: "check bankcross off|half|full|on",
            operands: [
              {
                keyword: "off",
                summary: "Disable the bank-boundary check and enable mapper-specific PC wrapping.",
                syntax: "check bankcross off"
              },
              {
                keyword: "half",
                summary: "Reject writes that cross a 32 KiB half-bank boundary.",
                syntax: "check bankcross half"
              },
              {
                keyword: "full",
                summary: "Reject writes that cross a 64 KiB bank boundary (the default).",
                syntax: "check bankcross full"
              },
              {
                keyword: "on",
                summary: "Alias of full: reject writes that cross a 64 KiB bank boundary.",
                syntax: "check bankcross on"
              }
            ]
          },
          {
            keyword: "title",
            summary: "Enable read1...read4 without a default value. Does not inspect the ROM title.",
            syntax: "check title"
          }
        ]
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
            op("always", "Allow inferred DP width whenever the address fits.", "optimize dp always")
          ]),
          op(
            "address",
            "Asar address optimizer (accepted no-op in this assembler).",
            "optimize address default|ram|mirrors|none",
            [
              op(
                "default",
                "Asar default address optimization (no-op here).",
                "optimize address default"
              ),
              op(
                "ram",
                "Asar RAM-mirroring address optimization (no-op here).",
                "optimize address ram"
              ),
              op(
                "mirrors",
                "Asar mirror-aware address optimization (no-op here).",
                "optimize address mirrors"
              ),
              op("none", "Disable Asar address optimization (no-op here).", "optimize address none")
            ]
          )
        ]
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
            "arch spc700-raw"
          ),
          op(
            "spc700-inline",
            "Asar-compatible implicit SPC blocks: later org starts a block.",
            "arch spc700-inline"
          ),
          op("superfx", "Assemble Super FX / GSU instructions.", "arch superfx")
        ]
      },
      { keyword: "lorom", summary: "Use the LoROM memory mapper.", syntax: "lorom", group: "layout" },
      { keyword: "hirom", summary: "Use the HiROM memory mapper.", syntax: "hirom", group: "layout" },
      {
        keyword: "exlorom",
        summary: "Use the ExLoROM memory mapper.",
        syntax: "exlorom",
        group: "layout"
      },
      {
        keyword: "exhirom",
        summary: "Use the ExHiROM memory mapper.",
        syntax: "exhirom",
        group: "layout"
      },
      { keyword: "fastrom", summary: "Enable FastROM timing.", syntax: "fastrom", group: "layout" },
      {
        keyword: "sfxrom",
        summary: "Use the Super FX memory mapper.",
        syntax: "sfxrom",
        group: "layout"
      },
      { keyword: "norom", summary: "Disable the memory mapper.", syntax: "norom", group: "layout" },
      { keyword: "sa1rom", summary: "Use the SA-1 memory mapper.", syntax: "sa1rom", group: "layout" },
      {
        keyword: "fullsa1rom",
        summary: "Use the full SA-1 memory mapper.",
        syntax: "fullsa1rom",
        group: "layout"
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
              "namespace nested on"
            ),
            op("off", "Disable nested paths and clear the current namespace.", "namespace nested off")
          ])
        ]
      },
      {
        keyword: "pushns",
        summary: "Push the current namespace.",
        syntax: "pushns",
        group: "namespace"
      },
      {
        keyword: "pullns",
        summary: "Restore the most recently pushed namespace.",
        syntax: "pullns",
        group: "namespace"
      },
      {
        keyword: "freecode",
        summary: "Allocate a free code block.",
        syntax: "freecode",
        group: "memory"
      },
      {
        keyword: "freedata",
        summary: "Allocate a free data block.",
        syntax: "freedata",
        group: "memory"
      },
      {
        keyword: "freespace",
        summary: "Allocate a free space block.",
        syntax: "freespace",
        group: "memory"
      },
      {
        keyword: "freespacebyte",
        summary: "Set the fill byte used for freespace.",
        syntax: "freespacebyte value",
        group: "memory"
      },
      {
        keyword: "prot",
        summary: "Protect a region from cleanup.",
        syntax: "prot ...",
        group: "memory"
      },
      {
        keyword: "table",
        summary: "Load an asar character mapping table file (`char=hex` per line).",
        syntax: 'table "file"[,ltr|rtl]',
        group: "table",
        operands: [
          op("ltr", "Left-to-right table lines: character=hex.", 'table "file",ltr'),
          op("rtl", "Right-to-left table lines: hex=character.", 'table "file",rtl')
        ]
      },
      {
        keyword: "cleartable",
        summary: "Reset character mappings to identity (Unicode/ASCII code points).",
        syntax: "cleartable",
        group: "table"
      },
      {
        keyword: "pushtable",
        summary: "Push the current character mapping table.",
        syntax: "pushtable",
        group: "table"
      },
      {
        keyword: "pulltable",
        summary: "Restore the most recently pushed character table.",
        syntax: "pulltable",
        group: "table"
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
            "spcblock dest nspc"
          )
        ]
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
            "endspcblock execute address"
          )
        ]
      },
      {
        keyword: "struct",
        summary: "Begin a structure definition.",
        syntax: "struct name [extends parent]",
        group: "struct",
        operands: [
          op("extends", "Inherit members from an existing struct.", "struct name extends parent")
        ]
      },
      {
        keyword: "endstruct",
        summary: "End a structure definition.",
        syntax: "endstruct [align value]",
        group: "struct",
        operands: [
          op("align", "Round the struct size/stride up to an alignment.", "endstruct align value")
        ]
      },
      {
        keyword: "if",
        summary: "Begin a conditional block.",
        syntax: "if expression",
        group: "control"
      },
      {
        keyword: "elseif",
        summary: "Alternate conditional branch.",
        syntax: "elseif expression",
        group: "control"
      },
      { keyword: "else", summary: "Fallback conditional branch.", syntax: "else", group: "control" },
      { keyword: "endif", summary: "End a conditional block.", syntax: "endif", group: "control" },
      {
        keyword: "while",
        summary: "Begin a while loop.",
        syntax: "while expression",
        group: "control"
      },
      { keyword: "endwhile", summary: "End a while loop.", syntax: "endwhile", group: "control" },
      {
        keyword: "for",
        summary: "Begin a counted loop.",
        syntax: "for var = start..end",
        group: "control"
      },
      { keyword: "endfor", summary: "End a counted loop.", syntax: "endfor", group: "control" },
      {
        keyword: "macro",
        summary: "Begin a macro definition.",
        syntax: "macro name(args)",
        group: "macro"
      },
      { keyword: "endmacro", summary: "End a macro definition.", syntax: "endmacro", group: "macro" },
      {
        keyword: "dpbase",
        summary: "Set the direct page base (asar-compatible).",
        syntax: "dpbase $address",
        group: "compat"
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
          op("disable", "Disable a warning id (no-op here).", "warnings disable id")
        ]
      },
      {
        keyword: "print",
        summary: "Print a message at assemble time.",
        syntax: 'print "text"',
        group: "compat"
      },
      {
        keyword: "assert",
        summary: "Fail the assemble if a condition is false.",
        syntax: 'assert condition[, "message"]',
        group: "compat"
      },
      {
        keyword: "error",
        summary: "Fail the assemble with a user-defined error.",
        syntax: 'error ["message"]',
        group: "compat"
      },
      {
        keyword: "warn",
        summary: "Emit a user-defined warning (asar-compatible).",
        syntax: 'warn ["message"]',
        group: "compat"
      },
      {
        keyword: "warnpc",
        summary: "Fail if the current PC is past an address (deprecated asar form).",
        syntax: "warnpc $address",
        group: "compat"
      },
      {
        keyword: "autoclean",
        summary: "Auto-clean a previous freespace (asar-compatible).",
        syntax: "autoclean ...",
        group: "compat"
      },
      {
        keyword: "autoclear",
        summary: "Auto-clear a previous freespace (asar-compatible).",
        syntax: "autoclear ...",
        group: "compat"
      },
      {
        keyword: "includefrom",
        summary: "Assert the file was included (asar-compatible).",
        syntax: 'includefrom "file"',
        group: "compat"
      },
      {
        keyword: "asar",
        summary: "Assert a minimum asar version (compat no-op).",
        syntax: "asar version",
        group: "compat"
      },
      // ca65 65816 width-state directives
      {
        keyword: ".a8",
        summary: "Set accumulator width hint to 8-bit (ca65 compatible).",
        syntax: ".a8",
        group: "compat"
      },
      {
        keyword: ".a16",
        summary: "Set accumulator width hint to 16-bit (ca65 compatible).",
        syntax: ".a16",
        group: "compat"
      },
      {
        keyword: ".i8",
        summary: "Set index register width hint to 8-bit (ca65 compatible).",
        syntax: ".i8",
        group: "compat"
      },
      {
        keyword: ".i16",
        summary: "Set index register width hint to 16-bit (ca65 compatible).",
        syntax: ".i16",
        group: "compat"
      },
      {
        keyword: ".accu",
        summary: "Set accumulator width hint (ca65 alias for .a8/.a16).",
        syntax: ".accu 8|16",
        group: "compat",
        operands: [
          op("8", "8-bit accumulator width hint.", ".accu 8"),
          op("16", "16-bit accumulator width hint.", ".accu 16")
        ]
      },
      {
        keyword: ".index",
        summary: "Set index register width hint (ca65 alias for .i8/.i16).",
        syntax: ".index 8|16",
        group: "compat",
        operands: [
          op("8", "8-bit index width hint.", ".index 8"),
          op("16", "16-bit index width hint.", ".index 16")
        ]
      },
      {
        keyword: ".smart",
        summary: "Enable/disable automatic M/X width tracking via SEP/REP (ca65 compatible).",
        syntax: ".smart [on|off]",
        group: "compat",
        operands: [
          op("on", "Track M/X width from SEP/REP.", ".smart on"),
          op("off", "Stop automatic M/X width tracking.", ".smart off")
        ]
      },
      {
        keyword: ".setcpu",
        summary: "Select a CPU by name for the current SNES target (ca65 compatible).",
        syntax: '.setcpu "65816"',
        group: "compat"
      },
      {
        keyword: ".pushcpu",
        summary: "Push the current CPU onto the CPU stack (ca65 compatible).",
        syntax: ".pushcpu",
        group: "compat"
      },
      {
        keyword: ".popcpu",
        summary: "Restore the most recently pushed CPU (ca65 compatible).",
        syntax: ".popcpu",
        group: "compat"
      }
    ];
    directiveByKeyword = new Map(
      directiveCatalog2.map((descriptor2) => [descriptor2.keyword.toLowerCase(), descriptor2])
    );
  }
});

// packages/plugin-snes/src/disassembler/65816-state.ts
var init_state = __esm({
  "packages/plugin-snes/src/disassembler/65816-state.ts"() {
    "use strict";
  }
});

// packages/plugin-snes/src/disassembler/address-identities.ts
var SNES_WRAM_ADDRESS_SPACE, SNES_SRAM_ADDRESS_SPACE, SNES_WRAM_ADDRESS_SPACE_DESCRIPTOR, SNES_SRAM_ADDRESS_SPACE_DESCRIPTOR;
var init_address_identities = __esm({
  "packages/plugin-snes/src/disassembler/address-identities.ts"() {
    "use strict";
    SNES_WRAM_ADDRESS_SPACE = "snes.wram";
    SNES_SRAM_ADDRESS_SPACE = "snes.sram";
    SNES_WRAM_ADDRESS_SPACE_DESCRIPTOR = Object.freeze({
      id: SNES_WRAM_ADDRESS_SPACE,
      name: "SNES work RAM",
      addressBits: 17,
      kind: "memory"
    });
    SNES_SRAM_ADDRESS_SPACE_DESCRIPTOR = Object.freeze({
      id: SNES_SRAM_ADDRESS_SPACE,
      name: "SNES save RAM",
      addressBits: 24,
      kind: "memory"
    });
  }
});

// packages/plugin-snes/src/disassembler/hardware-registers.ts
var FIXED_REGISTER_DEFINITIONS, FIXED_REGISTERS, DMA_REGISTER_DEFINITIONS, DMA_REGISTERS_BY_OFFSET;
var init_hardware_registers = __esm({
  "packages/plugin-snes/src/disassembler/hardware-registers.ts"() {
    "use strict";
    FIXED_REGISTER_DEFINITIONS = [
      {
        symbol: "INIDISP",
        address: 8448,
        description: "Display control: forced blank and master brightness."
      },
      {
        symbol: "OBJSEL",
        address: 8449,
        description: "Object size and character-data base addresses."
      },
      { symbol: "OAMADDL", address: 8450, description: "OAM address, low byte." },
      {
        symbol: "OAMADDH",
        address: 8451,
        description: "OAM address high bit and priority rotation."
      },
      { symbol: "OAMDATA", address: 8452, description: "OAM data write port." },
      { symbol: "BGMODE", address: 8453, description: "Background mode and BG character size." },
      { symbol: "MOSAIC", address: 8454, description: "Mosaic size and per-background enable." },
      { symbol: "BG1SC", address: 8455, description: "BG1 tilemap base address and screen size." },
      { symbol: "BG2SC", address: 8456, description: "BG2 tilemap base address and screen size." },
      { symbol: "BG3SC", address: 8457, description: "BG3 tilemap base address and screen size." },
      { symbol: "BG4SC", address: 8458, description: "BG4 tilemap base address and screen size." },
      { symbol: "BG12NBA", address: 8459, description: "BG1 and BG2 character-data base addresses." },
      { symbol: "BG34NBA", address: 8460, description: "BG3 and BG4 character-data base addresses." },
      {
        symbol: "BG1HOFS",
        address: 8461,
        description: "BG1 horizontal scroll, write twice; also Mode 7 horizontal offset."
      },
      {
        symbol: "BG1VOFS",
        address: 8462,
        description: "BG1 vertical scroll, write twice; also Mode 7 vertical offset."
      },
      { symbol: "BG2HOFS", address: 8463, description: "BG2 horizontal scroll, write twice." },
      { symbol: "BG2VOFS", address: 8464, description: "BG2 vertical scroll, write twice." },
      { symbol: "BG3HOFS", address: 8465, description: "BG3 horizontal scroll, write twice." },
      { symbol: "BG3VOFS", address: 8466, description: "BG3 vertical scroll, write twice." },
      { symbol: "BG4HOFS", address: 8467, description: "BG4 horizontal scroll, write twice." },
      { symbol: "BG4VOFS", address: 8468, description: "BG4 vertical scroll, write twice." },
      {
        symbol: "VMAIN",
        address: 8469,
        description: "VRAM address increment mode and word mapping."
      },
      { symbol: "VMADDL", address: 8470, description: "VRAM address, low byte." },
      { symbol: "VMADDH", address: 8471, description: "VRAM address, high byte." },
      { symbol: "VMDATAL", address: 8472, description: "VRAM data write port, low byte." },
      { symbol: "VMDATAH", address: 8473, description: "VRAM data write port, high byte." },
      { symbol: "M7SEL", address: 8474, description: "Mode 7 screen-over and mirroring settings." },
      {
        symbol: "M7A",
        address: 8475,
        description: "Mode 7 matrix parameter A, write twice; multiplication operand."
      },
      {
        symbol: "M7B",
        address: 8476,
        description: "Mode 7 matrix parameter B, write twice; multiplication operand."
      },
      { symbol: "M7C", address: 8477, description: "Mode 7 matrix parameter C, write twice." },
      { symbol: "M7D", address: 8478, description: "Mode 7 matrix parameter D, write twice." },
      { symbol: "M7X", address: 8479, description: "Mode 7 center coordinate X, write twice." },
      { symbol: "M7Y", address: 8480, description: "Mode 7 center coordinate Y, write twice." },
      { symbol: "CGADD", address: 8481, description: "CGRAM palette address." },
      { symbol: "CGDATA", address: 8482, description: "CGRAM palette data write port, write twice." },
      { symbol: "W12SEL", address: 8483, description: "Window mask settings for BG1 and BG2." },
      { symbol: "W34SEL", address: 8484, description: "Window mask settings for BG3 and BG4." },
      {
        symbol: "WOBJSEL",
        address: 8485,
        description: "Window mask settings for objects and color math."
      },
      { symbol: "WH0", address: 8486, description: "Window 1 left position." },
      { symbol: "WH1", address: 8487, description: "Window 1 right position." },
      { symbol: "WH2", address: 8488, description: "Window 2 left position." },
      { symbol: "WH3", address: 8489, description: "Window 2 right position." },
      { symbol: "WBGLOG", address: 8490, description: "Window mask logic for BG1 through BG4." },
      {
        symbol: "WOBJLOG",
        address: 8491,
        description: "Window mask logic for objects and color math."
      },
      { symbol: "TM", address: 8492, description: "Main-screen layer designation." },
      { symbol: "TS", address: 8493, description: "Sub-screen layer designation." },
      { symbol: "TMW", address: 8494, description: "Window-mask designation for the main screen." },
      { symbol: "TSW", address: 8495, description: "Window-mask designation for the sub screen." },
      { symbol: "CGWSEL", address: 8496, description: "Color-math window and subscreen selection." },
      { symbol: "CGADSUB", address: 8497, description: "Color-math operation and per-layer enable." },
      { symbol: "COLDATA", address: 8498, description: "Fixed color data for color math." },
      {
        symbol: "SETINI",
        address: 8499,
        description: "Display mode settings including interlace, overscan, and pseudo-hires."
      },
      {
        symbol: "MPYL",
        address: 8500,
        description: "PPU multiplication result, low byte; read only."
      },
      {
        symbol: "MPYM",
        address: 8501,
        description: "PPU multiplication result, middle byte; read only."
      },
      {
        symbol: "MPYH",
        address: 8502,
        description: "PPU multiplication result, high byte; read only."
      },
      {
        symbol: "SLHV",
        address: 8503,
        description: "Software latch for the horizontal and vertical beam counters."
      },
      { symbol: "OAMDATAREAD", address: 8504, description: "OAM data read port." },
      { symbol: "VMDATALREAD", address: 8505, description: "VRAM data read port, low byte." },
      { symbol: "VMDATAHREAD", address: 8506, description: "VRAM data read port, high byte." },
      { symbol: "CGDATAREAD", address: 8507, description: "CGRAM palette data read port." },
      {
        symbol: "OPHCT",
        address: 8508,
        description: "Latched horizontal beam-counter value, read twice."
      },
      {
        symbol: "OPVCT",
        address: 8509,
        description: "Latched vertical beam-counter value, read twice."
      },
      { symbol: "STAT77", address: 8510, description: "PPU1 status and version number; read only." },
      { symbol: "STAT78", address: 8511, description: "PPU2 status and version number; read only." },
      { symbol: "APUIO0", address: 8512, description: "Main CPU/APU communication port 0." },
      { symbol: "APUIO1", address: 8513, description: "Main CPU/APU communication port 1." },
      { symbol: "APUIO2", address: 8514, description: "Main CPU/APU communication port 2." },
      { symbol: "APUIO3", address: 8515, description: "Main CPU/APU communication port 3." },
      {
        symbol: "WMDATA",
        address: 8576,
        description: "WRAM data read/write port with automatic address increment."
      },
      { symbol: "WMADDL", address: 8577, description: "WRAM address, low byte." },
      { symbol: "WMADDM", address: 8578, description: "WRAM address, middle byte." },
      { symbol: "WMADDH", address: 8579, description: "WRAM address, high bit." },
      {
        symbol: "JOYSER0",
        address: 16406,
        description: "Controller port 1 serial data and latch strobe."
      },
      {
        symbol: "JOYSER1",
        address: 16407,
        description: "Controller port 2 serial data and external I/O."
      },
      {
        symbol: "NMITIMEN",
        address: 16896,
        description: "NMI, H/V timer IRQ, and automatic joypad-read enable."
      },
      { symbol: "WRIO", address: 16897, description: "Programmable I/O port output." },
      { symbol: "WRMPYA", address: 16898, description: "Unsigned 8-bit multiplicand." },
      {
        symbol: "WRMPYB",
        address: 16899,
        description: "Unsigned 8-bit multiplier and multiplication start."
      },
      { symbol: "WRDIVL", address: 16900, description: "Unsigned 16-bit dividend, low byte." },
      { symbol: "WRDIVH", address: 16901, description: "Unsigned 16-bit dividend, high byte." },
      { symbol: "WRDIVB", address: 16902, description: "Unsigned 8-bit divisor and division start." },
      { symbol: "HTIMEL", address: 16903, description: "Horizontal IRQ timer position, low byte." },
      { symbol: "HTIMEH", address: 16904, description: "Horizontal IRQ timer position, high bit." },
      { symbol: "VTIMEL", address: 16905, description: "Vertical IRQ timer position, low byte." },
      { symbol: "VTIMEH", address: 16906, description: "Vertical IRQ timer position, high bit." },
      {
        symbol: "MDMAEN",
        address: 16907,
        description: "General-purpose DMA channel enable and transfer start."
      },
      { symbol: "HDMAEN", address: 16908, description: "H-blank DMA channel enable." },
      { symbol: "MEMSEL", address: 16909, description: "ROM access-cycle speed selection." },
      {
        symbol: "RDNMI",
        address: 16912,
        description: "V-blank NMI flag and CPU version; read acknowledges the flag."
      },
      {
        symbol: "TIMEUP",
        address: 16913,
        description: "H/V timer IRQ flag; read acknowledges the flag."
      },
      {
        symbol: "HVBJOY",
        address: 16914,
        description: "H-blank, V-blank, and automatic joypad-read status."
      },
      { symbol: "RDIO", address: 16915, description: "Programmable I/O port input." },
      {
        symbol: "RDDIVL",
        address: 16916,
        description: "Unsigned division quotient, low byte; read only."
      },
      {
        symbol: "RDDIVH",
        address: 16917,
        description: "Unsigned division quotient, high byte; read only."
      },
      {
        symbol: "RDMPYL",
        address: 16918,
        description: "Multiplication product or division remainder, low byte; read only."
      },
      {
        symbol: "RDMPYH",
        address: 16919,
        description: "Multiplication product or division remainder, high byte; read only."
      },
      {
        symbol: "JOY1L",
        address: 16920,
        description: "Automatic joypad result for controller 1, low byte; read only."
      },
      {
        symbol: "JOY1H",
        address: 16921,
        description: "Automatic joypad result for controller 1, high byte; read only."
      },
      {
        symbol: "JOY2L",
        address: 16922,
        description: "Automatic joypad result for controller 2, low byte; read only."
      },
      {
        symbol: "JOY2H",
        address: 16923,
        description: "Automatic joypad result for controller 2, high byte; read only."
      },
      {
        symbol: "JOY3L",
        address: 16924,
        description: "Automatic joypad result for controller 3, low byte; read only."
      },
      {
        symbol: "JOY3H",
        address: 16925,
        description: "Automatic joypad result for controller 3, high byte; read only."
      },
      {
        symbol: "JOY4L",
        address: 16926,
        description: "Automatic joypad result for controller 4, low byte; read only."
      },
      {
        symbol: "JOY4H",
        address: 16927,
        description: "Automatic joypad result for controller 4, high byte; read only."
      }
    ];
    FIXED_REGISTERS = Object.freeze(
      Object.fromEntries(
        FIXED_REGISTER_DEFINITIONS.map((definition) => [definition.address, definition])
      )
    );
    DMA_REGISTER_DEFINITIONS = [
      {
        offset: 0,
        symbol: (channel) => `DMAP${channel}`,
        description: "DMA/HDMA transfer parameters and direction/mode control."
      },
      {
        offset: 1,
        symbol: (channel) => `BBAD${channel}`,
        description: "DMA/HDMA B-bus register address."
      },
      {
        offset: 2,
        symbol: (channel) => `A1T${channel}L`,
        legacySymbol: (channel) => `A1TL${channel}`,
        description: "DMA source or HDMA table address, low byte."
      },
      {
        offset: 3,
        symbol: (channel) => `A1T${channel}H`,
        legacySymbol: (channel) => `A1TH${channel}`,
        description: "DMA source or HDMA table address, high byte."
      },
      {
        offset: 4,
        symbol: (channel) => `A1B${channel}`,
        description: "DMA source or HDMA table address bank."
      },
      {
        offset: 5,
        symbol: (channel) => `DAS${channel}L`,
        legacySymbol: (channel) => `DASL${channel}`,
        description: "DMA byte count or indirect HDMA address, low byte."
      },
      {
        offset: 6,
        symbol: (channel) => `DAS${channel}H`,
        legacySymbol: (channel) => `DASH${channel}`,
        description: "DMA byte count or indirect HDMA address, high byte."
      },
      {
        offset: 7,
        symbol: (channel) => `DASB${channel}`,
        description: "Indirect HDMA address bank."
      },
      {
        offset: 8,
        symbol: (channel) => `A2A${channel}L`,
        legacySymbol: (channel) => `A2AL${channel}`,
        description: "HDMA table current address, low byte."
      },
      {
        offset: 9,
        symbol: (channel) => `A2A${channel}H`,
        legacySymbol: (channel) => `A2AH${channel}`,
        description: "HDMA table current address, high byte."
      },
      {
        offset: 10,
        symbol: (channel) => `NLTR${channel}`,
        legacySymbol: (channel) => `NTRL${channel}`,
        description: "HDMA line counter and repeat flag."
      },
      {
        offset: 11,
        symbol: (channel) => `UNUSED${channel}`,
        description: "Unused DMA/HDMA data byte; shared with the $43nF mirror."
      },
      {
        offset: 15,
        symbol: (channel) => `UNUSED${channel}_MIRROR`,
        description: "Mirror of the unused DMA/HDMA data byte at $43nB."
      }
    ];
    DMA_REGISTERS_BY_OFFSET = new Map(
      DMA_REGISTER_DEFINITIONS.map((definition) => [definition.offset, definition])
    );
  }
});

// packages/plugin-snes/src/disassembler/rom-header.ts
var init_rom_header = __esm({
  "packages/plugin-snes/src/disassembler/rom-header.ts"() {
    "use strict";
  }
});

// packages/plugin-snes/src/disassembler/65816-analysis.ts
var init_analysis = __esm({
  "packages/plugin-snes/src/disassembler/65816-analysis.ts"() {
    "use strict";
  }
});

// packages/plugin-snes/src/disassembler/dizraw-import.ts
var init_dizraw_import = __esm({
  "packages/plugin-snes/src/disassembler/dizraw-import.ts"() {
    "use strict";
  }
});

// packages/plugin-snes/src/disassembler/mesen-runtime.ts
var CDL_HEADER;
var init_mesen_runtime = __esm({
  "packages/plugin-snes/src/disassembler/mesen-runtime.ts"() {
    "use strict";
    CDL_HEADER = new TextEncoder().encode("CDLv2");
  }
});

// packages/plugin-snes/src/disassembler/spc700-address-space.ts
var SPC700_ARAM_ADDRESS_SPACE, SPC700_ARAM_ADDRESS_SPACE_DESCRIPTOR;
var init_spc700_address_space = __esm({
  "packages/plugin-snes/src/disassembler/spc700-address-space.ts"() {
    "use strict";
    SPC700_ARAM_ADDRESS_SPACE = "snes.spc700.aram";
    SPC700_ARAM_ADDRESS_SPACE_DESCRIPTOR = Object.freeze({
      id: SPC700_ARAM_ADDRESS_SPACE,
      name: "SPC700 ARAM",
      addressBits: 16,
      kind: "memory"
    });
  }
});

// packages/plugin-snes/src/disassembler/mesen-labels.ts
var init_mesen_labels = __esm({
  "packages/plugin-snes/src/disassembler/mesen-labels.ts"() {
    "use strict";
  }
});

// packages/plugin-snes/src/disassembler/framework-asset-helpers.ts
var init_framework_asset_helpers = __esm({
  "packages/plugin-snes/src/disassembler/framework-asset-helpers.ts"() {
    "use strict";
  }
});

// packages/plugin-snes/src/disassembler/ram-map.ts
var init_ram_map = __esm({
  "packages/plugin-snes/src/disassembler/ram-map.ts"() {
    "use strict";
  }
});

// packages/plugin-snes/src/disassembler/source-export.ts
var init_source_export = __esm({
  "packages/plugin-snes/src/disassembler/source-export.ts"() {
    "use strict";
  }
});

// packages/plugin-snes/src/disassembler/spc700-hardware-registers.ts
var registers, byAddress;
var init_spc700_hardware_registers = __esm({
  "packages/plugin-snes/src/disassembler/spc700-hardware-registers.ts"() {
    "use strict";
    registers = [
      { address: 240, symbol: "TEST", description: "APU test register" },
      { address: 241, symbol: "CONTROL", description: "APU control register" },
      { address: 242, symbol: "DSPADDR", description: "DSP register address" },
      { address: 243, symbol: "DSPDATA", description: "DSP register data" },
      ...Array.from({ length: 4 }, (_, index) => ({
        address: 244 + index,
        symbol: `CPUIO${index}`,
        description: `CPU/APU communication port ${index}`
      })),
      ...Array.from({ length: 2 }, (_, index) => ({
        address: 248 + index,
        symbol: `AUXIO${index + 4}`,
        description: `Auxiliary I/O register ${index + 4}`
      })),
      ...Array.from({ length: 3 }, (_, index) => ({
        address: 250 + index,
        symbol: `TIMER${index}_TARGET`,
        description: `Timer ${index} target`
      })),
      ...Array.from({ length: 3 }, (_, index) => ({
        address: 253 + index,
        symbol: `TIMER${index}_COUNTER`,
        description: `Timer ${index} output counter`
      }))
    ];
    byAddress = new Map(registers.map((register4) => [register4.address, register4]));
  }
});

// packages/plugin-snes/src/disassembler/spc700-state.ts
var init_spc700_state = __esm({
  "packages/plugin-snes/src/disassembler/spc700-state.ts"() {
    "use strict";
  }
});

// packages/plugin-snes/src/disassembler/spc700-analysis.ts
var init_spc700_analysis = __esm({
  "packages/plugin-snes/src/disassembler/spc700-analysis.ts"() {
    "use strict";
  }
});

// packages/plugin-snes/src/disassembler/spc700-upload.ts
var init_spc700_upload = __esm({
  "packages/plugin-snes/src/disassembler/spc700-upload.ts"() {
    "use strict";
  }
});

// packages/plugin-snes/src/disassembler/superfx-state.ts
var known, decodeValue, superFxDecodeState, detailNumber, transferSuperFxState;
var init_superfx_state = __esm({
  "packages/plugin-snes/src/disassembler/superfx-state.ts"() {
    "use strict";
    known = (value) => ({ kind: "known", value });
    decodeValue = (value) => value.kind === "known" ? value.value : "unknown";
    superFxDecodeState = (state) => ({
      alt: decodeValue(state.alt),
      destinationRegister: decodeValue(state.destinationRegister),
      sourceRegister: decodeValue(state.sourceRegister),
      programBank: decodeValue(state.programBank)
    });
    detailNumber = (instruction, name) => {
      const effect = instruction.effects.find(
        (entry) => entry.kind === "custom" && entry.name === name
      );
      if (effect?.kind !== "custom") return void 0;
      const value = effect.details?.register ?? effect.details?.alt;
      return typeof value === "number" ? value : void 0;
    };
    transferSuperFxState = (instruction, state) => {
      const alt = detailNumber(instruction, "set-superfx-alt");
      if (alt !== void 0) {
        return {
          ...state,
          alt: state.alt.kind === "known" ? known((state.alt.value | alt) & 3) : state.alt
        };
      }
      const destination = detailNumber(instruction, "select-superfx-destination");
      if (destination !== void 0) return { ...state, destinationRegister: known(destination) };
      const paired = detailNumber(instruction, "select-superfx-source-destination");
      if (paired !== void 0) {
        return {
          ...state,
          destinationRegister: known(paired),
          sourceRegister: known(paired)
        };
      }
      const source = detailNumber(instruction, "select-superfx-source");
      if (source !== void 0) return { ...state, sourceRegister: known(source) };
      return {
        ...state,
        alt: known(0),
        destinationRegister: known(0),
        sourceRegister: known(0)
      };
    };
  }
});

// packages/plugin-snes/src/disassembler/processor-source-export.ts
var init_processor_source_export = __esm({
  "packages/plugin-snes/src/disassembler/processor-source-export.ts"() {
    "use strict";
  }
});

// packages/plugin-snes/src/disassembler/function-heuristics.ts
var builtins, SNES_HEURISTIC_RULE_IDS;
var init_function_heuristics = __esm({
  "packages/plugin-snes/src/disassembler/function-heuristics.ts"() {
    "use strict";
    builtins = [
      {
        id: "apu-io",
        role: "audio.communication",
        addresses: [8512, 8513, 8514, 8515],
        access: "write",
        confidence: "medium"
      },
      {
        id: "vram-write",
        role: "graphics.vram-write",
        addresses: [8472, 8473],
        access: "write",
        confidence: "high"
      },
      {
        id: "palette-write",
        role: "graphics.palette-write",
        addresses: [8482],
        access: "write",
        confidence: "high"
      },
      {
        id: "oam-write",
        role: "graphics.oam-write",
        addresses: [8452],
        access: "write",
        confidence: "high"
      },
      {
        id: "controller-read",
        role: "input.controller-read",
        addresses: [16406, 16407, 16920, 16921, 16922, 16923, 16924, 16925, 16926, 16927],
        access: "read",
        confidence: "high"
      },
      {
        id: "math-result",
        role: "math.hardware-result",
        addresses: [16916, 16917, 16918, 16919, 8500, 8501, 8502],
        access: "read",
        confidence: "high"
      }
    ];
    SNES_HEURISTIC_RULE_IDS = [
      ...builtins.map((rule) => rule.id),
      "observed-access",
      "apu-handshake",
      "apu-upload",
      "vblank-wait",
      "dma-destination",
      "display-fade",
      "mode7-setup",
      "block-copy",
      "wrapper"
    ];
  }
});

// packages/plugin-snes/src/disassembler/runtime-code.ts
var init_runtime_code = __esm({
  "packages/plugin-snes/src/disassembler/runtime-code.ts"() {
    "use strict";
  }
});

// packages/plugin-snes/src/disassembler/superfx-address-space.ts
var SUPERFX_ROM_ADDRESS_SPACE, SUPERFX_ROM_ADDRESS_SPACE_DESCRIPTOR;
var init_superfx_address_space = __esm({
  "packages/plugin-snes/src/disassembler/superfx-address-space.ts"() {
    "use strict";
    SUPERFX_ROM_ADDRESS_SPACE = "snes.superfx.rom";
    SUPERFX_ROM_ADDRESS_SPACE_DESCRIPTOR = Object.freeze({
      id: SUPERFX_ROM_ADDRESS_SPACE,
      name: "SuperFX ROM",
      addressBits: 24,
      kind: "memory"
    });
  }
});

// packages/plugin-snes/src/disassembler/project-initializer.ts
var init_project_initializer = __esm({
  "packages/plugin-snes/src/disassembler/project-initializer.ts"() {
    "use strict";
  }
});

// packages/plugin-snes/src/disassembler/superfx-analysis.ts
var init_superfx_analysis = __esm({
  "packages/plugin-snes/src/disassembler/superfx-analysis.ts"() {
    "use strict";
  }
});

// packages/plugin-snes/src/assets/common.ts
var objectValue, optionsFor, integerOption, stringOption, readBytes, resolveCount, resolveGrid, decodedObject, arrayValue, integerValue, defaultPath, jsonFile;
var init_common = __esm({
  "packages/plugin-snes/src/assets/common.ts"() {
    "use strict";
    objectValue = (value, label) => {
      if (value === void 0) return {};
      if (value === null || Array.isArray(value) || typeof value !== "object") {
        throw new Error(`${label} must be an object.`);
      }
      return value;
    };
    optionsFor = (context) => objectValue(context.request.options, `Asset '${context.request.id}' options`);
    integerOption = (options, key, bounds = {}) => {
      const value = options[key] ?? bounds.fallback;
      if (value === void 0 || typeof value !== "number" || !Number.isSafeInteger(value) || bounds.minimum !== void 0 && value < bounds.minimum || bounds.maximum !== void 0 && value > bounds.maximum) {
        if (value === void 0) return void 0;
        throw new Error(`Asset option '${key}' is outside its integer bounds.`);
      }
      return value;
    };
    stringOption = (options, key, fallback) => {
      const value = options[key] ?? fallback;
      if (typeof value !== "string" || value === "") {
        throw new Error(`Asset option '${key}' must be a non-empty string.`);
      }
      return value;
    };
    readBytes = (source, offset, size, owner) => {
      const bytes = source.read(offset, size);
      if (!bytes) throw new Error(`SNES asset '${owner}' source range is unreadable.`);
      return bytes;
    };
    resolveCount = (context, unitSize, options = optionsFor(context)) => {
      const configured = integerOption(options, "count", { minimum: 1 });
      const length = context.request.length;
      if (configured === void 0 && length === void 0) {
        throw new Error(`SNES asset '${context.request.id}' requires a length or option 'count'.`);
      }
      if (length !== void 0 && length % unitSize !== 0) {
        throw new Error(
          `SNES asset '${context.request.id}' length ${length} is not divisible by ${unitSize}.`
        );
      }
      const count = configured ?? length / unitSize;
      const size = count * unitSize;
      if (!Number.isSafeInteger(size))
        throw new Error(`SNES asset '${context.request.id}' overflowed.`);
      if (length !== void 0 && length !== size) {
        throw new Error(
          `SNES asset '${context.request.id}' count ${count} requires ${size} bytes, not ${length}.`
        );
      }
      return { count, size };
    };
    resolveGrid = (context, unitSize) => {
      const options = optionsFor(context);
      const width = integerOption(options, "width", { minimum: 1 });
      const height = integerOption(options, "height", { minimum: 1 });
      if (width === void 0 !== (height === void 0)) {
        throw new Error("SNES grid assets require both 'width' and 'height'.");
      }
      const configuredCount = width === void 0 ? void 0 : width * height;
      if (configuredCount !== void 0 && !Number.isSafeInteger(configuredCount)) {
        throw new Error(`SNES asset '${context.request.id}' grid dimensions overflowed.`);
      }
      const countOption = integerOption(options, "count", { minimum: 1 });
      if (countOption !== void 0 && configuredCount !== void 0 && countOption !== configuredCount) {
        throw new Error("SNES grid dimensions do not match option 'count'.");
      }
      const resolved = resolveCount(context, unitSize, {
        ...options,
        ...configuredCount === void 0 ? {} : { count: configuredCount }
      });
      return {
        ...resolved,
        ...width === void 0 ? {} : { width, height }
      };
    };
    decodedObject = (value, owner) => objectValue(value, `Decoded SNES asset '${owner}'`);
    arrayValue = (value, label) => {
      if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
      return value;
    };
    integerValue = (value, label, minimum, maximum) => {
      if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum || value > maximum) {
        throw new Error(`${label} must be an integer in ${minimum}..${maximum}.`);
      }
      return value;
    };
    defaultPath = (assetId, suffix) => `assets/${encodeURIComponent(assetId)}.${suffix}`;
    jsonFile = (path3, value) => ({
      path: path3,
      mediaType: "application/json",
      bytes: new TextEncoder().encode(`${JSON.stringify(value, void 0, 2)}
`)
    });
  }
});

// packages/plugin-snes/src/assets/brr.ts
var SNES_BRR_ASSET_CODEC_ID, blockCountAndSize, snesBrrAssetCodec;
var init_brr = __esm({
  "packages/plugin-snes/src/assets/brr.ts"() {
    "use strict";
    init_common();
    SNES_BRR_ASSET_CODEC_ID = "snes.asset.brr";
    blockCountAndSize = (context) => {
      if (context.request.length !== void 0) {
        if (context.request.length % 9 !== 0) {
          throw new Error(`BRR asset '${context.request.id}' length must be a multiple of 9 bytes.`);
        }
        return { blockCount: context.request.length / 9, size: context.request.length };
      }
      const options = optionsFor(context);
      const maxBlocks = integerOption(options, "maxBlocks", { minimum: 1 });
      if (maxBlocks === void 0) {
        throw new Error(`BRR asset '${context.request.id}' requires a length or option 'maxBlocks'.`);
      }
      for (let blockCount = 1; blockCount <= maxBlocks; blockCount++) {
        const block = context.source.read(context.request.sourceOffset + (blockCount - 1) * 9, 9);
        if (!block) break;
        if ((block[0] & 1) !== 0) return { blockCount, size: blockCount * 9 };
      }
      throw new Error(`BRR asset '${context.request.id}' has no end block within ${maxBlocks} blocks.`);
    };
    snesBrrAssetCodec = Object.freeze({
      id: SNES_BRR_ASSET_CODEC_ID,
      version: "1.0.0",
      sizeBounds: { minimum: 9 },
      inspect: (context) => {
        const resolved = blockCountAndSize(context);
        return {
          size: resolved.size,
          metadata: { format: "snes-brr", blockCount: resolved.blockCount, samplesPerBlock: 16 }
        };
      },
      decode: (context) => {
        const options = optionsFor(context);
        const resolved = blockCountAndSize(context);
        const bytes = readBytes(
          context.source,
          context.request.sourceOffset,
          resolved.size,
          context.request.id
        );
        const blocks = Array.from({ length: resolved.blockCount }, (_, blockIndex) => {
          const offset = blockIndex * 9;
          const header = bytes[offset];
          const nibbles = Array.from({ length: 16 }, (_2, sampleIndex) => {
            const byte = bytes[offset + 1 + Math.floor(sampleIndex / 2)];
            const nibble2 = sampleIndex % 2 === 0 ? byte >> 4 : byte & 15;
            return nibble2 >= 8 ? nibble2 - 16 : nibble2;
          });
          return {
            range: header >> 4,
            filter: header >> 2 & 3,
            loop: header >> 1 & 1,
            end: header & 1,
            nibbles
          };
        });
        const value = { kind: "snes-brr", blocks };
        const path3 = stringOption(options, "path", defaultPath(context.request.id, "brr"));
        const metadataPath = stringOption(
          options,
          "metadataPath",
          defaultPath(context.request.id, "brr.json")
        );
        return {
          value,
          files: [{ path: path3, mediaType: "audio/x-snes-brr", bytes }, jsonFile(metadataPath, value)]
        };
      },
      encode: (context) => {
        const resolved = blockCountAndSize(context);
        const value = decodedObject(context.decoded.value, context.request.id);
        const blocks = arrayValue(value.blocks, `BRR asset '${context.request.id}' blocks`);
        if (blocks.length !== resolved.blockCount) {
          throw new Error(`BRR asset '${context.request.id}' requires ${resolved.blockCount} blocks.`);
        }
        const bytes = new Uint8Array(resolved.size);
        blocks.forEach((blockValue, blockIndex) => {
          const block = objectValue(blockValue, `BRR block ${blockIndex}`);
          const range = integerValue(block.range, `BRR block ${blockIndex} range`, 0, 15);
          const filter = integerValue(block.filter, `BRR block ${blockIndex} filter`, 0, 3);
          const loop = integerValue(block.loop, `BRR block ${blockIndex} loop`, 0, 1);
          const end = integerValue(block.end, `BRR block ${blockIndex} end`, 0, 1);
          const nibbles = arrayValue(block.nibbles, `BRR block ${blockIndex} nibbles`);
          if (nibbles.length !== 16) {
            throw new Error(`BRR block ${blockIndex} requires exactly 16 nibbles.`);
          }
          const offset = blockIndex * 9;
          bytes[offset] = range << 4 | filter << 2 | loop << 1 | end;
          for (let sampleIndex = 0; sampleIndex < 16; sampleIndex += 2) {
            const high = integerValue(
              nibbles[sampleIndex],
              `BRR block ${blockIndex} nibble ${sampleIndex}`,
              -8,
              7
            );
            const low = integerValue(
              nibbles[sampleIndex + 1],
              `BRR block ${blockIndex} nibble ${sampleIndex + 1}`,
              -8,
              7
            );
            bytes[offset + 1 + sampleIndex / 2] = (high < 0 ? high + 16 : high) << 4 | (low < 0 ? low + 16 : low);
          }
        });
        return bytes;
      }
    });
  }
});

// packages/plugin-snes/src/assets/palette.ts
var SNES_PALETTE_ASSET_CODEC_ID, snesPaletteAssetCodec;
var init_palette = __esm({
  "packages/plugin-snes/src/assets/palette.ts"() {
    "use strict";
    init_common();
    SNES_PALETTE_ASSET_CODEC_ID = "snes.asset.palette.bgr555";
    snesPaletteAssetCodec = Object.freeze({
      id: SNES_PALETTE_ASSET_CODEC_ID,
      version: "1.0.0",
      sizeBounds: { minimum: 2 },
      inspect: (context) => {
        const { count, size } = resolveCount(context, 2);
        return { size, metadata: { format: "snes-cgram-bgr555", count } };
      },
      decode: (context) => {
        const options = optionsFor(context);
        const { count, size } = resolveCount(context, 2, options);
        const bytes = readBytes(context.source, context.request.sourceOffset, size, context.request.id);
        const colors = Array.from({ length: count }, (_, index) => {
          const word2 = bytes[index * 2] | bytes[index * 2 + 1] << 8;
          return {
            red: word2 & 31,
            green: word2 >> 5 & 31,
            blue: word2 >> 10 & 31,
            unusedHighBit: word2 >> 15 & 1
          };
        });
        const value = { kind: "snes-palette-bgr555", colors };
        const path3 = stringOption(options, "path", defaultPath(context.request.id, "palette.json"));
        return { value, files: [jsonFile(path3, value)] };
      },
      encode: (context) => {
        const { count, size } = resolveCount(context, 2);
        const value = decodedObject(context.decoded.value, context.request.id);
        const colors = arrayValue(value.colors, `SNES palette '${context.request.id}' colors`);
        if (colors.length !== count) {
          throw new Error(`SNES palette '${context.request.id}' requires exactly ${count} colors.`);
        }
        const bytes = new Uint8Array(size);
        colors.forEach((colorValue, index) => {
          const color = objectValue(colorValue, `SNES palette color ${index}`);
          const red = integerValue(color.red, `SNES palette color ${index} red`, 0, 31);
          const green = integerValue(color.green, `SNES palette color ${index} green`, 0, 31);
          const blue = integerValue(color.blue, `SNES palette color ${index} blue`, 0, 31);
          const unused = integerValue(
            color.unusedHighBit,
            `SNES palette color ${index} unusedHighBit`,
            0,
            1
          );
          const word2 = red | green << 5 | blue << 10 | unused << 15;
          bytes[index * 2] = word2 & 255;
          bytes[index * 2 + 1] = word2 >> 8;
        });
        return bytes;
      }
    });
  }
});

// packages/plugin-snes/src/assets/tilemap.ts
var SNES_BG_TILEMAP_ASSET_CODEC_ID, SNES_MODE7_TILEMAP_ASSET_CODEC_ID, dimensions, snesBgTilemapAssetCodec, snesMode7TilemapAssetCodec;
var init_tilemap = __esm({
  "packages/plugin-snes/src/assets/tilemap.ts"() {
    "use strict";
    init_common();
    SNES_BG_TILEMAP_ASSET_CODEC_ID = "snes.asset.tilemap.bg";
    SNES_MODE7_TILEMAP_ASSET_CODEC_ID = "snes.asset.tilemap.mode7";
    dimensions = (resolved) => ({
      ...resolved.width === void 0 ? {} : { width: resolved.width, height: resolved.height }
    });
    snesBgTilemapAssetCodec = Object.freeze({
      id: SNES_BG_TILEMAP_ASSET_CODEC_ID,
      version: "1.0.0",
      sizeBounds: { minimum: 2 },
      inspect: (context) => {
        const resolved = resolveGrid(context, 2);
        return {
          size: resolved.size,
          metadata: { format: "snes-bg-tilemap", count: resolved.count, ...dimensions(resolved) }
        };
      },
      decode: (context) => {
        const options = optionsFor(context);
        const resolved = resolveGrid(context, 2);
        const bytes = readBytes(
          context.source,
          context.request.sourceOffset,
          resolved.size,
          context.request.id
        );
        const entries3 = Array.from({ length: resolved.count }, (_, index) => {
          const word2 = bytes[index * 2] | bytes[index * 2 + 1] << 8;
          return {
            tile: word2 & 1023,
            palette: word2 >> 10 & 7,
            priority: word2 >> 13 & 1,
            horizontalFlip: word2 >> 14 & 1,
            verticalFlip: word2 >> 15 & 1
          };
        });
        const value = {
          kind: "snes-bg-tilemap",
          ...dimensions(resolved),
          entries: entries3
        };
        const path3 = stringOption(options, "path", defaultPath(context.request.id, "tilemap.json"));
        return { value, files: [jsonFile(path3, value)] };
      },
      encode: (context) => {
        const resolved = resolveGrid(context, 2);
        const value = decodedObject(context.decoded.value, context.request.id);
        const entries3 = arrayValue(value.entries, `SNES tilemap '${context.request.id}' entries`);
        if (entries3.length !== resolved.count) {
          throw new Error(`SNES tilemap '${context.request.id}' requires ${resolved.count} entries.`);
        }
        const bytes = new Uint8Array(resolved.size);
        entries3.forEach((entryValue, index) => {
          const entry = objectValue(entryValue, `SNES tilemap entry ${index}`);
          const tile = integerValue(entry.tile, `SNES tilemap entry ${index} tile`, 0, 1023);
          const palette = integerValue(entry.palette, `SNES tilemap entry ${index} palette`, 0, 7);
          const priority = integerValue(entry.priority, `SNES tilemap entry ${index} priority`, 0, 1);
          const horizontalFlip = integerValue(
            entry.horizontalFlip,
            `SNES tilemap entry ${index} horizontalFlip`,
            0,
            1
          );
          const verticalFlip = integerValue(
            entry.verticalFlip,
            `SNES tilemap entry ${index} verticalFlip`,
            0,
            1
          );
          const word2 = tile | palette << 10 | priority << 13 | horizontalFlip << 14 | verticalFlip << 15;
          bytes[index * 2] = word2 & 255;
          bytes[index * 2 + 1] = word2 >> 8;
        });
        return bytes;
      }
    });
    snesMode7TilemapAssetCodec = Object.freeze({
      id: SNES_MODE7_TILEMAP_ASSET_CODEC_ID,
      version: "1.0.0",
      sizeBounds: { minimum: 1 },
      inspect: (context) => {
        const resolved = resolveGrid(context, 1);
        return {
          size: resolved.size,
          metadata: { format: "snes-mode7-tilemap", count: resolved.count, ...dimensions(resolved) }
        };
      },
      decode: (context) => {
        const options = optionsFor(context);
        const resolved = resolveGrid(context, 1);
        const bytes = readBytes(
          context.source,
          context.request.sourceOffset,
          resolved.size,
          context.request.id
        );
        const value = {
          kind: "snes-mode7-tilemap",
          ...dimensions(resolved),
          indexes: [...bytes]
        };
        const path3 = stringOption(
          options,
          "path",
          defaultPath(context.request.id, "mode7-tilemap.json")
        );
        return { value, files: [jsonFile(path3, value)] };
      },
      encode: (context) => {
        const resolved = resolveGrid(context, 1);
        const value = decodedObject(context.decoded.value, context.request.id);
        const indexes = arrayValue(
          value.indexes,
          `SNES Mode 7 tilemap '${context.request.id}' indexes`
        );
        if (indexes.length !== resolved.count) {
          throw new Error(
            `SNES Mode 7 tilemap '${context.request.id}' requires ${resolved.count} indexes.`
          );
        }
        return Uint8Array.from(
          indexes.map(
            (index, position) => integerValue(index, `SNES Mode 7 tilemap index ${position}`, 0, 255)
          )
        );
      }
    });
  }
});

// packages/plugin-snes/src/assets/tiles.ts
var SNES_TILE_2BPP_ASSET_CODEC_ID, SNES_TILE_3BPP_ASSET_CODEC_ID, SNES_TILE_4BPP_ASSET_CODEC_ID, SNES_TILE_8BPP_ASSET_CODEC_ID, SNES_MODE7_TILE_ASSET_CODEC_ID, planeOffset, decodePlanarTile, encodeTilePixels, planarTileCodec, mode7TileCodec, snesTile2BppAssetCodec, snesTile3BppAssetCodec, snesTile4BppAssetCodec, snesTile8BppAssetCodec, snesMode7TileAssetCodec;
var init_tiles = __esm({
  "packages/plugin-snes/src/assets/tiles.ts"() {
    "use strict";
    init_common();
    SNES_TILE_2BPP_ASSET_CODEC_ID = "snes.asset.tile.2bpp";
    SNES_TILE_3BPP_ASSET_CODEC_ID = "snes.asset.tile.3bpp";
    SNES_TILE_4BPP_ASSET_CODEC_ID = "snes.asset.tile.4bpp";
    SNES_TILE_8BPP_ASSET_CODEC_ID = "snes.asset.tile.8bpp";
    SNES_MODE7_TILE_ASSET_CODEC_ID = "snes.asset.tile.mode7";
    planeOffset = (bitsPerPixel, plane, row) => {
      if (bitsPerPixel === 3 && plane === 2) return 16 + row;
      return Math.floor(plane / 2) * 16 + row * 2 + plane % 2;
    };
    decodePlanarTile = (bytes, start, bitsPerPixel) => Array.from(
      { length: 8 },
      (_, row) => Array.from({ length: 8 }, (_2, column) => {
        let pixel = 0;
        for (let plane = 0; plane < bitsPerPixel; plane++) {
          const byte = bytes[start + planeOffset(bitsPerPixel, plane, row)] ?? 0;
          pixel |= (byte >> 7 - column & 1) << plane;
        }
        return pixel;
      })
    );
    encodeTilePixels = (value, owner, tileIndex, maximum) => {
      const rows = arrayValue(value, `SNES tile ${tileIndex} pixels`);
      if (rows.length !== 8) throw new Error(`SNES tile ${tileIndex} must contain exactly 8 rows.`);
      return rows.map((row, rowIndex) => {
        const pixels = arrayValue(row, `SNES tile ${tileIndex} row ${rowIndex}`);
        if (pixels.length !== 8) {
          throw new Error(`SNES tile ${tileIndex} row ${rowIndex} must contain exactly 8 pixels.`);
        }
        return pixels.map(
          (pixel, column) => integerValue(pixel, `SNES tile '${owner}' pixel ${rowIndex},${column}`, 0, maximum)
        );
      });
    };
    planarTileCodec = (id, bitsPerPixel) => {
      const bytesPerTile = bitsPerPixel * 8;
      return Object.freeze({
        id,
        version: "1.0.0",
        sizeBounds: { minimum: bytesPerTile, alignment: 1 },
        inspect: (context) => {
          const { count, size } = resolveCount(context, bytesPerTile);
          return {
            size,
            metadata: { format: "snes-planar", bitsPerPixel, tileWidth: 8, tileHeight: 8, count }
          };
        },
        decode: (context) => {
          const options = optionsFor(context);
          const { count, size } = resolveCount(context, bytesPerTile, options);
          const bytes = readBytes(
            context.source,
            context.request.sourceOffset,
            size,
            context.request.id
          );
          const tiles = Array.from(
            { length: count },
            (_, index) => decodePlanarTile(bytes, index * bytesPerTile, bitsPerPixel)
          );
          const value = {
            kind: "snes-planar-tiles",
            bitsPerPixel,
            tileWidth: 8,
            tileHeight: 8,
            tiles
          };
          const path3 = stringOption(
            options,
            "path",
            defaultPath(context.request.id, `${bitsPerPixel}bpp.json`)
          );
          return { value, files: [jsonFile(path3, value)] };
        },
        encode: (context) => {
          const { count, size } = resolveCount(context, bytesPerTile);
          const value = decodedObject(context.decoded.value, context.request.id);
          const tiles = arrayValue(value.tiles, `SNES tile asset '${context.request.id}' tiles`);
          if (tiles.length !== count) {
            throw new Error(`SNES tile asset '${context.request.id}' requires exactly ${count} tiles.`);
          }
          const bytes = new Uint8Array(size);
          tiles.forEach((tile, tileIndex) => {
            const pixels = encodeTilePixels(tile, context.request.id, tileIndex, 2 ** bitsPerPixel - 1);
            for (let row = 0; row < 8; row++) {
              for (let column = 0; column < 8; column++) {
                const pixel = pixels[row][column];
                for (let plane = 0; plane < bitsPerPixel; plane++) {
                  if ((pixel & 1 << plane) !== 0) {
                    const offset = tileIndex * bytesPerTile + planeOffset(bitsPerPixel, plane, row);
                    bytes[offset] |= 1 << 7 - column;
                  }
                }
              }
            }
          });
          return bytes;
        }
      });
    };
    mode7TileCodec = Object.freeze({
      id: SNES_MODE7_TILE_ASSET_CODEC_ID,
      version: "1.0.0",
      sizeBounds: { minimum: 64 },
      inspect: (context) => {
        const { count, size } = resolveCount(context, 64);
        return {
          size,
          metadata: {
            format: "snes-mode7-chunky",
            bitsPerPixel: 8,
            tileWidth: 8,
            tileHeight: 8,
            count
          }
        };
      },
      decode: (context) => {
        const options = optionsFor(context);
        const { count, size } = resolveCount(context, 64, options);
        const bytes = readBytes(context.source, context.request.sourceOffset, size, context.request.id);
        const tiles = Array.from(
          { length: count },
          (_, tileIndex) => Array.from(
            { length: 8 },
            (_2, row) => Array.from({ length: 8 }, (_3, column) => bytes[tileIndex * 64 + row * 8 + column])
          )
        );
        const value = {
          kind: "snes-mode7-tiles",
          bitsPerPixel: 8,
          tileWidth: 8,
          tileHeight: 8,
          tiles
        };
        const path3 = stringOption(options, "path", defaultPath(context.request.id, "mode7.json"));
        return { value, files: [jsonFile(path3, value)] };
      },
      encode: (context) => {
        const { count, size } = resolveCount(context, 64);
        const value = decodedObject(context.decoded.value, context.request.id);
        const tiles = arrayValue(value.tiles, `SNES Mode 7 asset '${context.request.id}' tiles`);
        if (tiles.length !== count) {
          throw new Error(`SNES Mode 7 asset '${context.request.id}' requires exactly ${count} tiles.`);
        }
        const bytes = new Uint8Array(size);
        tiles.forEach((tile, tileIndex) => {
          const pixels = encodeTilePixels(tile, context.request.id, tileIndex, 255);
          pixels.forEach(
            (row, rowIndex) => row.forEach((pixel, column) => {
              bytes[tileIndex * 64 + rowIndex * 8 + column] = pixel;
            })
          );
        });
        return bytes;
      }
    });
    snesTile2BppAssetCodec = planarTileCodec(SNES_TILE_2BPP_ASSET_CODEC_ID, 2);
    snesTile3BppAssetCodec = planarTileCodec(SNES_TILE_3BPP_ASSET_CODEC_ID, 3);
    snesTile4BppAssetCodec = planarTileCodec(SNES_TILE_4BPP_ASSET_CODEC_ID, 4);
    snesTile8BppAssetCodec = planarTileCodec(SNES_TILE_8BPP_ASSET_CODEC_ID, 8);
    snesMode7TileAssetCodec = mode7TileCodec;
  }
});

// packages/plugin-snes/src/assets/previews.ts
var SNES_SVG_ASSET_PREVIEW_ID, objectValue2, arrayValue2, numberValue, byteHex, svgFile, svg, renderTiles, renderPalette, indexColor, renderTilemap, renderBrr, snesSvgAssetPreviewRenderer;
var init_previews = __esm({
  "packages/plugin-snes/src/assets/previews.ts"() {
    "use strict";
    init_brr();
    init_palette();
    init_tilemap();
    init_tiles();
    SNES_SVG_ASSET_PREVIEW_ID = "snes.preview.svg";
    objectValue2 = (value, name) => {
      if (!value || Array.isArray(value) || typeof value !== "object") {
        throw new Error(`${name} must be an object.`);
      }
      return value;
    };
    arrayValue2 = (value, name) => {
      if (!Array.isArray(value)) throw new Error(`${name} must be an array.`);
      return value;
    };
    numberValue = (value, name) => {
      if (typeof value !== "number" || !Number.isFinite(value))
        throw new Error(`${name} must be numeric.`);
      return value;
    };
    byteHex = (value) => Math.round(value).toString(16).padStart(2, "0");
    svgFile = (id, body) => [
      {
        path: `previews/${id.replaceAll("/", "_").replaceAll(":", "_")}.svg`,
        mediaType: "image/svg+xml",
        bytes: new TextEncoder().encode(body)
      }
    ];
    svg = (width, height, content, total) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" shape-rendering="crispEdges" data-total="${total}"><rect width="100%" height="100%" fill="#101418"/>${content}</svg>
`;
    renderTiles = (id, value) => {
      const allTiles = arrayValue2(value.tiles, "SNES preview tiles");
      const tiles = allTiles.slice(0, 256);
      const bitsPerPixel = numberValue(value.bitsPerPixel, "SNES preview bitsPerPixel");
      const maximum = 2 ** bitsPerPixel - 1;
      const columns = Math.min(16, Math.max(1, Math.ceil(Math.sqrt(tiles.length))));
      const rows = Math.ceil(tiles.length / columns);
      const scale = 3;
      const parts = [];
      tiles.forEach(
        (tile, tileIndex) => arrayValue2(tile, `SNES preview tile ${tileIndex}`).forEach(
          (row, y) => arrayValue2(row, `SNES preview tile ${tileIndex} row ${y}`).forEach((pixel, x) => {
            const intensity = numberValue(pixel, "SNES preview pixel") * 255 / maximum;
            const color = byteHex(intensity);
            const tileX = tileIndex % columns * 8;
            const tileY = Math.floor(tileIndex / columns) * 8;
            parts.push(
              `<rect x="${(tileX + x) * scale}" y="${(tileY + y) * scale}" width="${scale}" height="${scale}" fill="#${color}${color}${color}"/>`
            );
          })
        )
      );
      return svgFile(id, svg(columns * 8 * scale, rows * 8 * scale, parts.join(""), allTiles.length));
    };
    renderPalette = (id, value) => {
      const allColors = arrayValue2(value.colors, "SNES preview colors");
      const colors = allColors.slice(0, 256);
      const columns = Math.min(16, Math.max(1, colors.length));
      const rows = Math.ceil(colors.length / columns);
      const size = 18;
      const parts = colors.map((entry, index) => {
        const color = objectValue2(entry, `SNES preview color ${index}`);
        const red = byteHex(numberValue(color.red, "SNES preview red") * 255 / 31);
        const green = byteHex(numberValue(color.green, "SNES preview green") * 255 / 31);
        const blue = byteHex(numberValue(color.blue, "SNES preview blue") * 255 / 31);
        return `<rect x="${index % columns * size}" y="${Math.floor(index / columns) * size}" width="${size}" height="${size}" fill="#${red}${green}${blue}"/>`;
      });
      return svgFile(id, svg(columns * size, rows * size, parts.join(""), allColors.length));
    };
    indexColor = (index) => `#${byteHex(index * 73 & 255)}${byteHex(index * 151 & 255)}${byteHex(index * 199 & 255)}`;
    renderTilemap = (id, value) => {
      const rawEntries = value.entries ?? value.indexes;
      const allEntries = arrayValue2(rawEntries, "SNES preview tilemap entries");
      const entries3 = allEntries.slice(0, 1024);
      const declaredWidth = typeof value.width === "number" ? value.width : void 0;
      const columns = Math.min(32, Math.max(1, declaredWidth ?? Math.ceil(Math.sqrt(entries3.length))));
      const rows = Math.ceil(entries3.length / columns);
      const cell = 8;
      const parts = entries3.map((entry, index) => {
        const tile = typeof entry === "number" ? numberValue(entry, "SNES preview Mode 7 index") : numberValue(
          objectValue2(entry, `SNES preview tilemap entry ${index}`).tile,
          "SNES preview tile"
        );
        return `<rect x="${index % columns * cell}" y="${Math.floor(index / columns) * cell}" width="${cell}" height="${cell}" fill="${indexColor(tile)}"/>`;
      });
      return svgFile(id, svg(columns * cell, rows * cell, parts.join(""), allEntries.length));
    };
    renderBrr = (id, value) => {
      const allBlocks = arrayValue2(value.blocks, "SNES preview BRR blocks");
      const blocks = allBlocks.slice(0, 128);
      const samples = blocks.flatMap(
        (block, blockIndex) => arrayValue2(
          objectValue2(block, `SNES preview BRR block ${blockIndex}`).nibbles,
          "BRR nibbles"
        ).map((sample) => numberValue(sample, "BRR encoded nibble"))
      );
      const width = Math.max(1, samples.length * 2);
      const height = 64;
      const points = samples.map((sample, index) => `${index * 2},${32 - sample * 3}`).join(" ");
      const content = `<line x1="0" y1="32" x2="${width}" y2="32" stroke="#56616b"/><polyline points="${points}" fill="none" stroke="#7ee787" stroke-width="1"/>`;
      return svgFile(id, svg(width, height, content, allBlocks.length));
    };
    snesSvgAssetPreviewRenderer = Object.freeze({
      id: SNES_SVG_ASSET_PREVIEW_ID,
      version: "1.0.0",
      codecIds: [
        SNES_BRR_ASSET_CODEC_ID,
        SNES_PALETTE_ASSET_CODEC_ID,
        SNES_BG_TILEMAP_ASSET_CODEC_ID,
        SNES_MODE7_TILEMAP_ASSET_CODEC_ID,
        SNES_MODE7_TILE_ASSET_CODEC_ID,
        SNES_TILE_2BPP_ASSET_CODEC_ID,
        SNES_TILE_3BPP_ASSET_CODEC_ID,
        SNES_TILE_4BPP_ASSET_CODEC_ID,
        SNES_TILE_8BPP_ASSET_CODEC_ID
      ],
      render: ({ asset, decoded }) => {
        const value = objectValue2(decoded.value, `SNES asset '${asset.id}' preview`);
        if (asset.request.codecId === SNES_PALETTE_ASSET_CODEC_ID)
          return renderPalette(asset.id, value);
        if (asset.request.codecId === SNES_BG_TILEMAP_ASSET_CODEC_ID || asset.request.codecId === SNES_MODE7_TILEMAP_ASSET_CODEC_ID) {
          return renderTilemap(asset.id, value);
        }
        if (asset.request.codecId === SNES_BRR_ASSET_CODEC_ID) return renderBrr(asset.id, value);
        return renderTiles(asset.id, value);
      }
    });
  }
});

// packages/plugin-snes/src/assets/index.ts
var snesAssetCodecs;
var init_assets = __esm({
  "packages/plugin-snes/src/assets/index.ts"() {
    "use strict";
    init_brr();
    init_palette();
    init_tilemap();
    init_tiles();
    init_brr();
    init_palette();
    init_previews();
    init_tilemap();
    init_tiles();
    snesAssetCodecs = Object.freeze(
      [
        snesBrrAssetCodec,
        snesPaletteAssetCodec,
        snesBgTilemapAssetCodec,
        snesMode7TilemapAssetCodec,
        snesMode7TileAssetCodec,
        snesTile2BppAssetCodec,
        snesTile3BppAssetCodec,
        snesTile4BppAssetCodec,
        snesTile8BppAssetCodec
      ].sort((left, right) => left.id.localeCompare(right.id))
    );
  }
});

// packages/plugin-snes/src/index.ts
var SNES_TARGET_ID, toolingFor, directive, numericArgument, addressExpressions, readExpressions, targetOptions, createInitialState, plugin;
var init_src2 = __esm({
  "packages/plugin-snes/src/index.ts"() {
    "use strict";
    init_src();
    init_decoder();
    init_spec();
    init__();
    init_operand_classifiers();
    init_spc700_decoder();
    init_spc700_spec();
    init_spc700();
    init_split_operands();
    init_superfx_decoder();
    init_superfx_spec();
    init_superfx();
    init_compatibility();
    init_ca65_compat();
    init_freespace();
    init_layout();
    init_spc();
    init_session_state2();
    init_address_space();
    init_directive_catalog2();
    init_instruction_catalog2();
    init_analysis();
    init_state();
    init_address_identities();
    init_dizraw_import();
    init_hardware_registers();
    init_mesen_runtime();
    init_mesen_labels();
    init_framework_asset_helpers();
    init_rom_header();
    init_source_export();
    init_spc700_address_space();
    init_spc700_analysis();
    init_spc700_hardware_registers();
    init_spc700_state();
    init_spc700_upload();
    init_processor_source_export();
    init_project_initializer();
    init_ram_map();
    init_superfx_address_space();
    init_superfx_analysis();
    init_superfx_state();
    init_assets();
    init_decoder();
    init_spec();
    init_spc700_decoder();
    init_spc700_spec();
    init_superfx_decoder();
    init_superfx_spec();
    init_compatibility();
    init_ca65_compat();
    init_session_state2();
    init_spc();
    init_address_space();
    init_instruction_catalog2();
    init_function_heuristics();
    init_runtime_code();
    SNES_TARGET_ID = "snes.sfc";
    toolingFor = (keywords) => {
      const wanted = new Set(keywords);
      return directiveCatalog2.filter((descriptor2) => wanted.has(descriptor2.keyword));
    };
    directive = (id, keywords, handler) => ({
      id,
      keywords,
      phase: "lowered",
      createHandler: handler,
      tooling: toolingFor(keywords)
    });
    numericArgument = (functionName, args, index) => {
      const value = args[index];
      if (typeof value !== "number") {
        throw new Error(`${functionName}() argument ${index + 1} must be numeric.`);
      }
      return value;
    };
    addressExpressions = {
      id: "snes.address-functions",
      functions: [
        {
          name: "snestopc",
          signature: { parameters: ["address"] },
          summary: "Convert a SNES address to an output offset.",
          evaluate: ({ addresses: addresses2 }, args) => addresses2.toOutputOffset(numericArgument("snestopc", args, 0))
        },
        {
          name: "pctosnes",
          signature: { parameters: ["offset"] },
          summary: "Convert an output offset to a SNES address.",
          evaluate: ({ addresses: addresses2 }, args) => addresses2.fromOutputOffset(numericArgument("pctosnes", args, 0))
        }
      ]
    };
    readExpressions = {
      id: "snes.read-functions",
      functions: [
        ...[1, 2, 3, 4].map((size) => ({
          name: `canread${size}`,
          signature: { parameters: ["position"] },
          summary: `Return whether ${size} byte(s) can be read from the base image.`,
          evaluate: (context, args) => context.output.canRead(numericArgument(`canread${size}`, args, 0), size)
        })),
        {
          name: "canread",
          signature: { parameters: ["position", "size"] },
          summary: "Return whether a range can be read from the base image.",
          evaluate: ({ output }, args) => output.canRead(numericArgument("canread", args, 0), numericArgument("canread", args, 1))
        },
        ...[1, 2, 3, 4].map((size) => ({
          name: `read${size}`,
          signature: {
            parameters: ["position", "defaultValue"],
            minimumArguments: 1,
            maximumArguments: 2
          },
          summary: `Read ${size} byte(s) from the base image.`,
          evaluate: (context, args) => {
            const position = numericArgument(`read${size}`, args, 0);
            const defaultValue = args.length > 1 ? numericArgument(`read${size}`, args, 1) : void 0;
            const state = context.state.get(snesSessionStateKey);
            if (!state.readFunctionsEnabled && defaultValue === void 0) {
              throw new Error(
                `Esnes_address_out_of_bounds: SNES address ${position.toString(16).toUpperCase().padStart(6, "0")} in read function out of bounds.`
              );
            }
            return context.output.read(position, size, defaultValue);
          }
        }))
      ]
    };
    targetOptions = (configured) => {
      const value = typeof configured === "object" && configured !== null && !Array.isArray(configured) ? configured : {};
      const checksumMode = value.checksumMode ?? "asar";
      if (checksumMode !== "asar" && checksumMode !== "simple") {
        throw new Error("checksumMode must be 'asar' or 'simple'.");
      }
      return {
        checksumMode,
        checksumEnabled: value.checksumEnabled === void 0 ? true : value.checksumEnabled === true,
        asarSuperFxMoveShortAddress: value.asarSuperFxMoveShortAddress === true
      };
    };
    createInitialState = (context) => {
      const options = targetOptions(context.targetOptions);
      return {
        mapper: "lorom",
        sa1Banks: [0 << 20, 1 << 20, -1, -1, 2 << 20, 3 << 20, -1, -1],
        checksumEnabled: options.checksumEnabled,
        checksumMode: options.checksumMode,
        bankCrossMode: "full",
        readFunctionsEnabled: false,
        optimizeDirectPage: false,
        asarSuperFxMoveShortAddress: options.asarSuperFxMoveShortAddress,
        outputFillByte: 0,
        activeFreespaceStartOffset: null,
        activeFreespaceContentStartOffset: null,
        activeFreespaceEndOffset: null,
        inSpcBlock: false,
        spcBlock: null,
        spcPreviousArchitecture: null,
        spcInlineCompatibility: false,
        cpuStack: []
      };
    };
    plugin = definePlugin({
      manifest: {
        id: "uttori.asm-plugin-snes",
        name: "Uttori ASM SNES Plugin",
        version: "1.0.0",
        apiVersion: PLUGIN_API_VERSION,
        description: "SNES targets, architectures, directives, expressions, and Asar compatibility."
      },
      validateOptions: targetOptions,
      activate(context) {
        context.registerSessionState({
          id: SNES_SESSION_STATE_ID,
          create: createInitialState,
          clone: cloneSnesSessionState,
          resetForStage: (state) => {
            state.activeFreespaceStartOffset = null;
            state.activeFreespaceContentStartOffset = null;
            state.activeFreespaceEndOffset = null;
            state.inSpcBlock = false;
            state.spcBlock = null;
            state.spcPreviousArchitecture = null;
            state.spcInlineCompatibility = false;
          }
        });
        context.registerArchitecture({
          id: "snes.65816",
          aliases: ["65816", "65c816", "65802"],
          displayName: "WDC 65C816",
          unknownInstructionBehavior: "throw",
          splitOperands: splitSingleOperand,
          classifyOperand: ({ operands }, operand) => classify65816Operand(operands, operand),
          createEncoder: (factory) => new Arch65816(factory, () => factory.state.get(snesSessionStateKey).optimizeDirectPage),
          createDecoder: () => new Cpu65816Decoder(),
          instructionSpecifications: cpu65816Specifications,
          instructions: cpu65816Catalog
        });
        context.registerArchitecture({
          id: "snes.spc700",
          aliases: ["spc700", "spc700-raw", "spc700-inline"],
          displayName: "Sony SPC700",
          unknownInstructionBehavior: "throw",
          splitOperands: splitTopLevelCommaOperands,
          classifyOperand: ({ operands }, operand) => classifySpc700Operand(operands, operand),
          createEncoder: (factory) => new ArchSPC700(factory),
          createDecoder: () => new Spc700Decoder(),
          instructionSpecifications: spc700Specifications,
          instructions: spc700Catalog
        });
        context.registerArchitecture({
          id: "snes.superfx",
          aliases: ["superfx"],
          displayName: "Super FX",
          unknownInstructionBehavior: "returnFalse",
          splitOperands: splitCommaOperands,
          classifyOperand: ({ operands }, operand) => classifySuperFxOperand(operands, operand),
          createEncoder: (factory) => new ArchSuperFX(
            factory,
            () => factory.state.get(snesSessionStateKey).asarSuperFxMoveShortAddress
          ),
          createDecoder: () => new SuperFxDecoder(),
          instructionSpecifications: superFxSpecifications,
          instructions: superFxCatalog
        });
        context.registerAddressSpace({
          id: "snes.cpu",
          create: ({ state }) => {
            const mappingContext = () => {
              const targetState = state.get(snesSessionStateKey);
              return {
                mapper: targetState.mapper,
                sa1banks: targetState.sa1Banks,
                bankCrossCheckMode: targetState.bankCrossMode
              };
            };
            return {
              addressWidth: snesRomAddressSpace.addressWidth,
              defaultOrigin: snesRomAddressSpace.defaultOrigin,
              normalizeForWrite: (address4) => snesRomAddressSpace.normalizeForWrite(address4, mappingContext()),
              advance: (address4, amount) => snesRomAddressSpace.advance(address4, amount, mappingContext()),
              toOutputOffset: (address4) => snesRomAddressSpace.toOutputOffset(address4, mappingContext()),
              fromOutputOffset: (offset) => snesRomAddressSpace.fromOutputOffset(offset, mappingContext()),
              validateWrite: (address4, width) => {
                const targetState = state.get(snesSessionStateKey);
                const normalized = snesRomAddressSpace.normalizeForWrite(address4, mappingContext());
                if (snesRomAddressSpace.toOutputOffset(normalized, mappingContext()) < 0) return;
                if (targetState.bankCrossMode === "off" || width <= 1) return;
                const start = address4 & 16777215;
                const end = start + width - 1 & 16777215;
                const bankMask = targetState.bankCrossMode === "half" ? 2147450880 : 2147418112;
                if (((start ^ end) & bankMask) !== 0) {
                  const errorAddress = start + width & 16777215;
                  throw new Error(
                    `Ebank_border_crossed: A bank border was crossed, logical address $${errorAddress.toString(16).toUpperCase().padStart(6, "0")}.`
                  );
                }
              }
            };
          }
        });
        context.registerOutputFormat({
          id: "snes.sfc-output",
          create: ({ state }) => ({
            finalize: ({ outputBytes }) => {
              const targetState = state.get(snesSessionStateKey);
              if (!targetState.checksumEnabled) return;
              const headerOffset = getChecksumHeaderOffset(targetState.mapper);
              if (outputBytes.length < headerOffset + 32) return;
              outputBytes[headerOffset + 28] = 255;
              outputBytes[headerOffset + 29] = 255;
              outputBytes[headerOffset + 30] = 0;
              outputBytes[headerOffset + 31] = 0;
              const checksum = calculateHeaderChecksum(outputBytes, targetState.checksumMode);
              const complement = ~checksum & 65535;
              outputBytes[headerOffset + 28] = complement & 255;
              outputBytes[headerOffset + 29] = complement >> 8 & 255;
              outputBytes[headerOffset + 30] = checksum & 255;
              outputBytes[headerOffset + 31] = checksum >> 8 & 255;
            },
            getOutput: ({ outputBytes }) => Uint8Array.from(outputBytes)
          })
        });
        context.registerDirectiveSet({
          id: "snes.mapper-directives",
          directives: [
            directive(
              "snes.directive.mapper",
              MAPPER_KEYWORDS,
              ({ state }) => (_ctx, words) => handleMapper(state.get(snesSessionStateKey), words)
            )
          ]
        });
        context.registerDirectiveSet({
          id: "snes.policy-directives",
          tooling: toolingFor(["arch"]),
          directives: [
            directive(
              "snes.directive.check",
              ["check"],
              ({ state }) => (_ctx, words) => handleCheck(state.get(snesSessionStateKey), words)
            ),
            directive(
              "snes.directive.optimize",
              ["optimize"],
              ({ state }) => (_ctx, words) => handleOptimize(state.get(snesSessionStateKey), words)
            ),
            directive("snes.directive.asar-noops", ASAR_COMPAT_NO_OP_DIRECTIVES, () => () => void 0)
          ]
        });
        context.registerDirectiveSet({
          id: "snes.ca65-compat-directives",
          directives: [
            directive(
              "snes.directive.ca65.a8",
              [".a8"],
              ({ session }) => () => handleA8(session)
            ),
            directive(
              "snes.directive.ca65.a16",
              [".a16"],
              ({ session }) => () => handleA16(session)
            ),
            directive(
              "snes.directive.ca65.i8",
              [".i8"],
              ({ session }) => () => handleI8(session)
            ),
            directive(
              "snes.directive.ca65.i16",
              [".i16"],
              ({ session }) => () => handleI16(session)
            ),
            directive(
              "snes.directive.ca65.accu",
              [".accu"],
              ({ session }) => (_ctx, words) => handleAccu(session, words)
            ),
            directive(
              "snes.directive.ca65.index",
              [".index"],
              ({ session }) => (_ctx, words) => handleIndex(session, words)
            ),
            directive(
              "snes.directive.ca65.smart",
              [".smart"],
              ({ session }) => (_ctx, words) => handleSmart(session, words)
            ),
            directive(
              "snes.directive.ca65.setcpu",
              [".setcpu"],
              ({ session }) => (_ctx, words) => handleSetcpu(session, words)
            ),
            directive(
              "snes.directive.ca65.pushcpu",
              [".pushcpu"],
              ({ session, state }) => () => handlePushcpu(session, state.get(snesSessionStateKey))
            ),
            directive(
              "snes.directive.ca65.popcpu",
              [".popcpu"],
              ({ session, state }) => () => handlePopcpu(session, state.get(snesSessionStateKey))
            )
          ]
        });
        context.registerDirectiveSet({
          id: "snes.memory-directives",
          directives: [
            directive(
              "snes.directive.freespace",
              ["freecode", "freespace", "freedata"],
              ({ session, state }) => (_ctx, words) => handleFreespace(session, state.get(snesSessionStateKey), words)
            ),
            directive(
              "snes.directive.freespacebyte",
              ["freespacebyte"],
              ({ session, state }) => (_ctx, words) => handleFreespaceByte(session, state.get(snesSessionStateKey), words)
            ),
            directive(
              "snes.directive.prot",
              ["prot"],
              ({ session }) => (_ctx, words) => handleProt(session, words)
            )
          ]
        });
        context.registerDirectiveSet({
          id: "snes.spc-directives",
          directives: [
            directive(
              "snes.directive.spcblock",
              ["spcblock"],
              ({ session, state }) => (_ctx, words) => createSpcRuntime(session, state.get(snesSessionStateKey)).handleSpcblock(words)
            ),
            directive(
              "snes.directive.endspcblock",
              ["endspcblock"],
              ({ session, state }) => (_ctx, words) => createSpcRuntime(session, state.get(snesSessionStateKey)).handleEndSpcblock(words)
            ),
            directive(
              "snes.directive.startpos",
              ["startpos"],
              ({ session, state }) => (_ctx, words) => handleStartpos(session, state.get(snesSessionStateKey), words)
            )
          ]
        });
        context.registerExpressionSet(addressExpressions);
        context.registerExpressionSet(readExpressions);
        context.registerLifecycle({
          id: "snes.lifecycle",
          create: ({ state }) => ({
            onSessionCreated: ({ session }) => {
              session.outputFillByte = state.get(snesSessionStateKey).outputFillByte;
            },
            beforeDirective: ({ session, keyword, words }) => {
              const targetState = state.get(snesSessionStateKey);
              if (targetState.inSpcBlock && ["arch", "org", "namespace"].includes(keyword)) {
                throw new Error(`${keyword.toUpperCase()} is unavailable inside spcblock.`);
              }
              if (keyword === "org" && shouldRedirectOrgToSpcblock(targetState.spcInlineCompatibility)) {
                createSpcRuntime(session, targetState).handleSpcblock(["spcblock", ...words.slice(1)]);
                return "handled";
              }
              return "continue";
            },
            onArchitectureSelected: ({ sourceAlias }) => {
              const targetState = state.get(snesSessionStateKey);
              targetState.spcInlineCompatibility = shouldEnableSpcInlineCompat(sourceAlias);
              if (shouldUseNoromAddressing(sourceAlias)) {
                applyMapperSelection(targetState, "norom");
              }
            },
            shouldEndifCloseInnermostWhile: ({ loopType, loopStartLine, ifStartLine }) => shouldEndifCloseInnermostWhile(loopType, loopStartLine, ifStartLine),
            beforeWrite: ({ session, logicalAddress, width }) => {
              const targetState = state.get(snesSessionStateKey);
              if (targetState.activeFreespaceStartOffset === null) return;
              const outputOffset = session.outputWriter.toOutputOffset(logicalAddress);
              if (outputOffset < 0) return;
              const endOffset = outputOffset + width - 1;
              targetState.activeFreespaceEndOffset = Math.max(
                targetState.activeFreespaceEndOffset ?? endOffset,
                endOffset
              );
            },
            onStageEnd: ({ session }) => {
              createSpcRuntime(session, state.get(snesSessionStateKey)).finishPass();
            },
            beforeOutputFinalize: ({ outputBytes }) => {
              const targetState = state.get(snesSessionStateKey);
              const start = targetState.activeFreespaceStartOffset;
              const contentStart = targetState.activeFreespaceContentStartOffset;
              const end = targetState.activeFreespaceEndOffset;
              if (start === null || contentStart === null || end === null || end < contentStart) return;
              const lengthMinusOne = Math.max(0, end - contentStart) & 65535;
              const complement = ~lengthMinusOne & 65535;
              outputBytes[start + 4] = lengthMinusOne & 255;
              outputBytes[start + 5] = lengthMinusOne >> 8 & 255;
              outputBytes[start + 6] = complement & 255;
              outputBytes[start + 7] = complement >> 8 & 255;
            }
          })
        });
        context.registerTarget({
          id: SNES_TARGET_ID,
          aliases: ["snes", "sfc", "snes-65816"],
          displayName: "SNES",
          defaultArchitecture: "snes.65816",
          architectures: ["snes.65816", "snes.spc700", "snes.superfx"],
          addressSpace: "snes.cpu",
          outputFormat: "snes.sfc-output",
          directiveSets: [
            "snes.mapper-directives",
            "snes.memory-directives",
            "snes.policy-directives",
            "snes.spc-directives",
            "snes.ca65-compat-directives"
          ],
          expressionSets: ["snes.address-functions", "snes.read-functions"],
          lifecycle: ["snes.lifecycle"],
          syntaxProfile: ASAR_SYNTAX_PROFILE,
          defaultOutputExtension: ".sfc",
          createOptions: targetOptions
        });
      }
    });
  }
});

// packages/debug-sidecar-mesence/src/sidecar.ts
import { readFile } from "node:fs/promises";
import path2 from "node:path";

// packages/debug-adapter/src/contracts.ts
var DEBUG_BACKEND_PROTOCOL_VERSION = 1;

// packages/debug-adapter/src/capture-v2.ts
var maxU64 = (1n << 64n) - 1n;
var captureScope = (value) => {
  if (value !== "snes.65816.instructions" && value !== "snes.cpu-bus" && value !== "snes.cpu-bus-transfers" && value !== "snes.cpu-bus-ppu")
    throw new Error("Unsupported capture scope.");
  return value;
};
var captureU64 = (value) => {
  if (typeof value !== "string" || !/^(0|[1-9]\d{0,19})$/.test(value) || BigInt(value) > maxU64)
    throw new Error("Capture counter must be a canonical unsigned 64-bit decimal string.");
  return BigInt(value);
};
var captureSession = (value) => {
  if (typeof value !== "string" || !/^[\da-f]{32}$/.test(value))
    throw new Error("Invalid capture session identity.");
  return value;
};
var validateCaptureRequest = (value) => {
  if (!value || typeof value !== "object") throw new Error("Invalid capture request.");
  if (value.operation === "file-capabilities") {
    if (Object.keys(value).some((key) => !["operation", "scope"].includes(key)))
      throw new Error("Unsupported native file capability field.");
    if (value.scope !== void 0) captureScope(value.scope);
    return;
  }
  if (value.operation === "file-start") {
    if (Object.keys(value).some(
      (key) => ![
        "operation",
        "scope",
        "bufferBytes",
        "file",
        "romContentSha256",
        "producer",
        "measureStages"
      ].includes(key)
    ))
      throw new Error("Unsupported native file start field.");
    if (value.measureStages !== void 0 && typeof value.measureStages !== "boolean")
      throw new Error("Native file profiling must be boolean.");
    validateCaptureRequest({
      operation: "start",
      bufferBytes: value.bufferBytes,
      scope: value.scope
    });
    const bounded = (text, max) => typeof text === "string" && text.length > 0 && !text.includes("\0") && new TextEncoder().encode(text).length <= max;
    if (!bounded(value.file, 4096) || !/^(?:\/|[a-z]:[/\\]|\\\\)/i.test(value.file) || !/^[\da-f]{64}$/.test(value.romContentSha256) || !bounded(value.producer?.id, 256) || !bounded(value.producer?.revision, 1024) || Object.keys(value.producer).some((key) => !["id", "revision"].includes(key)))
      throw new Error(
        "Native file capture requires an absolute bounded path and exact ROM/producer identity."
      );
    return;
  }
  let fields = ["operation", "session"];
  if (value.operation === "capabilities") fields = ["operation", "scope"];
  if (value.operation === "start") fields = ["operation", "bufferBytes", "scope"];
  if (value.operation === "read") fields = ["operation", "session", "chunk"];
  if (value.operation === "ack") fields = ["operation", "session", "chunk", "event"];
  if (Object.keys(value).some((key) => !fields.includes(key)))
    throw new Error(
      "Unsupported capture negotiation field; capture requires an explicit supported stream with durable ownership."
    );
  if (value.operation === "capabilities" || value.operation === "start") {
    if (value.scope !== void 0) captureScope(value.scope);
  }
  if (value.operation === "capabilities") return;
  if (value.operation === "start") {
    if (!Number.isSafeInteger(value.bufferBytes) || value.bufferBytes < 4718656 || value.bufferBytes > 64 * 1024 * 1024)
      throw new Error("Capture buffer must be between 4718656 bytes and 64 MiB.");
    return;
  }
  captureSession(value.session);
  if ([
    "status",
    "stop",
    "abort",
    "release",
    "file-status",
    "file-stop",
    "file-abort",
    "file-release"
  ].includes(value.operation))
    return;
  if (value.operation === "read" || value.operation === "ack") {
    if (!captureU64(value.chunk)) throw new Error("Capture chunk sequence starts at one.");
    if (value.operation === "ack" && !captureU64(value.event))
      throw new Error("Capture event sequence starts at one.");
    return;
  }
  throw new Error("Unsupported capture operation.");
};
var crcTable = Uint32Array.from({ length: 256 }, (_, byte) => {
  let crc = byte;
  for (let bit2 = 0; bit2 < 8; bit2++) crc = crc >>> 1 ^ (crc & 1 ? 2197175160 : 0);
  return crc >>> 0;
});
var crcSlices = [crcTable];
for (let slice = 1; slice < 8; slice++)
  crcSlices.push(
    Uint32Array.from(crcSlices[slice - 1], (crc) => crc >>> 8 ^ crcTable[crc & 255])
  );

// packages/debug-adapter/src/sidecar-protocol.ts
var DEBUG_SIDECAR_PROTOCOL = "uttori-asm-debug-sidecar";
var DEBUG_SIDECAR_PROTOCOL_VERSION = 1;
var DEBUG_SIDECAR_COMMANDS = Object.freeze([
  "initialize",
  "connect",
  "disconnect",
  "pause",
  "continue",
  "step",
  "threads",
  "stackFrames",
  "registers",
  "readMemory",
  "setBreakpoints",
  "disassemble",
  "startTrace",
  "readTrace",
  "stopTrace",
  "capture",
  "ping",
  "shutdown"
]);
var DEBUG_SIDECAR_EVENTS = Object.freeze([
  "stopped",
  "continued",
  "terminated",
  "breakpoint",
  "output"
]);
var DEFAULT_DEBUG_SIDECAR_LIMITS = Object.freeze({
  maxFrameBytes: 1048576,
  maxBufferedBytes: 2097152,
  maxMemoryReadBytes: 1048576,
  maxDisassemblyInstructions: 4096,
  maxBreakpoints: 4096,
  maxTraceBatchEvents: 4096,
  maxQueuedMessages: 1024,
  maxQueuedBytes: 8388608
});
var isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
var positiveInteger = (value) => typeof value === "number" && Number.isSafeInteger(value) && value > 0;
var nonNegativeInteger = (value) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
var sessionPattern = /^[\w-]{32,128}$/;
function assertDebugSidecarSessionToken(value) {
  if (typeof value !== "string" || !sessionPattern.test(value))
    throw new Error("Sidecar session token must be 32-128 base64url characters.");
}
var assertRequestBounds = (message, limits) => {
  const args = message.arguments ?? {};
  if (!isRecord(args)) throw new Error("Sidecar request arguments must be an object.");
  if (message.command === "readMemory") {
    const count = args.count;
    if (!nonNegativeInteger(count) || count > limits.maxMemoryReadBytes)
      throw new Error(`Memory read count must be between 0 and ${limits.maxMemoryReadBytes}.`);
  }
  if (message.command === "disassemble") {
    const count = args.count;
    if (!nonNegativeInteger(count) || count > limits.maxDisassemblyInstructions)
      throw new Error(
        `Disassembly count must be between 0 and ${limits.maxDisassemblyInstructions}.`
      );
  }
  if (message.command === "setBreakpoints") {
    const breakpoints = args.breakpoints;
    if (!Array.isArray(breakpoints) || breakpoints.length > limits.maxBreakpoints)
      throw new Error(`Breakpoint count must be between 0 and ${limits.maxBreakpoints}.`);
  }
  if (message.command === "readTrace") {
    const maxEvents = args.maxEvents;
    if (!positiveInteger(maxEvents) || maxEvents > limits.maxTraceBatchEvents)
      throw new Error(`Trace batch size must be between 1 and ${limits.maxTraceBatchEvents}.`);
  }
};
function assertDebugSidecarMessage(value, limits = DEFAULT_DEBUG_SIDECAR_LIMITS) {
  if (!isRecord(value)) throw new Error("Sidecar message must be an object.");
  if (value.protocol !== DEBUG_SIDECAR_PROTOCOL)
    throw new Error(`Unsupported sidecar protocol '${String(value.protocol)}'.`);
  if (value.version !== DEBUG_SIDECAR_PROTOCOL_VERSION)
    throw new Error(`Unsupported sidecar protocol version '${String(value.version)}'.`);
  assertDebugSidecarSessionToken(value.session);
  if (!positiveInteger(value.sequence))
    throw new Error("Sidecar message sequence must be a positive safe integer.");
  if (value.type === "request") {
    if (!DEBUG_SIDECAR_COMMANDS.includes(value.command))
      throw new Error(`Unsupported sidecar command '${String(value.command)}'.`);
    assertRequestBounds(value, limits);
    return;
  }
  if (value.type === "response") {
    if (!positiveInteger(value.requestSequence))
      throw new Error("Sidecar response requestSequence must be a positive safe integer.");
    if (typeof value.success !== "boolean")
      throw new Error("Sidecar response success must be boolean.");
    if (!value.success && typeof value.error !== "string")
      throw new Error("Failed sidecar response must include an error string.");
    return;
  }
  if (value.type === "event") {
    if (!DEBUG_SIDECAR_EVENTS.includes(value.event))
      throw new Error(`Unsupported sidecar event '${String(value.event)}'.`);
    if (!isRecord(value.body)) throw new Error("Sidecar event body must be an object.");
    return;
  }
  throw new Error(`Unsupported sidecar message type '${String(value.type)}'.`);
}
var validateLimits = (limits) => {
  for (const [name, value] of Object.entries(limits)) {
    if (!positiveInteger(value)) throw new Error(`${name} must be a positive safe integer.`);
  }
  if (limits.maxBufferedBytes < limits.maxFrameBytes + 4)
    throw new Error("maxBufferedBytes must hold at least one complete framed message.");
};
var encodeDebugSidecarMessage = (message, limits = DEFAULT_DEBUG_SIDECAR_LIMITS) => {
  validateLimits(limits);
  assertDebugSidecarMessage(message, limits);
  const body = Buffer.from(JSON.stringify(message), "utf8");
  if (body.length > limits.maxFrameBytes)
    throw new Error(`Sidecar frame exceeds ${limits.maxFrameBytes} bytes.`);
  const frame = Buffer.allocUnsafe(body.length + 4);
  frame.writeUInt32BE(body.length, 0);
  body.copy(frame, 4);
  return frame;
};
var DebugSidecarMessageParser = class {
  #limits;
  #buffer = Buffer.alloc(0);
  #lastSequence = 0;
  /**
   * Creates one directional stream parser.
   * @param {DebugSidecarProtocolLimits} limits Framing and request limits.
   */
  constructor(limits = DEFAULT_DEBUG_SIDECAR_LIMITS) {
    validateLimits(limits);
    this.#limits = limits;
  }
  /**
   * Adds a transport chunk and returns every complete validated message in order.
   * @param {Uint8Array} chunk Next stdio or socket bytes.
   * @returns {DebugSidecarMessage[]} Complete messages decoded from the stream.
   */
  push(chunk) {
    if (this.#buffer.length + chunk.length > this.#limits.maxBufferedBytes)
      throw new Error(`Sidecar receive buffer exceeds ${this.#limits.maxBufferedBytes} bytes.`);
    this.#buffer = Buffer.concat([this.#buffer, chunk]);
    const messages = [];
    while (this.#buffer.length >= 4) {
      const length = this.#buffer.readUInt32BE(0);
      if (length === 0) throw new Error("Sidecar frame body cannot be empty.");
      if (length > this.#limits.maxFrameBytes)
        throw new Error(`Sidecar frame declares ${length} bytes, above the configured limit.`);
      if (this.#buffer.length < length + 4) break;
      const body = this.#buffer.subarray(4, length + 4);
      this.#buffer = this.#buffer.subarray(length + 4);
      let decoded;
      try {
        decoded = JSON.parse(body.toString("utf8"));
      } catch {
        throw new Error("Sidecar frame contains invalid JSON.");
      }
      assertDebugSidecarMessage(decoded, this.#limits);
      if (decoded.sequence <= this.#lastSequence)
        throw new Error(
          `Sidecar sequence ${decoded.sequence} is not greater than ${this.#lastSequence}.`
        );
      this.#lastSequence = decoded.sequence;
      messages.push(decoded);
    }
    return messages;
  }
};
var DebugSidecarMessageQueue = class {
  #limits;
  #frames = [];
  #bytes = 0;
  /**
   * Creates a bounded outgoing queue.
   * @param {DebugSidecarProtocolLimits} limits Framing and queue limits.
   */
  constructor(limits = DEFAULT_DEBUG_SIDECAR_LIMITS) {
    validateLimits(limits);
    this.#limits = limits;
  }
  /** @returns {number} Number of queued protocol messages. */
  get length() {
    return this.#frames.length;
  }
  /** @returns {number} Encoded bytes currently retained for transport backpressure. */
  get bytes() {
    return this.#bytes;
  }
  /**
   * Encodes and appends one message, failing the connection when bounds would be exceeded.
   * @param {DebugSidecarMessage} message Next ordered message.
   * @returns {void}
   */
  enqueue(message) {
    const frame = encodeDebugSidecarMessage(message, this.#limits);
    if (this.#frames.length >= this.#limits.maxQueuedMessages || this.#bytes + frame.length > this.#limits.maxQueuedBytes)
      throw new Error("Sidecar outgoing queue exceeded its backpressure limit.");
    this.#frames.push(frame);
    this.#bytes += frame.length;
  }
  /**
   * Removes the oldest encoded frame.
   * @returns {Uint8Array | undefined} Oldest frame or undefined when empty.
   */
  dequeue() {
    const frame = this.#frames.shift();
    if (frame) this.#bytes -= frame.length;
    return frame;
  }
};

// packages/debug-adapter/src/node-stdio-transport.ts
var DEBUG_SIDECAR_SESSION_ENV = "UTTORI_ASM_DEBUG_SESSION";

// packages/debug-adapter/src/sidecar-server.ts
var stepKinds = /* @__PURE__ */ new Set(["instruction", "over", "in", "out"]);
var record = (value, context) => {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error(`${context} must be an object.`);
  return value;
};
var integer = (value, context, minimum = 0) => {
  if (!Number.isSafeInteger(value) || value < minimum)
    throw new Error(`${context} must be a safe integer greater than or equal to ${minimum}.`);
  return value;
};
var positiveInteger2 = (value, context) => integer(value, context, 1);
var string = (value, context) => {
  if (typeof value !== "string" || value.length === 0)
    throw new Error(`${context} must be a non-empty string.`);
  return value;
};
var optionalPositiveInteger = (value, context) => value === void 0 ? void 0 : positiveInteger2(value, context);
var boolean = (value, context, defaultValue) => {
  if (value === void 0) return defaultValue;
  if (typeof value !== "boolean") throw new Error(`${context} must be boolean.`);
  return value;
};
var address = (value, context) => {
  const candidate = record(value, context);
  if (typeof candidate.architecture !== "string" || candidate.architecture.length === 0)
    throw new Error(`${context}.architecture must be a non-empty string.`);
  if (typeof candidate.addressSpace !== "string" || candidate.addressSpace.length === 0)
    throw new Error(`${context}.addressSpace must be a non-empty string.`);
  const outputOffset = candidate.outputOffset === void 0 ? void 0 : integer(candidate.outputOffset, `${context}.outputOffset`);
  return {
    architecture: candidate.architecture,
    addressSpace: candidate.addressSpace,
    address: integer(candidate.address, `${context}.address`),
    ...outputOffset === void 0 ? {} : { outputOffset }
  };
};
var addresses = (value, context) => {
  if (!Array.isArray(value)) throw new Error(`${context} must be an array.`);
  return value.map((entry, index) => address(entry, `${context}[${index}]`));
};
var asError = (error) => error instanceof Error ? error : new Error(String(error));
var DebugSidecarServer = class {
  #backendName;
  #implementation;
  #session;
  #write;
  #closeTransport;
  #parser;
  #outgoing;
  #eventSubscription;
  #serverSequence = 1;
  #capturedEvents;
  #receiveTail = Promise.resolve();
  #writeTail = Promise.resolve();
  #closed = false;
  /**
   * Creates a server around an emulator-neutral backend implementation.
   * @param {DebugSidecarServerOptions} options Identity, backend, transport, and safety bounds.
   */
  constructor(options) {
    if (typeof options.backend !== "string" || options.backend.length === 0)
      throw new Error("Sidecar backend name must be a non-empty string.");
    assertDebugSidecarSessionToken(options.session);
    this.#backendName = options.backend;
    this.#implementation = options.implementation;
    this.#session = options.session;
    this.#write = options.write;
    this.#closeTransport = options.close ?? (() => Promise.resolve());
    const limits = options.limits ?? DEFAULT_DEBUG_SIDECAR_LIMITS;
    this.#parser = new DebugSidecarMessageParser(limits);
    this.#outgoing = new DebugSidecarMessageQueue(limits);
    this.#eventSubscription = this.#implementation.onEvent((event) => this.#backendEvent(event));
  }
  /** @returns {boolean} Whether the server has permanently closed. */
  get closed() {
    return this.#closed;
  }
  /**
   * Accepts the next transport chunk. Calls are serialized even when the stream producer overlaps them.
   * @param {Uint8Array} data Framed protocol bytes from the client.
   * @returns {Promise<void>} Completion after every request in this chunk has been dispatched.
   */
  receive(data) {
    if (this.#closed) return Promise.reject(new Error("Sidecar server is closed."));
    const receive = this.#receiveTail.then(() => this.#receive(data));
    this.#receiveTail = receive.catch(() => void 0);
    return receive.catch(async (error) => {
      await this.close(asError(error));
      throw error;
    });
  }
  /**
   * Flushes queued output and closes the server transport exactly once.
   * @param {Error} error Optional terminal protocol or transport failure.
   * @returns {Promise<void>} Completion of transport cleanup.
   */
  async close(error) {
    if (this.#closed) return;
    this.#closed = true;
    this.#eventSubscription.dispose();
    await this.#writeTail.catch(() => void 0);
    await this.#closeTransport(error);
  }
  async #receive(data) {
    for (const message of this.#parser.push(data)) {
      if (message.session !== this.#session)
        throw new Error("Sidecar request session does not match this connection.");
      if (message.type !== "request")
        throw new Error("Sidecar client sent a non-request message on a server-only channel.");
      await this.#handle(message);
    }
  }
  async #handle(request) {
    const events = [];
    this.#capturedEvents = events;
    let result;
    let failure;
    try {
      result = await this.#dispatch(request);
    } catch (error) {
      failure = asError(error);
    } finally {
      this.#capturedEvents = void 0;
    }
    await this.#send(
      this.#envelope({
        type: "response",
        requestSequence: request.sequence,
        success: failure === void 0,
        ...failure ? { error: failure.message } : { result }
      })
    );
    for (const event of events) await this.#send(this.#eventEnvelope(event));
    if (request.command === "shutdown" && !failure) await this.close();
  }
  async #dispatch(request) {
    const args = record(request.arguments ?? {}, "Sidecar request arguments");
    if (request.command === "initialize") {
      if (args.backend !== this.#backendName) throw new Error("Unexpected backend identity.");
      if (args.backendProtocolVersion !== DEBUG_BACKEND_PROTOCOL_VERSION)
        throw new Error("Unsupported backend protocol version.");
      return {
        backend: this.#backendName,
        backendProtocolVersion: DEBUG_BACKEND_PROTOCOL_VERSION,
        capabilities: this.#implementation.capabilities
      };
    }
    if (request.command === "connect") {
      await this.#implementation.connect({
        reset: boolean(args.reset, "Connect reset", true)
      });
      return { capabilities: this.#implementation.capabilities };
    }
    if (request.command === "disconnect") {
      await this.#implementation.disconnect({
        terminate: boolean(args.terminate, "Disconnect terminate", true)
      });
      return {};
    }
    if (request.command === "pause") {
      await this.#implementation.pause(optionalPositiveInteger(args.threadId, "Pause threadId"));
      return {};
    }
    if (request.command === "continue") {
      await this.#implementation.continue(
        optionalPositiveInteger(args.threadId, "Continue threadId")
      );
      return {};
    }
    if (request.command === "step") {
      if (!stepKinds.has(args.kind))
        throw new Error(`Unsupported step kind '${String(args.kind)}'.`);
      await this.#implementation.step(
        positiveInteger2(args.threadId, "Step threadId"),
        args.kind
      );
      return {};
    }
    if (request.command === "threads") return this.#implementation.threads();
    if (request.command === "stackFrames")
      return this.#implementation.stackFrames(
        positiveInteger2(args.threadId, "Stack frames threadId")
      );
    if (request.command === "registers")
      return this.#implementation.registers(positiveInteger2(args.frameId, "Registers frameId"));
    if (request.command === "readMemory") {
      const memory = await this.#implementation.readMemory(
        address(args.address, "Memory address"),
        integer(args.count, "Memory count")
      );
      return {
        address: memory.address,
        data: Buffer.from(memory.bytes).toString("base64"),
        unreadableBytes: memory.unreadableBytes
      };
    }
    if (request.command === "setBreakpoints")
      return this.#implementation.setBreakpoints(
        addresses(args.breakpoints, "Breakpoint addresses")
      );
    if (request.command === "disassemble")
      return this.#implementation.disassemble(
        address(args.address, "Disassembly address"),
        integer(args.count, "Disassembly count")
      );
    if (request.command === "capture") {
      const capture = args;
      validateCaptureRequest(capture);
      if (!this.#implementation.capture)
        throw new Error("This backend does not support capture v2.");
      return this.#implementation.capture(capture);
    }
    if (request.command === "startTrace") {
      if (args.detail !== void 0 && args.detail !== "pc" && args.detail !== "full")
        throw new Error("Trace detail must be pc or full.");
      await this.#implementation.startTrace({
        architecture: string(args.architecture, "Trace architecture"),
        addressSpace: string(args.addressSpace, "Trace address space"),
        ...args.detail === void 0 ? {} : { detail: args.detail }
      });
      return {};
    }
    if (request.command === "readTrace")
      return this.#implementation.readTrace(positiveInteger2(args.maxEvents, "Trace batch size"));
    if (request.command === "stopTrace") {
      await this.#implementation.stopTrace();
      return {};
    }
    if (request.command === "ping") return { pong: true };
    if (request.command === "shutdown") return {};
    throw new Error(`Unsupported command '${String(request.command)}'.`);
  }
  #backendEvent(event) {
    if (this.#closed) return;
    if (this.#capturedEvents) {
      this.#capturedEvents.push(event);
      return;
    }
    void this.#send(this.#eventEnvelope(event)).catch(
      (error) => this.close(asError(error))
    );
  }
  #eventEnvelope(event) {
    if (event.type === "stopped")
      return this.#envelope({
        type: "event",
        event: "stopped",
        body: { reason: event.reason, threadId: event.threadId }
      });
    if (event.type === "continued")
      return this.#envelope({
        type: "event",
        event: "continued",
        body: { threadId: event.threadId, allThreads: event.allThreads }
      });
    if (event.type === "terminated")
      return this.#envelope({
        type: "event",
        event: "terminated",
        body: { restart: event.restart }
      });
    if (event.type === "breakpoint")
      return this.#envelope({
        type: "event",
        event: "breakpoint",
        body: { breakpoint: event.breakpoint }
      });
    return this.#envelope({
      type: "event",
      event: "output",
      body: { category: event.category, text: event.text }
    });
  }
  #envelope(message) {
    if (!Number.isSafeInteger(this.#serverSequence) || this.#serverSequence <= 0)
      throw new Error("Sidecar server sequence exhausted.");
    return {
      protocol: DEBUG_SIDECAR_PROTOCOL,
      version: DEBUG_SIDECAR_PROTOCOL_VERSION,
      session: this.#session,
      sequence: this.#serverSequence++,
      ...message
    };
  }
  #send(message) {
    if (this.#closed) return Promise.reject(new Error("Sidecar server is closed."));
    this.#outgoing.enqueue(message);
    const write2 = this.#writeTail.then(async () => {
      let frame = this.#outgoing.dequeue();
      while (frame) {
        await this.#write(frame);
        frame = this.#outgoing.dequeue();
      }
    });
    this.#writeTail = write2.catch(() => void 0);
    return write2;
  }
};

// packages/debug-sidecar-mesence/src/mesen-backend.ts
init_src();
import { Buffer as Buffer2 } from "node:buffer";
init_src2();

// packages/debug-sidecar-mesence/src/profile.ts
var MESEN_BACKEND_ID = "mesence-debug-server";
var MESEN_NATIVE_PROTOCOL_VERSION = 1;
var MESEN_65816_ARCHITECTURE = "snes.65816";
var MESEN_SPC700_ARCHITECTURE = "snes.spc700";
var MESEN_SUPERFX_ARCHITECTURE = "snes.superfx";
var MESEN_65816_ADDRESS_SPACE = "snes.cpu";
var MESEN_65816_WRAM_ADDRESS_SPACE = "snes.wram";
var MESEN_65816_ROM_ADDRESS_SPACE = "snes.cartridge-rom";
var MESEN_SPC700_ADDRESS_SPACE = "spc.aram";
var MESEN_SUPERFX_ROM_ADDRESS_SPACE = "superfx.rom";
var MESEN_SUPERFX_RAM_ADDRESS_SPACE = "superfx.ram";
var MESEN_NATIVE_MAX_MEMORY_READ = 4096;
var MESEN_STEP_KINDS = Object.freeze(["instruction", "in"]);
var MESEN_CAPABILITIES = Object.freeze({
  pause: true,
  step: true,
  stepKinds: MESEN_STEP_KINDS,
  registers: true,
  memory: true,
  stackFrames: true,
  breakpoints: true,
  disassemble: true,
  reconnect: true,
  architectures: Object.freeze([
    Object.freeze({
      architecture: MESEN_65816_ARCHITECTURE,
      addressSpaces: Object.freeze([
        MESEN_65816_ADDRESS_SPACE,
        MESEN_65816_WRAM_ADDRESS_SPACE,
        MESEN_65816_ROM_ADDRESS_SPACE
      ]),
      memorySpaces: Object.freeze([
        Object.freeze({ addressSpace: MESEN_65816_WRAM_ADDRESS_SPACE, sideEffectFree: true }),
        Object.freeze({ addressSpace: MESEN_65816_ROM_ADDRESS_SPACE, sideEffectFree: true })
      ]),
      trace: null,
      pause: true,
      step: true,
      stepKinds: MESEN_STEP_KINDS,
      registers: true,
      memory: true,
      stackFrames: true,
      breakpoints: true,
      disassemble: true
    }),
    Object.freeze({
      architecture: MESEN_SPC700_ARCHITECTURE,
      addressSpaces: Object.freeze([MESEN_SPC700_ADDRESS_SPACE]),
      memorySpaces: Object.freeze([
        Object.freeze({ addressSpace: MESEN_SPC700_ADDRESS_SPACE, sideEffectFree: true })
      ]),
      trace: null,
      pause: true,
      step: true,
      stepKinds: MESEN_STEP_KINDS,
      registers: true,
      memory: true,
      stackFrames: true,
      breakpoints: false,
      disassemble: true
    }),
    Object.freeze({
      architecture: MESEN_SUPERFX_ARCHITECTURE,
      addressSpaces: Object.freeze([
        MESEN_SUPERFX_ROM_ADDRESS_SPACE,
        MESEN_SUPERFX_RAM_ADDRESS_SPACE
      ]),
      memorySpaces: Object.freeze([
        Object.freeze({ addressSpace: MESEN_SUPERFX_ROM_ADDRESS_SPACE, sideEffectFree: true }),
        Object.freeze({ addressSpace: MESEN_SUPERFX_RAM_ADDRESS_SPACE, sideEffectFree: true })
      ]),
      trace: null,
      pause: true,
      step: true,
      stepKinds: MESEN_STEP_KINDS,
      registers: true,
      memory: true,
      stackFrames: true,
      breakpoints: false,
      disassemble: true
    })
  ])
});

// packages/debug-sidecar-mesence/src/mesen-backend.ts
var threads = Object.freeze({
  "65816": Object.freeze({
    id: 1,
    frameId: 1,
    name: "Main CPU",
    architecture: MESEN_65816_ARCHITECTURE,
    processor: "65816"
  }),
  spc700: Object.freeze({
    id: 2,
    frameId: 2,
    name: "Sound CPU",
    architecture: MESEN_SPC700_ARCHITECTURE,
    processor: "spc700"
  }),
  superfx: Object.freeze({
    id: 3,
    frameId: 3,
    name: "Super FX",
    architecture: MESEN_SUPERFX_ARCHITECTURE,
    processor: "superfx"
  })
});
var memorySpaces = Object.freeze({
  [MESEN_65816_ADDRESS_SPACE]: Object.freeze({
    processor: "65816",
    native: "SnesMemory",
    maximumAddress: 16777215
  }),
  [MESEN_65816_WRAM_ADDRESS_SPACE]: Object.freeze({
    processor: "65816",
    native: "SnesWorkRam",
    maximumAddress: 131071
  }),
  [MESEN_65816_ROM_ADDRESS_SPACE]: Object.freeze({
    processor: "65816",
    native: "SnesPrgRom",
    maximumAddress: 16777215
  }),
  [MESEN_SPC700_ADDRESS_SPACE]: Object.freeze({
    processor: "spc700",
    native: "SpcRam",
    maximumAddress: 65535
  }),
  [MESEN_SUPERFX_ROM_ADDRESS_SPACE]: Object.freeze({
    processor: "superfx",
    native: "GsuMemory",
    maximumAddress: 16777215
  }),
  [MESEN_SUPERFX_RAM_ADDRESS_SPACE]: Object.freeze({
    processor: "superfx",
    native: "GsuWorkRam",
    maximumAddress: 16777215
  })
});
var asError2 = (error) => error instanceof Error ? error : new Error(String(error));
var record2 = (value, context) => {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error(`${context} must be an object.`);
  return value;
};
var integer2 = (value, context, maximum = Number.MAX_SAFE_INTEGER) => {
  if (!Number.isSafeInteger(value) || value < 0 || value > maximum)
    throw new Error(`${context} must be an integer between 0 and ${maximum}.`);
  return value;
};
var boolean2 = (value, context) => {
  if (typeof value !== "boolean") throw new Error(`${context} must be a boolean.`);
  return value;
};
var string2 = (value, context) => {
  if (typeof value !== "string") throw new Error(`${context} must be a string.`);
  return value;
};
var processor = (value, context) => {
  const name = string2(value, context);
  if (name !== "65816" && name !== "spc700" && name !== "superfx")
    throw new Error(`${context} is unsupported.`);
  return name;
};
var maximumPc = (cpu) => cpu === "spc700" ? 65535 : 16777215;
var parseHello = (value) => {
  const input = record2(value, "Mesen hello");
  if (integer2(input.protocolVersion, "Mesen native protocol version") !== MESEN_NATIVE_PROTOCOL_VERSION)
    throw new Error(
      `Mesen native protocol version ${String(input.protocolVersion)} is unsupported.`
    );
  if (string2(input.emulator, "Mesen emulator identity") !== "MesenCE")
    throw new Error("Mesen emulator identity is unsupported.");
  if (!Array.isArray(input.processors) || input.processors.length === 0 || input.processors.length > 3)
    throw new Error("Mesen processor list must contain between one and three entries.");
  const available = input.processors.map(
    (entry, index) => processor(entry, `Mesen processor ${index}`)
  );
  if (new Set(available).size !== available.length || !available.includes("65816"))
    throw new Error("Mesen processor list must contain one unique 65816 entry.");
  const maxMemoryRead = integer2(input.maxMemoryRead, "Mesen maximum memory read", 1048576);
  if (maxMemoryRead < 1) throw new Error("Mesen maximum memory read must be positive.");
  return {
    stopped: boolean2(input.stopped, "Mesen stopped state"),
    processors: available,
    maxMemoryRead
  };
};
var parseStatus = (value, expected) => {
  const input = record2(value, "Mesen status");
  const cpu = processor(input.cpu, "Mesen status processor");
  if (cpu !== expected)
    throw new Error(`Mesen status processor '${cpu}' did not match requested '${expected}'.`);
  return {
    stopped: boolean2(input.stopped, "Mesen status stopped state"),
    cpu,
    programCounter: integer2(input.programCounter, "Mesen status program counter", maximumPc(cpu)),
    registers: record2(input.registers, "Mesen status registers")
  };
};
var parseResume = (value, expected) => {
  const input = record2(value, "Mesen resume response");
  const cpu = processor(input.cpu, "Mesen resume processor");
  if (cpu !== expected)
    throw new Error(`Mesen resume processor '${cpu}' did not match requested '${expected}'.`);
  return boolean2(input.stopped, "Mesen resume stopped state");
};
var registerInteger = (registers2, name, bits) => integer2(
  registers2[name],
  `Mesen register ${name}`,
  bits > 32 ? Number.MAX_SAFE_INTEGER : 2 ** bits - 1
);
var registerHex = (value, bits) => value.toString(16).toUpperCase().padStart(Math.ceil(bits / 4), "0");
var debugRegister = (registers2, name, bits, outputName = name) => ({
  name: outputName,
  value: registerHex(registerInteger(registers2, name, bits), bits),
  bits,
  group: "CPU"
});
var debugFlag = (registers2, nativeName, outputName = nativeName) => ({
  name: outputName,
  value: boolean2(registers2[nativeName], `Mesen register ${nativeName}`) ? "1" : "0",
  bits: 1,
  group: "Flags"
});
var delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
var MesenDebugBackend = class {
  protocolVersion = DEBUG_BACKEND_PROTOCOL_VERSION;
  capabilities = MESEN_CAPABILITIES;
  #createClient;
  #terminate;
  #pollIntervalMs;
  #listeners = /* @__PURE__ */ new Set();
  #expectedClose = /* @__PURE__ */ new WeakSet();
  #breakpoints = /* @__PURE__ */ new Map();
  #cpuDecoder = new Cpu65816Decoder();
  #spcDecoder = new Spc700Decoder();
  #superFxDecoder = new SuperFxDecoder();
  #client;
  #closeSubscription;
  #availableProcessors = [];
  #maxMemoryRead = MESEN_NATIVE_MAX_MEMORY_READ;
  #connected = false;
  #stopped = false;
  #executionEpoch = 0;
  #nextBreakpointId = 1;
  /** @param {MesenDebugBackendOptions} options Native client and process lifecycle hooks. */
  constructor(options) {
    this.#createClient = options.createClient;
    this.#terminate = options.terminate ?? (() => Promise.resolve());
    this.#pollIntervalMs = options.pollIntervalMs ?? 16;
    integer2(this.#pollIntervalMs, "Mesen status poll interval", 6e4);
    if (this.#pollIntervalMs < 1) throw new Error("Mesen status poll interval must be positive.");
  }
  /** @inheritdoc */
  async connect(options = {}) {
    if (this.#connected) throw new Error("Mesen backend is already connected.");
    if (this.#client) await this.#releaseClient(this.#client);
    const client = await this.#createClient({ reset: options.reset ?? true });
    if (client.closed) throw new Error("Mesen client factory returned a closed client.");
    this.#client = client;
    this.#closeSubscription = client.onClose((error) => this.#clientClosed(client, error));
    try {
      const hello = parseHello(await client.request("hello"));
      this.#availableProcessors = hello.processors;
      this.#maxMemoryRead = hello.maxMemoryRead;
      let stopped = hello.stopped;
      if (options.reset ?? true) stopped = (await this.#statusRequest("reset", "65816")).stopped;
      else if (!stopped) stopped = (await this.#statusRequest("pause", "65816")).stopped;
      if (!stopped) throw new Error("Mesen did not reach a coherent stopped state during connect.");
      this.#connected = true;
      this.#stopped = true;
      this.#emit({ type: "stopped", reason: "entry", threadId: threads["65816"].id });
    } catch (error) {
      this.#expectedClose.add(client);
      await this.#releaseClient(client);
      throw error;
    }
  }
  /** @inheritdoc */
  async disconnect(options = {}) {
    const client = this.#requireConnected();
    const terminate = options.terminate ?? true;
    this.#executionEpoch++;
    this.#expectedClose.add(client);
    let failure;
    if (terminate) {
      try {
        await client.request("shutdown");
      } catch (error) {
        failure = asError2(error);
      }
    }
    await this.#releaseClient(client).catch((error) => {
      failure ??= asError2(error);
    });
    this.#breakpoints.clear();
    this.#availableProcessors = [];
    this.#stopped = false;
    if (terminate) {
      await this.#terminate().catch((error) => {
        failure ??= asError2(error);
      });
      this.#emit({ type: "terminated", restart: false });
    }
    if (failure) throw failure;
  }
  /** @inheritdoc */
  async pause(threadId) {
    const descriptor2 = this.#thread(threadId ?? threads["65816"].id);
    if (this.#stopped) return;
    this.#executionEpoch++;
    const status = await this.#statusRequest("pause", descriptor2.processor);
    if (!status.stopped) throw new Error("Mesen pause completed without a stopped state.");
    this.#stopped = true;
    this.#emit({ type: "stopped", reason: "pause", threadId: descriptor2.id });
  }
  /** @inheritdoc */
  async continue(threadId) {
    const descriptor2 = this.#thread(threadId ?? threads["65816"].id);
    this.#requireStopped();
    this.#stopped = false;
    const epoch = ++this.#executionEpoch;
    this.#emit({ type: "continued", threadId: descriptor2.id, allThreads: true });
    parseResume(
      await this.#requireClient().request("resume", { cpu: descriptor2.processor }),
      descriptor2.processor
    );
    void this.#pollForStop(descriptor2, epoch);
  }
  /** @inheritdoc */
  async step(threadId, kind) {
    const descriptor2 = this.#thread(threadId);
    if (kind !== "instruction" && kind !== "in")
      throw new Error(`Mesen does not support ${kind} stepping for ${descriptor2.name}.`);
    this.#requireStopped();
    this.#stopped = false;
    const epoch = ++this.#executionEpoch;
    this.#emit({ type: "continued", threadId: descriptor2.id, allThreads: true });
    const status = await this.#statusRequest("step", descriptor2.processor);
    if (!status.stopped) throw new Error("Mesen instruction step completed without stopping.");
    if (epoch !== this.#executionEpoch) return;
    this.#stopped = true;
    this.#emit({ type: "stopped", reason: "step", threadId: descriptor2.id });
  }
  /** @inheritdoc */
  threads() {
    this.#requireConnected();
    return Promise.resolve(
      this.#availableProcessors.map((cpu) => {
        const descriptor2 = threads[cpu];
        return { id: descriptor2.id, name: descriptor2.name, architecture: descriptor2.architecture };
      })
    );
  }
  /** @inheritdoc */
  async stackFrames(threadId) {
    const descriptor2 = this.#thread(threadId);
    const status = await this.#readStatus(descriptor2.processor);
    return [
      {
        id: descriptor2.frameId,
        threadId: descriptor2.id,
        name: descriptor2.name,
        pc: this.#executionAddress(descriptor2.processor, status.programCounter),
        currentOnly: true
      }
    ];
  }
  /** @inheritdoc */
  async registers(frameId) {
    const descriptor2 = this.#frame(frameId);
    const status = await this.#readStatus(descriptor2.processor);
    const values = status.registers;
    if (descriptor2.processor === "65816") {
      return [
        debugRegister(values, "A", 16),
        debugRegister(values, "X", 16),
        debugRegister(values, "Y", 16),
        debugRegister(values, "SP", 16, "S"),
        debugRegister(values, "D", 16),
        {
          name: "PC",
          value: registerHex(status.programCounter, 24),
          bits: 24,
          group: "CPU"
        },
        debugRegister(values, "K", 8, "PB"),
        debugRegister(values, "DBR", 8, "DB"),
        debugRegister(values, "PS", 8, "P"),
        {
          name: "E",
          value: boolean2(values.emulationMode, "Mesen register emulationMode") ? "1" : "0",
          bits: 1,
          group: "CPU"
        },
        debugRegister(values, "cycleCount", 64, "Cycle")
      ];
    }
    if (descriptor2.processor === "spc700") {
      return [
        debugRegister(values, "A", 8),
        debugRegister(values, "X", 8),
        debugRegister(values, "Y", 8),
        debugRegister(values, "SP", 8),
        {
          name: "PC",
          value: registerHex(status.programCounter, 16),
          bits: 16,
          group: "CPU"
        },
        debugRegister(values, "PS", 8, "P"),
        debugRegister(values, "cycle", 64, "Cycle")
      ];
    }
    const registerArray = values.R;
    if (!Array.isArray(registerArray) || registerArray.length !== 16)
      throw new Error("Mesen Super FX register array must contain 16 entries.");
    const sfr = record2(values.SFR, "Mesen Super FX status register");
    const generalRegisters = registerArray.map((value, index) => ({
      name: `R${index}`,
      value: registerHex(integer2(value, `Mesen register R${index}`, 65535), 16),
      bits: 16,
      group: "CPU"
    }));
    return [
      ...generalRegisters,
      {
        name: "PC",
        value: registerHex(status.programCounter, 24),
        bits: 24,
        group: "CPU"
      },
      debugRegister(values, "programBank", 8, "PB"),
      debugRegister(values, "romBank", 8, "ROMB"),
      debugRegister(values, "ramBank", 8, "RAMB"),
      debugRegister(values, "sourceRegister", 4, "SREG"),
      debugRegister(values, "destinationRegister", 4, "DREG"),
      debugRegister(values, "programReadBuffer", 8, "Pipeline"),
      debugFlag(sfr, "zero", "Z"),
      debugFlag(sfr, "carry", "C"),
      debugFlag(sfr, "sign", "S"),
      debugFlag(sfr, "overflow", "V"),
      debugFlag(sfr, "running", "RUN"),
      debugFlag(sfr, "alt1", "ALT1"),
      debugFlag(sfr, "alt2", "ALT2"),
      debugFlag(sfr, "irq", "IRQ"),
      debugRegister(values, "cycleCount", 64, "Cycle")
    ];
  }
  /** @inheritdoc */
  async readMemory(address4, count) {
    const descriptor2 = this.#checkedMemoryAddress(address4, false);
    integer2(count, "Mesen memory count", 1048576);
    if (count === 0)
      return { address: { ...address4 }, bytes: new Uint8Array(), unreadableBytes: 0 };
    const bytes = await this.#readNativeMemory(descriptor2, address4.address, count);
    return { address: { ...address4 }, bytes, unreadableBytes: count - bytes.length };
  }
  /** @inheritdoc */
  async setBreakpoints(addresses2) {
    this.#requireStopped();
    if (addresses2.length > 256) throw new Error("Mesen accepts at most 256 execute breakpoints.");
    const checked = addresses2.map((address4, index) => {
      if (address4.architecture !== MESEN_65816_ARCHITECTURE || address4.addressSpace !== MESEN_65816_ADDRESS_SPACE)
        throw new Error(`Mesen breakpoint ${index} is not a 65816 execution address.`);
      integer2(address4.address, `Mesen breakpoint ${index} address`, 16777215);
      return { ...address4 };
    });
    if (new Set(checked.map(({ address: address4 }) => address4)).size !== checked.length)
      throw new Error("Duplicate Mesen execute breakpoint addresses are not allowed.");
    const result = record2(
      await this.#requireConnected().request("setBreakpoints", {
        cpu: "65816",
        addresses: checked.map(({ address: address4 }) => address4)
      }),
      "Mesen breakpoint response"
    );
    const count = integer2(result.count, "Mesen breakpoint response count", 256);
    if (count !== checked.length)
      throw new Error("Mesen did not install the complete breakpoint set.");
    const next = /* @__PURE__ */ new Map();
    const breakpoints = checked.map((address4) => {
      const breakpoint = this.#breakpoints.get(address4.address) ?? Object.freeze({ id: this.#nextBreakpointId++, address: address4, verified: true });
      next.set(address4.address, breakpoint);
      return breakpoint;
    });
    this.#breakpoints.clear();
    for (const [address4, breakpoint] of next) this.#breakpoints.set(address4, breakpoint);
    return breakpoints;
  }
  /** @inheritdoc */
  async disassemble(address4, count) {
    integer2(count, "Mesen disassembly count", 4096);
    const descriptor2 = this.#executionDescriptor(address4);
    const status = await this.#readStatus(descriptor2.processor);
    let current = address4.address;
    let superFxState = descriptor2.processor === "superfx" ? this.#superFxState(status) : void 0;
    const instructions = [];
    for (let index = 0; index < count; index++) {
      const memory = await this.#readNativeMemory(descriptor2, current, 4);
      const source = new Uint8ArrayDecoderSource(memory);
      const decoded = (() => {
        if (descriptor2.processor === "65816")
          return this.#cpuDecoder.decode({
            source,
            offset: 0,
            logicalAddress: current,
            state: this.#cpuDecodeState(status)
          });
        if (descriptor2.processor === "spc700")
          return this.#spcDecoder.decode({
            source,
            offset: 0,
            logicalAddress: current,
            state: this.#spcDecodeState(status)
          });
        return this.#superFxDecoder.decode({
          source,
          offset: 0,
          logicalAddress: current,
          state: superFxDecodeState(superFxState)
        });
      })();
      if (decoded.kind !== "instruction")
        throw new Error(
          decoded.kind === "ambiguous" ? decoded.reason : `Mesen decode failed: ${decoded.message}`
        );
      const text = (() => {
        if (descriptor2.processor === "65816") return formatCpu65816Instruction(decoded.instruction);
        if (descriptor2.processor === "spc700") return formatSpc700Instruction(decoded.instruction);
        return formatSuperFxInstruction(decoded.instruction);
      })();
      instructions.push({
        address: this.#executionAddress(descriptor2.processor, current),
        bytes: [...decoded.instruction.bytes],
        text
      });
      if (superFxState) superFxState = transferSuperFxState(decoded.instruction, superFxState);
      current = current + decoded.instruction.size & maximumPc(descriptor2.processor);
    }
    return instructions;
  }
  /** @inheritdoc */
  startTrace(_options) {
    return Promise.reject(new Error("Mesen instruction tracing is not implemented."));
  }
  /** @inheritdoc */
  readTrace(_maxEvents) {
    return Promise.reject(new Error("Mesen instruction tracing is not implemented."));
  }
  /** @inheritdoc */
  stopTrace() {
    return Promise.reject(new Error("Mesen instruction tracing is not implemented."));
  }
  /** @inheritdoc */
  onEvent(listener) {
    this.#listeners.add(listener);
    return { dispose: () => this.#listeners.delete(listener) };
  }
  async #pollForStop(descriptor2, epoch) {
    try {
      while (this.#connected && !this.#stopped && epoch === this.#executionEpoch) {
        await delay(this.#pollIntervalMs);
        if (!this.#connected || this.#stopped || epoch !== this.#executionEpoch) return;
        const status = await this.#readStatus(descriptor2.processor, false);
        if (status.stopped) {
          this.#acceptRunningStop(status, descriptor2, epoch);
          return;
        }
      }
    } catch (error) {
      if (epoch !== this.#executionEpoch || !this.#connected) return;
      const failure = asError2(error);
      this.#emit({ type: "output", category: "stderr", text: `${failure.message}
` });
      this.#emit({ type: "terminated", restart: true });
      const client = this.#client;
      if (client) {
        this.#expectedClose.add(client);
        await this.#releaseClient(client).catch(() => void 0);
      }
    }
  }
  #acceptRunningStop(status, descriptor2, epoch) {
    if (epoch !== this.#executionEpoch || this.#stopped) return;
    this.#stopped = true;
    const reason = descriptor2.processor === "65816" && this.#breakpoints.has(status.programCounter) ? "breakpoint" : "exception";
    this.#emit({ type: "stopped", reason, threadId: descriptor2.id });
  }
  async #readStatus(cpu, requireStopped = true) {
    if (requireStopped) this.#requireStopped();
    return this.#statusRequest("status", cpu);
  }
  async #statusRequest(method, cpu) {
    return parseStatus(await this.#requireClient().request(method, { cpu }), cpu);
  }
  #cpuDecodeState(status) {
    const registers2 = status.registers;
    const flags = registerInteger(registers2, "PS", 8);
    return {
      e: boolean2(registers2.emulationMode, "Mesen register emulationMode") ? 1 : 0,
      m: flags >>> 5 & 1 ? 1 : 0,
      x: flags >>> 4 & 1 ? 1 : 0,
      programBank: status.programCounter >>> 16,
      dataBank: registerInteger(registers2, "DBR", 8),
      directPage: registerInteger(registers2, "D", 16)
    };
  }
  #spcDecodeState(status) {
    const flags = registerInteger(status.registers, "PS", 8);
    return { directPage: flags & 32 ? 256 : 0 };
  }
  #superFxState(status) {
    const registers2 = status.registers;
    const sfr = record2(registers2.SFR, "Mesen Super FX status register");
    const alt = (boolean2(sfr.alt1, "Mesen register alt1") ? 1 : 0) | (boolean2(sfr.alt2, "Mesen register alt2") ? 2 : 0);
    return {
      alt: { kind: "known", value: alt },
      destinationRegister: {
        kind: "known",
        value: registerInteger(registers2, "destinationRegister", 4)
      },
      sourceRegister: {
        kind: "known",
        value: registerInteger(registers2, "sourceRegister", 4)
      },
      programBank: {
        kind: "known",
        value: registerInteger(registers2, "programBank", 8)
      }
    };
  }
  #executionDescriptor(address4) {
    const descriptor2 = memorySpaces[address4.addressSpace];
    if (!descriptor2 || threads[descriptor2.processor].architecture !== address4.architecture)
      throw new Error(
        `Mesen execution address '${address4.architecture}/${address4.addressSpace}' is unsupported.`
      );
    let expectedSpace = MESEN_SUPERFX_ROM_ADDRESS_SPACE;
    if (descriptor2.processor === "65816") expectedSpace = MESEN_65816_ADDRESS_SPACE;
    else if (descriptor2.processor === "spc700") expectedSpace = MESEN_SPC700_ADDRESS_SPACE;
    if (address4.addressSpace !== expectedSpace)
      throw new Error(`Mesen address space '${address4.addressSpace}' is not executable.`);
    integer2(address4.address, "Mesen execution address", descriptor2.maximumAddress);
    this.#requireProcessor(descriptor2.processor);
    return descriptor2;
  }
  #checkedMemoryAddress(address4, allowExecutionBus) {
    const descriptor2 = memorySpaces[address4.addressSpace];
    if (!descriptor2 || threads[descriptor2.processor].architecture !== address4.architecture)
      throw new Error(
        `Mesen memory address '${address4.architecture}/${address4.addressSpace}' is unsupported.`
      );
    if (!allowExecutionBus && address4.addressSpace === MESEN_65816_ADDRESS_SPACE)
      throw new Error("Mesen logical CPU-bus memory is reserved for disassembly.");
    integer2(address4.address, "Mesen memory address", descriptor2.maximumAddress);
    this.#requireProcessor(descriptor2.processor);
    return descriptor2;
  }
  async #readNativeMemory(descriptor2, address4, count) {
    this.#requireStopped();
    const bytes = new Uint8Array(count);
    let offset = 0;
    while (offset < count) {
      const requested = Math.min(this.#maxMemoryRead, count - offset);
      const response = record2(
        await this.#requireConnected().request("readMemory", {
          space: descriptor2.native,
          address: address4 + offset,
          length: requested
        }),
        "Mesen memory response"
      );
      if (string2(response.space, "Mesen memory response space") !== descriptor2.native)
        throw new Error("Mesen memory response used the wrong address space.");
      if (integer2(response.address, "Mesen memory response address") !== address4 + offset)
        throw new Error("Mesen memory response used the wrong address.");
      const encoded = string2(response.data, "Mesen memory response data");
      const chunk = Buffer2.from(encoded, "base64");
      if (chunk.toString("base64") !== encoded || chunk.length !== requested)
        throw new Error("Mesen memory response is not canonical base64 of the requested length.");
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    return bytes;
  }
  #executionAddress(cpu, address4) {
    const architecture = threads[cpu].architecture;
    let addressSpace = MESEN_SUPERFX_ROM_ADDRESS_SPACE;
    if (cpu === "65816") addressSpace = MESEN_65816_ADDRESS_SPACE;
    else if (cpu === "spc700") addressSpace = MESEN_SPC700_ADDRESS_SPACE;
    return { architecture, addressSpace, address: address4 };
  }
  #thread(id) {
    integer2(id, "Mesen thread id");
    const descriptor2 = Object.values(threads).find((candidate) => candidate.id === id);
    if (!descriptor2 || !this.#availableProcessors.includes(descriptor2.processor))
      throw new Error(`Unknown Mesen thread ${id}.`);
    return descriptor2;
  }
  #frame(id) {
    integer2(id, "Mesen frame id");
    const descriptor2 = Object.values(threads).find((candidate) => candidate.frameId === id);
    if (!descriptor2 || !this.#availableProcessors.includes(descriptor2.processor))
      throw new Error(`Unknown Mesen frame ${id}.`);
    return descriptor2;
  }
  #requireProcessor(cpu) {
    if (!this.#availableProcessors.includes(cpu))
      throw new Error(`Mesen processor '${cpu}' is not available for this cartridge.`);
  }
  #requireClient() {
    if (!this.#client || this.#client.closed) throw new Error("Mesen client is not available.");
    return this.#client;
  }
  #requireConnected() {
    if (!this.#connected) throw new Error("Mesen backend is not connected.");
    return this.#requireClient();
  }
  #requireStopped() {
    const client = this.#requireConnected();
    if (!this.#stopped) throw new Error("Mesen backend must be stopped for this operation.");
    return client;
  }
  #clientClosed(client, error) {
    if (this.#expectedClose.has(client) || this.#client !== client) return;
    this.#executionEpoch++;
    this.#closeSubscription?.dispose();
    this.#closeSubscription = void 0;
    this.#client = void 0;
    this.#connected = false;
    this.#stopped = false;
    this.#emit({
      type: "output",
      category: "stderr",
      text: `${error?.message ?? "Mesen debug connection closed."}
`
    });
    this.#emit({ type: "terminated", restart: true });
  }
  async #releaseClient(client) {
    if (this.#client !== client) return;
    this.#executionEpoch++;
    this.#closeSubscription?.dispose();
    this.#closeSubscription = void 0;
    this.#client = void 0;
    this.#connected = false;
    await client.close();
  }
  #emit(event) {
    for (const listener of this.#listeners) listener(event);
  }
};

// packages/debug-sidecar-mesence/src/mesen-process-host.ts
import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import net2 from "node:net";
import path from "node:path";

// packages/debug-sidecar-mesence/src/mesen-debug-client.ts
import { Buffer as Buffer3 } from "node:buffer";
var asError3 = (error) => error instanceof Error ? error : new Error(String(error));
var positiveInteger3 = (value, context) => {
  if (!Number.isSafeInteger(value) || value <= 0)
    throw new Error(`${context} must be a positive safe integer.`);
  return value;
};
var FramedMesenDebugClient = class {
  #transport;
  #token;
  #requestTimeoutMs;
  #maxRequestBytes;
  #maxResponseBytes;
  #maxQueuedRequests;
  #maxQueuedBytes;
  #closeListeners = /* @__PURE__ */ new Set();
  #dataSubscription;
  #closeSubscription;
  #queue = [];
  #buffer = Buffer3.alloc(0);
  #pending;
  #queuedBytes = 0;
  #nextId = 1;
  #closed = false;
  #closeError;
  /** @param {FramedMesenDebugClientOptions} options Transport, one-session token, and bounds. */
  constructor(options) {
    if (!/^[\dA-Fa-f]{64}$/.test(options.token))
      throw new Error("Mesen debug token must contain 256 bits of hexadecimal data.");
    this.#transport = options.transport;
    this.#token = options.token.toLowerCase();
    this.#requestTimeoutMs = positiveInteger3(
      options.requestTimeoutMs ?? 5e3,
      "Mesen request timeout"
    );
    this.#maxRequestBytes = positiveInteger3(
      options.maxRequestBytes ?? 64 * 1024,
      "Mesen maximum request bytes"
    );
    this.#maxResponseBytes = positiveInteger3(
      options.maxResponseBytes ?? 256 * 1024,
      "Mesen maximum response bytes"
    );
    this.#maxQueuedRequests = positiveInteger3(
      options.maxQueuedRequests ?? 16,
      "Mesen maximum queued requests"
    );
    this.#maxQueuedBytes = positiveInteger3(
      options.maxQueuedBytes ?? 256 * 1024,
      "Mesen maximum queued bytes"
    );
    if (this.#maxQueuedBytes < this.#maxRequestBytes + 4)
      throw new Error("Mesen queued-byte bound must hold one maximum-sized request frame.");
    this.#dataSubscription = this.#transport.onData((data) => this.#receive(data));
    this.#closeSubscription = this.#transport.onClose(
      (error) => this.#fail(error ?? new Error("Mesen debug transport closed."), false)
    );
  }
  /** @returns {boolean} Whether this client has permanently closed. */
  get closed() {
    return this.#closed;
  }
  /** @inheritdoc */
  request(method, parameters = {}) {
    if (this.#closed) return Promise.reject(new Error("Mesen debug client is closed."));
    if (!/^[A-Za-z][\dA-Za-z]*$/.test(method))
      return Promise.reject(new Error("Mesen debug method has an invalid name."));
    if (this.#nextId > Number.MAX_SAFE_INTEGER)
      return Promise.reject(new Error("Mesen debug request identifier space is exhausted."));
    const id = this.#nextId++;
    let payload;
    try {
      payload = Buffer3.from(
        JSON.stringify({
          version: MESEN_NATIVE_PROTOCOL_VERSION,
          token: this.#token,
          id,
          method,
          params: parameters
        }),
        "utf8"
      );
    } catch (error) {
      return Promise.reject(asError3(error));
    }
    if (payload.length === 0 || payload.length > this.#maxRequestBytes)
      return Promise.reject(
        new Error(`Mesen debug request exceeds ${this.#maxRequestBytes} bytes.`)
      );
    const packet = Buffer3.allocUnsafe(payload.length + 4);
    packet.writeUInt32BE(payload.length, 0);
    packet.set(payload, 4);
    const queuedCount = this.#queue.length + (this.#pending ? 1 : 0);
    if (queuedCount >= this.#maxQueuedRequests)
      return Promise.reject(
        new Error(`Mesen debug request queue exceeds ${this.#maxQueuedRequests} requests.`)
      );
    if (this.#queuedBytes + packet.length > this.#maxQueuedBytes)
      return Promise.reject(
        new Error(`Mesen debug request queue exceeds ${this.#maxQueuedBytes} bytes.`)
      );
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => this.#fail(new Error(`Mesen debug request '${method}' timed out.`)),
        this.#requestTimeoutMs
      );
      timer.unref();
      const request = { id, method, packet, resolve, reject, timer };
      this.#queue.push(request);
      this.#queuedBytes += packet.length;
      this.#pump();
    });
  }
  /** @inheritdoc */
  onClose(listener) {
    if (this.#closed) {
      queueMicrotask(() => listener(this.#closeError));
      return { dispose: () => void 0 };
    }
    this.#closeListeners.add(listener);
    return { dispose: () => this.#closeListeners.delete(listener) };
  }
  /** @inheritdoc */
  async close() {
    if (this.#closed) return;
    this.#fail(new Error("Mesen debug client closed."), false);
    await this.#transport.close();
  }
  #pump() {
    if (this.#closed || this.#pending) return;
    const request = this.#queue.shift();
    if (!request) return;
    this.#pending = request;
    void this.#transport.write(request.packet).catch((error) => this.#fail(asError3(error)));
  }
  #receive(data) {
    if (this.#closed) return;
    try {
      const maximumBuffered = this.#maxResponseBytes + 4;
      if (this.#buffer.length + data.length > maximumBuffered)
        throw new Error(`Mesen debug receive buffer exceeds ${maximumBuffered} bytes.`);
      this.#buffer = Buffer3.concat([this.#buffer, data]);
      while (this.#buffer.length >= 4) {
        const length = this.#buffer.readUInt32BE(0);
        if (length === 0 || length > this.#maxResponseBytes)
          throw new Error(`Mesen debug response length ${length} is outside protocol bounds.`);
        if (this.#buffer.length < length + 4) return;
        const payload = this.#buffer.subarray(4, length + 4);
        this.#buffer = this.#buffer.subarray(length + 4);
        this.#deliver(payload);
      }
    } catch (error) {
      this.#fail(asError3(error));
    }
  }
  #deliver(payload) {
    let parsed;
    try {
      parsed = JSON.parse(Buffer3.from(payload).toString("utf8"));
    } catch {
      throw new Error("Mesen debug response is not valid UTF-8 JSON.");
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
      throw new Error("Mesen response must be an object.");
    const response = parsed;
    if (response.version !== MESEN_NATIVE_PROTOCOL_VERSION)
      throw new Error("Mesen debug response uses an unsupported protocol version.");
    const pending = this.#pending;
    if (!pending) throw new Error("Mesen debug response arrived without a pending request.");
    if (response.id !== pending.id)
      throw new Error(`Mesen debug response id ${String(response.id)} is out of order.`);
    if (typeof response.ok !== "boolean") throw new Error("Mesen debug response lacks ok state.");
    if (!response.ok && (typeof response.error !== "string" || response.error.length === 0))
      throw new Error("Mesen debug error response lacks a message.");
    clearTimeout(pending.timer);
    this.#pending = void 0;
    this.#queuedBytes -= pending.packet.length;
    if (response.ok) pending.resolve(response.result);
    else pending.reject(new Error(`Mesen ${pending.method} failed: ${String(response.error)}`));
    this.#pump();
  }
  #fail(error, closeTransport = true) {
    if (this.#closed) return;
    this.#closed = true;
    this.#closeError = error;
    this.#dataSubscription.dispose();
    this.#closeSubscription.dispose();
    const queued = this.#pending ? [this.#pending, ...this.#queue] : [...this.#queue];
    this.#pending = void 0;
    this.#queue.length = 0;
    this.#queuedBytes = 0;
    for (const request of queued) {
      clearTimeout(request.timer);
      request.reject(error);
    }
    for (const listener of this.#closeListeners) listener(error);
    this.#closeListeners.clear();
    if (closeTransport) void this.#transport.close().catch(() => void 0);
  }
};

// packages/debug-sidecar-mesence/src/node-tcp-mesen-transport.ts
import net from "node:net";
var NodeTcpMesenTransport = class _NodeTcpMesenTransport {
  #socket;
  #shutdownTimeoutMs;
  #dataListeners = /* @__PURE__ */ new Set();
  #closeListeners = /* @__PURE__ */ new Set();
  #terminalError;
  #closed = false;
  #notified = false;
  constructor(socket, shutdownTimeoutMs) {
    this.#socket = socket;
    this.#shutdownTimeoutMs = shutdownTimeoutMs;
    this.#socket.setNoDelay(true);
    this.#socket.on("data", (data) => {
      const bytes = typeof data === "string" ? Buffer.from(data) : data;
      for (const listener of this.#dataListeners) listener(bytes);
    });
    this.#socket.on("error", (error) => {
      this.#terminalError = error;
    });
    this.#socket.on("close", () => this.#notifyClosed(this.#terminalError));
  }
  /**
   * Opens a bounded connection to a numeric loopback address.
   * @param {NodeTcpMesenTransportOptions} options Loopback endpoint and deadlines.
   * @returns {Promise<NodeTcpMesenTransport>} Connected transport.
   */
  static async connect(options) {
    const host = options.host ?? "127.0.0.1";
    if (host !== "127.0.0.1" && host !== "::1")
      throw new Error("Mesen transport host must be a numeric loopback address.");
    if (!Number.isSafeInteger(options.port) || options.port < 1 || options.port > 65535)
      throw new Error("Mesen transport port must be an integer between 1 and 65535.");
    const connectTimeoutMs = options.connectTimeoutMs ?? 3e3;
    const shutdownTimeoutMs = options.shutdownTimeoutMs ?? 1e3;
    for (const [name, value] of [
      ["Mesen connect timeout", connectTimeoutMs],
      ["Mesen shutdown timeout", shutdownTimeoutMs]
    ]) {
      if (!Number.isSafeInteger(value) || value <= 0)
        throw new Error(`${name} must be a positive safe integer.`);
    }
    const socket = new net.Socket();
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        socket.destroy();
        reject(new Error(`Mesen connection to ${host}:${options.port} timed out.`));
      }, connectTimeoutMs);
      const cleanup = () => {
        clearTimeout(timeout);
        socket.off("connect", connected);
        socket.off("error", failed);
      };
      const connected = () => {
        cleanup();
        resolve();
      };
      const failed = (error) => {
        cleanup();
        socket.destroy();
        reject(error);
      };
      socket.once("connect", connected);
      socket.once("error", failed);
      socket.connect(options.port, host);
    });
    return new _NodeTcpMesenTransport(socket, shutdownTimeoutMs);
  }
  /** @inheritdoc */
  write(data) {
    if (this.#closed) return Promise.reject(new Error("Mesen TCP transport is closed."));
    return new Promise((resolve, reject) => {
      this.#socket.write(data, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
  /** @inheritdoc */
  onData(listener) {
    this.#dataListeners.add(listener);
    return { dispose: () => this.#dataListeners.delete(listener) };
  }
  /** @inheritdoc */
  onClose(listener) {
    if (this.#notified) {
      queueMicrotask(() => listener(this.#terminalError));
      return { dispose: () => void 0 };
    }
    this.#closeListeners.add(listener);
    return { dispose: () => this.#closeListeners.delete(listener) };
  }
  /** @inheritdoc */
  async close() {
    if (this.#closed) return;
    this.#closed = true;
    if (this.#socket.destroyed) {
      this.#notifyClosed(this.#terminalError);
      return;
    }
    await new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.#socket.destroy();
        resolve();
      }, this.#shutdownTimeoutMs);
      this.#socket.once("close", () => {
        clearTimeout(timeout);
        resolve();
      });
      this.#socket.end();
    });
  }
  #notifyClosed(error) {
    if (this.#notified) return;
    this.#notified = true;
    this.#closed = true;
    for (const listener of this.#closeListeners) listener(error);
    this.#closeListeners.clear();
    this.#dataListeners.clear();
  }
};

// packages/debug-sidecar-mesence/src/mesen-process-host.ts
var MESEN_RUNTIME_MANIFEST_VERSION = 1;
var MESEN_NATIVE_TOKEN_ENV = "MESEN_DEBUG_SERVER_TOKEN";
var sha256Pattern = /^[\dA-Fa-f]{64}$/;
var revisionPattern = /^[\dA-Fa-f]{40}$/;
var checkedSha256 = (value, name) => {
  if (!sha256Pattern.test(value)) throw new Error(`${name} must be a 64-digit SHA-256 value.`);
  return value.toLowerCase();
};
var checkedRevision = (value) => {
  if (!revisionPattern.test(value))
    throw new Error("Mesen upstream revision must be a 40-digit git revision.");
  return value.toLowerCase();
};
var checkedAbsolutePath = (value, name) => {
  if (!path.isAbsolute(value)) throw new Error(`${name} must be an absolute path.`);
  return path.normalize(value);
};
var checkedResourcePath = (value) => {
  if (value === "." || value.includes("\\") || path.posix.isAbsolute(value) || path.posix.normalize(value) !== value || value.split("/").includes(".."))
    throw new Error(`Mesen resource path '${value}' must be normalized and relative.`);
  return value;
};
var errorValue = (error) => error instanceof Error ? error : new Error(String(error));
var waitWithTimeout = async (promise, timeoutMs) => new Promise((resolve) => {
  const timer = setTimeout(() => resolve(void 0), timeoutMs);
  timer.unref();
  void promise.then((value) => {
    clearTimeout(timer);
    resolve(value);
  });
});
var NodeMesenProcessHandle = class {
  #child;
  #exit;
  #exited = false;
  constructor(options) {
    let spawnError;
    this.#child = spawn(options.command, [...options.args], {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    });
    this.#child.stdout?.on("data", (data) => options.onOutput("stdout", data));
    this.#child.stderr?.on("data", (data) => options.onOutput("stderr", data));
    this.#child.once("error", (error) => {
      spawnError = error;
    });
    this.#exit = new Promise((resolve) => {
      this.#child.once("close", (code, signal) => {
        this.#exited = true;
        resolve({ code, signal, ...spawnError ? { error: spawnError } : {} });
      });
    });
  }
  get pid() {
    return this.#child.pid;
  }
  get exited() {
    return this.#exited;
  }
  waitForExit() {
    return this.#exit;
  }
  kill(signal) {
    if (!this.#exited) this.#child.kill(signal);
  }
};
var nodeSha256 = async (file) => {
  const digest = createHash("sha256");
  for await (const chunk of createReadStream(file)) digest.update(chunk);
  return digest.digest("hex");
};
var reserveLoopbackPort = async () => {
  const server = net2.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen({ host: "127.0.0.1", port: 0, exclusive: true }, resolve);
  });
  const address4 = server.address();
  if (!address4 || typeof address4 === "string") {
    server.close();
    throw new Error("Unable to reserve an IPv4 loopback port for MesenCE.");
  }
  await new Promise(
    (resolve, reject) => server.close((error) => {
      if (error) reject(error);
      else resolve();
    })
  );
  return address4.port;
};
var nodeMesenProcessRuntime = Object.freeze({
  platform: process.platform,
  architecture: process.arch,
  sha256: nodeSha256,
  randomToken: () => randomBytes(32).toString("hex"),
  reserveLoopbackPort,
  launch: (options) => new NodeMesenProcessHandle(options),
  connect: (port, timeoutMs) => NodeTcpMesenTransport.connect({
    host: "127.0.0.1",
    port,
    connectTimeoutMs: timeoutMs
  }),
  delay: (milliseconds) => new Promise((resolve) => {
    const timer = setTimeout(resolve, milliseconds);
    timer.unref();
  })
});
var manifestRecord = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Mesen runtime manifest must be an object.");
  return value;
};
var manifestString = (value, name) => {
  if (typeof value !== "string" || value.length === 0)
    throw new Error(`${name} must be a non-empty string.`);
  return value;
};
var parseMesenRuntimeManifest = (value) => {
  const manifest = manifestRecord(value);
  if (manifest.schemaVersion !== MESEN_RUNTIME_MANIFEST_VERSION)
    throw new Error(
      `Unsupported Mesen runtime manifest version ${String(manifest.schemaVersion)}.`
    );
  if (manifest.emulator !== "MesenCE") throw new Error("Runtime manifest is not for MesenCE.");
  if (!Array.isArray(manifest.resources))
    throw new Error("Mesen runtime manifest resources must be an array.");
  const resources = Object.freeze(
    manifest.resources.map((value2, index) => {
      const resource = manifestRecord(value2);
      const resourcePath = checkedResourcePath(
        manifestString(resource.path, `Mesen resource ${index} path`)
      );
      return Object.freeze({
        path: resourcePath,
        sha256: checkedSha256(
          manifestString(resource.sha256, `Resource '${resourcePath}' SHA-256`),
          `Resource '${resourcePath}' SHA-256`
        )
      });
    })
  );
  if (new Set(resources.map(({ path: resourcePath }) => resourcePath)).size !== resources.length)
    throw new Error("Mesen runtime manifest contains duplicate resource paths.");
  return Object.freeze({
    schemaVersion: MESEN_RUNTIME_MANIFEST_VERSION,
    emulator: "MesenCE",
    upstreamRevision: checkedRevision(
      manifestString(manifest.upstreamRevision, "Mesen upstream revision")
    ),
    patchSha256: checkedSha256(
      manifestString(manifest.patchSha256, "Mesen patch SHA-256"),
      "Mesen patch SHA-256"
    ),
    executableSha256: checkedSha256(
      manifestString(manifest.executableSha256, "Mesen executable SHA-256"),
      "Mesen executable SHA-256"
    ),
    romSha256: checkedSha256(manifestString(manifest.romSha256, "ROM SHA-256"), "ROM SHA-256"),
    platform: manifestString(manifest.platform, "Mesen manifest platform"),
    architecture: manifestString(manifest.architecture, "Mesen manifest architecture"),
    buildConfiguration: manifestString(manifest.buildConfiguration, "Mesen build configuration"),
    resources
  });
};
var MesenProcessHost = class {
  #executable;
  #rom;
  #runtimeDirectory;
  #manifest;
  #env;
  #startupTimeoutMs;
  #requestTimeoutMs;
  #shutdownTimeoutMs;
  #connectRetryMs;
  #nativeLifetimeSeconds;
  #maxOutputBytes;
  #onOutput;
  #runtime;
  #process;
  #port;
  #token;
  #output = Buffer.alloc(0);
  #lifecycleTail = Promise.resolve();
  /** @param {MesenProcessHostOptions} options Paths, identity, bounds, and platform runtime. */
  constructor(options) {
    this.#executable = checkedAbsolutePath(options.executable, "Mesen executable");
    this.#rom = checkedAbsolutePath(options.rom, "Mesen ROM");
    this.#runtimeDirectory = checkedAbsolutePath(
      options.runtimeDirectory,
      "Mesen runtime directory"
    );
    if (path.dirname(this.#executable) !== this.#runtimeDirectory)
      throw new Error("Mesen executable must reside directly in its portable runtime directory.");
    this.#manifest = parseMesenRuntimeManifest(options.manifest);
    this.#env = options.env ?? {};
    this.#startupTimeoutMs = options.startupTimeoutMs ?? 1e4;
    this.#requestTimeoutMs = options.requestTimeoutMs ?? 5e3;
    this.#shutdownTimeoutMs = options.shutdownTimeoutMs ?? 2e3;
    this.#connectRetryMs = options.connectRetryMs ?? 25;
    this.#nativeLifetimeSeconds = options.nativeLifetimeSeconds ?? 86400;
    this.#maxOutputBytes = options.maxOutputBytes ?? 65536;
    this.#onOutput = options.onOutput;
    this.#runtime = options.runtime ?? nodeMesenProcessRuntime;
    for (const [name, value] of [
      ["Mesen startup timeout", this.#startupTimeoutMs],
      ["Mesen request timeout", this.#requestTimeoutMs],
      ["Mesen shutdown timeout", this.#shutdownTimeoutMs],
      ["Mesen connect retry delay", this.#connectRetryMs],
      ["Mesen native lifetime", this.#nativeLifetimeSeconds],
      ["Mesen output limit", this.#maxOutputBytes]
    ]) {
      if (!Number.isSafeInteger(value) || value <= 0)
        throw new Error(`${name} must be a positive safe integer.`);
    }
  }
  /** @returns {MesenRuntimeManifest} Normalized immutable launch identity. */
  get manifest() {
    return this.#manifest;
  }
  /** @returns {number | undefined} PID of the current emulator process. */
  get pid() {
    return this.#process?.pid;
  }
  /** @returns {string} Bounded tail of emulator output, never neutral-protocol stdout. */
  get output() {
    return this.#output.toString("utf8");
  }
  /**
   * Starts a verified process for reset connects or reconnects to the preserved process.
   * @param {DebugBackendConnectOptions} options Backend reset policy.
   * @returns {Promise<FramedMesenDebugClient>} Connected private native-protocol client.
   */
  createClient(options) {
    return this.#serializeLifecycle(async () => {
      let launched = false;
      if (options.reset ?? true) {
        await this.#terminateCurrent();
        await this.#launch();
        launched = true;
      } else if (!this.#process || this.#process.exited || this.#port === void 0 || this.#token === void 0) {
        throw new Error("Cannot reconnect to MesenCE because no preserved process is running.");
      }
      try {
        return await this.#connect();
      } catch (error) {
        if (launched) await this.#terminateCurrent();
        throw error;
      }
    });
  }
  /** @returns {Promise<void>} Bounded graceful/forced cleanup of the owned process. */
  terminate() {
    return this.#serializeLifecycle(() => this.#terminateCurrent());
  }
  async #launch() {
    await this.#verifyIdentity();
    const port = await this.#runtime.reserveLoopbackPort();
    const token = this.#runtime.randomToken().toLowerCase();
    if (!sha256Pattern.test(token))
      throw new Error("Mesen runtime generated an invalid 256-bit native token.");
    const args = [
      "--testrunner",
      `--debugserverport=${port}`,
      `--timeout=${this.#nativeLifetimeSeconds}`,
      "--novideo",
      "--noaudio",
      "--noinput",
      this.#rom
    ];
    this.#output = Buffer.alloc(0);
    const processHandle = this.#runtime.launch({
      command: this.#executable,
      args,
      cwd: this.#runtimeDirectory,
      env: {
        ...this.#env,
        [DEBUG_SIDECAR_SESSION_ENV]: void 0,
        [MESEN_NATIVE_TOKEN_ENV]: token
      },
      onOutput: (stream, data) => this.#captureOutput(stream, data)
    });
    this.#process = processHandle;
    this.#port = port;
    this.#token = token;
  }
  async #connect() {
    const processHandle = this.#process;
    const port = this.#port;
    const token = this.#token;
    if (!processHandle || port === void 0 || token === void 0)
      throw new Error("MesenCE process is not running.");
    const deadline = Date.now() + this.#startupTimeoutMs;
    let lastError = new Error("MesenCE debugger listener was not ready.");
    while (Date.now() < deadline) {
      if (processHandle.exited)
        throw await this.#exitError(processHandle, "before debugger connected");
      try {
        const remaining = Math.max(1, deadline - Date.now());
        const transport = await this.#runtime.connect(port, Math.min(remaining, 250));
        return new FramedMesenDebugClient({
          transport,
          token,
          requestTimeoutMs: this.#requestTimeoutMs
        });
      } catch (error) {
        lastError = errorValue(error);
      }
      await this.#runtime.delay(Math.min(this.#connectRetryMs, Math.max(1, deadline - Date.now())));
    }
    if (processHandle.exited)
      throw await this.#exitError(processHandle, "before debugger connected");
    throw new Error(
      `MesenCE debugger listener on 127.0.0.1:${port} was not ready within ${this.#startupTimeoutMs} ms: ${lastError.message}`
    );
  }
  async #verifyIdentity() {
    if (this.#runtime.platform !== this.#manifest.platform)
      throw new Error(
        `Mesen manifest platform '${this.#manifest.platform}' does not match '${this.#runtime.platform}'.`
      );
    if (this.#runtime.architecture !== this.#manifest.architecture)
      throw new Error(
        `Mesen manifest architecture '${this.#manifest.architecture}' does not match '${this.#runtime.architecture}'.`
      );
    const runtimeInfo = await stat(this.#runtimeDirectory).catch(() => void 0);
    if (!runtimeInfo?.isDirectory())
      throw new Error("Mesen portable runtime path must be an existing directory.");
    await this.#verifyHash(this.#executable, this.#manifest.executableSha256, "executable");
    await this.#verifyHash(this.#rom, this.#manifest.romSha256, "ROM");
    for (const resource of this.#manifest.resources) {
      await this.#verifyHash(
        path.join(this.#runtimeDirectory, resource.path),
        resource.sha256,
        `resource '${resource.path}'`
      );
    }
  }
  async #verifyHash(file, expected, context) {
    let actual;
    try {
      actual = checkedSha256(await this.#runtime.sha256(file), `Observed ${context} SHA-256`);
    } catch (error) {
      throw new Error(
        `Unable to verify MesenCE ${context} at '${file}': ${errorValue(error).message}`
      );
    }
    if (actual !== expected)
      throw new Error(
        `MesenCE ${context} SHA-256 mismatch: expected ${expected}, received ${actual}.`
      );
  }
  async #terminateCurrent() {
    const processHandle = this.#process;
    this.#process = void 0;
    this.#port = void 0;
    this.#token = void 0;
    if (!processHandle || processHandle.exited) return;
    processHandle.kill("SIGTERM");
    if (await waitWithTimeout(processHandle.waitForExit(), this.#shutdownTimeoutMs)) return;
    processHandle.kill("SIGKILL");
    await processHandle.waitForExit();
  }
  async #exitError(processHandle, context) {
    const exit = await processHandle.waitForExit();
    const status = exit.signal ? `signal ${exit.signal}` : `code ${String(exit.code)}`;
    const detail = this.output.trim();
    let suffix = ".";
    if (exit.error) suffix = `: ${exit.error.message}`;
    else if (detail) suffix = `: ${detail}`;
    return new Error(`MesenCE exited with ${status} ${context}${suffix}`);
  }
  #captureOutput(stream, data) {
    const text = Buffer.from(data).toString("utf8");
    this.#onOutput?.(stream, text);
    const tagged = Buffer.from(`[MesenCE ${stream}] ${text}`, "utf8");
    const combined = Buffer.concat([this.#output, tagged]);
    this.#output = combined.subarray(Math.max(0, combined.length - this.#maxOutputBytes));
  }
  #serializeLifecycle(action) {
    const operation = this.#lifecycleTail.then(action);
    this.#lifecycleTail = operation.then(
      () => void 0,
      () => void 0
    );
    return operation;
  }
};

// packages/debug-sidecar-mesence/src/sidecar.ts
var usage = `Usage: uttori-asm-debug-sidecar-mesence [options]

Required:
  --manifest path       Versioned MesenCE runtime manifest JSON
  --mesen path          Separately installed patched MesenCE executable
  --rom path            SNES ROM whose SHA-256 matches the manifest
  --runtime-dir path    Portable runtime directory containing the executable

Optional:
  --help                Show this help
`;
var optionNames = /* @__PURE__ */ new Set(["--manifest", "--mesen", "--rom", "--runtime-dir"]);
var parseMesenSidecarArguments = (arguments_) => {
  const values = /* @__PURE__ */ new Map();
  for (let index = 0; index < arguments_.length; index++) {
    const argument = arguments_[index];
    if (argument === void 0) throw new Error("Mesen sidecar arguments cannot contain holes.");
    if (!optionNames.has(argument)) throw new Error(`Unknown Mesen sidecar option '${argument}'.`);
    if (values.has(argument)) throw new Error(`Duplicate Mesen sidecar option '${argument}'.`);
    const value = arguments_[++index];
    if (!value || value.startsWith("--"))
      throw new Error(`Mesen sidecar option '${argument}' requires a value.`);
    values.set(argument, value);
  }
  const required = (name) => {
    const value = values.get(name);
    if (!value) throw new Error(`Missing required Mesen sidecar option '${name}'.`);
    return path2.resolve(value);
  };
  return {
    manifest: required("--manifest"),
    executable: required("--mesen"),
    rom: required("--rom"),
    runtimeDirectory: required("--runtime-dir")
  };
};
var write = (stream, data) => new Promise((resolve, reject) => {
  stream.write(data, (error) => {
    if (error) reject(error);
    else resolve();
  });
});
var runMesenSidecar = async (arguments_, environment = process.env) => {
  const options = parseMesenSidecarArguments(arguments_);
  const session = environment[DEBUG_SIDECAR_SESSION_ENV];
  assertDebugSidecarSessionToken(session);
  const manifest = parseMesenRuntimeManifest(
    JSON.parse(await readFile(options.manifest, "utf8"))
  );
  const host = new MesenProcessHost({
    executable: options.executable,
    rom: options.rom,
    runtimeDirectory: options.runtimeDirectory,
    manifest
  });
  const backend = new MesenDebugBackend({
    createClient: (connect) => host.createClient(connect),
    terminate: () => host.terminate()
  });
  let ending = false;
  const close = async (error) => {
    if (ending) return;
    ending = true;
    if (error)
      await write(process.stderr, `${error.stack ?? error.message}
`).catch(() => void 0);
    process.stdin.pause();
    await host.terminate().catch(() => void 0);
    await new Promise((resolve) => process.stdout.end(resolve));
  };
  const server = new DebugSidecarServer({
    backend: MESEN_BACKEND_ID,
    implementation: backend,
    session,
    write: (data) => write(process.stdout, data),
    close
  });
  let receiveTail = Promise.resolve();
  process.stdin.on("data", (data) => {
    receiveTail = receiveTail.then(() => server.receive(data));
    void receiveTail.catch(() => void 0);
  });
  process.stdin.on("end", () => {
    void receiveTail.then(() => server.close()).catch(() => void 0);
  });
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.once(signal, () => {
      void server.close().catch(() => void 0);
    });
  }
};
if (import.meta.main) {
  const arguments_ = process.argv.slice(2);
  if (arguments_.includes("--help")) {
    await write(process.stdout, usage);
  } else {
    await runMesenSidecar(arguments_).catch(async (error) => {
      const failure = error instanceof Error ? error : new Error(String(error));
      await write(process.stderr, `${failure.stack ?? failure.message}
`).catch(() => void 0);
      process.exitCode = 1;
    });
  }
}
export {
  parseMesenSidecarArguments,
  runMesenSidecar
};

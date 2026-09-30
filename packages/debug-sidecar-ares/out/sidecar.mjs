#!/usr/bin/env node
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __esm = (fn, res, err2) => function __init() {
  if (err2) throw err2[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err2 = [e], e;
  }
};
var __commonJS = (cb, mod) => function __require2() {
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

// packages/core/src/canonical-json.ts
var init_canonical_json = __esm({
  "packages/core/src/canonical-json.ts"() {
    "use strict";
  }
});

// packages/core/src/debug-map.ts
var init_debug_map = __esm({
  "packages/core/src/debug-map.ts"() {
    "use strict";
  }
});

// node_modules/@uttori/data-tools/dist/data-hash-crc32.js
function isDataBuffer(data) {
  return typeof data === "object" && data !== null && Symbol.for(DATA_BUFFER_BRAND) in data;
}
var DATA_BUFFER_BRAND, CRC32_POLYNOMIAL, CRC32C_POLYNOMIAL, reflectedTable, sliceTable, CRC32_TABLE, CRC32C_TABLE, crc32Slices, crc32cSlices, i0, i1, i2, i3, i4, i5, i6, i7, c0, c1, c2, c3, c4, c5, c6, c7, textEncoder, hashBytes, computeBytes, isoChecksum, compute;
var init_data_hash_crc32 = __esm({
  "node_modules/@uttori/data-tools/dist/data-hash-crc32.js"() {
    DATA_BUFFER_BRAND = "uttori.DataBuffer";
    CRC32_POLYNOMIAL = 3988292384;
    CRC32C_POLYNOMIAL = 2197175160;
    reflectedTable = (polynomial) => Array.from({ length: 256 }, (_, index) => {
      let crc = index;
      for (let bit2 = 0; bit2 < 8; bit2++) {
        crc = crc & 1 ? polynomial ^ crc >>> 1 : crc >>> 1;
      }
      return crc >>> 0;
    });
    sliceTable = (table) => {
      const slices = [Uint32Array.from(table)];
      for (let width = 1; width < 8; width++) {
        const previous = slices[width - 1];
        slices.push(Uint32Array.from(previous, (crc) => crc >>> 8 ^ table[crc & 255]));
      }
      return [slices[0], slices[1], slices[2], slices[3], slices[4], slices[5], slices[6], slices[7]];
    };
    CRC32_TABLE = /* @__PURE__ */ reflectedTable(CRC32_POLYNOMIAL);
    CRC32C_TABLE = /* @__PURE__ */ reflectedTable(CRC32C_POLYNOMIAL);
    crc32Slices = /* @__PURE__ */ sliceTable(CRC32_TABLE);
    crc32cSlices = /* @__PURE__ */ sliceTable(CRC32C_TABLE);
    [i0, i1, i2, i3, i4, i5, i6, i7] = crc32Slices;
    [c0, c1, c2, c3, c4, c5, c6, c7] = crc32cSlices;
    hashBytes = (data) => {
      if (data instanceof Uint8Array) {
        return data;
      }
      if (isDataBuffer(data)) {
        return data.data;
      }
      if (typeof data === "string") {
        textEncoder ??= new TextEncoder();
        return textEncoder.encode(data);
      }
      if (data instanceof ArrayBuffer) {
        return new Uint8Array(data);
      }
      if (Array.isArray(data)) {
        return new Uint8Array(data);
      }
      if (typeof data === "number") {
        return new Uint8Array(data);
      }
      if (ArrayBuffer.isView(data) && data.buffer instanceof ArrayBuffer) {
        return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
      }
      const error = `Unknown type of input for DataBuffer: ${typeof data}`;
      throw new TypeError(error);
    };
    computeBytes = (bytes) => {
      let crc = -1;
      let index = 0;
      const length = bytes.length;
      const blockEnd = length - 7;
      for (; index < blockEnd; index += 8) {
        const mixed = crc ^ (bytes[index] | bytes[index + 1] << 8 | bytes[index + 2] << 16 | bytes[index + 3] << 24);
        crc = i7[mixed & 255] ^ i6[mixed >>> 8 & 255] ^ i5[mixed >>> 16 & 255] ^ i4[mixed >>> 24] ^ i3[bytes[index + 4]] ^ i2[bytes[index + 5]] ^ i1[bytes[index + 6]] ^ i0[bytes[index + 7]];
      }
      for (; index < length; index++) {
        crc = crc >>> 8 ^ i0[(crc ^ bytes[index]) & 255];
      }
      return ~crc >>> 0;
    };
    isoChecksum = (data) => computeBytes(hashBytes(data));
    compute = (data) => isoChecksum(data);
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
    init_data_hash_crc32();
    CRC32 = class _CRC32 {
      /** Legacy lookup-table snapshot for inspection; mutations do not customize compute().
       * @deprecated Use node:zlib in Node-only code or data-tools in portable integrations.
       */
      static table = _CRC32.makeCRCTable();
      /**
       * Return an independent snapshot of the standard reflected CRC32 lookup table.
       * @returns {Uint32Array} 256 unsigned entries for the reflected CRC32 polynomial.
       */
      static makeCRCTable() {
        return Uint32Array.from(CRC32_TABLE);
      }
      /**
       * Computes the CRC32 checksum for the given data.
       * @param {number[] | Uint8Array} data A Uint8Array (or Node.js Buffer) of data.
       * @returns {number} Unsigned CRC-32, without modifying the input.
       */
      static compute(data) {
        return compute(data);
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
var nodePath, nodeFs;
var init_file_provider = __esm({
  "packages/core/src/file-provider.ts"() {
    "use strict";
    nodePath = typeof process === "undefined" ? void 0 : process.getBuiltinModule("node:path");
    nodeFs = typeof process === "undefined" ? void 0 : process.getBuiltinModule("node:fs");
  }
});

// packages/core/src/ir/asset-call.ts
var init_asset_call = __esm({
  "packages/core/src/ir/asset-call.ts"() {
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
            summary: "First valid logical index (default zero). Requires count.",
            syntax: "endstruct count value firstindex value"
          }
        ]
      ),
      descriptor(
        "datastruct",
        "Emit one complete named record at its struct address. Checks fields, widths and pc().",
        "dataStruct Record[index], { field = value, bytes = [value, ...] }",
        "struct"
      ),
      descriptor(
        "datastructs",
        "Begin consecutive indexed named records. Preserves logical IDs and validates placement.",
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
    var debug4 = typeof process === "object" && process.env && process.env.NODE_DEBUG && /\bsemver\b/i.test(process.env.NODE_DEBUG) ? (...args) => console.error("SEMVER", ...args) : () => {
    };
    module.exports = debug4;
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
    var debug4 = require_debug();
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
      debug4(name, index, value);
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
    var debug4 = require_debug();
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
        debug4("SemVer", version, options);
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
        debug4("SemVer.compare", this.version, this.options, other);
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
          debug4("prerelease compare", i, a, b);
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
          debug4("build compare", i, a, b);
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
        debug4("hyphen replace", range);
        range = range.replace(re[t.COMPARATORTRIM], comparatorTrimReplace);
        debug4("comparator trim", range);
        range = range.replace(re[t.TILDETRIM], tildeTrimReplace);
        debug4("tilde trim", range);
        range = range.replace(re[t.CARETTRIM], caretTrimReplace);
        debug4("caret trim", range);
        let rangeList = range.split(" ").map((comp) => parseComparator(comp, this.options)).join(" ").split(/\s+/).map((comp) => replaceGTE0(comp, this.options));
        if (loose) {
          rangeList = rangeList.filter((comp) => {
            debug4("loose invalid filter", comp, this.options);
            return !!comp.match(re[t.COMPARATORLOOSE]);
          });
        }
        debug4("range list", rangeList);
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
    var debug4 = require_debug();
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
      debug4("comp", comp, options);
      comp = replaceCarets(comp, options);
      debug4("caret", comp);
      comp = replaceTildes(comp, options);
      debug4("tildes", comp);
      comp = replaceXRanges(comp, options);
      debug4("xrange", comp);
      comp = replaceStars(comp, options);
      debug4("stars", comp);
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
        debug4("tilde", comp, _, M, m, p, pr);
        let ret;
        if (isX(M)) {
          ret = "";
        } else if (isX(m)) {
          ret = `>=${M}.0.0${z} <${+M + 1}.0.0-0`;
        } else if (isX(p)) {
          ret = `>=${M}.${m}.0${z} <${M}.${+m + 1}.0-0`;
        } else if (pr) {
          debug4("replaceTilde pr", pr);
          ret = `>=${M}.${m}.${p}-${pr} <${M}.${+m + 1}.0-0`;
        } else {
          ret = `>=${M}.${m}.${p} <${M}.${+m + 1}.0-0`;
        }
        debug4("tilde return", ret);
        return ret;
      });
    };
    var replaceCarets = (comp, options) => {
      return comp.trim().split(/\s+/).map((c) => replaceCaret(c, options)).join(" ");
    };
    var replaceCaret = (comp, options) => {
      debug4("caret", comp, options);
      const r = options.loose ? re[t.CARETLOOSE] : re[t.CARET];
      const z = options.includePrerelease ? "-0" : "";
      return comp.replace(r, (_, M, m, p, pr) => {
        debug4("caret", comp, _, M, m, p, pr);
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
          debug4("replaceCaret pr", pr);
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
          debug4("no pr");
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
        debug4("caret return", ret);
        return ret;
      });
    };
    var replaceXRanges = (comp, options) => {
      debug4("replaceXRanges", comp, options);
      return comp.split(/\s+/).map((c) => replaceXRange(c, options)).join(" ");
    };
    var replaceXRange = (comp, options) => {
      comp = comp.trim();
      const r = options.loose ? re[t.XRANGELOOSE] : re[t.XRANGE];
      return comp.replace(r, (ret, gtlt, M, m, p, pr) => {
        debug4("xRange", comp, ret, gtlt, M, m, p, pr);
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
        debug4("xRange return", ret);
        return ret;
      });
    };
    var replaceStars = (comp, options) => {
      debug4("replaceStars", comp, options);
      return comp.trim().replace(re[t.STAR], "");
    };
    var replaceGTE0 = (comp, options) => {
      debug4("replaceGTE0", comp, options);
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
          debug4(set[i].semver);
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
        debug4("comparator", comp, options);
        this.options = options;
        this.loose = !!options.loose;
        this.parse(comp);
        if (this.semver === ANY) {
          this.value = "";
        } else {
          this.value = this.operator + this.semver.version;
        }
        debug4("comp", this);
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
        debug4("Comparator.test", version, this.options.loose);
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
    var debug4 = require_debug();
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
        if (!Number.isInteger(offset) || offset < 0 || offset >= this.#bytes.length) {
          return void 0;
        }
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
        if (!Number.isSafeInteger(end) || end > this.#bytes.length) {
          return void 0;
        }
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
    init_architecture_types();
    init_decoder_types();
    init_architecture_registry();
    init_address_width();
    init_crc32();
    init_addressToLine();
    init_debug_map();
    init_canonical_json();
    init_operand_syntax();
    init_syntax_profile();
    init_diagnostics();
    init_directive_groups();
    init_source_location();
    init_file_provider();
    init_assembly_tree();
    init_expression_node();
    init_normalized_command();
    init_asset_call();
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
    if (descriptor2) {
      descriptor2.modes.push(addressingMode);
    } else {
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
      if (conditionalBranches.has(mnemonic)) {
        return { kind: "conditionalBranch", fallthrough: true };
      }
      if (mnemonic === "BRA" || mnemonic === "BRL") {
        return { kind: "jump", fallthrough: false };
      }
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
      if (mnemonic === "WAI") {
        return { kind: "wait", fallthrough: false };
      }
      if (mnemonic === "STP") {
        return { kind: "stop", fallthrough: false };
      }
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
    if (entries.length !== 256) {
      throw new Error(`65816 opcode table has ${entries.length} entries.`);
    }
    cpu65816Specifications = Object.freeze(
      entries.map((entry, opcode) => {
        const [mnemonic, modeKeyText] = entry.split(":");
        const modeKey = modeKeyText;
        const definition = cpu65816Modes[modeKey];
        if (!mnemonic || !definition) {
          throw new Error(`Invalid 65816 opcode entry '${entry}'.`);
        }
        let operandStatusEffect;
        if (mnemonic === "REP") {
          operandStatusEffect = "clearBits";
        } else if (mnemonic === "SEP") {
          operandStatusEffect = "setBits";
        }
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
      if (value === true || value === 1) {
        return 1;
      }
      if (value === false || value === 0) {
        return 0;
      }
      return "unknown";
    };
    resolvedWidthFlag = (state, flag) => {
      const emulation = flagValue(state.e);
      if (emulation === 1) {
        return 1;
      }
      const width = flagValue(state[flag]);
      if (width === 1) {
        return 1;
      }
      if (width === 0 && emulation === 0) {
        return 0;
      }
      return "unknown";
    };
    readLittleEndian = (bytes, offset, width) => {
      let value = 0;
      for (let index = 0; index < width; index++) {
        value |= (bytes[offset + index] ?? 0) << index * 8;
      }
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
      if (!operand) {
        return void 0;
      }
      if (operand.targetAddress !== void 0) {
        return operand.targetAddress;
      }
      if (operand.value === void 0) {
        return void 0;
      }
      if (specification2.mode === "absoluteLong") {
        return operand.value;
      }
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
        if (isBranch) {
          kind = "branch";
        } else if (isCall) {
          kind = "call";
        }
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
      if (!memoryMode || operands[0]?.value === void 0) {
        return [];
      }
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
          if (!bytes) {
            throw new Error("Decoder byte source violated its bounds contract.");
          }
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
    if (descriptor2) {
      descriptor2.modes.push(addressingMode);
    } else {
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
      if (mnemonic === "BRA") {
        return { kind: "jump", fallthrough: false };
      }
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
      if (mnemonic === "BRK") {
        return { kind: "interrupt", fallthrough: false };
      }
      if (mnemonic === "SLEEP") {
        return { kind: "wait", fallthrough: false };
      }
      if (mnemonic === "STOP") {
        return { kind: "stop", fallthrough: false };
      }
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
    if (entries2.length !== 256) {
      throw new Error(`SPC700 opcode table has ${entries2.length} entries.`);
    }
    spc700Specifications = Object.freeze(
      entries2.map((entry, opcode) => {
        const [mnemonic, modeKeyText] = entry.split(":");
        const definition = spc700Modes[modeKeyText];
        if (!mnemonic || !definition) {
          throw new Error(`Invalid SPC700 opcode entry '${entry}'.`);
        }
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
      if (!existing.modes.some((value) => JSON.stringify(value) === JSON.stringify(mode3))) {
        existing.modes.push(mode3);
      }
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
  for (const entry of conveniences) {
    grouped.set(entry.mnemonic, entry);
  }
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
      if (opcode === 0) {
        return implied("STOP");
      }
      if (opcode === 1) {
        return implied("NOP");
      }
      if (opcode === 2) {
        return implied("CACHE");
      }
      if (opcode === 3) {
        return implied("LSR", true);
      }
      if (opcode === 4) {
        return implied("ROL", true);
      }
      const branches = ["BRA", "BGE", "BLT", "BNE", "BEQ", "BPL", "BMI", "BCC", "BCS", "BVC", "BVS"];
      if (opcode >= 5 && opcode <= 15) {
        return { mnemonic: branches[opcode - 5], encoding: "relative", size: 2 };
      }
      if (opcode >= 16 && opcode <= 31) {
        return register("TO", opcode & 15);
      }
      if (opcode >= 32 && opcode <= 47) {
        return register("WITH", opcode & 15);
      }
      if (opcode >= 48 && opcode <= 59) {
        return registerIndirect("STW", opcode & 15);
      }
      if (opcode === 60) {
        return implied("LOOP");
      }
      if (opcode === 61) {
        return implied("ALT1");
      }
      if (opcode === 62) {
        return implied("ALT2");
      }
      if (opcode === 63) {
        return implied("ALT3");
      }
      if (opcode >= 64 && opcode <= 75) {
        return registerIndirect("LDW", opcode & 15, true);
      }
      if (opcode === 76) {
        return implied("PLOT");
      }
      if (opcode === 77) {
        return implied("SWAP", true);
      }
      if (opcode === 78) {
        return implied("COLOR");
      }
      if (opcode === 79) {
        return implied("NOT", true);
      }
      if (opcode >= 80 && opcode <= 95) {
        return register("ADD", opcode & 15, true);
      }
      if (opcode >= 96 && opcode <= 111) {
        return register("SUB", opcode & 15, true);
      }
      if (opcode === 112) {
        return implied("MERGE", true);
      }
      if (opcode >= 113 && opcode <= 127) {
        return register("AND", opcode & 15, true);
      }
      if (opcode >= 128 && opcode <= 143) {
        return register("MULT", opcode & 15, true);
      }
      if (opcode === 144) {
        return implied("SBK");
      }
      if (opcode >= 145 && opcode <= 148) {
        return nibble("LINK", opcode & 15);
      }
      if (opcode === 149) {
        return implied("SEX", true);
      }
      if (opcode === 150) {
        return implied("ASR", true);
      }
      if (opcode === 151) {
        return implied("ROR", true);
      }
      if (opcode >= 152 && opcode <= 157) {
        return register("JMP", opcode & 15);
      }
      if (opcode === 158) {
        return implied("LOB", true);
      }
      if (opcode === 159) {
        return implied("FMULT", true);
      }
      if (opcode >= 160 && opcode <= 175) {
        return {
          mnemonic: "IBT",
          encoding: "registerImmediate8",
          size: 2,
          register: opcode & 15
        };
      }
      if (opcode >= 176 && opcode <= 191) {
        return register("FROM", opcode & 15);
      }
      if (opcode === 192) {
        return implied("HIB", true);
      }
      if (opcode >= 193 && opcode <= 207) {
        return register("OR", opcode & 15, true);
      }
      if (opcode >= 208 && opcode <= 222) {
        return register("INC", opcode & 15);
      }
      if (opcode === 223) {
        return implied("GETC");
      }
      if (opcode >= 224 && opcode <= 238) {
        return register("DEC", opcode & 15);
      }
      if (opcode === 239) {
        return implied("GETB", true);
      }
      return {
        mnemonic: "IWT",
        encoding: "registerImmediate16",
        size: 3,
        register: opcode & 15
      };
    };
    altDefinition = (alt, opcode) => {
      if (alt === 0) {
        return baseDefinition(opcode);
      }
      const low = opcode & 15;
      if (alt === 1) {
        if (opcode >= 48 && opcode <= 59) {
          return registerIndirect("STB", low);
        }
        if (opcode >= 64 && opcode <= 75) {
          return registerIndirect("LDB", low, true);
        }
        if (opcode === 76) {
          return implied("RPIX", true);
        }
        if (opcode === 78) {
          return implied("CMODE");
        }
        if (opcode >= 80 && opcode <= 95) {
          return register("ADC", low, true);
        }
        if (opcode >= 96 && opcode <= 111) {
          return register("SBC", low, true);
        }
        if (opcode >= 113 && opcode <= 127) {
          return register("BIC", low, true);
        }
        if (opcode >= 128 && opcode <= 143) {
          return register("UMULT", low, true);
        }
        if (opcode === 150) {
          return implied("DIV2", true);
        }
        if (opcode >= 152 && opcode <= 157) {
          return register("LJMP", low);
        }
        if (opcode === 159) {
          return implied("LMULT", true);
        }
        if (opcode >= 160 && opcode <= 175) {
          return {
            mnemonic: "LMS",
            encoding: "registerRamShort",
            size: 2,
            register: low
          };
        }
        if (opcode >= 193 && opcode <= 207) {
          return register("XOR", low, true);
        }
        if (opcode === 239) {
          return implied("GETBH", true);
        }
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
        if (opcode >= 80 && opcode <= 95) {
          return nibble("ADD", low, true);
        }
        if (opcode >= 96 && opcode <= 111) {
          return nibble("SUB", low, true);
        }
        if (opcode >= 113 && opcode <= 127) {
          return nibble("AND", low, true);
        }
        if (opcode >= 128 && opcode <= 143) {
          return nibble("MULT", low, true);
        }
        if (opcode >= 160 && opcode <= 175) {
          return {
            mnemonic: "SMS",
            encoding: "ramShortRegister",
            size: 2,
            register: low
          };
        }
        if (opcode >= 193 && opcode <= 207) {
          return nibble("OR", low, true);
        }
        if (opcode === 223) {
          return implied("RAMB");
        }
        if (opcode === 239) {
          return implied("GETBL", true);
        }
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
        if (opcode >= 80 && opcode <= 95) {
          return nibble("ADC", low, true);
        }
        if (opcode >= 96 && opcode <= 111) {
          return register("CMP", low);
        }
        if (opcode >= 113 && opcode <= 127) {
          return nibble("BIC", low, true);
        }
        if (opcode >= 128 && opcode <= 143) {
          return nibble("UMULT", low, true);
        }
        if (opcode >= 193 && opcode <= 207) {
          return nibble("XOR", low, true);
        }
        if (opcode === 223) {
          return implied("ROMB");
        }
        if (opcode === 239) {
          return implied("GETBS", true);
        }
      }
      return baseDefinition(opcode);
    };
    flowFor3 = (definition, opcode) => {
      if (definition.mnemonic === "STOP") {
        return { kind: "stop", fallthrough: false };
      }
      if (definition.mnemonic === "BRA") {
        return { kind: "jump", fallthrough: false };
      }
      if (opcode >= 6 && opcode <= 15) {
        return { kind: "conditionalBranch", fallthrough: true };
      }
      if (definition.mnemonic === "LOOP") {
        return { kind: "conditionalBranch", fallthrough: true, indirect: true };
      }
      if (definition.mnemonic === "JMP" || definition.mnemonic === "LJMP") {
        return { kind: "jump", fallthrough: false, indirect: true };
      }
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
      if (mode3 === "registerRegister") {
        return "Rn,Rm";
      }
      if (mode3 === "registerRegisterIndirect") {
        return "Rn,(Rm)";
      }
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
       * Set to false by `.smart off`. Re-enabled by `.smart` or `.smart on`.
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
        if (this.handleBranchInstructions(opcode, operand)) {
          return true;
        }
        let num = 0;
        if (operand) {
          num = this.assembler.operandResolver.getnum(operand);
        }
        return this.handleGenericOpcode(opcode, num, len);
      }
      /**
       * Encodes ADC / LDA / SBC / STA. Logic/compare ops are
       * {@link handleLogicAndCompareOperations}. STA has no immediate form.
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
       * (`len === 2`). This family has no dp,y / long,y. CPX/CPY have no `(dp,x)` /
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
            // `[...]` is remapped to directIndirectLong first. These keys are the
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
       * `expandOperand` may turn `#10` into `#$A`. Strip `$` before parseInt.
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
            if (currentOpcode === "JMP") {
              mode4 = "JML";
            } else if (currentOpcode === "JSR") {
              mode4 = "JSL";
            }
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
       * Encodes STX / STY / STZ. STX indexes Y only (no abs,y). STY indexes X only
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
       * MVN/MVP. WDC and the hover catalog spell `dest, src`. We still write bytes
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
       * always 16-bit. The rest are 8-bit. `.b/.w` on REP/SEP only validates range.
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
       * 65816 has no 32-bit immediate. Callers treat it as width 4 for PEA-like repeats.
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
var readLittleEndian2, signedByte, register2, address2, immediate, bit, relative, bitAddress, fixedRegisters, operandsFor2, referencesFor2, buildInstruction2, Spc700Decoder;
var init_spc700_decoder = __esm({
  "packages/plugin-snes/src/architectures/spc700-decoder.ts"() {
    "use strict";
    init_spc700_spec();
    readLittleEndian2 = (bytes, offset, width) => {
      let value = 0;
      for (let index = 0; index < width; index++) {
        value |= (bytes[offset + index] ?? 0) << index * 8;
      }
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
      if (fixed) {
        return fixed.map(register2);
      }
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
        if (operand.kind !== "address" || operand.value === void 0) {
          continue;
        }
        if (references.some((reference) => reference.operandIndex === index)) {
          continue;
        }
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
        if (!bytes) {
          throw new Error("Decoder byte source violated its bounds contract.");
        }
        return { kind: "instruction", instruction: buildInstruction2(specification2, bytes, context) };
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
        if (character === "(") {
          level++;
        }
        if (character === ")") {
          level--;
        }
        if (character === "," && level === 0) {
          operands.push(current.trim());
          current = "";
        } else {
          current += character;
        }
      }
      if (current.trim()) {
        operands.push(current.trim());
      }
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
       * not stall. Encode will still reject them.
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
       * indirectX (no extra byte). `($dp+X)` is indirectDpX.
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
       * ASL / LSR / ROL / ROR / INC / DEC. `A` is implied-acc. `DEC X`/`DEC Y` and
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
       * SET0–SET7 / CLR0–CLR7 `$dp`. Bit is in the mnemonic. Asar also accepts
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
       * @param {LoweredOperand} [_rightLowered] Unused. Kept for call-site symmetry.
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
          if (!match) {
            return false;
          }
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
          // The reverse: "A,$1234" => 0xe5 or 0xe4 for dp. "X,$1234" => 0xe9 or 0xf8 for dp, etc.
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
        const hex2 = mem.addressText.match(/^\$([\da-f]+)$/i);
        let addr;
        if (hex2) {
          addr = Number.parseInt(hex2[1], 16) & 65535;
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
var word, register3, immediate2, address3, operandsFor3, r15Target, controlsFor, buildInstruction3, buildFusedInstruction, matchFused, availableAt, truncated, prefixAlt, SuperFxDecoder;
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
        if (specification2.mnemonic === "LM" || specification2.mnemonic === "LMS") {
          return "indirect";
        }
      }
      if (specification2.writesDestination && state.destinationRegister === 15) {
        return "indirect";
      }
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
            if (!bytes2) {
              return truncated(context, fused2.minimumSize);
            }
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
              if (!bytes3) {
                return truncated(context, required);
              }
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
        if (!bytes) {
          return truncated(context, specification2.minimumSize);
        }
        return {
          kind: "instruction",
          instruction: buildInstruction3(specification2, bytes, context, state, 0)
        };
      }
    };
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
      let checksum2 = 0;
      if (mode3 === "simple" || (romLength & romLength - 1) === 0) {
        for (let i = 0; i < romLength; i++) {
          checksum2 += romdata[i] & 255;
        }
        return checksum2 & 65535;
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
        checksum2 += romdata[i] & 255;
      }
      for (let i = firstPart; i < romLength; i++) {
        secondPartSum += romdata[i] & 255;
      }
      return checksum2 + secondPartSum * repeatCount & 65535;
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
       *   Hardware stores a word index (`addr >> 1`). Asar stores `addr & 0xff`. Explicit
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
       * operands. Unknown mnemonics return false (`unknownInstructionBehavior` is
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
       * Single-operand Super FX: short branches (`$XX` is a raw offset, labels stay
       * PC-relative), then register / `#0`–`#15` / `(Rn)` ops.
       * @param {string} opcode Uppercased mnemonic.
       * @param {string} operand The operand.
       * @param {number} operandLength Logged only. Encoded size is fixed per opcode family.
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
       * Encode then stores `addr >> 1`. This check is the byte-address constraint.
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
       * Fallback width when lowering did not supply `length`. `$XX` is 1. Everything else is 2.
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

// packages/assets/src/validation.ts
function integer2(value, label, minimum, maximum) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(`${label} must be an integer in ${minimum}..${maximum}.`);
  }
  return value;
}
function unitCount(bytes, size, label) {
  if (bytes.length % size !== 0) {
    throw new RangeError(`${label} length ${bytes.length} is not divisible by ${size}.`);
  }
  return bytes.length / size;
}
function isNamespacedId(id) {
  const parts = id.split(".");
  return parts.length > 1 && /^[a-z][\da-z-]*$/.test(parts[0]) && parts.slice(1).every((part) => /^[\da-z][\da-z-]*$/.test(part));
}
var init_validation = __esm({
  "packages/assets/src/validation.ts"() {
    "use strict";
  }
});

// packages/assets/src/registry.ts
function convertAsset(registry2, request) {
  const importer = registry2.importerFor(request.source.mediaType);
  const encoder = registry2.encoderFor(request.format);
  const source = { ...request.source, bytes: request.source.bytes.slice() };
  const resources = Object.fromEntries(
    Object.entries(request.resources ?? {}).map(([name, input]) => [
      name,
      { ...input, bytes: input.bytes.slice() }
    ])
  );
  const document2 = importer.import(source);
  if (!encoder.inputKinds.includes(document2.kind)) {
    throw new Error(`Encoder '${encoder.id}' cannot consume '${document2.kind}'.`);
  }
  const encoded = encoder.encode(document2, request.options ?? {}, resources);
  if (encoded.fidelity.kind === "lossy-audio" && (encoder.id !== "snes.brr" || document2.kind !== "pcm-audio")) {
    throw new Error(
      `Encoder '${encoder.id}' cannot declare lossy fidelity for '${document2.kind}'.`
    );
  }
  if (!Object.hasOwn(encoded.outputs, encoder.primaryOutput)) {
    throw new Error(`Encoder '${encoder.id}' omitted primary output '${encoder.primaryOutput}'.`);
  }
  const outputs = {};
  for (const [name, output] of Object.entries(encoded.outputs)) {
    if (!(output.bytes instanceof Uint8Array)) {
      throw new Error(`Output '${name}' is not bytes.`);
    }
    outputs[name] = { ...output, bytes: output.bytes.slice() };
  }
  return {
    outputs,
    primaryOutput: encoder.primaryOutput,
    fidelity: encoded.fidelity,
    importer: { id: importer.id, version: importer.version },
    encoder: { id: encoder.id, version: encoder.version },
    options: encoded.normalizedOptions,
    document: document2
  };
}
var AssetRegistry;
var init_registry = __esm({
  "packages/assets/src/registry.ts"() {
    "use strict";
    init_validation();
    AssetRegistry = class {
      #importers = /* @__PURE__ */ new Map();
      #encoders = /* @__PURE__ */ new Map();
      #mediaTypes = /* @__PURE__ */ new Map();
      registerImporter(importer) {
        if (!isNamespacedId(importer.id) || !importer.version || importer.mediaTypes.length === 0 || this.#importers.has(importer.id)) {
          throw new Error(`Invalid or duplicate asset importer '${importer.id}'.`);
        }
        for (const mediaType of importer.mediaTypes) {
          if (this.#mediaTypes.has(mediaType)) {
            throw new Error(`Duplicate asset media type '${mediaType}'.`);
          }
        }
        this.#importers.set(importer.id, importer);
        importer.mediaTypes.forEach((type) => this.#mediaTypes.set(type, importer));
        return this;
      }
      registerEncoder(encoder) {
        if (!isNamespacedId(encoder.id) || !encoder.version || !encoder.primaryOutput || encoder.inputKinds.length === 0 || this.#encoders.has(encoder.id)) {
          throw new Error(`Invalid or duplicate asset encoder '${encoder.id}'.`);
        }
        this.#encoders.set(encoder.id, encoder);
        return this;
      }
      importerFor(mediaType) {
        const importer = this.#mediaTypes.get(mediaType);
        if (!importer) {
          throw new Error(`No asset importer for '${mediaType}'.`);
        }
        return importer;
      }
      encoderFor(id) {
        const encoder = this.#encoders.get(id);
        if (!encoder) {
          throw new Error(`No asset encoder '${id}'.`);
        }
        return encoder;
      }
    };
  }
});

// packages/assets/src/index.ts
var init_src2 = __esm({
  "packages/assets/src/index.ts"() {
    "use strict";
    init_registry();
  }
});

// node_modules/@uttori/data-tools/node_modules/pako/dist/pako.mjs
function zero$1(buf) {
  let len = buf.length;
  while (--len >= 0) buf[len] = 0;
}
function inflate_fast(strm, start) {
  let _in;
  let last;
  let _out;
  let beg;
  let end;
  let dmax;
  let wsize;
  let whave;
  let wnext;
  let s_window;
  let hold;
  let bits;
  let lcode;
  let dcode;
  let lmask;
  let dmask;
  let here;
  let op2;
  let len;
  let dist;
  let from;
  let from_source;
  let input, output;
  const state = strm.state;
  _in = strm.next_in;
  input = strm.input;
  last = _in + (strm.avail_in - 5);
  _out = strm.next_out;
  output = strm.output;
  beg = _out - (start - strm.avail_out);
  end = _out + (strm.avail_out - 257);
  dmax = state.dmax;
  wsize = state.wsize;
  whave = state.whave;
  wnext = state.wnext;
  s_window = state.window;
  hold = state.hold;
  bits = state.bits;
  lcode = state.lencode;
  dcode = state.distcode;
  lmask = (1 << state.lenbits) - 1;
  dmask = (1 << state.distbits) - 1;
  top: do {
    if (bits < 15) {
      hold += input[_in++] << bits;
      bits += 8;
      hold += input[_in++] << bits;
      bits += 8;
    }
    here = lcode[hold & lmask];
    dolen: for (; ; ) {
      op2 = here >>> 24;
      hold >>>= op2;
      bits -= op2;
      op2 = here >>> 16 & 255;
      if (op2 === 0) output[_out++] = here & 65535;
      else if (op2 & 16) {
        len = here & 65535;
        op2 &= 15;
        if (op2) {
          if (bits < op2) {
            hold += input[_in++] << bits;
            bits += 8;
          }
          len += hold & (1 << op2) - 1;
          hold >>>= op2;
          bits -= op2;
        }
        if (bits < 15) {
          hold += input[_in++] << bits;
          bits += 8;
          hold += input[_in++] << bits;
          bits += 8;
        }
        here = dcode[hold & dmask];
        dodist: for (; ; ) {
          op2 = here >>> 24;
          hold >>>= op2;
          bits -= op2;
          op2 = here >>> 16 & 255;
          if (op2 & 16) {
            dist = here & 65535;
            op2 &= 15;
            if (bits < op2) {
              hold += input[_in++] << bits;
              bits += 8;
              if (bits < op2) {
                hold += input[_in++] << bits;
                bits += 8;
              }
            }
            dist += hold & (1 << op2) - 1;
            if (dist > dmax) {
              strm.msg = "invalid distance too far back";
              state.mode = BAD$1;
              break top;
            }
            hold >>>= op2;
            bits -= op2;
            op2 = _out - beg;
            if (dist > op2) {
              op2 = dist - op2;
              if (op2 > whave) {
                if (state.sane) {
                  strm.msg = "invalid distance too far back";
                  state.mode = BAD$1;
                  break top;
                }
              }
              from = 0;
              from_source = s_window;
              if (wnext === 0) {
                from += wsize - op2;
                if (op2 < len) {
                  len -= op2;
                  do
                    output[_out++] = s_window[from++];
                  while (--op2);
                  from = _out - dist;
                  from_source = output;
                }
              } else if (wnext < op2) {
                from += wsize + wnext - op2;
                op2 -= wnext;
                if (op2 < len) {
                  len -= op2;
                  do
                    output[_out++] = s_window[from++];
                  while (--op2);
                  from = 0;
                  if (wnext < len) {
                    op2 = wnext;
                    len -= op2;
                    do
                      output[_out++] = s_window[from++];
                    while (--op2);
                    from = _out - dist;
                    from_source = output;
                  }
                }
              } else {
                from += wnext - op2;
                if (op2 < len) {
                  len -= op2;
                  do
                    output[_out++] = s_window[from++];
                  while (--op2);
                  from = _out - dist;
                  from_source = output;
                }
              }
              while (len > 2) {
                output[_out++] = from_source[from++];
                output[_out++] = from_source[from++];
                output[_out++] = from_source[from++];
                len -= 3;
              }
              if (len) {
                output[_out++] = from_source[from++];
                if (len > 1) output[_out++] = from_source[from++];
              }
            } else {
              from = _out - dist;
              do {
                output[_out++] = output[from++];
                output[_out++] = output[from++];
                output[_out++] = output[from++];
                len -= 3;
              } while (len > 2);
              if (len) {
                output[_out++] = output[from++];
                if (len > 1) output[_out++] = output[from++];
              }
            }
          } else if ((op2 & 64) === 0) {
            here = dcode[(here & 65535) + (hold & (1 << op2) - 1)];
            continue dodist;
          } else {
            strm.msg = "invalid distance code";
            state.mode = BAD$1;
            break top;
          }
          break;
        }
      } else if ((op2 & 64) === 0) {
        here = lcode[(here & 65535) + (hold & (1 << op2) - 1)];
        continue dolen;
      } else if (op2 & 32) {
        state.mode = TYPE$1;
        break top;
      } else {
        strm.msg = "invalid literal/length code";
        state.mode = BAD$1;
        break top;
      }
      break;
    }
  } while (_in < last && _out < end);
  len = bits >> 3;
  _in -= len;
  bits -= len << 3;
  hold &= (1 << bits) - 1;
  strm.next_in = _in;
  strm.next_out = _out;
  strm.avail_in = _in < last ? 5 + (last - _in) : 5 - (_in - last);
  strm.avail_out = _out < end ? 257 + (end - _out) : 257 - (_out - end);
  state.hold = hold;
  state.bits = bits;
}
function deflate(input, options = {}) {
  const deflator = new Deflate(options);
  deflator.push(input, true);
  if (deflator.err) throw new Error(deflator.msg);
  return deflator.result;
}
var Z_FIXED, Z_BINARY, Z_TEXT, Z_UNKNOWN, STORED_BLOCK, STATIC_TREES, DYN_TREES, LENGTH_CODES, LITERALS, L_CODES, D_CODES, BL_CODES, HEAP_SIZE$1, MAX_BITS, Buf_size, MAX_BL_BITS, END_BLOCK, REP_3_6, REPZ_3_10, REPZ_11_138, extra_lbits, extra_dbits, extra_blbits, bl_order, DIST_CODE_LEN, static_ltree, static_dtree, _dist_code, _length_code, base_length, base_dist, StaticTreeDesc, static_l_desc, static_d_desc, static_bl_desc, TreeDesc, d_code, put_short, send_bits, send_code, bi_reverse, bi_flush, gen_bitlen, gen_codes, tr_static_init, init_block, bi_windup, smaller, pqdownheap, compress_block, build_tree, scan_tree, send_tree, build_bl_tree, send_all_trees, detect_data_type, static_init_done, _tr_init, _tr_stored_block, _tr_align, _tr_flush_block, _tr_tally, adler32, makeTable, crcTable, crc32, messages_default, MAX_MEM_LEVEL, HEAP_SIZE, MIN_MATCH, MAX_MATCH, MIN_LOOKAHEAD, PRESET_DICT, INIT_STATE, GZIP_STATE, EXTRA_STATE, NAME_STATE, COMMENT_STATE, HCRC_STATE, BUSY_STATE, FINISH_STATE, BS_NEED_MORE, BS_BLOCK_DONE, BS_FINISH_STARTED, BS_FINISH_DONE, OS_CODE, err, rank, zero, slide_hash, HASH, INSERT_STRING, flush_pending, flush_block_only, put_byte, putShortMSB, read_buf, longest_match, fill_window, deflate_stored, deflate_fast, deflate_slow, deflate_rle, deflate_huff, Config, configuration_table, lm_init, DeflateState, deflateStateCheck, deflateResetKeep, deflateReset, deflateInit2, deflate$1, deflateEnd, deflateSetDictionary, BAD$1, TYPE$1, MAXBITS, ENOUGH_LENS$1, ENOUGH_DISTS$1, CODES$1, LENS$1, DISTS$1, lbase, lext, dbase, dext, inflate_table, CODES, LENS, DISTS, HEAD, FLAGS, TIME, OS, EXLEN, EXTRA, NAME, COMMENT, HCRC, DICTID, DICT, TYPE, TYPEDO, STORED, COPY_, COPY, TABLE, LENLENS, CODELENS, LEN_, LEN, LENEXT, DIST, DISTEXT, MATCH, LIT, CHECK, LENGTH, DONE, BAD, MEM, SYNC, ENOUGH_LENS, ENOUGH_DISTS, zswap32, InflateState, inflateStateCheck, inflateResetKeep, inflateReset, inflateReset2, inflateInit2, virgin, lenfix, distfix, fixedtables, updatewindow, inflate$1, inflateEnd, inflateSetDictionary, ZStream, flattenChunks, toString$1, defaultOptions$1, Deflate, toString, defaultOptions, Inflate;
var init_pako = __esm({
  "node_modules/@uttori/data-tools/node_modules/pako/dist/pako.mjs"() {
    Z_FIXED = 4;
    Z_BINARY = 0;
    Z_TEXT = 1;
    Z_UNKNOWN = 2;
    STORED_BLOCK = 0;
    STATIC_TREES = 1;
    DYN_TREES = 2;
    LENGTH_CODES = 29;
    LITERALS = 256;
    L_CODES = 286;
    D_CODES = 30;
    BL_CODES = 19;
    HEAP_SIZE$1 = 573;
    MAX_BITS = 15;
    Buf_size = 16;
    MAX_BL_BITS = 7;
    END_BLOCK = 256;
    REP_3_6 = 16;
    REPZ_3_10 = 17;
    REPZ_11_138 = 18;
    extra_lbits = new Uint8Array([
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      1,
      1,
      1,
      1,
      2,
      2,
      2,
      2,
      3,
      3,
      3,
      3,
      4,
      4,
      4,
      4,
      5,
      5,
      5,
      5,
      0
    ]);
    extra_dbits = new Uint8Array([
      0,
      0,
      0,
      0,
      1,
      1,
      2,
      2,
      3,
      3,
      4,
      4,
      5,
      5,
      6,
      6,
      7,
      7,
      8,
      8,
      9,
      9,
      10,
      10,
      11,
      11,
      12,
      12,
      13,
      13
    ]);
    extra_blbits = new Uint8Array([
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      2,
      3,
      7
    ]);
    bl_order = new Uint8Array([
      16,
      17,
      18,
      0,
      8,
      7,
      9,
      6,
      10,
      5,
      11,
      4,
      12,
      3,
      13,
      2,
      14,
      1,
      15
    ]);
    DIST_CODE_LEN = 512;
    static_ltree = new Array(288 * 2);
    zero$1(static_ltree);
    static_dtree = new Array(D_CODES * 2);
    zero$1(static_dtree);
    _dist_code = new Array(DIST_CODE_LEN);
    zero$1(_dist_code);
    _length_code = new Array(256);
    zero$1(_length_code);
    base_length = new Array(LENGTH_CODES);
    zero$1(base_length);
    base_dist = new Array(D_CODES);
    zero$1(base_dist);
    StaticTreeDesc = class {
      constructor(static_tree, extra_bits, extra_base, elems, max_length) {
        this.static_tree = static_tree;
        this.extra_bits = extra_bits;
        this.extra_base = extra_base;
        this.elems = elems;
        this.max_length = max_length;
        this.has_stree = static_tree && static_tree.length;
      }
    };
    TreeDesc = class {
      constructor(dyn_tree, stat_desc) {
        this.dyn_tree = dyn_tree;
        this.max_code = 0;
        this.stat_desc = stat_desc;
      }
    };
    d_code = (dist) => {
      return dist < 256 ? _dist_code[dist] : _dist_code[256 + (dist >>> 7)];
    };
    put_short = (s, w) => {
      s.pending_buf[s.pending++] = w & 255;
      s.pending_buf[s.pending++] = w >>> 8 & 255;
    };
    send_bits = (s, value, length) => {
      if (s.bi_valid > Buf_size - length) {
        s.bi_buf |= value << s.bi_valid & 65535;
        put_short(s, s.bi_buf);
        s.bi_buf = value >> Buf_size - s.bi_valid;
        s.bi_valid += length - Buf_size;
      } else {
        s.bi_buf |= value << s.bi_valid & 65535;
        s.bi_valid += length;
      }
    };
    send_code = (s, c, tree) => {
      send_bits(s, tree[c * 2], tree[c * 2 + 1]);
    };
    bi_reverse = (code, len) => {
      let res = 0;
      do {
        res |= code & 1;
        code >>>= 1;
        res <<= 1;
      } while (--len > 0);
      return res >>> 1;
    };
    bi_flush = (s) => {
      if (s.bi_valid === 16) {
        put_short(s, s.bi_buf);
        s.bi_buf = 0;
        s.bi_valid = 0;
      } else if (s.bi_valid >= 8) {
        s.pending_buf[s.pending++] = s.bi_buf & 255;
        s.bi_buf >>= 8;
        s.bi_valid -= 8;
      }
    };
    gen_bitlen = (s, desc) => {
      const tree = desc.dyn_tree;
      const max_code = desc.max_code;
      const stree = desc.stat_desc.static_tree;
      const has_stree = desc.stat_desc.has_stree;
      const extra = desc.stat_desc.extra_bits;
      const base = desc.stat_desc.extra_base;
      const max_length = desc.stat_desc.max_length;
      let h;
      let n, m;
      let bits;
      let xbits;
      let f;
      let overflow = 0;
      for (bits = 0; bits <= MAX_BITS; bits++) s.bl_count[bits] = 0;
      tree[s.heap[s.heap_max] * 2 + 1] = 0;
      for (h = s.heap_max + 1; h < HEAP_SIZE$1; h++) {
        n = s.heap[h];
        bits = tree[tree[n * 2 + 1] * 2 + 1] + 1;
        if (bits > max_length) {
          bits = max_length;
          overflow++;
        }
        tree[n * 2 + 1] = bits;
        if (n > max_code) continue;
        s.bl_count[bits]++;
        xbits = 0;
        if (n >= base) xbits = extra[n - base];
        f = tree[n * 2];
        s.opt_len += f * (bits + xbits);
        if (has_stree) s.static_len += f * (stree[n * 2 + 1] + xbits);
      }
      if (overflow === 0) return;
      do {
        bits = max_length - 1;
        while (s.bl_count[bits] === 0) bits--;
        s.bl_count[bits]--;
        s.bl_count[bits + 1] += 2;
        s.bl_count[max_length]--;
        overflow -= 2;
      } while (overflow > 0);
      for (bits = max_length; bits !== 0; bits--) {
        n = s.bl_count[bits];
        while (n !== 0) {
          m = s.heap[--h];
          if (m > max_code) continue;
          if (tree[m * 2 + 1] !== bits) {
            s.opt_len += (bits - tree[m * 2 + 1]) * tree[m * 2];
            tree[m * 2 + 1] = bits;
          }
          n--;
        }
      }
    };
    gen_codes = (tree, max_code, bl_count) => {
      const next_code = new Array(16);
      let code = 0;
      let bits;
      let n;
      for (bits = 1; bits <= MAX_BITS; bits++) {
        code = code + bl_count[bits - 1] << 1;
        next_code[bits] = code;
      }
      for (n = 0; n <= max_code; n++) {
        let len = tree[n * 2 + 1];
        if (len === 0) continue;
        tree[n * 2] = bi_reverse(next_code[len]++, len);
      }
    };
    tr_static_init = () => {
      let n;
      let bits;
      let length;
      let code;
      let dist;
      const bl_count = new Array(16);
      length = 0;
      for (code = 0; code < LENGTH_CODES - 1; code++) {
        base_length[code] = length;
        for (n = 0; n < 1 << extra_lbits[code]; n++) _length_code[length++] = code;
      }
      _length_code[length - 1] = code;
      dist = 0;
      for (code = 0; code < 16; code++) {
        base_dist[code] = dist;
        for (n = 0; n < 1 << extra_dbits[code]; n++) _dist_code[dist++] = code;
      }
      dist >>= 7;
      for (; code < D_CODES; code++) {
        base_dist[code] = dist << 7;
        for (n = 0; n < 1 << extra_dbits[code] - 7; n++) _dist_code[256 + dist++] = code;
      }
      for (bits = 0; bits <= MAX_BITS; bits++) bl_count[bits] = 0;
      n = 0;
      while (n <= 143) {
        static_ltree[n * 2 + 1] = 8;
        n++;
        bl_count[8]++;
      }
      while (n <= 255) {
        static_ltree[n * 2 + 1] = 9;
        n++;
        bl_count[9]++;
      }
      while (n <= 279) {
        static_ltree[n * 2 + 1] = 7;
        n++;
        bl_count[7]++;
      }
      while (n <= 287) {
        static_ltree[n * 2 + 1] = 8;
        n++;
        bl_count[8]++;
      }
      gen_codes(static_ltree, 287, bl_count);
      for (n = 0; n < D_CODES; n++) {
        static_dtree[n * 2 + 1] = 5;
        static_dtree[n * 2] = bi_reverse(n, 5);
      }
      static_l_desc = new StaticTreeDesc(static_ltree, extra_lbits, 257, L_CODES, MAX_BITS);
      static_d_desc = new StaticTreeDesc(static_dtree, extra_dbits, 0, D_CODES, MAX_BITS);
      static_bl_desc = new StaticTreeDesc(new Array(0), extra_blbits, 0, BL_CODES, MAX_BL_BITS);
    };
    init_block = (s) => {
      let n;
      for (n = 0; n < L_CODES; n++) s.dyn_ltree[n * 2] = 0;
      for (n = 0; n < D_CODES; n++) s.dyn_dtree[n * 2] = 0;
      for (n = 0; n < BL_CODES; n++) s.bl_tree[n * 2] = 0;
      s.dyn_ltree[END_BLOCK * 2] = 1;
      s.opt_len = s.static_len = 0;
      s.sym_next = s.matches = 0;
    };
    bi_windup = (s) => {
      if (s.bi_valid > 8) put_short(s, s.bi_buf);
      else if (s.bi_valid > 0) s.pending_buf[s.pending++] = s.bi_buf;
      s.bi_buf = 0;
      s.bi_valid = 0;
    };
    smaller = (tree, n, m, depth) => {
      const _n2 = n * 2;
      const _m2 = m * 2;
      return tree[_n2] < tree[_m2] || tree[_n2] === tree[_m2] && depth[n] <= depth[m];
    };
    pqdownheap = (s, tree, k) => {
      const v = s.heap[k];
      let j = k << 1;
      while (j <= s.heap_len) {
        if (j < s.heap_len && smaller(tree, s.heap[j + 1], s.heap[j], s.depth)) j++;
        if (smaller(tree, v, s.heap[j], s.depth)) break;
        s.heap[k] = s.heap[j];
        k = j;
        j <<= 1;
      }
      s.heap[k] = v;
    };
    compress_block = (s, ltree, dtree) => {
      let dist;
      let lc;
      let sx = 0;
      let code;
      let extra;
      if (s.sym_next !== 0) do {
        dist = s.pending_buf[s.sym_buf + sx++] & 255;
        dist += (s.pending_buf[s.sym_buf + sx++] & 255) << 8;
        lc = s.pending_buf[s.sym_buf + sx++];
        if (dist === 0) send_code(s, lc, ltree);
        else {
          code = _length_code[lc];
          send_code(s, code + LITERALS + 1, ltree);
          extra = extra_lbits[code];
          if (extra !== 0) {
            lc -= base_length[code];
            send_bits(s, lc, extra);
          }
          dist--;
          code = d_code(dist);
          send_code(s, code, dtree);
          extra = extra_dbits[code];
          if (extra !== 0) {
            dist -= base_dist[code];
            send_bits(s, dist, extra);
          }
        }
      } while (sx < s.sym_next);
      send_code(s, END_BLOCK, ltree);
    };
    build_tree = (s, desc) => {
      const tree = desc.dyn_tree;
      const stree = desc.stat_desc.static_tree;
      const has_stree = desc.stat_desc.has_stree;
      const elems = desc.stat_desc.elems;
      let n, m;
      let max_code = -1;
      let node;
      s.heap_len = 0;
      s.heap_max = HEAP_SIZE$1;
      for (n = 0; n < elems; n++) if (tree[n * 2] !== 0) {
        s.heap[++s.heap_len] = max_code = n;
        s.depth[n] = 0;
      } else tree[n * 2 + 1] = 0;
      while (s.heap_len < 2) {
        node = s.heap[++s.heap_len] = max_code < 2 ? ++max_code : 0;
        tree[node * 2] = 1;
        s.depth[node] = 0;
        s.opt_len--;
        if (has_stree) s.static_len -= stree[node * 2 + 1];
      }
      desc.max_code = max_code;
      for (n = s.heap_len >> 1; n >= 1; n--) pqdownheap(s, tree, n);
      node = elems;
      do {
        n = s.heap[1];
        s.heap[1] = s.heap[s.heap_len--];
        pqdownheap(s, tree, 1);
        m = s.heap[1];
        s.heap[--s.heap_max] = n;
        s.heap[--s.heap_max] = m;
        tree[node * 2] = tree[n * 2] + tree[m * 2];
        s.depth[node] = (s.depth[n] >= s.depth[m] ? s.depth[n] : s.depth[m]) + 1;
        tree[n * 2 + 1] = tree[m * 2 + 1] = node;
        s.heap[1] = node++;
        pqdownheap(s, tree, 1);
      } while (s.heap_len >= 2);
      s.heap[--s.heap_max] = s.heap[1];
      gen_bitlen(s, desc);
      gen_codes(tree, max_code, s.bl_count);
    };
    scan_tree = (s, tree, max_code) => {
      let n;
      let prevlen = -1;
      let curlen;
      let nextlen = tree[1];
      let count = 0;
      let max_count = 7;
      let min_count = 4;
      if (nextlen === 0) {
        max_count = 138;
        min_count = 3;
      }
      tree[(max_code + 1) * 2 + 1] = 65535;
      for (n = 0; n <= max_code; n++) {
        curlen = nextlen;
        nextlen = tree[(n + 1) * 2 + 1];
        if (++count < max_count && curlen === nextlen) continue;
        else if (count < min_count) s.bl_tree[curlen * 2] += count;
        else if (curlen !== 0) {
          if (curlen !== prevlen) s.bl_tree[curlen * 2]++;
          s.bl_tree[REP_3_6 * 2]++;
        } else if (count <= 10) s.bl_tree[REPZ_3_10 * 2]++;
        else s.bl_tree[REPZ_11_138 * 2]++;
        count = 0;
        prevlen = curlen;
        if (nextlen === 0) {
          max_count = 138;
          min_count = 3;
        } else if (curlen === nextlen) {
          max_count = 6;
          min_count = 3;
        } else {
          max_count = 7;
          min_count = 4;
        }
      }
    };
    send_tree = (s, tree, max_code) => {
      let n;
      let prevlen = -1;
      let curlen;
      let nextlen = tree[1];
      let count = 0;
      let max_count = 7;
      let min_count = 4;
      if (nextlen === 0) {
        max_count = 138;
        min_count = 3;
      }
      for (n = 0; n <= max_code; n++) {
        curlen = nextlen;
        nextlen = tree[(n + 1) * 2 + 1];
        if (++count < max_count && curlen === nextlen) continue;
        else if (count < min_count) do
          send_code(s, curlen, s.bl_tree);
        while (--count !== 0);
        else if (curlen !== 0) {
          if (curlen !== prevlen) {
            send_code(s, curlen, s.bl_tree);
            count--;
          }
          send_code(s, REP_3_6, s.bl_tree);
          send_bits(s, count - 3, 2);
        } else if (count <= 10) {
          send_code(s, REPZ_3_10, s.bl_tree);
          send_bits(s, count - 3, 3);
        } else {
          send_code(s, REPZ_11_138, s.bl_tree);
          send_bits(s, count - 11, 7);
        }
        count = 0;
        prevlen = curlen;
        if (nextlen === 0) {
          max_count = 138;
          min_count = 3;
        } else if (curlen === nextlen) {
          max_count = 6;
          min_count = 3;
        } else {
          max_count = 7;
          min_count = 4;
        }
      }
    };
    build_bl_tree = (s) => {
      let max_blindex;
      scan_tree(s, s.dyn_ltree, s.l_desc.max_code);
      scan_tree(s, s.dyn_dtree, s.d_desc.max_code);
      build_tree(s, s.bl_desc);
      for (max_blindex = BL_CODES - 1; max_blindex >= 3; max_blindex--) if (s.bl_tree[bl_order[max_blindex] * 2 + 1] !== 0) break;
      s.opt_len += 3 * (max_blindex + 1) + 5 + 5 + 4;
      return max_blindex;
    };
    send_all_trees = (s, lcodes, dcodes, blcodes) => {
      let rank2;
      send_bits(s, lcodes - 257, 5);
      send_bits(s, dcodes - 1, 5);
      send_bits(s, blcodes - 4, 4);
      for (rank2 = 0; rank2 < blcodes; rank2++) send_bits(s, s.bl_tree[bl_order[rank2] * 2 + 1], 3);
      send_tree(s, s.dyn_ltree, lcodes - 1);
      send_tree(s, s.dyn_dtree, dcodes - 1);
    };
    detect_data_type = (s) => {
      let block_mask = 4093624447;
      let n;
      for (n = 0; n <= 31; n++, block_mask >>>= 1) if (block_mask & 1 && s.dyn_ltree[n * 2] !== 0) return Z_BINARY;
      if (s.dyn_ltree[18] !== 0 || s.dyn_ltree[20] !== 0 || s.dyn_ltree[26] !== 0) return Z_TEXT;
      for (n = 32; n < LITERALS; n++) if (s.dyn_ltree[n * 2] !== 0) return Z_TEXT;
      return Z_BINARY;
    };
    static_init_done = false;
    _tr_init = (s) => {
      if (!static_init_done) {
        tr_static_init();
        static_init_done = true;
      }
      s.l_desc = new TreeDesc(s.dyn_ltree, static_l_desc);
      s.d_desc = new TreeDesc(s.dyn_dtree, static_d_desc);
      s.bl_desc = new TreeDesc(s.bl_tree, static_bl_desc);
      s.bi_buf = 0;
      s.bi_valid = 0;
      init_block(s);
    };
    _tr_stored_block = (s, buf, stored_len, last) => {
      send_bits(s, (STORED_BLOCK << 1) + (last ? 1 : 0), 3);
      bi_windup(s);
      put_short(s, stored_len);
      put_short(s, ~stored_len);
      if (stored_len) s.pending_buf.set(s.window.subarray(buf, buf + stored_len), s.pending);
      s.pending += stored_len;
    };
    _tr_align = (s) => {
      send_bits(s, STATIC_TREES << 1, 3);
      send_code(s, END_BLOCK, static_ltree);
      bi_flush(s);
    };
    _tr_flush_block = (s, buf, stored_len, last) => {
      let opt_lenb, static_lenb;
      let max_blindex = 0;
      if (s.level > 0) {
        if (s.strm.data_type === Z_UNKNOWN) s.strm.data_type = detect_data_type(s);
        build_tree(s, s.l_desc);
        build_tree(s, s.d_desc);
        max_blindex = build_bl_tree(s);
        opt_lenb = s.opt_len + 3 + 7 >>> 3;
        static_lenb = s.static_len + 3 + 7 >>> 3;
        if (static_lenb <= opt_lenb || s.strategy === Z_FIXED) opt_lenb = static_lenb;
      } else opt_lenb = static_lenb = stored_len + 5;
      if (stored_len + 4 <= opt_lenb && buf !== -1) _tr_stored_block(s, buf, stored_len, last);
      else if (s.strategy === Z_FIXED || static_lenb === opt_lenb) {
        send_bits(s, (STATIC_TREES << 1) + (last ? 1 : 0), 3);
        compress_block(s, static_ltree, static_dtree);
      } else {
        send_bits(s, (DYN_TREES << 1) + (last ? 1 : 0), 3);
        send_all_trees(s, s.l_desc.max_code + 1, s.d_desc.max_code + 1, max_blindex + 1);
        compress_block(s, s.dyn_ltree, s.dyn_dtree);
      }
      init_block(s);
      if (last) bi_windup(s);
    };
    _tr_tally = (s, dist, lc) => {
      s.pending_buf[s.sym_buf + s.sym_next++] = dist;
      s.pending_buf[s.sym_buf + s.sym_next++] = dist >> 8;
      s.pending_buf[s.sym_buf + s.sym_next++] = lc;
      if (dist === 0) s.dyn_ltree[lc * 2]++;
      else {
        s.matches++;
        dist--;
        s.dyn_ltree[(_length_code[lc] + LITERALS + 1) * 2]++;
        s.dyn_dtree[d_code(dist) * 2]++;
      }
      return s.sym_next === s.sym_end;
    };
    adler32 = (adler, buf, len, pos) => {
      let s1 = adler & 65535 | 0, s2 = adler >>> 16 & 65535 | 0, n = 0;
      while (len !== 0) {
        n = len > 2e3 ? 2e3 : len;
        len -= n;
        do {
          s1 = s1 + buf[pos++] | 0;
          s2 = s2 + s1 | 0;
        } while (--n);
        s1 %= 65521;
        s2 %= 65521;
      }
      return s1 | s2 << 16 | 0;
    };
    makeTable = () => {
      let c, table = [];
      for (var n = 0; n < 256; n++) {
        c = n;
        for (var k = 0; k < 8; k++) c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
        table[n] = c;
      }
      return table;
    };
    crcTable = new Uint32Array(makeTable());
    crc32 = (crc, buf, len, pos) => {
      const t = crcTable;
      const end = pos + len;
      crc ^= -1;
      for (let i = pos; i < end; i++) crc = crc >>> 8 ^ t[(crc ^ buf[i]) & 255];
      return crc ^ -1;
    };
    messages_default = {
      2: "need dictionary",
      1: "stream end",
      0: "",
      "-1": "file error",
      "-2": "stream error",
      "-3": "data error",
      "-4": "insufficient memory",
      "-5": "buffer error",
      "-6": "incompatible version"
    };
    MAX_MEM_LEVEL = 9;
    HEAP_SIZE = 573;
    MIN_MATCH = 3;
    MAX_MATCH = 258;
    MIN_LOOKAHEAD = 262;
    PRESET_DICT = 32;
    INIT_STATE = 42;
    GZIP_STATE = 57;
    EXTRA_STATE = 69;
    NAME_STATE = 73;
    COMMENT_STATE = 91;
    HCRC_STATE = 103;
    BUSY_STATE = 113;
    FINISH_STATE = 666;
    BS_NEED_MORE = 1;
    BS_BLOCK_DONE = 2;
    BS_FINISH_STARTED = 3;
    BS_FINISH_DONE = 4;
    OS_CODE = 3;
    err = (strm, errorCode) => {
      strm.msg = messages_default[errorCode];
      return errorCode;
    };
    rank = (f) => {
      return f * 2 - (f > 4 ? 9 : 0);
    };
    zero = (buf) => {
      let len = buf.length;
      while (--len >= 0) buf[len] = 0;
    };
    slide_hash = (s) => {
      let n, m;
      let p;
      let wsize = s.w_size;
      n = s.hash_size;
      p = n;
      do {
        m = s.head[--p];
        s.head[p] = m >= wsize ? m - wsize : 0;
      } while (--n);
      n = wsize;
      p = n;
      do {
        m = s.prev[--p];
        s.prev[p] = m >= wsize ? m - wsize : 0;
      } while (--n);
    };
    HASH = (s, prev, data) => (prev << s.hash_shift ^ data) & s.hash_mask;
    INSERT_STRING = (s, str) => {
      let h;
      if (s.legacy_hash) h = s.ins_h = HASH(s, s.ins_h, s.window[str + MIN_MATCH - 1]);
      else {
        const w = s.window;
        const value = w[str] | w[str + 1] << 8 | w[str + 2] << 16 | w[str + 3] << 24;
        h = s.ins_h = Math.imul(value, 66521) + 66521 >>> 16 & s.hash_mask;
      }
      const hash_head = s.prev[str & s.w_mask] = s.head[h];
      s.head[h] = str;
      return hash_head;
    };
    flush_pending = (strm) => {
      const s = strm.state;
      let len = s.pending;
      if (len > strm.avail_out) len = strm.avail_out;
      if (len === 0) return;
      strm.output.set(s.pending_buf.subarray(s.pending_out, s.pending_out + len), strm.next_out);
      strm.next_out += len;
      s.pending_out += len;
      strm.total_out += len;
      strm.avail_out -= len;
      s.pending -= len;
      if (s.pending === 0) s.pending_out = 0;
    };
    flush_block_only = (s, last) => {
      _tr_flush_block(s, s.block_start >= 0 ? s.block_start : -1, s.strstart - s.block_start, last);
      s.block_start = s.strstart;
      flush_pending(s.strm);
    };
    put_byte = (s, b) => {
      s.pending_buf[s.pending++] = b;
    };
    putShortMSB = (s, b) => {
      s.pending_buf[s.pending++] = b >>> 8 & 255;
      s.pending_buf[s.pending++] = b & 255;
    };
    read_buf = (strm, buf, start, size) => {
      let len = strm.avail_in;
      if (len > size) len = size;
      if (len === 0) return 0;
      strm.avail_in -= len;
      buf.set(strm.input.subarray(strm.next_in, strm.next_in + len), start);
      if (strm.state.wrap === 1) strm.adler = adler32(strm.adler, buf, len, start);
      else if (strm.state.wrap === 2) strm.adler = crc32(strm.adler, buf, len, start);
      strm.next_in += len;
      strm.total_in += len;
      return len;
    };
    longest_match = (s, cur_match) => {
      let chain_length = s.max_chain_length;
      let scan = s.strstart;
      let match;
      let len;
      let best_len = s.prev_length;
      let nice_match = s.nice_match;
      const limit = s.strstart > s.w_size - MIN_LOOKAHEAD ? s.strstart - (s.w_size - MIN_LOOKAHEAD) : 0;
      const _win = s.window;
      const wmask = s.w_mask;
      const prev = s.prev;
      const strend = s.strstart + MAX_MATCH;
      let scan_end1 = _win[scan + best_len - 1];
      let scan_end = _win[scan + best_len];
      if (s.prev_length >= s.good_match) chain_length >>= 2;
      if (nice_match > s.lookahead) nice_match = s.lookahead;
      do {
        match = cur_match;
        if (_win[match + best_len] !== scan_end || _win[match + best_len - 1] !== scan_end1 || _win[match] !== _win[scan] || _win[++match] !== _win[scan + 1]) continue;
        scan += 2;
        match++;
        do
          ;
        while (_win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && scan < strend);
        len = MAX_MATCH - (strend - scan);
        scan = strend - MAX_MATCH;
        if (len > best_len) {
          s.match_start = cur_match;
          best_len = len;
          if (len >= nice_match) break;
          scan_end1 = _win[scan + best_len - 1];
          scan_end = _win[scan + best_len];
        }
      } while ((cur_match = prev[cur_match & wmask]) > limit && --chain_length !== 0);
      if (best_len <= s.lookahead) return best_len;
      return s.lookahead;
    };
    fill_window = (s) => {
      const _w_size = s.w_size;
      let n, more, str;
      do {
        more = s.window_size - s.lookahead - s.strstart;
        if (s.strstart >= _w_size + (_w_size - MIN_LOOKAHEAD)) {
          s.window.set(s.window.subarray(_w_size, _w_size + _w_size - more), 0);
          s.match_start -= _w_size;
          s.strstart -= _w_size;
          s.block_start -= _w_size;
          if (s.insert > s.strstart) s.insert = s.strstart;
          slide_hash(s);
          more += _w_size;
        }
        if (s.strm.avail_in === 0) break;
        n = read_buf(s.strm, s.window, s.strstart + s.lookahead, more);
        s.lookahead += n;
        if (!s.legacy_hash) {
          if (s.lookahead + s.insert > MIN_MATCH) {
            str = s.strstart - s.insert;
            while (s.insert) {
              INSERT_STRING(s, str);
              str++;
              s.insert--;
              if (s.lookahead + s.insert <= MIN_MATCH) break;
            }
          }
        } else if (s.lookahead + s.insert >= MIN_MATCH) {
          str = s.strstart - s.insert;
          s.ins_h = s.window[str];
          s.ins_h = HASH(s, s.ins_h, s.window[str + 1]);
          while (s.insert) {
            INSERT_STRING(s, str);
            str++;
            s.insert--;
            if (s.lookahead + s.insert < MIN_MATCH) break;
          }
        }
      } while (s.lookahead < MIN_LOOKAHEAD && s.strm.avail_in !== 0);
    };
    deflate_stored = (s, flush) => {
      let min_block = s.pending_buf_size - 5 > s.w_size ? s.w_size : s.pending_buf_size - 5;
      let len, left, have, last = 0;
      let used = s.strm.avail_in;
      do {
        len = 65535;
        have = s.bi_valid + 42 >> 3;
        if (s.strm.avail_out < have) break;
        have = s.strm.avail_out - have;
        left = s.strstart - s.block_start;
        if (len > left + s.strm.avail_in) len = left + s.strm.avail_in;
        if (len > have) len = have;
        if (len < min_block && (len === 0 && flush !== 4 || flush === 0 || len !== left + s.strm.avail_in)) break;
        last = flush === 4 && len === left + s.strm.avail_in ? 1 : 0;
        _tr_stored_block(s, 0, 0, last);
        s.pending_buf[s.pending - 4] = len;
        s.pending_buf[s.pending - 3] = len >> 8;
        s.pending_buf[s.pending - 2] = ~len;
        s.pending_buf[s.pending - 1] = ~len >> 8;
        flush_pending(s.strm);
        if (left) {
          if (left > len) left = len;
          s.strm.output.set(s.window.subarray(s.block_start, s.block_start + left), s.strm.next_out);
          s.strm.next_out += left;
          s.strm.avail_out -= left;
          s.strm.total_out += left;
          s.block_start += left;
          len -= left;
        }
        if (len) {
          read_buf(s.strm, s.strm.output, s.strm.next_out, len);
          s.strm.next_out += len;
          s.strm.avail_out -= len;
          s.strm.total_out += len;
        }
      } while (last === 0);
      used -= s.strm.avail_in;
      if (used) {
        if (used >= s.w_size) {
          s.matches = 2;
          s.window.set(s.strm.input.subarray(s.strm.next_in - s.w_size, s.strm.next_in), 0);
          s.strstart = s.w_size;
          s.insert = s.strstart;
        } else {
          if (s.window_size - s.strstart <= used) {
            s.strstart -= s.w_size;
            s.window.set(s.window.subarray(s.w_size, s.w_size + s.strstart), 0);
            if (s.matches < 2) s.matches++;
            if (s.insert > s.strstart) s.insert = s.strstart;
          }
          s.window.set(s.strm.input.subarray(s.strm.next_in - used, s.strm.next_in), s.strstart);
          s.strstart += used;
          s.insert += used > s.w_size - s.insert ? s.w_size - s.insert : used;
        }
        s.block_start = s.strstart;
      }
      if (s.high_water < s.strstart) s.high_water = s.strstart;
      if (last) return BS_FINISH_DONE;
      if (flush !== 0 && flush !== 4 && s.strm.avail_in === 0 && s.strstart === s.block_start) return BS_BLOCK_DONE;
      have = s.window_size - s.strstart;
      if (s.strm.avail_in > have && s.block_start >= s.w_size) {
        s.block_start -= s.w_size;
        s.strstart -= s.w_size;
        s.window.set(s.window.subarray(s.w_size, s.w_size + s.strstart), 0);
        if (s.matches < 2) s.matches++;
        have += s.w_size;
        if (s.insert > s.strstart) s.insert = s.strstart;
      }
      if (have > s.strm.avail_in) have = s.strm.avail_in;
      if (have) {
        read_buf(s.strm, s.window, s.strstart, have);
        s.strstart += have;
        s.insert += have > s.w_size - s.insert ? s.w_size - s.insert : have;
      }
      if (s.high_water < s.strstart) s.high_water = s.strstart;
      have = s.bi_valid + 42 >> 3;
      have = s.pending_buf_size - have > 65535 ? 65535 : s.pending_buf_size - have;
      min_block = have > s.w_size ? s.w_size : have;
      left = s.strstart - s.block_start;
      if (left >= min_block || (left || flush === 4) && flush !== 0 && s.strm.avail_in === 0 && left <= have) {
        len = left > have ? have : left;
        last = flush === 4 && s.strm.avail_in === 0 && len === left ? 1 : 0;
        _tr_stored_block(s, s.block_start, len, last);
        s.block_start += len;
        flush_pending(s.strm);
      }
      return last ? BS_FINISH_STARTED : BS_NEED_MORE;
    };
    deflate_fast = (s, flush) => {
      let hash_head;
      let bflush;
      for (; ; ) {
        if (s.lookahead < MIN_LOOKAHEAD) {
          fill_window(s);
          if (s.lookahead < MIN_LOOKAHEAD && flush === 0) return BS_NEED_MORE;
          if (s.lookahead === 0) break;
        }
        hash_head = 0;
        if (s.lookahead >= MIN_MATCH) hash_head = INSERT_STRING(s, s.strstart);
        if (hash_head !== 0 && s.strstart - hash_head <= s.w_size - MIN_LOOKAHEAD) s.match_length = longest_match(s, hash_head);
        if (s.match_length >= MIN_MATCH) {
          bflush = _tr_tally(s, s.strstart - s.match_start, s.match_length - MIN_MATCH);
          s.lookahead -= s.match_length;
          if (s.match_length <= s.max_lazy_match && s.lookahead >= MIN_MATCH) {
            s.match_length--;
            do {
              s.strstart++;
              hash_head = INSERT_STRING(s, s.strstart);
            } while (--s.match_length !== 0);
            s.strstart++;
          } else {
            s.strstart += s.match_length;
            s.match_length = 0;
            if (s.legacy_hash) {
              s.ins_h = s.window[s.strstart];
              s.ins_h = HASH(s, s.ins_h, s.window[s.strstart + 1]);
            }
          }
        } else {
          bflush = _tr_tally(s, 0, s.window[s.strstart]);
          s.lookahead--;
          s.strstart++;
        }
        if (bflush) {
          flush_block_only(s, false);
          if (s.strm.avail_out === 0) return BS_NEED_MORE;
        }
      }
      s.insert = s.strstart < MIN_MATCH - 1 ? s.strstart : MIN_MATCH - 1;
      if (flush === 4) {
        flush_block_only(s, true);
        if (s.strm.avail_out === 0) return BS_FINISH_STARTED;
        return BS_FINISH_DONE;
      }
      if (s.sym_next) {
        flush_block_only(s, false);
        if (s.strm.avail_out === 0) return BS_NEED_MORE;
      }
      return BS_BLOCK_DONE;
    };
    deflate_slow = (s, flush) => {
      let hash_head;
      let bflush;
      let max_insert;
      for (; ; ) {
        if (s.lookahead < MIN_LOOKAHEAD) {
          fill_window(s);
          if (s.lookahead < MIN_LOOKAHEAD && flush === 0) return BS_NEED_MORE;
          if (s.lookahead === 0) break;
        }
        hash_head = 0;
        if (s.lookahead >= MIN_MATCH) hash_head = INSERT_STRING(s, s.strstart);
        s.prev_length = s.match_length;
        s.prev_match = s.match_start;
        s.match_length = MIN_MATCH - 1;
        if (hash_head !== 0 && s.prev_length < s.max_lazy_match && s.strstart - hash_head <= s.w_size - MIN_LOOKAHEAD) {
          s.match_length = longest_match(s, hash_head);
          if (s.match_length <= 5 && (s.strategy === 1 || s.match_length === MIN_MATCH && s.strstart - s.match_start > 4096)) s.match_length = MIN_MATCH - 1;
        }
        if (s.prev_length >= MIN_MATCH && s.match_length <= s.prev_length) {
          max_insert = s.strstart + s.lookahead - MIN_MATCH;
          bflush = _tr_tally(s, s.strstart - 1 - s.prev_match, s.prev_length - MIN_MATCH);
          s.lookahead -= s.prev_length - 1;
          s.prev_length -= 2;
          do
            if (++s.strstart <= max_insert) hash_head = INSERT_STRING(s, s.strstart);
          while (--s.prev_length !== 0);
          s.match_available = 0;
          s.match_length = MIN_MATCH - 1;
          s.strstart++;
          if (bflush) {
            flush_block_only(s, false);
            if (s.strm.avail_out === 0) return BS_NEED_MORE;
          }
        } else if (s.match_available) {
          bflush = _tr_tally(s, 0, s.window[s.strstart - 1]);
          if (bflush)
            flush_block_only(s, false);
          s.strstart++;
          s.lookahead--;
          if (s.strm.avail_out === 0) return BS_NEED_MORE;
        } else {
          s.match_available = 1;
          s.strstart++;
          s.lookahead--;
        }
      }
      if (s.match_available) {
        bflush = _tr_tally(s, 0, s.window[s.strstart - 1]);
        s.match_available = 0;
      }
      s.insert = s.strstart < MIN_MATCH - 1 ? s.strstart : MIN_MATCH - 1;
      if (flush === 4) {
        flush_block_only(s, true);
        if (s.strm.avail_out === 0) return BS_FINISH_STARTED;
        return BS_FINISH_DONE;
      }
      if (s.sym_next) {
        flush_block_only(s, false);
        if (s.strm.avail_out === 0) return BS_NEED_MORE;
      }
      return BS_BLOCK_DONE;
    };
    deflate_rle = (s, flush) => {
      let bflush;
      let prev;
      let scan, strend;
      const _win = s.window;
      for (; ; ) {
        if (s.lookahead <= MAX_MATCH) {
          fill_window(s);
          if (s.lookahead <= MAX_MATCH && flush === 0) return BS_NEED_MORE;
          if (s.lookahead === 0) break;
        }
        s.match_length = 0;
        if (s.lookahead >= MIN_MATCH && s.strstart > 0) {
          scan = s.strstart - 1;
          prev = _win[scan];
          if (prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan]) {
            strend = s.strstart + MAX_MATCH;
            do
              ;
            while (prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && scan < strend);
            s.match_length = MAX_MATCH - (strend - scan);
            if (s.match_length > s.lookahead) s.match_length = s.lookahead;
          }
        }
        if (s.match_length >= MIN_MATCH) {
          bflush = _tr_tally(s, 1, s.match_length - MIN_MATCH);
          s.lookahead -= s.match_length;
          s.strstart += s.match_length;
          s.match_length = 0;
        } else {
          bflush = _tr_tally(s, 0, s.window[s.strstart]);
          s.lookahead--;
          s.strstart++;
        }
        if (bflush) {
          flush_block_only(s, false);
          if (s.strm.avail_out === 0) return BS_NEED_MORE;
        }
      }
      s.insert = 0;
      if (flush === 4) {
        flush_block_only(s, true);
        if (s.strm.avail_out === 0) return BS_FINISH_STARTED;
        return BS_FINISH_DONE;
      }
      if (s.sym_next) {
        flush_block_only(s, false);
        if (s.strm.avail_out === 0) return BS_NEED_MORE;
      }
      return BS_BLOCK_DONE;
    };
    deflate_huff = (s, flush) => {
      let bflush;
      for (; ; ) {
        if (s.lookahead === 0) {
          fill_window(s);
          if (s.lookahead === 0) {
            if (flush === 0) return BS_NEED_MORE;
            break;
          }
        }
        s.match_length = 0;
        bflush = _tr_tally(s, 0, s.window[s.strstart]);
        s.lookahead--;
        s.strstart++;
        if (bflush) {
          flush_block_only(s, false);
          if (s.strm.avail_out === 0) return BS_NEED_MORE;
        }
      }
      s.insert = 0;
      if (flush === 4) {
        flush_block_only(s, true);
        if (s.strm.avail_out === 0) return BS_FINISH_STARTED;
        return BS_FINISH_DONE;
      }
      if (s.sym_next) {
        flush_block_only(s, false);
        if (s.strm.avail_out === 0) return BS_NEED_MORE;
      }
      return BS_BLOCK_DONE;
    };
    Config = class {
      constructor(good_length, max_lazy, nice_length, max_chain, func) {
        this.good_length = good_length;
        this.max_lazy = max_lazy;
        this.nice_length = nice_length;
        this.max_chain = max_chain;
        this.func = func;
      }
    };
    configuration_table = [
      new Config(0, 0, 0, 0, deflate_stored),
      new Config(4, 4, 8, 4, deflate_fast),
      new Config(4, 5, 16, 8, deflate_fast),
      new Config(4, 6, 32, 32, deflate_fast),
      new Config(4, 4, 16, 16, deflate_slow),
      new Config(8, 16, 32, 32, deflate_slow),
      new Config(8, 16, 128, 128, deflate_slow),
      new Config(8, 32, 128, 256, deflate_slow),
      new Config(32, 128, 258, 1024, deflate_slow),
      new Config(32, 258, 258, 4096, deflate_slow)
    ];
    lm_init = (s) => {
      s.window_size = 2 * s.w_size;
      zero(s.head);
      s.max_lazy_match = configuration_table[s.level].max_lazy;
      s.good_match = configuration_table[s.level].good_length;
      s.nice_match = configuration_table[s.level].nice_length;
      s.max_chain_length = configuration_table[s.level].max_chain;
      s.strstart = 0;
      s.block_start = 0;
      s.lookahead = 0;
      s.insert = 0;
      s.match_length = s.prev_length = MIN_MATCH - 1;
      s.match_available = 0;
      s.ins_h = 0;
    };
    DeflateState = class {
      constructor() {
        this.strm = null;
        this.status = 0;
        this.pending_buf = null;
        this.pending_buf_size = 0;
        this.pending_out = 0;
        this.pending = 0;
        this.wrap = 0;
        this.gzhead = null;
        this.gzindex = 0;
        this.method = 8;
        this.last_flush = -1;
        this.w_size = 0;
        this.w_bits = 0;
        this.w_mask = 0;
        this.window = null;
        this.window_size = 0;
        this.prev = null;
        this.head = null;
        this.ins_h = 0;
        this.legacy_hash = 0;
        this.hash_size = 0;
        this.hash_bits = 0;
        this.hash_mask = 0;
        this.hash_shift = 0;
        this.block_start = 0;
        this.match_length = 0;
        this.prev_match = 0;
        this.match_available = 0;
        this.strstart = 0;
        this.match_start = 0;
        this.lookahead = 0;
        this.prev_length = 0;
        this.max_chain_length = 0;
        this.max_lazy_match = 0;
        this.level = 0;
        this.strategy = 0;
        this.good_match = 0;
        this.nice_match = 0;
        this.dyn_ltree = new Uint16Array(HEAP_SIZE * 2);
        this.dyn_dtree = /* @__PURE__ */ new Uint16Array(122);
        this.bl_tree = /* @__PURE__ */ new Uint16Array(78);
        zero(this.dyn_ltree);
        zero(this.dyn_dtree);
        zero(this.bl_tree);
        this.l_desc = null;
        this.d_desc = null;
        this.bl_desc = null;
        this.bl_count = /* @__PURE__ */ new Uint16Array(16);
        this.heap = /* @__PURE__ */ new Uint16Array(573);
        zero(this.heap);
        this.heap_len = 0;
        this.heap_max = 0;
        this.depth = /* @__PURE__ */ new Uint16Array(573);
        zero(this.depth);
        this.sym_buf = 0;
        this.lit_bufsize = 0;
        this.sym_next = 0;
        this.sym_end = 0;
        this.opt_len = 0;
        this.static_len = 0;
        this.matches = 0;
        this.insert = 0;
        this.bi_buf = 0;
        this.bi_valid = 0;
      }
    };
    deflateStateCheck = (strm) => {
      if (!strm) return 1;
      const s = strm.state;
      if (!s || s.strm !== strm || s.status !== INIT_STATE && s.status !== GZIP_STATE && s.status !== EXTRA_STATE && s.status !== NAME_STATE && s.status !== COMMENT_STATE && s.status !== HCRC_STATE && s.status !== BUSY_STATE && s.status !== FINISH_STATE) return 1;
      return 0;
    };
    deflateResetKeep = (strm) => {
      if (deflateStateCheck(strm)) return err(strm, -2);
      strm.total_in = strm.total_out = 0;
      strm.data_type = 2;
      const s = strm.state;
      s.pending = 0;
      s.pending_out = 0;
      if (s.wrap < 0) s.wrap = -s.wrap;
      s.status = s.wrap === 2 ? GZIP_STATE : s.wrap ? INIT_STATE : BUSY_STATE;
      strm.adler = s.wrap === 2 ? 0 : 1;
      s.last_flush = -2;
      _tr_init(s);
      return 0;
    };
    deflateReset = (strm) => {
      const ret = deflateResetKeep(strm);
      if (ret === 0) lm_init(strm.state);
      return ret;
    };
    deflateInit2 = (strm, level, method, windowBits, memLevel, strategy, legacyHash) => {
      if (!strm) return -2;
      let wrap = 1;
      if (level === -1) level = 6;
      if (windowBits < 0) {
        wrap = 0;
        windowBits = -windowBits;
      } else if (windowBits > 15) {
        wrap = 2;
        windowBits -= 16;
      }
      if (memLevel < 1 || memLevel > MAX_MEM_LEVEL || method !== 8 || windowBits < 8 || windowBits > 15 || level < 0 || level > 9 || strategy < 0 || strategy > 4 || windowBits === 8 && wrap !== 1) return err(strm, -2);
      if (windowBits === 8) windowBits = 9;
      const s = new DeflateState();
      strm.state = s;
      s.strm = strm;
      s.status = INIT_STATE;
      s.wrap = wrap;
      s.gzhead = null;
      s.w_bits = windowBits;
      s.w_size = 1 << s.w_bits;
      s.w_mask = s.w_size - 1;
      s.legacy_hash = legacyHash ? 1 : 0;
      s.hash_bits = memLevel + 7;
      if (!s.legacy_hash && s.hash_bits < 15) s.hash_bits = 15;
      s.hash_size = 1 << s.hash_bits;
      s.hash_mask = s.hash_size - 1;
      s.hash_shift = ~~((s.hash_bits + MIN_MATCH - 1) / MIN_MATCH);
      s.window = new Uint8Array(s.w_size * 2);
      s.head = new Uint16Array(s.hash_size);
      s.prev = new Uint16Array(s.w_size);
      s.lit_bufsize = 1 << memLevel + 6;
      s.pending_buf_size = s.lit_bufsize * 4;
      s.pending_buf = new Uint8Array(s.pending_buf_size);
      s.sym_buf = s.lit_bufsize;
      s.sym_end = (s.lit_bufsize - 1) * 3;
      s.level = level;
      s.strategy = strategy;
      s.method = method;
      return deflateReset(strm);
    };
    deflate$1 = (strm, flush) => {
      if (deflateStateCheck(strm) || flush > 5 || flush < 0) return strm ? err(strm, -2) : -2;
      const s = strm.state;
      if (!strm.output || strm.avail_in !== 0 && !strm.input || s.status === FINISH_STATE && flush !== 4) return err(strm, strm.avail_out === 0 ? -5 : -2);
      const old_flush = s.last_flush;
      s.last_flush = flush;
      if (s.pending !== 0) {
        flush_pending(strm);
        if (strm.avail_out === 0) {
          s.last_flush = -1;
          return 0;
        }
      } else if (strm.avail_in === 0 && rank(flush) <= rank(old_flush) && flush !== 4) return err(strm, -5);
      if (s.status === FINISH_STATE && strm.avail_in !== 0) return err(strm, -5);
      if (s.status === INIT_STATE && s.wrap === 0) s.status = BUSY_STATE;
      if (s.status === INIT_STATE) {
        let header = 8 + (s.w_bits - 8 << 4) << 8;
        let level_flags = -1;
        if (s.strategy >= 2 || s.level < 2) level_flags = 0;
        else if (s.level < 6) level_flags = 1;
        else if (s.level === 6) level_flags = 2;
        else level_flags = 3;
        header |= level_flags << 6;
        if (s.strstart !== 0) header |= PRESET_DICT;
        header += 31 - header % 31;
        putShortMSB(s, header);
        if (s.strstart !== 0) {
          putShortMSB(s, strm.adler >>> 16);
          putShortMSB(s, strm.adler & 65535);
        }
        strm.adler = 1;
        s.status = BUSY_STATE;
        flush_pending(strm);
        if (s.pending !== 0) {
          s.last_flush = -1;
          return 0;
        }
      }
      if (s.status === GZIP_STATE) {
        strm.adler = 0;
        put_byte(s, 31);
        put_byte(s, 139);
        put_byte(s, 8);
        if (!s.gzhead) {
          put_byte(s, 0);
          put_byte(s, 0);
          put_byte(s, 0);
          put_byte(s, 0);
          put_byte(s, 0);
          put_byte(s, s.level === 9 ? 2 : s.strategy >= 2 || s.level < 2 ? 4 : 0);
          put_byte(s, OS_CODE);
          s.status = BUSY_STATE;
          flush_pending(strm);
          if (s.pending !== 0) {
            s.last_flush = -1;
            return 0;
          }
        } else {
          put_byte(s, (s.gzhead.text ? 1 : 0) + (s.gzhead.hcrc ? 2 : 0) + (!s.gzhead.extra ? 0 : 4) + (!s.gzhead.name ? 0 : 8) + (!s.gzhead.comment ? 0 : 16));
          put_byte(s, s.gzhead.time & 255);
          put_byte(s, s.gzhead.time >> 8 & 255);
          put_byte(s, s.gzhead.time >> 16 & 255);
          put_byte(s, s.gzhead.time >> 24 & 255);
          put_byte(s, s.level === 9 ? 2 : s.strategy >= 2 || s.level < 2 ? 4 : 0);
          put_byte(s, s.gzhead.os & 255);
          if (s.gzhead.extra && s.gzhead.extra.length) {
            put_byte(s, s.gzhead.extra.length & 255);
            put_byte(s, s.gzhead.extra.length >> 8 & 255);
          }
          if (s.gzhead.hcrc) strm.adler = crc32(strm.adler, s.pending_buf, s.pending, 0);
          s.gzindex = 0;
          s.status = EXTRA_STATE;
        }
      }
      if (s.status === EXTRA_STATE) {
        if (s.gzhead.extra) {
          let beg = s.pending;
          let left = (s.gzhead.extra.length & 65535) - s.gzindex;
          while (s.pending + left > s.pending_buf_size) {
            let copy = s.pending_buf_size - s.pending;
            s.pending_buf.set(s.gzhead.extra.subarray(s.gzindex, s.gzindex + copy), s.pending);
            s.pending = s.pending_buf_size;
            if (s.gzhead.hcrc && s.pending > beg) strm.adler = crc32(strm.adler, s.pending_buf, s.pending - beg, beg);
            s.gzindex += copy;
            flush_pending(strm);
            if (s.pending !== 0) {
              s.last_flush = -1;
              return 0;
            }
            beg = 0;
            left -= copy;
          }
          let gzhead_extra = new Uint8Array(s.gzhead.extra);
          s.pending_buf.set(gzhead_extra.subarray(s.gzindex, s.gzindex + left), s.pending);
          s.pending += left;
          if (s.gzhead.hcrc && s.pending > beg) strm.adler = crc32(strm.adler, s.pending_buf, s.pending - beg, beg);
          s.gzindex = 0;
        }
        s.status = NAME_STATE;
      }
      if (s.status === NAME_STATE) {
        if (s.gzhead.name) {
          let beg = s.pending;
          let val;
          do {
            if (s.pending === s.pending_buf_size) {
              if (s.gzhead.hcrc && s.pending > beg) strm.adler = crc32(strm.adler, s.pending_buf, s.pending - beg, beg);
              flush_pending(strm);
              if (s.pending !== 0) {
                s.last_flush = -1;
                return 0;
              }
              beg = 0;
            }
            if (s.gzindex < s.gzhead.name.length) val = s.gzhead.name.charCodeAt(s.gzindex++) & 255;
            else val = 0;
            put_byte(s, val);
          } while (val !== 0);
          if (s.gzhead.hcrc && s.pending > beg) strm.adler = crc32(strm.adler, s.pending_buf, s.pending - beg, beg);
          s.gzindex = 0;
        }
        s.status = COMMENT_STATE;
      }
      if (s.status === COMMENT_STATE) {
        if (s.gzhead.comment) {
          let beg = s.pending;
          let val;
          do {
            if (s.pending === s.pending_buf_size) {
              if (s.gzhead.hcrc && s.pending > beg) strm.adler = crc32(strm.adler, s.pending_buf, s.pending - beg, beg);
              flush_pending(strm);
              if (s.pending !== 0) {
                s.last_flush = -1;
                return 0;
              }
              beg = 0;
            }
            if (s.gzindex < s.gzhead.comment.length) val = s.gzhead.comment.charCodeAt(s.gzindex++) & 255;
            else val = 0;
            put_byte(s, val);
          } while (val !== 0);
          if (s.gzhead.hcrc && s.pending > beg) strm.adler = crc32(strm.adler, s.pending_buf, s.pending - beg, beg);
        }
        s.status = HCRC_STATE;
      }
      if (s.status === HCRC_STATE) {
        if (s.gzhead.hcrc) {
          if (s.pending + 2 > s.pending_buf_size) {
            flush_pending(strm);
            if (s.pending !== 0) {
              s.last_flush = -1;
              return 0;
            }
          }
          put_byte(s, strm.adler & 255);
          put_byte(s, strm.adler >> 8 & 255);
          strm.adler = 0;
        }
        s.status = BUSY_STATE;
        flush_pending(strm);
        if (s.pending !== 0) {
          s.last_flush = -1;
          return 0;
        }
      }
      if (strm.avail_in !== 0 || s.lookahead !== 0 || flush !== 0 && s.status !== FINISH_STATE) {
        let bstate = s.level === 0 ? deflate_stored(s, flush) : s.strategy === 2 ? deflate_huff(s, flush) : s.strategy === 3 ? deflate_rle(s, flush) : configuration_table[s.level].func(s, flush);
        if (bstate === BS_FINISH_STARTED || bstate === BS_FINISH_DONE) s.status = FINISH_STATE;
        if (bstate === BS_NEED_MORE || bstate === BS_FINISH_STARTED) {
          if (strm.avail_out === 0) s.last_flush = -1;
          return 0;
        }
        if (bstate === BS_BLOCK_DONE) {
          if (flush === 1) _tr_align(s);
          else if (flush !== 5) {
            _tr_stored_block(s, 0, 0, false);
            if (flush === 3) {
              zero(s.head);
              if (s.lookahead === 0) {
                s.strstart = 0;
                s.block_start = 0;
                s.insert = 0;
              }
            }
          }
          flush_pending(strm);
          if (strm.avail_out === 0) {
            s.last_flush = -1;
            return 0;
          }
        }
      }
      if (flush !== 4) return 0;
      if (s.wrap <= 0) return 1;
      if (s.wrap === 2) {
        put_byte(s, strm.adler & 255);
        put_byte(s, strm.adler >> 8 & 255);
        put_byte(s, strm.adler >> 16 & 255);
        put_byte(s, strm.adler >> 24 & 255);
        put_byte(s, strm.total_in & 255);
        put_byte(s, strm.total_in >> 8 & 255);
        put_byte(s, strm.total_in >> 16 & 255);
        put_byte(s, strm.total_in >> 24 & 255);
      } else {
        putShortMSB(s, strm.adler >>> 16);
        putShortMSB(s, strm.adler & 65535);
      }
      flush_pending(strm);
      if (s.wrap > 0) s.wrap = -s.wrap;
      return s.pending !== 0 ? 0 : 1;
    };
    deflateEnd = (strm) => {
      if (deflateStateCheck(strm)) return -2;
      const status = strm.state.status;
      strm.state = null;
      return status === BUSY_STATE ? err(strm, -3) : 0;
    };
    deflateSetDictionary = (strm, dictionary) => {
      let dictLength = dictionary.length;
      if (deflateStateCheck(strm)) return -2;
      const s = strm.state;
      const wrap = s.wrap;
      if (wrap === 2 || wrap === 1 && s.status !== INIT_STATE || s.lookahead) return -2;
      if (wrap === 1) strm.adler = adler32(strm.adler, dictionary, dictLength, 0);
      s.wrap = 0;
      if (dictLength >= s.w_size) {
        if (wrap === 0) {
          zero(s.head);
          s.strstart = 0;
          s.block_start = 0;
          s.insert = 0;
        }
        let tmpDict = new Uint8Array(s.w_size);
        tmpDict.set(dictionary.subarray(dictLength - s.w_size, dictLength), 0);
        dictionary = tmpDict;
        dictLength = s.w_size;
      }
      const avail = strm.avail_in;
      const next = strm.next_in;
      const input = strm.input;
      strm.avail_in = dictLength;
      strm.next_in = 0;
      strm.input = dictionary;
      fill_window(s);
      while (s.lookahead >= MIN_MATCH) {
        let str = s.strstart;
        let n = s.lookahead - (MIN_MATCH - 1);
        do {
          INSERT_STRING(s, str);
          str++;
        } while (--n);
        s.strstart = str;
        s.lookahead = MIN_MATCH - 1;
        fill_window(s);
      }
      s.strstart += s.lookahead;
      s.block_start = s.strstart;
      s.insert = s.lookahead;
      s.lookahead = 0;
      s.match_length = s.prev_length = MIN_MATCH - 1;
      s.match_available = 0;
      strm.next_in = next;
      strm.input = input;
      strm.avail_in = avail;
      s.wrap = wrap;
      return 0;
    };
    BAD$1 = 16209;
    TYPE$1 = 16191;
    MAXBITS = 15;
    ENOUGH_LENS$1 = 852;
    ENOUGH_DISTS$1 = 592;
    CODES$1 = 0;
    LENS$1 = 1;
    DISTS$1 = 2;
    lbase = new Uint16Array([
      3,
      4,
      5,
      6,
      7,
      8,
      9,
      10,
      11,
      13,
      15,
      17,
      19,
      23,
      27,
      31,
      35,
      43,
      51,
      59,
      67,
      83,
      99,
      115,
      131,
      163,
      195,
      227,
      258,
      0,
      0
    ]);
    lext = new Uint8Array([
      16,
      16,
      16,
      16,
      16,
      16,
      16,
      16,
      17,
      17,
      17,
      17,
      18,
      18,
      18,
      18,
      19,
      19,
      19,
      19,
      20,
      20,
      20,
      20,
      21,
      21,
      21,
      21,
      16,
      199,
      75
    ]);
    dbase = new Uint16Array([
      1,
      2,
      3,
      4,
      5,
      7,
      9,
      13,
      17,
      25,
      33,
      49,
      65,
      97,
      129,
      193,
      257,
      385,
      513,
      769,
      1025,
      1537,
      2049,
      3073,
      4097,
      6145,
      8193,
      12289,
      16385,
      24577,
      0,
      0
    ]);
    dext = new Uint8Array([
      16,
      16,
      16,
      16,
      17,
      17,
      18,
      18,
      19,
      19,
      20,
      20,
      21,
      21,
      22,
      22,
      23,
      23,
      24,
      24,
      25,
      25,
      26,
      26,
      27,
      27,
      28,
      28,
      29,
      29,
      64,
      64
    ]);
    inflate_table = (type, lens, lens_index, codes, table, table_index, work, opts) => {
      const bits = opts.bits;
      let len = 0;
      let sym = 0;
      let min = 0, max = 0;
      let root = 0;
      let curr = 0;
      let drop = 0;
      let left = 0;
      let used = 0;
      let huff = 0;
      let incr;
      let fill;
      let low;
      let mask;
      let next;
      let base = null;
      let match;
      const count = /* @__PURE__ */ new Uint16Array(16);
      const offs = /* @__PURE__ */ new Uint16Array(16);
      let extra = null;
      let here_bits, here_op, here_val;
      for (len = 0; len <= MAXBITS; len++) count[len] = 0;
      for (sym = 0; sym < codes; sym++) count[lens[lens_index + sym]]++;
      root = bits;
      for (max = MAXBITS; max >= 1; max--) if (count[max] !== 0) break;
      if (root > max) root = max;
      if (max === 0) {
        table[table_index++] = 20971520;
        table[table_index++] = 20971520;
        opts.bits = 1;
        return 0;
      }
      for (min = 1; min < max; min++) if (count[min] !== 0) break;
      if (root < min) root = min;
      left = 1;
      for (len = 1; len <= MAXBITS; len++) {
        left <<= 1;
        left -= count[len];
        if (left < 0) return -1;
      }
      if (left > 0 && (type === CODES$1 || max !== 1)) return -1;
      offs[1] = 0;
      for (len = 1; len < MAXBITS; len++) offs[len + 1] = offs[len] + count[len];
      for (sym = 0; sym < codes; sym++) if (lens[lens_index + sym] !== 0) work[offs[lens[lens_index + sym]]++] = sym;
      if (type === CODES$1) {
        base = extra = work;
        match = 20;
      } else if (type === LENS$1) {
        base = lbase;
        extra = lext;
        match = 257;
      } else {
        base = dbase;
        extra = dext;
        match = 0;
      }
      huff = 0;
      sym = 0;
      len = min;
      next = table_index;
      curr = root;
      drop = 0;
      low = -1;
      used = 1 << root;
      mask = used - 1;
      if (type === LENS$1 && used > ENOUGH_LENS$1 || type === DISTS$1 && used > ENOUGH_DISTS$1) return 1;
      for (; ; ) {
        here_bits = len - drop;
        if (work[sym] + 1 < match) {
          here_op = 0;
          here_val = work[sym];
        } else if (work[sym] >= match) {
          here_op = extra[work[sym] - match];
          here_val = base[work[sym] - match];
        } else {
          here_op = 96;
          here_val = 0;
        }
        incr = 1 << len - drop;
        fill = 1 << curr;
        min = fill;
        do {
          fill -= incr;
          table[next + (huff >> drop) + fill] = here_bits << 24 | here_op << 16 | here_val | 0;
        } while (fill !== 0);
        incr = 1 << len - 1;
        while (huff & incr) incr >>= 1;
        if (incr !== 0) {
          huff &= incr - 1;
          huff += incr;
        } else huff = 0;
        sym++;
        if (--count[len] === 0) {
          if (len === max) break;
          len = lens[lens_index + work[sym]];
        }
        if (len > root && (huff & mask) !== low) {
          if (drop === 0) drop = root;
          next += min;
          curr = len - drop;
          left = 1 << curr;
          while (curr + drop < max) {
            left -= count[curr + drop];
            if (left <= 0) break;
            curr++;
            left <<= 1;
          }
          used += 1 << curr;
          if (type === LENS$1 && used > ENOUGH_LENS$1 || type === DISTS$1 && used > ENOUGH_DISTS$1) return 1;
          low = huff & mask;
          table[low] = root << 24 | curr << 16 | next - table_index | 0;
        }
      }
      if (huff !== 0) table[next + huff] = len - drop << 24 | 4194304;
      opts.bits = root;
      return 0;
    };
    CODES = 0;
    LENS = 1;
    DISTS = 2;
    HEAD = 16180;
    FLAGS = 16181;
    TIME = 16182;
    OS = 16183;
    EXLEN = 16184;
    EXTRA = 16185;
    NAME = 16186;
    COMMENT = 16187;
    HCRC = 16188;
    DICTID = 16189;
    DICT = 16190;
    TYPE = 16191;
    TYPEDO = 16192;
    STORED = 16193;
    COPY_ = 16194;
    COPY = 16195;
    TABLE = 16196;
    LENLENS = 16197;
    CODELENS = 16198;
    LEN_ = 16199;
    LEN = 16200;
    LENEXT = 16201;
    DIST = 16202;
    DISTEXT = 16203;
    MATCH = 16204;
    LIT = 16205;
    CHECK = 16206;
    LENGTH = 16207;
    DONE = 16208;
    BAD = 16209;
    MEM = 16210;
    SYNC = 16211;
    ENOUGH_LENS = 852;
    ENOUGH_DISTS = 592;
    zswap32 = (q) => {
      return (q >>> 24 & 255) + (q >>> 8 & 65280) + ((q & 65280) << 8) + ((q & 255) << 24);
    };
    InflateState = class {
      constructor() {
        this.strm = null;
        this.mode = 0;
        this.last = false;
        this.wrap = 0;
        this.havedict = false;
        this.flags = 0;
        this.dmax = 0;
        this.check = 0;
        this.total = 0;
        this.head = null;
        this.wbits = 0;
        this.wsize = 0;
        this.whave = 0;
        this.wnext = 0;
        this.window = null;
        this.hold = 0;
        this.bits = 0;
        this.length = 0;
        this.offset = 0;
        this.extra = 0;
        this.lencode = null;
        this.distcode = null;
        this.lenbits = 0;
        this.distbits = 0;
        this.ncode = 0;
        this.nlen = 0;
        this.ndist = 0;
        this.have = 0;
        this.next = null;
        this.lens = /* @__PURE__ */ new Uint16Array(320);
        this.work = /* @__PURE__ */ new Uint16Array(288);
        this.lendyn = null;
        this.distdyn = null;
        this.sane = 0;
        this.back = 0;
        this.was = 0;
      }
    };
    inflateStateCheck = (strm) => {
      if (!strm) return 1;
      const state = strm.state;
      if (!state || state.strm !== strm || state.mode < HEAD || state.mode > SYNC) return 1;
      return 0;
    };
    inflateResetKeep = (strm) => {
      if (inflateStateCheck(strm)) return -2;
      const state = strm.state;
      strm.total_in = strm.total_out = state.total = 0;
      strm.msg = "";
      if (state.wrap) strm.adler = state.wrap & 1;
      state.mode = HEAD;
      state.last = 0;
      state.havedict = 0;
      state.flags = -1;
      state.dmax = 32768;
      state.head = null;
      state.hold = 0;
      state.bits = 0;
      state.lencode = state.lendyn = new Int32Array(ENOUGH_LENS);
      state.distcode = state.distdyn = new Int32Array(ENOUGH_DISTS);
      state.sane = 1;
      state.back = -1;
      return 0;
    };
    inflateReset = (strm) => {
      if (inflateStateCheck(strm)) return -2;
      const state = strm.state;
      state.wsize = 0;
      state.whave = 0;
      state.wnext = 0;
      return inflateResetKeep(strm);
    };
    inflateReset2 = (strm, windowBits) => {
      let wrap;
      if (inflateStateCheck(strm)) return -2;
      const state = strm.state;
      if (windowBits < 0) {
        wrap = 0;
        windowBits = -windowBits;
      } else {
        wrap = (windowBits >> 4) + 5;
        if (windowBits < 48) windowBits &= 15;
      }
      if (windowBits && (windowBits < 8 || windowBits > 15)) return -2;
      if (state.window !== null && state.wbits !== windowBits) state.window = null;
      state.wrap = wrap;
      state.wbits = windowBits;
      return inflateReset(strm);
    };
    inflateInit2 = (strm, windowBits) => {
      if (!strm) return -2;
      const state = new InflateState();
      strm.state = state;
      state.strm = strm;
      state.window = null;
      state.mode = HEAD;
      const ret = inflateReset2(strm, windowBits);
      if (ret !== 0) strm.state = null;
      return ret;
    };
    virgin = true;
    fixedtables = (state) => {
      if (virgin) {
        lenfix = /* @__PURE__ */ new Int32Array(512);
        distfix = /* @__PURE__ */ new Int32Array(32);
        let sym = 0;
        while (sym < 144) state.lens[sym++] = 8;
        while (sym < 256) state.lens[sym++] = 9;
        while (sym < 280) state.lens[sym++] = 7;
        while (sym < 288) state.lens[sym++] = 8;
        inflate_table(LENS, state.lens, 0, 288, lenfix, 0, state.work, { bits: 9 });
        sym = 0;
        while (sym < 32) state.lens[sym++] = 5;
        inflate_table(DISTS, state.lens, 0, 32, distfix, 0, state.work, { bits: 5 });
        virgin = false;
      }
      state.lencode = lenfix;
      state.lenbits = 9;
      state.distcode = distfix;
      state.distbits = 5;
    };
    updatewindow = (strm, src, end, copy) => {
      let dist;
      const state = strm.state;
      if (state.window === null) state.window = new Uint8Array(1 << state.wbits);
      if (state.wsize === 0) {
        state.wsize = 1 << state.wbits;
        state.wnext = 0;
        state.whave = 0;
      }
      if (copy >= state.wsize) {
        state.window.set(src.subarray(end - state.wsize, end), 0);
        state.wnext = 0;
        state.whave = state.wsize;
      } else {
        dist = state.wsize - state.wnext;
        if (dist > copy) dist = copy;
        state.window.set(src.subarray(end - copy, end - copy + dist), state.wnext);
        copy -= dist;
        if (copy) {
          state.window.set(src.subarray(end - copy, end), 0);
          state.wnext = copy;
          state.whave = state.wsize;
        } else {
          state.wnext += dist;
          if (state.wnext === state.wsize) state.wnext = 0;
          if (state.whave < state.wsize) state.whave += dist;
        }
      }
      return 0;
    };
    inflate$1 = (strm, flush) => {
      let state;
      let input, output;
      let next;
      let put;
      let have, left;
      let hold;
      let bits;
      let _in, _out;
      let copy;
      let from;
      let from_source;
      let here = 0;
      let here_bits, here_op, here_val;
      let last_bits, last_op, last_val;
      let len;
      let ret;
      const hbuf = /* @__PURE__ */ new Uint8Array(4);
      let opts;
      let n;
      const order = new Uint8Array([
        16,
        17,
        18,
        0,
        8,
        7,
        9,
        6,
        10,
        5,
        11,
        4,
        12,
        3,
        13,
        2,
        14,
        1,
        15
      ]);
      if (inflateStateCheck(strm) || !strm.output || !strm.input && strm.avail_in !== 0) return -2;
      state = strm.state;
      if (state.mode === TYPE) state.mode = TYPEDO;
      put = strm.next_out;
      output = strm.output;
      left = strm.avail_out;
      next = strm.next_in;
      input = strm.input;
      have = strm.avail_in;
      hold = state.hold;
      bits = state.bits;
      _in = have;
      _out = left;
      ret = 0;
      inf_leave: for (; ; ) switch (state.mode) {
        case HEAD:
          if (state.wrap === 0) {
            state.mode = TYPEDO;
            break;
          }
          while (bits < 16) {
            if (have === 0) break inf_leave;
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          if (state.wrap & 2 && hold === 35615) {
            if (state.wbits === 0) state.wbits = 15;
            state.check = 0;
            hbuf[0] = hold & 255;
            hbuf[1] = hold >>> 8 & 255;
            state.check = crc32(state.check, hbuf, 2, 0);
            hold = 0;
            bits = 0;
            state.mode = FLAGS;
            break;
          }
          if (state.head) state.head.done = false;
          if (!(state.wrap & 1) || (((hold & 255) << 8) + (hold >> 8)) % 31) {
            strm.msg = "incorrect header check";
            state.mode = BAD;
            break;
          }
          if ((hold & 15) !== 8) {
            strm.msg = "unknown compression method";
            state.mode = BAD;
            break;
          }
          hold >>>= 4;
          bits -= 4;
          len = (hold & 15) + 8;
          if (state.wbits === 0) state.wbits = len;
          if (len > 15 || len > state.wbits) {
            strm.msg = "invalid window size";
            state.mode = BAD;
            break;
          }
          state.dmax = 1 << state.wbits;
          state.flags = 0;
          strm.adler = state.check = 1;
          state.mode = hold & 512 ? DICTID : TYPE;
          hold = 0;
          bits = 0;
          break;
        case FLAGS:
          while (bits < 16) {
            if (have === 0) break inf_leave;
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          state.flags = hold;
          if ((state.flags & 255) !== 8) {
            strm.msg = "unknown compression method";
            state.mode = BAD;
            break;
          }
          if (state.flags & 57344) {
            strm.msg = "unknown header flags set";
            state.mode = BAD;
            break;
          }
          if (state.head) state.head.text = hold >> 8 & 1;
          if (state.flags & 512 && state.wrap & 4) {
            hbuf[0] = hold & 255;
            hbuf[1] = hold >>> 8 & 255;
            state.check = crc32(state.check, hbuf, 2, 0);
          }
          hold = 0;
          bits = 0;
          state.mode = TIME;
        case TIME:
          while (bits < 32) {
            if (have === 0) break inf_leave;
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          if (state.head) state.head.time = hold >>> 0;
          if (state.flags & 512 && state.wrap & 4) {
            hbuf[0] = hold & 255;
            hbuf[1] = hold >>> 8 & 255;
            hbuf[2] = hold >>> 16 & 255;
            hbuf[3] = hold >>> 24 & 255;
            state.check = crc32(state.check, hbuf, 4, 0);
          }
          hold = 0;
          bits = 0;
          state.mode = OS;
        case OS:
          while (bits < 16) {
            if (have === 0) break inf_leave;
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          if (state.head) {
            state.head.xflags = hold & 255;
            state.head.os = hold >> 8;
          }
          if (state.flags & 512 && state.wrap & 4) {
            hbuf[0] = hold & 255;
            hbuf[1] = hold >>> 8 & 255;
            state.check = crc32(state.check, hbuf, 2, 0);
          }
          hold = 0;
          bits = 0;
          state.mode = EXLEN;
        case EXLEN:
          if (state.flags & 1024) {
            while (bits < 16) {
              if (have === 0) break inf_leave;
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            state.length = hold;
            if (state.head) state.head.extra_len = hold;
            if (state.flags & 512 && state.wrap & 4) {
              hbuf[0] = hold & 255;
              hbuf[1] = hold >>> 8 & 255;
              state.check = crc32(state.check, hbuf, 2, 0);
            }
            hold = 0;
            bits = 0;
          } else if (state.head) state.head.extra = null;
          state.mode = EXTRA;
        case EXTRA:
          if (state.flags & 1024) {
            copy = state.length;
            if (copy > have) copy = have;
            if (copy) {
              if (state.head) {
                len = state.head.extra_len - state.length;
                if (!state.head.extra) state.head.extra = new Uint8Array(state.head.extra_len);
                state.head.extra.set(input.subarray(next, next + copy), len);
              }
              if (state.flags & 512 && state.wrap & 4) state.check = crc32(state.check, input, copy, next);
              have -= copy;
              next += copy;
              state.length -= copy;
            }
            if (state.length) break inf_leave;
          }
          state.length = 0;
          state.mode = NAME;
        case NAME:
          if (state.flags & 2048) {
            if (have === 0) break inf_leave;
            copy = 0;
            do {
              len = input[next + copy++];
              if (state.head && len && state.length < 65536) state.head.name += String.fromCharCode(len);
            } while (len && copy < have);
            if (state.flags & 512 && state.wrap & 4) state.check = crc32(state.check, input, copy, next);
            have -= copy;
            next += copy;
            if (len) break inf_leave;
          } else if (state.head) state.head.name = null;
          state.length = 0;
          state.mode = COMMENT;
        case COMMENT:
          if (state.flags & 4096) {
            if (have === 0) break inf_leave;
            copy = 0;
            do {
              len = input[next + copy++];
              if (state.head && len && state.length < 65536) state.head.comment += String.fromCharCode(len);
            } while (len && copy < have);
            if (state.flags & 512 && state.wrap & 4) state.check = crc32(state.check, input, copy, next);
            have -= copy;
            next += copy;
            if (len) break inf_leave;
          } else if (state.head) state.head.comment = null;
          state.mode = HCRC;
        case HCRC:
          if (state.flags & 512) {
            while (bits < 16) {
              if (have === 0) break inf_leave;
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            if (state.wrap & 4 && hold !== (state.check & 65535)) {
              strm.msg = "header crc mismatch";
              state.mode = BAD;
              break;
            }
            hold = 0;
            bits = 0;
          }
          if (state.head) {
            state.head.hcrc = state.flags >> 9 & 1;
            state.head.done = true;
          }
          strm.adler = state.check = 0;
          state.mode = TYPE;
          break;
        case DICTID:
          while (bits < 32) {
            if (have === 0) break inf_leave;
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          strm.adler = state.check = zswap32(hold);
          hold = 0;
          bits = 0;
          state.mode = DICT;
        case DICT:
          if (state.havedict === 0) {
            strm.next_out = put;
            strm.avail_out = left;
            strm.next_in = next;
            strm.avail_in = have;
            state.hold = hold;
            state.bits = bits;
            return 2;
          }
          strm.adler = state.check = 1;
          state.mode = TYPE;
        case TYPE:
          if (flush === 5 || flush === 6) break inf_leave;
        case TYPEDO:
          if (state.last) {
            hold >>>= bits & 7;
            bits -= bits & 7;
            state.mode = CHECK;
            break;
          }
          while (bits < 3) {
            if (have === 0) break inf_leave;
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          state.last = hold & 1;
          hold >>>= 1;
          bits -= 1;
          switch (hold & 3) {
            case 0:
              state.mode = STORED;
              break;
            case 1:
              fixedtables(state);
              state.mode = LEN_;
              if (flush === 6) {
                hold >>>= 2;
                bits -= 2;
                break inf_leave;
              }
              break;
            case 2:
              state.mode = TABLE;
              break;
            case 3:
              strm.msg = "invalid block type";
              state.mode = BAD;
          }
          hold >>>= 2;
          bits -= 2;
          break;
        case STORED:
          hold >>>= bits & 7;
          bits -= bits & 7;
          while (bits < 32) {
            if (have === 0) break inf_leave;
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          if ((hold & 65535) !== (hold >>> 16 ^ 65535)) {
            strm.msg = "invalid stored block lengths";
            state.mode = BAD;
            break;
          }
          state.length = hold & 65535;
          hold = 0;
          bits = 0;
          state.mode = COPY_;
          if (flush === 6) break inf_leave;
        case COPY_:
          state.mode = COPY;
        case COPY:
          copy = state.length;
          if (copy) {
            if (copy > have) copy = have;
            if (copy > left) copy = left;
            if (copy === 0) break inf_leave;
            output.set(input.subarray(next, next + copy), put);
            have -= copy;
            next += copy;
            left -= copy;
            put += copy;
            state.length -= copy;
            break;
          }
          state.mode = TYPE;
          break;
        case TABLE:
          while (bits < 14) {
            if (have === 0) break inf_leave;
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          state.nlen = (hold & 31) + 257;
          hold >>>= 5;
          bits -= 5;
          state.ndist = (hold & 31) + 1;
          hold >>>= 5;
          bits -= 5;
          state.ncode = (hold & 15) + 4;
          hold >>>= 4;
          bits -= 4;
          if (state.nlen > 286 || state.ndist > 30) {
            strm.msg = "too many length or distance symbols";
            state.mode = BAD;
            break;
          }
          state.have = 0;
          state.mode = LENLENS;
        case LENLENS:
          while (state.have < state.ncode) {
            while (bits < 3) {
              if (have === 0) break inf_leave;
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            state.lens[order[state.have++]] = hold & 7;
            hold >>>= 3;
            bits -= 3;
          }
          while (state.have < 19) state.lens[order[state.have++]] = 0;
          state.lencode = state.lendyn;
          state.lenbits = 7;
          opts = { bits: state.lenbits };
          ret = inflate_table(CODES, state.lens, 0, 19, state.lencode, 0, state.work, opts);
          state.lenbits = opts.bits;
          if (ret) {
            strm.msg = "invalid code lengths set";
            state.mode = BAD;
            break;
          }
          state.have = 0;
          state.mode = CODELENS;
        case CODELENS:
          while (state.have < state.nlen + state.ndist) {
            for (; ; ) {
              here = state.lencode[hold & (1 << state.lenbits) - 1];
              here_bits = here >>> 24;
              here_op = here >>> 16 & 255;
              here_val = here & 65535;
              if (here_bits <= bits) break;
              if (have === 0) break inf_leave;
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            if (here_val < 16) {
              hold >>>= here_bits;
              bits -= here_bits;
              state.lens[state.have++] = here_val;
            } else {
              if (here_val === 16) {
                n = here_bits + 2;
                while (bits < n) {
                  if (have === 0) break inf_leave;
                  have--;
                  hold += input[next++] << bits;
                  bits += 8;
                }
                hold >>>= here_bits;
                bits -= here_bits;
                if (state.have === 0) {
                  strm.msg = "invalid bit length repeat";
                  state.mode = BAD;
                  break;
                }
                len = state.lens[state.have - 1];
                copy = 3 + (hold & 3);
                hold >>>= 2;
                bits -= 2;
              } else if (here_val === 17) {
                n = here_bits + 3;
                while (bits < n) {
                  if (have === 0) break inf_leave;
                  have--;
                  hold += input[next++] << bits;
                  bits += 8;
                }
                hold >>>= here_bits;
                bits -= here_bits;
                len = 0;
                copy = 3 + (hold & 7);
                hold >>>= 3;
                bits -= 3;
              } else {
                n = here_bits + 7;
                while (bits < n) {
                  if (have === 0) break inf_leave;
                  have--;
                  hold += input[next++] << bits;
                  bits += 8;
                }
                hold >>>= here_bits;
                bits -= here_bits;
                len = 0;
                copy = 11 + (hold & 127);
                hold >>>= 7;
                bits -= 7;
              }
              if (state.have + copy > state.nlen + state.ndist) {
                strm.msg = "invalid bit length repeat";
                state.mode = BAD;
                break;
              }
              while (copy--) state.lens[state.have++] = len;
            }
          }
          if (state.mode === BAD) break;
          if (state.lens[256] === 0) {
            strm.msg = "invalid code -- missing end-of-block";
            state.mode = BAD;
            break;
          }
          state.lenbits = 9;
          opts = { bits: state.lenbits };
          ret = inflate_table(LENS, state.lens, 0, state.nlen, state.lencode, 0, state.work, opts);
          state.lenbits = opts.bits;
          if (ret) {
            strm.msg = "invalid literal/lengths set";
            state.mode = BAD;
            break;
          }
          state.distbits = 6;
          state.distcode = state.distdyn;
          opts = { bits: state.distbits };
          ret = inflate_table(DISTS, state.lens, state.nlen, state.ndist, state.distcode, 0, state.work, opts);
          state.distbits = opts.bits;
          if (ret) {
            strm.msg = "invalid distances set";
            state.mode = BAD;
            break;
          }
          state.mode = LEN_;
          if (flush === 6) break inf_leave;
        case LEN_:
          state.mode = LEN;
        case LEN:
          if (have >= 6 && left >= 258) {
            strm.next_out = put;
            strm.avail_out = left;
            strm.next_in = next;
            strm.avail_in = have;
            state.hold = hold;
            state.bits = bits;
            inflate_fast(strm, _out);
            put = strm.next_out;
            output = strm.output;
            left = strm.avail_out;
            next = strm.next_in;
            input = strm.input;
            have = strm.avail_in;
            hold = state.hold;
            bits = state.bits;
            if (state.mode === TYPE) state.back = -1;
            break;
          }
          state.back = 0;
          for (; ; ) {
            here = state.lencode[hold & (1 << state.lenbits) - 1];
            here_bits = here >>> 24;
            here_op = here >>> 16 & 255;
            here_val = here & 65535;
            if (here_bits <= bits) break;
            if (have === 0) break inf_leave;
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          if (here_op && (here_op & 240) === 0) {
            last_bits = here_bits;
            last_op = here_op;
            last_val = here_val;
            for (; ; ) {
              here = state.lencode[last_val + ((hold & (1 << last_bits + last_op) - 1) >> last_bits)];
              here_bits = here >>> 24;
              here_op = here >>> 16 & 255;
              here_val = here & 65535;
              if (last_bits + here_bits <= bits) break;
              if (have === 0) break inf_leave;
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            hold >>>= last_bits;
            bits -= last_bits;
            state.back += last_bits;
          }
          hold >>>= here_bits;
          bits -= here_bits;
          state.back += here_bits;
          state.length = here_val;
          if (here_op === 0) {
            state.mode = LIT;
            break;
          }
          if (here_op & 32) {
            state.back = -1;
            state.mode = TYPE;
            break;
          }
          if (here_op & 64) {
            strm.msg = "invalid literal/length code";
            state.mode = BAD;
            break;
          }
          state.extra = here_op & 15;
          state.mode = LENEXT;
        case LENEXT:
          if (state.extra) {
            n = state.extra;
            while (bits < n) {
              if (have === 0) break inf_leave;
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            state.length += hold & (1 << state.extra) - 1;
            hold >>>= state.extra;
            bits -= state.extra;
            state.back += state.extra;
          }
          state.was = state.length;
          state.mode = DIST;
        case DIST:
          for (; ; ) {
            here = state.distcode[hold & (1 << state.distbits) - 1];
            here_bits = here >>> 24;
            here_op = here >>> 16 & 255;
            here_val = here & 65535;
            if (here_bits <= bits) break;
            if (have === 0) break inf_leave;
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          if ((here_op & 240) === 0) {
            last_bits = here_bits;
            last_op = here_op;
            last_val = here_val;
            for (; ; ) {
              here = state.distcode[last_val + ((hold & (1 << last_bits + last_op) - 1) >> last_bits)];
              here_bits = here >>> 24;
              here_op = here >>> 16 & 255;
              here_val = here & 65535;
              if (last_bits + here_bits <= bits) break;
              if (have === 0) break inf_leave;
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            hold >>>= last_bits;
            bits -= last_bits;
            state.back += last_bits;
          }
          hold >>>= here_bits;
          bits -= here_bits;
          state.back += here_bits;
          if (here_op & 64) {
            strm.msg = "invalid distance code";
            state.mode = BAD;
            break;
          }
          state.offset = here_val;
          state.extra = here_op & 15;
          state.mode = DISTEXT;
        case DISTEXT:
          if (state.extra) {
            n = state.extra;
            while (bits < n) {
              if (have === 0) break inf_leave;
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            state.offset += hold & (1 << state.extra) - 1;
            hold >>>= state.extra;
            bits -= state.extra;
            state.back += state.extra;
          }
          if (state.offset > state.dmax) {
            strm.msg = "invalid distance too far back";
            state.mode = BAD;
            break;
          }
          state.mode = MATCH;
        case MATCH:
          if (left === 0) break inf_leave;
          copy = _out - left;
          if (state.offset > copy) {
            copy = state.offset - copy;
            if (copy > state.whave) {
              if (state.sane) {
                strm.msg = "invalid distance too far back";
                state.mode = BAD;
                break;
              }
            }
            if (copy > state.wnext) {
              copy -= state.wnext;
              from = state.wsize - copy;
            } else from = state.wnext - copy;
            if (copy > state.length) copy = state.length;
            from_source = state.window;
          } else {
            from_source = output;
            from = put - state.offset;
            copy = state.length;
          }
          if (copy > left) copy = left;
          left -= copy;
          state.length -= copy;
          do
            output[put++] = from_source[from++];
          while (--copy);
          if (state.length === 0) state.mode = LEN;
          break;
        case LIT:
          if (left === 0) break inf_leave;
          output[put++] = state.length;
          left--;
          state.mode = LEN;
          break;
        case CHECK:
          if (state.wrap) {
            while (bits < 32) {
              if (have === 0) break inf_leave;
              have--;
              hold |= input[next++] << bits;
              bits += 8;
            }
            _out -= left;
            strm.total_out += _out;
            state.total += _out;
            if (state.wrap & 4 && _out) strm.adler = state.check = state.flags ? crc32(state.check, output, _out, put - _out) : adler32(state.check, output, _out, put - _out);
            _out = left;
            if (state.wrap & 4 && (state.flags ? hold : zswap32(hold)) !== state.check) {
              strm.msg = "incorrect data check";
              state.mode = BAD;
              break;
            }
            hold = 0;
            bits = 0;
          }
          state.mode = LENGTH;
        case LENGTH:
          if (state.wrap && state.flags) {
            while (bits < 32) {
              if (have === 0) break inf_leave;
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            if (state.wrap & 4 && hold !== (state.total & 4294967295)) {
              strm.msg = "incorrect length check";
              state.mode = BAD;
              break;
            }
            hold = 0;
            bits = 0;
          }
          state.mode = DONE;
        case DONE:
          ret = 1;
          break inf_leave;
        case BAD:
          ret = -3;
          break inf_leave;
        case MEM:
          return -4;
        case SYNC:
        default:
          return -2;
      }
      strm.next_out = put;
      strm.avail_out = left;
      strm.next_in = next;
      strm.avail_in = have;
      state.hold = hold;
      state.bits = bits;
      if (state.wsize || _out !== strm.avail_out && state.mode < BAD && (state.mode < CHECK || flush !== 4)) {
        if (updatewindow(strm, strm.output, strm.next_out, _out - strm.avail_out)) {
          state.mode = MEM;
          return -4;
        }
      }
      _in -= strm.avail_in;
      _out -= strm.avail_out;
      strm.total_in += _in;
      strm.total_out += _out;
      state.total += _out;
      if (state.wrap & 4 && _out) strm.adler = state.check = state.flags ? crc32(state.check, output, _out, strm.next_out - _out) : adler32(state.check, output, _out, strm.next_out - _out);
      strm.data_type = state.bits + (state.last ? 64 : 0) + (state.mode === TYPE ? 128 : 0) + (state.mode === LEN_ || state.mode === COPY_ ? 256 : 0);
      if ((_in === 0 && _out === 0 || flush === 4) && ret === 0) ret = -5;
      return ret;
    };
    inflateEnd = (strm) => {
      if (inflateStateCheck(strm)) return -2;
      let state = strm.state;
      if (state.window) state.window = null;
      strm.state = null;
      return 0;
    };
    inflateSetDictionary = (strm, dictionary) => {
      const dictLength = dictionary.length;
      let state;
      let dictid;
      let ret;
      if (inflateStateCheck(strm)) return -2;
      state = strm.state;
      if (state.wrap !== 0 && state.mode !== DICT) return -2;
      if (state.mode === DICT) {
        dictid = 1;
        dictid = adler32(dictid, dictionary, dictLength, 0);
        if (dictid !== state.check) return -3;
      }
      ret = updatewindow(strm, dictionary, dictLength, dictLength);
      if (ret) {
        state.mode = MEM;
        return -4;
      }
      state.havedict = 1;
      return 0;
    };
    ZStream = class {
      constructor() {
        this.input = null;
        this.next_in = 0;
        this.avail_in = 0;
        this.total_in = 0;
        this.output = null;
        this.next_out = 0;
        this.avail_out = 0;
        this.total_out = 0;
        this.msg = "";
        this.state = null;
        this.data_type = 2;
        this.adler = 0;
      }
    };
    flattenChunks = (chunks) => {
      const result = new Uint8Array(chunks.reduce((len, chunk) => len + chunk.length, 0));
      let pos = 0;
      for (const chunk of chunks) {
        result.set(chunk, pos);
        pos += chunk.length;
      }
      return result;
    };
    toString$1 = Object.prototype.toString;
    defaultOptions$1 = {
      level: -1,
      chunkSize: 16384,
      windowBits: 15,
      memLevel: 8,
      strategy: 0,
      raw: false,
      gzip: false,
      legacyHash: false,
      dictionary: /* @__PURE__ */ new Uint8Array(0)
    };
    Deflate = class {
      options;
      /**
      * Error code after deflate finishes. {@link Z_OK} on success.
      * You will not need it in real life, because deflate errors
      * are possible only on wrong options or bad custom `onData` / `onEnd`
      * handlers.
      */
      err;
      /** Error message, if {@link Deflate.err} is not {@link Z_OK}. */
      msg;
      ended;
      started;
      /**
      * Chunks of output data, if {@link Deflate.onData} not overridden.
      * @internal
      */
      chunks;
      strm;
      /**
      * Compressed result, generated by default {@link Deflate.onData}
      * and {@link Deflate.onEnd} handlers. Filled after you push last chunk
      * (call {@link Deflate.push} with {@link Z_FINISH} / `true` param).
      */
      result;
      /**
      * Creates a new deflator instance with the specified params. Throws an
      * exception on bad params. See {@link DeflateOptions} for the list of
      * supported options.
      *
      * @example
      * ```javascript
      * import { Deflate } from 'pako'
      *
      * const chunk1 = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9])
      * const chunk2 = new Uint8Array([10, 11, 12, 13, 14, 15, 16, 17, 18, 19])
      *
      * const deflate = new Deflate({ level: 3 })
      *
      * deflate.push(chunk1, false)
      * deflate.push(chunk2, true)  // true -> last chunk
      *
      * if (deflate.err) throw new Error(deflate.err)
      *
      * console.log(deflate.result)
      * ```
      */
      constructor(options = {}) {
        this.options = Object.assign({}, defaultOptions$1, options);
        const opt = this.options;
        if (opt.raw && opt.windowBits > 0) opt.windowBits = -opt.windowBits;
        else if (opt.gzip && opt.windowBits > 0 && opt.windowBits < 16) opt.windowBits += 16;
        this.err = 0;
        this.msg = "";
        this.ended = false;
        this.started = false;
        this.chunks = [];
        this.result = /* @__PURE__ */ new Uint8Array(0);
        this.strm = new ZStream();
        this.strm.avail_out = 0;
        let status = deflateInit2(this.strm, opt.level, 8, opt.windowBits, opt.memLevel, opt.strategy, opt.legacyHash);
        if (status !== 0) throw new Error(messages_default[status]);
        if (toString$1.call(opt.dictionary) === "[object ArrayBuffer]") opt.dictionary = new Uint8Array(opt.dictionary);
        const dictionary = opt.dictionary;
        if (dictionary.length) {
          if (opt.gzip) throw new Error("dictionary is not supported with gzip");
          status = deflateSetDictionary(this.strm, dictionary);
          if (status !== 0) throw new Error(messages_default[status]);
        }
      }
      /**
      * Sends input data to the deflate pipe, generating {@link Deflate.onData} calls
      * with new compressed chunks. Returns `true` on success. The last data block must
      * have `flush_mode` {@link Z_FINISH} (or `true`). That will flush the internal
      * pending buffers and call {@link Deflate.onEnd}.
      *
      * On failure, calls {@link Deflate.onEnd} with the error code and returns false.
      *
      * @param data input data. Strings will be converted to utf8 byte sequence.
      * @param flush_mode 0..6 for corresponding {@link Z_NO_FLUSH}..{@link Z_TREES} modes.
      *   See constants. Skipped or `false` means {@link Z_NO_FLUSH}, `true` means {@link Z_FINISH}.
      *
      * @example
      * ```javascript
      * push(chunk, false) // push one of data chunks
      * ...
      * push(chunk, true)  // push last chunk
      * ```
      */
      push(data, flush_mode = false) {
        const strm = this.strm;
        const chunkSize = this.options.chunkSize;
        let status;
        let _flush_mode;
        if (this.ended) return false;
        if (typeof flush_mode === "number") _flush_mode = flush_mode;
        else _flush_mode = flush_mode === true ? 4 : 0;
        if (typeof data === "string") strm.input = new TextEncoder().encode(data);
        else if (toString$1.call(data) === "[object ArrayBuffer]") strm.input = new Uint8Array(data);
        else strm.input = data;
        strm.next_in = 0;
        strm.avail_in = strm.input.length;
        if (!this.started) {
          this.started = true;
          this.onStart(strm);
        }
        for (; ; ) {
          if (strm.avail_out === 0) {
            strm.output = new Uint8Array(chunkSize);
            strm.next_out = 0;
            strm.avail_out = chunkSize;
          }
          if ((_flush_mode === 2 || _flush_mode === 3) && strm.avail_out <= 6) {
            this.onData(strm.output.subarray(0, strm.next_out));
            strm.avail_out = 0;
            continue;
          }
          status = deflate$1(strm, _flush_mode);
          if (status === -2) break;
          if (status === 1) {
            if (strm.next_out > 0) this.onData(strm.output.subarray(0, strm.next_out));
            status = deflateEnd(this.strm);
            break;
          }
          if (strm.avail_out === 0) {
            this.onData(strm.output);
            continue;
          }
          if (_flush_mode > 0 && strm.next_out > 0) {
            this.onData(strm.output.subarray(0, strm.next_out));
            strm.avail_out = 0;
            continue;
          }
          if (strm.avail_in === 0) return true;
        }
        this.err = status;
        this.msg = strm.msg || messages_default[status];
        this.ended = true;
        this.onEnd(status);
        return status === 0;
      }
      /**
      * Called once before the first low-level deflate call.
      */
      onStart(strm) {
      }
      /**
      * By default, stores data blocks in the {@link Deflate.chunks} property and glues
      * them in {@link Deflate.onEnd}. Override this handler if you need another behaviour.
      */
      onData(chunk) {
        this.chunks.push(chunk);
      }
      /**
      * Called once after you tell deflate that the input stream is
      * complete ({@link Z_FINISH}). By default, joins the collected {@link Deflate.chunks}
      * into the {@link Deflate.result} property.
      *
      * @param status deflate status. {@link Z_OK} on success, other if not.
      */
      onEnd(status) {
        if (status === 0) this.result = flattenChunks(this.chunks);
        this.chunks = [];
      }
    };
    toString = Object.prototype.toString;
    defaultOptions = {
      chunkSize: 1024 * 64,
      windowBits: 15,
      raw: false,
      dictionary: /* @__PURE__ */ new Uint8Array(0)
    };
    Inflate = class {
      options;
      /**
      * Error code after inflate finishes. {@link Z_OK} on success.
      * Should be checked when broken data is possible.
      */
      err;
      /** Error message, if {@link Inflate.err} is not {@link Z_OK}. */
      msg;
      /**
      * `true` once the compressed stream has ended. A stream may end before the
      * caller's data does (trailing bytes), so check this to know when to stop
      * pushing - further {@link Inflate.push} calls are no-ops.
      */
      ended;
      started;
      /**
      * Chunks of output data, if {@link Inflate.onData} not overridden.
      * @internal
      */
      chunks;
      strm;
      /**
      * Uncompressed result, generated by default {@link Inflate.onData}
      * and {@link Inflate.onEnd} handlers. Filled after you push last chunk
      * (call {@link Inflate.push} with {@link Z_FINISH} / `true` param).
      */
      result;
      /**
      * Creates a new inflator instance with the specified params. Throws an
      * exception on bad params. See {@link InflateOptions} for the list of
      * supported options.
      *
      * By default, when no options are set, the deflate/gzip data format is
      * autodetected via the wrapper header.
      *
      * @example
      * ```javascript
      * import { Inflate } from 'pako'
      *
      * const chunk1 = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9])
      * const chunk2 = new Uint8Array([10, 11, 12, 13, 14, 15, 16, 17, 18, 19])
      *
      * const inflate = new Inflate({ level: 3 })
      *
      * inflate.push(chunk1, false)
      * inflate.push(chunk2, true)  // true -> last chunk
      *
      * if (inflate.err) throw new Error(inflate.err)
      *
      * console.log(inflate.result)
      * ```
      */
      constructor(options = {}) {
        this.options = Object.assign({}, defaultOptions, options);
        const opt = this.options;
        if (opt.raw && opt.windowBits >= 0 && opt.windowBits < 16) {
          opt.windowBits = -opt.windowBits;
          if (opt.windowBits === 0) opt.windowBits = -15;
        }
        if (opt.windowBits >= 0 && opt.windowBits < 16 && !options.windowBits) opt.windowBits += 32;
        if (opt.windowBits > 15 && opt.windowBits < 48) {
          if ((opt.windowBits & 15) === 0) opt.windowBits |= 15;
        }
        this.err = 0;
        this.msg = "";
        this.ended = false;
        this.started = false;
        this.chunks = [];
        this.result = /* @__PURE__ */ new Uint8Array(0);
        this.strm = new ZStream();
        this.strm.avail_out = 0;
        let status = inflateInit2(this.strm, opt.windowBits);
        if (status !== 0) throw new Error(messages_default[status]);
        if (toString.call(opt.dictionary) === "[object ArrayBuffer]") opt.dictionary = new Uint8Array(opt.dictionary);
        const dictionary = opt.dictionary;
        if (opt.raw && dictionary.length) {
          status = inflateSetDictionary(this.strm, dictionary);
          if (status !== 0) throw new Error(messages_default[status]);
        }
      }
      /**
      * Sends input data to the inflate pipe, generating {@link Inflate.onData} calls
      * with new output chunks. Returns `true` on success. If end of stream is
      * detected, {@link Inflate.onEnd} will be called.
      *
      * `flush_mode` is not needed for normal operation, because end of stream
      * is detected automatically. Pass {@link Z_SYNC_FLUSH} to force the decoder
      * to emit all currently available output — handy when you need to decode
      * data frame-by-frame from a long-running stream.
      *
      * On failure, calls {@link Inflate.onEnd} with the error code and returns false.
      *
      * Once the stream has ended (a compressed stream may end before your data
      * does), further `push` calls are no-ops and return whether the decode
      * finished successfully. The final outcome is in {@link Inflate.result},
      * {@link Inflate.err} and {@link Inflate.msg}.
      *
      * @param flush_mode 0..6 for corresponding {@link Z_NO_FLUSH}..{@link Z_TREES}
      *   flush modes. See constants. Skipped or `false` means {@link Z_NO_FLUSH},
      *   `true` means {@link Z_FINISH}.
      *
      * @example
      * ```javascript
      * push(chunk, false) // push one of data chunks
      * ...
      * push(chunk, true)  // push last chunk
      * ```
      */
      push(data, flush_mode = false) {
        const strm = this.strm;
        const chunkSize = this.options.chunkSize;
        let status;
        let _flush_mode;
        let last_avail_out;
        if (this.ended) return this.err === 0;
        if (typeof flush_mode === "number") _flush_mode = flush_mode;
        else _flush_mode = flush_mode === true ? 4 : 0;
        if (toString.call(data) === "[object ArrayBuffer]") strm.input = new Uint8Array(data);
        else strm.input = data;
        strm.next_in = 0;
        strm.avail_in = strm.input.length;
        if (!this.started) {
          this.started = true;
          this.onStart(strm);
        }
        for (; ; ) {
          if (strm.avail_out === 0) {
            strm.output = new Uint8Array(chunkSize);
            strm.next_out = 0;
            strm.avail_out = chunkSize;
          }
          status = inflate$1(strm, _flush_mode);
          if (status === 2) {
            const dictionary = this.options.dictionary;
            if (dictionary.length) {
              status = inflateSetDictionary(strm, dictionary);
              if (status === 0) status = inflate$1(strm, _flush_mode);
              else if (status === -3) status = 2;
            }
          }
          while (strm.avail_in > 0 && status === 1 && strm.state.wrap & 2 && strm.state.flags !== 0 && strm.input[strm.next_in] !== 0) {
            inflateReset(strm);
            status = inflate$1(strm, _flush_mode);
          }
          if (status === -2 || status === -3 || status === 2 || status === -4) break;
          last_avail_out = strm.avail_out;
          if (strm.next_out) {
            if (strm.avail_out === 0 || status === 1 || _flush_mode > 0) {
              this.onData(strm.output.length === strm.next_out ? strm.output : strm.output.subarray(0, strm.next_out));
              strm.avail_out = 0;
              strm.next_out = 0;
            }
          }
          if ((status === 0 || status === -5) && last_avail_out === 0) continue;
          if (status === 1) {
            status = inflateEnd(this.strm);
            break;
          }
          if (strm.avail_in === 0) {
            if (_flush_mode === 4) {
              status = inflateEnd(this.strm);
              if (status === 0) status = -5;
              break;
            }
            return true;
          }
        }
        this.err = status;
        this.msg = strm.msg || messages_default[status];
        this.ended = true;
        this.onEnd(status);
        return status === 0;
      }
      /**
      * Called once before the first low-level inflate call.
      *
      * Override this handler to attach low-level inflate state, for example to read
      * gzip header metadata:
      *
      * ```javascript
      * import { Inflate, GZheader, zlibInflateGetHeader } from 'pako'
      *
      * const inflator = new Inflate()
      *
      * inflator.onStart = function (strm) {
      *   this.header = new GZheader()
      *   zlibInflateGetHeader(strm, this.header)
      * }
      *
      * inflator.push(data, true)
      * console.log(inflator.header.name)
      * ```
      */
      onStart(strm) {
      }
      /**
      * By default, stores data blocks in the {@link Inflate.chunks} property and glues
      * them in {@link Inflate.onEnd}. Override this handler if you need another behaviour.
      *
      * @param chunk output data.
      */
      onData(chunk) {
        this.chunks.push(chunk);
      }
      /**
      * Called after you tell inflate that the input stream is
      * complete ({@link Z_FINISH}). By default, joins the collected {@link Inflate.chunks},
      * frees memory and fills the {@link Inflate.result} property.
      *
      * @param status inflate status. {@link Z_OK} on success, other if not.
      */
      onEnd(status) {
        if (status === 0) this.result = flattenChunks(this.chunks);
        this.chunks = [];
      }
    };
  }
});

// node_modules/@uttori/data-tools/dist/data-helpers.js
var validateBytes, decodeExtended, float48, float80, convertFromIeeeExtended;
var init_data_helpers = __esm({
  "node_modules/@uttori/data-tools/dist/data-helpers.js"() {
    validateBytes = (uint8, length) => {
      if (uint8.length < length) {
        throw new RangeError(`Insufficient bytes: expected at least ${length}, received ${uint8.length}.`);
      }
      if (Array.isArray(uint8)) {
        for (let i = 0; i < length; i++) {
          if (!Number.isInteger(uint8[i]) || uint8[i] < 0 || uint8[i] > 255) {
            throw new RangeError(`Invalid byte at index ${i}: ${uint8[i]}`);
          }
        }
      }
    };
    decodeExtended = (sign, exponent, high, low) => {
      if (exponent === 32767) {
        return (high & 2147483647) === 0 && low === 0 ? sign * Infinity : Number.NaN;
      }
      if (high === 0 && low === 0) {
        return sign * 0;
      }
      const adjustedExponent = (exponent === 0 ? 1 : exponent) - 16383;
      if (high >= 2147483648 && adjustedExponent >= -1022 && adjustedExponent <= 1023) {
        return sign * ((high / 2147483648 + low / 9223372036854776e3) * 2 ** adjustedExponent);
      }
      const highestBit = high === 0 ? 31 - Math.clz32(low) : 63 - Math.clz32(high);
      const power = adjustedExponent + highestBit - 63;
      if (power > 1023) {
        return sign * Infinity;
      }
      if (power < -1075) {
        return sign * 0;
      }
      if (power >= -1022) {
        const mantissa2 = high * 4294967296 + low;
        return sign * (mantissa2 / 2 ** highestBit * 2 ** power);
      }
      const mantissa = BigInt(high) << 32n | BigInt(low);
      const shift = adjustedExponent + 1011;
      let rounded;
      if (shift >= 0) {
        rounded = mantissa << BigInt(shift);
      } else {
        const discarded = BigInt(-shift);
        rounded = mantissa >> discarded;
        const remainder = mantissa - (rounded << discarded);
        const half = 1n << discarded - 1n;
        if (remainder > half || remainder === half && (rounded & 1n) !== 0n) {
          rounded++;
        }
      }
      return sign * (Number(rounded) * Number.MIN_VALUE);
    };
    float48 = (uint8) => {
      validateBytes(uint8, 6);
      let mantissa = 0;
      let exponent = uint8[0];
      if (exponent === 0) {
        return 0;
      }
      exponent = uint8[0] - 129;
      for (let i = 1; i <= 4; i++) {
        mantissa += uint8[i];
        mantissa /= 256;
      }
      mantissa += uint8[5] & 127;
      mantissa /= 128;
      mantissa += 1;
      if (uint8[5] & 128) {
        mantissa = -mantissa;
      }
      const output = mantissa * 2 ** exponent;
      return output;
    };
    float80 = (uint8) => {
      validateBytes(uint8, 10);
      const high = (uint8[7] << 24 | uint8[6] << 16 | uint8[5] << 8 | uint8[4]) >>> 0;
      const low = (uint8[3] << 24 | uint8[2] << 16 | uint8[1] << 8 | uint8[0]) >>> 0;
      const a0 = uint8[9];
      const a1 = uint8[8];
      const sign = 1 - (a0 >>> 7) * 2;
      const exponent = (a0 & 127) << 8 | a1;
      return decodeExtended(sign, exponent, high, low);
    };
    convertFromIeeeExtended = (uint8) => {
      validateBytes(uint8, 10);
      const sign = uint8[0] & 128 ? -1 : 1;
      const exponent = (uint8[0] & 127) << 8 | uint8[1];
      const hiMant = (uint8[2] << 24 | uint8[3] << 16 | uint8[4] << 8 | uint8[5]) >>> 0;
      const loMant = (uint8[6] << 24 | uint8[7] << 16 | uint8[8] << 8 | uint8[9]) >>> 0;
      return decodeExtended(sign, exponent, hiMant, loMant);
    };
  }
});

// node_modules/@uttori/data-tools/dist/underflow-error.js
var UnderflowError, underflow_error_default;
var init_underflow_error = __esm({
  "node_modules/@uttori/data-tools/dist/underflow-error.js"() {
    UnderflowError = class extends Error {
      /**
       * Creates a new UnderflowError.
       * @param message Message to show when the error is thrown.
       * @class
       */
      constructor(message) {
        super(message);
        this.name = "UnderflowError";
        this.stack = new Error(message).stack;
        if (typeof Error.captureStackTrace === "function") {
          Error.captureStackTrace(this, this.constructor);
        }
      }
    };
    underflow_error_default = UnderflowError;
  }
});

// node_modules/ms/index.js
var require_ms = __commonJS({
  "node_modules/ms/index.js"(exports, module) {
    var s = 1e3;
    var m = s * 60;
    var h = m * 60;
    var d = h * 24;
    var w = d * 7;
    var y = d * 365.25;
    module.exports = function(val, options) {
      options = options || {};
      var type = typeof val;
      if (type === "string" && val.length > 0) {
        return parse(val);
      } else if (type === "number" && isFinite(val)) {
        return options.long ? fmtLong(val) : fmtShort(val);
      }
      throw new Error(
        "val is not a non-empty string or a valid number. val=" + JSON.stringify(val)
      );
    };
    function parse(str) {
      str = String(str);
      if (str.length > 100) {
        return;
      }
      var match = /^(-?(?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i.exec(
        str
      );
      if (!match) {
        return;
      }
      var n = parseFloat(match[1]);
      var type = (match[2] || "ms").toLowerCase();
      switch (type) {
        case "years":
        case "year":
        case "yrs":
        case "yr":
        case "y":
          return n * y;
        case "weeks":
        case "week":
        case "w":
          return n * w;
        case "days":
        case "day":
        case "d":
          return n * d;
        case "hours":
        case "hour":
        case "hrs":
        case "hr":
        case "h":
          return n * h;
        case "minutes":
        case "minute":
        case "mins":
        case "min":
        case "m":
          return n * m;
        case "seconds":
        case "second":
        case "secs":
        case "sec":
        case "s":
          return n * s;
        case "milliseconds":
        case "millisecond":
        case "msecs":
        case "msec":
        case "ms":
          return n;
        default:
          return void 0;
      }
    }
    function fmtShort(ms) {
      var msAbs = Math.abs(ms);
      if (msAbs >= d) {
        return Math.round(ms / d) + "d";
      }
      if (msAbs >= h) {
        return Math.round(ms / h) + "h";
      }
      if (msAbs >= m) {
        return Math.round(ms / m) + "m";
      }
      if (msAbs >= s) {
        return Math.round(ms / s) + "s";
      }
      return ms + "ms";
    }
    function fmtLong(ms) {
      var msAbs = Math.abs(ms);
      if (msAbs >= d) {
        return plural(ms, msAbs, d, "day");
      }
      if (msAbs >= h) {
        return plural(ms, msAbs, h, "hour");
      }
      if (msAbs >= m) {
        return plural(ms, msAbs, m, "minute");
      }
      if (msAbs >= s) {
        return plural(ms, msAbs, s, "second");
      }
      return ms + " ms";
    }
    function plural(ms, msAbs, n, name) {
      var isPlural = msAbs >= n * 1.5;
      return Math.round(ms / n) + " " + name + (isPlural ? "s" : "");
    }
  }
});

// node_modules/debug/src/common.js
var require_common = __commonJS({
  "node_modules/debug/src/common.js"(exports, module) {
    function setup(env) {
      createDebug.debug = createDebug;
      createDebug.default = createDebug;
      createDebug.coerce = coerce;
      createDebug.disable = disable;
      createDebug.enable = enable;
      createDebug.enabled = enabled;
      createDebug.humanize = require_ms();
      createDebug.destroy = destroy;
      Object.keys(env).forEach((key) => {
        createDebug[key] = env[key];
      });
      createDebug.names = [];
      createDebug.skips = [];
      createDebug.formatters = {};
      function selectColor(namespace) {
        let hash = 0;
        for (let i = 0; i < namespace.length; i++) {
          hash = (hash << 5) - hash + namespace.charCodeAt(i);
          hash |= 0;
        }
        return createDebug.colors[Math.abs(hash) % createDebug.colors.length];
      }
      createDebug.selectColor = selectColor;
      function createDebug(namespace) {
        let prevTime;
        let enableOverride = null;
        let namespacesCache;
        let enabledCache;
        function debug4(...args) {
          if (!debug4.enabled) {
            return;
          }
          const self = debug4;
          const curr = Number(/* @__PURE__ */ new Date());
          const ms = curr - (prevTime || curr);
          self.diff = ms;
          self.prev = prevTime;
          self.curr = curr;
          prevTime = curr;
          args[0] = createDebug.coerce(args[0]);
          if (typeof args[0] !== "string") {
            args.unshift("%O");
          }
          let index = 0;
          args[0] = args[0].replace(/%([a-zA-Z%])/g, (match, format) => {
            if (match === "%%") {
              return "%";
            }
            index++;
            const formatter = createDebug.formatters[format];
            if (typeof formatter === "function") {
              const val = args[index];
              match = formatter.call(self, val);
              args.splice(index, 1);
              index--;
            }
            return match;
          });
          createDebug.formatArgs.call(self, args);
          const logFn = self.log || createDebug.log;
          logFn.apply(self, args);
        }
        debug4.namespace = namespace;
        debug4.useColors = createDebug.useColors();
        debug4.color = createDebug.selectColor(namespace);
        debug4.extend = extend;
        debug4.destroy = createDebug.destroy;
        Object.defineProperty(debug4, "enabled", {
          enumerable: true,
          configurable: false,
          get: () => {
            if (enableOverride !== null) {
              return enableOverride;
            }
            if (namespacesCache !== createDebug.namespaces) {
              namespacesCache = createDebug.namespaces;
              enabledCache = createDebug.enabled(namespace);
            }
            return enabledCache;
          },
          set: (v) => {
            enableOverride = v;
          }
        });
        if (typeof createDebug.init === "function") {
          createDebug.init(debug4);
        }
        return debug4;
      }
      function extend(namespace, delimiter) {
        const newDebug = createDebug(this.namespace + (typeof delimiter === "undefined" ? ":" : delimiter) + namespace);
        newDebug.log = this.log;
        return newDebug;
      }
      function enable(namespaces) {
        createDebug.save(namespaces);
        createDebug.namespaces = namespaces;
        createDebug.names = [];
        createDebug.skips = [];
        const split = (typeof namespaces === "string" ? namespaces : "").trim().replace(/\s+/g, ",").split(",").filter(Boolean);
        for (const ns of split) {
          if (ns[0] === "-") {
            createDebug.skips.push(ns.slice(1));
          } else {
            createDebug.names.push(ns);
          }
        }
      }
      function matchesTemplate(search, template) {
        let searchIndex = 0;
        let templateIndex = 0;
        let starIndex = -1;
        let matchIndex = 0;
        while (searchIndex < search.length) {
          if (templateIndex < template.length && (template[templateIndex] === search[searchIndex] || template[templateIndex] === "*")) {
            if (template[templateIndex] === "*") {
              starIndex = templateIndex;
              matchIndex = searchIndex;
              templateIndex++;
            } else {
              searchIndex++;
              templateIndex++;
            }
          } else if (starIndex !== -1) {
            templateIndex = starIndex + 1;
            matchIndex++;
            searchIndex = matchIndex;
          } else {
            return false;
          }
        }
        while (templateIndex < template.length && template[templateIndex] === "*") {
          templateIndex++;
        }
        return templateIndex === template.length;
      }
      function disable() {
        const namespaces = [
          ...createDebug.names,
          ...createDebug.skips.map((namespace) => "-" + namespace)
        ].join(",");
        createDebug.enable("");
        return namespaces;
      }
      function enabled(name) {
        for (const skip of createDebug.skips) {
          if (matchesTemplate(name, skip)) {
            return false;
          }
        }
        for (const ns of createDebug.names) {
          if (matchesTemplate(name, ns)) {
            return true;
          }
        }
        return false;
      }
      function coerce(val) {
        if (val instanceof Error) {
          return val.stack || val.message;
        }
        return val;
      }
      function destroy() {
        console.warn("Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
      }
      createDebug.enable(createDebug.load());
      return createDebug;
    }
    module.exports = setup;
  }
});

// node_modules/debug/src/browser.js
var require_browser = __commonJS({
  "node_modules/debug/src/browser.js"(exports, module) {
    exports.formatArgs = formatArgs;
    exports.save = save;
    exports.load = load;
    exports.useColors = useColors;
    exports.storage = localstorage();
    exports.destroy = /* @__PURE__ */ (() => {
      let warned = false;
      return () => {
        if (!warned) {
          warned = true;
          console.warn("Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
        }
      };
    })();
    exports.colors = [
      "#0000CC",
      "#0000FF",
      "#0033CC",
      "#0033FF",
      "#0066CC",
      "#0066FF",
      "#0099CC",
      "#0099FF",
      "#00CC00",
      "#00CC33",
      "#00CC66",
      "#00CC99",
      "#00CCCC",
      "#00CCFF",
      "#3300CC",
      "#3300FF",
      "#3333CC",
      "#3333FF",
      "#3366CC",
      "#3366FF",
      "#3399CC",
      "#3399FF",
      "#33CC00",
      "#33CC33",
      "#33CC66",
      "#33CC99",
      "#33CCCC",
      "#33CCFF",
      "#6600CC",
      "#6600FF",
      "#6633CC",
      "#6633FF",
      "#66CC00",
      "#66CC33",
      "#9900CC",
      "#9900FF",
      "#9933CC",
      "#9933FF",
      "#99CC00",
      "#99CC33",
      "#CC0000",
      "#CC0033",
      "#CC0066",
      "#CC0099",
      "#CC00CC",
      "#CC00FF",
      "#CC3300",
      "#CC3333",
      "#CC3366",
      "#CC3399",
      "#CC33CC",
      "#CC33FF",
      "#CC6600",
      "#CC6633",
      "#CC9900",
      "#CC9933",
      "#CCCC00",
      "#CCCC33",
      "#FF0000",
      "#FF0033",
      "#FF0066",
      "#FF0099",
      "#FF00CC",
      "#FF00FF",
      "#FF3300",
      "#FF3333",
      "#FF3366",
      "#FF3399",
      "#FF33CC",
      "#FF33FF",
      "#FF6600",
      "#FF6633",
      "#FF9900",
      "#FF9933",
      "#FFCC00",
      "#FFCC33"
    ];
    function useColors() {
      if (typeof window !== "undefined" && window.process && (window.process.type === "renderer" || window.process.__nwjs)) {
        return true;
      }
      if (typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/)) {
        return false;
      }
      let m;
      return typeof document !== "undefined" && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance || // Is firebug? http://stackoverflow.com/a/398120/376773
      typeof window !== "undefined" && window.console && (window.console.firebug || window.console.exception && window.console.table) || // Is firefox >= v31?
      // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
      typeof navigator !== "undefined" && navigator.userAgent && (m = navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/)) && parseInt(m[1], 10) >= 31 || // Double check webkit in userAgent just in case we are in a worker
      typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/);
    }
    function formatArgs(args) {
      args[0] = (this.useColors ? "%c" : "") + this.namespace + (this.useColors ? " %c" : " ") + args[0] + (this.useColors ? "%c " : " ") + "+" + module.exports.humanize(this.diff);
      if (!this.useColors) {
        return;
      }
      const c = "color: " + this.color;
      args.splice(1, 0, c, "color: inherit");
      let index = 0;
      let lastC = 0;
      args[0].replace(/%[a-zA-Z%]/g, (match) => {
        if (match === "%%") {
          return;
        }
        index++;
        if (match === "%c") {
          lastC = index;
        }
      });
      args.splice(lastC, 0, c);
    }
    exports.log = console.debug || console.log || (() => {
    });
    function save(namespaces) {
      try {
        if (namespaces) {
          exports.storage.setItem("debug", namespaces);
        } else {
          exports.storage.removeItem("debug");
        }
      } catch (error) {
      }
    }
    function load() {
      let r;
      try {
        r = exports.storage.getItem("debug") || exports.storage.getItem("DEBUG");
      } catch (error) {
      }
      if (!r && typeof process !== "undefined" && "env" in process) {
        r = process.env.DEBUG;
      }
      return r;
    }
    function localstorage() {
      try {
        return localStorage;
      } catch (error) {
      }
    }
    module.exports = require_common()(exports);
    var { formatters } = module.exports;
    formatters.j = function(v) {
      try {
        return JSON.stringify(v);
      } catch (error) {
        return "[UnexpectedJSONParseError]: " + error.message;
      }
    };
  }
});

// node_modules/has-flag/index.js
var require_has_flag = __commonJS({
  "node_modules/has-flag/index.js"(exports, module) {
    "use strict";
    module.exports = (flag, argv = process.argv) => {
      const prefix = flag.startsWith("-") ? "" : flag.length === 1 ? "-" : "--";
      const position = argv.indexOf(prefix + flag);
      const terminatorPosition = argv.indexOf("--");
      return position !== -1 && (terminatorPosition === -1 || position < terminatorPosition);
    };
  }
});

// node_modules/supports-color/index.js
var require_supports_color = __commonJS({
  "node_modules/supports-color/index.js"(exports, module) {
    "use strict";
    var os = __require("os");
    var tty = __require("tty");
    var hasFlag = require_has_flag();
    var { env } = process;
    var forceColor;
    if (hasFlag("no-color") || hasFlag("no-colors") || hasFlag("color=false") || hasFlag("color=never")) {
      forceColor = 0;
    } else if (hasFlag("color") || hasFlag("colors") || hasFlag("color=true") || hasFlag("color=always")) {
      forceColor = 1;
    }
    if ("FORCE_COLOR" in env) {
      if (env.FORCE_COLOR === "true") {
        forceColor = 1;
      } else if (env.FORCE_COLOR === "false") {
        forceColor = 0;
      } else {
        forceColor = env.FORCE_COLOR.length === 0 ? 1 : Math.min(parseInt(env.FORCE_COLOR, 10), 3);
      }
    }
    function translateLevel(level) {
      if (level === 0) {
        return false;
      }
      return {
        level,
        hasBasic: true,
        has256: level >= 2,
        has16m: level >= 3
      };
    }
    function supportsColor(haveStream, streamIsTTY) {
      if (forceColor === 0) {
        return 0;
      }
      if (hasFlag("color=16m") || hasFlag("color=full") || hasFlag("color=truecolor")) {
        return 3;
      }
      if (hasFlag("color=256")) {
        return 2;
      }
      if (haveStream && !streamIsTTY && forceColor === void 0) {
        return 0;
      }
      const min = forceColor || 0;
      if (env.TERM === "dumb") {
        return min;
      }
      if (process.platform === "win32") {
        const osRelease = os.release().split(".");
        if (Number(osRelease[0]) >= 10 && Number(osRelease[2]) >= 10586) {
          return Number(osRelease[2]) >= 14931 ? 3 : 2;
        }
        return 1;
      }
      if ("CI" in env) {
        if (["TRAVIS", "CIRCLECI", "APPVEYOR", "GITLAB_CI", "GITHUB_ACTIONS", "BUILDKITE"].some((sign) => sign in env) || env.CI_NAME === "codeship") {
          return 1;
        }
        return min;
      }
      if ("TEAMCITY_VERSION" in env) {
        return /^(9\.(0*[1-9]\d*)\.|\d{2,}\.)/.test(env.TEAMCITY_VERSION) ? 1 : 0;
      }
      if (env.COLORTERM === "truecolor") {
        return 3;
      }
      if ("TERM_PROGRAM" in env) {
        const version = parseInt((env.TERM_PROGRAM_VERSION || "").split(".")[0], 10);
        switch (env.TERM_PROGRAM) {
          case "iTerm.app":
            return version >= 3 ? 3 : 2;
          case "Apple_Terminal":
            return 2;
        }
      }
      if (/-256(color)?$/i.test(env.TERM)) {
        return 2;
      }
      if (/^screen|^xterm|^vt100|^vt220|^rxvt|color|ansi|cygwin|linux/i.test(env.TERM)) {
        return 1;
      }
      if ("COLORTERM" in env) {
        return 1;
      }
      return min;
    }
    function getSupportLevel(stream) {
      const level = supportsColor(stream, stream && stream.isTTY);
      return translateLevel(level);
    }
    module.exports = {
      supportsColor: getSupportLevel,
      stdout: translateLevel(supportsColor(true, tty.isatty(1))),
      stderr: translateLevel(supportsColor(true, tty.isatty(2)))
    };
  }
});

// node_modules/debug/src/node.js
var require_node = __commonJS({
  "node_modules/debug/src/node.js"(exports, module) {
    var tty = __require("tty");
    var util = __require("util");
    exports.init = init;
    exports.log = log;
    exports.formatArgs = formatArgs;
    exports.save = save;
    exports.load = load;
    exports.useColors = useColors;
    exports.destroy = util.deprecate(
      () => {
      },
      "Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`."
    );
    exports.colors = [6, 2, 3, 4, 5, 1];
    try {
      const supportsColor = require_supports_color();
      if (supportsColor && (supportsColor.stderr || supportsColor).level >= 2) {
        exports.colors = [
          20,
          21,
          26,
          27,
          32,
          33,
          38,
          39,
          40,
          41,
          42,
          43,
          44,
          45,
          56,
          57,
          62,
          63,
          68,
          69,
          74,
          75,
          76,
          77,
          78,
          79,
          80,
          81,
          92,
          93,
          98,
          99,
          112,
          113,
          128,
          129,
          134,
          135,
          148,
          149,
          160,
          161,
          162,
          163,
          164,
          165,
          166,
          167,
          168,
          169,
          170,
          171,
          172,
          173,
          178,
          179,
          184,
          185,
          196,
          197,
          198,
          199,
          200,
          201,
          202,
          203,
          204,
          205,
          206,
          207,
          208,
          209,
          214,
          215,
          220,
          221
        ];
      }
    } catch (error) {
    }
    exports.inspectOpts = Object.keys(process.env).filter((key) => {
      return /^debug_/i.test(key);
    }).reduce((obj, key) => {
      const prop = key.substring(6).toLowerCase().replace(/_([a-z])/g, (_, k) => {
        return k.toUpperCase();
      });
      let val = process.env[key];
      if (/^(yes|on|true|enabled)$/i.test(val)) {
        val = true;
      } else if (/^(no|off|false|disabled)$/i.test(val)) {
        val = false;
      } else if (val === "null") {
        val = null;
      } else {
        val = Number(val);
      }
      obj[prop] = val;
      return obj;
    }, {});
    function useColors() {
      return "colors" in exports.inspectOpts ? Boolean(exports.inspectOpts.colors) : tty.isatty(process.stderr.fd);
    }
    function formatArgs(args) {
      const { namespace: name, useColors: useColors2 } = this;
      if (useColors2) {
        const c = this.color;
        const colorCode = "\x1B[3" + (c < 8 ? c : "8;5;" + c);
        const prefix = `  ${colorCode};1m${name} \x1B[0m`;
        args[0] = prefix + args[0].split("\n").join("\n" + prefix);
        args.push(colorCode + "m+" + module.exports.humanize(this.diff) + "\x1B[0m");
      } else {
        args[0] = getDate() + name + " " + args[0];
      }
    }
    function getDate() {
      if (exports.inspectOpts.hideDate) {
        return "";
      }
      return (/* @__PURE__ */ new Date()).toISOString() + " ";
    }
    function log(...args) {
      return process.stderr.write(util.formatWithOptions(exports.inspectOpts, ...args) + "\n");
    }
    function save(namespaces) {
      if (namespaces) {
        process.env.DEBUG = namespaces;
      } else {
        delete process.env.DEBUG;
      }
    }
    function load() {
      return process.env.DEBUG;
    }
    function init(debug4) {
      debug4.inspectOpts = {};
      const keys = Object.keys(exports.inspectOpts);
      for (let i = 0; i < keys.length; i++) {
        debug4.inspectOpts[keys[i]] = exports.inspectOpts[keys[i]];
      }
    }
    module.exports = require_common()(exports);
    var { formatters } = module.exports;
    formatters.o = function(v) {
      this.inspectOpts.colors = this.useColors;
      return util.inspect(v, this.inspectOpts).split("\n").map((str) => str.trim()).join(" ");
    };
    formatters.O = function(v) {
      this.inspectOpts.colors = this.useColors;
      return util.inspect(v, this.inspectOpts);
    };
  }
});

// node_modules/debug/src/index.js
var require_src = __commonJS({
  "node_modules/debug/src/index.js"(exports, module) {
    if (typeof process === "undefined" || process.type === "renderer" || process.browser === true || process.__nwjs) {
      module.exports = require_browser();
    } else {
      module.exports = require_node();
    }
  }
});

// node_modules/@uttori/data-tools/dist/data-buffer.js
function dataBufferBrand() {
  return /* @__PURE__ */ Symbol.for("uttori.DataBuffer");
}
function nativeEndian() {
  return new Uint16Array(new Uint8Array([18, 52]).buffer)[0] === 13330;
}
var DATA_BUFFER_BRAND2, NATIVE_ENDIAN, debug, DataBuffer, data_buffer_default;
var init_data_buffer = __esm({
  async "node_modules/@uttori/data-tools/dist/data-buffer.js"() {
    init_data_helpers();
    init_underflow_error();
    DATA_BUFFER_BRAND2 = /* @__PURE__ */ dataBufferBrand();
    NATIVE_ENDIAN = /* @__PURE__ */ nativeEndian();
    debug = (..._args) => {
    };
    if (typeof process !== "undefined" && process.env.UTTORI_DATA_DEBUG) {
      try {
        const { default: d } = await Promise.resolve().then(() => __toESM(require_src(), 1));
        debug = d("DataBuffer");
      } catch {
      }
    }
    DataBuffer = class _DataBuffer {
      /** Bytes owned or borrowed by this view. */
      data = new Uint8Array(0);
      /** Is this instance for creating a new file? */
      writing = false;
      /** Native Endianness of the machine, true is Little Endian, false is Big Endian */
      nativeEndian = false;
      /** Reading / Writing offset */
      offset = 0;
      /** Backing store for the internal write buffer, null until first write to avoid copying when read-only, based on `this.writing` flag. */
      _buffer = null;
      /** The number of bytes avaliable to read. */
      lengthInBytes = 0;
      /** When the buffer is part of a bufferlist, the next DataBuffer in the list. */
      next = null;
      /** When the buffer is part of a bufferlist, the previous DataBuffer in the list. */
      prev = null;
      /** Cached numeric view, bounded to data. */
      #dataView = null;
      /** The data identity and byte length used to construct the cached numeric view. */
      #viewData = null;
      #viewLength = -1;
      /**
       * Reuse the numeric view until data is replaced or its backing buffer is resized.
       * Do not inspect the old DataView's byte length, a resize may have made it out of bounds.
       * @returns {DataView} A view covering exactly the current data.
       */
      get #view() {
        const { data } = this;
        if (this.#dataView === null || this.#viewData !== data || this.#viewLength !== data.byteLength) {
          this.#dataView = new DataView(data.buffer, data.byteOffset, data.byteLength);
          this.#viewData = data;
          this.#viewLength = data.byteLength;
        }
        return this.#dataView;
      }
      /**
       * Validate the complete write range before initializing or modifying the staging array.
       * Array indices stop before 0xFFFFFFFF, which is the maximum number[] length.
       * @param {number} bytes The number of staged elements to write.
       * @param {number} offset The destination offset.
       * @throws {RangeError} The write range is not a valid array range.
       */
      #validateWrite(bytes, offset) {
        if (!Number.isSafeInteger(bytes) || bytes < 0 || !Number.isSafeInteger(offset) || offset < 0 || bytes > 4294967295 - offset) {
          throw new RangeError(`Invalid write range: ${offset} + ${bytes}`);
        }
      }
      /**
       * Creates an instance of DataBuffer.
       * @param {number[]|ArrayBuffer|Buffer|DataBuffer|Int8Array|Int16Array|Int32Array|number|string|Uint8Array|Uint16Array|Uint32Array} [input] The data to process.
       * Omitted input creates an empty writable buffer.
       * @throws {RangeError} The requested numeric length is not a nonnegative safe integer.
       * @throws {TypeError} Unknown type of input for DataBuffer: ${typeof input}
       */
      constructor(input) {
        this.writing = false;
        if (typeof Buffer !== "undefined" && Buffer.isBuffer(input)) {
          debug("constructor: from Buffer");
          this.data = Buffer.from(input);
        } else if (typeof input === "string") {
          debug("constructor: from string");
          this.data = new TextEncoder().encode(input);
        } else if (input instanceof Uint8Array) {
          debug("constructor: from Uint8Array");
          if (input.buffer instanceof ArrayBuffer) {
            this.data = input;
          } else {
            this.data = new Uint8Array(input);
          }
        } else if (input instanceof ArrayBuffer) {
          debug("constructor: from ArrayBuffer");
          this.data = new Uint8Array(input);
        } else if (Array.isArray(input)) {
          debug("constructor: Normal Array");
          this.data = new Uint8Array(input);
        } else if (typeof input === "number") {
          debug("constructor: Number (i.e. length)");
          if (!Number.isSafeInteger(input) || input < 0) {
            throw new RangeError(`Invalid buffer length: ${input}`);
          }
          this.data = new Uint8Array(input);
        } else if (input instanceof _DataBuffer) {
          debug("constructor: from DataBuffer, a shallow copy");
          this.data = input.data;
        } else if (ArrayBuffer.isView(input) && "BYTES_PER_ELEMENT" in input && input.buffer instanceof ArrayBuffer) {
          debug("constructor: from typed arrays other than Uint8Array");
          this.data = new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
        } else if (typeof input === "undefined") {
          debug("constructor: empty, creating a new file from scratch");
          this.writing = true;
          this.data = new Uint8Array();
        } else {
          const error = `Unknown type of input for DataBuffer: ${typeof input}`;
          debug(error);
          throw new TypeError(error);
        }
        this.lengthInBytes = this.data.length;
        this.next = null;
        this.prev = null;
        Object.defineProperty(this, DATA_BUFFER_BRAND2, { value: true });
        this.nativeEndian = NATIVE_ENDIAN;
        this.offset = 0;
        this._buffer = this.writing ? [] : null;
      }
      /**
       * Buffer for creating new files. Lazy-inits from a copy of data on first write when instance was created read-only.
       * @returns {number[]} The buffer.
       */
      get buffer() {
        if (this._buffer === null) {
          this._buffer = this.data.length ? Array.from(this.data) : [];
        }
        return this._buffer;
      }
      /**
       * Creates an instance of DataBuffer with given size.
       * @param {number} size The size of the requested DataBuffer.
       * @returns {DataBuffer} The new DataBuffer.
       */
      static allocate(size) {
        debug("DataBuffer.allocate:", size);
        return new _DataBuffer(size);
      }
      /**
       * Helper to match arrays by returning the data length.
       * @returns {number} The data length of the DataBuffer.
       */
      get length() {
        return this.data.length;
      }
      /**
       * Compares another DataBuffer against the current data buffer at a specified offset.
       * @param {number[]|ArrayBuffer|Buffer|DataBuffer|Int8Array|Int16Array|Int32Array|number|string|Uint8Array|Uint16Array|Uint32Array|undefined} input The data to compare against the current DataBuffer.
       * @param {number} [offset] The offset in the current DataBuffer to start comparing, default is 0.
       * @returns {boolean} Returns true when all input bytes match the region at offset, false if there is any difference, the input is empty, or the region is out of bounds.
       */
      compare(input, offset = 0) {
        let data;
        if (input instanceof _DataBuffer) {
          data = input.data;
        } else if (input instanceof Uint8Array) {
          data = input;
        } else {
          data = new _DataBuffer(input).data;
        }
        const { length } = data;
        if (!length) {
          debug("compare: no input provided");
          return false;
        }
        if (!this.availableAt(length, offset, false)) {
          return false;
        }
        const current = this.data;
        if (data === current && offset === 0) {
          return true;
        }
        for (let i = 0; i < length; i++) {
          if (current[offset + i] !== data[i]) {
            debug("compare: first failed match at", i);
            return false;
          }
        }
        debug("compare: data is the same");
        return true;
      }
      /**
       * Compares input data against the upcoming data, byte by byte.
       * @param {number[] | Buffer | Uint8Array} input The data to check for in upcoming bytes.
       * @returns {boolean} `true` if the data is the upcoming data, `false` if it is not or there is not enough buffer remaining.
       */
      isNextBytes(input) {
        debug("isNextBytes:", input);
        if (!input || typeof input.length !== "number" || input.length === 0) {
          debug("isNextBytes: no input provided");
          return false;
        }
        if (!this.available(input.length, false)) {
          debug(`isNextBytes: Insufficient Bytes: ${input.length} <= ${this.remainingBytes()}`);
          return false;
        }
        debug("isNextBytes: this.offset =", this.offset);
        const off = this.offset;
        for (let i = 0; i < input.length; i++) {
          if (input[i] !== this.data[off + i]) {
            debug("isNextBytes: first failed match at", i, ", where:", input[i], "!==", this.data[off + i]);
            return false;
          }
        }
        return true;
      }
      /**
       * Creates a copy of the current DataBuffer.
       * @returns {DataBuffer} A new copy of the current DataBuffer.
       */
      copy() {
        debug("copy");
        return new _DataBuffer(new Uint8Array(this.data));
      }
      /**
       * Creates a copy of the current DataBuffer from a specified offset and a specified length.
       * @param {number} position The starting offset to begin the copy of the new DataBuffer.
       * @param {number} [length] The size of the new DataBuffer, defaults to the current length.
       * @returns {DataBuffer} The new DataBuffer
       */
      slice(position, length = this.length) {
        debug("slice:", position, length);
        if (!Number.isSafeInteger(position) || position < 0 || !Number.isSafeInteger(length) || length < 0) {
          throw new RangeError(`Invalid slice range: ${position} + ${length}`);
        }
        return new _DataBuffer(new Uint8Array(this.data.subarray(position, position + length)));
      }
      /**
       * Returns the remaining bytes to be read in the DataBuffer.
       * @returns {number} The remaining bytes to bre read in the DataBuffer.
       */
      remainingBytes() {
        return this.length - this.offset;
      }
      /**
       * Checks if a given number of bytes are avaliable in the DataBuffer.
       * If writing mode is enabled, this is true for valid nonnegative integer ranges.
       * Pass false for writing when checking committed bytes for a read.
       * @param {number} bytes The number of bytes to check for.
       * @param {boolean} [writing] Allow growth instead of requiring committed bytes, default is this.writing.
       * @returns {boolean} True if there are the requested amount, or more, of bytes left in the DataBuffer.
       */
      available(bytes, writing = this.writing) {
        return this.availableAt(bytes, this.offset, writing);
      }
      /**
       * Checks if a given number of bytes are avaliable after a given offset in the buffer.
       * If writing mode is enabled, this is true for valid nonnegative integer ranges.
       * Pass false for writing when checking committed bytes for a read.
       * @param {number} bytes The number of bytes to check for.
       * @param {number} offset The offset to start from.
       * @param {boolean} [writing] Allow growth instead of requiring committed bytes, default is this.writing.
       * @returns {boolean} True if there are the requested amount, or more, of bytes left in the stream.
       */
      availableAt(bytes, offset, writing = this.writing) {
        return Number.isSafeInteger(bytes) && bytes >= 0 && Number.isSafeInteger(offset) && offset >= 0 && (writing ? bytes <= Number.MAX_SAFE_INTEGER - offset : bytes <= this.length - offset);
      }
      /**
       * Advance the offset by a given number of bytes.
       * @param {number} bytes The number of bytes to advance.
       * @throws {RangeError} The byte count or current offset is not a nonnegative safe integer.
       * @throws {UnderflowError} Insufficient Bytes in the DataBuffer.
       */
      advance(bytes) {
        debug("advance:", bytes);
        if (!Number.isSafeInteger(bytes) || bytes < 0) {
          throw new RangeError(`Invalid byte count: ${bytes}`);
        }
        if (!Number.isSafeInteger(this.offset) || this.offset < 0) {
          throw new RangeError(`Invalid offset: ${this.offset}`);
        }
        if (!this.available(bytes)) {
          throw new underflow_error_default(`Insufficient Bytes: ${bytes} <= ${this.remainingBytes()}`);
        }
        this.offset += bytes;
        debug("advance: offset", this.offset);
      }
      /**
       * Rewind the offset by a given number of bytes.
       * @param {number} bytes The number of bytes to go back.
       * @throws {RangeError} The byte count or current offset is not a nonnegative safe integer.
       * @throws {UnderflowError} Insufficient Bytes in the DataBuffer.
       */
      rewind(bytes) {
        debug("rewind:", bytes);
        if (!Number.isSafeInteger(bytes) || bytes < 0) {
          throw new RangeError(`Invalid byte count: ${bytes}`);
        }
        if (!Number.isSafeInteger(this.offset) || this.offset < 0) {
          throw new RangeError(`Invalid offset: ${this.offset}`);
        }
        if (bytes > this.offset) {
          throw new underflow_error_default(`Insufficient Bytes: ${bytes} > ${this.offset}`);
        }
        this.offset -= bytes;
        debug("rewind: offset", this.offset);
      }
      /**
       * Go to a specified offset in the stream.
       * @param {number} position The offset to go to.
       * @throws {RangeError} The requested position or current offset is not a nonnegative safe integer.
       */
      seek(position) {
        debug(`seek: from ${this.offset} to ${position}`);
        if (!Number.isSafeInteger(position) || position < 0) {
          throw new RangeError(`Invalid position: ${position}`);
        }
        if (!Number.isSafeInteger(this.offset) || this.offset < 0) {
          throw new RangeError(`Invalid offset: ${this.offset}`);
        }
        if (position === this.offset && !this.available(0)) {
          throw new underflow_error_default(`Insufficient Bytes: 0 <= ${this.remainingBytes()}`);
        }
        if (position > this.offset) {
          this.advance(position - this.offset);
        }
        if (position < this.offset) {
          this.rewind(this.offset - position);
        }
        debug(`seek: offset is ${this.offset}`);
      }
      /**
       * Read from the current offset and return the value.
       * @returns {number} The UInt8 value at the current offset.
       * @throws {UnderflowError} Insufficient Bytes in the stream.
       */
      readUInt8() {
        if (!this.available(1, false)) {
          throw new underflow_error_default("Insufficient Bytes: 1");
        }
        const output = this.data[this.offset];
        this.offset += 1;
        return output;
      }
      /**
       * Read from the specified offset without advancing the offsets and return the value.
       * @param {number} [offset] The offset to read from, default is 0.
       * @returns {number} The UInt8 value at the current offset.
       * @throws {UnderflowError} Insufficient Bytes in the stream.
       */
      peekUInt8(offset = 0) {
        if (!this.availableAt(1, offset, false)) {
          throw new underflow_error_default(`Insufficient Bytes: ${offset} + 1`);
        }
        return this.data[offset];
      }
      /**
       * Read from the current offset and return the value.
       * @param {number} bytes The number of bytes to read.
       * @param {boolean} [littleEndian] Read in Little Endian format, default is false.
       * @returns {Uint8Array} The UInt8 value at the current offset.
       */
      read(bytes, littleEndian3 = false) {
        if (!this.available(bytes, false)) {
          throw new underflow_error_default(`Insufficient Bytes: ${bytes}`);
        }
        const start = this.offset;
        if (littleEndian3 && bytes > 1) {
          const uint82 = new Uint8Array(bytes);
          for (let i = 0; i < bytes; i++) {
            uint82[i] = this.data[start + bytes - 1 - i];
          }
          this.offset += bytes;
          return uint82;
        }
        const uint8 = new Uint8Array(this.data.subarray(start, start + bytes));
        this.offset += bytes;
        return uint8;
      }
      /**
       * Read from the provided offset and return the value.
       * @param {number} bytes The number of bytes to read.
       * @param {number} [offset] The offset to read from, default is 0.
       * @param {boolean} [littleEndian] Read in Little Endian format, default is false.
       * @returns {Uint8Array} The UInt8 value at the current offset.
       */
      peek(bytes, offset = 0, littleEndian3 = false) {
        if (!this.availableAt(bytes, offset, false)) {
          throw new underflow_error_default(`Insufficient Bytes: ${offset} + ${bytes}`);
        }
        if (littleEndian3 && bytes > 1) {
          const uint8 = new Uint8Array(bytes);
          for (let i = 0; i < bytes; i++) {
            uint8[i] = this.data[offset + bytes - 1 - i];
          }
          return uint8;
        }
        return new Uint8Array(this.data.subarray(offset, offset + bytes));
      }
      /**
       * Read the bits from the bytes from the provided offset and return the value.
       * Bits are numbered from the most significant bit. Requests extending past bit 7
       * are zero-filled on the right, preserving the existing single-byte behavior.
       * @param {number} position The bit position to read, 0 to 7.
       * @param {number} [length] The number of bits to read, 1 to 8, default is 1.
       * @param {number} [offset] The offset to read from, default is 0.
       * @returns {number} The value at the provided bit position of a provided length at the provided offset.
       * @throws {Error} peekBit position is invalid: ${position}, must be an Integer between 0 and 7
       * @throws {Error} `peekBit length is invalid: ${length}, must be an Integer between 1 and 8
       */
      peekBit(position, length = 1, offset = 0) {
        if (Number.isNaN(position) || !Number.isInteger(position) || position < 0 || position > 7) {
          throw new Error(`peekBit position is invalid: ${position}, must be an Integer between 0 and 7`);
        }
        if (Number.isNaN(length) || !Number.isInteger(length) || length < 1 || length > 8) {
          throw new Error(`peekBit length is invalid: ${length}, must be an Integer between 1 and 8`);
        }
        const value = this.peekUInt8(offset);
        return (value << position & 255) >>> 8 - length;
      }
      /**
       * Read from the current offset and return the value.
       * @returns {number} The Int8 value at the current offset.
       */
      readInt8() {
        if (!this.available(1, false)) {
          throw new underflow_error_default("Insufficient Bytes: 1");
        }
        const v = this.#view.getInt8(this.offset);
        this.offset += 1;
        return v;
      }
      /**
       * Read from the specified offset without advancing the offsets and return the value.
       * @param {number} [offset] The offset to read from, default is 0.
       * @returns {number} The Int8 value at the current offset.
       */
      peekInt8(offset = 0) {
        if (!this.availableAt(1, offset, false)) {
          throw new underflow_error_default(`Insufficient Bytes: ${offset} + 1`);
        }
        return this.#view.getInt8(offset);
      }
      /**
       * Read from the current offset and return the value.
       * @param {boolean} [littleEndian] Read in Little Endian format, default is false.
       * @returns {number} The UInt16 value at the current offset.
       */
      readUInt16(littleEndian3 = false) {
        if (!this.available(2, false)) {
          throw new underflow_error_default("Insufficient Bytes: 2");
        }
        const v = this.#view.getUint16(this.offset, littleEndian3);
        this.offset += 2;
        return v;
      }
      /**
       * Read from the specified offset without advancing the offsets and return the value.
       * @param {number} [offset] The offset to read from, default is 0.
       * @param {boolean} [littleEndian] Read in Little Endian format, default is false.
       * @returns {number} The Int8 value at the current offset.
       */
      peekUInt16(offset = 0, littleEndian3 = false) {
        if (!this.availableAt(2, offset, false)) {
          throw new underflow_error_default(`Insufficient Bytes: ${offset} + 2`);
        }
        return this.#view.getUint16(offset, littleEndian3);
      }
      /**
       * Read from the current offset and return the value.
       * @param {boolean} [littleEndian] Read in Little Endian format, default is false.
       * @returns {number} The Int16 value at the current offset.
       */
      readInt16(littleEndian3 = false) {
        if (!this.available(2, false)) {
          throw new underflow_error_default("Insufficient Bytes: 2");
        }
        const v = this.#view.getInt16(this.offset, littleEndian3);
        this.offset += 2;
        return v;
      }
      /**
       * Read from the specified offset without advancing the offsets and return the value.
       * @param {number} [offset] The offset to read from, default is 0.
       * @param {boolean} [littleEndian] Read in Little Endian format, default is false.
       * @returns {number} The Int16 value at the current offset.
       */
      peekInt16(offset = 0, littleEndian3 = false) {
        if (!this.availableAt(2, offset, false)) {
          throw new underflow_error_default(`Insufficient Bytes: ${offset} + 2`);
        }
        return this.#view.getInt16(offset, littleEndian3);
      }
      /**
       * Read from the current offset and return the value.
       * @param {boolean} [littleEndian] Read in Little Endian format, default is false.
       * @returns {number} The UInt24 value at the current offset.
       */
      readUInt24(littleEndian3 = false) {
        if (!this.available(3, false)) {
          throw new underflow_error_default("Insufficient Bytes: 3");
        }
        const { offset } = this;
        const { data } = this;
        const value = littleEndian3 ? data[offset] | data[offset + 1] << 8 | data[offset + 2] << 16 : data[offset] << 16 | data[offset + 1] << 8 | data[offset + 2];
        this.offset += 3;
        return value;
      }
      /**
       * Read from the specified offset without advancing the offsets and return the value.
       * @param {number} [offset] The offset to read from, default is 0.
       * @param {boolean} [littleEndian] Read in Little Endian format, default is false.
       * @returns {number} The UInt24 value at the current offset.
       */
      peekUInt24(offset = 0, littleEndian3 = false) {
        if (!this.availableAt(3, offset, false)) {
          throw new underflow_error_default(`Insufficient Bytes: ${offset} + 3`);
        }
        const { data } = this;
        const value = littleEndian3 ? data[offset] | data[offset + 1] << 8 | data[offset + 2] << 16 : data[offset] << 16 | data[offset + 1] << 8 | data[offset + 2];
        return value;
      }
      /**
       * Read from the current offset and return the value.
       * @param {boolean} [littleEndian] Read in Little Endian format, default is false.
       * @returns {number} The Int24 value at the current offset.
       */
      readInt24(littleEndian3 = false) {
        if (!this.available(3, false)) {
          throw new underflow_error_default("Insufficient Bytes: 3");
        }
        const { offset } = this;
        const { data } = this;
        const value = littleEndian3 ? data[offset] | data[offset + 1] << 8 | data[offset + 2] << 16 : data[offset] << 16 | data[offset + 1] << 8 | data[offset + 2];
        this.offset += 3;
        return value << 8 >> 8;
      }
      /**
       * Read from the specified offset without advancing the offsets and return the value.
       * @param {number} [offset] The offset to read from, default is 0.
       * @param {boolean} [littleEndian] Read in Little Endian format, default is false.
       * @returns {number} The Int24 value at the current offset.
       */
      peekInt24(offset = 0, littleEndian3 = false) {
        if (!this.availableAt(3, offset, false)) {
          throw new underflow_error_default(`Insufficient Bytes: ${offset} + 3`);
        }
        const { data } = this;
        const value = littleEndian3 ? data[offset] | data[offset + 1] << 8 | data[offset + 2] << 16 : data[offset] << 16 | data[offset + 1] << 8 | data[offset + 2];
        return value << 8 >> 8;
      }
      /**
       * Read from the current offset and return the value.
       * @param {boolean} [littleEndian] Read in Little Endian format, default is false.
       * @returns {number} The UInt32 value at the current offset.
       */
      readUInt32(littleEndian3 = false) {
        if (!this.available(4, false)) {
          throw new underflow_error_default("Insufficient Bytes: 4");
        }
        const v = this.#view.getUint32(this.offset, littleEndian3);
        this.offset += 4;
        return v;
      }
      /**
       * Read from the specified offset without advancing the offsets and return the value.
       * @param {number} [offset] The offset to read from, default is 0.
       * @param {boolean} [littleEndian] Read in Little Endian format, default is false.
       * @returns {number} The UInt32 value at the current offset.
       */
      peekUInt32(offset = 0, littleEndian3 = false) {
        if (!this.availableAt(4, offset, false)) {
          throw new underflow_error_default(`Insufficient Bytes: ${offset} + 4`);
        }
        return this.#view.getUint32(offset, littleEndian3);
      }
      /**
       * Read from the current offset and return the value.
       * @param {boolean} [littleEndian] Read in Little Endian format, default is false.
       * @returns {number} The Int32 value at the current offset.
       */
      readInt32(littleEndian3 = false) {
        if (!this.available(4, false)) {
          throw new underflow_error_default("Insufficient Bytes: 4");
        }
        const v = this.#view.getInt32(this.offset, littleEndian3);
        this.offset += 4;
        return v;
      }
      /**
       * Read from the specified offset without advancing the offsets and return the value.
       * @param {number} [offset] The offset to read from, default is 0.
       * @param {boolean} [littleEndian] Read in Little Endian format, default is false.
       * @returns {number} The Int32 value at the current offset.
       */
      peekInt32(offset = 0, littleEndian3 = false) {
        if (!this.availableAt(4, offset, false)) {
          throw new underflow_error_default(`Insufficient Bytes: ${offset} + 4`);
        }
        return this.#view.getInt32(offset, littleEndian3);
      }
      /**
       * Read from the current offset and return the value.
       * @param {boolean} [littleEndian] Read in Little Endian format, default is false.
       * @returns {number} The Float32 value at the current offset.
       */
      readFloat32(littleEndian3 = false) {
        if (!this.available(4, false)) {
          throw new underflow_error_default("Insufficient Bytes: 4");
        }
        const v = this.#view.getFloat32(this.offset, littleEndian3);
        this.offset += 4;
        return v;
      }
      /**
       * Read from the specified offset without advancing the offsets and return the value.
       * @param {number} [offset] The offset to read from, default is 0.
       * @param {boolean} [littleEndian] Read in Little Endian format, default is false.
       * @returns {number} The Float32 value at the current offset.
       */
      peekFloat32(offset = 0, littleEndian3 = false) {
        if (!this.availableAt(4, offset, false)) {
          throw new underflow_error_default(`Insufficient Bytes: ${offset} + 4`);
        }
        return this.#view.getFloat32(offset, littleEndian3);
      }
      /**
       * Read from the current offset and return the Turbo Pascal 48 bit extended float value.
       * May be faulty with large numbers due to float percision.
       * @param {boolean} [littleEndian] Read in Little Endian format, default is false.
       * @returns {number} The Float48 value at the current offset.
       */
      readFloat48(littleEndian3 = false) {
        const uint8 = this.read(6, !littleEndian3);
        return float48(uint8);
      }
      /**
       * Read from the specified offset without advancing the offsets and return the Turbo Pascal 48 bit extended float value.
       * May be faulty with large numbers due to float percision.
       * @param {number} [offset] The offset to read from, default is 0.
       * @param {boolean} [littleEndian] Read in Little Endian format, default is false.
       * @returns {number} The Float48 value at the specified offset.
       */
      peekFloat48(offset = 0, littleEndian3 = false) {
        const uint8 = this.peek(6, offset, !littleEndian3);
        return float48(uint8);
      }
      /**
       * Read from the current offset and return the value.
       * @param {boolean} [littleEndian] Read in Little Endian format, default is false.
       * @returns {number} The Float64 value at the current offset.
       */
      readFloat64(littleEndian3 = false) {
        if (!this.available(8, false)) {
          throw new underflow_error_default("Insufficient Bytes: 8");
        }
        const v = this.#view.getFloat64(this.offset, littleEndian3);
        this.offset += 8;
        return v;
      }
      /**
       * Read from the specified offset without advancing the offsets and return the value.
       * @param {number} [offset] The offset to read from, default is 0.
       * @param {boolean} [littleEndian] Read in Little Endian format, default is false.
       * @returns {number} The Float64 value at the current offset.
       */
      peekFloat64(offset = 0, littleEndian3 = false) {
        if (!this.availableAt(8, offset, false)) {
          throw new underflow_error_default(`Insufficient Bytes: ${offset} + 8`);
        }
        return this.#view.getFloat64(offset, littleEndian3);
      }
      /**
       * Read from the current offset and return the IEEE 80 bit extended float value.
       * @param {boolean} [littleEndian] Reverse the input bytes before conversion, defaults to system value, default is the current nativeEndian value.
       * This legacy flag is retained for compatibility; use readFloatIEEE754 / peekFloatIEEE754 for conventional input-endianness semantics.
       * @returns {number} The Float80 value at the current offset.
       */
      readFloat80(littleEndian3 = this.nativeEndian) {
        const uint8 = this.read(10, littleEndian3);
        return float80(uint8);
      }
      /**
       * Read from the specified offset without advancing the offsets and return the IEEE 80 bit extended float value.
       * @param {number} [offset] The offset to read from, default is 0.
       * @param {boolean} [littleEndian] Reverse the input bytes before conversion, defaults to system value, default is the current nativeEndian value.
       * This legacy flag is retained for compatibility; use readFloatIEEE754 / peekFloatIEEE754 for conventional input-endianness semantics.
       * @returns {number} The Float80 value at the current offset.
       */
      peekFloat80(offset = 0, littleEndian3 = this.nativeEndian) {
        const uint8 = this.peek(10, offset, littleEndian3);
        return float80(uint8);
      }
      /**
       * Read from the current offset and return the IEEE 754 extended float value.
       * May be faulty with large numbers due to float percision.
       * @param {boolean} [littleEndian] Read in Little Endian format, default is false.
       * @returns {number} The IEEE 754 extended float value at the current offset.
       */
      readFloatIEEE754(littleEndian3 = false) {
        const uint8 = this.read(10, littleEndian3);
        return convertFromIeeeExtended(uint8);
      }
      /**
       * Peek from the specified offset without advancing the offsets and return the IEEE 754 extended float value.
       * May be faulty with large numbers due to float percision.
       * @param {number} [offset] The offset to read from, default is 0.
       * @param {boolean} [littleEndian] Read in Little Endian format, default is false.
       * @returns {number} The IEEE 754 extended float value at the specified offset.
       */
      peekFloatIEEE754(offset = 0, littleEndian3 = false) {
        const uint8 = this.peek(10, offset, littleEndian3);
        return convertFromIeeeExtended(uint8);
      }
      /**
       * Read from the current offset and return the value as a DataBuffer.
       * @param {number} length The number of bytes to read.
       * @returns {DataBuffer} The requested number of bytes as a DataBuffer.
       */
      readBuffer(length) {
        if (!this.available(length, false)) {
          throw new underflow_error_default(`Insufficient Bytes: ${length}`);
        }
        const chunk = new _DataBuffer(new Uint8Array(this.data.subarray(this.offset, this.offset + length)));
        this.offset += length;
        return chunk;
      }
      /**
       * Read from the specified offset and return the value as a DataBuffer.
       * @param {number} offset The offset to read from.
       * @param {number} length The number of bytes to read.
       * @returns {DataBuffer} The requested number of bytes as a DataBuffer.
       */
      peekBuffer(offset, length) {
        if (!this.availableAt(length, offset, false)) {
          throw new underflow_error_default(`Insufficient Bytes: ${offset} + ${length}`);
        }
        return new _DataBuffer(new Uint8Array(this.data.subarray(offset, offset + length)));
      }
      /**
       * Read from the current offset for a given length and return the value as a string.
       * @param {number|null} [length] The number of bytes to read; omitted reads the remainder, null reads through a null terminator, and zero reads nothing.
       * @param {string} [encoding] The encoding of the string, default is `ascii`.
       * @returns {string} The read value as a string.
       */
      readString(length, encoding = "ascii") {
        debug("readString:", { length, encoding });
        return this.decodeString(this.offset, length, encoding, true);
      }
      /**
       * Read from the specified offset for a given length and return the value as a string.
       * @param {number} offset The offset to read from.
       * @param {number|null} [length] The number of bytes to read; omitted reads the remainder, null reads through a null terminator, and zero reads nothing.
       * @param {string} [encoding] The encoding of the string, default is `ascii`.
       * @returns {string} The read value as a string.
       */
      peekString(offset, length, encoding = "ascii") {
        debug("peekString:", { offset, length, encoding });
        return this.decodeString(offset, length, encoding, false);
      }
      /**
       * Read from the specified offset for a given length and return the value as a string in a specified encoding, and optionally advance the offsets.
       * Supported Encodings: ascii / latin1, utf8 / utf-8, utf16-be, utf16be, utf16le, utf16-le, utf16bom, utf16-bom
       * Encoding names are case-insensitive. Malformed UTF-8 is replaced with U+FFFD without
       * consuming bytes outside the field; malformed UTF-16 retains the existing error behavior.
       * A failed decode does not move the cursor. A successful advancing decode ends at the supplied offset plus consumed bytes.
       * @private
       * @param {number} offset The offset to read from.
       * @param {number|null|undefined} length The number of bytes to read, if not defined it is the remaining bytes in the buffer. If NULL a null terminated string will be read.
       * @param {string} encoding The encoding of the string.
       * @param {boolean} [advance] Flag to optionally advance the offsets, default is false.
       * @returns {string} The read value as a string.
       */
      decodeString(offset, length, encoding, advance = false) {
        debug("decodeString:", { offset, length, encoding, advance });
        encoding = encoding.toLowerCase();
        if (length === null) {
          return this.decodeNullTerminatedString(offset, encoding, advance);
        }
        if (length === void 0) {
          length = this.length - offset;
        }
        if (!this.availableAt(length, offset, false)) {
          throw new underflow_error_default(`Insufficient Bytes: ${offset} + ${length}`);
        }
        const end = offset + length;
        const { data } = this;
        const codes = [];
        const chunks = [];
        switch (encoding) {
          case "ascii":
          case "latin1": {
            while (offset < end) {
              if (codes.length >= 16384) {
                chunks.push(String.fromCharCode(...codes));
                codes.length = 0;
              }
              const character = data[offset++];
              codes.push(character);
            }
            break;
          }
          case "utf8":
          case "utf-8": {
            while (offset < end) {
              if (codes.length >= 16384) {
                chunks.push(String.fromCharCode(...codes));
                codes.length = 0;
              }
              const b1 = data[offset++];
              let needed = 0;
              let point = 0;
              let lower = 128;
              let upper = 191;
              if (b1 < 128) {
                codes.push(b1);
                continue;
              } else if (b1 >= 194 && b1 <= 223) {
                needed = 1;
                point = b1 & 31;
              } else if (b1 >= 224 && b1 <= 239) {
                needed = 2;
                point = b1 & 15;
                if (b1 === 224) {
                  lower = 160;
                }
                if (b1 === 237) {
                  upper = 159;
                }
              } else if (b1 >= 240 && b1 <= 244) {
                needed = 3;
                point = b1 & 7;
                if (b1 === 240) {
                  lower = 144;
                }
                if (b1 === 244) {
                  upper = 143;
                }
              } else {
                codes.push(65533);
                continue;
              }
              let valid = true;
              for (let i = 0; i < needed; i++) {
                if (offset >= end || data[offset] < lower || data[offset] > upper) {
                  valid = false;
                  break;
                }
                point = point << 6 | data[offset++] & 63;
                lower = 128;
                upper = 191;
              }
              if (!valid) {
                codes.push(65533);
              } else if (point < 65536) {
                codes.push(point);
              } else {
                const pt = point - 65536;
                codes.push(55296 + (pt >> 10), 56320 + (pt & 1023));
              }
            }
            break;
          }
          case "utf16-be":
          case "utf16be":
          case "utf16le":
          case "utf16-le":
          case "utf16bom":
          case "utf16-bom": {
            let littleEndian3;
            switch (encoding) {
              case "utf16be":
              case "utf16-be": {
                littleEndian3 = false;
                break;
              }
              case "utf16le":
              case "utf16-le": {
                littleEndian3 = true;
                break;
              }
              case "utf16bom":
              case "utf16-bom":
              default: {
                littleEndian3 = false;
                if (end - offset >= 2) {
                  const bom = data[offset] << 8 | data[offset + 1];
                  if (bom === 65279 || bom === 65534) {
                    littleEndian3 = bom === 65534;
                    offset += 2;
                  }
                }
                break;
              }
            }
            let w1 = 0;
            while (offset < end) {
              if (codes.length >= 16384) {
                chunks.push(String.fromCharCode(...codes));
                codes.length = 0;
              }
              if (end - offset < 2) {
                throw new Error("Invalid utf16 sequence.");
              }
              w1 = littleEndian3 ? data[offset] | data[offset + 1] << 8 : data[offset] << 8 | data[offset + 1];
              offset += 2;
              if (w1 < 55296 || w1 > 57343) {
                codes.push(w1);
              } else {
                if (w1 > 56319 || end - offset < 2) {
                  throw new Error("Invalid utf16 sequence.");
                }
                const w2 = littleEndian3 ? data[offset] | data[offset + 1] << 8 : data[offset] << 8 | data[offset + 1];
                if (w2 < 56320 || w2 > 57343) {
                  throw new Error("Invalid utf16 sequence.");
                }
                codes.push(w1, w2);
                offset += 2;
              }
            }
            break;
          }
          default: {
            throw new Error(`Unknown Encoding: ${encoding}`);
          }
        }
        const result = chunks.length ? chunks.join("") + String.fromCharCode(...codes) : String.fromCharCode(...codes);
        if (advance) {
          this.offset = end;
        }
        return result;
      }
      /**
       * Read a null-terminated string from the current offset and advance the offset.
       * A null-terminated string is a sequence of bytes ending with a null byte (0x00).
       * @param {string} [encoding] The encoding of the string, default is `ascii`.
       * @param {number} [nullValue] The byte value that terminates the string, default is 0x00.
       * @returns {string} The read value as a string (without the null terminator).
       */
      readNullTerminatedString(encoding = "ascii", nullValue = 0) {
        debug("readNullTerminatedString:", { encoding, nullValue });
        const result = this.decodeNullTerminatedString(this.offset, encoding, true, nullValue);
        return result;
      }
      /**
       * Read a null-terminated string from the specified offset without advancing the offset.
       * A null-terminated string is a sequence of bytes ending with a null byte (0x00).
       * @param {number} offset The offset to read from.
       * @param {string} [encoding] The encoding of the string, default is `ascii`.
       * @param {number} [nullValue] The byte value that terminates the string, default is 0x00.
       * @returns {string} The read value as a string (without the null terminator).
       */
      peekNullTerminatedString(offset, encoding = "ascii", nullValue = 0) {
        debug("peekNullTerminatedString:", { offset, encoding, nullValue });
        const result = this.decodeNullTerminatedString(offset, encoding, false, nullValue);
        return result;
      }
      /**
       * Decode a null-terminated string from the specified offset.
       * Reads bytes until a null byte (0x00) is encountered. For UTF-16, a terminator is two
       * copies of nullValue at a code-unit boundary. Without a terminator, reads to the end of data.
       * Uses the same encodings and Unicode validation as decodeString.
       * @private
       * @param offset The offset to read from.
       * @param encoding The encoding of the string.
       * @param advance Flag to optionally advance the offsets.
       * @param nullValue The byte value that terminates the string, default is 0x00.
       * @returns The read value as a string (without the null terminator).
       */
      decodeNullTerminatedString(offset, encoding, advance, nullValue = 0) {
        debug("decodeNullTerminatedString:", { offset, encoding, advance, nullValue });
        encoding = encoding.toLowerCase();
        if (!this.availableAt(0, offset, false)) {
          throw new underflow_error_default(`Insufficient Bytes: ${offset} + 0`);
        }
        if (!Number.isInteger(nullValue) || nullValue < 0 || nullValue > 255) {
          throw new RangeError(`Invalid null value: ${nullValue}`);
        }
        const start = offset;
        const { data } = this;
        const { length } = data;
        let end = length;
        switch (encoding) {
          case "utf8":
          case "utf-8": {
            const terminator = data.indexOf(nullValue, offset);
            if (terminator !== -1) {
              end = terminator;
              offset = terminator + 1;
            } else {
              offset = length;
            }
            break;
          }
          case "utf16-be":
          case "utf16be":
          case "utf16-le":
          case "utf16le":
          case "utf16bom":
          case "utf16-bom": {
            while (offset < length - 1) {
              const b1 = data[offset];
              const b2 = data[offset + 1];
              if (b1 === nullValue && b2 === nullValue) {
                end = offset;
                offset += 2;
                break;
              }
              offset += 2;
            }
            if (end === length) {
              offset = length;
            }
            break;
          }
          case "ascii":
          case "latin1": {
            const terminator = data.indexOf(nullValue, offset);
            if (terminator !== -1) {
              end = terminator;
              offset = terminator + 1;
            } else {
              offset = length;
            }
            break;
          }
          default: {
            throw new Error(`Unknown Encoding: ${encoding}`);
          }
        }
        const result = this.decodeString(start, end - start, encoding, false);
        if (advance) {
          this.offset = offset;
        }
        return result;
      }
      /**
       * Resets the instance offsets to 0.
       */
      reset() {
        debug("reset");
        this.offset = 0;
      }
      /**
       * Writes a single 8 bit byte.
       * @param {number} data The data to write.
       * @param {number} [offset] The offset to write the data to, default is current offset.
       * @param {boolean} [advance] Flag to set the cursor to the supplied offset plus the number of bytes written, default is true; false leaves the cursor unchanged.
       */
      writeUInt8(data, offset = this.offset, advance = true) {
        debug("writeUInt8:", { data, offset, advance });
        this.#validateWrite(1, offset);
        const buffer = this.buffer;
        buffer[offset] = data;
        if (advance) {
          this.offset = offset + 1;
        }
      }
      /**
       * Writes an unsigned 16 bit value, 2 bytes.
       * @param {number} data The data to write.
       * @param {number} [offset] The offset to write the data to, default is current offset.
       * @param {boolean} [advance] Flag to set the cursor to the supplied offset plus the number of bytes written, default is true; false leaves the cursor unchanged.
       * @param {boolean} [littleEndian] Endianness of the write order, little Endian when `true`, default is big Endian `false`.
       */
      writeUInt16(data, offset = this.offset, advance = true, littleEndian3 = false) {
        debug("writeUInt16:", { data, offset, advance, littleEndian: littleEndian3 });
        this.#validateWrite(2, offset);
        const buffer = this.buffer;
        if (littleEndian3) {
          buffer[offset] = data & 255;
          buffer[offset + 1] = (data & 65280) >> 8;
        } else {
          buffer[offset] = (data & 65280) >> 8;
          buffer[offset + 1] = data & 255;
        }
        if (advance) {
          this.offset = offset + 2;
        }
      }
      /**
       * Writes an unsigned 24 bit value, 3 bytes.
       * @param {number} data The data to write.
       * @param {number} [offset] The offset to write the data to, default is current offset.
       * @param {boolean} [advance] Flag to set the cursor to the supplied offset plus the number of bytes written, default is true; false leaves the cursor unchanged.
       * @param {boolean} [littleEndian] Endianness of the write order, little Endian when `true`, default is big Endian `false`.
       */
      writeUInt24(data, offset = this.offset, advance = true, littleEndian3 = false) {
        debug("writeUInt24:", { data, offset, advance, littleEndian: littleEndian3 });
        this.#validateWrite(3, offset);
        const buffer = this.buffer;
        if (littleEndian3) {
          buffer[offset] = data & 255;
          buffer[offset + 1] = (data & 65280) >> 8;
          buffer[offset + 2] = (data & 16711680) >> 16;
        } else {
          buffer[offset] = (data & 16711680) >> 16;
          buffer[offset + 1] = (data & 65280) >> 8;
          buffer[offset + 2] = data & 255;
        }
        if (advance) {
          this.offset = offset + 3;
        }
      }
      /**
       * Writes an unsigned 32 bit value, 4 bytes.
       * @param {number} data The data to write.
       * @param {number} [offset] The offset to write the data to, default is current offset.
       * @param {boolean} [advance] Flag to set the cursor to the supplied offset plus the number of bytes written, default is true; false leaves the cursor unchanged.
       * @param {boolean} [littleEndian] Endianness of the write order, little Endian when `true`, default is big Endian `false`.
       */
      writeUInt32(data, offset = this.offset, advance = true, littleEndian3 = false) {
        debug("writeUInt32:", { data, offset, advance, littleEndian: littleEndian3 });
        this.#validateWrite(4, offset);
        const buffer = this.buffer;
        if (littleEndian3) {
          buffer[offset] = data & 255;
          buffer[offset + 1] = (data & 65280) >> 8;
          buffer[offset + 2] = (data & 16711680) >> 16;
          buffer[offset + 3] = data >>> 24;
        } else {
          buffer[offset] = data >>> 24;
          buffer[offset + 1] = (data & 16711680) >> 16;
          buffer[offset + 2] = (data & 65280) >> 8;
          buffer[offset + 3] = data & 255;
        }
        if (advance) {
          this.offset = offset + 4;
        }
      }
      /**
       * Write a series of bytes.
       * Wider typed arrays retain the existing element-wise behavior: one staged value per element,
       * converted to a byte by commit(), not the constructor's raw-memory interpretation.
       * @param {number[]|Int8Array|Int16Array|Int32Array|Uint8Array|Uint16Array|Uint32Array} data The data to write.
       * @param {number} [offset] The offset to write the data to, default is current offset.
       * @param {boolean} [advance] Flag to set the cursor to the supplied offset plus the number of bytes written, default is true; false leaves the cursor unchanged.
       */
      writeBytes(data, offset = this.offset, advance = true) {
        debug("writeBytes:", { data, offset, advance });
        const { length } = data;
        this.#validateWrite(length, offset);
        if (length > 0) {
          const buffer = this.buffer;
          const source = data === buffer ? buffer.slice() : data;
          for (let i = 0; i < length; i++) {
            buffer[offset + i] = source[i];
          }
        }
        if (advance) {
          this.offset = offset + length;
        }
      }
      /**
       * Write a string as a given encoding.
       *
       * Valid encodings are: 'ascii' aka 'latin1', 'utf8' / 'utf-8', 'utf16be' / 'utf16-be', 'utf16le' / 'utf16-le', 'utf16bom' / 'utf16-bom'.
       * Names are case-insensitive. BOM encodings write a big-endian BOM before the UTF-16 data.
       * UTF-8 replaces unpaired surrogates with U+FFFD; UTF-16 retains the original code units.
       *
       * For UTF-8:
       * Up to 4 bytes per character can be used. The fewest number of bytes possible is used.
       * Characters up to U+007F are encoded with a single byte.
       * For multibyte sequences, the number of leading 1 bits in the first byte gives the number of bytes for the character. The rest of the bits of the first byte can be used to encode bits of the character.
       * The continuation bytes begin with 10, and the other 6 bits encode bits of the character.
       *
       * UTF-8 conversion interpreted from https://stackoverflow.com/posts/18729931/revisions
       * @param {string} string The data to write.
       * @param {number} [offset] The offset to write the data to, default is current offset.
       * @param {string} [encoding] The encoding of the string, defailt is `ascii`.
       * @param {boolean} [advance] Flag to set the cursor to the supplied offset plus the number of bytes written, default is true; false leaves the cursor unchanged.
       */
      writeString(string2, offset = this.offset, encoding = "ascii", advance = true) {
        debug("writeString:", { string: string2, offset, encoding, advance });
        this.#validateWrite(0, offset);
        encoding = encoding.toLowerCase();
        const data = [];
        switch (encoding) {
          case "ascii":
          case "latin1": {
            for (let i = 0; i < string2.length; i++) {
              data.push(string2.charCodeAt(i) & 255);
            }
            break;
          }
          case "utf8":
          case "utf-8": {
            for (let i = 0; i < string2.length; i++) {
              let charcode = string2.charCodeAt(i);
              if (charcode < 128) {
                data.push(charcode);
              } else if (charcode < 2048) {
                data.push(192 | charcode >> 6, 128 | charcode & 63);
              } else if (charcode < 55296 || charcode >= 57344) {
                data.push(224 | charcode >> 12, 128 | charcode >> 6 & 63, 128 | charcode & 63);
              } else {
                const next = string2.charCodeAt(i + 1);
                if (charcode > 56319 || !(next >= 56320 && next <= 57343)) {
                  data.push(239, 191, 189);
                  continue;
                }
                i++;
                charcode = 65536 + ((charcode & 1023) << 10 | string2.charCodeAt(i) & 1023);
                data.push(240 | charcode >> 18, 128 | charcode >> 12 & 63, 128 | charcode >> 6 & 63, 128 | charcode & 63);
              }
            }
            break;
          }
          case "utf16be":
          case "utf16-be":
          case "utf16le":
          case "utf16-le":
          case "utf16bom":
          case "utf16-bom": {
            const littleEndian3 = encoding === "utf16le" || encoding === "utf16-le";
            if (encoding === "utf16bom" || encoding === "utf16-bom") {
              data.push(254, 255);
            }
            for (let i = 0; i < string2.length; i++) {
              const charcode = string2.charCodeAt(i);
              if (littleEndian3) {
                data.push(charcode & 255, charcode / 256 >>> 0);
              } else {
                data.push(charcode / 256 >>> 0, charcode & 255);
              }
            }
            break;
          }
          default: {
            throw new Error(`Unknown Encoding: ${encoding}`);
          }
        }
        debug("writeString: data", data);
        this.writeBytes(data, offset, advance);
      }
      /**
       * Convert a write mode file into a read mode file.
       */
      commit() {
        debug("commit: converting to read mode file");
        this.data = new Uint8Array(this.buffer);
        this.lengthInBytes = this.data.length;
        this.#dataView = null;
        this.#viewData = null;
        this.#viewLength = -1;
        this._buffer = null;
        this.writing = false;
      }
    };
    data_buffer_default = DataBuffer;
  }
});

// node_modules/@uttori/data-tools/dist/audio/audio-wav.js
function rolandPads() {
  return ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"].flatMap((bank) => Array.from({ length: 12 }, (_value, pad) => `${bank}${pad + 1}`));
}
var _a, debug2, WAVE_FORMAT_TAGS, WAVE_CHANNEL_MASK_LABELS, ROLAND_SP404SX_PADS, AudioWAV, audio_wav_default;
var init_audio_wav = __esm({
  async "node_modules/@uttori/data-tools/dist/audio/audio-wav.js"() {
    init_pako();
    await init_data_buffer();
    debug2 = (..._args) => {
    };
    if (typeof process !== "undefined" && process.env.UTTORI_AUDIOWAV_DEBUG) {
      try {
        const { default: d } = await Promise.resolve().then(() => __toESM(require_src(), 1));
        debug2 = d("Uttori.AudioWAV");
      } catch {
      }
    }
    WAVE_FORMAT_TAGS = {
      1: "Microsoft Pulse Code Modulation (PCM) / Uncompressed",
      2: "Microsoft ADPCM",
      3: "Microsoft IEEE Float LPCM",
      4: "Compaq VSELP",
      5: "IBM CVSD",
      6: "Microsoft ITU G.711 a-law",
      7: "Microsoft ITU G.711 \xB5-law",
      8: "Microsoft DTS",
      9: "DRM",
      10: "WMA 9 Speech",
      11: "Microsoft Windows Media RT Voice",
      16: "OKI-ADPCM",
      17: "Intel IMA / DVI-ADPCM",
      18: "Videologic Mediaspace ADPCM",
      19: "Sierra ADPCM",
      20: "Antex G.723 ADPCM",
      21: "DSP Solutions DIGISTD",
      22: "DSP Solutions DIGIFIX / ITU G.723 ADPCM (Yamaha)",
      23: "Dialoic OKI ADPCM",
      24: "Media Vision ADPCM",
      25: "HP CU",
      26: "HP Dynamic Voice",
      32: "Yamaha ADPCM",
      33: "SONARC Speech Compression",
      34: "DSP Group True Speech",
      35: "Echo Speech Corp.",
      36: "Virtual Music Audiofile AF36",
      37: "Audio Processing Tech.",
      38: "Virtual Music Audiofile AF10",
      39: "Aculab Prosody 1612",
      40: "Merging Tech. LRC",
      48: "Dolby AC2",
      49: "Microsoft 6.10",
      50: "MSN Audio",
      51: "Antex ADPCME",
      52: "Control Resources VQLPC",
      53: "DSP Solutions DIGIREAL",
      54: "DSP Solutions DIGIADPCM",
      55: "Control Resources CR10",
      56: "Natural MicroSystems VBX ADPCM",
      57: "Crystal Semiconductor IMA ADPCM",
      58: "Echo Speech ECHOSC3",
      59: "Rockwell ADPCM",
      60: "Rockwell DIGITALK",
      61: "Xebec Multimedia",
      64: "Antex ITU G.721 ADPCM",
      65: "Antex G.728 CELP",
      66: "Microsoft MSG723",
      67: "IBM AVC ADPCM",
      69: "ITU-T G.726",
      80: "Microsoft MPEG",
      81: "RT23 or PAC",
      82: "InSoft RT24",
      83: "InSoft PAC",
      85: "MP3",
      89: "Cirrus",
      96: "Cirrus Logic",
      97: "ESS Tech. PCM",
      98: "Voxware Inc.",
      99: "Canopus ATRAC",
      100: "APICOM G.726 ADPCM",
      101: "APICOM G.722 ADPCM",
      102: "Microsoft DSAT",
      103: "Microsoft DSAT DISPLAY",
      105: "Voxware Byte Aligned",
      112: "Voxware AC8",
      113: "Voxware AC10",
      114: "Voxware AC16",
      115: "Voxware AC20",
      116: "Voxware MetaVoice",
      117: "Voxware MetaSound",
      118: "Voxware RT29HW",
      119: "Voxware VR12",
      120: "Voxware VR18",
      121: "Voxware TQ40",
      122: "Voxware SC3",
      123: "Voxware SC3",
      128: "Soundsoft",
      129: "Voxware TQ60",
      130: "Microsoft MSRT24",
      131: "AT&T G.729A",
      132: "Motion Pixels MVI MV12",
      133: "DataFusion G.726",
      134: "DataFusion GSM610",
      136: "Iterated Systems Audio",
      137: "Onlive",
      138: "Multitude, Inc. FT SX20",
      139: "Infocom ITS A/S G.721 ADPCM",
      140: "Convedia G729",
      141: "Not specified congruency, Inc.",
      145: "Siemens SBC24",
      146: "Sonic Foundry Dolby AC3 APDIF",
      147: "MediaSonic G.723",
      148: "Aculab Prosody 8kbps",
      151: "ZyXEL ADPCM",
      152: "Philips LPCBB",
      153: "Studer Professional Audio Packed",
      160: "Malden PhonyTalk",
      161: "Racal Recorder GSM",
      162: "Racal Recorder G720.a",
      163: "Racal G723.1",
      164: "Racal Tetra ACELP",
      176: "NEC AAC NEC Corporation",
      255: "AAC",
      256: "Rhetorex ADPCM",
      257: "IBM u-Law",
      258: "IBM a-Law",
      259: "IBM ADPCM",
      273: "Vivo G.723",
      274: "Vivo Siren",
      288: "Philips Speech Processing CELP",
      289: "Philips Speech Processing GRUNDIG",
      291: "Digital G.723",
      293: "Sanyo LD ADPCM",
      304: "Sipro Lab ACEPLNET",
      305: "Sipro Lab ACELP4800",
      306: "Sipro Lab ACELP8V3",
      307: "Sipro Lab G.729",
      308: "Sipro Lab G.729A",
      309: "Sipro Lab Kelvin",
      310: "VoiceAge AMR",
      320: "Dictaphone G.726 ADPCM",
      336: "Qualcomm PureVoice",
      337: "Qualcomm HalfRate",
      341: "Ring Zero Systems TUBGSM",
      352: "Microsoft Audio1",
      353: "Windows Media Audio V2 V7 V8 V9 / DivX audio (WMA) / Alex AC3 Audio",
      354: "Windows Media Audio Professional V9",
      355: "Windows Media Audio Lossless V9",
      356: "WMA Pro over S/PDIF",
      368: "UNISYS NAP ADPCM",
      369: "UNISYS NAP ULAW",
      370: "UNISYS NAP ALAW",
      371: "UNISYS NAP 16K",
      372: "MM SYCOM ACM SYC008 SyCom Technologies",
      373: "MM SYCOM ACM SYC701 G726L SyCom Technologies",
      374: "MM SYCOM ACM SYC701 CELP54 SyCom Technologies",
      375: "MM SYCOM ACM SYC701 CELP68 SyCom Technologies",
      376: "Knowledge Adventure ADPCM",
      384: "Fraunhofer IIS MPEG2AAC",
      400: "Digital Theater Systems DTS DS",
      512: "Creative Labs ADPCM",
      514: "Creative Labs FASTSPEECH8",
      515: "Creative Labs FASTSPEECH10",
      528: "UHER ADPCM",
      533: "Ulead DV ACM",
      534: "Ulead DV ACM",
      544: "Quarterdeck Corp.",
      560: "I-Link VC",
      576: "Aureal Semiconductor Raw Sport",
      577: "ESST AC3",
      592: "Interactive Products HSX",
      593: "Interactive Products RPELP",
      608: "Consistent CS2",
      624: "Sony SCX",
      625: "Sony SCY",
      626: "Sony ATRAC3",
      627: "Sony SPC",
      640: "TELUM Telum Inc.",
      641: "TELUMIA Telum Inc.",
      645: "Norcom Voice Systems ADPCM",
      768: "Fujitsu FM TOWNS SND",
      769: "Fujitsu (not specified)",
      770: "Fujitsu (not specified)",
      771: "Fujitsu (not specified)",
      772: "Fujitsu (not specified)",
      773: "Fujitsu (not specified)",
      774: "Fujitsu (not specified)",
      775: "Fujitsu (not specified)",
      776: "Fujitsu (not specified)",
      848: "Micronas Semiconductors, Inc. Development",
      849: "Micronas Semiconductors, Inc. CELP833",
      1024: "Brooktree Digital",
      1025: "Intel Music Coder (IMC)",
      1026: "Ligos Indeo Audio",
      1104: "QDesign Music",
      1280: "On2 VP7 On2 Technologies",
      1281: "On2 VP6 On2 Technologies",
      1664: "AT&T VME VMPCM",
      1665: "AT&T TCP",
      1792: "YMPEG Alpha (dummy for MPEG-2 compressor)",
      2222: "ClearJump LiteWave (lossless)",
      4096: "Olivetti GSM",
      4097: "Olivetti ADPCM",
      4098: "Olivetti CELP",
      4099: "Olivetti SBC",
      4100: "Olivetti OPR",
      4352: "Lernout & Hauspie",
      4353: "Lernout & Hauspie CELP codec",
      4354: "Lernout & Hauspie SBC codec",
      4355: "Lernout & Hauspie SBC codec",
      4356: "Lernout & Hauspie SBC codec",
      5120: "Norris Comm. Inc.",
      5121: "ISIAudio",
      5376: "AT&T Soundspace Music Compression",
      6172: "VoxWare RT24 speech codec",
      6174: "Lucent elemedia AX24000P Music codec",
      6513: "Sonic Foundry LOSSLESS",
      6521: "Innings Telecom Inc. ADPCM",
      7175: "Lucent SX8300P speech codec",
      7180: "Lucent SX5363S G.723 compliant codec",
      7939: "CUseeMe DigiTalk (ex-Rocwell)",
      8132: "NCT Soft ALF2CD ACM",
      8192: "FAST Multimedia DVM",
      8193: "Dolby DTS (Digital Theater System)",
      8194: "RealAudio 1 / 2 14.4",
      8195: "RealAudio 1 / 2 28.8",
      8196: "RealAudio G2 / 8 Cook (low bitrate)",
      8197: "RealAudio 3 / 4 / 5 Music (DNET)",
      8198: "RealAudio 10 AAC (RAAC)",
      8199: "RealAudio 10 AAC+ (RACP)",
      9472: "Reserved range to 0x2600 Microsoft",
      13075: "makeAVIS (ffvfw fake AVI sound from AviSynth scripts)",
      16707: "Divio MPEG-4 AAC audio",
      16897: "Nokia adaptive multirate",
      16963: "Divio G726 Divio, Inc.",
      17228: "LEAD Speech",
      22092: "LEAD Vorbis",
      22358: "WavPack Audio",
      26447: "Ogg Vorbis (mode 1)",
      26448: "Ogg Vorbis (mode 2)",
      26449: "Ogg Vorbis (mode 3)",
      26479: "Ogg Vorbis (mode 1+)",
      26480: "Ogg Vorbis (mode 2+)",
      26481: "Ogg Vorbis (mode 3+)",
      28672: "3COM NBX 3Com Corporation",
      28781: "FAAD AAC",
      31265: "GSM-AMR (CBR, no SID)",
      31266: "GSM-AMR (VBR, including SID)",
      41216: "Comverse Infosys Ltd. G723 1",
      41217: "Comverse Infosys Ltd. AVQSBC",
      41218: "Comverse Infosys Ltd. OLDSBC",
      41219: "Symbol Technologies G729A",
      41220: "VoiceAge AMR WB VoiceAge Corporation",
      41221: "Ingenient Technologies Inc. G726",
      41222: "ISO/MPEG-4 advanced audio Coding",
      41223: "Encore Software Ltd G726",
      41225: "Speex ACM Codec xiph.org",
      57260: "DebugMode SonicFoundry Vegas FrameServer ACM Codec",
      61868: "Free Lossless Audio Codec FLAC",
      65534: "Extensible",
      65535: "Development"
    };
    WAVE_CHANNEL_MASK_LABELS = {
      1: "speaker_front_left",
      2: "speaker_front_right",
      4: "speaker_front_center",
      8: "speaker_low_frequency",
      16: "speaker_back_left",
      32: "speaker_back_right",
      64: "speaker_front_left_of_center",
      128: "speaker_front_right_of_center",
      256: "speaker_back_center",
      512: "speaker_side_left",
      1024: "speaker_side_right",
      2048: "speaker_top_center",
      4096: "speaker_top_front_left",
      8192: "speaker_top_front_center",
      16384: "speaker_top_front_right",
      32768: "speaker_top_back_left",
      65536: "speaker_top_back_center",
      131072: "speaker_top_back_right",
      2147483648: "speaker_all"
    };
    ROLAND_SP404SX_PADS = /* @__PURE__ */ rolandPads();
    AudioWAV = class extends data_buffer_default {
      /** The container type, `WAVE` or `AIFF`. */
      container;
      /** The file type, `WAVE` or `AIFF`. */
      type;
      /** The parsed chunks. */
      chunks;
      /** The options for the AudioWAV instance. */
      options;
      /** Recoverable structural and metadata errors from the most recent parse. */
      errors = [];
      /** The first decoded format and file-wide sample-count metadata. */
      #format;
      #fact;
      #common;
      #soundChunks = [];
      #ds64;
      #headerID = "";
      #dataSeen = 0;
      #sizeTable;
      #dataChunks = [];
      /** Report recoverable damage, or fail immediately when strict parsing is requested. */
      #issue(message, offset = this.offset) {
        if (this.options.strict) {
          throw new RangeError(`${message} (offset ${offset})`);
        }
        this.errors.push({ offset, message });
        debug2("Error Parsing:", message, "at offset", offset);
      }
      /** Combine unsigned 64-bit words only when JavaScript can represent the result exactly. */
      static #uint64(low, high) {
        const value = high * 4294967296 + low;
        if (!Number.isSafeInteger(value)) {
          throw new RangeError("64-bit chunk size or sample count exceeds Number.MAX_SAFE_INTEGER");
        }
        return value;
      }
      /** Restrict a standalone decoder to its declared payload, excluding padding and later chunks. */
      static #chunkBuffer(chunk, minimumSize, littleEndian3 = true) {
        const buffer = new data_buffer_default(typeof Buffer !== "undefined" && Buffer.isBuffer(chunk) ? new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength) : chunk);
        if (buffer.length < 8) {
          throw new RangeError("Truncated chunk header: expected 8 bytes");
        }
        const size = buffer.peekUInt32(4, littleEndian3);
        if (size < minimumSize || size > buffer.length - 8) {
          throw new RangeError(`Invalid chunk payload size: ${size}; minimum ${minimumSize}, available ${buffer.length - 8}`);
        }
        if (buffer.length !== size + 8) {
          buffer.data = buffer.data.subarray(0, size + 8);
          buffer.lengthInBytes = buffer.data.length;
        }
        return buffer;
      }
      /** Validate integer writer fields without allocating a temporary validation table. */
      static #unsigned(value, maximum, name) {
        if (!Number.isInteger(value) || value < 0 || value > maximum) {
          throw new RangeError(`Invalid ${name}: ${value}`);
        }
      }
      /** Check count-derived ranges before allocating objects or entering a loop. */
      static #countFits(count, width, available, name) {
        if (count > Math.floor(available / width)) {
          throw new RangeError(`Invalid ${name}: ${count} entries exceed ${available} bytes`);
        }
      }
      /** Remove AIFF block-fill bytes once COMM is known, even when COMM follows SSND. */
      #updateAiffSoundData() {
        const common = this.#common;
        if (!common) {
          if (this.#soundChunks.length) {
            this.#issue("AIFF sound data has no decoded COMM chunk", 12);
          }
          return;
        }
        if (!["", "NONE", "twos", "sowt", "fl32", "FL32", "fl64", "FL64"].includes(common.compressionType)) {
          return;
        }
        const size = common.sampleFrames * common.channels * Math.ceil(common.sampleSize / 8);
        if (!Number.isSafeInteger(size) || common.channels === 0 || common.sampleSize === 0) {
          this.#issue("Invalid AIFF sample-frame byte count", 12);
          return;
        }
        if (this.#soundChunks.length !== 1) {
          return;
        }
        const { value, offset } = this.#soundChunks[0];
        if (size > value.soundData.length) {
          this.#issue(`AIFF sound data has ${value.soundData.length} bytes; COMM requires ${size}`, offset);
        } else {
          value.soundData = value.soundData.subarray(0, size);
        }
      }
      /** Complete timing after all chunks, including metadata that follows the audio payload. */
      #updateDurations() {
        const format = this.#format;
        if (!format) {
          if (this.#dataChunks.length) {
            this.#issue("Audio data has no decoded fmt chunk", 12);
          }
          return;
        }
        const isPCM = format.audioFormatValue === 1 || format.audioFormatValue === 3 || format.audioFormatValue === 65534 && (format.subFormat_1 === 1 || format.subFormat_1 === 3) && format.subFormat_2 === 0 && format.subFormat_3 === 16 && format.subFormat_4 === 2852126848 && format.subFormat_5 === 1905997824;
        const byteRate = format.byteRate || (isPCM ? format.sampleRate * format.blockAlign : 0);
        for (const entry2 of this.#dataChunks) {
          let duration = 0;
          if (entry2.size === 0) {
            duration = 0;
          } else if (byteRate > 0) {
            duration = entry2.size / byteRate;
          } else {
            duration = Number.NaN;
          }
          entry2.value.duration = duration;
        }
        const entry = this.#dataChunks.length === 1 ? this.#dataChunks[0] : void 0;
        if (entry?.complete && entry.size > 0 && format.sampleRate > 0) {
          let samples;
          if (this.#ds64 && (this.#ds64.sampleCountLow || this.#ds64.sampleCountHigh)) {
            try {
              samples = _a.#uint64(this.#ds64.sampleCountLow, this.#ds64.sampleCountHigh);
            } catch (error) {
              this.#issue(error instanceof Error ? error.message : String(error));
            }
          } else if (!isPCM && this.#fact && this.#fact.numberOfSamples !== 4294967295) {
            samples = this.#fact.numberOfSamples;
          }
          if (samples !== void 0) {
            entry.value.duration = samples / format.sampleRate;
          }
        }
      }
      /**
       * Creates a new AudioWAV.
       * @param input The data to process.
       * @param opts Options for this AudioWAV instance.
       * @class
       */
      constructor(input, opts = {}) {
        super(input);
        this.container = "";
        this.type = "";
        this.chunks = [];
        this.options = {
          // This keeps in spec, some files fail with this.
          ...opts,
          roundOddChunks: opts.roundOddChunks ?? true,
          strict: opts.strict ?? false,
          maxResUSize: opts.maxResUSize ?? 16 * 1024 * 1024
        };
        if (!Number.isSafeInteger(this.options.maxResUSize) || this.options.maxResUSize < 0) {
          throw new RangeError("maxResUSize must be a nonnegative safe integer");
        }
        this.parse();
      }
      /**
       * Creates a new AudioWAV from file data.
       * @param data The data of the file to process.
       * @param options Options for returned AudioWAV instance.
       * @returns the new AudioWAV instance for the provided file data
       * @static
       */
      static fromFile(data, options = {}) {
        debug2("fromFile:", data.length, data.byteLength);
        return new _a(data, options);
      }
      /**
       * Creates a new AudioWAV from a DataBuffer.
       * @param buffer The DataBuffer of the file to process.
       * @param options Options for returned AudioWAV instance.
       * @returns the new AudioWAV instance for the provided DataBuffer
       * @static
       */
      static fromBuffer(buffer, options = {}) {
        debug2("fromBuffer:", buffer.length);
        return new _a(buffer, options);
      }
      /**
       * Parse the WAV file, decoding the supported chunks.
       */
      parse() {
        debug2("parse");
        this.seek(0);
        this.chunks.length = 0;
        this.errors.length = 0;
        this.container = "";
        this.type = "";
        this.#headerID = "";
        this.#common = void 0;
        this.#soundChunks.length = 0;
        this.#format = void 0;
        this.#fact = void 0;
        this.#ds64 = void 0;
        this.#dataSeen = 0;
        this.#sizeTable?.clear();
        this.#dataChunks.length = 0;
        if (this.remainingBytes() < 12) {
          throw new RangeError("Truncated file header: expected 12 bytes");
        }
        const chunk = this.read(12, false);
        const value = _a.decodeHeader(chunk);
        this.chunks.push({ type: "header", value });
        this.type = value.type;
        this.container = value.type;
        this.#headerID = value.chunkID;
        const extended = value.chunkID === "RF64" || value.chunkID === "BW64";
        if (!extended && value.size + 8 !== this.length) {
          this.#issue(`Container declares ${value.size + 8} bytes; input has ${this.length}`, 4);
        }
        if (extended && value.size !== 4294967295) {
          this.#issue("RF64 / BW64 header size must be 0xFFFFFFFF", 4);
        }
        while (this.remainingBytes()) {
          const offset = this.offset;
          try {
            this.decodeChunk();
          } catch (error) {
            if (this.options.strict) {
              throw error;
            }
            this.#issue(error instanceof Error ? error.message : String(error), offset);
          }
          if (this.offset <= offset) {
            this.#issue("Parser made no progress", offset);
            this.advance(this.remainingBytes());
          }
        }
        if (extended && !this.#ds64) {
          this.#issue("RF64 / BW64 file is missing ds64", 12);
        }
        this.#updateDurations();
        if (this.type === "AIFF") {
          this.#updateAiffSoundData();
        }
      }
      /**
       * Decodes and validates WAV Header.
       * Checks for `RIFF` / `RF64` / `BW64` header, reads the size, and then checks for the `WAVE` header.
       *
       * Signature (Decimal): [82, 73, 70, 70, ..., ..., ..., ..., 87, 65, 86, 69]
       * Signature (Hexadecimal): [52, 49, 46, 46, ..., ..., ..., ..., 57, 41, 56, 45]
       * Signature (ASCII): [R, I, F, F, ..., ..., ..., ..., W, A, V, E]
       * @param chunk The data to process.
       * @returns The decoded values.
       * @throws {Error} Invalid WAV header
       * @static
       */
      static decodeHeader(chunk) {
        debug2("decodeHeader");
        const header = new data_buffer_default(chunk);
        if (header.length < 12) {
          throw new RangeError("Truncated file header: expected 12 bytes");
        }
        const chunkID = header.readString(4);
        let type = "";
        if (["RIFF", "RF64", "BW64"].includes(chunkID)) {
          type = "WAVE";
        } else if (["FORM", "AIFF", "AIFC"].includes(chunkID)) {
          type = "AIFF";
        }
        if (!type) {
          throw new Error(`Invalid or unrecorgnized file header: '${chunkID}'`);
        }
        const size = header.readUInt32(type !== "AIFF");
        const format = header.readString(4);
        if (type === "WAVE" && format !== "WAVE") {
          throw new Error(`Invalid WAVE header, expected 'WAVE' and got '${format}'`);
        }
        if (type === "AIFF" && !["AIFF", "AIFC"].includes(format)) {
          throw new Error(`Invalid AIFF header, expected 'AIFF' or 'AIFC' and got '${format}'`);
        }
        return {
          chunkID,
          size,
          format,
          type
        };
      }
      /**
       * Enocdes JSON values to a valid Wave Header chunk Buffer.
       * @param data The values to encode to the header chunk chunk.
       * @param data.riff RIFF Header, should contains the string `RIFF`, `RF64`, or `BW64` in ASCII form.
       * @param data.size This is the size of the entire file in bytes minus 8 bytes for the 2 fields not included in this count. RF64 sets this to -1 = 0xFFFFFFFF as it doesn't use this to support larger sizes in the DS64 chunk.
       * @param data.format WAVE Header, the string `WAVE` in ASCII form.
       * @returns The newley encoded header chunk.
       * @static
       */
      static encodeHeader({ riff = "RIFF", size, format = "WAVE" }) {
        debug2("encodeHeader:", { riff, size, format });
        if (!/^[\x20-\x7e]{4}$/.test(riff) || !/^[\x20-\x7e]{4}$/.test(format)) {
          throw new TypeError("Header IDs must contain exactly four printable ASCII characters");
        }
        const encodedSize = size === -1 && (riff === "RF64" || riff === "BW64") ? 4294967295 : size;
        if (!Number.isInteger(encodedSize) || encodedSize < 0 || encodedSize > 4294967295) {
          throw new RangeError("Header size must be an unsigned 32-bit integer");
        }
        const header = Buffer.alloc(12);
        header.write(riff, 0, 4, "ascii");
        if (["FORM", "AIFF", "AIFC"].includes(riff)) {
          header.writeUInt32BE(encodedSize, 4);
        } else {
          header.writeUInt32LE(encodedSize, 4);
        }
        header.write(format, 8, 4, "ascii");
        return header;
      }
      /**
       * Decodes the chunk type, and attempts to parse that chunk if supported.
       * Supported Chunk Types: `fmt `, `fact`, `inst`, `DISP`, `smpl`, `tlst`, `data`, `LIST`, `RLND`, `JUNK`, `acid`, `cue `, `bext`, `ResU`, `ds64`, `cart`
       *
       * Chunk Structure:
       * Type:   4 bytes (string)
       * Length: 4 bytes (unsigned integer, excluding the alignment byte)
       * Chunk:  {length} bytes
       * @returns {string} Chunk Type
       * @throws {Error} Invalid chunk boundaries or metadata when strict parsing is enabled
       */
      decodeChunk() {
        debug2("decodeChunk at offset", this.offset, "with", this.remainingBytes(), "remaining bytes");
        const offset = this.offset;
        if (this.remainingBytes() < 8) {
          this.#issue("Truncated chunk header: expected 8 bytes", offset);
          this.chunks.push({
            type: "(broken)",
            chunk: this.read(this.remainingBytes(), false),
            unknown: true
          });
          return "(broken)";
        }
        let type = this.readString(4);
        debug2("decodeChunk type", type);
        const declaredSize = this.readUInt32(this.type !== "AIFF");
        let size = declaredSize;
        let resolved = true;
        debug2("decodeChunk size", size);
        const extended = this.#headerID === "RF64" || this.#headerID === "BW64";
        if (extended && offset === 12 && type !== "ds64") {
          this.#issue("ds64 must be the first RF64 / BW64 chunk", offset);
        }
        if (extended && size === 4294967295) {
          try {
            if (type === "data" && this.#dataSeen === 0 && this.#ds64) {
              size = _a.#uint64(this.#ds64.dataSizeLow, this.#ds64.dataSizeHigh);
            } else {
              const table = this.#sizeTable?.get(type);
              if (!table || table.next >= table.sizes.length) {
                throw new RangeError(`Missing ds64 size for '${type}'`);
              }
              size = table.sizes[table.next++];
            }
          } catch (error) {
            this.#issue(error instanceof Error ? error.message : String(error), offset);
            resolved = false;
            size = this.remainingBytes();
          }
        }
        if (type === "data") {
          this.#dataSeen++;
        }
        const complete = resolved && size <= this.remainingBytes();
        if (size > this.remainingBytes()) {
          this.#issue(`Chunk '${type}' declares ${size} payload bytes; only ${this.remainingBytes()} remain`, offset);
          size = this.remainingBytes();
        }
        let padding = this.options.roundOddChunks && size % 2 !== 0 ? 1 : 0;
        if (padding && size + padding > this.remainingBytes()) {
          this.#issue(`Missing alignment byte after '${type}'`, offset);
          padding = 0;
        }
        if (!/^[\x20-\x7e]{4}$/.test(type)) {
          this.#issue("Invalid chunk ID", offset);
          type = "(broken)";
          size = this.remainingBytes();
          padding = 0;
        }
        this.rewind(8);
        const chunk = this.read(8 + size + padding, false);
        let decodeBytes = chunk;
        if (extended && declaredSize === 4294967295 && size < 4294967295) {
          decodeBytes = Uint8Array.from(chunk);
          new DataView(decodeBytes.buffer, decodeBytes.byteOffset, decodeBytes.byteLength).setUint32(4, size, true);
        }
        switch (type) {
          case "fmt ": {
            const value = _a.decodeFMT(decodeBytes);
            this.#format ??= value;
            this.chunks.push({ type: "format", value, chunk });
            break;
          }
          case "fact": {
            const value = _a.decodeFACT(decodeBytes);
            this.#fact ??= value;
            this.chunks.push({ type: "fact", value, chunk });
            break;
          }
          case "inst": {
            const value = _a.decodeINST(decodeBytes);
            this.chunks.push({ type: "instrument", value, chunk });
            break;
          }
          case "DISP": {
            const value = _a.decodeDISP(decodeBytes);
            this.chunks.push({ type: "display", value, chunk });
            break;
          }
          case "smpl": {
            const value = _a.decodeSMPL(decodeBytes);
            this.chunks.push({ type: "sample", value, chunk });
            break;
          }
          case "tlst": {
            const value = _a.decodeTLST(decodeBytes);
            this.chunks.push({ type: "trigger_list", value, chunk });
            break;
          }
          case "data": {
            _a.decodeDATA(decodeBytes);
            let duration = 0;
            if (size === 0) {
              duration = 0;
            } else if (this.#format?.byteRate) {
              duration = size / this.#format.byteRate;
            } else {
              duration = Number.NaN;
            }
            const value = { duration };
            this.#dataChunks.push({ value, size, complete });
            this.chunks.push({ type: "data", chunk, value });
            break;
          }
          case "LIST": {
            const value = _a.decodeLIST(decodeBytes, this.options);
            this.chunks.push({ type: "list", value, chunk });
            break;
          }
          case "RLND": {
            const value = _a.decodeRLND(decodeBytes);
            this.chunks.push({ type: "roland", value, chunk });
            break;
          }
          case "JUNK": {
            _a.decodeJUNK(decodeBytes, this.options);
            this.chunks.push({ type: "junk", chunk });
            break;
          }
          case "PAD ": {
            _a.decodePAD(decodeBytes);
            this.chunks.push({ type: "padding", chunk });
            break;
          }
          case "PEAK": {
            const value = _a.decodePEAK(decodeBytes, this.type !== "AIFF");
            this.chunks.push({ type: "peak", value, chunk });
            break;
          }
          case "acid": {
            const value = _a.decodeACID(decodeBytes);
            this.chunks.push({ type: "acid", value, chunk });
            break;
          }
          case "strc": {
            const value = _a.decodeSTRC(decodeBytes);
            this.chunks.push({ type: "strc", value, chunk });
            break;
          }
          case "cue ": {
            const value = _a.decodeCue(decodeBytes);
            this.chunks.push({ type: "cue_points", value, chunk });
            break;
          }
          case "bext": {
            const value = _a.decodeBEXT(decodeBytes, this.options);
            this.chunks.push({ type: "broadcast_extension", value, chunk });
            break;
          }
          case "ResU": {
            const value = _a.decodeResU(decodeBytes, this.options);
            if (value.error) {
              this.#issue(value.error, offset);
            }
            this.chunks.push({ type: "logic_resu", value, chunk });
            break;
          }
          case "ds64": {
            const value = _a.decodeDS64(decodeBytes);
            this.chunks.push({ type: "data_size_64", value, chunk });
            if (extended) {
              if (this.#ds64) {
                this.#issue("Duplicate ds64 chunk", offset);
                break;
              }
              this.#ds64 = value;
              const riffSize = _a.#uint64(value.riffSizeLow, value.riffSizeHigh);
              if (!Number.isSafeInteger(riffSize + 8) || riffSize + 8 !== this.length) {
                this.#issue(`ds64 declares ${riffSize} RIFF payload bytes; input has ${this.length - 8}`, offset);
              }
              this.#sizeTable ??= /* @__PURE__ */ new Map();
              for (const entry of value.table) {
                const size2 = _a.#uint64(entry.chunkSizeLow, entry.chunkSizeHigh);
                let table = this.#sizeTable.get(entry.chunkID);
                if (!table) {
                  table = { sizes: [], next: 0 };
                  this.#sizeTable.set(entry.chunkID, table);
                }
                table.sizes.push(size2);
              }
            }
            break;
          }
          case "cart": {
            this.chunks.push({ type: "cart", chunk, unknown: true });
            break;
          }
          case "AFAn":
          case "AFmd": {
            debug2(`macOS Special Binary Chunk: '${type}' with ${size} bytes`);
            this.chunks.push({ type, chunk, description: "macOS Special Binary Chunk" });
            break;
          }
          case "minf":
          case "elm1":
          case "regn":
          case "ovwf":
          case "umid": {
            debug2(`ProTools Special Chunk: '${type}' with ${size} bytes`);
            this.chunks.push({ type, chunk, description: "ProTools Special Chunk" });
            break;
          }
          case "COMM": {
            const value = _a.decodeCOMM(decodeBytes);
            this.#common ??= value;
            this.chunks.push({ type: "common", value, chunk });
            break;
          }
          case "SSND": {
            const value = _a.decodeSSND(decodeBytes);
            this.#soundChunks.push({ value, offset });
            this.chunks.push({ type: "sound_data", value, chunk });
            break;
          }
          case "FVER": {
            const value = _a.decodeFVER(decodeBytes);
            this.chunks.push({ type: "format_version", value, chunk });
            break;
          }
          case "ANNO":
          case "AUTH":
          case "NAME": {
            const stream = _a.#chunkBuffer(decodeBytes, 0, this.type !== "AIFF");
            const chunkID = stream.readString(4);
            const nameSize = stream.readUInt32(this.type !== "AIFF");
            const name = nameSize ? stream.readString(nameSize) : "";
            const value = { chunkID, size: nameSize, name };
            debug2("decodeGenericText =", value);
            this.chunks.push({ type: chunkID.toLowerCase(), value, chunk });
            break;
          }
          default: {
            debug2(`Unsupported Chunk: '${type}' with ${size} bytes`);
            this.chunks.push({ type, chunk, unknown: true });
            break;
          }
        }
        return type;
      }
      /**
       * Decode the FMT (Format) chunk.
       * Should be the first chunk in the data stream.
       *
       * Audio Format:       2 bytes
       * Channels:           2 bytes
       * Sample Rate:        4 bytes
       * Byte Rate:          4 bytes
       * Block Align:        2 bytes
       * Bits per Sample     2 bytes
       * [Extra Param Size]  2 bytes
       * [Extra Params]      n bytes
       * @param chunk Data Blob
       * @returns The decoded values.
       * @static
       */
      static decodeFMT(chunk) {
        debug2("decodeFMT");
        const format = _a.#chunkBuffer(chunk, 16);
        const chunkID = format.readString(4);
        const size = format.readUInt32(true);
        const audioFormatValue = format.readUInt16(true);
        const audioFormat = WAVE_FORMAT_TAGS[audioFormatValue] ?? `Unknown: ${audioFormatValue.toString(16)}`;
        const channels = format.readUInt16(true);
        const sampleRate = format.readUInt32(true);
        const byteRate = format.readUInt32(true);
        const blockAlign = format.readUInt16(true);
        const bitsPerSample = format.readUInt16(true);
        const value = {
          chunkID,
          size,
          audioFormatValue,
          audioFormat,
          channels,
          sampleRate,
          byteRate,
          blockAlign,
          bitsPerSample
        };
        if (size > 16) {
          if (format.remainingBytes() < 2) {
            throw new RangeError("Truncated fmt extension size");
          }
          value.extraParamSize = format.readUInt16(true);
          if (value.extraParamSize > format.remainingBytes()) {
            throw new RangeError("Truncated fmt extension data");
          }
          if (audioFormatValue === 65534) {
            if (value.extraParamSize < 22) {
              throw new RangeError("Extensible fmt requires at least 22 extension bytes");
            }
            value.validBitsPerSample = format.readUInt16(true);
            value.channelMask = format.readUInt32(true);
            value.channelMaskLabel = WAVE_CHANNEL_MASK_LABELS[value.channelMask];
            if (value.channelMaskLabel === void 0) {
              debug2("Unknown Channel Mask:", value.channelMask);
              const labels = Object.entries(WAVE_CHANNEL_MASK_LABELS).filter(([mask]) => (value.channelMask & Number(mask)) !== 0).map(([, label]) => label);
              const unknown = (value.channelMask & ~2147745791) >>> 0;
              if (unknown) {
                labels.push(`unknown_${unknown}`);
              }
              value.channelMaskLabel = labels.length ? labels.join(" | ") : "unspecified";
            }
            value.subFormat_1 = format.readUInt32(true);
            value.subFormat_2 = format.readUInt16(true);
            value.subFormat_3 = format.readUInt16(true);
            value.subFormat_4 = format.readUInt32(true);
            value.subFormat_5 = format.readUInt32(true);
            if (value.extraParamSize > 22) {
              value.extraParams = format.read(value.extraParamSize - 22, false);
            }
          } else if (value.extraParamSize > 0) {
            value.extraParams = format.read(value.extraParamSize, false);
          } else {
            value.extraParams = new Uint8Array();
          }
        }
        if (audioFormatValue === 65534 && value.extraParamSize === void 0) {
          throw new RangeError("Extensible fmt is missing its extension");
        }
        debug2("decodeFMT =", value);
        return value;
      }
      /**
       * Enocdes JSON values to a valid `fmt ` chunk Buffer.
       *
       * Defaults are set to Red Book Compact Disc Digital Audio (CDDA or CD-DA) / Audio CD standards.
       *
       * Extensible format fields can be supplied as a complete binary extraParams block (at least 22 bytes).
       * @param data The values to encode to the `fmt ` chunk.
       * @param data.audioFormatValue Format of the audio data, 1 is PCM and values other than 1 indicate some form of compression. See `decodeFMT` for a listing
       * @param data.channels Mono = 1, Stereo = 2, etc.
       * @param data.sampleRate 8000, 44100, 96000, etc.
       * @param data.byteRate Sample Rate * Channels * Bits per Sample / 8
       * @param data.blockAlign The number of bytes for one sample including all channels. Channels * Bits per Sample / 8
       * @param data.bitsPerSample 8 bits = 8, 16 bits = 16, etc.
       * @param data.extraParamSize The size of the extra paramteres to follow, or 0.
       * @param data.extraParams Any extra data to encode. Byte arrays are copied verbatim; strings and legacy numeric values are encoded as UTF-8 text.
       * @returns The newley encoded `fmt ` chunk.
       * @static
       */
      static encodeFMT(data = {}) {
        debug2("encodeFMT:", data);
        const { audioFormatValue = 1, channels = 2, sampleRate = 44100, bitsPerSample = 16, blockAlign = channels * Math.ceil(bitsPerSample / 8), byteRate = sampleRate * blockAlign, extraParams = 0 } = data;
        let params;
        if (extraParams instanceof Uint8Array) {
          params = extraParams;
        } else if (Array.isArray(extraParams)) {
          params = Uint8Array.from(extraParams);
        } else if (extraParams === 0) {
          params = void 0;
        } else {
          params = new TextEncoder().encode(String(extraParams));
        }
        if (Array.isArray(extraParams) && Array.from(extraParams).some((byte) => !Number.isInteger(byte) || byte < 0 || byte > 255)) {
          throw new RangeError("extraParams must contain unsigned bytes");
        }
        const extraParamSize = data.extraParamSize ?? params?.length ?? 0;
        _a.#unsigned(audioFormatValue, 65535, "audioFormatValue");
        _a.#unsigned(channels, 65535, "channels");
        _a.#unsigned(sampleRate, 4294967295, "sampleRate");
        _a.#unsigned(byteRate, 4294967295, "byteRate");
        _a.#unsigned(blockAlign, 65535, "blockAlign");
        _a.#unsigned(bitsPerSample, 65535, "bitsPerSample");
        _a.#unsigned(extraParamSize, 65535, "extraParamSize");
        if (params && params.length > extraParamSize) {
          throw new RangeError("extraParams exceeds extraParamSize");
        }
        if (audioFormatValue === 65534 && extraParamSize < 22) {
          throw new RangeError("Extensible fmt requires at least 22 extension bytes");
        }
        const buffer = Buffer.alloc(26 + extraParamSize + extraParamSize % 2, 0);
        buffer.write("fmt ", 0);
        buffer.writeUInt32LE(26 - 8 + extraParamSize, 4);
        buffer.writeUInt16LE(audioFormatValue, 8);
        buffer.writeUInt16LE(channels, 10);
        buffer.writeUInt32LE(sampleRate, 12);
        buffer.writeUInt32LE(byteRate, 16);
        buffer.writeUInt16LE(blockAlign, 20);
        buffer.writeUInt16LE(bitsPerSample, 22);
        buffer.writeUInt16LE(extraParamSize, 24);
        if (params && params.length > 0) {
          buffer.set(params, 26);
        }
        debug2("Buffer:", buffer);
        return buffer;
      }
      /**
       * Decode the LIST (LIST Information) chunk.
       *
       * A LIST chunk defines a list of sub-chunks and has the following format.
       * @param chunk Data Blob
       * @param options Nested chunk alignment options.
       * @returns The decoded values.
       * @static
       */
      static decodeLIST(chunk, options = {}) {
        debug2("decodeLIST");
        const list = _a.#chunkBuffer(chunk, 4);
        const chunkID = list.readString(4);
        const size = list.readUInt32(true);
        const type = list.readString(4);
        const value = {
          chunkID,
          size,
          type
        };
        switch (type) {
          case "INFO": {
            value.data = _a.decodeLISTINFO(list, options);
            break;
          }
          case "adtl": {
            value.data = _a.decodeLISTadtl(list, options);
            break;
          }
          default: {
            debug2(`Unknown LIST Type: ${type}`);
          }
        }
        debug2("decodeLIST =", value);
        return value;
      }
      /**
       * Decode the LIST INFO chunks.
       * @param buffer List DataBuffer
       * @param options Nested chunk alignment options.
       * @returns The parsed list.
       */
      static decodeLISTINFO(buffer, options = {}) {
        debug2("decodeLISTINFO");
        const value = [];
        while (buffer.remainingBytes()) {
          if (buffer.remainingBytes() < 8) {
            throw new RangeError("Truncated LIST INFO sub-chunk header");
          }
          const info = { id: "", size: 0, text: "" };
          info.id = buffer.readString(4);
          debug2("decodeLISTINFO chunk id:", info.id);
          info.size = buffer.readUInt32(true);
          debug2("decodeLISTINFO chunk size:", info.size);
          if (info.size > buffer.remainingBytes()) {
            throw new RangeError("Truncated LIST INFO text");
          }
          info.text = info.size ? buffer.readString(info.size) : "";
          debug2("decodeLISTINFO chunk text:", info.text);
          if ((options.roundOddChunks ?? true) && info.size % 2 !== 0) {
            if (!buffer.remainingBytes()) {
              throw new RangeError("Missing LIST INFO alignment byte");
            }
            buffer.advance(1);
          }
          value.push(info);
        }
        return value;
      }
      /**
       * Decode the LIST adtl chunks.
       * @param buffer List DataBuffer
       * @param options Nested chunk alignment options.
       * @returns The parsed list.
       */
      static decodeLISTadtl(buffer, options = {}) {
        debug2("decodeLISTadtl");
        const value = [];
        while (buffer.remainingBytes()) {
          if (buffer.remainingBytes() < 8) {
            throw new RangeError("Truncated LIST adtl sub-chunk header");
          }
          const adtl = { id: "", size: 0, label: void 0, ltxt: void 0 };
          adtl.id = buffer.readString(4);
          adtl.size = buffer.readUInt32(true);
          if (adtl.size > buffer.remainingBytes()) {
            throw new RangeError("Truncated LIST adtl payload");
          }
          const end = buffer.offset + adtl.size;
          switch (adtl.id) {
            case "labl":
            case "note": {
              if (adtl.size < 4) {
                throw new RangeError("LIST label / note requires a cue point ID");
              }
              adtl.cuePointID = buffer.readUInt32(true);
              const text = adtl.size > 4 ? buffer.readString(adtl.size - 4).replace(/\0.*$/s, "") : "";
              if (adtl.id === "labl") {
                adtl.label = text;
              } else {
                adtl.note = text;
              }
              break;
            }
            case "ltxt": {
              if (adtl.size < 20) {
                throw new RangeError("LIST ltxt requires a 20-byte header");
              }
              adtl.cuePointID = buffer.readUInt32(true);
              adtl.sampleLength = buffer.readUInt32(true);
              adtl.purposeID = buffer.readString(4);
              adtl.country = buffer.readUInt16(true);
              adtl.language = buffer.readUInt16(true);
              adtl.dialect = buffer.readUInt16(true);
              adtl.codePage = buffer.readUInt16(true);
              adtl.ltxt = adtl.size > 20 ? buffer.readString(adtl.size - 20).replace(/\0.*$/s, "") : "";
              break;
            }
            default: {
              debug2(`Unknown ID: ${adtl.id}`);
              buffer.advance(adtl.size);
            }
          }
          buffer.seek(end);
          if ((options.roundOddChunks ?? true) && adtl.size % 2 !== 0) {
            if (!buffer.remainingBytes()) {
              throw new RangeError("Missing LIST adtl alignment byte");
            }
            buffer.advance(1);
          }
          value.push(adtl);
        }
        return value;
      }
      /**
       * Decode the data (Audio Data) chunk.
       * @param chunk Data Blob
       * @static
       */
      static decodeDATA(chunk) {
        debug2(`decodeDATA: ${chunk.length} data bytes`);
      }
      /**
       * Decode the `tlst` (Trigger List) chunk.
       *
       * Used in Sound Forge by Sonic Foundry
       *
       * Specifies a list of triggers which can be used to trigger playback of a series of cue points or Playlist entries.
       *
       * There's a historical bug in dwName (which is in fact an index, and the bug is that it's actually Index-1).
       * @param chunk Data Blob
       * @returns The decoded values.
       * @static
       */
      static decodeTLST(chunk) {
        debug2("decodeTLST");
        const tlst = _a.#chunkBuffer(chunk, 24);
        const _chunkID = tlst.readString(4);
        const size = tlst.readUInt32(true);
        debug2("decodeTLST size", size);
        const list = tlst.readUInt32(true);
        const name = tlst.readString(4);
        const type = tlst.readUInt32(true);
        const triggerOn1 = tlst.readUInt8();
        const triggerOn2 = tlst.readUInt8();
        const triggerOn3 = tlst.readUInt8();
        const triggerOn4 = tlst.readUInt8();
        const func = tlst.readUInt32(true);
        const extra = tlst.readUInt32(true);
        if (extra > tlst.remainingBytes()) {
          throw new RangeError("Truncated tlst extra data");
        }
        const extraDataBytes = extra ? tlst.read(extra, false) : new Uint8Array();
        let extraData = 0;
        if (extra >= 4) {
          extraData = new DataView(extraDataBytes.buffer, extraDataBytes.byteOffset, extraDataBytes.byteLength).getUint32(0, true);
        } else if (extra === 0 && tlst.remainingBytes() >= 4) {
          extraData = tlst.readUInt32(true);
        }
        const value = {
          list: list.toString(),
          name,
          type,
          triggerOn1,
          triggerOn2,
          triggerOn3,
          triggerOn4,
          extra,
          extraData,
          function: func
        };
        if (extra) {
          value.extraDataBytes = extraDataBytes;
        }
        debug2("decodeTLST =", value);
        return value;
      }
      /**
       * Decode the fact chunk.
       *
       * Fact chunks exist in all wave files that are compressed or that have a wave list chunk.
       * A fact chunk is not required in an uncompressed PCM file that does not have a wave list chunk.
       *
       * According to the fact chunk's initial specification, the data portion of the fact chunk will contain only one 4-byte number that specifies the number of samples in the data chunk of the Wave file.
       * This number, when combined with the samples per second value in the format chunk of the Wave file, can be used to compute the length of the audio data in seconds.
       * @param chunk Data Blob
       * @returns The decoded values.
       * @static
       * @see {@link https://www.recordingblogs.com/wiki/fact-chunk-of-a-wave-file | Fact chunk (of a Wave file)}
       * @see {@link http://www-mmsp.ece.mcgill.ca/Documents/AudioFormats/WAVE/WAVE.html | Audio File Format Specifications}
       */
      static decodeFACT(chunk) {
        debug2("decodeFACT");
        const fact = _a.#chunkBuffer(chunk, 4);
        const _chunkID = fact.readString(4);
        const size = fact.readUInt32(true);
        debug2("decodeFACT size", size);
        const numberOfSamples = fact.readUInt32(true);
        const value = { numberOfSamples };
        debug2("decodeFACT =", value);
        return value;
      }
      // Per-channel entries are decoded below; reference: https://github.com/libsndfile/libsndfile/blob/08d802a3d18fa19c74f38ed910d9e33f80248187/src/aiff.c#L110
      /**
       * Decode the PEAK chunk.
       * @param chunk Data Blob
       * @param littleEndian True for WAVE, false for AIFF.
       * @returns The decoded values.
       * @static
       * @see {@link https://code.google.com/archive/p/awesome-wav/wikis/WAVFormat.wiki|awesome-wav - WAVFormat.wiki}
       */
      static decodePEAK(chunk, littleEndian3 = true) {
        debug2("decodePEAK");
        const peak = _a.#chunkBuffer(chunk, 8, littleEndian3);
        const _chunkID = peak.readString(4);
        const size = peak.readUInt32(littleEndian3);
        debug2("decodePEAK size", size);
        const version = peak.readUInt32(littleEndian3);
        const timestamp = peak.readUInt32(littleEndian3);
        if ((size - 8) % 8 !== 0) {
          throw new RangeError("Incomplete PEAK channel entry");
        }
        const peaks = [];
        let ppeakPointer = 0;
        let bitAlign = 0;
        while (peak.remainingBytes()) {
          const rawValue = peak.readUInt32(littleEndian3);
          peak.rewind(4);
          const amplitude = peak.readFloat32(littleEndian3);
          const position = peak.readUInt32(littleEndian3);
          if (!peaks.length) {
            ppeakPointer = rawValue;
            bitAlign = position;
          }
          peaks.push({ value: amplitude, position });
        }
        const value = {
          version,
          timestamp,
          ppeakPointer,
          bitAlign,
          peaks
        };
        debug2("decodePEAK =", value);
        return value;
      }
      /**
       * Decode the DISP (Display) chunk.
       *
       * The DISP chunk should be used as a direct child of the RIFF chunk so that any RIFF aware application can find it.
       * There can be multiple DISP chunks with each containing different types of displayable data, but all representative of the same object.
       * The DISP chunks should be stored in the file in order of preference (just as in the clipboard).
       *
       * The DISP chunk is especially beneficial when representing OLE data within an application.
       * For example, when pasting a wave file into Excel, the creating application can use the DISP chunk to associate an icon and a text description to represent the embedded wave file.
       * This text should be short so that it can be easily displayed in menu bars and under icons.
       * Note: do not use a CF_TEXT for a description of the data.
       * Bibliographic data chunks will be added to support the standard MARC (Machine Readable Cataloging) data.
       * @param chunk Data Blob
       * @returns The decoded values.
       * @static
       * @see {@link http://netghost.narod.ru/gff/vendspec/micriff/ms_riff.txt|New Multimedia Data Types and Data Techniques}
       * @see {@link https://docs.microsoft.com/en-us/windows/win32/dataxchg/standard-clipboard-formats|Standard Clipboard Formats}
       */
      static decodeDISP(chunk) {
        debug2("decodeDISP");
        const disp = _a.#chunkBuffer(chunk, 4);
        const _chunkID = disp.readString(4);
        const size = disp.readUInt32(true);
        debug2("decodeDISP size", size);
        const type = disp.readUInt32(true);
        const rawData = size > 4 ? disp.read(size - 4, false) : new Uint8Array();
        const data = (rawData[0] ?? 0) | (rawData[1] ?? 0) << 8;
        const value = { type, data, rawData };
        if (type === 1) {
          value.text = new TextDecoder("windows-1252").decode(rawData).replace(/\0.*$/s, "");
        } else if (type === 13) {
          value.text = new TextDecoder("utf-16le").decode(rawData).replace(/\0.*$/s, "");
        }
        debug2("decodeDISP =", value);
        return value;
      }
      /**
       *  ACID Loop File Format
       *
       *  They were originally created for use with Acid, the loop-based, music-sequencing software, created by Sonic Foundry in 1998.
       *
       *  "Acidized" loops contain tempo and key information, so that Acid and other programs that can read the "acidization" can properly time stretch and pitch shift them.
       *
       *  Although the phrase "ACID loops" technically only refers to loops which have been "acidized", some people use the term to refer to loops in general, even when used with other software packages.
       * @static
       * @param chunk Data Blob
       * @returns The decoded values.
       * @memberof AudioWAV
       */
      static decodeACID(chunk) {
        debug2("decodeACID");
        const acid = _a.#chunkBuffer(chunk, 24);
        const _chunkID = acid.readString(4);
        const size = acid.readUInt32(true);
        debug2("decodeACID size", size);
        const type = acid.readUInt32(true);
        const rootNote = acid.readUInt16(true);
        const unknown1 = acid.readUInt16(true);
        const unknown2 = acid.readFloat32(true);
        const beats = acid.readUInt32(true);
        const meterDenominator = acid.readUInt16(true);
        const meterNumerator = acid.readUInt16(true);
        const tempo = acid.readFloat32(true);
        const value = {
          type,
          rootNote,
          unknown1,
          unknown2,
          beats,
          meterDenominator,
          meterNumerator,
          tempo
        };
        debug2("decodeACID =", value);
        return value;
      }
      /**
       * Decode the inst (Instrumet) chunk.
       *
       * When a wave file is used as wave samples in a MIDI synthesizer,
       * the instrument chunk helps the MIDI synthesizer define the sample pitch & relative volume of the samples.
       * @param chunk Data Blob
       * @returns The decoded values.
       * @static
       */
      static decodeINST(chunk) {
        debug2("decodeINST");
        const inst = _a.#chunkBuffer(chunk, 7);
        const _chunkID = inst.readString(4);
        const size = inst.readUInt32(true);
        debug2("decodeINST size", size);
        const unshiftedNote = inst.readUInt8();
        const fineTuning = inst.readInt8();
        const gain = inst.readInt8();
        const lowNote = inst.readUInt8();
        const highNote = inst.readUInt8();
        const lowVelocity = inst.readUInt8();
        const highVelocity = inst.readUInt8();
        const value = {
          unshiftedNote,
          fineTuning,
          gain,
          lowNote,
          highNote,
          lowVelocity,
          highVelocity
        };
        debug2("decodeINST =", value);
        return value;
      }
      /**
       * Decode the smpl (Sample) chunk.
       *
       * The sample chunk allows a MIDI sampler to use the Wave file as a collection of samples.
       * @param chunk Data Blob
       * @returns The decoded values.
       * @static
       */
      static decodeSMPL(chunk) {
        debug2("decodeSMPL");
        const smpl = _a.#chunkBuffer(chunk, 36);
        const _chunkID = smpl.readString(4);
        const size = smpl.readUInt32(true);
        debug2("decodeSMPL size", size);
        const manufacturer1 = smpl.readUInt8();
        const manufacturer2 = smpl.readUInt8();
        const manufacturer3 = smpl.readUInt8();
        const manufacturer4 = smpl.readUInt8();
        const product = smpl.readUInt32(true);
        const samplePeriod = smpl.readUInt32(true);
        const midiUnityNote = smpl.readUInt32(true);
        const midiPitchFraction = smpl.readUInt32(true);
        const SMPTEFormat = smpl.readUInt32(true);
        const SMPTEOffset = smpl.readUInt32(true);
        const SMPTEOffset1 = SMPTEOffset >> 24;
        const SMPTEOffset2 = SMPTEOffset >>> 16 & 255;
        const SMPTEOffset3 = SMPTEOffset >>> 8 & 255;
        const SMPTEOffset4 = SMPTEOffset & 255;
        const sampleLoopsCount = smpl.readUInt32(true);
        const sampleDataSize = smpl.readUInt32(true);
        if (sampleDataSize > smpl.remainingBytes()) {
          throw new RangeError("Truncated sampler-specific data");
        }
        _a.#countFits(sampleLoopsCount, 24, smpl.remainingBytes() - sampleDataSize, "sample loop count");
        const sampleLoops = [];
        if (sampleLoopsCount > 0) {
          debug2("decodeSMPL sampleLoopsCount", sampleLoopsCount);
          for (let i = 0; i < sampleLoopsCount; i++) {
            const ID = smpl.readUInt32(true);
            const type = smpl.readUInt32(true);
            const start = smpl.readUInt32(true);
            const end = smpl.readUInt32(true);
            const fraction = smpl.readUInt32(true);
            const count = smpl.readUInt32(true);
            sampleLoops.push({
              ID,
              type,
              start,
              end,
              fraction,
              count
            });
          }
        }
        let sampleData = new Uint8Array();
        if (sampleDataSize > 0) {
          sampleData = smpl.read(sampleDataSize, false);
        }
        const value = {
          manufacturer1,
          manufacturer2,
          manufacturer3,
          manufacturer4,
          product,
          samplePeriod,
          midiUnityNote,
          midiPitchFraction,
          SMPTEFormat,
          SMPTEOffset1,
          SMPTEOffset2,
          SMPTEOffset3,
          SMPTEOffset4,
          sampleLoopsCount,
          sampleDataSize,
          sampleLoops,
          sampleData
        };
        debug2("decodeSMPL =", value);
        return value;
      }
      /**
       * Decode the RLND (Roland) chunk.
       *
       * Useful for use on SP-404 / SP-404SX / SP-404A samplers, perhaps others.
       *
       * This chunk is sized and padded with zeros to ensure that the the sample data starts exactly at offset 512.
       * @param chunk Data Blob
       * @returns The decoded values.
       * @static
       */
      static decodeRLND(chunk) {
        debug2("decodeRLND");
        const roland = _a.#chunkBuffer(chunk, 13);
        const chunkID = roland.readString(4);
        const size = roland.readUInt32(true);
        const device = roland.readString(8);
        const unknown1 = roland.readUInt8();
        const unknown2 = roland.readUInt8();
        const unknown3 = roland.readUInt8();
        const unknown4 = roland.readUInt8();
        const sampleIndex = roland.readUInt8();
        let sampleLabel = "";
        if (device === "roifspsx") {
          const label = ROLAND_SP404SX_PADS[sampleIndex];
          if (label === void 0) {
            debug2("Unknown Pad:", sampleIndex);
          } else {
            sampleLabel = label;
          }
        }
        const value = {
          chunkID,
          size,
          device,
          unknown1,
          unknown2,
          unknown3,
          unknown4,
          sampleIndex,
          sampleLabel
        };
        debug2("decodeRLND =", value);
        return value;
      }
      /**
       * Enocdes JSON values to a valid `RLND` (Roland) chunk Buffer.
       *
       * Useful for use on SP-404 / SP-404SX / SP-404A samplers, perhaps others.
       *
       * The unknown value may be an unsigned 32bit integer.
       *
       * This chunk is sized and padded with zeros to ensure that the the sample data starts exactly at offset 512.
       * @static
       * @param data The JSON values to set in the RLND chunk.
       * @param data.device An 8 character string representing the device label. SP-404SX Wave Converter v1.01 on macOS sets this value to `roifspsx`.
       * @param data.unknown1 Unknown, SP-404SX Wave Converter v1.01 on macOS sets this value to `0x04`.
       * @param data.unknown2 Unknown, SP-404SX Wave Converter v1.01 on macOS sets this value to `0x00`.
       * @param data.unknown3 Unknown, SP-404SX Wave Converter v1.01 on macOS sets this value to `0x00`.
       * @param data.unknown4 Unknown, SP-404SX Wave Converter v1.01 on macOS sets this value to `0x00`.
       * @param data.sampleIndex The pad the sample plays on, between `0` and `119` as a number or the pad label, `A1` - `J12`. Only the SP404SX (device === `roifspsx`) provided values can be converted from string corrently, and if it is not found it will defailt to `0` / `A1`.
       * @returns The new RLND chunk.
       * @static
       * @see {@link https://www.roland.com/global/support/by_product/sp-404sx/updates_drivers/|SP-404SX Support Page}
       */
      static encodeRLND(data) {
        const { device, unknown1, unknown2, unknown3, unknown4 } = data;
        for (const value of [unknown1 ?? 4, unknown2 ?? 0, unknown3 ?? 0, unknown4 ?? 0]) {
          if (!Number.isInteger(value) || value < 0 || value > 255) {
            throw new RangeError("Invalid Roland parameter byte");
          }
        }
        let { sampleIndex = 0 } = data;
        if (!/^[\x20-\x7e]{1,8}$/.test(device)) {
          throw new TypeError("Roland device must contain one to eight printable ASCII characters");
        }
        debug2("encodeRLND:", device, unknown1, unknown2, unknown3, unknown4, sampleIndex);
        const buffer = Buffer.alloc(466, 0);
        buffer.write("RLND", 0);
        buffer.writeUInt32LE(458, 4);
        buffer.write(device, 8, 8, "ascii");
        buffer.writeUInt8(unknown1 ?? 4, 16);
        buffer.writeUInt8(unknown2 ?? 0, 17);
        buffer.writeUInt8(unknown3 ?? 0, 18);
        buffer.writeUInt8(unknown4 ?? 0, 19);
        if (device === "roifspsx" && typeof sampleIndex === "string") {
          const index2 = ROLAND_SP404SX_PADS.indexOf(sampleIndex.toUpperCase());
          if (index2 === -1) {
            debug2("Unknown Pad:", sampleIndex);
            sampleIndex = 0;
          } else {
            sampleIndex = index2;
          }
        }
        const index = Number(sampleIndex);
        if (!Number.isInteger(index) || index < 0 || index > 255) {
          throw new RangeError("Invalid Roland sample index");
        }
        buffer.writeUInt8(index, 20);
        debug2("Buffer:", buffer);
        return buffer;
      }
      /**
       * Decode the JUNK (Padding) chunk.
       *
       * To align RIFF chunks to certain boundaries (i.e. 2048 bytes for CD-ROMs) the RIFF specification includes a JUNK chunk.
       * The contents are to be skipped when reading.
       * When writing RIFFs, JUNK chunks should not have an odd Size.
       * @param chunk Data Blob
       * @param options Decoding options.
       * @param options.roundOddChunks When true we will round odd chunk sizes up to keep in spec.
       * @static
       */
      static decodeJUNK(chunk, options = {}) {
        const junk = new data_buffer_default(chunk);
        const chunkID = junk.readString(4);
        let size = junk.readUInt32(true);
        if (options.roundOddChunks && size % 2 !== 0) {
          size += 1;
        }
        debug2(`decodeJUNK: ${chunk.length} bytes, chunkID: ${chunkID}, junk size: ${size}`);
      }
      /**
       * Decode the `PAD ` (Padding) chunk.
       * @param chunk Data Blob
       * @static
       */
      static decodePAD(chunk) {
        const pad = new data_buffer_default(chunk);
        const chunkID = pad.readString(4);
        const size = pad.readUInt32(true);
        debug2(`decodePAD: ${chunk.length} bytes, chunkID: ${chunkID}, pad size: ${size}`);
      }
      /**
       * Decode the bext (Broadcast Wave Format (BWF) Broadcast Extension) chunk.
       * @param {string|Buffer|Uint8Array} chunk Data Blob
       * @param options Decoding options.
       * @param options.roundOddChunks Retained for API compatibility; alignment is handled by the container, not included in the decoded size.
       * @returns The decoded values.
       * @static
       * @see {@link https://sites.google.com/site/musicgapi/technical-documents/wav-file-format#cue|Cue Chunk}
       * @see {@link https://tech.ebu.ch/docs/tech/tech3285.pdf|Spec}
       */
      static decodeBEXT(chunk, options = {}) {
        debug2("decodeBEXT");
        const bext = _a.#chunkBuffer(chunk, 602);
        const chunkID = bext.readString(4);
        const size = bext.readUInt32(true);
        debug2("decodeBEXT roundOddChunks:", options.roundOddChunks);
        const value = {
          chunkID,
          size,
          description: "",
          originator: "",
          originatorReference: "",
          originationDate: "",
          originationTime: "",
          timeReferenceLow: 0,
          timeReferenceHigh: 0,
          version: 0,
          umid: new Uint8Array(),
          loudnessValue: 0,
          loudnessRange: 0,
          maxTruePeakLevel: 0,
          maxMomentaryLoudness: 0,
          maxShortTermLoudness: 0,
          reserved: new Uint8Array(),
          codingHistory: new Uint8Array()
        };
        value.description = bext.readString(256);
        value.originator = bext.readString(32);
        value.originatorReference = bext.readString(32);
        value.originationDate = bext.readString(10);
        value.originationTime = bext.readString(8);
        value.timeReferenceLow = bext.readUInt32(true);
        value.timeReferenceHigh = bext.readUInt32(true);
        value.version = bext.readUInt16(true);
        if (value.version >= 1) {
          value.umid = bext.read(64, false);
        }
        if (value.version >= 2) {
          value.loudnessValue = bext.readInt16(true);
        }
        if (value.version >= 2) {
          value.loudnessRange = bext.readInt16(true);
        }
        if (value.version >= 2) {
          value.maxTruePeakLevel = bext.readInt16(true);
        }
        if (value.version >= 2) {
          value.maxMomentaryLoudness = bext.readInt16(true);
        }
        if (value.version >= 2) {
          value.maxShortTermLoudness = bext.readInt16(true);
        }
        let reservedSize = 0;
        if (value.version >= 2) {
          reservedSize = 180;
        } else if (value.version === 1) {
          reservedSize = 190;
        } else {
          reservedSize = 254;
        }
        value.reserved = bext.read(reservedSize, false);
        value.codingHistory = bext.remainingBytes() ? bext.read(bext.remainingBytes(), false) : new Uint8Array();
        debug2("decodeBEXT =", value);
        return value;
      }
      /**
       * Decode the 'cue ' (Cue Points) chunk.
       *
       * A cue chunk specifies one or more sample offsets which are often used to mark noteworthy sections of audio.
       * For example, the beginning and end of a verse in a song may have cue points to make them easier to find.
       * The cue chunk is optional and if included, a single cue chunk should specify all cue points for the "WAVE" chunk.
       * No more than one cue chunk is allowed in a "WAVE" chunk.
       * @param chunk Data Blob
       * @returns The decoded values.
       * @static
       * @see {@link https://sites.google.com/site/musicgapi/technical-documents/wav-file-format#cue|Cue Chunk}
       */
      static decodeCue(chunk) {
        debug2("decodeCue");
        const cue = _a.#chunkBuffer(chunk, 4);
        const chunkID = cue.readString(4);
        const size = cue.readUInt32(true);
        debug2("decodeCue size", size);
        const numberCuePoints = cue.readUInt32(true);
        debug2("decodeCue numberCuePoints", numberCuePoints);
        _a.#countFits(numberCuePoints, 24, cue.remainingBytes(), "cue point count");
        const value = {
          chunkID,
          size,
          numberCuePoints,
          data: []
        };
        for (let i = 0; i < numberCuePoints; i++) {
          const point = {
            id: 0,
            position: 0,
            chunkID: "",
            chunkStart: 0,
            blockStart: 0,
            sampleOffset: 0
          };
          point.id = cue.readUInt32(true);
          point.position = cue.readUInt32(true);
          point.chunkID = cue.readString(4);
          point.chunkStart = cue.readUInt32(true);
          point.blockStart = cue.readUInt32(true);
          point.sampleOffset = cue.readUInt32(true);
          value.data.push(point);
        }
        if (cue.remainingBytes() > 0) {
          debug2(`Unexpected ${cue.remainingBytes()} bytes remaining`);
        }
        debug2("decodeCue =", value);
        return value;
      }
      /**
       * Decode the 'ResU' chunk, zlib-compressed JSON data containing Time Signature, Tempo and other data for Logic Pro X.
       * @param chunk Data Blob
       * @param options Decompression limits.
       * @param options.maxResUSize Maximum uncompressed JSON bytes, default 16 MiB.
       * @returns The decoded values.
       * @static
       */
      static decodeResU(chunk, options = {}) {
        debug2("decodeResU");
        const resu = _a.#chunkBuffer(chunk, 0);
        const chunkID = resu.readString(4);
        const size = resu.readUInt32(true);
        const data = size ? resu.read(size, false) : new Uint8Array();
        const limit = options.maxResUSize ?? 16 * 1024 * 1024;
        if (!Number.isSafeInteger(limit) || limit < 0) {
          throw new RangeError("maxResUSize must be a nonnegative safe integer");
        }
        const value = { chunkID, size };
        try {
          let bytes = 0;
          const text = [];
          const decoder = new TextDecoder();
          const inflator = new Inflate({ chunkSize: 16384 });
          inflator.onData = (output) => {
            bytes += output.length;
            if (bytes > limit) {
              throw new RangeError(`ResU exceeds maxResUSize (${limit} bytes)`);
            }
            text.push(decoder.decode(output, { stream: true }));
          };
          inflator.push(data, false);
          if (inflator.err || !inflator.ended) {
            throw new Error(inflator.msg || "Incomplete ResU compressed stream");
          }
          text.push(decoder.decode());
          const decompressed = text.join("");
          debug2("Inflated Size:", bytes);
          value.data = JSON.parse(decompressed);
        } catch (error) {
          value.error = error instanceof Error ? error.message : String(error);
          debug2("Error Inflating / Parsing ResU:", error);
        }
        debug2("decodeResU =", value);
        return value;
      }
      /**
       * DataSize 64 Parsing
       * @param chunk Data Blob
       * @returns The decoded values.
       * @see {@link https://tech.ebu.ch/docs/tech/tech3306v1_0.pdf|RF64: An extended File Format for Audio}
       * @static
       */
      static decodeDS64(chunk) {
        const ds64 = _a.#chunkBuffer(chunk, 28);
        const chunkID = ds64.readString(4);
        const size = ds64.readUInt32(true);
        const riffSizeLow = ds64.readUInt32(true);
        const riffSizeHigh = ds64.readUInt32(true);
        const dataSizeLow = ds64.readUInt32(true);
        const dataSizeHigh = ds64.readUInt32(true);
        const sampleCountLow = ds64.readUInt32(true);
        const sampleCountHigh = ds64.readUInt32(true);
        const tableLength = ds64.readUInt32(true);
        _a.#countFits(tableLength, 12, ds64.remainingBytes(), "ds64 table length");
        const table = [];
        if (tableLength > 0) {
          for (let i = 0; i < tableLength; i++) {
            table.push({
              chunkID: ds64.readString(4),
              chunkSizeLow: ds64.readUInt32(true),
              chunkSizeHigh: ds64.readUInt32(true)
            });
          }
        }
        const value = {
          chunkID,
          size,
          riffSizeLow,
          riffSizeHigh,
          dataSizeLow,
          dataSizeHigh,
          sampleCountLow,
          sampleCountHigh,
          tableLength,
          table
        };
        debug2("decodeDS64 =", value);
        return value;
      }
      /**
       * Decode the STRC (ACID Related) chunk.
       *
       * When a wave file is used as wave samples in a MIDI synthesizer,
       * the instrument chunk helps the MIDI synthesizer define the sample pitch & relative volume of the samples.
       * @param chunk Data Blob
       * @returns The decoded values.
       * @static
       */
      static decodeSTRC(chunk) {
        debug2("decodeSTRC");
        const strc = _a.#chunkBuffer(chunk, 28);
        const _chunkID = strc.readString(4);
        const size = strc.readUInt32(true);
        debug2("decodeSTRC size:", size);
        const unknown1 = strc.readUInt32(true);
        const numberOfSlices = strc.readUInt32(true);
        const unknown2 = strc.readUInt32(true);
        const unknown3 = strc.readUInt32(true);
        const unknown4 = strc.readUInt32(true);
        const unknown5 = strc.readUInt32(true);
        const unknown6 = strc.readUInt32(true);
        _a.#countFits(Math.max(0, numberOfSlices - 1), 32, strc.remainingBytes(), "strc slice count");
        const slices = [];
        debug2("decodeSTRC numberOfSlices:", numberOfSlices);
        for (let i = 0; i < numberOfSlices - 1; i++) {
          const header = strc.readUInt32(true);
          const ID1 = strc.readUInt32(true);
          const samplePositionUpper = strc.readUInt32(true);
          const samplePositionLower = strc.readUInt32(true);
          const samplePosition2Upper = strc.readUInt32(true);
          const samplePosition2Lower = strc.readUInt32(true);
          const data3 = strc.readUInt32(true);
          const ID2 = strc.readUInt32(true);
          const slice = {
            header,
            ID1,
            samplePositionUpper,
            samplePositionLower,
            samplePosition2Upper,
            samplePosition2Lower,
            data3,
            ID2
          };
          debug2("decodeSTRC slice:", i, slice);
          debug2("remaining", strc.remainingBytes());
          slices.push(slice);
        }
        debug2("decodeSTRC remaining", strc.remainingBytes());
        const value = {
          unknown1,
          numberOfSlices,
          unknown2,
          unknown3,
          unknown4,
          unknown5,
          unknown6,
          slices
        };
        debug2("decodeSTRC =", value);
        return value;
      }
      /**
       * Decode the COMM (Common) chunk.
       * The Common Chunk describes fundamental parameters of the sampled sound.
       * @param chunk Data Blob
       * @returns The decoded values.
       * @see {@link https://www.mmsp.ece.mcgill.ca/Documents/AudioFormats/AIFF/AIFF.html|Audio File Format Specifications}
       * @static
       */
      static decodeCOMM(chunk) {
        debug2("decodeCOMM");
        const commonChunk = _a.#chunkBuffer(chunk, 18, false);
        const chunkID = commonChunk.readString(4);
        const size = commonChunk.readUInt32();
        const channels = commonChunk.readUInt16();
        const sampleFrames = commonChunk.readUInt32();
        const sampleSize = commonChunk.readUInt16();
        const sampleRate = commonChunk.readFloatIEEE754(false);
        let compressionType = "";
        let compressionTypeName = "";
        if (size !== 18) {
          if (size < 23) {
            throw new RangeError("Truncated AIFF-C compression fields");
          }
          compressionType = commonChunk.readString(4);
          const nameLength = commonChunk.readUInt8();
          if (nameLength > commonChunk.remainingBytes()) {
            throw new RangeError("Truncated AIFF-C compression name");
          }
          compressionTypeName = nameLength ? commonChunk.readString(nameLength) : "";
          const padding = (nameLength + 1) % 2;
          if (padding > commonChunk.remainingBytes()) {
            throw new RangeError("Missing AIFF-C Pascal string padding");
          }
          if (padding) {
            commonChunk.advance(padding);
          }
        }
        const value = {
          chunkID,
          size,
          channels,
          sampleFrames,
          sampleSize,
          sampleRate,
          compressionType,
          compressionTypeName
        };
        debug2("decodeCOMM =", value);
        return value;
      }
      /**
       * Decode the SSND (Sound Data) chunk.
       *
       * Offset:     4 bytes
       * Block Size: 4 bytes
       * Sound Data: n bytes
       * @param chunk Data Blob
       * @returns The decoded values.
       * @see {@link https://www.mmsp.ece.mcgill.ca/Documents/AudioFormats/AIFF/AIFF.html|Audio File Format Specifications}
       * @static
       */
      static decodeSSND(chunk) {
        debug2("decodeSSND");
        const ssndChunk = _a.#chunkBuffer(chunk, 8, false);
        const chunkID = ssndChunk.readString(4);
        const size = ssndChunk.readUInt32();
        const offset = ssndChunk.readUInt32();
        const blockSize = ssndChunk.readUInt32();
        if (offset > ssndChunk.remainingBytes()) {
          throw new RangeError("AIFF SSND offset exceeds sound data");
        }
        ssndChunk.advance(offset);
        const soundData = ssndChunk.remainingBytes() ? ssndChunk.read(ssndChunk.remainingBytes(), false) : new Uint8Array();
        const value = {
          chunkID,
          size,
          offset,
          blockSize,
          soundData
        };
        debug2("decodeSSND =", { chunkID, size, offset, blockSize });
        return value;
      }
      /**
       * Decode the FVER (Format Vers) chunk.
       *
       * The Format Version Chunk contains a date field to indicate the format rules for an AIFF-C specification.
       * The timestamp holds the number of seconds since January 1, 1904.
       * The FVER chunk appears only in AIFF-C files.
       * @param chunk Data Blob
       * @returns The decoded values.
       * @see {@link https://www.mmsp.ece.mcgill.ca/Documents/AudioFormats/AIFF/AIFF.html|Audio File Format Specifications}
       * @static
       */
      static decodeFVER(chunk) {
        debug2("decodeFVER");
        const formatVersionChunk = _a.#chunkBuffer(chunk, 4, false);
        const chunkID = formatVersionChunk.readString(4);
        const size = formatVersionChunk.readUInt32();
        const timestamp = formatVersionChunk.readUInt32();
        const versionName = timestamp === 2726318400 ? "AIFCVersion1" : `Unknown: ${timestamp}`;
        const value = {
          chunkID,
          size,
          timestamp,
          versionName
        };
        debug2("decodeFVER =", value);
        return value;
      }
    };
    _a = AudioWAV;
    audio_wav_default = AudioWAV;
  }
});

// packages/assets/src/snes.ts
function decodePlanarTiles(bytes, depth) {
  const size = depth * 8;
  const count = unitCount(bytes, size, "Planar tile stream");
  return Array.from(
    { length: count },
    (_, tileIndex) => Array.from(
      { length: 8 },
      (_2, row) => Array.from({ length: 8 }, (_3, column) => {
        let pixel = 0;
        for (let plane = 0; plane < depth; plane++) {
          const byte = bytes[tileIndex * size + planeOffset(depth, plane, row)];
          pixel |= (byte >> 7 - column & 1) << plane;
        }
        return pixel;
      })
    )
  );
}
function encodePlanarTiles(tiles, depth) {
  const size = depth * 8;
  const bytes = new Uint8Array(tiles.length * size);
  tiles.forEach((tile, tileIndex) => {
    validateTile(tile, `Tile ${tileIndex}`, 2 ** depth - 1);
    tile.forEach(
      (row, y) => row.forEach((pixel, x) => {
        for (let plane = 0; plane < depth; plane++) {
          if ((pixel & 1 << plane) !== 0) {
            bytes[tileIndex * size + planeOffset(depth, plane, y)] |= 1 << 7 - x;
          }
        }
      })
    );
  });
  return bytes;
}
function decodeMode7Tiles(bytes) {
  const count = unitCount(bytes, 64, "Mode 7 tile stream");
  return Array.from(
    { length: count },
    (_, tileIndex) => Array.from(
      { length: 8 },
      (_2, row) => Array.from({ length: 8 }, (_3, column) => bytes[tileIndex * 64 + row * 8 + column])
    )
  );
}
function encodeMode7Tiles(tiles) {
  const bytes = new Uint8Array(tiles.length * 64);
  tiles.forEach((tile, tileIndex) => {
    validateTile(tile, `Mode 7 tile ${tileIndex}`, 255);
    tile.forEach(
      (row, y) => row.forEach((pixel, x) => {
        bytes[tileIndex * 64 + y * 8 + x] = pixel;
      })
    );
  });
  return bytes;
}
function decodeBgr555(bytes) {
  const count = unitCount(bytes, 2, "BGR555 palette");
  return Array.from({ length: count }, (_, index) => {
    const word2 = bytes[index * 2] | bytes[index * 2 + 1] << 8;
    return {
      red: word2 & 31,
      green: word2 >> 5 & 31,
      blue: word2 >> 10 & 31,
      unusedHighBit: word2 >> 15 & 1
    };
  });
}
function encodeBgr555(colors) {
  const bytes = new Uint8Array(colors.length * 2);
  colors.forEach((color, index) => {
    const word2 = integer2(color.red, `Color ${index} red`, 0, 31) | integer2(color.green, `Color ${index} green`, 0, 31) << 5 | integer2(color.blue, `Color ${index} blue`, 0, 31) << 10 | integer2(color.unusedHighBit, `Color ${index} unusedHighBit`, 0, 1) << 15;
    bytes[index * 2] = word2 & 255;
    bytes[index * 2 + 1] = word2 >> 8;
  });
  return bytes;
}
function decodeBgMap(bytes) {
  const count = unitCount(bytes, 2, "BG tilemap");
  return Array.from({ length: count }, (_, index) => {
    const word2 = bytes[index * 2] | bytes[index * 2 + 1] << 8;
    return {
      tile: word2 & 1023,
      palette: word2 >> 10 & 7,
      priority: word2 >> 13 & 1,
      horizontalFlip: word2 >> 14 & 1,
      verticalFlip: word2 >> 15 & 1
    };
  });
}
function encodeBgMap(entries3) {
  const bytes = new Uint8Array(entries3.length * 2);
  entries3.forEach((entry, index) => {
    const word2 = integer2(entry.tile, `Entry ${index} tile`, 0, 1023) | integer2(entry.palette, `Entry ${index} palette`, 0, 7) << 10 | integer2(entry.priority, `Entry ${index} priority`, 0, 1) << 13 | integer2(entry.horizontalFlip, `Entry ${index} horizontalFlip`, 0, 1) << 14 | integer2(entry.verticalFlip, `Entry ${index} verticalFlip`, 0, 1) << 15;
    bytes[index * 2] = word2 & 255;
    bytes[index * 2 + 1] = word2 >> 8;
  });
  return bytes;
}
function decodeMode7Map(bytes) {
  return [...bytes];
}
function encodeMode7Map(indexes) {
  return Uint8Array.from(indexes.map((value, index) => integer2(value, `Index ${index}`, 0, 255)));
}
function decodeBrrBlocks(bytes) {
  const count = unitCount(bytes, 9, "BRR stream");
  return Array.from({ length: count }, (_, blockIndex) => {
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
}
function encodeBrrBlocks(blocks) {
  const bytes = new Uint8Array(blocks.length * 9);
  blocks.forEach((block, index) => {
    if (block.nibbles.length !== 16) {
      throw new RangeError(`BRR block ${index} requires exactly 16 nibbles.`);
    }
    const offset = index * 9;
    bytes[offset] = integer2(block.range, `BRR block ${index} range`, 0, 15) << 4 | integer2(block.filter, `BRR block ${index} filter`, 0, 3) << 2 | integer2(block.loop, `BRR block ${index} loop`, 0, 1) << 1 | integer2(block.end, `BRR block ${index} end`, 0, 1);
    for (let sampleIndex = 0; sampleIndex < 16; sampleIndex += 2) {
      const high = integer2(block.nibbles[sampleIndex], `BRR nibble ${sampleIndex}`, -8, 7) & 15;
      const low = integer2(block.nibbles[sampleIndex + 1], `BRR nibble ${sampleIndex + 1}`, -8, 7) & 15;
      bytes[offset + 1 + sampleIndex / 2] = high << 4 | low;
    }
  });
  return bytes;
}
var planeOffset, validateTile, sameModelValue, nativeEncoder, snesNativeEncoders;
var init_snes = __esm({
  "packages/assets/src/snes.ts"() {
    "use strict";
    init_validation();
    planeOffset = (depth, plane, row) => {
      if (depth === 3 && plane === 2) {
        return 16 + row;
      }
      return Math.floor(plane / 2) * 16 + row * 2 + plane % 2;
    };
    validateTile = (tile, label, maximum) => {
      if (tile.length !== 8) {
        throw new RangeError(`${label} must contain exactly 8 rows.`);
      }
      tile.forEach((row, y) => {
        if (row.length !== 8) {
          throw new RangeError(`${label} row ${y} must contain exactly 8 pixels.`);
        }
        row.forEach((pixel, x) => integer2(pixel, `${label} pixel ${x},${y}`, 0, maximum));
      });
    };
    sameModelValue = (left, right) => {
      if (Object.is(left, right)) {
        return true;
      }
      if (Array.isArray(left) && Array.isArray(right)) {
        return left.length === right.length && left.every((entry, index) => sameModelValue(entry, right[index]));
      }
      if (!left || !right || typeof left !== "object" || typeof right !== "object" || Array.isArray(left) || Array.isArray(right)) {
        return false;
      }
      const leftRecord = left;
      const rightRecord = right;
      const keys = Object.keys(leftRecord);
      return keys.length === Object.keys(rightRecord).length && keys.every(
        (key) => Object.hasOwn(rightRecord, key) && sameModelValue(leftRecord[key], rightRecord[key])
      );
    };
    nativeEncoder = (id, kind, output, modelField, encode, decode) => Object.freeze({
      id,
      version: "1.0.0",
      inputKinds: [kind],
      primaryOutput: output,
      encode: (document2, options) => {
        if (Object.keys(options).length !== 0) {
          throw new Error(`Native encoder '${id}' accepts no options.`);
        }
        if (!document2.value || typeof document2.value !== "object" || Array.isArray(document2.value)) {
          throw new Error(`Native encoder '${id}' requires an object model.`);
        }
        const value = document2.value;
        const bytes = encode(value);
        if (!sameModelValue(decode(bytes), value[modelField])) {
          throw new Error(`Native encoder '${id}' did not preserve '${modelField}'.`);
        }
        return {
          outputs: { [output]: { bytes, mediaType: "application/octet-stream" } },
          fidelity: { kind: "exact", verification: "native model round trip" },
          normalizedOptions: {}
        };
      }
    });
    snesNativeEncoders = Object.freeze(
      [
        ...[2, 3, 4, 8].map(
          (depth) => nativeEncoder(
            `snes.tile.${depth}bpp`,
            "snes-planar-tiles",
            "tiles",
            "tiles",
            (value) => encodePlanarTiles(value.tiles, depth),
            (bytes) => decodePlanarTiles(bytes, depth)
          )
        ),
        nativeEncoder(
          "snes.tile.mode7",
          "snes-mode7-tiles",
          "tiles",
          "tiles",
          (value) => encodeMode7Tiles(value.tiles),
          decodeMode7Tiles
        ),
        nativeEncoder(
          "snes.palette.bgr555",
          "snes-palette-bgr555",
          "palette",
          "colors",
          (value) => encodeBgr555(value.colors),
          decodeBgr555
        ),
        nativeEncoder(
          "snes.tilemap.bg",
          "snes-bg-tilemap",
          "tilemap",
          "entries",
          (value) => encodeBgMap(value.entries),
          decodeBgMap
        ),
        nativeEncoder(
          "snes.tilemap.mode7",
          "snes-mode7-tilemap",
          "tilemap",
          "indexes",
          (value) => encodeMode7Map(value.indexes),
          decodeMode7Map
        ),
        nativeEncoder(
          "snes.brr",
          "snes-brr",
          "brr",
          "blocks",
          (value) => encodeBrrBlocks(value.blocks),
          decodeBrrBlocks
        )
      ].sort((left, right) => left.id.localeCompare(right.id))
    );
  }
});

// packages/assets/src/brr-codec.ts
function decodeNibble(nibble2, range, filter, state) {
  let value = range <= 12 ? nibble2 << range >> 1 : nibble2 & ~2047;
  const previous = state.previous;
  const halfPrevious2 = state.previous2 >> 1;
  if (filter === 1) {
    value += (previous >> 1) + (-previous >> 5);
  }
  if (filter === 2) {
    value += previous - halfPrevious2 + (halfPrevious2 >> 4) + (previous * -3 >> 6);
  }
  if (filter === 3) {
    value += previous - halfPrevious2 + (previous * -13 >> 7) + (halfPrevious2 * 3 >> 4);
  }
  value = Math.max(-32768, Math.min(32767, value));
  return value << 17 >> 16;
}
function decodeBrrPcm(bytes, loopOffset, repeatCount = 0) {
  if (bytes.length === 0 || bytes.length % 9 !== 0) {
    throw new Error("BRR stream requires complete nine-byte blocks.");
  }
  if (!Number.isSafeInteger(repeatCount) || repeatCount < 0 || repeatCount > 16) {
    throw new RangeError("BRR repeat count must be 0..16.");
  }
  const blocks = decodeBrrBlocks(bytes);
  if (blocks.some((block, index) => block.end !== Number(index === blocks.length - 1))) {
    throw new Error("BRR END flag must occur on the final block only.");
  }
  if (loopOffset !== void 0 && (!Number.isSafeInteger(loopOffset) || loopOffset < 0 || loopOffset >= bytes.length || loopOffset % 9 !== 0 || blocks.at(-1)?.loop !== 1)) {
    throw new Error("BRR loop offset or LOOP flag is invalid.");
  }
  if (loopOffset === void 0 && repeatCount > 0) {
    throw new Error("BRR replay requires a loop offset.");
  }
  const output = [];
  let state = { previous: 0, previous2: 0 };
  const play = (startBlock) => {
    for (let index = startBlock; index < blocks.length; index++) {
      const block = blocks[index];
      for (const nibble2 of block.nibbles) {
        const sample = decodeNibble(nibble2, block.range, block.filter, state);
        output.push(sample);
        state = { previous: sample, previous2: state.previous };
      }
    }
  };
  play(0);
  if (loopOffset !== void 0) {
    for (let repeat = 0; repeat < repeatCount; repeat++) {
      play(loopOffset / 9);
    }
  }
  return Int16Array.from(output);
}
function candidateBlock(source, start, range, filter, initial) {
  let state = initial;
  let squaredError = 0;
  const nibbles = [];
  for (let sampleIndex = 0; sampleIndex < 16; sampleIndex++) {
    const target = source[start + sampleIndex];
    let bestNibble = -8;
    let bestSample = 0;
    let bestError = Number.POSITIVE_INFINITY;
    for (let nibble2 = -8; nibble2 <= 7; nibble2++) {
      const decoded = decodeNibble(nibble2, range, filter, state);
      const error = (target - decoded) ** 2;
      if (error < bestError || error === bestError && Math.abs(nibble2) < Math.abs(bestNibble)) {
        bestNibble = nibble2;
        bestSample = decoded;
        bestError = error;
      }
    }
    nibbles.push(bestNibble);
    squaredError += bestError;
    state = { previous: bestSample, previous2: state.previous };
  }
  return { range, filter, nibbles, state, squaredError };
}
function encodeBrrPcm(samples, loop) {
  if (samples.length === 0 || samples.length % 16 !== 0) {
    throw new Error("BRR encoding requires at least one whole 16-sample block.");
  }
  const bytes = new Uint8Array(samples.length / 16 * 9);
  let state = { previous: 0, previous2: 0 };
  for (let start = 0; start < samples.length; start += 16) {
    let best;
    for (let filter = 0; filter < 4; filter++) {
      for (let range = 0; range <= 12; range++) {
        const candidate = candidateBlock(samples, start, range, filter, state);
        if (!best || candidate.squaredError < best.squaredError) {
          best = candidate;
        }
      }
    }
    if (!best) {
      throw new Error("BRR encoder could not select a block.");
    }
    const offset = start / 16 * 9;
    const final = start + 16 === samples.length;
    bytes[offset] = best.range << 4 | best.filter << 2 | Number(final && loop) << 1 | Number(final);
    for (let index = 0; index < 16; index += 2) {
      bytes[offset + 1 + index / 2] = (best.nibbles[index] & 15) << 4 | best.nibbles[index + 1] & 15;
    }
    state = best.state;
  }
  return bytes;
}
var init_brr_codec = __esm({
  "packages/assets/src/brr-codec.ts"() {
    "use strict";
    init_snes();
  }
});

// packages/assets/src/audio.ts
function scanWave(bytes) {
  if (bytes.length < 12 || bytes.length > MAX_WAVE_BYTES || ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 4) !== "WAVE" || u32le(bytes, 4) + 8 !== bytes.length) {
    throw new Error("Expected a bounded little-endian RIFF/WAVE file with an exact declared size.");
  }
  audio_wav_default.decodeHeader(bytes.subarray(0, 12));
  const chunks = /* @__PURE__ */ new Map();
  let offset = 12;
  while (offset < bytes.length) {
    if (offset + 8 > bytes.length) {
      throw new Error("Truncated WAVE chunk header.");
    }
    const name = ascii(bytes, offset, 4);
    const size = u32le(bytes, offset + 4);
    const end = offset + 8 + size;
    const next = end + (size & 1);
    if (!Number.isSafeInteger(next) || next > bytes.length) {
      throw new Error(`Truncated WAVE ${name} chunk or RIFF pad byte.`);
    }
    if (["fmt ", "data", "smpl"].includes(name)) {
      if (chunks.has(name)) {
        throw new Error(`Duplicate WAVE ${name} chunk.`);
      }
      chunks.set(name, { bytes: bytes.subarray(offset, end), size });
    }
    offset = next;
  }
  if (!chunks.has("fmt ") || !chunks.has("data")) {
    throw new Error("WAVE requires one fmt and one data chunk.");
  }
  return chunks;
}
function writePcmWave(samples, sampleRate) {
  if (!Number.isSafeInteger(sampleRate) || sampleRate < 1 || sampleRate > 384e3 || samples.length > MAX_SAMPLES) {
    throw new RangeError("Invalid review WAVE sample rate or length.");
  }
  const bytes = new Uint8Array(44 + samples.length * 2);
  const view = new DataView(bytes.buffer);
  const writeAscii = (offset, value) => {
    for (let index = 0; index < value.length; index++) {
      bytes[offset + index] = value.charCodeAt(index);
    }
  };
  writeAscii(0, "RIFF");
  view.setUint32(4, bytes.length - 8, true);
  writeAscii(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(36, "data");
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((sample, index) => view.setInt16(44 + index * 2, sample, true));
  return bytes;
}
function withAudioEncoder(native) {
  return native.map((encoder) => {
    if (encoder.id !== "snes.brr") {
      return encoder;
    }
    return Object.freeze({
      ...encoder,
      inputKinds: [...encoder.inputKinds, "pcm-audio"],
      encode: (document2, rawOptions, resources) => {
        if (document2.kind !== "pcm-audio") {
          return encoder.encode(document2, rawOptions, resources);
        }
        if (!document2.value || typeof document2.value !== "object" || !("samples" in document2.value) || !(document2.value.samples instanceof Int16Array) || !("sampleRate" in document2.value) || typeof document2.value.sampleRate !== "number" || !Number.isSafeInteger(document2.value.sampleRate) || document2.value.sampleRate < 1 || document2.value.sampleRate > 384e3 || !("sourceBitDepth" in document2.value) || document2.value.sourceBitDepth !== 8 && document2.value.sourceBitDepth !== 16) {
          throw new Error(
            "PCM model requires bounded mono PCM16 samples and an explicit source rate/depth."
          );
        }
        const audio = document2.value;
        const options = audioOptions(rawOptions, audio);
        const originalCount = audio.samples.length;
        if (originalCount === 0) {
          throw new Error("WAVE has no PCM samples.");
        }
        const paddingCount = (16 - originalCount % 16) % 16;
        if (paddingCount > 0 && options.padding === "reject") {
          throw new Error(
            `WAVE has ${originalCount} samples; BRR requires complete 16-sample blocks.`
          );
        }
        const padded = new Int16Array(originalCount + paddingCount);
        padded.set(audio.samples);
        const loop = options.loop === "source" ? audio.loop : options.loop;
        if (loop) {
          if (!Number.isSafeInteger(loop.start) || !Number.isSafeInteger(loop.end) || loop.start < 0 || loop.start >= loop.end || loop.end !== originalCount || loop.start % 16 !== 0 || loop.end % 16 !== 0) {
            throw new Error(
              "BRR loop must start on a 16-sample boundary and end at the unpadded tail."
            );
          }
        }
        const brr = encodeBrrPcm(padded, Boolean(loop));
        const loopOffset = loop ? loop.start / 16 * 9 : void 0;
        const decoded = decodeBrrPcm(brr, loopOffset);
        let squared = 0;
        let signal = 0;
        let peakError = 0;
        for (let index = 0; index < originalCount; index++) {
          const error = audio.samples[index] - decoded[index];
          squared += error * error;
          signal += audio.samples[index] * audio.samples[index];
          peakError = Math.max(peakError, Math.abs(error));
        }
        const rmsError = Math.sqrt(squared / originalCount);
        const snrDb = squared > 0 && signal > 0 ? 10 * Math.log10(signal / squared) : void 0;
        let loopPeakError;
        if (loop) {
          const repeated = decodeBrrPcm(brr, loopOffset, 1);
          loopPeakError = 0;
          for (let index = 0; index < loop.end - loop.start; index++) {
            const replay = repeated[padded.length + index];
            loopPeakError = Math.max(
              loopPeakError,
              Math.abs(replay - audio.samples[loop.start + index])
            );
          }
        }
        const metadata = {
          sampleRate: audio.sampleRate,
          sourceBitDepth: audio.sourceBitDepth,
          sourceSamples: originalCount,
          paddedSamples: padded.length,
          paddingSamples: paddingCount,
          sourceLoop: audio.loop,
          loop,
          loopOffset,
          peakError,
          rmsError,
          snrDb,
          loopPeakError,
          encoderPolicy: "greedy-integer-sse-v1"
        };
        return {
          outputs: {
            brr: { bytes: brr, mediaType: "application/octet-stream", metadata },
            reviewWav: {
              bytes: writePcmWave(decoded, audio.sampleRate),
              mediaType: "audio/wav",
              metadata
            }
          },
          fidelity: {
            kind: "lossy-audio",
            sampleRate: audio.sampleRate,
            sourceSamples: originalCount,
            paddedSamples: padded.length,
            paddingSamples: paddingCount,
            decodedSamples: decoded.length,
            peakError,
            rmsError,
            snrDb,
            loopPeakError
          },
          normalizedOptions: { padding: options.padding, loop: loop ?? false }
        };
      }
    });
  });
}
var MAX_WAVE_BYTES, MAX_SAMPLES, u16le, u32le, ascii, waveImporter, audioOptions;
var init_audio = __esm({
  async "packages/assets/src/audio.ts"() {
    "use strict";
    await init_audio_wav();
    init_brr_codec();
    MAX_WAVE_BYTES = 16 * 1024 * 1024;
    MAX_SAMPLES = 1024 * 1024;
    u16le = (bytes, offset) => bytes[offset] | bytes[offset + 1] << 8;
    u32le = (bytes, offset) => bytes[offset] + bytes[offset + 1] * 256 + bytes[offset + 2] * 65536 + bytes[offset + 3] * 16777216 >>> 0;
    ascii = (bytes, offset, length) => String.fromCharCode(...bytes.subarray(offset, offset + length));
    waveImporter = Object.freeze({
      id: "uttori.import.wave",
      version: "1.0.0",
      mediaTypes: ["audio/wav", "audio/wave", "audio/x-wav"],
      import: (input) => {
        const chunks = scanWave(input.bytes);
        const formatChunk = chunks.get("fmt ");
        const dataChunk = chunks.get("data");
        if (formatChunk.size !== 16 && !(formatChunk.size === 18 && u16le(formatChunk.bytes, 24) === 0)) {
          throw new Error("WAVE PCM fmt requires 16 bytes or an empty two-byte extension.");
        }
        const format = audio_wav_default.decodeFMT(formatChunk.bytes);
        if (format.audioFormatValue !== 1 || format.channels !== 1 || format.bitsPerSample !== 8 && format.bitsPerSample !== 16) {
          throw new Error(
            `Unsupported WAVE format: code ${format.audioFormatValue}, ${format.channels} channels, ${format.bitsPerSample} bits; expected mono PCM8/PCM16.`
          );
        }
        const bytesPerSample = format.bitsPerSample / 8;
        if (!Number.isSafeInteger(format.sampleRate) || format.sampleRate < 1 || format.sampleRate > 384e3 || format.blockAlign !== bytesPerSample || format.byteRate !== format.sampleRate * bytesPerSample || dataChunk.size % bytesPerSample !== 0 || dataChunk.size / bytesPerSample > MAX_SAMPLES) {
          throw new Error("WAVE sample rate, alignment, byte rate, or data length is invalid.");
        }
        const sampleCount = dataChunk.size / bytesPerSample;
        const samples = new Int16Array(sampleCount);
        const data = dataChunk.bytes.subarray(8);
        for (let index = 0; index < sampleCount; index++) {
          if (format.bitsPerSample === 8) {
            samples[index] = data[index] - 128 << 8;
          } else {
            const unsigned = u16le(data, index * 2);
            samples[index] = unsigned >= 32768 ? unsigned - 65536 : unsigned;
          }
        }
        let loop;
        const sampleChunk = chunks.get("smpl");
        if (sampleChunk) {
          if (sampleChunk.size < 36) {
            throw new Error("WAVE smpl chunk is truncated.");
          }
          const loopCount = u32le(sampleChunk.bytes, 8 + 28);
          const extraBytes = u32le(sampleChunk.bytes, 8 + 32);
          if (loopCount > 1 || 36 + loopCount * 24 + extraBytes !== sampleChunk.size) {
            throw new Error("WAVE smpl requires at most one complete forward loop.");
          }
          const smpl = audio_wav_default.decodeSMPL(sampleChunk.bytes);
          if (smpl.sampleLoopsCount !== loopCount) {
            throw new Error("WAVE smpl loop count mismatch.");
          }
          if (loopCount === 1) {
            const sourceLoop = smpl.sampleLoops[0];
            if (sourceLoop.type !== 0 || sourceLoop.count !== 0 || sourceLoop.start >= sampleCount || sourceLoop.end < sourceLoop.start || sourceLoop.end >= sampleCount) {
              throw new Error("Unsupported or out-of-range WAVE smpl loop.");
            }
            loop = { start: sourceLoop.start, end: sourceLoop.end + 1 };
          }
        }
        const value = {
          kind: "pcm-audio",
          sampleRate: format.sampleRate,
          sourceBitDepth: format.bitsPerSample,
          samples,
          loop
        };
        return {
          kind: value.kind,
          value,
          metadata: {
            sampleRate: value.sampleRate,
            sourceBitDepth: value.sourceBitDepth,
            sourceLoop: loop
          }
        };
      }
    });
    audioOptions = (raw, source) => {
      if (Object.keys(raw).some((key) => key !== "padding" && key !== "loop")) {
        throw new Error("Unknown WAVE-to-BRR option.");
      }
      const padding = raw.padding === void 0 ? "reject" : raw.padding;
      if (padding !== "reject" && padding !== "zero") {
        throw new Error("padding must be 'reject' or 'zero'.");
      }
      let requested = raw.loop;
      if (requested === void 0) {
        requested = source.loop ? "source" : false;
      }
      if (requested === false) {
        return { padding, loop: false };
      }
      if (requested === "source") {
        if (!source.loop) {
          throw new Error("WAVE has no source loop.");
        }
        return { padding, loop: "source" };
      }
      if (!requested || typeof requested !== "object" || Array.isArray(requested) || !("start" in requested) || !("end" in requested) || typeof requested.start !== "number" || typeof requested.end !== "number" || Object.keys(requested).some((key) => key !== "start" && key !== "end")) {
        throw new Error("loop must be false, 'source', or { start, end } in sample frames.");
      }
      return { padding, loop: { start: requested.start, end: requested.end } };
    };
  }
});

// packages/assets/src/data-structured.ts
var init_data_structured = __esm({
  "packages/assets/src/data-structured.ts"() {
    "use strict";
  }
});

// packages/assets/src/data-text.ts
var init_data_text = __esm({
  "packages/assets/src/data-text.ts"() {
    "use strict";
  }
});

// packages/assets/src/data.ts
var rawImporter, rawEncoder, jsonImporter;
var init_data = __esm({
  "packages/assets/src/data.ts"() {
    "use strict";
    init_data_structured();
    init_data_text();
    rawImporter = Object.freeze({
      id: "uttori.import.raw",
      version: "1.0.0",
      mediaTypes: ["application/octet-stream"],
      import: (input) => ({
        kind: "raw",
        value: input.bytes.slice()
      })
    });
    rawEncoder = Object.freeze({
      id: "uttori.data.raw",
      version: "1.0.0",
      inputKinds: ["raw"],
      primaryOutput: "data",
      encode: (document2, options) => {
        if (Object.keys(options).length !== 0) {
          throw new Error("Raw encoding accepts no options.");
        }
        if (!(document2.value instanceof Uint8Array)) {
          throw new Error("Raw document requires bytes.");
        }
        return {
          outputs: { data: { bytes: document2.value.slice(), mediaType: "application/octet-stream" } },
          fidelity: { kind: "exact", verification: "byte equality" },
          normalizedOptions: {}
        };
      }
    });
    jsonImporter = Object.freeze({
      id: "uttori.import.json",
      version: "1.0.0",
      mediaTypes: ["application/json"],
      import: (input) => {
        const value = JSON.parse(
          new TextDecoder("utf-8", { fatal: true }).decode(input.bytes)
        );
        if (value === null || typeof value !== "object" || Array.isArray(value) || !("kind" in value) || typeof value.kind !== "string") {
          throw new Error("Asset JSON requires an object with a kind string.");
        }
        return { kind: value.kind, value };
      }
    });
  }
});

// node_modules/@uttori/data-tools/dist/image/bitmap-text.js
function freezeGlyphs() {
  return Object.freeze(Object.fromEntries(Object.entries({
    " ": [0, 0, 0, 0, 0, 0, 0],
    A: [14, 17, 17, 31, 17, 17, 17],
    B: [30, 17, 17, 30, 17, 17, 30],
    C: [14, 17, 16, 16, 16, 17, 14],
    D: [30, 17, 17, 17, 17, 17, 30],
    E: [31, 16, 16, 30, 16, 16, 31],
    F: [31, 16, 16, 30, 16, 16, 16],
    G: [14, 17, 16, 23, 17, 17, 15],
    H: [17, 17, 17, 31, 17, 17, 17],
    I: [14, 4, 4, 4, 4, 4, 14],
    J: [7, 2, 2, 2, 2, 18, 12],
    K: [17, 18, 20, 24, 20, 18, 17],
    L: [16, 16, 16, 16, 16, 16, 31],
    M: [17, 27, 21, 21, 17, 17, 17],
    N: [17, 25, 21, 19, 17, 17, 17],
    O: [14, 17, 17, 17, 17, 17, 14],
    P: [30, 17, 17, 30, 16, 16, 16],
    Q: [14, 17, 17, 17, 21, 18, 13],
    R: [30, 17, 17, 30, 20, 18, 17],
    S: [15, 16, 16, 14, 1, 1, 30],
    T: [31, 4, 4, 4, 4, 4, 4],
    U: [17, 17, 17, 17, 17, 17, 14],
    V: [17, 17, 17, 17, 17, 10, 4],
    W: [17, 17, 17, 21, 21, 27, 17],
    X: [17, 17, 10, 4, 10, 17, 17],
    Y: [17, 17, 10, 4, 4, 4, 4],
    Z: [31, 1, 2, 4, 8, 16, 31],
    0: [14, 17, 19, 21, 25, 17, 14],
    1: [4, 12, 4, 4, 4, 4, 14],
    2: [14, 17, 1, 2, 4, 8, 31],
    3: [30, 1, 1, 14, 1, 1, 30],
    4: [2, 6, 10, 18, 31, 2, 2],
    5: [31, 16, 16, 30, 1, 1, 30],
    6: [14, 16, 16, 30, 17, 17, 14],
    7: [31, 1, 2, 4, 8, 8, 8],
    8: [14, 17, 17, 14, 17, 17, 14],
    9: [14, 17, 17, 15, 1, 1, 14],
    ".": [0, 0, 0, 0, 0, 12, 12],
    ",": [0, 0, 0, 0, 4, 4, 8],
    ":": [0, 12, 12, 0, 12, 12, 0],
    ";": [0, 12, 12, 0, 4, 4, 8],
    "!": [4, 4, 4, 4, 4, 0, 4],
    "?": [14, 17, 1, 2, 4, 0, 4],
    "-": [0, 0, 0, 31, 0, 0, 0],
    _: [0, 0, 0, 0, 0, 0, 31],
    "+": [0, 4, 4, 31, 4, 4, 0],
    "=": [0, 0, 31, 0, 31, 0, 0],
    "/": [1, 2, 2, 4, 8, 8, 16],
    "\\": [16, 8, 8, 4, 2, 2, 1],
    "(": [2, 4, 8, 8, 8, 4, 2],
    ")": [8, 4, 2, 2, 2, 4, 8],
    "[": [14, 8, 8, 8, 8, 8, 14],
    "]": [14, 2, 2, 2, 2, 2, 14],
    "<": [1, 2, 4, 8, 4, 2, 1],
    ">": [16, 8, 4, 2, 4, 8, 16],
    "#": [10, 10, 31, 10, 31, 10, 10],
    "%": [25, 25, 2, 4, 8, 19, 19],
    "*": [0, 21, 14, 31, 14, 21, 0],
    "|": [4, 4, 4, 4, 4, 4, 4],
    "'": [4, 4, 8, 0, 0, 0, 0],
    '"': [10, 10, 20, 0, 0, 0, 0],
    "@": [14, 17, 23, 21, 23, 16, 14],
    "&": [12, 18, 20, 8, 21, 18, 13],
    $: [4, 15, 20, 14, 5, 30, 4],
    "^": [4, 10, 17, 0, 0, 0, 0],
    "~": [0, 0, 8, 21, 2, 0, 0],
    "`": [8, 4, 2, 0, 0, 0, 0],
    "{": [2, 4, 4, 8, 4, 4, 2],
    "}": [8, 4, 4, 2, 4, 4, 8]
  }).map(([key, rows]) => [key, Object.freeze(rows)])));
}
function layout(text, options = {}) {
  if (typeof text !== "string") {
    throw new TypeError("Caption must be a string.");
  }
  if (text.length > 4096) {
    throw new RangeError("Caption exceeds 4096 UTF-16 code units.");
  }
  const scale = options.scale ?? 1;
  if (!Number.isSafeInteger(scale) || scale < 1 || scale > 64) {
    throw new RangeError("Text scale must be an integer in [1, 64].");
  }
  const lines = text.length ? text.replace(/\r\n?/g, "\n").replace(/\t/g, "    ").split("\n").map((line) => Array.from(line)) : [];
  const maxColumns = lines.reduce((max, line) => Math.max(max, line.length), 0);
  return {
    lines,
    scale,
    metrics: {
      width: maxColumns ? (maxColumns * 6 - 1) * scale : 0,
      height: lines.length ? (lines.length * 8 - 1) * scale : 0,
      advanceX: (lines.at(-1)?.length ?? 0) * 6 * scale,
      advanceY: Math.max(0, lines.length - 1) * 8 * scale,
      lineHeight: 8 * scale,
      baseline: 7 * scale,
      lines: lines.length
    }
  };
}
function drawBitmapText(surface, text, x, y, color, options) {
  if (!Number.isSafeInteger(x) || x < -2147483647 || x > 2147483647) {
    throw new RangeError("Text x must be an integer in [-2147483647, 2147483647].");
  }
  if (!Number.isSafeInteger(y) || y < -2147483647 || y > 2147483647) {
    throw new RangeError("Text y must be an integer in [-2147483647, 2147483647].");
  }
  const { lines, scale, metrics } = layout(text, options);
  for (let line = 0; line < lines.length; line++) {
    for (let column = 0; column < lines[line].length; column++) {
      let character = lines[line][column];
      const code = character.codePointAt(0);
      if (code && code >= 97 && code <= 122) {
        character = String.fromCharCode(code - 32);
      }
      const glyph = GLYPHS[character] ?? GLYPHS["?"];
      for (let row = 0; row < 7; row++) {
        for (let cx = 0; cx < 5; ) {
          if (!(glyph[row] & 16 >>> cx)) {
            cx++;
            continue;
          }
          const start = cx++;
          while (cx < 5 && glyph[row] & 16 >>> cx) {
            cx++;
          }
          surface.fill(color, {
            x: x + (column * 6 + start) * scale,
            y: y + (line * 8 + row) * scale,
            width: (cx - start) * scale,
            height: scale
          });
        }
      }
    }
  }
  return metrics;
}
var GLYPHS, BitmapText;
var init_bitmap_text = __esm({
  "node_modules/@uttori/data-tools/dist/image/bitmap-text.js"() {
    GLYPHS = /* @__PURE__ */ freezeGlyphs();
    BitmapText = /* @__PURE__ */ Object.freeze({
      glyphWidth: 5,
      glyphHeight: 7,
      advance: 6,
      lineHeight: 8,
      measure(text, options = {}) {
        return layout(text, options).metrics;
      }
    });
  }
});

// node_modules/@uttori/data-tools/dist/image/rgba-surface.js
function colorRGBA(color) {
  if (!Array.isArray(color) && !(color instanceof Uint8Array) || color.length !== 4) {
    throw new TypeError("Color must have four RGBA8 components.");
  }
  for (const component of color) {
    if (!Number.isSafeInteger(component) || component < 0 || component > 255) {
      throw new RangeError(`RGBA component must be an integer in [0, 255].`);
    }
  }
  return color;
}
function validateRGBA(image, maxPixels = DEFAULT_MAX_PIXELS) {
  if (!Number.isSafeInteger(image.width) || image.width < 1 || image.width > 2147483647) {
    throw new RangeError(`width must be an integer in [1, 0x7fffffff].`);
  }
  if (!Number.isSafeInteger(image.height) || image.height < 1 || image.height > 2147483647) {
    throw new RangeError(`height must be an integer in [1, 0x7fffffff].`);
  }
  if (!Number.isSafeInteger(maxPixels) || maxPixels < 1 || maxPixels > Number.MAX_SAFE_INTEGER) {
    throw new RangeError(`maxPixels must be an integer in [1, ${Number.MAX_SAFE_INTEGER}].`);
  }
  if (!Number.isSafeInteger(image.width * image.height) || image.width * image.height > maxPixels) {
    throw new RangeError(`Image dimensions ${image.width}x${image.height} exceed the pixel limit ${maxPixels}.`);
  }
  if (!(image.rgba instanceof Uint8Array) || image.rgba.length !== image.width * image.height * 4) {
    throw new TypeError(`RGBA must be an exact ${image.width}x${image.height}x4 Uint8Array.`);
  }
}
function littleEndian() {
  return new Uint8Array(new Uint32Array([16909060]).buffer)[0] === 4;
}
function blend(destination, offset, r, g, b, a) {
  if (a === 0) {
    return;
  }
  if (a === 255) {
    destination[offset] = r;
    destination[offset + 1] = g;
    destination[offset + 2] = b;
    destination[offset + 3] = a;
    return;
  }
  const da = destination[offset + 3], inverse = 255 - a;
  const denominator = a * 255 + da * inverse;
  destination[offset] = Math.round((r * a * 255 + destination[offset] * da * inverse) / denominator);
  destination[offset + 1] = Math.round((g * a * 255 + destination[offset + 1] * da * inverse) / denominator);
  destination[offset + 2] = Math.round((b * a * 255 + destination[offset + 2] * da * inverse) / denominator);
  destination[offset + 3] = Math.round(denominator / 255);
}
var DEFAULT_MAX_PIXELS, LITTLE_ENDIAN, wordView, RgbaSurface;
var init_rgba_surface = __esm({
  "node_modules/@uttori/data-tools/dist/image/rgba-surface.js"() {
    init_bitmap_text();
    DEFAULT_MAX_PIXELS = 4 * 1024 * 1024;
    LITTLE_ENDIAN = /* @__PURE__ */ littleEndian();
    wordView = (bytes) => bytes.byteOffset % 4 === 0 ? new Uint32Array(bytes.buffer, bytes.byteOffset, bytes.length / 4) : void 0;
    RgbaSurface = class _RgbaSurface {
      kind;
      width;
      height;
      rgba;
      maxPixels;
      constructor(width, height, rgba, options = {}) {
        const maxPixels = options.maxPixels ?? DEFAULT_MAX_PIXELS;
        if (!Number.isSafeInteger(width) || width < 1 || width > 2147483647) {
          throw new RangeError("Width must be an integer in [1, 2147483647].");
        }
        if (!Number.isSafeInteger(height) || height < 1 || height > 2147483647) {
          throw new RangeError("Height must be an integer in [1, 2147483647].");
        }
        if (!Number.isSafeInteger(maxPixels) || maxPixels < 1 || maxPixels > Number.MAX_SAFE_INTEGER) {
          throw new RangeError(`Pixel limit must be an integer in [1, ${Number.MAX_SAFE_INTEGER}].`);
        }
        if (!Number.isSafeInteger(width * height) || width * height > maxPixels) {
          throw new RangeError(`Image dimensions ${width}\xD7${height} exceed the pixel limit ${maxPixels}.`);
        }
        if (rgba !== void 0) {
          validateRGBA({ width, height, rgba }, maxPixels);
        }
        let bytes;
        if (rgba === void 0) {
          bytes = new Uint8Array(width * height * 4);
        } else if (options.copy === false) {
          bytes = rgba;
        } else {
          bytes = Uint8Array.from(rgba);
        }
        this.kind = "rgba-image";
        this.width = width;
        this.height = height;
        this.rgba = bytes;
        this.maxPixels = maxPixels;
        Object.defineProperties(this, {
          kind: { writable: false, configurable: false },
          width: { writable: false, configurable: false },
          height: { writable: false, configurable: false },
          rgba: { writable: false, configurable: false },
          maxPixels: { writable: false, configurable: false }
        });
      }
      static from(image, options) {
        return new _RgbaSurface(image.width, image.height, image.rgba, options);
      }
      static fromIndexed(image, options) {
        const maxPixels = options?.maxPixels ?? DEFAULT_MAX_PIXELS;
        if (!Number.isSafeInteger(image.width) || image.width < 1 || image.width > 2147483647) {
          throw new RangeError("Width must be an integer in [1, 2147483647].");
        }
        if (!Number.isSafeInteger(image.height) || image.height < 1 || image.height > 2147483647) {
          throw new RangeError("Height must be an integer in [1, 2147483647].");
        }
        if (!Number.isSafeInteger(maxPixels) || maxPixels < 1 || maxPixels > Number.MAX_SAFE_INTEGER) {
          throw new RangeError(`Pixel limit must be an integer in [1, ${Number.MAX_SAFE_INTEGER}].`);
        }
        if (!Number.isSafeInteger(image.width * image.height) || image.width * image.height > maxPixels) {
          throw new RangeError(`Image dimensions ${image.width}x${image.height} exceed the pixel limit ${maxPixels}.`);
        }
        if (!(image.indexes instanceof Uint8Array) || image.indexes.length !== image.width * image.height) {
          throw new Error("Indexed buffer does not match dimensions.");
        }
        if (!Array.isArray(image.palette)) {
          throw new TypeError("Palette must be an array.");
        }
        if (image.palette.length < 1 || image.palette.length > 256) {
          throw new RangeError("Palette slots must be between 1 and 256.");
        }
        for (const color of image.palette) {
          colorRGBA(color);
        }
        const result = new _RgbaSurface(image.width, image.height, void 0, options);
        for (let i = 0, offset = 0; i < image.indexes.length; i++, offset += 4) {
          const color = image.palette[image.indexes[i]];
          if (!color) {
            throw new Error(`Missing palette slot ${image.indexes[i]}.`);
          }
          result.rgba[offset] = color[0];
          result.rgba[offset + 1] = color[1];
          result.rgba[offset + 2] = color[2];
          result.rgba[offset + 3] = color[3];
        }
        return result;
      }
      clone() {
        return new _RgbaSurface(this.width, this.height, this.rgba, { maxPixels: this.maxPixels });
      }
      /** Copy-mode fill, including RGB under alpha zero. Rectangles are clipped, not resized. */
      fill(color, rect = {}) {
        colorRGBA(color);
        const x = rect.x ?? 0;
        if (!Number.isSafeInteger(x) || x < -2147483647 || x > 2147483647) {
          throw new RangeError("Fill x must be an integer in [-2147483647, 2147483647].");
        }
        const y = rect.y ?? 0;
        if (!Number.isSafeInteger(y) || y < -2147483647 || y > 2147483647) {
          throw new RangeError("Fill y must be an integer in [-2147483647, 2147483647].");
        }
        const width = rect.width ?? this.width;
        if (!Number.isSafeInteger(width) || width < 0 || width > 2147483647) {
          throw new RangeError("Fill width must be an integer in [0, 2147483647].");
        }
        const height = rect.height ?? this.height;
        if (!Number.isSafeInteger(height) || height < 0 || height > 2147483647) {
          throw new RangeError("Fill height must be an integer in [0, 2147483647].");
        }
        const left = Math.max(0, x);
        const top = Math.max(0, y);
        const right = Math.min(this.width, x + width);
        const bottom = Math.min(this.height, y + height);
        if (left >= right || top >= bottom) {
          return this;
        }
        const words = wordView(this.rgba);
        if (words) {
          const value = LITTLE_ENDIAN ? color[0] | color[1] << 8 | color[2] << 16 | color[3] << 24 : color[3] | color[2] << 8 | color[1] << 16 | color[0] << 24;
          for (let row = top; row < bottom; row++) {
            words.fill(value, row * this.width + left, row * this.width + right);
          }
        } else {
          for (let row = top; row < bottom; row++) {
            for (let offset = (row * this.width + left) * 4, end = (row * this.width + right) * 4; offset < end; offset += 4) {
              this.rgba[offset] = color[0];
              this.rgba[offset + 1] = color[1];
              this.rgba[offset + 2] = color[2];
              this.rgba[offset + 3] = color[3];
            }
          }
        }
        return this;
      }
      /** Clip against source and destination. Snapshot aliased buffers before the first write. */
      blit(source, x, y, options = {}) {
        validateRGBA(source, this.maxPixels);
        if (!Number.isSafeInteger(x) || x < -2147483647 || x > 2147483647) {
          throw new RangeError("Blit x must be an integer in [-2147483647, 2147483647].");
        }
        if (!Number.isSafeInteger(y) || y < -2147483647 || y > 2147483647) {
          throw new RangeError("Blit y must be an integer in [-2147483647, 2147483647].");
        }
        const sx = options.sx ?? 0;
        if (!Number.isSafeInteger(sx) || sx < -2147483647 || sx > 2147483647) {
          throw new RangeError("Source x must be an integer in [-2147483647, 2147483647].");
        }
        const sy = options.sy ?? 0;
        if (!Number.isSafeInteger(sy) || sy < -2147483647 || sy > 2147483647) {
          throw new RangeError("Source y must be an integer in [-2147483647, 2147483647].");
        }
        const width = options.width ?? source.width;
        if (!Number.isSafeInteger(width) || width < 0 || width > 2147483647) {
          throw new RangeError("Blit width must be an integer in [0, 2147483647].");
        }
        const height = options.height ?? source.height;
        if (!Number.isSafeInteger(height) || height < 0 || height > 2147483647) {
          throw new RangeError("Blit height must be an integer in [0, 2147483647].");
        }
        const mode3 = options.mode ?? "copy";
        if (!["copy", "source-over"].includes(mode3)) {
          throw new Error("Blit mode must be copy or source-over.");
        }
        const left = Math.max(0, -sx, -x);
        const top = Math.max(0, -sy, -y);
        const right = Math.min(width, source.width - sx, this.width - x);
        const bottom = Math.min(height, source.height - sy, this.height - y);
        if (left >= right || top >= bottom) {
          return this;
        }
        const rowLength = (right - left) * 4;
        const rows = bottom - top;
        let bytes = source.rgba;
        let stride = source.width * 4;
        let start = ((sy + top) * source.width + sx + left) * 4;
        if (bytes.buffer === this.rgba.buffer) {
          const snapshot = new Uint8Array(rows * rowLength);
          for (let row = 0; row < rows; row++) {
            snapshot.set(bytes.subarray(start + row * stride, start + row * stride + rowLength), row * rowLength);
          }
          bytes = snapshot;
          stride = rowLength;
          start = 0;
        }
        for (let row = 0; row < rows; row++) {
          let destination = ((y + top + row) * this.width + x + left) * 4;
          const input = start + row * stride;
          if (mode3 === "copy") {
            this.rgba.set(bytes.subarray(input, input + rowLength), destination);
          } else {
            for (let i = input; i < input + rowLength; i += 4, destination += 4) {
              blend(this.rgba, destination, bytes[i], bytes[i + 1], bytes[i + 2], bytes[i + 3]);
            }
          }
        }
        return this;
      }
      /** Strict in-bounds crop; invalid or zero dimensions are errors rather than implicit padding. */
      crop(x, y, width, height) {
        if (!Number.isSafeInteger(x) || x < 0 || x > 2147483647) {
          throw new RangeError("Crop x must be an integer in [0, 2147483647].");
        }
        if (!Number.isSafeInteger(y) || y < 0 || y > 2147483647) {
          throw new RangeError("Crop y must be an integer in [0, 2147483647].");
        }
        if (!Number.isSafeInteger(width) || width < 1 || width > 2147483647) {
          throw new RangeError("Width must be an integer in [1, 2147483647].");
        }
        if (!Number.isSafeInteger(height) || height < 1 || height > 2147483647) {
          throw new RangeError("Height must be an integer in [1, 2147483647].");
        }
        if (!Number.isSafeInteger(this.maxPixels) || this.maxPixels < 1 || this.maxPixels > Number.MAX_SAFE_INTEGER) {
          throw new RangeError(`Pixel limit must be an integer in [1, ${Number.MAX_SAFE_INTEGER}].`);
        }
        if (!Number.isSafeInteger(width * height) || width * height > this.maxPixels) {
          throw new RangeError(`Image dimensions ${width}\xD7${height} exceed the pixel limit ${this.maxPixels}.`);
        }
        if (x + width > this.width || y + height > this.height) {
          throw new RangeError("Crop rectangle exceeds surface bounds.");
        }
        return new _RgbaSurface(width, height, void 0, { maxPixels: this.maxPixels }).blit(this, 0, 0, { sx: x, sy: y, width, height });
      }
      /** Flip the surface horizontally or vertically. */
      flip({ horizontal = false, vertical = false } = {}) {
        if (typeof horizontal !== "boolean" || typeof vertical !== "boolean") {
          throw new TypeError("Flip flags must be booleans.");
        }
        const result = new _RgbaSurface(this.width, this.height, void 0, {
          maxPixels: this.maxPixels
        });
        const inputWords = wordView(this.rgba), outputWords = wordView(result.rgba);
        for (let y = 0; y < this.height; y++) {
          const sy = vertical ? this.height - y - 1 : y;
          if (!horizontal) {
            result.rgba.set(this.rgba.subarray(sy * this.width * 4, (sy + 1) * this.width * 4), y * this.width * 4);
          } else {
            for (let x = 0; x < this.width; x++) {
              const input = sy * this.width + this.width - x - 1, output = y * this.width + x;
              if (inputWords && outputWords) {
                outputWords[output] = inputWords[input];
              } else {
                for (let c = 0; c < 4; c++) {
                  result.rgba[output * 4 + c] = this.rgba[input * 4 + c];
                }
              }
            }
          }
        }
        return result;
      }
      /** Flip the surface horizontally. */
      flipX() {
        return this.flip({ horizontal: true });
      }
      /** Flip the surface vertically. */
      flipY() {
        return this.flip({ vertical: true });
      }
      /** Nearest neighbor with floor(x * sourceWidth / width), independently on each axis. */
      scaleNearest(width, height) {
        return this._resample(width, height);
      }
      /** Aspect fit with the original preview.ts shared-scale sampling convention. */
      fitNearest(maxEdge, { upscale = false } = {}) {
        if (!Number.isSafeInteger(maxEdge) || maxEdge < 1 || maxEdge > 2147483647) {
          throw new RangeError("Maximum edge must be an integer in [1, 2147483647].");
        }
        if (typeof upscale !== "boolean") {
          throw new TypeError("upscale must be a boolean.");
        }
        const scale = Math.min(upscale ? Infinity : 1, maxEdge / Math.max(this.width, this.height));
        return this._resample(Math.max(1, Math.floor(this.width * scale)), Math.max(1, Math.floor(this.height * scale)), scale);
      }
      _resample(width, height, scale) {
        if (!Number.isSafeInteger(width) || width < 1 || width > 2147483647) {
          throw new RangeError("Width must be an integer in [1, 2147483647].");
        }
        if (!Number.isSafeInteger(height) || height < 1 || height > 2147483647) {
          throw new RangeError("Height must be an integer in [1, 2147483647].");
        }
        if (!Number.isSafeInteger(this.maxPixels) || this.maxPixels < 1 || this.maxPixels > Number.MAX_SAFE_INTEGER) {
          throw new RangeError(`Pixel limit must be an integer in [1, ${Number.MAX_SAFE_INTEGER}].`);
        }
        if (!Number.isSafeInteger(width * height) || width * height > this.maxPixels) {
          throw new RangeError(`Image dimensions ${width}\xD7${height} exceed the pixel limit ${this.maxPixels}.`);
        }
        const result = new _RgbaSurface(width, height, void 0, { maxPixels: this.maxPixels });
        const offsets = new Uint32Array(width), inputWords = wordView(this.rgba), outputWords = wordView(result.rgba);
        for (let x = 0; x < width; x++) {
          offsets[x] = Math.min(this.width - 1, Math.floor(scale === void 0 ? x * this.width / width : x / scale));
        }
        for (let y = 0; y < height; y++) {
          const sy = Math.min(this.height - 1, Math.floor(scale === void 0 ? y * this.height / height : y / scale));
          const sourceRow = sy * this.width, destinationRow = y * width;
          if (inputWords && outputWords) {
            for (let x = 0; x < width; x++) {
              outputWords[destinationRow + x] = inputWords[sourceRow + offsets[x]];
            }
          } else {
            for (let x = 0; x < width; x++) {
              const input = (sourceRow + offsets[x]) * 4, output = (destinationRow + x) * 4;
              result.rgba[output] = this.rgba[input];
              result.rgba[output + 1] = this.rgba[input + 1];
              result.rgba[output + 2] = this.rgba[input + 2];
              result.rgba[output + 3] = this.rgba[input + 3];
            }
          }
        }
        return result;
      }
      /** Inclusive 1px Bresenham line. Clip the segment first to bound work by visible dimensions. */
      line(x0, y0, x1, y1, color) {
        if (!Number.isSafeInteger(x0) || x0 < -2147483647 || x0 > 2147483647) {
          throw new RangeError("Line x0 must be an integer in [-2147483647, 2147483647].");
        }
        if (!Number.isSafeInteger(y0) || y0 < -2147483647 || y0 > 2147483647) {
          throw new RangeError("Line y0 must be an integer in [-2147483647, 2147483647].");
        }
        if (!Number.isSafeInteger(x1) || x1 < -2147483647 || x1 > 2147483647) {
          throw new RangeError("Line x1 must be an integer in [-2147483647, 2147483647].");
        }
        if (!Number.isSafeInteger(y1) || y1 < -2147483647 || y1 > 2147483647) {
          throw new RangeError("Line y1 must be an integer in [-2147483647, 2147483647].");
        }
        colorRGBA(color);
        const dx = x1 - x0;
        const dy = y1 - y0;
        let start = 0;
        let end = 1;
        for (const [p, q] of [
          [-dx, x0],
          [dx, this.width - 1 - x0],
          [-dy, y0],
          [dy, this.height - 1 - y0]
        ]) {
          if (p === 0) {
            if (q < 0) {
              return this;
            }
            continue;
          }
          const ratio = q / p;
          if (p < 0) {
            start = Math.max(start, ratio);
          } else {
            end = Math.min(end, ratio);
          }
          if (start > end) {
            return this;
          }
        }
        x1 = Math.round(x0 + end * dx);
        y1 = Math.round(y0 + end * dy);
        x0 = Math.round(x0 + start * dx);
        y0 = Math.round(y0 + start * dy);
        if (x0 === x1) {
          return this.fill(color, {
            x: x0,
            y: Math.min(y0, y1),
            width: 1,
            height: Math.abs(y1 - y0) + 1
          });
        }
        if (y0 === y1) {
          return this.fill(color, {
            x: Math.min(x0, x1),
            y: y0,
            width: Math.abs(x1 - x0) + 1,
            height: 1
          });
        }
        const ax = Math.abs(x1 - x0), ay = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
        let error = ax + ay;
        while (true) {
          const offset = (y0 * this.width + x0) * 4;
          this.rgba[offset] = color[0];
          this.rgba[offset + 1] = color[1];
          this.rgba[offset + 2] = color[2];
          this.rgba[offset + 3] = color[3];
          if (x0 === x1 && y0 === y1) {
            break;
          }
          const doubled = error * 2;
          if (doubled >= ay) {
            error += ay;
            x0 += sx;
          }
          if (doubled <= ax) {
            error += ax;
            y0 += sy;
          }
        }
        return this;
      }
      measureText(text, options) {
        return BitmapText.measure(text, options);
      }
      drawText(text, x, y, color, options) {
        colorRGBA(color);
        drawBitmapText(this, text, x, y, color, options);
        return this;
      }
    };
  }
});

// node_modules/@uttori/data-tools/dist/image/data-image-png.js
function zlibState(inflator) {
  return inflator.strm;
}
function resolveLimits(options = {}) {
  const result = { ...DEFAULT_LIMITS };
  for (const key of Object.keys(result)) {
    const value = options[key];
    if (value !== void 0) {
      if (!Number.isSafeInteger(value) || value < 1 || value > Number.MAX_SAFE_INTEGER) {
        throw new RangeError(`${String(key)} must be an integer in [1, ${Number.MAX_SAFE_INTEGER}].`);
      }
      result[key] = value;
    }
  }
  return result;
}
function prepareInput(input, options, maxInputBytes) {
  if (options.copyInput !== void 0 && typeof options.copyInput !== "boolean") {
    throw new TypeError("copyInput must be a boolean.");
  }
  if (options.allow16Bit !== void 0 && typeof options.allow16Bit !== "boolean") {
    throw new TypeError("allow16Bit must be a boolean.");
  }
  if (options.animation !== void 0 && options.animation !== "reject" && options.animation !== "default-image") {
    throw new Error("animation must be reject or default-image.");
  }
  if (input instanceof data_buffer_default) {
    input = input.data;
  }
  if (typeof input === "number") {
    throw new TypeError("ImagePNG requires PNG data, not an allocation length.");
  }
  let bytes;
  if (input instanceof ArrayBuffer) {
    bytes = new Uint8Array(input);
  } else if (ArrayBuffer.isView(input)) {
    bytes = new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  } else if (Array.isArray(input) || typeof input === "string") {
    if (input.length > maxInputBytes) {
      throw new RangeError("PNG exceeds the input byte limit.");
    }
    bytes = new data_buffer_default(input).data;
  } else {
    throw new TypeError("ImagePNG requires PNG bytes or a DataBuffer.");
  }
  if (bytes.length > maxInputBytes) {
    throw new RangeError("PNG exceeds the input byte limit.");
  }
  if (options.copyInput === false) {
    return bytes;
  }
  return Uint8Array.from(bytes);
}
function passLength(size, start, step) {
  if (size <= start) {
    return 0;
  }
  return Math.ceil((size - start) / step);
}
function paethPredictor(left, above, upperLeft) {
  const prediction = left + above - upperLeft;
  const leftDistance = Math.abs(prediction - left);
  const aboveDistance = Math.abs(prediction - above);
  const upperLeftDistance = Math.abs(prediction - upperLeft);
  if (leftDistance <= aboveDistance && leftDistance <= upperLeftDistance) {
    return left;
  }
  if (aboveDistance <= upperLeftDistance) {
    return above;
  }
  return upperLeft;
}
function unfilterRow(row, previous, bpp, length, filter) {
  const leading = Math.min(bpp, length);
  switch (filter) {
    case 0:
      break;
    case 1:
      for (let i = bpp; i < length; i++) {
        row[i] += row[i - bpp];
      }
      break;
    case 2:
      for (let i = 0; i < length; i++) {
        row[i] += previous[i];
      }
      break;
    case 3:
      for (let i = 0; i < leading; i++) {
        row[i] += previous[i] >>> 1;
      }
      for (let i = leading; i < length; i++) {
        row[i] += row[i - bpp] + previous[i] >>> 1;
      }
      break;
    case 4:
      for (let i = 0; i < leading; i++) {
        row[i] += previous[i];
      }
      for (let i = leading; i < length; i++) {
        row[i] += paethPredictor(row[i - bpp], previous[i], previous[i - bpp]);
      }
      break;
    default:
      throw new Error(`Invalid PNG scanline filter ${filter}.`);
  }
}
function unfilterScanline(filter, pixels, scanline, bpp, offset, length) {
  if (!Number.isSafeInteger(bpp) || bpp < 1 || bpp > 2147483647) {
    throw new RangeError("Unfilter stride must be an integer in [1, 2147483647].");
  }
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 2147483647) {
    throw new RangeError("Unfilter offset must be an integer in [0, 2147483647].");
  }
  if (!Number.isSafeInteger(length) || length < 0 || length > 2147483647) {
    throw new RangeError("Unfilter length must be an integer in [0, 2147483647].");
  }
  if (offset + length > pixels.length || length > scanline.length) {
    throw new RangeError("Unfilter buffer is too small.");
  }
  const row = Uint8Array.from(scanline.slice(0, length));
  const previous = new Uint8Array(length);
  if (offset >= length) {
    for (let i = 0; i < length; i++) {
      previous[i] = pixels[offset - length + i];
    }
  }
  unfilterRow(row, previous, bpp, length, filter);
  if (pixels instanceof Uint8Array) {
    pixels.set(row, offset);
  } else {
    for (let i = 0; i < length; i++) {
      pixels[offset + i] = row[i];
    }
  }
  return pixels;
}
function validateIndexed(image, bitDepth, maxPixels) {
  if (!Number.isSafeInteger(image.width) || image.width < 1 || image.width > 2147483647) {
    throw new RangeError("Width must be an integer in [1, 2147483647].");
  }
  if (!Number.isSafeInteger(image.height) || image.height < 1 || image.height > 2147483647) {
    throw new RangeError("Height must be an integer in [1, 2147483647].");
  }
  if (!Number.isSafeInteger(image.width * image.height) || image.width * image.height > maxPixels) {
    throw new RangeError(`Image dimensions ${image.width}x${image.height} exceed the pixel limit ${maxPixels}.`);
  }
  if (bitDepth !== 1 && bitDepth !== 2 && bitDepth !== 4 && bitDepth !== 8) {
    throw new Error("Indexed bit depth must be 1, 2, 4, or 8.");
  }
  if (!Array.isArray(image.palette)) {
    throw new TypeError("Palette must be an array of RGBA8 slots.");
  }
  if (!Number.isSafeInteger(image.palette.length) || image.palette.length < 1 || image.palette.length > 2 ** bitDepth) {
    throw new RangeError(`Palette slots must be an integer in [1, ${2 ** bitDepth}].`);
  }
  for (const color of image.palette) {
    if (!Array.isArray(color) || color.length !== 4) {
      throw new Error("Palette entries require RGBA8.");
    }
    for (const value of color) {
      if (!Number.isSafeInteger(value) || value < 0 || value > 255) {
        throw new RangeError("Palette component must be an integer in [0, 255].");
      }
    }
  }
  if (!(image.indexes instanceof Uint8Array) || image.indexes.length !== image.width * image.height) {
    throw new Error("Indexed buffer length does not match dimensions.");
  }
  for (const index of image.indexes) {
    if (index >= image.palette.length) {
      throw new Error("PNG pixel index exceeds palette slots.");
    }
  }
}
function joinChunks(parts, maxBytes) {
  let length = 0;
  for (const part of parts) {
    length += part.length;
  }
  if (!Number.isSafeInteger(length) || length > maxBytes) {
    throw new RangeError("PNG exceeds the output byte limit.");
  }
  const output = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}
function makeChunk(type, data) {
  if (!/^[A-Za-z]{2}[A-Z][A-Za-z]$/.test(type)) {
    throw new Error(`Invalid PNG chunk type '${type}'.`);
  }
  if (!Number.isSafeInteger(data.length) || data.length < 0 || data.length > 2147483647) {
    throw new RangeError("Chunk length must be an integer in [0, 2147483647].");
  }
  const header = data_buffer_default.allocate(8);
  header.writeUInt32(data.length);
  header.writeString(type);
  header.commit();
  const output = new Uint8Array(data.length + 12);
  output.set(header.data);
  output.set(data, 8);
  const checksum2 = data_buffer_default.allocate(4);
  checksum2.writeUInt32(computeBytes(output.subarray(4, data.length + 8)));
  checksum2.commit();
  output.set(checksum2.data, data.length + 8);
  return output;
}
function makeHeader(width, height, bitDepth, colorType) {
  const header = data_buffer_default.allocate(13);
  header.writeUInt32(width);
  header.writeUInt32(height);
  header.writeUInt8(bitDepth);
  header.writeUInt8(colorType);
  header.writeUInt8(0);
  header.writeUInt8(0);
  header.writeUInt8(0);
  header.commit();
  return header.data;
}
function makePaletteChunks(palette) {
  const rgb = new Uint8Array(palette.length * 3);
  const alpha = new Uint8Array(palette.length);
  for (let i = 0; i < palette.length; i++) {
    const color = palette[i];
    rgb[i * 3] = color[0];
    rgb[i * 3 + 1] = color[1];
    rgb[i * 3 + 2] = color[2];
    alpha[i] = color[3];
  }
  return [makeChunk("PLTE", rgb), makeChunk("tRNS", alpha)];
}
var debug3, PNG_SIGNATURE, ADAM7_PASSES, SINGLE_PASS, COLOR_DEPTHS, ANIMATION_CHUNKS, DEFAULT_LIMITS, ImagePNG, data_image_png_default;
var init_data_image_png = __esm({
  async "node_modules/@uttori/data-tools/dist/image/data-image-png.js"() {
    init_pako();
    await init_data_buffer();
    init_data_hash_crc32();
    init_rgba_surface();
    debug3 = () => {
    };
    if (typeof process !== "undefined" && process.env.UTTORI_DATA_DEBUG) {
      try {
        const { default: d } = await Promise.resolve().then(() => __toESM(require_src(), 1));
        debug3 = d("Uttori.ImagePNG");
      } catch {
      }
    }
    PNG_SIGNATURE = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10);
    ADAM7_PASSES = [
      [0, 0, 8, 8],
      [4, 0, 8, 8],
      [0, 4, 4, 8],
      [2, 0, 4, 4],
      [0, 2, 2, 4],
      [1, 0, 2, 2],
      [0, 1, 1, 2]
    ];
    SINGLE_PASS = [[0, 0, 1, 1]];
    COLOR_DEPTHS = {
      0: [1, 2, 4, 8, 16],
      2: [8, 16],
      3: [1, 2, 4, 8],
      4: [8, 16],
      6: [8, 16]
    };
    ANIMATION_CHUNKS = /* @__PURE__ */ new Set(["acTL", "fcTL", "fdAT"]);
    DEFAULT_LIMITS = Object.freeze({
      maxInputBytes: 64 * 1024 * 1024,
      maxPixels: 4 * 1024 * 1024,
      maxInflatedBytes: 64 * 1024 * 1024,
      maxOutputBytes: 64 * 1024 * 1024,
      maxChunks: 16384
    });
    ImagePNG = class _ImagePNG extends data_buffer_default {
      /** Pixel Width */
      width;
      /** Pixel Height */
      height;
      /** Image Bit Depth, one of: 1, 2, 4, 8, 16 */
      bitDepth;
      /** Defines pixel structure, one of: 0, 2, 3, 4, 6 */
      colorType;
      /** Type of compression, always 0 */
      compressionMethod;
      /** Type of filtering, always 0 */
      filterMethod;
      /** Type of interlacing, one of: 0, 1 */
      interlaceMethod;
      /** Number of native samples per pixel, not the number of packed bytes. */
      colors;
      /** True when the image has an alpha transparency layer */
      alpha;
      /** Raw Color data */
      palette;
      /** Row-major native samples, with one element per sample or index. */
      pixels;
      /** Raw Transparency data */
      transparency;
      /** Object containing physical dimension information */
      physical;
      /** Image Data pieces */
      dataChunks;
      /** PNG Signature from the data */
      header;
      /** Validated chunks, including views of their original framing and CRC. */
      chunks;
      /** Whether animation chunks were found under the explicit default-image policy. */
      animated;
      /** Decoder policies captured at construction. */
      options;
      /** True when the image has been decoded */
      _decoded;
      /** Validated allocation bounds, reused for parsing and decoding. */
      _limits;
      /** Chunk names used for singleton and ordering checks. */
      _seenChunks;
      /** Whether a non-IDAT chunk has ended the contiguous IDAT sequence. */
      _dataEnded;
      /**
       * Creates a new ImagePNG.
       *
       * The container is validated immediately; native pixels are decoded on demand.
       * @param input The data to process.
       * @param options Ownership, allocation limits, and format policies.
       * @throws {Error} Signature, framing, CRC, ordering, or metadata are invalid.
       */
      constructor(input, options = {}) {
        const limits = resolveLimits(options);
        super(prepareInput(input, options, limits.maxInputBytes));
        this.width = 0;
        this.height = 0;
        this.bitDepth = 0;
        this.colorType = 0;
        this.compressionMethod = 0;
        this.filterMethod = 0;
        this.interlaceMethod = 0;
        this.colors = 0;
        this.alpha = false;
        this.palette = new Uint8Array();
        this.pixels = new Uint8Array();
        this.transparency = new Uint8Array();
        this.physical = { width: 0, height: 0, unit: 0 };
        this.dataChunks = [];
        this.header = new Uint8Array();
        this.chunks = [];
        this.animated = false;
        this.options = Object.freeze({ ...options });
        this._decoded = false;
        this._limits = Object.freeze(limits);
        this._seenChunks = /* @__PURE__ */ new Set();
        this._dataEnded = false;
        this.parse();
      }
      /**
       * Creates a new ImagePNG from file data.
       *
       * The container is validated immediately; native pixels are decoded on demand.
       * @param data The data of the image to process.
       * @param options Ownership, allocation limits, and format policies.
       * @returns {ImagePNG} the new ImagePNG instance for the provided file data
       * @static
       */
      static fromFile(data, options = {}) {
        debug3("fromFile");
        return new _ImagePNG(data, options);
      }
      /**
       * Creates a new ImagePNG from a DataBuffer.
       *
       * The container is validated immediately; native pixels are decoded on demand.
       * @param buffer The DataBuffer of the image to process.
       * @param options Ownership, allocation limits, and format policies.
       * @returns the new ImagePNG instance for the provided DataBuffer
       * @static
       */
      static fromBuffer(buffer, options = {}) {
        debug3("fromBuffer:", buffer.length);
        return new _ImagePNG(buffer, options);
      }
      /**
       * Sets the bitDepth on the ImagePNG instance.
       *
       * Discard samples decoded with the old layout. The complete color/depth
       * combination is checked before decoding.
       * @param bitDepth The bitDepth to set, one of: 1, 2, 4, 8, 16
       * @throws {Error} The depth is invalid or disabled by caller policy.
       */
      setBitDepth(bitDepth) {
        debug3("setBitDepth:", bitDepth);
        if (![1, 2, 4, 8, 16].includes(bitDepth)) {
          throw new Error(`Invalid Bit Depth: ${bitDepth}, can be one of: 1, 2, 4, 8, 16`);
        }
        if (bitDepth === 16 && this.options.allow16Bit === false) {
          throw new Error("16-bit PNG samples are disabled by caller policy.");
        }
        this.bitDepth = bitDepth;
        this.invalidatePixels();
      }
      /**
       * Sets the colorType on the ImagePNG instance.
       * Both color and alpha properties are inferred from the colorType.
       *
       * | Color Type | Allowed Bit Depths | Interpretation |
       * |------------|--------------------|----------------|
       * | 0          | 1, 2, 4, 8, 16     | Each pixel is a grayscale sample.
       * | 2          | 8, 16              | Each pixel is an R, G, B triple.
       * | 3          | 1, 2, 4, 8         | Each pixel is a palette index; a `PLTE` chunk must appear.
       * | 4          | 8, 16              | Each pixel is a grayscale sample, followed by an alpha sample.
       * | 6          | 8, 16              | Each pixel is an R, G, B triple, followed by an alpha sample.
       *
       * Discard samples decoded with the old layout.
       * @param colorType The colorType to set, one of: 0, 2, 3, 4, 6
       * @throws {Error} Invalid Color Type, anything other than 0, 2, 3, 4, 6
       */
      setColorType(colorType) {
        debug3("setColorType:", colorType);
        let colors = 0;
        let alpha = false;
        switch (colorType) {
          case 0:
          case 3:
            colors = 1;
            break;
          case 2:
            colors = 3;
            break;
          case 4:
            colors = 2;
            alpha = true;
            break;
          case 6:
            colors = 4;
            alpha = true;
            break;
          default:
            throw new Error(`Invalid Color Type: ${colorType}, can be one of: 0, 2, 3, 4, 6`);
        }
        this.colors = colors;
        this.alpha = alpha;
        this.colorType = colorType;
        this.invalidatePixels();
      }
      /**
       * Sets the compressionMethod on the ImagePNG instance.
       * The compressionMethod should always be 0.
       * @param compressionMethod The compressionMethod to set, always 0
       * @throws {Error} Unsupported Compression Method, anything other than 0
       */
      setCompressionMethod(compressionMethod) {
        if (compressionMethod !== 0) {
          throw new Error(`Unsupported Compression Method: ${compressionMethod}, should be 0`);
        }
        this.compressionMethod = compressionMethod;
      }
      /**
       * Sets the filterMethod on the ImagePNG instance.
       * The filterMethod should always be 0.
       * @param filterMethod The filterMethod to set, always 0
       * @throws {Error} Unsupported Filter Method, anything other than 0
       */
      setFilterMethod(filterMethod) {
        if (filterMethod !== 0) {
          throw new Error(`Unsupported Filter Method: ${filterMethod}, should be 0`);
        }
        this.filterMethod = filterMethod;
      }
      /**
       * Sets the interlaceMethod on the ImagePNG instance.
       * The interlaceMethod should always be 0 or 1.
       *
       * Discard samples decoded with the old layout.
       * @param interlaceMethod The interlaceMethod to set, always 0 or 1
       * @throws {Error} Unsupported Interlace Method, anything other than 0 or 1
       */
      setInterlaceMethod(interlaceMethod) {
        if (interlaceMethod !== 0 && interlaceMethod !== 1) {
          throw new Error(`Unsupported Interlace Method: ${interlaceMethod}`);
        }
        this.interlaceMethod = interlaceMethod;
        this.invalidatePixels();
      }
      /**
       * Sets the palette on the ImagePNG instance.
       *
       * Palette slots retain their identity; duplicate RGB triples are not deduplicated.
       * @param palette The palette to set
       * @throws {Error} No colors in the palette
       * @throws {Error} Too many colors for the current bit depth
       * @throws {Error} Components, transparency length, or referenced slots are invalid.
       */
      setPalette(palette) {
        if (!Array.isArray(palette) && !(palette instanceof Uint8Array) || palette.length === 0 || palette.length % 3 !== 0 || palette.length > 768) {
          throw new Error("Invalid PNG palette; expected 1 to 256 RGB triples.");
        }
        const count = palette.length / 3;
        if (this.colorType === 3 && count > 2 ** this.bitDepth) {
          throw new Error(`Palette contains more than ${2 ** this.bitDepth} colors.`);
        }
        for (const value of palette) {
          if (!Number.isSafeInteger(value) || value < 0 || value > 255) {
            throw new RangeError("Palette byte must be an integer in [0, 255].");
          }
        }
        if (this.colorType === 3) {
          if (this.transparency.length > count) {
            throw new Error("Transparency exceeds the new palette.");
          }
          if (this._decoded) {
            for (const index of this.pixels) {
              if (index >= count) {
                throw new Error("Decoded index exceeds the new palette.");
              }
            }
          }
        }
        this.palette = Uint8Array.from(palette);
      }
      /** Discard decoded native samples without changing the original compressed IDAT data. */
      invalidatePixels() {
        this._decoded = false;
        if (this.pixels.length !== 0) {
          this.pixels = new Uint8Array();
        }
      }
      /**
       * Parse the PNG file, decoding the supported chunks.
       *
       * Start from the beginning and reset metadata and cached samples.
       * @returns This image.
       * @throws {Error} Required chunks are missing or any chunk fails validation.
       */
      parse() {
        debug3("parse");
        if (this.data.length > this._limits.maxInputBytes) {
          throw new RangeError("PNG exceeds the input byte limit.");
        }
        this.reset();
        this.palette = new Uint8Array();
        this.transparency = new Uint8Array();
        this.physical = { width: 0, height: 0, unit: 0 };
        this.dataChunks = [];
        this.chunks = [];
        this.animated = false;
        this._seenChunks.clear();
        this._dataEnded = false;
        this.invalidatePixels();
        this.decodeHeader();
        while (this.remainingBytes() > 0) {
          if (this.decodeChunk() === "IEND") {
            break;
          }
        }
        if (!this._seenChunks.has("IHDR") || !this._seenChunks.has("IEND")) {
          throw new Error("PNG is missing IHDR or IEND.");
        }
        this._expectedInflatedBytes();
        return this;
      }
      /**
       * Decodes and validates PNG Header.
       * Signature (Decimal): [137, 80, 78, 71, 13, 10, 26, 10]
       * Signature (Hexadecimal): [89, 50, 4E, 47, 0D, 0A, 1A, 0A]
       * Signature (ASCII): [\211, P, N, G, \r, \n, \032, \n]
       * @throws {Error} Missing or invalid PNG header
       * @throws {Error} The header is not being read from offset zero.
       * @see {@link http://www.w3.org/TR/2003/REC-PNG-20031110/#5PNG-file-signature|PNG Signature}
       */
      decodeHeader() {
        if (this.offset !== 0) {
          throw new Error("PNG header must be read at offset zero.");
        }
        if (!this.isNextBytes(PNG_SIGNATURE)) {
          throw new Error("Missing or invalid PNG header.");
        }
        this.header = this.read(PNG_SIGNATURE.length);
      }
      /**
       * Decodes the chunk type, and attempts to parse that chunk if supported.
       * Supported Chunk Types: IHDR, PLTE, IDAT, IEND, tRNS, pHYs
       *
       * Chunk Structure:
       * Length: 4 bytes
       * Type:   4 bytes (IHDR, PLTE, IDAT, IEND, etc.)
       * Chunk:  {length} bytes
       * CRC:    4 bytes
       *
       * Validate CRCs, chunk ordering, and bounds before dispatching.
       * Ancillary records retain their original framing for indexed rewriting.
       * @returns {string} Chunk Type
       * @throws {Error} Invalid chunk length, CRC, ordering, or critical chunk type.
       * @see {@link http://www.w3.org/TR/2003/REC-PNG-20031110/#5Chunk-layout|Chunk Layout}
       */
      decodeChunk() {
        const offset = this.offset;
        if (!Number.isSafeInteger(offset) || offset < 8 || offset > this.data.length) {
          throw new RangeError(`Chunk offset must be an integer in [8, ${this.data.length}].`);
        }
        if (this.chunks.length >= this._limits.maxChunks) {
          throw new RangeError("PNG exceeds the chunk count limit.");
        }
        if (this._seenChunks.has("IEND")) {
          throw new Error("PNG contains data after IEND.");
        }
        if (!this.available(12)) {
          throw new Error("Truncated PNG chunk header.");
        }
        const length = this.peekUInt32(offset);
        if (length > 2147483647 || length > this.data.length - offset - 12) {
          throw new Error("Invalid PNG chunk length.");
        }
        const end = offset + length + 12;
        const type = this.peekString(offset + 4, 4);
        if (!/^[A-Za-z]{2}[A-Z][A-Za-z]$/.test(type)) {
          throw new Error(`Invalid PNG chunk type '${type}'.`);
        }
        const expectedCrc = this.peekUInt32(end - 4);
        const actualCrc = computeBytes(this.data.subarray(offset + 4, end - 4));
        if (expectedCrc !== actualCrc) {
          throw new Error(`PNG ${type} CRC mismatch.`);
        }
        if (!this._seenChunks.has("IHDR") && type !== "IHDR") {
          throw new Error("PNG IHDR must be first.");
        }
        const chunk = this.data.subarray(offset + 8, end - 4);
        const critical = (this.peekUInt8(offset + 4) & 32) === 0;
        const dataSeen = this.dataChunks.length !== 0;
        debug3("decodeChunk:", type, "length:", length);
        switch (type) {
          case "IHDR":
            if (this._seenChunks.has(type)) {
              throw new Error("PNG requires exactly one IHDR.");
            }
            this.decodeIHDR(chunk);
            break;
          case "PLTE":
            if (this._seenChunks.has(type) || dataSeen || this._seenChunks.has("tRNS") || this.colorType === 0 || this.colorType === 4) {
              throw new Error("Invalid PNG PLTE placement.");
            }
            this.decodePLTE(chunk);
            break;
          case "tRNS":
            if (this._seenChunks.has(type) || dataSeen) {
              throw new Error("Invalid PNG tRNS placement.");
            }
            this.decodeTRNS(chunk);
            break;
          case "pHYs":
            if (this._seenChunks.has(type) || dataSeen) {
              throw new Error("Invalid PNG pHYs placement.");
            }
            this.decodePHYS(chunk);
            break;
          case "IDAT":
            if (this._dataEnded || this.colorType === 3 && !this._seenChunks.has("PLTE")) {
              throw new Error("PNG IDAT chunks must be contiguous and follow PLTE.");
            }
            this.decodeIDAT(chunk);
            break;
          case "IEND":
            if (!dataSeen || end !== this.data.length) {
              throw new Error("Invalid PNG IEND chunk or trailing file bytes.");
            }
            this.decodeIEND(chunk);
            break;
          // case 'cHRM': decodeCHRM(chunk); break;
          // case 'gAMA': decodeGAMA(chunk); break;
          // case 'bKGD': decodeBKGD(chunk); break;
          // case 'tIME': decodeTIME(chunk); break;
          // case 'tEXt': decodeTEXT(chunk); break;
          // case 'iTXt': decodeITXT(chunk); break;
          // case 'sRGB': decodeSRGB(chunk); break;
          // case 'sBIT': decodeSBIT(chunk); break;
          default:
            if (critical) {
              throw new Error(`Unsupported critical PNG chunk '${type}'.`);
            }
            if (ANIMATION_CHUNKS.has(type)) {
              if (this.options.animation !== "default-image") {
                throw new Error("Animated PNG is not supported; request animation: default-image explicitly.");
              }
              this.animated = true;
            }
            break;
        }
        this.chunks.push({
          type,
          offset,
          end,
          length,
          data: chunk,
          raw: this.data.subarray(offset, end),
          critical,
          safeToCopy: (this.peekUInt8(offset + 7) & 32) !== 0
        });
        this._seenChunks.add(type);
        if (dataSeen && type !== "IDAT") {
          this._dataEnded = true;
        }
        this.seek(end);
        return type;
      }
      /**
       * Decode the IHDR (Image header) chunk.
       * Should be the first chunk in the data stream.
       *
       * Width:              4 bytes
       * Height:             4 bytes
       * Bit Depth:          1 byte
       * Colour Type:        1 byte
       * Compression Method: 1 byte
       * Filter Method:      1 byte
       * Interlace Method:   1 byte
       * @param chunk Data Blob
       * @throws {Error} Dimensions, sample layout, or PNG methods are invalid.
       * @see {@link http://www.w3.org/TR/2003/REC-PNG-20031110/#11IHDR|Image Header}
       * @see {@link http://www.libpng.org/pub/png/spec/1.2/png-1.2-pdg.html#C.IHDR|Image Header}
       */
      decodeIHDR(chunk) {
        if (chunk.length !== 13) {
          throw new Error("PNG requires a 13-byte IHDR.");
        }
        const header = new data_buffer_default(chunk);
        const width = header.readUInt32();
        const height = header.readUInt32();
        const bitDepth = header.readUInt8();
        const colorType = header.readUInt8();
        const compressionMethod = header.readUInt8();
        const filterMethod = header.readUInt8();
        const interlaceMethod = header.readUInt8();
        if (!Number.isSafeInteger(width) || width < 1 || width > 2147483647) {
          throw new RangeError("Width must be an integer in [1, 2147483647].");
        }
        if (!Number.isSafeInteger(height) || height < 1 || height > 2147483647) {
          throw new RangeError("Height must be an integer in [1, 2147483647].");
        }
        if (!Number.isSafeInteger(width * height) || width * height > this._limits.maxPixels) {
          throw new RangeError(`Image dimensions ${width}x${height} exceed the pixel limit ${this._limits.maxPixels}.`);
        }
        if (!COLOR_DEPTHS[colorType]?.includes(bitDepth)) {
          throw new Error(`Invalid PNG color type ${colorType} at ${bitDepth} bits.`);
        }
        this.width = width;
        this.height = height;
        this.setBitDepth(bitDepth);
        this.setColorType(colorType);
        this.setCompressionMethod(compressionMethod);
        this.setFilterMethod(filterMethod);
        this.setInterlaceMethod(interlaceMethod);
      }
      /**
       * Decode the PLTE (Palette) chunk.
       * The PLTE chunk contains from 1 to 256 palette entries, each a three-byte series of the form.
       * The number of entries is determined from the chunk length. A chunk length not divisible by 3 is an error.
       *
       * Preserve the original palette slot order, including duplicate colors.
       * @param chunk Data Blob
       * @see {@link http://www.w3.org/TR/PNG/#11PLTE|Palette}
       */
      decodePLTE(chunk) {
        this.setPalette(chunk);
      }
      /**
       * Decode the IDAT (Image Data) chunk.
       * The IDAT chunk contains the actual image data which is the output stream of the compression algorithm.
       *
       * Retain a payload view for bounded inflation on demand and invalidate cached
       * samples. Empty IDAT chunks are legal.
       * @param chunk Data Blob
       * @see {@link http://www.w3.org/TR/2003/REC-PNG-20031110/#11IDAT|Image Data}
       */
      decodeIDAT(chunk) {
        this.dataChunks.push(chunk);
        this.invalidatePixels();
      }
      /**
       * Decode the tRNS (Transparency) chunk.
       * The tRNS chunk specifies that the image uses simple transparency: either alpha values associated with palette entries (for indexed-color images) or a single transparent color (for grayscale and truecolor images). Although simple transparency is not as elegant as the full alpha channel, it requires less storage space and is sufficient for many common cases.
       * @param chunk Data Blob
       * @throws {Error} Transparency is incompatible with the color type or sample depth.
       * @see {@link https://www.w3.org/TR/PNG/#11tRNS|Transparency}
       */
      decodeTRNS(chunk) {
        switch (this.colorType) {
          case 3:
            if (this.palette.length === 0 || chunk.length === 0 || chunk.length > this.palette.length / 3) {
              throw new Error("Invalid indexed PNG tRNS chunk.");
            }
            break;
          case 0:
            if (chunk.length !== 2) {
              throw new Error("Grayscale PNG tRNS requires two bytes.");
            }
            break;
          case 2:
            if (chunk.length !== 6) {
              throw new Error("RGB PNG tRNS requires six bytes.");
            }
            break;
          default:
            throw new Error("PNG color types with alpha cannot contain tRNS.");
        }
        if (this.colorType !== 3) {
          const maximum = 2 ** this.bitDepth - 1;
          const buffer = new data_buffer_default(chunk);
          while (buffer.remainingBytes() > 0) {
            if (buffer.readUInt16() > maximum) {
              throw new Error("PNG tRNS sample exceeds bit depth.");
            }
          }
        }
        this.transparency = Uint8Array.from(chunk);
      }
      /**
       * Decode the pHYs (Pixel Dimensions) chunk.
       * The pHYs chunk specifies the intended pixel size or aspect ratio for display of the image.
       * When the unit specifier is 0, the pHYs chunk defines pixel aspect ratio only; the actual size of the pixels remains unspecified.
       * If the pHYs chunk is not present, pixels are assumed to be square, and the physical size of each pixel is unspecified.
       *
       * Structure:
       * Pixels per unit, X axis: 4 bytes (unsigned integer)
       * Pixels per unit, Y axis: 4 bytes (unsigned integer)
       * Unit specifier:          1 byte
       * 0: unit is unknown
       * 1: unit is the meter
       *
       * Keep the raw pixels-per-unit values. When unit is 1, multiplying by 0.0254
       * converts pixels per meter to pixels per inch without changing stored metadata.
       * @param chunk Data Blob
       * @throws {Error} The length or unit specifier is invalid.
       * @see {@link https://www.w3.org/TR/PNG/#11pHYs|Pixel Dimensions}
       */
      decodePHYS(chunk) {
        if (chunk.length !== 9) {
          throw new Error("Invalid PNG pHYs chunk.");
        }
        const buffer = new data_buffer_default(chunk);
        const width = buffer.readUInt32();
        const height = buffer.readUInt32();
        const unit = buffer.readUInt8();
        if (unit > 1) {
          throw new Error("Invalid PNG pHYs chunk.");
        }
        this.physical = { width, height, unit };
      }
      /**
       * Decode the IEND (Image trailer) chunk.
       * The IEND chunk marks the end of the PNG DataBuffer. The chunk's data field is empty.
       * @param chunk The IEND payload, which must have no bytes.
       * @throws {Error} IEND contains data.
       * @see {@link http://www.w3.org/TR/2003/REC-PNG-20031110/#11IEND|Image Trailer}
       */
      decodeIEND(chunk) {
        if (chunk.length !== 0) {
          throw new Error("IEND must be empty.");
        }
      }
      /**
       * Measure the exact decompressed layout, including filter bytes for each pass.
       * @param interlaceMethod The layout to measure; defaults to the current IHDR value.
       * @returns Expected filtered scanline byte count.
       * @throws {Error} The layout is invalid or exceeds the inflation limit.
       */
      _expectedInflatedBytes(interlaceMethod = this.interlaceMethod) {
        if (!Number.isSafeInteger(this.width) || this.width < 1 || this.width > 2147483647) {
          throw new RangeError("Width must be an integer in [1, 2147483647].");
        }
        if (!Number.isSafeInteger(this.height) || this.height < 1 || this.height > 2147483647) {
          throw new RangeError("Height must be an integer in [1, 2147483647].");
        }
        if (!Number.isSafeInteger(this.width * this.height) || this.width * this.height > this._limits.maxPixels) {
          throw new RangeError(`Image dimensions ${this.width}x${this.height} exceed the pixel limit ${this._limits.maxPixels}.`);
        }
        if (!COLOR_DEPTHS[this.colorType]?.includes(this.bitDepth)) {
          throw new Error(`Invalid PNG color type ${this.colorType} at ${this.bitDepth} bits.`);
        }
        if (interlaceMethod !== 0 && interlaceMethod !== 1) {
          throw new Error(`Unsupported Interlace Method: ${interlaceMethod}`);
        }
        let passes = SINGLE_PASS;
        if (interlaceMethod === 1) {
          passes = ADAM7_PASSES;
        }
        let expected = 0;
        for (const [startX, startY, stepX, stepY] of passes) {
          const width = passLength(this.width, startX, stepX);
          const height = passLength(this.height, startY, stepY);
          if (width !== 0 && height !== 0) {
            const rowBytes = Math.ceil(width * this.colors * this.bitDepth / 8);
            expected += height * (rowBytes + 1);
          }
        }
        if (!Number.isSafeInteger(expected) || expected > this._limits.maxInflatedBytes) {
          throw new RangeError("PNG exceeds the inflated byte limit.");
        }
        return expected;
      }
      /**
       * Uncompress IDAT chunks.
       *
       * Reverse scanline filters and unpack native samples after bounded inflation.
       * Successful decodes are cached. Forcing a decode discards in-memory pixel edits
       * and reconstructs the source IDAT; failures never expose partial pixel buffers.
       * @param options Cache control for this decode.
       * @param options.force Discard cached samples and decode the source again.
       * @returns Row-major native samples, retaining original palette indexes.
       * @throws {Error} No IDAT chunks to decode
       * @throws {Error} Deinterlacing Error
       * @throws {Error} Inflating Error
       * @throws {Error} Compressed data, scanline lengths, filters, or indexes are invalid.
       */
      decodePixels({ force = false } = {}) {
        if (typeof force !== "boolean") {
          throw new TypeError("force must be a boolean.");
        }
        if (this._decoded && !force) {
          return this.pixels;
        }
        this.invalidatePixels();
        if (this.dataChunks.length === 0) {
          throw new Error("No IDAT chunks to decode.");
        }
        const expected = this._expectedInflatedBytes();
        const output = new Uint8Array(expected);
        const inflator = new Inflate({
          windowBits: 15,
          chunkSize: 16 * 1024
        });
        const zlib = zlibState(inflator);
        let written = 0;
        let compressedLength = 0;
        let ended = false;
        let errorCode = 0;
        inflator.onData = (chunk) => {
          if (written + chunk.length > expected) {
            throw new Error("PNG inflated data exceeds declared dimensions.");
          }
          output.set(chunk, written);
          written += chunk.length;
        };
        inflator.onEnd = (status) => {
          ended = true;
          errorCode = status;
        };
        for (const chunk of this.dataChunks) {
          if (chunk.length === 0) {
            continue;
          }
          if (ended) {
            throw new Error("PNG has compressed data after the zlib stream.");
          }
          compressedLength += chunk.length;
          if (compressedLength > this._limits.maxInputBytes) {
            throw new RangeError("PNG exceeds the input byte limit.");
          }
          if (!inflator.push(chunk, false) || errorCode !== 0) {
            throw new Error(`Invalid PNG image data: ${zlib.msg || "inflate failure"}.`);
          }
          if (zlib.avail_in !== 0) {
            throw new Error("PNG has trailing bytes after the zlib stream.");
          }
        }
        if (!ended || errorCode !== 0 || written !== expected) {
          throw new Error("Invalid PNG image data: incomplete zlib stream or scanline length mismatch.");
        }
        if (zlib.total_in !== compressedLength) {
          throw new Error("PNG IDAT must contain exactly one zlib stream.");
        }
        if (this.interlaceMethod === 0) {
          return this.interlaceNone(output);
        }
        return this.interlaceAdam7(output);
      }
      /**
       * Deinterlace with no interlacing.
       * @param data Data to deinterlace.
       * @returns Native samples, also stored in pixels on success.
       * @see {@link https://www.w3.org/TR/PNG-Filters.html|PNG Filters}
       */
      interlaceNone(data) {
        return this._decodeScanlines(data, 0);
      }
      /**
       * Deinterlace with Adam7 interlacing.
       * Adam7 divides the image into 7 passes with different starting positions and step sizes.
       *
       * Empty passes consume neither filter bytes nor row bytes. Scatter decoded
       * samples into row-major image order without converting palette indexes.
       * @param data Data to deinterlace.
       * @returns Native samples, also stored in pixels on success.
       * @see {@link https://www.w3.org/TR/PNG/#8Interlace|PNG Adam7 Interlacing}
       * @see {@link https://github.com/em2046/lens/blob/master/assets/js/interlace.js}
       * @see {@link https://github.com/em2046/aperture/tree/master/lib/png/chunks}
       * @see {@link https://github.com/beejjorgensen/jsmandel/blob/master/src/js/adam7.js}
       * @see {@link http://diyhpl.us/~yenatch/pokecrystal/src/pypng/code/png.py}
       * @see {@link https://github.com/SixLabors/ImageSharp/blob/master/src/ImageSharp/Formats/Png/Adam7.cs}
       */
      interlaceAdam7(data) {
        return this._decodeScanlines(data, 1);
      }
      /**
       * Share row reconstruction and native sample unpacking across interlace modes.
       * @param data Exact filtered scanline bytes.
       * @param interlaceMethod Zero for the full image, or one for Adam7 passes.
       * @returns The fully reconstructed native sample buffer.
       */
      _decodeScanlines(data, interlaceMethod) {
        this.invalidatePixels();
        if (data.length !== this._expectedInflatedBytes(interlaceMethod)) {
          throw new Error("PNG scanline length mismatch.");
        }
        const { width, height, colors, bitDepth } = this;
        const sampleCount = width * height * colors;
        let samples;
        if (bitDepth === 16) {
          samples = new Uint16Array(sampleCount);
        } else {
          samples = new Uint8Array(sampleCount);
        }
        let passes = SINGLE_PASS;
        if (interlaceMethod === 1) {
          passes = ADAM7_PASSES;
        }
        const bytesPerPixel = Math.max(1, Math.ceil(colors * bitDepth / 8));
        const maxRowBytes = Math.ceil(width * colors * bitDepth / 8);
        let current = new data_buffer_default(maxRowBytes);
        let previous = new data_buffer_default(maxRowBytes);
        const scanlines = new data_buffer_default(data);
        for (const [startX, startY, stepX, stepY] of passes) {
          const passWidth = passLength(width, startX, stepX);
          const passHeight = passLength(height, startY, stepY);
          if (passWidth === 0 || passHeight === 0) {
            continue;
          }
          const rowBytes = Math.ceil(passWidth * colors * bitDepth / 8);
          previous.data.fill(0, 0, rowBytes);
          for (let y = 0; y < passHeight; y++) {
            const filter = scanlines.readUInt8();
            current.data.set(data.subarray(scanlines.offset, scanlines.offset + rowBytes));
            scanlines.advance(rowBytes);
            current.reset();
            unfilterRow(current.data, previous.data, bytesPerPixel, rowBytes, filter);
            let destination = ((startY + y * stepY) * width + startX) * colors;
            if (bitDepth === 8 && stepX === 1) {
              samples.set(current.data.subarray(0, rowBytes), destination);
            } else if (bitDepth < 8) {
              const mask = (1 << bitDepth) - 1;
              for (let x = 0, bit2 = 0; x < passWidth; x++, bit2 += bitDepth, destination += stepX) {
                samples[destination] = current.data[bit2 >>> 3] >>> 8 - bitDepth - (bit2 & 7) & mask;
              }
            } else {
              for (let x = 0; x < passWidth; x++, destination += stepX * colors) {
                for (let channel = 0; channel < colors; channel++) {
                  if (bitDepth === 16) {
                    samples[destination + channel] = current.readUInt16();
                  } else {
                    samples[destination + channel] = current.readUInt8();
                  }
                }
              }
            }
            const temporary = previous;
            previous = current;
            current = temporary;
          }
        }
        if (this.colorType === 3) {
          const paletteSize = this.palette.length / 3;
          for (const index of samples) {
            if (index >= paletteSize) {
              throw new Error(`PNG palette index ${index} is out of range.`);
            }
          }
        }
        this.pixels = samples;
        this._decoded = true;
        return samples;
      }
      /**
       * Get indexed pixels without flattening duplicate palette colors.
       * @param options Index-buffer ownership.
       * @param options.copy False to borrow decoded indexes; defaults to true.
       * @returns Native indexes, newly expanded RGBA slots, and original index depth.
       * @throws {Error} The source is not indexed.
       */
      toIndexed({ copy = true } = {}) {
        if (typeof copy !== "boolean") {
          throw new TypeError("copy must be a boolean.");
        }
        if (this.colorType !== 3) {
          throw new Error("PNG does not contain indexed pixels.");
        }
        const pixels = this.decodePixels();
        if (!(pixels instanceof Uint8Array)) {
          throw new Error("Indexed PNG pixels must be byte-sized samples.");
        }
        let indexes = pixels;
        if (copy) {
          indexes = Uint8Array.from(pixels);
        }
        return {
          kind: "indexed-image",
          width: this.width,
          height: this.height,
          indexes,
          palette: this._paletteRGBA(),
          sourceBitDepth: this.bitDepth
        };
      }
      /**
       * Convert native samples to straight-alpha RGBA8 for rendering.
       * Sixteen-bit values are rounded to the nearest eight-bit value after testing
       * native transparency keys. Native samples and indexes remain unchanged.
       * @param options Output-buffer ownership for an RGBA8 source.
       * @param options.copy False to share existing RGBA8 samples; defaults to true.
       * @returns The RGBA surface; other source formats always require a new buffer.
       */
      toRGBA({ copy = true } = {}) {
        if (typeof copy !== "boolean") {
          throw new TypeError("copy must be a boolean.");
        }
        const pixels = this.decodePixels();
        if (this.colorType === 6 && this.bitDepth === 8 && pixels instanceof Uint8Array) {
          return new RgbaSurface(this.width, this.height, pixels, {
            copy,
            maxPixels: this._limits.maxPixels
          });
        }
        const rgba = new Uint8Array(this.width * this.height * 4);
        const key = this._transparencyKey();
        for (let pixel = 0, offset = 0; pixel < this.width * this.height; pixel++, offset += 4) {
          this._writePixel(pixel, rgba, offset, key);
        }
        return new RgbaSurface(this.width, this.height, rgba, {
          copy: false,
          maxPixels: this._limits.maxPixels
        });
      }
      /**
       * Get the pixel color at a specified x, y location.
       *
       * Decode native samples on demand, then convert the selected pixel to RGBA8.
       * Sixteen-bit samples are rounded after testing native transparency keys.
       * Prefer toRGBA() for bulk conversion or getPixelInto() for reusable output.
       * @param x The hoizontal offset to read.
       * @param y The vertical offset to read.
       * @returns the color as [red, green, blue, alpha]
       * @throws {Error} x is out of bound for the image
       * @throws {Error} y is out of bound for the image
       * @throws {Error} Unknown color types
       */
      getPixel(x, y) {
        if (!Number.isSafeInteger(x) || x < 0 || x > this.width - 1) {
          throw new RangeError(`x position must be an integer in [0, ${this.width - 1}].`);
        }
        if (!Number.isSafeInteger(y) || y < 0 || y > this.height - 1) {
          throw new RangeError(`y position must be an integer in [0, ${this.height - 1}].`);
        }
        this.decodePixels();
        const output = [0, 0, 0, 0];
        this._writePixel(y * this.width + x, output, 0, this._transparencyKey());
        return output;
      }
      /**
       * Write an RGBA8 pixel into a caller-owned buffer without allocating an output tuple.
       * @param x Horizontal pixel coordinate.
       * @param y Vertical pixel coordinate.
       * @param output Destination bytes.
       * @param offset First of four writable destination bytes.
       * @returns The same output buffer.
       */
      getPixelInto(x, y, output, offset = 0) {
        if (!Number.isSafeInteger(x) || x < 0 || x > this.width - 1) {
          throw new RangeError(`x position must be an integer in [0, ${this.width - 1}].`);
        }
        if (!Number.isSafeInteger(y) || y < 0 || y > this.height - 1) {
          throw new RangeError(`y position must be an integer in [0, ${this.height - 1}].`);
        }
        if (!Number.isSafeInteger(offset) || offset < 0 || offset > 2147483647) {
          throw new RangeError("Output offset must be an integer in [0, 2147483647].");
        }
        if (!(output instanceof Uint8Array) || offset + 4 > output.length) {
          throw new RangeError("Output needs four writable bytes.");
        }
        this.decodePixels();
        this._writePixel(y * this.width + x, output, offset, this._transparencyKey());
        return output;
      }
      /**
       * Expand RGB palette metadata into newly owned RGBA tuples without remapping slots.
       * @returns Palette slots, with full opacity for entries omitted from tRNS.
       */
      _paletteRGBA() {
        const palette = [];
        for (let index = 0; index < this.palette.length / 3; index++) {
          const offset = index * 3;
          palette.push([
            this.palette[offset],
            this.palette[offset + 1],
            this.palette[offset + 2],
            this.transparency[index] ?? 255
          ]);
        }
        return palette;
      }
      /**
       * Read a grayscale/RGB transparency key in native sample precision.
       * @returns Key components, or an empty array when there is no color key.
       */
      _transparencyKey() {
        const key = [];
        if (this.colorType !== 0 && this.colorType !== 2) {
          return key;
        }
        if (this.transparency.length !== 0) {
          const buffer = new data_buffer_default(this.transparency);
          while (buffer.remainingBytes() > 0) {
            key.push(buffer.readUInt16());
          }
        }
        return key;
      }
      /**
       * Write one native pixel as RGBA8, retaining RGB beneath transparent alpha.
       * @param pixel Row-major pixel index, not a byte offset.
       * @param output Destination array or byte buffer.
       * @param offset Destination byte offset.
       * @param key Native transparency components, resolved once per bulk conversion.
       */
      _writePixel(pixel, output, offset, key) {
        const source = pixel * this.colors;
        let scale = 1;
        if (this.bitDepth !== 8) {
          scale = 255 / (2 ** this.bitDepth - 1);
        }
        switch (this.colorType) {
          case 3: {
            const index = this.pixels[source];
            const paletteOffset = index * 3;
            output[offset] = this.palette[paletteOffset];
            output[offset + 1] = this.palette[paletteOffset + 1];
            output[offset + 2] = this.palette[paletteOffset + 2];
            output[offset + 3] = this.transparency[index] ?? 255;
            break;
          }
          case 0:
          case 4: {
            const gray = Math.round(this.pixels[source] * scale);
            let alpha = 255;
            if (this.colorType === 4) {
              alpha = Math.round(this.pixels[source + 1] * scale);
            } else if (this.pixels[source] === key[0]) {
              alpha = 0;
            }
            output[offset] = gray;
            output[offset + 1] = gray;
            output[offset + 2] = gray;
            output[offset + 3] = alpha;
            break;
          }
          case 2:
          case 6: {
            let alpha = 255;
            if (this.colorType === 6) {
              alpha = Math.round(this.pixels[source + 3] * scale);
            } else if (this.pixels[source] === key[0] && this.pixels[source + 1] === key[1] && this.pixels[source + 2] === key[2]) {
              alpha = 0;
            }
            output[offset] = Math.round(this.pixels[source] * scale);
            output[offset + 1] = Math.round(this.pixels[source + 1] * scale);
            output[offset + 2] = Math.round(this.pixels[source + 2] * scale);
            output[offset + 3] = alpha;
            break;
          }
          default:
            throw new Error(`Unknown Color Type: ${this.colorType}`);
        }
      }
      /**
       * Encode indexed pixels without quantization, palette reordering, or deduplication.
       * @param image Native indexes and RGBA palette slots.
       * @param options Bit depth, filters, compression level, and allocation limits.
       * @returns Owned non-interlaced PNG bytes; the default index depth is eight bits.
       * @static
       */
      static encodeIndexed(image, options = {}) {
        const limits = resolveLimits(options);
        const bitDepth = options.bitDepth ?? 8;
        validateIndexed(image, bitDepth, limits.maxPixels);
        const compressed = _ImagePNG._encodeIndexedData(image, bitDepth, options, limits);
        return joinChunks([
          PNG_SIGNATURE,
          makeChunk("IHDR", makeHeader(image.width, image.height, bitDepth, 3)),
          ...makePaletteChunks(image.palette),
          makeChunk("IDAT", compressed),
          makeChunk("IEND", new Uint8Array())
        ], limits.maxOutputBytes);
      }
      /**
       * Create an indexed PNG using the encodeIndexed() implementation.
       * @param image Native indexes and RGBA palette slots.
       * @param options Bit depth, filters, compression level, and allocation limits.
       * @returns Owned PNG bytes retaining each supplied palette slot.
       * @static
       */
      static createIndexedPng(image, options = {}) {
        return _ImagePNG.encodeIndexed(image, options);
      }
      /**
       * Encode straight-alpha RGBA8 without changing hidden RGB components.
       * @param image Dimensions and an exact row-major RGBA8 buffer.
       * @param options Filters, compression level, and allocation limits.
       * @returns Owned non-interlaced RGBA8 PNG bytes.
       * @static
       */
      static encodeRGBA(image, options = {}) {
        const limits = resolveLimits(options);
        if (!Number.isSafeInteger(image.width) || image.width < 1 || image.width > 2147483647) {
          throw new RangeError("Width must be an integer in [1, 2147483647].");
        }
        if (!Number.isSafeInteger(image.height) || image.height < 1 || image.height > 2147483647) {
          throw new RangeError("Height must be an integer in [1, 2147483647].");
        }
        if (!Number.isSafeInteger(image.width * image.height) || image.width * image.height > limits.maxPixels) {
          throw new RangeError(`Image dimensions ${image.width}x${image.height} exceed the pixel limit ${limits.maxPixels}.`);
        }
        if (!(image.rgba instanceof Uint8Array) || image.rgba.length !== image.width * image.height * 4) {
          throw new Error("RGBA buffer length does not match dimensions.");
        }
        const rowBytes = image.width * 4;
        const compressed = _ImagePNG._encodeRows(image.height, rowBytes, 4, (row, y) => {
          row.set(image.rgba.subarray(y * rowBytes, (y + 1) * rowBytes));
        }, options, limits);
        return joinChunks([
          PNG_SIGNATURE,
          makeChunk("IHDR", makeHeader(image.width, image.height, 8, 6)),
          makeChunk("IDAT", compressed),
          makeChunk("IEND", new Uint8Array())
        ], limits.maxOutputBytes);
      }
      /**
       * Rewrite indexed pixels, dimensions, or same-slot palette entries without an RGBA round trip.
       * No-op edits return an exact owned copy. Palette-only changes keep the original
       * IDAT bytes, including Adam7. Pixel edits use new non-interlaced packed rows.
       * Safe-to-copy ancillary chunks survive edits. Unsafe chunks require explicit
       * retention after caller-supplied, format-specific validation.
       * @param source Original PNG file bytes, rather than a mutable decoded model.
       * @param edit Palette edits and optional complete pixel/canvas replacements.
       * @param options Decoder/encoder limits and optional application validation.
       * @returns Owned PNG bytes preserving palette slot identities.
       * @throws {Error} Palette slot count changes or resizing omits replacement pixels.
       * @static
       */
      static rewriteIndexed(source, edit = {}, options = {}) {
        const image = new _ImagePNG(source, options);
        if (image.colorType !== 3) {
          throw new Error("PNG editing requires indexed pixels.");
        }
        const original = image.toIndexed({ copy: false });
        const palette = edit.palette ?? original.palette;
        const width = edit.dimensions?.width ?? original.width;
        const height = edit.dimensions?.height ?? original.height;
        const resized = width !== original.width || height !== original.height;
        if (resized && edit.indexes === void 0) {
          throw new Error("Resizing requires replacement indexed pixels.");
        }
        if (palette.length !== original.palette.length) {
          throw new Error("Palette edit must preserve slot count.");
        }
        const indexes = edit.indexes ?? original.indexes;
        const next = { width, height, palette, indexes };
        validateIndexed(next, image.bitDepth, image._limits.maxPixels);
        if (options.validateIndexed !== void 0) {
          if (typeof options.validateIndexed !== "function") {
            throw new TypeError("validateIndexed must be a function.");
          }
          options.validateIndexed({ width, height, indexes });
        }
        const retained = new Set(edit.preserveChunks ?? []);
        for (const type of retained) {
          if (typeof type !== "string" || !/^[a-z][A-Za-z][A-Z][A-Za-z]$/.test(type) || ANIMATION_CHUNKS.has(type)) {
            throw new Error(`Invalid preserved ancillary chunk '${type}'.`);
          }
        }
        let pixelsChanged = resized;
        if (!pixelsChanged) {
          for (let i = 0; i < indexes.length; i++) {
            if (indexes[i] !== original.indexes[i]) {
              pixelsChanged = true;
              break;
            }
          }
        }
        let paletteChanged = false;
        for (let i = 0; i < palette.length; i++) {
          const color = palette[i];
          const previous = original.palette[i];
          if (color[0] !== previous[0] || color[1] !== previous[1] || color[2] !== previous[2] || color[3] !== previous[3]) {
            paletteChanged = true;
            break;
          }
        }
        if (!pixelsChanged && !paletteChanged) {
          if (image.data.length > image._limits.maxOutputBytes) {
            throw new RangeError("PNG exceeds the output byte limit.");
          }
          return Uint8Array.from(image.data);
        }
        if (image.animated) {
          throw new Error("Cannot rewrite an animated PNG through the static indexed editor.");
        }
        let compressed;
        if (pixelsChanged) {
          compressed = _ImagePNG._encodeIndexedData(next, original.sourceBitDepth, options, image._limits);
        }
        const parts = [PNG_SIGNATURE];
        let wrotePixels = false;
        for (const chunk of image.chunks) {
          const { type } = chunk;
          if (type === "IHDR" && pixelsChanged) {
            parts.push(makeChunk(type, makeHeader(width, height, image.bitDepth, 3)));
          } else if (type === "PLTE" && paletteChanged) {
            parts.push(...makePaletteChunks(palette));
          } else if (type === "tRNS" && paletteChanged) {
            continue;
          } else if (type === "IDAT" && compressed !== void 0) {
            if (!wrotePixels) {
              parts.push(makeChunk(type, compressed));
              wrotePixels = true;
            }
          } else if (type === "IHDR" || type === "PLTE" || type === "tRNS" || type === "IDAT" || type === "IEND" || chunk.safeToCopy || retained.has(type)) {
            parts.push(chunk.raw);
          }
        }
        return joinChunks(parts, image._limits.maxOutputBytes);
      }
      /**
       * Rewrite an indexed PNG using rewriteIndexed().
       * @param source Original indexed PNG bytes.
       * @param edit Palette edits and optional complete pixel/canvas replacements.
       * @param options Decoder/encoder limits and optional application validation.
       * @returns Owned PNG bytes preserving palette slot identities.
       * @static
       */
      static rewriteIndexedPng(source, edit = {}, options = {}) {
        return _ImagePNG.rewriteIndexed(source, edit, options);
      }
      /**
       * Pack validated indexes into scanlines and compress them for IDAT.
       * @param image A validated indexed surface.
       * @param bitDepth Number of bits per index.
       * @param options Filtering and compression options.
       * @param limits Resolved allocation limits.
       * @returns A complete zlib stream.
       */
      static _encodeIndexedData(image, bitDepth, options, limits) {
        const rowBytes = Math.ceil(image.width * bitDepth / 8);
        return _ImagePNG._encodeRows(image.height, rowBytes, 1, (row, y) => {
          const source = y * image.width;
          if (bitDepth === 8) {
            row.set(image.indexes.subarray(source, source + image.width));
            return;
          }
          for (let x = 0, bit2 = 0; x < image.width; x++, bit2 += bitDepth) {
            row[bit2 >>> 3] |= image.indexes[source + x] << 8 - bitDepth - (bit2 & 7);
          }
        }, options, limits);
      }
      /**
       * Filter and compress rows for indexed and RGBA8 output.
       * None is the deterministic, low-CPU default. Adaptive filtering tries all five
       * predictors and selects the lowest signed-byte residual score for each row.
       * @param height Number of scanlines.
       * @param rowBytes Packed byte count per row, excluding its filter byte.
       * @param bpp Byte distance to the previous pixel for filtering.
       * @param fillRow Callback writing one unfiltered row into zero-initialized storage.
       * @param options Filtering and compression options.
       * @param limits Resolved allocation limits.
       * @returns A complete zlib stream.
       */
      static _encodeRows(height, rowBytes, bpp, fillRow, options, limits) {
        const length = height * (rowBytes + 1);
        if (!Number.isSafeInteger(length) || length > limits.maxInflatedBytes) {
          throw new RangeError("PNG exceeds the scanline byte limit.");
        }
        const filter = options.filter ?? "none";
        if (filter !== "none" && filter !== "sub" && filter !== "adaptive") {
          throw new Error("Filter must be none, sub, or adaptive.");
        }
        const level = options.level ?? 6;
        if (!Number.isSafeInteger(level) || level < 0 || level > 9) {
          throw new RangeError("Compression level must be an integer in [0, 9].");
        }
        const rows = new Uint8Array(length);
        if (filter === "none") {
          for (let y = 0; y < height; y++) {
            const offset = y * (rowBytes + 1);
            fillRow(rows.subarray(offset + 1, offset + rowBytes + 1), y);
          }
        } else {
          let current = new Uint8Array(rowBytes);
          let previous = new Uint8Array(rowBytes);
          const candidate = new Uint8Array(rowBytes);
          let firstFilter = 0;
          let lastFilter = 4;
          if (filter === "sub") {
            firstFilter = 1;
            lastFilter = 1;
          }
          for (let y = 0; y < height; y++) {
            current.fill(0);
            fillRow(current, y);
            const offset = y * (rowBytes + 1);
            let bestScore = Infinity;
            for (let type = firstFilter; type <= lastFilter; type++) {
              let score = 0;
              for (let i = 0; i < rowBytes; i++) {
                let left = 0;
                let upperLeft = 0;
                if (i >= bpp) {
                  left = current[i - bpp];
                  upperLeft = previous[i - bpp];
                }
                const above = previous[i];
                let predictor = 0;
                switch (type) {
                  case 1:
                    predictor = left;
                    break;
                  case 2:
                    predictor = above;
                    break;
                  case 3:
                    predictor = left + above >>> 1;
                    break;
                  case 4:
                    predictor = paethPredictor(left, above, upperLeft);
                    break;
                  default:
                    break;
                }
                const byte = current[i] - predictor & 255;
                candidate[i] = byte;
                if (byte < 128) {
                  score += byte;
                } else {
                  score += 256 - byte;
                }
              }
              if (score < bestScore) {
                bestScore = score;
                rows[offset] = type;
                rows.set(candidate, offset + 1);
              }
            }
            const temporary = previous;
            previous = current;
            current = temporary;
          }
        }
        return deflate(rows, { level });
      }
      /**
       * No filtering, direct copy.
       * @param pixels Pixels to update.
       * @param scanline Scanline to search for pixels in.
       * @param bpp Bytes Per Pixel
       * @param offset Offset
       * @param length Length
       * @returns Pixels
       */
      static unFilterNone(pixels, scanline, bpp, offset, length) {
        return unfilterScanline(0, pixels, scanline, bpp, offset, length);
      }
      /**
       * The Sub() filter transmits the difference between each byte and the value of the corresponding byte of the prior pixel.
       * Sub(x) = Raw(x) + Raw(x - bpp)
       * @param pixels Pixels to update.
       * @param scanline Scanline to search for pixels in.
       * @param bpp Bytes Per Pixel
       * @param offset Offset
       * @param length Length
       * @returns Pixels
       */
      static unFilterSub(pixels, scanline, bpp, offset, length) {
        return unfilterScanline(1, pixels, scanline, bpp, offset, length);
      }
      /**
       * The Up() filter is just like the Sub() filter except that the pixel immediately above the current pixel, rather than just to its left, is used as the predictor.
       * Up(x) = Raw(x) + Prior(x)
       * @param pixels Pixels to update.
       * @param scanline - Scanline to search for pixels in.
       * @param bpp Bytes Per Pixel
       * @param offset Offset
       * @param length Length
       * @returns Pixels
       */
      static unFilterUp(pixels, scanline, bpp, offset, length) {
        return unfilterScanline(2, pixels, scanline, bpp, offset, length);
      }
      /**
       * The Average() filter uses the average of the two neighboring pixels (left and above) to predict the value of a pixel.
       * Average(x) = Raw(x) + floor((Raw(x-bpp)+Prior(x))/2)
       * @param pixels Pixels to update.
       * @param scanline Scanline to search for pixels in.
       * @param bpp Bytes Per Pixel
       * @param offset Offset
       * @param length Length
       * @returns Pixels
       */
      static unFilterAverage(pixels, scanline, bpp, offset, length) {
        return unfilterScanline(3, pixels, scanline, bpp, offset, length);
      }
      /**
       * The Paeth() filter computes a simple linear function of the three neighboring pixels (left, above, upper left), then chooses as predictor the neighboring pixel closest to the computed value.
       * This technique was developed by Alan W. Paeth.
       * Paeth(x) = Raw(x) + PaethPredictor(Raw(x-bpp), Prior(x), Prior(x-bpp))
       * function PaethPredictor (a, b, c)
       * begin
       * ; a = left, b = above, c = upper left
       * p := a + b - c        ; initial estimate
       * pa := abs(p - a)      ; distances to a, b, c
       * pb := abs(p - b)
       * pc := abs(p - c)
       * ; return nearest of a,b,c,
       * ; breaking ties in order a,b,c.
       * if pa <= pb AND pa <= pc then return a
       * else if pb <= pc then return b
       * else return c
       * end
       * @param pixels Pixels to update.
       * @param scanline Scanline to search for pixels in.
       * @param bpp Bytes Per Pixel
       * @param offset Offset
       * @param length Length
       * @returns Pixels
       */
      static unFilterPaeth(pixels, scanline, bpp, offset, length) {
        return unfilterScanline(4, pixels, scanline, bpp, offset, length);
      }
    };
    data_image_png_default = ImagePNG;
  }
});

// packages/assets/src/png.ts
function readAssetPng(bytes) {
  return data_image_png_default.fromFile(bytes, ASSET_PNG_OPTIONS);
}
var ASSET_PNG_OPTIONS, pngImporter;
var init_png = __esm({
  async "packages/assets/src/png.ts"() {
    "use strict";
    await init_data_image_png();
    ASSET_PNG_OPTIONS = Object.freeze({
      maxInputBytes: 16 * 1024 * 1024,
      maxPixels: 1024 * 1024,
      maxInflatedBytes: 5 * 1024 * 1024,
      maxOutputBytes: 16 * 1024 * 1024,
      maxChunks: 16384,
      allow16Bit: false,
      animation: "reject",
      copyInput: false
    });
    pngImporter = Object.freeze({
      id: "uttori.import.png",
      version: "2.0.0",
      mediaTypes: ["image/png"],
      import: (input) => {
        const image = readAssetPng(input.bytes);
        if (image.colorType === 3) {
          const value2 = image.toIndexed({ copy: false });
          return { kind: value2.kind, value: value2 };
        }
        const surface = image.toRGBA({ copy: false });
        const value = {
          kind: "rgba-image",
          width: surface.width,
          height: surface.height,
          rgba: surface.rgba
        };
        return { kind: value.kind, value };
      }
    });
  }
});

// packages/assets/src/image-conversion.ts
function selectPalette(image, options, resources, capacity) {
  let colors;
  let indexes;
  let sourceToNative;
  if (image.kind === "indexed-image") {
    if (options.palette === "auto") {
      throw new Error("Indexed PNG must preserve palette identity; auto is for truecolor input.");
    }
    if (options.palette === "embedded") {
      colors = image.palette.map((color) => [...color]);
      indexes = image.indexes.slice();
      sourceToNative = colors.map((_, index) => index);
    } else {
      const resource = resources[options.palette];
      if (!resource) {
        throw new Error(`Missing palette resource '${options.palette}'.`);
      }
      const external = externalPalette(resource);
      colors = external.colors;
      const used = /* @__PURE__ */ new Set();
      sourceToNative = image.palette.map((source, index) => {
        const match = colors.findIndex(
          (candidate, candidateIndex) => !used.has(candidateIndex) && colorKey(candidate) === colorKey(source)
        );
        if (match < 0) {
          throw new Error(`External palette loses source entry ${index}.`);
        }
        used.add(match);
        return match;
      });
      indexes = Uint8Array.from(image.indexes, (index) => sourceToNative[index]);
      if (external.transparentIndex !== 0) {
        const zero2 = colors[0];
        colors[0] = colors[external.transparentIndex];
        colors[external.transparentIndex] = zero2;
        const swap = (index) => {
          if (index === 0) {
            return external.transparentIndex;
          }
          if (index === external.transparentIndex) {
            return 0;
          }
          return index;
        };
        indexes = Uint8Array.from(indexes, swap);
        sourceToNative = sourceToNative.map(swap);
      }
    }
  } else {
    if (options.palette === "embedded") {
      throw new Error("Truecolor PNG has no embedded indexed palette.");
    }
    if (options.palette === "auto") {
      colors = [[0, 0, 0, 0]];
      const byColor = /* @__PURE__ */ new Map();
      indexes = new Uint8Array(image.width * image.height);
      for (let pixel = 0; pixel < indexes.length; pixel++) {
        const rgba = image.rgba.subarray(pixel * 4, pixel * 4 + 4);
        if (rgba[3] !== 0 && rgba[3] !== 255) {
          throw new Error(`Pixel ${pixel} has partial alpha ${rgba[3]}.`);
        }
        if (rgba[3] === 0) {
          if (byColor.has("transparent") && colorKey(colors[0].slice(0, 3)) !== colorKey(rgba.slice(0, 3))) {
            throw new Error("Transparent pixels have differing hidden RGB values.");
          }
          colors[0] = [rgba[0], rgba[1], rgba[2], 0];
          byColor.set("transparent", 0);
          continue;
        }
        const key = colorKey(rgba.slice(0, 3));
        let index = byColor.get(key);
        if (index === void 0) {
          index = colors.length;
          colors.push([rgba[0], rgba[1], rgba[2], 255]);
          byColor.set(key, index);
        }
        indexes[pixel] = index;
      }
    } else {
      const resource = resources[options.palette];
      if (!resource) {
        throw new Error(`Missing palette resource '${options.palette}'.`);
      }
      const external = externalPalette(resource);
      colors = external.colors;
      if (external.transparentIndex !== 0) {
        const zero2 = colors[0];
        colors[0] = colors[external.transparentIndex];
        colors[external.transparentIndex] = zero2;
      }
      const lookup = /* @__PURE__ */ new Map();
      colors.forEach((color, index) => {
        const key = colorKey(color);
        if (!lookup.has(key)) {
          lookup.set(key, index);
        }
      });
      indexes = new Uint8Array(image.width * image.height);
      for (let pixel = 0; pixel < indexes.length; pixel++) {
        const rgba = image.rgba.subarray(pixel * 4, pixel * 4 + 4);
        const index = lookup.get(colorKey(rgba));
        if (index === void 0) {
          throw new Error(`Pixel ${pixel} is absent from the exact external palette.`);
        }
        indexes[pixel] = index;
      }
    }
  }
  if (colors.length > capacity) {
    throw new Error(`Palette has ${colors.length} entries; one bank holds ${capacity}.`);
  }
  if (indexes.some((index) => index >= capacity)) {
    throw new Error(`Pixel index exceeds ${capacity}-color bank.`);
  }
  colors.forEach((color, index) => {
    if (color[3] !== 0 && color[3] !== 255) {
      throw new Error(`Palette entry ${index} has partial alpha.`);
    }
    if (index !== 0 && color[3] === 0 && indexes.includes(index)) {
      throw new Error(`Transparent palette entry ${index} would be rendered opaque.`);
    }
  });
  if (indexes.some((index) => index === 0 && colors[0][3] !== 0)) {
    throw new Error("Opaque index-zero pixels cannot be represented by SNES transparency.");
  }
  return { colors, indexes, sourceToNative };
}
function tileCoordinates(width, height, layout2) {
  const result = [];
  if (layout2.tileOrder === "row-major") {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        result.push([x, y]);
      }
    }
  } else if (layout2.tileOrder === "column-major") {
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        result.push([x, y]);
      }
    }
  } else {
    if (width % 2 || height % 2) {
      throw new Error("2\xD72 block layout requires complete tile blocks.");
    }
    const blockY = Array.from({ length: height / 2 }, (_, index) => index);
    if (layout2.blockRows === "bottom-to-top") {
      blockY.reverse();
    }
    if (layout2.blockOrder === "row-major") {
      for (const by of blockY) {
        for (let bx = 0; bx < width / 2; bx++) {
          for (const quadrant of layout2.withinBlock) {
            result.push([bx * 2 + quadrant % 2, by * 2 + Math.floor(quadrant / 2)]);
          }
        }
      }
    } else {
      for (let bx = 0; bx < width / 2; bx++) {
        for (const by of blockY) {
          for (const quadrant of layout2.withinBlock) {
            result.push([bx * 2 + quadrant % 2, by * 2 + Math.floor(quadrant / 2)]);
          }
        }
      }
    }
  }
  return result;
}
function mapOrder(width, height, layout2) {
  if (layout2 === "row-major") {
    return Array.from({ length: width * height }, (_, index) => index);
  }
  if (![32, 64].includes(width) || ![32, 64].includes(height)) {
    throw new Error("BG screen-block tilemap requires 32\xD732, 64\xD732, 32\xD764, or 64\xD764 cells.");
  }
  const order = [];
  for (let by = 0; by < height; by += 32) {
    for (let bx = 0; bx < width; bx += 32) {
      for (let y = 0; y < 32; y++) {
        for (let x = 0; x < 32; x++) {
          order.push((by + y) * width + bx + x);
        }
      }
    }
  }
  return order;
}
function imageModel(document2) {
  if (document2.kind !== "indexed-image" && document2.kind !== "rgba-image" || !isRecord2(document2.value)) {
    throw new Error("Image encoder requires imported PNG pixels.");
  }
  const value = document2.value;
  if (value.kind !== document2.kind || typeof value.width !== "number" || typeof value.height !== "number" || !Number.isSafeInteger(value.width) || !Number.isSafeInteger(value.height) || value.width < 1 || value.height < 1 || value.width * value.height > 1024 * 1024) {
    throw new Error("Image model has invalid dimensions or kind.");
  }
  const pixels = value.width * value.height;
  if (document2.kind === "indexed-image") {
    if (!(value.indexes instanceof Uint8Array) || value.indexes.length !== pixels || !Array.isArray(value.palette) || value.palette.length < 1 || value.palette.length > 256 || ![1, 2, 4, 8].includes(Number(value.sourceBitDepth))) {
      throw new Error("Indexed image model has invalid pixels, palette, or source depth.");
    }
    for (const [index, color] of value.palette.entries()) {
      if (!Array.isArray(color) || color.length !== 4 || color.some(
        (channel) => typeof channel !== "number" || !Number.isInteger(channel) || channel < 0 || channel > 255
      )) {
        throw new Error(`Indexed image palette entry ${index} is not RGBA8.`);
      }
    }
  } else if (!(value.rgba instanceof Uint8Array) || value.rgba.length !== pixels * 4) {
    throw new Error("RGBA image model has invalid pixel bytes.");
  }
  return value;
}
function encodeImage(document2, rawOptions, resources, format) {
  const image = imageModel(document2);
  if (image.width % 8 !== 0 || image.height % 8 !== 0) {
    throw new Error(`Image ${image.width}\xD7${image.height} requires dimensions divisible by 8.`);
  }
  const mode7 = format === "snes.tile.mode7";
  const depth = mode7 ? 8 : Number(format.slice("snes.tile.".length, -3));
  const options = readOptions(rawOptions, image.kind === "indexed-image");
  const capacity = 2 ** depth;
  const selection = selectPalette(image, options, resources, capacity);
  const colors = selection.colors.map((color, index) => ({
    red: reduce(color[0], options.paletteExpansion, `Palette ${index} red`),
    green: reduce(color[1], options.paletteExpansion, `Palette ${index} green`),
    blue: reduce(color[2], options.paletteExpansion, `Palette ${index} blue`),
    unusedHighBit: 0
  }));
  while (colors.length < capacity) {
    colors.push({ red: 0, green: 0, blue: 0, unusedHighBit: 0 });
  }
  const widthTiles = image.width / 8;
  const heightTiles = image.height / 8;
  const coordinates = tileCoordinates(widthTiles, heightTiles, options.layout);
  const indexByCoordinate = new Array(coordinates.length);
  const tiles = coordinates.map(([tx, ty], storageIndex) => {
    indexByCoordinate[ty * widthTiles + tx] = storageIndex;
    return Array.from(
      { length: 8 },
      (_, row) => Array.from({ length: 8 }, (_2, column) => {
        const sourceX = options.tilemap.horizontalFlip ? 7 - column : column;
        const sourceY = options.tilemap.verticalFlip ? 7 - row : row;
        return selection.indexes[(ty * 8 + sourceY) * image.width + tx * 8 + sourceX];
      })
    );
  });
  const tileBytes = mode7 ? encodeMode7Tiles(tiles) : encodePlanarTiles(tiles, depth);
  const paletteBytes = encodeBgr555(colors);
  const decodedTiles = mode7 ? decodeMode7Tiles(tileBytes) : decodePlanarTiles(tileBytes, depth);
  const decodedColors = decodeBgr555(paletteBytes);
  const preview = new Uint8Array(image.width * image.height * 4);
  for (let ty = 0; ty < heightTiles; ty++) {
    for (let tx = 0; tx < widthTiles; tx++) {
      const storageIndex = indexByCoordinate[ty * widthTiles + tx];
      for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
          const tileX = options.tilemap.horizontalFlip ? 7 - x : x;
          const tileY = options.tilemap.verticalFlip ? 7 - y : y;
          const index = decodedTiles[storageIndex][tileY][tileX];
          const destination = ((ty * 8 + y) * image.width + tx * 8 + x) * 4;
          const color = decodedColors[index];
          preview[destination] = expand(color.red, options.paletteExpansion);
          preview[destination + 1] = expand(color.green, options.paletteExpansion);
          preview[destination + 2] = expand(color.blue, options.paletteExpansion);
          preview[destination + 3] = selection.colors[index]?.[3] ?? 255;
          if (image.kind === "indexed-image") {
            const sourceIndex = image.indexes[destination / 4];
            if (selection.sourceToNative?.[sourceIndex] !== index) {
              throw new Error(
                `Indexed PNG pixel ${destination / 4} lost its original palette index.`
              );
            }
          }
          const sourceRgba = image.kind === "rgba-image" ? image.rgba.subarray(destination, destination + 4) : image.palette[image.indexes[destination / 4]];
          for (let channel = 0; channel < 4; channel++) {
            if (preview[destination + channel] !== sourceRgba[channel]) {
              throw new Error(
                `Image pixel ${destination / 4} channel ${channel} cannot be reconstructed exactly.`
              );
            }
          }
        }
      }
    }
  }
  const start = options.tilemap.startTileIndex;
  const limit = mode7 ? 256 : 1024;
  if (start + coordinates.length > limit) {
    throw new Error(`Tilemap exceeds ${limit} tile indexes.`);
  }
  if (mode7 && (options.tilemap.paletteBank !== 0 || options.tilemap.priority !== 0 || options.tilemap.horizontalFlip || options.tilemap.verticalFlip)) {
    throw new Error("Mode 7 map has no palette bank, priority, or flip bits.");
  }
  if (mode7 && options.tilemap.layout === "screen-blocks") {
    throw new Error(
      "Mode 7 maps use row-major storage; full 128\xD7128 maps are a separate contract."
    );
  }
  const mapIndexes = mapOrder(widthTiles, heightTiles, options.tilemap.layout);
  const tilemapBytes = mode7 ? encodeMode7Map(mapIndexes.map((position) => start + indexByCoordinate[position])) : encodeBgMap(
    mapIndexes.map((position) => ({
      tile: start + indexByCoordinate[position],
      palette: options.tilemap.paletteBank,
      priority: options.tilemap.priority,
      horizontalFlip: Number(options.tilemap.horizontalFlip),
      verticalFlip: Number(options.tilemap.verticalFlip)
    }))
  );
  const metadata = {
    width: image.width,
    height: image.height,
    widthTiles,
    heightTiles,
    tileIndexByCoordinate: indexByCoordinate,
    sourceToNativePaletteIndex: selection.sourceToNative,
    originalPaletteEntries: image.kind === "indexed-image" ? image.palette.length : void 0,
    paletteExpansion: options.paletteExpansion,
    layout: options.layout,
    tilemap: options.tilemap
  };
  return {
    outputs: {
      tiles: { bytes: tileBytes, mediaType: "application/octet-stream", metadata },
      palette: { bytes: paletteBytes, mediaType: "application/octet-stream", metadata },
      tilemap: { bytes: tilemapBytes, mediaType: "application/octet-stream", metadata },
      preview: { bytes: preview, mediaType: "application/x-rgba", metadata }
    },
    normalizedOptions: options
  };
}
function withImageEncoders(native) {
  return native.map((encoder) => {
    if (!encoder.id.startsWith("snes.tile.")) {
      return encoder;
    }
    return Object.freeze({
      ...encoder,
      inputKinds: [...encoder.inputKinds, "indexed-image", "rgba-image"],
      encode: (document2, options, resources) => {
        if (document2.kind !== "indexed-image" && document2.kind !== "rgba-image") {
          return encoder.encode(document2, options, resources);
        }
        const result = encodeImage(document2, options, resources, encoder.id);
        return {
          ...result,
          fidelity: {
            kind: "exact",
            verification: "PNG indexes, palette, and RGBA reconstruction"
          }
        };
      }
    });
  });
}
var isRecord2, readInteger, readBoolean, expand, reduce, colorKey, readLayout, readOptions, externalPalette;
var init_image_conversion = __esm({
  "packages/assets/src/image-conversion.ts"() {
    "use strict";
    init_snes();
    init_validation();
    isRecord2 = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
    readInteger = (value, label, minimum, maximum) => {
      if (typeof value !== "number") {
        throw new RangeError(`${label} must be a number.`);
      }
      return integer2(value, label, minimum, maximum);
    };
    readBoolean = (value, name) => {
      if (typeof value !== "boolean") {
        throw new Error(`${name} must be boolean.`);
      }
      return value;
    };
    expand = (channel, profile) => {
      if (profile === "bit-replicate") {
        return channel << 3 | channel >> 2;
      }
      return Math.floor(channel * 255 / 31);
    };
    reduce = (channel, profile, label) => {
      integer2(channel, label, 0, 255);
      for (let value = 0; value < 32; value++) {
        if (expand(value, profile) === channel) {
          return value;
        }
      }
      throw new Error(`${label}=${channel} is not representable by ${profile} BGR555.`);
    };
    colorKey = (color) => Array.from(color).join(",");
    readLayout = (raw) => {
      if (raw === void 0) {
        return { tileOrder: "row-major" };
      }
      if (!isRecord2(raw)) {
        throw new Error("layout must be an object.");
      }
      const tileOrder = raw.tileOrder ?? "row-major";
      if (tileOrder !== "row-major" && tileOrder !== "column-major" && tileOrder !== "blocks") {
        throw new Error("Invalid layout.tileOrder.");
      }
      if (tileOrder !== "blocks") {
        if (Object.keys(raw).some((key) => key !== "tileOrder")) {
          throw new Error("Block options require tileOrder: 'blocks'.");
        }
        return { tileOrder };
      }
      if (!Array.isArray(raw.blockSize) || raw.blockSize.length !== 2 || raw.blockSize[0] !== 2 || raw.blockSize[1] !== 2) {
        throw new Error("Block layout requires blockSize: [2, 2].");
      }
      const blockOrder = raw.blockOrder ?? "row-major";
      const blockRows = raw.blockRows ?? "top-to-bottom";
      if (blockOrder !== "row-major" && blockOrder !== "column-major" || blockRows !== "top-to-bottom" && blockRows !== "bottom-to-top") {
        throw new Error("Invalid block traversal order.");
      }
      let withinBlock;
      if (raw.withinBlock === "tl-bl-br-tr") {
        withinBlock = [0, 2, 3, 1];
      } else if (raw.withinBlock === "tl-tr-bl-br" || raw.withinBlock === void 0) {
        withinBlock = [0, 1, 2, 3];
      } else if (Array.isArray(raw.withinBlock)) {
        const names = ["tl", "tr", "bl", "br"];
        withinBlock = raw.withinBlock.map((name) => names.indexOf(String(name)));
      } else {
        throw new Error("Invalid withinBlock permutation.");
      }
      if (withinBlock.length !== 4 || new Set(withinBlock).size !== 4 || withinBlock.some((index) => index < 0)) {
        throw new Error("withinBlock must contain each 2\xD72 quadrant once.");
      }
      if (Object.keys(raw).some(
        (key) => !["tileOrder", "blockSize", "blockOrder", "blockRows", "withinBlock"].includes(key)
      )) {
        throw new Error("Unknown block layout option.");
      }
      return { tileOrder, blockSize: [2, 2], blockOrder, blockRows, withinBlock };
    };
    readOptions = (raw, indexed) => {
      if (Object.keys(raw).some(
        (key) => !["palette", "paletteExpansion", "layout", "tilemap"].includes(key)
      )) {
        throw new Error("Unknown image conversion option.");
      }
      let palette = raw.palette;
      if (palette === void 0 && indexed) {
        palette = "embedded";
      }
      if (typeof palette !== "string" || palette.length === 0) {
        throw new Error("Truecolor PNG requires palette: 'auto' or an external palette resource.");
      }
      const paletteExpansion = raw.paletteExpansion === void 0 ? "bit-replicate" : raw.paletteExpansion;
      if (paletteExpansion !== "bit-replicate" && paletteExpansion !== "scale-floor") {
        throw new Error("Invalid paletteExpansion profile.");
      }
      const map = raw.tilemap === void 0 ? {} : raw.tilemap;
      if (!isRecord2(map) || Object.keys(map).some(
        (key) => ![
          "layout",
          "startTileIndex",
          "paletteBank",
          "priority",
          "horizontalFlip",
          "verticalFlip"
        ].includes(key)
      )) {
        throw new Error("Invalid tilemap options.");
      }
      const mapLayout = map.layout ?? "row-major";
      if (mapLayout !== "row-major" && mapLayout !== "screen-blocks") {
        throw new Error("Invalid tilemap.layout.");
      }
      return {
        palette,
        paletteExpansion,
        layout: readLayout(raw.layout),
        tilemap: {
          layout: mapLayout,
          startTileIndex: readInteger(map.startTileIndex ?? 0, "startTileIndex", 0, 1023),
          paletteBank: readInteger(map.paletteBank ?? 0, "paletteBank", 0, 7),
          priority: readInteger(map.priority ?? 0, "priority", 0, 1),
          horizontalFlip: readBoolean(map.horizontalFlip ?? false, "horizontalFlip"),
          verticalFlip: readBoolean(map.verticalFlip ?? false, "verticalFlip")
        }
      };
    };
    externalPalette = (input) => {
      if (input.mediaType !== "application/json") {
        throw new Error("External palette resource must be application/json.");
      }
      if (input.bytes.length > 64 * 1024) {
        throw new Error("External palette JSON exceeds 64 KiB.");
      }
      const value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(input.bytes));
      if (!isRecord2(value) || value.version !== 1 || !Array.isArray(value.colors) || value.colors.length === 0 || value.colors.length > 256) {
        throw new Error("External palette requires version 1 and 1\u2013256 RGB8 colors.");
      }
      const transparentIndex = readInteger(
        value.transparentIndex,
        "transparentIndex",
        0,
        value.colors.length - 1
      );
      const colors = value.colors.map((color, index) => {
        if (!Array.isArray(color) || color.length !== 3) {
          throw new Error(`Palette color ${index} requires RGB8.`);
        }
        const rgb = color.map(
          (channel, channelIndex) => readInteger(channel, `Palette color ${index} channel ${channelIndex}`, 0, 255)
        );
        return [rgb[0], rgb[1], rgb[2], index === transparentIndex ? 0 : 255];
      });
      return { colors, transparentIndex };
    };
  }
});

// packages/assets/src/image.ts
var init_image = __esm({
  async "packages/assets/src/image.ts"() {
    "use strict";
    await init_png();
    init_image_conversion();
  }
});

// packages/plugin-snes/src/assets/assembly-formats.ts
var registry, encoders, aliases, imageOptions, audioOptions2, optionSchemaFor, snesAssetFormats;
var init_assembly_formats = __esm({
  async "packages/plugin-snes/src/assets/assembly-formats.ts"() {
    "use strict";
    init_src2();
    await init_audio();
    init_data();
    await init_image();
    init_snes();
    registry = new AssetRegistry().registerImporter(rawImporter).registerImporter(jsonImporter).registerImporter(pngImporter).registerImporter(waveImporter);
    encoders = [...withAudioEncoder(withImageEncoders(snesNativeEncoders)), rawEncoder];
    for (const encoder of encoders) {
      registry.registerEncoder(encoder);
    }
    aliases = {
      "snes.tile.2bpp": ["2bpp"],
      "snes.tile.3bpp": ["3bpp"],
      "snes.tile.4bpp": ["4bpp"],
      "snes.tile.8bpp": ["8bpp"],
      "snes.tile.mode7": ["mode7"],
      "snes.palette.bgr555": ["palette"],
      "snes.tilemap.bg": ["bgmap"],
      "snes.tilemap.mode7": ["mode7map"],
      "snes.brr": ["brr"],
      "uttori.data.raw": ["raw"]
    };
    imageOptions = {
      palette: { summary: "Embedded, exact external, or auto palette", valueSyntax: '"embedded"' },
      paletteExpansion: { summary: "RGB8/BGR555 expansion profile", valueSyntax: '"bit-replicate"' },
      layout: { summary: "Tile traversal and block order", valueSyntax: '{ tileOrder: "row-major" }' },
      tilemap: { summary: "Map index and attribute options", valueSyntax: "{ startTileIndex: 0 }" }
    };
    audioOptions2 = {
      padding: { summary: "PCM tail padding policy", valueSyntax: '"reject"' },
      loop: { summary: "Playback loop in sample frames", valueSyntax: "false" }
    };
    optionSchemaFor = (id) => {
      if (id.startsWith("snes.tile.")) {
        return imageOptions;
      }
      if (id === "snes.brr") {
        return audioOptions2;
      }
      return {};
    };
    snesAssetFormats = encoders.map((encoder) => ({
      id: encoder.id,
      version: encoder.version,
      aliases: aliases[encoder.id] ?? [],
      targets: ["snes.sfc"],
      optionSchema: optionSchemaFor(encoder.id),
      resourcePaths: (options) => {
        const palette = options.palette;
        if (typeof palette === "string" && palette !== "embedded" && palette !== "auto") {
          return [palette];
        }
        return [];
      },
      convert: (source, options, resources) => {
        const result = convertAsset(registry, {
          source,
          format: encoder.id,
          options,
          resources
        });
        return { primaryOutput: result.primaryOutput, outputs: result.outputs };
      }
    }));
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
  if (mode3 === "off") {
    state.bankCrossMode = "off";
  } else if (mode3 === "half") {
    state.bankCrossMode = "half";
  } else if (mode3 === "full" || mode3 === "on") {
    state.bankCrossMode = "full";
  } else {
    throw new Error(`Invalid parameter for check bankcross: ${words[2]}`);
  }
}
function handleOptimize(state, words) {
  if (words.length < 3 || words[1].toLowerCase() !== "dp") {
    return;
  }
  const mode3 = words[2].toLowerCase();
  if (mode3 === "none") {
    state.optimizeDirectPage = false;
  } else if (mode3 === "ram" || mode3 === "always") {
    state.optimizeDirectPage = true;
  }
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
        if (words.length < 2) {
          throw new Error("spcblock requires at least a destination address.");
        }
        if (words.length > 4) {
          throw new Error("spcblock has too many arguments.");
        }
        if (this.state.inSpcBlock) {
          throw new Error("Nested spcblock directives are not supported.");
        }
        const destination = this.session.operandResolver.getnum(this.session.resolvedefines(words[1]));
        if ((destination & ~65535) !== 0) {
          throw new Error(`spcblock destination must be 16-bit, got: ${words[1]}`);
        }
        let type = "nspc";
        if (words.length === 3) {
          const kind = words[2].toLowerCase();
          if (kind === "nspc") {
            type = "nspc";
          } else if (kind === "custom") {
            throw new Error("Custom spcblock mode requires a macro and is not implemented.");
          } else {
            throw new Error(`Unknown spcblock type: ${words[2]}`);
          }
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
       * Size is only patched when `canFinalize` (emit pass). Collect/layout leave
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
          if (sizeOffset < 0) {
            throw new Error("spcblock size address does not map to output.");
          }
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
        if (address4 < 0 || address4 > 16777215) {
          return -1;
        }
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
            if ((address4 & 32768) === 0) {
              return -1;
            }
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
        if (offset < 0) {
          return -1;
        }
        let address4 = offset;
        if (context.mapper === "lorom") {
          if (address4 >= 4194304) {
            return -1;
          }
          address4 = address4 << 1 & 8323072 | address4 & 32767 | 32768;
          return address4 | 8388608;
        }
        if (context.mapper === "hirom") {
          return address4 >= 4194304 ? -1 : address4 | 12582912;
        }
        if (context.mapper === "exlorom") {
          if (address4 >= 8388608) {
            return -1;
          }
          if (address4 & 4194304) {
            address4 -= 4194304;
            return address4 << 1 & 8323072 | address4 & 32767 | 32768;
          }
          address4 = address4 << 1 & 8323072 | address4 & 32767 | 32768;
          return address4 | 8388608;
        }
        if (context.mapper === "exhirom") {
          if (address4 >= 8388608) {
            return -1;
          }
          return address4 & 4194304 ? address4 : address4 | 12582912;
        }
        if (context.mapper === "sa1rom") {
          if (address4 >= 8388608) {
            return -1;
          }
          for (let index = 0; index < 8; index++) {
            if (context.sa1banks[index] === (address4 & 7340032)) {
              return 32768 | index << 21 | (address4 & 1015808) << 1 | address4 & 32767;
            }
          }
          return -1;
        }
        if (context.mapper === "bigsa1rom") {
          if (address4 >= 8388608) {
            return -1;
          }
          if ((address4 & 4194304) === 4194304) {
            return address4 | 12582912;
          }
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

// packages/plugin-snes/src/assembler.ts
var SNES_TARGET_ID, toolingFor, directive, numericArgument, addressExpressions, readExpressions, targetOptions, createInitialState, plugin;
var init_assembler = __esm({
  async "packages/plugin-snes/src/assembler.ts"() {
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
    await init_assembly_formats();
    init_ca65_compat();
    init_freespace();
    init_layout();
    init_spc();
    init_session_state2();
    init_address_space();
    init_directive_catalog2();
    init_instruction_catalog2();
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
        for (const format of snesAssetFormats) {
          context.registerAssetFormat(format);
        }
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
                if (snesRomAddressSpace.toOutputOffset(normalized, mappingContext()) < 0) {
                  return;
                }
                if (targetState.bankCrossMode === "off" || width <= 1) {
                  return;
                }
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
              if (!targetState.checksumEnabled) {
                return;
              }
              const headerOffset = getChecksumHeaderOffset(targetState.mapper);
              if (outputBytes.length < headerOffset + 32) {
                return;
              }
              outputBytes[headerOffset + 28] = 255;
              outputBytes[headerOffset + 29] = 255;
              outputBytes[headerOffset + 30] = 0;
              outputBytes[headerOffset + 31] = 0;
              const checksum2 = calculateHeaderChecksum(outputBytes, targetState.checksumMode);
              const complement = ~checksum2 & 65535;
              outputBytes[headerOffset + 28] = complement & 255;
              outputBytes[headerOffset + 29] = complement >> 8 & 255;
              outputBytes[headerOffset + 30] = checksum2 & 255;
              outputBytes[headerOffset + 31] = checksum2 >> 8 & 255;
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
              if (targetState.activeFreespaceStartOffset === null) {
                return;
              }
              const outputOffset = session.outputWriter.toOutputOffset(logicalAddress);
              if (outputOffset < 0) {
                return;
              }
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
              if (start === null || contentStart === null || end === null || end < contentStart) {
                return;
              }
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
        description: "BG1 horizontal scroll, write twice. Also Mode 7 horizontal offset."
      },
      {
        symbol: "BG1VOFS",
        address: 8462,
        description: "BG1 vertical scroll, write twice. Also Mode 7 vertical offset."
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
        description: "Mode 7 matrix parameter A, write twice. Multiplication operand."
      },
      {
        symbol: "M7B",
        address: 8476,
        description: "Mode 7 matrix parameter B, write twice. Multiplication operand."
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
        description: "PPU multiplication result, low byte. Read only."
      },
      {
        symbol: "MPYM",
        address: 8501,
        description: "PPU multiplication result, middle byte. Read only."
      },
      {
        symbol: "MPYH",
        address: 8502,
        description: "PPU multiplication result, high byte. Read only."
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
      { symbol: "STAT77", address: 8510, description: "PPU1 status and version number. Read only." },
      { symbol: "STAT78", address: 8511, description: "PPU2 status and version number. Read only." },
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
        description: "V-blank NMI flag and CPU version. Read acknowledges the flag."
      },
      {
        symbol: "TIMEUP",
        address: 16913,
        description: "H/V timer IRQ flag. Read acknowledges the flag."
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
        description: "Unsigned division quotient, low byte. Read only."
      },
      {
        symbol: "RDDIVH",
        address: 16917,
        description: "Unsigned division quotient, high byte. Read only."
      },
      {
        symbol: "RDMPYL",
        address: 16918,
        description: "Multiplication product or division remainder, low byte. Read only."
      },
      {
        symbol: "RDMPYH",
        address: 16919,
        description: "Multiplication product or division remainder, high byte. Read only."
      },
      {
        symbol: "JOY1L",
        address: 16920,
        description: "Automatic joypad result for controller 1, low byte. Read only."
      },
      {
        symbol: "JOY1H",
        address: 16921,
        description: "Automatic joypad result for controller 1, high byte. Read only."
      },
      {
        symbol: "JOY2L",
        address: 16922,
        description: "Automatic joypad result for controller 2, low byte. Read only."
      },
      {
        symbol: "JOY2H",
        address: 16923,
        description: "Automatic joypad result for controller 2, high byte. Read only."
      },
      {
        symbol: "JOY3L",
        address: 16924,
        description: "Automatic joypad result for controller 3, low byte. Read only."
      },
      {
        symbol: "JOY3H",
        address: 16925,
        description: "Automatic joypad result for controller 3, high byte. Read only."
      },
      {
        symbol: "JOY4L",
        address: 16926,
        description: "Automatic joypad result for controller 4, low byte. Read only."
      },
      {
        symbol: "JOY4H",
        address: 16927,
        description: "Automatic joypad result for controller 4, high byte. Read only."
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
        description: "Unused DMA/HDMA data byte. Shared with the $43nF mirror."
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
var init_superfx_state = __esm({
  "packages/plugin-snes/src/disassembler/superfx-state.ts"() {
    "use strict";
  }
});

// packages/plugin-snes/src/disassembler/processor-source-export.ts
var init_processor_source_export = __esm({
  "packages/plugin-snes/src/disassembler/processor-source-export.ts"() {
    "use strict";
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

// packages/plugin-snes/src/disassembler/modification-assets.ts
var init_modification_assets = __esm({
  async "packages/plugin-snes/src/disassembler/modification-assets.ts"() {
    "use strict";
  }
});

// packages/plugin-snes/src/disassembler/modification-project.ts
var init_modification_project = __esm({
  async "packages/plugin-snes/src/disassembler/modification-project.ts"() {
    "use strict";
  }
});

// packages/plugin-snes/src/disassembler/superfx-analysis.ts
var init_superfx_analysis = __esm({
  "packages/plugin-snes/src/disassembler/superfx-analysis.ts"() {
    "use strict";
  }
});

// packages/plugin-snes/src/disassembler/modification-operations.ts
var init_modification_operations = __esm({
  async "packages/plugin-snes/src/disassembler/modification-operations.ts"() {
    "use strict";
  }
});

// packages/plugin-snes/src/disassembler/modification-rebase.ts
var init_modification_rebase = __esm({
  async "packages/plugin-snes/src/disassembler/modification-rebase.ts"() {
    "use strict";
  }
});

// packages/plugin-snes/src/disassembler/source-reconciliation.ts
var init_source_reconciliation = __esm({
  async "packages/plugin-snes/src/disassembler/source-reconciliation.ts"() {
    "use strict";
  }
});

// packages/plugin-snes/src/disassembler/modification-editor.ts
var init_modification_editor = __esm({
  async "packages/plugin-snes/src/disassembler/modification-editor.ts"() {
    "use strict";
  }
});

// packages/plugin-snes/src/disassembler/metadata-migration.ts
var init_metadata_migration = __esm({
  async "packages/plugin-snes/src/disassembler/metadata-migration.ts"() {
    "use strict";
  }
});

// packages/plugin-snes/src/disassembler/modification-retention.ts
var init_modification_retention = __esm({
  async "packages/plugin-snes/src/disassembler/modification-retention.ts"() {
    "use strict";
  }
});

// packages/plugin-snes/src/index.ts
var init_src3 = __esm({
  async "packages/plugin-snes/src/index.ts"() {
    "use strict";
    init_assembler();
    init_analysis();
    init_state();
    init_address_identities();
    init_dizraw_import();
    init_hardware_registers();
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
    init_modification_project();
    init_ram_map();
    init_superfx_address_space();
    init_superfx_analysis();
    init_superfx_state();
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
    init_runtime_code();
    init_modification_assets();
    init_modification_operations();
    init_modification_rebase();
    init_source_reconciliation();
    init_modification_editor();
    init_metadata_migration();
    init_modification_retention();
  }
});

// packages/debug-sidecar-ares/src/sidecar.ts
import { readFile as readFile2 } from "node:fs/promises";
import path3 from "node:path";

// packages/debug-adapter/src/contracts.ts
var DEBUG_BACKEND_PROTOCOL_VERSION = 1;

// packages/debug-adapter/src/capture-v2.ts
var maxU64 = (1n << 64n) - 1n;
var captureScope = (value) => {
  if (value !== "snes.65816.instructions" && value !== "snes.cpu-bus" && value !== "snes.cpu-bus-transfers" && value !== "snes.cpu-bus-ppu") {
    throw new Error("Unsupported capture scope.");
  }
  return value;
};
var captureU64 = (value) => {
  if (typeof value !== "string" || !/^(0|[1-9]\d{0,19})$/.test(value) || BigInt(value) > maxU64) {
    throw new Error("Capture counter must be a canonical unsigned 64-bit decimal string.");
  }
  return BigInt(value);
};
var captureSession = (value) => {
  if (typeof value !== "string" || !/^[\da-f]{32}$/.test(value)) {
    throw new Error("Invalid capture session identity.");
  }
  return value;
};
var validateCaptureRequest = (value) => {
  if (!value || typeof value !== "object") {
    throw new Error("Invalid capture request.");
  }
  if (value.operation === "context") {
    let fields2 = ["operation", "action"];
    if (["prepare", "replay", "restore"].includes(value.action)) {
      fields2.push("directory", "romContentSha256", "producer");
      const request = value;
      validateCaptureRequest({
        operation: "file-start",
        file: request.directory,
        romContentSha256: request.romContentSha256,
        producer: request.producer,
        bufferBytes: 8388608
      });
    } else if (value.action === "start" || value.action === "stop" || value.action === "mark") {
      fields2.push("session");
      captureSession(value.session);
      if (value.action === "mark") {
        fields2.push("label");
        if (typeof value.label !== "string" || !value.label.trim() || value.label.includes("\0") || new TextEncoder().encode(value.label).length > 256) {
          throw new Error("Capture milestone labels must contain 1\u2013256 UTF-8 bytes.");
        }
      }
    } else if (value.action !== "abort" && value.action !== "status") {
      throw new Error("Unsupported capture context action.");
    }
    if (Object.keys(value).some((key) => !fields2.includes(key))) {
      throw new Error("Unsupported capture context field.");
    }
    return;
  }
  if (value.operation === "file-capabilities") {
    if (Object.keys(value).some((key) => !["operation", "scope"].includes(key))) {
      throw new Error("Unsupported native file capability field.");
    }
    if (value.scope !== void 0) {
      captureScope(value.scope);
    }
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
    )) {
      throw new Error("Unsupported native file start field.");
    }
    if (value.measureStages !== void 0 && typeof value.measureStages !== "boolean") {
      throw new Error("Native file profiling must be boolean.");
    }
    validateCaptureRequest({
      operation: "start",
      bufferBytes: value.bufferBytes,
      scope: value.scope
    });
    const bounded = (text, max) => typeof text === "string" && text.length > 0 && !text.includes("\0") && new TextEncoder().encode(text).length <= max;
    if (!bounded(value.file, 4096) || !/^(?:\/|[a-z]:[/\\]|\\\\)/i.test(value.file) || !/^[\da-f]{64}$/.test(value.romContentSha256) || !bounded(value.producer?.id, 256) || !bounded(value.producer?.revision, 1024) || Object.keys(value.producer).some((key) => !["id", "revision"].includes(key))) {
      throw new Error(
        "Native file capture requires an absolute bounded path and exact ROM/producer identity."
      );
    }
    return;
  }
  let fields = ["operation", "session"];
  if (value.operation === "capabilities") {
    fields = ["operation", "scope"];
  }
  if (value.operation === "start") {
    fields = ["operation", "bufferBytes", "scope"];
  }
  if (value.operation === "read") {
    fields = ["operation", "session", "chunk"];
  }
  if (value.operation === "ack") {
    fields = ["operation", "session", "chunk", "event"];
  }
  if (Object.keys(value).some((key) => !fields.includes(key))) {
    throw new Error(
      "Unsupported capture negotiation field. Capture requires an explicit supported stream with durable ownership."
    );
  }
  if (value.operation === "capabilities" || value.operation === "start") {
    if (value.scope !== void 0) {
      captureScope(value.scope);
    }
  }
  if (value.operation === "capabilities") {
    return;
  }
  if (value.operation === "start") {
    if (!Number.isSafeInteger(value.bufferBytes) || value.bufferBytes < 4718656 || value.bufferBytes > 64 * 1024 * 1024) {
      throw new Error("Capture buffer must be between 4718656 bytes and 64 MiB.");
    }
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
  ].includes(value.operation)) {
    return;
  }
  if (value.operation === "read" || value.operation === "ack") {
    if (!captureU64(value.chunk)) {
      throw new Error("Capture chunk sequence starts at one.");
    }
    if (value.operation === "ack" && !captureU64(value.event)) {
      throw new Error("Capture event sequence starts at one.");
    }
    return;
  }
  throw new Error("Unsupported capture operation.");
};
var validateCaptureCapabilities = (value, scope = "snes.65816.instructions") => {
  captureScope(scope);
  let reserve = 71;
  if (scope === "snes.cpu-bus") {
    reserve = 64;
  }
  if (scope === "snes.cpu-bus-transfers") {
    reserve = 80;
  }
  if (scope === "snes.cpu-bus-ppu") {
    reserve = 88;
  }
  const expected = {
    version: 2,
    scope,
    mode: "lossless",
    ownership: "durable-prefix",
    maxChunkBytes: 262144,
    requiredReserveBytes: reserve,
    overheadBytes: 4194304,
    resumeSession: false
  };
  if (!value || typeof value !== "object" || Object.entries(expected).some(([key, item]) => value[key] !== item)) {
    throw new Error("Unsupported capture scope, reserve, or ownership contract.");
  }
  if (value.nativeFile === true) {
    return { ...expected, nativeFile: true };
  }
  return expected;
};
var validateCapturePosition = (value, session, scope) => {
  if (!value || typeof value !== "object") {
    throw new Error("Invalid capture position.");
  }
  const p = value;
  captureSession(p.session);
  if (session !== void 0 && p.session !== session) {
    throw new Error("Capture session changed.");
  }
  if (p.scope !== void 0) {
    captureScope(p.scope);
  }
  if (scope !== void 0 && (p.scope ?? "snes.65816.instructions") !== captureScope(scope)) {
    throw new Error("Capture scope changed or was not confirmed by the producer.");
  }
  if (!["armed", "recording", "throttled", "stopping", "draining", "complete", "incomplete"].includes(
    p.state
  )) {
    throw new Error("Invalid capture state.");
  }
  const bounds = [
    p.releasedThrough,
    p.durableThrough,
    p.acceptedThrough,
    p.deliveredThrough,
    p.producedThrough
  ].map(captureU64);
  if (bounds.some((v, i) => i > 0 && v < bounds[i - 1])) {
    throw new Error("Capture ownership boundaries are inconsistent.");
  }
  if (captureU64(p.chunkThrough) > captureU64(p.producedChunks)) {
    throw new Error("Capture chunk boundary is inconsistent.");
  }
  captureU64(p.throttleCount);
  if (!captureU64(p.clockNumerator) || !captureU64(p.clockDenominator)) {
    throw new Error("Invalid capture clock domain.");
  }
  if (p.droppedInScope !== "0" || typeof p.error !== "string" || p.error.length > 256) {
    throw new Error("Capture integrity failed.");
  }
  if (![p.bufferedBytes, p.allocatedBytes].every(
    (v) => Number.isSafeInteger(v) && v >= 0 && v <= 64 * 1024 * 1024
  ) || p.bufferedBytes > p.allocatedBytes) {
    throw new Error("Capture allocation exceeds its bounds.");
  }
  if (p.state === "complete" && (p.error || p.bufferedBytes || new Set(bounds.map(String)).size !== 1 || p.chunkThrough !== p.producedChunks)) {
    throw new Error("Capture terminal totals do not reconcile.");
  }
  return p;
};

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
  if (typeof value !== "string" || !sessionPattern.test(value)) {
    throw new Error("Sidecar session token must be 32-128 base64url characters.");
  }
}
var assertRequestBounds = (message, limits) => {
  const args = message.arguments ?? {};
  if (!isRecord(args)) {
    throw new Error("Sidecar request arguments must be an object.");
  }
  if (message.command === "readMemory") {
    const count = args.count;
    if (!nonNegativeInteger(count) || count > limits.maxMemoryReadBytes) {
      throw new Error(`Memory read count must be between 0 and ${limits.maxMemoryReadBytes}.`);
    }
  }
  if (message.command === "disassemble") {
    const count = args.count;
    if (!nonNegativeInteger(count) || count > limits.maxDisassemblyInstructions) {
      throw new Error(
        `Disassembly count must be between 0 and ${limits.maxDisassemblyInstructions}.`
      );
    }
  }
  if (message.command === "setBreakpoints") {
    const breakpoints = args.breakpoints;
    if (!Array.isArray(breakpoints) || breakpoints.length > limits.maxBreakpoints) {
      throw new Error(`Breakpoint count must be between 0 and ${limits.maxBreakpoints}.`);
    }
  }
  if (message.command === "readTrace") {
    const maxEvents = args.maxEvents;
    if (!positiveInteger(maxEvents) || maxEvents > limits.maxTraceBatchEvents) {
      throw new Error(`Trace batch size must be between 1 and ${limits.maxTraceBatchEvents}.`);
    }
  }
};
function assertDebugSidecarMessage(value, limits = DEFAULT_DEBUG_SIDECAR_LIMITS) {
  if (!isRecord(value)) {
    throw new Error("Sidecar message must be an object.");
  }
  if (value.protocol !== DEBUG_SIDECAR_PROTOCOL) {
    throw new Error(`Unsupported sidecar protocol '${String(value.protocol)}'.`);
  }
  if (value.version !== DEBUG_SIDECAR_PROTOCOL_VERSION) {
    throw new Error(`Unsupported sidecar protocol version '${String(value.version)}'.`);
  }
  assertDebugSidecarSessionToken(value.session);
  if (!positiveInteger(value.sequence)) {
    throw new Error("Sidecar message sequence must be a positive safe integer.");
  }
  if (value.type === "request") {
    if (!DEBUG_SIDECAR_COMMANDS.includes(value.command)) {
      throw new Error(`Unsupported sidecar command '${String(value.command)}'.`);
    }
    assertRequestBounds(value, limits);
    return;
  }
  if (value.type === "response") {
    if (!positiveInteger(value.requestSequence)) {
      throw new Error("Sidecar response requestSequence must be a positive safe integer.");
    }
    if (typeof value.success !== "boolean") {
      throw new Error("Sidecar response success must be boolean.");
    }
    if (!value.success && typeof value.error !== "string") {
      throw new Error("Failed sidecar response must include an error string.");
    }
    return;
  }
  if (value.type === "event") {
    if (!DEBUG_SIDECAR_EVENTS.includes(value.event)) {
      throw new Error(`Unsupported sidecar event '${String(value.event)}'.`);
    }
    if (!isRecord(value.body)) {
      throw new Error("Sidecar event body must be an object.");
    }
    return;
  }
  throw new Error(`Unsupported sidecar message type '${String(value.type)}'.`);
}
var validateLimits = (limits) => {
  for (const [name, value] of Object.entries(limits)) {
    if (!positiveInteger(value)) {
      throw new Error(`${name} must be a positive safe integer.`);
    }
  }
  if (limits.maxBufferedBytes < limits.maxFrameBytes + 4) {
    throw new Error("maxBufferedBytes must hold at least one complete framed message.");
  }
};
var encodeDebugSidecarMessage = (message, limits = DEFAULT_DEBUG_SIDECAR_LIMITS) => {
  validateLimits(limits);
  assertDebugSidecarMessage(message, limits);
  const body = Buffer.from(JSON.stringify(message), "utf8");
  if (body.length > limits.maxFrameBytes) {
    throw new Error(`Sidecar frame exceeds ${limits.maxFrameBytes} bytes.`);
  }
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
    if (this.#buffer.length + chunk.length > this.#limits.maxBufferedBytes) {
      throw new Error(`Sidecar receive buffer exceeds ${this.#limits.maxBufferedBytes} bytes.`);
    }
    this.#buffer = Buffer.concat([this.#buffer, chunk]);
    const messages = [];
    while (this.#buffer.length >= 4) {
      const length = this.#buffer.readUInt32BE(0);
      if (length === 0) {
        throw new Error("Sidecar frame body cannot be empty.");
      }
      if (length > this.#limits.maxFrameBytes) {
        throw new Error(`Sidecar frame declares ${length} bytes, above the configured limit.`);
      }
      if (this.#buffer.length < length + 4) {
        break;
      }
      const body = this.#buffer.subarray(4, length + 4);
      this.#buffer = this.#buffer.subarray(length + 4);
      let decoded;
      try {
        decoded = JSON.parse(body.toString("utf8"));
      } catch {
        throw new Error("Sidecar frame contains invalid JSON.");
      }
      assertDebugSidecarMessage(decoded, this.#limits);
      if (decoded.sequence <= this.#lastSequence) {
        throw new Error(
          `Sidecar sequence ${decoded.sequence} is not greater than ${this.#lastSequence}.`
        );
      }
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
    if (this.#frames.length >= this.#limits.maxQueuedMessages || this.#bytes + frame.length > this.#limits.maxQueuedBytes) {
      throw new Error("Sidecar outgoing queue exceeded its backpressure limit.");
    }
    this.#frames.push(frame);
    this.#bytes += frame.length;
  }
  /**
   * Removes the oldest encoded frame.
   * @returns {Uint8Array | undefined} Oldest frame or undefined when empty.
   */
  dequeue() {
    const frame = this.#frames.shift();
    if (frame) {
      this.#bytes -= frame.length;
    }
    return frame;
  }
};

// packages/debug-adapter/src/node-stdio-transport.ts
var DEBUG_SIDECAR_SESSION_ENV = "UTTORI_ASM_DEBUG_SESSION";

// packages/debug-adapter/src/sidecar-server.ts
var stepKinds = /* @__PURE__ */ new Set(["instruction", "over", "in", "out"]);
var record = (value, context) => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${context} must be an object.`);
  }
  return value;
};
var integer = (value, context, minimum = 0) => {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`${context} must be a safe integer greater than or equal to ${minimum}.`);
  }
  return value;
};
var positiveInteger2 = (value, context) => integer(value, context, 1);
var string = (value, context) => {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${context} must be a non-empty string.`);
  }
  return value;
};
var optionalPositiveInteger = (value, context) => value === void 0 ? void 0 : positiveInteger2(value, context);
var boolean = (value, context, defaultValue) => {
  if (value === void 0) {
    return defaultValue;
  }
  if (typeof value !== "boolean") {
    throw new Error(`${context} must be boolean.`);
  }
  return value;
};
var address = (value, context) => {
  const candidate = record(value, context);
  if (typeof candidate.architecture !== "string" || candidate.architecture.length === 0) {
    throw new Error(`${context}.architecture must be a non-empty string.`);
  }
  if (typeof candidate.addressSpace !== "string" || candidate.addressSpace.length === 0) {
    throw new Error(`${context}.addressSpace must be a non-empty string.`);
  }
  const outputOffset = candidate.outputOffset === void 0 ? void 0 : integer(candidate.outputOffset, `${context}.outputOffset`);
  return {
    architecture: candidate.architecture,
    addressSpace: candidate.addressSpace,
    address: integer(candidate.address, `${context}.address`),
    ...outputOffset === void 0 ? {} : { outputOffset }
  };
};
var addresses = (value, context) => {
  if (!Array.isArray(value)) {
    throw new Error(`${context} must be an array.`);
  }
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
    if (typeof options.backend !== "string" || options.backend.length === 0) {
      throw new Error("Sidecar backend name must be a non-empty string.");
    }
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
    if (this.#closed) {
      return Promise.reject(new Error("Sidecar server is closed."));
    }
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
    if (this.#closed) {
      return;
    }
    this.#closed = true;
    this.#eventSubscription.dispose();
    await this.#writeTail.catch(() => void 0);
    await this.#closeTransport(error);
  }
  async #receive(data) {
    for (const message of this.#parser.push(data)) {
      if (message.session !== this.#session) {
        throw new Error("Sidecar request session does not match this connection.");
      }
      if (message.type !== "request") {
        throw new Error("Sidecar client sent a non-request message on a server-only channel.");
      }
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
    for (const event of events) {
      await this.#send(this.#eventEnvelope(event));
    }
    if (request.command === "shutdown" && !failure) {
      await this.close();
    }
  }
  async #dispatch(request) {
    const args = record(request.arguments ?? {}, "Sidecar request arguments");
    if (request.command === "initialize") {
      if (args.backend !== this.#backendName) {
        throw new Error("Unexpected backend identity.");
      }
      if (args.backendProtocolVersion !== DEBUG_BACKEND_PROTOCOL_VERSION) {
        throw new Error("Unsupported backend protocol version.");
      }
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
      if (!stepKinds.has(args.kind)) {
        throw new Error(`Unsupported step kind '${String(args.kind)}'.`);
      }
      await this.#implementation.step(
        positiveInteger2(args.threadId, "Step threadId"),
        args.kind
      );
      return {};
    }
    if (request.command === "threads") {
      return this.#implementation.threads();
    }
    if (request.command === "stackFrames") {
      return this.#implementation.stackFrames(
        positiveInteger2(args.threadId, "Stack frames threadId")
      );
    }
    if (request.command === "registers") {
      return this.#implementation.registers(positiveInteger2(args.frameId, "Registers frameId"));
    }
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
    if (request.command === "setBreakpoints") {
      return this.#implementation.setBreakpoints(
        addresses(args.breakpoints, "Breakpoint addresses")
      );
    }
    if (request.command === "disassemble") {
      return this.#implementation.disassemble(
        address(args.address, "Disassembly address"),
        integer(args.count, "Disassembly count")
      );
    }
    if (request.command === "capture") {
      const capture = args;
      validateCaptureRequest(capture);
      if (!this.#implementation.capture) {
        throw new Error("This backend does not support capture v2.");
      }
      return this.#implementation.capture(capture);
    }
    if (request.command === "startTrace") {
      if (args.detail !== void 0 && args.detail !== "pc" && args.detail !== "full") {
        throw new Error("Trace detail must be pc or full.");
      }
      await this.#implementation.startTrace({
        architecture: string(args.architecture, "Trace architecture"),
        addressSpace: string(args.addressSpace, "Trace address space"),
        ...args.detail === void 0 ? {} : { detail: args.detail }
      });
      return {};
    }
    if (request.command === "readTrace") {
      return this.#implementation.readTrace(positiveInteger2(args.maxEvents, "Trace batch size"));
    }
    if (request.command === "stopTrace") {
      await this.#implementation.stopTrace();
      return {};
    }
    if (request.command === "ping") {
      return { pong: true };
    }
    if (request.command === "shutdown") {
      return {};
    }
    throw new Error(`Unsupported command '${String(request.command)}'.`);
  }
  #backendEvent(event) {
    if (this.#closed) {
      return;
    }
    if (this.#capturedEvents) {
      this.#capturedEvents.push(event);
      return;
    }
    void this.#send(this.#eventEnvelope(event)).catch(
      (error) => this.close(asError(error))
    );
  }
  #eventEnvelope(event) {
    if (event.type === "stopped") {
      return this.#envelope({
        type: "event",
        event: "stopped",
        body: { reason: event.reason, threadId: event.threadId }
      });
    }
    if (event.type === "continued") {
      return this.#envelope({
        type: "event",
        event: "continued",
        body: { threadId: event.threadId, allThreads: event.allThreads }
      });
    }
    if (event.type === "terminated") {
      return this.#envelope({
        type: "event",
        event: "terminated",
        body: { restart: event.restart }
      });
    }
    if (event.type === "breakpoint") {
      return this.#envelope({
        type: "event",
        event: "breakpoint",
        body: { breakpoint: event.breakpoint }
      });
    }
    return this.#envelope({
      type: "event",
      event: "output",
      body: { category: event.category, text: event.text }
    });
  }
  #envelope(message) {
    if (!Number.isSafeInteger(this.#serverSequence) || this.#serverSequence <= 0) {
      throw new Error("Sidecar server sequence exhausted.");
    }
    return {
      protocol: DEBUG_SIDECAR_PROTOCOL,
      version: DEBUG_SIDECAR_PROTOCOL_VERSION,
      session: this.#session,
      sequence: this.#serverSequence++,
      ...message
    };
  }
  #send(message) {
    if (this.#closed) {
      return Promise.reject(new Error("Sidecar server is closed."));
    }
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

// packages/debug-adapter/src/capture-context.ts
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, open, readdir, readFile, link, unlink } from "node:fs/promises";
import path from "node:path";
var verifyCaptureContext = async (directory, identity) => {
  const metadataFile = path.join(directory, "manifest.json");
  const metadataStat = await lstat(metadataFile);
  if (!metadataStat.isFile() || metadataStat.isSymbolicLink() || metadataStat.size > 1048576) {
    throw new Error("Invalid capture context manifest.");
  }
  const manifest = JSON.parse(await readFile(metadataFile, "utf8"));
  const producer = manifest.producer;
  if (manifest.format !== "uttori-capture-context" || manifest.version !== 1 || manifest.romContentSha256 !== identity.romContentSha256 || producer?.id !== identity.producer.id || producer?.revision !== identity.producer.revision || !manifest.files || typeof manifest.files !== "object") {
    throw new Error("Capture context requires the matching ROM and emulator build.");
  }
  const files = manifest.files;
  for (const name of [
    "start.bst",
    "wram-start.bin",
    "wram-end.bin",
    "inputs.bin",
    "identity.txt",
    "machine.json",
    "start-clock.txt",
    "end-clock.txt",
    "boundaries.json"
  ]) {
    if (!files[name]) {
      throw new Error(`Capture context is missing ${name}.`);
    }
  }
  for (const [name, artifact] of Object.entries(files)) {
    if (!/^(?:identity\.txt|machine\.json|start\.bst|wram-(?:start|end)\.bin|inputs\.bin|milestones\.jsonl|(?:start|end)-clock\.txt|boundaries\.json|graphics\.act2|screen-\d+\.png)$/.test(
      name
    ) || !artifact || !Number.isSafeInteger(artifact.bytes) || artifact.bytes < 0 || !/^[\da-f]{64}$/.test(artifact.sha256)) {
      throw new Error("Invalid capture context artifact descriptor.");
    }
    const file = path.join(directory, name), stat2 = await lstat(file);
    if (!stat2.isFile() || stat2.isSymbolicLink() || stat2.size !== artifact.bytes || name === "start.bst" && (stat2.size < 538 || stat2.size > 32 * 1048576) || name.startsWith("wram-") && stat2.size !== 131072 || name === "inputs.bin" && stat2.size % 18) {
      throw new Error(`Capture context artifact size/type mismatch: ${name}.`);
    }
    const hash = createHash("sha256");
    for await (const bytes of createReadStream(file)) {
      hash.update(bytes);
    }
    if (hash.digest("hex") !== artifact.sha256) {
      throw new Error(`Capture context checksum mismatch: ${name}.`);
    }
  }
};

// packages/debug-sidecar-ares/src/ares-process-host.ts
import { spawn } from "node:child_process";
import { createHash as createHash2 } from "node:crypto";
import { createReadStream as createReadStream2 } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import net2 from "node:net";
import path2 from "node:path";

// packages/debug-sidecar-ares/src/gdb-rsp-client.ts
var asError2 = (error) => error instanceof Error ? error : new Error(String(error));
var checksum = (payload) => {
  let value = 0;
  for (let index = 0; index < payload.length; index++) {
    value = value + payload[index] & 255;
  }
  return value;
};
var escapedPayload = (payload) => {
  const result = [];
  for (const byte of Buffer.from(payload, "ascii")) {
    if (byte === 35 || byte === 36 || byte === 42 || byte === 125) {
      result.push(125, byte ^ 32);
    } else {
      result.push(byte);
    }
  }
  return Uint8Array.from(result);
};
var unescapePayload = (payload) => {
  if (!payload.includes(125)) {
    if (payload.includes(42)) {
      throw new Error("RSP run-length encoded payloads are not supported on the ares channel.");
    }
    return payload.toString("ascii");
  }
  const result = Buffer.allocUnsafe(payload.length);
  let length = 0;
  for (let index = 0; index < payload.length; index++) {
    const byte = payload[index];
    if (byte === 42) {
      throw new Error("RSP run-length encoded payloads are not supported on the ares channel.");
    }
    if (byte !== 125) {
      result[length++] = byte;
      continue;
    }
    const escaped = payload[++index];
    if (escaped === void 0) {
      throw new Error("RSP payload ends inside an escape sequence.");
    }
    result[length++] = escaped ^ 32;
  }
  return result.toString("ascii", 0, length);
};
var hexDigit = (byte) => {
  if (byte >= 48 && byte <= 57) {
    return byte - 48;
  }
  if (byte >= 65 && byte <= 70) {
    return byte - 65 + 10;
  }
  if (byte >= 97 && byte <= 102) {
    return byte - 97 + 10;
  }
  return -1;
};
var stop = (payload) => {
  if (!/^[ST][\dA-Fa-f]{2}/.test(payload)) {
    return void 0;
  }
  return { signal: Number.parseInt(payload.slice(1, 3), 16), payload };
};
var GdbRspClient = class {
  #transport;
  #requestTimeoutMs;
  #maxPacketBytes;
  #maxBufferedBytes;
  #stopListeners = /* @__PURE__ */ new Set();
  #closeListeners = /* @__PURE__ */ new Set();
  #dataSubscription;
  #closeSubscription;
  #buffer = Buffer.alloc(0);
  /** Unconsumed bytes occupy [start, end). Capacity grows geometrically within the receive bound. */
  #start = 0;
  #end = 0;
  /** First unchecked position for '#', or the delimiter while awaiting checksum bytes. */
  #scan = 1;
  #pending;
  #writeTail = Promise.resolve();
  #started = false;
  #closed = false;
  #closeError;
  /** @param {GdbRspClientOptions} options Transport and protocol safety bounds. */
  constructor(options) {
    this.#transport = options.transport;
    this.#requestTimeoutMs = options.requestTimeoutMs ?? 3e3;
    this.#maxPacketBytes = options.maxPacketBytes ?? 1048576;
    this.#maxBufferedBytes = options.maxBufferedBytes ?? this.#maxPacketBytes * 2;
    for (const [name, value] of [
      ["RSP request timeout", this.#requestTimeoutMs],
      ["RSP maximum packet bytes", this.#maxPacketBytes],
      ["RSP maximum buffered bytes", this.#maxBufferedBytes]
    ]) {
      if (!Number.isSafeInteger(value) || value <= 0) {
        throw new Error(`${name} must be a positive safe integer.`);
      }
    }
    if (this.#maxBufferedBytes < this.#maxPacketBytes + 4) {
      throw new Error("RSP receive buffer must hold one maximum-sized framed packet.");
    }
    this.#dataSubscription = this.#transport.onData((data) => this.#receive(data));
    this.#closeSubscription = this.#transport.onClose(
      (error) => this.#fail(error ?? new Error("RSP transport closed."), false)
    );
  }
  /** @returns {boolean} Whether the client has permanently closed. */
  get closed() {
    return this.#closed;
  }
  /** @returns {Promise<void>} Completion after writing the required initial acknowledgement byte. */
  async start() {
    if (this.#closed) {
      throw new Error("RSP client is closed.");
    }
    if (this.#started) {
      throw new Error("RSP client has already started.");
    }
    this.#started = true;
    await this.#write(Uint8Array.of(43));
  }
  /**
   * Subscribes to asynchronous stop packets.
   * @param {(event: GdbRspStop) => void} listener Stop-event consumer.
   * @returns {DebugSubscription} Disposable subscription.
   */
  onStop(listener) {
    this.#stopListeners.add(listener);
    return { dispose: () => this.#stopListeners.delete(listener) };
  }
  /**
   * Subscribes to terminal RSP transport or protocol failure.
   * @param {(error: Error) => void} listener Close-error consumer.
   * @returns {DebugSubscription} Disposable subscription.
   */
  onClose(listener) {
    if (this.#closeError) {
      queueMicrotask(() => listener(this.#closeError));
      return { dispose: () => void 0 };
    }
    this.#closeListeners.add(listener);
    return { dispose: () => this.#closeListeners.delete(listener) };
  }
  /**
   * Sends one packet and waits for its non-stop response.
   * @param {string} command RSP command payload.
   * @returns {Promise<string>} Response payload.
   */
  request(command) {
    return this.#request(command, false);
  }
  /**
   * Sends a handshake packet such as `?` whose response is itself a stop packet.
   * @param {string} command RSP command payload.
   * @returns {Promise<string>} Stop response payload.
   */
  requestStop(command) {
    return this.#request(command, true);
  }
  /** @returns {Promise<void>} Completion after writing continue. */
  continue() {
    return this.#sendExecutionCommand("c");
  }
  /** @returns {Promise<void>} Completion after writing one-instruction step. */
  step() {
    return this.#sendExecutionCommand("s");
  }
  /** @returns {Promise<void>} Completion after writing the out-of-band interrupt byte. */
  interrupt() {
    this.#assertReady();
    if (this.#pending) {
      return Promise.reject(new Error("An RSP request is already pending."));
    }
    return this.#write(Uint8Array.of(3));
  }
  /** @returns {Promise<void>} Completion after closing the transport. */
  async close() {
    if (this.#closed) {
      return;
    }
    this.#fail(new Error("RSP client closed."), false);
    await this.#transport.close();
  }
  #request(command, acceptStop) {
    try {
      this.#assertReady();
    } catch (error) {
      return Promise.reject(asError2(error));
    }
    if (this.#pending) {
      return Promise.reject(new Error("An RSP request is already pending."));
    }
    let packet;
    try {
      packet = this.#packet(command);
    } catch (error) {
      return Promise.reject(asError2(error));
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => this.#fail(new Error(`RSP request '${command}' timed out.`)),
        this.#requestTimeoutMs
      );
      this.#pending = { acceptStop, resolve, reject, timer };
      void this.#write(packet).catch((error) => this.#fail(asError2(error)));
    });
  }
  #sendExecutionCommand(command) {
    this.#assertReady();
    if (this.#pending) {
      return Promise.reject(new Error("An RSP request is already pending."));
    }
    return this.#write(this.#packet(command));
  }
  #packet(command) {
    const payload = escapedPayload(command);
    if (payload.length > this.#maxPacketBytes) {
      throw new Error(`RSP payload exceeds ${this.#maxPacketBytes} bytes.`);
    }
    const sum = checksum(payload).toString(16).padStart(2, "0");
    return Buffer.concat([Buffer.from("$", "ascii"), payload, Buffer.from(`#${sum}`, "ascii")]);
  }
  #receive(data) {
    if (this.#closed) {
      return;
    }
    try {
      this.#append(data);
      while (this.#start < this.#end) {
        if (this.#buffer[this.#start] !== 36) {
          const next = this.#buffer.subarray(this.#start, this.#end).indexOf(36);
          if (next < 0) {
            this.#start = this.#end;
            break;
          }
          this.#start += next;
          this.#scan = this.#start + 1;
        }
        const offset = this.#buffer.subarray(this.#scan, this.#end).indexOf(35);
        if (offset < 0) {
          this.#scan = this.#end;
          if (this.#end - this.#start - 1 > this.#maxPacketBytes) {
            throw new Error(`RSP packet exceeds ${this.#maxPacketBytes} bytes.`);
          }
          return;
        }
        const hash = this.#scan + offset;
        this.#scan = hash;
        if (hash - this.#start - 1 > this.#maxPacketBytes) {
          throw new Error(`RSP packet exceeds ${this.#maxPacketBytes} bytes.`);
        }
        if (this.#end < hash + 3) {
          return;
        }
        const payload = this.#buffer.subarray(this.#start + 1, hash);
        const high = hexDigit(this.#buffer[hash + 1]);
        const low = hexDigit(this.#buffer[hash + 2]);
        this.#start = hash + 3;
        this.#scan = this.#start + 1;
        if (high < 0 || low < 0 || (high << 4 | low) !== checksum(payload)) {
          void this.#write(Uint8Array.of(45)).catch(
            (error) => this.#fail(asError2(error))
          );
          continue;
        }
        void this.#write(Uint8Array.of(43)).catch((error) => this.#fail(asError2(error)));
        this.#deliver(unescapePayload(payload));
      }
      this.#start = this.#end = 0;
      this.#scan = 1;
    } catch (error) {
      this.#fail(asError2(error));
    }
  }
  /** Append one owned transport fragment without repeatedly copying its accumulated prefix.
   * @param {Uint8Array} data Incoming bytes. The transport may reuse them after this call returns.
   * @returns {void} Grows/compacts only when tail capacity is exhausted. Exceeding the bound throws.
   */
  #append(data) {
    const used = this.#end - this.#start;
    const required = used + data.length;
    if (required > this.#maxBufferedBytes) {
      throw new Error(`RSP receive buffer exceeds ${this.#maxBufferedBytes} bytes.`);
    }
    if (this.#end + data.length > this.#buffer.length) {
      if (required > this.#buffer.length) {
        const capacity = Math.min(
          this.#maxBufferedBytes,
          Math.max(required, 4096, this.#buffer.length * 2)
        );
        const next = Buffer.allocUnsafe(capacity);
        this.#buffer.copy(next, 0, this.#start, this.#end);
        this.#buffer = next;
      } else {
        this.#buffer.copy(this.#buffer, 0, this.#start, this.#end);
      }
      this.#scan -= this.#start;
      this.#start = 0;
      this.#end = used;
    }
    this.#buffer.set(data, this.#end);
    this.#end += data.length;
  }
  #deliver(payload) {
    const stopped = stop(payload);
    if (stopped && !this.#pending?.acceptStop) {
      for (const listener of this.#stopListeners) {
        listener(stopped);
      }
      return;
    }
    const pending = this.#pending;
    if (!pending) {
      throw new Error("RSP response arrived without a pending request.");
    }
    clearTimeout(pending.timer);
    this.#pending = void 0;
    pending.resolve(payload);
  }
  #assertReady() {
    if (this.#closed) {
      throw new Error("RSP client is closed.");
    }
    if (!this.#started) {
      throw new Error("RSP client has not started.");
    }
  }
  #write(data) {
    const write2 = this.#writeTail.then(() => {
      if (this.#closed) {
        throw new Error("RSP client is closed.");
      }
      return this.#transport.write(data);
    });
    this.#writeTail = write2.catch(() => void 0);
    return write2;
  }
  #fail(error, closeTransport = true) {
    if (this.#closed) {
      return;
    }
    this.#closed = true;
    this.#buffer = Buffer.alloc(0);
    this.#start = this.#end = 0;
    this.#scan = 1;
    this.#closeError = error;
    this.#dataSubscription.dispose();
    this.#closeSubscription.dispose();
    if (this.#pending) {
      clearTimeout(this.#pending.timer);
      this.#pending.reject(error);
      this.#pending = void 0;
    }
    this.#stopListeners.clear();
    for (const listener of this.#closeListeners) {
      listener(error);
    }
    this.#closeListeners.clear();
    if (closeTransport) {
      void this.#transport.close().catch(() => void 0);
    }
  }
};

// packages/debug-sidecar-ares/src/node-tcp-gdb-rsp-transport.ts
import net from "node:net";
var NodeTcpGdbRspTransport = class _NodeTcpGdbRspTransport {
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
      for (const listener of this.#dataListeners) {
        listener(bytes);
      }
    });
    this.#socket.on("error", (error) => {
      this.#terminalError = error;
    });
    this.#socket.on("close", () => this.#notifyClosed(this.#terminalError));
  }
  /**
   * Opens a bounded connection to a numeric loopback address.
   * @param {NodeTcpGdbRspTransportOptions} options Loopback endpoint and deadlines.
   * @returns {Promise<NodeTcpGdbRspTransport>} Connected transport.
   */
  static async connect(options) {
    const host = options.host ?? "127.0.0.1";
    if (host !== "127.0.0.1" && host !== "::1") {
      throw new Error("RSP transport host must be a numeric loopback address.");
    }
    if (!Number.isSafeInteger(options.port) || options.port < 1 || options.port > 65535) {
      throw new Error("RSP transport port must be an integer between 1 and 65535.");
    }
    const connectTimeoutMs = options.connectTimeoutMs ?? 3e3;
    const shutdownTimeoutMs = options.shutdownTimeoutMs ?? 1e3;
    for (const [name, value] of [
      ["RSP connect timeout", connectTimeoutMs],
      ["RSP shutdown timeout", shutdownTimeoutMs]
    ]) {
      if (!Number.isSafeInteger(value) || value <= 0) {
        throw new Error(`${name} must be a positive safe integer.`);
      }
    }
    const socket = new net.Socket();
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        socket.destroy();
        reject(new Error(`RSP connection to ${host}:${options.port} timed out.`));
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
    return new _NodeTcpGdbRspTransport(socket, shutdownTimeoutMs);
  }
  /** @inheritdoc */
  write(data) {
    if (this.#closed) {
      return Promise.reject(new Error("RSP TCP transport is closed."));
    }
    return new Promise((resolve, reject) => {
      this.#socket.write(data, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
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
    if (this.#closed) {
      return;
    }
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
    if (this.#notified) {
      return;
    }
    this.#notified = true;
    this.#closed = true;
    for (const listener of this.#closeListeners) {
      listener(error);
    }
    this.#closeListeners.clear();
    this.#dataListeners.clear();
  }
};

// packages/debug-sidecar-ares/src/ares-process-host.ts
var ARES_RUNTIME_MANIFEST_VERSION = 1;
var sha256Pattern = /^[\dA-Fa-f]{64}$/;
var revisionPattern = /^[\dA-Fa-f]{40}$/;
var checkedSha256 = (value, name) => {
  if (!sha256Pattern.test(value)) {
    throw new Error(`${name} must be a 64-digit SHA-256 value.`);
  }
  return value.toLowerCase();
};
var checkedRevision = (value, name) => {
  if (!revisionPattern.test(value)) {
    throw new Error(`${name} must be a 40-digit git revision.`);
  }
  return value.toLowerCase();
};
var checkedAbsolutePath = (value, name) => {
  if (!path2.isAbsolute(value)) {
    throw new Error(`${name} must be an absolute path.`);
  }
  return path2.normalize(value);
};
var checkedResourcePath = (value) => {
  if (value === "." || value.includes("\\") || path2.posix.isAbsolute(value) || path2.posix.normalize(value) !== value || value.split("/").includes("..")) {
    throw new Error(`Ares resource path '${value}' must be normalized and relative.`);
  }
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
var NodeAresProcessHandle = class {
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
    if (!this.#exited) {
      this.#child.kill(signal);
    }
  }
};
var nodeSha256 = async (file) => {
  const digest = createHash2("sha256");
  for await (const chunk of createReadStream2(file)) {
    digest.update(chunk);
  }
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
    throw new Error("Unable to reserve an IPv4 loopback port for ares.");
  }
  await new Promise(
    (resolve, reject) => server.close((error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    })
  );
  return address4.port;
};
var nodeAresProcessRuntime = Object.freeze({
  platform: process.platform,
  architecture: process.arch,
  sha256: nodeSha256,
  reserveLoopbackPort,
  launch: (options) => new NodeAresProcessHandle(options),
  connect: (port, timeoutMs) => NodeTcpGdbRspTransport.connect({
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
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Ares runtime manifest must be an object.");
  }
  return value;
};
var manifestString = (value, name) => {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${name} must be a non-empty string.`);
  }
  return value;
};
var parseAresRuntimeManifest = (value) => {
  const manifest = manifestRecord(value);
  if (manifest.schemaVersion !== ARES_RUNTIME_MANIFEST_VERSION) {
    throw new Error(`Unsupported ares runtime manifest version ${String(manifest.schemaVersion)}.`);
  }
  if (manifest.emulator !== "ares") {
    throw new Error("Runtime manifest is not for ares.");
  }
  if (manifest.frontend !== void 0 && manifest.frontend !== "headless" && manifest.frontend !== "desktop") {
    throw new Error("Ares runtime frontend must be 'headless' or 'desktop'.");
  }
  const buildConfiguration = manifestString(
    manifest.buildConfiguration,
    "Ares build configuration"
  );
  if (!Array.isArray(manifest.resources)) {
    throw new Error("Ares runtime manifest resources must be an array.");
  }
  const resources = Object.freeze(
    manifest.resources.map((value2, index) => {
      const resource = manifestRecord(value2);
      const resourcePath = checkedResourcePath(
        manifestString(resource.path, `Ares resource ${index} path`)
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
  if (new Set(resources.map((resource) => resource.path)).size !== resources.length) {
    throw new Error("Ares runtime manifest contains duplicate resource paths.");
  }
  return Object.freeze({
    schemaVersion: ARES_RUNTIME_MANIFEST_VERSION,
    emulator: "ares",
    ...manifest.frontend === void 0 ? {} : { frontend: manifest.frontend },
    upstreamRevision: checkedRevision(
      manifestString(manifest.upstreamRevision, "Ares upstream revision"),
      "Ares upstream revision"
    ),
    headlessBaseRevision: checkedRevision(
      manifestString(manifest.headlessBaseRevision, "Ares headless base revision"),
      "Ares headless base revision"
    ),
    forkRevision: checkedRevision(
      manifestString(manifest.forkRevision, "Ares fork revision"),
      "Ares fork revision"
    ),
    headlessPatchSha256: checkedSha256(
      manifestString(manifest.headlessPatchSha256, "Ares headless patch SHA-256"),
      "Ares headless patch SHA-256"
    ),
    patchSha256: checkedSha256(
      manifestString(manifest.patchSha256, "Ares patch SHA-256"),
      "Ares patch SHA-256"
    ),
    executableSha256: checkedSha256(
      manifestString(manifest.executableSha256, "Ares executable SHA-256"),
      "Ares executable SHA-256"
    ),
    romSha256: checkedSha256(manifestString(manifest.romSha256, "ROM SHA-256"), "ROM SHA-256"),
    platform: manifestString(manifest.platform, "Ares manifest platform"),
    architecture: manifestString(manifest.architecture, "Ares manifest architecture"),
    buildConfiguration,
    resources
  });
};
var AresProcessHost = class {
  #executable;
  #rom;
  #runtimeDirectory;
  #manifest;
  #system;
  #fastBoot;
  #env;
  #startupTimeoutMs;
  #requestTimeoutMs;
  #shutdownTimeoutMs;
  #connectRetryMs;
  #maxOutputBytes;
  #onOutput;
  #runtime;
  #process;
  #port;
  #output = Buffer.alloc(0);
  #lifecycleTail = Promise.resolve();
  /** @param {AresProcessHostOptions} options Paths, manifest, bounds, and platform runtime. */
  constructor(options) {
    this.#executable = checkedAbsolutePath(options.executable, "Ares executable");
    this.#rom = checkedAbsolutePath(options.rom, "Ares ROM");
    this.#runtimeDirectory = checkedAbsolutePath(
      options.runtimeDirectory,
      "Ares runtime directory"
    );
    this.#manifest = parseAresRuntimeManifest(options.manifest);
    const executableRelative = path2.relative(this.#runtimeDirectory, this.#executable);
    if (executableRelative === "" || executableRelative === ".." || executableRelative.startsWith(`..${path2.sep}`) || path2.isAbsolute(executableRelative)) {
      throw new Error("Ares executable must be contained within its portable runtime directory.");
    }
    this.#system = options.system ?? "Super Famicom";
    if (this.#system.length === 0) {
      throw new Error("Ares system name must be non-empty.");
    }
    this.#fastBoot = options.fastBoot ?? true;
    this.#env = options.env ?? {};
    this.#startupTimeoutMs = options.startupTimeoutMs ?? 1e4;
    this.#requestTimeoutMs = options.requestTimeoutMs ?? 3e3;
    this.#shutdownTimeoutMs = options.shutdownTimeoutMs ?? 2e3;
    this.#connectRetryMs = options.connectRetryMs ?? 25;
    this.#maxOutputBytes = options.maxOutputBytes ?? 65536;
    this.#onOutput = options.onOutput;
    this.#runtime = options.runtime ?? nodeAresProcessRuntime;
    for (const [name, value] of [
      ["Ares startup timeout", this.#startupTimeoutMs],
      ["Ares RSP request timeout", this.#requestTimeoutMs],
      ["Ares shutdown timeout", this.#shutdownTimeoutMs],
      ["Ares connect retry delay", this.#connectRetryMs],
      ["Ares output limit", this.#maxOutputBytes]
    ]) {
      if (!Number.isSafeInteger(value) || value <= 0) {
        throw new Error(`${name} must be a positive safe integer.`);
      }
    }
  }
  /** @returns {AresRuntimeManifest} Normalized immutable launch identity. */
  get manifest() {
    return this.#manifest;
  }
  /** @returns {number | undefined} PID of the current emulator process. */
  get pid() {
    return this.#process?.pid;
  }
  /** @returns {string} Bounded tail of emulator stdout and stderr, never protocol stdout. */
  get output() {
    return this.#output.toString("utf8");
  }
  /**
   * Starts a fresh verified emulator for reset connects or reconnects to the preserved process.
   * @param {DebugBackendConnectOptions} options Backend reset policy.
   * @returns {Promise<GdbRspClient>} Connected, not-yet-started private RSP client.
   */
  createClient(options) {
    return this.#serializeLifecycle(async () => {
      let launched = false;
      if (options.reset ?? true) {
        await this.#terminateCurrent();
        await this.#launch();
        launched = true;
      } else if (!this.#process || this.#process.exited || this.#port === void 0) {
        throw new Error("Cannot reconnect to ares because no preserved process is running.");
      }
      try {
        return await this.#connect();
      } catch (error) {
        if (launched) {
          await this.#terminateCurrent();
        }
        throw error;
      }
    });
  }
  /** @returns {Promise<void>} Bounded graceful/forced cleanup of the owned emulator process. */
  terminate() {
    return this.#serializeLifecycle(() => this.#terminateCurrent());
  }
  async #launch() {
    await this.#verifyIdentity();
    const desktop = this.#manifest.frontend === "desktop";
    if (!desktop) {
      await mkdir(path2.join(this.#runtimeDirectory, "saves"), { recursive: true });
    }
    const port = await this.#runtime.reserveLoopbackPort();
    const args = [
      "--system",
      this.#system,
      "--settings-file",
      path2.join(this.#runtimeDirectory, "settings.bml"),
      ...desktop ? [
        `Developer/DebugServerPort=${port}`,
        "Developer/DebugServerEnabled=true",
        "Developer/DebugServerUseIPv4=true",
        "Boot/AwaitGDBClient=true",
        "Boot/Debugger=false",
        `Boot/Fast=${this.#fastBoot}`,
        // Switching focus to VS Code must not silently freeze capture or execution.
        "Input/Defocus=Allow",
        // Speculative/replayed frames would contaminate an executed-instruction trace.
        "General/RunAhead=false",
        "General/Rewind=false"
      ].flatMap((setting) => ["--setting", setting]) : [
        "--setting",
        `Paths/Saves=${path2.join(this.#runtimeDirectory, "saves")}`,
        "--gdb-port",
        String(port),
        "--gdb-ipv4",
        "--wait-on-gdb",
        "--quiet",
        ...this.#fastBoot ? ["--fast-boot"] : []
      ],
      this.#rom
    ];
    this.#output = Buffer.alloc(0);
    const processHandle = this.#runtime.launch({
      command: this.#executable,
      args,
      cwd: this.#runtimeDirectory,
      env: { ...this.#env, [DEBUG_SIDECAR_SESSION_ENV]: void 0 },
      onOutput: (stream, data) => this.#captureOutput(stream, data)
    });
    this.#process = processHandle;
    this.#port = port;
  }
  async #connect() {
    const processHandle = this.#process;
    const port = this.#port;
    if (!processHandle || port === void 0) {
      throw new Error("Ares process is not running.");
    }
    const deadline = Date.now() + this.#startupTimeoutMs;
    let lastError = new Error("Ares RSP listener was not ready.");
    while (Date.now() < deadline) {
      if (processHandle.exited) {
        throw await this.#exitError(processHandle, "before RSP connected");
      }
      try {
        const remaining = Math.max(1, deadline - Date.now());
        const transport = await this.#runtime.connect(port, Math.min(remaining, 250));
        return new GdbRspClient({ transport, requestTimeoutMs: this.#requestTimeoutMs });
      } catch (error) {
        lastError = errorValue(error);
      }
      await this.#runtime.delay(Math.min(this.#connectRetryMs, Math.max(1, deadline - Date.now())));
    }
    if (processHandle.exited) {
      throw await this.#exitError(processHandle, "before RSP connected");
    }
    throw new Error(
      `Ares RSP listener on 127.0.0.1:${port} was not ready within ${this.#startupTimeoutMs} ms: ${lastError.message}`
    );
  }
  async #verifyIdentity() {
    if (this.#runtime.platform !== this.#manifest.platform) {
      throw new Error(
        `Ares manifest platform '${this.#manifest.platform}' does not match '${this.#runtime.platform}'.`
      );
    }
    if (this.#runtime.architecture !== this.#manifest.architecture) {
      throw new Error(
        `Ares manifest architecture '${this.#manifest.architecture}' does not match '${this.#runtime.architecture}'.`
      );
    }
    const runtimeInfo = await stat(this.#runtimeDirectory).catch(() => void 0);
    if (runtimeInfo && !runtimeInfo.isDirectory()) {
      throw new Error("Ares runtime path exists but is not a directory.");
    }
    await this.#verifyHash(this.#executable, this.#manifest.executableSha256, "executable");
    await this.#verifyHash(this.#rom, this.#manifest.romSha256, "ROM");
    for (const resource of this.#manifest.resources) {
      await this.#verifyHash(
        path2.join(this.#runtimeDirectory, resource.path),
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
        `Unable to verify ares ${context} at '${file}': ${errorValue(error).message}`
      );
    }
    if (actual !== expected) {
      throw new Error(
        `Ares ${context} SHA-256 mismatch: expected ${expected}, received ${actual}.`
      );
    }
  }
  async #terminateCurrent() {
    const processHandle = this.#process;
    this.#process = void 0;
    this.#port = void 0;
    if (!processHandle || processHandle.exited) {
      return;
    }
    processHandle.kill("SIGTERM");
    if (await waitWithTimeout(processHandle.waitForExit(), this.#shutdownTimeoutMs)) {
      return;
    }
    processHandle.kill("SIGKILL");
    await processHandle.waitForExit();
  }
  async #exitError(processHandle, context) {
    const exit = await processHandle.waitForExit();
    const status = exit.signal ? `signal ${exit.signal}` : `code ${String(exit.code)}`;
    const detail = this.output.trim();
    let suffix = ".";
    if (exit.error) {
      suffix = `: ${exit.error.message}`;
    } else if (detail) {
      suffix = `: ${detail}`;
    }
    return new Error(`Ares exited with ${status} ${context}${suffix}`);
  }
  #captureOutput(stream, data) {
    const text = Buffer.from(data).toString("utf8");
    this.#onOutput?.(stream, text);
    const tagged = Buffer.from(`[ares ${stream}] ${text}`, "utf8");
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

// packages/debug-sidecar-ares/src/ares-rsp-backend.ts
init_src();
await init_src3();

// packages/debug-sidecar-ares/src/profile.ts
var ARES_RSP_BACKEND_ID = "ares-rsp";
var ARES_65816_ARCHITECTURE = "snes.65816";
var ARES_65816_ADDRESS_SPACE = "snes.cpu";
var ARES_65816_WRAM_ADDRESS_SPACE = "snes.wram";
var ARES_65816_CARTRIDGE_ROM_ADDRESS_SPACE = "snes.cartridge-rom";
var ARES_65816_THREAD_ID = 1;
var ARES_65816_FRAME_ID = 1;
var ARES_TRACE_BUFFER_EVENTS = 65536;
var ARES_TRACE_BATCH_EVENTS = 240;
var ARES_STEP_KINDS = Object.freeze(["instruction", "in"]);
var NO_STEP_KINDS = Object.freeze([]);
var ARES_RSP_CAPABILITIES = Object.freeze({
  pause: true,
  step: true,
  stepKinds: ARES_STEP_KINDS,
  registers: true,
  memory: true,
  stackFrames: true,
  breakpoints: true,
  disassemble: true,
  reconnect: true,
  architectures: Object.freeze([
    Object.freeze({
      architecture: ARES_65816_ARCHITECTURE,
      addressSpaces: Object.freeze([
        ARES_65816_ADDRESS_SPACE,
        ARES_65816_WRAM_ADDRESS_SPACE,
        ARES_65816_CARTRIDGE_ROM_ADDRESS_SPACE
      ]),
      memorySpaces: Object.freeze([
        Object.freeze({
          addressSpace: ARES_65816_WRAM_ADDRESS_SPACE,
          sideEffectFree: true
        }),
        Object.freeze({
          addressSpace: ARES_65816_CARTRIDGE_ROM_ADDRESS_SPACE,
          sideEffectFree: true
        })
      ]),
      trace: Object.freeze({
        addressSpaces: Object.freeze([ARES_65816_ADDRESS_SPACE]),
        maxBufferedEvents: ARES_TRACE_BUFFER_EVENTS,
        maxBatchEvents: ARES_TRACE_BATCH_EVENTS
      }),
      pause: true,
      step: true,
      stepKinds: ARES_STEP_KINDS,
      registers: true,
      memory: true,
      stackFrames: true,
      breakpoints: true,
      disassemble: true
    }),
    Object.freeze({
      architecture: "snes.spc700",
      addressSpaces: Object.freeze(["spc.aram"]),
      memorySpaces: Object.freeze([]),
      trace: null,
      pause: false,
      step: false,
      stepKinds: NO_STEP_KINDS,
      registers: false,
      memory: false,
      stackFrames: false,
      breakpoints: false,
      disassemble: false
    }),
    Object.freeze({
      architecture: "snes.superfx",
      addressSpaces: Object.freeze(["superfx.ram", "superfx.rom"]),
      memorySpaces: Object.freeze([]),
      trace: null,
      pause: false,
      step: false,
      stepKinds: NO_STEP_KINDS,
      registers: false,
      memory: false,
      stackFrames: false,
      breakpoints: false,
      disassemble: false
    })
  ])
});

// packages/debug-sidecar-ares/src/trace-details.ts
var integer3 = (value, maximum = Number.MAX_SAFE_INTEGER) => {
  if (!/^[\da-f]+$/i.test(value)) {
    throw new Error("Malformed rich trace integer.");
  }
  const result = Number.parseInt(value, 16);
  if (!Number.isSafeInteger(result) || result > maximum) {
    throw new Error("Rich trace integer exceeds its bound.");
  }
  return result;
};
var parseAresTraceDetails = (response, maximum) => {
  const match = /^([01]):([\da-f]+):([\da-f]+):([\da-f]+):(.*)$/i.exec(response);
  if (!match || response.length > 16534) {
    throw new Error("Malformed rich instruction trace response.");
  }
  const rows = match[5] === "" ? [] : match[5].split(";");
  if (rows.length && rows.pop() !== "") {
    throw new Error("Rich trace row is unterminated.");
  }
  if (rows.length > maximum || rows.length > 240) {
    throw new Error("Rich trace exceeds the requested batch limit.");
  }
  const addresses2 = [];
  const details = rows.map((row) => {
    const fields = row.split(",");
    if (fields.length !== 5 || !/^[\da-f]{40}$/i.test(fields[1]) || !/^[\da-f]{2,8}$/i.test(fields[2]) || fields[2].length % 2 !== 0 || fields[4].length % 21 !== 0 || fields[4].length > 32 * 21) {
      throw new Error("Malformed rich trace instruction fields.");
    }
    addresses2.push(integer3(fields[0], 16777215));
    const names = ["a", "x", "y", "s", "d", "db", "pb", "pc", "p", "e"];
    const maxima = [65535, 65535, 65535, 65535, 65535, 255, 255, 65535, 255, 1];
    const state = Object.fromEntries(
      names.map((name, index) => [
        name,
        integer3(fields[1].slice(index * 4, index * 4 + 4), maxima[index])
      ])
    );
    if ((state.pb << 16 | state.pc) !== addresses2.at(-1)) {
      throw new Error("Trace PC disagrees with captured processor state.");
    }
    const memoryAccesses = Array.from({ length: fields[4].length / 21 }, (_, index) => {
      const raw = fields[4].slice(index * 21, index * 21 + 21);
      const actor = ["cpu", "dma", "hdma"][integer3(raw[19], 2)];
      const channel = integer3(raw[20], 15);
      if (actor === "cpu" && channel !== 15 || actor !== "cpu" && channel > 7) {
        throw new Error("Invalid trace DMA channel.");
      }
      return {
        addressSpace: "snes.cpu",
        address: integer3(raw.slice(0, 16), 16777215),
        value: integer3(raw.slice(16, 18), 255),
        access: ["read", "write", "fetch"][integer3(raw[18], 2)],
        width: 1,
        actor,
        ...actor === "cpu" ? {} : { channel }
      };
    });
    return {
      bytes: Array.from(Buffer.from(fields[2], "hex")),
      state,
      memoryAccesses,
      droppedMemoryAccesses: integer3(fields[3])
    };
  });
  const sequenceStart = integer3(match[2]);
  if (sequenceStart < 1) {
    throw new Error("Invalid trace sequence.");
  }
  return {
    architecture: "snes.65816",
    addressSpace: "snes.cpu",
    addresses: addresses2,
    details,
    sequenceStart,
    droppedEvents: integer3(match[3]),
    unattributedMemoryAccesses: integer3(match[4]),
    active: match[1] === "1"
  };
};

// packages/debug-sidecar-ares/src/ares-rsp-backend.ts
var ARES_NAMED_MEMORY_READ_CHUNK_BYTES = 4096;
var asError3 = (error) => error instanceof Error ? error : new Error(String(error));
var checkedInteger = (value, context, maximum = Number.MAX_SAFE_INTEGER) => {
  if (!Number.isSafeInteger(value) || value < 0 || value > maximum) {
    throw new Error(`${context} must be an integer between 0 and ${maximum}.`);
  }
  return value;
};
var checkedAddress = (value, context) => {
  if (value.architecture !== ARES_65816_ARCHITECTURE) {
    throw new Error(`${context} uses unsupported architecture '${value.architecture}'.`);
  }
  if (value.addressSpace !== ARES_65816_ADDRESS_SPACE) {
    throw new Error(`${context} uses unsupported address space '${value.addressSpace}'.`);
  }
  checkedInteger(value.address, `${context} address`, 16777215);
  return { ...value, address: value.address & 16777215 };
};
var checkedMemoryAddress = (value, context) => {
  if (value.architecture !== ARES_65816_ARCHITECTURE) {
    throw new Error(`${context} uses unsupported architecture '${value.architecture}'.`);
  }
  if (value.addressSpace !== ARES_65816_WRAM_ADDRESS_SPACE && value.addressSpace !== ARES_65816_CARTRIDGE_ROM_ADDRESS_SPACE) {
    throw new Error(`${context} uses unsupported memory address space '${value.addressSpace}'.`);
  }
  checkedInteger(value.address, `${context} address`, 16777215);
  return { ...value };
};
var isEvenHex = (value) => {
  if (value.length % 2 !== 0) {
    return false;
  }
  for (const character of value) {
    const code = character.codePointAt(0) ?? -1;
    if (!(code >= 48 && code <= 57 || code >= 65 && code <= 70 || code >= 97 && code <= 102)) {
      return false;
    }
  }
  return true;
};
var littleEndian2 = (hex2) => {
  const bytes = hex2.match(/../g);
  if (!bytes || bytes.join("") !== hex2) {
    throw new Error("Malformed little-endian register data.");
  }
  return Number.parseInt([...bytes].reverse().join(""), 16);
};
var registerHex = (value, bits) => value.toString(16).toUpperCase().padStart(Math.ceil(bits / 4), "0");
var parseRegisters = (payload) => {
  if (!/^[\dA-Fa-f]{32}$/.test(payload)) {
    throw new Error(`Expected 16 bytes of ares 65816 registers, received ${payload.length / 2}.`);
  }
  return {
    a: littleEndian2(payload.slice(0, 4)),
    x: littleEndian2(payload.slice(4, 8)),
    y: littleEndian2(payload.slice(8, 12)),
    s: littleEndian2(payload.slice(12, 16)),
    d: littleEndian2(payload.slice(16, 20)),
    db: littleEndian2(payload.slice(20, 22)),
    pb: littleEndian2(payload.slice(22, 24)),
    pc: littleEndian2(payload.slice(24, 28)),
    p: littleEndian2(payload.slice(28, 30)),
    e: littleEndian2(payload.slice(30, 32))
  };
};
var logicalPc = (registers2) => (registers2.pb << 16 | registers2.pc) & 16777215;
var stopSignal = (payload) => {
  if (!/^[ST][\dA-Fa-f]{2}/.test(payload)) {
    throw new Error(`Expected an RSP stop packet, received '${payload}'.`);
  }
  return Number.parseInt(payload.slice(1, 3), 16);
};
var expectOkay = (payload, context) => {
  if (payload !== "OK") {
    throw new Error(`${context} failed with RSP response '${payload}'.`);
  }
};
var safeHexInteger = (value, context) => {
  if (!/^[\dA-Fa-f]+$/.test(value)) {
    throw new Error(`${context} is not hexadecimal.`);
  }
  const parsed = Number(BigInt(`0x${value}`));
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`${context} exceeds JavaScript safe integer range.`);
  }
  return parsed;
};
var AresRspDebugBackend = class {
  protocolVersion = DEBUG_BACKEND_PROTOCOL_VERSION;
  #richTrace = false;
  #captureV2 = false;
  #nativeFileIdentity;
  #captureSession;
  #captureNative = false;
  #captureScope;
  #busCaptureSupported = false;
  #contextBoundaryHeld = false;
  #contextReplayPending = false;
  get capabilities() {
    if (!this.#richTrace) {
      return ARES_RSP_CAPABILITIES;
    }
    return {
      ...ARES_RSP_CAPABILITIES,
      architectures: ARES_RSP_CAPABILITIES.architectures.map((architecture) => {
        if (architecture.architecture === "snes.65816") {
          return {
            ...architecture,
            addressSpaces: [...architecture.addressSpaces, "snes.sram"],
            memorySpaces: [
              ...architecture.memorySpaces,
              { addressSpace: "snes.sram", sideEffectFree: true }
            ],
            trace: { ...architecture.trace, instructionDetails: true }
          };
        }
        if (architecture.architecture === "snes.spc700") {
          return {
            ...architecture,
            memory: true,
            addressSpaces: [...architecture.addressSpaces, "snes.spc700.aram"],
            memorySpaces: [{ addressSpace: "snes.spc700.aram", sideEffectFree: true }]
          };
        }
        return architecture;
      })
    };
  }
  #createClient;
  #terminate;
  #stopTimeoutMs;
  #listeners = /* @__PURE__ */ new Set();
  #expectedClose = /* @__PURE__ */ new WeakSet();
  #breakpoints = /* @__PURE__ */ new Map();
  #decoder = new Cpu65816Decoder();
  #client;
  #subscriptions = [];
  #connected = false;
  #stopped = false;
  #pendingStopReason;
  #instructionBoundaryStop = false;
  #nextBreakpointId = 1;
  #trace;
  /** @param {AresRspBackendOptions} options RSP client/process lifecycle hooks. */
  constructor(options) {
    this.#nativeFileIdentity = options.nativeFileIdentity;
    this.#createClient = options.createClient;
    this.#terminate = options.terminate ?? (() => Promise.resolve());
    this.#stopTimeoutMs = options.stopTimeoutMs ?? 5e3;
    checkedInteger(this.#stopTimeoutMs, "Ares stop timeout");
    if (this.#stopTimeoutMs === 0) {
      throw new Error("Ares stop timeout must be positive.");
    }
  }
  /** @inheritdoc */
  async connect(options = {}) {
    if (this.#connected) {
      throw new Error("ares RSP backend is already connected.");
    }
    const reset = options.reset ?? true;
    if (!reset && this.#client && !this.#client.closed) {
      await this.#handshakeStop(this.#client, this.#instructionBoundaryStop);
      this.#connected = true;
      this.#stopped = true;
      this.#emit({ type: "stopped", reason: "entry", threadId: ARES_65816_THREAD_ID });
      return;
    }
    if (this.#client) {
      const existing = this.#client;
      this.#expectedClose.add(existing);
      await existing.close().catch(() => void 0);
      this.#releaseClient(existing);
    }
    this.#richTrace = false;
    const client = await this.#createClient({ reset: options.reset ?? true });
    if (client.closed) {
      throw new Error("ares RSP client factory returned a closed client.");
    }
    this.#client = client;
    this.#subscriptions = [
      client.onStop((event) => this.#stoppedEvent(event)),
      client.onClose((error) => this.#clientClosed(client, error))
    ];
    try {
      await client.start();
      const supported = await client.request("qSupported");
      this.#captureV2 = supported.split(";").includes("uttoriCaptureV2+");
      this.#busCaptureSupported = false;
      if (!supported.includes("qXfer:features:read+") || !supported.includes("xmlRegisters+") || !supported.includes("uttoriNamedMemory+") || !supported.includes("uttoriInstructionTrace+")) {
        throw new Error("ares RSP server does not advertise the required debugger extensions.");
      }
      const target = await this.#readTargetDescription(client);
      for (const register4 of ["a", "x", "y", "s", "d", "db", "pb", "pc", "p", "e"]) {
        if (!target.includes(`name="${register4}"`)) {
          throw new Error(`ares RSP target description is missing register '${register4}'.`);
        }
      }
      this.#richTrace = supported.includes("uttoriInstructionDetails+") && supported.includes("uttoriSramMemory+") && supported.includes("uttoriAramMemory+");
      this.#instructionBoundaryStop = supported.includes("uttoriInstructionBoundaryStop+");
      await this.#handshakeStop(client, this.#instructionBoundaryStop);
      this.#connected = true;
      this.#stopped = true;
      this.#emit({ type: "stopped", reason: "entry", threadId: ARES_65816_THREAD_ID });
    } catch (error) {
      this.#expectedClose.add(client);
      await client.close().catch(() => void 0);
      this.#releaseClient(client);
      throw error;
    }
  }
  /** @inheritdoc */
  async disconnect(options = {}) {
    const client = this.#requireConnected();
    const terminate = options.terminate ?? true;
    if (this.#captureSession) {
      await this.capture({
        operation: this.#captureNative ? "file-abort" : "abort",
        session: this.#captureSession
      }).catch(() => void 0);
      this.#captureSession = void 0;
      this.#captureScope = void 0;
    }
    if (this.#trace?.active) {
      await this.stopTrace();
    }
    if (!terminate) {
      await this.setBreakpoints([]);
      this.#connected = false;
      this.#pendingStopReason = void 0;
      return;
    }
    this.#expectedClose.add(client);
    let detachError;
    try {
      expectOkay(await client.request("D"), "ares RSP detach");
    } catch (error) {
      const failure = asError3(error);
      if (!client.closed || failure.message !== "RSP transport closed.") {
        detachError = failure;
      }
    }
    await client.close().catch((error) => {
      detachError ??= asError3(error);
    });
    this.#releaseClient(client);
    this.#breakpoints.clear();
    this.#stopped = false;
    this.#pendingStopReason = void 0;
    this.#trace = void 0;
    await this.#terminate();
    this.#emit({ type: "terminated", restart: false });
    if (detachError) {
      throw detachError;
    }
  }
  /** @inheritdoc */
  async pause(threadId) {
    this.#assertThread(threadId);
    if (this.#stopped) {
      return;
    }
    this.#pendingStopReason = "pause";
    await this.#requireConnected().interrupt();
  }
  /** @inheritdoc */
  async continue(threadId) {
    this.#assertThread(threadId);
    const client = this.#requireStopped();
    if (this.#contextBoundaryHeld) {
      throw new Error("Capture context is fixing its execution boundary.");
    }
    this.#stopped = false;
    this.#pendingStopReason = this.#breakpoints.size > 0 ? "breakpoint" : "exception";
    this.#emit({ type: "continued", threadId: ARES_65816_THREAD_ID, allThreads: true });
    await client.continue();
  }
  /** @inheritdoc */
  async step(threadId, kind) {
    this.#assertThread(threadId);
    if (kind !== "instruction" && kind !== "in") {
      throw new Error(`ares does not support ${kind} stepping.`);
    }
    const client = this.#requireStopped();
    if (this.#contextBoundaryHeld) {
      throw new Error("Capture context is fixing its execution boundary.");
    }
    this.#stopped = false;
    this.#pendingStopReason = "step";
    this.#emit({ type: "continued", threadId: ARES_65816_THREAD_ID, allThreads: true });
    if (this.#captureSession && this.#captureScope !== "snes.65816.instructions") {
      await client.step();
      return;
    }
    await this.#waitForStop(client, "instruction step", () => client.step());
  }
  /** @inheritdoc */
  threads() {
    this.#requireConnected();
    return Promise.resolve([
      { id: ARES_65816_THREAD_ID, name: "Main CPU", architecture: ARES_65816_ARCHITECTURE }
    ]);
  }
  /** @inheritdoc */
  async stackFrames(threadId) {
    this.#assertThread(threadId);
    const registers2 = await this.#registerSnapshot();
    return [
      {
        id: ARES_65816_FRAME_ID,
        threadId: ARES_65816_THREAD_ID,
        name: "65816",
        pc: this.#address(logicalPc(registers2)),
        currentOnly: true
      }
    ];
  }
  /** @inheritdoc */
  async registers(frameId) {
    if (frameId !== ARES_65816_FRAME_ID) {
      throw new Error(`Unknown ares frame ${frameId}.`);
    }
    const registers2 = await this.#registerSnapshot();
    return [
      { name: "A", value: registerHex(registers2.a, 16), bits: 16, group: "CPU" },
      { name: "X", value: registerHex(registers2.x, 16), bits: 16, group: "CPU" },
      { name: "Y", value: registerHex(registers2.y, 16), bits: 16, group: "CPU" },
      { name: "S", value: registerHex(registers2.s, 16), bits: 16, group: "CPU" },
      { name: "D", value: registerHex(registers2.d, 16), bits: 16, group: "CPU" },
      { name: "DB", value: registerHex(registers2.db, 8), bits: 8, group: "CPU" },
      { name: "PB", value: registerHex(registers2.pb, 8), bits: 8, group: "CPU" },
      { name: "PC", value: registerHex(logicalPc(registers2), 24), bits: 24, group: "CPU" },
      { name: "P", value: registerHex(registers2.p, 8), bits: 8, group: "CPU" },
      { name: "E", value: registerHex(registers2.e, 8), bits: 8, group: "CPU" }
    ];
  }
  /** @inheritdoc */
  async readMemory(address4, count) {
    const extra = this.#richTrace && (address4.architecture === "snes.65816" && address4.addressSpace === "snes.sram" || address4.architecture === "snes.spc700" && address4.addressSpace === "snes.spc700.aram");
    const checked = extra ? { ...address4 } : checkedMemoryAddress(address4, "Memory request");
    checkedInteger(checked.address, "Memory address", 16777215);
    checkedInteger(count, "Memory count", 1048576);
    if (count === 0) {
      return { address: checked, bytes: new Uint8Array(), unreadableBytes: 0 };
    }
    const bytes = new Uint8Array(count);
    let offset = 0;
    const client = this.#requireStopped();
    while (offset < count) {
      const requested = Math.min(ARES_NAMED_MEMORY_READ_CHUNK_BYTES, count - offset);
      const response = await client.request(
        `qUttoriMemoryRead:${checked.addressSpace}:${(checked.address + offset).toString(16)},${requested.toString(16)}`
      );
      if (response.startsWith("E")) {
        throw new Error(`ares RSP named memory read failed with response '${response}'.`);
      }
      if (!isEvenHex(response) || response.length > requested * 2) {
        throw new Error(
          "ares RSP named memory response is malformed or exceeds the requested count."
        );
      }
      const available = Buffer.from(response, "hex");
      bytes.set(available, offset);
      offset += available.length;
      if (available.length < requested) {
        break;
      }
    }
    return { address: checked, bytes, unreadableBytes: count - offset };
  }
  /** @inheritdoc */
  async setBreakpoints(addresses2) {
    const client = this.#requireStopped();
    const requested = addresses2.map((entry, index) => checkedAddress(entry, `Breakpoint ${index}`));
    if (new Set(requested.map(({ address: address4 }) => address4)).size !== requested.length) {
      throw new Error("Duplicate ares execute breakpoint addresses are not allowed.");
    }
    const wanted = new Set(requested.map(({ address: address4 }) => address4));
    for (const address4 of this.#breakpoints.keys()) {
      if (wanted.has(address4)) {
        continue;
      }
      expectOkay(await client.request(`z0,${address4.toString(16)},1`), "Remove breakpoint");
      this.#breakpoints.delete(address4);
    }
    const results = [];
    for (const value of requested) {
      const existing = this.#breakpoints.get(value.address);
      if (existing) {
        results.push(existing);
        continue;
      }
      const response = await client.request(`Z0,${value.address.toString(16)},1`);
      const breakpoint = {
        id: this.#nextBreakpointId++,
        address: value,
        verified: response === "OK",
        ...response === "OK" ? {} : { message: `ares RSP response '${response}'.` }
      };
      if (breakpoint.verified) {
        this.#breakpoints.set(value.address, breakpoint);
      }
      results.push(breakpoint);
    }
    return results;
  }
  /** @inheritdoc */
  async disassemble(address4, count) {
    let current = checkedAddress(address4, "Disassembly request").address;
    checkedInteger(count, "Disassembly count", 4096);
    const registers2 = await this.#registerSnapshot();
    const state = {
      e: registers2.e === 0 ? 0 : 1,
      m: registers2.p >>> 5 & 1 ? 1 : 0,
      x: registers2.p >>> 4 & 1 ? 1 : 0,
      programBank: current >>> 16,
      dataBank: registers2.db,
      directPage: registers2.d
    };
    const instructions = [];
    for (let index = 0; index < count; index++) {
      const memory = await this.#readCpuBus(current, 4);
      if (!memory) {
        break;
      }
      const decoded = this.#decoder.decode({
        source: new Uint8ArrayDecoderSource(memory),
        offset: 0,
        logicalAddress: current,
        state: { ...state, programBank: current >>> 16 }
      });
      if (decoded.kind !== "instruction") {
        throw new Error(
          decoded.kind === "ambiguous" ? decoded.reason : `65816 decode failed: ${decoded.message}`
        );
      }
      instructions.push({
        address: this.#address(current),
        bytes: [...decoded.instruction.bytes],
        text: formatCpu65816Instruction(decoded.instruction)
      });
      current = current + decoded.instruction.size & 16777215;
    }
    return instructions;
  }
  /** @inheritdoc */
  async capture(request) {
    validateCaptureRequest(request);
    const client = this.#requireConnected();
    if (request.operation === "context") {
      const identity = this.#nativeFileIdentity;
      if (!identity) {
        throw new Error("Capture context requires a verified local ares runtime.");
      }
      if (request.action === "stop" || request.action === "mark") {
        if (!this.#stopped) {
          await this.#waitForStop(client, "capture context", () => this.pause());
        }
      }
      this.#requireStopped();
      const fields2 = ["qUttoriContext", request.action];
      const encode = (value2) => Buffer.from(value2, "utf8").toString("hex");
      if ("directory" in request) {
        if (request.romContentSha256 !== identity.romSha256 || request.producer.id !== "ares" || request.producer.revision !== identity.executableSha256 && request.producer.revision !== identity.producerRevision) {
          throw new Error("Capture context ROM/build does not match the verified runtime.");
        }
        if (request.action === "replay" || request.action === "restore") {
          await verifyCaptureContext(request.directory, request);
        }
        fields2.push(
          encode(request.directory),
          encode(request.romContentSha256),
          encode(request.producer.id),
          encode(request.producer.revision)
        );
      }
      if ("session" in request) {
        fields2.push(request.session);
      }
      if (request.action === "mark") {
        fields2.push(encode(request.label));
      }
      if (request.action === "prepare" || request.action === "stop") {
        this.#contextBoundaryHeld = true;
      }
      try {
        const response2 = await client.request(fields2.join(":"));
        const expected = {
          prepare: ["prepared"],
          start: ["recording"],
          stop: ["draining", "complete"],
          mark: ["recording"],
          abort: ["aborted"],
          restore: ["restored"],
          replay: ["replaying"],
          status: ["idle", "replaying", "replay-diverged"]
        };
        if (!expected[request.action].includes(response2)) {
          throw new Error(
            `Capture context ${request.action} is unsupported or failed (${response2.slice(0, 32)}). Rebuild the context-capable runtime.`
          );
        }
        if (request.action === "start" || request.action === "abort") {
          this.#contextBoundaryHeld = false;
        }
        if (request.action === "replay") {
          this.#contextReplayPending = true;
        }
        if (request.action === "restore" || request.action === "abort") {
          this.#contextReplayPending = false;
        }
        return { contextState: response2 };
      } catch (error) {
        this.#contextBoundaryHeld = false;
        throw error;
      }
    }
    if (!this.#captureV2) {
      throw new Error(
        "The active ares runtime does not support lossless capture v2. Install the capture-v2 runtime and restart debugging."
      );
    }
    if (request.operation === "file-start" || request.operation === "file-capabilities" || request.operation === "file-status" || request.operation === "file-stop" || request.operation === "file-abort" || request.operation === "file-release") {
      const negotiation2 = request.operation === "file-start" || request.operation === "file-capabilities";
      const scope = negotiation2 ? request.scope ?? "snes.65816.instructions" : this.#captureScope;
      const scopes = {
        "snes.65816.instructions": "instructions",
        "snes.cpu-bus": "bus",
        "snes.cpu-bus-transfers": "bus-transfers",
        "snes.cpu-bus-ppu": "bus-ppu"
      };
      const fields2 = ["qUttoriCaptureFile", request.operation.slice(5)];
      if (request.operation === "file-start") {
        this.#requireStopped();
        const identity = this.#nativeFileIdentity;
        if (!identity) {
          throw new Error("Native file capture requires a verified local runtime host.");
        }
        if (request.romContentSha256 !== identity.romSha256 || request.producer.id !== "ares" || request.producer.revision !== identity.executableSha256 && request.producer.revision !== identity.producerRevision) {
          throw new Error(
            "Native capture identity does not match the verified ROM and executable."
          );
        }
        await this.capture({ operation: "file-capabilities", scope });
        const encode = (value3) => Buffer.from(value3, "utf8").toString("hex");
        fields2.push(
          request.bufferBytes,
          scopes[scope],
          encode(request.file),
          request.romContentSha256,
          encode(request.producer.id),
          encode(request.producer.revision)
        );
        if (request.measureStages) {
          fields2.push("profile");
        }
      } else if (request.operation === "file-capabilities") {
        fields2.push(scopes[scope]);
      } else {
        fields2.push(request.session);
      }
      const response2 = await client.request(fields2.join(":"));
      if (response2.length > 8193 || response2.length % 2 !== 1 || !/^J[\da-f]+$/.test(response2)) {
        throw new Error(
          `Native file capture ${request.operation} is unsupported or rejected (${response2.slice(0, 32)}). Use the capture-file runtime.`
        );
      }
      const value2 = JSON.parse(Buffer.from(response2.slice(1), "hex").toString("utf8"));
      if (request.operation === "file-capabilities") {
        const capabilities = validateCaptureCapabilities(value2, scope);
        if (!capabilities.nativeFile) {
          throw new Error("Runtime did not confirm native file ownership.");
        }
        return capabilities;
      }
      const position2 = validateCapturePosition(
        value2,
        request.operation === "file-start" ? void 0 : request.session
      );
      if (request.operation === "file-start") {
        this.#captureSession = position2.session;
        this.#captureScope = scope;
        this.#captureNative = true;
        try {
          validateCapturePosition(position2, void 0, scope);
        } catch (error) {
          await this.capture({ operation: "file-abort", session: position2.session }).catch(
            () => void 0
          );
          throw error;
        }
      } else if (position2.state === "complete" || request.operation === "file-release") {
        this.#captureSession = void 0;
        this.#captureScope = void 0;
      }
      validateCapturePosition(position2, void 0, scope);
      if (request.operation === "file-stop" || request.operation === "file-abort") {
        this.#contextBoundaryHeld = false;
      }
      return position2;
    }
    const negotiation = request.operation === "start" || request.operation === "capabilities";
    const requestedScope = negotiation ? request.scope ?? "snes.65816.instructions" : void 0;
    const ppu = requestedScope === "snes.cpu-bus-ppu";
    const bus = ppu || requestedScope === "snes.cpu-bus" || requestedScope === "snes.cpu-bus-transfers";
    const transfers = requestedScope === "snes.cpu-bus-transfers";
    if (request.operation === "start" && bus && (ppu || transfers || !this.#busCaptureSupported)) {
      await this.capture({ operation: "capabilities", scope: requestedScope });
    }
    let operation = request.operation;
    if (request.operation === "capabilities" && bus) {
      operation = transfers ? "transfer-capabilities" : "bus-capabilities";
    }
    if (request.operation === "capabilities" && ppu) {
      operation = "ppu-capabilities";
    }
    const fields = ["qUttoriCapture", operation];
    if (request.operation === "start") {
      fields.push(request.bufferBytes);
      if (ppu) {
        fields.push("bus-ppu");
      } else if (bus) {
        fields.push(transfers ? "bus-transfers" : "bus");
      }
    } else if (request.operation !== "capabilities") {
      fields.push(request.session);
      if (request.operation === "read" || request.operation === "ack") {
        fields.push(request.chunk);
      }
      if (request.operation === "ack") {
        fields.push(request.event);
      }
    }
    const response = await client.request(fields.join(":"));
    if (request.operation === "capabilities" && bus && (!response || /^e[\da-f]{2}$/i.test(response))) {
      let feature = transfers ? "transfer boundaries" : "bus capture";
      let runtime = transfers ? "capture-transfer" : "capture-bus";
      if (ppu) {
        feature = "verified PPU effects";
        runtime = "capture-ppu";
      }
      throw new Error(
        `The active ares runtime does not support CPU/DMA/HDMA ${feature}. Use the ${runtime} runtime and restart debugging.`
      );
    }
    if (/^e[\da-f]{2}$/i.test(response)) {
      throw new Error(`Capture ${request.operation} rejected (${response}).`);
    }
    if (request.operation === "read") {
      if (response.length > 524288 || response.length % 2 || !/^[\da-f]*$/.test(response)) {
        throw new Error("Malformed capture chunk response.");
      }
      return { hex: response };
    }
    if (response.length > 8193 || response.length % 2 !== 1 || !/^J[\da-f]+$/.test(response)) {
      throw new Error("Malformed capture control response.");
    }
    const value = JSON.parse(Buffer.from(response.slice(1), "hex").toString("utf8"));
    if (request.operation === "capabilities") {
      const capabilities = validateCaptureCapabilities(value, requestedScope);
      if (bus && !transfers && !ppu) {
        this.#busCaptureSupported = true;
      }
      return capabilities;
    }
    const position = validateCapturePosition(
      value,
      request.operation === "start" ? void 0 : request.session
    );
    if (request.operation === "start") {
      this.#captureNative = false;
      this.#captureSession = position.session;
      this.#captureScope = position.scope ?? "snes.65816.instructions";
      try {
        validateCapturePosition(position, void 0, requestedScope);
      } catch (error) {
        await this.capture({ operation: "abort", session: position.session }).catch(
          () => void 0
        );
        throw error;
      }
    } else if (position.session === this.#captureSession) {
      validateCapturePosition(position, this.#captureSession, this.#captureScope);
    }
    if (position.state === "complete") {
      this.#captureSession = void 0;
      this.#captureScope = void 0;
    }
    if (request.operation === "stop" || request.operation === "abort") {
      this.#contextBoundaryHeld = false;
    }
    return position;
  }
  async startTrace(options) {
    if (options.architecture !== ARES_65816_ARCHITECTURE || options.addressSpace !== ARES_65816_ADDRESS_SPACE) {
      throw new Error(
        `Instruction trace '${options.architecture}/${options.addressSpace}' is not supported.`
      );
    }
    const client = this.#requireStopped();
    if (options.detail === "full" && !this.#richTrace) {
      throw new Error(
        "This runtime supports PC-only traces. Rebuild the maintained runtime for captured bytes/state and bus accesses."
      );
    }
    expectOkay(
      await client.request(options.detail === "full" ? "QUttoriTrace:2" : "QUttoriTrace:1"),
      "Start instruction trace"
    );
    this.#trace = { ...options, active: true };
  }
  /** @inheritdoc */
  async readTrace(maxEvents) {
    checkedInteger(maxEvents, "Trace batch size", ARES_TRACE_BATCH_EVENTS);
    if (maxEvents === 0) {
      throw new Error(`Trace batch size must be between 1 and ${ARES_TRACE_BATCH_EVENTS}.`);
    }
    const trace = this.#trace;
    if (!trace) {
      throw new Error("No ares instruction trace has been started.");
    }
    if (trace.detail === "full") {
      const result = parseAresTraceDetails(
        await this.#requireConnected().request(`qUttoriTraceDetailRead:${maxEvents.toString(16)}`),
        maxEvents
      );
      trace.active = result.active;
      return result;
    }
    const response = await this.#requireConnected().request(
      `qUttoriTraceRead:${maxEvents.toString(16)}`
    );
    const match = /^([01]):([\dA-Fa-f]+):([\dA-Fa-f]+):([\dA-Fa-f]*)$/.exec(response);
    if (!match || match[4].length % 16 !== 0) {
      throw new Error("ares RSP instruction trace response is malformed.");
    }
    const addresses2 = Array.from(
      { length: match[4].length / 16 },
      (_, index) => safeHexInteger(match[4].slice(index * 16, index * 16 + 16), "Trace address")
    );
    if (addresses2.length > maxEvents || addresses2.some((address4) => address4 > 16777215)) {
      throw new Error("ares RSP instruction trace response exceeds the requested bounds.");
    }
    const active = match[1] === "1";
    trace.active = active;
    return {
      architecture: trace.architecture,
      addressSpace: trace.addressSpace,
      sequenceStart: safeHexInteger(match[2], "Trace sequence"),
      addresses: addresses2,
      droppedEvents: safeHexInteger(match[3], "Trace dropped-event count"),
      active
    };
  }
  /** @inheritdoc */
  async stopTrace() {
    const trace = this.#trace;
    if (!trace) {
      throw new Error("No ares instruction trace has been started.");
    }
    expectOkay(await this.#requireConnected().request("QUttoriTrace:0"), "Stop instruction trace");
    trace.active = false;
  }
  /** @inheritdoc */
  onEvent(listener) {
    this.#listeners.add(listener);
    return { dispose: () => this.#listeners.delete(listener) };
  }
  async #readCpuBus(address4, count) {
    const response = await this.#requireStopped().request(
      `m${address4.toString(16)},${count.toString(16)}`
    );
    if (response.startsWith("E")) {
      throw new Error(`ares RSP CPU-bus disassembly read failed with response '${response}'.`);
    }
    if (!isEvenHex(response) || response.length > count * 2) {
      throw new Error(
        "ares RSP CPU-bus disassembly response is malformed or exceeds the requested count."
      );
    }
    const available = Buffer.from(response, "hex");
    if (available.length === 0) {
      return void 0;
    }
    const bytes = new Uint8Array(count);
    bytes.set(available);
    return bytes;
  }
  async #readTargetDescription(client) {
    let offset = 0;
    let target = "";
    for (let part = 0; part < 16; part++) {
      const response = await client.request(
        `qXfer:features:read:target.xml:${offset.toString(16)},1000`
      );
      if (!response.startsWith("l") && !response.startsWith("m")) {
        throw new Error("ares RSP target description returned an invalid continuation marker.");
      }
      const chunk = response.slice(1);
      target += chunk;
      if (target.length > 65536) {
        throw new Error("ares RSP target description exceeds 64 KiB.");
      }
      if (response.startsWith("l")) {
        return target;
      }
      offset += Buffer.byteLength(chunk, "ascii");
    }
    throw new Error("ares RSP target description did not terminate within 16 packets.");
  }
  async #handshakeStop(client, waitForInstructionBoundary) {
    if (!waitForInstructionBoundary) {
      stopSignal(await client.requestStop("?"));
      return;
    }
    await this.#waitForStop(client, "first instruction boundary", async () => {
      stopSignal(await client.requestStop("?"));
    });
  }
  async #waitForStop(client, context, action) {
    let resolveStop;
    let rejectStop;
    const stopped = new Promise((resolve, reject) => {
      resolveStop = resolve;
      rejectStop = reject;
    });
    const timeout = setTimeout(
      () => rejectStop?.(new Error(`Timed out waiting for ares ${context} stop.`)),
      this.#stopTimeoutMs
    );
    timeout.unref();
    const stopSubscription = client.onStop(() => resolveStop?.());
    const closeSubscription = client.onClose((error) => rejectStop?.(error));
    try {
      await action();
      await stopped;
    } finally {
      clearTimeout(timeout);
      stopSubscription.dispose();
      closeSubscription.dispose();
    }
  }
  async #registerSnapshot() {
    return parseRegisters(await this.#requireStopped().request("g"));
  }
  #address(address4) {
    return {
      architecture: ARES_65816_ARCHITECTURE,
      addressSpace: ARES_65816_ADDRESS_SPACE,
      address: address4
    };
  }
  #assertThread(threadId) {
    if (threadId !== void 0 && threadId !== ARES_65816_THREAD_ID) {
      throw new Error(`Unknown ares thread ${threadId}.`);
    }
  }
  #requireConnected() {
    if (!this.#connected || !this.#client || this.#client.closed) {
      throw new Error("ares RSP backend is not connected.");
    }
    return this.#client;
  }
  #requireStopped() {
    const client = this.#requireConnected();
    if (!this.#stopped) {
      throw new Error("ares RSP backend must be stopped for this operation.");
    }
    return client;
  }
  #stoppedEvent(event) {
    if (!this.#connected) {
      return;
    }
    stopSignal(event.payload);
    this.#stopped = true;
    const reason = this.#pendingStopReason ?? "exception";
    this.#pendingStopReason = void 0;
    if (this.#contextReplayPending && this.#client) {
      void this.#client.request("qUttoriContext:status").then(
        (status) => {
          this.#contextReplayPending = status === "replaying";
          if (status === "idle" || status === "replay-diverged") {
            this.#emit({
              type: "output",
              category: status === "idle" ? "console" : "stderr",
              text: status === "idle" ? "Capture replay reached the recorded endpoint; WRAM and input consumption match.\n" : "Capture replay diverged from the retained input timing or final WRAM. Execution is paused.\n"
            });
          }
        },
        (error) => {
          this.#emit({
            type: "output",
            category: "stderr",
            text: `Could not verify capture replay outcome: ${String(error)}
`
          });
        }
      ).finally(() => this.#emit({ type: "stopped", reason, threadId: ARES_65816_THREAD_ID }));
      return;
    }
    this.#emit({ type: "stopped", reason, threadId: ARES_65816_THREAD_ID });
  }
  #clientClosed(client, error) {
    if (this.#expectedClose.has(client) || this.#client !== client) {
      return;
    }
    this.#releaseClient(client);
    this.#emit({ type: "output", category: "stderr", text: `${error.message}
` });
    this.#emit({ type: "terminated", restart: true });
  }
  #releaseClient(client) {
    if (this.#client !== client) {
      return;
    }
    for (const subscription of this.#subscriptions) {
      subscription.dispose();
    }
    this.#subscriptions = [];
    this.#client = void 0;
    this.#connected = false;
    this.#instructionBoundaryStop = false;
    this.#contextBoundaryHeld = false;
    this.#contextReplayPending = false;
    this.#trace = void 0;
  }
  #emit(event) {
    for (const listener of this.#listeners) {
      listener(event);
    }
  }
};

// packages/debug-sidecar-ares/src/sidecar.ts
var usage = `Usage: uttori-asm-debug-sidecar-ares [options]

Required:
  --manifest path       Versioned ares runtime manifest JSON
  --ares path           Separately installed ares executable (manifest selects frontend)
  --rom path            SNES ROM matching the selected build or manifest SHA-256
  --runtime-dir path    Portable root containing bin, resources, settings, and saves

Optional:
  --rom-sha256 hash     Expected ROM SHA-256 from a verified build (64 hex digits)
  --system name         Ares system name (default: Super Famicom)
  --no-fast-boot        Disable the ares fast-boot setting
  --help                Show this help
`;
var optionNames = /* @__PURE__ */ new Set(["--manifest", "--ares", "--rom", "--rom-sha256", "--runtime-dir", "--system"]);
var parseAresSidecarArguments = (arguments_) => {
  const values = /* @__PURE__ */ new Map();
  let fastBoot = true;
  for (let index = 0; index < arguments_.length; index++) {
    const argument = arguments_[index];
    if (argument === void 0) {
      throw new Error("Ares sidecar arguments cannot contain holes.");
    }
    if (argument === "--no-fast-boot") {
      fastBoot = false;
      continue;
    }
    if (!optionNames.has(argument)) {
      throw new Error(`Unknown ares sidecar option '${argument}'.`);
    }
    if (values.has(argument)) {
      throw new Error(`Duplicate ares sidecar option '${argument}'.`);
    }
    const value = arguments_[++index];
    if (!value || value.startsWith("--")) {
      throw new Error(`Ares sidecar option '${argument}' requires a value.`);
    }
    values.set(argument, value);
  }
  const required = (name) => {
    const value = values.get(name);
    if (!value) {
      throw new Error(`Missing required ares sidecar option '${name}'.`);
    }
    return path3.resolve(value);
  };
  const system = values.get("--system");
  const romSha256 = values.get("--rom-sha256");
  if (romSha256 !== void 0 && !/^[\da-f]{64}$/i.test(romSha256)) {
    throw new Error("--rom-sha256 requires a 64-digit SHA-256 from the selected build.");
  }
  return {
    ...romSha256 ? { romSha256: romSha256.toLowerCase() } : {},
    manifest: required("--manifest"),
    executable: required("--ares"),
    rom: required("--rom"),
    runtimeDirectory: required("--runtime-dir"),
    ...system ? { system } : {},
    fastBoot
  };
};
var write = (stream, data) => new Promise((resolve, reject) => {
  stream.write(data, (error) => {
    if (error) {
      reject(error);
    } else {
      resolve();
    }
  });
});
var runAresSidecar = async (arguments_, environment = process.env) => {
  const options = parseAresSidecarArguments(arguments_);
  const session = environment[DEBUG_SIDECAR_SESSION_ENV];
  assertDebugSidecarSessionToken(session);
  const runtimeManifest = parseAresRuntimeManifest(
    JSON.parse(await readFile2(options.manifest, "utf8"))
  );
  const manifest = { ...runtimeManifest, romSha256: options.romSha256 ?? runtimeManifest.romSha256 };
  const host = new AresProcessHost({
    executable: options.executable,
    rom: options.rom,
    runtimeDirectory: options.runtimeDirectory,
    manifest,
    system: options.system,
    fastBoot: options.fastBoot
  });
  const backend = new AresRspDebugBackend({
    createClient: (connect) => host.createClient(connect),
    nativeFileIdentity: {
      romSha256: manifest.romSha256,
      executableSha256: manifest.executableSha256,
      producerRevision: `${manifest.forkRevision}:${manifest.patchSha256}:${manifest.executableSha256}`
    },
    terminate: () => host.terminate()
  });
  let ending = false;
  const close = async (error) => {
    if (ending) {
      return;
    }
    ending = true;
    if (error) {
      await write(process.stderr, `${error.stack ?? error.message}
`).catch(() => void 0);
    }
    process.stdin.pause();
    await host.terminate().catch(() => void 0);
    await new Promise((resolve) => process.stdout.end(resolve));
  };
  const server = new DebugSidecarServer({
    backend: ARES_RSP_BACKEND_ID,
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
    await runAresSidecar(arguments_).catch(async (error) => {
      const failure = error instanceof Error ? error : new Error(String(error));
      await write(process.stderr, `${failure.stack ?? failure.message}
`).catch(() => void 0);
      process.exitCode = 1;
    });
  }
}
export {
  parseAresSidecarArguments,
  runAresSidecar
};

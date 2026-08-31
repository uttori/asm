#!/usr/bin/env node
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
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
    var debug8 = typeof process === "object" && process.env && process.env.NODE_DEBUG && /\bsemver\b/i.test(process.env.NODE_DEBUG) ? (...args) => console.error("SEMVER", ...args) : () => {
    };
    module.exports = debug8;
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
    var debug8 = require_debug();
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
      debug8(name, index, value);
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
    var debug8 = require_debug();
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
        debug8("SemVer", version, options);
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
        debug8("SemVer.compare", this.version, this.options, other);
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
          debug8("prerelease compare", i, a, b);
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
          debug8("build compare", i, a, b);
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
        debug8("hyphen replace", range);
        range = range.replace(re[t.COMPARATORTRIM], comparatorTrimReplace);
        debug8("comparator trim", range);
        range = range.replace(re[t.TILDETRIM], tildeTrimReplace);
        debug8("tilde trim", range);
        range = range.replace(re[t.CARETTRIM], caretTrimReplace);
        debug8("caret trim", range);
        let rangeList = range.split(" ").map((comp) => parseComparator(comp, this.options)).join(" ").split(/\s+/).map((comp) => replaceGTE0(comp, this.options));
        if (loose) {
          rangeList = rangeList.filter((comp) => {
            debug8("loose invalid filter", comp, this.options);
            return !!comp.match(re[t.COMPARATORLOOSE]);
          });
        }
        debug8("range list", rangeList);
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
    var debug8 = require_debug();
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
      debug8("comp", comp, options);
      comp = replaceCarets(comp, options);
      debug8("caret", comp);
      comp = replaceTildes(comp, options);
      debug8("tildes", comp);
      comp = replaceXRanges(comp, options);
      debug8("xrange", comp);
      comp = replaceStars(comp, options);
      debug8("stars", comp);
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
        debug8("tilde", comp, _, M, m, p, pr);
        let ret;
        if (isX(M)) {
          ret = "";
        } else if (isX(m)) {
          ret = `>=${M}.0.0${z} <${+M + 1}.0.0-0`;
        } else if (isX(p)) {
          ret = `>=${M}.${m}.0${z} <${M}.${+m + 1}.0-0`;
        } else if (pr) {
          debug8("replaceTilde pr", pr);
          ret = `>=${M}.${m}.${p}-${pr} <${M}.${+m + 1}.0-0`;
        } else {
          ret = `>=${M}.${m}.${p} <${M}.${+m + 1}.0-0`;
        }
        debug8("tilde return", ret);
        return ret;
      });
    };
    var replaceCarets = (comp, options) => {
      return comp.trim().split(/\s+/).map((c) => replaceCaret(c, options)).join(" ");
    };
    var replaceCaret = (comp, options) => {
      debug8("caret", comp, options);
      const r = options.loose ? re[t.CARETLOOSE] : re[t.CARET];
      const z = options.includePrerelease ? "-0" : "";
      return comp.replace(r, (_, M, m, p, pr) => {
        debug8("caret", comp, _, M, m, p, pr);
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
          debug8("replaceCaret pr", pr);
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
          debug8("no pr");
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
        debug8("caret return", ret);
        return ret;
      });
    };
    var replaceXRanges = (comp, options) => {
      debug8("replaceXRanges", comp, options);
      return comp.split(/\s+/).map((c) => replaceXRange(c, options)).join(" ");
    };
    var replaceXRange = (comp, options) => {
      comp = comp.trim();
      const r = options.loose ? re[t.XRANGELOOSE] : re[t.XRANGE];
      return comp.replace(r, (ret, gtlt, M, m, p, pr) => {
        debug8("xRange", comp, ret, gtlt, M, m, p, pr);
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
        debug8("xRange return", ret);
        return ret;
      });
    };
    var replaceStars = (comp, options) => {
      debug8("replaceStars", comp, options);
      return comp.trim().replace(re[t.STAR], "");
    };
    var replaceGTE0 = (comp, options) => {
      debug8("replaceGTE0", comp, options);
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
          debug8(set[i].semver);
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
        debug8("comparator", comp, options);
        this.options = options;
        this.loose = !!options.loose;
        this.parse(comp);
        if (this.semver === ANY) {
          this.value = "";
        } else {
          this.value = this.operator + this.semver.version;
        }
        debug8("comp", this);
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
        debug8("Comparator.test", version, this.options.loose);
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
    var debug8 = require_debug();
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

// packages/cli/src/index.ts
import * as fs4 from "node:fs";
import path4 from "node:path";
import { pathToFileURL as pathToFileURL2 } from "node:url";

// packages/core/src/addressToLine.ts
import * as fs from "fs";

// packages/core/src/crc32.ts
var CRC32 = class _CRC32 {
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

// packages/core/src/addressToLine.ts
var debug = (..._args) => {
};
try {
  const { default: d } = await import("debug");
  debug = d("AddressToLine");
} catch {
}
function readFileContent(filename) {
  try {
    return fs.readFileSync(filename);
  } catch (err) {
    debug(`Error reading file ${filename}:`, err);
    return null;
  }
}
var AddressToLineMapping = class {
  fileList;
  filenameCrcs;
  addrToLineInfo;
  constructor() {
    this.fileList = [];
    this.filenameCrcs = [];
    this.addrToLineInfo = [];
  }
  /**
   * Clears all stored mappings and file information.
   */
  reset() {
    this.fileList = [];
    this.filenameCrcs = [];
    this.addrToLineInfo = [];
  }
  /**
   * Adds information linking an output ROM address to a source file and line number.
   * @param {string} filename The name of the source file.
   * @param {number} line The line number in the source file.
   * @param {number} addr The output ROM address.
   */
  includeMapping(filename, line, addr) {
    const fileIdx = this.getFileIndex(filename);
    const newInfo = { fileIdx, line, addr };
    this.addrToLineInfo.push(newInfo);
  }
  /**
   * Retrieves the index of the file in the file list.
   * If the file is new, it reads the file to compute its CRC and adds it to the list.
   * @param {string} filename The source file name.
   * @returns {number} The index of the file in the internal list.
   */
  getFileIndex(filename) {
    const filenameCrc = CRC32.compute(Buffer.from(filename, "utf8"));
    for (let i = 0; i < this.filenameCrcs.length; i++) {
      if (this.filenameCrcs[i] === filenameCrc) {
        return i;
      }
    }
    let fileCrc = 0;
    const data = readFileContent(filename);
    if (data) {
      fileCrc = CRC32.compute(data);
    }
    this.fileList.push({ name: filename, crc: fileCrc });
    this.filenameCrcs.push(filenameCrc);
    return this.fileList.length - 1;
  }
};

// packages/core/src/address-width.ts
function maximumAddressForWidth(addressWidth) {
  if (!Number.isInteger(addressWidth) || addressWidth < 1 || addressWidth > 53) {
    throw new Error(`Address width must be an integer from 1 through 53, got ${addressWidth}.`);
  }
  return 2 ** addressWidth - 1;
}
function normalizeAddressForWidth(address, addressWidth) {
  const modulus = maximumAddressForWidth(addressWidth) + 1;
  if (!Number.isFinite(address) || !Number.isInteger(address)) {
    throw new Error(`Logical address must be a finite integer, got ${address}.`);
  }
  return (address % modulus + modulus) % modulus;
}

// packages/core/src/directive-groups.ts
var CORE_DIRECTIVE_GROUPS = Object.freeze([
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

// packages/core/src/source-location.ts
function createSourceSpan(start, end, line) {
  return {
    start,
    end,
    line,
    columnStart: start,
    columnEnd: end
  };
}
function createLineSpan(text, line) {
  return createSourceSpan(0, text.length, line);
}
function deriveTokenSpans(text, tokens, line) {
  if (tokens.length === 0) {
    return [];
  }
  const spans = [];
  let cursor = 0;
  for (const token of tokens) {
    if (!token) {
      spans.push(createSourceSpan(cursor, cursor, line));
      continue;
    }
    const tokenStart = text.indexOf(token, cursor);
    if (tokenStart === -1) {
      spans.push(createSourceSpan(cursor, cursor + token.length, line));
      cursor += token.length;
      continue;
    }
    const tokenEnd = tokenStart + token.length;
    spans.push(createSourceSpan(tokenStart, tokenEnd, line));
    cursor = tokenEnd;
  }
  return spans;
}
function sourceSpanToRange(span, fallbackLine = span.line ?? 0) {
  const line = span.line ?? fallbackLine;
  const startCharacter = span.columnStart ?? span.start;
  const endCharacter = span.columnEnd ?? span.end;
  return {
    start: {
      line,
      character: startCharacter
    },
    end: {
      line,
      character: endCharacter
    }
  };
}

// packages/core/src/diagnostics.ts
var AssemblyError = class extends Error {
  code;
  severity;
  location;
  stage;
  /**
   * Creates a new structured assembly error.
   * @param {string} code Stable diagnostic code.
   * @param {string} message Human-readable message.
   * @param {{ severity?: AssemblyDiagnosticSeverity; location?: AssemblySourceLocation; stage?: string }} [options] Optional metadata.
   * @param {AssemblyDiagnosticSeverity} [options.severity] Optional diagnostic severity.
   * @param {AssemblySourceLocation} [options.location] Optional source location.
   * @param {string} [options.stage] Optional pipeline stage.
   */
  constructor(code, message, options = {}) {
    super(message);
    this.name = "AssemblyError";
    this.code = code;
    this.severity = options.severity ?? "error";
    this.location = options.location;
    this.stage = options.stage;
  }
};
function createAssemblySourceLocation(file, line, span) {
  return {
    file,
    line,
    span,
    range: span ? sourceSpanToRange(span, line) : void 0
  };
}
function diagnosticFromError(error, fallbackLocation, stage) {
  if (error instanceof AssemblyError) {
    return {
      code: error.code,
      message: error.message,
      severity: error.severity,
      location: error.location ?? fallbackLocation,
      stage: error.stage ?? stage
    };
  }
  if (error instanceof Error) {
    return {
      code: "ASSEMBLY_ERROR",
      message: error.message,
      severity: "error",
      location: fallbackLocation,
      stage
    };
  }
  return {
    code: "ASSEMBLY_ERROR",
    message: typeof error === "string" ? error : JSON.stringify(error),
    severity: "error",
    location: fallbackLocation,
    stage
  };
}

// packages/core/src/ir/expression-node.ts
function attachRootSpan(node, text) {
  if (!node.span) {
    node.span = createSourceSpan(0, text.length);
  }
  return node;
}
function parseExpressionNode(input) {
  const trimmed = input.trim();
  if (!trimmed) {
    return { type: "raw", value: "", span: createSourceSpan(0, 0) };
  }
  if (trimmed.startsWith("#") && trimmed.length > 1) {
    return parseExpressionNode(trimmed.slice(1));
  }
  const rangeIndex = findTopLevelRange(trimmed);
  if (rangeIndex !== -1) {
    return attachRootSpan(
      {
        type: "range",
        start: parseExpressionNode(trimmed.slice(0, rangeIndex)),
        end: parseExpressionNode(trimmed.slice(rangeIndex + 2))
      },
      trimmed
    );
  }
  try {
    const tokens = tokenizeExpression(trimmed);
    const parser = new ExpressionParser(tokens);
    const expression = parser.parseExpression();
    if (!parser.isAtEnd()) {
      return { type: "raw", value: trimmed, span: createSourceSpan(0, trimmed.length) };
    }
    return attachRootSpan(expression, trimmed);
  } catch {
    return { type: "raw", value: trimmed, span: createSourceSpan(0, trimmed.length) };
  }
}
function renderExpressionNode(node) {
  if (isReferenceExpressionNode(node)) {
    return renderReferenceExpressionNode(node);
  }
  switch (node.type) {
    case "literal":
      return node.value;
    case "string":
      return `${node.quote}${node.value}${node.quote}`;
    case "raw":
      return node.value;
    case "call":
      return `${node.callee.name}(${node.arguments.map(renderExpressionNode).join(", ")})`;
    case "unary":
      return `${node.operator}${renderExpressionNode(node.argument)}`;
    case "binary":
      return `${renderExpressionNode(node.left)} ${node.operator} ${renderExpressionNode(node.right)}`;
    case "range":
      return `${renderExpressionNode(node.start)}..${renderExpressionNode(node.end)}`;
    default:
      return "";
  }
}
function isReferenceExpressionNode(node) {
  switch (node.type) {
    case "identifier":
    case "defineReference":
      return true;
    case "member":
    case "index":
      return isReferenceExpressionNode(node.object);
    default:
      return false;
  }
}
function renderReferenceExpressionNode(node, options = {}) {
  switch (node.type) {
    case "identifier":
      return node.name;
    case "defineReference":
      return node.braced ? `!{${node.content ?? ""}}` : `!${node.name ?? ""}`;
    case "member":
      return `${renderReferenceExpressionNode(node.object, options)}.${node.property.name}`;
    case "index": {
      const index = options.renderIndex ? options.renderIndex(node.index) : renderExpressionNode(node.index);
      return `${renderReferenceExpressionNode(node.object, options)}[${index}]`;
    }
    default:
      return "";
  }
}
function parseLeadingReferenceExpression(input) {
  const prefixLength = scanReferenceExpressionPrefix(input);
  if (prefixLength === 0) {
    return void 0;
  }
  let source = input.slice(0, prefixLength).trimEnd();
  if (source.endsWith(".")) {
    source = source.slice(0, -1).trimEnd();
  }
  const node = parseExpressionNode(source);
  if (!isReferenceExpressionNode(node)) {
    return void 0;
  }
  return {
    node,
    length: prefixLength
  };
}
function findTopLevelRange(input) {
  let depth = 0;
  let bracketDepth = 0;
  let quote = "";
  for (let i = 0; i < input.length - 1; i++) {
    const char = input[i];
    if ((char === '"' || char === "'") && input[i - 1] !== "\\") {
      quote = quote === char ? "" : quote || char;
      continue;
    }
    if (quote) {
      continue;
    }
    if (char === "(") {
      depth++;
      continue;
    }
    if (char === ")") {
      depth--;
      continue;
    }
    if (char === "[") {
      bracketDepth++;
      continue;
    }
    if (char === "]") {
      bracketDepth--;
      continue;
    }
    if (depth === 0 && bracketDepth === 0 && input.slice(i, i + 2) === "..") {
      if (i === 0) {
        continue;
      }
      return i;
    }
  }
  return -1;
}
function scanReferenceExpressionPrefix(input) {
  let index = 0;
  index = skipWhitespace(input, index);
  if (index >= input.length) {
    return 0;
  }
  const root = scanReferenceRoot(input, index);
  if (root === index) {
    return 0;
  }
  index = root;
  while (index < input.length) {
    const lookahead = skipWhitespace(input, index);
    if (input[lookahead] === ".") {
      let memberStart = lookahead + 1;
      memberStart = skipWhitespace(input, memberStart);
      const propertyEnd = readIdentifier(input, memberStart).nextIndex;
      if (propertyEnd === memberStart) {
        return memberStart;
      }
      index = propertyEnd;
      continue;
    }
    if (input[lookahead] === "[") {
      const bracketEnd = findMatchingBracket(input, lookahead);
      if (bracketEnd === -1) {
        return 0;
      }
      index = bracketEnd + 1;
      continue;
    }
    break;
  }
  return index;
}
function scanReferenceRoot(input, start) {
  if (input[start] === "!") {
    try {
      return readDefineReference(input, start).nextIndex;
    } catch {
      return start;
    }
  }
  return readIdentifier(input, start).nextIndex;
}
function findMatchingBracket(input, start) {
  let bracketDepth = 0;
  let parenDepth = 0;
  let quote = "";
  for (let index = start; index < input.length; index++) {
    const char = input[index];
    if ((char === '"' || char === "'") && input[index - 1] !== "\\") {
      quote = quote === char ? "" : quote || char;
      continue;
    }
    if (quote) {
      continue;
    }
    if (char === "[") {
      bracketDepth++;
      continue;
    }
    if (char === "]") {
      bracketDepth--;
      if (bracketDepth === 0 && parenDepth === 0) {
        return index;
      }
      continue;
    }
    if (char === "(") {
      parenDepth++;
      continue;
    }
    if (char === ")") {
      parenDepth--;
    }
  }
  return -1;
}
function skipWhitespace(input, index) {
  let current = index;
  while (current < input.length && /\s/.test(input[current])) {
    current++;
  }
  return current;
}
var binaryPrecedence = {
  "||": 0,
  "&&": 1,
  "==": 2,
  "=": 2,
  "!=": 2,
  "<": 2,
  ">": 2,
  "<=": 2,
  ">=": 2,
  "|": 3,
  "^": 3,
  "&": 3,
  "<<": 3,
  ">>": 3,
  "+": 4,
  "-": 4,
  "*": 5,
  "/": 5,
  "%": 5,
  "**": 6
};
var unaryOperators = /* @__PURE__ */ new Set(["<:", "<", ">", "^", "~", "-", "+"]);
var binaryOperators = [
  "**",
  "<<",
  ">>",
  "<=",
  ">=",
  "==",
  "=",
  "!=",
  "&&",
  "||",
  "*",
  "/",
  "%",
  "+",
  "-",
  "&",
  "|",
  "^",
  "<",
  ">"
];
function tokenizeExpression(input) {
  const tokens = [];
  let index = 0;
  while (index < input.length) {
    const char = input[index];
    if (/\s/.test(char)) {
      index++;
      continue;
    }
    if (char === "(") {
      tokens.push({ type: "lparen" });
      index++;
      continue;
    }
    if (char === ")") {
      tokens.push({ type: "rparen" });
      index++;
      continue;
    }
    if (char === ",") {
      tokens.push({ type: "comma" });
      index++;
      continue;
    }
    if (char === ".") {
      tokens.push({ type: "dot" });
      index++;
      continue;
    }
    if (char === "[") {
      tokens.push({ type: "lbracket" });
      index++;
      continue;
    }
    if (char === "]") {
      tokens.push({ type: "rbracket" });
      index++;
      continue;
    }
    if (char === '"' || char === "'") {
      const { value, nextIndex, quote } = readQuotedString(input, index);
      tokens.push({ type: "string", value, quote });
      index = nextIndex;
      continue;
    }
    const operator = (input.startsWith("<:", index) ? "<:" : void 0) ?? binaryOperators.find((candidate) => input.startsWith(candidate, index));
    if (operator) {
      tokens.push({ type: "operator", value: operator });
      index += operator.length;
      continue;
    }
    if (char === "!") {
      const { token, nextIndex } = readDefineReference(input, index);
      tokens.push(token);
      index = nextIndex;
      continue;
    }
    if (char === "@" || /[A-Z_a-z]/.test(char)) {
      const { value, nextIndex } = readIdentifier(input, index);
      tokens.push({ type: "identifier", value });
      index = nextIndex;
      continue;
    }
    if (char === "$") {
      const match = input.slice(index).match(/^\$[\dA-Fa-f]+/);
      if (!match) {
        throw new Error("Invalid hex literal");
      }
      tokens.push({ type: "literal", value: match[0] });
      index += match[0].length;
      continue;
    }
    if (char === "%") {
      const match = input.slice(index).match(/^%[01]+/);
      if (!match) {
        throw new Error("Invalid binary literal");
      }
      tokens.push({ type: "literal", value: match[0] });
      index += match[0].length;
      continue;
    }
    if (/\d/.test(char)) {
      const match = input.slice(index).match(/^(?:0x[\da-f]+|-?\d+(?:\.\d+)?)/i);
      if (!match) {
        throw new Error("Invalid numeric literal");
      }
      tokens.push({ type: "literal", value: match[0] });
      index += match[0].length;
      continue;
    }
    throw new Error(`Unexpected token '${char}'`);
  }
  return tokens;
}
function readQuotedString(input, start) {
  const quote = input[start];
  let value = "";
  let index = start + 1;
  while (index < input.length) {
    const char = input[index];
    if (char === quote && input[index - 1] !== "\\") {
      return { value, nextIndex: index + 1, quote };
    }
    value += char;
    index++;
  }
  throw new Error("Unterminated string literal");
}
function readIdentifier(input, start) {
  let index = start;
  if (input[index] === "@") {
    index++;
  }
  while (index < input.length && /\w/.test(input[index])) {
    index++;
  }
  return { value: input.slice(start, index), nextIndex: index };
}
function readDefineReference(input, start) {
  if (input[start + 1] === "{") {
    let index = start + 2;
    let braces = 1;
    let content = "";
    while (index < input.length) {
      const char = input[index];
      if (char === "{") {
        braces++;
      } else if (char === "}") {
        braces--;
        if (braces === 0) {
          return {
            token: { type: "defineReference", content, braced: true },
            nextIndex: index + 1
          };
        }
      }
      content += char;
      index++;
    }
    throw new Error("Unterminated braced define reference");
  }
  const { value, nextIndex } = readIdentifier(input, start + 1);
  if (!value) {
    throw new Error("Expected define reference name");
  }
  return {
    token: { type: "defineReference", name: value, braced: false },
    nextIndex
  };
}
var ExpressionParser = class {
  constructor(tokens) {
    this.tokens = tokens;
  }
  tokens;
  index = 0;
  /**
   * Parses expression.
   * @param {number} [minPrecedence] The minimum binary-operator precedence.
   * @returns {ExpressionNode} The result.
   */
  parseExpression(minPrecedence = 0) {
    let left = this.parsePrefix();
    while (true) {
      const token = this.peek();
      if (!token || token.type !== "operator" || !isBinaryOperator(token.value)) {
        break;
      }
      const precedence = binaryPrecedence[token.value];
      if (precedence < minPrecedence) {
        break;
      }
      this.consume();
      const nextMinPrecedence = token.value === "**" ? precedence : precedence + 1;
      const right = this.parseExpression(nextMinPrecedence);
      left = {
        type: "binary",
        operator: token.value,
        left,
        right
      };
    }
    return left;
  }
  /**
   * Checks whether at end.
   * @returns {boolean} The result.
   */
  isAtEnd() {
    return this.index >= this.tokens.length;
  }
  /**
   * Parses prefix.
   * @returns {ExpressionNode} The result.
   */
  parsePrefix() {
    const token = this.peek();
    if (!token) {
      throw new Error("Unexpected end of expression");
    }
    if (token.type === "operator" && unaryOperators.has(token.value)) {
      this.consume();
      return {
        type: "unary",
        operator: token.value,
        argument: this.parsePrefix()
      };
    }
    return this.parsePostfix(this.parsePrimary());
  }
  /**
   * Parses primary.
   * @returns {ExpressionNode} The result.
   */
  parsePrimary() {
    if (this.peek()?.type === "dot") {
      let name = "";
      while (this.match({ type: "dot" })) {
        name += ".";
      }
      const token2 = this.consume();
      if (token2?.type === "identifier") {
        return { type: "identifier", name: name + token2.value };
      }
      if (token2?.type === "literal" && /^\d+$/.test(token2.value)) {
        return { type: "identifier", name: name + token2.value };
      }
      throw new Error("Expected label name after '.'");
    }
    const token = this.consume();
    if (!token) {
      throw new Error("Unexpected end of expression");
    }
    switch (token.type) {
      case "literal":
        return { type: "literal", value: token.value };
      case "string":
        return { type: "string", value: token.value, quote: token.quote };
      case "defineReference":
        return token.braced ? { type: "defineReference", content: token.content, braced: true } : { type: "defineReference", name: token.name, braced: false };
      case "identifier":
        return { type: "identifier", name: token.value };
      case "lparen": {
        const expression = this.parseExpression();
        this.expect("rparen");
        return expression;
      }
      default:
        throw new Error(`Unexpected token ${token.type}`);
    }
  }
  /**
   * Parses postfix.
   * @param {ExpressionNode} expression The expression.
   * @returns {ExpressionNode} The result.
   */
  parsePostfix(expression) {
    let current = expression;
    while (true) {
      if (this.match({ type: "lparen" })) {
        if (current.type !== "identifier") {
          throw new Error("Only identifier call expressions are currently supported");
        }
        current = {
          type: "call",
          callee: current,
          arguments: this.parseCallArguments()
        };
        continue;
      }
      if (this.match({ type: "dot" })) {
        if (!isReferenceExpressionNode(current)) {
          throw new Error("Member access requires a reference expression");
        }
        const property = this.consume();
        if (!property || property.type !== "identifier") {
          throw new Error("Expected member name after '.'");
        }
        current = {
          type: "member",
          object: current,
          property: { type: "identifier", name: property.value }
        };
        continue;
      }
      if (this.match({ type: "lbracket" })) {
        if (!isReferenceExpressionNode(current)) {
          throw new Error("Index access requires a reference expression");
        }
        const indexExpression = this.parseExpression();
        this.expect("rbracket");
        current = {
          type: "index",
          object: current,
          index: indexExpression
        };
        continue;
      }
      return current;
    }
  }
  /**
   * Parses call arguments.
   * @returns {ExpressionNode[]} The result.
   */
  parseCallArguments() {
    const args = [];
    if (this.match({ type: "rparen" })) {
      return args;
    }
    do {
      args.push(this.parseExpression());
    } while (this.match({ type: "comma" }));
    this.expect("rparen");
    return args;
  }
  /**
   * Expects a value.
   * @param {Token["type"]} type The type.
   */
  expect(type) {
    const token = this.consume();
    if (!token || token.type !== type) {
      throw new Error(`Expected token ${type}`);
    }
  }
  /**
   * Matches a value.
   * @param {Pick<Token, "type">} expected The expected.
   * @returns {boolean} The result.
   */
  match(expected) {
    const token = this.peek();
    if (token && token.type === expected.type) {
      this.index++;
      return true;
    }
    return false;
  }
  /**
   * Consumes a value.
   * @returns {Token | undefined} The result.
   */
  consume() {
    const token = this.tokens[this.index];
    this.index++;
    return token;
  }
  /**
   * Gets the next a value.
   * @returns {Token | undefined} The result.
   */
  peek() {
    return this.tokens[this.index];
  }
};
function isBinaryOperator(value) {
  return value in binaryPrecedence;
}

// packages/core/src/internal-instrumentation.ts
import { performance } from "node:perf_hooks";
var activeInstrumentation;
function sampleMemory(metrics) {
  const memory = process.memoryUsage();
  metrics.peakRssBytes = Math.max(metrics.peakRssBytes, memory.rss);
  metrics.peakHeapUsedBytes = Math.max(metrics.peakHeapUsedBytes, memory.heapUsed);
}
function incrementInternalCounter(name, amount = 1) {
  const metrics = activeInstrumentation;
  if (metrics) {
    metrics.counters[name] += amount;
  }
}
function isInternalInstrumentationActive() {
  return activeInstrumentation !== void 0;
}
function recordInternalCounterPeak(name, value) {
  const metrics = activeInstrumentation;
  if (metrics) {
    metrics.counters[name] = Math.max(metrics.counters[name], value);
  }
}
function measureInternalPhase(name, callback) {
  const metrics = activeInstrumentation;
  if (!metrics) {
    return callback();
  }
  const start = performance.now();
  try {
    return callback();
  } finally {
    metrics.phasesMs[name] = (metrics.phasesMs[name] ?? 0) + performance.now() - start;
    sampleMemory(metrics);
  }
}

// packages/core/src/ir/normalized-command.ts
var EMPTY_COMMAND_SPAN = Object.freeze({ start: 0, end: 0 });
var EMPTY_TOKEN_SPANS = Object.freeze([]);
function createCommandProvenance(raw, normalized, words, file, line, collectSourceMetadata = true) {
  if (!collectSourceMetadata) {
    return {
      file,
      line,
      raw,
      normalized,
      span: EMPTY_COMMAND_SPAN,
      normalizedSpan: EMPTY_COMMAND_SPAN,
      tokenSpans: EMPTY_TOKEN_SPANS
    };
  }
  return {
    file,
    line,
    raw,
    normalized,
    span: createLineSpan(raw, line),
    normalizedSpan: createLineSpan(normalized, line),
    tokenSpans: deriveTokenSpans(raw, words, line)
  };
}
function createNormalizedCommand(raw, normalized, words, file, line, collectSourceMetadata = true) {
  const command = normalized.trim();
  const keyword = words[0] ?? "";
  return {
    kind: classifyCommand(command, words),
    source: createCommandProvenance(raw, normalized, words, file, line, collectSourceMetadata),
    command,
    words,
    keyword,
    labelName: deriveLabelName(keyword),
    assignmentTarget: deriveAssignmentTarget(words),
    parsed: deriveCommandSemantics(command, words)
  };
}
function cloneNormalizedCommand(command) {
  incrementInternalCounter("normalizedCommandClones");
  return { ...command };
}
function setCommandWords(command, words, normalized) {
  command.words = words;
  command.keyword = words[0] ?? "";
  command.command = (normalized ?? words.join(" ")).trim();
  const normalizedSource = normalized ?? command.command;
  if (command.source.tokenSpans === EMPTY_TOKEN_SPANS) {
    command.source = {
      ...command.source,
      normalized: normalizedSource,
      normalizedSpan: EMPTY_COMMAND_SPAN,
      tokenSpans: EMPTY_TOKEN_SPANS
    };
  } else {
    command.source = {
      ...command.source,
      normalized: normalizedSource,
      normalizedSpan: createLineSpan(normalizedSource, command.source.line),
      tokenSpans: deriveTokenSpans(command.source.raw, words, command.source.line)
    };
  }
  command.labelName = deriveLabelName(command.keyword);
  command.assignmentTarget = deriveAssignmentTarget(words);
  command.parsed = deriveCommandSemantics(command.command, words);
  command.kind = classifyCommand(command.command, words);
  return command;
}
function setCommandKind(command, kind) {
  command.kind = kind;
  return command;
}
function classifyCommand(command, words) {
  const trimmed = command.trim();
  const keyword = (words[0] ?? "").toLowerCase();
  if (!trimmed || trimmed.startsWith(";")) {
    return "commentOrEmpty";
  }
  if (words.length === 3 && words[1] === "=" && (words[0]?.startsWith("'") || words[0]?.startsWith('"'))) {
    return "characterMapping";
  }
  if (trimmed.startsWith("!")) {
    return "defineCommand";
  }
  if (keyword === "macro" || keyword === "endmacro" || keyword.startsWith("%")) {
    return "macroDefinitionOrInvoke";
  }
  if (keyword === "undef") {
    return "defineCommand";
  }
  if (keyword === "struct" || keyword === "endstruct" || keyword === "skip") {
    return "structCommand";
  }
  if (keyword === "function") {
    return "functionDefinition";
  }
  if (keyword === "global") {
    return "labelDefinition";
  }
  if (words.length === 3 && (words[1] === "=" || words[1] === ":=")) {
    return "staticAssignment";
  }
  if (deriveLabelName(words[0] ?? "")) {
    return "labelDefinition";
  }
  return keyword ? "opcodeCandidate" : "unknown";
}
function deriveLabelName(keyword) {
  if (!keyword) {
    return void 0;
  }
  if (keyword === ":") {
    return ":";
  }
  if (/^\++:?$/.test(keyword) || /^-+:?$/.test(keyword)) {
    return keyword.endsWith(":") ? keyword.slice(0, -1) : keyword;
  }
  if (keyword.endsWith(":") || keyword.startsWith(".")) {
    return keyword.endsWith(":") ? keyword.slice(0, -1) : keyword;
  }
  return void 0;
}
function deriveAssignmentTarget(words) {
  if (words.length === 3 && (words[1] === "=" || words[1] === ":=")) {
    return words[0];
  }
  return void 0;
}
function deriveCommandSemantics(command, words) {
  const keyword = (words[0] ?? "").toLowerCase();
  const bareKeyword = keyword.startsWith(".") ? keyword.slice(1) : keyword;
  const semantics = {};
  if ((keyword === "if" || keyword === "elseif" || keyword === "while") && words.length > 1) {
    semantics.condition = {
      expression: parseExpressionNode(words.slice(1).join(" "))
    };
  }
  if (keyword === "for" && words.length >= 4 && words[2] === "=") {
    const variable = words[1];
    const parsedRange = parseExpressionNode(words.slice(3).join(" "));
    if (parsedRange.type === "range") {
      semantics.forLoop = {
        variable,
        range: parsedRange,
        start: parsedRange.start,
        end: parsedRange.end
      };
    }
  }
  if (words.length === 3 && (words[1] === "=" || words[1] === ":=") && !(words[0]?.startsWith("'") || words[0]?.startsWith('"'))) {
    semantics.assignment = {
      target: words[0],
      expression: parseExpressionNode(words[2])
    };
  }
  if (bareKeyword === "incbin" && words.length >= 2) {
    const incbinSource = command.slice((words[0] ?? "").length).split(/\s+->\s+/u, 1)[0].trim();
    const rangeCandidate = extractIncbinRange(incbinSource);
    if (rangeCandidate) {
      const parsedRange = parseExpressionNode(rangeCandidate);
      if (parsedRange.type === "range") {
        semantics.incbinRange = {
          range: parsedRange,
          start: parsedRange.start,
          end: parsedRange.end
        };
      }
    }
    const includePath = extractIncludePath(incbinSource);
    if (includePath) {
      semantics.includeTarget = { directive: "incbin", target: includePath };
    }
  }
  if (keyword.startsWith("%")) {
    const invocationText = command.trim().slice(1);
    const openParen = invocationText.indexOf("(");
    if (openParen !== -1 && invocationText.endsWith(")")) {
      const name = invocationText.slice(0, openParen).trim();
      const argsText = invocationText.slice(openParen + 1, -1);
      const args = splitCommaArguments(argsText);
      semantics.macroInvocation = { name, args };
    } else if (invocationText) {
      semantics.macroInvocation = { name: invocationText.trim(), args: [] };
    }
  }
  if ((bareKeyword === "include" || bareKeyword === "incsrc") && words.length >= 2) {
    semantics.includeTarget = {
      directive: bareKeyword,
      target: words.slice(1).join(" ").trim()
    };
  }
  const labelSplit = extractLabelSplit(command);
  if (labelSplit) {
    semantics.labelSplit = labelSplit;
  }
  if (["db", "dw", "dl", "dd", "dc.b", "dc.w", "dc.l"].includes(keyword) && words.length >= 2) {
    const payload = command.slice((words[0] ?? "").length).trim();
    semantics.dataDirective = {
      directive: keyword,
      operands: splitCommaArguments(payload)
    };
  }
  if (keyword && !keyword.startsWith("%") && !keyword.startsWith("!")) {
    const payload = command.slice((words[0] ?? "").length).trim();
    const args = semantics.dataDirective?.operands ?? (payload ? splitCommaArguments(payload) : []);
    semantics.directiveArgs = {
      name: keyword,
      args
    };
    if (!deriveLabelName(words[0] ?? "") && payload) {
      semantics.opcodeOperands = {
        mnemonic: words[0] ?? "",
        operandText: payload,
        operands: args
      };
    }
  }
  return semantics;
}
function extractIncludePath(raw) {
  const trimmed = raw.trim();
  const quote = trimmed[0];
  if (quote === '"' || quote === "'" || quote === "`") {
    const end = trimmed.indexOf(quote, 1);
    if (end !== -1) {
      return trimmed.slice(1, end);
    }
  }
  const colonIndex = trimmed.indexOf(":");
  const pathToken = colonIndex === -1 ? trimmed : trimmed.slice(0, colonIndex);
  return pathToken.replace(/^["'`]+|["'`]+$/g, "");
}
function extractIncbinRange(argument) {
  const colonIndex = argument.indexOf(":");
  if (colonIndex === -1) {
    return void 0;
  }
  return argument.slice(colonIndex + 1);
}
function extractLabelSplit(command) {
  const trimmed = command.trim();
  const labelMatch = trimmed.match(/^([$.?A-Z_a-z][\w$.?]*):\s*(.*)$/);
  if (!labelMatch) {
    return void 0;
  }
  const trailing = labelMatch[2].trim();
  return {
    label: labelMatch[1],
    trailing: trailing || void 0
  };
}
function splitCommaArguments(input) {
  const values = [];
  let current = "";
  let depth = 0;
  let inQuote = false;
  let quoteChar = "";
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if ((char === '"' || char === "'") && input[i - 1] !== "\\") {
      if (!inQuote) {
        inQuote = true;
        quoteChar = char;
      } else if (quoteChar === char) {
        inQuote = false;
      }
      current += char;
      continue;
    }
    if (!inQuote && char === "(") {
      depth++;
      current += char;
      continue;
    }
    if (!inQuote && char === ")") {
      depth = Math.max(0, depth - 1);
      current += char;
      continue;
    }
    if (!inQuote && depth === 0 && char === ",") {
      const normalized = current.trim();
      if (normalized) {
        values.push(normalized);
      }
      current = "";
      continue;
    }
    current += char;
  }
  const tail = current.trim();
  if (tail) {
    values.push(tail);
  }
  return values;
}

// packages/core/src/mathcore.ts
var debug2 = (..._) => {
};
try {
  const { default: d } = await import("debug");
  debug2 = d("MathCore");
} catch {
}
function escapeRegExp(value) {
  return value.replace(/[$()*+.?[\\\]^{|}]/g, "\\$&");
}
function throwMathError(message) {
  throw new AssemblyError("MATH_EVALUATION_ERROR", message);
}
function getOperator(operators, token) {
  if (!Object.hasOwn(operators, token)) {
    return void 0;
  }
  return operators[token];
}
var OPERATORS = {
  // Higher priority binds tighter. Same-level ops are left-associative via priority+1.
  "**": { priority: 6, operation: (left, right) => Math.pow(left, right) },
  "*": { priority: 5, operation: (left, right) => left * right },
  "/": {
    priority: 5,
    operation: (left, right) => right !== 0 ? left / right : throwMathError("Division by zero")
  },
  "%": {
    priority: 5,
    operation: (left, right) => right !== 0 ? left % right : throwMathError("Modulo by zero")
  },
  "+": { priority: 4, operation: (left, right) => left + right },
  "-": { priority: 4, operation: (left, right) => left - right },
  "<<": { priority: 3, operation: (left, right) => left << right },
  ">>": { priority: 3, operation: (left, right) => left >> right },
  "&": { priority: 3, operation: (left, right) => left & right },
  "|": { priority: 3, operation: (left, right) => left | right },
  "^": { priority: 3, operation: (left, right) => left ^ right },
  "<": { priority: 2, operation: (left, right) => left < right ? 1 : 0 },
  ">": { priority: 2, operation: (left, right) => left > right ? 1 : 0 },
  "<=": { priority: 2, operation: (left, right) => left <= right ? 1 : 0 },
  ">=": { priority: 2, operation: (left, right) => left >= right ? 1 : 0 },
  "==": { priority: 2, operation: (left, right) => left === right ? 1 : 0 },
  "=": { priority: 2, operation: (left, right) => left === right ? 1 : 0 },
  "!=": { priority: 2, operation: (left, right) => left !== right ? 1 : 0 },
  "&&": { priority: 1, operation: (left, right) => left && right ? 1 : 0 },
  "||": { priority: 0, operation: (left, right) => left || right ? 1 : 0 }
};
var BUILTIN_NUMERIC_UNARY = {
  sqrt: Math.sqrt,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  log: Math.log,
  log10: Math.log10,
  log2: Math.log2,
  ceil: Math.ceil,
  floor: Math.floor
};
var NUMERIC_UNARY_ALIASES = {
  arcsin: "asin",
  arccos: "acos",
  arctan: "atan"
};
var STRING_FIRST_ARG_FUNCTIONS = /* @__PURE__ */ new Set([
  "defined",
  "sizeof",
  "objectsize",
  "datasize",
  "filesize",
  "getfilestatus"
]);
var STRING_TWO_ARG_FUNCTIONS = /* @__PURE__ */ new Set(["stringsequal", "stringsequalnocase"]);
var FILE_STRING_FUNCTION = /^(?:canreadfile|readfile)\d?$/;
function isScanWhitespace(code) {
  if (code === 32 || code === 9 || code === 10 || code === 13) {
    return true;
  }
  if (code === 11 || code === 12 || code === 160 || code === 65279) {
    return true;
  }
  return false;
}
function isWordChar(code) {
  if (code >= 48 && code <= 57) {
    return true;
  }
  if (code >= 65 && code <= 90) {
    return true;
  }
  if (code >= 97 && code <= 122) {
    return true;
  }
  return code === 95;
}
var MathCore = class {
  pureStringExpressionCache = /* @__PURE__ */ new Map();
  roundedPureStringExpressionCache = /* @__PURE__ */ new Map();
  pureStringClassification = /* @__PURE__ */ new Map();
  instrumentedExpressionStrings = /* @__PURE__ */ new Set();
  instrumentedPureExpressionStrings = /* @__PURE__ */ new Set();
  instrumentedExpressionNodes = /* @__PURE__ */ new WeakSet();
  instrumentedPureExpressionNodes = /* @__PURE__ */ new WeakSet();
  host;
  math_round = false;
  userFunctions = /* @__PURE__ */ new Map();
  expressionFunctions = /* @__PURE__ */ new Map();
  operators = OPERATORS;
  /** Full expression currently being scanned. */
  scanSource = "";
  /** Byte offset into `scanSource`; `str` is the slice from here to the end. */
  scanIndex = 0;
  /**
   * Remaining unconsumed expression text.
   * @returns {string} The unconsumed source from the scan cursor.
   */
  get str() {
    return this.scanSource.slice(this.scanIndex);
  }
  /**
   * Replaces the expression being scanned.
   * @param {string} value The new expression source.
   */
  set str(value) {
    this.scanSource = value;
    this.scanIndex = 0;
  }
  /**
   * Advances the scan cursor past ASCII / trim whitespace.
   */
  skipWhitespace() {
    const source = this.scanSource;
    let index = this.scanIndex;
    while (index < source.length && isScanWhitespace(source.charCodeAt(index))) {
      index++;
    }
    this.scanIndex = index;
  }
  /**
   * Returns whether the remaining source starts with a literal.
   * @param {string} text The literal to match.
   * @returns {boolean} Whether the literal is present at the cursor.
   */
  remainingStartsWith(text) {
    return this.scanSource.startsWith(text, this.scanIndex);
  }
  /**
   * Consumes a fixed number of characters from the scan cursor.
   * @param {number} count The number of characters to consume.
   */
  advance(count) {
    this.scanIndex += count;
  }
  /**
   * Initialize the math core.
   */
  reset() {
    debug2("reset");
    this.math_round = false;
    this.userFunctions.clear();
    this.clearExpressionCaches();
  }
  /**
   * Installs a target-provided expression function for this session.
   * @param {string | readonly string[]} names The canonical name and aliases.
   * @param {RegisteredExpressionFunction} expressionFunction The function descriptor and evaluator.
   */
  registerExpressionFunction(names, expressionFunction) {
    for (const name of typeof names === "string" ? [names] : names) {
      this.expressionFunctions.set(name.toLowerCase(), expressionFunction);
    }
  }
  /**
   * Starts a new expression-cache snapshot for an assembly.
   */
  beginAssemblySnapshot() {
    this.clearExpressionCaches();
  }
  /**
   * Releases expression values retained for a completed assembly.
   */
  endAssemblySnapshot() {
    this.clearExpressionCaches();
  }
  /**
   * Clears expression caches retained for the current assembly.
   */
  clearExpressionCaches() {
    this.pureStringExpressionCache.clear();
    this.roundedPureStringExpressionCache.clear();
    this.pureStringClassification.clear();
    this.instrumentedExpressionStrings.clear();
    this.instrumentedPureExpressionStrings.clear();
    this.instrumentedExpressionNodes = /* @__PURE__ */ new WeakSet();
    this.instrumentedPureExpressionNodes = /* @__PURE__ */ new WeakSet();
  }
  /**
   * Evaluates an expression.
   * This is a direct conversion of `math` in `asar_math.cpp`.
   * @param {string} expression The expression to evaluate.
   * @returns {number} The result of the expression.
   */
  math = (expression) => {
    if (isInternalInstrumentationActive()) {
      return measureInternalPhase("expressionEvaluation", () => {
        this.recordExpressionEvaluation(expression);
        return this.evaluateMathInput(expression);
      });
    }
    return this.evaluateMathInput(expression);
  };
  /**
   * Evaluates a string or typed expression without instrumentation dispatch.
   * @param {string | ExpressionNode} expression The expression to evaluate.
   * @returns {number} The expression result.
   */
  evaluateMathInput(expression) {
    if (typeof expression !== "string") {
      return this.evaluateExpressionNode(expression);
    }
    return this.evaluateCachedStringExpression(expression);
  }
  /**
   * Reuses successful results only for strings proven to contain literal operators.
   * @param {string} expression The legacy expression source.
   * @returns {number} The expression result.
   */
  evaluateCachedStringExpression(expression) {
    let isPure = this.pureStringClassification.get(expression);
    if (isPure === void 0) {
      isPure = this.isPureExpressionNode(parseExpressionNode(expression));
      this.pureStringClassification.set(expression, isPure);
    }
    if (!isPure) {
      return this.evaluateStringExpression(expression);
    }
    const cache = this.math_round ? this.roundedPureStringExpressionCache : this.pureStringExpressionCache;
    const cached = cache.get(expression);
    if (cached !== void 0) {
      incrementInternalCounter("pureStringExpressionCacheHits");
      return cached;
    }
    incrementInternalCounter("pureStringExpressionCacheMisses");
    const result = this.evaluateStringExpression(expression);
    cache.set(expression, result);
    return result;
  }
  /**
   * Records the shape and reuse of a top-level expression evaluation.
   * @param {string | ExpressionNode} expression The evaluated expression.
   */
  recordExpressionEvaluation(expression) {
    incrementInternalCounter("expressionEvaluations");
    if (typeof expression === "string") {
      incrementInternalCounter("expressionStringEvaluations");
      if (!this.instrumentedExpressionStrings.has(expression)) {
        this.instrumentedExpressionStrings.add(expression);
        incrementInternalCounter("expressionUniqueStringEvaluations");
        if (this.isPureExpressionNode(parseExpressionNode(expression))) {
          this.instrumentedPureExpressionStrings.add(expression);
          incrementInternalCounter("pureStringExpressionUniqueValues");
        }
      }
      if (this.instrumentedPureExpressionStrings.has(expression)) {
        incrementInternalCounter("pureStringExpressionEvaluations");
      }
      return;
    }
    incrementInternalCounter("expressionNodeEvaluations");
    if (!this.instrumentedExpressionNodes.has(expression)) {
      this.instrumentedExpressionNodes.add(expression);
      incrementInternalCounter("expressionUniqueNodeEvaluations");
    }
    if (!this.isPureExpressionNode(expression)) {
      return;
    }
    incrementInternalCounter("pureExpressionEvaluations");
    if (!this.instrumentedPureExpressionNodes.has(expression)) {
      this.instrumentedPureExpressionNodes.add(expression);
      incrementInternalCounter("pureExpressionUniqueNodes");
    }
  }
  /**
   * Determines whether an expression depends only on literal operators.
   * @param {ExpressionNode} expression The expression to classify.
   * @returns {boolean} Whether the result is independent of assembler state.
   */
  isPureExpressionNode(expression) {
    switch (expression.type) {
      case "literal":
        return true;
      case "unary":
        return this.isPureExpressionNode(expression.argument);
      case "binary":
        return this.isPureExpressionNode(expression.left) && this.isPureExpressionNode(expression.right);
      default:
        return false;
    }
  }
  /**
   * Evaluates a string expression using the legacy parser.
   * @param {string} expression The expression to evaluate.
   * @returns {number} The result of the expression.
   */
  evaluateStringExpression(expression) {
    debug2("math", expression);
    this.str = expression.trim();
    const rval = this.evalMath(0);
    if (rval === void 0) {
      throw new AssemblyError("MATH_INVALID_INPUT", "Invalid input: empty expression.");
    }
    this.skipWhitespace();
    if (this.scanIndex < this.scanSource.length) {
      if (this.remainingStartsWith(",")) {
        throw new AssemblyError("MATH_INVALID_INPUT", `Invalid input: ${this.str}`);
      }
      throw new AssemblyError("MATH_MISMATCHED_PARENTHESES", "Mismatched parentheses.");
    }
    debug2(`math: ${expression} = ${rval}`);
    return rval;
  }
  /**
   * Evaluates an expression node using typed dispatch before falling back to string parsing.
   * @param {ExpressionNode} expression The expression node to evaluate.
   * @returns {number} The numeric result.
   */
  evaluateExpressionNode(expression) {
    if (isReferenceExpressionNode(expression)) {
      return this.evaluateReferenceExpressionNode(expression);
    }
    switch (expression.type) {
      case "literal":
        return this.parseLiteralNode(expression.value);
      case "string":
        throw new AssemblyError(
          "MATH_STRING_NOT_NUMERIC",
          `String expression is not directly numeric: ${expression.value}`
        );
      case "call":
        return this.callFunction(
          expression.callee.name,
          expression.arguments.map(
            (argument, index) => this.evaluateCallArgument(expression.callee.name, index, argument)
          )
        );
      case "unary":
        return this.evaluateUnaryExpressionNode(expression.operator, expression.argument);
      case "binary":
        return this.evaluateBinaryExpressionNode(
          expression.operator,
          expression.left,
          expression.right
        );
      case "range":
        throw new AssemblyError(
          "MATH_RANGE_NOT_NUMERIC",
          `Range expression is not directly numeric: ${renderExpressionNode(expression)}`
        );
      case "raw":
      default:
        return this.evaluateStringExpression(expression.value);
    }
  }
  /**
   * Evaluates call argument.
   * @param {string} functionName The function name.
   * @param {number} argumentIndex The argument index.
   * @param {ExpressionNode} argument The argument.
   * @returns {number | string} The result.
   */
  evaluateCallArgument(functionName, argumentIndex, argument) {
    if (this.isStringArgument(functionName, argumentIndex)) {
      switch (argument.type) {
        case "identifier":
          return argument.name;
        case "string":
          return argument.value;
        case "raw":
          return argument.value.replace(/^["']|["']$/g, "");
        default:
          return renderExpressionNode(argument);
      }
    }
    switch (argument.type) {
      case "string":
        return argument.value;
      case "range":
        return renderExpressionNode(argument);
      case "raw":
        return this.evaluateStringExpression(argument.value);
      default:
        if (isReferenceExpressionNode(argument)) {
          return argument.type === "defineReference" ? renderReferenceExpressionNode(argument) : this.resolveNumericIdentifierArgument(
            renderReferenceExpressionNode(argument, {
              renderIndex: (node) => this.evaluateExpressionNode(node).toString()
            })
          );
        }
        return this.evaluateExpressionNode(argument);
    }
  }
  /**
   * Evaluates unary expression node.
   * @param {UnaryOperator} operator The operator.
   * @param {ExpressionNode} argument The argument.
   * @returns {number} The result.
   */
  evaluateUnaryExpressionNode(operator, argument) {
    const value = this.evaluateExpressionNode(argument);
    switch (operator) {
      case "<:":
        return value >>> 16;
      case "<":
        return value & 255;
      case ">":
        return value >> 8 & 255;
      case "^":
        return value >> 16 & 255;
      case "~":
        return ~value;
      case "-":
        return -value;
      case "+":
      default:
        return value;
    }
  }
  /**
   * Evaluates binary expression node.
   * @param {BinaryOperator} operator The operator.
   * @param {ExpressionNode} left The left.
   * @param {ExpressionNode} right The right.
   * @returns {number} The result.
   */
  evaluateBinaryExpressionNode(operator, left, right) {
    const spec = this.operators[operator];
    return spec.operation(this.evaluateExpressionNode(left), this.evaluateExpressionNode(right));
  }
  /**
   * Resolves numeric identifier argument.
   * @param {string} identifier The identifier.
   * @returns {number | string} The result.
   */
  resolveNumericIdentifierArgument(identifier) {
    try {
      const resolved = this.getHost().resolveLabel(identifier);
      return typeof resolved === "number" ? resolved : identifier;
    } catch {
      return identifier;
    }
  }
  /**
   * Evaluates reference expression node.
   * @param {ReferenceExpressionNode} expression The expression.
   * @returns {number} The result.
   */
  evaluateReferenceExpressionNode(expression) {
    if (expression.type === "defineReference") {
      throw new Error(`Unresolved define reference: ${renderReferenceExpressionNode(expression)}`);
    }
    const reference = renderReferenceExpressionNode(expression, {
      renderIndex: (node) => this.evaluateExpressionNode(node).toString()
    });
    const resolved = this.getHost().resolveLabel(reference);
    if (typeof resolved === "number") {
      return resolved;
    }
    throw new Error(`Reference '${reference}' did not resolve to a numeric value.`);
  }
  /**
   * Resolves leading local label reference.
   * @param {string} input The input.
   * @returns {{ label: string; length: number } | undefined} The result.
   */
  resolveLeadingLocalLabelReference(input) {
    const match = input.match(/^(\.+\w+)/);
    if (!match) {
      return void 0;
    }
    return { label: match[1], length: match[1].length };
  }
  /**
   * Checks whether string argument.
   * @param {string} functionName The function name.
   * @param {number} argumentIndex The argument index.
   * @returns {boolean} The result.
   */
  isStringArgument(functionName, argumentIndex) {
    if (STRING_FIRST_ARG_FUNCTIONS.has(functionName)) {
      return argumentIndex === 0;
    }
    if (STRING_TWO_ARG_FUNCTIONS.has(functionName)) {
      return argumentIndex < 2;
    }
    if (FILE_STRING_FUNCTION.test(functionName)) {
      return argumentIndex === 0;
    }
    return false;
  }
  /**
   * Parses literal node.
   * @param {string} value The value.
   * @returns {number} The result.
   */
  parseLiteralNode(value) {
    if (/^-?\d+$/.test(value)) {
      return Number.parseInt(value, 10);
    }
    if (/^\$[\dA-Fa-f]+$/.test(value)) {
      return Number.parseInt(value.slice(1), 16);
    }
    if (/^0x[\da-f]+$/i.test(value)) {
      return Number.parseInt(value.slice(2), 16);
    }
    if (/^%[01]+$/.test(value)) {
      return Number.parseInt(value.slice(1), 2);
    }
    throw new Error(`Unsupported literal expression: ${value}`);
  }
  /**
   * Evaluates a mathematical expression.
   * This replaces the C++ `eval` function.
   * @param {number} depth The current depth of nested expressions.
   * @param {string} [stopChar] The character to stop the evaluation at.
   * @returns {number | undefined} The result of the evaluated expression, or
   * `undefined` when an inline function definition consumes the expression.
   */
  evalMath(depth = 0, stopChar) {
    debug2("evalMath", { depth, stopChar, scanIndex: this.scanIndex });
    let left;
    if (this.remainingStartsWith("function")) {
      this.parseFunctionDefinition();
      left = this.evalMath(depth, stopChar);
    } else if (this.scanIndex < this.scanSource.length) {
      left = this.getnum();
    }
    if (left === void 0) {
      return void 0;
    }
    if (Number.isNaN(left)) {
      throw new Error(`Invalid number: ${left}`);
    }
    debug2("evalMath after getnum", left);
    this.skipWhitespace();
    while (this.scanIndex < this.scanSource.length) {
      this.skipWhitespace();
      if (stopChar && this.remainingStartsWith(stopChar)) {
        break;
      }
      const nextChar = this.scanSource[this.scanIndex];
      if (nextChar === "," || nextChar === ")" || nextChar === "]") {
        break;
      }
      const op2 = this.peekNextOperator(this.operators, depth);
      debug2("evalMath peekNextOperator =", op2);
      if (!op2) break;
      this.advance(op2.length);
      this.skipWhitespace();
      const right = this.evalMath(this.operators[op2].priority + 1, stopChar);
      if (right === void 0) {
        throw new Error(`Missing right operand for operator '${op2}'.`);
      }
      debug2("evalMath right =", { right, op: op2, left });
      left = this.operators[op2].operation(left, right);
    }
    if (this.math_round) {
      left = Math.trunc(left);
    }
    if (Number.isNaN(left)) {
      throw new Error(`Invalid number: ${left}`);
    }
    debug2("evalMath =", left);
    return left;
  }
  /**
   * Helper function to peek ahead at the next 1-2 characters and return a matching operator if found and depth-allowed.
   * @param {OperatorTable} operators The operators to check.
   * @param {number} depth The current depth of nested expressions.
   * @returns {BinaryOperator | null} The matching operator or null if no match.
   */
  peekNextOperator(operators, depth) {
    this.skipWhitespace();
    if (this.scanIndex >= this.scanSource.length) {
      debug2("peekNextOperator = null");
      return null;
    }
    const remaining = this.scanSource.length - this.scanIndex;
    if (remaining >= 2) {
      const twoChars = this.scanSource.slice(this.scanIndex, this.scanIndex + 2);
      const twoOp = getOperator(operators, twoChars);
      if (twoOp) {
        if (twoOp.priority >= depth) {
          debug2("peekNextOperator twoChars", twoChars);
          return twoChars;
        }
        debug2("peekNextOperator = null");
        return null;
      }
    }
    const oneChar = this.scanSource[this.scanIndex];
    const oneOp = getOperator(operators, oneChar);
    if (oneOp && oneOp.priority >= depth) {
      debug2("peekNextOperator oneChar", oneChar);
      return oneChar;
    }
    debug2("peekNextOperator = null");
    return null;
  }
  /**
   * Parses numbers from a string while consuming valid characters.
   * @param {RegExp} regex The regular expression to test against the string.
   * @returns {string} The substring of the string that matches the regular expression.
   */
  consumeWhile(regex) {
    debug2("consumeWhile", regex);
    const source = this.scanSource;
    const start = this.scanIndex;
    let index = start;
    while (index < source.length && regex.test(source[index])) {
      index++;
    }
    const result = source.slice(start, index);
    this.scanIndex = index;
    return result;
  }
  /**
   * Retrieves a number from the string.
   * This implements `getnumcore` and `getnum`.
   * @returns {number} The number from the string.
   */
  getnum = () => {
    debug2("getnum:", this.scanIndex);
    this.skipWhitespace();
    let applyBitshift = false;
    let sign = 1;
    while (true) {
      if (this.remainingStartsWith("<:")) {
        this.advance(2);
        this.skipWhitespace();
        applyBitshift = true;
      } else if (this.remainingStartsWith("<") && !this.remainingStartsWith("<<") && !this.remainingStartsWith("<=")) {
        this.advance(1);
        this.skipWhitespace();
        return sign * (this.getnum() & 255) | 0;
      } else if (this.remainingStartsWith(">") && !this.remainingStartsWith(">>") && !this.remainingStartsWith(">=")) {
        this.advance(1);
        this.skipWhitespace();
        return sign * (this.getnum() >> 8 & 255) | 0;
      } else if (this.remainingStartsWith("^")) {
        this.advance(1);
        this.skipWhitespace();
        return sign * (this.getnum() >> 16 & 255) | 0;
      } else if (this.remainingStartsWith("~")) {
        this.advance(1);
        this.skipWhitespace();
        return ~this.getnum();
      } else if (this.remainingStartsWith("!") && !this.remainingStartsWith("!=")) {
        const after = this.scanSource[this.scanIndex + 1];
        let isDefineLike = after === "{";
        if (after !== void 0) {
          const code = after.charCodeAt(0);
          if (code >= 65 && code <= 90 || code >= 97 && code <= 122 || code === 95) {
            isDefineLike = true;
          }
        }
        if (!isDefineLike) {
          this.advance(1);
          this.skipWhitespace();
          return ~this.getnum();
        }
        break;
      } else if (this.remainingStartsWith("-")) {
        this.advance(1);
        this.skipWhitespace();
        sign *= -1;
      } else if (this.remainingStartsWith("+")) {
        this.advance(1);
        this.skipWhitespace();
      } else {
        break;
      }
    }
    const fnName = this.scanFunctionCallName();
    if (fnName !== void 0) {
      debug2("getnum function:", fnName);
      const args = [];
      if (this.scanSource[this.scanIndex] === "(") {
        this.advance(1);
        this.skipWhitespace();
        if (!this.remainingStartsWith(")")) {
          while (true) {
            this.skipWhitespace();
            if (this.remainingStartsWith(",")) {
              this.advance(1);
              this.skipWhitespace();
            }
            debug2("getnum while 1", this.scanIndex);
            if (this.remainingStartsWith(")")) {
              break;
            }
            if (this.remainingStartsWith('"')) {
              args.push(this.parseStringLiteral());
            } else if (this.isStringArgument(fnName, args.length)) {
              args.push(this.parseUnquotedStringArgument(fnName));
            } else {
              const val = this.evalMath(0, ")");
              if (val === void 0) {
                throw new Error(`Missing function argument for '${fnName}'.`);
              }
              args.push(val);
            }
            this.skipWhitespace();
            debug2("getnum while 2", this.scanIndex);
            if (this.remainingStartsWith(")")) {
              break;
            }
            if (this.remainingStartsWith(",")) {
              this.advance(1);
              this.skipWhitespace();
              continue;
            }
            throw new Error(`Expected ',' or ')' in function call arguments: ${this.str}`);
          }
        }
        const outerSource = this.scanSource;
        const afterCall = this.scanIndex + 1;
        const result = this.callFunction(fnName, args);
        debug2("getnum result =", result);
        this.scanSource = outerSource;
        this.scanIndex = afterCall;
        this.skipWhitespace();
        debug2("getnum leftover index =", this.scanIndex);
        let value2 = sign * result;
        if (applyBitshift) {
          value2 = value2 >>> 16;
        }
        return value2;
      }
    }
    let value;
    if (this.remainingStartsWith("(")) {
      this.advance(1);
      this.skipWhitespace();
      const nestedValue = this.evalMath(0, ")");
      if (nestedValue === void 0) {
        throw new Error("Empty parenthesized expression.");
      }
      value = nestedValue;
      debug2("getnum after paren", this.scanIndex);
      if (!this.remainingStartsWith(")")) {
        throw new Error("Mismatched parentheses.");
      }
      this.advance(1);
      this.skipWhitespace();
    } else if (this.remainingStartsWith("$")) {
      this.advance(1);
      value = parseInt(this.consumeWhile(/[\dA-Fa-f]/), 16);
    } else if (this.remainingStartsWith("0x")) {
      this.advance(2);
      value = parseInt(this.consumeWhile(/[\dA-Fa-f]/), 16);
    } else if (this.remainingStartsWith("%")) {
      this.advance(1);
      value = parseInt(this.consumeWhile(/[01]/), 2);
    } else if (/\d/.test(this.scanSource[this.scanIndex] ?? "")) {
      value = parseFloat(this.consumeWhile(/[\d.]/));
    } else {
      const remaining = this.str;
      const unnamedMatch = remaining.match(/^(:(\++|-+))/);
      if (unnamedMatch) {
        this.advance(unnamedMatch[1].length);
        this.skipWhitespace();
        const resolved = this.getHost().resolveLabel(unnamedMatch[1]);
        if (typeof resolved !== "number") {
          throw new Error(`Reference '${unnamedMatch[1]}' did not resolve to a numeric value.`);
        }
        value = resolved;
      } else {
        const reference = parseLeadingReferenceExpression(remaining);
        if (reference) {
          this.advance(reference.length);
          this.skipWhitespace();
          const renderedReference = renderReferenceExpressionNode(reference.node, {
            renderIndex: (node) => this.evaluateExpressionNode(node).toString()
          });
          const resolved = this.getHost().resolveLabel(renderedReference);
          if (typeof resolved !== "number") {
            throw new Error(`Reference '${renderedReference}' did not resolve to a numeric value.`);
          }
          value = resolved;
        } else {
          const localReference = this.resolveLeadingLocalLabelReference(remaining);
          if (localReference) {
            this.advance(localReference.length);
            this.skipWhitespace();
            const resolved = this.getHost().resolveLabel(localReference.label);
            if (typeof resolved !== "number") {
              throw new Error(
                `Reference '${localReference.label}' did not resolve to a numeric value.`
              );
            }
            value = resolved;
          } else {
            const rootMatch = remaining.match(/^([A-Z_a-z]\w*)/);
            if (rootMatch && remaining.substring(rootMatch[1].length).trimStart().startsWith("[")) {
              throw new Error("Mismatched brackets in struct index");
            }
            throw new Error(`Invalid number: ${remaining}`);
          }
        }
      }
    }
    value = sign * value;
    if (applyBitshift) {
      value = value >>> 16;
    }
    return value;
  };
  /**
   * Scans a function-call name if the next token is `name(`.
   * Leaves the cursor on `(`.
   * @returns {string | undefined} The function name, if a call starts here.
   */
  scanFunctionCallName() {
    const source = this.scanSource;
    let index = this.scanIndex;
    if (index >= source.length || !isWordChar(source.charCodeAt(index))) {
      return void 0;
    }
    index++;
    while (index < source.length && isWordChar(source.charCodeAt(index))) {
      index++;
    }
    const name = source.slice(this.scanIndex, index);
    while (index < source.length && isScanWhitespace(source.charCodeAt(index))) {
      index++;
    }
    if (source[index] !== "(") {
      return void 0;
    }
    this.scanIndex = index;
    return name;
  }
  /**
   * Parses a string literal from the current string with support for quotes.
   * @returns {string} The parsed string literal.
   */
  parseStringLiteral = () => {
    debug2("parseStringLiteral");
    const source = this.scanSource;
    const start = this.scanIndex + 1;
    let index = start;
    while (index < source.length && source[index] !== '"') {
      index++;
    }
    if (index >= source.length) {
      throw new Error("Unterminated string literal in function call.");
    }
    const result = source.slice(start, index);
    this.scanIndex = index + 1;
    this.skipWhitespace();
    return result;
  };
  /**
   * Parses an unquoted string function argument up to a top-level comma or closing parenthesis.
   * Depth tracks nested `()` / `[]` so `Foo[1].bar` and `data/64kb.bin` stay one argument.
   * @param {string} functionName The function being called.
   * @returns {string} The raw argument text.
   */
  parseUnquotedStringArgument(functionName) {
    this.skipWhitespace();
    const source = this.scanSource;
    const start = this.scanIndex;
    let depth = 0;
    let index = start;
    while (index < source.length) {
      const character = source[index];
      if (character === "(" || character === "[") {
        depth++;
      } else if (character === ")" || character === "]") {
        if (depth === 0) {
          break;
        }
        depth--;
      } else if (character === "," && depth === 0) {
        break;
      }
      index++;
    }
    const argument = source.slice(start, index).trim();
    this.scanIndex = index;
    if (!argument) {
      throw new Error(`Missing function argument for '${functionName}'.`);
    }
    return argument;
  }
  /**
   * Calls either a built-in or user-defined function by name, passing an array of arguments which can be strings or numbers.
   * @param {string} name The name of the function to call.
   * @param {Array<number | string>} args The arguments to pass to the function.
   * @returns {number} The result of the function call.
   */
  callFunction = (name, args) => {
    debug2("callFunction", { name, args });
    if (this.userFunctions.has(name)) {
      return this.callUserFunction(name, args);
    }
    const expressionFunction = this.expressionFunctions.get(name.toLowerCase());
    if (expressionFunction) {
      if (args.length < expressionFunction.minimumArguments || args.length > expressionFunction.maximumArguments) {
        const expected = expressionFunction.minimumArguments === expressionFunction.maximumArguments ? `exactly ${expressionFunction.minimumArguments}` : `between ${expressionFunction.minimumArguments} and ${expressionFunction.maximumArguments}`;
        throw new Error(`${name}() expects ${expected} argument(s).`);
      }
      const result = expressionFunction.evaluate(args);
      if (typeof result !== "number") {
        throw new Error(`${name}() returned a non-numeric value.`);
      }
      return result;
    }
    return this.callBuiltInFunction(name, args);
  };
  /**
   * Calls a user-defined function by name, passing an array of arguments which can be strings or numbers.
   * @param {string} name The name of the function to call.
   * @param {Array<number | string>} args The arguments to pass to the function.
   * @returns {number} The result of the function call.
   */
  callUserFunction = (name, args) => {
    debug2("callUserFunction", { name, args });
    const func = this.userFunctions.get(name);
    if (!func) {
      throw new Error(`User function '${name}' not found.`);
    }
    if (args.length < func.args.length) {
      throw new Error(`Function '${name}' expects at least ${func.args.length} argument(s).`);
    }
    let content = func.content;
    for (let i = 0; i < func.args.length; i++) {
      const paramName = func.args[i];
      const argValue = args[i];
      const regex = new RegExp(`\\b${escapeRegExp(paramName)}\\b`, "g");
      const replacement = typeof argValue === "string" ? JSON.stringify(argValue) : argValue.toString();
      content = content.replace(regex, replacement);
    }
    debug2("callUserFunction content =", content);
    const result = this.math(content);
    debug2("callUserFunction =", result);
    return result;
  };
  /**
   * Calls a built-in function by name, passing an array of arguments which can be strings or numbers.
   * @param {string} name The name of the function to call.
   * @param {Array<number | string>} args The arguments to pass to the function.
   * @returns {number} The result of the function call.
   */
  callBuiltInFunction = (name, args) => {
    debug2("callBuiltInFunction", { name, args });
    switch (name) {
      // --- Trigonometric & Logarithmic functions ---
      case "sqrt":
      case "sin":
      case "cos":
      case "tan":
      case "asin":
      case "acos":
      case "atan":
      // Aliases for inverse trig functions
      case "arcsin":
      case "arccos":
      case "arctan":
      case "log":
      case "log10":
      case "log2":
      case "ceil":
      case "floor": {
        if (args.length !== 1) {
          throw new Error(`${name} expects exactly 1 numeric argument.`);
        }
        const builtinName = NUMERIC_UNARY_ALIASES[name] ?? name;
        const mathFunction = BUILTIN_NUMERIC_UNARY[builtinName];
        const val = this.numArg(name, args[0]);
        const result = mathFunction(val);
        if (Number.isNaN(result)) {
          throw new Error(`${name} returned NaN for argument ${val}`);
        }
        return result;
      }
      // Min, Max, Clamp
      case "min": {
        if (args.length < 2) throw new Error("min() expects at least 2 numeric arguments.");
        const numArgs = args.map((arg) => this.numArg(name, arg));
        return Math.min(...numArgs);
      }
      case "max": {
        if (args.length < 2) throw new Error("max() expects at least 2 numeric arguments.");
        const numArgs = args.map((arg) => this.numArg(name, arg));
        return Math.max(...numArgs);
      }
      case "clamp": {
        if (args.length !== 3) throw new Error("clamp() expects exactly 3 numeric arguments.");
        const value = this.numArg(name, args[0]);
        const minVal = this.numArg(name, args[1]);
        const maxVal = this.numArg(name, args[2]);
        return Math.max(minVal, Math.min(maxVal, value));
      }
      // --- Safe Division and Conditional Selection ---
      case "safediv": {
        if (args.length !== 3) throw new Error("safediv() expects exactly 3 numeric arguments.");
        const dividend = this.numArg(name, args[0]);
        const divisor = this.numArg(name, args[1]);
        const defaultValue = this.numArg(name, args[2]);
        return divisor === 0 ? defaultValue : dividend / divisor;
      }
      case "select": {
        if (args.length !== 3) throw new Error("select() expects exactly 3 numeric arguments.");
        const statement = this.numArg(name, args[0]);
        const trueVal = this.numArg(name, args[1]);
        const falseVal = this.numArg(name, args[2]);
        return statement !== 0 ? trueVal : falseVal;
      }
      // --- Logical Operations ---
      case "not": {
        if (args.length !== 1) throw new Error("not() expects exactly 1 numeric argument.");
        const value = this.numArg(name, args[0]);
        return value === 0 ? 1 : 0;
      }
      case "bank": {
        if (args.length !== 1) throw new Error("bank() expects exactly 1 numeric argument.");
        return this.numArg(name, args[0]) >> 16 & 255;
      }
      case "offset": {
        if (args.length !== 2) throw new Error("offset() expects exactly 2 numeric arguments.");
        return this.numArg(name, args[1]) - this.numArg(name, args[0]);
      }
      // --- Comparison Functions ---
      case "equal": {
        if (args.length !== 2) throw new Error("equal() expects exactly 2 numeric arguments.");
        return this.numArg(name, args[0]) === this.numArg(name, args[1]) ? 1 : 0;
      }
      case "notequal": {
        if (args.length !== 2) throw new Error("notequal() expects exactly 2 numeric arguments.");
        return this.numArg(name, args[0]) !== this.numArg(name, args[1]) ? 1 : 0;
      }
      case "less": {
        if (args.length !== 2) throw new Error("less() expects exactly 2 numeric arguments.");
        return this.numArg(name, args[0]) < this.numArg(name, args[1]) ? 1 : 0;
      }
      case "lessequal": {
        if (args.length !== 2) throw new Error("lessequal() expects exactly 2 numeric arguments.");
        return this.numArg(name, args[0]) <= this.numArg(name, args[1]) ? 1 : 0;
      }
      case "greater": {
        if (args.length !== 2) throw new Error("greater() expects exactly 2 numeric arguments.");
        return this.numArg(name, args[0]) > this.numArg(name, args[1]) ? 1 : 0;
      }
      case "greaterequal": {
        if (args.length !== 2)
          throw new Error("greaterequal() expects exactly 2 numeric arguments.");
        return this.numArg(name, args[0]) >= this.numArg(name, args[1]) ? 1 : 0;
      }
      // --- Logical Bitwise Operations ---
      case "and": {
        if (args.length !== 2) throw new Error("and() expects exactly 2 numeric arguments.");
        return this.numArg(name, args[0]) && this.numArg(name, args[1]) ? 1 : 0;
      }
      case "or": {
        if (args.length !== 2) throw new Error("or() expects exactly 2 numeric arguments.");
        return this.numArg(name, args[0]) || this.numArg(name, args[1]) ? 1 : 0;
      }
      case "nand": {
        if (args.length !== 2) throw new Error("nand() expects exactly 2 numeric arguments.");
        return !(this.numArg(name, args[0]) && this.numArg(name, args[1])) ? 1 : 0;
      }
      case "nor": {
        if (args.length !== 2) throw new Error("nor() expects exactly 2 numeric arguments.");
        return !(this.numArg(name, args[0]) || this.numArg(name, args[1])) ? 1 : 0;
      }
      case "xor": {
        if (args.length !== 2) throw new Error("xor() expects exactly 2 numeric arguments.");
        const a = this.numArg(name, args[0]);
        const b = this.numArg(name, args[1]);
        return (a ? 1 : 0) ^ (b ? 1 : 0) ? 1 : 0;
      }
      // --- Rounding ---
      case "round": {
        if (args.length !== 2) throw new Error("round() expects exactly 2 numeric arguments.");
        const number = this.numArg(name, args[0]);
        const precision = this.numArg(name, args[1]);
        return parseFloat(number.toFixed(precision));
      }
      // --- String Comparisons ---
      case "stringsequal": {
        if (args.length !== 2)
          throw new Error("stringsequal() expects exactly 2 string arguments.");
        const str1 = this.strArg(name, args[0]);
        const str2 = this.strArg(name, args[1]);
        return str1 === str2 ? 1 : 0;
      }
      case "stringsequalnocase": {
        if (args.length !== 2)
          throw new Error("stringsequalnocase() expects exactly 2 string arguments.");
        const str1 = this.strArg(name, args[0]);
        const str2 = this.strArg(name, args[1]);
        return str1.toLowerCase() === str2.toLowerCase() ? 1 : 0;
      }
      // --- Filesize & File Status ---
      case "filesize":
      case "getfilestatus": {
        if (args.length !== 1) throw new Error(`${name}() expects exactly 1 argument.`);
        const value = this.strArg(name, args[0]);
        return name === "filesize" ? this.getHost().getFileSize(value) : this.getHost().getFileStatus(value);
      }
      // --- Preprocessor/Struct & Data Size Functions ---
      case "defined":
      case "sizeof":
      case "objectsize":
      case "datasize": {
        if (args.length !== 1) throw new Error(`${name}() expects exactly 1 argument.`);
        const value = this.strArg(name, args[0]);
        if (name === "defined") {
          return this.getHost().isDefined(value);
        }
        return this.getHost().getExpressionObjectSize(value, name === "sizeof");
      }
      // --- File Can-Read functions ---
      case "canreadfile1":
      case "canreadfile2":
      case "canreadfile3":
      case "canreadfile4": {
        if (args.length !== 2) throw new Error(`${name}() expects exactly 2 arguments.`);
        const filename = this.strArg(name, args[0]);
        const pos = this.numArg(name, args[1]);
        return this.getHost().canReadFile(filename, pos, parseInt(name.slice(-1), 10));
      }
      case "canreadfile": {
        if (args.length !== 3)
          throw new Error("canreadfile expects exactly 3 arguments (filename, pos, num).");
        const filename = this.strArg(name, args[0]);
        const pos = this.numArg(name, args[1]);
        const num = this.numArg(name, args[2]);
        return this.getHost().canReadFile(filename, pos, num);
      }
      // --- File Reading functions ---
      case "readfile1":
      case "readfile2":
      case "readfile3":
      case "readfile4": {
        if (args.length < 2 || args.length > 3)
          throw new Error(`${name} expects 2 or 3 arguments (filename, pos, [default]).`);
        const filename = this.strArg(name, args[0]);
        const pos = this.numArg(name, args[1]);
        const size = parseInt(name.slice(-1), 10);
        if (args.length === 3) {
          const defVal = this.numArg(name, args[2]);
          return this.getHost().readFile(filename, pos, size, defVal);
        } else {
          return this.getHost().readFile(filename, pos, size);
        }
      }
      // --- PC/Realbase ---
      case "pc":
      case "realbase": {
        if (args.length !== 0) throw new Error(`${name}() expects no arguments.`);
        return name === "pc" ? this.getHost().getCurrentAddress() : this.getHost().getCurrentBaseAddress();
      }
      default: {
        throw new Error(`Unknown built-in function '${name}'`);
      }
    }
  };
  /**
   * Validates an argument as a number.
   * @param {string} funcName The name of the function.
   * @param {number | string} arg The argument to validate.
   * @returns {number} The validated number.
   */
  numArg = (funcName, arg) => {
    if (typeof arg === "string") {
      throw new Error(
        `Function '${funcName}' expected a numeric argument but got a string: ${arg}`
      );
    }
    return arg;
  };
  /**
   * Validates an argument as a string.
   * @param {string} funcName The name of the function.
   * @param {number | string} arg The argument to validate.
   * @returns {string} The validated string.
   */
  strArg = (funcName, arg) => {
    if (typeof arg === "number") {
      throw new Error(`Function '${funcName}' expected a string argument but got a number: ${arg}`);
    }
    return arg;
  };
  /**
   * Parses a function definition.
   */
  parseFunctionDefinition = () => {
    debug2("parseFunctionDefinition", this.str);
    const cleanDef = this.str.replace(/\\\s*\n/g, "");
    const regex = /^function\s+(\w+)(?:\(([\s\w,]*)\))?\s*=\s*(.+)$/;
    const match = cleanDef.match(regex);
    if (!match || !match[1] || !match[3]) {
      throw new Error("Invalid function definition syntax.");
    }
    const name = match[1];
    const paramsStr = match[2] || "";
    const content = match[3].trim();
    const params = paramsStr ? paramsStr.split(",").map((p) => p.trim()).filter((p) => p.length > 0) : [];
    this.str = this.str.substring(match[0].length).trim();
    this.userFunctions.set(name, { args: params, content });
    debug2("parseFunctionDefinition =", { args: params, content });
  };
  /**
   * Gets host.
   * @returns {ExpressionHost} The result.
   */
  getHost() {
    if (!this.host) {
      throw new Error("ExpressionHost not set.");
    }
    return this.host;
  }
};

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

// packages/core/src/operand-resolver.ts
var debug3 = (..._) => {
};
try {
  const { default: d } = await import("debug");
  debug3 = d("OperandResolver");
} catch {
}
var OperandResolver = class {
  constructor(deps) {
    this.deps = deps;
  }
  deps;
  /**
   * Normalizes numeric base member.
   * @param {string} operand The operand.
   * @returns {string} The result.
   */
  normalizeNumericBaseMember(operand) {
    const match = operand.trim().match(/^(#?)(-?\d+|\$[\da-f]+|%[01]+)\.base(\s*,\s*[sxy])?$/i);
    if (!match) {
      return operand;
    }
    const [, immediatePrefix, literal, indexSuffix = ""] = match;
    return `${immediatePrefix}${literal}${indexSuffix}`;
  }
  /**
   * Splits math operand suffix.
   * @param {string} operand The operand.
   * @returns {{ expression: string; suffix: string }} The result.
   */
  splitMathOperandSuffix(operand) {
    const trimmed = operand.trim();
    const indexedMatch = trimmed.match(/^(.+?)(\s*,\s*[sxy])$/i);
    if (!indexedMatch) {
      return { expression: trimmed, suffix: "" };
    }
    return {
      expression: indexedMatch[1].trim(),
      suffix: indexedMatch[2]
    };
  }
  /**
   * Checks whether numeric token.
   * @param {string} token The token.
   * @returns {boolean} The result.
   */
  isNumericToken(token) {
    return /^-?\d+$/.test(token) || /^\$[\dA-Fa-f]+$/.test(token) || /^%[01]+$/.test(token);
  }
  /**
   * Resolves arithmetic token.
   * @param {string} token The token.
   * @returns {number} The result.
   */
  resolveArithmeticToken(token) {
    if (this.isNumericToken(token)) {
      return this.getnum(token);
    }
    if (token.includes(".") && this.deps.isStructReference(token)) {
      return this.deps.resolveStructLabel(token);
    }
    return this.deps.resolveLabel(token, false);
  }
  /**
   * Attempts to resolve simple arithmetic.
   * @param {string} operand The operand.
   * @returns {number | null} The result.
   */
  tryResolveSimpleArithmetic(operand) {
    const tokenPattern = "([.A-Z_a-z][\\w.]*|-?\\d+|\\$[\\dA-Fa-f]+|%[01]+)";
    const match = operand.match(
      new RegExp(`^${tokenPattern}\\s*(<<|>>|[+\\-])\\s*${tokenPattern}$`)
    );
    if (!match) {
      return null;
    }
    const [, leftToken, operator, rightToken] = match;
    if (this.isNumericToken(leftToken) && this.isNumericToken(rightToken)) {
      return null;
    }
    const leftValue = this.resolveArithmeticToken(leftToken);
    const rightValue = this.resolveArithmeticToken(rightToken);
    switch (operator) {
      case "+":
        return leftValue + rightValue;
      case "-":
        return leftValue - rightValue;
      case "<<":
        return leftValue << rightValue;
      case ">>":
        return leftValue >> rightValue;
      default:
        return null;
    }
  }
  /**
   * Determines value length.
   * @param {string | number} value The value.
   * @returns {number} The result.
   */
  determineValueLength(value) {
    debug3("determineValueLength", value);
    if (typeof value !== "string" && typeof value !== "number") {
      throw new Error(`Invalid value type for length determination: ${typeof value}`);
    }
    if (Number.isNaN(value)) {
      throw new Error(`Invalid value for length determination: ${value}`);
    }
    if (typeof value === "string" && value.trim() === "") {
      return 1;
    }
    let hexString;
    if (typeof value === "number") {
      hexString = value.toString(16).toUpperCase();
    } else if (value.startsWith("$")) {
      hexString = value.substring(1);
    } else {
      hexString = value;
    }
    return Math.max(1, Math.ceil(hexString.length / 2));
  }
  /**
   * Checks whether math expression.
   * @param {string} expression The expression.
   * @returns {boolean} The result.
   */
  isMathExpression(expression) {
    if (!expression || typeof expression !== "string") {
      return false;
    }
    if (/^[A-Z_a-z]\w*\s*\(/.test(expression.trim())) {
      return true;
    }
    return expression.includes("+") || expression.includes("-") || expression.includes("*") || expression.includes("/") || expression.includes("&") || expression.includes("|") || expression.includes("^") || expression.includes("<<") || expression.includes(">>");
  }
  /**
   * Attempts to resolve label in operand.
   * @param {string} operand The operand.
   * @returns {string} The result.
   */
  tryResolveLabelInOperand(operand) {
    debug3("tryResolveLabelInOperand", operand);
    if (operand.startsWith("#")) {
      const inner = operand.substring(1).trim();
      if (!inner.match(/^[\d$%(]/) && !inner.includes(",")) {
        const labelValue = this.deps.tryResolveLabel(inner, false);
        if (labelValue !== void 0) {
          return "#$" + labelValue.toString(16).toUpperCase();
        }
      }
      return operand;
    }
    if (operand.startsWith("[") && operand.endsWith("]")) {
      const inner = operand.substring(1, operand.length - 1).trim();
      if (!inner.match(/^[\d$%(]/) && !inner.includes(",")) {
        const labelValue = this.deps.tryResolveLabel(inner, false);
        if (labelValue !== void 0) {
          return "[$" + labelValue.toString(16).toUpperCase() + "]";
        }
      }
      return operand;
    }
    if (operand.includes(",")) {
      const lastCommaIndex = operand.lastIndexOf(",");
      const basePart = operand.substring(0, lastCommaIndex).trim();
      const indexPart = operand.substring(lastCommaIndex).trim();
      if (!basePart.match(/^[\d$%(]/)) {
        const labelValue = this.deps.tryResolveLabel(basePart, false);
        if (labelValue !== void 0) {
          return "$" + labelValue.toString(16).toUpperCase() + indexPart;
        }
      }
      return operand;
    }
    if (!operand.match(/^[\d#$%([]/) && !operand.includes(",")) {
      const labelValue = this.deps.tryResolveLabel(operand, false);
      if (labelValue !== void 0) {
        return "$" + labelValue.toString(16).toUpperCase();
      }
    }
    return operand;
  }
  /**
   * Gets num.
   * @param {string | ExpressionNode} operand The operand.
   * @returns {number} The result.
   */
  getnum(operand) {
    debug3("getnum", operand);
    if (typeof operand !== "string") {
      return this.getnumFromNode(operand);
    }
    operand = operand.trim();
    operand = this.normalizeNumericBaseMember(operand);
    if (/^-?\d+$/.test(operand)) {
      return parseInt(operand, 10);
    }
    if (/^\$[\dA-Fa-f]+$/.test(operand)) {
      return parseInt(operand.substring(1), 16);
    }
    if (/^%[01]+$/.test(operand)) {
      return parseInt(operand.substring(1), 2);
    }
    operand = this.deps.resolveDefines(operand);
    if (operand.startsWith("#")) {
      operand = operand.substring(1).trim();
    }
    operand = this.normalizeNumericBaseMember(operand);
    if (/^[A-Z_a-z]\w*\s*\(/.test(operand)) {
      try {
        return this.deps.evaluateMath(operand);
      } catch (error) {
        if (this.deps.shouldDeferExpressionEvaluation()) {
          debug3("function expression deferred until final pass", { operand, error });
          return 0;
        }
        throw error;
      }
    }
    const simpleArithmetic = this.tryResolveSimpleArithmetic(operand);
    if (simpleArithmetic !== null) {
      return simpleArithmetic;
    }
    if (!operand.match(/^[\d$%]/)) {
      if (operand.indexOf(".") !== -1 || operand.indexOf("[") !== -1) {
        if (this.deps.isStructReference(operand)) {
          return this.deps.resolveStructLabel(operand);
        }
        if (!this.isMathExpression(operand)) {
          return this.deps.resolveLabel(operand, false);
        }
      }
      if (/^\w+$/.test(operand) && this.deps.isStructReference(operand)) {
        return this.deps.resolveStructLabel(operand);
      }
      if (/^\w+$/.test(operand)) {
        return this.deps.resolveLabel(operand, false);
      }
    }
    try {
      return this.deps.evaluateMath(operand);
    } catch (error) {
      if (this.deps.shouldDeferExpressionEvaluation()) {
        const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
        debug3("expression deferred until final pass", { operand, error: errorMessage });
        return 0;
      }
      throw error;
    }
  }
  /**
   * Gets num from node.
   * @param {ExpressionNode} operand The operand.
   * @returns {number} The result.
   */
  getnumFromNode(operand) {
    if (isReferenceExpressionNode(operand)) {
      if (operand.type === "defineReference") {
        return this.getnum(this.deps.resolveDefines(renderExpressionNode(operand)));
      }
      const reference = renderReferenceExpressionNode(operand, {
        renderIndex: (node) => this.getnum(node).toString()
      });
      return this.resolveReferenceValue(reference);
    }
    switch (operand.type) {
      case "range":
        throw new Error(
          `Range expression is not a numeric operand: ${renderExpressionNode(operand)}`
        );
      default:
        try {
          return this.deps.evaluateMath(operand);
        } catch (error) {
          if (this.deps.shouldDeferExpressionEvaluation()) {
            const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
            debug3("expression node deferred until final pass", { operand, error: errorMessage });
            return 0;
          }
          throw error;
        }
    }
  }
  /**
   * Resolves reference value.
   * @param {string} reference The reference.
   * @returns {number} The result.
   */
  resolveReferenceValue(reference) {
    if (reference.indexOf(".") !== -1 || reference.indexOf("[") !== -1) {
      if (this.deps.isStructReference(reference)) {
        return this.deps.resolveStructLabel(reference);
      }
      if (!this.isMathExpression(reference)) {
        return this.deps.resolveLabel(reference, false);
      }
    }
    if (/^\w+$/.test(reference)) {
      return this.deps.resolveLabel(reference, false);
    }
    return this.getnum(reference);
  }
  /**
   * Expands operand.
   * @param {string} operand The operand.
   * @returns {ExpandedOperand} The result.
   */
  expandOperand(operand) {
    debug3("expandOperand", operand);
    const raw = operand.trim();
    const syntax = parseOperandSyntax(raw);
    if (!operand) {
      return { raw, expanded: "", length: 2, syntax };
    }
    let expanded = raw;
    let expectedLength = 2;
    if (/^\++$/.test(expanded) || /^-+$/.test(expanded) || expanded === "?+" || expanded === "?-" || /^:(\++|-+)$/.test(expanded)) {
      return { raw, expanded, length: 2, syntax };
    }
    expanded = this.tryResolveLabelInOperand(expanded);
    try {
      expanded = this.deps.resolveDefines(expanded);
    } catch (error) {
      debug3("expandOperand not a define", error);
    }
    if (this.deps.isStructReference(expanded)) {
      expanded = `$${this.deps.resolveStructLabel(expanded).toString(16).toUpperCase()}`;
    }
    expanded = this.normalizeNumericBaseMember(expanded);
    if (expanded.startsWith("#")) {
      const inner = expanded.substring(1).trim();
      if (this.isMathExpression(inner)) {
        try {
          const value = this.getnum(inner);
          expectedLength = this.determineValueLength(value);
          expanded = "#$" + value.toString(16).toUpperCase();
        } catch (error) {
          debug3("failed to evaluate immediate expression", inner, error);
        }
      } else if (inner.startsWith("$")) {
        expectedLength = this.determineValueLength(inner.substring(1));
      } else {
        try {
          const value = this.getnum(inner);
          expectedLength = this.determineValueLength(value);
          expanded = "#$" + value.toString(16).toUpperCase();
        } catch (error) {
          debug3("failed to evaluate immediate expression", inner, error);
        }
      }
    } else if (expanded.includes(",")) {
      if (expanded.startsWith("$")) {
        const hexPart = expanded.substring(1, expanded.indexOf(","));
        expectedLength = this.determineValueLength(hexPart);
      }
    } else if (expanded.startsWith("[") && expanded.endsWith("]")) {
      expectedLength = 2;
    } else if (expanded.startsWith("$")) {
      expectedLength = this.determineValueLength(expanded.substring(1));
    } else {
      expectedLength = 2;
    }
    const isRelativeLabelPlaceholder = /^\++$/.test(expanded) || /^-+$/.test(expanded) || /^:(\++|-+)$/.test(expanded);
    if (!isRelativeLabelPlaceholder && this.isMathExpression(expanded)) {
      try {
        const { expression, suffix } = this.splitMathOperandSuffix(expanded);
        const resolvedValue = this.deps.resolveDefines(expression);
        const result = this.deps.evaluateMath(resolvedValue);
        if (!Number.isNaN(result)) {
          expanded = "$" + result.toString(16).toUpperCase() + suffix;
          expectedLength = this.determineValueLength(result);
        }
      } catch (error) {
        debug3("math evaluation skipped for expression", expanded, error);
      }
    }
    return { raw, expanded, length: expectedLength, syntax };
  }
  /**
   * Lowers operand.
   * @param {string} operand The operand.
   * @returns {LoweredOperand} The result.
   */
  lowerOperand(operand) {
    const raw = operand.trim();
    const expandedOperand = this.expandOperand(raw);
    const { expanded, length } = expandedOperand;
    const syntax = expandedOperand.syntax ?? parseOperandSyntax(raw);
    return {
      mode: "unknown",
      baseExpression: expanded,
      raw,
      expanded,
      length,
      indexRegister: syntax.indexRegister,
      immediate: syntax.immediate,
      indirect: syntax.indirect
    };
  }
  /**
   * Returns the current logical address without applying architecture policy.
   * @returns {number} Current logical address.
   */
  getCurrentAddress() {
    return this.deps.getCurrentAddress();
  }
};

// packages/core/src/architecture-registry.ts
var ArchitectureRegistry = class {
  definitions = /* @__PURE__ */ new Map();
  aliases = /* @__PURE__ */ new Map();
  /**
   * Registers the value.
   * @param {ArchitectureDefinition} definition The definition.
   * @param {string[]} [aliases] The aliases.
   */
  register(definition, aliases = []) {
    const canonical2 = definition.name.toLowerCase();
    this.definitions.set(canonical2, { ...definition, name: canonical2 });
    this.aliases.set(canonical2, canonical2);
    for (const alias of aliases) {
      this.aliases.set(alias.toLowerCase(), canonical2);
    }
  }
  /**
   * Gets canonical name.
   * @param {string} name The name.
   * @returns {string | undefined} The result.
   */
  getCanonicalName(name) {
    return this.aliases.get(name.toLowerCase());
  }
  /**
   * Gets definition.
   * @param {string} name The name.
   * @returns {ArchitectureDefinition | undefined} The result.
   */
  getDefinition(name) {
    const canonical2 = this.getCanonicalName(name);
    if (!canonical2) {
      return void 0;
    }
    return this.definitions.get(canonical2);
  }
  /**
   * Returns editor metadata from the same registered encoder used for builds.
   * @param {string} name Architecture name or alias.
   * @returns {InstructionDescriptor[]} Registered instruction descriptors.
   */
  getInstructionCatalog(name) {
    const definition = this.getDefinition(name);
    return [...definition?.instructions ?? definition?.encoder.getInstructionCatalog?.() ?? []];
  }
};

// packages/core/src/directives/data.ts
var handleDataDirective = ({ runtime }, words) => {
  runtime.handleDataDirective(words[0], words.slice(1));
};
var registerDataDirectives = (registry, context) => {
  registry.register(["db", "dw", "dl", "dd", "dc.b", "dc.w", "dc.l"], context, handleDataDirective);
};

// packages/core/src/directives/fill-pad.ts
var FILL_PATTERN_SIZE = 12;
var PATTERN_WIDTH = {
  fillbyte: 1,
  fillword: 2,
  filllong: 3,
  filldword: 4,
  padbyte: 1,
  padword: 2,
  padlong: 3,
  paddword: 4
};
var patternWidth = (keyword, kind) => {
  if (!keyword.startsWith(kind)) {
    throw new Error(`Unrecognized ${kind} directive.`);
  }
  const width = PATTERN_WIDTH[keyword];
  if (width === void 0) {
    throw new Error(`Unrecognized ${kind} directive.`);
  }
  return width;
};
var writeLittleEndianRepeats = (value, width, dest, length) => {
  const unit = value >>> 0;
  const bytes = [unit & 255, unit >>> 8 & 255, unit >>> 16 & 255, unit >>> 24 & 255];
  for (let i = 0; i < length; i++) {
    dest[i] = bytes[i % width];
  }
};
var resolvePatternValue = ({ session, operandResolver }, words, kind) => {
  const keyword = words[0];
  const width = patternWidth(keyword, kind);
  if (words.length !== 2) {
    throw new Error(`${keyword.toUpperCase()} directive requires exactly one parameter.`);
  }
  return {
    width,
    value: operandResolver.getnum(session.resolvedefines(words[1]))
  };
};
var handleFillPattern = (ctx, words) => {
  const { width, value } = resolvePatternValue(ctx, words, "fill");
  writeLittleEndianRepeats(value, width, ctx.session.fillbyte, FILL_PATTERN_SIZE);
};
var handleFill = ({ session, operandResolver }, words) => {
  if (words.length !== 2) {
    throw new Error("FILL directive requires exactly one parameter (number of bytes to fill).");
  }
  const count = operandResolver.getnum(session.resolvedefines(words[1]));
  for (let i = 0; i < count; i++) {
    session.write1(session.fillbyte[i % FILL_PATTERN_SIZE]);
  }
};
var handlePadPattern = (ctx, words) => {
  const { session } = ctx;
  const { width, value } = resolvePatternValue(ctx, words, "pad");
  session.padUnit = width;
  writeLittleEndianRepeats(value, width, session.padbyte, width);
};
var handlePad = ({ session, operandResolver }, words) => {
  let gap;
  if (words.length === 1) {
    gap = 65536 - (session.currentTargetAddress & 65535);
  } else if (words.length === 2) {
    const targetAddress = operandResolver.getnum(session.resolvedefines(words[1]));
    const targetPC = session.outputWriter.toOutputOffset(targetAddress);
    if (targetPC < 0) {
      throw new Error(`Target address ${targetAddress.toString(16)} does not map to output.`);
    }
    const currentPC = session.outputWriter.toOutputOffset(session.currentTargetAddress);
    if (targetPC <= currentPC) {
      return;
    }
    gap = targetPC - currentPC;
  } else {
    throw new Error("PAD directive accepts zero or one parameter.");
  }
  for (let i = 0; i < gap; i++) {
    session.write1(session.padbyte[i % session.padUnit]);
  }
};
var registerFillPadDirectives = (registry, context) => {
  registry.registerLowered(
    ["fillbyte", "fillword", "filllong", "filldword"],
    context,
    handleFillPattern
  );
  registry.registerLowered("fill", context, handleFill);
  registry.registerLowered(
    ["padbyte", "padword", "padlong", "paddword"],
    context,
    handlePadPattern
  );
  registry.registerLowered("pad", context, handlePad);
};

// packages/core/src/directives/flow-control.ts
var handleRelativeLabel = ({ session }, _words, raw) => {
  session.symbolScope.handleRelativeLabel(raw);
};
var registerFlowControlDirectives = (registry, context) => {
  registry.register(["+", "-"], context, handleRelativeLabel);
};

// packages/core/src/directives/include-source.ts
var IDENTITY_INCLUDE_DEFINES = {
  resolveDefinesInStringLiteral: (content) => content,
  resolveRegularDefines: (content) => content
};
var NUMERIC_INCBIN_TARGET = /^\$[\da-f]+$|^-?\d+$/i;
var expandIncludeFilename = (target, defineEngine) => {
  if (target.length >= 2) {
    const quote = target[0];
    const isQuoted = (quote === '"' || quote === "'" || quote === "`") && target.endsWith(quote);
    if (isQuoted) {
      return `${quote}${defineEngine.resolveDefinesInStringLiteral(target.slice(1, -1))}${quote}`;
    }
  }
  return defineEngine.resolveRegularDefines(target);
};
var resolveIncludeTarget = (words, command, directive2, defineEngine) => {
  const target = command?.parsed.includeTarget?.target ?? words[1];
  if (!target) {
    throw new Error(`${directive2} requires exactly one filename parameter`);
  }
  return expandIncludeFilename(target, defineEngine);
};
var splitIncbinArrow = (words) => {
  const arrowIndex = words.indexOf("->");
  if (arrowIndex === -1) {
    return { sourceWords: words.slice(1), targetLocation: void 0 };
  }
  if (arrowIndex + 1 >= words.length) {
    throw new Error("incbin '->' syntax requires a target location.");
  }
  return {
    sourceWords: words.slice(1, arrowIndex),
    targetLocation: words[arrowIndex + 1]
  };
};
var parseIncbinFilenameAndRange = (filenameWithRange) => {
  const quote = filenameWithRange[0];
  if (quote === '"' || quote === "'" || quote === "`") {
    const endQuote = filenameWithRange.indexOf(quote, 1);
    if (endQuote !== -1) {
      const filename = filenameWithRange.slice(1, endQuote);
      const rest = filenameWithRange.slice(endQuote + 1);
      if (rest.startsWith(":")) {
        return { filename, rangeStr: rest.slice(1) };
      }
      return { filename, rangeStr: void 0 };
    }
  }
  const colonIndex = filenameWithRange.indexOf(":");
  if (colonIndex === -1) {
    return { filename: filenameWithRange, rangeStr: void 0 };
  }
  return {
    filename: filenameWithRange.slice(0, colonIndex),
    rangeStr: filenameWithRange.slice(colonIndex + 1)
  };
};
var applyEofEnd = (startOffset, endOffset, fileLength) => {
  if (endOffset === 0) {
    return { startOffset, endOffset: fileLength };
  }
  return { startOffset, endOffset };
};
var findTopLevelHyphen = (input) => {
  let depth = 0;
  let quote = "";
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if ((char === '"' || char === "'") && input[i - 1] !== "\\") {
      if (quote === char) {
        quote = "";
      } else if (quote === "") {
        quote = char;
      }
      continue;
    }
    if (quote !== "") {
      continue;
    }
    if (char === "(") {
      depth += 1;
      continue;
    }
    if (char === ")") {
      depth -= 1;
      continue;
    }
    if (depth === 0 && char === "-") {
      return i;
    }
  }
  return -1;
};
var assertIncbinMathParensBalanced = (text) => {
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === "(") {
      depth += 1;
      continue;
    }
    if (char === ")") {
      depth -= 1;
      if (depth < 0) {
        throw new Error("Emismatched_parentheses: Mismatched parentheses.");
      }
    }
  }
  if (depth !== 0) {
    throw new Error("Emismatched_parentheses: Mismatched parentheses.");
  }
};
var parseIncbinUnprefixedHex = (text) => {
  const match = text.match(/^([\dA-Fa-f]*)/);
  const digits = match?.[1] ?? "";
  let value = 0;
  if (digits !== "") {
    value = Number.parseInt(digits, 16);
  }
  return { value, rest: text.slice(digits.length) };
};
var parseDeprecatedHyphenIncbinRange = (rangeStr) => {
  let rest = rangeStr;
  let start;
  if (rest.startsWith("(")) {
    const hyphen = findTopLevelHyphen(rest);
    if (hyphen < 1 || rest[hyphen - 1] !== ")") {
      throw new Error(`Invalid range specification: ${rangeStr}`);
    }
    const inner = rest.slice(1, hyphen - 1);
    assertIncbinMathParensBalanced(inner);
    start = inner;
    rest = rest.slice(hyphen);
  } else {
    const parsed = parseIncbinUnprefixedHex(rest);
    start = parsed.value;
    rest = parsed.rest;
  }
  if (!rest.startsWith("-")) {
    throw new Error(`Invalid range specification: ${rangeStr}`);
  }
  rest = rest.slice(1);
  let end;
  if (rest.startsWith("(")) {
    if (!rest.endsWith(")")) {
      throw new Error(`Invalid range specification: ${rangeStr}`);
    }
    const inner = rest.slice(1, -1);
    assertIncbinMathParensBalanced(inner);
    end = inner;
  } else {
    const parsed = parseIncbinUnprefixedHex(rest);
    if (parsed.rest !== "") {
      throw new Error(`Invalid range specification: ${rangeStr}`);
    }
    end = parsed.value;
  }
  return { start, end };
};
var evaluateIncbinRange = (rangeStr, evaluate, fileLength) => {
  if (rangeStr.includes("..")) {
    const parts = rangeStr.split("..");
    if (parts.length !== 2 || parts[0] === "" || parts[1] === "") {
      throw new Error(`Invalid range specification: ${rangeStr}`);
    }
    const rangeNode = parseExpressionNode(rangeStr);
    if (rangeNode.type !== "range") {
      throw new Error(`Invalid range specification: ${rangeStr}`);
    }
    return applyEofEnd(evaluate(rangeNode.start), evaluate(rangeNode.end), fileLength);
  }
  if (rangeStr.includes("-")) {
    const bounds = parseDeprecatedHyphenIncbinRange(rangeStr);
    let startOffset;
    if (typeof bounds.start === "number") {
      startOffset = bounds.start;
    } else {
      startOffset = evaluate(bounds.start);
    }
    let endOffset;
    if (typeof bounds.end === "number") {
      endOffset = bounds.end;
    } else {
      endOffset = evaluate(bounds.end);
    }
    return applyEofEnd(startOffset, endOffset, fileLength);
  }
  throw new Error(`Invalid range specification: ${rangeStr}`);
};
var assertIncbinBounds = (startOffset, endOffset, fileLength, filename, rangeStr) => {
  const rangeHint = rangeStr ? `, range ${rangeStr}` : "";
  if (startOffset < 0 || startOffset > endOffset || startOffset > fileLength) {
    throw new Error(
      `Start offset ${startOffset} out of bounds for file ${filename} (length ${fileLength}${rangeHint})`
    );
  }
  if (endOffset > fileLength) {
    throw new Error(
      `End offset ${endOffset} out of bounds for file ${filename} (length ${fileLength}${rangeHint})`
    );
  }
};
var handleIncbin = ({ session, includeSource, operandResolver, runtime, defineEngine }, words, _raw = "", command) => {
  const { sourceWords, targetLocation } = splitIncbinArrow(words);
  const filenameWithRange = sourceWords.join(" ");
  const { filename: rawFilename, rangeStr } = parseIncbinFilenameAndRange(filenameWithRange);
  const expander = defineEngine ?? IDENTITY_INCLUDE_DEFINES;
  const quote = filenameWithRange[0];
  let filename = rawFilename;
  if (quote === '"' || quote === "'" || quote === "`") {
    filename = expander.resolveDefinesInStringLiteral(rawFilename);
  } else {
    filename = expander.resolveRegularDefines(rawFilename);
  }
  const fileData = includeSource.readFile(filename);
  if (!(fileData instanceof Uint8Array)) {
    throw new Error(`Failed to read file: ${filename}`);
  }
  let startOffset = 0;
  let endOffset = fileData.length;
  const parsedRange = command?.parsed.incbinRange;
  if (parsedRange) {
    ({ startOffset, endOffset } = applyEofEnd(
      session.evaluateRangeExpression(parsedRange.start),
      session.evaluateRangeExpression(parsedRange.end),
      fileData.length
    ));
  } else if (rangeStr) {
    ({ startOffset, endOffset } = evaluateIncbinRange(
      rangeStr,
      (expression) => session.evaluateRangeExpression(expression),
      fileData.length
    ));
  }
  assertIncbinBounds(startOffset, endOffset, fileData.length, filename, rangeStr);
  const incbinData = fileData.subarray(startOffset, endOffset);
  if (targetLocation !== void 0) {
    runtime.handlePushPC();
    let targetAddress;
    if (NUMERIC_INCBIN_TARGET.test(targetLocation)) {
      targetAddress = operandResolver.getnum(targetLocation);
    } else {
      targetAddress = session.symbolScope.getLabelValue(targetLocation, false);
    }
    session.setWritePosition(targetAddress);
  }
  for (let i = 0; i < incbinData.length; i++) {
    session.write1(incbinData[i]);
  }
  if (targetLocation !== void 0) {
    runtime.handlePullPC();
  }
  session.recordCurrentAddress();
};
var handleIncsrc = ({ includeSource, defineEngine }, words, _raw = "", command) => {
  includeSource.assembleFile(
    resolveIncludeTarget(words, command, "incsrc", defineEngine ?? IDENTITY_INCLUDE_DEFINES)
  );
};
var handleInclude = ({ includeSource, defineEngine }, words, _raw = "", command) => {
  includeSource.includeFile(
    resolveIncludeTarget(words, command, "include", defineEngine ?? IDENTITY_INCLUDE_DEFINES)
  );
};
var registerIncludeSourceDirectives = (registry, context) => {
  registry.registerLowered("incsrc", context, handleIncsrc);
  registry.registerLowered("include", context, handleInclude);
  registry.registerLowered("includeonce", context, ({ includeSource }) => {
    includeSource.guardCurrentFile();
  });
  registry.registerLowered("incbin", context, handleIncbin);
};

// packages/core/src/directives/layout.ts
var handlePushBase = ({ session }) => {
  session.pushBaseStack.push(session.currentTargetAddress);
};
var handlePullBase = ({ session }) => {
  if (session.pushBaseStack.length === 0) {
    throw new Error("No base value to pull.");
  }
  const baseAddress = session.pushBaseStack.pop();
  if (baseAddress === void 0) {
    throw new Error("No base value to pull.");
  }
  session.currentTargetAddress = baseAddress;
};
var handleArch = ({ session }, words) => {
  if (!words[1]) {
    throw new Error("ARCH command requires an architecture parameter.");
  }
  const archParam = words[1].toLowerCase();
  const canonical2 = session.architectureRegistry.getCanonicalName(archParam);
  if (!canonical2) {
    if (session.selectArchitecture) {
      session.selectArchitecture(archParam, archParam);
      return;
    }
    throw new Error("Unsupported architecture: " + archParam);
  }
  if (!session.selectArchitecture && session.availableArchitectures && !session.availableArchitectures.has(canonical2)) {
    throw new Error(
      `Architecture ${canonical2} is unavailable for target ${session.targetDisplayName ?? "active target"}.`
    );
  }
  if (session.selectArchitecture) {
    session.selectArchitecture(canonical2, archParam);
  } else {
    session.arch = canonical2;
  }
};
var registerGenericLayoutDirectives = (registry, context) => {
  registry.registerLowered("base", context.base, ({ session, operandResolver }, words) => {
    if (words.length !== 2) {
      throw new Error("BASE directive requires exactly one parameter.");
    }
    const param = words[1].trim();
    if (param.toLowerCase() === "off") {
      const baseAddress = Number(session.currentTargetBaseAddress);
      const baseStartAddress = Number(session.currentTargetBaseStartAddress);
      session.currentTargetAddress = baseAddress;
      session.currentTargetStartAddress = baseStartAddress;
      return;
    }
    const value = operandResolver.getnum(param);
    const addressWidth = session.addressWidth;
    const maxAddress = 2 ** addressWidth - 1;
    if (value < 0 || value > maxAddress) {
      throw new Error(`Invalid base address: ${param}. Must be within ${addressWidth} bits.`);
    }
    session.currentTargetAddress = value;
    session.currentTargetStartAddress = value;
  });
  registry.registerLowered("org", context.org, ({ runtime }, words) => {
    runtime.handleOrg(words.slice(1));
  });
  registry.registerLowered("pushbase", context.addressStack, handlePushBase);
  registry.registerLowered("pullbase", context.addressStack, handlePullBase);
  registry.registerLowered("pushpc", context.runtime, ({ runtime }) => {
    runtime.handlePushPC();
  });
  registry.registerLowered("pullpc", context.runtime, ({ runtime }) => {
    runtime.handlePullPC();
  });
  registry.registerLowered("arch", context.architecture, handleArch);
};
var registerLayoutDirectives = (registry, context) => {
  registerGenericLayoutDirectives(registry, context);
};

// packages/core/src/syntax-profile.ts
var ASAR_SYNTAX_PROFILE = Object.freeze({
  id: "asar",
  preserveLeadingWhitespace: false,
  splitColonStatements: true,
  splitRelativeLabelStatements: true,
  leadingDotLabels: true,
  directivePrefixes: Object.freeze(["@"]),
  cheapLocalPrefix: "",
  fileLocalSymbols: false
});
var NATIVE_SYNTAX_PROFILE = Object.freeze({
  id: "native",
  preserveLeadingWhitespace: true,
  splitColonStatements: false,
  splitRelativeLabelStatements: false,
  leadingDotLabels: true,
  directivePrefixes: Object.freeze([]),
  cheapLocalPrefix: "",
  fileLocalSymbols: false
});
var CA65_SYNTAX_PROFILE = Object.freeze({
  id: "ca65",
  preserveLeadingWhitespace: true,
  splitColonStatements: false,
  splitRelativeLabelStatements: false,
  leadingDotLabels: false,
  directivePrefixes: Object.freeze(["."]),
  cheapLocalPrefix: "@",
  fileLocalSymbols: true
});

// packages/core/src/services/command-text-service.ts
var removeInlineComment = (line, syntaxProfile = ASAR_SYNTAX_PROFILE) => {
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuote = !inQuote;
    } else if (!inQuote && ch === ";") {
      const uncommented = line.substring(0, i);
      return syntaxProfile.preserveLeadingWhitespace ? uncommented.trimEnd() : uncommented.trim();
    }
  }
  return syntaxProfile.preserveLeadingWhitespace ? line.trimEnd() : line.trim();
};
var preprocessBlockCommands = (block, commandBuffer = "", syntaxProfile = ASAR_SYNTAX_PROFILE) => {
  const lines = block.split("\n");
  const sourcedCommands = [];
  let nextCommandBuffer = commandBuffer;
  let bufferStartLine;
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    let line = lines[lineIndex];
    line = syntaxProfile.preserveLeadingWhitespace ? line.trimEnd() : line.trim();
    if (!line.trim()) continue;
    if (line.trimStart().startsWith(";`+")) {
      sourcedCommands.push({ text: line, line: lineIndex });
      continue;
    }
    line = removeInlineComment(line, syntaxProfile);
    if (!line.trim()) continue;
    if (line.endsWith("\\")) {
      if (nextCommandBuffer === "") {
        bufferStartLine = lineIndex;
      }
      nextCommandBuffer += line.slice(0, -1);
    } else if (line.endsWith(",")) {
      if (nextCommandBuffer === "") {
        bufferStartLine = lineIndex;
      }
      nextCommandBuffer += line;
    } else {
      sourcedCommands.push({
        text: nextCommandBuffer + line,
        line: nextCommandBuffer === "" ? lineIndex : bufferStartLine ?? lineIndex
      });
      nextCommandBuffer = "";
      bufferStartLine = void 0;
    }
  }
  return {
    commands: sourcedCommands.map((command) => command.text),
    sourcedCommands,
    commandBuffer: nextCommandBuffer
  };
};
var splitOnInlineStatementSeparator = (command) => {
  const parts = [];
  let current = "";
  let quote = "";
  for (let i = 0; i < command.length; i++) {
    const char = command[i];
    if ((char === '"' || char === "'") && command[i - 1] !== "\\") {
      if (quote === char) {
        quote = "";
      } else if (quote === "") {
        quote = char;
      }
      current += char;
      continue;
    }
    const next = command[i + 1];
    const after = command[i + 2];
    if (quote === "" && /\s/.test(char) && next === ":" && /\s/.test(after ?? "")) {
      const trimmed2 = current.trim();
      if (trimmed2 !== "") {
        parts.push(trimmed2);
      }
      current = "";
      i += 2;
      continue;
    }
    current += char;
  }
  const trimmed = current.trim();
  if (trimmed !== "") {
    parts.push(trimmed);
  }
  return parts;
};
var splitInlineCommands = (commands, syntaxProfile = ASAR_SYNTAX_PROFILE) => {
  const output = [];
  for (const command of commands) {
    const split = syntaxProfile.splitColonStatements ? splitOnInlineStatementSeparator(command) : [command];
    if (split.length === 0) {
      continue;
    }
    for (const entry of split) {
      const relativeLabelMatch = syntaxProfile.splitRelativeLabelStatements ? entry.match(/^([+-]+:)\s+(.+)$/) : null;
      if (relativeLabelMatch) {
        output.push(relativeLabelMatch[1].trim(), relativeLabelMatch[2].trim());
        continue;
      }
      output.push(entry);
    }
  }
  return output;
};
var splitSourcedInlineCommands = (commands, syntaxProfile = ASAR_SYNTAX_PROFILE) => {
  const output = [];
  for (const command of commands) {
    for (const text of splitInlineCommands([command.text], syntaxProfile)) {
      output.push({ text, line: command.line });
    }
  }
  return output;
};
var splitCommandIntoWords = (command) => {
  const words = [];
  let currentWord = "";
  let inQuotes = false;
  let quoteChar = "";
  const trimmedCommand = command.trim();
  for (let i = 0; i < trimmedCommand.length; i++) {
    const char = trimmedCommand[i];
    if ((char === '"' || char === "'") && (i === 0 || trimmedCommand[i - 1] !== "\\")) {
      if (!inQuotes) {
        inQuotes = true;
        quoteChar = char;
        currentWord += char;
      } else if (char === quoteChar) {
        inQuotes = false;
        currentWord += char;
      } else {
        currentWord += char;
      }
    } else if (/\s/.test(char) && !inQuotes) {
      if (currentWord) {
        words.push(currentWord);
        currentWord = "";
      }
    } else {
      currentWord += char;
    }
  }
  if (currentWord) {
    words.push(currentWord);
  }
  return words;
};
var splitRespectingFunctions = (input) => {
  const result = [];
  let current = "";
  let parenDepth = 0;
  let inQuotes = false;
  let quoteChar = "";
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if ((char === '"' || char === "'") && (i === 0 || input[i - 1] !== "\\")) {
      if (!inQuotes) {
        inQuotes = true;
        quoteChar = char;
      } else if (char === quoteChar) {
        inQuotes = false;
      }
    }
    if (!inQuotes) {
      if (char === "(") {
        parenDepth++;
      } else if (char === ")") {
        parenDepth--;
      } else if (char === "," && parenDepth === 0) {
        result.push(current.trim());
        current = "";
        continue;
      }
    }
    current += char;
  }
  if (current) {
    result.push(current.trim());
  }
  return result;
};
var getDefineVariable = (line) => {
  const match = line.trim().match(/^!([A-Z_a-z]\w*)\s*=/);
  return match ? match[1] : void 0;
};
function isLabelIdentifierStart(char) {
  const code = char.charCodeAt(0);
  return char === "_" || code >= 65 && code <= 90 || code >= 97 && code <= 122;
}
function isLabelIdentifierPart(char) {
  const code = char.charCodeAt(0);
  return char === "_" || code >= 48 && code <= 57 || code >= 65 && code <= 90 || code >= 97 && code <= 122;
}
function isBareLabelReference(input) {
  if (!input) {
    return false;
  }
  if (/^(a|x|y|ya|sp|s|c|r\d{1,2})$/i.test(input)) {
    return false;
  }
  let numericOnly = true;
  for (const char of input) {
    if (char < "0" || char > "9") {
      numericOnly = false;
      break;
    }
  }
  if (numericOnly) {
    return true;
  }
  let index = 0;
  while (input[index] === ".") {
    index += 1;
  }
  if (index >= input.length || !isLabelIdentifierStart(input[index])) {
    return false;
  }
  const consumeIdentifier = () => {
    if (index >= input.length || !isLabelIdentifierStart(input[index])) {
      return false;
    }
    index += 1;
    while (index < input.length && isLabelIdentifierPart(input[index])) {
      index += 1;
    }
    return true;
  };
  if (!consumeIdentifier()) {
    return false;
  }
  while (index < input.length && input[index] === ".") {
    index += 1;
    if (!consumeIdentifier()) {
      return false;
    }
  }
  if (index < input.length && input[index] === "[") {
    index += 1;
    const digitStart = index;
    while (index < input.length && input[index] >= "0" && input[index] <= "9") {
      index += 1;
    }
    if (digitStart === index || input[index] !== "]") {
      return false;
    }
    index += 1;
    while (index < input.length && input[index] === ".") {
      index += 1;
      if (!consumeIdentifier()) {
        return false;
      }
    }
  }
  return index === input.length;
}

// packages/core/src/directives/misc.ts
var handlePullTable = ({ session }) => {
  if (session.tableStack.length === 0) {
    throw new Error("pulltable without pushtable");
  }
  session.characterMappings = session.tableStack.pop();
};
var handlePushTable = ({ session }) => {
  session.tableStack.push(new Map(session.characterMappings));
};
var stripLeadingKeyword = (raw, keyword) => {
  const trimmed = raw.trim();
  let rest = trimmed;
  if (rest.startsWith("@")) {
    rest = rest.slice(1);
  }
  if (rest.length < keyword.length) {
    return "";
  }
  if (rest.slice(0, keyword.length).toLowerCase() !== keyword) {
    return trimmed;
  }
  return rest.slice(keyword.length).trim();
};
var unwrapQuoted = (fragment) => {
  const text = fragment.trim();
  if (text.length < 2) {
    return text;
  }
  const quote = text[0];
  if ((quote === '"' || quote === "'") && text.endsWith(quote)) {
    return text.slice(1, -1);
  }
  return text;
};
var formatPrintArgs = (parts) => {
  let out = "";
  for (const part of parts) {
    out += unwrapQuoted(part);
  }
  return out;
};
var handleAssert = ({ session }, _words, raw) => {
  const payload = stripLeadingKeyword(raw, "assert");
  const parts = splitRespectingFunctions(payload);
  const condition = parts[0] ?? "";
  if (condition === "") {
    throw new Error("Broken conditional: assert");
  }
  if (session.evaluateExpression(condition)) {
    return;
  }
  const messageParts = parts.slice(1);
  if (messageParts.length === 0) {
    throw new Error("Assertion failed.");
  }
  throw new Error(`Assertion failed: ${formatPrintArgs(messageParts)}`);
};
var handleError = (_ctx, _words, raw) => {
  const payload = stripLeadingKeyword(raw, "error");
  if (payload === "") {
    throw new Error("error command.");
  }
  throw new Error(`error command: ${formatPrintArgs(splitRespectingFunctions(payload))}`);
};
var hex6 = (value) => (value >>> 0).toString(16).toUpperCase().padStart(6, "0");
var invalidTableLine = (lineNumber) => new Error(`Invalid table file: line ${lineNumber}`);
var parseAsarTableLine = (line, rtl, lineNumber) => {
  if (line.length === 0) {
    return void 0;
  }
  if (line.length < 4 || (line.length & 1) !== 0 || line.length > 10) {
    throw invalidTableLine(lineNumber);
  }
  if (rtl) {
    if (line[1] === "x" || line[1] === "X") {
      throw invalidTableLine(lineNumber);
    }
    const eq = line.indexOf("=");
    if (eq < 1 || eq !== line.length - 2) {
      throw invalidTableLine(lineNumber);
    }
    const hex2 = line.slice(0, eq);
    if (!/^[\dA-Fa-f]+$/.test(hex2)) {
      throw invalidTableLine(lineNumber);
    }
    return { char: line[eq + 1], value: Number.parseInt(hex2, 16) };
  }
  if (line[1] !== "=" || line[3] === "x" || line[3] === "X") {
    throw invalidTableLine(lineNumber);
  }
  const hex = line.slice(2);
  if (!/^[\dA-Fa-f]+$/.test(hex)) {
    throw invalidTableLine(lineNumber);
  }
  return { char: line[0], value: Number.parseInt(hex, 16) };
};
var handleClearTable = ({ session }) => {
  session.characterMappings.clear();
  session.currentTable = null;
};
var handleTable = ({ session }, _words, raw) => {
  let payload = stripLeadingKeyword(raw, "table");
  let rtl = false;
  if (/,\s*rtl\s*$/i.test(payload)) {
    rtl = true;
    payload = payload.replace(/,\s*rtl\s*$/i, "").trim();
  } else if (/,\s*ltr\s*$/i.test(payload)) {
    payload = payload.replace(/,\s*ltr\s*$/i, "").trim();
  }
  const filename = unwrapQuoted(payload);
  if (filename === "") {
    throw new Error("table requires a filename");
  }
  const contents = session.includeSource.readFile(filename, "utf8");
  if (typeof contents !== "string") {
    throw new Error(`Error reading file: ${filename}`);
  }
  session.characterMappings.clear();
  session.currentTable = filename;
  const lines = contents.split("\n");
  for (let index = 0; index < lines.length; index++) {
    let line = lines[index];
    if (line.endsWith("\r")) {
      line = line.slice(0, -1);
    }
    const parsed = parseAsarTableLine(line, rtl, index + 1);
    if (!parsed) {
      continue;
    }
    session.characterMappings.set(parsed.char, parsed.value);
  }
};
var handleWarnpc = ({ session }, _words, raw) => {
  const payload = stripLeadingKeyword(raw, "warnpc");
  if (payload === "") {
    throw new Error("warnpc requires an address");
  }
  const maxpos = session.operandResolver.getnum(session.resolvedefines(payload));
  if (session.currentTargetAddress > maxpos) {
    throw new Error(
      `warnpc failed: Current pc = $${hex6(session.currentTargetAddress)}, wanted <= $${hex6(maxpos)}`
    );
  }
};
var registerMiscDirectives = (registry, context, enabledGroups = /* @__PURE__ */ new Set(["table", "diagnostic"])) => {
  if (enabledGroups.has("table")) {
    registry.registerLowered("pulltable", context.table, handlePullTable);
    registry.registerLowered("pushtable", context.table, handlePushTable);
    registry.registerLowered("cleartable", context.table, handleClearTable);
    registry.registerLowered("table", context.table, handleTable);
  }
  if (enabledGroups.has("diagnostic")) {
    registry.registerLowered("assert", context.diagnostic, handleAssert);
    registry.registerLowered("error", context.diagnostic, handleError);
    registry.registerLowered("warnpc", context.diagnostic, handleWarnpc);
  }
};

// packages/core/src/directives/namespace.ts
var handlePushNamespace = ({ session }) => {
  session.namespaceStack.push(session.currentNamespace);
  if (session.namespaceNestingEnabled) {
    session.namespaceStack.push(JSON.stringify(session.namespaceNestingPath));
  }
};
var handlePullNamespace = ({ session }) => {
  if (session.namespaceStack.length === 0) {
    throw new Error("pullns without pushns");
  }
  if (session.namespaceNestingEnabled) {
    const pathJson = session.namespaceStack.pop();
    const parsedPath = JSON.parse(pathJson ?? "[]");
    session.namespaceNestingPath = Array.isArray(parsedPath) && parsedPath.every((entry) => typeof entry === "string") ? parsedPath : [];
  }
  session.currentNamespace = session.namespaceStack.pop() ?? "";
};
var handleNamespace = ({ session }, words) => {
  const params = words.slice(1);
  if (params.length >= 2 && params[0].toLowerCase() === "nested") {
    const action2 = params[1].toLowerCase();
    if (action2 === "on") {
      session.namespaceNestingEnabled = true;
      return;
    } else if (action2 === "off") {
      session.namespaceNestingEnabled = false;
      session.namespaceNestingPath = [];
      session.currentNamespace = "";
      return;
    }
  }
  if (params.length === 0) {
    if (session.namespaceNestingEnabled) {
      session.namespaceNestingPath = [];
    }
    session.currentNamespace = "";
    return;
  }
  if (params.length === 1 && params[0].toLowerCase() === "off") {
    if (session.namespaceNestingEnabled) {
      session.namespaceNestingPath.pop();
      session.currentNamespace = session.namespaceNestingPath.join("_");
    } else {
      session.currentNamespace = "";
    }
    return;
  } else if (params.length === 1) {
    enterNamespace(session, params[0]);
    return;
  }
  const action = params[1].toLowerCase();
  if (action === "off") {
    if (session.namespaceNestingEnabled) {
      session.namespaceNestingPath.pop();
      session.currentNamespace = session.namespaceNestingPath.join("_");
    } else {
      session.currentNamespace = "";
    }
  } else {
    enterNamespace(session, params[0]);
  }
};
function enterNamespace(session, name) {
  if (session.namespaceNestingEnabled) {
    session.namespaceNestingPath.push(name);
    session.currentNamespace = session.namespaceNestingPath.join("_");
  } else {
    session.currentNamespace = name;
  }
  const parent = session.namespaceNestingEnabled && session.namespaceNestingPath.length > 1 ? session.namespaceNestingPath.slice(0, -1).join("_") : void 0;
  session.recordSymbolDefinition("namespace", session.currentNamespace, {
    containerName: parent || void 0
  });
}
var registerNamespaceDirectives = (registry, context) => {
  registry.registerLowered("namespace", context, handleNamespace);
  registry.registerLowered("pushns", context, handlePushNamespace);
  registry.registerLowered("pullns", context, handlePullNamespace);
};

// packages/core/src/directives/struct-binary.ts
var registerStructBinaryDirectives = (registry, context) => {
  registry.register("struct", context, ({ session }, words) => {
    session.structEngine.handleStruct(words);
  });
  registry.register("endstruct", context, ({ session }, words) => {
    session.structEngine.handleEndStruct(words);
  });
};

// packages/core/src/directives/registry.ts
var DirectiveRegistry = class {
  constructor(directivePrefixes = []) {
    this.directivePrefixes = directivePrefixes;
  }
  directivePrefixes;
  handlers = /* @__PURE__ */ new Map();
  phases = /* @__PURE__ */ new Map();
  /**
   * Registers the value.
   * @param {string | string[]} keyword The keyword.
   * @param {Context} context The context.
   * @param {NarrowDirectiveHandler<Context>} handler The handler.
   * @param {DirectiveExecutionPhase} [phase] The directive execution phase.
   */
  register(keyword, context, handler, phase = "preprocess") {
    const keywords = Array.isArray(keyword) ? keyword : [keyword];
    for (const entry of keywords) {
      this.handlers.set(entry, (words, raw, command) => handler(context, words, raw, command));
      this.phases.set(entry, phase);
    }
  }
  /**
   * Registers a directive that can execute from durable lowered command data.
   * @param {string | string[]} keyword The directive keyword or aliases.
   * @param {Context} context The handler context.
   * @param {NarrowDirectiveHandler<Context>} handler The handler.
   */
  registerLowered(keyword, context, handler) {
    this.register(keyword, context, handler, "lowered");
  }
  /**
   * Checks whether it has the value.
   * @param {string} keyword The keyword.
   * @returns {boolean} The result.
   */
  has(keyword) {
    return this.lookup(keyword) !== void 0;
  }
  /**
   * Dispatches the value.
   * @param {string} keyword The keyword.
   * @param {readonly string[]} words The words.
   * @param {string} raw The raw.
   * @param {NormalizedCommand} [command] The command.
   * @returns {boolean} The result.
   */
  dispatch(keyword, words, raw, command) {
    const handler = this.lookup(keyword);
    if (!handler) {
      return false;
    }
    handler(words, raw, command);
    return true;
  }
  /**
   * Resolves a directive handler using prefixes supplied by the active syntax profile.
   * @param {string} keyword The directive keyword.
   * @returns {BoundDirectiveHandler | undefined} The handler, if registered.
   */
  lookup(keyword) {
    const direct = this.handlers.get(keyword);
    if (direct) {
      return direct;
    }
    for (const prefix of this.directivePrefixes) {
      if (keyword.startsWith(prefix)) {
        return this.handlers.get(keyword.slice(prefix.length));
      }
    }
    return void 0;
  }
  /**
   * Resolves the execution phase declared alongside a directive handler.
   * @param {string} keyword The directive keyword.
   * @returns {DirectiveExecutionPhase | undefined} The active directive phase.
   */
  getPhase(keyword) {
    const direct = this.phases.get(keyword);
    if (direct) {
      return direct;
    }
    for (const prefix of this.directivePrefixes) {
      if (keyword.startsWith(prefix)) {
        return this.phases.get(keyword.slice(prefix.length));
      }
    }
    return void 0;
  }
};
var createDirectiveRegistry = (contexts, enabledGroups = CORE_DIRECTIVE_GROUPS, directivePrefixes = []) => {
  const registry = new DirectiveRegistry(directivePrefixes);
  const enabled = new Set(enabledGroups);
  if (enabled.has("include")) registerIncludeSourceDirectives(registry, contexts.includeSource);
  if (enabled.has("memory")) registerFillPadDirectives(registry, contexts.fillPad);
  if (enabled.has("control")) registerFlowControlDirectives(registry, contexts.flowControl);
  if (enabled.has("namespace")) registerNamespaceDirectives(registry, contexts.namespace);
  if (enabled.has("layout")) registerLayoutDirectives(registry, contexts.layout);
  if (enabled.has("data")) registerDataDirectives(registry, contexts.data);
  if (enabled.has("struct")) registerStructBinaryDirectives(registry, contexts.struct);
  if (enabled.has("table") || enabled.has("diagnostic")) {
    registerMiscDirectives(
      registry,
      {
        table: contexts.table,
        diagnostic: contexts.diagnostic
      },
      enabled
    );
  }
  return registry;
};

// packages/core/src/services/define-engine.ts
var DefineEngine = class {
  constructor(host) {
    this.host = host;
  }
  host;
  /**
   * Checks whether pure math expression.
   * @param {string} value The value.
   * @returns {boolean} The result.
   */
  isPureMathExpression(value) {
    return /^\s*(?:\$[\dA-Fa-f]+|%[01]+|\d+|[&()*+/<>^|-]|\s)+$/.test(value);
  }
  /**
   * Handles a define command.
   * @param {NormalizedCommand} commandNode The command node to handle.
   * @returns {boolean} `true` if the command was handled, `false` otherwise.
   */
  handleCommand(commandNode) {
    const command = commandNode.command;
    const trimmedCommand = command.trim();
    if (commandNode.keyword.toLowerCase() === "undef") {
      this.handleDefineCommand(trimmedCommand);
      setCommandKind(commandNode, "defineCommand");
      return true;
    }
    if (!trimmedCommand.startsWith("!")) {
      return false;
    }
    if (command.includes("=")) {
      this.handleDefineCommand(command);
      setCommandKind(commandNode, "defineCommand");
      return true;
    }
    if (trimmedCommand.startsWith("!{")) {
      const processedCommand = this.processValueWithBracedDefines(trimmedCommand);
      this.host.processCommand(processedCommand);
      setCommandKind(commandNode, "defineCommand");
      return true;
    }
    const defineName = trimmedCommand.substring(1);
    if (!this.host.defines.has(defineName)) {
      throw new Error(`Error: Define '${defineName}' not found.`);
    }
    this.host.processCommand(this.host.defines.get(defineName) ?? "");
    setCommandKind(commandNode, "defineCommand");
    return true;
  }
  /**
   * Handles a define command.
   * @param {string} command The command to handle.
   * @example
   * !identifier = value // Basic assignment
   * !identifier += value // Append to existing value
   * !identifier := value // Resolve defines in the value
   * !identifier #= value // Evaluate as math expression
   * !identifier ?= value // Only assign if not already defined
   * undef identifier // Remove a define
   * undef "identifier" // Remove a define
   */
  handleDefineCommand(command) {
    const trimmedCommand = command.trim();
    if (trimmedCommand.toLowerCase().startsWith("undef")) {
      this.applyUndefOperation(trimmedCommand);
      return;
    }
    const line = command.substring(1).trim();
    if (line.startsWith("{")) {
      let braceLevel = 1;
      let closingBraceIndex = 1;
      while (braceLevel > 0 && closingBraceIndex < line.length) {
        if (line[closingBraceIndex] === "{") braceLevel++;
        if (line[closingBraceIndex] === "}") braceLevel--;
        closingBraceIndex++;
      }
      if (braceLevel !== 0) {
        throw new Error(`Mismatched braces in define: ${command}`);
      }
      const nestedContent = line.substring(1, closingBraceIndex - 1);
      const resolvedIdentifier = this.processNestedDefines(nestedContent);
      const restOfLine = line.substring(closingBraceIndex).trim();
      const operatorMatch = restOfLine.match(/^\s*(=|\+=|:=|#=|\?=)\s*(.*)$/);
      if (!operatorMatch) {
        throw new Error(`Invalid define syntax after braces: ${command}`);
      }
      this.applyDefineOperation(resolvedIdentifier, operatorMatch[1], operatorMatch[2].trim());
      return;
    }
    const match = line.match(/^(\w+)\s*(=|\+=|:=|#=|\?=)\s*(.*)$/);
    if (!match) {
      throw new Error(`Invalid define syntax: ${command}`);
    }
    this.applyDefineOperation(match[1], match[2], match[3].trim());
  }
  /**
   * Resolves nested defines in a string.
   * @param {string} content The content to process.
   * @returns {string} The processed content with nested defines resolved.
   */
  processNestedDefines(content) {
    if (!content.includes("!")) {
      return content;
    }
    let prevResult = "";
    let result = content;
    let iterations = 0;
    const maxIterations = 10;
    while (prevResult !== result && iterations < maxIterations) {
      iterations++;
      prevResult = result;
      result = this.resolveOneLevelOfDefines(result);
    }
    return result;
  }
  /**
   * Resolves one level of defines in a string.
   * @param {string} content The content to process.
   * @returns {string} The processed content with one level of defines resolved.
   */
  resolveOneLevelOfDefines(content) {
    const openBracePositions = [];
    for (let i = 0; i < content.length - 1; i++) {
      if (content.substring(i, i + 2) === "!{") {
        openBracePositions.push(i);
        i++;
      }
    }
    if (openBracePositions.length === 0) {
      return this.resolveRegularDefines(content);
    }
    const lastOpenBracePos = openBracePositions[openBracePositions.length - 1];
    let nestLevel = 1;
    let closingBracePos = -1;
    for (let i = lastOpenBracePos + 2; i < content.length; i++) {
      if (i < content.length - 1 && content.substring(i, i + 2) === "!{") {
        nestLevel++;
        i++;
      } else if (content[i] === "}") {
        nestLevel--;
        if (nestLevel === 0) {
          closingBracePos = i;
          break;
        }
      }
    }
    if (closingBracePos === -1) {
      throw new Error(`Mismatched braces in content: ${content}`);
    }
    const braceContent = content.substring(lastOpenBracePos + 2, closingBracePos);
    if (braceContent.includes("!{")) {
      const resolvedInnerContent = this.resolveOneLevelOfDefines(braceContent);
      return content.substring(0, lastOpenBracePos + 2) + resolvedInnerContent + content.substring(closingBracePos);
    }
    const replacement = this.host.defines.has(braceContent) ? this.host.defines.get(braceContent) ?? braceContent : braceContent;
    return content.substring(0, lastOpenBracePos) + replacement + content.substring(closingBracePos + 1);
  }
  /**
   * Resolves regular defines in a string.
   * @param {string} content The content to process.
   * @returns {string} The processed content with regular defines resolved.
   */
  resolveRegularDefines(content) {
    let result = "";
    let index = 0;
    let foundDefine = false;
    while (index < content.length) {
      if (content.substring(index).startsWith("!") && index + 1 < content.length && /\w/.test(content[index + 1])) {
        index++;
        let defineName = "";
        while (index < content.length && /\w/.test(content[index])) {
          defineName += content[index++];
        }
        if (this.host.defines.has(defineName)) {
          result += this.host.defines.get(defineName);
          foundDefine = true;
        } else {
          throw new Error(`Define '${defineName}' not found.`);
        }
      } else {
        result += content[index++];
      }
    }
    return foundDefine ? result : content;
  }
  /**
   * Resolves defines in a string literal.
   * @param {string} content The content to process.
   * @returns {string} The processed content with defines in string literal resolved.
   */
  resolveDefinesInStringLiteral(content) {
    let result = "";
    let index = 0;
    while (index < content.length) {
      const char = content[index];
      if (char === "\\") {
        const next = content[index + 1];
        if (next === void 0) {
          result += "\\";
          index++;
          continue;
        }
        if (next === "!") {
          result += "!";
          index += 2;
          while (index < content.length && /\w/.test(content[index])) {
            result += content[index];
            index++;
          }
          continue;
        }
        if (next === "\\") {
          result += "\\";
          index += 2;
          continue;
        }
        result += next;
        index += 2;
        continue;
      }
      if (char === "!" && index + 1 < content.length && /\w/.test(content[index + 1])) {
        index++;
        let defineName = "";
        while (index < content.length && /\w/.test(content[index])) {
          defineName += content[index];
          index++;
        }
        if (!this.host.defines.has(defineName)) {
          throw new Error(`Define '${defineName}' not found.`);
        }
        result += this.host.defines.get(defineName);
        continue;
      }
      result += char;
      index++;
    }
    return result;
  }
  /**
   * Processes a value with braced defines.
   * @param {string} value The value to process.
   * @returns {string} The processed value with braced defines resolved.
   */
  processValueWithBracedDefines(value) {
    let result = "";
    let index = 0;
    while (index < value.length) {
      if (value.substring(index).startsWith("!{")) {
        let braceContent = "";
        index += 2;
        let braceLevel = 1;
        while (index < value.length && braceLevel > 0) {
          if (value[index] === "{") braceLevel++;
          else if (value[index] === "}") braceLevel--;
          if (braceLevel === 0) break;
          braceContent += value[index];
          index++;
        }
        if (braceLevel !== 0) {
          throw new Error(`Mismatched braces in value: ${value}`);
        }
        index++;
        const resolvedIdentifier = this.processNestedDefines(braceContent);
        result += `!{${resolvedIdentifier}}`;
      } else {
        result += value[index++];
      }
    }
    return result;
  }
  /**
   * Applies a define operation.
   * @param {string} identifier The identifier to apply the operation to.
   * @param {string} operator The operator to apply.
   * @param {string} initialValue The initial value to apply the operation to.
   */
  applyDefineOperation(identifier, operator, initialValue) {
    let value = initialValue;
    if (value.includes("!{")) {
      if (!value.includes("FF") && !value.includes("$")) {
        value = this.processNestedDefines(value);
      } else {
        value = this.processValueWithBracedDefines(value);
      }
    }
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    }
    if (operator === ":=") {
      value = this.host.resolvedefines(value);
    }
    if (operator === "#=") {
      value = this.host.resolvedefines(value);
      const result = this.host.mathCore.math(value);
      if (Number.isNaN(result)) {
        throw new Error(`Math evaluation failed in define "#=" for expression: ${value}`);
      }
      value = result.toString();
    }
    if (operator === "?=" && this.host.defines.has(identifier)) {
      return;
    }
    if (operator === "+=") {
      value = (this.host.defines.get(identifier) || "") + value;
    }
    if (operator !== "#=" && (value.includes("+") || value.includes("-") || value.includes("*") || value.includes("/") || value.includes("&") || value.includes("|") || value.includes("^") || value.includes("<<") || value.includes(">>") || value.includes("("))) {
      try {
        const resolvedValue = this.host.resolvedefines(value);
        if (this.isPureMathExpression(resolvedValue)) {
          const result = this.host.mathCore.math(resolvedValue);
          if (!Number.isNaN(result)) {
            value = `$${result.toString(16).toUpperCase()}`;
          }
        }
      } catch {
      }
    }
    this.host.defines.set(identifier, value);
    this.host.recordSymbolDefinition("define", identifier, {
      value,
      containerName: this.host.currentNamespace || void 0
    });
  }
  /**
   * Applies an `undef` operation.
   * @param {string} command The normalized undef command.
   */
  applyUndefOperation(command) {
    const match = command.match(/^undef\s+(.+)$/i);
    if (!match) {
      throw new Error("undef requires exactly one identifier parameter");
    }
    const raw = match[1].trim();
    const unquoted = raw.startsWith('"') && raw.endsWith('"') ? raw.slice(1, -1) : raw;
    const identifier = unquoted.startsWith("!") ? unquoted.slice(1) : unquoted;
    if (!identifier) {
      throw new Error("undef requires a non-empty identifier");
    }
    this.host.defines.delete(identifier);
  }
};

// packages/core/src/services/directive-runtime-service.ts
var DirectiveRuntimeService = class {
  constructor(host) {
    this.host = host;
  }
  host;
  /**
   * Handles character mapping like `"A" = 0x42` and assigns the value to the character in `characterMappings`.
   * @param {string[]} words The character mapping command words.
   * @throws {Error} If the format is incorrect.
   */
  handleCharacterMapping(words) {
    if (words.length !== 3) {
      throw new Error("Character mapping requires format: 'char' = value");
    }
    const token = words[0];
    const quoted = /^'([\S\s])'$/.exec(token) ?? /^"([\S\s])"$/.exec(token);
    const char = quoted ? quoted[1] : token.replace(/["']/g, "");
    if (char.length !== 1) {
      throw new Error("Character mapping requires format: 'char' = value");
    }
    const value = this.host.operandResolver.getnum(words[2]);
    this.host.characterMappings.set(char, value);
  }
  /**
   * Processes a string and maps characters to their corresponding values in `characterMappings`.
   * If a character is not found in `characterMappings`, its charCode is used instead.
   * @param {string} input The string to process.
   * @returns {number[]} An array of numbers representing the mapped characters.
   */
  processStringWithMapping(input) {
    return Array.from(input).map(
      (char) => this.host.characterMappings.get(char) ?? char.charCodeAt(0)
    );
  }
  /**
   * Handles `org`.
   * @param {string[]} params The directive parameters.
   */
  handleOrg(params) {
    if (params.length !== 1) {
      throw new Error("ORG requires a single address parameter.");
    }
    const addressStr = params[0].trim();
    let addr;
    if (/^\$[\da-f]+$/i.test(addressStr)) {
      addr = parseInt(addressStr.substring(1), 16);
    } else if (/^-?\d+$/.test(addressStr)) {
      addr = parseInt(addressStr, 10);
    } else {
      try {
        addr = this.host.operandResolver.deps.evaluateMath(this.host.resolvedefines(addressStr));
      } catch {
        throw new Error(`Invalid ORG address: ${params[0]}`);
      }
    }
    const maxAddress = 2 ** this.host.addressWidth - 1;
    if (Number.isNaN(addr) || addr < 0 || addr > maxAddress) {
      throw new Error(`Invalid ORG address: ${params[0]}`);
    }
    this.host.setWritePosition(addr);
  }
  /**
   * Handles data directives.
   * @param {string} type The data directive keyword.
   * @param {string[]} params The directive parameters.
   */
  handleDataDirective(type, params) {
    if (!Array.isArray(params) || params.length === 0) {
      throw new Error(`${type.toUpperCase()} directive requires at least one parameter.`);
    }
    if (type.toLowerCase() === "dc.b") {
      type = "db";
    } else if (type.toLowerCase() === "dc.w") {
      type = "dw";
    } else if (type.toLowerCase() === "dc.l") {
      type = "dl";
    }
    const lengthMap = {
      db: 1,
      dw: 2,
      dl: 3,
      dd: 4
    };
    const len = lengthMap[type.toLowerCase()];
    if (!len) {
      throw new Error(`Invalid data directive: ${type}`);
    }
    if (this.host.isDefinitionCollectionStage) {
      this.estimateDataDirectiveSize(len, params);
      return;
    }
    const pendingValues = splitRespectingFunctions(params.join(" "));
    while (pendingValues.length > 0) {
      let value = (pendingValues.shift() ?? "").trim();
      if (value.startsWith('"') || value.startsWith("'")) {
        const unquoted = value.slice(1, -1);
        const expandedString = this.host.defineEngine.resolveDefinesInStringLiteral(unquoted);
        const mappedChars = this.processStringWithMapping(expandedString);
        for (const charValue of mappedChars) {
          this.writeDataByLength(len, charValue);
        }
        continue;
      }
      if (value.startsWith("#")) {
        value = value.substring(1);
      }
      let resolved = value;
      let previousResolved = "";
      while (resolved !== previousResolved) {
        previousResolved = resolved;
        resolved = this.host.resolvedefines(resolved);
      }
      const expandedValues = splitRespectingFunctions(resolved);
      if (expandedValues.length > 1) {
        pendingValues.unshift(...expandedValues);
        continue;
      }
      let num;
      if (this.host.structEngine.hasStructReference(resolved)) {
        const structValue = this.host.structEngine.resolveStructLabel(resolved);
        if (typeof structValue === "number" && !Number.isNaN(structValue)) {
          this.writeDataByLength(len, structValue);
          continue;
        }
        num = structValue;
      } else {
        num = this.host.operandResolver.getnum(resolved);
      }
      if (Number.isNaN(num)) {
        num = this.host.symbolScope.getLabelValue(resolved, true);
      }
      if (Number.isNaN(num)) {
        throw new Error("Unable to determine value:");
      }
      this.writeDataByLength(len, num);
    }
    if (this.host.collectSourceMetadata) {
      this.host.addAddressToLine(
        normalizeAddressForWidth(this.host.currentTargetBaseAddress, this.host.addressWidth)
      );
    }
  }
  /**
   * Writes a value using the data directive byte width.
   * @param {number} len The byte width.
   * @param {number} value The value to write.
   */
  writeDataByLength(len, value) {
    if (typeof len !== "number") {
      len = Number.parseInt(len, 10);
      if (Number.isNaN(len)) {
        throw new Error("writeDataByLength: len is NaN");
      }
    }
    switch (len) {
      case 1:
        this.host.write1(value);
        break;
      case 2:
        this.host.write2(value);
        break;
      case 3:
        this.host.write3(value);
        break;
      case 4:
        this.host.write4(value);
        break;
      default:
        throw new Error(`Unsupported data length ${len}`);
    }
  }
  /**
   * Estimates data directive size.
   * @param {number} len The len.
   * @param {string[]} params The params.
   */
  estimateDataDirectiveSize(len, params) {
    const pendingValues = [...splitRespectingFunctions(params.join(" "))];
    let estimatedItems = 0;
    while (pendingValues.length > 0) {
      let value = (pendingValues.shift() ?? "").trim();
      if (!value) {
        continue;
      }
      if (value.startsWith('"') || value.startsWith("'")) {
        const unquoted = value.slice(1, -1);
        try {
          estimatedItems += this.host.defineEngine.resolveDefinesInStringLiteral(unquoted).length;
        } catch {
          estimatedItems += unquoted.length;
        }
        continue;
      }
      if (value.startsWith("#")) {
        value = value.substring(1);
      }
      let resolved = value;
      let previousResolved = "";
      try {
        while (resolved !== previousResolved) {
          previousResolved = resolved;
          resolved = this.host.resolvedefines(resolved);
        }
      } catch {
      }
      const expandedValues = splitRespectingFunctions(resolved);
      if (expandedValues.length > 1) {
        pendingValues.unshift(...expandedValues);
        continue;
      }
      estimatedItems += 1;
    }
    this.host.step(estimatedItems * len);
    if (this.host.collectSourceMetadata) {
      this.host.addAddressToLine(
        normalizeAddressForWidth(this.host.currentTargetBaseAddress, this.host.addressWidth)
      );
    }
  }
  /**
   * Pushes the current PC state.
   */
  handlePushPC() {
    if (this.host.pushpcnum >= 256) {
      throw new Error("PushPC stack overflow.");
    }
    this.host.pushpcStack.push({
      currentTargetAddress: this.host.currentTargetAddress,
      currentTargetStartAddress: this.host.currentTargetStartAddress,
      currentTargetBaseAddress: this.host.currentTargetBaseAddress,
      currentTargetBaseStartAddress: this.host.currentTargetBaseStartAddress
    });
    this.host.pushpcnum++;
  }
  /**
   * Restores the previous PC state.
   */
  handlePullPC() {
    if (this.host.pushpcnum === 0) {
      throw new Error("PullPC without PushPC.");
    }
    const state = this.host.pushpcStack.pop();
    if (state) {
      this.host.currentTargetAddress = state.currentTargetAddress;
      this.host.currentTargetStartAddress = state.currentTargetStartAddress;
      this.host.currentTargetBaseAddress = state.currentTargetBaseAddress;
      this.host.currentTargetBaseStartAddress = state.currentTargetBaseStartAddress;
    }
    this.host.pushpcnum--;
  }
};

// packages/core/src/services/program-model-builder.ts
var ProgramModelBuilder = class {
  constructor(host) {
    this.host = host;
  }
  host;
  /**
   * Creates an incremental parser state for line-by-line assembly.
   * @returns {IncrementalProgramParseState} The parser state.
   */
  createIncrementalParseState() {
    return {
      roots: [],
      loopStack: [],
      ifStack: [],
      branchStack: [],
      inMacroDefinition: false,
      inFunctionDefinition: false
    };
  }
  /**
   * Resets an incremental parser state in place.
   * @param {IncrementalProgramParseState} state The parser state.
   */
  resetIncrementalParseState(state) {
    state.roots.length = 0;
    state.loopStack.length = 0;
    state.ifStack.length = 0;
    state.branchStack.length = 0;
    state.inMacroDefinition = false;
    state.inFunctionDefinition = false;
  }
  /**
   * Builds a program model from raw source text.
   * @param {string} source The source block to parse.
   * @param {string} [sourceFile] Optional source file override.
   * @param {number} [startLine] Optional starting line number.
   * @returns {ProgramModel} The parsed program model.
   */
  buildProgramModel(source, sourceFile = this.host.currentFile, startLine = 0) {
    const commands = this.host.splitSourcedInlineCommands(
      this.host.preprocessSourcedBlockCommands(source)
    );
    return {
      sourceFile,
      startLine,
      nodes: this.getOrBuildPassProgram(commands, sourceFile, startLine)
    };
  }
  /**
   * Creates a typed include node from a source file body.
   * @param {string} file The include file name.
   * @param {string} source The include source content.
   * @returns {IncludeProgramNode} The include node.
   */
  createIncludeNode(file, source) {
    const commands = this.host.splitSourcedInlineCommands(
      this.host.preprocessSourcedBlockCommands(source)
    );
    return {
      type: "include",
      file,
      commands: this.getOrBuildPassProgram(commands, file, 0)
    };
  }
  /**
   * Returns cached executable nodes for a command stream.
   * @param {Array<string | SourcedCommand>} commands The command stream.
   * @param {string} [sourceFile] Optional source file override.
   * @param {number} [startLine] Optional starting line number.
   * @returns {ExecutableNode[]} The cached or parsed nodes.
   */
  getOrBuildPassProgram(commands, sourceFile = this.host.currentFile, startLine = this.host.currentLine) {
    const cacheKey = `${sourceFile}::${startLine}::${commandStreamKey(commands)}`;
    const cached = this.host.passProgramCache.get(cacheKey);
    if (cached) {
      incrementInternalCounter("passProgramCacheHits");
      return cached;
    }
    incrementInternalCounter("passProgramCacheMisses");
    const nodes = this.parseCommandStreamToNodes(commands, sourceFile, startLine);
    this.host.passProgramCache.set(cacheKey, nodes);
    recordInternalCounterPeak("passProgramCachePeakSize", this.host.passProgramCache.size);
    return nodes;
  }
  /**
   * Consumes one raw command into an incremental parse state and returns newly
   * completed top-level executable nodes.
   * @param {IncrementalProgramParseState} state The parser state.
   * @param {string} rawCommand The raw command to consume.
   * @param {string} [sourceFile] Optional source file override.
   * @param {number} [sourceLine] Optional source line override.
   * @returns {ExecutableNode[]} Newly completed top-level nodes.
   */
  consumeIncrementalCommand(state, rawCommand, sourceFile = this.host.currentFile, sourceLine = this.host.currentLine) {
    this.consumeCommandIntoState(state, rawCommand, sourceFile, sourceLine);
    return this.drainCompletedRoots(state);
  }
  /**
   * Parses a flat command stream into nested executable nodes.
   * @param {Array<string | SourcedCommand>} commands The command stream.
   * @param {string} [sourceFile] Optional source file override.
   * @param {number} [startLine] Optional starting line number.
   * @returns {ExecutableNode[]} The executable nodes.
   */
  parseCommandStreamToNodes(commands, sourceFile = this.host.currentFile, startLine = this.host.currentLine) {
    const state = this.createIncrementalParseState();
    for (let index = 0; index < commands.length; index++) {
      const command = commands[index];
      const text = typeof command === "string" ? command : command.text;
      const sourceLine = typeof command === "string" ? startLine + index : startLine + command.line;
      this.consumeCommandIntoState(state, text, sourceFile, sourceLine);
    }
    return state.roots;
  }
  /**
   * Pushes to current.
   * @param {IncrementalProgramParseState} state The state.
   * @param {ExecutableNode} node The node.
   */
  pushToCurrent(state, node) {
    const currentBranch = state.branchStack[state.branchStack.length - 1];
    const currentLoop = state.loopStack[state.loopStack.length - 1];
    if (currentBranch && currentLoop) {
      if (currentLoop.startLine >= currentBranch.startLine) {
        currentLoop.commands.push(node);
      } else {
        currentBranch.commands.push(node);
      }
      return;
    }
    if (currentBranch) {
      currentBranch.commands.push(node);
      return;
    }
    if (currentLoop) {
      currentLoop.commands.push(node);
      return;
    }
    state.roots.push(node);
  }
  /**
   * Consumes command into state.
   * @param {IncrementalProgramParseState} state The state.
   * @param {string} rawCommand The raw command.
   * @param {string} sourceFile The source file.
   * @param {number} sourceLine The source line.
   */
  consumeCommandIntoState(state, rawCommand, sourceFile, sourceLine) {
    const command = this.host.createLoopCommandNode(rawCommand, sourceFile, sourceLine);
    const keyword = command.keyword.toLowerCase();
    if (keyword === "macro") {
      state.inMacroDefinition = true;
      this.pushToCurrent(state, command);
      return;
    }
    if (state.inMacroDefinition) {
      setCommandKind(command, "macroDefinitionOrInvoke");
      this.pushToCurrent(state, command);
      if (keyword === "endmacro") {
        state.inMacroDefinition = false;
      }
      return;
    }
    if (state.inFunctionDefinition) {
      setCommandKind(command, "functionDefinition");
      this.pushToCurrent(state, command);
      state.inFunctionDefinition = command.command.trimEnd().endsWith("\\");
      return;
    }
    const functionSource = command.parsed.labelSplit?.trailing ?? command.command;
    if (functionSource.toLowerCase().startsWith("function")) {
      setCommandKind(command, "functionDefinition");
      this.pushToCurrent(state, command);
      state.inFunctionDefinition = functionSource.trimEnd().endsWith("\\");
      return;
    }
    if (keyword === "for" || keyword === "while") {
      const loopNode = {
        type: keyword,
        header: command,
        conditionNode: keyword === "while" ? command.parsed.condition?.expression : command.parsed.forLoop?.range,
        variable: command.parsed.forLoop?.variable,
        rangeNode: command.parsed.forLoop?.range,
        startExpression: command.parsed.forLoop?.start,
        endExpression: command.parsed.forLoop?.end,
        commands: [],
        startLine: command.source.line
      };
      this.pushToCurrent(state, loopNode);
      state.loopStack.push(loopNode);
      return;
    }
    if (keyword === "endfor" || keyword === "endwhile") {
      const loopNode = state.loopStack.pop();
      if (loopNode) {
        loopNode.endLine = command.source.line;
      }
      return;
    }
    if (keyword === "if") {
      const branch2 = {
        kind: "if",
        header: command,
        conditionNode: command.parsed.condition?.expression,
        commands: [],
        startLine: command.source.line
      };
      const conditionalNode = {
        type: "if",
        header: command,
        branches: [branch2],
        startLine: command.source.line
      };
      this.pushToCurrent(state, conditionalNode);
      state.ifStack.push(conditionalNode);
      state.branchStack.push(branch2);
      return;
    }
    if (keyword === "elseif" || keyword === "else") {
      const currentIf = state.ifStack[state.ifStack.length - 1];
      if (!currentIf) {
        this.pushToCurrent(state, command);
        return;
      }
      if (state.branchStack.length > 0) {
        const closedBranch = state.branchStack.pop();
        if (closedBranch) {
          closedBranch.endLine = command.source.line;
        }
      }
      const branch2 = {
        kind: keyword,
        header: command,
        conditionNode: keyword === "elseif" ? command.parsed.condition?.expression : void 0,
        commands: [],
        startLine: command.source.line
      };
      currentIf.branches.push(branch2);
      state.branchStack.push(branch2);
      return;
    }
    if (keyword === "endif") {
      const currentIf = state.ifStack[state.ifStack.length - 1];
      const currentLoop = state.loopStack[state.loopStack.length - 1];
      const whileIsInnermost = this.host.shouldEndifCloseInnermostWhile(
        currentLoop?.type,
        currentLoop?.startLine,
        currentIf?.startLine
      );
      if (whileIsInnermost) {
        const loopNode = state.loopStack.pop();
        if (loopNode) {
          loopNode.endLine = command.source.line;
        }
        return;
      }
      if (state.branchStack.length > 0) {
        const closedBranch = state.branchStack.pop();
        if (closedBranch) {
          closedBranch.endLine = command.source.line;
        }
      }
      if (currentIf) {
        state.ifStack.pop();
        currentIf.endLine = command.source.line;
      }
      return;
    }
    this.pushToCurrent(state, command);
  }
  /**
   * Checks whether node complete.
   * @param {ExecutableNode} node The node.
   * @returns {boolean} The result.
   */
  isNodeComplete(node) {
    if ("source" in node) {
      return true;
    }
    return node.endLine !== void 0;
  }
  /**
   * Drains completed roots.
   * @param {IncrementalProgramParseState} state The state.
   * @returns {ExecutableNode[]} The result.
   */
  drainCompletedRoots(state) {
    let completedCount = 0;
    while (completedCount < state.roots.length && this.isNodeComplete(state.roots[completedCount])) {
      completedCount++;
    }
    const ready = state.roots.slice(0, completedCount);
    state.roots = state.roots.slice(completedCount);
    return ready;
  }
};
function commandStreamKey(commands) {
  return commands.map((command) => typeof command === "string" ? command : `${command.line}:${command.text}`).join("\n");
}

// packages/core/src/services/assembly-front-end-service.ts
var AssemblyFrontEndService = class {
  constructor(host) {
    this.host = host;
    this.programModelBuilder = new ProgramModelBuilder({
      currentFile: this.host.currentFile,
      currentLine: this.host.currentLine,
      passProgramCache: this.host.passProgramCache,
      preprocessBlockCommands: (source) => this.preprocessBlockCommands(source),
      splitInlineCommands: (commands) => this.splitInlineCommands(commands),
      preprocessSourcedBlockCommands: (source) => this.preprocessSourcedBlockCommands(source),
      splitSourcedInlineCommands: (commands) => this.splitSourcedInlineCommands(commands),
      createLoopCommandNode: (command, sourceFile, sourceLine) => this.createLoopCommandNode(command, sourceFile, sourceLine),
      shouldEndifCloseInnermostWhile: (loopType, loopStartLine, ifStartLine) => this.host.shouldEndifCloseInnermostWhile(loopType, loopStartLine, ifStartLine)
    });
  }
  host;
  commandBuffer = "";
  programModelBuilder;
  /**
   * Preprocesses raw source blocks while preserving continued-line buffering.
   * @param {string} block The raw source block.
   * @returns {string[]} The normalized commands.
   */
  preprocessBlockCommands(block) {
    return this.preprocessSourcedBlockCommands(block).map((command) => command.text);
  }
  /**
   * Preprocesses raw source blocks, tagging each command with its original line.
   * @param {string} block The raw source block.
   * @returns {SourcedCommand[]} The normalized sourced commands.
   */
  preprocessSourcedBlockCommands(block) {
    const processed = preprocessBlockCommands(block, this.commandBuffer, this.host.syntaxProfile);
    this.commandBuffer = processed.commandBuffer;
    return processed.sourcedCommands;
  }
  /**
   * Splits statements according to the active target's source grammar.
   * @param {string[]} commands Commands to split.
   * @returns {string[]} Profile-aware command statements.
   */
  splitInlineCommands(commands) {
    return splitInlineCommands(commands, this.host.syntaxProfile);
  }
  /**
   * Splits sourced statements according to the active target's source grammar.
   * @param {SourcedCommand[]} commands Sourced commands to split.
   * @returns {SourcedCommand[]} Profile-aware sourced command statements.
   */
  splitSourcedInlineCommands(commands) {
    return splitSourcedInlineCommands(commands, this.host.syntaxProfile);
  }
  /**
   * Builds a normalized command from raw source text.
   * @param {string} command The raw command text.
   * @param {string} sourceFile The command source file.
   * @param {number} sourceLine The source line number.
   * @param {boolean} [allowEmpty] When true, empty commands still produce nodes.
   * @returns {NormalizedCommand | null} The normalized command or null for empty input.
   */
  createNormalizedCommandFromRaw(command, sourceFile, sourceLine, allowEmpty = false) {
    let normalizedCommand = removeInlineComment(command, this.host.syntaxProfile);
    normalizedCommand = this.host.syntaxProfile.rewriteCommand?.(normalizedCommand, {
      sourceFile,
      sourceLine
    }) ?? normalizedCommand;
    if (this.host.inMacroExpansion && !this.host.isDefinitionCollectionStage && (normalizedCommand.includes("...") || normalizedCommand.includes("\u2026"))) {
      normalizedCommand = this.host.resolveVariadicPlaceholders(normalizedCommand);
    }
    const words = splitCommandIntoWords(normalizedCommand);
    if (!allowEmpty && words.length === 0) {
      return null;
    }
    return createNormalizedCommand(
      command,
      normalizedCommand,
      words,
      sourceFile,
      sourceLine,
      this.host.collectSourceMetadata
    );
  }
  /**
   * Creates a loop-aware normalized command node for the typed parser.
   * @param {string} command The raw command text.
   * @param {string} [sourceFile] Optional source file.
   * @param {number} [sourceLine] Optional source line.
   * @returns {NormalizedCommand} The normalized node.
   */
  createLoopCommandNode(command, sourceFile = this.host.currentFile, sourceLine = this.host.currentLine) {
    return this.createNormalizedCommandFromRaw(command, sourceFile, sourceLine, true) ?? createNormalizedCommand(
      command,
      "",
      [],
      sourceFile,
      sourceLine,
      this.host.collectSourceMetadata
    );
  }
};

// packages/core/src/services/command-lowering-service.ts
var CommandLoweringService = class {
  host;
  constructor(host) {
    this.host = host;
  }
  /**
   * Lowers a normalized command into the execution-layer representation.
   * @param {NormalizedCommand} command The normalized command node.
   * @returns {LoweredCommand} The lowered execution work unit.
   */
  lowerCommand(command) {
    const keyword = this.host.canonicalizeDirectiveKeyword(command.keyword);
    if (this.host.directiveRegistry.has(keyword)) {
      let directiveWords = command.words;
      if (command.parsed.includeTarget && command.parsed.includeTarget.directive !== "incbin") {
        directiveWords = [
          command.parsed.includeTarget.directive,
          command.parsed.includeTarget.target
        ];
      }
      return {
        kind: "directive",
        keyword,
        words: directiveWords,
        source: command.source,
        command
      };
    }
    const architecture = this.host.resolveActiveArchitecture();
    const parsedOperands = command.parsed.opcodeOperands;
    const mnemonic = parsedOperands?.mnemonic ?? command.keyword;
    const operandText = parsedOperands?.operandText ?? command.words.slice(1).join(" ");
    const operands = parsedOperands?.operands ?? architecture.definition?.splitOperands(operandText) ?? (operandText ? [operandText] : []);
    const loweredOperands = operands.map(
      (operand) => this.host.classifyOperandForActiveArchitecture(operand)
    );
    const loweredOperand = this.host.classifyOperandForActiveArchitecture(operandText);
    return {
      kind: "instruction",
      command,
      mnemonic,
      operandText,
      operands,
      loweredOperands,
      loweredOperand,
      words: command.words,
      sourceFile: command.source.file,
      sourceLine: command.source.line,
      sourceRaw: command.source.raw
    };
  }
  /**
   * Lowers an executable tree node into a durable execution-layer node.
   * Commands retain their immutable front-end snapshots. Legacy preprocessing
   * creates its mutable execution copy at dispatch time, avoiding a redundant
   * clone for every stage-owned lowered node.
   * @param {ExecutableNode} node The node to lower.
   * @returns {LoweredExecutableNode} The lowered node.
   */
  lowerExecutableNode(node) {
    incrementInternalCounter("runtimeNodesLowered");
    if ("source" in node) {
      if (this.shouldPreserveCommand(node)) {
        return {
          kind: "command",
          command: node,
          source: node.source,
          passthroughReason: this.getPassthroughReason(node) ?? "unknown"
        };
      }
      return this.lowerCommand(node);
    }
    if (node.type === "for" || node.type === "while") {
      return {
        kind: "loop",
        loopType: node.type,
        header: node.header,
        conditionNode: node.conditionNode,
        rangeNode: node.rangeNode,
        variable: node.variable,
        start: node.start,
        end: node.end,
        startExpression: node.startExpression,
        endExpression: node.endExpression,
        commands: node.commands.map((command) => this.lowerExecutableNode(command)),
        startLine: node.startLine,
        endLine: node.endLine
      };
    }
    if (node.type !== "if") {
      throw new Error(`Unknown executable node type: ${String(node.type)}`);
    }
    const conditionalNode = node;
    return {
      kind: "conditional",
      header: conditionalNode.header,
      branches: conditionalNode.branches.map((branch2) => ({
        kind: branch2.kind,
        header: branch2.header,
        conditionNode: branch2.conditionNode,
        commands: branch2.commands.map((command) => this.lowerExecutableNode(command)),
        startLine: branch2.startLine,
        endLine: branch2.endLine
      })),
      startLine: conditionalNode.startLine,
      endLine: conditionalNode.endLine
    };
  }
  /**
   * Lowers a full program model into a stage-owned execution program.
   * @param {ProgramModel} program The program to lower.
   * @returns {LoweredProgram} The lowered program.
   */
  lowerProgram(program) {
    incrementInternalCounter("loweredProgramBuilds");
    return {
      sourceFile: program.sourceFile,
      startLine: program.startLine,
      nodes: program.nodes.map((node) => this.lowerExecutableNode(node))
    };
  }
  /**
   * Commands that still require legacy preprocess / control handlers must remain
   * as command snapshots rather than direct lowered directives. Dispatch clones
   * these snapshots before running the mutable legacy preprocessing pipeline.
   * @param {NormalizedCommand} command The command to inspect.
   * @returns {boolean} True when the command should stay in passthrough form.
   */
  shouldPreserveCommand(command) {
    return this.getPassthroughReason(command) !== void 0;
  }
  /**
   * Names the ordered preprocessing requirement that prevents direct lowering.
   * @param {NormalizedCommand} command The command to inspect.
   * @returns {PassthroughReason | undefined} The reason, or undefined when direct lowering is safe.
   */
  getPassthroughReason(command) {
    const keyword = this.host.canonicalizeDirectiveKeyword(command.keyword);
    if (/<[^>]+>/.test(command.command)) {
      return "macroPlaceholder";
    }
    if (command.kind !== "unknown" && command.kind !== "opcodeCandidate" && command.kind !== "directive") {
      return command.kind;
    }
    if (this.host.syntaxProfile.bareMacroInvocations && command.kind === "opcodeCandidate") {
      return "bareMacroCandidate";
    }
    if (this.host.directiveRegistry.has(keyword)) {
      if (this.host.directiveRegistry.getPhase(keyword) === "lowered") {
        return void 0;
      }
      if (command.parsed.dataDirective) {
        return "dataDirective";
      }
      return "registeredPreprocessDirective";
    }
    return command.kind === "opcodeCandidate" ? void 0 : "unknown";
  }
};

// packages/core/src/services/front-end-command-service.ts
var FrontEndCommandService = class {
  constructor(host) {
    this.host = host;
  }
  host;
  /**
   * Continues a function definition.
   * @param {string} command The command to continue.
   * @returns {boolean} `true` if the command was handled, `false` otherwise.
   */
  continueFunctionDefinition(command) {
    if (!this.host.inFunctionDefinition) {
      return false;
    }
    if (command.trimEnd().endsWith("\\")) {
      this.host.functionDefinitionLines.push(command.trimEnd().slice(0, -1));
    } else {
      this.host.functionDefinitionLines.push(command.trim());
      const fullDefinition = this.host.functionDefinitionLines.join(" ");
      this.host.functionDefinitionLines = [];
      this.host.inFunctionDefinition = false;
      this.host.parseFunctionDefinition(fullDefinition);
    }
    return true;
  }
  /**
   * Starts a function definition.
   * @param {NormalizedCommand} command The command to start.
   * @returns {boolean} `true` if the command was handled, `false` otherwise.
   */
  startFunctionDefinition(command) {
    const functionSource = command.parsed.labelSplit?.trailing ?? command.command;
    if (!functionSource || !functionSource.toLowerCase().startsWith("function")) {
      return false;
    }
    if (functionSource.trimEnd().endsWith("\\")) {
      this.host.inFunctionDefinition = true;
      this.host.functionDefinitionLines.push(functionSource.trimEnd().slice(0, -1));
    } else {
      this.host.parseFunctionDefinition(functionSource.trim());
    }
    setCommandKind(command, "directive");
    return true;
  }
  /**
   * Handles a relative label definition.
   * @param {NormalizedCommand} command The command to handle.
   * @returns {boolean} `true` if the command was handled, `false` otherwise.
   */
  handleRelativeLabelDefinition(command) {
    const { keyword } = command;
    const isUnnamedLabelDefinition = keyword === ":";
    const isRelativeLabelDefinition = isUnnamedLabelDefinition || /^\++:?$/.test(keyword) || /^-+:?$/.test(keyword);
    if (!isRelativeLabelDefinition) {
      return false;
    }
    let relativeLabel = keyword;
    if (isUnnamedLabelDefinition) {
      relativeLabel = ":";
    } else if (keyword.endsWith(":")) {
      relativeLabel = keyword.slice(0, -1);
    }
    if (isUnnamedLabelDefinition) {
      this.host.symbolScope.handleUnnamedLabel();
    } else {
      this.host.symbolScope.handleRelativeLabel(relativeLabel);
    }
    this.host.recordCurrentAddress();
    this.host.recordSymbolDefinition("label", relativeLabel, {
      span: command.source.tokenSpans[0] ?? command.source.normalizedSpan
    });
    command.labelName = relativeLabel;
    setCommandKind(command, "labelDefinition");
    if (isUnnamedLabelDefinition && command.words.length > 1) {
      this.host.processCommand(command.words.slice(1).join(" "));
    }
    return true;
  }
  /**
   * Handles a global label definition.
   * @param {NormalizedCommand} command The command to handle.
   * @returns {boolean} `true` if the command was handled, `false` otherwise.
   */
  handleGlobalLabel(command) {
    const { words } = command;
    const directiveArgs = command.parsed.directiveArgs;
    if ((directiveArgs?.name ?? words[0] ?? "").toLowerCase() !== "global") {
      return false;
    }
    const payload = directiveArgs?.args?.join(",").split(/\s+/).filter(Boolean) ?? words.slice(1);
    if (payload.length < 1) {
      throw new Error("global requires a label name");
    }
    const labelDecl = payload[0];
    const modifiesHierarchy = labelDecl.startsWith("#");
    const labelName = modifiesHierarchy ? labelDecl.substring(1) : labelDecl;
    const hasColon = labelName.endsWith(":");
    const cleanName = hasColon ? labelName.slice(0, -1) : labelName;
    this.host.symbolScope.setLabel(cleanName, void 0, false, false, true, !modifiesHierarchy);
    if (!modifiesHierarchy) {
      this.host.currentParentLabel = cleanName;
      this.host.currentParentIsGlobal = true;
      this.host.currentGlobalParentLabel = cleanName;
    }
    if (payload.length > 1) {
      this.host.processCommand(payload.slice(1).join(" "));
    }
    this.host.recordSymbolDefinition("label", cleanName, {
      span: command.source.tokenSpans[0] ?? command.source.normalizedSpan
    });
    command.labelName = cleanName;
    setCommandKind(command, "labelDefinition");
    return true;
  }
  /**
   * Consumes named label definitions.
   * @param {NormalizedCommand} command The command to consume.
   * @returns {boolean} `true` if the command was handled, `false` otherwise.
   */
  consumeNamedLabelDefinitions(command) {
    const remainingWords = [...command.words];
    let keyword = remainingWords[0] ?? command.keyword;
    let consumed = false;
    let consumedCount = 0;
    while (remainingWords.length > 0 && this.host.isNamedLabelToken(keyword)) {
      const labelName = keyword.endsWith(":") ? keyword.slice(0, -1) : keyword;
      const namespace = this.host.currentNamespace;
      const dotCount = labelName.startsWith(".") ? labelName.match(/^\.*/)?.[0]?.length ?? 1 : 0;
      const containerName = dotCount > 0 ? this.host.symbolScope.getScopedParentLabel(dotCount) || void 0 : namespace || void 0;
      this.host.symbolScope.handleLabelDefinition(labelName);
      this.host.recordSymbolDefinition("label", labelName, {
        span: command.source.tokenSpans[consumedCount] ?? command.source.tokenSpans[0] ?? command.source.normalizedSpan,
        containerName
      });
      remainingWords.shift();
      consumedCount++;
      keyword = remainingWords[0] ?? "";
      consumed = true;
    }
    setCommandWords(command, remainingWords);
    if (consumed && remainingWords.length === 0) {
      setCommandKind(command, "labelDefinition");
    }
    return remainingWords.length === 0;
  }
  /**
   * Handles a static label assignment.
   * @param {NormalizedCommand} command The command to handle.
   * @returns {boolean} `true` if the command was handled, `false` otherwise.
   */
  handleStaticLabelAssignment(command) {
    const { words, keyword } = command;
    if (words.length !== 3 || words[1] !== "=" && words[1] !== ":=") {
      return false;
    }
    const assignment = command.parsed.assignment;
    const labelName = assignment?.target ?? keyword;
    const expr = assignment ? renderExpressionNode(assignment.expression) : words[2];
    const resolvedExpr = this.host.resolvedefines(expr);
    let value = this.host.mathCore.math(assignment?.expression ?? resolvedExpr);
    if (Number.isNaN(value)) {
      value = this.host.symbolScope.getLabelValue(resolvedExpr, true);
    }
    const assignedName = this.host.symbolScope.qualifySymbolName(labelName);
    this.host.symbolScope.setLabel(assignedName, value, true);
    this.host.recordCurrentAddress();
    this.host.recordSymbolDefinition("label", assignedName, {
      span: command.source.tokenSpans[0] ?? command.source.normalizedSpan,
      value,
      containerName: this.host.currentNamespace || void 0
    });
    command.assignmentTarget = assignedName;
    setCommandKind(command, "staticAssignment");
    return true;
  }
};

// packages/core/src/services/include-source-service.ts
var IncludeSourceService = class {
  constructor(host) {
    this.host = host;
  }
  host;
  resolvedPathCache = /* @__PURE__ */ new Map();
  textCache = /* @__PURE__ */ new Map();
  /**
   * Starts a new assembly file snapshot and drops content retained by an older build.
   */
  beginAssemblySnapshot() {
    this.resolvedPathCache.clear();
    this.textCache.clear();
  }
  /**
   * Releases source text retained for the completed assembly.
   */
  endAssemblySnapshot() {
    this.beginAssemblySnapshot();
  }
  /**
   * Reads a source-relative binary or text file.
   * @param {string} filePath The path to read.
   * @param {BufferEncoding} [encoding] Optional text encoding.
   * @returns {Uint8Array | string} The file contents.
   */
  readFile(filePath, encoding) {
    try {
      const fullPath = this.resolvePath(filePath);
      if (!fullPath) {
        throw new Error(`Error reading file: ${filePath}`);
      }
      if (encoding) {
        return this.readTextFile(fullPath, encoding);
      }
      return this.host.fileProvider.readFile(fullPath);
    } catch {
      throw new Error(`Error reading file: ${filePath}`);
    }
  }
  /**
   * Resolves a source include target.
   * @param {string} filename The target filename.
   * @returns {string} The resolved provider path.
   */
  resolveIncludePath(filename) {
    if (filename == null) {
      throw new Error("Invalid or missing filename");
    }
    const resolved = this.resolvePath(filename);
    if (!resolved) {
      throw new Error(`Could not find file: ${filename}`);
    }
    return resolved;
  }
  /**
   * Marks and assembles an `include` target.
   * @param {string} filename The target filename.
   */
  includeFile(filename) {
    const resolvedPath = this.resolveIncludePath(filename);
    if (!this.host.includedFiles.has(resolvedPath)) {
      this.host.includedFiles.set(resolvedPath, { included: true, guarded: false });
    }
    this.assembleFile(filename);
  }
  /**
   * Guards the active source file against later includes in this pass.
   */
  guardCurrentFile() {
    const fileInfo = this.host.includedFiles.get(this.host.currentFile) ?? {
      included: true,
      guarded: false
    };
    fileInfo.guarded = true;
    this.host.includedFiles.set(this.host.currentFile, fileInfo);
  }
  /**
   * Clears pass-local include guards.
   */
  resetGuards() {
    for (const [filePath, fileInfo] of this.host.includedFiles.entries()) {
      fileInfo.guarded = false;
      this.host.includedFiles.set(filePath, fileInfo);
    }
  }
  /**
   * Resolves, parses, lowers, and executes one source file.
   * @param {string} filename The target filename.
   */
  assembleFile(filename) {
    const resolvedPath = this.resolveIncludePath(filename);
    const fileInfo = this.host.includedFiles.get(resolvedPath);
    if (fileInfo?.guarded) {
      return;
    }
    if (this.host.includeStack.length >= 512) {
      throw new Error("Recursion limit exceeded (512 levels)");
    }
    if (resolvedPath === this.host.currentFile || this.host.includeStack.includes(resolvedPath)) {
      throw new Error(`Recursive include detected for '${resolvedPath}'`);
    }
    const previousFile = this.host.currentFile;
    this.host.includeStack.push(previousFile);
    this.host.recordIncludeEdge(previousFile, resolvedPath);
    if (this.host.followIncludes === false) {
      this.host.includeStack.pop();
      return;
    }
    try {
      const content = this.readTextFile(resolvedPath, "utf8");
      this.host.currentFile = resolvedPath;
      const includedFile = this.host.includedFiles.get(resolvedPath);
      if (includedFile) {
        includedFile.included = true;
        this.host.includedFiles.set(resolvedPath, includedFile);
      } else {
        this.host.includedFiles.set(resolvedPath, { included: true, guarded: false });
      }
      measureInternalPhase("includeParseLowerExecute", () => {
        const includeNode = this.host.programModelBuilder.createIncludeNode(resolvedPath, content);
        this.host.lowerAndExecuteRuntimeNodes(includeNode.commands);
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : JSON.stringify(error) ?? "Unknown error";
      throw new Error(`Failed to assemble include '${resolvedPath}': ${message}`);
    } finally {
      this.host.currentFile = this.host.includeStack.pop() ?? "";
    }
  }
  get resolutionOptions() {
    return {
      currentFile: this.host.currentFile,
      includePaths: this.host.includePaths,
      macroSourceFile: this.host.currentMacroSourceFile
    };
  }
  /**
   * Resolves a path once for the active source and include-path context.
   * @param {string} filePath The source-relative path to resolve.
   * @returns {string | undefined} The resolved provider path.
   */
  resolvePath(filePath) {
    const options = this.resolutionOptions;
    const key = [
      options.currentFile,
      options.macroSourceFile ?? "",
      options.includePaths.join("\0"),
      filePath
    ].join("");
    const cached = this.resolvedPathCache.get(key);
    if (cached !== void 0) {
      incrementInternalCounter("includeResolutionCacheHits");
      return cached;
    }
    const resolved = this.host.fileProvider.resolvePath(filePath, options);
    if (resolved !== void 0) {
      this.resolvedPathCache.set(key, resolved);
    }
    return resolved;
  }
  /**
   * Reads source text once per assembly snapshot.
   * @param {string} resolvedPath The resolved provider path.
   * @param {BufferEncoding} encoding The requested text encoding.
   * @returns {string} The cached or newly read text.
   */
  readTextFile(resolvedPath, encoding) {
    const key = `${encoding}\0${resolvedPath}`;
    const cached = this.textCache.get(key);
    if (cached !== void 0) {
      incrementInternalCounter("includeTextCacheHits");
      return cached;
    }
    incrementInternalCounter("includeReads");
    const content = measureInternalPhase(
      "includeRead",
      () => this.host.fileProvider.readTextFile(resolvedPath, encoding)
    );
    incrementInternalCounter("includeBytesRead", content.length);
    this.textCache.set(key, content);
    return content;
  }
};

// packages/core/src/services/macro-engine.ts
var MacroEngine = class {
  host;
  macroExpansionControlStack = [];
  pendingMacroSourceFile = "";
  pendingMacroSourceLine = 0;
  constructor(host) {
    this.host = host;
  }
  /**
   * Checks whether the current macro expansion line is in an active branch.
   * @returns {boolean} `true` when the current expansion path is active.
   */
  isMacroExpansionActive() {
    return this.macroExpansionControlStack.every((entry) => entry.active);
  }
  /**
   * Checks whether the current macro expansion line is inside a deferred loop body.
   * @returns {boolean} `true` when loop-body commands should defer placeholder resolution.
   */
  isMacroExpansionLoopActive() {
    return this.macroExpansionControlStack.some(
      (entry) => entry.active && (entry.type === "for" || entry.type === "while")
    );
  }
  /**
   * Evaluates a macro control-flow condition using the assembler expression engine.
   * @param {string} expression The expression text to evaluate.
   * @returns {boolean} The boolean result.
   */
  evaluateMacroControlExpression(expression) {
    const trimmed = removeInlineComment(expression).trim();
    if (!trimmed) {
      return false;
    }
    return this.host.evaluateExpression(trimmed);
  }
  /**
   * Updates macro expansion control state after dispatching a control-flow line.
   * @param {string} line The fully expanded line text.
   */
  updateMacroExpansionControlState(line) {
    const trimmed = removeInlineComment(line).trim();
    if (!trimmed) {
      return;
    }
    const [keyword, ...rest] = trimmed.split(/\s+/);
    const normalizedKeyword = keyword.toLowerCase();
    const current = this.macroExpansionControlStack[this.macroExpansionControlStack.length - 1];
    const parentActive = this.isMacroExpansionActive();
    const enclosingActive = this.macroExpansionControlStack.slice(0, -1).every((entry) => entry.active);
    const expression = rest.join(" ").trim();
    switch (normalizedKeyword) {
      case "if": {
        const active = parentActive && this.evaluateMacroControlExpression(expression);
        this.macroExpansionControlStack.push({
          type: "if",
          active,
          branchTaken: active
        });
        return;
      }
      case "elseif": {
        if (!current || current.type !== "if") {
          return;
        }
        if (!enclosingActive || current.branchTaken) {
          current.active = false;
          return;
        }
        const active = this.evaluateMacroControlExpression(expression);
        current.active = active;
        if (active) {
          current.branchTaken = true;
        }
        return;
      }
      case "else": {
        if (!current || current.type !== "if") {
          return;
        }
        current.active = enclosingActive && !current.branchTaken;
        current.branchTaken = true;
        return;
      }
      case "while": {
        const active = parentActive && this.evaluateMacroControlExpression(expression);
        this.macroExpansionControlStack.push({ type: "while", active });
        return;
      }
      case "for": {
        this.macroExpansionControlStack.push({ type: "for", active: parentActive });
        return;
      }
      case "endif": {
        if (current && (current.type === "if" || current.type === "while")) {
          this.macroExpansionControlStack.pop();
        }
        return;
      }
      case "endwhile": {
        if (current?.type === "while") {
          this.macroExpansionControlStack.pop();
        }
        return;
      }
      case "endfor": {
        if (current?.type === "for") {
          this.macroExpansionControlStack.pop();
        }
        return;
      }
      default:
        return;
    }
  }
  /**
   * Handles a macro definition command.
   * @param {NormalizedCommand} commandNode The command node to handle.
   * @returns {boolean} `true` if the command was handled, `false` otherwise.
   */
  handleDefinitionCommand(commandNode) {
    const command = commandNode.command;
    const { keyword, words } = commandNode;
    if (this.host.inMacroDefinition) {
      if (command.trim().toLowerCase() === "endmacro") {
        if (this.host.isDefinitionCollectionStage) {
          let variadic = false;
          if (this.host.currentMacroParams.length > 0 && (this.host.currentMacroParams[this.host.currentMacroParams.length - 1] === "..." || this.host.currentMacroParams[this.host.currentMacroParams.length - 1] === "\u2026")) {
            variadic = true;
            this.host.currentMacroParams.pop();
          }
          const macroDef = {
            name: this.host.currentMacroName,
            params: this.host.currentMacroParams,
            variadic,
            body: this.host.currentMacroBody,
            sourceFile: this.pendingMacroSourceFile || this.host.currentMacroBody[0]?.source.file || this.host.currentFile
          };
          if (this.host.macros.has(macroDef.name)) {
            throw new Error(`Macro '${macroDef.name}' is already defined.`);
          }
          this.host.macros.set(macroDef.name, macroDef);
          this.host.recordSymbolDefinition("macro", macroDef.name, {
            file: this.pendingMacroSourceFile || macroDef.sourceFile || this.host.currentFile,
            line: this.pendingMacroSourceLine
          });
        }
        this.host.inMacroDefinition = false;
        this.host.currentMacroName = "";
        this.host.currentMacroParams = [];
        this.host.currentMacroBody = [];
        this.pendingMacroSourceFile = "";
        this.pendingMacroSourceLine = 0;
        setCommandKind(commandNode, "macroDefinitionOrInvoke");
        return true;
      }
      if (this.host.isDefinitionCollectionStage) {
        this.host.currentMacroBody.push(commandNode);
      }
      setCommandKind(commandNode, "macroDefinitionOrInvoke");
      return true;
    }
    if (keyword.toLowerCase() === "macro" || command.trim().toLowerCase().startsWith("macro ")) {
      const match = command.trim().match(/^macro\s+(\w+)\((.*)\)$/i);
      if (!match) {
        throw new Error(`Invalid macro header: ${command.trim()}`);
      }
      this.host.currentMacroName = match[1].trim();
      const paramsStr = match[2].trim();
      this.host.currentMacroParams = paramsStr ? paramsStr.split(",").map((entry) => entry.trim()) : [];
      this.host.inMacroDefinition = true;
      this.host.currentMacroBody = [];
      this.pendingMacroSourceFile = commandNode.source.file || this.host.currentFile;
      this.pendingMacroSourceLine = commandNode.source.line;
      setCommandKind(commandNode, "macroDefinitionOrInvoke");
      return true;
    }
    if (keyword.startsWith("%")) {
      const parsedInvocation = commandNode.parsed.macroInvocation;
      let invocation = words.join(" ").substring(1);
      if (parsedInvocation) {
        invocation = parsedInvocation.name;
        if (parsedInvocation.args.length > 0) {
          invocation = `${parsedInvocation.name}(${parsedInvocation.args.join(", ")})`;
        }
      }
      this.callMacro(invocation);
      setCommandKind(commandNode, "macroDefinitionOrInvoke");
      return true;
    }
    if (this.host.syntaxProfile.bareMacroInvocations && this.host.macros.has(keyword)) {
      const argumentText = command.slice(keyword.length).trim();
      this.callMacro(argumentText ? `${keyword}(${argumentText})` : keyword);
      setCommandKind(commandNode, "macroDefinitionOrInvoke");
      return true;
    }
    return false;
  }
  /**
   * Rewrites macro label references.
   * @param {string} command The command to rewrite.
   * @returns {string} The rewritten command.
   */
  rewriteMacroLabelReferences(command) {
    if (!this.host.inMacroExpansion || !command.includes("?") && !command.includes("#")) {
      return command;
    }
    let modifiedCommand = command;
    if (modifiedCommand.includes("?+") || modifiedCommand.includes("?-")) {
      if (modifiedCommand.includes("?+")) {
        const currentMacroInstance = this.host.macroLabelInstance;
        const macroLabelPrefix = `:macro_${currentMacroInstance}_`;
        let nextAddr = null;
        if (!modifiedCommand.trim().startsWith("?+:")) {
          for (const [key, info] of this.host.labelTable.entries()) {
            if (key.startsWith(macroLabelPrefix) && (key === `${macroLabelPrefix}+` || key.endsWith("_+") || key === `:pos_${currentMacroInstance}_1`) && info.value > this.host.currentTargetAddress) {
              if (nextAddr === null || info.value < nextAddr) {
                nextAddr = info.value;
              }
            }
          }
          if (nextAddr === null) {
            nextAddr = this.host.symbolScope.findNextLabel("?+");
          }
          modifiedCommand = modifiedCommand.replace(/\?\+/g, `$${nextAddr.toString(16)}`);
        }
      }
      if (modifiedCommand.includes("?-")) {
        const currentMacroInstance = this.host.macroLabelInstance;
        const macroLabelPrefix = `:macro_${currentMacroInstance}_`;
        let prevAddr = null;
        if (!modifiedCommand.trim().startsWith("?-:")) {
          for (const [key, info] of this.host.labelTable.entries()) {
            if (key.startsWith(macroLabelPrefix) && (key === `${macroLabelPrefix}-` || key.endsWith("_-") || key === `:neg_${currentMacroInstance}_1`) && info.value < this.host.currentTargetAddress) {
              if (prevAddr === null || info.value > prevAddr) {
                prevAddr = info.value;
              }
            }
          }
          if (prevAddr === null) {
            prevAddr = this.host.symbolScope.findPreviousLabel("?-");
          }
          modifiedCommand = modifiedCommand.replace(/\?-/g, `$${prevAddr.toString(16)}`);
        }
      }
    }
    if (modifiedCommand.includes("?")) {
      modifiedCommand = modifiedCommand.replace(
        /(?<!\w)(\?[\w+.-]+_[\w+.-]+)(?!:)/g,
        (match, labelRef) => {
          if (modifiedCommand.trim().startsWith(match) && (modifiedCommand.includes(":") || modifiedCommand.includes("="))) {
            return match;
          }
          try {
            const labelValue = this.host.symbolScope.getLabelValue(labelRef, false);
            return `$${labelValue.toString(16)}`;
          } catch (error) {
            if (this.host.isDefinitionCollectionStage) {
              return "$0000";
            }
            throw error;
          }
        }
      );
      modifiedCommand = modifiedCommand.replace(
        /(?<!\w)(\?[\w+.-]+)(?!:)/g,
        (match, labelRef) => {
          if (modifiedCommand.trim().startsWith(match) && (modifiedCommand.includes(":") || modifiedCommand.includes("="))) {
            return match;
          }
          try {
            const labelValue = this.host.symbolScope.getLabelValue(labelRef, false);
            return `$${labelValue.toString(16)}`;
          } catch (error) {
            if (this.host.isDefinitionCollectionStage) {
              return "$0000";
            }
            throw error;
          }
        }
      );
    }
    return modifiedCommand;
  }
  /**
   * Calls a macro.
   * @param {string} invocation The invocation to call.
   */
  callMacro(invocation) {
    incrementInternalCounter("macroExpansions");
    this.host.macroLabelInstance++;
    const previousMacroExpansionState = this.host.inMacroExpansion;
    const previousVariadicCount = this.host.currentVariadicCount;
    const previousVariadicArgs = this.host.currentVariadicArgs;
    const previousMacroName = this.host.currentMacroName;
    const previousParentLabel = this.host.currentParentLabel;
    const previousParentIsGlobal = this.host.currentParentIsGlobal;
    const previousFile = this.host.currentFile;
    const previousMacroExpansionControlStack = this.macroExpansionControlStack.map((entry) => ({
      ...entry
    }));
    this.host.inMacroExpansion = true;
    this.macroExpansionControlStack = [];
    try {
      const invocationRegex = /^(\w+)\((.*)\)$/;
      const match = invocation.match(invocationRegex);
      if (!match) {
        const macroName2 = invocation.startsWith("%") ? invocation.substring(1) : invocation;
        const macro2 = this.host.macros.get(macroName2);
        if (!macro2) {
          throw new Error(`Error: Macro '${macroName2}' not defined.`);
        }
        this.host.currentMacroName = macroName2;
        if (macro2.sourceFile) {
          this.host.currentFile = macro2.sourceFile;
        }
        if (macro2.params.length > 0) {
          const fixedArgs2 = /* @__PURE__ */ new Map();
          for (const param of macro2.params) {
            fixedArgs2.set(param, "");
          }
          this.host.currentVariadicCount = 0;
          this.host.currentVariadicArgs = [];
          for (const lineNode of macro2.body) {
            const expandedLine = this.expandMacroLine(lineNode.command, fixedArgs2, [], 0);
            this.processMacroLine(expandedLine);
          }
        } else {
          for (const lineNode of macro2.body) {
            this.processMacroLine(lineNode.command);
          }
        }
        return;
      }
      const macroName = match[1];
      const args = match[2].trim();
      const macro = this.host.macros.get(macroName);
      if (!macro) {
        throw new Error(`Error: Macro '${macroName}' not defined.`);
      }
      this.host.currentMacroName = macroName;
      if (macro.sourceFile) {
        this.host.currentFile = macro.sourceFile;
      }
      const argValues = [];
      let currentArg = "";
      let inQuotes = false;
      let escapeNext = false;
      for (let i = 0; i < args.length; i++) {
        const char = args[i];
        if (escapeNext) {
          currentArg += char;
          escapeNext = false;
          continue;
        }
        if (char === "\\") {
          escapeNext = true;
          continue;
        }
        if (char === '"') {
          if (inQuotes && i + 1 < args.length && args[i + 1] === '"') {
            currentArg += '"';
            i++;
            continue;
          }
          inQuotes = !inQuotes;
          continue;
        }
        if (char === "," && !inQuotes) {
          argValues.push(currentArg.trim());
          currentArg = "";
          continue;
        }
        currentArg += char;
      }
      if (currentArg.length > 0) {
        argValues.push(currentArg.trim());
      }
      const fixedArgs = /* @__PURE__ */ new Map();
      for (let i = 0; i < macro.params.length; i++) {
        fixedArgs.set(macro.params[i], i < argValues.length ? argValues[i] : "");
      }
      const variadicArgs = [];
      let variadicCount = 0;
      if (macro.variadic && argValues.length > macro.params.length) {
        variadicCount = argValues.length - macro.params.length;
        for (let i = macro.params.length; i < argValues.length; i++) {
          variadicArgs.push(argValues[i]);
        }
      }
      this.host.currentVariadicCount = variadicCount;
      this.host.currentVariadicArgs = variadicArgs;
      for (const lineNode of macro.body) {
        const expandedLine = this.expandMacroLine(
          lineNode.command,
          fixedArgs,
          variadicArgs,
          variadicCount
        );
        this.processMacroLine(expandedLine);
      }
    } finally {
      this.host.currentMacroName = previousMacroName;
      this.host.currentParentLabel = previousParentLabel;
      this.host.currentParentIsGlobal = previousParentIsGlobal;
      this.host.currentVariadicCount = previousVariadicCount;
      this.host.currentVariadicArgs = previousVariadicArgs;
      this.host.inMacroExpansion = previousMacroExpansionState;
      this.host.currentFile = previousFile;
      this.macroExpansionControlStack = previousMacroExpansionControlStack;
    }
  }
  /**
   * Expands a macro line.
   * @param {string} line The line to expand.
   * @param {Map<string, string>} fixedArgs The fixed arguments.
   * @param {string[]} variadicArgs The variadic arguments.
   * @param {number} variadicCount The variadic count.
   * @returns {string} The expanded line.
   */
  expandMacroLine(line, fixedArgs, variadicArgs, variadicCount) {
    line = line.replace(/!<(\w+)>/g, (match, paramName) => {
      if (!fixedArgs.has(paramName)) {
        return match;
      }
      let name = (fixedArgs.get(paramName) ?? "").trim();
      if (name.startsWith("!")) {
        name = name.slice(1);
      }
      return `!${name}`;
    });
    const substituteParamValue = (raw) => {
      const value = raw.trim();
      if (!value.includes("!")) {
        return value;
      }
      return this.host.resolvedefines(value);
    };
    const resolveDeprecatedBangAngle = (match, name) => {
      if (fixedArgs.has(name)) {
        const fixedValue = fixedArgs.get(name);
        return fixedValue !== void 0 ? this.host.resolvedefines(fixedValue) : match;
      }
      if (/^[A-Za-z]$/.test(name)) {
        const index = name.toLowerCase().charCodeAt(0) - 97;
        if (index >= 0 && index < variadicCount) {
          return variadicArgs[index];
        }
      }
      const defineValue = this.host.defines.get(name);
      return defineValue !== void 0 ? defineValue : match;
    };
    if (line.trim().startsWith("!") && line.includes("=")) {
      const defineMatch = line.trim().match(/^!(\w+)\s*(=|\+=|:=|#=|\?=)\s*(.*)$/);
      if (defineMatch) {
        const varName = defineMatch[1];
        const operator = defineMatch[2];
        const value = defineMatch[3];
        let expandedValue = value;
        expandedValue = expandedValue.replace(/<!(\w+)>/g, resolveDeprecatedBangAngle);
        expandedValue = expandedValue.replace(/<(\w+)>/g, (match, paramName) => {
          if (fixedArgs.has(paramName)) {
            return substituteParamValue(fixedArgs.get(paramName) ?? "");
          }
          return match;
        });
        expandedValue = expandedValue.replace(
          /<(?:\.{3}|…)\[([^\]]+)]>/g,
          (match, expr) => {
            if (this.isMacroExpansionLoopActive()) {
              return match;
            }
            const processedExpr = expr.replace(/!(\w+)/g, (defMatch, defName) => {
              if (this.host.defines.has(defName)) {
                return this.host.defines.get(defName) ?? defMatch;
              }
              return defMatch;
            });
            const resolvedExpr = this.host.resolvedefines(processedExpr);
            let index = this.host.mathCore.math(resolvedExpr);
            if (Number.isNaN(index)) {
              throw new Error(
                `Invalid variadic index expression: ${expr} (resolved to ${resolvedExpr})`
              );
            }
            index = Math.floor(index);
            if (index < 0 || index >= variadicCount) {
              throw new Error(`Variadic index ${index} out of range (0..${variadicCount - 1}).`);
            }
            return variadicArgs[index];
          }
        );
        expandedValue = expandedValue.replace(/sizeof\((?:\.{3}|…)\)/g, variadicCount.toString());
        return `!${varName} ${operator} ${expandedValue}`;
      }
    }
    if (line.match(/^\s*[#?][\w+.-]+:/) || line.match(/^\s*[#?][\w+.-]+\s*=/)) {
      return line;
    }
    let expanded = line;
    expanded = expanded.replace(/<!(\w+)>/g, resolveDeprecatedBangAngle);
    expanded = expanded.replace(/<(\w+)>/g, (match, paramName) => {
      if (fixedArgs.has(paramName)) {
        return substituteParamValue(fixedArgs.get(paramName) ?? "");
      }
      return match;
    });
    if (this.host.syntaxProfile.macroParameterPrefix === "\\") {
      expanded = expanded.replace(/\\([A-Z_a-z]\w*)/g, (match, paramName) => {
        if (fixedArgs.has(paramName)) {
          return substituteParamValue(fixedArgs.get(paramName) ?? "");
        }
        return match;
      });
    }
    const currentCond = this.isMacroExpansionActive();
    if (!currentCond) {
      return expanded;
    }
    expanded = expanded.replace(/<(?:\.{3}|…)\[([^\]]+)]>/g, (match, expr) => {
      if (this.isMacroExpansionLoopActive()) {
        return match;
      }
      const processedExpr = expr.replace(/!(\w+)/g, (defMatch, defName) => {
        if (this.host.defines.has(defName)) {
          return this.host.defines.get(defName) ?? defMatch;
        }
        return defMatch;
      });
      const resolvedExpr = this.host.resolvedefines(processedExpr);
      let index = this.host.mathCore.math(resolvedExpr);
      if (Number.isNaN(index)) {
        throw new Error(`Invalid variadic index expression: ${expr} (resolved to ${resolvedExpr})`);
      }
      index = Math.floor(index);
      if (index < 0 || index >= variadicCount) {
        throw new Error(`Variadic index ${index} out of range (0..${variadicCount - 1}).`);
      }
      return variadicArgs[index];
    });
    expanded = expanded.replace(/sizeof\((?:\.{3}|…)\)/g, variadicCount.toString());
    return expanded;
  }
  /**
   * Resolves variadic placeholders.
   * @param {string} command The command to resolve.
   * @returns {string} The resolved command.
   */
  resolveVariadicPlaceholders(command) {
    if (!command.includes("...") && !command.includes("\u2026")) {
      return command;
    }
    const variadicCount = this.host.currentVariadicArgs.length;
    let resolved = command.replace(/sizeof\((?:\.{3}|…)\)/g, variadicCount.toString());
    resolved = resolved.replace(/<(?:\.{3}|…)\[([^\]]+)]>/g, (match, expr) => {
      const processedExpr = expr.replace(/!(\w+)/g, (defMatch, defName) => {
        const defineValue = this.host.defines.get(defName);
        return defineValue !== void 0 ? defineValue : defMatch;
      });
      const resolvedExpr = this.host.resolvedefines(processedExpr);
      let index = this.host.mathCore.math(resolvedExpr);
      if (Number.isNaN(index)) {
        throw new Error(`Invalid variadic index expression: ${expr} (resolved to ${resolvedExpr})`);
      }
      index = Math.floor(index);
      if (index < 0 || index >= variadicCount) {
        throw new Error(`Variadic index ${index} out of range (0..${variadicCount - 1}).`);
      }
      return this.host.currentVariadicArgs[index];
    });
    return resolved;
  }
  /**
   * Processes a macro line.
   * @param {string} line The line to process.
   */
  processMacroLine(line) {
    incrementInternalCounter("macroLinesProcessed");
    const preprocessedLine = removeInlineComment(line);
    const trimmed = preprocessedLine.trim();
    const commandLine = preprocessedLine === line.trim() ? line : preprocessedLine;
    let keyword = trimmed.toLowerCase();
    const keywordEnd = keyword.search(/\s/);
    if (keywordEnd >= 0) {
      keyword = keyword.slice(0, keywordEnd);
    }
    const isControlDirective = keyword === "if" || keyword === "elseif" || keyword === "else" || keyword === "endif" || keyword === "while" || keyword === "endwhile" || keyword === "for" || keyword === "endfor";
    if (!this.isMacroExpansionActive() && !isControlDirective) {
      return;
    }
    if (/^[#?][\w+.-]+:/.test(trimmed)) {
      if (trimmed.startsWith("?+:") || trimmed.startsWith("?-:")) {
        const labelChar = trimmed;
        const remainder = trimmed.substring(3).trim();
        this.host.symbolScope.handleRelativeLabel(labelChar);
        if (remainder) {
          this.host.processCommand(remainder, true);
          this.updateMacroExpansionControlState(remainder);
        }
        return;
      }
      const match = trimmed.match(/^([#?][\w+.-]+):/);
      if (match) {
        const labelName = match[1];
        const remainder = trimmed.substring(match[0].length).trim();
        this.host.symbolScope.setLabel(labelName, void 0, false, true);
        if (remainder) {
          this.host.processCommand(remainder, true);
          this.updateMacroExpansionControlState(remainder);
        }
        return;
      }
    }
    if (/^\?[\w+.-]+ *=/.test(trimmed)) {
      const match = trimmed.match(/^(\?[\w+.-]+) *=\s*(.*)/);
      if (match) {
        const labelName = match[1];
        const expression = match[2].trim();
        const value = this.host.mathCore.math(expression);
        this.host.symbolScope.setLabel(labelName, value, true, true);
        return;
      }
    }
    const isDefineAssignment = /^!\w+\s*(?:#=|\+=|:=|\?=|=(?!=))/.test(trimmed);
    if (isDefineAssignment && !this.isMacroExpansionLoopActive()) {
      this.host.applyDefineAssignment(commandLine);
    } else {
      this.host.processCommand(commandLine, true);
    }
    this.updateMacroExpansionControlState(trimmed);
  }
};

// packages/core/src/services/output-writer-service.ts
var OutputWriterService = class {
  constructor(host) {
    this.host = host;
  }
  host;
  /**
   * Advances the logical write position.
   * @param {number} num The number of bytes to step.
   */
  step(num) {
    if (num === 0) {
      return;
    }
    if (num < 0) {
      throw new Error("step num is negative");
    }
    this.host.currentTargetAddress = this.host.pluginAddressSpace.advance(
      this.host.currentTargetAddress,
      num
    );
    this.host.currentTargetBaseAddress = this.host.pluginAddressSpace.advance(
      this.host.currentTargetBaseAddress,
      num
    );
    this.host.syncWriteStarts();
    this.host.incrementBytesWritten(num);
  }
  /**
   * Writes a single byte at the current logical position.
   * @param {number} num The value to write.
   */
  write1(num) {
    if (Number.isNaN(num)) {
      throw new Error("write1 value is NaN");
    }
    this.verifyLogicalPosition();
    const newPos = this.host.pluginAddressSpace.normalizeForWrite(
      this.host.currentTargetBaseAddress
    );
    const logicalAddress = normalizeAddressForWidth(
      newPos,
      this.host.pluginAddressSpace.addressWidth
    );
    this.host.beforeWrite?.(logicalAddress, 1);
    const outputOffset = this.toOutputOffset(logicalAddress);
    if (this.host.isTracing) {
      this.host.traceWrite?.({
        stage: this.host.traceStage,
        arch: this.host.arch,
        file: "",
        line: 0,
        raw: "",
        normalized: "",
        logicalAddress,
        addressWidth: this.host.pluginAddressSpace.addressWidth,
        outputOffset,
        value: num & 255
      });
    }
    if (outputOffset < 0) {
      this.step(1);
      return;
    }
    if (this.host.canEmitBytes) {
      if (outputOffset >= this.host.outputBytes.length && outputOffset - this.host.outputBytes.length > 0) {
        this.host.fillOutputBytes(
          this.host.outputBytes.length,
          this.host.outputFillByte,
          outputOffset - this.host.outputBytes.length
        );
      }
      this.host.outputBytes[outputOffset] = num & 255;
    }
    this.step(1);
  }
  /**
   * Writes a 16-bit value to output.
   * @param {number} num The value to write.
   */
  write2(num) {
    this.validateWrite(2);
    this.write1(num & 255);
    this.write1(num >> 8 & 255);
  }
  /**
   * Writes a 24-bit value to output.
   * @param {number} num The value to write.
   */
  write3(num) {
    this.validateWrite(3);
    this.write1(num & 255);
    this.write1(num >> 8 & 255);
    this.write1(num >> 16 & 255);
  }
  /**
   * Writes a 32-bit value to output.
   * @param {number} num The value to write.
   */
  write4(num) {
    this.validateWrite(4);
    this.write1(num & 255);
    this.write1(num >> 8 & 255);
    this.write1(num >> 16 & 255);
    this.write1(num >> 24 & 255);
  }
  /**
   * Writes an arbitrary-width value for architecture extensions.
   * @param {number} num Value to write.
   * @param {number} width Width in bytes.
   * @param {"little" | "big"} endianness Byte order.
   */
  writeValue(num, width, endianness = "little") {
    if (!Number.isInteger(width) || width < 1) {
      throw new Error(`Invalid write width: ${width}`);
    }
    this.validateWrite(width);
    for (let index = 0; index < width; index++) {
      const shift = endianness === "little" ? index : width - index - 1;
      this.write1(num >> shift * 8 & 255);
    }
  }
  /**
   * Writes a sequence of already encoded bytes.
   * @param {readonly number[]} values Bytes to write.
   */
  writeBytes(values) {
    this.validateWrite(values.length);
    for (const value of values) {
      this.write1(value);
    }
  }
  /**
   * Runs active address-space and lifecycle validation for a write.
   * @param {number} length The length of the value to write.
   */
  validateWrite(length) {
    this.host.beforeWrite?.(this.host.currentTargetBaseAddress, length);
  }
  /**
   * Finishes the pass.
   */
  finishPass() {
    if (this.host.canFinalize) {
      this.host.pluginOutputFormat.finalize({
        state: this.host.pluginState,
        outputBytes: this.host.outputBytes
      });
    }
  }
  /**
   * Converts a logical address to an output offset.
   * @param {number} addr The logical address.
   * @returns {number} The mapped output offset.
   */
  toOutputOffset(addr) {
    return this.host.pluginAddressSpace.toOutputOffset(addr);
  }
  /**
   * Converts an output offset to a logical address.
   * @param {number} addr The output offset.
   * @returns {number} The mapped logical address.
   */
  fromOutputOffset(addr) {
    return this.host.pluginAddressSpace.fromOutputOffset(addr);
  }
  /**
   * Verifies the logical position.
   */
  verifyLogicalPosition() {
    if (this.host.currentTargetAddress < 0 || this.host.currentTargetBaseAddress < 0) {
      this.host.setWritePosition(this.host.pluginAddressSpace.defaultOrigin);
    }
  }
  /**
   * Advances and normalizes a logical position.
   * @param {number} inaddr The logical address to advance.
   * @param {number} step The number of bytes to step.
   * @returns {number} The fixed address.
   */
  advanceLogicalAddress(inaddr, step = 0) {
    return this.host.pluginAddressSpace.advance(inaddr, step);
  }
};

// packages/core/src/services/struct-engine.ts
var StructEngine = class {
  constructor(host) {
    this.host = host;
  }
  host;
  /**
   * Handles a struct mode command.
   * @param {NormalizedCommand} command The command to handle.
   * @returns {boolean} `true` if the command was handled, `false` otherwise.
   */
  handleStructMode(command) {
    const currentStruct = this.host.currentStruct;
    if (!currentStruct) {
      return false;
    }
    const { words } = command;
    const keyword = words[0] ?? "";
    if (keyword.startsWith(".")) {
      const hasColon = keyword.endsWith(":");
      const labelName = keyword.replace(/:$/, "").substring(1);
      currentStruct.labels.set(labelName, currentStruct.offset);
      this.host.recordSymbolDefinition("structMember", labelName, {
        value: currentStruct.offset,
        containerName: currentStruct.name
      });
      if (words[1]?.toLowerCase() === "skip") {
        if (words.length !== 3) {
          throw new Error(
            `skip directive in struct requires exactly one parameter: ${words.length}`
          );
        }
        const skipAmount = this.host.operandResolver.getnum(words[2]);
        currentStruct.offset += skipAmount;
      }
      void hasColon;
      setCommandKind(command, "structCommand");
      return true;
    }
    if (keyword.toLowerCase() === "endstruct") {
      this.handleEndStruct(words);
      setCommandKind(command, "structCommand");
      return true;
    }
    setCommandKind(command, "structCommand");
    return true;
  }
  /**
   * Handles a struct command.
   * @param {string[]} words The words of the command.
   */
  handleStruct(words) {
    if (words.length < 2) {
      throw new Error("Struct definition requires at least two parameters.");
    }
    const structName = words[1];
    let base;
    let parent;
    if (words.length === 2) {
      base = 0;
    } else if (words[2].toLowerCase() === "extends") {
      if (words.length < 4) {
        throw new Error("Struct extension must specify a parent struct.");
      }
      parent = words[3];
      const parentStruct = this.host.structs.get(parent);
      if (!parentStruct) {
        throw new Error(`Parent struct '${parent}' not defined.`);
      }
      base = parentStruct.base;
    } else {
      base = this.host.operandResolver.getnum(words[2]);
      if (base < 0 || base > maximumAddressForWidth(this.host.addressWidth)) {
        throw new Error(`Invalid logical address for struct: ${words[2]}`);
      }
    }
    this.host.enterStructDefinition(base);
    this.host.currentStruct = {
      name: structName,
      base,
      offset: 0,
      size: 0,
      labels: /* @__PURE__ */ new Map(),
      parent,
      extensionSize: 0
    };
    this.host.recordSymbolDefinition("struct", structName, { value: base });
  }
  /**
   * Handles an endstruct command.
   * @param {string[]} words The words of the command.
   */
  handleEndStruct(words) {
    const currentStruct = this.host.currentStruct;
    if (!currentStruct) {
      throw new Error("endstruct encountered but not inside a struct definition.");
    }
    let align;
    if (words.length >= 2 && words[1].toLowerCase() === "align") {
      if (words.length !== 3) {
        throw new Error("endstruct align requires a single alignment parameter.");
      }
      align = this.host.operandResolver.getnum(words[2]);
      if (align < 1) {
        throw new Error("Alignment must be at least 1.");
      }
    }
    let finalSize = currentStruct.offset;
    if (align !== void 0) {
      finalSize = Math.ceil(finalSize / align) * align;
      currentStruct.align = align;
    }
    currentStruct.size = finalSize;
    if (currentStruct.parent) {
      const parentName = currentStruct.parent;
      const parentStruct = this.host.structs.get(parentName);
      if (!parentStruct) {
        throw new Error(`Parent struct '${parentName}' not defined.`);
      }
      const extSize = currentStruct.size;
      if (extSize > parentStruct.extensionSize) {
        parentStruct.extensionSize = extSize;
      }
      this.host.structs.set(`${parentName}.${currentStruct.name}`, currentStruct);
      this.host.structs.set(currentStruct.name, currentStruct);
    } else {
      this.host.structs.set(currentStruct.name, currentStruct);
    }
    this.host.restoreStructDefinition();
    this.host.currentStruct = null;
  }
  /**
   * Checks whether a reference starts with a known struct name.
   * @param {string} labelRef The reference to inspect.
   * @returns {boolean} Whether the reference belongs to a known struct.
   */
  hasStructReference(labelRef) {
    if (!/^[A-Z_a-z]\w*(?:\[[^\]]+])?(?:\.[A-Z_a-z]\w*(?:\[[^\]]+])?)*$/.test(labelRef)) {
      return false;
    }
    if (this.host.structs.has(labelRef)) {
      return true;
    }
    const dotIndex = labelRef.indexOf(".");
    const bracketIndex = labelRef.indexOf("[");
    let rootEnd = Math.min(dotIndex, bracketIndex);
    if (dotIndex === -1) {
      rootEnd = bracketIndex;
    } else if (bracketIndex === -1) {
      rootEnd = dotIndex;
    }
    const root = rootEnd === -1 ? labelRef : labelRef.slice(0, rootEnd);
    return root.length > 0 && this.host.structs.has(root);
  }
  /**
   * Resolves a struct label.
   * @param {string} labelRef The label to resolve.
   * @returns {number} The resolved address.
   */
  resolveStructLabel(labelRef) {
    const refParts = labelRef.split(".");
    if (refParts.length === 2 && !labelRef.includes("[")) {
      const parentName = refParts[0];
      const parentDef = this.host.structs.get(parentName);
      if (parentDef) {
        const extensionDef = this.host.structs.get(labelRef);
        if (extensionDef?.parent === parentName) {
          return parentDef.base + parentDef.size;
        }
      }
    }
    const directStruct = this.host.structs.get(labelRef);
    if (directStruct) {
      return directStruct.base;
    }
    let arrayIndex = 0;
    let candidate = labelRef;
    let extraMember = "";
    const arrayMatch = candidate.match(/^(.*?)\[([^\]]+)](.*)$/);
    if (arrayMatch) {
      candidate = arrayMatch[1];
      arrayIndex = this.host.operandResolver.getnum(arrayMatch[2]);
      extraMember = arrayMatch[3];
      if (extraMember.startsWith(".")) {
        extraMember = extraMember.substring(1);
      }
    }
    const parts = candidate.split(".");
    for (let i = parts.length; i >= 1; i--) {
      const potential = parts.slice(0, i).join(".");
      if (!this.host.structs.has(potential)) {
        continue;
      }
      const def = this.host.structs.get(potential);
      if (!def) {
        continue;
      }
      const memberPart = parts.slice(i).join(".");
      const memberName = memberPart + (extraMember ? (memberPart ? "." : "") + extraMember : "");
      const baseStructSize = def.size;
      let effectiveSize = baseStructSize;
      if (def.align) {
        effectiveSize = Math.ceil(baseStructSize / def.align) * def.align;
      }
      const maxExtensionSize = def.extensionSize;
      if (maxExtensionSize > 0) {
        effectiveSize += maxExtensionSize;
      }
      if (memberName.trim() === "") {
        if (arrayIndex !== 0) {
          return def.base + arrayIndex * effectiveSize;
        }
        return def.base;
      }
      const memberParts = memberName.split(".");
      const topLevelMember = memberParts[0];
      if (!def.labels.has(topLevelMember)) {
        const childStruct = this.host.structs.get(topLevelMember);
        if (childStruct && childStruct.parent === potential) {
          const childMemberName = memberParts.slice(1).join(".");
          const childReference = `${topLevelMember}${childMemberName ? `.${childMemberName}` : ""}`;
          const childOffset = this.resolveStructLabel(childReference) - childStruct.base;
          return def.base + arrayIndex * effectiveSize + childOffset;
        }
        throw new Error(`Member '${topLevelMember}' not defined in struct '${potential}'.`);
      }
      const offset = def.labels.get(topLevelMember);
      if (offset === void 0) {
        throw new Error(`Member '${topLevelMember}' not defined in struct '${potential}'.`);
      }
      let finalAddress;
      if (def.parent) {
        const parentDef = this.host.structs.get(def.parent);
        if (!parentDef) {
          throw new Error(
            `Parent struct '${def.parent}' not defined for extension '${potential}'.`
          );
        }
        let parentSize = parentDef.size;
        if (parentDef.align) {
          parentSize = Math.ceil(parentSize / parentDef.align) * parentDef.align;
        }
        if (arrayIndex === 0) {
          finalAddress = parentDef.base + parentSize + offset;
        } else {
          finalAddress = parentDef.base + parentSize + arrayIndex * def.size + offset;
        }
      } else {
        finalAddress = def.base + arrayIndex * effectiveSize + offset;
      }
      return finalAddress;
    }
    throw new Error(`Struct not defined in reference: ${labelRef}`);
  }
};

// packages/core/src/services/symbol-scope-service.ts
var SymbolScopeService = class {
  constructor(host) {
    this.host = host;
  }
  host;
  /**
   * Returns the current ca65-style object file name (last `.asm` on the include stack).
   * @returns {string} The object-file basename, or empty when unknown.
   */
  objectFileKey() {
    const chain = [...this.host.includeStack, this.host.currentFile];
    for (let index = chain.length - 1; index >= 0; index--) {
      const base = fileBasename(chain[index] ?? "");
      if (base.toLowerCase().endsWith(".asm")) {
        return base;
      }
    }
    return fileBasename(this.host.currentFile);
  }
  /**
   * Qualifies a symbol for the active syntax profile's file-local rule.
   * Exported/imported names and cheap/sublabels stay unqualified.
   * @param {string} name The source symbol name.
   * @returns {string} The storage key.
   */
  qualifySymbolName(name) {
    const profile = this.host.syntaxProfile ?? ASAR_SYNTAX_PROFILE;
    if (!profile.fileLocalSymbols) {
      return name;
    }
    if (this.host.globalSymbols.has(name)) {
      return name;
    }
    if (name.startsWith(".") || name.startsWith("@") || name.includes("::")) {
      return name;
    }
    const unit = this.objectFileKey();
    return unit ? `${unit}::${name}` : name;
  }
  /**
   * Adds a namespace inside a file-local qualifier (`unit::Namespace_Label`).
   * @param {string} namespacePrefix The flattened namespace prefix.
   * @param {string} label The already-qualified or plain label.
   * @returns {string} The namespace-qualified storage key.
   */
  qualifyNamespaceAlias(namespacePrefix, label) {
    if (this.host.syntaxProfile.fileLocalSymbols) {
      const separator = label.indexOf("::");
      if (separator !== -1) {
        return `${label.slice(0, separator + 2)}${namespacePrefix}_${label.slice(separator + 2)}`;
      }
    }
    return `${namespacePrefix}_${label}`;
  }
  /**
   * Maps a cheap-local `@name` onto the existing single-dot sublabel form.
   * @param {string} name The label token, without a trailing colon.
   * @returns {string} The rewritten name.
   */
  toCheapDotLabel(name) {
    const prefix = this.host.syntaxProfile?.cheapLocalPrefix ?? "";
    if (prefix && name.startsWith(prefix) && name.length > prefix.length) {
      return `.${name.slice(prefix.length)}`;
    }
    return name;
  }
  /**
   * Finds nearest hierarchy ancestor.
   * @param {string} label The label.
   * @returns {string | null} The result.
   */
  findNearestHierarchyAncestor(label) {
    for (let i = label.length - 1; i >= 0; i--) {
      if (label[i] !== "_") {
        continue;
      }
      const candidate = label.slice(0, i);
      if (!candidate) {
        continue;
      }
      const entry = this.host.labelTable.get(candidate);
      if (entry?.modifiesHierarchy) {
        return candidate;
      }
    }
    return null;
  }
  /**
   * Gets hierarchy chain.
   * @param {string} label The label.
   * @returns {string[]} The result.
   */
  getHierarchyChain(label) {
    const rootLabel = this.host.currentGlobalParentLabel;
    const rootApplies = Boolean(rootLabel) && (label === rootLabel || label.startsWith(`${rootLabel}_`));
    const chain = [label];
    let cursor = label;
    while (true) {
      const explicitParent = this.host.labelParents.get(cursor);
      const parent = explicitParent === void 0 ? this.findNearestHierarchyAncestor(cursor) : explicitParent;
      if (!parent) {
        break;
      }
      chain.unshift(parent);
      if (rootApplies && parent === rootLabel) {
        break;
      }
      cursor = parent;
    }
    return chain;
  }
  /**
   * Gets ancestor prefixes.
   * @param {string} label The label.
   * @returns {string[]} The result.
   */
  getAncestorPrefixes(label) {
    const prefixes = [];
    for (let i = label.length - 1; i >= 0; i--) {
      if (label[i] !== "_") {
        continue;
      }
      const candidate = label.slice(0, i);
      if (candidate) {
        prefixes.push(candidate);
      }
    }
    return prefixes;
  }
  /**
   * Gets scoped parent label.
   * @param {number} dotCount The dot count.
   * @returns {string} The result.
   */
  getScopedParentLabel(dotCount) {
    const current = this.host.currentParentLabel;
    if (dotCount === 1) {
      if (this.host.currentGlobalParentLabel) {
        return this.host.currentGlobalParentLabel;
      }
      if (this.host.currentParentIsGlobal) {
        return current;
      }
      const chain2 = this.getHierarchyChain(current);
      return chain2[0] ?? current;
    }
    if (this.host.currentParentIsGlobal) {
      return current;
    }
    const chain = this.getHierarchyChain(current);
    const targetDepth = dotCount - 1;
    return chain[targetDepth] ?? current;
  }
  /**
   * Checks if a label is in scope.
   * @param {string} identifier The label to check.
   * @returns {boolean} `true` if the label is in scope, `false` otherwise.
   */
  hasLabelInScope(identifier) {
    const qualified = this.qualifySymbolName(identifier);
    return this.host.labelTable.has(identifier) || qualified !== identifier && this.host.labelTable.has(qualified) || (this.host.currentNamespace ? this.host.labelTable.has(`${this.host.currentNamespace}_${identifier}`) : false);
  }
  /**
   * Handles a relative label.
   * @param {string} label The label to handle.
   * @returns {number} The address of the label.
   */
  handleRelativeLabel(label) {
    const isPositive = label.includes("+");
    const depth = isPositive ? (label.match(/\+/g) || []).length : (label.match(/-/g) || []).length;
    const targetAddress = this.host.currentTargetAddress;
    const isMacroLocal = label.startsWith("?");
    if (this.host.enforceResolvedLabels) {
      if (isPositive) {
        if (!this.host.forwardLabels[depth] || this.host.forwardLabels[depth].length === 0) {
          throw new Error(`Error: Undefined forward label '${label}'.`);
        }
      } else if (!this.host.backwardLabels[depth] || this.host.backwardLabels[depth].length === 0) {
        throw new Error(`Error: Undefined backward label '${label}'.`);
      }
      return targetAddress;
    }
    if (isPositive) {
      if (!this.host.forwardLabels[depth]) this.host.forwardLabels[depth] = [];
      if (isMacroLocal && this.host.inMacroExpansion) {
        this.host.forwardLabels[depth].push({
          addr: targetAddress,
          macroInstance: this.host.macroLabelInstance
        });
      } else {
        this.host.forwardLabels[depth].push({ addr: targetAddress });
      }
    } else {
      if (!this.host.backwardLabels[depth]) this.host.backwardLabels[depth] = [];
      if (isMacroLocal && this.host.inMacroExpansion) {
        this.host.backwardLabels[depth].push({
          addr: targetAddress,
          macroInstance: this.host.macroLabelInstance
        });
      } else {
        this.host.backwardLabels[depth].push({ addr: targetAddress });
      }
    }
    return targetAddress;
  }
  /**
   * Records a ca65 unnamed label (`:`). Stored at Asar depth 0 so `+`/`-` streams stay intact.
   * `:+` / `:++` skip N labels in this single stream rather than using Asar's per-depth tables.
   * @returns {number} The address of the unnamed label.
   */
  handleUnnamedLabel() {
    const targetAddress = this.host.currentTargetAddress;
    if (this.host.enforceResolvedLabels) {
      if (!this.host.forwardLabels[0] || this.host.forwardLabels[0].length === 0) {
        throw new Error("Error: Undefined unnamed label ':'.");
      }
      return targetAddress;
    }
    if (!this.host.forwardLabels[0]) this.host.forwardLabels[0] = [];
    if (!this.host.backwardLabels[0]) this.host.backwardLabels[0] = [];
    const entry = { addr: targetAddress, unit: this.objectFileKey() };
    this.host.forwardLabels[0].push(entry);
    this.host.backwardLabels[0].push({ addr: targetAddress, unit: entry.unit });
    return targetAddress;
  }
  /**
   * Resolves a ca65 unnamed-label reference (`:+`, `:++`, `:-`, `:--`).
   * @param {string} label The reference token.
   * @param {number} [currentAddressOverride] PC to search from.
   * @returns {number} The target address.
   */
  findUnnamedLabel(label, currentAddressOverride) {
    const parsed = parseUnnamedLabelReference(label);
    if (!parsed) {
      throw new Error(`Error: Invalid unnamed label '${label}'.`);
    }
    const currentAddress = currentAddressOverride ?? this.host.currentTargetAddress;
    if (!this.host.enforceResolvedLabels) {
      return 0;
    }
    const table = parsed.direction === 1 ? this.host.forwardLabels[0] : this.host.backwardLabels[0];
    if (!table || table.length === 0) {
      throw new Error(
        `Error: No unnamed label '${label}' found ${parsed.direction === 1 ? "after" : "before"} ${currentAddress.toString(16)}.`
      );
    }
    const unit = this.objectFileKey();
    const ordered = table.filter((entry) => !entry.unit || entry.unit === unit).filter(
      (entry) => parsed.direction === 1 ? entry.addr > currentAddress : entry.addr < currentAddress
    ).map((entry) => entry.addr).sort((left, right) => parsed.direction === 1 ? left - right : right - left);
    if (ordered.length < parsed.count) {
      throw new Error(
        `Error: No unnamed label '${label}' found ${parsed.direction === 1 ? "after" : "before"} ${currentAddress.toString(16)}.`
      );
    }
    return ordered[parsed.count - 1];
  }
  /**
   * Finds the next label.
   * @param {string} label The label to find.
   * @param {number} currentAddressOverride The current address to override.
   * @returns {number} The address of the next label.
   */
  findNextLabel(label, currentAddressOverride) {
    const isPositive = label.includes("+");
    const depth = isPositive ? (label.match(/\+/g) || []).length : (label.match(/-/g) || []).length;
    const currentAddress = currentAddressOverride ?? this.host.currentTargetAddress;
    const isMacroLocal = label.startsWith("?");
    if (!this.host.enforceResolvedLabels) {
      return 0;
    }
    if (!this.host.forwardLabels[depth] || this.host.forwardLabels[depth].length === 0) {
      throw new Error(`Error: No + label '${label}' found after ${currentAddress.toString(16)}.`);
    }
    const possibleTargets = this.host.forwardLabels[depth].filter((entry) => {
      if (isMacroLocal && this.host.inMacroExpansion) {
        return entry.addr > currentAddress && entry.macroInstance === this.host.macroLabelInstance;
      }
      return entry.addr >= currentAddress && !entry.macroInstance;
    }).map((entry) => entry.addr);
    if (possibleTargets.length === 0) {
      throw new Error(`Error: No + label '${label}' found after ${currentAddress.toString(16)}.`);
    }
    return Math.min(...possibleTargets);
  }
  /**
   * Finds the previous label.
   * @param {string} label The label to find.
   * @param {number} currentAddressOverride The current address to override.
   * @returns {number} The address of the previous label.
   */
  findPreviousLabel(label, currentAddressOverride) {
    const isPositive = label.includes("+");
    const depth = isPositive ? (label.match(/\+/g) || []).length : (label.match(/-/g) || []).length;
    const currentAddress = currentAddressOverride ?? this.host.currentTargetAddress;
    const isMacroLocal = label.startsWith("?");
    if (this.host.isDefinitionCollectionStage) {
      return 0;
    }
    if (!this.host.backwardLabels[depth] || this.host.backwardLabels[depth].length === 0) {
      throw new Error(`Error: No - label '${label}' found before ${currentAddress.toString(16)}.`);
    }
    const possibleTargets = this.host.backwardLabels[depth].filter((entry) => {
      if (isMacroLocal && this.host.inMacroExpansion) {
        return entry.addr < currentAddress && entry.macroInstance === this.host.macroLabelInstance;
      }
      return entry.addr < currentAddress && !entry.macroInstance;
    }).map((entry) => entry.addr);
    if (possibleTargets.length === 0) {
      throw new Error(`Error: No - label '${label}' found before ${currentAddress.toString(16)}.`);
    }
    return Math.max(...possibleTargets);
  }
  /**
   * Sets a label.
   * @param {string} label The label to set.
   * @param {number} value The value of the label.
   * @param {boolean} isStatic Whether the label is static.
   * @param {boolean} isMacroLabel Whether the label is a macro label.
   * @param {boolean} isGlobal Whether the label is global.
   * @param {boolean} modifiesHierarchy Whether the label modifies the hierarchy.
   */
  setLabel(label, value, isStatic = false, isMacroLabel = false, isGlobal = false, modifiesHierarchy = true) {
    let fullLabel = label;
    let directScopeLabel = null;
    if (isMacroLabel && (label.startsWith("?") || label.startsWith("#"))) {
      const prefix = label.charAt(0);
      const labelName = label.substring(1);
      const macroModifiesHierarchy = prefix !== "#";
      if (prefix === "?") {
        if (labelName.startsWith(".")) {
          let recentMainLabel = "";
          for (const [key, entry] of this.host.labelTable.entries()) {
            if (entry.isMacroLabel && key.startsWith(`:macro_${this.host.macroLabelInstance}_`) && !key.includes("_SubLabel_")) {
              const labelPart = key.substring(`:macro_${this.host.macroLabelInstance}_`.length);
              if (!labelPart.startsWith(".")) {
                recentMainLabel = labelPart;
              }
            }
          }
          fullLabel = `:macro_${this.host.macroLabelInstance}_${labelName}`;
          if (recentMainLabel) {
            const subLabelWithoutDot = labelName.substring(1);
            const parentChildLabel = `:macro_${this.host.macroLabelInstance}_${recentMainLabel}_${subLabelWithoutDot}`;
            const subAddr = value !== void 0 ? value : this.host.currentTargetAddress;
            this.host.labelTable.set(parentChildLabel, {
              value: subAddr,
              isStatic,
              isMacroLabel: true,
              macroInstance: this.host.macroLabelInstance,
              modifiesHierarchy: macroModifiesHierarchy
            });
          }
        } else {
          fullLabel = `:macro_${this.host.macroLabelInstance}_${labelName}`;
        }
      } else {
        fullLabel = this.host.currentNamespace && !isGlobal ? `${this.host.currentNamespace}_${labelName}` : labelName;
      }
    } else if (!label.includes(":")) {
      const namespacePrefix = this.host.namespaceNestingEnabled ? this.host.namespaceNestingPath.join("_") : this.host.currentNamespace;
      if (this.host.currentNamespace && !isGlobal) {
        if (!label.startsWith(`${namespacePrefix}_`)) {
          fullLabel = `${namespacePrefix}_${label}`;
          if (this.host.namespaceNestingEnabled && this.host.namespaceNestingPath.length > 0 && modifiesHierarchy) {
            const leafNamespace = this.host.namespaceNestingPath[this.host.namespaceNestingPath.length - 1];
            const leafLabel = `${leafNamespace}_${label}`;
            const addr2 = value !== void 0 ? value : this.host.currentTargetAddress;
            this.host.labelTable.set(leafLabel, {
              value: addr2,
              isStatic,
              isMacroLabel,
              macroInstance: isMacroLabel ? this.host.macroLabelInstance : void 0,
              modifiesHierarchy
            });
            for (let i = this.host.namespaceNestingPath.length - 2; i >= 0; i--) {
              const partialPath = this.host.namespaceNestingPath.slice(i);
              const partialLabel = `${partialPath.join("_")}_${label}`;
              this.host.labelTable.set(partialLabel, {
                value: addr2,
                isStatic,
                isMacroLabel,
                macroInstance: isMacroLabel ? this.host.macroLabelInstance : void 0,
                modifiesHierarchy
              });
            }
          }
        }
        if (label.includes("_") && !label.startsWith(`${namespacePrefix}_`)) {
          directScopeLabel = label;
        }
      } else {
        fullLabel = label;
      }
    }
    const addr = value !== void 0 ? value : this.host.currentTargetAddress;
    if (this.host.isDefinitionCollectionStage) {
      if (modifiesHierarchy && !label.startsWith(".")) {
        this.host.currentParentLabel = fullLabel;
        this.host.currentParentIsGlobal = isGlobal;
      }
      this.host.labelTable.set(fullLabel, {
        value: addr,
        isStatic,
        isMacroLabel,
        macroInstance: isMacroLabel ? this.host.macroLabelInstance : void 0,
        modifiesHierarchy
      });
      this.host.recordSymbolDefinition("label", fullLabel, {
        value: addr,
        containerName: this.symbolContainerName(fullLabel, isGlobal)
      });
      if (directScopeLabel) {
        this.host.labelTable.set(directScopeLabel, {
          value: addr,
          isStatic,
          isMacroLabel,
          macroInstance: isMacroLabel ? this.host.macroLabelInstance : void 0,
          modifiesHierarchy: false
        });
      }
      return;
    }
    if (this.host.enforceResolvedLabels) {
      const existingEntry = this.host.labelTable.get(fullLabel);
      if (existingEntry) {
        if (existingEntry.isStatic !== isStatic) {
          throw new Error(`Label '${fullLabel}' is not static and cannot be used in conditionals.`);
        }
        if (!isStatic && existingEntry.value !== addr && !isMacroLabel) {
          throw new Error(
            `Label "${fullLabel}" changed from $${existingEntry.value.toString(16)} to $${addr.toString(16)}`
          );
        }
      }
    }
    if (modifiesHierarchy && !label.startsWith(".")) {
      this.host.currentParentLabel = fullLabel;
      this.host.currentParentIsGlobal = isGlobal;
    }
    this.host.labelTable.set(fullLabel, {
      value: addr,
      isStatic,
      isMacroLabel,
      macroInstance: isMacroLabel ? this.host.macroLabelInstance : void 0,
      modifiesHierarchy
    });
    this.host.recordSymbolDefinition("label", fullLabel, {
      value: addr,
      containerName: this.symbolContainerName(fullLabel, isGlobal)
    });
    if (directScopeLabel) {
      this.host.labelTable.set(directScopeLabel, {
        value: addr,
        isStatic,
        isMacroLabel,
        macroInstance: isMacroLabel ? this.host.macroLabelInstance : void 0,
        modifiesHierarchy: false
      });
    }
  }
  /**
   * Resolves a struct member.
   * @param {string} compoundId The compound ID of the struct member.
   * @returns {number} The address of the struct member.
   */
  resolveStructMember(compoundId) {
    const firstId = compoundId.trim().match(/^([A-Z_a-z]\w*)/)?.[1];
    if (!firstId || !this.host.structs.has(firstId))
      throw new Error(`Struct not found: ${compoundId}`);
    let rest = compoundId.substring(firstId.length).trim();
    let base = 0;
    let currentStruct = this.host.structs.get(firstId);
    if (!currentStruct) {
      throw new Error(`Struct not found: ${compoundId}`);
    }
    while (rest.length > 0) {
      if (rest.startsWith(".")) {
        rest = rest.substring(1).trim();
        const memberMatch = rest.match(/^([A-Z_a-z]\w*)/);
        if (!memberMatch) throw new Error(`Invalid struct member: ${compoundId}`);
        const memberName = memberMatch[1];
        rest = rest.substring(memberName.length).trim();
        const memberOffset = currentStruct.labels.get(memberName);
        if (memberOffset !== void 0) {
          return base + memberOffset;
        }
        const childStruct = this.host.structs.get(memberName);
        if (childStruct && childStruct.parent === currentStruct.name) {
          currentStruct = childStruct;
        } else {
          throw new Error(`Struct member not found: ${currentStruct.name}.${memberName}`);
        }
      } else if (rest.startsWith("[")) {
        const bracketEnd = rest.indexOf("]");
        if (bracketEnd === -1) throw new Error(`Unclosed [ in struct ref: ${compoundId}`);
        const indexStr = rest.substring(1, bracketEnd).trim();
        const index = Number.parseInt(indexStr, 10);
        if (Number.isNaN(index)) throw new Error(`Invalid struct index: ${indexStr}`);
        rest = rest.substring(bracketEnd + 1).trim();
        base += index * currentStruct.size;
      } else {
        break;
      }
    }
    return base;
  }
  /**
   * Gets the value of a label.
   * @param {string} label The label to get the value of.
   * @param {boolean} requireStatic Whether the label must be static.
   * @returns {number} The value of the label.
   */
  getLabelValue(label, requireStatic) {
    const value = this.tryGetLabelValue(label, requireStatic);
    if (value !== void 0) {
      return value;
    }
    if (this.host.isDefinitionCollectionStage) {
      return 0;
    }
    throw new Error(`Error: Label '${label}' not found.`);
  }
  /**
   * Tries to get a scoped label value without allocating an Error for a miss.
   * @param {string} label The label to get the value of.
   * @param {boolean} requireStatic Whether the label must be static.
   * @returns {number | undefined} The value, or undefined when not found.
   */
  tryGetLabelValue(label, requireStatic) {
    if (parseUnnamedLabelReference(label)) {
      if (!this.host.enforceResolvedLabels) {
        return void 0;
      }
      return this.findUnnamedLabel(label);
    }
    const cheap = this.toCheapDotLabel(label);
    if (cheap !== label) {
      return this.tryGetLabelValue(cheap, requireStatic);
    }
    if (label.startsWith(".") && this.host.currentParentLabel) {
      let dotCount = 0;
      while (label[dotCount] === ".") {
        dotCount++;
      }
      const localName = label.substring(dotCount);
      const candidates = /* @__PURE__ */ new Set();
      const nestedLocalParts = localName.split("_").filter(Boolean);
      const hierarchyChain = this.getHierarchyChain(this.host.currentParentLabel);
      let currentLocalName;
      if (hierarchyChain.length >= 2) {
        const parentPrefix = `${hierarchyChain[hierarchyChain.length - 2]}_`;
        if (this.host.currentParentLabel.startsWith(parentPrefix)) {
          currentLocalName = this.host.currentParentLabel.slice(parentPrefix.length);
        }
      }
      const addCandidate = (candidate) => {
        if (candidate === this.host.currentParentLabel && currentLocalName !== localName) {
          return;
        }
        candidates.add(candidate);
      };
      const addExactLocalCandidate = (parentPrefix) => {
        addCandidate(`${parentPrefix}_${localName}`);
      };
      const addShortenedLocalCandidates = (parentPrefix) => {
        for (let i = 1; i < nestedLocalParts.length; i++) {
          addCandidate(`${parentPrefix}_${nestedLocalParts.slice(i).join("_")}`);
        }
      };
      addExactLocalCandidate(this.host.currentParentLabel);
      for (const ancestorPrefix of this.getAncestorPrefixes(this.host.currentParentLabel)) {
        addExactLocalCandidate(ancestorPrefix);
      }
      for (let i = hierarchyChain.length - 2; i >= 0; i--) {
        addExactLocalCandidate(hierarchyChain[i]);
      }
      addShortenedLocalCandidates(this.host.currentParentLabel);
      for (const ancestorPrefix of this.getAncestorPrefixes(this.host.currentParentLabel)) {
        addShortenedLocalCandidates(ancestorPrefix);
      }
      for (let i = hierarchyChain.length - 2; i >= 0; i--) {
        addShortenedLocalCandidates(hierarchyChain[i]);
      }
      for (const candidate of candidates) {
        const value = this.tryGetLabelValueDirect(candidate, requireStatic);
        if (value !== void 0) {
          return value;
        }
      }
    }
    const qualified = this.qualifySymbolName(label);
    if (qualified !== label) {
      const scoped = this.tryGetLabelValueDirect(qualified, requireStatic);
      if (scoped !== void 0) {
        return scoped;
      }
    }
    const isMacroLabelRef = label.startsWith("?");
    if (isMacroLabelRef && this.host.inMacroExpansion) {
      const labelName = label.substring(1);
      if (labelName.includes("_")) {
        const [parentPart, subPart] = labelName.split("_", 2);
        const childLabel = `:macro_${this.host.macroLabelInstance}_.${subPart}`;
        const childEntry = this.host.labelTable.get(childLabel);
        if (childEntry) {
          if (requireStatic && !childEntry.isStatic) {
            throw new Error(`Error: Non-static macro label '${label}' used in conditional.`);
          }
          return childEntry.value;
        }
        const parentChildLabel = `:macro_${this.host.macroLabelInstance}_${parentPart}_${subPart}`;
        const parentChildEntry = this.host.labelTable.get(parentChildLabel);
        if (parentChildEntry) {
          if (requireStatic && !parentChildEntry.isStatic) {
            throw new Error(`Error: Non-static macro label '${label}' used in conditional.`);
          }
          return parentChildEntry.value;
        }
      }
      const macroLabel = `:macro_${this.host.macroLabelInstance}_${labelName}`;
      const macroEntry = this.host.labelTable.get(macroLabel);
      if (macroEntry) {
        if (requireStatic && !macroEntry.isStatic) {
          throw new Error(`Error: Non-static macro label '${label}' used in conditional.`);
        }
        return macroEntry.value;
      }
      if (labelName.startsWith(".")) {
        const macroLabelNoDot = `:macro_${this.host.macroLabelInstance}_${labelName}`;
        const macroNoDotEntry = this.host.labelTable.get(macroLabelNoDot);
        if (macroNoDotEntry) {
          if (requireStatic && !macroNoDotEntry.isStatic) {
            throw new Error(`Error: Non-static macro label '${label}' used in conditional.`);
          }
          return macroNoDotEntry.value;
        }
      }
    }
    if (label.includes(":") || label.includes("_")) {
      return this.tryGetLabelValueDirect(label, requireStatic);
    }
    if (this.host.namespaceNestingEnabled && this.host.namespaceNestingPath.length > 0) {
      for (let i = this.host.namespaceNestingPath.length; i >= 0; i--) {
        const namespacePath = this.host.namespaceNestingPath.slice(0, i);
        const namespacePrefix = namespacePath.join("_");
        const fullLabel = namespacePrefix ? `${namespacePrefix}_${label}` : label;
        const value = this.tryGetLabelValueDirect(fullLabel, requireStatic);
        if (value !== void 0) {
          return value;
        }
      }
    }
    if (this.host.currentNamespace) {
      const value = this.tryGetLabelValueDirect(
        `${this.host.currentNamespace}_${label}`,
        requireStatic
      );
      if (value !== void 0) {
        return value;
      }
    }
    return this.tryGetLabelValueDirect(label, requireStatic);
  }
  /**
   * Gets the value of a label directly.
   * @param {string} label The label to get the value of.
   * @param {boolean} requireStatic Whether the label must be static.
   * @returns {number} The value of the label.
   */
  getLabelValueDirect(label, requireStatic) {
    const value = this.tryGetLabelValueDirect(label, requireStatic);
    if (value !== void 0) {
      return value;
    }
    if (this.host.isDefinitionCollectionStage) {
      return 0;
    }
    throw new Error(`Error: Label '${label}' not found.`);
  }
  /**
   * Tries a direct label lookup without allocating an Error for ordinary misses.
   * @param {string} label The label to get the value of.
   * @param {boolean} requireStatic Whether the label must be static.
   * @returns {number | undefined} The value, or undefined when not found.
   */
  tryGetLabelValueDirect(label, requireStatic) {
    if (label.includes("_") && !label.includes(":")) {
      const parts = label.split("_");
      if (parts.length === 2) {
        const parentLabel = parts[0];
        const localLabel = `.${parts[1]}`;
        const combinedLabel = `${parentLabel}_${localLabel.replace(/^\./, "")}`;
        const combinedEntry = this.host.labelTable.get(combinedLabel);
        if (combinedEntry) {
          if (requireStatic && !combinedEntry.isStatic) {
            throw new Error(`Error: Non-static label '${combinedLabel}' used in conditional.`);
          }
          return combinedEntry.value;
        }
        const localEntry = this.host.labelTable.get(localLabel);
        if (localEntry) {
          if (requireStatic && !localEntry.isStatic) {
            throw new Error(`Error: Non-static label '${localLabel}' used in conditional.`);
          }
          return localEntry.value;
        }
      }
    }
    const entry = this.host.labelTable.get(label);
    if (!entry) {
      return void 0;
    }
    if (requireStatic && !entry.isStatic) {
      throw new Error(`Error: Non-static label '${label}' used in conditional.`);
    }
    return entry.value;
  }
  /**
   * Gets the size of a struct or extension.
   * @param {string} identifier The identifier of the struct or extension.
   * @param {boolean} [baseOnly] If true, returns only the base size without extensions.
   * @returns {number} The size of the struct or extension.
   * @throws {Error} If the struct or extension doesn't exist.
   */
  getObjectSize(identifier, baseOnly = false) {
    let workingIdentifier = identifier;
    if (workingIdentifier.startsWith('"') && workingIdentifier.endsWith('"')) {
      workingIdentifier = workingIdentifier.substring(1, workingIdentifier.length - 1);
    }
    const directDef = this.host.structs.get(workingIdentifier);
    if (directDef) {
      if (baseOnly) {
        return directDef.size;
      }
      return !directDef.parent ? directDef.size + directDef.extensionSize : directDef.size;
    }
    if (workingIdentifier.includes(".")) {
      const parts = workingIdentifier.split(".").filter(Boolean);
      let current = parts[0];
      if (!this.host.structs.has(current)) {
        throw new Error(`Struct '${workingIdentifier}' doesn't exist.`);
      }
      for (let i = 1; i < parts.length; i++) {
        const child = parts[i];
        const childDef = this.host.structs.get(child);
        if (!childDef || childDef.parent !== current) {
          throw new Error(`Struct '${workingIdentifier}' doesn't exist.`);
        }
        current = child;
      }
      workingIdentifier = current;
    }
    if (!this.host.structs.has(workingIdentifier)) {
      throw new Error(`Struct '${workingIdentifier}' doesn't exist.`);
    }
    const def = this.host.structs.get(workingIdentifier);
    if (!def) {
      throw new Error(`Struct '${workingIdentifier}' doesn't exist.`);
    }
    if (baseOnly) {
      return def.size;
    }
    return !def.parent ? def.size + def.extensionSize : def.size;
  }
  /**
   * Returns the outline container for a stored label name.
   * Sublabels nest under their parent; namespaced labels nest under the namespace.
   * @param {string} fullLabel The stored label name.
   * @param {boolean} isGlobal Whether the label is global.
   * @returns {string | undefined} The container name, if any.
   */
  symbolContainerName(fullLabel, isGlobal) {
    const parent = this.host.labelParents.get(fullLabel);
    if (parent) {
      return parent;
    }
    if (!isGlobal && this.host.currentNamespace && fullLabel.startsWith(`${this.host.currentNamespace}_`)) {
      return this.host.currentNamespace;
    }
    return void 0;
  }
  /**
   * Handles a label definition.
   * @param {string} labelName The name of the label.
   */
  handleLabelDefinition(labelName) {
    labelName = this.toCheapDotLabel(labelName);
    if (!(labelName.startsWith(".") || labelName.startsWith("#."))) {
      labelName = this.qualifySymbolName(labelName);
    }
    if (labelName.startsWith(".") || labelName.startsWith("#.")) {
      if (!this.host.currentParentLabel) {
        throw new Error("Sublabel without parent label");
      }
      const isHashLabel2 = labelName.startsWith("#");
      const modifiesHierarchy2 = !isHashLabel2;
      let dotCount = 0;
      while (labelName[dotCount] === ".") {
        dotCount++;
      }
      const subLabelName = labelName.substring(dotCount);
      const parentLabel = this.getScopedParentLabel(dotCount);
      const directScopeLabel = `${parentLabel}_${subLabelName}`;
      this.host.labelParents.set(directScopeLabel, parentLabel);
      if (this.host.currentNamespace) {
        const namespacePrefix = this.host.namespaceNestingEnabled ? this.host.namespaceNestingPath.join("_") : this.host.currentNamespace;
        if (!directScopeLabel.startsWith(`${namespacePrefix}_`)) {
          const namespacedLabel = this.qualifyNamespaceAlias(namespacePrefix, directScopeLabel);
          const qualifiedParent = this.qualifyNamespaceAlias(namespacePrefix, parentLabel);
          this.host.labelParents.set(namespacedLabel, qualifiedParent);
          this.setLabel(directScopeLabel, void 0, false, false, false, modifiesHierarchy2);
          if (modifiesHierarchy2) {
            this.host.currentParentLabel = directScopeLabel;
            this.host.currentParentIsGlobal = dotCount === 1;
          }
          this.setLabel(namespacedLabel, void 0, false, false, false, modifiesHierarchy2);
          return;
        }
      }
      this.setLabel(directScopeLabel, void 0, false, false, false, modifiesHierarchy2);
      if (modifiesHierarchy2) {
        this.host.currentParentLabel = directScopeLabel;
        this.host.currentParentIsGlobal = dotCount === 1;
      }
      if (this.host.currentNamespace) {
        const namespacePrefix = this.host.namespaceNestingEnabled ? this.host.namespaceNestingPath.join("_") : this.host.currentNamespace;
        if (!directScopeLabel.startsWith(`${namespacePrefix}_`)) {
          const namespacedLabel = this.qualifyNamespaceAlias(namespacePrefix, directScopeLabel);
          this.setLabel(namespacedLabel, void 0, false, false, false, modifiesHierarchy2);
        }
      }
      return;
    }
    const isHashLabel = labelName.startsWith("#");
    const modifiesHierarchy = !isHashLabel;
    if (modifiesHierarchy) {
      this.host.currentParentLabel = labelName;
      this.host.currentParentIsGlobal = true;
      this.host.currentGlobalParentLabel = labelName;
    }
    this.host.labelParents.set(labelName, null);
    this.setLabel(labelName, void 0, false, false, false, modifiesHierarchy);
    if (modifiesHierarchy) {
      this.host.currentParentLabel = labelName;
      this.host.currentParentIsGlobal = true;
      this.host.currentGlobalParentLabel = labelName;
    }
    if (this.host.currentNamespace) {
      const namespacePrefix = this.host.namespaceNestingEnabled ? this.host.namespaceNestingPath.join("_") : this.host.currentNamespace;
      if (!labelName.startsWith(`${namespacePrefix}_`)) {
        const namespacedLabel = this.qualifyNamespaceAlias(namespacePrefix, labelName);
        this.setLabel(namespacedLabel, void 0, false, false, false, modifiesHierarchy);
      }
    }
  }
};
function fileBasename(file) {
  const normalized = file.replaceAll("\\", "/");
  const slash = normalized.lastIndexOf("/");
  return slash === -1 ? normalized : normalized.slice(slash + 1);
}
function parseUnnamedLabelReference(token) {
  const match = token.trim().match(/^:(\++|-+)$/);
  if (!match) {
    return void 0;
  }
  const signs = match[1];
  return {
    direction: signs[0] === "+" ? 1 : -1,
    count: signs.length
  };
}

// packages/core/src/file-provider.ts
import fs2 from "node:fs";
import path from "node:path";
var NodeAssemblyFileProvider = class {
  /**
   * Resolves path.
   * @param {string} filename The filename.
   * @param {AssemblyFileResolutionOptions} [options] The options.
   * @returns {string | undefined} The result.
   */
  resolvePath(filename, options = {}) {
    if (!filename) {
      return void 0;
    }
    const normalized = stripWrappingQuotes(filename);
    if (path.isAbsolute(normalized)) {
      return fs2.existsSync(normalized) ? normalized : void 0;
    }
    const candidates = /* @__PURE__ */ new Set();
    const baseDirectories = [
      options.macroSourceFile ? path.dirname(options.macroSourceFile) : void 0,
      options.currentFile ? path.dirname(options.currentFile) : void 0,
      ...options.includePaths ?? [],
      process.cwd()
    ].filter((entry) => Boolean(entry));
    for (const baseDirectory of baseDirectories) {
      candidates.add(path.resolve(baseDirectory, normalized));
    }
    for (const candidate of candidates) {
      if (fs2.existsSync(candidate)) {
        return candidate;
      }
    }
    return void 0;
  }
  /**
   * Reads metadata for the value.
   * @param {string} filePath The file path.
   * @returns {AssemblyFileStat} The result.
   */
  stat(filePath) {
    let st;
    try {
      st = fs2.statSync(filePath);
    } catch {
      return { exists: false, readable: false };
    }
    try {
      fs2.accessSync(filePath, fs2.constants.R_OK);
      return { exists: true, readable: true, size: st.size, mtimeMs: st.mtimeMs };
    } catch {
      return { exists: true, readable: false, mtimeMs: st.mtimeMs };
    }
  }
  /**
   * Reads file.
   * @param {string} filePath The file path.
   * @returns {Uint8Array} The result.
   */
  readFile(filePath) {
    return new Uint8Array(fs2.readFileSync(filePath));
  }
  /**
   * Reads text file.
   * @param {string} filePath The file path.
   * @param {BufferEncoding} [encoding] The encoding.
   * @returns {string} The result.
   */
  readTextFile(filePath, encoding = "utf8") {
    return fs2.readFileSync(filePath, encoding);
  }
};
function stripWrappingQuotes(filename) {
  if (filename.startsWith('"') && filename.endsWith('"') || filename.startsWith("'") && filename.endsWith("'") || filename.startsWith("`") && filename.endsWith("`")) {
    return filename.slice(1, -1);
  }
  return filename;
}

// packages/core/src/plugin/contracts.ts
var PLUGIN_API_VERSION = 1;
function definePlugin(plugin2) {
  return plugin2;
}

// packages/core/src/plugin/diagnostics.ts
var PluginError = class extends Error {
  code;
  pluginId;
  pluginModule;
  contributionId;
  targetId;
  cause;
  constructor(message, context) {
    super(message, { cause: context.cause });
    this.name = "PluginError";
    this.code = context.code;
    this.pluginId = context.pluginId;
    this.pluginModule = context.pluginModule;
    this.contributionId = context.contributionId;
    this.targetId = context.targetId;
    this.cause = context.cause;
  }
};

// packages/core/src/lsp/directive-catalog.ts
var descriptor = (keyword, summary, syntax, group, operands) => ({
  keyword,
  summary,
  syntax,
  group,
  ...operands ? { operands } : {}
});
var directiveCatalog = [
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
  descriptor("struct", "Begin a structure definition.", "struct name [extends parent]", "struct", [
    {
      keyword: "extends",
      summary: "Inherit members from an existing struct.",
      syntax: "struct name extends parent"
    }
  ]),
  descriptor("endstruct", "End a structure definition.", "endstruct [align value]", "struct", [
    {
      keyword: "align",
      summary: "Round the struct size/stride up to an alignment.",
      syntax: "endstruct align value"
    }
  ]),
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
var directiveCatalogMap = new Map(
  directiveCatalog.map((entry) => [entry.keyword.toLowerCase(), entry])
);

// packages/core/src/plugin/environment.ts
var canonical = (value) => value.toLowerCase();
var toMap = (records) => new Map(records.map((record) => [canonical(record.contributionId), record]));
var targetInvalid = (target, message) => {
  throw new PluginError(`Invalid target '${target.contributionId}': ${message}`, {
    code: "PLUGIN_TARGET_INVALID",
    pluginId: target.pluginId,
    contributionId: target.contributionId,
    targetId: target.contributionId
  });
};
var ResolvedToolingCatalog = class {
  constructor(target, architectures, architectureAliases, directiveSets, expressionSets, targets) {
    this.target = target;
    this.architectures = architectures;
    this.architectureAliases = architectureAliases;
    this.directiveSets = directiveSets;
    this.expressionSets = expressionSets;
    this.targets = targets;
  }
  target;
  architectures;
  architectureAliases;
  directiveSets;
  expressionSets;
  targets;
  getInstructions(architecture) {
    const id = this.architectureAliases.get(canonical(architecture)) ?? canonical(architecture);
    if (!this.target.architectures.some((arch) => canonical(arch) === id)) {
      return [];
    }
    return this.architectures.get(id)?.value.instructions ?? [];
  }
  getDirectives() {
    const enabledCoreGroups = new Set(
      this.target.coreDirectiveGroups ?? CORE_DIRECTIVE_GROUPS
    );
    const core = directiveCatalog.filter((descriptor2) => enabledCoreGroups.has(descriptor2.group));
    const contributed = this.target.directiveSets.flatMap((id) => {
      const set = this.directiveSets.get(canonical(id))?.value;
      return set ? [...set.tooling ?? [], ...set.directives.flatMap((item) => item.tooling)] : [];
    });
    return Object.freeze([
      ...new Map(
        [...core, ...contributed].map((descriptor2) => [canonical(descriptor2.keyword), descriptor2])
      ).values()
    ]);
  }
  getExpressionFunctions() {
    return this.target.expressionSets.flatMap(
      (id) => this.expressionSets.get(canonical(id))?.value.functions.map((item) => ({
        name: item.name,
        aliases: item.aliases ?? [],
        signature: item.signature,
        summary: item.summary
      })) ?? []
    );
  }
  getArchitectures() {
    return this.target.architectures.flatMap((id) => {
      const contribution = this.architectures.get(canonical(id))?.value;
      return contribution ? [
        {
          id: contribution.id,
          aliases: contribution.aliases ?? [],
          displayName: contribution.displayName
        }
      ] : [];
    });
  }
  getTargets() {
    return this.targets.map(({ value }) => ({
      id: value.id,
      aliases: value.aliases ?? [],
      displayName: value.displayName,
      defaultArchitecture: value.defaultArchitecture,
      defaultOutputExtension: value.defaultOutputExtension
    }));
  }
};
var AssemblerEnvironment = class {
  manifests;
  sessionStates;
  #architectures;
  #addressSpaces;
  #outputFormats;
  #directiveSets;
  #expressionSets;
  #lifecycles;
  #targets;
  #targetAliases;
  #architectureAliasesByTarget;
  #targetRecords;
  constructor(contributions) {
    this.manifests = contributions.manifests;
    this.sessionStates = contributions.sessionStates;
    this.#architectures = toMap(contributions.architectures);
    this.#addressSpaces = toMap(contributions.addressSpaces);
    this.#outputFormats = toMap(contributions.outputFormats);
    this.#directiveSets = toMap(contributions.directiveSets);
    this.#expressionSets = toMap(contributions.expressionSets);
    this.#lifecycles = toMap(contributions.lifecycles);
    this.#targets = toMap(contributions.targets);
    this.#targetRecords = contributions.targets;
    const targetAliases = /* @__PURE__ */ new Map();
    for (const target of contributions.targets) {
      for (const alias of [target.contributionId, ...target.value.aliases ?? []]) {
        const key = canonical(alias);
        const previous = targetAliases.get(key);
        if (previous && previous !== target.contributionId) {
          const previousOwner = this.#targets.get(canonical(previous))?.pluginId;
          throw new PluginError(
            `Target alias '${alias}' is owned by both '${previousOwner}' and '${target.pluginId}'.`,
            {
              code: "PLUGIN_ALIAS_DUPLICATE",
              pluginId: target.pluginId,
              contributionId: target.contributionId,
              targetId: target.contributionId
            }
          );
        }
        targetAliases.set(key, target.contributionId);
      }
    }
    this.#targetAliases = targetAliases;
    const aliasesByTarget = /* @__PURE__ */ new Map();
    for (const target of contributions.targets) {
      aliasesByTarget.set(target.contributionId, this.#validateTarget(target));
    }
    this.#architectureAliasesByTarget = aliasesByTarget;
    Object.freeze(this);
  }
  #validateTarget(targetRecord) {
    const target = targetRecord.value;
    if (!this.#addressSpaces.has(canonical(target.addressSpace))) {
      targetInvalid(targetRecord, `missing address-space contribution '${target.addressSpace}'.`);
    }
    if (!this.#outputFormats.has(canonical(target.outputFormat))) {
      targetInvalid(targetRecord, `missing output-format contribution '${target.outputFormat}'.`);
    }
    if (!target.defaultOutputExtension.startsWith(".") || target.defaultOutputExtension.length < 2) {
      targetInvalid(targetRecord, "defaultOutputExtension must begin with '.'.");
    }
    const architectureIds = new Set(target.architectures.map(canonical));
    const aliases = /* @__PURE__ */ new Map();
    for (const architectureId of architectureIds) {
      const record = this.#architectures.get(architectureId);
      if (!record) {
        targetInvalid(targetRecord, `missing architecture contribution '${architectureId}'.`);
      }
      for (const alias of [record.value.id, ...record.value.aliases ?? []]) {
        const key = canonical(alias);
        const previous = aliases.get(key);
        if (previous && previous !== architectureId) {
          const previousOwner = this.#architectures.get(previous)?.pluginId;
          throw new PluginError(
            `Architecture alias '${alias}' in target '${target.id}' is owned by both '${previousOwner}' and '${record.pluginId}'.`,
            {
              code: "PLUGIN_ALIAS_DUPLICATE",
              pluginId: record.pluginId,
              contributionId: record.contributionId,
              targetId: target.id
            }
          );
        }
        aliases.set(key, architectureId);
      }
    }
    const defaultArchitecture = aliases.get(canonical(target.defaultArchitecture));
    if (!defaultArchitecture || !architectureIds.has(defaultArchitecture)) {
      targetInvalid(
        targetRecord,
        `default architecture '${target.defaultArchitecture}' is not available in this target.`
      );
    }
    const directiveKeywords = /* @__PURE__ */ new Map();
    for (const setId of target.directiveSets) {
      const set = this.#directiveSets.get(canonical(setId));
      if (!set) {
        targetInvalid(targetRecord, `missing directive-set contribution '${setId}'.`);
      }
      for (const directive2 of set.value.directives) {
        for (const keyword of directive2.keywords) {
          const key = canonical(keyword);
          const previous = directiveKeywords.get(key);
          if (previous) {
            targetInvalid(
              targetRecord,
              `directive keyword '${keyword}' is supplied by '${previous.id}' (${previous.pluginId}) and '${directive2.id}' (${set.pluginId}).`
            );
          }
          directiveKeywords.set(key, { id: directive2.id, pluginId: set.pluginId });
        }
      }
    }
    const expressionNames = /* @__PURE__ */ new Map();
    for (const setId of target.expressionSets) {
      const set = this.#expressionSets.get(canonical(setId));
      if (!set) {
        targetInvalid(targetRecord, `missing expression-set contribution '${setId}'.`);
      }
      for (const expression of set.value.functions) {
        for (const name of [expression.name, ...expression.aliases ?? []]) {
          const key = canonical(name);
          const previous = expressionNames.get(key);
          if (previous) {
            targetInvalid(
              targetRecord,
              `expression function '${name}' is supplied by '${previous.name}' (${previous.pluginId}) and '${expression.name}' (${set.pluginId}).`
            );
          }
          expressionNames.set(key, { name: expression.name, pluginId: set.pluginId });
        }
      }
    }
    for (const lifecycleId of target.lifecycle) {
      if (!this.#lifecycles.has(canonical(lifecycleId))) {
        targetInvalid(targetRecord, `missing lifecycle contribution '${lifecycleId}'.`);
      }
    }
    return aliases;
  }
  resolveTargetId(idOrAlias) {
    return this.#targetAliases.get(canonical(idOrAlias));
  }
  getTarget(idOrAlias) {
    const id = this.resolveTargetId(idOrAlias);
    return id ? this.#targets.get(canonical(id))?.value : void 0;
  }
  getTargetSummaries() {
    return Object.freeze(
      this.#targetRecords.map(
        ({ value }) => Object.freeze({
          id: value.id,
          aliases: Object.freeze([...value.aliases ?? []]),
          displayName: value.displayName,
          defaultArchitecture: value.defaultArchitecture,
          defaultOutputExtension: value.defaultOutputExtension
        })
      )
    );
  }
  resolveArchitectureId(targetId, idOrAlias) {
    const id = this.resolveTargetId(targetId);
    return id ? this.#architectureAliasesByTarget.get(id)?.get(canonical(idOrAlias)) : void 0;
  }
  getArchitecture(id) {
    return this.#architectures.get(canonical(id))?.value;
  }
  getAddressSpace(id) {
    return this.#addressSpaces.get(canonical(id))?.value;
  }
  getOutputFormat(id) {
    return this.#outputFormats.get(canonical(id))?.value;
  }
  getDirectiveSet(id) {
    return this.#directiveSets.get(canonical(id))?.value;
  }
  getExpressionSet(id) {
    return this.#expressionSets.get(canonical(id))?.value;
  }
  getLifecycle(id) {
    return this.#lifecycles.get(canonical(id))?.value;
  }
  getContributionOwner(id) {
    const key = canonical(id);
    return this.#architectures.get(key)?.pluginId ?? this.#addressSpaces.get(key)?.pluginId ?? this.#outputFormats.get(key)?.pluginId ?? this.#directiveSets.get(key)?.pluginId ?? this.#expressionSets.get(key)?.pluginId ?? this.#lifecycles.get(key)?.pluginId ?? this.#targets.get(key)?.pluginId;
  }
  getTargetLifecycles(targetId) {
    const target = this.getTarget(targetId);
    if (!target) {
      throw new PluginError(`Unknown target '${targetId}'.`, {
        code: "PLUGIN_TARGET_INVALID",
        targetId
      });
    }
    return Object.freeze(
      target.lifecycle.flatMap((id) => {
        const lifecycle = this.#lifecycles.get(canonical(id));
        return lifecycle ? [lifecycle] : [];
      }).sort((left, right) => left.registrationOrder - right.registrationOrder)
    );
  }
  getToolingCatalog(targetId) {
    const resolvedId = this.resolveTargetId(targetId);
    const target = resolvedId ? this.#targets.get(canonical(resolvedId))?.value : void 0;
    if (!target || !resolvedId) {
      throw new PluginError(`Unknown target '${targetId}'.`, {
        code: "PLUGIN_TARGET_INVALID",
        targetId
      });
    }
    return Object.freeze(
      new ResolvedToolingCatalog(
        target,
        this.#architectures,
        this.#architectureAliasesByTarget.get(resolvedId) ?? /* @__PURE__ */ new Map(),
        this.#directiveSets,
        this.#expressionSets,
        this.#targetRecords
      )
    );
  }
};

// packages/core/src/plugin/manager.ts
var import_semver = __toESM(require_semver2(), 1);
var noopLogger = {
  debug: () => void 0,
  info: () => void 0,
  warn: () => void 0,
  error: () => void 0
};
var isLowerAlphaNumeric = (character) => character >= "a" && character <= "z" || character >= "0" && character <= "9";
var isValidId = (value, allowLeadingDigit = false) => {
  if (value.length === 0 || !isLowerAlphaNumeric(value[0]) || !allowLeadingDigit && (value[0] < "a" || value[0] > "z")) {
    return false;
  }
  let previousWasSeparator = false;
  for (const character of value) {
    const separator = character === "." || character === "-";
    if (!isLowerAlphaNumeric(character) && !separator) return false;
    if (separator && previousWasSeparator) return false;
    previousWasSeparator = separator;
  }
  return !previousWasSeparator;
};
var isValidContributionId = (value) => value.includes(".") && isValidId(value, true);
var isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
var isArray = (value) => Array.isArray(value);
var isEmptyOptions = (value) => value === void 0 || isRecord(value) && Object.keys(value).length === 0;
var deepFreeze = (value, seen = /* @__PURE__ */ new Set()) => {
  if (typeof value !== "object" && typeof value !== "function" || value === null || seen.has(value)) {
    return value;
  }
  seen.add(value);
  if (Array.isArray(value)) {
    for (const item of value) deepFreeze(item, seen);
  } else {
    for (const item of Object.values(value)) deepFreeze(item, seen);
  }
  return Object.freeze(value);
};
var validateText = (value, field, pluginId) => {
  if (typeof value !== "string" || value.trim() === "") {
    throw new PluginError(`Plugin field '${field}' must be a non-empty string.`, {
      code: "PLUGIN_INVALID_MANIFEST",
      pluginId
    });
  }
  return value;
};
var validateManifest = (manifest, pluginModule) => {
  if (!isRecord(manifest)) {
    throw new PluginError("Plugin manifest must be an object.", {
      code: "PLUGIN_INVALID_MANIFEST",
      pluginModule
    });
  }
  const id = validateText(manifest.id, "id");
  if (!isValidId(id)) {
    throw new PluginError(`Plugin ID '${id}' is invalid.`, {
      code: "PLUGIN_INVALID_MANIFEST",
      pluginId: id,
      pluginModule
    });
  }
  const name = validateText(manifest.name, "name", id);
  const version = validateText(manifest.version, "version", id);
  if (!import_semver.default.valid(version)) {
    throw new PluginError(`Plugin '${id}' has invalid semantic version '${version}'.`, {
      code: "PLUGIN_INVALID_MANIFEST",
      pluginId: id,
      pluginModule
    });
  }
  if (manifest.apiVersion !== PLUGIN_API_VERSION) {
    throw new PluginError(
      `Plugin '${id}' requires plugin API ${String(manifest.apiVersion)}; this host supports ${PLUGIN_API_VERSION}.`,
      { code: "PLUGIN_API_INCOMPATIBLE", pluginId: id, pluginModule }
    );
  }
  if (manifest.description !== void 0 && typeof manifest.description !== "string") {
    throw new PluginError(`Plugin '${id}' description must be a string.`, {
      code: "PLUGIN_INVALID_MANIFEST",
      pluginId: id,
      pluginModule
    });
  }
  if (manifest.requires !== void 0 && !Array.isArray(manifest.requires)) {
    throw new PluginError(`Plugin '${id}' dependencies must be an array.`, {
      code: "PLUGIN_INVALID_MANIFEST",
      pluginId: id,
      pluginModule
    });
  }
  const requires = (manifest.requires ?? []).map((dependency) => {
    if (!isRecord(dependency)) {
      throw new PluginError(`Plugin '${id}' has a malformed dependency.`, {
        code: "PLUGIN_INVALID_MANIFEST",
        pluginId: id,
        pluginModule
      });
    }
    const pluginId = validateText(dependency.pluginId, "requires.pluginId", id);
    const range = validateText(dependency.version, "requires.version", id);
    if (!isValidId(pluginId) || !import_semver.default.validRange(range)) {
      throw new PluginError(`Plugin '${id}' has invalid dependency '${pluginId}@${range}'.`, {
        code: "PLUGIN_INVALID_MANIFEST",
        pluginId: id,
        pluginModule
      });
    }
    return { pluginId, version: range };
  });
  return deepFreeze({
    id,
    name,
    version,
    apiVersion: PLUGIN_API_VERSION,
    ...manifest.description === void 0 ? {} : { description: manifest.description },
    ...requires.length === 0 ? {} : { requires }
  });
};
var validatePlugin = (value, pluginModule) => {
  if (!isRecord(value) || typeof value.activate !== "function") {
    throw new PluginError(
      `Module '${pluginModule ?? "<programmatic>"}' has no valid default plugin export.`,
      {
        code: "PLUGIN_INVALID_EXPORT",
        pluginModule
      }
    );
  }
  const manifest = validateManifest(value.manifest, pluginModule);
  if (value.validateOptions !== void 0 && typeof value.validateOptions !== "function") {
    throw new PluginError(`Plugin '${manifest.id}' validateOptions must be a function.`, {
      code: "PLUGIN_INVALID_EXPORT",
      pluginId: manifest.id,
      pluginModule
    });
  }
  const plugin2 = value;
  return {
    manifest,
    ...plugin2.validateOptions ? { validateOptions: plugin2.validateOptions.bind(plugin2) } : {},
    activate: plugin2.activate.bind(plugin2)
  };
};
var validateContributionId = (id, pluginId) => {
  if (typeof id !== "string" || !isValidContributionId(id)) {
    throw new PluginError(
      `Plugin '${pluginId}' registered invalid contribution ID '${String(id)}'.`,
      {
        code: "PLUGIN_CONFIGURATION_INVALID",
        pluginId,
        contributionId: typeof id === "string" ? id : void 0
      }
    );
  }
  return id;
};
var validateAliases = (aliases, pluginId, contributionId) => {
  if (aliases === void 0) return;
  if (!Array.isArray(aliases) || aliases.some((alias) => typeof alias !== "string" || alias === "")) {
    throw new PluginError(`Contribution '${contributionId}' has invalid aliases.`, {
      code: "PLUGIN_CONFIGURATION_INVALID",
      pluginId,
      contributionId
    });
  }
};
var PluginManager = class {
  #logger;
  #activated = [];
  #manifests = /* @__PURE__ */ new Map();
  #contributionOwners = /* @__PURE__ */ new Map();
  #sessionStates = [];
  #architectures = [];
  #addressSpaces = [];
  #outputFormats = [];
  #directiveSets = [];
  #expressionSets = [];
  #lifecycles = [];
  #targets = [];
  #registrationOrder = 0;
  #environment;
  #disposed = false;
  constructor(options = {}) {
    this.#logger = options.logger ?? noopLogger;
  }
  get activatedPlugins() {
    return this.#activated.map((item) => item.manifest);
  }
  async activateModules(requests) {
    const normalized = requests.map((request) => {
      if (!isRecord(request.module) || !("default" in request.module)) {
        throw new PluginError(`Module '${request.pluginModule}' has no default export.`, {
          code: "PLUGIN_INVALID_EXPORT",
          pluginModule: request.pluginModule
        });
      }
      return {
        plugin: validatePlugin(request.module.default, request.pluginModule),
        options: request.options,
        pluginModule: request.pluginModule
      };
    });
    await this.activatePlugins(normalized);
  }
  async activatePlugins(requests) {
    if (this.#disposed) {
      throw new PluginError("Cannot activate plugins after the manager has been disposed.", {
        code: "PLUGIN_ACTIVATION_FAILED"
      });
    }
    if (this.#environment) {
      throw new PluginError("Cannot activate plugins after the environment has been frozen.", {
        code: "PLUGIN_ACTIVATION_FAILED"
      });
    }
    const normalized = requests.map((request) => ({
      ...request,
      plugin: validatePlugin(request.plugin, request.pluginModule)
    }));
    const pending = /* @__PURE__ */ new Map();
    for (const request of normalized) {
      const id = request.plugin.manifest.id;
      if (this.#manifests.has(id) || pending.has(id)) {
        throw new PluginError(`Duplicate plugin ID '${id}'.`, {
          code: "PLUGIN_CONTRIBUTION_DUPLICATE",
          pluginId: id,
          pluginModule: request.pluginModule
        });
      }
      pending.set(id, request);
    }
    const available = new Map(this.#manifests);
    for (const [id, request] of pending) available.set(id, request.plugin.manifest);
    for (const request of normalized) {
      for (const dependency of request.plugin.manifest.requires ?? []) {
        const installed = available.get(dependency.pluginId);
        if (!installed) {
          throw new PluginError(
            `Plugin '${request.plugin.manifest.id}' requires missing plugin '${dependency.pluginId}'.`,
            {
              code: "PLUGIN_DEPENDENCY_MISSING",
              pluginId: request.plugin.manifest.id,
              pluginModule: request.pluginModule
            }
          );
        }
        if (!import_semver.default.satisfies(installed.version, dependency.version)) {
          throw new PluginError(
            `Plugin '${request.plugin.manifest.id}' requires '${dependency.pluginId}@${dependency.version}', but ${installed.version} is active.`,
            {
              code: "PLUGIN_DEPENDENCY_INCOMPATIBLE",
              pluginId: request.plugin.manifest.id,
              pluginModule: request.pluginModule
            }
          );
        }
      }
    }
    const activatedThisCall = new Set(this.#manifests.keys());
    while (pending.size > 0) {
      const ready = [...pending.values()].find(
        (request) => (request.plugin.manifest.requires ?? []).every(
          (dependency) => activatedThisCall.has(dependency.pluginId)
        )
      );
      if (!ready) {
        const ids = [...pending.keys()].join(", ");
        throw new PluginError(`Plugin dependency cycle among: ${ids}.`, {
          code: "PLUGIN_DEPENDENCY_CYCLE"
        });
      }
      await this.#activateOne(ready);
      pending.delete(ready.plugin.manifest.id);
      activatedThisCall.add(ready.plugin.manifest.id);
    }
  }
  async #activateOne(request) {
    const plugin2 = request.plugin;
    const manifest = plugin2.manifest;
    let options;
    try {
      if (plugin2.validateOptions) {
        options = plugin2.validateOptions(request.options);
      } else if (isEmptyOptions(request.options)) {
        options = {};
      } else {
        throw new PluginError(`Plugin '${manifest.id}' does not accept options.`, {
          code: "PLUGIN_CONFIGURATION_INVALID",
          pluginId: manifest.id,
          pluginModule: request.pluginModule
        });
      }
    } catch (error) {
      if (error instanceof PluginError) throw error;
      throw new PluginError(`Configuration for plugin '${manifest.id}' is invalid.`, {
        code: "PLUGIN_CONFIGURATION_INVALID",
        pluginId: manifest.id,
        pluginModule: request.pluginModule,
        cause: error
      });
    }
    const frozenOptions = deepFreeze(options);
    const transaction = this.#createTransaction(manifest, request.pluginModule);
    const context = this.#createActivationContext(transaction, frozenOptions);
    let disposable;
    try {
      disposable = await plugin2.activate(context, frozenOptions);
      if (disposable !== void 0 && (!isRecord(disposable) || typeof disposable.dispose !== "function")) {
        throw new Error("activate() returned an invalid disposable.");
      }
      this.#validateTransaction(transaction);
      this.#commit(transaction);
      this.#activated.push({
        manifest,
        module: request.pluginModule,
        disposable: disposable ?? void 0
      });
      this.#manifests.set(manifest.id, manifest);
    } catch (error) {
      if (disposable) await disposable.dispose();
      if (error instanceof PluginError) throw error;
      throw new PluginError(`Activation failed for plugin '${manifest.id}'.`, {
        code: "PLUGIN_ACTIVATION_FAILED",
        pluginId: manifest.id,
        pluginModule: request.pluginModule,
        cause: error
      });
    }
  }
  #createTransaction(manifest, module) {
    return {
      manifest,
      module,
      sessionStates: [],
      architectures: [],
      addressSpaces: [],
      outputFormats: [],
      directiveSets: [],
      expressionSets: [],
      lifecycles: [],
      targets: []
    };
  }
  #createActivationContext(transaction, options) {
    const add = (list, contribution) => {
      const contributionId = validateContributionId(contribution.id, transaction.manifest.id);
      list.push({
        pluginId: transaction.manifest.id,
        contributionId,
        registrationOrder: this.#registrationOrder++,
        value: contribution
      });
    };
    const logger = this.#namespacedLogger(transaction.manifest.id);
    return Object.freeze({
      pluginId: transaction.manifest.id,
      logger,
      options,
      registerSessionState: (contribution) => {
        add(
          transaction.sessionStates,
          contribution
        );
        return Object.freeze({ id: contribution.id });
      },
      registerArchitecture: (contribution) => add(transaction.architectures, contribution),
      registerAddressSpace: (contribution) => add(transaction.addressSpaces, contribution),
      registerOutputFormat: (contribution) => add(transaction.outputFormats, contribution),
      registerDirectiveSet: (contribution) => add(transaction.directiveSets, contribution),
      registerExpressionSet: (contribution) => add(transaction.expressionSets, contribution),
      registerLifecycle: (contribution) => add(transaction.lifecycles, contribution),
      registerTarget: (contribution) => add(transaction.targets, contribution)
    });
  }
  #namespacedLogger(pluginId) {
    const log = (level) => (message, details) => this.#logger[level](`[${pluginId}] ${message}`, details);
    return Object.freeze({
      debug: log("debug"),
      info: log("info"),
      warn: log("warn"),
      error: log("error")
    });
  }
  #validateTransaction(transaction) {
    const local = /* @__PURE__ */ new Set();
    const all = [
      ...transaction.sessionStates,
      ...transaction.architectures,
      ...transaction.addressSpaces,
      ...transaction.outputFormats,
      ...transaction.directiveSets,
      ...transaction.expressionSets,
      ...transaction.lifecycles,
      ...transaction.targets
    ];
    for (const record of all) {
      const id = record.contributionId.toLowerCase();
      const existingOwner = this.#contributionOwners.get(id);
      if (existingOwner || local.has(id)) {
        throw new PluginError(
          `Contribution '${record.contributionId}' from '${transaction.manifest.id}' conflicts with owner '${existingOwner ?? transaction.manifest.id}'.`,
          {
            code: "PLUGIN_CONTRIBUTION_DUPLICATE",
            pluginId: transaction.manifest.id,
            pluginModule: transaction.module,
            contributionId: record.contributionId
          }
        );
      }
      local.add(id);
    }
    for (const record of transaction.architectures) {
      validateAliases(record.value.aliases, transaction.manifest.id, record.contributionId);
      if (typeof record.value.displayName !== "string" || typeof record.value.createEncoder !== "function" || typeof record.value.classifyOperand !== "function" || typeof record.value.splitOperands !== "function" || !isArray(record.value.instructions)) {
        throw new PluginError(`Architecture '${record.contributionId}' is malformed.`, {
          code: "PLUGIN_CONFIGURATION_INVALID",
          pluginId: transaction.manifest.id,
          contributionId: record.contributionId
        });
      }
    }
    for (const record of transaction.addressSpaces) {
      if (typeof record.value.create !== "function") this.#malformed(transaction, record);
    }
    for (const record of transaction.outputFormats) {
      if (typeof record.value.create !== "function") this.#malformed(transaction, record);
    }
    for (const record of transaction.sessionStates) {
      if (typeof record.value.create !== "function" || typeof record.value.clone !== "function") {
        this.#malformed(transaction, record);
      }
    }
    for (const record of transaction.directiveSets) {
      if (!isArray(record.value.directives) || record.value.tooling !== void 0 && !isArray(record.value.tooling)) {
        this.#malformed(transaction, record);
      }
      for (const directive2 of record.value.directives) {
        validateContributionId(directive2.id, transaction.manifest.id);
        if (local.has(directive2.id.toLowerCase()) || this.#contributionOwners.has(directive2.id.toLowerCase())) {
          throw new PluginError(`Duplicate directive contribution '${directive2.id}'.`, {
            code: "PLUGIN_CONTRIBUTION_DUPLICATE",
            pluginId: transaction.manifest.id,
            contributionId: directive2.id
          });
        }
        local.add(directive2.id.toLowerCase());
        if (!isArray(directive2.keywords) || directive2.keywords.length === 0 || directive2.keywords.some(
          (keyword) => typeof keyword !== "string" || keyword === ""
        ) || typeof directive2.createHandler !== "function" || !isArray(directive2.tooling)) {
          throw new PluginError(`Directive '${directive2.id}' is malformed.`, {
            code: "PLUGIN_CONFIGURATION_INVALID",
            pluginId: transaction.manifest.id,
            contributionId: directive2.id
          });
        }
      }
    }
    for (const record of transaction.expressionSets) {
      if (!isArray(record.value.functions)) this.#malformed(transaction, record);
      for (const expression of record.value.functions) {
        validateAliases(expression.aliases, transaction.manifest.id, record.contributionId);
        if (typeof expression.name !== "string" || expression.name === "" || typeof expression.evaluate !== "function" || typeof expression.summary !== "string" || !isRecord(expression.signature)) {
          this.#malformed(transaction, record);
        }
      }
    }
    for (const record of transaction.lifecycles) {
      if (typeof record.value.create !== "function") this.#malformed(transaction, record);
    }
    for (const record of transaction.targets) {
      validateAliases(record.value.aliases, transaction.manifest.id, record.contributionId);
      if (typeof record.value.displayName !== "string" || typeof record.value.defaultArchitecture !== "string" || !isArray(record.value.architectures) || typeof record.value.addressSpace !== "string" || typeof record.value.outputFormat !== "string" || !isArray(record.value.directiveSets) || record.value.coreDirectiveGroups !== void 0 && (!isArray(record.value.coreDirectiveGroups) || record.value.coreDirectiveGroups.some(
        (group) => typeof group !== "string" || !CORE_DIRECTIVE_GROUPS.includes(group)
      )) || !isArray(record.value.expressionSets) || !isArray(record.value.lifecycle) || record.value.syntaxProfile !== void 0 && (typeof record.value.syntaxProfile.id !== "string" || typeof record.value.syntaxProfile.preserveLeadingWhitespace !== "boolean" || typeof record.value.syntaxProfile.splitColonStatements !== "boolean" || typeof record.value.syntaxProfile.splitRelativeLabelStatements !== "boolean" || typeof record.value.syntaxProfile.leadingDotLabels !== "boolean" || !isArray(record.value.syntaxProfile.directivePrefixes)) || typeof record.value.defaultOutputExtension !== "string") {
        this.#malformed(transaction, record);
      }
    }
  }
  #malformed(transaction, record) {
    throw new PluginError(`Contribution '${record.contributionId}' is malformed.`, {
      code: "PLUGIN_CONFIGURATION_INVALID",
      pluginId: transaction.manifest.id,
      pluginModule: transaction.module,
      contributionId: record.contributionId
    });
  }
  #commit(transaction) {
    const lists = [
      transaction.sessionStates,
      transaction.architectures,
      transaction.addressSpaces,
      transaction.outputFormats,
      transaction.directiveSets,
      transaction.expressionSets,
      transaction.lifecycles,
      transaction.targets
    ];
    for (const list of lists) {
      for (const record of list) {
        this.#contributionOwners.set(record.contributionId.toLowerCase(), record.pluginId);
        deepFreeze(record.value);
        Object.freeze(record);
      }
    }
    for (const set of transaction.directiveSets) {
      for (const directive2 of set.value.directives) {
        this.#contributionOwners.set(directive2.id.toLowerCase(), set.pluginId);
      }
    }
    this.#sessionStates.push(...transaction.sessionStates);
    this.#architectures.push(...transaction.architectures);
    this.#addressSpaces.push(...transaction.addressSpaces);
    this.#outputFormats.push(...transaction.outputFormats);
    this.#directiveSets.push(...transaction.directiveSets);
    this.#expressionSets.push(...transaction.expressionSets);
    this.#lifecycles.push(...transaction.lifecycles);
    this.#targets.push(...transaction.targets);
  }
  freeze() {
    if (this.#disposed) {
      throw new PluginError("Cannot freeze a disposed plugin manager.", {
        code: "PLUGIN_ACTIVATION_FAILED"
      });
    }
    if (this.#environment) return this.#environment;
    const contributions = {
      manifests: deepFreeze([...this.#manifests.values()]),
      sessionStates: Object.freeze([...this.#sessionStates]),
      architectures: Object.freeze([...this.#architectures]),
      addressSpaces: Object.freeze([...this.#addressSpaces]),
      outputFormats: Object.freeze([...this.#outputFormats]),
      directiveSets: Object.freeze([...this.#directiveSets]),
      expressionSets: Object.freeze([...this.#expressionSets]),
      lifecycles: Object.freeze([...this.#lifecycles]),
      targets: Object.freeze([...this.#targets])
    };
    this.#environment = new AssemblerEnvironment(contributions);
    return this.#environment;
  }
  async dispose() {
    if (this.#disposed) return;
    this.#disposed = true;
    const errors = [];
    for (const plugin2 of [...this.#activated].reverse()) {
      try {
        await plugin2.disposable?.dispose();
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length > 0) {
      throw new AggregateError(errors, "One or more plugins failed to dispose.");
    }
  }
};

// packages/core/src/plugin/session-state.ts
var PluginSessionStateStore = class {
  #contributions;
  #values;
  #disposed = false;
  constructor(contributions, context) {
    this.#contributions = contributions;
    this.#values = /* @__PURE__ */ new Map();
    for (const record of contributions) {
      try {
        this.#values.set(record.contributionId, record.value.create(context));
      } catch (cause) {
        throw new PluginError(
          `Session state factory '${record.contributionId}' from '${record.pluginId}' failed.`,
          {
            code: "PLUGIN_ACTIVATION_FAILED",
            pluginId: record.pluginId,
            contributionId: record.contributionId,
            targetId: context.targetId,
            cause
          }
        );
      }
    }
  }
  get(slot) {
    if (!this.#values.has(slot.id)) {
      throw new PluginError(`Session state slot '${slot.id}' is not active.`, {
        code: "PLUGIN_CONFIGURATION_INVALID",
        contributionId: slot.id
      });
    }
    return this.#values.get(slot.id);
  }
  cloneSnapshot(source = this.#values) {
    const snapshot = /* @__PURE__ */ new Map();
    for (const record of this.#contributions) {
      if (!source.has(record.contributionId)) {
        throw new PluginError(`Session state snapshot is missing '${record.contributionId}'.`, {
          code: "PLUGIN_CONFIGURATION_INVALID",
          pluginId: record.pluginId,
          contributionId: record.contributionId
        });
      }
      try {
        snapshot.set(record.contributionId, record.value.clone(source.get(record.contributionId)));
      } catch (cause) {
        throw new PluginError(`Session state clone '${record.contributionId}' failed.`, {
          code: "PLUGIN_HOOK_FAILED",
          pluginId: record.pluginId,
          contributionId: record.contributionId,
          cause
        });
      }
    }
    return snapshot;
  }
  restore(snapshot) {
    this.#values = snapshot;
  }
  resetForStage(stage) {
    for (const record of this.#contributions) {
      const reset = record.value.resetForStage;
      if (!reset) continue;
      try {
        reset(this.#values.get(record.contributionId), stage);
      } catch (cause) {
        throw new PluginError(`Session state reset '${record.contributionId}' failed.`, {
          code: "PLUGIN_HOOK_FAILED",
          pluginId: record.pluginId,
          contributionId: record.contributionId,
          cause
        });
      }
    }
  }
  dispose() {
    if (this.#disposed) return;
    this.#disposed = true;
    const errors = [];
    for (const record of [...this.#contributions].reverse()) {
      try {
        record.value.dispose?.(this.#values.get(record.contributionId));
      } catch (error) {
        errors.push(error);
      }
    }
    this.#values.clear();
    if (errors.length > 0) {
      throw new AggregateError(errors, "One or more plugin session-state slots failed to dispose.");
    }
  }
};

// packages/core/src/assembler.ts
var debug4 = (..._args) => {
};
try {
  const { default: d } = await import("debug");
  debug4 = d("Assembler");
} catch {
}
var TOOLING_ANALYSIS_STAGES = ["collectDefinitions"];
var Assembler = class _Assembler {
  /** The current logical target address. */
  currentTargetAddress = 0;
  /** The current logical target base address. */
  currentTargetBaseAddress = 0;
  /** The current target start address. `startpos` */
  currentTargetStartAddress = 0;
  /** The current target base start address. `realstartpos` */
  currentTargetBaseStartAddress = 0;
  bytes = 0;
  pushBaseStack = [];
  /** Mutable bytes produced by this assembly session. */
  outputBytes = [];
  /** Byte used when expanding a sparse output range. */
  outputFillByte = 0;
  whileStatus = [];
  namespaceStack = [];
  currentNamespace = "";
  namespaceNestingEnabled = false;
  namespaceNestingPath = [];
  // Current macro tracking
  inMacroDefinition = false;
  currentMacroName = "";
  currentMacroParams = [];
  currentMacroBody = [];
  currentVariadicCount = void 0;
  currentVariadicArgs = [];
  macros = /* @__PURE__ */ new Map();
  mathCore;
  operandResolver;
  addressToLineMapping = new AddressToLineMapping();
  currentFile = "";
  currentLine = 0;
  /** Optional sink for structured tracing used by tests and ad-hoc debug scripts. */
  traceListener = null;
  /** Active command contexts so nested byte writes inherit the right source line. */
  traceCommandStack = [];
  defines = /* @__PURE__ */ new Map();
  /** Bare numeric values exposed only while executing typed `for` loops. */
  activeLoopVariables = /* @__PURE__ */ new Map();
  // Character mapping support
  characterMappings = /* @__PURE__ */ new Map();
  currentTable = null;
  tableStack = [];
  inFunctionDefinition = false;
  functionDefinitionLines = [];
  arch = "";
  pushpcStack = [];
  pushpcnum = 0;
  labelTable = /* @__PURE__ */ new Map();
  /** ca65 `.export` / `.import` names that stay session-global. */
  globalSymbols = /* @__PURE__ */ new Set();
  /** Track multiple `+` labels */
  forwardLabels = {};
  /** Track multiple `-` labels */
  backwardLabels = {};
  padUnit = 1;
  padbyte = [];
  structs = /* @__PURE__ */ new Map();
  currentStruct = null;
  savedPCStack = [];
  /** Initialize fill pattern */
  fillbyte = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  baseImage;
  // Add a static property to hold our CRC table.
  static crcTable = null;
  includedFiles = /* @__PURE__ */ new Map();
  includeStack = [];
  includePaths = ["./"];
  macroLabelInstance = 0;
  // Tracks the current macro instance
  inMacroExpansion = false;
  // Flag to track if we're inside a macro expansion
  currentParentLabel = "";
  // Track the most recent parent label
  currentParentIsGlobal = false;
  // Track if the parent label is global
  currentGlobalParentLabel = "";
  // Track the active top-level parent for single-dot labels
  labelParents = /* @__PURE__ */ new Map();
  // Track explicit label ancestry without relying on underscores
  requireStaticLabelLookup = false;
  passProgramCache = /* @__PURE__ */ new Map();
  directiveRegistry;
  architectureRegistry;
  environment;
  targetId;
  targetOptions;
  syntaxProfile;
  coreDirectiveGroups;
  pluginState;
  pluginAddressSpace;
  pluginOutputFormat;
  activeLifecycles;
  cursorAddress;
  fileProvider;
  frontEndService;
  programModelBuilder;
  commandLoweringService;
  incrementalProgramParseState;
  services;
  stageExecutionStates = /* @__PURE__ */ new Map();
  diagnostics = [];
  symbolDefinitions = [];
  symbolReferences = [];
  /** Deduplication index for {@link symbolDefinitions} — O(1) vs. the former O(n) `.some()` scan. */
  #symbolDefinitionKeys = /* @__PURE__ */ new Set();
  /** Deduplication index for {@link symbolReferences} — O(1) vs. the former O(n) `.some()` scan. */
  #symbolReferenceKeys = /* @__PURE__ */ new Set();
  /** Deduplication index for {@link includeEdges} — O(1) vs. O(n) `.some()` scan. */
  #includeEdgeKeys = /* @__PURE__ */ new Set();
  includeEdges = [];
  collectSourceMetadata;
  /** When false, `incsrc`/`include` record an edge but do not parse the included file. */
  followIncludes = true;
  activeStageExecutionState = null;
  analysisErrorRecoveryEnabled = false;
  runtimePassthroughRewriteEnabled = false;
  sessionDisposed = false;
  get defineEngine() {
    return this.services.defineEngine;
  }
  get directiveRuntime() {
    return this.services.directiveRuntime;
  }
  get addressWidth() {
    return this.pluginAddressSpace.addressWidth;
  }
  get availableArchitectures() {
    return new Set(this.environment.getTarget(this.targetId)?.architectures ?? []);
  }
  get targetDisplayName() {
    return this.environment.getTarget(this.targetId)?.displayName ?? this.targetId;
  }
  get frontEndCommandService() {
    return this.services.frontEndCommandService;
  }
  get includeSource() {
    return this.services.includeSource;
  }
  get macroEngine() {
    return this.services.macroEngine;
  }
  get symbolScope() {
    return this.services.symbolScope;
  }
  get outputWriter() {
    return this.services.outputWriter;
  }
  get structEngine() {
    return this.services.structEngine;
  }
  // Core assembler wrapper helpers
  get currentAddress() {
    return this.currentTargetAddress;
  }
  /**
   * Records current address.
   */
  recordCurrentAddress() {
    this.addAddressToLine(
      normalizeAddressForWidth(this.currentTargetBaseAddress, this.addressWidth)
    );
  }
  /**
   * Sets write position.
   * @param {number} address The address.
   */
  setWritePosition(address) {
    this.currentTargetAddress = address;
    this.currentTargetBaseAddress = address;
    this.currentTargetStartAddress = address;
    this.currentTargetBaseStartAddress = address;
    if (this.activeStageExecutionState) {
      this.activeStageExecutionState.cursor.currentTargetAddress = address;
      this.activeStageExecutionState.cursor.currentTargetBaseAddress = address;
      this.activeStageExecutionState.cursor.currentTargetStartAddress = address;
      this.activeStageExecutionState.cursor.currentTargetBaseStartAddress = address;
    }
  }
  /**
   * Enters struct definition.
   * @param {number} base The base.
   */
  enterStructDefinition(base) {
    this.savedPCStack.push(this.currentTargetAddress);
    this.cursorAddress.setWritePosition(base);
  }
  /**
   * Restores struct definition.
   */
  restoreStructDefinition() {
    if (this.savedPCStack.length === 0) {
      return;
    }
    const previousPosition = this.savedPCStack.pop();
    if (previousPosition !== void 0) {
      this.cursorAddress.setWritePosition(previousPosition);
    }
  }
  /**
   * Synchronizes write starts.
   */
  syncWriteStarts() {
    this.currentTargetStartAddress = this.currentTargetAddress;
    this.currentTargetBaseStartAddress = this.currentTargetBaseAddress;
  }
  /**
   * Increments bytes written.
   * @param {number} num The num.
   */
  incrementBytesWritten(num) {
    this.bytes += num;
  }
  get mode() {
    return this.getActiveStageCapabilities().instructionMode;
  }
  get canEmitBytes() {
    return this.getActiveStageCapabilities().canEmitBytes;
  }
  get canFinalize() {
    return this.getActiveStageCapabilities().canFinalize;
  }
  get enforceResolvedLabels() {
    return this.getActiveStageCapabilities().enforceResolvedLabels;
  }
  get isDefinitionCollectionStage() {
    return this.getActiveStageCapabilities().isDefinitionCollectionStage;
  }
  /**
   * Reports whether structured tracing is active for this assembly session.
   * @returns {boolean} Whether a trace listener is installed.
   */
  get isTracing() {
    return this.traceListener !== null;
  }
  /**
   * Traces write.
   * @param {Omit<AssemblerTraceWriteEvent, "type">} event The event.
   */
  traceWrite(event) {
    const source = this.traceCommandStack[this.traceCommandStack.length - 1];
    this.traceListener?.({
      type: "write",
      ...event,
      file: source?.file ?? this.currentFile,
      line: source?.line ?? this.currentLine,
      raw: source?.raw ?? "",
      normalized: source?.normalized ?? ""
    });
  }
  /**
   * Installs or clears the structured trace listener.
   * @param {AssemblerTraceListener | null} listener The listener to receive trace events.
   */
  setTraceListener(listener) {
    this.traceListener = listener;
  }
  /**
   * Clears accumulated diagnostics and symbol definitions.
   */
  clearAnalysisArtifacts() {
    this.diagnostics.length = 0;
    this.symbolDefinitions.length = 0;
    this.symbolReferences.length = 0;
    this.includeEdges.length = 0;
    this.#symbolDefinitionKeys.clear();
    this.#symbolReferenceKeys.clear();
    this.#includeEdgeKeys.clear();
  }
  /**
   * Records a directed include-graph edge if it has not already been recorded.
   * Includes execute once per pass, so edges are de-duplicated by file pair.
   * @param {string} fromFile The file issuing the include directive.
   * @param {string} toFile The resolved path of the included file.
   */
  recordIncludeEdge(fromFile, toFile) {
    if (!this.collectSourceMetadata) {
      return;
    }
    if (!fromFile || !toFile) {
      return;
    }
    const edgeKey = `${fromFile}\0${toFile}`;
    if (this.#includeEdgeKeys.has(edgeKey)) {
      return;
    }
    this.#includeEdgeKeys.add(edgeKey);
    this.includeEdges.push({ fromFile, toFile });
  }
  /**
   * Returns the current source location.
   * @param {SourceSpan} [span] Optional source span override.
   * @returns {AssemblySourceLocation} The current source location.
   */
  getCurrentSourceLocation(span) {
    return createAssemblySourceLocation(this.currentFile, this.currentLine, span);
  }
  /**
   * Converts and records an unknown error.
   * @param {unknown} error The error to normalize.
   * @param {SourceSpan} [span] Optional source span override.
   * @param {string} [stage] Optional stage name.
   * @returns {AssemblyDiagnostic} The recorded diagnostic.
   */
  reportErrorDiagnostic(error, span, stage) {
    const diagnostic = diagnosticFromError(error, this.getCurrentSourceLocation(span), stage);
    this.diagnostics.push(diagnostic);
    return diagnostic;
  }
  /**
   * Records a symbol definition if it has not already been recorded.
   * @param {AssemblySymbolKind} kind The symbol kind.
   * @param {string} name The symbol name.
   * @param {{ file?: string; line?: number; span?: SourceSpan; value?: number | string; containerName?: string }} [options] Optional symbol metadata.
   * @param {string} [options.file] Optional source file override.
   * @param {number} [options.line] Optional source line override.
   * @param {SourceSpan} [options.span] Optional precise source span.
   * @param {number | string} [options.value] Optional resolved symbol value.
   * @param {string} [options.containerName] Optional owning container name.
   */
  recordSymbolDefinition(kind, name, options = {}) {
    if (!this.collectSourceMetadata) {
      return;
    }
    const file = options.file ?? this.currentFile;
    const line = options.line ?? this.currentLine;
    const dedupeKey = `${kind}\0${name}\0${file}\0${line}\0${options.containerName ?? ""}`;
    if (this.#symbolDefinitionKeys.has(dedupeKey)) {
      return;
    }
    this.#symbolDefinitionKeys.add(dedupeKey);
    this.symbolDefinitions.push({
      name,
      kind,
      location: createAssemblySourceLocation(file, line, options.span),
      value: options.value,
      containerName: options.containerName
    });
  }
  /**
   * Records a symbol reference if it has not already been recorded.
   * @param {AssemblySymbolReferenceKind} kind The reference kind.
   * @param {string} name The reference name.
   * @param {{ file?: string; line?: number; span?: SourceSpan; containerName?: string }} [options] Optional reference metadata.
   * @param {string} [options.file] Optional source file override.
   * @param {number} [options.line] Optional source line override.
   * @param {SourceSpan} [options.span] Optional precise source span.
   * @param {string} [options.containerName] Optional owning container name.
   */
  recordSymbolReference(kind, name, options = {}) {
    if (!this.collectSourceMetadata) {
      return;
    }
    const file = options.file ?? this.currentFile;
    const line = options.line ?? this.currentLine;
    const dedupeKey = `${kind}\0${name}\0${file}\0${line}\0${options.containerName ?? ""}`;
    if (this.#symbolReferenceKeys.has(dedupeKey)) {
      return;
    }
    this.#symbolReferenceKeys.add(dedupeKey);
    this.symbolReferences.push({
      name,
      kind,
      location: createAssemblySourceLocation(file, line, options.span),
      containerName: options.containerName
    });
  }
  /**
   * Collects expression references.
   * @param {ExpressionNode | undefined} expression The expression.
   * @param {SourceSpan} [fallbackSpan] The fallback span.
   */
  collectExpressionReferences(expression, fallbackSpan) {
    if (!expression) {
      return;
    }
    switch (expression.type) {
      case "defineReference":
        if (expression.name || expression.content) {
          this.recordSymbolReference(
            "define",
            expression.braced ? expression.content ?? "" : expression.name ?? ""
          );
        }
        return;
      case "identifier": {
        const segments = this.hierarchicalLabelReferences(expression.name);
        if (segments) {
          for (const segment of segments) {
            this.recordSymbolReference("label", segment.name, {
              containerName: segment.containerName
            });
          }
          return;
        }
        this.recordSymbolReference("label", expression.name);
        return;
      }
      case "member":
      case "index":
        this.collectStructReferenceSegments(expression, fallbackSpan);
        return;
      case "call":
        this.recordSymbolReference("function", expression.callee.name, {
          span: expression.callee.span ?? expression.span ?? fallbackSpan
        });
        for (const argument of expression.arguments) {
          this.collectExpressionReferences(argument, fallbackSpan);
        }
        return;
      case "unary":
        this.collectExpressionReferences(expression.argument, fallbackSpan);
        return;
      case "binary":
        this.collectExpressionReferences(expression.left, fallbackSpan);
        this.collectExpressionReferences(expression.right, fallbackSpan);
        return;
      case "range":
        this.collectExpressionReferences(expression.start, fallbackSpan);
        this.collectExpressionReferences(expression.end, fallbackSpan);
        return;
      default:
        return;
    }
  }
  /**
   * Records one reference per struct-path segment so `obj.timer` can target
   * the struct root and the field independently.
   * @param {ReferenceExpressionNode} expression The struct-rooted reference.
   * @param {SourceSpan} [fallbackSpan] The fallback span.
   */
  collectStructReferenceSegments(expression, fallbackSpan) {
    switch (expression.type) {
      case "identifier":
        this.recordSymbolReference("label", expression.name);
        return;
      case "defineReference":
        this.collectExpressionReferences(expression, fallbackSpan);
        return;
      case "member":
        this.collectStructReferenceSegments(expression.object, fallbackSpan);
        this.recordSymbolReference("label", expression.property.name, {
          span: expression.property.span,
          containerName: this.structSegmentContainerName(expression.object)
        });
        return;
      case "index":
        this.collectStructReferenceSegments(expression.object, fallbackSpan);
        this.collectExpressionReferences(expression.index, fallbackSpan);
        return;
      default:
        return;
    }
  }
  /**
   * Returns the immediate struct/extension name a member should nest under.
   * Strips `[...]` so `obj[19].ext.index` yields `ext` for `index`.
   * Define roots (`!obj_arthur.flags2`) resolve through the define value
   * (`obj_start+obj[0]`) to the actual struct name.
   * @param {ReferenceExpressionNode} object The object of a member access.
   * @returns {string | undefined} The container name.
   */
  structSegmentContainerName(object) {
    switch (object.type) {
      case "identifier":
        return object.name;
      case "defineReference":
        return this.structNameFromDefine(object.name ?? object.content) ?? object.name;
      case "member":
        return object.property.name;
      case "index":
        return this.structSegmentContainerName(object.object);
      default:
        return void 0;
    }
  }
  /**
   * Finds a known struct name in a define's expansion, walking nested defines.
   * @param {string | undefined} name The define name.
   * @param {Set<string>} [seen] Define names already visited.
   * @returns {string | undefined} The struct name, if any.
   */
  structNameFromDefine(name, seen = /* @__PURE__ */ new Set()) {
    if (!name || seen.has(name)) {
      return void 0;
    }
    seen.add(name);
    const value = this.defines.get(name);
    if (value === void 0) {
      return void 0;
    }
    return this.structNameFromExpression(parseExpressionNode(value), seen);
  }
  /**
   * Walks an expression right-to-left looking for a known struct identifier.
   * `obj_start+obj[0]` yields `obj`.
   * @param {ExpressionNode} node The expression to search.
   * @param {Set<string>} seen Define names already visited.
   * @returns {string | undefined} The struct name, if any.
   */
  structNameFromExpression(node, seen) {
    switch (node.type) {
      case "identifier":
        return this.structs.has(node.name) ? node.name : void 0;
      case "defineReference":
        return this.structNameFromDefine(node.name ?? node.content, seen);
      case "member":
        if (this.structs.has(node.property.name)) {
          return node.property.name;
        }
        return this.structNameFromExpression(node.object, seen);
      case "index":
        return this.structNameFromExpression(node.object, seen);
      case "binary":
        return this.structNameFromExpression(node.right, seen) ?? this.structNameFromExpression(node.left, seen);
      case "unary":
        return this.structNameFromExpression(node.argument, seen);
      default:
        return void 0;
    }
  }
  /**
   * Splits a hierarchical label (`_018049_8053`) into parent + sublabel
   * segments so each part can be targeted independently.
   * @param {string} name The identifier text.
   * @returns {{ name: string; containerName?: string }[] | undefined} Segments, if this is a known sublabel.
   */
  hierarchicalLabelReferences(name) {
    if (!name.includes("_") || !this.labelTable.has(name)) {
      return void 0;
    }
    const chain = this.symbolScope.getHierarchyChain(name);
    if (chain.length < 2 || chain[chain.length - 1] !== name) {
      return void 0;
    }
    const segments = [];
    for (let index = 0; index < chain.length; index++) {
      const full = chain[index];
      const parent = index > 0 ? chain[index - 1] : void 0;
      if (!parent) {
        segments.push({ name: full });
        continue;
      }
      if (!full.startsWith(`${parent}_`)) {
        return void 0;
      }
      segments.push({
        name: `.${full.slice(parent.length + 1)}`,
        containerName: parent
      });
    }
    return segments;
  }
  /**
   * Collects command references.
   * @param {NormalizedCommand} command The command.
   */
  collectCommandReferences(command) {
    incrementInternalCounter("referenceCollections");
    if (!this.collectSourceMetadata) {
      return;
    }
    const fallbackSpan = command.source.normalizedSpan;
    const parsed = command.parsed;
    this.collectExpressionReferences(parsed.assignment?.expression, fallbackSpan);
    this.collectExpressionReferences(parsed.condition?.expression, fallbackSpan);
    this.collectExpressionReferences(parsed.forLoop?.range, fallbackSpan);
    this.collectExpressionReferences(parsed.forLoop?.start, fallbackSpan);
    this.collectExpressionReferences(parsed.forLoop?.end, fallbackSpan);
    this.collectExpressionReferences(parsed.incbinRange?.range, fallbackSpan);
    this.collectExpressionReferences(parsed.incbinRange?.start, fallbackSpan);
    this.collectExpressionReferences(parsed.incbinRange?.end, fallbackSpan);
    if (parsed.macroInvocation?.name) {
      this.recordSymbolReference("macro", parsed.macroInvocation.name, {
        span: command.source.tokenSpans[0] ?? fallbackSpan
      });
      for (const arg of parsed.macroInvocation.args) {
        this.collectExpressionReferences(parseExpressionNode(arg), fallbackSpan);
      }
    }
    if (parsed.includeTarget?.target) {
      this.recordSymbolReference(
        "include",
        parsed.includeTarget.target.replace(/^["'`](.*)["'`]$/, "$1"),
        {
          span: command.source.tokenSpans[1] ?? fallbackSpan
        }
      );
    }
    if (parsed.opcodeOperands?.mnemonic) {
      this.recordSymbolReference("instruction", parsed.opcodeOperands.mnemonic, {
        span: command.source.tokenSpans[0] ?? fallbackSpan
      });
    }
    for (const operand of parsed.dataDirective?.operands ?? []) {
      this.collectExpressionReferences(parseExpressionNode(operand), fallbackSpan);
    }
    for (const operand of parsed.opcodeOperands?.operands ?? []) {
      this.collectExpressionReferences(parseExpressionNode(operand), fallbackSpan);
    }
    for (const arg of parsed.directiveArgs?.args ?? []) {
      this.collectExpressionReferences(parseExpressionNode(arg), fallbackSpan);
    }
  }
  /**
   * Runs a staged analysis pass and captures the first diagnostic instead of throwing.
   * @param {ProgramModel} program The program model to analyze.
   * @param {ProgramAnalysisOptions} [options] Optional analysis options.
   * @param {boolean} [options.followIncludes] Whether to follow includes.
   * @param {Array<AssemblyStageName>} [options.stages] Optional stages to run.
   * @param {boolean} [options.collectSourceMetadata] Whether to collect source metadata.
   * @returns {AssemblyAnalysisResult} The accumulated diagnostics and symbols.
   */
  collectProgramAnalysis(program, options = {}) {
    this.clearAnalysisArtifacts();
    this.analysisErrorRecoveryEnabled = true;
    const stages = options.stages ?? TOOLING_ANALYSIS_STAGES;
    if (options.followIncludes !== void 0) {
      this.followIncludes = options.followIncludes;
    }
    try {
      for (const stage of stages) {
        this.runStage(stage, program);
      }
    } catch (error) {
      this.reportErrorDiagnostic(error, void 0, this.activeStageExecutionState?.stage);
    } finally {
      this.analysisErrorRecoveryEnabled = false;
    }
    return {
      diagnostics: [...this.diagnostics],
      symbols: [...this.symbolDefinitions],
      references: [...this.symbolReferences],
      includeEdges: [...this.includeEdges]
    };
  }
  /**
   * Creates an isolated assembler session suitable for editor-style analysis.
   * This keeps batch assembly state and tooling state from leaking into each
   * other while still sharing the same file provider and directive registry.
   * @returns {Assembler} A configured analysis session.
   */
  createToolingSession() {
    const session = measureInternalPhase(
      "sessionConstruct",
      () => new _Assembler({
        environment: this.environment,
        target: this.targetId,
        architecture: this.arch,
        targetOptions: this.targetOptions,
        baseImage: this.baseImage,
        fileProvider: this.fileProvider
      })
    );
    session.includePaths = [...this.includePaths];
    session.followIncludes = this.followIncludes;
    measureInternalPhase(
      "pluginStateClone",
      () => session.pluginState.restore(this.pluginState.cloneSnapshot())
    );
    session.outputFillByte = this.outputFillByte;
    session.padbyte = [...this.padbyte];
    session.fillbyte = [...this.fillbyte];
    session.padUnit = this.padUnit;
    session.arch = this.arch;
    incrementInternalCounter("sessionConstructions");
    return session;
  }
  /**
   * Creates directive handlers bound to a fresh session's family capabilities.
   * @param {Assembler} session The session that should receive directive calls.
   * @returns {DirectiveRegistry} A registry bound to the provided session.
   */
  cloneDirectiveRegistryForSession(session) {
    const operandResolver = session.operandResolver;
    const runtime = session.directiveRuntime;
    const registry = createDirectiveRegistry(
      {
        data: { runtime },
        fillPad: { session, operandResolver },
        flowControl: { session },
        includeSource: {
          session,
          includeSource: session.includeSource,
          operandResolver,
          runtime,
          defineEngine: session.defineEngine
        },
        layout: {
          addressStack: { session },
          architecture: { session },
          base: { session, operandResolver },
          org: { runtime },
          runtime: { runtime }
        },
        namespace: { session },
        struct: { session },
        table: { session },
        diagnostic: { session }
      },
      session.coreDirectiveGroups,
      session.syntaxProfile.directivePrefixes
    );
    const target = session.environment.getTarget(session.targetId);
    for (const setId of target?.directiveSets ?? []) {
      const set = session.environment.getDirectiveSet(setId);
      if (!set) continue;
      const pluginId = session.environment.getContributionOwner(setId);
      for (const directive2 of set.directives) {
        let handler;
        try {
          handler = directive2.createHandler({
            targetId: session.targetId,
            state: session.pluginState,
            session
          });
        } catch (cause) {
          throw new PluginError(`Directive factory '${directive2.id}' failed.`, {
            code: "PLUGIN_ACTIVATION_FAILED",
            pluginId,
            contributionId: directive2.id,
            targetId: session.targetId,
            cause
          });
        }
        registry.register(
          [...directive2.keywords],
          void 0,
          (_context, words, raw) => {
            try {
              handler({ state: session.pluginState }, words, raw);
            } catch (cause) {
              const detail = cause instanceof Error ? ` ${cause.message}` : "";
              throw new PluginError(`Directive '${directive2.id}' failed.${detail}`, {
                code: "PLUGIN_HOOK_FAILED",
                pluginId,
                contributionId: directive2.id,
                targetId: session.targetId,
                cause
              });
            }
          },
          directive2.phase
        );
      }
    }
    for (const [keyword, handler] of registry.handlers) {
      registry.handlers.set(keyword, (words, raw, command) => {
        if (session.runBeforeDirective(keyword, words, raw) === "handled") return;
        handler(words, raw, command);
      });
    }
    return registry;
  }
  /**
   * Analyzes program.
   * @param {ProgramModel} program The program.
   * @returns {AssemblyAnalysisResult} The result.
   */
  analyzeProgram(program) {
    const session = this.createToolingSession();
    try {
      return session.collectProgramAnalysis(program);
    } finally {
      session.dispose();
    }
  }
  /**
   * Builds and analyzes raw source without throwing on the first error.
   * @param {string} source The source to analyze.
   * @param {string} [sourceFile] Optional source file override.
   * @param {number} [startLine] Optional starting line number.
   * @param {ProgramAnalysisOptions} [options] Optional analysis options.
   * @returns {AssemblyAnalysisResult & { program: ProgramModel }} The analysis result and program model.
   */
  analyzeSource(source, sourceFile = this.currentFile, startLine = 0, options = {}) {
    const session = this.createToolingSession();
    if (options.followIncludes !== void 0) {
      session.followIncludes = options.followIncludes;
    }
    try {
      const program = session.buildProgramModel(source, sourceFile, startLine);
      return {
        program,
        ...session.collectProgramAnalysis(program, options)
      };
    } finally {
      session.dispose();
    }
  }
  /**
   * Analyzes workspace.
   * @param {Array<{ source: string; sourceFile: string; startLine?: number }>} documents The documents.
   * @param {ProgramAnalysisOptions} [options] Optional analysis options.
   * @returns {Array<AssemblyAnalysisResult & { program: ProgramModel; sourceFile: string }>} The result.
   */
  analyzeWorkspace(documents, options = {}) {
    const results = [];
    for (const document of documents) {
      const session = this.createToolingSession();
      try {
        const program = session.buildProgramModel(
          document.source,
          document.sourceFile,
          document.startLine ?? 0
        );
        const result = session.collectProgramAnalysis(program, options);
        results.push({
          sourceFile: document.sourceFile,
          program,
          ...result
        });
      } finally {
        session.dispose();
      }
    }
    return results;
  }
  /**
   * Loads base-image data.
   */
  seedOutputFromBaseImage() {
    const seedSize = 512 * 1024;
    if (!this.baseImage || this.baseImage.length === 0) {
      return;
    }
    for (let i = 0; i < Math.min(seedSize, this.baseImage.length); i++) {
      this.outputBytes[i] = this.baseImage[i];
    }
  }
  /**
   * Creates cursor address facade.
   * @returns {CursorAddressFacade} The result.
   */
  createCursorAddressFacade() {
    return {
      recordCurrentAddress: () => this.recordCurrentAddress(),
      setWritePosition: (address) => this.setWritePosition(address),
      syncWriteStarts: () => this.syncWriteStarts(),
      incrementBytesWritten: (num) => this.incrementBytesWritten(num)
    };
  }
  /**
   * Creates services.
   * @returns {AssemblerServiceBag} The result.
   */
  createServices() {
    const defineEngine = new DefineEngine(this);
    const directiveRuntime = new DirectiveRuntimeService(this);
    const frontEndCommandService = new FrontEndCommandService(this);
    const includeSource = new IncludeSourceService(this);
    const symbolScope = new SymbolScopeService(this);
    const outputWriter = new OutputWriterService(this);
    const macroEngine = new MacroEngine(this);
    const structEngine = new StructEngine(this);
    return {
      defineEngine,
      directiveRuntime,
      fileProvider: this.fileProvider,
      frontEndCommandService,
      includeSource,
      macroEngine,
      outputWriter,
      structEngine,
      symbolScope
    };
  }
  constructor(options) {
    if (!options?.environment) {
      throw new PluginError("Assembler construction requires a frozen plugin environment.", {
        code: "PLUGIN_CONFIGURATION_INVALID"
      });
    }
    this.environment = options.environment;
    const targetId = this.environment.resolveTargetId(options.target);
    const target = targetId ? this.environment.getTarget(targetId) : void 0;
    if (!targetId || !target) {
      throw new PluginError(`Assembler target '${options.target}' is not available.`, {
        code: "PLUGIN_TARGET_INVALID",
        targetId: options.target
      });
    }
    this.targetId = targetId;
    this.syntaxProfile = target.syntaxProfile ?? ASAR_SYNTAX_PROFILE;
    this.coreDirectiveGroups = target.coreDirectiveGroups ?? CORE_DIRECTIVE_GROUPS;
    const configuredTargetOptions = options.targetOptions;
    if (!target.createOptions && configuredTargetOptions !== void 0) {
      const emptyObject = typeof configuredTargetOptions === "object" && configuredTargetOptions !== null && !Array.isArray(configuredTargetOptions) && Object.keys(configuredTargetOptions).length === 0;
      if (!emptyObject) {
        throw new PluginError(`Target '${targetId}' does not accept options.`, {
          code: "PLUGIN_CONFIGURATION_INVALID",
          pluginId: this.environment.getContributionOwner(targetId),
          contributionId: targetId,
          targetId
        });
      }
    }
    const normalizedTargetOptions = target.createOptions?.(configuredTargetOptions) ?? {};
    this.targetOptions = Object.freeze({ ...normalizedTargetOptions });
    this.pluginState = measureInternalPhase(
      "pluginStateCreate",
      () => new PluginSessionStateStore(this.environment.sessionStates, {
        targetId,
        targetOptions: this.targetOptions
      })
    );
    const targetFactoryContext = {
      targetId,
      options: this.targetOptions,
      state: this.pluginState
    };
    const addressContribution = this.environment.getAddressSpace(target.addressSpace);
    const outputContribution = this.environment.getOutputFormat(target.outputFormat);
    if (!addressContribution || !outputContribution) {
      throw new PluginError(`Target '${targetId}' has unresolved output factories.`, {
        code: "PLUGIN_TARGET_INVALID",
        targetId
      });
    }
    try {
      this.pluginAddressSpace = addressContribution.create(targetFactoryContext);
    } catch (cause) {
      throw new PluginError(`Address-space factory '${target.addressSpace}' failed.`, {
        code: "PLUGIN_ACTIVATION_FAILED",
        pluginId: this.environment.getContributionOwner(target.addressSpace),
        contributionId: target.addressSpace,
        targetId,
        cause
      });
    }
    try {
      this.pluginOutputFormat = outputContribution.create(targetFactoryContext);
    } catch (cause) {
      throw new PluginError(`Output-format factory '${target.outputFormat}' failed.`, {
        code: "PLUGIN_ACTIVATION_FAILED",
        pluginId: this.environment.getContributionOwner(target.outputFormat),
        contributionId: target.outputFormat,
        targetId,
        cause
      });
    }
    const requestedArchitecture = options.architecture ?? target.defaultArchitecture;
    const architectureId = this.environment.resolveArchitectureId(targetId, requestedArchitecture);
    if (!architectureId) {
      throw new PluginError(
        `Architecture '${requestedArchitecture}' is unavailable for target '${targetId}'.`,
        {
          code: "PLUGIN_TARGET_INVALID",
          targetId,
          contributionId: requestedArchitecture
        }
      );
    }
    this.arch = architectureId;
    this.baseImage = options.baseImage ? Uint8Array.from(options.baseImage) : new Uint8Array();
    this.fileProvider = options.fileProvider ?? new NodeAssemblyFileProvider();
    this.collectSourceMetadata = options.collectSourceMetadata ?? true;
    this.cursorAddress = this.createCursorAddressFacade();
    this.mathCore = new MathCore();
    this.mathCore.host = this.expressionHost;
    this.installExpressionFunctions(target.expressionSets);
    this.services = this.createServices();
    const frontEndHost = {
      passProgramCache: this.passProgramCache,
      resolveVariadicPlaceholders: (command) => this.macroEngine.resolveVariadicPlaceholders(command),
      shouldEndifCloseInnermostWhile: (loopType, loopStartLine, ifStartLine) => this.shouldEndifCloseInnermostWhile(loopType, loopStartLine, ifStartLine)
    };
    Object.defineProperties(frontEndHost, {
      currentFile: { get: () => this.currentFile },
      currentLine: { get: () => this.currentLine },
      inMacroExpansion: { get: () => this.inMacroExpansion },
      isDefinitionCollectionStage: { get: () => this.isDefinitionCollectionStage },
      syntaxProfile: { get: () => this.syntaxProfile }
    });
    this.frontEndService = new AssemblyFrontEndService(frontEndHost);
    this.programModelBuilder = this.frontEndService.programModelBuilder;
    this.incrementalProgramParseState = this.programModelBuilder.createIncrementalParseState();
    this.operandResolver = new OperandResolver({
      resolveDefines: (input) => this.resolvedefines(input),
      isStructReference: (input) => this.structEngine.hasStructReference(input),
      resolveStructLabel: (input) => this.structEngine.resolveStructLabel(input),
      tryResolveLabel: (input, requireStatic) => {
        const loopValue = this.activeLoopVariables.get(input.trim());
        if (loopValue !== void 0) return loopValue;
        return this.symbolScope.tryGetLabelValue(input, requireStatic);
      },
      resolveLabel: (input, requireStatic) => {
        const loopValue = this.activeLoopVariables.get(input.trim());
        if (loopValue !== void 0) return loopValue;
        return this.symbolScope.getLabelValue(input, requireStatic);
      },
      evaluateMath: (input) => this.mathCore.math(input),
      shouldDeferExpressionEvaluation: () => !this.getActiveStageCapabilities().enforceResolvedLabels,
      getCurrentAddress: () => this.currentTargetAddress,
      requireStaticLabelLookup: () => this.requireStaticLabelLookup
    });
    const encoderContext = {
      emission: {
        write1: (value) => this.write1(value),
        write2: (value) => this.write2(value),
        write3: (value) => this.write3(value),
        writeByte: (value) => this.write1(value),
        writeBytes: (values) => this.outputWriter.writeBytes(values),
        writeValue: (value, width, endianness) => this.outputWriter.writeValue(value, width, endianness)
      },
      sizing: {
        getCurrentAddress: () => this.currentTargetAddress
      },
      branches: {
        enforceResolvedLabels: () => this.enforceResolvedLabels,
        findNextLabel: (label, referenceAddress) => this.symbolScope.findNextLabel(label, referenceAddress),
        findPreviousLabel: (label, referenceAddress) => this.symbolScope.findPreviousLabel(label, referenceAddress)
      },
      diagnostics: {
        error: (message) => new Error(`${message} (${this.currentFile}:${this.currentLine + 1})`)
      }
    };
    this.architectureRegistry = new ArchitectureRegistry();
    for (const contributionId of target.architectures) {
      const contribution = this.environment.getArchitecture(contributionId);
      if (!contribution) {
        throw new PluginError(`Architecture contribution '${contributionId}' is unavailable.`, {
          code: "PLUGIN_TARGET_INVALID",
          targetId,
          contributionId
        });
      }
      let encoder;
      try {
        const architectureOperands = {
          expandOperand: (operand) => this.operandResolver.expandOperand(operand),
          getnum: (expression) => this.operandResolver.getnum(expression),
          getCurrentAddress: () => this.operandResolver.getCurrentAddress(),
          lowerOperand: (operand) => contribution.classifyOperand({ operands: this.operandResolver }, operand)
        };
        encoder = contribution.createEncoder({
          ...encoderContext,
          operands: architectureOperands,
          targetId,
          options: this.targetOptions,
          state: this.pluginState
        });
      } catch (cause) {
        throw new PluginError(`Architecture factory '${contributionId}' failed.`, {
          code: "PLUGIN_ACTIVATION_FAILED",
          pluginId: this.environment.getContributionOwner(contributionId),
          contributionId,
          targetId,
          cause
        });
      }
      this.architectureRegistry.register(
        {
          name: contribution.id,
          encoder,
          instructions: contribution.instructions.length > 0 ? contribution.instructions : void 0,
          classifyOperand: (resolver, operand) => contribution.classifyOperand({ operands: resolver }, operand),
          splitOperands: contribution.splitOperands,
          unknownInstructionBehavior: contribution.unknownInstructionBehavior
        },
        [...contribution.aliases ?? []]
      );
    }
    this.directiveRegistry = measureInternalPhase(
      "directiveRegistryClone",
      () => this.cloneDirectiveRegistryForSession(this)
    );
    this.commandLoweringService = new CommandLoweringService(this);
    this.services.frontEnd = this.frontEndService;
    this.services.lowering = this.commandLoweringService;
    this.activeLifecycles = this.environment.getTargetLifecycles(targetId).map((record) => {
      try {
        return { record, instance: record.value.create(targetFactoryContext) };
      } catch (cause) {
        throw new PluginError(`Lifecycle factory '${record.contributionId}' failed.`, {
          code: "PLUGIN_ACTIVATION_FAILED",
          pluginId: record.pluginId,
          contributionId: record.contributionId,
          targetId,
          cause
        });
      }
    });
    measureInternalPhase(
      "onSessionCreated",
      () => this.runLifecycleHook(
        "onSessionCreated",
        (lifecycle) => lifecycle.onSessionCreated?.({ state: this.pluginState, session: this })
      )
    );
    this.selectArchitecture(this.arch, this.arch);
    measureInternalPhase(
      "constructorActivateStage",
      () => this.activateStage("collectDefinitions")
    );
    incrementInternalCounter("assemblerConstructions");
  }
  runLifecycleHook(hookName, invoke) {
    for (const { record, instance } of this.activeLifecycles) {
      try {
        invoke(instance);
      } catch (cause) {
        throw new PluginError(`Lifecycle hook '${hookName}' failed.`, {
          code: "PLUGIN_HOOK_FAILED",
          pluginId: record.pluginId,
          contributionId: record.contributionId,
          targetId: this.targetId,
          cause
        });
      }
    }
  }
  runBeforeDirective(keyword, words, raw) {
    let result = "continue";
    this.runLifecycleHook("beforeDirective", (lifecycle) => {
      if (result === "continue" && lifecycle.beforeDirective?.({
        state: this.pluginState,
        session: this,
        keyword,
        words,
        raw
      }) === "handled") {
        result = "handled";
      }
    });
    return result;
  }
  /**
   * Resolves ambiguous `endif` handling through active dialect lifecycles.
   * @param {"for" | "while"} [loopType] The innermost loop type.
   * @param {number} [loopStartLine] The innermost loop start line.
   * @param {number} [ifStartLine] The innermost conditional start line.
   * @returns {boolean} Whether `endif` should close the innermost while loop.
   */
  shouldEndifCloseInnermostWhile(loopType, loopStartLine, ifStartLine) {
    let result = false;
    this.runLifecycleHook("shouldEndifCloseInnermostWhile", (lifecycle) => {
      const resolution = lifecycle.shouldEndifCloseInnermostWhile?.({
        state: this.pluginState,
        session: this,
        loopType,
        loopStartLine,
        ifStartLine
      });
      if (resolution !== void 0) {
        result = resolution;
      }
    });
    return result;
  }
  selectArchitecture(architecture, sourceAlias = architecture) {
    const resolved = this.environment.resolveArchitectureId(this.targetId, architecture);
    if (!resolved) {
      throw new PluginError(
        `Architecture ${architecture} is unavailable for target ${this.targetDisplayName}.`,
        {
          code: "PLUGIN_TARGET_INVALID",
          targetId: this.targetId,
          contributionId: architecture
        }
      );
    }
    const previousArchitecture = this.arch || void 0;
    this.arch = resolved;
    this.runLifecycleHook(
      "onArchitectureSelected",
      (lifecycle) => lifecycle.onArchitectureSelected?.({
        state: this.pluginState,
        session: this,
        previousArchitecture,
        architecture: resolved,
        sourceAlias
      })
    );
  }
  beforeWrite(logicalAddress, width) {
    this.pluginAddressSpace.validateWrite?.(logicalAddress, width);
    this.runLifecycleHook(
      "beforeWrite",
      (lifecycle) => lifecycle.beforeWrite?.({
        state: this.pluginState,
        session: this,
        logicalAddress,
        width
      })
    );
  }
  dispose() {
    if (this.sessionDisposed) return;
    this.sessionDisposed = true;
    const errors = [];
    for (const { record, instance } of [...this.activeLifecycles].reverse()) {
      try {
        instance.onSessionDispose?.({ state: this.pluginState, session: this });
      } catch (cause) {
        errors.push(
          new PluginError("Lifecycle hook 'onSessionDispose' failed.", {
            code: "PLUGIN_HOOK_FAILED",
            pluginId: record.pluginId,
            contributionId: record.contributionId,
            targetId: this.targetId,
            cause
          })
        );
      }
    }
    try {
      this.pluginState.dispose();
    } catch (error) {
      errors.push(error);
    }
    if (errors.length > 0) {
      throw new AggregateError(
        errors,
        "One or more assembler session resources failed to dispose."
      );
    }
  }
  /**
   * Reads little endian.
   * @param {Uint8Array} bytes The bytes.
   * @param {number} pos The pos.
   * @param {number} width The width.
   * @returns {number | undefined} The result.
   */
  readLittleEndian(bytes, pos, width) {
    if (!Number.isInteger(pos) || pos < 0 || pos + width > bytes.length) {
      return void 0;
    }
    let out = 0;
    for (let i = 0; i < width; i++) {
      out |= (bytes[pos + i] ?? 0) << 8 * i;
    }
    return out >>> 0;
  }
  /**
   * Checks whether it can read byte range.
   * @param {number} sourceLength The source length.
   * @param {number} position The position.
   * @param {number} size The size.
   * @returns {number} The result.
   */
  canReadByteRange(sourceLength, position, size) {
    const pos = Math.trunc(position);
    const num = Math.trunc(size);
    return Number.isInteger(pos) && Number.isInteger(num) && pos >= 0 && num >= 0 && pos + num <= sourceLength ? 1 : 0;
  }
  /**
   * Reads byte range.
   * @param {Uint8Array} source The source.
   * @param {number} position The position.
   * @param {number} size The size.
   * @param {number | undefined} defaultValue The default value.
   * @param {string} errorMessage The error message.
   * @returns {number} The result.
   */
  readByteRange(source, position, size, defaultValue, errorMessage) {
    const pos = Math.trunc(position);
    const num = Math.trunc(size);
    const value = this.readLittleEndian(source, pos, num);
    if (value === void 0) {
      if (defaultValue !== void 0) {
        return defaultValue;
      }
      throw new Error(errorMessage);
    }
    return value;
  }
  /**
   * Resolves readable path.
   * @param {string} filename The filename.
   * @returns {string | undefined} The result.
   */
  resolveReadablePath(filename) {
    return this.fileProvider.resolvePath(filename, {
      currentFile: this.currentFile,
      includePaths: this.includePaths,
      macroSourceFile: this.currentMacroSourceFile
    });
  }
  /**
   * Resolves expression host label.
   * @param {string} identifier The identifier.
   * @returns {number | string} The result.
   */
  resolveExpressionHostLabel(identifier) {
    const trimmed = identifier.trim();
    const loopValue = this.activeLoopVariables.get(trimmed);
    if (loopValue !== void 0) return loopValue;
    if (parseUnnamedLabelReference(trimmed)) {
      return this.symbolScope.getLabelValue(trimmed, this.requireStaticLabelLookup);
    }
    const parsed = parseExpressionNode(trimmed);
    if (isReferenceExpressionNode(parsed)) {
      return this.resolveReferenceLabelValue(parsed, this.requireStaticLabelLookup);
    }
    return this.symbolScope.getLabelValue(identifier, this.requireStaticLabelLookup);
  }
  /**
   * Gets expression object size.
   * @param {string} identifier The identifier.
   * @param {boolean} [baseOnly] Whether to return only the base object size.
   * @returns {number} The result.
   */
  getExpressionObjectSize(identifier, baseOnly = false) {
    if (baseOnly && (identifier === "..." || identifier === "\u2026")) {
      if (this.inMacroExpansion && this.currentVariadicCount !== void 0) {
        return this.currentVariadicCount;
      }
      if (this.inMacroDefinition) {
        return 0;
      }
      return 0;
    }
    return this.symbolScope.getObjectSize(identifier, baseOnly);
  }
  /**
   * Looks up define value.
   * @param {string} varName The var name.
   * @returns {string | undefined} The result.
   */
  lookupDefineValue(varName) {
    const defineValue = this.defines.get(varName);
    if (defineValue !== void 0) {
      return defineValue;
    }
    for (let i = this.whileStatus.length - 1; i >= 0; i--) {
      const loop = this.whileStatus[i];
      if (loop.is_for && loop.for_variable === varName && loop.for_cur !== void 0) {
        return loop.for_cur.toString();
      }
    }
    return void 0;
  }
  get currentMacroSourceFile() {
    if (!this.inMacroExpansion || !this.currentMacroName) {
      return void 0;
    }
    return this.macros.get(this.currentMacroName)?.sourceFile;
  }
  /**
   * Checks whether it can read the base image.
   * @param {number} position The position.
   * @param {number} size The size.
   * @returns {number} The result.
   */
  canReadBaseImage(position, size) {
    const sourceLength = this.baseImage && this.baseImage.length > 0 ? this.baseImage.length : this.outputBytes.length;
    return this.canReadByteRange(sourceLength, position, size);
  }
  /**
   * Reads the base image.
   * @param {number} position The position.
   * @param {number} size The size.
   * @param {number} [defaultValue] The default value.
   * @returns {number} The result.
   */
  readBaseImage(position, size, defaultValue) {
    const pos = Math.trunc(position);
    const pcPos = this.outputWriter.toOutputOffset(pos);
    const source = this.baseImage && this.baseImage.length > 0 ? this.baseImage : this.outputBytes;
    if (pcPos < 0) {
      if (defaultValue !== void 0) {
        return defaultValue;
      }
      throw new Error(`read${Math.trunc(size)} out of bounds at ${pos}`);
    }
    const sourceBytes = Uint8Array.from(source);
    return this.readByteRange(
      sourceBytes,
      pcPos,
      size,
      defaultValue,
      `read${Math.trunc(size)} out of bounds at ${pos}`
    );
  }
  /**
   * Checks whether it can read expression file.
   * @param {string} filename The filename.
   * @param {number} position The position.
   * @param {number} size The size.
   * @returns {number} The result.
   */
  canReadExpressionFile(filename, position, size) {
    const resolvedPath = this.resolveReadablePath(filename);
    if (!resolvedPath) {
      return 0;
    }
    const fileSize = this.fileProvider.stat(resolvedPath).size;
    if (fileSize === void 0) {
      return 0;
    }
    return this.canReadByteRange(fileSize, position, size);
  }
  /**
   * Reads expression file.
   * @param {string} filename The filename.
   * @param {number} position The position.
   * @param {number} size The size.
   * @param {number} [defaultValue] The default value.
   * @returns {number} The result.
   */
  readExpressionFile(filename, position, size, defaultValue) {
    const pos = Math.trunc(position);
    const resolvedPath = this.resolveReadablePath(filename);
    if (!resolvedPath) {
      if (defaultValue !== void 0) {
        return defaultValue;
      }
      throw new Error(`Could not read file: ${filename}`);
    }
    const fileBytes = this.fileProvider.readFile(resolvedPath);
    return this.readByteRange(
      fileBytes,
      pos,
      size,
      defaultValue,
      `readfile${Math.trunc(size)} out of bounds at ${pos}`
    );
  }
  /**
   * Installs the active target's expression contributions into this session.
   * @param {readonly string[]} setIds Resolved expression-set contribution IDs.
   */
  installExpressionFunctions(setIds) {
    for (const setId of setIds) {
      const set = this.environment.getExpressionSet(setId);
      if (!set) continue;
      const pluginId = this.environment.getContributionOwner(setId);
      for (const expressionFunction of set.functions) {
        const minimumArguments = expressionFunction.signature.minimumArguments ?? expressionFunction.signature.parameters.length;
        const maximumArguments = expressionFunction.signature.maximumArguments ?? (expressionFunction.signature.minimumArguments === void 0 ? expressionFunction.signature.parameters.length : Number.POSITIVE_INFINITY);
        this.mathCore.registerExpressionFunction(
          [expressionFunction.name, ...expressionFunction.aliases ?? []],
          {
            minimumArguments,
            maximumArguments,
            evaluate: (args) => {
              try {
                return expressionFunction.evaluate(
                  {
                    state: this.pluginState,
                    addresses: {
                      toOutputOffset: (address) => this.outputWriter.toOutputOffset(address),
                      fromOutputOffset: (offset) => this.outputWriter.fromOutputOffset(offset)
                    },
                    output: {
                      canRead: (position, size) => this.canReadBaseImage(position, size),
                      read: (position, size, defaultValue) => this.readBaseImage(position, size, defaultValue)
                    }
                  },
                  args
                );
              } catch (cause) {
                throw new PluginError(`Expression function '${expressionFunction.name}' failed.`, {
                  code: "PLUGIN_HOOK_FAILED",
                  pluginId,
                  contributionId: set.id,
                  targetId: this.targetId,
                  cause
                });
              }
            }
          }
        );
      }
    }
  }
  expressionHost = {
    resolveLabel: (identifier) => this.resolveExpressionHostLabel(identifier),
    convertLogicalToOutputOffset: (address) => this.outputWriter.toOutputOffset(address),
    convertOutputOffsetToLogical: (offset) => this.outputWriter.fromOutputOffset(offset),
    getCurrentAddress: () => this.currentTargetAddress,
    getCurrentBaseAddress: () => this.currentTargetBaseAddress,
    isDefined: (identifier) => {
      if (this.defines.has(identifier)) return 1;
      if (this.structs.has(identifier)) return 1;
      return this.symbolScope.hasLabelInScope(identifier) ? 1 : 0;
    },
    getExpressionObjectSize: (identifier, baseOnly) => this.getExpressionObjectSize(identifier, baseOnly),
    getFileSize: (filename) => {
      const resolvedPath = this.resolveReadablePath(filename);
      if (!resolvedPath) {
        throw new Error(`Could not get filesize for '${filename}'`);
      }
      const stat = this.fileProvider.stat(resolvedPath);
      if (stat.size === void 0) {
        throw new Error(`Could not get filesize for '${filename}'`);
      }
      return stat.size;
    },
    getFileStatus: (filename) => {
      const resolvedPath = this.resolveReadablePath(filename);
      if (!resolvedPath) {
        return 1;
      }
      return this.fileProvider.stat(resolvedPath).readable ? 0 : 2;
    },
    canReadFile: (filename, position, size) => this.canReadExpressionFile(filename, position, size),
    readFile: (filename, position, size, defaultValue) => this.readExpressionFile(filename, position, size, defaultValue),
    canReadBaseImage: (position, size) => this.canReadBaseImage(position, size),
    readBaseImage: (position, size, defaultValue) => this.readBaseImage(position, size, defaultValue)
  };
  /**
   * Advances the logical program counter.
   * @param {number} num Number of logical address units to advance.
   */
  step(num) {
    this.outputWriter.step(num);
  }
  /**
   * Writes a single architecture byte to output.
   * @param {number} num Byte value to write.
   */
  writeArchitectureByte(num) {
    this.outputWriter.write1(num);
  }
  /**
   * Fills a section of output data with a value.
   * @param {number} start The starting address.
   * @param {number} value The value to fill with.
   * @param {number} length The length of the section to fill.
   */
  fillOutputBytes(start, value, length) {
    debug4("fillOutputBytes", start, value, length);
    for (let i = 0; i < length; i++) {
      this.outputBytes[start + i] = value & 255;
    }
  }
  /**
   * Creates ephemeral stage execution state.
   * @param {AssemblyStageName} stage The stage.
   * @returns {StageExecutionState} The result.
   */
  createEphemeralStageExecutionState(stage) {
    const descriptor2 = this.getStageDescriptor(stage);
    return {
      ...descriptor2,
      cursor: {
        currentTargetAddress: this.currentTargetAddress,
        currentTargetBaseAddress: this.currentTargetBaseAddress,
        currentTargetStartAddress: this.currentTargetStartAddress,
        currentTargetBaseStartAddress: this.currentTargetBaseStartAddress,
        bytes: this.bytes
      },
      symbols: {
        labelTable: this.labelTable,
        forwardLabels: this.forwardLabels,
        backwardLabels: this.backwardLabels,
        currentParentLabel: this.currentParentLabel,
        currentParentIsGlobal: this.currentParentIsGlobal,
        currentGlobalParentLabel: this.currentGlobalParentLabel,
        labelParents: this.labelParents
      },
      control: {
        namespaceStack: this.namespaceStack,
        currentNamespace: this.currentNamespace,
        namespaceNestingEnabled: this.namespaceNestingEnabled,
        namespaceNestingPath: this.namespaceNestingPath,
        inMacroExpansion: this.inMacroExpansion,
        macroLabelInstance: this.macroLabelInstance
      },
      pluginState: this.pluginState.cloneSnapshot(),
      loweredProgram: null
    };
  }
  /**
   * Synchronizes active stage execution state.
   * @param {AssemblyStageName} stage The stage.
   */
  syncActiveStageExecutionState(stage) {
    const descriptor2 = this.getStageDescriptor(stage);
    if (!this.activeStageExecutionState) {
      this.activeStageExecutionState = this.createEphemeralStageExecutionState(stage);
      return;
    }
    this.activeStageExecutionState.stage = descriptor2.stage;
    this.activeStageExecutionState.capabilities = descriptor2.capabilities;
  }
  /**
   * Gets active stage capabilities.
   * @returns {StageExecutionCapabilities} The result.
   */
  getActiveStageCapabilities() {
    if (!this.activeStageExecutionState) {
      this.activeStageExecutionState = this.createEphemeralStageExecutionState("collectDefinitions");
    }
    return this.activeStageExecutionState.capabilities;
  }
  get traceStage() {
    return this.activeStageExecutionState?.stage ?? "collectDefinitions";
  }
  /**
   * Lays out instruction.
   * @param {string[] | LoweredInstruction} input The input.
   * @returns {boolean} The result.
   */
  layoutInstruction(input) {
    const words = Array.isArray(input) ? input : input.words;
    if (words.length === 0) {
      return true;
    }
    const architecture = this.resolveActiveArchitecture();
    if (!architecture.definition) {
      return true;
    }
    const size = Array.isArray(input) ? architecture.definition.encoder.estimateSize(words) : architecture.definition.encoder.estimateInstruction?.(input) ?? architecture.definition.encoder.estimateSize(words);
    this.step(size);
    return true;
  }
  /**
   * Emits instruction.
   * @param {string[] | LoweredInstruction} input The input.
   * @returns {boolean} The result.
   */
  emitInstruction(input) {
    const words = Array.isArray(input) ? input : input.words;
    if (words.length === 0) {
      return true;
    }
    const architecture = this.resolveActiveArchitecture();
    if (!architecture.definition) {
      return true;
    }
    const encoded = Array.isArray(input) ? architecture.definition.encoder.encode(words) : architecture.definition.encoder.encodeInstruction?.(input) ?? architecture.definition.encoder.encode(words);
    if (!encoded) {
      if (architecture.definition.unknownInstructionBehavior === "returnFalse") {
        return false;
      }
      throw new Error(`Unknown instruction: ${words[0]}`);
    }
    return true;
  }
  /**
   * Picks the appropriate instruction handler based on architecture.
   * @param {string[] | LoweredInstruction} input The instruction to pick.
   * @returns {boolean} True if the instruction was handled, false otherwise.
   */
  asblock_pick(input) {
    debug4("asblock_pick", Array.isArray(input) ? input : input.words);
    debug4("asblock_pick arch", this.arch);
    const words = Array.isArray(input) ? input : input.words;
    const raw = Array.isArray(input) ? words.join(" ") : input.sourceRaw;
    if (!this.inMacroDefinition && this.tryHandleCharacterMapping(raw)) {
      return true;
    }
    const keyword = words[0]?.toLowerCase() ?? "";
    if (keyword !== "" && this.directiveRegistry.has(keyword)) {
      return this.directiveRegistry.dispatch(keyword, words, words.join(" "));
    }
    const instructionExecutionMode = this.getActiveStageCapabilities().instructionMode;
    if (instructionExecutionMode === "layout") {
      return this.layoutInstruction(input);
    }
    return this.emitInstruction(input);
  }
  /**
   * Resolves active architecture.
   * @returns {{ name: string; definition?: ArchitectureDefinition }} The result.
   */
  resolveActiveArchitecture() {
    const normalized = this.arch.toLowerCase();
    const canonical2 = this.architectureRegistry.getCanonicalName(normalized);
    const name = canonical2 ?? normalized;
    return {
      name,
      definition: this.architectureRegistry.getDefinition(name)
    };
  }
  /**
   * Classifies operand for active architecture.
   * @param {string} operand The operand.
   * @returns {LoweredOperand} The classified operand.
   */
  classifyOperandForActiveArchitecture(operand) {
    const architecture = this.resolveActiveArchitecture();
    if (!architecture.definition) {
      return this.operandResolver.lowerOperand(operand);
    }
    return architecture.definition.classifyOperand(this.operandResolver, operand);
  }
  /**
   * Resolves target-specific directive prefixes without teaching the registry a dialect.
   * @param {string} keyword Source directive keyword.
   * @returns {string} Canonical registry keyword.
   */
  canonicalizeDirectiveKeyword(keyword) {
    const normalized = keyword.toLowerCase();
    for (const prefix of this.syntaxProfile.directivePrefixes) {
      if (normalized.startsWith(prefix) && this.directiveRegistry.has(normalized.slice(prefix.length))) {
        return normalized.slice(prefix.length);
      }
    }
    return normalized;
  }
  /**
   * Returns whether the active syntax profile treats a token as a named label.
   * @param {string} candidate Candidate token.
   * @returns {boolean} Whether the token is a named label.
   */
  isNamedLabelToken(candidate) {
    if (candidate === ":") {
      return false;
    }
    return candidate.endsWith(":") || this.syntaxProfile.leadingDotLabels && candidate.startsWith(".");
  }
  /**
   * Writes 1, 2, 3, or 4 bytes to output.
   * @param {number} num - The byte to write.
   */
  write1(num) {
    this.outputWriter.write1(num);
  }
  /**
   * Writes 2.
   * @param {number} num The num.
   */
  write2(num) {
    this.outputWriter.write2(num);
  }
  /**
   * Writes 3.
   * @param {number} num The num.
   */
  write3(num) {
    this.outputWriter.write3(num);
  }
  /**
   * Writes 4.
   * @param {number} num The num.
   */
  write4(num) {
    this.outputWriter.write4(num);
  }
  /**
   * Reads 1, 2, or 3 bytes from the configured output image.
   * @param {number} logicalPosition The logical address to read from.
   * @returns {number} The byte read from the output image.
   */
  read1(logicalPosition) {
    const addr = this.outputWriter.toOutputOffset(logicalPosition);
    if (addr < 0 || addr + 1 > this.outputBytes.length) {
      return -1;
    }
    return this.outputBytes[addr];
  }
  /**
   * Reads 2.
   * @param {number} logicalPosition The logical address.
   * @returns {number} The result.
   */
  read2(logicalPosition) {
    const addr = this.outputWriter.toOutputOffset(logicalPosition);
    if (addr < 0 || addr + 2 > this.outputBytes.length) {
      return -1;
    }
    return this.outputBytes[addr] | this.outputBytes[addr + 1] << 8;
  }
  /**
   * Reads 3.
   * @param {number} logicalPosition The logical address.
   * @returns {number} The result.
   */
  read3(logicalPosition) {
    const addr = this.outputWriter.toOutputOffset(logicalPosition);
    if (addr < 0 || addr + 3 > this.outputBytes.length) {
      return -1;
    }
    return this.outputBytes[addr] | this.outputBytes[addr + 1] << 8 | this.outputBytes[addr + 2] << 16;
  }
  /**
   * Rewrites raw command.
   * @param {string} command The command.
   * @returns {string} The result.
   */
  rewriteRawCommand(command) {
    return this.macroEngine.rewriteMacroLabelReferences(command);
  }
  /**
   * Creates normalized command from raw.
   * @param {string} command The command.
   * @param {string} sourceFile The source file.
   * @param {number} sourceLine The source line.
   * @param {boolean} [allowEmpty] The allow empty.
   * @returns {NormalizedCommand | null} The result.
   */
  createNormalizedCommandFromRaw(command, sourceFile, sourceLine, allowEmpty = false) {
    return this.frontEndService.createNormalizedCommandFromRaw(
      command,
      sourceFile,
      sourceLine,
      allowEmpty
    );
  }
  /**
   * Applies a `!name =` assignment without routing it through the incremental if-tree.
   * @param {string} command The define assignment command.
   * @returns {boolean} `true` when the define engine handled the command.
   */
  applyDefineAssignment(command) {
    const commandNode = this.createNormalizedCommandFromRaw(
      command,
      this.currentFile,
      this.currentLine,
      true
    );
    if (!commandNode) {
      return false;
    }
    return this.defineEngine.handleCommand(commandNode);
  }
  /**
   * Asar `'X' = $nn` / `"X" = $nn` table entries, including `''' = $2A` for apostrophe.
   * @param {string} command Raw command text.
   * @returns {boolean} `true` when the line was a character mapping.
   */
  tryHandleCharacterMapping(command) {
    const trimmed = command.trim();
    const singleQuoted = /^'([\S\s])'\s*=\s*(.+)$/.exec(trimmed);
    const doubleQuoted = /^"([\S\s])"\s*=\s*(.+)$/.exec(trimmed);
    const match = singleQuoted ?? doubleQuoted;
    if (!match) {
      return false;
    }
    const quote = singleQuoted ? "'" : '"';
    this.directiveRuntime.handleCharacterMapping([
      `${quote}${match[1]}${quote}`,
      "=",
      match[2].trim()
    ]);
    return true;
  }
  /**
   * Preprocesses normalized command.
   * @param {NormalizedCommand} state The state.
   * @returns {CommandPreprocessResult} The result.
   */
  preprocessNormalizedCommand(state) {
    if (!this.inMacroDefinition && this.tryHandleCharacterMapping(state.command)) {
      setCommandKind(state, "characterMapping");
      return "handled";
    }
    if (!this.inMacroDefinition && state.words.length === 3 && state.words[1] === "=" && (state.words[0].startsWith("'") || state.words[0].startsWith('"'))) {
      setCommandKind(state, "characterMapping");
      debug4("handleCharacterMapping", state.words);
      this.directiveRuntime.handleCharacterMapping(state.words);
      return "handled";
    }
    if (this.frontEndCommandService.startFunctionDefinition(state)) {
      return "handled";
    }
    if (this.macroEngine.handleDefinitionCommand(state)) {
      return "handled";
    }
    if (this.defineEngine.handleCommand(state)) {
      if (state.command.includes("=")) {
        this.cursorAddress.recordCurrentAddress();
      }
      return "handled";
    }
    if (this.structEngine.handleStructMode(state)) {
      return "handled";
    }
    if (this.frontEndCommandService.handleRelativeLabelDefinition(state)) {
      return "handled";
    }
    if (this.frontEndCommandService.handleGlobalLabel(state)) {
      return "handled";
    }
    if (this.frontEndCommandService.consumeNamedLabelDefinitions(state)) {
      return "handled";
    }
    if (this.macroEngine.handleDefinitionCommand(state)) {
      return "handled";
    }
    if (this.frontEndCommandService.handleStaticLabelAssignment(state)) {
      return "handled";
    }
    return "continue";
  }
  /**
   * Prepares normalized command for dispatch.
   * @param {NormalizedCommand} state The state.
   * @returns {boolean} The result.
   */
  prepareNormalizedCommandForDispatch(state) {
    if (state.kind === "unknown") {
      setCommandWords(state, state.words, state.command);
      setCommandKind(state, "opcodeCandidate");
    }
    return true;
  }
  /**
   * Processes a command from an internal re-entrant source.
   * @param {string} command - The command to process.
   * @param {boolean} [preprocessed] Whether comments and continuations were already normalized.
   */
  processCommand(command, preprocessed = false) {
    debug4(
      "processCommand",
      { command },
      this.currentTargetAddress,
      "/",
      this.currentTargetAddress.toString(16),
      `stage ${this.activeStageExecutionState?.stage ?? "collectDefinitions"}`
    );
    if (command.trim() === "") {
      return;
    }
    command = this.rewriteRawCommand(command);
    if (this.frontEndCommandService.continueFunctionDefinition(command)) {
      return;
    }
    if (preprocessed) {
      if (!command.includes(":")) {
        const nodes = this.programModelBuilder.consumeIncrementalCommand(
          this.incrementalProgramParseState,
          command.trim(),
          this.currentFile,
          this.currentLine
        );
        this.lowerAndExecuteRuntimeNodes(nodes);
        this.flushCompletedIncrementalNodes();
        return;
      }
      const splitCommands = this.frontEndService.splitInlineCommands([command]);
      for (const splitCommand of splitCommands) {
        const nodes = this.programModelBuilder.consumeIncrementalCommand(
          this.incrementalProgramParseState,
          splitCommand.trim(),
          this.currentFile,
          this.currentLine
        );
        this.lowerAndExecuteRuntimeNodes(nodes);
      }
    } else {
      const processedCommands = this.frontEndService.preprocessBlockCommands(command);
      const splitCommands = this.frontEndService.splitInlineCommands(processedCommands);
      for (const splitCommand of splitCommands) {
        const nodes = this.programModelBuilder.consumeIncrementalCommand(
          this.incrementalProgramParseState,
          splitCommand.trim(),
          this.currentFile,
          this.currentLine
        );
        this.lowerAndExecuteRuntimeNodes(nodes);
      }
    }
    this.flushCompletedIncrementalNodes();
  }
  /**
   * Processes normalized command.
   * @param {NormalizedCommand} state The state.
   * @param {boolean} [rewriteRaw] The rewrite raw.
   */
  processNormalizedCommand(state, rewriteRaw = true) {
    let workingState = cloneNormalizedCommand(state);
    this.currentFile = workingState.source.file;
    this.currentLine = workingState.source.line;
    if (workingState.source.raw.trim().startsWith(";`+")) {
      this.seedOutputFromBaseImage();
      return;
    }
    if (workingState.command.trim() === "") {
      return;
    }
    if (this.frontEndCommandService.continueFunctionDefinition(workingState.command)) {
      return;
    }
    if (rewriteRaw) {
      const rewrittenRaw = this.rewriteRawCommand(workingState.source.raw);
      const requiresVariadicResolution = this.inMacroExpansion && !this.isDefinitionCollectionStage && (rewrittenRaw.includes("...") || rewrittenRaw.includes("\u2026"));
      if (rewrittenRaw !== workingState.source.raw || requiresVariadicResolution) {
        incrementInternalCounter("actualReparses");
        const rewrittenState = this.createNormalizedCommandFromRaw(
          rewrittenRaw,
          workingState.source.file,
          workingState.source.line,
          true
        );
        if (!rewrittenState) {
          return;
        }
        workingState = rewrittenState;
      }
    }
    if (this.collectSourceMetadata && !this.inMacroDefinition && workingState.parsed.macroInvocation?.name) {
      this.collectCommandReferences(workingState);
    }
    const preprocessResult = this.preprocessNormalizedCommand(workingState);
    if (preprocessResult === "handled") {
      return;
    }
    const startPC = normalizeAddressForWidth(this.currentTargetBaseAddress, this.addressWidth);
    if (!this.prepareNormalizedCommandForDispatch(workingState)) {
      return;
    }
    if (this.collectSourceMetadata) {
      this.collectCommandReferences(workingState);
    }
    const traceListener = this.traceListener;
    if (!traceListener) {
      const lowered = this.commandLoweringService.lowerCommand(workingState);
      this.dispatchLoweredNode(lowered);
    } else {
      const traceContext = {
        file: workingState.source.file,
        line: workingState.source.line,
        raw: workingState.source.raw,
        normalized: workingState.command
      };
      traceListener({
        type: "command-start",
        stage: this.traceStage,
        arch: this.arch,
        ...traceContext,
        logicalAddress: startPC,
        addressWidth: this.addressWidth,
        outputOffset: this.outputWriter.toOutputOffset(startPC)
      });
      this.traceCommandStack.push(traceContext);
      try {
        const lowered = this.commandLoweringService.lowerCommand(workingState);
        this.dispatchLoweredNode(lowered);
      } finally {
        this.traceCommandStack.pop();
      }
      const endPC = normalizeAddressForWidth(this.currentTargetBaseAddress, this.addressWidth);
      traceListener({
        type: "command-end",
        stage: this.traceStage,
        arch: this.arch,
        ...traceContext,
        logicalAddress: startPC,
        addressWidth: this.addressWidth,
        outputOffset: this.outputWriter.toOutputOffset(startPC),
        endLogicalAddress: endPC,
        endOutputOffset: this.outputWriter.toOutputOffset(endPC),
        bytesWritten: endPC - startPC
      });
    }
    const commandSize = normalizeAddressForWidth(this.currentTargetBaseAddress, this.addressWidth) - startPC;
    debug4("processCommand bytes written", commandSize);
    if (this.collectSourceMetadata) {
      this.addAddressToLine(
        normalizeAddressForWidth(this.currentTargetBaseAddress, this.addressWidth)
      );
    }
  }
  /**
   * Gets or create lowered program.
   * @param {StageExecutionState} stageState The stage state.
   * @param {ProgramModel} program The program.
   * @returns {LoweredProgram} The result.
   */
  getOrCreateLoweredProgram(stageState, program) {
    if (!stageState.loweredProgram) {
      stageState.loweredProgram = measureInternalPhase(
        "lowerProgram",
        () => this.commandLoweringService.lowerProgram(program)
      );
    }
    return stageState.loweredProgram;
  }
  /**
   * Dispatches lowered node.
   * @param {LoweredCommand} lowered The lowered.
   */
  dispatchLoweredNode(lowered) {
    if (lowered.kind === "directive") {
      const loweredCommand = lowered.command;
      const handledDirective = this.directiveRegistry.dispatch(
        lowered.keyword,
        lowered.words,
        lowered.source.raw,
        loweredCommand
      );
      if (!handledDirective && lowered.keyword) {
        debug4("\u{1F4A5} assembler dispatchLoweredNode unknown directive", lowered.keyword);
      }
      return;
    }
    let instruction2 = lowered;
    if (lowered.command) {
      const refreshed = this.commandLoweringService.lowerCommand(lowered.command);
      if (refreshed.kind === "instruction") {
        instruction2 = refreshed;
      }
    }
    const wasOpcode = this.asblock_pick(instruction2);
    if (!wasOpcode) {
      debug4("\u{1F4A5} assembler dispatchLoweredNode unknown operation", lowered.mnemonic);
    }
  }
  /**
   * Parses a function definition of the form:
   *   function name(param1, param2...) = expression
   * Possibly spanning multiple lines joined by backslashes.
   * @param {string} defLine - The function definition line.
   */
  parseFunctionDefinition(defLine) {
    debug4("parseFunctionDefinition", defLine);
    this.mathCore.str = defLine;
    this.mathCore.parseFunctionDefinition();
    const functionName = defLine.match(/^function\s+([_a-z]\w*)\s*\(/i)?.[1];
    if (functionName) {
      this.recordSymbolDefinition("function", functionName);
    }
  }
  /**
   * Adds a mapping of the current address to the source line number.
   * @param {number} address The logical address to add to the mapping.
   */
  addAddressToLine(address) {
    incrementInternalCounter("addressMappings");
    if (!this.collectSourceMetadata) {
      return;
    }
    this.addressToLineMapping.includeMapping(this.currentFile, this.currentLine + 1, address);
  }
  /**
   * Evaluates a range expression and returns the result.
   * @param {string} expr The expression to evaluate.
   * @returns {number} The result of the expression.
   */
  evaluateRangeExpression(expr) {
    debug4("assemlber evaluateRangeExpression", expr);
    const resolvedExpr = this.resolveExpressionInput(expr);
    if (isReferenceExpressionNode(resolvedExpr)) {
      return this.evaluateReferenceExpressionNode(resolvedExpr, true);
    }
    try {
      const result = this.mathCore.math(resolvedExpr);
      if (!Number.isNaN(result)) {
        return result;
      }
    } catch (error) {
    }
    return this.symbolScope.getLabelValue(renderExpressionNode(resolvedExpr), true);
  }
  /**
   * Sets the paths to search for included files.
   * @param {string[]} paths The paths to search for included files.
   */
  setIncludePaths(paths) {
    this.includePaths = paths;
  }
  /**
   * Evaluates an expression for conditionals (if, while).
   * @param {string} expression - The expression to evaluate.
   * @returns {boolean} True if the expression is true, false otherwise.
   */
  evaluateExpression(expression) {
    debug4("evaluateExpression", expression);
    let resolvedExpr;
    let result;
    try {
      resolvedExpr = this.resolveExpressionInput(expression);
      debug4("evaluateExpression resolvedExpr", resolvedExpr);
      result = isReferenceExpressionNode(resolvedExpr) ? this.evaluateReferenceExpressionNode(resolvedExpr) : this.mathCore.math(resolvedExpr);
    } catch (e) {
      const originalExpr = typeof expression === "string" ? expression : renderExpressionNode(expression);
      const resolvedText = resolvedExpr ? renderExpressionNode(resolvedExpr) : "<unresolved>";
      throw new Error(
        `Error evaluating expression "${originalExpr}" (resolved to "${resolvedText}"): ${e instanceof Error ? e.message : JSON.stringify(e)}`
      );
    }
    debug4("evaluateExpression result", result, "=>", result !== 0);
    return result !== 0;
  }
  /**
   * Parses string input into an expression node and resolves nested references/defines.
   * @param {string | ExpressionNode} expression The expression source or parsed node.
   * @returns {ExpressionNode} The resolved expression tree.
   */
  resolveExpressionInput(expression) {
    const parsed = typeof expression === "string" ? parseExpressionNode(expression.trim()) : expression;
    return this.resolveExpressionNode(parsed);
  }
  /**
   * Recursively resolves define references and nested reference-expression nodes.
   * @param {ExpressionNode} expression The expression node to resolve.
   * @returns {ExpressionNode} The resolved expression node.
   */
  resolveExpressionNode(expression) {
    if (isReferenceExpressionNode(expression)) {
      return this.resolveReferenceExpressionNode(expression);
    }
    switch (expression.type) {
      case "binary":
        return {
          ...expression,
          left: this.resolveExpressionNode(expression.left),
          right: this.resolveExpressionNode(expression.right)
        };
      case "unary":
        return {
          ...expression,
          argument: this.resolveExpressionNode(expression.argument)
        };
      case "range":
        return {
          ...expression,
          start: this.resolveExpressionNode(expression.start),
          end: this.resolveExpressionNode(expression.end)
        };
      case "call":
        return {
          ...expression,
          arguments: expression.arguments.map((argument) => this.resolveExpressionNode(argument))
        };
      case "raw":
        if (/(^|[^!<=>])![\w{]/.test(expression.value)) {
          return this.resolveExpressionInput(this.resolvedefines(expression.value));
        }
        return expression;
      default:
        return expression;
    }
  }
  /**
   * Resolves reference-style expressions such as identifiers, define references,
   * member access, and indexed access into either simpler reference nodes or
   * raw/math expressions when defines collapse them further.
   * @param {ReferenceExpressionNode} expression The reference expression to resolve.
   * @returns {ExpressionNode} The resolved expression tree.
   */
  resolveReferenceExpressionNode(expression) {
    switch (expression.type) {
      case "identifier":
        return expression;
      case "defineReference": {
        const defineName = expression.braced ? this.resolvedefines(expression.content ?? "") : expression.name ?? "";
        const value = this.lookupDefineValue(defineName);
        if (value === void 0) {
          throw new Error(`Define '${defineName}' not found.`);
        }
        return this.resolveExpressionInput(value);
      }
      case "member": {
        const object = this.resolveReferenceExpressionNode(expression.object);
        if (!isReferenceExpressionNode(object)) {
          const expandedReference = this.tryResolveExpandedReferenceExpression(expression);
          if (expandedReference) {
            return expandedReference;
          }
          return {
            type: "raw",
            value: `${renderExpressionNode(object)}.${expression.property.name}`
          };
        }
        return {
          ...expression,
          object
        };
      }
      case "index": {
        const object = this.resolveReferenceExpressionNode(expression.object);
        const index = this.resolveExpressionNode(expression.index);
        if (!isReferenceExpressionNode(object)) {
          const expandedReference = this.tryResolveExpandedReferenceExpression(expression);
          if (expandedReference) {
            return expandedReference;
          }
          return {
            type: "raw",
            value: `${renderExpressionNode(object)}[${renderExpressionNode(index)}]`
          };
        }
        return {
          ...expression,
          object,
          index
        };
      }
      default:
        return expression;
    }
  }
  /**
   * Resolves a reference expression all the way to a numeric value.
   * @param {ReferenceExpressionNode} expression The reference expression to evaluate.
   * @param {boolean} [requireStatic] Whether labels must be static.
   * @returns {number} The numeric value of the reference.
   */
  evaluateReferenceExpressionNode(expression, requireStatic = false) {
    const resolved = this.resolveReferenceLabelValue(expression, requireStatic);
    if (typeof resolved === "number") {
      return resolved;
    }
    throw new Error(`Reference '${resolved}' did not resolve to a numeric value.`);
  }
  /**
   * Resolves a reference expression to either a numeric value or a normalized
   * label/struct lookup target, depending on how far the expression collapses.
   * @param {ReferenceExpressionNode} expression The reference expression to resolve.
   * @param {boolean} [requireStatic] Whether labels must be static.
   * @returns {number | string} The resolved numeric value.
   */
  resolveReferenceLabelValue(expression, requireStatic = false) {
    const resolved = this.resolveReferenceExpressionNode(expression);
    if (!isReferenceExpressionNode(resolved)) {
      return this.mathCore.math(resolved);
    }
    return this.resolveNormalizedReferenceLabelValue(
      this.renderResolvedReferenceExpression(resolved),
      requireStatic
    );
  }
  /**
   * Resolves an already-normalized reference string as either a struct member/base
   * or a plain label lookup.
   * @param {string} normalizedReference The normalized reference text.
   * @param {boolean} [requireStatic] Whether labels must be static.
   * @returns {number} The resolved numeric address/value.
   */
  resolveNormalizedReferenceLabelValue(normalizedReference, requireStatic = false) {
    if (this.structEngine.hasStructReference(normalizedReference)) {
      return this.structEngine.resolveStructLabel(normalizedReference);
    }
    return this.symbolScope.getLabelValue(normalizedReference, requireStatic);
  }
  /**
   * Renders an index expression for a normalized reference string.
   * @param {ExpressionNode} indexExpression The index expression to render.
   * @returns {string} The rendered numeric or source-like index text.
   */
  resolveReferenceIndexText(indexExpression) {
    const resolvedIndex = this.resolveExpressionNode(indexExpression);
    try {
      return this.mathCore.math(resolvedIndex).toString();
    } catch {
      return renderExpressionNode(resolvedIndex);
    }
  }
  /**
   * Renders a reference expression after resolving any nested index expressions.
   * @param {ReferenceExpressionNode} expression The reference expression to render.
   * @returns {string} The normalized reference text.
   */
  renderResolvedReferenceExpression(expression) {
    return renderReferenceExpressionNode(expression, {
      renderIndex: (indexExpression) => this.resolveReferenceIndexText(indexExpression)
    });
  }
  /**
   * Re-runs `resolvedefines()` across a rendered reference expression and reparses
   * it only when define expansion materially changes the text.
   * @param {ReferenceExpressionNode} expression The reference expression to expand.
   * @returns {ExpressionNode | undefined} The reparsed expression, if expansion changed it.
   */
  tryResolveExpandedReferenceExpression(expression) {
    const renderedReference = this.renderResolvedReferenceExpression(expression);
    const expandedReference = this.resolvedefines(renderedReference);
    if (expandedReference === renderedReference) {
      return void 0;
    }
    return this.resolveExpressionInput(expandedReference);
  }
  /**
   * Resolves standalone relative-label tokens used in define contexts.
   * @param {string} input The token to resolve.
   * @returns {string | undefined} The resolved address string, if applicable.
   */
  tryResolveRelativeLabelToken(input) {
    if (input !== "+" && input !== "-" && input !== "?+" && input !== "?-") {
      return void 0;
    }
    debug4(`resolvedefines handling relative label: ${input}`);
    try {
      switch (input) {
        case "+":
          return `$${this.symbolScope.findNextLabel("+").toString(16)}`;
        case "-":
          return `$${this.symbolScope.findPreviousLabel("-").toString(16)}`;
        case "?+":
          return `$${this.symbolScope.findNextLabel("?+").toString(16)}`;
        case "?-":
          return `$${this.symbolScope.findPreviousLabel("?-").toString(16)}`;
        default:
          return void 0;
      }
    } catch (error) {
      if (!this.enforceResolvedLabels) {
        debug4("resolvedefines stage does not enforce labels, returning placeholder");
        return "$0000";
      }
      debug4(
        `resolvedefines failed to resolve relative label ${input}: ${error instanceof Error ? error.message : ""} during stage ${this.activeStageExecutionState?.stage ?? "collectDefinitions"}`
      );
      throw error;
    }
  }
  /**
   * Resolves direct `!name` define references that are not assignments.
   * @param {string} input The token to resolve.
   * @returns {string | undefined} The resolved define value, if applicable.
   */
  tryResolveDirectDefineReference(input) {
    if (!input.startsWith("!") || input.includes(" ") || input.includes("=") || input.includes("{")) {
      return void 0;
    }
    debug4("resolvedefines direct variable reference", input);
    const varName = input.substring(1);
    return this.lookupDefineValue(varName);
  }
  /**
   * Resolves macro-label references such as `?label` or `#+?label`.
   * @param {string} input The token to resolve.
   * @returns {string | undefined} The resolved macro-label value, if applicable.
   */
  tryResolveMacroLabelReference(input) {
    const prefixMatch = input.match(/^(#\?|\?|#\?\.|\?\+|\?-)(.*)/);
    if (!prefixMatch) {
      return void 0;
    }
    const prefix = prefixMatch[1];
    const labelName = prefixMatch[2];
    debug4("resolvedefines macro label found with prefix", { prefix, labelName });
    return this.symbolScope.getLabelValue(labelName, false).toString();
  }
  /**
   * Resolves bare label-like tokens before the generic character-by-character
   * define scanner runs.
   * @param {string} input The token to resolve.
   * @returns {string | undefined} The resolved label value, if applicable.
   */
  tryResolveBareLabelReference(input) {
    if (!isBareLabelReference(input)) {
      return void 0;
    }
    debug4("resolvedefines checking if input is a label reference", input);
    const labelValue = this.symbolScope.tryGetLabelValue(input, false);
    if (labelValue === void 0) {
      if (this.isDefinitionCollectionStage) {
        return "0";
      }
      debug4("resolvedefines not a label, continuing");
      return void 0;
    }
    debug4("resolvedefines labelValue", labelValue);
    return labelValue.toString();
  }
  /**
   * Resolves all define replacements in a given string.
   * @param {string} input The string to resolve defines in.
   * @returns {string} The string with defines resolved.
   */
  resolvedefines(input) {
    debug4("resolvedefines", { input });
    if (!input) {
      debug4("resolvedefines input is empty, returning empty string");
      return "";
    }
    let result = "";
    let index = 0;
    const resolvedRelativeLabel = this.tryResolveRelativeLabelToken(input);
    if (resolvedRelativeLabel !== void 0) {
      return resolvedRelativeLabel;
    }
    if (input.includes("!=")) {
      debug4("resolvedefines != operator found in", input);
      const parts = input.split("!=");
      const resolvedParts = parts.map((part) => this.resolvedefines(part.trim()));
      return resolvedParts.join("!=");
    }
    if ((input.startsWith("sizeof(") || input.startsWith("objectsize(")) && input.endsWith(")")) {
      debug4("resolvedefines sizeof found, skipping", input);
      return input;
    }
    const resolvedDirectDefine = this.tryResolveDirectDefineReference(input);
    if (resolvedDirectDefine !== void 0) {
      return resolvedDirectDefine;
    }
    const resolvedMacroLabel = this.tryResolveMacroLabelReference(input);
    if (resolvedMacroLabel !== void 0) {
      return resolvedMacroLabel;
    }
    const resolvedBareLabel = this.tryResolveBareLabelReference(input);
    if (resolvedBareLabel !== void 0) {
      return resolvedBareLabel;
    }
    while (index < input.length) {
      const char = input[index];
      if (char === "\\" && input[index + 1] === "\\") {
        debug4("resolvedefines double slash", input);
        result += "\\";
        index += 2;
      } else if (char === "\\" && input[index + 1] === "!") {
        debug4("resolvedefines \\!define", input);
        result += "!";
        index += 2;
      } else if (char === "!") {
        debug4("resolvedefines !define", input);
        let defineName = "";
        index++;
        if (input[index] === "{") {
          index++;
          let unprocessedName = "";
          let braces = 1;
          while (index < input.length) {
            if (input[index] === "{") braces++;
            if (input[index] === "}") braces--;
            if (braces === 0) break;
            unprocessedName += input[index++];
          }
          if (braces !== 0) throw new Error("Error: Mismatched braces in define name.");
          index++;
          defineName = this.resolvedefines(unprocessedName);
          debug4("resolvedefines !define defineName", defineName);
        } else {
          while (index < input.length && /\w/.test(input[index])) {
            defineName += input[index++];
          }
          debug4("resolvedefines !define defineName", defineName);
        }
        if (defineName === "") {
          result += "!";
          continue;
        }
        const value = this.lookupDefineValue(defineName);
        if (value === void 0) {
          throw new Error(`Define '${defineName}' not found.`);
        } else {
          result += value;
        }
      } else {
        result += char;
        index++;
      }
    }
    debug4("resolvedefines result =", { result });
    return result;
  }
  /**
   * Handles activate stage.
   * @param {AssemblyStageName} stage The stage.
   */
  activateStage(stage) {
    debug4("\u{1F3C1} activateStage", stage);
    this.syncActiveStageExecutionState(stage);
    if (stage === "resolveLayout") {
      this.forwardLabels = {};
      this.backwardLabels = {};
    }
    this.macroLabelInstance = 0;
    this.includeSource.resetGuards();
    this.inMacroExpansion = false;
    this.programModelBuilder.resetIncrementalParseState(this.incrementalProgramParseState);
    for (const definition of this.architectureRegistry.definitions.values()) {
      definition.encoder.beginPass?.();
    }
    this.pluginState.resetForStage(stage);
    this.runLifecycleHook(
      "onStageStart",
      (lifecycle) => lifecycle.onStageStart?.({ state: this.pluginState, session: this, stage })
    );
  }
  /**
   * Completes the current pass, performing any necessary cleanup.
   */
  finishPass() {
    const stage = this.activeStageExecutionState?.stage ?? "collectDefinitions";
    this.runLifecycleHook(
      "onStageEnd",
      (lifecycle) => lifecycle.onStageEnd?.({ state: this.pluginState, session: this, stage })
    );
    if (this.getActiveStageCapabilities().canFinalize) {
      this.runLifecycleHook(
        "beforeOutputFinalize",
        (lifecycle) => lifecycle.beforeOutputFinalize?.({
          state: this.pluginState,
          session: this,
          outputBytes: this.outputBytes
        })
      );
    }
    this.outputWriter.finishPass();
    if (this.getActiveStageCapabilities().canFinalize) {
      this.includeSource.endAssemblySnapshot();
      this.mathCore.endAssemblySnapshot();
      this.passProgramCache.clear();
    }
  }
  /**
   * Sets the current file being processed.
   * @param {string} filename - The filename to set.
   */
  setCurrentFile(filename) {
    debug4("setCurrentFile", filename);
    this.currentFile = filename;
    this.currentLine = 0;
    this.programModelBuilder.resetIncrementalParseState(this.incrementalProgramParseState);
  }
  /**
   * Sets the current line number.
   * @param {number} line - The line number to set.
   */
  setCurrentLine(line) {
    this.currentLine = line;
  }
  /**
   * Gets stage descriptor.
   * @param {AssemblyStageName} stage The stage.
   * @returns {Pick<StageExecutionState, "stage" | "capabilities">} The result.
   */
  getStageDescriptor(stage) {
    if (stage === "collectDefinitions") {
      return {
        stage,
        capabilities: {
          instructionMode: "layout",
          canEmitBytes: false,
          canFinalize: false,
          enforceResolvedLabels: false,
          isDefinitionCollectionStage: true
        }
      };
    }
    if (stage === "resolveLayout") {
      return {
        stage,
        capabilities: {
          instructionMode: "emit",
          canEmitBytes: false,
          canFinalize: false,
          enforceResolvedLabels: false,
          isDefinitionCollectionStage: false
        }
      };
    }
    return {
      stage,
      capabilities: {
        instructionMode: "emit",
        canEmitBytes: true,
        canFinalize: true,
        enforceResolvedLabels: true,
        isDefinitionCollectionStage: false
      }
    };
  }
  /**
   * Clones relative labels.
   * @param {{ [depth: number]: { addr: number; macroInstance?: number }[] }} source The source.
   * @returns {{ [depth: number]: { addr: number; macroInstance?: number }[]; }} The result.
   */
  cloneRelativeLabels(source) {
    const clone = {};
    for (const [depth, entries] of Object.entries(source)) {
      clone[Number(depth)] = entries.map((entry) => ({ ...entry }));
    }
    return clone;
  }
  /**
   * Creates stage execution state.
   * @param {AssemblyStageName} stage The stage.
   * @returns {StageExecutionState} The result.
   */
  createStageExecutionState(stage) {
    const descriptor2 = this.getStageDescriptor(stage);
    let previousStage;
    if (stage === "resolveLayout") {
      previousStage = "collectDefinitions";
    } else if (stage === "emitProgram") {
      previousStage = "resolveLayout";
    }
    const seed = previousStage ? this.stageExecutionStates.get(previousStage) : void 0;
    const cursorSeed = seed?.cursor ?? {
      currentTargetAddress: this.currentTargetAddress,
      currentTargetBaseAddress: this.currentTargetBaseAddress,
      currentTargetStartAddress: this.currentTargetStartAddress,
      currentTargetBaseStartAddress: this.currentTargetBaseStartAddress,
      bytes: this.bytes
    };
    const symbolSeed = seed?.symbols ?? {
      labelTable: this.labelTable,
      forwardLabels: this.forwardLabels,
      backwardLabels: this.backwardLabels,
      currentParentLabel: this.currentParentLabel,
      currentParentIsGlobal: this.currentParentIsGlobal,
      currentGlobalParentLabel: this.currentGlobalParentLabel,
      labelParents: this.labelParents
    };
    const controlSeed = seed?.control ?? {
      namespaceStack: this.namespaceStack,
      currentNamespace: this.currentNamespace,
      namespaceNestingEnabled: this.namespaceNestingEnabled,
      namespaceNestingPath: this.namespaceNestingPath,
      inMacroExpansion: this.inMacroExpansion,
      macroLabelInstance: this.macroLabelInstance
    };
    return {
      ...descriptor2,
      cursor: { ...cursorSeed },
      symbols: {
        labelTable: new Map(
          Array.from(symbolSeed.labelTable.entries()).map(([key, value]) => [key, { ...value }])
        ),
        forwardLabels: this.cloneRelativeLabels(symbolSeed.forwardLabels),
        backwardLabels: this.cloneRelativeLabels(symbolSeed.backwardLabels),
        currentParentLabel: symbolSeed.currentParentLabel,
        currentParentIsGlobal: symbolSeed.currentParentIsGlobal,
        currentGlobalParentLabel: symbolSeed.currentGlobalParentLabel,
        labelParents: new Map(symbolSeed.labelParents)
      },
      control: {
        namespaceStack: [...controlSeed.namespaceStack],
        currentNamespace: controlSeed.currentNamespace,
        namespaceNestingEnabled: controlSeed.namespaceNestingEnabled,
        namespaceNestingPath: [...controlSeed.namespaceNestingPath],
        inMacroExpansion: controlSeed.inMacroExpansion,
        macroLabelInstance: controlSeed.macroLabelInstance
      },
      pluginState: this.pluginState.cloneSnapshot(seed?.pluginState),
      loweredProgram: null
    };
  }
  /**
   * Applies stage execution state.
   * @param {StageExecutionState} stageState The stage state.
   */
  applyStageExecutionState(stageState) {
    this.pluginState.restore(this.pluginState.cloneSnapshot(stageState.pluginState));
    this.currentTargetAddress = stageState.cursor.currentTargetAddress;
    this.currentTargetBaseAddress = stageState.cursor.currentTargetBaseAddress;
    this.currentTargetStartAddress = stageState.cursor.currentTargetStartAddress;
    this.currentTargetBaseStartAddress = stageState.cursor.currentTargetBaseStartAddress;
    this.bytes = stageState.cursor.bytes;
    this.labelTable = stageState.symbols.labelTable;
    this.forwardLabels = stageState.symbols.forwardLabels;
    this.backwardLabels = stageState.symbols.backwardLabels;
    this.currentParentLabel = stageState.symbols.currentParentLabel;
    this.currentParentIsGlobal = stageState.symbols.currentParentIsGlobal;
    this.currentGlobalParentLabel = stageState.symbols.currentGlobalParentLabel;
    this.labelParents = stageState.symbols.labelParents;
    this.namespaceStack = stageState.control.namespaceStack;
    this.currentNamespace = stageState.control.currentNamespace;
    this.namespaceNestingEnabled = stageState.control.namespaceNestingEnabled;
    this.namespaceNestingPath = stageState.control.namespaceNestingPath;
    this.inMacroExpansion = stageState.control.inMacroExpansion;
    this.macroLabelInstance = stageState.control.macroLabelInstance;
  }
  /**
   * Captures stage execution state.
   * @param {StageExecutionState} stageState The stage state.
   */
  captureStageExecutionState(stageState) {
    stageState.pluginState = this.pluginState.cloneSnapshot();
    stageState.cursor = {
      currentTargetAddress: this.currentTargetAddress,
      currentTargetBaseAddress: this.currentTargetBaseAddress,
      currentTargetStartAddress: this.currentTargetStartAddress,
      currentTargetBaseStartAddress: this.currentTargetBaseStartAddress,
      bytes: this.bytes
    };
    stageState.symbols = {
      labelTable: this.labelTable,
      forwardLabels: this.forwardLabels,
      backwardLabels: this.backwardLabels,
      currentParentLabel: this.currentParentLabel,
      currentParentIsGlobal: this.currentParentIsGlobal,
      currentGlobalParentLabel: this.currentGlobalParentLabel,
      labelParents: this.labelParents
    };
    stageState.control = {
      namespaceStack: this.namespaceStack,
      currentNamespace: this.currentNamespace,
      namespaceNestingEnabled: this.namespaceNestingEnabled,
      namespaceNestingPath: this.namespaceNestingPath,
      inMacroExpansion: this.inMacroExpansion,
      macroLabelInstance: this.macroLabelInstance
    };
  }
  /**
   * Gets or create stage execution state.
   * @param {AssemblyStageName} stage The stage.
   * @returns {StageExecutionState} The result.
   */
  getOrCreateStageExecutionState(stage) {
    const existing = this.stageExecutionStates.get(stage);
    if (existing) {
      return existing;
    }
    const created = this.createStageExecutionState(stage);
    this.stageExecutionStates.set(stage, created);
    return created;
  }
  /**
   * Builds program model.
   * @param {string} source The source.
   * @param {string} [sourceFile] The source file.
   * @param {number} [startLine] The start line.
   * @returns {ProgramModel} The result.
   */
  buildProgramModel(source, sourceFile = this.currentFile, startLine = 0) {
    return measureInternalPhase("buildProgramModel", () => {
      const program = this.programModelBuilder.buildProgramModel(source, sourceFile, startLine);
      return {
        sourceFile: program.sourceFile,
        startLine: program.startLine,
        nodes: program.nodes
      };
    });
  }
  /**
   * Runs stage.
   * @param {AssemblyStageName} stage The stage.
   * @param {ProgramModel} program The program.
   * @returns {StageExecutionState} The result.
   */
  runStage(stage, program) {
    return measureInternalPhase(stage, () => {
      if (stage === "collectDefinitions") {
        this.includeSource.beginAssemblySnapshot();
        this.mathCore.beginAssemblySnapshot();
        this.stageExecutionStates.clear();
        this.activeStageExecutionState = null;
      }
      const stageState = this.getOrCreateStageExecutionState(stage);
      this.activeStageExecutionState = stageState;
      this.applyStageExecutionState(stageState);
      this.setCurrentFile(program.sourceFile);
      this.activateStage(stage);
      const loweredProgram = this.getOrCreateLoweredProgram(stageState, program);
      measureInternalPhase(
        "executeProgram",
        () => this.executeLoweredNodeStream(loweredProgram.nodes)
      );
      measureInternalPhase("finishPass", () => this.finishPass());
      this.captureStageExecutionState(stageState);
      return stageState;
    });
  }
  /**
   * Handles assemble program.
   * @param {ProgramModel} program The program.
   */
  assembleProgram(program) {
    this.runStage("collectDefinitions", program);
    this.runStage("resolveLayout", program);
    this.runStage("emitProgram", program);
  }
  /**
   * Handles assemble source.
   * @param {string} source The source.
   * @param {string} [sourceFile] The source file.
   * @param {number} [startLine] The start line.
   * @returns {ProgramModel} The result.
   */
  assembleSource(source, sourceFile = this.currentFile, startLine = 0) {
    const program = this.buildProgramModel(source, sourceFile, startLine);
    this.assembleProgram(program);
    return program;
  }
  /**
   * Writes a repeated byte into the output buffer.
   * @param {number} start The starting address of the block to write.
   * @param {number} value The byte value to write.
   * @param {number} [length] The length of the block to write.
   */
  writeOutputBytes(start, value, length = 1) {
    debug4("writeOutputBytes", { start, value, length });
    if (typeof start !== "number" || typeof value !== "number" || typeof length !== "number") {
      throw new Error("writeOutputBytes requires a number for start, value, and length");
    }
    if (value > 255) {
      debug4("writeOutputBytes \u{1F4A5} value must be less than 0xFF", value);
    }
    debug4(
      "writeOutputBytes before this.outputBytes.length",
      this.outputBytes.length,
      "/",
      this.outputBytes.length.toString(16)
    );
    for (let i = 0; i < length; i++) {
      this.outputBytes[start + i] = value & 255;
    }
    debug4(
      "writeOutputBytes after this.outputBytes.length",
      this.outputBytes.length,
      "/",
      this.outputBytes.length.toString(16)
    );
  }
  /**
   * Expands the output buffer and fills it with a specified byte.
   * @param {number} newSize The new output size.
   * @param {number} fillByte The byte used for the new range.
   */
  expandOutput(newSize, fillByte) {
    debug4("expandOutput", { newSize, fillByte });
    if (typeof newSize !== "number" || typeof fillByte !== "number") {
      throw new Error("expandOutput requires a number for newSize and fillByte");
    }
    if (newSize > this.outputBytes.length) {
      this.writeOutputBytes(this.outputBytes.length, fillByte, newSize - this.outputBytes.length);
    } else {
      debug4("expandOutput newSize <= this.outputBytes.length, no expansion needed");
    }
  }
  /** Runs the active output-format finalizer. */
  finalizeOutput() {
    this.pluginOutputFormat.finalize({
      state: this.pluginState,
      outputBytes: this.outputBytes
    });
  }
  /**
   * Returns the compiled binary output.
   * @returns {Uint8Array} The compiled binary output.
   */
  getBinaryOutput = () => {
    return this.pluginOutputFormat.getOutput({
      state: this.pluginState,
      outputBytes: this.outputBytes
    });
  };
  /**
   * Lowers completed runtime nodes and executes them through the production executor.
   * @param {ExecutableNode[]} nodes The runtime nodes to lower and execute.
   */
  lowerAndExecuteRuntimeNodes(nodes) {
    const previousRewrite = this.runtimePassthroughRewriteEnabled;
    this.runtimePassthroughRewriteEnabled = true;
    try {
      const loweredNodes = nodes.map(
        (node) => this.commandLoweringService.lowerExecutableNode(node)
      );
      for (const node of loweredNodes) {
        this.executeWithAnalysisRecovery(
          node,
          (currentNode) => this.getLoweredNodeSpan(currentNode),
          (currentNode) => this.executeLoweredNode(currentNode)
        );
      }
    } finally {
      this.runtimePassthroughRewriteEnabled = previousRewrite;
    }
  }
  /**
   * Resolves for loop bounds.
   * @param {LoweredLoopNode} forBlock The for block.
   * @returns {{ variable?: string; start?: number; end?: number; }} The result.
   */
  resolveForLoopBounds(forBlock) {
    const parsedForLoop = forBlock.header?.parsed.forLoop;
    const variable = forBlock.variable ?? parsedForLoop?.variable;
    let start = forBlock.start;
    let end = forBlock.end;
    const startExpression = forBlock.startExpression ?? parsedForLoop?.start;
    const endExpression = forBlock.endExpression ?? parsedForLoop?.end;
    if (startExpression && endExpression) {
      const startExpr = renderExpressionNode(startExpression);
      const endExpr = renderExpressionNode(endExpression);
      const startDefinesResolved = /^-?\d+$/.test(startExpr) ? startExpr : this.resolvedefines(startExpr);
      const endDefinesResolved = /^-?\d+$/.test(endExpr) ? endExpr : this.resolvedefines(endExpr);
      start = this.operandResolver.getnum(startDefinesResolved);
      end = this.operandResolver.getnum(endDefinesResolved);
    }
    return { variable, start, end };
  }
  /**
   * Executes for loop iterations.
   * @param {LoweredLoopNode} forBlock The for block.
   * @param {() => void} executeBody The execute body.
   */
  executeForLoopIterations(forBlock, executeBody) {
    const { variable, start, end } = this.resolveForLoopBounds(forBlock);
    if (!variable || start === void 0 || end === void 0) {
      debug4("executeForLoopIterations missing loop semantics:", forBlock);
      return;
    }
    const originalValue = this.defines.get(variable);
    const originalLoopValue = this.activeLoopVariables.get(variable);
    if (start < end) {
      for (let i = start; i < end; i++) {
        this.defines.set(variable, i.toString());
        this.activeLoopVariables.set(variable, i);
        executeBody();
      }
    }
    if (originalValue !== void 0) {
      this.defines.set(variable, originalValue);
    } else {
      this.defines.delete(variable);
    }
    if (originalLoopValue !== void 0) {
      this.activeLoopVariables.set(variable, originalLoopValue);
    } else {
      this.activeLoopVariables.delete(variable);
    }
  }
  /**
   * Executes lowered loop.
   * @param {LoweredLoopNode} loopBlock The loop block.
   */
  executeLoweredLoop(loopBlock) {
    debug4("executeLoweredLoop", loopBlock);
    if (loopBlock.loopType === "for") {
      this.executeLoweredForLoop(loopBlock);
    } else if (loopBlock.loopType === "while") {
      this.executeLoweredWhileLoop(loopBlock);
    }
  }
  /**
   * Executes lowered for loop.
   * @param {LoweredLoopNode} forBlock The for block.
   */
  executeLoweredForLoop(forBlock) {
    debug4("executeLoweredForLoop", forBlock);
    this.executeForLoopIterations(forBlock, () => this.executeLoweredNodeStream(forBlock.commands));
  }
  /**
   * Executes while loop commands.
   * @param {LoweredLoopNode} whileBlock The while block.
   * @param {TCommand[]} commands The commands.
   * @param {(command: TCommand) => string | null} getDefineTarget The get define target.
   * @param {(command: TCommand) => void} executeCommand The execute command.
   */
  executeWhileLoopCommands(whileBlock, commands, getDefineTarget, executeCommand) {
    const conditionNode = whileBlock.conditionNode ?? whileBlock.header?.parsed.condition?.expression;
    if (!conditionNode) {
      debug4("executeWhileLoopCommands missing condition expression", whileBlock);
      return;
    }
    let iteration = 0;
    const MAX_ITERATIONS = 1e4;
    const loopVars = /* @__PURE__ */ new Set();
    const originalValues = /* @__PURE__ */ new Map();
    while (this.evaluateExpression(conditionNode) && iteration < MAX_ITERATIONS) {
      for (const cmd of commands) {
        const defineTarget = getDefineTarget(cmd);
        if (defineTarget && !loopVars.has(defineTarget)) {
          loopVars.add(defineTarget);
          originalValues.set(defineTarget, this.defines.get(defineTarget));
        }
        executeCommand(cmd);
      }
      iteration++;
    }
    if (iteration >= MAX_ITERATIONS) {
      debug4(
        "executeWhileLoopCommands while loop exceeded maximum iteration limit. Possible infinite loop detected."
      );
    }
    for (const [varName, value] of originalValues.entries()) {
      if (value !== void 0) {
        debug4(`executeWhileLoopCommands setting ${varName} to ${value}`);
        this.defines.set(varName, value);
      } else {
        debug4(`executeWhileLoopCommands delete entry for ${varName}`);
        this.defines.delete(varName);
      }
    }
  }
  /**
   * Executes lowered while loop.
   * @param {LoweredLoopNode} whileBlock The while block.
   */
  executeLoweredWhileLoop(whileBlock) {
    debug4("executeLoweredWhileLoop", whileBlock);
    this.executeWhileLoopCommands(
      whileBlock,
      whileBlock.commands,
      (cmd) => cmd.kind === "command" && cmd.command.kind === "defineCommand" ? getDefineVariable(cmd.command.command) ?? null : null,
      (cmd) => this.executeLoweredNodeWithRecovery(cmd)
    );
  }
  /**
   * Gets lowered node span.
   * @param {LoweredExecutableNode} node The node.
   * @returns {SourceSpan | undefined} The result.
   */
  getLoweredNodeSpan(node) {
    if (node.kind === "command") {
      return node.command.source.normalizedSpan;
    }
    if (node.kind === "directive") {
      return node.source.normalizedSpan;
    }
    if (node.kind === "loop" || node.kind === "conditional") {
      return node.header?.source.normalizedSpan;
    }
    return void 0;
  }
  /**
   * Executes a tree or lowered node while routing analysis-mode failures into diagnostics.
   * @param {TNode} node The node to execute.
   * @param {(node: TNode) => SourceSpan | undefined} getSpan Resolves the node span for diagnostics.
   * @param {(node: TNode) => void} executeNode Executes the node with its native dispatcher.
   */
  executeWithAnalysisRecovery(node, getSpan, executeNode) {
    if (!this.analysisErrorRecoveryEnabled) {
      executeNode(node);
      return;
    }
    try {
      executeNode(node);
    } catch (error) {
      this.reportErrorDiagnostic(error, getSpan(node), this.activeStageExecutionState?.stage);
    }
  }
  /**
   * Executes lowered node with recovery.
   * @param {LoweredExecutableNode} node The node.
   */
  executeLoweredNodeWithRecovery(node) {
    this.executeWithAnalysisRecovery(
      node,
      (currentNode) => this.getLoweredNodeSpan(currentNode),
      (currentNode) => this.executeLoweredNode(currentNode)
    );
  }
  /**
   * Executes lowered node.
   * @param {LoweredExecutableNode} node The node.
   */
  executeLoweredNode(node) {
    const sourceCommand = node.kind === "loop" || node.kind === "conditional" ? node.header : node.command;
    if (sourceCommand) {
      this.currentFile = sourceCommand.source.file;
      this.currentLine = sourceCommand.source.line;
    }
    if (node.kind === "command") {
      incrementInternalCounter("passthroughDispatches");
      this.processNormalizedCommand(node.command, this.runtimePassthroughRewriteEnabled);
      return;
    }
    if (node.kind === "directive" || node.kind === "instruction") {
      if (node.command && this.collectSourceMetadata) {
        this.collectCommandReferences(node.command);
      }
    }
    if (node.kind === "loop") {
      this.executeLoweredLoop(node);
      return;
    }
    if (node.kind === "conditional") {
      this.executeConditionalBranches(
        node.branches,
        (commands) => this.executeLoweredNodeStream(commands)
      );
      return;
    }
    this.dispatchLoweredNode(node);
  }
  /**
   * Executes lowered node stream.
   * @param {LoweredExecutableNode[]} nodes The nodes.
   */
  executeLoweredNodeStream(nodes) {
    for (const node of nodes) {
      this.executeLoweredNodeWithRecovery(node);
    }
  }
  /**
   * Drains and executes any completed nodes still buffered in the incremental parser.
   * This protects re-entrant command sources, such as macro expansion, from leaving
   * finished typed roots stranded until the next top-level line arrives.
   */
  flushCompletedIncrementalNodes() {
    const ready = this.programModelBuilder.drainCompletedRoots(this.incrementalProgramParseState);
    if (ready.length > 0) {
      this.lowerAndExecuteRuntimeNodes(ready);
    }
  }
  /**
   * Executes conditional branches.
   * @param {Array<{ kind: "if" | "elseif" | "else"; conditionNode?: ExpressionNode; commands: TCommand[]; }>} branches The branches.
   * @param {(commands: TCommand[]) => void} executeCommands The execute commands.
   */
  executeConditionalBranches(branches, executeCommands) {
    for (const branch2 of branches) {
      if (branch2.kind === "else") {
        executeCommands(branch2.commands);
        return;
      }
      if (!branch2.conditionNode) {
        continue;
      }
      let branchConditionMatched = false;
      this.requireStaticLabelLookup = true;
      try {
        branchConditionMatched = this.evaluateExpression(branch2.conditionNode);
      } finally {
        this.requireStaticLabelLookup = false;
      }
      if (branchConditionMatched) {
        executeCommands(branch2.commands);
        return;
      }
    }
  }
};

// packages/core/src/architecture-types.ts
var createEncoderRuntime = (context) => ({
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

// packages/plugin-loader-node/src/configuration.ts
import { existsSync, promises as fs3 } from "node:fs";
import path2 from "node:path";
var PROJECT_CONFIG_FILENAME = "uttori-asm.config.json";
var TOP_LEVEL_KEYS = /* @__PURE__ */ new Set([
  "$schema",
  "plugins",
  "target",
  "architecture",
  "includePaths",
  "entryPoints",
  "buildOutput",
  "baseImage"
]);
var PLUGIN_KEYS = /* @__PURE__ */ new Set(["module", "options"]);
var isRecord2 = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
var configurationError = (message, cause) => new PluginError(message, {
  code: "PLUGIN_CONFIGURATION_INVALID",
  cause
});
var optionalText = (value, field) => {
  if (value === void 0) return void 0;
  if (typeof value !== "string" || value.trim() === "") {
    throw configurationError(`Configuration field '${field}' must be a non-empty string.`);
  }
  return value;
};
var optionalStringArray = (value, field) => {
  if (value === void 0) return void 0;
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.trim() === "")) {
    throw configurationError(`Configuration field '${field}' must be an array of strings.`);
  }
  return value;
};
var validatePluginEntry = (value, index) => {
  const entry = `plugins[${index}]`;
  if (!isRecord2(value)) {
    throw configurationError(`Configuration entry '${entry}' must be an object.`);
  }
  const unknown = Object.keys(value).filter((key) => !PLUGIN_KEYS.has(key));
  if (unknown.length > 0) {
    throw configurationError(
      `Configuration entry '${entry}' has unknown field(s): ${unknown.join(", ")}.`
    );
  }
  if (typeof value.module !== "string" || value.module.trim() === "") {
    throw configurationError(`Configuration entry '${entry}.module' must be a non-empty string.`);
  }
  if (value.options !== void 0 && !isRecord2(value.options)) {
    throw configurationError(`Configuration entry '${entry}.options' must be an object.`);
  }
  return {
    module: value.module,
    ...value.options === void 0 ? {} : { options: value.options }
  };
};
var validateProjectConfiguration = (value) => {
  if (!isRecord2(value)) {
    throw configurationError("Project configuration must be a JSON object.");
  }
  const unknown = Object.keys(value).filter((key) => !TOP_LEVEL_KEYS.has(key));
  if (unknown.length > 0) {
    throw configurationError(`Project configuration has unknown field(s): ${unknown.join(", ")}.`);
  }
  if (value.plugins !== void 0 && !Array.isArray(value.plugins)) {
    throw configurationError("Configuration field 'plugins' must be an array.");
  }
  const schema = optionalText(value.$schema, "$schema");
  const target = optionalText(value.target, "target");
  const architecture = optionalText(value.architecture, "architecture");
  const includePaths = optionalStringArray(value.includePaths, "includePaths");
  const entryPoints = optionalStringArray(value.entryPoints, "entryPoints");
  const buildOutput = optionalText(value.buildOutput, "buildOutput");
  const baseImage = optionalText(value.baseImage, "baseImage");
  return {
    ...schema === void 0 ? {} : { $schema: schema },
    ...value.plugins === void 0 ? {} : { plugins: value.plugins.map((entry, index) => validatePluginEntry(entry, index)) },
    ...target === void 0 ? {} : { target },
    ...architecture === void 0 ? {} : { architecture },
    ...includePaths === void 0 ? {} : { includePaths },
    ...entryPoints === void 0 ? {} : { entryPoints },
    ...buildOutput === void 0 ? {} : { buildOutput },
    ...baseImage === void 0 ? {} : { baseImage }
  };
};
var readProjectConfiguration = async (cwd, configuredPath) => {
  const explicit = configuredPath !== void 0;
  const candidates = explicit ? [path2.resolve(cwd, configuredPath)] : [path2.resolve(cwd, PROJECT_CONFIG_FILENAME)];
  let lastError;
  for (const configPath of candidates) {
    let source;
    try {
      source = await fs3.readFile(configPath, "utf8");
    } catch (error) {
      const code = typeof error === "object" && error !== null && "code" in error ? error.code : void 0;
      if (code === "ENOENT") {
        lastError = error;
        continue;
      }
      throw configurationError(`Unable to read project configuration '${configPath}'.`, error);
    }
    let parsed;
    try {
      parsed = JSON.parse(source);
    } catch (error) {
      throw configurationError(`Project configuration '${configPath}' is not valid JSON.`, error);
    }
    return {
      path: configPath,
      directory: path2.dirname(configPath),
      configuration: validateProjectConfiguration(parsed)
    };
  }
  if (!explicit) {
    return { directory: path2.resolve(cwd), configuration: {} };
  }
  throw configurationError(`Unable to read project configuration '${candidates[0]}'.`, lastError);
};

// packages/plugin-loader-node/src/loader.ts
import { realpath } from "node:fs/promises";
import path3 from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
var isRecord3 = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
var toOptionsRecord = (value, entry) => {
  if (value === void 0) return {};
  if (!isRecord3(value)) {
    throw new PluginError(`Configuration entry '${entry}.options' must be an object.`, {
      code: "PLUGIN_CONFIGURATION_INVALID"
    });
  }
  return { ...value };
};
var pluginIdFromNamespace = (namespace) => {
  if (!isRecord3(namespace) || !isRecord3(namespace.default) || !isRecord3(namespace.default.manifest)) {
    return void 0;
  }
  return typeof namespace.default.manifest.id === "string" ? namespace.default.manifest.id : void 0;
};
var stableValue = (value) => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (isRecord3(value)) {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, stableValue(value[key])])
    );
  }
  return value;
};
var normalizeFileUrl = async (url) => {
  try {
    return pathToFileURL(await realpath(fileURLToPath(url))).href;
  } catch {
    return url.href;
  }
};
var moduleLoadError = (request, message, resolvedModule, cause) => new PluginError(
  `Configuration entry '${request.configEntry}' (${request.module})${resolvedModule ? ` resolved to '${resolvedModule}'` : ""}: ${message}`,
  {
    code: "PLUGIN_MODULE_NOT_FOUND",
    pluginModule: resolvedModule ?? request.module,
    cause
  }
);
var resolveExternalModule = async (request) => {
  try {
    if (request.module.startsWith("file:")) {
      return normalizeFileUrl(new URL(request.module));
    }
    if (path3.isAbsolute(request.module) || request.module.startsWith("./") || request.module.startsWith("../")) {
      return normalizeFileUrl(pathToFileURL(path3.resolve(request.baseDirectory, request.module)));
    }
    const parent = pathToFileURL(path3.join(request.baseDirectory, PROJECT_CONFIG_FILENAME));
    return await normalizeFileUrl(new URL(import.meta.resolve(request.module, parent.href)));
  } catch (error) {
    throw moduleLoadError(request, "module could not be resolved", void 0, error);
  }
};
var wrapActivationError = (error, modules) => {
  if (!(error instanceof PluginError)) {
    return new PluginError("Plugin activation failed.", {
      code: "PLUGIN_ACTIVATION_FAILED",
      cause: error
    });
  }
  const entry = modules.find(
    (item) => item.resolvedModule === error.pluginModule || error.pluginId !== void 0 && item.pluginId === error.pluginId
  );
  if (!entry) return error;
  return new PluginError(
    `Configuration entry '${entry.configEntry}' resolved to '${entry.resolvedModule}': ${error.message}`,
    {
      code: error.code,
      pluginId: error.pluginId ?? entry.pluginId,
      pluginModule: error.pluginModule ?? entry.resolvedModule,
      contributionId: error.contributionId,
      targetId: error.targetId,
      cause: error.cause ?? error
    }
  );
};
var NodePluginLoader = class {
  #current;
  async loadProjectEnvironment(options) {
    const cwd = path3.resolve(options.cwd);
    const loadedConfig = options.allowProjectConfiguration === false ? { directory: cwd, configuration: {} } : await readProjectConfiguration(cwd, options.configFile);
    const configPlugins = loadedConfig.configuration.plugins ?? [];
    const defaultPlugins = configPlugins.length === 0 ? options.defaults?.plugins ?? [] : [];
    const requests = [
      ...configPlugins.map((request, index) => ({
        ...request,
        baseDirectory: loadedConfig.directory,
        source: "configuration",
        configEntry: `plugins[${index}]`
      })),
      ...defaultPlugins.map((request, index) => ({
        ...request,
        baseDirectory: cwd,
        source: "host-default",
        configEntry: `hostDefaults.plugins[${index}]`
      })),
      ...(options.pluginModules ?? []).map((request, index) => ({
        ...request,
        baseDirectory: cwd,
        source: "override",
        configEntry: `pluginModules[${index}]`
      }))
    ];
    if (options.activateBundledPlugins && options.bundledPlugins) {
      const requested = new Set(requests.map((request) => request.module));
      for (const module of options.bundledPlugins.keys()) {
        if (requested.has(module)) continue;
        requested.add(module);
        requests.push({
          module,
          baseDirectory: cwd,
          source: "bundled",
          configEntry: `bundledPlugins[${module}]`
        });
      }
    }
    const modules = [];
    for (const request of requests) {
      modules.push(await this.#resolveAndImport(request, options));
    }
    const duplicates = /* @__PURE__ */ new Map();
    for (const item of modules) {
      const previous = duplicates.get(item.resolvedModule);
      if (previous) {
        throw new PluginError(
          `Configuration entries '${previous.configEntry}' and '${item.configEntry}' resolve to the same module '${item.resolvedModule}'.`,
          {
            code: "PLUGIN_CONFIGURATION_INVALID",
            pluginId: item.pluginId || void 0,
            pluginModule: item.resolvedModule
          }
        );
      }
      duplicates.set(item.resolvedModule, item);
    }
    this.#assertAllPluginOptionOverridesMatched(options, modules);
    const targetInput = options.overrides?.target ?? loadedConfig.configuration.target ?? options.defaults?.target;
    const architectureInput = options.overrides?.architecture ?? loadedConfig.configuration.architecture ?? options.defaults?.architecture;
    const configuredIncludePaths = options.overrides?.includePaths ?? loadedConfig.configuration.includePaths ?? options.defaults?.includePaths ?? ["./"];
    let includeBase = cwd;
    if (options.overrides?.includePaths === void 0 && loadedConfig.configuration.includePaths !== void 0) {
      includeBase = loadedConfig.directory;
    }
    const includePaths = [
      ...new Set(configuredIncludePaths.map((entry) => path3.resolve(includeBase, entry)))
    ];
    const preliminarySnapshot = JSON.stringify(
      stableValue({
        configFile: loadedConfig.path,
        modules: modules.map((item) => ({
          module: item.module,
          resolvedModule: item.resolvedModule,
          pluginId: item.pluginId,
          options: item.normalizedOptions,
          source: item.source
        })),
        targetInput,
        architectureInput,
        includePaths
      })
    );
    if (this.#current?.snapshot === preliminarySnapshot && !this.#current.disposed) {
      return this.#current.loaded;
    }
    await this.#disposeCurrent();
    const manager = new PluginManager({ logger: options.logger });
    try {
      const activationRequests = modules.map((item) => ({
        module: item.namespace,
        options: item.normalizedOptions,
        pluginModule: item.resolvedModule
      }));
      await manager.activateModules(activationRequests);
      const environment = manager.freeze();
      const targets = environment.getTargetSummaries();
      const targetCandidate = targetInput ?? (targets.length === 1 ? targets[0]?.id : void 0);
      if (!targetCandidate) {
        throw new PluginError(
          targets.length === 0 ? "No target is configured and the active plugins provide no targets." : `No target is configured; choose one of: ${targets.map((target2) => target2.id).join(", ")}.`,
          { code: "PLUGIN_TARGET_INVALID" }
        );
      }
      const target = environment.resolveTargetId(targetCandidate);
      if (!target) {
        throw new PluginError(`Unknown configured target '${targetCandidate}'.`, {
          code: "PLUGIN_TARGET_INVALID",
          targetId: targetCandidate
        });
      }
      const targetContribution = environment.getTarget(target);
      const architectureCandidate = architectureInput ?? targetContribution.defaultArchitecture;
      const architecture = environment.resolveArchitectureId(target, architectureCandidate);
      if (!architecture) {
        throw new PluginError(
          `Architecture '${architectureCandidate}' is not available for target '${target}'.`,
          {
            code: "PLUGIN_TARGET_INVALID",
            targetId: target,
            contributionId: architectureCandidate
          }
        );
      }
      const targetOwner = environment.getContributionOwner(target);
      const configuredTargetOptions = modules.find((item) => item.pluginId === targetOwner)?.normalizedOptions ?? {};
      const targetOptions2 = Object.freeze({
        ...targetContribution.createOptions ? configuredTargetOptions : {}
      });
      const normalizedPlugins = Object.freeze(
        modules.map(
          (item) => Object.freeze({
            module: item.module,
            resolvedModule: item.resolvedModule,
            pluginId: item.pluginId,
            options: item.normalizedOptions,
            source: item.source,
            configEntry: item.configEntry,
            bundled: item.bundled
          })
        )
      );
      const configuration = Object.freeze({
        ...loadedConfig.path === void 0 ? {} : { configFile: loadedConfig.path },
        projectRoot: loadedConfig.directory,
        plugins: normalizedPlugins,
        target,
        architecture,
        targetOptions: targetOptions2,
        includePaths: Object.freeze(includePaths)
      });
      const current = {};
      const loaded = Object.freeze({
        environment,
        target,
        architecture,
        targetOptions: targetOptions2,
        includePaths: configuration.includePaths,
        configuration,
        diagnostics: Object.freeze([]),
        dispose: async () => {
          if (this.#current === current) this.#current = void 0;
          await this.#disposeEntry(current);
        }
      });
      Object.assign(current, {
        snapshot: preliminarySnapshot,
        manager,
        loaded,
        disposed: false
      });
      this.#current = current;
      return loaded;
    } catch (error) {
      await manager.dispose();
      throw wrapActivationError(error, modules);
    }
  }
  async dispose() {
    await this.#disposeCurrent();
  }
  async #resolveAndImport(request, options) {
    const bundled = options.bundledPlugins?.get(request.module);
    let resolvedModule;
    let namespace;
    if (bundled) {
      resolvedModule = `bundled:${request.module}`;
      namespace = { default: bundled };
    } else {
      resolvedModule = await resolveExternalModule(request);
      try {
        namespace = await import(resolvedModule);
      } catch (error) {
        throw moduleLoadError(request, "module could not be imported", resolvedModule, error);
      }
    }
    const pluginId = pluginIdFromNamespace(namespace) ?? "";
    const configuredOptions = toOptionsRecord(request.options, request.configEntry);
    const moduleOverride = options.overrides?.pluginOptions?.[request.module] ?? {};
    const idOverride = pluginId ? options.overrides?.pluginOptions?.[pluginId] ?? {} : {};
    return {
      ...request,
      resolvedModule,
      bundled: bundled !== void 0,
      namespace,
      pluginId,
      normalizedOptions: Object.freeze({ ...configuredOptions, ...moduleOverride, ...idOverride })
    };
  }
  #assertAllPluginOptionOverridesMatched(options, modules) {
    for (const key of Object.keys(options.overrides?.pluginOptions ?? {})) {
      if (!modules.some((item) => item.module === key || item.pluginId === key)) {
        throw new PluginError(`Plugin option override '${key}' does not match a loaded plugin.`, {
          code: "PLUGIN_CONFIGURATION_INVALID",
          pluginId: key
        });
      }
    }
  }
  async #disposeCurrent() {
    const current = this.#current;
    this.#current = void 0;
    if (current) await this.#disposeEntry(current);
  }
  async #disposeEntry(current) {
    if (current.disposed) return;
    current.disposed = true;
    await current.manager.dispose();
  }
};
var defaultLoaders = /* @__PURE__ */ new Map();
var loadProjectEnvironment = async (options) => {
  const key = path3.resolve(options.cwd);
  let loader = defaultLoaders.get(key);
  if (!loader) {
    loader = new NodePluginLoader();
    defaultLoaders.set(key, loader);
  }
  const loaded = await loader.loadProjectEnvironment(options);
  const dispose = loaded.dispose.bind(loaded);
  return Object.freeze({
    ...loaded,
    dispose: async () => {
      await dispose();
      if (defaultLoaders.get(key) === loader) defaultLoaders.delete(key);
    }
  });
};

// packages/plugin-snes/src/tooling/instruction-catalog.ts
function implied(mnemonic, summary, opcode, size = 1) {
  return { mnemonic, summary, modes: [{ mode: "implied", syntax: "", opcode, size }] };
}
function branch(mnemonic, summary, opcode, size = 2) {
  return { mnemonic, summary, modes: [{ mode: "relative", syntax: "label", opcode, size }] };
}
function instruction(mnemonic, summary, modes) {
  return { mnemonic, summary, modes };
}
var aluModes = [
  { mode: "immediate", syntax: "#const" },
  { mode: "direct", syntax: "dp" },
  { mode: "directIndexedX", syntax: "dp,x" },
  { mode: "directIndirect", syntax: "(dp)" },
  { mode: "directIndirectLong", syntax: "[dp]" },
  { mode: "directIndexedXIndirect", syntax: "(dp,x)" },
  { mode: "directIndirectIndexedY", syntax: "(dp),y" },
  { mode: "directIndirectLongIndexedY", syntax: "[dp],y" },
  { mode: "absolute", syntax: "addr" },
  { mode: "absoluteIndexedX", syntax: "addr,x" },
  { mode: "absoluteIndexedY", syntax: "addr,y" },
  { mode: "absoluteLong", syntax: "long" },
  { mode: "absoluteLongIndexedX", syntax: "long,x" },
  { mode: "stackRelative", syntax: "sr,s" },
  { mode: "stackRelativeIndirectIndexedY", syntax: "(sr,s),y" }
];
var shiftModes = [
  { mode: "accumulator", syntax: "a", size: 1 },
  { mode: "direct", syntax: "dp" },
  { mode: "directIndexedX", syntax: "dp,x" },
  { mode: "absolute", syntax: "addr" },
  { mode: "absoluteIndexedX", syntax: "addr,x" }
];
var cpu65816Catalog = [
  instruction("ADC", "Add with carry to the accumulator.", aluModes),
  instruction("AND", "Bitwise AND with the accumulator.", aluModes),
  instruction("ASL", "Arithmetic shift left.", shiftModes),
  branch("BCC", "Branch if carry clear.", 144),
  branch("BCS", "Branch if carry set.", 176),
  branch("BEQ", "Branch if equal (zero set).", 240),
  instruction("BIT", "Test bits against the accumulator.", [
    { mode: "immediate", syntax: "#const" },
    { mode: "direct", syntax: "dp" },
    { mode: "directIndexedX", syntax: "dp,x" },
    { mode: "absolute", syntax: "addr" },
    { mode: "absoluteIndexedX", syntax: "addr,x" }
  ]),
  branch("BMI", "Branch if minus (negative set).", 48),
  branch("BNE", "Branch if not equal (zero clear).", 208),
  branch("BPL", "Branch if plus (negative clear).", 16),
  branch("BRA", "Branch always.", 128),
  instruction("BRK", "Software break / interrupt.", [
    { mode: "stack", syntax: "", opcode: 0, size: 2 }
  ]),
  branch("BRL", "Branch always long (16-bit relative).", 130, 3),
  branch("BVC", "Branch if overflow clear.", 80),
  branch("BVS", "Branch if overflow set.", 112),
  implied("CLC", "Clear carry flag.", 24),
  implied("CLD", "Clear decimal flag.", 216),
  implied("CLI", "Clear interrupt-disable flag.", 88),
  implied("CLV", "Clear overflow flag.", 184),
  instruction("CMP", "Compare with the accumulator.", aluModes),
  instruction("COP", "Coprocessor enable interrupt.", [
    { mode: "stack", syntax: "#const", opcode: 2, size: 2 }
  ]),
  instruction("CPX", "Compare with the X register.", [
    { mode: "immediate", syntax: "#const" },
    { mode: "direct", syntax: "dp" },
    { mode: "absolute", syntax: "addr" }
  ]),
  instruction("CPY", "Compare with the Y register.", [
    { mode: "immediate", syntax: "#const" },
    { mode: "direct", syntax: "dp" },
    { mode: "absolute", syntax: "addr" }
  ]),
  instruction("DEC", "Decrement memory or the accumulator.", shiftModes),
  implied("DEX", "Decrement the X register.", 202),
  implied("DEY", "Decrement the Y register.", 136),
  instruction("EOR", "Bitwise exclusive-OR with the accumulator.", aluModes),
  instruction("INC", "Increment memory or the accumulator.", shiftModes),
  implied("INX", "Increment the X register.", 232),
  implied("INY", "Increment the Y register.", 200),
  instruction("JML", "Jump long (24-bit).", [
    { mode: "absoluteLong", syntax: "long", opcode: 92, size: 4 },
    { mode: "absoluteIndirectLong", syntax: "[addr]", opcode: 220, size: 3 }
  ]),
  instruction("JMP", "Jump.", [
    { mode: "absolute", syntax: "addr", opcode: 76, size: 3 },
    { mode: "absoluteIndirect", syntax: "(addr)", opcode: 108, size: 3 },
    { mode: "absoluteIndexedXIndirect", syntax: "(addr,x)", opcode: 124, size: 3 }
  ]),
  instruction("JSL", "Jump to subroutine long.", [
    { mode: "absoluteLong", syntax: "long", opcode: 34, size: 4 }
  ]),
  instruction("JSR", "Jump to subroutine.", [
    { mode: "absolute", syntax: "addr", opcode: 32, size: 3 },
    { mode: "absoluteIndexedXIndirect", syntax: "(addr,x)", opcode: 252, size: 3 }
  ]),
  instruction("LDA", "Load the accumulator.", aluModes),
  instruction("LDX", "Load the X register.", [
    { mode: "immediate", syntax: "#const" },
    { mode: "direct", syntax: "dp" },
    { mode: "directIndexedY", syntax: "dp,y" },
    { mode: "absolute", syntax: "addr" },
    { mode: "absoluteIndexedY", syntax: "addr,y" }
  ]),
  instruction("LDY", "Load the Y register.", [
    { mode: "immediate", syntax: "#const" },
    { mode: "direct", syntax: "dp" },
    { mode: "directIndexedX", syntax: "dp,x" },
    { mode: "absolute", syntax: "addr" },
    { mode: "absoluteIndexedX", syntax: "addr,x" }
  ]),
  instruction("LSR", "Logical shift right.", shiftModes),
  instruction("MVN", "Block move next (ascending).", [
    // Hover syntax is WDC dest,src; the encoder writes operands in source order
    // (Asar). See Arch65816.handleBlockMove.
    { mode: "blockMove", syntax: "destBank,srcBank", opcode: 84, size: 3 }
  ]),
  instruction("MVP", "Block move previous (descending).", [
    { mode: "blockMove", syntax: "destBank,srcBank", opcode: 68, size: 3 }
  ]),
  implied("NOP", "No operation.", 234),
  instruction("ORA", "Bitwise OR with the accumulator.", aluModes),
  instruction("PEA", "Push effective absolute address.", [
    { mode: "stack", syntax: "addr", opcode: 244, size: 3 }
  ]),
  instruction("PEI", "Push effective indirect address.", [
    { mode: "stack", syntax: "(dp)", opcode: 212, size: 2 }
  ]),
  instruction("PER", "Push effective PC-relative address.", [
    { mode: "stack", syntax: "label", opcode: 98, size: 3 }
  ]),
  implied("PHA", "Push the accumulator.", 72),
  implied("PHB", "Push the data bank register.", 139),
  implied("PHD", "Push the direct page register.", 11),
  implied("PHK", "Push the program bank register.", 75),
  implied("PHP", "Push the processor status register.", 8),
  implied("PHX", "Push the X register.", 218),
  implied("PHY", "Push the Y register.", 90),
  implied("PLA", "Pull the accumulator.", 104),
  implied("PLB", "Pull the data bank register.", 171),
  implied("PLD", "Pull the direct page register.", 43),
  implied("PLP", "Pull the processor status register.", 40),
  implied("PLX", "Pull the X register.", 250),
  implied("PLY", "Pull the Y register.", 122),
  instruction("REP", "Reset status bits.", [
    { mode: "immediate", syntax: "#const", opcode: 194, size: 2 }
  ]),
  instruction("ROL", "Rotate left through carry.", shiftModes),
  instruction("ROR", "Rotate right through carry.", shiftModes),
  implied("RTI", "Return from interrupt.", 64),
  implied("RTL", "Return from subroutine long.", 107),
  implied("RTS", "Return from subroutine.", 96),
  instruction("SBC", "Subtract with borrow from the accumulator.", aluModes),
  implied("SEC", "Set carry flag.", 56),
  implied("SED", "Set decimal flag.", 248),
  implied("SEI", "Set interrupt-disable flag.", 120),
  instruction("SEP", "Set status bits.", [
    { mode: "immediate", syntax: "#const", opcode: 226, size: 2 }
  ]),
  instruction(
    "STA",
    "Store the accumulator.",
    aluModes.filter((mode) => mode.mode !== "immediate")
  ),
  implied("STP", "Stop the processor.", 219),
  instruction("STX", "Store the X register.", [
    { mode: "direct", syntax: "dp" },
    { mode: "directIndexedY", syntax: "dp,y" },
    { mode: "absolute", syntax: "addr" }
  ]),
  instruction("STY", "Store the Y register.", [
    { mode: "direct", syntax: "dp" },
    { mode: "directIndexedX", syntax: "dp,x" },
    { mode: "absolute", syntax: "addr" }
  ]),
  instruction("STZ", "Store zero to memory.", [
    { mode: "direct", syntax: "dp" },
    { mode: "directIndexedX", syntax: "dp,x" },
    { mode: "absolute", syntax: "addr" },
    { mode: "absoluteIndexedX", syntax: "addr,x" }
  ]),
  implied("TAX", "Transfer accumulator to X.", 170),
  implied("TAY", "Transfer accumulator to Y.", 168),
  implied("TCD", "Transfer accumulator to direct page register.", 91),
  implied("TCS", "Transfer accumulator to stack pointer.", 27),
  implied("TDC", "Transfer direct page register to accumulator.", 123),
  implied("TSC", "Transfer stack pointer to accumulator.", 59),
  implied("TSX", "Transfer stack pointer to X.", 186),
  implied("TXA", "Transfer X to accumulator.", 138),
  implied("TXS", "Transfer X to stack pointer.", 154),
  implied("TXY", "Transfer X to Y.", 155),
  implied("TYA", "Transfer Y to accumulator.", 152),
  implied("TYX", "Transfer Y to X.", 187),
  implied("WAI", "Wait for interrupt.", 203),
  instruction("WDM", "Reserved (William D. Mensch) opcode.", [
    { mode: "immediate", syntax: "#const", opcode: 66, size: 2 }
  ]),
  implied("XBA", "Exchange the bytes of the accumulator.", 235),
  implied("XCE", "Exchange carry and emulation flags.", 251)
];
var spc700Catalog = [
  instruction("MOV", "Move data between registers and memory.", [
    { mode: "registerImmediate", syntax: "A,#const" },
    { mode: "registerDirect", syntax: "A,dp" },
    { mode: "registerAbsolute", syntax: "A,!addr" },
    { mode: "directRegister", syntax: "dp,A" },
    { mode: "absoluteRegister", syntax: "!addr,A" },
    { mode: "registerIndirect", syntax: "A,(X)" },
    { mode: "directDirect", syntax: "dp,dp" },
    { mode: "directImmediate", syntax: "dp,#const" }
  ]),
  instruction("ADC", "Add with carry.", [
    { mode: "registerImmediate", syntax: "A,#const" },
    { mode: "registerDirect", syntax: "A,dp" },
    { mode: "registerAbsolute", syntax: "A,!addr" },
    { mode: "directDirect", syntax: "dp,dp" }
  ]),
  instruction("SBC", "Subtract with borrow.", [
    { mode: "registerImmediate", syntax: "A,#const" },
    { mode: "registerDirect", syntax: "A,dp" },
    { mode: "registerAbsolute", syntax: "A,!addr" }
  ]),
  instruction("CMP", "Compare.", [
    { mode: "registerImmediate", syntax: "A,#const" },
    { mode: "registerDirect", syntax: "A,dp" },
    { mode: "registerAbsolute", syntax: "A,!addr" }
  ]),
  instruction("AND", "Bitwise AND.", [
    { mode: "registerImmediate", syntax: "A,#const" },
    { mode: "registerDirect", syntax: "A,dp" }
  ]),
  instruction("OR", "Bitwise OR.", [
    { mode: "registerImmediate", syntax: "A,#const" },
    { mode: "registerDirect", syntax: "A,dp" }
  ]),
  instruction("EOR", "Bitwise exclusive-OR.", [
    { mode: "registerImmediate", syntax: "A,#const" },
    { mode: "registerDirect", syntax: "A,dp" }
  ]),
  instruction("INC", "Increment.", [
    { mode: "register", syntax: "A" },
    { mode: "direct", syntax: "dp" }
  ]),
  instruction("DEC", "Decrement.", [
    { mode: "register", syntax: "A" },
    { mode: "direct", syntax: "dp" }
  ]),
  instruction("ASL", "Arithmetic shift left.", [
    { mode: "register", syntax: "A" },
    { mode: "direct", syntax: "dp" }
  ]),
  instruction("LSR", "Logical shift right.", [
    { mode: "register", syntax: "A" },
    { mode: "direct", syntax: "dp" }
  ]),
  instruction("ROL", "Rotate left.", [
    { mode: "register", syntax: "A" },
    { mode: "direct", syntax: "dp" }
  ]),
  instruction("ROR", "Rotate right.", [
    { mode: "register", syntax: "A" },
    { mode: "direct", syntax: "dp" }
  ]),
  branch("BRA", "Branch always.", 47),
  branch("BEQ", "Branch if equal.", 240),
  branch("BNE", "Branch if not equal.", 208),
  branch("BCS", "Branch if carry set.", 176),
  branch("BCC", "Branch if carry clear.", 144),
  branch("BVS", "Branch if overflow set.", 112),
  branch("BVC", "Branch if overflow clear.", 80),
  branch("BMI", "Branch if minus.", 48),
  branch("BPL", "Branch if plus.", 16),
  instruction("CBNE", "Compare and branch if not equal.", [
    { mode: "directRelative", syntax: "dp,label" }
  ]),
  instruction("DBNZ", "Decrement and branch if not zero.", [
    { mode: "directRelative", syntax: "dp,label" }
  ]),
  instruction("JMP", "Jump.", [
    { mode: "absolute", syntax: "!addr" },
    { mode: "absoluteIndexedXIndirect", syntax: "[!addr+X]" }
  ]),
  instruction("CALL", "Call subroutine.", [
    { mode: "absolute", syntax: "!addr", opcode: 63, size: 3 }
  ]),
  implied("RET", "Return from subroutine.", 111),
  implied("RETI", "Return from interrupt.", 127),
  implied("NOP", "No operation.", 0),
  implied("CLRC", "Clear carry.", 96),
  implied("SETC", "Set carry.", 128),
  implied("CLRP", "Clear direct page flag.", 32),
  implied("SETP", "Set direct page flag.", 64),
  implied("EI", "Enable interrupts.", 160),
  implied("DI", "Disable interrupts.", 192),
  implied("STOP", "Stop the processor.", 255),
  instruction("PUSH", "Push a register to the stack.", [{ mode: "register", syntax: "A" }]),
  instruction("POP", "Pop a register from the stack.", [{ mode: "register", syntax: "A" }])
];
var superFxRegister = { mode: "register", syntax: "Rn", size: 1 };
var superFxRegisterAlt = { mode: "register", syntax: "Rn", size: 2 };
var superFxImmediateAlt = { mode: "immediate", syntax: "#n", size: 2 };
var superFxIndirect = { mode: "registerIndirect", syntax: "(Rn)", size: 1 };
var superFxIndirectAlt = { mode: "registerIndirect", syntax: "(Rn)", size: 2 };
var superFxCatalog = [
  implied("STOP", "Stop the GSU.", 0),
  implied("NOP", "No operation.", 1),
  implied("CACHE", "Set the cache base register.", 2),
  implied("LSR", "Logical shift right.", 3),
  implied("ROL", "Rotate left.", 4),
  implied("LOOP", "Decrement R13 and branch if non-zero.", 60),
  implied("ALT1", "Set ALT1 prefix.", 61),
  implied("ALT2", "Set ALT2 prefix.", 62),
  implied("ALT3", "Set ALT1 and ALT2 prefixes.", 63),
  implied("PLOT", "Plot a pixel.", 76),
  implied("SWAP", "Swap high and low bytes of SReg.", 77),
  implied("COLOR", "Set the plot color from SReg.", 78),
  implied("NOT", "Bitwise NOT of SReg.", 79),
  implied("MERGE", "Merge high bytes of R7 and R8.", 112),
  implied("SBK", "Store SReg back to the last RAM address.", 144),
  implied("SEX", "Sign-extend the low byte of SReg.", 149),
  implied("ASR", "Arithmetic shift right of SReg.", 150),
  implied("ROR", "Rotate SReg right through carry.", 151),
  implied("LOB", "Keep the low byte of SReg.", 158),
  implied("FMULT", "Fractional signed multiply.", 159),
  implied("HIB", "Keep the high byte of SReg.", 192),
  implied("GETC", "Get byte from ROM into the plot color.", 223),
  implied("GETB", "Get byte from ROM into SReg.", 239),
  implied("RPIX", "Read pixel.", 61, 2),
  implied("CMODE", "Set plot color mode.", 61, 2),
  implied("DIV2", "Arithmetic shift right and clear the least bit.", 61, 2),
  implied("LMULT", "Signed 16\xD716 multiply.", 61, 2),
  implied("GETBH", "Get ROM byte into the high byte of SReg.", 61, 2),
  implied("RAMB", "Set the RAM bank from SReg.", 62, 2),
  implied("GETBL", "Get ROM byte into the low byte of SReg.", 62, 2),
  implied("ROMB", "Set the ROM bank from SReg.", 63, 2),
  implied("GETBS", "Get ROM byte sign-extended into SReg.", 63, 2),
  branch("BRA", "Branch always.", 5),
  branch("BGE", "Branch if greater or equal.", 6),
  branch("BLT", "Branch if less than.", 7),
  branch("BNE", "Branch if not equal.", 8),
  branch("BEQ", "Branch if equal.", 9),
  branch("BPL", "Branch if plus.", 10),
  branch("BMI", "Branch if minus.", 11),
  branch("BCC", "Branch if carry clear.", 12),
  branch("BCS", "Branch if carry set.", 13),
  branch("BVC", "Branch if overflow clear.", 14),
  branch("BVS", "Branch if overflow set.", 15),
  instruction("TO", "Set the destination register.", [{ ...superFxRegister, opcode: 16 }]),
  instruction("WITH", "Set source and destination register.", [
    { ...superFxRegister, opcode: 32 }
  ]),
  instruction("FROM", "Set the source register.", [{ ...superFxRegister, opcode: 176 }]),
  instruction("ADD", "Add to SReg.", [superFxRegister, superFxImmediateAlt]),
  instruction("ADC", "Add to SReg with carry.", [superFxRegisterAlt, superFxImmediateAlt]),
  instruction("SUB", "Subtract from SReg.", [superFxRegister, superFxImmediateAlt]),
  instruction("SBC", "Subtract from SReg with borrow.", [superFxRegisterAlt]),
  instruction("CMP", "Compare SReg with Rn.", [superFxRegisterAlt]),
  instruction("AND", "Bitwise AND with SReg.", [superFxRegister, superFxImmediateAlt]),
  instruction("BIC", "Bit clear SReg.", [superFxRegisterAlt, superFxImmediateAlt]),
  instruction("OR", "Bitwise OR with SReg.", [superFxRegister, superFxImmediateAlt]),
  instruction("XOR", "Bitwise exclusive-OR with SReg.", [superFxRegisterAlt, superFxImmediateAlt]),
  instruction("MULT", "Signed 8-bit multiply.", [superFxRegister, superFxImmediateAlt]),
  instruction("UMULT", "Unsigned 8-bit multiply.", [superFxRegisterAlt, superFxImmediateAlt]),
  instruction("JMP", "Jump to address in Rn (R8-R13).", [superFxRegister]),
  instruction("LJMP", "Long jump via Rn (R8-R13).", [superFxRegisterAlt]),
  instruction("INC", "Increment Rn (R0-R14).", [superFxRegister]),
  instruction("DEC", "Decrement Rn (R0-R14).", [superFxRegister]),
  instruction("LINK", "Set R11 to PBR:PC+n.", [
    { mode: "immediate", syntax: "#n", opcode: 144, size: 1 }
  ]),
  instruction("STW", "Store word at (Rn).", [superFxIndirect]),
  instruction("LDW", "Load word from (Rn).", [superFxIndirect]),
  instruction("STB", "Store byte at (Rn).", [superFxIndirectAlt]),
  instruction("LDB", "Load byte from (Rn).", [superFxIndirectAlt]),
  instruction("IBT", "Load Rn with a signed byte.", [
    { mode: "registerImmediate", syntax: "Rn,#imm", opcode: 160, size: 2 }
  ]),
  instruction("IWT", "Load Rn with a word.", [
    { mode: "registerImmediate", syntax: "Rn,#imm", opcode: 240, size: 3 }
  ]),
  instruction("LM", "Load Rn from RAM.", [
    { mode: "registerIndirectAbsolute", syntax: "Rn,(addr)", size: 4 }
  ]),
  instruction("LMS", "Load Rn from short RAM.", [
    { mode: "registerIndirectShort", syntax: "Rn,(xx)", size: 3 }
  ]),
  instruction("SM", "Store Rn to RAM.", [
    { mode: "indirectAbsoluteRegister", syntax: "(addr),Rn", size: 4 }
  ]),
  instruction("SMS", "Store Rn to short RAM.", [
    { mode: "indirectShortRegister", syntax: "(xx),Rn", size: 3 }
  ]),
  instruction("LEA", "Load Rn with the effective address.", [
    { mode: "registerAbsolute", syntax: "Rn,addr", opcode: 240, size: 3 }
  ]),
  instruction("MOVE", "Move register, immediate, or RAM data.", [
    { mode: "registerRegister", syntax: "Rn,Rm", size: 2 },
    { mode: "registerImmediate", syntax: "Rn,#imm" },
    { mode: "registerIndirectAbsolute", syntax: "Rn,(addr)" },
    { mode: "indirectAbsoluteRegister", syntax: "(addr),Rn" }
  ]),
  instruction("MOVES", "Move Rm to Rn and update flags.", [
    { mode: "registerRegister", syntax: "Rn,Rm", size: 2 }
  ]),
  instruction("MOVEB", "Move a byte through (Rn).", [
    { mode: "indirectRegister", syntax: "(Rn),Rm" },
    { mode: "registerIndirect", syntax: "Rn,(Rm)" }
  ]),
  instruction("MOVEW", "Move a word through (Rn).", [
    { mode: "indirectRegister", syntax: "(Rn),Rm" },
    { mode: "registerIndirect", syntax: "Rn,(Rm)" }
  ])
];

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
  let mode = "unknown";
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
    mode = "register";
    registerName = registerOperandMatch[1].toLowerCase();
    baseExpression = normalizedExpanded;
  } else if (registerIndirectAutoIncrementMatch) {
    mode = "registerIndirectAutoIncrement";
    registerName = registerIndirectAutoIncrementMatch[1].toLowerCase();
    baseExpression = registerIndirectAutoIncrementMatch[1];
  } else if (registerIndirectMatch) {
    mode = "registerIndirect";
    registerName = registerIndirectMatch[1].toLowerCase();
    baseExpression = registerIndirectMatch[1];
  } else if (directPageIndexedXIndirectMatch) {
    mode = "directPageIndexedXIndirect";
    baseExpression = directPageIndexedXIndirectMatch[1].trim();
  } else if (directPageIndirectIndexedYMatch) {
    mode = "directPageIndirectIndexedY";
    baseExpression = directPageIndirectIndexedYMatch[1].trim();
  } else if (bitAddressMatch) {
    mode = bitAddressMatch[1].length <= 3 ? "directPageBit" : "absoluteBit";
    baseExpression = bitAddressMatch[1].toUpperCase();
  }
  if (mode === "unknown" && expanded.startsWith("#")) {
    mode = "immediate";
    baseExpression = expanded.slice(1).trim();
  } else if (mode === "unknown" && /^\$[\da-f]{6}\s*,\s*x$/i.test(expanded)) {
    if (length >= 3) {
      mode = "absoluteLongIndexedX";
    } else {
      mode = "absoluteIndexedX";
    }
    baseExpression = expanded.replace(/\s*,\s*x$/i, "").trim();
  } else if (mode === "unknown" && /^\$[\da-f]{4}\s*,\s*x$/i.test(expanded)) {
    if (length >= 3) {
      mode = "absoluteLongIndexedX";
    } else {
      mode = "absoluteIndexedX";
    }
    baseExpression = expanded.replace(/\s*,\s*x$/i, "").trim();
  } else if (mode === "unknown" && /^\$[\da-f]{4}\s*,\s*y$/i.test(expanded)) {
    mode = "absoluteIndexedY";
    baseExpression = expanded.replace(/\s*,\s*y$/i, "").trim();
  } else if (mode === "unknown" && /^\(\s*(.+?)\s*,\s*x\s*\)$/i.test(normalizedExpanded)) {
    mode = "indexedIndirectX";
    baseExpression = normalizedExpanded.replace(/^\(\s*/, "").replace(/\s*,\s*x\s*\)$/i, "").trim();
  } else if (mode === "unknown" && lowered.startsWith("(") && lowered.endsWith(")")) {
    mode = "directPageIndirect";
    baseExpression = expanded.slice(1, -1).trim();
  } else if (mode === "unknown" && /^\(\s*(.+?)\s*,\s*s\s*\)\s*,\s*y$/i.test(normalizedExpanded)) {
    mode = "stackRelativeIndexedIndirectY";
    baseExpression = normalizedExpanded.replace(/^\(\s*/, "").replace(/\s*,\s*s\s*\)\s*,\s*y$/i, "").trim();
  } else if (mode === "unknown" && /,\s*s$/i.test(lowered)) {
    mode = "stackRelative";
    baseExpression = expanded.replace(/\s*,\s*s$/i, "").trim();
  } else if (mode === "unknown" && /^\[\s*(.+?)\s*]\s*,\s*y$/i.test(normalizedExpanded)) {
    mode = "indirectLongIndexedY";
    baseExpression = normalizedExpanded.replace(/^\[\s*/, "").replace(/\s*]\s*,\s*y$/i, "").trim();
  } else if (mode === "unknown" && lowered.startsWith("[") && lowered.endsWith("]")) {
    mode = "indirectLong";
    baseExpression = expanded.slice(1, -1).trim();
  } else if (mode === "unknown" && /^\(\s*(.+?)\s*\)\s*,\s*y$/i.test(normalizedExpanded)) {
    mode = "indirectIndexedY";
    baseExpression = normalizedExpanded.replace(/^\(\s*/, "").replace(/\s*\)\s*,\s*y$/i, "").trim();
  } else if (mode === "unknown" && /,\s*y$/i.test(lowered)) {
    mode = "absoluteIndexedY";
    baseExpression = expanded.replace(/\s*,\s*y$/i, "").trim();
  } else if (mode === "unknown" && /,\s*x$/i.test(lowered)) {
    baseExpression = expanded.replace(/\s*,\s*x$/i, "").trim();
    if (length >= 3) {
      mode = "absoluteLongIndexedX";
    } else if (length === 2) {
      mode = "absoluteIndexedX";
    } else {
      mode = "directPageIndexedX";
    }
  } else if (mode === "unknown" && /^\$[\da-f]+$/i.test(expanded)) {
    if (length >= 3) {
      mode = "absoluteLong";
    } else if (length === 2) {
      mode = "absolute";
    }
    baseExpression = expanded;
  }
  return {
    mode,
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

// packages/plugin-snes/src/architectures/65816.ts
var lower65816Operand = (resolver, operand) => {
  const lowered = resolver.lowerOperand(operand);
  return lowered.mode !== "unknown" ? lowered : classifyExpanded65816Operand(resolver, lowered);
};
var debug5 = (..._args) => {
};
try {
  const { default: d } = await import("debug");
  debug5 = d("Arch65816");
} catch {
}
var keepsFixedWidthAddressingMode = (mode, explicitLength) => {
  if (mode === "indirectLong" || mode === "indirectLongIndexedY" || mode === "indirectIndexedY" || mode === "indexedIndirectX" || mode === "stackRelative" || mode === "stackRelativeIndexedIndirectY") {
    return true;
  }
  if (mode === "directPageIndirect" && explicitLength === 1) {
    return true;
  }
  return false;
};
var isIndexedMemory = (operand, register) => operand.indexRegister === register && !keepsFixedWidthAddressingMode(operand.mode, 1);
var Arch65816 = class {
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
  estimateInstruction(instruction2) {
    return this.estimateResolvedInstruction(
      instruction2.mnemonic,
      instruction2.operandText,
      instruction2.loweredOperand.expanded,
      instruction2.loweredOperand.length
    );
  }
  /**
   * Encodes a lowered instruction. Returns false only when the mnemonic is not ours.
   * @param {LoweredInstruction} instruction The instruction.
   * @returns {boolean} True if encoded.
   */
  encodeInstruction(instruction2) {
    return this.encodeResolvedInstruction(
      instruction2.mnemonic,
      instruction2.operandText,
      instruction2.loweredOperand.expanded,
      instruction2.loweredOperand.length
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
    debug5("asblock_65816", words);
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
    debug5("asblock_65816 operand expanded", operand, "expected length:", operandLength);
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
    debug5("asblock_65816 opcode", opcode);
    debug5("asblock_65816 operand", operand);
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
    let hexconstant = false;
    let num = 0;
    if (operand) {
      num = this.assembler.operandResolver.getnum(operand);
      hexconstant = /^[$%]/.test(operand);
    }
    return this.handleGenericOpcode(opcode, num, len, explicitlen, hexconstant);
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
    debug5("handleMemoryOperations", { opcode, operand, len, explicitlen });
    if (!operand) {
      throw new Error(`Error: ${opcode} requires an operand.`);
    }
    const loweredOperand = lower65816Operand(this.assembler.operandResolver, rawOperand);
    const resolvedOperand = loweredOperand.expanded;
    const baseOperand = loweredOperand.baseExpression ?? resolvedOperand;
    const isExplicitDirectPage = loweredOperand.explicitDirectPage ?? false;
    const isExplicitDirectPageIndexedX = loweredOperand.explicitDirectPageIndexedX ?? false;
    if (loweredOperand.immediate) {
      debug5("handleMemoryOperations Immediate Mode (#$XX)", opcode, resolvedOperand);
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
      debug5("handleMemoryOperations Absolute Indexed,X", opcode, resolvedOperand);
      const absoluteIndexedXOpcodes = {
        ADC: 125,
        STA: 157,
        LDA: 189,
        SBC: 253
      };
      if (opcode in absoluteIndexedXOpcodes) {
        debug5("handleMemoryOperations =", absoluteIndexedXOpcodes[opcode].toString(16));
        this.assembler.write1(absoluteIndexedXOpcodes[opcode]);
        debug5(
          "handleMemoryOperations =",
          this.assembler.operandResolver.getnum(baseOperand).toString(16)
        );
        this.assembler.write2(this.assembler.operandResolver.getnum(baseOperand));
        return true;
      }
    }
    if (loweredOperand.mode === "absoluteLongIndexedX") {
      debug5("handleMemoryOperations Absolute Long Indexed,X", opcode, resolvedOperand);
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
      debug5("handleMemoryOperations Indexed Indirect (X)", opcode, resolvedOperand);
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
      debug5("handleMemoryOperations Direct Page Indirect", opcode, resolvedOperand);
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
      debug5("handleMemoryOperations DP Indexed,X", opcode, resolvedOperand);
      const dpIndexedXOpcodes = {
        ADC: 117,
        STA: 149,
        LDA: 181,
        SBC: 245
      };
      if (opcode in dpIndexedXOpcodes) {
        debug5("handleMemoryOperations = 1", dpIndexedXOpcodes[opcode].toString(16));
        this.assembler.write1(dpIndexedXOpcodes[opcode]);
        debug5("handleMemoryOperations = 1.5", baseOperand);
        const dpAddress = this.assembler.operandResolver.getnum(baseOperand);
        debug5("handleMemoryOperations = 2", dpAddress.toString(16));
        this.assembler.write1(dpAddress);
        return true;
      }
    }
    if (loweredOperand.mode === "stackRelative") {
      debug5("handleMemoryOperations Indexed Indirect (sr,S)", opcode, resolvedOperand);
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
      debug5(
        "handleMemoryOperations Stack Relative Indexed Indirect (sr,S),Y",
        opcode,
        resolvedOperand
      );
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
      debug5("handleMemoryOperations Indirect Indexed (Y)", opcode, resolvedOperand);
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
      debug5("handleMemoryOperations Absolute Indexed (X)", opcode, resolvedOperand);
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
      debug5("handleMemoryOperations Absolute Indexed (Y)", opcode, resolvedOperand);
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
      debug5("handleMemoryOperations Absolute Long ($000000)", opcode, resolvedOperand);
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
      debug5("handleMemoryOperations Absolute", opcode, resolvedOperand);
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
      debug5("handleMemoryOperations Direct Page", opcode, operand);
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
      debug5(
        "handleMemoryOperations Direct Page optimization disabled; using absolute",
        opcode,
        operand
      );
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
    debug5("handleLogicAndCompareOperations", { opcode, operand, len, explicitlen });
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
    let address = 0;
    let mode;
    if (loweredOperand.immediate) {
      debug5("handleLogicAndCompareOperations Immediate Mode", opcode, resolvedOperand);
      mode = "immediate";
      address = this.assembler.operandResolver.getnum(baseOperand);
      this.assembler.write1(opcodes[logicOpcode].immediate);
      const width = this.immediateBytes(opcode, len, explicitlen, rawOperand);
      if (width === 1) {
        this.assembler.write1(address);
      } else {
        this.assembler.write2(address);
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
      mode = "absoluteX";
      address = this.assembler.operandResolver.getnum(baseOperand);
    } else if (loweredOperand.mode === "absoluteIndexedY" && opcodes[logicOpcode].absoluteY) {
      mode = "absoluteY";
      address = this.assembler.operandResolver.getnum(baseOperand);
    } else if (loweredOperand.mode === "absoluteLong") {
      mode = "absoluteLong";
      address = this.assembler.operandResolver.getnum(resolvedOperand);
    } else if (loweredOperand.mode === "absoluteLongIndexedX" && opcodes[logicOpcode].absoluteLongX) {
      mode = "absoluteLongX";
      address = this.assembler.operandResolver.getnum(baseOperand);
    } else if (loweredOperand.mode === "stackRelative" && opcodes[logicOpcode].stackRelative) {
      mode = "stackRelative";
      address = this.assembler.operandResolver.getnum(baseOperand);
    } else if (loweredOperand.mode === "stackRelativeIndexedIndirectY" && opcodes[logicOpcode].stackRelativeIndirectY) {
      mode = "stackRelativeIndirectY";
      address = this.assembler.operandResolver.getnum(baseOperand);
    } else if (/^\$[\dA-Fa-f]{2}$/.test(resolvedOperand)) {
      mode = "direct";
      address = this.assembler.operandResolver.getnum(resolvedOperand);
    } else if (loweredOperand.mode === "directPageIndexedX" && opcodes[logicOpcode].directX) {
      mode = "directX";
      address = this.assembler.operandResolver.getnum(baseOperand);
    } else if (loweredOperand.mode === "indexedIndirectX") {
      mode = "indirectX";
      address = this.assembler.operandResolver.getnum(baseOperand);
    } else if (loweredOperand.mode === "indirectIndexedY") {
      mode = "indirectY";
      address = this.assembler.operandResolver.getnum(baseOperand);
    } else if (loweredOperand.mode === "directPageIndirect") {
      mode = "indirect";
      address = this.assembler.operandResolver.getnum(baseOperand);
    } else if (loweredOperand.mode === "indirectLong" && opcodes[logicOpcode].directIndirectLong) {
      mode = "directIndirectLong";
      address = this.assembler.operandResolver.getnum(baseOperand);
    } else if (loweredOperand.mode === "indirectLongIndexedY" && opcodes[logicOpcode].directIndirectLongY) {
      mode = "directIndirectLongY";
      address = this.assembler.operandResolver.getnum(baseOperand);
    } else if (loweredOperand.mode === "indirectLong") {
      mode = "indirectLong";
      address = this.assembler.operandResolver.getnum(baseOperand);
    } else if (loweredOperand.mode === "indirectLongIndexedY") {
      mode = "indirectLongY";
      address = this.assembler.operandResolver.getnum(baseOperand);
    } else if (loweredOperand.mode === "absolute") {
      mode = "absolute";
      address = this.assembler.operandResolver.getnum(resolvedOperand);
    } else {
      throw new Error(`Error: Invalid operand format for ${opcode}: ${operand}`);
    }
    debug5("handleLogicAndCompareOperations mode", mode, operand);
    const opcodeByte = opcodes[logicOpcode][mode];
    if (!opcodeByte) {
      throw new Error(`Error: Invalid operand format for ${opcode}: ${operand} => ${opcodeByte}`);
    }
    this.assembler.write1(opcodeByte);
    if ((opcode === "AND" || opcode === "ORA" || opcode === "EOR" || opcode === "CPY" || opcode === "CPX" || opcode === "CMP") && mode === "directIndirectLong") {
      this.assembler.write1(address);
    } else if (["absolute", "absoluteX", "absoluteY", "directIndirectLong"].includes(mode)) {
      this.assembler.write2(address);
    } else if (["absoluteLong", "absoluteLongX", "indirectLong", "indirectLongY"].includes(mode)) {
      this.assembler.write3(address);
    } else {
      this.assembler.write1(address);
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
    debug5("handleNoOperandOperations", {
      opcode,
      operand,
      value: stackOpcodes[opcode].toString(16)
    });
    let count = 1;
    if (operand && operand.startsWith("#")) {
      let repStr = operand.substring(1);
      if (repStr.startsWith("$")) {
        repStr = repStr.substring(1);
        debug5("handleNoOperandOperations removed $ prefix", repStr);
      }
      count = Number.parseInt(repStr, 10);
      debug5("handleNoOperandOperations count", count);
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
    debug5("handleArithmeticOperations", opcode, operand);
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
      debug5("handleArithmeticOperations DP Indexed,X", opcode, rawOperand);
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
    debug5("handleLoadRegister", { opcode, operand, len, explicitlen });
    if (!operand) {
      throw new Error(`Error: ${opcode} requires an operand.`);
    }
    const loweredOperand = lower65816Operand(this.assembler.operandResolver, operand);
    let opcodeByte = 0;
    let address = 0;
    const isLDX = opcode === "LDX";
    const isLDY = opcode === "LDY";
    if (operand.startsWith("#")) {
      if (isLDX) {
        opcodeByte = 162;
      } else if (isLDY) {
        opcodeByte = 160;
      }
      address = this.assembler.operandResolver.getnum(operand.slice(1));
      this.assembler.write1(opcodeByte);
      const width = this.immediateBytes(opcode, len, explicitlen, operand);
      if (width === 1) {
        this.assembler.write1(address);
      } else {
        this.assembler.write2(address);
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
      address = this.assembler.operandResolver.getnum(operand);
      this.assembler.write1(opcodeByte);
      if (len === 1) {
        this.assembler.write1(address);
      } else if (len === 2) {
        this.assembler.write2(address);
      } else {
        throw new Error(`Forced length ${len} not supported for ${opcode}`);
      }
      return true;
    }
    if (isLDX) {
      if (!isIndexed) {
        address = this.assembler.operandResolver.getnum(operand);
        if (loweredOperand.mode === "absolute" && !isDirectPageLiteral || isAbsoluteLiteral || inferredAbsoluteWidth || address > 255) {
          opcodeByte = 174;
          this.assembler.write1(opcodeByte);
          this.assembler.write2(address);
        } else {
          opcodeByte = 166;
          this.assembler.write1(opcodeByte);
          this.assembler.write1(address);
        }
      } else {
        address = this.assembler.operandResolver.getnum(operand);
        if (loweredOperand.mode === "absoluteIndexedY" && !isDirectPageLiteral || isAbsoluteLiteral || inferredAbsoluteWidth || address > 255) {
          opcodeByte = 190;
          this.assembler.write1(opcodeByte);
          this.assembler.write2(address);
        } else {
          opcodeByte = 182;
          this.assembler.write1(opcodeByte);
          this.assembler.write1(address);
        }
      }
    } else if (isLDY) {
      if (!isIndexed) {
        address = this.assembler.operandResolver.getnum(operand);
        if (loweredOperand.mode === "absolute" && !isDirectPageLiteral || isAbsoluteLiteral || inferredAbsoluteWidth || address > 255) {
          opcodeByte = 172;
          this.assembler.write1(opcodeByte);
          this.assembler.write2(address);
        } else {
          opcodeByte = 164;
          this.assembler.write1(opcodeByte);
          this.assembler.write1(address);
        }
      } else {
        address = this.assembler.operandResolver.getnum(operand);
        if (loweredOperand.mode === "absoluteIndexedX" && !isDirectPageLiteral || isAbsoluteLiteral || inferredAbsoluteWidth || address > 255) {
          opcodeByte = 188;
          this.assembler.write1(opcodeByte);
          this.assembler.write2(address);
        } else {
          opcodeByte = 180;
          this.assembler.write1(opcodeByte);
          this.assembler.write1(address);
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
    debug5("handleJump", { opcode, operand, rawOperand });
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
    let address = 0;
    let mode;
    const hintedBank = (() => {
      const simpleBankedLabel = symbolicOperand.startsWith("_") && symbolicOperand.length >= 7 && /^[\da-f]{6}$/i.test(symbolicOperand.slice(1, 7));
      if (!simpleBankedLabel) {
        return null;
      }
      return Number.parseInt(symbolicOperand.slice(1, 3), 16);
    })();
    const longMode = (currentOpcode) => {
      if (currentOpcode === "JMP") return "JML";
      if (currentOpcode === "JSR") return "JSL";
      return currentOpcode;
    };
    const shortMode = (currentOpcode) => currentOpcode;
    const absolutePointer = (value) => value & 65535;
    const selectDirectJumpMode = (currentOpcode, resolvedAddress) => {
      if (currentOpcode === "JML" || currentOpcode === "JSL") {
        return { mode: currentOpcode, address: resolvedAddress };
      }
      if (resolvedAddress > 65535) {
        const currentBank = this.assembler.currentTargetAddress >>> 16 & 255;
        const targetBank = resolvedAddress >>> 16 & 255;
        if ((currentOpcode === "JMP" || currentOpcode === "JSR") && targetBank === currentBank) {
          return { mode: shortMode(currentOpcode), address: absolutePointer(resolvedAddress) };
        }
        if ((currentOpcode === "JMP" || currentOpcode === "JSR") && hintedBank === currentBank) {
          return { mode: shortMode(currentOpcode), address: absolutePointer(resolvedAddress) };
        }
        return { mode: longMode(currentOpcode), address: resolvedAddress };
      }
      return { mode: shortMode(currentOpcode), address: resolvedAddress };
    };
    if (/^\d+$/.test(operand)) {
      ({ mode, address } = selectDirectJumpMode(
        opcode,
        this.assembler.operandResolver.getnum(operand)
      ));
      debug5("handleJump mode", mode);
    } else if (/^\$[\dA-Fa-f]{1,6}$/.test(operand)) {
      ({ mode, address } = selectDirectJumpMode(
        opcode,
        this.assembler.operandResolver.getnum(operand)
      ));
      debug5("handleJump mode", mode);
    } else if (loweredOperand.mode === "indirectLong") {
      mode = "JMP_INDIRECT_LONG";
      debug5("handleJump mode", mode);
      address = absolutePointer(this.assembler.operandResolver.getnum(baseOperand));
    } else if (opcode === "JSR" && loweredOperand.mode === "indexedIndirectX") {
      address = absolutePointer(this.assembler.operandResolver.getnum(baseOperand));
      mode = "JSR_INDEXED_INDIRECT";
      debug5("handleJump mode", mode);
    } else if (loweredOperand.mode === "indexedIndirectX") {
      address = absolutePointer(this.assembler.operandResolver.getnum(baseOperand));
      mode = "JMP_INDEXED_INDIRECT";
      debug5("handleJump mode", mode);
    } else if (loweredOperand.mode === "directPageIndirect") {
      address = absolutePointer(this.assembler.operandResolver.getnum(baseOperand));
      mode = "JMP_INDIRECT";
      debug5("handleJump mode", mode);
    } else {
      try {
        ({ mode, address } = selectDirectJumpMode(
          opcode,
          this.assembler.operandResolver.getnum(baseOperand)
        ));
        debug5("handleJump mode", mode);
      } catch {
        debug5("handleJump", `Error: Invalid operand format for ${opcode}: ${operand}`);
        throw new Error(`Error: Invalid operand format for ${opcode}: ${operand}`);
      }
    }
    debug5("handleJump address", address?.toString(16));
    if (mode in jumpOpcodes) {
      this.assembler.write1(jumpOpcodes[mode]);
      if (mode === "JSL" || mode === "JML") {
        this.assembler.write3(address);
      } else {
        this.assembler.write2(address);
      }
    } else if (mode in jumpIndirectOpcodes) {
      this.assembler.write1(jumpIndirectOpcodes[mode]);
      this.assembler.write2(address);
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
    debug5("handlePER", operand);
    if (!operand) {
      throw new Error("Error: PER requires an operand.");
    }
    const offset = this.assembler.operandResolver.getnum(operand);
    const address = offset;
    this.assembler.write1(98);
    this.assembler.write2(address);
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
    debug5("handleStoreOperations", { opcode, operand, len, explicitlen });
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
    let address = 0;
    let mode;
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
      address = this.assembler.operandResolver.getnum(operand);
      if (len === 1) {
        this.assembler.write1(address);
      } else if (len === 2) {
        this.assembler.write2(address);
      } else {
        throw new Error(`Forced length ${len} not supported for ${opcode}`);
      }
      return true;
    }
    if (loweredOperand.mode === "directPageIndexedX" && storeModeMap.directX && /^\$[\da-f]{2}$/i.test(operand)) {
      mode = "directX";
      address = this.assembler.operandResolver.getnum(operand);
    } else if (loweredOperand.indexRegister === "y" && !loweredOperand.indirect && storeModeMap.directY) {
      mode = "directY";
      address = this.assembler.operandResolver.getnum(operand);
    } else if (loweredOperand.mode === "absoluteIndexedX" && storeModeMap.absoluteX) {
      mode = "absoluteX";
      address = this.assembler.operandResolver.getnum(operand);
    }
    if (!isIndexed && (loweredOperand.mode === "absolute" || /^\$[\dA-Fa-f]{3,4}$/.test(operand))) {
      mode = "absolute";
      address = this.assembler.operandResolver.getnum(operand);
      this.assembler.write1(storeOpcodes[storeOpcode].absolute);
      this.assembler.write2(address);
      debug5("handleStoreOperations mode", mode);
      return true;
    } else if (!isIndexed && /^\$[\dA-Fa-f]{2}$/.test(operand)) {
      mode = "direct";
      address = this.assembler.operandResolver.getnum(operand);
      this.assembler.write1(storeOpcodes[storeOpcode].direct);
      this.assembler.write1(address);
      debug5("handleStoreOperations mode", mode);
      return true;
    } else if (isIndexed) {
      if (storeOpcode === "STX") {
        address = this.assembler.operandResolver.getnum(operand);
        if (/^\$[\da-f]{3,4}$/i.test(operand)) {
          mode = "absolute";
          this.assembler.write1(storeOpcodes[storeOpcode].absolute);
          this.assembler.write2(address);
        } else {
          mode = "directY";
          this.assembler.write1(storeOpcodes[storeOpcode].directY);
          this.assembler.write1(address);
        }
        debug5("handleStoreOperations mode", mode);
        return true;
      } else if (storeOpcode === "STY") {
        address = this.assembler.operandResolver.getnum(operand);
        if (/^\$[\da-f]{3,4}$/i.test(operand)) {
          mode = "absolute";
          this.assembler.write1(storeOpcodes[storeOpcode].absolute);
          this.assembler.write2(address);
        } else {
          mode = "directX";
          this.assembler.write1(storeOpcodes[storeOpcode].directX);
          this.assembler.write1(address);
        }
        debug5("handleStoreOperations mode", mode);
        return true;
      } else if (storeOpcode === "STZ") {
        address = this.assembler.operandResolver.getnum(operand);
        if (/^\$[\da-f]{3,4}$/i.test(operand) && storeOpcodes[storeOpcode].absoluteX) {
          mode = "absoluteX";
          this.assembler.write1(storeOpcodes[storeOpcode].absoluteX);
          this.assembler.write2(address);
        } else {
          mode = "directX";
          this.assembler.write1(storeOpcodes[storeOpcode].directX);
          this.assembler.write1(address);
        }
        debug5("handleStoreOperations mode", mode);
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
    debug5("handleBlockMove", opcode, operand);
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
    debug5("handleBitTestOperations", { opcode, operand });
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
    let address = 0;
    let outLength = 0;
    if (operand.startsWith("#")) {
      debug5("handleBitTestOperations immediate", {
        opcode,
        operand,
        value: forcedMaps[bitOpcode].immediate?.toString(16)
      });
      address = this.assembler.operandResolver.getnum(operand.slice(1));
      if (explicitlen) {
        const immediate = forcedMaps[bitOpcode].immediate;
        if (immediate === void 0) {
          throw new Error(`Opcode ${opcode} does not support immediate mode.`);
        }
        this.assembler.write1(immediate);
        outLength = len === 1 ? 1 : 2;
      } else {
        const immediate = opcodes[bitOpcode].immediate;
        if (immediate === void 0) {
          throw new Error(`Opcode ${opcode} does not support immediate mode.`);
        }
        this.assembler.write1(immediate);
        outLength = operand.length === 6 ? 2 : 1;
      }
    } else {
      const isIndexed = isIndexedMemory(loweredOperand, "x");
      address = this.assembler.operandResolver.getnum(normalizedOperand);
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
      this.assembler.write1(address);
    } else if (outLength === 2) {
      this.assembler.write2(address);
    }
    return true;
  }
  /**
   * Encodes BRK / COP / PEA / PEI / REP / SEP / WDM. Width is fixed: PEA is
   * always 16-bit; the rest are 8-bit. `.b/.w` on REP/SEP only validates range.
   * `hexconstant` is diagnostic-only (non-hex immediates log "assuming 8-bit").
   *
   * @param {string} opcode Candidate mnemonic.
   * @param {number} num Already-evaluated operand value.
   * @param {number} len Inferred width (REP/SEP range check).
   * @param {boolean} explicitlen Whether a suffix forced the width.
   * @param {boolean} hexconstant True when the operand spelling starts with `$` or `%`.
   * @returns {boolean} True if this family handled the opcode.
   */
  handleGenericOpcode(opcode, num, len, explicitlen, hexconstant) {
    debug5("handleGenericOpcode", { opcode, num, len, explicitlen, hexconstant });
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
      if (!explicitlen && !hexconstant) {
        debug5(`arch65816 handleGenericOpcode: ${opcode} assuming 8-bit mode.`);
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
    debug5("handleBranchInstructions", opcode, operand);
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
    const currentAddress = branchReferenceAddress;
    debug5(
      "handleBranchInstructions targetAddress:",
      targetAddress,
      "/",
      targetAddress.toString(16)
    );
    debug5(
      "handleBranchInstructions currentAddress:",
      currentAddress,
      "/",
      currentAddress.toString(16)
    );
    debug5(
      "handleBranchInstructions relativeAddress:",
      relativeAddress,
      "/",
      relativeAddress.toString(16)
    );
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
    debug5(
      "handleBranchInstructions relativeAddress",
      relativeAddress,
      "/",
      relativeAddress.toString(16)
    );
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
      let signedByte = (relativeAddress & 255) >>> 0;
      if (relativeAddress < 0) {
        signedByte |= 256;
      }
      this.assembler.write1(branchOpcodes2[opcode]);
      this.assembler.write1(signedByte);
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
    debug5("handleMemoryBitInstructions", opcode, operand);
    const loweredOperand = lower65816Operand(this.assembler.operandResolver, operand);
    const memoryBitOpcodes = {
      TSB: { direct: 4, absolute: 12 },
      TRB: { direct: 20, absolute: 28 }
    };
    if (opcode in memoryBitOpcodes) {
      const address = this.assembler.operandResolver.getnum(operand);
      const opcodeByte = loweredOperand.mode === "absolute" || operand.length === 5 ? memoryBitOpcodes[opcode].absolute : memoryBitOpcodes[opcode].direct;
      this.assembler.write1(opcodeByte);
      if (opcodeByte === memoryBitOpcodes[opcode].absolute) {
        this.assembler.write2(address);
      } else {
        this.assembler.write1(address);
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
    debug5("getlenfromchar", c);
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
        debug5("Warning: .d opcode suffix is deprecated.");
        return 4;
      default:
        throw new Error("Error: Invalid opcode length.");
    }
  }
};

// packages/plugin-snes/src/architectures/spc700.ts
var lowerSpc700Operand = (resolver, operand) => {
  const lowered = resolver.lowerOperand(operand);
  return lowered.mode !== "unknown" ? lowered : classifyGenericOperand(lowered);
};
var debug6 = (..._) => {
};
try {
  const { default: d } = await import("debug");
  debug6 = d("ArchSPC700");
} catch {
}
var hasOwn = (obj, key) => Object.hasOwn(obj, key);
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
var IMPLIED_SPC_OPCODES = {
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
var SHIFT_INC_DEC_OPCODES = {
  ASL: true,
  LSR: true,
  ROL: true,
  ROR: true,
  INC: true,
  DEC: true
};
var MOV_ONE_BYTE_PAIRS = /* @__PURE__ */ new Set([
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
function spcOpcodePlusAddressSize(operand) {
  if (getAddressSize(operand) === 1) {
    return 2;
  }
  return 3;
}
function isMovRegisterPair(left, right) {
  const combined = `${left.trim()},${right.trim()}`.toUpperCase().replace(/\s+/g, "");
  return MOV_ONE_BYTE_PAIRS.has(combined);
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
var memOpTables = {
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
var branchOpcodes = {
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
var bitSetClearOpcodes = {
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
function bitBranchOpcodeByte(family, bit) {
  if (family === "BBS") {
    return bit << 5 | 3;
  }
  return bit << 5 | 19;
}
var wordOpsWithYaLeft = {
  CMPW: 90,
  ADDW: 122,
  SUBW: 154,
  MOVW: 186
};
var wordOpsWithYaRight = {
  MOVW: 218
};
var singleWordOps = {
  DECW: 26,
  INCW: 58
};
var NUMBERED_BIT_OPCODE = /^(NOT|OR|AND|EOR|MOV)([0-7])$/;
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
var ArchSPC700 = class {
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
  estimateInstruction(instruction2) {
    const loweredOperands = instruction2.loweredOperands ?? [];
    return this.estimateResolvedInstruction(
      instruction2.mnemonic,
      instruction2.operandText,
      instruction2.loweredOperand,
      loweredOperands
    );
  }
  /**
   * Encodes a lowered instruction.
   * @param {LoweredInstruction} instruction The instruction.
   * @returns {boolean} True if encoded.
   */
  encodeInstruction(instruction2) {
    const loweredOperands = instruction2.loweredOperands ?? [];
    return this.encodeResolvedInstruction(
      instruction2.mnemonic,
      instruction2.operands,
      instruction2.loweredOperand,
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
    const parsedOperands = rawOperand ? this.splitTopLevelComma(rawOperand) : [];
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
      operands = this.splitTopLevelComma(operandText);
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
    if (isMovRegisterPair(left, right)) {
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
    const addressOperand = /\$/.test(left) ? left : right;
    if (/\$/.test(addressOperand)) {
      const plusIndex = addressOperand.search(/\+[xy]$/i);
      let base = addressOperand;
      if (plusIndex >= 0) {
        base = addressOperand.slice(0, plusIndex);
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
      const mode = this.classifySpc700Addressing(right, rightLowered).mode;
      if (mode === "indirectX") {
        return 1;
      }
      if (mode === "abs" || mode === "absX" || mode === "absY") {
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
    debug6("asblock_spc700", words);
    if (words.length === 0) {
      return false;
    }
    const opcode = words[0];
    const rawOperand = words.slice(1).join(" ").trim();
    const parsedOperands = rawOperand ? this.splitTopLevelComma(rawOperand) : [];
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
   * @param {LoweredOperand} [loweredOperand] Combined rest-of-line operand.
   * @param {LoweredOperand[]} [loweredOperands] Per-operand lowered metadata.
   * @returns {boolean} True if encoded.
   */
  encodeResolvedInstruction(mnemonic, operands, loweredOperand, loweredOperands = []) {
    let opcode = mnemonic;
    const operand = loweredOperand?.expanded ?? "";
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
    debug6("asblock_spc700", { opcode, operand, forcedLen, explicitlen });
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
   * Splits on commas outside parentheses. Does not track `[]` - SPC700 bit
   * syntax uses `.n`, not 65816-style `[dp]`.
   * @param {string} text The operand string.
   * @returns {string[]} The array of operands.
   */
  splitTopLevelComma(text) {
    const result = [];
    let level = 0;
    let current = "";
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === "(") {
        level++;
        current += c;
      } else if (c === ")") {
        level--;
        current += c;
      } else if (c === "," && level === 0) {
        result.push(current.trim());
        current = "";
      } else {
        current += c;
      }
    }
    if (current.trim()) {
      result.push(current.trim());
    }
    return result;
  }
  /**
   * Implied single-byte ops (NOP, BRK, RET, flag ops, SLEEP, STOP, XCN).
   * Returns false when the mnemonic is not in this set so other handlers can run.
   *
   * @param {string} opcode Uppercased mnemonic.
   * @returns {boolean} True if a 1-byte opcode was written.
   */
  handleSingleNoOperand(opcode) {
    debug6("handleSingleNoOperand", opcode);
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
    debug6("handleOneOperand", { opcode, operand, forcedLen, explicitlen });
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
    debug6("handleTwoOperands", { opcode, left, right, forcedLen, explicitlen });
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
    debug6("handleWordOpsTwoOperands", { opcode, left, right });
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
    debug6("handleMemoryInstruction", { opcode, left, right });
    const opName = opcode.toUpperCase();
    if (!hasOwn(memOpTables, opName)) {
      debug6("handleMemoryInstruction not in table", { opcode, left, right });
      return false;
    }
    const table = memOpTables[opName];
    if (isAccumulator(left, leftLowered)) {
      debug6("handleMemoryInstruction left is A", { opcode, left, right });
      const modeInfo = this.classifySpc700Addressing(right, rightLowered);
      const addr = modeInfo.val;
      const mode = modeInfo.mode;
      if (explicitlen && forcedLen !== null) {
        if (mode === "dp" || mode === "abs") {
          this.assembler.write1(forcedLen === 1 ? table.a_dp : table.a_abs);
          if (forcedLen === 1) {
            this.assembler.write1(addr & 255);
          } else {
            this.assembler.write2(addr);
          }
          return true;
        }
        if (mode === "dpX" || mode === "absX") {
          this.assembler.write1(forcedLen === 1 ? table.a_dpX : table.a_absX);
          if (forcedLen === 1) {
            this.assembler.write1(addr & 255);
          } else {
            this.assembler.write2(addr);
          }
          return true;
        }
      }
      switch (mode) {
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
    debug6("writeDpOrAbs", { value, length });
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
    debug6("classifySpc700Addressing", operand);
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
    debug6("isDpOrAbs", operand);
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
    debug6("handleShiftIncDec", { opcode, operand, forcedLen, explicitlen });
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
      debug6("handleShiftIncDec operand is A", {
        opcode,
        operand,
        write: table[upper].a.toString(16)
      });
      this.assembler.write1(table[upper].a);
      return true;
    }
    const plusX = operand.toUpperCase().endsWith("+X");
    if (plusX) {
      debug6("handleShiftIncDec operand ends with +X", {
        opcode,
        operand,
        write: table[upper].dpX.toString(16)
      });
      const baseStr = operand.replace(/\+x$/i, "").trim();
      debug6("handleShiftIncDec baseStr", baseStr);
      const val2 = parseInt(baseStr.replace(/\$/g, ""), 16) & 65535;
      debug6("handleShiftIncDec val", val2);
      if (explicitlen) {
        debug6("handleShiftIncDec explicitlen", { opcode, operand, forcedLen, explicitlen });
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
        debug6("handleShiftIncDec val <= 0xff", {
          opcode,
          operand,
          forcedLen,
          explicitlen,
          write: table[upper].dpX.toString(16)
        });
        this.assembler.write1(table[upper].dpX);
        this.assembler.write1(val2 & 255);
      } else {
        debug6("handleShiftIncDec val > 0xff", {
          opcode,
          operand,
          forcedLen,
          explicitlen,
          write: table[upper].abs.toString(16)
        });
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
    debug6("handleBitSetClear", { opcode, operand });
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
      const bit = parseInt(dotted[2], 10);
      let lowNibble = 18;
      if (normalizedOpcode.startsWith("SET")) {
        lowNibble = 2;
      }
      opcodeByte = bit << 5 | lowNibble;
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
    debug6("handleBranch", { opcode, operand });
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
    debug6("handleBranch targetAddr", targetAddr);
    const currentAddr = this.assembler.currentTargetAddress;
    debug6("handleBranch currentAddr", currentAddr);
    const offset = targetAddr - (currentAddr + 1);
    debug6("handleBranch offset", offset);
    if (!this.assembler.enforceResolvedLabels) {
      this.assembler.write1(255);
    } else {
      const unsignedOffset = offset < 0 ? 256 + offset : offset;
      debug6("handleBranch unsignedOffset", unsignedOffset);
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
    debug6("handleTwoOperandsBitBranch", { opcode, left, right });
    const parsed = parseBitBranchOpcode(opcode);
    if (!parsed) {
      debug6("handleTwoOperandsBitBranch no match", { opcode, left, right });
      return false;
    }
    const trimmed = left.trim();
    const dotted = trimmed.match(/^\$([\da-f]+)\.([0-7])$/i);
    let dpVal;
    let bit = parsed.mnemonicBit;
    if (dotted) {
      dpVal = Number.parseInt(dotted[1], 16) & 255;
      bit = Number(dotted[2]);
    } else {
      dpVal = Number.parseInt(trimmed.replace(/\$/g, ""), 16) & 255;
    }
    if (bit === void 0) {
      return false;
    }
    const opcodeByte = bitBranchOpcodeByte(parsed.family, bit);
    debug6("handleTwoOperandsBitBranch =", opcodeByte.toString(16));
    this.assembler.write1(opcodeByte);
    debug6("handleTwoOperandsBitBranch =", dpVal.toString(16));
    this.assembler.write1(dpVal);
    debug6("handleTwoOperandsBitBranch right", right);
    if (!this.assembler.enforceResolvedLabels) {
      this.assembler.write1(255);
    } else {
      let offset = 255;
      const target = this.assembler.operandResolver.getnum(right);
      const pc = this.assembler.currentTargetAddress;
      const relativeOffset = target - (pc + 1);
      offset = relativeOffset < 0 ? 256 + relativeOffset : relativeOffset;
      offset &= 255;
      debug6("handleTwoOperandsBitBranch =", offset.toString(16));
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
    debug6("handleDbnzCbne", { opcode, left, right });
    const isYForm = opcode.toUpperCase() === "DBNZ" && isRegisterY(left, leftLowered);
    let instructionSize = 3;
    if (isYForm) {
      instructionSize = 2;
    }
    const target = this.assembler.operandResolver.getnum(right);
    const offset = target - (this.assembler.currentTargetAddress + instructionSize);
    debug6("handleDbnzCbne offset", offset);
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
    debug6("handlePushPop", { opcode, operand });
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
    debug6("handleCallJump", { opcode, operand });
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
      debug6("handleCallJump JMP trimmed", trimmed);
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
    debug6("handleCmpXyOrMovXy", { opcode, operand, forcedLen, explicitlen });
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
    debug6("handleTsetTclr", { opcode, left, right });
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
    debug6("handleMovInstruction", { left, right, forcedLen, explicitlen });
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
      const mode = memoryMoves[key];
      const inferredLength = getAddressSize(`$${match[1]}`);
      const selectedLength = explicitlen ? forcedLen : inferredLength;
      const opcode = selectedLength === 1 ? mode.byte : mode.word;
      this.assembler.write1(opcode);
      if (opcode === mode.word) {
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
      const mode = movAbsByDest[rightUp];
      this.assembler.write1(length === 1 ? mode.byte : mode.word);
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
      const mode = movAbsBySrc[leftUp];
      this.assembler.write1(length === 1 ? mode.byte : mode.word);
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
    debug6("handleMovMemoryCombo", { left, right });
    const combined = `${left.trim()},${right.trim()}`.toUpperCase();
    debug6("handleMovMemoryCombo combined", combined);
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
    debug6("handleMovMemoryCombo2", { left, right });
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
    debug6("handleBitManipulation", { opcode, left, right, explicitBitText });
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
    let bit = parsed.mnemonicBit;
    if (mem.bit !== void 0) {
      bit = mem.bit;
    }
    if (bitFromOperand !== void 0) {
      bit = bitFromOperand;
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
    const hex = mem.addressText.match(/^\$([\da-f]+)$/i);
    let addr;
    if (hex) {
      addr = Number.parseInt(hex[1], 16) & 65535;
    } else {
      addr = this.assembler.operandResolver.getnum(mem.addressText) & 65535;
    }
    this.assembler.write1(opcodeByte);
    this.assembler.write1(addr & 255);
    this.assembler.write1(addr >> 8 & 255 | (bit & 7) << 5);
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
    debug6("handleSingleOperandSpecial", { opcode, operand });
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
    debug6("handleWordOps", { opcode, operand });
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
    debug6("getlenfromchar", c);
    switch (c.toLowerCase()) {
      case "b":
        return 1;
      case "w":
        return 2;
      case "l":
        return 3;
      case "d":
        debug6("Warning: .d opcode suffix is deprecated.");
        return 4;
      default:
        throw new Error("Error: Invalid opcode length.");
    }
  }
};

// packages/plugin-snes/src/asar/compatibility.ts
var ASAR_COMPAT_NO_OP_DIRECTIVES = [
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
var assertMapperAvailable = (inSpcblock) => {
  if (inSpcblock) {
    throw new Error("Mapper directives are unavailable inside spcblock.");
  }
};
var applyMapperSelection = (state, mapper) => {
  state.mapper = mapper;
  if (mapper === "norom") {
    state.checksumEnabled = false;
  }
};
var isFreespaceAvailable = (mapper) => mapper !== "norom";
var encodeSuperFxMoveShortAddress = (addrVal, mode = "hardware") => {
  if (mode === "asar") {
    return addrVal & 255;
  }
  return addrVal >> 1 & 255;
};
var getChecksumHeaderOffset = (mapper) => {
  if (mapper === "lorom" || mapper === "sa1rom" || mapper === "bigsa1rom") {
    return 32704;
  }
  return 65472;
};
var calculateHeaderChecksum = (romdata, mode) => {
  const romLength = romdata.length;
  if (romLength === 0) {
    return 0;
  }
  let checksum = 0;
  if (mode === "simple" || (romLength & romLength - 1) === 0) {
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
var shouldRedirectOrgToSpcblock = (spcInlineCompatMode) => spcInlineCompatMode;
var shouldEnableSpcInlineCompat = (architecture) => architecture === "spc700-inline";
var shouldUseNoromAddressing = (architecture) => architecture === "spc700-raw";
var shouldAutoCloseSpcblock = (spcInlineCompatMode, inSpcblock) => spcInlineCompatMode && inSpcblock;
var shouldEndifCloseInnermostWhile = (currentLoopType, currentLoopStartLine, currentIfStartLine) => currentLoopType === "while" && (currentIfStartLine === void 0 || (currentLoopStartLine ?? -1) >= currentIfStartLine);

// packages/plugin-snes/src/architectures/superfx.ts
var lowerSuperFxOperand = (resolver, operand) => {
  const lowered = resolver.lowerOperand(operand);
  return lowered.mode !== "unknown" ? lowered : classifyGenericOperand(lowered);
};
var debug7 = (..._) => {
};
try {
  const { default: d } = await import("debug");
  debug7 = d("ArchSuperFX");
} catch {
}
var hasOwn2 = (obj, key) => Object.hasOwn(obj, key);
var ALT1 = 61;
var ALT2 = 62;
var ALT3 = 63;
var IMPLIED_OPCODES = {
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
var PREFIXED_OPCODES = {
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
var SHORT_BRANCH_OPCODES = {
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
var REGISTER_OPS = {
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
var IMMEDIATE_OPS = {
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
var INDIRECT_OPS = {
  STW: { base: 48, min: 0, max: 11 },
  LDW: { base: 64, min: 0, max: 11 },
  STB: { prefix: ALT1, base: 48, min: 0, max: 11 },
  LDB: { prefix: ALT1, base: 64, min: 0, max: 11 }
};
var encodedOpSize = (encoding) => {
  if (encoding.prefix === void 0) {
    return 1;
  }
  return 2;
};
var fitsSignedByte = (value) => {
  const imm = value & 65535;
  return imm < 128 || imm >= 65408;
};
var isShortRamAddress = (addrVal) => (addrVal & 1) === 0 && addrVal < 512;
var ArchSuperFX = class {
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
  estimateInstruction(instruction2) {
    const loweredOperands = instruction2.loweredOperands ?? [];
    return this.estimateResolvedInstruction(
      instruction2.mnemonic,
      instruction2.operands,
      instruction2.loweredOperand,
      loweredOperands
    );
  }
  /**
   * Encodes a lowered instruction.
   * @param {LoweredInstruction} instruction The instruction.
   * @returns {boolean} True if the instruction was encoded.
   */
  encodeInstruction(instruction2) {
    const loweredOperands = instruction2.loweredOperands ?? [];
    return this.encodeResolvedInstruction(
      instruction2.mnemonic,
      instruction2.operands,
      instruction2.loweredOperand,
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
    debug7("asblock_superfx", words);
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
    debug7("asblock_superfx opcode", opcode);
    debug7("asblock_superfx operand", operand);
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
    debug7("handleSingleWordOpcode", opcode);
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
    debug7("handleOneOperandOpcode", opcode, operand, operandLength);
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
    debug7("handleTwoOperandOpcode", { opcode, leftOp, rightOp });
    const reg1r = this.resolveRegister(leftOp, leftLowered, "r");
    const reg1parr = this.resolveRegister(leftOp, leftLowered, "parr");
    const reg2r = this.resolveRegister(rightOp, rightLowered, "r");
    const reg2parr = this.resolveRegister(rightOp, rightLowered, "parr");
    debug7("handleTwoOperandOpcode", { reg1r, reg1parr, reg2r, reg2parr });
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
        debug7("Invalid register number", str, regnum);
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
    debug7("checkShortAddr", num);
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
  writeRegisterOp(encoding, register) {
    if (encoding.min !== void 0 && encoding.max !== void 0) {
      this.rangeCheck(encoding.min, register, encoding.max);
    }
    if (encoding.prefix !== void 0) {
      this.assembler.write1(encoding.prefix);
    }
    this.assembler.write1(encoding.base + register);
  }
  /**
   * Encodes the short-RAM operand byte for **auto-MOVE** only (`MOVE Rn,(addr)` /
   * `MOVE (addr),Rn`). Explicit LMS/SMS call `addr >> 1` directly and skip this.
   * @param {number} addrVal Even RAM byte address below `$200`.
   * @returns {number} Hardware word index, or Asar's raw byte when compat is enabled.
   */
  moveShortAddressByte(addrVal) {
    let mode = "hardware";
    if (this.asarMoveShortAddress()) {
      mode = "asar";
    }
    return encodeSuperFxMoveShortAddress(addrVal, mode);
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
    let address = 0;
    try {
      address = session.symbolScope.getLabelValue(label, false) & 16777215;
    } catch {
      address = 0;
    }
    session.write3(address);
  }
  for (const value of [83, 84, 79, 80, 0]) {
    session.write1(value);
  }
}

// packages/plugin-snes/src/directives/layout.ts
var MAPPER_KEYWORDS = [
  "lorom",
  "hirom",
  "exlorom",
  "exhirom",
  "sfxrom",
  "norom",
  "fullsa1rom",
  "sa1rom"
];
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
  const mode = words[2].toLowerCase();
  if (mode === "off") state.bankCrossMode = "off";
  else if (mode === "half") state.bankCrossMode = "half";
  else if (mode === "full" || mode === "on") state.bankCrossMode = "full";
  else throw new Error(`Invalid parameter for check bankcross: ${words[2]}`);
}
function handleOptimize(state, words) {
  if (words.length < 3 || words[1].toLowerCase() !== "dp") return;
  const mode = words[2].toLowerCase();
  if (mode === "none") state.optimizeDirectPage = false;
  else if (mode === "ram" || mode === "always") state.optimizeDirectPage = true;
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

// packages/plugin-snes/src/services/spc-runtime.ts
var SnesSpcRuntimeService = class {
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
    if (type !== "nspc") throw new Error("Custom spcblock mode is not implemented.");
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

// packages/plugin-snes/src/directives/spc.ts
var createSpcRuntime = (session, state) => new SnesSpcRuntimeService(session, state);

// packages/plugin-snes/src/session-state.ts
var SNES_SESSION_STATE_ID = "snes.session-state";
var snesSessionStateKey = {
  id: SNES_SESSION_STATE_ID
};
function cloneSnesSessionState(value) {
  return {
    ...value,
    sa1Banks: [...value.sa1Banks],
    spcBlock: value.spcBlock ? { ...value.spcBlock } : null,
    cpuStack: [...value.cpuStack]
  };
}

// packages/plugin-snes/src/target/address-space.ts
var snesRomAddressSpace = {
  name: "snes-rom",
  addressWidth: 24,
  defaultOrigin: 32768,
  unmappedWriteBehavior: "allow",
  normalizeForWrite(address) {
    return address | 0;
  },
  advance(address, amount, context) {
    const prefix = address & 4278190080;
    const logicalAddress = address & 16777215;
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
  toOutputOffset(address, context) {
    if (address < 0 || address > 16777215) return -1;
    if (context.mapper === "lorom") {
      if ((address & 16646144) === 8257536 || (address & 4227072) === 0 || (address & 7372800) === 7340032) {
        return -1;
      }
      return (address & 8323072) >> 1 | address & 32767;
    }
    if (context.mapper === "hirom") {
      if ((address & 16646144) === 8257536 || (address & 4227072) === 0) {
        return -1;
      }
      return address & 4194303;
    }
    if (context.mapper === "exlorom") {
      if ((address & 15728640) === 7340032 || (address & 4227072) === 0) {
        return -1;
      }
      const mapped = (address & 8323072) >> 1 | address & 32767;
      return address & 8388608 ? mapped : mapped + 4194304;
    }
    if (context.mapper === "exhirom") {
      if ((address & 16646144) === 8257536 || (address & 4227072) === 0) {
        return -1;
      }
      return (address & 8388608) === 0 ? address & 4194303 | 4194304 : address & 4194303;
    }
    if (context.mapper === "sfxrom") {
      if ((address & 6291456) === 6291456 || (address & 4227072) === 0 || (address & 8388608) === 8388608) {
        return -1;
      }
      return address & 4194304 ? address & 4194303 : (address & 8323072) >> 1 | address & 32767;
    }
    if (context.mapper === "sa1rom") {
      if ((address & 4227072) === 32768) {
        return context.sa1banks[(address & 14680064) >> 21] | (address & 2031616) >> 1 | address & 32767;
      }
      if ((address & 12582912) === 12582912) {
        return context.sa1banks[(address & 1048576) >> 20 | (address & 2097152) >> 19] | address & 1048575;
      }
      return -1;
    }
    if (context.mapper === "bigsa1rom") {
      if ((address & 12582912) === 12582912) {
        return address & 4194303 | 4194304;
      }
      if ((address & 12582912) === 0 || (address & 12582912) === 8388608) {
        if ((address & 32768) === 0) return -1;
        return (address & 8388608) >> 2 | (address & 4128768) >> 1 | address & 32767;
      }
      return -1;
    }
    return context.mapper === "norom" ? address : -1;
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
    let address = offset;
    if (context.mapper === "lorom") {
      if (address >= 4194304) return -1;
      address = address << 1 & 8323072 | address & 32767 | 32768;
      return address | 8388608;
    }
    if (context.mapper === "hirom") {
      return address >= 4194304 ? -1 : address | 12582912;
    }
    if (context.mapper === "exlorom") {
      if (address >= 8388608) return -1;
      if (address & 4194304) {
        address -= 4194304;
        return address << 1 & 8323072 | address & 32767 | 32768;
      }
      address = address << 1 & 8323072 | address & 32767 | 32768;
      return address | 8388608;
    }
    if (context.mapper === "exhirom") {
      if (address >= 8388608) return -1;
      return address & 4194304 ? address : address | 12582912;
    }
    if (context.mapper === "sa1rom") {
      if (address >= 8388608) return -1;
      for (let index = 0; index < 8; index++) {
        if (context.sa1banks[index] === (address & 7340032)) {
          return 32768 | index << 21 | (address & 1015808) << 1 | address & 32767;
        }
      }
      return -1;
    }
    if (context.mapper === "bigsa1rom") {
      if (address >= 8388608) return -1;
      if ((address & 4194304) === 4194304) return address | 12582912;
      if ((address & 6291456) === 0) {
        return address << 1 & 4128768 | 32768 | address & 32767;
      }
      if ((address & 6291456) === 2097152) {
        return 8388608 | address << 1 & 4128768 | 32768 | address & 32767;
      }
      return -1;
    }
    if (context.mapper === "sfxrom") {
      return address >= 2097152 ? -1 : address << 1 & 8323072 | address & 32767 | 32768;
    }
    return context.mapper === "norom" ? address : -1;
  }
};

// packages/plugin-snes/src/tooling/directive-catalog.ts
var op = (keyword, summary, syntax, operands) => ({
  keyword,
  summary,
  syntax,
  ...operands ? { operands } : {}
});
var directiveCatalog2 = [
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
var directiveByKeyword = new Map(
  directiveCatalog2.map((descriptor2) => [descriptor2.keyword.toLowerCase(), descriptor2])
);

// packages/plugin-snes/src/index.ts
var SNES_TARGET_ID = "snes.sfc";
var splitSingleOperand = (text) => text ? [text] : [];
var splitCommaOperands = (text) => text ? text.split(",").map((operand) => operand.trim()) : [];
var splitTopLevelCommaOperands = (text) => {
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
var toolingFor = (keywords) => {
  const wanted = new Set(keywords);
  return directiveCatalog2.filter((descriptor2) => wanted.has(descriptor2.keyword));
};
var directive = (id, keywords, handler) => ({
  id,
  keywords,
  phase: "lowered",
  createHandler: handler,
  tooling: toolingFor(keywords)
});
var numericArgument = (functionName, args, index) => {
  const value = args[index];
  if (typeof value !== "number") {
    throw new Error(`${functionName}() argument ${index + 1} must be numeric.`);
  }
  return value;
};
var addressExpressions = {
  id: "snes.address-functions",
  functions: [
    {
      name: "snestopc",
      signature: { parameters: ["address"] },
      summary: "Convert a SNES address to an output offset.",
      evaluate: ({ addresses }, args) => addresses.toOutputOffset(numericArgument("snestopc", args, 0))
    },
    {
      name: "pctosnes",
      signature: { parameters: ["offset"] },
      summary: "Convert an output offset to a SNES address.",
      evaluate: ({ addresses }, args) => addresses.fromOutputOffset(numericArgument("pctosnes", args, 0))
    }
  ]
};
var readExpressions = {
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
var targetOptions = (configured) => {
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
var createInitialState = (context) => {
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
var plugin = definePlugin({
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
      instructions: superFxCatalog
    });
    context.registerAddressSpace({
      id: "snes.address-space",
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
          normalizeForWrite: (address) => snesRomAddressSpace.normalizeForWrite(address, mappingContext()),
          advance: (address, amount) => snesRomAddressSpace.advance(address, amount, mappingContext()),
          toOutputOffset: (address) => snesRomAddressSpace.toOutputOffset(address, mappingContext()),
          fromOutputOffset: (offset) => snesRomAddressSpace.fromOutputOffset(offset, mappingContext()),
          validateWrite: (address, width) => {
            const targetState = state.get(snesSessionStateKey);
            const normalized = snesRomAddressSpace.normalizeForWrite(address, mappingContext());
            if (snesRomAddressSpace.toOutputOffset(normalized, mappingContext()) < 0) return;
            if (targetState.bankCrossMode === "off" || width <= 1) return;
            const start = address & 16777215;
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
      addressSpace: "snes.address-space",
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
var src_default = plugin;

// packages/cli/src/index.ts
var usage = `Usage: uttori-asm <input> [output] [options]

Options:
  --config <uttori-asm.config.json>
  --plugin <module>              Repeatable; appended after configured plugins
  --target <target-id>
  --architecture <architecture-id>
  --base-image <path>
  --include-path <path>          Repeatable
  --plugin-option <plugin:key=value>
  --verbose
  --help`;
var parseOptionValue = (value) => {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};
var splitOption = (argument) => {
  const equals = argument.indexOf("=");
  return equals < 0 ? { flag: argument } : { flag: argument.slice(0, equals), inlineValue: argument.slice(equals + 1) };
};
var parseCliArguments = (argv) => {
  const positional = [];
  const plugins = [];
  const includePaths = [];
  const pluginOptions = {};
  let configFile;
  let target;
  let architecture;
  let baseImage;
  let verbose = false;
  let help = false;
  const requireValue = (flag, inlineValue, index) => {
    const value = inlineValue ?? argv[index + 1];
    if (value === void 0 || value === "" || inlineValue === void 0 && value.startsWith("--")) {
      throw new Error(`${flag} requires a value.`);
    }
    return [value, inlineValue === void 0 ? index + 1 : index];
  };
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    if (!argument.startsWith("--")) {
      positional.push(argument);
      continue;
    }
    const { flag, inlineValue } = splitOption(argument);
    if (flag === "--help") {
      help = true;
      continue;
    }
    if (flag === "--verbose") {
      verbose = true;
      continue;
    }
    const [value, consumedIndex] = requireValue(flag, inlineValue, index);
    index = consumedIndex;
    switch (flag) {
      case "--config":
        configFile = value;
        break;
      case "--plugin":
        plugins.push(value);
        break;
      case "--target":
        target = value;
        break;
      case "--architecture":
        architecture = value;
        break;
      case "--base-image":
        baseImage = value;
        break;
      case "--include-path":
        includePaths.push(value);
        break;
      case "--plugin-option": {
        const colon = value.indexOf(":");
        const equals = value.indexOf("=", colon + 1);
        if (colon <= 0 || equals <= colon + 1) {
          throw new Error("--plugin-option must use <plugin:key=value> syntax.");
        }
        const plugin2 = value.slice(0, colon);
        const key = value.slice(colon + 1, equals);
        pluginOptions[plugin2] = {
          ...pluginOptions[plugin2] ?? {},
          [key]: parseOptionValue(value.slice(equals + 1))
        };
        break;
      }
      default:
        throw new Error(`Unknown option '${flag}'.`);
    }
  }
  if (positional.length > 2) {
    throw new Error(`Unexpected positional argument '${positional[2]}'.`);
  }
  return {
    input: positional[0],
    output: positional[1],
    configFile,
    plugins: Object.freeze(plugins),
    target,
    architecture,
    baseImage,
    includePaths: Object.freeze(includePaths),
    pluginOptions: Object.freeze(pluginOptions),
    verbose,
    help
  };
};
var defaultOutputPath = (inputFile, extension) => {
  const parsed = path4.parse(inputFile);
  return path4.join(parsed.dir, `${parsed.name}${extension}`);
};
var formatFailure = (error) => {
  if (error instanceof PluginError) {
    const context = [
      error.pluginId ? `plugin=${error.pluginId}` : void 0,
      error.pluginModule ? `module=${error.pluginModule}` : void 0,
      error.targetId ? `target=${error.targetId}` : void 0
    ].filter(Boolean);
    return `${error.code}: ${error.message}${context.length > 0 ? ` (${context.join(", ")})` : ""}`;
  }
  return error instanceof Error ? error.message : JSON.stringify(error) ?? "Unknown error";
};
var runCli = async (argv = process.argv.slice(2)) => {
  let parsed;
  try {
    parsed = parseCliArguments(argv);
  } catch (error) {
    console.error(`Error: ${formatFailure(error)}

${usage}`);
    return 1;
  }
  if (parsed.help) {
    console.log(usage);
    return 0;
  }
  if (!parsed.input) {
    console.error(usage);
    return 1;
  }
  const cwd = process.cwd();
  const inputFile = path4.resolve(cwd, parsed.input);
  if (!fs4.existsSync(inputFile)) {
    console.error(`Error: Input file '${inputFile}' not found.`);
    return 1;
  }
  const explicitConfig = parsed.configFile ? path4.resolve(cwd, parsed.configFile) : path4.resolve(cwd, PROJECT_CONFIG_FILENAME);
  const hasProjectConfiguration = fs4.existsSync(explicitConfig);
  const pluginModules = parsed.plugins.map((module) => ({ module }));
  const overrides = {
    ...parsed.target === void 0 ? {} : { target: parsed.target },
    ...parsed.architecture === void 0 ? {} : { architecture: parsed.architecture },
    ...parsed.includePaths.length === 0 ? {} : { includePaths: parsed.includePaths },
    ...Object.keys(parsed.pluginOptions).length === 0 ? {} : { pluginOptions: parsed.pluginOptions }
  };
  const useSnesHostDefault = !hasProjectConfiguration && pluginModules.length === 0;
  const bundledPlugins = /* @__PURE__ */ new Map([
    ["@uttori/asm-plugin-snes", src_default]
  ]);
  let loaded;
  let assembler;
  try {
    loaded = await loadProjectEnvironment({
      cwd,
      ...parsed.configFile === void 0 ? {} : { configFile: parsed.configFile },
      pluginModules,
      bundledPlugins,
      overrides,
      ...useSnesHostDefault ? {
        defaults: {
          plugins: [{ module: "@uttori/asm-plugin-snes" }],
          target: SNES_TARGET_ID,
          includePaths: ["./"]
        }
      } : {}
    });
    const baseImage = parsed.baseImage ? new Uint8Array(fs4.readFileSync(path4.resolve(cwd, parsed.baseImage))) : void 0;
    assembler = new Assembler({
      environment: loaded.environment,
      target: loaded.target,
      architecture: loaded.architecture,
      targetOptions: loaded.targetOptions,
      baseImage,
      collectSourceMetadata: false
    });
    assembler.setIncludePaths([.../* @__PURE__ */ new Set([path4.dirname(inputFile), ...loaded.includePaths])]);
    assembler.setCurrentFile(inputFile);
    if (parsed.verbose) {
      console.log(
        `Plugins: ${loaded.configuration.plugins.map((plugin2) => plugin2.pluginId).join(", ")}`
      );
      console.log(`Target: ${loaded.target}`);
      console.log(`Architecture: ${loaded.architecture}`);
    }
    const source = fs4.readFileSync(inputFile, "utf8");
    assembler.assembleProgram(assembler.buildProgramModel(source, inputFile, 0));
    const extension = loaded.environment.getTarget(loaded.target).defaultOutputExtension;
    const outputFile = parsed.output ? path4.resolve(cwd, parsed.output) : defaultOutputPath(inputFile, extension);
    fs4.writeFileSync(outputFile, Buffer.from(assembler.getBinaryOutput()));
    console.log(`Success: Output written to '${outputFile}'.`);
    return 0;
  } catch (error) {
    console.error(`Compilation failed: ${formatFailure(error)}`);
    return 1;
  } finally {
    assembler?.dispose();
    await loaded?.dispose();
  }
};
var entryPoint = process.argv[1] ? pathToFileURL2(path4.resolve(process.argv[1])).href : void 0;
if (entryPoint === import.meta.url) {
  process.exitCode = await runCli();
}
export {
  parseCliArguments,
  runCli,
  usage
};

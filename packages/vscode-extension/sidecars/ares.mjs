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
        return parse2(val);
      } else if (type === "number" && isFinite(val)) {
        return options.long ? fmtLong(val) : fmtShort(val);
      }
      throw new Error(
        "val is not a non-empty string or a valid number. val=" + JSON.stringify(val)
      );
    };
    function parse2(str) {
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
        function debug3(...args) {
          if (!debug3.enabled) {
            return;
          }
          const self = debug3;
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
        debug3.namespace = namespace;
        debug3.useColors = createDebug.useColors();
        debug3.color = createDebug.selectColor(namespace);
        debug3.extend = extend;
        debug3.destroy = createDebug.destroy;
        Object.defineProperty(debug3, "enabled", {
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
          createDebug.init(debug3);
        }
        return debug3;
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
    function init(debug3) {
      debug3.inspectOpts = {};
      const keys = Object.keys(exports.inspectOpts);
      for (let i = 0; i < keys.length; i++) {
        debug3.inspectOpts[keys[i]] = exports.inspectOpts[keys[i]];
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

// packages/debug-sidecar-ares/src/sidecar.ts
import { createHash as createHash3 } from "node:crypto";
import { readFile as readFile3 } from "node:fs/promises";
import path4 from "node:path";

// packages/debug-adapter/src/contracts.ts
var DEBUG_BACKEND_PROTOCOL_VERSION = 1;

// node_modules/@uttori/data-tools/dist/data-hash-crc32.js
var CRC32_POLYNOMIAL = 3988292384;
var CRC32C_POLYNOMIAL = 2197175160;
var reflectedTable = (polynomial) => Array.from({ length: 256 }, (_, index) => {
  let crc = index;
  for (let bit = 0; bit < 8; bit++) {
    crc = crc & 1 ? polynomial ^ crc >>> 1 : crc >>> 1;
  }
  return crc >>> 0;
});
var sliceTable = (table) => {
  const slices = [Uint32Array.from(table)];
  for (let width = 1; width < 8; width++) {
    const previous = slices[width - 1];
    slices.push(Uint32Array.from(previous, (crc) => crc >>> 8 ^ table[crc & 255]));
  }
  return [slices[0], slices[1], slices[2], slices[3], slices[4], slices[5], slices[6], slices[7]];
};
var CRC32_TABLE = /* @__PURE__ */ reflectedTable(CRC32_POLYNOMIAL);
var CRC32C_TABLE = /* @__PURE__ */ reflectedTable(CRC32C_POLYNOMIAL);
var crc32Slices = /* @__PURE__ */ sliceTable(CRC32_TABLE);
var crc32cSlices = /* @__PURE__ */ sliceTable(CRC32C_TABLE);
var [i0, i1, i2, i3, i4, i5, i6, i7] = crc32Slices;
var [c0, c1, c2, c3, c4, c5, c6, c7] = crc32cSlices;
var computeBytes = (bytes) => {
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

// packages/capture/src/capture-v2.ts
var maxU64 = (1n << 64n) - 1n;
var captureScope = (value) => {
  if (value !== "nes.cpu-bus-ppu" && value !== "nes.2a03.instructions" && value !== "snes.65816.instructions" && value !== "snes.cpu-bus" && value !== "snes.cpu-bus-transfers" && value !== "snes.cpu-bus-ppu") {
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
function isFieldRecord(value) {
  return typeof value === "object" && value !== null;
}
var bounded = (text, max) => typeof text === "string" && text.length > 0 && !text.includes("\0") && new TextEncoder().encode(text).length <= max;
function validateCaptureRequest(value) {
  if (!isFieldRecord(value)) {
    throw new Error("Invalid capture request.");
  }
  if (value.operation === "context") {
    let fields2 = ["operation", "action"];
    const action = value.action;
    if (action === "prepare" || action === "replay" || action === "restore") {
      fields2.push("directory", "romContentSha256", "romFileSha256", "producer");
      validateCaptureRequest({
        operation: "file-start",
        file: value.directory,
        romFileSha256: value.romFileSha256,
        romContentSha256: value.romContentSha256,
        producer: value.producer,
        bufferBytes: 8388608
      });
    } else if (action === "start" || action === "stop" || action === "mark") {
      fields2.push("session");
      captureSession(value.session);
      if (action === "mark") {
        fields2.push("label");
        if (typeof value.label !== "string" || !value.label.trim() || value.label.includes("\0") || new TextEncoder().encode(value.label).length > 256) {
          throw new Error("Capture milestone labels must contain 1\u2013256 UTF-8 bytes.");
        }
      }
    } else if (action !== "abort" && action !== "status") {
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
        "romFileSha256",
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
    const producer = value.producer;
    if (!bounded(value.file, 4096) || typeof value.file !== "string" || !/^(?:\/|[a-z]:[/\\]|\\\\)/i.test(value.file) || typeof value.romContentSha256 !== "string" || !/^[\da-f]{64}$/.test(value.romContentSha256) || value.romFileSha256 !== void 0 && (typeof value.romFileSha256 !== "string" || !/^[\da-f]{64}$/.test(value.romFileSha256)) || !isFieldRecord(producer) || !bounded(producer.id, 256) || !bounded(producer.revision, 1024) || Object.keys(producer).some((key) => !["id", "revision"].includes(key))) {
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
    const bufferBytes = value.bufferBytes;
    if (typeof bufferBytes !== "number" || !Number.isSafeInteger(bufferBytes) || bufferBytes < 4718656 || bufferBytes > 64 * 1024 * 1024) {
      throw new Error("Capture buffer must be between 4718656 bytes and 64 MiB.");
    }
    return;
  }
  captureSession(value.session);
  if (value.operation === "status" || value.operation === "stop" || value.operation === "abort" || value.operation === "release" || value.operation === "file-status" || value.operation === "file-stop" || value.operation === "file-abort" || value.operation === "file-release") {
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
}
var validateCaptureCapabilities = (value, scope = "snes.65816.instructions") => {
  captureScope(scope);
  let reserve = scope === "nes.2a03.instructions" ? 91 : 71;
  if (scope === "nes.cpu-bus-ppu") {
    reserve = 128;
  }
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
  if (!isFieldRecord(value) || Object.entries(expected).some(([key, item]) => value[key] !== item)) {
    throw new Error("Unsupported capture scope, reserve, or ownership contract.");
  }
  if (value.nativeFile === true) {
    return { ...expected, nativeFile: true };
  }
  return expected;
};
function assertCapturePosition(value, session, scope) {
  if (!isFieldRecord(value)) {
    throw new Error("Invalid capture position.");
  }
  captureSession(value.session);
  if (session !== void 0 && value.session !== session) {
    throw new Error("Capture session changed.");
  }
  const positionScope = captureScope(value.scope);
  if (scope !== void 0 && positionScope !== captureScope(scope)) {
    throw new Error("Capture scope changed or was not confirmed by the producer.");
  }
  const state = value.state;
  if (state !== "armed" && state !== "recording" && state !== "throttled" && state !== "stopping" && state !== "draining" && state !== "complete" && state !== "incomplete") {
    throw new Error("Invalid capture state.");
  }
  const bounds = [
    value.releasedThrough,
    value.durableThrough,
    value.acceptedThrough,
    value.deliveredThrough,
    value.producedThrough
  ].map(captureU64);
  if (bounds.some((bound, index) => index > 0 && bound < bounds[index - 1])) {
    throw new Error("Capture ownership boundaries are inconsistent.");
  }
  if (captureU64(value.chunkThrough) > captureU64(value.producedChunks)) {
    throw new Error("Capture chunk boundary is inconsistent.");
  }
  captureU64(value.throttleCount);
  if (!captureU64(value.clockNumerator) || !captureU64(value.clockDenominator)) {
    throw new Error("Invalid capture clock domain.");
  }
  if (value.droppedInScope !== "0" || typeof value.error !== "string" || value.error.length > 256) {
    throw new Error("Capture integrity failed.");
  }
  const bufferedBytes = value.bufferedBytes;
  const allocatedBytes = value.allocatedBytes;
  if (typeof bufferedBytes !== "number" || typeof allocatedBytes !== "number" || !Number.isSafeInteger(bufferedBytes) || !Number.isSafeInteger(allocatedBytes) || bufferedBytes < 0 || allocatedBytes < 0 || bufferedBytes > 64 * 1024 * 1024 || allocatedBytes > 64 * 1024 * 1024 || bufferedBytes > allocatedBytes) {
    throw new Error("Capture allocation exceeds its bounds.");
  }
  if (state === "complete" && (value.error || bufferedBytes || new Set(bounds.map(String)).size !== 1 || value.chunkThrough !== value.producedChunks)) {
    throw new Error("Capture terminal totals do not reconcile.");
  }
}
var validateCapturePosition = (value, session, scope) => {
  assertCapturePosition(value, session, scope);
  return value;
};

// packages/capture/src/capture-context.ts
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
var isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
var digestFile = async (file, signal) => {
  const hash = createHash("sha256");
  for await (const bytes of createReadStream(file, { signal })) {
    if (!Buffer.isBuffer(bytes)) {
      throw new Error(`Expected binary capture context data in ${path.basename(file)}.`);
    }
    hash.update(bytes);
  }
  return hash.digest("hex");
};
var verifyCaptureContext = async (directory, identity, signal) => {
  signal?.throwIfAborted();
  const metadataFile = path.join(directory, "manifest.json");
  const metadataStat = await lstat(metadataFile);
  if (!metadataStat.isFile() || metadataStat.isSymbolicLink() || metadataStat.size > 1048576) {
    throw new Error("Invalid capture context manifest.");
  }
  const manifest = JSON.parse(await readFile(metadataFile, "utf8"));
  if (!isRecord(manifest)) {
    throw new Error("Invalid capture context manifest.");
  }
  const producer = isRecord(manifest.producer) ? manifest.producer : void 0;
  if (manifest.format !== "uttori-capture-context" || manifest.version !== 1 || manifest.romContentSha256 !== identity.romContentSha256 || !isRecord(producer) || producer.id !== identity.producer.id || producer.revision !== identity.producer.revision || !isRecord(manifest.files)) {
    throw new Error("Capture context does not match the supplied recording identity.");
  }
  const nes = manifest.architecture === "65xx.2a03";
  if (nes && (!identity.romFileSha256 || identity.romFileSha256 !== manifest.romFileSha256 || manifest.addressSpace !== "nes.cpu") || !nes && identity.romFileSha256 !== void 0) {
    throw new Error("Capture context requires the matching full iNES image.");
  }
  const files = manifest.files;
  if (nes && manifest.scope !== "nes.2a03.instructions" && manifest.scope !== "nes.cpu-bus-ppu") {
    throw new Error("Invalid NES capture context scope.");
  }
  if (nes && manifest.scope === "nes.2a03.instructions" && !files["graphics.act2"]) {
    throw new Error("NES instruction context is missing its graphics companion.");
  }
  for (const name of [
    "start.bst",
    ...nes ? ["ram-start.bin", "ram-end.bin", "start-extra.bin", "end-state.bin"] : ["wram-start.bin", "wram-end.bin"],
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
    signal?.throwIfAborted();
    if (!/^(?:identity\.txt|machine\.json|start-extra\.bin|end-state\.bin|ram-(?:start|end)\.bin|start\.bst|wram-(?:start|end)\.bin|inputs\.bin|milestones\.jsonl|(?:start|end)-clock\.txt|boundaries\.json|graphics\.act2|screen-\d+\.png)$/.test(
      name
    ) || !isRecord(artifact) || typeof artifact.bytes !== "number" || !Number.isSafeInteger(artifact.bytes) || artifact.bytes < 0 || typeof artifact.sha256 !== "string" || !/^[\da-f]{64}$/.test(artifact.sha256)) {
      throw new Error("Invalid capture context artifact descriptor.");
    }
    const file = path.join(directory, name), stat2 = await lstat(file);
    if (!stat2.isFile() || stat2.isSymbolicLink() || stat2.size !== artifact.bytes || name === "start.bst" && (stat2.size < 538 || stat2.size > 32 * 1048576) || name.startsWith("wram-") && (nes || stat2.size !== 131072) || name.startsWith("ram-") && (!nes || stat2.size !== 2048) || name === "start-extra.bin" && (!nes || stat2.size !== 38) || name === "end-state.bin" && (!nes || stat2.size < 2048 || stat2.size > 32 * 1048576) || name === "inputs.bin" && stat2.size % 18) {
      throw new Error(`Capture context artifact size/type mismatch: ${name}.`);
    }
    if (await digestFile(file, signal) !== artifact.sha256) {
      throw new Error(`Capture context checksum mismatch: ${name}.`);
    }
  }
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
var isRecord2 = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
var listed = (values, value) => typeof value === "string" && values.some((item) => item === value);
var positiveInteger = (value) => typeof value === "number" && Number.isSafeInteger(value) && value > 0;
var nonNegativeInteger = (value) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
var sessionPattern = /^[\w-]{32,128}$/;
function assertDebugSidecarSessionToken(value) {
  if (typeof value !== "string" || !sessionPattern.test(value)) {
    throw new Error("Sidecar session token must be 32-128 base64url characters.");
  }
}
var assertRequestBounds = (command, args, limits) => {
  const record2 = args ?? {};
  if (!isRecord2(record2)) {
    throw new Error("Sidecar request arguments must be an object.");
  }
  if (command === "readMemory") {
    const count = record2.count;
    if (!nonNegativeInteger(count) || count > limits.maxMemoryReadBytes) {
      throw new Error(`Memory read count must be between 0 and ${limits.maxMemoryReadBytes}.`);
    }
  }
  if (command === "disassemble") {
    const count = record2.count;
    if (!nonNegativeInteger(count) || count > limits.maxDisassemblyInstructions) {
      throw new Error(
        `Disassembly count must be between 0 and ${limits.maxDisassemblyInstructions}.`
      );
    }
  }
  if (command === "setBreakpoints") {
    const breakpoints = record2.breakpoints;
    if (!Array.isArray(breakpoints) || breakpoints.length > limits.maxBreakpoints) {
      throw new Error(`Breakpoint count must be between 0 and ${limits.maxBreakpoints}.`);
    }
  }
  if (command === "readTrace") {
    const maxEvents = record2.maxEvents;
    if (!positiveInteger(maxEvents) || maxEvents > limits.maxTraceBatchEvents) {
      throw new Error(`Trace batch size must be between 1 and ${limits.maxTraceBatchEvents}.`);
    }
  }
};
function assertDebugSidecarMessage(value, limits = DEFAULT_DEBUG_SIDECAR_LIMITS) {
  if (!isRecord2(value)) {
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
    if (!listed(DEBUG_SIDECAR_COMMANDS, value.command)) {
      throw new Error(`Unsupported sidecar command '${String(value.command)}'.`);
    }
    assertRequestBounds(value.command, value.arguments, limits);
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
    if (!listed(DEBUG_SIDECAR_EVENTS, value.event)) {
      throw new Error(`Unsupported sidecar event '${String(value.event)}'.`);
    }
    if (!isRecord2(value.body)) {
      throw new Error("Sidecar event body must be an object.");
    }
    return;
  }
  throw new Error(`Unsupported sidecar message type '${String(value.type)}'.`);
}
var LIMIT_NAMES = [
  "maxFrameBytes",
  "maxBufferedBytes",
  "maxMemoryReadBytes",
  "maxDisassemblyInstructions",
  "maxBreakpoints",
  "maxTraceBatchEvents",
  "maxQueuedMessages",
  "maxQueuedBytes"
];
var validateLimits = (limits) => {
  for (const name of LIMIT_NAMES) {
    if (!positiveInteger(limits[name])) {
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
      let decoded2;
      try {
        decoded2 = JSON.parse(body.toString("utf8"));
      } catch {
        throw new Error("Sidecar frame contains invalid JSON.");
      }
      assertDebugSidecarMessage(decoded2, this.#limits);
      if (decoded2.sequence <= this.#lastSequence) {
        throw new Error(
          `Sidecar sequence ${decoded2.sequence} is not greater than ${this.#lastSequence}.`
        );
      }
      this.#lastSequence = decoded2.sequence;
      messages.push(decoded2);
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
var isStepKind = (value) => value === "instruction" || value === "over" || value === "in" || value === "out";
var isRecord3 = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
var record = (value, context) => {
  if (!isRecord3(value)) {
    throw new Error(`${context} must be an object.`);
  }
  return value;
};
var integer = (value, context, minimum = 0) => {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum) {
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
function assertShutdownCommand(command) {
  if (command !== "shutdown") {
    throw new Error(`Unsupported command '${command}'.`);
  }
}
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
      const kind = args.kind;
      if (typeof kind !== "string" || !isStepKind(kind)) {
        throw new Error(`Unsupported step kind '${String(kind)}'.`);
      }
      await this.#implementation.step(positiveInteger2(args.threadId, "Step threadId"), kind);
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
    assertShutdownCommand(request.command);
    return {};
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
      return;
    });
    this.#writeTail = write2.catch(() => void 0);
    return write2;
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
    ++index;
    const escaped = index < payload.length ? payload[index] : void 0;
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
    return;
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
    if (!Buffer.isBuffer(chunk)) {
      throw new Error(`Expected binary bytes while hashing ${file}.`);
    }
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
  const address2 = server.address();
  if (!address2 || typeof address2 === "string") {
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
  return address2.port;
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
var isRecord4 = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
var manifestRecord = (value) => {
  if (!isRecord4(value)) {
    throw new Error("Ares runtime manifest must be an object.");
  }
  return value;
};
var NODE_PLATFORMS = [
  "aix",
  "android",
  "darwin",
  "freebsd",
  "haiku",
  "linux",
  "openbsd",
  "sunos",
  "win32",
  "cygwin",
  "netbsd"
];
var manifestPlatform = (value) => {
  const platform = NODE_PLATFORMS.find((candidate) => candidate === value);
  if (!platform) {
    throw new Error(`Ares manifest platform '${value}' is not a Node platform.`);
  }
  return platform;
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
    manifest.resources.map((entry, index) => {
      const resource = manifestRecord(entry);
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
    platform: manifestPlatform(manifestString(manifest.platform, "Ares manifest platform")),
    architecture: manifestString(manifest.architecture, "Ares manifest architecture"),
    buildConfiguration,
    resources
  });
};
var AresProcessHost = class {
  #executable;
  #rom;
  #runtimeDirectory;
  #saveDirectory;
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
    this.#saveDirectory = options.saveDirectory === void 0 ? void 0 : checkedAbsolutePath(options.saveDirectory, "Ares save directory");
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
    if (this.#saveDirectory) {
      await mkdir(this.#saveDirectory, { recursive: true });
    } else if (!desktop) {
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
        ...!this.#saveDirectory ? ["--setting", `Paths/Saves=${path2.join(this.#runtimeDirectory, "saves")}`] : [],
        "--gdb-port",
        String(port),
        "--gdb-ipv4",
        "--wait-on-gdb",
        "--quiet",
        ...this.#fastBoot ? ["--fast-boot"] : []
      ],
      // ares concatenates the system name onto this root instead of joining paths.
      // Include its separator explicitly to avoid siblings such as savesSuper Famicom.
      ...this.#saveDirectory ? ["--setting", `Paths/Saves=${path2.join(this.#saveDirectory, path2.sep)}`] : [],
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
        `Unable to verify ares ${context} at '${file}': ${errorValue(error).message}`,
        { cause: error }
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
    const operation2 = this.#lifecycleTail.then(action);
    this.#lifecycleTail = operation2.then(
      () => void 0,
      () => void 0
    );
    return operation2;
  }
};

// packages/debug-sidecar-ares/src/ares-rsp-backend.ts
import { readFile as readFile2 } from "node:fs/promises";
import path3 from "node:path";

// packages/core/src/source-location.ts
function createSourceSpan(start, end, line) {
  return {
    start,
    end,
    // Operand-local spans omit physical lines so cached syntax remains plain JSON data.
    ...line === void 0 ? {} : { line },
    columnStart: start,
    columnEnd: end
  };
}
function createTextSpan(text, start, end, line, lineStarts = sourceLineStarts(text)) {
  let low = 0;
  let high = lineStarts.length;
  while (low + 1 < high) {
    const middle = low + high >>> 1;
    if (lineStarts[middle] <= start) {
      low = middle;
    } else {
      high = middle;
    }
  }
  const column = start - lineStarts[low];
  return createSourceSpan(column, column + end - start, line + low);
}
function sourceLineStarts(text) {
  const starts = [0];
  for (let at = text.indexOf("\n"); at >= 0; at = text.indexOf("\n", at + 1)) {
    starts.push(at + 1);
  }
  return starts;
}

// packages/core/src/ir/expression-parse-state.ts
var rawOutcomes = /* @__PURE__ */ new WeakMap();
function setRawExpressionOutcome(node, outcome2) {
  rawOutcomes.set(node, outcome2);
}
function expressionOutcomeKey(outcome2) {
  return outcome2.kind === "native" ? "native" : `${outcome2.kind}:${outcome2.reason}`;
}

// packages/core/src/internal-instrumentation.ts
var activeInstrumentation;
function recordExpressionParse(site, outcome2) {
  if (syntaxOwner === "execution") {
    recordSyntaxBoundary("execution-expression-parse");
  }
  const metrics = activeInstrumentation;
  if (!metrics) {
    return;
  }
  metrics.counters.expressionParserCalls++;
  if (site === "instrumentation") {
    metrics.counters.expressionInstrumentationParses++;
  }
  const key = `${site}:${expressionOutcomeKey(outcome2)}`;
  metrics.expressionBoundaries.parses[key] = (metrics.expressionBoundaries.parses[key] ?? 0) + 1;
}
var migrationGuard;
function recordSyntaxBoundary(boundary) {
  if (migrationGuard?.forbidden.has(boundary)) {
    migrationGuard.violations.add(boundary);
  }
  const metrics = activeInstrumentation;
  if (metrics) {
    metrics.syntaxBoundaries[boundary] = (metrics.syntaxBoundaries[boundary] ?? 0) + 1;
  }
}
var syntaxOwner = "source";
function recordExecutionParser(kind) {
  if (syntaxOwner === "execution") {
    recordSyntaxBoundary(`execution-${kind}-parse`);
  }
}

// packages/core/src/ir/source-fragment.ts
function sourceFragment(text, origins = []) {
  return { segments: [{ text, origins }] };
}

// packages/core/src/ir/define-template.ts
function parseDefineTemplate(text, escapes = "basic") {
  const parse2 = (start, end) => {
    const parts2 = [];
    for (let index = start; index < end; index++) {
      const next = text.at(index + 1);
      if (text[index] === "\\" && next !== void 0 && escapes !== "none" && (escapes === "string" || next === "\\" || next === "!")) {
        parts2.push({ kind: "escape", start: index, end: index + 2, value: next });
        index++;
        continue;
      }
      if (text[index] !== "!") {
        continue;
      }
      if (next === "{") {
        let cursor = index + 2;
        let depth = 1;
        for (; cursor < end && depth > 0; cursor++) {
          if (text[cursor] === "{") {
            depth++;
          } else if (text[cursor] === "}") {
            depth--;
          }
        }
        if (depth !== 0) {
          parts2.push({ kind: "error", start: index, end });
          break;
        }
        parts2.push({
          kind: "define",
          start: index,
          end: cursor,
          name: text.slice(index + 2, cursor - 1),
          braced: true,
          children: parse2(index + 2, cursor - 1)
        });
        index = cursor - 1;
      } else if (next && /\w/.test(next)) {
        let cursor = index + 2;
        while (cursor < end && /\w/.test(text[cursor])) {
          cursor++;
        }
        parts2.push({
          kind: "define",
          start: index,
          end: cursor,
          name: text.slice(index + 1, cursor),
          braced: false,
          children: []
        });
        index = cursor - 1;
      }
    }
    return parts2;
  };
  return { text, parts: parse2(0, text.length) };
}

// packages/core/src/ir/expression-call-contracts.ts
var firstSourceArgument = /* @__PURE__ */ new Set([
  "countof",
  "bytesof",
  "startof",
  "endof",
  "defined",
  "sizeof",
  "objectsize",
  "datasize",
  "filesize",
  "getfilestatus"
]);
function isSourceTextArgument(name, index) {
  if (name === "stringsequal" || name === "stringsequalnocase") {
    return index < 2;
  }
  return index === 0 && (firstSourceArgument.has(name) || /^(?:canreadfile|readfile)\d?$/.test(name));
}

// packages/core/src/ir/expression-operators.ts
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

// packages/core/src/ir/expression-node.ts
function attachRootSpan(node, text, source) {
  node.span ??= source ? createTextSpan(
    source.text,
    source.offset,
    source.offset + text.length,
    source.line,
    source.lineStarts
  ) : createSourceSpan(0, text.length);
  return node;
}
function parseExpressionNode(input, source) {
  return parseExpressionAtSite(input, "public", source);
}
function parseExpressionAtSite(input, site, source) {
  return parseExpressionResult(input, site, source).node;
}
function parseExpressionResult(input, site = "public", source) {
  const result = parseExpressionInput(input, site, source);
  recordExpressionParse(site, result.outcome);
  return result;
}
var ExpressionSyntaxError = class extends Error {
  constructor(outcome2, diagnostic) {
    super(outcome2.reason);
    this.outcome = outcome2;
    this.diagnostic = diagnostic;
  }
  outcome;
  diagnostic;
};
function errorParseResult(text, outcome2, source, diagnostic) {
  if (text.includes("!")) {
    const defines = parseDefineTemplate(text);
    if (defines.parts.some((part) => part.kind === "define") && !defines.parts.some((part) => part.kind === "error")) {
      return {
        node: attachRootSpan({ type: "template", form: "source", text, defines }, text, source),
        outcome: { kind: "native" }
      };
    }
  }
  const node = attachRootSpan(
    {
      type: "error",
      value: text,
      outcome: outcome2,
      ...diagnostic ?? { message: `Invalid number: ${text}` }
    },
    text,
    source
  );
  setRawExpressionOutcome(node, outcome2);
  return { node, outcome: outcome2 };
}
function parseLiteralValue(value) {
  if (/^\$[\dA-Fa-f]+$/.test(value)) {
    return Number.parseInt(value.slice(1), 16);
  }
  if (/^0x[\da-f]+$/i.test(value)) {
    return Number.parseInt(value.slice(2), 16);
  }
  if (/^%[01]+$/.test(value)) {
    return Number.parseInt(value.slice(1), 2);
  }
  if (/^-?\d+(?:\.\d+)?$/.test(value)) {
    return Number(value);
  }
  throw new Error(`Unsupported literal expression: ${value}`);
}
function parseExpressionInput(input, site, source) {
  const trimmed = input.trim();
  if (source) {
    source = { ...source, offset: source.offset + input.length - input.trimStart().length };
  }
  if (!trimmed) {
    return errorParseResult(trimmed, { kind: "invalid", reason: "empty" }, source, {
      code: "MATH_INVALID_INPUT",
      message: "Invalid input: empty expression."
    });
  }
  if (trimmed.startsWith("#") && trimmed.length > 1) {
    return parseExpressionResult(
      trimmed.slice(1),
      site,
      source && { ...source, offset: source.offset + 1 }
    );
  }
  const rangeIndex = findTopLevelRange(trimmed);
  if (rangeIndex !== -1) {
    const start = parseExpressionResult(trimmed.slice(0, rangeIndex), site, source);
    const end = parseExpressionResult(
      trimmed.slice(rangeIndex + 2),
      site,
      source && { ...source, offset: source.offset + rangeIndex + 2 }
    );
    const outcome2 = start.outcome.kind === "native" ? end.outcome : start.outcome;
    return {
      node: attachRootSpan({ type: "range", start: start.node, end: end.node }, trimmed, source),
      outcome: outcome2
    };
  }
  try {
    const parser = new ExpressionParser(tokenizeExpression(trimmed, source, site), trimmed);
    const expression = parser.parseExpression();
    if (!parser.isAtEnd()) {
      const offset = parser.peek()?.offset ?? trimmed.length;
      const rest = trimmed.slice(offset);
      const diagnostic = rest.startsWith(",") ? { code: "MATH_INVALID_INPUT", message: `Invalid input: ${rest}` } : { code: "MATH_MISMATCHED_PARENTHESES", message: "Mismatched parentheses." };
      return errorParseResult(
        trimmed,
        { kind: "invalid", reason: "trailing-tokens" },
        source,
        diagnostic
      );
    }
    return { node: attachRootSpan(expression, trimmed, source), outcome: { kind: "native" } };
  } catch (error) {
    const failure = error instanceof ExpressionSyntaxError ? error.outcome : { kind: "unsupported", reason: "unclassified" };
    const diagnostic = error instanceof ExpressionSyntaxError && error.diagnostic ? error.diagnostic : { message: `Invalid number: ${trimmed}` };
    return errorParseResult(trimmed, failure, source, diagnostic);
  }
}
function isReferenceExpressionNode(node) {
  switch (node.type) {
    case "identifier":
    case "defineReference":
    case "relativeReference":
      return true;
    case "member":
    case "index":
      return isReferenceExpressionNode(node.object);
    case "binary":
    case "call":
    case "literal":
    case "range":
    case "raw":
    case "string":
    case "unary":
    case "error":
    case "sourceText":
    case "template":
      break;
  }
  return false;
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
function skipWhitespace(input, index) {
  let current = index;
  while (current < input.length && /\s/.test(input[current])) {
    current++;
  }
  return current;
}
function isUnaryOperator(value) {
  return value === "<:" || value === "<" || value === ">" || value === "^" || value === "~" || value === "-" || value === "+";
}
function isQuote(value) {
  return value === '"' || value === "'";
}
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
function tokenizeExpression(input, source, site = "public") {
  const tokens = [];
  let index = 0;
  const provenance = (end) => source ? {
    offset: index,
    span: createTextSpan(
      source.text,
      source.offset + index,
      source.offset + end,
      source.line,
      source.lineStarts
    )
  } : { offset: index };
  const astProvenance = (end) => {
    const { offset: _offset, ...location } = provenance(end);
    return location;
  };
  while (index < input.length) {
    const char = input[index];
    if (/\s/.test(char)) {
      index++;
      continue;
    }
    const previousToken = tokens.at(-1);
    const startsOperand = !previousToken || ["operator", "lparen", "lbracket", "comma"].includes(previousToken.type);
    const relative = input.slice(index).match(/^([:?]?)(\++|-+)/);
    if (relative && (relative[1] || startsOperand && /^(?:\s*$|\s*[&)*,/<=>\]^|])/.test(input.slice(index + relative[0].length)))) {
      let stream = "relative";
      if (relative[1] === ":") {
        stream = "unnamed";
      }
      if (relative[1] === "?") {
        stream = "macro";
      }
      const text = relative[0];
      tokens.push({
        type: "expression",
        node: {
          type: "relativeReference",
          text,
          stream,
          direction: relative[2][0] === "+" ? 1 : -1,
          count: relative[2].length,
          ...astProvenance(index + text.length)
        },
        offset: index
      });
      index += text.length;
      continue;
    }
    const placeholder = startsOperand ? input.slice(index).match(/^<(?:([A-Z_a-z]\w*)|(?:\.{3}|…)\[([^\]]+)])>/) : null;
    if (placeholder) {
      const text = placeholder[0];
      const node = {
        type: "template",
        form: placeholder[1] ? "parameter" : "variadic",
        text,
        ...astProvenance(index + text.length)
      };
      if (placeholder[1]) {
        node.name = placeholder[1];
      } else {
        node.index = parseExpressionAtSite(placeholder[2], site);
      }
      tokens.push({ type: "expression", node, offset: index });
      index += text.length;
      continue;
    }
    if (char === "(") {
      tokens.push({ type: "lparen", offset: index });
      index++;
      continue;
    }
    if (char === ")") {
      tokens.push({ type: "rparen", offset: index });
      index++;
      continue;
    }
    if (char === ",") {
      tokens.push({ type: "comma", offset: index });
      index++;
      continue;
    }
    if (char === ".") {
      tokens.push({ type: "dot", ...provenance(index + 1) });
      index++;
      continue;
    }
    if (char === "[") {
      tokens.push({ type: "lbracket", offset: index });
      index++;
      continue;
    }
    if (char === "]") {
      tokens.push({ type: "rbracket", offset: index });
      index++;
      continue;
    }
    if (char === '"' || char === "'") {
      const { value, nextIndex, quote } = readQuotedString(input, index);
      tokens.push({ type: "string", value, quote, ...provenance(nextIndex) });
      index = nextIndex;
      continue;
    }
    const previous = tokens.at(-1);
    const operandExpected = !previous || previous.type === "operator" || previous.type === "lparen" || previous.type === "lbracket" || previous.type === "comma";
    if (operandExpected && char === "%" && !/[01]/.test(input[index + 1] ?? "")) {
      throw new ExpressionSyntaxError(
        { kind: "invalid", reason: "literal" },
        { message: "Invalid number: NaN" }
      );
    }
    if (char === "%" && operandExpected && /[01]/.test(input[index + 1] ?? "")) {
      const literal = input.slice(index).match(/^%[01]+/)[0];
      tokens.push({ type: "literal", value: literal, ...provenance(index + literal.length) });
      index += literal.length;
      continue;
    }
    if (char === "!" && !input.startsWith("!=", index) && !/[A-Z_a-z{]/.test(input[index + 1] ?? "")) {
      tokens.push({ type: "operator", value: "~", offset: index });
      index++;
      continue;
    }
    if (char === "~") {
      tokens.push({ type: "operator", value: "~", offset: index });
      index++;
      continue;
    }
    const operator = (input.startsWith("<:", index) ? "<:" : void 0) ?? binaryOperators.find((candidate) => input.startsWith(candidate, index));
    if (operator) {
      tokens.push({ type: "operator", value: operator, offset: index });
      index += operator.length;
      continue;
    }
    if (char === "!") {
      const { token, nextIndex } = readDefineReference(input, index);
      tokens.push({ ...token, ...provenance(nextIndex) });
      index = nextIndex;
      continue;
    }
    if (char === "@" || char === "?" || /[A-Z_a-z]/.test(char) || previousToken?.type === "dot" && /\d/.test(char)) {
      const { value, nextIndex } = readIdentifier(input, index);
      if (nextIndex === index + 1 && (char === "?" || char === "@")) {
        throw new ExpressionSyntaxError({ kind: "unsupported", reason: "token" });
      }
      const open = skipWhitespace(input, nextIndex);
      if (input[open] === "(" && previousToken?.type !== "dot") {
        const call = readCallSyntax(input, value, open, site, source);
        tokens.push({
          type: "expression",
          node: {
            type: "call",
            callee: { type: "identifier", name: value, ...astProvenance(nextIndex) },
            arguments: call.arguments,
            ...astProvenance(call.end)
          },
          offset: index
        });
        index = call.end;
        continue;
      }
      tokens.push({ type: "identifier", value, ...provenance(nextIndex) });
      index = nextIndex;
      continue;
    }
    if (char === "$") {
      const match = input.slice(index).match(/^\$[\dA-Fa-f]+/);
      if (!match) {
        throw new ExpressionSyntaxError(
          { kind: "invalid", reason: "literal" },
          { message: "Invalid number: NaN" }
        );
      }
      tokens.push({ type: "literal", value: match[0], ...provenance(index + match[0].length) });
      index += match[0].length;
      continue;
    }
    if (char === "%") {
      const match = input.slice(index).match(/^%[01]+/);
      if (!match) {
        throw new ExpressionSyntaxError(
          { kind: "invalid", reason: "literal" },
          { message: "Invalid number: NaN" }
        );
      }
      tokens.push({ type: "literal", value: match[0], ...provenance(index + match[0].length) });
      index += match[0].length;
      continue;
    }
    if (/\d/.test(char)) {
      if (/^0x/i.test(input.slice(index)) && !/[\dA-Fa-f]/.test(input[index + 2] ?? "")) {
        throw new ExpressionSyntaxError(
          { kind: "invalid", reason: "literal" },
          { message: "Invalid number: NaN" }
        );
      }
      const match = input.slice(index).match(/^(?:0x[\da-f]+|-?\d+(?:\.\d+)?)/i);
      if (!match) {
        throw new ExpressionSyntaxError(
          { kind: "invalid", reason: "literal" },
          { message: "Invalid number: NaN" }
        );
      }
      tokens.push({ type: "literal", value: match[0], ...provenance(index + match[0].length) });
      index += match[0].length;
      continue;
    }
    throw new ExpressionSyntaxError({ kind: "unsupported", reason: "token" });
  }
  return tokens;
}
function readCallSyntax(input, name, open, site, source) {
  const args = [];
  let start = open + 1;
  let depth = 0;
  let quote = "";
  const append = (end) => {
    const raw = input.slice(start, end);
    const text = raw.trim();
    if (!text) {
      if (start > open + 1 && isSourceTextArgument(name, args.length)) {
        throw new ExpressionSyntaxError(
          { kind: "invalid", reason: "operand" },
          { message: `Missing function argument for '${name}'.` }
        );
      }
      return;
    }
    if (/^function\b/.test(text)) {
      throw new ExpressionSyntaxError(
        { kind: "invalid", reason: "operand" },
        { message: `Missing function argument for '${name}'.` }
      );
    }
    const offset = start + raw.length - raw.trimStart().length;
    const occurrence = source && { ...source, offset: source.offset + offset };
    if (isSourceTextArgument(name, args.length)) {
      let value = text;
      if (text.startsWith('"') || text.startsWith("'")) {
        const quoted = readQuotedString(text, 0);
        const trailing = text.slice(quoted.nextIndex).trimStart();
        if (trailing && /^["'A-Z_a-z]/.test(trailing)) {
          throw new ExpressionSyntaxError(
            { kind: "invalid", reason: "delimiter" },
            {
              message: `Expected ',' or ')' in function call arguments: ${input.slice(offset + quoted.nextIndex).trimStart()}`
            }
          );
        }
      }
      if (text.startsWith('"') && text.endsWith('"') || text.startsWith("'") && text.endsWith("'")) {
        value = text.slice(1, -1);
      }
      args.push(attachRootSpan({ type: "sourceText", text, value }, text, occurrence));
    } else {
      args.push(parseExpressionAtSite(text, site, occurrence));
    }
  };
  for (let index = start; index < input.length; index++) {
    const char = input[index];
    if (quote) {
      if (char === quote && input[index - 1] !== "\\") {
        quote = "";
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === "(" || char === "[") {
      depth++;
    } else if (char === "]") {
      depth--;
    } else if (char === ")") {
      if (depth === 0) {
        append(index);
        return { arguments: args, end: index + 1 };
      }
      depth--;
    } else if (char === "," && depth === 0) {
      append(index);
      start = index + 1;
    }
  }
  let message = "Mismatched parentheses.";
  if (depth === 0 && input.slice(start).trim()) {
    message = "Expected ',' or ')' in function call arguments: ";
  }
  if (quote) {
    message = "Unterminated string literal in function call.";
  }
  throw new ExpressionSyntaxError({ kind: "invalid", reason: "delimiter" }, { message });
}
function readQuotedString(input, start) {
  const quote = input[start];
  if (!isQuote(quote)) {
    throw new ExpressionSyntaxError({ kind: "invalid", reason: "string" });
  }
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
  throw new ExpressionSyntaxError({ kind: "invalid", reason: "string" });
}
function readIdentifier(input, start) {
  let index = start;
  if (input[index] === "?" && input[index + 1] === ".") {
    index++;
    while (input[index] === ".") {
      index++;
    }
  }
  if (input[index] === "@" || input[index] === "?") {
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
    throw new ExpressionSyntaxError({ kind: "invalid", reason: "define" });
  }
  const { value, nextIndex } = readIdentifier(input, start + 1);
  if (!value) {
    throw new ExpressionSyntaxError({ kind: "invalid", reason: "define" });
  }
  return {
    token: { type: "defineReference", name: value, braced: false },
    nextIndex
  };
}
var ExpressionParser = class {
  constructor(tokens, sourceText) {
    this.tokens = tokens;
    this.sourceText = sourceText;
  }
  tokens;
  sourceText;
  index = 0;
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
      const nextMinPrecedence = precedence + 1;
      const next = this.peek();
      if (this.isAtEnd() || next?.type === "identifier" && next.value === "function") {
        throw new ExpressionSyntaxError(
          { kind: "invalid", reason: "operand" },
          { message: `Missing right operand for operator '${token.value}'.` }
        );
      }
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
  isAtEnd() {
    return this.index >= this.tokens.length;
  }
  parsePrefix() {
    const token = this.peek();
    if (!token) {
      throw new ExpressionSyntaxError({ kind: "invalid", reason: "operand" });
    }
    if (token.type === "operator" && isUnaryOperator(token.value)) {
      this.consume();
      return {
        type: "unary",
        operator: token.value,
        argument: this.parsePrefix()
      };
    }
    return this.parsePostfix(this.parsePrimary());
  }
  parsePrimary() {
    if (this.peek()?.type === "dot") {
      const firstSpan = this.peek()?.span;
      let name = "";
      while (this.match({ type: "dot" })) {
        name += ".";
      }
      const token2 = this.consume();
      if (token2?.type === "identifier") {
        return {
          type: "identifier",
          name: name + token2.value,
          ...firstSpan && {
            span: createSourceSpan(firstSpan.start, token2.span.end, firstSpan.line)
          }
        };
      }
      if (token2?.type === "literal" && /^\d+$/.test(token2.value)) {
        return {
          type: "identifier",
          name: name + token2.value,
          ...firstSpan && {
            span: createSourceSpan(firstSpan.start, token2.span.end, firstSpan.line)
          }
        };
      }
      throw new ExpressionSyntaxError({ kind: "invalid", reason: "member" });
    }
    const token = this.consume();
    if (!token) {
      throw new ExpressionSyntaxError({ kind: "invalid", reason: "operand" });
    }
    switch (token.type) {
      case "expression":
        return token.node;
      case "literal": {
        const numericValue = parseLiteralValue(token.value);
        return {
          type: "literal",
          value: token.value,
          ...Number.isFinite(numericValue) && { numericValue },
          ...token.span && { span: token.span }
        };
      }
      case "string":
        return {
          type: "string",
          value: token.value,
          quote: token.quote,
          ...token.span && { span: token.span }
        };
      case "defineReference":
        return token.braced ? {
          type: "defineReference",
          content: token.content,
          braced: true,
          ...token.span && { span: token.span }
        } : {
          type: "defineReference",
          name: token.name,
          braced: false,
          ...token.span && { span: token.span }
        };
      case "identifier":
        return { type: "identifier", name: token.value, ...token.span && { span: token.span } };
      case "lparen": {
        const next = this.peek();
        if (next?.type === "identifier" && next.value === "function") {
          throw new ExpressionSyntaxError(
            { kind: "invalid", reason: "operand" },
            { message: "Empty parenthesized expression." }
          );
        }
        const expression = this.parseExpression();
        this.expect("rparen");
        return { ...expression, parenthesized: true };
      }
      case "comma":
      case "dot":
      case "lbracket":
      case "operator":
      case "rbracket":
      case "rparen":
        break;
    }
    throw new ExpressionSyntaxError(
      { kind: "invalid", reason: "operand" },
      { message: `Invalid number: ${this.sourceText.slice(token.offset ?? 0)}` }
    );
  }
  parsePostfix(expression) {
    let current = expression;
    while (true) {
      if (this.match({ type: "lparen" })) {
        if (current.type !== "identifier") {
          throw new ExpressionSyntaxError({ kind: "unsupported", reason: "postfix" });
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
          throw new ExpressionSyntaxError({ kind: "unsupported", reason: "postfix" });
        }
        const property = this.consume();
        if (!property || property.type !== "identifier") {
          throw new ExpressionSyntaxError({ kind: "invalid", reason: "member" });
        }
        current = {
          type: "member",
          object: current,
          property: {
            type: "identifier",
            name: property.value,
            ...property.span && { span: property.span }
          }
        };
        continue;
      }
      if (this.match({ type: "lbracket" })) {
        if (!isReferenceExpressionNode(current)) {
          throw new ExpressionSyntaxError({ kind: "unsupported", reason: "postfix" });
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
      throw new ExpressionSyntaxError(
        { kind: "invalid", reason: "delimiter" },
        {
          message: type === "rbracket" ? "Mismatched brackets in struct index" : "Mismatched parentheses."
        }
      );
    }
  }
  match(expected) {
    const token = this.peek();
    if (token && token.type === expected.type) {
      this.index++;
      return true;
    }
    return false;
  }
  consume() {
    const token = this.tokens[this.index];
    this.index++;
    return token;
  }
  peek() {
    return this.tokens[this.index];
  }
};
function isBinaryOperator(value) {
  return value in binaryPrecedence;
}

// packages/core/src/ir/directive-arguments.ts
function parseDirectiveExpression(text, numeric = true, source) {
  recordExecutionParser("directive");
  if (/![\w{]/.test(text)) {
    return { type: "template", form: "source", text };
  }
  const node = parseExpressionAtSite(text, "statement", source);
  return numeric ? dataResolutionExpression(text, node) : node;
}
function unquoteDirectiveText(text) {
  const quote = text[0];
  if ((quote === '"' || quote === "'") && text.endsWith(quote) && text.length > 1) {
    return text.slice(1, -1);
  }
  return text;
}
function dataResolutionExpression(text, node) {
  if (node.parenthesized && (node.type === "member" || node.type === "index" || node.type === "literal" && node.value.includes("."))) {
    return { type: "identifier", name: text, ...node.span ? { span: node.span } : {} };
  }
  return node;
}

// packages/core/src/ir/source-syntax.ts
function copySyntaxValue(value) {
  return copySyntaxTree(value, false);
}
function copySyntaxTree(value, immutable) {
  const ancestors = /* @__PURE__ */ new Set();
  let nodes = 0;
  const copy = (entry, depth) => {
    if (++nodes > 1e6) {
      throw new Error("Plugin syntax payload exceeds structural limits (1,000,000 values).");
    }
    if (depth > 128) {
      throw new Error("Plugin syntax payload exceeds structural limits (128 nesting levels).");
    }
    if (entry === null || typeof entry === "string" || typeof entry === "boolean") {
      return entry;
    }
    if (typeof entry === "number" && Number.isFinite(entry)) {
      return entry;
    }
    if (typeof entry !== "object") {
      throw new Error("Plugin syntax payload must be plain JSON data.");
    }
    if (ancestors.has(entry)) {
      throw new Error("Plugin syntax payload must be acyclic.");
    }
    const prototype = Object.getPrototypeOf(entry);
    if (!Array.isArray(entry) && prototype !== Object.prototype && prototype !== null) {
      throw new Error("Plugin syntax payload must have a plain prototype.");
    }
    if (Object.getOwnPropertySymbols(entry).length) {
      throw new Error("Plugin syntax payload cannot contain symbol properties.");
    }
    ancestors.add(entry);
    try {
      const keys = Object.getOwnPropertyNames(entry);
      if (Array.isArray(entry)) {
        const result2 = [];
        for (let index = 0; index < entry.length; index++) {
          const descriptor2 = Object.getOwnPropertyDescriptor(entry, index);
          if (!descriptor2) {
            throw new Error("Plugin syntax arrays must be dense.");
          }
          if (!("value" in descriptor2)) {
            throw new Error("Plugin syntax payload cannot contain accessors.");
          }
          result2.push(copy(descriptor2.value, depth + 1));
        }
        if (keys.length !== entry.length + 1) {
          throw new Error("Plugin syntax arrays cannot have custom properties.");
        }
        return immutable ? Object.freeze(result2) : result2;
      }
      const result = {};
      for (const key of keys) {
        const descriptor2 = Object.getOwnPropertyDescriptor(entry, key);
        if (!descriptor2 || !("value" in descriptor2)) {
          throw new Error("Plugin syntax payload cannot contain accessors.");
        }
        const copied = copy(descriptor2.value, depth + 1);
        if (Object.hasOwn(Object.prototype, key)) {
          Object.defineProperty(result, key, {
            value: copied,
            enumerable: true,
            writable: true,
            configurable: true
          });
        } else {
          result[key] = copied;
        }
      }
      return immutable ? Object.freeze(result) : result;
    } finally {
      ancestors.delete(entry);
    }
  };
  return copy(value, 0);
}

// packages/core/src/ir/syntax-codec.ts
var syntaxString = (value) => typeof value === "string";
var syntaxNumber = (value) => typeof value === "number" && Number.isFinite(value);
var syntaxBoolean = (value) => typeof value === "boolean";
function syntaxLiteral(literal) {
  return (value) => value === literal;
}
function syntaxArray(guard) {
  return (value) => Array.isArray(value) && value.every(guard);
}
function syntaxOptional(guard) {
  return (value) => value === void 0 || guard(value);
}
function syntaxObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function syntaxRecord(shape) {
  return (value) => {
    if (!syntaxObject(value)) {
      return false;
    }
    const fields = value;
    return Object.keys(fields).every((key) => Object.hasOwn(shape, key)) && Object.entries(shape).every(([key, guard]) => guard(fields[key]));
  };
}
function syntaxUnion(...guards) {
  return (value) => guards.some((guard) => guard(value));
}
var syntaxSpan = syntaxRecord({
  start: syntaxNumber,
  end: syntaxNumber,
  line: syntaxOptional(syntaxNumber),
  columnStart: syntaxOptional(syntaxNumber),
  columnEnd: syntaxOptional(syntaxNumber)
});
var identifier = (value) => syntaxExpression(value) && value.type === "identifier";
var reference = (value) => syntaxExpression(value) && ["identifier", "defineReference", "relativeReference", "member", "index"].includes(value.type);
var outcome = syntaxUnion(
  syntaxRecord({ kind: syntaxLiteral("native") }),
  syntaxRecord({
    kind: syntaxLiteral("compatibility"),
    reason: syntaxUnion(
      syntaxLiteral("relative-label"),
      syntaxLiteral("macro-argument"),
      syntaxLiteral("variadic-template")
    )
  }),
  syntaxRecord({
    kind: syntaxLiteral("invalid"),
    reason: syntaxUnion(
      ...[
        "empty",
        "literal",
        "string",
        "define",
        "operand",
        "delimiter",
        "member",
        "trailing-tokens"
      ].map(syntaxLiteral)
    )
  }),
  syntaxRecord({
    kind: syntaxLiteral("unsupported"),
    reason: syntaxUnion(
      syntaxLiteral("token"),
      syntaxLiteral("postfix"),
      syntaxLiteral("unclassified")
    )
  })
);
var syntaxExpression = (value) => {
  if (!syntaxObject(value)) {
    return false;
  }
  const node = value;
  if (node.span !== void 0 && !syntaxSpan(node.span)) {
    return false;
  }
  if (node.parenthesized !== void 0 && !syntaxBoolean(node.parenthesized)) {
    return false;
  }
  switch (node.type) {
    case "literal":
      return syntaxString(node.value) && (node.numericValue === void 0 || syntaxNumber(node.numericValue));
    case "identifier":
      return syntaxString(node.name);
    case "string":
      return syntaxString(node.value) && (node.quote === '"' || node.quote === "'");
    case "sourceText":
      return syntaxString(node.text) && syntaxString(node.value);
    case "defineReference":
      return syntaxBoolean(node.braced) && (syntaxString(node.name) || syntaxString(node.content));
    case "relativeReference":
      return (node.direction === 1 || node.direction === -1) && syntaxNumber(node.count) && ["relative", "unnamed", "macro"].includes(String(node.stream));
    case "member":
      return reference(node.object) && identifier(node.property);
    case "index":
      return reference(node.object) && syntaxExpression(node.index);
    case "call":
      return identifier(node.callee) && syntaxArray(syntaxExpression)(node.arguments);
    case "unary":
      return ["<:", "<", ">", "^", "~", "-", "+"].includes(String(node.operator)) && syntaxExpression(node.argument);
    case "binary":
      return [
        "**",
        "*",
        "/",
        "%",
        "+",
        "-",
        "<<",
        ">>",
        "&",
        "|",
        "^",
        "<",
        ">",
        "<=",
        ">=",
        "==",
        "=",
        "!=",
        "&&",
        "||"
      ].includes(String(node.operator)) && syntaxExpression(node.left) && syntaxExpression(node.right);
    case "range":
      return syntaxExpression(node.start) && syntaxExpression(node.end);
    case "template":
      return ["parameter", "variadic", "source"].includes(String(node.form)) && syntaxString(node.text) && (node.index === void 0 || syntaxExpression(node.index));
    case "error":
      return syntaxString(node.value) && syntaxString(node.message) && outcome(node.outcome);
    default:
      return false;
  }
};
function syntaxCodec(version, parse2, guard) {
  return {
    version,
    parse(input) {
      return copySyntaxValue(JSON.parse(JSON.stringify(parse2(input))));
    },
    validate: guard,
    read(payload) {
      if (!guard(payload)) {
        throw new Error("Invalid typed directive payload.");
      }
      return payload;
    }
  };
}

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

// packages/core/src/ir/data-node.ts
function parseDataOperand(text) {
  let value = text.trim();
  const quote = value[0];
  if (quote === '"' || quote === "'") {
    return { text, expression: { type: "string", quote, value: value.slice(1, -1) } };
  }
  if (value.startsWith("#")) {
    value = value.slice(1);
  }
  if (/![\w{]/.test(value)) {
    return { text, expression: { type: "template", form: "source", text: value } };
  }
  return {
    text,
    expression: dataResolutionExpression(value, parseExpressionAtSite(value, "statement"))
  };
}
function parseDataList(text) {
  return splitRespectingFunctions(text).map(parseDataOperand);
}

// packages/core/src/ir/parsed-operand.ts
function parseInstructionOperands(mnemonic, text, grammar2) {
  const suffix = /\.([blw])$/i.exec(mnemonic)?.[1]?.toLowerCase();
  let width;
  if (suffix === "b") {
    width = 1;
  } else if (suffix === "w") {
    width = 2;
  } else if (suffix === "l") {
    width = 3;
  }
  const mnemonicBit = grammar2.bitSelectors ? /^(?:bbs|bbc|set1|clr1)([0-7])$/i.exec(mnemonic)?.[1] : void 0;
  const result = {
    operands: []
  };
  if (width) {
    result.width = width;
  }
  if (mnemonicBit !== void 0) {
    result.mnemonicBit = Number(mnemonicBit);
  }
  if (!text.trim()) {
    return result;
  }
  if (grammar2.templates !== false && /![\w{]|<[^>]+>|\\[A-Z_a-z]/.test(text)) {
    result.operands.push({
      kind: "template",
      fragment: sourceFragment(text, []),
      structure: parseInstructionOperands(mnemonic, text, { ...grammar2, templates: false }),
      span: { start: 0, end: text.length }
    });
    return result;
  }
  try {
    const parts2 = operandParts(text, ",");
    for (let index = 0; index < parts2.length; index++) {
      let part = parts2[index];
      const next = parts2[index + 1];
      if (grammar2.commaIndex && next && grammar2.indexRegisters.includes(next.text.toLowerCase())) {
        part = { text: text.slice(part.start, next.end), start: part.start, end: next.end };
        index++;
      }
      result.operands.push(parseOperand(part.text, part.start, grammar2));
    }
  } catch (cause) {
    result.operands = [
      {
        kind: "invalid",
        message: cause instanceof Error ? cause.message : String(cause),
        span: { start: 0, end: text.length }
      }
    ];
  }
  return result;
}
function operandParts(text, separator) {
  const parts2 = [];
  const stack = [];
  let quote = "";
  let start = 0;
  const append = (end) => {
    const raw = text.slice(start, end);
    const value = raw.trim();
    const offset = start + raw.length - raw.trimStart().length;
    parts2.push({ text: value, start: offset, end: offset + value.length });
  };
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quote) {
      if (char === "\\") {
        index++;
      } else if (char === quote) {
        quote = "";
      }
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if ("([{".includes(char)) {
      stack.push(char);
    } else if (")]}".includes(char)) {
      const opening = { ")": "(", "]": "[", "}": "{" }[char];
      if (stack.pop() !== opening) {
        throw new Error("Mismatched operand delimiters.");
      }
    } else if (char === separator && stack.length === 0) {
      append(index);
      start = index + 1;
    }
  }
  if (quote || stack.length) {
    throw new Error("Unclosed operand delimiter.");
  }
  append(text.length);
  return parts2;
}
function scalar(text, start, force) {
  const expression = parseDirectiveExpression(text, true, { text, offset: 0, line: 0 });
  let spelling = "expression";
  let literalBytes;
  const hex3 = /^\$([\da-f]+)$/i.exec(text);
  const binary = /^%([01]+)$/.exec(text);
  if (hex3) {
    spelling = "hex";
    literalBytes = Math.max(1, Math.ceil(hex3[1].length / 2));
  } else if (binary) {
    spelling = "binary";
    literalBytes = Math.max(1, Math.ceil(binary[1].length / 8));
  } else if (/^-?\d+(?:\.\d+)?$/.test(text)) {
    spelling = "decimal";
  } else if (isReferenceExpressionNode(expression)) {
    spelling = "symbol";
  }
  return {
    expression,
    ...expression.type === "template" ? {
      referenceExpression: parseExpressionAtSite(text, "statement", {
        text,
        offset: 0,
        line: 0
      })
    } : {},
    width: {
      spelling,
      grouped: expression.parenthesized === true,
      ...force ? { forcedBytes: force } : {},
      ...literalBytes ? { literalBytes } : {}
    },
    span: { start, end: start + text.length }
  };
}
function parseOperand(text, start, grammar2) {
  const span = { start, end: start + text.length };
  if (!text) {
    return { kind: "invalid", message: "Missing operand.", span };
  }
  const name = text.toLowerCase();
  if (grammar2.registers.includes(name)) {
    return { kind: "register", name, span };
  }
  if (text.startsWith("#")) {
    const value = text.slice(1).trim();
    return { kind: "immediate", value: scalar(value, start + text.indexOf(value, 1)), span };
  }
  let body = text;
  let offset = start;
  let force;
  const prefix = grammar2.ca65Widths ? /^([afz]):\s*/i.exec(body) : void 0;
  if (prefix) {
    const code = prefix[1].toLowerCase();
    if (code === "z") {
      force = 1;
    } else if (code === "a") {
      force = 2;
    } else {
      force = 3;
    }
    body = body.slice(prefix[0].length);
    offset += prefix[0].length;
  }
  let inverted = false;
  if (grammar2.bitSelectors && body.startsWith("/")) {
    inverted = true;
    body = body.slice(1);
    offset++;
  }
  let index;
  const outside = grammar2.commaIndex ? operandParts(body, ",") : operandParts(body, "+");
  if ((grammar2.commaIndex || grammar2.plusIndex) && outside.length > 1) {
    const last = outside.at(-1);
    if (grammar2.indexRegisters.includes(last.text.toLowerCase())) {
      index = {
        register: last.text.toLowerCase(),
        position: "outside",
        separator: grammar2.commaIndex ? "," : "+"
      };
      body = body.slice(0, last.start - 1).replace(/[+,]\s*$/, "").trimEnd();
    }
  }
  let postIncrement = false;
  if (grammar2.plusIndex && /\)\s*\+$/.test(body)) {
    postIncrement = true;
    body = body.slice(0, body.lastIndexOf("+")).trimEnd();
  }
  let delimiter = "none";
  if (body.startsWith("(") && body.endsWith(")") || body.startsWith("[") && body.endsWith("]")) {
    const inner = body.slice(1, -1);
    try {
      operandParts(inner, ",");
      delimiter = body[0] === "(" ? "parentheses" : "brackets";
      const trimmed = inner.trim();
      offset += 1 + inner.length - inner.trimStart().length;
      body = trimmed;
    } catch {
    }
  }
  if (delimiter !== "none" && grammar2.plusIndex && body.endsWith("+")) {
    const candidate = body.slice(0, -1).trimEnd();
    if (grammar2.registers.includes(candidate.toLowerCase())) {
      postIncrement = true;
      body = candidate;
    }
  }
  if (delimiter !== "none") {
    const inside = operandParts(body, grammar2.commaIndex ? "," : "+");
    if (inside.length === 2 && grammar2.indexRegisters.includes(inside[1].text.toLowerCase())) {
      if (index) {
        const address3 = scalar(inside[0].text, offset + inside[0].start, force);
        return {
          kind: "memory",
          address: address3,
          delimiter,
          index,
          innerIndex: inside[1].text.toLowerCase(),
          span
        };
      }
      index = {
        register: inside[1].text.toLowerCase(),
        position: "inside",
        separator: grammar2.commaIndex ? "," : "+"
      };
      body = inside[0].text;
      offset += inside[0].start;
    }
  }
  let bit;
  const bitMatch = grammar2.bitSelectors ? /\.([0-7])$/.exec(body) : void 0;
  if (bitMatch) {
    bit = { selector: scalar(bitMatch[1], offset + body.length - 1), inverted };
    body = body.slice(0, bitMatch.index).trimEnd();
  }
  const register = body.toLowerCase();
  const address2 = delimiter !== "none" && grammar2.registers.includes(register) ? {
    kind: "register",
    name: register,
    span: { start: offset, end: offset + body.length }
  } : scalar(body, offset, force);
  return {
    kind: "memory",
    address: address2,
    delimiter,
    span,
    ...index ? { index } : {},
    ...postIncrement ? { postIncrement } : {},
    ...bit ? { bit } : {}
  };
}

// packages/core/src/plugin/contracts.ts
var PLUGIN_API_VERSION = 2;
function definePlugin(plugin2) {
  return plugin2;
}

// packages/core/src/decoder-types.ts
var Uint8ArrayDecoderSource = class {
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

// packages/plugin-65xx/src/ca65-profile.ts
var CA65_65XX_SESSION_STATE_ID = "65xx.ca65-session-state";
function isSessionStateKey(value) {
  return value.id.length > 0;
}
function createSessionStateKey(id) {
  const key = { id };
  if (!isSessionStateKey(key)) {
    throw new Error(`Invalid session state key '${id}'.`);
  }
  return key;
}
var ca65SessionStateKey = createSessionStateKey(
  CA65_65XX_SESSION_STATE_ID
);
function createCa65SessionState() {
  return {
    defaultArchitecture: "65xx.6502",
    currentArchitecture: "65xx.6502",
    cpuStack: [],
    scopeStack: [],
    segmentStack: [],
    currentFlatSegment: ""
  };
}
function cloneCa65SessionState(state) {
  return {
    ...state,
    cpuStack: [...state.cpuStack],
    scopeStack: [...state.scopeStack],
    segmentStack: [...state.segmentStack]
  };
}
function resetCa65StageState(state) {
  state.currentArchitecture = state.defaultArchitecture;
  state.cpuStack = [];
  state.scopeStack = [];
  state.segmentStack = [];
  state.currentFlatSegment = "";
}
var ca65CpuNames = Object.freeze({
  "6502": "65xx.6502",
  "6502x": "65xx.6502x",
  "2a03": "65xx.2a03",
  "2a07": "65xx.2a03",
  "6502dtv": "65xx.6502dtv",
  "65sc02": "65xx.65sc02",
  "65c02": "65xx.65c02",
  w65c02: "65xx.w65c02",
  "65ce02": "65xx.65ce02",
  "4510": "65xx.4510",
  "45gs02": "65xx.45gs02",
  huc6280: "65xx.huc6280",
  m740: "65xx.m740"
});
function resolve65xxCpuName(name) {
  return ca65CpuNames[name.trim().toLowerCase()];
}
var ca65CpuShorthands = Object.freeze({
  p02: "6502",
  p02x: "6502x",
  pdtv: "6502dtv",
  psc02: "65sc02",
  pc02: "65c02",
  pwc02: "w65c02",
  pce02: "65ce02",
  p4510: "4510",
  p45gs02: "45gs02",
  p6280: "huc6280",
  pm740: "m740"
});
var cpuPredicateSymbols = Object.freeze({
  ifp02: "__CA65_CPU_6502__",
  ifp02x: "__CA65_CPU_6502X__",
  ifpdtv: "__CA65_CPU_6502DTV__",
  ifpsc02: "__CA65_CPU_65SC02__",
  ifpc02: "__CA65_CPU_65C02__",
  ifpwc02: "__CA65_CPU_W65C02__",
  ifpce02: "__CA65_CPU_65CE02__",
  ifp4510: "__CA65_CPU_4510__",
  ifp45gs02: "__CA65_CPU_45GS02__",
  ifp6280: "__CA65_CPU_HUC6280__",
  ifpm740: "__CA65_CPU_M740__"
});
var ca65CpuPredicateByArchitecture = Object.freeze({
  "65xx.6502": "__CA65_CPU_6502__",
  "65xx.6502x": "__CA65_CPU_6502X__",
  "65xx.2a03": "__CA65_CPU_6502X__",
  "65xx.6502dtv": "__CA65_CPU_6502DTV__",
  "65xx.65sc02": "__CA65_CPU_65SC02__",
  "65xx.65c02": "__CA65_CPU_65C02__",
  "65xx.w65c02": "__CA65_CPU_W65C02__",
  "65xx.65ce02": "__CA65_CPU_65CE02__",
  "65xx.4510": "__CA65_CPU_4510__",
  "65xx.45gs02": "__CA65_CPU_45GS02__",
  "65xx.huc6280": "__CA65_CPU_HUC6280__",
  "65xx.m740": "__CA65_CPU_M740__"
});
function splitArguments(value) {
  const parts2 = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < value.length; index++) {
    const character = value[index];
    if (character === "(") {
      depth++;
    } else if (character === ")") {
      depth--;
    } else if (character === "," && depth === 0) {
      parts2.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }
  parts2.push(value.slice(start).trim());
  return parts2.filter(Boolean);
}
function rewriteScopedNames(value) {
  let result = "";
  let quote = "";
  for (let index = 0; index < value.length; index++) {
    const character = value[index];
    if ((character === '"' || character === "'") && value[index - 1] !== "\\") {
      quote = quote === character ? "" : quote || character;
    }
    if (!quote && character === ":" && value[index + 1] === ":") {
      result += "_";
      index++;
    } else {
      result += character;
    }
  }
  return result;
}
function rewriteCa65Command(command, context) {
  let rewritten = rewriteScopedNames(command);
  rewritten = rewritten.replace(/\.(defined|lobyte|hibyte|bankbyte|loword|hiword)\s*\(/gi, "$1(");
  rewritten = rewritten.replace(
    /(^|[^\w@])@([0-7]+)\b/g,
    (_match, prefix, digits) => `${prefix}${Number.parseInt(digits, 8)}`
  );
  rewritten = rewritten.replace(/<>/g, "!=");
  const match = rewritten.match(/^(\s*)\.([\dA-Za-z]+)\b(.*)$/);
  if (!match) {
    return rewritten;
  }
  const [, indent, rawKeyword, rawRest] = match;
  const keyword = rawKeyword.toLowerCase();
  const rest = rawRest.trim();
  const predicate = cpuPredicateSymbols[keyword];
  if (predicate) {
    return `${indent}if ${predicate}`;
  }
  if (["if", "elseif", "else", "endif"].includes(keyword)) {
    return `${indent}${keyword}${rest ? ` ${rest}` : ""}`;
  }
  if (keyword === "ifdef") {
    return `${indent}if defined(${rest})`;
  }
  if (keyword === "ifndef") {
    return `${indent}if defined(${rest}) == 0`;
  }
  if (keyword === "macro") {
    const header = rest.match(/^([A-Z_a-z]\w*)\s*(.*)$/);
    if (!header) {
      return rewritten;
    }
    const params = splitArguments(header[2]).join(",");
    return `${indent}macro ${header[1]}(${params})`;
  }
  if (keyword === "endmacro") {
    return `${indent}endmacro`;
  }
  if (keyword === "repeat") {
    const [count = "0", variable = `__ca65_repeat_${context.sourceLine}`] = splitArguments(rest);
    return `${indent}for ${variable} = 0..(${count})`;
  }
  if (keyword === "endrepeat") {
    return `${indent}endfor`;
  }
  if (keyword === "undefine") {
    return `${indent}undef ${rest}`;
  }
  return rewritten;
}
var CA65_65XX_SYNTAX_PROFILE = Object.freeze({
  ...CA65_SYNTAX_PROFILE,
  id: "ca65-65xx",
  rewriteCommand: rewriteCa65Command,
  bareMacroInvocations: true,
  macroParameterPrefix: "\\"
});

// packages/plugin-65xx/src/instructions/schema.ts
function matchesFeatures(expression, features) {
  if (expression.allOf?.some((feature) => !features.has(feature))) {
    return false;
  }
  if (expression.anyOf && !expression.anyOf.some((feature) => features.has(feature))) {
    return false;
  }
  if (expression.noneOf?.some((feature) => features.has(feature))) {
    return false;
  }
  return true;
}
function getOperandCodec(mode2) {
  switch (mode2) {
    case "implied":
    case "accumulator":
    case "quadAccumulator":
      return "none";
    case "absolute":
    case "absoluteIndexedX":
    case "absoluteIndexedY":
    case "indirect":
    case "absoluteIndexedIndirect":
      return "unsigned16-le";
    case "absoluteLongIndexedX":
      return "unsigned24-le";
    case "relative":
      return "relative8";
    case "relative16":
      return "relative16";
    case "zeroPageRelative":
      return "zero-page-relative8";
    case "accumulatorRelative":
      return "accumulator-relative8";
    case "zeroPageImmediate":
      return "zero-page-immediate8";
    case "specialPage":
      return "special-page";
    case "blockTransfer":
      return "three-unsigned16-le";
    case "immediateZeroPage":
    case "immediateZeroPageIndexedX":
      return "immediate-unsigned8";
    case "immediateAbsolute":
    case "immediateAbsoluteIndexedX":
      return "immediate-unsigned16";
    case "immediate":
    case "zeroPage":
    case "zeroPageIndexedX":
    case "zeroPageIndexedY":
    case "zeroPageIndirect":
    case "zeroPageIndirectLong":
    case "indexedIndirectX":
    case "indirectIndexedY":
    case "zeroPageIndirectIndexedZ":
    case "stackRelative":
    case "stackRelativeIndirectIndexedY":
    case "basePageIndirectIndexedZ":
      return "unsigned8";
  }
  const leftover = mode2;
  throw new Error(`Unsupported addressing mode: ${String(leftover)}`);
}
function getOperandFields(codec) {
  switch (codec) {
    case "none":
      return [];
    case "unsigned16-le":
      return [{ name: "address", width: 2 }];
    case "unsigned24-le":
      return [{ name: "address", width: 3 }];
    case "relative8":
      return [{ name: "target", width: 1, signed: true, relative: true }];
    case "relative16":
      return [{ name: "target", width: 2, signed: true, relative: true }];
    case "zero-page-relative8":
      return [
        { name: "address", width: 1 },
        { name: "target", width: 1, signed: true, relative: true }
      ];
    case "accumulator-relative8":
      return [{ name: "target", width: 1, signed: true, relative: true }];
    case "zero-page-immediate8":
      return [
        { name: "address", width: 1 },
        { name: "value", width: 1 }
      ];
    case "special-page":
      return [{ name: "address", width: 1 }];
    case "three-unsigned16-le":
      return [
        { name: "source", width: 2 },
        { name: "destination", width: 2 },
        { name: "length", width: 2 }
      ];
    case "immediate-unsigned8":
      return [
        { name: "value", width: 1 },
        { name: "address", width: 1 }
      ];
    case "immediate-unsigned16":
      return [
        { name: "value", width: 1 },
        { name: "address", width: 2 }
      ];
    case "unsigned8":
      return [{ name: "value", width: 1 }];
  }
  return [];
}

// packages/plugin-65xx/src/instructions/variant-tables.generated.ts
var ca65EaTable = [
  [
    0,
    0,
    5,
    13,
    15,
    21,
    29,
    31,
    0,
    25,
    18,
    0,
    7,
    17,
    23,
    1,
    0,
    0,
    0,
    3,
    19,
    9,
    0,
    9,
    0,
    0,
    0,
    0,
    0,
    0,
    18,
    0
  ],
  [
    8,
    8,
    4,
    12,
    0,
    20,
    28,
    0,
    20,
    28,
    0,
    128,
    0,
    16,
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
    128,
    0,
    0,
    0,
    0,
    0
  ],
  [
    0,
    0,
    36,
    44,
    15,
    52,
    60,
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
    137,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0
  ],
  [
    58,
    58,
    198,
    206,
    0,
    214,
    222,
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
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0
  ],
  [
    26,
    26,
    230,
    238,
    0,
    246,
    254,
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
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0
  ],
  [
    0,
    0,
    96,
    152,
    0,
    112,
    158,
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
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0
  ],
  [
    0,
    0,
    0,
    0,
    16,
    0,
    0,
    0,
    0,
    0,
    0,
    32,
    0,
    0,
    0,
    0,
    48,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    144,
    0,
    0,
    0,
    0,
    0
  ],
  [
    0,
    0,
    0,
    0,
    2,
    0,
    0,
    0,
    0,
    0,
    0,
    2,
    0,
    0,
    0,
    0,
    220,
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
    0
  ],
  [
    0,
    64,
    1,
    65,
    0,
    9,
    73,
    0,
    0,
    0,
    0,
    81,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    64,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0
  ],
  [
    0,
    0,
    0,
    16,
    0,
    32,
    48,
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
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0
  ],
  [
    234,
    0,
    4,
    12,
    0,
    20,
    28,
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
    128,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0
  ],
  [
    8,
    8,
    4,
    12,
    0,
    20,
    28,
    0,
    20,
    28,
    0,
    128,
    0,
    16,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    8,
    0,
    0,
    128,
    0,
    0,
    0,
    0,
    0
  ],
  [
    0,
    0,
    0,
    76,
    0,
    0,
    0,
    0,
    0,
    0,
    178,
    108,
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
    0,
    0,
    0,
    0
  ],
  [
    0,
    0,
    5,
    13,
    0,
    0,
    0,
    0,
    0,
    0,
    18,
    0,
    18,
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
    0,
    18,
    0
  ],
  [
    10,
    10,
    6,
    14,
    0,
    22,
    30,
    0,
    0,
    0,
    18,
    0,
    18,
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
    0,
    0,
    10
  ],
  [
    3,
    3,
    4,
    12,
    0,
    20,
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
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    3
  ]
];
var ca65VariantTables = {
  "4510": [
    ["ADC", 8431212, 96, 0, "PutAll"],
    ["AND", 8431212, 32, 0, "PutAll"],
    ["ASL", 110, 2, 1, "PutAll"],
    ["ASR", 38, 67, 0, "Put4510"],
    ["ASW", 8, 203, 6, "PutAll"],
    ["BBR0", 0, 15, 0, "PutBitBranch"],
    ["BBR1", 0, 31, 0, "PutBitBranch"],
    ["BBR2", 0, 47, 0, "PutBitBranch"],
    ["BBR3", 0, 63, 0, "PutBitBranch"],
    ["BBR4", 0, 79, 0, "PutBitBranch"],
    ["BBR5", 0, 95, 0, "PutBitBranch"],
    ["BBR6", 0, 111, 0, "PutBitBranch"],
    ["BBR7", 0, 127, 0, "PutBitBranch"],
    ["BBS0", 0, 143, 0, "PutBitBranch"],
    ["BBS1", 0, 159, 0, "PutBitBranch"],
    ["BBS2", 0, 175, 0, "PutBitBranch"],
    ["BBS3", 0, 191, 0, "PutBitBranch"],
    ["BBS4", 0, 207, 0, "PutBitBranch"],
    ["BBS5", 0, 223, 0, "PutBitBranch"],
    ["BBS6", 0, 239, 0, "PutBitBranch"],
    ["BBS7", 0, 255, 0, "PutBitBranch"],
    ["BCC", 131072, 144, 0, "PutPCRel8"],
    ["BCS", 131072, 176, 0, "PutPCRel8"],
    ["BEQ", 131072, 240, 0, "PutPCRel8"],
    ["BIT", 10485868, 0, 2, "PutAll"],
    ["BMI", 131072, 48, 0, "PutPCRel8"],
    ["BNE", 131072, 208, 0, "PutPCRel8"],
    ["BPL", 131072, 16, 0, "PutPCRel8"],
    ["BRA", 131072, 128, 0, "PutPCRel8"],
    ["BRK", 8388613, 0, 6, "PutAll"],
    ["BSR", 262144, 99, 0, "PutPCRel4510"],
    ["BVC", 131072, 80, 0, "PutPCRel8"],
    ["BVS", 131072, 112, 0, "PutPCRel8"],
    ["CLC", 1, 24, 0, "PutAll"],
    ["CLD", 1, 216, 0, "PutAll"],
    ["CLE", 1, 2, 0, "PutAll"],
    ["CLI", 1, 88, 0, "PutAll"],
    ["CLV", 1, 184, 0, "PutAll"],
    ["CMP", 8431212, 192, 0, "PutAll"],
    ["CPX", 8388620, 224, 1, "PutAll"],
    ["CPY", 8388620, 192, 1, "PutAll"],
    ["CPZ", 8388620, 208, 1, "Put4510"],
    ["DEA", 1, 0, 3, "PutAll"],
    ["DEC", 111, 0, 3, "PutAll"],
    ["DEW", 4, 195, 9, "PutAll"],
    ["DEX", 1, 202, 0, "PutAll"],
    ["DEY", 1, 136, 0, "PutAll"],
    ["DEZ", 1, 59, 0, "PutAll"],
    ["EOM", 1, 234, 0, "PutAll"],
    ["EOR", 8431212, 64, 0, "PutAll"],
    ["INA", 1, 0, 4, "PutAll"],
    ["INC", 111, 0, 4, "PutAll"],
    ["INW", 4, 227, 9, "PutAll"],
    ["INX", 1, 232, 0, "PutAll"],
    ["INY", 1, 200, 0, "PutAll"],
    ["INZ", 1, 27, 0, "PutAll"],
    ["JMP", 67592, 76, 6, "PutAll"],
    ["JSR", 67592, 32, 7, "Put4510"],
    ["LBCC", 262144, 147, 0, "PutPCRel4510"],
    ["LBCS", 262144, 179, 0, "PutPCRel4510"],
    ["LBEQ", 262144, 243, 0, "PutPCRel4510"],
    ["LBMI", 262144, 51, 0, "PutPCRel4510"],
    ["LBNE", 262144, 211, 0, "PutPCRel4510"],
    ["LBPL", 262144, 19, 0, "PutPCRel4510"],
    ["LBRA", 262144, 131, 0, "PutPCRel4510"],
    ["LBVC", 262144, 83, 0, "PutPCRel4510"],
    ["LBVS", 262144, 115, 0, "PutPCRel4510"],
    ["LDA", 9479788, 160, 0, "Put4510"],
    ["LDX", 8389388, 162, 1, "PutAll"],
    ["LDY", 8388716, 160, 1, "PutAll"],
    ["LDZ", 8388680, 163, 1, "Put4510"],
    ["LSR", 111, 66, 1, "PutAll"],
    ["MAP", 1, 92, 0, "PutAll"],
    ["NEG", 1, 66, 0, "PutAll"],
    ["NOP", 1, 234, 0, "PutAll"],
    ["ORA", 8431212, 0, 0, "PutAll"],
    ["PHA", 1, 72, 0, "PutAll"],
    ["PHD", 134217736, 244, 1, "PutAll"],
    ["PHP", 1, 8, 0, "PutAll"],
    ["PHW", 134217736, 244, 1, "PutAll"],
    ["PHX", 1, 218, 0, "PutAll"],
    ["PHY", 1, 90, 0, "PutAll"],
    ["PHZ", 1, 219, 0, "PutAll"],
    ["PLA", 1, 104, 0, "PutAll"],
    ["PLP", 1, 40, 0, "PutAll"],
    ["PLX", 1, 250, 0, "PutAll"],
    ["PLY", 1, 122, 0, "PutAll"],
    ["PLZ", 1, 251, 0, "PutAll"],
    ["RMB0", 4, 7, 1, "PutAll"],
    ["RMB1", 4, 23, 1, "PutAll"],
    ["RMB2", 4, 39, 1, "PutAll"],
    ["RMB3", 4, 55, 1, "PutAll"],
    ["RMB4", 4, 71, 1, "PutAll"],
    ["RMB5", 4, 87, 1, "PutAll"],
    ["RMB6", 4, 103, 1, "PutAll"],
    ["RMB7", 4, 119, 1, "PutAll"],
    ["ROL", 111, 34, 1, "PutAll"],
    ["ROR", 111, 98, 1, "PutAll"],
    ["ROW", 8, 235, 6, "PutAll"],
    ["RTI", 1, 64, 0, "PutAll"],
    ["RTN", 8388608, 98, 1, "PutAll"],
    ["RTS", 1, 96, 0, "PutAll"],
    ["SBC", 8431212, 224, 0, "PutAll"],
    ["SEC", 1, 56, 0, "PutAll"],
    ["SED", 1, 248, 0, "PutAll"],
    ["SEE", 1, 3, 0, "PutAll"],
    ["SEI", 1, 120, 0, "PutAll"],
    ["SMB0", 4, 135, 1, "PutAll"],
    ["SMB1", 4, 151, 1, "PutAll"],
    ["SMB2", 4, 167, 1, "PutAll"],
    ["SMB3", 4, 183, 1, "PutAll"],
    ["SMB4", 4, 199, 1, "PutAll"],
    ["SMB5", 4, 215, 1, "PutAll"],
    ["SMB6", 4, 231, 1, "PutAll"],
    ["SMB7", 4, 247, 1, "PutAll"],
    ["STA", 1091180, 128, 0, "Put4510"],
    ["STX", 780, 130, 1, "Put4510"],
    ["STY", 108, 128, 1, "Put4510"],
    ["STZ", 108, 4, 5, "PutAll"],
    ["TAB", 1, 91, 0, "PutAll"],
    ["TAX", 1, 170, 0, "PutAll"],
    ["TAY", 1, 168, 0, "PutAll"],
    ["TAZ", 1, 75, 0, "PutAll"],
    ["TBA", 1, 123, 0, "PutAll"],
    ["TRB", 12, 16, 1, "PutAll"],
    ["TSB", 12, 0, 1, "PutAll"],
    ["TSX", 1, 186, 0, "PutAll"],
    ["TSY", 1, 11, 0, "PutAll"],
    ["TXA", 1, 138, 0, "PutAll"],
    ["TXS", 1, 154, 0, "PutAll"],
    ["TYA", 1, 152, 0, "PutAll"],
    ["TYS", 1, 43, 0, "PutAll"],
    ["TZA", 1, 107, 0, "PutAll"]
  ],
  "6502DTV": [
    ["ADC", 8430188, 96, 0, "PutAll"],
    ["ALR", 8388608, 75, 0, "PutAll"],
    ["ANC", 8388608, 11, 0, "PutAll"],
    ["AND", 8430188, 32, 0, "PutAll"],
    ["ANE", 8388608, 139, 0, "PutAll"],
    ["ARR", 8388608, 107, 0, "PutAll"],
    ["ASL", 110, 2, 1, "PutAll"],
    ["AXS", 8388608, 203, 0, "PutAll"],
    ["BCC", 131072, 144, 0, "PutPCRel8"],
    ["BCS", 131072, 176, 0, "PutPCRel8"],
    ["BEQ", 131072, 240, 0, "PutPCRel8"],
    ["BIT", 12, 0, 2, "PutAll"],
    ["BMI", 131072, 48, 0, "PutPCRel8"],
    ["BNE", 131072, 208, 0, "PutPCRel8"],
    ["BPL", 131072, 16, 0, "PutPCRel8"],
    ["BRA", 131072, 18, 0, "PutPCRel8"],
    ["BRK", 8388613, 0, 6, "PutAll"],
    ["BVC", 131072, 80, 0, "PutPCRel8"],
    ["BVS", 131072, 112, 0, "PutPCRel8"],
    ["CLC", 1, 24, 0, "PutAll"],
    ["CLD", 1, 216, 0, "PutAll"],
    ["CLI", 1, 88, 0, "PutAll"],
    ["CLV", 1, 184, 0, "PutAll"],
    ["CMP", 8430188, 192, 0, "PutAll"],
    ["CPX", 8388620, 224, 1, "PutAll"],
    ["CPY", 8388620, 192, 1, "PutAll"],
    ["DEC", 108, 0, 3, "PutAll"],
    ["DEX", 1, 202, 0, "PutAll"],
    ["DEY", 1, 136, 0, "PutAll"],
    ["EOR", 8430188, 64, 0, "PutAll"],
    ["INC", 108, 0, 4, "PutAll"],
    ["INX", 1, 232, 0, "PutAll"],
    ["INY", 1, 200, 0, "PutAll"],
    ["JMP", 2056, 76, 6, "PutJMP"],
    ["JSR", 8, 32, 7, "PutAll"],
    ["LAS", 512, 187, 0, "PutAll"],
    ["LAX", 8430348, 163, 11, "PutAll"],
    ["LDA", 8430188, 160, 0, "PutAll"],
    ["LDX", 8389388, 162, 1, "PutAll"],
    ["LDY", 8388716, 160, 1, "PutAll"],
    ["LSR", 111, 66, 1, "PutAll"],
    ["NOP", 8388717, 0, 10, "PutAll"],
    ["ORA", 8430188, 0, 0, "PutAll"],
    ["PHA", 1, 72, 0, "PutAll"],
    ["PHP", 1, 8, 0, "PutAll"],
    ["PLA", 1, 104, 0, "PutAll"],
    ["PLP", 1, 40, 0, "PutAll"],
    ["RLA", 41580, 35, 0, "PutAll"],
    ["ROL", 111, 34, 1, "PutAll"],
    ["ROR", 111, 98, 1, "PutAll"],
    ["RRA", 41580, 99, 0, "PutAll"],
    ["RTI", 1, 64, 0, "PutAll"],
    ["RTS", 1, 96, 0, "PutAll"],
    ["SAC", 8388608, 50, 1, "PutAll"],
    ["SBC", 8430188, 224, 0, "PutAll"],
    ["SEC", 1, 56, 0, "PutAll"],
    ["SED", 1, 248, 0, "PutAll"],
    ["SEI", 1, 120, 0, "PutAll"],
    ["SHA", 8704, 147, 1, "PutAll"],
    ["SHX", 512, 158, 1, "PutAll"],
    ["SHY", 64, 156, 1, "PutAll"],
    ["SIR", 8388608, 66, 1, "PutAll"],
    ["STA", 41580, 128, 0, "PutAll"],
    ["STX", 268, 130, 1, "PutAll"],
    ["STY", 44, 128, 1, "PutAll"],
    ["TAX", 1, 170, 0, "PutAll"],
    ["TAY", 1, 168, 0, "PutAll"],
    ["TSX", 1, 186, 0, "PutAll"],
    ["TXA", 1, 138, 0, "PutAll"],
    ["TXS", 1, 154, 0, "PutAll"],
    ["TYA", 1, 152, 0, "PutAll"]
  ],
  "65SC02": [
    ["ADC", 8431212, 96, 0, "PutAll"],
    ["AND", 8431212, 32, 0, "PutAll"],
    ["ASL", 110, 2, 1, "PutAll"],
    ["BCC", 131072, 144, 0, "PutPCRel8"],
    ["BCS", 131072, 176, 0, "PutPCRel8"],
    ["BEQ", 131072, 240, 0, "PutPCRel8"],
    ["BIT", 10485868, 0, 2, "PutAll"],
    ["BMI", 131072, 48, 0, "PutPCRel8"],
    ["BNE", 131072, 208, 0, "PutPCRel8"],
    ["BPL", 131072, 16, 0, "PutPCRel8"],
    ["BRA", 131072, 128, 0, "PutPCRel8"],
    ["BRK", 8388613, 0, 6, "PutAll"],
    ["BVC", 131072, 80, 0, "PutPCRel8"],
    ["BVS", 131072, 112, 0, "PutPCRel8"],
    ["CLC", 1, 24, 0, "PutAll"],
    ["CLD", 1, 216, 0, "PutAll"],
    ["CLI", 1, 88, 0, "PutAll"],
    ["CLV", 1, 184, 0, "PutAll"],
    ["CMP", 8431212, 192, 0, "PutAll"],
    ["CPX", 8388620, 224, 1, "PutAll"],
    ["CPY", 8388620, 192, 1, "PutAll"],
    ["DEA", 1, 0, 3, "PutAll"],
    ["DEC", 111, 0, 3, "PutAll"],
    ["DEX", 1, 202, 0, "PutAll"],
    ["DEY", 1, 136, 0, "PutAll"],
    ["EOR", 8431212, 64, 0, "PutAll"],
    ["INA", 1, 0, 4, "PutAll"],
    ["INC", 111, 0, 4, "PutAll"],
    ["INX", 1, 232, 0, "PutAll"],
    ["INY", 1, 200, 0, "PutAll"],
    ["JMP", 67592, 76, 6, "PutAll"],
    ["JSR", 8, 32, 7, "PutAll"],
    ["LDA", 8431212, 160, 0, "PutAll"],
    ["LDX", 8389388, 162, 1, "PutAll"],
    ["LDY", 8388716, 160, 1, "PutAll"],
    ["LSR", 111, 66, 1, "PutAll"],
    ["NOP", 1, 234, 0, "PutAll"],
    ["ORA", 8431212, 0, 0, "PutAll"],
    ["PHA", 1, 72, 0, "PutAll"],
    ["PHP", 1, 8, 0, "PutAll"],
    ["PHX", 1, 218, 0, "PutAll"],
    ["PHY", 1, 90, 0, "PutAll"],
    ["PLA", 1, 104, 0, "PutAll"],
    ["PLP", 1, 40, 0, "PutAll"],
    ["PLX", 1, 250, 0, "PutAll"],
    ["PLY", 1, 122, 0, "PutAll"],
    ["ROL", 111, 34, 1, "PutAll"],
    ["ROR", 111, 98, 1, "PutAll"],
    ["RTI", 1, 64, 0, "PutAll"],
    ["RTS", 1, 96, 0, "PutAll"],
    ["SBC", 8431212, 224, 0, "PutAll"],
    ["SEC", 1, 56, 0, "PutAll"],
    ["SED", 1, 248, 0, "PutAll"],
    ["SEI", 1, 120, 0, "PutAll"],
    ["STA", 42604, 128, 0, "PutAll"],
    ["STX", 268, 130, 1, "PutAll"],
    ["STY", 44, 128, 1, "PutAll"],
    ["STZ", 108, 4, 5, "PutAll"],
    ["TAX", 1, 170, 0, "PutAll"],
    ["TAY", 1, 168, 0, "PutAll"],
    ["TRB", 12, 16, 1, "PutAll"],
    ["TSB", 12, 0, 1, "PutAll"],
    ["TSX", 1, 186, 0, "PutAll"],
    ["TXA", 1, 138, 0, "PutAll"],
    ["TXS", 1, 154, 0, "PutAll"],
    ["TYA", 1, 152, 0, "PutAll"]
  ],
  "65C02": [
    ["ADC", 8431212, 96, 0, "PutAll"],
    ["AND", 8431212, 32, 0, "PutAll"],
    ["ASL", 110, 2, 1, "PutAll"],
    ["BBR0", 0, 15, 0, "PutBitBranch"],
    ["BBR1", 0, 31, 0, "PutBitBranch"],
    ["BBR2", 0, 47, 0, "PutBitBranch"],
    ["BBR3", 0, 63, 0, "PutBitBranch"],
    ["BBR4", 0, 79, 0, "PutBitBranch"],
    ["BBR5", 0, 95, 0, "PutBitBranch"],
    ["BBR6", 0, 111, 0, "PutBitBranch"],
    ["BBR7", 0, 127, 0, "PutBitBranch"],
    ["BBS0", 0, 143, 0, "PutBitBranch"],
    ["BBS1", 0, 159, 0, "PutBitBranch"],
    ["BBS2", 0, 175, 0, "PutBitBranch"],
    ["BBS3", 0, 191, 0, "PutBitBranch"],
    ["BBS4", 0, 207, 0, "PutBitBranch"],
    ["BBS5", 0, 223, 0, "PutBitBranch"],
    ["BBS6", 0, 239, 0, "PutBitBranch"],
    ["BBS7", 0, 255, 0, "PutBitBranch"],
    ["BCC", 131072, 144, 0, "PutPCRel8"],
    ["BCS", 131072, 176, 0, "PutPCRel8"],
    ["BEQ", 131072, 240, 0, "PutPCRel8"],
    ["BIT", 10485868, 0, 2, "PutAll"],
    ["BMI", 131072, 48, 0, "PutPCRel8"],
    ["BNE", 131072, 208, 0, "PutPCRel8"],
    ["BPL", 131072, 16, 0, "PutPCRel8"],
    ["BRA", 131072, 128, 0, "PutPCRel8"],
    ["BRK", 8388613, 0, 6, "PutAll"],
    ["BVC", 131072, 80, 0, "PutPCRel8"],
    ["BVS", 131072, 112, 0, "PutPCRel8"],
    ["CLC", 1, 24, 0, "PutAll"],
    ["CLD", 1, 216, 0, "PutAll"],
    ["CLI", 1, 88, 0, "PutAll"],
    ["CLV", 1, 184, 0, "PutAll"],
    ["CMP", 8431212, 192, 0, "PutAll"],
    ["CPX", 8388620, 224, 1, "PutAll"],
    ["CPY", 8388620, 192, 1, "PutAll"],
    ["DEA", 1, 0, 3, "PutAll"],
    ["DEC", 111, 0, 3, "PutAll"],
    ["DEX", 1, 202, 0, "PutAll"],
    ["DEY", 1, 136, 0, "PutAll"],
    ["EOR", 8431212, 64, 0, "PutAll"],
    ["INA", 1, 0, 4, "PutAll"],
    ["INC", 111, 0, 4, "PutAll"],
    ["INX", 1, 232, 0, "PutAll"],
    ["INY", 1, 200, 0, "PutAll"],
    ["JMP", 67592, 76, 6, "PutAll"],
    ["JSR", 8, 32, 7, "PutAll"],
    ["LDA", 8431212, 160, 0, "PutAll"],
    ["LDX", 8389388, 162, 1, "PutAll"],
    ["LDY", 8388716, 160, 1, "PutAll"],
    ["LSR", 111, 66, 1, "PutAll"],
    ["NOP", 1, 234, 0, "PutAll"],
    ["ORA", 8431212, 0, 0, "PutAll"],
    ["PHA", 1, 72, 0, "PutAll"],
    ["PHP", 1, 8, 0, "PutAll"],
    ["PHX", 1, 218, 0, "PutAll"],
    ["PHY", 1, 90, 0, "PutAll"],
    ["PLA", 1, 104, 0, "PutAll"],
    ["PLP", 1, 40, 0, "PutAll"],
    ["PLX", 1, 250, 0, "PutAll"],
    ["PLY", 1, 122, 0, "PutAll"],
    ["RMB0", 4, 7, 1, "PutAll"],
    ["RMB1", 4, 23, 1, "PutAll"],
    ["RMB2", 4, 39, 1, "PutAll"],
    ["RMB3", 4, 55, 1, "PutAll"],
    ["RMB4", 4, 71, 1, "PutAll"],
    ["RMB5", 4, 87, 1, "PutAll"],
    ["RMB6", 4, 103, 1, "PutAll"],
    ["RMB7", 4, 119, 1, "PutAll"],
    ["ROL", 111, 34, 1, "PutAll"],
    ["ROR", 111, 98, 1, "PutAll"],
    ["RTI", 1, 64, 0, "PutAll"],
    ["RTS", 1, 96, 0, "PutAll"],
    ["SBC", 8431212, 224, 0, "PutAll"],
    ["SEC", 1, 56, 0, "PutAll"],
    ["SED", 1, 248, 0, "PutAll"],
    ["SEI", 1, 120, 0, "PutAll"],
    ["SMB0", 4, 135, 1, "PutAll"],
    ["SMB1", 4, 151, 1, "PutAll"],
    ["SMB2", 4, 167, 1, "PutAll"],
    ["SMB3", 4, 183, 1, "PutAll"],
    ["SMB4", 4, 199, 1, "PutAll"],
    ["SMB5", 4, 215, 1, "PutAll"],
    ["SMB6", 4, 231, 1, "PutAll"],
    ["SMB7", 4, 247, 1, "PutAll"],
    ["STA", 42604, 128, 0, "PutAll"],
    ["STX", 268, 130, 1, "PutAll"],
    ["STY", 44, 128, 1, "PutAll"],
    ["STZ", 108, 4, 5, "PutAll"],
    ["TAX", 1, 170, 0, "PutAll"],
    ["TAY", 1, 168, 0, "PutAll"],
    ["TRB", 12, 16, 1, "PutAll"],
    ["TSB", 12, 0, 1, "PutAll"],
    ["TSX", 1, 186, 0, "PutAll"],
    ["TXA", 1, 138, 0, "PutAll"],
    ["TXS", 1, 154, 0, "PutAll"],
    ["TYA", 1, 152, 0, "PutAll"]
  ],
  W65C02: [
    ["ADC", 8431212, 96, 0, "PutAll"],
    ["AND", 8431212, 32, 0, "PutAll"],
    ["ASL", 110, 2, 1, "PutAll"],
    ["BBR0", 0, 15, 0, "PutBitBranch"],
    ["BBR1", 0, 31, 0, "PutBitBranch"],
    ["BBR2", 0, 47, 0, "PutBitBranch"],
    ["BBR3", 0, 63, 0, "PutBitBranch"],
    ["BBR4", 0, 79, 0, "PutBitBranch"],
    ["BBR5", 0, 95, 0, "PutBitBranch"],
    ["BBR6", 0, 111, 0, "PutBitBranch"],
    ["BBR7", 0, 127, 0, "PutBitBranch"],
    ["BBS0", 0, 143, 0, "PutBitBranch"],
    ["BBS1", 0, 159, 0, "PutBitBranch"],
    ["BBS2", 0, 175, 0, "PutBitBranch"],
    ["BBS3", 0, 191, 0, "PutBitBranch"],
    ["BBS4", 0, 207, 0, "PutBitBranch"],
    ["BBS5", 0, 223, 0, "PutBitBranch"],
    ["BBS6", 0, 239, 0, "PutBitBranch"],
    ["BBS7", 0, 255, 0, "PutBitBranch"],
    ["BCC", 131072, 144, 0, "PutPCRel8"],
    ["BCS", 131072, 176, 0, "PutPCRel8"],
    ["BEQ", 131072, 240, 0, "PutPCRel8"],
    ["BIT", 10485868, 0, 2, "PutAll"],
    ["BMI", 131072, 48, 0, "PutPCRel8"],
    ["BNE", 131072, 208, 0, "PutPCRel8"],
    ["BPL", 131072, 16, 0, "PutPCRel8"],
    ["BRA", 131072, 128, 0, "PutPCRel8"],
    ["BRK", 8388613, 0, 6, "PutAll"],
    ["BVC", 131072, 80, 0, "PutPCRel8"],
    ["BVS", 131072, 112, 0, "PutPCRel8"],
    ["CLC", 1, 24, 0, "PutAll"],
    ["CLD", 1, 216, 0, "PutAll"],
    ["CLI", 1, 88, 0, "PutAll"],
    ["CLV", 1, 184, 0, "PutAll"],
    ["CMP", 8431212, 192, 0, "PutAll"],
    ["CPX", 8388620, 224, 1, "PutAll"],
    ["CPY", 8388620, 192, 1, "PutAll"],
    ["DEA", 1, 0, 3, "PutAll"],
    ["DEC", 111, 0, 3, "PutAll"],
    ["DEX", 1, 202, 0, "PutAll"],
    ["DEY", 1, 136, 0, "PutAll"],
    ["EOR", 8431212, 64, 0, "PutAll"],
    ["INA", 1, 0, 4, "PutAll"],
    ["INC", 111, 0, 4, "PutAll"],
    ["INX", 1, 232, 0, "PutAll"],
    ["INY", 1, 200, 0, "PutAll"],
    ["JMP", 67592, 76, 6, "PutAll"],
    ["JSR", 8, 32, 7, "PutAll"],
    ["LDA", 8431212, 160, 0, "PutAll"],
    ["LDX", 8389388, 162, 1, "PutAll"],
    ["LDY", 8388716, 160, 1, "PutAll"],
    ["LSR", 111, 66, 1, "PutAll"],
    ["NOP", 1, 234, 0, "PutAll"],
    ["ORA", 8431212, 0, 0, "PutAll"],
    ["PHA", 1, 72, 0, "PutAll"],
    ["PHP", 1, 8, 0, "PutAll"],
    ["PHX", 1, 218, 0, "PutAll"],
    ["PHY", 1, 90, 0, "PutAll"],
    ["PLA", 1, 104, 0, "PutAll"],
    ["PLP", 1, 40, 0, "PutAll"],
    ["PLX", 1, 250, 0, "PutAll"],
    ["PLY", 1, 122, 0, "PutAll"],
    ["RMB0", 4, 7, 1, "PutAll"],
    ["RMB1", 4, 23, 1, "PutAll"],
    ["RMB2", 4, 39, 1, "PutAll"],
    ["RMB3", 4, 55, 1, "PutAll"],
    ["RMB4", 4, 71, 1, "PutAll"],
    ["RMB5", 4, 87, 1, "PutAll"],
    ["RMB6", 4, 103, 1, "PutAll"],
    ["RMB7", 4, 119, 1, "PutAll"],
    ["ROL", 111, 34, 1, "PutAll"],
    ["ROR", 111, 98, 1, "PutAll"],
    ["RTI", 1, 64, 0, "PutAll"],
    ["RTS", 1, 96, 0, "PutAll"],
    ["SBC", 8431212, 224, 0, "PutAll"],
    ["SEC", 1, 56, 0, "PutAll"],
    ["SED", 1, 248, 0, "PutAll"],
    ["SEI", 1, 120, 0, "PutAll"],
    ["SMB0", 4, 135, 1, "PutAll"],
    ["SMB1", 4, 151, 1, "PutAll"],
    ["SMB2", 4, 167, 1, "PutAll"],
    ["SMB3", 4, 183, 1, "PutAll"],
    ["SMB4", 4, 199, 1, "PutAll"],
    ["SMB5", 4, 215, 1, "PutAll"],
    ["SMB6", 4, 231, 1, "PutAll"],
    ["SMB7", 4, 247, 1, "PutAll"],
    ["STA", 42604, 128, 0, "PutAll"],
    ["STP", 1, 219, 0, "PutAll"],
    ["STX", 268, 130, 1, "PutAll"],
    ["STY", 44, 128, 1, "PutAll"],
    ["STZ", 108, 4, 5, "PutAll"],
    ["TAX", 1, 170, 0, "PutAll"],
    ["TAY", 1, 168, 0, "PutAll"],
    ["TRB", 12, 16, 1, "PutAll"],
    ["TSB", 12, 0, 1, "PutAll"],
    ["TSX", 1, 186, 0, "PutAll"],
    ["TXA", 1, 138, 0, "PutAll"],
    ["TXS", 1, 154, 0, "PutAll"],
    ["TYA", 1, 152, 0, "PutAll"],
    ["WAI", 1, 203, 0, "PutAll"]
  ],
  "65CE02": [
    ["ADC", 8431212, 96, 0, "PutAll"],
    ["AND", 8431212, 32, 0, "PutAll"],
    ["ASL", 110, 2, 1, "PutAll"],
    ["ASR", 38, 67, 0, "Put4510"],
    ["ASW", 8, 203, 6, "PutAll"],
    ["AUG", 1, 92, 0, "PutAll"],
    ["BBR0", 0, 15, 0, "PutBitBranch"],
    ["BBR1", 0, 31, 0, "PutBitBranch"],
    ["BBR2", 0, 47, 0, "PutBitBranch"],
    ["BBR3", 0, 63, 0, "PutBitBranch"],
    ["BBR4", 0, 79, 0, "PutBitBranch"],
    ["BBR5", 0, 95, 0, "PutBitBranch"],
    ["BBR6", 0, 111, 0, "PutBitBranch"],
    ["BBR7", 0, 127, 0, "PutBitBranch"],
    ["BBS0", 0, 143, 0, "PutBitBranch"],
    ["BBS1", 0, 159, 0, "PutBitBranch"],
    ["BBS2", 0, 175, 0, "PutBitBranch"],
    ["BBS3", 0, 191, 0, "PutBitBranch"],
    ["BBS4", 0, 207, 0, "PutBitBranch"],
    ["BBS5", 0, 223, 0, "PutBitBranch"],
    ["BBS6", 0, 239, 0, "PutBitBranch"],
    ["BBS7", 0, 255, 0, "PutBitBranch"],
    ["BCC", 131072, 144, 0, "PutPCRel8"],
    ["BCS", 131072, 176, 0, "PutPCRel8"],
    ["BEQ", 131072, 240, 0, "PutPCRel8"],
    ["BIT", 10485868, 0, 2, "PutAll"],
    ["BMI", 131072, 48, 0, "PutPCRel8"],
    ["BNE", 131072, 208, 0, "PutPCRel8"],
    ["BPL", 131072, 16, 0, "PutPCRel8"],
    ["BRA", 131072, 128, 0, "PutPCRel8"],
    ["BRK", 8388613, 0, 6, "PutAll"],
    ["BSR", 262144, 99, 0, "PutPCRel4510"],
    ["BVC", 131072, 80, 0, "PutPCRel8"],
    ["BVS", 131072, 112, 0, "PutPCRel8"],
    ["CLC", 1, 24, 0, "PutAll"],
    ["CLD", 1, 216, 0, "PutAll"],
    ["CLE", 1, 2, 0, "PutAll"],
    ["CLI", 1, 88, 0, "PutAll"],
    ["CLV", 1, 184, 0, "PutAll"],
    ["CMP", 8431212, 192, 0, "PutAll"],
    ["CPX", 8388620, 224, 1, "PutAll"],
    ["CPY", 8388620, 192, 1, "PutAll"],
    ["CPZ", 8388620, 208, 1, "Put4510"],
    ["DEA", 1, 0, 3, "PutAll"],
    ["DEC", 111, 0, 3, "PutAll"],
    ["DEW", 4, 195, 9, "PutAll"],
    ["DEX", 1, 202, 0, "PutAll"],
    ["DEY", 1, 136, 0, "PutAll"],
    ["DEZ", 1, 59, 0, "PutAll"],
    ["EOM", 1, 234, 0, "PutAll"],
    ["EOR", 8431212, 64, 0, "PutAll"],
    ["INA", 1, 0, 4, "PutAll"],
    ["INC", 111, 0, 4, "PutAll"],
    ["INW", 4, 227, 9, "PutAll"],
    ["INX", 1, 232, 0, "PutAll"],
    ["INY", 1, 200, 0, "PutAll"],
    ["INZ", 1, 27, 0, "PutAll"],
    ["JMP", 67592, 76, 6, "PutAll"],
    ["JSR", 67592, 32, 7, "Put4510"],
    ["LBCC", 262144, 147, 0, "PutPCRel4510"],
    ["LBCS", 262144, 179, 0, "PutPCRel4510"],
    ["LBEQ", 262144, 243, 0, "PutPCRel4510"],
    ["LBMI", 262144, 51, 0, "PutPCRel4510"],
    ["LBNE", 262144, 211, 0, "PutPCRel4510"],
    ["LBPL", 262144, 19, 0, "PutPCRel4510"],
    ["LBRA", 262144, 131, 0, "PutPCRel4510"],
    ["LBVC", 262144, 83, 0, "PutPCRel4510"],
    ["LBVS", 262144, 115, 0, "PutPCRel4510"],
    ["LDA", 9479788, 160, 0, "Put4510"],
    ["LDX", 8389388, 162, 1, "PutAll"],
    ["LDY", 8388716, 160, 1, "PutAll"],
    ["LDZ", 8388680, 163, 1, "Put4510"],
    ["LSR", 111, 66, 1, "PutAll"],
    ["NEG", 1, 66, 0, "PutAll"],
    ["NOP", 1, 234, 0, "PutAll"],
    ["ORA", 8431212, 0, 0, "PutAll"],
    ["PHA", 1, 72, 0, "PutAll"],
    ["PHD", 134217736, 244, 1, "PutAll"],
    ["PHP", 1, 8, 0, "PutAll"],
    ["PHW", 134217736, 244, 1, "PutAll"],
    ["PHX", 1, 218, 0, "PutAll"],
    ["PHY", 1, 90, 0, "PutAll"],
    ["PHZ", 1, 219, 0, "PutAll"],
    ["PLA", 1, 104, 0, "PutAll"],
    ["PLP", 1, 40, 0, "PutAll"],
    ["PLX", 1, 250, 0, "PutAll"],
    ["PLY", 1, 122, 0, "PutAll"],
    ["PLZ", 1, 251, 0, "PutAll"],
    ["RMB0", 4, 7, 1, "PutAll"],
    ["RMB1", 4, 23, 1, "PutAll"],
    ["RMB2", 4, 39, 1, "PutAll"],
    ["RMB3", 4, 55, 1, "PutAll"],
    ["RMB4", 4, 71, 1, "PutAll"],
    ["RMB5", 4, 87, 1, "PutAll"],
    ["RMB6", 4, 103, 1, "PutAll"],
    ["RMB7", 4, 119, 1, "PutAll"],
    ["ROL", 111, 34, 1, "PutAll"],
    ["ROR", 111, 98, 1, "PutAll"],
    ["ROW", 8, 235, 6, "PutAll"],
    ["RTI", 1, 64, 0, "PutAll"],
    ["RTN", 8388608, 98, 1, "PutAll"],
    ["RTS", 1, 96, 0, "PutAll"],
    ["SBC", 8431212, 224, 0, "PutAll"],
    ["SEC", 1, 56, 0, "PutAll"],
    ["SED", 1, 248, 0, "PutAll"],
    ["SEE", 1, 3, 0, "PutAll"],
    ["SEI", 1, 120, 0, "PutAll"],
    ["SMB0", 4, 135, 1, "PutAll"],
    ["SMB1", 4, 151, 1, "PutAll"],
    ["SMB2", 4, 167, 1, "PutAll"],
    ["SMB3", 4, 183, 1, "PutAll"],
    ["SMB4", 4, 199, 1, "PutAll"],
    ["SMB5", 4, 215, 1, "PutAll"],
    ["SMB6", 4, 231, 1, "PutAll"],
    ["SMB7", 4, 247, 1, "PutAll"],
    ["STA", 1091180, 128, 0, "Put4510"],
    ["STX", 780, 130, 1, "Put4510"],
    ["STY", 108, 128, 1, "Put4510"],
    ["STZ", 108, 4, 5, "PutAll"],
    ["TAB", 1, 91, 0, "PutAll"],
    ["TAX", 1, 170, 0, "PutAll"],
    ["TAY", 1, 168, 0, "PutAll"],
    ["TAZ", 1, 75, 0, "PutAll"],
    ["TBA", 1, 123, 0, "PutAll"],
    ["TRB", 12, 16, 1, "PutAll"],
    ["TSB", 12, 0, 1, "PutAll"],
    ["TSX", 1, 186, 0, "PutAll"],
    ["TSY", 1, 11, 0, "PutAll"],
    ["TXA", 1, 138, 0, "PutAll"],
    ["TXS", 1, 154, 0, "PutAll"],
    ["TYA", 1, 152, 0, "PutAll"],
    ["TYS", 1, 43, 0, "PutAll"],
    ["TZA", 1, 107, 0, "PutAll"]
  ],
  "45GS02": [
    ["ADC", 1082173036, 96, 0, "Put45GS02"],
    ["ADCQ", 5132, 96, 13, "Put45GS02_Q"],
    ["AND", 1082173036, 32, 0, "Put45GS02"],
    ["ANDQ", 5132, 32, 13, "Put45GS02_Q"],
    ["ASL", 110, 2, 1, "PutAll"],
    ["ASLQ", 2147483886, 0, 14, "Put45GS02_Q"],
    ["ASR", 38, 67, 0, "Put4510"],
    ["ASRQ", 2147483686, 64, 15, "Put45GS02_Q"],
    ["ASW", 8, 203, 6, "PutAll"],
    ["BBR0", 0, 15, 0, "PutBitBranch"],
    ["BBR1", 0, 31, 0, "PutBitBranch"],
    ["BBR2", 0, 47, 0, "PutBitBranch"],
    ["BBR3", 0, 63, 0, "PutBitBranch"],
    ["BBR4", 0, 79, 0, "PutBitBranch"],
    ["BBR5", 0, 95, 0, "PutBitBranch"],
    ["BBR6", 0, 111, 0, "PutBitBranch"],
    ["BBR7", 0, 127, 0, "PutBitBranch"],
    ["BBS0", 0, 143, 0, "PutBitBranch"],
    ["BBS1", 0, 159, 0, "PutBitBranch"],
    ["BBS2", 0, 175, 0, "PutBitBranch"],
    ["BBS3", 0, 191, 0, "PutBitBranch"],
    ["BBS4", 0, 207, 0, "PutBitBranch"],
    ["BBS5", 0, 223, 0, "PutBitBranch"],
    ["BBS6", 0, 239, 0, "PutBitBranch"],
    ["BBS7", 0, 255, 0, "PutBitBranch"],
    ["BCC", 131072, 144, 0, "PutPCRel8"],
    ["BCS", 131072, 176, 0, "PutPCRel8"],
    ["BEQ", 131072, 240, 0, "PutPCRel8"],
    ["BIT", 10485868, 0, 2, "PutAll"],
    ["BITQ", 12, 32, 15, "Put45GS02_Q"],
    ["BMI", 131072, 48, 0, "PutPCRel8"],
    ["BNE", 131072, 208, 0, "PutPCRel8"],
    ["BPL", 131072, 16, 0, "PutPCRel8"],
    ["BRA", 131072, 128, 0, "PutPCRel8"],
    ["BRK", 1, 0, 0, "PutAll"],
    ["BSR", 262144, 99, 0, "PutPCRel4510"],
    ["BVC", 131072, 80, 0, "PutPCRel8"],
    ["BVS", 131072, 112, 0, "PutPCRel8"],
    ["CLC", 1, 24, 0, "PutAll"],
    ["CLD", 1, 216, 0, "PutAll"],
    ["CLE", 1, 2, 0, "PutAll"],
    ["CLI", 1, 88, 0, "PutAll"],
    ["CLV", 1, 184, 0, "PutAll"],
    ["CMP", 1082173036, 192, 0, "Put45GS02"],
    ["CMPQ", 5132, 192, 13, "Put45GS02_Q"],
    ["CPX", 8388620, 224, 1, "PutAll"],
    ["CPY", 8388620, 192, 1, "PutAll"],
    ["CPZ", 8388620, 208, 1, "Put4510"],
    ["DEA", 1, 0, 3, "PutAll"],
    ["DEC", 111, 0, 3, "PutAll"],
    ["DEQ", 2147483886, 192, 14, "Put45GS02_Q"],
    ["DEW", 4, 195, 9, "PutAll"],
    ["DEX", 1, 202, 0, "PutAll"],
    ["DEY", 1, 136, 0, "PutAll"],
    ["DEZ", 1, 59, 0, "PutAll"],
    ["EOM", 1, 234, 0, "PutAll"],
    ["EOR", 1082173036, 64, 0, "Put45GS02"],
    ["EORQ", 5132, 64, 13, "Put45GS02_Q"],
    ["INA", 1, 0, 4, "PutAll"],
    ["INC", 111, 0, 4, "PutAll"],
    ["INQ", 2147483886, 224, 14, "Put45GS02_Q"],
    ["INW", 4, 227, 9, "PutAll"],
    ["INX", 1, 232, 0, "PutAll"],
    ["INY", 1, 200, 0, "PutAll"],
    ["INZ", 1, 27, 0, "PutAll"],
    ["JMP", 67592, 76, 6, "PutAll"],
    ["JSR", 67592, 32, 7, "Put4510"],
    ["LBCC", 262144, 147, 0, "PutPCRel4510"],
    ["LBCS", 262144, 179, 0, "PutPCRel4510"],
    ["LBEQ", 262144, 243, 0, "PutPCRel4510"],
    ["LBMI", 262144, 51, 0, "PutPCRel4510"],
    ["LBNE", 262144, 211, 0, "PutPCRel4510"],
    ["LBPL", 262144, 19, 0, "PutPCRel4510"],
    ["LBRA", 262144, 131, 0, "PutPCRel4510"],
    ["LBVC", 262144, 83, 0, "PutPCRel4510"],
    ["LBVS", 262144, 115, 0, "PutPCRel4510"],
    ["LDA", 1083221612, 160, 0, "Put45GS02"],
    ["LDQ", 1073746956, 160, 13, "Put45GS02_Q"],
    ["LDX", 8389388, 162, 1, "PutAll"],
    ["LDY", 8388716, 160, 1, "PutAll"],
    ["LDZ", 8388680, 163, 1, "Put4510"],
    ["LSR", 111, 66, 1, "PutAll"],
    ["LSRQ", 2147483886, 64, 14, "Put45GS02_Q"],
    ["MAP", 1, 92, 0, "PutAll"],
    ["NEG", 1, 66, 0, "PutAll"],
    ["NOP", 1, 234, 0, "PutAll"],
    ["ORA", 1082173036, 0, 0, "Put45GS02"],
    ["ORQ", 5132, 0, 13, "Put45GS02_Q"],
    ["PHA", 1, 72, 0, "PutAll"],
    ["PHD", 134217736, 244, 1, "PutAll"],
    ["PHP", 1, 8, 0, "PutAll"],
    ["PHW", 134217736, 244, 1, "PutAll"],
    ["PHX", 1, 218, 0, "PutAll"],
    ["PHY", 1, 90, 0, "PutAll"],
    ["PHZ", 1, 219, 0, "PutAll"],
    ["PLA", 1, 104, 0, "PutAll"],
    ["PLP", 1, 40, 0, "PutAll"],
    ["PLX", 1, 250, 0, "PutAll"],
    ["PLY", 1, 122, 0, "PutAll"],
    ["PLZ", 1, 251, 0, "PutAll"],
    ["RMB0", 4, 7, 1, "PutAll"],
    ["RMB1", 4, 23, 1, "PutAll"],
    ["RMB2", 4, 39, 1, "PutAll"],
    ["RMB3", 4, 55, 1, "PutAll"],
    ["RMB4", 4, 71, 1, "PutAll"],
    ["RMB5", 4, 87, 1, "PutAll"],
    ["RMB6", 4, 103, 1, "PutAll"],
    ["RMB7", 4, 119, 1, "PutAll"],
    ["ROL", 111, 34, 1, "PutAll"],
    ["ROLQ", 2147483886, 32, 14, "Put45GS02_Q"],
    ["ROR", 111, 98, 1, "PutAll"],
    ["RORQ", 2147483886, 96, 14, "Put45GS02_Q"],
    ["ROW", 8, 235, 6, "PutAll"],
    ["RTI", 1, 64, 0, "PutAll"],
    ["RTN", 8388608, 98, 1, "PutAll"],
    ["RTS", 1, 96, 0, "PutAll"],
    ["SBC", 1082173036, 224, 0, "Put45GS02"],
    ["SBCQ", 5132, 224, 13, "Put45GS02_Q"],
    ["SEC", 1, 56, 0, "PutAll"],
    ["SED", 1, 248, 0, "PutAll"],
    ["SEE", 1, 3, 0, "PutAll"],
    ["SEI", 1, 120, 0, "PutAll"],
    ["SMB0", 4, 135, 1, "PutAll"],
    ["SMB1", 4, 151, 1, "PutAll"],
    ["SMB2", 4, 167, 1, "PutAll"],
    ["SMB3", 4, 183, 1, "PutAll"],
    ["SMB4", 4, 199, 1, "PutAll"],
    ["SMB5", 4, 215, 1, "PutAll"],
    ["SMB6", 4, 231, 1, "PutAll"],
    ["SMB7", 4, 247, 1, "PutAll"],
    ["STA", 1074833004, 128, 0, "Put45GS02"],
    ["STQ", 5132, 128, 13, "Put45GS02_Q"],
    ["STX", 780, 130, 1, "Put4510"],
    ["STY", 108, 128, 1, "Put4510"],
    ["STZ", 108, 4, 5, "PutAll"],
    ["TAB", 1, 91, 0, "PutAll"],
    ["TAX", 1, 170, 0, "PutAll"],
    ["TAY", 1, 168, 0, "PutAll"],
    ["TAZ", 1, 75, 0, "PutAll"],
    ["TBA", 1, 123, 0, "PutAll"],
    ["TRB", 12, 16, 1, "PutAll"],
    ["TSB", 12, 0, 1, "PutAll"],
    ["TSX", 1, 186, 0, "PutAll"],
    ["TSY", 1, 11, 0, "PutAll"],
    ["TXA", 1, 138, 0, "PutAll"],
    ["TXS", 1, 154, 0, "PutAll"],
    ["TYA", 1, 152, 0, "PutAll"],
    ["TYS", 1, 43, 0, "PutAll"],
    ["TZA", 1, 107, 0, "PutAll"]
  ],
  HuC6280: [
    ["ADC", 8431212, 96, 0, "PutAll"],
    ["AND", 8431212, 32, 0, "PutAll"],
    ["ASL", 110, 2, 1, "PutAll"],
    ["BBR0", 0, 15, 0, "PutBitBranch"],
    ["BBR1", 0, 31, 0, "PutBitBranch"],
    ["BBR2", 0, 47, 0, "PutBitBranch"],
    ["BBR3", 0, 63, 0, "PutBitBranch"],
    ["BBR4", 0, 79, 0, "PutBitBranch"],
    ["BBR5", 0, 95, 0, "PutBitBranch"],
    ["BBR6", 0, 111, 0, "PutBitBranch"],
    ["BBR7", 0, 127, 0, "PutBitBranch"],
    ["BBS0", 0, 143, 0, "PutBitBranch"],
    ["BBS1", 0, 159, 0, "PutBitBranch"],
    ["BBS2", 0, 175, 0, "PutBitBranch"],
    ["BBS3", 0, 191, 0, "PutBitBranch"],
    ["BBS4", 0, 207, 0, "PutBitBranch"],
    ["BBS5", 0, 223, 0, "PutBitBranch"],
    ["BBS6", 0, 239, 0, "PutBitBranch"],
    ["BBS7", 0, 255, 0, "PutBitBranch"],
    ["BCC", 131072, 144, 0, "PutPCRel8"],
    ["BCS", 131072, 176, 0, "PutPCRel8"],
    ["BEQ", 131072, 240, 0, "PutPCRel8"],
    ["BIT", 10485868, 0, 2, "PutAll"],
    ["BMI", 131072, 48, 0, "PutPCRel8"],
    ["BNE", 131072, 208, 0, "PutPCRel8"],
    ["BPL", 131072, 16, 0, "PutPCRel8"],
    ["BRA", 131072, 128, 0, "PutPCRel8"],
    ["BRK", 8388613, 0, 6, "PutAll"],
    ["BSR", 131072, 68, 0, "PutPCRel8"],
    ["BVC", 131072, 80, 0, "PutPCRel8"],
    ["BVS", 131072, 112, 0, "PutPCRel8"],
    ["CLA", 1, 98, 0, "PutAll"],
    ["CLC", 1, 24, 0, "PutAll"],
    ["CLD", 1, 216, 0, "PutAll"],
    ["CLI", 1, 88, 0, "PutAll"],
    ["CLV", 1, 184, 0, "PutAll"],
    ["CLX", 1, 130, 0, "PutAll"],
    ["CLY", 1, 194, 0, "PutAll"],
    ["CMP", 8431212, 192, 0, "PutAll"],
    ["CPX", 8388620, 224, 1, "PutAll"],
    ["CPY", 8388620, 192, 1, "PutAll"],
    ["CSH", 1, 212, 0, "PutAll"],
    ["CSL", 1, 84, 0, "PutAll"],
    ["DEA", 1, 0, 3, "PutAll"],
    ["DEC", 111, 0, 3, "PutAll"],
    ["DEX", 1, 202, 0, "PutAll"],
    ["DEY", 1, 136, 0, "PutAll"],
    ["EOR", 8431212, 64, 0, "PutAll"],
    ["INA", 1, 0, 4, "PutAll"],
    ["INC", 111, 0, 4, "PutAll"],
    ["INX", 1, 232, 0, "PutAll"],
    ["INY", 1, 200, 0, "PutAll"],
    ["JMP", 67592, 76, 6, "PutAll"],
    ["JSR", 8, 32, 7, "PutAll"],
    ["LDA", 8431212, 160, 0, "PutAll"],
    ["LDX", 8389388, 162, 1, "PutAll"],
    ["LDY", 8388716, 160, 1, "PutAll"],
    ["LSR", 111, 66, 1, "PutAll"],
    ["NOP", 1, 234, 0, "PutAll"],
    ["ORA", 8431212, 0, 0, "PutAll"],
    ["PHA", 1, 72, 0, "PutAll"],
    ["PHP", 1, 8, 0, "PutAll"],
    ["PHX", 1, 218, 0, "PutAll"],
    ["PHY", 1, 90, 0, "PutAll"],
    ["PLA", 1, 104, 0, "PutAll"],
    ["PLP", 1, 40, 0, "PutAll"],
    ["PLX", 1, 250, 0, "PutAll"],
    ["PLY", 1, 122, 0, "PutAll"],
    ["RMB0", 4, 7, 1, "PutAll"],
    ["RMB1", 4, 23, 1, "PutAll"],
    ["RMB2", 4, 39, 1, "PutAll"],
    ["RMB3", 4, 55, 1, "PutAll"],
    ["RMB4", 4, 71, 1, "PutAll"],
    ["RMB5", 4, 87, 1, "PutAll"],
    ["RMB6", 4, 103, 1, "PutAll"],
    ["RMB7", 4, 119, 1, "PutAll"],
    ["ROL", 111, 34, 1, "PutAll"],
    ["ROR", 111, 98, 1, "PutAll"],
    ["RTI", 1, 64, 0, "PutAll"],
    ["RTS", 1, 96, 0, "PutAll"],
    ["SAX", 1, 34, 0, "PutAll"],
    ["SAY", 1, 66, 0, "PutAll"],
    ["SBC", 8431212, 224, 0, "PutAll"],
    ["SEC", 1, 56, 0, "PutAll"],
    ["SED", 1, 248, 0, "PutAll"],
    ["SEI", 1, 120, 0, "PutAll"],
    ["SET", 1, 244, 0, "PutAll"],
    ["SMB0", 4, 135, 1, "PutAll"],
    ["SMB1", 4, 151, 1, "PutAll"],
    ["SMB2", 4, 167, 1, "PutAll"],
    ["SMB3", 4, 183, 1, "PutAll"],
    ["SMB4", 4, 199, 1, "PutAll"],
    ["SMB5", 4, 215, 1, "PutAll"],
    ["SMB6", 4, 231, 1, "PutAll"],
    ["SMB7", 4, 247, 1, "PutAll"],
    ["ST0", 8388608, 3, 1, "PutAll"],
    ["ST1", 8388608, 19, 1, "PutAll"],
    ["ST2", 8388608, 35, 1, "PutAll"],
    ["STA", 42604, 128, 0, "PutAll"],
    ["STX", 268, 130, 1, "PutAll"],
    ["STY", 44, 128, 1, "PutAll"],
    ["STZ", 108, 4, 5, "PutAll"],
    ["SXY", 1, 2, 0, "PutAll"],
    ["TAI", 33554432, 243, 0, "PutBlockTransfer"],
    ["TAM", 8388608, 83, 1, "PutAll"],
    ["TAM0", 1, 1, 0, "PutTAMn"],
    ["TAM1", 1, 2, 0, "PutTAMn"],
    ["TAM2", 1, 4, 0, "PutTAMn"],
    ["TAM3", 1, 8, 0, "PutTAMn"],
    ["TAM4", 1, 16, 0, "PutTAMn"],
    ["TAM5", 1, 32, 0, "PutTAMn"],
    ["TAM6", 1, 64, 0, "PutTAMn"],
    ["TAM7", 1, 128, 0, "PutTAMn"],
    ["TAX", 1, 170, 0, "PutAll"],
    ["TAY", 1, 168, 0, "PutAll"],
    ["TDD", 33554432, 195, 0, "PutBlockTransfer"],
    ["TIA", 33554432, 227, 0, "PutBlockTransfer"],
    ["TII", 33554432, 115, 0, "PutBlockTransfer"],
    ["TIN", 33554432, 211, 0, "PutBlockTransfer"],
    ["TMA", 8388608, 67, 1, "PutTMA"],
    ["TMA0", 1, 1, 0, "PutTMAn"],
    ["TMA1", 1, 2, 0, "PutTMAn"],
    ["TMA2", 1, 4, 0, "PutTMAn"],
    ["TMA3", 1, 8, 0, "PutTMAn"],
    ["TMA4", 1, 16, 0, "PutTMAn"],
    ["TMA5", 1, 32, 0, "PutTMAn"],
    ["TMA6", 1, 64, 0, "PutTMAn"],
    ["TMA7", 1, 128, 0, "PutTMAn"],
    ["TRB", 12, 16, 1, "PutAll"],
    ["TSB", 12, 0, 1, "PutAll"],
    ["TST", 108, 131, 9, "PutTST"],
    ["TSX", 1, 186, 0, "PutAll"],
    ["TXA", 1, 138, 0, "PutAll"],
    ["TXS", 1, 154, 0, "PutAll"],
    ["TYA", 1, 152, 0, "PutAll"]
  ],
  M740: [
    ["ADC", 8430188, 96, 0, "PutAll"],
    ["AND", 8430188, 32, 0, "PutAll"],
    ["ASL", 110, 2, 1, "PutAll"],
    ["BBC0", 268435458, 19, 10, "PutBitBranch_m740"],
    ["BBC1", 268435458, 51, 10, "PutBitBranch_m740"],
    ["BBC2", 268435458, 83, 10, "PutBitBranch_m740"],
    ["BBC3", 268435458, 115, 10, "PutBitBranch_m740"],
    ["BBC4", 268435458, 147, 10, "PutBitBranch_m740"],
    ["BBC5", 268435458, 179, 10, "PutBitBranch_m740"],
    ["BBC6", 268435458, 211, 10, "PutBitBranch_m740"],
    ["BBC7", 268435458, 243, 10, "PutBitBranch_m740"],
    ["BBS0", 268435458, 3, 10, "PutBitBranch_m740"],
    ["BBS1", 268435458, 35, 10, "PutBitBranch_m740"],
    ["BBS2", 268435458, 67, 10, "PutBitBranch_m740"],
    ["BBS3", 268435458, 99, 10, "PutBitBranch_m740"],
    ["BBS4", 268435458, 131, 10, "PutBitBranch_m740"],
    ["BBS5", 268435458, 163, 10, "PutBitBranch_m740"],
    ["BBS6", 268435458, 195, 10, "PutBitBranch_m740"],
    ["BBS7", 268435458, 227, 10, "PutBitBranch_m740"],
    ["BCC", 131072, 144, 0, "PutPCRel8"],
    ["BCS", 131072, 176, 0, "PutPCRel8"],
    ["BEQ", 131072, 240, 0, "PutPCRel8"],
    ["BIT", 12, 0, 2, "PutAll"],
    ["BMI", 131072, 48, 0, "PutPCRel8"],
    ["BNE", 131072, 208, 0, "PutPCRel8"],
    ["BPL", 131072, 16, 0, "PutPCRel8"],
    ["BRA", 131072, 128, 0, "PutPCRel8"],
    ["BRK", 1, 0, 0, "PutAll"],
    ["BVC", 131072, 80, 0, "PutPCRel8"],
    ["BVS", 131072, 112, 0, "PutPCRel8"],
    ["CLB0", 6, 27, 10, "PutAll"],
    ["CLB1", 6, 59, 10, "PutAll"],
    ["CLB2", 6, 91, 10, "PutAll"],
    ["CLB3", 6, 123, 10, "PutAll"],
    ["CLB4", 6, 155, 10, "PutAll"],
    ["CLB5", 6, 187, 10, "PutAll"],
    ["CLB6", 6, 219, 10, "PutAll"],
    ["CLB7", 6, 251, 10, "PutAll"],
    ["CLC", 1, 24, 0, "PutAll"],
    ["CLD", 1, 216, 0, "PutAll"],
    ["CLI", 1, 88, 0, "PutAll"],
    ["CLT", 1, 18, 0, "PutAll"],
    ["CLV", 1, 184, 0, "PutAll"],
    ["CMP", 8430188, 192, 0, "PutAll"],
    ["COM", 4, 68, 1, "PutAll"],
    ["CPX", 8388620, 224, 1, "PutAll"],
    ["CPY", 8388620, 192, 1, "PutAll"],
    ["DEC", 111, 0, 3, "PutAll"],
    ["DEX", 1, 202, 0, "PutAll"],
    ["DEY", 1, 136, 0, "PutAll"],
    ["EOR", 8430188, 64, 0, "PutAll"],
    ["FST", 1, 226, 0, "PutAll"],
    ["INC", 111, 0, 4, "PutAll"],
    ["INX", 1, 232, 0, "PutAll"],
    ["INY", 1, 200, 0, "PutAll"],
    ["JMP", 3080, 0, 12, "PutAll"],
    ["JSR", 536871944, 0, 0, "PutJSR_m740"],
    ["LDA", 8430188, 160, 0, "PutAll"],
    ["LDM", 268435456, 60, 0, "PutLDM_m740"],
    ["LDX", 8389388, 162, 1, "PutAll"],
    ["LDY", 8388716, 160, 1, "PutAll"],
    ["LSR", 111, 66, 1, "PutAll"],
    ["NOP", 1, 234, 0, "PutAll"],
    ["ORA", 8430188, 0, 0, "PutAll"],
    ["PHA", 1, 72, 0, "PutAll"],
    ["PHP", 1, 8, 0, "PutAll"],
    ["PLA", 1, 104, 0, "PutAll"],
    ["PLP", 1, 40, 0, "PutAll"],
    ["RMB0", 6, 27, 10, "PutAll"],
    ["RMB1", 6, 59, 10, "PutAll"],
    ["RMB2", 6, 91, 10, "PutAll"],
    ["RMB3", 6, 123, 10, "PutAll"],
    ["RMB4", 6, 155, 10, "PutAll"],
    ["RMB5", 6, 187, 10, "PutAll"],
    ["RMB6", 6, 219, 10, "PutAll"],
    ["RMB7", 6, 251, 10, "PutAll"],
    ["ROL", 111, 34, 1, "PutAll"],
    ["ROR", 111, 98, 1, "PutAll"],
    ["RRF", 4, 130, 6, "PutAll"],
    ["RTI", 1, 64, 0, "PutAll"],
    ["RTS", 1, 96, 0, "PutAll"],
    ["SBC", 8430188, 224, 0, "PutAll"],
    ["SEB0", 6, 11, 10, "PutAll"],
    ["SEB1", 6, 43, 10, "PutAll"],
    ["SEB2", 6, 75, 10, "PutAll"],
    ["SEB3", 6, 107, 10, "PutAll"],
    ["SEB4", 6, 139, 10, "PutAll"],
    ["SEB5", 6, 171, 10, "PutAll"],
    ["SEB6", 6, 203, 10, "PutAll"],
    ["SEB7", 6, 235, 10, "PutAll"],
    ["SEC", 1, 56, 0, "PutAll"],
    ["SED", 1, 248, 0, "PutAll"],
    ["SEI", 1, 120, 0, "PutAll"],
    ["SET", 1, 50, 0, "PutAll"],
    ["SLW", 1, 194, 0, "PutAll"],
    ["STA", 41580, 128, 0, "PutAll"],
    ["STP", 1, 66, 0, "PutAll"],
    ["STX", 268, 130, 1, "PutAll"],
    ["STY", 44, 128, 1, "PutAll"],
    ["TAX", 1, 170, 0, "PutAll"],
    ["TAY", 1, 168, 0, "PutAll"],
    ["TST", 4, 100, 1, "PutAll"],
    ["TSX", 1, 186, 0, "PutAll"],
    ["TXA", 1, 138, 0, "PutAll"],
    ["TXS", 1, 154, 0, "PutAll"],
    ["TYA", 1, 152, 0, "PutAll"]
  ]
};

// packages/plugin-65xx/src/instructions/variants.ts
var commonModes = {
  0: { mode: "implied" },
  1: { mode: "accumulator" },
  2: { mode: "zeroPage" },
  3: { mode: "absolute" },
  5: { mode: "zeroPageIndexedX" },
  6: { mode: "absoluteIndexedX" },
  7: { mode: "absoluteLongIndexedX", codec: "unsigned24-le" },
  8: { mode: "zeroPageIndexedY" },
  9: { mode: "absoluteIndexedY" },
  11: { mode: "indirect" },
  12: { mode: "zeroPageIndirectLong" },
  13: { mode: "indirectIndexedY" },
  15: { mode: "indexedIndirectX" },
  16: { mode: "absoluteIndexedIndirect" },
  17: { mode: "relative" },
  18: { mode: "relative16" },
  20: { mode: "stackRelativeIndirectIndexedY" },
  21: { mode: "immediate" },
  22: { mode: "immediate" },
  23: { mode: "immediate" },
  27: { mode: "immediate", codec: "unsigned16-le" },
  30: { mode: "basePageIndirectIndexedZ" },
  31: { mode: "quadAccumulator" }
};
var featureByTable = {
  "6502DTV": "dtv",
  "65SC02": "cmos",
  "65C02": "rockwell",
  W65C02: "wdc",
  "65CE02": "ce02",
  "4510": "4510",
  "45GS02": "45gs02",
  HuC6280: "huc6280",
  M740: "m740"
};
function opcodeFor(row, modeIndex) {
  if (row[4] === "PutJSR_m740") {
    if (modeIndex === 10) {
      return 2;
    }
    if (modeIndex === 29) {
      return 34;
    }
    return 32;
  }
  if (row[4] === "PutBitBranch_m740") {
    return modeIndex === 28 ? row[2] + 4 : row[2];
  }
  if (row[4] === "PutLDM_m740") {
    return row[2];
  }
  const [, , base, eaTable] = row;
  const eaRow = eaTable >= 0 && eaTable < ca65EaTable.length ? ca65EaTable[eaTable] : void 0;
  const extension = eaRow !== void 0 && modeIndex >= 0 && modeIndex < eaRow.length ? eaRow[modeIndex] : void 0;
  if (extension === void 0) {
    throw new Error(`Missing ca65 EA table ${eaTable}/${modeIndex}.`);
  }
  let opcode = base | extension;
  if (row[4] === "Put4510" || row[4] === "Put45GS02") {
    opcode = (/* @__PURE__ */ new Map([
      [71, 68],
      [87, 84],
      [147, 130],
      [156, 139],
      [158, 155],
      [175, 171],
      [191, 187],
      [179, 226],
      [208, 194],
      [252, 35]
    ])).get(opcode) ?? opcode;
  }
  if (row[4] === "Put45GS02_Q") {
    if (opcode === 234) {
      opcode = 26;
    } else if (opcode === 202) {
      opcode = 58;
    }
  }
  return opcode;
}
function modeFor(table, row, modeIndex) {
  if (row[4] === "PutBlockTransfer" && modeIndex === 25) {
    return { mode: "blockTransfer", codec: "three-unsigned16-le" };
  }
  if (row[4] === "PutTST") {
    if (modeIndex === 2) {
      return { mode: "immediateZeroPage", codec: "immediate-unsigned8" };
    }
    if (modeIndex === 3) {
      return { mode: "immediateAbsolute", codec: "immediate-unsigned16" };
    }
    if (modeIndex === 5) {
      return { mode: "immediateZeroPageIndexedX", codec: "immediate-unsigned8" };
    }
    if (modeIndex === 6) {
      return { mode: "immediateAbsoluteIndexedX", codec: "immediate-unsigned16" };
    }
  }
  if (row[4] === "PutBitBranch_m740") {
    if (modeIndex === 1) {
      return { mode: "accumulatorRelative", codec: "accumulator-relative8" };
    }
    if (modeIndex === 28) {
      return { mode: "zeroPageRelative", codec: "zero-page-relative8" };
    }
  }
  if (row[4] === "PutLDM_m740" && modeIndex === 28) {
    return { mode: "zeroPageImmediate", codec: "zero-page-immediate8" };
  }
  if (row[4] === "PutJSR_m740" && modeIndex === 29) {
    return { mode: "specialPage", codec: "special-page" };
  }
  if (modeIndex === 10) {
    return table === "65CE02" || table === "4510" || table === "45GS02" ? { mode: "zeroPageIndirectIndexedZ" } : { mode: "zeroPageIndirect" };
  }
  return commonModes[modeIndex];
}
function createForm(table, row, modeIndex, modeDefinition) {
  let opcode = opcodeFor(row, modeIndex);
  const codec = modeDefinition.codec ?? getOperandCodec(modeDefinition.mode);
  const prefixes = [];
  if (row[4] === "PutTAMn") {
    prefixes.push(83);
    opcode = row[2];
  } else if (row[4] === "PutTMAn") {
    prefixes.push(67);
    opcode = row[2];
  } else if (row[4] === "Put45GS02_Q") {
    prefixes.push(66, 66);
    if (modeIndex === 12 || modeIndex === 30) {
      prefixes.push(234);
    }
  } else if (row[4] === "Put45GS02" && modeIndex === 30) {
    prefixes.push(234);
  }
  let relativeBaseOffset;
  if (row[4] === "PutPCRel4510") {
    relativeBaseOffset = 2;
  } else if (row[4] === "PutBitBranch_m740") {
    relativeBaseOffset = 3;
  }
  return Object.freeze({
    opcode,
    mnemonic: row[0],
    mode: modeDefinition.mode,
    encoding: [...prefixes, opcode],
    operands: getOperandFields(codec),
    codec,
    availableWhen: { allOf: [featureByTable[table]] },
    canonical: true,
    documented: true,
    stability: "documented",
    relativeBaseOffset,
    operandConstraint: row[4] === "PutTMA" ? "power-of-two" : void 0
  });
}
function decodeTable(table) {
  const forms = [];
  for (const row of ca65VariantTables[table]) {
    if (row[4] === "PutBitBranch") {
      forms.push(
        Object.freeze({
          opcode: row[2],
          mnemonic: row[0],
          mode: "zeroPageRelative",
          encoding: [row[2]],
          operands: getOperandFields("zero-page-relative8"),
          codec: "zero-page-relative8",
          availableWhen: { allOf: [featureByTable[table]] },
          canonical: true,
          documented: true,
          stability: "documented",
          relativeBaseOffset: 3
        })
      );
      continue;
    }
    if (row[4] === "PutPCRel8" || row[4] === "PutPCRel4510") {
      const modeIndex = row[4] === "PutPCRel8" ? 17 : 18;
      const modeDefinition = commonModes[modeIndex];
      if (modeDefinition) {
        forms.push(createForm(table, row, modeIndex, modeDefinition));
      }
      continue;
    }
    const seenModes = /* @__PURE__ */ new Set();
    for (let modeIndex = 0; modeIndex < 32; modeIndex++) {
      if ((row[1] & 2 ** modeIndex) === 0) {
        continue;
      }
      if (modeIndex === 0 && (row[1] & 2) !== 0) {
        continue;
      }
      const modeDefinition = modeFor(table, row, modeIndex);
      if (!modeDefinition) {
        throw new Error(`Unsupported ca65 mode bit ${modeIndex} for ${table} ${row[0]}.`);
      }
      const key = `${modeDefinition.mode}:${modeDefinition.codec ?? ""}`;
      if (seenModes.has(key)) {
        continue;
      }
      seenModes.add(key);
      forms.push(createForm(table, row, modeIndex, modeDefinition));
    }
  }
  return Object.freeze(forms);
}
var mos6502DtvForms = decodeTable("6502DTV");
var cmos65sc02Forms = decodeTable("65SC02");
var cmos65c02Forms = decodeTable("65C02");
var wdc65c02Forms = decodeTable("W65C02");
var csg65ce02Forms = decodeTable("65CE02");
var commodore4510Forms = decodeTable("4510");
var mega65Gs02Forms = decodeTable("45GS02");
var hudsonHuC6280Forms = decodeTable("HuC6280");
var mitsubishiM740Forms = decodeTable("M740");
var mos6502DtvCpu = Object.freeze({
  id: "65xx.6502dtv",
  displayName: "C64DTV 6502",
  aliases: ["6502dtv", "dtv"],
  features: /* @__PURE__ */ new Set(["nmos", "undocumented", "dtv"])
});
var cmos65sc02Cpu = Object.freeze({
  id: "65xx.65sc02",
  displayName: "65SC02",
  aliases: ["65sc02"],
  features: /* @__PURE__ */ new Set(["cmos"])
});
var cmos65c02Cpu = Object.freeze({
  id: "65xx.65c02",
  displayName: "65C02 with Rockwell extensions",
  aliases: ["65c02"],
  features: /* @__PURE__ */ new Set(["cmos", "rockwell"])
});
var wdc65c02Cpu = Object.freeze({
  id: "65xx.w65c02",
  displayName: "WDC W65C02",
  aliases: ["w65c02"],
  features: /* @__PURE__ */ new Set(["cmos", "rockwell", "wdc"])
});
var csg65ce02Cpu = Object.freeze({
  id: "65xx.65ce02",
  displayName: "CSG 65CE02",
  aliases: ["65ce02"],
  features: /* @__PURE__ */ new Set(["cmos", "rockwell", "ce02"])
});
var commodore4510Cpu = Object.freeze({
  id: "65xx.4510",
  displayName: "Commodore 4510",
  aliases: ["4510"],
  features: /* @__PURE__ */ new Set(["cmos", "rockwell", "ce02", "4510"])
});
var mega65Gs02Cpu = Object.freeze({
  id: "65xx.45gs02",
  displayName: "MEGA65 45GS02",
  aliases: ["45gs02"],
  features: /* @__PURE__ */ new Set(["cmos", "rockwell", "ce02", "4510", "45gs02"])
});
var hudsonHuC6280Cpu = Object.freeze({
  id: "65xx.huc6280",
  displayName: "Hudson HuC6280",
  aliases: ["huc6280", "6280"],
  features: /* @__PURE__ */ new Set(["cmos", "rockwell", "huc6280"])
});
var mitsubishiM740Cpu = Object.freeze({
  id: "65xx.m740",
  displayName: "Mitsubishi M740",
  aliases: ["m740", "740"],
  features: /* @__PURE__ */ new Set(["m740"])
});
var variantCpus = Object.freeze([
  mos6502DtvCpu,
  cmos65sc02Cpu,
  cmos65c02Cpu,
  wdc65c02Cpu,
  csg65ce02Cpu,
  commodore4510Cpu,
  mega65Gs02Cpu,
  hudsonHuC6280Cpu,
  mitsubishiM740Cpu
]);
var variantFormsByCpuId = Object.freeze({
  [mos6502DtvCpu.id]: mos6502DtvForms,
  [cmos65sc02Cpu.id]: cmos65sc02Forms,
  [cmos65c02Cpu.id]: cmos65c02Forms,
  [wdc65c02Cpu.id]: wdc65c02Forms,
  [csg65ce02Cpu.id]: csg65ce02Forms,
  [commodore4510Cpu.id]: commodore4510Forms,
  [mega65Gs02Cpu.id]: mega65Gs02Forms,
  [hudsonHuC6280Cpu.id]: hudsonHuC6280Forms,
  [mitsubishiM740Cpu.id]: mitsubishiM740Forms
});

// packages/plugin-65xx/src/instructions/opcodes.ts
var rows = [
  "BRK:imp ORA:inx JAM:imp SLO:inx NOP:zp ORA:zp ASL:zp SLO:zp PHP:imp ORA:imm ASL:acc ANC:imm NOP:abs ORA:abs ASL:abs SLO:abs",
  "BPL:rel ORA:iny JAM:imp SLO:iny NOP:zpx ORA:zpx ASL:zpx SLO:zpx CLC:imp ORA:aby NOP:imp SLO:aby NOP:abx ORA:abx ASL:abx SLO:abx",
  "JSR:abs AND:inx JAM:imp RLA:inx BIT:zp AND:zp ROL:zp RLA:zp PLP:imp AND:imm ROL:acc ANC:imm BIT:abs AND:abs ROL:abs RLA:abs",
  "BMI:rel AND:iny JAM:imp RLA:iny NOP:zpx AND:zpx ROL:zpx RLA:zpx SEC:imp AND:aby NOP:imp RLA:aby NOP:abx AND:abx ROL:abx RLA:abx",
  "RTI:imp EOR:inx JAM:imp SRE:inx NOP:zp EOR:zp LSR:zp SRE:zp PHA:imp EOR:imm LSR:acc ALR:imm JMP:abs EOR:abs LSR:abs SRE:abs",
  "BVC:rel EOR:iny JAM:imp SRE:iny NOP:zpx EOR:zpx LSR:zpx SRE:zpx CLI:imp EOR:aby NOP:imp SRE:aby NOP:abx EOR:abx LSR:abx SRE:abx",
  "RTS:imp ADC:inx JAM:imp RRA:inx NOP:zp ADC:zp ROR:zp RRA:zp PLA:imp ADC:imm ROR:acc ARR:imm JMP:ind ADC:abs ROR:abs RRA:abs",
  "BVS:rel ADC:iny JAM:imp RRA:iny NOP:zpx ADC:zpx ROR:zpx RRA:zpx SEI:imp ADC:aby NOP:imp RRA:aby NOP:abx ADC:abx ROR:abx RRA:abx",
  "NOP:imm STA:inx NOP:imm SAX:inx STY:zp STA:zp STX:zp SAX:zp DEY:imp NOP:imm TXA:imp ANE:imm STY:abs STA:abs STX:abs SAX:abs",
  "BCC:rel STA:iny JAM:imp SHA:iny STY:zpx STA:zpx STX:zpy SAX:zpy TYA:imp STA:aby TXS:imp TAS:aby SHY:abx STA:abx SHX:aby SHA:aby",
  "LDY:imm LDA:inx LDX:imm LAX:inx LDY:zp LDA:zp LDX:zp LAX:zp TAY:imp LDA:imm TAX:imp LAX:imm LDY:abs LDA:abs LDX:abs LAX:abs",
  "BCS:rel LDA:iny JAM:imp LAX:iny LDY:zpx LDA:zpx LDX:zpy LAX:zpy CLV:imp LDA:aby TSX:imp LAS:aby LDY:abx LDA:abx LDX:aby LAX:aby",
  "CPY:imm CMP:inx NOP:imm DCP:inx CPY:zp CMP:zp DEC:zp DCP:zp INY:imp CMP:imm DEX:imp AXS:imm CPY:abs CMP:abs DEC:abs DCP:abs",
  "BNE:rel CMP:iny JAM:imp DCP:iny NOP:zpx CMP:zpx DEC:zpx DCP:zpx CLD:imp CMP:aby NOP:imp DCP:aby NOP:abx CMP:abx DEC:abx DCP:abx",
  "CPX:imm SBC:inx NOP:imm ISC:inx CPX:zp SBC:zp INC:zp ISC:zp INX:imp SBC:imm NOP:imp SBC:imm CPX:abs SBC:abs INC:abs ISC:abs",
  "BEQ:rel SBC:iny JAM:imp ISC:iny NOP:zpx SBC:zpx INC:zpx ISC:zpx SED:imp SBC:aby NOP:imp ISC:aby NOP:abx SBC:abx INC:abx ISC:abx"
];
var modeNames = {
  imp: "implied",
  acc: "accumulator",
  imm: "immediate",
  zp: "zeroPage",
  zpx: "zeroPageIndexedX",
  zpy: "zeroPageIndexedY",
  abs: "absolute",
  abx: "absoluteIndexedX",
  aby: "absoluteIndexedY",
  ind: "indirect",
  inx: "indexedIndirectX",
  iny: "indirectIndexedY",
  rel: "relative"
};
var legalOpcodes = /* @__PURE__ */ new Set([
  0,
  1,
  5,
  6,
  8,
  9,
  10,
  13,
  14,
  16,
  17,
  21,
  22,
  24,
  25,
  29,
  30,
  32,
  33,
  36,
  37,
  38,
  40,
  41,
  42,
  44,
  45,
  46,
  48,
  49,
  53,
  54,
  56,
  57,
  61,
  62,
  64,
  65,
  69,
  70,
  72,
  73,
  74,
  76,
  77,
  78,
  80,
  81,
  85,
  86,
  88,
  89,
  93,
  94,
  96,
  97,
  101,
  102,
  104,
  105,
  106,
  108,
  109,
  110,
  112,
  113,
  117,
  118,
  120,
  121,
  125,
  126,
  129,
  132,
  133,
  134,
  136,
  138,
  140,
  141,
  142,
  144,
  145,
  148,
  149,
  150,
  152,
  153,
  154,
  157,
  160,
  161,
  162,
  164,
  165,
  166,
  168,
  169,
  170,
  172,
  173,
  174,
  176,
  177,
  180,
  181,
  182,
  184,
  185,
  186,
  188,
  189,
  190,
  192,
  193,
  196,
  197,
  198,
  200,
  201,
  202,
  204,
  205,
  206,
  208,
  209,
  213,
  214,
  216,
  217,
  221,
  222,
  224,
  225,
  228,
  229,
  230,
  232,
  233,
  234,
  236,
  237,
  238,
  240,
  241,
  245,
  246,
  248,
  249,
  253,
  254
]);
var aliases = {
  ALR: ["ASR"],
  ANC: ["AAC"],
  ANE: ["XAA"],
  AXS: ["SBX"],
  DCP: ["DCM"],
  ISC: ["ISB", "INS"],
  JAM: ["KIL", "HLT"],
  LAS: ["LAR"],
  SAX: ["AAX"],
  SHA: ["AHX"],
  SHX: ["SXA"],
  SHY: ["SYA"],
  SRE: ["LSE"],
  TAS: ["SHS"]
};
var unstable = /* @__PURE__ */ new Set([
  "ANE:immediate",
  "LAX:immediate",
  "SHA:indirectIndexedY",
  "SHA:absoluteIndexedY",
  "SHX:absoluteIndexedY",
  "SHY:absoluteIndexedX",
  "TAS:absoluteIndexedY"
]);
var decoded = rows.flatMap((row) => row.split(" "));
if (decoded.length !== 256) {
  throw new Error(`Expected 256 NMOS opcode entries, got ${decoded.length}.`);
}
var mutableForms = decoded.map((entry, opcode) => {
  const [mnemonic, shortMode] = entry.split(":");
  const mode2 = modeNames[shortMode];
  if (!mnemonic || !mode2) {
    throw new Error(`Invalid opcode table entry '${entry}' at $${opcode.toString(16)}.`);
  }
  const documented = legalOpcodes.has(opcode);
  const codec = getOperandCodec(mode2);
  const key = `${mnemonic}:${mode2}`;
  let stability = "stable-undocumented";
  if (documented) {
    stability = "documented";
  } else if (unstable.has(key)) {
    stability = "unstable-undocumented";
  }
  let note;
  if (unstable.has(key)) {
    note = "Opcode semantics are unstable or chip-dependent. Assembly emits the canonical ca65-compatible byte.";
  } else if (opcode === 108) {
    note = "NMOS hardware wraps the high-byte fetch within the same page when the indirect pointer ends in $FF.";
  }
  return {
    opcode,
    mnemonic,
    aliases: aliases[mnemonic],
    mode: mode2,
    encoding: [opcode],
    operands: getOperandFields(codec),
    codec,
    availableWhen: { allOf: documented ? ["nmos"] : ["nmos", "undocumented"] },
    canonical: false,
    documented,
    stability,
    note
  };
});
var groups = /* @__PURE__ */ new Map();
for (const form of mutableForms) {
  const key = `${form.mnemonic}:${form.mode}`;
  const group = groups.get(key) ?? [];
  group.push(form);
  groups.set(key, group);
}
for (const group of groups.values()) {
  const documented = group.find((form) => form.documented);
  const fallback = group.length > 0 ? group[0] : void 0;
  const preferred = documented ?? fallback;
  if (preferred) {
    preferred.canonical = true;
  }
}
var nmos6502DecodeTable = Object.freeze(
  mutableForms.map((form) => Object.freeze({ ...form }))
);
var brkSignatureForms = Object.freeze(
  ["immediate", "zeroPage", "absolute"].map((mode2) => ({
    opcode: 0,
    mnemonic: "BRK",
    mode: mode2,
    encoding: [0],
    operands: [{ name: "signature", width: 1 }],
    codec: "unsigned8",
    availableWhen: { allOf: ["nmos"] },
    canonical: true,
    documented: true,
    stability: "documented",
    note: "Current ca65-guide BRK signature extension. Pinned ca65 V2.19 rejects this form."
  }))
);
var nmos6502Forms = Object.freeze([
  ...nmos6502DecodeTable.filter((form) => form.documented && form.canonical),
  ...brkSignatureForms
]);
var nmos6502xForms = Object.freeze([
  ...nmos6502DecodeTable.filter((form) => form.canonical),
  ...brkSignatureForms
]);
var nmos6502Cpu = Object.freeze({
  id: "65xx.6502",
  displayName: "NMOS 6502",
  aliases: ["6502", "6510", "8502", "6507"],
  features: /* @__PURE__ */ new Set(["nmos"])
});
var nmos6502xCpu = Object.freeze({
  id: "65xx.6502x",
  displayName: "NMOS 6502 with undocumented opcodes",
  aliases: ["6502x"],
  features: /* @__PURE__ */ new Set(["nmos", "undocumented"])
});
var ricoh2a03Cpu = Object.freeze({
  id: "65xx.2a03",
  displayName: "Ricoh 2A03 / 2A07",
  aliases: ["2a03", "2a07"],
  features: /* @__PURE__ */ new Set(["nmos", "undocumented"])
});
function cpuVariantForms(cpuId) {
  return Object.hasOwn(variantFormsByCpuId, cpuId) ? variantFormsByCpuId[cpuId] : void 0;
}
function getOpcodeForm(opcode) {
  if (!Number.isInteger(opcode) || opcode < 0 || opcode > 255) {
    throw new RangeError(`Opcode ${opcode} is outside the byte range.`);
  }
  return nmos6502DecodeTable[opcode];
}
function getCpuDecodeTable(cpu) {
  const variantForms = cpuVariantForms(cpu.id);
  if (variantForms) {
    return variantForms;
  }
  return nmos6502DecodeTable.filter((form) => matchesFeatures(form.availableWhen, cpu.features));
}
function getCpuAssemblyForms(cpu) {
  const variantForms = cpuVariantForms(cpu.id);
  if (variantForms) {
    return variantForms;
  }
  return cpu.features.has("undocumented") ? nmos6502xForms : nmos6502Forms;
}

// packages/plugin-65xx/src/decoder.ts
var hex = (value, width = 2) => `$${value.toString(16).toUpperCase().padStart(width, "0")}`;
var sizeOf = (form) => form.encoding.length + form.operands.reduce((sum, field) => sum + field.width, 0);
function cpu6502Specifications(cpu) {
  return getCpuDecodeTable(cpu).map((form) => ({
    id: `${cpu.id}:${form.opcode.toString(16).padStart(2, "0")}`,
    architecture: cpu.id,
    opcode: form.encoding,
    mnemonic: form.mnemonic,
    mode: form.mode,
    minimumSize: sizeOf(form),
    maximumSize: sizeOf(form),
    summary: form.note
  }));
}
var Cpu6502Decoder = class {
  constructor(cpu = nmos6502Cpu) {
    this.cpu = cpu;
    if (!cpu.features.has("nmos") || cpu.features.has("dtv")) {
      throw new Error("The NMOS decoder requires an NMOS 6502 or Ricoh CPU profile.");
    }
    this.#forms = new Map(getCpuDecodeTable(cpu).map((form) => [form.opcode, form]));
  }
  cpu;
  #forms;
  decode(context) {
    const { source, offset, logicalAddress } = context;
    if (!Number.isInteger(logicalAddress) || logicalAddress < 0 || logicalAddress > 65535) {
      return {
        kind: "error",
        code: "invalidState",
        offset,
        message: "6502 PC must be an unsigned 16-bit address."
      };
    }
    const opcode = source.readByte(offset);
    if (opcode === void 0) {
      return {
        kind: "error",
        code: "outOfBounds",
        offset,
        message: "Opcode is outside the byte source."
      };
    }
    const form = this.#forms.get(opcode);
    if (!form) {
      return {
        kind: "error",
        code: "invalidOpcode",
        offset,
        message: `Unsupported ${this.cpu.id} opcode ${hex(opcode)}.`
      };
    }
    const size = sizeOf(form);
    const bytes = source.readBytes(offset, size);
    if (!bytes) {
      return {
        kind: "error",
        code: "truncated",
        offset,
        requiredBytes: size,
        availableBytes: Math.max(0, source.length - offset),
        message: "Truncated 6502 instruction."
      };
    }
    let value = bytes[1] ?? 0;
    if (size === 3) {
      value |= bytes[2] << 8;
    }
    const operands = [];
    const references = [];
    let flow = { kind: "fallthrough", fallthrough: true };
    if (form.mode === "relative") {
      const displacement = value >= 128 ? value - 256 : value;
      const targetAddress = logicalAddress + size + displacement & 65535;
      operands.push({
        kind: "displacement",
        value: displacement,
        width: 1,
        signed: true,
        targetAddress
      });
      references.push({ kind: "branch", address: targetAddress, operandIndex: 0 });
      flow = { kind: "conditionalBranch", fallthrough: true };
    } else if (size > 1) {
      const immediate = form.mode === "immediate";
      operands.push({ kind: immediate ? "immediate" : "address", value, width: size - 1 });
      if (!immediate) {
        const indirect = form.mode === "indirect" || form.mode === "indexedIndirectX" || form.mode === "indirectIndexedY";
        let kind = "data";
        if (form.mnemonic === "JSR") {
          kind = "call";
        }
        if (form.mnemonic === "JMP") {
          kind = "jump";
        }
        references.push({ kind, address: value, indirect, operandIndex: 0 });
      }
    } else if (form.mode === "accumulator") {
      operands.push({ kind: "accumulator", register: "a" });
    }
    if (form.mnemonic === "JSR") {
      flow = { kind: "call", fallthrough: true };
    }
    if (form.mnemonic === "JMP") {
      flow = { kind: "jump", fallthrough: false, indirect: form.mode === "indirect" };
    }
    if (form.mnemonic === "RTS" || form.mnemonic === "RTI") {
      flow = { kind: "return", fallthrough: false };
    }
    if (form.mnemonic === "BRK") {
      flow = { kind: "interrupt", fallthrough: false };
    }
    if (form.mnemonic === "JAM") {
      flow = { kind: "stop", fallthrough: false };
    }
    return {
      kind: "instruction",
      instruction: {
        architecture: this.cpu.id,
        specificationId: `${this.cpu.id}:${opcode.toString(16).padStart(2, "0")}`,
        opcode,
        mnemonic: form.mnemonic,
        mode: form.mode,
        offset,
        logicalAddress,
        bytes,
        size,
        operands,
        references,
        flow,
        effects: [{ kind: "custom", name: "nmos6502", details: { opcode } }]
      }
    };
  }
};
function formatCpu6502Instruction(instruction, addressExpression) {
  const form = getOpcodeForm(instruction.opcode);
  if (!form.canonical) {
    return `.byte ${[...instruction.bytes].map((byte) => hex(byte)).join(", ")} ; ${form.mnemonic}`;
  }
  const operand = instruction.operands[0];
  const value = operand?.value ?? 0;
  let text = "";
  let suffix = "";
  switch (form.mode) {
    case "implied":
      break;
    case "accumulator":
      text = "A";
      break;
    case "immediate":
      text = `#${hex(value)}`;
      break;
    case "relative":
      text = hex(operand.targetAddress, 4);
      break;
    case "zeroPage":
      text = addressExpression ?? hex(value);
      if (addressExpression) {
        suffix = ".b";
      }
      break;
    case "zeroPageIndexedX":
      text = `${addressExpression ?? hex(value)},X`;
      if (addressExpression) {
        suffix = ".b";
      }
      break;
    case "zeroPageIndexedY":
      text = `${addressExpression ?? hex(value)},Y`;
      if (addressExpression) {
        suffix = ".b";
      }
      break;
    case "absolute":
      text = addressExpression ?? hex(value, 4);
      suffix = ".w";
      break;
    case "absoluteIndexedX":
      text = `${addressExpression ?? hex(value, 4)},X`;
      suffix = ".w";
      break;
    case "absoluteIndexedY":
      text = `${addressExpression ?? hex(value, 4)},Y`;
      suffix = ".w";
      break;
    case "indirect":
      text = `(${addressExpression ?? hex(value, 4)})`;
      suffix = ".w";
      break;
    case "indexedIndirectX":
      text = `(${addressExpression ?? hex(value)},X)`;
      if (addressExpression) {
        suffix = ".b";
      }
      break;
    case "indirectIndexedY":
      text = `(${addressExpression ?? hex(value)}),Y`;
      break;
    // Other 65xx dialect modes cannot occur in an NMOS opcode table.
    case "absoluteIndexedIndirect":
    case "absoluteLongIndexedX":
    case "accumulatorRelative":
    case "basePageIndirectIndexedZ":
    case "blockTransfer":
    case "immediateAbsolute":
    case "immediateAbsoluteIndexedX":
    case "immediateZeroPage":
    case "immediateZeroPageIndexedX":
    case "quadAccumulator":
    case "relative16":
    case "specialPage":
    case "stackRelative":
    case "stackRelativeIndirectIndexedY":
    case "zeroPageImmediate":
    case "zeroPageIndirect":
    case "zeroPageIndirectIndexedZ":
    case "zeroPageIndirectLong":
    case "zeroPageRelative":
      throw new Error(`Unsupported NMOS mode ${form.mode}.`);
  }
  return `${form.mnemonic}${suffix}${text ? ` ${text}` : ""}`;
}

// packages/plugin-65xx/src/session-state.ts
var NES_65XX_SESSION_STATE_ID = "65xx.nes-session-state";
function isSessionStateKey2(value) {
  return value.id.length > 0;
}
function createSessionStateKey2(id) {
  const key = { id };
  if (!isSessionStateKey2(key)) {
    throw new Error(`Invalid session state key '${id}'.`);
  }
  return key;
}
var nes65xxSessionStateKey = createSessionStateKey2(NES_65XX_SESSION_STATE_ID);
function cloneNes65xxSessionState(value) {
  return {
    ...value,
    header: [...value.header],
    memoryCursors: { ...value.memoryCursors }
  };
}
function resetNes65xxStageState(state) {
  state.memoryCursors = {};
  for (const memory of state.linker.memories.values()) {
    state.memoryCursors[memory.name] = memory.start;
  }
  state.currentSegment = null;
  state.currentLoadMemory = null;
  state.segmentLoadStart = 0;
  state.segmentRunStart = 0;
}

// packages/plugin-65xx/src/directives/ca65.ts
function parameterList(words) {
  const joined = words.slice(1).join(" ");
  const parts2 = [];
  let current = "";
  let parenDepth = 0;
  let quote;
  for (const char of joined) {
    if (quote) {
      current += char;
      if (char === quote) {
        quote = void 0;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }
    if (char === "(") {
      parenDepth++;
    } else if (char === ")") {
      parenDepth--;
    }
    if (char === "," && parenDepth === 0) {
      const trimmed2 = current.trim();
      if (trimmed2) {
        parts2.push(trimmed2);
      }
      current = "";
      continue;
    }
    current += char;
  }
  const trimmed = current.trim();
  if (trimmed) {
    parts2.push(trimmed);
  }
  return parts2;
}
function markGlobalSymbol(session, name) {
  if (!name) {
    return;
  }
  const localKey = session.symbolScope.qualifySymbolName(name);
  session.globalSymbols.add(name);
  if (localKey !== name) {
    const existing = session.labelTable.get(localKey);
    if (existing) {
      session.symbolScope.setLabel(name, existing.value, existing.isStatic);
    }
  }
}
function closeActiveSegment(session, state) {
  if (!state.currentSegment) {
    return;
  }
  const segment = state.linker.segments.get(state.currentSegment);
  if (!segment) {
    state.currentSegment = null;
    return;
  }
  const size = session.currentTargetBaseAddress - state.segmentLoadStart;
  state.memoryCursors[segment.load] = session.currentTargetBaseAddress;
  if (segment.define) {
    const loadName = `__${segment.name}_LOAD__`;
    const runName = `__${segment.name}_RUN__`;
    const sizeName = `__${segment.name}_SIZE__`;
    const runEndName = `__${segment.name}_RUN_END__`;
    session.globalSymbols.add(loadName);
    session.globalSymbols.add(runName);
    session.globalSymbols.add(sizeName);
    session.globalSymbols.add(runEndName);
    session.symbolScope.setLabel(loadName, state.segmentLoadStart, true);
    session.symbolScope.setLabel(runName, state.segmentRunStart, true);
    session.symbolScope.setLabel(sizeName, size, true);
    session.symbolScope.setLabel(runEndName, state.segmentRunStart + size, true);
  }
  state.currentSegment = null;
  state.currentLoadMemory = null;
}
function applyLinkerSymbols(session, state) {
  for (const symbol of state.linker.symbols) {
    session.globalSymbols.add(symbol.name);
    const value = session.operandResolver.getnum(symbol.valueExpr);
    session.symbolScope.setLabel(symbol.name, value, true);
  }
}
function openSegment(session, state, segment) {
  const loadMemory = state.linker.memories.get(segment.load);
  const runMemory = state.linker.memories.get(segment.run);
  if (!loadMemory || !runMemory) {
    throw new Error(`.segment "${segment.name}" references unknown MEMORY.`);
  }
  const loadCursor = Object.hasOwn(state.memoryCursors, segment.load) ? state.memoryCursors[segment.load] : void 0;
  const loadStart = segment.start ?? loadCursor ?? loadMemory.start;
  session.setWritePosition(loadStart);
  const runStart = segment.run === segment.load ? loadStart : runMemory.start;
  if (runStart !== loadStart) {
    session.currentTargetAddress = runStart;
    session.currentTargetStartAddress = runStart;
  }
  state.currentSegment = segment.name;
  state.currentLoadMemory = segment.load;
  state.segmentLoadStart = loadStart;
  state.segmentRunStart = runStart;
}
function handlePushcpu(session, state) {
  state.cpuStack.push(session.resolveActiveArchitecture().name);
}
function handlePopcpu(session, state) {
  const architecture = state.cpuStack.pop();
  if (!architecture) {
    throw new Error(".popcpu: CPU stack is empty.");
  }
  session.selectArchitecture(architecture, architecture);
  state.currentArchitecture = architecture;
}
function handleEndScope(session, state) {
  const previous = state.scopeStack.pop();
  if (previous === void 0) {
    throw new Error("ca65 scope stack is empty.");
  }
  session.currentNamespace = previous;
}
function handlePushseg(state) {
  state.segmentStack.push(state.currentFlatSegment);
}
function handlePopseg(state) {
  const segment = state.segmentStack.pop();
  if (segment === void 0) {
    throw new Error(".popseg: segment stack is empty.");
  }
  state.currentFlatSegment = segment;
}

// packages/plugin-65xx/src/linker-config.ts
var DEFAULT_LINKER_CONFIG = `MEMORY {
    ROM: start = $8000, size = $8000, file = %O, fill = yes, fillval = $FF ;
}
SEGMENTS {
    CODE: load = ROM, type = ro ;
}
`;
function defaultLd65ConfigText() {
  return DEFAULT_LINKER_CONFIG;
}
function parseLd65Config(source) {
  const text = source.replace(/\/\*[\S\s]*?\*\//g, " ");
  const memories = /* @__PURE__ */ new Map();
  const segments = /* @__PURE__ */ new Map();
  const symbols = [];
  let fileOffset = 0;
  for (const statement of readBlockStatements(text, "MEMORY")) {
    const parsed = parseNamedStatement(statement);
    const start = requireNumber(parsed.attrs, "start", parsed.name);
    const size = requireNumber(parsed.attrs, "size", parsed.name);
    const file = parsed.attrs.file ?? "%O";
    const isRam = file === '""' || file === "''" || file === "";
    const region = {
      name: parsed.name,
      start,
      size,
      fileOffset: isRam ? -1 : fileOffset,
      fill: parseYesNo(parsed.attrs.fill) ?? false,
      fillval: parseNumberToken(parsed.attrs.fillval ?? "0") ?? 0
    };
    memories.set(region.name, region);
    if (!isRam) {
      fileOffset += size;
    }
  }
  for (const statement of readBlockStatements(text, "SEGMENTS")) {
    const parsed = parseNamedStatement(statement);
    const load = parsed.attrs.load;
    if (!load) {
      throw new Error(`ld65 segment '${parsed.name}' is missing load = MEMORY.`);
    }
    if (!memories.has(load)) {
      throw new Error(`ld65 segment '${parsed.name}' loads unknown memory '${load}'.`);
    }
    const run = parsed.attrs.run ?? load;
    if (!memories.has(run)) {
      throw new Error(`ld65 segment '${parsed.name}' runs in unknown memory '${run}'.`);
    }
    segments.set(parsed.name, {
      name: parsed.name,
      load,
      run,
      start: parseNumberToken(parsed.attrs.start),
      define: parseYesNo(parsed.attrs.define) ?? false,
      type: parsed.attrs.type ?? "ro"
    });
  }
  for (const statement of readBlockStatements(text, "SYMBOLS")) {
    const parsed = parseNamedStatement(statement);
    const valueExpr = parsed.attrs.value;
    if (!valueExpr) {
      throw new Error(`ld65 symbol '${parsed.name}' is missing value = EXPR.`);
    }
    symbols.push({ name: parsed.name, valueExpr });
  }
  if (memories.size === 0) {
    throw new Error("ld65 config MEMORY block is empty.");
  }
  return {
    memories,
    segments,
    symbols,
    imageSize: fileOffset
  };
}
function linkerDefinedSymbolNames(config) {
  const names = [];
  for (const segment of config.segments.values()) {
    if (!segment.define) {
      continue;
    }
    names.push(
      `__${segment.name}_LOAD__`,
      `__${segment.name}_RUN__`,
      `__${segment.name}_SIZE__`,
      `__${segment.name}_RUN_END__`
    );
  }
  for (const symbol of config.symbols) {
    names.push(symbol.name);
  }
  return names;
}
var LD65_BLOCK_BODY = {
  MEMORY: /memory\s*{([\S\s]*?)}/i,
  SEGMENTS: /segments\s*{([\S\s]*?)}/i,
  SYMBOLS: /symbols\s*{([\S\s]*?)}/i
};
function readBlockStatements(source, block) {
  const match = source.match(LD65_BLOCK_BODY[block]);
  if (!match) {
    return [];
  }
  return match[1].split(";").map((entry) => entry.trim()).filter(Boolean);
}
function parseNamedStatement(statement) {
  const colon = statement.indexOf(":");
  if (colon <= 0) {
    throw new Error(`Invalid ld65 statement: ${statement}`);
  }
  const name = statement.slice(0, colon).trim();
  const attrs = {};
  for (const part of splitTopLevelCommas(statement.slice(colon + 1))) {
    const equals = part.indexOf("=");
    if (equals <= 0) {
      continue;
    }
    const key = part.slice(0, equals).trim().toLowerCase();
    const value = part.slice(equals + 1).trim();
    attrs[key] = value;
  }
  return { name, attrs };
}
function splitTopLevelCommas(input) {
  const parts2 = [];
  let current = "";
  let quote;
  for (const char of input) {
    if (quote) {
      current += char;
      if (char === quote) {
        quote = void 0;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }
    if (char === ",") {
      const trimmed2 = current.trim();
      if (trimmed2) {
        parts2.push(trimmed2);
      }
      current = "";
      continue;
    }
    current += char;
  }
  const trimmed = current.trim();
  if (trimmed) {
    parts2.push(trimmed);
  }
  return parts2;
}
function parseNumberToken(token) {
  if (token === void 0 || token === "") {
    return void 0;
  }
  if (token.startsWith("$")) {
    const value = Number.parseInt(token.slice(1), 16);
    return Number.isFinite(value) ? value : void 0;
  }
  if (/^-?\d+$/.test(token)) {
    return Number.parseInt(token, 10);
  }
  return void 0;
}
function requireNumber(attrs, key, owner) {
  const value = parseNumberToken(attrs[key]);
  if (value === void 0) {
    throw new Error(`ld65 '${owner}' is missing numeric ${key}.`);
  }
  return value;
}
function parseYesNo(raw) {
  if (raw === void 0) {
    return void 0;
  }
  const normalized = raw.toLowerCase();
  if (normalized === "yes" || normalized === "true") {
    return true;
  }
  if (normalized === "no" || normalized === "false") {
    return false;
  }
  return void 0;
}

// packages/plugin-65xx/src/target/nes.ts
var NES_65XX_TARGET_ID = "65xx.nes";
var NES_65XX_ADDRESS_SPACE_ID = "65xx.ines-address-space";
var NES_65XX_OUTPUT_FORMAT_ID = "65xx.ines-output";
var NES_65XX_LIFECYCLE_ID = "65xx.nes-lifecycle";
var INES_MAGIC = [78, 69, 83, 26];
function isRecord5(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function createNes65xxTargetOptions(configured) {
  const value = isRecord5(configured) ? configured : {};
  const sourceStyle = value.sourceStyle ?? "ca65";
  if (sourceStyle !== "asar" && sourceStyle !== "ca65") {
    throw new Error("NES sourceStyle must be 'asar' or 'ca65'.");
  }
  const linkerConfig = typeof value.linkerConfig === "string" && value.linkerConfig.trim() ? value.linkerConfig : defaultLd65ConfigText();
  const linker = parseLd65Config(linkerConfig);
  const fillByte = typeof value.fillByte === "number" && Number.isInteger(value.fillByte) ? value.fillByte & 255 : 255;
  const header = normalizeHeader(value.header, linker.imageSize);
  return { header, linkerConfig, fillByte, linker, sourceStyle };
}
function createInitialNesState(context) {
  const options = createNes65xxTargetOptions(context.targetOptions);
  const state = {
    header: options.header,
    fillByte: options.fillByte,
    linker: options.linker,
    memoryCursors: {},
    currentSegment: null,
    currentLoadMemory: null,
    segmentLoadStart: 0,
    segmentRunStart: 0
  };
  resetNes65xxStageState(state);
  return state;
}
function validate(address2) {
  if (!Number.isInteger(address2) || address2 < 0 || address2 > 65535) {
    throw new Error(`Address $${address2.toString(16).toUpperCase()} is outside 16-bit NES space.`);
  }
  return address2;
}
function createNesAddressSpace({
  state,
  options
}) {
  if (options.sourceStyle === "asar") {
    const nes = state.get(nes65xxSessionStateKey);
    const physical = (address2) => {
      if (!Number.isSafeInteger(address2) || address2 < 0 || address2 >= nes.linker.imageSize) {
        throw new Error(
          `NES physical write offset ${address2} is outside the fixed cartridge layout.`
        );
      }
      return address2;
    };
    return {
      addressWidth: 32,
      defaultOrigin: 0,
      normalizeForWrite: physical,
      advance: (address2, amount) => address2 + amount,
      toOutputOffset(address2) {
        if (!Number.isSafeInteger(address2) || address2 < 0 || address2 > nes.linker.imageSize) {
          return -1;
        }
        return nes.header.length + address2;
      },
      fromOutputOffset(offset) {
        const address2 = offset - nes.header.length;
        return address2 >= 0 && address2 < nes.linker.imageSize ? address2 : -1;
      },
      validateWrite: physical
    };
  }
  return {
    addressWidth: 16,
    defaultOrigin: 0,
    normalizeForWrite: validate,
    advance(address2, amount) {
      return validate(address2 + amount & 65535);
    },
    toOutputOffset(address2) {
      const nes = state.get(nes65xxSessionStateKey);
      if (!nes.currentLoadMemory) {
        return -1;
      }
      const memory = nes.linker.memories.get(nes.currentLoadMemory);
      if (!memory || memory.fileOffset < 0) {
        return -1;
      }
      if (address2 < memory.start || address2 >= memory.start + memory.size) {
        return -1;
      }
      return nes.header.length + memory.fileOffset + (address2 - memory.start);
    },
    fromOutputOffset(offset) {
      const nes = state.get(nes65xxSessionStateKey);
      const prgOffset = offset - nes.header.length;
      if (prgOffset < 0) {
        return -1;
      }
      for (const memory of nes.linker.memories.values()) {
        if (memory.fileOffset < 0) {
          continue;
        }
        if (prgOffset >= memory.fileOffset && prgOffset < memory.fileOffset + memory.size) {
          return memory.start + (prgOffset - memory.fileOffset);
        }
      }
      return -1;
    },
    validateWrite(address2) {
      validate(address2);
    }
  };
}
function createNesOutputFormat() {
  return {
    finalize: () => void 0,
    getOutput: ({ outputBytes }) => Uint8Array.from(outputBytes)
  };
}
function createNesLifecycle({ state }) {
  const prefill = (session) => {
    const nes = state.get(nes65xxSessionStateKey);
    resetNes65xxStageState(nes);
    session.outputFillByte = nes.fillByte;
    const total = nes.header.length + nes.linker.imageSize;
    const image = Array.from({ length: total }, () => nes.fillByte);
    for (let index = 0; index < nes.header.length; index++) {
      image[index] = nes.header[index] ?? 0;
    }
    session.outputBytes = image;
    session.bytes = 0;
    for (const name of linkerDefinedSymbolNames(nes.linker)) {
      session.globalSymbols.add(name);
    }
  };
  return {
    onSessionCreated: ({ session }) => {
      prefill(session);
    },
    onStageStart: ({ session }) => {
      prefill(session);
    },
    onStageEnd: ({ session }) => {
      const nes = state.get(nes65xxSessionStateKey);
      closeActiveSegment(session, nes);
      applyLinkerSymbols(session, nes);
    }
  };
}
function normalizeHeader(configured, imageSize) {
  if (configured instanceof Uint8Array || Array.isArray(configured)) {
    const bytes = [...configured].map((value) => Number(value) & 255);
    if (bytes.length === 0) {
      throw new Error("65xx NES target header must not be empty.");
    }
    return bytes;
  }
  if (configured !== void 0) {
    throw new Error("65xx NES target header must be a byte array.");
  }
  const prgBanks = Math.max(1, Math.ceil(imageSize / 16384));
  const header = Array.from({ length: 16 }, () => 0);
  header[0] = INES_MAGIC[0];
  header[1] = INES_MAGIC[1];
  header[2] = INES_MAGIC[2];
  header[3] = INES_MAGIC[3];
  header[4] = prgBanks & 255;
  return header;
}

// packages/plugin-65xx/src/directives/ca65-syntax.ts
var operation = (name) => syntaxLiteral(name);
var schema = syntaxUnion(
  syntaxRecord({ operation: operation("segment"), name: syntaxString }),
  syntaxRecord({ operation: operation("cpu"), name: syntaxString, architecture: syntaxString }),
  syntaxRecord({ operation: operation("symbols"), names: syntaxArray(syntaxString) }),
  syntaxRecord({
    operation: operation("data"),
    width: syntaxUnion(syntaxLiteral(1), syntaxLiteral(2), syntaxLiteral(3), syntaxLiteral(4)),
    operands: syntaxArray(syntaxRecord({ text: syntaxString, expression: syntaxExpression }))
  }),
  syntaxRecord({
    operation: operation("mapped"),
    mode: syntaxUnion(syntaxLiteral("low"), syntaxLiteral("high"), syntaxLiteral("big")),
    values: syntaxArray(syntaxExpression)
  }),
  syntaxRecord({
    operation: syntaxUnion(operation("reserve"), operation("align")),
    count: syntaxExpression,
    fill: syntaxOptional(syntaxExpression)
  }),
  syntaxRecord({
    operation: operation("binary"),
    filename: syntaxString,
    offset: syntaxOptional(syntaxExpression),
    size: syntaxOptional(syntaxExpression)
  }),
  syntaxRecord({
    operation: operation("assert"),
    condition: syntaxExpression,
    message: syntaxString
  }),
  syntaxRecord({
    operation: operation("scope"),
    name: syntaxOptional(syntaxString),
    procedure: syntaxBoolean
  }),
  syntaxRecord({
    operation: syntaxUnion(
      operation("pushcpu"),
      operation("popcpu"),
      operation("pushseg"),
      operation("popseg"),
      operation("endscope")
    )
  }),
  syntaxRecord({ operation: operation("error"), message: syntaxString })
);
function parse(id, { words }) {
  const keyword = (words[0] ?? "").replace(/^\./, "").toLowerCase();
  const family = id.slice("65xx.directive.".length);
  if (family === "pushcpu" || family === "popcpu" || family === "pushseg" || family === "popseg" || family === "endscope") {
    return { operation: family };
  }
  if (family === "segment") {
    const name = unquoteDirectiveText(words[1] ?? "").trim();
    if (!name) {
      throw new Error(".segment requires a segment name.");
    }
    return { operation: "segment", name };
  }
  if (family === "setcpu" || family === "cpu-shorthand") {
    const name = family === "setcpu" ? unquoteDirectiveText(words.slice(1).join(" ").trim()) : ca65CpuShorthands[keyword];
    if (!name) {
      throw new Error(".setcpu requires a CPU name argument.");
    }
    const architecture = resolve65xxCpuName(name);
    if (!architecture) {
      throw new Error(
        `.setcpu "${name}" is not a supported 65xx CPU. Supported names: ${Object.keys(ca65CpuNames).join(", ")}.`
      );
    }
    return { operation: "cpu", name: name.toLowerCase(), architecture };
  }
  if (family === "scope") {
    return {
      operation: "scope",
      name: words[1]?.trim() || void 0,
      procedure: keyword === "proc"
    };
  }
  if (family === "unsupported-object") {
    return {
      operation: "error",
      message: `.${keyword} requires relocatable ca65 object/linker semantics, which the flat-image compatibility profile does not implement.`
    };
  }
  if (family === "unsupported-macro") {
    return {
      operation: "error",
      message: `.${keyword} is not yet supported by the ca65 macro compatibility slice.`
    };
  }
  if (family === "byte" || family === "addr" || family === "dword" || family === "faraddr") {
    const widths = { byte: 1, addr: 2, dword: 4, faraddr: 3 };
    const width = widths[family];
    const operands = parseDataList(words.slice(1).join(" "));
    if (!operands.length) {
      throw new Error(
        `${["", "DB", "DW", "DL", "DD"][width]} directive requires at least one parameter.`
      );
    }
    return { operation: "data", width, operands };
  }
  const params = parameterList(words);
  if (family === "export" || family === "import") {
    const names = params.map((value) => unquoteDirectiveText(value).trim()).filter(Boolean);
    if (!names.length) {
      throw new Error(`.${family} requires at least one identifier.`);
    }
    return { operation: "symbols", names };
  }
  if (family === "lobytes" || family === "hibytes" || family === "dbyt") {
    if (!params.length) {
      throw new Error(`${words[0]} requires at least one parameter.`);
    }
    let mode2 = "low";
    if (family === "hibytes") {
      mode2 = "high";
    } else if (family === "dbyt") {
      mode2 = "big";
    }
    return {
      operation: "mapped",
      mode: mode2,
      values: params.map((value) => parseDirectiveExpression(value))
    };
  }
  if (family === "res" || family === "align") {
    if (params.length < 1 || params.length > 2) {
      throw new Error(
        family === "res" ? ".res expects count and an optional fill value." : ".align expects a boundary and optional fill value."
      );
    }
    return {
      operation: family === "res" ? "reserve" : "align",
      count: parseDirectiveExpression(params[0]),
      fill: params[1] ? parseDirectiveExpression(params[1]) : void 0
    };
  }
  if (family === "incbin") {
    if (params.length < 1 || params.length > 3) {
      throw new Error(".incbin expects a filename, optional offset, and optional size.");
    }
    return {
      operation: "binary",
      filename: unquoteDirectiveText(params[0]),
      offset: params[1] ? parseDirectiveExpression(params[1]) : void 0,
      size: params[2] ? parseDirectiveExpression(params[2]) : void 0
    };
  }
  if (family === "assert") {
    if (!params.length) {
      throw new Error(".assert requires an expression.");
    }
    const message = params.find((part) => /^["']/.test(part));
    return {
      operation: "assert",
      condition: parseDirectiveExpression(params[0], false),
      message: message ? unquoteDirectiveText(message) : ".assert expression evaluated to false."
    };
  }
  throw new Error(`Missing typed ca65 directive grammar '${id}'.`);
}
function execute(node, { session, state, targetId }) {
  const profile = state.get(ca65SessionStateKey);
  switch (node.operation) {
    case "error":
      throw new Error(node.message);
    case "pushcpu":
      return handlePushcpu(session, profile);
    case "popcpu":
      return handlePopcpu(session, profile);
    case "pushseg":
      return handlePushseg(profile);
    case "popseg":
      return handlePopseg(profile);
    case "endscope":
      return handleEndScope(session, profile);
    case "cpu":
      session.selectArchitecture(node.architecture, node.name);
      profile.currentArchitecture = node.architecture;
      return;
    case "segment": {
      if (targetId !== NES_65XX_TARGET_ID) {
        profile.currentFlatSegment = node.name;
        return;
      }
      const nes = state.get(nes65xxSessionStateKey);
      const segment = nes.linker.segments.get(node.name);
      if (!segment) {
        throw new Error(`.segment "${node.name}" is not defined in the linker configuration.`);
      }
      closeActiveSegment(session, nes);
      openSegment(session, nes, segment);
      return;
    }
    case "scope": {
      const name = node.name ?? `__anonymous_scope_${session.currentLine}`;
      if (node.procedure) {
        session.symbolScope.setLabel(session.symbolScope.qualifySymbolName(name));
      }
      profile.scopeStack.push(session.currentNamespace);
      session.currentNamespace = session.currentNamespace ? `${session.currentNamespace}_${name}` : name;
      return;
    }
    case "symbols":
      for (const name of node.names) {
        markGlobalSymbol(session, name);
      }
      return;
    case "data":
      session.directiveRuntime.executeDataStatement(node);
      return;
    case "mapped":
      if (session.isDefinitionCollectionStage) {
        session.step(node.values.length * (node.mode === "big" ? 2 : 1));
        return;
      }
      for (const expression of node.values) {
        const value = session.operandResolver.getnum(expression);
        if (node.mode !== "low") {
          session.write1(value >> 8 & 255);
        }
        if (node.mode !== "high") {
          session.write1(value & 255);
        }
      }
      return;
    case "reserve":
    case "align": {
      const value = session.operandResolver.getnum(node.count);
      const fill = node.fill ? session.operandResolver.getnum(node.fill) : 0;
      if (!Number.isInteger(value) || value < (node.operation === "align" ? 1 : 0)) {
        throw new Error(
          node.operation === "align" ? ".align boundary must be a positive integer." : ".res count must be non-negative."
        );
      }
      const count = node.operation === "reserve" ? value : (value - session.currentTargetAddress % value) % value;
      if (session.isDefinitionCollectionStage) {
        session.step(count);
        return;
      }
      for (let index = 0; index < count; index++) {
        session.write1(fill & 255);
      }
      return;
    }
    case "binary": {
      const data = session.includeSource.readFile(node.filename);
      if (!(data instanceof Uint8Array)) {
        throw new Error(`Failed to read binary include: ${node.filename}`);
      }
      const offset = node.offset ? session.operandResolver.getnum(node.offset) : 0;
      const size = node.size ? session.operandResolver.getnum(node.size) : data.length - offset;
      if (!Number.isInteger(offset) || !Number.isInteger(size) || offset < 0 || size < 0 || offset + size > data.length) {
        throw new Error(
          `.incbin range ${offset}+${size} is outside '${node.filename}' (${data.length} bytes).`
        );
      }
      if (session.isDefinitionCollectionStage) {
        session.step(size);
        return;
      }
      for (const byte of data.subarray(offset, offset + size)) {
        session.write1(byte);
      }
      return;
    }
    case "assert":
      if (session.evaluateAssertion(node.condition) === false) {
        throw new Error(node.message);
      }
      return;
  }
}
function ca65DirectiveSyntax(id) {
  const codec = syntaxCodec("1", (input) => parse(id, input), schema);
  return {
    ...codec,
    bind(context) {
      if ((id === "65xx.directive.incbin" || id === "65xx.directive.assert") && context.session.targetOptions.sourceStyle === "asar") {
        return void 0;
      }
      return { execute: (payload) => execute(codec.read(payload), context) };
    }
  };
}

// packages/plugin-65xx/src/instructions/catalog.ts
var syntax = {
  implied: "",
  accumulator: "A",
  immediate: "#value",
  zeroPage: "zp",
  zeroPageIndexedX: "zp,x",
  zeroPageIndexedY: "zp,y",
  absolute: "addr",
  absoluteIndexedX: "addr,x",
  absoluteIndexedY: "addr,y",
  absoluteLongIndexedX: "long,x",
  indirect: "(addr)",
  zeroPageIndirect: "(zp)",
  zeroPageIndirectLong: "[zp]",
  indexedIndirectX: "(zp,x)",
  indirectIndexedY: "(zp),y",
  absoluteIndexedIndirect: "(addr,x)",
  zeroPageIndirectIndexedZ: "(zp),z",
  stackRelative: "offset,s",
  stackRelativeIndirectIndexedY: "(offset,s),y",
  relative: "target",
  relative16: "target",
  zeroPageRelative: "zp,target",
  accumulatorRelative: "A,target",
  zeroPageImmediate: "zp,#value",
  specialPage: "$FFnn",
  blockTransfer: "source,destination,length",
  immediateZeroPage: "#value,zp",
  immediateZeroPageIndexedX: "#value,zp,x",
  immediateAbsolute: "#value,addr",
  immediateAbsoluteIndexedX: "#value,addr,x",
  basePageIndirectIndexedZ: "[zp],z",
  quadAccumulator: "Q"
};
var summaries = {
  ADC: "Add memory to the accumulator with carry.",
  AND: "Bitwise AND memory with the accumulator.",
  ASL: "Shift left one bit.",
  BCC: "Branch when carry is clear.",
  BCS: "Branch when carry is set.",
  BEQ: "Branch when equal (zero set).",
  BIT: "Test accumulator bits without storing a result.",
  BMI: "Branch when negative.",
  BNE: "Branch when not equal (zero clear).",
  BPL: "Branch when positive.",
  BRK: "Trigger a software interrupt.",
  BVC: "Branch when overflow is clear.",
  BVS: "Branch when overflow is set.",
  CMP: "Compare memory with the accumulator.",
  CPX: "Compare memory with X.",
  CPY: "Compare memory with Y.",
  EOR: "Exclusive-OR memory with the accumulator.",
  JMP: "Jump to an address.",
  JSR: "Call a subroutine.",
  LDA: "Load the accumulator.",
  LDX: "Load X.",
  LDY: "Load Y.",
  NOP: "Perform no operation.",
  ORA: "Bitwise OR memory with the accumulator.",
  SBC: "Subtract memory and borrow from the accumulator.",
  STA: "Store the accumulator.",
  STX: "Store X.",
  STY: "Store Y."
};
function buildInstructionCatalog(forms) {
  const grouped = /* @__PURE__ */ new Map();
  for (const form of forms) {
    const entries2 = grouped.get(form.mnemonic) ?? [];
    entries2.push(form);
    grouped.set(form.mnemonic, entries2);
  }
  return [...grouped.entries()].toSorted(([left], [right]) => left.localeCompare(right)).map(([mnemonic, entries2]) => ({
    mnemonic,
    summary: summaries[mnemonic] ?? (entries2.some((entry) => !entry.documented) ? "Undocumented NMOS 6502 instruction." : `${mnemonic} instruction.`),
    modes: entries2.map((form) => ({
      mode: form.mode,
      syntax: syntax[form.mode],
      opcode: form.opcode,
      size: form.encoding.length + form.operands.reduce((size, operand) => size + operand.width, 0)
    }))
  }));
}

// node_modules/@uttori/data-tools/node_modules/pako/dist/pako.mjs
var Z_FIXED = 4;
var Z_BINARY = 0;
var Z_TEXT = 1;
var Z_UNKNOWN = 2;
function zero$1(buf) {
  let len = buf.length;
  while (--len >= 0) buf[len] = 0;
}
var STORED_BLOCK = 0;
var STATIC_TREES = 1;
var DYN_TREES = 2;
var LENGTH_CODES = 29;
var LITERALS = 256;
var L_CODES = 286;
var D_CODES = 30;
var BL_CODES = 19;
var HEAP_SIZE$1 = 573;
var MAX_BITS = 15;
var Buf_size = 16;
var MAX_BL_BITS = 7;
var END_BLOCK = 256;
var REP_3_6 = 16;
var REPZ_3_10 = 17;
var REPZ_11_138 = 18;
var extra_lbits = new Uint8Array([
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
var extra_dbits = new Uint8Array([
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
var extra_blbits = new Uint8Array([
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
var bl_order = new Uint8Array([
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
var DIST_CODE_LEN = 512;
var static_ltree = new Array(288 * 2);
zero$1(static_ltree);
var static_dtree = new Array(D_CODES * 2);
zero$1(static_dtree);
var _dist_code = new Array(DIST_CODE_LEN);
zero$1(_dist_code);
var _length_code = new Array(256);
zero$1(_length_code);
var base_length = new Array(LENGTH_CODES);
zero$1(base_length);
var base_dist = new Array(D_CODES);
zero$1(base_dist);
var StaticTreeDesc = class {
  constructor(static_tree, extra_bits, extra_base, elems, max_length) {
    this.static_tree = static_tree;
    this.extra_bits = extra_bits;
    this.extra_base = extra_base;
    this.elems = elems;
    this.max_length = max_length;
    this.has_stree = static_tree && static_tree.length;
  }
};
var static_l_desc;
var static_d_desc;
var static_bl_desc;
var TreeDesc = class {
  constructor(dyn_tree, stat_desc) {
    this.dyn_tree = dyn_tree;
    this.max_code = 0;
    this.stat_desc = stat_desc;
  }
};
var d_code = (dist) => {
  return dist < 256 ? _dist_code[dist] : _dist_code[256 + (dist >>> 7)];
};
var put_short = (s, w) => {
  s.pending_buf[s.pending++] = w & 255;
  s.pending_buf[s.pending++] = w >>> 8 & 255;
};
var send_bits = (s, value, length) => {
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
var send_code = (s, c, tree) => {
  send_bits(s, tree[c * 2], tree[c * 2 + 1]);
};
var bi_reverse = (code, len) => {
  let res = 0;
  do {
    res |= code & 1;
    code >>>= 1;
    res <<= 1;
  } while (--len > 0);
  return res >>> 1;
};
var bi_flush = (s) => {
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
var gen_bitlen = (s, desc) => {
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
var gen_codes = (tree, max_code, bl_count) => {
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
var tr_static_init = () => {
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
var init_block = (s) => {
  let n;
  for (n = 0; n < L_CODES; n++) s.dyn_ltree[n * 2] = 0;
  for (n = 0; n < D_CODES; n++) s.dyn_dtree[n * 2] = 0;
  for (n = 0; n < BL_CODES; n++) s.bl_tree[n * 2] = 0;
  s.dyn_ltree[END_BLOCK * 2] = 1;
  s.opt_len = s.static_len = 0;
  s.sym_next = s.matches = 0;
};
var bi_windup = (s) => {
  if (s.bi_valid > 8) put_short(s, s.bi_buf);
  else if (s.bi_valid > 0) s.pending_buf[s.pending++] = s.bi_buf;
  s.bi_buf = 0;
  s.bi_valid = 0;
};
var smaller = (tree, n, m, depth) => {
  const _n2 = n * 2;
  const _m2 = m * 2;
  return tree[_n2] < tree[_m2] || tree[_n2] === tree[_m2] && depth[n] <= depth[m];
};
var pqdownheap = (s, tree, k) => {
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
var compress_block = (s, ltree, dtree) => {
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
var build_tree = (s, desc) => {
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
var scan_tree = (s, tree, max_code) => {
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
var send_tree = (s, tree, max_code) => {
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
var build_bl_tree = (s) => {
  let max_blindex;
  scan_tree(s, s.dyn_ltree, s.l_desc.max_code);
  scan_tree(s, s.dyn_dtree, s.d_desc.max_code);
  build_tree(s, s.bl_desc);
  for (max_blindex = BL_CODES - 1; max_blindex >= 3; max_blindex--) if (s.bl_tree[bl_order[max_blindex] * 2 + 1] !== 0) break;
  s.opt_len += 3 * (max_blindex + 1) + 5 + 5 + 4;
  return max_blindex;
};
var send_all_trees = (s, lcodes, dcodes, blcodes) => {
  let rank2;
  send_bits(s, lcodes - 257, 5);
  send_bits(s, dcodes - 1, 5);
  send_bits(s, blcodes - 4, 4);
  for (rank2 = 0; rank2 < blcodes; rank2++) send_bits(s, s.bl_tree[bl_order[rank2] * 2 + 1], 3);
  send_tree(s, s.dyn_ltree, lcodes - 1);
  send_tree(s, s.dyn_dtree, dcodes - 1);
};
var detect_data_type = (s) => {
  let block_mask = 4093624447;
  let n;
  for (n = 0; n <= 31; n++, block_mask >>>= 1) if (block_mask & 1 && s.dyn_ltree[n * 2] !== 0) return Z_BINARY;
  if (s.dyn_ltree[18] !== 0 || s.dyn_ltree[20] !== 0 || s.dyn_ltree[26] !== 0) return Z_TEXT;
  for (n = 32; n < LITERALS; n++) if (s.dyn_ltree[n * 2] !== 0) return Z_TEXT;
  return Z_BINARY;
};
var static_init_done = false;
var _tr_init = (s) => {
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
var _tr_stored_block = (s, buf, stored_len, last) => {
  send_bits(s, (STORED_BLOCK << 1) + (last ? 1 : 0), 3);
  bi_windup(s);
  put_short(s, stored_len);
  put_short(s, ~stored_len);
  if (stored_len) s.pending_buf.set(s.window.subarray(buf, buf + stored_len), s.pending);
  s.pending += stored_len;
};
var _tr_align = (s) => {
  send_bits(s, STATIC_TREES << 1, 3);
  send_code(s, END_BLOCK, static_ltree);
  bi_flush(s);
};
var _tr_flush_block = (s, buf, stored_len, last) => {
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
var _tr_tally = (s, dist, lc) => {
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
var adler32 = (adler, buf, len, pos) => {
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
var makeTable = () => {
  let c, table = [];
  for (var n = 0; n < 256; n++) {
    c = n;
    for (var k = 0; k < 8; k++) c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
    table[n] = c;
  }
  return table;
};
var crcTable = new Uint32Array(makeTable());
var crc32 = (crc, buf, len, pos) => {
  const t = crcTable;
  const end = pos + len;
  crc ^= -1;
  for (let i = pos; i < end; i++) crc = crc >>> 8 ^ t[(crc ^ buf[i]) & 255];
  return crc ^ -1;
};
var messages_default = {
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
var MAX_MEM_LEVEL = 9;
var HEAP_SIZE = 573;
var MIN_MATCH = 3;
var MAX_MATCH = 258;
var MIN_LOOKAHEAD = 262;
var PRESET_DICT = 32;
var INIT_STATE = 42;
var GZIP_STATE = 57;
var EXTRA_STATE = 69;
var NAME_STATE = 73;
var COMMENT_STATE = 91;
var HCRC_STATE = 103;
var BUSY_STATE = 113;
var FINISH_STATE = 666;
var BS_NEED_MORE = 1;
var BS_BLOCK_DONE = 2;
var BS_FINISH_STARTED = 3;
var BS_FINISH_DONE = 4;
var OS_CODE = 3;
var err = (strm, errorCode) => {
  strm.msg = messages_default[errorCode];
  return errorCode;
};
var rank = (f) => {
  return f * 2 - (f > 4 ? 9 : 0);
};
var zero = (buf) => {
  let len = buf.length;
  while (--len >= 0) buf[len] = 0;
};
var slide_hash = (s) => {
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
var HASH = (s, prev, data) => (prev << s.hash_shift ^ data) & s.hash_mask;
var INSERT_STRING = (s, str) => {
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
var flush_pending = (strm) => {
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
var flush_block_only = (s, last) => {
  _tr_flush_block(s, s.block_start >= 0 ? s.block_start : -1, s.strstart - s.block_start, last);
  s.block_start = s.strstart;
  flush_pending(s.strm);
};
var put_byte = (s, b) => {
  s.pending_buf[s.pending++] = b;
};
var putShortMSB = (s, b) => {
  s.pending_buf[s.pending++] = b >>> 8 & 255;
  s.pending_buf[s.pending++] = b & 255;
};
var read_buf = (strm, buf, start, size) => {
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
var longest_match = (s, cur_match) => {
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
var fill_window = (s) => {
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
var deflate_stored = (s, flush) => {
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
var deflate_fast = (s, flush) => {
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
var deflate_slow = (s, flush) => {
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
var deflate_rle = (s, flush) => {
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
var deflate_huff = (s, flush) => {
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
var Config = class {
  constructor(good_length, max_lazy, nice_length, max_chain, func) {
    this.good_length = good_length;
    this.max_lazy = max_lazy;
    this.nice_length = nice_length;
    this.max_chain = max_chain;
    this.func = func;
  }
};
var configuration_table = [
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
var lm_init = (s) => {
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
var DeflateState = class {
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
var deflateStateCheck = (strm) => {
  if (!strm) return 1;
  const s = strm.state;
  if (!s || s.strm !== strm || s.status !== INIT_STATE && s.status !== GZIP_STATE && s.status !== EXTRA_STATE && s.status !== NAME_STATE && s.status !== COMMENT_STATE && s.status !== HCRC_STATE && s.status !== BUSY_STATE && s.status !== FINISH_STATE) return 1;
  return 0;
};
var deflateResetKeep = (strm) => {
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
var deflateReset = (strm) => {
  const ret = deflateResetKeep(strm);
  if (ret === 0) lm_init(strm.state);
  return ret;
};
var deflateInit2 = (strm, level, method, windowBits, memLevel, strategy, legacyHash) => {
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
var deflate$1 = (strm, flush) => {
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
var deflateEnd = (strm) => {
  if (deflateStateCheck(strm)) return -2;
  const status = strm.state.status;
  strm.state = null;
  return status === BUSY_STATE ? err(strm, -3) : 0;
};
var deflateSetDictionary = (strm, dictionary) => {
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
var BAD$1 = 16209;
var TYPE$1 = 16191;
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
  let op;
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
      op = here >>> 24;
      hold >>>= op;
      bits -= op;
      op = here >>> 16 & 255;
      if (op === 0) output[_out++] = here & 65535;
      else if (op & 16) {
        len = here & 65535;
        op &= 15;
        if (op) {
          if (bits < op) {
            hold += input[_in++] << bits;
            bits += 8;
          }
          len += hold & (1 << op) - 1;
          hold >>>= op;
          bits -= op;
        }
        if (bits < 15) {
          hold += input[_in++] << bits;
          bits += 8;
          hold += input[_in++] << bits;
          bits += 8;
        }
        here = dcode[hold & dmask];
        dodist: for (; ; ) {
          op = here >>> 24;
          hold >>>= op;
          bits -= op;
          op = here >>> 16 & 255;
          if (op & 16) {
            dist = here & 65535;
            op &= 15;
            if (bits < op) {
              hold += input[_in++] << bits;
              bits += 8;
              if (bits < op) {
                hold += input[_in++] << bits;
                bits += 8;
              }
            }
            dist += hold & (1 << op) - 1;
            if (dist > dmax) {
              strm.msg = "invalid distance too far back";
              state.mode = BAD$1;
              break top;
            }
            hold >>>= op;
            bits -= op;
            op = _out - beg;
            if (dist > op) {
              op = dist - op;
              if (op > whave) {
                if (state.sane) {
                  strm.msg = "invalid distance too far back";
                  state.mode = BAD$1;
                  break top;
                }
              }
              from = 0;
              from_source = s_window;
              if (wnext === 0) {
                from += wsize - op;
                if (op < len) {
                  len -= op;
                  do
                    output[_out++] = s_window[from++];
                  while (--op);
                  from = _out - dist;
                  from_source = output;
                }
              } else if (wnext < op) {
                from += wsize + wnext - op;
                op -= wnext;
                if (op < len) {
                  len -= op;
                  do
                    output[_out++] = s_window[from++];
                  while (--op);
                  from = 0;
                  if (wnext < len) {
                    op = wnext;
                    len -= op;
                    do
                      output[_out++] = s_window[from++];
                    while (--op);
                    from = _out - dist;
                    from_source = output;
                  }
                }
              } else {
                from += wnext - op;
                if (op < len) {
                  len -= op;
                  do
                    output[_out++] = s_window[from++];
                  while (--op);
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
          } else if ((op & 64) === 0) {
            here = dcode[(here & 65535) + (hold & (1 << op) - 1)];
            continue dodist;
          } else {
            strm.msg = "invalid distance code";
            state.mode = BAD$1;
            break top;
          }
          break;
        }
      } else if ((op & 64) === 0) {
        here = lcode[(here & 65535) + (hold & (1 << op) - 1)];
        continue dolen;
      } else if (op & 32) {
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
var MAXBITS = 15;
var ENOUGH_LENS$1 = 852;
var ENOUGH_DISTS$1 = 592;
var CODES$1 = 0;
var LENS$1 = 1;
var DISTS$1 = 2;
var lbase = new Uint16Array([
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
var lext = new Uint8Array([
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
var dbase = new Uint16Array([
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
var dext = new Uint8Array([
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
var inflate_table = (type, lens, lens_index, codes, table, table_index, work, opts) => {
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
var CODES = 0;
var LENS = 1;
var DISTS = 2;
var HEAD = 16180;
var FLAGS = 16181;
var TIME = 16182;
var OS = 16183;
var EXLEN = 16184;
var EXTRA = 16185;
var NAME = 16186;
var COMMENT = 16187;
var HCRC = 16188;
var DICTID = 16189;
var DICT = 16190;
var TYPE = 16191;
var TYPEDO = 16192;
var STORED = 16193;
var COPY_ = 16194;
var COPY = 16195;
var TABLE = 16196;
var LENLENS = 16197;
var CODELENS = 16198;
var LEN_ = 16199;
var LEN = 16200;
var LENEXT = 16201;
var DIST = 16202;
var DISTEXT = 16203;
var MATCH = 16204;
var LIT = 16205;
var CHECK = 16206;
var LENGTH = 16207;
var DONE = 16208;
var BAD = 16209;
var MEM = 16210;
var SYNC = 16211;
var ENOUGH_LENS = 852;
var ENOUGH_DISTS = 592;
var zswap32 = (q) => {
  return (q >>> 24 & 255) + (q >>> 8 & 65280) + ((q & 65280) << 8) + ((q & 255) << 24);
};
var InflateState = class {
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
var inflateStateCheck = (strm) => {
  if (!strm) return 1;
  const state = strm.state;
  if (!state || state.strm !== strm || state.mode < HEAD || state.mode > SYNC) return 1;
  return 0;
};
var inflateResetKeep = (strm) => {
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
var inflateReset = (strm) => {
  if (inflateStateCheck(strm)) return -2;
  const state = strm.state;
  state.wsize = 0;
  state.whave = 0;
  state.wnext = 0;
  return inflateResetKeep(strm);
};
var inflateReset2 = (strm, windowBits) => {
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
var inflateInit2 = (strm, windowBits) => {
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
var virgin = true;
var lenfix;
var distfix;
var fixedtables = (state) => {
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
var updatewindow = (strm, src, end, copy) => {
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
var inflate$1 = (strm, flush) => {
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
var inflateEnd = (strm) => {
  if (inflateStateCheck(strm)) return -2;
  let state = strm.state;
  if (state.window) state.window = null;
  strm.state = null;
  return 0;
};
var inflateSetDictionary = (strm, dictionary) => {
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
var ZStream = class {
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
var flattenChunks = (chunks) => {
  const result = new Uint8Array(chunks.reduce((len, chunk) => len + chunk.length, 0));
  let pos = 0;
  for (const chunk of chunks) {
    result.set(chunk, pos);
    pos += chunk.length;
  }
  return result;
};
var toString$1 = Object.prototype.toString;
var defaultOptions$1 = {
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
var Deflate = class {
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
function deflate(input, options = {}) {
  const deflator = new Deflate(options);
  deflator.push(input, true);
  if (deflator.err) throw new Error(deflator.msg);
  return deflator.result;
}
var toString = Object.prototype.toString;
var defaultOptions = {
  chunkSize: 1024 * 64,
  windowBits: 15,
  raw: false,
  dictionary: /* @__PURE__ */ new Uint8Array(0)
};
var Inflate = class {
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

// node_modules/@uttori/data-tools/dist/data-helpers.js
var validateBytes = (uint8, length) => {
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
var decodeExtended = (sign, exponent, high, low) => {
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
var float48 = (uint8) => {
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
var float80 = (uint8) => {
  validateBytes(uint8, 10);
  const high = (uint8[7] << 24 | uint8[6] << 16 | uint8[5] << 8 | uint8[4]) >>> 0;
  const low = (uint8[3] << 24 | uint8[2] << 16 | uint8[1] << 8 | uint8[0]) >>> 0;
  const a0 = uint8[9];
  const a1 = uint8[8];
  const sign = 1 - (a0 >>> 7) * 2;
  const exponent = (a0 & 127) << 8 | a1;
  return decodeExtended(sign, exponent, high, low);
};
var convertFromIeeeExtended = (uint8) => {
  validateBytes(uint8, 10);
  const sign = uint8[0] & 128 ? -1 : 1;
  const exponent = (uint8[0] & 127) << 8 | uint8[1];
  const hiMant = (uint8[2] << 24 | uint8[3] << 16 | uint8[4] << 8 | uint8[5]) >>> 0;
  const loMant = (uint8[6] << 24 | uint8[7] << 16 | uint8[8] << 8 | uint8[9]) >>> 0;
  return decodeExtended(sign, exponent, hiMant, loMant);
};

// node_modules/@uttori/data-tools/dist/underflow-error.js
var UnderflowError = class extends Error {
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
var underflow_error_default = UnderflowError;

// node_modules/@uttori/data-tools/dist/data-buffer.js
function dataBufferBrand() {
  return /* @__PURE__ */ Symbol.for("uttori.DataBuffer");
}
var DATA_BUFFER_BRAND = /* @__PURE__ */ dataBufferBrand();
function nativeEndian() {
  return new Uint16Array(new Uint8Array([18, 52]).buffer)[0] === 13330;
}
var NATIVE_ENDIAN = /* @__PURE__ */ nativeEndian();
var debug = (..._args) => {
};
if (typeof process !== "undefined" && process.env.UTTORI_DATA_DEBUG) {
  try {
    const { default: d } = await Promise.resolve().then(() => __toESM(require_src(), 1));
    debug = d("DataBuffer");
  } catch {
  }
}
var DataBuffer = class _DataBuffer {
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
    Object.defineProperty(this, DATA_BUFFER_BRAND, { value: true });
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
var data_buffer_default = DataBuffer;

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
  }).map(([key, rows2]) => [key, Object.freeze(rows2)])));
}
var GLYPHS = /* @__PURE__ */ freezeGlyphs();
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
var BitmapText = /* @__PURE__ */ Object.freeze({
  glyphWidth: 5,
  glyphHeight: 7,
  advance: 6,
  lineHeight: 8,
  measure(text, options = {}) {
    return layout(text, options).metrics;
  }
});
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

// node_modules/@uttori/data-tools/dist/image/rgba-surface.js
var DEFAULT_MAX_PIXELS = 4 * 1024 * 1024;
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
var LITTLE_ENDIAN = /* @__PURE__ */ littleEndian();
var wordView = (bytes) => bytes.byteOffset % 4 === 0 ? new Uint32Array(bytes.buffer, bytes.byteOffset, bytes.length / 4) : void 0;
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
var RgbaSurface = class _RgbaSurface {
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
    const mode2 = options.mode ?? "copy";
    if (!["copy", "source-over"].includes(mode2)) {
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
    const rows2 = bottom - top;
    let bytes = source.rgba;
    let stride = source.width * 4;
    let start = ((sy + top) * source.width + sx + left) * 4;
    if (bytes.buffer === this.rgba.buffer) {
      const snapshot = new Uint8Array(rows2 * rowLength);
      for (let row = 0; row < rows2; row++) {
        snapshot.set(bytes.subarray(start + row * stride, start + row * stride + rowLength), row * rowLength);
      }
      bytes = snapshot;
      stride = rowLength;
      start = 0;
    }
    for (let row = 0; row < rows2; row++) {
      let destination = ((y + top + row) * this.width + x + left) * 4;
      const input = start + row * stride;
      if (mode2 === "copy") {
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

// node_modules/@uttori/data-tools/dist/image/data-image-png.js
var debug2 = () => {
};
if (typeof process !== "undefined" && process.env.UTTORI_DATA_DEBUG) {
  try {
    const { default: d } = await Promise.resolve().then(() => __toESM(require_src(), 1));
    debug2 = d("Uttori.ImagePNG");
  } catch {
  }
}
function zlibState(inflator) {
  return inflator.strm;
}
var PNG_SIGNATURE = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10);
var ADAM7_PASSES = [
  [0, 0, 8, 8],
  [4, 0, 8, 8],
  [0, 4, 4, 8],
  [2, 0, 4, 4],
  [0, 2, 2, 4],
  [1, 0, 2, 2],
  [0, 1, 1, 2]
];
var SINGLE_PASS = [[0, 0, 1, 1]];
var COLOR_DEPTHS = {
  0: [1, 2, 4, 8, 16],
  2: [8, 16],
  3: [1, 2, 4, 8],
  4: [8, 16],
  6: [8, 16]
};
var ANIMATION_CHUNKS = /* @__PURE__ */ new Set(["acTL", "fcTL", "fdAT"]);
var DEFAULT_LIMITS = Object.freeze({
  maxInputBytes: 64 * 1024 * 1024,
  maxPixels: 4 * 1024 * 1024,
  maxInflatedBytes: 64 * 1024 * 1024,
  maxOutputBytes: 64 * 1024 * 1024,
  maxChunks: 16384
});
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
function joinChunks(parts2, maxBytes) {
  let length = 0;
  for (const part of parts2) {
    length += part.length;
  }
  if (!Number.isSafeInteger(length) || length > maxBytes) {
    throw new RangeError("PNG exceeds the output byte limit.");
  }
  const output = new Uint8Array(length);
  let offset = 0;
  for (const part of parts2) {
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
var ImagePNG = class _ImagePNG extends data_buffer_default {
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
    debug2("fromFile");
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
    debug2("fromBuffer:", buffer.length);
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
    debug2("setBitDepth:", bitDepth);
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
    debug2("setColorType:", colorType);
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
    debug2("parse");
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
    debug2("decodeChunk:", type, "length:", length);
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
          for (let x = 0, bit = 0; x < passWidth; x++, bit += bitDepth, destination += stepX) {
            samples[destination] = current.data[bit >>> 3] >>> 8 - bitDepth - (bit & 7) & mask;
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
    const parts2 = [PNG_SIGNATURE];
    let wrotePixels = false;
    for (const chunk of image.chunks) {
      const { type } = chunk;
      if (type === "IHDR" && pixelsChanged) {
        parts2.push(makeChunk(type, makeHeader(width, height, image.bitDepth, 3)));
      } else if (type === "PLTE" && paletteChanged) {
        parts2.push(...makePaletteChunks(palette));
      } else if (type === "tRNS" && paletteChanged) {
        continue;
      } else if (type === "IDAT" && compressed !== void 0) {
        if (!wrotePixels) {
          parts2.push(makeChunk(type, compressed));
          wrotePixels = true;
        }
      } else if (type === "IHDR" || type === "PLTE" || type === "tRNS" || type === "IDAT" || type === "IEND" || chunk.safeToCopy || retained.has(type)) {
        parts2.push(chunk.raw);
      }
    }
    return joinChunks(parts2, image._limits.maxOutputBytes);
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
      for (let x = 0, bit = 0; x < image.width; x++, bit += bitDepth) {
        row[bit >>> 3] |= image.indexes[source + x] << 8 - bitDepth - (bit & 7);
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
    const rows2 = new Uint8Array(length);
    if (filter === "none") {
      for (let y = 0; y < height; y++) {
        const offset = y * (rowBytes + 1);
        fillRow(rows2.subarray(offset + 1, offset + rowBytes + 1), y);
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
            rows2[offset] = type;
            rows2.set(candidate, offset + 1);
          }
        }
        const temporary = previous;
        previous = current;
        current = temporary;
      }
    }
    return deflate(rows2, { level });
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
var data_image_png_default = ImagePNG;

// packages/assets/src/limits.ts
var ASSET_LIMITS = Object.freeze({
  rasterPixels: 4 * 1024 * 1024,
  interchangeSide: 4096,
  pngBytes: 32 * 1024 * 1024,
  pngInflatedBytes: 20 * 1024 * 1024,
  asepriteBytes: 16 * 1024 * 1024,
  decodedBytes: 64 * 1024 * 1024,
  renderPixels: 64 * 1024 * 1024,
  frames: 1024,
  layers: 4096,
  tilesets: 1024,
  owners: 4 * 1024 * 1024,
  references: 4 * 1024 * 1024,
  chunks: 1024 * 1024,
  metadataBytes: 16 * 1024 * 1024,
  baselineMetadataBytes: 64 * 1024 * 1024,
  metadataNodes: 1024 * 1024,
  // Baselines include owner and view declarations as well as the file model; pixels stay in binary blobs.
  baselineMetadataNodes: 4 * 1024 * 1024,
  thumbnailEdge: 1024
});
var PNG_EDITOR_BACKUP_BYTES = Math.ceil((ASSET_LIMITS.pngBytes + 2 * ASSET_LIMITS.rasterPixels) / 3) * 4 + 1024 * 1024;

// packages/assets/src/png.ts
var ASSET_PNG_OPTIONS = Object.freeze({
  maxInputBytes: ASSET_LIMITS.pngBytes,
  maxPixels: ASSET_LIMITS.rasterPixels,
  maxInflatedBytes: ASSET_LIMITS.pngInflatedBytes,
  maxOutputBytes: ASSET_LIMITS.pngBytes,
  maxChunks: 16384,
  allow16Bit: false,
  animation: "reject",
  copyInput: false
});
function readAssetPng(bytes) {
  return data_image_png_default.fromFile(bytes, ASSET_PNG_OPTIONS);
}
var pngImporter = Object.freeze({
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

// packages/plugin-65xx/src/nes/assets.ts
var NES_CHR_CODEC = "nes.chr.2bpp";
var NES_TEXT_CODEC = "nes.text.tiles";
function encodeNesChrPng(bytes) {
  const png = readAssetPng(bytes);
  if (png.colorType !== 3) {
    throw new Error("NES CHR assets require an indexed PNG.");
  }
  const image = png.toIndexed({ copy: false });
  if (!image.width || !image.height || image.width % 8 || image.height % 8 || image.indexes.some((value) => value > 3)) {
    throw new Error("NES CHR assets require 8-pixel tile dimensions and indexes 0..3.");
  }
  const columns = image.width / 8;
  const count = columns * image.height / 8;
  const output = new Uint8Array(count * 16);
  for (let tile = 0; tile < count; tile++) {
    const left = tile % columns * 8;
    const top = Math.floor(tile / columns) * 8;
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const value = image.indexes[(top + y) * image.width + left + x];
        output[tile * 16 + y] |= (value & 1) << 7 - x;
        output[tile * 16 + y + 8] |= value >> 1 << 7 - x;
      }
    }
  }
  return output;
}
function nesTextMap(options) {
  if (typeof options !== "object" || options === null || Array.isArray(options) || Object.keys(options).some((key) => key !== "characters") || !("characters" in options) || typeof options.characters !== "object" || options.characters === null || Array.isArray(options.characters)) {
    throw new Error("NES tile text requires an explicit characters object.");
  }
  const result = /* @__PURE__ */ new Map();
  const bytes = /* @__PURE__ */ new Set();
  for (const [character, value] of Object.entries(options.characters)) {
    if (character.length !== 1 || typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 255 || bytes.has(value)) {
      throw new Error("NES tile text mappings require unique characters and byte values.");
    }
    result.set(character, value);
    bytes.add(value);
  }
  if (!result.size) {
    throw new Error("NES tile text mappings must not be empty.");
  }
  return result;
}
var nesAssetFormats = [
  {
    id: NES_CHR_CODEC,
    version: "1.0.0",
    targets: ["65xx.nes"],
    sourceRepresentations: [{ id: "indexed-png", mediaType: "image/png", extensions: [".png"] }],
    convert(source, options) {
      if (source.mediaType !== "image/png" || Object.keys(options).length) {
        throw new Error("NES CHR conversion accepts an indexed PNG without options.");
      }
      return { primaryOutput: "chr", outputs: { chr: { bytes: encodeNesChrPng(source.bytes) } } };
    }
  },
  {
    id: NES_TEXT_CODEC,
    version: "1.0.0",
    targets: ["65xx.nes"],
    optionSchema: {
      characters: {
        summary: "Explicit character-to-tile byte mapping",
        valueSyntax: '{ A: $0A, " ": $FC }'
      }
    },
    sourceRepresentations: [{ id: "utf8-text", mediaType: "text/plain", extensions: [".txt"] }],
    convert(source, options) {
      if (source.mediaType !== "text/plain") {
        throw new Error("NES tile text requires UTF-8 text.");
      }
      const map = nesTextMap(options);
      const text = new TextDecoder("utf-8", { fatal: true }).decode(source.bytes);
      const bytes = Uint8Array.from(
        // Mapping keys are single UTF-16 units; splitting uses the same contract and rejects unknown units.
        text.split("").map((character) => {
          const value = map.get(character);
          if (value === void 0) {
            throw new Error(`Unmapped NES text character ${JSON.stringify(character)}.`);
          }
          return value;
        })
      );
      return { primaryOutput: "text", outputs: { text: { bytes } } };
    }
  }
];

// packages/plugin-65xx/src/operands/syntax.ts
var grammar = {
  registers: ["a", "q"],
  indexRegisters: ["x", "y", "z", "s"],
  commaIndex: true,
  ca65Widths: true
};
function parts(text) {
  const result = [];
  let depth = 0;
  let quote = "";
  let start = 0;
  const append = (end) => {
    const raw = text.slice(start, end);
    const trimmed = raw.trim();
    if (trimmed) {
      result.push({ text: trimmed, start: start + raw.length - raw.trimStart().length });
    }
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === "\\") {
        i++;
      } else if (ch === quote) {
        quote = "";
      }
    } else if (ch === "'" || ch === '"') {
      quote = ch;
    } else if (ch === "(" || ch === "[") {
      depth++;
    } else if (ch === ")" || ch === "]") {
      depth--;
    } else if (ch === "," && depth === 0) {
      append(i);
      start = i + 1;
    }
  }
  append(text.length);
  return result;
}
function containsCall(node) {
  if (node.type === "call") {
    return true;
  }
  if (node.type === "binary") {
    return containsCall(node.left) || containsCall(node.right);
  }
  if (node.type === "unary") {
    return containsCall(node.argument);
  }
  if (node.type === "index") {
    return containsCall(node.object) || containsCall(node.index);
  }
  if (node.type === "member") {
    return containsCall(node.object);
  }
  return false;
}
function scalar2(text, start, force) {
  const expression = parseExpressionNode(text);
  let spelling = "expression";
  let literalBytes;
  if (expression.type === "literal" && !expression.parenthesized) {
    if (text.startsWith("$")) {
      spelling = "hex";
      literalBytes = Math.max(1, Math.ceil((text.length - 1) / 2));
    } else if (text.startsWith("%")) {
      spelling = "binary";
      literalBytes = Math.max(1, Math.ceil((text.length - 1) / 8));
    } else if (!text.startsWith("0x")) {
      spelling = "decimal";
    }
  } else if (isReferenceExpressionNode(expression)) {
    spelling = "symbol";
  }
  return {
    expression,
    span: { start, end: start + text.length },
    width: {
      spelling,
      grouped: expression.parenthesized === true,
      ...literalBytes ? { literalBytes } : {},
      ...force ? { forcedBytes: force } : {}
    }
  };
}
function plan(input, start) {
  let text = input.trim();
  const prefix = /^([afz]):\s*/i.exec(text);
  let force;
  if (prefix) {
    if (prefix[1].toLowerCase() === "z") {
      force = 1;
    } else if (prefix[1].toLowerCase() === "a") {
      force = 2;
    } else {
      force = 3;
    }
    text = text.slice(prefix[0].length);
    start += prefix[0].length;
  }
  text = text.replace(/^(#?)(-?\d+|\$[\da-f]+|%[01]+)\.base(\s*,\s*[sxy])?$/i, "$1$2$3");
  const immediate = text.startsWith("#");
  const body = immediate ? text.slice(1).trim() : text;
  const suffix = !immediate ? /^(.*),\s*([sxy])$/i.exec(body) : null;
  const expressionText = suffix ? suffix[1].trim() : body;
  const numeric = scalar2(expressionText, start + text.indexOf(expressionText), force);
  const mathematicalScalar = numeric;
  const relative = /^(?:\?[+-]|:?\++|:?-+)$/.test(text);
  const mathematical = /^[A-Z_a-z]\w*\s*\(/.test(body) || /[&*+/^|-]|<<|>>/.test(body);
  let probeText = body;
  if (text.startsWith("[") && text.endsWith("]")) {
    probeText = text.slice(1, -1).trim();
  } else if (!immediate && text.includes(",")) {
    probeText = text.slice(0, text.lastIndexOf(",")).trim();
  }
  let probe;
  if (!/^[\d$%(]/.test(probeText) && !probeText.includes(",")) {
    const candidate = scalar2(probeText, start + text.indexOf(probeText));
    if (isReferenceExpressionNode(candidate.expression) && candidate.expression.type !== "relativeReference") {
      probe = candidate;
    }
  }
  let hexWidth;
  if (body.startsWith("$")) {
    const atom = body.slice(1).split(",")[0];
    hexWidth = Math.max(1, Math.ceil(atom.length / 2));
  }
  const groupedAtom = numeric.expression.parenthesized && (isReferenceExpressionNode(numeric.expression) || numeric.expression.type === "literal" && numeric.expression.value.includes("."));
  const native = !relative && !/^[([]/.test(text) && !/^[aq]$/i.test(text) && numeric.expression.type !== "error" && numeric.expression.type !== "range" && numeric.expression.type !== "template" && !containsCall(numeric.expression) && !groupedAtom;
  let numericScalar = numeric;
  if (groupedAtom && expressionText.includes(".") && !mathematical) {
    numericScalar = { ...numeric, expression: { type: "identifier", name: expressionText } };
  }
  return {
    scalar: numericScalar,
    unbound: /![\w{]|<[^>]+>|\\[A-Z_a-z]/.test(input),
    display: expressionText,
    ...suffix ? { index: suffix[2].toLowerCase() } : {},
    immediate,
    relative,
    directHex: body.startsWith("$"),
    native,
    ...force ? { force } : {},
    ...hexWidth ? { hexWidth } : {},
    ...probe ? { probe } : {},
    ...mathematical && !relative ? { math: mathematicalScalar } : {}
  };
}
function parse65xxOperands(mnemonic, text) {
  const common = parseInstructionOperands(mnemonic, text, grammar);
  const parsedMnemonic = /^([A-Z][\dA-Z]{2,4})(?:\.([BW]))?$/.exec(mnemonic.trim().toUpperCase());
  let forcedWidth;
  if (parsedMnemonic?.[2] === "B") {
    forcedWidth = 1;
  } else if (parsedMnemonic?.[2] === "W") {
    forcedWidth = 2;
  }
  const whole = plan(text, 0);
  const split = parts(text);
  const unboundOperands = common.operands[0]?.kind === "template" ? common.operands[0].structure.operands : common.operands;
  const first = unboundOperands.at(0);
  let inner;
  if (first?.kind === "memory" && !("kind" in first.address)) {
    const span = first.address.span;
    inner = plan(text.slice(span.start, span.end), span.start);
  }
  const register = text.trim().toLowerCase();
  const originalRegister = register === "a" || register === "q" ? register : void 0;
  const selected = operandScalar(first);
  const scalarDisplay = whole.native || !selected ? whole.display : text.slice(selected.span.start, selected.span.end);
  return {
    ...common,
    policy65xx: {
      kind: "65xx-v1",
      mnemonic: parsedMnemonic?.[1] ?? mnemonic.trim().toUpperCase(),
      ...forcedWidth ? { forcedWidth } : {},
      ...originalRegister ? { originalRegister } : {},
      whole,
      unboundOperands,
      scalarDisplay,
      parts: split.map((p) => plan(p.text, p.start)),
      ...inner ? { inner } : {},
      hasOperand: text.trim().length > 0,
      hexSpecialPage: /^(?:\$ff[\da-f]{2}|0xff[\da-f]{2})$/i.test(text.trim())
    }
  };
}
function syntax65xx(syntax2) {
  if (!has65xxPolicy(syntax2)) {
    throw new Error("65xx encoder requires its registered operand grammar.");
  }
  return syntax2;
}
function operandScalar(operand) {
  if (operand?.kind === "immediate") {
    return operand.value;
  }
  if (operand?.kind === "memory" && !("kind" in operand.address)) {
    return operand.address;
  }
  return void 0;
}
function has65xxPolicy(syntax2) {
  return "policy65xx" in syntax2 && typeof syntax2.policy65xx === "object" && syntax2.policy65xx !== null && "kind" in syntax2.policy65xx && syntax2.policy65xx.kind === "65xx-v1";
}

// packages/plugin-65xx/src/operands/resolution.ts
function valueWidth(value) {
  if (!Number.isFinite(value)) {
    return 4;
  }
  let integer3 = Math.floor(Math.abs(value));
  let digits = 1;
  while (integer3 >= 16) {
    integer3 = Math.floor(integer3 / 16);
    digits++;
  }
  if (value < 0) {
    digits++;
  }
  let fraction = Math.abs(value) % 1;
  if (fraction) {
    digits++;
    for (let n = 0; fraction && n < 268; n++) {
      fraction = fraction * 16 % 1;
      digits++;
    }
  }
  return Math.max(1, Math.ceil(digits / 2));
}
function expand(plan2, frame) {
  let length = plan2.hexWidth ?? 2;
  let value = 0;
  let generated = false;
  let flattened = false;
  if (plan2.unbound && frame.bindingFailure?.reason === "other") {
    return { length: plan2.force ?? length, value, flattened, generated };
  }
  if (plan2.relative) {
    return { length: 2, value, generated, flattened };
  }
  if (plan2.probe && isReferenceExpressionNode(plan2.probe.expression)) {
    const result = frame.reference(plan2.probe.expression);
    if (result.kind === "resolved") {
      value = result.value;
      generated = true;
      length = valueWidth(value);
    }
  }
  if (plan2.immediate && !generated && (plan2.math || !plan2.directHex)) {
    try {
      value = frame.evaluate(plan2.scalar, "classification", true).value;
      generated = true;
      length = valueWidth(value);
    } catch {
    }
  }
  if (!generated && plan2.math) {
    try {
      const result = frame.evaluate(plan2.math, "classification", true, "math").value;
      if (!Number.isNaN(result)) {
        value = result;
        generated = true;
        flattened = true;
        length = valueWidth(value);
      }
    } catch {
    }
  }
  if (plan2.force === 1) {
    length = 1;
  } else if (plan2.force) {
    length = Math.max(plan2.force, length);
  }
  return { length, value, generated, flattened };
}
function classify(syntax2, frame) {
  const policy = syntax2.policy65xx;
  const whole = expand(policy.whole, frame);
  const operands = syntax2.operands;
  const first = operands.at(0);
  let mode2 = "unknown";
  let length = whole.length;
  if (!policy.hasOperand) {
    mode2 = "implied";
  } else if (policy.originalRegister === "a") {
    mode2 = "accumulator";
  } else if (policy.originalRegister === "q") {
    mode2 = "quadAccumulator";
  } else if (policy.whole.immediate && whole.generated) {
    mode2 = "immediate";
  } else if (first?.kind === "immediate" && operands.length >= 2) {
    const address2 = expand(policy.parts[1], frame);
    const second = operands[1];
    const indexed = second.kind === "memory" && second.index?.register === "x";
    mode2 = address2.length <= 1 ? "immediateZeroPage" : "immediateAbsolute";
    if (indexed) {
      mode2 += "IndexedX";
    }
  } else if (first?.kind === "immediate") {
    mode2 = "immediate";
  } else if (operands.length >= 2 && policy.whole.index && policy.whole.scalar.expression.type === "error") {
    mode2 = length <= 1 ? "zeroPage" : "absolute";
    mode2 += "Indexed" + policy.whole.index.toUpperCase();
  } else if (first?.kind === "invalid") {
    mode2 = length <= 1 ? "zeroPage" : "absolute";
  } else if (operands.length >= 2) {
    if (policy.parts.length === 3) {
      mode2 = "blockTransfer";
    } else if (first?.kind === "register" && first.name === "a") {
      mode2 = "accumulatorRelative";
    } else if (operands[1].kind === "immediate") {
      mode2 = "zeroPageImmediate";
    } else {
      mode2 = "zeroPageRelative";
    }
  } else if (first?.kind === "memory") {
    const index = first.index?.register;
    const delimiter = whole.flattened ? "none" : first.delimiter;
    if (delimiter === "parentheses" && first.innerIndex === "s" && index === "y") {
      mode2 = "stackRelativeIndirectIndexedY";
    } else if (delimiter === "parentheses" && first.index?.position === "inside" && index === "x") {
      length = expand(policy.inner, frame).length;
      mode2 = length <= 1 ? "indexedIndirectX" : "absoluteIndexedIndirect";
    } else if (delimiter === "parentheses" && first.index?.position === "outside" && index === "y") {
      mode2 = "indirectIndexedY";
    } else if (delimiter === "parentheses" && first.index?.position === "outside" && index === "z") {
      mode2 = "zeroPageIndirectIndexedZ";
    } else if (delimiter === "brackets" && index === "z") {
      mode2 = "basePageIndirectIndexedZ";
    } else if (delimiter === "brackets" && !index) {
      mode2 = "zeroPageIndirectLong";
    } else if (delimiter === "parentheses" && !index) {
      length = expand(policy.inner, frame).length;
      mode2 = length <= 1 ? "zeroPageIndirect" : "indirect";
    } else if (delimiter === "none") {
      if (index === "s") {
        mode2 = "stackRelative";
      } else if (index === "z") {
        mode2 = "unknown";
      } else if (index === "x" && length > 2) {
        mode2 = "absoluteLongIndexedX";
      } else {
        mode2 = length <= 1 ? "zeroPage" : "absolute";
        if (index === "x" || index === "y") {
          mode2 += "Indexed" + index.toUpperCase();
        }
      }
    }
  }
  return {
    mode: mode2,
    length,
    generated: whole.generated,
    value: whole.value,
    native: policy.whole.native,
    specialPage: mode2 === "absolute" && (whole.generated && whole.value >= 65280 && whole.value <= 65535 || policy.hexSpecialPage)
  };
}
function prepare65xx(syntax2, frame) {
  if (syntax2.policy65xx.parts.length === 1) {
    const first = classify(syntax2, frame);
    if (first.native && !(first.generated && (first.value < 0 || !Number.isInteger(first.value)))) {
      return first;
    }
  } else {
    for (const part of syntax2.policy65xx.parts) {
      expand(part, frame);
    }
  }
  return classify(syntax2, frame);
}
function generatedValue(value) {
  if (value < 0 || Number.isNaN(value)) {
    throw new Error("Invalid number: NaN");
  }
  if (!Number.isFinite(value)) {
    throw new Error("Invalid number: $" + String(value).toUpperCase());
  }
  if (!Number.isInteger(value)) {
    throw new Error("Invalid number: $" + value.toString(16).toUpperCase());
  }
  return value;
}
function selectedScalar(syntax2) {
  if (syntax2.policy65xx.whole.native || syntax2.operands.length >= 2 && syntax2.policy65xx.whole.index && syntax2.policy65xx.whole.scalar.expression.type === "error") {
    return syntax2.policy65xx.whole.scalar;
  }
  const selected = operandScalar(syntax2.operands[0]);
  if (selected?.expression.type === "template") {
    return syntax2.policy65xx.inner?.scalar ?? syntax2.policy65xx.whole.scalar;
  }
  return selected ?? syntax2.policy65xx.whole.scalar;
}

// packages/plugin-65xx/src/typed-architecture.ts
var directToAbsolute = {
  zeroPage: "absolute",
  zeroPageIndexedX: "absoluteIndexedX",
  zeroPageIndexedY: "absoluteIndexedY",
  zeroPageIndirect: "indirect",
  indexedIndirectX: "absoluteIndexedIndirect"
};
var absoluteToDirect = {
  absolute: "zeroPage",
  absoluteIndexedX: "zeroPageIndexedX",
  absoluteIndexedY: "zeroPageIndexedY",
  indirect: "zeroPageIndirect",
  absoluteIndexedIndirect: "indexedIndirectX"
};
var addressingModes = {
  implied: true,
  accumulator: true,
  immediate: true,
  zeroPage: true,
  zeroPageIndexedX: true,
  zeroPageIndexedY: true,
  absolute: true,
  absoluteIndexedX: true,
  absoluteIndexedY: true,
  absoluteLongIndexedX: true,
  indirect: true,
  zeroPageIndirect: true,
  zeroPageIndirectLong: true,
  indexedIndirectX: true,
  indirectIndexedY: true,
  absoluteIndexedIndirect: true,
  zeroPageIndirectIndexedZ: true,
  stackRelative: true,
  stackRelativeIndirectIndexedY: true,
  relative: true,
  relative16: true,
  zeroPageRelative: true,
  accumulatorRelative: true,
  zeroPageImmediate: true,
  specialPage: true,
  blockTransfer: true,
  immediateZeroPage: true,
  immediateZeroPageIndexedX: true,
  immediateAbsolute: true,
  immediateAbsoluteIndexedX: true,
  basePageIndirectIndexedZ: true,
  quadAccumulator: true
};
function isAddressingMode(value) {
  for (const mode2 of Object.keys(addressingModes)) {
    if (value === mode2) {
      return true;
    }
  }
  return false;
}
function mappedAddressingMode(table, mode2) {
  if (mode2 === void 0 || !isAddressingMode(mode2)) {
    return void 0;
  }
  return table[mode2];
}
var aliasToMnemonic = /* @__PURE__ */ new Map();
for (const form of nmos6502DecodeTable) {
  for (const alias of form.aliases ?? []) {
    aliasToMnemonic.set(alias, form.mnemonic);
  }
}
var modeSize = (form) => form.encoding.length + form.operands.reduce((size, operand) => size + operand.width, 0);
var TypedArch65xx = class {
  constructor(cpu) {
    this.cpu = cpu;
    this.forms = getCpuAssemblyForms(cpu).filter(
      (form) => matchesFeatures(form.availableWhen, cpu.features)
    );
    this.catalog = buildInstructionCatalog(this.forms);
    for (const form of this.forms) {
      this.formsByMnemonic.set(form.mnemonic, [
        ...this.formsByMnemonic.get(form.mnemonic) ?? [],
        form
      ]);
    }
  }
  cpu;
  deferOperandBindingErrors = true;
  forms;
  catalog;
  formsByMnemonic = /* @__PURE__ */ new Map();
  /** Failed binding retains parsed punctuation so addressing errors keep precedence over value reads. */
  syntax(frame) {
    const syntax2 = syntax65xx(frame.instruction.operands);
    return frame.bindingFailure ? { ...syntax2, operands: syntax2.policy65xx.unboundOperands } : syntax2;
  }
  /** Record classification effects before form selection; this receipt does not yet carry a size. */
  prepare(frame) {
    const state = prepare65xx(this.syntax(frame), frame);
    frame.chooseScalars(
      state.mode,
      0,
      state.mode,
      state.length,
      state.generated,
      state.value,
      state.native,
      state.specialPage
    );
  }
  /** Reuse this occurrence's preparation without repeating its width probes during encoding. */
  classification(frame) {
    const value = frame.preparation?.state;
    if (Array.isArray(value)) {
      const tuple = value;
      const [mode2, length, generated, scalar3, native, specialPage] = tuple;
      if (value.length !== 6 || typeof mode2 !== "string" || typeof length !== "number" || typeof generated !== "boolean" || typeof scalar3 !== "number" || typeof native !== "boolean" || typeof specialPage !== "boolean") {
        throw new Error("Invalid prepared 65xx snapshot.");
      }
      return { mode: mode2, length, generated, value: scalar3, native, specialPage };
    }
    if (value && typeof value === "object" && !Array.isArray(value) && "mode" in value && "length" in value && "generated" in value && "value" in value && "native" in value && "specialPage" in value && typeof value.mode === "string" && typeof value.length === "number" && typeof value.generated === "boolean" && typeof value.value === "number" && typeof value.native === "boolean" && typeof value.specialPage === "boolean") {
      return {
        mode: value.mode,
        length: value.length,
        generated: value.generated,
        value: value.value,
        native: value.native,
        specialPage: value.specialPage
      };
    }
    return prepare65xx(this.syntax(frame), frame);
  }
  estimate(frame) {
    const state = this.classification(frame);
    const form = this.resolveForm(frame, this.syntax(frame), state);
    const size = form ? modeSize(form) : 0;
    frame.choose(form ? form.mnemonic + ":" + form.mode : "unknown", size, {
      cpu: this.cpu.id,
      mode: form?.mode ?? "unknown"
    });
    return size;
  }
  resolveForm(frame, syntax2, operand) {
    const parsed = syntax2.policy65xx;
    let mnemonic = parsed.mnemonic;
    let forms = this.formsByMnemonic.get(mnemonic);
    if (!forms) {
      const canonical = aliasToMnemonic.get(mnemonic);
      const aliasedForms = canonical ? this.formsByMnemonic.get(canonical) : void 0;
      if (canonical && aliasedForms) {
        mnemonic = canonical;
        forms = aliasedForms;
      }
    }
    const { forcedWidth } = parsed;
    if (!forms) {
      const variantArchitectures = Object.entries(variantFormsByCpuId).filter(([, entries2]) => entries2.some((entry) => entry.mnemonic === parsed.mnemonic)).map(([cpuId]) => cpuId);
      if (variantArchitectures.length > 0) {
        throw frame.error(
          `Instruction '${parsed.mnemonic}' is available on ${variantArchitectures.join(", ")}, not ${this.cpu.id}.`
        );
      }
      const knownOnlyOn6502x = nmos6502DecodeTable.some(
        (form2) => form2.mnemonic === mnemonic || form2.aliases?.includes(mnemonic)
      );
      if (knownOnlyOn6502x) {
        throw frame.error(
          `Instruction '${mnemonic}' or this operand form requires architecture '65xx.6502x'.`
        );
      }
      return void 0;
    }
    const hasOperand = parsed.hasOperand;
    if (mnemonic === "BRK" && forcedWidth === 2) {
      throw frame.error("BRK accepts at most an 8-bit signature byte.");
    }
    let mode2 = operand.mode;
    if (parsed.originalRegister === "a") {
      mode2 = "accumulator";
    }
    if (parsed.originalRegister === "q") {
      mode2 = "quadAccumulator";
    }
    if (this.cpu.id === "65xx.m740" && mnemonic === "JSR" && mode2 === "absolute" && operand.specialPage) {
      mode2 = "specialPage";
    }
    if (hasOperand && forms.some((entry) => entry.mode === "relative16")) {
      mode2 = "relative16";
    } else if (hasOperand && forms.some((entry) => entry.mode === "relative")) {
      mode2 = "relative";
    }
    if (!hasOperand && !forms.some((entry) => entry.mode === "implied")) {
      if (forms.some((entry) => entry.mode === "accumulator")) {
        mode2 = "accumulator";
      } else if (forms.some((entry) => entry.mode === "quadAccumulator")) {
        mode2 = "quadAccumulator";
      }
    }
    if (forcedWidth) {
      const byteMode = mappedAddressingMode(absoluteToDirect, mode2);
      const wordMode = mappedAddressingMode(directToAbsolute, mode2);
      const alreadyRequestedWidth = forcedWidth === 1 && mode2.startsWith("zeroPage") || forcedWidth === 2 && (mode2 === "absolute" || mode2 === "indirect" || mode2.startsWith("absoluteIndexed"));
      if (!byteMode && !wordMode && !alreadyRequestedWidth) {
        throw frame.error(
          `Width suffix '.${forcedWidth === 1 ? "b" : "w"}' is not valid for ${mnemonic} ${mode2}.`
        );
      }
      const promoted = forcedWidth === 1 ? byteMode : wordMode;
      mode2 = promoted ?? mode2;
    }
    let form = forms.find((entry) => entry.mode === mode2);
    const widened = mappedAddressingMode(directToAbsolute, mode2);
    if (!form && widened) {
      form = forms.find((entry) => entry.mode === widened);
    }
    if (!form) {
      const accepted = forms.map((entry) => entry.mode).join(", ");
      throw frame.error(
        `${mnemonic} does not support addressing mode '${mode2}' on ${this.cpu.id}. Expected ${accepted}.`
      );
    }
    return form;
  }
  /** Validate the complete operand tuple before the first opcode/prefix write. */
  encode(frame, context) {
    const syntax2 = this.syntax(frame);
    const state = this.classification(frame);
    const form = this.resolveForm(frame, syntax2, state);
    if (!form) {
      return false;
    }
    frame.choose(form.mnemonic + ":" + form.mode, modeSize(form), {
      cpu: this.cpu.id,
      mode: form.mode
    });
    const scalar3 = selectedScalar(syntax2);
    const generated = state.generated && (!state.native || state.value < 0 || !Number.isInteger(state.value));
    const value = (width, description, immediate = false) => this.readValue(
      frame,
      scalar3,
      width,
      description,
      immediate,
      generated ? state.value : void 0,
      state.generated ? "$" + state.value.toString(16).toUpperCase() : syntax2.policy65xx.scalarDisplay,
      syntax2.policy65xx.whole.unbound
    );
    const p = syntax2.policy65xx.parts;
    const expect = (count, description) => {
      if (p.length !== count) {
        throw frame.error(form.mnemonic + " expects " + description + ".");
      }
    };
    const branch = (operand, prepared, display, unbound = false) => this.readBranch(
      frame,
      operand,
      form.relativeBaseOffset ?? modeSize(form),
      form.codec === "relative16" ? 2 : 1,
      prepared,
      display,
      unbound
    );
    const values = [];
    switch (form.codec) {
      case "none":
        break;
      case "unsigned8":
      case "unsigned16-le":
      case "unsigned24-le": {
        let width = 1;
        if (form.codec === "unsigned16-le") {
          width = 2;
        } else if (form.codec === "unsigned24-le") {
          width = 3;
        }
        const v = value(
          width,
          form.mnemonic + (width === 1 ? " operand" : " address"),
          state.mode === "immediate"
        );
        if (form.operandConstraint === "power-of-two" && (v === 0 || (v & v - 1) !== 0)) {
          throw frame.error(form.mnemonic + " operand must be a power of two.");
        }
        values.push(v);
        break;
      }
      case "relative8":
      case "relative16":
        values.push(
          branch(
            scalar3,
            state.generated ? state.value : void 0,
            state.generated ? "$" + state.value.toString(16).toUpperCase() : syntax2.policy65xx.scalarDisplay,
            syntax2.policy65xx.whole.unbound
          )
        );
        break;
      case "zero-page-relative8":
        expect(2, "a zero-page address and branch target");
        values.push(
          this.readValue(
            frame,
            p[0].scalar,
            1,
            form.mnemonic + " address",
            false,
            void 0,
            p[0].display,
            p[0].unbound
          ),
          branch(p[1].scalar, void 0, p[1].display, p[1].unbound)
        );
        break;
      case "accumulator-relative8":
        expect(2, "A and a branch target");
        if (syntax2.operands[0]?.kind !== "register" || syntax2.operands[0].name !== "a") {
          throw frame.error(form.mnemonic + " accumulator branch must use A.");
        }
        values.push(branch(p[1].scalar, void 0, p[1].display, p[1].unbound));
        break;
      case "zero-page-immediate8":
        expect(2, "a zero-page address and immediate value");
        if (!p[1].immediate) {
          throw frame.error(form.mnemonic + " second operand must be immediate.");
        }
        values.push(
          this.readValue(
            frame,
            p[0].scalar,
            1,
            form.mnemonic + " address",
            false,
            void 0,
            p[0].display,
            p[0].unbound
          ),
          this.readValue(
            frame,
            p[1].scalar,
            1,
            form.mnemonic + " immediate",
            true,
            void 0,
            p[1].display,
            p[1].unbound
          )
        );
        break;
      case "three-unsigned16-le":
        expect(3, "source, destination, and length operands");
        for (let i = 0; i < p.length; i++) {
          values.push(
            this.readValue(
              frame,
              p[i].scalar,
              2,
              form.mnemonic + " " + ["source", "destination", "length"][i],
              false,
              void 0,
              p[i].display,
              p[i].unbound
            )
          );
        }
        break;
      case "immediate-unsigned8":
      case "immediate-unsigned16": {
        const indexed = form.mode.endsWith("IndexedX");
        expect(indexed ? 3 : 2, "an immediate value and address");
        if (!p[0].immediate) {
          throw frame.error(form.mnemonic + " first operand must be immediate.");
        }
        values.push(
          this.readValue(
            frame,
            p[0].scalar,
            1,
            form.mnemonic + " immediate",
            true,
            void 0,
            p[0].display,
            p[0].unbound
          ),
          this.readValue(
            frame,
            p[1].scalar,
            form.codec === "immediate-unsigned8" ? 1 : 2,
            form.mnemonic + " address",
            false,
            void 0,
            p[1].display,
            p[1].unbound
          )
        );
        break;
      }
      case "special-page": {
        const v = value(2, form.mnemonic + " special-page address");
        if ((v & 65280) !== 65280) {
          throw frame.error(form.mnemonic + " special-page address must be in $FF00-$FFFF.");
        }
        values.push(v & 255);
        break;
      }
    }
    context.emission.writeBytes(form.encoding);
    for (let i = 0; i < values.length; i++) {
      const width = form.operands[i].width;
      const mask = 2 ** (width * 8) - 1;
      context.emission.writeValue(values[i] & mask, width, "little");
    }
    return true;
  }
  /** Validate before writing, retaining a classification value only when its evaluation schedule requires it. */
  readValue(frame, scalar3, width, description, immediate = false, prepared, displayText, unbound = false) {
    let value;
    if (unbound && frame.bindingFailure?.reason === "other") {
      throw new Error(frame.bindingFailure.message);
    } else if (prepared === void 0) {
      value = frame.evaluate(scalar3, "beforeOpcode", false, "numeric", displayText).value;
    } else {
      value = frame.stageName !== "emitProgram" && (!Number.isInteger(prepared) || prepared < 0) ? 0 : generatedValue(prepared);
      frame.observe(scalar3, value, "beforeOpcode", displayText);
    }
    const minimum = width === 1 && immediate ? -128 : 0;
    const maximum = 2 ** (width * 8) - 1;
    if (!Number.isInteger(value) || value < minimum || value > maximum) {
      throw frame.error(description + " " + value + " is outside the " + width * 8 + "-bit range.");
    }
    return value & maximum;
  }
  /** Relative streams select against the same reference cursor used by the wrapping subtraction. */
  readBranch(frame, scalar3, offset, width, prepared, displayText, unbound = false) {
    if (frame.stageName !== "emitProgram") {
      return 0;
    }
    const reference2 = frame.currentAddress() + offset & 65535;
    let target;
    if (unbound && frame.bindingFailure?.reason === "other") {
      throw new Error(frame.bindingFailure.message);
    } else if (prepared !== void 0) {
      target = generatedValue(prepared);
      frame.observe(scalar3, target, "beforeOpcode", displayText);
    } else if (scalar3.expression.type === "relativeReference" && scalar3.expression.stream === "relative") {
      const result = frame.reference(scalar3.expression, reference2);
      if (result.kind === "error") {
        throw result.error;
      }
      if (result.kind === "missing") {
        throw new Error("Error: Label '" + result.name + "' not found.");
      }
      target = result.value;
    } else {
      target = frame.evaluate(scalar3, "beforeOpcode", false, "numeric", displayText).value;
    }
    if (!Number.isInteger(target) || target < 0 || target > 65535) {
      throw frame.error("Branch target " + target + " is outside the 16-bit address space.");
    }
    const delta = (target - reference2 + 32768 & 65535) - 32768;
    const minimum = width === 1 ? -128 : -32768;
    const maximum = width === 1 ? 127 : 32767;
    if (delta < minimum || delta > maximum) {
      throw frame.error(
        "Branch target $" + target.toString(16).toUpperCase() + " is out of range from $" + reference2.toString(16).toUpperCase() + " (" + delta + ")."
      );
    }
    return delta;
  }
};

// packages/plugin-65xx/src/index.ts
var RAW_65XX_TARGET_ID = "65xx.raw";
var FLAT_65XX_ADDRESS_SPACE_ID = "65xx.flat16";
var RAW_65XX_OUTPUT_FORMAT_ID = "65xx.raw-output";
var RAW_65XX_LIFECYCLE_ID = "65xx.raw-lifecycle";
var CA65_RAW_65XX_TARGET_ID = "65xx.ca65-raw";
var CA65_65XX_DIRECTIVE_SET_ID = "65xx.ca65-directives";
var CA65_65XX_EXPRESSION_SET_ID = "65xx.ca65-expressions";
var CA65_65XX_LIFECYCLE_ID = "65xx.ca65-lifecycle";
function createRaw65xxTargetOptions(configured) {
  if (configured === void 0) {
    return { origin: 0 };
  }
  if (typeof configured !== "object" || configured === null || Array.isArray(configured)) {
    throw new Error("65xx raw target options must be an object with an optional numeric 'origin'.");
  }
  const keys = Object.keys(configured);
  const unknown = keys.filter((key) => key !== "origin");
  if (unknown.length > 0) {
    throw new Error(`Unknown 65xx raw target option(s): ${unknown.join(", ")}.`);
  }
  const value = "origin" in configured ? configured.origin : 0;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 65535) {
    throw new Error("65xx raw target origin must be an integer from 0 through 65535.");
  }
  return { origin: value };
}
var descriptor = (keyword, summary, syntax2, group) => ({ keyword, summary, syntax: syntax2, group });
var ca65Tooling = [
  descriptor("setcpu", "Select a 65xx CPU.", '.setcpu "CPU"', "architecture"),
  descriptor("cpu", "Alias for .setcpu.", '.cpu "CPU"', "architecture"),
  descriptor("pushcpu", "Push the current CPU.", ".pushcpu", "architecture"),
  descriptor("popcpu", "Restore the pushed CPU.", ".popcpu", "architecture"),
  descriptor("segment", "Switch to an ld65 segment.", '.segment "NAME"', "layout"),
  descriptor("pushseg", "Push the current flat segment.", ".pushseg", "layout"),
  descriptor("popseg", "Restore the pushed flat segment.", ".popseg", "layout"),
  descriptor("export", "Export a symbol to other files.", ".export ident[, ident...]", "label"),
  descriptor(
    "import",
    "Import a symbol defined in another file.",
    ".import ident[, ident...]",
    "label"
  ),
  descriptor("byte", "Emit one or more bytes.", ".byte value[, value...]", "data"),
  descriptor("byt", "Alias for .byte.", ".byt value[, value...]", "data"),
  descriptor("addr", "Emit 16-bit little-endian addresses.", ".addr value[, value...]", "data"),
  descriptor("word", "Alias for .addr.", ".word value[, value...]", "data"),
  descriptor(
    "lobytes",
    "Emit the low byte of each expression.",
    ".lobytes expr[, expr...]",
    "data"
  ),
  descriptor(
    "hibytes",
    "Emit the high byte of each expression.",
    ".hibytes expr[, expr...]",
    "data"
  ),
  descriptor("dbyt", "Emit 16-bit big-endian words.", ".dbyt value[, value...]", "data"),
  descriptor("dword", "Emit 32-bit little-endian values.", ".dword value[, value...]", "data"),
  descriptor(
    "faraddr",
    "Emit 24-bit little-endian addresses.",
    ".faraddr value[, value...]",
    "data"
  ),
  descriptor("res", "Reserve bytes with an optional fill value.", ".res count[, fill]", "data"),
  descriptor("align", "Align the location counter.", ".align boundary[, fill]", "layout"),
  descriptor("incbin", "Include a binary range.", '.incbin "file"[, offset[, size]]', "include"),
  descriptor(
    "assert",
    "Require an expression to be true.",
    '.assert expr[, error[, "message"]]',
    "diagnostic"
  ),
  descriptor("scope", "Enter a lexical scope.", ".scope [name]", "label"),
  descriptor("endscope", "Leave a lexical scope.", ".endscope", "label"),
  descriptor("proc", "Define and enter a procedure scope.", ".proc name", "label"),
  descriptor("endproc", "Leave a procedure scope.", ".endproc", "label")
];
var ca65ExpressionFunctions = [
  ["lobyte", "Low byte of a value.", (value) => value & 255],
  ["hibyte", "High byte of a value.", (value) => value >>> 8 & 255],
  ["bankbyte", "Bank byte of a value.", (value) => value >>> 16 & 255],
  ["loword", "Low word of a value.", (value) => value & 65535],
  ["hiword", "High word of a value.", (value) => value >>> 16 & 65535]
];
var directive = (id, keywords) => {
  const wanted = new Set(keywords);
  return {
    id,
    keywords,
    phase: "lowered",
    syntax: ca65DirectiveSyntax(id),
    tooling: ca65Tooling.filter((entry) => wanted.has(entry.keyword))
  };
};
function validate2(address2) {
  if (!Number.isInteger(address2) || address2 < 0 || address2 > 65535) {
    throw new Error(`Address $${address2.toString(16).toUpperCase()} is outside flat16.`);
  }
  return address2;
}
function createFlat65xxAddressSpace({ options }) {
  const { origin } = createRaw65xxTargetOptions(options);
  return {
    addressWidth: 16,
    defaultOrigin: origin,
    normalizeForWrite: validate2,
    advance(address2, amount) {
      return validate2(address2 + amount);
    },
    toOutputOffset(address2) {
      return Number.isInteger(address2) && address2 >= origin && address2 <= 65535 ? address2 - origin : -1;
    },
    fromOutputOffset(offset) {
      const address2 = origin + offset;
      return Number.isInteger(offset) && offset >= 0 && address2 <= 65535 ? address2 : -1;
    },
    validateWrite(address2, width) {
      validate2(address2);
      validate2(address2 + width - 1);
      if (address2 < origin) {
        throw new Error(
          `Address $${address2.toString(16).toUpperCase()} precedes raw origin $${origin.toString(16).toUpperCase()}.`
        );
      }
    }
  };
}
function updatePredicates(session, architecture) {
  for (const symbol of new Set(Object.values(ca65CpuPredicateByArchitecture))) {
    session.globalSymbols.add(symbol);
    session.labelTable.set(symbol, {
      value: ca65CpuPredicateByArchitecture[architecture] === symbol ? 1 : 0,
      isStatic: true
    });
  }
}
function register65xxContributions(context) {
  for (const format of nesAssetFormats) {
    context.registerAssetFormat(format);
  }
  for (const [cpu, forms] of [
    [nmos6502Cpu, nmos6502Forms],
    [nmos6502xCpu, nmos6502xForms],
    [ricoh2a03Cpu, nmos6502xForms],
    ...variantCpus.map(
      (variantCpu) => [variantCpu, variantFormsByCpuId[variantCpu.id] ?? []]
    )
  ]) {
    const catalog = buildInstructionCatalog(forms);
    context.registerArchitecture({
      id: cpu.id,
      operandGrammar: { version: "2", parse: parse65xxOperands },
      aliases: cpu.aliases,
      displayName: cpu.displayName,
      unknownInstructionBehavior: "throw",
      // Same as 65816: `LDA $12,x` is one operand, not two.
      createTypedEncoder: () => new TypedArch65xx(cpu),
      // Vendor/CMOS tables have different semantics; expose the decoder only for NMOS/Ricoh profiles.
      createDecoder: cpu.features.has("nmos") && !cpu.features.has("dtv") ? () => new Cpu6502Decoder(cpu) : void 0,
      instructionSpecifications: cpu.features.has("nmos") && !cpu.features.has("dtv") ? cpu6502Specifications(cpu) : void 0,
      instructions: catalog
    });
  }
  context.registerAddressSpace({
    id: FLAT_65XX_ADDRESS_SPACE_ID,
    create: createFlat65xxAddressSpace
  });
  context.registerOutputFormat({
    id: RAW_65XX_OUTPUT_FORMAT_ID,
    // Emit the buffer as a headerless image, without checksum or padding.
    create: () => ({
      finalize: () => void 0,
      getOutput: ({ outputBytes }) => Uint8Array.from(outputBytes)
    })
  });
  context.registerLifecycle({
    id: RAW_65XX_LIFECYCLE_ID,
    create: ({ options }) => {
      const { origin } = createRaw65xxTargetOptions(options);
      return {
        onStageStart: ({ session }) => {
          session.setWritePosition(origin);
          session.bytes = 0;
        }
      };
    }
  });
  context.registerTarget({
    id: RAW_65XX_TARGET_ID,
    aliases: ["65xx", "6502-raw"],
    displayName: "65xx flat 16-bit raw binary",
    defaultArchitecture: nmos6502Cpu.id,
    architectures: [
      nmos6502Cpu.id,
      nmos6502xCpu.id,
      ricoh2a03Cpu.id,
      ...variantCpus.map((cpu) => cpu.id)
    ],
    addressSpace: FLAT_65XX_ADDRESS_SPACE_ID,
    outputFormat: RAW_65XX_OUTPUT_FORMAT_ID,
    directiveSets: [],
    expressionSets: [],
    lifecycle: [RAW_65XX_LIFECYCLE_ID],
    syntaxProfile: NATIVE_SYNTAX_PROFILE,
    defaultOutputExtension: ".bin",
    createOptions: createRaw65xxTargetOptions
  });
  context.registerSessionState({
    id: CA65_65XX_SESSION_STATE_ID,
    create: createCa65SessionState,
    clone: cloneCa65SessionState,
    resetForStage: resetCa65StageState
  });
  context.registerExpressionSet({
    id: CA65_65XX_EXPRESSION_SET_ID,
    functions: ca65ExpressionFunctions.map(([name, summary, transform]) => ({
      name,
      signature: { parameters: ["value"], minimumArguments: 1, maximumArguments: 1 },
      summary,
      evaluate: (_expressionContext, args) => {
        const value = args[0];
        if (typeof value !== "number") {
          throw new Error(`${name}() expects a numeric argument.`);
        }
        return transform(value);
      }
    }))
  });
  context.registerLifecycle({
    id: CA65_65XX_LIFECYCLE_ID,
    create: () => {
      return {
        onSessionCreated: ({ session, state }) => {
          const profile = state.get(ca65SessionStateKey);
          profile.defaultArchitecture = session.resolveActiveArchitecture().name;
          profile.currentArchitecture = profile.defaultArchitecture;
          updatePredicates(session, profile.defaultArchitecture);
        },
        onStageStart: ({ session, state }) => {
          const profile = state.get(ca65SessionStateKey);
          session.selectArchitecture(profile.defaultArchitecture, profile.defaultArchitecture);
        },
        onArchitectureSelected: ({ session, state, architecture }) => {
          const profile = state.get(ca65SessionStateKey);
          profile.currentArchitecture = architecture;
          updatePredicates(session, architecture);
        }
      };
    }
  });
  context.registerTarget({
    id: CA65_RAW_65XX_TARGET_ID,
    aliases: ["ca65-raw"],
    displayName: "65xx ca65-compatible flat 16-bit raw binary",
    defaultArchitecture: nmos6502Cpu.id,
    architectures: [
      nmos6502Cpu.id,
      nmos6502xCpu.id,
      ricoh2a03Cpu.id,
      ...variantCpus.map((cpu) => cpu.id)
    ],
    addressSpace: FLAT_65XX_ADDRESS_SPACE_ID,
    outputFormat: RAW_65XX_OUTPUT_FORMAT_ID,
    directiveSets: [CA65_65XX_DIRECTIVE_SET_ID],
    expressionSets: [CA65_65XX_EXPRESSION_SET_ID],
    lifecycle: [RAW_65XX_LIFECYCLE_ID, CA65_65XX_LIFECYCLE_ID],
    syntaxProfile: CA65_65XX_SYNTAX_PROFILE,
    defaultOutputExtension: ".bin",
    createOptions: createRaw65xxTargetOptions
  });
  context.registerSessionState({
    id: NES_65XX_SESSION_STATE_ID,
    create: createInitialNesState,
    clone: cloneNes65xxSessionState,
    resetForStage: resetNes65xxStageState
  });
  context.registerAddressSpace({
    id: NES_65XX_ADDRESS_SPACE_ID,
    create: createNesAddressSpace
  });
  context.registerOutputFormat({
    id: NES_65XX_OUTPUT_FORMAT_ID,
    create: createNesOutputFormat
  });
  context.registerLifecycle({
    id: NES_65XX_LIFECYCLE_ID,
    create: createNesLifecycle
  });
  context.registerDirectiveSet({
    id: CA65_65XX_DIRECTIVE_SET_ID,
    directives: [
      directive("65xx.directive.segment", ["segment"]),
      directive("65xx.directive.setcpu", ["setcpu", "cpu"]),
      directive("65xx.directive.pushcpu", ["pushcpu"]),
      directive("65xx.directive.popcpu", ["popcpu"]),
      directive("65xx.directive.cpu-shorthand", Object.keys(ca65CpuShorthands)),
      directive("65xx.directive.export", ["export"]),
      directive("65xx.directive.import", ["import"]),
      directive("65xx.directive.byte", ["byte", "byt"]),
      directive("65xx.directive.addr", ["addr", "word"]),
      directive("65xx.directive.lobytes", ["lobytes"]),
      directive("65xx.directive.hibytes", ["hibytes"]),
      directive("65xx.directive.dbyt", ["dbyt"]),
      directive("65xx.directive.dword", ["dword"]),
      directive("65xx.directive.faraddr", ["faraddr"]),
      directive("65xx.directive.res", ["res"]),
      directive("65xx.directive.align", ["align"]),
      directive("65xx.directive.incbin", ["incbin"]),
      directive("65xx.directive.assert", ["assert"]),
      directive("65xx.directive.scope", ["scope", "proc"]),
      directive("65xx.directive.endscope", ["endscope", "endproc"]),
      directive("65xx.directive.pushseg", ["pushseg"]),
      directive("65xx.directive.popseg", ["popseg"]),
      directive("65xx.directive.unsupported-object", [
        "autoimport",
        "constructor",
        "debuginfo",
        "destructor",
        "exportzp",
        "forceimport",
        "globalzp",
        "importzp",
        "interruptor",
        "reloc"
      ]),
      directive("65xx.directive.unsupported-macro", ["exitmacro", "local"])
    ],
    tooling: ca65Tooling
  });
  context.registerTarget({
    id: NES_65XX_TARGET_ID,
    aliases: ["nes", "ines", "6502-nes"],
    displayName: "NES iNES (Asar source or ca65 layout)",
    defaultArchitecture: nmos6502Cpu.id,
    architectures: [
      nmos6502Cpu.id,
      nmos6502xCpu.id,
      ricoh2a03Cpu.id,
      ...variantCpus.map((cpu) => cpu.id)
    ],
    addressSpace: NES_65XX_ADDRESS_SPACE_ID,
    outputFormat: NES_65XX_OUTPUT_FORMAT_ID,
    directiveSets: [CA65_65XX_DIRECTIVE_SET_ID],
    expressionSets: [CA65_65XX_EXPRESSION_SET_ID],
    lifecycle: [NES_65XX_LIFECYCLE_ID, CA65_65XX_LIFECYCLE_ID],
    syntaxProfile: CA65_65XX_SYNTAX_PROFILE,
    createSyntaxProfile: (options) => options.sourceStyle === "asar" ? ASAR_SYNTAX_PROFILE : CA65_65XX_SYNTAX_PROFILE,
    defaultOutputExtension: ".nes",
    createOptions: createNes65xxTargetOptions
  });
}
function validate65xxPluginOptions(configured) {
  if (configured && typeof configured === "object" && !Array.isArray(configured) && ("header" in configured || "linkerConfig" in configured || "fillByte" in configured || "sourceStyle" in configured)) {
    const unknown = Object.keys(configured).filter(
      (key) => !["header", "linkerConfig", "fillByte", "sourceStyle"].includes(key)
    );
    if (unknown.length) {
      throw new Error(`Unknown NES target option(s): ${unknown.join(", ")}.`);
    }
    createNes65xxTargetOptions(configured);
    return { ...configured };
  }
  return createRaw65xxTargetOptions(configured);
}
var plugin = definePlugin({
  manifest: {
    id: "uttori.asm-plugin-65xx",
    name: "Uttori ASM 65xx",
    version: "1.0.0",
    apiVersion: PLUGIN_API_VERSION,
    description: "65xx NMOS, CMOS, Commodore, MEGA65, Hudson, and Mitsubishi architectures with raw and NES iNES targets."
  },
  validateOptions: validate65xxPluginOptions,
  activate: register65xxContributions
});

// packages/plugin-snes/src/architectures/65816-spec.ts
var mode = (id, syntax2, minimumSize, maximumSize = minimumSize, widthFlag) => ({
  id,
  syntax: syntax2,
  minimumSize,
  maximumSize,
  ...widthFlag ? { widthFlag } : {}
});
var cpu65816Modes = Object.freeze({
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
function isCpu65816ModeKey(value) {
  return Object.hasOwn(cpu65816Modes, value);
}
var opcodeRows = [
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
var summaries2 = {
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
var conditionalBranches = /* @__PURE__ */ new Set([
  "BCC",
  "BCS",
  "BEQ",
  "BMI",
  "BNE",
  "BPL",
  "BVC",
  "BVS"
]);
var flowFor = (mnemonic, addressingMode) => {
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
var effects = {
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
var entries = opcodeRows.flatMap((row) => row.split(" "));
if (entries.length !== 256) {
  throw new Error(`65816 opcode table has ${entries.length} entries.`);
}
var cpu65816Specifications = Object.freeze(
  entries.map((entry, opcode) => {
    const [mnemonic, modeKeyText] = entry.split(":");
    if (!mnemonic || !isCpu65816ModeKey(modeKeyText)) {
      throw new Error(`Invalid 65816 opcode entry '${entry}'.`);
    }
    const definition = cpu65816Modes[modeKeyText];
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
      summary: summaries2[mnemonic] ?? `${mnemonic} instruction.`,
      flow: flowFor(mnemonic, definition.id),
      effects: effects[mnemonic] ?? [],
      ...definition.widthFlag ? { widthFlag: definition.widthFlag } : {},
      ...operandStatusEffect ? { operandStatusEffect } : {}
    });
  })
);

// packages/plugin-snes/src/architectures/65816-decoder.ts
var flagValue = (value) => {
  if (value === true || value === 1) {
    return 1;
  }
  if (value === false || value === 0) {
    return 0;
  }
  return "unknown";
};
var resolvedWidthFlag = (state, flag) => {
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
var readLittleEndian = (bytes, offset, width) => {
  let value = 0;
  for (let index = 0; index < width; index++) {
    value |= (bytes[offset + index] ?? 0) << index * 8;
  }
  return value >>> 0;
};
function byteAt(bytes, index) {
  return index >= 0 && index < bytes.length ? bytes[index] : void 0;
}
var signed = (value, width) => {
  const signBit = 1 << width * 8 - 1;
  const modulus = 2 ** (width * 8);
  return value & signBit ? value - modulus : value;
};
var bankLocalTarget = (logicalAddress, size, displacement) => logicalAddress & 16711680 | logicalAddress + size + displacement & 65535;
var addressOperand = (value, width) => ({
  kind: "address",
  value,
  width
});
var operandsFor = (specification, bytes, logicalAddress) => {
  const firstOperandByte = byteAt(bytes, 1);
  const value8 = firstOperandByte ?? 0;
  const value16 = readLittleEndian(bytes, 1, 2);
  const value24 = readLittleEndian(bytes, 1, 3);
  switch (specification.mode) {
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
        { kind: "bank", value: byteAt(bytes, 2) ?? 0, width: 1 }
      ];
    default:
      return [];
  }
};
var targetFor = (specification, operands, state, logicalAddress) => {
  const operand = operands.length > 0 ? operands[0] : void 0;
  if (!operand) {
    return void 0;
  }
  if (operand.targetAddress !== void 0) {
    return operand.targetAddress;
  }
  if (operand.value === void 0) {
    return void 0;
  }
  if (specification.mode === "absoluteLong") {
    return operand.value;
  }
  if (specification.mode === "absolute") {
    const bank = (state.programBank ?? logicalAddress >>> 16) & 255;
    return bank << 16 | operand.value;
  }
  return void 0;
};
var referencesFor = (specification, operands, state, logicalAddress) => {
  const { mnemonic, mode: mode2 } = specification;
  const isBranch = conditionalBranches.has(mnemonic) || mnemonic === "BRA" || mnemonic === "BRL";
  const isCall = mnemonic === "JSR" || mnemonic === "JSL";
  const isJump = mnemonic === "JMP" || mnemonic === "JML";
  if (isBranch || isCall || isJump) {
    const target = targetFor(specification, operands, state, logicalAddress);
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
        ...mode2.includes("Indirect") ? { indirect: true } : {}
      }
    ];
  }
  if (mode2.includes("Indirect")) {
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
  const memoryMode = mode2.startsWith("direct") || mode2.startsWith("absolute") || mode2.startsWith("stackRelative");
  if (!memoryMode || operands[0]?.value === void 0) {
    return [];
  }
  if (mode2.startsWith("direct")) {
    return [
      {
        kind: "data",
        operandIndex: 0,
        ...state.directPage === void 0 ? {} : { address: state.directPage + operands[0].value & 65535 }
      }
    ];
  }
  if (!mode2.startsWith("absoluteLong") && mode2.startsWith("absolute")) {
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
var effectsFor = (specification, operands) => {
  const mask = operands[0]?.value;
  if (specification.operandStatusEffect && mask !== void 0) {
    return [{ kind: specification.operandStatusEffect, target: "p", mask }];
  }
  return specification.effects;
};
var buildInstruction = (specification, bytes, context, state) => {
  const operands = operandsFor(specification, bytes, context.logicalAddress);
  return {
    architecture: "snes.65816",
    specificationId: specification.id,
    opcode: specification.opcode[0],
    mnemonic: specification.mnemonic,
    mode: specification.mode,
    offset: context.offset,
    logicalAddress: context.logicalAddress & 16777215,
    bytes,
    size: bytes.length,
    operands,
    references: referencesFor(specification, operands, state, context.logicalAddress),
    flow: specification.flow,
    effects: effectsFor(specification, operands)
  };
};
var Cpu65816Decoder = class {
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
    const specification = opcode >= 0 && opcode < cpu65816Specifications.length ? cpu65816Specifications[opcode] : void 0;
    if (!specification) {
      return {
        kind: "error",
        code: "invalidOpcode",
        message: `Unknown 65816 opcode $${opcode.toString(16).padStart(2, "0")}.`,
        offset: context.offset
      };
    }
    const state = context.state ?? {};
    let sizes = [specification.minimumSize];
    if (specification.widthFlag) {
      const width = resolvedWidthFlag(state, specification.widthFlag);
      sizes = width === "unknown" ? [2, 3] : [width === 1 ? 2 : 3];
    }
    const minimumSize = Math.min(...sizes);
    const maximumSize = Math.max(...sizes);
    if (availableBytes < minimumSize) {
      return {
        kind: "error",
        code: "truncated",
        message: `Truncated ${specification.mnemonic}: requires at least ${minimumSize} byte(s), ${availableBytes} available.`,
        offset: context.offset,
        requiredBytes: minimumSize,
        availableBytes
      };
    }
    if (sizes.length === 1 && availableBytes < maximumSize) {
      return {
        kind: "error",
        code: "truncated",
        message: `Truncated ${specification.mnemonic}: requires ${maximumSize} byte(s), ${availableBytes} available.`,
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
      return buildInstruction(specification, bytes, context, state);
    });
    if (sizes.length === 2) {
      return {
        kind: "ambiguous",
        reason: `The 65816 ${specification.widthFlag?.toUpperCase()} flag is unknown.`,
        requiredState: [specification.widthFlag ?? "m"],
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
var hex2 = (value, width) => `$${(value >>> 0).toString(16).toUpperCase().padStart(width * 2, "0").slice(-width * 2)}`;
function formatCpu65816Instruction(instruction) {
  if (instruction.architecture !== "snes.65816") {
    throw new Error(`Cannot format architecture '${instruction.architecture}' as 65816.`);
  }
  const operand = instruction.operands.length > 0 ? instruction.operands[0] : void 0;
  const value = operand?.value ?? 0;
  let text = "";
  switch (instruction.mode) {
    case "implied":
      break;
    // The project encoder's native accumulator spelling omits the operand.
    case "accumulator":
      break;
    case "signature":
      text = `#${hex2(value, 1)}`;
      break;
    case "immediate":
      text = `#${hex2(value, operand?.width ?? 1)}`;
      break;
    case "immediate16":
      text = hex2(value, 2);
      break;
    case "direct":
      text = hex2(value, 1);
      break;
    case "directIndexedX":
      text = `${hex2(value, 1)},x`;
      break;
    case "directIndexedY":
      text = `${hex2(value, 1)},y`;
      break;
    case "directIndirect":
      text = instruction.mnemonic === "PEI" ? hex2(value, 1) : `(${hex2(value, 1)})`;
      break;
    case "directIndirectLong":
      text = `[${hex2(value, 1)}]`;
      break;
    case "directIndexedXIndirect":
      text = `(${hex2(value, 1)},x)`;
      break;
    case "directIndirectIndexedY":
      text = `(${hex2(value, 1)}),y`;
      break;
    case "directIndirectLongIndexedY":
      text = `[${hex2(value, 1)}],y`;
      break;
    case "stackRelative":
      text = `${hex2(value, 1)},s`;
      break;
    case "stackRelativeIndirectIndexedY":
      text = `(${hex2(value, 1)},s),y`;
      break;
    case "absolute":
      text = hex2(value, 2);
      break;
    case "absoluteIndexedX":
      text = `${hex2(value, 2)},x`;
      break;
    case "absoluteIndexedY":
      text = `${hex2(value, 2)},y`;
      break;
    case "absoluteLong":
      text = hex2(value, 3);
      break;
    case "absoluteLongIndexedX":
      text = `${hex2(value, 3)},x`;
      break;
    case "absoluteIndirect":
      text = `(${hex2(value, 2)})`;
      break;
    case "absoluteIndexedXIndirect":
      text = `(${hex2(value, 2)},x)`;
      break;
    case "absoluteIndirectLong":
      text = `[${hex2(value, 2)}]`;
      break;
    case "relative":
      text = hex2(operand?.targetAddress ?? 0, 3);
      break;
    case "relativeLong":
      text = instruction.mnemonic === "PER" ? hex2(value, 2) : hex2(operand?.targetAddress ?? 0, 3);
      break;
    case "blockMove":
      text = `${hex2(instruction.operands[0]?.value ?? 0, 1)},${hex2(instruction.operands[1]?.value ?? 0, 1)}`;
      break;
    default:
      throw new Error(`Unsupported 65816 formatter mode '${instruction.mode}'.`);
  }
  return text ? `${instruction.mnemonic} ${text}` : instruction.mnemonic;
}

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
        maxBatchEvents: ARES_TRACE_BATCH_EVENTS,
        instructionDetails: false
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
var ARES_NES_CAPABILITIES = Object.freeze({
  ...ARES_RSP_CAPABILITIES,
  architectures: [
    {
      architecture: "65xx.2a03",
      addressSpaces: [
        "nes.cpu",
        "nes.ram",
        "nes.prg-rom",
        "nes.chr-rom",
        "nes.prg-ram",
        "nes.ppu-snapshot",
        "nes.chr-ram"
      ],
      memorySpaces: [
        "nes.ram",
        "nes.prg-rom",
        "nes.chr-rom",
        "nes.prg-ram",
        "nes.ppu-snapshot",
        "nes.chr-ram",
        "nes.cpu"
      ].map((addressSpace) => ({ addressSpace, sideEffectFree: true })),
      trace: {
        addressSpaces: ["nes.cpu"],
        maxBufferedEvents: ARES_TRACE_BUFFER_EVENTS,
        maxBatchEvents: ARES_TRACE_BATCH_EVENTS,
        instructionDetails: true
      },
      pause: true,
      step: true,
      stepKinds: ARES_STEP_KINDS,
      registers: true,
      memory: true,
      stackFrames: true,
      breakpoints: true,
      disassemble: true
    }
  ]
});

// packages/debug-sidecar-ares/src/trace-details.ts
var integer2 = (value, maximum = Number.MAX_SAFE_INTEGER) => {
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
  const rows2 = match[5] === "" ? [] : match[5].split(";");
  if (rows2.length && rows2.pop() !== "") {
    throw new Error("Rich trace row is unterminated.");
  }
  if (rows2.length > maximum || rows2.length > 240) {
    throw new Error("Rich trace exceeds the requested batch limit.");
  }
  const addresses2 = [];
  const details = rows2.map((row) => {
    const fields = row.split(",");
    if (fields.length !== 5 || !/^[\da-f]{40}$/i.test(fields[1]) || !/^[\da-f]{2,8}$/i.test(fields[2]) || fields[2].length % 2 !== 0 || fields[4].length % 21 !== 0 || fields[4].length > 32 * 21) {
      throw new Error("Malformed rich trace instruction fields.");
    }
    addresses2.push(integer2(fields[0], 16777215));
    const names = ["a", "x", "y", "s", "d", "db", "pb", "pc", "p", "e"];
    const maxima = [65535, 65535, 65535, 65535, 65535, 255, 255, 65535, 255, 1];
    const state = Object.fromEntries(
      names.map((name, index) => [
        name,
        integer2(fields[1].slice(index * 4, index * 4 + 4), maxima[index])
      ])
    );
    if ((state.pb << 16 | state.pc) !== addresses2.at(-1)) {
      throw new Error("Trace PC disagrees with captured processor state.");
    }
    const memoryAccesses = Array.from({ length: fields[4].length / 21 }, (_, index) => {
      const raw = fields[4].slice(index * 21, index * 21 + 21);
      const actor = ["cpu", "dma", "hdma"][integer2(raw[19], 2)];
      const channel = integer2(raw[20], 15);
      if (actor === "cpu" && channel !== 15 || actor !== "cpu" && channel > 7) {
        throw new Error("Invalid trace DMA channel.");
      }
      return {
        addressSpace: "snes.cpu",
        address: integer2(raw.slice(0, 16), 16777215),
        value: integer2(raw.slice(16, 18), 255),
        access: ["read", "write", "fetch"][integer2(raw[18], 2)],
        width: 1,
        actor,
        ...actor === "cpu" ? {} : { channel }
      };
    });
    return {
      bytes: Array.from(Buffer.from(fields[2], "hex")),
      state,
      memoryAccesses,
      droppedMemoryAccesses: integer2(fields[3])
    };
  });
  const sequenceStart = integer2(match[2]);
  if (sequenceStart < 1) {
    throw new Error("Invalid trace sequence.");
  }
  return {
    architecture: "snes.65816",
    addressSpace: "snes.cpu",
    addresses: addresses2,
    details,
    sequenceStart,
    droppedEvents: integer2(match[3]),
    unattributedMemoryAccesses: integer2(match[4]),
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
var littleEndian2 = (hex3) => {
  const bytes = hex3.match(/../g);
  if (!bytes || bytes.join("") !== hex3) {
    throw new Error("Malformed little-endian register data.");
  }
  return Number.parseInt(bytes.toReversed().join(""), 16);
};
var registerHex = (value, bits) => value.toString(16).toUpperCase().padStart(Math.ceil(bits / 4), "0");
var encode = (value) => Buffer.from(value, "utf8").toString("hex");
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
var logicalPc = (registers) => (registers.pb << 16 | registers.pc) & 16777215;
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
  #nes = false;
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
    if (this.#nes) {
      return ARES_NES_CAPABILITIES;
    }
    if (!this.#richTrace) {
      return ARES_RSP_CAPABILITIES;
    }
    return {
      ...ARES_RSP_CAPABILITIES,
      // Negotiated capabilities must copy nested values so enabling rich trace cannot mutate the shared baseline.
      // oxlint-disable-next-line oxc/no-map-spread
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
  #nesPrgFileOffset;
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
    this.#nesPrgFileOffset = options.nesPrgFileOffset ?? 16;
    if (![16, 528].includes(this.#nesPrgFileOffset)) {
      throw new Error("Invalid iNES PRG file offset.");
    }
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
      this.#nes = target.includes("dev.ares.ricoh2a03.core");
      const registerNames = this.#nes ? ["a", "x", "y", "s", "pc", "p"] : ["a", "x", "y", "s", "d", "db", "pb", "pc", "p", "e"];
      for (const register of registerNames) {
        if (!target.includes(`name="${register}"`)) {
          throw new Error(`ares RSP target description is missing register '${register}'.`);
        }
      }
      this.#richTrace = !this.#nes && supported.includes("uttoriInstructionDetails+") && supported.includes("uttoriSramMemory+") && supported.includes("uttoriAramMemory+");
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
      {
        id: ARES_65816_THREAD_ID,
        name: "Main CPU",
        architecture: this.#nes ? "65xx.2a03" : ARES_65816_ARCHITECTURE
      }
    ]);
  }
  /** @inheritdoc */
  async stackFrames(threadId) {
    this.#assertThread(threadId);
    const registers = await this.#registerSnapshot();
    return [
      {
        id: ARES_65816_FRAME_ID,
        threadId: ARES_65816_THREAD_ID,
        name: this.#nes ? "Ricoh 2A03" : "65816",
        pc: await this.#currentAddress(logicalPc(registers)),
        currentOnly: true
      }
    ];
  }
  /** @inheritdoc */
  async registers(frameId) {
    if (frameId !== ARES_65816_FRAME_ID) {
      throw new Error(`Unknown ares frame ${frameId}.`);
    }
    const registers = await this.#registerSnapshot();
    if (this.#nes) {
      return ["a", "x", "y", "s", "p", "pc"].map((name) => {
        const bits = name === "pc" ? 16 : 8;
        return {
          name: name.toUpperCase(),
          value: registerHex(registers[name], bits),
          bits,
          group: "CPU"
        };
      });
    }
    return [
      { name: "A", value: registerHex(registers.a, 16), bits: 16, group: "CPU" },
      { name: "X", value: registerHex(registers.x, 16), bits: 16, group: "CPU" },
      { name: "Y", value: registerHex(registers.y, 16), bits: 16, group: "CPU" },
      { name: "S", value: registerHex(registers.s, 16), bits: 16, group: "CPU" },
      { name: "D", value: registerHex(registers.d, 16), bits: 16, group: "CPU" },
      { name: "DB", value: registerHex(registers.db, 8), bits: 8, group: "CPU" },
      { name: "PB", value: registerHex(registers.pb, 8), bits: 8, group: "CPU" },
      { name: "PC", value: registerHex(logicalPc(registers), 24), bits: 24, group: "CPU" },
      { name: "P", value: registerHex(registers.p, 8), bits: 8, group: "CPU" },
      { name: "E", value: registerHex(registers.e, 8), bits: 8, group: "CPU" }
    ];
  }
  /** @inheritdoc */
  async readMemory(address2, count) {
    const extra = this.#richTrace && (address2.architecture === "snes.65816" && address2.addressSpace === "snes.sram" || address2.architecture === "snes.spc700" && address2.addressSpace === "snes.spc700.aram");
    let checked;
    if (this.#nes) {
      if (address2.architecture !== "65xx.2a03" || ![
        "nes.cpu",
        "nes.ram",
        "nes.prg-rom",
        "nes.chr-rom",
        "nes.prg-ram",
        "nes.ppu-snapshot",
        "nes.chr-ram"
      ].includes(address2.addressSpace)) {
        throw new Error("Unsupported NES memory address.");
      }
      checked = { ...address2 };
    } else {
      checked = extra ? { ...address2 } : checkedMemoryAddress(address2, "Memory request");
    }
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
    const requested = addresses2.map((entry, index) => {
      if (!this.#nes) {
        return checkedAddress(entry, `Breakpoint ${index}`);
      }
      if (entry.architecture !== "65xx.2a03" || !["nes.cpu", "65xx.ines-address-space"].includes(entry.addressSpace)) {
        throw new Error("Unsupported NES breakpoint address.");
      }
      checkedInteger(entry.address, "NES CPU address", 65535);
      if (entry.outputOffset !== void 0) {
        checkedInteger(entry.outputOffset, "NES output offset", 524816);
        if (entry.outputOffset < this.#nesPrgFileOffset) {
          throw new Error("A cartridge header is not executable.");
        }
        return {
          ...entry,
          address: 4294967296 + (entry.outputOffset - this.#nesPrgFileOffset) * 65536 + entry.address
        };
      }
      return entry;
    });
    if (new Set(requested.map(({ address: address2 }) => address2)).size !== requested.length) {
      throw new Error("Duplicate ares execute breakpoint addresses are not allowed.");
    }
    const wanted = new Set(requested.map(({ address: address2 }) => address2));
    for (const address2 of this.#breakpoints.keys()) {
      if (wanted.has(address2)) {
        continue;
      }
      expectOkay(await client.request(`z0,${address2.toString(16)},1`), "Remove breakpoint");
      this.#breakpoints.delete(address2);
    }
    const results = [];
    for (const [index, value] of requested.entries()) {
      const existing = this.#breakpoints.get(value.address);
      if (existing) {
        results.push(existing);
        continue;
      }
      const response = await client.request(`Z0,${value.address.toString(16)},1`);
      const breakpoint = {
        id: this.#nextBreakpointId++,
        address: addresses2[index],
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
  async disassemble(address2, count) {
    if (this.#nes) {
      if (address2.architecture !== "65xx.2a03" || address2.addressSpace !== "nes.cpu") {
        throw new Error("Unsupported NES disassembly address.");
      }
      checkedInteger(address2.address, "NES PC", 65535);
      checkedInteger(count, "Disassembly count", 4096);
      const decoder = new Cpu6502Decoder(ricoh2a03Cpu);
      const instructions2 = [];
      let pc = address2.address;
      for (let index = 0; index < count; index++) {
        const memory = await this.#readCpuBus(pc, Math.min(3, 65536 - pc));
        if (!memory) {
          break;
        }
        const decoded2 = decoder.decode({
          source: new Uint8ArrayDecoderSource(memory),
          offset: 0,
          logicalAddress: pc
        });
        if (decoded2.kind !== "instruction") {
          break;
        }
        instructions2.push({
          address: this.#address(pc),
          bytes: [...decoded2.instruction.bytes],
          text: formatCpu6502Instruction(decoded2.instruction)
        });
        pc = pc + decoded2.instruction.size & 65535;
      }
      return instructions2;
    }
    let current = checkedAddress(address2, "Disassembly request").address;
    checkedInteger(count, "Disassembly count", 4096);
    const registers = await this.#registerSnapshot();
    const state = {
      e: registers.e === 0 ? 0 : 1,
      m: registers.p >>> 5 & 1 ? 1 : 0,
      x: registers.p >>> 4 & 1 ? 1 : 0,
      programBank: current >>> 16,
      dataBank: registers.db,
      directPage: registers.d
    };
    const instructions = [];
    for (let index = 0; index < count; index++) {
      const memory = await this.#readCpuBus(current, 4);
      if (!memory) {
        break;
      }
      const decoded2 = this.#decoder.decode({
        source: new Uint8ArrayDecoderSource(memory),
        offset: 0,
        logicalAddress: current,
        state: { ...state, programBank: current >>> 16 }
      });
      if (decoded2.kind !== "instruction") {
        throw new Error(
          decoded2.kind === "ambiguous" ? decoded2.reason : `65816 decode failed: ${decoded2.message}`
        );
      }
      instructions.push({
        address: this.#address(current),
        bytes: [...decoded2.instruction.bytes],
        text: formatCpu65816Instruction(decoded2.instruction)
      });
      current = current + decoded2.instruction.size & 16777215;
    }
    return instructions;
  }
  /** @inheritdoc */
  async capture(request) {
    validateCaptureRequest(request);
    const client = this.#requireConnected();
    if ("scope" in request && request.scope && this.#nes && request.scope !== "nes.2a03.instructions" && request.scope !== "nes.cpu-bus-ppu") {
      throw new Error("Famicom supports NES instruction and PPU bus capture scopes.");
    }
    if (!this.#nes && "scope" in request && (request.scope === "nes.2a03.instructions" || request.scope === "nes.cpu-bus-ppu")) {
      throw new Error("NES capture requires a Famicom runtime.");
    }
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
      if ("directory" in request) {
        const restoringContext = request.action === "replay" || request.action === "restore";
        const mismatchedRecordingBuild = !restoringContext && request.producer.revision !== identity.executableSha256 && request.producer.revision !== identity.producerRevision;
        if (request.romContentSha256 !== identity.romSha256 || this.#nes && (!request.romFileSha256 || request.romFileSha256 !== identity.romFileSha256) || request.producer.id !== "ares" || mismatchedRecordingBuild) {
          throw new Error("Capture context ROM/build does not match the verified runtime.");
        }
        let contextProducer = request.producer;
        if (restoringContext) {
          const recordedIdentity = (await readFile2(path3.join(request.directory, "identity.txt"), "utf8")).trimEnd().split("\n");
          const recordedRevision = recordedIdentity[2];
          if (recordedIdentity.length !== (this.#nes ? 4 : 3) || recordedIdentity[0] !== request.romContentSha256 || recordedIdentity[1] !== request.producer.id || !recordedRevision || this.#nes && recordedIdentity[3] !== request.romFileSha256) {
            throw new Error(
              "Capture context identity does not match the requested ROM and emulator."
            );
          }
          contextProducer = { id: request.producer.id, revision: recordedRevision };
          await verifyCaptureContext(request.directory, { ...request, producer: contextProducer });
        }
        fields2.push(
          encode(request.directory),
          encode(request.romContentSha256),
          encode(contextProducer.id),
          encode(contextProducer.revision)
        );
        if (this.#nes) {
          fields2.push(encode(request.romFileSha256));
        }
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
      const scope = negotiation2 ? request.scope ?? this.#instructionScope() : this.#captureScope;
      const scopes = {
        "snes.65816.instructions": "instructions",
        "nes.2a03.instructions": "instructions",
        "nes.cpu-bus-ppu": "bus-ppu",
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
        if (request.romContentSha256 !== identity.romSha256 || this.#nes && (!request.romFileSha256 || request.romFileSha256 !== identity.romFileSha256) || request.producer.id !== "ares" || request.producer.revision !== identity.executableSha256 && request.producer.revision !== identity.producerRevision) {
          throw new Error(
            "Native capture identity does not match the verified ROM and executable."
          );
        }
        await this.capture({ operation: "file-capabilities", scope });
        fields2.push(
          request.bufferBytes,
          scopes[scope],
          encode(request.file),
          request.romContentSha256,
          encode(request.producer.id),
          encode(request.producer.revision)
        );
        if (this.#nes) {
          if (!request.romFileSha256) {
            throw new Error("NES capture requires a verified full cartridge identity.");
          }
          fields2.push(request.romFileSha256);
        }
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
    const requestedScope = negotiation ? request.scope ?? this.#instructionScope() : void 0;
    const ppu = requestedScope === "snes.cpu-bus-ppu" || requestedScope === "nes.cpu-bus-ppu";
    const bus = ppu || requestedScope === "snes.cpu-bus" || requestedScope === "snes.cpu-bus-transfers";
    const transfers = requestedScope === "snes.cpu-bus-transfers";
    if (request.operation === "start" && bus && (ppu || transfers || !this.#busCaptureSupported)) {
      await this.capture({ operation: "capabilities", scope: requestedScope });
    }
    let operation2 = request.operation;
    if (request.operation === "capabilities" && bus) {
      operation2 = transfers ? "transfer-capabilities" : "bus-capabilities";
    }
    if (request.operation === "capabilities" && ppu) {
      operation2 = "ppu-capabilities";
    }
    const fields = ["qUttoriCapture", operation2];
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
      this.#captureScope = position.scope;
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
    if (addresses2.length > maxEvents || addresses2.some((address2) => address2 > 16777215)) {
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
  async #readCpuBus(address2, count) {
    const response = await this.#requireStopped().request(
      `m${address2.toString(16)},${count.toString(16)}`
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
  #instructionScope() {
    return this.#nes ? "nes.2a03.instructions" : "snes.65816.instructions";
  }
  async #registerSnapshot() {
    const packet = await this.#requireStopped().request("g");
    if (!this.#nes) {
      return parseRegisters(packet);
    }
    if (!/^[\da-f]{14}$/i.test(packet)) {
      throw new Error("Expected seven bytes of Ricoh CPU registers.");
    }
    const b = Buffer.from(packet, "hex");
    return {
      a: b[0],
      x: b[1],
      y: b[2],
      s: b[3],
      p: b[4],
      pc: b.readUInt16LE(5),
      d: 0,
      db: 0,
      pb: 0,
      e: 1
    };
  }
  /** A stopped PC carries its physical PRG identity so identical bank windows resolve correctly. */
  async #currentAddress(pc) {
    if (!this.#nes) {
      return this.#address(pc);
    }
    const packet = await this.#requireStopped().request("qUttoriMemoryRead:nes.mapping:0,16");
    if (!/^[\da-f]{44}$/i.test(packet)) {
      throw new Error("Missing Famicom mapping snapshot.");
    }
    const offset = Buffer.from(packet, "hex").readUInt32LE(18);
    return {
      ...this.#address(pc),
      ...offset === 4294967295 ? {} : { outputOffset: offset + this.#nesPrgFileOffset }
    };
  }
  #address(address2) {
    return {
      architecture: this.#nes ? "65xx.2a03" : ARES_65816_ARCHITECTURE,
      addressSpace: this.#nes ? "nes.cpu" : ARES_65816_ADDRESS_SPACE,
      address: address2
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
            let text = "Capture replay diverged from the retained input timing or final machine state. Execution is paused.\n";
            if (status === "idle") {
              const checked = this.#nes ? "CPU/APU/PPU/mapper/controller state" : "WRAM";
              text = `Capture replay reached the recorded endpoint; ${checked} and input consumption match.
`;
            }
            this.#emit({
              type: "output",
              category: status === "idle" ? "console" : "stderr",
              text
            });
          }
          return;
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
  --save-dir path       Persistent SRAM/state root, independent of runtime updates
  --rom-sha256 hash     Expected ROM SHA-256 from a verified build (64 hex digits)
  --system name         Ares system name (default: Super Famicom)
  --no-fast-boot        Disable the ares fast-boot setting
  --help                Show this help
`;
var optionNames = /* @__PURE__ */ new Set([
  "--manifest",
  "--ares",
  "--rom",
  "--rom-sha256",
  "--runtime-dir",
  "--save-dir",
  "--system"
]);
var parseAresSidecarArguments = (arguments_) => {
  const values = /* @__PURE__ */ new Map();
  let fastBoot = true;
  for (let index = 0; index < arguments_.length; index++) {
    const argument = index >= 0 && index < arguments_.length && Object.hasOwn(arguments_, index) ? arguments_[index] : void 0;
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
    return path4.resolve(value);
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
    ...values.has("--save-dir") ? { saveDirectory: required("--save-dir") } : {},
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
    JSON.parse(await readFile3(options.manifest, "utf8"))
  );
  const manifest = {
    ...runtimeManifest,
    romSha256: options.romSha256 ?? runtimeManifest.romSha256
  };
  const host = new AresProcessHost({
    executable: options.executable,
    rom: options.rom,
    runtimeDirectory: options.runtimeDirectory,
    saveDirectory: options.saveDirectory,
    manifest,
    system: options.system,
    fastBoot: options.fastBoot
  });
  let contentSha256 = manifest.romSha256;
  let nesPrgFileOffset;
  if (/^(famicom|nes|fc)$/i.test(options.system ?? "")) {
    const romBytes = await readFile3(options.rom);
    if (!romBytes.subarray(0, 4).equals(Buffer.from([78, 69, 83, 26]))) {
      throw new Error("Famicom launch requires an iNES cartridge.");
    }
    nesPrgFileOffset = 16 + (romBytes[6] & 4 ? 512 : 0);
    contentSha256 = createHash3("sha256").update(romBytes.subarray(16)).digest("hex");
  }
  const backend = new AresRspDebugBackend({
    nesPrgFileOffset,
    createClient: (connect) => host.createClient(connect),
    nativeFileIdentity: {
      romSha256: contentSha256,
      romFileSha256: manifest.romSha256,
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

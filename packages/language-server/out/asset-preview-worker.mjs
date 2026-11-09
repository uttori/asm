import { createRequire as __createRequire } from 'node:module';
const require = __createRequire(import.meta.url);
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

// packages/language-server/src/asset-preview-worker.ts
import { parentPort } from "node:worker_threads";

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
  const input2 = strm.input;
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
  strm.input = input2;
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
  let input2, output;
  const state = strm.state;
  _in = strm.next_in;
  input2 = strm.input;
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
      hold += input2[_in++] << bits;
      bits += 8;
      hold += input2[_in++] << bits;
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
            hold += input2[_in++] << bits;
            bits += 8;
          }
          len += hold & (1 << op) - 1;
          hold >>>= op;
          bits -= op;
        }
        if (bits < 15) {
          hold += input2[_in++] << bits;
          bits += 8;
          hold += input2[_in++] << bits;
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
              hold += input2[_in++] << bits;
              bits += 8;
              if (bits < op) {
                hold += input2[_in++] << bits;
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
  let input2, output;
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
  input2 = strm.input;
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
        hold += input2[next++] << bits;
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
        hold += input2[next++] << bits;
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
        hold += input2[next++] << bits;
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
        hold += input2[next++] << bits;
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
          hold += input2[next++] << bits;
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
            state.head.extra.set(input2.subarray(next, next + copy), len);
          }
          if (state.flags & 512 && state.wrap & 4) state.check = crc32(state.check, input2, copy, next);
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
          len = input2[next + copy++];
          if (state.head && len && state.length < 65536) state.head.name += String.fromCharCode(len);
        } while (len && copy < have);
        if (state.flags & 512 && state.wrap & 4) state.check = crc32(state.check, input2, copy, next);
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
          len = input2[next + copy++];
          if (state.head && len && state.length < 65536) state.head.comment += String.fromCharCode(len);
        } while (len && copy < have);
        if (state.flags & 512 && state.wrap & 4) state.check = crc32(state.check, input2, copy, next);
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
          hold += input2[next++] << bits;
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
        hold += input2[next++] << bits;
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
        hold += input2[next++] << bits;
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
        hold += input2[next++] << bits;
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
        output.set(input2.subarray(next, next + copy), put);
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
        hold += input2[next++] << bits;
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
          hold += input2[next++] << bits;
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
          hold += input2[next++] << bits;
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
              hold += input2[next++] << bits;
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
              hold += input2[next++] << bits;
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
              hold += input2[next++] << bits;
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
        input2 = strm.input;
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
        hold += input2[next++] << bits;
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
          hold += input2[next++] << bits;
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
          hold += input2[next++] << bits;
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
        hold += input2[next++] << bits;
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
          hold += input2[next++] << bits;
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
          hold += input2[next++] << bits;
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
          hold |= input2[next++] << bits;
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
          hold += input2[next++] << bits;
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
  const result = new Uint8Array(chunks.reduce((len, chunk2) => len + chunk2.length, 0));
  let pos = 0;
  for (const chunk2 of chunks) {
    result.set(chunk2, pos);
    pos += chunk2.length;
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
  onData(chunk2) {
    this.chunks.push(chunk2);
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
function deflate(input2, options = {}) {
  const deflator = new Deflate(options);
  deflator.push(input2, true);
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
  onData(chunk2) {
    this.chunks.push(chunk2);
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
  constructor(input2) {
    this.writing = false;
    if (typeof Buffer !== "undefined" && Buffer.isBuffer(input2)) {
      debug("constructor: from Buffer");
      this.data = Buffer.from(input2);
    } else if (typeof input2 === "string") {
      debug("constructor: from string");
      this.data = new TextEncoder().encode(input2);
    } else if (input2 instanceof Uint8Array) {
      debug("constructor: from Uint8Array");
      if (input2.buffer instanceof ArrayBuffer) {
        this.data = input2;
      } else {
        this.data = new Uint8Array(input2);
      }
    } else if (input2 instanceof ArrayBuffer) {
      debug("constructor: from ArrayBuffer");
      this.data = new Uint8Array(input2);
    } else if (Array.isArray(input2)) {
      debug("constructor: Normal Array");
      this.data = new Uint8Array(input2);
    } else if (typeof input2 === "number") {
      debug("constructor: Number (i.e. length)");
      if (!Number.isSafeInteger(input2) || input2 < 0) {
        throw new RangeError(`Invalid buffer length: ${input2}`);
      }
      this.data = new Uint8Array(input2);
    } else if (input2 instanceof _DataBuffer) {
      debug("constructor: from DataBuffer, a shallow copy");
      this.data = input2.data;
    } else if (ArrayBuffer.isView(input2) && "BYTES_PER_ELEMENT" in input2 && input2.buffer instanceof ArrayBuffer) {
      debug("constructor: from typed arrays other than Uint8Array");
      this.data = new Uint8Array(input2.buffer, input2.byteOffset, input2.byteLength);
    } else if (typeof input2 === "undefined") {
      debug("constructor: empty, creating a new file from scratch");
      this.writing = true;
      this.data = new Uint8Array();
    } else {
      const error = `Unknown type of input for DataBuffer: ${typeof input2}`;
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
  compare(input2, offset = 0) {
    let data;
    if (input2 instanceof _DataBuffer) {
      data = input2.data;
    } else if (input2 instanceof Uint8Array) {
      data = input2;
    } else {
      data = new _DataBuffer(input2).data;
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
  isNextBytes(input2) {
    debug("isNextBytes:", input2);
    if (!input2 || typeof input2.length !== "number" || input2.length === 0) {
      debug("isNextBytes: no input provided");
      return false;
    }
    if (!this.available(input2.length, false)) {
      debug(`isNextBytes: Insufficient Bytes: ${input2.length} <= ${this.remainingBytes()}`);
      return false;
    }
    debug("isNextBytes: this.offset =", this.offset);
    const off = this.offset;
    for (let i = 0; i < input2.length; i++) {
      if (input2[i] !== this.data[off + i]) {
        debug("isNextBytes: first failed match at", i, ", where:", input2[i], "!==", this.data[off + i]);
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
  read(bytes, littleEndian2 = false) {
    if (!this.available(bytes, false)) {
      throw new underflow_error_default(`Insufficient Bytes: ${bytes}`);
    }
    const start = this.offset;
    if (littleEndian2 && bytes > 1) {
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
  peek(bytes, offset = 0, littleEndian2 = false) {
    if (!this.availableAt(bytes, offset, false)) {
      throw new underflow_error_default(`Insufficient Bytes: ${offset} + ${bytes}`);
    }
    if (littleEndian2 && bytes > 1) {
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
  readUInt16(littleEndian2 = false) {
    if (!this.available(2, false)) {
      throw new underflow_error_default("Insufficient Bytes: 2");
    }
    const v = this.#view.getUint16(this.offset, littleEndian2);
    this.offset += 2;
    return v;
  }
  /**
   * Read from the specified offset without advancing the offsets and return the value.
   * @param {number} [offset] The offset to read from, default is 0.
   * @param {boolean} [littleEndian] Read in Little Endian format, default is false.
   * @returns {number} The Int8 value at the current offset.
   */
  peekUInt16(offset = 0, littleEndian2 = false) {
    if (!this.availableAt(2, offset, false)) {
      throw new underflow_error_default(`Insufficient Bytes: ${offset} + 2`);
    }
    return this.#view.getUint16(offset, littleEndian2);
  }
  /**
   * Read from the current offset and return the value.
   * @param {boolean} [littleEndian] Read in Little Endian format, default is false.
   * @returns {number} The Int16 value at the current offset.
   */
  readInt16(littleEndian2 = false) {
    if (!this.available(2, false)) {
      throw new underflow_error_default("Insufficient Bytes: 2");
    }
    const v = this.#view.getInt16(this.offset, littleEndian2);
    this.offset += 2;
    return v;
  }
  /**
   * Read from the specified offset without advancing the offsets and return the value.
   * @param {number} [offset] The offset to read from, default is 0.
   * @param {boolean} [littleEndian] Read in Little Endian format, default is false.
   * @returns {number} The Int16 value at the current offset.
   */
  peekInt16(offset = 0, littleEndian2 = false) {
    if (!this.availableAt(2, offset, false)) {
      throw new underflow_error_default(`Insufficient Bytes: ${offset} + 2`);
    }
    return this.#view.getInt16(offset, littleEndian2);
  }
  /**
   * Read from the current offset and return the value.
   * @param {boolean} [littleEndian] Read in Little Endian format, default is false.
   * @returns {number} The UInt24 value at the current offset.
   */
  readUInt24(littleEndian2 = false) {
    if (!this.available(3, false)) {
      throw new underflow_error_default("Insufficient Bytes: 3");
    }
    const { offset } = this;
    const { data } = this;
    const value = littleEndian2 ? data[offset] | data[offset + 1] << 8 | data[offset + 2] << 16 : data[offset] << 16 | data[offset + 1] << 8 | data[offset + 2];
    this.offset += 3;
    return value;
  }
  /**
   * Read from the specified offset without advancing the offsets and return the value.
   * @param {number} [offset] The offset to read from, default is 0.
   * @param {boolean} [littleEndian] Read in Little Endian format, default is false.
   * @returns {number} The UInt24 value at the current offset.
   */
  peekUInt24(offset = 0, littleEndian2 = false) {
    if (!this.availableAt(3, offset, false)) {
      throw new underflow_error_default(`Insufficient Bytes: ${offset} + 3`);
    }
    const { data } = this;
    const value = littleEndian2 ? data[offset] | data[offset + 1] << 8 | data[offset + 2] << 16 : data[offset] << 16 | data[offset + 1] << 8 | data[offset + 2];
    return value;
  }
  /**
   * Read from the current offset and return the value.
   * @param {boolean} [littleEndian] Read in Little Endian format, default is false.
   * @returns {number} The Int24 value at the current offset.
   */
  readInt24(littleEndian2 = false) {
    if (!this.available(3, false)) {
      throw new underflow_error_default("Insufficient Bytes: 3");
    }
    const { offset } = this;
    const { data } = this;
    const value = littleEndian2 ? data[offset] | data[offset + 1] << 8 | data[offset + 2] << 16 : data[offset] << 16 | data[offset + 1] << 8 | data[offset + 2];
    this.offset += 3;
    return value << 8 >> 8;
  }
  /**
   * Read from the specified offset without advancing the offsets and return the value.
   * @param {number} [offset] The offset to read from, default is 0.
   * @param {boolean} [littleEndian] Read in Little Endian format, default is false.
   * @returns {number} The Int24 value at the current offset.
   */
  peekInt24(offset = 0, littleEndian2 = false) {
    if (!this.availableAt(3, offset, false)) {
      throw new underflow_error_default(`Insufficient Bytes: ${offset} + 3`);
    }
    const { data } = this;
    const value = littleEndian2 ? data[offset] | data[offset + 1] << 8 | data[offset + 2] << 16 : data[offset] << 16 | data[offset + 1] << 8 | data[offset + 2];
    return value << 8 >> 8;
  }
  /**
   * Read from the current offset and return the value.
   * @param {boolean} [littleEndian] Read in Little Endian format, default is false.
   * @returns {number} The UInt32 value at the current offset.
   */
  readUInt32(littleEndian2 = false) {
    if (!this.available(4, false)) {
      throw new underflow_error_default("Insufficient Bytes: 4");
    }
    const v = this.#view.getUint32(this.offset, littleEndian2);
    this.offset += 4;
    return v;
  }
  /**
   * Read from the specified offset without advancing the offsets and return the value.
   * @param {number} [offset] The offset to read from, default is 0.
   * @param {boolean} [littleEndian] Read in Little Endian format, default is false.
   * @returns {number} The UInt32 value at the current offset.
   */
  peekUInt32(offset = 0, littleEndian2 = false) {
    if (!this.availableAt(4, offset, false)) {
      throw new underflow_error_default(`Insufficient Bytes: ${offset} + 4`);
    }
    return this.#view.getUint32(offset, littleEndian2);
  }
  /**
   * Read from the current offset and return the value.
   * @param {boolean} [littleEndian] Read in Little Endian format, default is false.
   * @returns {number} The Int32 value at the current offset.
   */
  readInt32(littleEndian2 = false) {
    if (!this.available(4, false)) {
      throw new underflow_error_default("Insufficient Bytes: 4");
    }
    const v = this.#view.getInt32(this.offset, littleEndian2);
    this.offset += 4;
    return v;
  }
  /**
   * Read from the specified offset without advancing the offsets and return the value.
   * @param {number} [offset] The offset to read from, default is 0.
   * @param {boolean} [littleEndian] Read in Little Endian format, default is false.
   * @returns {number} The Int32 value at the current offset.
   */
  peekInt32(offset = 0, littleEndian2 = false) {
    if (!this.availableAt(4, offset, false)) {
      throw new underflow_error_default(`Insufficient Bytes: ${offset} + 4`);
    }
    return this.#view.getInt32(offset, littleEndian2);
  }
  /**
   * Read from the current offset and return the value.
   * @param {boolean} [littleEndian] Read in Little Endian format, default is false.
   * @returns {number} The Float32 value at the current offset.
   */
  readFloat32(littleEndian2 = false) {
    if (!this.available(4, false)) {
      throw new underflow_error_default("Insufficient Bytes: 4");
    }
    const v = this.#view.getFloat32(this.offset, littleEndian2);
    this.offset += 4;
    return v;
  }
  /**
   * Read from the specified offset without advancing the offsets and return the value.
   * @param {number} [offset] The offset to read from, default is 0.
   * @param {boolean} [littleEndian] Read in Little Endian format, default is false.
   * @returns {number} The Float32 value at the current offset.
   */
  peekFloat32(offset = 0, littleEndian2 = false) {
    if (!this.availableAt(4, offset, false)) {
      throw new underflow_error_default(`Insufficient Bytes: ${offset} + 4`);
    }
    return this.#view.getFloat32(offset, littleEndian2);
  }
  /**
   * Read from the current offset and return the Turbo Pascal 48 bit extended float value.
   * May be faulty with large numbers due to float percision.
   * @param {boolean} [littleEndian] Read in Little Endian format, default is false.
   * @returns {number} The Float48 value at the current offset.
   */
  readFloat48(littleEndian2 = false) {
    const uint8 = this.read(6, !littleEndian2);
    return float48(uint8);
  }
  /**
   * Read from the specified offset without advancing the offsets and return the Turbo Pascal 48 bit extended float value.
   * May be faulty with large numbers due to float percision.
   * @param {number} [offset] The offset to read from, default is 0.
   * @param {boolean} [littleEndian] Read in Little Endian format, default is false.
   * @returns {number} The Float48 value at the specified offset.
   */
  peekFloat48(offset = 0, littleEndian2 = false) {
    const uint8 = this.peek(6, offset, !littleEndian2);
    return float48(uint8);
  }
  /**
   * Read from the current offset and return the value.
   * @param {boolean} [littleEndian] Read in Little Endian format, default is false.
   * @returns {number} The Float64 value at the current offset.
   */
  readFloat64(littleEndian2 = false) {
    if (!this.available(8, false)) {
      throw new underflow_error_default("Insufficient Bytes: 8");
    }
    const v = this.#view.getFloat64(this.offset, littleEndian2);
    this.offset += 8;
    return v;
  }
  /**
   * Read from the specified offset without advancing the offsets and return the value.
   * @param {number} [offset] The offset to read from, default is 0.
   * @param {boolean} [littleEndian] Read in Little Endian format, default is false.
   * @returns {number} The Float64 value at the current offset.
   */
  peekFloat64(offset = 0, littleEndian2 = false) {
    if (!this.availableAt(8, offset, false)) {
      throw new underflow_error_default(`Insufficient Bytes: ${offset} + 8`);
    }
    return this.#view.getFloat64(offset, littleEndian2);
  }
  /**
   * Read from the current offset and return the IEEE 80 bit extended float value.
   * @param {boolean} [littleEndian] Reverse the input bytes before conversion, defaults to system value, default is the current nativeEndian value.
   * This legacy flag is retained for compatibility; use readFloatIEEE754 / peekFloatIEEE754 for conventional input-endianness semantics.
   * @returns {number} The Float80 value at the current offset.
   */
  readFloat80(littleEndian2 = this.nativeEndian) {
    const uint8 = this.read(10, littleEndian2);
    return float80(uint8);
  }
  /**
   * Read from the specified offset without advancing the offsets and return the IEEE 80 bit extended float value.
   * @param {number} [offset] The offset to read from, default is 0.
   * @param {boolean} [littleEndian] Reverse the input bytes before conversion, defaults to system value, default is the current nativeEndian value.
   * This legacy flag is retained for compatibility; use readFloatIEEE754 / peekFloatIEEE754 for conventional input-endianness semantics.
   * @returns {number} The Float80 value at the current offset.
   */
  peekFloat80(offset = 0, littleEndian2 = this.nativeEndian) {
    const uint8 = this.peek(10, offset, littleEndian2);
    return float80(uint8);
  }
  /**
   * Read from the current offset and return the IEEE 754 extended float value.
   * May be faulty with large numbers due to float percision.
   * @param {boolean} [littleEndian] Read in Little Endian format, default is false.
   * @returns {number} The IEEE 754 extended float value at the current offset.
   */
  readFloatIEEE754(littleEndian2 = false) {
    const uint8 = this.read(10, littleEndian2);
    return convertFromIeeeExtended(uint8);
  }
  /**
   * Peek from the specified offset without advancing the offsets and return the IEEE 754 extended float value.
   * May be faulty with large numbers due to float percision.
   * @param {number} [offset] The offset to read from, default is 0.
   * @param {boolean} [littleEndian] Read in Little Endian format, default is false.
   * @returns {number} The IEEE 754 extended float value at the specified offset.
   */
  peekFloatIEEE754(offset = 0, littleEndian2 = false) {
    const uint8 = this.peek(10, offset, littleEndian2);
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
    const chunk2 = new _DataBuffer(new Uint8Array(this.data.subarray(this.offset, this.offset + length)));
    this.offset += length;
    return chunk2;
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
        let littleEndian2;
        switch (encoding) {
          case "utf16be":
          case "utf16-be": {
            littleEndian2 = false;
            break;
          }
          case "utf16le":
          case "utf16-le": {
            littleEndian2 = true;
            break;
          }
          case "utf16bom":
          case "utf16-bom":
          default: {
            littleEndian2 = false;
            if (end - offset >= 2) {
              const bom = data[offset] << 8 | data[offset + 1];
              if (bom === 65279 || bom === 65534) {
                littleEndian2 = bom === 65534;
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
          w1 = littleEndian2 ? data[offset] | data[offset + 1] << 8 : data[offset] << 8 | data[offset + 1];
          offset += 2;
          if (w1 < 55296 || w1 > 57343) {
            codes.push(w1);
          } else {
            if (w1 > 56319 || end - offset < 2) {
              throw new Error("Invalid utf16 sequence.");
            }
            const w2 = littleEndian2 ? data[offset] | data[offset + 1] << 8 : data[offset] << 8 | data[offset + 1];
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
  writeUInt16(data, offset = this.offset, advance = true, littleEndian2 = false) {
    debug("writeUInt16:", { data, offset, advance, littleEndian: littleEndian2 });
    this.#validateWrite(2, offset);
    const buffer = this.buffer;
    if (littleEndian2) {
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
  writeUInt24(data, offset = this.offset, advance = true, littleEndian2 = false) {
    debug("writeUInt24:", { data, offset, advance, littleEndian: littleEndian2 });
    this.#validateWrite(3, offset);
    const buffer = this.buffer;
    if (littleEndian2) {
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
  writeUInt32(data, offset = this.offset, advance = true, littleEndian2 = false) {
    debug("writeUInt32:", { data, offset, advance, littleEndian: littleEndian2 });
    this.#validateWrite(4, offset);
    const buffer = this.buffer;
    if (littleEndian2) {
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
  writeString(string, offset = this.offset, encoding = "ascii", advance = true) {
    debug("writeString:", { string, offset, encoding, advance });
    this.#validateWrite(0, offset);
    encoding = encoding.toLowerCase();
    const data = [];
    switch (encoding) {
      case "ascii":
      case "latin1": {
        for (let i = 0; i < string.length; i++) {
          data.push(string.charCodeAt(i) & 255);
        }
        break;
      }
      case "utf8":
      case "utf-8": {
        for (let i = 0; i < string.length; i++) {
          let charcode = string.charCodeAt(i);
          if (charcode < 128) {
            data.push(charcode);
          } else if (charcode < 2048) {
            data.push(192 | charcode >> 6, 128 | charcode & 63);
          } else if (charcode < 55296 || charcode >= 57344) {
            data.push(224 | charcode >> 12, 128 | charcode >> 6 & 63, 128 | charcode & 63);
          } else {
            const next = string.charCodeAt(i + 1);
            if (charcode > 56319 || !(next >= 56320 && next <= 57343)) {
              data.push(239, 191, 189);
              continue;
            }
            i++;
            charcode = 65536 + ((charcode & 1023) << 10 | string.charCodeAt(i) & 1023);
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
        const littleEndian2 = encoding === "utf16le" || encoding === "utf16-le";
        if (encoding === "utf16bom" || encoding === "utf16-bom") {
          data.push(254, 255);
        }
        for (let i = 0; i < string.length; i++) {
          const charcode = string.charCodeAt(i);
          if (littleEndian2) {
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

// node_modules/@uttori/data-tools/dist/audio/audio-wav.js
var _a;
var debug2 = (..._args) => {
};
if (typeof process !== "undefined" && process.env.UTTORI_AUDIOWAV_DEBUG) {
  try {
    const { default: d } = await Promise.resolve().then(() => __toESM(require_src(), 1));
    debug2 = d("Uttori.AudioWAV");
  } catch {
  }
}
var WAVE_FORMAT_TAGS = {
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
var WAVE_CHANNEL_MASK_LABELS = {
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
function rolandPads() {
  return ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"].flatMap((bank) => Array.from({ length: 12 }, (_value, pad) => `${bank}${pad + 1}`));
}
var ROLAND_SP404SX_PADS = /* @__PURE__ */ rolandPads();
var AudioWAV = class extends data_buffer_default {
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
  static #chunkBuffer(chunk2, minimumSize, littleEndian2 = true) {
    const buffer = new data_buffer_default(typeof Buffer !== "undefined" && Buffer.isBuffer(chunk2) ? new Uint8Array(chunk2.buffer, chunk2.byteOffset, chunk2.byteLength) : chunk2);
    if (buffer.length < 8) {
      throw new RangeError("Truncated chunk header: expected 8 bytes");
    }
    const size = buffer.peekUInt32(4, littleEndian2);
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
  constructor(input2, opts = {}) {
    super(input2);
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
    const chunk2 = this.read(12, false);
    const value = _a.decodeHeader(chunk2);
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
  static decodeHeader(chunk2) {
    debug2("decodeHeader");
    const header = new data_buffer_default(chunk2);
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
    const chunk2 = this.read(8 + size + padding, false);
    let decodeBytes = chunk2;
    if (extended && declaredSize === 4294967295 && size < 4294967295) {
      decodeBytes = Uint8Array.from(chunk2);
      new DataView(decodeBytes.buffer, decodeBytes.byteOffset, decodeBytes.byteLength).setUint32(4, size, true);
    }
    switch (type) {
      case "fmt ": {
        const value = _a.decodeFMT(decodeBytes);
        this.#format ??= value;
        this.chunks.push({ type: "format", value, chunk: chunk2 });
        break;
      }
      case "fact": {
        const value = _a.decodeFACT(decodeBytes);
        this.#fact ??= value;
        this.chunks.push({ type: "fact", value, chunk: chunk2 });
        break;
      }
      case "inst": {
        const value = _a.decodeINST(decodeBytes);
        this.chunks.push({ type: "instrument", value, chunk: chunk2 });
        break;
      }
      case "DISP": {
        const value = _a.decodeDISP(decodeBytes);
        this.chunks.push({ type: "display", value, chunk: chunk2 });
        break;
      }
      case "smpl": {
        const value = _a.decodeSMPL(decodeBytes);
        this.chunks.push({ type: "sample", value, chunk: chunk2 });
        break;
      }
      case "tlst": {
        const value = _a.decodeTLST(decodeBytes);
        this.chunks.push({ type: "trigger_list", value, chunk: chunk2 });
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
        this.chunks.push({ type: "data", chunk: chunk2, value });
        break;
      }
      case "LIST": {
        const value = _a.decodeLIST(decodeBytes, this.options);
        this.chunks.push({ type: "list", value, chunk: chunk2 });
        break;
      }
      case "RLND": {
        const value = _a.decodeRLND(decodeBytes);
        this.chunks.push({ type: "roland", value, chunk: chunk2 });
        break;
      }
      case "JUNK": {
        _a.decodeJUNK(decodeBytes, this.options);
        this.chunks.push({ type: "junk", chunk: chunk2 });
        break;
      }
      case "PAD ": {
        _a.decodePAD(decodeBytes);
        this.chunks.push({ type: "padding", chunk: chunk2 });
        break;
      }
      case "PEAK": {
        const value = _a.decodePEAK(decodeBytes, this.type !== "AIFF");
        this.chunks.push({ type: "peak", value, chunk: chunk2 });
        break;
      }
      case "acid": {
        const value = _a.decodeACID(decodeBytes);
        this.chunks.push({ type: "acid", value, chunk: chunk2 });
        break;
      }
      case "strc": {
        const value = _a.decodeSTRC(decodeBytes);
        this.chunks.push({ type: "strc", value, chunk: chunk2 });
        break;
      }
      case "cue ": {
        const value = _a.decodeCue(decodeBytes);
        this.chunks.push({ type: "cue_points", value, chunk: chunk2 });
        break;
      }
      case "bext": {
        const value = _a.decodeBEXT(decodeBytes, this.options);
        this.chunks.push({ type: "broadcast_extension", value, chunk: chunk2 });
        break;
      }
      case "ResU": {
        const value = _a.decodeResU(decodeBytes, this.options);
        if (value.error) {
          this.#issue(value.error, offset);
        }
        this.chunks.push({ type: "logic_resu", value, chunk: chunk2 });
        break;
      }
      case "ds64": {
        const value = _a.decodeDS64(decodeBytes);
        this.chunks.push({ type: "data_size_64", value, chunk: chunk2 });
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
        this.chunks.push({ type: "cart", chunk: chunk2, unknown: true });
        break;
      }
      case "AFAn":
      case "AFmd": {
        debug2(`macOS Special Binary Chunk: '${type}' with ${size} bytes`);
        this.chunks.push({ type, chunk: chunk2, description: "macOS Special Binary Chunk" });
        break;
      }
      case "minf":
      case "elm1":
      case "regn":
      case "ovwf":
      case "umid": {
        debug2(`ProTools Special Chunk: '${type}' with ${size} bytes`);
        this.chunks.push({ type, chunk: chunk2, description: "ProTools Special Chunk" });
        break;
      }
      case "COMM": {
        const value = _a.decodeCOMM(decodeBytes);
        this.#common ??= value;
        this.chunks.push({ type: "common", value, chunk: chunk2 });
        break;
      }
      case "SSND": {
        const value = _a.decodeSSND(decodeBytes);
        this.#soundChunks.push({ value, offset });
        this.chunks.push({ type: "sound_data", value, chunk: chunk2 });
        break;
      }
      case "FVER": {
        const value = _a.decodeFVER(decodeBytes);
        this.chunks.push({ type: "format_version", value, chunk: chunk2 });
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
        this.chunks.push({ type: chunkID.toLowerCase(), value, chunk: chunk2 });
        break;
      }
      default: {
        debug2(`Unsupported Chunk: '${type}' with ${size} bytes`);
        this.chunks.push({ type, chunk: chunk2, unknown: true });
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
  static decodeFMT(chunk2) {
    debug2("decodeFMT");
    const format = _a.#chunkBuffer(chunk2, 16);
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
  static decodeLIST(chunk2, options = {}) {
    debug2("decodeLIST");
    const list = _a.#chunkBuffer(chunk2, 4);
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
  static decodeDATA(chunk2) {
    debug2(`decodeDATA: ${chunk2.length} data bytes`);
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
  static decodeTLST(chunk2) {
    debug2("decodeTLST");
    const tlst = _a.#chunkBuffer(chunk2, 24);
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
  static decodeFACT(chunk2) {
    debug2("decodeFACT");
    const fact = _a.#chunkBuffer(chunk2, 4);
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
  static decodePEAK(chunk2, littleEndian2 = true) {
    debug2("decodePEAK");
    const peak = _a.#chunkBuffer(chunk2, 8, littleEndian2);
    const _chunkID = peak.readString(4);
    const size = peak.readUInt32(littleEndian2);
    debug2("decodePEAK size", size);
    const version = peak.readUInt32(littleEndian2);
    const timestamp = peak.readUInt32(littleEndian2);
    if ((size - 8) % 8 !== 0) {
      throw new RangeError("Incomplete PEAK channel entry");
    }
    const peaks = [];
    let ppeakPointer = 0;
    let bitAlign = 0;
    while (peak.remainingBytes()) {
      const rawValue = peak.readUInt32(littleEndian2);
      peak.rewind(4);
      const amplitude = peak.readFloat32(littleEndian2);
      const position = peak.readUInt32(littleEndian2);
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
  static decodeDISP(chunk2) {
    debug2("decodeDISP");
    const disp = _a.#chunkBuffer(chunk2, 4);
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
  static decodeACID(chunk2) {
    debug2("decodeACID");
    const acid = _a.#chunkBuffer(chunk2, 24);
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
  static decodeINST(chunk2) {
    debug2("decodeINST");
    const inst = _a.#chunkBuffer(chunk2, 7);
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
  static decodeSMPL(chunk2) {
    debug2("decodeSMPL");
    const smpl = _a.#chunkBuffer(chunk2, 36);
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
  static decodeRLND(chunk2) {
    debug2("decodeRLND");
    const roland = _a.#chunkBuffer(chunk2, 13);
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
  static decodeJUNK(chunk2, options = {}) {
    const junk = new data_buffer_default(chunk2);
    const chunkID = junk.readString(4);
    let size = junk.readUInt32(true);
    if (options.roundOddChunks && size % 2 !== 0) {
      size += 1;
    }
    debug2(`decodeJUNK: ${chunk2.length} bytes, chunkID: ${chunkID}, junk size: ${size}`);
  }
  /**
   * Decode the `PAD ` (Padding) chunk.
   * @param chunk Data Blob
   * @static
   */
  static decodePAD(chunk2) {
    const pad = new data_buffer_default(chunk2);
    const chunkID = pad.readString(4);
    const size = pad.readUInt32(true);
    debug2(`decodePAD: ${chunk2.length} bytes, chunkID: ${chunkID}, pad size: ${size}`);
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
  static decodeBEXT(chunk2, options = {}) {
    debug2("decodeBEXT");
    const bext = _a.#chunkBuffer(chunk2, 602);
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
  static decodeCue(chunk2) {
    debug2("decodeCue");
    const cue = _a.#chunkBuffer(chunk2, 4);
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
  static decodeResU(chunk2, options = {}) {
    debug2("decodeResU");
    const resu = _a.#chunkBuffer(chunk2, 0);
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
      const decoder2 = new TextDecoder();
      const inflator = new Inflate({ chunkSize: 16384 });
      inflator.onData = (output) => {
        bytes += output.length;
        if (bytes > limit) {
          throw new RangeError(`ResU exceeds maxResUSize (${limit} bytes)`);
        }
        text.push(decoder2.decode(output, { stream: true }));
      };
      inflator.push(data, false);
      if (inflator.err || !inflator.ended) {
        throw new Error(inflator.msg || "Incomplete ResU compressed stream");
      }
      text.push(decoder2.decode());
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
  static decodeDS64(chunk2) {
    const ds64 = _a.#chunkBuffer(chunk2, 28);
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
  static decodeSTRC(chunk2) {
    debug2("decodeSTRC");
    const strc = _a.#chunkBuffer(chunk2, 28);
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
  static decodeCOMM(chunk2) {
    debug2("decodeCOMM");
    const commonChunk = _a.#chunkBuffer(chunk2, 18, false);
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
  static decodeSSND(chunk2) {
    debug2("decodeSSND");
    const ssndChunk = _a.#chunkBuffer(chunk2, 8, false);
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
  static decodeFVER(chunk2) {
    debug2("decodeFVER");
    const formatVersionChunk = _a.#chunkBuffer(chunk2, 4, false);
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
var audio_wav_default = AudioWAV;

// packages/assets/src/validation.ts
function integer(value, label, minimum, maximum) {
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
function isNamespacedId(id2) {
  const parts2 = id2.split(".");
  return parts2.length > 1 && /^[a-z][\da-z-]*$/.test(parts2[0]) && parts2.slice(1).every((part) => /^[\da-z][\da-z-]*$/.test(part));
}
function invariant(value, message = "Invalid asset value.") {
  if (!value) {
    throw new Error(message);
  }
}
function equal(actual, expected, message = `Expected ${String(expected)}, received ${String(actual)}.`) {
  if (!Object.is(actual, expected)) {
    throw new Error(message);
  }
}
function fail(message) {
  throw new Error(message);
}

// packages/assets/src/snes.ts
var planeOffset = (depth, plane, row) => {
  if (depth === 3 && plane === 2) {
    return 16 + row;
  }
  return Math.floor(plane / 2) * 16 + row * 2 + plane % 2;
};
var validateTile = (tile, label, maximum) => {
  if (tile.length !== 8) {
    throw new RangeError(`${label} must contain exactly 8 rows.`);
  }
  tile.forEach((row, y) => {
    if (row.length !== 8) {
      throw new RangeError(`${label} row ${y} must contain exactly 8 pixels.`);
    }
    row.forEach((pixel, x) => integer(pixel, `${label} pixel ${x},${y}`, 0, maximum));
  });
};
function decodePlanarTiles(bytes, depth) {
  const size = depth * 8;
  const count = unitCount(bytes, size, "Planar tile stream");
  return Array.from(
    { length: count },
    (_, tileIndex) => Array.from(
      { length: 8 },
      (_row, row) => Array.from({ length: 8 }, (_column, column) => {
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
      (_row, row) => Array.from({ length: 8 }, (_column, column) => bytes[tileIndex * 64 + row * 8 + column])
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
    const word = bytes[index * 2] | bytes[index * 2 + 1] << 8;
    return {
      red: word & 31,
      green: word >> 5 & 31,
      blue: word >> 10 & 31,
      unusedHighBit: word >> 15 & 1
    };
  });
}
function encodeBgr555(colors) {
  const bytes = new Uint8Array(colors.length * 2);
  colors.forEach((color, index) => {
    const word = integer(color.red, `Color ${index} red`, 0, 31) | integer(color.green, `Color ${index} green`, 0, 31) << 5 | integer(color.blue, `Color ${index} blue`, 0, 31) << 10 | integer(color.unusedHighBit, `Color ${index} unusedHighBit`, 0, 1) << 15;
    bytes[index * 2] = word & 255;
    bytes[index * 2 + 1] = word >> 8;
  });
  return bytes;
}
function decodeBgMap(bytes) {
  const count = unitCount(bytes, 2, "BG tilemap");
  return Array.from({ length: count }, (_, index) => {
    const word = bytes[index * 2] | bytes[index * 2 + 1] << 8;
    return {
      tile: word & 1023,
      palette: word >> 10 & 7,
      priority: word >> 13 & 1,
      horizontalFlip: word >> 14 & 1,
      verticalFlip: word >> 15 & 1
    };
  });
}
function encodeBgMap(entries) {
  const bytes = new Uint8Array(entries.length * 2);
  entries.forEach((entry, index) => {
    const word = integer(entry.tile, `Entry ${index} tile`, 0, 1023) | integer(entry.palette, `Entry ${index} palette`, 0, 7) << 10 | integer(entry.priority, `Entry ${index} priority`, 0, 1) << 13 | integer(entry.horizontalFlip, `Entry ${index} horizontalFlip`, 0, 1) << 14 | integer(entry.verticalFlip, `Entry ${index} verticalFlip`, 0, 1) << 15;
    bytes[index * 2] = word & 255;
    bytes[index * 2 + 1] = word >> 8;
  });
  return bytes;
}
function decodeMode7Map(bytes) {
  return [...bytes];
}
function encodeMode7Map(indexes) {
  return Uint8Array.from(indexes.map((value, index) => integer(value, `Index ${index}`, 0, 255)));
}
function decodeBrrBlocks(bytes) {
  const count = unitCount(bytes, 9, "BRR stream");
  return Array.from({ length: count }, (_, blockIndex) => {
    const offset = blockIndex * 9;
    const header = bytes[offset];
    const nibbles = Array.from({ length: 16 }, (_sample, sampleIndex) => {
      const byte = bytes[offset + 1 + Math.floor(sampleIndex / 2)];
      const nibble = sampleIndex % 2 === 0 ? byte >> 4 : byte & 15;
      return nibble >= 8 ? nibble - 16 : nibble;
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
    bytes[offset] = integer(block.range, `BRR block ${index} range`, 0, 15) << 4 | integer(block.filter, `BRR block ${index} filter`, 0, 3) << 2 | integer(block.loop, `BRR block ${index} loop`, 0, 1) << 1 | integer(block.end, `BRR block ${index} end`, 0, 1);
    for (let sampleIndex = 0; sampleIndex < 16; sampleIndex += 2) {
      const high = integer(block.nibbles[sampleIndex], `BRR nibble ${sampleIndex}`, -8, 7) & 15;
      const low = integer(block.nibbles[sampleIndex + 1], `BRR nibble ${sampleIndex + 1}`, -8, 7) & 15;
      bytes[offset + 1 + sampleIndex / 2] = high << 4 | low;
    }
  });
  return bytes;
}
var isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
var sameModelValue = (left, right) => {
  if (Object.is(left, right)) {
    return true;
  }
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((entry, index) => sameModelValue(entry, right[index]));
  }
  if (!isRecord(left) || !isRecord(right)) {
    return false;
  }
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every((key) => Object.hasOwn(right, key) && sameModelValue(left[key], right[key]));
};
var readNumber = (value, label) => {
  if (typeof value !== "number") {
    throw new TypeError(`${label} must be a number.`);
  }
  return value;
};
var readTiles = (value) => {
  if (!Array.isArray(value)) {
    throw new TypeError("Native tile model 'tiles' must be an array.");
  }
  return value.map((tile, tileIndex) => {
    if (!Array.isArray(tile)) {
      throw new TypeError(`Tile ${tileIndex} must be an array of rows.`);
    }
    return tile.map((row, rowIndex) => {
      if (!Array.isArray(row)) {
        throw new TypeError(`Tile ${tileIndex} row ${rowIndex} must be an array of pixels.`);
      }
      return row.map(
        (pixel, column) => readNumber(pixel, `Tile ${tileIndex} pixel ${column},${rowIndex}`)
      );
    });
  });
};
var readColors = (value) => {
  if (!Array.isArray(value)) {
    throw new TypeError("Native palette model 'colors' must be an array.");
  }
  return value.map((color, index) => {
    if (!isRecord(color)) {
      throw new TypeError(`Color ${index} must be an object.`);
    }
    return {
      red: readNumber(color.red, `Color ${index} red`),
      green: readNumber(color.green, `Color ${index} green`),
      blue: readNumber(color.blue, `Color ${index} blue`),
      unusedHighBit: readNumber(color.unusedHighBit, `Color ${index} unusedHighBit`)
    };
  });
};
var readEntries = (value) => {
  if (!Array.isArray(value)) {
    throw new TypeError("Native tilemap model 'entries' must be an array.");
  }
  return value.map((entry, index) => {
    if (!isRecord(entry)) {
      throw new TypeError(`Entry ${index} must be an object.`);
    }
    return {
      tile: readNumber(entry.tile, `Entry ${index} tile`),
      palette: readNumber(entry.palette, `Entry ${index} palette`),
      priority: readNumber(entry.priority, `Entry ${index} priority`),
      horizontalFlip: readNumber(entry.horizontalFlip, `Entry ${index} horizontalFlip`),
      verticalFlip: readNumber(entry.verticalFlip, `Entry ${index} verticalFlip`)
    };
  });
};
var readIndexes = (value) => {
  if (!Array.isArray(value)) {
    throw new TypeError("Native tilemap model 'indexes' must be an array.");
  }
  return value.map((entry, index) => readNumber(entry, `Index ${index}`));
};
var readBlocks = (value) => {
  if (!Array.isArray(value)) {
    throw new TypeError("Native BRR model 'blocks' must be an array.");
  }
  return value.map((block, index) => {
    if (!isRecord(block) || !Array.isArray(block.nibbles)) {
      throw new TypeError(`BRR block ${index} must be an object with nibbles.`);
    }
    return {
      range: readNumber(block.range, `BRR block ${index} range`),
      filter: readNumber(block.filter, `BRR block ${index} filter`),
      loop: readNumber(block.loop, `BRR block ${index} loop`),
      end: readNumber(block.end, `BRR block ${index} end`),
      nibbles: block.nibbles.map(
        (nibble, sampleIndex) => readNumber(nibble, `BRR nibble ${sampleIndex}`)
      )
    };
  });
};
var nativeEncoder = (id2, kind, output, modelField, encode, decode) => Object.freeze({
  id: id2,
  version: "1.0.0",
  inputKinds: [kind],
  primaryOutput: output,
  encode: (document2, options) => {
    if (Object.keys(options).length !== 0) {
      throw new Error(`Native encoder '${id2}' accepts no options.`);
    }
    if (!isRecord(document2.value)) {
      throw new Error(`Native encoder '${id2}' requires an object model.`);
    }
    const value = document2.value;
    const bytes = encode(value);
    if (!sameModelValue(decode(bytes), value[modelField])) {
      throw new Error(`Native encoder '${id2}' did not preserve '${modelField}'.`);
    }
    return {
      outputs: { [output]: { bytes, mediaType: "application/octet-stream" } },
      fidelity: { kind: "exact", verification: "native model round trip" },
      normalizedOptions: {}
    };
  }
});
var snesNativeEncoders = Object.freeze(
  [
    ...[2, 3, 4, 8].map(
      (depth) => nativeEncoder(
        `snes.tile.${depth}bpp`,
        "snes-planar-tiles",
        "tiles",
        "tiles",
        (value) => encodePlanarTiles(readTiles(value.tiles), depth),
        (bytes) => decodePlanarTiles(bytes, depth)
      )
    ),
    nativeEncoder(
      "snes.tile.mode7",
      "snes-mode7-tiles",
      "tiles",
      "tiles",
      (value) => encodeMode7Tiles(readTiles(value.tiles)),
      decodeMode7Tiles
    ),
    nativeEncoder(
      "snes.palette.bgr555",
      "snes-palette-bgr555",
      "palette",
      "colors",
      (value) => encodeBgr555(readColors(value.colors)),
      decodeBgr555
    ),
    nativeEncoder(
      "snes.tilemap.bg",
      "snes-bg-tilemap",
      "tilemap",
      "entries",
      (value) => encodeBgMap(readEntries(value.entries)),
      decodeBgMap
    ),
    nativeEncoder(
      "snes.tilemap.mode7",
      "snes-mode7-tilemap",
      "tilemap",
      "indexes",
      (value) => encodeMode7Map(readIndexes(value.indexes)),
      decodeMode7Map
    ),
    nativeEncoder(
      "snes.brr",
      "snes-brr",
      "brr",
      "blocks",
      (value) => encodeBrrBlocks(readBlocks(value.blocks)),
      decodeBrrBlocks
    )
  ].toSorted((left, right) => left.id.localeCompare(right.id))
);

// packages/assets/src/brr-codec.ts
function decodeNibble(nibble, range, filter, state) {
  let value = range <= 12 ? nibble << range >> 1 : nibble & ~2047;
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
      for (const nibble of block.nibbles) {
        const sample = decodeNibble(nibble, block.range, block.filter, state);
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
    for (let nibble = -8; nibble <= 7; nibble++) {
      const decoded2 = decodeNibble(nibble, range, filter, state);
      const error = (target - decoded2) ** 2;
      if (error < bestError || error === bestError && Math.abs(nibble) < Math.abs(bestNibble)) {
        bestNibble = nibble;
        bestSample = decoded2;
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

// packages/assets/src/audio.ts
var MAX_WAVE_BYTES = 16 * 1024 * 1024;
var MAX_SAMPLES = 1024 * 1024;
var isRecord2 = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
var PCM_MODEL_ERROR = "PCM model requires bounded mono PCM16 samples and an explicit source rate/depth.";
function readPcmAudio(value) {
  if (!isRecord2(value)) {
    throw new Error(PCM_MODEL_ERROR);
  }
  const samples = value.samples;
  const sampleRate = value.sampleRate;
  const sourceBitDepth = value.sourceBitDepth;
  if (!(samples instanceof Int16Array) || typeof sampleRate !== "number" || !Number.isSafeInteger(sampleRate) || sampleRate < 1 || sampleRate > 384e3 || sourceBitDepth !== 8 && sourceBitDepth !== 16) {
    throw new Error(PCM_MODEL_ERROR);
  }
  let loop;
  if (value.loop !== void 0) {
    const sourceLoop = value.loop;
    if (!isRecord2(sourceLoop) || typeof sourceLoop.start !== "number" || typeof sourceLoop.end !== "number") {
      throw new Error(PCM_MODEL_ERROR);
    }
    loop = { start: sourceLoop.start, end: sourceLoop.end };
  }
  return {
    kind: "pcm-audio",
    sampleRate,
    sourceBitDepth,
    samples,
    ...loop === void 0 ? {} : { loop }
  };
}
var u16le = (bytes, offset) => bytes[offset] | bytes[offset + 1] << 8;
var u32le = (bytes, offset) => bytes[offset] + bytes[offset + 1] * 256 + bytes[offset + 2] * 65536 + bytes[offset + 3] * 16777216 >>> 0;
var ascii = (bytes, offset, length) => String.fromCharCode(...bytes.subarray(offset, offset + length));
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
var waveImporter = Object.freeze({
  id: "uttori.import.wave",
  version: "1.0.0",
  mediaTypes: ["audio/wav", "audio/wave", "audio/x-wav"],
  import: (input2) => {
    const chunks = scanWave(input2.bytes);
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
var resolveBrrAudioOptions = (raw, source) => {
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
    requested = source.loop;
  }
  if (!requested || typeof requested !== "object" || Array.isArray(requested) || !("start" in requested) || !("end" in requested) || typeof requested.start !== "number" || typeof requested.end !== "number" || Object.keys(requested).some((key) => key !== "start" && key !== "end")) {
    throw new Error("loop must be false, 'source', or { start, end } in sample frames.");
  }
  if (!Number.isSafeInteger(requested.start) || !Number.isSafeInteger(requested.end) || requested.start < 0 || requested.start >= requested.end || requested.end !== source.samples.length || requested.start % 16 !== 0 || requested.end % 16 !== 0) {
    throw new Error("BRR loop must start on a 16-sample boundary and end at the unpadded tail.");
  }
  return { padding, loop: { start: requested.start, end: requested.end } };
};
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
        const audio = readPcmAudio(document2.value);
        const options = resolveBrrAudioOptions(rawOptions, audio);
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
        const loop = options.loop;
        const brr = encodeBrrPcm(padded, Boolean(loop));
        const loopOffset = loop ? loop.start / 16 * 9 : void 0;
        const decoded2 = decodeBrrPcm(brr, loopOffset);
        let squared = 0;
        let signal = 0;
        let peakError = 0;
        for (let index = 0; index < originalCount; index++) {
          const error = audio.samples[index] - decoded2[index];
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
              bytes: writePcmWave(decoded2, audio.sampleRate),
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
            decodedSamples: decoded2.length,
            peakError,
            rmsError,
            snrDb,
            loopPeakError
          },
          normalizedOptions: { padding: options.padding, loop }
        };
      }
    });
  });
}

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
    const mode = options.mode ?? "copy";
    if (!["copy", "source-over"].includes(mode)) {
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
      const input2 = start + row * stride;
      if (mode === "copy") {
        this.rgba.set(bytes.subarray(input2, input2 + rowLength), destination);
      } else {
        for (let i = input2; i < input2 + rowLength; i += 4, destination += 4) {
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
          const input2 = sy * this.width + this.width - x - 1, output = y * this.width + x;
          if (inputWords && outputWords) {
            outputWords[output] = inputWords[input2];
          } else {
            for (let c = 0; c < 4; c++) {
              result.rgba[output * 4 + c] = this.rgba[input2 * 4 + c];
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
          const input2 = (sourceRow + offsets[x]) * 4, output = (destinationRow + x) * 4;
          result.rgba[output] = this.rgba[input2];
          result.rgba[output + 1] = this.rgba[input2 + 1];
          result.rgba[output + 2] = this.rgba[input2 + 2];
          result.rgba[output + 3] = this.rgba[input2 + 3];
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
var debug3 = () => {
};
if (typeof process !== "undefined" && process.env.UTTORI_DATA_DEBUG) {
  try {
    const { default: d } = await Promise.resolve().then(() => __toESM(require_src(), 1));
    debug3 = d("Uttori.ImagePNG");
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
function prepareInput(input2, options, maxInputBytes) {
  if (options.copyInput !== void 0 && typeof options.copyInput !== "boolean") {
    throw new TypeError("copyInput must be a boolean.");
  }
  if (options.allow16Bit !== void 0 && typeof options.allow16Bit !== "boolean") {
    throw new TypeError("allow16Bit must be a boolean.");
  }
  if (options.animation !== void 0 && options.animation !== "reject" && options.animation !== "default-image") {
    throw new Error("animation must be reject or default-image.");
  }
  if (input2 instanceof data_buffer_default) {
    input2 = input2.data;
  }
  if (typeof input2 === "number") {
    throw new TypeError("ImagePNG requires PNG data, not an allocation length.");
  }
  let bytes;
  if (input2 instanceof ArrayBuffer) {
    bytes = new Uint8Array(input2);
  } else if (ArrayBuffer.isView(input2)) {
    bytes = new Uint8Array(input2.buffer, input2.byteOffset, input2.byteLength);
  } else if (Array.isArray(input2) || typeof input2 === "string") {
    if (input2.length > maxInputBytes) {
      throw new RangeError("PNG exceeds the input byte limit.");
    }
    bytes = new data_buffer_default(input2).data;
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
  const checksum = data_buffer_default.allocate(4);
  checksum.writeUInt32(computeBytes(output.subarray(4, data.length + 8)));
  checksum.commit();
  output.set(checksum.data, data.length + 8);
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
  constructor(input2, options = {}) {
    const limits = resolveLimits(options);
    super(prepareInput(input2, options, limits.maxInputBytes));
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
    const chunk2 = this.data.subarray(offset + 8, end - 4);
    const critical = (this.peekUInt8(offset + 4) & 32) === 0;
    const dataSeen = this.dataChunks.length !== 0;
    debug3("decodeChunk:", type, "length:", length);
    switch (type) {
      case "IHDR":
        if (this._seenChunks.has(type)) {
          throw new Error("PNG requires exactly one IHDR.");
        }
        this.decodeIHDR(chunk2);
        break;
      case "PLTE":
        if (this._seenChunks.has(type) || dataSeen || this._seenChunks.has("tRNS") || this.colorType === 0 || this.colorType === 4) {
          throw new Error("Invalid PNG PLTE placement.");
        }
        this.decodePLTE(chunk2);
        break;
      case "tRNS":
        if (this._seenChunks.has(type) || dataSeen) {
          throw new Error("Invalid PNG tRNS placement.");
        }
        this.decodeTRNS(chunk2);
        break;
      case "pHYs":
        if (this._seenChunks.has(type) || dataSeen) {
          throw new Error("Invalid PNG pHYs placement.");
        }
        this.decodePHYS(chunk2);
        break;
      case "IDAT":
        if (this._dataEnded || this.colorType === 3 && !this._seenChunks.has("PLTE")) {
          throw new Error("PNG IDAT chunks must be contiguous and follow PLTE.");
        }
        this.decodeIDAT(chunk2);
        break;
      case "IEND":
        if (!dataSeen || end !== this.data.length) {
          throw new Error("Invalid PNG IEND chunk or trailing file bytes.");
        }
        this.decodeIEND(chunk2);
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
      data: chunk2,
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
  decodeIHDR(chunk2) {
    if (chunk2.length !== 13) {
      throw new Error("PNG requires a 13-byte IHDR.");
    }
    const header = new data_buffer_default(chunk2);
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
  decodePLTE(chunk2) {
    this.setPalette(chunk2);
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
  decodeIDAT(chunk2) {
    this.dataChunks.push(chunk2);
    this.invalidatePixels();
  }
  /**
   * Decode the tRNS (Transparency) chunk.
   * The tRNS chunk specifies that the image uses simple transparency: either alpha values associated with palette entries (for indexed-color images) or a single transparent color (for grayscale and truecolor images). Although simple transparency is not as elegant as the full alpha channel, it requires less storage space and is sufficient for many common cases.
   * @param chunk Data Blob
   * @throws {Error} Transparency is incompatible with the color type or sample depth.
   * @see {@link https://www.w3.org/TR/PNG/#11tRNS|Transparency}
   */
  decodeTRNS(chunk2) {
    switch (this.colorType) {
      case 3:
        if (this.palette.length === 0 || chunk2.length === 0 || chunk2.length > this.palette.length / 3) {
          throw new Error("Invalid indexed PNG tRNS chunk.");
        }
        break;
      case 0:
        if (chunk2.length !== 2) {
          throw new Error("Grayscale PNG tRNS requires two bytes.");
        }
        break;
      case 2:
        if (chunk2.length !== 6) {
          throw new Error("RGB PNG tRNS requires six bytes.");
        }
        break;
      default:
        throw new Error("PNG color types with alpha cannot contain tRNS.");
    }
    if (this.colorType !== 3) {
      const maximum = 2 ** this.bitDepth - 1;
      const buffer = new data_buffer_default(chunk2);
      while (buffer.remainingBytes() > 0) {
        if (buffer.readUInt16() > maximum) {
          throw new Error("PNG tRNS sample exceeds bit depth.");
        }
      }
    }
    this.transparency = Uint8Array.from(chunk2);
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
  decodePHYS(chunk2) {
    if (chunk2.length !== 9) {
      throw new Error("Invalid PNG pHYs chunk.");
    }
    const buffer = new data_buffer_default(chunk2);
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
  decodeIEND(chunk2) {
    if (chunk2.length !== 0) {
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
    inflator.onData = (chunk2) => {
      if (written + chunk2.length > expected) {
        throw new Error("PNG inflated data exceeds declared dimensions.");
      }
      output.set(chunk2, written);
      written += chunk2.length;
    };
    inflator.onEnd = (status) => {
      ended = true;
      errorCode = status;
    };
    for (const chunk2 of this.dataChunks) {
      if (chunk2.length === 0) {
        continue;
      }
      if (ended) {
        throw new Error("PNG has compressed data after the zlib stream.");
      }
      compressedLength += chunk2.length;
      if (compressedLength > this._limits.maxInputBytes) {
        throw new RangeError("PNG exceeds the input byte limit.");
      }
      if (!inflator.push(chunk2, false) || errorCode !== 0) {
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
    for (const chunk2 of image.chunks) {
      const { type } = chunk2;
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
      } else if (type === "IHDR" || type === "PLTE" || type === "tRNS" || type === "IDAT" || type === "IEND" || chunk2.safeToCopy || retained.has(type)) {
        parts2.push(chunk2.raw);
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
function boundedProduct(a, b, maximum, label) {
  integer(maximum, `${label} limit`, 0, Number.MAX_SAFE_INTEGER);
  integer(a, label, 0, Number.MAX_SAFE_INTEGER);
  integer(b, label, 0, Number.MAX_SAFE_INTEGER);
  if (a !== 0 && b > Math.floor(maximum / a)) {
    throw new RangeError(`${label} exceeds limit ${maximum}.`);
  }
  return a * b;
}
function boundedSum(total, next, maximum, label) {
  integer(maximum, `${label} limit`, 0, Number.MAX_SAFE_INTEGER);
  integer(total, label, 0, maximum);
  integer(next, label, 0, maximum - total);
  return total + next;
}
function rasterArea(width, height, label = "Raster", side = ASSET_LIMITS.rasterPixels) {
  integer(width, `${label} width`, 1, side);
  integer(height, `${label} height`, 1, side);
  return boundedProduct(width, height, ASSET_LIMITS.rasterPixels, `${label} pixels`);
}
var PNG_EDITOR_BACKUP_BYTES = Math.ceil((ASSET_LIMITS.pngBytes + 2 * ASSET_LIMITS.rasterPixels) / 3) * 4 + 1024 * 1024;

// packages/assets/src/preview.ts
function rgbaNativePng(rgba, width, height) {
  integer(width, "Image width", 1, ASSET_LIMITS.interchangeSide);
  integer(height, "Image height", 1, ASSET_LIMITS.interchangeSide);
  if (width * height > ASSET_LIMITS.rasterPixels || rgba.length !== width * height * 4) {
    throw new Error("Image pixels are missing or exceed the four-megapixel limit.");
  }
  const bytes = new Uint8Array(rgba.buffer, rgba.byteOffset, rgba.byteLength);
  const surface = new RgbaSurface(width, height, bytes, {
    copy: false,
    maxPixels: ASSET_LIMITS.rasterPixels
  });
  return data_image_png_default.encodeRGBA(surface, {
    filter: "none",
    level: 6,
    maxPixels: ASSET_LIMITS.rasterPixels,
    maxOutputBytes: ASSET_LIMITS.pngBytes
  });
}
function rgbaPreviewPng(rgba, width, height, maxEdge = 256) {
  integer(width, "Preview width", 1, ASSET_LIMITS.interchangeSide);
  integer(height, "Preview height", 1, ASSET_LIMITS.interchangeSide);
  integer(maxEdge, "Preview edge", 1, ASSET_LIMITS.thumbnailEdge);
  if (width * height > ASSET_LIMITS.rasterPixels || rgba.length !== width * height * 4) {
    throw new Error("Preview pixels are missing or exceed the four-megapixel limit.");
  }
  const bytes = new Uint8Array(rgba.buffer, rgba.byteOffset, rgba.byteLength);
  const surface = new RgbaSurface(width, height, bytes, {
    copy: false,
    maxPixels: ASSET_LIMITS.rasterPixels
  }).fitNearest(maxEdge);
  return data_image_png_default.encodeRGBA(surface, {
    filter: "none",
    level: 6,
    maxPixels: 1024 * 1024
  });
}
function waveformPreviewPng(samples) {
  const width = 256;
  const height = 64;
  const rgba = new Uint8Array(width * height * 4);
  for (let x = 0; x < width; x++) {
    const start = Math.floor(x * samples.length / width);
    const end = Math.max(start + 1, Math.ceil((x + 1) * samples.length / width));
    let low = 0;
    let high = 0;
    for (let index = start; index < Math.min(end, samples.length); index++) {
      low = Math.min(low, samples[index]);
      high = Math.max(high, samples[index]);
    }
    const top = Math.max(0, Math.floor(31 - high * 30 / 32768));
    const bottom = Math.min(63, Math.ceil(32 - low * 30 / 32768));
    for (let y = top; y <= bottom; y++) {
      const pixel = (y * width + x) * 4;
      rgba.set([68, 164, 255, 255], pixel);
    }
  }
  return rgbaPreviewPng(rgba, width, height);
}

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
  import: (input2) => {
    const image = readAssetPng(input2.bytes);
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

// packages/assets/src/indexed-edit.ts
function validateIndexedPixels(image) {
  const pixels = rasterArea(image.width, image.height, "Indexed");
  if (!(image.indexes instanceof Uint8Array) || image.indexes.length !== pixels) {
    throw new RangeError("Indexed pixels are missing or exceed the four-megapixel limit.");
  }
}
function validateBounds(bounds) {
  integer(bounds.x, "Rectangle x", -(1 << 20), 1 << 20);
  integer(bounds.y, "Rectangle y", -(1 << 20), 1 << 20);
  rasterArea(bounds.width, bounds.height, "Rectangle");
}
function validateOrientation(value) {
  for (const flag of [value.flipX, value.flipY]) {
    if (flag !== void 0 && typeof flag !== "boolean") {
      throw new TypeError("Flip must be boolean.");
    }
  }
}
function mappedIndex(index, map) {
  if (!map) {
    return index;
  }
  const mappedSlot = Number.isInteger(index) && index >= 0 && index < map.length ? map[index] : void 0;
  if (mappedSlot === void 0 || mappedSlot === null) {
    throw new RangeError(`Unmapped palette index ${index}.`);
  }
  return integer(mappedSlot, "Mapped palette index", 0, 255);
}
function extractIndexedRegion(image, region) {
  validateIndexedPixels(image);
  validateBounds(region);
  validateOrientation(region);
  if (region.x < 0 || region.y < 0 || region.x + region.width > image.width || region.y + region.height > image.height) {
    throw new RangeError("Source rectangle exceeds image.");
  }
  const indexes = new Uint8Array(region.width * region.height);
  for (let y = 0; y < region.height; y++) {
    for (let x = 0; x < region.width; x++) {
      const sx = region.x + (region.flipX ? region.width - x - 1 : x);
      const sy = region.y + (region.flipY ? region.height - y - 1 : y);
      indexes[y * region.width + x] = mappedIndex(
        image.indexes[sy * image.width + sx],
        region.indexMap
      );
    }
  }
  return { width: region.width, height: region.height, indexes };
}
function renderIndexedPlacements(sources, placements, viewport, background) {
  validateBounds(viewport);
  if (background && background.length !== viewport.width * viewport.height) {
    throw new RangeError("Background dimensions do not match the viewport.");
  }
  if (placements.length > 65536) {
    throw new RangeError("Too many indexed placements.");
  }
  const ids = /* @__PURE__ */ new Set();
  let work = 0;
  for (const placement of placements) {
    if (!placement.id || ids.has(placement.id)) {
      throw new Error(`Duplicate/empty placement ${placement.id}.`);
    }
    ids.add(placement.id);
    const source = sources.get(placement.source);
    if (!source) {
      throw new Error(`Placement ${placement.id}: missing source ${placement.source}.`);
    }
    validateIndexedPixels(source);
    validateOrientation(placement);
    integer(placement.x, "Placement x", -(1 << 20), 1 << 20);
    integer(placement.y, "Placement y", -(1 << 20), 1 << 20);
    if (placement.transparentIndex !== void 0 && placement.transparentIndex !== null) {
      integer(placement.transparentIndex, "Transparent index", 0, 255);
    }
    if (placement.x < viewport.x || placement.y < viewport.y || placement.x + source.width > viewport.x + viewport.width || placement.y + source.height > viewport.y + viewport.height) {
      throw new RangeError(`Placement ${placement.id} exceeds the viewport.`);
    }
    work = boundedSum(
      work,
      source.indexes.length,
      ASSET_LIMITS.renderPixels,
      "Placement rendering work"
    );
  }
  const indexes = background ? Uint8Array.from(background) : new Uint8Array(viewport.width * viewport.height);
  for (const placement of placements) {
    const source = sources.get(placement.source);
    const transparent = placement.transparentIndex === void 0 ? 0 : placement.transparentIndex;
    for (let y = 0; y < source.height; y++) {
      for (let x = 0; x < source.width; x++) {
        const sx = placement.flipX ? source.width - x - 1 : x;
        const sy = placement.flipY ? source.height - y - 1 : y;
        const index = source.indexes[sy * source.width + sx];
        if (index === transparent) {
          continue;
        }
        const target = (placement.y - viewport.y + y) * viewport.width + placement.x - viewport.x + x;
        indexes[target] = mappedIndex(index, placement.indexMap);
      }
    }
  }
  return { width: viewport.width, height: viewport.height, indexes };
}
function expandIndexedGrid(block) {
  integer(block.columns, "Grid columns", 1, 65536);
  integer(block.cellWidth, "Grid cell width", 1, 1 << 20);
  integer(block.cellHeight, "Grid cell height", 1, 1 << 20);
  integer(block.x, "Grid x", -(1 << 20), 1 << 20);
  integer(block.y, "Grid y", -(1 << 20), 1 << 20);
  validateOrientation(block);
  if (typeof block.id !== "string" || !block.id || block.cells.length < 1 || block.cells.length > 65536 || block.cells.length % block.columns !== 0) {
    throw new Error("Grid requires an identity and complete bounded rows.");
  }
  const rows2 = block.cells.length / block.columns;
  return block.cells.map((cell, index) => {
    const column = index % block.columns;
    const row = Math.floor(index / block.columns);
    return {
      ...cell,
      id: JSON.stringify([block.id, index]),
      x: block.x + (block.flipX ? block.columns - column - 1 : column) * block.cellWidth,
      y: block.y + (block.flipY ? rows2 - row - 1 : row) * block.cellHeight,
      flipX: block.flipX ?? false,
      flipY: block.flipY ?? false
    };
  });
}

// packages/assets/src/indexed-values.ts
function indexedPalette(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 256) {
    throw new Error("Indexed palette requires 1..256 slots.");
  }
  return value.map((slot) => {
    if (!Array.isArray(slot) || slot.length !== 4) {
      throw new Error("Palette slots require four RGBA8 channels.");
    }
    const channels = slot;
    const result = [0, 0, 0, 0];
    for (let channel = 0; channel < 4; channel++) {
      const channelValue = channels[channel];
      if (typeof channelValue !== "number") {
        throw new TypeError("Palette channel must be a number.");
      }
      result[channel] = integer(channelValue, "Palette channel", 0, 255);
    }
    return result;
  });
}
function indexedPaletteChanges(before, after, editableSlots) {
  indexedPalette(before);
  indexedPalette(after);
  if (before.length !== after.length) {
    throw new Error("Palette inventory changed.");
  }
  const editable = new Set(editableSlots);
  if (editable.size !== editableSlots.length) {
    throw new Error("Duplicate editable palette slot.");
  }
  for (const slot of editable) {
    integer(slot, "Editable palette slot", 0, before.length - 1);
  }
  const changes = [];
  after.forEach((color, index) => {
    if (color[3] !== before[index][3]) {
      throw new Error("Palette alpha changes are unsupported.");
    }
    if (color.some((channel, i) => channel !== before[index][i])) {
      if (!editable.has(index)) {
        throw new Error(`Read-only palette slot changed: ${index}.`);
      }
      changes.push({ index, color: [...color] });
    }
  });
  return changes;
}

// packages/assets/src/png-edit.ts
function rewriteIndexedPng(source, edit) {
  return data_image_png_default.rewriteIndexed(source, edit, {
    ...ASSET_PNG_OPTIONS,
    filter: "none",
    level: 6,
    validateIndexed: validateIndexedPixels
  });
}
function createIndexedPng(image) {
  validateIndexedPixels(image);
  return data_image_png_default.encodeIndexed(image, {
    ...ASSET_PNG_OPTIONS,
    bitDepth: 8,
    filter: "none",
    level: 6
  });
}

// packages/assets/src/image-conversion.ts
var isRecord3 = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
var isPlanarDepth = (value) => value === 2 || value === 3 || value === 4 || value === 8;
var isSourceBitDepth = (value) => value === 1 || value === 2 || value === 4 || value === 8;
var isRgbaTuple = (value) => Array.isArray(value) && value.length === 4 && value.every(
  (channel) => typeof channel === "number" && Number.isInteger(channel) && channel >= 0 && channel <= 255
);
var readInteger = (value, label, minimum, maximum) => {
  if (typeof value !== "number") {
    throw new RangeError(`${label} must be a number.`);
  }
  return integer(value, label, minimum, maximum);
};
var readBoolean = (value, name) => {
  if (typeof value !== "boolean") {
    throw new Error(`${name} must be boolean.`);
  }
  return value;
};
var expand = (channel, profile) => {
  if (profile === "bit-replicate") {
    return channel << 3 | channel >> 2;
  }
  return Math.floor(channel * 255 / 31);
};
var reduce = (channel, profile, label) => {
  integer(channel, label, 0, 255);
  for (let value = 0; value < 32; value++) {
    if (expand(value, profile) === channel) {
      return value;
    }
  }
  throw new Error(`${label}=${channel} is not representable by ${profile} BGR555.`);
};
var colorKey = (color) => Array.from(color).join(",");
var readLayout = (raw) => {
  if (raw === void 0) {
    return { tileOrder: "row-major" };
  }
  if (!isRecord3(raw)) {
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
var readOptions = (raw, indexed) => {
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
  if (!isRecord3(map) || Object.keys(map).some(
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
var externalPalette = (input2) => {
  if (input2.mediaType !== "application/json") {
    throw new Error("External palette resource must be application/json.");
  }
  if (input2.bytes.length > 64 * 1024) {
    throw new Error("External palette JSON exceeds 64 KiB.");
  }
  const value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(input2.bytes));
  if (!isRecord3(value) || value.version !== 1 || !Array.isArray(value.colors) || value.colors.length === 0 || value.colors.length > 256) {
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
      const resource = Object.hasOwn(resources, options.palette) ? resources[options.palette] : void 0;
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
      const resource = Object.hasOwn(resources, options.palette) ? resources[options.palette] : void 0;
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
  if (document2.kind !== "indexed-image" && document2.kind !== "rgba-image" || !isRecord3(document2.value)) {
    throw new Error("Image encoder requires imported PNG pixels.");
  }
  const value = document2.value;
  if (value.kind !== document2.kind || typeof value.width !== "number" || typeof value.height !== "number" || !Number.isSafeInteger(value.width) || !Number.isSafeInteger(value.height) || value.width < 1 || value.height < 1 || value.width > ASSET_LIMITS.rasterPixels || value.height > Math.floor(ASSET_LIMITS.rasterPixels / value.width)) {
    throw new Error("Image model has invalid dimensions or kind.");
  }
  const pixels = value.width * value.height;
  if (document2.kind === "indexed-image") {
    if (!(value.indexes instanceof Uint8Array) || value.indexes.length !== pixels || !Array.isArray(value.palette) || value.palette.length < 1 || value.palette.length > 256 || !isSourceBitDepth(value.sourceBitDepth)) {
      throw new Error("Indexed image model has invalid pixels, palette, or source depth.");
    }
    const palette = [];
    for (const [index, color] of value.palette.entries()) {
      if (!isRgbaTuple(color)) {
        throw new Error(`Indexed image palette entry ${index} is not RGBA8.`);
      }
      const entry = [
        color[0],
        color[1],
        color[2],
        color[3]
      ];
      palette.push(entry);
    }
    return {
      kind: "indexed-image",
      width: value.width,
      height: value.height,
      indexes: value.indexes,
      palette,
      sourceBitDepth: value.sourceBitDepth
    };
  }
  if (!(value.rgba instanceof Uint8Array) || value.rgba.length !== pixels * 4) {
    throw new Error("RGBA image model has invalid pixel bytes.");
  }
  return {
    kind: "rgba-image",
    width: value.width,
    height: value.height,
    rgba: value.rgba
  };
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
  const indexByCoordinate = Array.from({ length: coordinates.length }, () => 0);
  const tiles = coordinates.map(([tx, ty], storageIndex) => {
    indexByCoordinate[ty * widthTiles + tx] = storageIndex;
    return Array.from(
      { length: 8 },
      (_, row) => Array.from({ length: 8 }, (_column, column) => {
        const sourceX = options.tilemap.horizontalFlip ? 7 - column : column;
        const sourceY = options.tilemap.verticalFlip ? 7 - row : row;
        return selection.indexes[(ty * 8 + sourceY) * image.width + tx * 8 + sourceX];
      })
    );
  });
  let tileBytes;
  let decodedTiles;
  if (mode7) {
    tileBytes = encodeMode7Tiles(tiles);
    decodedTiles = decodeMode7Tiles(tileBytes);
  } else if (isPlanarDepth(depth)) {
    tileBytes = encodePlanarTiles(tiles, depth);
    decodedTiles = decodePlanarTiles(tileBytes, depth);
  } else {
    throw new Error(`Unsupported planar tile format '${format}'.`);
  }
  const paletteBytes = encodeBgr555(colors);
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
    normalizedOptions: {
      palette: options.palette,
      paletteExpansion: options.paletteExpansion,
      layout: options.layout,
      tilemap: options.tilemap
    }
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

// packages/assets/src/secret-of-mana/som-body-frame.ts
var signed7 = (byte) => (byte & 63) - (byte & 64);
function decodeBodyFrame(input2) {
  if (!Array.isArray(input2) && !(input2 instanceof Uint8Array) || input2.length < 2 || input2.length > 157 || [...input2].some((v) => !Number.isInteger(v) || v < 0 || v > 255)) {
    throw new Error("Invalid bounded body frame bytes.");
  }
  const bytes = Uint8Array.from(input2);
  const groups2 = bytes[0] & 15 || 1;
  const tileOffsets = [];
  let offset = 1;
  while (tileOffsets.length < groups2 * 4) {
    if (offset + 2 > bytes.length) {
      throw new Error("Truncated sprite tile word.");
    }
    const word = bytes[offset] | bytes[offset + 1] << 8;
    offset += 2;
    const count = word & 32768 ? (word & 15) + 1 : 1;
    for (let i = 0; i < count && tileOffsets.length < groups2 * 4; i++) {
      const increment = (word & 49152) === 49152 ? i : 0;
      tileOffsets.push((word & 16368) * 2 + increment * 32 & 65535);
    }
  }
  if (offset + groups2 * 2 > bytes.length) {
    throw new Error("Missing sprite block offsets.");
  }
  const coordinateOffsets = Array.from({ length: groups2 }, (_, i) => ({
    y: offset + i * 2,
    x: offset + i * 2 + 1
  }));
  const blocks = coordinateOffsets.map(({ x, y }) => ({
    x: signed7(bytes[x]),
    y: signed7(bytes[y]),
    flipX: !!(bytes[x] & 128),
    priority: !!(bytes[y] & 128)
  }));
  offset += groups2 * 2;
  const boxes = Number(!!(bytes[0] & 32)) + Number(!!(bytes[0] & 64));
  if (bytes.length - offset !== boxes * (bytes[0] & 16 ? 3 : 2)) {
    throw new Error("Frame tail disagrees with header and pointer bound.");
  }
  return {
    header: bytes[0],
    groups: groups2,
    tileOffsets,
    blocks,
    coordinateOffsets,
    collisionBytes: bytes.slice(offset)
  };
}

// packages/assets/src/secret-of-mana/som-frame-composition.ts
function isUnknownArray(value) {
  return Array.isArray(value);
}
function isIntegerPair(value) {
  if (!Array.isArray(value) || value.length !== 2) {
    return false;
  }
  for (const component of value) {
    if (typeof component !== "number" || !Number.isSafeInteger(component)) {
      return false;
    }
  }
  return true;
}
function placementValue(p) {
  return [
    p.id,
    p.block,
    p.quadrant,
    p.x,
    p.y,
    p.flipX,
    p.flipY,
    p.segment ?? null,
    p.tile ?? null,
    p.external?.romAddress ?? null,
    p.external?.indexes ?? null,
    p.paletteGroup ?? null
  ];
}
function deriveFramePlacements(layout2, frame) {
  if (!Array.isArray(frame.blocks) || !frame.blocks.length) {
    throw new Error(`Missing native blocks: ${frame.id}.`);
  }
  const external = /* @__PURE__ */ new Map();
  for (const p of frame.placements ?? []) {
    if (!p.external) {
      continue;
    }
    const e = p.external;
    if (!/^[\dA-F]{6}$/.test(e.romAddress) || !Array.isArray(e.indexes) || e.indexes.length !== 64 || e.indexes.some((v) => v !== 0)) {
      throw new Error(`Invalid external blank reference: ${frame.id}.`);
    }
    external.set(e.romAddress, e);
  }
  const resolve = (ref) => {
    if (isUnknownArray(ref)) {
      const segmentName = ref[0];
      const tile = ref[1];
      const segment = typeof segmentName === "string" && Object.hasOwn(layout2.segments, segmentName) ? layout2.segments[segmentName] : void 0;
      if (ref.length !== 2 || typeof segmentName !== "string" || typeof tile !== "number" || !Number.isSafeInteger(tile) || tile < 0 || tile >= (segment?.tiles.length ?? 0)) {
        throw new Error(`Invalid expanded graphics reference: ${frame.id}.`);
      }
      return { segment: segmentName, tile };
    }
    if (typeof ref !== "number" || !Number.isSafeInteger(ref) || ref < 0 || ref > 16777215) {
      throw new Error(`Invalid ROM tile reference: ${frame.id}.`);
    }
    const matches = Object.entries(layout2.segments).flatMap(([segment, value]) => {
      const delta = ref - Number.parseInt(value.romAddress, 16);
      return delta >= 0 && delta % 32 === 0 && delta / 32 < value.tiles.length ? [{ segment, tile: delta / 32 }] : [];
    });
    if (matches.length > 1) {
      throw new Error(`Ambiguous ROM tile ownership: ${ref.toString(16)}.`);
    }
    if (matches.length) {
      return matches[0];
    }
    const e = external.get(ref.toString(16).toUpperCase().padStart(6, "0"));
    if (!e) {
      throw new Error(`Unresolved ROM tile reference: ${ref.toString(16)}.`);
    }
    return { external: structuredClone(e) };
  };
  const ids = /* @__PURE__ */ new Set();
  return frame.blocks.flatMap((block) => {
    if (typeof block.id !== "string" || !block.id || ids.has(block.id) || ![8, 16, 32, 64].includes(block.size) || !Array.isArray(block.tiles) || block.tiles.length !== (block.size / 8) ** 2 || typeof block.flipX !== "boolean" || typeof block.flipY !== "boolean") {
      throw new Error(`Invalid native block: ${frame.id}/${block.id}.`);
    }
    ids.add(block.id);
    const display = {};
    if (block.paletteGroup !== void 0) {
      if (!Number.isInteger(block.paletteGroup) || block.paletteGroup < 0 || block.paletteGroup >= layout2.paletteRefs.length) {
        throw new Error(`Block ${frame.id}/${block.id} has an invalid display palette group.`);
      }
      display.paletteGroup = block.paletteGroup;
    }
    const references = block.tiles.map(resolve);
    return expandIndexedGrid({
      ...block,
      columns: block.size / 8,
      cellWidth: 8,
      cellHeight: 8,
      cells: references.map((_, index) => ({ source: String(index) }))
    }).map(
      (p, index) => Object.assign(
        {},
        {
          id: `${block.id}:tile-${index}`,
          block: block.id,
          quadrant: index,
          x: p.x,
          y: p.y,
          flipX: p.flipX,
          flipY: p.flipY
        },
        references[index],
        display
      )
    );
  });
}
function validateNativeFrame(frame) {
  const native = frame.nativeFrame;
  if (!native || Object.keys(native).length === 0) {
    return;
  }
  let graphicsBase;
  if (!native.bytes || !frame.blocks || !Number.isSafeInteger(native.address) || native.address < 0 || native.address > 16777215 || !Number.isSafeInteger(native.end) || native.end - native.address !== native.bytes.length) {
    throw new Error(`Invalid native frame extent: ${frame.id}.`);
  }
  const decoded2 = decodeBodyFrame(native.bytes);
  if (decoded2.groups !== frame.blocks.length) {
    throw new Error(`Native block count differs: ${frame.id}.`);
  }
  for (const [index, block] of frame.blocks.entries()) {
    const expected = decoded2.blocks[index];
    if (block.size !== 16 || block.flipY || block.x !== expected.x || block.y !== expected.y || block.flipX !== expected.flipX || block.priority !== expected.priority) {
      throw new Error(`Native frame and block disagree: ${frame.id}/${block.id}.`);
    }
    for (const [quadrant, address] of block.tiles.entries()) {
      if (typeof address !== "number" || !Number.isSafeInteger(address)) {
        throw new Error(`Body tiles require ROM addresses: ${frame.id}.`);
      }
      const relative = decoded2.tileOffsets[index * 4 + quadrant];
      const base = address & 16711680 | address - relative & 65535;
      graphicsBase ??= base;
      if (base !== graphicsBase) {
        throw new Error(`Native tile references disagree: ${frame.id}/${block.id}.`);
      }
    }
  }
}
function validateFrameComposition(layout2, frame) {
  const retained = frame.blocks !== void 0 || frame.placements !== void 0 || frame.nativeFrame !== void 0 || frame.origin !== void 0;
  if (!retained) {
    return void 0;
  }
  const placements = frame.placements;
  if (!isIntegerPair(frame.origin) || !placements) {
    throw new Error(`Incomplete retained composition: ${frame.id}.`);
  }
  const expected = deriveFramePlacements(layout2, frame);
  validateNativeFrame(frame);
  if (placements.length !== expected.length || expected.some(
    (p, i) => JSON.stringify(placementValue(p)) !== JSON.stringify(placementValue(placements[i]))
  )) {
    throw new Error(`Derived placements disagree with native blocks: ${frame.id}.`);
  }
  return expected;
}

// packages/assets/src/secret-of-mana/som-sprite-palettes.ts
function expandChannel(value) {
  return value << 3 | value >>> 2;
}
function isSpritePaletteCatalog(value) {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  if (!("version" in value) || !("palettes" in value)) {
    return false;
  }
  const palettes = value.palettes;
  return value.version === 1 && typeof palettes === "object" && palettes !== null;
}
function paletteRecord(catalog, id2) {
  if (!isSpritePaletteCatalog(catalog) || typeof id2 !== "string") {
    throw new Error("Palette catalogue requires version 1 palette records.");
  }
  const palette = Object.hasOwn(catalog.palettes, id2) ? catalog.palettes[id2] : void 0;
  if (!palette || palette.romAddress !== id2 || ![0, 1].includes(palette.firstIndex) || !Array.isArray(palette.words) || palette.words.length < 1 || palette.words.length > 256 || palette.words.some((word) => typeof word !== "string" || !/^[\dA-Fa-f]{4}$/.test(word))) {
    throw new Error(`Unknown or invalid ROM palette ${id2}.`);
  }
  return palette;
}
function spritePaletteColors(catalog, id2) {
  const palette = paletteRecord(catalog, id2);
  if (palette.words.length !== 16 - palette.firstIndex) {
    throw new Error(`Frame sprite palette ${id2} needs sixteen display slots.`);
  }
  const colors = [[0, 0, 0, 0]];
  for (let index = 1; index < 16; index++) {
    const raw = palette.words[index - palette.firstIndex];
    const word = Number.parseInt(raw, 16);
    colors.push([
      expandChannel(word & 31),
      expandChannel(word >>> 5 & 31),
      expandChannel(word >>> 10 & 31),
      255
    ]);
  }
  return colors;
}
function spritePaletteBytes(catalog, id2, { wordOffset = 0, wordCount } = {}) {
  const record = paletteRecord(catalog, id2);
  const count = wordCount ?? record.words.length - wordOffset;
  if (!Number.isSafeInteger(wordOffset) || !Number.isSafeInteger(count) || wordOffset < 0 || count < 1 || wordOffset + count > record.words.length) {
    throw new Error(`Invalid ROM palette word slice ${id2}.`);
  }
  const words = record.words.slice(wordOffset, wordOffset + count);
  const bytes = new Uint8Array(words.length * 2);
  for (const [index, raw] of words.entries()) {
    const word = Number.parseInt(raw, 16);
    bytes[index * 2] = word & 255;
    bytes[index * 2 + 1] = word >>> 8;
  }
  return bytes;
}
function validateSpritePaletteAliases(catalog) {
  const words = /* @__PURE__ */ new Map();
  for (const id2 of Object.keys(catalog.palettes)) {
    const record = paletteRecord(catalog, id2), start = Number.parseInt(id2, 16);
    for (const [index, raw] of record.words.entries()) {
      const address = start + index * 2, word = raw.toUpperCase();
      if (words.has(address) && words.get(address) !== word) {
        throw new Error(
          `Conflicting palette aliases at ROM ${address.toString(16).toUpperCase()}.`
        );
      }
      words.set(address, word);
    }
  }
}
function spritePalettePreview(catalog, id2) {
  const palette = paletteRecord(catalog, id2);
  const colors = palette.words.map((raw) => {
    const word = Number.parseInt(raw, 16);
    return [
      expandChannel(word & 31),
      expandChannel(word >>> 5 & 31),
      expandChannel(word >>> 10 & 31),
      255
    ];
  });
  if (palette.firstIndex === 1) {
    colors.unshift([0, 0, 0, 0]);
  }
  const columns = palette.previewColumns ?? Math.min(4, colors.length);
  if (!Number.isSafeInteger(columns) || columns < 1 || columns > 16) {
    throw new Error(`ROM palette ${id2} has invalid preview columns.`);
  }
  const rows2 = Math.ceil(colors.length / columns);
  const width = columns * 9 + 1;
  const height = rows2 * 9 + 1;
  const rgba = new Uint8Array(width * height * 4);
  for (let pixel = 0; pixel < width * height; pixel++) {
    rgba.set([64, 64, 64, 255], pixel * 4);
  }
  for (let colorIndex = 0; colorIndex < colors.length; colorIndex++) {
    const [red, green, blue, alpha] = colors[colorIndex];
    const left = 1 + colorIndex % columns * 9;
    const top = 1 + Math.floor(colorIndex / columns) * 9;
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const offset = ((top + y) * width + left + x) * 4;
        rgba.set([red, green, blue, alpha], offset);
      }
    }
  }
  return { rgba, width, height };
}
function parseSpritePaletteCatalog(bytes) {
  let parsed;
  try {
    parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch (error) {
    throw new Error("Invalid sprite palette catalogue.", { cause: error });
  }
  if (!isSpritePaletteCatalog(parsed)) {
    throw new Error("Sprite palette catalogue must contain version 1 palette records.");
  }
  validateSpritePaletteAliases(parsed);
  return parsed;
}
function readSpritePaletteCatalog(options, resources) {
  if (typeof options.palettes !== "string" || !options.palettes.endsWith(".json")) {
    throw new Error("Sprite frames require a shared palettes JSON resource.");
  }
  const resource = Object.hasOwn(resources, options.palettes) ? resources[options.palettes] : void 0;
  if (!resource) {
    throw new Error(`Missing sprite palette catalogue: ${options.palettes}.`);
  }
  return parseSpritePaletteCatalog(resource.bytes);
}

// packages/assets/src/secret-of-mana/som-frame-atlas.ts
function rectangle(bounds, width, height, label) {
  if (!Array.isArray(bounds) || bounds.length !== 4 || bounds.some((v) => !Number.isSafeInteger(v)) || bounds[0] < 0 || bounds[1] < 0 || bounds[2] < 1 || bounds[3] < 1 || bounds[0] + bounds[2] > width || bounds[1] + bounds[3] > height) {
    throw new Error(`Invalid ${label} bounds.`);
  }
}
function isVersionOneLayout(value) {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  if (!("version" in value) || !("segments" in value) || !("width" in value) || !("height" in value)) {
    return false;
  }
  return value.version === 1 && Boolean(value.segments) && Number.isInteger(value.width) && Number.isInteger(value.height);
}
function isKnownTileSource(value) {
  return value === void 0 || value === "native-strip";
}
function isRgba8(color) {
  if (!Array.isArray(color) || color.length !== 4) {
    return false;
  }
  for (const channel of color) {
    if (typeof channel !== "number" || !Number.isInteger(channel) || channel < 0 || channel > 255) {
      return false;
    }
  }
  return true;
}
function isRecord4(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isIndexedSourceDepth(value) {
  return value === 1 || value === 2 || value === 4 || value === 8;
}
function isRgbaTuple2(value) {
  return Array.isArray(value) && value.length === 4 && value.every(
    (channel) => typeof channel === "number" && Number.isInteger(channel) && channel >= 0 && channel <= 255
  );
}
function readIndexedImage(value) {
  if (!isRecord4(value) || value.kind !== "indexed-image" || typeof value.width !== "number" || typeof value.height !== "number" || !(value.indexes instanceof Uint8Array) || !Array.isArray(value.palette) || !isIndexedSourceDepth(value.sourceBitDepth)) {
    throw new Error("Frame atlas must be an indexed PNG with the layout's exact dimensions.");
  }
  const palette = [];
  for (const color of value.palette) {
    if (!isRgbaTuple2(color)) {
      throw new Error("Frame atlas must be an indexed PNG with the layout's exact dimensions.");
    }
    const entry = [
      color[0],
      color[1],
      color[2],
      color[3]
    ];
    palette.push(entry);
  }
  return {
    kind: "indexed-image",
    width: value.width,
    height: value.height,
    indexes: value.indexes,
    palette,
    sourceBitDepth: value.sourceBitDepth
  };
}
function validateFrameLayout(layout2, { segmentName, whole = false } = {}) {
  if (!isVersionOneLayout(layout2)) {
    throw new Error("Frame atlas requires a version 1 layout with dimensions and segments.");
  }
  if (!Array.isArray(layout2.paletteRefs) || layout2.paletteRefs.length < 1 || layout2.paletteRefs.length > 15) {
    throw new Error("Frame atlas layout must reference one to fifteen ROM palettes.");
  }
  if (layout2.guideIndex !== layout2.paletteRefs.length * 16) {
    throw new Error("Frame atlas guide index must follow the source palette groups.");
  }
  if (layout2.indexPalette !== void 0 && (!Array.isArray(layout2.indexPalette) || layout2.indexPalette.length !== layout2.guideIndex || layout2.indexPalette.some((color) => !isRgba8(color)))) {
    throw new Error("Frame atlas indexPalette must bind every native slot to an RGBA8 color.");
  }
  for (const variant of layout2.paletteVariants ?? []) {
    if (!Number.isInteger(variant.group) || variant.group < 0 || variant.group >= layout2.paletteRefs.length) {
      throw new Error("Frame atlas palette variant refers to an invalid source group.");
    }
  }
  if (!isKnownTileSource(layout2.tileSources)) {
    throw new Error("Unknown atlas tile source mode.");
  }
  if (Array.isArray(layout2.frames)) {
    for (const frame of layout2.frames) {
      if (frame.paletteGroup !== void 0 && (!Number.isInteger(frame.paletteGroup) || frame.paletteGroup < 0 || frame.paletteGroup >= layout2.paletteRefs.length)) {
        throw new Error(`Frame ${frame.id} has an invalid display palette group.`);
      }
      if (Array.isArray(frame.blocks)) {
        for (const block of frame.blocks) {
          if (block.paletteGroup !== void 0 && (!Number.isInteger(block.paletteGroup) || block.paletteGroup < 0 || block.paletteGroup >= layout2.paletteRefs.length)) {
            throw new Error(`Block ${frame.id}/${block.id} has an invalid display palette group.`);
          }
        }
      }
    }
  }
  const names = whole ? Object.keys(layout2.segments) : [segmentName ?? ""];
  for (const name of names) {
    const segment = Object.hasOwn(layout2.segments, name) ? layout2.segments[name] : void 0;
    if (!segment || !Array.isArray(segment.tiles) || segment.tiles.length === 0) {
      throw new Error(`Unknown or empty frame atlas segment: ${name}.`);
    }
    if (!Number.isInteger(segment.palette) || segment.palette < 0 || segment.palette >= layout2.paletteRefs.length) {
      throw new Error(`Frame atlas segment ${name} has no source palette.`);
    }
    if (layout2.tileSources === "native-strip") {
      if (!segment.tileAtlas) {
        throw new Error(`Missing stable tile storage: ${name}.`);
      }
      rectangle(segment.tileAtlas.bounds, layout2.width, layout2.height, `${name} stable storage`);
    }
    for (const [index, tile] of segment.tiles.entries()) {
      if (layout2.tileSources === "native-strip") {
        const strip = segment.tileAtlas;
        if (!strip) {
          throw new Error(`Missing stable tile storage: ${name}.`);
        }
        if (tile.x !== strip.bounds[0] + index % strip.columns * strip.step || tile.y !== strip.bounds[1] + Math.floor(index / strip.columns) * strip.step || tile.flipX || tile.flipY) {
          throw new Error(`Stable tile source moved into pose geometry: ${name}/${index}.`);
        }
      }
      rectangle(
        [tile.x, tile.y, 8, 8],
        layout2.width,
        layout2.height,
        `source rectangle for ${name} tile ${index}`
      );
      if (tile.flipX !== void 0 && typeof tile.flipX !== "boolean" || tile.flipY !== void 0 && typeof tile.flipY !== "boolean") {
        throw new Error(`Invalid source rectangle flips for ${name} tile ${index}.`);
      }
    }
    if ((whole || layout2.tileSources === "native-strip") && segment.tileAtlas) {
      const strip = segment.tileAtlas;
      rectangle(strip.bounds, layout2.width, layout2.height, `${name} tile atlas`);
      if (!Number.isSafeInteger(strip.columns) || strip.columns < 1 || !Number.isSafeInteger(strip.step) || strip.step < 8 || !Array.isArray(strip.sourceOnly) || new Set(strip.sourceOnly).size !== strip.sourceOnly.length) {
        throw new Error(`Invalid tile atlas for ${name}.`);
      }
      for (const i of strip.sourceOnly) {
        if (!Number.isSafeInteger(i) || i < 0 || i >= segment.tiles.length) {
          throw new Error(`Invalid source-only tile ${name}:${i}.`);
        }
        const source = segment.tiles[i];
        if (source.x !== strip.bounds[0] + i % strip.columns * strip.step || source.y !== strip.bounds[1] + Math.floor(i / strip.columns) * strip.step || source.flipX || source.flipY) {
          throw new Error(`Source-only tile ${name}:${i} must use its native-order rectangle.`);
        }
      }
      if (Math.min(segment.tiles.length, strip.columns) * strip.step > strip.bounds[2] || Math.ceil(segment.tiles.length / strip.columns) * strip.step > strip.bounds[3]) {
        throw new Error(`Tile atlas ${name} is too small.`);
      }
    }
  }
  if (whole) {
    if (!Array.isArray(layout2.frames)) {
      throw new Error("Frame atlas frames must be an array.");
    }
    const ids = /* @__PURE__ */ new Set();
    const nativeRecords = /* @__PURE__ */ new Map();
    for (const frame of layout2.frames) {
      const validId = typeof frame.id === "string" && frame.id.length > 0 || Number.isSafeInteger(frame.id);
      if (!validId || ids.has(frame.id)) {
        throw new Error(`Duplicate/empty frame ${frame.id}.`);
      }
      ids.add(frame.id);
      rectangle(frame.bounds, layout2.width, layout2.height, `frame ${frame.id}`);
      validateFrameComposition(layout2, frame);
      const record = frame.nativeFrame;
      if (record?.bytes) {
        const previous = nativeRecords.get(record.address);
        if (previous && JSON.stringify(previous) !== JSON.stringify(record)) {
          throw new Error(`Shared native frame records disagree: ${frame.id}.`);
        }
        nativeRecords.set(record.address, record);
      }
    }
    const ordered = [...nativeRecords.values()].toSorted((a, b) => a.address - b.address);
    for (let i = 1; i < ordered.length; i++) {
      if (ordered[i].address < ordered[i - 1].end) {
        throw new Error("Overlapping native frame records.");
      }
    }
    if (layout2.tileSources === "native-strip") {
      const strips = Object.entries(layout2.segments).map(([name, segment]) => {
        if (!segment.tileAtlas) {
          throw new Error(`Missing stable tile storage: ${name}.`);
        }
        return {
          id: name,
          bounds: segment.tileAtlas.bounds
        };
      });
      for (const [index, strip] of strips.entries()) {
        const [x, y, width, height] = strip.bounds;
        for (const other of [...layout2.frames, ...strips.slice(index + 1)]) {
          const [ox, oy, ow, oh] = other.bounds;
          if (x < ox + ow && ox < x + width && y < oy + oh && oy < y + height) {
            throw new Error(`Stable storage overlaps ${other.id}: ${strip.id}.`);
          }
        }
      }
    }
  }
  return layout2;
}
function bindFrameAtlasPalette(source, layout2, catalog) {
  inspectFrameAtlas(source, layout2, catalog, { whole: true });
  if (layout2.indexPalette) {
    return { ...layout2, indexPalette: layout2.indexPalette.map((color) => [...color]) };
  }
  return {
    ...layout2,
    indexPalette: layout2.paletteRefs.flatMap((id2) => spritePaletteColors(catalog, id2))
  };
}
function inspectFrameAtlas(source, layout2, catalog, options = {}) {
  validateFrameLayout(layout2, options);
  let image = readIndexedImage(pngImporter.import(source).value);
  if (image.width !== layout2.width || image.height !== layout2.height) {
    throw new Error("Frame atlas must be an indexed PNG with the layout's exact dimensions.");
  }
  const colors = layout2.paletteRefs.flatMap((id2) => spritePaletteColors(catalog, id2));
  if (!image.palette[layout2.guideIndex]) {
    throw new Error("Frame atlas is missing its guide index.");
  }
  for (const variant of layout2.paletteVariants ?? []) {
    spritePaletteColors(catalog, variant.palette);
  }
  const matches = (expected) => expected.every(
    (color, index) => color.every((component, channel) => component === image.palette[index][channel])
  );
  if (!matches(colors) && (!layout2.indexPalette || !matches(layout2.indexPalette))) {
    throw new Error(
      "Frame atlas palette no longer matches its stable index binding. Restore the PNG palette order; edit shared colors in the palette catalog."
    );
  }
  image = { ...image, palette: [...colors, ...image.palette.slice(colors.length)] };
  const tiles = /* @__PURE__ */ new Map();
  const names = options.whole ? Object.keys(layout2.segments) : [options.segmentName ?? ""];
  for (const name of names) {
    const segment = Object.hasOwn(layout2.segments, name) ? layout2.segments[name] : void 0;
    if (!segment) {
      throw new Error(`Unknown or empty frame atlas segment: ${name}.`);
    }
    const indexMap = Array.from({ length: 256 }, () => null);
    for (let i = 0; i < 16; i++) {
      indexMap[segment.palette * 16 + i] = i;
    }
    indexMap[0] = 0;
    indexMap[layout2.guideIndex] = 0;
    tiles.set(
      name,
      segment.tiles.map((placement, index) => {
        try {
          return extractIndexedRegion(image, { ...placement, width: 8, height: 8, indexMap });
        } catch (cause) {
          const message = cause instanceof Error ? cause.message : String(cause);
          throw new Error(`Frame atlas ${name} tile ${index}: ${message}`, { cause });
        }
      })
    );
  }
  return { image, layout: layout2, tiles };
}
function encodeInspectedFrameSegment(inspected, segmentName) {
  const tiles = inspected.tiles.get(segmentName);
  if (!tiles) {
    throw new Error(`Segment ${segmentName} was not inspected.`);
  }
  return encodePlanarTiles(
    tiles.map(
      (tile) => Array.from({ length: 8 }, (_, y) => Array.from(tile.indexes.subarray(y * 8, y * 8 + 8)))
    ),
    4
  );
}
function readFrameAtlasSelection(options) {
  if (options.segment !== void 0 && options.segments !== void 0) {
    throw new Error("Specify segment or segments, not both.");
  }
  if (options.segment !== void 0) {
    if (typeof options.segment !== "string") {
      throw new Error("Frame atlas segment must be a string.");
    }
    return options.segment;
  }
  if (options.segments !== void 0) {
    if (!Array.isArray(options.segments) || options.segments.some((name) => typeof name !== "string")) {
      throw new Error("Frame atlas segments must be an array of strings.");
    }
    return options.segments.map((name) => {
      if (typeof name !== "string") {
        throw new Error("Invalid frame atlas segment.");
      }
      return name;
    });
  }
  return void 0;
}
function frameAtlasSegmentOrder(layout2, selection) {
  const names = selection ?? Object.keys(layout2.segments);
  if (!names.length || new Set(names).size !== names.length) {
    throw new Error("Frame atlas selection must contain unique, nonempty segments.");
  }
  const spans = names.map((name) => {
    const segment = Object.hasOwn(layout2.segments, name) ? layout2.segments[name] : void 0;
    if (!segment || !/^[\da-f]{6}$/i.test(segment.romAddress) || !Array.isArray(segment.tiles) || !segment.tiles.length) {
      throw new Error(`Invalid native frame atlas span: ${name}.`);
    }
    const start = Number.parseInt(segment.romAddress, 16);
    const end = start + segment.tiles.length * 32;
    if (end > 16777216) {
      throw new Error(`Native frame atlas span exceeds the 24-bit address space: ${name}.`);
    }
    return { name, start, end };
  }).toSorted((a, b) => a.start - b.start);
  for (let index = 1; index < spans.length; index++) {
    if (spans[index].start !== spans[index - 1].end) {
      throw new Error("Selected frame atlas segments must be contiguous without gaps or overlaps.");
    }
  }
  return spans.map((span) => span.name);
}
function encodeInspectedFrameSegments(inspected, selection) {
  const chunks = frameAtlasSegmentOrder(inspected.layout, selection).map(
    (name) => encodeInspectedFrameSegment(inspected, name)
  );
  const bytes = new Uint8Array(chunks.reduce((size, chunk2) => size + chunk2.length, 0));
  let offset = 0;
  for (const chunk2 of chunks) {
    bytes.set(chunk2, offset);
    offset += chunk2.length;
  }
  return bytes;
}
function encodeFrameAtlas(source, layout2, segmentName, catalog) {
  if (typeof segmentName !== "string") {
    return encodeInspectedFrameSegments(
      inspectFrameAtlas(source, layout2, catalog, { whole: true }),
      segmentName
    );
  }
  return encodeInspectedFrameSegment(
    inspectFrameAtlas(source, layout2, catalog, { segmentName }),
    segmentName
  );
}
function readFrameLayout(options, resources) {
  if (typeof options.layout !== "string" || !options.layout.endsWith(".json")) {
    throw new Error("Frame atlas layout must name a JSON sidecar.");
  }
  const resource = Object.hasOwn(resources, options.layout) ? resources[options.layout] : void 0;
  if (!resource) {
    throw new Error(`Missing frame atlas layout: ${options.layout}.`);
  }
  let parsed;
  try {
    parsed = JSON.parse(new TextDecoder().decode(resource.bytes));
  } catch (error) {
    throw new Error(`Invalid frame atlas layout: ${options.layout}.`, { cause: error });
  }
  if (!isVersionOneLayout(parsed)) {
    throw new Error("Frame atlas requires a version 1 layout with dimensions and segments.");
  }
  return parsed;
}

// packages/assets/src/secret-of-mana/som-room-composition.ts
var LIMITATION = "Background geometry only; omits actors, BG3, camera, mutable clones and color math.";
function somRoomPaletteColor(word, transparent) {
  integer(word, "Room palette word", 0, 65535);
  if (transparent) {
    return [0, 0, 0, 0];
  }
  return [
    Math.floor((word & 31) * 255 / 31),
    Math.floor((word >>> 5 & 31) * 255 / 31),
    Math.floor((word >>> 10 & 31) * 255 / 31),
    255
  ];
}
function physicalGraphics(graphics, mask) {
  if (typeof graphics !== "string" || !graphics.length || graphics.length > 32768 * 2 || graphics.length % 64 || !/^[\da-f]+$/i.test(graphics)) {
    throw new Error("Invalid or oversized planar room graphics.");
  }
  if (typeof mask !== "string" || mask.length !== graphics.length || !/^(?:00|01)+$/.test(mask)) {
    throw new Error("Preview graphics require a matching physical-coverage mask.");
  }
  const bytes = new Uint8Array(graphics.length / 2), known = new Uint8Array(bytes.length);
  for (let offset = 0; offset < bytes.length; offset++) {
    bytes[offset] = Number.parseInt(graphics.slice(offset * 2, offset * 2 + 2), 16);
    known[offset] = mask.charCodeAt(offset * 2 + 1) - 48;
  }
  return { bytes, known };
}
function composeSomRoom(room, preview, story) {
  if (room.format !== "som.room" || room.version !== 1 || preview.format !== "som.room.preview" || preview.version !== 1) {
    throw new Error("Unsupported room composition inputs.");
  }
  if (!Array.isArray(room.header) || room.header.length !== 8) {
    throw new Error("Room header requires eight bytes.");
  }
  room.header.forEach((value) => integer(value, "Room header byte", 0, 255));
  integer(room.pieces.length, "Room piece count", 0, 65536);
  const key = `${room.header[0] & 63}:${room.header[2]}:${room.header[1] & 127}`;
  if (!Object.hasOwn(preview.tilesets, key)) {
    throw new Error(`Preview resources do not contain tileset ${key}.`);
  }
  const assets = preview.tilesets[key], states = { ...room.previewStory, ...story }, pieces = [];
  let columns = 0, rows2 = 0, placementWork = 0;
  for (const [sourceIndex, piece] of room.pieces.entries()) {
    integer(piece.variable, "Story variable", 0, 255);
    integer(piece.minimum, "Story minimum", 0, 15);
    integer(piece.maximum, "Story maximum", piece.minimum, 15);
    const value = integer(states[piece.variable], `Preview story ${piece.variable}`, 0, 255);
    if (value < piece.minimum || value > piece.maximum) {
      continue;
    }
    integer(piece.x, "Piece x", 0, 127);
    integer(piece.y, "Piece y", 0, 127);
    integer(piece.layer, "Piece layer", 1, 2);
    integer(piece.layout, "Layout id", 1, 1023);
    const layout2 = Object.hasOwn(preview.layouts, piece.layout) ? preview.layouts[piece.layout] : void 0;
    if (!layout2) {
      throw new Error("Missing or incomplete layout preview.");
    }
    integer(layout2.width, "Layout width", 1, 128);
    integer(layout2.height, "Layout height", 1, 128);
    const area = layout2.width * layout2.height;
    if (!Array.isArray(layout2.tiles) || layout2.tiles.length !== area) {
      throw new Error("Missing or incomplete layout preview.");
    }
    columns = Math.max(columns, piece.x + layout2.width);
    rows2 = Math.max(rows2, piece.y + layout2.height);
    if (columns > 128 || rows2 > 128) {
      throw new Error("Room pieces exceed the native 128-tile layer bounds.");
    }
    placementWork = boundedSum(
      placementWork,
      area * 256,
      ASSET_LIMITS.renderPixels,
      "Room placement work"
    );
    layout2.tiles.forEach((tile) => integer(tile, "Static metatile id", 0, 191));
    pieces.push({ ...piece, sourceIndex, width: layout2.width, height: layout2.height });
  }
  if (!pieces.length) {
    throw new Error("No active room pieces in this preview state.");
  }
  const width = columns * 16, height = rows2 * 16;
  rasterArea(width, height, "Room composition", ASSET_LIMITS.interchangeSide);
  const maps = [
    new Int16Array(columns * rows2).fill(-1),
    new Int16Array(columns * rows2).fill(-1)
  ];
  for (const piece of pieces) {
    const layout2 = preview.layouts[piece.layout], map = maps[piece.layer - 1];
    for (let y = 0; y < piece.height; y++) {
      map.set(
        layout2.tiles.slice(y * piece.width, (y + 1) * piece.width),
        (piece.y + y) * columns + piece.x
      );
    }
  }
  const { bytes: graphics, known: graphicsKnown } = physicalGraphics(
    assets.graphics,
    assets.graphicsKnown
  );
  if (!Array.isArray(assets.colors) || assets.colors.length !== 128 || !Array.isArray(assets.layerWords) || assets.layerWords.length !== 2) {
    throw new Error("Incomplete palette/metatile preview.");
  }
  const paletteWords = Uint16Array.from(
    assets.colors,
    (word) => integer(word, "Palette word", 0, 65535)
  ), palette = Array.from(
    paletteWords,
    (word, index) => somRoomPaletteColor(word, index % 16 === 0)
  );
  for (const words of assets.layerWords) {
    if (!Array.isArray(words) || words.length !== 768) {
      throw new Error("Incomplete metatile preview.");
    }
    words.forEach((word) => integer(word, "Metatile word", 0, 65535));
  }
  const tiles = decodePlanarTiles(graphics, 4).map((tile) => Uint8Array.from(tile.flat())), passOrder = [
    [2, 0],
    [1, 0],
    [2, 1],
    [1, 1]
  ];
  const passes = passOrder.map(([layer, priority]) => {
    const cells = [], map = maps[layer - 1], words = assets.layerWords[layer - 1];
    for (let position = 0; position < map.length; position++) {
      const metatile = map[position];
      if (metatile < 0) {
        continue;
      }
      for (let quadrant = 0; quadrant < 4; quadrant++) {
        const word = words[metatile * 4 + quadrant];
        if ((word >>> 13 & 1) !== priority) {
          continue;
        }
        const tile = word & 1023, offset = tile * 32;
        if (offset + 32 > graphics.length) {
          throw new Error("Preview references uncaptured graphics.");
        }
        if (!graphicsKnown.subarray(offset, offset + 32).every((byte) => byte === 1)) {
          throw new Error("Preview references unknown physical graphics bytes.");
        }
        cells.push({
          x: position % columns * 16 + quadrant % 2 * 8,
          y: Math.floor(position / columns) * 16 + (quadrant >>> 1) * 8,
          metatile,
          word,
          tile,
          palette: word >>> 10 & 7,
          flipX: !!(word & 16384),
          flipY: !!(word & 32768)
        });
      }
    }
    return { layer, priority, cells };
  });
  return {
    width,
    height,
    tileset: key,
    activePieces: pieces,
    metatiles: maps,
    passes,
    graphics,
    graphicsKnown,
    tiles,
    paletteWords,
    palette,
    provenance: structuredClone(preview.provenance),
    limitation: LIMITATION
  };
}
function renderSomRoomComposition(composition, layer) {
  if (layer !== void 0) {
    integer(layer, "Room render layer", 1, 2);
  }
  const area = rasterArea(
    composition.width,
    composition.height,
    "Room render",
    ASSET_LIMITS.interchangeSide
  );
  let work = 0;
  integer(composition.passes.length, "Room passes", 1, 4);
  integer(composition.tiles.length, "Room tiles", 1, 1024);
  if (composition.palette.length !== 128) {
    throw new Error("Incomplete room render palette.");
  }
  for (const tile of composition.tiles) {
    if (!(tile instanceof Uint8Array) || tile.length !== 64 || tile.some((slot) => slot > 15)) {
      throw new Error("Invalid room render tile.");
    }
  }
  for (const pass of composition.passes) {
    integer(pass.layer, "Room pass layer", 1, 2);
    integer(pass.priority, "Room pass priority", 0, 1);
    if (layer !== void 0 && pass.layer !== layer) {
      continue;
    }
    work = boundedSum(
      work,
      pass.cells.length * 64,
      ASSET_LIMITS.renderPixels,
      "Room rendering work"
    );
    for (const cell of pass.cells) {
      integer(cell.x, "Room cell x", 0, composition.width - 8);
      integer(cell.y, "Room cell y", 0, composition.height - 8);
      integer(cell.tile, "Room cell tile", 0, composition.tiles.length - 1);
      integer(cell.palette, "Room cell palette", 0, 7);
    }
  }
  const rgba = new Uint8Array(
    boundedProduct(area, 4, ASSET_LIMITS.decodedBytes, "Room RGBA bytes")
  );
  for (let pixel = 0; pixel < rgba.length; pixel += 4) {
    rgba.set([10, 14, 22, 255], pixel);
  }
  for (const pass of composition.passes) {
    if (layer !== void 0 && pass.layer !== layer) {
      continue;
    }
    for (const cell of pass.cells) {
      const tile = composition.tiles[cell.tile];
      for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
          const sourceX = cell.flipX ? 7 - x : x, sourceY = cell.flipY ? 7 - y : y, slot = tile[sourceY * 8 + sourceX];
          if (slot === 0) {
            continue;
          }
          const at = ((cell.y + y) * composition.width + cell.x + x) * 4;
          rgba.set(composition.palette[cell.palette * 16 + slot], at);
        }
      }
    }
  }
  return { rgba, width: composition.width, height: composition.height };
}

// packages/assets/src/secret-of-mana/som-room-assets.ts
function isRecord5(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isRoomEntity(value) {
  return isRecord5(value);
}
function isRoomPiece(value) {
  return isRecord5(value);
}
function isRoomPreview(value) {
  return isRecord5(value) && value.format === "som.room.preview" && value.version === 1 && isRecord5(value.tilesets) && isRecord5(value.layouts);
}
function isRoomAsset(value) {
  return isRecord5(value) && Array.isArray(value.entities) && value.entities.every(isRoomEntity) && Array.isArray(value.pieces) && value.pieces.every(isRoomPiece) && Array.isArray(value.triggers) && value.triggers.every((item) => typeof item === "number");
}
function integer2(value, maximum, name) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > maximum) {
    fail(`${name} must be 0..${maximum}.`);
  }
  return value;
}
function parseRoomAsset(source) {
  equal(source.mediaType, "application/json", "Room source must be JSON.");
  const parsed = JSON.parse(new TextDecoder().decode(source.bytes));
  if (!isRecord5(parsed)) {
    fail("Room source must be a JSON object.");
  }
  equal(parsed.format, "som.room");
  equal(parsed.version, 1);
  integer2(parsed.id, 510, "room id");
  invariant(
    Array.isArray(parsed.header) && parsed.header.length === 8,
    "Room header requires eight bytes."
  );
  for (const byte of parsed.header) {
    integer2(byte, 255, "header byte");
  }
  for (const key of ["entities", "pieces", "triggers"]) {
    invariant(Array.isArray(parsed[key]), `Missing room ${key}.`);
  }
  if (!isRoomAsset(parsed)) {
    fail("Room entities, pieces, and triggers must match the room record.");
  }
  return parsed;
}
function parseRoomPreview(bytes) {
  const parsed = JSON.parse(new TextDecoder().decode(bytes));
  if (!isRecord5(parsed)) {
    fail("Room preview resource must be a JSON object.");
  }
  equal(parsed.format, "som.room.preview");
  equal(parsed.version, 1);
  if (!isRoomPreview(parsed)) {
    fail("Room preview resource must include tileset and layout records.");
  }
  return parsed;
}
function condition(record) {
  const variable = integer2(record.variable, 255, "story variable");
  const minimum = integer2(record.minimum, 15, "story minimum"), maximum = integer2(record.maximum, 15, "story maximum");
  invariant(minimum <= maximum, "Story range is reversed.");
  return [variable, minimum << 4 | maximum];
}
function encodeRoomSection(room, section) {
  invariant(
    ["objects", "assembly", "triggers"].includes(section),
    "Room section must be objects, assembly or triggers."
  );
  const bytes = [];
  if (section === "objects") {
    bytes.push(...room.header);
    for (const entity of room.entities) {
      const flags = integer2(entity.flags, 255, "entity flags");
      equal(flags & 63, 0, "Only packed entity flags 40/80 are defined.");
      const event = integer2(entity.event, 4095, "entity event");
      bytes.push(
        ...condition(entity),
        integer2(entity.x, 127, "entity x") | (flags & 64) << 1,
        integer2(entity.y, 127, "entity y") | flags & 128,
        integer2(entity.orientationAndLayer, 255, "orientation/layer byte"),
        integer2(entity.entity, 255, "entity id"),
        event & 255,
        integer2(entity.interaction, 15, "interaction flags") << 4 | event >>> 8
      );
    }
  } else if (section === "assembly") {
    let layer = 1;
    for (const piece of room.pieces) {
      if (piece.marker !== void 0) {
        invariant(piece.marker === 254 || piece.marker === 255, "Layer marker must be FE or FF.");
        bytes.push(piece.marker);
        layer = piece.marker - 253;
      }
      equal(piece.layer, layer, "A layer change requires an explicit marker.");
      const predicate = condition(piece);
      invariant(predicate[0] < 254, "FE/FF are layer markers, not piece story indexes.");
      const layout2 = integer2(piece.layout, 1023, "layout id");
      invariant(layout2 > 0, "Native layout IDs are one-based.");
      bytes.push(
        ...predicate,
        layout2 & 255,
        integer2(piece.x, 127, "piece x") << 1 | layout2 >>> 8 & 1,
        integer2(piece.y, 127, "piece y") << 1 | layout2 >>> 9 & 1
      );
    }
  } else {
    for (const trigger of room.triggers) {
      integer2(trigger, 65535, "packed trigger word");
      bytes.push(trigger & 255, trigger >>> 8);
    }
  }
  const owner = room.sections?.[section];
  invariant(
    owner && Number.isInteger(owner.address) && Number.isInteger(owner.bytes),
    "Missing fixed section ownership."
  );
  equal(
    bytes.length,
    owner.bytes,
    "Room edit changes its fixed ROM extent; relocation is required."
  );
  return Uint8Array.from(bytes);
}
function convertRoomAsset(source, options) {
  const room = parseRoomAsset(source);
  const outputs = {};
  for (const section of ["objects", "assembly", "triggers"]) {
    outputs[section] = { bytes: encodeRoomSection(room, section) };
  }
  const selected = options.section;
  invariant(
    typeof selected === "string" && Object.hasOwn(outputs, selected),
    "Select a room section."
  );
  return { primaryOutput: selected, outputs };
}
function renderRoomAsset(room, preview, { layer, story } = {}) {
  if (layer !== void 0 && layer !== 1 && layer !== 2) {
    throw new Error("Preview layer must be 1 or 2.");
  }
  const composition = composeSomRoom(room, preview, story);
  return {
    ...renderSomRoomComposition(composition, layer),
    tileset: composition.tileset,
    activePieces: composition.activePieces.map((piece) => piece.layout),
    limitation: composition.limitation
  };
}

// packages/assets/src/atlas-interchange.ts
var ATLAS_FILE_LIMIT = ASSET_LIMITS.asepriteBytes;
function validateAtlasDocument(document2) {
  validateIndexedPixels(document2);
  rasterArea(document2.width, document2.height, "Atlas", ASSET_LIMITS.interchangeSide);
  indexedPalette(document2.palette);
  integer(document2.transparentIndex, "Atlas transparent slot", 0, document2.palette.length - 1);
  if (document2.indexes.some((index) => index >= document2.palette.length)) {
    throw new Error("Atlas pixel references a missing palette slot.");
  }
  if (document2.exportId !== void 0 && !/^[\da-f-]{36}$/.test(document2.exportId)) {
    throw new Error("Invalid atlas export identity.");
  }
}
function indexedAtlasDocument(value, transparentIndex) {
  if (!value || typeof value !== "object" || !("kind" in value) || value.kind !== "indexed-image") {
    throw new Error("Atlas interchange requires indexed artwork; RGB mapping is not supported.");
  }
  if (!("width" in value) || typeof value.width !== "number" || !("height" in value) || typeof value.height !== "number" || !("indexes" in value) || !(value.indexes instanceof Uint8Array) || !("palette" in value) || !Array.isArray(value.palette)) {
    throw new Error("Invalid indexed atlas value.");
  }
  const palette = indexedPalette(value.palette);
  const document2 = {
    width: value.width,
    height: value.height,
    indexes: Uint8Array.from(value.indexes),
    palette,
    transparentIndex
  };
  validateAtlasDocument(document2);
  return document2;
}
function inspectAtlasChanges(before, after, policy) {
  validateAtlasDocument(before);
  validateAtlasDocument(after);
  if (before.width !== after.width || before.height !== after.height || before.transparentIndex !== after.transparentIndex || before.palette.length !== after.palette.length) {
    throw new Error("Atlas canvas, transparency or palette inventory changed.");
  }
  if (before.exportId !== void 0 && after.exportId !== void 0 && before.exportId !== after.exportId) {
    throw new Error("Atlas document belongs to a different export.");
  }
  const colors = indexedPaletteChanges(before.palette, after.palette, policy.editablePaletteSlots);
  const claimed = new Uint8Array(before.indexes.length);
  const ids = /* @__PURE__ */ new Set();
  const pixels = [];
  for (const owner of policy.owners) {
    if (!owner.id || ids.has(owner.id)) {
      throw new Error("Missing or duplicate atlas owner.");
    }
    ids.add(owner.id);
    const oldPixels = extractIndexedRegion(before, owner);
    const newPixels = extractIndexedRegion(after, owner);
    for (let y = owner.y; y < owner.y + owner.height; y++) {
      for (let x = owner.x; x < owner.x + owner.width; x++) {
        const offset = y * before.width + x;
        if (claimed[offset]) {
          throw new Error("Overlapping atlas pixel authorities require reconciliation.");
        }
        if (before.indexes[offset] !== after.indexes[offset] && owner.indexMap && owner.indexMap[before.indexes[offset]] === owner.indexMap[after.indexes[offset]]) {
          throw new Error("Changed atlas slot aliases require an explicit canonical mapping.");
        }
        claimed[offset] = 1;
      }
    }
    if (newPixels.indexes.some((index, i) => index !== oldPixels.indexes[i])) {
      pixels.push({ owner: owner.id, indexes: newPixels.indexes });
    }
  }
  if (after.indexes.some((index, i) => index !== before.indexes[i] && !claimed[i])) {
    throw new Error("Atlas padding or derived preview pixels changed.");
  }
  return { pixels, colors };
}

// packages/assets/node_modules/pako/dist/pako.mjs
var Z_FIXED2 = 4;
var Z_BINARY2 = 0;
var Z_TEXT2 = 1;
var Z_UNKNOWN2 = 2;
function zero$12(buf) {
  let len = buf.length;
  while (--len >= 0) buf[len] = 0;
}
var STORED_BLOCK2 = 0;
var STATIC_TREES2 = 1;
var DYN_TREES2 = 2;
var LENGTH_CODES2 = 29;
var LITERALS2 = 256;
var L_CODES2 = 286;
var D_CODES2 = 30;
var BL_CODES2 = 19;
var HEAP_SIZE$12 = 573;
var MAX_BITS2 = 15;
var Buf_size2 = 16;
var END_BLOCK2 = 256;
var REP_3_62 = 16;
var REPZ_3_102 = 17;
var REPZ_11_1382 = 18;
var extra_lbits2 = new Uint8Array([
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
var extra_dbits2 = new Uint8Array([
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
var extra_blbits2 = new Uint8Array([
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
var bl_order2 = new Uint8Array([
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
var DIST_CODE_LEN2 = 512;
var static_ltree2 = new Array(288 * 2);
zero$12(static_ltree2);
var static_dtree2 = new Array(D_CODES2 * 2);
zero$12(static_dtree2);
var _dist_code2 = new Array(DIST_CODE_LEN2);
zero$12(_dist_code2);
var _length_code2 = new Array(256);
zero$12(_length_code2);
var base_length2 = new Array(LENGTH_CODES2);
zero$12(base_length2);
var base_dist2 = new Array(D_CODES2);
zero$12(base_dist2);
var d_code2 = (dist) => {
  return dist < 256 ? _dist_code2[dist] : _dist_code2[256 + (dist >>> 7)];
};
var put_short2 = (s, w) => {
  s.pending_buf[s.pending++] = w & 255;
  s.pending_buf[s.pending++] = w >>> 8 & 255;
};
var send_bits2 = (s, value, length) => {
  if (s.bi_valid > Buf_size2 - length) {
    s.bi_buf |= value << s.bi_valid & 65535;
    put_short2(s, s.bi_buf);
    s.bi_buf = value >> Buf_size2 - s.bi_valid;
    s.bi_valid += length - Buf_size2;
  } else {
    s.bi_buf |= value << s.bi_valid & 65535;
    s.bi_valid += length;
  }
};
var send_code2 = (s, c, tree) => {
  send_bits2(s, tree[c * 2], tree[c * 2 + 1]);
};
var bi_reverse2 = (code, len) => {
  let res = 0;
  do {
    res |= code & 1;
    code >>>= 1;
    res <<= 1;
  } while (--len > 0);
  return res >>> 1;
};
var gen_bitlen2 = (s, desc) => {
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
  for (bits = 0; bits <= MAX_BITS2; bits++) s.bl_count[bits] = 0;
  tree[s.heap[s.heap_max] * 2 + 1] = 0;
  for (h = s.heap_max + 1; h < HEAP_SIZE$12; h++) {
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
var gen_codes2 = (tree, max_code, bl_count) => {
  const next_code = new Array(16);
  let code = 0;
  let bits;
  let n;
  for (bits = 1; bits <= MAX_BITS2; bits++) {
    code = code + bl_count[bits - 1] << 1;
    next_code[bits] = code;
  }
  for (n = 0; n <= max_code; n++) {
    let len = tree[n * 2 + 1];
    if (len === 0) continue;
    tree[n * 2] = bi_reverse2(next_code[len]++, len);
  }
};
var init_block2 = (s) => {
  let n;
  for (n = 0; n < L_CODES2; n++) s.dyn_ltree[n * 2] = 0;
  for (n = 0; n < D_CODES2; n++) s.dyn_dtree[n * 2] = 0;
  for (n = 0; n < BL_CODES2; n++) s.bl_tree[n * 2] = 0;
  s.dyn_ltree[END_BLOCK2 * 2] = 1;
  s.opt_len = s.static_len = 0;
  s.sym_next = s.matches = 0;
};
var bi_windup2 = (s) => {
  if (s.bi_valid > 8) put_short2(s, s.bi_buf);
  else if (s.bi_valid > 0) s.pending_buf[s.pending++] = s.bi_buf;
  s.bi_buf = 0;
  s.bi_valid = 0;
};
var smaller2 = (tree, n, m, depth) => {
  const _n2 = n * 2;
  const _m2 = m * 2;
  return tree[_n2] < tree[_m2] || tree[_n2] === tree[_m2] && depth[n] <= depth[m];
};
var pqdownheap2 = (s, tree, k) => {
  const v = s.heap[k];
  let j = k << 1;
  while (j <= s.heap_len) {
    if (j < s.heap_len && smaller2(tree, s.heap[j + 1], s.heap[j], s.depth)) j++;
    if (smaller2(tree, v, s.heap[j], s.depth)) break;
    s.heap[k] = s.heap[j];
    k = j;
    j <<= 1;
  }
  s.heap[k] = v;
};
var compress_block2 = (s, ltree, dtree) => {
  let dist;
  let lc;
  let sx = 0;
  let code;
  let extra;
  if (s.sym_next !== 0) do {
    dist = s.pending_buf[s.sym_buf + sx++] & 255;
    dist += (s.pending_buf[s.sym_buf + sx++] & 255) << 8;
    lc = s.pending_buf[s.sym_buf + sx++];
    if (dist === 0) send_code2(s, lc, ltree);
    else {
      code = _length_code2[lc];
      send_code2(s, code + LITERALS2 + 1, ltree);
      extra = extra_lbits2[code];
      if (extra !== 0) {
        lc -= base_length2[code];
        send_bits2(s, lc, extra);
      }
      dist--;
      code = d_code2(dist);
      send_code2(s, code, dtree);
      extra = extra_dbits2[code];
      if (extra !== 0) {
        dist -= base_dist2[code];
        send_bits2(s, dist, extra);
      }
    }
  } while (sx < s.sym_next);
  send_code2(s, END_BLOCK2, ltree);
};
var build_tree2 = (s, desc) => {
  const tree = desc.dyn_tree;
  const stree = desc.stat_desc.static_tree;
  const has_stree = desc.stat_desc.has_stree;
  const elems = desc.stat_desc.elems;
  let n, m;
  let max_code = -1;
  let node;
  s.heap_len = 0;
  s.heap_max = HEAP_SIZE$12;
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
  for (n = s.heap_len >> 1; n >= 1; n--) pqdownheap2(s, tree, n);
  node = elems;
  do {
    n = s.heap[1];
    s.heap[1] = s.heap[s.heap_len--];
    pqdownheap2(s, tree, 1);
    m = s.heap[1];
    s.heap[--s.heap_max] = n;
    s.heap[--s.heap_max] = m;
    tree[node * 2] = tree[n * 2] + tree[m * 2];
    s.depth[node] = (s.depth[n] >= s.depth[m] ? s.depth[n] : s.depth[m]) + 1;
    tree[n * 2 + 1] = tree[m * 2 + 1] = node;
    s.heap[1] = node++;
    pqdownheap2(s, tree, 1);
  } while (s.heap_len >= 2);
  s.heap[--s.heap_max] = s.heap[1];
  gen_bitlen2(s, desc);
  gen_codes2(tree, max_code, s.bl_count);
};
var scan_tree2 = (s, tree, max_code) => {
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
      s.bl_tree[REP_3_62 * 2]++;
    } else if (count <= 10) s.bl_tree[REPZ_3_102 * 2]++;
    else s.bl_tree[REPZ_11_1382 * 2]++;
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
var send_tree2 = (s, tree, max_code) => {
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
      send_code2(s, curlen, s.bl_tree);
    while (--count !== 0);
    else if (curlen !== 0) {
      if (curlen !== prevlen) {
        send_code2(s, curlen, s.bl_tree);
        count--;
      }
      send_code2(s, REP_3_62, s.bl_tree);
      send_bits2(s, count - 3, 2);
    } else if (count <= 10) {
      send_code2(s, REPZ_3_102, s.bl_tree);
      send_bits2(s, count - 3, 3);
    } else {
      send_code2(s, REPZ_11_1382, s.bl_tree);
      send_bits2(s, count - 11, 7);
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
var build_bl_tree2 = (s) => {
  let max_blindex;
  scan_tree2(s, s.dyn_ltree, s.l_desc.max_code);
  scan_tree2(s, s.dyn_dtree, s.d_desc.max_code);
  build_tree2(s, s.bl_desc);
  for (max_blindex = BL_CODES2 - 1; max_blindex >= 3; max_blindex--) if (s.bl_tree[bl_order2[max_blindex] * 2 + 1] !== 0) break;
  s.opt_len += 3 * (max_blindex + 1) + 5 + 5 + 4;
  return max_blindex;
};
var send_all_trees2 = (s, lcodes, dcodes, blcodes) => {
  let rank2;
  send_bits2(s, lcodes - 257, 5);
  send_bits2(s, dcodes - 1, 5);
  send_bits2(s, blcodes - 4, 4);
  for (rank2 = 0; rank2 < blcodes; rank2++) send_bits2(s, s.bl_tree[bl_order2[rank2] * 2 + 1], 3);
  send_tree2(s, s.dyn_ltree, lcodes - 1);
  send_tree2(s, s.dyn_dtree, dcodes - 1);
};
var detect_data_type2 = (s) => {
  let block_mask = 4093624447;
  let n;
  for (n = 0; n <= 31; n++, block_mask >>>= 1) if (block_mask & 1 && s.dyn_ltree[n * 2] !== 0) return Z_BINARY2;
  if (s.dyn_ltree[18] !== 0 || s.dyn_ltree[20] !== 0 || s.dyn_ltree[26] !== 0) return Z_TEXT2;
  for (n = 32; n < LITERALS2; n++) if (s.dyn_ltree[n * 2] !== 0) return Z_TEXT2;
  return Z_BINARY2;
};
var _tr_stored_block2 = (s, buf, stored_len, last) => {
  send_bits2(s, (STORED_BLOCK2 << 1) + (last ? 1 : 0), 3);
  bi_windup2(s);
  put_short2(s, stored_len);
  put_short2(s, ~stored_len);
  if (stored_len) s.pending_buf.set(s.window.subarray(buf, buf + stored_len), s.pending);
  s.pending += stored_len;
};
var _tr_flush_block2 = (s, buf, stored_len, last) => {
  let opt_lenb, static_lenb;
  let max_blindex = 0;
  if (s.level > 0) {
    if (s.strm.data_type === Z_UNKNOWN2) s.strm.data_type = detect_data_type2(s);
    build_tree2(s, s.l_desc);
    build_tree2(s, s.d_desc);
    max_blindex = build_bl_tree2(s);
    opt_lenb = s.opt_len + 3 + 7 >>> 3;
    static_lenb = s.static_len + 3 + 7 >>> 3;
    if (static_lenb <= opt_lenb || s.strategy === Z_FIXED2) opt_lenb = static_lenb;
  } else opt_lenb = static_lenb = stored_len + 5;
  if (stored_len + 4 <= opt_lenb && buf !== -1) _tr_stored_block2(s, buf, stored_len, last);
  else if (s.strategy === Z_FIXED2 || static_lenb === opt_lenb) {
    send_bits2(s, (STATIC_TREES2 << 1) + (last ? 1 : 0), 3);
    compress_block2(s, static_ltree2, static_dtree2);
  } else {
    send_bits2(s, (DYN_TREES2 << 1) + (last ? 1 : 0), 3);
    send_all_trees2(s, s.l_desc.max_code + 1, s.d_desc.max_code + 1, max_blindex + 1);
    compress_block2(s, s.dyn_ltree, s.dyn_dtree);
  }
  init_block2(s);
  if (last) bi_windup2(s);
};
var _tr_tally2 = (s, dist, lc) => {
  s.pending_buf[s.sym_buf + s.sym_next++] = dist;
  s.pending_buf[s.sym_buf + s.sym_next++] = dist >> 8;
  s.pending_buf[s.sym_buf + s.sym_next++] = lc;
  if (dist === 0) s.dyn_ltree[lc * 2]++;
  else {
    s.matches++;
    dist--;
    s.dyn_ltree[(_length_code2[lc] + LITERALS2 + 1) * 2]++;
    s.dyn_dtree[d_code2(dist) * 2]++;
  }
  return s.sym_next === s.sym_end;
};
var adler322 = (adler, buf, len, pos) => {
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
var makeTable2 = () => {
  let c, table = [];
  for (var n = 0; n < 256; n++) {
    c = n;
    for (var k = 0; k < 8; k++) c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
    table[n] = c;
  }
  return table;
};
var crcTable2 = new Uint32Array(makeTable2());
var crc322 = (crc, buf, len, pos) => {
  const t = crcTable2;
  const end = pos + len;
  crc ^= -1;
  for (let i = pos; i < end; i++) crc = crc >>> 8 ^ t[(crc ^ buf[i]) & 255];
  return crc ^ -1;
};
var messages_default2 = {
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
var MIN_MATCH2 = 3;
var MAX_MATCH2 = 258;
var MIN_LOOKAHEAD2 = 262;
var BS_NEED_MORE2 = 1;
var BS_BLOCK_DONE2 = 2;
var BS_FINISH_STARTED2 = 3;
var BS_FINISH_DONE2 = 4;
var slide_hash2 = (s) => {
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
var HASH2 = (s, prev, data) => (prev << s.hash_shift ^ data) & s.hash_mask;
var INSERT_STRING2 = (s, str) => {
  let h;
  if (s.legacy_hash) h = s.ins_h = HASH2(s, s.ins_h, s.window[str + MIN_MATCH2 - 1]);
  else {
    const w = s.window;
    const value = w[str] | w[str + 1] << 8 | w[str + 2] << 16 | w[str + 3] << 24;
    h = s.ins_h = Math.imul(value, 66521) + 66521 >>> 16 & s.hash_mask;
  }
  const hash_head = s.prev[str & s.w_mask] = s.head[h];
  s.head[h] = str;
  return hash_head;
};
var flush_pending2 = (strm) => {
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
var flush_block_only2 = (s, last) => {
  _tr_flush_block2(s, s.block_start >= 0 ? s.block_start : -1, s.strstart - s.block_start, last);
  s.block_start = s.strstart;
  flush_pending2(s.strm);
};
var read_buf2 = (strm, buf, start, size) => {
  let len = strm.avail_in;
  if (len > size) len = size;
  if (len === 0) return 0;
  strm.avail_in -= len;
  buf.set(strm.input.subarray(strm.next_in, strm.next_in + len), start);
  if (strm.state.wrap === 1) strm.adler = adler322(strm.adler, buf, len, start);
  else if (strm.state.wrap === 2) strm.adler = crc322(strm.adler, buf, len, start);
  strm.next_in += len;
  strm.total_in += len;
  return len;
};
var longest_match2 = (s, cur_match) => {
  let chain_length = s.max_chain_length;
  let scan = s.strstart;
  let match;
  let len;
  let best_len = s.prev_length;
  let nice_match = s.nice_match;
  const limit = s.strstart > s.w_size - MIN_LOOKAHEAD2 ? s.strstart - (s.w_size - MIN_LOOKAHEAD2) : 0;
  const _win = s.window;
  const wmask = s.w_mask;
  const prev = s.prev;
  const strend = s.strstart + MAX_MATCH2;
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
    len = MAX_MATCH2 - (strend - scan);
    scan = strend - MAX_MATCH2;
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
var fill_window2 = (s) => {
  const _w_size = s.w_size;
  let n, more, str;
  do {
    more = s.window_size - s.lookahead - s.strstart;
    if (s.strstart >= _w_size + (_w_size - MIN_LOOKAHEAD2)) {
      s.window.set(s.window.subarray(_w_size, _w_size + _w_size - more), 0);
      s.match_start -= _w_size;
      s.strstart -= _w_size;
      s.block_start -= _w_size;
      if (s.insert > s.strstart) s.insert = s.strstart;
      slide_hash2(s);
      more += _w_size;
    }
    if (s.strm.avail_in === 0) break;
    n = read_buf2(s.strm, s.window, s.strstart + s.lookahead, more);
    s.lookahead += n;
    if (!s.legacy_hash) {
      if (s.lookahead + s.insert > MIN_MATCH2) {
        str = s.strstart - s.insert;
        while (s.insert) {
          INSERT_STRING2(s, str);
          str++;
          s.insert--;
          if (s.lookahead + s.insert <= MIN_MATCH2) break;
        }
      }
    } else if (s.lookahead + s.insert >= MIN_MATCH2) {
      str = s.strstart - s.insert;
      s.ins_h = s.window[str];
      s.ins_h = HASH2(s, s.ins_h, s.window[str + 1]);
      while (s.insert) {
        INSERT_STRING2(s, str);
        str++;
        s.insert--;
        if (s.lookahead + s.insert < MIN_MATCH2) break;
      }
    }
  } while (s.lookahead < MIN_LOOKAHEAD2 && s.strm.avail_in !== 0);
};
var deflate_stored2 = (s, flush) => {
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
    _tr_stored_block2(s, 0, 0, last);
    s.pending_buf[s.pending - 4] = len;
    s.pending_buf[s.pending - 3] = len >> 8;
    s.pending_buf[s.pending - 2] = ~len;
    s.pending_buf[s.pending - 1] = ~len >> 8;
    flush_pending2(s.strm);
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
      read_buf2(s.strm, s.strm.output, s.strm.next_out, len);
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
  if (last) return BS_FINISH_DONE2;
  if (flush !== 0 && flush !== 4 && s.strm.avail_in === 0 && s.strstart === s.block_start) return BS_BLOCK_DONE2;
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
    read_buf2(s.strm, s.window, s.strstart, have);
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
    _tr_stored_block2(s, s.block_start, len, last);
    s.block_start += len;
    flush_pending2(s.strm);
  }
  return last ? BS_FINISH_STARTED2 : BS_NEED_MORE2;
};
var deflate_fast2 = (s, flush) => {
  let hash_head;
  let bflush;
  for (; ; ) {
    if (s.lookahead < MIN_LOOKAHEAD2) {
      fill_window2(s);
      if (s.lookahead < MIN_LOOKAHEAD2 && flush === 0) return BS_NEED_MORE2;
      if (s.lookahead === 0) break;
    }
    hash_head = 0;
    if (s.lookahead >= MIN_MATCH2) hash_head = INSERT_STRING2(s, s.strstart);
    if (hash_head !== 0 && s.strstart - hash_head <= s.w_size - MIN_LOOKAHEAD2) s.match_length = longest_match2(s, hash_head);
    if (s.match_length >= MIN_MATCH2) {
      bflush = _tr_tally2(s, s.strstart - s.match_start, s.match_length - MIN_MATCH2);
      s.lookahead -= s.match_length;
      if (s.match_length <= s.max_lazy_match && s.lookahead >= MIN_MATCH2) {
        s.match_length--;
        do {
          s.strstart++;
          hash_head = INSERT_STRING2(s, s.strstart);
        } while (--s.match_length !== 0);
        s.strstart++;
      } else {
        s.strstart += s.match_length;
        s.match_length = 0;
        if (s.legacy_hash) {
          s.ins_h = s.window[s.strstart];
          s.ins_h = HASH2(s, s.ins_h, s.window[s.strstart + 1]);
        }
      }
    } else {
      bflush = _tr_tally2(s, 0, s.window[s.strstart]);
      s.lookahead--;
      s.strstart++;
    }
    if (bflush) {
      flush_block_only2(s, false);
      if (s.strm.avail_out === 0) return BS_NEED_MORE2;
    }
  }
  s.insert = s.strstart < MIN_MATCH2 - 1 ? s.strstart : MIN_MATCH2 - 1;
  if (flush === 4) {
    flush_block_only2(s, true);
    if (s.strm.avail_out === 0) return BS_FINISH_STARTED2;
    return BS_FINISH_DONE2;
  }
  if (s.sym_next) {
    flush_block_only2(s, false);
    if (s.strm.avail_out === 0) return BS_NEED_MORE2;
  }
  return BS_BLOCK_DONE2;
};
var deflate_slow2 = (s, flush) => {
  let hash_head;
  let bflush;
  let max_insert;
  for (; ; ) {
    if (s.lookahead < MIN_LOOKAHEAD2) {
      fill_window2(s);
      if (s.lookahead < MIN_LOOKAHEAD2 && flush === 0) return BS_NEED_MORE2;
      if (s.lookahead === 0) break;
    }
    hash_head = 0;
    if (s.lookahead >= MIN_MATCH2) hash_head = INSERT_STRING2(s, s.strstart);
    s.prev_length = s.match_length;
    s.prev_match = s.match_start;
    s.match_length = MIN_MATCH2 - 1;
    if (hash_head !== 0 && s.prev_length < s.max_lazy_match && s.strstart - hash_head <= s.w_size - MIN_LOOKAHEAD2) {
      s.match_length = longest_match2(s, hash_head);
      if (s.match_length <= 5 && (s.strategy === 1 || s.match_length === MIN_MATCH2 && s.strstart - s.match_start > 4096)) s.match_length = MIN_MATCH2 - 1;
    }
    if (s.prev_length >= MIN_MATCH2 && s.match_length <= s.prev_length) {
      max_insert = s.strstart + s.lookahead - MIN_MATCH2;
      bflush = _tr_tally2(s, s.strstart - 1 - s.prev_match, s.prev_length - MIN_MATCH2);
      s.lookahead -= s.prev_length - 1;
      s.prev_length -= 2;
      do
        if (++s.strstart <= max_insert) hash_head = INSERT_STRING2(s, s.strstart);
      while (--s.prev_length !== 0);
      s.match_available = 0;
      s.match_length = MIN_MATCH2 - 1;
      s.strstart++;
      if (bflush) {
        flush_block_only2(s, false);
        if (s.strm.avail_out === 0) return BS_NEED_MORE2;
      }
    } else if (s.match_available) {
      bflush = _tr_tally2(s, 0, s.window[s.strstart - 1]);
      if (bflush)
        flush_block_only2(s, false);
      s.strstart++;
      s.lookahead--;
      if (s.strm.avail_out === 0) return BS_NEED_MORE2;
    } else {
      s.match_available = 1;
      s.strstart++;
      s.lookahead--;
    }
  }
  if (s.match_available) {
    bflush = _tr_tally2(s, 0, s.window[s.strstart - 1]);
    s.match_available = 0;
  }
  s.insert = s.strstart < MIN_MATCH2 - 1 ? s.strstart : MIN_MATCH2 - 1;
  if (flush === 4) {
    flush_block_only2(s, true);
    if (s.strm.avail_out === 0) return BS_FINISH_STARTED2;
    return BS_FINISH_DONE2;
  }
  if (s.sym_next) {
    flush_block_only2(s, false);
    if (s.strm.avail_out === 0) return BS_NEED_MORE2;
  }
  return BS_BLOCK_DONE2;
};
var Config2 = class {
  constructor(good_length, max_lazy, nice_length, max_chain, func) {
    this.good_length = good_length;
    this.max_lazy = max_lazy;
    this.nice_length = nice_length;
    this.max_chain = max_chain;
    this.func = func;
  }
};
var configuration_table2 = [
  new Config2(0, 0, 0, 0, deflate_stored2),
  new Config2(4, 4, 8, 4, deflate_fast2),
  new Config2(4, 5, 16, 8, deflate_fast2),
  new Config2(4, 6, 32, 32, deflate_fast2),
  new Config2(4, 4, 16, 16, deflate_slow2),
  new Config2(8, 16, 32, 32, deflate_slow2),
  new Config2(8, 16, 128, 128, deflate_slow2),
  new Config2(8, 32, 128, 256, deflate_slow2),
  new Config2(32, 128, 258, 1024, deflate_slow2),
  new Config2(32, 258, 258, 4096, deflate_slow2)
];
var BAD$12 = 16209;
var TYPE$12 = 16191;
function inflate_fast2(strm, start) {
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
  let input2, output;
  const state = strm.state;
  _in = strm.next_in;
  input2 = strm.input;
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
      hold += input2[_in++] << bits;
      bits += 8;
      hold += input2[_in++] << bits;
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
            hold += input2[_in++] << bits;
            bits += 8;
          }
          len += hold & (1 << op) - 1;
          hold >>>= op;
          bits -= op;
        }
        if (bits < 15) {
          hold += input2[_in++] << bits;
          bits += 8;
          hold += input2[_in++] << bits;
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
              hold += input2[_in++] << bits;
              bits += 8;
              if (bits < op) {
                hold += input2[_in++] << bits;
                bits += 8;
              }
            }
            dist += hold & (1 << op) - 1;
            if (dist > dmax) {
              strm.msg = "invalid distance too far back";
              state.mode = BAD$12;
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
                  state.mode = BAD$12;
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
            state.mode = BAD$12;
            break top;
          }
          break;
        }
      } else if ((op & 64) === 0) {
        here = lcode[(here & 65535) + (hold & (1 << op) - 1)];
        continue dolen;
      } else if (op & 32) {
        state.mode = TYPE$12;
        break top;
      } else {
        strm.msg = "invalid literal/length code";
        state.mode = BAD$12;
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
var MAXBITS2 = 15;
var ENOUGH_LENS$12 = 852;
var ENOUGH_DISTS$12 = 592;
var CODES$12 = 0;
var LENS$12 = 1;
var DISTS$12 = 2;
var lbase2 = new Uint16Array([
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
var lext2 = new Uint8Array([
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
var dbase2 = new Uint16Array([
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
var dext2 = new Uint8Array([
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
var inflate_table2 = (type, lens, lens_index, codes, table, table_index, work, opts) => {
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
  for (len = 0; len <= MAXBITS2; len++) count[len] = 0;
  for (sym = 0; sym < codes; sym++) count[lens[lens_index + sym]]++;
  root = bits;
  for (max = MAXBITS2; max >= 1; max--) if (count[max] !== 0) break;
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
  for (len = 1; len <= MAXBITS2; len++) {
    left <<= 1;
    left -= count[len];
    if (left < 0) return -1;
  }
  if (left > 0 && (type === CODES$12 || max !== 1)) return -1;
  offs[1] = 0;
  for (len = 1; len < MAXBITS2; len++) offs[len + 1] = offs[len] + count[len];
  for (sym = 0; sym < codes; sym++) if (lens[lens_index + sym] !== 0) work[offs[lens[lens_index + sym]]++] = sym;
  if (type === CODES$12) {
    base = extra = work;
    match = 20;
  } else if (type === LENS$12) {
    base = lbase2;
    extra = lext2;
    match = 257;
  } else {
    base = dbase2;
    extra = dext2;
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
  if (type === LENS$12 && used > ENOUGH_LENS$12 || type === DISTS$12 && used > ENOUGH_DISTS$12) return 1;
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
      if (type === LENS$12 && used > ENOUGH_LENS$12 || type === DISTS$12 && used > ENOUGH_DISTS$12) return 1;
      low = huff & mask;
      table[low] = root << 24 | curr << 16 | next - table_index | 0;
    }
  }
  if (huff !== 0) table[next + huff] = len - drop << 24 | 4194304;
  opts.bits = root;
  return 0;
};
var CODES2 = 0;
var LENS2 = 1;
var DISTS2 = 2;
var HEAD2 = 16180;
var FLAGS2 = 16181;
var TIME2 = 16182;
var OS2 = 16183;
var EXLEN2 = 16184;
var EXTRA2 = 16185;
var NAME2 = 16186;
var COMMENT2 = 16187;
var HCRC2 = 16188;
var DICTID2 = 16189;
var DICT2 = 16190;
var TYPE2 = 16191;
var TYPEDO2 = 16192;
var STORED2 = 16193;
var COPY_2 = 16194;
var COPY2 = 16195;
var TABLE2 = 16196;
var LENLENS2 = 16197;
var CODELENS2 = 16198;
var LEN_2 = 16199;
var LEN2 = 16200;
var LENEXT2 = 16201;
var DIST2 = 16202;
var DISTEXT2 = 16203;
var MATCH2 = 16204;
var LIT2 = 16205;
var CHECK2 = 16206;
var LENGTH2 = 16207;
var DONE2 = 16208;
var BAD2 = 16209;
var MEM2 = 16210;
var SYNC2 = 16211;
var ENOUGH_LENS2 = 852;
var ENOUGH_DISTS2 = 592;
var zswap322 = (q) => {
  return (q >>> 24 & 255) + (q >>> 8 & 65280) + ((q & 65280) << 8) + ((q & 255) << 24);
};
var InflateState2 = class {
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
var inflateStateCheck2 = (strm) => {
  if (!strm) return 1;
  const state = strm.state;
  if (!state || state.strm !== strm || state.mode < HEAD2 || state.mode > SYNC2) return 1;
  return 0;
};
var inflateResetKeep2 = (strm) => {
  if (inflateStateCheck2(strm)) return -2;
  const state = strm.state;
  strm.total_in = strm.total_out = state.total = 0;
  strm.msg = "";
  if (state.wrap) strm.adler = state.wrap & 1;
  state.mode = HEAD2;
  state.last = 0;
  state.havedict = 0;
  state.flags = -1;
  state.dmax = 32768;
  state.head = null;
  state.hold = 0;
  state.bits = 0;
  state.lencode = state.lendyn = new Int32Array(ENOUGH_LENS2);
  state.distcode = state.distdyn = new Int32Array(ENOUGH_DISTS2);
  state.sane = 1;
  state.back = -1;
  return 0;
};
var inflateReset3 = (strm) => {
  if (inflateStateCheck2(strm)) return -2;
  const state = strm.state;
  state.wsize = 0;
  state.whave = 0;
  state.wnext = 0;
  return inflateResetKeep2(strm);
};
var inflateReset22 = (strm, windowBits) => {
  let wrap;
  if (inflateStateCheck2(strm)) return -2;
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
  return inflateReset3(strm);
};
var inflateInit22 = (strm, windowBits) => {
  if (!strm) return -2;
  const state = new InflateState2();
  strm.state = state;
  state.strm = strm;
  state.window = null;
  state.mode = HEAD2;
  const ret = inflateReset22(strm, windowBits);
  if (ret !== 0) strm.state = null;
  return ret;
};
var virgin2 = true;
var lenfix2;
var distfix2;
var fixedtables2 = (state) => {
  if (virgin2) {
    lenfix2 = /* @__PURE__ */ new Int32Array(512);
    distfix2 = /* @__PURE__ */ new Int32Array(32);
    let sym = 0;
    while (sym < 144) state.lens[sym++] = 8;
    while (sym < 256) state.lens[sym++] = 9;
    while (sym < 280) state.lens[sym++] = 7;
    while (sym < 288) state.lens[sym++] = 8;
    inflate_table2(LENS2, state.lens, 0, 288, lenfix2, 0, state.work, { bits: 9 });
    sym = 0;
    while (sym < 32) state.lens[sym++] = 5;
    inflate_table2(DISTS2, state.lens, 0, 32, distfix2, 0, state.work, { bits: 5 });
    virgin2 = false;
  }
  state.lencode = lenfix2;
  state.lenbits = 9;
  state.distcode = distfix2;
  state.distbits = 5;
};
var updatewindow2 = (strm, src, end, copy) => {
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
var inflate$12 = (strm, flush) => {
  let state;
  let input2, output;
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
  if (inflateStateCheck2(strm) || !strm.output || !strm.input && strm.avail_in !== 0) return -2;
  state = strm.state;
  if (state.mode === TYPE2) state.mode = TYPEDO2;
  put = strm.next_out;
  output = strm.output;
  left = strm.avail_out;
  next = strm.next_in;
  input2 = strm.input;
  have = strm.avail_in;
  hold = state.hold;
  bits = state.bits;
  _in = have;
  _out = left;
  ret = 0;
  inf_leave: for (; ; ) switch (state.mode) {
    case HEAD2:
      if (state.wrap === 0) {
        state.mode = TYPEDO2;
        break;
      }
      while (bits < 16) {
        if (have === 0) break inf_leave;
        have--;
        hold += input2[next++] << bits;
        bits += 8;
      }
      if (state.wrap & 2 && hold === 35615) {
        if (state.wbits === 0) state.wbits = 15;
        state.check = 0;
        hbuf[0] = hold & 255;
        hbuf[1] = hold >>> 8 & 255;
        state.check = crc322(state.check, hbuf, 2, 0);
        hold = 0;
        bits = 0;
        state.mode = FLAGS2;
        break;
      }
      if (state.head) state.head.done = false;
      if (!(state.wrap & 1) || (((hold & 255) << 8) + (hold >> 8)) % 31) {
        strm.msg = "incorrect header check";
        state.mode = BAD2;
        break;
      }
      if ((hold & 15) !== 8) {
        strm.msg = "unknown compression method";
        state.mode = BAD2;
        break;
      }
      hold >>>= 4;
      bits -= 4;
      len = (hold & 15) + 8;
      if (state.wbits === 0) state.wbits = len;
      if (len > 15 || len > state.wbits) {
        strm.msg = "invalid window size";
        state.mode = BAD2;
        break;
      }
      state.dmax = 1 << state.wbits;
      state.flags = 0;
      strm.adler = state.check = 1;
      state.mode = hold & 512 ? DICTID2 : TYPE2;
      hold = 0;
      bits = 0;
      break;
    case FLAGS2:
      while (bits < 16) {
        if (have === 0) break inf_leave;
        have--;
        hold += input2[next++] << bits;
        bits += 8;
      }
      state.flags = hold;
      if ((state.flags & 255) !== 8) {
        strm.msg = "unknown compression method";
        state.mode = BAD2;
        break;
      }
      if (state.flags & 57344) {
        strm.msg = "unknown header flags set";
        state.mode = BAD2;
        break;
      }
      if (state.head) state.head.text = hold >> 8 & 1;
      if (state.flags & 512 && state.wrap & 4) {
        hbuf[0] = hold & 255;
        hbuf[1] = hold >>> 8 & 255;
        state.check = crc322(state.check, hbuf, 2, 0);
      }
      hold = 0;
      bits = 0;
      state.mode = TIME2;
    case TIME2:
      while (bits < 32) {
        if (have === 0) break inf_leave;
        have--;
        hold += input2[next++] << bits;
        bits += 8;
      }
      if (state.head) state.head.time = hold >>> 0;
      if (state.flags & 512 && state.wrap & 4) {
        hbuf[0] = hold & 255;
        hbuf[1] = hold >>> 8 & 255;
        hbuf[2] = hold >>> 16 & 255;
        hbuf[3] = hold >>> 24 & 255;
        state.check = crc322(state.check, hbuf, 4, 0);
      }
      hold = 0;
      bits = 0;
      state.mode = OS2;
    case OS2:
      while (bits < 16) {
        if (have === 0) break inf_leave;
        have--;
        hold += input2[next++] << bits;
        bits += 8;
      }
      if (state.head) {
        state.head.xflags = hold & 255;
        state.head.os = hold >> 8;
      }
      if (state.flags & 512 && state.wrap & 4) {
        hbuf[0] = hold & 255;
        hbuf[1] = hold >>> 8 & 255;
        state.check = crc322(state.check, hbuf, 2, 0);
      }
      hold = 0;
      bits = 0;
      state.mode = EXLEN2;
    case EXLEN2:
      if (state.flags & 1024) {
        while (bits < 16) {
          if (have === 0) break inf_leave;
          have--;
          hold += input2[next++] << bits;
          bits += 8;
        }
        state.length = hold;
        if (state.head) state.head.extra_len = hold;
        if (state.flags & 512 && state.wrap & 4) {
          hbuf[0] = hold & 255;
          hbuf[1] = hold >>> 8 & 255;
          state.check = crc322(state.check, hbuf, 2, 0);
        }
        hold = 0;
        bits = 0;
      } else if (state.head) state.head.extra = null;
      state.mode = EXTRA2;
    case EXTRA2:
      if (state.flags & 1024) {
        copy = state.length;
        if (copy > have) copy = have;
        if (copy) {
          if (state.head) {
            len = state.head.extra_len - state.length;
            if (!state.head.extra) state.head.extra = new Uint8Array(state.head.extra_len);
            state.head.extra.set(input2.subarray(next, next + copy), len);
          }
          if (state.flags & 512 && state.wrap & 4) state.check = crc322(state.check, input2, copy, next);
          have -= copy;
          next += copy;
          state.length -= copy;
        }
        if (state.length) break inf_leave;
      }
      state.length = 0;
      state.mode = NAME2;
    case NAME2:
      if (state.flags & 2048) {
        if (have === 0) break inf_leave;
        copy = 0;
        do {
          len = input2[next + copy++];
          if (state.head && len && state.length < 65536) state.head.name += String.fromCharCode(len);
        } while (len && copy < have);
        if (state.flags & 512 && state.wrap & 4) state.check = crc322(state.check, input2, copy, next);
        have -= copy;
        next += copy;
        if (len) break inf_leave;
      } else if (state.head) state.head.name = null;
      state.length = 0;
      state.mode = COMMENT2;
    case COMMENT2:
      if (state.flags & 4096) {
        if (have === 0) break inf_leave;
        copy = 0;
        do {
          len = input2[next + copy++];
          if (state.head && len && state.length < 65536) state.head.comment += String.fromCharCode(len);
        } while (len && copy < have);
        if (state.flags & 512 && state.wrap & 4) state.check = crc322(state.check, input2, copy, next);
        have -= copy;
        next += copy;
        if (len) break inf_leave;
      } else if (state.head) state.head.comment = null;
      state.mode = HCRC2;
    case HCRC2:
      if (state.flags & 512) {
        while (bits < 16) {
          if (have === 0) break inf_leave;
          have--;
          hold += input2[next++] << bits;
          bits += 8;
        }
        if (state.wrap & 4 && hold !== (state.check & 65535)) {
          strm.msg = "header crc mismatch";
          state.mode = BAD2;
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
      state.mode = TYPE2;
      break;
    case DICTID2:
      while (bits < 32) {
        if (have === 0) break inf_leave;
        have--;
        hold += input2[next++] << bits;
        bits += 8;
      }
      strm.adler = state.check = zswap322(hold);
      hold = 0;
      bits = 0;
      state.mode = DICT2;
    case DICT2:
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
      state.mode = TYPE2;
    case TYPE2:
      if (flush === 5 || flush === 6) break inf_leave;
    case TYPEDO2:
      if (state.last) {
        hold >>>= bits & 7;
        bits -= bits & 7;
        state.mode = CHECK2;
        break;
      }
      while (bits < 3) {
        if (have === 0) break inf_leave;
        have--;
        hold += input2[next++] << bits;
        bits += 8;
      }
      state.last = hold & 1;
      hold >>>= 1;
      bits -= 1;
      switch (hold & 3) {
        case 0:
          state.mode = STORED2;
          break;
        case 1:
          fixedtables2(state);
          state.mode = LEN_2;
          if (flush === 6) {
            hold >>>= 2;
            bits -= 2;
            break inf_leave;
          }
          break;
        case 2:
          state.mode = TABLE2;
          break;
        case 3:
          strm.msg = "invalid block type";
          state.mode = BAD2;
      }
      hold >>>= 2;
      bits -= 2;
      break;
    case STORED2:
      hold >>>= bits & 7;
      bits -= bits & 7;
      while (bits < 32) {
        if (have === 0) break inf_leave;
        have--;
        hold += input2[next++] << bits;
        bits += 8;
      }
      if ((hold & 65535) !== (hold >>> 16 ^ 65535)) {
        strm.msg = "invalid stored block lengths";
        state.mode = BAD2;
        break;
      }
      state.length = hold & 65535;
      hold = 0;
      bits = 0;
      state.mode = COPY_2;
      if (flush === 6) break inf_leave;
    case COPY_2:
      state.mode = COPY2;
    case COPY2:
      copy = state.length;
      if (copy) {
        if (copy > have) copy = have;
        if (copy > left) copy = left;
        if (copy === 0) break inf_leave;
        output.set(input2.subarray(next, next + copy), put);
        have -= copy;
        next += copy;
        left -= copy;
        put += copy;
        state.length -= copy;
        break;
      }
      state.mode = TYPE2;
      break;
    case TABLE2:
      while (bits < 14) {
        if (have === 0) break inf_leave;
        have--;
        hold += input2[next++] << bits;
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
        state.mode = BAD2;
        break;
      }
      state.have = 0;
      state.mode = LENLENS2;
    case LENLENS2:
      while (state.have < state.ncode) {
        while (bits < 3) {
          if (have === 0) break inf_leave;
          have--;
          hold += input2[next++] << bits;
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
      ret = inflate_table2(CODES2, state.lens, 0, 19, state.lencode, 0, state.work, opts);
      state.lenbits = opts.bits;
      if (ret) {
        strm.msg = "invalid code lengths set";
        state.mode = BAD2;
        break;
      }
      state.have = 0;
      state.mode = CODELENS2;
    case CODELENS2:
      while (state.have < state.nlen + state.ndist) {
        for (; ; ) {
          here = state.lencode[hold & (1 << state.lenbits) - 1];
          here_bits = here >>> 24;
          here_op = here >>> 16 & 255;
          here_val = here & 65535;
          if (here_bits <= bits) break;
          if (have === 0) break inf_leave;
          have--;
          hold += input2[next++] << bits;
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
              hold += input2[next++] << bits;
              bits += 8;
            }
            hold >>>= here_bits;
            bits -= here_bits;
            if (state.have === 0) {
              strm.msg = "invalid bit length repeat";
              state.mode = BAD2;
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
              hold += input2[next++] << bits;
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
              hold += input2[next++] << bits;
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
            state.mode = BAD2;
            break;
          }
          while (copy--) state.lens[state.have++] = len;
        }
      }
      if (state.mode === BAD2) break;
      if (state.lens[256] === 0) {
        strm.msg = "invalid code -- missing end-of-block";
        state.mode = BAD2;
        break;
      }
      state.lenbits = 9;
      opts = { bits: state.lenbits };
      ret = inflate_table2(LENS2, state.lens, 0, state.nlen, state.lencode, 0, state.work, opts);
      state.lenbits = opts.bits;
      if (ret) {
        strm.msg = "invalid literal/lengths set";
        state.mode = BAD2;
        break;
      }
      state.distbits = 6;
      state.distcode = state.distdyn;
      opts = { bits: state.distbits };
      ret = inflate_table2(DISTS2, state.lens, state.nlen, state.ndist, state.distcode, 0, state.work, opts);
      state.distbits = opts.bits;
      if (ret) {
        strm.msg = "invalid distances set";
        state.mode = BAD2;
        break;
      }
      state.mode = LEN_2;
      if (flush === 6) break inf_leave;
    case LEN_2:
      state.mode = LEN2;
    case LEN2:
      if (have >= 6 && left >= 258) {
        strm.next_out = put;
        strm.avail_out = left;
        strm.next_in = next;
        strm.avail_in = have;
        state.hold = hold;
        state.bits = bits;
        inflate_fast2(strm, _out);
        put = strm.next_out;
        output = strm.output;
        left = strm.avail_out;
        next = strm.next_in;
        input2 = strm.input;
        have = strm.avail_in;
        hold = state.hold;
        bits = state.bits;
        if (state.mode === TYPE2) state.back = -1;
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
        hold += input2[next++] << bits;
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
          hold += input2[next++] << bits;
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
        state.mode = LIT2;
        break;
      }
      if (here_op & 32) {
        state.back = -1;
        state.mode = TYPE2;
        break;
      }
      if (here_op & 64) {
        strm.msg = "invalid literal/length code";
        state.mode = BAD2;
        break;
      }
      state.extra = here_op & 15;
      state.mode = LENEXT2;
    case LENEXT2:
      if (state.extra) {
        n = state.extra;
        while (bits < n) {
          if (have === 0) break inf_leave;
          have--;
          hold += input2[next++] << bits;
          bits += 8;
        }
        state.length += hold & (1 << state.extra) - 1;
        hold >>>= state.extra;
        bits -= state.extra;
        state.back += state.extra;
      }
      state.was = state.length;
      state.mode = DIST2;
    case DIST2:
      for (; ; ) {
        here = state.distcode[hold & (1 << state.distbits) - 1];
        here_bits = here >>> 24;
        here_op = here >>> 16 & 255;
        here_val = here & 65535;
        if (here_bits <= bits) break;
        if (have === 0) break inf_leave;
        have--;
        hold += input2[next++] << bits;
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
          hold += input2[next++] << bits;
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
        state.mode = BAD2;
        break;
      }
      state.offset = here_val;
      state.extra = here_op & 15;
      state.mode = DISTEXT2;
    case DISTEXT2:
      if (state.extra) {
        n = state.extra;
        while (bits < n) {
          if (have === 0) break inf_leave;
          have--;
          hold += input2[next++] << bits;
          bits += 8;
        }
        state.offset += hold & (1 << state.extra) - 1;
        hold >>>= state.extra;
        bits -= state.extra;
        state.back += state.extra;
      }
      if (state.offset > state.dmax) {
        strm.msg = "invalid distance too far back";
        state.mode = BAD2;
        break;
      }
      state.mode = MATCH2;
    case MATCH2:
      if (left === 0) break inf_leave;
      copy = _out - left;
      if (state.offset > copy) {
        copy = state.offset - copy;
        if (copy > state.whave) {
          if (state.sane) {
            strm.msg = "invalid distance too far back";
            state.mode = BAD2;
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
      if (state.length === 0) state.mode = LEN2;
      break;
    case LIT2:
      if (left === 0) break inf_leave;
      output[put++] = state.length;
      left--;
      state.mode = LEN2;
      break;
    case CHECK2:
      if (state.wrap) {
        while (bits < 32) {
          if (have === 0) break inf_leave;
          have--;
          hold |= input2[next++] << bits;
          bits += 8;
        }
        _out -= left;
        strm.total_out += _out;
        state.total += _out;
        if (state.wrap & 4 && _out) strm.adler = state.check = state.flags ? crc322(state.check, output, _out, put - _out) : adler322(state.check, output, _out, put - _out);
        _out = left;
        if (state.wrap & 4 && (state.flags ? hold : zswap322(hold)) !== state.check) {
          strm.msg = "incorrect data check";
          state.mode = BAD2;
          break;
        }
        hold = 0;
        bits = 0;
      }
      state.mode = LENGTH2;
    case LENGTH2:
      if (state.wrap && state.flags) {
        while (bits < 32) {
          if (have === 0) break inf_leave;
          have--;
          hold += input2[next++] << bits;
          bits += 8;
        }
        if (state.wrap & 4 && hold !== (state.total & 4294967295)) {
          strm.msg = "incorrect length check";
          state.mode = BAD2;
          break;
        }
        hold = 0;
        bits = 0;
      }
      state.mode = DONE2;
    case DONE2:
      ret = 1;
      break inf_leave;
    case BAD2:
      ret = -3;
      break inf_leave;
    case MEM2:
      return -4;
    case SYNC2:
    default:
      return -2;
  }
  strm.next_out = put;
  strm.avail_out = left;
  strm.next_in = next;
  strm.avail_in = have;
  state.hold = hold;
  state.bits = bits;
  if (state.wsize || _out !== strm.avail_out && state.mode < BAD2 && (state.mode < CHECK2 || flush !== 4)) {
    if (updatewindow2(strm, strm.output, strm.next_out, _out - strm.avail_out)) {
      state.mode = MEM2;
      return -4;
    }
  }
  _in -= strm.avail_in;
  _out -= strm.avail_out;
  strm.total_in += _in;
  strm.total_out += _out;
  state.total += _out;
  if (state.wrap & 4 && _out) strm.adler = state.check = state.flags ? crc322(state.check, output, _out, strm.next_out - _out) : adler322(state.check, output, _out, strm.next_out - _out);
  strm.data_type = state.bits + (state.last ? 64 : 0) + (state.mode === TYPE2 ? 128 : 0) + (state.mode === LEN_2 || state.mode === COPY_2 ? 256 : 0);
  if ((_in === 0 && _out === 0 || flush === 4) && ret === 0) ret = -5;
  return ret;
};
var inflateEnd2 = (strm) => {
  if (inflateStateCheck2(strm)) return -2;
  let state = strm.state;
  if (state.window) state.window = null;
  strm.state = null;
  return 0;
};
var inflateSetDictionary2 = (strm, dictionary) => {
  const dictLength = dictionary.length;
  let state;
  let dictid;
  let ret;
  if (inflateStateCheck2(strm)) return -2;
  state = strm.state;
  if (state.wrap !== 0 && state.mode !== DICT2) return -2;
  if (state.mode === DICT2) {
    dictid = 1;
    dictid = adler322(dictid, dictionary, dictLength, 0);
    if (dictid !== state.check) return -3;
  }
  ret = updatewindow2(strm, dictionary, dictLength, dictLength);
  if (ret) {
    state.mode = MEM2;
    return -4;
  }
  state.havedict = 1;
  return 0;
};
var ZStream2 = class {
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
var flattenChunks2 = (chunks) => {
  const result = new Uint8Array(chunks.reduce((len, chunk2) => len + chunk2.length, 0));
  let pos = 0;
  for (const chunk2 of chunks) {
    result.set(chunk2, pos);
    pos += chunk2.length;
  }
  return result;
};
var toString2 = Object.prototype.toString;
var defaultOptions2 = {
  chunkSize: 1024 * 64,
  windowBits: 15,
  raw: false,
  dictionary: /* @__PURE__ */ new Uint8Array(0)
};
var Inflate2 = class {
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
    this.options = Object.assign({}, defaultOptions2, options);
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
    this.strm = new ZStream2();
    this.strm.avail_out = 0;
    let status = inflateInit22(this.strm, opt.windowBits);
    if (status !== 0) throw new Error(messages_default2[status]);
    if (toString2.call(opt.dictionary) === "[object ArrayBuffer]") opt.dictionary = new Uint8Array(opt.dictionary);
    const dictionary = opt.dictionary;
    if (opt.raw && dictionary.length) {
      status = inflateSetDictionary2(this.strm, dictionary);
      if (status !== 0) throw new Error(messages_default2[status]);
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
    if (toString2.call(data) === "[object ArrayBuffer]") strm.input = new Uint8Array(data);
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
      status = inflate$12(strm, _flush_mode);
      if (status === 2) {
        const dictionary = this.options.dictionary;
        if (dictionary.length) {
          status = inflateSetDictionary2(strm, dictionary);
          if (status === 0) status = inflate$12(strm, _flush_mode);
          else if (status === -3) status = 2;
        }
      }
      while (strm.avail_in > 0 && status === 1 && strm.state.wrap & 2 && strm.state.flags !== 0 && strm.input[strm.next_in] !== 0) {
        inflateReset3(strm);
        status = inflate$12(strm, _flush_mode);
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
        status = inflateEnd2(this.strm);
        break;
      }
      if (strm.avail_in === 0) {
        if (_flush_mode === 4) {
          status = inflateEnd2(this.strm);
          if (status === 0) status = -5;
          break;
        }
        return true;
      }
    }
    this.err = status;
    this.msg = strm.msg || messages_default2[status];
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
  onData(chunk2) {
    this.chunks.push(chunk2);
  }
  /**
  * Called after you tell inflate that the input stream is
  * complete ({@link Z_FINISH}). By default, joins the collected {@link Inflate.chunks},
  * frees memory and fills the {@link Inflate.result} property.
  *
  * @param status inflate status. {@link Z_OK} on success, other if not.
  */
  onEnd(status) {
    if (status === 0) this.result = flattenChunks2(this.chunks);
    this.chunks = [];
  }
};

// packages/assets/src/aseprite-binary.ts
var ATLAS_FILE_LIMIT2 = ASSET_LIMITS.asepriteBytes;
var decoder = new TextDecoder("utf-8", { fatal: true });
var Cursor = class {
  constructor(bytes) {
    this.bytes = bytes;
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }
  bytes;
  /** Little-endian view over the bounded byte slice. */
  view;
  /** Byte offset within this cursor's bounded payload. */
  position = 0;
  /** Advance the cursor and return an owned subarray of exactly `length` bytes. */
  take(length) {
    integer(length, "Aseprite field size", 0, this.bytes.length - this.position);
    const value = this.bytes.subarray(this.position, this.position + length);
    this.position += length;
    return value;
  }
  /** Read one unsigned byte. */
  u8() {
    return this.take(1)[0];
  }
  /** Read one little-endian unsigned 16-bit integer. */
  u16() {
    const offset = this.position;
    this.take(2);
    return this.view.getUint16(offset, true);
  }
  /** Read one little-endian signed 16-bit integer. */
  i16() {
    const offset = this.position;
    this.take(2);
    return this.view.getInt16(offset, true);
  }
  /** Read one little-endian unsigned 32-bit integer. */
  u32() {
    const offset = this.position;
    this.take(4);
    return this.view.getUint32(offset, true);
  }
  /** Read one little-endian signed 32-bit integer. */
  i32() {
    const offset = this.position;
    this.take(4);
    return this.view.getInt32(offset, true);
  }
  /** Read a UTF-8 string prefixed by a uint16 byte length. */
  text() {
    return decoder.decode(this.take(this.u16()));
  }
  /** Require the cursor to consume the entire bounded payload. */
  finish() {
    if (this.position !== this.bytes.length) {
      throw new Error("Unexpected Aseprite chunk payload.");
    }
  }
};
var Fields = class {
  /** Appended field fragments concatenated by `build`. */
  parts = [];
  /** Reserved bytes are checked while appending, before allocating the combined payload. */
  length = 0;
  /** Append raw bytes after checking the combined output size limit. */
  raw(bytes) {
    this.length = boundedSum(this.length, bytes.length, ATLAS_FILE_LIMIT2, "Aseprite output size");
    this.parts.push(bytes);
    return this;
  }
  /** Append one unsigned byte. */
  u8(value) {
    return this.raw(Uint8Array.of(value));
  }
  /** Append one little-endian unsigned 16-bit integer. */
  u16(value) {
    const bytes = new Uint8Array(2);
    new DataView(bytes.buffer).setUint16(0, value, true);
    return this.raw(bytes);
  }
  /** Append one little-endian unsigned 32-bit integer. */
  u32(value) {
    const bytes = new Uint8Array(4);
    new DataView(bytes.buffer).setUint32(0, value, true);
    return this.raw(bytes);
  }
  /** Append a UTF-8 string prefixed by its uint16 byte length. */
  text(value) {
    const bytes = new TextEncoder().encode(value);
    integer(bytes.length, "Aseprite text size", 0, 65535);
    return this.u16(bytes.length).raw(bytes);
  }
  /** Concatenate appended parts into one owned buffer. */
  build() {
    const bytes = new Uint8Array(this.length);
    let offset = 0;
    for (const part of this.parts) {
      bytes.set(part, offset);
      offset += part.length;
    }
    return bytes;
  }
};
function chunk(type, data) {
  return new Fields().u32(data.length + 6).u16(type).raw(data).build();
}
function rasterZlibSync(bytes, expected) {
  integer(expected, "Decoded payload", 0, ASSET_LIMITS.decodedBytes);
  const output = new Uint8Array(expected);
  let offset = 0;
  const inflator = new Inflate2({ windowBits: 15, chunkSize: 16 * 1024 });
  let unread;
  inflator.onStart = (stream) => {
    unread = () => stream.avail_in;
  };
  inflator.onData = (part) => {
    if (part.length > expected - offset) {
      throw new Error("Aseprite decompressed raster exceeds its declared bounds.");
    }
    output.set(part, offset);
    offset += part.length;
  };
  let completed = false;
  inflator.onEnd = (status) => {
    if (status !== 0) {
      throw new Error("Invalid Aseprite zlib stream.");
    }
    completed = true;
  };
  try {
    inflator.push(bytes, true);
    if (!completed || offset !== expected || unread?.() !== 0) {
      throw new Error("Aseprite decompressed raster length or stream mismatch.");
    }
  } catch (cause) {
    throw new Error("Invalid bounded Aseprite zlib raster.", { cause });
  }
  return output;
}

// packages/assets/src/aseprite-document.ts
var ID_PREFIX = "uttori-atlas-export:";
function resolveAsepriteCels(document2) {
  integer(document2.frames.length, "Aseprite frames", 1, ASSET_LIMITS.frames);
  integer(document2.layers.length, "Aseprite layers", 1, ASSET_LIMITS.layers);
  let references = 0;
  const byFrame = document2.frames.map((frame) => {
    references = boundedSum(
      references,
      frame.cels.length,
      ASSET_LIMITS.references,
      "Aseprite cel references"
    );
    const layers = /* @__PURE__ */ new Map();
    for (const cel of frame.cels) {
      integer(cel.layer, "Cel layer", 0, document2.layers.length - 1);
      if (layers.has(cel.layer)) {
        throw new Error("Duplicate Aseprite cel on one frame/layer.");
      }
      if (cel.kind === "linked") {
        integer(cel.frame, "Linked frame", 0, document2.frames.length - 1);
      } else {
        if (cel.kind !== "raster" && cel.kind !== "tilemap") {
          throw new Error("Unsupported Aseprite cel kind.");
        }
      }
      layers.set(cel.layer, cel);
    }
    return layers;
  });
  const resolved = /* @__PURE__ */ new Map();
  for (const frame of document2.frames) {
    for (const initial of frame.cels) {
      let cel = initial;
      const chain = [];
      const visited = /* @__PURE__ */ new Set();
      while (!resolved.has(cel) && cel.kind === "linked") {
        if (visited.has(cel) || chain.length >= ASSET_LIMITS.frames) {
          throw new Error("Aseprite linked cel cycle or traversal limit.");
        }
        visited.add(cel);
        chain.push(cel);
        const target = byFrame[cel.frame]?.get(cel.layer);
        if (!target) {
          throw new Error("Aseprite linked cel has no target on its layer.");
        }
        cel = target;
      }
      const payload = resolved.get(cel);
      let result;
      if (payload) {
        result = payload;
      } else if (cel.kind !== "linked") {
        result = cel;
      } else {
        throw new Error("Unresolved Aseprite linked cel.");
      }
      resolved.set(cel, result);
      for (const link of chain) {
        resolved.set(link, result);
      }
    }
  }
  return resolved;
}
function textSize(value) {
  if (typeof value !== "string") {
    throw new TypeError("Aseprite metadata must be text.");
  }
  return integer(new TextEncoder().encode(value).length, "Aseprite text bytes", 0, 65535);
}
function validateMasks(cel) {
  if (![8, 16, 32].includes(cel.bits)) {
    throw new Error("Unsupported Aseprite tile word width.");
  }
  const maximum = 2 ** cel.bits - 1;
  integer(cel.idMask, "Tile ID mask", 1, maximum);
  if ((cel.idMask & cel.idMask + 1) !== 0) {
    throw new Error("Aseprite tile ID mask must use contiguous low bits.");
  }
  let claimed = cel.idMask;
  for (const mask of [cel.flipXMask, cel.flipYMask, cel.diagonalMask]) {
    integer(mask, "Tile transform mask", 0, maximum);
    if ((mask & mask - 1) !== 0 || (mask & claimed) !== 0) {
      throw new Error("Aseprite tile masks overlap or have multiple transform bits.");
    }
    claimed = (claimed | mask) >>> 0;
  }
}
function validateAsepriteDocument(document2) {
  rasterArea(document2.width, document2.height, "Aseprite", ASSET_LIMITS.interchangeSide);
  indexedPalette(document2.palette);
  integer(document2.transparentIndex, "Aseprite transparent slot", 0, document2.palette.length - 1);
  if (document2.exportId !== void 0 && !/^[\da-f-]{36}$/.test(document2.exportId)) {
    throw new Error("Invalid Aseprite export identity.");
  }
  integer(document2.frames.length, "Aseprite frames", 1, ASSET_LIMITS.frames);
  integer(document2.layers.length, "Aseprite layers", 1, ASSET_LIMITS.layers);
  integer(document2.tilesets.length, "Aseprite tilesets", 0, ASSET_LIMITS.tilesets);
  integer(document2.tags.length, "Aseprite tags", 0, ASSET_LIMITS.frames);
  let bytes = 0, metadata = 0, references = 0;
  const addText = (value) => {
    if (value !== void 0) {
      metadata = boundedSum(
        metadata,
        textSize(value),
        ASSET_LIMITS.metadataBytes,
        "Aseprite metadata"
      );
    }
  };
  addText(document2.userData);
  const tilesets = /* @__PURE__ */ new Map();
  for (const set of document2.tilesets) {
    integer(set.id, "Tileset ID", 0, 4294967295);
    integer(set.flags, "Tileset flags", 0, 62);
    if (tilesets.has(set.id) || set.flags & ~62 || !(set.flags & 2)) {
      throw new Error("Duplicate, external or unsupported Aseprite tileset.");
    }
    integer(set.baseIndex, "Tileset base index", -32768, 32767);
    const area = rasterArea(
      set.tileWidth,
      set.tileHeight,
      "Aseprite tile",
      ASSET_LIMITS.interchangeSide
    );
    integer(set.tileCount, "Aseprite tiles", 1, ASSET_LIMITS.owners);
    const length = boundedProduct(area, set.tileCount, ASSET_LIMITS.decodedBytes, "Tileset pixels");
    if (!(set.indexes instanceof Uint8Array) || set.indexes.length !== length || set.tileData.length !== set.tileCount) {
      throw new Error("Aseprite tileset pixel or metadata inventory mismatch.");
    }
    if (set.indexes.some((slot) => slot >= document2.palette.length)) {
      throw new Error("Aseprite tileset references a missing palette slot.");
    }
    bytes = boundedSum(bytes, length, ASSET_LIMITS.decodedBytes, "Aseprite decoded payload");
    addText(set.name);
    addText(set.userData);
    for (const value of set.tileData) {
      addText(value);
    }
    tilesets.set(set.id, set);
  }
  for (const layer of document2.layers) {
    integer(layer.flags, "Layer flags", 0, 127);
    if (layer.flags & (8 | 64) || layer.kind !== "raster" && layer.kind !== "tilemap") {
      throw new Error("Unsupported Aseprite background/reference/group layer.");
    }
    if (layer.uuid !== void 0 && !/^[\da-f]{32}$/i.test(layer.uuid)) {
      throw new Error("Invalid Aseprite layer UUID.");
    }
    if (layer.kind === "tilemap" && !tilesets.has(layer.tileset)) {
      throw new Error("Aseprite layer references a missing embedded tileset.");
    }
    addText(layer.name);
    addText(layer.userData);
  }
  for (const frame of document2.frames) {
    integer(frame.durationMs, "Frame duration milliseconds", 1, 65535);
    references = boundedSum(
      references,
      frame.cels.length,
      ASSET_LIMITS.references,
      "Aseprite cel references"
    );
    const layers = /* @__PURE__ */ new Set();
    for (const cel of frame.cels) {
      integer(cel.layer, "Cel layer", 0, document2.layers.length - 1);
      if (layers.has(cel.layer)) {
        throw new Error("Duplicate Aseprite cel on one frame/layer.");
      }
      layers.add(cel.layer);
      integer(cel.x, "Cel x", -32768, 32767);
      integer(cel.y, "Cel y", -32768, 32767);
      integer(cel.zIndex, "Cel z-index", -32768, 32767);
      addText(cel.userData);
      if (cel.kind === "linked") {
        integer(cel.frame, "Linked frame", 0, document2.frames.length - 1);
      } else if (cel.kind === "raster") {
        validateIndexedPixels(cel);
        if (document2.layers[cel.layer].kind !== "raster" || cel.indexes.some((slot) => slot >= document2.palette.length)) {
          throw new Error("Aseprite raster layer or palette slot mismatch.");
        }
        bytes = boundedSum(
          bytes,
          cel.indexes.length,
          ASSET_LIMITS.decodedBytes,
          "Aseprite decoded payload"
        );
      } else if (cel.kind === "tilemap") {
        validateMasks(cel);
        integer(cel.columns, "Tilemap columns", 1, 65535);
        integer(cel.rows, "Tilemap rows", 1, 65535);
        const count = boundedProduct(
          cel.columns,
          cel.rows,
          ASSET_LIMITS.references,
          "Tilemap cells"
        );
        if (!(cel.cells instanceof Uint32Array) || cel.cells.length !== count || document2.layers[cel.layer].kind !== "tilemap") {
          throw new Error("Aseprite tilemap layer or cell inventory mismatch.");
        }
        bytes = boundedSum(
          bytes,
          boundedProduct(count, 4, ASSET_LIMITS.decodedBytes, "Tilemap bytes"),
          ASSET_LIMITS.decodedBytes,
          "Aseprite decoded payload"
        );
      } else {
        throw new Error("Unsupported Aseprite cel kind.");
      }
    }
  }
  for (const tag of document2.tags) {
    integer(tag.from, "Tag first frame", 0, document2.frames.length - 1);
    integer(tag.to, "Tag final frame", tag.from, document2.frames.length - 1);
    integer(tag.direction, "Tag direction", 0, 3);
    integer(tag.repeat, "Tag repeat", 0, 65535);
    addText(tag.name);
    addText(tag.userData);
  }
  const resolved = resolveAsepriteCels(document2);
  const checkedPayloads = /* @__PURE__ */ new Set();
  for (const [cel, payload] of resolved) {
    const layer = document2.layers[cel.layer];
    if (payload.kind !== layer.kind) {
      throw new Error("Linked payload does not match its layer.");
    }
    if (payload.kind === "tilemap" && layer.kind === "tilemap") {
      if (checkedPayloads.has(payload)) {
        continue;
      }
      checkedPayloads.add(payload);
      const set = tilesets.get(layer.tileset);
      for (const word of payload.cells) {
        if (!(set.flags & 4) && word === 4294967295) {
          continue;
        }
        const id2 = (word & payload.idMask) >>> 0;
        const usedMask = (payload.idMask | payload.flipXMask | payload.flipYMask | payload.diagonalMask) >>> 0;
        if ((word & ~usedMask) !== 0 || word > 2 ** payload.bits - 1 || id2 >= set.tileCount) {
          throw new Error("Aseprite tilemap references unknown tile bits or an absent tile.");
        }
      }
    }
  }
}
function* parseAsepriteDocument(bytes, signal) {
  integer(bytes.length, "Aseprite input bytes", 144, ASSET_LIMITS.asepriteBytes);
  signal?.throwIfAborted();
  const file = new Cursor(Uint8Array.from(bytes));
  const header = new Cursor(file.take(128));
  if (header.u32() !== bytes.length || header.u16() !== 42464) {
    throw new Error("Invalid Aseprite header/length.");
  }
  const frameCount = integer(header.u16(), "Aseprite frames", 1, ASSET_LIMITS.frames);
  const width = header.u16(), height = header.u16();
  rasterArea(width, height, "Aseprite", ASSET_LIMITS.interchangeSide);
  if (header.u16() !== 8) {
    throw new Error("Aseprite interchange requires indexed color mode.");
  }
  const flags = header.u32();
  if (flags & ~7) {
    throw new Error("Unsupported Aseprite header flags.");
  }
  const speed = header.u16();
  header.take(8);
  const transparentIndex = header.u8();
  header.take(3);
  let paletteSize = header.u16() || 256;
  integer(paletteSize, "Palette size", 1, 256);
  const ratioX = header.u8(), ratioY = header.u8();
  if (ratioX && ratioY && ratioX !== ratioY) {
    throw new Error("Unsupported Aseprite pixel aspect ratio.");
  }
  const layers = [], tilesets = [], frames = [], tags = [];
  const paletteState = [];
  let palette = [], modern = false, decoded2 = 0, metadata = 0, chunks = 0, references = 0;
  let exportId, userData;
  const reserve = (length) => {
    decoded2 = boundedSum(decoded2, length, ASSET_LIMITS.decodedBytes, "Aseprite decoded payload");
    return length;
  };
  for (let frameIndex = 0; frameIndex < frameCount; frameIndex++) {
    signal?.throwIfAborted();
    const frameSize = integer(
      file.u32(),
      "Frame extent",
      16,
      file.bytes.length - file.position + 4
    );
    const frame = new Cursor(file.take(frameSize - 4));
    if (frame.u16() !== 61946) {
      throw new Error("Invalid Aseprite frame header.");
    }
    const oldCount = frame.u16(), durationMs = frame.u16() || speed;
    frame.take(2);
    const count = frame.u32() || oldCount;
    chunks = boundedSum(chunks, count, ASSET_LIMITS.chunks, "Aseprite chunks");
    if (count > Math.floor((frame.bytes.length - frame.position) / 6)) {
      throw new Error("Aseprite chunk count exceeds frame extent.");
    }
    modern = false;
    const cels = [];
    let attachment;
    let documentAttachment = false;
    let lastCel;
    for (let i = 0; i < count; i++) {
      signal?.throwIfAborted();
      const size = integer(frame.u32(), "Chunk extent", 6, frame.bytes.length - frame.position + 4);
      const type = frame.u16(), data = new Cursor(frame.take(size - 6));
      if (type !== 8224 && type !== 8198) {
        attachment = void 0;
        documentAttachment = false;
      }
      if ([8217, 4, 17].includes(type)) {
        if (type === 8217) {
          paletteSize = integer(data.u32(), "Palette size", 1, 256);
          const first = data.u32(), last = data.u32();
          data.take(8);
          if (first > last || last >= paletteSize) {
            throw new Error("Invalid Aseprite palette range.");
          }
          paletteState.length = paletteSize;
          for (let slot = first; slot <= last; slot++) {
            const entryFlags = data.u16();
            if (entryFlags & ~1) {
              throw new Error("Unsupported palette entry flags.");
            }
            paletteState[slot] = [data.u8(), data.u8(), data.u8(), data.u8()];
            if (entryFlags & 1) {
              data.text();
            }
          }
          modern = true;
        } else {
          const packets = integer(data.u16(), "Palette packets", 0, 256);
          let start = 0;
          for (let packet = 0; packet < packets; packet++) {
            start += data.u8();
            const length = data.u8() || 256;
            if (start + length > 256) {
              throw new Error("Invalid legacy palette range.");
            }
            for (let slot = start; slot < start + length; slot++) {
              const rgb = [data.u8(), data.u8(), data.u8()];
              if (type === 17) {
                for (let channel = 0; channel < 3; channel++) {
                  integer(rgb[channel], "Legacy palette channel", 0, 63);
                  rgb[channel] = rgb[channel] << 2 | rgb[channel] >> 4;
                }
              }
              if (!modern) {
                paletteState[slot] = [rgb[0], rgb[1], rgb[2], 255];
              }
            }
          }
        }
        documentAttachment = true;
        attachment = (text) => {
          if (text?.startsWith(ID_PREFIX)) {
            if (exportId !== void 0) {
              throw new Error("Conflicting Aseprite export identity.");
            }
            exportId = text.slice(ID_PREFIX.length);
          } else {
            userData = text;
          }
          attachment = void 0;
          documentAttachment = false;
        };
      } else if (type === 8196) {
        if (frameIndex !== 0 || layers.length >= ASSET_LIMITS.layers) {
          throw new Error("Aseprite layer declaration limit/order.");
        }
        const layerFlags = data.u16(), kind = data.u16(), level = data.u16();
        data.take(4);
        const blend2 = data.u16(), opacity = data.u8();
        data.take(3);
        const name = data.text();
        if (![0, 2].includes(kind) || level || blend2 || flags & 1 && opacity !== 255) {
          throw new Error("Unsupported Aseprite layer hierarchy/blend/opacity.");
        }
        let layer;
        if (kind === 2) {
          layer = { name, flags: layerFlags, kind: "tilemap", tileset: data.u32() };
        } else {
          layer = { name, flags: layerFlags, kind: "raster" };
        }
        if (flags & 4) {
          const uuid = [...data.take(16)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
          layer = { ...layer, uuid };
        }
        layers.push(layer);
        attachment = (text) => {
          layer.userData = text;
          attachment = void 0;
        };
      } else if (type === 8197) {
        references = boundedSum(references, 1, ASSET_LIMITS.references, "Aseprite cel references");
        const position = { layer: data.u16(), x: data.i16(), y: data.i16() };
        const opacity = data.u8(), celType = data.u16(), zIndex = data.i16();
        data.take(5);
        if (opacity !== 255) {
          throw new Error("Unsupported Aseprite cel opacity.");
        }
        let cel;
        if (celType === 1) {
          cel = { ...position, zIndex, kind: "linked", frame: data.u16() };
        } else if (celType === 0 || celType === 2) {
          const celWidth = data.u16(), celHeight = data.u16();
          const length = reserve(rasterArea(celWidth, celHeight, "Aseprite cel"));
          const indexes = celType === 0 ? data.take(length).slice() : yield { bytes: data.take(data.bytes.length - data.position), expected: length };
          cel = {
            ...position,
            zIndex,
            kind: "raster",
            width: celWidth,
            height: celHeight,
            indexes
          };
        } else if (celType === 3) {
          const columns = data.u16(), rows2 = data.u16(), bits = data.u16();
          if (bits !== 8 && bits !== 16 && bits !== 32) {
            throw new Error("Unsupported Aseprite tile word width.");
          }
          const masks = {
            idMask: data.u32(),
            flipXMask: data.u32(),
            flipYMask: data.u32(),
            diagonalMask: data.u32()
          };
          data.take(10);
          const cellCount = boundedProduct(columns, rows2, ASSET_LIMITS.references, "Tilemap cells");
          reserve(boundedProduct(cellCount, 4, ASSET_LIMITS.decodedBytes, "Tilemap payload"));
          const raw = yield {
            bytes: data.take(data.bytes.length - data.position),
            expected: boundedProduct(
              cellCount,
              bits / 8,
              ASSET_LIMITS.decodedBytes,
              "Tilemap storage"
            )
          };
          const cells = new Uint32Array(cellCount), words = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
          for (let cell = 0; cell < cellCount; cell++) {
            if (bits === 8) {
              cells[cell] = raw[cell];
            } else if (bits === 16) {
              cells[cell] = words.getUint16(cell * 2, true);
            } else {
              cells[cell] = words.getUint32(cell * 4, true);
            }
          }
          cel = { ...position, zIndex, kind: "tilemap", columns, rows: rows2, bits, ...masks, cells };
        } else {
          throw new Error("Unsupported Aseprite cel type.");
        }
        cels.push(cel);
        lastCel = cel;
        attachment = (text) => {
          cel.userData = text;
          attachment = void 0;
        };
      } else if (type === 8227) {
        if (frameIndex !== 0 || tilesets.length >= ASSET_LIMITS.tilesets) {
          throw new Error("Aseprite tileset declaration limit/order.");
        }
        const id2 = data.u32(), tilesetFlags = data.u32(), tileCount = data.u32(), tileWidth = data.u16(), tileHeight = data.u16(), baseIndex = data.i16();
        data.take(14);
        const name = data.text();
        if (tilesetFlags & ~62 || !(tilesetFlags & 2)) {
          throw new Error("External or unsupported Aseprite tileset.");
        }
        integer(tileCount, "Tileset tiles", 1, ASSET_LIMITS.owners);
        const length = reserve(
          boundedProduct(
            rasterArea(tileWidth, tileHeight, "Aseprite tile"),
            tileCount,
            ASSET_LIMITS.decodedBytes,
            "Tileset pixels"
          )
        );
        const compressed = data.take(data.u32());
        const indexes = yield { bytes: compressed, expected: length };
        const tileData = Array.from({ length: tileCount }, () => void 0);
        const set = {
          id: id2,
          flags: tilesetFlags,
          tileCount,
          tileWidth,
          tileHeight,
          baseIndex,
          name,
          indexes,
          tileData
        };
        tilesets.push(set);
        let tile = -1;
        attachment = (text) => {
          if (tile < 0) {
            set.userData = text;
          } else {
            tileData[tile] = text;
          }
          tile++;
          if (tile === tileCount) {
            attachment = void 0;
          }
        };
      } else if (type === 8216) {
        const length = integer(data.u16(), "Tag count", 0, ASSET_LIMITS.frames - tags.length);
        data.take(8);
        const firstTag = tags.length;
        for (let tagIndex = 0; tagIndex < length; tagIndex++) {
          const from = data.u16(), to = data.u16(), direction = data.u8(), repeat = data.u16();
          data.take(10);
          const tag2 = { from, to, direction, repeat, name: data.text() };
          tags.push(tag2);
        }
        let tag = firstTag;
        attachment = (text) => {
          if (tag >= tags.length) {
            throw new Error("Extra Aseprite tag metadata.");
          }
          if (text !== void 0) {
            tags[tag].userData = text;
          }
          tag++;
          if (tag === tags.length) {
            attachment = void 0;
          }
        };
      } else if (type === 8224) {
        metadata = boundedSum(metadata, size - 6, ASSET_LIMITS.metadataBytes, "Aseprite metadata");
        const userFlags = data.u32();
        if (userFlags & ~7) {
          throw new Error("Unsupported Aseprite user data flags.");
        }
        const text = userFlags & 1 ? data.text() : void 0;
        if (userFlags & 2) {
          data.take(4);
        }
        if (userFlags & 4) {
          const length = integer(
            data.u32(),
            "Property extent",
            8,
            data.bytes.length - data.position + 4
          );
          data.take(length - 4);
        }
        if (text?.startsWith(ID_PREFIX) && !documentAttachment) {
          throw new Error("Conflicting Aseprite export identity attachment.");
        }
        attachment?.(text);
      } else if (type === 8198) {
        const extraFlags = data.u32(), bounds = [data.i32(), data.i32(), data.i32(), data.i32()];
        data.take(16);
        if (extraFlags & ~1 || extraFlags & 1 && (!lastCel || lastCel.kind !== "raster")) {
          throw new Error("Unsupported Aseprite precise cel bounds.");
        }
        if (extraFlags & 1 && lastCel?.kind === "raster") {
          const expected = [lastCel.x, lastCel.y, lastCel.width, lastCel.height];
          if (bounds.some((value, bound) => value !== expected[bound] * 65536)) {
            throw new Error("Scaled or fractional Aseprite cel bounds are unsupported.");
          }
        }
      } else if (type === 8199) {
        const profile = data.u16(), profileFlags = data.u16();
        data.take(12);
        if (profile > 1 || profileFlags) {
          throw new Error("Unsupported Aseprite color profile/gamma.");
        }
        attachment = void 0;
      } else if ([8214, 8215, 8226].includes(type)) {
        metadata = boundedSum(
          metadata,
          size - 6,
          ASSET_LIMITS.metadataBytes,
          "Aseprite annotations"
        );
        data.take(data.bytes.length);
        attachment = void 0;
      } else {
        throw new Error(`Unsupported Aseprite chunk 0x${type.toString(16)}.`);
      }
      data.finish();
    }
    frame.finish();
    const current = [];
    for (let slot = 0; slot < paletteSize; slot++) {
      const color = paletteState[slot];
      if (!color) {
        throw new Error("Aseprite palette does not define every slot.");
      }
      current.push(color);
    }
    if (frameIndex === 0) {
      palette = current;
    } else if (palette.length !== current.length || current.some((color, slot) => color.some((channel, i) => channel !== palette[slot][i]))) {
      throw new Error("Animated palette changes are outside the indexed interchange profile.");
    }
    frames.push({ durationMs, cels });
  }
  file.finish();
  signal?.throwIfAborted();
  const document2 = {
    width,
    height,
    palette,
    transparentIndex,
    exportId,
    userData,
    layers,
    tilesets,
    frames,
    tags
  };
  validateAsepriteDocument(document2);
  return document2;
}
async function compress(bytes, limit, signal) {
  signal?.throwIfAborted();
  const source = new ReadableStream({
    start(controller) {
      controller.enqueue(bytes.slice());
      controller.close();
    }
  });
  const reader = source.pipeThrough(new CompressionStream("deflate")).getReader();
  const abort = () => {
    void reader.cancel(signal?.reason).catch(() => {
    });
  };
  signal?.addEventListener("abort", abort, { once: true });
  const parts2 = [];
  let size = 0;
  try {
    for (; ; ) {
      signal?.throwIfAborted();
      const next = await reader.read();
      signal?.throwIfAborted();
      if (next.done) {
        break;
      }
      size = boundedSum(size, next.value.length, limit, "Aseprite compressed output");
      parts2.push(next.value);
    }
  } catch (cause) {
    await reader.cancel().catch(() => {
    });
    throw cause;
  } finally {
    signal?.removeEventListener("abort", abort);
    reader.releaseLock();
  }
  const output = new Uint8Array(size);
  let offset = 0;
  for (const part of parts2) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}
function encodedStructureBytes(document2) {
  let size = boundedSum(
    128,
    document2.frames.length * 16,
    ASSET_LIMITS.asepriteBytes,
    "Aseprite output size"
  ), chunks = 0;
  const reserve = (bytes) => {
    chunks = boundedSum(chunks, 1, ASSET_LIMITS.chunks, "Aseprite chunks");
    size = boundedSum(size, bytes, ASSET_LIMITS.asepriteBytes, "Aseprite output size");
  };
  const user = (value) => reserve(10 + (value === void 0 ? 0 : 2 + textSize(value)));
  reserve(26 + document2.palette.length * 6);
  if (document2.exportId) {
    user(ID_PREFIX + document2.exportId);
  } else if (document2.userData !== void 0) {
    user(document2.userData);
  }
  for (const set of document2.tilesets) {
    reserve(44 + textSize(set.name));
    if (set.userData !== void 0 || set.tileData.some((value) => value !== void 0)) {
      user(set.userData);
      let last = set.tileData.length - 1;
      while (last >= 0 && set.tileData[last] === void 0) {
        last--;
      }
      for (let tile = 0; tile <= last; tile++) {
        user(set.tileData[tile]);
      }
    }
  }
  for (const layer of document2.layers) {
    reserve(24 + textSize(layer.name) + (layer.kind === "tilemap" ? 4 : 0) + (layer.uuid ? 16 : 0));
    if (layer.userData !== void 0) {
      user(layer.userData);
    }
  }
  if (document2.tags.length) {
    reserve(16 + document2.tags.reduce((total, tag) => total + 19 + textSize(tag.name), 0));
    if (document2.tags.some((tag) => tag.userData !== void 0)) {
      for (const tag of document2.tags) {
        user(tag.userData);
      }
    }
  }
  for (const frame of document2.frames) {
    for (const cel of frame.cels) {
      let extent = 26;
      if (cel.kind === "linked") {
        extent = 24;
      } else if (cel.kind === "tilemap") {
        extent = 54;
      }
      reserve(extent);
      if (cel.userData !== void 0) {
        user(cel.userData);
      }
    }
  }
  return size;
}
var userDataChunk = (text) => chunk(
  8224,
  text === void 0 ? new Fields().u32(0).build() : new Fields().u32(1).text(text).build()
);
async function encodeAsepriteDocument(document2, signal) {
  signal?.throwIfAborted();
  validateAsepriteDocument(document2);
  let available = ASSET_LIMITS.asepriteBytes - encodedStructureBytes(document2);
  const compressPayload = async (bytes) => {
    const output = await compress(bytes, available, signal);
    available -= output.length;
    return output;
  };
  const hasUuid = document2.layers.some((layer) => layer.uuid !== void 0);
  if (hasUuid && document2.layers.some((layer) => !layer.uuid)) {
    throw new Error("All Aseprite layers require UUIDs when UUID storage is enabled.");
  }
  const allFrames = [];
  for (let frameIndex = 0; frameIndex < document2.frames.length; frameIndex++) {
    signal?.throwIfAborted();
    const frame = document2.frames[frameIndex], chunks = [];
    if (frameIndex === 0) {
      const palette = new Fields().u32(document2.palette.length).u32(0).u32(document2.palette.length - 1).raw(new Uint8Array(8));
      for (const color of document2.palette) {
        palette.u16(0).raw(Uint8Array.from(color));
      }
      chunks.push(chunk(8217, palette.build()));
      if (document2.exportId) {
        chunks.push(userDataChunk(ID_PREFIX + document2.exportId));
      } else if (document2.userData !== void 0) {
        chunks.push(userDataChunk(document2.userData));
      }
      for (const set of document2.tilesets) {
        const fields = new Fields().u32(set.id).u32(set.flags).u32(set.tileCount).u16(set.tileWidth).u16(set.tileHeight).u16(set.baseIndex).raw(new Uint8Array(14)).text(set.name);
        const compressed = await compressPayload(set.indexes);
        fields.u32(compressed.length).raw(compressed);
        chunks.push(chunk(8227, fields.build()));
        if (set.userData !== void 0 || set.tileData.some((text) => text !== void 0)) {
          chunks.push(userDataChunk(set.userData));
          let last = set.tileData.length - 1;
          while (last >= 0 && set.tileData[last] === void 0) {
            last--;
          }
          for (let tile = 0; tile <= last; tile++) {
            chunks.push(userDataChunk(set.tileData[tile]));
          }
        }
      }
      for (const layer of document2.layers) {
        const fields = new Fields().u16(layer.flags).u16(layer.kind === "raster" ? 0 : 2).u16(0).u16(0).u16(0).u16(0).u8(255).raw(new Uint8Array(3)).text(layer.name);
        if (layer.kind === "tilemap") {
          fields.u32(layer.tileset);
        }
        if (layer.uuid) {
          fields.raw(Uint8Array.from(layer.uuid.match(/../g), (hex2) => Number.parseInt(hex2, 16)));
        }
        chunks.push(chunk(8196, fields.build()));
        if (layer.userData !== void 0) {
          chunks.push(userDataChunk(layer.userData));
        }
      }
      if (document2.tags.length) {
        const fields = new Fields().u16(document2.tags.length).raw(new Uint8Array(8));
        for (const tag of document2.tags) {
          fields.u16(tag.from).u16(tag.to).u8(tag.direction).u16(tag.repeat).raw(new Uint8Array(10)).text(tag.name);
        }
        chunks.push(chunk(8216, fields.build()));
        if (document2.tags.some((tag) => tag.userData !== void 0)) {
          for (const tag of document2.tags) {
            chunks.push(userDataChunk(tag.userData));
          }
        }
      }
    }
    for (const cel of frame.cels) {
      const fields = new Fields().u16(cel.layer).u16(cel.x).u16(cel.y).u8(255);
      let kind = 2;
      if (cel.kind === "linked") {
        kind = 1;
      } else if (cel.kind === "tilemap") {
        kind = 3;
      }
      fields.u16(kind).u16(cel.zIndex).raw(new Uint8Array(5));
      if (cel.kind === "linked") {
        fields.u16(cel.frame);
      } else if (cel.kind === "raster") {
        fields.u16(cel.width).u16(cel.height).raw(await compressPayload(cel.indexes));
      } else {
        fields.u16(cel.columns).u16(cel.rows).u16(cel.bits).u32(cel.idMask).u32(cel.flipXMask).u32(cel.flipYMask).u32(cel.diagonalMask).raw(new Uint8Array(10));
        const bytes2 = new Uint8Array(cel.cells.length * (cel.bits / 8)), words = new DataView(bytes2.buffer);
        for (let cell = 0; cell < cel.cells.length; cell++) {
          if (cel.bits === 8) {
            bytes2[cell] = cel.cells[cell];
          } else if (cel.bits === 16) {
            words.setUint16(cell * 2, cel.cells[cell], true);
          } else {
            words.setUint32(cell * 4, cel.cells[cell], true);
          }
        }
        fields.raw(await compressPayload(bytes2));
      }
      chunks.push(chunk(8197, fields.build()));
      if (cel.userData !== void 0) {
        chunks.push(userDataChunk(cel.userData));
      }
    }
    integer(chunks.length, "Frame chunks", 0, ASSET_LIMITS.chunks);
    const payload = new Fields();
    for (const bytes2 of chunks) {
      payload.raw(bytes2);
    }
    const bytes = payload.build();
    allFrames.push(
      new Fields().u32(bytes.length + 16).u16(61946).u16(Math.min(chunks.length, 65535)).u16(frame.durationMs).u16(0).u32(chunks.length).raw(bytes).build()
    );
  }
  const frames = new Fields();
  for (const bytes of allFrames) {
    frames.raw(bytes);
  }
  const framePayload = frames.build(), header = new Uint8Array(128), view = new DataView(header.buffer);
  view.setUint32(0, framePayload.length + 128, true);
  view.setUint16(4, 42464, true);
  view.setUint16(6, document2.frames.length, true);
  view.setUint16(8, document2.width, true);
  view.setUint16(10, document2.height, true);
  view.setUint16(12, 8, true);
  view.setUint32(14, hasUuid ? 5 : 1, true);
  view.setUint16(18, document2.frames[0].durationMs, true);
  header[28] = document2.transparentIndex;
  view.setUint16(32, document2.palette.length, true);
  header[34] = 1;
  header[35] = 1;
  return new Fields().raw(header).raw(framePayload).build();
}
function decodeAsepriteDocumentSync(bytes) {
  const parser = parseAsepriteDocument(bytes);
  let step = parser.next();
  while (!step.done) {
    step = parser.next(rasterZlibSync(step.value.bytes, step.value.expected));
  }
  return step.value;
}

// packages/assets/src/indexed-ownership.ts
function identity(id2) {
  if (typeof id2 !== "string" || id2.length < 1 || new TextEncoder().encode(id2).length > 1024) {
    throw new Error("Invalid indexed ownership identity.");
  }
}
function nativeOffset(view, offset) {
  const x = offset % view.width;
  const y = Math.floor(offset / view.width);
  const nx = view.flipX ? view.width - 1 - x : x;
  const ny = view.flipY ? view.height - 1 - y : y;
  return ny * view.width + nx;
}
function nativeSlot(view, slot, owner) {
  const mapped = view.indexMap.at(slot);
  if (mapped === void 0 || mapped === null || !owner.allowedIndexes.includes(mapped)) {
    throw new Error(`View ${view.id}: unmapped or forbidden display slot ${slot}.`);
  }
  return mapped;
}
function validateIndexedOwnership(snapshot) {
  integer(snapshot.owners.length, "Owner count", 1, ASSET_LIMITS.owners);
  integer(snapshot.views.length, "View count", 1, ASSET_LIMITS.owners);
  const owners = /* @__PURE__ */ new Map();
  let bytes = 0;
  for (const owner of snapshot.owners) {
    identity(owner.id);
    if (owners.has(owner.id)) {
      throw new Error(`Duplicate owner ${owner.id}.`);
    }
    validateIndexedPixels(owner);
    if (owner.editable !== void 0 && typeof owner.editable !== "boolean") {
      throw new Error(`Owner ${owner.id}: invalid edit authority.`);
    }
    bytes = boundedSum(bytes, owner.indexes.length, ASSET_LIMITS.decodedBytes, "Ownership payload");
    integer(owner.allowedIndexes.length, "Allowed slot count", 1, 256);
    const allowed = new Set(owner.allowedIndexes);
    if (allowed.size !== owner.allowedIndexes.length) {
      throw new Error(`Owner ${owner.id}: duplicate allowed slot.`);
    }
    for (const slot of allowed) {
      integer(slot, "Native slot", 0, 255);
    }
    if (owner.indexes.some((slot) => !allowed.has(slot))) {
      throw new Error(`Owner ${owner.id}: forbidden baseline slot.`);
    }
    owners.set(owner.id, owner);
  }
  const ids = /* @__PURE__ */ new Set();
  for (const view of snapshot.views) {
    identity(view.id);
    if (ids.has(view.id)) {
      throw new Error(`Duplicate view ${view.id}.`);
    }
    ids.add(view.id);
    const owner = owners.get(view.owner);
    validateIndexedPixels(view);
    bytes = boundedSum(bytes, view.indexes.length, ASSET_LIMITS.decodedBytes, "Ownership payload");
    if (!owner || owner.width !== view.width || owner.height !== view.height) {
      throw new Error(`View ${view.id}: missing owner or incompatible dimensions.`);
    }
    for (const flag of [view.flipX, view.flipY]) {
      if (flag !== void 0 && typeof flag !== "boolean") {
        throw new Error(`View ${view.id}: invalid reflection.`);
      }
    }
    integer(view.indexMap.length, "Display slot map", 1, 256);
    for (const slot of view.indexMap) {
      if (slot !== null) {
        integer(slot, "Mapped native slot", 0, 255);
      }
    }
    for (let i = 0; i < view.indexes.length; i++) {
      if (nativeSlot(view, view.indexes[i], owner) !== owner.indexes[nativeOffset(view, i)]) {
        throw new Error(`View ${view.id}: inconsistent private baseline.`);
      }
    }
  }
}
function reconcileIndexedViews(snapshot, candidates) {
  validateIndexedOwnership(snapshot);
  if (candidates.length !== snapshot.views.length) {
    throw new Error("Indexed view inventory changed.");
  }
  const views = new Map(snapshot.views.map((view) => [view.id, view]));
  const owners = new Map(snapshot.owners.map((owner) => [owner.id, owner]));
  const seen = /* @__PURE__ */ new Set();
  const changes = /* @__PURE__ */ new Map();
  let candidateBytes = 0;
  let proposalBytes = 0;
  candidates.forEach((candidate, viewIndex) => {
    const view = views.get(candidate.id);
    if (!view || seen.has(candidate.id)) {
      throw new Error(`Missing, unknown or duplicate view ${candidate.id}.`);
    }
    seen.add(candidate.id);
    validateIndexedPixels(candidate);
    candidateBytes = boundedSum(
      candidateBytes,
      candidate.indexes.length,
      ASSET_LIMITS.decodedBytes,
      "Candidate payload"
    );
    if (candidate.width !== view.width || candidate.height !== view.height) {
      throw new Error(`View ${view.id}: dimensions changed.`);
    }
    const owner = owners.get(view.owner);
    for (let offset = 0; offset < candidate.indexes.length; offset++) {
      const slot = candidate.indexes[offset];
      const proposed = nativeSlot(view, slot, owner);
      if (slot === view.indexes[offset]) {
        continue;
      }
      if (owner.editable === false) {
        throw new Error(`Owner ${owner.id}: artwork is read-only.`);
      }
      const native = nativeOffset(view, offset);
      if (proposed === owner.indexes[native]) {
        throw new Error(
          `View ${view.id}: changed slot aliases the unchanged native pixel ${native}.`
        );
      }
      let change = changes.get(owner.id);
      if (!change) {
        proposalBytes = boundedSum(
          proposalBytes,
          owner.indexes.length * 5,
          ASSET_LIMITS.decodedBytes,
          "Native proposal payload"
        );
        change = {
          indexes: owner.indexes.slice(),
          contributors: new Uint32Array(owner.indexes.length)
        };
        changes.set(owner.id, change);
      }
      const contributor = change.contributors[native];
      if (contributor && change.indexes[native] !== proposed) {
        throw new Error(
          `Owner ${owner.id} pixel ${native}: conflicting views ${candidates[contributor - 1].id} and ${view.id}.`
        );
      }
      change.indexes[native] = proposed;
      change.contributors[native] = viewIndex + 1;
    }
  });
  return snapshot.owners.flatMap((owner) => {
    const change = changes.get(owner.id);
    return change ? [{ owner: owner.id, indexes: change.indexes }] : [];
  });
}

// packages/assets/src/interchange.ts
var VIEW = "uttori-view:";
var ROLE = "uttori-role:";
var SET = "uttori-tileset:";
var TAG = "uttori-timeline:";
var interchangeIdentity = Object.freeze({
  view: (identity2) => VIEW + identity2,
  role: (identity2) => ROLE + identity2,
  tileset: (identity2) => SET + identity2,
  timeline: (identity2) => TAG + identity2
});
function id(value, prefix) {
  if (!value?.startsWith(prefix) || value.length <= prefix.length || value.length > 1024 + prefix.length) {
    throw new Error(`Missing or invalid interchange identity ${prefix}.`);
  }
  return value.slice(prefix.length);
}
function inventory(document2) {
  const sets = /* @__PURE__ */ new Map(), setIds = /* @__PURE__ */ new Map(), views = /* @__PURE__ */ new Map(), tileIds = /* @__PURE__ */ new Map();
  const seenSets = /* @__PURE__ */ new Set();
  let bytes = 0;
  for (const set of document2.tilesets) {
    const setId = id(set.userData, SET);
    if (seenSets.has(setId)) {
      throw new Error(`Duplicate tileset identity ${setId}.`);
    }
    seenSets.add(setId);
    sets.set(set.id, set);
    setIds.set(set.id, setId);
    const ids = [], area = set.tileWidth * set.tileHeight;
    for (let tile = 0; tile < set.tileCount; tile++) {
      if (set.flags & 4 && tile === 0) {
        if (set.tileData[tile]?.startsWith(VIEW) || set.indexes.subarray(0, area).some((slot) => slot !== document2.transparentIndex)) {
          throw new Error("Interchange empty tile acquired native identity or artwork.");
        }
        ids.push(null);
        continue;
      }
      const viewId = id(set.tileData[tile], VIEW);
      if (views.has(viewId)) {
        throw new Error(`Duplicate view identity ${viewId}.`);
      }
      ids.push(viewId);
      bytes = boundedSum(bytes, area, ASSET_LIMITS.decodedBytes, "Interchange view pixels");
      views.set(viewId, {
        id: viewId,
        width: set.tileWidth,
        height: set.tileHeight,
        indexes: set.indexes.slice(tile * area, (tile + 1) * area)
      });
    }
    tileIds.set(set.id, ids);
  }
  return { sets, setIds, views, tileIds };
}
function roles(document2) {
  const result = /* @__PURE__ */ new Map();
  document2.layers.forEach((layer, index) => {
    const role = id(layer.userData, ROLE);
    if (result.has(role)) {
      throw new Error(`Duplicate role identity ${role}.`);
    }
    result.set(role, index);
  });
  return result;
}
function cellValue(payload, set, ids, offset, transforms) {
  const word = payload.cells[offset];
  if (!(set.flags & 4) && word === 4294967295) {
    return null;
  }
  const view = ids.at((word & payload.idMask) >>> 0);
  if (view === null) {
    return null;
  }
  if (view === void 0) {
    throw new Error("Interchange occurrence has no known view.");
  }
  for (const [name, mask] of [
    ["flipX", payload.flipXMask],
    ["flipY", payload.flipYMask],
    ["diagonal", payload.diagonalMask]
  ]) {
    if (word & mask && !transforms.includes(name)) {
      throw new Error(`View ${view}: unsupported native transform ${name}.`);
    }
  }
  return JSON.stringify([
    view,
    !!(word & payload.flipXMask),
    !!(word & payload.flipYMask),
    !!(word & payload.diagonalMask)
  ]);
}
function compareTilemap(beforeCel, before, oldSet, oldIds, afterCel, after, newSet, newIds, transforms) {
  if (oldSet.tileWidth !== newSet.tileWidth || oldSet.tileHeight !== newSet.tileHeight || before && before.kind !== "tilemap" || after && after.kind !== "tilemap") {
    throw new Error("Interchange tile dimensions or occurrence kind changed.");
  }
  const oldMap = before?.kind === "tilemap" ? before : void 0, newMap = after?.kind === "tilemap" ? after : void 0;
  const at = (cel, map, set, ids, x, y) => {
    if (!cel || !map) {
      return null;
    }
    const column = (x - cel.x) / set.tileWidth, row = (y - cel.y) / set.tileHeight;
    if (!Number.isInteger(column) || !Number.isInteger(row) || column < 0 || row < 0 || column >= map.columns || row >= map.rows) {
      return null;
    }
    return cellValue(map, set, ids, row * map.columns + column, transforms);
  };
  const compare = (cel, map, set, ids, otherCel, otherMap, otherSet, otherIds) => {
    if (!cel || !map) {
      return;
    }
    for (let offset = 0; offset < map.cells.length; offset++) {
      const value = cellValue(map, set, ids, offset, transforms);
      if (value === null) {
        continue;
      }
      const x = cel.x + offset % map.columns * set.tileWidth, y = cel.y + Math.floor(offset / map.columns) * set.tileHeight;
      if (value !== at(otherCel, otherMap, otherSet, otherIds, x, y)) {
        throw new Error("Read-only interchange tile references, offsets or flips changed.");
      }
    }
  };
  compare(beforeCel, oldMap, oldSet, oldIds, afterCel, newMap, newSet, newIds);
  compare(afterCel, newMap, newSet, newIds, beforeCel, oldMap, oldSet, oldIds);
}
function compareRaster(beforeCel, before, afterCel, after, transparent) {
  if (before && before.kind !== "raster" || after && after.kind !== "raster") {
    throw new Error("Read-only raster occurrence kind changed.");
  }
  const oldRaster = before?.kind === "raster" ? before : void 0, newRaster = after?.kind === "raster" ? after : void 0;
  const compare = (cel, image, otherCel, other) => {
    if (!cel || !image) {
      return;
    }
    for (let offset = 0; offset < image.indexes.length; offset++) {
      const slot = image.indexes[offset];
      if (slot === transparent) {
        continue;
      }
      const x = cel.x + offset % image.width, y = cel.y + Math.floor(offset / image.width);
      const ox = x - (otherCel?.x ?? 0), oy = y - (otherCel?.y ?? 0);
      if (!other || !otherCel || ox < 0 || oy < 0 || ox >= other.width || oy >= other.height || other.indexes[oy * other.width + ox] !== slot) {
        throw new Error("Read-only derived raster preview pixels or geometry changed.");
      }
    }
  };
  compare(beforeCel, oldRaster, afterCel, newRaster);
  compare(afterCel, newRaster, beforeCel, oldRaster);
}
var timelineTags = (document2) => document2.tags.map(
  (tag) => JSON.stringify([id(tag.userData, TAG), tag.from, tag.to, tag.direction, tag.repeat])
).toSorted();
function inspectTilemapInterchange(baseline, after) {
  const before = baseline.document;
  validateAsepriteDocument(before);
  validateAsepriteDocument(after);
  validateIndexedOwnership(baseline.ownership);
  if (before.width !== after.width || before.height !== after.height || before.transparentIndex !== after.transparentIndex || before.frames.length !== after.frames.length || before.exportId !== after.exportId) {
    throw new Error("Interchange canvas, transparency, timeline or export identity changed.");
  }
  const oldInventory = inventory(before), newInventory = inventory(after), oldRoles = roles(before), newRoles = roles(after);
  if (oldInventory.views.size !== baseline.ownership.views.length || newInventory.views.size !== oldInventory.views.size || newInventory.sets.size !== oldInventory.sets.size || oldRoles.size !== newRoles.size) {
    throw new Error("Interchange owner, view, tileset or role inventory changed.");
  }
  for (const view of baseline.ownership.views) {
    const exported = oldInventory.views.get(view.id);
    if (!exported || exported.width !== view.width || exported.height !== view.height || exported.indexes.some((slot, i) => slot !== view.indexes[i]) || !newInventory.views.has(view.id)) {
      throw new Error(`Inconsistent private export or missing view ${view.id}.`);
    }
  }
  const oldResolved = resolveAsepriteCels(before), newResolved = resolveAsepriteCels(after);
  for (let frame = 0; frame < before.frames.length; frame++) {
    if (before.frames[frame].durationMs !== after.frames[frame].durationMs) {
      throw new Error("Read-only preview timing changed.");
    }
    const oldCels = new Map(before.frames[frame].cels.map((cel) => [cel.layer, cel])), newCels = new Map(after.frames[frame].cels.map((cel) => [cel.layer, cel]));
    for (const [role, oldIndex] of oldRoles) {
      const newIndex = newRoles.get(role);
      if (newIndex === void 0) {
        throw new Error(`Missing interchange role ${role}.`);
      }
      const oldLayer = before.layers[oldIndex], newLayer = after.layers[newIndex];
      const oldCel = oldCels.get(oldIndex), newCel = newCels.get(newIndex);
      if (oldLayer.kind !== newLayer.kind) {
        throw new Error(`Read-only role ${role} kind changed.`);
      }
      if (oldLayer.kind === "tilemap" && newLayer.kind === "tilemap") {
        if (oldInventory.setIds.get(oldLayer.tileset) !== newInventory.setIds.get(newLayer.tileset)) {
          throw new Error(`Role ${role}: tileset binding changed.`);
        }
        compareTilemap(
          oldCel,
          oldCel && oldResolved.get(oldCel),
          oldInventory.sets.get(oldLayer.tileset),
          oldInventory.tileIds.get(oldLayer.tileset),
          newCel,
          newCel && newResolved.get(newCel),
          newInventory.sets.get(newLayer.tileset),
          newInventory.tileIds.get(newLayer.tileset),
          baseline.nativeTransforms
        );
      } else {
        compareRaster(
          oldCel,
          oldCel && oldResolved.get(oldCel),
          newCel,
          newCel && newResolved.get(newCel),
          before.transparentIndex
        );
      }
    }
    const order = (document2, resolved) => document2.frames[frame].cels.filter((cel) => {
      const payload = resolved.get(cel);
      if (payload.kind === "raster") {
        return payload.indexes.some((slot) => slot !== document2.transparentIndex);
      }
      const layer = document2.layers[cel.layer];
      if (layer.kind !== "tilemap") {
        throw new Error("Invalid tilemap layer binding.");
      }
      const source = document2 === before ? oldInventory : newInventory;
      const set = source.sets.get(layer.tileset), ids = source.tileIds.get(layer.tileset);
      return payload.cells.some(
        (_, offset) => cellValue(payload, set, ids, offset, baseline.nativeTransforms) !== null
      );
    }).toSorted((a, b) => a.layer + a.zIndex - (b.layer + b.zIndex) || a.zIndex - b.zIndex).map((cel) => id(document2.layers[cel.layer].userData, ROLE));
    if (JSON.stringify(order(before, oldResolved)) !== JSON.stringify(order(after, newResolved))) {
      throw new Error("Read-only interchange stacking changed.");
    }
  }
  if (JSON.stringify(timelineTags(before)) !== JSON.stringify(timelineTags(after))) {
    throw new Error("Read-only interchange timeline membership changed.");
  }
  const pixels = reconcileIndexedViews(baseline.ownership, [...newInventory.views.values()]);
  const colors = indexedPaletteChanges(
    before.palette,
    after.palette,
    baseline.editablePaletteSlots
  );
  if (!baseline.capabilities.pixelEdits && pixels.length || !baseline.capabilities.paletteEdits && colors.length) {
    throw new Error("Interchange edit exceeds exported capabilities.");
  }
  return { pixels, colors };
}

// packages/assets/src/source-binding.ts
function sourceResourcePath(value) {
  if (typeof value !== "string" || !value || value.length > 1024 || /[\0:\\]/.test(value) || value.startsWith("/")) {
    throw new Error("Source binding requires a portable relative resource path.");
  }
  return value;
}
function isSourceBinding(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid asset source binding.");
  }
  const binding = value;
  if (binding.format !== "uttori-asset-source" || binding.version !== 1 || typeof binding.id !== "string" || !/^[\da-f-]{36}$/.test(binding.id) || typeof binding.adapter !== "string" || !binding.adapter || !binding.source || typeof binding.source.representation !== "string" || !binding.resources || typeof binding.resources !== "object" || Array.isArray(binding.resources) || !Array.isArray(binding.native) || !binding.native.length || binding.native.length > 1024) {
    throw new Error("Unsupported or incomplete asset source binding.");
  }
  sourceResourcePath(binding.source.path);
  for (const resource of Object.values(binding.resources)) {
    sourceResourcePath(resource);
  }
  const declarations = binding.native;
  for (const declaration of declarations) {
    if (!declaration || typeof declaration !== "object" || Array.isArray(declaration)) {
      throw new Error("Invalid native declaration in asset source binding.");
    }
    const native = Object.fromEntries(Object.entries(declaration));
    if (typeof native.format !== "string" || !native.format || !native.options || typeof native.options !== "object" || Array.isArray(native.options)) {
      throw new Error("Invalid native declaration in asset source binding.");
    }
  }
  return true;
}
function readAssetSourceBinding(bytes) {
  if (bytes.length > ASSET_LIMITS.metadataBytes) {
    throw new Error("Asset source binding exceeds its metadata budget.");
  }
  const value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  if (!isSourceBinding(value)) {
    throw new Error("Invalid asset source binding.");
  }
  return value;
}
function bindingResourceKey(binding, resource) {
  return `${binding}#${resource}`;
}

// packages/assets/src/presentation-layout.ts
function planIndexedPresentation(nativeWidth, nativeHeight, tileWidth, tileHeight, views) {
  rasterArea(nativeWidth, nativeHeight, "Native presentation", ASSET_LIMITS.interchangeSide);
  rasterArea(tileWidth, tileHeight, "Inventory tile", ASSET_LIMITS.interchangeSide);
  integer(views, "Inventory views", 1, ASSET_LIMITS.owners);
  const pageTiles = Math.min(
    views,
    Math.floor(ASSET_LIMITS.rasterPixels / (tileWidth * tileHeight))
  );
  const desiredColumns = Math.min(
    Math.floor(ASSET_LIMITS.interchangeSide / tileWidth),
    Math.ceil(Math.sqrt(pageTiles * tileHeight / tileWidth))
  );
  const maximumWidth = Math.min(
    ASSET_LIMITS.interchangeSide,
    Math.floor(ASSET_LIMITS.rasterPixels / Math.max(nativeHeight, tileHeight))
  );
  const width = Math.max(nativeWidth, Math.min(desiredColumns * tileWidth, maximumWidth)), columns = Math.floor(width / tileWidth);
  const maximumHeight = Math.min(
    ASSET_LIMITS.interchangeSide,
    Math.floor(ASSET_LIMITS.rasterPixels / width)
  );
  const height = Math.max(
    nativeHeight,
    Math.min(Math.ceil(pageTiles / columns) * tileHeight, maximumHeight)
  );
  rasterArea(width, height, "Indexed presentation", ASSET_LIMITS.interchangeSide);
  const rows2 = Math.floor(height / tileHeight);
  const capacity = boundedProduct(columns, rows2, ASSET_LIMITS.references, "Inventory page cells");
  if (!capacity) {
    throw new Error("Native presentation leaves no complete inventory tile capacity.");
  }
  const pages = Math.ceil(views / capacity);
  integer(pages, "Inventory pages", 1, ASSET_LIMITS.frames);
  return { width, height, columns, rows: rows2, capacity, pages };
}

// packages/assets/src/raster-interchange.ts
function rasterInterchangeDocument(atlas) {
  validateAtlasDocument(atlas);
  return {
    width: atlas.width,
    height: atlas.height,
    palette: atlas.palette,
    transparentIndex: atlas.transparentIndex,
    exportId: atlas.exportId,
    layers: [{ kind: "raster", flags: 3, name: "Native views \u2014 fixed raster inventory" }],
    tilesets: [],
    tags: [],
    frames: [
      {
        durationMs: 100,
        cels: [
          {
            kind: "raster",
            layer: 0,
            x: 0,
            y: 0,
            zIndex: 0,
            width: atlas.width,
            height: atlas.height,
            indexes: Uint8Array.from(atlas.indexes)
          }
        ]
      }
    ]
  };
}
function rasterInterchangeAtlas(document2) {
  validateAsepriteDocument(document2);
  if (document2.frames.length !== 1 || document2.layers.length !== 1 || document2.layers[0].kind !== "raster" || !(document2.layers[0].flags & 1) || document2.tilesets.length || document2.tags.length) {
    throw new Error("Raster interchange requires one visible raster layer and one fixed frame.");
  }
  const cels = document2.frames[0].cels;
  if (cels.length > 1 || cels.some((cel) => cel.kind !== "raster" || cel.zIndex !== 0)) {
    throw new Error("Raster interchange does not support linked cels or additional composition.");
  }
  const indexes = new Uint8Array(document2.width * document2.height).fill(document2.transparentIndex);
  for (const cel of cels) {
    if (cel.kind !== "raster") {
      throw new Error("Invalid raster cel.");
    }
    if (cel.x < 0 || cel.y < 0 || cel.x + cel.width > document2.width || cel.y + cel.height > document2.height) {
      throw new Error("Raster cel exceeds the fixed inventory canvas.");
    }
    for (let y = 0; y < cel.height; y++) {
      indexes.set(
        cel.indexes.subarray(y * cel.width, (y + 1) * cel.width),
        (y + cel.y) * document2.width + cel.x
      );
    }
  }
  const result = {
    width: document2.width,
    height: document2.height,
    indexes,
    palette: document2.palette,
    transparentIndex: document2.transparentIndex,
    exportId: document2.exportId
  };
  validateAtlasDocument(result);
  return result;
}

// packages/assets/src/source-codecs.ts
var AssetSourceCodecRegistry = class {
  #codecs = /* @__PURE__ */ new Map();
  #revision = 0;
  /** Changes invalidate adapter caches when newly registered probes alter content discovery. */
  get revision() {
    return this.#revision;
  }
  /** Register one codec; ambiguous extensions reject registration. */
  register(codec) {
    if (!codec.id || this.#codecs.has(codec.id) || typeof codec.matches !== "function" || typeof codec.decode !== "function" || typeof codec.encode !== "function" || typeof codec.embeddedIdentity !== "boolean" || !Number.isSafeInteger(codec.version) || codec.version < 1 || !/^[\w+.-]+\/[\w+.-]+$/.test(codec.mediaType) || !codec.extensions.length || codec.extensions.some((extension) => !/^\.[\d.a-z-]+$/i.test(extension))) {
      throw new Error(`Invalid or duplicate source codec '${codec.id}'.`);
    }
    const extensions = codec.extensions.map((extension) => extension.toLowerCase());
    if (new Set(extensions).size !== extensions.length) {
      throw new Error(`Duplicate source extension for '${codec.id}'.`);
    }
    for (const existing of this.#codecs.values()) {
      if (existing.extensions.some((extension) => extensions.includes(extension))) {
        throw new Error(`Ambiguous source extension for '${codec.id}'.`);
      }
    }
    this.#codecs.set(
      codec.id,
      Object.freeze({
        id: codec.id,
        version: codec.version,
        mediaType: codec.mediaType,
        embeddedIdentity: codec.embeddedIdentity,
        extensions: Object.freeze(extensions),
        matches: codec.matches.bind(codec),
        decode: codec.decode.bind(codec),
        encode: codec.encode.bind(codec)
      })
    );
    this.#revision++;
    return this;
  }
  /** Resolve a registered codec by id. */
  get(id2) {
    const codec = this.#codecs.get(id2);
    if (!codec) {
      throw new Error(`Unsupported asset source representation '${id2}'.`);
    }
    return codec;
  }
  /** Content establishes representation; the filename and declared media type must agree when supplied. */
  identify(bytes, hints = {}) {
    const candidates = [...this.#codecs.values()].filter((codec2) => codec2.matches(bytes));
    if (candidates.length !== 1) {
      throw new Error(`Unrecognized or ambiguous asset source content: ${hints.path ?? "input"}.`);
    }
    const codec = candidates[0];
    if (hints.path && !codec.extensions.some((extension) => hints.path.toLowerCase().endsWith(extension)) || hints.mediaType && hints.mediaType !== codec.mediaType) {
      throw new Error(
        `Asset source extension/content mismatch: ${hints.path ?? hints.mediaType}; content is ${codec.id}.`
      );
    }
    return codec;
  }
  /** Discovery feeds editor menus without hard-coding the set of representations into the host. */
  representations() {
    return [...this.#codecs.values()].map(({ id: id2, mediaType, extensions }) => ({
      id: id2,
      mediaType,
      extensions
    }));
  }
};
var indexedPngSourceCodec = {
  id: "indexed-png",
  version: 1,
  mediaType: "image/png",
  extensions: [".png"],
  embeddedIdentity: false,
  matches: (bytes) => [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte),
  decode(bytes, reference2) {
    const image = indexedAtlasDocument(
      pngImporter.import({ bytes, mediaType: "image/png" }).value,
      reference2?.transparentIndex ?? 0
    );
    return rasterInterchangeDocument({ ...image, exportId: reference2?.exportId });
  },
  encode: (document2) => createIndexedPng(rasterInterchangeAtlas(document2))
};
var asepriteSourceCodec = {
  id: "aseprite",
  version: 1,
  mediaType: "image/x-aseprite",
  extensions: [".aseprite", ".ase"],
  embeddedIdentity: true,
  matches: (bytes) => bytes.length >= 128 && bytes[4] === 224 && bytes[5] === 165,
  decode: decodeAsepriteDocumentSync,
  encode: encodeAsepriteDocument
};
function indexedSourceCodecs() {
  return new AssetSourceCodecRegistry().register(indexedPngSourceCodec).register(asepriteSourceCodec);
}
var asepriteRasterImporter = {
  id: "uttori.import.aseprite-raster",
  version: "1.0.0",
  mediaTypes: ["image/x-aseprite"],
  import(input2) {
    const codec = indexedSourceCodecs().identify(input2.bytes, { mediaType: input2.mediaType });
    const document2 = decodeAsepriteDocumentSync(input2.bytes);
    if (codec.id !== "aseprite") {
      throw new Error("Invalid Aseprite raster source.");
    }
    const atlas = rasterInterchangeAtlas(document2);
    const value = {
      kind: "indexed-image",
      sourceBitDepth: 8,
      width: atlas.width,
      height: atlas.height,
      indexes: atlas.indexes,
      palette: atlas.palette
    };
    return { kind: value.kind, value };
  }
};

// packages/assets/src/registry.ts
var AssetRegistry = class {
  #importers = /* @__PURE__ */ new Map();
  #encoders = /* @__PURE__ */ new Map();
  #mediaTypes = /* @__PURE__ */ new Map();
  /**
   * Register an importer and claim its media types.
   * @param importer Importer with a namespaced unused ID, a version, and unclaimed media types.
   * @returns This registry for chaining.
   */
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
  /** Register one encoder; duplicate ids reject registration. */
  registerEncoder(encoder) {
    if (!isNamespacedId(encoder.id) || !encoder.version || !encoder.primaryOutput || encoder.inputKinds.length === 0 || this.#encoders.has(encoder.id)) {
      throw new Error(`Invalid or duplicate asset encoder '${encoder.id}'.`);
    }
    this.#encoders.set(encoder.id, encoder);
    return this;
  }
  /** Resolve the importer registered for a MIME type. */
  importerFor(mediaType) {
    const importer = this.#mediaTypes.get(mediaType);
    if (!importer) {
      throw new Error(`No asset importer for '${mediaType}'.`);
    }
    return importer;
  }
  /** Resolve a registered encoder by id. */
  encoderFor(id2) {
    const encoder = this.#encoders.get(id2);
    if (!encoder) {
      throw new Error(`No asset encoder '${id2}'.`);
    }
    return encoder;
  }
};
function convertAsset(registry4, request) {
  const importer = registry4.importerFor(request.source.mediaType);
  const encoder = registry4.encoderFor(request.format);
  const source = { ...request.source, bytes: request.source.bytes.slice() };
  const resources = Object.fromEntries(
    Object.entries(request.resources ?? {}).map(([name, input2]) => [
      name,
      { ...input2, bytes: input2.bytes.slice() }
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

// packages/assets/src/secret-of-mana/som-boss-graphics.ts
function expandBossGraphics(source, size) {
  validateSize(source, size);
  return expandBossMask(source, Math.ceil(size / 8) * 8);
}
function validateSize(source, size) {
  if (!(source instanceof Uint8Array) || !Number.isInteger(size) || size <= 0 || size > 65535) {
    throw new Error("Boss graphics need bytes and a positive 16-bit output size.");
  }
}
function expandBossMask(source, size) {
  if (size !== 65536) {
    validateSize(source, size);
  } else if (!(source instanceof Uint8Array)) {
    throw new Error("Boss mask source requires bytes.");
  }
  const data = new Uint8Array(size);
  let cursor = 0;
  for (let output = 0; output < size; ) {
    if (cursor >= source.length) {
      throw new Error("Truncated boss graphics mask.");
    }
    const mask = source[cursor++];
    for (let bit = 7; bit >= 0 && output < size; bit--, output++) {
      if (mask & 1 << bit) {
        if (cursor >= source.length) {
          throw new Error("Truncated boss graphics literal.");
        }
        data[output] = source[cursor++];
      } else if (output >= 2) {
        data[output] = data[output - 2];
      }
    }
  }
  return { data, consumed: cursor };
}
function encodeBossGraphics(data) {
  if (!(data instanceof Uint8Array) || !data.length || data.length % 8) {
    throw new Error("Boss graphics need a positive multiple-of-eight byte count.");
  }
  return encodeBossMask(data);
}
function encodeBossMask(data) {
  if (!(data instanceof Uint8Array) || !data.length || data.length > 65536) {
    throw new Error("Boss mask needs 1..65536 bytes.");
  }
  const output = [];
  for (let start = 0; start < data.length; start += 8) {
    let mask = 0;
    const literals = [];
    for (let bit = 0; bit < 8 && start + bit < data.length; bit++) {
      const index = start + bit;
      const previous = index >= 2 ? data[index - 2] : 0;
      if (data[index] !== previous) {
        mask |= 1 << 7 - bit;
        literals.push(data[index]);
      }
    }
    output.push(mask, ...literals);
  }
  const encoded = Uint8Array.from(output);
  const decoded2 = expandBossMask(encoded, data.length);
  if (decoded2.consumed !== encoded.length || decoded2.data.some((byte, index) => byte !== data[index])) {
    throw new Error("Boss graphics mask inverse failed.");
  }
  return encoded;
}

// packages/assets/src/secret-of-mana/som-lz.ts
var LZ_HEADER_BYTES = 4;
var LZ_COPY_FLAG = 128;
var LZ_TOKEN_PAYLOAD_MASK = LZ_COPY_FLAG - 1;
var LZ_MIN_COPY_BYTES = 3;
var LZ_MAX_LITERAL_BYTES = LZ_COPY_FLAG;
var LZ_DISTANCE_LOW_VALUES = 256;
var LZ_MAX_OUTPUT_BYTES = 65535;
var MATCH_CANDIDATE_LIMIT = 128;
var DISTANCE_MASKS = [31, 15, 7, 3, 1, 0];
function decompressSomLz(source, offset = 0, maxOutputBytes = LZ_MAX_OUTPUT_BYTES) {
  invariant(source instanceof Uint8Array, "Expected byte input.");
  invariant(
    Number.isSafeInteger(offset) && offset >= 0 && offset + LZ_HEADER_BYTES <= source.length,
    "Truncated LZ header."
  );
  invariant(Number.isSafeInteger(maxOutputBytes) && maxOutputBytes >= 0, "Invalid LZ output limit.");
  const mode = source[offset];
  invariant(mode < DISTANCE_MASKS.length, "Invalid LZ mode.");
  const mask = DISTANCE_MASKS[mode];
  const size = source[offset + 2] << 8 | source[offset + 3];
  invariant(size <= maxOutputBytes, "LZ decoded size exceeds output limit.");
  const data = new Uint8Array(size);
  let cursor = offset + LZ_HEADER_BYTES;
  let written = 0;
  let literalRuns = 0;
  let copyRuns = 0;
  while (written < size) {
    invariant(cursor < source.length, "Truncated LZ token.");
    const token = source[cursor++];
    if (token < LZ_COPY_FLAG) {
      const length = token + 1;
      invariant(cursor + length <= source.length, "Truncated LZ literal.");
      invariant(written + length <= size, "LZ literal exceeds declared output size.");
      data.set(source.subarray(cursor, cursor + length), written);
      cursor += length;
      written += length;
      literalRuns++;
    } else {
      invariant(cursor < source.length, "Truncated LZ distance.");
      const distance = ((token & mask) << 8) + source[cursor++] + 1;
      const length = Math.floor((token & LZ_TOKEN_PAYLOAD_MASK) / (mask + 1)) + LZ_MIN_COPY_BYTES;
      invariant(distance <= written, "LZ reference precedes output.");
      invariant(written + length <= size, "LZ copy exceeds declared output size.");
      for (let i = 0; i < length; i++) {
        data[written] = data[written - distance];
        written++;
      }
      copyRuns++;
    }
  }
  return {
    data,
    mode,
    unusedHeaderByte: source[offset + 1],
    compressedBytes: cursor - offset,
    end: cursor,
    literalRuns,
    copyRuns
  };
}
function assertLzOptions(options) {
  invariant(options && typeof options === "object" && !Array.isArray(options), "Invalid LZ options.");
}
function compressSomLz(source, options = {}) {
  invariant(source instanceof Uint8Array, "Expected byte input.");
  invariant(source.length <= LZ_MAX_OUTPUT_BYTES, "LZ decoded size exceeds 16-bit header.");
  assertLzOptions(options);
  invariant(
    Object.keys(options).every((key) => ["mode", "unusedHeaderByte"].includes(key)),
    "Unknown LZ option."
  );
  const selected = options.mode ?? "auto";
  const header = options.unusedHeaderByte ?? 0;
  if (selected !== "auto" && !(typeof selected === "number" && Number.isInteger(selected) && selected >= 0 && selected < DISTANCE_MASKS.length)) {
    invariant(false, "Invalid LZ mode.");
  }
  if (typeof header !== "number" || !Number.isInteger(header) || header < 0 || header > 255) {
    invariant(false, "Invalid unused LZ header byte.");
  }
  const mode = selected === "auto" ? "auto" : selected;
  const unusedHeaderByte = header;
  const modes = mode === "auto" ? DISTANCE_MASKS.map((_, index) => index) : [mode];
  let best;
  for (const selectedMode of modes) {
    const encoded = encodeMode(source, selectedMode, unusedHeaderByte);
    if (!best || encoded.length < best.length) {
      best = encoded;
    }
  }
  invariant(best, "LZ encoder produced no candidate.");
  return best;
}
function encodeMode(source, mode, unusedHeaderByte) {
  const mask = DISTANCE_MASKS[mode];
  const maxDistance = (mask + 1) * LZ_DISTANCE_LOW_VALUES;
  const maxLength = Math.floor(LZ_TOKEN_PAYLOAD_MASK / (mask + 1)) + LZ_MIN_COPY_BYTES;
  const seen = /* @__PURE__ */ new Map();
  const matches = Array.from({ length: source.length }, () => new Uint16Array(maxLength + 1));
  const add = (position) => {
    if (position + 2 >= source.length) {
      return;
    }
    const key = source[position] << 16 | source[position + 1] << 8 | source[position + 2];
    const positions = seen.get(key) ?? [];
    positions.push(position);
    while (positions.length > MATCH_CANDIDATE_LIMIT || positions.length && position - positions[0] >= maxDistance) {
      positions.shift();
    }
    seen.set(key, positions);
  };
  for (let cursor = 0; cursor < source.length; cursor++) {
    if (cursor + 2 < source.length) {
      const key = source[cursor] << 16 | source[cursor + 1] << 8 | source[cursor + 2];
      const positions = seen.get(key) ?? [];
      for (let index = positions.length - 1; index >= 0; index--) {
        const candidateDistance = cursor - positions[index];
        if (candidateDistance > maxDistance) {
          break;
        }
        let candidateLength = LZ_MIN_COPY_BYTES;
        while (candidateLength < maxLength && cursor + candidateLength < source.length && source[cursor + candidateLength] === source[cursor + candidateLength - candidateDistance]) {
          candidateLength++;
        }
        for (let length = LZ_MIN_COPY_BYTES; length <= candidateLength; length++) {
          if (matches[cursor][length] === 0 || candidateDistance < matches[cursor][length]) {
            matches[cursor][length] = candidateDistance;
          }
        }
      }
    }
    add(cursor);
  }
  const cost = new Uint32Array(source.length + 1);
  const choice = new Int16Array(source.length);
  const distance = new Uint16Array(source.length);
  for (let cursor = source.length - 1; cursor >= 0; cursor--) {
    let bestCost = Number.MAX_SAFE_INTEGER;
    let bestChoice = 0;
    for (let length = 1; length <= LZ_MAX_LITERAL_BYTES && cursor + length <= source.length; length++) {
      const candidate = 1 + length + cost[cursor + length];
      if (candidate < bestCost || candidate === bestCost && length > bestChoice) {
        bestCost = candidate;
        bestChoice = length;
      }
    }
    for (let length = LZ_MIN_COPY_BYTES; length <= maxLength && cursor + length <= source.length; length++) {
      const matchDistance = matches[cursor][length];
      if (!matchDistance) {
        continue;
      }
      const candidate = 2 + cost[cursor + length];
      if (candidate < bestCost || candidate === bestCost && length > Math.abs(bestChoice)) {
        bestCost = candidate;
        bestChoice = -length;
        distance[cursor] = matchDistance;
      }
    }
    cost[cursor] = bestCost;
    choice[cursor] = bestChoice;
  }
  const output = [mode, unusedHeaderByte, source.length >>> 8, source.length & 255];
  for (let cursor = 0; cursor < source.length; ) {
    const length = choice[cursor];
    if (length > 0) {
      output.push(length - 1, ...source.subarray(cursor, cursor + length));
      cursor += length;
    } else {
      const runLength = -length;
      const encodedDistance = distance[cursor] - 1;
      output.push(
        LZ_COPY_FLAG | (runLength - LZ_MIN_COPY_BYTES) * (mask + 1) | encodedDistance >>> 8,
        encodedDistance & 255
      );
      cursor += runLength;
    }
  }
  return Uint8Array.from(output);
}

// packages/assets/src/secret-of-mana/som-boss-image.ts
var registry = new AssetRegistry().registerImporter(pngImporter);
for (const encoder of withImageEncoders(snesNativeEncoders)) {
  registry.registerEncoder(encoder);
}
function nativeBossChunk(png, wanted = "soMz") {
  const image = readAssetPng(png);
  let native;
  for (const { type, data } of image.chunks) {
    if (type === wanted) {
      if (native) {
        throw new Error("Duplicate native boss graphics PNG chunk.");
      }
      native = Uint8Array.from(data);
    }
  }
  return native;
}
function decodeBossStream(native, storage, size) {
  let intermediate = native;
  let mode;
  let unusedHeaderByte;
  if (storage === "lz-rle") {
    const decoded2 = decompressSomLz(native);
    if (decoded2.compressedBytes !== native.length) {
      throw new Error("Boss LZ stream has trailing bytes.");
    }
    intermediate = decoded2.data;
    mode = decoded2.mode;
    unusedHeaderByte = decoded2.unusedHeaderByte;
  }
  const expanded = expandBossGraphics(intermediate, size);
  if (expanded.consumed !== intermediate.length) {
    throw new Error("Boss mask stream has trailing bytes.");
  }
  return { bytes: expanded.data, mode, unusedHeaderByte };
}
function convertBossImage(source, options, resources = {}, normalized) {
  const { storage, byteLength, sizePolicy = "fixed", mode, unusedHeaderByte = 0 } = options;
  if (storage !== "lz-rle" && storage !== "rle") {
    throw new Error("Boss storage must be lz-rle or rle.");
  }
  if (typeof byteLength !== "number" || !Number.isSafeInteger(byteLength) || byteLength < 1) {
    throw new Error("Boss byteLength must be a positive integer.");
  }
  if (sizePolicy !== "fixed" && sizePolicy !== "encoded") {
    throw new Error("Boss sizePolicy must be fixed or encoded.");
  }
  const layout2 = normalized?.layout ?? (options.layout ? readFrameLayout(options, resources) : void 0);
  const catalog = normalized?.catalog ?? (options.layout ? readSpritePaletteCatalog(options, resources) : void 0);
  let pixels;
  let segmentName;
  if (layout2) {
    if (typeof options.segment !== "string") {
      throw new Error("Frame atlas segment is required.");
    }
    segmentName = options.segment;
    pixels = encodeFrameAtlas(source, layout2, segmentName, catalog);
  } else {
    pixels = convertAsset(registry, { source, format: "snes.tile.4bpp" }).outputs.tiles.bytes;
  }
  const segmentIndex = segmentName ? Object.keys(layout2?.segments ?? {}).indexOf(segmentName) : -1;
  if (segmentIndex > 25) {
    throw new Error("Boss atlas supports at most 26 native segments.");
  }
  const chunkName = segmentIndex < 0 ? "soMz" : `soM${String.fromCharCode(65 + segmentIndex)}`;
  let original;
  if (options.native !== void 0) {
    if (typeof options.native !== "string" || !options.native) {
      throw new Error("Boss native data requires an explicit original compressed resource.");
    }
    const nativeResource = Object.hasOwn(resources, options.native) ? resources[options.native] : void 0;
    if (!nativeResource) {
      throw new Error("Boss native data requires an explicit original compressed resource.");
    }
    original = nativeResource.bytes;
  } else {
    original = nativeBossChunk(source.bytes, chunkName);
  }
  if (original) {
    if (original.length !== byteLength) {
      throw new Error("Boss native data has the wrong byte length.");
    }
    const decoded2 = decodeBossStream(original, storage, pixels.length);
    if (decoded2.bytes.every((byte, index) => byte === pixels[index])) {
      return { primaryOutput: "graphics", outputs: { graphics: { bytes: original } } };
    }
  }
  const intermediate = encodeBossGraphics(pixels);
  let encoded = intermediate;
  if (storage === "lz-rle") {
    const selectedMode = original ? original[0] : mode;
    const selectedHeaderByte = original ? original[1] : unusedHeaderByte;
    encoded = compressSomLz(intermediate, {
      mode: selectedMode,
      unusedHeaderByte: selectedHeaderByte
    });
  }
  if (sizePolicy === "fixed" && encoded.length > byteLength) {
    throw new Error(
      "Edited boss graphics exceed their fixed ROM span; use sizePolicy: encoded with a declared relocatable object."
    );
  }
  const verified = decodeBossStream(encoded, storage, pixels.length).bytes;
  if (verified.some((byte, index) => byte !== pixels[index])) {
    throw new Error("Boss graphics inverse failed.");
  }
  if (sizePolicy === "encoded") {
    return { primaryOutput: "graphics", outputs: { graphics: { bytes: encoded } } };
  }
  const padded = new Uint8Array(byteLength);
  padded.set(encoded);
  if (original) {
    padded.set(original.subarray(encoded.length), encoded.length);
  }
  return { primaryOutput: "graphics", outputs: { graphics: { bytes: padded } } };
}

// packages/assets/src/secret-of-mana/som-palette-edit.ts
function nativeBytes(atlas, source, catalog, segment) {
  const options = atlas.nativeOptions?.[segment];
  if (!options) {
    return void 0;
  }
  const layoutName = typeof options.layout === "string" ? options.layout : "layout.json";
  const paletteName = typeof options.palettes === "string" ? options.palettes : "palettes.json";
  const result = convertBossImage(
    source,
    { ...options, segment, layout: layoutName, palettes: paletteName },
    {
      ...atlas.resources,
      [layoutName]: {
        bytes: new TextEncoder().encode(JSON.stringify(atlas.layout)),
        mediaType: "application/json"
      },
      [paletteName]: {
        bytes: new TextEncoder().encode(JSON.stringify(catalog)),
        mediaType: "application/json"
      }
    }
  );
  return result.outputs.graphics.bytes;
}
function frameAtlasPreservedChunks(atlas, catalog) {
  const bytes = atlas.source.bytes;
  inspectFrameAtlas(atlas.source, atlas.layout, catalog, { whole: true });
  const image = readAssetPng(bytes);
  const names = [];
  for (const { type: name } of image.chunks) {
    if (/^soM[A-Z]$/.test(name)) {
      const segment = Object.keys(atlas.layout.segments)[name.charCodeAt(3) - 65];
      if (!segment || !atlas.nativeOptions?.[segment]) {
        throw new Error(`Missing native storage declaration for ${atlas.id}/${name}.`);
      }
      nativeBytes(atlas, atlas.source, catalog, segment);
      names.push(name);
    }
  }
  return names;
}
function planSpritePaletteWords(catalog, edits) {
  validateSpritePaletteAliases(catalog);
  const next = structuredClone(catalog);
  const changed = /* @__PURE__ */ new Set();
  const slots = /* @__PURE__ */ new Set();
  for (const edit of edits) {
    spritePaletteBytes(catalog, edit.palette);
    const record = next.palettes[edit.palette];
    const offset = edit.index - record.firstIndex;
    if (!Number.isSafeInteger(edit.index) || offset < 0 || offset >= record.words.length || !Array.isArray(edit.rgb) || edit.rgb.length !== 3) {
      throw new Error(`Invalid palette slot ${edit.palette}:${edit.index}.`);
    }
    const address = Number.parseInt(record.romAddress, 16) + offset * 2;
    if (slots.has(address)) {
      throw new Error(`Duplicate palette edit ${edit.palette}:${edit.index}.`);
    }
    slots.add(address);
    const channels = edit.rgb.map((color) => {
      if (!Number.isInteger(color) || color < 0 || color > 255) {
        throw new Error("Palette edits require RGB8.");
      }
      const value = color >>> 3;
      if ((value << 3 | value >>> 2) !== color) {
        throw new Error(`RGB channel ${color} is not exactly BGR555 representable.`);
      }
      return value;
    });
    const highBit = Number.parseInt(record.words[offset], 16) & 32768;
    const word = (highBit + channels[0] + (channels[1] << 5) + (channels[2] << 10)).toString(16).toUpperCase().padStart(4, "0");
    if (record.words[offset].toUpperCase() !== word) {
      for (const [id2, alias] of Object.entries(next.palettes)) {
        const index = (address - Number.parseInt(alias.romAddress, 16)) / 2;
        if (Number.isInteger(index) && index >= 0 && index < alias.words.length) {
          alias.words[index] = word;
          changed.add(id2);
        }
      }
    }
  }
  return { catalog: next, palettes: [...changed] };
}

// packages/assets/src/secret-of-mana/som-frame-edit.ts
function renderStableFrameAtlas(tiles, layout2) {
  const sources = /* @__PURE__ */ new Map();
  const placements = [];
  for (const [name, segment] of Object.entries(layout2.segments)) {
    const native = tiles.get(name);
    if (native?.length !== segment.tiles.length) {
      throw new Error(`Missing native tiles: ${name}.`);
    }
    native.forEach((tile, index) => {
      const source = JSON.stringify([name, index]);
      const tileSlot = index >= 0 && index < segment.tiles.length ? segment.tiles[index] : void 0;
      if (!tileSlot) {
        throw new Error(`Missing native tiles: ${name}.`);
      }
      sources.set(source, tile);
      placements.push({
        id: `strip:${source}`,
        source,
        ...tileSlot,
        transparentIndex: null,
        indexMap: Array.from({ length: 16 }, (_, i) => i === 0 ? 0 : segment.palette * 16 + i)
      });
    });
  }
  for (const frame of layout2.frames ?? []) {
    const native = validateFrameComposition(layout2, frame) ?? [];
    const origin = frame.origin;
    if (!origin) {
      throw new Error(`Retained composition required: ${frame.id}.`);
    }
    for (const p of native) {
      if (p.external) {
        continue;
      }
      const segment = typeof p.segment === "string" && Object.hasOwn(layout2.segments, p.segment) ? layout2.segments[p.segment] : void 0;
      if (!segment) {
        throw new Error(`Unknown tile reference in ${frame.id}:${p.id}.`);
      }
      placements.push({
        id: JSON.stringify([frame.id, p.id]),
        source: JSON.stringify([p.segment, p.tile]),
        x: origin[0] + p.x,
        y: origin[1] + p.y,
        flipX: p.flipX,
        flipY: p.flipY,
        // Display colors can vary without changing the one native tile source.
        indexMap: Array.from(
          { length: 16 },
          (_, i) => (p.paletteGroup ?? frame.paletteGroup ?? segment.palette) * 16 + i
        )
      });
    }
  }
  return renderIndexedPlacements(sources, placements, {
    x: 0,
    y: 0,
    width: layout2.width,
    height: layout2.height
  });
}

// packages/assets/src/secret-of-mana/som-atlas-interchange.ts
function ownerId(segment, tile) {
  return JSON.stringify([segment, tile]);
}
function createSomAtlasExport(atlas, catalog, exportId) {
  if (atlas.layout.tileSources !== "native-strip") {
    throw new Error("Atlas interchange requires explicitly declared native-strip pixel ownership.");
  }
  const inspected = inspectFrameAtlas(atlas.source, atlas.layout, catalog, { whole: true });
  const document2 = { ...inspected.image, transparentIndex: 0, exportId };
  const owners = Object.entries(atlas.layout.segments).flatMap(([name, segment]) => {
    const indexMap = Array.from({ length: 256 }, () => null);
    for (let slot = 0; slot < 16; slot++) {
      indexMap[segment.palette * 16 + slot] = slot;
    }
    indexMap[0] = 0;
    return segment.tiles.map((tile, index) => ({
      ...tile,
      id: ownerId(name, index),
      width: 8,
      height: 8,
      indexMap
    }));
  });
  const editablePaletteSlots = atlas.layout.paletteRefs.flatMap((id2, bank) => {
    const stored = catalog.palettes[id2];
    return stored.words.flatMap((_, index) => {
      const slot = stored.firstIndex + index;
      return slot > 0 && slot < 16 ? [bank * 16 + slot] : [];
    });
  });
  const policy = { owners, editablePaletteSlots };
  inspectAtlasChanges(document2, document2, policy);
  return { document: document2, policy };
}
function planSomAtlasImport(atlas, catalog, changes) {
  const before = inspectFrameAtlas(atlas.source, atlas.layout, catalog, { whole: true });
  const definitions = createSomAtlasExport(atlas, catalog, "00000000-0000-0000-0000-000000000000");
  const tiles = new Map(
    [...before.tiles].map(([name, values]) => [
      name,
      values.map((tile) => ({ ...tile, indexes: tile.indexes.slice() }))
    ])
  );
  const seen = /* @__PURE__ */ new Set();
  for (const change of changes.pixels) {
    if (seen.has(change.owner)) {
      throw new Error("Duplicate SoM tile delta.");
    }
    seen.add(change.owner);
    const owner = definitions.policy.owners.find((entry) => entry.id === change.owner);
    if (!owner || change.indexes.length !== 64 || change.indexes.some((index) => index > 15)) {
      throw new Error("Invalid SoM native tile delta.");
    }
    for (const [name, values] of tiles) {
      const tile = values.findIndex((_, index) => ownerId(name, index) === change.owner);
      if (tile !== -1) {
        values[tile] = { ...values[tile], indexes: change.indexes.slice() };
      }
    }
  }
  const palettePlan = planSpritePaletteWords(
    catalog,
    changes.colors.map(({ index, color }) => {
      if (!definitions.policy.editablePaletteSlots.includes(index)) {
        throw new Error("Unsupported SoM palette slot delta.");
      }
      return {
        palette: atlas.layout.paletteRefs[Math.floor(index / 16)],
        index: index % 16,
        rgb: color.slice(0, 3)
      };
    })
  );
  const changed = changes.pixels.length > 0 || palettePlan.palettes.length > 0;
  let layout2 = structuredClone(atlas.layout);
  let png = Uint8Array.from(atlas.source.bytes);
  if (changed) {
    layout2 = bindFrameAtlasPalette(atlas.source, atlas.layout, catalog);
  }
  if (changes.pixels.length) {
    const oldRender = renderStableFrameAtlas(before.tiles, layout2);
    const newRender = renderStableFrameAtlas(tiles, layout2);
    const indexes = before.image.indexes.slice();
    for (let index = 0; index < indexes.length; index++) {
      if (oldRender.indexes[index] !== newRender.indexes[index]) {
        indexes[index] = newRender.indexes[index];
      }
    }
    png = rewriteIndexedPng(atlas.source.bytes, {
      indexes,
      preserveChunks: frameAtlasPreservedChunks(atlas, catalog)
    });
  }
  inspectFrameAtlas({ bytes: png, mediaType: "image/png" }, layout2, palettePlan.catalog, {
    whole: true
  });
  const palette = layout2.paletteRefs.flatMap((id2) => spritePaletteColors(palettePlan.catalog, id2));
  return { png, layout: layout2, catalog: palettePlan.catalog, palettes: palettePlan.palettes, palette };
}

// packages/assets/src/tilemap-presentation.ts
function tilemapPresentationCel(layer, x, y, columns, rows2, cells) {
  return {
    kind: "tilemap",
    layer,
    x,
    y,
    zIndex: 0,
    columns,
    rows: rows2,
    cells,
    bits: 32,
    idMask: 536870911,
    flipXMask: 2147483648,
    flipYMask: 1073741824,
    diagonalMask: 536870912
  };
}
function createTilemapInventory(ownership, nativeWidth, nativeHeight, name) {
  validateIndexedOwnership(ownership);
  const { views } = ownership, first = views.at(0);
  if (!first || views.some((view) => view.width !== first.width || view.height !== first.height)) {
    throw new Error("A shared tileset inventory requires uniform view geometry.");
  }
  const area = first.width * first.height, layout2 = planIndexedPresentation(
    nativeWidth,
    nativeHeight,
    first.width,
    first.height,
    views.length
  ), strip = new Uint8Array(
    boundedProduct(views.length + 1, area, ASSET_LIMITS.decodedBytes, "Inventory tile pixels")
  ), owners = new Map(ownership.owners.map((owner) => [owner.id, owner])), readonlyViews = views.map((view) => owners.get(view.owner)?.editable === false);
  views.forEach((view, index) => strip.set(view.indexes, (index + 1) * area));
  const layers = [
    {
      kind: "tilemap",
      flags: 3,
      tileset: 0,
      name: "Tiles \u2014 edit pixels in Manual mode",
      userData: interchangeIdentity.role("inventory")
    }
  ];
  if (readonlyViews.some(Boolean)) {
    layers.push({
      kind: "tilemap",
      flags: 1,
      tileset: 0,
      name: "Tiles (read-only: native inverse unproven)",
      userData: interchangeIdentity.role("inventory-readonly")
    });
  }
  const frames = [], tags = [];
  for (let page = 0; page < layout2.pages; page++) {
    const count = Math.min(layout2.capacity, views.length - page * layout2.capacity), rows2 = Math.ceil(count / layout2.columns), cels = [];
    for (let layer = 0; layer < layers.length; layer++) {
      const cells = new Uint32Array(layout2.columns * rows2);
      for (let index = 0; index < count; index++) {
        const view = page * layout2.capacity + index;
        if (readonlyViews[view] === (layer === 1)) {
          cells[index] = view + 1;
        }
      }
      cels.push(tilemapPresentationCel(layer, 0, 0, layout2.columns, rows2, cells));
    }
    frames.push({ durationMs: 100, cels });
    tags.push({
      name: `Tiles ${page + 1} (presentation)`,
      from: page,
      to: page,
      direction: 0,
      repeat: 1,
      userData: interchangeIdentity.timeline(`inventory:${page}`)
    });
  }
  return {
    width: layout2.width,
    height: layout2.height,
    layers,
    frames,
    tags,
    tileset: {
      id: 0,
      flags: 30,
      name,
      baseIndex: 0,
      tileWidth: first.width,
      tileHeight: first.height,
      tileCount: views.length + 1,
      indexes: strip,
      userData: interchangeIdentity.tileset("native-views"),
      tileData: [void 0, ...views.map((view) => interchangeIdentity.view(view.id))]
    }
  };
}

// packages/assets/src/secret-of-mana/som-sprite-interchange.ts
var X = 2147483648;
var Y = 1073741824;
function createSomSpriteInterchange(atlas, catalog, exportId, runs = []) {
  if (atlas.layout.tileSources !== "native-strip") {
    throw new Error("Sprite interchange requires declared native-strip ownership.");
  }
  const inspected = inspectFrameAtlas(atlas.source, atlas.layout, catalog, { whole: true });
  const paletteIds = [
    .../* @__PURE__ */ new Set([
      ...atlas.layout.paletteRefs,
      ...(atlas.layout.paletteVariants ?? []).map((variant) => variant.palette)
    ])
  ];
  if (paletteIds.length > 16) {
    throw new Error("Sprite palette views exceed indexed document slots.");
  }
  const palette = paletteIds.flatMap((name) => spritePaletteColors(catalog, name));
  const paletteSlots = paletteIds.flatMap(
    (name) => Array.from({ length: 16 }, (_, index) => ({ palette: name, index }))
  );
  const editablePaletteSlots = paletteSlots.flatMap((slot, index) => {
    const stored = catalog.palettes[slot.palette];
    return slot.index > 0 && slot.index >= stored.firstIndex && slot.index < stored.firstIndex + stored.words.length ? [index] : [];
  });
  const owners = [], views = [], references = /* @__PURE__ */ new Map();
  const nativeSlots = Array.from({ length: 16 }, (_, slot) => slot), maps = /* @__PURE__ */ new Map();
  for (const [segmentName, tiles] of inspected.tiles) {
    const segment = atlas.layout.segments[segmentName], primary = atlas.layout.paletteRefs[segment.palette];
    const variants = [
      .../* @__PURE__ */ new Set([
        primary,
        ...(atlas.layout.paletteVariants ?? []).filter((variant) => variant.group === segment.palette).map((variant) => variant.palette)
      ])
    ];
    tiles.forEach((tile, index) => {
      const owner = JSON.stringify([segmentName, index]);
      owners.push({
        ...tile,
        indexes: Uint8Array.from(tile.indexes),
        id: owner,
        allowedIndexes: nativeSlots
      });
      for (const name of variants) {
        const bank = paletteIds.indexOf(name), id2 = JSON.stringify([owner, name]), cached = maps.get(bank);
        let indexMap = cached;
        if (!indexMap) {
          const slots = Array(256).fill(null);
          for (let slot = 1; slot < 16; slot++) {
            slots[bank * 16 + slot] = slot;
          }
          slots[0] = 0;
          maps.set(bank, slots);
          indexMap = slots;
        }
        views.push({
          id: id2,
          owner,
          width: 8,
          height: 8,
          indexes: Uint8Array.from(tile.indexes, (slot) => slot === 0 ? 0 : bank * 16 + slot),
          indexMap
        });
        if (name === primary) {
          references.set(owner, views.length);
        }
      }
    });
  }
  boundedSum(0, owners.length, ASSET_LIMITS.owners, "Sprite native owners");
  const poses = (atlas.layout.frames ?? []).map((frame) => {
    const placements = validateFrameComposition(atlas.layout, frame);
    if (!placements) {
      throw new Error(`Pose ${frame.id}: retained native composition is required.`);
    }
    return { frame, placements };
  });
  let minX = 0, minY = 0, maxX = 8, maxY = 8, blocks = 0;
  for (const pose of poses) {
    blocks = Math.max(blocks, pose.frame.blocks?.length ?? 0);
    for (const placement of pose.placements) {
      minX = Math.min(minX, placement.x);
      minY = Math.min(minY, placement.y);
      maxX = Math.max(maxX, placement.x + 8);
      maxY = Math.max(maxY, placement.y + 8);
    }
  }
  for (const run of runs) {
    for (const observed of run.frames) {
      const pose = poses.find((entry) => String(entry.frame.id) === observed.pose);
      if (!pose) {
        throw new Error(`Sequence ${run.sequence}: unknown pose ${observed.pose}.`);
      }
      for (const placement of pose.placements) {
        minX = Math.min(minX, placement.x + run.pivot.x);
        minY = Math.min(minY, placement.y + run.pivot.y);
        maxX = Math.max(maxX, placement.x + run.pivot.x + 8);
        maxY = Math.max(maxY, placement.y + run.pivot.y + 8);
      }
    }
  }
  const displayOrigin = { x: -minX, y: -minY };
  const inventory2 = createTilemapInventory(
    { owners, views },
    maxX - minX,
    maxY - minY,
    `${atlas.id} native views`
  );
  const { width, height, layers, frames, tags } = inventory2;
  rasterArea(width, height, "Sprite presentation", ASSET_LIMITS.interchangeSide);
  for (let index = 0; index < blocks; index++) {
    layers.push({
      kind: "tilemap",
      flags: 3,
      name: `Part ${index + 1}`,
      tileset: 0,
      userData: interchangeIdentity.role(`part-${index}`)
    });
  }
  const poseFrames = /* @__PURE__ */ new Map();
  for (const { frame, placements } of poses) {
    const key = String(frame.id);
    if (poseFrames.has(key)) {
      throw new Error(`Duplicate sprite pose ${key}.`);
    }
    const cels = [];
    (frame.blocks ?? []).forEach((block, index2) => {
      const members = placements.filter((placement) => placement.block === block.id), columns = block.size / 8;
      const values = new Uint32Array(columns * columns);
      for (const placement of members) {
        if (placement.external) {
          continue;
        }
        const reference2 = references.get(JSON.stringify([placement.segment, placement.tile]));
        if (!reference2) {
          throw new Error(`Pose ${key}: unknown native view ${placement.id}.`);
        }
        const x = (placement.x - block.x) / 8, y = (placement.y - block.y) / 8;
        if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= columns || y >= columns) {
          throw new Error(`Pose ${key}: block grid phase changed.`);
        }
        values[y * columns + x] = (reference2 | (placement.flipX ? X : 0) | (placement.flipY ? Y : 0)) >>> 0;
      }
      cels.push(
        tilemapPresentationCel(
          index2 + 1,
          block.x + displayOrigin.x,
          block.y + displayOrigin.y,
          columns,
          columns,
          values
        )
      );
    });
    const index = frames.length;
    poseFrames.set(key, index);
    frames.push({ durationMs: 100, cels });
    tags.push({
      name: `Pose ${key} (presentation)`,
      from: index,
      to: index,
      direction: 0,
      repeat: 1,
      userData: interchangeIdentity.timeline(`pose:${key}`)
    });
  }
  for (const run of runs) {
    const start = frames.length;
    for (const observed of run.frames) {
      const target = poseFrames.get(observed.pose);
      if (target === void 0) {
        throw new Error(`Sequence ${run.sequence}: unknown pose ${observed.pose}.`);
      }
      const cels = frames[target].cels.map((cel) => ({
        kind: "linked",
        layer: cel.layer,
        x: cel.x + run.pivot.x,
        y: cel.y + run.pivot.y,
        zIndex: cel.zIndex,
        frame: target
      }));
      frames.push({ durationMs: observed.durationMs, cels });
    }
    if (frames.length === start) {
      continue;
    }
    tags.push({
      name: `${run.sequence} (${run.provenance.kind})`,
      from: start,
      to: frames.length - 1,
      direction: 0,
      repeat: 1,
      userData: interchangeIdentity.timeline(run.id)
    });
  }
  const baseline = {
    kind: "tilemap",
    ownership: { owners, views },
    editablePaletteSlots,
    nativeTransforms: ["flipX", "flipY"],
    capabilities: {
      pixelEdits: true,
      paletteEdits: true,
      tileReferences: true,
      previewTimeline: true
    },
    document: {
      width,
      height,
      palette,
      transparentIndex: 0,
      exportId,
      layers,
      frames,
      tags,
      tilesets: [inventory2.tileset]
    }
  };
  inspectTilemapInterchange(baseline, baseline.document);
  return { baseline, paletteSlots, displayOrigin };
}

// packages/assets/src/secret-of-mana/som-source.ts
function isSourceNames(value) {
  return Array.isArray(value) && value.every((name) => typeof name === "string" && !!name);
}
function bindingNames(options) {
  const result = [];
  if (options.sourceBinding !== void 0) {
    if (typeof options.sourceBinding !== "string" || !options.sourceBinding) {
      throw new Error("sourceBinding must name an authoring sidecar.");
    }
    result.push(options.sourceBinding);
  }
  if (options.paletteSources !== void 0) {
    if (!isSourceNames(options.paletteSources)) {
      throw new Error("paletteSources must be an array of authoring sidecar paths.");
    }
    result.push(...options.paletteSources);
  }
  return [...new Set(result)];
}
function somSourceDependencies(_source, options, resources, codecs = indexedSourceCodecs()) {
  return bindingNames(options).flatMap((name) => {
    const requests = [{ key: name, path: name }];
    if (!Object.hasOwn(resources, name)) {
      return requests;
    }
    const binding = readAssetSourceBinding(resources[name].bytes);
    for (const [key, path] of Object.entries(binding.resources)) {
      requests.push({ key: bindingResourceKey(name, key), path, relativeTo: name });
    }
    if (name !== options.sourceBinding) {
      requests.push({
        key: bindingResourceKey(name, "source"),
        path: binding.source.path,
        relativeTo: name,
        mediaType: codecs.get(binding.source.representation).mediaType
      });
    }
    return requests;
  });
}
function input(resources, key) {
  if (!Object.hasOwn(resources, key)) {
    throw new Error(`Missing authoring resource '${key}'.`);
  }
  return resources[key];
}
function somPngPaletteViews(atlas, catalog) {
  const raster = createSomAtlasExport(atlas, catalog, atlas.id);
  const primarySlots = atlas.layout.paletteRefs.flatMap(
    (palette2) => Array.from({ length: 16 }, (_, index) => ({ palette: palette2, index }))
  );
  const slots = [...primarySlots];
  while (slots.length < raster.document.palette.length) {
    slots.push(null);
  }
  const palette = [...raster.document.palette];
  const editable = [...raster.policy.editablePaletteSlots];
  const variants = [
    ...new Set((atlas.layout.paletteVariants ?? []).map((variant) => variant.palette))
  ].filter((id2) => !atlas.layout.paletteRefs.includes(id2));
  for (const id2 of variants) {
    const first = palette.length;
    palette.push(...spritePaletteColors(catalog, id2));
    const record = catalog.palettes[id2];
    for (let index = 0; index < 16; index++) {
      slots.push({ palette: id2, index });
      if (index > 0 && index >= record.firstIndex && index < record.firstIndex + record.words.length) {
        editable.push(first + index);
      }
    }
  }
  if (palette.length > 256) {
    throw new Error(
      "PNG source requires more than 256 declared palette slots; choose a representation with sufficient palette capacity."
    );
  }
  return {
    document: { ...raster.document, palette },
    policy: { ...raster.policy, editablePaletteSlots: editable },
    slots
  };
}
function inspectBoundSourceUncached(name, source, resources, codecs) {
  const binding = readAssetSourceBinding(input(resources, name).bytes);
  if (binding.adapter !== "som.sprite.native") {
    throw new Error(`Unsupported source adapter '${binding.adapter}'.`);
  }
  const reference2 = input(resources, bindingResourceKey(name, "reference"));
  const layoutInput = input(resources, bindingResourceKey(name, "layout"));
  const catalog = parseSpritePaletteCatalog(
    input(resources, bindingResourceKey(name, "palettes")).bytes
  );
  const layout2 = readFrameLayout({ layout: "layout.json" }, { "layout.json": layoutInput });
  const nativeOptions = Object.fromEntries(
    binding.native.flatMap((entry) => {
      if (entry.format !== "som.boss.graphics") {
        return [];
      }
      const segment = entry.options.segment;
      if (typeof segment !== "string" || !Object.hasOwn(layout2.segments, segment)) {
        throw new Error("Source binding has an unknown native segment.");
      }
      return [[segment, entry.options]];
    })
  );
  const nativeResources = {};
  for (const entry of binding.native) {
    if (typeof entry.options.native === "string" && Object.hasOwn(binding.resources, entry.options.native)) {
      nativeResources[entry.options.native] = input(
        resources,
        bindingResourceKey(name, entry.options.native)
      );
    }
  }
  const atlas = {
    id: binding.id,
    source: reference2,
    layout: layout2,
    nativeOptions,
    resources: nativeResources
  };
  const presentation = createSomSpriteInterchange(atlas, catalog, binding.id);
  const codec = codecs.identify(source.bytes, { mediaType: source.mediaType });
  if (codec.id !== binding.source.representation) {
    throw new Error(`Source ${binding.source.path}: representation disagrees with its binding.`);
  }
  const document2 = codec.decode(source.bytes, presentation.baseline.document);
  let changes;
  let slots = presentation.paletteSlots;
  if (document2.tilesets.length) {
    changes = inspectTilemapInterchange(presentation.baseline, document2);
  } else {
    const raster = somPngPaletteViews(atlas, catalog);
    const image = indexedAtlasDocument(pngImporter.import(source).value, 0);
    if (codec.id !== "indexed-png") {
      throw new Error("Sprite authoring requires its complete identified tilemap inventory.");
    }
    const owned = new Uint8Array(image.indexes.length);
    for (const owner of raster.policy.owners) {
      for (let y = 0; y < owner.height; y++) {
        owned.fill(
          1,
          (owner.y + y) * image.width + owner.x,
          (owner.y + y) * image.width + owner.x + owner.width
        );
      }
    }
    const nativeIndexes = image.indexes.map(
      (slot, index) => owned[index] ? slot : raster.document.indexes[index]
    );
    changes = inspectAtlasChanges(
      raster.document,
      { ...image, indexes: nativeIndexes, exportId: binding.id },
      raster.policy
    );
    const canonical = planSomAtlasImport(atlas, catalog, { pixels: changes.pixels, colors: [] });
    const expected = indexedAtlasDocument(
      pngImporter.import({ bytes: canonical.png, mediaType: "image/png" }).value,
      0
    );
    if (image.indexes.some(
      (slot, index) => !owned[index] && slot !== raster.document.indexes[index] && slot !== expected.indexes[index]
    )) {
      throw new Error(
        "Read-only PNG guides or composition pixels changed outside native ownership."
      );
    }
    slots = raster.slots;
  }
  return { binding, atlas, catalog, changes, slots };
}
var inspectionCaches = /* @__PURE__ */ new WeakMap();
function inspectBoundSource(name, source, resources, codecs) {
  const bindingBytes = input(resources, name).bytes;
  const binding = readAssetSourceBinding(bindingBytes);
  const snapshots = [
    bindingBytes,
    source.bytes,
    ...Object.keys(binding.resources).toSorted().map((key) => input(resources, bindingResourceKey(name, key)).bytes)
  ];
  const cache = inspectionCaches.get(codecs) ?? [];
  const found = cache.find(
    (entry) => entry.revision === codecs.revision && entry.mediaType === source.mediaType && entry.snapshots.length === snapshots.length && entry.snapshots.every(
      (before, index) => before.length === snapshots[index].length && before.every((byte, offset) => byte === snapshots[index][offset])
    )
  );
  if (found) {
    return found.value;
  }
  let value;
  try {
    value = inspectBoundSourceUncached(name, source, resources, codecs);
  } catch (error) {
    throw new Error(
      `Source '${binding.source.path}': ${error instanceof Error ? error.message : String(error)}`,
      { cause: error }
    );
  }
  const bytes = snapshots.reduce((total, item) => total + item.length, 0);
  if (bytes <= 8 * 1024 * 1024) {
    cache.unshift({
      snapshots: snapshots.map((item) => item.slice()),
      mediaType: source.mediaType,
      revision: codecs.revision,
      value
    });
    cache.splice(4);
    inspectionCaches.set(codecs, cache);
  }
  return value;
}
function effectiveSomSourcePalette(catalog, options, resources, ownSource, codecs = indexedSourceCodecs()) {
  const edits = /* @__PURE__ */ new Map();
  for (const name of bindingNames(options)) {
    let source;
    if (name === options.sourceBinding && ownSource) {
      source = ownSource;
    } else {
      source = input(resources, bindingResourceKey(name, "source"));
    }
    const inspected = inspectBoundSource(name, source, resources, codecs);
    for (const change of inspected.changes.colors) {
      const slot = inspected.slots[change.index];
      if (!slot) {
        throw new Error(
          `Source ${inspected.binding.source.path}: read-only palette guide changed.`
        );
      }
      if (!Object.hasOwn(catalog.palettes, slot.palette)) {
        throw new Error(`Source ${inspected.binding.id}: missing palette owner ${slot.palette}.`);
      }
      const record = catalog.palettes[slot.palette];
      const address = Number.parseInt(record.romAddress, 16) + (slot.index - record.firstIndex) * 2;
      const rgb = change.color.slice(0, 3);
      const previous = edits.get(address);
      if (previous && previous.rgb.some((channel, index) => channel !== rgb[index])) {
        throw new Error(
          `Conflicting authored palette values at $${address.toString(16)} (${slot.palette}:${slot.index}).`
        );
      }
      edits.set(address, { ...slot, rgb });
    }
  }
  return planSpritePaletteWords(catalog, [...edits.values()]).catalog;
}
function normalizeSomSource(source, options, resources, catalog, codecs = indexedSourceCodecs()) {
  const effective = effectiveSomSourcePalette(catalog, options, resources, source, codecs);
  if (typeof options.sourceBinding !== "string") {
    if (source.mediaType !== "image/png") {
      throw new Error(
        "Composed sprite sources require an explicit sourceBinding created by source conversion."
      );
    }
    const layout3 = bindFrameAtlasPalette(source, readFrameLayout(options, resources), catalog);
    return { source, layout: layout3, catalog: effective };
  }
  const inspected = inspectBoundSource(options.sourceBinding, source, resources, codecs);
  const reconstructed = planSomAtlasImport(inspected.atlas, inspected.catalog, {
    pixels: inspected.changes.pixels,
    colors: []
  });
  const layout2 = bindFrameAtlasPalette(
    inspected.atlas.source,
    reconstructed.layout,
    inspected.catalog
  );
  return {
    source: { bytes: reconstructed.png, mediaType: "image/png" },
    layout: layout2,
    catalog: effective
  };
}

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
function parseExpressionNode(input2, source) {
  return parseExpressionAtSite(input2, "public", source);
}
function parseExpressionAtSite(input2, site, source) {
  return parseExpressionResult(input2, site, source).node;
}
function parseExpressionResult(input2, site = "public", source) {
  const result = parseExpressionInput(input2, site, source);
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
function parseExpressionInput(input2, site, source) {
  const trimmed = input2.trim();
  if (source) {
    source = { ...source, offset: source.offset + input2.length - input2.trimStart().length };
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
function findTopLevelRange(input2) {
  let depth = 0;
  let bracketDepth = 0;
  let quote = "";
  for (let i = 0; i < input2.length - 1; i++) {
    const char = input2[i];
    if ((char === '"' || char === "'") && input2[i - 1] !== "\\") {
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
    if (depth === 0 && bracketDepth === 0 && input2.slice(i, i + 2) === "..") {
      if (i === 0) {
        continue;
      }
      return i;
    }
  }
  return -1;
}
function skipWhitespace(input2, index) {
  let current = index;
  while (current < input2.length && /\s/.test(input2[current])) {
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
function tokenizeExpression(input2, source, site = "public") {
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
  while (index < input2.length) {
    const char = input2[index];
    if (/\s/.test(char)) {
      index++;
      continue;
    }
    const previousToken = tokens.at(-1);
    const startsOperand = !previousToken || ["operator", "lparen", "lbracket", "comma"].includes(previousToken.type);
    const relative = input2.slice(index).match(/^([:?]?)(\++|-+)/);
    if (relative && (relative[1] || startsOperand && /^(?:\s*$|\s*[&)*,/<=>\]^|])/.test(input2.slice(index + relative[0].length)))) {
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
    const placeholder = startsOperand ? input2.slice(index).match(/^<(?:([A-Z_a-z]\w*)|(?:\.{3}|…)\[([^\]]+)])>/) : null;
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
      const { value, nextIndex, quote } = readQuotedString(input2, index);
      tokens.push({ type: "string", value, quote, ...provenance(nextIndex) });
      index = nextIndex;
      continue;
    }
    const previous = tokens.at(-1);
    const operandExpected = !previous || previous.type === "operator" || previous.type === "lparen" || previous.type === "lbracket" || previous.type === "comma";
    if (operandExpected && char === "%" && !/[01]/.test(input2[index + 1] ?? "")) {
      throw new ExpressionSyntaxError(
        { kind: "invalid", reason: "literal" },
        { message: "Invalid number: NaN" }
      );
    }
    if (char === "%" && operandExpected && /[01]/.test(input2[index + 1] ?? "")) {
      const literal = input2.slice(index).match(/^%[01]+/)[0];
      tokens.push({ type: "literal", value: literal, ...provenance(index + literal.length) });
      index += literal.length;
      continue;
    }
    if (char === "!" && !input2.startsWith("!=", index) && !/[A-Z_a-z{]/.test(input2[index + 1] ?? "")) {
      tokens.push({ type: "operator", value: "~", offset: index });
      index++;
      continue;
    }
    if (char === "~") {
      tokens.push({ type: "operator", value: "~", offset: index });
      index++;
      continue;
    }
    const operator = (input2.startsWith("<:", index) ? "<:" : void 0) ?? binaryOperators.find((candidate) => input2.startsWith(candidate, index));
    if (operator) {
      tokens.push({ type: "operator", value: operator, offset: index });
      index += operator.length;
      continue;
    }
    if (char === "!") {
      const { token, nextIndex } = readDefineReference(input2, index);
      tokens.push({ ...token, ...provenance(nextIndex) });
      index = nextIndex;
      continue;
    }
    if (char === "@" || char === "?" || /[A-Z_a-z]/.test(char) || previousToken?.type === "dot" && /\d/.test(char)) {
      const { value, nextIndex } = readIdentifier(input2, index);
      if (nextIndex === index + 1 && (char === "?" || char === "@")) {
        throw new ExpressionSyntaxError({ kind: "unsupported", reason: "token" });
      }
      const open = skipWhitespace(input2, nextIndex);
      if (input2[open] === "(" && previousToken?.type !== "dot") {
        const call = readCallSyntax(input2, value, open, site, source);
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
      const match = input2.slice(index).match(/^\$[\dA-Fa-f]+/);
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
      const match = input2.slice(index).match(/^%[01]+/);
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
      if (/^0x/i.test(input2.slice(index)) && !/[\dA-Fa-f]/.test(input2[index + 2] ?? "")) {
        throw new ExpressionSyntaxError(
          { kind: "invalid", reason: "literal" },
          { message: "Invalid number: NaN" }
        );
      }
      const match = input2.slice(index).match(/^(?:0x[\da-f]+|-?\d+(?:\.\d+)?)/i);
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
function readCallSyntax(input2, name, open, site, source) {
  const args = [];
  let start = open + 1;
  let depth = 0;
  let quote = "";
  const append = (end) => {
    const raw = input2.slice(start, end);
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
              message: `Expected ',' or ')' in function call arguments: ${input2.slice(offset + quoted.nextIndex).trimStart()}`
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
  for (let index = start; index < input2.length; index++) {
    const char = input2[index];
    if (quote) {
      if (char === quote && input2[index - 1] !== "\\") {
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
  if (depth === 0 && input2.slice(start).trim()) {
    message = "Expected ',' or ')' in function call arguments: ";
  }
  if (quote) {
    message = "Unterminated string literal in function call.";
  }
  throw new ExpressionSyntaxError({ kind: "invalid", reason: "delimiter" }, { message });
}
function readQuotedString(input2, start) {
  const quote = input2[start];
  if (!isQuote(quote)) {
    throw new ExpressionSyntaxError({ kind: "invalid", reason: "string" });
  }
  let value = "";
  let index = start + 1;
  while (index < input2.length) {
    const char = input2[index];
    if (char === quote && input2[index - 1] !== "\\") {
      return { value, nextIndex: index + 1, quote };
    }
    value += char;
    index++;
  }
  throw new ExpressionSyntaxError({ kind: "invalid", reason: "string" });
}
function readIdentifier(input2, start) {
  let index = start;
  if (input2[index] === "?" && input2[index + 1] === ".") {
    index++;
    while (input2[index] === ".") {
      index++;
    }
  }
  if (input2[index] === "@" || input2[index] === "?") {
    index++;
  }
  while (index < input2.length && /\w/.test(input2[index])) {
    index++;
  }
  return { value: input2.slice(start, index), nextIndex: index };
}
function readDefineReference(input2, start) {
  if (input2[start + 1] === "{") {
    let index = start + 2;
    let braces = 1;
    let content = "";
    while (index < input2.length) {
      const char = input2[index];
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
  const { value, nextIndex } = readIdentifier(input2, start + 1);
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
  /** Position of the next unconsumed token. */
  index = 0;
  /**
   * Parses a binary expression whose operators bind at least as tightly as `minPrecedence`.
   * @param minPrecedence Lowest operator precedence this call may consume.
   * @returns The parsed expression.
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
  /** Reports whether every token has been consumed. */
  isAtEnd() {
    return this.index >= this.tokens.length;
  }
  /** Parses right-nested prefix operators followed by a primary with postfix accessors. */
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
  /** Parses one operand: dotted local name, literal, string, define reference, identifier or parenthesized group. */
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
  /** Applies call, member and index postfixes; calls require identifiers and accessors require references. */
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
  /** Parses comma-separated arguments after `(` through the closing `)`. */
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
   * @param type The type.
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
  /** Consumes the next token only when its type matches, reporting whether it did. */
  match(expected) {
    const token = this.peek();
    if (token && token.type === expected.type) {
      this.index++;
      return true;
    }
    return false;
  }
  /** Returns the next token and advances; undefined past the end. */
  consume() {
    const token = this.tokens[this.index];
    this.index++;
    return token;
  }
  /** Returns the next token without advancing; undefined past the end. */
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
    parse(input2) {
      return copySyntaxValue(JSON.parse(JSON.stringify(parse2(input2))));
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
var splitRespectingFunctions = (input2) => {
  const result = [];
  let current = "";
  let parenDepth = 0;
  let inQuotes = false;
  let quoteChar = "";
  for (let i = 0; i < input2.length; i++) {
    const char = input2[i];
    if ((char === '"' || char === "'") && (i === 0 || input2[i - 1] !== "\\")) {
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

// packages/core/src/ir/link-expression.ts
function linkInteger(value) {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`Link expression requires a safe integer: ${value}`);
  }
  return value;
}
function linkConstant(value) {
  return { kind: "constant", value: linkInteger(value) };
}
function linkBinary(operator, left, right) {
  if (operator === "-" && left.kind === "section" && right.kind === "section" && left.module === right.module && left.section === right.section) {
    return linkConstant(left.offset - right.offset);
  }
  if (left.kind !== "constant" || right.kind !== "constant") {
    return { kind: "binary", operator, left, right };
  }
  const a = left.value;
  const b = right.value;
  let value;
  switch (operator) {
    case "+":
      value = a + b;
      break;
    case "-":
      value = a - b;
      break;
    case "*":
      value = a * b;
      break;
    case "/":
    case "%":
      if (b === 0) {
        throw new Error("Division by zero in link expression.");
      }
      value = operator === "/" ? Math.trunc(a / b) : a % b;
      break;
    case "**":
      value = a ** b;
      break;
    case "<<":
    case ">>":
      if (b < 0 || b > 52) {
        throw new Error("Link expression shift must be in 0..52.");
      }
      value = Number(operator === "<<" ? BigInt(a) << BigInt(b) : BigInt(a) >> BigInt(b));
      break;
    case "&":
      value = Number(BigInt(a) & BigInt(b));
      break;
    case "|":
      value = Number(BigInt(a) | BigInt(b));
      break;
    case "^":
      value = Number(BigInt(a) ^ BigInt(b));
      break;
    case "<":
      value = Number(a < b);
      break;
    case ">":
      value = Number(a > b);
      break;
    case "<=":
      value = Number(a <= b);
      break;
    case ">=":
      value = Number(a >= b);
      break;
    case "=":
    case "==":
      value = Number(a === b);
      break;
    case "!=":
      value = Number(a !== b);
      break;
    case "&&":
      value = Number(a !== 0 && b !== 0);
      break;
    case "||":
      value = Number(a !== 0 || b !== 0);
      break;
  }
  return linkConstant(value);
}
function linkUnary(operator, argument) {
  if (argument.kind !== "constant") {
    return { kind: "unary", operator, argument };
  }
  const value = argument.value;
  if (operator === "-") {
    return linkConstant(-value);
  }
  if (operator === "~") {
    return linkConstant(Number(~BigInt(value)));
  }
  let shift = 0;
  if (operator === "high") {
    shift = 8;
  }
  if (operator === "bank") {
    shift = 16;
  }
  return linkConstant(Number(BigInt(value) >> BigInt(shift) & 255n));
}
function compileLinkExpression(expression, context, depth = 0) {
  if (depth > 128) {
    throw new Error("Link expression nesting exceeds 128.");
  }
  const compile = (node) => compileLinkExpression(node, context, depth + 1);
  switch (expression.type) {
    case "literal":
    case "string":
      return linkConstant(context.literal(expression));
    case "identifier":
      if (expression.name === "*") {
        return context.current();
      }
      return context.reference(expression);
    case "member":
    case "index":
    case "relativeReference":
      return context.reference(expression);
    case "template":
    case "defineReference": {
      const bound = context.bind?.(expression);
      if (!bound || bound === expression) {
        throw new Error("Unbound template in link expression.");
      }
      return compile(bound);
    }
    case "binary": {
      const left = compile(expression.left);
      if (left.kind === "constant") {
        if (expression.operator === "&&" && left.value === 0) {
          return linkConstant(0);
        }
        if (expression.operator === "||" && left.value !== 0) {
          return linkConstant(1);
        }
      }
      return linkBinary(expression.operator, left, compile(expression.right));
    }
    case "unary": {
      const argument = compile(expression.argument);
      if (expression.operator === "+") {
        return argument;
      }
      if (expression.operator === "<") {
        return linkUnary("low", argument);
      }
      if (expression.operator === ">") {
        return linkUnary("high", argument);
      }
      if (expression.operator === "^" || expression.operator === "<:") {
        return linkUnary("bank", argument);
      }
      return linkUnary(expression.operator, argument);
    }
    case "call": {
      const name = expression.callee.name.toLowerCase();
      if (name === "pc" && expression.arguments.length === 0) {
        return context.current();
      }
      const extraction = {
        low: "low",
        lobyte: "low",
        high: "high",
        hibyte: "high",
        bank: "bank",
        bankbyte: "bank"
      };
      if (extraction[name] && expression.arguments.length === 1) {
        return linkUnary(extraction[name], compile(expression.arguments[0]));
      }
      if ((name === "loword" || name === "hiword") && expression.arguments.length === 1) {
        let value = compile(expression.arguments[0]);
        if (name === "hiword") {
          value = linkBinary(">>", value, linkConstant(16));
        }
        return linkBinary("&", value, linkConstant(65535));
      }
      const resolved = context.call?.(expression, compile);
      if (resolved) {
        return resolved;
      }
      throw new Error(
        `Function '${name}' is unavailable in a link expression; evaluate it at assembly time.`
      );
    }
    case "error":
    case "range":
    case "raw":
    case "sourceText":
    default:
      throw new Error(`Expression '${expression.type}' cannot be retained for linking.`);
  }
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
      const next = parts2.at(index + 1);
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
  const hex2 = /^\$([\da-f]+)$/i.exec(text);
  const binary = /^%([01]+)$/.exec(text);
  if (hex2) {
    spelling = "hex";
    literalBytes = Math.max(1, Math.ceil(hex2[1].length / 2));
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
        const address2 = scalar(inside[0].text, offset + inside[0].start, force);
        return {
          kind: "memory",
          address: address2,
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
  const address = delimiter !== "none" && grammar2.registers.includes(register) ? {
    kind: "register",
    name: register,
    span: { start: offset, end: offset + body.length }
  } : scalar(body, offset, force);
  return {
    kind: "memory",
    address,
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

// packages/core/src/services/source-link-recipe.ts
function addressedSourceLinkRecipe(options) {
  const regions = [];
  const placements = [];
  const prefix = options.prefix ?? [];
  let cursor = prefix.length;
  if (prefix.length) {
    regions.push({
      name: "__source_header",
      start: 0,
      size: prefix.length,
      outputOffset: 0,
      initialBytes: [...prefix]
    });
  }
  const entries = options.sections.map((section) => ({ ...section, outputOffset: options.outputOffset(section.loadAddress) })).toSorted((a, b) => a.outputOffset - b.outputOffset || a.size - b.size);
  const gap = (end) => {
    if (end > cursor) {
      regions.push({
        name: `__source_gap_${cursor}`,
        start: 0,
        size: end - cursor,
        outputOffset: cursor,
        fillByte: options.fillByte
      });
    }
    cursor = Math.max(cursor, end);
  };
  for (const entry of entries) {
    if (!Number.isSafeInteger(entry.outputOffset) || entry.outputOffset < prefix.length) {
      throw new Error(`Source ORG for '${entry.section}' does not map to payload storage.`);
    }
    if (entry.size && entry.outputOffset < cursor) {
      throw new Error(
        `Source contributions overlap at '${entry.section}'; use the absolute patch workflow for overlapping writes.`
      );
    }
    gap(entry.outputOffset);
    const load = `${entry.section}:load`;
    const run = entry.runAddress === entry.loadAddress ? load : `${entry.section}:run`;
    regions.push({
      name: load,
      start: entry.loadAddress,
      size: entry.size,
      outputOffset: entry.outputOffset,
      fillByte: options.fillByte
    });
    if (run !== load) {
      regions.push({ name: run, start: entry.runAddress, size: entry.size });
    }
    placements.push({ section: entry.section, load, run });
    cursor = Math.max(cursor, entry.outputOffset + entry.size);
  }
  if (options.outputSize !== void 0) {
    if (cursor > options.outputSize) {
      throw new Error("Source layout exceeds its configured container size.");
    }
    gap(options.outputSize);
  }
  return {
    target: options.target,
    targetOptions: options.targetOptions,
    checksumPolicy: options.checksumPolicy ?? "preserve",
    regions,
    placements
  };
}

// packages/core/src/ir/relocatable-instruction.ts
var RelocatableInstruction = class {
  constructor(frame, context) {
    this.frame = frame;
    this.context = context;
  }
  frame;
  context;
  parts = [];
  size = 0;
  /** Opcode bytes are completely known before placement; symbolic opcode/register choices are rejected. */
  opcode(...values) {
    for (const value of values) {
      if (!Number.isInteger(value) || value < 0 || value > 255) {
        throw this.frame.error(`Invalid opcode byte: ${value}`);
      }
      this.parts.push(value);
      this.size++;
    }
    return this;
  }
  /** Retain an operand's pure expression and its target-owned encoding contract. */
  field(value, encoding) {
    this.parts.push({ value, encoding });
    this.size += encoding.width;
    return this;
  }
  /** Relative PC anchors are assigned after the entire instruction size is known. */
  finish(form, state = null) {
    this.frame.choose(form, this.size, state);
    if (this.context) {
      if (!this.context.emission.writeRelocation) {
        throw this.frame.error("Encoder host does not support relocatable fields.");
      }
      for (const part of this.parts) {
        if (typeof part === "number") {
          this.context.emission.write1(part);
        } else {
          let encoding = part.encoding;
          if (encoding.kind === "relative" && !encoding.pc) {
            const start = this.frame.sectionPosition();
            encoding = {
              ...encoding,
              pc: { section: start.section, offset: this.frame.instructionAddress + this.size }
            };
          }
          const expression = "expression" in part.value ? this.frame.compileLink(part.value) : part.value;
          this.context.emission.writeRelocation(expression, encoding);
        }
      }
    }
    return this.size;
  }
};

// packages/core/src/linker/types.ts
var LinkError = class extends Error {
  /**
   * Captures a link failure with optional source anchoring and partial placement state.
   * @param code Stable machine-readable failure code.
   * @param message Human-readable explanation prefixed with source location when present.
   * @param source Optional source occurrence tied to the failure.
   * @param allocations Partial allocations computed before the failure.
   */
  constructor(code, message, source, allocations = []) {
    const location = source ? `${source.file}:${source.line}: ` : "";
    super(`${location}${message}`);
    this.code = code;
    this.source = source;
    this.allocations = allocations;
  }
  code;
  source;
  allocations;
  /** Stable error name for instanceof checks across bundle boundaries. */
  name = "LinkError";
};

// packages/assets/src/secret-of-mana/som-boss-background.ts
function integer3(value, minimum, maximum) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`Boss background value must be ${minimum}..${maximum}.`);
  }
  return value;
}
function decodeBossTilemap(source, size) {
  integer3(size, 2, 65534);
  if (size % 2) {
    throw new Error("Boss tilemaps require complete two-byte tile words.");
  }
  if (!source.length) {
    throw new Error("Missing boss tilemap storage tag.");
  }
  const tag = source[0];
  if (!tag) {
    if (source.length < size + 1) {
      throw new Error("Truncated raw boss tilemap.");
    }
    return { data: source.slice(1, size + 1), consumed: size + 1, tag };
  }
  const result = expandBossMask(source.subarray(1), size);
  return { ...result, consumed: result.consumed + 1, tag };
}
function encodeBossTilemap(data, tag = 1) {
  integer3(data.length, 2, 65534);
  if (data.length % 2) {
    throw new Error("Boss tilemaps require complete two-byte tile words.");
  }
  integer3(tag, 0, 255);
  const body = tag ? encodeBossMask(data) : data;
  const result = new Uint8Array(body.length + 1);
  result[0] = tag;
  result.set(body, 1);
  return result;
}

// packages/assets/src/secret-of-mana/som-dialogue-command.ts
function encodeSomDialogueCommand(text) {
  const names = ["${boy}", "${girl}", "${sprite}"];
  const index = names.indexOf(text);
  if (index >= 0) {
    return { family: "party-name", bytes: Uint8Array.of(87, index) };
  }
  if (text === "${wait}") {
    return { family: "wait", bytes: Uint8Array.of(40, 0) };
  }
  const wait = /^\${wait:(0|[1-9]\d*)}$/.exec(text);
  if (wait) {
    const count = Number(wait[1]);
    if (!Number.isSafeInteger(count) || count > 255) {
      throw new Error("Dialogue wait must fit one unsigned byte.");
    }
    return { family: "wait", bytes: Uint8Array.of(40, count) };
  }
  const windows = /* @__PURE__ */ new Map([
    ["${openDialogue}", 80],
    ["${closeDialogue}", 81],
    ["${clearDialogue}", 82]
  ]);
  const opcode = windows.get(text);
  if (opcode !== void 0) {
    return { family: "text-window", bytes: Uint8Array.of(opcode) };
  }
  throw new Error(`Unsupported dialogue command token ${text}.`);
}

// packages/assets/src/secret-of-mana/som-dialogue.ts
var SOM_DIALOGUE_PAIR_COUNT = 61;
var MAX_GLYPHS = 4096;
var punctuation = /* @__PURE__ */ new Map([
  [191, "."],
  [192, ","],
  [193, "/"],
  [194, "'"],
  [197, ":"],
  [198, "-"],
  [199, "%"],
  [200, "!"],
  [202, "?"]
]);
function readSomDialogueDictionary(bytes) {
  if (bytes.length !== SOM_DIALOGUE_PAIR_COUNT * 2 || bytes.some((byte) => byte < 128 || byte > 210)) {
    throw new Error("SoM dialogue requires 61 pairs of ordinary font codes.");
  }
  return Array.from(
    { length: SOM_DIALOGUE_PAIR_COUNT },
    (_, i) => [bytes[i * 2], bytes[i * 2 + 1]]
  );
}
function glyphText(byte) {
  if (byte === 127) {
    return "\n";
  }
  if (byte === 128) {
    return " ";
  }
  if (byte >= 129 && byte <= 154) {
    return String.fromCharCode(byte - 129 + 97);
  }
  if (byte >= 155 && byte <= 180) {
    return String.fromCharCode(byte - 155 + 65);
  }
  if (byte >= 181 && byte <= 190) {
    return String.fromCharCode(byte - 181 + 48);
  }
  return punctuation.get(byte) ?? `\\x${byte.toString(16).padStart(2, "0").toUpperCase()}`;
}
function expandSomDialogue(bytes, dictionary) {
  const output = [];
  for (const byte of bytes) {
    let index;
    if (byte >= 96 && byte <= 126) {
      index = byte - 96;
    } else if (byte >= 211) {
      index = byte - 195;
    }
    if (index !== void 0) {
      const pair = dictionary.at(index);
      if (!pair) {
        throw new Error(`Missing SoM dialogue pair ${index}.`);
      }
      output.push(...pair);
    } else {
      if (byte < 127) {
        throw new Error(`Event/control byte ${byte.toString(16)} is outside a text span.`);
      }
      output.push(byte);
    }
  }
  return Uint8Array.from(output);
}
function decodeSomDialogue(bytes, dictionary) {
  return [...expandSomDialogue(bytes, dictionary)].map(glyphText).join("");
}
function parseGlyphs(text) {
  const inverse = new Map(
    Array.from({ length: 84 }, (_, i) => i + 127).filter((byte) => !glyphText(byte).startsWith("\\")).map((byte) => [glyphText(byte), byte])
  );
  const bytes = [];
  for (let offset = 0; offset < text.length; ) {
    if (text[offset] === "\\") {
      const match = /^\\x([\da-f]{2})/i.exec(text.slice(offset));
      if (!match) {
        throw new Error(`Invalid dialogue escape at character ${offset}.`);
      }
      const byte = Number.parseInt(match[1], 16);
      if (byte < 127 || byte > 210) {
        throw new Error("Dialogue escapes must select an ordinary glyph or line break.");
      }
      bytes.push(byte);
      offset += 4;
    } else {
      const byte = inverse.get(text[offset]);
      if (byte === void 0) {
        throw new Error(
          `Unsupported dialogue character at ${offset}; use a verified glyph escape.`
        );
      }
      bytes.push(byte);
      offset++;
    }
  }
  if (bytes.length > MAX_GLYPHS) {
    throw new Error("Dialogue span exceeds the 4096-glyph authoring limit.");
  }
  return bytes;
}
function validateLineGeometry(options) {
  const { lineColumns, initialColumn } = options;
  if (lineColumns === void 0) {
    if (initialColumn !== void 0) {
      throw new Error("Initial dialogue column requires a line capacity.");
    }
    return;
  }
  if (!Number.isSafeInteger(lineColumns) || lineColumns < 1 || lineColumns > 32) {
    throw new Error("Dialogue line capacity must be an integer from 1 to 32 glyphs.");
  }
  if (initialColumn !== void 0 && (!Number.isSafeInteger(initialColumn) || initialColumn < 0 || initialColumn >= lineColumns)) {
    throw new Error("Initial dialogue column must be within the supplied line capacity.");
  }
}
function encodeSomDialogue(text, dictionary, options = {}) {
  const glyphs = parseGlyphs(text);
  validateLineGeometry(options);
  if (options.literal !== void 0 && typeof options.literal !== "boolean") {
    throw new Error("Dialogue literal policy must be boolean.");
  }
  if (options.literal === true) {
    if (options.original?.some((byte) => byte < 127 || byte > 210)) {
      throw new Error("Literal dialogue requires uncompressed native glyphs.");
    }
    if (options.byteLength !== void 0 && (!Number.isSafeInteger(options.byteLength) || options.byteLength < 0 || options.byteLength > MAX_GLYPHS)) {
      throw new Error("Dialogue byte budget must be an integer from 0 to 4096.");
    }
    if (options.byteLength !== void 0 && glyphs.length !== options.byteLength) {
      throw new Error(
        `Literal dialogue cannot fit its exact ${options.byteLength}-byte glyph cells.`
      );
    }
    return Uint8Array.from(glyphs);
  }
  const pairs = /* @__PURE__ */ new Map();
  for (let code = 96; code <= 255; code++) {
    if (code === 125) {
      continue;
    }
    let index;
    if (code <= 126) {
      index = code - 96;
    } else if (code >= 211) {
      index = code - 195;
    }
    if (index === void 0) {
      continue;
    }
    const pair = dictionary.at(index);
    if (!pair) {
      throw new Error(`Missing SoM dialogue pair ${index}.`);
    }
    const key = pair[0] | pair[1] << 8;
    if (!pairs.has(key)) {
      pairs.set(key, code);
    }
  }
  let target = options.byteLength;
  if (target !== void 0 && (!Number.isSafeInteger(target) || target < 0 || target > MAX_GLYPHS)) {
    throw new Error("Dialogue byte budget must be an integer from 0 to 4096.");
  }
  if (options.original && decodeSomDialogue(options.original, dictionary) === text) {
    if (target !== void 0 && target !== options.original.length) {
      throw new Error("Original dialogue disagrees with byte budget.");
    }
    return options.original.slice();
  }
  const columns = new Uint8Array(glyphs.length);
  if (options.lineColumns !== void 0) {
    let column = options.initialColumn ?? 0;
    for (const [index, glyph] of glyphs.entries()) {
      columns[index] = column;
      if (glyph === 127) {
        column = 0;
      } else {
        column = (column + 1) % options.lineColumns;
      }
    }
  }
  const pairAt = (i) => {
    if (i + 1 >= glyphs.length) {
      return void 0;
    }
    if (options.lineColumns !== void 0 && columns[i] === options.lineColumns - 1) {
      return void 0;
    }
    return pairs.get(glyphs[i] | glyphs[i + 1] << 8);
  };
  if (target === void 0) {
    const minimum = new Uint16Array(glyphs.length + 1);
    for (let i = glyphs.length - 1; i >= 0; i--) {
      minimum[i] = minimum[i + 1] + 1;
      if (pairAt(i) !== void 0) {
        minimum[i] = Math.min(minimum[i], minimum[i + 2] + 1);
      }
    }
    target = minimum[0];
  }
  const width = target + 1, possible = new Uint8Array((glyphs.length + 1) * width);
  possible[glyphs.length * width] = 1;
  for (let i = glyphs.length - 1; i >= 0; i--) {
    for (let count = 1; count <= target; count++) {
      if (possible[(i + 1) * width + count - 1] || pairAt(i) !== void 0 && possible[(i + 2) * width + count - 1]) {
        possible[i * width + count] = 1;
      }
    }
  }
  if (!possible[target]) {
    throw new Error(
      `Dialogue cannot fit its exact ${target}-byte ROM span; relocation or a different edit is required.`
    );
  }
  const encoded = [];
  for (let i = 0, remaining = target; i < glyphs.length; remaining--) {
    const pair = pairAt(i);
    if (pair !== void 0 && possible[(i + 2) * width + remaining - 1]) {
      encoded.push(pair);
      i += 2;
    } else {
      encoded.push(glyphs[i++]);
    }
  }
  return Uint8Array.from(encoded);
}
function hexBytes(value) {
  if (typeof value !== "string" || value.length > MAX_GLYPHS * 2 || value.length % 2 !== 0 || /[^\da-f]/i.test(value)) {
    throw new Error("Invalid or oversized native dialogue hex.");
  }
  return Uint8Array.from(value.match(/../g) ?? [], (pair) => Number.parseInt(pair, 16));
}
function isRecord6(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function hasDialogueLayoutShape(value) {
  return isRecord6(value) && value.format === "som-dialogue-script" && value.version === 1 && typeof value.dictionaryHex === "string" && Array.isArray(value.segments) && value.segments.length > 0 && value.segments.length <= MAX_GLYPHS && value.segments.every(
    (segment) => isRecord6(segment) && (segment.kind === "raw" || segment.kind === "text") && typeof segment.nativeHex === "string" && (segment.literal === void 0 || typeof segment.literal === "boolean") && (segment.lineColumns === void 0 || typeof segment.lineColumns === "number") && (segment.initialColumn === void 0 || typeof segment.initialColumn === "number") && (segment.commands === void 0 || Array.isArray(segment.commands) && segment.commands.length <= MAX_GLYPHS && segment.commands.every(
      (slot) => isRecord6(slot) && typeof slot.offset === "number" && typeof slot.token === "string" && (slot.editable === void 0 || typeof slot.editable === "boolean")
    ))
  );
}
function readSomDialogueScriptLayout(value) {
  if (!hasDialogueLayoutShape(value)) {
    throw new Error("Invalid SoM dialogue-script layout.");
  }
  const dictionary = readSomDialogueDictionary(hexBytes(value.dictionaryHex));
  let total = 0;
  for (const [index, segment] of value.segments.entries()) {
    if (index > 0 && segment.kind === value.segments[index - 1].kind) {
      throw new Error("Dialogue segments must alternate raw/text.");
    }
    const bytes = hexBytes(segment.nativeHex);
    if (!bytes.length || bytes.length > MAX_GLYPHS) {
      throw new Error("Invalid dialogue segment size.");
    }
    if (segment.literal !== void 0 && segment.kind !== "text") {
      throw new Error("Literal dialogue policy requires a text segment and boolean value.");
    }
    if (segment.literal === true && bytes.some((byte) => byte < 127 || byte > 210)) {
      throw new Error("Literal dialogue requires uncompressed native glyphs.");
    }
    if (segment.kind === "text") {
      parseGlyphs(decodeSomDialogue(bytes, dictionary));
      validateLineGeometry(segment);
    } else if (segment.lineColumns !== void 0 || segment.initialColumn !== void 0) {
      throw new Error("Raw dialogue commands cannot carry text geometry.");
    }
    if (segment.commands !== void 0) {
      if (segment.kind !== "raw" || segment.commands.length > bytes.length) {
        throw new Error("Named dialogue commands require a bounded raw segment.");
      }
      let end = 0;
      for (const slot of segment.commands) {
        if (!Number.isSafeInteger(slot.offset) || slot.offset < end) {
          throw new Error("Invalid or overlapping dialogue command slot.");
        }
        const command = encodeSomDialogueCommand(slot.token);
        end = slot.offset + command.bytes.length;
        if (end > bytes.length || !command.bytes.every((byte, i) => byte === bytes[slot.offset + i])) {
          throw new Error("Named dialogue command disagrees with its native bytes.");
        }
      }
    }
    total += bytes.length;
  }
  if (total > 65536) {
    throw new Error("Dialogue script exceeds one ROM bank.");
  }
  return value;
}
function rawParts(segment, index) {
  const native = hexBytes(segment.nativeHex), parts2 = [];
  let cursor = 0, opaque = 0;
  for (const slot of segment.commands ?? []) {
    if (slot.offset > cursor) {
      parts2.push({
        marker: `{raw:${index}:${opaque++}}`,
        bytes: native.slice(cursor, slot.offset)
      });
    }
    const bytes = encodeSomDialogueCommand(slot.token).bytes;
    parts2.push({ marker: slot.token, bytes, slot });
    cursor = slot.offset + bytes.length;
  }
  if (cursor < native.length) {
    let marker = `{raw:${index}}`;
    if (segment.commands?.length) {
      marker = `{raw:${index}:${opaque}}`;
    }
    parts2.push({ marker, bytes: native.slice(cursor) });
  }
  return parts2;
}
function packSomDialogueScript(source, layout2, sizing = "fixed") {
  if (!["fixed", "variable"].includes(sizing)) {
    throw new Error("Invalid dialogue field sizing policy.");
  }
  if (source.some((byte) => byte > 127)) {
    throw new Error("SoM dialogue source must be ASCII.");
  }
  readSomDialogueScriptLayout(layout2);
  const dictionary = readSomDialogueDictionary(hexBytes(layout2.dictionaryHex));
  let text = new TextDecoder().decode(source).replaceAll("\r\n", "\n");
  if (text.includes("\r")) {
    throw new Error("Bare carriage returns are not dialogue line breaks.");
  }
  if (layout2.segments.at(-1)?.kind === "raw" && text.endsWith("\n")) {
    text = text.slice(0, -1);
  }
  const chunks = [], segments = [];
  let cursor = 0, raw = 0, nativePreserved = true, originalOffset = 0, outputOffset = 0;
  for (const segment of layout2.segments) {
    const original = hexBytes(segment.nativeHex);
    const firstChunk = chunks.length;
    if (segment.kind === "raw") {
      const index = raw++, legacy = `{raw:${index}}`;
      if (text.startsWith(legacy, cursor)) {
        cursor += legacy.length;
        chunks.push(original);
      } else {
        for (const part of rawParts(segment, index)) {
          if (!part.slot) {
            if (!text.startsWith(part.marker, cursor)) {
              throw new Error(`Missing or reordered command marker ${part.marker}.`);
            }
            cursor += part.marker.length;
            chunks.push(part.bytes);
            continue;
          }
          const match = /^\${[^{}]+}/.exec(text.slice(cursor));
          if (!match) {
            throw new Error(`Missing dialogue command ${part.slot.token}.`);
          }
          const command = encodeSomDialogueCommand(match[0]), expected = encodeSomDialogueCommand(part.slot.token);
          if (command.family !== expected.family || command.bytes.length !== part.bytes.length) {
            throw new Error("Dialogue command edit changed its admitted family or width.");
          }
          const preserved2 = command.bytes.every((byte, i) => byte === part.bytes[i]);
          if (part.slot.editable === false && !preserved2) {
            throw new Error("Dialogue command slot is read-only.");
          }
          nativePreserved &&= preserved2;
          chunks.push(command.bytes);
          cursor += match[0].length;
        }
      }
    } else {
      const boundaries = [text.indexOf("{raw:", cursor), text.indexOf("${", cursor)].filter(
        (index) => index >= 0
      );
      const end = boundaries.length ? Math.min(...boundaries) : text.length;
      let byteLength;
      if (sizing === "fixed" || segment.literal === true) {
        byteLength = original.length;
      }
      const encoded = encodeSomDialogue(text.slice(cursor, end), dictionary, {
        original,
        byteLength,
        lineColumns: segment.lineColumns,
        initialColumn: segment.initialColumn,
        literal: segment.literal
      });
      nativePreserved &&= encoded.length === original.length && encoded.every((byte, index) => byte === original[index]);
      chunks.push(encoded);
      cursor = end;
    }
    const emitted = chunks.slice(firstChunk);
    const length = emitted.reduce((sum, chunk2) => sum + chunk2.length, 0);
    let position = 0;
    const preserved = length === original.length && emitted.every((chunk2) => {
      const matches = chunk2.every((byte, index) => byte === original[position + index]);
      position += chunk2.length;
      return matches;
    });
    segments.push({
      kind: segment.kind,
      originalOffset,
      originalLength: original.length,
      offset: outputOffset,
      length,
      preserved
    });
    originalOffset += original.length;
    outputOffset += length;
  }
  if (cursor !== text.length) {
    throw new Error("Unexpected text after the final command marker.");
  }
  const bytes = new Uint8Array(chunks.reduce((sum, chunk2) => sum + chunk2.length, 0));
  if (bytes.length > 65536) {
    throw new Error("Packed dialogue script exceeds one ROM bank.");
  }
  let offset = 0;
  for (const chunk2 of chunks) {
    bytes.set(chunk2, offset);
    offset += chunk2.length;
  }
  return { bytes, segments, nativePreserved, fixedFieldOffsets: sizing === "fixed" };
}
function convertSomDialogueScript(source, options, resources) {
  if (typeof options.layout !== "string" || !Object.hasOwn(resources, options.layout)) {
    throw new Error("Dialogue layout resource is required.");
  }
  const layout2 = readSomDialogueScriptLayout(
    JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(resources[options.layout].bytes))
  );
  const result = packSomDialogueScript(source.bytes, layout2);
  const output = {
    bytes: result.bytes,
    mediaType: "application/octet-stream",
    metadata: {
      nativePreserved: result.nativePreserved,
      fixedFieldOffsets: result.fixedFieldOffsets
    }
  };
  return { primaryOutput: "script", outputs: { script: output } };
}

// packages/assets/src/secret-of-mana/som-world-rle.ts
function decodeWorldRow(bytes, size = 512) {
  if (!Number.isSafeInteger(size) || size < 1 || size > 65536) {
    throw new Error("World row size must be 1..65536 tiles.");
  }
  const data = new Uint8Array(size);
  let input2 = 0, output = 0;
  while (output < size) {
    if (input2 >= bytes.length) {
      throw new Error("Truncated world row token.");
    }
    const token = bytes[input2++];
    let count = 1, tile = token;
    if (token >= 192) {
      count = (token & 63) + 1;
      if (input2 >= bytes.length) {
        throw new Error("Truncated world row run.");
      }
      tile = bytes[input2++];
    }
    if (output + count > size) {
      throw new Error("World row run crosses its output boundary.");
    }
    data.fill(tile, output, output + count);
    output += count;
  }
  return { data, consumed: input2 };
}
function encodeWorldRow(bytes) {
  if (bytes.length < 1 || bytes.length > 65536) {
    throw new Error("World row size must be 1..65536 tiles.");
  }
  const output = [];
  for (let index = 0; index < bytes.length; ) {
    const tile = bytes[index];
    let count = 1;
    while (count < 64 && index + count < bytes.length && bytes[index + count] === tile) {
      count++;
    }
    if (count >= 3 || tile >= 192) {
      output.push(191 + count, tile);
    } else {
      for (let i = 0; i < count; i++) {
        output.push(tile);
      }
    }
    index += count;
  }
  return Uint8Array.from(output);
}

// packages/game-secret-of-mana/src/assembly.ts
var registry2 = new AssetRegistry().registerImporter(pngImporter);
for (const encoder of withImageEncoders(snesNativeEncoders)) {
  registry2.registerEncoder(encoder);
}
var audioRegistry = new AssetRegistry().registerImporter(waveImporter);
for (const encoder of withAudioEncoder(snesNativeEncoders)) {
  audioRegistry.registerEncoder(encoder);
}
function convertBossImage2(source, options, resources = {}, sourceCodecs = indexedSourceCodecs()) {
  if (options.layout && (options.sourceBinding || options.paletteSources)) {
    const normalized = normalizeSomSource(
      source,
      options,
      resources,
      readSpritePaletteCatalog(options, resources),
      sourceCodecs
    );
    return convertBossImage(normalized.source, options, resources, normalized);
  }
  return convertBossImage(source, options, resources);
}
function readBrrWave(source) {
  const document2 = waveImporter.import(source);
  const audio = readPcmAudio(document2.value);
  const bytes = source.bytes;
  if (bytes.length < 12 || String.fromCharCode(...bytes.subarray(0, 4)) !== "RIFF" || String.fromCharCode(...bytes.subarray(8, 12)) !== "WAVE") {
    throw new Error("SoM BRR asset requires a RIFF/WAVE file.");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(4, true) + 8 !== bytes.length) {
    throw new Error("SoM BRR WAVE has an invalid RIFF length.");
  }
  let native;
  for (let offset = 12; offset < bytes.length; ) {
    if (offset + 8 > bytes.length) {
      throw new Error("Truncated SoM BRR WAVE chunk.");
    }
    const length = view.getUint32(offset + 4, true);
    const end = offset + 8 + length;
    if (end + (length & 1) > bytes.length) {
      throw new Error("Truncated SoM BRR WAVE data.");
    }
    const id2 = String.fromCharCode(...bytes.subarray(offset, offset + 4));
    if (id2 === "sBRR") {
      if (native) {
        throw new Error("Duplicate native BRR chunk in SoM WAVE.");
      }
      native = bytes.slice(offset + 8, end);
    }
    offset = end + (length & 1);
  }
  return { audio, native };
}
function convertBrrWave(source, options = {}) {
  const { audio, native } = readBrrWave(source);
  const decoded2 = native ? decodeBrrPcm(native) : void 0;
  const unchanged = decoded2?.length === audio.samples.length && decoded2.every((sample, index) => sample === audio.samples[index]);
  let loop;
  if (options.loop !== void 0) {
    loop = resolveBrrAudioOptions({ loop: options.loop, padding: options.padding }, audio).loop;
  }
  const nativeLoop = native ? Boolean(native[native.length - 9] & 2) : false;
  let output;
  if (native && unchanged && (loop === void 0 || Boolean(loop) === nativeLoop)) {
    output = {
      bytes: native,
      mediaType: "application/octet-stream",
      metadata: {
        nativePreserved: true,
        sourceSamples: audio.samples.length,
        sampleRate: audio.sampleRate
      }
    };
  } else {
    if (options.loop === void 0) {
      throw new Error(
        "SoM WAVE PCM no longer matches native BRR (or its chunk was removed). Declare loop: false, 'source', or { start, end } in sample frames to review re-encoding."
      );
    }
    const result = convertAsset(audioRegistry, {
      source,
      format: "snes.brr",
      options: { loop: options.loop, padding: options.padding }
    });
    output = {
      ...result.outputs.brr,
      metadata: {
        ...result.outputs.brr.metadata,
        nativePreserved: false,
        fidelity: result.fidelity.kind
      }
    };
  }
  if (options.startByte !== void 0) {
    const fullByteLength = options.fullByteLength ?? native?.length;
    if (!Number.isSafeInteger(fullByteLength) || output.bytes.length !== fullByteLength) {
      throw new Error(
        "Split BRR editing requires the exact fullByteLength; resize the complete stream and repair both bank slices before changing its length."
      );
    }
  }
  return { primaryOutput: "brr", outputs: { brr: output } };
}
function sliceBrrSegment(brr, options) {
  const { startByte, byteLength } = options;
  if (typeof startByte !== "number" || !Number.isSafeInteger(startByte) || startByte < 0) {
    throw new Error("BRR segment startByte must be a non-negative integer.");
  }
  if (typeof byteLength !== "number" || !Number.isSafeInteger(byteLength) || byteLength < 1) {
    throw new Error("BRR segment byteLength must be a positive integer.");
  }
  if (startByte + byteLength > brr.length) {
    throw new Error("BRR segment extends beyond the authored block stream.");
  }
  return brr.slice(startByte, startByte + byteLength);
}
function encodeActor3bpp(planar, group) {
  if (!Number.isInteger(group) || group < 0 || group > 2) {
    throw new Error("actor group must be 0..2.");
  }
  const tiles = decodePlanarTiles(planar, 4);
  const native = tiles.map(
    (tile, tileIndex) => tile.map(
      (row, y) => row.map((pixel, x) => {
        if (pixel !== 0 && (pixel < group * 5 + 1 || pixel > group * 5 + 5)) {
          throw new Error(
            `Actor tile ${tileIndex} pixel ${x},${y}: palette index ${pixel} is outside group ${group}.`
          );
        }
        return pixel === 0 ? 0 : pixel - group * 5;
      })
    )
  );
  return encodeActor3bppNative(native);
}
function decodeActor3bppNative(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length % 24) {
    throw new Error("Actor stream requires complete 24-byte tiles.");
  }
  return Array.from(
    { length: bytes.length / 24 },
    (_, tileIndex) => Array.from(
      { length: 8 },
      (_row, y) => Array.from({ length: 8 }, (_column, x) => {
        const offset = tileIndex * 24 + y * 3;
        const bit = 7 - x;
        return bytes[offset] >>> bit & 1 | (bytes[offset + 1] >>> bit & 1) << 1 | (bytes[offset + 2] >>> bit & 1) << 2;
      })
    )
  );
}
function encodeActor3bppNative(tiles) {
  const bytes = new Uint8Array(tiles.length * 24);
  tiles.forEach((tile, tileIndex) => {
    if (tile.length !== 8) {
      throw new Error(`Actor tile ${tileIndex} needs eight rows.`);
    }
    tile.forEach((row, y) => {
      if (row.length !== 8) {
        throw new Error(`Actor tile ${tileIndex} row ${y} needs eight pixels.`);
      }
      row.forEach((color, x) => {
        if (!Number.isInteger(color) || color < 0 || color > 7) {
          throw new Error(`Actor tile ${tileIndex} pixel ${x},${y} needs a 3bpp index.`);
        }
        for (let plane = 0; plane < 3; plane++) {
          bytes[tileIndex * 24 + y * 3 + plane] |= (color >>> plane & 1) << 7 - x;
        }
      });
    });
  });
  return bytes;
}
function decodeActor3bpp(bytes, group) {
  if (!Number.isInteger(group) || group < 0 || group > 2) {
    throw new Error("actor group must be 0..2.");
  }
  const tiles = decodeActor3bppNative(bytes).map(
    (tile) => tile.map(
      (row) => row.map((color) => {
        if (color >= 6) {
          throw new Error("Actor source color 6/7 has no unique 4bpp inverse.");
        }
        return color === 0 ? 0 : color + group * 5;
      })
    )
  );
  return encodePlanarTiles(tiles, 4);
}
var somTitleLayout = Object.freeze({
  tileOrder: "blocks",
  blockSize: [2, 2],
  blockOrder: "row-major",
  blockRows: "bottom-to-top",
  withinBlock: "tl-bl-br-tr"
});
var imageOptions = (options) => {
  const { group, ...rest } = options;
  if (typeof group !== "number" || !Number.isInteger(group) || group < 0 || group > 2) {
    throw new Error("actor group must be 0..2.");
  }
  return rest;
};
function createSomAssetPlugin(sourceCodecs = indexedSourceCodecs()) {
  return definePlugin({
    manifest: {
      id: "som.assets",
      name: "Secret of Mana assets",
      version: "1.0.0",
      apiVersion: PLUGIN_API_VERSION,
      requires: [{ pluginId: "uttori.asm-plugin-snes", version: "1.0.0" }]
    },
    activate(context) {
      context.registerAssetFormat({
        id: "som.dialogue.script",
        version: "1.0.0",
        targets: ["snes.sfc"],
        resourcePaths: (options) => typeof options.layout === "string" ? [options.layout] : [],
        convert: convertSomDialogueScript
      });
      context.registerAssetFormat({
        id: "som.room",
        version: "1.0.0",
        targets: ["snes.sfc"],
        resourcePaths: (options) => typeof options.preview === "string" ? [options.preview] : [],
        convert: convertRoomAsset
      });
      context.registerAssetFormat({
        id: "som.palette.bgr555",
        version: "1.1.0",
        resourceDependencies: (source, options, resources) => somSourceDependencies(source, options, resources, sourceCodecs),
        targets: ["snes.sfc"],
        convert(source, options, resources) {
          if (source.mediaType !== "application/json" || typeof options.palette !== "string") {
            throw new Error("SoM palette asset requires a JSON catalogue and palette address.");
          }
          for (const name of ["wordOffset", "wordCount"]) {
            if (options[name] !== void 0 && typeof options[name] !== "number") {
              throw new Error(`SoM palette ${name} must be a number.`);
            }
          }
          const bytes = spritePaletteBytes(
            effectiveSomSourcePalette(
              parseSpritePaletteCatalog(source.bytes),
              options,
              resources,
              void 0,
              sourceCodecs
            ),
            options.palette,
            {
              wordOffset: typeof options.wordOffset === "number" ? options.wordOffset : void 0,
              wordCount: typeof options.wordCount === "number" ? options.wordCount : void 0
            }
          );
          return { primaryOutput: "palette", outputs: { palette: { bytes } } };
        }
      });
      context.registerAssetFormat({
        id: "som.boss.graphics",
        version: "1.2.0",
        sourceRepresentations: sourceCodecs.representations(),
        resourceDependencies: (source, options, resources) => somSourceDependencies(source, options, resources, sourceCodecs),
        targets: ["snes.sfc"],
        resourcePaths: (options) => [options.layout, options.palettes, options.native].filter(
          (path) => typeof path === "string"
        ),
        convert: (source, options, resources) => convertBossImage2(source, options, resources, sourceCodecs)
      });
      context.registerAssetFormat({
        id: "som.sprite.frames",
        version: "1.2.0",
        sourceRepresentations: sourceCodecs.representations(),
        resourceDependencies: (source, options, resources) => somSourceDependencies(source, options, resources, sourceCodecs),
        targets: ["snes.sfc"],
        resourcePaths: (options) => [options.layout, options.palettes].filter((path) => typeof path === "string"),
        convert(source, options, resources) {
          const catalog = readSpritePaletteCatalog(options, resources);
          const normalized = options.sourceBinding !== void 0 || options.paletteSources !== void 0 ? normalizeSomSource(source, options, resources, catalog, sourceCodecs) : { source, layout: readFrameLayout(options, resources), catalog };
          const tiles = encodeFrameAtlas(
            normalized.source,
            normalized.layout,
            readFrameAtlasSelection(options),
            normalized.catalog
          );
          return { primaryOutput: "tiles", outputs: { tiles: { bytes: tiles } } };
        }
      });
      context.registerAssetFormat({
        id: "som.tile.actor3bpp",
        version: "1.0.0",
        targets: ["snes.sfc"],
        resourcePaths: (options) => {
          const palette = options.palette;
          return typeof palette === "string" && palette !== "embedded" && palette !== "auto" ? [palette] : [];
        },
        convert(source, options, resources) {
          const converted = convertAsset(registry2, {
            source,
            format: "snes.tile.4bpp",
            options: imageOptions(options),
            resources
          });
          const native = converted.outputs.tiles.bytes;
          const group = options.group;
          if (typeof group !== "number") {
            throw new Error("actor group must be 0..2.");
          }
          const packed = encodeActor3bpp(native, group);
          const decoded2 = decodeActor3bpp(packed, group);
          if (decoded2.length !== native.length || decoded2.some((byte, index) => byte !== native[index])) {
            throw new Error("Actor conversion failed exact inverse verification.");
          }
          return {
            primaryOutput: "tiles",
            outputs: {
              tiles: { bytes: packed },
              tilemap: { bytes: converted.outputs.tilemap.bytes },
              palette: { bytes: converted.outputs.palette.bytes }
            }
          };
        }
      });
      context.registerAssetFormat({
        id: "som.brr.pcm",
        version: "1.0.0",
        targets: ["snes.sfc"],
        convert: convertBrrWave
      });
      context.registerAssetFormat({
        id: "som.brr.segment",
        version: "1.0.0",
        targets: ["snes.sfc"],
        convert(source, options) {
          const brr = convertBrrWave(source, options).outputs.brr;
          return {
            primaryOutput: "brr",
            outputs: { brr: { ...brr, bytes: sliceBrrSegment(brr.bytes, options) } }
          };
        }
      });
      context.registerAssetTransform({
        id: "som.boss.tilemap",
        version: "1.0.0",
        targets: ["snes.sfc"],
        optionSchema: {
          size: { type: "integer", minimum: 2, maximum: 65534 },
          tag: { type: "integer", minimum: 0, maximum: 255 }
        },
        encode: (bytes, options) => {
          if (bytes.length !== options.size) {
            throw new Error("Boss tilemap size mismatch.");
          }
          return encodeBossTilemap(bytes, options.tag === void 0 ? 1 : Number(options.tag));
        },
        decode: (bytes, options, maxOutputBytes) => {
          const size = Number(options.size);
          if (size > maxOutputBytes) {
            throw new Error("Boss tilemap exceeds output limit.");
          }
          const result = decodeBossTilemap(bytes, size);
          if (result.consumed !== bytes.length) {
            throw new Error("Trailing bytes after boss tilemap.");
          }
          return result.data;
        }
      });
      context.registerAssetTransform({
        id: "som.world.rle",
        version: "1.0.0",
        targets: ["snes.sfc"],
        optionSchema: { size: { type: "integer", minimum: 1, maximum: 65536 } },
        encode: (bytes, options) => {
          const size = typeof options.size === "number" ? options.size : 512;
          if (bytes.length !== size) {
            throw new Error("World row size mismatch.");
          }
          return encodeWorldRow(bytes);
        },
        decode: (bytes, options, maxOutputBytes) => {
          const size = typeof options.size === "number" ? options.size : 512;
          if (size > maxOutputBytes) {
            throw new Error("World row exceeds output limit.");
          }
          const result = decodeWorldRow(bytes, size);
          if (result.consumed !== bytes.length) {
            throw new Error("Trailing bytes after world row.");
          }
          return result.data;
        }
      });
      context.registerAssetTransform({
        id: "som.lz",
        version: "1.0.0",
        targets: ["snes.sfc"],
        optionSchema: {
          mode: { type: "enum", enum: ["auto", 0, 1, 2, 3, 4, 5] },
          unusedHeaderByte: { type: "integer", minimum: 0, maximum: 255 }
        },
        validateOptions: (options) => {
          compressSomLz(new Uint8Array(), options);
        },
        encode: (bytes, options) => compressSomLz(bytes, options),
        decode: (bytes, _options, maxOutputBytes) => {
          const result = decompressSomLz(bytes, 0, maxOutputBytes);
          if (result.compressedBytes !== bytes.length) {
            throw new Error("Trailing bytes after SoM LZ stream.");
          }
          return result.data;
        }
      });
    }
  });
}
var assembly_default = createSomAssetPlugin();

// packages/game-secret-of-mana/src/preview.ts
function convertSomFramePreview(input2) {
  let layout2 = readFrameLayout(input2.options, input2.resources);
  let catalog = readSpritePaletteCatalog(input2.options, input2.resources);
  let source = input2.source;
  if (input2.options.sourceBinding !== void 0 || input2.options.paletteSources !== void 0) {
    const normalized = normalizeSomSource(source, input2.options, input2.resources, catalog);
    source = normalized.source;
    layout2 = normalized.layout;
    catalog = normalized.catalog;
  }
  const selection = readFrameAtlasSelection(input2.options);
  if (input2.format === "som.boss.graphics" && typeof selection !== "string") {
    throw new Error("Frame atlas preview requires a segment name.");
  }
  const named = typeof selection === "string";
  const inspected = inspectFrameAtlas(source, layout2, catalog, {
    segmentName: named ? selection : void 0,
    whole: !named
  });
  const segments = named ? [selection] : frameAtlasSegmentOrder(layout2, selection);
  let encodedBytes;
  let output;
  if (input2.format === "som.boss.graphics") {
    const result = convertBossImage2(input2.source, input2.options, input2.resources);
    encodedBytes = result.outputs.graphics.bytes.length;
    output = "graphics";
  } else {
    if (named) {
      encodedBytes = encodeInspectedFrameSegment(inspected, selection).length;
    } else {
      encodedBytes = encodeInspectedFrameSegments(inspected, segments).length;
    }
    output = "tiles";
  }
  if (input2.output !== void 0 && input2.output !== output) {
    throw new Error(`Asset format '${input2.format}' has no output '${input2.output}'.`);
  }
  const image = inspected.image;
  const rgba = new Uint8Array(image.width * image.height * 4);
  for (let pixel = 0; pixel < image.indexes.length; pixel++) {
    const colorIndex = image.indexes[pixel];
    const color = colorIndex >= 0 && colorIndex < image.palette.length ? image.palette[colorIndex] : void 0;
    if (!color) {
      throw new Error(`Frame atlas pixel ${pixel} has no palette color.`);
    }
    rgba.set(color, pixel * 4);
  }
  const paletteIds = [
    ...new Set(segments.map((name) => layout2.paletteRefs[layout2.segments[name].palette]))
  ];
  const palettes = paletteIds.map((paletteId) => {
    const palette = Object.hasOwn(catalog.palettes, paletteId) ? catalog.palettes[paletteId] : void 0;
    if (!palette) {
      throw new Error(`Unknown sprite palette ${paletteId}.`);
    }
    return { paletteId, paletteRomAddress: palette.romAddress, paletteUsers: palette.users };
  });
  const primaryPalette = palettes[0];
  return {
    kind: "image",
    sourceBytes: input2.source.bytes.length,
    encodedBytes,
    format: input2.format,
    output,
    metadata: {
      segment: named ? selection : void 0,
      segments,
      ...primaryPalette,
      palettes
    },
    thumbnailPngBase64: Buffer.from(rgbaPreviewPng(rgba, image.width, image.height, 192)).toString(
      "base64"
    ),
    // The source PNG already carries the grid, frame labels and full native tile strip.
    composedPngBase64: Buffer.from(source.bytes).toString("base64")
  };
}
function convertSomPalettePreview(input2) {
  const id2 = input2.options.palette;
  if (input2.source.mediaType !== "application/json" || typeof id2 !== "string") {
    throw new Error("SoM palette preview requires a JSON catalogue and palette address.");
  }
  if (input2.output !== void 0 && input2.output !== "palette") {
    throw new Error(`Asset format '${input2.format}' has no output '${input2.output}'.`);
  }
  const catalog = effectiveSomSourcePalette(
    parseSpritePaletteCatalog(input2.source.bytes),
    input2.options,
    input2.resources
  );
  const bytes = spritePaletteBytes(catalog, id2);
  const preview = spritePalettePreview(catalog, id2);
  const png = Buffer.from(rgbaPreviewPng(preview.rgba, preview.width, preview.height));
  const palette = catalog.palettes[id2];
  return {
    kind: "image",
    sourceBytes: input2.source.bytes.length,
    encodedBytes: bytes.length,
    format: input2.format,
    output: "palette",
    metadata: {
      paletteId: id2,
      paletteRomAddress: palette.romAddress,
      paletteUsers: palette.users,
      previewWidth: preview.width
    },
    thumbnailPngBase64: png.toString("base64"),
    composedPngBase64: png.toString("base64")
  };
}
function convertSomRoomPreview(input2) {
  const converted = convertRoomAsset(input2.source, input2.options);
  const output = input2.output ?? converted.primaryOutput;
  if (!Object.hasOwn(converted.outputs, output)) {
    throw new Error(`Unknown room output '${output}'.`);
  }
  const resourcePath = input2.options.preview;
  const resource = typeof resourcePath === "string" && Object.hasOwn(input2.resources, resourcePath) ? input2.resources[resourcePath] : void 0;
  if (!resource) {
    throw new Error("Room preview requires its shared preview JSON resource.");
  }
  if (resource.mediaType !== "application/json") {
    throw new Error("Room preview resource must be JSON.");
  }
  const room = parseRoomAsset(input2.source);
  const preview = renderRoomAsset(room, parseRoomPreview(resource.bytes), {
    layer: input2.options.layer
  });
  return {
    kind: "image",
    sourceBytes: input2.source.bytes.length,
    encodedBytes: converted.outputs[output].bytes.length,
    format: input2.format,
    output,
    metadata: {
      room: room.id,
      name: room.name,
      width: preview.width,
      height: preview.height,
      activePieces: preview.activePieces,
      tileset: preview.tileset,
      limitation: preview.limitation
    },
    thumbnailPngBase64: Buffer.from(
      rgbaPreviewPng(preview.rgba, preview.width, preview.height, 192)
    ).toString("base64"),
    composedPngBase64: Buffer.from(
      rgbaNativePng(preview.rgba, preview.width, preview.height)
    ).toString("base64")
  };
}
function convertSomBrrPreview(input2) {
  if (input2.output !== void 0 && input2.output !== "brr") {
    throw new Error(`Asset format '${input2.format}' has no output '${input2.output}'.`);
  }
  const converted = convertBrrWave(input2.source, input2.options).outputs.brr;
  const native = converted.bytes;
  const sourceAudio = readPcmAudio(waveImporter.import(input2.source).value);
  const segment = input2.format === "som.brr.segment";
  const selected = segment ? sliceBrrSegment(native, input2.options) : native;
  const decoded2 = decodeBrrPcm(native);
  const metadata = { ...converted.metadata, previewScope: "full-stream" };
  if (segment) {
    metadata.segmentStartByte = input2.options.startByte;
    metadata.segmentByteLength = selected.length;
    metadata.fullStreamBytes = native.length;
  }
  return {
    kind: "audio",
    sourceBytes: input2.source.bytes.length,
    encodedBytes: selected.length,
    format: input2.format,
    output: "brr",
    metadata,
    waveformPngBase64: Buffer.from(waveformPreviewPng(sourceAudio.samples)).toString("base64"),
    sourceWavBase64: Buffer.from(input2.source.bytes).toString("base64"),
    decodedWavBase64: Buffer.from(writePcmWave(decoded2, sourceAudio.sampleRate)).toString("base64")
  };
}
var somPreviewAdapters = Object.freeze([
  { formats: ["som.room"], convert: convertSomRoomPreview },
  { formats: ["som.brr.pcm", "som.brr.segment"], convert: convertSomBrrPreview },
  { formats: ["som.palette.bgr555"], convert: convertSomPalettePreview },
  { formats: ["som.sprite.frames", "som.boss.graphics"], convert: convertSomFramePreview }
]);

// packages/assets/src/data.ts
var rawImporter = Object.freeze({
  id: "uttori.import.raw",
  version: "1.0.0",
  mediaTypes: ["application/octet-stream"],
  import: (input2) => ({
    kind: "raw",
    value: input2.bytes.slice()
  })
});
var rawEncoder = Object.freeze({
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
var jsonImporter = Object.freeze({
  id: "uttori.import.json",
  version: "1.0.0",
  mediaTypes: ["application/json"],
  import: (input2) => {
    const value = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(input2.bytes)
    );
    if (value === null || typeof value !== "object" || Array.isArray(value) || !("kind" in value) || typeof value.kind !== "string") {
      throw new Error("Asset JSON requires an object with a kind string.");
    }
    return { kind: value.kind, value };
  }
});

// packages/plugin-65xx/src/ca65-profile.ts
var CA65_65XX_SESSION_STATE_ID = "65xx.ca65-session-state";
function isSessionStateKey(value) {
  return value.id.length > 0;
}
function createSessionStateKey(id2) {
  const key = { id: id2 };
  if (!isSessionStateKey(key)) {
    throw new Error(`Invalid session state key '${id2}'.`);
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
function getOperandCodec(mode) {
  switch (mode) {
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
  const leftover = mode;
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
  const mode = modeNames[shortMode];
  if (!mnemonic || !mode) {
    throw new Error(`Invalid opcode table entry '${entry}' at $${opcode.toString(16)}.`);
  }
  const documented = legalOpcodes.has(opcode);
  const codec = getOperandCodec(mode);
  const key = `${mnemonic}:${mode}`;
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
    mode,
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
  ["immediate", "zeroPage", "absolute"].map((mode) => ({
    opcode: 0,
    mnemonic: "BRK",
    mode,
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
  /**
   * Decodes one instruction at `context.offset`.
   * @param context Byte source, offset, and 16-bit logical PC.
   * @returns Decoded instruction, or an error for an invalid PC, missing/truncated bytes, or an opcode absent from this CPU's table.
   */
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
    let value = bytes.at(1) ?? 0;
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

// packages/plugin-65xx/src/session-state.ts
var NES_65XX_SESSION_STATE_ID = "65xx.nes-session-state";
function isSessionStateKey2(value) {
  return value.id.length > 0;
}
function createSessionStateKey2(id2) {
  const key = { id: id2 };
  if (!isSessionStateKey2(key)) {
    throw new Error(`Invalid session state key '${id2}'.`);
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
  if (session.module) {
    if (segment.define) {
      for (const suffix of ["LOAD", "RUN", "SIZE", "RUN_END"]) {
        session.module.declare(`__${segment.name}_${suffix}__`, "import");
      }
    }
    state.currentSegment = null;
    state.currentLoadMemory = null;
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
    if (session.module) {
      session.module.declare(symbol.name, "import");
      continue;
    }
    session.globalSymbols.add(symbol.name);
    const value = session.operandResolver.getnum(symbol.valueExpr);
    session.symbolScope.setLabel(symbol.name, value, true);
  }
}
function openSegment(session, state, segment) {
  if (session.module) {
    const kind = segment.type === "bss" || segment.type === "zp" ? "bss" : "code";
    session.module.selectSection({ name: segment.name, kind });
    state.currentSegment = segment.name;
    state.currentLoadMemory = segment.load;
    return;
  }
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
function ld65LinkRecipe(config, target = "65xx.nes") {
  const symbols = [];
  for (const segment of config.segments.values()) {
    if (!segment.define) {
      continue;
    }
    for (const [suffix, property] of [
      ["LOAD", "load"],
      ["RUN", "run"],
      ["SIZE", "size"],
      ["RUN_END", "runEnd"]
    ]) {
      symbols.push({ name: `__${segment.name}_${suffix}__`, section: segment.name, property });
    }
  }
  for (const symbol of config.symbols) {
    symbols.push({
      name: symbol.name,
      expression: compileLinkExpression(parseExpressionNode(symbol.valueExpr), {
        reference: (node) => {
          if (node.type !== "identifier") {
            throw new Error("Linker-config symbols require global names.");
          }
          return { kind: "symbol", name: node.name };
        },
        current: () => {
          throw new Error("Linker-config symbols have no implicit section cursor.");
        },
        literal: (node) => {
          if (node.type !== "literal") {
            throw new Error("Linker-config expressions require integer literals.");
          }
          const text = node.value;
          if (text.startsWith("$")) {
            return Number.parseInt(text.slice(1), 16);
          }
          if (text.startsWith("%")) {
            return Number.parseInt(text.slice(1), 2);
          }
          return Number(text);
        }
      })
    });
  }
  return {
    target,
    regions: [...config.memories.values()].map(
      (region) => Object.assign(
        { name: region.name, start: region.start, size: region.size },
        region.fileOffset >= 0 ? { outputOffset: region.fileOffset } : {},
        region.fill ? { fillByte: region.fillval } : {},
        { addressSpace: "65xx.ines-address-space" }
      )
    ),
    placements: [...config.segments.values()].map(
      (segment) => Object.assign(
        { section: segment.name, load: segment.load, run: segment.run },
        segment.start !== void 0 ? { start: segment.start } : {}
      )
    ),
    // Explicit SYMBOLS declarations override generated defaults, matching the flat target's ordering.
    symbols: [...new Map(symbols.map((symbol) => [symbol.name, symbol])).values()]
  };
}
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
function splitTopLevelCommas(input2) {
  const parts2 = [];
  let current = "";
  let quote;
  for (const char of input2) {
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
function isRecord7(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function createNes65xxTargetOptions(configured) {
  const value = isRecord7(configured) ? configured : {};
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
function validate(address) {
  if (!Number.isInteger(address) || address < 0 || address > 65535) {
    throw new Error(`Address $${address.toString(16).toUpperCase()} is outside 16-bit NES space.`);
  }
  return address;
}
function createNesAddressSpace({
  state,
  options
}) {
  if (options.sourceStyle === "asar") {
    const nes = state.get(nes65xxSessionStateKey);
    const physical = (address) => {
      if (!Number.isSafeInteger(address) || address < 0 || address >= nes.linker.imageSize) {
        throw new Error(
          `NES physical write offset ${address} is outside the fixed cartridge layout.`
        );
      }
      return address;
    };
    return {
      addressWidth: 32,
      defaultOrigin: 0,
      normalizeForWrite: physical,
      advance: (address, amount) => address + amount,
      toOutputOffset(address) {
        if (!Number.isSafeInteger(address) || address < 0 || address > nes.linker.imageSize) {
          return -1;
        }
        return nes.header.length + address;
      },
      fromOutputOffset(offset) {
        const address = offset - nes.header.length;
        return address >= 0 && address < nes.linker.imageSize ? address : -1;
      },
      validateWrite: physical
    };
  }
  return {
    addressWidth: 16,
    defaultOrigin: 0,
    normalizeForWrite: validate,
    advance(address, amount) {
      return validate(address + amount & 65535);
    },
    toOutputOffset(address) {
      const nes = state.get(nes65xxSessionStateKey);
      if (!nes.currentLoadMemory) {
        return -1;
      }
      const memory = nes.linker.memories.get(nes.currentLoadMemory);
      if (!memory || memory.fileOffset < 0) {
        return -1;
      }
      if (address < memory.start || address >= memory.start + memory.size) {
        return -1;
      }
      return nes.header.length + memory.fileOffset + (address - memory.start);
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
    validateWrite(address) {
      validate(address);
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
    if (session.module) {
      for (const name of linkerDefinedSymbolNames(nes.linker)) {
        session.module.declare(name, "import");
      }
      session.bytes = 0;
      return;
    }
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
function parse(id2, { words }) {
  const keyword = (words[0] ?? "").replace(/^\./, "").toLowerCase();
  const family = id2.slice("65xx.directive.".length);
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
    let mode = "low";
    if (family === "hibytes") {
      mode = "high";
    } else if (family === "dbyt") {
      mode = "big";
    }
    return {
      operation: "mapped",
      mode,
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
  throw new Error(`Missing typed ca65 directive grammar '${id2}'.`);
}
function execute(node, { session, state, targetId }, id2) {
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
        session.module?.selectSection({ name: node.name });
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
        if (session.module) {
          if (id2.endsWith(".export")) {
            session.module.exportSymbol(name);
          } else {
            session.module.declare(name, "import");
          }
        } else {
          markGlobalSymbol(session, name);
        }
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
      if (session.module) {
        for (const value of node.values) {
          const expression = node.mode === "big" ? value : {
            type: "unary",
            operator: node.mode === "low" ? "<" : ">",
            argument: value
          };
          session.module.write(
            expression,
            node.mode === "big" ? 2 : 1,
            node.mode === "big" ? "big" : "little"
          );
        }
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
      if (session.module) {
        if (node.operation === "align") {
          session.module.align(value, fill);
        } else {
          session.module.reserve(value, node.fill ? fill : void 0);
        }
        return;
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
function ca65DirectiveSyntax(id2) {
  const codec = syntaxCodec("1", (input2) => parse(id2, input2), schema);
  return {
    ...codec,
    bind(context) {
      if ((id2 === "65xx.directive.incbin" || id2 === "65xx.directive.assert") && context.session.targetOptions.sourceStyle === "asar") {
        return void 0;
      }
      return { execute: (payload) => execute(codec.read(payload), context, id2) };
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
    const entries = grouped.get(form.mnemonic) ?? [];
    entries.push(form);
    grouped.set(form.mnemonic, entries);
  }
  return [...grouped.entries()].toSorted(([left], [right]) => left.localeCompare(right)).map(([mnemonic, entries]) => ({
    mnemonic,
    summary: summaries[mnemonic] ?? (entries.some((entry) => !entry.documented) ? "Undocumented NMOS 6502 instruction." : `${mnemonic} instruction.`),
    modes: entries.map((form) => ({
      mode: form.mode,
      syntax: syntax[form.mode],
      opcode: form.opcode,
      size: form.encoding.length + form.operands.reduce((size, operand) => size + operand.width, 0)
    }))
  }));
}

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
function plan(input2, start) {
  let text = input2.trim();
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
    unbound: /![\w{]|<[^>]+>|\\[A-Z_a-z]/.test(input2),
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

// packages/plugin-65xx/src/target/link-target.ts
function createNesSourceLinkRecipe(context, sections) {
  if (context.options.sourceStyle !== "asar") {
    throw new Error("The NES Asar adapter requires sourceStyle: asar in target configuration.");
  }
  const state = context.state.get(nes65xxSessionStateKey);
  return addressedSourceLinkRecipe({
    target: context.targetId,
    sections,
    outputOffset: (address) => state.header.length + address,
    prefix: state.header,
    outputSize: state.header.length + state.linker.imageSize,
    fillByte: state.fillByte
  });
}
function createNesLinkTarget() {
  return {
    target: "65xx.nes",
    revision: "nes-link-v1",
    validate(modules, recipe, allocations) {
      const header = recipe.regions.find(
        (region) => region.outputOffset === 0 && region.initialBytes
      )?.initialBytes;
      if (!header || header.length !== 16 || header[0] !== 78 || header[1] !== 69 || header[2] !== 83 || header[3] !== 26) {
        throw new LinkError("ines-header", "Link recipe requires a complete iNES header.");
      }
      for (const module of modules) {
        const declared = module.targetOptions.header;
        if (!Array.isArray(declared) || declared.length !== header.length || declared.some((byte, index) => byte !== header[index])) {
          throw new LinkError(
            "ines-header",
            `Module '${module.id}' declares an incompatible iNES header.`
          );
        }
      }
      for (const allocation of allocations) {
        if (allocation.runAddress < 0 || allocation.runAddress + allocation.size > 65536) {
          throw new LinkError(
            "nes-address",
            `Section '${allocation.module}:${allocation.section}' exceeds the 16-bit run address space.`
          );
        }
      }
    },
    finalize() {
    }
  };
}

// packages/plugin-65xx/src/operands/resolution.ts
function valueWidth(value) {
  if (!Number.isFinite(value)) {
    return 4;
  }
  let integer4 = Math.floor(Math.abs(value));
  let digits = 1;
  while (integer4 >= 16) {
    integer4 = Math.floor(integer4 / 16);
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
function expand2(plan2, frame) {
  if (frame.isRelocatable && (frame.sourceAdapter !== "asar" || frame.previewSource(plan2.scalar) === void 0)) {
    return {
      length: plan2.force ?? plan2.hexWidth ?? 2,
      generated: false,
      value: 0,
      flattened: false
    };
  }
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
  const whole = expand2(policy.whole, frame);
  const operands = syntax2.operands;
  const first = operands.at(0);
  let mode = "unknown";
  let length = whole.length;
  if (!policy.hasOperand) {
    mode = "implied";
  } else if (policy.originalRegister === "a") {
    mode = "accumulator";
  } else if (policy.originalRegister === "q") {
    mode = "quadAccumulator";
  } else if (policy.whole.immediate && whole.generated) {
    mode = "immediate";
  } else if (first?.kind === "immediate" && operands.length >= 2) {
    const address = expand2(policy.parts[1], frame);
    const second = operands[1];
    const indexed = second.kind === "memory" && second.index?.register === "x";
    mode = address.length <= 1 ? "immediateZeroPage" : "immediateAbsolute";
    if (indexed) {
      mode += "IndexedX";
    }
  } else if (first?.kind === "immediate") {
    mode = "immediate";
  } else if (operands.length >= 2 && policy.whole.index && policy.whole.scalar.expression.type === "error") {
    mode = length <= 1 ? "zeroPage" : "absolute";
    mode += "Indexed" + policy.whole.index.toUpperCase();
  } else if (first?.kind === "invalid") {
    mode = length <= 1 ? "zeroPage" : "absolute";
  } else if (operands.length >= 2) {
    if (policy.parts.length === 3) {
      mode = "blockTransfer";
    } else if (first?.kind === "register" && first.name === "a") {
      mode = "accumulatorRelative";
    } else if (operands[1].kind === "immediate") {
      mode = "zeroPageImmediate";
    } else {
      mode = "zeroPageRelative";
    }
  } else if (first?.kind === "memory") {
    const index = first.index?.register;
    const delimiter = whole.flattened ? "none" : first.delimiter;
    if (delimiter === "parentheses" && first.innerIndex === "s" && index === "y") {
      mode = "stackRelativeIndirectIndexedY";
    } else if (delimiter === "parentheses" && first.index?.position === "inside" && index === "x") {
      length = expand2(policy.inner, frame).length;
      mode = length <= 1 ? "indexedIndirectX" : "absoluteIndexedIndirect";
    } else if (delimiter === "parentheses" && first.index?.position === "outside" && index === "y") {
      mode = "indirectIndexedY";
    } else if (delimiter === "parentheses" && first.index?.position === "outside" && index === "z") {
      mode = "zeroPageIndirectIndexedZ";
    } else if (delimiter === "brackets" && index === "z") {
      mode = "basePageIndirectIndexedZ";
    } else if (delimiter === "brackets" && !index) {
      mode = "zeroPageIndirectLong";
    } else if (delimiter === "parentheses" && !index) {
      length = expand2(policy.inner, frame).length;
      mode = length <= 1 ? "zeroPageIndirect" : "indirect";
    } else if (delimiter === "none") {
      if (index === "s") {
        mode = "stackRelative";
      } else if (index === "z") {
        mode = "unknown";
      } else if (index === "x" && length > 2) {
        mode = "absoluteLongIndexedX";
      } else {
        mode = length <= 1 ? "zeroPage" : "absolute";
        if (index === "x" || index === "y") {
          mode += "Indexed" + index.toUpperCase();
        }
      }
    }
  }
  return {
    mode,
    length,
    generated: whole.generated,
    value: whole.value,
    native: policy.whole.native,
    specialPage: mode === "absolute" && (whole.generated && whole.value >= 65280 && whole.value <= 65535 || policy.hexSpecialPage)
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
      expand2(part, frame);
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
  for (const mode of Object.keys(addressingModes)) {
    if (value === mode) {
      return true;
    }
  }
  return false;
}
function mappedAddressingMode(table, mode) {
  if (mode === void 0 || !isAddressingMode(mode)) {
    return void 0;
  }
  return table[mode];
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
  /** 65xx encodings can be emitted into relocatable objects. */
  supportsRelocatable = true;
  /** Unbound operand templates stay errors at encode time, not parse time. */
  deferOperandBindingErrors = true;
  /** Assembly forms enabled for this CPU's feature set. */
  forms;
  /** Editor/LSP instruction catalog derived from `forms`. */
  catalog;
  /** Lookup of enabled forms grouped by canonical mnemonic. */
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
      const [mode, length, generated, scalar3, native, specialPage] = tuple;
      if (value.length !== 6 || typeof mode !== "string" || typeof length !== "number" || typeof generated !== "boolean" || typeof scalar3 !== "number" || typeof native !== "boolean" || typeof specialPage !== "boolean") {
        throw new Error("Invalid prepared 65xx snapshot.");
      }
      return { mode, length, generated, value: scalar3, native, specialPage };
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
  /** Return encoded size for the resolved operand frame without emitting bytes. */
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
      const variantArchitectures = Object.entries(variantFormsByCpuId).filter(([, entries]) => entries.some((entry) => entry.mnemonic === parsed.mnemonic)).map(([cpuId]) => cpuId);
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
    let mode = operand.mode;
    if (parsed.originalRegister === "a") {
      mode = "accumulator";
    }
    if (parsed.originalRegister === "q") {
      mode = "quadAccumulator";
    }
    if (this.cpu.id === "65xx.m740" && mnemonic === "JSR" && mode === "absolute" && operand.specialPage) {
      mode = "specialPage";
    }
    if (hasOperand && forms.some((entry) => entry.mode === "relative16")) {
      mode = "relative16";
    } else if (hasOperand && forms.some((entry) => entry.mode === "relative")) {
      mode = "relative";
    }
    if (!hasOperand && !forms.some((entry) => entry.mode === "implied")) {
      if (forms.some((entry) => entry.mode === "accumulator")) {
        mode = "accumulator";
      } else if (forms.some((entry) => entry.mode === "quadAccumulator")) {
        mode = "quadAccumulator";
      }
    }
    if (forcedWidth) {
      const byteMode = mappedAddressingMode(absoluteToDirect, mode);
      const wordMode = mappedAddressingMode(directToAbsolute, mode);
      const alreadyRequestedWidth = forcedWidth === 1 && mode.startsWith("zeroPage") || forcedWidth === 2 && (mode === "absolute" || mode === "indirect" || mode.startsWith("absoluteIndexed"));
      if (!byteMode && !wordMode && !alreadyRequestedWidth) {
        throw frame.error(
          `Width suffix '.${forcedWidth === 1 ? "b" : "w"}' is not valid for ${mnemonic} ${mode}.`
        );
      }
      const promoted = forcedWidth === 1 ? byteMode : wordMode;
      mode = promoted ?? mode;
    }
    let form = forms.find((entry) => entry.mode === mode);
    const widened = mappedAddressingMode(directToAbsolute, mode);
    if (!form && widened) {
      form = forms.find((entry) => entry.mode === widened);
    }
    if (!form) {
      const accepted = forms.map((entry) => entry.mode).join(", ");
      throw frame.error(
        `${mnemonic} does not support addressing mode '${mode}' on ${this.cpu.id}. Expected ${accepted}.`
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
    if (frame.isRelocatable) {
      return this.encodeModule(frame, context, syntax2, form);
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
  /** Form tables supply every field's width/order, including vendor and prefixed instructions. */
  encodeModule(frame, context, syntax2, form) {
    const instruction = new RelocatableInstruction(frame, context).opcode(...form.encoding);
    const parts2 = syntax2.policy65xx.parts;
    const scalar3 = selectedScalar(syntax2);
    let fields = [scalar3];
    switch (form.codec) {
      case "none":
        fields = [];
        break;
      case "accumulator-relative8":
        fields = [parts2[1].scalar];
        break;
      case "zero-page-relative8":
      case "zero-page-immediate8":
      case "three-unsigned16-le":
      case "immediate-unsigned8":
      case "immediate-unsigned16":
        fields = parts2.slice(0, form.operands.length).map((part) => part.scalar);
        break;
      case "relative16":
      case "relative8":
      case "special-page":
      case "unsigned16-le":
      case "unsigned24-le":
      case "unsigned8":
        if (!syntax2.policy65xx.hasOperand && form.mnemonic === "BRK") {
          fields = [linkConstant(0)];
        }
        break;
    }
    if (fields.length !== form.operands.length || fields.some((field) => !field)) {
      throw frame.error(`${form.mnemonic} requires ${form.operands.length} encoded operands.`);
    }
    for (let index = 0; index < fields.length; index++) {
      const field = form.operands[index];
      const relative = field.relative === true || form.codec === "relative8" || form.codec === "relative16" || form.codec === "zero-page-relative8" && index === 1 || form.codec === "accumulator-relative8";
      const encoding = {
        width: field.width,
        kind: relative ? "relative" : "absolute",
        addressWidth: 16,
        wrapWidth: 16
      };
      if (relative) {
        const start = frame.sectionPosition();
        instruction.field(fields[index], {
          ...encoding,
          signed: true,
          pc: {
            section: start.section,
            offset: frame.instructionAddress + (form.relativeBaseOffset ?? modeSize(form))
          }
        });
      } else if (form.codec === "special-page") {
        instruction.field(fields[index], { ...encoding, minimum: 65280, maximum: 65535 });
      } else {
        const immediate = form.mode === "immediate" || form.codec.startsWith("immediate-") && index === 0 || form.codec === "zero-page-immediate8" && index === 1;
        instruction.field(fields[index], {
          ...encoding,
          minimum: immediate ? -(2 ** (8 * field.width - 1)) : 0,
          constraint: form.operandConstraint === "power-of-two" ? "powerOfTwo" : void 0
        });
      }
    }
    instruction.finish(`${form.mnemonic}:${form.mode}`, { cpu: this.cpu.id, mode: form.mode });
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
var directive = (id2, keywords) => {
  const wanted = new Set(keywords);
  return {
    id: id2,
    keywords,
    phase: "lowered",
    syntax: ca65DirectiveSyntax(id2),
    tooling: ca65Tooling.filter((entry) => wanted.has(entry.keyword))
  };
};
function validate2(address) {
  if (!Number.isInteger(address) || address < 0 || address > 65535) {
    throw new Error(`Address $${address.toString(16).toUpperCase()} is outside flat16.`);
  }
  return address;
}
function createFlat65xxAddressSpace({ options }) {
  const { origin } = createRaw65xxTargetOptions(options);
  return {
    addressWidth: 16,
    defaultOrigin: origin,
    normalizeForWrite: validate2,
    advance(address, amount) {
      return validate2(address + amount);
    },
    toOutputOffset(address) {
      return Number.isInteger(address) && address >= origin && address <= 65535 ? address - origin : -1;
    },
    fromOutputOffset(offset) {
      const address = origin + offset;
      return Number.isInteger(offset) && offset >= 0 && address <= 65535 ? address : -1;
    },
    validateWrite(address, width) {
      validate2(address);
      validate2(address + width - 1);
      if (address < origin) {
        throw new Error(
          `Address $${address.toString(16).toUpperCase()} precedes raw origin $${origin.toString(16).toUpperCase()}.`
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
    createOptions: createNes65xxTargetOptions,
    createLinkTarget: createNesLinkTarget,
    createSourceLinkRecipe: createNesSourceLinkRecipe,
    createLinkRecipe: ({ state }) => {
      const nes = state.get(nes65xxSessionStateKey);
      const recipe = ld65LinkRecipe(nes.linker, NES_65XX_TARGET_ID);
      return {
        ...recipe,
        regions: [
          {
            name: "__ines_header",
            start: 0,
            size: nes.header.length,
            outputOffset: 0,
            initialBytes: [...nes.header]
          },
          // The flat NES lifecycle fills the complete cartridge with the target byte, including MEMORY gaps.
          // Keep its established output here; ld65LinkRecipe remains available for explicit per-region policies.
          ...recipe.regions.map(
            (region) => Object.assign(
              {},
              region,
              region.outputOffset !== void 0 ? {
                outputOffset: region.outputOffset + nes.header.length,
                fillByte: nes.fillByte
              } : {}
            )
          )
        ]
      };
    }
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

// packages/language-server/src/asset-preview-conversion.ts
var registry3 = new AssetRegistry().registerImporter(rawImporter).registerImporter(jsonImporter).registerImporter(pngImporter).registerImporter(asepriteRasterImporter).registerImporter(waveImporter);
for (const encoder of [...withAudioEncoder(withImageEncoders(snesNativeEncoders)), rawEncoder]) {
  registry3.registerEncoder(encoder);
}
function storagePixels(composed, width, height, indexByCoordinate) {
  const widthTiles = width / 8;
  const heightTiles = height / 8;
  const result = new Uint8Array(composed.length);
  for (let logical = 0; logical < indexByCoordinate.length; logical++) {
    const storage = indexByCoordinate[logical];
    if (!Number.isSafeInteger(storage) || storage < 0 || storage >= widthTiles * heightTiles) {
      throw new Error("Image layout contains an invalid storage tile index.");
    }
    for (let row = 0; row < 8; row++) {
      const source = ((Math.floor(logical / widthTiles) * 8 + row) * width + logical % widthTiles * 8) * 4;
      const target = ((Math.floor(storage / widthTiles) * 8 + row) * width + storage % widthTiles * 8) * 4;
      result.set(composed.subarray(source, source + 32), target);
    }
  }
  return result;
}
function convertAssetPreview(input2, adapters = []) {
  if (input2.format === NES_CHR_CODEC) {
    return convertNesChrPreview(input2);
  }
  const matches = adapters.filter((adapter) => adapter.formats.includes(input2.format));
  if (matches.length > 1) {
    throw new Error("Ambiguous asset preview registration.");
  }
  if (matches.length === 1) {
    return matches[0].convert(input2);
  }
  const result = convertAsset(registry3, input2);
  const outputName = input2.output ?? result.primaryOutput;
  const selected = Object.hasOwn(result.outputs, outputName) ? result.outputs[outputName] : void 0;
  if (!selected) {
    throw new Error(`Asset format '${input2.format}' has no output '${outputName}'.`);
  }
  const common = {
    sourceBytes: input2.source.bytes.length,
    encodedBytes: selected.bytes.length,
    format: result.encoder.id,
    output: outputName,
    metadata: selected.metadata
  };
  const preview = Object.hasOwn(result.outputs, "preview") ? result.outputs.preview : void 0;
  if (preview?.mediaType === "application/x-rgba") {
    const width = Number(preview.metadata?.width);
    const height = Number(preview.metadata?.height);
    const thumbnail = rgbaPreviewPng(preview.bytes, width, height, 192);
    const composed = rgbaNativePng(preview.bytes, width, height);
    const indexes = preview.metadata?.tileIndexByCoordinate;
    let storage;
    if (Array.isArray(indexes) && width % 8 === 0 && height % 8 === 0) {
      storage = rgbaNativePng(storagePixels(preview.bytes, width, height, indexes), width, height);
    }
    return {
      ...common,
      kind: "image",
      thumbnailPngBase64: Buffer.from(thumbnail).toString("base64"),
      composedPngBase64: Buffer.from(composed).toString("base64"),
      storagePngBase64: storage && Buffer.from(storage).toString("base64")
    };
  }
  if (result.document.kind === "pcm-audio" && result.encoder.id === "snes.brr") {
    const audio = readPcmAudio(result.document.value);
    const reviewWav = Object.hasOwn(result.outputs, "reviewWav") ? result.outputs.reviewWav : void 0;
    const decodedWav = reviewWav?.bytes;
    if (!decodedWav) {
      throw new Error("BRR preview omitted its decoded review WAVE.");
    }
    return {
      ...common,
      kind: "audio",
      waveformPngBase64: Buffer.from(waveformPreviewPng(audio.samples)).toString("base64"),
      sourceWavBase64: Buffer.from(input2.source.bytes).toString("base64"),
      decodedWavBase64: Buffer.from(decodedWav).toString("base64")
    };
  }
  return { ...common, kind: "binary" };
}
function convertNesChrPreview(input2) {
  const codec = nesAssetFormats.find((format) => format.id === NES_CHR_CODEC);
  const result = codec.convert(input2.source, input2.options, input2.resources);
  const output = input2.output ?? result.primaryOutput;
  if (output !== result.primaryOutput) {
    throw new Error(`Asset format '${input2.format}' has no output '${output}'.`);
  }
  const image = readAssetPng(input2.source.bytes).toIndexed({ copy: false });
  const rgba = new Uint8Array(image.indexes.length * 4);
  for (let pixel = 0; pixel < image.indexes.length; pixel++) {
    rgba.set(image.palette[image.indexes[pixel]], pixel * 4);
  }
  const composed = Buffer.from(rgbaNativePng(rgba, image.width, image.height)).toString("base64");
  return {
    kind: "image",
    sourceBytes: input2.source.bytes.length,
    encodedBytes: result.outputs[output].bytes.length,
    format: input2.format,
    output,
    metadata: {
      width: image.width,
      height: image.height,
      tiles: image.indexes.length / 64,
      bitDepth: 2,
      tileOrder: "row-major",
      palette: "source PNG indexes; gameplay colors are not inferred"
    },
    thumbnailPngBase64: Buffer.from(rgbaPreviewPng(rgba, image.width, image.height, 192)).toString(
      "base64"
    ),
    // NES source atlases already follow native storage order; both views must show the same pixels.
    composedPngBase64: composed,
    storagePngBase64: composed
  };
}

// packages/language-server/src/asset-preview-host.ts
var convertAssetPreview2 = (input2) => convertAssetPreview(input2, somPreviewAdapters);

// packages/language-server/src/asset-preview-worker.ts
if (!parentPort) {
  throw new Error("Asset preview worker requires a parent port.");
}
parentPort.on("message", (message) => {
  try {
    parentPort.postMessage({ id: message.id, result: convertAssetPreview2(message.input) });
  } catch (error) {
    parentPort.postMessage({
      id: message.id,
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

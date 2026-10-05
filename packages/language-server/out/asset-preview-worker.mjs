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

// packages/language-server/src/asset-preview-worker.ts
import { parentPort } from "node:worker_threads";

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
function isNamespacedId(id) {
  const parts = id.split(".");
  return parts.length > 1 && /^[a-z][\da-z-]*$/.test(parts[0]) && parts.slice(1).every((part) => /^[\da-z][\da-z-]*$/.test(part));
}

// packages/assets/src/registry.ts
var AssetRegistry = class {
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
function convertAsset(registry3, request) {
  const importer = registry3.importerFor(request.source.mediaType);
  const encoder = registry3.encoderFor(request.format);
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
  static #chunkBuffer(chunk, minimumSize, littleEndian2 = true) {
    const buffer = new data_buffer_default(typeof Buffer !== "undefined" && Buffer.isBuffer(chunk) ? new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength) : chunk);
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
  static decodePEAK(chunk, littleEndian2 = true) {
    debug2("decodePEAK");
    const peak = _a.#chunkBuffer(chunk, 8, littleEndian2);
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
var audio_wav_default = AudioWAV;

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
var nativeEncoder = (id, kind, output, modelField, encode, decode) => Object.freeze({
  id,
  version: "1.0.0",
  inputKinds: [kind],
  primaryOutput: output,
  encode: (document2, options) => {
    if (Object.keys(options).length !== 0) {
      throw new Error(`Native encoder '${id}' accepts no options.`);
    }
    if (!isRecord(document2.value)) {
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
      const decoded = decodeNibble(nibble, range, filter, state);
      const error = (target - decoded) ** 2;
      if (error < bestError || error === bestError && Math.abs(nibble) < Math.abs(bestNibble)) {
        bestNibble = nibble;
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
          normalizedOptions: { padding: options.padding, loop }
        };
      }
    });
  });
}

// packages/assets/src/data.ts
var rawImporter = Object.freeze({
  id: "uttori.import.raw",
  version: "1.0.0",
  mediaTypes: ["application/octet-stream"],
  import: (input) => ({
    kind: "raw",
    value: input.bytes.slice()
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
  }).map(([key, rows]) => [key, Object.freeze(rows)])));
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
      if (mode === "copy") {
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
  const rows = block.cells.length / block.columns;
  return block.cells.map((cell, index) => {
    const column = index % block.columns;
    const row = Math.floor(index / block.columns);
    return {
      ...cell,
      id: JSON.stringify([block.id, index]),
      x: block.x + (block.flipX ? block.columns - column - 1 : column) * block.cellWidth,
      y: block.y + (block.flipY ? rows - row - 1 : row) * block.cellHeight,
      flipX: block.flipX ?? false,
      flipY: block.flipY ?? false
    };
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
var externalPalette = (input) => {
  if (input.mediaType !== "application/json") {
    throw new Error("External palette resource must be application/json.");
  }
  if (input.bytes.length > 64 * 1024) {
    throw new Error("External palette JSON exceeds 64 KiB.");
  }
  const value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(input.bytes));
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

// packages/core/src/plugin/contracts.ts
var PLUGIN_API_VERSION = 1;
function definePlugin(plugin2) {
  return plugin2;
}

// packages/assets/src/secret-of-mana/som-boss-graphics.ts
function expandBossGraphics(source, size) {
  if (!(source instanceof Uint8Array) || !Number.isInteger(size) || size <= 0 || size > 65535) {
    throw new Error("Boss graphics need bytes and a positive 16-bit output size.");
  }
  const length = Math.ceil(size / 8) * 8;
  const data = new Uint8Array(length);
  let cursor = 0;
  for (let output = 0; output < length; ) {
    if (cursor >= source.length) {
      throw new Error("Truncated boss graphics mask.");
    }
    const mask = source[cursor++];
    for (let bit = 7; bit >= 0; bit--, output++) {
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
  const output = [];
  for (let start = 0; start < data.length; start += 8) {
    let mask = 0;
    const literals = [];
    for (let bit = 0; bit < 8; bit++) {
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
  const decoded = expandBossGraphics(encoded, data.length);
  if (decoded.consumed !== encoded.length || decoded.data.some((byte, index) => byte !== data[index])) {
    throw new Error("Boss graphics mask inverse failed.");
  }
  return encoded;
}

// packages/assets/src/secret-of-mana/som-body-frame.ts
var signed7 = (byte) => (byte & 63) - (byte & 64);
function decodeBodyFrame(input) {
  if (!Array.isArray(input) && !(input instanceof Uint8Array) || input.length < 2 || input.length > 157 || [...input].some((v) => !Number.isInteger(v) || v < 0 || v > 255)) {
    throw new Error("Invalid bounded body frame bytes.");
  }
  const bytes = Uint8Array.from(input);
  const groups = bytes[0] & 15 || 1;
  const tileOffsets = [];
  let offset = 1;
  while (tileOffsets.length < groups * 4) {
    if (offset + 2 > bytes.length) {
      throw new Error("Truncated sprite tile word.");
    }
    const word = bytes[offset] | bytes[offset + 1] << 8;
    offset += 2;
    const count = word & 32768 ? (word & 15) + 1 : 1;
    for (let i = 0; i < count && tileOffsets.length < groups * 4; i++) {
      const increment = (word & 49152) === 49152 ? i : 0;
      tileOffsets.push((word & 16368) * 2 + increment * 32 & 65535);
    }
  }
  if (offset + groups * 2 > bytes.length) {
    throw new Error("Missing sprite block offsets.");
  }
  const coordinateOffsets = Array.from({ length: groups }, (_, i) => ({
    y: offset + i * 2,
    x: offset + i * 2 + 1
  }));
  const blocks = coordinateOffsets.map(({ x, y }) => ({
    x: signed7(bytes[x]),
    y: signed7(bytes[y]),
    flipX: !!(bytes[x] & 128),
    priority: !!(bytes[y] & 128)
  }));
  offset += groups * 2;
  const boxes = Number(!!(bytes[0] & 32)) + Number(!!(bytes[0] & 64));
  if (bytes.length - offset !== boxes * (bytes[0] & 16 ? 3 : 2)) {
    throw new Error("Frame tail disagrees with header and pointer bound.");
  }
  return {
    header: bytes[0],
    groups,
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
    p.external?.indexes ?? null
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
        references[index]
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
  const decoded = decodeBodyFrame(native.bytes);
  if (decoded.groups !== frame.blocks.length) {
    throw new Error(`Native block count differs: ${frame.id}.`);
  }
  for (const [index, block] of frame.blocks.entries()) {
    const expected = decoded.blocks[index];
    if (block.size !== 16 || block.flipY || block.x !== expected.x || block.y !== expected.y || block.flipX !== expected.flipX || block.priority !== expected.priority) {
      throw new Error(`Native frame and block disagree: ${frame.id}/${block.id}.`);
    }
    for (const [quadrant, address] of block.tiles.entries()) {
      if (typeof address !== "number" || !Number.isSafeInteger(address)) {
        throw new Error(`Body tiles require ROM addresses: ${frame.id}.`);
      }
      const relative = decoded.tileOffsets[index * 4 + quadrant];
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
function paletteRecord(catalog, id) {
  if (!isSpritePaletteCatalog(catalog) || typeof id !== "string") {
    throw new Error("Palette catalogue requires version 1 palette records.");
  }
  const palette = Object.hasOwn(catalog.palettes, id) ? catalog.palettes[id] : void 0;
  if (!palette || palette.romAddress !== id || ![0, 1].includes(palette.firstIndex) || !Array.isArray(palette.words) || palette.words.length < 1 || palette.words.length > 256 || palette.words.some((word) => typeof word !== "string" || !/^[\dA-Fa-f]{4}$/.test(word))) {
    throw new Error(`Unknown or invalid ROM palette ${id}.`);
  }
  return palette;
}
function spritePaletteColors(catalog, id) {
  const palette = paletteRecord(catalog, id);
  if (palette.words.length !== 16 - palette.firstIndex) {
    throw new Error(`Frame sprite palette ${id} needs sixteen display slots.`);
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
function spritePaletteBytes(catalog, id, { wordOffset = 0, wordCount } = {}) {
  const record = paletteRecord(catalog, id);
  const count = wordCount ?? record.words.length - wordOffset;
  if (!Number.isSafeInteger(wordOffset) || !Number.isSafeInteger(count) || wordOffset < 0 || count < 1 || wordOffset + count > record.words.length) {
    throw new Error(`Invalid ROM palette word slice ${id}.`);
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
  for (const id of Object.keys(catalog.palettes)) {
    const record = paletteRecord(catalog, id), start = Number.parseInt(id, 16);
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
function spritePalettePreview(catalog, id) {
  const palette = paletteRecord(catalog, id);
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
    throw new Error(`ROM palette ${id} has invalid preview columns.`);
  }
  const rows = Math.ceil(colors.length / columns);
  const width = columns * 9 + 1;
  const height = rows * 9 + 1;
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
function inspectFrameAtlas(source, layout2, catalog, options = {}) {
  validateFrameLayout(layout2, options);
  let image = readIndexedImage(pngImporter.import(source).value);
  if (image.width !== layout2.width || image.height !== layout2.height) {
    throw new Error("Frame atlas must be an indexed PNG with the layout's exact dimensions.");
  }
  const colors = layout2.paletteRefs.flatMap((id) => spritePaletteColors(catalog, id));
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
  }).sort((a, b) => a.start - b.start);
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
  const bytes = new Uint8Array(chunks.reduce((size, chunk) => size + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
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

// packages/assets/src/secret-of-mana/som-lz.ts
import assert from "node:assert/strict";
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
  assert(source instanceof Uint8Array, "Expected byte input.");
  assert(
    Number.isSafeInteger(offset) && offset >= 0 && offset + LZ_HEADER_BYTES <= source.length,
    "Truncated LZ header."
  );
  assert(Number.isSafeInteger(maxOutputBytes) && maxOutputBytes >= 0, "Invalid LZ output limit.");
  const mode = source[offset];
  assert(mode < DISTANCE_MASKS.length, "Invalid LZ mode.");
  const mask = DISTANCE_MASKS[mode];
  const size = source[offset + 2] << 8 | source[offset + 3];
  assert(size <= maxOutputBytes, "LZ decoded size exceeds output limit.");
  const data = new Uint8Array(size);
  let cursor = offset + LZ_HEADER_BYTES;
  let written = 0;
  let literalRuns = 0;
  let copyRuns = 0;
  while (written < size) {
    assert(cursor < source.length, "Truncated LZ token.");
    const token = source[cursor++];
    if (token < LZ_COPY_FLAG) {
      const length = token + 1;
      assert(cursor + length <= source.length, "Truncated LZ literal.");
      assert(written + length <= size, "LZ literal exceeds declared output size.");
      data.set(source.subarray(cursor, cursor + length), written);
      cursor += length;
      written += length;
      literalRuns++;
    } else {
      assert(cursor < source.length, "Truncated LZ distance.");
      const distance = ((token & mask) << 8) + source[cursor++] + 1;
      const length = Math.floor((token & LZ_TOKEN_PAYLOAD_MASK) / (mask + 1)) + LZ_MIN_COPY_BYTES;
      assert(distance <= written, "LZ reference precedes output.");
      assert(written + length <= size, "LZ copy exceeds declared output size.");
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
  assert(options && typeof options === "object" && !Array.isArray(options), "Invalid LZ options.");
}
function compressSomLz(source, options = {}) {
  assert(source instanceof Uint8Array, "Expected byte input.");
  assert(source.length <= LZ_MAX_OUTPUT_BYTES, "LZ decoded size exceeds 16-bit header.");
  assertLzOptions(options);
  assert(
    Object.keys(options).every((key) => ["mode", "unusedHeaderByte"].includes(key)),
    "Unknown LZ option."
  );
  const selected = options.mode ?? "auto";
  const header = options.unusedHeaderByte ?? 0;
  if (selected !== "auto" && !(typeof selected === "number" && Number.isInteger(selected) && selected >= 0 && selected < DISTANCE_MASKS.length)) {
    assert(false, "Invalid LZ mode.");
  }
  if (typeof header !== "number" || !Number.isInteger(header) || header < 0 || header > 255) {
    assert(false, "Invalid unused LZ header byte.");
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
  assert(best, "LZ encoder produced no candidate.");
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

// packages/assets/src/secret-of-mana/som-room-assets.ts
import assert2 from "node:assert/strict";

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
  let columns = 0, rows = 0, placementWork = 0;
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
    rows = Math.max(rows, piece.y + layout2.height);
    if (columns > 128 || rows > 128) {
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
  const width = columns * 16, height = rows * 16;
  rasterArea(width, height, "Room composition", ASSET_LIMITS.interchangeSide);
  const maps = [
    new Int16Array(columns * rows).fill(-1),
    new Int16Array(columns * rows).fill(-1)
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
    assert2.fail(`${name} must be 0..${maximum}.`);
  }
  return value;
}
function parseRoomAsset(source) {
  assert2.equal(source.mediaType, "application/json", "Room source must be JSON.");
  const parsed = JSON.parse(new TextDecoder().decode(source.bytes));
  if (!isRecord5(parsed)) {
    assert2.fail("Room source must be a JSON object.");
  }
  assert2.equal(parsed.format, "som.room");
  assert2.equal(parsed.version, 1);
  integer2(parsed.id, 510, "room id");
  assert2(
    Array.isArray(parsed.header) && parsed.header.length === 8,
    "Room header requires eight bytes."
  );
  for (const byte of parsed.header) {
    integer2(byte, 255, "header byte");
  }
  for (const key of ["entities", "pieces", "triggers"]) {
    assert2(Array.isArray(parsed[key]), `Missing room ${key}.`);
  }
  if (!isRoomAsset(parsed)) {
    assert2.fail("Room entities, pieces, and triggers must match the room record.");
  }
  return parsed;
}
function parseRoomPreview(bytes) {
  const parsed = JSON.parse(new TextDecoder().decode(bytes));
  if (!isRecord5(parsed)) {
    assert2.fail("Room preview resource must be a JSON object.");
  }
  assert2.equal(parsed.format, "som.room.preview");
  assert2.equal(parsed.version, 1);
  if (!isRoomPreview(parsed)) {
    assert2.fail("Room preview resource must include tileset and layout records.");
  }
  return parsed;
}
function condition(record) {
  const variable = integer2(record.variable, 255, "story variable");
  const minimum = integer2(record.minimum, 15, "story minimum"), maximum = integer2(record.maximum, 15, "story maximum");
  assert2(minimum <= maximum, "Story range is reversed.");
  return [variable, minimum << 4 | maximum];
}
function encodeRoomSection(room, section) {
  assert2(
    ["objects", "assembly", "triggers"].includes(section),
    "Room section must be objects, assembly or triggers."
  );
  const bytes = [];
  if (section === "objects") {
    bytes.push(...room.header);
    for (const entity of room.entities) {
      const flags = integer2(entity.flags, 255, "entity flags");
      assert2.equal(flags & 63, 0, "Only packed entity flags 40/80 are defined.");
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
        assert2(piece.marker === 254 || piece.marker === 255, "Layer marker must be FE or FF.");
        bytes.push(piece.marker);
        layer = piece.marker - 253;
      }
      assert2.equal(piece.layer, layer, "A layer change requires an explicit marker.");
      const predicate = condition(piece);
      assert2(predicate[0] < 254, "FE/FF are layer markers, not piece story indexes.");
      const layout2 = integer2(piece.layout, 1023, "layout id");
      assert2(layout2 > 0, "Native layout IDs are one-based.");
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
  assert2(
    owner && Number.isInteger(owner.address) && Number.isInteger(owner.bytes),
    "Missing fixed section ownership."
  );
  assert2.equal(
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
  assert2(
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

// packages/assets/src/secret-of-mana/som-world-rle.ts
function decodeWorldRow(bytes, size = 512) {
  if (!Number.isSafeInteger(size) || size < 1 || size > 65536) {
    throw new Error("World row size must be 1..65536 tiles.");
  }
  const data = new Uint8Array(size);
  let input = 0, output = 0;
  while (output < size) {
    if (input >= bytes.length) {
      throw new Error("Truncated world row token.");
    }
    const token = bytes[input++];
    let count = 1, tile = token;
    if (token >= 192) {
      count = (token & 63) + 1;
      if (input >= bytes.length) {
        throw new Error("Truncated world row run.");
      }
      tile = bytes[input++];
    }
    if (output + count > size) {
      throw new Error("World row run crosses its output boundary.");
    }
    data.fill(tile, output, output + count);
    output += count;
  }
  return { data, consumed: input };
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

// packages/assets/src/secret-of-mana/som-asset-plugin.ts
var registry = new AssetRegistry().registerImporter(pngImporter);
for (const encoder of withImageEncoders(snesNativeEncoders)) {
  registry.registerEncoder(encoder);
}
var audioRegistry = new AssetRegistry().registerImporter(waveImporter);
for (const encoder of withAudioEncoder(snesNativeEncoders)) {
  audioRegistry.registerEncoder(encoder);
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
    const decoded = decompressSomLz(native);
    if (decoded.compressedBytes !== native.length) {
      throw new Error("Boss LZ stream has trailing bytes.");
    }
    intermediate = decoded.data;
    mode = decoded.mode;
    unusedHeaderByte = decoded.unusedHeaderByte;
  }
  const expanded = expandBossGraphics(intermediate, size);
  if (expanded.consumed !== intermediate.length) {
    throw new Error("Boss mask stream has trailing bytes.");
  }
  return { bytes: expanded.data, mode, unusedHeaderByte };
}
function convertBossImage(source, options, resources = {}) {
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
  const layout2 = options.layout ? readFrameLayout(options, resources) : void 0;
  let pixels;
  let segmentName;
  if (layout2) {
    if (typeof options.segment !== "string") {
      throw new Error("Frame atlas segment is required.");
    }
    segmentName = options.segment;
    pixels = encodeFrameAtlas(
      source,
      layout2,
      segmentName,
      readSpritePaletteCatalog(options, resources)
    );
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
    const decoded = decodeBossStream(original, storage, pixels.length);
    if (decoded.bytes.every((byte, index) => byte === pixels[index])) {
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
    const id = String.fromCharCode(...bytes.subarray(offset, offset + 4));
    if (id === "sBRR") {
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
  const decoded = native ? decodeBrrPcm(native) : void 0;
  const unchanged = decoded?.length === audio.samples.length && decoded.every((sample, index) => sample === audio.samples[index]);
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
var plugin = definePlugin({
  manifest: {
    id: "som.assets",
    name: "Secret of Mana assets",
    version: "1.0.0",
    apiVersion: PLUGIN_API_VERSION,
    requires: [{ pluginId: "uttori.asm-plugin-snes", version: "1.0.0" }]
  },
  activate(context) {
    context.registerAssetFormat({
      id: "som.room",
      version: "1.0.0",
      targets: ["snes.sfc"],
      resourcePaths: (options) => typeof options.preview === "string" ? [options.preview] : [],
      convert: convertRoomAsset
    });
    context.registerAssetFormat({
      id: "som.palette.bgr555",
      version: "1.0.0",
      targets: ["snes.sfc"],
      convert(source, options) {
        if (source.mediaType !== "application/json" || typeof options.palette !== "string") {
          throw new Error("SoM palette asset requires a JSON catalogue and palette address.");
        }
        for (const name of ["wordOffset", "wordCount"]) {
          if (options[name] !== void 0 && typeof options[name] !== "number") {
            throw new Error(`SoM palette ${name} must be a number.`);
          }
        }
        const bytes = spritePaletteBytes(parseSpritePaletteCatalog(source.bytes), options.palette, {
          wordOffset: typeof options.wordOffset === "number" ? options.wordOffset : void 0,
          wordCount: typeof options.wordCount === "number" ? options.wordCount : void 0
        });
        return { primaryOutput: "palette", outputs: { palette: { bytes } } };
      }
    });
    context.registerAssetFormat({
      id: "som.boss.graphics",
      version: "1.1.0",
      targets: ["snes.sfc"],
      resourcePaths: (options) => [options.layout, options.palettes, options.native].filter(
        (path) => typeof path === "string"
      ),
      convert: convertBossImage
    });
    context.registerAssetFormat({
      id: "som.sprite.frames",
      version: "1.1.0",
      targets: ["snes.sfc"],
      resourcePaths: (options) => [options.layout, options.palettes].filter((path) => typeof path === "string"),
      convert(source, options, resources) {
        const tiles = encodeFrameAtlas(
          source,
          readFrameLayout(options, resources),
          readFrameAtlasSelection(options),
          readSpritePaletteCatalog(options, resources)
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
        const converted = convertAsset(registry, {
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
        const decoded = decodeActor3bpp(packed, group);
        if (decoded.length !== native.length || decoded.some((byte, index) => byte !== native[index])) {
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

// packages/language-server/src/asset-preview-conversion.ts
var registry2 = new AssetRegistry().registerImporter(rawImporter).registerImporter(jsonImporter).registerImporter(pngImporter).registerImporter(waveImporter);
for (const encoder of [...withAudioEncoder(withImageEncoders(snesNativeEncoders)), rawEncoder]) {
  registry2.registerEncoder(encoder);
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
function convertSomFramePreview(input) {
  const layout2 = readFrameLayout(input.options, input.resources);
  const catalog = readSpritePaletteCatalog(input.options, input.resources);
  const selection = readFrameAtlasSelection(input.options);
  if (input.format === "som.boss.graphics" && typeof selection !== "string") {
    throw new Error("Frame atlas preview requires a segment name.");
  }
  const named = typeof selection === "string";
  const inspected = inspectFrameAtlas(input.source, layout2, catalog, {
    segmentName: named ? selection : void 0,
    whole: !named
  });
  const segments = named ? [selection] : frameAtlasSegmentOrder(layout2, selection);
  let encodedBytes;
  let output;
  if (input.format === "som.boss.graphics") {
    const result = convertBossImage(input.source, input.options, input.resources);
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
  if (input.output !== void 0 && input.output !== output) {
    throw new Error(`Asset format '${input.format}' has no output '${input.output}'.`);
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
    sourceBytes: input.source.bytes.length,
    encodedBytes,
    format: input.format,
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
    composedPngBase64: Buffer.from(input.source.bytes).toString("base64")
  };
}
function convertSomPalettePreview(input) {
  const id = input.options.palette;
  if (input.source.mediaType !== "application/json" || typeof id !== "string") {
    throw new Error("SoM palette preview requires a JSON catalogue and palette address.");
  }
  if (input.output !== void 0 && input.output !== "palette") {
    throw new Error(`Asset format '${input.format}' has no output '${input.output}'.`);
  }
  const catalog = parseSpritePaletteCatalog(input.source.bytes);
  const bytes = spritePaletteBytes(catalog, id);
  const preview = spritePalettePreview(catalog, id);
  const png = Buffer.from(rgbaPreviewPng(preview.rgba, preview.width, preview.height));
  const palette = catalog.palettes[id];
  return {
    kind: "image",
    sourceBytes: input.source.bytes.length,
    encodedBytes: bytes.length,
    format: input.format,
    output: "palette",
    metadata: {
      paletteId: id,
      paletteRomAddress: palette.romAddress,
      paletteUsers: palette.users,
      previewWidth: preview.width
    },
    thumbnailPngBase64: png.toString("base64"),
    composedPngBase64: png.toString("base64")
  };
}
function convertSomRoomPreview(input) {
  const converted = convertRoomAsset(input.source, input.options);
  const output = input.output ?? converted.primaryOutput;
  if (!Object.hasOwn(converted.outputs, output)) {
    throw new Error(`Unknown room output '${output}'.`);
  }
  const resourcePath = input.options.preview;
  const resource = typeof resourcePath === "string" && Object.hasOwn(input.resources, resourcePath) ? input.resources[resourcePath] : void 0;
  if (!resource) {
    throw new Error("Room preview requires its shared preview JSON resource.");
  }
  if (resource.mediaType !== "application/json") {
    throw new Error("Room preview resource must be JSON.");
  }
  const room = parseRoomAsset(input.source);
  const preview = renderRoomAsset(room, parseRoomPreview(resource.bytes), {
    layer: input.options.layer
  });
  return {
    kind: "image",
    sourceBytes: input.source.bytes.length,
    encodedBytes: converted.outputs[output].bytes.length,
    format: input.format,
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
function convertSomBrrPreview(input) {
  if (input.output !== void 0 && input.output !== "brr") {
    throw new Error(`Asset format '${input.format}' has no output '${input.output}'.`);
  }
  const converted = convertBrrWave(input.source, input.options).outputs.brr;
  const native = converted.bytes;
  const sourceAudio = readPcmAudio(waveImporter.import(input.source).value);
  const segment = input.format === "som.brr.segment";
  const selected = segment ? sliceBrrSegment(native, input.options) : native;
  const decoded = decodeBrrPcm(native);
  const metadata = { ...converted.metadata, previewScope: "full-stream" };
  if (segment) {
    metadata.segmentStartByte = input.options.startByte;
    metadata.segmentByteLength = selected.length;
    metadata.fullStreamBytes = native.length;
  }
  return {
    kind: "audio",
    sourceBytes: input.source.bytes.length,
    encodedBytes: selected.length,
    format: input.format,
    output: "brr",
    metadata,
    waveformPngBase64: Buffer.from(waveformPreviewPng(sourceAudio.samples)).toString("base64"),
    sourceWavBase64: Buffer.from(input.source.bytes).toString("base64"),
    decodedWavBase64: Buffer.from(writePcmWave(decoded, sourceAudio.sampleRate)).toString("base64")
  };
}
function convertAssetPreview(input) {
  if (input.format === "som.room") {
    return convertSomRoomPreview(input);
  }
  if (input.format === "som.brr.pcm" || input.format === "som.brr.segment") {
    return convertSomBrrPreview(input);
  }
  if (input.format === "som.palette.bgr555") {
    return convertSomPalettePreview(input);
  }
  if (input.format === "som.sprite.frames" || input.format === "som.boss.graphics") {
    return convertSomFramePreview(input);
  }
  const result = convertAsset(registry2, input);
  const outputName = input.output ?? result.primaryOutput;
  const selected = Object.hasOwn(result.outputs, outputName) ? result.outputs[outputName] : void 0;
  if (!selected) {
    throw new Error(`Asset format '${input.format}' has no output '${outputName}'.`);
  }
  const common = {
    sourceBytes: input.source.bytes.length,
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
      sourceWavBase64: Buffer.from(input.source.bytes).toString("base64"),
      decodedWavBase64: Buffer.from(decodedWav).toString("base64")
    };
  }
  return { ...common, kind: "binary" };
}

// packages/language-server/src/asset-preview-worker.ts
if (!parentPort) {
  throw new Error("Asset preview worker requires a parent port.");
}
parentPort.on("message", (message) => {
  try {
    parentPort.postMessage({ id: message.id, result: convertAssetPreview(message.input) });
  } catch (error) {
    parentPort.postMessage({
      id: message.id,
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

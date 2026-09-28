import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);
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
        function debug5(...args) {
          if (!debug5.enabled) {
            return;
          }
          const self = debug5;
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
        debug5.namespace = namespace;
        debug5.useColors = createDebug.useColors();
        debug5.color = createDebug.selectColor(namespace);
        debug5.extend = extend;
        debug5.destroy = createDebug.destroy;
        Object.defineProperty(debug5, "enabled", {
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
          createDebug.init(debug5);
        }
        return debug5;
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
    function init(debug5) {
      debug5.inspectOpts = {};
      const keys = Object.keys(exports.inspectOpts);
      for (let i = 0; i < keys.length; i++) {
        debug5.inspectOpts[keys[i]] = exports.inspectOpts[keys[i]];
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
var _tr_stored_block = (s, buf, stored_len, last) => {
  send_bits(s, (STORED_BLOCK << 1) + (last ? 1 : 0), 3);
  bi_windup(s);
  put_short(s, stored_len);
  put_short(s, ~stored_len);
  if (stored_len) s.pending_buf.set(s.window.subarray(buf, buf + stored_len), s.pending);
  s.pending += stored_len;
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
var MIN_MATCH = 3;
var MAX_MATCH = 258;
var MIN_LOOKAHEAD = 262;
var BS_NEED_MORE = 1;
var BS_BLOCK_DONE = 2;
var BS_FINISH_STARTED = 3;
var BS_FINISH_DONE = 4;
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
  const result = new Uint8Array(chunks.reduce((len, chunk2) => len + chunk2.length, 0));
  let pos = 0;
  for (const chunk2 of chunks) {
    result.set(chunk2, pos);
    pos += chunk2.length;
  }
  return result;
};
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
function inflate(input, options = {}) {
  const inflator = new Inflate(options);
  inflator.push(input, true);
  if (inflator.err) throw new Error(inflator.msg);
  const result = inflator.result;
  return options.toText ? new TextDecoder().decode(result) : result;
}

// node_modules/@uttori/data-tools/src/underflow-error.js
var UnderflowError = class extends Error {
  /**
   * Creates a new UnderflowError.
   * @param {string} message Message to show when the error is thrown.
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

// node_modules/@uttori/data-tools/src/data-helpers.js
var float48 = (uint8) => {
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
  return Number.parseFloat(output.toFixed(4));
};
var float80 = (uint8) => {
  const uint32 = new Uint32Array(uint8.buffer, uint8.byteOffset, uint8.byteLength / 4);
  const [high, low] = [...uint32];
  const a0 = uint8[9];
  const a1 = uint8[8];
  const sign = 1 - (a0 >>> 7) * 2;
  let exponent = (a0 & 127) << 8 | a1;
  if (exponent === 0 && low === 0 && high === 0) {
    return 0;
  }
  if (exponent === 32767) {
    if (low === 0 && high === 0) {
      return sign * Number.POSITIVE_INFINITY;
    }
    return Number.NaN;
  }
  exponent -= 16383;
  let out = low * 2 ** (exponent - 31);
  out += high * 2 ** (exponent - 63);
  return sign * out;
};
var convertFromIeeeExtended = (uint8) => {
  const sign = uint8[0] & 128 ? -1 : 1;
  const exponent = (uint8[0] & 127) << 8 | uint8[1];
  const hiMant = (uint8[2] << 24 | uint8[3] << 16 | uint8[4] << 8 | uint8[5]) >>> 0;
  const loMant = (uint8[6] << 24 | uint8[7] << 16 | uint8[8] << 8 | uint8[9]) >>> 0;
  if (exponent === 0 && hiMant === 0 && loMant === 0) {
    return sign * 0;
  }
  if (exponent === 32767) {
    return sign * Infinity;
  }
  const adjustedExponent = exponent - 16383;
  return sign * (hiMant * 2 ** (adjustedExponent - 31) + loMant * 2 ** (adjustedExponent - 63));
};

// node_modules/@uttori/data-tools/src/diff/myers.js
var Myers = class {
  // Inputs to compare.
  /** @type {string[] | number[] | Uint8Array[]} */
  x = [];
  /** @type {string[] | number[] | Uint8Array[]} */
  y = [];
  // Arrays for forwards and backwards iteration respectively.
  // An array stores the furthest reaching endpoint of a d-path in diagonal k in v[v0+k] where v0 is the offset that translates k in [-d, d] to k0 = v0+k in [0, 2*d].
  // The endpoints only store the s-coordinate since t = s - k.
  /** @type {number[]} */
  vf = [];
  /** @type {number[]} */
  vb = [];
  /** @type {number} */
  v0 = 0;
  // Mapping of s, t indices to the location in the result vectors.
  /** @type {number[]} */
  xidx = [];
  /** @type {number[]} */
  yidx = [];
  // Result vectors.
  /** @type {boolean[]} */
  resultVectorX = [];
  /** @type {boolean[]} */
  resultVectorY = [];
  // Equality function
  /** @type {import('./diff.js').EqualityFunction} */
  equal;
  // Bounds after stripping common prefix/suffix
  /** @type {number} */
  smin = 0;
  /** @type {number} */
  smax = 0;
  /** @type {number} */
  tmin = 0;
  /** @type {number} */
  tmax = 0;
  /**
   * @param {number[]} xidx Mapping of s indices to result vector positions
   * @param {number[]} yidx Mapping of t indices to result vector positions
   * @param {string[] | number[] | Uint8Array[]} x0 The first array to compare
   * @param {string[] | number[] | Uint8Array[]} y0 The second array to compare
   * @param {import('./diff.js').EqualityFunction} equal Equality function to compare elements
   */
  constructor(xidx, yidx, x0, y0, equal) {
    this.xidx = xidx;
    this.yidx = yidx;
    this.equal = equal;
    this.resultVectorX = Array.from({ length: x0.length + 1 }, () => false);
    this.resultVectorY = Array.from({ length: y0.length + 1 }, () => false);
    let smin = 0;
    let tmin = 0;
    let smax = x0.length;
    let tmax = y0.length;
    while (smin < smax && tmin < tmax && equal(x0[smin], y0[tmin])) {
      smin++;
      tmin++;
    }
    while (smax > smin && tmax > tmin && equal(x0[smax - 1], y0[tmax - 1])) {
      smax--;
      tmax--;
    }
    this.smin = smin;
    this.smax = smax;
    this.tmin = tmin;
    this.tmax = tmax;
    const N = smax - smin;
    const M = tmax - tmin;
    const diagonals = N + M;
    const vlen = 2 * diagonals + 3;
    const buf = Array.from({ length: 2 * vlen }, () => 0);
    this.x = x0;
    this.y = y0;
    this.vf = buf.slice(0, vlen);
    this.vb = buf.slice(vlen);
    this.v0 = diagonals + 1;
  }
  /**
   * Find an optimal d-path from (smin, tmin) to (smax, tmax).
   * @param {number} smin The start index of the first array
   * @param {number} smax The end index of the first array
   * @param {number} tmin The start index of the second array
   * @param {number} tmax The end index of the second array
   */
  compare(smin, smax, tmin, tmax) {
    if (smin === smax) {
      for (let t = tmin; t < tmax; t++) {
        this.resultVectorY[this.yidx[t]] = true;
      }
    } else if (tmin === tmax) {
      for (let s = smin; s < smax; s++) {
        this.resultVectorX[this.xidx[s]] = true;
      }
    } else {
      const { s0, s1, t0, t1 } = this.split(smin, smax, tmin, tmax);
      this.compare(smin, s0, tmin, t0);
      this.compare(s1, smax, t1, tmax);
    }
  }
  /**
   * Find the endpoints of sequence of diagonals in the middle of an optimal path from (smin, tmin) to (smax, tmax).
   * @param {number} smin The start index of the first array
   * @param {number} smax The end index of the first array
   * @param {number} tmin The start index of the second array
   * @param {number} tmax The end index of the second array
   * @returns {SplitResult} The endpoints of the sequence of diagonals
   */
  split(smin, smax, tmin, tmax) {
    const N = smax - smin;
    const M = tmax - tmin;
    const x = this.x;
    const y = this.y;
    const vf = this.vf;
    const vb = this.vb;
    const v0 = this.v0;
    const kmin = smin - tmax;
    const kmax = smax - tmin;
    const fmid = smin - tmin;
    const bmid = smax - tmax;
    let fmin = fmid;
    let fmax = fmid;
    let bmin = bmid;
    let bmax = bmid;
    const odd = (N - M) % 2 !== 0;
    vf[v0 + fmid] = smin;
    vb[v0 + bmid] = smax;
    for (let d = 1; ; d++) {
      if (fmin > kmin) {
        fmin--;
        vf[v0 + fmin - 1] = Number.MIN_SAFE_INTEGER;
      } else {
        fmin++;
      }
      if (fmax < kmax) {
        fmax++;
        vf[v0 + fmax + 1] = Number.MIN_SAFE_INTEGER;
      } else {
        fmax--;
      }
      for (let k = fmin; k <= fmax; k += 2) {
        const k0 = k + v0;
        let s;
        if (vf[k0 - 1] < vf[k0 + 1]) {
          s = vf[k0 + 1];
        } else {
          s = vf[k0 - 1] + 1;
        }
        let t = s - k;
        const s0 = s;
        const t0 = t;
        while (s < smax && t < tmax && this.equal(x[s], y[t])) {
          s++;
          t++;
        }
        vf[k0] = s;
        if (odd && bmin <= k && k <= bmax && s >= vb[k0]) {
          return {
            s0,
            s1: s,
            t0,
            t1: t
          };
        }
      }
      if (bmin > kmin) {
        bmin--;
        vb[v0 + bmin - 1] = Number.MAX_SAFE_INTEGER;
      } else {
        bmin++;
      }
      if (bmax < kmax) {
        bmax++;
        vb[v0 + bmax + 1] = Number.MAX_SAFE_INTEGER;
      } else {
        bmax--;
      }
      for (let k = bmin; k <= bmax; k += 2) {
        const k0 = k + v0;
        let s;
        if (vb[k0 - 1] < vb[k0 + 1]) {
          s = vb[k0 - 1];
        } else {
          s = vb[k0 + 1] - 1;
        }
        let t = s - k;
        const s0 = s, t0 = t;
        while (s > smin && t > tmin && this.equal(x[s - 1], y[t - 1])) {
          s--;
          t--;
        }
        vb[k0] = s;
        if (!odd && fmin <= k && k <= fmax && s <= vf[v0 + k]) {
          return {
            s0: s,
            s1: s0,
            t0: t,
            t1: t0
          };
        }
      }
    }
  }
};
var myers_default = Myers;

// node_modules/@uttori/data-tools/src/diff/diff.js
var Op = {
  Match: 0,
  // Two slice elements match
  Delete: 1,
  // A deletion from an element on the left slice
  Insert: 2
  // An insertion of an element from the right side
};
function edits(x, y, eq = (a, b) => a === b) {
  const { rx, ry } = diff(x, y, eq);
  return createEdits(x, y, rx, ry);
}
function createEdits(x, y, rx, ry) {
  const edits2 = [];
  const n = rx.length - 1;
  const m = ry.length - 1;
  let s = 0, t = 0;
  while (s < n || t < m) {
    while (s < n && rx[s]) {
      edits2.push({
        op: Op.Delete,
        x: x[s],
        y: x[s]
        // This should be zero value
      });
      s++;
    }
    while (t < m && ry[t]) {
      edits2.push({
        op: Op.Insert,
        x: y[t],
        // This should be zero value
        y: y[t]
      });
      t++;
    }
    while (s < n && t < m && !rx[s] && !ry[t]) {
      edits2.push({
        op: Op.Match,
        x: x[s],
        y: y[t]
      });
      s++;
      t++;
    }
  }
  return edits2;
}
function diff(x, y, eq = (a, b) => a === b) {
  const x0 = [];
  const y0 = [];
  const xidx = [];
  const yidx = [];
  const counts = [];
  const elements = [];
  const findId = (e) => {
    for (let i = 0; i < elements.length; i++) {
      if (eq(elements[i], e)) {
        return i;
      }
    }
    const id = elements.length;
    elements.push(e);
    counts.push(0);
    return id;
  };
  for (let i = 0; i < x.length; i++) {
    const e = x[i];
    const id = findId(e);
    counts[id] = (counts[id] || 0) + 1;
    x0.push(id);
    xidx.push(i);
  }
  for (let i = 0; i < y.length; i++) {
    const e = y[i];
    const id = findId(e);
    counts[id] = (counts[id] || 0) + 1;
    y0.push(id);
    yidx.push(i);
  }
  const m = new myers_default(xidx, yidx, x0, y0, (a, b) => a === b);
  m.compare(m.smin, m.smax, m.tmin, m.tmax);
  return { rx: m.resultVectorX, ry: m.resultVectorY };
}

// node_modules/@uttori/data-tools/src/data-buffer.js
var debug = () => {
};
if (typeof process !== "undefined" && process.env.UTTORI_DATA_DEBUG) {
  try {
    const { default: d } = await Promise.resolve().then(() => __toESM(require_src(), 1));
    debug = d("DataBuffer");
  } catch {
  }
}
var DataBuffer = class _DataBuffer {
  /** @type {Buffer|Uint8Array} Bytes owned or borrowed by this view. */
  data = new Uint8Array(0);
  /**
  * Creates an instance of DataBuffer.
  * @param {number[]|ArrayBuffer|Buffer|DataBuffer|Int8Array|Int16Array|Int32Array|number|string|Uint8Array|Uint16Array|Uint32Array} [input] The data to process.
  * @throws {TypeError} Missing input data.
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
      this.data = input;
    } else if (input instanceof ArrayBuffer) {
      debug("constructor: from ArrayBuffer");
      this.data = new Uint8Array(input);
    } else if (Array.isArray(input)) {
      debug("constructor: Normal Array");
      this.data = new Uint8Array(input);
    } else if (typeof input === "number") {
      debug("constructor: Number (i.e. length)");
      this.data = new Uint8Array(input);
    } else if (input instanceof _DataBuffer) {
      debug("constructor: from DataBuffer, a shallow copy");
      this.data = input.data;
    } else if (input && input.buffer && input.buffer instanceof ArrayBuffer) {
      debug("constructor: from typed arrays other than Uint8Array");
      this.data = new Uint8Array(input.buffer, input.byteOffset, input.length * input.BYTES_PER_ELEMENT);
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
    this.nativeEndian = new Uint16Array(new Uint8Array([18, 52]).buffer)[0] === 13330;
    this.offset = 0;
    this._buffer = this.writing ? [] : null;
  }
  /**
   * Buffer for creating new files. Lazy-inits from a copy of data on first write when instance was created read-only.
   * @type {number[]}
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
   * @param {number[]|ArrayBuffer|Buffer|DataBuffer|Int8Array|Int16Array|Int32Array|number|string|Uint8Array|Uint16Array|Uint32Array|undefined} input The size of the requested DataBuffer.
   * @param {number} [offset] The size of the requested DataBuffer, default is 0.
   * @returns {boolean} Returns true when both DataBuffers are equal, false if there is any difference.
   */
  compare(input, offset = 0) {
    const buffer = new _DataBuffer(input);
    const { length } = buffer;
    if (!length) {
      debug("compare: no input provided");
      return false;
    }
    const { data } = buffer;
    for (let i = 0; i < length; i++) {
      if (this.data[offset + i] !== data[i]) {
        debug("compare: first failed match at", i);
        return false;
      }
    }
    debug("compare: data is the same");
    return true;
  }
  /**
   * Diffs another DataBuffer against the current data buffer at a specified offset and returns the edits.
   * @param {number[]|ArrayBuffer|Buffer|DataBuffer|Int8Array|Int16Array|Int32Array|number|string|Uint8Array|Uint16Array|Uint32Array|undefined} input The DataBuffer to compare against.
   * @param {number} [offset] The offset to start the comparison from, default is 0.
   * @returns {import('./diff/diff.js').Edit[]} Returns an array of edits describing the differences.
   */
  diff(input, offset = 0) {
    const buffer = new _DataBuffer(input);
    const x = Array.from(this.data.slice(offset));
    const y = Array.from(buffer.data);
    debug("diff: comparing", x.length, "bytes against", y.length, "bytes");
    return edits(x, y, (a, b) => a === b);
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
    if (!this.available(input.length)) {
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
    return new _DataBuffer(new Uint8Array(this.data.slice(0)));
  }
  /**
   * Creates a copy of the current DataBuffer from a specified offset and a specified length.
   * @param {number} position The starting offset to begin the copy of the new DataBuffer.
   * @param {number} [length] The size of the new DataBuffer, defaults to the current length.
   * @returns {DataBuffer} The new DataBuffer
   */
  slice(position, length = this.length) {
    debug("slice:", position, length);
    if (position === 0 && length >= this.length) {
      return new _DataBuffer(this.data);
    }
    return new _DataBuffer(this.data.slice(position, position + length));
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
   * If writing mode is enabled, this is always true.
   * @param {number} bytes The number of bytes to check for.
   * @returns {boolean} True if there are the requested amount, or more, of bytes left in the DataBuffer.
   */
  available(bytes) {
    return this.writing || bytes <= this.remainingBytes();
  }
  /**
   * Checks if a given number of bytes are avaliable after a given offset in the buffer.
   * If writing mode is enabled, this is always true.
   * @param {number} bytes The number of bytes to check for.
   * @param {number} offset The offset to start from.
   * @returns {boolean} True if there are the requested amount, or more, of bytes left in the stream.
   */
  availableAt(bytes, offset) {
    return this.writing || bytes <= this.length - offset;
  }
  /**
   * Advance the offset by a given number of bytes.
   * @param {number} bytes The number of bytes to advance.
   * @throws {UnderflowError} Insufficient Bytes in the DataBuffer.
   */
  advance(bytes) {
    debug("advance:", bytes);
    if (!this.available(bytes)) {
      throw new underflow_error_default(`Insufficient Bytes: ${bytes} <= ${this.remainingBytes()}`);
    }
    this.offset += bytes;
    debug("advance: offset", this.offset);
  }
  /**
   * Rewind the offset by a given number of bytes.
   * @param {number} bytes The number of bytes to go back.
   * @throws {UnderflowError} Insufficient Bytes in the DataBuffer.
   */
  rewind(bytes) {
    debug("rewind:", bytes);
    if (bytes > this.offset) {
      throw new underflow_error_default(`Insufficient Bytes: ${bytes} > ${this.offset}`);
    }
    this.offset -= bytes;
    debug("rewind: offset", this.offset);
  }
  /**
   * Go to a specified offset in the stream.
   * @param {number} position The offset to go to.
   */
  seek(position) {
    debug(`seek: from ${this.offset} to ${position}`);
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
    if (!this.available(1)) {
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
    if (!this.availableAt(1, offset)) {
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
  read(bytes, littleEndian = false) {
    if (!this.available(bytes)) {
      throw new underflow_error_default(`Insufficient Bytes: ${bytes}`);
    }
    const start = this.offset;
    this.offset += bytes;
    if (littleEndian && bytes > 1) {
      const uint8 = new Uint8Array(bytes);
      for (let i = 0; i < bytes; i++) {
        uint8[i] = this.data[start + bytes - 1 - i];
      }
      return uint8;
    }
    return this.data.slice(start, start + bytes);
  }
  /**
   * Read from the provided offset and return the value.
   * @param {number} bytes The number of bytes to read.
   * @param {number} [offset] The offset to read from, default is 0.
   * @param {boolean} [littleEndian] Read in Little Endian format, default is false.
   * @returns {Uint8Array} The UInt8 value at the current offset.
   */
  peek(bytes, offset = 0, littleEndian = false) {
    if (!this.availableAt(bytes, offset)) {
      throw new underflow_error_default(`Insufficient Bytes: ${offset} + ${bytes}`);
    }
    if (littleEndian && bytes > 1) {
      const uint8 = new Uint8Array(bytes);
      for (let i = 0; i < bytes; i++) {
        uint8[i] = this.data[offset + bytes - 1 - i];
      }
      return uint8;
    }
    return this.data.slice(offset, offset + bytes);
  }
  /**
   * Read the bits from the bytes from the provided offset and return the value.
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
    if (!this.available(1)) {
      throw new underflow_error_default("Insufficient Bytes: 1");
    }
    const view = new DataView(this.data.buffer, this.data.byteOffset + this.offset, 1);
    const v = view.getInt8(0);
    this.offset += 1;
    return v;
  }
  /**
   * Read from the specified offset without advancing the offsets and return the value.
   * @param {number} [offset] The offset to read from, default is 0.
   * @returns {number} The Int8 value at the current offset.
   */
  peekInt8(offset = 0) {
    if (!this.availableAt(1, offset)) {
      throw new underflow_error_default(`Insufficient Bytes: ${offset} + 1`);
    }
    return new DataView(this.data.buffer, this.data.byteOffset + offset, 1).getInt8(0);
  }
  /**
   * Read from the current offset and return the value.
   * @param {boolean} [littleEndian] Read in Little Endian format, default is false.
   * @returns {number} The UInt16 value at the current offset.
   */
  readUInt16(littleEndian) {
    if (!this.available(2)) {
      throw new underflow_error_default("Insufficient Bytes: 2");
    }
    const view = new DataView(this.data.buffer, this.data.byteOffset + this.offset, 2);
    const v = view.getUint16(0, littleEndian);
    this.offset += 2;
    return v;
  }
  /**
   * Read from the specified offset without advancing the offsets and return the value.
   * @param {number} [offset] The offset to read from, default is 0.
   * @param {boolean} [littleEndian] Read in Little Endian format, default is false.
   * @returns {number} The Int8 value at the current offset.
   */
  peekUInt16(offset = 0, littleEndian = false) {
    if (!this.availableAt(2, offset)) {
      throw new underflow_error_default(`Insufficient Bytes: ${offset} + 2`);
    }
    return new DataView(this.data.buffer, this.data.byteOffset + offset, 2).getUint16(0, littleEndian);
  }
  /**
   * Read from the current offset and return the value.
   * @param {boolean} [littleEndian] Read in Little Endian format, default is false.
   * @returns {number} The Int16 value at the current offset.
   */
  readInt16(littleEndian = false) {
    if (!this.available(2)) {
      throw new underflow_error_default("Insufficient Bytes: 2");
    }
    const view = new DataView(this.data.buffer, this.data.byteOffset + this.offset, 2);
    const v = view.getInt16(0, littleEndian);
    this.offset += 2;
    return v;
  }
  /**
   * Read from the specified offset without advancing the offsets and return the value.
   * @param {number} [offset] The offset to read from, default is 0.
   * @param {boolean} [littleEndian] Read in Little Endian format, default is false.
   * @returns {number} The Int16 value at the current offset.
   */
  peekInt16(offset = 0, littleEndian = false) {
    if (!this.availableAt(2, offset)) {
      throw new underflow_error_default(`Insufficient Bytes: ${offset} + 2`);
    }
    return new DataView(this.data.buffer, this.data.byteOffset + offset, 2).getInt16(0, littleEndian);
  }
  /**
   * Read from the current offset and return the value.
   * @param {boolean} [littleEndian] Read in Little Endian format, default is false.
   * @returns {number} The UInt24 value at the current offset.
   */
  readUInt24(littleEndian = false) {
    if (littleEndian) {
      return this.readUInt16(true) + (this.readUInt8() << 16);
    }
    return (this.readUInt16() << 8) + this.readUInt8();
  }
  /**
   * Read from the specified offset without advancing the offsets and return the value.
   * @param {number} [offset] The offset to read from, default is 0.
   * @param {boolean} [littleEndian] Read in Little Endian format, default is false.
   * @returns {number} The UInt24 value at the current offset.
   */
  peekUInt24(offset = 0, littleEndian = false) {
    if (littleEndian) {
      return this.peekUInt16(offset, true) + (this.peekUInt8(offset + 2) << 16);
    }
    return (this.peekUInt16(offset) << 8) + this.peekUInt8(offset + 2);
  }
  /**
   * Read from the current offset and return the value.
   * @param {boolean} [littleEndian] Read in Little Endian format, default is false.
   * @returns {number} The Int24 value at the current offset.
   */
  readInt24(littleEndian = false) {
    if (littleEndian) {
      return this.readUInt16(true) + (this.readInt8() << 16);
    }
    return (this.readInt16() << 8) + this.readUInt8();
  }
  /**
   * Read from the specified offset without advancing the offsets and return the value.
   * @param {number} [offset] The offset to read from, default is 0.
   * @param {boolean} [littleEndian] Read in Little Endian format, default is false.
   * @returns {number} The Int24 value at the current offset.
   */
  peekInt24(offset = 0, littleEndian = false) {
    if (littleEndian) {
      return this.peekUInt16(offset, true) + (this.peekInt8(offset + 2) << 16);
    }
    return (this.peekInt16(offset) << 8) + this.peekUInt8(offset + 2);
  }
  /**
   * Read from the current offset and return the value.
   * @param {boolean} [littleEndian] Read in Little Endian format, default is false.
   * @returns {number} The UInt32 value at the current offset.
   */
  readUInt32(littleEndian = false) {
    if (!this.available(4)) {
      throw new underflow_error_default("Insufficient Bytes: 4");
    }
    const view = new DataView(this.data.buffer, this.data.byteOffset + this.offset, 4);
    const v = view.getUint32(0, littleEndian);
    this.offset += 4;
    return v;
  }
  /**
   * Read from the specified offset without advancing the offsets and return the value.
   * @param {number} [offset] The offset to read from, default is 0.
   * @param {boolean} [littleEndian] Read in Little Endian format, default is false.
   * @returns {number} The UInt32 value at the current offset.
   */
  peekUInt32(offset = 0, littleEndian = false) {
    if (!this.availableAt(4, offset)) {
      throw new underflow_error_default(`Insufficient Bytes: ${offset} + 4`);
    }
    return new DataView(this.data.buffer, this.data.byteOffset + offset, 4).getUint32(0, littleEndian);
  }
  /**
   * Read from the current offset and return the value.
   * @param {boolean} [littleEndian] Read in Little Endian format, default is false.
   * @returns {number} The Int32 value at the current offset.
   */
  readInt32(littleEndian = false) {
    if (!this.available(4)) {
      throw new underflow_error_default("Insufficient Bytes: 4");
    }
    const view = new DataView(this.data.buffer, this.data.byteOffset + this.offset, 4);
    const v = view.getInt32(0, littleEndian);
    this.offset += 4;
    return v;
  }
  /**
   * Read from the specified offset without advancing the offsets and return the value.
   * @param {number} [offset] The offset to read from, default is 0.
   * @param {boolean} [littleEndian] Read in Little Endian format, default is false.
   * @returns {number} The Int32 value at the current offset.
   */
  peekInt32(offset = 0, littleEndian = false) {
    if (!this.availableAt(4, offset)) {
      throw new underflow_error_default(`Insufficient Bytes: ${offset} + 4`);
    }
    return new DataView(this.data.buffer, this.data.byteOffset + offset, 4).getInt32(0, littleEndian);
  }
  /**
   * Read from the current offset and return the value.
   * @param {boolean} [littleEndian] Read in Little Endian format, default is false.
   * @returns {number} The Float32 value at the current offset.
   */
  readFloat32(littleEndian = false) {
    if (!this.available(4)) {
      throw new underflow_error_default("Insufficient Bytes: 4");
    }
    const view = new DataView(this.data.buffer, this.data.byteOffset + this.offset, 4);
    const v = view.getFloat32(0, littleEndian);
    this.offset += 4;
    return v;
  }
  /**
   * Read from the specified offset without advancing the offsets and return the value.
   * @param {number} [offset] The offset to read from, default is 0.
   * @param {boolean} [littleEndian] Read in Little Endian format, default is false.
   * @returns {number} The Float32 value at the current offset.
   */
  peekFloat32(offset = 0, littleEndian = false) {
    if (!this.availableAt(4, offset)) {
      throw new underflow_error_default(`Insufficient Bytes: ${offset} + 4`);
    }
    return new DataView(this.data.buffer, this.data.byteOffset + offset, 4).getFloat32(0, littleEndian);
  }
  /**
   * Read from the current offset and return the Turbo Pascal 48 bit extended float value.
   * May be faulty with large numbers due to float percision.
   * @param {boolean} [littleEndian] Read in Little Endian format, default is false.
   * @returns {number} The Float48 value at the current offset.
   */
  readFloat48(littleEndian = false) {
    const uint8 = this.read(6, littleEndian || this.nativeEndian);
    return float48(uint8);
  }
  /**
   * Read from the specified offset without advancing the offsets and return the Turbo Pascal 48 bit extended float value.
   * May be faulty with large numbers due to float percision.
   * @param {number} [offset] The offset to read from, default is 0.
   * @param {boolean} [littleEndian] Read in Little Endian format, default is false.
   * @returns {number} The Float48 value at the specified offset.
   */
  peekFloat48(offset = 0, littleEndian = false) {
    const uint8 = this.peek(6, offset, littleEndian || this.nativeEndian);
    return float48(uint8);
  }
  /**
   * Read from the current offset and return the value.
   * @param {boolean} [littleEndian] Read in Little Endian format, default is false.
   * @returns {number} The Float64 value at the current offset.
   */
  readFloat64(littleEndian = false) {
    if (!this.available(8)) {
      throw new underflow_error_default("Insufficient Bytes: 8");
    }
    const view = new DataView(this.data.buffer, this.data.byteOffset + this.offset, 8);
    const v = view.getFloat64(0, littleEndian);
    this.offset += 8;
    return v;
  }
  /**
   * Read from the specified offset without advancing the offsets and return the value.
   * @param {number} [offset] The offset to read from, default is 0.
   * @param {boolean} [littleEndian] Read in Little Endian format, default is false.
   * @returns {number} The Float64 value at the current offset.
   */
  peekFloat64(offset = 0, littleEndian = false) {
    if (!this.availableAt(8, offset)) {
      throw new underflow_error_default(`Insufficient Bytes: ${offset} + 8`);
    }
    return new DataView(this.data.buffer, this.data.byteOffset + offset, 8).getFloat64(0, littleEndian);
  }
  /**
   * Read from the current offset and return the IEEE 80 bit extended float value.
   * @param {boolean} [littleEndian] Read in Little Endian format, defaults to system value, default is the current nativeEndian value.
   * @returns {number} The Float80 value at the current offset.
   */
  readFloat80(littleEndian = this.nativeEndian) {
    const uint8 = this.read(10, littleEndian);
    return float80(uint8);
  }
  /**
   * Read from the specified offset without advancing the offsets and return the IEEE 80 bit extended float value.
   * @param {number} [offset] The offset to read from, default is 0.
   * @param {boolean} [littleEndian] Read in Little Endian format, defaults to system value, default is the current nativeEndian value.
   * @returns {number} The Float80 value at the current offset.
   */
  peekFloat80(offset = 0, littleEndian = this.nativeEndian) {
    const uint8 = this.peek(10, offset, littleEndian);
    return float80(uint8);
  }
  /**
   * Read from the current offset and return the IEEE 754 extended float value.
   * May be faulty with large numbers due to float percision.
   * @param {boolean} [littleEndian] Read in Little Endian format, default is false.
   * @returns {number} The IEEE 754 extended float value at the current offset.
   */
  readFloatIEEE754(littleEndian = false) {
    const uint8 = this.read(10, littleEndian);
    return convertFromIeeeExtended(uint8);
  }
  /**
   * Peek from the specified offset without advancing the offsets and return the IEEE 754 extended float value.
   * May be faulty with large numbers due to float percision.
   * @param {number} [offset] The offset to read from, default is 0.
   * @param {boolean} [littleEndian] Read in Little Endian format, default is false.
   * @returns {number} The IEEE 754 extended float value at the specified offset.
   */
  peekFloatIEEE754(offset = 0, littleEndian = false) {
    const uint8 = this.peek(10, offset, littleEndian);
    return convertFromIeeeExtended(uint8);
  }
  /**
   * Read from the current offset and return the value as a DataBuffer.
   * @param {number} length The number of bytes to read.
   * @returns {DataBuffer} The requested number of bytes as a DataBuffer.
   */
  readBuffer(length) {
    if (!this.available(length)) {
      throw new underflow_error_default(`Insufficient Bytes: ${length}`);
    }
    const chunk2 = this.data.slice(this.offset, this.offset + length);
    this.offset += length;
    return new _DataBuffer(chunk2);
  }
  /**
   * Read from the specified offset and return the value as a DataBuffer.
   * @param {number} offset The offset to read from.
   * @param {number} length The number of bytes to read.
   * @returns {DataBuffer} The requested number of bytes as a DataBuffer.
   */
  peekBuffer(offset, length) {
    if (!this.availableAt(length, offset)) {
      throw new underflow_error_default(`Insufficient Bytes: ${offset} + ${length}`);
    }
    return new _DataBuffer(this.data.slice(offset, offset + length));
  }
  /**
   * Read from the current offset for a given length and return the value as a string.
   * @param {number} length The number of bytes to read.
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
   * @param {number} length The number of bytes to read.
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
   * @private
   * @param {number} offset The offset to read from.
   * @param {number|null} length The number of bytes to read, if not defined it is the remaining bytes in the buffer. If NULL a null terminated string will be read.
   * @param {string} encoding The encoding of the string.
   * @param {boolean} advance Flag to optionally advance the offsets.
   * @returns {string} The read value as a string.
   */
  decodeString(offset, length, encoding, advance) {
    debug("decodeString:", { offset, length, encoding, advance });
    encoding = encoding.toLowerCase();
    const nullEnd = length === null ? 0 : -1;
    if (!length) {
      length = this.remainingBytes();
    }
    const end = offset + length;
    const codes = [];
    switch (encoding) {
      case "ascii":
      case "latin1": {
        while (offset < end) {
          const character = this.peekUInt8(offset++);
          if (character === nullEnd) {
            break;
          }
          codes.push(character);
        }
        break;
      }
      case "utf8":
      case "utf-8": {
        while (offset < end) {
          const b1 = this.peekUInt8(offset++);
          if (b1 === nullEnd) {
            break;
          }
          let b2;
          let b3;
          if ((b1 & 128) === 0) {
            codes.push(b1);
          } else if ((b1 & 224) === 192) {
            b2 = this.peekUInt8(offset++) & 63;
            codes.push((b1 & 31) << 6 | b2);
          } else if ((b1 & 240) === 224) {
            b2 = this.peekUInt8(offset++) & 63;
            b3 = this.peekUInt8(offset++) & 63;
            codes.push((b1 & 15) << 12 | b2 << 6 | b3);
          } else if ((b1 & 248) === 240) {
            b2 = this.peekUInt8(offset++) & 63;
            b3 = this.peekUInt8(offset++) & 63;
            const b4 = this.peekUInt8(offset++) & 63;
            const pt = ((b1 & 15) << 18 | b2 << 12 | b3 << 6 | b4) - 65536;
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
        let littleEndian;
        switch (encoding) {
          case "utf16be":
          case "utf16-be": {
            littleEndian = false;
            break;
          }
          case "utf16le":
          case "utf16-le": {
            littleEndian = true;
            break;
          }
          case "utf16bom":
          case "utf16-bom":
          default: {
            const bom = this.peekUInt16(offset);
            if (length < 2 || bom === nullEnd) {
              if (advance) {
                this.advance(offset += 2);
              }
              return String.fromCharCode(...codes);
            }
            littleEndian = bom === 65534;
            offset += 2;
            break;
          }
        }
        let w1 = 0;
        while (offset < end && (w1 = this.peekUInt16(offset, littleEndian)) !== nullEnd) {
          offset += 2;
          if (w1 < 55296 || w1 > 57343) {
            codes.push(w1);
          } else {
            const w2 = this.peekUInt16(offset, littleEndian);
            if (w2 < 56320 || w2 > 57343) {
              throw new Error("Invalid utf16 sequence.");
            }
            codes.push(w1, w2);
            offset += 2;
          }
        }
        if (w1 === nullEnd) {
          offset += 2;
        }
        break;
      }
      default: {
        throw new Error(`Unknown Encoding: ${encoding}`);
      }
    }
    const result = String.fromCharCode(...codes);
    if (advance) {
      this.advance(length);
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
   * Reads bytes until a null byte (0x00) is encountered.
   * @private
   * @param {number} offset The offset to read from.
   * @param {string} encoding The encoding of the string.
   * @param {boolean} advance Flag to optionally advance the offsets.
   * @param {number} [nullValue] The byte value that terminates the string, default is 0x00.
   * @returns {string} The read value as a string (without the null terminator).
   */
  decodeNullTerminatedString(offset, encoding, advance, nullValue = 0) {
    debug("decodeNullTerminatedString:", { offset, encoding, advance, nullValue });
    encoding = encoding.toLowerCase();
    const codes = [];
    switch (encoding) {
      case "utf8":
      case "utf-8": {
        while (offset < this.length) {
          const b1 = this.peekUInt8(offset++);
          if (b1 === nullValue) {
            break;
          }
          let b2;
          let b3;
          if ((b1 & 128) === 0) {
            codes.push(b1);
          } else if ((b1 & 224) === 192) {
            if (offset >= this.length) break;
            b2 = this.peekUInt8(offset++);
            if (b2 === nullValue) break;
            codes.push((b1 & 31) << 6 | b2 & 63);
          } else if ((b1 & 240) === 224) {
            if (offset >= this.length) break;
            b2 = this.peekUInt8(offset++);
            if (b2 === nullValue) break;
            if (offset >= this.length) break;
            b3 = this.peekUInt8(offset++);
            if (b3 === nullValue) break;
            codes.push((b1 & 15) << 12 | (b2 & 63) << 6 | b3 & 63);
          } else if ((b1 & 248) === 240) {
            if (offset >= this.length) break;
            b2 = this.peekUInt8(offset++);
            if (b2 === nullValue) break;
            if (offset >= this.length) break;
            b3 = this.peekUInt8(offset++);
            if (b3 === nullValue) break;
            if (offset >= this.length) break;
            const b4 = this.peekUInt8(offset++);
            if (b4 === nullValue) break;
            const pt = ((b1 & 15) << 18 | (b2 & 63) << 12 | (b3 & 63) << 6 | b4 & 63) - 65536;
            codes.push(55296 + (pt >> 10), 56320 + (pt & 1023));
          }
        }
        break;
      }
      case "utf16-be":
      case "utf16be": {
        while (offset < this.length - 1) {
          const b1 = this.peekUInt8(offset);
          const b2 = this.peekUInt8(offset + 1);
          if (b1 === nullValue && b2 === nullValue) {
            offset += 2;
            break;
          }
          codes.push(b1 << 8 | b2);
          offset += 2;
        }
        break;
      }
      case "utf16-le":
      case "utf16le": {
        while (offset < this.length - 1) {
          const b1 = this.peekUInt8(offset);
          const b2 = this.peekUInt8(offset + 1);
          if (b1 === nullValue && b2 === nullValue) {
            offset += 2;
            break;
          }
          codes.push(b2 << 8 | b1);
          offset += 2;
        }
        break;
      }
      case "ascii":
      case "latin1":
      default: {
        while (offset < this.length) {
          const byte = this.peekUInt8(offset++);
          if (byte === nullValue) {
            break;
          }
          codes.push(byte);
        }
        break;
      }
    }
    const result = String.fromCharCode(...codes);
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
   * @param {boolean} [advance] Flag to increment the offset to the next position, default is true.
   */
  writeUInt8(data, offset = this.offset, advance = true) {
    debug("writeUInt8:", { data, offset, advance });
    this.buffer[offset] = data;
    if (advance) {
      this.offset++;
    }
  }
  /**
   * Writes an unsigned 16 bit value, 2 bytes.
   * @param {number} data The data to write.
   * @param {number} [offset] The offset to write the data to, default is current offset.
   * @param {boolean} [advance] Flag to increment the offset to the next position, default is true.
   * @param {boolean} [littleEndian] Endianness of the write order, little Endian when `true`, default is big Endian `false`.
   */
  writeUInt16(data, offset = this.offset, advance = true, littleEndian = false) {
    debug("writeUInt16:", { data, offset, advance, littleEndian });
    if (littleEndian) {
      this.buffer[offset] = data & 255;
      this.buffer[offset + 1] = (data & 65280) >> 8;
    } else {
      this.buffer[offset] = (data & 65280) >> 8;
      this.buffer[offset + 1] = data & 255;
    }
    if (advance) {
      this.offset += 2;
    }
  }
  /**
   * Writes an unsigned 24 bit value, 3 bytes.
   * @param {number} data The data to write.
   * @param {number} [offset] The offset to write the data to, default is current offset.
   * @param {boolean} [advance] Flag to increment the offset to the next position, default is true.
   * @param {boolean} [littleEndian] Endianness of the write order, little Endian when `true`, default is big Endian `false`.
   */
  writeUInt24(data, offset = this.offset, advance = true, littleEndian = false) {
    debug("writeUInt24:", { data, offset, advance, littleEndian });
    if (littleEndian) {
      this.buffer[offset] = data & 255;
      this.buffer[offset + 1] = (data & 65280) >> 8;
      this.buffer[offset + 2] = (data & 16711680) >> 16;
    } else {
      this.buffer[offset] = (data & 16711680) >> 16;
      this.buffer[offset + 1] = (data & 65280) >> 8;
      this.buffer[offset + 2] = data & 255;
    }
    if (advance) {
      this.offset += 3;
    }
  }
  /**
   * Writes an unsigned 32 bit value, 4 bytes.
   * @param {number} data The data to write.
   * @param {number} [offset] The offset to write the data to, default is current offset.
   * @param {boolean} [advance] Flag to increment the offset to the next position, default is true.
   * @param {boolean} [littleEndian] Endianness of the write order, little Endian when `true`, default is big Endian `false`.
   */
  writeUInt32(data, offset = this.offset, advance = true, littleEndian = false) {
    debug("writeUInt32:", { data, offset, advance, littleEndian });
    if (littleEndian) {
      this.buffer[offset] = data & 255;
      this.buffer[offset + 1] = (data & 65280) >> 8;
      this.buffer[offset + 2] = (data & 16711680) >> 16;
      this.buffer[offset + 3] = (data & 4278190080) >> 24;
    } else {
      this.buffer[offset] = (data & 4278190080) >> 24;
      this.buffer[offset + 1] = (data & 16711680) >> 16;
      this.buffer[offset + 2] = (data & 65280) >> 8;
      this.buffer[offset + 3] = data & 255;
    }
    if (advance) {
      this.offset += 4;
    }
  }
  /**
   * Write a series of bytes.
   * @param {number[]|Int8Array|Int16Array|Int32Array|Uint8Array|Uint16Array|Uint32Array} data The data to write.
   * @param {number} [offset] The offset to write the data to, default is current offset.
   * @param {boolean} [advance] Flag to increment the offset to the next position, default is true.
   */
  writeBytes(data, offset = this.offset, advance = true) {
    debug("writeBytes:", { data, offset, advance });
    for (let i = 0; i < data.length; i++) {
      this.buffer[offset + i] = data[i];
    }
    if (advance) {
      this.offset += data.length;
    }
  }
  /**
   * Write a string as a given encoding.
   *
   * Valid encodings are: 'ascii' aka 'latin1', 'utf8' / 'utf8', 'utf16be', 'utf16le'.
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
   * @param {boolean} [advance] Flag to increment the offset to the next position, default is true.
   */
  writeString(string, offset = this.offset, encoding = "ascii", advance = true) {
    debug("writeString:", { string, offset, encoding, advance });
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
            data.push(
              192 | charcode >> 6,
              128 | charcode & 63
            );
          } else if (charcode < 55296 || charcode >= 57344) {
            data.push(
              224 | charcode >> 12,
              128 | charcode >> 6 & 63,
              128 | charcode & 63
            );
          } else {
            i++;
            charcode = 65536 + ((charcode & 1023) << 10 | string.charCodeAt(i) & 1023);
            data.push(
              240 | charcode >> 18,
              128 | charcode >> 12 & 63,
              128 | charcode >> 6 & 63,
              128 | charcode & 63
            );
          }
        }
        break;
      }
      case "utf16be":
      case "utf16le":
      case "utf16bom": {
        const littleEndian = encoding === "utf16le";
        for (let i = 0; i < string.length; i++) {
          const charcode = string.charCodeAt(i);
          if (littleEndian) {
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
    this._buffer = null;
    this.writing = false;
  }
};
var data_buffer_default = DataBuffer;

// node_modules/@uttori/data-tools/src/data-buffer-list.js
var debug2 = () => {
};
if (typeof process !== "undefined" && process.env.UTTORI_DATA_DEBUG) {
  try {
    const { default: d } = await Promise.resolve().then(() => __toESM(require_src(), 1));
    debug2 = d("DataBufferList");
  } catch {
  }
}
var DataBufferList = class _DataBufferList {
  /**
   * Creates an instance of DataBufferList.
   * @param {import('./data-buffer.js').default[]} [buffers] DataBuffers to initialize with.
   */
  constructor(buffers) {
    debug2("constructor");
    this.first = null;
    this.last = null;
    this.totalBuffers = 0;
    this.availableBytes = 0;
    this.availableBuffers = 0;
    if (buffers && Array.isArray(buffers)) {
      for (const buffer of buffers) {
        this.append(buffer);
      }
    }
  }
  /**
   * Creates a copy of the DataBufferList.
   * @returns {DataBufferList} The copied DataBufferList.
   */
  copy() {
    debug2("copy");
    const result = new _DataBufferList();
    result.first = this.first;
    result.last = this.last;
    result.totalBuffers = this.totalBuffers;
    result.availableBytes = this.availableBytes;
    result.availableBuffers = this.availableBuffers;
    return result;
  }
  /**
   * Appends a DataBuffer to the DataBufferList.
   * @param {import('./data-buffer.js').default} buffer The DataBuffer to add to the list.
   * @returns {number} The new number of buffers in the DataBufferList.
   */
  append(buffer) {
    debug2("append");
    buffer.prev = this.last;
    if (this.last) {
      this.last.next = buffer;
    }
    this.last = buffer;
    if (this.first == null) {
      this.first = buffer;
    }
    this.availableBytes += buffer.length;
    this.availableBuffers++;
    this.totalBuffers++;
    debug2("append:", this.totalBuffers);
    return this.totalBuffers;
  }
  /**
   * Checks if we are on the last buffer in the list.
   * @returns {boolean} Returns false if there are more buffers in the list, returns true when we are on the last buffer.
   */
  moreAvailable() {
    if (this.first && this.first.next != null) {
      debug2("moreAvailable: true");
      return true;
    }
    debug2("moreAvailable: false");
    return false;
  }
  /**
   * Advance the buffer list to the next DataBuffer or to `null` when at the end of avaliable DataBuffers.
   *
   * If there is no next buffer, the current buffer is set to null.
   * @returns {boolean} Returns false if there is no more buffers, returns true when the next buffer is set.
   */
  advance() {
    debug2("advance");
    if (this.first) {
      this.availableBytes -= this.first.length;
      this.availableBuffers--;
    }
    if (this.first && this.first.next) {
      debug2("advance: advancing");
      this.first = this.first.next;
      return true;
    }
    debug2("advance: nothing to advance to");
    this.first = null;
    return false;
  }
  /**
   * Rewind the buffer list to the previous buffer.
   * @returns {boolean} Returns false if there is no previous buffer, returns true when the previous buffer is set.
   */
  rewind() {
    debug2("rewind");
    if (this.first && !this.first.prev) {
      return false;
    }
    this.first = this.first ? this.first.prev : this.last;
    if (this.first) {
      this.availableBytes += this.first.length;
      this.availableBuffers++;
    }
    return this.first != null;
  }
  /**
   * Reset the list to the beginning.
   */
  reset() {
    debug2("reset");
    while (this.rewind()) {
      continue;
    }
  }
};
var data_buffer_list_default = DataBufferList;

// node_modules/@uttori/data-tools/src/audio/audio-wav.js
var debug3 = () => {
};
if (typeof process !== "undefined" && process.env.UTTORI_AUDIOWAV_DEBUG) {
  try {
    const { default: d } = await Promise.resolve().then(() => __toESM(require_src(), 1));
    debug3 = d("Uttori.AudioWAV");
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
var ROLAND_SP404SX_PADS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"].flatMap((bank) => Array.from({ length: 12 }, (_value, pad) => `${bank}${pad + 1}`));
var AudioWAV = class _AudioWAV extends data_buffer_default {
  /**
   * Creates a new AudioWAV.
   * @param {number[]|ArrayBuffer|Buffer|DataBuffer|Int8Array|Int16Array|Int32Array|number|string|Uint8Array|Uint16Array|Uint32Array} input The data to process.
   * @param {object} [opts] Options for this AudioWAV instance.
   * @class
   */
  constructor(input, opts = {}) {
    super(input);
    this.container = "";
    this.type = "";
    this.chunks = [];
    this.options = {
      // This keeps in spec, some files fail with this.
      roundOddChunks: true,
      ...opts
    };
    this.parse();
  }
  /**
   * Creates a new AudioWAV from file data.
   * @param {Buffer} data The data of the file to process.
   * @param {object} [options] Options for returned AudioWAV instance.
   * @returns {AudioWAV} the new AudioWAV instance for the provided file data
   * @static
   */
  static fromFile(data, options) {
    debug3("fromFile:", data.length, data.byteLength);
    const buffer = new data_buffer_default(data);
    const list = new data_buffer_list_default();
    list.append(buffer);
    return new _AudioWAV(data, options);
  }
  /**
   * Creates a new AudioWAV from a DataBuffer.
   * @param {DataBuffer} buffer The DataBuffer of the file to process.
   * @param {object} [options] Options for returned AudioWAV instance.
   * @returns {AudioWAV} the new AudioWAV instance for the provided DataBuffer
   * @static
   */
  static fromBuffer(buffer, options) {
    debug3("fromBuffer:", buffer.length);
    const list = new data_buffer_list_default();
    list.append(buffer);
    return new _AudioWAV(buffer, options);
  }
  /**
   * Parse the WAV file, decoding the supported chunks.
   */
  parse() {
    debug3("parse");
    const chunk2 = this.read(12, false);
    const value = _AudioWAV.decodeHeader(chunk2);
    this.chunks.push({ type: "header", value });
    this.type = value.type;
    while (this.remainingBytes()) {
      try {
        this.decodeChunk();
      } catch (error) {
        debug3("Error Parsing:", error);
        console.error(error);
      }
    }
  }
  /**
   * Decodes and validates WAV Header.
   * Checks for `RIFF` / `RF64` / `BW64` header, reads the size, and then checks for the `WAVE` header.
   *
   * Signature (Decimal): [82, 73, 70, 70, ..., ..., ..., ..., 87, 65, 86, 69]
   * Signature (Hexadecimal): [52, 49, 46, 46, ..., ..., ..., ..., 57, 41, 56, 45]
   * Signature (ASCII): [R, I, F, F, ..., ..., ..., ..., W, A, V, E]
   * @param {number[]|ArrayBuffer|Buffer|DataBuffer|Int8Array|Int16Array|Int32Array|number|string|Uint8Array|Uint16Array|Uint32Array} chunk The data to process.
   * @static
   * @returns {WavHeader} The decoded values.
   * @throws {Error} Invalid WAV header
   */
  static decodeHeader(chunk2) {
    debug3("decodeHeader");
    const header = new data_buffer_default(chunk2);
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
   * @param {object} data - The values to encode to the header chunk chunk.
   * @param {string} [data.riff] - RIFF Header, should contains the string `RIFF`, `RF64`, or `BW64` in ASCII form.
   * @param {number} data.size - This is the size of the entire file in bytes minus 8 bytes for the 2 fields not included in this count. RF64 sets this to -1 = 0xFFFFFFFF as it doesn't use this to support larger sizes in the DS64 chunk.
   * @param {string} [data.format] - WAVE Header, the string `WAVE` in ASCII form.
   * @returns {Buffer} The newley encoded header chunk.
   * @static
   */
  static encodeHeader({ riff = "RIFF", size, format = "WAVE" }) {
    debug3("encodeHeader:", { riff, size, format });
    const header = Buffer.alloc(12);
    header.write(riff, 0);
    header.writeUInt32LE(size, 4);
    header.write(format, 8);
    return header;
  }
  /**
   * Decodes the chunk type, and attempts to parse that chunk if supported.
   * Supported Chunk Types: `fmt `, `fact`, `inst`, `DISP`, `smpl`, `tlst`, `data`, `LIST`, `RLND`, `JUNK`, `acid`, `cue `, `bext`, `ResU`, `ds64`, `cart`
   *
   * Chunk Structure:
   * Length: 4 bytes (integer)
   * Type:   4 bytes (string)
   * Chunk:  {length} bytes
   * @returns {string} Chunk Type
   * @throws {Error} Invalid Chunk Length when less than 0
   */
  decodeChunk() {
    debug3("decodeChunk at offset", this.offset, "with", this.remainingBytes(), "remaining bytes");
    let type = this.readString(4);
    debug3("decodeChunk type", type);
    let size = this.readUInt32(this.type !== "AIFF");
    debug3("decodeChunk size", size);
    if (size < 0) {
      throw new Error(`Invalid SubChunk Size: ${4294967295 & size}`);
    }
    if (this.options.roundOddChunks && size % 2 !== 0) {
      size += 1;
    }
    if (size > this.remainingBytes()) {
      debug3("decodeChunk size", size, "too large, using remaining bytes", this.remainingBytes());
      size = this.remainingBytes();
    }
    if (!type || size === 0) {
      debug3("decodeChunk something is wrong, ending");
      type = "(broken)";
      size = this.remainingBytes();
    }
    switch (type) {
      case "fmt ": {
        this.rewind(8);
        const chunk2 = this.read(8 + size, false);
        const value = _AudioWAV.decodeFMT(chunk2);
        this.chunks.push({ type: "format", value, chunk: chunk2 });
        break;
      }
      case "fact": {
        this.rewind(8);
        const chunk2 = this.read(8 + size, false);
        const value = _AudioWAV.decodeFACT(chunk2);
        this.chunks.push({ type: "fact", value, chunk: chunk2 });
        break;
      }
      case "inst": {
        this.rewind(8);
        const chunk2 = this.read(8 + size, false);
        const value = _AudioWAV.decodeINST(chunk2);
        this.chunks.push({ type: "instrument", value, chunk: chunk2 });
        break;
      }
      case "DISP": {
        this.rewind(8);
        const chunk2 = this.read(8 + size, false);
        const value = _AudioWAV.decodeDISP(chunk2);
        this.chunks.push({ type: "display", value, chunk: chunk2 });
        break;
      }
      case "smpl": {
        this.rewind(8);
        const chunk2 = this.read(8 + size, false);
        const value = _AudioWAV.decodeSMPL(chunk2);
        this.chunks.push({ type: "sample", value, chunk: chunk2 });
        break;
      }
      case "tlst": {
        this.rewind(8);
        const chunk2 = this.read(8 + size, false);
        const value = _AudioWAV.decodeTLST(chunk2);
        this.chunks.push({ type: "trigger_list", value, chunk: chunk2 });
        break;
      }
      case "data": {
        this.rewind(8);
        const chunk2 = this.read(8 + size, false);
        _AudioWAV.decodeDATA(chunk2);
        const format = this.chunks.find((c) => c.type === "format");
        const formatValue = (
          /** @type {WavFormat} */
          format?.value
        );
        const duration = size / formatValue.byteRate;
        this.chunks.push({ type: "data", chunk: chunk2, value: { duration } });
        break;
      }
      case "LIST": {
        this.rewind(8);
        const chunk2 = this.read(8 + size, false);
        const value = _AudioWAV.decodeLIST(chunk2);
        this.chunks.push({ type: "list", value, chunk: chunk2 });
        break;
      }
      case "RLND": {
        this.rewind(8);
        const chunk2 = this.read(8 + size, false);
        const value = _AudioWAV.decodeRLND(chunk2);
        this.chunks.push({ type: "roland", value, chunk: chunk2 });
        break;
      }
      case "JUNK": {
        this.rewind(8);
        const chunk2 = this.read(8 + size, false);
        _AudioWAV.decodeJUNK(chunk2, this.options);
        this.chunks.push({ type: "junk", chunk: chunk2 });
        break;
      }
      case "PAD ": {
        this.rewind(8);
        const chunk2 = this.read(8 + size, false);
        _AudioWAV.decodePAD(chunk2);
        this.chunks.push({ type: "padding", chunk: chunk2 });
        break;
      }
      case "PEAK": {
        this.rewind(8);
        const chunk2 = this.read(8 + size, false);
        const value = _AudioWAV.decodePEAK(chunk2);
        this.chunks.push({ type: "peak", value, chunk: chunk2 });
        break;
      }
      case "acid": {
        this.rewind(8);
        const chunk2 = this.read(8 + size, false);
        const value = _AudioWAV.decodeACID(chunk2);
        this.chunks.push({ type: "acid", value, chunk: chunk2 });
        break;
      }
      case "strc": {
        this.rewind(8);
        const chunk2 = this.read(8 + size, false);
        const value = _AudioWAV.decodeSTRC(chunk2);
        this.chunks.push({ type: "strc", value, chunk: chunk2 });
        break;
      }
      case "cue ": {
        this.rewind(8);
        const chunk2 = this.read(8 + size, false);
        const value = _AudioWAV.decodeCue(chunk2);
        this.chunks.push({ type: "cue_points", value, chunk: chunk2 });
        break;
      }
      case "bext": {
        this.rewind(8);
        const chunk2 = this.read(8 + size, false);
        const value = _AudioWAV.decodeBEXT(chunk2, this.options);
        this.chunks.push({ type: "broadcast_extension", value, chunk: chunk2 });
        break;
      }
      case "ResU": {
        this.rewind(8);
        const chunk2 = this.read(8 + size, false);
        const value = _AudioWAV.decodeResU(chunk2);
        this.chunks.push({ type: "logic_resu", value, chunk: chunk2 });
        break;
      }
      case "ds64": {
        this.rewind(8);
        const chunk2 = this.read(8 + size, false);
        const value = _AudioWAV.decodeDS64(chunk2);
        this.chunks.push({ type: "data_size_64", value, chunk: chunk2 });
        break;
      }
      case "cart": {
        this.rewind(8);
        const chunk2 = this.read(8 + size, false);
        this.chunks.push({ type: "cart", chunk: chunk2, unknown: true });
        break;
      }
      case "AFAn":
      case "AFmd": {
        debug3(`macOS Special Binary Chunk: '${type}' with ${size} bytes`);
        this.rewind(8);
        const chunk2 = this.read(8 + size, false);
        this.chunks.push({ type, chunk: chunk2, description: "macOS Special Binary Chunk" });
        break;
      }
      case "minf":
      case "elm1":
      case "regn":
      case "ovwf":
      case "umid": {
        debug3(`ProTools Special Chunk: '${type}' with ${size} bytes`);
        this.rewind(8);
        const chunk2 = this.read(8 + size, false);
        this.chunks.push({ type, chunk: chunk2, description: "ProTools Special Chunk" });
        break;
      }
      case "COMM": {
        this.rewind(8);
        const chunk2 = this.read(8 + size, false);
        const value = _AudioWAV.decodeCOMM(chunk2);
        this.chunks.push({ type: "common", value, chunk: chunk2 });
        break;
      }
      case "SSND": {
        this.rewind(8);
        const chunk2 = this.read(8 + size, false);
        const value = _AudioWAV.decodeSSND(chunk2);
        this.chunks.push({ type: "common", value, chunk: chunk2 });
        break;
      }
      case "FVER": {
        this.rewind(8);
        const chunk2 = this.read(8 + size, false);
        const value = _AudioWAV.decodeFVER(chunk2);
        this.chunks.push({ type: "common", value, chunk: chunk2 });
        break;
      }
      case "ANNO":
      case "AUTH":
      case "NAME": {
        this.rewind(8);
        const chunk2 = this.read(8 + size, false);
        const stream = new data_buffer_default(chunk2);
        const chunkID = stream.readString(4);
        const nameSize = stream.readUInt32();
        const name = stream.readString(nameSize);
        const value = { chunkID, size: nameSize, name };
        debug3("decodeGenericText =", JSON.stringify(value, null, 2));
        this.chunks.push({ type: chunkID.toLowerCase(), value, chunk: chunk2 });
        break;
      }
      default: {
        debug3(`Unsupported Chunk: '${type}' with ${size} bytes`);
        this.rewind(8);
        const chunk2 = this.read(8 + size, false);
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
   * @param {string|Buffer|Uint8Array} chunk Data Blob
   * @returns {WavFormat} The decoded values.
   * @static
   */
  static decodeFMT(chunk2) {
    debug3("decodeFMT");
    const format = new data_buffer_default(chunk2);
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
    if (format.remainingBytes()) {
      value.extraParamSize = format.readUInt16(true);
      if (audioFormatValue === 65534) {
        value.validBitsPerSample = format.readUInt16(true);
        value.channelMask = format.readUInt32(true);
        value.channelMaskLabel = WAVE_CHANNEL_MASK_LABELS[value.channelMask];
        if (value.channelMaskLabel === void 0) {
          debug3("Unknown Channel Mask:", value.channelMask);
          value.channelMaskLabel = `unknown_${value.channelMask}`;
        }
        value.subFormat_1 = format.readUInt32(true);
        value.subFormat_2 = format.readUInt16(true);
        value.subFormat_3 = format.readUInt16(true);
        value.subFormat_4 = format.readUInt32(true);
        value.subFormat_5 = format.readUInt32(true);
      } else if (value.extraParamSize > 0) {
        value.extraParams = format.read(value.extraParamSize, false);
      } else {
        value.extraParams = new Uint8Array();
      }
    }
    debug3("decodeFMT =", JSON.stringify(value, null, 2));
    return value;
  }
  /**
   * Enocdes JSON values to a valid `fmt ` chunk Buffer.
   *
   * Defaults are set to Red Book Compact Disc Digital Audio (CDDA or CD-DA) / Audio CD standards.
   *
   * RF64 specific fields are currently unsupported.
   * @param {object} [data] The values to encode to the `fmt ` chunk.
   * @param {number} [data.audioFormatValue] Format of the audio data, 1 is PCM and values other than 1 indicate some form of compression. See `decodeFMT` for a listing
   * @param {number} [data.channels] Mono = 1, Stereo = 2, etc.
   * @param {number} [data.sampleRate] 8000, 44100, 96000, etc.
   * @param {number} [data.byteRate] Sample Rate * Channels * Bits per Sample / 8
   * @param {number} [data.blockAlign] The number of bytes for one sample including all channels. Channels * Bits per Sample / 8
   * @param {number} [data.bitsPerSample] 8 bits = 8, 16 bits = 16, etc.
   * @param {number} [data.extraParamSize] The size of the extra paramteres to follow, or 0.
   * @param {number} [data.extraParams] Any extra data to encode.
   * @returns {Buffer} The newley encoded `fmt ` chunk.
   * @static
   */
  static encodeFMT(data = {}) {
    debug3("encodeFMT:", data);
    const {
      audioFormatValue = 1,
      channels = 2,
      sampleRate = 44100,
      byteRate = 176400,
      blockAlign = 4,
      bitsPerSample = 16,
      extraParamSize = 0,
      extraParams = 0
    } = data;
    const buffer = Buffer.alloc(26 + extraParamSize, 0);
    buffer.write("fmt ", 0);
    buffer.writeUInt32LE(26 - 8 + extraParamSize, 4);
    buffer.writeUInt16LE(audioFormatValue, 8);
    buffer.writeUInt16LE(channels, 10);
    buffer.writeUInt32LE(sampleRate, 12);
    buffer.writeUInt32LE(byteRate, 16);
    buffer.writeUInt16LE(blockAlign, 20);
    buffer.writeUInt16LE(bitsPerSample, 22);
    buffer.writeUInt16LE(extraParamSize, 24);
    if (extraParamSize > 0 && extraParams) {
      buffer.fill(0, 26, 26 + extraParamSize);
      buffer.write(String(extraParams), 26);
    }
    debug3("Buffer:", buffer.toString("hex"));
    return buffer;
  }
  /**
   * Decode the LIST (LIST Information) chunk.
   *
   * A LIST chunk defines a list of sub-chunks and has the following format.
   * @param {string|Buffer|Uint8Array} chunk Data Blob
   * @returns {WavList} The decoded values.
   * @static
   */
  static decodeLIST(chunk2) {
    debug3("decodeLIST");
    const list = new data_buffer_default(chunk2);
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
        value.data = _AudioWAV.decodeLISTINFO(list);
        break;
      }
      case "adtl": {
        value.data = _AudioWAV.decodeLISTadtl(list);
        break;
      }
      default: {
        debug3(`Unknown LIST Type: ${type}`);
      }
    }
    debug3("decodeLIST =", JSON.stringify(value, null, 2));
    return value;
  }
  /**
   * Decode the LIST INFO chunks.
   * @param {DataBuffer} buffer List DataBuffer
   * @returns {WavListInfo[]} The parsed list.
   */
  static decodeLISTINFO(buffer) {
    debug3("decodeLISTINFO");
    const value = [];
    while (buffer.remainingBytes()) {
      const info = (
        /** @type {WavListInfo} */
        {}
      );
      info.id = buffer.readString(4);
      debug3("decodeLISTINFO chunk id:", info.id);
      info.size = buffer.readUInt32(true);
      debug3("decodeLISTINFO chunk size:", info.size);
      info.text = buffer.readString(info.size);
      debug3("decodeLISTINFO chunk text:", info.text);
      if (info.size % 2 !== 0) {
        buffer.advance(1);
      }
      value.push(info);
    }
    return value;
  }
  /**
   * Decode the LIST adtl chunks.
   * @param {DataBuffer} buffer List DataBuffer
   * @returns {WavListAdtl[]} The parsed list.
   */
  static decodeLISTadtl(buffer) {
    debug3("decodeLISTadtl");
    const value = [];
    while (buffer.remainingBytes()) {
      const adtl = (
        /** @type {WavListAdtl} */
        {}
      );
      adtl.id = buffer.readString(4);
      adtl.size = buffer.readUInt32(true);
      switch (adtl.id) {
        case "labl": {
          adtl.label = buffer.readString(adtl.size).trim();
          break;
        }
        case "ltxt": {
          adtl.ltxt = buffer.readString(adtl.size).trim();
          break;
        }
        default: {
          debug3(`Unknown ID: ${adtl.id}`);
          buffer.advance(adtl.size);
        }
      }
      value.push(adtl);
    }
    return value;
  }
  /**
   * Decode the data (Audio Data) chunk.
   * @param {string|Buffer|Uint8Array} chunk Data Blob
   * @static
   */
  static decodeDATA(chunk2) {
    debug3(`decodeDATA: ${chunk2.length} data bytes`);
  }
  /**
   * Decode the `tlst` (Trigger List) chunk.
   *
   * Used in Sound Forge by Sonic Foundry
   *
   * Specifies a list of triggers which can be used to trigger playback of a series of cue points or Playlist entries.
   *
   * There's a historical bug in dwName (which is in fact an index, and the bug is that it's actually Index-1).
   * @param {string|Buffer|Uint8Array} chunk Data Blob
   * @returns {WavTriggerList} The decoded values.
   * @static
   */
  static decodeTLST(chunk2) {
    debug3("decodeTLST");
    const tlst = new data_buffer_default(chunk2);
    const _chunkID = tlst.readString(4);
    const size = tlst.readUInt32(true);
    debug3("decodeTLST size", size);
    const list = tlst.readUInt32(true);
    const name = tlst.readString(4);
    const type = tlst.readUInt32(true);
    const triggerOn1 = tlst.readUInt8();
    const triggerOn2 = tlst.readUInt8();
    const triggerOn3 = tlst.readUInt8();
    const triggerOn4 = tlst.readUInt8();
    const func = tlst.readUInt32(true);
    const extra = tlst.readUInt32(true);
    const extraData = tlst.readUInt32(true);
    const value = {
      list,
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
    debug3("decodeTLST =", JSON.stringify(value, null, 2));
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
   * @param {string|Buffer|Uint8Array} chunk Data Blob
   * @returns {WavFact} The decoded values.
   * @static
   * @see {@link https://www.recordingblogs.com/wiki/fact-chunk-of-a-wave-file | Fact chunk (of a Wave file)}
   * @see {@link http://www-mmsp.ece.mcgill.ca/Documents/AudioFormats/WAVE/WAVE.html | Audio File Format Specifications}
   */
  static decodeFACT(chunk2) {
    debug3("decodeFACT");
    const fact = new data_buffer_default(chunk2);
    const _chunkID = fact.readString(4);
    const size = fact.readUInt32(true);
    debug3("decodeFACT size", size);
    const numberOfSamples = fact.readUInt32(true);
    const value = { numberOfSamples };
    debug3("decodeFACT =", JSON.stringify(value, null, 2));
    return value;
  }
  // TODO: Should have more entries by number of channels, https://github.com/libsndfile/libsndfile/blob/08d802a3d18fa19c74f38ed910d9e33f80248187/src/aiff.c#L110
  /**
   * Decode the PEAK chunk.
   * @param {string|Buffer|Uint8Array} chunk Data Blob
   * @returns {WavPeak} The decoded values.
   * @static
   * @see {@link https://code.google.com/archive/p/awesome-wav/wikis/WAVFormat.wiki|awesome-wav - WAVFormat.wiki}
   */
  static decodePEAK(chunk2) {
    debug3("decodePEAK");
    const peak = new data_buffer_default(chunk2);
    const _chunkID = peak.readString(4);
    const size = peak.readUInt32(true);
    debug3("decodePEAK size", size);
    const version = peak.readUInt32(true);
    const timestamp = peak.readUInt32(true);
    const ppeakPointer = peak.readUInt32(true);
    const bitAlign = peak.readUInt32(true);
    const value = {
      version,
      timestamp,
      ppeakPointer,
      bitAlign
    };
    debug3("decodePEAK =", JSON.stringify(value, null, 2));
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
   * @param {string|Buffer|Uint8Array} chunk Data Blob
   * @returns {WavDisplay} The decoded values.
   * @static
   * @see {@link http://netghost.narod.ru/gff/vendspec/micriff/ms_riff.txt|New Multimedia Data Types and Data Techniques}
   * @see {@link https://docs.microsoft.com/en-us/windows/win32/dataxchg/standard-clipboard-formats|Standard Clipboard Formats}
   */
  static decodeDISP(chunk2) {
    debug3("decodeDISP");
    const disp = new data_buffer_default(chunk2);
    const _chunkID = disp.readString(4);
    const size = disp.readUInt32(true);
    debug3("decodeDISP size", size);
    const type = disp.readUInt32(true);
    const data = disp.readUInt16(true);
    const value = { type, data };
    debug3("decodeDISP =", JSON.stringify(value, null, 2));
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
   * @param {string|Buffer|Uint8Array} chunk Data Blob
   * @returns {WavAcid} The decoded values.
   * @memberof AudioWAV
   */
  static decodeACID(chunk2) {
    debug3("decodeACID");
    const acid = new data_buffer_default(chunk2);
    const _chunkID = acid.readString(4);
    const size = acid.readUInt32(true);
    debug3("decodeACID size", size);
    const type = acid.readUInt32(true);
    const rootNote = acid.readUInt16(true);
    const unknown1 = acid.readUInt16(true);
    const unknown2 = acid.readUInt32(true);
    const beats = acid.readUInt32(true);
    const meterDenominator = acid.readUInt16(true);
    const meterNumerator = acid.readUInt16(true);
    const tempo = acid.readUInt32(true);
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
    debug3("decodeACID =", JSON.stringify(value, null, 2));
    return value;
  }
  /**
   * Decode the inst (Instrumet) chunk.
   *
   * When a wave file is used as wave samples in a MIDI synthesizer,
   * the instrument chunk helps the MIDI synthesizer define the sample pitch & relative volume of the samples.
   * @param {string|Buffer|Uint8Array} chunk Data Blob
   * @returns {WavInstrument} The decoded values.
   * @static
   */
  static decodeINST(chunk2) {
    debug3("decodeINST");
    const inst = new data_buffer_default(chunk2);
    const _chunkID = inst.readString(4);
    const size = inst.readUInt32(true);
    debug3("decodeINST size", size);
    const unshiftedNote = inst.readUInt8();
    const fineTuning = inst.readUInt8();
    const gain = inst.readUInt8();
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
    debug3("decodeINST =", JSON.stringify(value, null, 2));
    return value;
  }
  /**
   * Decode the smpl (Sample) chunk.
   *
   * The sample chunk allows a MIDI sampler to use the Wave file as a collection of samples.
   * @param {string|Buffer|Uint8Array} chunk Data Blob
   * @returns {WavSample} The decoded values.
   * @static
   */
  static decodeSMPL(chunk2) {
    debug3("decodeSMPL");
    const smpl = new data_buffer_default(chunk2);
    const _chunkID = smpl.readString(4);
    const size = smpl.readUInt32(true);
    debug3("decodeSMPL size", size);
    const manufacturer1 = smpl.readUInt8();
    const manufacturer2 = smpl.readUInt8();
    const manufacturer3 = smpl.readUInt8();
    const manufacturer4 = smpl.readUInt8();
    const product = smpl.readUInt32(true);
    const samplePeriod = smpl.readUInt32(true);
    const midiUnityNote = smpl.readUInt32(true);
    const midiPitchFraction = smpl.readUInt32(true);
    const SMPTEFormat = smpl.readUInt32(true);
    const SMPTEOffset1 = smpl.readUInt8();
    const SMPTEOffset2 = smpl.readUInt8();
    const SMPTEOffset3 = smpl.readUInt8();
    const SMPTEOffset4 = smpl.readUInt8();
    const sampleLoopsCount = smpl.readUInt32(true);
    const sampleDataSize = smpl.readUInt32(true);
    const sampleLoops = [];
    if (sampleLoopsCount > 0) {
      debug3("decodeSMPL sampleLoopsCount", sampleLoopsCount);
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
    let sampleData;
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
    debug3("decodeSMPL =", JSON.stringify(value, null, 2));
    return value;
  }
  /**
   * Decode the RLND (Roland) chunk.
   *
   * Useful for use on SP-404 / SP-404SX / SP-404A samplers, perhaps others.
   *
   * This chunk is sized and padded with zeros to ensure that the the sample data starts exactly at offset 512.
   * @param {string|Buffer|Uint8Array} chunk Data Blob
   * @returns {WavRoland} The decoded values.
   * @static
   */
  static decodeRLND(chunk2) {
    debug3("decodeRLND");
    const roland = new data_buffer_default(chunk2);
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
        debug3("Unknown Pad:", sampleIndex);
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
    debug3("decodeRLND =", JSON.stringify(value, null, 2));
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
   * @param {object} data The JSON values to set in the RLND chunk.
   * @param {string} data.device An 8 character string representing the device label. SP-404SX Wave Converter v1.01 on macOS sets this value to `roifspsx`.
   * @param {number} [data.unknown1] Unknown, SP-404SX Wave Converter v1.01 on macOS sets this value to `0x04`.
   * @param {number} [data.unknown2] Unknown, SP-404SX Wave Converter v1.01 on macOS sets this value to `0x00`.
   * @param {number} [data.unknown3] Unknown, SP-404SX Wave Converter v1.01 on macOS sets this value to `0x00`.
   * @param {number} [data.unknown4] Unknown, SP-404SX Wave Converter v1.01 on macOS sets this value to `0x00`.
   * @param {number|string} data.sampleIndex The pad the sample plays on, between `0` and `119` as a number or the pad label, `A1` - `J12`. Only the SP404SX (device === `roifspsx`) provided values can be converted from string corrently, and if it is not found it will defailt to `0` / `A1`.
   * @returns {Buffer<ArrayBuffer>} The new RLND chunk.
   * @static
   * @see {@link https://www.roland.com/global/support/by_product/sp-404sx/updates_drivers/|SP-404SX Support Page}
   */
  static encodeRLND(data) {
    const {
      device,
      unknown1 = 4,
      unknown2 = 0,
      unknown3 = 0,
      unknown4 = 0
    } = data;
    let { sampleIndex } = data;
    debug3("encodeRLND:", device, unknown1, unknown2, unknown3, unknown4, sampleIndex);
    const buffer = Buffer.alloc(466, 0);
    buffer.write("RLND", 0);
    buffer.writeUInt32LE(458, 4);
    buffer.write(device, 8);
    buffer.writeUInt8(unknown1, 16);
    buffer.writeUInt8(unknown2, 17);
    buffer.writeUInt8(unknown3, 18);
    buffer.writeUInt8(unknown4, 19);
    if (device === "roifspsx" && typeof sampleIndex === "string") {
      const index = ROLAND_SP404SX_PADS.indexOf(sampleIndex.toUpperCase());
      if (index === -1) {
        debug3("Unknown Pad:", sampleIndex);
        sampleIndex = 0;
      } else {
        sampleIndex = index;
      }
    }
    buffer.writeUInt8(Number(sampleIndex), 20);
    debug3("Buffer:", buffer.toString("hex"));
    return buffer;
  }
  /**
   * Decode the JUNK (Padding) chunk.
   *
   * To align RIFF chunks to certain boundaries (i.e. 2048 bytes for CD-ROMs) the RIFF specification includes a JUNK chunk.
   * The contents are to be skipped when reading.
   * When writing RIFFs, JUNK chunks should not have an odd Size.
   * @param {string|Buffer|Uint8Array} chunk Data Blob
   * @param {object} options Decoding options.
   * @param {boolean} options.roundOddChunks When true we will round odd chunk sizes up to keep in spec.
   * @static
   */
  static decodeJUNK(chunk2, options) {
    const junk = new data_buffer_default(chunk2);
    const chunkID = junk.readString(4);
    let size = junk.readUInt32(true);
    if (options.roundOddChunks && size % 2 !== 0) {
      size += 1;
    }
    debug3(`decodeJUNK: ${chunk2.length} bytes, chunkID: ${chunkID}, junk size: ${size}`);
  }
  /**
   * Decode the `PAD ` (Padding) chunk.
   * @param {string|Buffer|Uint8Array} chunk Data Blob
   * @static
   */
  static decodePAD(chunk2) {
    const pad = new data_buffer_default(chunk2);
    const chunkID = pad.readString(4);
    const size = pad.readUInt32(true);
    debug3(`decodePAD: ${chunk2.length} bytes, chunkID: ${chunkID}, pad size: ${size}`);
  }
  /**
   * Decode the bext (Broadcast Wave Format (BWF) Broadcast Extension) chunk.
   * @param {string|Buffer|Uint8Array} chunk Data Blob
   * @param {object} options Decoding options.
   * @param {boolean} options.roundOddChunks When true we will round odd chunk sizes up to keep in spec.
   * @returns {WavBext} The decoded values.
   * @static
   * @see {@link https://sites.google.com/site/musicgapi/technical-documents/wav-file-format#cue|Cue Chunk}
   * @see {@link https://tech.ebu.ch/docs/tech/tech3285.pdf|Spec}
   */
  static decodeBEXT(chunk2, options) {
    debug3("decodeBEXT");
    const bext = new data_buffer_default(chunk2);
    const chunkID = bext.readString(4);
    let size = bext.readUInt32(true);
    if (options.roundOddChunks && size % 2 !== 0) {
      size += 1;
    }
    const value = {
      chunkID,
      size
    };
    value.description = bext.readString(256);
    value.originator = bext.readString(32);
    value.originatorReference = bext.readString(32);
    value.originationDate = bext.readString(10);
    value.originationTime = bext.readString(8);
    value.timeReferenceLow = bext.readUInt32(true);
    value.timeReferenceHigh = bext.readUInt32(true);
    value.version = bext.readUInt16(true);
    value.umid = bext.read(64, false);
    value.loudnessValue = bext.readUInt16(true);
    value.loudnessRange = bext.readUInt16(true);
    value.maxTruePeakLevel = bext.readUInt16(true);
    value.maxMomentaryLoudness = bext.readUInt16(true);
    value.maxShortTermLoudness = bext.readUInt16(true);
    value.reserved = bext.read(180, false);
    value.codingHistory = bext.read(bext.remainingBytes(), true);
    debug3("decodeBEXT =", JSON.stringify(value, null, 2));
    return value;
  }
  /**
   * Decode the 'cue ' (Cue Points) chunk.
   *
   * A cue chunk specifies one or more sample offsets which are often used to mark noteworthy sections of audio.
   * For example, the beginning and end of a verse in a song may have cue points to make them easier to find.
   * The cue chunk is optional and if included, a single cue chunk should specify all cue points for the "WAVE" chunk.
   * No more than one cue chunk is allowed in a "WAVE" chunk.
   * @param {string|Buffer|Uint8Array} chunk Data Blob
   * @returns {WavCue} The decoded values.
   * @static
   * @see {@link https://sites.google.com/site/musicgapi/technical-documents/wav-file-format#cue|Cue Chunk}
   */
  static decodeCue(chunk2) {
    debug3("decodeCue");
    const cue = new data_buffer_default(chunk2);
    const chunkID = cue.readString(4);
    const size = cue.readUInt32(true);
    debug3("decodeCue size", size);
    const numberCuePoints = cue.readUInt32(true);
    debug3("decodeCue numberCuePoints", numberCuePoints);
    const value = (
      /** @type {WavCue} */
      {
        chunkID,
        size,
        numberCuePoints,
        data: []
      }
    );
    for (let i = 0; i < numberCuePoints; i++) {
      const point = (
        /** @type {WavCuePoint} */
        {}
      );
      point.id = cue.readUInt32(true);
      point.position = cue.readUInt32(true);
      point.chunkID = cue.readString(4);
      point.chunkStart = cue.readUInt32(true);
      point.blockStart = cue.readUInt32(true);
      point.sampleOffset = cue.readUInt32(true);
      value.data.push(point);
    }
    if (cue.remainingBytes() > 0) {
      debug3(`Unexpected ${cue.remainingBytes()} bytes remaining`);
    }
    debug3("decodeCue =", JSON.stringify(value, null, 2));
    return value;
  }
  /**
   * Decode the 'ResU' chunk, a ZIP compressed JSON Data containg Time Signature, Tempo and other data for Logic Pro X.
   * @param {string|Buffer|Uint8Array} chunk Data Blob
   * @returns {WavResU} The decoded values.
   * @static
   */
  static decodeResU(chunk2) {
    debug3("decodeResU");
    const resu = new data_buffer_default(chunk2);
    const chunkID = resu.readString(4);
    const size = resu.readUInt32(true);
    const data = resu.read(size, false);
    let decompressed = "";
    try {
      decompressed = new TextDecoder().decode(inflate(data));
      debug3("Inflated Size:", decompressed.length);
    } catch (error) {
      debug3("Error Inflating ResU:", error);
    }
    const value = {
      chunkID,
      size
    };
    try {
      value.data = /** @type {unknown} */
      JSON.parse(decompressed);
    } catch (error) {
      debug3("Error Parsing ResU JSON:", error);
    }
    debug3("decodeResU =", JSON.stringify(value, null, 2));
    return value;
  }
  /**
   * DataSize 64 Parsing
   * @param {string|Buffer|Uint8Array} chunk Data Blob
   * @returns {WavDS64} The decoded values.
   * @see {@link https://tech.ebu.ch/docs/tech/tech3306v1_0.pdf|RF64: An extended File Format for Audio}
   * @static
   */
  static decodeDS64(chunk2) {
    const ds64 = new data_buffer_default(chunk2);
    const chunkID = ds64.readString(4);
    const size = ds64.readUInt32(true);
    const riffSizeLow = ds64.readUInt32(true);
    const riffSizeHigh = ds64.readUInt32(true);
    const dataSizeLow = ds64.readUInt32(true);
    const dataSizeHigh = ds64.readUInt32(true);
    const sampleCountLow = ds64.readUInt32(true);
    const sampleCountHigh = ds64.readUInt32(true);
    const tableLength = ds64.readUInt32(true);
    const table = [];
    if (tableLength > 0) {
      while (ds64.remainingBytes() > 0) {
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
    debug3("decodeDS64 =", JSON.stringify(value, null, 2));
    return value;
  }
  /**
   * Decode the STRC (ACID Related) chunk.
   *
   * When a wave file is used as wave samples in a MIDI synthesizer,
   * the instrument chunk helps the MIDI synthesizer define the sample pitch & relative volume of the samples.
   * @param {string|Buffer|Uint8Array} chunk Data Blob
   * @returns {WavStrc} The decoded values.
   * @static
   */
  static decodeSTRC(chunk2) {
    debug3("decodeSTRC");
    const strc = new data_buffer_default(chunk2);
    const _chunkID = strc.readString(4);
    const size = strc.readUInt32(true);
    debug3("decodeSTRC size:", size);
    const unknown1 = strc.readUInt32(true);
    const numberOfSlices = strc.readUInt32(true);
    const unknown2 = strc.readUInt32(true);
    const unknown3 = strc.readUInt32(true);
    const unknown4 = strc.readUInt32(true);
    const unknown5 = strc.readUInt32(true);
    const unknown6 = strc.readUInt32(true);
    const slices = [];
    debug3("decodeSTRC numberOfSlices:", numberOfSlices);
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
      debug3("decodeSTRC slice:", i, slice);
      debug3("remaining", strc.remainingBytes());
      slices.push(slice);
    }
    debug3("decodeSTRC remaining", strc.remainingBytes());
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
    debug3("decodeSTRC =", JSON.stringify(value, null, 2));
    return value;
  }
  /**
   * Decode the COMM (Common) chunk.
   * The Common Chunk describes fundamental parameters of the sampled sound.
   * @param {string|Buffer|Uint8Array} chunk Data Blob
   * @returns {AiffCommon} The decoded values.
   * @see {@link https://www.mmsp.ece.mcgill.ca/Documents/AudioFormats/AIFF/AIFF.html|Audio File Format Specifications}
   * @static
   */
  static decodeCOMM(chunk2) {
    debug3("decodeCOMM");
    const commonChunk = new data_buffer_default(chunk2);
    const chunkID = commonChunk.readString(4);
    const size = commonChunk.readUInt32();
    const channels = commonChunk.readUInt16();
    const sampleFrames = commonChunk.readUInt32();
    const sampleSize = commonChunk.readUInt16();
    const sampleRate = commonChunk.readFloatIEEE754(false);
    let compressionType = "";
    let compressionTypeName = "";
    if (size !== 18) {
      compressionType = commonChunk.readString(4);
      const nameLength = commonChunk.readUInt8();
      compressionTypeName = commonChunk.readString(nameLength);
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
    debug3("decodeCOMM =", JSON.stringify(value, null, 2));
    return value;
  }
  /**
   * Decode the SSND (Sound Data) chunk.
   *
   * Offset:     4 bytes
   * Block Size: 4 bytes
   * Sound Data: n bytes
   * @param {string|Buffer|Uint8Array} chunk Data Blob
   * @returns {AiffSoundData} The decoded values.
   * @see {@link https://www.mmsp.ece.mcgill.ca/Documents/AudioFormats/AIFF/AIFF.html|Audio File Format Specifications}
   * @static
   */
  static decodeSSND(chunk2) {
    debug3("decodeSSND");
    const ssndChunk = new data_buffer_default(chunk2);
    const chunkID = ssndChunk.readString(4);
    const size = ssndChunk.readUInt32();
    const offset = ssndChunk.readUInt32();
    const blockSize = ssndChunk.readUInt32();
    const soundData = ssndChunk.read(ssndChunk.remainingBytes());
    const value = {
      chunkID,
      size,
      offset,
      blockSize,
      soundData
    };
    debug3("decodeSSND =", JSON.stringify({ chunkID, size, offset, blockSize }, null, 2));
    return value;
  }
  /**
   * Decode the FVER (Format Vers) chunk.
   *
   * The Format Version Chunk contains a date field to indicate the format rules for an AIFF-C specification.
   * The timestamp holds the number of seconds since January 1, 1904.
   * The FVER chunk appears only in AIFF-C files.
   * @param {string|Buffer|Uint8Array} chunk Data Blob
   * @returns {AiffFormatVersion} The decoded values.
   * @see {@link https://www.mmsp.ece.mcgill.ca/Documents/AudioFormats/AIFF/AIFF.html|Audio File Format Specifications}
   * @static
   */
  static decodeFVER(chunk2) {
    debug3("decodeFVER");
    const formatVersionChunk = new data_buffer_default(chunk2);
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
    debug3("decodeFVER =", JSON.stringify(value, null, 2));
    return value;
  }
};
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
    const nibbles = Array.from({ length: 16 }, (_2, sampleIndex) => {
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
var sameModelValue = (left, right) => {
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
var nativeEncoder = (id, kind, output, modelField, encode, decode) => Object.freeze({
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
var snesNativeEncoders = Object.freeze(
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
var audioOptions = (raw, source) => {
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

// node_modules/@uttori/data-tools/src/data-hash-crc32.js
var CRC32_TABLE = [
  0,
  1996959894,
  3993919788,
  2567524794,
  124634137,
  1886057615,
  3915621685,
  2657392035,
  249268274,
  2044508324,
  3772115230,
  2547177864,
  162941995,
  2125561021,
  3887607047,
  2428444049,
  498536548,
  1789927666,
  4089016648,
  2227061214,
  450548861,
  1843258603,
  4107580753,
  2211677639,
  325883990,
  1684777152,
  4251122042,
  2321926636,
  335633487,
  1661365465,
  4195302755,
  2366115317,
  997073096,
  1281953886,
  3579855332,
  2724688242,
  1006888145,
  1258607687,
  3524101629,
  2768942443,
  901097722,
  1119000684,
  3686517206,
  2898065728,
  853044451,
  1172266101,
  3705015759,
  2882616665,
  651767980,
  1373503546,
  3369554304,
  3218104598,
  565507253,
  1454621731,
  3485111705,
  3099436303,
  671266974,
  1594198024,
  3322730930,
  2970347812,
  795835527,
  1483230225,
  3244367275,
  3060149565,
  1994146192,
  31158534,
  2563907772,
  4023717930,
  1907459465,
  112637215,
  2680153253,
  3904427059,
  2013776290,
  251722036,
  2517215374,
  3775830040,
  2137656763,
  141376813,
  2439277719,
  3865271297,
  1802195444,
  476864866,
  2238001368,
  4066508878,
  1812370925,
  453092731,
  2181625025,
  4111451223,
  1706088902,
  314042704,
  2344532202,
  4240017532,
  1658658271,
  366619977,
  2362670323,
  4224994405,
  1303535960,
  984961486,
  2747007092,
  3569037538,
  1256170817,
  1037604311,
  2765210733,
  3554079995,
  1131014506,
  879679996,
  2909243462,
  3663771856,
  1141124467,
  855842277,
  2852801631,
  3708648649,
  1342533948,
  654459306,
  3188396048,
  3373015174,
  1466479909,
  544179635,
  3110523913,
  3462522015,
  1591671054,
  702138776,
  2966460450,
  3352799412,
  1504918807,
  783551873,
  3082640443,
  3233442989,
  3988292384,
  2596254646,
  62317068,
  1957810842,
  3939845945,
  2647816111,
  81470997,
  1943803523,
  3814918930,
  2489596804,
  225274430,
  2053790376,
  3826175755,
  2466906013,
  167816743,
  2097651377,
  4027552580,
  2265490386,
  503444072,
  1762050814,
  4150417245,
  2154129355,
  426522225,
  1852507879,
  4275313526,
  2312317920,
  282753626,
  1742555852,
  4189708143,
  2394877945,
  397917763,
  1622183637,
  3604390888,
  2714866558,
  953729732,
  1340076626,
  3518719985,
  2797360999,
  1068828381,
  1219638859,
  3624741850,
  2936675148,
  906185462,
  1090812512,
  3747672003,
  2825379669,
  829329135,
  1181335161,
  3412177804,
  3160834842,
  628085408,
  1382605366,
  3423369109,
  3138078467,
  570562233,
  1426400815,
  3317316542,
  2998733608,
  733239954,
  1555261956,
  3268935591,
  3050360625,
  752459403,
  1541320221,
  2607071920,
  3965973030,
  1969922972,
  40735498,
  2617837225,
  3943577151,
  1913087877,
  83908371,
  2512341634,
  3803740692,
  2075208622,
  213261112,
  2463272603,
  3855990285,
  2094854071,
  198958881,
  2262029012,
  4057260610,
  1759359992,
  534414190,
  2176718541,
  4139329115,
  1873836001,
  414664567,
  2282248934,
  4279200368,
  1711684554,
  285281116,
  2405801727,
  4167216745,
  1634467795,
  376229701,
  2685067896,
  3608007406,
  1308918612,
  956543938,
  2808555105,
  3495958263,
  1231636301,
  1047427035,
  2932959818,
  3654703836,
  1088359270,
  936918e3,
  2847714899,
  3736837829,
  1202900863,
  817233897,
  3183342108,
  3401237130,
  1404277552,
  615818150,
  3134207493,
  3453421203,
  1423857449,
  601450431,
  3009837614,
  3294710456,
  1567103746,
  711928724,
  3020668471,
  3272380065,
  1510334235,
  755167117
];
var calculate = (data) => {
  const buffer = new data_buffer_default(data);
  let crc = -1;
  for (const byte of buffer.data) {
    crc = crc >>> 8 ^ CRC32_TABLE[(crc ^ byte) & 255];
  }
  return (~crc >>> 0).toString(16).toUpperCase();
};
var data_hash_crc32_default = {
  of: calculate
};

// node_modules/@uttori/data-tools/src/image/data-image-png.js
var debug4 = () => {
};
if (typeof process !== "undefined" && process.env.UTTORI_DATA_DEBUG) {
  try {
    const { default: d } = await Promise.resolve().then(() => __toESM(require_src(), 1));
    debug4 = d("Uttori.ImagePNG");
  } catch {
  }
}
var ImagePNG = class _ImagePNG extends data_buffer_default {
  /**
   * Creates a new ImagePNG.
   * @param {number[]|ArrayBuffer|Buffer|DataBuffer|Int8Array|Int16Array|Int32Array|number|string|Uint8Array|Uint16Array|Uint32Array} input The data to process.
   */
  constructor(input) {
    super(input);
    this.width = 0;
    this.height = 0;
    this.bitDepth = 0;
    this.colorType = 0;
    this.compressionMethod = 0;
    this.filterMethod = 0;
    this.interlaceMethod = 0;
    this.colors = 0;
    this.alpha = false;
    this.palette = [];
    this.pixels = new Uint8Array();
    this.transparency = new Uint8Array();
    this.physical = {
      /** @type {number} Physical Dimension Width */
      width: 0,
      /** @type {number} Physical Dimension Height */
      height: 0,
      /** @type {number} Physical Dimension Units, with 0 being unknown and 1 being Meters */
      unit: 0
    };
    this.dataChunks = [];
    this.header = [];
    this.parse();
  }
  /**
   * Creates a new ImagePNG from file data.
   * @param {number[]|ArrayBuffer|Buffer|DataBuffer|Int8Array|Int16Array|Int32Array|number|string|Uint8Array|Uint16Array|Uint32Array} data The data of the image to process.
   * @returns {ImagePNG} the new ImagePNG instance for the provided file data
   * @static
   */
  static fromFile(data) {
    debug4("fromFile:", data);
    return new _ImagePNG(data);
  }
  /**
   * Creates a new ImagePNG from a DataBuffer.
   * @param {DataBuffer} buffer The DataBuffer of the image to process.
   * @returns {ImagePNG} the new ImagePNG instance for the provided DataBuffer
   * @static
   */
  static fromBuffer(buffer) {
    debug4("fromBuffer:", buffer.length);
    return new _ImagePNG(buffer);
  }
  /**
   * Sets the bitDepth on the ImagePNG instance.
   * @param {number} bitDepth The bitDepth to set, one of: 1, 2, 4, 8, 16
   */
  setBitDepth(bitDepth) {
    debug4("setBitDepth:", bitDepth);
    if (![1, 2, 4, 8, 16].includes(bitDepth)) {
      throw new Error(`Invalid Bit Depth: ${bitDepth}, can be one of: 1, 2, 4, 8, 16`);
    }
    this.bitDepth = bitDepth;
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
   * @param {number} colorType - The colorType to set, one of: 0, 2, 3, 4, 6
   * @throws {Error} Invalid Color Type, anything other than 0, 2, 3, 4, 6
   */
  setColorType(colorType) {
    debug4("setColorType:", colorType);
    let colors = 0;
    let alpha = false;
    switch (colorType) {
      case 0:
        colors = 1;
        break;
      case 2:
        colors = 3;
        break;
      case 3:
        colors = 1;
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
  }
  /**
   * Sets the compressionMethod on the ImagePNG instance.
   * The compressionMethod should always be 0.
   * @param {number} compressionMethod - The compressionMethod to set, always 0
   * @throws {Error} Unsupported Compression Method, anything other than 0
   */
  setCompressionMethod(compressionMethod) {
    debug4("setCompressionMethod:", compressionMethod);
    if (compressionMethod !== 0) {
      throw new Error(`Unsupported Compression Method: ${compressionMethod}, should be 0`);
    }
    this.compressionMethod = compressionMethod;
  }
  /**
   * Sets the filterMethod on the ImagePNG instance.
   * The filterMethod should always be 0.
   * @param {number} filterMethod - The filterMethod to set, always 0
   * @throws {Error} Unsupported Filter Method, anything other than 0
   */
  setFilterMethod(filterMethod) {
    debug4("setFilterMethod:", filterMethod);
    if (filterMethod !== 0) {
      throw new Error(`Unsupported Filter Method: ${filterMethod}, should be 0`);
    }
    this.filterMethod = filterMethod;
  }
  /**
   * Sets the interlaceMethod on the ImagePNG instance.
   * The interlaceMethod should always be 0 or 1.
   * @param {number} interlaceMethod The interlaceMethod to set, always 0 or 1
   * @throws {Error} Unsupported Interlace Method, anything other than 0 or 1
   */
  setInterlaceMethod(interlaceMethod) {
    debug4("setInterlaceMethod:", interlaceMethod);
    if (interlaceMethod !== 0 && interlaceMethod !== 1) {
      throw new Error(`Unsupported Interlace Method: ${interlaceMethod}`);
    }
    this.interlaceMethod = interlaceMethod;
  }
  /**
   * Sets the palette on the ImagePNG instance.
   * @param {number[] | Uint8Array} palette The palette to set
   * @throws {Error} No colors in the palette
   * @throws {Error} Too many colors for the current bit depth
   */
  setPalette(palette) {
    debug4("setPalette:", palette);
    if (!Array.isArray(palette) && !ArrayBuffer.isView(palette)) {
      debug4("Invalid palette provided.");
      return;
    }
    if (palette.length === 0) {
      throw new Error("Palette contains no colors");
    }
    if (palette.length > 2 ** this.bitDepth * 3) {
      throw new Error(`Palette contains more colors than ${2 ** this.bitDepth * 3} ((2 ^ ${this.bitDepth}) * 3)`);
    }
    this.palette = palette;
  }
  /**
   * Get the pixel color at a specified x, y location.
   * @param {number} x The hoizontal offset to read.
   * @param {number} y The vertical offset to read.
   * @returns {Array<number>} the color as [red, green, blue, alpha]
   * @throws {Error} x is out of bound for the image
   * @throws {Error} y is out of bound for the image
   * @throws {Error} Unknown color types
   */
  getPixel(x, y) {
    if (!this.pixels) {
      throw new Error("Pixel data has not been decoded.");
    }
    if (!Number.isInteger(x) || x >= this.width || x < 0) {
      throw new Error(`x position out of bounds or invalid: ${x}`);
    }
    if (!Number.isInteger(y) || y >= this.height || y < 0) {
      throw new Error(`y position out of bounds or invalid: ${y}`);
    }
    debug4("getPixel x:", x, "y:", y, "colorType:", this.colorType, "colors:", this.colors, "bitDepth:", this.bitDepth);
    const i = this.colors * this.bitDepth / 8 * (y * this.width + x);
    debug4("index:", i);
    switch (this.colorType) {
      case 0: {
        return [this.pixels[i], this.pixels[i], this.pixels[i], 255];
      }
      case 2: {
        return [this.pixels[i], this.pixels[i + 1], this.pixels[i + 2], 255];
      }
      case 3: {
        let alpha = 255;
        if (this.transparency != null && this.transparency[this.pixels[i]] != null) {
          alpha = this.transparency[this.pixels[i]];
        }
        return [
          this.palette[this.pixels[i] * 3 + 0],
          this.palette[this.pixels[i] * 3 + 1],
          this.palette[this.pixels[i] * 3 + 2],
          alpha
        ];
      }
      case 4: {
        if (this.bitDepth === 8) {
          return [this.pixels[i], this.pixels[i], this.pixels[i], this.pixels[i + 1]];
        }
        return [this.pixels[i + 1], this.pixels[i + 1], this.pixels[i + 1], this.pixels[i + 3]];
      }
      case 6: {
        if (this.bitDepth === 8) {
          return [this.pixels[i], this.pixels[i + 1], this.pixels[i + 2], this.pixels[i + 3]];
        }
        return [this.pixels[i + 1], this.pixels[i + 3], this.pixels[i + 5], this.pixels[i + 7]];
      }
      default: {
        throw new Error(`Unknown Color Type: ${this.colorType}`);
      }
    }
  }
  /**
   * Parse the PNG file, decoding the supported chunks.
   */
  parse() {
    debug4("parse");
    this.decodeHeader();
    while (this.remainingBytes()) {
      const type = this.decodeChunk();
      if (type === "IEND") {
        const leftover = this.remainingBytes();
        if (leftover > 0) {
          debug4("ending with data left:", leftover, "bytes left");
        }
        break;
      }
    }
  }
  /**
   * Decodes and validates PNG Header.
   * Signature (Decimal): [137, 80, 78, 71, 13, 10, 26, 10]
   * Signature (Hexadecimal): [89, 50, 4E, 47, 0D, 0A, 1A, 0A]
   * Signature (ASCII): [\211, P, N, G, \r, \n, \032, \n]
   * @throws {Error} Missing or invalid PNG header
   * @see {@link http://www.w3.org/TR/2003/REC-PNG-20031110/#5PNG-file-signature|PNG Signature}
   */
  decodeHeader() {
    debug4("decodeHeader: offset =", this.offset);
    if (this.offset !== 0) {
      debug4("Offset should be at 0 to read the header.");
    }
    const header = this.read(8);
    debug4("header:", header);
    const header_buffer = new data_buffer_default(header);
    if (!header_buffer.compare([137, 80, 78, 71, 13, 10, 26, 10])) {
      throw new Error("Missing or invalid PNG header.");
    }
    this.header = header;
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
   * @returns {string} Chunk Type
   * @throws {Error} Invalid Chunk Length when less than 0
   * @see {@link http://www.w3.org/TR/2003/REC-PNG-20031110/#5Chunk-layout|Chunk Layout}
   */
  decodeChunk() {
    debug4("decodeChunk");
    const length = this.readUInt32();
    if (length < 0) {
      throw new Error(`Invalid Chunk Length: ${4294967295 & length}`);
    }
    const type = this.readString(4);
    const chunk2 = this.read(length);
    const crc = this.readUInt32();
    debug4("decodeChunk type", type, "chunk size", length, "crc", crc.toString(16).toUpperCase());
    switch (type) {
      case "IHDR":
        this.decodeIHDR(chunk2);
        break;
      case "PLTE":
        this.decodePLTE(chunk2);
        break;
      case "IDAT":
        this.decodeIDAT(chunk2);
        break;
      case "IEND":
        this.decodeIEND(chunk2);
        break;
      case "tRNS":
        this.decodeTRNS(chunk2);
        break;
      case "pHYs":
        this.decodePHYS(chunk2);
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
        debug4(`Unsupported Chunk: '${type}'`);
        break;
    }
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
   * @param {Uint8Array} chunk - Data Blob
   * @see {@link http://www.w3.org/TR/2003/REC-PNG-20031110/#11IHDR|Image Header}
   * @see {@link http://www.libpng.org/pub/png/spec/1.2/png-1.2-pdg.html#C.IHDR|Image Header}
   */
  decodeIHDR(chunk2) {
    debug4("decodeIHDR");
    const header = new data_buffer_default(chunk2);
    const width = header.readUInt32();
    const height = header.readUInt32();
    const bit_depth = header.readUInt8();
    const color_type = header.readUInt8();
    const compression_method = header.readUInt8();
    const filter_method = header.readUInt8();
    const interlace_method = header.readUInt8();
    this.width = width;
    this.height = height;
    this.setBitDepth(bit_depth);
    this.setColorType(color_type);
    this.setCompressionMethod(compression_method);
    this.setFilterMethod(filter_method);
    this.setInterlaceMethod(interlace_method);
    debug4("decodeIHDR =", JSON.stringify({
      width,
      height,
      bit_depth,
      color_type,
      compression_method,
      filter_method,
      interlace_method
    }));
  }
  /**
   * Decode the PLTE (Palette) chunk.
   * The PLTE chunk contains from 1 to 256 palette entries, each a three-byte series of the form.
   * The number of entries is determined from the chunk length. A chunk length not divisible by 3 is an error.
   * @param {Uint8Array} chunk - Data Blob
   * @see {@link http://www.w3.org/TR/PNG/#11PLTE|Palette}
   */
  decodePLTE(chunk2) {
    debug4("decodePLTE");
    this.setPalette(chunk2);
  }
  /**
   * Decode the IDAT (Image Data) chunk.
   * The IDAT chunk contains the actual image data which is the output stream of the compression algorithm.
   * @param {Uint8Array} chunk - Data Blob
   * @see {@link http://www.w3.org/TR/2003/REC-PNG-20031110/#11IDAT|Image Data}
   */
  decodeIDAT(chunk2) {
    debug4("decodeIDAT:", chunk2.length, "bytes");
    this.dataChunks.push(chunk2);
  }
  /**
   * Decode the tRNS (Transparency) chunk.
   * The tRNS chunk specifies that the image uses simple transparency: either alpha values associated with palette entries (for indexed-color images) or a single transparent color (for grayscale and truecolor images). Although simple transparency is not as elegant as the full alpha channel, it requires less storage space and is sufficient for many common cases.
   * @param {Uint8Array} chunk - Data Blob
   * @see {@link https://www.w3.org/TR/PNG/#11tRNS|Transparency}
   */
  decodeTRNS(chunk2) {
    debug4("decodeTRNS");
    this.transparency = chunk2;
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
   * @param {Uint8Array} chunk - Data Blob
   * @see {@link https://www.w3.org/TR/PNG/#11pHYs|Pixel Dimensions}
   */
  decodePHYS(chunk2) {
    const INCH_TO_METERS = 0.0254;
    const buffer = new data_buffer_default(chunk2);
    let width = buffer.readUInt32();
    let height = buffer.readUInt32();
    const unit = buffer.readUInt8();
    if (unit === 1) {
      width = Math.floor(width * INCH_TO_METERS);
      height = Math.floor(height * INCH_TO_METERS);
    }
    this.physical = { width, height, unit };
  }
  /**
   * Decode the IEND (Image trailer) chunk.
   * The IEND chunk marks the end of the PNG DataBuffer. The chunk's data field is empty.
   * @param {Uint8Array} _chunk - Unused.
   * @see {@link http://www.w3.org/TR/2003/REC-PNG-20031110/#11IEND|Image Trailer}
   */
  decodeIEND(_chunk) {
    debug4("decodeIEND");
  }
  /**
   * Uncompress IDAT chunks.
   * @throws {Error} No IDAT chunks to decode
   * @throws {Error} Deinterlacing Error
   * @throws {Error} Inflating Error
   * @throws {Error} Adam7 interlaced format is unsupported
   */
  decodePixels() {
    debug4("decodePixels");
    if (this.dataChunks.length === 0) {
      throw new Error("No IDAT chunks to decode.");
    }
    const length = this.dataChunks.reduce((accumulator, chunk2) => accumulator + chunk2.length, 0);
    debug4("Data Chunks Total Size:", length);
    const data = new Uint8Array(length);
    let k = 0;
    for (const chunk2 of this.dataChunks) {
      for (const j of chunk2) {
        data[k++] = j;
      }
    }
    let out;
    try {
      out = inflate(data);
    } catch (err2) {
      debug4("Error Inflating:", err2);
      throw err2;
    }
    debug4("Inflated Size:", out.length);
    try {
      if (this.interlaceMethod === 0) {
        this.interlaceNone(out);
      } else {
        this.interlaceAdam7(out);
      }
    } catch (e) {
      debug4("Error Deinterlacing:", e);
      throw e;
    }
  }
  /**
   * Deinterlace with no interlacing.
   * @param {Buffer|Uint8Array} data Data to deinterlace.
   * @see {@link https://www.w3.org/TR/PNG-Filters.html|PNG Filters}
   */
  interlaceNone(data) {
    const bytes_per_pixel = Math.max(1, this.colors * this.bitDepth / 8);
    const color_bytes_per_row = bytes_per_pixel * this.width;
    this.pixels = new Uint8Array(bytes_per_pixel * this.width * this.height);
    const chunk2 = new data_buffer_default(data);
    debug4("interlaceNone: bytes:", chunk2.remainingBytes(), "bytes_per_pixel:", bytes_per_pixel, "color_bytes_per_row:", color_bytes_per_row);
    let offset = 0;
    while (chunk2.remainingBytes() > 0) {
      const type = chunk2.readUInt8();
      const scanline = chunk2.read(chunk2.remainingBytes() < color_bytes_per_row ? chunk2.remainingBytes() : color_bytes_per_row);
      switch (type) {
        case 0: {
          this.pixels = _ImagePNG.unFilterNone(this.pixels, scanline, bytes_per_pixel, offset, color_bytes_per_row);
          break;
        }
        case 1: {
          this.pixels = _ImagePNG.unFilterSub(this.pixels, scanline, bytes_per_pixel, offset, color_bytes_per_row);
          break;
        }
        case 2: {
          this.pixels = _ImagePNG.unFilterUp(this.pixels, scanline, bytes_per_pixel, offset, color_bytes_per_row);
          break;
        }
        case 3: {
          this.pixels = _ImagePNG.unFilterAverage(this.pixels, scanline, bytes_per_pixel, offset, color_bytes_per_row);
          break;
        }
        case 4: {
          this.pixels = _ImagePNG.unFilterPaeth(this.pixels, scanline, bytes_per_pixel, offset, color_bytes_per_row);
          break;
        }
        default: {
          debug4(`Unknown filtered scanline type: '${type}', at offset`, offset);
        }
      }
      offset += chunk2.offset;
    }
  }
  /**
   * Deinterlace with Adam7 interlacing.
   * Adam7 divides the image into 7 passes with different starting positions and step sizes.
   * @param {Buffer|Uint8Array} data Data to deinterlace.
   * @see {@link https://www.w3.org/TR/PNG/#8Interlace|PNG Adam7 Interlacing}
   * @see {@link https://github.com/em2046/lens/blob/master/assets/js/interlace.js}
   * @see {@link https://github.com/em2046/aperture/tree/master/lib/png/chunks}
   * @see {@link https://github.com/beejjorgensen/jsmandel/blob/master/src/js/adam7.js}
   * @see {@link http://diyhpl.us/~yenatch/pokecrystal/src/pypng/code/png.py}
   * @see {@link https://github.com/SixLabors/ImageSharp/blob/master/src/ImageSharp/Formats/Png/Adam7.cs}
   */
  interlaceAdam7(data) {
    const bytes_per_pixel = Math.max(1, this.colors * this.bitDepth / 8);
    const xoffset = [0, 4, 0, 2, 0, 1, 0];
    const yoffset = [0, 0, 4, 0, 2, 0, 1];
    const xstep = [8, 8, 4, 4, 2, 2, 1];
    const ystep = [8, 8, 8, 4, 4, 2, 2];
    this.pixels = new Uint8Array(bytes_per_pixel * this.width * this.height);
    const chunk2 = new data_buffer_default(data);
    debug4("interlaceAdam7: bytes:", chunk2.remainingBytes(), "bytes_per_pixel:", bytes_per_pixel);
    for (let pass = 0; pass < 7; pass++) {
      const pass_width = Math.ceil((this.width - xoffset[pass]) / xstep[pass]);
      const pass_height = Math.ceil((this.height - yoffset[pass]) / ystep[pass]);
      debug4(`Adam7 pass ${pass + 1}: width=${pass_width}, height=${pass_height}`);
      if (pass_width > 0 && pass_height > 0) {
        const color_bytes_per_row = bytes_per_pixel * pass_width;
        let pass_pixels = new Uint8Array(bytes_per_pixel * pass_width * pass_height);
        for (let row = 0; row < pass_height; row++) {
          if (chunk2.remainingBytes() === 0) {
            break;
          }
          const type = chunk2.readUInt8();
          const scanline = chunk2.read(chunk2.remainingBytes() < color_bytes_per_row ? chunk2.remainingBytes() : color_bytes_per_row);
          const offset = row * color_bytes_per_row;
          switch (type) {
            case 0: {
              pass_pixels = _ImagePNG.unFilterNone(pass_pixels, scanline, bytes_per_pixel, offset, color_bytes_per_row);
              break;
            }
            case 1: {
              pass_pixels = _ImagePNG.unFilterSub(pass_pixels, scanline, bytes_per_pixel, offset, color_bytes_per_row);
              break;
            }
            case 2: {
              pass_pixels = _ImagePNG.unFilterUp(pass_pixels, scanline, bytes_per_pixel, offset, color_bytes_per_row);
              break;
            }
            case 3: {
              pass_pixels = _ImagePNG.unFilterAverage(pass_pixels, scanline, bytes_per_pixel, offset, color_bytes_per_row);
              break;
            }
            case 4: {
              pass_pixels = _ImagePNG.unFilterPaeth(pass_pixels, scanline, bytes_per_pixel, offset, color_bytes_per_row);
              break;
            }
            default: {
              debug4(`Unknown filtered scanline type: '${type}', at pass ${pass + 1}, row ${row}`);
            }
          }
        }
        for (let row = 0; row < pass_height; row++) {
          const y = yoffset[pass] + row * ystep[pass];
          for (let col = 0; col < pass_width; col++) {
            const x = xoffset[pass] + col * xstep[pass];
            const pass_index = (row * pass_width + col) * bytes_per_pixel;
            const image_index = (y * this.width + x) * bytes_per_pixel;
            for (let b = 0; b < bytes_per_pixel; b++) {
              this.pixels[image_index + b] = pass_pixels[pass_index + b];
            }
          }
        }
      }
    }
  }
  // TODO Make these static so we can use them in Adam7 as well.
  // Unfiltering
  /**
   * No filtering, direct copy.
   * @param {number[]|Uint8Array} pixels Pixels to update.
   * @param {number[]|Uint8Array} scanline Scanline to search for pixels in.
   * @param {number} bpp Bytes Per Pixel
   * @param {number} offset Offset
   * @param {number} length Length
   * @returns {number[]|Uint8Array} Pixels
   */
  static unFilterNone(pixels, scanline, bpp, offset, length) {
    debug4("unFilterNone:", "bpp:", bpp, "offset:", offset, "length:", length);
    for (let i = 0, to = length; i < to; i++) {
      pixels[offset + i] = scanline[i];
    }
    return pixels;
  }
  /**
   * The Sub() filter transmits the difference between each byte and the value of the corresponding byte of the prior pixel.
   * Sub(x) = Raw(x) + Raw(x - bpp)
   * @param {number[]|Uint8Array} pixels Pixels to update.
   * @param {number[]|Uint8Array} scanline Scanline to search for pixels in.
   * @param {number} bpp - Bytes Per Pixel
   * @param {number} offset Offset
   * @param {number} length Length
   * @returns {number[]|Uint8Array} Pixels
   */
  static unFilterSub(pixels, scanline, bpp, offset, length) {
    debug4("unFilterSub:", "bpp:", bpp, "offset:", offset, "length:", length);
    let i = 0;
    for (; i < bpp; i++) {
      pixels[offset + i] = scanline[i];
    }
    for (; i < length; i++) {
      pixels[offset + i] = scanline[i] + pixels[offset + i - bpp] & 255;
    }
    return pixels;
  }
  /**
   * The Up() filter is just like the Sub() filter except that the pixel immediately above the current pixel, rather than just to its left, is used as the predictor.
   * Up(x) = Raw(x) + Prior(x)
   * @param {number[]|Uint8Array} pixels Pixels to update.
   * @param {number[]|Uint8Array} scanline - Scanline to search for pixels in.
   * @param {number} _bpp Bytes Per Pixel, Unused
   * @param {number} offset Offset
   * @param {number} length Length
   * @returns {number[]|Uint8Array} Pixels
   */
  static unFilterUp(pixels, scanline, _bpp, offset, length) {
    debug4("unFilterUp:", "offset:", offset, "length:", length);
    let i = 0;
    let byte;
    let prev;
    if (offset - length < 0) {
      for (; i < length; i++) {
        pixels[offset + i] = scanline[i];
      }
    } else {
      for (; i < length; i++) {
        byte = scanline[i];
        prev = pixels[offset + i - length];
        pixels[offset + i] = byte + prev & 255;
      }
    }
    return pixels;
  }
  /**
   * The Average() filter uses the average of the two neighboring pixels (left and above) to predict the value of a pixel.
   * Average(x) = Raw(x) + floor((Raw(x-bpp)+Prior(x))/2)
   * @param {number[]|Uint8Array} pixels Pixels to update.
   * @param {number[]|Uint8Array} scanline Scanline to search for pixels in.
   * @param {number} bpp Bytes Per Pixel
   * @param {number} offset Offset
   * @param {number} length Length
   * @returns {number[]|Uint8Array} Pixels
   */
  static unFilterAverage(pixels, scanline, bpp, offset, length) {
    debug4("unFilterAverage:", "bpp:", bpp, "offset:", offset, "length:", length);
    let i = 0;
    let byte;
    let prev;
    let prior;
    if (offset - length < 0) {
      for (; i < bpp; i++) {
        pixels[offset + i] = scanline[i];
      }
      for (; i < length; i++) {
        pixels[offset + i] = scanline[i] + (pixels[offset + i - bpp] >> 1) & 255;
      }
    } else {
      for (; i < bpp; i++) {
        pixels[offset + i] = scanline[i] + (pixels[offset - length + i] >> 1) & 255;
      }
      for (; i < length; i++) {
        byte = scanline[i];
        prev = pixels[offset + i - bpp];
        prior = pixels[offset + i - length];
        pixels[offset + i] = byte + (prev + prior >> 1) & 255;
      }
    }
    return pixels;
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
   * @param {number[]|Uint8Array} pixels Pixels to update.
   * @param {number[]|Uint8Array} scanline Scanline to search for pixels in.
   * @param {number} bpp Bytes Per Pixel
   * @param {number} offset Offset
   * @param {number} length Length
   * @returns {number[]|Uint8Array} Pixels
   */
  static unFilterPaeth(pixels, scanline, bpp, offset, length) {
    debug4("unFilterPaeth:", "bpp:", bpp, "offset:", offset, "length:", length);
    let i = 0;
    let raw;
    let a = 0;
    let b = 0;
    let c = 0;
    let p;
    let pa = 0;
    let pb = 0;
    let pc = 0;
    let pr = 0;
    if (offset - length < 0) {
      for (; i < bpp; i++) {
        pixels[offset + i] = scanline[i];
      }
      for (; i < length; i++) {
        pixels[offset + i] = scanline[i] + pixels[offset + i - bpp] & 255;
      }
    } else {
      for (; i < bpp; i++) {
        pixels[offset + i] = scanline[i] + pixels[offset + i - length] & 255;
      }
      for (; i < length; i++) {
        raw = scanline[i];
        a = pixels[offset + i - bpp];
        b = pixels[offset + i - length];
        c = pixels[offset + i - length - bpp];
        p = a + b - c;
        pa = Math.abs(p - a);
        pb = Math.abs(p - b);
        pc = Math.abs(p - c);
        if (pa <= pb && pa <= pc) pr = a;
        else if (pb <= pc) pr = b;
        else pr = c;
        pixels[offset + i] = raw + pr & 255;
      }
    }
    return pixels;
  }
};
var data_image_png_default = ImagePNG;

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
var MAX_BL_BITS = 7;
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
var bi_flush = (s) => {
  if (s.bi_valid === 16) {
    put_short2(s, s.bi_buf);
    s.bi_buf = 0;
    s.bi_valid = 0;
  } else if (s.bi_valid >= 8) {
    s.pending_buf[s.pending++] = s.bi_buf & 255;
    s.bi_buf >>= 8;
    s.bi_valid -= 8;
  }
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
var tr_static_init = () => {
  let n;
  let bits;
  let length;
  let code;
  let dist;
  const bl_count = new Array(16);
  length = 0;
  for (code = 0; code < LENGTH_CODES2 - 1; code++) {
    base_length2[code] = length;
    for (n = 0; n < 1 << extra_lbits2[code]; n++) _length_code2[length++] = code;
  }
  _length_code2[length - 1] = code;
  dist = 0;
  for (code = 0; code < 16; code++) {
    base_dist2[code] = dist;
    for (n = 0; n < 1 << extra_dbits2[code]; n++) _dist_code2[dist++] = code;
  }
  dist >>= 7;
  for (; code < D_CODES2; code++) {
    base_dist2[code] = dist << 7;
    for (n = 0; n < 1 << extra_dbits2[code] - 7; n++) _dist_code2[256 + dist++] = code;
  }
  for (bits = 0; bits <= MAX_BITS2; bits++) bl_count[bits] = 0;
  n = 0;
  while (n <= 143) {
    static_ltree2[n * 2 + 1] = 8;
    n++;
    bl_count[8]++;
  }
  while (n <= 255) {
    static_ltree2[n * 2 + 1] = 9;
    n++;
    bl_count[9]++;
  }
  while (n <= 279) {
    static_ltree2[n * 2 + 1] = 7;
    n++;
    bl_count[7]++;
  }
  while (n <= 287) {
    static_ltree2[n * 2 + 1] = 8;
    n++;
    bl_count[8]++;
  }
  gen_codes2(static_ltree2, 287, bl_count);
  for (n = 0; n < D_CODES2; n++) {
    static_dtree2[n * 2 + 1] = 5;
    static_dtree2[n * 2] = bi_reverse2(n, 5);
  }
  static_l_desc = new StaticTreeDesc(static_ltree2, extra_lbits2, 257, L_CODES2, MAX_BITS2);
  static_d_desc = new StaticTreeDesc(static_dtree2, extra_dbits2, 0, D_CODES2, MAX_BITS2);
  static_bl_desc = new StaticTreeDesc(new Array(0), extra_blbits2, 0, BL_CODES2, MAX_BL_BITS);
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
  init_block2(s);
};
var _tr_stored_block2 = (s, buf, stored_len, last) => {
  send_bits2(s, (STORED_BLOCK2 << 1) + (last ? 1 : 0), 3);
  bi_windup2(s);
  put_short2(s, stored_len);
  put_short2(s, ~stored_len);
  if (stored_len) s.pending_buf.set(s.window.subarray(buf, buf + stored_len), s.pending);
  s.pending += stored_len;
};
var _tr_align = (s) => {
  send_bits2(s, STATIC_TREES2 << 1, 3);
  send_code2(s, END_BLOCK2, static_ltree2);
  bi_flush(s);
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
var MAX_MEM_LEVEL = 9;
var HEAP_SIZE = 573;
var MIN_MATCH2 = 3;
var MAX_MATCH2 = 258;
var MIN_LOOKAHEAD2 = 262;
var PRESET_DICT = 32;
var INIT_STATE = 42;
var GZIP_STATE = 57;
var EXTRA_STATE = 69;
var NAME_STATE = 73;
var COMMENT_STATE = 91;
var HCRC_STATE = 103;
var BUSY_STATE = 113;
var FINISH_STATE = 666;
var BS_NEED_MORE2 = 1;
var BS_BLOCK_DONE2 = 2;
var BS_FINISH_STARTED2 = 3;
var BS_FINISH_DONE2 = 4;
var OS_CODE = 3;
var err = (strm, errorCode) => {
  strm.msg = messages_default2[errorCode];
  return errorCode;
};
var rank = (f) => {
  return f * 2 - (f > 4 ? 9 : 0);
};
var zero = (buf) => {
  let len = buf.length;
  while (--len >= 0) buf[len] = 0;
};
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
var put_byte = (s, b) => {
  s.pending_buf[s.pending++] = b;
};
var putShortMSB = (s, b) => {
  s.pending_buf[s.pending++] = b >>> 8 & 255;
  s.pending_buf[s.pending++] = b & 255;
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
var deflate_rle = (s, flush) => {
  let bflush;
  let prev;
  let scan, strend;
  const _win = s.window;
  for (; ; ) {
    if (s.lookahead <= MAX_MATCH2) {
      fill_window2(s);
      if (s.lookahead <= MAX_MATCH2 && flush === 0) return BS_NEED_MORE2;
      if (s.lookahead === 0) break;
    }
    s.match_length = 0;
    if (s.lookahead >= MIN_MATCH2 && s.strstart > 0) {
      scan = s.strstart - 1;
      prev = _win[scan];
      if (prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan]) {
        strend = s.strstart + MAX_MATCH2;
        do
          ;
        while (prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && scan < strend);
        s.match_length = MAX_MATCH2 - (strend - scan);
        if (s.match_length > s.lookahead) s.match_length = s.lookahead;
      }
    }
    if (s.match_length >= MIN_MATCH2) {
      bflush = _tr_tally2(s, 1, s.match_length - MIN_MATCH2);
      s.lookahead -= s.match_length;
      s.strstart += s.match_length;
      s.match_length = 0;
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
  s.insert = 0;
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
var deflate_huff = (s, flush) => {
  let bflush;
  for (; ; ) {
    if (s.lookahead === 0) {
      fill_window2(s);
      if (s.lookahead === 0) {
        if (flush === 0) return BS_NEED_MORE2;
        break;
      }
    }
    s.match_length = 0;
    bflush = _tr_tally2(s, 0, s.window[s.strstart]);
    s.lookahead--;
    s.strstart++;
    if (bflush) {
      flush_block_only2(s, false);
      if (s.strm.avail_out === 0) return BS_NEED_MORE2;
    }
  }
  s.insert = 0;
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
var lm_init = (s) => {
  s.window_size = 2 * s.w_size;
  zero(s.head);
  s.max_lazy_match = configuration_table2[s.level].max_lazy;
  s.good_match = configuration_table2[s.level].good_length;
  s.nice_match = configuration_table2[s.level].nice_length;
  s.max_chain_length = configuration_table2[s.level].max_chain;
  s.strstart = 0;
  s.block_start = 0;
  s.lookahead = 0;
  s.insert = 0;
  s.match_length = s.prev_length = MIN_MATCH2 - 1;
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
  s.hash_shift = ~~((s.hash_bits + MIN_MATCH2 - 1) / MIN_MATCH2);
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
    flush_pending2(strm);
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
    flush_pending2(strm);
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
      flush_pending2(strm);
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
      if (s.gzhead.hcrc) strm.adler = crc322(strm.adler, s.pending_buf, s.pending, 0);
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
        if (s.gzhead.hcrc && s.pending > beg) strm.adler = crc322(strm.adler, s.pending_buf, s.pending - beg, beg);
        s.gzindex += copy;
        flush_pending2(strm);
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
      if (s.gzhead.hcrc && s.pending > beg) strm.adler = crc322(strm.adler, s.pending_buf, s.pending - beg, beg);
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
          if (s.gzhead.hcrc && s.pending > beg) strm.adler = crc322(strm.adler, s.pending_buf, s.pending - beg, beg);
          flush_pending2(strm);
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
      if (s.gzhead.hcrc && s.pending > beg) strm.adler = crc322(strm.adler, s.pending_buf, s.pending - beg, beg);
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
          if (s.gzhead.hcrc && s.pending > beg) strm.adler = crc322(strm.adler, s.pending_buf, s.pending - beg, beg);
          flush_pending2(strm);
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
      if (s.gzhead.hcrc && s.pending > beg) strm.adler = crc322(strm.adler, s.pending_buf, s.pending - beg, beg);
    }
    s.status = HCRC_STATE;
  }
  if (s.status === HCRC_STATE) {
    if (s.gzhead.hcrc) {
      if (s.pending + 2 > s.pending_buf_size) {
        flush_pending2(strm);
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
    flush_pending2(strm);
    if (s.pending !== 0) {
      s.last_flush = -1;
      return 0;
    }
  }
  if (strm.avail_in !== 0 || s.lookahead !== 0 || flush !== 0 && s.status !== FINISH_STATE) {
    let bstate = s.level === 0 ? deflate_stored2(s, flush) : s.strategy === 2 ? deflate_huff(s, flush) : s.strategy === 3 ? deflate_rle(s, flush) : configuration_table2[s.level].func(s, flush);
    if (bstate === BS_FINISH_STARTED2 || bstate === BS_FINISH_DONE2) s.status = FINISH_STATE;
    if (bstate === BS_NEED_MORE2 || bstate === BS_FINISH_STARTED2) {
      if (strm.avail_out === 0) s.last_flush = -1;
      return 0;
    }
    if (bstate === BS_BLOCK_DONE2) {
      if (flush === 1) _tr_align(s);
      else if (flush !== 5) {
        _tr_stored_block2(s, 0, 0, false);
        if (flush === 3) {
          zero(s.head);
          if (s.lookahead === 0) {
            s.strstart = 0;
            s.block_start = 0;
            s.insert = 0;
          }
        }
      }
      flush_pending2(strm);
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
  flush_pending2(strm);
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
  if (wrap === 1) strm.adler = adler322(strm.adler, dictionary, dictLength, 0);
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
  fill_window2(s);
  while (s.lookahead >= MIN_MATCH2) {
    let str = s.strstart;
    let n = s.lookahead - (MIN_MATCH2 - 1);
    do {
      INSERT_STRING2(s, str);
      str++;
    } while (--n);
    s.strstart = str;
    s.lookahead = MIN_MATCH2 - 1;
    fill_window2(s);
  }
  s.strstart += s.lookahead;
  s.block_start = s.strstart;
  s.insert = s.lookahead;
  s.lookahead = 0;
  s.match_length = s.prev_length = MIN_MATCH2 - 1;
  s.match_available = 0;
  strm.next_in = next;
  strm.input = input;
  strm.avail_in = avail;
  s.wrap = wrap;
  return 0;
};
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
  if (inflateStateCheck2(strm) || !strm.output || !strm.input && strm.avail_in !== 0) return -2;
  state = strm.state;
  if (state.mode === TYPE2) state.mode = TYPEDO2;
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
    case HEAD2:
      if (state.wrap === 0) {
        state.mode = TYPEDO2;
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
        hold += input[next++] << bits;
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
        hold += input[next++] << bits;
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
          hold += input[next++] << bits;
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
            state.head.extra.set(input.subarray(next, next + copy), len);
          }
          if (state.flags & 512 && state.wrap & 4) state.check = crc322(state.check, input, copy, next);
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
          len = input[next + copy++];
          if (state.head && len && state.length < 65536) state.head.name += String.fromCharCode(len);
        } while (len && copy < have);
        if (state.flags & 512 && state.wrap & 4) state.check = crc322(state.check, input, copy, next);
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
          len = input[next + copy++];
          if (state.head && len && state.length < 65536) state.head.comment += String.fromCharCode(len);
        } while (len && copy < have);
        if (state.flags & 512 && state.wrap & 4) state.check = crc322(state.check, input, copy, next);
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
          hold += input[next++] << bits;
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
        hold += input[next++] << bits;
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
        hold += input[next++] << bits;
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
        hold += input[next++] << bits;
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
        output.set(input.subarray(next, next + copy), put);
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
        input = strm.input;
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
          hold += input[next++] << bits;
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
          hold |= input[next++] << bits;
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
          hold += input[next++] << bits;
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
    this.strm = new ZStream2();
    this.strm.avail_out = 0;
    let status = deflateInit2(this.strm, opt.level, 8, opt.windowBits, opt.memLevel, opt.strategy, opt.legacyHash);
    if (status !== 0) throw new Error(messages_default2[status]);
    if (toString$1.call(opt.dictionary) === "[object ArrayBuffer]") opt.dictionary = new Uint8Array(opt.dictionary);
    const dictionary = opt.dictionary;
    if (dictionary.length) {
      if (opt.gzip) throw new Error("dictionary is not supported with gzip");
      status = deflateSetDictionary(this.strm, dictionary);
      if (status !== 0) throw new Error(messages_default2[status]);
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
    this.msg = strm.msg || messages_default2[status];
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
    if (status === 0) this.result = flattenChunks2(this.chunks);
    this.chunks = [];
  }
};
function deflate(input, options = {}) {
  const deflator = new Deflate(options);
  deflator.push(input, true);
  if (deflator.err) throw new Error(deflator.msg);
  return deflator.result;
}
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

// packages/assets/src/png.ts
var PNG_SIGNATURE = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10);
var MAX_INPUT_BYTES = 16 * 1024 * 1024;
var MAX_PIXELS = 1024 * 1024;
var PASS_STEPS = [
  [0, 0, 8, 8],
  [4, 0, 8, 8],
  [0, 4, 4, 8],
  [2, 0, 4, 4],
  [0, 2, 2, 4],
  [1, 0, 2, 2],
  [0, 1, 1, 2]
];
var u32be = (bytes, offset) => bytes[offset] * 16777216 + (bytes[offset + 1] << 16) + (bytes[offset + 2] << 8) + bytes[offset + 3] >>> 0;
var passLength = (size, start, step) => size <= start ? 0 : Math.ceil((size - start) / step);
function validatePng(bytes) {
  if (bytes.length < 8 || bytes.length > MAX_INPUT_BYTES || !PNG_SIGNATURE.every((byte, index) => bytes[index] === byte)) {
    throw new Error("Invalid PNG signature or input size.");
  }
  let offset = 8;
  let header;
  let paletteSeen = false;
  let transparencySeen = false;
  let dataSeen = false;
  let dataEnded = false;
  let endSeen = false;
  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) {
      throw new Error("Truncated PNG chunk header.");
    }
    const length = u32be(bytes, offset);
    const end = offset + 12 + length;
    if (!Number.isSafeInteger(end) || end > bytes.length) {
      throw new Error("Truncated PNG chunk payload.");
    }
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    const expectedCrc = u32be(bytes, end - 4);
    const actualCrc = Number.parseInt(data_hash_crc32_default.of(bytes.subarray(offset + 4, end - 4)), 16);
    if (expectedCrc !== actualCrc) {
      throw new Error(`PNG ${type} CRC mismatch.`);
    }
    if (!header && type !== "IHDR") {
      throw new Error("PNG IHDR must be first.");
    }
    if (type === "IHDR") {
      if (header || length !== 13) {
        throw new Error("PNG requires one 13-byte IHDR.");
      }
      const width = u32be(bytes, offset + 8);
      const height = u32be(bytes, offset + 12);
      const depth = bytes[offset + 16];
      const colorType = bytes[offset + 17];
      const interlace = bytes[offset + 20];
      if (width === 0 || height === 0 || width * height > MAX_PIXELS) {
        throw new RangeError(`PNG dimensions ${width}\xD7${height} exceed the pixel limit.`);
      }
      if (bytes[offset + 18] !== 0 || bytes[offset + 19] !== 0 || interlace > 1) {
        throw new Error("Unsupported PNG compression, filter, or interlace method.");
      }
      const indexed = colorType === 3 && [1, 2, 4, 8].includes(depth);
      const gray = colorType === 0 && [1, 2, 4, 8].includes(depth);
      const byteChannels = [2, 4, 6].includes(colorType) && depth === 8;
      if (!indexed && !gray && !byteChannels) {
        throw new Error(
          `Unsupported PNG color type ${colorType} at ${depth} bits; 16-bit samples are not supported.`
        );
      }
      header = { width, height, depth, colorType, interlace };
    } else if (type === "PLTE") {
      if (paletteSeen || dataSeen || length === 0 || length % 3 !== 0 || length > 768) {
        throw new Error("Invalid PNG PLTE chunk.");
      }
      paletteSeen = true;
    } else if (type === "tRNS") {
      if (transparencySeen || dataSeen || header?.colorType === 3 && (!paletteSeen || length === 0) || header?.colorType === 0 && length !== 2 || header?.colorType === 2 && length !== 6 || header?.colorType !== 0 && header?.colorType !== 2 && header?.colorType !== 3) {
        throw new Error("Invalid PNG tRNS chunk.");
      }
      transparencySeen = true;
    } else if (type === "IDAT") {
      if (dataEnded || header?.colorType === 3 && !paletteSeen) {
        throw new Error("PNG IDAT chunks must be contiguous and follow PLTE.");
      }
      dataSeen = true;
    } else if (type === "IEND") {
      if (!dataSeen || length !== 0 || end !== bytes.length) {
        throw new Error("Invalid PNG IEND chunk.");
      }
      endSeen = true;
      break;
    } else if ((bytes[offset + 4] & 32) === 0) {
      throw new Error(`Unsupported critical PNG chunk '${type}'.`);
    }
    if (dataSeen && type !== "IDAT") {
      dataEnded = true;
    }
    offset = end;
  }
  if (!header || !endSeen) {
    throw new Error("PNG is missing IHDR or IEND.");
  }
  return header;
}
var paeth = (a, b, c) => {
  const target = a + b - c;
  const da = Math.abs(target - a);
  const db = Math.abs(target - b);
  const dc = Math.abs(target - c);
  if (da <= db && da <= dc) {
    return a;
  }
  if (db <= dc) {
    return b;
  }
  return c;
};
var channelsFor = (colorType) => {
  if (colorType === 2) {
    return 3;
  }
  if (colorType === 4) {
    return 2;
  }
  if (colorType === 6) {
    return 4;
  }
  return 1;
};
function decodeSamples(image, header) {
  const channels = channelsFor(header.colorType);
  const bitsPerPixel = channels * header.depth;
  const passes = header.interlace === 1 ? PASS_STEPS : [[0, 0, 1, 1]];
  let expected = 0;
  for (const [sx, sy, dx, dy] of passes) {
    const width = passLength(header.width, sx, dx);
    const height = passLength(header.height, sy, dy);
    if (width > 0 && height > 0) {
      expected += height * (1 + Math.ceil(width * bitsPerPixel / 8));
    }
  }
  const inflator = new Inflate2({ windowBits: 15, chunkSize: 16 * 1024 });
  const inflated = new Uint8Array(expected);
  let written = 0;
  inflator.onData = (chunk2) => {
    if (written + chunk2.length > expected) {
      throw new Error("PNG inflated data exceeds declared dimensions.");
    }
    inflated.set(chunk2, written);
    written += chunk2.length;
  };
  const compressedLength = image.dataChunks.reduce((size, chunk2) => size + chunk2.length, 0);
  const compressed = new Uint8Array(compressedLength);
  let compressedOffset = 0;
  for (const chunk2 of image.dataChunks) {
    compressed.set(chunk2, compressedOffset);
    compressedOffset += chunk2.length;
  }
  if (!inflator.push(compressed, true) || inflator.err || written !== expected) {
    throw new Error(`Invalid PNG image data: ${inflator.msg || "scanline length mismatch"}.`);
  }
  const samples = new Uint8Array(header.width * header.height * channels);
  let cursor = 0;
  const filterStride = Math.max(1, Math.ceil(bitsPerPixel / 8));
  for (const [sx, sy, dx, dy] of passes) {
    const width = passLength(header.width, sx, dx);
    const height = passLength(header.height, sy, dy);
    if (width === 0 || height === 0) {
      continue;
    }
    const rowBytes = Math.ceil(width * bitsPerPixel / 8);
    let previous = new Uint8Array(rowBytes);
    for (let row = 0; row < height; row++) {
      const filter = inflated[cursor++];
      if (filter > 4) {
        throw new Error(`Invalid PNG scanline filter ${filter}.`);
      }
      const current = inflated.slice(cursor, cursor + rowBytes);
      cursor += rowBytes;
      for (let index = 0; index < rowBytes; index++) {
        const left = index >= filterStride ? current[index - filterStride] : 0;
        const above = previous[index];
        const upperLeft = index >= filterStride ? previous[index - filterStride] : 0;
        let predictor = 0;
        if (filter === 1) {
          predictor = left;
        }
        if (filter === 2) {
          predictor = above;
        }
        if (filter === 3) {
          predictor = Math.floor((left + above) / 2);
        }
        if (filter === 4) {
          predictor = paeth(left, above, upperLeft);
        }
        current[index] = current[index] + predictor & 255;
      }
      for (let x = 0; x < width; x++) {
        const destination = ((sy + row * dy) * header.width + sx + x * dx) * channels;
        if (header.depth === 8) {
          samples.set(current.subarray(x * channels, (x + 1) * channels), destination);
        } else {
          const bit = x * header.depth;
          const mask = (1 << header.depth) - 1;
          samples[destination] = current[bit >> 3] >> 8 - header.depth - (bit & 7) & mask;
        }
      }
      previous = current;
    }
  }
  return samples;
}
var pngImporter = Object.freeze({
  id: "uttori.import.png",
  version: "1.0.0",
  mediaTypes: ["image/png"],
  import: (input) => {
    const header = validatePng(input.bytes);
    const image = data_image_png_default.fromFile(input.bytes);
    const samples = decodeSamples(image, header);
    if (header.colorType === 0 && image.transparency.length === 2) {
      const transparent = image.transparency[0] << 8 | image.transparency[1];
      if (transparent >= 2 ** header.depth) {
        throw new Error("PNG grayscale tRNS sample exceeds bit depth.");
      }
    }
    if (header.colorType === 2 && image.transparency.length === 6 && (image.transparency[0] !== 0 || image.transparency[2] !== 0 || image.transparency[4] !== 0)) {
      throw new Error("PNG RGB8 tRNS sample exceeds bit depth.");
    }
    if (header.colorType === 3) {
      const paletteBytes = image.palette;
      const count = paletteBytes.length / 3;
      if (!Number.isInteger(count) || count === 0 || count > 2 ** header.depth || image.transparency.length > count) {
        throw new Error("PNG palette size or transparency length is invalid.");
      }
      const palette = Array.from(
        { length: count },
        (_, index) => [
          paletteBytes[index * 3],
          paletteBytes[index * 3 + 1],
          paletteBytes[index * 3 + 2],
          image.transparency[index] ?? 255
        ]
      );
      for (const index of samples) {
        if (index >= count) {
          throw new Error(`PNG palette index ${index} is out of range.`);
        }
      }
      const value2 = {
        kind: "indexed-image",
        width: header.width,
        height: header.height,
        indexes: samples,
        palette,
        sourceBitDepth: header.depth
      };
      return { kind: value2.kind, value: value2 };
    }
    const rgba = new Uint8Array(header.width * header.height * 4);
    const maxGray = 2 ** header.depth - 1;
    const transparentGray = image.transparency.length === 2 ? image.transparency[0] << 8 | image.transparency[1] : void 0;
    const transparentRgb = image.transparency.length === 6 ? [image.transparency[1], image.transparency[3], image.transparency[5]] : void 0;
    for (let pixel = 0; pixel < header.width * header.height; pixel++) {
      const source = pixel * channelsFor(header.colorType);
      const output = pixel * 4;
      if (header.colorType === 0 || header.colorType === 4) {
        const gray = Math.round(samples[source] * 255 / maxGray);
        rgba[output] = gray;
        rgba[output + 1] = gray;
        rgba[output + 2] = gray;
        let alpha = 255;
        if (header.colorType === 4) {
          alpha = samples[source + 1];
        } else if (samples[source] === transparentGray) {
          alpha = 0;
        }
        rgba[output + 3] = alpha;
      } else {
        rgba.set(samples.subarray(source, source + 3), output);
        const isTransparent = transparentRgb?.every(
          (channel, index) => channel === samples[source + index]
        );
        let alpha = 255;
        if (header.colorType === 6) {
          alpha = samples[source + 3];
        } else if (isTransparent) {
          alpha = 0;
        }
        rgba[output + 3] = alpha;
      }
    }
    const value = {
      kind: "rgba-image",
      width: header.width,
      height: header.height,
      rgba
    };
    return { kind: value.kind, value };
  }
});

// packages/assets/src/indexed-edit.ts
function validateIndexedPixels(image) {
  integer(image.width, "Indexed width", 1, 1 << 20);
  integer(image.height, "Indexed height", 1, 1 << 20);
  if (image.width * image.height > 1 << 20 || !(image.indexes instanceof Uint8Array) || image.indexes.length !== image.width * image.height) {
    throw new RangeError("Indexed pixels are missing or exceed the one-megapixel limit.");
  }
}
function validateBounds(bounds) {
  integer(bounds.x, "Rectangle x", -(1 << 20), 1 << 20);
  integer(bounds.y, "Rectangle y", -(1 << 20), 1 << 20);
  integer(bounds.width, "Rectangle width", 1, 1 << 20);
  integer(bounds.height, "Rectangle height", 1, 1 << 20);
  if (bounds.width * bounds.height > 1 << 20) {
    throw new RangeError("Rectangle exceeds pixel limit.");
  }
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
  const value = map[index];
  if (value === void 0 || value === null) {
    throw new RangeError(`Unmapped palette index ${index}.`);
  }
  return integer(value, "Mapped palette index", 0, 255);
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
var isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
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
  if (!isRecord(raw)) {
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
  if (!isRecord(map) || Object.keys(map).some(
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
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.colors) || value.colors.length === 0 || value.colors.length > 256) {
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
function tileCoordinates(width, height, layout) {
  const result = [];
  if (layout.tileOrder === "row-major") {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        result.push([x, y]);
      }
    }
  } else if (layout.tileOrder === "column-major") {
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
    if (layout.blockRows === "bottom-to-top") {
      blockY.reverse();
    }
    if (layout.blockOrder === "row-major") {
      for (const by of blockY) {
        for (let bx = 0; bx < width / 2; bx++) {
          for (const quadrant of layout.withinBlock) {
            result.push([bx * 2 + quadrant % 2, by * 2 + Math.floor(quadrant / 2)]);
          }
        }
      }
    } else {
      for (let bx = 0; bx < width / 2; bx++) {
        for (const by of blockY) {
          for (const quadrant of layout.withinBlock) {
            result.push([bx * 2 + quadrant % 2, by * 2 + Math.floor(quadrant / 2)]);
          }
        }
      }
    }
  }
  return result;
}
function mapOrder(width, height, layout) {
  if (layout === "row-major") {
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
  if (document2.kind !== "indexed-image" && document2.kind !== "rgba-image" || !isRecord(document2.value)) {
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

// packages/assets/src/preview.ts
var signature = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10);
var be32 = (value) => Uint8Array.of(value >>> 24, value >>> 16, value >>> 8, value);
var concat = (parts) => {
  const result = new Uint8Array(parts.reduce((size, part) => size + part.length, 0));
  let cursor = 0;
  for (const part of parts) {
    result.set(part, cursor);
    cursor += part.length;
  }
  return result;
};
var chunk = (name, payload) => {
  const body = concat([Uint8Array.from(name, (character) => character.charCodeAt(0)), payload]);
  const crc = Number.parseInt(data_hash_crc32_default.of(body), 16);
  return concat([be32(payload.length), body, be32(crc)]);
};
function rgbaPreviewPng(rgba, width, height, maxEdge = 256) {
  integer(width, "Preview width", 1, 4096);
  integer(height, "Preview height", 1, 4096);
  integer(maxEdge, "Preview edge", 1, 1024);
  if (width * height > 2048 * 2048 || rgba.length !== width * height * 4) {
    throw new Error("Preview pixels are missing or exceed the four-megapixel limit.");
  }
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  const outputWidth = Math.max(1, Math.floor(width * scale));
  const outputHeight = Math.max(1, Math.floor(height * scale));
  const scanlines = new Uint8Array(outputHeight * (1 + outputWidth * 4));
  for (let y = 0; y < outputHeight; y++) {
    for (let x = 0; x < outputWidth; x++) {
      const sourceX = Math.min(width - 1, Math.floor(x / scale));
      const sourceY = Math.min(height - 1, Math.floor(y / scale));
      const input = (sourceY * width + sourceX) * 4;
      scanlines.set(rgba.subarray(input, input + 4), y * (1 + outputWidth * 4) + 1 + x * 4);
    }
  }
  const header = concat([be32(outputWidth), be32(outputHeight), Uint8Array.of(8, 6, 0, 0, 0)]);
  const compressed = deflate(scanlines);
  return concat([
    signature,
    chunk("IHDR", header),
    chunk("IDAT", compressed),
    chunk("IEND", new Uint8Array())
  ]);
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

// packages/assets/plugins/secret-of-mana/som-lz.mjs
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
function compressSomLz(source, options = {}) {
  assert(source instanceof Uint8Array, "Expected byte input.");
  assert(source.length <= LZ_MAX_OUTPUT_BYTES, "LZ decoded size exceeds 16-bit header.");
  assert(options && typeof options === "object" && !Array.isArray(options), "Invalid LZ options.");
  assert(
    Object.keys(options).every((key) => ["mode", "unusedHeaderByte"].includes(key)),
    "Unknown LZ option."
  );
  const mode = options.mode ?? "auto";
  const unusedHeaderByte = options.unusedHeaderByte ?? 0;
  assert(
    mode === "auto" || Number.isInteger(mode) && mode >= 0 && mode < DISTANCE_MASKS.length,
    "Invalid LZ mode."
  );
  assert(
    Number.isInteger(unusedHeaderByte) && unusedHeaderByte >= 0 && unusedHeaderByte <= 255,
    "Invalid unused LZ header byte."
  );
  const modes = mode === "auto" ? DISTANCE_MASKS.map((_, index) => index) : [mode];
  let best;
  for (const selectedMode of modes) {
    const encoded = encodeMode(source, selectedMode, unusedHeaderByte);
    if (!best || encoded.length < best.length) best = encoded;
  }
  return best;
}
function encodeMode(source, mode, unusedHeaderByte) {
  const mask = DISTANCE_MASKS[mode];
  const maxDistance = (mask + 1) * LZ_DISTANCE_LOW_VALUES;
  const maxLength = Math.floor(LZ_TOKEN_PAYLOAD_MASK / (mask + 1)) + LZ_MIN_COPY_BYTES;
  const seen = /* @__PURE__ */ new Map();
  const matches = Array.from({ length: source.length }, () => new Uint16Array(maxLength + 1));
  const add = (position) => {
    if (position + 2 >= source.length) return;
    const key = source[position] << 16 | source[position + 1] << 8 | source[position + 2];
    const positions = seen.get(key) ?? [];
    positions.push(position);
    while (positions.length > MATCH_CANDIDATE_LIMIT || positions.length && position - positions[0] >= maxDistance)
      positions.shift();
    seen.set(key, positions);
  };
  for (let cursor = 0; cursor < source.length; cursor++) {
    if (cursor + 2 < source.length) {
      const key = source[cursor] << 16 | source[cursor + 1] << 8 | source[cursor + 2];
      const positions = seen.get(key) ?? [];
      for (let index = positions.length - 1; index >= 0; index--) {
        const candidateDistance = cursor - positions[index];
        if (candidateDistance > maxDistance) break;
        let candidateLength = LZ_MIN_COPY_BYTES;
        while (candidateLength < maxLength && cursor + candidateLength < source.length && source[cursor + candidateLength] === source[cursor + candidateLength - candidateDistance])
          candidateLength++;
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
      if (!matchDistance) continue;
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

// packages/assets/plugins/secret-of-mana/som-boss-graphics.mjs
function expandBossGraphics(source, size) {
  if (!(source instanceof Uint8Array) || !Number.isInteger(size) || size <= 0 || size > 65535) {
    throw new Error("Boss graphics need bytes and a positive 16-bit output size.");
  }
  const length = Math.ceil(size / 8) * 8;
  const data = new Uint8Array(length);
  let cursor = 0;
  for (let output = 0; output < length; ) {
    if (cursor >= source.length) throw new Error("Truncated boss graphics mask.");
    const mask = source[cursor++];
    for (let bit = 7; bit >= 0; bit--, output++) {
      if (mask & 1 << bit) {
        if (cursor >= source.length) throw new Error("Truncated boss graphics literal.");
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
      if (index < 2 || data[index] !== data[index - 2]) {
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

// packages/assets/plugins/secret-of-mana/som-body-frame.mjs
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
  const signed7 = (byte) => (byte & 63) - (byte & 64);
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

// packages/assets/plugins/secret-of-mana/som-frame-composition.mjs
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
function deriveFramePlacements(layout, frame) {
  if (!Array.isArray(frame.blocks) || !frame.blocks.length) {
    throw new Error(`Missing native blocks: ${frame.id}.`);
  }
  const external = /* @__PURE__ */ new Map();
  for (const p of frame.placements ?? []) {
    if (!p.external) {
      continue;
    }
    const e = p.external;
    if (!/^[0-9A-F]{6}$/.test(e.romAddress) || !Array.isArray(e.indexes) || e.indexes.length !== 64 || e.indexes.some((v) => v !== 0)) {
      throw new Error(`Invalid external blank reference: ${frame.id}.`);
    }
    external.set(e.romAddress, e);
  }
  const resolve = (ref) => {
    if (Array.isArray(ref)) {
      if (ref.length !== 2 || typeof ref[0] !== "string" || !Number.isSafeInteger(ref[1]) || ref[1] < 0 || ref[1] >= (layout.segments[ref[0]]?.tiles.length ?? 0)) {
        throw new Error(`Invalid expanded graphics reference: ${frame.id}.`);
      }
      return { segment: ref[0], tile: ref[1] };
    }
    if (!Number.isSafeInteger(ref) || ref < 0 || ref > 16777215) {
      throw new Error(`Invalid ROM tile reference: ${frame.id}.`);
    }
    const matches = Object.entries(layout.segments).flatMap(([segment, value]) => {
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
    }).map((p, index) => ({
      id: `${block.id}:tile-${index}`,
      block: block.id,
      quadrant: index,
      x: p.x,
      y: p.y,
      flipX: p.flipX,
      flipY: p.flipY,
      ...references[index]
    }));
  });
}
function validateNativeFrame(frame) {
  const native = frame.nativeFrame;
  if (!native || Object.keys(native).length === 0) {
    return;
  }
  if (!Number.isSafeInteger(native.address) || native.address < 0 || native.address > 16777215 || !Number.isSafeInteger(native.end) || native.end - native.address !== native.bytes?.length) {
    throw new Error(`Invalid native frame extent: ${frame.id}.`);
  }
  const decoded = decodeBodyFrame(native.bytes);
  if (decoded.groups !== frame.blocks.length) {
    throw new Error(`Native block count differs: ${frame.id}.`);
  }
  let graphicsBase;
  for (const [index, block] of frame.blocks.entries()) {
    const expected = decoded.blocks[index];
    if (block.size !== 16 || block.flipY || block.x !== expected.x || block.y !== expected.y || block.flipX !== expected.flipX || block.priority !== expected.priority) {
      throw new Error(`Native frame and block disagree: ${frame.id}/${block.id}.`);
    }
    for (const [quadrant, address] of block.tiles.entries()) {
      if (!Number.isSafeInteger(address)) {
        throw new Error(`Body tiles require ROM addresses: ${frame.id}.`);
      }
      const relative = decoded.tileOffsets[index * 4 + quadrant];
      const base = address & 16711680 | address - relative & 65535;
      if (graphicsBase === void 0) {
        graphicsBase = base;
      }
      if (base !== graphicsBase) {
        throw new Error(`Native tile references disagree: ${frame.id}/${block.id}.`);
      }
    }
  }
}
function validateFrameComposition(layout, frame) {
  const retained = frame.blocks !== void 0 || frame.placements !== void 0 || frame.nativeFrame !== void 0 || frame.origin !== void 0;
  if (!retained) {
    return;
  }
  if (!Array.isArray(frame.origin) || frame.origin.length !== 2 || frame.origin.some((v) => !Number.isSafeInteger(v)) || !Array.isArray(frame.placements)) {
    throw new Error(`Incomplete retained composition: ${frame.id}.`);
  }
  const expected = deriveFramePlacements(layout, frame);
  validateNativeFrame(frame);
  if (frame.placements.length !== expected.length || expected.some(
    (p, i) => JSON.stringify(placementValue(p)) !== JSON.stringify(placementValue(frame.placements[i]))
  )) {
    throw new Error(`Derived placements disagree with native blocks: ${frame.id}.`);
  }
  return expected;
}

// packages/assets/plugins/secret-of-mana/som-sprite-palettes.mjs
function expandChannel(value) {
  return value << 3 | value >>> 2;
}
function paletteRecord(catalog, id) {
  if (catalog?.version !== 1 || !catalog.palettes || typeof id !== "string") {
    throw new Error("Palette catalogue requires version 1 palette records.");
  }
  const palette = catalog.palettes[id];
  if (!palette || palette.romAddress !== id || ![0, 1].includes(palette.firstIndex) || !Array.isArray(palette.words) || palette.words.length < 1 || palette.words.length > 256 || palette.words.some((word) => typeof word !== "string" || !/^[0-9A-Fa-f]{4}$/.test(word))) {
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
function spritePaletteBytes(catalog, id) {
  const words = paletteRecord(catalog, id).words;
  const bytes = new Uint8Array(words.length * 2);
  for (const [index, raw] of words.entries()) {
    const word = Number.parseInt(raw, 16);
    bytes[index * 2] = word & 255;
    bytes[index * 2 + 1] = word >>> 8;
  }
  return bytes;
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
  if (palette.firstIndex === 1) colors.unshift([0, 0, 0, 0]);
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
  let catalog;
  try {
    catalog = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch (error) {
    throw new Error("Invalid sprite palette catalogue.", { cause: error });
  }
  if (catalog?.version !== 1 || !catalog.palettes || typeof catalog.palettes !== "object") {
    throw new Error("Sprite palette catalogue must contain version 1 palette records.");
  }
  return catalog;
}
function readSpritePaletteCatalog(options, resources) {
  if (typeof options.palettes !== "string" || !options.palettes.endsWith(".json")) {
    throw new Error("Sprite frames require a shared palettes JSON resource.");
  }
  const resource = resources[options.palettes];
  if (!resource) throw new Error(`Missing sprite palette catalogue: ${options.palettes}.`);
  return parseSpritePaletteCatalog(resource.bytes);
}

// packages/assets/plugins/secret-of-mana/som-frame-atlas.mjs
function rectangle(bounds, width, height, label) {
  if (!Array.isArray(bounds) || bounds.length !== 4 || bounds.some((v) => !Number.isSafeInteger(v)) || bounds[0] < 0 || bounds[1] < 0 || bounds[2] < 1 || bounds[3] < 1 || bounds[0] + bounds[2] > width || bounds[1] + bounds[3] > height) {
    throw new Error(`Invalid ${label} bounds.`);
  }
}
function validateFrameLayout(layout, { segmentName, whole = false } = {}) {
  if (layout?.version !== 1 || !layout.segments || !Number.isInteger(layout.width) || !Number.isInteger(layout.height)) {
    throw new Error("Frame atlas requires a version 1 layout with dimensions and segments.");
  }
  if (!Array.isArray(layout.paletteRefs) || layout.paletteRefs.length < 1 || layout.paletteRefs.length > 15) {
    throw new Error("Frame atlas layout must reference one to fifteen ROM palettes.");
  }
  if (layout.guideIndex !== layout.paletteRefs.length * 16) {
    throw new Error("Frame atlas guide index must follow the source palette groups.");
  }
  for (const variant of layout.paletteVariants ?? []) {
    if (!Number.isInteger(variant.group) || variant.group < 0 || variant.group >= layout.paletteRefs.length) {
      throw new Error("Frame atlas palette variant refers to an invalid source group.");
    }
  }
  if (layout.tileSources !== void 0 && layout.tileSources !== "native-strip") {
    throw new Error("Unknown atlas tile source mode.");
  }
  const names = whole ? Object.keys(layout.segments) : [segmentName];
  for (const name of names) {
    const segment = layout.segments[name];
    if (!segment || !Array.isArray(segment.tiles) || segment.tiles.length === 0) {
      throw new Error(`Unknown or empty frame atlas segment: ${name}.`);
    }
    if (!Number.isInteger(segment.palette) || segment.palette < 0 || segment.palette >= layout.paletteRefs.length) {
      throw new Error(`Frame atlas segment ${name} has no source palette.`);
    }
    if (layout.tileSources === "native-strip" && !segment.tileAtlas) {
      throw new Error(`Missing stable tile storage: ${name}.`);
    }
    if (layout.tileSources === "native-strip") {
      rectangle(segment.tileAtlas.bounds, layout.width, layout.height, `${name} stable storage`);
    }
    for (const [index, tile] of segment.tiles.entries()) {
      if (layout.tileSources === "native-strip") {
        const strip = segment.tileAtlas;
        if (tile.x !== strip.bounds[0] + index % strip.columns * strip.step || tile.y !== strip.bounds[1] + Math.floor(index / strip.columns) * strip.step || tile.flipX || tile.flipY) {
          throw new Error(`Stable tile source moved into pose geometry: ${name}/${index}.`);
        }
      }
      rectangle(
        [tile.x, tile.y, 8, 8],
        layout.width,
        layout.height,
        `source rectangle for ${name} tile ${index}`
      );
      if (tile.flipX !== void 0 && typeof tile.flipX !== "boolean" || tile.flipY !== void 0 && typeof tile.flipY !== "boolean") {
        throw new Error(`Invalid source rectangle flips for ${name} tile ${index}.`);
      }
    }
    if ((whole || layout.tileSources === "native-strip") && segment.tileAtlas) {
      const strip = segment.tileAtlas;
      rectangle(strip.bounds, layout.width, layout.height, `${name} tile atlas`);
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
    if (!Array.isArray(layout.frames)) {
      throw new Error("Frame atlas frames must be an array.");
    }
    const ids = /* @__PURE__ */ new Set();
    const nativeRecords = /* @__PURE__ */ new Map();
    for (const frame of layout.frames) {
      const validId = typeof frame.id === "string" && frame.id.length > 0 || Number.isSafeInteger(frame.id);
      if (!validId || ids.has(frame.id)) {
        throw new Error(`Duplicate/empty frame ${frame.id}.`);
      }
      ids.add(frame.id);
      rectangle(frame.bounds, layout.width, layout.height, `frame ${frame.id}`);
      validateFrameComposition(layout, frame);
      const record = frame.nativeFrame;
      if (record?.bytes) {
        const previous = nativeRecords.get(record.address);
        if (previous && JSON.stringify(previous) !== JSON.stringify(record)) {
          throw new Error(`Shared native frame records disagree: ${frame.id}.`);
        }
        nativeRecords.set(record.address, record);
      }
    }
    const ordered = [...nativeRecords.values()].sort((a, b) => a.address - b.address);
    for (let i = 1; i < ordered.length; i++) {
      if (ordered[i].address < ordered[i - 1].end) {
        throw new Error("Overlapping native frame records.");
      }
    }
    if (layout.tileSources === "native-strip") {
      const strips = Object.entries(layout.segments).map(([name, segment]) => ({
        id: name,
        bounds: segment.tileAtlas.bounds
      }));
      for (const [index, strip] of strips.entries()) {
        const [x, y, width, height] = strip.bounds;
        for (const other of [...layout.frames, ...strips.slice(index + 1)]) {
          const [ox, oy, ow, oh] = other.bounds;
          if (x < ox + ow && ox < x + width && y < oy + oh && oy < y + height) {
            throw new Error(`Stable storage overlaps ${other.id}: ${strip.id}.`);
          }
        }
      }
    }
  }
  return layout;
}
function inspectFrameAtlas(source, layout, catalog, options = {}) {
  validateFrameLayout(layout, options);
  const image = pngImporter.import(source).value;
  if (image.kind !== "indexed-image" || image.width !== layout.width || image.height !== layout.height) {
    throw new Error("Frame atlas must be an indexed PNG with the layout's exact dimensions.");
  }
  const colors = layout.paletteRefs.flatMap((id) => spritePaletteColors(catalog, id));
  if (!image.palette[layout.guideIndex]) {
    throw new Error("Frame atlas is missing its guide index.");
  }
  for (const variant of layout.paletteVariants ?? []) {
    spritePaletteColors(catalog, variant.palette);
  }
  for (let index = 0; index < colors.length; index++) {
    if (!image.palette[index] || image.palette[index].some((component, channel) => component !== colors[index][channel])) {
      throw new Error(`Frame atlas palette color ${index} no longer matches its layout.`);
    }
  }
  const tiles = /* @__PURE__ */ new Map();
  const names = options.whole ? Object.keys(layout.segments) : [options.segmentName];
  for (const name of names) {
    const segment = layout.segments[name];
    const indexMap = Array(256).fill(null);
    for (let i = 0; i < 16; i++) {
      indexMap[segment.palette * 16 + i] = i;
    }
    indexMap[0] = 0;
    indexMap[layout.guideIndex] = 0;
    tiles.set(
      name,
      segment.tiles.map((placement, index) => {
        try {
          return extractIndexedRegion(image, { ...placement, width: 8, height: 8, indexMap });
        } catch (cause) {
          throw new Error(`Frame atlas ${name} tile ${index}: ${cause.message}`, { cause });
        }
      })
    );
  }
  return { image, layout, tiles };
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
function encodeFrameAtlas(source, layout, segmentName, catalog) {
  return encodeInspectedFrameSegment(
    inspectFrameAtlas(source, layout, catalog, { segmentName }),
    segmentName
  );
}
function readFrameLayout(options, resources) {
  if (typeof options.layout !== "string" || !options.layout.endsWith(".json")) {
    throw new Error("Frame atlas layout must name a JSON sidecar.");
  }
  const resource = resources[options.layout];
  if (!resource) {
    throw new Error(`Missing frame atlas layout: ${options.layout}.`);
  }
  let layout;
  try {
    layout = JSON.parse(new TextDecoder().decode(resource.bytes));
  } catch (error) {
    throw new Error(`Invalid frame atlas layout: ${options.layout}.`, { cause: error });
  }
  return layout;
}

// packages/assets/plugins/secret-of-mana/som-room-assets.mjs
import assert2 from "node:assert/strict";
function integer2(value, maximum, name) {
  assert2(
    Number.isInteger(value) && value >= 0 && value <= maximum,
    `${name} must be 0..${maximum}.`
  );
  return value;
}
function parseRoomAsset(source) {
  assert2.equal(source.mediaType, "application/json", "Room source must be JSON.");
  const room = JSON.parse(new TextDecoder().decode(source.bytes));
  assert2.equal(room.format, "som.room");
  assert2.equal(room.version, 1);
  integer2(room.id, 510, "room id");
  assert2(
    Array.isArray(room.header) && room.header.length === 8,
    "Room header requires eight bytes."
  );
  for (const byte of room.header) integer2(byte, 255, "header byte");
  for (const key of ["entities", "pieces", "triggers"])
    assert2(Array.isArray(room[key]), `Missing room ${key}.`);
  return room;
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
      const layout = integer2(piece.layout, 1023, "layout id");
      assert2(layout > 0, "Native layout IDs are one-based.");
      bytes.push(
        ...predicate,
        layout & 255,
        integer2(piece.x, 127, "piece x") << 1 | layout >>> 8 & 1,
        integer2(piece.y, 127, "piece y") << 1 | layout >>> 9 & 1
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
  for (const section of ["objects", "assembly", "triggers"])
    outputs[section] = { bytes: encodeRoomSection(room, section) };
  assert2(
    typeof options.section === "string" && Object.hasOwn(outputs, options.section),
    "Select a room section."
  );
  return { primaryOutput: options.section, outputs };
}
function renderRoomAsset(room, preview, { layer, story } = {}) {
  assert2.equal(preview.format, "som.room.preview");
  assert2.equal(preview.version, 1);
  assert2(layer === void 0 || layer === 1 || layer === 2, "Preview layer must be 1 or 2.");
  const key = `${room.header[0] & 63}:${room.header[2]}:${room.header[1] & 127}`;
  const assets = preview.tilesets[key];
  assert2(assets, `Preview resources do not contain tileset ${key}.`);
  const states = { ...room.previewStory, ...story };
  const pieces = room.pieces.filter((piece) => {
    const value = states[piece.variable];
    integer2(value, 255, `preview story ${piece.variable}`);
    return value >= piece.minimum && value <= piece.maximum;
  });
  assert2(pieces.length, "No active room pieces in this preview state.");
  let width = 0, height = 0;
  for (const piece of pieces) {
    integer2(piece.x, 127, "piece x");
    integer2(piece.y, 127, "piece y");
    assert2(piece.layer === 1 || piece.layer === 2, "Piece layer must be 1 or 2.");
    const layout = preview.layouts[piece.layout];
    assert2(
      layout && layout.tiles.length === layout.width * layout.height,
      "Missing or incomplete layout preview."
    );
    integer2(layout.width, 128, "layout width");
    integer2(layout.height, 128, "layout height");
    assert2(layout.width && layout.height, "Layout dimensions must be positive.");
    width = Math.max(width, piece.x + layout.width);
    height = Math.max(height, piece.y + layout.height);
  }
  assert2(width <= 128 && height <= 128, "Room pieces exceed the native 128-tile layer bounds.");
  const maps = [/* @__PURE__ */ new Map(), /* @__PURE__ */ new Map()];
  for (const piece of pieces) {
    const layout = preview.layouts[piece.layout];
    for (let y = 0; y < layout.height; y++)
      for (let x = 0; x < layout.width; x++) {
        maps[piece.layer - 1].set(
          (piece.y + y) * width + piece.x + x,
          layout.tiles[y * layout.width + x]
        );
      }
  }
  const pixelWidth = width * 16, pixelHeight = height * 16;
  const rgba = new Uint8Array(pixelWidth * pixelHeight * 4);
  for (let i = 0; i < rgba.length; i += 4) rgba.set([10, 14, 22, 255], i);
  assert2(/^(?:[\da-f]{2})+$/i.test(assets.graphics), "Invalid planar graphics.");
  const graphics = Uint8Array.from(assets.graphics.match(/../g), (byte) => parseInt(byte, 16));
  assert2(
    typeof assets.graphicsKnown === "string" && /^(?:00|01)+$/.test(assets.graphicsKnown) && assets.graphicsKnown.length === assets.graphics.length,
    "Preview graphics require a matching physical-coverage mask."
  );
  const graphicsKnown = Uint8Array.from(
    assets.graphicsKnown.match(/../g),
    (byte) => parseInt(byte, 16)
  );
  assert2(
    assets.colors.length === 128 && assets.layerWords.length === 2,
    "Incomplete palette/metatile preview."
  );
  const passes = layer ? [
    [layer - 1, 0],
    [layer - 1, 1]
  ] : [
    [1, 0],
    [0, 0],
    [1, 1],
    [0, 1]
  ];
  for (const [plane, priority] of passes)
    for (const [position, tile] of maps[plane]) {
      integer2(tile, 191, "static metatile id");
      const words = assets.layerWords[plane];
      assert2.equal(words.length, 768);
      const mapX = position % width, mapY = Math.floor(position / width);
      for (let part = 0; part < 4; part++) {
        const word = integer2(words[tile * 4 + part], 65535, "metatile word");
        if ((word >>> 13 & 1) !== priority) continue;
        const offset = (word & 1023) * 32;
        assert2(offset + 32 <= graphics.length, "Preview references uncaptured graphics.");
        assert2(
          graphicsKnown.subarray(offset, offset + 32).every((byte) => byte === 1),
          "Preview references unknown physical graphics bytes."
        );
        for (let y = 0; y < 8; y++)
          for (let x = 0; x < 8; x++) {
            const sx = word & 16384 ? 7 - x : x, sy = word & 32768 ? 7 - y : y;
            let color = 0;
            for (let bit = 0; bit < 4; bit++)
              color |= (graphics[offset + (bit >>> 1) * 16 + sy * 2 + bit % 2] >>> 7 - sx & 1) << bit;
            if (!color) continue;
            const bgr = integer2(
              assets.colors[(word >>> 10 & 7) * 16 + color],
              65535,
              "palette word"
            );
            const at = ((mapY * 16 + (part >>> 1) * 8 + y) * pixelWidth + mapX * 16 + part % 2 * 8 + x) * 4;
            rgba.set(
              [0, 5, 10].map((shift) => Math.floor((bgr >>> shift & 31) * 255 / 31)),
              at
            );
          }
      }
    }
  return {
    rgba,
    width: pixelWidth,
    height: pixelHeight,
    tileset: key,
    activePieces: pieces.map((piece) => piece.layout),
    limitation: "Background geometry only; omits actors, BG3, camera, mutable clones and color math."
  };
}

// packages/assets/plugins/secret-of-mana/som-world-rle.mjs
function decodeWorldRow(bytes, size = 512) {
  if (!Number.isSafeInteger(size) || size < 1 || size > 65536)
    throw new Error("World row size must be 1..65536 tiles.");
  const data = new Uint8Array(size);
  let input = 0, output = 0;
  while (output < size) {
    if (input >= bytes.length) throw new Error("Truncated world row token.");
    const token = bytes[input++];
    let count = 1, tile = token;
    if (token >= 192) {
      count = (token & 63) + 1;
      if (input >= bytes.length) throw new Error("Truncated world row run.");
      tile = bytes[input++];
    }
    if (output + count > size) throw new Error("World row run crosses its output boundary.");
    data.fill(tile, output, output + count);
    output += count;
  }
  return { data, consumed: input };
}
function encodeWorldRow(bytes) {
  if (bytes.length < 1 || bytes.length > 65536)
    throw new Error("World row size must be 1..65536 tiles.");
  const output = [];
  for (let index = 0; index < bytes.length; ) {
    const tile = bytes[index];
    let count = 1;
    while (count < 64 && index + count < bytes.length && bytes[index + count] === tile) count++;
    if (count >= 3 || tile >= 192) output.push(191 + count, tile);
    else for (let i = 0; i < count; i++) output.push(tile);
    index += count;
  }
  return Uint8Array.from(output);
}

// packages/assets/plugins/secret-of-mana/som-asset-plugin.mjs
var registry = new AssetRegistry().registerImporter(pngImporter);
for (const encoder of withImageEncoders(snesNativeEncoders)) registry.registerEncoder(encoder);
function nativeBossChunk(png, wanted = "soMz") {
  const signature2 = [137, 80, 78, 71, 13, 10, 26, 10];
  if (png.length < 8 || signature2.some((byte, index) => png[index] !== byte)) {
    throw new Error("Boss graphics require a PNG source.");
  }
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  let native;
  for (let offset = 8; offset < png.length; ) {
    if (offset + 12 > png.length) throw new Error("Truncated boss graphics PNG chunk.");
    const length = view.getUint32(offset);
    const end = offset + 12 + length;
    if (end > png.length) throw new Error("Truncated boss graphics PNG payload.");
    const type = String.fromCharCode(...png.subarray(offset + 4, offset + 8));
    if (type === wanted) {
      if (native) throw new Error("Duplicate native boss graphics PNG chunk.");
      native = png.slice(offset + 8, end - 4);
    }
    offset = end;
  }
  return native;
}
function decodeBossStream(native, storage, size) {
  let intermediate = native;
  let mode;
  let unusedHeaderByte;
  if (storage === "lz-rle") {
    const decoded = decompressSomLz(native);
    if (decoded.compressedBytes !== native.length) throw new Error("Boss LZ stream has trailing bytes.");
    intermediate = decoded.data;
    mode = decoded.mode;
    unusedHeaderByte = decoded.unusedHeaderByte;
  }
  const expanded = expandBossGraphics(intermediate, size);
  if (expanded.consumed !== intermediate.length) throw new Error("Boss mask stream has trailing bytes.");
  return { bytes: expanded.data, mode, unusedHeaderByte };
}
function convertBossImage(source, options, resources = {}) {
  const { storage, byteLength, mode, unusedHeaderByte = 0 } = options;
  if (!["lz-rle", "rle"].includes(storage)) throw new Error("Boss storage must be lz-rle or rle.");
  if (!Number.isSafeInteger(byteLength) || byteLength < 1) {
    throw new Error("Boss byteLength must be a positive integer.");
  }
  const layout = options.layout ? readFrameLayout(options, resources) : void 0;
  const pixels = layout ? encodeFrameAtlas(source, layout, options.segment, readSpritePaletteCatalog(options, resources)) : convertAsset(registry, { source, format: "snes.tile.4bpp" }).outputs.tiles.bytes;
  const segmentIndex = layout ? Object.keys(layout.segments).indexOf(options.segment) : -1;
  if (segmentIndex > 25) throw new Error("Boss atlas supports at most 26 native segments.");
  const chunkName = segmentIndex < 0 ? "soMz" : `soM${String.fromCharCode(65 + segmentIndex)}`;
  const original = nativeBossChunk(source.bytes, chunkName);
  if (original) {
    if (original.length !== byteLength) throw new Error("Boss PNG native chunk has the wrong byte length.");
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
    encoded = compressSomLz(intermediate, { mode: selectedMode, unusedHeaderByte: selectedHeaderByte });
  }
  if (encoded.length > byteLength) throw new Error("Edited boss graphics exceed their fixed ROM span.");
  const verified = decodeBossStream(encoded, storage, pixels.length).bytes;
  if (verified.some((byte, index) => byte !== pixels[index])) throw new Error("Boss graphics inverse failed.");
  const padded = new Uint8Array(byteLength);
  padded.set(encoded);
  if (original) padded.set(original.subarray(encoded.length), encoded.length);
  return { primaryOutput: "graphics", outputs: { graphics: { bytes: padded } } };
}
function verifiedBrrFromWave(source) {
  const document2 = waveImporter.import(source);
  const pcm = document2.value.samples;
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
    if (offset + 8 > bytes.length) throw new Error("Truncated SoM BRR WAVE chunk.");
    const length = view.getUint32(offset + 4, true);
    const end = offset + 8 + length;
    if (end + (length & 1) > bytes.length) throw new Error("Truncated SoM BRR WAVE data.");
    const id = String.fromCharCode(...bytes.subarray(offset, offset + 4));
    if (id === "sBRR") {
      if (native) throw new Error("Duplicate native BRR chunk in SoM WAVE.");
      native = bytes.slice(offset + 8, end);
    }
    offset = end + (length & 1);
  }
  if (!native) throw new Error("SoM WAVE is missing its native sBRR chunk.");
  const decoded = decodeBrrPcm(native);
  if (decoded.length !== pcm.length || decoded.some((sample, index) => sample !== pcm[index])) {
    throw new Error("SoM WAVE PCM no longer matches its native BRR blocks.");
  }
  return native;
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
  if (!Number.isInteger(group) || group < 0 || group > 2)
    throw new Error("actor group must be 0..2.");
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
  if (!(bytes instanceof Uint8Array) || bytes.length % 24)
    throw new Error("Actor stream requires complete 24-byte tiles.");
  return Array.from(
    { length: bytes.length / 24 },
    (_, tileIndex) => Array.from(
      { length: 8 },
      (_2, y) => Array.from({ length: 8 }, (_3, x) => {
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
    if (tile.length !== 8) throw new Error(`Actor tile ${tileIndex} needs eight rows.`);
    tile.forEach((row, y) => {
      if (row.length !== 8) throw new Error(`Actor tile ${tileIndex} row ${y} needs eight pixels.`);
      row.forEach((color, x) => {
        if (!Number.isInteger(color) || color < 0 || color > 7)
          throw new Error(`Actor tile ${tileIndex} pixel ${x},${y} needs a 3bpp index.`);
        for (let plane = 0; plane < 3; plane++) {
          bytes[tileIndex * 24 + y * 3 + plane] |= (color >>> plane & 1) << 7 - x;
        }
      });
    });
  });
  return bytes;
}
function decodeActor3bpp(bytes, group) {
  if (!Number.isInteger(group) || group < 0 || group > 2)
    throw new Error("actor group must be 0..2.");
  const tiles = decodeActor3bppNative(bytes).map(
    (tile) => tile.map(
      (row) => row.map((color) => {
        if (color >= 6) throw new Error("Actor source color 6/7 has no unique 4bpp inverse.");
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
  const { group, ...imageOptions2 } = options;
  if (!Number.isInteger(group) || group < 0 || group > 2)
    throw new Error("actor group must be 0..2.");
  return imageOptions2;
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
        const bytes = spritePaletteBytes(parseSpritePaletteCatalog(source.bytes), options.palette);
        return { primaryOutput: "palette", outputs: { palette: { bytes } } };
      }
    });
    context.registerAssetFormat({
      id: "som.boss.graphics",
      version: "1.0.0",
      targets: ["snes.sfc"],
      resourcePaths: (options) => typeof options.layout === "string" ? [options.layout, options.palettes].filter((path) => typeof path === "string") : [],
      convert: convertBossImage
    });
    context.registerAssetFormat({
      id: "som.sprite.frames",
      version: "1.0.0",
      targets: ["snes.sfc"],
      resourcePaths: (options) => [options.layout, options.palettes].filter((path) => typeof path === "string"),
      convert(source, options, resources) {
        const tiles = encodeFrameAtlas(
          source,
          readFrameLayout(options, resources),
          options.segment,
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
        const packed = encodeActor3bpp(native, options.group);
        const decoded = decodeActor3bpp(packed, options.group);
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
      convert(source) {
        return {
          primaryOutput: "brr",
          outputs: { brr: { bytes: verifiedBrrFromWave(source) } }
        };
      }
    });
    context.registerAssetFormat({
      id: "som.brr.segment",
      version: "1.0.0",
      targets: ["snes.sfc"],
      convert(source, options) {
        const brr = verifiedBrrFromWave(source);
        return {
          primaryOutput: "brr",
          outputs: { brr: { bytes: sliceBrrSegment(brr, options) } }
        };
      }
    });
    context.registerAssetTransform({
      id: "som.world.rle",
      version: "1.0.0",
      targets: ["snes.sfc"],
      optionSchema: { size: { type: "integer", minimum: 1, maximum: 65536 } },
      encode: (bytes, options) => {
        if (bytes.length !== (options.size ?? 512)) throw new Error("World row size mismatch.");
        return encodeWorldRow(bytes);
      },
      decode: (bytes, options, maxOutputBytes) => {
        const size = options.size ?? 512;
        if (size > maxOutputBytes) throw new Error("World row exceeds output limit.");
        const result = decodeWorldRow(bytes, size);
        if (result.consumed !== bytes.length) throw new Error("Trailing bytes after world row.");
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
        if (result.compressedBytes !== bytes.length)
          throw new Error("Trailing bytes after SoM LZ stream.");
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
  const layout = readFrameLayout(input.options, input.resources);
  const catalog = readSpritePaletteCatalog(input.options, input.resources);
  const segment = input.options.segment;
  if (typeof segment !== "string") {
    throw new Error("Frame atlas preview requires a segment name.");
  }
  const inspected = inspectFrameAtlas(input.source, layout, catalog, { segmentName: segment });
  let encodedBytes;
  let output;
  if (input.format === "som.boss.graphics") {
    const result = convertBossImage(input.source, input.options, input.resources);
    encodedBytes = result.outputs.graphics.bytes.length;
    output = "graphics";
  } else {
    encodedBytes = encodeInspectedFrameSegment(inspected, segment).length;
    output = "tiles";
  }
  if (input.output !== void 0 && input.output !== output) {
    throw new Error(`Asset format '${input.format}' has no output '${input.output}'.`);
  }
  const image = inspected.image;
  if (image.kind !== "indexed-image") {
    throw new Error("Frame atlas preview requires an indexed PNG.");
  }
  const rgba = new Uint8Array(image.width * image.height * 4);
  for (let pixel = 0; pixel < image.indexes.length; pixel++) {
    const color = image.palette[image.indexes[pixel]];
    if (!color) {
      throw new Error(`Frame atlas pixel ${pixel} has no palette color.`);
    }
    rgba.set(color, pixel * 4);
  }
  const paletteId = layout.paletteRefs[layout.segments[segment].palette];
  const palette = catalog.palettes[paletteId];
  if (!palette) {
    throw new Error(`Unknown sprite palette ${paletteId}.`);
  }
  return {
    kind: "image",
    sourceBytes: input.source.bytes.length,
    encodedBytes,
    format: input.format,
    output,
    metadata: {
      segment,
      paletteId,
      paletteRomAddress: palette.romAddress,
      paletteUsers: palette.users
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
  if (typeof resourcePath !== "string" || !input.resources[resourcePath]) {
    throw new Error("Room preview requires its shared preview JSON resource.");
  }
  const resource = input.resources[resourcePath];
  if (resource.mediaType !== "application/json") {
    throw new Error("Room preview resource must be JSON.");
  }
  const room = parseRoomAsset(input.source);
  const preview = renderRoomAsset(room, JSON.parse(new TextDecoder().decode(resource.bytes)), {
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
      rgbaPreviewPng(preview.rgba, preview.width, preview.height)
    ).toString("base64")
  };
}
function convertSomBrrPreview(input) {
  if (input.output !== void 0 && input.output !== "brr") {
    throw new Error(`Asset format '${input.format}' has no output '${input.output}'.`);
  }
  const native = verifiedBrrFromWave(input.source);
  const sourceAudio = waveImporter.import(input.source).value;
  const segment = input.format === "som.brr.segment";
  const selected = segment ? sliceBrrSegment(native, input.options) : native;
  const decoded = decodeBrrPcm(native);
  const metadata = { previewScope: "full-stream" };
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
  const selected = result.outputs[outputName];
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
  const preview = result.outputs.preview;
  if (preview?.mediaType === "application/x-rgba") {
    const width = Number(preview.metadata?.width);
    const height = Number(preview.metadata?.height);
    const thumbnail = rgbaPreviewPng(preview.bytes, width, height, 192);
    const composed = rgbaPreviewPng(preview.bytes, width, height, 1024);
    const indexes = preview.metadata?.tileIndexByCoordinate;
    let storage;
    if (Array.isArray(indexes) && width % 8 === 0 && height % 8 === 0) {
      storage = rgbaPreviewPng(
        storagePixels(preview.bytes, width, height, indexes),
        width,
        height,
        1024
      );
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
    const audio = result.document.value;
    const decodedWav = result.outputs.reviewWav?.bytes;
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
